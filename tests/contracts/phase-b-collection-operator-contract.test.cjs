'use strict';

/**
 * Source-static contract tests for Phase B operator collection CLI.
 *
 * No DB connection, no network, no file mutation.
 * Tests: CLI boundary, argv acceptance/rejection, receipt builder,
 *        digest generation, sensitive scanning, prohibited fields.
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SHA256_RE = /^sha256:[a-f0-9]{64}$/;

function stableStringify(value) {
  const compareCodePoint = (a, b) => {
    const l = String(a), r = String(b);
    return l < r ? -1 : l > r ? 1 : 0;
  };
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') return JSON.stringify(value);
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (t === 'object') {
    const keys = Object.keys(value).sort(compareCodePoint);
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return 'null';
}

function objDigest(obj) {
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(stableStringify(obj), 'utf8')).digest('hex')}`;
}

// ─── Synthetic test data ─────────────────────────────────────────────────────

const TEST_BASELINE = '1cce8713ef1c1f7adac7edd7d1e09e2f04490649';
const TEST_APPROVAL = 'issue:3574';

const SYNTHETIC_CATALOG_EVIDENCE = {
  format_version: '1.0',
  normalizer_version: '1.0',
  objects: [
    {
      name: 'table:public.trees',
      fingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    {
      name: 'table:public.memories',
      fingerprint: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
  ],
};

const SYNTHETIC_CANONICAL_MANIFEST = {
  format_version: '1.0',
  status: 'ADOPTION_REQUIRED',
  migrations: [],
};

const SYNTHETIC_EXPECTED_SCHEMA_MANIFEST = {
  format_version: '1.0',
  status: 'ADOPTION_REQUIRED',
  fingerprint_algorithm: 'sha256',
  normalizer_version: '1.0',
  metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
  critical_objects: [],
  adoption_rule: 'ALL_OBJECTS_MUST_MATCH',
  comparison_scope: ['name', 'fingerprint'],
};

const SYNTHETIC_COLLECTION_PLAN = {
  format_version: '1.0',
  plan_status: 'PREPARED_ONLY',
  reviewed_object_allowlist: [
    { name: 'table:public.trees', kind: 'TABLE' },
    { name: 'table:public.memories', kind: 'TABLE' },
  ],
};

const SYNTHETIC_BOUNDARY_CONTRACT = {
  mode: 'PRODUCTION_READONLY_CATALOG',
  dedicated_secret_key: 'LOVEBUD_PRODUCTION_READONLY_DATABASE_URL',
  caller_object_override: false,
  caller_sql: false,
};

const SYNTHETIC_CATALOG_METADATA_CONTRACT = {
  format_version: '1.0',
  normalizer_version: '1.0',
  limits: { max_objects: 64 },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase B operator collection receipt core', () => {
  it('buildCollectionReceipt - builds valid receipt', () => {
    const evidenceDigest = objDigest(SYNTHETIC_CATALOG_EVIDENCE);

    // Build expected-schema candidate manually (simulating the core)
    const candidate = {
      format_version: '1.0',
      status: 'ADOPTION_REQUIRED',
      fingerprint_algorithm: 'sha256',
      normalizer_version: '1.0',
      metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
      critical_objects: [
        { name: 'table:public.memories', fingerprint: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        { name: 'table:public.trees', fingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      ],
      adoption_rule: 'ALL_OBJECTS_MUST_MATCH',
      comparison_scope: ['name', 'fingerprint'],
    };

    const attestationDraft = attestationCore.buildPreparedUnattestedAttestationDraft({
      baselineCommit: TEST_BASELINE,
      migrationManifest: SYNTHETIC_CANONICAL_MANIFEST,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
      environmentClass: 'PRODUCTION',
      approvalReference: TEST_APPROVAL,
      attestationScope: 'PRODUCTION_READONLY',
    });

    const candidateDigest = receiptCore.computeDigest(
      Buffer.from(JSON.stringify(candidate, null, 2) + '\n', 'utf8')
    );
    const attestationDigest = receiptCore.computeObjectDigest(attestationDraft);

    const receipt = receiptCore.buildCollectionReceipt({
      baselineMainSha: TEST_BASELINE,
      approvalReference: TEST_APPROVAL,
      collectionSessionCount: 1,
      collectionPlanDigest: objDigest(SYNTHETIC_COLLECTION_PLAN),
      objectAllowlistDigest: objDigest(SYNTHETIC_COLLECTION_PLAN.reviewed_object_allowlist),
      boundaryContractDigest: objDigest(SYNTHETIC_BOUNDARY_CONTRACT),
      catalogMetadataContractDigest: objDigest(SYNTHETIC_CATALOG_METADATA_CONTRACT),
      canonicalManifestDigest: objDigest(SYNTHETIC_CANONICAL_MANIFEST),
      expectedSchemaManifestDigest: objDigest(SYNTHETIC_EXPECTED_SCHEMA_MANIFEST),
      catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
      catalogEvidenceDigest: evidenceDigest,
      inactiveExpectedSchemaCandidate: candidate,
      inactiveCandidateDigest: candidateDigest,
      preparedAttestationDraft: attestationDraft,
      preparedAttestationDigest: attestationDigest,
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
    assert.ok(Array.isArray(receipt.read_only_proofs));
    assert.equal(receipt.read_only_proofs.length, 10);
    assert.ok(SHA256_RE.test(receipt.collection_plan_digest));
    assert.ok(SHA256_RE.test(receipt.catalog_evidence_digest));
    assert.ok(SHA256_RE.test(receipt.inactive_candidate_digest));
    assert.ok(SHA256_RE.test(receipt.prepared_attestation_digest));
    assert.equal(receipt.inactive_expected_schema_candidate.status, 'ADOPTION_REQUIRED');
    assert.equal(receipt.prepared_attestation_draft.adoption_status, 'UNATTESTED');
  });

  it('buildCollectionReceipt - no prohibited fields', () => {
    const evidenceDigest = receiptCore.computeDigest(
      Buffer.from(JSON.stringify(SYNTHETIC_CATALOG_EVIDENCE), 'utf8')
    );
    const candidate = {
      format_version: '1.0', status: 'ADOPTION_REQUIRED',
      fingerprint_algorithm: 'sha256', normalizer_version: '1.0',
      metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
      critical_objects: [],
      adoption_rule: 'ALL_OBJECTS_MUST_MATCH',
      comparison_scope: ['name', 'fingerprint'],
    };
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      baselineCommit: TEST_BASELINE,
      migrationManifest: SYNTHETIC_CANONICAL_MANIFEST,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
      approvalReference: TEST_APPROVAL,
    });

    const receipt = receiptCore.buildCollectionReceipt({
      baselineMainSha: TEST_BASELINE,
      approvalReference: TEST_APPROVAL,
      collectionSessionCount: 1,
      collectionPlanDigest: objDigest(SYNTHETIC_COLLECTION_PLAN),
      objectAllowlistDigest: objDigest([]),
      boundaryContractDigest: objDigest(SYNTHETIC_BOUNDARY_CONTRACT),
      catalogMetadataContractDigest: objDigest(SYNTHETIC_CATALOG_METADATA_CONTRACT),
      canonicalManifestDigest: objDigest(SYNTHETIC_CANONICAL_MANIFEST),
      expectedSchemaManifestDigest: objDigest(SYNTHETIC_EXPECTED_SCHEMA_MANIFEST),
      catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
      catalogEvidenceDigest: evidenceDigest,
      inactiveExpectedSchemaCandidate: candidate,
      inactiveCandidateDigest: evidenceDigest,
      preparedAttestationDraft: draft,
      preparedAttestationDigest: evidenceDigest,
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

  it('buildCollectionReceipt - rejects invalid inputs', () => {
    const evidenceDigest = objDigest(SYNTHETIC_CATALOG_EVIDENCE);
    const candidate = {
      format_version: '1.0', status: 'ADOPTION_REQUIRED',
      fingerprint_algorithm: 'sha256', normalizer_version: '1.0',
      metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
      critical_objects: [],
      adoption_rule: 'ALL_OBJECTS_MUST_MATCH',
      comparison_scope: ['name', 'fingerprint'],
    };
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      baselineCommit: TEST_BASELINE,
      migrationManifest: SYNTHETIC_CANONICAL_MANIFEST,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
      approvalReference: TEST_APPROVAL,
    });

    const baseOpts = () => ({
      baselineMainSha: TEST_BASELINE,
      approvalReference: TEST_APPROVAL,
      collectionSessionCount: 1,
      collectionPlanDigest: evidenceDigest,
      objectAllowlistDigest: evidenceDigest,
      boundaryContractDigest: evidenceDigest,
      catalogMetadataContractDigest: evidenceDigest,
      canonicalManifestDigest: evidenceDigest,
      expectedSchemaManifestDigest: evidenceDigest,
      catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
      catalogEvidenceDigest: evidenceDigest,
      inactiveExpectedSchemaCandidate: candidate,
      inactiveCandidateDigest: evidenceDigest,
      preparedAttestationDraft: draft,
      preparedAttestationDigest: evidenceDigest,
    });

    // Invalid SHA
    assert.throws(() => receiptCore.buildCollectionReceipt({
      ...baseOpts(), baselineMainSha: 'bad'
    }), /RECEIPT_INPUT_INVALID/);

    // Invalid approval reference
    assert.throws(() => receiptCore.buildCollectionReceipt({
      ...baseOpts(), approvalReference: 'bad-ref'
    }), /RECEIPT_INPUT_INVALID/);

    // Invalid session count
    assert.throws(() => receiptCore.buildCollectionReceipt({
      ...baseOpts(), collectionSessionCount: 3
    }), /RECEIPT_INPUT_INVALID/);
  });

  it('serializeCollectionReceipt - deterministic JSON output', () => {
    const evidenceDigest = objDigest(SYNTHETIC_CATALOG_EVIDENCE);
    const candidate = {
      format_version: '1.0', status: 'ADOPTION_REQUIRED',
      fingerprint_algorithm: 'sha256', normalizer_version: '1.0',
      metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
      critical_objects: [],
      adoption_rule: 'ALL_OBJECTS_MUST_MATCH',
      comparison_scope: ['name', 'fingerprint'],
    };
    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      baselineCommit: TEST_BASELINE,
      migrationManifest: SYNTHETIC_CANONICAL_MANIFEST,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
      approvalReference: TEST_APPROVAL,
    });

    const receipt = receiptCore.buildCollectionReceipt({
      ...Object.fromEntries(Object.entries({
        baselineMainSha: TEST_BASELINE,
        approvalReference: TEST_APPROVAL,
        collectionSessionCount: 1,
        collectionPlanDigest: evidenceDigest,
        objectAllowlistDigest: evidenceDigest,
        boundaryContractDigest: evidenceDigest,
        catalogMetadataContractDigest: evidenceDigest,
        canonicalManifestDigest: evidenceDigest,
        expectedSchemaManifestDigest: evidenceDigest,
        catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
        catalogEvidenceDigest: evidenceDigest,
        inactiveExpectedSchemaCandidate: candidate,
        inactiveCandidateDigest: evidenceDigest,
        preparedAttestationDraft: draft,
        preparedAttestationDigest: evidenceDigest,
      })),
    });

    const json1 = receiptCore.serializeCollectionReceipt(receipt);
    const json2 = receiptCore.serializeCollectionReceipt(receipt);
    assert.equal(json1, json2);
    assert.ok(json1.trim().endsWith('}'));
  });

  it('buildPreparedUnattestedAttestationDraft - UNATTESTED status', () => {
    const candidate = {
      format_version: '1.0', status: 'ADOPTION_REQUIRED',
      fingerprint_algorithm: 'sha256', normalizer_version: '1.0',
      metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
      critical_objects: [],
      adoption_rule: 'ALL_OBJECTS_MUST_MATCH',
      comparison_scope: ['name', 'fingerprint'],
    };

    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      baselineCommit: TEST_BASELINE,
      migrationManifest: SYNTHETIC_CANONICAL_MANIFEST,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
      approvalReference: TEST_APPROVAL,
    });

    assert.equal(draft.adoption_status, 'UNATTESTED');
    assert.equal(draft.environment_class, 'PRODUCTION');
    assert.equal(draft.attestation_scope, 'PRODUCTION_READONLY');
    assert.equal(draft.variance_classification, 'UNKNOWN_DRIFT');
    assert.ok(SHA256_RE.test(draft.canonical_manifest_digest));
    assert.ok(SHA256_RE.test(draft.expected_schema_digest));
    assert.ok(SHA256_RE.test(draft.catalog_evidence_digest));
    assert.equal(draft.format_version, '1.0');
    assert.equal(draft.digest_algorithm, 'sha256');
  });

  it('buildPreparedUnattestedAttestationDraft - never ATTESTED', () => {
    const candidate = {
      format_version: '1.0', status: 'ADOPTION_REQUIRED',
      fingerprint_algorithm: 'sha256', normalizer_version: '1.0',
      metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
      critical_objects: [],
      adoption_rule: 'ALL_OBJECTS_MUST_MATCH',
      comparison_scope: ['name', 'fingerprint'],
    };

    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      baselineCommit: TEST_BASELINE,
      migrationManifest: SYNTHETIC_CANONICAL_MANIFEST,
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
      approvalReference: TEST_APPROVAL,
    });

    assert.notEqual(draft.adoption_status, 'ATTESTED');
  });

  it('buildPreparedUnattestedAttestationDraft - empty migrations for ADOPTION_REQUIRED', () => {
    const candidate = {
      format_version: '1.0', status: 'ADOPTION_REQUIRED',
      fingerprint_algorithm: 'sha256', normalizer_version: '1.0',
      metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
      critical_objects: [],
      adoption_rule: 'ALL_OBJECTS_MUST_MATCH',
      comparison_scope: ['name', 'fingerprint'],
    };

    const draft = attestationCore.buildPreparedUnattestedAttestationDraft({
      baselineCommit: TEST_BASELINE,
      migrationManifest: { status: 'ADOPTION_REQUIRED', migrations: [] },
      expectedSchemaCandidate: candidate,
      catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
      approvalReference: TEST_APPROVAL,
    });

    assert.deepEqual(draft.applied_migrations, []);
  });

  it('buildPreparedUnattestedAttestationDraft - rejects bad baseline commit', () => {
    assert.throws(() => {
      attestationCore.buildPreparedUnattestedAttestationDraft({
        baselineCommit: 'bad',
        migrationManifest: SYNTHETIC_CANONICAL_MANIFEST,
        expectedSchemaCandidate: { format_version: '1.0', status: 'ADOPTION_REQUIRED' },
        catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
        approvalReference: TEST_APPROVAL,
      });
    }, /COMMIT_INVALID/);
  });

  it('buildPreparedUnattestedAttestationDraft - rejects bad approval reference', () => {
    assert.throws(() => {
      attestationCore.buildPreparedUnattestedAttestationDraft({
        baselineCommit: TEST_BASELINE,
        migrationManifest: SYNTHETIC_CANONICAL_MANIFEST,
        expectedSchemaCandidate: { format_version: '1.0', status: 'ADOPTION_REQUIRED' },
        catalogEvidence: SYNTHETIC_CATALOG_EVIDENCE,
        approvalReference: 'bad',
      });
    }, /APPROVAL_INVALID/);
  });

  it('sensitive marker scan - detects prohibited patterns', () => {
    // Should not throw for clean data
    const clean = { name: 'table:public.trees', fingerprint: 'sha256:abc123' };
    receiptCore.scanSensitive(clean);

    // Should throw for connection string markers
    const dirty = { name: 'postgres://user:pass@host/db' };
    assert.throws(() => receiptCore.scanSensitive(dirty), /RECEIPT_SENSITIVE_VALUE/);
  });

  it('prohibited field check - detects blocked fields', () => {
    const clean = { name: 'test' };
    receiptCore.checkProhibitedFields(clean);

    const dirty = { name: 'test', password: 'secret' };
    assert.throws(() => receiptCore.checkProhibitedFields(dirty), /RECEIPT_PROHIBITED_FIELD/);
  });

  it('deterministic serialization - byte-for-byte stable', () => {
    const first = receiptCore.serializeCollectionReceipt({ format_version: '1.0', test: true });
    const second = receiptCore.serializeCollectionReceipt({ format_version: '1.0', test: true });
    assert.equal(first, second);
  });

  it('stableStringify - deterministic', () => {
    const obj = { b: 2, a: 1, c: { z: 26, y: 25 } };
    const str = receiptCore.stableStringify(obj);
    assert.equal(str, '{"a":1,"b":2,"c":{"y":25,"z":26}}');
  });

  it('computeDigest produces sha256:', () => {
    const d = receiptCore.computeDigest(Buffer.from('test', 'utf8'));
    assert.ok(SHA256_RE.test(d));
  });

  it('computeObjectDigest produces sha256:', () => {
    const d = receiptCore.computeObjectDigest({ a: 1 });
    assert.ok(SHA256_RE.test(d));
  });
});
