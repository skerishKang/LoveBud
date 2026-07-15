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

const EXACT_B_CHECK_HASHES = {
  social_idempotency_memory_legacy_match_check:
    'a9426625ade8fee8c60a0f806b081ee98dc30c718bfc47c3e1940bc465534138',
  social_idempotency_tree_legacy_null_check:
    '719a0529b5e72e2428e62316ec68e01a0ab67f7c7ee4b7af9895b7cd7624a833',
  social_audit_log_memory_legacy_match_check:
    '0cc87d4fd35f8664aac7f0193f35735fa2becf6fcf7f44962097064cbab9388b',
  social_audit_log_tree_legacy_null_check:
    'e860bb84955b8be15627c0943077d6710243831d9a1ecaa90316bf90f7783a1b',
};

const EXACT_B_FUNCTION_HASHES = {
  sync_social_idempotency_generic_target_from_legacy_memory:
    'e5f8ccacb82525bc43d5d6b95f61b0dc6c33b59b5a81591d4d0d4d350ceafebe',
  sync_social_audit_generic_target_from_legacy_memory:
    'd50e3d4a69272ccfb81689a70718099b5e48ba7fb0648a9f0e16695e5763d3d0',
};

const REQUIRED_RELATION_SCENARIOS = [
  'missing_idem',
  'missing_audit',
  'view_idem',
  'view_audit',
];

const REQUIRED_LEGACY_SCENARIOS = [
  'legacy_missing_idem',
  'legacy_type_idem',
  'legacy_default_idem',
  'legacy_missing_audit',
  'legacy_type_audit',
  'legacy_default_audit',
  'legacy_partial_b_nullability',
  'legacy_cross_table_mixed_nullability',
];

const REQUIRED_GENERIC_SCENARIOS = [
  'generic_missing_kind_idem',
  'generic_missing_id_idem',
  'generic_kind_type_idem',
  'generic_kind_length_idem',
  'generic_kind_default_idem',
  'generic_id_type_idem',
  'generic_id_default_idem',
  'generic_missing_kind_audit',
  'generic_missing_id_audit',
  'generic_kind_type_audit',
  'generic_kind_length_audit',
  'generic_kind_default_audit',
  'generic_id_type_audit',
  'generic_id_default_audit',
  'generic_partial_not_null_idem',
  'generic_partial_not_null_audit',
  'generic_cross_table_mixed',
];

const REQUIRED_DATA_SCENARIOS = [
  'data_null_pair_idem',
  'data_partial_pair_idem',
  'data_unknown_idem',
  'data_memory_mismatch_idem',
  'data_tree_legacy_idem',
  'data_null_pair_audit',
  'data_partial_pair_audit',
  'data_unknown_audit',
  'data_memory_mismatch_audit',
  'data_tree_legacy_audit',
];

const REQUIRED_A_CHECK_SCENARIOS = [
  'a_check_wrong_definition',
  'a_check_weak_definition',
  'a_check_not_valid',
  'a_check_wrong_relation',
  'a_check_duplicate_or_shadow',
];

const REQUIRED_A_FUNCTION_SCENARIOS = [
  'a_fn_wrong_body_idem',
  'a_fn_early_return_idem',
  'a_fn_missing_rejection_idem',
  'a_fn_sql_overload_idem',
  'a_fn_plpgsql_overload_idem',
  'a_fn_security_definer_idem',
  'a_fn_wrong_volatility_idem',
  'a_fn_wrong_parallel_idem',
  'a_fn_wrong_return_idem',
  'a_fn_altered_config_idem',
  'a_fn_wrong_body_audit',
  'a_fn_early_return_audit',
  'a_fn_missing_rejection_audit',
  'a_fn_sql_overload_audit',
  'a_fn_plpgsql_overload_audit',
  'a_fn_security_definer_audit',
  'a_fn_wrong_volatility_audit',
  'a_fn_wrong_parallel_audit',
  'a_fn_wrong_return_audit',
  'a_fn_altered_config_audit',
];

const REQUIRED_TRIGGER_SCENARIOS = [
  'a_tg_disabled_idem',
  'a_tg_always_idem',
  'a_tg_replica_idem',
  'a_tg_after_idem',
  'a_tg_insert_only_idem',
  'a_tg_update_only_idem',
  'a_tg_statement_idem',
  'a_tg_wrong_function_idem',
  'a_tg_delete_event_idem',
  'a_tg_wrong_relation_idem',
  'a_tg_disabled_audit',
  'a_tg_always_audit',
  'a_tg_replica_audit',
  'a_tg_after_audit',
  'a_tg_insert_only_audit',
  'a_tg_update_only_audit',
  'a_tg_statement_audit',
  'a_tg_wrong_function_audit',
  'a_tg_delete_event_audit',
  'a_tg_wrong_relation_audit',
];

const REQUIRED_B_MIXED_SCENARIOS = [
  'one_b_check_only',
  'wrong_b_memory_check',
  'weak_b_memory_check',
  'wrong_b_tree_check',
  'b_check_not_valid',
  'b_check_wrong_relation',
  'b_check_duplicate_or_shadow',
  'b_function_body_with_state_a_columns',
  'one_function_b_one_function_a',
  'state_b_columns_with_a_function',
  'b_checks_with_a_function',
  'one_table_state_a_one_table_state_b',
];

const REQUIRED_COMPATIBILITY_MARKERS = [
  'compat_first_idempotency_legacy_only',
  'compat_first_audit_legacy_only',
  'compat_second_idempotency_legacy_only',
  'compat_second_audit_legacy_only',
  'assertIdempotencyBCompatibility',
  'assertAuditBCompatibility',
  "assertIdempotencyBCompatibility(client, 'first')",
  "assertAuditBCompatibility(client, 'first')",
  "assertIdempotencyBCompatibility(client, 'second')",
  "assertAuditBCompatibility(client, 'second')",
  'second_apply_noop_before_compatibility',
];

const REQUIRED_POSTCONDITION_SCENARIOS = [
  'post_legacy_not_null_idem',
  'post_legacy_not_null_audit',
  'post_kind_nullable_idem',
  'post_id_nullable_idem',
  'post_kind_nullable_audit',
  'post_id_nullable_audit',
  'post_kind_default',
  'post_id_default',
  'post_a_check_wrong',
  'post_a_check_not_valid',
  'post_a_check_shadow',
  'post_b_memory_check_wrong',
  'post_b_tree_check_wrong',
  'post_b_check_not_valid',
  'post_b_check_shadow',
  'post_fn_wrong_body_idem',
  'post_fn_wrong_body_audit',
  'post_fn_overload',
  'post_fn_security_definer',
  'post_fn_wrong_volatility',
  'post_fn_wrong_parallel',
  'post_fn_wrong_return',
  'post_fn_altered_config',
  'post_tg_disabled',
  'post_tg_always',
  'post_tg_replica',
  'post_tg_wrong_function',
  'post_tg_insert_only',
  'post_tg_after',
  'post_tg_statement',
  'post_data_memory_mismatch_idem',
  'post_data_tree_legacy_idem',
  'post_data_unknown_idem',
  'post_data_memory_mismatch_audit',
  'post_data_tree_legacy_audit',
  'post_data_unknown_audit',
];

const REQUIRED_CATALOG_PROJECTION_FIELDS = [
  'schema',
  'relationName',
  'relkind',
  'owner',
  'acl',
  'legacyColumnMetadata',
  'allColumnMetadata',
  'pkAndPreexistingConstraints',
  'constraintDefinitionsAndValidation',
  'allIndexesIncludingPrimary',
  'indexUniquePrimaryValid',
  'normalizedIndexDef',
  'triggerNameTypeEnabledRelationFunctionOid',
  'functionFullAttributeBodyFingerprint',
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

function stripSqlNoise(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'([^']|'')*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, '$$');
}

const MUTATION_RE =
  /\b(CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE|GRANT|REVOKE)\b/i;

function assertAllPresent(src, items, label) {
  for (const item of items) {
    assert.ok(src.includes(item), `${label} missing required marker: ${item}`);
  }
}

test('historical Migration A/B SQL unchanged checksum', () => {
  const inv = JSON.parse(read(INV));
  const a = inv.entries.find((e) => e.path === 'scripts/migration-add-generic-social-targets.sql');
  const b = inv.entries.find((e) => e.path === 'scripts/migration-b-generic-social-targets-cutover.sql');
  assert.ok(a);
  assert.ok(b);
  assert.equal(a.content_checksum, sha256(MIG_A));
  assert.equal(b.content_checksum, sha256(MIG_B));
});

test('B validators exist, are read-only, dual-state, and lock exact B hashes', () => {
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
  assert.match(post, /GENERIC_SOCIAL_B_POSTCONDITION_FAILED/);
  assert.equal(/GENERIC_SOCIAL_B_FUNCTION_DEFINITION_MISMATCH/.test(post), false);

  for (const [name, hash] of Object.entries(EXACT_B_CHECK_HASHES)) {
    assert.ok(pre.includes(hash), `preflight missing exact B CHECK hash for ${name}`);
    assert.ok(post.includes(hash), `postcondition missing exact B CHECK hash for ${name}`);
    assert.ok(pre.includes(name), `preflight missing B CHECK name ${name}`);
    assert.ok(post.includes(name), `postcondition missing B CHECK name ${name}`);
  }
  for (const [name, hash] of Object.entries(EXACT_B_FUNCTION_HASHES)) {
    assert.ok(pre.includes(hash), `preflight missing exact B function hash for ${name}`);
    assert.ok(post.includes(hash), `postcondition missing exact B function hash for ${name}`);
  }
  // preflight and postcondition must share identical expected B hashes
  for (const hash of Object.values(EXACT_B_CHECK_HASHES)) {
    assert.equal(pre.includes(hash), post.includes(hash));
  }
  for (const hash of Object.values(EXACT_B_FUNCTION_HASHES)) {
    assert.equal(pre.includes(hash), post.includes(hash));
  }
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

test('engine harness encodes full required evidence matrices and ordering', () => {
  const h = read(HARNESS);
  const helper = read(HELPER);

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
  assert.equal(/(?:^|[^=])\s*runSql\s*\(\s*MIG_B\s*\)/m.test(h.replace(/function runGuardedMigrationBSequence[\s\S]*?\n}/, '')), false);
  assert.ok(fs.existsSync(FIXTURE));
  assert.ok(fs.existsSync(HELPER));
  assert.equal(/process\.env\.DATABASE_URL/i.test(h), false);

  assertAllPresent(h, REQUIRED_RELATION_SCENARIOS, 'relation');
  assertAllPresent(h, REQUIRED_LEGACY_SCENARIOS, 'legacy');
  assertAllPresent(h, REQUIRED_GENERIC_SCENARIOS, 'generic');
  assertAllPresent(h, REQUIRED_DATA_SCENARIOS, 'data');
  assertAllPresent(h, REQUIRED_A_CHECK_SCENARIOS, 'a_check');
  assertAllPresent(h, REQUIRED_A_FUNCTION_SCENARIOS, 'a_function');
  assertAllPresent(h, REQUIRED_TRIGGER_SCENARIOS, 'trigger');
  assertAllPresent(h, REQUIRED_B_MIXED_SCENARIOS, 'b_mixed');
  assertAllPresent(h, REQUIRED_COMPATIBILITY_MARKERS, 'compat');
  assertAllPresent(h, REQUIRED_POSTCONDITION_SCENARIOS, 'postcondition');

  for (const hash of Object.values(EXACT_B_CHECK_HASHES)) {
    assert.ok(h.includes(hash), `harness missing exact B CHECK hash ${hash}`);
  }
  for (const hash of Object.values(EXACT_B_FUNCTION_HASHES)) {
    assert.ok(h.includes(hash), `harness missing exact B function hash ${hash}`);
  }

  // complete catalog projection fields
  for (const field of REQUIRED_CATALOG_PROJECTION_FIELDS) {
    assert.ok(
      helper.includes(field) || helper.includes(`'${field}'`),
      `catalog helper missing projection field ${field}`
    );
  }
  assert.match(helper, /COMPLETE_CATALOG_PROJECTION_FIELDS/);
  assert.match(helper, /extractPreservationProjection/);
  assert.match(helper, /extractApprovedDelta/);
  assert.match(h, /extractPreservationProjection/);
  assert.match(h, /complete pre-existing column fingerprint|getFullRowFingerprint\(client, 'idem', \{ columns:/);

  // first then second ordering: second no-op before second compatibility
  const noopIdx = h.indexOf('second_apply_noop_before_compatibility');
  const secondIdemIdx = h.indexOf("assertIdempotencyBCompatibility(client, 'second')");
  const secondAuditIdx = h.indexOf("assertAuditBCompatibility(client, 'second')");
  assert.ok(noopIdx > 0 && secondIdemIdx > noopIdx && secondAuditIdx > noopIdx);
  const firstIdemIdx = h.indexOf("assertIdempotencyBCompatibility(client, 'first')");
  assert.ok(firstIdemIdx > 0 && firstIdemIdx < noopIdx);
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

// Export arrays for documentation / external auditors (not used by engine runtime).
module.exports = {
  REQUIRED_RELATION_SCENARIOS,
  REQUIRED_LEGACY_SCENARIOS,
  REQUIRED_GENERIC_SCENARIOS,
  REQUIRED_DATA_SCENARIOS,
  REQUIRED_A_CHECK_SCENARIOS,
  REQUIRED_A_FUNCTION_SCENARIOS,
  REQUIRED_TRIGGER_SCENARIOS,
  REQUIRED_B_MIXED_SCENARIOS,
  REQUIRED_COMPATIBILITY_MARKERS,
  REQUIRED_POSTCONDITION_SCENARIOS,
  EXACT_B_CHECK_HASHES,
  EXACT_B_FUNCTION_HASHES,
  REQUIRED_CATALOG_PROJECTION_FIELDS,
};
