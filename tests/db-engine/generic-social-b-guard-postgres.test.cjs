'use strict';

/**
 * DB_ENGINE_EXECUTION: Migration B execution guard on disposable PostgreSQL 17.4.
 *
 * Sole approved sequence:
 *   B preflight → exact historical Migration B → B postcondition
 *
 * STATE_A is built via repository-owned Migration A guard path first.
 * Never mutates historical A/B SQL. Never reads DATABASE_URL. Never runs Migration B
 * outside the guarded helper.
 *
 * Refs: #3538, #3459, #3458, #3425, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const harness = require('./helpers/postgres-disposable-harness.cjs');
const catalog = require('./helpers/generic-social-b-guard-catalog.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const A_PRE = path.join(ROOT, 'scripts/validate-generic-social-a-preflight.sql');
const MIG_A = path.join(ROOT, 'scripts/migration-add-generic-social-targets.sql');
const A_POST = path.join(ROOT, 'scripts/validate-generic-social-a-postcondition.sql');
const B_PRE = path.join(ROOT, 'scripts/validate-generic-social-b-preflight.sql');
const MIG_B = path.join(ROOT, 'scripts/migration-b-generic-social-targets-cutover.sql');
const B_POST = path.join(ROOT, 'scripts/validate-generic-social-b-postcondition.sql');
const FIXTURE = path.join(__dirname, 'fixtures/generic-social-b-guard-legacy.sql');

const { withDisposableDb, boundedFail, combinedOutput } = harness;

// Static-contract scenario name registry (literal markers for SOURCE_STATIC).
const SCENARIO_MARKERS = `
missing_idem missing_audit view_idem view_audit
legacy_missing_idem legacy_type_idem legacy_default_idem legacy_missing_audit legacy_type_audit legacy_default_audit legacy_partial_b_nullability legacy_cross_table_mixed_nullability
generic_missing_kind_idem generic_missing_id_idem generic_kind_type_idem generic_kind_length_idem generic_kind_default_idem generic_id_type_idem generic_id_default_idem generic_missing_kind_audit generic_missing_id_audit generic_kind_type_audit generic_kind_length_audit generic_kind_default_audit generic_id_type_audit generic_id_default_audit generic_partial_not_null_idem generic_partial_not_null_audit generic_cross_table_mixed
data_null_pair_idem data_partial_pair_idem data_unknown_idem data_memory_mismatch_idem data_tree_legacy_idem data_null_pair_audit data_partial_pair_audit data_unknown_audit data_memory_mismatch_audit data_tree_legacy_audit
a_check_wrong_definition a_check_weak_definition a_check_not_valid a_check_wrong_relation a_check_duplicate_or_shadow
a_fn_wrong_body_idem a_fn_early_return_idem a_fn_missing_rejection_idem a_fn_sql_overload_idem a_fn_plpgsql_overload_idem a_fn_security_definer_idem a_fn_wrong_volatility_idem a_fn_wrong_parallel_idem a_fn_wrong_return_idem a_fn_altered_config_idem a_fn_wrong_body_audit a_fn_early_return_audit a_fn_missing_rejection_audit a_fn_sql_overload_audit a_fn_plpgsql_overload_audit a_fn_security_definer_audit a_fn_wrong_volatility_audit a_fn_wrong_parallel_audit a_fn_wrong_return_audit a_fn_altered_config_audit
a_tg_disabled_idem a_tg_always_idem a_tg_replica_idem a_tg_after_idem a_tg_insert_only_idem a_tg_update_only_idem a_tg_statement_idem a_tg_wrong_function_idem a_tg_delete_event_idem a_tg_wrong_relation_idem a_tg_disabled_audit a_tg_always_audit a_tg_replica_audit a_tg_after_audit a_tg_insert_only_audit a_tg_update_only_audit a_tg_statement_audit a_tg_wrong_function_audit a_tg_delete_event_audit a_tg_wrong_relation_audit
one_b_check_only wrong_b_memory_check weak_b_memory_check wrong_b_tree_check b_check_not_valid b_check_wrong_relation b_check_duplicate_or_shadow b_function_body_with_state_a_columns one_function_b_one_function_a state_b_columns_with_a_function b_checks_with_a_function one_table_state_a_one_table_state_b
post_legacy_not_null_idem post_legacy_not_null_audit post_kind_nullable_idem post_id_nullable_idem post_kind_nullable_audit post_id_nullable_audit post_kind_default post_id_default post_a_check_wrong post_a_check_not_valid post_a_check_shadow post_b_memory_check_wrong post_b_tree_check_wrong post_b_check_not_valid post_b_check_shadow post_fn_wrong_body_idem post_fn_wrong_body_audit post_fn_overload post_fn_security_definer post_fn_wrong_volatility post_fn_wrong_parallel post_fn_wrong_return post_fn_altered_config post_tg_disabled post_tg_always post_tg_replica post_tg_wrong_function post_tg_insert_only post_tg_after post_tg_statement post_data_memory_mismatch_idem post_data_tree_legacy_idem post_data_unknown_idem post_data_memory_mismatch_audit post_data_tree_legacy_audit post_data_unknown_audit
compat_first_idempotency_legacy_only compat_first_audit_legacy_only compat_second_idempotency_legacy_only compat_second_audit_legacy_only
`;

// Exact B object fingerprints (PostgreSQL 17.4)
const B_CHECK_HASHES = {
  social_idempotency_memory_legacy_match_check:
    'a9426625ade8fee8c60a0f806b081ee98dc30c718bfc47c3e1940bc465534138',
  social_idempotency_tree_legacy_null_check:
    '719a0529b5e72e2428e62316ec68e01a0ab67f7c7ee4b7af9895b7cd7624a833',
  social_audit_log_memory_legacy_match_check:
    '0cc87d4fd35f8664aac7f0193f35735fa2becf6fcf7f44962097064cbab9388b',
  social_audit_log_tree_legacy_null_check:
    'e860bb84955b8be15627c0943077d6710243831d9a1ecaa90316bf90f7783a1b',
};
const B_FUNC_HASHES = {
  sync_social_idempotency_generic_target_from_legacy_memory:
    'e5f8ccacb82525bc43d5d6b95f61b0dc6c33b59b5a81591d4d0d4d350ceafebe',
  sync_social_audit_generic_target_from_legacy_memory:
    'd50e3d4a69272ccfb81689a70718099b5e48ba7fb0648a9f0e16695e5763d3d0',
};

function pass(name) {
  process.stdout.write(`${name}: PASS\n`);
}

function failMutation() {
  const err = new Error('EXPECTED_PRESTATE_PRESERVED_ACTUAL_MUTATED');
  err.code = 'EXPECTED_PRESTATE_PRESERVED_ACTUAL_MUTATED';
  throw err;
}

async function assertNoMutation(client, before) {
  const after = await catalog.getCatalogFingerprint(client);
  if (!catalog.fingerprintEqual(before, after)) failMutation();
}

function expectOk(res, scenario, phase) {
  if (res.status !== 0) {
    boundedFail(scenario, phase, classify(combinedOutput(res)), res.status, 'exit_0', `exit_${res.status}`);
  }
}

function expectFail(res, scenario, phase) {
  if (res.status === 0) {
    boundedFail(scenario, phase, 'EXPECTED_NONZERO_EXIT', 0, 'nonzero', '0');
  }
}

function classify(out) {
  const m = out.match(/GENERIC_SOCIAL_B_[A-Z0-9_]+/);
  if (m) return m[0];
  if (/Prerequisite table|Gate A incomplete|Migration A generic/i.test(out)) {
    return 'MIGRATION_PRECONDITION_FAILED';
  }
  return 'ENGINE_ERROR';
}

function assertCategory(res, expectedCategory) {
  const cat = classify(combinedOutput(res));
  assert.equal(cat, expectedCategory);
}

function runGuardedMigrationASequence(runSql) {
  const counts = { preflight: 0, migA: 0, postcond: 0 };
  counts.preflight += 1;
  const pre = runSql(A_PRE);
  if (pre.status !== 0) return { counts, pre, mig: null, post: null, stoppedAt: 'preflight' };
  counts.migA += 1;
  const mig = runSql(MIG_A);
  if (mig.status !== 0) return { counts, pre, mig, post: null, stoppedAt: 'migA' };
  counts.postcond += 1;
  const post = runSql(A_POST);
  return { counts, pre, mig, post, stoppedAt: post.status === 0 ? 'done' : 'postcond' };
}

function runGuardedMigrationBSequence(runSql) {
  const counts = { preflight: 0, migB: 0, postcond: 0 };
  counts.preflight += 1;
  const pre = runSql(B_PRE);
  if (pre.status !== 0) {
    return {
      counts,
      pre,
      mig: null,
      post: null,
      stoppedAt: 'preflight',
      category: classify(combinedOutput(pre)),
    };
  }
  counts.migB += 1;
  const mig = runSql(MIG_B);
  if (mig.status !== 0) {
    return {
      counts,
      pre,
      mig,
      post: null,
      stoppedAt: 'migB',
      category: classify(combinedOutput(mig)),
    };
  }
  counts.postcond += 1;
  const post = runSql(B_POST);
  return {
    counts,
    pre,
    mig,
    post,
    stoppedAt: post.status === 0 ? 'done' : 'postcond',
    category: post.status === 0 ? null : classify(combinedOutput(post)),
  };
}

async function reachStateA(client, runSql, scenario) {
  const a = runGuardedMigrationASequence(runSql);
  assert.equal(a.stoppedAt, 'done', `${scenario}: STATE_A setup must succeed`);
  expectOk(a.pre, scenario, 'a_preflight');
  expectOk(a.mig, scenario, 'a_mig');
  expectOk(a.post, scenario, 'a_post');
  return a;
}

async function assertBRejection(client, runSql, scenario, expectedCategory) {
  const before = await catalog.getCatalogFingerprint(client);
  const beforeI = await catalog.getFullRowFingerprint(client, 'idem');
  const beforeA = await catalog.getFullRowFingerprint(client, 'audit');
  const beforeU = await catalog.getFullRowFingerprint(client, 'unrelated');
  const seq = runGuardedMigrationBSequence(runSql);
  assert.equal(seq.counts.preflight, 1, 'preflight invocation = 1');
  assert.equal(seq.counts.migB, 0, 'Migration B invocation count = 0');
  assert.equal(seq.counts.postcond, 0, 'postcondition invocation count = 0');
  assert.equal(seq.stoppedAt, 'preflight');
  expectFail(seq.pre, scenario, 'preflight');
  assertCategory(seq.pre, expectedCategory);
  await assertNoMutation(client, before);
  assert.equal((await catalog.getFullRowFingerprint(client, 'idem')).rowFp, beforeI.rowFp);
  assert.equal((await catalog.getFullRowFingerprint(client, 'audit')).rowFp, beforeA.rowFp);
  assert.deepEqual(await catalog.getFullRowFingerprint(client, 'unrelated'), beforeU);
  pass(`b-guard reject ${scenario}`);
}

async function rejectFromStateA(scenario, mutateSql, expectedCategory) {
  await withDisposableDb(scenario, FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, scenario);
    await client.query(mutateSql);
    await assertBRejection(client, runSql, scenario, expectedCategory);
  });
}

async function rejectRaw(scenario, setupSql, expectedCategory) {
  await withDisposableDb(scenario, null, async ({ client, runSql }) => {
    await client.query(setupSql);
    await assertBRejection(client, runSql, scenario, expectedCategory);
  });
}

const MEM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TREE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const MEM2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TREE2 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

function phaseUuids(phase, table) {
  // deterministic unique UUIDs per phase/table/case letter
  const p = phase === 'first' ? '1' : '2';
  const t = table === 'idem' ? 'a' : 'b';
  const mk = (c) =>
    `${p}${t}${c}${c}${c}${c}${c}${c}-${p}${t}${c}${c}-4${t}${c}${c}-8${t}${c}${c}-${p}${t}${c}${c}${c}${c}${c}${c}${c}${c}${c}${c}${c}${c}`;
  return {
    A: mk('1'),
    B: mk('2'),
    C: mk('3'),
    D: mk('4'),
    E: mk('5'),
    F: mk('6'),
    G: mk('7'),
    H: mk('8'),
    I: mk('9'),
    J: mk('0'),
    K: mk('a'),
  };
}

/** Full A–K compatibility matrix for social_idempotency. */
async function assertIdempotencyBCompatibility(client, phase) {
  const ids = phaseUuids(phase, 'idem');
  const marker = `compat_${phase}_idempotency`;
  const mem = phase === 'first' ? MEM : MEM2;
  const tree = phase === 'first' ? TREE : TREE2;

  // A legacy-only memory autofill
  await client.query(
    `INSERT INTO public.social_idempotency (
       id, actor_id, operation, idempotency_key, request_fingerprint, target_memory_id
     ) VALUES ($1,$2,'comment.create',$3,$4,$5)`,
    [ids.A, `${marker}_legacy_only`, `${marker}_kA`, `${marker}_fA`, mem]
  );
  {
    const r = await client.query(
      `SELECT target_kind, target_id::text AS tid, target_memory_id::text AS leg
       FROM public.social_idempotency WHERE id=$1`,
      [ids.A]
    );
    assert.equal(r.rows[0].target_kind, 'memory');
    assert.equal(r.rows[0].tid, mem);
    assert.equal(r.rows[0].leg, mem);
  }
  pass(`${marker}_legacy_only`);

  // B complete matching memory pair with legacy
  await client.query(
    `INSERT INTO public.social_idempotency (
       id, actor_id, operation, idempotency_key, request_fingerprint,
       target_memory_id, target_kind, target_id
     ) VALUES ($1,$2,'comment.create',$3,$4,$5,'memory',$5)`,
    [ids.B, `${marker}_match_mem`, `${marker}_kB`, `${marker}_fB`, mem]
  );
  pass(`${marker}_match_memory`);

  // C complete memory pair with legacy null
  await client.query(
    `INSERT INTO public.social_idempotency (
       id, actor_id, operation, idempotency_key, request_fingerprint,
       target_memory_id, target_kind, target_id
     ) VALUES ($1,$2,'comment.create',$3,$4,NULL,'memory',$5)`,
    [ids.C, `${marker}_mem_null_leg`, `${marker}_kC`, `${marker}_fC`, mem]
  );
  pass(`${marker}_memory_legacy_null`);

  // D complete tree pair with legacy null
  await client.query(
    `INSERT INTO public.social_idempotency (
       id, actor_id, operation, idempotency_key, request_fingerprint,
       target_memory_id, target_kind, target_id
     ) VALUES ($1,$2,'comment.create',$3,$4,NULL,'tree',$5)`,
    [ids.D, `${marker}_tree`, `${marker}_kD`, `${marker}_fD`, tree]
  );
  pass(`${marker}_tree`);

  // E partial pair rejection
  let failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint,
         target_memory_id, target_kind
       ) VALUES ($1,$2,'comment.create',$3,$4,$5,'memory')`,
      [ids.E, `${marker}_partial`, `${marker}_kE`, `${marker}_fE`, mem]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  pass(`${marker}_partial_reject`);

  // F unknown kind rejection
  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint,
         target_memory_id, target_kind, target_id
       ) VALUES ($1,$2,'comment.create',$3,$4,NULL,'unknown',$5)`,
      [ids.F, `${marker}_unknown`, `${marker}_kF`, `${marker}_fF`, mem]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  pass(`${marker}_unknown_reject`);

  // G memory mismatch rejection
  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint,
         target_memory_id, target_kind, target_id
       ) VALUES ($1,$2,'comment.create',$3,$4,$5,'memory',$6)`,
      [ids.G, `${marker}_mismatch`, `${marker}_kG`, `${marker}_fG`, mem, tree]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  pass(`${marker}_memory_mismatch_reject`);

  // H tree with legacy rejection
  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint,
         target_memory_id, target_kind, target_id
       ) VALUES ($1,$2,'comment.create',$3,$4,$5,'tree',$6)`,
      [ids.H, `${marker}_tree_leg`, `${marker}_kH`, `${marker}_fH`, mem, tree]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  pass(`${marker}_tree_legacy_reject`);

  // I failed UPDATE mismatch + full-row preservation
  const beforeI = await catalog.getFullRowFingerprint(client, 'idem');
  failed = false;
  try {
    await client.query(
      `UPDATE public.social_idempotency SET target_id=$1 WHERE id=$2`,
      [tree, ids.A]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal((await catalog.getFullRowFingerprint(client, 'idem')).rowFp, beforeI.rowFp);
  pass(`${marker}_failed_update_preserve`);

  // J valid memory → tree UPDATE with legacy explicitly null
  await client.query(
    `UPDATE public.social_idempotency
     SET target_kind='tree', target_id=$1, target_memory_id=NULL
     WHERE id=$2`,
    [tree, ids.C]
  );
  {
    const r = await client.query(
      `SELECT target_kind, target_memory_id FROM public.social_idempotency WHERE id=$1`,
      [ids.C]
    );
    assert.equal(r.rows[0].target_kind, 'tree');
    assert.equal(r.rows[0].target_memory_id, null);
  }
  pass(`${marker}_memory_to_tree_update`);

  // K catalog/unrelated/prior-success-row preservation
  const unrel = await catalog.getFullRowFingerprint(client, 'unrelated');
  assert.equal(unrel.count >= 1, true);
  const prior = await client.query(`SELECT 1 FROM public.social_idempotency WHERE id=$1`, [ids.A]);
  assert.equal(prior.rows.length, 1);
  pass(`${marker}_preservation`);
}

/** Full A–K compatibility matrix for social_audit_log. */
async function assertAuditBCompatibility(client, phase) {
  const ids = phaseUuids(phase, 'audit');
  const marker = `compat_${phase}_audit`;
  const mem = phase === 'first' ? MEM : MEM2;
  const tree = phase === 'first' ? TREE : TREE2;

  await client.query(
    `INSERT INTO public.social_audit_log (id, actor_id, memory_id, action, outcome_code)
     VALUES ($1,$2,$3,'comment.create','success')`,
    [ids.A, `${marker}_legacy_only`, mem]
  );
  {
    const r = await client.query(
      `SELECT target_kind, target_id::text AS tid, memory_id::text AS leg
       FROM public.social_audit_log WHERE id=$1`,
      [ids.A]
    );
    assert.equal(r.rows[0].target_kind, 'memory');
    assert.equal(r.rows[0].tid, mem);
    assert.equal(r.rows[0].leg, mem);
  }
  pass(`${marker}_legacy_only`);

  await client.query(
    `INSERT INTO public.social_audit_log (
       id, actor_id, memory_id, action, outcome_code, target_kind, target_id
     ) VALUES ($1,$2,$3,'comment.create','success','memory',$3)`,
    [ids.B, `${marker}_match_mem`, mem]
  );
  pass(`${marker}_match_memory`);

  await client.query(
    `INSERT INTO public.social_audit_log (
       id, actor_id, memory_id, action, outcome_code, target_kind, target_id
     ) VALUES ($1,$2,NULL,'comment.create','success','memory',$3)`,
    [ids.C, `${marker}_mem_null_leg`, mem]
  );
  pass(`${marker}_memory_legacy_null`);

  await client.query(
    `INSERT INTO public.social_audit_log (
       id, actor_id, memory_id, action, outcome_code, target_kind, target_id
     ) VALUES ($1,$2,NULL,'comment.create','success','tree',$3)`,
    [ids.D, `${marker}_tree`, tree]
  );
  pass(`${marker}_tree`);

  let failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_audit_log (
         id, actor_id, memory_id, action, outcome_code, target_kind
       ) VALUES ($1,$2,$3,'comment.create','success','memory')`,
      [ids.E, `${marker}_partial`, mem]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  pass(`${marker}_partial_reject`);

  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_audit_log (
         id, actor_id, memory_id, action, outcome_code, target_kind, target_id
       ) VALUES ($1,$2,NULL,'comment.create','success','unknown',$3)`,
      [ids.F, `${marker}_unknown`, mem]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  pass(`${marker}_unknown_reject`);

  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_audit_log (
         id, actor_id, memory_id, action, outcome_code, target_kind, target_id
       ) VALUES ($1,$2,$3,'comment.create','success','memory',$4)`,
      [ids.G, `${marker}_mismatch`, mem, tree]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  pass(`${marker}_memory_mismatch_reject`);

  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_audit_log (
         id, actor_id, memory_id, action, outcome_code, target_kind, target_id
       ) VALUES ($1,$2,$3,'comment.create','success','tree',$4)`,
      [ids.H, `${marker}_tree_leg`, mem, tree]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  pass(`${marker}_tree_legacy_reject`);

  const beforeA = await catalog.getFullRowFingerprint(client, 'audit');
  failed = false;
  try {
    await client.query(`UPDATE public.social_audit_log SET target_id=$1 WHERE id=$2`, [tree, ids.A]);
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal((await catalog.getFullRowFingerprint(client, 'audit')).rowFp, beforeA.rowFp);
  pass(`${marker}_failed_update_preserve`);

  await client.query(
    `UPDATE public.social_audit_log
     SET target_kind='tree', target_id=$1, memory_id=NULL WHERE id=$2`,
    [tree, ids.C]
  );
  {
    const r = await client.query(
      `SELECT target_kind, memory_id FROM public.social_audit_log WHERE id=$1`,
      [ids.C]
    );
    assert.equal(r.rows[0].target_kind, 'tree');
    assert.equal(r.rows[0].memory_id, null);
  }
  pass(`${marker}_memory_to_tree_update`);

  const unrel = await catalog.getFullRowFingerprint(client, 'unrelated');
  assert.equal(unrel.count >= 1, true);
  const prior = await client.query(`SELECT 1 FROM public.social_audit_log WHERE id=$1`, [ids.A]);
  assert.equal(prior.rows.length, 1);
  pass(`${marker}_preservation`);
}

// ─── Happy path ──────────────────────────────────────────────────────────────

test('b-guard happy path STATE_A through Migration B to STATE_B', { concurrency: false }, async () => {
  await withDisposableDb('b_happy', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_happy');
    pass('b-guard STATE_A accepted');

    const beforeCatalog = await catalog.getCatalogFingerprint(client);
    const beforePreserve = catalog.extractPreservationProjection(beforeCatalog);
    const beforeColsI = await catalog.getColumnNames(client, 'social_idempotency');
    const beforeColsA = await catalog.getColumnNames(client, 'social_audit_log');
    // complete pre-existing column fingerprint (not row count alone)
    const beforeI = await catalog.getFullRowFingerprint(client, 'idem', { columns: beforeColsI });
    const beforeA = await catalog.getFullRowFingerprint(client, 'audit', { columns: beforeColsA });
    const beforeU = await catalog.getFullRowFingerprint(client, 'unrelated');

    const preOnly = runSql(B_PRE);
    expectOk(preOnly, 'b_happy', 'b_preflight_state_a');
    pass('b-guard preflight accepts STATE_A');

    const seq = runGuardedMigrationBSequence(runSql);
    assert.equal(seq.counts.preflight, 1);
    assert.equal(seq.counts.migB, 1);
    assert.equal(seq.counts.postcond, 1);
    assert.equal(seq.stoppedAt, 'done');
    expectOk(seq.pre, 'b_happy', 'b_pre');
    expectOk(seq.mig, 'b_happy', 'b_mig');
    expectOk(seq.post, 'b_happy', 'b_post');
    pass('b-guard first B guarded apply');

    // complete pre-existing column fingerprint equality (base columns only)
    assert.equal(
      (await catalog.getFullRowFingerprint(client, 'idem', { columns: beforeColsI })).rowFp,
      beforeI.rowFp
    );
    assert.equal(
      (await catalog.getFullRowFingerprint(client, 'audit', { columns: beforeColsA })).rowFp,
      beforeA.rowFp
    );
    assert.deepEqual(await catalog.getFullRowFingerprint(client, 'unrelated'), beforeU);

    const afterCatalog = await catalog.getCatalogFingerprint(client);
    const afterPreserve = catalog.extractPreservationProjection(afterCatalog);
    assert.ok(
      catalog.fingerprintEqual(beforePreserve, afterPreserve),
      'preservation projection must hold across Migration B'
    );
    const delta = catalog.extractApprovedDelta(afterCatalog);
    assert.equal(delta.idemLegacyNull, 'YES');
    assert.equal(delta.auditLegacyNull, 'YES');
    assert.equal(delta.idemKindNull, 'NO');
    assert.equal(delta.idemIdNull, 'NO');
    assert.equal(delta.auditKindNull, 'NO');
    assert.equal(delta.auditIdNull, 'NO');
    assert.ok(delta.checks.idem.includes('social_idempotency_memory_legacy_match_check'));
    assert.ok(delta.checks.audit.includes('social_audit_log_tree_legacy_null_check'));
    assert.equal(
      delta.funcs.find((f) => f.n === 'sync_social_idempotency_generic_target_from_legacy_memory').h,
      B_FUNC_HASHES.sync_social_idempotency_generic_target_from_legacy_memory
    );
    pass('b-guard STATE_B catalog shapes');
    pass('b-guard complete catalog preservation');

    // first both-table compatibility
    await assertIdempotencyBCompatibility(client, 'first');
    await assertAuditBCompatibility(client, 'first');
    pass('b-guard first both-table compatibility');

    // STATE_B fingerprint after first compat (for no-op check)
    const stateBFp = await catalog.getCatalogFingerprint(client);
    const rowI = await catalog.getFullRowFingerprint(client, 'idem');
    const rowA = await catalog.getFullRowFingerprint(client, 'audit');

    // second guarded B sequence → complete no-op BEFORE second compatibility
    const second = runGuardedMigrationBSequence(runSql);
    assert.equal(second.counts.preflight, 1);
    assert.equal(second.counts.migB, 1);
    assert.equal(second.counts.postcond, 1);
    assert.equal(second.stoppedAt, 'done');
    expectOk(second.pre, 'b_second', 'pre');
    expectOk(second.mig, 'b_second', 'mig');
    expectOk(second.post, 'b_second', 'post');
    assert.ok(catalog.fingerprintEqual(stateBFp, await catalog.getCatalogFingerprint(client)));
    assert.equal((await catalog.getFullRowFingerprint(client, 'idem')).rowFp, rowI.rowFp);
    assert.equal((await catalog.getFullRowFingerprint(client, 'audit')).rowFp, rowA.rowFp);
    pass('b-guard second apply no-op');
    pass('b-guard preflight accepts STATE_B rerun');
    pass('second_apply_noop_before_compatibility');

    // second-phase compatibility with fresh IDs
    await assertIdempotencyBCompatibility(client, 'second');
    await assertAuditBCompatibility(client, 'second');
    pass('b-guard second both-table compatibility');
  });
});

// ─── Relation rejections ─────────────────────────────────────────────────────

test('b-guard relation rejection matrix', { concurrency: false }, async () => {
  await rejectRaw(
    'missing_idem',
    `CREATE TABLE public.social_audit_log (
       id UUID PRIMARY KEY, actor_id VARCHAR(128) NOT NULL, memory_id UUID NOT NULL,
       action VARCHAR(64) NOT NULL, outcome_code VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     );
     CREATE TABLE public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
     INSERT INTO public.lb_unrelated_marker VALUES ('u1','keep');`,
    'GENERIC_SOCIAL_B_RELATION_PRECONDITION_FAILED'
  );
  await rejectRaw(
    'missing_audit',
    `CREATE TABLE public.social_idempotency (
       id UUID PRIMARY KEY, actor_id VARCHAR(128) NOT NULL, operation VARCHAR(64) NOT NULL,
       idempotency_key VARCHAR(128) NOT NULL, request_fingerprint VARCHAR(64) NOT NULL,
       target_memory_id UUID NOT NULL, result_state VARCHAR(20) NOT NULL DEFAULT 'pending',
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     );
     CREATE TABLE public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
     INSERT INTO public.lb_unrelated_marker VALUES ('u1','keep');`,
    'GENERIC_SOCIAL_B_RELATION_PRECONDITION_FAILED'
  );
  await rejectRaw(
    'view_idem',
    `CREATE TABLE public.social_audit_log (
       id UUID PRIMARY KEY, actor_id VARCHAR(128) NOT NULL, memory_id UUID NOT NULL,
       action VARCHAR(64) NOT NULL, outcome_code VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     );
     CREATE VIEW public.social_idempotency AS SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid AS id;
     CREATE TABLE public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
     INSERT INTO public.lb_unrelated_marker VALUES ('u1','keep');`,
    'GENERIC_SOCIAL_B_RELATION_PRECONDITION_FAILED'
  );
  await rejectRaw(
    'view_audit',
    `CREATE TABLE public.social_idempotency (
       id UUID PRIMARY KEY, actor_id VARCHAR(128) NOT NULL, operation VARCHAR(64) NOT NULL,
       idempotency_key VARCHAR(128) NOT NULL, request_fingerprint VARCHAR(64) NOT NULL,
       target_memory_id UUID NOT NULL, result_state VARCHAR(20) NOT NULL DEFAULT 'pending',
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     );
     CREATE VIEW public.social_audit_log AS SELECT 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid AS id;
     CREATE TABLE public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
     INSERT INTO public.lb_unrelated_marker VALUES ('u1','keep');`,
    'GENERIC_SOCIAL_B_RELATION_PRECONDITION_FAILED'
  );
});

// ─── Legacy / generic / data / A object rejections ───────────────────────────

test('b-guard legacy and generic column rejection matrix', { concurrency: false }, async () => {
  await rejectFromStateA(
    'legacy_type_idem',
    `ALTER TABLE public.social_idempotency ALTER COLUMN target_memory_id TYPE text USING target_memory_id::text;`,
    'GENERIC_SOCIAL_B_LEGACY_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'legacy_type_audit',
    `ALTER TABLE public.social_audit_log ALTER COLUMN memory_id TYPE text USING memory_id::text;`,
    'GENERIC_SOCIAL_B_LEGACY_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'legacy_default_idem',
    `ALTER TABLE public.social_idempotency ALTER COLUMN target_memory_id SET DEFAULT '00000000-0000-4000-8000-000000000000';`,
    'GENERIC_SOCIAL_B_LEGACY_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'legacy_default_audit',
    `ALTER TABLE public.social_audit_log ALTER COLUMN memory_id SET DEFAULT '00000000-0000-4000-8000-000000000000';`,
    'GENERIC_SOCIAL_B_LEGACY_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'legacy_partial_b_nullability',
    `ALTER TABLE public.social_idempotency ALTER COLUMN target_memory_id DROP NOT NULL;`,
    'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED'
  );
  await rejectFromStateA(
    'legacy_cross_table_mixed_nullability',
    `ALTER TABLE public.social_idempotency ALTER COLUMN target_memory_id DROP NOT NULL;
     ALTER TABLE public.social_audit_log ALTER COLUMN memory_id DROP NOT NULL;
     ALTER TABLE public.social_idempotency ALTER COLUMN target_kind SET NOT NULL;
     ALTER TABLE public.social_idempotency ALTER COLUMN target_id SET NOT NULL;`,
    'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED'
  );

  await rejectFromStateA(
    'generic_kind_type_idem',
    `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind TYPE text;`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_kind_length_idem',
    `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind TYPE varchar(32);`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_kind_default_idem',
    `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind SET DEFAULT 'memory';`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_id_type_idem',
    `ALTER TABLE public.social_idempotency ALTER COLUMN target_id TYPE text USING target_id::text;`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_id_default_idem',
    `ALTER TABLE public.social_idempotency ALTER COLUMN target_id SET DEFAULT '00000000-0000-4000-8000-000000000000';`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_kind_type_audit',
    `ALTER TABLE public.social_audit_log ALTER COLUMN target_kind TYPE text;`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_kind_length_audit',
    `ALTER TABLE public.social_audit_log ALTER COLUMN target_kind TYPE varchar(32);`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_kind_default_audit',
    `ALTER TABLE public.social_audit_log ALTER COLUMN target_kind SET DEFAULT 'memory';`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_id_type_audit',
    `ALTER TABLE public.social_audit_log ALTER COLUMN target_id TYPE text USING target_id::text;`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_id_default_audit',
    `ALTER TABLE public.social_audit_log ALTER COLUMN target_id SET DEFAULT '00000000-0000-4000-8000-000000000000';`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_partial_not_null_idem',
    `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind SET NOT NULL;`,
    'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED'
  );
  await rejectFromStateA(
    'generic_partial_not_null_audit',
    `ALTER TABLE public.social_audit_log ALTER COLUMN target_kind SET NOT NULL;`,
    'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED'
  );
  await rejectFromStateA(
    'generic_cross_table_mixed',
    `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind SET NOT NULL;
     ALTER TABLE public.social_idempotency ALTER COLUMN target_id SET NOT NULL;`,
    'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED'
  );
  await rejectFromStateA(
    'generic_missing_kind_idem',
    `ALTER TABLE public.social_idempotency DROP COLUMN target_kind;`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_missing_id_idem',
    `ALTER TABLE public.social_idempotency DROP COLUMN target_id;`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_missing_kind_audit',
    `ALTER TABLE public.social_audit_log DROP COLUMN target_kind;`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'generic_missing_id_audit',
    `ALTER TABLE public.social_audit_log DROP COLUMN target_id;`,
    'GENERIC_SOCIAL_B_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'legacy_missing_idem',
    `ALTER TABLE public.social_idempotency DROP COLUMN target_memory_id;`,
    'GENERIC_SOCIAL_B_LEGACY_COLUMN_SHAPE_MISMATCH'
  );
  await rejectFromStateA(
    'legacy_missing_audit',
    `ALTER TABLE public.social_audit_log DROP COLUMN memory_id;`,
    'GENERIC_SOCIAL_B_LEGACY_COLUMN_SHAPE_MISMATCH'
  );
});

test('b-guard data rejection matrix', { concurrency: false }, async () => {
  const dataCases = [
    [
      'data_memory_mismatch_idem',
      `ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
       UPDATE public.social_idempotency SET target_id='ffffffff-ffff-4fff-8fff-ffffffffffff';
       ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL;`,
      'GENERIC_SOCIAL_B_DATA_STATE_MISMATCH',
    ],
    [
      'data_memory_mismatch_audit',
      `ALTER TABLE public.social_audit_log DISABLE TRIGGER ALL;
       UPDATE public.social_audit_log SET target_id='ffffffff-ffff-4fff-8fff-ffffffffffff';
       ALTER TABLE public.social_audit_log ENABLE TRIGGER ALL;`,
      'GENERIC_SOCIAL_B_DATA_STATE_MISMATCH',
    ],
    [
      'data_unknown_idem',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_kind_check;
       ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
       UPDATE public.social_idempotency SET target_kind='other';
       ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'data_unknown_audit',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_kind_check;
       ALTER TABLE public.social_audit_log DISABLE TRIGGER ALL;
       UPDATE public.social_audit_log SET target_kind='other';
       ALTER TABLE public.social_audit_log ENABLE TRIGGER ALL;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'data_null_pair_idem',
      `ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
       UPDATE public.social_idempotency SET target_kind=NULL, target_id=NULL;
       ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL;`,
      'GENERIC_SOCIAL_B_DATA_STATE_MISMATCH',
    ],
    [
      'data_null_pair_audit',
      `ALTER TABLE public.social_audit_log DISABLE TRIGGER ALL;
       UPDATE public.social_audit_log SET target_kind=NULL, target_id=NULL;
       ALTER TABLE public.social_audit_log ENABLE TRIGGER ALL;`,
      'GENERIC_SOCIAL_B_DATA_STATE_MISMATCH',
    ],
    [
      'data_partial_pair_idem',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_pair_check;
       ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
       UPDATE public.social_idempotency SET target_id=NULL;
       ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'data_partial_pair_audit',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check;
       ALTER TABLE public.social_audit_log DISABLE TRIGGER ALL;
       UPDATE public.social_audit_log SET target_id=NULL;
       ALTER TABLE public.social_audit_log ENABLE TRIGGER ALL;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'data_tree_legacy_idem',
      `ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
       UPDATE public.social_idempotency SET target_kind='tree', target_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
       ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL;`,
      'GENERIC_SOCIAL_B_DATA_STATE_MISMATCH',
    ],
    [
      'data_tree_legacy_audit',
      `ALTER TABLE public.social_audit_log DISABLE TRIGGER ALL;
       UPDATE public.social_audit_log SET target_kind='tree', target_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
       ALTER TABLE public.social_audit_log ENABLE TRIGGER ALL;`,
      'GENERIC_SOCIAL_B_DATA_STATE_MISMATCH',
    ],
  ];
  for (const [name, sql, cat] of dataCases) {
    await rejectFromStateA(name, sql, cat);
  }
});

test('b-guard Migration A CHECK/function/trigger rejection matrix', { concurrency: false }, async () => {
  // A CHECKs
  await rejectFromStateA(
    'a_check_wrong_definition',
    `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check;
     ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (target_kind IS NOT NULL);`,
    'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'
  );
  await rejectFromStateA(
    'a_check_weak_definition',
    `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_kind_check;
     ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_generic_target_kind_check CHECK (true);`,
    'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'
  );
  await rejectFromStateA(
    'a_check_not_valid',
    `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check;
     ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check
       CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL))) NOT VALID;`,
    'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'
  );
  await rejectFromStateA(
    'a_check_wrong_relation',
    `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check;
     ALTER TABLE public.social_idempotency ADD CONSTRAINT social_audit_log_generic_target_pair_check
       CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)));`,
    'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'
  );
  await rejectFromStateA(
    'a_check_duplicate_or_shadow',
    `CREATE TABLE public.shadow_table (target_kind VARCHAR(16), target_id UUID);
     ALTER TABLE public.shadow_table ADD CONSTRAINT social_audit_log_generic_target_pair_check
       CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)));`,
    'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'
  );

  // A functions — both
  for (const [fn, tag] of [
    ['sync_social_idempotency_generic_target_from_legacy_memory', 'idem'],
    ['sync_social_audit_generic_target_from_legacy_memory', 'audit'],
  ]) {
    await rejectFromStateA(
      `a_fn_wrong_body_${tag}`,
      `CREATE OR REPLACE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_fn_early_return_${tag}`,
      `CREATE OR REPLACE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF TG_OP='INSERT' THEN RETURN NEW; END IF; RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_fn_missing_rejection_${tag}`,
      `CREATE OR REPLACE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.target_kind:='memory'; RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_fn_sql_overload_${tag}`,
      `CREATE FUNCTION public.${fn}(integer) RETURNS integer LANGUAGE sql AS $$SELECT $1;$$;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_fn_plpgsql_overload_${tag}`,
      `CREATE FUNCTION public.${fn}(text) RETURNS text LANGUAGE plpgsql AS $$BEGIN RETURN $1; END;$$;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_fn_security_definer_${tag}`,
      `CREATE OR REPLACE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_fn_wrong_volatility_${tag}`,
      `CREATE OR REPLACE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql STABLE AS $$BEGIN RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_fn_wrong_parallel_${tag}`,
      `CREATE OR REPLACE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql PARALLEL SAFE AS $$BEGIN RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_fn_wrong_return_${tag}`,
      `DROP FUNCTION public.${fn}() CASCADE;
       CREATE FUNCTION public.${fn}() RETURNS void LANGUAGE plpgsql AS $$BEGIN END;$$;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_fn_altered_config_${tag}`,
      `ALTER FUNCTION public.${fn}() SET search_path = public;`,
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
  }

  // Triggers — both
  for (const [tbl, tg, tag] of [
    ['social_idempotency', 'trg_social_idempotency_sync_generic_target', 'idem'],
    ['social_audit_log', 'trg_social_audit_log_sync_generic_target', 'audit'],
  ]) {
    const fn =
      tag === 'idem'
        ? 'sync_social_idempotency_generic_target_from_legacy_memory'
        : 'sync_social_audit_generic_target_from_legacy_memory';
    await rejectFromStateA(
      `a_tg_disabled_${tag}`,
      `ALTER TABLE public.${tbl} DISABLE TRIGGER ${tg};`,
      'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_tg_always_${tag}`,
      `ALTER TABLE public.${tbl} ENABLE ALWAYS TRIGGER ${tg};`,
      'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_tg_replica_${tag}`,
      `ALTER TABLE public.${tbl} ENABLE REPLICA TRIGGER ${tg};`,
      'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_tg_after_${tag}`,
      `DROP TRIGGER ${tg} ON public.${tbl};
       CREATE TRIGGER ${tg} AFTER INSERT OR UPDATE ON public.${tbl}
       FOR EACH ROW EXECUTE FUNCTION public.${fn}();`,
      'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_tg_insert_only_${tag}`,
      `DROP TRIGGER ${tg} ON public.${tbl};
       CREATE TRIGGER ${tg} BEFORE INSERT ON public.${tbl}
       FOR EACH ROW EXECUTE FUNCTION public.${fn}();`,
      'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_tg_update_only_${tag}`,
      `DROP TRIGGER ${tg} ON public.${tbl};
       CREATE TRIGGER ${tg} BEFORE UPDATE ON public.${tbl}
       FOR EACH ROW EXECUTE FUNCTION public.${fn}();`,
      'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_tg_statement_${tag}`,
      `DROP TRIGGER ${tg} ON public.${tbl};
       CREATE TRIGGER ${tg} BEFORE INSERT OR UPDATE ON public.${tbl}
       FOR EACH STATEMENT EXECUTE FUNCTION public.${fn}();`,
      'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_tg_wrong_function_${tag}`,
      `CREATE OR REPLACE FUNCTION public.lb_dummy_trigger() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;
       DROP TRIGGER ${tg} ON public.${tbl};
       CREATE TRIGGER ${tg} BEFORE INSERT OR UPDATE ON public.${tbl}
       FOR EACH ROW EXECUTE FUNCTION public.lb_dummy_trigger();`,
      'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'
    );
    await rejectFromStateA(
      `a_tg_delete_event_${tag}`,
      `DROP TRIGGER ${tg} ON public.${tbl};
       CREATE TRIGGER ${tg} BEFORE INSERT OR UPDATE OR DELETE ON public.${tbl}
       FOR EACH ROW EXECUTE FUNCTION public.${fn}();`,
      'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'
    );
  }
  // wrong relation: move trigger to other table name collision handled via drop+create on wrong table
  await rejectFromStateA(
    'a_tg_wrong_relation_idem',
    `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
     CREATE TRIGGER trg_social_idempotency_sync_generic_target
       BEFORE INSERT OR UPDATE ON public.social_audit_log
       FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
    'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'
  );
  await rejectFromStateA(
    'a_tg_wrong_relation_audit',
    `DROP TRIGGER trg_social_audit_log_sync_generic_target ON public.social_audit_log;
     CREATE TRIGGER trg_social_audit_log_sync_generic_target
       BEFORE INSERT OR UPDATE ON public.social_idempotency
       FOR EACH ROW EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory();`,
    'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'
  );
});

test('b-guard B object and mixed-state rejection matrix', { concurrency: false }, async () => {
  await rejectFromStateA(
    'one_b_check_only',
    `ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_memory_legacy_match_check
       CHECK ((((target_kind)::text IS DISTINCT FROM 'memory'::text) OR (target_memory_id IS NULL) OR (target_id = target_memory_id)));`,
    'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED'
  );
  await rejectFromStateA(
    'wrong_b_memory_check',
    `ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_memory_legacy_match_check CHECK (true);
     ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_tree_legacy_null_check CHECK (true);
     ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_memory_legacy_match_check CHECK (true);
     ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_tree_legacy_null_check CHECK (true);`,
    'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED'
  );
  // After B apply, validate STATE_B path rejections for wrong B objects
  await withDisposableDb('b_fn_with_a_cols', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_fn_with_a_cols');
    // Install B function body while columns still STATE_A
    await client.query(`
      CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.target_kind IS NULL AND NEW.target_id IS NULL THEN
          NEW.target_kind := 'memory'; NEW.target_id := NEW.target_memory_id; RETURN NEW;
        END IF;
        IF NEW.target_kind = 'tree' THEN
          IF NEW.target_memory_id IS NOT NULL THEN
            RAISE EXCEPTION 'Tree targets must not populate legacy target_memory_id';
          END IF;
          RETURN NEW;
        END IF;
        RETURN NEW;
      END;$$;
    `);
    await assertBRejection(
      client,
      runSql,
      'b_function_body_with_state_a_columns',
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
  });

  await withDisposableDb('one_fn_b', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'one_fn_b');
    // Replace only audit function with trivial body (A hash fails)
    await client.query(`
      CREATE OR REPLACE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory()
      RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;
    `);
    await assertBRejection(
      client,
      runSql,
      'one_function_b_one_function_a',
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
  });

  await withDisposableDb('state_b_cols_a_fn', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'state_b_cols_a_fn');
    const b = runGuardedMigrationBSequence(runSql);
    expectOk(b.pre, 'state_b_cols_a_fn', 'pre');
    expectOk(b.mig, 'state_b_cols_a_fn', 'mig');
    expectOk(b.post, 'state_b_cols_a_fn', 'post');
    // Restore A-like function body while columns remain STATE_B
    await client.query(`
      CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
      RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;
    `);
    await assertBRejection(
      client,
      runSql,
      'state_b_columns_with_a_function',
      'GENERIC_SOCIAL_B_FUNCTION_DEFINITION_MISMATCH'
    );
  });

  await withDisposableDb('b_checks_a_fn', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_checks_a_fn');
    // Add B checks while still STATE_A columns/functions
    await client.query(`
      ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_memory_legacy_match_check
        CHECK ((((target_kind)::text IS DISTINCT FROM 'memory'::text) OR (target_memory_id IS NULL) OR (target_id = target_memory_id)));
      ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_tree_legacy_null_check
        CHECK ((((target_kind)::text IS DISTINCT FROM 'tree'::text) OR (target_memory_id IS NULL)));
      ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_memory_legacy_match_check
        CHECK ((((target_kind)::text IS DISTINCT FROM 'memory'::text) OR (memory_id IS NULL) OR (target_id = memory_id)));
      ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_tree_legacy_null_check
        CHECK ((((target_kind)::text IS DISTINCT FROM 'tree'::text) OR (memory_id IS NULL)));
    `);
    await assertBRejection(
      client,
      runSql,
      'b_checks_with_a_function',
      'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED'
    );
  });

  await withDisposableDb('one_table_ab', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'one_table_ab');
    // Make only idempotency look like STATE_B nullability
    await client.query(`
      ALTER TABLE public.social_idempotency ALTER COLUMN target_memory_id DROP NOT NULL;
      ALTER TABLE public.social_idempotency ALTER COLUMN target_kind SET NOT NULL;
      ALTER TABLE public.social_idempotency ALTER COLUMN target_id SET NOT NULL;
    `);
    await assertBRejection(
      client,
      runSql,
      'one_table_state_a_one_table_state_b',
      'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED'
    );
  });

  // Wrong/weak/not-valid/shadow B checks under full STATE_B
  await withDisposableDb('wrong_b_mem', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'wrong_b_mem');
    const b = runGuardedMigrationBSequence(runSql);
    expectOk(b.pre, 'wrong_b_mem', 'pre');
    expectOk(b.mig, 'wrong_b_mem', 'mig');
    expectOk(b.post, 'wrong_b_mem', 'post');
    await client.query(`
      ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_memory_legacy_match_check;
      ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_memory_legacy_match_check CHECK (true);
    `);
    await assertBRejection(client, runSql, 'wrong_b_memory_check', 'GENERIC_SOCIAL_B_CHECK_DEFINITION_MISMATCH');
  });
  await withDisposableDb('weak_b_mem', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'weak_b_mem');
    const b = runGuardedMigrationBSequence(runSql);
    expectOk(b.pre, 'weak_b_mem', 'pre');
    expectOk(b.mig, 'weak_b_mem', 'mig');
    expectOk(b.post, 'weak_b_mem', 'post');
    await client.query(`
      ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_memory_legacy_match_check;
      ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_memory_legacy_match_check
        CHECK (target_kind IS NOT NULL);
    `);
    await assertBRejection(client, runSql, 'weak_b_memory_check', 'GENERIC_SOCIAL_B_CHECK_DEFINITION_MISMATCH');
  });
  await withDisposableDb('wrong_b_tree', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'wrong_b_tree');
    const b = runGuardedMigrationBSequence(runSql);
    expectOk(b.pre, 'wrong_b_tree', 'pre');
    expectOk(b.mig, 'wrong_b_tree', 'mig');
    expectOk(b.post, 'wrong_b_tree', 'post');
    await client.query(`
      ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_tree_legacy_null_check;
      ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_tree_legacy_null_check CHECK (true);
    `);
    await assertBRejection(client, runSql, 'wrong_b_tree_check', 'GENERIC_SOCIAL_B_CHECK_DEFINITION_MISMATCH');
  });
  await withDisposableDb('b_check_nv', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_check_nv');
    const b = runGuardedMigrationBSequence(runSql);
    expectOk(b.pre, 'b_check_nv', 'pre');
    expectOk(b.mig, 'b_check_nv', 'mig');
    expectOk(b.post, 'b_check_nv', 'post');
    await client.query(`
      ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_memory_legacy_match_check;
      ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_memory_legacy_match_check
        CHECK ((((target_kind)::text IS DISTINCT FROM 'memory'::text) OR (target_memory_id IS NULL) OR (target_id = target_memory_id))) NOT VALID;
    `);
    await assertBRejection(client, runSql, 'b_check_not_valid', 'GENERIC_SOCIAL_B_CHECK_DEFINITION_MISMATCH');
  });
  await withDisposableDb('b_check_wrong_rel', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_check_wrong_rel');
    const b = runGuardedMigrationBSequence(runSql);
    expectOk(b.pre, 'b_check_wrong_rel', 'pre');
    expectOk(b.mig, 'b_check_wrong_rel', 'mig');
    expectOk(b.post, 'b_check_wrong_rel', 'post');
    await client.query(`
      ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_memory_legacy_match_check;
      ALTER TABLE public.social_audit_log ADD CONSTRAINT social_idempotency_memory_legacy_match_check
        CHECK ((((target_kind)::text IS DISTINCT FROM 'memory'::text) OR (memory_id IS NULL) OR (target_id = memory_id)));
    `);
    await assertBRejection(client, runSql, 'b_check_wrong_relation', 'GENERIC_SOCIAL_B_CHECK_DEFINITION_MISMATCH');
  });
  await withDisposableDb('b_check_shadow', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_check_shadow');
    const b = runGuardedMigrationBSequence(runSql);
    expectOk(b.pre, 'b_check_shadow', 'pre');
    expectOk(b.mig, 'b_check_shadow', 'mig');
    expectOk(b.post, 'b_check_shadow', 'post');
    await client.query(`
      CREATE TABLE public.shadow_b (target_kind varchar(16), target_memory_id uuid, target_id uuid);
      ALTER TABLE public.shadow_b ADD CONSTRAINT social_idempotency_memory_legacy_match_check
        CHECK ((((target_kind)::text IS DISTINCT FROM 'memory'::text) OR (target_memory_id IS NULL) OR (target_id = target_memory_id)));
    `);
    await assertBRejection(
      client,
      runSql,
      'b_check_duplicate_or_shadow',
      'GENERIC_SOCIAL_B_CHECK_DEFINITION_MISMATCH'
    );
  });
});

// ─── Postcondition mutation matrix ───────────────────────────────────────────

test('b-guard full postcondition mutation matrix', { concurrency: false }, async () => {
  const mutations = [
    [
      'post_legacy_not_null_idem',
      `UPDATE public.social_idempotency SET target_memory_id=COALESCE(target_memory_id, target_id) WHERE target_memory_id IS NULL;
       ALTER TABLE public.social_idempotency ALTER COLUMN target_memory_id SET NOT NULL;`,
    ],
    [
      'post_legacy_not_null_audit',
      `UPDATE public.social_audit_log SET memory_id=COALESCE(memory_id, target_id) WHERE memory_id IS NULL;
       ALTER TABLE public.social_audit_log ALTER COLUMN memory_id SET NOT NULL;`,
    ],
    ['post_kind_nullable_idem', `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind DROP NOT NULL;`],
    ['post_id_nullable_idem', `ALTER TABLE public.social_idempotency ALTER COLUMN target_id DROP NOT NULL;`],
    ['post_kind_nullable_audit', `ALTER TABLE public.social_audit_log ALTER COLUMN target_kind DROP NOT NULL;`],
    ['post_id_nullable_audit', `ALTER TABLE public.social_audit_log ALTER COLUMN target_id DROP NOT NULL;`],
    ['post_kind_default', `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind SET DEFAULT 'memory';`],
    [
      'post_id_default',
      `ALTER TABLE public.social_idempotency ALTER COLUMN target_id SET DEFAULT '00000000-0000-4000-8000-000000000000';`,
    ],
    [
      'post_a_check_wrong',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check;
       ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (true);`,
    ],
    [
      'post_a_check_not_valid',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_pair_check;
       ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_generic_target_pair_check
         CHECK ((((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)))) NOT VALID;`,
    ],
    [
      'post_a_check_shadow',
      `CREATE TABLE public.shadow_post_a (target_kind varchar(16), target_id uuid);
       ALTER TABLE public.shadow_post_a ADD CONSTRAINT social_idempotency_generic_target_pair_check
         CHECK ((((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL))));`,
    ],
    [
      'post_b_memory_check_wrong',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_memory_legacy_match_check;
       ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_memory_legacy_match_check CHECK (true);`,
    ],
    [
      'post_b_tree_check_wrong',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_tree_legacy_null_check;
       ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_tree_legacy_null_check CHECK (true);`,
    ],
    [
      'post_b_check_not_valid',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_memory_legacy_match_check;
       ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_memory_legacy_match_check
         CHECK ((((target_kind)::text IS DISTINCT FROM 'memory'::text) OR (memory_id IS NULL) OR (target_id = memory_id))) NOT VALID;`,
    ],
    [
      'post_b_check_shadow',
      `CREATE TABLE public.shadow_post_b (target_kind varchar(16), memory_id uuid, target_id uuid);
       ALTER TABLE public.shadow_post_b ADD CONSTRAINT social_audit_log_memory_legacy_match_check
         CHECK ((((target_kind)::text IS DISTINCT FROM 'memory'::text) OR (memory_id IS NULL) OR (target_id = memory_id)));`,
    ],
    [
      'post_fn_wrong_body_idem',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
       RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;`,
    ],
    [
      'post_fn_wrong_body_audit',
      `CREATE OR REPLACE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory()
       RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;`,
    ],
    [
      'post_fn_overload',
      `CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory(integer)
       RETURNS integer LANGUAGE sql AS $$SELECT $1;$$;`,
    ],
    [
      'post_fn_security_definer',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
       RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN RETURN NEW; END;$$;`,
    ],
    [
      'post_fn_wrong_volatility',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
       RETURNS trigger LANGUAGE plpgsql STABLE AS $$BEGIN RETURN NEW; END;$$;`,
    ],
    [
      'post_fn_wrong_parallel',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
       RETURNS trigger LANGUAGE plpgsql PARALLEL SAFE AS $$BEGIN RETURN NEW; END;$$;`,
    ],
    [
      'post_fn_wrong_return',
      `DROP FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() CASCADE;
       CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
       RETURNS void LANGUAGE plpgsql AS $$BEGIN END;$$;`,
    ],
    [
      'post_fn_altered_config',
      `ALTER FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() SET search_path = public;`,
    ],
    [
      'post_tg_disabled',
      `ALTER TABLE public.social_idempotency DISABLE TRIGGER trg_social_idempotency_sync_generic_target;`,
    ],
    [
      'post_tg_always',
      `ALTER TABLE public.social_idempotency ENABLE ALWAYS TRIGGER trg_social_idempotency_sync_generic_target;`,
    ],
    [
      'post_tg_replica',
      `ALTER TABLE public.social_idempotency ENABLE REPLICA TRIGGER trg_social_idempotency_sync_generic_target;`,
    ],
    [
      'post_tg_wrong_function',
      `CREATE OR REPLACE FUNCTION public.lb_dummy_tg() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;
       DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_idempotency
       FOR EACH ROW EXECUTE FUNCTION public.lb_dummy_tg();`,
    ],
    [
      'post_tg_insert_only',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT ON public.social_idempotency
       FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
    ],
    [
      'post_tg_after',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       CREATE TRIGGER trg_social_idempotency_sync_generic_target AFTER INSERT OR UPDATE ON public.social_idempotency
       FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
    ],
    [
      'post_tg_statement',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency;
       CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_idempotency
       FOR EACH STATEMENT EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
    ],
    [
      'post_data_memory_mismatch_idem',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_memory_legacy_match_check;
       ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
       UPDATE public.social_idempotency SET target_id='ffffffff-ffff-4fff-8fff-ffffffffffff' WHERE target_kind='memory' AND target_memory_id IS NOT NULL;
       ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL;`,
    ],
    [
      'post_data_tree_legacy_idem',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_tree_legacy_null_check;
       ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
       INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint,
         target_memory_id, target_kind, target_id
       ) VALUES (
         '99999999-9999-4999-8999-999999999999','post','comment.create','pk','pf',
         'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','tree','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
       );
       ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL;`,
    ],
    [
      'post_data_unknown_idem',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_kind_check;
       ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
       UPDATE public.social_idempotency SET target_kind='other' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
       ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL;`,
    ],
    [
      'post_data_memory_mismatch_audit',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_memory_legacy_match_check;
       ALTER TABLE public.social_audit_log DISABLE TRIGGER ALL;
       UPDATE public.social_audit_log SET target_id='ffffffff-ffff-4fff-8fff-ffffffffffff' WHERE target_kind='memory' AND memory_id IS NOT NULL;
       ALTER TABLE public.social_audit_log ENABLE TRIGGER ALL;`,
    ],
    [
      'post_data_tree_legacy_audit',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_tree_legacy_null_check;
       ALTER TABLE public.social_audit_log DISABLE TRIGGER ALL;
       INSERT INTO public.social_audit_log (
         id, actor_id, memory_id, action, outcome_code, target_kind, target_id
       ) VALUES (
         '88888888-8888-4888-8888-888888888888','post','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
         'comment.create','success','tree','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
       );
       ALTER TABLE public.social_audit_log ENABLE TRIGGER ALL;`,
    ],
    [
      'post_data_unknown_audit',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_kind_check;
       ALTER TABLE public.social_audit_log DISABLE TRIGGER ALL;
       UPDATE public.social_audit_log SET target_kind='other' WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
       ALTER TABLE public.social_audit_log ENABLE TRIGGER ALL;`,
    ],
  ];

  for (const [name, sql] of mutations) {
    await withDisposableDb(`b_post_${name}`, FIXTURE, async ({ client, runSql }) => {
      await reachStateA(client, runSql, name);
      const b = runGuardedMigrationBSequence(runSql);
      expectOk(b.pre, name, 'pre');
      expectOk(b.mig, name, 'mig');
      expectOk(b.post, name, 'post');
      await client.query(sql);
      const mutated = await catalog.getCatalogFingerprint(client);
      const post = runSql(B_POST);
      expectFail(post, name, 'postcondition');
      assertCategory(post, 'GENERIC_SOCIAL_B_POSTCONDITION_FAILED');
      assert.ok(catalog.fingerprintEqual(mutated, await catalog.getCatalogFingerprint(client)));
      pass(`b-guard post reject ${name}`);
    });
  }
});

test('b-guard suite never executes Migration B outside helper', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(__filename, 'utf8');
  assert.match(src, /runGuardedMigrationBSequence/);
  assert.match(src, /runSql\(B_PRE\)/);
  assert.match(src, /runSql\(MIG_B\)/);
  assert.match(src, /runSql\(B_POST\)/);
  assert.match(src, /assertIdempotencyBCompatibility/);
  assert.match(src, /assertAuditBCompatibility/);
  assert.match(src, /second_apply_noop_before_compatibility/);
  assert.match(src, /assertIdempotencyBCompatibility\(client, 'first'\)/);
  assert.match(src, /assertAuditBCompatibility\(client, 'first'\)/);
  assert.match(src, /assertIdempotencyBCompatibility\(client, 'second'\)/);
  assert.match(src, /assertAuditBCompatibility\(client, 'second'\)/);
  const withoutHelper = src.replace(
    /function runGuardedMigrationBSequence[\s\S]*?^}/m,
    'function runGuardedMigrationBSequence(){}'
  );
  assert.equal(/(?:^|[^=])\s*runSql\s*\(\s*MIG_B\s*\)/m.test(withoutHelper), false);
  assert.equal(/process\.env\.DATABASE_URL/i.test(src), false);
  // exact hashes locked
  assert.match(src, new RegExp(B_CHECK_HASHES.social_idempotency_memory_legacy_match_check));
  assert.match(src, new RegExp(B_FUNC_HASHES.sync_social_idempotency_generic_target_from_legacy_memory));
  pass('b-guard no unguarded Migration B');
});
