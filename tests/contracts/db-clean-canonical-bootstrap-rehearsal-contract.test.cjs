'use strict';

/**
 * Source-static contract for Issue #3846 (Step 8 Child 2 clean canonical
 * bootstrap rehearsal). Locks the original eleven-file primary boundary,
 * package script, CI job, PostgreSQL service image/version, loopback-only
 * LB_TEST_PG* boundary, committed-authority invariants (ADOPTION_REQUIRED
 * manifest whose bootstrap migration is selected by exact ID and ledger
 * critical object is selected by exact name, decoupled from total manifest
 * cardinality; no synthetic ACTIVE manifest; no generic-runner success path; no
 * unauthorized `bootstrap` top-level field), orchestrator boundary (dedicated
 * orchestrator owns the bootstrap path; generic runner unchanged),
 * classification entries, and parent completion posture. Real DB behavior
 * belongs to the DB-engine test, which runs only on GitHub Actions; string
 * checks here do not claim DB behavior.
 *
 * The eleven files below are the original primary boundary. The final
 * cumulative PR scope is exactly 24 files: the 11 original files plus the
 * reconciliation/compatibility files plus the authorized CI reconciliation
 * file `tests/db-engine/migration-catalog-postgres-adapter-engine.test.cjs`
 * (the 24th cumulative path).
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
const { createCleanBootstrapRunner, validateCommittedAuthority, selectBootstrapMigration, selectBootstrapCriticalObject, FACTORY_ERRORS, BOOTSTRAP_MIGRATION_PATH } = require('../../scripts/migration-clean-bootstrap-orchestrator-core.cjs');

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

const EXPECTED_FINAL_TWENTY_FOUR = [
  '.github/workflows/ci.yml',
  'db/migration-provenance/canonical-migrations.json',
  'db/migration-provenance/expected-schema-manifest.json',
  'db/migrations/20260802094500_bootstrap-migration-ledger.sql',
  'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md',
  'docs/architecture/db-clean-canonical-bootstrap-rehearsal-contract.md',
  'docs/architecture/db-schema-change-inventory.json',
  'package.json',
  'scripts/expected-schema-candidate-core.cjs',
  'scripts/migration-clean-bootstrap-orchestrator-core.cjs',
  'scripts/report-ci-test-groups.cjs',
  'tests/contracts/adoption-attestation-contract.test.cjs',
  'tests/contracts/adoption-baseline-collection-plan-contract.test.cjs',
  'tests/contracts/db-clean-canonical-bootstrap-rehearsal-contract.test.cjs',
  'tests/contracts/db-migration-canonical-manifest-adapter-contract.test.cjs',
  'tests/contracts/db-migration-clean-target-adoption-decision-contract.test.cjs',
  'tests/contracts/db-migration-identity-order-checksum-contract.test.cjs',
  'tests/contracts/expected-schema-candidate-contract.test.cjs',
  'tests/contracts/migration-catalog-fingerprint-contract.test.cjs',
  'tests/contracts/migration-catalog-postgres-adapter-contract.test.cjs',
  'tests/contracts/migration-provenance-gate-contract.test.cjs',
  'tests/db-engine/clean-canonical-bootstrap-postgres.test.cjs',
  'tests/db-engine/migration-catalog-postgres-adapter-engine.test.cjs',
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

test('original primary boundary of eleven files exists', () => {
  for (const rel of EXPECTED_ELEVEN) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), 'required file exists: ' + rel);
  }
  assert.equal(EXPECTED_ELEVEN.length, 11, 'original primary boundary is eleven files');
  assert.deepEqual(EXPECTED_ELEVEN, EXPECTED_ELEVEN.slice().sort(), 'boundary list is sorted');
  assert.ok(
    fs.existsSync(path.join(ROOT, 'tests/db-engine/migration-catalog-postgres-adapter-engine.test.cjs')),
    'authorized CI reconciliation file is the 24th cumulative path',
  );
  assert.ok(!EXPECTED_ELEVEN.includes('tests/db-engine/migration-catalog-postgres-adapter-engine.test.cjs'), 'reconciliation file is outside the original eleven');
  assert.ok(!fs.existsSync(path.join(ROOT, 'tests/contracts/canonical-bootstrap-rehearsal-contract.test.cjs')), 'superseded stub removed');
  assert.ok(!fs.existsSync(path.join(ROOT, 'tests/db-engine/canonical-bootstrap-rehearsal-postgres.test.cjs')), 'superseded DB test removed');
  assert.ok(!fs.existsSync(path.join(ROOT, 'docs/architecture/canonical-bootstrap-rehearsal-contract.md')), 'superseded contract doc removed');
  // The release manifest is generated by `npm run build` (scripts/build-static.js),
  // which is unrelated to #3846 and outside this contract's cumulative boundary.
  // Whether that artifact currently exists on the filesystem must never decide
  // this contract's outcome, so it is asserted here by source scope and
  // executable authority only: #3846 neither owns the release manifest builder
  // nor references the manifest path from its bootstrap orchestrator.
  assert.ok(
    !EXPECTED_ELEVEN.includes('scripts/build-static.js') &&
      !EXPECTED_ELEVEN.includes('.well-known/release.json'),
    'release manifest builder and artifact are outside the #3846 source scope',
  );
  assert.ok(
    !read(ORCHESTRATOR_PATH).includes('.well-known') &&
      !read(ORCHESTRATOR_PATH).includes('release.json'),
    'orchestrator executable authority never reads or writes the release manifest',
  );
});

// ── 1b. Final authorized 24-path vocabulary ─────────────────────────────────

test('final cumulative scope is the exact authorized 24 repository paths', () => {
  assert.equal(EXPECTED_FINAL_TWENTY_FOUR.length, 24, 'exactly 24 authorized cumulative paths');
  assert.deepEqual(
    EXPECTED_FINAL_TWENTY_FOUR,
    EXPECTED_FINAL_TWENTY_FOUR.slice().sort(),
    'final 24 list is sorted',
  );
  assert.equal(new Set(EXPECTED_FINAL_TWENTY_FOUR).size, 24, 'no duplicate paths in final 24');
  for (const rel of EXPECTED_FINAL_TWENTY_FOUR) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), 'authorized path exists in repository: ' + rel);
  }
  for (const rel of EXPECTED_ELEVEN) {
    assert.ok(
      EXPECTED_FINAL_TWENTY_FOUR.includes(rel),
      'original primary path is inside the final 24: ' + rel,
    );
  }
  assert.ok(
    EXPECTED_FINAL_TWENTY_FOUR.includes('tests/db-engine/migration-catalog-postgres-adapter-engine.test.cjs'),
    'authorized DB-engine reconciliation path is included',
  );
  assert.ok(
    !EXPECTED_FINAL_TWENTY_FOUR.includes('.well-known/release.json') &&
      !EXPECTED_FINAL_TWENTY_FOUR.includes('scripts/build-static.js'),
    'release manifest builder and artifact are outside the authorized 24',
  );
  const outOfScope = EXPECTED_FINAL_TWENTY_FOUR.filter(function (rel) {
    return /home|scout|browser|playwright|viewport/i.test(rel);
  });
  assert.deepEqual(outOfScope, [], 'no Home/Scout/browser files in the authorized 24');
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

test('committed canonical manifest is ADOPTION_REQUIRED and selects bootstrap migration by exact ID', () => {
  const manifest = JSON.parse(read(MANIFEST_PATH));
  assert.equal(manifest.status, 'ADOPTION_REQUIRED', 'manifest status is ADOPTION_REQUIRED');
  assert.equal(manifest.bootstrap, undefined, 'no unauthorized bootstrap field');

  const migration = selectBootstrapMigration(manifest);
  assert.equal(migration.id, BOOTSTRAP_ID, 'bootstrap selected by exact ID');
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

test('expected-schema manifest is ADOPTION_REQUIRED and selects ledger object by exact name', () => {
  const schemaManifest = JSON.parse(read(SCHEMA_MANIFEST_PATH));
  assert.equal(schemaManifest.status, 'ADOPTION_REQUIRED', 'schema manifest remains ADOPTION_REQUIRED');
  assert.equal(schemaManifest.bootstrap, undefined, 'no unauthorized bootstrap field');

  const object = selectBootstrapCriticalObject(schemaManifest);
  assert.equal(object.name, EXPECTED_OBJECT_NAME, 'exact table object name with public qualifier');
  assert.match(object.fingerprint, /^sha256:[a-f0-9]{64}$/, 'catalog fingerprint is sha256:');
  assert.notEqual(object.fingerprint, sha256File(SQL_FILE_PATH), 'catalog fingerprint is not the raw SQL byte checksum');
});

// ── 5b. Bootstrap identity-selection contract (decoupled from cardinality) ─

function makeValidBootstrapEntry() {
  return {
    id: BOOTSTRAP_ID,
    name: 'bootstrap-migration-ledger',
    path: SQL_FILE_PATH,
    checksum: sha256File(SQL_FILE_PATH),
    depends_on: [],
    risk_class: 'ADDITIVE',
    transaction_mode: 'REQUIRED',
    destructive_operations: [],
    owner_domain: 'migration-provenance',
    approval_reference: 'issue:3846',
  };
}

function makeValidLedgerObject() {
  return { name: EXPECTED_OBJECT_NAME, fingerprint: 'sha256:' + 'a'.repeat(64) };
}

function makeSyntheticManifest(migrations) {
  return { status: 'ADOPTION_REQUIRED', checksum_algorithm: 'sha256', migrations: migrations };
}

function makeSyntheticSchemaManifest(objects) {
  return { status: 'ADOPTION_REQUIRED', fingerprint_algorithm: 'sha256', critical_objects: objects };
}

function makeLaterMigration() {
  return {
    id: '20270101000000_later-feature',
    name: 'later-feature',
    path: 'db/migrations/20270101000000_later-feature.sql',
    checksum: 'sha256:' + 'b'.repeat(64),
    risk_class: 'ADDITIVE',
    transaction_mode: 'REQUIRED',
    destructive_operations: [],
    approval_reference: 'issue:9999',
  };
}

function makeLaterObject() {
  return { name: 'table:public.some_later_table', fingerprint: 'sha256:' + 'c'.repeat(64) };
}

test('A current one-entry compatibility: committed manifest selects bootstrap projection', () => {
  const manifest = JSON.parse(read(MANIFEST_PATH));
  const schemaManifest = JSON.parse(read(SCHEMA_MANIFEST_PATH));
  const migration = selectBootstrapMigration(manifest);
  const object = selectBootstrapCriticalObject(schemaManifest);
  assert.equal(migration.id, BOOTSTRAP_ID, 'bootstrap selected by exact ID');
  assert.equal(object.name, EXPECTED_OBJECT_NAME, 'ledger selected by exact name');
  const projection = validateCommittedAuthority(manifest, schemaManifest);
  assert.equal(projection.migrationId, BOOTSTRAP_ID, 'projection uses selected bootstrap');
  assert.equal(projection.criticalObjectName, EXPECTED_OBJECT_NAME, 'projection uses selected ledger object');
});

test('B multi-entry positive control: only bootstrap identity is selected', () => {
  const manifest = makeSyntheticManifest([makeValidBootstrapEntry(), makeLaterMigration()]);
  const selected = selectBootstrapMigration(manifest);
  assert.equal(selected.id, BOOTSTRAP_ID, 'bootstrap selected, not later migration');

  const schemaManifest = makeSyntheticSchemaManifest([makeValidLedgerObject(), makeLaterObject()]);
  const selectedObject = selectBootstrapCriticalObject(schemaManifest);
  assert.equal(selectedObject.name, EXPECTED_OBJECT_NAME, 'ledger selected, not later object');

  const projection = validateCommittedAuthority(manifest, schemaManifest);
  assert.equal(projection.migrationId, BOOTSTRAP_ID, 'projection built from selected bootstrap only');
});

test('C missing bootstrap migration fails closed', () => {
  const manifest = makeSyntheticManifest([makeLaterMigration()]);
  assert.throws(function () { selectBootstrapMigration(manifest); }, function (e) {
    return e.message === FACTORY_ERRORS.MIGRATION_NOT_FOUND;
  });
});

test('D duplicate bootstrap migration fails closed', () => {
  const manifest = makeSyntheticManifest([makeValidBootstrapEntry(), makeValidBootstrapEntry()]);
  assert.throws(function () { selectBootstrapMigration(manifest); }, function (e) {
    return e.message === FACTORY_ERRORS.MIGRATION_ID_INVALID;
  });
});

test('E missing ledger critical object fails closed', () => {
  const schemaManifest = makeSyntheticSchemaManifest([makeLaterObject()]);
  assert.throws(function () { selectBootstrapCriticalObject(schemaManifest); }, function (e) {
    return e.message === FACTORY_ERRORS.CRITICAL_OBJECT_NAME_INVALID;
  });
});

test('F duplicate ledger critical object fails closed', () => {
  const schemaManifest = makeSyntheticSchemaManifest([makeValidLedgerObject(), makeValidLedgerObject()]);
  assert.throws(function () { selectBootstrapCriticalObject(schemaManifest); }, function (e) {
    return e.message === FACTORY_ERRORS.CRITICAL_OBJECT_NAME_INVALID;
  });
});

// ── 5c. Manifest path portability (#4177) ────────────────────────────────────
//
// The canonical manifest's repository-relative path authority is POSIX slash
// form. These tests pin the OS-independence contract: the orchestrator must
// compare manifest identity paths as forward-slash strings on every platform,
// while real filesystem resolution stays native and every security invariant
// (traversal rejection, realpath containment, checksum verification) is
// preserved. No test-string weakening: the negative controls exercise the
// real validateCommittedAuthority code path.

test('P1 bootstrap path authority is always POSIX forward-slash regardless of platform', () => {
  assert.equal(BOOTSTRAP_MIGRATION_PATH, SQL_FILE_PATH,
    'orchestrator path authority equals the committed POSIX manifest path');
  assert.ok(!BOOTSTRAP_MIGRATION_PATH.includes('\\'),
    'path authority never contains a backslash, even on Windows');
  const manifest = JSON.parse(read(MANIFEST_PATH));
  const migration = selectBootstrapMigration(manifest);
  assert.equal(migration.path, BOOTSTRAP_MIGRATION_PATH,
    'committed manifest entry matches the orchestrator authority byte-for-byte on Windows-native runs');
});

test('P2 backslash/noncanonical manifest paths still fail closed', () => {
  const schemaManifest = makeSyntheticSchemaManifest([makeValidLedgerObject()]);
  const windowsStyle = makeValidBootstrapEntry();
  windowsStyle.path = 'db\\migrations\\20260802094500_bootstrap-migration-ledger.sql';
  assert.throws(function () { validateCommittedAuthority(makeSyntheticManifest([windowsStyle]), schemaManifest); },
    function (e) { return e.message === FACTORY_ERRORS.MIGRATION_PATH_INVALID; },
    'backslash manifest path is rejected, not silently normalized');

  const traversal = makeValidBootstrapEntry();
  traversal.path = 'db/migrations/../../secrets/20260802094500_bootstrap-migration-ledger.sql';
  assert.throws(function () { validateCommittedAuthority(makeSyntheticManifest([traversal]), schemaManifest); },
    function (e) { return e.message === FACTORY_ERRORS.MIGRATION_PATH_INVALID; },
    'non-canonical traversal path is rejected before any filesystem access');

  const absolute = makeValidBootstrapEntry();
  absolute.path = SQL_FILE_PATH.toUpperCase();
  assert.throws(function () { validateCommittedAuthority(makeSyntheticManifest([absolute]), schemaManifest); },
    function (e) { return e.message === FACTORY_ERRORS.MIGRATION_PATH_INVALID; },
    'case-mutated path authority is rejected (exact string identity)');
});

test('P3 valid POSIX authority passes with all security invariants intact on Windows-native execution', () => {
  const manifest = JSON.parse(read(MANIFEST_PATH));
  const schemaManifest = JSON.parse(read(SCHEMA_MANIFEST_PATH));
  const projection = validateCommittedAuthority(manifest, schemaManifest);
  assert.equal(projection.migrationPath, SQL_FILE_PATH, 'projection keeps POSIX path identity');
  assert.equal(projection.checksum, sha256File(SQL_FILE_PATH), 'checksum verification still binds to the real file');
  assert.ok(fs.realpathSync(path.join(ROOT, projection.migrationPath)).startsWith(fs.realpathSync(ROOT) + path.sep),
    'realized file stays inside the repository root (containment intact)');
});

test('G later migration with sentinel bad values never becomes executable authority', () => {
  const sentinel = {
    id: '20270101000000_later-feature',
    name: 'later-feature',
    path: 'db/migrations/NONEXISTENT_sentinel.sql',
    checksum: 'sha256:deadbeef' + '0'.repeat(56),
    risk_class: 'DESTRUCTIVE',
    transaction_mode: 'REQUIRED',
    destructive_operations: ['DROP TABLE something'],
    approval_reference: 'issue:0000',
  };
  const manifest = makeSyntheticManifest([makeValidBootstrapEntry(), sentinel]);
  const selected = selectBootstrapMigration(manifest);
  assert.equal(selected.id, BOOTSTRAP_ID, 'selection ignores the sentinel later entry');
  assert.notEqual(selected.path, sentinel.path, 'sentinel path is never selected');
  assert.notEqual(selected.checksum, sentinel.checksum, 'sentinel checksum is never selected');

  const schemaManifest = makeSyntheticSchemaManifest([makeValidLedgerObject()]);
  assert.doesNotThrow(function () { validateCommittedAuthority(manifest, schemaManifest); }, 'projection authority unaffected by later sentinel entry');
  const projection = validateCommittedAuthority(manifest, schemaManifest);
  assert.equal(projection.migrationId, BOOTSTRAP_ID, 'projection authority is the bootstrap migration');
  assert.equal(projection.checksum, sha256File(SQL_FILE_PATH), 'projection checksum is the real bootstrap SQL checksum');
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

// ── 10b. Next-child decision posture (current decision section) ──────────────

const NEXT_CHILD_DECISION_PATH = 'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md';
const HISTORICAL_SPLIT = '### Superseded historical selection retained for audit compatibility';

function currentDecisionSection() {
  const decision = read(NEXT_CHILD_DECISION_PATH);
  const index = decision.indexOf(HISTORICAL_SPLIT);
  return index === -1 ? decision : decision.slice(0, index);
}

test('next-child decision selects read-only target attribution & catalog parity as the only next child', () => {
  const posture = currentDecisionSection();
  assert.ok(/Step 8 Child 3/i.test(posture), 'decision identifies Step 8 Child 3');
  assert.ok(/target attribution/i.test(posture), 'decision identifies target attribution');
  assert.ok(/catalog parity/i.test(posture), 'decision identifies read-only catalog parity');
  assert.ok(/only next child/i.test(posture), 'Child 3 selected as the only next child');
  assert.ok(/not implemented by PR #3857/.test(posture), 'Child 3 not implemented by PR #3857');
  assert.ok(/not runtime-authorized by PR #3857/.test(posture), 'Child 3 not runtime-authorized by PR #3857');
  assert.ok(
    /READ_ONLY_TARGET_ATTRIBUTION_CATALOG_PARITY_SELECTED/.test(posture),
    'decision records the exact selected marker',
  );
  assert.ok(/IMPLEMENTED BY #3846/.test(posture), 'Child 2 implemented by #3846');
  assert.ok(
    /pending Web CTO merge\/closure until PR #3857 merges/.test(posture),
    'Child 2 pending Web CTO merge/closure until PR #3857 merges',
  );
  assert.ok(/populated but ADOPTION_REQUIRED/.test(posture), 'committed manifests populated but ADOPTION_REQUIRED');
});

test('next-child decision marker appears exactly once in the document', () => {
  const decision = read(NEXT_CHILD_DECISION_PATH);
  const matches = decision.match(/READ_ONLY_TARGET_ATTRIBUTION_CATALOG_PARITY_SELECTED/g) || [];
  assert.equal(matches.length, 1, 'exactly one occurrence of the selected marker');
});

test('next-child decision preserves non-implementation posture', () => {
  const posture = currentDecisionSection();
  assert.ok(/Step 8 Child 4/i.test(posture), 'Child 4 identified');
  assert.ok(/not authorized/i.test(posture), 'Child 4 not authorized');
  assert.ok(/#3458/.test(posture), '#3458 referenced');
  assert.ok(/#3460/.test(posture) && /#3458/.test(posture), '#3460 waits for #3458 completion');
  assert.ok(/DEFERRED_NOT_REJECTED/.test(posture), 'legacy posture DEFERRED_NOT_REJECTED');
  assert.ok(/ADOPTION_REQUIRED/.test(posture), 'manifests remain ADOPTION_REQUIRED');
  assert.ok(/NONE/.test(posture), 'no provider/Production/target binding and no ACTIVE transition');
  assert.ok(
    /not an implementation authorization|not an implementation or runtime authorization/i.test(posture),
    'Child 3 selection is not an implementation authorization',
  );
});

test('next-child decision removes stale pre-implementation phrases from the current posture', () => {
  const posture = currentDecisionSection();
  assert.ok(
    !posture.includes('No exact Child 2 migration identity, timestamp, slug, filename, SQL body, or DDL sequence pre-determined'),
    'no stale Child 2 identity pre-determination phrase',
  );
  assert.ok(
    !posture.includes('Step 8 Child 3 target attribution & read-only catalog parity preflight not authorized'),
    'no stale Child 3 not-authorized phrase',
  );
  assert.ok(
    !posture.includes('+canonical bootstrap migration'),
    'no accidental literal +canonical bootstrap migration phrase',
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
  const object = selectBootstrapCriticalObject(schemaManifest);
  assert.equal(object.name, 'table:public.schema_migration_ledger', 'exact public-qualified name');
  assert.notEqual(object.name, 'table:schema_migration_ledger', 'name is not missing the public qualifier');
});

test('NC17 catalog fingerprint is derived by the normalizer, not reused from the SQL byte checksum', () => {
  const schemaManifest = JSON.parse(read(SCHEMA_MANIFEST_PATH));
  const manifest = JSON.parse(read(MANIFEST_PATH));
  const object = selectBootstrapCriticalObject(schemaManifest);
  const sqlChecksum = selectBootstrapMigration(manifest).checksum;
  assert.notEqual(object.fingerprint, sqlChecksum, 'catalog fingerprint differs from SQL byte checksum');
  assert.match(object.fingerprint, /^sha256:[a-f0-9]{64}$/, 'catalog fingerprint is a normalizer sha256');
  assert.equal(sqlChecksum, sha256File(SQL_FILE_PATH), 'SQL checksum is the raw byte checksum');
});

// ── 13. verifyCleanTarget dependency and config authority ──────────

test('orchestrator requires verifyCleanTarget as a dependency', () => {
  const orchestrator = read(ORCHESTRATOR_PATH);
  assert.ok(orchestrator.includes('verifyCleanTarget'), 'orchestrator requires verifyCleanTarget dependency');
  assert.ok(orchestrator.includes('REQUIRED_RUN_DEPENDENCIES'), 'orchestrator declares required run dependencies');
});

test('orchestrator validates exact operation, target class, and approval before session open', () => {
  const orchestrator = read(ORCHESTRATOR_PATH);
  assert.ok(orchestrator.includes('BOOTSTRAP_CLEAN_CANONICAL_LEDGER'), 'orchestrator validates exact operation');
  assert.ok(orchestrator.includes('DISPOSABLE_POSTGRES_REHEARSAL_TARGET'), 'orchestrator validates exact target class');
  assert.ok(orchestrator.includes('issue:3846'), 'orchestrator validates exact approval reference');
  assert.ok(orchestrator.includes('OPERATION_INVALID'), 'orchestrator uses OPERATION_INVALID fixed code');
  assert.ok(orchestrator.includes('TARGET_CLASS_INVALID'), 'orchestrator uses TARGET_CLASS_INVALID fixed code');
  assert.ok(orchestrator.includes('APPROVAL_INVALID'), 'orchestrator uses APPROVAL_INVALID fixed code');
});

test('orchestrator calls verifyCleanTarget before BEGIN', () => {
  const orchestrator = read(ORCHESTRATOR_PATH);
  const verifyCleanTargetIndex = orchestrator.indexOf('verifyCleanTarget');
  const beginIndex = orchestrator.indexOf("'BEGIN'");
  assert.ok(verifyCleanTargetIndex > -1, 'verifyCleanTarget is present');
  assert.ok(beginIndex > -1, 'BEGIN is present');
  assert.ok(verifyCleanTargetIndex < beginIndex, 'verifyCleanTarget is called before BEGIN');
});

test('orchestrator uses COMMITTED_POST_VERIFICATION_FAILED for post-commit failures', () => {
  const orchestrator = read(ORCHESTRATOR_PATH);
  assert.ok(orchestrator.includes('COMMITTED_POST_VERIFICATION_FAILED'), 'orchestrator reports post-commit failures truthfully');
  assert.ok(orchestrator.includes('postCommitResidualVerified'), 'orchestrator includes postCommitResidualVerified in result');
});

test('orchestrator does not leak raw dependency errors in blockers', () => {
  const orchestrator = read(ORCHESTRATOR_PATH);
  assert.ok(!orchestrator.includes('String(error'), 'orchestrator does not use String(error)');
  assert.ok(!orchestrator.includes('String(error.message'), 'orchestrator does not use String(error.message)');
  assert.ok(!orchestrator.includes('error.stack'), 'orchestrator does not expose error.stack');
  assert.ok(!orchestrator.includes("error.message ? error.message : error"), 'orchestrator does not leak raw error message');
});

test('orchestrator uses sanitized fixed codes for all failure outcomes', () => {
  const orchestrator = read(ORCHESTRATOR_PATH);
  assert.ok(orchestrator.includes('CLEAN_TARGET_VERIFICATION_FAILED'), 'orchestrator uses CLEAN_TARGET_VERIFICATION_FAILED');
  assert.ok(orchestrator.includes('TRANSACTION_FAILED'), 'orchestrator uses TRANSACTION_FAILED');
  assert.ok(orchestrator.includes('LEDGER_VERIFICATION_FAILED'), 'orchestrator uses LEDGER_VERIFICATION_FAILED');
  assert.ok(orchestrator.includes('CATALOG_FINGERPRINT_POST_COMMIT_FAILED'), 'orchestrator uses CATALOG_FINGERPRINT_POST_COMMIT_FAILED');
  assert.ok(orchestrator.includes('RESIDUAL_STATE_POST_COMMIT_FAILED'), 'orchestrator uses RESIDUAL_STATE_POST_COMMIT_FAILED');
});

// ── 14. Fake-based integration tests (NC18-NC23) ──────────────────

function makeFakeSession(tracking) {
  tracking = tracking || {};
  return {
    query: async function (queryObject) {
      if (tracking.queryCount !== undefined) tracking.queryCount++;
      const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
      if (text === 'BEGIN') return { rows: [] };
      if (/INSERT INTO schema_migration_ledger/i.test(text)) return { rows: [] };
      if (/SELECT to_regclass/i.test(text)) return { rows: [{ exists: true }] };
      if (/SELECT COUNT\(\*\)/i.test(text)) return { rows: [{ count: 1 }] };
      if (text === 'COMMIT') return { rows: [] };
      if (text === 'ROLLBACK') return { rows: [] };
      return { rows: [] };
    },
    release: async function () {},
  };
}

function makeFakeDeps(overrides) {
  const defaults = {
    openSession: async function () { return makeFakeSession(); },
    verifyCleanTarget: async function () { return true; },
    verifyCatalogFingerprint: async function () { return true; },
    verifyNoResidualState: async function () { return true; },
    now: async function () { return new Date().toISOString(); },
  };
  if (overrides) {
    for (const key of Object.keys(overrides)) {
      defaults[key] = overrides[key];
    }
  }
  return defaults;
}

function makeValidConfig(overrides) {
  const base = {
    runnerVersion: 'v1',
    environmentClass: 'disposable-test',
    deployedCommit: '0000000000000000000000000000000000',
    operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
    targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
    approvalReference: 'issue:3846',
  };
  if (overrides) {
    for (const key of Object.keys(overrides)) {
      base[key] = overrides[key];
    }
  }
  return base;
}

test('NC18 unknown top-level config key is rejected', async () => {
  let sessionOpenCount = 0;
  const deps = makeFakeDeps({
    openSession: async function () { sessionOpenCount++; return makeFakeSession(); },
  });
  const config = makeValidConfig({ unknownField: 'should-not-be-accepted', dependencies: deps });
  const runner = createCleanBootstrapRunner(config);
  const result = await runner.run();
  assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'unknown config key rejected');
  assert.equal(sessionOpenCount, 0, 'session open 0 for unknown config key');
});

test('NC19 unknown dependency key is rejected', async () => {
  let sessionOpenCount = 0;
  const deps = makeFakeDeps({
    openSession: async function () { sessionOpenCount++; return makeFakeSession(); },
    unknownDep: async function () {},
  });
  const config = makeValidConfig({ dependencies: deps });
  const runner = createCleanBootstrapRunner(config);
  const result = await runner.run();
  assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'unknown dependency key rejected');
  assert.equal(sessionOpenCount, 0, 'session open 0 for unknown dependency key');
});

test('NC20 config getter execution count is zero', async () => {
  let getterCount = 0;
  const config = makeValidConfig();
  Object.defineProperty(config, 'runnerVersion', {
    get: function () { getterCount++; return 'v1'; },
    enumerable: true,
    configurable: true,
  });
  const runner = createCleanBootstrapRunner(config);
  const result = await runner.run();
  assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'config with getter is rejected');
  assert.equal(getterCount, 0, 'config getter execution count is zero');
});

test('NC21 dependency getter execution count is zero', async () => {
  let getterCount = 0;
  const deps = makeFakeDeps();
  Object.defineProperty(deps, 'openSession', {
    get: function () { getterCount++; return async function () { return makeFakeSession(); }; },
    enumerable: true,
    configurable: true,
  });
  const config = makeValidConfig({ dependencies: deps });
  const runner = createCleanBootstrapRunner(config);
  const result = await runner.run();
  assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'dependency with getter is rejected');
  assert.equal(getterCount, 0, 'dependency getter execution count is zero');
});

test('NC22 throwing Proxy on dependencies results in session open 0 and raw error leakage 0', async () => {
  let sessionOpenCount = 0;
  const realDeps = makeFakeDeps({
    openSession: async function () { sessionOpenCount++; return makeFakeSession(); },
  });
  const throwingDeps = new Proxy(realDeps, {
    ownKeys: function () {
      throw new Error('raw proxy trap error');
    },
  });
  const config = makeValidConfig({ dependencies: throwingDeps });
  const runner = createCleanBootstrapRunner(config);
  const result = await runner.run();
  assert.equal(sessionOpenCount, 0, 'session open 0 for throwing proxy');
  assert.equal(result.blockers.length, 1, 'one blocker reported');
  assert.equal(result.blockers[0], 'CLEAN_BOOTSTRAP_DEPENDENCY_MISSING', 'sanitized fixed code, no raw error');
  assert.ok(!result.blockers[0].includes('raw proxy trap error'), 'no raw error leakage');
});

test('NC23 fingerprint failure after COMMIT returns catalogFingerprintVerified false', async () => {
  let commitCount = 0;
  let rollbackCount = 0;
  const trackingSession = {
    query: async function (queryObject) {
      const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
      if (text === 'COMMIT') commitCount++;
      if (text === 'ROLLBACK') rollbackCount++;
      if (text === 'BEGIN') return { rows: [] };
      if (/INSERT INTO schema_migration_ledger/i.test(text)) return { rows: [] };
      if (/SELECT to_regclass/i.test(text)) return { rows: [{ exists: true }] };
      if (/SELECT COUNT\(\*\)/i.test(text)) return { rows: [{ count: 1 }] };
      return { rows: [] };
    },
    release: async function () {},
  };
  const deps = makeFakeDeps({
    openSession: async function () { return trackingSession; },
    verifyCatalogFingerprint: async function () { return false; },
  });
  const config = makeValidConfig({ dependencies: deps });
  const runner = createCleanBootstrapRunner(config);
  const result = await runner.run();
  assert.equal(result.outcome, 'COMMITTED_POST_VERIFICATION_FAILED', 'fingerprint failure reports truthfully');
  assert.equal(result.ledgerAppended, true, 'ledgerAppended true after commit');
  assert.equal(result.catalogFingerprintVerified, false, 'catalogFingerprintVerified false on fingerprint failure');
  assert.equal(result.postCommitResidualVerified, false, 'postCommitResidualVerified false');
  assert.equal(commitCount, 1, 'COMMIT called once');
  assert.equal(rollbackCount, 0, 'ROLLBACK called zero times');
});

test('NC24 residual failure after successful fingerprint returns correct flags', async () => {
  let commitCount = 0;
  let rollbackCount = 0;
  const trackingSession = {
    query: async function (queryObject) {
      const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
      if (text === 'COMMIT') commitCount++;
      if (text === 'ROLLBACK') rollbackCount++;
      if (text === 'BEGIN') return { rows: [] };
      if (/INSERT INTO schema_migration_ledger/i.test(text)) return { rows: [] };
      if (/SELECT to_regclass/i.test(text)) return { rows: [{ exists: true }] };
      if (/SELECT COUNT\(\*\)/i.test(text)) return { rows: [{ count: 1 }] };
      return { rows: [] };
    },
    release: async function () {},
  };
  const deps = makeFakeDeps({
    openSession: async function () { return trackingSession; },
    verifyNoResidualState: async function () { return false; },
  });
  const config = makeValidConfig({ dependencies: deps });
  const runner = createCleanBootstrapRunner(config);
  const result = await runner.run();
  assert.equal(result.outcome, 'COMMITTED_POST_VERIFICATION_FAILED', 'residual failure reports truthfully');
  assert.equal(result.ledgerAppended, true, 'ledgerAppended true after commit');
  assert.equal(result.catalogFingerprintVerified, true, 'catalogFingerprintVerified true (fingerprint succeeded)');
  assert.equal(result.postCommitResidualVerified, false, 'postCommitResidualVerified false');
  assert.equal(commitCount, 1, 'COMMIT called once');
  assert.equal(rollbackCount, 0, 'ROLLBACK called zero times');
});

test('NC25 pre-commit transaction failure rolls back exactly once', async () => {
  let rollbackCount = 0;
  let commitCount = 0;
  let queryCount = 0;
  const trackingSession = {
    query: async function (queryObject) {
      queryCount++;
      const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
      if (text === 'COMMIT') commitCount++;
      if (text === 'ROLLBACK') rollbackCount++;
      if (text === 'BEGIN') return { rows: [] };
      if (/INSERT INTO schema_migration_ledger/i.test(text)) {
        throw new Error('CLEAN_BOOTSTRAP_INJECTED_SQL_FAILURE');
      }
      if (/SELECT to_regclass/i.test(text)) return { rows: [{ exists: true }] };
      if (/SELECT COUNT\(\*\)/i.test(text)) return { rows: [{ count: 1 }] };
      return { rows: [] };
    },
    release: async function () {},
  };
  const deps = makeFakeDeps({
    openSession: async function () { return trackingSession; },
  });
  const config = makeValidConfig({ dependencies: deps });
  const runner = createCleanBootstrapRunner(config);
  const result = await runner.run();
  assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'pre-commit failure reports BLOCKED_BEFORE_COMMIT');
  assert.equal(rollbackCount, 1, 'rollback exactly once');
  assert.equal(commitCount, 0, 'commit zero times');
  assert.equal(result.ledgerAppended, false, 'no ledger row appended');
});

test('NC26 post-commit failure rolls back zero times', async () => {
  let rollbackCount = 0;
  let commitCount = 0;
  const trackingSession = {
    query: async function (queryObject) {
      const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
      if (text === 'COMMIT') commitCount++;
      if (text === 'ROLLBACK') rollbackCount++;
      if (text === 'BEGIN') return { rows: [] };
      if (/INSERT INTO schema_migration_ledger/i.test(text)) return { rows: [] };
      if (/SELECT to_regclass/i.test(text)) return { rows: [{ exists: true }] };
      if (/SELECT COUNT\(\*\)/i.test(text)) return { rows: [{ count: 1 }] };
      return { rows: [] };
    },
    release: async function () {},
  };
  const deps = makeFakeDeps({
    openSession: async function () { return trackingSession; },
    verifyCatalogFingerprint: async function () { return false; },
  });
  const config = makeValidConfig({ dependencies: deps });
  const runner = createCleanBootstrapRunner(config);
  const result = await runner.run();
  assert.equal(result.outcome, 'COMMITTED_POST_VERIFICATION_FAILED', 'post-commit failure reports truthfully');
  assert.equal(rollbackCount, 0, 'rollback zero times after commit');
  assert.equal(commitCount, 1, 'commit once');
  assert.equal(result.ledgerAppended, true, 'ledgerAppended true after commit');
});

// ── 15. Proxy attack scenarios (descriptor-safe capture) ──────────

test('NC27 throwing getPrototypeOf config Proxy: factory/run raw throw 0, session open 0, fixed sanitized result', async () => {
  let sessionOpenCount = 0;
  const baseConfig = makeValidConfig({
    dependencies: makeFakeDeps({
      openSession: async function () { sessionOpenCount++; return makeFakeSession(); },
    }),
  });
  const configProxy = new Proxy(baseConfig, {
    getPrototypeOf: function () {
      throw new Error('RAW_GET_PROTOTYPE_OF_TRAP');
    },
  });
  assert.doesNotThrow(function () { createCleanBootstrapRunner(configProxy); }, 'factory does not leak a raw Proxy exception');
  const runner = createCleanBootstrapRunner(configProxy);
  const result = await runner.run();
  assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'fixed sanitized result');
  assert.equal(result.blockers.length, 1, 'one blocker reported');
  assert.ok(Object.values(FACTORY_ERRORS).includes(result.blockers[0]), 'blocker is a fixed sanitized code');
  assert.ok(!result.blockers[0].includes('RAW_GET_PROTOTYPE_OF_TRAP'), 'no raw exception leakage');
  assert.equal(sessionOpenCount, 0, 'session open 0');
});

test('NC28 throwing ownKeys config Proxy: session open 0, raw leakage 0', async () => {
  let sessionOpenCount = 0;
  const baseConfig = makeValidConfig({
    dependencies: makeFakeDeps({
      openSession: async function () { sessionOpenCount++; return makeFakeSession(); },
    }),
  });
  const configProxy = new Proxy(baseConfig, {
    ownKeys: function () {
      throw new Error('RAW_OWNKEYS_CONFIG_TRAP');
    },
  });
  const runner = createCleanBootstrapRunner(configProxy);
  const result = await runner.run();
  assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'sanitized result');
  assert.equal(result.blockers.length, 1, 'one blocker reported');
  assert.ok(Object.values(FACTORY_ERRORS).includes(result.blockers[0]), 'blocker is a fixed sanitized code');
  assert.ok(!result.blockers[0].includes('RAW_OWNKEYS_CONFIG_TRAP'), 'no raw leakage');
  assert.equal(sessionOpenCount, 0, 'session open 0');
});

test('NC29 throwing getOwnPropertyDescriptor config Proxy: session open 0, raw leakage 0', async () => {
  let sessionOpenCount = 0;
  const baseConfig = makeValidConfig({
    dependencies: makeFakeDeps({
      openSession: async function () { sessionOpenCount++; return makeFakeSession(); },
    }),
  });
  const configProxy = new Proxy(baseConfig, {
    getOwnPropertyDescriptor: function () {
      throw new Error('RAW_GET_OWN_PROPERTY_DESCRIPTOR_TRAP');
    },
  });
  const runner = createCleanBootstrapRunner(configProxy);
  const result = await runner.run();
  assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'sanitized result');
  assert.equal(result.blockers.length, 1, 'one blocker reported');
  assert.ok(Object.values(FACTORY_ERRORS).includes(result.blockers[0]), 'blocker is a fixed sanitized code');
  assert.ok(!result.blockers[0].includes('RAW_GET_OWN_PROPERTY_DESCRIPTOR_TRAP'), 'no raw leakage');
  assert.equal(sessionOpenCount, 0, 'session open 0');
});

test('NC30 descriptor-pass get-trap dependencies Proxy: get trap invocation 0, runs via captured references', async () => {
  let getTrapCount = 0;
  let sessionOpenCount = 0;
  const realDeps = makeFakeDeps({
    openSession: async function () { sessionOpenCount++; return makeFakeSession(); },
  });
  const depsProxy = new Proxy(realDeps, {
    get: function () {
      getTrapCount++;
      throw new Error('RAW_DEPENDENCY_GET_TRAP');
    },
  });
  const config = makeValidConfig({ dependencies: depsProxy });
  const runner = createCleanBootstrapRunner(config);
  const result = await runner.run();
  assert.equal(getTrapCount, 0, 'dependency get trap invocation 0');
  assert.equal(result.outcome, 'BOOTSTRAPPED', 'runs normally via captured openSession');
  assert.equal(sessionOpenCount, 1, 'session open via captured openSession');
  assert.equal(result.ledgerAppended, true, 'ledger row appended');
  assert.equal(result.catalogFingerprintVerified, true, 'catalog fingerprint verified');
});

test('NC31 descriptor-pass get-trap config Proxy: config get trap invocation 0', async () => {
  let getTrapCount = 0;
  const baseConfig = makeValidConfig({ dependencies: makeFakeDeps() });
  const configProxy = new Proxy(baseConfig, {
    get: function () {
      getTrapCount++;
      throw new Error('RAW_CONFIG_GET_TRAP');
    },
  });
  const runner = createCleanBootstrapRunner(configProxy);
  const result = await runner.run();
  assert.equal(getTrapCount, 0, 'config get trap invocation 0');
  assert.equal(result.outcome, 'BOOTSTRAPPED', 'runs via descriptor-safe capture');
  assert.equal(result.ledgerAppended, true, 'ledger row appended');
});

// ── 16. Source negative controls: no direct config.* / deps.* reads ──────────

test('NC32 orchestrator leaves no direct config.* or deps.* property reads in executable core', () => {
  const orchestrator = read(ORCHESTRATOR_PATH);
  const forbiddenDirectReads = [
    'config.runnerVersion',
    'config.environmentClass',
    'config.deployedCommit',
    'config.dependencies',
    'config.operation',
    'config.targetClass',
    'config.approvalReference',
    'deps.openSession',
    'deps.verifyCleanTarget',
    'deps.verifyCatalogFingerprint',
    'deps.verifyNoResidualState',
    'deps.now',
    'deps[name]',
  ];
  for (const needle of forbiddenDirectReads) {
    assert.ok(!orchestrator.includes(needle), 'no direct read in executable core: ' + needle);
  }
});
