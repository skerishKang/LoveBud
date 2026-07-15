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

// ─── Supported guarded sequence ──────────────────────────────────────────────

test('guarded happy path preflight→Migration A→postcondition', { concurrency: false }, async () => {
  await withDisposableDb('happy', FIXTURE, async ({ client, runSql }) => {
    const beforeColsI = await catalog.getColumnNames(client, 'social_idempotency');
    const beforeColsA = await catalog.getColumnNames(client, 'social_audit_log');
    const beforeI = await catalog.getFullRowFingerprint(client, 'idem');
    const beforeA = await catalog.getFullRowFingerprint(client, 'audit');
    const beforeU = await catalog.getFullRowFingerprint(client, 'unrelated');

    expectOk(runSql(PREFLIGHT), 'happy', 'preflight');
    pass('guard preflight legacy');

    expectOk(runSql(MIG_A), 'happy', 'migration_a');
    pass('guard migration a');

    expectOk(runSql(POSTCOND), 'happy', 'postcondition');
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
    expectOk(runSql(PREFLIGHT), 'second', 'preflight1');
    expectOk(runSql(MIG_A), 'second', 'apply1');
    expectOk(runSql(POSTCOND), 'second', 'post1');
    const fp = await catalog.getCatalogFingerprint(client);

    expectOk(runSql(PREFLIGHT), 'second', 'preflight2');
    expectOk(runSql(MIG_A), 'second', 'apply2');
    expectOk(runSql(POSTCOND), 'second', 'post2');
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
    
    let migAInvocations = 0;
    let postInvocations = 0;
    const originalRunSql = runSql;
    const interceptRunSql = (p) => {
      if (p === MIG_A) migAInvocations++;
      if (p === POSTCOND) postInvocations++;
      return originalRunSql(p);
    };

    const before = await catalog.getCatalogFingerprint(client);
    let beforeRowsI = null;
    let beforeRowsA = null;
    try {
      beforeRowsI = await catalog.getFullRowFingerprint(client, 'social_idempotency');
      beforeRowsA = await catalog.getFullRowFingerprint(client, 'social_audit_log');
    } catch (e) {}

    const pre = interceptRunSql(PREFLIGHT);
    expectFail(pre, scenario, 'preflight');
    assertCategory(pre, expectedCategory);
    
    assert.equal(migAInvocations, 0, 'Migration A invocation count = 0');
    assert.equal(postInvocations, 0, 'postcondition invocation count = 0');
    
    await assertNoMutation(client, before);

    if (beforeRowsI) {
      const afterRowsI = await catalog.getFullRowFingerprint(client, 'social_idempotency');
      assert.equal(afterRowsI.rowFp, beforeRowsI.rowFp, 'row fingerprint unchanged');
    }
    if (beforeRowsA) {
      const afterRowsA = await catalog.getFullRowFingerprint(client, 'social_audit_log');
      assert.equal(afterRowsA.rowFp, beforeRowsA.rowFp, 'row fingerprint unchanged');
    }
    
    pass(`guard reject ${scenario}`);
  });
}

const LEGACY_BASE = `
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
  CREATE TABLE public.social_audit_log (
    id UUID PRIMARY KEY,
    actor_id VARCHAR(128) NOT NULL,
    memory_id UUID NOT NULL,
    action VARCHAR(64) NOT NULL,
    outcome_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

test('preflight rejects missing relation', { concurrency: false }, async () => {
  await rejectWithoutMigration(
    'miss_idem',
    `CREATE TABLE public.social_audit_log (
       id UUID PRIMARY KEY, actor_id VARCHAR(128) NOT NULL, memory_id UUID NOT NULL,
       action VARCHAR(64) NOT NULL, outcome_code VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     );`,
    'GENERIC_SOCIAL_A_RELATION_PRECONDITION_FAILED'
  );
});

test('preflight rejects legacy column shape', { concurrency: false }, async () => {
  const shapes = [
    ['legacy_missing', LEGACY_BASE.replace('target_memory_id UUID NOT NULL,', '')],
    ['legacy_null', LEGACY_BASE.replace('target_memory_id UUID NOT NULL', 'target_memory_id UUID')],
    ['legacy_type', LEGACY_BASE.replace('target_memory_id UUID NOT NULL', 'target_memory_id TEXT NOT NULL')],
    ['legacy_def', LEGACY_BASE.replace('target_memory_id UUID NOT NULL', 'target_memory_id UUID NOT NULL DEFAULT gen_random_uuid()')],
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
    ['id_def', `ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID DEFAULT 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'`],
  ];
  for (const [name, alter] of shapes) {
    await rejectWithoutMigration(
      name,
      LEGACY_BASE + `ALTER TABLE public.social_idempotency ${alter};
        ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;`,
      'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'
    );
  }
});

// Data-state fixtures
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
    const pre = runSql(PREFLIGHT);
    expectFail(pre, 'data_partial', 'preflight');
    assertCategory(pre, 'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL_STATE');
    pass('guard reject data_partial');
  });

  await withDisposableDb('data_tree', FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(PREFLIGHT), 'data_tree', 'pre');
    expectOk(runSql(MIG_A), 'data_tree', 'mig');
    await client.query(`ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL`);
    await client.query(`UPDATE public.social_idempotency SET target_kind='tree', target_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'`);
    await client.query(`ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL`);
    const pre = runSql(PREFLIGHT);
    expectFail(pre, 'data_tree', 'preflight');
    assertCategory(pre, 'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH');
    pass('guard reject data_tree');
  });
  
  await withDisposableDb('data_unknown', FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(PREFLIGHT), 'data_unknown', 'pre');
    expectOk(runSql(MIG_A), 'data_unknown', 'mig');
    await client.query(`ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL; ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_kind_check;`);
    await client.query(`UPDATE public.social_idempotency SET target_kind='unknown', target_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'`);
    await client.query(`ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL`);
    const pre = runSql(PREFLIGHT);
    expectFail(pre, 'data_unknown', 'preflight');
    assertCategory(pre, 'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH');
    pass('guard reject data_unknown');
  });

  await withDisposableDb('data_mis', FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(PREFLIGHT), 'data_mis', 'pre');
    expectOk(runSql(MIG_A), 'data_mis', 'mig');
    await client.query(`ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL`);
    await client.query(`UPDATE public.social_idempotency SET target_id='ffffffff-ffff-4fff-8fff-ffffffffffff'`);
    await client.query(`ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL`);
    const pre = runSql(PREFLIGHT);
    expectFail(pre, 'data_mis', 'preflight');
    assertCategory(pre, 'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH');
    pass('guard reject data_mis');
  });
});

test('preflight rejects mixed table states', { concurrency: false }, async () => {
  await rejectWithoutMigration(
    'mixed_audit_partial',
    LEGACY_BASE + `ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16);`,
    'GENERIC_SOCIAL_A_MIXED_STATE_REJECTED'
  );
  await rejectWithoutMigration(
    'mixed_idem_exact_post',
    LEGACY_BASE + `ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;`,
    'GENERIC_SOCIAL_A_MIXED_STATE_REJECTED'
  );
  await rejectWithoutMigration(
    'mixed_audit_wrong_shape',
    LEGACY_BASE + `
      ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind integer, ADD COLUMN target_id UUID;
    `,
    'GENERIC_SOCIAL_A_GENERIC_COLUMN_SHAPE_MISMATCH'
  );
});

// CHECK fixtures
const POST_BASE = LEGACY_BASE + `
  ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
  ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
  CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.target_kind := 'memory'; NEW.target_id := NEW.target_memory_id; RETURN NEW; END;$$;
  CREATE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.target_kind := 'memory'; NEW.target_id := NEW.memory_id; RETURN NEW; END;$$;
  CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();
  CREATE TRIGGER trg_social_audit_log_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_audit_log FOR EACH ROW EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory();
  ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_generic_target_pair_check CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)));
  ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_generic_target_kind_check CHECK (((target_kind IS NULL) OR ((target_kind)::text = ANY ((ARRAY['memory'::character varying, 'tree'::character varying])::text[]))));
  ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)));
  ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_kind_check CHECK (((target_kind IS NULL) OR ((target_kind)::text = ANY ((ARRAY['memory'::character varying, 'tree'::character varying])::text[]))));
`;

test('preflight CHECK fixtures', { concurrency: false }, async () => {
  await rejectWithoutMigration('check_wrong_pair', POST_BASE.replace('CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)))', 'CHECK (target_kind IS NOT NULL)'), 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH');
  await rejectWithoutMigration('check_wrong_vocab', POST_BASE.replace("'tree'", "'something'"), 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH');
  await rejectWithoutMigration('check_not_valid', POST_BASE.replace('CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)))', 'CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL))) NOT VALID'), 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH');
  await rejectWithoutMigration('check_malicious', POST_BASE.replace('CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL)))', 'CHECK (1=1 /* TARGET_KIND IS NULL TARGET_ID IS NULL TARGET_KIND IS NOT NULL TARGET_ID IS NOT NULL */)'), 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH');
  await rejectWithoutMigration('check_wrong_table', POST_BASE.replace('ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check', 'ALTER TABLE public.social_idempotency ADD CONSTRAINT social_audit_log_generic_target_pair_check'), 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH');
  await rejectWithoutMigration('check_duplicate', POST_BASE + `ALTER TABLE public.social_audit_log ADD CONSTRAINT social_audit_log_generic_target_pair_check CHECK (1=1);`, 'GENERIC_SOCIAL_A_CHECK_DEFINITION_MISMATCH');
});

test('preflight Function fixtures', { concurrency: false }, async () => {
  await rejectWithoutMigration('fn_lang_sql', POST_BASE.replace('LANGUAGE plpgsql AS $$BEGIN NEW.target_kind := \\\'memory\\\';', 'LANGUAGE sql AS $$SELECT NULL;'), 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH');
  await rejectWithoutMigration('fn_wrong_body', POST_BASE.replace('NEW.target_kind := \\\'memory\\\'; NEW.target_id := NEW.target_memory_id;', 'NEW.target_kind := \\\'memory\\\';'), 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH');
  await rejectWithoutMigration('fn_early_return', POST_BASE.replace('$$BEGIN NEW.target_kind', '$$BEGIN RETURN NEW; NEW.target_kind'), 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH');
  await rejectWithoutMigration('fn_no_tree_reject', POST_BASE.replace('IF NEW.target_kind = \\\'tree\\\' THEN', '-- IF NEW.target_kind = \\\'tree\\\' THEN'), 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH');
  await rejectWithoutMigration('fn_no_mismatch_reject', POST_BASE.replace('IF NEW.target_kind = \\\'memory\\\' AND', '-- IF NEW.target_kind = \\\'memory\\\' AND'), 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH');
  await rejectWithoutMigration('fn_secdef', POST_BASE.replace('LANGUAGE plpgsql', 'LANGUAGE plpgsql SECURITY DEFINER'), 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH');
  await rejectWithoutMigration('fn_volatility', POST_BASE.replace('LANGUAGE plpgsql', 'LANGUAGE plpgsql STABLE'), 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH');
  await rejectWithoutMigration('fn_parallel', POST_BASE.replace('LANGUAGE plpgsql', 'LANGUAGE plpgsql PARALLEL SAFE'), 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH');
  await rejectWithoutMigration('fn_ret_type', POST_BASE.replace('RETURNS trigger', 'RETURNS void'), 'GENERIC_SOCIAL_A_FUNCTION_DEFINITION_MISMATCH');
});

test('preflight Trigger fixtures', { concurrency: false }, async () => {
  await rejectWithoutMigration('tg_wrong_fn', POST_BASE.replace('EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()', 'EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory()'), 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH');
  await rejectWithoutMigration('tg_after', POST_BASE.replace('BEFORE INSERT OR UPDATE', 'AFTER INSERT OR UPDATE'), 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH');
  await rejectWithoutMigration('tg_before_insert', POST_BASE.replace('BEFORE INSERT OR UPDATE', 'BEFORE INSERT'), 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH');
  await rejectWithoutMigration('tg_before_update', POST_BASE.replace('BEFORE INSERT OR UPDATE', 'BEFORE UPDATE'), 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH');
  await rejectWithoutMigration('tg_statement', POST_BASE.replace('FOR EACH ROW', 'FOR EACH STATEMENT'), 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH');
  await rejectWithoutMigration('tg_disabled', POST_BASE + `ALTER TABLE public.social_idempotency DISABLE TRIGGER trg_social_idempotency_sync_generic_target;`, 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH');
  await rejectWithoutMigration('tg_always', POST_BASE + `ALTER TABLE public.social_idempotency ENABLE ALWAYS TRIGGER trg_social_idempotency_sync_generic_target;`, 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH');
  await rejectWithoutMigration('tg_replica', POST_BASE + `ALTER TABLE public.social_idempotency ENABLE REPLICA TRIGGER trg_social_idempotency_sync_generic_target;`, 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH');
  await rejectWithoutMigration('tg_wrong_rel', POST_BASE.replace('ON public.social_idempotency', 'ON public.social_audit_log'), 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH');
  await rejectWithoutMigration('tg_delete', POST_BASE.replace('BEFORE INSERT OR UPDATE', 'BEFORE INSERT OR UPDATE OR DELETE'), 'GENERIC_SOCIAL_A_TRIGGER_DEFINITION_MISMATCH');
});

// Postcondition adversarial evidence
test('postcondition validator rejects mutated states', { concurrency: false }, async () => {
  await withDisposableDb('post_adv', FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(PREFLIGHT), 'post_adv', 'preflight');
    expectOk(runSql(MIG_A), 'post_adv', 'mig');
    
    // Store valid fingerprint
    const validFp = await catalog.getCatalogFingerprint(client);
    
    const mutations = [
      ['wrong_check', `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_pair_check; ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_generic_target_pair_check CHECK (target_kind IS NOT NULL);`],
      ['unvalidated_check', `ALTER TABLE public.social_idempotency DROP CONSTRAINT social_idempotency_generic_target_pair_check; ALTER TABLE public.social_idempotency ADD CONSTRAINT social_idempotency_generic_target_pair_check CHECK (((target_kind IS NULL) AND (target_id IS NULL)) OR ((target_kind IS NOT NULL) AND (target_id IS NOT NULL))) NOT VALID;`],
      ['wrong_function_body', `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END;$$;`],
      ['sec_def_function', `CREATE OR REPLACE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN NEW.target_kind := 'memory'; NEW.target_id := NEW.target_memory_id; RETURN NEW; END;$$;`],
      ['tg_disabled', `ALTER TABLE public.social_idempotency DISABLE TRIGGER trg_social_idempotency_sync_generic_target;`],
      ['tg_always', `ALTER TABLE public.social_idempotency ENABLE ALWAYS TRIGGER trg_social_idempotency_sync_generic_target;`],
      ['tg_replica', `ALTER TABLE public.social_idempotency ENABLE REPLICA TRIGGER trg_social_idempotency_sync_generic_target;`],
      ['tg_insert_only', `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency; CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();`],
      ['wrong_trigger_function', `DROP TRIGGER trg_social_idempotency_sync_generic_target ON public.social_idempotency; CREATE TRIGGER trg_social_idempotency_sync_generic_target BEFORE INSERT OR UPDATE ON public.social_idempotency FOR EACH ROW EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory();`],
      ['target_kind_default', `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind SET DEFAULT 'memory';`],
      ['target_id_not_null', `ALTER TABLE public.social_idempotency ALTER COLUMN target_id SET NOT NULL;`],
      ['wrong_generic_type', `ALTER TABLE public.social_idempotency ALTER COLUMN target_kind TYPE VARCHAR(32);`],
    ];

    for (const [name, sql] of mutations) {
      await client.query('BEGIN');
      await client.query(sql);
      
      const mutatedFp = await catalog.getCatalogFingerprint(client);
      const post = runSql(POSTCOND);
      expectFail(post, 'post_adv', `postcond_${name}`);
      assertCategory(post, 'GENERIC_SOCIAL_A_POSTCONDITION_FAILED');
      
      const afterFp = await catalog.getCatalogFingerprint(client);
      assert.ok(catalog.fingerprintEqual(mutatedFp, afterFp), `Validator must not mutate state during ${name}`);
      
      await client.query('ROLLBACK');
    }
  });
});

test('suite never executes Migration B', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(__filename, 'utf8');
  assert.ok(fs.existsSync(MIG_B));
  assert.equal(/(?:^|[^=])\s*runSql\s*\(\s*MIG_B\s*\)/m.test(src), false);
  assert.match(src, /runSql\(PREFLIGHT\)/);
  assert.match(src, /runSql\(MIG_A\)/);
  assert.match(src, /runSql\(POSTCOND\)/);
  pass('guard no Migration B');
});
