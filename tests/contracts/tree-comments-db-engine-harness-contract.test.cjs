/**
 * Source-static contract for the tree_comments disposable PostgreSQL engine harness.
 *
 * Does not connect to a database, spawn psql, or execute migration SQL.
 * Verifies package script separation, CI job shape, loopback guards, and phase markers.
 *
 * Refs: #3478, #3459, #3458, #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const CI_PATH = path.join(ROOT, '.github/workflows/ci.yml');
const HARNESS_PATH = path.join(ROOT, 'tests/db-engine/tree-comments-reconcile-postgres.test.cjs');
const FIXTURE_PATH = path.join(ROOT, 'tests/db-engine/fixtures/tree-comments-legacy.sql');
const HELPER_PATH = path.join(ROOT, 'tests/db-engine/helpers/postgres-catalog-assertions.cjs');
const MIGRATION_PATH = path.join(ROOT, 'scripts/migration-reconcile-tree-comments-legacy-schema.sql');
const ROLLBACK_PATH = path.join(ROOT, 'scripts/rollback-tree-comments-legacy-reconcile.sql');
const INVENTORY_PATH = path.join(ROOT, 'tests/test-layer-classification.json');

function read(p) {
  assert.ok(fs.existsSync(p), `missing ${path.relative(ROOT, p)}`);
  return fs.readFileSync(p, 'utf8');
}

const pkg = JSON.parse(read(PKG_PATH));
const ci = read(CI_PATH);
const harness = read(HARNESS_PATH);
const fixture = read(FIXTURE_PATH);
const helper = read(HELPER_PATH);
const inv = JSON.parse(read(INVENTORY_PATH));

test('package has separate test:db-engine:tree-comments script', () => {
  assert.equal(typeof pkg.scripts['test:db-engine:tree-comments'], 'string');
  assert.match(
    pkg.scripts['test:db-engine:tree-comments'],
    /tests\/db-engine\/tree-comments-reconcile-postgres\.test\.cjs/
  );
  assert.match(pkg.scripts['test:db-engine:tree-comments'], /--test-concurrency=1/);
});

test('default npm test command remains smoke/routes/contracts only', () => {
  assert.equal(
    pkg.scripts.test,
    'node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs'
  );
  assert.equal(
    pkg.scripts.ci,
    'npm run lint && npm run build && npm run test && npm run verify'
  );
  assert.equal(pkg.scripts.ci.includes('test:db-engine'), false);
  assert.equal(pkg.scripts.test.includes('db-engine'), false);
});

test('workflow keeps verify-static and adds independent db-engine-tree-comments job', () => {
  assert.match(ci, /verify-static\s*:/);
  assert.match(ci, /db-engine-tree-comments\s*:/);
  assert.match(ci, /runs-on:\s*ubuntu-latest/);
  assert.match(ci, /timeout-minutes:\s*15/);
  assert.match(ci, /image:\s*postgres:17\.4-bookworm/);
  assert.match(ci, /POSTGRES_USER:\s*lovebud_ci/);
  assert.match(ci, /POSTGRES_PASSWORD:\s*lovebud_ci_only/);
  assert.match(ci, /POSTGRES_DB:\s*lovebud_ci_admin/);
  assert.match(ci, /LB_TEST_PGHOST:\s*127\.0\.0\.1/);
  assert.match(ci, /LB_TEST_PGUSER:\s*lovebud_ci/);
  assert.match(ci, /LB_TEST_PGPASSWORD:\s*lovebud_ci_only/);
  assert.match(ci, /LB_TEST_PGADMIN_DB:\s*lovebud_ci_admin/);
  assert.match(ci, /npm run test:db-engine:tree-comments/);
  assert.match(ci, /server_version_num/);
  assert.match(ci, /170004/);
  assert.equal(/secrets\./i.test(ci), false, 'workflow must not reference secrets.*');
  assert.equal(/DATABASE_URL/i.test(ci), false, 'workflow must not reference DATABASE_URL');
  assert.equal(/NEON_API_KEY/i.test(ci), false, 'workflow must not reference NEON_API_KEY');
});

test('engine harness uses loopback host guard and synthetic env only', () => {
  assert.match(harness, /LB_TEST_PGHOST/);
  assert.match(harness, /LB_TEST_PGPORT/);
  assert.match(harness, /LB_TEST_PGUSER/);
  assert.match(harness, /LB_TEST_PGPASSWORD/);
  assert.match(harness, /LB_TEST_PGADMIN_DB/);
  assert.match(harness, /DB_ENGINE_UNSAFE_HOST_REJECTED/);
  assert.match(harness, /127\.0\.0\.1/);
  assert.match(harness, /localhost/);
  assert.match(harness, /::1/);
  assert.match(harness, /lovebud_ci/);
  assert.equal(/process\.env\.DATABASE_URL/i.test(harness), false);
  assert.equal(/NEON_API_KEY/i.test(harness), false);
});

test('engine harness executes exact migration and rollback SQL via psql ON_ERROR_STOP', () => {
  assert.match(harness, /migration-reconcile-tree-comments-legacy-schema\.sql/);
  assert.match(harness, /rollback-tree-comments-legacy-reconcile\.sql/);
  assert.match(harness, /ON_ERROR_STOP=1/);
  assert.match(harness, /['"]-X['"]/);
  assert.match(harness, /['"]-f['"]/);
  assert.match(harness, /spawnSync/);
  assert.match(harness, /shell:\s*false/);
  assert.match(harness, /PGPASSWORD/);
  assert.equal(/shell:\s*true/i.test(harness), false);
});

test('engine harness includes apply/verify/rollback/reapply and adversarial phases', () => {
  assert.match(harness, /happy path apply\/rollback\/reapply|happy apply/i);
  assert.match(harness, /second apply stop/i);
  assert.match(harness, /rollback/i);
  assert.match(harness, /reapply/i);
  assert.match(harness, /nonempty/i);
  assert.match(harness, /duplicate/i);
  assert.match(harness, /unexpected.*index|badidx/i);
  assert.match(harness, /dependent view|depview/i);
  assert.match(harness, /changed constraint|badfk/i);
  assert.match(harness, /mismatched parent|uuidparent/i);
  assert.match(harness, /rollback nonempty|rbnonempty/i);
  assert.match(harness, /PREFLIGHT STOP: tree_comments already reconciled/);
});

test('legacy fixture and catalog helpers exist with exact legacy shape markers', () => {
  assert.ok(fs.existsSync(FIXTURE_PATH));
  assert.ok(fs.existsSync(HELPER_PATH));
  assert.match(fixture, /PRIMARY KEY\s*\(\s*tree_id\s*,\s*id\s*\)/i);
  assert.match(fixture, /ON DELETE SET NULL/i);
  assert.match(fixture, /ON DELETE CASCADE/i);
  assert.match(fixture, /payload jsonb NOT NULL DEFAULT '\{\}'::jsonb/i);
  assert.match(helper, /assertLegacyCatalog/);
  assert.match(helper, /assertCanonicalCatalog/);
  assert.match(helper, /EXPECTED_COLUMN_COUNT_12/);
  assert.match(helper, /idx_tree_comments_tree_id/);
});

test('migration and rollback SQL artifacts remain present (this contract does not require SQL edits)', () => {
  assert.ok(fs.existsSync(MIGRATION_PATH));
  assert.ok(fs.existsSync(ROLLBACK_PATH));
});

test('DB engine test is classified supplemental DB_ENGINE_EXECUTION outside default globs', () => {
  const enginePath = 'tests/db-engine/tree-comments-reconcile-postgres.test.cjs';
  const harnessContractPath = 'tests/contracts/tree-comments-db-engine-harness-contract.test.cjs';
  const defaultGlobs = inv.defaultCiGlobs || [];
  assert.deepEqual(defaultGlobs, [
    'tests/smoke/*.test.cjs',
    'tests/routes/*.test.cjs',
    'tests/contracts/*.test.cjs',
  ]);
  const supp = inv.supplemental.find((s) => s.path === enginePath);
  assert.ok(supp, 'engine test must be in supplemental');
  assert.equal(supp.defaultCi, false);
  assert.equal(supp.layer, 'DB_ENGINE_EXECUTION');
  const entry = inv.entries.find((e) => e.path === harnessContractPath);
  assert.ok(entry, 'harness contract must be in default-CI entries');
  assert.equal(entry.layer, 'SOURCE_STATIC');
  assert.equal(
    inv.entries.some((e) => e.path === enginePath),
    false,
    'engine test must not be a default-CI inventory entry'
  );
});
