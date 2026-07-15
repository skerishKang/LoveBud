'use strict';

/**
 * DB_ENGINE_EXECUTION: generic-social Migration A on disposable PostgreSQL 17.4.
 *
 * Executes scripts/migration-add-generic-social-targets.sql via
 * psql -X -v ON_ERROR_STOP=1 -f. Never reads DATABASE_URL / Production secrets.
 *
 * Does not execute Migration B. Does not invent rollback SQL.
 *
 * Refs: #3534, #3262, #3459, #3458, #3425, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const harness = require('./helpers/postgres-disposable-harness.cjs');
const catalog = require('./helpers/generic-social-catalog-assertions.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATION_A = path.join(ROOT, 'scripts/migration-add-generic-social-targets.sql');
const MIGRATION_B = path.join(ROOT, 'scripts/migration-b-generic-social-targets-cutover.sql');
const LEGACY_FIXTURE = path.join(__dirname, 'fixtures/generic-social-a-legacy.sql');

const { withDisposableDb, boundedFail, combinedOutput } = harness;
const {
  TABLES,
  LEGACY_IDEM,
  LEGACY_AUDIT,
  assertLegacySchema,
  assertMigrationACatalog,
  getCatalogFingerprint,
  fingerprintEqual,
  getFullRowFingerprint,
  getColumnNames,
  getBackfillStats,
} = catalog;

// Synthetic deterministic IDs (not Production).
const SYN = {
  mem: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  mem2: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  id1: '11111111-1111-4111-8111-111111111111',
  id2: '22222222-2222-4222-8222-222222222222',
  id3: '33333333-3333-4333-8333-333333333333',
};

function pass(name) {
  process.stdout.write(`${name}: PASS\n`);
}

function failMutation() {
  const err = new Error('EXPECTED_PRESTATE_PRESERVED_ACTUAL_MUTATED');
  err.code = 'EXPECTED_PRESTATE_PRESERVED_ACTUAL_MUTATED';
  throw err;
}

async function assertNoMutation(client, beforeFp) {
  const after = await getCatalogFingerprint(client);
  if (!fingerprintEqual(beforeFp, after)) failMutation();
}

function expectOk(res, scenario, phase) {
  if (res.status !== 0) {
    boundedFail(
      scenario,
      phase,
      classifyError(combinedOutput(res)),
      res.status,
      'exit_0',
      `exit_${res.status}`
    );
  }
}

function expectFail(res, scenario, phase) {
  if (res.status === 0) {
    boundedFail(scenario, phase, 'EXPECTED_NONZERO_EXIT', 0, 'nonzero', '0');
  }
}

function classifyError(out) {
  if (/Prerequisite table/i.test(out)) return 'PRECONDITION_FAILED';
  if (/NULL generic pair|partial generic pair|target_kind other|different from legacy/i.test(out)) {
    return 'POST_BACKFILL_VALIDATION_FAILED';
  }
  if (/already exists|duplicate/i.test(out)) return 'OBJECT_COLLISION';
  if (/syntax error/i.test(out)) return 'MIGRATION_SYNTAX_ERROR';
  return 'MIGRATION_ENGINE_ERROR';
}

// ─── Happy path ──────────────────────────────────────────────────────────────

test('generic-social-a happy path apply backfill catalog and second apply', { concurrency: false }, async () => {
  await withDisposableDb('happy', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await assertLegacySchema(client);
    const beforeColsIdem = await getColumnNames(client, TABLES.idem);
    const beforeColsAudit = await getColumnNames(client, TABLES.audit);
    const beforeIdem = await getFullRowFingerprint(client, 'idem');
    const beforeAudit = await getFullRowFingerprint(client, 'audit');
    const beforeUnrel = await getFullRowFingerprint(client, 'unrelated');
    pass('generic-social-a legacy preflight');

    const apply1 = runSql(MIGRATION_A);
    expectOk(apply1, 'happy', 'migration_apply');
    pass('generic-social-a apply');

    await assertMigrationACatalog(client);

    // Base-column full-row projection preserved.
    const afterIdemBase = await getFullRowFingerprint(client, 'idem', { columns: beforeColsIdem });
    const afterAuditBase = await getFullRowFingerprint(client, 'audit', { columns: beforeColsAudit });
    assert.equal(afterIdemBase.count, beforeIdem.count);
    assert.equal(afterIdemBase.rowFp, beforeIdem.rowFp);
    assert.equal(afterAuditBase.count, beforeAudit.count);
    assert.equal(afterAuditBase.rowFp, beforeAudit.rowFp);
    assert.deepEqual(await getFullRowFingerprint(client, 'unrelated'), beforeUnrel);

    const stI = await getBackfillStats(client, TABLES.idem, LEGACY_IDEM);
    const stA = await getBackfillStats(client, TABLES.audit, LEGACY_AUDIT);
    assert.equal(stI.memory_matched, stI.total);
    assert.equal(stA.memory_matched, stA.total);
    assert.equal(stI.null_pair, 0);
    assert.equal(stA.null_pair, 0);
    pass('generic-social-a backfill+catalog');

    const repairedFp = await getCatalogFingerprint(client);
    const apply2 = runSql(MIGRATION_A);
    expectOk(apply2, 'happy', 'second_apply');
    await assertNoMutation(client, repairedFp);
    pass('generic-social-a second apply no-op');
  });
});

// ─── Trigger compatibility (real statements) ─────────────────────────────────

test('generic-social-a trigger compatibility statements', { concurrency: false }, async () => {
  await withDisposableDb('triggers', LEGACY_FIXTURE, async ({ client, runSql }) => {
    expectOk(runSql(MIGRATION_A), 'triggers', 'apply');

    // 1) Legacy-only INSERT → trigger fills memory pair
    await client.query(
      `INSERT INTO public.social_idempotency (
         id, actor_id, operation, idempotency_key, request_fingerprint, target_memory_id
       ) VALUES ($1, 'syn_actor_t', 'comment.create', 'syn_key_leg', 'syn_fp_leg', $2)`,
      [SYN.id1, SYN.mem]
    );
    const r1 = await client.query(
      `SELECT target_kind, target_id FROM public.social_idempotency WHERE id = $1`,
      [SYN.id1]
    );
    assert.equal(r1.rows[0].target_kind, 'memory');
    assert.equal(r1.rows[0].target_id, SYN.mem);
    pass('generic-social-a legacy-only insert');

    // 2) Complete matching memory pair
    await client.query(
      `INSERT INTO public.social_audit_log (
         id, actor_id, memory_id, action, outcome_code, target_kind, target_id
       ) VALUES ($1, 'syn_actor_t', $2, 'comment.create', 'success', 'memory', $2)`,
      [SYN.id2, SYN.mem]
    );
    pass('generic-social-a matching memory pair');

    // 3) Partial generic pair → fail, no row
    let failed = false;
    try {
      await client.query(
        `INSERT INTO public.social_idempotency (
           id, actor_id, operation, idempotency_key, request_fingerprint,
           target_memory_id, target_kind
         ) VALUES ($1, 'syn_actor_t', 'comment.create', 'syn_key_part', 'syn_fp_part', $2, 'memory')`,
        [SYN.id3, SYN.mem]
      );
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
    const c3 = await client.query(
      `SELECT count(*)::int AS n FROM public.social_idempotency WHERE id = $1`,
      [SYN.id3]
    );
    assert.equal(c3.rows[0].n, 0);
    pass('generic-social-a partial pair reject');

    // 4) tree kind rejected in Migration A
    failed = false;
    const treeId = '44444444-4444-4444-8444-444444444444';
    try {
      await client.query(
        `INSERT INTO public.social_idempotency (
           id, actor_id, operation, idempotency_key, request_fingerprint,
           target_memory_id, target_kind, target_id
         ) VALUES ($1, 'syn_actor_t', 'comment.create', 'syn_key_tree', 'syn_fp_tree', $2, 'tree', $3)`,
        [treeId, SYN.mem, SYN.mem2]
      );
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
    pass('generic-social-a tree kind reject');

    // 5) unknown kind
    failed = false;
    const unkId = '55555555-5555-4555-8555-555555555555';
    try {
      await client.query(
        `INSERT INTO public.social_audit_log (
           id, actor_id, memory_id, action, outcome_code, target_kind, target_id
         ) VALUES ($1, 'syn_actor_t', $2, 'comment.create', 'success', 'unknown', $2)`,
        [unkId, SYN.mem]
      );
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
    pass('generic-social-a unknown kind reject');

    // 6) memory mismatch
    failed = false;
    const misId = '66666666-6666-4666-8666-666666666666';
    try {
      await client.query(
        `INSERT INTO public.social_idempotency (
           id, actor_id, operation, idempotency_key, request_fingerprint,
           target_memory_id, target_kind, target_id
         ) VALUES ($1, 'syn_actor_t', 'comment.create', 'syn_key_mis', 'syn_fp_mis', $2, 'memory', $3)`,
        [misId, SYN.mem, SYN.mem2]
      );
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
    pass('generic-social-a memory mismatch reject');

    // 7) UPDATE mismatch rollback — original fingerprint preserved
    const beforeUpd = await getFullRowFingerprint(client, 'idem', {
      columns: await getColumnNames(client, TABLES.idem),
    });
    failed = false;
    try {
      await client.query(
        `UPDATE public.social_idempotency
         SET target_id = $1
         WHERE id = $2`,
        [SYN.mem2, SYN.id1]
      );
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
    const afterUpd = await getFullRowFingerprint(client, 'idem', {
      columns: await getColumnNames(client, TABLES.idem),
    });
    assert.equal(afterUpd.rowFp, beforeUpd.rowFp);
    pass('generic-social-a update mismatch preserve');
  });
});

// ─── Fail-closed: missing / non-ordinary ─────────────────────────────────────

test('generic-social-a missing tables fail closed', { concurrency: false }, async () => {
  await withDisposableDb('miss_idem', null, async ({ client, runSql }) => {
    await client.query(`
      CREATE TABLE public.social_audit_log (
        id UUID PRIMARY KEY,
        actor_id VARCHAR(128) NOT NULL,
        memory_id UUID NOT NULL,
        action VARCHAR(64) NOT NULL,
        outcome_code VARCHAR(20) NOT NULL,
        request_key_hash VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
      INSERT INTO public.lb_unrelated_marker VALUES ('u1', 'keep');
    `);
    const before = await getCatalogFingerprint(client);
    const res = runSql(MIGRATION_A);
    expectFail(res, 'miss_idem', 'migration');
    await assertNoMutation(client, before);
    pass('generic-social-a missing idempotency table');
  });

  await withDisposableDb('miss_audit', null, async ({ client, runSql }) => {
    await client.query(`
      CREATE TABLE public.social_idempotency (
        id UUID PRIMARY KEY,
        actor_id VARCHAR(128) NOT NULL,
        operation VARCHAR(64) NOT NULL,
        idempotency_key VARCHAR(128) NOT NULL,
        request_fingerprint VARCHAR(64) NOT NULL,
        target_memory_id UUID NOT NULL,
        result_id VARCHAR(128),
        result_state VARCHAR(20) NOT NULL DEFAULT 'pending',
        result_payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
      INSERT INTO public.lb_unrelated_marker VALUES ('u1', 'keep');
    `);
    const before = await getCatalogFingerprint(client);
    const res = runSql(MIGRATION_A);
    expectFail(res, 'miss_audit', 'migration');
    await assertNoMutation(client, before);
    pass('generic-social-a missing audit table');
  });
});

test('generic-social-a non-ordinary relation fail closed', { concurrency: false }, async () => {
  await withDisposableDb('view_idem', null, async ({ client, runSql }) => {
    await client.query(`
      CREATE TABLE public.social_audit_log (
        id UUID PRIMARY KEY,
        actor_id VARCHAR(128) NOT NULL,
        memory_id UUID NOT NULL,
        action VARCHAR(64) NOT NULL,
        outcome_code VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE VIEW public.social_idempotency AS
        SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid AS id;
      CREATE TABLE public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
      INSERT INTO public.lb_unrelated_marker VALUES ('u1', 'keep');
    `);
    const before = await getCatalogFingerprint(client);
    const res = runSql(MIGRATION_A);
    // to_regclass finds views; ALTER TABLE on view fails → nonzero
    expectFail(res, 'view_idem', 'migration');
    await assertNoMutation(client, before);
    pass('generic-social-a view relation fail');
  });
});

// ─── Fail-closed: legacy schema mismatch ─────────────────────────────────────

test('generic-social-a legacy target missing fail closed', { concurrency: false }, async () => {
  await withDisposableDb('no_legacy_col', null, async ({ client, runSql }) => {
    await client.query(`
      CREATE TABLE public.social_idempotency (
        id UUID PRIMARY KEY,
        actor_id VARCHAR(128) NOT NULL,
        operation VARCHAR(64) NOT NULL,
        idempotency_key VARCHAR(128) NOT NULL,
        request_fingerprint VARCHAR(64) NOT NULL,
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
      CREATE TABLE public.lb_unrelated_marker (id text PRIMARY KEY, v text NOT NULL);
      INSERT INTO public.lb_unrelated_marker VALUES ('u1', 'keep');
    `);
    const before = await getCatalogFingerprint(client);
    const res = runSql(MIGRATION_A);
    expectFail(res, 'no_legacy_col', 'migration');
    await assertNoMutation(client, before);
    pass('generic-social-a legacy column missing');
  });
});

// ─── Fail-closed: pre-existing bad generic data ──────────────────────────────

test('generic-social-a pre-existing partial pair fail closed', { concurrency: false }, async () => {
  await withDisposableDb('partial_data', LEGACY_FIXTURE, async ({ client, runSql }) => {
    // Pre-add columns and create partial pair without running Migration A CHECKs yet.
    await client.query(`
      ALTER TABLE public.social_idempotency
        ADD COLUMN target_kind VARCHAR(16),
        ADD COLUMN target_id UUID;
      UPDATE public.social_idempotency
         SET target_kind = 'memory', target_id = NULL;
    `);
    const before = await getCatalogFingerprint(client);
    const res = runSql(MIGRATION_A);
    // Backfill only fills where BOTH null; partial remains → post-validation fails
    expectFail(res, 'partial_data', 'migration');
    await assertNoMutation(client, before);
    pass('generic-social-a partial data fail');
  });
});

test('generic-social-a pre-existing tree pair fail closed', { concurrency: false }, async () => {
  await withDisposableDb('tree_data', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await client.query(`
      ALTER TABLE public.social_idempotency
        ADD COLUMN target_kind VARCHAR(16),
        ADD COLUMN target_id UUID;
      UPDATE public.social_idempotency
         SET target_kind = 'tree',
             target_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    `);
    const before = await getCatalogFingerprint(client);
    const res = runSql(MIGRATION_A);
    expectFail(res, 'tree_data', 'migration');
    await assertNoMutation(client, before);
    pass('generic-social-a tree data fail');
  });
});

test('generic-social-a pre-existing memory mismatch fail closed', { concurrency: false }, async () => {
  await withDisposableDb('mis_data', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await client.query(`
      ALTER TABLE public.social_idempotency
        ADD COLUMN target_kind VARCHAR(16),
        ADD COLUMN target_id UUID;
      UPDATE public.social_idempotency
         SET target_kind = 'memory',
             target_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    `);
    const before = await getCatalogFingerprint(client);
    const res = runSql(MIGRATION_A);
    expectFail(res, 'mis_data', 'migration');
    await assertNoMutation(client, before);
    pass('generic-social-a mismatch data fail');
  });
});

// ─── Fail-closed: wrong pre-existing generic schema ──────────────────────────

test('generic-social-a wrong target_kind type fail closed', { concurrency: false }, async () => {
  await withDisposableDb('bad_kind_type', LEGACY_FIXTURE, async ({ client, runSql }) => {
    await client.query(`
      ALTER TABLE public.social_idempotency ADD COLUMN target_kind integer;
      ALTER TABLE public.social_idempotency ADD COLUMN target_id UUID;
    `);
    const before = await getCatalogFingerprint(client);
    const res = runSql(MIGRATION_A);
    // ADD IF NOT EXISTS skips; backfill SET target_kind='memory' may fail type or validation
    expectFail(res, 'bad_kind_type', 'migration');
    await assertNoMutation(client, before);
    pass('generic-social-a wrong kind type');
  });
});

// ─── Mixed transactional: one table OK shape, other unsupported ──────────────

test('generic-social-a mixed table unsupported preserves pre-state', { concurrency: false }, async () => {
  await withDisposableDb('mixed_tables', LEGACY_FIXTURE, async ({ client, runSql }) => {
    // Corrupt audit only: wrong type generic column pre-present.
    await client.query(`
      ALTER TABLE public.social_audit_log ADD COLUMN target_kind boolean;
      ALTER TABLE public.social_audit_log ADD COLUMN target_id UUID;
    `);
    const before = await getCatalogFingerprint(client);
    const res = runSql(MIGRATION_A);
    expectFail(res, 'mixed_tables', 'migration');
    // Transaction rollback → idempotency also unchanged (no persistent ADD).
    await assertNoMutation(client, before);
    const names = await getColumnNames(client, TABLES.idem);
    assert.equal(names.includes('target_kind'), false);
    pass('generic-social-a mixed transactional preserve');
  });
});

// ─── Migration B must not be invoked by this suite ───────────────────────────

test('generic-social-a suite never executes Migration B path', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(__filename, 'utf8');
  assert.equal(src.includes('migration-b-generic-social-targets-cutover.sql'), true); // constant only
  // Ensure runSql is never called with MIGRATION_B
  assert.equal(/runSql\s*\(\s*MIGRATION_B\s*\)/.test(src), false);
  assert.ok(require('node:fs').existsSync(MIGRATION_B));
  pass('generic-social-a no Migration B execution');
});
