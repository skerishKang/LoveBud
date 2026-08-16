'use strict';

// Issue #4080 — Write acknowledgement vs canonical reread outcome classifier
// (Reliability & Observability child of parent #3461).
//
// This module is a PURE SOURCE AUTHORITY. It:
//   - carries NO capability (no network, provider, database, SQL, filesystem
//     write, process, timer, retry, alert, or deployment);
//   - never executes a write, never retries, never reconciles, never persists,
//     and never mutates the user write path or any response status/body;
//   - is provider-neutral: no provider, connection, or account identity is
//     accepted, encoded, or emitted anywhere in the vocabulary or result;
//   - is fail-closed on every privacy and safety boundary: unknown fields,
//     unknown enum values, private identifier keys, and non-plain records are
//     rejected on input, and no caller-controlled key/value, raw error, stack,
//     payload, SQL, or URL is ever echoed into a result;
//   - keeps the five write-boundary stages distinct and never treats a write
//     acknowledgement as equivalent to a canonical reread confirmation
//     (WRITE_ACKNOWLEDGED != CANONICAL_REREAD_CONFIRMED);
//   - classifies every undecidable timeout / unavailable commit state as
//     WRITE_STATUS_UNKNOWN with retry_safe=false so an unknown write is never
//     blindly retried (reread/reconciliation is required first).
//
// This file intentionally does NOT modify, import, or duplicate the existing
// reliability-sentinel-taxonomy.js (#3835) or the write-read convergence core
// (#3852/#3855). It reuses their bounded outcome semantics by value only.
//
// Refs #4080.
// Refs #3461 — Keep OPEN.
// Refs #3457.
// Refs #3835.
// Refs #3852.
// Refs #3855.
// Refs #4058.
// Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '1';

  // ---------------------------------------------------------------------------
  // Deep-freeze helper (immutable boundary).
  // ---------------------------------------------------------------------------
  function deepFreeze(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      for (var a = 0; a < value.length; a++) deepFreeze(value[a]);
      return Object.freeze(value);
    }
    var keys = Object.keys(value);
    for (var k = 0; k < keys.length; k++) deepFreeze(value[keys[k]]);
    return Object.freeze(value);
  }

  function makeFrozenArray(values) {
    return Object.freeze(values.slice());
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  // Plain own-property record boundary. Only ordinary records whose prototype
  // chain terminates at Object.prototype (or null) are accepted so caller
  // prototype properties, class instances, arrays, and functions can never
  // become authority.
  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return false;
    var proto;
    try {
      proto = Object.getPrototypeOf(value);
    } catch (e) {
      return false;
    }
    if (proto === null) return true;
    var rootProto;
    try {
      rootProto = Object.getPrototypeOf(proto);
    } catch (e) {
      return false;
    }
    return rootProto === null;
  }

  // ---------------------------------------------------------------------------
  // Fixed, sanitized error codes. Bounded and frozen; never a caller value.
  // ---------------------------------------------------------------------------
  var ERROR_CODES = Object.freeze({
    INPUT_NOT_OBJECT: 'INPUT_NOT_OBJECT',
    UNKNOWN_FIELD: 'UNKNOWN_FIELD',
    PRIVATE_FIELD_REJECTED: 'PRIVATE_FIELD_REJECTED',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    UNKNOWN_ENUM: 'UNKNOWN_ENUM',
    NON_CANONICAL_RESULT: 'NON_CANONICAL_RESULT'
  });

  // ---------------------------------------------------------------------------
  // Ordered write-boundary stages — immutable ordering authority. These five
  // stages are kept strictly distinct. A write acknowledgement (server 2xx /
  // accepted) is NEVER equivalent to a canonical reread confirmation.
  // ---------------------------------------------------------------------------
  var WRITE_OUTCOME_STAGE_ORDER = makeFrozenArray([
    'REQUEST_ACCEPTED',
    'DB_TRANSACTION_COMMITTED',
    'CANONICAL_ROW_RETURNED',
    'FOLLOWUP_REREAD_VISIBLE',
    'CLIENT_VISIBLE_SUCCESS'
  ]);

  var WRITE_OUTCOME_STAGES = Object.freeze({
    REQUEST_ACCEPTED: 'REQUEST_ACCEPTED',
    DB_TRANSACTION_COMMITTED: 'DB_TRANSACTION_COMMITTED',
    CANONICAL_ROW_RETURNED: 'CANONICAL_ROW_RETURNED',
    FOLLOWUP_REREAD_VISIBLE: 'FOLLOWUP_REREAD_VISIBLE',
    CLIENT_VISIBLE_SUCCESS: 'CLIENT_VISIBLE_SUCCESS'
  });

  // ---------------------------------------------------------------------------
  // Bounded outcome codes. The first six reuse the existing #3835/#3852/#3855
  // semantics by value; the WRITE_* codes are the narrow server-side additions
  // required by #4080. No provider name appears anywhere in this vocabulary.
  // ---------------------------------------------------------------------------
  var OUTCOME_CODES = Object.freeze({
    CONFIRMED: 'CONFIRMED',
    TRANSPORT_FAILED: 'TRANSPORT_FAILED',
    ACKNOWLEDGEMENT_MISSING: 'ACKNOWLEDGEMENT_MISSING',
    ACKNOWLEDGED_REREAD_MISSING: 'ACKNOWLEDGED_REREAD_MISSING',
    MONITORING_FAILED: 'MONITORING_FAILED',
    INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
    WRITE_REJECTED_VALIDATION: 'WRITE_REJECTED_VALIDATION',
    WRITE_COMMITTED_ROW_RETURNED: 'WRITE_COMMITTED_ROW_RETURNED',
    WRITE_COMMITTED_REREAD_MISSING: 'WRITE_COMMITTED_REREAD_MISSING',
    WRITE_COMMITTED_REREAD_MISMATCH: 'WRITE_COMMITTED_REREAD_MISMATCH',
    WRITE_STATUS_UNKNOWN: 'WRITE_STATUS_UNKNOWN'
  });

  // ---------------------------------------------------------------------------
  // Bounded fact enums. Each fact is a closed vocabulary; free-form values are
  // rejected. No enum carries a provider, host, URL, identifier, or payload.
  // ---------------------------------------------------------------------------
  var TRANSPORT_CLASSES = Object.freeze({
    ok: 'ok',
    timeout: 'timeout',
    network_error: 'network_error',
    not_dispatched: 'not_dispatched'
  });

  var COMMIT_CLASSES = Object.freeze({
    committed: 'committed',
    rolled_back: 'rolled_back',
    not_reached: 'not_reached',
    unknown: 'unknown'
  });

  var RETURNING_CLASSES = Object.freeze({
    row_returned: 'row_returned',
    no_row: 'no_row',
    not_reached: 'not_reached',
    unknown: 'unknown'
  });

  var REREAD_CLASSES = Object.freeze({
    visible: 'visible',
    missing: 'missing',
    mismatch: 'mismatch',
    not_attempted: 'not_attempted',
    unknown: 'unknown'
  });

  var UPSTREAM_STATUS_CLASSES = Object.freeze({
    success_2xx: 'success_2xx',
    client_error_4xx: 'client_error_4xx',
    server_error_5xx: 'server_error_5xx',
    unknown: 'unknown'
  });

  // ---------------------------------------------------------------------------
  // Evidence completeness — bounded; mirrors the #3835 safe vocabulary.
  // ---------------------------------------------------------------------------
  var EVIDENCE_COMPLETENESS = Object.freeze({
    COMPLETE: 'complete',
    PARTIAL: 'partial',
    MISSING: 'missing',
    INVALID: 'invalid'
  });

  // ---------------------------------------------------------------------------
  // Allowed input fields (exact; unknown keys are rejected).
  // ---------------------------------------------------------------------------
  var REQUIRED_FIELDS = makeFrozenArray([
    'transport',
    'commit',
    'returning',
    'reread'
  ]);

  var OPTIONAL_FIELDS = makeFrozenArray([
    'validation_rejected',
    'upstream_status_class',
    'client_visible'
  ]);

  var ALLOWED_FIELDS = (function () {
    return makeFrozenArray(REQUIRED_FIELDS.concat(OPTIONAL_FIELDS));
  })();

  var ALLOWED_FIELD_SET = (function () {
    var s = {};
    for (var i = 0; i < ALLOWED_FIELDS.length; i++) s[ALLOWED_FIELDS[i]] = true;
    return deepFreeze(s);
  })();

  var OPTIONAL_FIELD_SET = (function () {
    var s = {};
    for (var i = 0; i < OPTIONAL_FIELDS.length; i++) s[OPTIONAL_FIELDS[i]] = true;
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // Privacy-sensitive keys — rejected on input. Key-based strict matching. A
  // write-boundary fact must never carry an identifier, credential, payload,
  // SQL, URL, raw error, or provider/connection identity.
  // ---------------------------------------------------------------------------
  var PRIVATE_KEYS = makeFrozenArray([
    'token',
    'cookie',
    'authorization',
    'email',
    'user_id',
    'uid',
    'owner_id',
    'tree_id',
    'memory_id',
    'target_id',
    'title',
    'description',
    'content',
    'memo',
    'url',
    'query',
    'payload',
    'request_body',
    'response_body',
    'sql',
    'raw_error',
    'exception',
    'stack',
    'database_url',
    'request_id',
    'provider',
    'provider_id',
    'connection',
    'account_id',
    'project_id',
    'secret',
    'timestamp',
    'metadata'
  ]);

  var PRIVATE_KEY_SET = (function () {
    var s = {};
    for (var i = 0; i < PRIVATE_KEYS.length; i++) s[PRIVATE_KEYS[i]] = true;
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // Enum membership sets.
  // ---------------------------------------------------------------------------
  function buildSet(enumObj) {
    var s = {};
    var keys = Object.keys(enumObj);
    for (var i = 0; i < keys.length; i++) s[enumObj[keys[i]]] = true;
    return deepFreeze(s);
  }

  var TRANSPORT_SET = buildSet(TRANSPORT_CLASSES);
  var COMMIT_SET = buildSet(COMMIT_CLASSES);
  var RETURNING_SET = buildSet(RETURNING_CLASSES);
  var REREAD_SET = buildSet(REREAD_CLASSES);
  var UPSTREAM_STATUS_SET = buildSet(UPSTREAM_STATUS_CLASSES);
  var STAGE_SET = buildSet(WRITE_OUTCOME_STAGES);
  var OUTCOME_SET = buildSet(OUTCOME_CODES);
  var EVIDENCE_SET = buildSet(EVIDENCE_COMPLETENESS);

  function enumValid(value, set) {
    return (
      value !== undefined &&
      value !== null &&
      Object.prototype.hasOwnProperty.call(set, value) &&
      Boolean(set[value])
    );
  }

  // ---------------------------------------------------------------------------
  // Exact-input validator. Fail closed on any unknown/invalid/private/required
  // violation. Returns { ok, errors } where errors is a frozen array of fixed
  // ERROR_CODES (never a caller-controlled key/value).
  // ---------------------------------------------------------------------------
  function validateWriteOutcomeFacts(input) {
    var errors = [];

    if (!isPlainRecord(input)) {
      return { ok: false, errors: makeFrozenArray([ERROR_CODES.INPUT_NOT_OBJECT]) };
    }

    var keys = Object.keys(input);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (Object.prototype.hasOwnProperty.call(PRIVATE_KEY_SET, key)) {
        errors.push(ERROR_CODES.PRIVATE_FIELD_REJECTED);
      } else if (!Object.prototype.hasOwnProperty.call(ALLOWED_FIELD_SET, key)) {
        errors.push(ERROR_CODES.UNKNOWN_FIELD);
      }
    }

    for (var r = 0; r < REQUIRED_FIELDS.length; r++) {
      var rf = REQUIRED_FIELDS[r];
      if (!hasOwn(input, rf) || input[rf] === undefined || input[rf] === null) {
        errors.push(ERROR_CODES.MISSING_REQUIRED_FIELD);
      }
    }

    if (hasOwn(input, 'transport') && input.transport !== null && !enumValid(input.transport, TRANSPORT_SET)) {
      errors.push(ERROR_CODES.UNKNOWN_ENUM);
    }
    if (hasOwn(input, 'commit') && input.commit !== null && !enumValid(input.commit, COMMIT_SET)) {
      errors.push(ERROR_CODES.UNKNOWN_ENUM);
    }
    if (hasOwn(input, 'returning') && input.returning !== null && !enumValid(input.returning, RETURNING_SET)) {
      errors.push(ERROR_CODES.UNKNOWN_ENUM);
    }
    if (hasOwn(input, 'reread') && input.reread !== null && !enumValid(input.reread, REREAD_SET)) {
      errors.push(ERROR_CODES.UNKNOWN_ENUM);
    }
    if (
      hasOwn(input, 'upstream_status_class') &&
      input.upstream_status_class !== null &&
      input.upstream_status_class !== undefined &&
      !enumValid(input.upstream_status_class, UPSTREAM_STATUS_SET)
    ) {
      errors.push(ERROR_CODES.UNKNOWN_ENUM);
    }
    if (hasOwn(input, 'validation_rejected') && typeof input.validation_rejected !== 'boolean') {
      errors.push(ERROR_CODES.UNKNOWN_ENUM);
    }
    if (hasOwn(input, 'client_visible') && typeof input.client_visible !== 'boolean') {
      errors.push(ERROR_CODES.UNKNOWN_ENUM);
    }

    var unique = [];
    var seen = {};
    var sorted = errors.slice().sort();
    for (var u = 0; u < sorted.length; u++) {
      if (!seen[sorted[u]]) {
        seen[sorted[u]] = true;
        unique.push(sorted[u]);
      }
    }

    return { ok: unique.length === 0, errors: makeFrozenArray(unique) };
  }

  // ---------------------------------------------------------------------------
  // Deterministic classification decision table. Pure and total over validated
  // facts. First matching rule wins. Undecidable commit state always resolves
  // to WRITE_STATUS_UNKNOWN with retry_safe=false.
  // ---------------------------------------------------------------------------
  function decide(facts) {
    var transport = facts.transport;
    var commit = facts.commit;
    var returning = facts.returning;
    var reread = facts.reread;
    var validationRejected = facts.validation_rejected === true;
    var upstreamStatus = facts.upstream_status_class || 'unknown';
    var clientVisible = facts.client_visible === true;

    // Rule 1 — server-side validation rejected before any DB side effect.
    if (validationRejected) {
      return {
        stage: WRITE_OUTCOME_STAGES.REQUEST_ACCEPTED,
        outcome_code: OUTCOME_CODES.WRITE_REJECTED_VALIDATION,
        retry_safe: true,
        evidence_completeness: EVIDENCE_COMPLETENESS.COMPLETE
      };
    }

    // Rule 2 — never dispatched: no acknowledgement possible.
    if (transport === TRANSPORT_CLASSES.not_dispatched) {
      return {
        stage: WRITE_OUTCOME_STAGES.REQUEST_ACCEPTED,
        outcome_code: OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING,
        retry_safe: true,
        evidence_completeness: EVIDENCE_COMPLETENESS.COMPLETE
      };
    }

    // Rule 3 — undecidable timeout: commit state unknown. Blind retry forbidden.
    if (transport === TRANSPORT_CLASSES.timeout && commit === COMMIT_CLASSES.unknown) {
      return {
        stage: WRITE_OUTCOME_STAGES.REQUEST_ACCEPTED,
        outcome_code: OUTCOME_CODES.WRITE_STATUS_UNKNOWN,
        retry_safe: false,
        evidence_completeness: EVIDENCE_COMPLETENESS.PARTIAL
      };
    }

    // Rule 4 — transport failed and nothing committed (decidable).
    if (
      (transport === TRANSPORT_CLASSES.network_error || transport === TRANSPORT_CLASSES.timeout) &&
      (commit === COMMIT_CLASSES.rolled_back || commit === COMMIT_CLASSES.not_reached)
    ) {
      return {
        stage: WRITE_OUTCOME_STAGES.REQUEST_ACCEPTED,
        outcome_code: OUTCOME_CODES.TRANSPORT_FAILED,
        retry_safe: true,
        evidence_completeness: EVIDENCE_COMPLETENESS.COMPLETE
      };
    }

    // Rule 5 — network error with undecidable commit state. Blind retry forbidden.
    if (transport === TRANSPORT_CLASSES.network_error && commit === COMMIT_CLASSES.unknown) {
      return {
        stage: WRITE_OUTCOME_STAGES.REQUEST_ACCEPTED,
        outcome_code: OUTCOME_CODES.WRITE_STATUS_UNKNOWN,
        retry_safe: false,
        evidence_completeness: EVIDENCE_COMPLETENESS.PARTIAL
      };
    }

    // Rule 6 — transport ok but commit state unknown. Blind retry forbidden.
    if (commit === COMMIT_CLASSES.unknown) {
      return {
        stage: WRITE_OUTCOME_STAGES.REQUEST_ACCEPTED,
        outcome_code: OUTCOME_CODES.WRITE_STATUS_UNKNOWN,
        retry_safe: false,
        evidence_completeness: EVIDENCE_COMPLETENESS.PARTIAL
      };
    }

    // Rule 7 — transaction did not commit (rolled back / not reached).
    if (commit === COMMIT_CLASSES.rolled_back || commit === COMMIT_CLASSES.not_reached) {
      if (upstreamStatus === UPSTREAM_STATUS_CLASSES.client_error_4xx) {
        return {
          stage: WRITE_OUTCOME_STAGES.REQUEST_ACCEPTED,
          outcome_code: OUTCOME_CODES.WRITE_REJECTED_VALIDATION,
          retry_safe: true,
          evidence_completeness: EVIDENCE_COMPLETENESS.COMPLETE
        };
      }
      return {
        stage: WRITE_OUTCOME_STAGES.REQUEST_ACCEPTED,
        outcome_code: OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING,
        retry_safe: true,
        evidence_completeness: EVIDENCE_COMPLETENESS.COMPLETE
      };
    }

    // Rule 8 — commit === 'committed'. Distinguish by RETURNING then reread.
    if (returning === RETURNING_CLASSES.row_returned) {
      if (reread === REREAD_CLASSES.visible) {
        return {
          stage: clientVisible
            ? WRITE_OUTCOME_STAGES.CLIENT_VISIBLE_SUCCESS
            : WRITE_OUTCOME_STAGES.FOLLOWUP_REREAD_VISIBLE,
          outcome_code: OUTCOME_CODES.CONFIRMED,
          retry_safe: false,
          evidence_completeness: EVIDENCE_COMPLETENESS.COMPLETE
        };
      }
      if (reread === REREAD_CLASSES.missing) {
        return {
          stage: WRITE_OUTCOME_STAGES.CANONICAL_ROW_RETURNED,
          outcome_code: OUTCOME_CODES.WRITE_COMMITTED_REREAD_MISSING,
          retry_safe: false,
          evidence_completeness: EVIDENCE_COMPLETENESS.COMPLETE
        };
      }
      if (reread === REREAD_CLASSES.mismatch) {
        return {
          stage: WRITE_OUTCOME_STAGES.CANONICAL_ROW_RETURNED,
          outcome_code: OUTCOME_CODES.WRITE_COMMITTED_REREAD_MISMATCH,
          retry_safe: false,
          evidence_completeness: EVIDENCE_COMPLETENESS.COMPLETE
        };
      }
      // reread not_attempted / unknown: committed + canonical row returned,
      // follow-up reread not yet confirmed.
      return {
        stage: WRITE_OUTCOME_STAGES.CANONICAL_ROW_RETURNED,
        outcome_code: OUTCOME_CODES.WRITE_COMMITTED_ROW_RETURNED,
        retry_safe: false,
        evidence_completeness: EVIDENCE_COMPLETENESS.PARTIAL
      };
    }

    if (returning === RETURNING_CLASSES.no_row) {
      return {
        stage: WRITE_OUTCOME_STAGES.DB_TRANSACTION_COMMITTED,
        outcome_code: OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING,
        retry_safe: false,
        evidence_completeness: EVIDENCE_COMPLETENESS.COMPLETE
      };
    }

    // committed but RETURNING evidence absent — insufficient returning evidence.
    return {
      stage: WRITE_OUTCOME_STAGES.DB_TRANSACTION_COMMITTED,
      outcome_code: OUTCOME_CODES.INSUFFICIENT_EVIDENCE,
      retry_safe: false,
      evidence_completeness: EVIDENCE_COMPLETENESS.PARTIAL
    };
  }

  // ---------------------------------------------------------------------------
  // Canonical bounded result builder. Fails closed (throws) on any invalid
  // input with a single fixed ERROR_CODE. Returns a deep-frozen, canonical
  // result. The caller's input is never mutated.
  // ---------------------------------------------------------------------------
  function classifyWriteOutcome(input) {
    var validation = validateWriteOutcomeFacts(input);
    if (!validation.ok) {
      throw new TypeError(validation.errors[0]);
    }

    var facts = {
      transport: input.transport,
      commit: input.commit,
      returning: input.returning,
      reread: input.reread,
      validation_rejected: input.validation_rejected === true,
      upstream_status_class: input.upstream_status_class || 'unknown',
      client_visible: input.client_visible === true
    };

    var decision = decide(facts);
    return deepFreeze({
      stage: decision.stage,
      outcome_code: decision.outcome_code,
      retry_safe: decision.retry_safe,
      evidence_completeness: decision.evidence_completeness
    });
  }

  // ---------------------------------------------------------------------------
  // Canonical-result validator. Only a fully bounded, frozen result passes.
  // ---------------------------------------------------------------------------
  function isCanonicalResult(value) {
    if (Object.isFrozen(value) !== true) return false;
    if (!isPlainRecord(value)) return false;

    if (!hasOwn(value, 'stage') || !enumValid(value.stage, STAGE_SET)) return false;
    if (!hasOwn(value, 'outcome_code') || !enumValid(value.outcome_code, OUTCOME_SET)) return false;
    if (!hasOwn(value, 'retry_safe') || typeof value.retry_safe !== 'boolean') return false;
    if (
      !hasOwn(value, 'evidence_completeness') ||
      !enumValid(value.evidence_completeness, EVIDENCE_SET)
    ) {
      return false;
    }

    var keys = Object.keys(value);
    if (keys.length !== 4) return false;
    for (var i = 0; i < keys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(PRIVATE_KEY_SET, keys[i])) return false;
    }

    // CONFIRMED is only ever emitted at or beyond a confirmed reread stage.
    if (value.outcome_code === OUTCOME_CODES.CONFIRMED) {
      if (
        value.stage !== WRITE_OUTCOME_STAGES.FOLLOWUP_REREAD_VISIBLE &&
        value.stage !== WRITE_OUTCOME_STAGES.CLIENT_VISIBLE_SUCCESS
      ) {
        return false;
      }
    }

    // WRITE_STATUS_UNKNOWN must never be retry-safe (no blind retry).
    if (value.outcome_code === OUTCOME_CODES.WRITE_STATUS_UNKNOWN && value.retry_safe !== false) {
      return false;
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Core safety invariant: a write acknowledgement is NEVER equivalent to a
  // canonical reread confirmation. Exposed as a constant for contract tests.
  // ---------------------------------------------------------------------------
  var WRITE_ACKNOWLEDGED_EQUALS_REREAD_CONFIRMED = false;

  // ---------------------------------------------------------------------------
  // Capabilities — pure source authority; zero capabilities.
  // ---------------------------------------------------------------------------
  var CAPABILITIES = Object.freeze([]);

  // ---------------------------------------------------------------------------
  // Public API.
  // ---------------------------------------------------------------------------
  var WRITE_OUTCOME_CLASSIFIER_CORE = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,

    WRITE_OUTCOME_STAGE_ORDER: WRITE_OUTCOME_STAGE_ORDER,
    WRITE_OUTCOME_STAGES: WRITE_OUTCOME_STAGES,
    OUTCOME_CODES: OUTCOME_CODES,
    TRANSPORT_CLASSES: TRANSPORT_CLASSES,
    COMMIT_CLASSES: COMMIT_CLASSES,
    RETURNING_CLASSES: RETURNING_CLASSES,
    REREAD_CLASSES: REREAD_CLASSES,
    UPSTREAM_STATUS_CLASSES: UPSTREAM_STATUS_CLASSES,
    EVIDENCE_COMPLETENESS: EVIDENCE_COMPLETENESS,

    REQUIRED_FIELDS: REQUIRED_FIELDS,
    OPTIONAL_FIELDS: OPTIONAL_FIELDS,
    ALLOWED_FIELDS: ALLOWED_FIELDS,
    PRIVATE_KEYS: PRIVATE_KEYS,
    ERROR_CODES: ERROR_CODES,
    CAPABILITIES: CAPABILITIES,

    STAGE_SET: STAGE_SET,
    OUTCOME_SET: OUTCOME_SET,
    TRANSPORT_SET: TRANSPORT_SET,
    COMMIT_SET: COMMIT_SET,
    RETURNING_SET: RETURNING_SET,
    REREAD_SET: REREAD_SET,
    UPSTREAM_STATUS_SET: UPSTREAM_STATUS_SET,
    EVIDENCE_SET: EVIDENCE_SET,

    WRITE_ACKNOWLEDGED_EQUALS_REREAD_CONFIRMED: WRITE_ACKNOWLEDGED_EQUALS_REREAD_CONFIRMED,

    isPlainRecord: isPlainRecord,
    validateWriteOutcomeFacts: validateWriteOutcomeFacts,
    classifyWriteOutcome: classifyWriteOutcome,
    isCanonicalResult: isCanonicalResult
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WRITE_OUTCOME_CLASSIFIER_CORE;
  }
  if (typeof window !== 'undefined') {
    window.LoveBudWriteOutcomeClassifierCore = WRITE_OUTCOME_CLASSIFIER_CORE;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.LoveBudWriteOutcomeClassifierCore = WRITE_OUTCOME_CLASSIFIER_CORE;
  }
})(this);
