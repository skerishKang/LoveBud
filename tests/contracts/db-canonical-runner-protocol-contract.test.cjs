'use strict';

/**
 * Focused SOURCE_STATIC contract test: canonical migration runner protocol
 * (#3458, fourth slice; hardened binding + ledger prefix follow-up).
 *
 * It exercises scripts/migration-runner-protocol-core.cjs (evaluateMigrationPreflight
 * and evaluateMigrationCompletion) as pure functions over bounded input objects.
 * It performs NO database connection, NO SQL execution, NO ledger write, and NO
 * advisory lock acquisition. There are no SQL fixtures: the protocol contract is
 * pure decision logic. Tests call the real functions (not comment/string presence).
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

const { RUNNER_DECISIONS, RECOVERY_DECISIONS, FORBIDDEN_RUNNER_ACTIONS, RUNNER_BLOCKERS } = core;

const MANIFEST = [
  { id: '20260101000000_a', checksum: 'sha256:aa', depends_on: [], transaction_mode: 'REQUIRED', risk_class: 'ADDITIVE', destructive_operations: [] },
  { id: '20260102000000_b', checksum: 'sha256:bb', depends_on: ['20260101000000_a'], transaction_mode: 'REQUIRED', risk_class: 'ADDITIVE', destructive_operations: [] },
  { id: '20260103000000_c', checksum: 'sha256:cc', depends_on: [], transaction_mode: 'REQUIRED', risk_class: 'ADDITIVE', destructive_operations: [] },
  { id: '20260104000000_destruct', checksum: 'sha256:dd', depends_on: [], transaction_mode: 'REQUIRED', risk_class: 'DESTRUCTIVE', destructive_operations: ['DROP_TABLE'] }
];

function rec(id, checksum, outcome) {
  return {
    migration_id: id,
    content_checksum: checksum,
    applied_at: '2026-01-01T00:00:00Z',
    runner_version: '1.0.0',
    environment_class: 'disposable',
    deployed_commit: 'sha256:commit',
    transaction_outcome: outcome || 'COMMITTED'
  };
}

function validPreflight(over) {
  return {
    sourceValidationStatus: 'PASS',
    manifestStatus: 'ACTIVE',
    manifestMigrations: MANIFEST,
    targetMigrationId: '20260102000000_b',
    ledgerRecords: [rec('20260101000000_a', 'sha256:aa')],
    advisoryLockStatus: 'ACQUIRED',
    preconditionStatus: 'PASS',
    explicitBoundaryApproved: false,
    requestedAction: 'APPLY_FORWARD',
    ...(over || {})
  };
}

// Build a completion bound to the canonical preflight of the given input.
function completionFor(preflightInput, over) {
  const preflightResult = core.evaluateMigrationPreflight(preflightInput);
  return {
    preflightInput,
    preflightResult,
    executionOutcome: 'SUCCEEDED',
    transactionOutcome: 'COMMITTED',
    postconditionStatus: 'PASS',
    advisoryLockStatus: 'ACQUIRED',
    migrationId: preflightResult.migrationId,
    migrationChecksum: preflightResult.migrationChecksum,
    ledgerAppendAuthorized: false,
    ...(over || {})
  };
}

function assertNoForbidden(result) {
  assert.ok(!FORBIDDEN_RUNNER_ACTIONS.includes(result.decision));
  assert.ok(!FORBIDDEN_RUNNER_ACTIONS.includes(result.recoveryDecision));
  for (const b of result.blockers) assert.ok(!FORBIDDEN_RUNNER_ACTIONS.includes(b));
}

describe('DB canonical runner protocol contract (#3458)', () => {

  describe('1. Preflight: manifest status and source validation', () => {
    it('manifest ADOPTION_REQUIRED is blocked', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ manifestStatus: 'ADOPTION_REQUIRED' }));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.FAIL_CLOSED);
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_MANIFEST_NOT_ACTIVE));
    });
    it('manifest missing/unknown status is blocked', () => {
      assert.ok(core.evaluateMigrationPreflight(validPreflight({ manifestStatus: undefined })).blockers.includes(RUNNER_BLOCKERS.RUNNER_MANIFEST_NOT_ACTIVE));
      assert.ok(core.evaluateMigrationPreflight(validPreflight({ manifestStatus: 'SOMETHING' })).blockers.includes(RUNNER_BLOCKERS.RUNNER_MANIFEST_NOT_ACTIVE));
    });
    it('source validation UNAVAILABLE has a distinct blocker', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ sourceValidationStatus: 'UNAVAILABLE' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_SOURCE_VALIDATION_UNAVAILABLE));
      assert.ok(!r.blockers.includes(RUNNER_BLOCKERS.RUNNER_SOURCE_VALIDATION_FAILED));
    });
    it('source validation FAIL fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ sourceValidationStatus: 'FAIL' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_SOURCE_VALIDATION_FAILED));
    });
    it('advisory lock not ACQUIRED fails closed', () => {
      for (const status of ['NOT_ATTEMPTED', 'UNAVAILABLE', 'FAILED', 'LOST']) {
        assert.ok(core.evaluateMigrationPreflight(validPreflight({ advisoryLockStatus: status })).blockers.includes(RUNNER_BLOCKERS.RUNNER_ADVISORY_LOCK_REQUIRED), status);
      }
    });
  });

  describe('2. Preflight: ledger evidence availability', () => {
    it('missing ledger is blocked (not coerced to empty)', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ ledgerRecords: undefined }));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.FAIL_CLOSED);
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_LEDGER_EVIDENCE_UNAVAILABLE));
    });
    it('non-array ledger (object/string/null) is blocked', () => {
      for (const bad of [{}, 'ledger', null]) {
        assert.ok(core.evaluateMigrationPreflight(validPreflight({ ledgerRecords: bad })).blockers.includes(RUNNER_BLOCKERS.RUNNER_LEDGER_EVIDENCE_UNAVAILABLE), JSON.stringify(bad));
      }
    });
    it('a malformed ledger record fails closed with its index', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ ledgerRecords: [{ migration_id: '20260101000000_a' }] }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_LEDGER_RECORD_INVALID:')));
    });
  });

  describe('3. Preflight: ledger must be an exact committed prefix', () => {
    it('a prior record checksum mismatch fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ ledgerRecords: [rec('20260101000000_a', 'sha256:WRONG')] }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_APPLIED_CHECKSUM_MISMATCH:20260101000000_a')));
    });
    it('a reordered ledger fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        targetMigrationId: '20260104000000_destruct',
        ledgerRecords: [rec('20260102000000_b', 'sha256:bb'), rec('20260101000000_a', 'sha256:aa')]
      }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_LEDGER_ORDER_MISMATCH:')));
    });
    it('a missing middle record fails closed (sequence blocked)', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        targetMigrationId: '20260104000000_destruct',
        ledgerRecords: [rec('20260101000000_a', 'sha256:aa')]
      }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_SEQUENCE_BLOCKED:')));
    });
    it('a later migration already applied fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        targetMigrationId: '20260102000000_b',
        ledgerRecords: [rec('20260101000000_a', 'sha256:aa'), rec('20260103000000_c', 'sha256:cc')]
      }));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.FAIL_CLOSED);
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_LEDGER_ORDER_MISMATCH:')));
    });
    it('an unknown ledger migration (outside manifest) fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        ledgerRecords: [rec('20260101000000_a', 'sha256:aa'), rec('99999999999999_zzz', 'sha256:zz')]
      }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_UNKNOWN_LEDGER_MIGRATION:')));
    });
    it('a duplicate ledger ID fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        targetMigrationId: '20260103000000_c',
        ledgerRecords: [rec('20260101000000_a', 'sha256:aa'), rec('20260101000000_a', 'sha256:aa')]
      }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_DUPLICATE_LEDGER_MIGRATION:')));
    });
    it('a prior non-committed outcome fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ ledgerRecords: [rec('20260101000000_a', 'sha256:aa', 'FAILED')] }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_PRIOR_OUTCOME_NOT_COMMITTED:20260101000000_a:FAILED')));
    });
  });

  describe('4. Preflight: NOOP requires a fully valid prefix', () => {
    it('exact committed target within a valid prefix is NOOP', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        targetMigrationId: '20260101000000_a',
        ledgerRecords: [rec('20260101000000_a', 'sha256:aa')]
      }));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.NOOP_ALREADY_APPLIED);
      assert.strictEqual(r.recoveryDecision, RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
    });
    it('exact committed target + unknown record is NOT NOOP', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        targetMigrationId: '20260101000000_a',
        ledgerRecords: [rec('20260101000000_a', 'sha256:aa'), rec('99999999999999_zzz', 'sha256:zz')]
      }));
      assert.notStrictEqual(r.decision, RUNNER_DECISIONS.NOOP_ALREADY_APPLIED);
      assert.strictEqual(r.decision, RUNNER_DECISIONS.FAIL_CLOSED);
    });
    it('exact committed target + duplicate record is NOT NOOP', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        targetMigrationId: '20260101000000_a',
        ledgerRecords: [rec('20260101000000_a', 'sha256:aa'), rec('20260101000000_a', 'sha256:aa')]
      }));
      assert.notStrictEqual(r.decision, RUNNER_DECISIONS.NOOP_ALREADY_APPLIED);
    });
    it('exact committed target + reordered ledger is NOT NOOP', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({
        targetMigrationId: '20260102000000_b',
        ledgerRecords: [rec('20260102000000_b', 'sha256:bb'), rec('20260101000000_a', 'sha256:aa')]
      }));
      assert.notStrictEqual(r.decision, RUNNER_DECISIONS.NOOP_ALREADY_APPLIED);
    });
  });

  describe('5. Preflight: exact next migration and dependencies', () => {
    it('first migration with a valid empty ledger is READY_TO_EXECUTE', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ targetMigrationId: '20260101000000_a', ledgerRecords: [] }));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.READY_TO_EXECUTE);
    });
    it('the next unapplied migration is READY_TO_EXECUTE', () => {
      const r = core.evaluateMigrationPreflight(validPreflight());
      assert.strictEqual(r.decision, RUNNER_DECISIONS.READY_TO_EXECUTE);
    });
    it('a target that is not the next unapplied fails (missing prefix)', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ targetMigrationId: '20260103000000_c', ledgerRecords: [rec('20260101000000_a', 'sha256:aa')] }));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.FAIL_CLOSED);
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_SEQUENCE_BLOCKED:')));
    });
    it('an unapplied dependency blocks with target and dependency in the blocker', () => {
      // Target b is the next unapplied migration, but one of its dependencies is
      // not present in the committed prefix.
      const manifest = MANIFEST.map((m) => (m.id === '20260102000000_b' ? { ...m, depends_on: ['20260101000000_a', '20260109000000_missing'] } : m));
      const r = core.evaluateMigrationPreflight(validPreflight({ manifestMigrations: manifest, targetMigrationId: '20260102000000_b', ledgerRecords: [rec('20260101000000_a', 'sha256:aa')] }));
      assert.ok(r.blockers.includes('RUNNER_DEPENDENCY_NOT_APPLIED:20260102000000_b:20260109000000_missing'), r.blockers.join('\n'));
    });
    it('an unknown target migration fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ targetMigrationId: '99999999999999_z' }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_TARGET_MIGRATION_UNKNOWN:')));
    });
    it('EXPLICIT mode without an approved boundary fails closed', () => {
      const manifest = MANIFEST.map((m) => (m.id === '20260102000000_b' ? { ...m, transaction_mode: 'EXPLICIT' } : m));
      const r = core.evaluateMigrationPreflight(validPreflight({ manifestMigrations: manifest, explicitBoundaryApproved: false }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_EXPLICIT_BOUNDARY_REQUIRED));
    });
    it('a precondition that is not PASS fails closed', () => {
      assert.ok(core.evaluateMigrationPreflight(validPreflight({ preconditionStatus: 'FAIL' })).blockers.includes(RUNNER_BLOCKERS.RUNNER_PRECONDITION_FAILED));
      assert.ok(core.evaluateMigrationPreflight(validPreflight({ preconditionStatus: 'UNAVAILABLE' })).blockers.includes(RUNNER_BLOCKERS.RUNNER_PRECONDITION_UNAVAILABLE));
      assert.ok(core.evaluateMigrationPreflight(validPreflight({ preconditionStatus: 'NOT_EVALUATED' })).blockers.includes(RUNNER_BLOCKERS.RUNNER_PRECONDITION_NOT_EVALUATED));
    });
  });

  describe('6. Preflight: requested action', () => {
    it('each forbidden action as requestedAction fails closed', () => {
      for (const action of FORBIDDEN_RUNNER_ACTIONS) {
        const r = core.evaluateMigrationPreflight(validPreflight({ requestedAction: action }));
        assert.strictEqual(r.decision, RUNNER_DECISIONS.FAIL_CLOSED, action);
        assert.ok(r.blockers.includes(`RUNNER_REQUESTED_ACTION_INVALID:${action}`), action);
        assertNoForbidden(r);
      }
    });
    it('REAPPLY_COMMITTED_MIGRATION is rejected', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ requestedAction: 'REAPPLY_COMMITTED_MIGRATION' }));
      assert.ok(r.blockers.includes('RUNNER_REQUESTED_ACTION_INVALID:REAPPLY_COMMITTED_MIGRATION'));
    });
    it('an unknown requested action fails closed', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ requestedAction: 'DO_SOMETHING' }));
      assert.ok(r.blockers.includes('RUNNER_REQUESTED_ACTION_INVALID:DO_SOMETHING'));
    });
  });

  describe('7. Authorization flags', () => {
    it('READY_TO_EXECUTE authorizes execution but not ledger append', () => {
      const r = core.evaluateMigrationPreflight(validPreflight());
      assert.strictEqual(r.executionAuthorized, true);
      assert.strictEqual(r.ledgerAppendAuthorized, false);
    });
    it('NOOP authorizes neither execution nor ledger append', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ targetMigrationId: '20260101000000_a', ledgerRecords: [rec('20260101000000_a', 'sha256:aa')] }));
      assert.strictEqual(r.executionAuthorized, false);
      assert.strictEqual(r.ledgerAppendAuthorized, false);
    });
    it('FAIL_CLOSED authorizes neither execution nor ledger append', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ manifestStatus: 'ADOPTION_REQUIRED' }));
      assert.strictEqual(r.executionAuthorized, false);
      assert.strictEqual(r.ledgerAppendAuthorized, false);
    });
    it('result carries migration binding fields', () => {
      const r = core.evaluateMigrationPreflight(validPreflight());
      assert.strictEqual(r.migrationId, '20260102000000_b');
      assert.strictEqual(r.migrationChecksum, 'sha256:bb');
      assert.strictEqual(r.transactionMode, 'REQUIRED');
      assert.strictEqual(r.destructive, false);
    });
  });

  describe('8. Completion: bound to canonical preflight', () => {
    it('authorizes ledger append when bound to a canonical READY_TO_EXECUTE preflight', () => {
      const r = core.evaluateMigrationCompletion(completionFor(validPreflight()));
      assert.strictEqual(r.decision, RUNNER_DECISIONS.READY_TO_APPEND_LEDGER);
      assert.strictEqual(r.ledgerAppendAuthorized, true);
      assert.strictEqual(r.executionAuthorized, false);
      assertNoForbidden(r);
    });
    it('completion without a preflight fails closed', () => {
      const r = core.evaluateMigrationCompletion({ executionOutcome: 'SUCCEEDED', transactionOutcome: 'COMMITTED', postconditionStatus: 'PASS', advisoryLockStatus: 'ACQUIRED', migrationId: '20260102000000_b', migrationChecksum: 'sha256:bb' });
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_PREFLIGHT_NOT_AUTHORIZED));
      assert.strictEqual(r.ledgerAppendAuthorized, false);
    });
    it('a forged preflight result fails closed', () => {
      const forgedInput = validPreflight({ manifestStatus: 'ADOPTION_REQUIRED' }); // canonical = FAIL_CLOSED
      const fakeResult = { decision: 'READY_TO_EXECUTE', blockers: [], recoveryDecision: 'NO_RECOVERY_ACTION', migrationId: '20260102000000_b', migrationChecksum: 'sha256:bb', transactionMode: 'REQUIRED', destructive: false, executionAuthorized: true, ledgerAppendAuthorized: false };
      const r = core.evaluateMigrationCompletion({ preflightInput: forgedInput, preflightResult: fakeResult, executionOutcome: 'SUCCEEDED', transactionOutcome: 'COMMITTED', postconditionStatus: 'PASS', advisoryLockStatus: 'ACQUIRED', migrationId: '20260102000000_b', migrationChecksum: 'sha256:bb', ledgerAppendAuthorized: true });
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_PREFLIGHT_NOT_AUTHORIZED));
      assert.strictEqual(r.ledgerAppendAuthorized, false);
    });
    it('a preflight ID mismatch fails closed', () => {
      const r = core.evaluateMigrationCompletion(completionFor(validPreflight(), { migrationId: '20260101000000_a' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_PREFLIGHT_NOT_AUTHORIZED));
    });
    it('a preflight checksum mismatch fails closed', () => {
      const r = core.evaluateMigrationCompletion(completionFor(validPreflight(), { migrationChecksum: 'sha256:WRONG' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_PREFLIGHT_NOT_AUTHORIZED));
    });
    it('caller-supplied ledgerAppendAuthorized=true is ignored', () => {
      const r = core.evaluateMigrationCompletion(completionFor(validPreflight(), { ledgerAppendAuthorized: true, advisoryLockStatus: 'LOST' }));
      assert.strictEqual(r.ledgerAppendAuthorized, false);
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_ADVISORY_LOCK_LOST));
    });
  });

  describe('9. Completion: outcomes and recovery', () => {
    it('lock LOST fails closed', () => {
      const r = core.evaluateMigrationCompletion(completionFor(validPreflight(), { advisoryLockStatus: 'LOST' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_ADVISORY_LOCK_LOST));
    });
    it('execution NOT_RUN fails closed', () => {
      const r = core.evaluateMigrationCompletion(completionFor(validPreflight(), { executionOutcome: 'NOT_RUN' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_EXECUTION_FAILED));
    });
    it('execution UNKNOWN fails closed', () => {
      const r = core.evaluateMigrationCompletion(completionFor(validPreflight(), { executionOutcome: 'UNKNOWN' }));
      assert.ok(r.blockers.includes(RUNNER_BLOCKERS.RUNNER_EXECUTION_OUTCOME_UNKNOWN));
    });
    it('transaction NOT_EVALUATED fails closed', () => {
      const r = core.evaluateMigrationCompletion(completionFor(validPreflight(), { transactionOutcome: 'NOT_EVALUATED' }));
      assert.ok(r.blockers.some((b) => b.startsWith('RUNNER_TRANSACTION_OUTCOME_NOT_COMMITTED:')));
    });
    it('postcondition FAIL/UNAVAILABLE/NOT_EVALUATED fail closed', () => {
      assert.ok(core.evaluateMigrationCompletion(completionFor(validPreflight(), { postconditionStatus: 'FAIL' })).blockers.includes(RUNNER_BLOCKERS.RUNNER_POSTCONDITION_FAILED));
      assert.ok(core.evaluateMigrationCompletion(completionFor(validPreflight(), { postconditionStatus: 'UNAVAILABLE' })).blockers.includes(RUNNER_BLOCKERS.RUNNER_POSTCONDITION_UNAVAILABLE));
      assert.ok(core.evaluateMigrationCompletion(completionFor(validPreflight(), { postconditionStatus: 'NOT_EVALUATED' })).blockers.includes(RUNNER_BLOCKERS.RUNNER_POSTCONDITION_NOT_EVALUATED));
    });
    it('REQUIRED FAILED + ROLLED_BACK requires a fresh preflight', () => {
      const r = core.evaluateMigrationCompletion(completionFor(validPreflight(), { executionOutcome: 'FAILED', transactionOutcome: 'ROLLED_BACK' }));
      assert.strictEqual(r.recoveryDecision, RECOVERY_DECISIONS.RETRY_REQUIRES_FRESH_PREFLIGHT);
    });
    it('REQUIRED PARTIAL ordinary requires manual reconciliation', () => {
      const r = core.evaluateMigrationCompletion(completionFor(validPreflight(), { transactionOutcome: 'PARTIAL' }));
      assert.strictEqual(r.recoveryDecision, RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED);
    });
    it('REQUIRED PARTIAL destructive escalates to snapshot restore decision', () => {
      const input = validPreflight({ targetMigrationId: '20260104000000_destruct', ledgerRecords: [rec('20260101000000_a', 'sha256:aa'), rec('20260102000000_b', 'sha256:bb'), rec('20260103000000_c', 'sha256:cc')] });
      const r = core.evaluateMigrationCompletion(completionFor(input, { transactionOutcome: 'PARTIAL' }));
      assert.strictEqual(r.destructive, true);
      assert.strictEqual(r.recoveryDecision, RECOVERY_DECISIONS.SNAPSHOT_RESTORE_DECISION_REQUIRED);
    });
    it('REQUIRED UNKNOWN destructive escalates to snapshot restore decision', () => {
      const input = validPreflight({ targetMigrationId: '20260104000000_destruct', ledgerRecords: [rec('20260101000000_a', 'sha256:aa'), rec('20260102000000_b', 'sha256:bb'), rec('20260103000000_c', 'sha256:cc')] });
      const r = core.evaluateMigrationCompletion(completionFor(input, { transactionOutcome: 'UNKNOWN' }));
      assert.strictEqual(r.recoveryDecision, RECOVERY_DECISIONS.SNAPSHOT_RESTORE_DECISION_REQUIRED);
    });
    it('PROHIBITED non-committed requires manual reconciliation', () => {
      const manifest = MANIFEST.map((m) => (m.id === '20260102000000_b' ? { ...m, transaction_mode: 'PROHIBITED' } : m));
      const r = core.evaluateMigrationCompletion(completionFor(validPreflight({ manifestMigrations: manifest }), { transactionOutcome: 'PARTIAL' }));
      assert.strictEqual(r.recoveryDecision, RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED);
    });
    it('EXPLICIT non-committed requires manual reconciliation', () => {
      const manifest = MANIFEST.map((m) => (m.id === '20260102000000_b' ? { ...m, transaction_mode: 'EXPLICIT' } : m));
      const r = core.evaluateMigrationCompletion(completionFor(validPreflight({ manifestMigrations: manifest, explicitBoundaryApproved: true }), { executionOutcome: 'UNKNOWN', transactionOutcome: 'UNKNOWN' }));
      assert.strictEqual(r.recoveryDecision, RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED);
    });
  });

  describe('10. Protocol invariants', () => {
    it('is deterministic for repeated identical input', () => {
      const input = validPreflight();
      assert.deepStrictEqual(core.evaluateMigrationPreflight(input), core.evaluateMigrationPreflight(input));
      const cInput = completionFor(validPreflight());
      assert.deepStrictEqual(core.evaluateMigrationCompletion(cInput), core.evaluateMigrationCompletion(cInput));
    });
    it('does not mutate its input objects', () => {
      const input = validPreflight();
      const before = JSON.parse(JSON.stringify(input));
      core.evaluateMigrationPreflight(input);
      assert.deepStrictEqual(input, before);
    });
    it('blockers are sorted and de-duplicated', () => {
      const r = core.evaluateMigrationPreflight(validPreflight({ manifestStatus: 'ADOPTION_REQUIRED', sourceValidationStatus: 'FAIL', preconditionStatus: 'FAIL', ledgerRecords: [] }));
      assert.deepStrictEqual(r.blockers, [...new Set(r.blockers)].sort());
    });
    it('never returns a forbidden action across many outcomes', () => {
      const samples = [
        core.evaluateMigrationPreflight(validPreflight()),
        core.evaluateMigrationPreflight(validPreflight({ requestedAction: 'RUN_DOWN_MIGRATION' })),
        core.evaluateMigrationPreflight(validPreflight({ targetMigrationId: '20260101000000_a', ledgerRecords: [rec('20260101000000_a', 'sha256:aa')] })),
        core.evaluateMigrationCompletion(completionFor(validPreflight())),
        core.evaluateMigrationCompletion(completionFor(validPreflight(), { transactionOutcome: 'PARTIAL' }))
      ];
      for (const r of samples) assertNoForbidden(r);
    });
  });

  describe('11. Source-only safety boundary', () => {
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
