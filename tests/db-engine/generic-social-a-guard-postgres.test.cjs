'use strict';

/**
 * DB_ENGINE_EXECUTION: Migration A execution guard on disposable PostgreSQL 17.4.
 *
 * Sequence for supported work:
 *   preflight validator → exact historical Migration A → postcondition validator
 *
 * Never mutates historical Migration A SQL. Never reads DATABASE_URL.
 * Migration B is never executed.
 *
 * Refs: #3536, #3534, #3262, #3459, #3458, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const harness = require('./helpers/postgres-disposable-harness.cjs');
const catalog = require('./helpers/generic-social-a-guard-catalog.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const PREFLIGHT = path.join(ROOT, 'scripts/validate-generic-social-a-preflight.sql');
const POSTCOND = path.join(ROOT, 'scripts/validate-generic-social-a-postcondition.sql');
const MIG_A = path.join(ROOT, 'scripts/migration-add-generic-social-targets.sql');
const MIG_B = path.join(ROOT, 'scripts/migration-b-generic-social-targets-cutover.sql');
const FIXTURE = path.join(__dirname, 'fixtures/generic-social-a-guard-legacy.sql');

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
  const m = out.match(/GENERIC_SOCIAL_A_[A-Z0-9_]+/);
  if (m) return m[0];
  if (/Prerequisite table/i.test(out)) return 'MIGRATION_PRECONDITION_FAILED';
  return 'ENGINE_ERROR';
}

function assertCategory(res, expectedCategory) {
  const cat = classify(combinedOutput(res));
  assert.equal(cat, expectedCategory);
}

/**
 * Real guarded workflow: preflight always runs; Migration A only if preflight
 * succeeds; postcondition only if Migration A succeeds. Counts invocations.
 */
function runGuardedSequence(runSql) {
  const counts = { preflight: 0, migA: 0, postcond: 0 };
  counts.preflight += 1;
  const pre = runSql(PREFLIGHT);
  if (pre.status !== 0) {
    return { counts, pre, mig: null, post: null, stoppedAt: 'preflight' };
  }
  counts.migA += 1;
  const mig = runSql(MIG_A);
  if (mig.status !== 0) {
    return { counts, pre, mig, post: null, stoppedAt: 'migA' };
  }
  counts.postcond += 1;
  const post = runSql(POSTCOND);
  return {
    counts,
    pre,
    mig,
    post,
    stoppedAt: post.status === 0 ? 'done' : 'postcond',
  };
}

/**
 * Preflight-failure path via real guarded sequence: proves short-circuit
 * (Migration A = 0, postcondition = 0) and catalog/row fingerprint invariance.
 */
async function assertRejectionWithNoMutation(client, runSql, scenario, phase, expectedCategory) {
  const before = await catalog.getCatalogFingerprint(client);
  const beforeRowsI = await catalog.getFullRowFingerprint(client, 'idem');
  const beforeRowsA = await catalog.getFullRowFingerprint(client, 'audit');

  const seq = runGuardedSequence(runSql);
  assert.equal(seq.counts.preflight, 1, 'preflight invocation = 1');
  assert.equal(seq.counts.migA, 0, 'Migration A invocation count = 0');
  assert.equal(seq.counts.postcond, 0, 'postcondition invocation count = 0');
  assert.equal(seq.stoppedAt, 'preflight');
  expectFail(seq.pre, scenario, phase);
  assertCategory(seq.pre, expectedCategory);

  await assertNoMutation(client, before);
  const afterRowsI = await catalog.getFullRowFingerprint(client, 'idem');
  assert.equal(afterRowsI.rowFp, beforeRowsI.rowFp, 'row fingerprint unchanged');
  const afterRowsA = await catalog.getFullRowFingerprint(client, 'audit');
  assert.equal(afterRowsA.rowFp, beforeRowsA.rowFp, 'row fingerprint unchanged');
}

// ─── Supported guarded sequence ──────────────────────────────────────────────

test('guarded happy path preflight→Migration A→postcondition', { concurrency: false }, async () => {
  await withDisposableDb('happy', FIXTURE, async ({ client, runSql }) => {
    const beforeColsI = await catalog.getColumnNames(client, 'social_idempotency');
    const beforeColsA = await catalog.getColumnNames(client, 'social_audit_log');
    const beforeI = await catalog.getFullRowFingerprint(client, 'idem');
    const beforeA = await catalog.getFullRowFingerprint(client, 'audit');
    const beforeU = await catalog.getFullRowFingerprint(client, 'unrelated');

    const seq = runGuardedSequence(runSql);
    assert.equal(seq.counts.preflight, 1);
    assert.equal(seq.counts.migA, 1);
    assert.equal(seq.counts.postcond, 1);
    assert.equal(seq.stoppedAt, 'done');
    expectOk(seq.pre, 'happy', 'preflight');
    pass('guard preflight legacy');
    expectOk(seq.mig, 'happy', 'migration_a');
    pass('guard migration a');
    expectOk(seq.post, 'happy', 'postcondition');
    pass('guard postcondition');

    assert.equal(await catalog.getBackfillOk(client), true);
    const afterI = await catalog.getFullRowFingerprint(client, 'idem', { columns: beforeColsI });
    const afterA = await catalog.getFullRowFingerprint(client, 'audit', { columns: beforeColsA });
    assert.equal(afterI.rowFp, beforeI.rowFp);
    assert.equal(afterA.rowFp, beforeA.rowFp);
    assert.deepEqual(await catalog.getFullRowFingerprint(client, 'unrelated'), beforeU);
    pass('guard backfill and base-row preserve');
  });
});

test('guarded second apply on exact post-state is no-op', { concurrency: false }, async () => {
  await withDisposableDb('second', FIXTURE, async ({ client, runSql }) => {
    const first = runGuardedSequence(runSql);
    expectOk(first.pre, 'second', 'preflight1');
    expectOk(first.mig, 'second', 'apply1');
    expectOk(first.post, 'second', 'post1');
    const fp = await catalog.getCatalogFingerprint(client);

    const second = runGuardedSequence(runSql);
    expectOk(second.pre, 'second', 'preflight2');
    expectOk(second.mig, 'second', 'apply2');
    expectOk(second.post, 'second', 'post2');
    await assertNoMutation(client, fp);
    pass('guard second apply no-op');
  });
});

// ─── Preflight rejection: Migration A not called ─────────────────────────────

async function rejectWithoutMigration(scenario, setupSql, expectedCategory) {
  await withDisposableDb(scenario, null, async ({ client, runSql }) => {
    await client.query(setupSql);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
      INSERT INTO public.lb_unrelated_marker(id,v) VALUES ('u1','keep') ON CONFLICT DO NOTHING;
    `);

    const before = await catalog.getCatalogFingerprint(client);
    let beforeRowsI = null;
    let beforeRowsA = null;
    try {
      beforeRowsI = await catalog.getFullRowFingerprint(client, 'idem');
      beforeRowsA = await catalog.getFullRowFingerprint(client, 'audit');
    } catch (_) {
      /* tables may be incomplete for relation/legacy fixtures */
    }

    const seq = runGuardedSequence(runSql);
    assert.equal(seq.counts.preflight, 1, 'preflight invocation = 1');
    assert.equal(seq.counts.migA, 0, 'Migration A invocation count = 0');
    assert.equal(seq.counts.postcond, 0, 'postcondition invocation count = 0');
    assert.equal(seq.stoppedAt, 'preflight');
    expectFail(seq.pre, scenario, 'preflight');
    assertCategory(seq.pre, expectedCategory);

    await assertNoMutation(client, before);

    if (beforeRowsI) {
      const afterRowsI = await catalog.getFullRowFingerprint(client, 'idem');
      assert.equal(afterRowsI.rowFp, beforeRowsI.rowFp, 'row fingerprint unchanged');
    }
    if (beforeRowsA) {
      const afterRowsA = await catalog.getFullRowFingerprint(client, 'audit');
      assert.equal(afterRowsA.rowFp, beforeRowsA.rowFp, 'row fingerprint unchanged');
    }

    pass(`guard reject ${scenario}`);
  });
}

const IDEM_DDL = `
  CREATE TABLE public.social_idempotency (
    id UUID PRIMARY KEY,
    actor_id VARCHAR(128) NOT NULL,
    operation VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    target_memory_id UUID NOT NULL,
    result_state VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const AUDIT_DDL = `
  CREATE TABLE public.social_audit_log (
    id UUID PRIMARY KEY,
    actor_id VARCHAR(128) NOT NULL,
    memory_id UUID NOT NULL,
    action VARCHAR(64) NOT NULL,
    outcome_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const LEGACY_BASE = IDEM_DDL + AUDIT_DDL;

test('preflight rejects missing relation', { concurrency: false }, async () => {
  await rejectWithoutMigration(
    'miss_idem',
    AUDIT_DDL,
    'GENERIC_SOCIAL_A_RELATION_PRECONDITION_FAILED'
  );
});

test('preflight rejects legacy column shape', { concurrency: false }, async () => {
  const shapes = [
    [
      'legacy_missing_idem',
      IDEM_DDL.replace('    target_memory_id UUID NOT NULL,\n', '') + AUDIT_DDL,
    ],
    [
      'legacy_null_idem',
      IDEM_DDL.replace('target_memory_id UUID NOT NULL', 'target_memory_id UUID') + AUDIT_DDL,
    ],
    [
      'legacy_type_idem',
      IDEM_DDL.replace('target_memory_id UUID NOT NULL', 'target_memory_id TEXT NOT NULL') + AUDIT_DDL,
    ],
    [
      'legacy_def_idem',
      IDEM_DDL.replace(
        'target_memory_id UUID NOT NULL',
        'target_memory_id UUID NOT NULL DEFAULT gen_random_uuid()'
      ) + AUDIT_DDL,
    ],
    [
      'legacy_missing_audit',
      IDEM_DDL + AUDIT_DDL.replace('    memory_id UUID NOT NULL,\n', ''),
    ],
    [
      'legacy_null_audit',
      IDEM_DDL + AUDIT_DDL.replace('memory_id UUID NOT NULL', 'memory_id UUID'),
    ],
    [
      'legacy_type_audit',
      IDEM_DDL + AUDIT_DDL.replace('memory_id UUID NOT NULL', 'memory_id TEXT NOT NULL'),
    ],
    [
      'legacy_def_audit',
      IDEM_DDL +
        AUDIT_DDL.replace(
          'memory_id UUID NOT NULL',
          'memory_id UUID NOT NULL DEFAULT gen_random_uuid()'
        ),
    ],
  ];
  for (const [name, setup] of shapes) {
    await rejectWithoutMigration(name, setup, 'GENERIC_SOCIAL_A_LEGACY_COLUMN_SHAPE_MISMATCH');
  }
});

test('preflight rejects generic column partial pair', { concurrency: false }, async () => {
  await rejectWithoutMigration(
    'gen_partial_idem',
    LEGACY_BASE + `ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16);`,
    'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE'
  );
  await rejectWithoutMigration(
    'gen_partial_audit',
    LEGACY_BASE + `ALTER TABLE public.social_audit_log ADD COLUMN target_id UUID;`,
    'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE'
  );
});

test('preflight rejects generic column shape mismatches', { concurrency: false }, async () => {
  const shapes = [
    ['kind_int', `ADD COLUMN target_kind integer, ADD COLUMN target_id UUID`],
    ['kind_v8', `ADD COLUMN target_kind VARCHAR(8), ADD COLUMN target_id UUID`],
    ['kind_v32', `ADD COLUMN target_kind VARCHAR(32), ADD COLUMN target_id UUID`],
    ['kind_nn', `ADD COLUMN target_kind VARCHAR(16) NOT NULL, ADD COLUMN target_id UUID`],
    ['kind_def', `ADD COLUMN target_kind VARCHAR(16) DEFAULT 'memory', ADD COLUMN target_id UUID`],
    ['id_text', `ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id TEXT`],
    ['id_nn', `ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID NOT NULL`],
    [
      'id_def',
      `ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID DEFAULT 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'`,
    ],
  ];
  for (const [name, alter] of shapes) {
    await rejectWithoutMigration(
      name,
      LEGACY_BASE +
        `ALTER TABLE public.social_idempotency ${alter};
        ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;`,
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'
    );
  }
});

// Data-state fixtures (post-Migration A mutations, then guarded short-circuit)
test('preflight rejects bad data states on exact column shapes', { concurrency: false }, async () => {
  await withDisposableDb('data_partial', FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(PREFLIGHT), 'data_partial', 'pre');
    expectOk(runSql(MIG_A), 'data_partial', 'mig');
    await client.query(`
      ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_pair_check;
      ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
      UPDATE public.social_idempotency SET target_id = NULL WHERE target_kind IS NOT NULL;
      ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL;
    `);
    await assertRejectionWithNoMutation(
      client,
      runSql,
      'data_partial',
      'preflight',
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE'
    );
    pass('guard reject data_partial');
  });

  await withDisposableDb('data_tree', FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(PREFLIGHT), 'data_tree', 'pre');
    expectOk(runSql(MIG_A), 'data_tree', 'mig');
    await client.query(`ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL`);
    await client.query(
      `UPDATE public.social_idempotency SET target_kind='tree', target_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'`
    );
    await client.query(`ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL`);
    await assertRejectionWithNoMutation(
      client,
      runSql,
      'data_tree',
      'preflight',
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'
    );
    pass('guard reject data_tree');
  });

  await withDisposableDb('data_unknown', FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(PREFLIGHT), 'data_unknown', 'pre');
    expectOk(runSql(MIG_A), 'data_unknown', 'mig');
    await client.query(`
      ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
      ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_kind_check;
    `);
    await client.query(
      `UPDATE public.social_idempotency SET target_kind='unknown', target_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'`
    );
    await client.query(`ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL`);
    await assertRejectionWithNoMutation(
      client,
      runSql,
      'data_unknown',
      'preflight',
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'
    );
    pass('guard reject data_unknown');
  });

  await withDisposableDb('data_mis', FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(PREFLIGHT), 'data_mis', 'pre');
    expectOk(runSql(MIG_A), 'data_mis', 'mig');
    await client.query(`ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL`);
    await client.query(
      `UPDATE public.social_idempotency SET target_id='ffffffff-ffff-4fff-8fff-ffffffffffff'`
    );
    await client.query(`ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL`);
    await assertRejectionWithNoMutation(
      client,
      runSql,
      'data_mis',
      'preflight',
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'
    );
    pass('guard reject data_mis');
  });
});

test('preflight rejects mixed table states', { concurrency: false }, async () => {
  await rejectWithoutMigration(
    'mixed_audit_partial',
    LEGACY_BASE + `ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16);`,
    'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE'
  );
  await rejectWithoutMigration(
    'mixed_idem_exact_post',
    LEGACY_BASE +
      `ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;`,
    'GENERIC_SOCIAL_A_MIXED_STATE_REJECTED'
  );

  // mixed_audit_wrong_shape: keep idempotency exact post-state; rebuild audit
  // generic columns with a wrong shape without depending on ALTER TYPE through CHECKs.
  await withDisposableDb('mixed_audit_wrong_shape', FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(PREFLIGHT), 'mixed_audit_wrong_shape', 'pre');
    expectOk(runSql(MIG_A), 'mixed_audit_wrong_shape', 'mig');
    await client.query(`
      DROP TRIGGER IF EXISTS trg_social_audit_log_sync_generic_target ON public.social_audit_log;
      ALTER TABLE public.social_audit_log
        DROP CONSTRAINT IF EXISTS social_audit_log_generic_target_pair_check,
        DROP CONSTRAINT IF EXISTS social_audit_log_generic_target_kind_check;
      ALTER TABLE public.social_audit_log DROP COLUMN target_kind;
      ALTER TABLE public.social_audit_log DROP COLUMN target_id;
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind integer;
      ALTER TABLE public.social_audit_log ADD COLUMN target_id UUID;
    `);
    await assertRejectionWithNoMutation(
      client,
      runSql,
      'mixed_audit_wrong_shape',
      'preflight',
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'
    );
    pass('guard reject mixed_audit_wrong_shape');
  });
});

// CHECK fixtures
test('preflight CHECK fixtures', { concurrency: false }, async () => {
  const mutations = [
    [
      'check_wrong_pair',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check; ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (target_kind IS NOT NULL);`,
      'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'check_wrong_vocab',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_kind_check; ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_kind_check CHECK (target_kind IS NULL OR target_kind IN ('memory', 'something'));`,
      'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'check_not_valid',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check; ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL))) NOT VALID;`,
      'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'check_malicious',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check; ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (1=1);`,
      'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'check_wrong_table',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check; ALTER TABLE public.social_idempotency ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)));`,
      'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'check_anchor_kind_null',
      // Existing post-Migration A rows have target_kind='memory'; clear rows so the
      // adversarial CHECK can be installed as a validated object for preflight rejection.
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check; DELETE FROM public.social_audit_log; ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (target_kind IS NULL);`,
      'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'check_anchor_id_null',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check; DELETE FROM public.social_audit_log; ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (target_id IS NULL);`,
      'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'check_anchor_kind_not_null',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check; ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (target_kind IS NOT NULL);`,
      'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'check_anchor_id_not_null',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check; ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (target_id IS NOT NULL);`,
      'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'check_weak_semantics',
      `ALTER TABLE public.social_audit_log DROP CONSTRAINT social_audit_log_generic_target_pair_check; ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (target_kind IS NULL OR target_id IS NULL OR target_kind IS NOT NULL OR target_id IS NOT NULL);`,
      'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH',
    ],
    [
      'check_shadow',
      `CREATE TABLE public.shadow_table (target_kind VARCHAR(16), target_id UUID); ALTER TABLE public.shadow_table ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)));`,
      'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH',
    ],
  ];
  for (const [name, sql, expected] of mutations) {
    await withDisposableDb(`pre_chk_${name}`, FIXTURE, async ({ client, runSql }) => {
      expectOk(runSql(PREFLIGHT), `pre_chk_${name}`, 'setup_pre');
      expectOk(runSql(MIG_A), `pre_chk_${name}`, 'setup_mig');
      await client.query(sql);
      await assertRejectionWithNoMutation(client, runSql, 'pre_chk', name, expected);
      pass(`guard reject ${name}`);
    });
  }
});

test('preflight Function fixtures', { concurrency: false }, async () => {
  const mutations = [
    [
      'fn_lang_sql_overload',
      `CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory(integer) RETURNS integer LANGUAGE sql AS $$SELECT $1;$$;`,
      'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH',
    ],
    [
      'fn_wrong_body',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.target_kind := 'memory'; RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH',
    ],
    [
      'fn_early_return',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH',
    ],
    [
      'fn_no_tree_reject',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.target_kind IS NULL THEN NEW.target_kind := 'memory'; NEW.target_id := NEW.target_memory_id; END IF; RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH',
    ],
    [
      'fn_secdef',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH',
    ],
    [
      'fn_volatility',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql STABLE AS $$BEGIN RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH',
    ],
    [
      'fn_parallel',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql PARALLEL SAFE AS $$BEGIN RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH',
    ],
    [
      'fn_ret_type',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency; DROP FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory(); CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS void LANGUAGE plpgsql AS $$BEGIN END;$$;`,
      'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH',
    ],
    [
      'fn_missing_rejection',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.target_kind = 'tree' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_IMMUTABLE_TREE_TARGET_REJECTED'; END IF; NEW.target_kind := 'memory'; NEW.target_id := NEW.target_memory_id; RETURN NEW; END;$$;`,
      'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH',
    ],
    [
      'fn_overload_plpgsql',
      `CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory(a integer) RETURNS integer LANGUAGE plpgsql AS $$BEGIN RETURN a; END;$$;`,
      'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH',
    ],
  ];
  for (const [name, sql, expected] of mutations) {
    await withDisposableDb(`pre_fn_${name}`, FIXTURE, async ({ client, runSql }) => {
      expectOk(runSql(PREFLIGHT), `pre_fn_${name}`, 'setup_pre');
      expectOk(runSql(MIG_A), `pre_fn_${name}`, 'setup_mig');
      await client.query(sql);
      await assertRejectionWithNoMutation(client, runSql, 'pre_fn', name, expected);
      pass(`guard reject ${name}`);
    });
  }
});

test('preflight Trigger fixtures', { concurrency: false }, async () => {
  const mutations = [
    [
      'tg_wrong_fn',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency; CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory();`,
      'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH',
    ],
    [
      'tg_after',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency; CREATE TRIGGER trg_social_idempotency_sync_generic_target AFTER INSERT OR UPDATE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
      'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH',
    ],
    [
      'tg_before_insert',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency; CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
      'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH',
    ],
    [
      'tg_statement',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency; CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_idempotency FOR EACH STATEMENT EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
      'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH',
    ],
    [
      'tg_disabled',
      `ALTER TABLE public.social_idempotency DISABLE TRIGGER trg_social_idempotency_sync_generic_target;`,
      'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH',
    ],
    [
      'tg_always',
      `ALTER TABLE public.social_idempotency ENABLE ALWAYS TRIGGER trg_social_idempotency_sync_generic_target;`,
      'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH',
    ],
    [
      'tg_replica',
      `ALTER TABLE public.social_idempotency ENABLE REPLICA TRIGGER trg_social_idempotency_sync_generic_target;`,
      'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH',
    ],
    [
      'tg_delete',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency; CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT OR UPDATE OR DELETE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
      'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH',
    ],
    [
      'tg_update_only',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency; CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE UPDATE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
      'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH',
    ],
    [
      'tg_wrong_relation',
      `DROP TRIGGER trg_social_audit_log_sync_generic_target ON public.social_audit_log; CREATE TRIGGER trg_social_audit_log_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory();`,
      'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH',
    ],
  ];
  for (const [name, sql, expected] of mutations) {
    await withDisposableDb(`pre_tg_${name}`, FIXTURE, async ({ client, runSql }) => {
      expectOk(runSql(PREFLIGHT), `pre_tg_${name}`, 'setup_pre');
      expectOk(runSql(MIG_A), `pre_tg_${name}`, 'setup_mig');
      await client.query(sql);
      await assertRejectionWithNoMutation(client, runSql, 'pre_tg', name, expected);
      pass(`guard reject ${name}`);
    });
  }
});

// Postcondition adversarial evidence — all failures use POSTCONDITION_FAILED
test('postcondition validator rejects mutated states', { concurrency: false }, async () => {
  const mutations = [
    [
      'wrong_check',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_pair_check; ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_generic_target_pair_check CHECK (target_kind IS NOT NULL);`,
    ],
    [
      'unvalidated_check',
      `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_pair_check; ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_generic_target_pair_check CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL))) NOT VALID;`,
    ],
    [
      'check_shadow',
      `CREATE TABLE public.shadow_table_post (target_kind VARCHAR(16), target_id UUID); ALTER TABLE public.shadow_table_post ADD CONSTRAINT social_idempotency_generic_target_pair_check CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)));`,
    ],
    [
      'fn_lang_sql_overload',
      `CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory(integer) RETURNS integer LANGUAGE sql AS $$SELECT $1;$$;`,
    ],
    [
      'fn_overload_plpgsql',
      `CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory(a integer) RETURNS integer LANGUAGE plpgsql AS $$BEGIN RETURN a; END;$$;`,
    ],
    [
      'wrong_function_body',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;`,
    ],
    [
      'sec_def_function',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN NEW.target_kind := 'memory'; NEW.target_id := NEW.target_memory_id; RETURN NEW; END;$$;`,
    ],
    [
      'fn_missing_rejection',
      `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.target_kind = 'tree' THEN RAISE EXCEPTION 'GENERIC_SOCIAL_A_IMMUTABLE_TREE_TARGET_REJECTED'; END IF; NEW.target_kind := 'memory'; NEW.target_id := NEW.target_memory_id; RETURN NEW; END;$$;`,
    ],
    [
      'tg_disabled',
      `ALTER TABLE public.social_idempotency DISABLE TRIGGER trg_social_idempotency_sync_generic_target;`,
    ],
    [
      'tg_always',
      `ALTER TABLE public.social_idempotency ENABLE ALWAYS TRIGGER trg_social_idempotency_sync_generic_target;`,
    ],
    [
      'tg_replica',
      `ALTER TABLE public.social_idempotency ENABLE REPLICA TRIGGER trg_social_idempotency_sync_generic_target;`,
    ],
    [
      'tg_insert_only',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency; CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`,
    ],
    [
      'wrong_trigger_function',
      `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency; CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory();`,
    ],
    ['target_kind_default', `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind SET DEFAULT 'memory';`],
    ['target_id_not_null', `ALTER TABLE public.social_idempotency ALTER COLUMN target_id SET NOT NULL;`],
    ['wrong_generic_type', `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind TYPE VARCHAR(32);`],
  ];

  for (const [name, sql] of mutations) {
    await withDisposableDb(`post_adv_${name}`, FIXTURE, async ({ client, runSql }) => {
      expectOk(runSql(PREFLIGHT), 'post_adv', 'preflight');
      expectOk(runSql(MIG_A), 'post_adv', 'mig');

      await client.query(sql);

      const mutatedFp = await catalog.getCatalogFingerprint(client);
      const post = runSql(POSTCOND);
      expectFail(post, 'post_adv', `postcond_${name}`);
      assertCategory(post, 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED');

      const afterFp = await catalog.getCatalogFingerprint(client);
      assert.ok(
        catalog.fingerprintEqual(mutatedFp, afterFp),
        `Validator must not mutate state during ${name}`
      );
      pass(`guard post reject ${name}`);
    });
  }
});

test('suite never executes Migration B', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(__filename, 'utf8');
  assert.ok(fs.existsSync(MIG_B));
  assert.equal(/(?:^|[^=])\s*runSql\s*\(\s*MIG_B\s*\)/m.test(src), false);
  assert.match(src, /runGuardedSequence/);
  assert.match(src, /runSql\(PREFLIGHT\)/);
  assert.match(src, /runSql\(MIG_A\)/);
  assert.match(src, /runSql\(POSTCOND\)/);
  pass('guard no Migration B');
});
