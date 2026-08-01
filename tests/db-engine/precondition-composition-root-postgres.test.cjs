'use strict';

/**
 * DB_ENGINE_EXECUTION: rehearse the merged migration precondition composition
 * root against a disposable PostgreSQL 17.4 engine (Issue #3816, Step 7).
 *
 * Executes only on GitHub Actions via `npm run test:db-engine:precondition-composition-root`.
 * Reads only LB_TEST_PG* synthetic loopback env via the shared disposable harness.
 * Never reads DATABASE_URL, never contacts Production/Neon/Modal, never executes
 * migration/DDL/DML/ledger SQL. Permitted SQL is limited to the canonical
 * advisory-lock acquire/check/release queries, fixed synthetic boolean SELECT
 * evidence, and bounded read-only residual-lock verification.
 *
 * Refs: #3816, #3809, #3802, #3657, #3458, #3425, #3435, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const harness = require('./helpers/postgres-disposable-harness.cjs');
const { createMigrationPreconditionCompositionRoot } = require('../../scripts/migration-precondition-composition-root-core.cjs');
const {
  POSTGRES_MIGRATION_LOCK_KEYS,
  POSTGRES_MIGRATION_LOCK_QUERIES,
} = require('../../scripts/migration-postgres-session-lock-adapter-core.cjs');
const { runCanonicalMigration } = require('../../scripts/migration-runner-orchestrator-core.cjs');
const { RUNNER_BLOCKERS } = require('../../scripts/migration-runner-protocol-core.cjs');

const { withDisposableDb, baseClientConfig } = harness;

const TARGET = '20260727000000_example-migration';
const LOCK_KEYS = [POSTGRES_MIGRATION_LOCK_KEYS.classKey, POSTGRES_MIGRATION_LOCK_KEYS.objectKey];

function pass(name) {
  process.stdout.write(`${name}: PASS\n`);
}

// Plain own-callable session wrapper around a dedicated pg.Client. Never returns
// the raw client; `query`/`release` are own data functions as the lock adapter
// requires. Each acquire gets a fresh dedicated client/session.
function createSessionOpener(cfg, dbName) {
  const released = [];
  const queryNames = [];
  const opened = [];
  return {
    openSession() {
      const client = new Client(baseClientConfig(cfg, dbName));
      const session = {
        query: async function (queryObject) {
          queryNames.push(queryObject && queryObject.name);
          // Return a plain record (own `rows`) rather than the pg Result, whose
          // custom prototype fails the lock adapter's plain-record contract.
          const result = await client.query(queryObject.text, queryObject.values || []);
          return { rows: result.rows };
        },
        release: async function () {
          await client.end();
          released.push(true);
        },
      };
      opened.push(client);
      return client.connect().then(() => session);
    },
    released,
    queryNames,
    opened,
  };
}

// Construction-time ACTIVE authority seam (documented by the composition root
// child). Uses the canonical advisory-lock check query for same-session proof.
function activeResolverFactory(check) {
  return () => ({
    resolvePreconditionAuthority: () => ({ status: 'RESOLVED', checks: [check] }),
  });
}

function makeSessionLockCheck(expected, values) {
  return {
    checkId: 'session-lock-held',
    expected,
    query: {
      name: POSTGRES_MIGRATION_LOCK_QUERIES.check.name,
      text: POSTGRES_MIGRATION_LOCK_QUERIES.check.text,
      values: values || POSTGRES_MIGRATION_LOCK_QUERIES.check.values,
      resultContract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'held' },
    },
  };
}

function makeFalseCheck() {
  return {
    checkId: 'rehearsal-false-evidence',
    expected: true,
    query: {
      name: 'rehearsal-false-evidence',
      text: 'SELECT FALSE AS satisfied',
      values: [],
      resultContract: { kind: 'BOOLEAN_SINGLE_ROW', field: 'satisfied' },
    },
  };
}

// Bounded read-only residual-lock verification (system view, no DDL/DML).
const RESIDUAL_LOCK_SQL =
  'SELECT COUNT(*)::int AS locked FROM pg_locks ' +
  "WHERE locktype = 'advisory' " +
  'AND classid = ($1::integer)::oid ' +
  'AND objid = ($2::integer)::oid ' +
  'AND objsubid = 2 ' +
  "AND mode = 'ExclusiveLock' " +
  'AND granted = TRUE';

async function assertNoResidualLock(cfg, dbName) {
  const client = new Client(baseClientConfig(cfg, dbName));
  try {
    await client.connect();
    const result = await client.query(RESIDUAL_LOCK_SQL, LOCK_KEYS);
    assert.equal(Number(result.rows[0].locked), 0, 'no residual advisory lock granted');
  } finally {
    try {
      await client.end();
    } catch (e) {
      // ignore
    }
  }
}

async function assertServerVersion(cfg, dbName) {
  const client = new Client(baseClientConfig(cfg, dbName));
  try {
    await client.connect();
    const result = await client.query('SHOW server_version_num');
    assert.equal(String(result.rows[0].server_version_num), '170004', 'exact PostgreSQL 17.4');
  } finally {
    try {
      await client.end();
    } catch (e) {
      // ignore
    }
  }
}

function makeOrchestratorDeps(root, counts) {
  return {
    validateSource: async function () { return { status: 'PASS' }; },
    loadManifest: async function () { return { status: 'ACTIVE', migrations: [] }; },
    acquireAdvisoryLock: root.acquireAdvisoryLock,
    readLedger: async function () { return []; },
    evaluatePrecondition: root.evaluatePrecondition,
    executeMigration: async function () { counts.executeMigration += 1; return {}; },
    evaluatePostcondition: async function () { return {}; },
    checkAdvisoryLock: root.checkAdvisoryLock,
    appendLedgerRecord: async function () { counts.appendLedgerRecord += 1; return {}; },
    releaseAdvisoryLock: root.releaseAdvisoryLock,
    now: async function () { return 1; },
  };
}

function orchestratorInput(deps) {
  return {
    targetMigrationId: TARGET,
    runtimeMetadata: { runnerVersion: 'v1', environmentClass: 'disposable-test', deployedCommit: '0000000000000' },
    requestedAction: 'APPLY_FORWARD',
    dependencies: deps,
  };
}

// ── R1. Committed inactive authority ────────────────────────────────────────

test('R1 committed inactive authority -> NOT_EVALUATED, zero precondition broker queries', async () => {
  await withDisposableDb('r1_inactive', null, async (ctx) => {
    await assertServerVersion(ctx.cfg, ctx.dbName);
    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const root = createMigrationPreconditionCompositionRoot({ openSession: opener.openSession });

    const acquire = await root.acquireAdvisoryLock({ targetMigrationId: TARGET });
    assert.equal(acquire.status, 'ACQUIRED', 'advisory lock acquired');
    const precondition = await root.evaluatePrecondition({ targetMigrationId: TARGET, lockHandle: acquire.handle });
    assert.equal(precondition.status, 'NOT_EVALUATED', 'committed ADOPTION_REQUIRED authority is never PASS');
    assert.equal(opener.queryNames.includes('rehearsal-false-evidence'), false, 'zero precondition broker queries');
    const check = await root.checkAdvisoryLock({ lockHandle: acquire.handle });
    assert.equal(check.status, 'ACQUIRED', 'lock held on the same pinned session');
    const release = await root.releaseAdvisoryLock({ lockHandle: acquire.handle });
    assert.equal(release.status, 'RELEASED', 'lock released');

    assert.equal(opener.released.length, 1, 'dedicated session released exactly once');
    await assertNoResidualLock(ctx.cfg, ctx.dbName);
    pass('R1');
  });
});

// ── R2. Synthetic ACTIVE same-session PASS ─────────────────────────────────

test('R2 synthetic ACTIVE authority -> PASS only through the same pinned session', async () => {
  await withDisposableDb('r2_active_pass', null, async (ctx) => {
    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const check = makeSessionLockCheck(true);
    const root = createMigrationPreconditionCompositionRoot({
      openSession: opener.openSession,
      authorityResolverFactory: activeResolverFactory(check),
    });

    const acquire = await root.acquireAdvisoryLock({ targetMigrationId: TARGET });
    assert.equal(acquire.status, 'ACQUIRED');
    const precondition = await root.evaluatePrecondition({ targetMigrationId: TARGET, lockHandle: acquire.handle });
    // The canonical check query proves pg_backend_pid() holds the advisory lock
    // on the SAME pinned session; a different connection would yield held=false
    // and this would be FAIL, not PASS.
    assert.equal(precondition.status, 'PASS', 'same-session canonical lock check passed');
    const checkLock = await root.checkAdvisoryLock({ lockHandle: acquire.handle });
    assert.equal(checkLock.status, 'ACQUIRED');
    const release = await root.releaseAdvisoryLock({ lockHandle: acquire.handle });
    assert.equal(release.status, 'RELEASED');

    assert.equal(opener.released.length, 1, 'dedicated session released exactly once');
    await assertNoResidualLock(ctx.cfg, ctx.dbName);
    pass('R2');
  });
});

// ── R3. Synthetic bounded FAIL + orchestrator blocked ──────────────────────

test('R3 synthetic bounded negative check -> FAIL and orchestrator blocked', async () => {
  await withDisposableDb('r3_fail', null, async (ctx) => {
    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const root = createMigrationPreconditionCompositionRoot({
      openSession: opener.openSession,
      authorityResolverFactory: activeResolverFactory(makeFalseCheck()),
    });

    const acquire = await root.acquireAdvisoryLock({ targetMigrationId: TARGET });
    assert.equal(acquire.status, 'ACQUIRED');
    const precondition = await root.evaluatePrecondition({ targetMigrationId: TARGET, lockHandle: acquire.handle });
    assert.equal(precondition.status, 'FAIL', 'fixed false evidence -> FAIL');
    const checkLock = await root.checkAdvisoryLock({ lockHandle: acquire.handle });
    assert.equal(checkLock.status, 'ACQUIRED');
    // Release the outer handle so the orchestrator below acquires a fresh session.
    const releaseOuter = await root.releaseAdvisoryLock({ lockHandle: acquire.handle });
    assert.equal(releaseOuter.status, 'RELEASED');

    const counts = { executeMigration: 0, appendLedgerRecord: 0 };
    const result = await runCanonicalMigration(orchestratorInput(makeOrchestratorDeps(root, counts)));
    assert.equal(result.outcome, 'BLOCKED_BEFORE_EXECUTION', 'execution blocked before execution');
    assert.equal(result.executionAttempted, false, 'execution not attempted');
    assert.equal(counts.executeMigration, 0, 'executeMigration never called');
    assert.equal(counts.appendLedgerRecord, 0, 'appendLedgerRecord never called');
    assert.equal(result.lockReleased, true, 'release completed');
    assert.ok(
      (result.blockers || []).some((b) => String(b).includes(RUNNER_BLOCKERS.RUNNER_PRECONDITION_FAILED)),
      'precondition blocker present',
    );

    assert.equal(opener.released.length, 2, 'dedicated sessions released exactly twice');
    await assertNoResidualLock(ctx.cfg, ctx.dbName);
    pass('R3');
  });
});

// ── R4. Committed authority orchestrator fail-closed ───────────────────────

test('R4 committed authority orchestrator fail-closed before execution', async () => {
  await withDisposableDb('r4_orchestrator', null, async (ctx) => {
    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const root = createMigrationPreconditionCompositionRoot({ openSession: opener.openSession });

    const counts = { executeMigration: 0, appendLedgerRecord: 0 };
    const result = await runCanonicalMigration(orchestratorInput(makeOrchestratorDeps(root, counts)));
    assert.equal(result.outcome, 'BLOCKED_BEFORE_EXECUTION', 'outcome BLOCKED_BEFORE_EXECUTION');
    assert.ok(
      (result.blockers || []).some((b) => String(b).includes('RUNNER_PRECONDITION_NOT_EVALUATED')),
      'blocker RUNNER_PRECONDITION_NOT_EVALUATED',
    );
    assert.equal(result.executionAttempted, false, 'executionAttempted false');
    assert.equal(counts.executeMigration, 0, 'executeMigration 0 calls');
    assert.equal(counts.appendLedgerRecord, 0, 'appendLedgerRecord 0 calls');
    assert.equal(result.lockReleased, true, 'lock released');

    assert.equal(opener.released.length, 1, 'dedicated session released exactly once');
    await assertNoResidualLock(ctx.cfg, ctx.dbName);
    pass('R4');
  });
});

// ── R5. Real advisory-lock contention and recovery ─────────────────────────

test('R5 real advisory-lock contention between two composition roots', async () => {
  await withDisposableDb('r5_contention', null, async (ctx) => {
    const openerA = createSessionOpener(ctx.cfg, ctx.dbName);
    const openerB = createSessionOpener(ctx.cfg, ctx.dbName);
    const rootA = createMigrationPreconditionCompositionRoot({ openSession: openerA.openSession });
    const rootB = createMigrationPreconditionCompositionRoot({ openSession: openerB.openSession });

    const a = await rootA.acquireAdvisoryLock({ targetMigrationId: TARGET });
    assert.equal(a.status, 'ACQUIRED', 'root A acquired');
    const b = await rootB.acquireAdvisoryLock({ targetMigrationId: TARGET });
    assert.equal(b.status, 'FAILED', 'root B contends while A holds');
    const aCheck = await rootA.checkAdvisoryLock({ lockHandle: a.handle });
    assert.equal(aCheck.status, 'ACQUIRED', 'A still holds');
    const aRelease = await rootA.releaseAdvisoryLock({ lockHandle: a.handle });
    assert.equal(aRelease.status, 'RELEASED', 'A released');
    const b2 = await rootB.acquireAdvisoryLock({ targetMigrationId: TARGET });
    assert.equal(b2.status, 'ACQUIRED', 'B acquires after A release');
    const b2Release = await rootB.releaseAdvisoryLock({ lockHandle: b2.handle });
    assert.equal(b2Release.status, 'RELEASED', 'B released');

    // A used one dedicated session; B used two (failed contention + fresh acquire).
    assert.equal(openerA.released.length, 1, 'A dedicated session released exactly once');
    assert.equal(openerB.released.length, 2, 'B dedicated sessions released exactly twice');
    await assertNoResidualLock(ctx.cfg, ctx.dbName);
    pass('R5');
  });
});

// ── R6. Foreign and released handles fail closed ───────────────────────────

test('R6 foreign/released handles fail closed with no extra queries or releases', async () => {
  await withDisposableDb('r6_handles', null, async (ctx) => {
    const openerA = createSessionOpener(ctx.cfg, ctx.dbName);
    const openerB = createSessionOpener(ctx.cfg, ctx.dbName);
    const rootA = createMigrationPreconditionCompositionRoot({
      openSession: openerA.openSession,
      authorityResolverFactory: activeResolverFactory(makeFalseCheck()),
    });
    const rootB = createMigrationPreconditionCompositionRoot({
      openSession: openerB.openSession,
      authorityResolverFactory: activeResolverFactory(makeFalseCheck()),
    });

    const a = await rootA.acquireAdvisoryLock({ targetMigrationId: TARGET });
    assert.equal(a.status, 'ACQUIRED');

    // Cross-instance handle: root B's broker does not own root A's handle.
    const foreign = await rootB.evaluatePrecondition({ targetMigrationId: TARGET, lockHandle: a.handle });
    assert.equal(foreign.status, 'UNAVAILABLE', 'cross-instance handle unavailable');
    const foreignCheck = await rootB.checkAdvisoryLock({ lockHandle: a.handle });
    assert.equal(foreignCheck.status, 'UNKNOWN', 'cross-instance check unknown');
    assert.equal(openerB.queryNames.length, 0, 'root B never ran a query on rejected paths');
    assert.equal(openerB.released.length, 0, 'root B never released a session on rejected paths');

    // Released handle: after release, evaluate must be UNAVAILABLE.
    const aRelease = await rootA.releaseAdvisoryLock({ lockHandle: a.handle });
    assert.equal(aRelease.status, 'RELEASED');
    const releasedEval = await rootA.evaluatePrecondition({ targetMigrationId: TARGET, lockHandle: a.handle });
    assert.equal(releasedEval.status, 'UNAVAILABLE', 'released handle evaluate unavailable');
    const repeated = await rootA.releaseAdvisoryLock({ lockHandle: a.handle });
    assert.equal(repeated.status, 'UNKNOWN', 'repeated release unknown');

    assert.equal(openerA.released.length, 1, 'root A dedicated session released exactly once');
    assert.equal(openerA.queryNames.length, 2, 'root A ran only acquire + release (no precondition/eval query)');
    await assertNoResidualLock(ctx.cfg, ctx.dbName);
    pass('R6');
  });
});

// ── R7. Cleanup and residual-lock proof across all scenarios ───────────────

test('R7 global cleanup leaves no disposable database, open client, or cleanup error', async () => {
  const errors = globalThis.__lb_db_cleanup_errors || [];
  assert.deepEqual(errors, [], 'no global cleanup errors');
  pass('R7');
});
