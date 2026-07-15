/**
 * Source-static contract for Migration A execution-guard validators.
 * Does not execute PostgreSQL.
 *
 * Refs: #3536, #3534, #3262, #3459, #3458, #1882
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
const PRE = path.join(ROOT, 'scripts/validate-generic-social-a-preflight.sql');
const POST = path.join(ROOT, 'scripts/validate-generic-social-a-postcondition.sql');
const MIG_A = path.join(ROOT, 'scripts/migration-add-generic-social-targets.sql');
const MIG_B = path.join(ROOT, 'scripts/migration-b-generic-social-targets-cutover.sql');
const RUNBOOK = path.join(ROOT, 'docs/ops/generic-social-targets-migration-a-runbook.md');
const INV = path.join(ROOT, 'docs/architecture/migration-path-inventory.json');
const HARNESS = path.join(ROOT, 'tests/db-engine/generic-social-a-guard-postgres.test.cjs');
const FIXTURE = path.join(ROOT, 'tests/db-engine/fixtures/generic-social-a-guard-legacy.sql');
const HELPER = path.join(ROOT, 'tests/db-engine/helpers/generic-social-a-guard-catalog.cjs');
const CLASS = path.join(ROOT, 'tests/test-layer-classification.json');

function read(p) {
  assert.ok(fs.existsSync(p), `missing ${path.relative(ROOT, p)}`);
  return fs.readFileSync(p, 'utf8');
}

function sha256(p) {
  return 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

const MUTATION_RE =
  /\b(CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE|GRANT|REVOKE)\b/i;

test('historical Migration A SQL unchanged checksum', () => {
  const inv = JSON.parse(read(INV));
  const entry = inv.entries.find((e) => e.path === 'scripts/migration-add-generic-social-targets.sql');
  assert.ok(entry);
  assert.equal(entry.content_checksum, sha256(MIG_A));
  assert.match(entry.recommended_disposition || entry.evidence || '', /direct|prohibit|historical|canonical/i);
});

test('validators exist, are read-only, and encode exact catalog checks', () => {
  const pre = read(PRE);
  const post = read(POST);
  assert.equal(MUTATION_RE.test(pre.replace(/--.*/g, '')), false, 'preflight must not mutate');
  assert.equal(MUTATION_RE.test(post.replace(/--.*/g, '')), false, 'postcondition must not mutate');
  assert.match(pre, /GENERIC_SOCIAL_A_RELATION_PRECONDITION_FAILED/);
  assert.match(pre, /GENERIC_SOCIAL_A_LEGACY_COLUMN_SHAPE_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE/);
  assert.match(pre, /GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_A_MIXED_STATE_REJECTED/);
  assert.match(pre, /pg_get_constraintdef/);
  assert.match(pre, /t_type\s*<>\s*23/);
  assert.match(pre, /t_enabled\s*<>\s*'O'/);
  assert.match(pre, /prosrc/);
  assert.match(pre, /sha256/);
  assert.match(pre, /encode/);
  assert.equal(/position\s*\(.*\s+IN\s+.*\)\s*=\s*0/i.test(pre), false, 'CHECK/function substring-only validation 없어야 함');
  assert.match(post, /GENERIC_SOCIAL_A_POSTCONDITION_FAILED/);
  assert.match(post, /t_type\s*<>\s*23/);
  assert.match(post, /t_enabled\s*<>\s*'O'/);
  assert.match(post, /prosrc/);
  assert.match(post, /sha256/);
  assert.equal(/position\s*\(.*\s+IN\s+.*\)\s*=\s*0/i.test(post), false, 'post CHECK/function substring-only validation 없어야 함');
  assert.equal(/RAISE NOTICE/i.test(pre), false);
  assert.equal(/SELECT \* FROM social_/i.test(pre), false);
});

test('package script and CI job for guard engine', () => {
  const pkg = JSON.parse(read(PKG));
  assert.match(pkg.scripts['test:db-engine:generic-social-a-guard'], /generic-social-a-guard-postgres/);
  assert.equal(
    pkg.scripts.test,
    'node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs'
  );
  const ci = read(CI);
  assert.match(ci, /db-engine-generic-social-a-guard\s*:/);
  assert.match(ci, /npm run test:db-engine:generic-social-a-guard/);
  assert.match(ci, /postgres:17\.4-bookworm/);
  assert.match(ci, /170004/);
  assert.match(ci, /db-engine-tree-comments\s*:/);
  assert.match(ci, /db-engine-trees-schema\s*:/);
  assert.equal(/DATABASE_URL/i.test(ci), false);
  assert.equal(/secrets\./i.test(ci), false);
});

test('runbook prohibits direct new Migration A execution', () => {
  const rb = read(RUNBOOK);
  assert.match(rb, /direct new execution prohibited|Direct new execution is prohibited/i);
  assert.match(rb, /historical applied artifact|historically applied/i);
  assert.match(rb, /preflight/i);
  assert.match(rb, /postcondition/i);
  assert.match(rb, /Historical command/i);
  assert.equal(/psql "\$DATABASE_URL" -f scripts\/migration-add-generic-social-targets\.sql/.test(rb) &&
    !/Historical command/i.test(rb), false);
});

test('inventory records validators and keeps Migration A checksum stable', () => {
  const inv = JSON.parse(read(INV));
  const migA = inv.entries.find((e) => e.path === 'scripts/migration-add-generic-social-targets.sql');
  assert.equal(migA.content_checksum, sha256(MIG_A));
  assert.match(JSON.stringify(migA), /direct|prohibit|historical/i);

  const pre = inv.entries.find((e) => e.path === 'scripts/validate-generic-social-a-preflight.sql');
  const post = inv.entries.find((e) => e.path === 'scripts/validate-generic-social-a-postcondition.sql');
  assert.ok(pre);
  assert.ok(post);
  assert.equal(pre.content_checksum, sha256(PRE));
  assert.equal(post.content_checksum, sha256(POST));
  assert.equal(pre.classification, 'CANONICAL_CANDIDATE');
  assert.equal(post.classification, 'CANONICAL_CANDIDATE');
  assert.match(pre.operation_class || '', /read.?only|validator|guard/i);

  const rb = inv.entries.find((e) => e.path === 'docs/ops/generic-social-targets-migration-a-runbook.md');
  assert.ok(rb);
  assert.equal(rb.content_checksum, sha256(RUNBOOK));

  const migB = inv.entries.find((e) => e.path === 'scripts/migration-b-generic-social-targets-cutover.sql');
  assert.equal(migB.content_checksum, sha256(MIG_B));
});

test('engine harness encodes guarded sequence and rejection matrix', () => {
  const h = read(HARNESS);
  assert.match(h, /validate-generic-social-a-preflight\.sql/);
  assert.match(h, /migration-add-generic-social-targets\.sql/);
  assert.match(h, /validate-generic-social-a-postcondition\.sql/);
  assert.match(h, /guarded happy path/);
  assert.match(h, /second apply/);
  assert.match(h, /assertNoMutation/);
  assert.match(h, /assert\.equal\(cat,\s*expectedCategory\)/, 'strict category equality');
  assert.equal(/startsWith\('GENERIC_SOCIAL_A_'\)/.test(h), false, 'permissive fallback 없어야 함');
  assert.match(h, /check_wrong_pair/);
  assert.match(h, /check_wrong_vocab/);
  assert.match(h, /tg_wrong_fn/);
  assert.match(h, /data_partial/);
  assert.match(h, /mixed_audit_partial/);
  assert.match(h, /wrong_check/);
  assert.match(h, /sec_def_function/);
  assert.match(h, /Migration A invocation count = 0/);
  assert.match(h, /postcondition invocation count = 0/);
  assert.match(h, /row_to_json|rowFp/);
  assert.equal(/(?:^|[^=])\s*runSql\s*\(\s*MIG_B\s*\)/m.test(h), false);
  assert.ok(fs.existsSync(FIXTURE));
  assert.ok(fs.existsSync(HELPER));
  const helper = read(HELPER);
  assert.match(helper, /row_to_json/);
  assert.equal(/console\.(log|info)/.test(helper), false);
  assert.equal(/GENERIC_SOCIAL_A_CAPTURE_FINGERPRINTS/.test(h), false, 'temporary capture 없음');
});

test('classification inventory includes guard contract and engine test', () => {
  const inv = JSON.parse(read(CLASS));
  const contract = 'tests/contracts/generic-social-a-execution-guard-contract.test.cjs';
  const engine = 'tests/db-engine/generic-social-a-guard-postgres.test.cjs';
  assert.ok(inv.entries.some((e) => e.path === contract && e.layer === 'SOURCE_STATIC'));
  const supp = inv.supplemental.find((s) => s.path === engine);
  assert.ok(supp);
  assert.equal(supp.layer, 'DB_ENGINE_EXECUTION');
  assert.equal(supp.defaultCi, false);
});
