/**
 * Source-static contract for the trees-schema disposable PostgreSQL engine harness.
 *
 * Does not connect to a database, spawn psql, or execute migration SQL.
 *
 * Refs: #3532, #3531, #3459, #3458, #3435, #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const CI_PATH = path.join(ROOT, '.github/workflows/ci.yml');
const HARNESS_PATH = path.join(ROOT, 'tests/db-engine/trees-schema-foothold-postgres.test.cjs');
const FIXTURE_PATH = path.join(ROOT, 'tests/db-engine/fixtures/trees-schema-damaged.sql');
const HELPER_PATH = path.join(ROOT, 'tests/db-engine/helpers/trees-schema-catalog-assertions.cjs');
const SHARED_HARNESS_PATH = path.join(
  ROOT,
  'tests/db-engine/helpers/postgres-disposable-harness.cjs'
);
const MIGRATION_PATH = path.join(ROOT, 'scripts/migration-repair-trees-schema-3435.sql');
const INVENTORY_PATH = path.join(ROOT, 'tests/test-layer-classification.json');

function read(p) {
  assert.ok(fs.existsSync(p), `missing ${path.relative(ROOT, p)}`);
  return fs.readFileSync(p, 'utf8');
}

const pkg = JSON.parse(read(PKG_PATH));
const ci = read(CI_PATH);
const harness = read(HARNESS_PATH);
const shared = read(SHARED_HARNESS_PATH);
const fixture = read(FIXTURE_PATH);
const helper = read(HELPER_PATH);
const inv = JSON.parse(read(INVENTORY_PATH));
const migration = read(MIGRATION_PATH);

test('package has separate test:db-engine:trees-schema script', () => {
  assert.equal(typeof pkg.scripts['test:db-engine:trees-schema'], 'string');
  assert.match(
    pkg.scripts['test:db-engine:trees-schema'],
    /tests\/db-engine\/trees-schema-foothold-postgres\.test\.cjs/
  );
  assert.match(pkg.scripts['test:db-engine:trees-schema'], /--test-concurrency=1/);
});

test('default npm test command remains smoke/routes/contracts only', () => {
  assert.equal(
    pkg.scripts.test,
    'node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs'
  );
  assert.equal(pkg.scripts.test.includes('db-engine'), false);
  assert.equal(pkg.scripts.ci.includes('test:db-engine'), false);
});

test('workflow adds independent db-engine-trees-schema job with postgres 17.4', () => {
  assert.match(ci, /verify-static\s*:/);
  assert.match(ci, /db-engine-tree-comments\s*:/);
  assert.match(ci, /db-engine-trees-schema\s*:/);
  assert.match(ci, /image:\s*postgres:17\.4-bookworm/);
  assert.match(ci, /npm run test:db-engine:trees-schema/);
  assert.match(ci, /LB_TEST_PGHOST:\s*127\.0\.0\.1/);
  assert.match(ci, /server_version_num/);
  assert.match(ci, /170004/);
  assert.equal(/DATABASE_URL/i.test(ci), false);
  assert.equal(/secrets\./i.test(ci), false);
  assert.equal(/NEON_API_KEY/i.test(ci), false);
});

test('shared harness enforces loopback and synthetic env only', () => {
  assert.match(shared, /LB_TEST_PGHOST/);
  assert.match(shared, /DB_ENGINE_UNSAFE_HOST_REJECTED/);
  assert.match(shared, /127\.0\.0\.1/);
  assert.match(shared, /lovebud_ci/);
  assert.equal(/process\.env\.DATABASE_URL/i.test(shared), false);
  assert.equal(/NEON_API_KEY/i.test(shared), false);
  assert.match(shared, /ON_ERROR_STOP=1/);
  assert.match(shared, /spawnSync/);
  assert.match(shared, /shell:\s*false/);
});

test('engine harness targets exact foothold migration and required phases', () => {
  assert.match(harness, /migration-repair-trees-schema-3435\.sql/);
  assert.match(harness, /ON_ERROR_STOP/);
  assert.match(harness, /happy path apply and idempotent second apply/);
  assert.match(harness, /compatible partial columns converge/);
  assert.match(harness, /multi partial owner_id\+title\+visibility converges/);
  assert.match(harness, /fully repaired state is no-op/);
  assert.match(harness, /missing table fail closed/);
  assert.match(harness, /non-table fail closed/);
  assert.match(harness, /materialized view fail closed/);
  assert.match(harness, /id missing fail closed/);
  assert.match(harness, /id non-text uuid fail closed/);
  assert.match(harness, /id non-text integer fail closed/);
  assert.match(harness, /id nullable fail closed/);
  assert.match(harness, /no primary key fail closed/);
  assert.match(harness, /other-column-only PK fail closed/);
  assert.match(harness, /id not sole PK fail closed/);
  assert.match(harness, /incompatible target type fail closed/);
  assert.match(harness, /target NOT NULL fail closed/);
  assert.match(harness, /target with default fail closed/);
  assert.match(harness, /mixed early-absent later-incompatible/);
  assert.match(harness, /assertNoMutation/);
  assert.match(harness, /getTreesOwnerAclFingerprint|ownerAcl/);
  assert.match(harness, /trees non-ID value mutation changes rowFp/);
  assert.match(harness, /sentinel body mutation changes rowFp/);
  assert.match(harness, /\.rowFp/);
  assert.equal(/rollback-.*trees/i.test(harness), false, 'must not invent trees rollback SQL');
  assert.equal(/DATABASE_URL/i.test(harness), false);
});

test('catalog helper uses full-row fingerprinting (not id-only)', () => {
  assert.match(helper, /row_to_json/i);
  assert.match(helper, /rowFp|row_fp/);
  assert.match(helper, /getFullRowFingerprint/);
  assert.match(helper, /ALLOWED_FINGERPRINT_TABLES/);
  assert.equal(
    /string_agg\s*\(\s*id::text/i.test(helper),
    false,
    'must not hash id-only string_agg'
  );
  assert.equal(
    /id\s*\|\|\s*':'?\s*\|\|\s*tree_id/i.test(helper),
    false,
    'must not use id||tree_id-only sentinel fingerprint'
  );
  assert.equal(/NO_ID_COLUMN/.test(helper), false, 'must not use NO_ID_COLUMN fallback');
  assert.equal(/console\.(log|info|debug|warn)/.test(helper), false);
  assert.equal(/JSON\.stringify\s*\(\s*rows/.test(helper), false);
});

test('damaged fixture and catalog helpers encode seven-column foothold contract', () => {
  assert.ok(fs.existsSync(FIXTURE_PATH));
  assert.ok(fs.existsSync(HELPER_PATH));
  assert.match(fixture, /CREATE TABLE public\.trees/i);
  assert.match(fixture, /id text NOT NULL PRIMARY KEY/i);
  assert.match(fixture, /lb_sentinel_dependent/);
  assert.match(fixture, /lb_unrelated_marker/);
  for (const name of [
    'owner_id',
    'title',
    'visibility',
    'group_name',
    'keywords',
    'created_at',
    'updated_at',
  ]) {
    assert.equal(
      new RegExp(`\\b${name}\\b`).test(fixture.replace(/--.*/g, '')),
      false,
      `damaged fixture must not pre-define ${name}`
    );
  }
  assert.match(helper, /assertDamagedCatalog/);
  assert.match(helper, /assertRepairedCatalog/);
  assert.match(helper, /owner_id/);
  assert.match(helper, /keywords/);
  assert.match(helper, /timestamptz/);
});

test('migration SQL artifact remains the exact seven-column foothold (no SQL edit required)', () => {
  assert.ok(fs.existsSync(MIGRATION_PATH));
  assert.match(migration, /ADD COLUMN owner_id TEXT/);
  assert.match(migration, /ADD COLUMN keywords TEXT\[\]/);
  assert.match(migration, /ADD COLUMN created_at TIMESTAMPTZ/);
  assert.match(migration, /BEGIN;/);
  assert.match(migration, /COMMIT;/);
  assert.equal(/INSERT INTO public\.trees/i.test(migration), false);
  assert.equal(/UPDATE public\.trees/i.test(migration), false);
  assert.equal(
    /ADD COLUMN\s+\w+\s+[^;]*DEFAULT/i.test(migration),
    false,
    'foothold ADD COLUMN must not assign defaults'
  );
});

test('DB engine test is classified supplemental DB_ENGINE_EXECUTION outside default globs', () => {
  const enginePath = 'tests/db-engine/trees-schema-foothold-postgres.test.cjs';
  const harnessContractPath = 'tests/contracts/trees-schema-db-engine-harness-contract.test.cjs';
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
    'engine test must not be in default-CI entries'
  );
});
