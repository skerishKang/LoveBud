'use strict';

/**
 * Canonical migration runner ORCHESTRATOR contract (#3458, fifth slice).
 *
 * This is a dependency-injected async orchestrator that connects the merged pure
 * protocol (scripts/migration-runner-protocol-core.cjs) decisions into a safe
 * execution order. It is NOT a migration runner: it performs NO database
 * connection, NO SQL execution, NO real advisory lock, and NO real ledger write.
 * Every external effect is a synthetic injected dependency.
 *
 * The orchestrator never re-implements protocol decisions: it delegates to
 * evaluateMigrationPreflight and evaluateMigrationCompletion, and only sequences
 * the injected dependencies around them. All results are sanitized: no lock
 * handle, raw manifest, ledger record, SQL, error message/stack, hostname/URL,
 * credential, or operator identity ever appears in the result, events, blockers,
 * or logs.
 */

const protocol = require('./migration-runner-protocol-core.cjs');

const {
  evaluateMigrationPreflight,
  evaluateMigrationCompletion,
  RUNNER_DECISIONS,
  RECOVERY_DECISIONS,
  RUNNER_BLOCKERS
} = protocol;

const ORCHESTRATION_OUTCOMES = Object.freeze({
  BLOCKED_BEFORE_EXECUTION: 'BLOCKED_BEFORE_EXECUTION',
  NOOP_ALREADY_APPLIED: 'NOOP_ALREADY_APPLIED',
  COMPLETION_BLOCKED: 'COMPLETION_BLOCKED',
  LEDGER_APPEND_FAILED: 'LEDGER_APPEND_FAILED',
  EXECUTED_AND_RECORDED: 'EXECUTED_AND_RECORDED',
  LOCK_RELEASE_FAILED: 'LOCK_RELEASE_FAILED'
});

const ORCHESTRATION_STAGES = Object.freeze({
  INITIAL: 'INITIAL',
  SOURCE_VALIDATION: 'SOURCE_VALIDATION',
  MANIFEST_LOAD: 'MANIFEST_LOAD',
  LOCK_ACQUIRE: 'LOCK_ACQUIRE',
  LEDGER_READ: 'LEDGER_READ',
  PRECONDITION: 'PRECONDITION',
  PREFLIGHT: 'PREFLIGHT',
  EXECUTION: 'EXECUTION',
  POSTCONDITION: 'POSTCONDITION',
  LOCK_RECHECK: 'LOCK_RECHECK',
  COMPLETION: 'COMPLETION',
  LEDGER_APPEND: 'LEDGER_APPEND',
  LOCK_RELEASE: 'LOCK_RELEASE',
  COMPLETED: 'COMPLETED'
});

const ORCHESTRATION_BLOCKERS = Object.freeze({
  ORCHESTRATOR_RUNTIME_METADATA_INVALID: 'ORCHESTRATOR_RUNTIME_METADATA_INVALID',
  ORCHESTRATOR_DEPENDENCY_MISSING: 'ORCHESTRATOR_DEPENDENCY_MISSING',
  ORCHESTRATOR_DEPENDENCY_FAILED: 'ORCHESTRATOR_DEPENDENCY_FAILED',
  ORCHESTRATOR_DEPENDENCY_RESULT_INVALID: 'ORCHESTRATOR_DEPENDENCY_RESULT_INVALID',
  ORCHESTRATOR_CLOCK_RESULT_INVALID: 'ORCHESTRATOR_CLOCK_RESULT_INVALID',
  ORCHESTRATOR_LEDGER_APPEND_FAILED: 'ORCHESTRATOR_LEDGER_APPEND_FAILED',
  ORCHESTRATOR_LOCK_RELEASE_FAILED: 'ORCHESTRATOR_LOCK_RELEASE_FAILED'
});

const ORCHESTRATION_EVENTS = Object.freeze({
  SOURCE_VALIDATION_COMPLETED: 'SOURCE_VALIDATION_COMPLETED',
  MANIFEST_LOADED: 'MANIFEST_LOADED',
  LOCK_ACQUIRED: 'LOCK_ACQUIRED',
  LEDGER_READ: 'LEDGER_READ',
  PRECONDITION_COMPLETED: 'PRECONDITION_COMPLETED',
  PREFLIGHT_READY: 'PREFLIGHT_READY',
  PREFLIGHT_BLOCKED: 'PREFLIGHT_BLOCKED',
  PREFLIGHT_NOOP: 'PREFLIGHT_NOOP',
  EXECUTION_COMPLETED: 'EXECUTION_COMPLETED',
  POSTCONDITION_COMPLETED: 'POSTCONDITION_COMPLETED',
  LOCK_RECHECKED: 'LOCK_RECHECKED',
  COMPLETION_AUTHORIZED: 'COMPLETION_AUTHORIZED',
  COMPLETION_BLOCKED: 'COMPLETION_BLOCKED',
  LEDGER_APPENDED: 'LEDGER_APPENDED',
  LEDGER_APPEND_FAILED: 'LEDGER_APPEND_FAILED',
  LOCK_RELEASED: 'LOCK_RELEASED',
  LOCK_RELEASE_FAILED: 'LOCK_RELEASE_FAILED'
});

const EVENT_VALUES = Object.freeze(new Set(Object.values(ORCHESTRATION_EVENTS)));

const REQUIRED_DEPENDENCY_NAMES = Object.freeze([
  'validateSource',
  'loadManifest',
  'acquireAdvisoryLock',
  'readLedger',
  'evaluatePrecondition',
  'executeMigration',
  'evaluatePostcondition',
  'checkAdvisoryLock',
  'appendLedgerRecord',
  'releaseAdvisoryLock',
  'now'
]);

const SOURCE_STATUSES = new Set(['PASS', 'FAIL', 'UNAVAILABLE']);
const LOCK_ACQUIRE_STATUSES = new Set(['ACQUIRED', 'NOT_ATTEMPTED', 'UNAVAILABLE', 'FAILED']);
const CONDITION_STATUSES = new Set(['PASS', 'FAIL', 'UNAVAILABLE', 'NOT_EVALUATED']);
const LOCK_CHECK_STATUSES = new Set(['ACQUIRED', 'LOST', 'FAILED', 'UNAVAILABLE']);
const EXECUTION_OUTCOMES = new Set(['NOT_RUN', 'SUCCEEDED', 'FAILED', 'UNKNOWN']);
const TRANSACTION_OUTCOMES = new Set(['NOT_EVALUATED', 'COMMITTED', 'ROLLED_BACK', 'PARTIAL', 'UNKNOWN']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCallable(value) {
  return typeof value === 'function';
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort();
}

// A plain record object: non-null object, not an array, prototype Object.prototype
// or null. Arrays/functions carrying a `status` property are NOT plain records.
function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// A canonical timestamp is a non-empty string, Date-parseable, ending in 'Z', and
// round-trips to the same canonical ISO-8601 UTC value.
function isValidCanonicalTimestamp(value) {
  if (!isNonEmptyString(value)) return false;
  if (!value.endsWith('Z')) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString() === value;
}

function isValidExecutionResult(value) {
  return isPlainRecord(value)
    && EXECUTION_OUTCOMES.has(value.executionOutcome)
    && TRANSACTION_OUTCOMES.has(value.transactionOutcome);
}

// Call an injected dependency (sync or async) with one argument, discarding any
// error detail.
async function callDependency(fn, arg) {
  try {
    const value = await fn(arg);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, value: undefined };
  }
}

// Call a zero-argument injected dependency (sync or async), discarding error
// detail. Used for now(), whose contract takes no arguments.
async function callDependencyNoArg(fn) {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    return { ok: false, value: undefined };
  }
}

function sanitizedEvents(events) {
  return events.filter((e) => EVENT_VALUES.has(e));
}

function buildResult(state) {
  return {
    outcome: state.outcome,
    stage: state.stage,
    protocolDecision: state.protocolDecision,
    blockers: uniqueSorted(state.blockers),
    recoveryDecision: state.recoveryDecision,
    migrationId: state.migrationId,
    migrationChecksum: state.migrationChecksum,
    executionAttempted: state.executionAttempted,
    ledgerAppendAttempted: state.ledgerAppendAttempted,
    ledgerAppended: state.ledgerAppended,
    lockAcquired: state.lockAcquired,
    lockReleased: state.lockReleased,
    events: sanitizedEvents(state.events)
  };
}

/**
 * Run a canonical migration through the fail-closed orchestration protocol.
 *
 * input: {
 *   targetMigrationId, requestedAction,
 *   runtimeMetadata: { runnerVersion, environmentClass, deployedCommit },
 *   dependencies: { validateSource, loadManifest, acquireAdvisoryLock, readLedger,
 *     evaluatePrecondition, executeMigration, evaluatePostcondition,
 *     checkAdvisoryLock, appendLedgerRecord, releaseAdvisoryLock, now },
 *   explicitBoundaryApproved // optional boolean, default false
 * }
 *
 * Returns a sanitized result (see buildResult). Never throws for dependency
 * failures; all failure detail is discarded.
 */
async function runCanonicalMigration(input) {
  const inp = input || {};
  const runtimeMetadata = inp.runtimeMetadata || {};
  const deps = inp.dependencies || {};

  const state = {
    outcome: null,
    stage: ORCHESTRATION_STAGES.INITIAL,
    protocolDecision: null,
    blockers: [],
    recoveryDecision: null,
    migrationId: inp.targetMigrationId,
    migrationChecksum: undefined,
    executionAttempted: false,
    ledgerAppendAttempted: false,
    ledgerAppended: false,
    lockAcquired: false,
    lockReleased: false,
    events: [],
    terminalNormal: false
  };
  let lockHandle;
  let destructive = false;

  const addEvent = (code) => { state.events.push(code); };
  const addBlocker = (code) => { state.blockers.push(code); };
  const resultInvalid = (name) => `${ORCHESTRATION_BLOCKERS.ORCHESTRATOR_DEPENDENCY_RESULT_INVALID}:${name}`;
  const dependencyFailed = (name) => `${ORCHESTRATION_BLOCKERS.ORCHESTRATOR_DEPENDENCY_FAILED}:${name}`;

  // Fail closed before any lock is held (no release needed).
  function blockedBeforeLock(recovery) {
    state.outcome = ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION;
    state.recoveryDecision = recovery || RECOVERY_DECISIONS.NO_RECOVERY_ACTION;
    return buildResult(state);
  }

  // ---- INITIAL: validate runtime metadata and dependency presence ----
  const metadataValid = isNonEmptyString(runtimeMetadata.runnerVersion)
    && isNonEmptyString(runtimeMetadata.environmentClass)
    && isNonEmptyString(runtimeMetadata.deployedCommit);
  if (!metadataValid) {
    addBlocker(ORCHESTRATION_BLOCKERS.ORCHESTRATOR_RUNTIME_METADATA_INVALID);
  }
  const missingDependencies = REQUIRED_DEPENDENCY_NAMES.filter((name) => !isCallable(deps[name]));
  for (const name of missingDependencies) {
    addBlocker(`${ORCHESTRATION_BLOCKERS.ORCHESTRATOR_DEPENDENCY_MISSING}:${name}`);
  }
  if (!metadataValid || missingDependencies.length > 0) {
    state.stage = ORCHESTRATION_STAGES.INITIAL;
    return blockedBeforeLock(RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
  }

  // ---- SOURCE_VALIDATION ----
  state.stage = ORCHESTRATION_STAGES.SOURCE_VALIDATION;
  const sourceResult = await callDependency(deps.validateSource, { targetMigrationId: inp.targetMigrationId });
  if (!sourceResult.ok) {
    addBlocker(dependencyFailed('validateSource'));
    return blockedBeforeLock(RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
  }
  if (!isPlainRecord(sourceResult.value)) {
    addBlocker(resultInvalid('validateSource'));
    return blockedBeforeLock(RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
  }
  const sourceStatus = sourceResult.value.status;
  if (!SOURCE_STATUSES.has(sourceStatus)) {
    addBlocker(resultInvalid('validateSource'));
    return blockedBeforeLock(RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
  }
  addEvent(ORCHESTRATION_EVENTS.SOURCE_VALIDATION_COMPLETED);
  if (sourceStatus === 'FAIL') {
    // Valid negative result: preserve the exact protocol blocker.
    addBlocker(RUNNER_BLOCKERS.RUNNER_SOURCE_VALIDATION_FAILED);
    return blockedBeforeLock(RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
  }
  if (sourceStatus === 'UNAVAILABLE') {
    addBlocker(RUNNER_BLOCKERS.RUNNER_SOURCE_VALIDATION_UNAVAILABLE);
    return blockedBeforeLock(RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
  }

  // ---- MANIFEST_LOAD ----
  state.stage = ORCHESTRATION_STAGES.MANIFEST_LOAD;
  const manifestResult = await callDependency(deps.loadManifest, { targetMigrationId: inp.targetMigrationId });
  if (!manifestResult.ok) {
    addBlocker(dependencyFailed('loadManifest'));
    return blockedBeforeLock(RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
  }
  const manifestValue = manifestResult.value;
  if (!isPlainRecord(manifestValue) || !Array.isArray(manifestValue.migrations) || !isNonEmptyString(manifestValue.status)) {
    addBlocker(resultInvalid('loadManifest'));
    return blockedBeforeLock(RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
  }
  addEvent(ORCHESTRATION_EVENTS.MANIFEST_LOADED);

  // ---- LOCK_ACQUIRE ----
  state.stage = ORCHESTRATION_STAGES.LOCK_ACQUIRE;
  const acquireResult = await callDependency(deps.acquireAdvisoryLock, { targetMigrationId: inp.targetMigrationId });
  if (!acquireResult.ok) {
    addBlocker(dependencyFailed('acquireAdvisoryLock'));
    return blockedBeforeLock(RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
  }
  const acquireValue = acquireResult.value;
  if (!isPlainRecord(acquireValue)) {
    addBlocker(resultInvalid('acquireAdvisoryLock'));
    return blockedBeforeLock(RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
  }
  const acquireStatus = acquireValue.status;
  if (!LOCK_ACQUIRE_STATUSES.has(acquireStatus)) {
    addBlocker(resultInvalid('acquireAdvisoryLock'));
    return blockedBeforeLock(RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
  }
  if (acquireStatus !== 'ACQUIRED') {
    // Valid negative result (NOT_ATTEMPTED/FAILED/UNAVAILABLE): preserve the exact
    // protocol blocker; no release, no pipeline.
    addBlocker(RUNNER_BLOCKERS.RUNNER_ADVISORY_LOCK_REQUIRED);
    return blockedBeforeLock(RECOVERY_DECISIONS.NO_RECOVERY_ACTION);
  }

  // ACQUIRED: the adapter claims the lock. The handle is the lock identity used
  // from ledger read through release. It must be present and non-null/non-undefined
  // (opaque: any type is allowed). The handle value is never exposed.
  lockHandle = acquireValue.handle;
  state.lockAcquired = true;
  const handleUsable = Object.prototype.hasOwnProperty.call(acquireValue, 'handle')
    && acquireValue.handle !== null
    && acquireValue.handle !== undefined;

  // Recovery for a post-execution failure depends on whether the migration is destructive.
  function executionRecovery() {
    return destructive
      ? RECOVERY_DECISIONS.SNAPSHOT_RESTORE_DECISION_REQUIRED
      : RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED;
  }

  // ---- Post-lock pipeline. The lock is released exactly once in `finally`. ----
  async function pipeline() {
    // ---- LEDGER_READ ----
    state.stage = ORCHESTRATION_STAGES.LEDGER_READ;
    const ledgerResult = await callDependency(deps.readLedger, { lockHandle });
    if (!ledgerResult.ok) {
      addBlocker(dependencyFailed('readLedger'));
      state.outcome = ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION;
      state.recoveryDecision = RECOVERY_DECISIONS.NO_RECOVERY_ACTION;
      return;
    }
    if (!Array.isArray(ledgerResult.value)) {
      addBlocker(resultInvalid('readLedger'));
      state.outcome = ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION;
      state.recoveryDecision = RECOVERY_DECISIONS.NO_RECOVERY_ACTION;
      return;
    }
    const ledgerRecords = ledgerResult.value;
    addEvent(ORCHESTRATION_EVENTS.LEDGER_READ);

    // ---- PRECONDITION ----
    state.stage = ORCHESTRATION_STAGES.PRECONDITION;
    const preconditionResult = await callDependency(deps.evaluatePrecondition, { targetMigrationId: inp.targetMigrationId, lockHandle });
    if (!preconditionResult.ok) {
      addBlocker(dependencyFailed('evaluatePrecondition'));
      state.outcome = ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION;
      state.recoveryDecision = RECOVERY_DECISIONS.NO_RECOVERY_ACTION;
      return;
    }
    if (!isPlainRecord(preconditionResult.value)) {
      addBlocker(resultInvalid('evaluatePrecondition'));
      state.outcome = ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION;
      state.recoveryDecision = RECOVERY_DECISIONS.NO_RECOVERY_ACTION;
      return;
    }
    const preconditionStatus = preconditionResult.value.status;
    if (!CONDITION_STATUSES.has(preconditionStatus)) {
      addBlocker(resultInvalid('evaluatePrecondition'));
      state.outcome = ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION;
      state.recoveryDecision = RECOVERY_DECISIONS.NO_RECOVERY_ACTION;
      return;
    }
    addEvent(ORCHESTRATION_EVENTS.PRECONDITION_COMPLETED);

    // ---- PREFLIGHT (protocol) ----
    state.stage = ORCHESTRATION_STAGES.PREFLIGHT;
    const preflightInput = {
      sourceValidationStatus: sourceStatus,
      manifestStatus: manifestValue.status,
      manifestMigrations: manifestValue.migrations,
      targetMigrationId: inp.targetMigrationId,
      ledgerRecords,
      advisoryLockStatus: acquireStatus,
      preconditionStatus,
      explicitBoundaryApproved: inp.explicitBoundaryApproved === true,
      requestedAction: inp.requestedAction
    };
    const preflightResult = evaluateMigrationPreflight(preflightInput);
    state.protocolDecision = preflightResult.decision;
    state.migrationChecksum = preflightResult.migrationChecksum;
    destructive = preflightResult.destructive === true;

    if (preflightResult.decision === RUNNER_DECISIONS.NOOP_ALREADY_APPLIED) {
      addEvent(ORCHESTRATION_EVENTS.PREFLIGHT_NOOP);
      state.outcome = ORCHESTRATION_OUTCOMES.NOOP_ALREADY_APPLIED;
      state.recoveryDecision = preflightResult.recoveryDecision;
      state.terminalNormal = true;
      return;
    }
    if (preflightResult.decision !== RUNNER_DECISIONS.READY_TO_EXECUTE || preflightResult.executionAuthorized !== true) {
      addEvent(ORCHESTRATION_EVENTS.PREFLIGHT_BLOCKED);
      for (const b of preflightResult.blockers) addBlocker(b);
      state.outcome = ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION;
      state.recoveryDecision = preflightResult.recoveryDecision;
      state.terminalNormal = true;
      return;
    }
    addEvent(ORCHESTRATION_EVENTS.PREFLIGHT_READY);

    // ---- EXECUTION (injected) ----
    state.stage = ORCHESTRATION_STAGES.EXECUTION;
    state.executionAttempted = true;
    const executionBinding = {
      migrationId: preflightResult.migrationId,
      migrationChecksum: preflightResult.migrationChecksum,
      transactionMode: preflightResult.transactionMode,
      destructive: preflightResult.destructive,
      lockHandle
    };
    const executionResult = await callDependency(deps.executeMigration, executionBinding);
    if (!executionResult.ok) {
      addBlocker(dependencyFailed('executeMigration'));
      state.outcome = ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED;
      state.recoveryDecision = executionRecovery();
      return;
    }
    if (!isValidExecutionResult(executionResult.value)) {
      addBlocker(resultInvalid('executeMigration'));
      state.outcome = ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED;
      state.recoveryDecision = executionRecovery();
      return;
    }
    const executionOutcome = executionResult.value.executionOutcome;
    const transactionOutcome = executionResult.value.transactionOutcome;
    addEvent(ORCHESTRATION_EVENTS.EXECUTION_COMPLETED);

    // ---- POSTCONDITION (injected) ----
    state.stage = ORCHESTRATION_STAGES.POSTCONDITION;
    const postconditionResult = await callDependency(deps.evaluatePostcondition, {
      migrationId: preflightResult.migrationId,
      migrationChecksum: preflightResult.migrationChecksum,
      transactionMode: preflightResult.transactionMode,
      destructive: preflightResult.destructive,
      lockHandle
    });
    if (!postconditionResult.ok) {
      addBlocker(dependencyFailed('evaluatePostcondition'));
      state.outcome = ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED;
      state.recoveryDecision = executionRecovery();
      return;
    }
    if (!isPlainRecord(postconditionResult.value)) {
      addBlocker(resultInvalid('evaluatePostcondition'));
      state.outcome = ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED;
      state.recoveryDecision = executionRecovery();
      return;
    }
    const postconditionStatus = postconditionResult.value.status;
    if (!CONDITION_STATUSES.has(postconditionStatus)) {
      addBlocker(resultInvalid('evaluatePostcondition'));
      state.outcome = ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED;
      state.recoveryDecision = executionRecovery();
      return;
    }
    addEvent(ORCHESTRATION_EVENTS.POSTCONDITION_COMPLETED);

    // ---- LOCK_RECHECK (injected) ----
    state.stage = ORCHESTRATION_STAGES.LOCK_RECHECK;
    const recheckResult = await callDependency(deps.checkAdvisoryLock, { lockHandle });
    if (!recheckResult.ok) {
      addBlocker(dependencyFailed('checkAdvisoryLock'));
      state.outcome = ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED;
      state.recoveryDecision = executionRecovery();
      return;
    }
    if (!isPlainRecord(recheckResult.value)) {
      addBlocker(resultInvalid('checkAdvisoryLock'));
      state.outcome = ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED;
      state.recoveryDecision = executionRecovery();
      return;
    }
    const recheckStatus = recheckResult.value.status;
    if (!LOCK_CHECK_STATUSES.has(recheckStatus)) {
      addBlocker(resultInvalid('checkAdvisoryLock'));
      state.outcome = ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED;
      state.recoveryDecision = executionRecovery();
      return;
    }
    addEvent(ORCHESTRATION_EVENTS.LOCK_RECHECKED);

    // ---- COMPLETION (protocol) ----
    state.stage = ORCHESTRATION_STAGES.COMPLETION;
    const completionInput = {
      preflightInput,
      preflightResult,
      executionOutcome,
      transactionOutcome,
      postconditionStatus,
      advisoryLockStatus: recheckStatus,
      migrationId: preflightResult.migrationId,
      migrationChecksum: preflightResult.migrationChecksum,
      ledgerAppendAuthorized: false
    };
    const completionResult = evaluateMigrationCompletion(completionInput);
    state.protocolDecision = completionResult.decision;
    if (completionResult.decision !== RUNNER_DECISIONS.READY_TO_APPEND_LEDGER || completionResult.ledgerAppendAuthorized !== true) {
      addEvent(ORCHESTRATION_EVENTS.COMPLETION_BLOCKED);
      for (const b of completionResult.blockers) addBlocker(b);
      state.outcome = ORCHESTRATION_OUTCOMES.COMPLETION_BLOCKED;
      state.recoveryDecision = completionResult.recoveryDecision;
      state.terminalNormal = true;
      return;
    }
    addEvent(ORCHESTRATION_EVENTS.COMPLETION_AUTHORIZED);

    // ---- LEDGER_APPEND ----
    state.stage = ORCHESTRATION_STAGES.LEDGER_APPEND;
    const nowResult = await callDependencyNoArg(deps.now);
    if (!nowResult.ok || !isValidCanonicalTimestamp(nowResult.value)) {
      addBlocker(ORCHESTRATION_BLOCKERS.ORCHESTRATOR_CLOCK_RESULT_INVALID);
      addEvent(ORCHESTRATION_EVENTS.LEDGER_APPEND_FAILED);
      state.outcome = ORCHESTRATION_OUTCOMES.LEDGER_APPEND_FAILED;
      state.recoveryDecision = RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED;
      return; // append not called
    }
    const ledgerRecord = {
      migration_id: preflightResult.migrationId,
      content_checksum: preflightResult.migrationChecksum,
      applied_at: nowResult.value,
      runner_version: runtimeMetadata.runnerVersion,
      environment_class: runtimeMetadata.environmentClass,
      deployed_commit: runtimeMetadata.deployedCommit,
      transaction_outcome: 'COMMITTED'
    };
    state.ledgerAppendAttempted = true;
    const appendResult = await callDependency(deps.appendLedgerRecord, { record: ledgerRecord, lockHandle });
    let appendSucceeded = false;
    if (!appendResult.ok) {
      // Dependency threw: append failed (no RESULT_INVALID for a throw).
      appendSucceeded = false;
    } else if (!isPlainRecord(appendResult.value)) {
      // Malformed result: dual blocker.
      addBlocker(resultInvalid('appendLedgerRecord'));
      appendSucceeded = false;
    } else if (appendResult.value.status === 'APPENDED') {
      appendSucceeded = true;
    }
    // status FAILED/UNKNOWN/other: schema-valid negative result, no RESULT_INVALID.
    if (!appendSucceeded) {
      addEvent(ORCHESTRATION_EVENTS.LEDGER_APPEND_FAILED);
      addBlocker(ORCHESTRATION_BLOCKERS.ORCHESTRATOR_LEDGER_APPEND_FAILED);
      state.outcome = ORCHESTRATION_OUTCOMES.LEDGER_APPEND_FAILED;
      state.recoveryDecision = RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED;
      state.ledgerAppended = false;
      return; // no retry, no re-execution, no down migration, no ledger rewrite
    }
    addEvent(ORCHESTRATION_EVENTS.LEDGER_APPENDED);
    state.ledgerAppended = true;
    state.outcome = ORCHESTRATION_OUTCOMES.EXECUTED_AND_RECORDED;
    state.recoveryDecision = RECOVERY_DECISIONS.NO_RECOVERY_ACTION;
    state.terminalNormal = true;
  }

  try {
    if (!handleUsable) {
      // ACQUIRED was claimed but the handle is unusable: never start the pipeline.
      // A best-effort cleanup release still happens in `finally`.
      addBlocker(resultInvalid('acquireAdvisoryLock'));
      state.outcome = ORCHESTRATION_OUTCOMES.BLOCKED_BEFORE_EXECUTION;
      state.recoveryDecision = RECOVERY_DECISIONS.NO_RECOVERY_ACTION;
    } else {
      addEvent(ORCHESTRATION_EVENTS.LOCK_ACQUIRED);
      await pipeline();
    }
  } finally {
    // ---- LOCK_RELEASE: attempt exactly once after ACQUIRED, on any path ----
    if (state.lockAcquired && !state.lockReleased) {
      const releaseResult = await callDependency(deps.releaseAdvisoryLock, { lockHandle });
      let releaseSucceeded = false;
      if (!releaseResult.ok) {
        // Dependency threw: release failed (no RESULT_INVALID for a throw).
        releaseSucceeded = false;
      } else if (!isPlainRecord(releaseResult.value)) {
        // Malformed result: dual blocker.
        addBlocker(resultInvalid('releaseAdvisoryLock'));
        releaseSucceeded = false;
      } else if (releaseResult.value.status === 'RELEASED') {
        releaseSucceeded = true;
      }
      // status FAILED/UNKNOWN/other: schema-valid negative result, no RESULT_INVALID.
      if (releaseSucceeded) {
        addEvent(ORCHESTRATION_EVENTS.LOCK_RELEASED);
        state.lockReleased = true;
        if (state.terminalNormal) {
          state.stage = ORCHESTRATION_STAGES.COMPLETED;
        }
      } else {
        addEvent(ORCHESTRATION_EVENTS.LOCK_RELEASE_FAILED);
        addBlocker(ORCHESTRATION_BLOCKERS.ORCHESTRATOR_LOCK_RELEASE_FAILED);
        state.lockReleased = false;
        // Preserve already-successful execution/append flags; override outcome.
        state.outcome = ORCHESTRATION_OUTCOMES.LOCK_RELEASE_FAILED;
        state.stage = ORCHESTRATION_STAGES.LOCK_RELEASE;
        if (state.recoveryDecision === null || state.recoveryDecision === RECOVERY_DECISIONS.NO_RECOVERY_ACTION) {
          state.recoveryDecision = RECOVERY_DECISIONS.MANUAL_RECONCILIATION_REQUIRED;
        }
      }
    }
  }

  return buildResult(state);
}

module.exports = {
  ORCHESTRATION_OUTCOMES,
  ORCHESTRATION_STAGES,
  ORCHESTRATION_BLOCKERS,
  ORCHESTRATION_EVENTS,
  REQUIRED_DEPENDENCY_NAMES,
  runCanonicalMigration
};
