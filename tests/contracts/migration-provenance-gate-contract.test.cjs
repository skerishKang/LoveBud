const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE_PATH = path.join(ROOT, 'scripts', 'migration-provenance-core.cjs');
const CLI_PATH = path.join(ROOT, 'scripts', 'check-migration-provenance.cjs');
const INVENTORY_PATH = path.join(ROOT, 'docs', 'architecture', 'migration-path-inventory.json');
const DESIGN_PATH = path.join(ROOT, 'docs', 'architecture', 'DB_MIGRATION_PROVENANCE_GATE.md');
const LEDGER_CONTRACT_PATH = path.join(ROOT, 'db', 'migration-provenance', 'ledger-contract.json');
const MIGRATION_MANIFEST_PATH = path.join(ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const EXPECTED_SCHEMA_PATH = path.join(ROOT, 'db', 'migration-provenance', 'expected-schema-manifest.json');

const core = require(CORE_PATH);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function activeFixture() {
  const firstChecksum = core.sha256('migration-one');
  const secondChecksum = core.sha256('migration-two');
  const schemaFingerprint = core.sha256('table:example|id:text:not-null');
  return {
    migrationManifest: {
      status: 'ACTIVE',
      migrations: [
        { id: '20260713090000_example-one', checksum: firstChecksum },
        { id: '20260713090100_example-two', checksum: secondChecksum }
      ]
    },
    expectedSchemaManifest: {
      status: 'ACTIVE',
      critical_objects: [{ name: 'table:example', fingerprint: schemaFingerprint }]
    },
    ledgerEvidence: {
      adoption_status: 'ATTESTED',
      applied_migrations: [
        { id: '20260713090000_example-one', checksum: firstChecksum },
        { id: '20260713090100_example-two', checksum: secondChecksum }
      ]
    },
    catalogEvidence: {
      objects: [{ name: 'table:example', fingerprint: schemaFingerprint }]
    }
  };
}

test('committed provenance source configuration is complete and static-only', () => {
  const result = core.validateSourceConfiguration({
    repoRoot: ROOT,
    inventory: readJson(INVENTORY_PATH),
    migrationManifest: readJson(MIGRATION_MANIFEST_PATH),
    expectedSchemaManifest: readJson(EXPECTED_SCHEMA_PATH)
  });

  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.summary.discovered_paths, 26);
  assert.ok(result.summary.inventory_rows >= result.summary.discovered_paths);
  assert.equal(result.summary.canonical_migrations, 0);
});

test('inventory keeps the required classifications, checksums, and dispositions', () => {
  const inventory = readJson(INVENTORY_PATH);
  assert.deepEqual(inventory.classification_enum, core.CLASSIFICATIONS);
  assert.ok(inventory.entries.length >= 26);
  for (const entry of inventory.entries) {
    for (const field of core.REQUIRED_INVENTORY_FIELDS) {
      assert.notEqual(entry[field], undefined, `${entry.path} missing ${field}`);
      assert.notEqual(entry[field], '', `${entry.path} has empty ${field}`);
    }
    assert.match(entry.content_checksum, core.SHA256_PATTERN);
  }
});

test('ledger contract excludes operator identity and credential material', () => {
  const ledgerContract = readJson(LEDGER_CONTRACT_PATH);
  assert.deepEqual(ledgerContract.required_record_fields, [
    'migration_id',
    'content_checksum',
    'applied_at',
    'runner_version',
    'environment_class',
    'deployed_commit',
    'transaction_outcome'
  ]);
  assert.ok(ledgerContract.prohibited_record_fields.includes('operator_email'));
  assert.ok(ledgerContract.prohibited_record_fields.includes('connection_string'));
});

test('manifest and ledger contract cannot drift independently', () => {
  const manifest = readJson(MIGRATION_MANIFEST_PATH);
  manifest.ledger.required_record_fields = manifest.ledger.required_record_fields.slice(0, -1);
  const result = core.validateMigrationManifest(manifest, ROOT);

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('MIGRATION_LEDGER_CONTRACT_MISMATCH'));
});

test('unadopted repository state fails closed without target evidence', () => {
  const result = core.evaluateProvenance({
    migrationManifest: readJson(MIGRATION_MANIFEST_PATH),
    expectedSchemaManifest: readJson(EXPECTED_SCHEMA_PATH)
  });

  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_ADOPTION_BASELINE_REQUIRED'));
  assert.ok(result.blockers.includes('GATE_LEDGER_EVIDENCE_UNAVAILABLE'));
  assert.ok(result.blockers.includes('GATE_CATALOG_EVIDENCE_UNAVAILABLE'));
});

test('gate passes only matching migration and catalog evidence', () => {
  const fixture = activeFixture();
  const result = core.evaluateProvenance(fixture);

  assert.equal(result.decision, 'PASS');
  assert.deepEqual(result.blockers, []);
});

test('gate fails closed for unknown, edited, missing, and reordered migrations', () => {
  const fixture = activeFixture();
  fixture.ledgerEvidence.applied_migrations = [
    { id: '20260713090100_example-two', checksum: core.sha256('edited') },
    { id: '20260713090200_unknown', checksum: core.sha256('unknown') }
  ];
  const result = core.evaluateProvenance(fixture);

  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.some((blocker) => blocker.startsWith('GATE_REORDERED_MIGRATION:')));
  assert.ok(result.blockers.some((blocker) => blocker.startsWith('GATE_EDITED_MIGRATION:')));
  assert.ok(result.blockers.some((blocker) => blocker.startsWith('GATE_UNKNOWN_APPLIED_MIGRATION:')));
  assert.ok(result.blockers.some((blocker) => blocker.startsWith('GATE_MISSING_APPLIED_MIGRATION:')));
});

test('gate fails closed for catalog drift and unavailable adoption evidence', () => {
  const fixture = activeFixture();
  fixture.ledgerEvidence.adoption_status = 'UNATTESTED';
  fixture.catalogEvidence.objects = [{ name: 'table:unexpected', fingerprint: core.sha256('unexpected') }];
  const result = core.evaluateProvenance(fixture);

  assert.equal(result.decision, 'FAIL_CLOSED');
  assert.ok(result.blockers.includes('GATE_ADOPTION_EVIDENCE_UNAVAILABLE'));
  assert.ok(result.blockers.some((blocker) => blocker.startsWith('GATE_UNEXPECTED_SCHEMA_OBJECT:')));
  assert.ok(result.blockers.some((blocker) => blocker.startsWith('GATE_MISSING_SCHEMA_OBJECT:')));
});

test('source-only implementation has no database, network, or deploy client', () => {
  const source = fs.readFileSync(CORE_PATH, 'utf8');
  const cli = fs.readFileSync(CLI_PATH, 'utf8');
  assert.doesNotMatch(source, /require\(['"](?:pg|child_process|playwright|dotenv)['"]\)/i);
  assert.doesNotMatch(source, /fetch\(|DATABASE_URL|\bpsql\b|wrangler|https?:\/\//i);
  assert.doesNotMatch(cli, /require\(['"](?:pg|child_process|playwright|dotenv)['"]\)/i);
  assert.doesNotMatch(cli, /fetch\(|DATABASE_URL|\bpsql\b|wrangler|https?:\/\//i);
});

test('architecture document fixes the adoption and issue-boundary rules', () => {
  const design = fs.readFileSync(DESIGN_PATH, 'utf8');
  for (const heading of [
    '## A. Current State',
    '## B. Canonical Ledger',
    '## C. Migration Manifest',
    '## D. Expected-Schema Manifest',
    '## E. Read-Only Provenance Gate',
    '## F. Destructive DDL Policy',
    '## G. Existing Production Adoption',
    '## H. Rollback and Forward Fix',
    '## I. Clean Database Reconstruction',
    '## J. Follow-Up Child Work'
  ]) {
    assert.ok(design.includes(heading), `missing ${heading}`);
  }
  assert.ok(design.includes('Refs #3458'));
  assert.ok(design.includes('Refs #1882'));
  assert.ok(design.includes('Keep #1882 OPEN.'));
  assert.doesNotMatch(design, /\b(?:Closes|Fixes|Resolves)\s+#1882\b/i);
});
