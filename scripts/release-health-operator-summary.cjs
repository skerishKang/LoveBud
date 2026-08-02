'use strict';

// Step 6 of 6 release-health operator summary.
//
// Pure, deterministic, source-only module. Importing or calling this module
// never performs network access, filesystem writes, environment reads,
// subprocesses, timers, random or timestamp generation, provider access,
// dispatch actions, deployment, rollback execution, standard I/O, or exit
// side effects. It consumes only the bounded sanitized evidence outputs
// authorized by the Step 5 policy document and emits a canonical summary.

const CONTRACT_VERSION = 1;

const POLICY_AUTHORITY = 'docs/ops/RELEASE_HEALTH_THRESHOLD_AND_RESPONSE_POLICY.md';

const HEALTH_STATES = Object.freeze([
  'HEALTHY',
  'DEGRADED',
  'BLOCKED',
  'INSUFFICIENT_EVIDENCE',
]);

const RESPONSE_RECOMMENDATIONS = Object.freeze([
  'NO_ACTION',
  'OBSERVE',
  'FORWARD_FIX_REQUIRED',
  'ROLLBACK_RECOMMENDED',
  'OWNER_DECISION_REQUIRED',
]);

const BLOCKER_CODES = Object.freeze([
  'release_sha_mismatch',
  'missing_or_invalid_release_manifest',
  'required_route_failure',
  'required_static_asset_failure',
  'same_origin_unexpected_http_ge_400',
  'fatal_pageerror_or_unhandled_browser_error',
  'privacy_boundary_violation',
  'validated_critical_journey_terminal_failure',
  'required_health_check_failed',
]);

const DEGRADED_CODES = Object.freeze([
  'latency_bucket_gte_5_s',
  'browser_console_error',
  'browser_horizontal_overflow',
  'successful_route_or_static_http_3xx',
]);

const PRODUCT_ACCEPTANCE_STATES = Object.freeze([
  'PRODUCT_ACCEPTED',
  'PRODUCT_REJECTED',
  'PRODUCT_ACCEPTANCE_PENDING',
]);

const EVIDENCE_COMPLETENESS_STATES = Object.freeze([
  'EVIDENCE_COMPLETE',
  'EVIDENCE_INCOMPLETE',
]);

const TECHNICAL_ACCEPTANCE_STATES = Object.freeze([
  'TECHNICAL_ACCEPTED',
  'TECHNICAL_DEGRADED',
  'TECHNICAL_BLOCKED',
  'TECHNICAL_EVIDENCE_INSUFFICIENT',
]);

const OWNER_DECISION_STATES = Object.freeze([
  'OWNER_ACTION_REQUIRED',
  'OWNER_ACTION_NOT_REQUIRED',
]);

// Canonical 11-key output schema in fixed order.
const SUMMARY_KEY_ORDER = Object.freeze([
  'contract_version',
  'release_sha',
  'health_state',
  'response_recommendation',
  'evidence_completeness',
  'blocker_codes',
  'degraded_codes',
  'owner_decision_state',
  'technical_acceptance',
  'product_acceptance',
  'policy_authority',
]);

// Exact input boundary. Any other key is rejected (never silently ignored).
const ALLOWED_INPUT_FIELDS = Object.freeze([
  'release_sha',
  'health_state',
  'response_recommendation',
  'blocker_codes',
  'degraded_codes',
  'product_acceptance',
]);

// Privacy rejection list. Reject rather than echo any of these field names.
const PRIVATE_FIELD_NAMES = Object.freeze([
  'rawBody',
  'raw_body',
  'responseBody',
  'rawError',
  'raw_error',
  'exception',
  'stack',
  'stackTrace',
  'url',
  'query',
  'queryString',
  'cookie',
  'token',
  'authorization',
  'authorizationHeader',
  'userContent',
  'treeId',
  'memoryId',
  'userId',
  'uid',
  'uuid',
  'providerId',
  'accountId',
  'projectId',
  'deploymentId',
  'databaseUrl',
  'connectionString',
  'requestId',
  'timestamp',
  'metadata',
]);

// Fixed sanitized validation codes. Errors carry only these codes; they never
// echo input values, raw errors, URLs, IDs, tokens, stacks, or object content.
const ERROR_CODES = Object.freeze({
  SUMMARY_INPUT_INVALID: 'SUMMARY_INPUT_INVALID',
  SUMMARY_UNKNOWN_FIELD: 'SUMMARY_UNKNOWN_FIELD',
  SUMMARY_PRIVATE_FIELD_REJECTED: 'SUMMARY_PRIVATE_FIELD_REJECTED',
  SUMMARY_RELEASE_SHA_INVALID: 'SUMMARY_RELEASE_SHA_INVALID',
  SUMMARY_UNKNOWN_ENUM: 'SUMMARY_UNKNOWN_ENUM',
  SUMMARY_IMPOSSIBLE_STATE: 'SUMMARY_IMPOSSIBLE_STATE',
});

const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;

const HEALTH_STATE_SET = new Set(HEALTH_STATES);
const RESPONSE_RECOMMENDATION_SET = new Set(RESPONSE_RECOMMENDATIONS);
const BLOCKER_CODE_SET = new Set(BLOCKER_CODES);
const DEGRADED_CODE_SET = new Set(DEGRADED_CODES);
const PRODUCT_ACCEPTANCE_SET = new Set(PRODUCT_ACCEPTANCE_STATES);
const EVIDENCE_COMPLETENESS_SET = new Set(EVIDENCE_COMPLETENESS_STATES);
const TECHNICAL_ACCEPTANCE_SET = new Set(TECHNICAL_ACCEPTANCE_STATES);
const OWNER_DECISION_SET = new Set(OWNER_DECISION_STATES);
const ALLOWED_INPUT_SET = new Set(ALLOWED_INPUT_FIELDS);
const PRIVATE_FIELD_SET = new Set(PRIVATE_FIELD_NAMES);

class SummaryError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SummaryError';
    this.code = code;
  }
}

function fail(code) {
  throw new SummaryError(code);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertReleaseSha(value) {
  if (typeof value !== 'string' || !RELEASE_SHA_PATTERN.test(value)) {
    fail(ERROR_CODES.SUMMARY_RELEASE_SHA_INVALID);
  }
  return value;
}

function assertEnum(value, allowedSet) {
  if (typeof value !== 'string' || !allowedSet.has(value)) {
    fail(ERROR_CODES.SUMMARY_UNKNOWN_ENUM);
  }
  return value;
}

// Clone, deduplicate, lexicographically sort, and freeze a bounded code list.
function normalizeCodeList(value, allowedSet) {
  if (!Array.isArray(value)) {
    fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
  }
  const seen = new Set();
  const normalized = [];
  for (const item of value) {
    if (typeof item !== 'string' || !allowedSet.has(item)) {
      fail(ERROR_CODES.SUMMARY_UNKNOWN_ENUM);
    }
    if (!seen.has(item)) {
      seen.add(item);
      normalized.push(item);
    }
  }
  normalized.sort();
  return Object.freeze(normalized);
}

function deriveOwnerDecisionState(recommendation) {
  if (recommendation === 'ROLLBACK_RECOMMENDED' || recommendation === 'OWNER_DECISION_REQUIRED') {
    return OWNER_DECISION_STATES[0]; // OWNER_ACTION_REQUIRED
  }
  return OWNER_DECISION_STATES[1]; // OWNER_ACTION_NOT_REQUIRED
}

// Derive evidence/technical acceptance and validate state consistency. Any
// contradictory combination is rejected fail-closed as SUMMARY_IMPOSSIBLE_STATE.
function deriveState(healthState, recommendation, blockerCodes, degradedCodes) {
  let evidenceCompleteness;
  let technicalAcceptance;

  if (healthState === 'HEALTHY') {
    if (recommendation !== 'NO_ACTION' || blockerCodes.length !== 0 || degradedCodes.length !== 0) {
      fail(ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE);
    }
    evidenceCompleteness = EVIDENCE_COMPLETENESS_STATES[0];
    technicalAcceptance = TECHNICAL_ACCEPTANCE_STATES[0];
  } else if (healthState === 'DEGRADED') {
    if (
      recommendation !== 'OBSERVE' ||
      blockerCodes.length !== 0 ||
      degradedCodes.length < 1
    ) {
      fail(ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE);
    }
    evidenceCompleteness = EVIDENCE_COMPLETENESS_STATES[0];
    technicalAcceptance = TECHNICAL_ACCEPTANCE_STATES[1];
  } else if (healthState === 'BLOCKED') {
    const allowed = new Set(['FORWARD_FIX_REQUIRED', 'ROLLBACK_RECOMMENDED', 'OWNER_DECISION_REQUIRED']);
    if (!allowed.has(recommendation) || blockerCodes.length < 1) {
      fail(ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE);
    }
    evidenceCompleteness = EVIDENCE_COMPLETENESS_STATES[0];
    technicalAcceptance = TECHNICAL_ACCEPTANCE_STATES[2];
  } else if (healthState === 'INSUFFICIENT_EVIDENCE') {
    if (
      recommendation !== 'OWNER_DECISION_REQUIRED' ||
      blockerCodes.length !== 0 ||
      degradedCodes.length !== 0
    ) {
      fail(ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE);
    }
    evidenceCompleteness = EVIDENCE_COMPLETENESS_STATES[1];
    technicalAcceptance = TECHNICAL_ACCEPTANCE_STATES[3];
  } else {
    fail(ERROR_CODES.SUMMARY_UNKNOWN_ENUM);
  }

  return { evidenceCompleteness, technicalAcceptance };
}

function buildReleaseHealthOperatorSummary(input) {
  if (!isPlainObject(input)) {
    fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
  }

  for (const key of Object.keys(input)) {
    if (PRIVATE_FIELD_SET.has(key)) {
      fail(ERROR_CODES.SUMMARY_PRIVATE_FIELD_REJECTED);
    }
    if (!ALLOWED_INPUT_SET.has(key)) {
      fail(ERROR_CODES.SUMMARY_UNKNOWN_FIELD);
    }
  }

  for (const required of ALLOWED_INPUT_FIELDS) {
    if (!(required in input)) {
      fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
    }
  }

  const releaseSha = assertReleaseSha(input.release_sha);
  const healthState = assertEnum(input.health_state, HEALTH_STATE_SET);
  const recommendation = assertEnum(input.response_recommendation, RESPONSE_RECOMMENDATION_SET);
  const productAcceptance = assertEnum(input.product_acceptance, PRODUCT_ACCEPTANCE_SET);
  const blockerCodes = normalizeCodeList(input.blocker_codes, BLOCKER_CODE_SET);
  const degradedCodes = normalizeCodeList(input.degraded_codes, DEGRADED_CODE_SET);

  const derived = deriveState(healthState, recommendation, blockerCodes, degradedCodes);

  const summary = {
    contract_version: CONTRACT_VERSION,
    release_sha: releaseSha,
    health_state: healthState,
    response_recommendation: recommendation,
    evidence_completeness: derived.evidenceCompleteness,
    blocker_codes: blockerCodes,
    degraded_codes: degradedCodes,
    owner_decision_state: deriveOwnerDecisionState(recommendation),
    technical_acceptance: derived.technicalAcceptance,
    product_acceptance: productAcceptance,
    policy_authority: POLICY_AUTHORITY,
  };

  return deepFreeze(summary);
}

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
  }
  return value;
}

// Validate that a code array is canonical: frozen, every item bounded, no
// duplicates, and lexicographically sorted. Any violation fails closed.
function assertCanonicalCodeList(value, allowedSet) {
  if (!Array.isArray(value)) {
    fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
  }
  if (!Object.isFrozen(value)) {
    fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
  }
  const seen = new Set();
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (typeof item !== 'string' || !allowedSet.has(item)) {
      fail(ERROR_CODES.SUMMARY_UNKNOWN_ENUM);
    }
    if (seen.has(item)) {
      fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
    }
    seen.add(item);
    if (i > 0 && value[i - 1] > item) {
      fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
    }
  }
  return value;
}

// Validate that a value is a canonical summary object: exactly the 11 keys in
// the fixed order, fixed contract/authority values, a valid release SHA, all
// enum fields within their exact bounded vocabularies, canonical frozen sorted
// unique code arrays, a frozen summary object, and derived fields that exactly
// match the canonical derivation. A caller-created forged object is therefore
// never serialized or formatted; any violation fails closed with a fixed
// sanitized code and no input value is echoed.
function assertCanonicalSummary(summary) {
  if (!isPlainObject(summary)) {
    fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
  }
  const keys = Object.keys(summary);
  if (keys.length !== SUMMARY_KEY_ORDER.length) {
    fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
  }
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i] !== SUMMARY_KEY_ORDER[i]) {
      fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
    }
  }
  if (summary.contract_version !== CONTRACT_VERSION) {
    fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
  }
  if (summary.policy_authority !== POLICY_AUTHORITY) {
    fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
  }
  if (typeof summary.release_sha !== 'string' || !RELEASE_SHA_PATTERN.test(summary.release_sha)) {
    fail(ERROR_CODES.SUMMARY_RELEASE_SHA_INVALID);
  }
  // Bounded enum revalidation of every enum field.
  assertEnum(summary.health_state, HEALTH_STATE_SET);
  assertEnum(summary.response_recommendation, RESPONSE_RECOMMENDATION_SET);
  assertEnum(summary.evidence_completeness, EVIDENCE_COMPLETENESS_SET);
  assertEnum(summary.technical_acceptance, TECHNICAL_ACCEPTANCE_SET);
  assertEnum(summary.owner_decision_state, OWNER_DECISION_SET);
  assertEnum(summary.product_acceptance, PRODUCT_ACCEPTANCE_SET);
  // Canonical code lists: frozen, bounded, unique, sorted.
  const blockerCodes = assertCanonicalCodeList(summary.blocker_codes, BLOCKER_CODE_SET);
  const degradedCodes = assertCanonicalCodeList(summary.degraded_codes, DEGRADED_CODE_SET);
  // Frozen canonical boundary: the summary object itself must be frozen.
  if (!Object.isFrozen(summary)) {
    fail(ERROR_CODES.SUMMARY_INPUT_INVALID);
  }
  // Cross-field consistency: derived fields must equal the canonical
  // derivation. Forged derived fields are rejected, never silently accepted.
  const derived = deriveState(
    summary.health_state,
    summary.response_recommendation,
    blockerCodes,
    degradedCodes
  );
  if (summary.evidence_completeness !== derived.evidenceCompleteness) {
    fail(ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE);
  }
  if (summary.technical_acceptance !== derived.technicalAcceptance) {
    fail(ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE);
  }
  if (summary.owner_decision_state !== deriveOwnerDecisionState(summary.response_recommendation)) {
    fail(ERROR_CODES.SUMMARY_IMPOSSIBLE_STATE);
  }
}

// Byte-stable canonical JSON. Key order is taken from the fixed schema, never
// from caller object key order. No trailing newline. No timestamp/locale/random.
function serializeReleaseHealthOperatorSummary(summary) {
  assertCanonicalSummary(summary);
  const parts = SUMMARY_KEY_ORDER.map((key) => {
    return JSON.stringify(key) + ':' + JSON.stringify(summary[key]);
  });
  return '{' + parts.join(',') + '}';
}

// Deterministic human-readable formatter derived only from the canonical
// summary object.
function formatReleaseHealthOperatorSummary(summary) {
  assertCanonicalSummary(summary);
  const blockerText =
    summary.blocker_codes.length === 0 ? 'NONE' : summary.blocker_codes.join(', ');
  const degradedText =
    summary.degraded_codes.length === 0 ? 'NONE' : summary.degraded_codes.join(', ');
  const lines = [
    'Release Health Operator Summary',
    'Release SHA: ' + summary.release_sha,
    'Technical health: ' + summary.health_state,
    'Technical acceptance: ' + summary.technical_acceptance,
    'Product/UI acceptance: ' + summary.product_acceptance,
    'Evidence completeness: ' + summary.evidence_completeness,
    'Response recommendation: ' + summary.response_recommendation,
    'Owner action: ' + summary.owner_decision_state,
    'Blockers: ' + blockerText,
    'Degraded signals: ' + degradedText,
    'Advisory only: no deployment, rollback, provider mutation, or workflow action was executed.',
    'Policy authority: ' + POLICY_AUTHORITY,
  ];
  return lines.join('\n');
}

module.exports = Object.freeze({
  CONTRACT_VERSION,
  POLICY_AUTHORITY,
  HEALTH_STATES,
  RESPONSE_RECOMMENDATIONS,
  BLOCKER_CODES,
  DEGRADED_CODES,
  PRODUCT_ACCEPTANCE_STATES,
  EVIDENCE_COMPLETENESS_STATES,
  TECHNICAL_ACCEPTANCE_STATES,
  OWNER_DECISION_STATES,
  SUMMARY_KEY_ORDER,
  ALLOWED_INPUT_FIELDS,
  PRIVATE_FIELD_NAMES,
  ERROR_CODES,
  buildReleaseHealthOperatorSummary,
  serializeReleaseHealthOperatorSummary,
  formatReleaseHealthOperatorSummary,
});
