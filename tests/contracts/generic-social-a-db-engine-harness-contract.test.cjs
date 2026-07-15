/**
 * Source-static contract for generic-social Migration A DB-engine harness.
 * Does not connect to PostgreSQL or execute migration SQL.
 *
 * Refs: #3534, #3262, #3459, #3458, #3425, #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PKG = path.join(ROOT, 'package.json');
const CI = path.join(ROOT, '.github/workflows/ci.yml');
const HARNESS = path.join(ROOT, 'tests/db-engine/generic-social-a-postgres.test.cjs');
const FIXTURE = path.join(ROOT, 'tests/db-engine/fixtures/generic-social-a-legacy.sql');
const HELPER = path.join(ROOT, 'tests/db-engine/helpers/generic-social-catalog-assertions.cjs');
const SHARED = path.join(ROOT, 'tests/db-engine/helpers/postgres-disposable-harness.cjs');
const MIG_A = path.join(ROOT, 'scripts/migration-add-generic-social-targets.sql');
const MIG_B = path.join(ROOT, 'scripts/migration-b-generic-social-targets-cutover.sql');
const INV = path.join(ROOT, 'tests/test-layer-classification.json');

function read(p) {
  assert.ok(fs.existsSync(p), `missing ${path.relative(ROOT, p)}`);
  return fs.readFileSync(p, 'utf8');
}

const pkg = JSON.parse(read(PKG));
const ci = read(CI);
const harness = read(HARNESS);
const fixture = read(FIXTURE);
const helper = read(HELPER);
const shared = read(SHARED);
const inv = JSON.parse(read(INV));

test('package has separate test:db-engine:generic-social-a script', () => {
  assert.equal(typeof pkg.scripts['test:db-engine:generic-social-a'], 'string');
  assert.match(
    pkg.scripts['test:db-engine:generic-social-a'],
    /tests\/db-engine\/generic-social-a-postgres\.test\.cjs/
  );
  assert.match(pkg.scripts['test:db-engine:generic-social-a'], /--test-concurrency=1/);
});

test('default npm test unchanged and excludes db-engine', () => {
  assert.equal(
    pkg.scripts.test,
    'node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs'
  );
  assert.equal(pkg.scripts.test.includes('db-engine'), false);
  assert.equal(pkg.scripts.ci.includes('test:db-engine'), false);
});

test('workflow adds db-engine-generic-social-a without removing existing jobs', () => {
  assert.match(ci, /verify-static\s*:/);
  assert.match(ci, /db-engine-tree-comments\s*:/);
  assert.match(ci, /db-engine-trees-schema\s*:/);
  assert.match(ci, /db-engine-generic-social-a\s*:/);
  assert.match(ci, /image:\s*postgres:17\.4-bookworm/);
  assert.match(ci, /npm run test:db-engine:generic-social-a/);
  assert.match(ci, /LB_TEST_PGHOST:\s*127\.0\.0\.1/);
  assert.match(ci, /server_version_num/);
  assert.match(ci, /170004/);
  assert.match(ci, /format\('\{0\}-\{1\}',\s*github\.run_id,\s*github\.run_attempt\)/);
  assert.equal(/DATABASE_URL/i.test(ci), false);
  assert.equal(/secrets\./i.test(ci), false);
  assert.equal(/NEON_API_KEY/i.test(ci), false);
});

test('shared harness keeps loopback and synthetic env guards', () => {
  assert.match(shared, /LB_TEST_PGHOST/);
  assert.match(shared, /DB_ENGINE_UNSAFE_HOST_REJECTED/);
  assert.match(shared, /127\.0\.0\.1/);
  assert.match(shared, /ON_ERROR_STOP=1/);
  assert.match(shared, /spawnSync/);
  assert.match(shared, /shell:\s*false/);
  assert.equal(/process\.env\.DATABASE_URL/i.test(shared), false);
});

test('engine harness targets Migration A only with required phases', () => {
  assert.match(harness, /migration-add-generic-social-targets\.sql/);
  assert.match(harness, /ON_ERROR_STOP/);
  assert.match(harness, /happy path apply backfill catalog and second apply/);
  assert.match(harness, /second apply no-op/);
  assert.match(harness, /trigger compatibility statements/);
  assert.match(harness, /legacy-only insert/);
  assert.match(harness, /matching memory pair/);
  assert.match(harness, /partial pair reject/);
  assert.match(harness, /tree kind reject/);
  assert.match(harness, /unknown kind reject/);
  assert.match(harness, /memory mismatch reject/);
  assert.match(harness, /update mismatch preserve/);
  assert.match(harness, /missing tables fail closed/);
  assert.match(harness, /non-ordinary relation fail closed/);
  assert.match(harness, /legacy target missing fail closed/);
  assert.match(harness, /pre-existing partial pair fail closed/);
  assert.match(harness, /pre-existing tree pair fail closed/);
  assert.match(harness, /pre-existing memory mismatch fail closed/);
  assert.match(harness, /wrong target_kind type fail closed/);
  assert.match(harness, /mixed table unsupported preserves pre-state/);
  assert.match(harness, /assertNoMutation/);
  assert.match(harness, /rowFp|getFullRowFingerprint/);
  // No live Migration B apply call (allow negative-assertion source markers).
  assert.equal(
    /(?:^|[^=])\s*runSql\s*\(\s*MIGRATION_B\s*\)/m.test(harness),
    false,
    'must not invoke runSql(MIGRATION_B)'
  );
  assert.equal(/process\.env\.DATABASE_URL/i.test(harness), false);
  assert.equal(/rollback-.*generic/i.test(harness), false);
});

test('fixture and helper encode legacy social schema and full-row hashing', () => {
  assert.match(fixture, /CREATE TABLE public\.social_idempotency/i);
  assert.match(fixture, /target_memory_id UUID NOT NULL/i);
  assert.match(fixture, /CREATE TABLE public\.social_audit_log/i);
  assert.match(fixture, /memory_id UUID NOT NULL/i);
  assert.match(fixture, /lb_unrelated_marker/);
  assert.equal(/target_kind/i.test(fixture.replace(/--.*/g, '')), false);
  assert.equal(/target_id/i.test(fixture.replace(/--.*/g, '')), false);

  assert.match(helper, /row_to_json/i);
  assert.match(helper, /getFullRowFingerprint/);
  assert.match(helper, /assertMigrationACatalog/);
  assert.match(helper, /sync_social_idempotency_generic_target_from_legacy_memory/);
  assert.equal(/string_agg\s*\(\s*id::text/i.test(helper), false);
  assert.equal(/console\.(log|info|debug)/.test(helper), false);
});

test('Migration A and B SQL artifacts present; harness executes A only', () => {
  assert.ok(fs.existsSync(MIG_A));
  assert.ok(fs.existsSync(MIG_B));
  const a = read(MIG_A);
  assert.match(a, /ADD COLUMN IF NOT EXISTS target_kind VARCHAR\(16\)/);
  assert.match(a, /trg_social_idempotency_sync_generic_target/);
  assert.match(a, /BEGIN;/);
  assert.match(a, /COMMIT;/);
});

test('DB engine test classified supplemental DB_ENGINE_EXECUTION', () => {
  const enginePath = 'tests/db-engine/generic-social-a-postgres.test.cjs';
  const contractPath = 'tests/contracts/generic-social-a-db-engine-harness-contract.test.cjs';
  assert.deepEqual(inv.defaultCiGlobs, [
    'tests/smoke/*.test.cjs',
    'tests/routes/*.test.cjs',
    'tests/contracts/*.test.cjs',
  ]);
  const supp = inv.supplemental.find((s) => s.path === enginePath);
  assert.ok(supp);
  assert.equal(supp.defaultCi, false);
  assert.equal(supp.layer, 'DB_ENGINE_EXECUTION');
  const entry = inv.entries.find((e) => e.path === contractPath);
  assert.ok(entry);
  assert.equal(entry.layer, 'SOURCE_STATIC');
  assert.equal(inv.entries.some((e) => e.path === enginePath), false);
});
