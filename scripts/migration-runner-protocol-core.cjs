'use strict';

/**
 * Canonical migration runner PROTOCOL contract (#3458, fourth slice).
 *
 * This is a pure, deterministic, source-only contract. It is NOT a migration
 * runner. It performs NO database connection, NO SQL execution, NO ledger
 * write, and NO advisory lock acquisition. It receives bounded pure-input state
 * and returns a deterministic decision plus blockers, a bounded recovery
 * decision, and explicit authorization flags.
 *
 * Two pure entry points:
 *   - evaluateMigrationPreflight(input): fail-closed gate evaluated BEFORE any
 *     migration execution. The target migration is derived from the manifest by
 *     id; the caller cannot override checksum/transaction mode/dependencies/
 *     destructive status. The ledger must be an exact committed prefix of the
 *     manifest. Decides FAIL_CLOSED, NOOP_ALREADY_APPLIED, or READY_TO_EXECUTE.
 *   - evaluateMigrationCompletion(input): gate evaluated AFTER execution. It is
 *     bound to a canonical preflight: it re-runs evaluateMigrationPreflight and
 *     requires the supplied preflight result to match the canonical result
 *     exactly. A forged preflight result never authorizes a ledger append. The
 *     caller-supplied ledgerAppendAuthorized flag is ignored.
 *
 * The planner NEVER returns a down-migration, an automatic rollback of an
 * applied migration, a re-application of a committed migration, a ledger record
 * deletion, or a ledger history rewrite (see FORBIDDEN_RUNNER_ACTIONS), and a
 * requestedAction other than APPLY_FORWARD fails closed.
 */

// Top-level runner decisions.
const RUNNER_DECISIONS = Object.freeze({
  FAIL_CLOSED: 'FAIL_CLOSED',
  NOOP_ALREADY_APPLIED: 'NOOP_ALREADY_APPLIED',
  READY_TO_EXECUTE: 'READY_TO_EXECUTE',
  READY_TO_APPEND_LEDGER: 'READY_TO_APPEND_LEDGER'
});

// Bounded recovery decisions. These are the ONLY recovery states the planner may
// return. None executes SQL, restores a snapshot, or rewrites history; they are
// decisions for a separately approved operator/process.
const RECOVERY_DECISIONS = Object.freeze({
  NO_RECOVERY_ACTION: 'NO_RECOVERY_ACTION',
  RETRY_REQUIRES_FRESH_PREFLIGHT: 'RETRY_REQUIRES_FRESH_PREFLIGHT',
  FORWARD_FIX_REQUIRED: 'FORWARD_FIX_REQUIRED',
  MANUAL_RECONCILIATION_REQUIRED: 'MANUAL_RECONCILIATION_REQUIRED',
  SNAPSHOT_RESTORE_DECISION_REQUIRED: 'SNAPSHOT_RESTORE_DECISION_REQUIRED'
});

// Actions the runner planner must NEVER perform. Supplying any of these as
// requestedAction fails closed.
const FORBIDDEN_RUNNER_ACTIONS = Object.freeze([
  'RUN_DOWN_MIGRATION',
  'AUTO_ROLLBACK_APPLIED_MIGRATION',
  'DELETE_LEDGER_RECORD',
  'REWRITE_LEDGER_HISTORY',
  'REAPPLY_COMMITTED_MIGRATION'
]);

// The only permitted requested action.
const REQUESTED_ACTIONS = Object.freeze({
  APPLY_FORWARD: 'APPLY_FORWARD'
});

// Source validation statuses.
const SOURCE_VALIDATION_STATUSES = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  UNAVAILABLE: 'UNAVAILABLE'
});

// Advisory lock statuses. The core never acquires a lock; it only receives state.
const ADVISORY_LOCK_STATUSES = Object.freeze({
  ACQUIRED: 'ACQUIRED',
  NOT_ATTEMPTED: 'NOT_ATTEMPTED',
  UNAVAILABLE: 'UNAVAILABLE',
  FAILED: 'FAILED',
  LOST: 'LOST'
});

// Precondition / postcondition statuses.
const CONDITION_STATUSES = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  UNAVAILABLE: 'UNAVAILABLE',
  NOT_EVALUATED: 'NOT_EVALUATED'
});

// Migration execution outcomes. Partial application is represented at the
// transaction level, not the execution level.
const EXECUTION_OUTCOMES = Object.freeze({
  NOT_RUN: 'NOT_RUN',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN'
});

// Transaction outcomes.
const TRANSACTION_OUTCOMES = Object.freeze({
  NOT_EVALUATED: 'NOT_EVALUATED',
  COMMITTED: 'COMMITTED',
  ROLLED_BACK: 'ROLLED_BACK',
  PARTIAL: 'PARTIAL',
  UNKNOWN: 'UNKNOWN'
});

// Transaction modes.
const TRANSACTION_MODES = Object.freeze({
  REQUIRED: 'REQUIRED',
  PROHIBITED: 'PROHIBITED',
  EXPLICIT: 'EXPLICIT'
});

const COMMITTED = 'COMMITTED';
const ACTIVE = 'ACTIVE';

// Authoritative ledger record schema (mirrors db/migration-provenance/ledger-contract.json).
// Every required field must be a non-empty string.
const LEDGER_REQUIRED_FIELDS = Object.freeze([
  'migration_id',
  'content_checksum',
  'applied_at',
  'runner_version',
  'environment_class',
  'deployed_commit',
  'transaction_outcome'
]);
// Prohibited fields: a ledger record carrying any of these as an own property is
// invalid regardless of value. Their values are never read, returned, or logged.
const LEDGER_PROHIBITED_FIELDS = Object.freeze([
  'operator_email',
  'operator_user_id',
  'credential',
  'connection_string',
  'raw_catalog_payload'
]);

// Runner blocker codes.
const RUNNER_BLOCKERS = Object.freeze({
  RUNNER_SOURCE_VALIDATION_FAILED: 'RUNNER_SOURCE_VALIDATION_FAILED',
  RUNNER_SOURCE_VALIDATION_UNAVAILABLE: 'RUNNER_SOURCE_VALIDATION_UNAVAILABLE',
  RUNNER_MANIFEST_NOT_ACTIVE: 'RUNNER_MANIFEST_NOT_ACTIVE',
  RUNNER_LEDGER_EVIDENCE_UNAVAILABLE: 'RUNNER_LEDGER_EVIDENCE_UNAVAILABLE',
  RUNNER_LEDGER_RECORD_INVALID: 'RUNNER_LEDGER_RECORD_INVALID',
  RUNNER_ADVISORY_LOCK_REQUIRED: 'RUNNER_ADVISORY_LOCK_REQUIRED',
  RUNNER_ADVISORY_LOCK_LOST: 'RUNNER_ADVISORY_LOCK_LOST',
  RUNNER_TARGET_MIGRATION_UNKNOWN: 'RUNNER_TARGET_MIGRATION_UNKNOWN',
  RUNNER_MANIFEST_MIGRATION_INVALID: 'RUNNER_MANIFEST_MIGRATION_INVALID',
  RUNNER_REQUESTED_ACTION_INVALID: 'RUNNER_REQUESTED_ACTION_INVALID',
  RUNNER_DUPLICATE_LEDGER_MIGRATION: 'RUNNER_DUPLICATE_LEDGER_MIGRATION',
  RUNNER_UNKNOWN_LEDGER_MIGRATION: 'RUNNER_UNKNOWN_LEDGER_MIGRATION',
  RUNNER_LEDGER_ORDER_MISMATCH: 'RUNNER_LEDGER_ORDER_MISMATCH',
  RUNNER_APPLIED_CHECKSUM_MISMATCH: 'RUNNER_APPLIED_CHECKSUM_MISMATCH',
  RUNNER_PRIOR_OUTCOME_NOT_COMMITTED: 'RUNNER_PRIOR_OUTCOME_NOT_COMMITTED',
  RUNNER_SEQUENCE_BLOCKED: 'RUNNER_SEQUENCE_BLOCKED',
  RUNNER_DEPENDENCY_NOT_APPLIED: 'RUNNER_DEPENDENCY_NOT_APPLIED',
  RUNNER_EXPLICIT_BOUNDARY_REQUIRED: 'RUNNER_EXPLICIT_BOUNDARY_REQUIRED',
  RUNNER_TRANSACTION_MODE_INVALID: 'RUNNER_TRANSACTION_MODE_INVALID',
  RUNNER_PRECONDITION_FAILED: 'RUNNER_PRECONDITION_FAILED',
  RUNNER_PRECONDITION_UNAVAILABLE: 'RUNNER_PRECONDITION_UNAVAILABLE',
  RUNNER_PRECONDITION_NOT_EVALUATED: 'RUNNER_PRECONDITION_NOT_EVALUATED',
  RUNNER_PREFLIGHT_NOT_AUTHORIZED: 'RUNNER_PREFLIGHT_NOT_AUTHORIZED',
  RUNNER_EXECUTION_FAILED: 'RUNNER_EXECUTION_FAILED',
  RUNNER_EXECUTION_OUTCOME_UNKNOWN: 'RUNNER_EXECUTION_OUTCOME_UNKNOWN',
  RUNNER_TRANSACTION_OUTCOME_NOT_COMMITTED: 'RUNNER_TRANSACTION_OUTCOME_NOT_COMMITTED',
  RUNNER_POSTCONDITION_FAILED: 'RUNNER_POSTCONDITION_FAILED',
  RUNNER_POSTCONDITION_UNAVAILABLE: 'RUNNER_POSTCONDITION_UNAVAILABLE',
  RUNNER_POSTCONDITION_NOT_EVALUATED: 'RUNNER_POSTCONDITION_NOT_EVALUATED',
  RUNNER_LEDGER_APPEND_NOT_AUTHORIZED: 'RUNNER_LEDGER_APPEND_NOT_AUTHORIZED'
});

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort();
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Order-independent structural deep equality for plain objects/arrays/primitives.
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return a === b;
  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;
  if (aIsArray) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// Minimal structural validation of a manifest migration record.
function isValidManifestMigration(m) {
  return !!m
    && typeof m === 'object'
    && isNonEmptyString(m.id)
    && isNonEmptyString(m.checksum)
    && Array.isArray(m.depends_on)
    && isNonEmptyString(m.transaction_mode)
    && isNonEmptyString(m.risk_class)
    && Array.isArray(m.destructive_operations);
}

// Authoritative ledger record validation: a plain object with every required
// field present as a non-empty string, and no prohibited field present as an own
// property (regardless of value). Prohibited field values are never inspected.
function isValidLedgerRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  for (const field of LEDGER_REQUIRED_FIELDS) {
    if (!isNonEmptyString(r[field])) return false;
  }
  for (const field of LEDGER_PROHIBITED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(r, field)) return false;
  }
  return true;
}

function isDestructiveMigration(m) {
  if (!m) return false;
  if (m.risk_class === 'DESTRUCTIVE') return true;
  return Array.isArray(m.destructive_operations) && m.destructive_operations.length > 0;
}

function bindingFromTarget(targetId, target) {
  return {
    migrationId: targetId,
    migrationChecksum: target ? target.checksum : undefined,
    transactionMode: target ? target.transaction_mode : undefined,
    destructive: isDestructiveMigration(target)
  };
}

function buildResult(decision, blockers, recoveryDecision, binding) {
  return {
    decision,
    blockers: uniqueSorted(blockers),
    recoveryDecision,
    migrationId: binding.migrationId,
    migrationChecksum: binding.migrationChecksum,
    transactionMode: binding.transactionMode,
    destructive: binding.destructive,
    executionAuthorized: decision === RUNNER_DECISIONS.READY_TO_EXECUTE,
    ledgerAppendAuthorized: decision === RUNNER_DECISIONS.READY_TO_APPEND_LEDGER
  };
}

function preflightRecovery(blockers) {
  if (blockers.some((b) => b.startsWith(RUNNER_BLOCKERS.RUNNER_APPLIED_CHECKSUM_MISMATCH))) {
    return RECOVERY_DECISIONS.FORWARD_FIX_REQUIRED;
  }
  if (blockers.some((b) => b.startsWith(RUNNER_BLOCKERS.RUNNER_PRIOR_OUTCOME_NOT_COMMITTED)
    || b.startsWith(RUNNER_BLOCKERS.RUNNER_UNKNOWN_LEDGER_MIGRATION)
    || b.startsWith(RUNNER_BLOCKERS.RUNNER_DUPLICATE_LEDGER_MIGRATION)
    || b.startsWith(RUNNER_BLOCKERS.RUNNER_LEDGER_ORDER_MISMATCH)
    || b.startsWith(RUNNER_BLOCKERS.RUNNER_LEDGER_RECORD_INVALID))) {
    return RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED;
  }
  return RECOVERY_DECISIONS.RETRY_REQUIRES_FRESH_PREFLIGHT;
}

/**
 * Fail-closed preflight evaluated BEFORE executing a canonical migration.
 *
 * Pure input (bounded state only; no DB access; camelCase):
 *   sourceValidationStatus:  SOURCE_VALIDATION_STATUSES
 *   manifestStatus:          must be exactly 'ACTIVE'
 *   manifestMigrations:      [{ id, checksum, depends_on, transaction_mode, risk_class, destructive_operations }]
 *   targetMigrationId:       string (resolved against manifestMigrations)
 *   ledgerRecords:           [{ migration_id, content_checksum, applied_at, runner_version, environment_class, deployed_commit, transaction_outcome }]
 *   advisoryLockStatus:      ADVISORY_LOCK_STATUSES
 *   preconditionStatus:      CONDITION_STATUSES
 *   explicitBoundaryApproved: boolean (for EXPLICIT transaction mode)
 *   requestedAction:         must be 'APPLY_FORWARD'
 *
 * Returns { decision, blockers, recoveryDecision, migrationId, migrationChecksum,
 * transactionMode, destructive, executionAuthorized, ledgerAppendAuthorized }.
 */
function evaluateMigrationPreflight(input) {
  const i = input || {};
  const blockers = [];
  const targetId = i.targetMigrationId;
  const manifestMigrations = Array.isArray(i.manifestMigrations) ? i.manifestMigrations : [];

  // Resolve the target from the manifest (caller cannot supply a separate object).
  const targetIndex = manifestMigrations.findIndex((m) => m && m.id === targetId);
  const target = targetIndex === -1 ? null : manifestMigrations[targetIndex];
  const binding = bindingFromTarget(targetId, target);

  // 1. Requested action must be APPLY_FORWARD (forbidden/unknown actions fail closed).
  if (i.requestedAction !== REQUESTED_ACTIONS.APPLY_FORWARD) {
    blockers.push(`${RUNNER_BLOCKERS.RUNNER_REQUESTED_ACTION_INVALID}:${i.requestedAction}`);
  }

  // 2. Source validation.
  if (i.sourceValidationStatus === SOURCE_VALIDATION_STATUSES.UNAVAILABLE) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_SOURCE_VALIDATION_UNAVAILABLE);
  } else if (i.sourceValidationStatus !== SOURCE_VALIDATION_STATUSES.PASS) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_SOURCE_VALIDATION_FAILED);
  }

  // 3. Manifest must be exactly ACTIVE.
  if (i.manifestStatus !== ACTIVE) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_MANIFEST_NOT_ACTIVE);
  }

  // 4. Advisory lock must be ACQUIRED.
  if (i.advisoryLockStatus !== ADVISORY_LOCK_STATUSES.ACQUIRED) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_ADVISORY_LOCK_REQUIRED);
  }

  // 5. Ledger evidence must be an array (never coerced from missing/non-array).
  const ledgerIsArray = Array.isArray(i.ledgerRecords);
  if (!ledgerIsArray) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_LEDGER_EVIDENCE_UNAVAILABLE);
  }
  const ledgerRecords = ledgerIsArray ? i.ledgerRecords : [];

  // 6. Target must exist in the manifest and be well-formed.
  if (targetIndex === -1) {
    blockers.push(`${RUNNER_BLOCKERS.RUNNER_TARGET_MIGRATION_UNKNOWN}:${targetId}`);
  } else if (!isValidManifestMigration(target)) {
    blockers.push(`${RUNNER_BLOCKERS.RUNNER_MANIFEST_MIGRATION_INVALID}:${targetId}`);
  }

  // If ledger evidence is unavailable, fail closed here; position-based checks
  // are meaningless without a ledger and must not be silently treated as empty.
  if (!ledgerIsArray) {
    return buildResult(RUNNER_DECISIONS.FAIL_CLOSED, blockers, preflightRecovery(blockers), binding);
  }

  // 7. Validate the ledger as an exact committed prefix of the manifest.
  //    Compare ledger array index against manifest index directly.
  const prefixBlockers = [];
  const seenIds = new Set();
  for (let idx = 0; idx < ledgerRecords.length; idx += 1) {
    const record = ledgerRecords[idx];
    if (!isValidLedgerRecord(record)) {
      prefixBlockers.push(`${RUNNER_BLOCKERS.RUNNER_LEDGER_RECORD_INVALID}:${idx}`);
      continue;
    }
    const rid = record.migration_id;
    if (seenIds.has(rid)) {
      prefixBlockers.push(`${RUNNER_BLOCKERS.RUNNER_DUPLICATE_LEDGER_MIGRATION}:${rid}`);
    }
    seenIds.add(rid);
    const manifestIdx = manifestMigrations.findIndex((m) => m && m.id === rid);
    if (manifestIdx === -1) {
      prefixBlockers.push(`${RUNNER_BLOCKERS.RUNNER_UNKNOWN_LEDGER_MIGRATION}:${rid}`);
      continue;
    }
    if (manifestIdx !== idx) {
      prefixBlockers.push(`${RUNNER_BLOCKERS.RUNNER_LEDGER_ORDER_MISMATCH}:${rid}`);
    }
    const manifestEntry = manifestMigrations[manifestIdx];
    if (manifestEntry && record.content_checksum !== manifestEntry.checksum) {
      prefixBlockers.push(`${RUNNER_BLOCKERS.RUNNER_APPLIED_CHECKSUM_MISMATCH}:${rid}`);
    }
    if (record.transaction_outcome !== COMMITTED) {
      prefixBlockers.push(`${RUNNER_BLOCKERS.RUNNER_PRIOR_OUTCOME_NOT_COMMITTED}:${rid}:${record.transaction_outcome}`);
    }
  }
  if (ledgerRecords.length > manifestMigrations.length) {
    prefixBlockers.push(`${RUNNER_BLOCKERS.RUNNER_SEQUENCE_BLOCKED}:${targetId}`);
  }
  for (const b of prefixBlockers) blockers.push(b);
  const prefixValid = prefixBlockers.length === 0;

  // If the target is unknown or the manifest record is malformed, fail closed now.
  if (targetIndex === -1 || !isValidManifestMigration(target)) {
    return buildResult(RUNNER_DECISIONS.FAIL_CLOSED, blockers, preflightRecovery(blockers), binding);
  }

  const ledgerLength = ledgerRecords.length;

  // 8. Position of the target relative to the applied prefix.
  if (targetIndex < ledgerLength) {
    // Target is within the applied prefix: NOOP only if the whole prefix is valid
    // AND no earlier gate blocker was collected (requestedAction/source/manifest/
    // lock/ledger/target). NOOP never bypasses those fail-closed gates. (NOOP needs
    // no transaction-mode approval or precondition, since nothing is executed.)
    if (prefixValid && blockers.length === 0) {
      return buildResult(RUNNER_DECISIONS.NOOP_ALREADY_APPLIED, [], RECOVERY_DECISIONS.NO_RECOVERY_ACTION, binding);
    }
    return buildResult(RUNNER_DECISIONS.FAIL_CLOSED, blockers, preflightRecovery(blockers), binding);
  }

  if (targetIndex > ledgerLength) {
    // Missing prefix: migrations between the applied prefix and the target are not applied.
    for (let idx = ledgerLength; idx < targetIndex; idx += 1) {
      const missing = manifestMigrations[idx] && manifestMigrations[idx].id;
      blockers.push(`${RUNNER_BLOCKERS.RUNNER_SEQUENCE_BLOCKED}:${missing}`);
    }
    return buildResult(RUNNER_DECISIONS.FAIL_CLOSED, blockers, preflightRecovery(blockers), binding);
  }

  // 9. Target is exactly the next unapplied migration (targetIndex === ledgerLength).
  //    The applied prefix must be fully valid.
  if (!prefixValid) {
    return buildResult(RUNNER_DECISIONS.FAIL_CLOSED, blockers, preflightRecovery(blockers), binding);
  }

  // Dependencies must be inside the committed prefix with matching id/checksum.
  const appliedById = new Map();
  for (const record of ledgerRecords) {
    if (isValidLedgerRecord(record)) appliedById.set(record.migration_id, record);
  }
  const dependsOn = Array.isArray(target.depends_on) ? target.depends_on : [];
  for (const depId of dependsOn) {
    const applied = appliedById.get(depId);
    const depManifestEntry = manifestMigrations.find((m) => m && m.id === depId);
    const checksumOk = applied && depManifestEntry && applied.content_checksum === depManifestEntry.checksum;
    if (!applied || applied.transaction_outcome !== COMMITTED || !checksumOk) {
      blockers.push(`${RUNNER_BLOCKERS.RUNNER_DEPENDENCY_NOT_APPLIED}:${targetId}:${depId}`);
    }
  }

  // Transaction mode.
  const mode = target.transaction_mode;
  if (mode !== TRANSACTION_MODES.REQUIRED && mode !== TRANSACTION_MODES.PROHIBITED && mode !== TRANSACTION_MODES.EXPLICIT) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_TRANSACTION_MODE_INVALID);
  } else if (mode === TRANSACTION_MODES.EXPLICIT && i.explicitBoundaryApproved !== true) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_EXPLICIT_BOUNDARY_REQUIRED);
  }

  // Precondition must be exactly PASS.
  if (i.preconditionStatus === CONDITION_STATUSES.FAIL) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_PRECONDITION_FAILED);
  } else if (i.preconditionStatus === CONDITION_STATUSES.UNAVAILABLE) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_PRECONDITION_UNAVAILABLE);
  } else if (i.preconditionStatus !== CONDITION_STATUSES.PASS) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_PRECONDITION_NOT_EVALUATED);
  }

  if (blockers.length > 0) {
    return buildResult(RUNNER_DECISIONS.FAIL_CLOSED, blockers, preflightRecovery(blockers), binding);
  }
  return buildResult(RUNNER_DECISIONS.READY_TO_EXECUTE, [], RECOVERY_DECISIONS.NO_RECOVERY_ACTION, binding);
}

function completionRecovery(canonicalPreflight, input) {
  const mode = canonicalPreflight.transactionMode;
  const destructive = canonicalPreflight.destructive;
  const txOutcome = input.transactionOutcome;
  const execOutcome = input.executionOutcome;

  if (mode === TRANSACTION_MODES.REQUIRED) {
    if (execOutcome === EXECUTION_OUTCOMES.FAILED && txOutcome === TRANSACTION_OUTCOMES.ROLLED_BACK) {
      return RECOVERY_DECISIONS.RETRY_REQUIRES_FRESH_PREFLIGHT;
    }
    if (txOutcome === TRANSACTION_OUTCOMES.PARTIAL || txOutcome === TRANSACTION_OUTCOMES.UNKNOWN) {
      return destructive
        ? RECOVERY_DECISIONS.SNAPSHOT_RESTORE_DECISION_REQUIRED
        : RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED;
    }
  }
  if (mode === TRANSACTION_MODES.PROHIBITED || mode === TRANSACTION_MODES.EXPLICIT) {
    if (execOutcome === EXECUTION_OUTCOMES.FAILED
      || execOutcome === EXECUTION_OUTCOMES.UNKNOWN
      || txOutcome !== TRANSACTION_OUTCOMES.COMMITTED) {
      return RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED;
    }
  }
  return RECOVERY_DECISIONS.RETRY_REQUIRES_FRESH_PREFLIGHT;
}

/**
 * Gate evaluated AFTER execution, bound to a canonical preflight. A successful
 * execution alone never authorizes a ledger append.
 *
 * Pure input (bounded state only; no DB access; camelCase):
 *   preflightInput:     the exact input passed to evaluateMigrationPreflight
 *   preflightResult:    the preflight result the caller claims to have obtained
 *   executionOutcome:   EXECUTION_OUTCOMES
 *   transactionOutcome: TRANSACTION_OUTCOMES
 *   postconditionStatus: CONDITION_STATUSES
 *   advisoryLockStatus: ADVISORY_LOCK_STATUSES
 *   migrationId:        string (must match canonical preflight binding)
 *   migrationChecksum:  string (must match canonical preflight binding)
 *   ledgerAppendAuthorized: IGNORED (always recomputed)
 *
 * The canonical preflight is re-evaluated internally; the supplied preflightResult
 * must match it exactly, the canonical decision must be READY_TO_EXECUTE with no
 * blockers and executionAuthorized=true, and the id/checksum binding must match.
 * Otherwise RUNNER_PREFLIGHT_NOT_AUTHORIZED fails closed. No ledger write is done.
 */
function evaluateMigrationCompletion(input) {
  const i = input || {};
  const blockers = [];

  // 1. Re-run the canonical preflight and bind to it.
  const canonical = evaluateMigrationPreflight(i.preflightInput);
  const binding = {
    migrationId: canonical.migrationId,
    migrationChecksum: canonical.migrationChecksum,
    transactionMode: canonical.transactionMode,
    destructive: canonical.destructive
  };

  // 2. The supplied preflight result must be exactly the canonical result, the
  //    canonical decision must authorize execution, and the id/checksum must bind.
  const supplied = i.preflightResult;
  const preflightAuthorized = !!supplied
    && deepEqual(supplied, canonical)
    && canonical.decision === RUNNER_DECISIONS.READY_TO_EXECUTE
    && canonical.blockers.length === 0
    && canonical.executionAuthorized === true
    && i.migrationId === canonical.migrationId
    && i.migrationChecksum === canonical.migrationChecksum;
  if (!preflightAuthorized) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_PREFLIGHT_NOT_AUTHORIZED);
  }

  // 3. Advisory lock must still be ACQUIRED (LOST or any non-ACQUIRED fails closed).
  if (i.advisoryLockStatus !== ADVISORY_LOCK_STATUSES.ACQUIRED) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_ADVISORY_LOCK_LOST);
  }

  // 4. Execution outcome must be SUCCEEDED.
  if (i.executionOutcome === EXECUTION_OUTCOMES.UNKNOWN) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_EXECUTION_OUTCOME_UNKNOWN);
  } else if (i.executionOutcome !== EXECUTION_OUTCOMES.SUCCEEDED) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_EXECUTION_FAILED);
  }

  // 5. Transaction outcome must be COMMITTED.
  if (i.transactionOutcome !== TRANSACTION_OUTCOMES.COMMITTED) {
    blockers.push(`${RUNNER_BLOCKERS.RUNNER_TRANSACTION_OUTCOME_NOT_COMMITTED}:${i.transactionOutcome}`);
  }

  // 6. Postcondition must be exactly PASS.
  if (i.postconditionStatus === CONDITION_STATUSES.FAIL) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_POSTCONDITION_FAILED);
  } else if (i.postconditionStatus === CONDITION_STATUSES.UNAVAILABLE) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_POSTCONDITION_UNAVAILABLE);
  } else if (i.postconditionStatus !== CONDITION_STATUSES.PASS) {
    blockers.push(RUNNER_BLOCKERS.RUNNER_POSTCONDITION_NOT_EVALUATED);
  }

  if (blockers.length > 0) {
    // Compute recovery before adding the generic append blocker so the blocker
    // does not influence the recovery decision. A failed completion always carries
    // RUNNER_LEDGER_APPEND_NOT_AUTHORIZED (sorted/unique via buildResult); a
    // successful completion never does.
    const recovery = completionRecovery(canonical, i);
    blockers.push(RUNNER_BLOCKERS.RUNNER_LEDGER_APPEND_NOT_AUTHORIZED);
    return buildResult(RUNNER_DECISIONS.FAIL_CLOSED, blockers, recovery, binding);
  }
  return buildResult(RUNNER_DECISIONS.READY_TO_APPEND_LEDGER, [], RECOVERY_DECISIONS.NO_RECOVERY_ACTION, binding);
}

module.exports = {
  RUNNER_DECISIONS,
  RECOVERY_DECISIONS,
  FORBIDDEN_RUNNER_ACTIONS,
  REQUESTED_ACTIONS,
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
