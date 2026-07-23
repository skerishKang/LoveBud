'use strict';

/**
 * Canonical migration runner PROTOCOL contract (#3458, fourth slice).
 *
 * This is a pure, deterministic, source-only contract. It is NOT a migration
 * runner. It performs NO database connection, NO SQL execution, NO ledger
 * write, and NO advisory lock acquisition. It receives bounded pure-input state
 * and returns a deterministic decision plus blockers and a bounded recovery
 * decision.
 *
 * Two pure entry points:
 *   - evaluateMigrationPreflight(input): fail-closed gate evaluated BEFORE any
 *     migration execution. Decides FAIL_CLOSED, NOOP_ALREADY_APPLIED, or
 *     READY_TO_EXECUTE.
 *   - evaluateMigrationCompletion(input): gate evaluated AFTER execution.
 *     Decides READY_TO_APPEND_LEDGER or FAIL_CLOSED. A successful execution
 *     alone never authorizes a ledger append.
 *
 * The planner NEVER returns a down-migration, an automatic rollback of an
 * applied migration, a ledger record deletion, or a ledger history rewrite
 * (see FORBIDDEN_RUNNER_ACTIONS).
 */

// Top-level runner decisions.
const RUNNER_DECISIONS = Object.freeze({
  FAIL_CLOSED: 'FAIL_CLOSED',
  NOOP_ALREADY_APPLIED: 'NOOP_ALREADY_APPLIED',
  READY_TO_EXECUTE: 'READY_TO_EXECUTE',
  READY_TO_APPEND_LEDGER: 'READY_TO_APPEND_LEDGER'
});

// Bounded recovery decisions. These are the ONLY recovery states the planner may
// return. None of them executes SQL, restores a snapshot, or rewrites history;
// they are decisions for a separately approved operator/process.
const RECOVERY_DECISIONS = Object.freeze({
  NO_RECOVERY_ACTION: 'NO_RECOVERY_ACTION',
  RETRY_REQUIRES_FRESH_PREFLIGHT: 'RETRY_REQUIRES_FRESH_PREFLIGHT',
  FORWARD_FIX_REQUIRED: 'FORWARD_FIX_REQUIRED',
  MANUAL_RECONCILIATION_REQUIRED: 'MANUAL_RECONCILIATION_REQUIRED',
  SNAPSHOT_RESTORE_DECISION_REQUIRED: 'SNAPSHOT_RESTORE_DECISION_REQUIRED'
});

// Actions the runner planner must NEVER return.
const FORBIDDEN_RUNNER_ACTIONS = Object.freeze([
  'RUN_DOWN_MIGRATION',
  'AUTO_ROLLBACK_APPLIED_MIGRATION',
  'DELETE_LEDGER_RECORD',
  'REWRITE_LEDGER_HISTORY'
]);

// Source validation statuses (produced by the provenance gate).
const SOURCE_VALIDATION_STATUSES = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL'
});

// Advisory lock statuses. The core never acquires a lock; it only receives state.
const ADVISORY_LOCK_STATUSES = Object.freeze({
  ACQUIRED: 'ACQUIRED',
  UNAVAILABLE: 'UNAVAILABLE',
  FAILED: 'FAILED',
  NOT_ATTEMPTED: 'NOT_ATTEMPTED'
});

// Precondition / postcondition statuses.
const CONDITION_STATUSES = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  UNAVAILABLE: 'UNAVAILABLE',
  NOT_EVALUATED: 'NOT_EVALUATED'
});

// Migration execution outcomes.
const EXECUTION_OUTCOMES = Object.freeze({
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
  UNKNOWN: 'UNKNOWN'
});

// Transaction outcomes.
const TRANSACTION_OUTCOMES = Object.freeze({
  COMMITTED: 'COMMITTED',
  ROLLED_BACK: 'ROLLED_BACK',
  PARTIAL: 'PARTIAL',
  UNKNOWN: 'UNKNOWN'
});

// Transaction modes (existing vocabulary).
const TRANSACTION_MODES = Object.freeze({
  REQUIRED: 'REQUIRED',
  PROHIBITED: 'PROHIBITED',
  EXPLICIT: 'EXPLICIT'
});

const COMMITTED = 'COMMITTED';

// Runner blocker codes.
const RUNNER_BLOCKERS = Object.freeze({
  RUNNER_SOURCE_VALIDATION_FAILED: 'RUNNER_SOURCE_VALIDATION_FAILED',
  RUNNER_ADVISORY_LOCK_REQUIRED: 'RUNNER_ADVISORY_LOCK_REQUIRED',
  RUNNER_SEQUENCE_BLOCKED: 'RUNNER_SEQUENCE_BLOCKED',
  RUNNER_DEPENDENCY_NOT_APPLIED: 'RUNNER_DEPENDENCY_NOT_APPLIED',
  RUNNER_UNKNOWN_LEDGER_MIGRATION: 'RUNNER_UNKNOWN_LEDGER_MIGRATION',
  RUNNER_DUPLICATE_LEDGER_MIGRATION: 'RUNNER_DUPLICATE_LEDGER_MIGRATION',
  RUNNER_PRIOR_OUTCOME_NOT_COMMITTED: 'RUNNER_PRIOR_OUTCOME_NOT_COMMITTED',
  RUNNER_APPLIED_CHECKSUM_MISMATCH: 'RUNNER_APPLIED_CHECKSUM_MISMATCH',
  RUNNER_EXISTING_NON_COMMITTED_OUTCOME: 'RUNNER_EXISTING_NON_COMMITTED_OUTCOME',
  RUNNER_EXPLICIT_BOUNDARY_REQUIRED: 'RUNNER_EXPLICIT_BOUNDARY_REQUIRED',
  RUNNER_TRANSACTION_MODE_INVALID: 'RUNNER_TRANSACTION_MODE_INVALID',
  RUNNER_PRECONDITION_FAILED: 'RUNNER_PRECONDITION_FAILED',
  RUNNER_PRECONDITION_UNAVAILABLE: 'RUNNER_PRECONDITION_UNAVAILABLE',
  RUNNER_PRECONDITION_NOT_EVALUATED: 'RUNNER_PRECONDITION_NOT_EVALUATED',
  RUNNER_POSTCONDITION_FAILED: 'RUNNER_POSTCONDITION_FAILED',
  RUNNER_POSTCONDITION_UNAVAILABLE: 'RUNNER_POSTCONDITION_UNAVAILABLE',
  RUNNER_POSTCONDITION_NOT_EVALUATED: 'RUNNER_POSTCONDITION_NOT_EVALUATED',
  RUNNER_EXECUTION_OUTCOME_UNKNOWN: 'RUNNER_EXECUTION_OUTCOME_UNKNOWN',
  RUNNER_EXECUTION_OUTCOME_NOT_SUCCEEDED: 'RUNNER_EXECUTION_OUTCOME_NOT_SUCCEEDED',
  RUNNER_TRANSACTION_OUTCOME_NOT_COMMITTED: 'RUNNER_TRANSACTION_OUTCOME_NOT_COMMITTED',
  RUNNER_LEDGER_APPEND_NOT_AUTHORIZED: 'RUNNER_LEDGER_APPEND_NOT_AUTHORIZED'
});

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort();
}

function failClosed(blockers, recovery) {
  return { decision: RUNNER_DECISIONS.FAIL_CLOSED, blockers: uniqueSorted(blockers), recovery };
}

function preflightRecovery(blockers) {
  if (blockers.some((b) => b.startsWith(RUNNER_BLOCKERS.RUNNER_APPLIED_CHECKSUM_MISMATCH))) {
    return RECOVERY_DECISIONS.FORWARD_FIX_REQUIRED;
  }
  if (blockers.some((b) => b.startsWith(RUNNER_BLOCKERS.RUNNER_EXISTING_NON_COMMITTED_OUTCOME)
    || b.startsWith(RUNNER_BLOCKERS.RUNNER_UNKNOWN_LEDGER_MIGRATION)
    || b.startsWith(RUNNER_BLOCKERS.RUNNER_DUPLICATE_LEDGER_MIGRATION))) {
    return RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED;
  }
  return RECOVERY_DECISIONS.RETRY_REQUIRES_FRESH_PREFLIGHT;
}

function completionRecovery(input, blockers) {
  if (blockers.some((b) => b.startsWith(RUNNER_BLOCKERS.RUNNER_APPLIED_CHECKSUM_MISMATCH))) {
    return RECOVERY_DECISIONS.FORWARD_FIX_REQUIRED;
  }
  const mode = input.transactionMode;
  const executionNotSucceeded = input.executionOutcome !== EXECUTION_OUTCOMES.SUCCEEDED;
  if ((mode === TRANSACTION_MODES.PROHIBITED || mode === TRANSACTION_MODES.EXPLICIT) && executionNotSucceeded) {
    // Partial application cannot be determined statically for PROHIBITED/EXPLICIT.
    return RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED;
  }
  if (mode === TRANSACTION_MODES.REQUIRED && input.transactionOutcome === TRANSACTION_OUTCOMES.ROLLED_BACK) {
    // A proven ROLLED_BACK REQUIRED transaction is not auto-retried; the next
    // invocation must run a fresh full preflight.
    return RECOVERY_DECISIONS.RETRY_REQUIRES_FRESH_PREFLIGHT;
  }
  return RECOVERY_DECISIONS.RETRY_REQUIRES_FRESH_PREFLIGHT;
}

/**
 * Fail-closed preflight evaluated BEFORE executing a canonical migration.
 *
 * Pure input (bounded state only; no DB access):
 *   sourceValidation:      SOURCE_VALIDATION_STATUSES
 *   advisoryLock:          ADVISORY_LOCK_STATUSES
 *   precondition:          CONDITION_STATUSES
 *   migration:             { id, checksum, transactionMode, dependsOn[], explicitBoundaryApproved }
 *   manifestOrder:         [{ id, checksum }] in canonical order
 *   ledger:                [{ migration_id, content_checksum, transaction_outcome }]
 *
 * Returns { decision, blockers, recovery } where decision is one of
 * FAIL_CLOSED, NOOP_ALREADY_APPLIED, or READY_TO_EXECUTE.
 */
function evaluateMigrationPreflight(input) {
  const i = input || {};
  const migration = i.migration || {};
  const migrationId = migration.id;
  const manifestOrder = Array.isArray(i.manifestOrder) ? i.manifestOrder : [];
  const ledger = Array.isArray(i.ledger) ? i.ledger : [];

  // 1. Source validation must PASS. Fail closed and make no execution plan.
  if (i.sourceValidation !== SOURCE_VALIDATION_STATUSES.PASS) {
    return failClosed([RUNNER_BLOCKERS.RUNNER_SOURCE_VALIDATION_FAILED], RECOVERY_DECISIONS.RETRY_REQUIRES_FRESH_PREFLIGHT);
  }

  // 2. Advisory lock must be ACQUIRED before any ledger/migration evaluation.
  if (i.advisoryLock !== ADVISORY_LOCK_STATUSES.ACQUIRED) {
    return failClosed([RUNNER_BLOCKERS.RUNNER_ADVISORY_LOCK_REQUIRED], RECOVERY_DECISIONS.RETRY_REQUIRES_FRESH_PREFLIGHT);
  }

  const blockers = [];

  // Index ledger records by migration_id.
  const ledgerById = new Map();
  const ledgerIdCounts = new Map();
  const manifestIds = new Set(manifestOrder.map((m) => m && m.id));
  for (const record of ledger) {
    const rid = record && record.migration_id;
    ledgerIdCounts.set(rid, (ledgerIdCounts.get(rid) || 0) + 1);
    if (!ledgerById.has(rid)) ledgerById.set(rid, record);
  }

  // 3. Ledger integrity: unknown migrations and duplicate IDs.
  for (const record of ledger) {
    const rid = record && record.migration_id;
    if (!manifestIds.has(rid)) {
      blockers.push(`${RUNNER_BLOCKERS.RUNNER_UNKNOWN_LEDGER_MIGRATION}:${rid}`);
    }
  }
  for (const [rid, count] of ledgerIdCounts) {
    if (count > 1) blockers.push(`${RUNNER_BLOCKERS.RUNNER_DUPLICATE_LEDGER_MIGRATION}:${rid}`);
  }

  // 4. Idempotent retry: if this migration ID is already in the ledger.
  if (ledgerById.has(migrationId)) {
    const existing = ledgerById.get(migrationId);
    const outcome = existing && existing.transaction_outcome;
    if (outcome === COMMITTED && existing.content_checksum === migration.checksum) {
      // Exact committed match: no-op. Do not re-execute or re-append.
      return { decision: RUNNER_DECISIONS.NOOP_ALREADY_APPLIED, blockers: [], recovery: RECOVERY_DECISIONS.NO_RECOVERY_ACTION };
    }
    if (existing.content_checksum !== migration.checksum) {
      blockers.push(`${RUNNER_BLOCKERS.RUNNER_APPLIED_CHECKSUM_MISMATCH}:${migrationId}`);
    }
    if (outcome !== COMMITTED) {
      blockers.push(`${RUNNER_BLOCKERS.RUNNER_EXISTING_NON_COMMITTED_OUTCOME}:${migrationId}:${outcome}`);
    }
  }

  // 5. Canonical sequence: every prior manifest migration must be applied and
  //    committed; the migration itself must exist in the manifest.
  const manifestIndex = manifestOrder.findIndex((m) => m && m.id === migrationId);
  if (manifestIndex === -1) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_SEQUENCE_BLOCKED);
  } else {
    for (let idx = 0; idx < manifestIndex; idx += 1) {
      const priorId = manifestOrder[idx] && manifestOrder[idx].id;
      if (!ledgerById.has(priorId)) {
        blockers.push(`${RUNNER_BLOCKERS.RUNNER_DEPENDENCY_NOT_APPLIED}:${priorId}`);
      } else if (ledgerById.get(priorId).transaction_outcome !== COMMITTED) {
        blockers.push(`${RUNNER_BLOCKERS.RUNNER_PRIOR_OUTCOME_NOT_COMMITTED}:${priorId}`);
      }
    }
  }

  // 6. Declared dependencies must be applied and committed.
  const dependsOn = Array.isArray(migration.dependsOn) ? migration.dependsOn : [];
  for (const depId of dependsOn) {
    if (!ledgerById.has(depId)) {
      blockers.push(`${RUNNER_BLOCKERS.RUNNER_DEPENDENCY_NOT_APPLIED}:${depId}`);
    } else if (ledgerById.get(depId).transaction_outcome !== COMMITTED) {
      blockers.push(`${RUNNER_BLOCKERS.RUNNER_PRIOR_OUTCOME_NOT_COMMITTED}:${depId}`);
    }
  }

  // 7. Transaction mode.
  const mode = migration.transactionMode;
  if (mode !== TRANSACTION_MODES.REQUIRED && mode !== TRANSACTION_MODES.PROHIBITED && mode !== TRANSACTION_MODES.EXPLICIT) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_TRANSACTION_MODE_INVALID);
  } else if (mode === TRANSACTION_MODES.EXPLICIT && migration.explicitBoundaryApproved !== true) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_EXPLICIT_BOUNDARY_REQUIRED);
  }

  // 8. Precondition must be exactly PASS before execution.
  if (i.precondition === CONDITION_STATUSES.FAIL) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_PRECONDITION_FAILED);
  } else if (i.precondition === CONDITION_STATUSES.UNAVAILABLE) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_PRECONDITION_UNAVAILABLE);
  } else if (i.precondition !== CONDITION_STATUSES.PASS) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_PRECONDITION_NOT_EVALUATED);
  }

  if (blockers.length > 0) {
    return failClosed(blockers, preflightRecovery(blockers));
  }
  return { decision: RUNNER_DECISIONS.READY_TO_EXECUTE, blockers: [], recovery: RECOVERY_DECISIONS.NO_RECOVERY_ACTION };
}

/**
 * Gate evaluated AFTER executing a canonical migration. A successful execution
 * alone never authorizes a ledger append; every condition below must hold.
 *
 * Pure input (bounded state only; no DB access):
 *   sourceValidation:  SOURCE_VALIDATION_STATUSES
 *   advisoryLock:      ADVISORY_LOCK_STATUSES
 *   priorSequenceValid: boolean
 *   migrationId:       string
 *   migrationChecksum: string (checksum of the executed migration)
 *   manifestChecksum:  string (expected checksum from the manifest)
 *   executionOutcome:  EXECUTION_OUTCOMES
 *   transactionOutcome: TRANSACTION_OUTCOMES
 *   transactionMode:   TRANSACTION_MODES
 *   postcondition:     CONDITION_STATUSES
 *
 * Returns { decision, blockers, recovery } where decision is
 * READY_TO_APPEND_LEDGER or FAIL_CLOSED. No ledger write is performed.
 */
function evaluateMigrationCompletion(input) {
  const i = input || {};
  const blockers = [];

  if (i.sourceValidation !== SOURCE_VALIDATION_STATUSES.PASS) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_SOURCE_VALIDATION_FAILED);
  }
  if (i.advisoryLock !== ADVISORY_LOCK_STATUSES.ACQUIRED) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_ADVISORY_LOCK_REQUIRED);
  }
  if (i.priorSequenceValid !== true) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_SEQUENCE_BLOCKED);
  }
  if (i.migrationChecksum !== i.manifestChecksum) {
    blockers.push(`${RUNNER_BLOCKERS.RUNNER_APPLIED_CHECKSUM_MISMATCH}:${i.migrationId}`);
  }
  if (i.executionOutcome === EXECUTION_OUTCOMES.UNKNOWN) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_EXECUTION_OUTCOME_UNKNOWN);
  } else if (i.executionOutcome !== EXECUTION_OUTCOMES.SUCCEEDED) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_EXECUTION_OUTCOME_NOT_SUCCEEDED);
  }
  if (i.transactionOutcome !== TRANSACTION_OUTCOMES.COMMITTED) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_TRANSACTION_OUTCOME_NOT_COMMITTED);
  }
  if (i.postcondition === CONDITION_STATUSES.FAIL) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_POSTCONDITION_FAILED);
  } else if (i.postcondition === CONDITION_STATUSES.UNAVAILABLE) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_POSTCONDITION_UNAVAILABLE);
  } else if (i.postcondition !== CONDITION_STATUSES.PASS) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_POSTCONDITION_NOT_EVALUATED);
  }

  if (blockers.length > 0) {
    return failClosed(blockers, completionRecovery(i, blockers));
  }
  return { decision: RUNNER_DECISIONS.READY_TO_APPEND_LEDGER, blockers: [], recovery: RECOVERY_DECISIONS.NO_RECOVERY_ACTION };
}

module.exports = {
  RUNNER_DECISIONS,
  RECOVERY_DECISIONS,
  FORBIDDEN_RUNNER_ACTIONS,
  SOURCE_VALIDATION_STATUSES,
  ADVISORY_LOCK_STATUSES,
  CONDITION_STATUSES,
  EXECUTION_OUTCOMES,
  TRANSACTION_OUTCOMES,
  TRANSACTION_MODES,
  RUNNER_BLOCKERS,
  evaluateMigrationPreflight,
  evaluateMigrationCompletion
};
