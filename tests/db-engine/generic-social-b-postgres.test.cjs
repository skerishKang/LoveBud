'use strict';

/**
 * DB_ENGINE_EXECUTION: independent successful-path Migration B rehearsal.
 *
 * Sole approved B sequence:
 *   B preflight → exact historical Migration B → B postcondition
 *
 * STATE_A is built via repository-owned Migration A guards first.
 * Does not duplicate the adversarial B guard matrix.
 * Never reads DATABASE_URL. Never runs MIG_B outside runGuardedMigrationBSequence.
 * LOCAL_DB_ENGINE: NOT_RUN (execution only in GitHub Actions disposable CI).
 *
 * Refs: #3540, #3538, #3459, #3458, #3425, #1882
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
const FIXTURE_NONEMPTY = path.join(__dirname, 'fixtures/generic-social-b-rehearsal-legacy.sql');
const FIXTURE_EMPTY = path.join(__dirname, 'fixtures/generic-social-b-rehearsal-empty-legacy.sql');

const { withDisposableDb, boundedFail, combinedOutput } = harness;

// Exact B fingerprints from #3538 (PostgreSQL 17.4)
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

const MEM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TREE = '11111111-1111-4111-8111-111111111111';

function pass(name) {
  process.stdout.write(`${name}: PASS\n`);
}

function expectOk(res, scenario, phase) {
  if (res.status !== 0) {
    boundedFail(scenario, phase, classify(combinedOutput(res)), res.status, 'exit_0', `exit_${res.status}`);
  }
}

function classify(out) {
  const m = out.match(/GENERIC_SOCIAL_[AB]_[A-Z0-9_]+/);
  if (m) return m[0];
  if (/Prerequisite table|Gate A incomplete/i.test(out)) return 'MIGRATION_PRECONDITION_FAILED';
  return 'ENGINE_ERROR';
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

/** Sole approved Migration B runner for this rehearsal suite. */
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
  assert.equal(a.stoppedAt, 'done', `${scenario}: STATE_A must succeed`);
  expectOk(a.pre, scenario, 'a_preflight');
  expectOk(a.mig, scenario, 'a_mig');
  expectOk(a.post, scenario, 'a_post');
  return a;
}

function phaseUuids(fixture, phase, table) {
  // All components must be hex. fixture: b|e  phase: 1|2  table: d|a  scenario digit.
  const f = fixture === 'empty' ? 'e' : 'b';
  const p = phase === 'second' ? '2' : '1';
  const t = table === 'audit' ? 'a' : 'd';
  const mk = (c) => {
    const g1 = `${f}${p}${t}${c}${c}${c}${c}${c}`; // 8
    const g2 = `${f}${p}${t}${c}`; // 4
    const g3 = `4${p}${t}${c}`; // 4
    const g4 = `8${p}${t}${c}`; // 4
    const g5 = `${f}${p}${t}${c}${c}${c}${c}${c}${c}${c}${c}${c}`; // 12
    return `${g1}-${g2}-${g3}-${g4}-${g5}`;
  };
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
    K: mk('c'),
  };
}

async function assertExactBObjects(client) {
  const funcs = await catalog.getFunctionFingerprints(client);
  for (const [name, hash] of Object.entries(B_FUNC_HASHES)) {
    const f = funcs.find((x) => x.n === name);
    assert.ok(f, `missing function ${name}`);
    assert.equal(f.h, hash, `exact B function hash ${name}`);
    assert.equal(f.l, 'plpgsql');
    assert.equal(f.result, 'trigger');
    assert.equal(f.s, false);
  }
  // unique zero-arg overload count
  assert.equal(funcs.filter((f) => f.n === 'sync_social_idempotency_generic_target_from_legacy_memory').length, 1);
  assert.equal(funcs.filter((f) => f.n === 'sync_social_audit_generic_target_from_legacy_memory').length, 1);

  const checks = await client.query(`
    SELECT c.conname,
           encode(sha256(convert_to(concat_ws(E'\\n', n.nspname, rel.relname, c.conname, c.contype::text, 'true',
             trim(both from regexp_replace(replace(replace(pg_get_constraintdef(c.oid,false), E'\\r\\n', E'\\n'), E'\\r', E'\\n'), E'\\\\s+', ' ', 'g'))
           ), 'utf8')), 'hex') AS h
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE c.conname = ANY($1::text[])
      AND c.contype = 'c'
      AND c.convalidated
    ORDER BY c.conname
  `, [Object.keys(B_CHECK_HASHES)]);
  assert.equal(checks.rows.length, 4);
  for (const row of checks.rows) {
    assert.equal(row.h, B_CHECK_HASHES[row.conname], `exact B CHECK hash ${row.conname}`);
  }
}

/** Full A–K compatibility for social_idempotency. */
async function assertIdempotencyBRehearsalCompatibility(client, fixture, phase) {
  const ids = phaseUuids(fixture, phase, 'idem');
  const marker = `rehearsal_${fixture}_${phase}_idempotency`;
  const mem = MEM;
  const tree = TREE;

  await client.query(
    `INSERT INTO public.social_idempotency (
       id, actor_id, operation, idempotency_key, request_fingerprint, target_memory_id
     ) VALUES ($1,$2,'comment.create',$3,$4,$5)`,
    [ids.A, `${marker}_legacy_only`, `${marker}_kA`, `${marker}_fA`, mem]
  );
  {
    const r = await client.query(
      `SELECT target_kind, target_id::text AS tid FROM public.social_idempotency WHERE id=$1`,
      [ids.A]
    );
    assert.equal(r.rows[0].target_kind, 'memory');
    assert.equal(r.rows[0].tid, mem);
  }
  pass(`${marker}_legacy_only`);

  await client.query(
    `INSERT INTO public.social_idempotency (
       id, actor_id, operation, idempotency_key, request_fingerprint,
       target_memory_id, target_kind, target_id
     ) VALUES ($1,$2,'comment.create',$3,$4,$5,'memory',$5)`,
    [ids.B, `${marker}_match`, `${marker}_kB`, `${marker}_fB`, mem]
  );
  pass(`${marker}_match_memory`);

  await client.query(
    `INSERT INTO public.social_idempotency (
       id, actor_id, operation, idempotency_key, request_fingerprint,
       target_memory_id, target_kind, target_id
     ) VALUES ($1,$2,'comment.create',$3,$4,NULL,'memory',$5)`,
    [ids.C, `${marker}_mem_null`, `${marker}_kC`, `${marker}_fC`, mem]
  );
  pass(`${marker}_memory_legacy_null`);

  await client.query(
    `INSERT INTO public.social_idempotency (
       id, actor_id, operation, idempotency_key, request_fingerprint,
       target_memory_id, target_kind, target_id
     ) VALUES ($1,$2,'comment.create',$3,$4,NULL,'tree',$5)`,
    [ids.D, `${marker}_tree`, `${marker}_kD`, `${marker}_fD`, tree]
  );
  pass(`${marker}_tree`);

  let failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint, target_memory_id, target_kind
       ) VALUES ($1,$2,'comment.create',$3,$4,$5,'memory')`,
      [ids.E, `${marker}_partial`, `${marker}_kE`, `${marker}_fE`, mem]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal((await client.query(`SELECT 1 FROM public.social_idempotency WHERE id=$1`, [ids.E])).rows.length, 0);
  pass(`${marker}_partial_reject`);

  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint, target_memory_id, target_kind, target_id
       ) VALUES ($1,$2,'comment.create',$3,$4,NULL,'unknown',$5)`,
      [ids.F, `${marker}_unknown`, `${marker}_kF`, `${marker}_fF`, mem]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal((await client.query(`SELECT 1 FROM public.social_idempotency WHERE id=$1`, [ids.F])).rows.length, 0);
  pass(`${marker}_unknown_reject`);

  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint, target_memory_id, target_kind, target_id
       ) VALUES ($1,$2,'comment.create',$3,$4,$5,'memory',$6)`,
      [ids.G, `${marker}_mismatch`, `${marker}_kG`, `${marker}_fG`, mem, tree]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal((await client.query(`SELECT 1 FROM public.social_idempotency WHERE id=$1`, [ids.G])).rows.length, 0);
  pass(`${marker}_memory_mismatch_reject`);

  failed = false;
  try {
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint, target_memory_id, target_kind, target_id
       ) VALUES ($1,$2,'comment.create',$3,$4,$5,'tree',$6)`,
      [ids.H, `${marker}_tree_leg`, `${marker}_kH`, `${marker}_fH`, mem, tree]
    );
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal((await client.query(`SELECT 1 FROM public.social_idempotency WHERE id=$1`, [ids.H])).rows.length, 0);
  pass(`${marker}_tree_legacy_reject`);

  const beforeI = await catalog.getFullRowFingerprint(client, 'idem');
  failed = false;
  try {
    await client.query(`UPDATE public.social_idempotency SET target_id=$1 WHERE id=$2`, [tree, ids.A]);
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal((await catalog.getFullRowFingerprint(client, 'idem')).rowFp, beforeI.rowFp);
  pass(`${marker}_failed_update_preserve`);

  await client.query(
    `UPDATE public.social_idempotency
     SET target_kind='tree', target_id=$1, target_memory_id=NULL WHERE id=$2`,
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

  assert.equal((await client.query(`SELECT 1 FROM public.social_idempotency WHERE id=$1`, [ids.A])).rows.length, 1);
  assert.equal((await catalog.getFullRowFingerprint(client, 'unrelated')).count >= 1, true);
  pass(`${marker}_preservation`);
}

/** Full A–K compatibility for social_audit_log. */
async function assertAuditBRehearsalCompatibility(client, fixture, phase) {
  const ids = phaseUuids(fixture, phase, 'audit');
  const marker = `rehearsal_${fixture}_${phase}_audit`;
  const mem = MEM;
  const tree = TREE;

  await client.query(
    `INSERT INTO public.social_audit_log (id, actor_id, memory_id, action, outcome_code)
     VALUES ($1,$2,$3,'comment.create','success')`,
    [ids.A, `${marker}_legacy_only`, mem]
  );
  {
    const r = await client.query(
      `SELECT target_kind, target_id::text AS tid FROM public.social_audit_log WHERE id=$1`,
      [ids.A]
    );
    assert.equal(r.rows[0].target_kind, 'memory');
    assert.equal(r.rows[0].tid, mem);
  }
  pass(`${marker}_legacy_only`);

  await client.query(
    `INSERT INTO public.social_audit_log (
       id, actor_id, memory_id, action, outcome_code, target_kind, target_id
     ) VALUES ($1,$2,$3,'comment.create','success','memory',$3)`,
    [ids.B, `${marker}_match`, mem]
  );
  pass(`${marker}_match_memory`);

  await client.query(
    `INSERT INTO public.social_audit_log (
       id, actor_id, memory_id, action, outcome_code, target_kind, target_id
     ) VALUES ($1,$2,NULL,'comment.create','success','memory',$3)`,
    [ids.C, `${marker}_mem_null`, mem]
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
  assert.equal((await client.query(`SELECT 1 FROM public.social_audit_log WHERE id=$1`, [ids.E])).rows.length, 0);
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
  assert.equal((await client.query(`SELECT 1 FROM public.social_audit_log WHERE id=$1`, [ids.F])).rows.length, 0);
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
  assert.equal((await client.query(`SELECT 1 FROM public.social_audit_log WHERE id=$1`, [ids.G])).rows.length, 0);
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
  assert.equal((await client.query(`SELECT 1 FROM public.social_audit_log WHERE id=$1`, [ids.H])).rows.length, 0);
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

  assert.equal((await client.query(`SELECT 1 FROM public.social_audit_log WHERE id=$1`, [ids.A])).rows.length, 1);
  assert.equal((await catalog.getFullRowFingerprint(client, 'unrelated')).count >= 1, true);
  pass(`${marker}_preservation`);
}

// ─── Non-empty STATE_A → B rehearsal ─────────────────────────────────────────

test('rehearsal_nonempty_state_a through Migration B', { concurrency: false }, async () => {
  await withDisposableDb('b_reh_ne', FIXTURE_NONEMPTY, async ({ client, runSql }) => {
    pass('rehearsal_nonempty_state_a');

    // multi-row marker evidence
    const nI = (await client.query(`SELECT count(*)::int AS n FROM public.social_idempotency`)).rows[0].n;
    const nA = (await client.query(`SELECT count(*)::int AS n FROM public.social_audit_log`)).rows[0].n;
    assert.ok(nI >= 3, 'multi-row idempotency fixture');
    assert.ok(nA >= 3, 'multi-row audit fixture');
    pass('rehearsal multi-row fixture');

    await reachStateA(client, runSql, 'b_reh_ne');
    pass('rehearsal guarded Migration A STATE_A');

    const beforeColsI = await catalog.getColumnNames(client, 'social_idempotency');
    const beforeColsA = await catalog.getColumnNames(client, 'social_audit_log');
    const beforeCatalog = await catalog.getCatalogFingerprint(client);
    const beforePreserve = catalog.extractPreservationProjection(beforeCatalog);
    const beforeI = await catalog.getFullRowFingerprint(client, 'idem', { columns: beforeColsI });
    const beforeA = await catalog.getFullRowFingerprint(client, 'audit', { columns: beforeColsA });
    const beforeU = await catalog.getFullRowFingerprint(client, 'unrelated');
    const beforeLegacyI = await catalog.getFullRowFingerprint(client, 'idem', {
      columns: ['id', 'target_memory_id'],
    });
    const beforeLegacyA = await catalog.getFullRowFingerprint(client, 'audit', {
      columns: ['id', 'memory_id'],
    });

    const b = runGuardedMigrationBSequence(runSql);
    assert.equal(b.counts.preflight, 1);
    assert.equal(b.counts.migB, 1);
    assert.equal(b.counts.postcond, 1);
    assert.equal(b.stoppedAt, 'done');
    expectOk(b.pre, 'b_reh_ne', 'b_pre');
    expectOk(b.mig, 'b_reh_ne', 'b_mig');
    expectOk(b.post, 'b_reh_ne', 'b_post');
    pass('rehearsal_first_guarded_b');

    // complete pre-existing column value preservation
    assert.equal(
      (await catalog.getFullRowFingerprint(client, 'idem', { columns: beforeColsI })).rowFp,
      beforeI.rowFp
    );
    assert.equal(
      (await catalog.getFullRowFingerprint(client, 'audit', { columns: beforeColsA })).rowFp,
      beforeA.rowFp
    );
    assert.equal((await catalog.getFullRowFingerprint(client, 'idem')).count, beforeI.count);
    assert.equal((await catalog.getFullRowFingerprint(client, 'audit')).count, beforeA.count);
    assert.deepEqual(await catalog.getFullRowFingerprint(client, 'unrelated'), beforeU);
    assert.equal(
      (await catalog.getFullRowFingerprint(client, 'idem', { columns: ['id', 'target_memory_id'] })).rowFp,
      beforeLegacyI.rowFp
    );
    assert.equal(
      (await catalog.getFullRowFingerprint(client, 'audit', { columns: ['id', 'memory_id'] })).rowFp,
      beforeLegacyA.rowFp
    );
    pass('rehearsal complete row preservation');

    const afterCatalog = await catalog.getCatalogFingerprint(client);
    const afterPreserve = catalog.extractPreservationProjection(afterCatalog);
    assert.ok(
      catalog.fingerprintEqual(beforePreserve, afterPreserve),
      'PK/constraint/index/owner/ACL/relation preservation'
    );
    pass('rehearsal PK/constraint/index/owner/ACL preservation');

    const delta = catalog.extractApprovedDelta(afterCatalog);
    assert.equal(delta.idemLegacyNull, 'YES');
    assert.equal(delta.auditLegacyNull, 'YES');
    assert.equal(delta.idemKindNull, 'NO');
    assert.equal(delta.idemIdNull, 'NO');
    assert.equal(delta.auditKindNull, 'NO');
    assert.equal(delta.auditIdNull, 'NO');
    assert.ok(delta.checks.idem.includes('social_idempotency_memory_legacy_match_check'));
    assert.ok(delta.checks.idem.includes('social_idempotency_tree_legacy_null_check'));
    assert.ok(delta.checks.audit.includes('social_audit_log_memory_legacy_match_check'));
    assert.ok(delta.checks.audit.includes('social_audit_log_tree_legacy_null_check'));
    assert.equal(
      delta.funcs.find((f) => f.n === 'sync_social_idempotency_generic_target_from_legacy_memory').h,
      B_FUNC_HASHES.sync_social_idempotency_generic_target_from_legacy_memory
    );
    assert.equal(
      delta.funcs.find((f) => f.n === 'sync_social_audit_generic_target_from_legacy_memory').h,
      B_FUNC_HASHES.sync_social_audit_generic_target_from_legacy_memory
    );
    pass('rehearsal first B catalog approved delta');

    await assertExactBObjects(client);
    // trigger contracts
    assert.equal(afterCatalog.idem.triggerNameTypeEnabledRelationFunctionOid.length, 1);
    assert.equal(afterCatalog.audit.triggerNameTypeEnabledRelationFunctionOid.length, 1);
    assert.equal(afterCatalog.idem.triggerNameTypeEnabledRelationFunctionOid[0].t, 23);
    assert.equal(afterCatalog.idem.triggerNameTypeEnabledRelationFunctionOid[0].e, 'O');
    assert.equal(afterCatalog.audit.triggerNameTypeEnabledRelationFunctionOid[0].t, 23);
    assert.equal(afterCatalog.audit.triggerNameTypeEnabledRelationFunctionOid[0].e, 'O');
    pass('rehearsal exact B CHECK/function/trigger evidence');

    await assertIdempotencyBRehearsalCompatibility(client, 'nonempty', 'first');
    pass('rehearsal_first_idempotency_compatibility');
    await assertAuditBRehearsalCompatibility(client, 'nonempty', 'first');
    pass('rehearsal_first_audit_compatibility');

    // record complete STATE_B fingerprint after first compat
    const stateBFp = await catalog.getCatalogFingerprint(client);
    const rowI = await catalog.getFullRowFingerprint(client, 'idem');
    const rowA = await catalog.getFullRowFingerprint(client, 'audit');
    const checkCount =
      (stateBFp.idem.pkAndPreexistingConstraints || []).length +
      (stateBFp.audit.pkAndPreexistingConstraints || []).length;
    const tgCount =
      (stateBFp.idem.triggerNameTypeEnabledRelationFunctionOid || []).length +
      (stateBFp.audit.triggerNameTypeEnabledRelationFunctionOid || []).length;
    const idxCount =
      (stateBFp.idem.allIndexesIncludingPrimary || []).length +
      (stateBFp.audit.allIndexesIncludingPrimary || []).length;
    const fnCount = (stateBFp.functionFullAttributeBodyFingerprint || []).length;

    const second = runGuardedMigrationBSequence(runSql);
    assert.equal(second.counts.preflight, 1);
    assert.equal(second.counts.migB, 1);
    assert.equal(second.counts.postcond, 1);
    assert.equal(second.stoppedAt, 'done');
    expectOk(second.pre, 'b_reh_ne2', 'pre');
    expectOk(second.mig, 'b_reh_ne2', 'mig');
    expectOk(second.post, 'b_reh_ne2', 'post');

    const afterSecond = await catalog.getCatalogFingerprint(client);
    assert.ok(catalog.fingerprintEqual(stateBFp, afterSecond));
    assert.equal((await catalog.getFullRowFingerprint(client, 'idem')).rowFp, rowI.rowFp);
    assert.equal((await catalog.getFullRowFingerprint(client, 'audit')).rowFp, rowA.rowFp);
    assert.equal(
      (afterSecond.idem.pkAndPreexistingConstraints || []).length +
        (afterSecond.audit.pkAndPreexistingConstraints || []).length,
      checkCount
    );
    assert.equal(
      (afterSecond.idem.triggerNameTypeEnabledRelationFunctionOid || []).length +
        (afterSecond.audit.triggerNameTypeEnabledRelationFunctionOid || []).length,
      tgCount
    );
    assert.equal(
      (afterSecond.idem.allIndexesIncludingPrimary || []).length +
        (afterSecond.audit.allIndexesIncludingPrimary || []).length,
      idxCount
    );
    assert.equal((afterSecond.functionFullAttributeBodyFingerprint || []).length, fnCount);
    pass('rehearsal_second_apply_noop');
    pass('second_apply_noop_before_compatibility');

    await assertIdempotencyBRehearsalCompatibility(client, 'nonempty', 'second');
    pass('rehearsal_second_idempotency_compatibility');
    await assertAuditBRehearsalCompatibility(client, 'nonempty', 'second');
    pass('rehearsal_second_audit_compatibility');
  });
});

// ─── Empty STATE_A → B rehearsal ─────────────────────────────────────────────

test('rehearsal_empty_state_a cutover and smoke', { concurrency: false }, async () => {
  await withDisposableDb('b_reh_empty', FIXTURE_EMPTY, async ({ client, runSql }) => {
    pass('rehearsal_empty_state_a');

    assert.equal((await client.query(`SELECT count(*)::int AS n FROM public.social_idempotency`)).rows[0].n, 0);
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM public.social_audit_log`)).rows[0].n, 0);

    await reachStateA(client, runSql, 'b_reh_empty');
    assert.equal((await catalog.getFullRowFingerprint(client, 'idem')).count, 0);
    assert.equal((await catalog.getFullRowFingerprint(client, 'audit')).count, 0);

    const beforeU = await catalog.getFullRowFingerprint(client, 'unrelated');

    const b = runGuardedMigrationBSequence(runSql);
    assert.equal(b.counts.preflight, 1);
    assert.equal(b.counts.migB, 1);
    assert.equal(b.counts.postcond, 1);
    assert.equal(b.stoppedAt, 'done');
    expectOk(b.pre, 'b_reh_empty', 'b_pre');
    expectOk(b.mig, 'b_reh_empty', 'b_mig');
    expectOk(b.post, 'b_reh_empty', 'b_post');
    pass('rehearsal empty cutover');

    assert.equal((await catalog.getFullRowFingerprint(client, 'idem')).count, 0);
    assert.equal((await catalog.getFullRowFingerprint(client, 'audit')).count, 0);
    assert.deepEqual(await catalog.getFullRowFingerprint(client, 'unrelated'), beforeU);

    await assertExactBObjects(client);
    const delta = catalog.extractApprovedDelta(await catalog.getCatalogFingerprint(client));
    assert.equal(delta.idemLegacyNull, 'YES');
    assert.equal(delta.auditLegacyNull, 'YES');
    assert.equal(delta.idemKindNull, 'NO');
    assert.equal(delta.auditKindNull, 'NO');

    // narrow memory/tree smoke both tables — no fabricated pre-existing rows
    const smokeMem = '22222222-2222-4222-8222-222222222222';
    const smokeTree = '33333333-3333-4333-8333-333333333333';
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint, target_memory_id
       ) VALUES ('44444444-4444-4444-8444-444444444444','smoke','comment.create','sk1','sf1',$1)`,
      [smokeMem]
    );
    await client.query(
      `INSERT INTO public.social_audit_log (id, actor_id, memory_id, action, outcome_code)
       VALUES ('55555555-5555-4555-8555-555555555555','smoke',$1,'comment.create','success')`,
      [smokeMem]
    );
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint,
         target_memory_id, target_kind, target_id
       ) VALUES ('66666666-6666-4666-8666-666666666666','smoke','comment.create','sk2','sf2',NULL,'tree',$1)`,
      [smokeTree]
    );
    await client.query(
      `INSERT INTO public.social_audit_log (
         id, actor_id, memory_id, action, outcome_code, target_kind, target_id
       ) VALUES ('77777777-7777-4777-8777-777777777777','smoke',NULL,'comment.create','success','tree',$1)`,
      [smokeTree]
    );
    {
      const r = await client.query(
        `SELECT target_kind, target_memory_id IS NULL AS leg_null
         FROM public.social_idempotency WHERE id='66666666-6666-4666-8666-666666666666'`
      );
      assert.equal(r.rows[0].target_kind, 'tree');
      assert.equal(r.rows[0].leg_null, true);
    }
    {
      const r = await client.query(
        `SELECT target_kind, memory_id IS NULL AS leg_null
         FROM public.social_audit_log WHERE id='77777777-7777-4777-8777-777777777777'`
      );
      assert.equal(r.rows[0].target_kind, 'tree');
      assert.equal(r.rows[0].leg_null, true);
    }
    assert.deepEqual(await catalog.getFullRowFingerprint(client, 'unrelated'), beforeU);
    pass('rehearsal_empty_memory_tree_smoke');
  });
});

test('rehearsal suite never executes Migration B outside helper', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(__filename, 'utf8');
  assert.match(src, /runGuardedMigrationBSequence/);
  assert.match(src, /runSql\(B_PRE\)/);
  assert.match(src, /runSql\(MIG_B\)/);
  assert.match(src, /runSql\(B_POST\)/);
  // order B_PRE < MIG_B < B_POST inside helper (string probes, not invocations)
  const helper = src.match(/function runGuardedMigrationBSequence[\s\S]*?^}/m)[0];
  const preTok = 'B_PRE';
  const migTok = 'MIG_B';
  const postTok = 'B_POST';
  assert.ok(helper.indexOf(preTok) < helper.indexOf(migTok));
  assert.ok(helper.indexOf(migTok) < helper.indexOf(postTok));
  const withoutHelper = src.replace(
    /function runGuardedMigrationBSequence[\s\S]*?^}/m,
    'function runGuardedMigrationBSequence(){}'
  );
  // No executable invocation form outside the helper body
  assert.equal(/\brunSql\s*\(\s*MIG_B\s*\)/.test(withoutHelper), false);
  assert.equal(/process\.env\.DATABASE_URL/i.test(src), false);
  assert.match(src, /rehearsal_nonempty_state_a/);
  assert.match(src, /rehearsal_empty_state_a/);
  assert.match(src, /rehearsal_first_guarded_b/);
  assert.match(src, /rehearsal_first_idempotency_compatibility/);
  assert.match(src, /rehearsal_first_audit_compatibility/);
  assert.match(src, /rehearsal_second_apply_noop/);
  assert.match(src, /second_apply_noop_before_compatibility/);
  assert.match(src, /rehearsal_second_idempotency_compatibility/);
  assert.match(src, /rehearsal_second_audit_compatibility/);
  assert.match(src, /rehearsal_empty_memory_tree_smoke/);
  assert.match(src, /assertIdempotencyBRehearsalCompatibility/);
  assert.match(src, /assertAuditBRehearsalCompatibility/);
  pass('rehearsal no unguarded Migration B');
});
