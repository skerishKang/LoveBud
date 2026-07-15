/**
 * Source-static contract for generic-social Migration A DB-engine rehearsal harness.
 * Does not connect to PostgreSQL or execute migration SQL.
 *
 * Refs: #3534, #3262, #3459, #3458, #3425, #1882
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const PKG = path.join(ROOT, 'package.json');
const CI = path.join(ROOT, '.github/workflows/ci.yml');
const HARNESS = path.join(ROOT, 'tests/db-engine/generic-social-a-postgres.test.cjs');
const FIXTURE = path.join(ROOT, 'tests/db-engine/fixtures/generic-social-a-legacy.sql');
const HELPER = path.join(ROOT, 'tests/db-engine/helpers/generic-social-catalog-assertions.cjs');
const SHARED = path.join(ROOT, 'tests/db-engine/helpers/postgres-disposable-harness.cjs');
const PRE = path.join(ROOT, 'scripts/validate-generic-social-a-preflight.sql');
const POST = path.join(ROOT, 'scripts/validate-generic-social-a-postcondition.sql');
const MIG_A = path.join(ROOT, 'scripts/migration-add-generic-social-targets.sql');
const MIG_B = path.join(ROOT, 'scripts/migration-b-generic-social-targets-cutover.sql');
const INV = path.join(ROOT, 'tests/test-layer-classification.json');
const PATH_INV = path.join(ROOT, 'docs/architecture/migration-path-inventory.json');

function read(p) {
  assert.ok(fs.existsSync(p), `missing ${path.relative(ROOT, p)}`);
  return fs.readFileSync(p, 'utf8');
}

function sha256(p) {
  const buf = fs.readFileSync(p);
  const lfBytes = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'));
  return 'sha256:' + crypto.createHash('sha256').update(lfBytes).digest('hex');
}

const REQUIRED_CHECK = [
  'check_wrong_pair',
  'check_wrong_vocab',
  'check_not_valid',
  'check_weak_semantics',
  'check_shadow',
];

const REQUIRED_FN = [
  'fn_lang_sql_overload',
  'fn_overload_plpgsql',
  'fn_wrong_body',
  'fn_early_return',
  'fn_no_tree_reject',
  'fn_missing_rejection',
  'fn_secdef',
  'fn_volatility',
  'fn_parallel',
  'fn_ret_type',
];

const REQUIRED_TG = [
  'tg_wrong_fn',
  'tg_after',
  'tg_before_insert',
  'tg_update_only',
  'tg_statement',
  'tg_disabled',
  'tg_always',
  'tg_replica',
  'tg_delete',
  'tg_wrong_relation',
];

const REQUIRED_LEGACY = [
  'legacy_missing_idem',
  'legacy_null_idem',
  'legacy_type_idem',
  'legacy_def_idem',
  'legacy_missing_audit',
  'legacy_null_audit',
  'legacy_type_audit',
  'legacy_def_audit',
];

const REQUIRED_MIXED = [
  'mixed_audit_partial',
  'mixed_idem_exact_post',
  'mixed_audit_wrong_shape',
];

const REQUIRED_POST = [
  'post_wrong_check',
  'post_unvalidated_check',
  'post_check_shadow',
  'post_fn_lang_sql_overload',
  'post_fn_overload_plpgsql',
  'post_wrong_function_body',
  'post_sec_def_function',
  'post_fn_missing_rejection',
  'post_tg_disabled',
  'post_tg_always',
  'post_tg_replica',
  'post_tg_insert_only',
  'post_wrong_trigger_function',
  'post_target_kind_default',
  'post_target_id_not_null',
  'post_wrong_generic_type',
];

const pkg = JSON.parse(read(PKG));
const ci = read(CI);
const harness = read(HARNESS);
const fixture = read(FIXTURE);
const helper = read(HELPER);
const shared = read(SHARED);
const inv = JSON.parse(read(INV));

test('package has separate rehearsal and guard DB-engine scripts', () => {
  assert.equal(typeof pkg.scripts['test:db-engine:generic-social-a'], 'string');
  assert.equal(typeof pkg.scripts['test:db-engine:generic-social-a-guard'], 'string');
  assert.match(
    pkg.scripts['test:db-engine:generic-social-a'],
    /tests\/db-engine\/generic-social-a-postgres\.test\.cjs/
  );
  assert.match(pkg.scripts['test:db-engine:generic-social-a'], /--test-concurrency=1/);
  assert.match(
    pkg.scripts['test:db-engine:generic-social-a-guard'],
    /generic-social-a-guard-postgres/
  );
  assert.equal(typeof pkg.scripts['test:db-engine:tree-comments'], 'string');
  assert.equal(typeof pkg.scripts['test:db-engine:trees-schema'], 'string');
});

test('default npm test unchanged and excludes db-engine', () => {
  assert.equal(
    pkg.scripts.test,
    'node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs'
  );
  assert.equal(pkg.scripts.test.includes('db-engine'), false);
  assert.equal(pkg.scripts.ci.includes('test:db-engine'), false);
});

test('workflow keeps both generic-social DB jobs and existing jobs', () => {
  assert.match(ci, /verify-static\s*:/);
  assert.match(ci, /db-engine-tree-comments\s*:/);
  assert.match(ci, /db-engine-trees-schema\s*:/);
  assert.match(ci, /db-engine-generic-social-a-guard\s*:/);
  assert.match(ci, /db-engine-generic-social-a\s*:/);
  assert.match(ci, /image:\s*postgres:17\.4-bookworm/);
  assert.match(ci, /npm run test:db-engine:generic-social-a-guard/);
  assert.match(ci, /npm run test:db-engine:generic-social-a\b/);
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

test('engine harness uses PRE / MIG_A / POST guarded sequence', () => {
  assert.match(harness, /validate-generic-social-a-preflight\.sql/);
  assert.match(harness, /migration-add-generic-social-targets\.sql/);
  assert.match(harness, /validate-generic-social-a-postcondition\.sql/);
  assert.match(harness, /runGuardedSequence/);
  // Order: PREFLIGHT before MIG_A before POSTCOND in helper
  const preIdx = harness.indexOf("runSql(PREFLIGHT)");
  const migIdx = harness.indexOf('runSql(MIG_A)');
  const postIdx = harness.indexOf('runSql(POSTCOND)');
  assert.ok(preIdx > 0 && migIdx > preIdx && postIdx > migIdx, 'PRE/MIG_A/POST order in source');

  assert.match(harness, /assert\.equal\(cat,\s*expectedCategory\)/, 'strict category equality');
  assert.equal(/startsWith\('GENERIC_SOCIAL_A_'\)/.test(harness), false, 'prefix-only fallback 금지');
  assert.equal(
    /assert\.match\(cat,\s*\/\^GENERIC_SOCIAL_A_/.test(harness),
    false,
    'prefix regex category match 금지'
  );

  assert.match(harness, /preflight invocation = 1/);
  assert.match(harness, /Migration A invocation count = 0/);
  assert.match(harness, /postcondition invocation count = 0/);
  assert.match(harness, /getCatalogFingerprint/);
  assert.match(harness, /getFullRowFingerprint\(client,\s*'idem'\)/);
  assert.match(harness, /getFullRowFingerprint\(client,\s*'audit'\)/);
  assert.match(harness, /getFullRowFingerprint\(client,\s*'unrelated'\)/);
  assert.match(harness, /assertNoMutation/);
  assert.match(harness, /rowFp/);

  assert.equal(/(?:^|[^=])\s*runSql\s*\(\s*MIG_B\s*\)/m.test(harness), false, 'Migration B 실행 없음');
  assert.equal(/process\.env\.DATABASE_URL/i.test(harness), false);
  assert.equal(/rollback-.*generic/i.test(harness), false);
  assert.equal(/GENERIC_SOCIAL_A_CAPTURE_FINGERPRINTS/.test(harness), false, 'temporary capture 없음');
  assert.equal(/console\.(log|info|debug)\(.*(uuid|payload|actor|key)/i.test(harness), false);
});

test('engine harness encodes happy path, second apply, triggers, and matrices', () => {
  assert.match(harness, /rehearsal happy path guarded sequence/);
  assert.match(harness, /rehearsal second apply full guarded no-op/);
  assert.match(harness, /rehearsal trigger compatibility statements/);
  assert.match(harness, /legacy-only insert/);
  assert.match(harness, /matching memory pair/);
  assert.match(harness, /partial pair reject/);
  assert.match(harness, /tree kind reject/);
  assert.match(harness, /unknown kind reject/);
  assert.match(harness, /memory mismatch reject/);
  assert.match(harness, /update mismatch preserve/);
  assert.match(harness, /assertMigrationACatalog/);

  for (const name of REQUIRED_CHECK) {
    assert.match(harness, new RegExp(name), `missing CHECK scenario ${name}`);
  }
  for (const name of REQUIRED_FN) {
    assert.match(harness, new RegExp(name), `missing Function scenario ${name}`);
  }
  for (const name of REQUIRED_TG) {
    assert.match(harness, new RegExp(name), `missing Trigger scenario ${name}`);
  }
  for (const name of REQUIRED_LEGACY) {
    assert.match(harness, new RegExp(name), `missing Legacy scenario ${name}`);
  }
  for (const name of REQUIRED_MIXED) {
    assert.match(harness, new RegExp(name), `missing Mixed scenario ${name}`);
  }
  for (const name of REQUIRED_POST) {
    assert.match(harness, new RegExp(name), `missing Postcondition scenario ${name}`);
  }

  assert.match(harness, /GENERIC_SOCIAL_A_RELATION_PRECONDITION_FAILED/);
  assert.match(harness, /GENERIC_SOCIAL_A_LEGACY_COLUMN_SHAPE_MISMATCH/);
  assert.match(harness, /GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE/);
  assert.match(harness, /GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH/);
  assert.match(harness, /GENERIC_SOCIAL_A_MIXED_STATE_REJECTED/);
  assert.match(harness, /GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH/);
  assert.match(harness, /GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH/);
  assert.match(harness, /GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH/);
  assert.match(harness, /GENERIC_SOCIAL_A_POSTCONDITION_FAILED/);
  assert.match(harness, /miss_idem|view_idem/);
  assert.match(harness, /data_partial|data_tree|data_unknown|data_mis/);
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

test('historical Migration A/B and validators exist and are not mutated by harness contract expectations', () => {
  assert.ok(fs.existsSync(MIG_A));
  assert.ok(fs.existsSync(MIG_B));
  assert.ok(fs.existsSync(PRE));
  assert.ok(fs.existsSync(POST));
  const a = read(MIG_A);
  assert.match(a, /ADD COLUMN IF NOT EXISTS target_kind VARCHAR\(16\)/);
  assert.match(a, /trg_social_idempotency_sync_generic_target/);
  assert.match(a, /BEGIN;/);
  assert.match(a, /COMMIT;/);

  // Inventory checksum stability for historical migrations (harness must not rewrite them)
  if (fs.existsSync(PATH_INV)) {
    const pathInv = JSON.parse(read(PATH_INV));
    const migA = pathInv.entries.find((e) => e.path === 'scripts/migration-add-generic-social-targets.sql');
    const migB = pathInv.entries.find((e) => e.path === 'scripts/migration-b-generic-social-targets-cutover.sql');
    assert.ok(migA);
    assert.ok(migB);
    assert.equal(migA.content_checksum, sha256(MIG_A));
    assert.equal(migB.content_checksum, sha256(MIG_B));
  }
});

test('DB engine tests classified supplemental DB_ENGINE_EXECUTION for both suites', () => {
  const enginePath = 'tests/db-engine/generic-social-a-postgres.test.cjs';
  const guardEngine = 'tests/db-engine/generic-social-a-guard-postgres.test.cjs';
  const contractPath = 'tests/contracts/generic-social-a-db-engine-harness-contract.test.cjs';
  const guardContract = 'tests/contracts/generic-social-a-execution-guard-contract.test.cjs';
  assert.deepEqual(inv.defaultCiGlobs, [
    'tests/smoke/*.test.cjs',
    'tests/routes/*.test.cjs',
    'tests/contracts/*.test.cjs',
  ]);
  const supp = inv.supplemental.find((s) => s.path === enginePath);
  assert.ok(supp);
  assert.equal(supp.defaultCi, false);
  assert.equal(supp.layer, 'DB_ENGINE_EXECUTION');
  const guardSupp = inv.supplemental.find((s) => s.path === guardEngine);
  assert.ok(guardSupp);
  assert.equal(guardSupp.defaultCi, false);
  assert.equal(guardSupp.layer, 'DB_ENGINE_EXECUTION');
  const entry = inv.entries.find((e) => e.path === contractPath);
  assert.ok(entry);
  assert.equal(entry.layer, 'SOURCE_STATIC');
  const guardEntry = inv.entries.find((e) => e.path === guardContract);
  assert.ok(guardEntry);
  assert.equal(guardEntry.layer, 'SOURCE_STATIC');
  assert.equal(inv.entries.some((e) => e.path === enginePath), false);
});
