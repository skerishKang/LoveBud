'use strict';

/**
 * SOURCE_STATIC policy tests for canonical schema-adoption activation gate (#4282).
 * Pure — no DB, no Production contact, no secrets. Validates the fail-closed gate
 * and the paper-only activation artifact (canonical stream NOT auto-activated).
 *
 * Refs #4282, #3458 (keep OPEN), #1882 (keep OPEN).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE = require(path.join(ROOT, 'scripts/canonical-schema-adoption-activation-gate-core.cjs'));
const MANIFEST = require(path.join(ROOT, 'db/migration-provenance/canonical-migrations.json'));
const EXPECTED = require(path.join(ROOT, 'db/migration-provenance/expected-schema-manifest.json'));
const ARTIFACT = path.join(ROOT, 'db/migration-provenance/canonical-schema-adoption-activation-artifact.json');

const GOOD_PACKET = {
  currentMain: '7362b4e631136d6e94f8dc1459e99aeb3e216598',
  approvalReference: 'issue:4282',
  targetIdentity: {
    product_shared: '133-relovetree',
    environment_class: 'production',
    database: 'neondb',
  },
  migrationFile: 'db/migrations/20260812213000_add-tree-appreciation-orders.sql',
  migrationSha256: '5332ce91ee1440d3c1bebd0a3b0b5ff9cab0a23612195141bebb94d340ebaad8',
  intendedRelation: 'public.tree_appreciation_orders',
  applyMode: 'TRANSACTION_REQUIRED',
  expectedSchemaFingerprint: 'e7bae9da3a80a035066525ae3f2d780bf4aa97c1ef400d151604e0e1998b8bb1',
  productRowReadAllowed: false,
  runtimeGateActivation: false,
  writerGrant: false,
  providerReroute: false,
  ambiguousRetryAllowed: false,
  unrelatedMigrationCount: 0,
};

test('ADOPTION_REQUIRED without explicit activation packet fails closed', () => {
  const res = CORE.evaluateAdoptionActivationGate(null);
  assert.equal(res.decision, CORE.GATE_DECISIONS.FAIL_CLOSED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_PACKET_FIELD_INVALID));
});

test('ADOPTION_REQUIRED manifest status gates fail closed without explicit #4282 approval binding', () => {
  // Same shape as the good packet but wrong approval reference -> fail closed.
  const res = CORE.evaluateAdoptionActivationGate({
    ...GOOD_PACKET,
    approvalReference: 'issue:9999',
  });
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_APPROVAL_REFERENCE_INVALID));
  // Manifest status stays ADOPTION_REQUIRED regardless of the gate outcome.
  assert.equal(MANIFEST.status, 'ADOPTION_REQUIRED');
});

test('exact #4282 approval packet can activate only this one migration path', () => {
  const res = CORE.evaluateAdoptionActivationGate(GOOD_PACKET);
  assert.equal(res.decision, CORE.GATE_DECISIONS.PAPER_ACTIVATION_GATE_PASSED);
  assert.equal(res.blockers.length, 0);
  assert.equal(res.binding.migrationId, '20260812213000_add-tree-appreciation-orders');
  assert.equal(res.binding.canonicalStatus, 'ADOPTION_REQUIRED');
  assert.equal(res.binding.targetAllowlisted, true);
});

test('wrong migration path fails closed', () => {
  const bad = { ...GOOD_PACKET, migrationFile: 'db/migrations/20260812213000_add-tree-appreciation-orders.sql.bak' };
  const res = CORE.evaluateAdoptionActivationGate(bad);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_MIGRATION_NOT_FOUND));
});

test('wrong checksum fails closed', () => {
  const bad = { ...GOOD_PACKET, migrationSha256: '0'.repeat(64) };
  const res = CORE.evaluateAdoptionActivationGate(bad);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_CHECKSUM_MISMATCH));
});

test('target-present precheck packet field shape (allowlist-only) keeps gate fail-closed on malformed target', () => {
  const bad = { ...GOOD_PACKET, intendedRelation: 'public.trees' };
  const res = CORE.evaluateAdoptionActivationGate(bad);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_TARGET_RELATION_INVALID));
});

test('unrelated migration count > 0 fails closed (single-migration-only)', () => {
  const bad = { ...GOOD_PACKET, unrelatedMigrationCount: 1 };
  const res = CORE.evaluateAdoptionActivationGate(bad);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_SINGLE_MIGRATION_ONLY_VIOLATION));
});

test('product row read remains blocked', () => {
  const bad = { ...GOOD_PACKET, productRowReadAllowed: true };
  const res = CORE.evaluateAdoptionActivationGate(bad);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_PRODUCT_ROW_READ_FORBIDDEN));
});

test('runtime gate activation remains blocked', () => {
  const bad = { ...GOOD_PACKET, runtimeGateActivation: true };
  const res = CORE.evaluateAdoptionActivationGate(bad);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_RUNTIME_GATE_FORBIDDEN));
});

test('writer grant remains blocked', () => {
  const bad = { ...GOOD_PACKET, writerGrant: true };
  const res = CORE.evaluateAdoptionActivationGate(bad);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_WRITER_GRANT_FORBIDDEN));
});

test('provider reroute remains blocked', () => {
  const bad = { ...GOOD_PACKET, providerReroute: true };
  const res = CORE.evaluateAdoptionActivationGate(bad);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_PROVIDER_REROUTE_FORBIDDEN));
});

test('ambiguous outcome blocks retry (no blind retry)', () => {
  const bad = { ...GOOD_PACKET, ambiguousRetryAllowed: true };
  const res = CORE.evaluateAdoptionActivationGate(bad);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_AMBIGUOUS_OUTCOME_FORBIDS_RETRY));
});

test('paper-only activation artifact does not flip canonical status to ACTIVE', () => {
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'));
  assert.equal(artifact.status, 'ADOPTION_REQUIRED');
  assert.equal(artifact.canonical_status_after, 'ADOPTION_REQUIRED');
  assert.equal(artifact.production_mutation, 'NONE');
  assert.equal(artifact.runner_implemented, false);
});

test('createPaperActivationArtifact refuses to write on failing packet', () => {
  const res = CORE.createPaperActivationArtifact({ ...GOOD_PACKET, migrationSha256: 'bad' });
  assert.equal(res.artifactCreated, false);
  assert.equal(res.gate.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
});

test('createPaperActivationArtifact passes paper gate on good packet but does not mutate Production', () => {
  const res = CORE.createPaperActivationArtifact(GOOD_PACKET);
  assert.equal(res.artifactCreated, true);
  assert.equal(res.canonicalStatusAfter, 'ADOPTION_REQUIRED');
  assert.equal(res.productionMutation, 'NONE');
  assert.equal(res.artifactType, 'PAPER_ONLY_ADOPTION_ACTIVATION_RECORD');
});

test('expected-schema fingerprint binding enforced', () => {
  const bad = { ...GOOD_PACKET, expectedSchemaFingerprint: '0'.repeat(64) };
  const res = CORE.evaluateAdoptionActivationGate(bad);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_EXPECTED_SCHEMA_FINGERPRINT_UNKNOWN));
});

test('no raw grantee/secret/credential fields emitted by gate result', () => {
  const res = CORE.evaluateAdoptionActivationGate(GOOD_PACKET);
  const dumped = JSON.stringify(res);
  assert.equal(dumped.includes('DATABASE_URL'), false);
  assert.equal(dumped.includes('password'), false);
  assert.equal(dumped.includes('pg_'), false);
});

test('tree_hub_layouts packet with wrong fingerprint fails closed as GATE_EXPECTED_SCHEMA_FINGERPRINT_UNKNOWN', () => {
  const hubLayoutPacket = {
    currentMain: '7362b4e631136d6e94f8dc1459e99aeb3e216598',
    approvalReference: 'issue:4346',
    targetIdentity: {
      product_shared: '133-relovetree',
      environment_class: 'production',
      database: 'neondb',
    },
    migrationFile: 'db/migrations/20260828070000_add-tree-hub-layouts.sql',
    migrationSha256: '64951f76ec2626bd75b4532d66d7743ffb2f1191620c707e927ba5477b0045c9',
    intendedRelation: 'public.tree_hub_layouts',
    applyMode: 'TRANSACTION_REQUIRED',
    expectedSchemaFingerprint: '0'.repeat(64),
    productRowReadAllowed: false,
    runtimeGateActivation: false,
    writerGrant: false,
    providerReroute: false,
    ambiguousRetryAllowed: false,
    unrelatedMigrationCount: 0,
  };
  const res = CORE.evaluateAdoptionActivationGate(hubLayoutPacket);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_EXPECTED_SCHEMA_FINGERPRINT_UNKNOWN));
});

test('tree_hub_layouts packet with accepted CI fingerprint and allowlist passes paper activation gate', () => {
  const hubLayoutPacket = {
    currentMain: '7362b4e631136d6e94f8dc1459e99aeb3e216598',
    approvalReference: 'issue:4346',
    targetIdentity: {
      product_shared: '133-relovetree',
      environment_class: 'production',
      database: 'neondb',
    },
    migrationFile: 'db/migrations/20260828070000_add-tree-hub-layouts.sql',
    migrationSha256: '64951f76ec2626bd75b4532d66d7743ffb2f1191620c707e927ba5477b0045c9',
    intendedRelation: 'public.tree_hub_layouts',
    applyMode: 'TRANSACTION_REQUIRED',
    expectedSchemaFingerprint: '199a8d5dc0b21d8a5d0ecaa7a7101cd65b926f2d884682840624388279cc2316',
    productRowReadAllowed: false,
    runtimeGateActivation: false,
    writerGrant: false,
    providerReroute: false,
    ambiguousRetryAllowed: false,
    unrelatedMigrationCount: 0,
  };
  const res = CORE.evaluateAdoptionActivationGate(hubLayoutPacket);
  assert.equal(res.decision, CORE.GATE_DECISIONS.PAPER_ACTIVATION_GATE_PASSED);
  assert.deepEqual(res.blockers, []);
});

test('tree_hub_layouts packet rejects issue:4277 as execution approval reference', () => {
  const hubLayoutPacket = {
    currentMain: '7362b4e631136d6e94f8dc1459e99aeb3e216598',
    approvalReference: 'issue:4277', // migration provenance only, NOT execution approval
    targetIdentity: {
      product_shared: '133-relovetree',
      environment_class: 'production',
      database: 'neondb',
    },
    migrationFile: 'db/migrations/20260828070000_add-tree-hub-layouts.sql',
    migrationSha256: '64951f76ec2626bd75b4532d66d7743ffb2f1191620c707e927ba5477b0045c9',
    intendedRelation: 'public.tree_hub_layouts',
    applyMode: 'TRANSACTION_REQUIRED',
    expectedSchemaFingerprint: '0'.repeat(64),
    productRowReadAllowed: false,
    runtimeGateActivation: false,
    writerGrant: false,
    providerReroute: false,
    ambiguousRetryAllowed: false,
    unrelatedMigrationCount: 0,
  };
  const res = CORE.evaluateAdoptionActivationGate(hubLayoutPacket);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_APPROVAL_REFERENCE_INVALID));
});

test('unregistered relation fails closed as GATE_TARGET_RELATION_INVALID', () => {
  const unregPacket = {
    ...GOOD_PACKET,
    intendedRelation: 'public.some_random_table',
  };
  const res = CORE.evaluateAdoptionActivationGate(unregPacket);
  assert.equal(res.decision, CORE.GATE_DECISIONS.NOT_APPROVED);
  assert.ok(res.blockers.includes(CORE.GATE_BLOCKERS.GATE_TARGET_RELATION_INVALID));
});

test('Hub Layout #4346 authority binding contract: manifest, allowlist, and profile parity', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migration-provenance', 'expected-schema-manifest.json'), 'utf8'));
  const allowlist = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migration-provenance', 'adoption-baseline-collection-plan-contract.json'), 'utf8'));
  const ACCEPTED_FINGERPRINT = 'sha256:199a8d5dc0b21d8a5d0ecaa7a7101cd65b926f2d884682840624388279cc2316';
  const ACCEPTED_RAW_HEX = '199a8d5dc0b21d8a5d0ecaa7a7101cd65b926f2d884682840624388279cc2316';

  // 1. Manifest status remains ADOPTION_REQUIRED
  assert.equal(manifest.status, 'ADOPTION_REQUIRED');

  // 2. tree_hub_layouts has exact accepted fingerprint and NO provisional_fingerprint
  const hlManifestEntry = manifest.critical_objects.find((o) => o.name === 'table:public.tree_hub_layouts');
  assert.ok(hlManifestEntry, 'tree_hub_layouts present in expected-schema-manifest');
  assert.equal(hlManifestEntry.fingerprint, ACCEPTED_FINGERPRINT);
  assert.equal(hlManifestEntry.provisional_fingerprint, undefined);

  // 3. Adoption baseline collection plan contract remains PREPARED_ONLY and UNATTESTED
  assert.equal(allowlist.fixed_field_values.plan_status, 'PREPARED_ONLY');
  assert.equal(allowlist.prepared_attestation_status, 'UNATTESTED');

  // 4. Reviewed allowlist entry has exact structural metadata categories and CORE_TREE_IDENTITY
  const hlAllowlistEntry = allowlist.reviewed_object_allowlist.find((o) => o.name === 'table:public.tree_hub_layouts');
  assert.ok(hlAllowlistEntry, 'tree_hub_layouts present in reviewed_object_allowlist');
  assert.equal(hlAllowlistEntry.kind, 'TABLE');
  assert.equal(hlAllowlistEntry.rationale_code, 'CORE_TREE_IDENTITY');
  assert.deepEqual(hlAllowlistEntry.metadata_categories, [
    'columns',
    'types',
    'nullability',
    'defaults',
    'primary_keys',
    'unique_constraints',
    'foreign_keys',
    'indexes',
    'triggers',
    'row_level_security',
    'grants',
    'table_kind',
  ]);

  // 5. Object selection evidence present
  assert.ok(allowlist.object_selection_evidence['table:public.tree_hub_layouts'], 'object_selection_evidence entry exists');
  const ev = allowlist.object_selection_evidence['table:public.tree_hub_layouts'];
  assert.ok(ev.repository_evidence.includes('db/migrations/20260828070000_add-tree-hub-layouts.sql'));
  assert.ok(ev.repository_evidence.includes('db/migration-provenance/expected-schema-manifest.json'));
  assert.ok(ev.repository_evidence.includes('db/migration-provenance/canonical-migrations.json'));

  // 6. Profile 4346 in operator-core has accepted fingerprint, ACTIVE_AUTHORIZED lifecycle, and bound comment 5543891263
  const OP = require('../../scripts/canonical-schema-adoption-operator-core.cjs');
  const profile4346 = OP.PROFILES['4346'];
  assert.ok(profile4346, 'Profile 4346 exists in operator core');
  assert.equal(profile4346.expectedSchemaFingerprint, ACCEPTED_RAW_HEX);
  assert.equal(profile4346.lifecycleState, 'ACTIVE_AUTHORIZED');
  assert.equal(profile4346.activeAuthorizationComment, 5543891263);
});
