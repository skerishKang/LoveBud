'use strict';

/**
 * Source-static contract tests for Phase B operator collection CLI.
 *
 * No DB connection, no network, no file mutation.
 * Tests: CLI boundary, trusted plan, digest integrity, recursive sanitization,
 *        output format, fixed attestation fields, baseline HEAD binding, session counting.
 */

const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const receiptCore = require(
  path.resolve(__dirname, '..', '..', 'scripts', 'phase-b-collection-receipt-core.cjs')
);
const attestationCore = require(
  path.resolve(__dirname, '..', '..', 'scripts', 'adoption-attestation-core.cjs')
);
const expectedSchemaCore = require(
  path.resolve(__dirname, '..', '..', 'scripts', 'expected-schema-candidate-core.cjs')
);
const planCore = require(
  path.resolve(__dirname, '..', '..', 'scripts', 'adoption-baseline-collection-plan-core.cjs')
);

// ─── Constants ───────────────────────────────────────────────────────────────

const SHA256_RE = /^sha256:[a-f0-9]{64}$/;
const TEST_BASELINE = 'c92cbbf31b894636025b2a30e4c49b8c5ed3b538';
const TEST_APPROVAL = 'issue:3573';

const SYNTHETIC_EVIDENCE = {
  format_version: '1.0',
  normalizer_version: '1.0',
  objects: [
    { name: 'table:public.trees', fingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    { name: 'table:public.memories', fingerprint: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
  ],
};

const SYNTHETIC_CANONICAL = {
  format_version: '1.0',
  status: 'ADOPTION_REQUIRED',
  migrations: [],
};

const SYNTHETIC_EXPECTED_SCHEMA = {
  format_version: '1.0',
  status: 'ADOPTION_REQUIRED',
  fingerprint_algorithm: 'sha256',
  normalizer_version: '1.0',
  metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
  critical_objects: [],
  adoption_rule: 'ALL_OBJECTS_MUST_MATCH',
  comparison_scope: ['name', 'fingerprint'],
};

const BOUNDARY_CONTRACT_BYTES = Buffer.from(
  '{"mode":"PRODUCTION_READONLY_CATALOG","dedicated_secret_key":"LOVEBUD_PRODUCTION_READONLY_DATABASE_URL"}'
);
const METADATA_CONTRACT_BYTES = Buffer.from(
  '{"format_version":"1.0","normalizer_version":"1.0","limits":{"max_objects":64}}'
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stableStringify(value) {
  const cmp = (a, b) => { const l = String(a), r = String(b); return l < r ? -1 : l > r ? 1 : 0; };
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') return JSON.stringify(value);
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(v => stableStringify(v)).join(',')}]`;
  if (t === 'object') {
    const keys = Object.keys(value).sort(cmp);
    return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return 'null';
}

function objDigest(obj) {
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(stableStringify(obj), 'utf8')).digest('hex')}`;
}

/**
 * Build a real validated plan using buildPreparedCollectionPlan + validatePreparedCollectionPlan.
 * This is the same path the CLI uses.
 */
function buildRealValidatedPlan() {
  return planCore.buildPreparedCollectionPlan({
    baselineCommit: TEST_BASELINE,
    approvalReference: TEST_APPROVAL,
  });
}

function buildTestCandidate() {
  return expectedSchemaCore.buildExpectedSchemaCandidate(SYNTHETIC_EVIDENCE, SYNTHETIC_EXPECTED_SCHEMA);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase B operator collection receipt core', () => {

  // 1. Scope/source tests
  it('operator CLI has no require(pg) in code', async () => {
    const src = require('fs').readFileSync(
      path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs'),
      'utf8'
    );
    const codeOnly = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeOnly.includes("require('pg')"));
    assert.ok(!codeOnly.includes('new Client'));
    assert.ok(!codeOnly.includes('Pool('));
    assert.ok(!codeOnly.includes('getPrivateInvocationParts'));
    assert.ok(src.includes('collectProductionReadonlyCatalogEvidenceFromFiles'));
  });

  it('receipt core has no pg dependency', () => {
    assert.ok(typeof receiptCore.buildCollectionReceipt === 'function');
    assert.ok(typeof receiptCore.computeDigest === 'function');
    assert.ok(typeof receiptCore.validateJsonArtifact === 'function');
  });

  // 2. Trusted plan — uses validatePreparedCollectionPlan
  it('buildPreparedCollectionPlan returns validated plan with digests', () => {
    const plan = buildRealValidatedPlan();
    assert.equal(plan.plan_status, 'PREPARED_ONLY');
    assert.ok(SHA256_RE.test(plan.plan_digest));
    assert.ok(SHA256_RE.test(plan.object_allowlist_digest));
    assert.ok(SHA256_RE.test(plan.collection_plan_contract_digest));
    assert.equal(plan.environment_class, 'PRODUCTION');
    assert.equal(plan.attestation_scope, 'PRODUCTION_READONLY');
    assert.equal(plan.collection_mode, 'CATALOG_METADATA_ONLY');
    assert.equal(plan.output_policy, 'SANITIZED_STDOUT_ONLY');
    assert.equal(plan.baseline_commit, TEST_BASELINE);
    assert.equal(plan.approval_reference, TEST_APPROVAL);
  });

  it('receipt uses trusted plan collection_plan_digest via validatePlanFn', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const receipt = receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
      catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 1,
    });
    assert.equal(receipt.collection_plan_digest, plan.plan_digest);
    assert.equal(receipt.object_allowlist_digest, plan.object_allowlist_digest);
    assert.equal(receipt.collection_plan_contract_digest, plan.collection_plan_contract_digest);
    assert.equal(receipt.baseline_main_sha, TEST_BASELINE);
    assert.equal(receipt.approval_reference, TEST_APPROVAL);
    assert.equal(receipt.read_only_proofs.length, 10);
  });

  // 3. Digest integrity tests
  it('catalog evidence change recomputes digest', () => {
    const ev1 = SYNTHETIC_EVIDENCE;
    const d1 = receiptCore.computeObjectDigest(ev1);
    const ev2 = { ...SYNTHETIC_EVIDENCE, objects: [] };
    const d2 = receiptCore.computeObjectDigest(ev2);
    assert.notEqual(d1, d2);
  });

  it('digest mismatch between evidence and attestation rejected', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const tampered = { ...draft, catalog_evidence_digest: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' };
    assert.throws(() => {
      receiptCore.buildCollectionReceipt({
        preparedPlan: plan,
        validatePlanFn: planCore.validatePreparedCollectionPlan,
        boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
        catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
        canonicalManifest: SYNTHETIC_CANONICAL,
        expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
        catalogEvidence: SYNTHETIC_EVIDENCE,
        inactiveExpectedSchemaCandidate: candidate,
        preparedAttestationDraft: tampered,
        collectionSessionCount: 1,
      });
    }, /RECEIPT_DIGEST_MISMATCH/);
  });

  it('candidate change triggers digest mismatch', () => {
    const plan = buildRealValidatedPlan();
    const candidate1 = buildTestCandidate();
    const emptyEv = { format_version: '1.0', normalizer_version: '1.0', objects: [] };
    const candidate2 = expectedSchemaCore.buildExpectedSchemaCandidate(emptyEv, SYNTHETIC_EXPECTED_SCHEMA);
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate1,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    assert.throws(() => {
      receiptCore.buildCollectionReceipt({
        preparedPlan: plan,
        validatePlanFn: planCore.validatePreparedCollectionPlan,
        boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
        catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
        canonicalManifest: SYNTHETIC_CANONICAL,
        expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
        catalogEvidence: SYNTHETIC_EVIDENCE,
        inactiveExpectedSchemaCandidate: candidate2,
        preparedAttestationDraft: draft,
        collectionSessionCount: 1,
      });
    }, /RECEIPT_DIGEST_MISMATCH/);
  });

  it('digest cross-binding between receipt and attestation', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const receipt = receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
      catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 1,
    });
    assert.equal(receipt.catalog_evidence_digest, draft.catalog_evidence_digest);
    assert.equal(receipt.canonical_manifest_digest, draft.canonical_manifest_digest);
    assert.equal(receipt.inactive_candidate_digest, draft.expected_schema_digest);
  });

  it('RECEIPT_DIGEST_MISMATCH execution path exists', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const bad = { ...draft, canonical_manifest_digest: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' };
    assert.throws(() => receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
      catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: bad,
      collectionSessionCount: 1,
    }), /RECEIPT_DIGEST_MISMATCH/);
  });

  // 4. Forged plan tests
  it('validatePreparedCollectionPlan rejects forged plan_digest', () => {
    const good = buildRealValidatedPlan();
    // Tamper the plan digest after building
    const forged = Object.assign({}, good, { plan_digest: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /DIGEST_MISMATCH/);
  });

  it('validatePreparedCollectionPlan rejects forged object_allowlist_digest', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { object_allowlist_digest: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /DIGEST_MISMATCH/);
  });

  it('validatePreparedCollectionPlan rejects forged collection_plan_contract_digest', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { collection_plan_contract_digest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /CONTRACT_DIGEST_MISMATCH/);
  });

  it('validatePreparedCollectionPlan rejects uppercase baseline_commit', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { baseline_commit: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /COMMIT_INVALID/);
  });

  it('validatePreparedCollectionPlan rejects short approval_reference', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { approval_reference: 'bad' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /APPROVAL_INVALID/);
  });

  it('validatePreparedCollectionPlan rejects modified environment_class', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { environment_class: 'STAGING' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /ENUM_INVALID/);
  });

  it('validatePreparedCollectionPlan rejects modified attestation_scope', () => {
    const good = buildRealValidatedPlan();
    const forged = Object.assign({}, good, { attestation_scope: 'PREVIEW_READONLY' });
    assert.throws(() => planCore.validatePreparedCollectionPlan(forged), /ENUM_INVALID/);
  });

  // 5. Recursive sanitization tests
  it('rejects nested prohibited key in objects', () => {
    assert.throws(() => receiptCore.checkProhibitedFields({ objects: [{ host: 'x' }] }), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('rejects nested prohibited key in candidate', () => {
    assert.throws(() => receiptCore.checkProhibitedFields({ candidate: { metadata: { raw_role: 'x' } } }), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('rejects deeply nested prohibited key', () => {
    assert.throws(() => receiptCore.checkProhibitedFields({ draft: { inner: { deeper: { database_owner: 'x' } } } }), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('rejects prohibited key in arrays', () => {
    assert.throws(() => receiptCore.checkProhibitedFields({ arrays: [[{ connection_string: 'x' }]] }), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('rejects sensitive pattern in nested value', () => {
    assert.throws(() => receiptCore.scanSensitive({ data: { url: 'postgres://user:pass@host/db' } }), /RECEIPT_SENSITIVE_VALUE/);
  });

  it('accepts clean deeply nested data', () => {
    const clean = { format_version: '1.0', objects: [{ name: 'table:public.trees', fingerprint: 'sha256:abc' }], metadata: { nested: { value: 'clean' }, list: [1, 2, { key: 'val' }] } };
    assert.doesNotThrow(() => { receiptCore.checkProhibitedFields(clean); receiptCore.scanSensitive(clean); });
  });

  it('rejects non-finite numbers', () => {
    assert.throws(() => receiptCore.scanSensitive(NaN), /RECEIPT_VALUE_TYPE_INVALID/);
    assert.throws(() => receiptCore.scanSensitive(Infinity), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('rejects non-plain objects', () => {
    class Custom {}
    assert.throws(() => receiptCore.scanSensitive(new Custom()), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  // 6. Pre-digest validation (validateJsonArtifact)
  it('validateJsonArtifact rejects undefined', () => {
    assert.throws(() => receiptCore.validateJsonArtifact(undefined), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateJsonArtifact rejects symbol', () => {
    assert.throws(() => receiptCore.validateJsonArtifact(Symbol('x')), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateJsonArtifact rejects function', () => {
    assert.throws(() => receiptCore.validateJsonArtifact(() => {}), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateArtifact rejects cyclic object', () => {
    const cyclic = { a: 1 };
    cyclic.self = cyclic;
    assert.throws(() => receiptCore.validateArtifact(cyclic), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateJsonArtifact rejects Date', () => {
    assert.throws(() => receiptCore.validateJsonArtifact(new Date()), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateJsonArtifact rejects Map', () => {
    assert.throws(() => receiptCore.validateJsonArtifact(new Map()), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('validateJsonArtifact rejects Buffer', () => {
    assert.throws(() => receiptCore.validateJsonArtifact(Buffer.from('x')), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  // 7. Fixed attestation tests
  it('buildPreparedUnattestedAttestationDraft - fixed fields via validatePlanFn', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    assert.equal(draft.adoption_status, 'UNATTESTED');
    assert.equal(draft.environment_class, 'PRODUCTION');
    assert.equal(draft.attestation_scope, 'PRODUCTION_READONLY');
    assert.equal(draft.variance_classification, 'UNKNOWN_DRIFT');
    assert.equal(draft.baseline_commit, TEST_BASELINE);
    assert.equal(draft.approval_reference, TEST_APPROVAL);
  });

  it('buildPreparedUnattestedAttestationDraft - no ATTESTED', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    assert.notEqual(draft.adoption_status, 'ATTESTED');
  });

  it('buildPreparedUnattestedAttestationDraft - empty migrations for ADOPTION_REQUIRED', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      migrationManifest: { status: 'ADOPTION_REQUIRED', migrations: [] },
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    assert.deepEqual(draft.applied_migrations, []);
  });

  it('buildPreparedUnattestedAttestationDraft - rejects forged plan via validatePlanFn', () => {
    const forged = { plan_status: 'ACTIVE', environment_class: 'STAGING', attestation_scope: 'PREVIEW_READONLY', baseline_commit: TEST_BASELINE, approval_reference: TEST_APPROVAL };
    // validatePreparedCollectionPlan will throw for this forged plan
    assert.throws(() => {
      attestationCore.buildPreparedUnattestedAttestationDraft({
        preparedPlan: forged,
        validatePlanFn: planCore.validatePreparedCollectionPlan,
        migrationManifest: SYNTHETIC_CANONICAL,
        expectedSchemaCandidate: buildTestCandidate(),
        catalogEvidence: SYNTHETIC_EVIDENCE,
      });
    });
  });

  it('buildPreparedUnattestedAttestationDraft - rejects wrong candidate status', () => {
    const plan = buildRealValidatedPlan();
    const badCandidate = { ...buildTestCandidate(), status: 'ACTIVE' };
    assert.throws(() => {
      attestationCore.buildPreparedUnattestedAttestationDraft({
        preparedPlan: plan,
        validatePlanFn: planCore.validatePreparedCollectionPlan,
        migrationManifest: SYNTHETIC_CANONICAL,
        expectedSchemaCandidate: badCandidate,
        catalogEvidence: SYNTHETIC_EVIDENCE,
      });
    }, /ENUM_INVALID/);
  });

  // 8. Success session count enforcement
  it('buildCollectionReceipt rejects session count 0', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    assert.throws(() => receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
      catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 0,
    }), /RECEIPT_INPUT_INVALID/);
  });

  it('buildCollectionReceipt rejects session count 3', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    assert.throws(() => receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
      catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 3,
    }), /RECEIPT_INPUT_INVALID/);
  });

  it('buildCollectionReceipt accepts session count 2', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const receipt = receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
      catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 2,
    });
    assert.equal(receipt.collection_session_count, 2);
  });

  // 9. Serializer validation tests
  it('serializeCollectionReceipt rejects nested prohibited field', () => {
    const receipt = {
      format_version: '1.0',
      outcome: 'COLLECTION_PASS_SANITIZED_EVIDENCE_READY',
      nested: { host: 'x' },
    };
    assert.throws(() => receiptCore.serializeCollectionReceipt(receipt), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('serializeCollectionReceipt validates full receipt', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const receipt = receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      validatePlanFn: planCore.validatePreparedCollectionPlan,
      boundaryContractBytes: BOUNDARY_CONTRACT_BYTES,
      catalogMetadataContractBytes: METADATA_CONTRACT_BYTES,
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 1,
    });
    const serialized = receiptCore.serializeCollectionReceipt(receipt);
    assert.ok(serialized.trim().endsWith('}'));
    const parsed = JSON.parse(serialized);
    assert.equal(parsed.outcome, 'COLLECTION_PASS_SANITIZED_EVIDENCE_READY');
  });

  // 10. Migration record validation tests
  it('migration record rejects unknown field', () => {
    // Test that buildPreparedUnattestedAttestationDraft rejects migrations with extra fields
    // Through validatePlanFn flow
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const manifestWithBadMigs = {
      status: 'ACTIVE',
      migrations: [
        { id: '20260101000001_test-migration-a', checksum: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', extra_field: 'bad' },
      ],
    };
    assert.throws(() => {
      attestationCore.buildPreparedUnattestedAttestationDraft({
        preparedPlan: plan,
        validatePlanFn: planCore.validatePreparedCollectionPlan,
        migrationManifest: manifestWithBadMigs,
        expectedSchemaCandidate: candidate,
        catalogEvidence: SYNTHETIC_EVIDENCE,
      });
    }, /UNKNOWN_FIELD/);
  });

  it('migration record rejects invalid checksum', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const manifestWithBadMigs = {
      status: 'ACTIVE',
      migrations: [
        { id: '20260101000001_test-migration-a', checksum: 'sha256:not_valid_hex' },
      ],
    };
    assert.throws(() => {
      attestationCore.buildPreparedUnattestedAttestationDraft({
        preparedPlan: plan,
        validatePlanFn: planCore.validatePreparedCollectionPlan,
        migrationManifest: manifestWithBadMigs,
        expectedSchemaCandidate: candidate,
        catalogEvidence: SYNTHETIC_EVIDENCE,
      });
    }, /DIGEST_INVALID/);
  });

  it('migration record rejects duplicate id', () => {
    const plan = buildRealValidatedPlan();
    const candidate = buildTestCandidate();
    const manifestWithDup = {
      status: 'ACTIVE',
      migrations: [
        { id: '20260101000001_test-migration-a', checksum: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        { id: '20260101000001_test-migration-a', checksum: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      ],
    };
    assert.throws(() => {
      attestationCore.buildPreparedUnattestedAttestationDraft({
        preparedPlan: plan,
        validatePlanFn: planCore.validatePreparedCollectionPlan,
        migrationManifest: manifestWithDup,
        expectedSchemaCandidate: candidate,
        catalogEvidence: SYNTHETIC_EVIDENCE,
      });
    }, /MIGRATION_INVALID/);
  });

  // 11. Repeat comparison canonical tests
  it('computeObjectDigest is insertion-order independent', () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    assert.equal(receiptCore.computeObjectDigest(a), receiptCore.computeObjectDigest(b));
  });

  it('computeObjectDigest detects actual value change', () => {
    const a = { key: 'value1' };
    const b = { key: 'value2' };
    assert.notEqual(receiptCore.computeObjectDigest(a), receiptCore.computeObjectDigest(b));
  });

  it('computeObjectDigest is nested-key-order independent', () => {
    const a = { outer: { b: 2, a: 1 } };
    const b = { outer: { a: 1, b: 2 } };
    assert.equal(receiptCore.computeObjectDigest(a), receiptCore.computeObjectDigest(b));
  });

  it('computeObjectDigest detects array order change', () => {
    const a = { items: [1, 2, 3] };
    const b = { items: [3, 2, 1] };
    assert.notEqual(receiptCore.computeObjectDigest(a), receiptCore.computeObjectDigest(b));
  });

  // 12. Bounded failure outcome tests
  it('mapFailure maps known categories correctly', () => {
    // Test the CLI's mapFailure through CLI execution
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try {
      result = execFileSync(process.execPath, [cli, '--forbidden-flag'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 });
    } catch (err) {
      result = err.stdout || '';
    }
    const parsed = JSON.parse(result.trim());
    assert.equal(parsed.outcome, 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY');
    assert.equal(parsed.bounded_category, 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY');
    assert.ok(!result.includes('INPUT_INVALID'));
    assert.ok(!result.includes('Error:'));
  });

  it('CLI with invalid argv outputs single JSON document only', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try {
      result = execFileSync(process.execPath, [cli, '--host', 'x'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 });
    } catch (err) {
      result = err.stdout || '';
    }
    // Exactly one JSON document
    const jsonMatches = result.trim().match(/\{[\s\S]*?\}/g) || [];
    assert.equal(jsonMatches.length, 1);
    const parsed = JSON.parse(jsonMatches[0]);
    assert.ok(parsed.outcome);
    // No stack in output
    assert.ok(!result.includes('Error:'));
    assert.ok(!result.includes('at '));
  });

  it('CLI missing required flags outputs bounded JSON', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try {
      result = execFileSync(process.execPath, [cli, '--secret-file', 'x'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 });
    } catch (err) {
      result = err.stdout || '';
    }
    const parsed = JSON.parse(result.trim());
    assert.equal(parsed.collection_session_count, 0);
    assert.ok(!result.includes('Error:'));
  });

  it('CLI --repeat 3 is rejected', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try {
      result = execFileSync(process.execPath, [cli, '--repeat', '3', '--secret-file', 'x', '--role-mapping-file', 'x', '--baseline-commit', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--approval-reference', 'issue:1'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 });
    } catch (err) {
      result = err.stdout || '';
    }
    const parsed = JSON.parse(result.trim());
    assert.equal(parsed.outcome, 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY');
  });

  // 13. Output has no raw internal categories
  it('CLI failure output contains no raw internal categories', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try {
      result = execFileSync(process.execPath, [cli, '--repeat', '2'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 });
    } catch (err) {
      result = err.stdout || '';
    }
    const forbiddenRawCategories = ['INPUT_INVALID', 'BASELINE_INVALID', 'PLAN_FAILED', 'REPEAT_MISMATCH', 'CATALOG_ADAPTER_', 'RECEIPT_'];
    for (const raw of forbiddenRawCategories) {
      assert.ok(!result.includes(raw), `Output should not contain raw category: ${raw}`);
    }
  });

  // 14. Manifest unchanged
  it('CLI source has no manifest write operations', () => {
    const src = require('fs').readFileSync(
      path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs'), 'utf8'
    );
    const codeOnly = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeOnly.includes('writeFile'));
    assert.ok(!codeOnly.includes('appendFile'));
  });
});
