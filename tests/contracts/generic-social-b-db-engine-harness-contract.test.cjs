/**
 * Source-static contract for Migration B disposable PostgreSQL rehearsal harness.
 * Does not connect to PostgreSQL or execute migration SQL.
 *
 * Refs: #3540, #3538, #3459, #3458, #3425, #1882
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
const HARNESS = path.join(ROOT, 'tests/db-engine/generic-social-b-postgres.test.cjs');
const FIXTURE_NE = path.join(ROOT, 'tests/db-engine/fixtures/generic-social-b-rehearsal-legacy.sql');
const FIXTURE_EMPTY = path.join(ROOT, 'tests/db-engine/fixtures/generic-social-b-rehearsal-empty-legacy.sql');
const HELPER = path.join(ROOT, 'tests/db-engine/helpers/generic-social-b-guard-catalog.cjs');
const SHARED = path.join(ROOT, 'tests/db-engine/helpers/postgres-disposable-harness.cjs');
const PRE = path.join(ROOT, 'scripts/validate-generic-social-b-preflight.sql');
const POST = path.join(ROOT, 'scripts/validate-generic-social-b-postcondition.sql');
const MIG_A = path.join(ROOT, 'scripts/migration-add-generic-social-targets.sql');
const MIG_B = path.join(ROOT, 'scripts/migration-b-generic-social-targets-cutover.sql');
const A_PRE = path.join(ROOT, 'scripts/validate-generic-social-a-preflight.sql');
const A_POST = path.join(ROOT, 'scripts/validate-generic-social-a-postcondition.sql');
const INV = path.join(ROOT, 'tests/test-layer-classification.json');
const PATH_INV = path.join(ROOT, 'docs/architecture/migration-path-inventory.json');
const GUARD = path.join(ROOT, 'tests/db-engine/generic-social-b-guard-postgres.test.cjs');

const EXACT_B_CHECK_HASHES = [
  'a9426625ade8fee8c60a0f806b081ee98dc30c718bfc47c3e1940bc465534138',
  '719a0529b5e72e2428e62316ec68e01a0ab67f7c7ee4b7af9895b7cd7624a833',
  '0cc87d4fd35f8664aac7f0193f35735fa2becf6fcf7f44962097064cbab9388b',
  'e860bb84955b8be15627c0943077d6710243831d9a1ecaa90316bf90f7783a1b',
];
const EXACT_B_FUNC_HASHES = [
  'e5f8ccacb82525bc43d5d6b95f61b0dc6c33b59b5a81591d4d0d4d350ceafebe',
  'd50e3d4a69272ccfb81689a70718099b5e48ba7fb0648a9f0e16695e5763d3d0',
];

const REQUIRED_MARKERS = [
  'rehearsal_nonempty_state_a',
  'rehearsal_empty_state_a',
  'rehearsal_first_guarded_b',
  'rehearsal_first_idempotency_compatibility',
  'rehearsal_first_audit_compatibility',
  'rehearsal_second_apply_noop',
  'second_apply_noop_before_compatibility',
  'rehearsal_second_idempotency_compatibility',
  'rehearsal_second_audit_compatibility',
  'rehearsal_empty_memory_tree_smoke',
  'multi-row',
  'assertIdempotencyBRehearsalCompatibility',
  'assertAuditBRehearsalCompatibility',
  'extractPreservationProjection',
  'extractApprovedDelta',
  'runGuardedMigrationBSequence',
  'runGuardedMigrationASequence',
  'LOCAL_DB_ENGINE',
];

function read(p) {
  assert.ok(fs.existsSync(p), `missing ${path.relative(ROOT, p)}`);
  return fs.readFileSync(p, 'utf8');
}

function sha256(p) {
  const buf = fs.readFileSync(p);
  const lfBytes = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'));
  return 'sha256:' + crypto.createHash('sha256').update(lfBytes).digest('hex');
}

test('historical Migration A/B SQL checksums unchanged vs inventory', () => {
  const inv = JSON.parse(read(PATH_INV));
  const a = inv.entries.find((e) => e.path === 'scripts/migration-add-generic-social-targets.sql');
  const b = inv.entries.find((e) => e.path === 'scripts/migration-b-generic-social-targets-cutover.sql');
  assert.ok(a && b);
  assert.equal(a.content_checksum, sha256(MIG_A));
  assert.equal(b.content_checksum, sha256(MIG_B));
});

test('package script, CI job, and default npm test isolation', () => {
  const pkg = JSON.parse(read(PKG));
  assert.match(pkg.scripts['test:db-engine:generic-social-b'], /generic-social-b-postgres\.test\.cjs/);
  assert.match(pkg.scripts['test:db-engine:generic-social-b-guard'], /generic-social-b-guard-postgres/);
  assert.equal(
    pkg.scripts.test,
    'node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs'
  );
  assert.equal(pkg.scripts.test.includes('db-engine'), false);

  const ci = read(CI);
  assert.match(ci, /db-engine-generic-social-b\s*:/);
  assert.match(ci, /npm run test:db-engine:generic-social-b/);
  assert.match(ci, /db-engine-generic-social-b-guard\s*:/);
  assert.match(ci, /db-engine-generic-social-a\s*:/);
  assert.match(ci, /db-engine-generic-social-a-guard\s*:/);
  assert.match(ci, /postgres:17\.4-bookworm/);
  assert.match(ci, /170004/);
  assert.equal(/DATABASE_URL/i.test(ci), false);
  // job block must assert version and use synthetic password
  const jobIdx = ci.indexOf('db-engine-generic-social-b:');
  assert.ok(jobIdx > 0);
  const jobSlice = ci.slice(jobIdx, jobIdx + 2500);
  assert.match(jobSlice, /server_version_num/);
  assert.match(jobSlice, /170004/);
  assert.match(jobSlice, /LB_TEST_PGHOST/);
  assert.match(jobSlice, /github\.run_id/);
});

test('B rehearsal harness depends on B preflight/postcondition and A guards', () => {
  const h = read(HARNESS);
  assert.ok(fs.existsSync(PRE));
  assert.ok(fs.existsSync(POST));
  assert.ok(fs.existsSync(A_PRE));
  assert.ok(fs.existsSync(A_POST));
  assert.ok(fs.existsSync(HELPER));
  assert.ok(fs.existsSync(SHARED));
  assert.ok(fs.existsSync(FIXTURE_NE));
  assert.ok(fs.existsSync(FIXTURE_EMPTY));
  assert.ok(fs.existsSync(GUARD), 'B guard suite must remain present');

  assert.match(h, /validate-generic-social-b-preflight\.sql/);
  assert.match(h, /migration-b-generic-social-targets-cutover\.sql/);
  assert.match(h, /validate-generic-social-b-postcondition\.sql/);
  assert.match(h, /validate-generic-social-a-preflight\.sql/);
  assert.match(h, /migration-add-generic-social-targets\.sql/);
  assert.match(h, /validate-generic-social-a-postcondition\.sql/);
  assert.match(h, /generic-social-b-guard-catalog/);
  assert.match(h, /postgres-disposable-harness/);
});

test('exact B_PRE → MIG_B → B_POST order and no unguarded MIG_B', () => {
  const h = read(HARNESS);
  const helper = h.match(/function runGuardedMigrationBSequence[\s\S]*?^}/m);
  assert.ok(helper, 'runGuardedMigrationBSequence required');
  const body = helper[0];
  const iPre = body.indexOf('runSql(B_PRE)');
  const iMig = body.indexOf('runSql(MIG_B)');
  const iPost = body.indexOf('runSql(B_POST)');
  assert.ok(iPre >= 0 && iMig > iPre && iPost > iMig, 'B_PRE < MIG_B < B_POST');

  const withoutHelper = h.replace(
    /function runGuardedMigrationBSequence[\s\S]*?^}/m,
    'function runGuardedMigrationBSequence(){}'
  );
  // No executable invocation outside helper (string probes alone are allowed)
  assert.equal(/\brunSql\s*\(\s*MIG_B\s*\)/.test(withoutHelper), false);
  assert.equal(/process\.env\.DATABASE_URL/i.test(h), false);
  assert.equal(/rollback|down migration/i.test(h), false);
});

test('required rehearsal markers, multi-row, empty, compatibility, no-op order', () => {
  const h = read(HARNESS);
  for (const m of REQUIRED_MARKERS) {
    assert.ok(h.includes(m), `missing marker ${m}`);
  }
  const ne = read(FIXTURE_NE);
  assert.ok((ne.match(/INSERT INTO public\.social_idempotency/g) || []).length >= 1);
  assert.ok((ne.match(/syn_actor_/g) || []).length >= 3, 'multi-row varied actors');
  assert.ok((ne.match(/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa/g) || []).length >= 3);

  const empty = read(FIXTURE_EMPTY);
  assert.equal(/INSERT INTO public\.social_idempotency/.test(empty), false);
  assert.equal(/INSERT INTO public\.social_audit_log/.test(empty), false);
  assert.match(empty, /lb_unrelated_marker/);

  // second no-op before second compatibility
  const noop = h.indexOf('second_apply_noop_before_compatibility');
  const secondIdem = h.indexOf('rehearsal_second_idempotency_compatibility');
  const firstIdem = h.indexOf('rehearsal_first_idempotency_compatibility');
  assert.ok(firstIdem > 0 && noop > firstIdem && secondIdem > noop);

  // exact object fingerprints
  for (const hash of EXACT_B_CHECK_HASHES) {
    assert.ok(h.includes(hash), `missing B CHECK hash ${hash}`);
  }
  for (const hash of EXACT_B_FUNC_HASHES) {
    assert.ok(h.includes(hash), `missing B function hash ${hash}`);
  }

  const helper = read(HELPER);
  assert.match(helper, /COMPLETE_CATALOG_PROJECTION_FIELDS/);
  assert.match(helper, /extractPreservationProjection/);
  assert.match(helper, /extractApprovedDelta/);
});

test('bounded output and LOCAL_DB_ENGINE policy markers', () => {
  const h = read(HARNESS);
  assert.match(h, /LOCAL_DB_ENGINE/);
  assert.match(h, /NOT_RUN|pass\(/);
  assert.equal(/console\.log\(.*row/i.test(h), false);
  assert.equal(/process\.env\.DATABASE_URL/i.test(h), false);
  // 170004 must appear in CI, not necessarily harness
  assert.match(read(CI), /170004/);
});

test('test-layer classification for B rehearsal engine and contract', () => {
  const inv = JSON.parse(read(INV));
  const engine = 'tests/db-engine/generic-social-b-postgres.test.cjs';
  const contract = 'tests/contracts/generic-social-b-db-engine-harness-contract.test.cjs';
  const entry = inv.entries.find((e) => e.path === contract);
  assert.ok(entry, 'contract classification missing');
  assert.equal(entry.layer, 'SOURCE_STATIC');
  const supp = inv.supplemental.find((s) => s.path === engine);
  assert.ok(supp, 'engine supplemental classification missing');
  assert.equal(supp.layer, 'DB_ENGINE_EXECUTION');
  assert.equal(supp.defaultCi, false);
});
