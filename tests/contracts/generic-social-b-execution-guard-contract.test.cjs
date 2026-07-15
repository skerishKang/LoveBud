/**
 * Source-static contract for Migration B execution-guard validators.
 * Does not execute PostgreSQL.
 *
 * Refs: #3538, #3459, #3458, #3425, #1882
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
const PRE = path.join(ROOT, 'scripts/validate-generic-social-b-preflight.sql');
const POST = path.join(ROOT, 'scripts/validate-generic-social-b-postcondition.sql');
const MIG_A = path.join(ROOT, 'scripts/migration-add-generic-social-targets.sql');
const MIG_B = path.join(ROOT, 'scripts/migration-b-generic-social-targets-cutover.sql');
const RUNBOOK = path.join(ROOT, 'docs/ops/generic-social-targets-migration-b-runbook.md');
const INV = path.join(ROOT, 'docs/architecture/migration-path-inventory.json');
const HARNESS = path.join(ROOT, 'tests/db-engine/generic-social-b-guard-postgres.test.cjs');
const FIXTURE = path.join(ROOT, 'tests/db-engine/fixtures/generic-social-b-guard-legacy.sql');
const HELPER = path.join(ROOT, 'tests/db-engine/helpers/generic-social-b-guard-catalog.cjs');
const CLASS = path.join(ROOT, 'tests/test-layer-classification.json');

function read(p) {
  assert.ok(fs.existsSync(p), `missing ${path.relative(ROOT, p)}`);
  return fs.readFileSync(p, 'utf8');
}

function sha256(p) {
  const buf = fs.readFileSync(p);
  const lfBytes = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'));
  return 'sha256:' + crypto.createHash('sha256').update(lfBytes).digest('hex');
}

function stripSqlNoise(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'([^']|'')*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, '$$');
}

const MUTATION_RE =
  /\b(CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE|GRANT|REVOKE)\b/i;

test('historical Migration A/B SQL unchanged checksum', () => {
  const inv = JSON.parse(read(INV));
  const a = inv.entries.find((e) => e.path === 'scripts/migration-add-generic-social-targets.sql');
  const b = inv.entries.find((e) => e.path === 'scripts/migration-b-generic-social-targets-cutover.sql');
  assert.ok(a);
  assert.ok(b);
  assert.equal(a.content_checksum, sha256(MIG_A));
  assert.equal(b.content_checksum, sha256(MIG_B));
});

test('B validators exist, are read-only, and encode dual-state checks', () => {
  const pre = read(PRE);
  const post = read(POST);
  assert.equal(MUTATION_RE.test(stripSqlNoise(pre)), false, 'preflight must not mutate');
  assert.equal(MUTATION_RE.test(stripSqlNoise(post)), false, 'postcondition must not mutate');
  assert.match(pre, /GENERIC_SOCIAL_B_RELATION_PRECONDITION_FAILED/);
  assert.match(pre, /GENERIC_SOCIAL_B_LEGACY_COLUMN_SHAPE_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_B_DATA_STATE_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_B_CHECK_DEFINITION_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_B_FUNCTION_DEFINITION_MISMATCH/);
  assert.match(pre, /GENERIC_SOCIAL_B_MIXED_STATE_REJECTED/);
  assert.match(pre, /to_regprocedure\('public\.sync_social_idempotency_generic_target_from_legacy_memory\(\)'\)/);
  assert.match(pre, /social_idempotency_memory_legacy_match_check/);
  assert.match(pre, /social_idempotency_tree_legacy_null_check/);
  assert.match(post, /GENERIC_SOCIAL_B_POSTCONDITION_FAILED/);
  assert.equal(/GENERIC_SOCIAL_B_FUNCTION_DEFINITION_MISMATCH/.test(post), false);
  assert.match(post, /to_regprocedure\('public\.sync_social_audit_generic_target_from_legacy_memory\(\)'\)/);
});

test('package script and CI job for B guard engine', () => {
  const pkg = JSON.parse(read(PKG));
  assert.match(pkg.scripts['test:db-engine:generic-social-b-guard'], /generic-social-b-guard-postgres/);
  assert.equal(
    pkg.scripts.test,
    'node --test tests/smoke/*.test.cjs tests/routes/*.test.cjs tests/contracts/*.test.cjs'
  );
  const ci = read(CI);
  assert.match(ci, /db-engine-generic-social-b-guard\s*:/);
  assert.match(ci, /npm run test:db-engine:generic-social-b-guard/);
  assert.match(ci, /db-engine-generic-social-a-guard\s*:/);
  assert.match(ci, /db-engine-generic-social-a\s*:/);
  assert.match(ci, /postgres:17\.4-bookworm/);
  assert.match(ci, /170004/);
  assert.equal(/DATABASE_URL/i.test(ci), false);
  assert.equal(/secrets\./i.test(ci), false);
});

test('runbook prohibits direct new Migration B execution and requires validators', () => {
  const rb = read(RUNBOOK);
  assert.match(rb, /direct new execution prohibited|Direct new execution is prohibited|validator/i);
  assert.match(rb, /preflight/i);
  assert.match(rb, /postcondition/i);
  assert.match(rb, /validate-generic-social-b-preflight\.sql/);
  assert.match(rb, /validate-generic-social-b-postcondition\.sql/);
  assert.match(rb, /Historical command|historical/i);
});

test('inventory records B validators and keeps Migration A/B checksums stable', () => {
  const inv = JSON.parse(read(INV));
  assert.equal(
    inv.entries.find((e) => e.path === 'scripts/migration-add-generic-social-targets.sql').content_checksum,
    sha256(MIG_A)
  );
  assert.equal(
    inv.entries.find((e) => e.path === 'scripts/migration-b-generic-social-targets-cutover.sql').content_checksum,
    sha256(MIG_B)
  );
  const pre = inv.entries.find((e) => e.path === 'scripts/validate-generic-social-b-preflight.sql');
  const post = inv.entries.find((e) => e.path === 'scripts/validate-generic-social-b-postcondition.sql');
  assert.ok(pre);
  assert.ok(post);
  assert.equal(pre.content_checksum, sha256(PRE));
  assert.equal(post.content_checksum, sha256(POST));
  assert.equal(pre.classification, 'CANONICAL_CANDIDATE');
  assert.equal(post.classification, 'CANONICAL_CANDIDATE');
  const rb = inv.entries.find((e) => e.path === 'docs/ops/generic-social-targets-migration-b-runbook.md');
  assert.ok(rb);
  assert.equal(rb.content_checksum, sha256(RUNBOOK));
});

test('engine harness encodes guarded B sequence and rejection matrix', () => {
  const h = read(HARNESS);
  assert.match(h, /validate-generic-social-b-preflight\.sql/);
  assert.match(h, /migration-b-generic-social-targets-cutover\.sql/);
  assert.match(h, /validate-generic-social-b-postcondition\.sql/);
  assert.match(h, /runGuardedMigrationBSequence/);
  assert.match(h, /runGuardedMigrationASequence/);
  assert.match(h, /assert\.equal\(cat,\s*expectedCategory\)/);
  assert.equal(/startsWith\('GENERIC_SOCIAL_B_'\)/.test(h), false);
  assert.match(h, /Migration B invocation count = 0/);
  assert.match(h, /postcondition invocation count = 0/);
  assert.match(h, /preflight invocation = 1/);
  assert.match(h, /b-guard happy path STATE_A/);
  assert.match(h, /b-guard second apply no-op/);
  assert.match(h, /b-guard preflight accepts STATE_A/);
  assert.match(h, /b-guard preflight accepts STATE_B/);
  assert.match(h, /compat_idempotency_legacy_only|compat_idempotency_tree/);
  assert.match(h, /compat_audit_legacy_only|compat_audit_tree/);
  assert.match(h, /GENERIC_SOCIAL_B_POSTCONDITION_FAILED/);
  assert.match(h, /GENERIC_SOCIAL_B_MIXED_STATE_REJECTED/);
  assert.match(h, /GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH/);
  assert.equal(/(?:^|[^=])\s*runSql\s*\(\s*MIG_B\s*\)/m.test(h.replace(/function runGuardedMigrationBSequence[\s\S]*?\n}/, '')), false);
  assert.ok(fs.existsSync(FIXTURE));
  assert.ok(fs.existsSync(HELPER));
  assert.equal(/process\.env\.DATABASE_URL/i.test(h), false);
});

test('classification inventory includes B guard contract and engine test', () => {
  const inv = JSON.parse(read(CLASS));
  const contract = 'tests/contracts/generic-social-b-execution-guard-contract.test.cjs';
  const engine = 'tests/db-engine/generic-social-b-guard-postgres.test.cjs';
  assert.ok(inv.entries.some((e) => e.path === contract && e.layer === 'SOURCE_STATIC'));
  const supp = inv.supplemental.find((s) => s.path === engine);
  assert.ok(supp);
  assert.equal(supp.layer, 'DB_ENGINE_EXECUTION');
  assert.equal(supp.defaultCi, false);
});
