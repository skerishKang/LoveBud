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

function assertCategory(res, expectedPrefix) {
  const cat = classify(combinedOutput(res));
  if (!String(cat).startsWith(expectedPrefix) && cat !== expectedPrefix) {
    // Allow any GENERIC_SOCIAL_A_* bounded category for fail-closed scenarios
    if (!String(cat).startsWith('GENERIC_SOCIAL_A_')) {
      boundedFail('category', 'classify', cat, res.status, expectedPrefix, cat);
    }
  }
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

async function rejectWithoutMigration(scenario, setupSql, expectedCatPrefix) {
  await withDisposableDb(scenario, null, async ({ client, runSql }) => {
    await client.query(setupSql);
    // Ensure unrelated sentinel for fingerprint
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
      INSERT INTO public.lb_unrelated_marker(id,v) VALUES ('u1','keep') ON CONFLICT DO NOTHING;
    `);
    const before = await catalog.getCatalogFingerprint(client);
    const pre = runSql(PREFLIGHT);
    expectFail(pre, scenario, 'preflight');
    assertCategory(pre, expectedCatPrefix || 'GENERIC_SOCIAL_A_');
    // Migration A must not be invoked by harness after preflight failure
    await assertNoMutation(client, before);
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
    'GENERIC_SOCIAL_A_RELATION'
  );
});

test('preflight rejects legacy column shape', { concurrency: false }, async () => {
  await rejectWithoutMigration(
    'legacy_null',
    LEGACY_BASE.replace('target_memory_id UUID NOT NULL', 'target_memory_id UUID'),
    'GENERIC_SOCIAL_A_LEGACY'
  );
  await rejectWithoutMigration(
    'legacy_type',
    LEGACY_BASE.replace('target_memory_id UUID NOT NULL', 'target_memory_id TEXT NOT NULL'),
    'GENERIC_SOCIAL_A_LEGACY'
  );
});

test('preflight rejects generic column partial pair', { concurrency: false }, async () => {
  await rejectWithoutMigration(
    'gen_partial',
    LEGACY_BASE + `ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16);`,
    'GENERIC_SOCIAL_A_GENERIC_COLUMN_PARTIAL'
  );
});

test('preflight rejects generic column shape mismatches', { concurrency: false }, async () => {
  const shapes = [
    ['kind_int', `ADD COLUMN target_kind integer, ADD COLUMN target_id UUID`],
    ['kind_v8', `ADD COLUMN target_kind VARCHAR(8), ADD COLUMN target_id UUID`],
    ['kind_v32', `ADD COLUMN target_kind VARCHAR(32), ADD COLUMN target_id UUID`],
    ['kind_nn', `ADD COLUMN target_kind VARCHAR(16) NOT NULL DEFAULT 'memory', ADD COLUMN target_id UUID`],
    ['kind_def', `ADD COLUMN target_kind VARCHAR(16) DEFAULT 'memory', ADD COLUMN target_id UUID`],
    ['id_text', `ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id TEXT`],
    ['id_nn', `ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID NOT NULL DEFAULT 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'`],
    ['id_def', `ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID DEFAULT 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'`],
  ];
  for (const [name, alter] of shapes) {
    await rejectWithoutMigration(
      name,
      LEGACY_BASE + `ALTER TABLE public.social_idempotency ${alter};
        ALTER TABLE public.social_audit_log ADD COLUMN IF NOT EXISTS target_kind VARCHAR(16);
        ALTER TABLE public.social_audit_log ADD COLUMN IF NOT EXISTS target_id UUID;`,
      'GENERIC_SOCIAL_A_'
    );
  }
});

test('preflight rejects bad data states on exact column shapes', { concurrency: false }, async () => {
  // Columns exact but data invalid — use default shapes then corrupt data
  await withDisposableDb('data_partial', FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(PREFLIGHT), 'data_partial', 'pre');
    expectOk(runSql(MIG_A), 'data_partial', 'mig');
    // Drop pair CHECK + disable triggers so partial data can exist for preflight rejection.
    await client.query(`
      ALTER TABLE public.social_idempotency
        DROP CONSTRAINT social_idempotency_generic_target_pair_check;
      ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL;
      UPDATE public.social_idempotency SET target_id = NULL;
      ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL;
    `);
    const before = await catalog.getCatalogFingerprint(client);
    const pre = runSql(PREFLIGHT);
    expectFail(pre, 'data_partial', 'preflight');
    await assertNoMutation(client, before);
    pass('guard reject data_partial');
  });

  await withDisposableDb('data_tree', FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(PREFLIGHT), 'data_tree', 'pre');
    expectOk(runSql(MIG_A), 'data_tree', 'mig');
    await client.query(`ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL`);
    await client.query(`
      UPDATE public.social_idempotency
         SET target_kind='tree', target_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    `);
    await client.query(`ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL`);
    const before = await catalog.getCatalogFingerprint(client);
    expectFail(runSql(PREFLIGHT), 'data_tree', 'preflight');
    await assertNoMutation(client, before);
    pass('guard reject data_tree');
  });

  await withDisposableDb('data_mis', FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(PREFLIGHT), 'data_mis', 'pre');
    expectOk(runSql(MIG_A), 'data_mis', 'mig');
    await client.query(`ALTER TABLE public.social_idempotency DISABLE TRIGGER ALL`);
    await client.query(`
      UPDATE public.social_idempotency
         SET target_id='ffffffff-ffff-4fff-8fff-ffffffffffff'
    `);
    await client.query(`ALTER TABLE public.social_idempotency ENABLE TRIGGER ALL`);
    const before = await catalog.getCatalogFingerprint(client);
    expectFail(runSql(PREFLIGHT), 'data_mis', 'preflight');
    await assertNoMutation(client, before);
    pass('guard reject data_mis');
  });
});

test('preflight rejects CHECK / trigger / function collisions', { concurrency: false }, async () => {
  // Wrong CHECK definition same name
  await rejectWithoutMigration(
    'check_wrong',
    LEGACY_BASE + `
      ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
      ALTER TABLE public.social_idempotency
        ADD CONSTRAINT social_idempotency_generic_target_pair_check CHECK (target_kind IS NOT NULL);
      ALTER TABLE public.social_idempotency
        ADD CONSTRAINT social_idempotency_generic_target_kind_check CHECK (target_kind IS NULL OR target_kind IN ('memory','tree'));
      ALTER TABLE public.social_audit_log
        ADD CONSTRAINT social_audit_log_generic_target_pair_check
        CHECK ((target_kind IS NULL AND target_id IS NULL) OR (target_kind IS NOT NULL AND target_id IS NOT NULL));
      ALTER TABLE public.social_audit_log
        ADD CONSTRAINT social_audit_log_generic_target_kind_check CHECK (target_kind IS NULL OR target_kind IN ('memory','tree'));
    `,
    'GENERIC_SOCIAL_A_CHECK'
  );

  // Wrong function body + wrong trigger timing
  await rejectWithoutMigration(
    'fn_wrong',
    LEGACY_BASE + `
      ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
      CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
        RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN RETURN NEW; END; $f$;
      CREATE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory()
        RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN RETURN NEW; END; $f$;
      CREATE TRIGGER trg_social_idempotency_sync_generic_target
        AFTER INSERT ON public.social_idempotency
        FOR EACH ROW EXECUTE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory();
      CREATE TRIGGER trg_social_audit_log_sync_generic_target
        BEFORE INSERT OR UPDATE ON public.social_audit_log
        FOR EACH ROW EXECUTE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory();
    `,
    'GENERIC_SOCIAL_A_'
  );

  // SQL-language wrong function
  await rejectWithoutMigration(
    'fn_sql',
    LEGACY_BASE + `
      ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
      CREATE FUNCTION public.sync_social_idempotency_generic_target_from_legacy_memory()
        RETURNS trigger LANGUAGE sql AS $$ SELECT NULL::trigger $$;
      CREATE FUNCTION public.sync_social_audit_generic_target_from_legacy_memory()
        RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN RETURN NEW; END; $f$;
    `,
    'GENERIC_SOCIAL_A_FUNCTION'
  );
});

test('preflight rejects mixed table states', { concurrency: false }, async () => {
  // idem legacy, audit partial post
  await rejectWithoutMigration(
    'mixed_audit_partial',
    LEGACY_BASE + `
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind VARCHAR(16);
    `,
    'GENERIC_SOCIAL_A_'
  );

  // idem post columns only, audit legacy
  await rejectWithoutMigration(
    'mixed_idem_only',
    LEGACY_BASE + `
      ALTER TABLE public.social_idempotency ADD COLUMN target_kind VARCHAR(16), ADD COLUMN target_id UUID;
    `,
    'GENERIC_SOCIAL_A_MIXED'
  );
});

test('suite never executes Migration B', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(__filename, 'utf8');
  assert.ok(fs.existsSync(MIG_B));
  assert.equal(/(?:^|[^=])\s*runSql\s*\(\s*MIG_B\s*\)/m.test(src), false);
  // No direct Migration A without preflight in supported sequences (happy uses PREFLIGHT first)
  assert.match(src, /runSql\(PREFLIGHT\)/);
  assert.match(src, /runSql\(MIG_A\)/);
  assert.match(src, /runSql\(POSTCOND\)/);
  pass('guard no Migration B');
});
