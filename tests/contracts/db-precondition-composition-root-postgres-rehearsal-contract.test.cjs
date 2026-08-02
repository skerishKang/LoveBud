'use strict';

/**
 * Source-static contract for Issue #3816 (Step 7 disposable PostgreSQL
 * rehearsal). Locks the exact ten-file cumulative boundary (nine rehearsal files
 * plus the deterministic reporter registry file), package script, CI job,
 * PostgreSQL service image/version, loopback-only LB_TEST_PG* boundary, session
 * wrapper contract, ACTIVE construction-time seam, SQL boundary, and parent
 * completion posture. Real DB behavior belongs to the DB-engine test, which runs
 * only on GitHub Actions; string checks here do not claim DB behavior.
 *
 * Refs: #3816, #3809, #3802, #3657, #3458, #3425, #3435, #1882
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EXPECTED_DB_ENGINE_SCRIPTS } = require(path.resolve(__dirname, '..', '..', 'scripts', 'report-ci-test-groups.cjs'));

const ROOT = path.resolve(__dirname, '..', '..');
const DB_TEST = path.join(ROOT, 'tests/db-engine/precondition-composition-root-postgres.test.cjs');
const CONTRACT_PATH = path.join(ROOT, 'docs/architecture/db-precondition-composition-root-postgres-rehearsal-contract.md');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/ci.yml');
const CLASSIFICATION_PATH = path.join(ROOT, 'tests/test-layer-classification.json');
const DECISION_PATH = path.join(ROOT, 'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md');

const CORES = [
  'scripts/migration-precondition-composition-root-core.cjs',
  'scripts/migration-precondition-evaluator-adapter-core.cjs',
  'scripts/migration-precondition-authority-loader-resolver-core.cjs',
  'scripts/migration-postgres-session-lock-adapter-core.cjs',
  'scripts/migration-runner-orchestrator-core.cjs',
  'scripts/migration-runner-protocol-core.cjs',
];

const DB_TEST_PATH = 'tests/db-engine/precondition-composition-root-postgres.test.cjs';
const CONTRACT_TEST_PATH = 'tests/contracts/db-precondition-composition-root-postgres-rehearsal-contract.test.cjs';

const EXPECTED_TEN = [
  DB_TEST_PATH,
  CONTRACT_TEST_PATH,
  'docs/architecture/db-precondition-composition-root-postgres-rehearsal-contract.md',
  'package.json',
  '.github/workflows/ci.yml',
  'tests/test-layer-classification.json',
  'docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md',
  'tests/contracts/ci-test-group-registry-contract.test.cjs',
  'tests/contracts/cloudflare-supplied-url-smoke-contract.test.cjs',
  'scripts/report-ci-test-groups.cjs',
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// ── 1. Nine-file boundary and core-file immutability ───────────────────────

test('exact ten-file cumulative boundary includes the reporter registry pair', () => {
  for (const rel of EXPECTED_TEN) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), 'required rehearsal file exists: ' + rel);
  }
  const reporter = read('scripts/report-ci-test-groups.cjs');
  assert.ok(
    reporter.includes("{ script: 'test:db-engine:precondition-composition-root', target: 'tests/db-engine/precondition-composition-root-postgres.test.cjs' }"),
    'reporter registers the exact script/target pair',
  );
  assert.ok(
    read(DB_TEST_PATH).includes('createMigrationPreconditionCompositionRoot'),
    'DB-engine test uses the composition root',
  );
});

test('the six authority/core files are not modified or bypassed by this rehearsal', () => {
  for (const rel of CORES) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), 'core file exists: ' + rel);
  }
  const dbTest = read(DB_TEST_PATH);
  // The rehearsal imports the merged cores by canonical relative path; it never
  // re-implements or copies their logic.
  assert.ok(
    dbTest.includes("require('../../scripts/migration-precondition-composition-root-core.cjs')"),
    'composition root imported by canonical path',
  );
  assert.ok(
    dbTest.includes("require('../../scripts/migration-postgres-session-lock-adapter-core.cjs')"),
    'lock adapter imported by canonical path',
  );
  assert.ok(
    dbTest.includes("require('../../scripts/migration-runner-orchestrator-core.cjs')"),
    'orchestrator imported by canonical path',
  );
  assert.ok(
    dbTest.includes("require('../../scripts/migration-runner-protocol-core.cjs')"),
    'protocol imported by canonical path',
  );
});

// ── 2. Package script ───────────────────────────────────────────────────────

test('exactly one new package script for the rehearsal', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(
    pkg.scripts['test:db-engine:precondition-composition-root'],
    'node --test --test-concurrency=1 tests/db-engine/precondition-composition-root-postgres.test.cjs',
    'exact package script command',
  );
});

// ── 3. CI job, image, version ───────────────────────────────────────────────

test('exactly one new CI job with postgres:17.4-bookworm and 170004 assertion', () => {
  const workflow = read('.github/workflows/ci.yml');
  const jobCount = (workflow.match(/db-engine-precondition-composition-root:/g) || []).length;
  assert.equal(jobCount, 1, 'exactly one rehearsal job definition');
  assert.ok(workflow.includes('image: postgres:17.4-bookworm'), 'postgres:17.4-bookworm service');
  assert.ok(workflow.includes('npm run test:db-engine:precondition-composition-root'), 'job runs only the rehearsal script');
const canonicalDbEngineCount = EXPECTED_DB_ENGINE_SCRIPTS.length;
  assert.equal((workflow.match(/170004/g) || []).length, canonicalDbEngineCount, 'each canonical DB-engine job asserts 170004');
  const versionAssert = workflow.match(/test "\$\{VER\}" = "170004"/);
  assert.ok(versionAssert, 'exact server_version_num 170004 assertion');
});

// ── 4. Loopback-only LB_TEST_PG* boundary, no DATABASE_URL ─────────────────

test('loopback-only LB_TEST_PG* boundary and no DATABASE_URL or local fallback', () => {
  const dbTest = read(DB_TEST_PATH);
  const workflow = read('.github/workflows/ci.yml');
  const harnessSource = read('tests/db-engine/helpers/postgres-disposable-harness.cjs');
  assert.ok(harnessSource.includes('process.env.LB_TEST_PGHOST'), 'harness enforces LB_TEST_PG* loopback env');
  assert.ok(dbTest.includes("require('./helpers/postgres-disposable-harness.cjs')"), 'DB-engine test uses the loopback-only harness');
  assert.ok(workflow.includes('LB_TEST_PGHOST: 127.0.0.1'), 'workflow pins loopback host');
  assert.ok(!/process\.env\.DATABASE_URL/.test(dbTest), 'no DATABASE_URL env read in the DB-engine test');
  assert.ok(!/process\.env\.DATABASE_URL/.test(workflow), 'no DATABASE_URL env read in the workflow');
  assert.ok(!/neon\.tech|modal\.com|onrender\.com/i.test(dbTest), 'no provider URL reference');
  assert.ok(!dbTest.includes('docker'), 'no local Docker fallback');
  assert.ok(dbTest.includes("require('./helpers/postgres-disposable-harness.cjs')"), 'uses the loopback-only disposable harness');
});

// ── 5. Session wrapper contract ─────────────────────────────────────────────

test('plain own-callable session wrapper around a dedicated pg.Client', () => {
  const dbTest = read(DB_TEST_PATH);
  assert.ok(
    /query:\s+async\s+function\s*\(queryObject\)/.test(dbTest),
    'session query is an own async callable',
  );
  assert.ok(
    /release:\s+async\s+function\s*\(\)/.test(dbTest),
    'session release is an own async callable',
  );
  assert.ok(dbTest.includes('new Client(baseClientConfig(cfg, dbName))'), 'dedicated pg.Client per session');
  assert.ok(!dbTest.includes('pool'), 'no connection pool shared identity');
  assert.ok(dbTest.includes('client.end()'), 'release ends the dedicated client exactly once');
  // The session query must delegate to the SAME dedicated client; a second
  // connection would break the same-session advisory-lock evidence (NC1).
  assert.ok(
    !/query:\s*async\s*function\s*\(queryObject\)\s*\{\s*[^}]*new\s+Client/.test(dbTest),
    'session query never creates a second connection',
  );
});

// ── 6b. R-scenario status literals (source-verifiable evidence locks) ──────

test('rehearsal locks the fail-closed R-scenario statuses in source', () => {
  const dbTest = read(DB_TEST_PATH);
  assert.ok(
    dbTest.includes("assert.equal(precondition.status, 'NOT_EVALUATED'"),
    'R1/R4 inactive authority is NOT_EVALUATED, never implicit PASS (NC2)',
  );
  assert.equal(
    (dbTest.match(/assert\.equal\(result\.lockReleased, true/g) || []).length,
    2,
    'R3/R4 release completes after a blocked precondition (NC3)',
  );
  assert.equal(
    (dbTest.match(/assert\.equal\(counts\.executeMigration, 0/g) || []).length,
    2,
    'executeMigration stays 0 after NOT_EVALUATED (NC4)',
  );
  assert.ok(
    dbTest.includes("assert.equal(b.status, 'FAILED', 'root B contends while A holds')"),
    'R5 contention: root B cannot acquire while root A holds (NC5)',
  );
  assert.ok(
    dbTest.includes("assert.equal(foreign.status, 'UNAVAILABLE', 'cross-instance handle unavailable')"),
    'R6 cross-instance handle is UNAVAILABLE (NC6)',
  );
});

// ── 6. ACTIVE seam is construction-time only ───────────────────────────────

test('synthetic ACTIVE authority is a construction-time seam only', () => {
  const dbTest = read(DB_TEST_PATH);
  assert.ok(dbTest.includes('authorityResolverFactory'), 'construction-time authorityResolverFactory seam used');
  assert.ok(
    dbTest.includes('resolvePreconditionAuthority: () => ({ status: \'RESOLVED\', checks: [check] })'),
    'ACTIVE resolver is the bounded construction-time seam',
  );
  assert.ok(!dbTest.includes('queryLockedSession'), 'broker never passed directly by the rehearsal');
});

// ── 7. SQL boundary: no migration/DDL/DML/ledger SQL ────────────────────────

test('rehearsal SQL is limited to canonical lock queries, fixed boolean SELECT, residual-lock check', () => {
  const dbTest = read(DB_TEST_PATH);
  const forbidden = [
    /\bCREATE\s+(TABLE|SCHEMA|EXTENSION|ROLE|INDEX|DATABASE)\b/i,
    /\bALTER\s+TABLE\b/i,
    /\bDROP\s+(TABLE|SCHEMA|DATABASE)\b/i,
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+\w+\s+SET\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bGRANT\b/i,
    /\bREVOKE\b/i,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(dbTest), 'forbidden SQL pattern in rehearsal: ' + re);
  }
  assert.ok(
    dbTest.includes("SELECT FALSE AS satisfied"),
    'fixed synthetic boolean SELECT evidence present',
  );
  assert.ok(
    dbTest.includes("SELECT COUNT(*)::int AS locked FROM pg_locks"),
    'bounded read-only residual-lock verification present',
  );
});

// ── 8. Classification registration ─────────────────────────────────────────

test('classification registers the source-static contract and the supplemental DB test', () => {
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
});

// ── 9. Parent completion posture ────────────────────────────────────────────

test('decision doc records Steps 1-7 complete and Step 8 unauthorized', () => {
  const decision = read('docs/architecture/DB_MIGRATION_PROVENANCE_NEXT_CHILD_DECISION.md');
  assert.ok(/Steps 1[–-]7 complete/.test(decision), 'Steps 1-7 complete');
  assert.ok(/Step 8[^\n]*not authorized/i.test(decision), 'Step 8 not authorized');
  assert.ok(/disposable PostgreSQL rehearsal[^\n]*implemented/.test(decision), 'Step 7 implemented by #3816');
});

test('contract doc exists and records the rehearsal boundary and SQL scope', () => {
  const doc = read('docs/architecture/db-precondition-composition-root-postgres-rehearsal-contract.md');
  assert.ok(doc.includes('postgres:17.4-bookworm'), 'doc records the engine image');
  assert.ok(doc.includes('170004'), 'doc records the exact version');
  assert.ok(doc.includes('LB_TEST_PG'), 'doc records the loopback env boundary');
  assert.ok(doc.includes('DATABASE_URL') && doc.includes('never'), 'doc forbids DATABASE_URL');
  assert.ok(doc.includes('Step 8'), 'doc records Step 8 posture');
});
