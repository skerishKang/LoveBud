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

/** Build exact STATE_A using repository-owned Migration A validators + SQL. */
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

/** Sole approved Migration B sequence. */
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

// ─── Happy path: STATE_A → B preflight → MIG_B → B postcondition ─────────────

test('b-guard happy path STATE_A through Migration B to STATE_B', { concurrency: false }, async () => {
  await withDisposableDb('b_happy', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_happy');
    pass('b-guard STATE_A accepted');

    const beforeI = await catalog.getFullRowFingerprint(client, 'idem');
    const beforeA = await catalog.getFullRowFingerprint(client, 'audit');
    const beforeU = await catalog.getFullRowFingerprint(client, 'unrelated');

    // STATE_A accepted by B preflight alone
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

    // Row count preserved (base data still present)
    assert.equal((await catalog.getFullRowFingerprint(client, 'idem')).count, beforeI.count);
    assert.equal((await catalog.getFullRowFingerprint(client, 'audit')).count, beforeA.count);
    assert.deepEqual(await catalog.getFullRowFingerprint(client, 'unrelated'), beforeU);

    // Catalog STATE_B shapes
    const fp = await catalog.getCatalogFingerprint(client);
    assert.ok(fp.idem.cols.some((c) => c.n === 'target_kind' && c.null === 'NO'));
    assert.ok(fp.idem.cols.some((c) => c.n === 'target_memory_id' && c.null === 'YES'));
    assert.ok(fp.idem.checks.includes('social_idempotency_memory_legacy_match_check'));
    assert.ok(fp.audit.checks.includes('social_audit_log_tree_legacy_null_check'));
    pass('b-guard STATE_B catalog shapes');

    // Second apply no-op
    const catFp = await catalog.getCatalogFingerprint(client);
    const rowI = await catalog.getFullRowFingerprint(client, 'idem');
    const rowA = await catalog.getFullRowFingerprint(client, 'audit');
    const second = runGuardedMigrationBSequence(runSql);
    assert.equal(second.counts.preflight, 1);
    assert.equal(second.counts.migB, 1);
    assert.equal(second.counts.postcond, 1);
    assert.equal(second.stoppedAt, 'done');
    expectOk(second.pre, 'b_second', 'pre');
    expectOk(second.mig, 'b_second', 'mig');
    expectOk(second.post, 'b_second', 'post');
    await assertNoMutation(client, catFp);
    assert.equal((await catalog.getFullRowFingerprint(client, 'idem')).rowFp, rowI.rowFp);
    assert.equal((await catalog.getFullRowFingerprint(client, 'audit')).rowFp, rowA.rowFp);
    pass('b-guard second apply no-op');
    pass('b-guard preflight accepts STATE_B rerun');
  });
});

// ─── Compatibility after B ───────────────────────────────────────────────────

test('b-guard compatibility statements after Migration B', { concurrency: false }, async () => {
  await withDisposableDb('b_compat', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_compat');
    const b = runGuardedMigrationBSequence(runSql);
    expectOk(b.pre, 'b_compat', 'pre');
    expectOk(b.mig, 'b_compat', 'mig');
    expectOk(b.post, 'b_compat', 'post');

    const MEM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const TREE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

    // legacy-only INSERT still fills memory pair on both tables
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint, target_memory_id
       ) VALUES ('11111111-1111-4111-8111-111111111111','syn','comment.create','k1','f1',$1)`,
      [MEM]
    );
    const r1 = await client.query(
      `SELECT target_kind, target_id::text AS tid FROM public.social_idempotency WHERE id='11111111-1111-4111-8111-111111111111'`
    );
    assert.equal(r1.rows[0].target_kind, 'memory');
    assert.equal(r1.rows[0].tid, MEM);
    pass('b-guard compat_idempotency_legacy_only');

    await client.query(
      `INSERT INTO public.social_audit_log (id, actor_id, memory_id, action, outcome_code)
       VALUES ('22222222-2222-4222-8222-222222222222','syn',$1,'comment.create','success')`,
      [MEM]
    );
    const r2 = await client.query(
      `SELECT target_kind, target_id::text AS tid FROM public.social_audit_log WHERE id='22222222-2222-4222-8222-222222222222'`
    );
    assert.equal(r2.rows[0].target_kind, 'memory');
    assert.equal(r2.rows[0].tid, MEM);
    pass('b-guard compat_audit_legacy_only');

    // tree pair allowed when legacy null
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint,
         target_memory_id, target_kind, target_id
       ) VALUES ('33333333-3333-4333-8333-333333333333','syn','comment.create','k3','f3',NULL,'tree',$1)`,
      [TREE]
    );
    pass('b-guard compat_idempotency_tree');

    await client.query(
      `INSERT INTO public.social_audit_log (
         id, actor_id, memory_id, action, outcome_code, target_kind, target_id
       ) VALUES ('44444444-4444-4444-8444-444444444444','syn',NULL,'comment.create','success','tree',$1)`,
      [TREE]
    );
    pass('b-guard compat_audit_tree');

    // tree with legacy populated rejected
    let failed = false;
    try {
      await client.query(
        `INSERT INTO public.social_idempotency (
           id, actor_id, operation, idempotency_key, request_fingerprint,
           target_memory_id, target_kind, target_id
         ) VALUES ('55555555-5555-4555-8555-555555555555','syn','comment.create','k5','f5',$1,'tree',$2)`,
        [MEM, TREE]
      );
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
    pass('b-guard compat_idempotency_tree_legacy_reject');

    failed = false;
    try {
      await client.query(
        `INSERT INTO public.social_audit_log (
           id, actor_id, memory_id, action, outcome_code, target_kind, target_id
         ) VALUES ('66666666-6666-4666-8666-666666666666','syn',$1,'comment.create','success','tree',$2)`,
        [MEM, TREE]
      );
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
    pass('b-guard compat_audit_tree_legacy_reject');

    // partial reject
    failed = false;
    try {
      await client.query(
        `INSERT INTO public.social_idempotency (
           id, actor_id, operation, idempotency_key, request_fingerprint,
           target_memory_id, target_kind
         ) VALUES ('77777777-7777-4777-8777-777777777777','syn','comment.create','k7','f7',$1,'memory')`,
        [MEM]
      );
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
    pass('b-guard compat_idempotency_partial_reject');
  });
});

// ─── Fail-closed matrices ────────────────────────────────────────────────────

test('b-guard relation and mixed state rejections', { concurrency: false }, async () => {
  await withDisposableDb('b_miss', null, async ({ client, runSql }) => {
    await client.query(`
      CREATE TABLE public.social_audit_log (
        id UUID PRIMARY KEY, actor_id VARCHAR(128) NOT NULL, memory_id UUID NOT NULL,
        action VARCHAR(64) NOT NULL, outcome_code VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
      INSERT INTO public.lb_unrelated_marker VALUES ('u1','keep');
    `);
    await assertBRejection(client, runSql, 'miss_idem', 'GENERIC_SOCIAL_B_RELATION_PRECONDITION_FAILED');
  });

  await withDisposableDb('b_view', null, async ({ client, runSql }) => {
    await client.query(`
      CREATE TABLE public.social_audit_log (
        id UUID PRIMARY KEY, actor_id VARCHAR(128) NOT NULL, memory_id UUID NOT NULL,
        action VARCHAR(64) NOT NULL, outcome_code VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE VIEW public.social_idempotency AS SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid AS id;
      CREATE TABLE public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
      INSERT INTO public.lb_unrelated_marker VALUES ('u1','keep');
    `);
    await assertBRejection(client, runSql, 'view_idem', 'GENERIC_SOCIAL_B_RELATION_PRECONDITION_FAILED');
  });
});

test('b-guard STATE_A object mutation rejections', { concurrency: false }, async () => {
  // wrong A CHECK after STATE_A
  await withDisposableDb('b_chk', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_chk');
    await client.query(`
      ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check;
      ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (target_kind IS NOT NULL);
    `);
    await assertBRejection(
      client,
      runSql,
      'a_check_wrong',
      'GENERIC_SOCIAL_B_MIGRATION_A_CHECK_DEFINITION_MISMATCH'
    );
  });

  // A function body wrong
  await withDisposableDb('b_fn', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_fn');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
      RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;
    `);
    await assertBRejection(
      client,
      runSql,
      'a_fn_wrong_body',
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
  });

  // A function overload
  await withDisposableDb('b_fn_ov', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_fn_ov');
    await client.query(`
      CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory(integer)
      RETURNS integer LANGUAGE sql AS $$SELECT $1;$$;
    `);
    await assertBRejection(
      client,
      runSql,
      'a_fn_overload',
      'GENERIC_SOCIAL_B_MIGRATION_A_FUNCTION_DEFINITION_MISMATCH'
    );
  });

  // trigger disabled
  await withDisposableDb('b_tg', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_tg');
    await client.query(
      `ALTER TABLE public.social_idempotency DISABLE TRIGGER trg_social_idempotency_sync_generic_target`
    );
    await assertBRejection(
      client,
      runSql,
      'a_tg_disabled',
      'GENERIC_SOCIAL_B_TRIGGER_DEFINITION_MISMATCH'
    );
  });

  // data mismatch in STATE_A
  await withDisposableDb('b_data', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_data');
    await client.query(`ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL`);
    await client.query(
      `UPDATE public.social_idempotency SET target_id='ffffffff-ffff-4fff-8fff-ffffffffffff'`
    );
    await client.query(`ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL`);
    await assertBRejection(client, runSql, 'a_data_mis', 'GENERIC_SOCIAL_B_DATA_STATE_MISMATCH');
  });

  // mixed: one table generic NOT NULL
  await withDisposableDb('b_mixed', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_mixed');
    await client.query(`ALTER TABLE public.social_idempotency ALTER COLUMN target_kind SET NOT NULL`);
    await assertBRejection(client, runSql, 'mixed_nullability', 'GENERIC_SOCIAL_B_MIXED_STATE_REJECTED');
  });
});

test('b-guard postcondition rejects STATE_B mutations', { concurrency: false }, async () => {
  const mutations = [
    [
      'post_wrong_b_check',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_memory_legacy_match_check;
       ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_memory_legacy_match_check CHECK (true);`,
    ],
    [
      'post_fn_wrong_body',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
       RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;`,
    ],
    [
      'post_tg_disabled',
      `ALTER TABLE public.social_idempotency DISABLE TRIGGER trg_social_idempotency_sync_generic_target;`,
    ],
    [
      'post_kind_nullable',
      `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind DROP NOT NULL;`,
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
  // No direct MIG_B apply outside helper body
  const withoutHelper = src.replace(
    /function runGuardedMigrationBSequence[\s\S]*?^}/m,
    'function runGuardedMigrationBSequence(){}'
  );
  assert.equal(/(?:^|[^=])\s*runSql\s*\(\s*MIG_B\s*\)/m.test(withoutHelper), false);
  assert.equal(/process\.env\.DATABASE_URL/i.test(src), false);
  pass('b-guard no unguarded Migration B');
});

// Temporary catalog fingerprint probe (remove after exact B hashes captured).
test('b-guard probe STATE_B object fingerprints', { concurrency: false }, async () => {
  await withDisposableDb('b_probe', FIXTURE, async ({ client, runSql }) => {
    await reachStateA(client, runSql, 'b_probe');
    const seq = runGuardedMigrationBSequence(runSql);
    assert.equal(seq.stoppedAt, 'done');
    const checks = await client.query(`
      SELECT
        n.nspname AS schema,
        rel.relname AS relation,
        c.conname,
        c.contype::text AS contype,
        c.convalidated::text AS convalidated,
        trim(both from regexp_replace(replace(replace(pg_get_constraintdef(c.oid,false), E'\\r\\n', E'\\n'), E'\\r', E'\\n'), E'\\\\s+', ' ', 'g')) AS c_norm,
        encode(sha256(convert_to(concat_ws(E'\\n', n.nspname, rel.relname, c.conname, c.contype::text, c.convalidated::text,
          trim(both from regexp_replace(replace(replace(pg_get_constraintdef(c.oid,false), E'\\r\\n', E'\\n'), E'\\r', E'\\n'), E'\\\\s+', ' ', 'g'))
        ), 'utf8')), 'hex') AS actual_hash
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE c.conname IN (
        'social_idempotency_memory_legacy_match_check',
        'social_idempotency_tree_legacy_null_check',
        'social_audit_log_memory_legacy_match_check',
        'social_audit_log_tree_legacy_null_check'
      )
      ORDER BY c.conname
    `);
    const funcs = await client.query(`
      SELECT
        ns.nspname AS schema,
        p.proname,
        pg_get_function_identity_arguments(p.oid) AS args,
        pg_get_function_result(p.oid) AS result,
        l.lanname AS language,
        p.prosecdef::text AS security,
        p.provolatile::text AS volatility,
        p.proparallel::text AS parallel,
        p.proleakproof::text AS leakproof,
        p.proisstrict::text AS strict,
        COALESCE((SELECT string_agg(cfg, ',' ORDER BY cfg) FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg), '') AS config,
        trim(both from regexp_replace(replace(replace(p.prosrc, E'\\r\\n', E'\\n'), E'\\r', E'\\n'), E'\\\\s+', ' ', 'g')) AS f_norm,
        encode(sha256(convert_to(concat_ws(E'\\n', ns.nspname, p.proname,
          pg_get_function_identity_arguments(p.oid),
          pg_get_function_result(p.oid),
          l.lanname,
          p.prosecdef::text,
          p.provolatile::text,
          p.proparallel::text,
          p.proleakproof::text,
          p.proisstrict::text,
          COALESCE((SELECT string_agg(cfg, ',' ORDER BY cfg) FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg), ''),
          trim(both from regexp_replace(replace(replace(p.prosrc, E'\\r\\n', E'\\n'), E'\\r', E'\\n'), E'\\\\s+', ' ', 'g'))
        ), 'utf8')), 'hex') AS actual_hash
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
      WHERE ns.nspname = 'public'
        AND p.proname IN (
          'sync_social_idempotency_generic_target_from_legacy_memory',
          'sync_social_audit_generic_target_from_legacy_memory'
        )
        AND pg_get_function_identity_arguments(p.oid) = ''
      ORDER BY p.proname
    `);
    for (const row of checks.rows) {
      process.stdout.write(`B_CHECK_HASH ${row.conname} ${row.actual_hash} DEF ${row.c_norm}\n`);
    }
    for (const row of funcs.rows) {
      process.stdout.write(
        `B_FUNC_HASH ${row.proname} ${row.actual_hash} vol=${row.volatility} par=${row.parallel} sec=${row.security} lang=${row.language} ret=${row.result}\n`
      );
    }
    pass('b-guard probe STATE_B object fingerprints');
  });
});
