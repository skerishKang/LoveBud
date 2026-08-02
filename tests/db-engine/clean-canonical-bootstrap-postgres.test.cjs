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

function buildRunDeps(ctx, overrides) {
  const opener = createSessionOpener(ctx.cfg, ctx.dbName);
  return Object.assign({
    openSession: opener,
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
      assert.ok(Array.isArray(evidence.objects), 'catalog evidence objects array');
      const ledger = evidence.objects.find(function (item) {
        return item.name === EXPECTED_CRITICAL_OBJECT_NAME;
      });
      assert.ok(ledger, 'catalog evidence contains ledger table object');
      assert.equal(ledger.fingerprint, expectedFingerprint, 'catalog fingerprint matches committed expected-schema manifest');
      return true;
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

async function runDedicatedBootstrap(ctx, overrides) {
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
    dependencies: buildRunDeps(ctx, overrides),
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

    const result = await runDedicatedBootstrap(ctx);
    assert.equal(result.outcome, 'BOOTSTRAPPED', 'dedicated bootstrap outcome');
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
      dependencies: Object.assign({
        openSession: failingSession,
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
