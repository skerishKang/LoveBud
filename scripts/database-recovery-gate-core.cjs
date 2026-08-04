'use strict';

/**
 * Source-only fail-closed pre-change recovery gate decision core (Issue #3880,
 * first bounded recovery child under #3460).
 *
 * A deterministic, descriptor-safe, fail-closed authority that consumes only
 * bounded sanitized recovery evidence and decides whether risky database
 * operations may proceed at the source level. It performs no provider
 * binding, no database connection, no SQL, no snapshot/branch/restore/reset
 * action, and no Production mutation. It never reads environment variables,
 * filesystem paths, URLs, credentials, provider identifiers, operator
 * identities, timestamps, or arbitrary metadata.
 *
 * RECOVERY_GATE_CONFIRMED means only that bounded source-level recovery
 * prerequisites are modeled as satisfied for a later separately approved
 * operator action. It never implies that a snapshot exists, that provider
 * capability is confirmed, that a restore is possible, or that any
 * Production mutation is approved.
 *
 * Refs #3880, #3460, #3878, #1882
 */

const CONTRACT_VERSION = '1.0';

const VERDICTS = Object.freeze({
  RECOVERY_GATE_CONFIRMED: 'RECOVERY_GATE_CONFIRMED',
  RECOVERY_GATE_BLOCKED_PROVIDER_CAPABILITY: 'RECOVERY_GATE_BLOCKED_PROVIDER_CAPABILITY',
  RECOVERY_GATE_BLOCKED_RECOVERY_POINT_MISSING: 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_MISSING',
  RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE: 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE',
  RECOVERY_GATE_BLOCKED_RECOVERY_POINT_UNKNOWN: 'RECOVERY_GATE_BLOCKED_RECOVERY_POINT_UNKNOWN',
  RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE: 'RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE',
  RECOVERY_GATE_BLOCKED_SCHEMA_VERIFICATION: 'RECOVERY_GATE_BLOCKED_SCHEMA_VERIFICATION',
  RECOVERY_GATE_BLOCKED_RELATIONAL_VERIFICATION: 'RECOVERY_GATE_BLOCKED_RELATIONAL_VERIFICATION',
  RECOVERY_GATE_BLOCKED_APPROVAL: 'RECOVERY_GATE_BLOCKED_APPROVAL',
  RECOVERY_GATE_BLOCKED_INVALID_INPUT: 'RECOVERY_GATE_BLOCKED_INVALID_INPUT',
});

const ALLOWED_INPUT_KEYS = Object.freeze([
  'policy_version',
  'operation_risk_class',
  'provider_capability_status',
  'recovery_point_status',
  'recovery_point_age_class',
  'retention_class',
  'restore_drill_status',
  'restore_target_class',
  'schema_verification_status',
  'relational_verification_status',
  'approval_status',
]);

// Bounded enum vocabularies for each evidence class.
const OPERATION_RISK_CLASS_VALUES = Object.freeze(['TIER_1', 'TIER_2', 'TIER_3']);
const PROVIDER_CAPABILITY_STATUS_VALUES = Object.freeze([
  'PROVIDER_CAPABILITY_CONFIRMED',
  'PROVIDER_CAPABILITY_UNVERIFIED',
]);
const RECOVERY_POINT_STATUS_VALUES = Object.freeze([
  'RECOVERY_POINT_VALID',
  'RECOVERY_POINT_STALE',
  'RECOVERY_POINT_MISSING',
  'RECOVERY_POINT_STATUS_UNKNOWN',
]);
const RECOVERY_POINT_AGE_CLASS_VALUES = Object.freeze([
  'AGE_WITHIN_RPO',
  'AGE_EXCEEDS_RPO',
]);
const RETENTION_CLASS_VALUES = Object.freeze([
  'RETENTION_CONFIRMED',
  'RETENTION_UNVERIFIED',
  'RETENTION_ABSENT',
]);
const RESTORE_DRILL_STATUS_VALUES = Object.freeze([
  'RESTORE_DRILL_CONFIRMED',
  'RESTORE_DRILL_NOT_CONFIRMED',
  'RESTORE_DRILL_OVERDUE',
]);
const RESTORE_TARGET_CLASS_VALUES = Object.freeze([
  'RESTORE_TARGET_ISOLATED_COPY',
  'RESTORE_TARGET_NON_PRODUCTION',
  'RESTORE_TARGET_UNVERIFIED',
]);
const VERIFICATION_STATUS_VALUES = Object.freeze(['PRESENT', 'ABSENT', 'UNVERIFIED']);

// Fixed blocked-gate identifiers used only in bounded result fields.
const BLOCKED_GATES = Object.freeze({
  INPUT: 'input',
  PROVIDER_CAPABILITY: 'provider_capability',
  RECOVERY_POINT_MISSING: 'recovery_point_missing',
  RECOVERY_POINT_STALE: 'recovery_point_stale',
  RECOVERY_POINT_UNKNOWN: 'recovery_point_unknown',
  RESTORE_DRILL_OVERDUE: 'restore_drill_overdue',
  SCHEMA_VERIFICATION: 'schema_verification',
  RELATIONAL_VERIFICATION: 'relational_verification',
  APPROVAL: 'approval',
});

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object') return false;
  try {
    if (Array.isArray(value)) return false;
  } catch {
    return false;
  }
  let proto;
  try {
    proto = Object.getPrototypeOf(value);
  } catch {
    return false;
  }
  return proto === Object.prototype || proto === null;
}

const INTERNAL_FAILURES = new WeakMap();

function fail(verdict) {
  const failure = Object.create(null);
  INTERNAL_FAILURES.set(failure, verdict);
  throw failure;
}

function readOwnEnumerableDataProperty(object, key) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(object, key);
  } catch {
    fail(VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT);
  }
  if (!descriptor) {
    fail(VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT);
  }
  if (typeof descriptor.get === 'function' || typeof descriptor.set === 'function') {
    fail(VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT);
  }
  if (descriptor.enumerable !== true || !('value' in descriptor)) {
    fail(VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT);
  }
  return descriptor.value;
}

function readExactKeys(record) {
  let keys;
  try {
    keys = Reflect.ownKeys(record);
  } catch {
    fail(VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT);
  }
  return keys;
}

function requirePlainRecord(value) {
  if (!isPlainRecord(value)) fail(VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT);
}

function requireExactKeySet(keys) {
  if (keys.length !== ALLOWED_INPUT_KEYS.length) fail(VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT);
  for (const key of keys) {
    if (typeof key !== 'string') fail(VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT);
    if (!ALLOWED_INPUT_KEYS.includes(key)) fail(VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT);
  }
}

function readBoundedString(input, key, allowedValues) {
  const value = readOwnEnumerableDataProperty(input, key);
  if (typeof value !== 'string' || value.length === 0) fail(VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT);
  if (!allowedValues.includes(value)) fail(VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT);
  return value;
}

function freezeResult(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      const item = value[key];
      if (Array.isArray(item)) {
        Object.freeze(item);
        for (const element of item) freezeResult(element);
      } else {
        freezeResult(item);
      }
    }
  }
  return value;
}

function makeBlockedResult(verdict, blockedGate) {
  return freezeResult({
    contract_version: CONTRACT_VERSION,
    verdict,
    blocked_gate: blockedGate,
    provider_contacted: false,
    secret_read: false,
    network_performed: false,
    database_connected: false,
    snapshot_created: false,
    branch_created: false,
    restore_performed: false,
    reset_performed: false,
    production_mutated: false,
    frozen: true,
  });
}

function makeConfirmedResult() {
  return freezeResult({
    contract_version: CONTRACT_VERSION,
    verdict: VERDICTS.RECOVERY_GATE_CONFIRMED,
    blocked_gate: null,
    provider_contacted: false,
    secret_read: false,
    network_performed: false,
    database_connected: false,
    snapshot_created: false,
    branch_created: false,
    restore_performed: false,
    reset_performed: false,
    production_mutated: false,
    frozen: true,
  });
}

/**
 * Evaluate bounded sanitized recovery evidence.
 * Never throws caller/provider details across the boundary; never mutates its
 * input; always returns one deeply frozen, detached, byte-stable result.
 */
function evaluateRecoveryGate(input) {
  if (arguments.length === 0 || input === undefined || input === null) {
    return makeBlockedResult(VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT, BLOCKED_GATES.INPUT);
  }

  let policyVersion;
  let operationRiskClass;
  let providerCapabilityStatus;
  let recoveryPointStatus;
  let recoveryPointAgeClass;
  let retentionClass;
  let restoreDrillStatus;
  let restoreTargetClass;
  let schemaVerificationStatus;
  let relationalVerificationStatus;
  let approvalStatus;

  try {
    requirePlainRecord(input);
    const keys = readExactKeys(input);
    requireExactKeySet(keys);

    policyVersion = readBoundedString(input, 'policy_version', [CONTRACT_VERSION]);
    operationRiskClass = readBoundedString(input, 'operation_risk_class', OPERATION_RISK_CLASS_VALUES);
    providerCapabilityStatus = readBoundedString(
      input,
      'provider_capability_status',
      PROVIDER_CAPABILITY_STATUS_VALUES
    );
    recoveryPointStatus = readBoundedString(
      input,
      'recovery_point_status',
      RECOVERY_POINT_STATUS_VALUES
    );
    recoveryPointAgeClass = readBoundedString(
      input,
      'recovery_point_age_class',
      RECOVERY_POINT_AGE_CLASS_VALUES
    );
    retentionClass = readBoundedString(input, 'retention_class', RETENTION_CLASS_VALUES);
    restoreDrillStatus = readBoundedString(input, 'restore_drill_status', RESTORE_DRILL_STATUS_VALUES);
    restoreTargetClass = readBoundedString(input, 'restore_target_class', RESTORE_TARGET_CLASS_VALUES);
    schemaVerificationStatus = readBoundedString(
      input,
      'schema_verification_status',
      VERIFICATION_STATUS_VALUES
    );
    relationalVerificationStatus = readBoundedString(
      input,
      'relational_verification_status',
      VERIFICATION_STATUS_VALUES
    );
    approvalStatus = readBoundedString(input, 'approval_status', VERIFICATION_STATUS_VALUES);
  } catch (error) {
    if (
      error !== null &&
      (typeof error === 'object' || typeof error === 'function') &&
      INTERNAL_FAILURES.has(error)
    ) {
      return makeBlockedResult(
        INTERNAL_FAILURES.get(error),
        BLOCKED_GATES.INPUT
      );
    }

    return makeBlockedResult(
      VERDICTS.RECOVERY_GATE_BLOCKED_INVALID_INPUT,
      BLOCKED_GATES.INPUT
    );
  }

  // Fail-closed gate evaluation in fixed order using only local sanitized values.
  if (providerCapabilityStatus !== 'PROVIDER_CAPABILITY_CONFIRMED') {
    return makeBlockedResult(VERDICTS.RECOVERY_GATE_BLOCKED_PROVIDER_CAPABILITY, BLOCKED_GATES.PROVIDER_CAPABILITY);
  }
  if (recoveryPointStatus === 'RECOVERY_POINT_MISSING') {
    return makeBlockedResult(VERDICTS.RECOVERY_GATE_BLOCKED_RECOVERY_POINT_MISSING, BLOCKED_GATES.RECOVERY_POINT_MISSING);
  }
  if (recoveryPointStatus === 'RECOVERY_POINT_STALE') {
    return makeBlockedResult(VERDICTS.RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE, BLOCKED_GATES.RECOVERY_POINT_STALE);
  }
  if (recoveryPointStatus === 'RECOVERY_POINT_STATUS_UNKNOWN') {
    return makeBlockedResult(VERDICTS.RECOVERY_GATE_BLOCKED_RECOVERY_POINT_UNKNOWN, BLOCKED_GATES.RECOVERY_POINT_UNKNOWN);
  }
  if (recoveryPointAgeClass === 'AGE_EXCEEDS_RPO') {
    return makeBlockedResult(VERDICTS.RECOVERY_GATE_BLOCKED_RECOVERY_POINT_STALE, BLOCKED_GATES.RECOVERY_POINT_STALE);
  }
  if (operationRiskClass === 'TIER_3' && restoreDrillStatus !== 'RESTORE_DRILL_CONFIRMED') {
    return makeBlockedResult(VERDICTS.RECOVERY_GATE_BLOCKED_RESTORE_DRILL_OVERDUE, BLOCKED_GATES.RESTORE_DRILL_OVERDUE);
  }
  if (schemaVerificationStatus !== 'PRESENT') {
    return makeBlockedResult(VERDICTS.RECOVERY_GATE_BLOCKED_SCHEMA_VERIFICATION, BLOCKED_GATES.SCHEMA_VERIFICATION);
  }
  if (relationalVerificationStatus !== 'PRESENT') {
    return makeBlockedResult(VERDICTS.RECOVERY_GATE_BLOCKED_RELATIONAL_VERIFICATION, BLOCKED_GATES.RELATIONAL_VERIFICATION);
  }
  if (approvalStatus !== 'PRESENT') {
    return makeBlockedResult(VERDICTS.RECOVERY_GATE_BLOCKED_APPROVAL, BLOCKED_GATES.APPROVAL);
  }

  return makeConfirmedResult();
}

module.exports = Object.freeze({
  CONTRACT_VERSION,
  VERDICTS,
  ALLOWED_INPUT_KEYS,
  BLOCKED_GATES,
  OPERATION_RISK_CLASS_VALUES,
  PROVIDER_CAPABILITY_STATUS_VALUES,
  RECOVERY_POINT_STATUS_VALUES,
  RECOVERY_POINT_AGE_CLASS_VALUES,
  RETENTION_CLASS_VALUES,
  RESTORE_DRILL_STATUS_VALUES,
  RESTORE_TARGET_CLASS_VALUES,
  VERIFICATION_STATUS_VALUES,
  evaluateRecoveryGate,
});
