'use strict';

/**
 * Focused SOURCE_STATIC contract test: canonical migration runner protocol
 * (#3458, fourth slice).
 *
 * It exercises scripts/migration-runner-protocol-core.cjs (evaluateMigrationPreflight
 * and evaluateMigrationCompletion) as pure functions over bounded input objects.
 * It performs NO database connection, NO SQL execution, NO ledger write, and NO
 * advisory lock acquisition. There are no SQL fixtures: the protocol contract is
 * pure decision logic.
 *
 * Refs #3458
 * Refs #3425 - Keep #3425 OPEN.
 * Refs #3435 - Keep #3435 OPEN.
 * Refs #3437 - Keep #3437 OPEN.
 * Refs #1882 - Keep #1882 OPEN.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CORE_PATH = path.join(REPO_ROOT, 'scripts', 'migration-runner-protocol-core.cjs');
const core = require(CORE_PATH);

const {
  RUNNER_DECISIONS,
  RECOVERY_DECISIONS,
  FORBIDDEN_RUNNER_ACTIONS,
  RUNNER_BLOCKERS
} = core;

const MANIFEST = [
  { id: '20260101000000_a', checksum: 'sha256:aa' },
  { id: '20260102000000_b', checksum: 'sha256:bb' }
];
const A_COMMITTED = { migration_id: '20260101000000_a', content_checksum: 'sha256:aa', transaction_outcome: 'COMMITTED' };

// A valid preflight input for migration b (depends on a, which is applied).
function validPreflight(overrides = {}) {
  return {
    sourceValidation: 'PASS',
    advisoryLock: 'ACQUIRED',
    precondition: 'PASS',
    migration: { id: '20260102000000_b', checksum: 'sha256:bb', transactionMode: 'REQUIRED', dependsOn: ['20260101000000_a'], explicitBoundaryApproved: false },
    manifestOrder: MANIFEST,
    ledger: [A_COMMITTED],
    ...overrides
  };
}

// A valid completion input for migration b.
function validCompletion(overrides = {}) {
  return {
    sourceValidation: 'PASS',
    advisoryLock: 'ACQUIRED',
    priorSequenceValid: true,
    migrationId: '20260102000000_b',
    migrationChecksum: 'sha256:bb',
    manifestChecksum: 'sha256:bb',
    executionOutcome: 'SUCCEEDED',
    transactionOutcome: 'COMMITTED',
    transactionMode: 'REQUIRED',
    postcondition: 'PASS',
    ...overrides
  };
}

function assertForbiddenNeverReturned(result) {
  assert.ok(!FORBIDDEN_RUNNER_ACTIONS.includes(result.decision), `forbidden decision: ${result.decision}`);
  assert.ok(!FORBIDDEN_RUNNER_ACTIONS.includes(result.recovery), `forbidden recovery: ${result.recovery}`);
  for (const blocker of result.blockers) {
    assert.ok(!FORBIDDEN_RUNNER_ACTIONS.includes(blocker), `forbidden blocker: ${blocker}`);
  }
}

describe('DB canonical runner protocol contract (#3458)', () => {

  describe('1. Preflight: source validation and advisory lock', () => {
    it('source validation FAIL fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ sourceValidation: 'FAIL' }));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.FAIL_CLOSED);
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_SOURCE_VALIDATION_FAILED));
      assertForbiddenNeverReturned(r);
    });
    it('advisory lock UNAVAILABLE fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ advisoryLock: 'UNAVAILABLE' }));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.FAIL_CLOSED);
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_ADVISORY_LOCK_REQUIRED));
    });
    it('advisory lock FAILED fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ advisoryLock: 'FAILED' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_ADVISORY_LOCK_REQUIRED));
    });
    it('advisory lock NOT_ATTEMPTED fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ advisoryLock: 'NOT_ATTEMPTED' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_ADVISORY_LOCK_REQUIRED));
    });
  });

  describe('2. Preflight: canonical sequence and dependencies', () => {
    it('ready to execute when all prior migrations are committed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight());
      assert.strictEqual(r.decision, RUNNER_DECISIONS.READY_TO_EXECUTE);
      assert.deepStrictEqual(r.blockers, []);
      assert.strictEqual(r.recovery, RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
    });
    it('a prior migration missing from ledger blocks the sequence', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ ledger: [] }));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.FAIL_CLOSED);
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_DEPENDENCY_NOT_APPLIED')));
    });
    it('a prior migration with a non-committed outcome blocks the sequence', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ ledger: [{ migration_id: '20260101000000_a', content_checksum: 'sha256:aa', transaction_outcome: 'FAILED' }] }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_PRIOR_OUTCOME_NOT_COMMITTED')));
    });
    it('a migration absent from the manifest is sequence-blocked', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ migration: { id: '20260103000000_z', checksum: 'sha256:zz', transactionMode: 'REQUIRED', dependsOn: [] } }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_SEQUENCE_BLOCKED));
    });
    it('a declared dependency that is not applied blocks execution', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        migration: { id: '20260102000000_b', checksum: 'sha256:bb', transactionMode: 'REQUIRED', dependsOn: ['20260101000000_a', '20260101000000_missing'] },
        ledger: [A_COMMITTED]
      }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_DEPENDENCY_NOT_APPLIED:20260101000000_missing')));
    });
    it('an unknown ledger migration (outside the manifest) fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ ledger: [A_COMMITTED, { migration_id: '99999999999999_zzz', content_checksum: 'sha256:zz', transaction_outcome: 'COMMITTED' }] }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_UNKNOWN_LEDGER_MIGRATION')));
    });
    it('a duplicate ledger ID fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ ledger: [A_COMMITTED, A_COMMITTED] }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_DUPLICATE_LEDGER_MIGRATION')));
    });
  });

  describe('3. Preflight: idempotent retry', () => {
    it('exact committed match is a no-op (no re-execute, no re-append)', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        migration: { id: '20260101000000_a', checksum: 'sha256:aa', transactionMode: 'REQUIRED', dependsOn: [] },
        ledger: [A_COMMITTED]
      }));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.NOOP_ALREADY_APPLIED);
      assert.deepStrictEqual(r.blockers, []);
      assert.strictEqual(r.recovery, RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
    });
    it('same ID with a different checksum fails closed (forward-fix)', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        migration: { id: '20260101000000_a', checksum: 'sha256:XX', transactionMode: 'REQUIRED', dependsOn: [] },
        ledger: [A_COMMITTED]
      }));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.FAIL_CLOSED);
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_APPLIED_CHECKSUM_MISMATCH')));
      assert.strictEqual(r.recovery, RECOVERY_DECISIONS.FORWARD_FIX_REQUIRED);
    });
    it('same ID with a non-committed outcome forbids automatic retry', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        migration: { id: '20260101000000_a', checksum: 'sha256:aa', transactionMode: 'REQUIRED', dependsOn: [] },
        ledger: [{ migration_id: '20260101000000_a', content_checksum: 'sha256:aa', transaction_outcome: 'PARTIAL' }]
      }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_EXISTING_NON_COMMITTED_OUTCOME:20260101000000_a:PARTIAL')));
      assert.strictEqual(r.recovery, RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED);
    });
  });

  describe('4. Preflight: transaction mode and preconditions', () => {
    it('an unsupported transaction mode fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ migration: { id: '20260102000000_b', checksum: 'sha256:bb', transactionMode: 'BOGUS', dependsOn: [] } }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_TRANSACTION_MODE_INVALID));
    });
    it('EXPLICIT without an approved boundary fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ migration: { id: '20260102000000_b', checksum: 'sha256:bb', transactionMode: 'EXPLICIT', dependsOn: [], explicitBoundaryApproved: false } }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_EXPLICIT_BOUNDARY_REQUIRED));
    });
    it('EXPLICIT with an approved boundary passes the mode check', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ migration: { id: '20260102000000_b', checksum: 'sha256:bb', transactionMode: 'EXPLICIT', dependsOn: ['20260101000000_a'], explicitBoundaryApproved: true } }));
      assert.ok(!r.blockers.includes(RUNNER_BLOCKERS.RUNNER_EXPLICIT_BOUNDARY_REQUIRED));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.READY_TO_EXECUTE);
    });
    it('precondition FAIL fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ precondition: 'FAIL' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_PRECONDITION_FAILED));
    });
    it('precondition UNAVAILABLE fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ precondition: 'UNAVAILABLE' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_PRECONDITION_UNAVAILABLE));
    });
    it('precondition NOT_EVALUATED fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ precondition: 'NOT_EVALUATED' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_PRECONDITION_NOT_EVALUATED));
    });
  });

  describe('5. Completion: ledger append authorization', () => {
    it('authorizes ledger append only when every condition holds', () => {
      const r = core.evaluateMigrationCompletion(validCompletion());
      assert.strictEqual(r.decision, RUNNER_DECISIONS.READY_TO_APPEND_LEDGER);
      assert.deepStrictEqual(r.blockers, []);
      assert.strictEqual(r.recovery, RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
      assertForbiddenNeverReturned(r);
    });
    it('postcondition FAIL blocks ledger append', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ postcondition: 'FAIL' }));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.FAIL_CLOSED);
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_POSTCONDITION_FAILED));
    });
    it('postcondition UNAVAILABLE blocks ledger append', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ postcondition: 'UNAVAILABLE' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_POSTCONDITION_UNAVAILABLE));
    });
    it('postcondition NOT_EVALUATED blocks ledger append', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ postcondition: 'NOT_EVALUATED' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_POSTCONDITION_NOT_EVALUATED));
    });
    it('unknown execution outcome blocks ledger append', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ executionOutcome: 'UNKNOWN' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_EXECUTION_OUTCOME_UNKNOWN));
    });
    it('a non-succeeded execution outcome blocks ledger append', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ executionOutcome: 'PARTIAL' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_EXECUTION_OUTCOME_NOT_SUCCEEDED));
    });
    it('a non-committed transaction outcome blocks ledger append', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ transactionOutcome: 'PARTIAL' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_TRANSACTION_OUTCOME_NOT_COMMITTED));
    });
    it('checksum mismatch with the manifest blocks ledger append (forward-fix)', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ migrationChecksum: 'sha256:XX' }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_APPLIED_CHECKSUM_MISMATCH')));
      assert.strictEqual(r.recovery, RECOVERY_DECISIONS.FORWARD_FIX_REQUIRED);
    });
    it('a lost advisory lock blocks ledger append', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ advisoryLock: 'UNAVAILABLE' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_ADVISORY_LOCK_REQUIRED));
    });
    it('source validation failure blocks ledger append', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ sourceValidation: 'FAIL' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_SOURCE_VALIDATION_FAILED));
    });
    it('an invalid prior sequence blocks ledger append', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ priorSequenceValid: false }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_SEQUENCE_BLOCKED));
    });
  });

  describe('6. Completion: recovery decisions', () => {
    it('REQUIRED transaction proven ROLLED_BACK requires a fresh preflight (no auto-retry)', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ transactionMode: 'REQUIRED', transactionOutcome: 'ROLLED_BACK', executionOutcome: 'FAILED' }));
      assert.strictEqual(r.recovery, RECOVERY_DECISIONS.RETRY_REQUIRES_FRESH_PREFLIGHT);
    });
    it('PROHIBITED execution failure requires manual reconciliation', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ transactionMode: 'PROHIBITED', executionOutcome: 'PARTIAL', transactionOutcome: 'UNKNOWN' }));
      assert.strictEqual(r.recovery, RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED);
    });
    it('EXPLICIT execution failure requires manual reconciliation', () => {
      const r = core.evaluateMigrationCompletion(validCompletion({ transactionMode: 'EXPLICIT', executionOutcome: 'FAILED', transactionOutcome: 'UNKNOWN' }));
      assert.strictEqual(r.recovery, RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED);
    });
  });

  describe('7. Protocol invariants', () => {
    it('never returns a forbidden down-migration/rollback/rewrite action', () => {
      const samples = [
        core.evaluateMigrationPreflight(validPreflight()),
        core.evaluateMigrationPreflight(validPreflight({ sourceValidation: 'FAIL' })),
        core.evaluateMigrationPreflight(validPreflight({ ledger: [] })),
        core.evaluateMigrationCompletion(validCompletion()),
        core.evaluateMigrationCompletion(validCompletion({ postcondition: 'FAIL' })),
        core.evaluateMigrationCompletion(validCompletion({ transactionMode: 'PROHIBITED', executionOutcome: 'PARTIAL', transactionOutcome: 'UNKNOWN' }))
      ];
      for (const r of samples) assertForbiddenNeverReturned(r);
    });
    it('is deterministic (same input yields identical output)', () => {
      const input = validPreflight();
      assert.deepStrictEqual(core.evaluateMigrationPreflight(input), core.evaluateMigrationPreflight(input));
      const cInput = validCompletion();
      assert.deepStrictEqual(core.evaluateMigrationCompletion(cInput), core.evaluateMigrationCompletion(cInput));
    });
    it('blockers are sorted and de-duplicated', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ precondition: 'FAIL', advisoryLock: 'ACQUIRED', ledger: [] }));
      assert.deepStrictEqual(r.blockers, [...new Set(r.blockers)].sort());
    });
  });

  describe('8. Source-only safety boundary', () => {
    it('core has no database/network/deploy client, filesystem, or secret material', () => {
      const source = fs.readFileSync(CORE_PATH, 'utf8');
      assert.doesNotMatch(source, /require\(['"](?:pg|child_process|playwright|dotenv|net|http|https|node:child_process|node:net|node:http|node:https)['"]\)/i);
      assert.doesNotMatch(source, /\bfetch\s*\(/);
      assert.doesNotMatch(source, /\bDATABASE_URL\b/);
      assert.doesNotMatch(source, /postgres(?:ql)?:\/\//i);
      assert.doesNotMatch(source, /-----BEGIN[A-Z ]*PRIVATE KEY-----/);
      assert.doesNotMatch(source, /spawnSync|execSync|spawn\(|exec\(/);
      assert.doesNotMatch(source, /fs\.(readFileSync|writeFileSync|existsSync|mkdirSync|rmSync)/);
    });
  });
});
