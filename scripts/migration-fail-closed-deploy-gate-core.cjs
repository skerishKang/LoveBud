'use strict';

/**
 * Source-only fail-closed deploy gate decision core (Issue #3872, Step 8 Child 4
 * first bounded implementation under #3458).
 *
 * A deterministic, descriptor-safe, fail-closed authority that consumes only
 * bounded sanitized evidence and decides whether a later, separately approved
 * canonical-target activation proposal is eligible at the source level.
 *
 * It performs no provider binding, no target connection, no manifest
 * activation, no SQL, no database mutation, and no deployment integration.
 * It never reads environment variables, filesystem paths, URLs, credentials,
 * provider identifiers, operator identities, timestamps, or arbitrary metadata.
 *
 * DEPLOY_GATE_PRECONDITIONS_CONFIRMED means only that bounded source-level
 * prerequisites are satisfied for a later separately approved operator action.
 * It never implies that a target is active or that deployment occurred.
 *
 * Refs #3872, #3860, #3458, #1882
 */

const CONTRACT_VERSION = '1.0';

const RELEASE_SHA_PATTERN = /^[a-f0-9]{40}$/;

const VERDICTS = Object.freeze({
  DEPLOY_GATE_PRECONDITIONS_CONFIRMED: 'DEPLOY_GATE_PRECONDITIONS_CONFIRMED',
  DEPLOY_GATE_BLOCKED_INVALID_INPUT: 'DEPLOY_GATE_BLOCKED_INVALID_INPUT',
  DEPLOY_GATE_BLOCKED_MANIFEST_AUTHORITY: 'DEPLOY_GATE_BLOCKED_MANIFEST_AUTHORITY',
  DEPLOY_GATE_BLOCKED_LEDGER_PROVENANCE: 'DEPLOY_GATE_BLOCKED_LEDGER_PROVENANCE',
  DEPLOY_GATE_BLOCKED_TARGET_ATTRIBUTION: 'DEPLOY_GATE_BLOCKED_TARGET_ATTRIBUTION',
  DEPLOY_GATE_BLOCKED_CATALOG_PARITY: 'DEPLOY_GATE_BLOCKED_CATALOG_PARITY',
  DEPLOY_GATE_BLOCKED_DESTRUCTIVE_APPROVAL: 'DEPLOY_GATE_BLOCKED_DESTRUCTIVE_APPROVAL',
  DEPLOY_GATE_BLOCKED_RECOVERY_GATE: 'DEPLOY_GATE_BLOCKED_RECOVERY_GATE',
  DEPLOY_GATE_BLOCKED_ACTIVATION_APPROVAL: 'DEPLOY_GATE_BLOCKED_ACTIVATION_APPROVAL',
  DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE: 'DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE',
});

const ALLOWED_INPUT_KEYS = Object.freeze([
  'contract_version',
  'release_sha',
  'canonical_manifest_status',
  'canonical_manifest_checksum_posture',
  'expected_schema_status',
  'expected_schema_critical_object_posture',
  'ledger_provenance_verdict',
  'target_attribution_verdict',
  'catalog_parity_verdict',
  'destructive_ddl_approval_verdict',
  'recovery_gate_verdict',
  'activation_approval_verdict',
]);

// Bounded enum vocabularies for each evidence class.
const CANONICAL_MANIFEST_STATUS_VALUES = Object.freeze(['ADOPTION_REQUIRED', 'ACTIVE']);
const CANONICAL_CHECKSUM_POSTURE_VALUES = Object.freeze([
  'CHECKSUM_INTACT',
  'CHECKSUM_MISMATCH',
  'CHECKSUM_MISSING',
]);
const EXPECTED_SCHEMA_STATUS_VALUES = Object.freeze(['ADOPTION_REQUIRED', 'ACTIVE']);
const CRITICAL_OBJECT_POSTURE_VALUES = Object.freeze([
  'CRITICAL_OBJECT_BOUND',
  'CRITICAL_OBJECT_MISSING',
  'CRITICAL_OBJECT_MISMATCH',
]);
const LEDGER_VERDICT_VALUES = Object.freeze([
  'LEDGER_PROVENANCE_CONFIRMED',
  'LEDGER_PROVENANCE_MISMATCH',
  'LEDGER_PROVENANCE_EDITED',
  'LEDGER_PROVENANCE_MISSING',
]);
const TARGET_ATTRIBUTION_VERDICT_VALUES = Object.freeze([
  'TARGET_ATTRIBUTION_CONFIRMED',
  'TARGET_ATTRIBUTION_INVALID',
  'TARGET_ATTRIBUTION_MISSING',
]);
const CATALOG_PARITY_VERDICT_VALUES = Object.freeze([
  'CATALOG_PARITY_CONFIRMED',
  'CATALOG_PARITY_MISMATCH',
  'CATALOG_PARITY_INSUFFICIENT',
]);
const DESTRUCTIVE_APPROVAL_VERDICT_VALUES = Object.freeze([
  'DESTRUCTIVE_APPROVAL_CONFIRMED',
  'DESTRUCTIVE_APPROVAL_MISSING',
  'DESTRUCTIVE_APPROVAL_INVALID',
]);
const RECOVERY_GATE_VERDICT_VALUES = Object.freeze([
  'RECOVERY_GATE_CONFIRMED',
  'RECOVERY_GATE_REQUIRED',
  'RECOVERY_GATE_INVALID',
  'RECOVERY_GATE_MISSING',
]);
const ACTIVATION_APPROVAL_VERDICT_VALUES = Object.freeze([
  'ACTIVATION_APPROVAL_CONFIRMED',
  'ACTIVATION_APPROVAL_MISSING',
  'ACTIVATION_APPROVAL_INVALID',
]);

// Fixed blocked-gate identifiers used only in bounded result fields.
const BLOCKED_GATES = Object.freeze({
  INPUT: 'input',
  MANIFEST_AUTHORITY: 'manifest_authority',
  LEDGER_PROVENANCE: 'ledger_provenance',
  TARGET_ATTRIBUTION: 'target_attribution',
  CATALOG_PARITY: 'catalog_parity',
  DESTRUCTIVE_APPROVAL: 'destructive_approval',
  RECOVERY_GATE: 'recovery_gate',
  ACTIVATION_APPROVAL: 'activation_approval',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
});

const RECOVERY_GATE_VOCABULARY = Object.freeze([
  'RECOVERY_GATE_CONFIRMED',
  'RECOVERY_GATE_REQUIRED',
  'RECOVERY_GATE_INVALID',
]);

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
    fail(VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT);
  }
  if (!descriptor) {
    fail(VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT);
  }
  if (typeof descriptor.get === 'function' || typeof descriptor.set === 'function') {
    fail(VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT);
  }
  if (descriptor.enumerable !== true || !('value' in descriptor)) {
    fail(VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT);
  }
  return descriptor.value;
}

function readExactKeys(record) {
  let keys;
  try {
    keys = Object.keys(record);
  } catch {
    fail(VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT);
  }
  return keys;
}

function requirePlainRecord(value) {
  if (!isPlainRecord(value)) fail(VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT);
}

function requireExactKeySet(keys) {
  if (keys.length !== ALLOWED_INPUT_KEYS.length) fail(VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT);
  for (const key of keys) {
    if (!ALLOWED_INPUT_KEYS.includes(key)) fail(VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT);
  }
}

function readBoundedString(input, key, allowedValues) {
  const value = readOwnEnumerableDataProperty(input, key);
  if (typeof value !== 'string' || value.length === 0) fail(VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT);
  if (!allowedValues.includes(value)) fail(VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT);
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
    activation_performed: false,
    deployment_performed: false,
    manifest_mutated: false,
    target_mutated: false,
    frozen: true,
  });
}

function makeConfirmedResult() {
  return freezeResult({
    contract_version: CONTRACT_VERSION,
    verdict: VERDICTS.DEPLOY_GATE_PRECONDITIONS_CONFIRMED,
    blocked_gate: null,
    activation_performed: false,
    deployment_performed: false,
    manifest_mutated: false,
    target_mutated: false,
    frozen: true,
  });
}

/**
 * Evaluate bounded sanitized deploy-gate evidence.
 * Never throws caller/provider details across the boundary; never mutates its
 * input; always returns one deeply frozen, detached, byte-stable result.
 */
function evaluateDeployGate(input) {
  if (arguments.length === 0 || input === undefined || input === null) {
    return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT, BLOCKED_GATES.INPUT);
  }

  let contractVersion;
  let releaseSha;
  let canonicalManifestStatus;
  let canonicalChecksumPosture;
  let expectedSchemaStatus;
  let criticalObjectPosture;
  let ledgerVerdict;
  let targetAttributionVerdict;
  let catalogParityVerdict;
  let destructiveApprovalVerdict;
  let recoveryGateVerdict;
  let activationApprovalVerdict;

  try {
    requirePlainRecord(input);
    const keys = readExactKeys(input);
    requireExactKeySet(keys);

    contractVersion = readBoundedString(input, 'contract_version', [CONTRACT_VERSION]);
    releaseSha = readOwnEnumerableDataProperty(input, 'release_sha');
    if (typeof releaseSha !== 'string' || !RELEASE_SHA_PATTERN.test(releaseSha)) {
      fail(VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT);
    }

    canonicalManifestStatus = readBoundedString(
      input,
      'canonical_manifest_status',
      CANONICAL_MANIFEST_STATUS_VALUES
    );
    canonicalChecksumPosture = readBoundedString(
      input,
      'canonical_manifest_checksum_posture',
      CANONICAL_CHECKSUM_POSTURE_VALUES
    );
    expectedSchemaStatus = readBoundedString(
      input,
      'expected_schema_status',
      EXPECTED_SCHEMA_STATUS_VALUES
    );
    criticalObjectPosture = readBoundedString(
      input,
      'expected_schema_critical_object_posture',
      CRITICAL_OBJECT_POSTURE_VALUES
    );
    ledgerVerdict = readBoundedString(input, 'ledger_provenance_verdict', LEDGER_VERDICT_VALUES);
    targetAttributionVerdict = readBoundedString(
      input,
      'target_attribution_verdict',
      TARGET_ATTRIBUTION_VERDICT_VALUES
    );
    catalogParityVerdict = readBoundedString(
      input,
      'catalog_parity_verdict',
      CATALOG_PARITY_VERDICT_VALUES
    );
    destructiveApprovalVerdict = readBoundedString(
      input,
      'destructive_ddl_approval_verdict',
      DESTRUCTIVE_APPROVAL_VERDICT_VALUES
    );
    recoveryGateVerdict = readBoundedString(
      input,
      'recovery_gate_verdict',
      RECOVERY_GATE_VERDICT_VALUES
    );
    activationApprovalVerdict = readBoundedString(
      input,
      'activation_approval_verdict',
      ACTIVATION_APPROVAL_VERDICT_VALUES
    );
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
      VERDICTS.DEPLOY_GATE_BLOCKED_INVALID_INPUT,
      BLOCKED_GATES.INPUT
    );
  }

  // Fail-closed gate evaluation in fixed order using only local sanitized values.
  if (canonicalManifestStatus !== 'ADOPTION_REQUIRED' || canonicalChecksumPosture === 'CHECKSUM_MISMATCH') {
    return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_MANIFEST_AUTHORITY, BLOCKED_GATES.MANIFEST_AUTHORITY);
  }
  if (canonicalChecksumPosture === 'CHECKSUM_MISSING') {
    return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE, BLOCKED_GATES.INSUFFICIENT_EVIDENCE);
  }
  if (expectedSchemaStatus !== 'ADOPTION_REQUIRED' || criticalObjectPosture === 'CRITICAL_OBJECT_MISMATCH') {
    return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_MANIFEST_AUTHORITY, BLOCKED_GATES.MANIFEST_AUTHORITY);
  }
  if (criticalObjectPosture === 'CRITICAL_OBJECT_MISSING') {
    return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE, BLOCKED_GATES.INSUFFICIENT_EVIDENCE);
  }
  if (ledgerVerdict !== 'LEDGER_PROVENANCE_CONFIRMED') {
    if (ledgerVerdict === 'LEDGER_PROVENANCE_MISSING') {
      return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE, BLOCKED_GATES.INSUFFICIENT_EVIDENCE);
    }
    return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_LEDGER_PROVENANCE, BLOCKED_GATES.LEDGER_PROVENANCE);
  }
  if (targetAttributionVerdict !== 'TARGET_ATTRIBUTION_CONFIRMED') {
    if (targetAttributionVerdict === 'TARGET_ATTRIBUTION_MISSING') {
      return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE, BLOCKED_GATES.INSUFFICIENT_EVIDENCE);
    }
    return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_TARGET_ATTRIBUTION, BLOCKED_GATES.TARGET_ATTRIBUTION);
  }
  if (catalogParityVerdict !== 'CATALOG_PARITY_CONFIRMED') {
    if (catalogParityVerdict === 'CATALOG_PARITY_INSUFFICIENT') {
      return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE, BLOCKED_GATES.INSUFFICIENT_EVIDENCE);
    }
    return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_CATALOG_PARITY, BLOCKED_GATES.CATALOG_PARITY);
  }
  if (destructiveApprovalVerdict !== 'DESTRUCTIVE_APPROVAL_CONFIRMED') {
    return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_DESTRUCTIVE_APPROVAL, BLOCKED_GATES.DESTRUCTIVE_APPROVAL);
  }
  if (recoveryGateVerdict !== 'RECOVERY_GATE_CONFIRMED') {
    if (recoveryGateVerdict === 'RECOVERY_GATE_MISSING') {
      return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_INSUFFICIENT_EVIDENCE, BLOCKED_GATES.INSUFFICIENT_EVIDENCE);
    }
    return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_RECOVERY_GATE, BLOCKED_GATES.RECOVERY_GATE);
  }
  if (activationApprovalVerdict !== 'ACTIVATION_APPROVAL_CONFIRMED') {
    return makeBlockedResult(VERDICTS.DEPLOY_GATE_BLOCKED_ACTIVATION_APPROVAL, BLOCKED_GATES.ACTIVATION_APPROVAL);
  }

  return makeConfirmedResult();
}

module.exports = Object.freeze({
  CONTRACT_VERSION,
  RELEASE_SHA_PATTERN,
  VERDICTS,
  ALLOWED_INPUT_KEYS,
  BLOCKED_GATES,
  RECOVERY_GATE_VOCABULARY,
  CANONICAL_MANIFEST_STATUS_VALUES,
  CANONICAL_CHECKSUM_POSTURE_VALUES,
  EXPECTED_SCHEMA_STATUS_VALUES,
  CRITICAL_OBJECT_POSTURE_VALUES,
  LEDGER_VERDICT_VALUES,
  TARGET_ATTRIBUTION_VERDICT_VALUES,
  CATALOG_PARITY_VERDICT_VALUES,
  DESTRUCTIVE_APPROVAL_VERDICT_VALUES,
  RECOVERY_GATE_VERDICT_VALUES,
  ACTIVATION_APPROVAL_VERDICT_VALUES,
  evaluateDeployGate,
});
