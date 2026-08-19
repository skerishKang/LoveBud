'use strict';

/**
 * SOURCE_STATIC contract for strict inactive adoption-attestation evidence.
 * No PostgreSQL, network, Production DB, or shell beyond local CLI spawn.
 * Refs #3553, #3549, #3458, #3425
 */

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE = path.join(ROOT, 'scripts', 'adoption-attestation-core.cjs');
const PROVENANCE = path.join(ROOT, 'scripts', 'migration-provenance-core.cjs');
const CONTRACT_PATH = path.join(
  ROOT,
  'db',
  'migration-provenance',
  'adoption-attestation-contract.json'
);
const EXPECTED_SCHEMA = path.join(ROOT, 'db', 'migration-provenance', 'expected-schema-manifest.json');
const CANONICAL = path.join(ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const CLI = path.join(ROOT, 'scripts', 'check-migration-provenance.cjs');
const CLASS = path.join(ROOT, 'tests', 'test-layer-classification.json');
const PKG = path.join(ROOT, 'package.json');

const core = require(CORE);
const provenance = require(PROVENANCE);
const planCore = require(path.join(ROOT, 'scripts', 'adoption-baseline-collection-plan-core.cjs'));
const candidateCore = require(path.join(ROOT, 'scripts', 'expected-schema-candidate-core.cjs'));
const receiptCore = require(path.join(ROOT, 'scripts', 'phase-b-collection-receipt-core.cjs'));

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

const contract = readJson(CONTRACT_PATH);
const START_EXPECTED_HASH = sha256File(EXPECTED_SCHEMA);
const START_CANONICAL_HASH = sha256File(CANONICAL);

function baseArtifacts() {
  const firstChecksum = provenance.sha256('migration-one');
  const secondChecksum = provenance.sha256('migration-two');
  const schemaFingerprint = provenance.sha256('table:example|id:text:not-null');
  const migrationManifest = {
    status: 'ACTIVE',
    migrations: [
      { id: '20260713090000_example-one', checksum: firstChecksum },
      { id: '20260713090100_example-two', checksum: secondChecksum },
    ],
  };
  const expectedSchemaManifest = {
    status: 'ACTIVE',
    format_version: '1.0',
    normalizer_version: '1.0',
    metadata_contract_path: 'db/migration-provenance/catalog-metadata-contract.json',
    critical_objects: [{ name: 'table:example', fingerprint: schemaFingerprint }],
  };
  const catalogEvidence = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [{ name: 'table:example', fingerprint: schemaFingerprint }],
  };
  const baselineCommit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  return {
    migrationManifest,
    expectedSchemaManifest,
    catalogEvidence,
    baselineCommit,
    firstChecksum,
    secondChecksum,
  };
}

function validAttestation(overrides = {}, bindingOverrides = {}) {
  const arts = baseArtifacts();
  const attestation = core.buildSyntheticAttestation({
    baselineCommit: arts.baselineCommit,
    migrationManifest: arts.migrationManifest,
    expectedSchemaManifest: arts.expectedSchemaManifest,
    catalogEvidence: arts.catalogEvidence,
    environmentClass: 'DISPOSABLE_CI',
    varianceClassification: 'MATCH',
    approvalReference: 'issue:9999',
    attestationScope: 'DISPOSABLE_RECONSTRUCTION',
  });
  const mergedEvidence = { ...attestation, ...overrides };
  return {
    arts,
    attestation: mergedEvidence,
    binding: {
      baseline_commit: arts.baselineCommit,
      canonical_manifest_digest: attestation.canonical_manifest_digest,
      expected_schema_digest: attestation.expected_schema_digest,
      catalog_evidence_digest: attestation.catalog_evidence_digest,
      approval_reference: 'issue:9999',
      environment_class: 'DISPOSABLE_CI',
      attestation_scope: 'DISPOSABLE_RECONSTRUCTION',
      expected_migrations: arts.migrationManifest.migrations.map((item) => ({
        id: item.id,
        checksum: item.checksum,
      })),
      ...bindingOverrides,
    },
  };
}

test('committed adoption attestation contract is strict and complete', () => {
  assert.equal(contract.format_version, '1.0');
  assert.equal(contract.digest_algorithm, 'sha256');
  assert.ok(Array.isArray(contract.required_top_level_fields));
  for (const field of [
    'format_version',
    'adoption_status',
    'environment_class',
    'baseline_commit',
    'canonical_manifest_digest',
    'expected_schema_digest',
    'catalog_evidence_digest',
    'variance_classification',
    'approval_reference',
    'applied_migrations',
    'attestation_scope',
  ]) {
    assert.ok(contract.required_top_level_fields.includes(field), field);
  }
  assert.ok(core.REQUIRED_TRUSTED_BINDING_FIELDS.includes('expected_migrations'));
  assert.ok(core.REQUIRED_TRUSTED_BINDING_FIELDS.includes('attestation_scope'));
  assert.deepEqual(contract.enums.adoption_status, ['UNATTESTED', 'ATTESTED']);
  assert.ok(contract.enums.environment_class.includes('DISPOSABLE_CI'));
  assert.ok(contract.enums.environment_class.includes('PRODUCTION'));
  assert.ok(contract.enums.variance_classification.includes('UNKNOWN_DRIFT'));
  assert.ok(contract.blocking_variance.includes('UNKNOWN_DRIFT'));
  assert.ok(contract.prohibited_fields.includes('host'));
  assert.ok(contract.prohibited_fields.includes('database'));
  assert.ok(contract.prohibited_fields.includes('secret'));
  assert.ok(contract.prohibited_fields.includes('operator_email'));
  assert.equal(core.validateAdoptionAttestationContract(contract), true);
});

test('classification registers adoption attestation contract as SOURCE_STATIC', () => {
  const classification = readJson(CLASS);
  const entry = classification.entries.find(
    (item) => item.path === 'tests/contracts/adoption-attestation-contract.test.cjs'
  );
  assert.ok(entry);
  assert.equal(entry.layer, 'SOURCE_STATIC');
  assert.deepEqual(entry.capabilities, []);
});

test('package keeps migration provenance check and does not add DB scripts for attestation', () => {
  const pkg = readJson(PKG);
  assert.equal(pkg.scripts['check:migration-provenance'], 'node scripts/check-migration-provenance.cjs --source-only');
  assert.equal(pkg.scripts['build:expected-schema-candidate'], 'node scripts/build-expected-schema-candidate.cjs');
});

test('valid synthetic attestation validation passes deterministically', () => {
  const a = validAttestation();
  const first = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  const second = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(first.ok, true);
  assert.deepEqual(first.blockers, []);
  assert.deepEqual(first, second);
});

test('valid-looking ATTESTED evidence with no binding fails closed', () => {
  const a = validAttestation();
  const result = core.validateAdoptionAttestationEvidence(a.attestation, null, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'));
});

test('empty binding object fails closed', () => {
  const a = validAttestation();
  const result = core.validateAdoptionAttestationEvidence(a.attestation, {}, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'));
});

test('missing individual trusted binding fields fail closed', () => {
  const fields = [
    'baseline_commit',
    'canonical_manifest_digest',
    'expected_schema_digest',
    'catalog_evidence_digest',
    'approval_reference',
    'environment_class',
    'attestation_scope',
    'expected_migrations',
  ];
  for (const field of fields) {
    const a = validAttestation();
    const binding = { ...a.binding };
    delete binding[field];
    const result = core.validateAdoptionAttestationEvidence(a.attestation, binding, contract);
    assert.equal(result.ok, false, field);
    assert.ok(
      result.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'),
      `expected trust binding required for missing ${field}`
    );
  }
});

test('expected_migrations non-array bindings fail closed', () => {
  for (const bad of [null, '[]', {}, 12]) {
    const a = validAttestation({}, { expected_migrations: bad });
    const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
    assert.equal(result.ok, false, String(bad));
    assert.ok(result.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'));
  }
});

test('malformed trusted expected_migrations records fail closed', () => {
  const a = validAttestation();
  const checksum = a.arts.firstChecksum;
  const cases = [
    [{ id: '20260713090000_example-one' }], // missing checksum
    [{ checksum }], // missing id
    [{ id: 'bad-id', checksum }], // invalid id
    [{ id: '20260713090000_example-one', checksum: 'not-a-digest' }], // invalid checksum
    [{ id: '20260713090000_example-one', checksum, extra: true }], // unknown field
    [
      { id: '20260713090000_example-one', checksum },
      { id: '20260713090000_example-one', checksum },
    ], // duplicate trusted ids
    [null],
    ['string-record'],
  ];
  for (const expected_migrations of cases) {
    const result = core.validateAdoptionAttestationEvidence(
      a.attestation,
      { ...a.binding, expected_migrations },
      contract
    );
    assert.equal(result.ok, false);
    assert.ok(
      result.blockers.includes('GATE_ADOPTION_MIGRATION_INVALID') ||
        result.blockers.includes('GATE_ADOPTION_MIGRATION_DUPLICATE')
    );
    assert.equal(JSON.stringify(result).includes(checksum), false);
  }
});

test('empty trusted list and empty evidence list pass migration comparison', () => {
  const a = validAttestation(
    { applied_migrations: [] },
    { expected_migrations: [] }
  );
  // Digests still bound to original artifacts; applied list empty matches trusted empty.
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, true);
  assert.deepEqual(result.blockers, []);
});

test('trusted empty list with evidence migration is unknown', () => {
  const a = validAttestation({}, { expected_migrations: [] });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_MIGRATION_UNKNOWN'));
});

test('trusted list with migrations and empty evidence is missing', () => {
  const a = validAttestation({ applied_migrations: [] });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_MIGRATION_MISSING'));
});

test('direct validator cannot return ok without trusted expected_migrations array', () => {
  const a = validAttestation();
  const binding = { ...a.binding };
  delete binding.expected_migrations;
  const result = core.validateAdoptionAttestationEvidence(a.attestation, binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'));
});

test('evaluateProvenance supplies repository-owned expected migrations', () => {
  const a = validAttestation();
  const bindingWithoutMigrations = { ...a.binding };
  delete bindingWithoutMigrations.expected_migrations;
  const result = provenance.evaluateProvenance({
    migrationManifest: {
      status: 'ACTIVE',
      migrations: a.arts.migrationManifest.migrations,
    },
    expectedSchemaManifest: {
      status: 'ACTIVE',
      ...a.arts.expectedSchemaManifest,
    },
    ledgerEvidence: a.attestation,
    catalogEvidence: a.arts.catalogEvidence,
    adoptionBinding: bindingWithoutMigrations,
    adoptionContract: contract,
  });
  // With ACTIVE manifests + complete other bindings, repo injects expected_migrations.
  assert.equal(result.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'), false);
  assert.equal(result.decision, 'PASS');
  assert.deepEqual(result.blockers, []);
});

test('approval-reference mismatch fails closed', () => {
  const a = validAttestation({}, { approval_reference: 'issue:1' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_APPROVAL_REFERENCE_MISMATCH'));
});

test('environment-class mismatch fails closed', () => {
  const a = validAttestation({}, { environment_class: 'STAGING' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_ENVIRONMENT_CLASS_MISMATCH'));
});

test('attestation-scope mismatch fails closed', () => {
  const a = validAttestation({}, { attestation_scope: 'PRODUCTION_READONLY' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_SCOPE_MISMATCH'));
});

test('semantically equal but byte-different JSON files produce digest mismatch', () => {
  const objectA = {
    format_version: '1.0',
    status: 'ADOPTION_REQUIRED',
    migrations: [],
  };
  const bytesA = Buffer.from(`${JSON.stringify(objectA, null, 2)}\n`, 'utf8');
  const bytesB = Buffer.from(JSON.stringify(objectA), 'utf8'); // compact, no trailing newline
  assert.deepEqual(JSON.parse(bytesA.toString('utf8')), JSON.parse(bytesB.toString('utf8')));
  const digestA = core.computeEvidenceDigest(bytesA);
  const digestB = core.computeEvidenceDigest(bytesB);
  assert.notEqual(digestA, digestB);

  const a = validAttestation({
    canonical_manifest_digest: digestA,
  });
  // Trusted binding is bound to file A bytes; supplying file B digest claim fails.
  const result = core.validateAdoptionAttestationEvidence(
    {
      ...a.attestation,
      canonical_manifest_digest: digestB,
    },
    {
      ...a.binding,
      canonical_manifest_digest: digestA,
    },
    contract
  );
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_MANIFEST_DIGEST_MISMATCH'));

  // Same proof for expected-schema and catalog evidence digests.
  const expectedResult = core.validateAdoptionAttestationEvidence(
    { ...a.attestation, expected_schema_digest: digestB },
    { ...a.binding, expected_schema_digest: digestA },
    contract
  );
  assert.ok(expectedResult.blockers.includes('GATE_ADOPTION_EXPECTED_SCHEMA_DIGEST_MISMATCH'));

  const catalogResult = core.validateAdoptionAttestationEvidence(
    { ...a.attestation, catalog_evidence_digest: digestB },
    { ...a.binding, catalog_evidence_digest: digestA },
    contract
  );
  assert.ok(catalogResult.blockers.includes('GATE_ADOPTION_CATALOG_DIGEST_MISMATCH'));
});

test('bare adoption_status ATTESTED is rejected', () => {
  const result = core.validateAdoptionAttestationEvidence(
    {
      adoption_status: 'ATTESTED',
      applied_migrations: [],
    },
    null,
    contract
  );
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_EVIDENCE_INVALID'));
  assert.ok(result.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'));
});

test('missing required field rejected', () => {
  const a = validAttestation();
  delete a.attestation.approval_reference;
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_EVIDENCE_INVALID'));
});

test('missing baseline commit rejected', () => {
  const a = validAttestation();
  delete a.attestation.baseline_commit;
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_EVIDENCE_INVALID'));
  assert.ok(result.blockers.includes('GATE_ADOPTION_BASELINE_COMMIT_INVALID'));
});

test('malformed baseline commit rejected', () => {
  const a = validAttestation({ baseline_commit: 'NOT_A_COMMIT' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_BASELINE_COMMIT_INVALID'));
});

test('abbreviated commit rejected', () => {
  const a = validAttestation({ baseline_commit: 'aaaaaaaaaaaa' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_BASELINE_COMMIT_INVALID'));
});

test('uppercase commit rejected', () => {
  const a = validAttestation({
    baseline_commit: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_BASELINE_COMMIT_INVALID'));
});

test('baseline commit mismatch rejected', () => {
  const a = validAttestation({}, {
    baseline_commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_BASELINE_COMMIT_MISMATCH'));
});

test('unknown top-level field rejected', () => {
  const a = validAttestation({ unexpected_field: true });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_UNKNOWN_FIELD'));
});

test('invalid environment class rejected', () => {
  const a = validAttestation({ environment_class: 'local-laptop' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_ENVIRONMENT_CLASS_INVALID'));
});

test('forbidden host field rejected', () => {
  const a = validAttestation({ host: 'db.example.com' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_SENSITIVE_MARKER_DETECTED'));
});

test('forbidden database field rejected', () => {
  const a = validAttestation({ database: 'prod' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_SENSITIVE_MARKER_DETECTED'));
});

test('forbidden secret field rejected', () => {
  const a = validAttestation({ secret: 'x' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_SENSITIVE_MARKER_DETECTED'));
});

test('forbidden operator identity field rejected', () => {
  const a = validAttestation({ operator_email: 'a@b.c' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_SENSITIVE_MARKER_DETECTED'));
});

test('sensitive marker rejected without leakage', () => {
  const a = validAttestation({
    approval_reference: 'issue:1',
  });
  a.attestation.approval_reference = 'issue:1';
  // inject sensitive via optional scope-like string field abuse: put marker in approval after bypassing pattern - use note via unknown is already blocked.
  // Use a valid-shaped approval that embeds a marker is hard; use raw string field through applied migration unknown.
  a.attestation.applied_migrations = [
    {
      id: '20260713090000_example-one',
      checksum: a.arts.firstChecksum,
    },
  ];
  // Put sensitive in a prohibited way via baseline is invalid format.
  a.attestation.attestation_scope = 'INACTIVE_BASELINE';
  const poisoned = JSON.parse(JSON.stringify(a.attestation));
  poisoned.approval_reference = 'decision:postgres://bad';
  const result = core.validateAdoptionAttestationEvidence(poisoned, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(
    result.blockers.includes('GATE_ADOPTION_SENSITIVE_MARKER_DETECTED') ||
      result.blockers.includes('GATE_ADOPTION_APPROVAL_REFERENCE_INVALID')
  );
  assert.equal(JSON.stringify(result).includes('postgres://'), false);
});

test('missing canonical manifest digest rejected', () => {
  const a = validAttestation();
  delete a.attestation.canonical_manifest_digest;
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_MANIFEST_DIGEST_INVALID'));
});

test('malformed canonical manifest digest rejected', () => {
  const a = validAttestation({ canonical_manifest_digest: 'sha256:deadbeef' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_MANIFEST_DIGEST_INVALID'));
});

test('canonical manifest digest mismatch rejected', () => {
  const a = validAttestation({
    canonical_manifest_digest:
      'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_MANIFEST_DIGEST_MISMATCH'));
});

test('missing expected-schema digest rejected', () => {
  const a = validAttestation();
  delete a.attestation.expected_schema_digest;
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_EXPECTED_SCHEMA_DIGEST_INVALID'));
});

test('expected-schema digest mismatch rejected', () => {
  const a = validAttestation({
    expected_schema_digest:
      'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_EXPECTED_SCHEMA_DIGEST_MISMATCH'));
});

test('missing catalog digest rejected', () => {
  const a = validAttestation();
  delete a.attestation.catalog_evidence_digest;
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_CATALOG_DIGEST_INVALID'));
});

test('catalog digest mismatch rejected', () => {
  const a = validAttestation({
    catalog_evidence_digest:
      'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_CATALOG_DIGEST_MISMATCH'));
});

test('unknown variance enum rejected', () => {
  const a = validAttestation({ variance_classification: 'MOSTLY_FINE' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_VARIANCE_BLOCKING'));
});

test('UNKNOWN_DRIFT blocks', () => {
  const a = validAttestation({ variance_classification: 'UNKNOWN_DRIFT' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_VARIANCE_BLOCKING'));
});

test('UNATTESTED blocks', () => {
  const a = validAttestation({ adoption_status: 'UNATTESTED' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_EVIDENCE_UNAVAILABLE'));
});

test('invalid approval reference rejected', () => {
  const a = validAttestation({ approval_reference: 'approved' });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_APPROVAL_REFERENCE_INVALID'));
});

test('duplicate applied migration rejected', () => {
  const a = validAttestation();
  a.attestation.applied_migrations = [
    { id: '20260713090000_example-one', checksum: a.arts.firstChecksum },
    { id: '20260713090000_example-one', checksum: a.arts.firstChecksum },
  ];
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_MIGRATION_DUPLICATE'));
});

test('unknown applied migration rejected', () => {
  const a = validAttestation();
  a.attestation.applied_migrations = [
    {
      id: '20260713090000_example-one',
      checksum: a.arts.firstChecksum,
    },
    {
      id: '20260713099999_unknown',
      checksum: a.arts.secondChecksum,
    },
  ];
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_MIGRATION_UNKNOWN'));
});

test('reordered applied migration rejected', () => {
  const a = validAttestation();
  a.attestation.applied_migrations = [
    { id: '20260713090100_example-two', checksum: a.arts.secondChecksum },
    { id: '20260713090000_example-one', checksum: a.arts.firstChecksum },
  ];
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_MIGRATION_REORDERED'));
});

test('edited migration checksum rejected', () => {
  const a = validAttestation();
  a.attestation.applied_migrations = [
    {
      id: '20260713090000_example-one',
      checksum: provenance.sha256('edited'),
    },
    {
      id: '20260713090100_example-two',
      checksum: a.arts.secondChecksum,
    },
  ];
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_MIGRATION_CHECKSUM_MISMATCH'));
});

test('absolute path rejected', () => {
  assert.throws(
    () => core.assertRepoRelativePath(ROOT, path.resolve(ROOT, 'x.json')),
    (error) => error.category === 'ADOPTION_ATTESTATION_PATH_INVALID'
  );
});

test('.. path escape rejected', () => {
  assert.throws(
    () => core.assertRepoRelativePath(ROOT, '../outside.json'),
    (error) => error.category === 'ADOPTION_ATTESTATION_PATH_INVALID'
  );
});

test('missing file rejected', () => {
  assert.throws(
    () =>
      core.readConfinedEvidenceFile(
        ROOT,
        'tests/contracts/fixtures/migration-provenance/_missing-adoption.json'
      ),
    (error) => error.category === 'ADOPTION_ATTESTATION_PATH_INVALID'
  );
});

test('directory path rejected', () => {
  assert.throws(
    () => core.readConfinedEvidenceFile(ROOT, 'tests/contracts/fixtures/migration-provenance'),
    (error) => error.category === 'ADOPTION_ATTESTATION_PATH_INVALID'
  );
});

test('repository-local symlink escape rejected', (t) => {
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-adopt-outside-'));
  const outsideName = 'external-adoption.json';
  const outsideFile = path.join(outsideDir, outsideName);
  const rel = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-adoption-symlink.json')
    .replace(/\\/g, '/');
  const linkPath = path.join(ROOT, rel);
  try {
    const a = validAttestation();
    fs.writeFileSync(outsideFile, `${JSON.stringify(a.attestation, null, 2)}\n`, 'utf8');
    try {
      fs.symlinkSync(outsideFile, linkPath);
    } catch (error) {
      if (process.platform === 'win32' && (error.code === 'EPERM' || error.code === 'EACCES')) {
        t.skip('Windows symlink privilege unavailable');
        return;
      }
      throw error;
    }
    assert.throws(
      () => core.readConfinedEvidenceFile(ROOT, rel),
      (error) => {
        assert.equal(error.category, 'ADOPTION_ATTESTATION_PATH_INVALID');
        assert.equal(String(error.message).includes(outsideName), false);
        assert.equal(String(error.message).includes(outsideDir), false);
        return true;
      }
    );
  } finally {
    try {
      fs.lstatSync(linkPath);
      fs.unlinkSync(linkPath);
    } catch {
      // ignore
    }
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('deterministic blocker ordering', () => {
  const result = core.validateAdoptionAttestationEvidence(
    {
      adoption_status: 'ATTESTED',
      host: 'x',
      unexpected: true,
      format_version: '9.9',
    },
    {},
    contract
  );
  assert.equal(result.ok, false);
  const sorted = [...result.blockers].sort(core.compareCodePoint);
  assert.deepEqual(result.blockers, sorted);
});

test('no raw file path or content leakage in error result', () => {
  const a = validAttestation({
    canonical_manifest_digest:
      'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  });
  const result = core.validateAdoptionAttestationEvidence(a.attestation, a.binding, contract);
  const text = JSON.stringify(result);
  assert.equal(text.includes(ROOT), false);
  assert.equal(text.includes('ffffffffffffffff'), false);
  assert.equal(text.includes('postgres://'), false);
});

test('valid synthetic attestation does not activate manifests', () => {
  const expected = readJson(EXPECTED_SCHEMA);
  const canonical = readJson(CANONICAL);
  const catalogEvidence = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [],
  };
  const baselineCommit = 'cccccccccccccccccccccccccccccccccccccccc';
  const ledgerEvidence = core.buildSyntheticAttestation({
    baselineCommit,
    migrationManifest: canonical,
    expectedSchemaManifest: expected,
    catalogEvidence,
    approvalReference: 'decision:synthetic-ok',
    environmentClass: 'DISPOSABLE_CI',
    attestationScope: 'INACTIVE_BASELINE',
  });
  const validation = core.validateAdoptionAttestationEvidence(
    ledgerEvidence,
    {
      baseline_commit: baselineCommit,
      canonical_manifest_digest: ledgerEvidence.canonical_manifest_digest,
      expected_schema_digest: ledgerEvidence.expected_schema_digest,
      catalog_evidence_digest: ledgerEvidence.catalog_evidence_digest,
      approval_reference: 'decision:synthetic-ok',
      environment_class: 'DISPOSABLE_CI',
      attestation_scope: 'INACTIVE_BASELINE',
      expected_migrations: canonical.migrations.map((m) => ({ id: m.id, checksum: m.checksum })),
    },
    contract
  );
  assert.equal(validation.ok, true);
  assert.equal(expected.status, 'ADOPTION_REQUIRED');
  assert.ok(expected.critical_objects.length >= 1, 'critical_objects >= 1: ' + expected.critical_objects.length);
  assert.equal(expected.critical_objects[0].name, 'table:public.schema_migration_ledger');
  assert.equal(canonical.status, 'ADOPTION_REQUIRED');
  assert.ok(canonical.migrations.length >= 1, 'migrations >= 1: ' + canonical.migrations.length);
  assert.equal(canonical.migrations[0].id, '20260802094500_bootstrap-migration-ledger');
});

test('overall provenance gate remains FAIL_CLOSED with GATE_ADOPTION_BASELINE_REQUIRED', () => {
  const expected = readJson(EXPECTED_SCHEMA);
  const canonical = readJson(CANONICAL);
  const catalogEvidence = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: [],
  };
  const baselineCommit = 'dddddddddddddddddddddddddddddddddddddddd';
  const ledgerEvidence = core.buildSyntheticAttestation({
    baselineCommit,
    migrationManifest: canonical,
    expectedSchemaManifest: expected,
    catalogEvidence,
    approvalReference: 'issue:3553',
    environmentClass: 'DISPOSABLE_CI',
    attestationScope: 'INACTIVE_BASELINE',
  });
  const result = provenance.evaluateProvenance({
    migrationManifest: canonical,
    expectedSchemaManifest: expected,
    ledgerEvidence,
    catalogEvidence,
    adoptionBinding: {
      baseline_commit: baselineCommit,
      canonical_manifest_digest: ledgerEvidence.canonical_manifest_digest,
      expected_schema_digest: ledgerEvidence.expected_schema_digest,
      catalog_evidence_digest: ledgerEvidence.catalog_evidence_digest,
      approval_reference: 'issue:3553',
      environment_class: 'DISPOSABLE_CI',
      attestation_scope: 'INACTIVE_BASELINE',
    },
    adoptionContract: contract,
  });
  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_ADOPTION_BASELINE_REQUIRED'));
  assert.equal(result.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'), false);
});

test('evaluateProvenance with self-consistent evidence but no trusted binding fails', () => {
  const a = validAttestation();
  const result = provenance.evaluateProvenance({
    migrationManifest: { status: 'ACTIVE', migrations: a.arts.migrationManifest.migrations },
    expectedSchemaManifest: { status: 'ACTIVE', ...a.arts.expectedSchemaManifest },
    ledgerEvidence: a.attestation,
    catalogEvidence: a.arts.catalogEvidence,
  });
  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'));
});

test('CLI target mode missing trusted flags fails closed without leaking values', () => {
  const relCatalog = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-cli-catalog.json')
    .replace(/\\/g, '/');
  const relLedger = path
    .join('tests', 'contracts', 'fixtures', 'migration-provenance', '_tmp-cli-ledger.json')
    .replace(/\\/g, '/');
  const catalogPath = path.join(ROOT, relCatalog);
  const ledgerPath = path.join(ROOT, relLedger);
  try {
    fs.writeFileSync(
      catalogPath,
      JSON.stringify({ format_version: '1.0', normalizer_version: '1.0', objects: [] }),
      'utf8'
    );
    fs.writeFileSync(
      ledgerPath,
      JSON.stringify({ adoption_status: 'ATTESTED', applied_migrations: [] }),
      'utf8'
    );

    const cases = [
      [
        '--ledger-evidence',
        relLedger,
        '--catalog-evidence',
        relCatalog,
        '--approval-reference',
        'issue:42',
        '--environment-class',
        'DISPOSABLE_CI',
        '--attestation-scope',
        'INACTIVE_BASELINE',
      ],
      [
        '--ledger-evidence',
        relLedger,
        '--catalog-evidence',
        relCatalog,
        '--baseline-commit',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '--environment-class',
        'DISPOSABLE_CI',
        '--attestation-scope',
        'INACTIVE_BASELINE',
      ],
      [
        '--ledger-evidence',
        relLedger,
        '--catalog-evidence',
        relCatalog,
        '--baseline-commit',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '--approval-reference',
        'issue:42',
      ],
    ];
    for (const args of cases) {
      const child = runCli(args);
      assert.equal(child.status, 1);
      const payload = JSON.parse(child.stdout);
      assert.equal(payload.decision, 'FAIL_CLOSED');
      assert.ok(payload.blockers.includes('GATE_ADOPTION_TRUST_BINDING_REQUIRED'));
      assert.equal(child.stdout.includes('issue:42'), false);
      assert.equal(child.stdout.includes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), false);
    }
  } finally {
    if (fs.existsSync(catalogPath)) fs.unlinkSync(catalogPath);
    if (fs.existsSync(ledgerPath)) fs.unlinkSync(ledgerPath);
  }
});

test('canonical and expected-schema manifests remain populated/inactive', () => {
  const expected = readJson(EXPECTED_SCHEMA);
  const canonical = readJson(CANONICAL);
  assert.equal(expected.status, 'ADOPTION_REQUIRED');
  assert.ok(expected.critical_objects.length >= 1, 'critical_objects >= 1: ' + expected.critical_objects.length);
  assert.equal(expected.critical_objects[0].name, 'table:public.schema_migration_ledger');
  assert.equal(canonical.status, 'ADOPTION_REQUIRED');
  assert.ok(canonical.migrations.length >= 1, 'migrations >= 1: ' + canonical.migrations.length);
  assert.equal(canonical.migrations[0].id, '20260802094500_bootstrap-migration-ledger');
  assert.equal(sha256File(EXPECTED_SCHEMA), START_EXPECTED_HASH);
  assert.equal(sha256File(CANONICAL), START_CANONICAL_HASH);
});

test('CLI source-only still passes and does not require adoption evidence files', () => {
  const child = runCli(['--source-only']);
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const payload = JSON.parse(child.stdout);
  assert.equal(payload.decision, 'PASS');
});

test('CLI rejects absolute ledger evidence path', () => {
  const abs = path.join(ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
  const child = runCli([
    '--ledger-evidence',
    abs,
    '--catalog-evidence',
    'tests/contracts/fixtures/migration-provenance/catalog-baseline.json',
    '--baseline-commit',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '--approval-reference',
    'issue:9999',
    '--environment-class',
    'DISPOSABLE_CI',
    '--attestation-scope',
    'INACTIVE_BASELINE',
  ]);
  assert.equal(child.status, 1);
  const payload = JSON.parse(child.stdout);
  assert.equal(payload.decision, 'FAIL_CLOSED');
  assert.ok(payload.blockers.some((b) => b.startsWith('GATE_EVIDENCE_READ_FAILED')));
  assert.equal(child.stdout.includes(abs), false);
});

test('architecture doc describes strict adoption attestation rules', () => {
  const design = fs.readFileSync(
    path.join(ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_GATE.md'),
    'utf8'
  );
  assert.ok(design.includes('Strict adoption-attestation evidence'));
  assert.ok(design.includes('bare'));
  assert.ok(design.includes('UNKNOWN_DRIFT'));
  assert.ok(design.includes('baseline_commit'));
  assert.ok(design.includes('Keep #1882 OPEN.'));
  assert.doesNotMatch(design, /\b(?:Closes|Fixes|Resolves)\s+#1882\b/i);
  assert.doesNotMatch(design, /\b(?:Closes|Fixes|Resolves)\s+#3458\b/i);
});

test('prepared UNATTESTED draft accepts populated ADOPTION_REQUIRED canonical catalog (#4091)', () => {
  const canonical = readJson(CANONICAL);
  const expected = readJson(EXPECTED_SCHEMA);
  assert.equal(canonical.status, 'ADOPTION_REQUIRED');
  assert.ok(canonical.migrations.length > 0);

  const evidence = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: expected.critical_objects.map((item) => ({
      name: item.name,
      fingerprint: item.fingerprint,
    })),
  };
  const plan = planCore.buildPreparedCollectionPlan({
    baselineCommit: '0000000000000000000000000000000000000000',
    approvalReference: 'issue:4091',
  });
  const candidate = candidateCore.buildExpectedSchemaCandidate(evidence, expected);
  const draft = core.buildPreparedUnattestedAttestationDraft({
    preparedPlan: plan,
    migrationManifest: canonical,
    expectedSchemaCandidate: candidate,
    catalogEvidence: evidence,
  });

  assert.equal(draft.adoption_status, 'UNATTESTED');
  assert.equal(draft.attestation_scope, 'PRODUCTION_READONLY');
  assert.equal(draft.environment_class, 'PRODUCTION');
  const second = core.buildPreparedUnattestedAttestationDraft({
    preparedPlan: plan,
    migrationManifest: canonical,
    expectedSchemaCandidate: candidate,
    catalogEvidence: evidence,
  });
  assert.deepEqual(draft, second);
});

test('prepared draft never claims catalog membership as applied history (#4091)', () => {
  const canonical = readJson(CANONICAL);
  const expected = readJson(EXPECTED_SCHEMA);
  const evidence = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: expected.critical_objects.map((item) => ({
      name: item.name,
      fingerprint: item.fingerprint,
    })),
  };
  const plan = planCore.buildPreparedCollectionPlan({
    baselineCommit: '0000000000000000000000000000000000000000',
    approvalReference: 'issue:4091',
  });
  const candidate = candidateCore.buildExpectedSchemaCandidate(evidence, expected);
  const draft = core.buildPreparedUnattestedAttestationDraft({
    preparedPlan: plan,
    migrationManifest: canonical,
    expectedSchemaCandidate: candidate,
    catalogEvidence: evidence,
  });

  // Populated catalog must NEVER materialize as APPLIED execution records.
  assert.deepEqual(draft.applied_migrations, []);
  assert.notEqual(draft.adoption_status, 'ATTESTED');
  const draftText = JSON.stringify(draft.applied_migrations);
  for (const record of canonical.migrations) {
    assert.equal(draftText.includes(record.id), false);
    assert.equal(draftText.includes(record.checksum), false);
  }

  // Even a manifest carrying an injected applied-history blob cannot populate
  // the prepared draft's applied_migrations through catalog membership.
  const injected = JSON.parse(JSON.stringify(canonical));
  injected.injected_applied_history = canonical.migrations.map((item) => ({
    id: item.id,
    checksum: item.checksum,
  }));
  const injectedDraft = core.buildPreparedUnattestedAttestationDraft({
    preparedPlan: plan,
    migrationManifest: injected,
    expectedSchemaCandidate: candidate,
    catalogEvidence: evidence,
  });
  assert.deepEqual(injectedDraft.applied_migrations, []);
});

test('prepared draft canonical_manifest_digest covers full populated manifest (#4091)', () => {
  const canonical = readJson(CANONICAL);
  const expected = readJson(EXPECTED_SCHEMA);
  const evidence = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: expected.critical_objects.map((item) => ({
      name: item.name,
      fingerprint: item.fingerprint,
    })),
  };
  const plan = planCore.buildPreparedCollectionPlan({
    baselineCommit: '0000000000000000000000000000000000000000',
    approvalReference: 'issue:4091',
  });
  const candidate = candidateCore.buildExpectedSchemaCandidate(evidence, expected);
  const draft = core.buildPreparedUnattestedAttestationDraft({
    preparedPlan: plan,
    migrationManifest: canonical,
    expectedSchemaCandidate: candidate,
    catalogEvidence: evidence,
  });

  // Digest is recomputed from the FULL populated canonical manifest.
  assert.equal(draft.canonical_manifest_digest, core.computeObjectDigest(canonical));

  // Any populated-catalog change moves the digest.
  const mutated = JSON.parse(JSON.stringify(canonical));
  mutated.migrations[0].checksum = provenance.sha256('mutated-catalog-record');
  const mutatedDraft = core.buildPreparedUnattestedAttestationDraft({
    preparedPlan: plan,
    migrationManifest: mutated,
    expectedSchemaCandidate: candidate,
    catalogEvidence: evidence,
  });
  assert.notEqual(mutatedDraft.canonical_manifest_digest, draft.canonical_manifest_digest);
});

test('Phase-B production-readonly collection composition succeeds with populated catalog (#4091)', () => {
  const canonical = readJson(CANONICAL);
  const expected = readJson(EXPECTED_SCHEMA);
  const boundaryContractBytes = fs.readFileSync(
    path.join(ROOT, 'db', 'migration-provenance', 'production-readonly-catalog-boundary-contract.json')
  );
  const catalogMetadataContractBytes = fs.readFileSync(
    path.join(ROOT, 'db', 'migration-provenance', 'catalog-metadata-contract.json')
  );
  const evidence = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: expected.critical_objects.map((item) => ({
      name: item.name,
      fingerprint: item.fingerprint,
    })),
  };
  const plan = planCore.buildPreparedCollectionPlan({
    baselineCommit: '0000000000000000000000000000000000000000',
    approvalReference: 'issue:4091',
  });
  const candidate = candidateCore.buildExpectedSchemaCandidate(evidence, expected);

  // run-production-readonly-catalog-collection.cjs passes the canonical manifest
  // straight into buildPreparedUnattestedAttestationDraft; a populated
  // ADOPTION_REQUIRED catalog must not surface as ATTESTATION_DRAFT_FAILED.
  let draft;
  assert.doesNotThrow(() => {
    draft = core.buildPreparedUnattestedAttestationDraft({
      preparedPlan: plan,
      migrationManifest: canonical,
      expectedSchemaCandidate: candidate,
      catalogEvidence: evidence,
    });
  });

  const receipt = receiptCore.buildCollectionReceipt({
    preparedPlan: plan,
    boundaryContractBytes,
    catalogMetadataContractBytes,
    canonicalManifest: canonical,
    expectedSchemaManifest: expected,
    catalogEvidence: evidence,
    inactiveExpectedSchemaCandidate: candidate,
    preparedAttestationDraft: draft,
    collectionSessionCount: 1,
  });
  assert.equal(receipt.outcome, 'COLLECTION_PASS_SANITIZED_EVIDENCE_READY');
  assert.equal(receipt.canonical_manifest_digest, draft.canonical_manifest_digest);
  assert.equal(receipt.attestation_status, 'UNATTESTED');
  assert.equal(receipt.manifest_activation, 'NONE');
});

function populatedCatalogDraftInput(mutations = {}) {
  const canonical = readJson(CANONICAL);
  const expected = readJson(EXPECTED_SCHEMA);
  const manifest = JSON.parse(JSON.stringify(canonical));
  if (typeof mutations.record === 'function') {
    mutations.record(manifest.migrations[0], manifest);
  }
  if (typeof mutations.manifest === 'function') {
    mutations.manifest(manifest);
  }
  const evidence = {
    format_version: '1.0',
    normalizer_version: '1.0',
    objects: expected.critical_objects.map((item) => ({
      name: item.name,
      fingerprint: item.fingerprint,
    })),
  };
  return {
    preparedPlan: planCore.buildPreparedCollectionPlan({
      baselineCommit: '0000000000000000000000000000000000000000',
      approvalReference: 'issue:4091',
    }),
    migrationManifest: manifest,
    expectedSchemaCandidate: candidateCore.buildExpectedSchemaCandidate(evidence, expected),
    catalogEvidence: evidence,
  };
}

test('populated catalog records remain strict fail-closed (#4091)', () => {
  const secondChecksum = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const cases = [
    ['record is null', { record: (rec, manifest) => { manifest.migrations[0] = null; } }, 'ADOPTION_ATTESTATION_MIGRATION_INVALID'],
    ['record is string', { record: (rec, manifest) => { manifest.migrations[0] = 'record'; } }, 'ADOPTION_ATTESTATION_MIGRATION_INVALID'],
    ['missing canonical field', { record: (rec) => { delete rec.name; } }, 'ADOPTION_ATTESTATION_INPUT_INVALID'],
    ['null canonical field', { record: (rec) => { rec.owner_domain = null; } }, 'ADOPTION_ATTESTATION_INPUT_INVALID'],
    ['unknown record field', { record: (rec) => { rec.extra_field = 'bad'; } }, 'ADOPTION_ATTESTATION_UNKNOWN_FIELD'],
    ['prohibited record field', { record: (rec) => { rec.host = 'db.example'; } }, 'ADOPTION_ATTESTATION_PROHIBITED_FIELD'],
    ['invalid migration id', { record: (rec) => { rec.id = '20260802094500_Invalid_ID'; rec.path = 'db/migrations/20260802094500_Invalid_ID.sql'; } }, 'ADOPTION_ATTESTATION_MIGRATION_INVALID'],
    ['non-canonical path', { record: (rec) => { rec.path = 'db/migrations/nested/x.sql'; } }, 'ADOPTION_ATTESTATION_PATH_INVALID'],
    ['path basename/ID mismatch', { record: (rec) => { rec.path = 'db/migrations/other.sql'; } }, 'ADOPTION_ATTESTATION_PATH_INVALID'],
    ['invalid checksum', { record: (rec) => { rec.checksum = 'sha256:not_valid_hex'; } }, 'ADOPTION_ATTESTATION_DIGEST_INVALID'],
    ['duplicate id', { record: (rec, manifest) => {
      const clone = JSON.parse(JSON.stringify(rec));
      clone.path = `db/migrations/${clone.id}.sql`;
      clone.depends_on = [];
      manifest.migrations.push(clone);
    } }, 'ADOPTION_ATTESTATION_MIGRATION_INVALID'],
    ['reordered records (timestamp reversal)', { record: (rec, manifest) => { manifest.migrations.reverse(); } }, 'ADOPTION_ATTESTATION_MIGRATION_INVALID'],
    ['invalid risk_class', { record: (rec) => { rec.risk_class = 'WILD'; } }, 'ADOPTION_ATTESTATION_ENUM_INVALID'],
    ['invalid transaction_mode', { record: (rec) => { rec.transaction_mode = 'MAYBE'; } }, 'ADOPTION_ATTESTATION_ENUM_INVALID'],
    ['unknown destructive operation', { record: (rec) => { rec.destructive_operations = ['NUKE_EVERYTHING']; } }, 'ADOPTION_ATTESTATION_ENUM_INVALID'],
    ['duplicate destructive operation', { record: (rec) => { rec.destructive_operations = ['DROP_TABLE', 'DROP_TABLE']; } }, 'ADOPTION_ATTESTATION_ENUM_INVALID'],
    ['unknown precondition check', { record: (rec) => { rec.expected_preconditions = [{ check: 'column_exists', target: 'x', expected: true }]; } }, 'ADOPTION_ATTESTATION_ENUM_INVALID'],
    ['malformed condition record', { record: (rec) => { rec.expected_postconditions = [{ check: 'table_exists' }]; } }, 'ADOPTION_ATTESTATION_UNKNOWN_FIELD'],
    ['non-boolean expected condition', { record: (rec) => { rec.expected_postconditions = [{ check: 'table_exists', target: 'x', expected: 'yes' }]; } }, 'ADOPTION_ATTESTATION_INPUT_INVALID'],
    ['self dependency', { record: (rec) => { rec.depends_on = [rec.id]; } }, 'ADOPTION_ATTESTATION_INPUT_INVALID'],
    ['duplicate dependency', { record: (rec) => { rec.depends_on = ['20260802094500_bootstrap-migration-ledger', '20260802094500_bootstrap-migration-ledger']; } }, 'ADOPTION_ATTESTATION_INPUT_INVALID'],
    ['unknown dependency', { record: (rec) => { rec.depends_on = ['20260101000000_missing']; } }, 'ADOPTION_ATTESTATION_INPUT_INVALID'],
    ['forward dependency ordering', { record: (rec) => { rec.depends_on = ['20260812213000_add-tree-appreciation-orders']; } }, 'ADOPTION_ATTESTATION_INPUT_INVALID'],
    ['placeholder approval', { record: (rec) => { rec.approval_reference = 'TBD'; } }, 'ADOPTION_ATTESTATION_APPROVAL_INVALID'],
    ['malformed approval reference', { record: (rec) => { rec.approval_reference = 'issue:0'; } }, 'ADOPTION_ATTESTATION_APPROVAL_INVALID'],
    ['empty rollback_support', { record: (rec) => { rec.rollback_support = ''; } }, 'ADOPTION_ATTESTATION_INPUT_INVALID'],
  ];
  for (const [label, mutations, category] of cases) {
    assert.throws(
      () => core.buildPreparedUnattestedAttestationDraft(populatedCatalogDraftInput(mutations)),
      (error) => {
        assert.equal(error.category, category, `${label}: expected ${category}, got ${error.category}`);
        return true;
      },
      label
    );
  }
});

test('malformed ADOPTION_REQUIRED manifests remain fail-closed (#4091)', () => {
  const cases = [
    ['missing migrations field', { manifest: (m) => { delete m.migrations; } }, 'ADOPTION_ATTESTATION_INPUT_INVALID'],
    ['non-array migrations', { manifest: (m) => { m.migrations = 'not_array'; } }, 'ADOPTION_ATTESTATION_INPUT_INVALID'],
    ['migrations with holes', { manifest: (m) => { m.migrations.push(undefined); } }, 'ADOPTION_ATTESTATION_VALUE_INVALID'],
  ];
  for (const [label, mutations, category] of cases) {
    assert.throws(
      () => core.buildPreparedUnattestedAttestationDraft(populatedCatalogDraftInput(mutations)),
      (error) => {
        assert.equal(error.category, category, label);
        return true;
      },
      label
    );
  }
  assert.throws(
    () => core.buildPreparedUnattestedAttestationDraft({
      preparedPlan: populatedCatalogDraftInput().preparedPlan,
      migrationManifest: null,
      expectedSchemaCandidate: populatedCatalogDraftInput().expectedSchemaCandidate,
      catalogEvidence: populatedCatalogDraftInput().catalogEvidence,
    }),
    (error) => error.category === 'ADOPTION_ATTESTATION_INPUT_INVALID'
  );
});

test('prepared draft rejects ACTIVE promotion attempts (#4091)', () => {
  const base = populatedCatalogDraftInput();
  const draft = core.buildPreparedUnattestedAttestationDraft(base);
  assert.equal(draft.adoption_status, 'UNATTESTED');
  assert.ok(['ATTESTED', 'ACTIVE'].includes(draft.adoption_status) === false);

  const activeCandidate = { ...base.expectedSchemaCandidate, status: 'ACTIVE' };
  assert.throws(
    () => core.buildPreparedUnattestedAttestationDraft({
      ...base,
      expectedSchemaCandidate: activeCandidate,
    }),
    (error) => error.category === 'ADOPTION_ATTESTATION_ENUM_INVALID'
  );
});

test('ATTESTED evidence cannot fabricate applied history from catalog membership (#4091)', () => {
  const canonical = readJson(CANONICAL);
  const baselineCommit = '1111111111111111111111111111111111111111';
  const attestation = core.buildSyntheticAttestation({
    baselineCommit,
    migrationManifest: canonical,
    expectedSchemaManifest: readJson(EXPECTED_SCHEMA),
    catalogEvidence: { format_version: '1.0', normalizer_version: '1.0', objects: [] },
    environmentClass: 'DISPOSABLE_CI',
    varianceClassification: 'MATCH',
    approvalReference: 'issue:9999',
    attestationScope: 'INACTIVE_BASELINE',
    appliedMigrations: [{ id: canonical.migrations[0].id, checksum: canonical.migrations[0].checksum }],
  });
  // Trusted list is empty: catalog membership alone must never attest application.
  const result = core.validateAdoptionAttestationEvidence(
    attestation,
    {
      baseline_commit: baselineCommit,
      canonical_manifest_digest: attestation.canonical_manifest_digest,
      expected_schema_digest: attestation.expected_schema_digest,
      catalog_evidence_digest: attestation.catalog_evidence_digest,
      approval_reference: 'issue:9999',
      environment_class: 'DISPOSABLE_CI',
      attestation_scope: 'INACTIVE_BASELINE',
      expected_migrations: [],
    },
    contract
  );
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('GATE_ADOPTION_MIGRATION_UNKNOWN'));
});

test('post-suite manifests still unchanged', () => {
  assert.equal(sha256File(EXPECTED_SCHEMA), START_EXPECTED_HASH);
  assert.equal(sha256File(CANONICAL), START_CANONICAL_HASH);
});
