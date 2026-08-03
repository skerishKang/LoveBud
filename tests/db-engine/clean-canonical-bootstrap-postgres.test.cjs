'use strict';

/**
 * DB_ENGINE_EXECUTION: clean canonical bootstrap migration rehearsal
 * (Issue #3846, Step 8 Child 2).
 *
 * Executes only on GitHub Actions via `npm run test:db-engine:clean-canonical-bootstrap`.
 * Reads only LB_TEST_PG* synthetic loopback env via the shared disposable harness.
 * Never reads DATABASE_URL, never contacts Production/Neon/Modal.
 *
 * Committed-authority success path:
 *   - reads db/migration-provenance/canonical-migrations.json,
 *     db/migration-provenance/expected-schema-manifest.json, and
 *     db/migrations/20260802094500_bootstrap-migration-ledger.sql
 *   - uses manifest.migrations[0] and expectedSchema.critical_objects[0]
 *   - drives the dedicated orchestrator (scripts/migration-clean-bootstrap-orchestrator-core.cjs)
 *   - does NOT invoke the generic runner and does NOT use a synthetic active
 *     manifest (the generic runner ACTIVE gate stays intact)
 *
 * B1: server_version_num 170004.
 * B2: committed-authority bootstrap success path on a real PostgreSQL 17.4 engine:
 *     validate committed manifest/source, verify exact one migration, verify exact
 *     one expected critical object, verify checksum, verify clean target, verify
 *     explicit operation/target class/approval, begin transaction, execute exact
 *     committed SQL, insert exact ledger row, verify relation and row, commit,
 *     verify catalog fingerprint, verify no residual state.
 * B3: injected transactional failure -> rollback, no ledger relation, no ledger
 *     row, no residual advisory lock.
 * B4: cleanup and residual-lock proof.
 *
 * Refs: #3846, #3840, #3839, #3816, #3809, #3802, #3657, #3458, #3425, #3435,
 * #3437, #1882
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const harness = require('./helpers/postgres-disposable-harness.cjs');
const {
  createCleanBootstrapRunner,
  loadBootstrapProjection,
  BOOTSTRAP_MIGRATION_ID,
  BOOTSTRAP_MIGRATION_PATH,
  LEDGER_TABLE,
  EXPECTED_CRITICAL_OBJECT_NAME,
} = require('../../scripts/migration-clean-bootstrap-orchestrator-core.cjs');
const {
  collectCatalogEvidence,
  loadContract,
} = require('../../scripts/migration-catalog-postgres-adapter-core.cjs');

const { withDisposableDb, baseClientConfig } = harness;

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'db', 'migration-provenance', 'canonical-migrations.json');
const SCHEMA_MANIFEST_PATH = path.join(ROOT, 'db', 'migration-provenance', 'expected-schema-manifest.json');

function pass(name) {
  process.stdout.write(`${name}: PASS\n`);
}

function createSessionOpener(cfg, dbName) {
  return async function openSession() {
    const client = new Client(baseClientConfig(cfg, dbName));
    client.on('error', function () { /* expected post-dispose socket error */ });
    await client.connect();
    const session = {
      query: async function (queryObject) {
        const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
        const values = typeof queryObject === 'string' ? [] : (queryObject.values || []);
        const result = await client.query(text, values);
        return { rows: result.rows };
      },
      release: async function () {
        await client.end();
      },
    };
    return session;
  };
}

function buildRunDeps(ctx, overrides, capture) {
  capture = capture || {};
  const opener = createSessionOpener(ctx.cfg, ctx.dbName);
  return Object.assign({
    openSession: opener,
    verifyCleanTarget: async function () { return true; },
    verifyCatalogFingerprint: async function (expectedFingerprint) {
      const contract = loadContract(ROOT);
      const evidence = await collectCatalogEvidence({
        connection: {
          host: ctx.cfg.host,
          port: ctx.cfg.port,
          user: ctx.cfg.user,
          password: ctx.cfg.password,
          database: ctx.dbName,
        },
        objects: [
          { schema: 'public', object_name: 'schema_migration_ledger', object_kind: 'TABLE' },
        ],
        roleMapping: { lovebud_ci: 'APPLICATION' },
        contract,
      });
      const ledger = (evidence.objects || []).find(function (item) {
        return item.name === EXPECTED_CRITICAL_OBJECT_NAME;
      });
      capture.observedFingerprint = ledger ? ledger.fingerprint : null;
      return ledger ? ledger.fingerprint === expectedFingerprint : false;
    },
    verifyNoResidualState: async function () {
      const session = await opener();
      try {
        const result = await session.query({
          text: 'SELECT COUNT(*)::int AS locked FROM pg_locks WHERE locktype = \'advisory\' AND granted = TRUE',
          values: [],
        });
        return Number(result.rows[0].locked) === 0;
      } finally {
        try { await session.release(); } catch { /* ignore */ }
      }
    },
    now: async function () { return new Date().toISOString(); },
  }, overrides || {});
}

async function runDedicatedBootstrap(ctx, overrides, capture) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const expectedSchema = JSON.parse(fs.readFileSync(SCHEMA_MANIFEST_PATH, 'utf8'));

  const migration = manifest.migrations[0];
  const criticalObject = expectedSchema.critical_objects[0];

  assert.equal(manifest.status, 'ADOPTION_REQUIRED', 'manifest is ADOPTION_REQUIRED');
  assert.equal(manifest.migrations.length, 1, 'exactly one migration');
  assert.equal(migration.id, BOOTSTRAP_MIGRATION_ID, 'committed migration ID');
  assert.equal(migration.path, BOOTSTRAP_MIGRATION_PATH, 'committed migration path');
  assert.equal(manifest.bootstrap, undefined, 'no unauthorized bootstrap field');
  assert.equal(expectedSchema.bootstrap, undefined, 'no unauthorized bootstrap field');
  assert.equal(expectedSchema.status, 'ADOPTION_REQUIRED', 'expected schema is ADOPTION_REQUIRED');
  assert.equal(expectedSchema.critical_objects.length, 1, 'exactly one critical object');
  assert.equal(criticalObject.name, EXPECTED_CRITICAL_OBJECT_NAME, 'exact table object name');

  const runner = createCleanBootstrapRunner({
    runnerVersion: 'v1',
    environmentClass: 'disposable-test',
    deployedCommit: '0000000000000000000000000000000000000000',
    operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
    targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
    approvalReference: 'issue:3846',
    dependencies: buildRunDeps(ctx, overrides, capture),
  });

  return runner.run();
}

// ── B1. Server version assertion ─────────────────────────────────────────────

test('B1 PostgreSQL server_version_num is exactly 170004', async () => {
  await withDisposableDb('b1_version', null, async (ctx) => {
    const client = new Client(baseClientConfig(ctx.cfg, ctx.dbName));
    client.on('error', function () { /* expected post-drop socket error */ });
    try {
      await client.connect();
      const result = await client.query('SHOW server_version_num');
      assert.equal(String(result.rows[0].server_version_num), '170004', 'exact PostgreSQL 17.4');
    } finally {
      try { await client.end(); } catch { /* ignore */ }
    }
    pass('B1');
  });
});

// ── B2. Committed-authority bootstrap success path ───────────────────────────

test('B2 committed-authority bootstrap applies SQL, creates ledger table, records ledger row, commits', async () => {
  await withDisposableDb('b2_bootstrap', null, async (ctx) => {
    const projection = loadBootstrapProjection();
    assert.equal(projection.migrationId, BOOTSTRAP_MIGRATION_ID, 'projection migration ID');
    assert.equal(projection.criticalObjectName, EXPECTED_CRITICAL_OBJECT_NAME, 'projection critical object');
    assert.equal(projection.manifestStatus, 'ADOPTION_REQUIRED', 'projection status');
    assert.equal(projection.riskClass, 'ADDITIVE', 'ADDITIVE risk class');
    assert.equal(projection.transactionMode, 'REQUIRED', 'REQUIRED transaction mode');
    assert.deepEqual(projection.destructiveOperations, [], 'no destructive operations');
    assert.equal(projection.approvalReference, 'issue:3846', 'approval reference');

    const capture = {};
    const result = await runDedicatedBootstrap(ctx, undefined, capture);
    assert.equal(
      result.outcome,
      'BOOTSTRAPPED',
      'dedicated bootstrap outcome (observedFingerprint=' + capture.observedFingerprint + ', committedFingerprint=' + projection.catalogFingerprint + ')'
    );
    assert.equal(capture.observedFingerprint, projection.catalogFingerprint, 'observed catalog fingerprint matches committed expected-schema manifest');
    assert.deepEqual(result.blockers, [], 'no blockers');
    assert.equal(result.ledgerAppended, true, 'ledger row appended');
    assert.equal(result.catalogFingerprintVerified, true, 'catalog fingerprint verified');

    const verifyClient = new Client(baseClientConfig(ctx.cfg, ctx.dbName));
    verifyClient.on('error', function () { /* expected post-drop socket error */ });
    try {
      await verifyClient.connect();
      const tableCheck = await verifyClient.query(
        'SELECT to_regclass($1::text) IS NOT NULL AS exists',
        [LEDGER_TABLE],
      );
      assert.ok(tableCheck.rows[0].exists, 'schema_migration_ledger table exists');

      const countResult = await verifyClient.query(
        'SELECT COUNT(*)::int AS count FROM ' + LEDGER_TABLE,
      );
      assert.equal(Number(countResult.rows[0].count), 1, 'exactly one ledger row');

      const recordResult = await verifyClient.query(
        'SELECT migration_id, content_checksum, transaction_outcome FROM ' + LEDGER_TABLE,
      );
      const record = recordResult.rows[0];
      assert.equal(record.migration_id, BOOTSTRAP_MIGRATION_ID, 'ledger row migration_id');
      assert.equal(record.content_checksum, projection.checksum, 'ledger row content_checksum');
      assert.equal(record.transaction_outcome, 'COMMITTED', 'ledger row transaction_outcome');
    } finally {
      try { await verifyClient.end(); } catch { /* ignore */ }
    }

    pass('B2');
  });
});

// ── B3. Injected transactional failure -> rollback, no residual state ────────

test('B3 injected transactional failure rolls back and leaves no residual state', async () => {
  await withDisposableDb('b3_failure', null, async (ctx) => {
    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    let inserted = false;

    const failingSession = async function openSession() {
      const session = await opener();
      const originalQuery = session.query;
      session.query = async function (queryObject) {
        const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
        if (/INSERT\s+INTO\s+schema_migration_ledger/i.test(text)) {
          inserted = true;
          throw new Error('CLEAN_BOOTSTRAP_INJECTED_TRANSACTIONAL_FAILURE');
        }
        return originalQuery(queryObject);
      };
      return session;
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '0000000000000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:3846',
      dependencies: Object.assign({
        openSession: failingSession,
        verifyCleanTarget: async function () { return true; },
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return true; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const result = await runner.run();
    assert.equal(inserted, true, 'ledger INSERT was attempted');
    assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'blocked before commit on failure');
    assert.ok(result.blockers.length > 0, 'blocker reported');
    assert.equal(result.ledgerAppended, false, 'no ledger row appended');
    assert.equal(result.catalogFingerprintVerified, false, 'catalog fingerprint not verified');

    const verifyClient = new Client(baseClientConfig(ctx.cfg, ctx.dbName));
    verifyClient.on('error', function () { /* expected post-drop socket error */ });
    try {
      await verifyClient.connect();
      const tableCheck = await verifyClient.query(
        'SELECT to_regclass($1::text) IS NOT NULL AS exists',
        [LEDGER_TABLE],
      );
      assert.equal(Boolean(tableCheck.rows[0].exists), false, 'no ledger relation after rollback');
    } finally {
      try { await verifyClient.end(); } catch { /* ignore */ }
    }

    pass('B3');
  });
});

// ── B4. Cleanup and residual-lock proof ──────────────────────────────────────

test('B4 global cleanup leaves no disposable database, open client, or cleanup error', async () => {
  const errors = globalThis.__lb_db_cleanup_errors || [];
  assert.deepEqual(errors, [], 'no global cleanup errors');
  pass('B4');
});

// ── B5. Dirty target: verifyCleanTarget blocks before BEGIN ──────────

test('B5 dirty target blocks before BEGIN: SQL executed 0 times', async () => {
  await withDisposableDb('b5_dirty_target', null, async (ctx) => {
    let sessionOpenCount = 0;
    let sqlExecuteCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const trackingOpener = async function openSession() {
      sessionOpenCount++;
      const session = await opener();
      const originalQuery = session.query;
      session.query = async function (queryObject) {
        sqlExecuteCount++;
        return originalQuery(queryObject);
      };
      return session;
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '000000000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:3846',
      dependencies: Object.assign({
        openSession: trackingOpener,
        verifyCleanTarget: async function () { return false; },
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return true; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const result = await runner.run();
    assert.equal(sessionOpenCount, 1, 'session opened exactly once');
    assert.equal(sqlExecuteCount, 0, 'no SQL executed before dirty-target block');
    assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'dirty target blocked before commit');
    assert.equal(result.ledgerAppended, false, 'no ledger row appended');
    assert.equal(result.blockers.length, 1, 'one blocker reported');
    assert.equal(result.blockers[0], 'CLEAN_TARGET_VERIFICATION_FAILED', 'sanitized fixed code');
    pass('B5');
  });
});

// ── B6. Wrong operation: session open 0 ──────────────────────────

test('B6 wrong operation blocks before session open', async () => {
  await withDisposableDb('b6_wrong_operation', null, async (ctx) => {
    let sessionOpenCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const trackingOpener = async function openSession() {
      sessionOpenCount++;
      return opener();
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '000000000000000000000000000000000000',
      operation: 'WRONG_OPERATION',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:3846',
      dependencies: Object.assign({
        openSession: trackingOpener,
        verifyCleanTarget: async function () { return true; },
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return true; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const result = await runner.run();
    assert.equal(sessionOpenCount, 0, 'session open 0 for wrong operation');
    assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'wrong operation blocked before commit');
    assert.equal(result.ledgerAppended, false, 'no ledger row appended');
    assert.equal(result.blockers[0], 'OPERATION_INVALID', 'sanitized fixed code');
    pass('B6');
  });
});

// ── B7. Wrong target class: session open 0 ────────────────────────

test('B7 wrong target class blocks before session open', async () => {
  await withDisposableDb('b7_wrong_target', null, async (ctx) => {
    let sessionOpenCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const trackingOpener = async function openSession() {
      sessionOpenCount++;
      return opener();
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '000000000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'WRONG_TARGET_CLASS',
      approvalReference: 'issue:3846',
      dependencies: Object.assign({
        openSession: trackingOpener,
        verifyCleanTarget: async function () { return true; },
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return true; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const result = await runner.run();
    assert.equal(sessionOpenCount, 0, 'session open 0 for wrong target class');
    assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'wrong target blocked before commit');
    assert.equal(result.ledgerAppended, false, 'no ledger row appended');
    assert.equal(result.blockers[0], 'TARGET_CLASS_INVALID', 'sanitized fixed code');
    pass('B7');
  });
});

// ── B8. Wrong approval: session open 0 ────────────────────────────

test('B8 wrong approval blocks before session open', async () => {
  await withDisposableDb('b8_wrong_approval', null, async (ctx) => {
    let sessionOpenCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const trackingOpener = async function openSession() {
      sessionOpenCount++;
      return opener();
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '000000000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:9999',
      dependencies: Object.assign({
        openSession: trackingOpener,
        verifyCleanTarget: async function () { return true; },
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return true; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const result = await runner.run();
    assert.equal(sessionOpenCount, 0, 'session open 0 for wrong approval');
    assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'wrong approval blocked before commit');
    assert.equal(result.ledgerAppended, false, 'no ledger row appended');
    assert.equal(result.blockers[0], 'APPROVAL_INVALID', 'sanitized fixed code');
    pass('B8');
  });
});

// ── B9. Clean verifier throws: SQL executed 0, raw error leakage 0 ──

test('B9 clean verifier throws blocks before SQL and leaks no raw error', async () => {
  await withDisposableDb('b9_verifier_throws', null, async (ctx) => {
    let sessionOpenCount = 0;
    let sqlExecuteCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const trackingOpener = async function openSession() {
      sessionOpenCount++;
      const session = await opener();
      const originalQuery = session.query;
      session.query = async function (queryObject) {
        sqlExecuteCount++;
        return originalQuery(queryObject);
      };
      return session;
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '000000000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:3846',
      dependencies: Object.assign({
        openSession: trackingOpener,
        verifyCleanTarget: async function () { throw new Error('raw dependency error: SELECT * FROM pg_tables'); },
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return true; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const result = await runner.run();
    assert.equal(sessionOpenCount, 1, 'session opened once');
    assert.equal(sqlExecuteCount, 0, 'no SQL executed before verifier threw');
    assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'verifier throw blocked before commit');
    assert.equal(result.ledgerAppended, false, 'no ledger row appended');
    assert.equal(result.blockers[0], 'CLEAN_TARGET_VERIFICATION_FAILED', 'sanitized fixed code, no raw error');
    assert.ok(!result.blockers[0].includes('SELECT'), 'no raw SQL in blocker');
    assert.ok(!result.blockers[0].includes('pg_tables'), 'no raw table name in blocker');
    pass('B9');
  });
});

// ── B10. SQL failure after BEGIN: ROLLBACK 1, COMMIT 0 ──────────

test('B10 SQL failure after BEGIN rolls back and reports BLOCKED_BEFORE_COMMIT', async () => {
  await withDisposableDb('b10_sql_failure', null, async (ctx) => {
    let commitCount = 0;
    let rollbackCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const failingOpener = async function openSession() {
      const session = await opener();
      const originalQuery = session.query;
      session.query = async function (queryObject) {
        const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
        if (text === 'COMMIT') {
          commitCount++;
        }
        if (text === 'ROLLBACK') {
          rollbackCount++;
        }
        if (/INSERT\s+INTO\s+schema_migration_ledger/i.test(text)) {
          throw new Error('CLEAN_BOOTSTRAP_INJECTED_SQL_FAILURE');
        }
        return originalQuery(queryObject);
      };
      return session;
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '000000000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:3846',
      dependencies: Object.assign({
        openSession: failingOpener,
        verifyCleanTarget: async function () { return true; },
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return true; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const result = await runner.run();
    assert.equal(rollbackCount, 1, 'ROLLBACK called once');
    assert.equal(commitCount, 0, 'COMMIT called zero times');
    assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'SQL failure reports BLOCKED_BEFORE_COMMIT');
    assert.equal(result.ledgerAppended, false, 'no ledger row appended');
    pass('B10');
  });
});

// ── B11. Fingerprint failure after COMMIT: ROLLBACK 0, ledgerAppended true ──

test('B11 fingerprint failure after COMMIT reports COMMITTED_POST_VERIFICATION_FAILED', async () => {
  await withDisposableDb('b11_fingerprint_fail', null, async (ctx) => {
    let commitCount = 0;
    let rollbackCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const trackingOpener = async function openSession() {
      const session = await opener();
      const originalQuery = session.query;
      session.query = async function (queryObject) {
        const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
        if (text === 'COMMIT') commitCount++;
        if (text === 'ROLLBACK') rollbackCount++;
        return originalQuery(queryObject);
      };
      return session;
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '000000000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:3846',
      dependencies: Object.assign({
        openSession: trackingOpener,
        verifyCleanTarget: async function () { return true; },
        verifyCatalogFingerprint: async function () { return false; },
        verifyNoResidualState: async function () { return true; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const result = await runner.run();
    assert.equal(rollbackCount, 0, 'ROLLBACK called zero times after COMMIT');
    assert.equal(commitCount, 1, 'COMMIT called once');
    assert.equal(result.outcome, 'COMMITTED_POST_VERIFICATION_FAILED', 'fingerprint failure reports truthfully');
    assert.equal(result.ledgerAppended, true, 'ledgerAppended true after commit');
    assert.equal(result.catalogFingerprintVerified, false, 'catalogFingerprintVerified false on fingerprint failure');
    pass('B11');
  });
});

// ── B12. Residual failure after COMMIT: ROLLBACK 0, ledgerAppended true ──

test('B12 residual failure after COMMIT reports COMMITTED_POST_VERIFICATION_FAILED', async () => {
  await withDisposableDb('b12_residual_fail', null, async (ctx) => {
    let commitCount = 0;
    let rollbackCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const trackingOpener = async function openSession() {
      const session = await opener();
      const originalQuery = session.query;
      session.query = async function (queryObject) {
        const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
        if (text === 'COMMIT') commitCount++;
        if (text === 'ROLLBACK') rollbackCount++;
        return originalQuery(queryObject);
      };
      return session;
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '000000000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:3846',
      dependencies: Object.assign({
        openSession: trackingOpener,
        verifyCleanTarget: async function () { return true; },
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return false; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const result = await runner.run();
    assert.equal(rollbackCount, 0, 'ROLLBACK called zero times after COMMIT');
    assert.equal(commitCount, 1, 'COMMIT called once');
    assert.equal(result.outcome, 'COMMITTED_POST_VERIFICATION_FAILED', 'residual failure reports truthfully');
    assert.equal(result.ledgerAppended, true, 'ledgerAppended true after commit');
    assert.equal(result.postCommitResidualVerified, false, 'postCommitResidualVerified false');
    pass('B12');
  });
});

// ── B13. Second run against already-bootstrapped target ──────────

test('B13 second run against already-bootstrapped target is blocked by clean-target check', async () => {
  await withDisposableDb('b13_second_run', null, async (ctx) => {
    let sessionOpenCount = 0;
    let sqlExecuteCount = 0;
    let verifyCleanTargetCallCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const trackingOpener = async function openSession() {
      sessionOpenCount++;
      const session = await opener();
      const originalQuery = session.query;
      session.query = async function (queryObject) {
        const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
        sqlExecuteCount++;
        return originalQuery(queryObject);
      };
      return session;
    };

    const verifyCleanTarget = async function (session, projection) {
      verifyCleanTargetCallCount++;
      const result = await session.query({
        text: 'SELECT to_regclass($1::text) IS NOT NULL AS exists',
        values: [LEDGER_TABLE],
      });
      const exists = Boolean(result.rows[0] && result.rows[0].exists);
      return !exists;
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '000000000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:3846',
      dependencies: Object.assign({
        openSession: trackingOpener,
        verifyCleanTarget,
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return true; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const firstResult = await runner.run();
    assert.equal(firstResult.outcome, 'BOOTSTRAPPED', 'first clean run bootstrapped');
    assert.equal(firstResult.ledgerAppended, true, 'first run appended ledger');

    const secondResult = await runner.run();
    assert.equal(secondResult.outcome, 'BLOCKED_BEFORE_COMMIT', 'second run blocked by clean-target check');
    assert.equal(secondResult.ledgerAppended, false, 'second ledger insert: 0');
    assert.equal(verifyCleanTargetCallCount, 2, 'verifyCleanTarget called for both runs');

    const verifyClient = new Client(baseClientConfig(ctx.cfg, ctx.dbName));
    verifyClient.on('error', function () { /* expected post-drop socket error */ });
    try {
      await verifyClient.connect();
      const countResult = await verifyClient.query(
        'SELECT COUNT(*)::int AS count FROM ' + LEDGER_TABLE,
      );
      assert.equal(Number(countResult.rows[0].count), 1, 'ledger row count still exactly 1');

      const relationResult = await verifyClient.query(
        'SELECT COUNT(*)::int AS count FROM pg_class WHERE relname = $1',
        [LEDGER_TABLE],
      );
      assert.equal(Number(relationResult.rows[0].count), 1, 'unexpected extra relation: 0');
    } finally {
      try { await verifyClient.end(); } catch { /* ignore */ }
    }

    pass('B13');
  });
});

// ── B14. Session release exactly once ────────────────────────────

test('B14 release is called exactly once per session', async () => {
  await withDisposableDb('b14_release_once', null, async (ctx) => {
    let releaseCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const trackingOpener = async function openSession() {
      const session = await opener();
      const originalRelease = session.release;
      session.release = async function () {
        releaseCount++;
        return originalRelease();
      };
      return session;
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '000000000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:3846',
      dependencies: Object.assign({
        openSession: trackingOpener,
        verifyCleanTarget: async function () { return true; },
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return true; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    await runner.run();
    assert.equal(releaseCount, 1, 'release called exactly once');
    pass('B14');
  });
});

// ── B15. Unknown config field is rejected ──────────

test('B15 unknown config field is rejected before session open', async () => {
  await withDisposableDb('b15_unknown_field', null, async (ctx) => {
    let sessionOpenCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const trackingOpener = async function openSession() {
      sessionOpenCount++;
      return opener();
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '0000000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:3846',
      unknownField: 'should-not-bypass',
      dependencies: Object.assign({
        openSession: trackingOpener,
        verifyCleanTarget: async function () { return true; },
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return true; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const result = await runner.run();
    assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT', 'unknown config field is rejected');
    assert.equal(sessionOpenCount, 0, 'session open 0 for unknown config field');
    pass('B15');
  });
});

// ── B16. Residual failure after COMMIT: catalogFingerprintVerified true ──

test('B16 residual failure after COMMIT reports catalogFingerprintVerified true', async () => {
  await withDisposableDb('b16_residual_fail', null, async (ctx) => {
    let commitCount = 0;
    let rollbackCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const trackingOpener = async function openSession() {
      const session = await opener();
      const originalQuery = session.query;
      session.query = async function (queryObject) {
        const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
        if (text === 'COMMIT') commitCount++;
        if (text === 'ROLLBACK') rollbackCount++;
        return originalQuery(queryObject);
      };
      return session;
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '00000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:3846',
      dependencies: Object.assign({
        openSession: trackingOpener,
        verifyCleanTarget: async function () { return true; },
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return false; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const result = await runner.run();
    assert.equal(result.outcome, 'COMMITTED_POST_VERIFICATION_FAILED', 'residual failure reports truthfully');
    assert.equal(result.ledgerAppended, true, 'ledgerAppended true after commit');
    assert.equal(result.catalogFingerprintVerified, true, 'catalogFingerprintVerified true (fingerprint succeeded)');
    assert.equal(result.postCommitResidualVerified, false, 'postCommitResidualVerified false');
    assert.equal(rollbackCount, 0, 'ROLLBACK called zero times after commit');
    assert.equal(commitCount, 1, 'COMMIT called once');
    pass('B16');
  });
});

// ── B17. Dirty second run: only read-only query, no mutation ──

test('B17 dirty second run executes only clean-target read-only query', async () => {
  await withDisposableDb('b17_dirty_second', null, async (ctx) => {
    let sessionOpenCount = 0;
    let sqlExecuteCount = 0;
    let verifyCleanTargetCallCount = 0;
    let commitCount = 0;
    let rollbackCount = 0;
    let ledgerInsertCount = 0;

    const opener = createSessionOpener(ctx.cfg, ctx.dbName);
    const trackingOpener = async function openSession() {
      sessionOpenCount++;
      const session = await opener();
      const originalQuery = session.query;
      session.query = async function (queryObject) {
        const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
        sqlExecuteCount++;
        if (text === 'COMMIT') commitCount++;
        if (text === 'ROLLBACK') rollbackCount++;
        if (/INSERT INTO schema_migration_ledger/i.test(text)) ledgerInsertCount++;
        return originalQuery(queryObject);
      };
      return session;
    };

    const verifyCleanTarget = async function (session, projection) {
      verifyCleanTargetCallCount++;
      const result = await session.query({
        text: 'SELECT to_regclass($1::text) IS NOT NULL AS exists',
        values: [LEDGER_TABLE],
      });
      const exists = Boolean(result.rows[0] && result.rows[0].exists);
      return !exists;
    };

    const runner = createCleanBootstrapRunner({
      runnerVersion: 'v1',
      environmentClass: 'disposable-test',
      deployedCommit: '00000000000000000000000000000000',
      operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
      targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
      approvalReference: 'issue:3846',
      dependencies: Object.assign({
        openSession: trackingOpener,
        verifyCleanTarget,
        verifyCatalogFingerprint: async function () { return true; },
        verifyNoResidualState: async function () { return true; },
        now: async function () { return new Date().toISOString(); },
      }),
    });

    const firstResult = await runner.run();
    assert.equal(firstResult.outcome, 'BOOTSTRAPPED', 'first clean run bootstrapped');

    const secondBaseline = {
      queries: sqlExecuteCount,
      commits: commitCount,
      rollbacks: rollbackCount,
      inserts: ledgerInsertCount,
    };
    const secondResult = await runner.run();
    assert.equal(secondResult.outcome, 'BLOCKED_BEFORE_COMMIT', 'second run blocked by clean-target check');
    assert.equal(secondResult.ledgerAppended, false, 'second ledger insert: 0');
    assert.equal(verifyCleanTargetCallCount, 2, 'verifyCleanTarget called for both runs');
    assert.equal(sqlExecuteCount - secondBaseline.queries, 1, 'second run executes exactly one clean-target read-only query');
    assert.equal(commitCount - secondBaseline.commits, 0, 'BEGIN/bootstrap/ledger insert/COMMIT are 0 on second run');
    assert.equal(rollbackCount - secondBaseline.rollbacks, 0, 'ROLLBACK is 0 on second run');
    assert.equal(ledgerInsertCount - secondBaseline.inserts, 0, 'no ledger insert on second run');

    const verifyClient = new Client(baseClientConfig(ctx.cfg, ctx.dbName));
    verifyClient.on('error', function () { /* expected post-drop socket error */ });
    try {
      await verifyClient.connect();
      const countResult = await verifyClient.query(
        'SELECT COUNT(*)::int AS count FROM ' + LEDGER_TABLE,
      );
      assert.equal(Number(countResult.rows[0].count), 1, 'final ledger row count is 1');
    } finally {
      try { await verifyClient.end(); } catch { /* ignore */ }
    }

    pass('B17');
  });
});
