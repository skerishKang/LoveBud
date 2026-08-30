'use strict';

/**
 * Regression contract for #4299.
 *
 * Locks the two clean-bootstrap correctness repairs without broadening the
 * historical #3846 test boundary:
 * - clean-target preflight stays before lock acquisition and BEGIN;
 * - the existing PostgreSQL advisory-lock adapter owns the same pinned session
 *   from acquire through release;
 * - ledger INSERT uses RETURNING and exact migration-id/checksum identity;
 * - lock contention, skipped INSERT, and lost lock all fail closed before COMMIT.
 *
 * No Production/provider/credential access. All effects are synthetic fakes.
 * Refs #4299, #1882 KEEP OPEN.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ORCHESTRATOR_PATH = path.join(ROOT, 'scripts', 'migration-clean-bootstrap-orchestrator-core.cjs');
const {
  createCleanBootstrapRunner,
  FACTORY_ERRORS,
} = require('../../scripts/migration-clean-bootstrap-orchestrator-core.cjs');

function source() {
  return fs.readFileSync(ORCHESTRATOR_PATH, 'utf8');
}

function makeSession(options) {
  const opts = options || {};
  const events = opts.events || [];
  let released = false;

  return {
    query: async function (queryObject) {
      const text = typeof queryObject === 'string' ? queryObject : queryObject.text;
      const name = typeof queryObject === 'string' ? '' : (queryObject.name || '');
      const values = typeof queryObject === 'string' ? [] : (queryObject.values || []);

      if (name === 'lovebud-migration-lock-acquire-v1') {
        events.push('LOCK_ACQUIRE');
        return { rows: [{ acquired: opts.acquire !== false }] };
      }
      if (name === 'lovebud-migration-lock-check-v1') {
        events.push('LOCK_CHECK');
        return { rows: [{ held: opts.lockHeld !== false }] };
      }
      if (name === 'lovebud-migration-lock-release-v1') {
        events.push('LOCK_RELEASE');
        return { rows: [{ released: true }] };
      }
      if (text === 'BEGIN') {
        events.push('BEGIN');
        return { rows: [] };
      }
      if (text === 'COMMIT') {
        events.push('COMMIT');
        return { rows: [] };
      }
      if (text === 'ROLLBACK') {
        events.push('ROLLBACK');
        return { rows: [] };
      }
      if (/INSERT INTO schema_migration_ledger/i.test(text)) {
        events.push('LEDGER_INSERT');
        if (opts.insertReturnsRow === false) return { rows: [] };
        return {
          rows: [{
            migration_id: values[0],
            content_checksum: values[1],
          }],
        };
      }
      if (/SELECT to_regclass/i.test(text)) {
        events.push('RELATION_CHECK');
        return { rows: [{ exists: true }] };
      }
      if (/SELECT COUNT\(\*\)::int AS count FROM schema_migration_ledger/i.test(text)) {
        events.push('ROW_COUNT');
        return { rows: [{ count: 1 }] };
      }
      events.push('BOOTSTRAP_SQL');
      return { rows: [] };
    },
    release: async function () {
      assert.equal(released, false, 'same pinned session is released once');
      released = true;
      events.push('SESSION_RELEASE');
    },
  };
}

function makeRunner(options) {
  const opts = options || {};
  const events = opts.events || [];
  const session = makeSession(Object.assign({}, opts, { events }));
  const runner = createCleanBootstrapRunner({
    runnerVersion: 'v1',
    environmentClass: 'disposable-test',
    deployedCommit: '0000000000000000000000000000000000000000',
    operation: 'BOOTSTRAP_CLEAN_CANONICAL_LEDGER',
    targetClass: 'DISPOSABLE_POSTGRES_REHEARSAL_TARGET',
    approvalReference: 'issue:3846',
    dependencies: {
      openSession: async function () {
        events.push('SESSION_OPEN');
        return session;
      },
      verifyCleanTarget: async function () {
        events.push('CLEAN_TARGET');
        if (opts.cleanTargetThrows) throw new Error('raw-clean-target-error');
        return opts.cleanTarget !== false;
      },
      verifyCatalogFingerprint: async function () {
        events.push('FINGERPRINT');
        return true;
      },
      verifyNoResidualState: async function () {
        events.push('RESIDUAL');
        return true;
      },
      now: async function () { return '2026-08-30T00:00:00.000Z'; },
    },
  });
  return { runner, events };
}

test('source pins clean-target -> same-session lock -> BEGIN and exact RETURNING identity', () => {
  const src = source();
  const cleanIndex = src.indexOf('cleanTargetResult = await verifyCleanTarget(session, projection)');
  const adapterIndex = src.indexOf('createPostgresMigrationSessionLockAdapter');
  const acquireIndex = src.indexOf('lockAdapter.acquireAdvisoryLock');
  const beginIndex = src.indexOf("await session.query('BEGIN')");
  const checkIndex = src.indexOf('lockAdapter.checkAdvisoryLock');
  const commitIndex = src.indexOf("await session.query('COMMIT')");

  assert.ok(cleanIndex >= 0, 'clean-target call is present');
  assert.ok(adapterIndex >= 0, 'existing PostgreSQL lock adapter is used');
  assert.ok(acquireIndex > cleanIndex, 'lock acquisition follows clean-target preflight');
  assert.ok(beginIndex > acquireIndex, 'BEGIN follows successful lock acquisition');
  assert.ok(checkIndex > beginIndex && checkIndex < commitIndex, 'lock is rechecked before COMMIT');
  assert.ok(src.includes("openSession: async function () { return session; }"), 'lock adapter reuses the already-open pinned bootstrap session');
  assert.ok(src.includes("'RETURNING migration_id, content_checksum'"), 'ledger INSERT returns exact identity fields');
  assert.ok(src.includes('insertedRows[0].migration_id !== projection.migrationId'), 'returned migration identity is verified');
  assert.ok(src.includes('insertedRows[0].content_checksum !== projection.checksum'), 'returned checksum identity is verified');
  assert.ok(src.includes("'SELECT COUNT(*)::int AS count FROM ' + LEDGER_TABLE"), 'total-row clean-target invariant is retained');
});

test('synthetic success acquires/rechecks/releases one pinned lock and commits', async () => {
  const { runner, events } = makeRunner();
  const result = await runner.run();
  assert.equal(result.outcome, 'BOOTSTRAPPED');
  assert.equal(result.ledgerAppended, true);
  assert.deepEqual(result.blockers, []);
  assert.ok(events.indexOf('CLEAN_TARGET') < events.indexOf('LOCK_ACQUIRE'));
  assert.ok(events.indexOf('LOCK_ACQUIRE') < events.indexOf('BEGIN'));
  assert.ok(events.indexOf('LEDGER_INSERT') < events.indexOf('LOCK_CHECK'));
  assert.ok(events.indexOf('LOCK_CHECK') < events.indexOf('COMMIT'));
  assert.ok(events.indexOf('FINGERPRINT') < events.indexOf('LOCK_RELEASE'));
  assert.ok(events.indexOf('LOCK_RELEASE') < events.indexOf('SESSION_RELEASE'));
  assert.ok(events.indexOf('SESSION_RELEASE') < events.indexOf('RESIDUAL'));
  assert.equal(events.filter((e) => e === 'SESSION_OPEN').length, 1, 'exactly one pinned session opened');
  assert.equal(events.filter((e) => e === 'SESSION_RELEASE').length, 1, 'exactly one pinned session released');
});

test('dirty clean-target blocks before advisory lock or transactional SQL', async () => {
  const { runner, events } = makeRunner({ cleanTarget: false });
  const result = await runner.run();
  assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT');
  assert.deepEqual(result.blockers, [FACTORY_ERRORS.CLEAN_TARGET_VERIFICATION_FAILED]);
  assert.equal(events.includes('LOCK_ACQUIRE'), false);
  assert.equal(events.includes('BEGIN'), false);
  assert.equal(events.includes('LEDGER_INSERT'), false);
  assert.equal(events.filter((e) => e === 'SESSION_RELEASE').length, 1);
});

test('advisory lock contention blocks before BEGIN and performs no ledger write', async () => {
  const { runner, events } = makeRunner({ acquire: false });
  const result = await runner.run();
  assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT');
  assert.deepEqual(result.blockers, [FACTORY_ERRORS.ADVISORY_LOCK_REQUIRED]);
  assert.equal(events.includes('LOCK_ACQUIRE'), true);
  assert.equal(events.includes('BEGIN'), false);
  assert.equal(events.includes('LEDGER_INSERT'), false);
  assert.equal(events.filter((e) => e === 'SESSION_RELEASE').length, 1, 'contended session released once by adapter');
});

test('conflict-skipped INSERT returning zero rows fails closed and rolls back', async () => {
  const { runner, events } = makeRunner({ insertReturnsRow: false });
  const result = await runner.run();
  assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT');
  assert.deepEqual(result.blockers, [FACTORY_ERRORS.LEDGER_VERIFICATION_FAILED]);
  assert.equal(result.ledgerAppended, false);
  assert.equal(events.includes('LEDGER_INSERT'), true);
  assert.equal(events.includes('ROLLBACK'), true);
  assert.equal(events.includes('COMMIT'), false);
  assert.equal(events.includes('LOCK_RELEASE'), true);
  assert.equal(events.filter((e) => e === 'SESSION_RELEASE').length, 1);
});

test('lost advisory lock before COMMIT fails closed and rolls back', async () => {
  const { runner, events } = makeRunner({ lockHeld: false });
  const result = await runner.run();
  assert.equal(result.outcome, 'BLOCKED_BEFORE_COMMIT');
  assert.deepEqual(result.blockers, [FACTORY_ERRORS.ADVISORY_LOCK_LOST]);
  assert.equal(result.ledgerAppended, false);
  assert.equal(events.includes('LOCK_CHECK'), true);
  assert.equal(events.includes('ROLLBACK'), true);
  assert.equal(events.includes('COMMIT'), false);
  assert.equal(events.includes('LOCK_RELEASE'), true);
});
