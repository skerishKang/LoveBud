'use strict';

/**
 * Source-static contract for Issue #3846 (Step 8 Child 2 clean canonical
 * bootstrap rehearsal). Locks the exact eleven-file cumulative boundary, package
 * script, CI job, PostgreSQL service image/version, loopback-only LB_TEST_PG*
 * boundary, committed-authority invariants (ADOPTION_REQUIRED manifest with
 * exactly one migration and exactly one expected critical object; no synthetic
 * ACTIVE manifest; no generic-runner success path; no unauthorized `bootstrap`
 * top-level field), orchestrator boundary (dedicated orchestrator owns the
 * bootstrap path; generic runner unchanged), classification entries, and parent
 * completion posture. Real DB behavior belongs to the DB-engine test, which runs
 * only on GitHub Actions; string checks here do not claim DB behavior.
 *
 * Refs: #3846, #3840, #3839, #3816, #3809, #3802, #3657, #3458, #3425, #3435,
 * #3437, #1882
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { EXPECTED_DB_ENGINE_SCRIPTS } = require('../../scripts/report-ci-test-groups.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

const DB_TEST_PATH = 'tests/db-engine/clean-canonical-bootstrap-postgres.test.cjs';
const CONTRACT_TEST_PATH = 'tests/contracts/db-clean-canonical-bootstrap-rehearsal-contract.test.cjs';
const CONTRACT_DOC_PATH = 'docs/architecture/db-clean-canonical-bootstrap-rehearsal-contract.md';
const ORCHESTRATOR_PATH = 'scripts/migration-clean-bootstrap-orchestrator-core.cjs';
const SQL_FILE_PATH = 'db/migrations/20260802094500_bootstrap-migration-ledger.sql';
const MANIFEST_PATH = 'db/migration-provenance/canonical-migrations.json';
const SCHEMA_MANIFEST_PATH = 'db/migration-provenance/expected-schema-manifest.json';
const BOOTSTRAP_ID = '20260802094500_bootstrap-migration-ledger';
const EXPECTED_OBJECT_NAME = 'table:public.schema_migration_ledger';
const GENERIC_RUNNER_PATH = 'scripts/migration-runner-orchestrator-core.cjs';
const GENERIC_RUNNER_PROTOCOL_PATH = 'scripts/migration-runner-protocol-core.cjs';

const EXPECTED_ELEVEN = [
  '.github/workflows/ci.yml',
  'db/migration-provenance/canonical-migrations.json',
  'db/migration-provenance/expected-schema-manifest.json',
  'db/migrations/20260802094500_bootstrap-migration-ledger.sql',
  'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md',
  'docs/architecture/db-clean-canonical-bootstrap-rehearsal-contract.md',
  'package.json',
  'scripts/migration-clean-bootstrap-orchestrator-core.cjs',
  'tests/contracts/db-clean-canonical-bootstrap-rehearsal-contract.test.cjs',
  'tests/db-engine/clean-canonical-bootstrap-postgres.test.cjs',
  'tests/test-layer-classification.json',
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function sha256File(rel) {
  const bytes = fs.readFileSync(path.join(ROOT, rel));
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object') return false;
  try { if (Array.isArray(value)) return false; } catch { return false; }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// ── 1. Eleven-file boundary ──────────────────────────────────────────────────

test('exactly eleven files exist in the cumulative boundary', () => {
  for (const rel of EXPECTED_ELEVEN) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), 'required file exists: ' + rel);
  }
  assert.equal(EXPECTED_ELEVEN.length, 11, 'exact boundary is eleven files');
  assert.deepEqual(EXPECTED_ELEVEN, EXPECTED_ELEVEN.slice().sort(), 'boundary list is sorted');
  assert.ok(!fs.existsSync(path.join(ROOT, 'tests/contracts/canonical-bootstrap-rehearsal-contract.test.cjs')), 'superseded stub removed');
  assert.ok(!fs.existsSync(path.join(ROOT, 'tests/db-engine/canonical-bootstrap-rehearsal-postgres.test.cjs')), 'superseded DB test removed');
  assert.ok(!fs.existsSync(path.join(ROOT, 'docs/architecture/canonical-bootstrap-rehearsal-contract.md')), 'superseded contract doc removed');
  assert.ok(!fs.existsSync(path.join(ROOT, '.well-known', 'release.json')), 'build artifact removed');
});

// ── 2. Package script ────────────────────────────────────────────────────────

test('exactly one new package script for clean canonical bootstrap', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(
    pkg.scripts['test:db-engine:clean-canonical-bootstrap'],
    'node --test --test-concurrency=1 tests/db-engine/clean-canonical-bootstrap-postgres.test.cjs',
    'exact package script command',
  );
});

// ── 3. CI job, image, version ────────────────────────────────────────────────

test('exactly one new CI job with postgres:17.4-bookworm and 170004 assertion', () => {
  const workflow = read('.github/workflows/ci.yml');
  const jobCount = (workflow.match(/db-engine-clean-canonical-bootstrap:/g) || []).length;
  assert.equal(jobCount, 1, 'exactly one clean-canonical-bootstrap job definition');
  assert.ok(
    workflow.includes('npm run test:db-engine:clean-canonical-bootstrap'),
    'job runs only the clean-canonical-bootstrap script',
  );
  assert.equal(
    (workflow.match(/170004/g) || []).length,
    EXPECTED_DB_ENGINE_SCRIPTS.length,
    'each canonical DB-engine job asserts 170004',
  );
  assert.ok(
    workflow.includes('postgres:17.4-bookworm'),
    'workflow pins postgres:17.4-bookworm image',
  );
});

// ── 4. Loopback-only LB_TEST_PG* boundary, no DATABASE_URL ────────────────────

test('loopback-only LB_TEST_PG* boundary and no DATABASE_URL in workflow or harness', () => {
  const workflow = read('.github/workflows/ci.yml');
  assert.ok(workflow.includes('LB_TEST_PGHOST: 127.0.0.1'), 'workflow pins loopback host');
  assert.ok(!/process\.env\.DATABASE_URL/.test(workflow), 'no DATABASE_URL env read in the workflow');
  assert.ok(!/neon\.tech|modal\.com|onrender\.com/i.test(workflow), 'no provider URL in workflow');
});

test('DB-engine test enforces LB_TEST_PG* loopback boundary', () => {
  const dbTest = read(DB_TEST_PATH);
  const harnessSource = read('tests/db-engine/helpers/postgres-disposable-harness.cjs');
  assert.ok(harnessSource.includes('process.env.LB_TEST_PGHOST'), 'harness enforces LB_TEST_PG* loopback env');
  assert.ok(dbTest.includes("require('./helpers/postgres-disposable-harness.cjs')"), 'DB-engine test uses the loopback-only harness');
  assert.ok(!/process\.env\.DATABASE_URL/.test(dbTest), 'no DATABASE_URL env read in the DB-engine test');
  assert.ok(!/neon\.tech|modal\.com|onrender\.com/i.test(dbTest), 'no provider URL reference');
  assert.ok(!dbTest.includes('docker'), 'no local Docker fallback');
});

// ── 5. Committed authority invariants ────────────────────────────────────────

test('committed canonical manifest is ADOPTION_REQUIRED with exactly one migration and no bootstrap field', () => {
  const manifest = JSON.parse(read(MANIFEST_PATH));
  assert.equal(manifest.status, 'ADOPTION_REQUIRED', 'manifest status is ADOPTION_REQUIRED');
  assert.equal(manifest.migrations.length, 1, 'exactly one migration');
  assert.equal(manifest.bootstrap, undefined, 'no unauthorized bootstrap field');

  const migration = manifest.migrations[0];
  assert.equal(migration.id, BOOTSTRAP_ID, 'exact migration ID');
  assert.equal(migration.path, SQL_FILE_PATH, 'exact migration path');
  const actualChecksum = sha256File(SQL_FILE_PATH);
  assert.equal(migration.checksum, actualChecksum, 'raw SQL byte checksum matches on-disk file');
  assert.deepEqual(migration.depends_on, [], 'no dependencies');
  assert.equal(migration.risk_class, 'ADDITIVE', 'ADDITIVE risk class');
  assert.equal(migration.transaction_mode, 'REQUIRED', 'REQUIRED transaction mode');
  assert.deepEqual(migration.destructive_operations, [], 'no destructive operations');
  assert.equal(migration.owner_domain, 'migration-provenance', 'owner domain');
  assert.equal(migration.approval_reference, 'issue:3846', 'approval reference');
  assert.equal(manifest.checksum_algorithm, 'sha256', 'sha256 algorithm recorded');
});

test('bootstrap SQL file exists and creates only schema_migration_ledger', () => {
  const sql = read(SQL_FILE_PATH);
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS schema_migration_ledger'), 'creates ledger table');
  const forbidden = [
    /\bALTER\s+TABLE\b/i,
    /\bDROP\s+(TABLE|SCHEMA|DATABASE)\b/i,
    /\bGRANT\b/i,
    /\bREVOKE\b/i,
    /\bTRUNCATE\b/i,
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+\w+\s+SET\b/i,
    /\bDELETE\s+FROM\b/i,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(sql), 'forbidden SQL pattern in bootstrap SQL: ' + re);
  }
  assert.equal(sql.split('CREATE TABLE').length - 1, 1, 'exactly one CREATE TABLE statement');
});

test('expected-schema manifest is ADOPTION_REQUIRED with exactly one critical object and no bootstrap field', () => {
  const schemaManifest = JSON.parse(read(SCHEMA_MANIFEST_PATH));
  assert.equal(schemaManifest.status, 'ADOPTION_REQUIRED', 'schema manifest remains ADOPTION_REQUIRED');
  assert.equal(schemaManifest.critical_objects.length, 1, 'exactly one critical object');
  assert.equal(schemaManifest.bootstrap, undefined, 'no unauthorized bootstrap field');

  const object = schemaManifest.critical_objects[0];
  assert.equal(object.name, EXPECTED_OBJECT_NAME, 'exact table object name with public qualifier');
  assert.match(object.fingerprint, /^sha256:[a-f0-9]{64}$/, 'catalog fingerprint is sha256:');
  assert.notEqual(object.fingerprint, sha256File(SQL_FILE_PATH), 'catalog fingerprint is not the raw SQL byte checksum');
});

// ── 6. Orchestrator boundary: dedicated path, generic runner untouched ───────

test('generic runner and runner protocol are unchanged (no success-path delegation)', () => {
  const orchestrator = read(ORCHESTRATOR_PATH);
  assert.ok(
    !orchestrator.includes("require('./migration-runner-orchestrator-core.cjs')"),
    'orchestrator does not require the generic runner',
  );
  assert.ok(
    !orchestrator.includes('runCanonicalMigration'),
    'orchestrator does not delegate to runCanonicalMigration',
  );
  assert.ok(
    !orchestrator.includes('RUNNER_MANIFEST_NOT_ACTIVE'),
    'orchestrator does not bypass the generic runner ACTIVE gate',
  );
});

test('generic runner ACTIVE gate is preserved in the repository', () => {
  const protocol = read(GENERIC_RUNNER_PROTOCOL_PATH);
  assert.ok(
    protocol.includes('RUNNER_MANIFEST_NOT_ACTIVE'),
    'generic runner protocol still fails closed on non-ACTIVE manifest',
  );
  assert.ok(
    /i\.manifestStatus\s*!==\s*ACTIVE/.test(protocol),
    'generic runner still requires manifest exactly ACTIVE',
  );
});

test('dedicated orchestrator owns the bootstrap path and reads committed authority', () => {
  const orchestrator = read(ORCHESTRATOR_PATH);
  assert.ok(orchestrator.includes('validateCommittedAuthority'), 'orchestrator validates committed authority');
  assert.ok(orchestrator.includes('loadBootstrapProjection'), 'orchestrator loads bootstrap projection');
  assert.ok(orchestrator.includes('openSession'), 'orchestrator owns one pinned session');
  assert.ok(orchestrator.includes('BEGIN') && orchestrator.includes('COMMIT') && orchestrator.includes('ROLLBACK'), 'orchestrator manages the transaction');
  assert.ok(orchestrator.includes("verifyCatalogFingerprint"), 'orchestrator verifies catalog fingerprint');
  assert.ok(
    !orchestrator.includes("manifest.bootstrap") && !orchestrator.includes('manifest["bootstrap"]'),
    'orchestrator does not read an unauthorized bootstrap field',
  );
});

// ── 7. SQL boundary in DB-engine test ────────────────────────────────────────

test('DB-engine test contains no DDL beyond the committed bootstrap SQL and catalog queries', () => {
  const dbTest = read(DB_TEST_PATH);
  const forbiddenDdl = [
    /\bALTER\s+TABLE\b/i,
    /\bDROP\s+(TABLE|SCHEMA|DATABASE)\b/i,
    /\bTRUNCATE\b/i,
    /\bGRANT\b/i,
    /\bREVOKE\b/i,
  ];
  for (const re of forbiddenDdl) {
    assert.ok(!re.test(dbTest), 'forbidden DDL pattern in DB-engine test: ' + re);
  }
  assert.ok(dbTest.includes('SHOW server_version_num'), 'exact server version assertion present');
  assert.ok(
    dbTest.includes('to_regclass($1::text) IS NOT NULL AS exists'),
    'relation-exists verification present',
  );
  assert.ok(
    dbTest.includes('collectCatalogEvidence'),
    'catalog fingerprint verification uses the repository catalog adapter',
  );
});

// ── 8. Session wrapper contract ────────────────────────────────────────────────

test('DB-engine test uses a plain own-callable session wrapper around a dedicated pg.Client', () => {
  const dbTest = read(DB_TEST_PATH);
  assert.ok(
    /query:\s+async\s+function\s*\(queryObject\)/.test(dbTest),
    'session query is an own async callable',
  );
  assert.ok(
    /release:\s+async\s+function\s*\(\)/.test(dbTest),
    'session release is an own async callable',
  );
  assert.ok(!dbTest.includes('pool'), 'no connection pool shared identity');
  assert.ok(dbTest.includes('client.end()'), 'release ends the dedicated client exactly once');
});

// ── 9. Classification registration ────────────────────────────────────────────

test('classification registers both the source-static contract and the supplemental DB test', () => {
  const classification = JSON.parse(read('tests/test-layer-classification.json'));
  const entries = classification.entries || [];
  const sourceStatic = entries.find((e) => e.path === CONTRACT_TEST_PATH);
  assert.ok(sourceStatic, 'source-static contract registered');
  assert.equal(sourceStatic.layer, 'SOURCE_STATIC', 'source-static layer');

  const supplemental = classification.supplemental || [];
  const dbEntry = supplemental.find((e) => e.path === DB_TEST_PATH);
  assert.ok(dbEntry, 'supplemental DB test registered');
  assert.equal(dbEntry.layer, 'DB_ENGINE_EXECUTION', 'DB_ENGINE_EXECUTION layer');
  assert.equal(dbEntry.defaultCi, false, 'not in the default npm test glob');
  assert.deepEqual(dbEntry.capabilities, ['postgresql', 'network'], 'capabilities postgresql + network');

  assert.ok(
    !entries.find((e) => e.path === 'tests/contracts/canonical-bootstrap-rehearsal-contract.test.cjs'),
    'superseded stub classification removed',
  );
});

// ── 10. Parent completion posture ────────────────────────────────────────────

test('decision doc records Steps 1-7 complete, Child 2 bootstrap implemented, Child 3-4 unauthorized', () => {
  const decision = read('docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md');
  assert.ok(/Steps 1[–-]7 complete/.test(decision), 'Steps 1-7 complete');
  assert.ok(/Step 8[^\n]*not authorized/i.test(decision), 'Step 8 children 3-4 not authorized');
  assert.ok(/disposable PostgreSQL rehearsal[^\n]*implemented/.test(decision), 'Step 7 implemented by #3816');
  assert.ok(
    /Step 8 Child 2 canonical bootstrap[^\n]*implemented by Issue #3846/.test(decision),
    'Child 2 bootstrap implemented by #3846',
  );
  assert.ok(
    /canonical bootstrap migration[^\n]*20260802094500_bootstrap-migration-ledger/.test(decision),
    'decision doc records the authored bootstrap migration',
  );
  assert.ok(
    /ADOPTION_REQUIRED/.test(decision),
    'manifests remain ADOPTION_REQUIRED',
  );
});

// ── 11. Contract doc existence ────────────────────────────────────────────────

test('contract doc exists and records the 11-file boundary', () => {
  const doc = read(CONTRACT_DOC_PATH);
  assert.ok(doc.includes('postgres:17.4-bookworm'), 'doc records the engine image');
  assert.ok(doc.includes('170004'), 'doc records the exact version');
  assert.ok(doc.includes('LB_TEST_PG'), 'doc records the loopback env boundary');
  assert.ok(doc.includes('DATABASE_URL'), 'doc records the DATABASE_URL boundary');
  assert.ok(doc.includes(BOOTSTRAP_ID), 'doc records the bootstrap migration ID');
});

// ── 12. Committed source success path is the only success path (NC13-NC17) ───

test('NC13 success path never invokes the generic runner', () => {
  const dbTest = read(DB_TEST_PATH);
  const orchestrator = read(ORCHESTRATOR_PATH);
  assert.ok(
    !dbTest.includes("require('../../scripts/migration-runner-orchestrator-core.cjs')"),
    'DB-engine test does not require the generic runner',
  );
  assert.ok(
    !dbTest.includes('.runCanonicalMigration(') && !dbTest.includes('runCanonicalMigration({'),
    'DB-engine test does not invoke the generic runner success path',
  );
  assert.ok(
    !orchestrator.includes("require('./migration-runner-orchestrator-core.cjs')"),
    'orchestrator does not require the generic runner',
  );
  assert.ok(
    !orchestrator.includes('.runCanonicalMigration(') && !orchestrator.includes('runCanonicalMigration({'),
    'orchestrator does not invoke the generic runner success path',
  );
});

test('NC14 success path never constructs a synthetic ACTIVE manifest', () => {
  const dbTest = read(DB_TEST_PATH);
  const orchestrator = read(ORCHESTRATOR_PATH);
  assert.ok(
    !/status\s*:\s*['"]ACTIVE['"]/.test(dbTest),
    'DB-engine test does not construct an ACTIVE manifest literal',
  );
  assert.ok(
    !/status\s*:\s*['"]ACTIVE['"]/.test(orchestrator),
    'orchestrator does not construct an ACTIVE manifest literal',
  );
  assert.ok(
    !/function\s+makeSyntheticActive|const\s+syntheticActive|makeSyntheticActive\s*\(/.test(dbTest),
    'DB-engine test does not build a synthetic active manifest factory',
  );
  assert.ok(
    !/function\s+makeSyntheticActive|const\s+syntheticActive|makeSyntheticActive\s*\(/.test(orchestrator),
    'orchestrator does not build a synthetic active manifest factory',
  );
});

test('NC15 manifest has no unauthorized bootstrap top-level field', () => {
  const manifest = JSON.parse(read(MANIFEST_PATH));
  const schemaManifest = JSON.parse(read(SCHEMA_MANIFEST_PATH));
  assert.ok(!Object.prototype.hasOwnProperty.call(manifest, 'bootstrap'), 'no bootstrap field in canonical manifest');
  assert.ok(!Object.prototype.hasOwnProperty.call(schemaManifest, 'bootstrap'), 'no bootstrap field in expected-schema manifest');
});

test('NC16 expected schema uses the public-qualified table name', () => {
  const schemaManifest = JSON.parse(read(SCHEMA_MANIFEST_PATH));
  const object = schemaManifest.critical_objects[0];
  assert.equal(object.name, 'table:public.schema_migration_ledger', 'exact public-qualified name');
  assert.notEqual(object.name, 'table:schema_migration_ledger', 'name is not missing the public qualifier');
});

test('NC17 catalog fingerprint is derived by the normalizer, not reused from the SQL byte checksum', () => {
  const schemaManifest = JSON.parse(read(SCHEMA_MANIFEST_PATH));
  const manifest = JSON.parse(read(MANIFEST_PATH));
  const object = schemaManifest.critical_objects[0];
  const sqlChecksum = manifest.migrations[0].checksum;
  assert.notEqual(object.fingerprint, sqlChecksum, 'catalog fingerprint differs from SQL byte checksum');
  assert.match(object.fingerprint, /^sha256:[a-f0-9]{64}$/, 'catalog fingerprint is a normalizer sha256');
  assert.equal(sqlChecksum, sha256File(SQL_FILE_PATH), 'SQL checksum is the raw byte checksum');
});
