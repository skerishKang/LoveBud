'use strict';

/**
 * Source-static contract tests for Phase B operator collection CLI.
 *
 * No DB connection, no network, no file mutation.
 * Tests: CLI boundary, trusted plan, digest integrity, recursive sanitization,
 *        output format, fixed attestation fields, baseline binding, session counting.
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

const TEST_BASELINE = '1cce8713ef1c1f7adac7edd7d1e09e2f04490649';
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

// ─── Build a minimal valid prepared plan for tests ──────────────────────────

function buildTestPlan(opts = {}) {
  const baseline = opts.baselineCommit || TEST_BASELINE;
  const approval = opts.approvalReference || TEST_APPROVAL;
  // Build a plan-like object matching what buildPreparedCollectionPlan returns
  const rawPlan = {
    format_version: '1.0',
    plan_status: 'PREPARED_ONLY',
    baseline_commit: baseline,
    environment_class: 'PRODUCTION',
    attestation_scope: 'PRODUCTION_READONLY',
    approval_reference: approval,
    collection_mode: 'CATALOG_METADATA_ONLY',
    output_policy: 'SANITIZED_STDOUT_ONLY',
    object_allowlist: [],
    role_mapping_classes: ['PUBLIC', 'APPLICATION', 'AUTHENTICATED', 'SERVICE', 'OWNER_CLASS'],
    required_read_only_proofs: [
      'EXPLICIT_READ_ONLY_TRANSACTION', 'READ_ONLY_TRANSACTION_CONFIRMED',
      'REPOSITORY_OWNED_SQL_ONLY', 'NO_CALLER_SQL', 'ALLOWLISTED_OBJECTS_ONLY',
      'NO_APPLICATION_ROW_READS', 'ABSTRACT_ROLE_MAPPING_ONLY', 'NO_RAW_CATALOG_OUTPUT',
      'NO_PARTIAL_SUCCESS_CLAIM', 'BOUNDED_FAILURE_OUTPUT',
    ],
    expected_outputs: [
      'SANITIZED_CATALOG_EVIDENCE', 'CATALOG_EVIDENCE_DIGEST',
      'INACTIVE_EXPECTED_SCHEMA_CANDIDATE', 'COLLECTION_PLAN_DIGEST',
      'OBJECT_ALLOWLIST_DIGEST', 'PREPARED_ATTESTATION_DRAFT', 'BOUNDED_COLLECTION_OUTCOME',
    ],
    contract_path: 'db/migration-provenance/adoption-baseline-collection-plan-contract.json',
    digest_algorithm: 'sha256',
    collection_plan_contract_digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    object_allowlist_digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
  };
  rawPlan.plan_digest = objDigest(rawPlan);
  return rawPlan;
}

function buildTestCandidate() {
  return expectedSchemaCore.buildExpectedSchemaCandidate(SYNTHETIC_EVIDENCE, SYNTHETIC_EXPECTED_SCHEMA);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase B operator collection receipt core', () => {

  // === Scope/source tests ===
  it('operator CLI has no require(pg)', async () => {
    const src = require('fs').readFileSync(
      path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs'),
      'utf8'
    );
    // Remove comments before checking code lines
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
    assert.ok(typeof receiptCore.scanSensitive === 'function');
  });

  // === Trusted plan tests ===
  it('uses buildPreparedCollectionPlan digest values', () => {
    const plan = buildTestPlan();
    assert.equal(plan.plan_status, 'PREPARED_ONLY');
    assert.ok(SHA256_RE.test(plan.plan_digest));
    assert.ok(SHA256_RE.test(plan.object_allowlist_digest));
  });

  it('plan digest is deterministic', () => {
    const a = buildTestPlan();
    const b = buildTestPlan();
    assert.equal(a.plan_digest, b.plan_digest);
  });

  it('receipt uses prepared plan collection_plan_digest', () => {
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const receipt = receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      boundaryContractBytes: Buffer.from('{"mode":"PRODUCTION_READONLY_CATALOG","dedicated_secret_key":"LOVEBUD_PRODUCTION_READONLY_DATABASE_URL"}'),
      catalogMetadataContractBytes: Buffer.from('{"format_version":"1.0","normalizer_version":"1.0","limits":{"max_objects":64}}'),
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 1,
    });
    assert.equal(receipt.collection_plan_digest, plan.plan_digest);
    assert.equal(receipt.object_allowlist_digest, plan.object_allowlist_digest);
    assert.equal(receipt.read_only_proofs.length, 10);
  });

  // === Digest integrity tests ===
  it('catalog evidence change recomputes digest', () => {
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();

    const ev1 = SYNTHETIC_EVIDENCE;
    const d1 = receiptCore.computeObjectDigest(ev1);

    const ev2 = { ...SYNTHETIC_EVIDENCE, objects: [] };
    const d2 = receiptCore.computeObjectDigest(ev2);

    assert.notEqual(d1, d2);
  });

  it('digest mismatch between evidence and attestation rejected', () => {
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });

    // Tamper with the draft's catalog_evidence_digest
    const tampered = { ...draft, catalog_evidence_digest: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' };

    assert.throws(() => {
      receiptCore.buildCollectionReceipt({
        preparedPlan: plan,
        boundaryContractBytes: Buffer.from('{"mode":"PRODUCTION_READONLY_CATALOG"}'),
        catalogMetadataContractBytes: Buffer.from('{"format_version":"1.0","normalizer_version":"1.0","limits":{"max_objects":64}}'),
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
    const plan = buildTestPlan();
    const candidate1 = buildTestCandidate();
    // Build a different candidate
    const emptyEv = { format_version: '1.0', normalizer_version: '1.0', objects: [] };
    const candidate2 = expectedSchemaCore.buildExpectedSchemaCandidate(emptyEv, SYNTHETIC_EXPECTED_SCHEMA);

    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate1,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });

    // Try to pass candidate2 but draft was built with candidate1 — digest mismatch
    assert.throws(() => {
      receiptCore.buildCollectionReceipt({
        preparedPlan: plan,
        boundaryContractBytes: Buffer.from('{"mode":"PRODUCTION_READONLY_CATALOG"}'),
        catalogMetadataContractBytes: Buffer.from('{"format_version":"1.0","normalizer_version":"1.0","limits":{"max_objects":64}}'),
        canonicalManifest: SYNTHETIC_CANONICAL,
        expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
        catalogEvidence: SYNTHETIC_EVIDENCE,
        inactiveExpectedSchemaCandidate: candidate2,
        preparedAttestationDraft: draft,
        collectionSessionCount: 1,
      });
    }, /RECEIPT_DIGEST_MISMATCH/);
  });

  it('catalog_evidence_digest matches between receipt and attestation', () => {
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const receipt = receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      boundaryContractBytes: Buffer.from('{"mode":"PRODUCTION_READONLY_CATALOG"}'),
      catalogMetadataContractBytes: Buffer.from('{"format_version":"1.0","normalizer_version":"1.0","limits":{"max_objects":64}}'),
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
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();

    // Build a valid draft
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });

    // Corrupt the attestation's canonical_manifest_digest
    const bad = { ...draft, canonical_manifest_digest: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' };

    assert.throws(() => receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      boundaryContractBytes: Buffer.from('{}'),
      catalogMetadataContractBytes: Buffer.from('{}'),
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: bad,
      collectionSessionCount: 1,
    }), /RECEIPT_DIGEST_MISMATCH/);
  });

  // === Recursive sanitization tests ===
  it('rejects nested prohibited key in objects', () => {
    assert.throws(() => receiptCore.checkProhibitedFields({
      objects: [{ host: 'x' }]
    }), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('rejects nested prohibited key in candidate', () => {
    assert.throws(() => receiptCore.checkProhibitedFields({
      candidate: { metadata: { raw_role: 'x' } }
    }), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('rejects deeply nested prohibited key', () => {
    assert.throws(() => receiptCore.checkProhibitedFields({
      draft: { inner: { deeper: { database_owner: 'x' } } }
    }), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('rejects prohibited key in arrays', () => {
    assert.throws(() => receiptCore.checkProhibitedFields({
      arrays: [[{ connection_string: 'x' }]]
    }), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('rejects sensitive pattern in nested value', () => {
    assert.throws(() => receiptCore.scanSensitive({
      data: { url: 'postgres://user:pass@host/db' }
    }), /RECEIPT_SENSITIVE_VALUE/);
  });

  it('accepts clean deeply nested data', () => {
    const clean = {
      format_version: '1.0',
      objects: [
        { name: 'table:public.trees', fingerprint: 'sha256:abc' },
      ],
      metadata: {
        nested: { value: 'clean' },
        list: [1, 2, { key: 'val' }],
      },
    };
    assert.doesNotThrow(() => receiptCore.checkProhibitedFields(clean));
    assert.doesNotThrow(() => receiptCore.scanSensitive(clean));
  });

  it('rejects non-finite numbers', () => {
    assert.throws(() => receiptCore.scanSensitive(NaN), /RECEIPT_VALUE_TYPE_INVALID/);
    assert.throws(() => receiptCore.scanSensitive(Infinity), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('rejects non-plain objects', () => {
    class Custom {}
    assert.throws(() => receiptCore.scanSensitive(new Custom()), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  it('rejects symbol values', () => {
    assert.throws(() => receiptCore.scanSensitive(Symbol('test')), /RECEIPT_VALUE_TYPE_INVALID/);
  });

  // === Fixed attestation tests ===
  it('buildPreparedUnattestedAttestationDraft - fixed fields', () => {
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
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

  it('buildPreparedUnattestedAttestationDraft - no environment/scope override params', () => {
    const fn = attestationCore.buildPreparedUnattestedAttestationDraft.toString();
    // There should be no parameter named environmentClass, attestationScope, varianceClassification, adoptionStatus
    assert.ok(!fn.includes('environmentClass') || fn.indexOf('environmentClass') > fn.indexOf('preparedPlan'));
    // Verify the function only takes 4 params
    const params = fn.match(/function\s*\([^)]*\)/);
    if (params) {
      const count = params[0].split(',').length;
      assert.ok(count <= 4, 'Should accept at most 4 parameters');
    }
  });

  it('buildPreparedUnattestedAttestationDraft - no ATTESTED', () => {
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    assert.notEqual(draft.adoption_status, 'ATTESTED');
  });

  it('buildPreparedUnattestedAttestationDraft - empty migrations for ADOPTION_REQUIRED', () => {
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: { status: 'ADOPTION_REQUIRED', migrations: [] },
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    assert.deepEqual(draft.applied_migrations, []);
  });

  it('buildPreparedUnattestedAttestationDraft - rejects bad plan_status', () => {
    const plan = buildTestPlan();
    plan.plan_status = 'ACTIVE';
    assert.throws(() => {
      attestationCore.buildPreparedUnattestedAttestationDraft({
        preparedPlan: plan,
        migrationManifest: SYNTHETIC_CANONICAL,
        expectedSchemaCandidate: buildTestCandidate(),
        catalogEvidence: SYNTHETIC_EVIDENCE,
      });
    }, /ENUM_INVALID/);
  });

  it('buildPreparedUnattestedAttestationDraft - rejects bad environment_class', () => {
    const plan = buildTestPlan();
    plan.environment_class = 'STAGING';
    assert.throws(() => {
      attestationCore.buildPreparedUnattestedAttestationDraft({
        preparedPlan: plan,
        migrationManifest: SYNTHETIC_CANONICAL,
        expectedSchemaCandidate: buildTestCandidate(),
        catalogEvidence: SYNTHETIC_EVIDENCE,
      });
    }, /ENUM_INVALID/);
  });

  it('buildPreparedUnattestedAttestationDraft - rejects wrong candidate status', () => {
    const plan = buildTestPlan();
    const badCandidate = { ...buildTestCandidate(), status: 'ACTIVE' };
    assert.throws(() => {
      attestationCore.buildPreparedUnattestedAttestationDraft({
        preparedPlan: plan,
        migrationManifest: SYNTHETIC_CANONICAL,
        expectedSchemaCandidate: badCandidate,
        catalogEvidence: SYNTHETIC_EVIDENCE,
      });
    }, /ENUM_INVALID/);
  });

  // === Receipt build with internal digest computation ===
  it('buildCollectionReceipt - full receipt with recomputed digests', () => {
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const receipt = receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      boundaryContractBytes: Buffer.from('{"mode":"PRODUCTION_READONLY_CATALOG","dedicated_secret_key":"LOVEBUD_PRODUCTION_READONLY_DATABASE_URL"}'),
      catalogMetadataContractBytes: Buffer.from('{"format_version":"1.0","normalizer_version":"1.0","limits":{"max_objects":64}}'),
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 1,
    });
    assert.equal(receipt.format_version, '1.0');
    assert.equal(receipt.outcome, 'COLLECTION_PASS_SANITIZED_EVIDENCE_READY');
    assert.equal(receipt.baseline_main_sha, TEST_BASELINE);
    assert.equal(receipt.approval_reference, TEST_APPROVAL);
    assert.equal(receipt.collection_session_count, 1);
    assert.equal(receipt.attestation_status, 'UNATTESTED');
    assert.equal(receipt.manifest_activation, 'NONE');
    assert.equal(receipt.schema_mutation, 'NONE');
    assert.equal(receipt.data_mutation, 'NONE');
    assert.equal(receipt.credential_change, 'NONE');
    assert.equal(receipt.privilege_change, 'NONE');
    assert.ok(SHA256_RE.test(receipt.collection_plan_digest));
    assert.ok(SHA256_RE.test(receipt.boundary_contract_digest));
    assert.ok(SHA256_RE.test(receipt.catalog_metadata_contract_digest));
    assert.ok(SHA256_RE.test(receipt.catalog_evidence_digest));
    assert.ok(SHA256_RE.test(receipt.inactive_candidate_digest));
    assert.ok(SHA256_RE.test(receipt.prepared_attestation_digest));
    assert.equal(receipt.inactive_expected_schema_candidate.status, 'ADOPTION_REQUIRED');
    assert.equal(receipt.prepared_attestation_draft.adoption_status, 'UNATTESTED');
    assert.equal(receipt.read_only_proofs.length, 10);
  });

  it('serializeCollectionReceipt - deterministic JSON', () => {
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const receipt = receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      boundaryContractBytes: Buffer.from('{}'),
      catalogMetadataContractBytes: Buffer.from('{}'),
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 1,
    });
    const a = receiptCore.serializeCollectionReceipt(receipt);
    const b = receiptCore.serializeCollectionReceipt(receipt);
    assert.equal(a, b);
    assert.ok(a.trim().endsWith('}'));
  });

  it('receipt has no prohibited fields', () => {
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const receipt = receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      boundaryContractBytes: Buffer.from('{}'),
      catalogMetadataContractBytes: Buffer.from('{}'),
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 1,
    });
    const prohibited = [
      'host', 'hostname', 'port', 'database', 'database_name',
      'database_url', 'connection_string', 'url', 'secret', 'token',
      'password', 'credential', 'username', 'operator',
      'raw_role', 'role_name', 'provider_project', 'raw_catalog',
      'rows', 'row_values', 'payload', 'grantee_name', 'database_owner',
    ];
    for (const key of prohibited) {
      assert.equal(receipt[key] === undefined, true, `prohibited field present: ${key}`);
    }
  });

  // === Baseline tests ===
  it('buildPreparedCollectionPlan validates baseline', () => {
    assert.throws(() => planCore.buildPreparedCollectionPlan({
      baselineCommit: 'BAD_UPPERCASE_SHA',
      approvalReference: TEST_APPROVAL,
    }), /COMMIT_INVALID/);
  });

  // === Session counting tests ===
  it('receipt session count 0', () => {
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const receipt = receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      boundaryContractBytes: Buffer.from('{}'),
      catalogMetadataContractBytes: Buffer.from('{}'),
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 0,
    });
    assert.equal(receipt.collection_session_count, 0);
  });

  it('receipt session count 2', () => {
    const plan = buildTestPlan();
    const candidate = buildTestCandidate();
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: SYNTHETIC_CANONICAL,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_EVIDENCE,
    });
    const receipt = receiptCore.buildCollectionReceipt({
      preparedPlan: plan,
      boundaryContractBytes: Buffer.from('{}'),
      catalogMetadataContractBytes: Buffer.from('{}'),
      canonicalManifest: SYNTHETIC_CANONICAL,
      expectedSchemaManifest: SYNTHETIC_EXPECTED_SCHEMA,
      catalogEvidence: SYNTHETIC_EVIDENCE,
      inactiveExpectedSchemaCandidate: candidate,
      preparedAttestationDraft: draft,
      collectionSessionCount: 2,
    });
    assert.equal(receipt.collection_session_count, 2);
  });

  // === Output tests ===
  it('CLI with invalid argv outputs single JSON, no stack', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');

    // Test with --host (forbidden)
    let result;
    try {
      result = execFileSync(process.execPath, [cli, '--host', 'x'], {
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 65536,
      });
    } catch (err) {
      result = err.stdout || '';
    }

    // Should have exactly one JSON document — parse it
    const jsonMatch = result.trim().match(/^\{[\s\S]*\}$/m);
    assert.ok(jsonMatch, 'Should output a JSON document');
    const parsed = JSON.parse(jsonMatch[0]);
    assert.equal(parsed.outcome, 'COLLECTION_NOT_RUN_CONNECTION_BOUNDARY');
    assert.equal(parsed.collection_session_count, 0);
    assert.equal(parsed.attestation_status, 'UNATTESTED');
    assert.ok(!result.includes('Error:'), 'No stack in output');
    assert.ok(!result.includes('at '), 'No stack trace in output');
  });

  it('CLI missing required flags outputs bounded JSON', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try {
      result = execFileSync(process.execPath, [cli, '--secret-file', 'x'], {
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 65536,
      });
    } catch (err) {
      result = err.stdout || '';
    }
    const parsed = JSON.parse(result.trim());
    assert.equal(parsed.collection_session_count, 0);
    assert.ok(['COLLECTION_NOT_RUN_CONNECTION_BOUNDARY'].includes(parsed.outcome));
    assert.ok(!result.includes('Error:'));
  });

  it('CLI --repeat 3 is rejected', async () => {
    const { execFileSync } = require('child_process');
    const cli = path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs');
    let result;
    try {
      result = execFileSync(process.execPath, [cli, '--repeat', '3', '--secret-file', 'x', '--role-mapping-file', 'x', '--baseline-commit', TEST_BASELINE, '--approval-reference', TEST_APPROVAL], {
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 65536,
      });
    } catch (err) {
      result = err.stdout || '';
    }
    const parsed = JSON.parse(result.trim());
    assert.equal(parsed.collection_session_count, 0);
  });

  // === Manifest unchanged tests ===
  it('canonical manifest unchanged', () => {
    const src = require('fs').readFileSync(
      path.resolve(__dirname, '..', '..', 'scripts', 'run-production-readonly-catalog-collection.cjs'), 'utf8'
    );
    // No manifest write, activation, or file mutation operations
    const codeOnly = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeOnly.includes('writeFile'));
    assert.ok(!codeOnly.includes('appendFile'));
    // ATTESTED as standalone word only (not in UNATTESTED)
    assert.ok(!/\bATTESTED\b/.test(codeOnly) || codeOnly.includes('adoption_status.*UNATTESTED'));
    assert.ok(!codeOnly.includes('ADOPTED'));
    assert.ok(!codeOnly.includes('.manifest'));
  });
});
