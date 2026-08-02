'use strict';

// Issue #3835 — Reliability & Observability child (parent #3461).
// Draft PR #3837.
//
// Independent privacy-safe reliability sentinel and write-read outcome
// taxonomy authority.
//
// This module is a PURE SOURCE AUTHORITY. It:
//   - carries NO capability (no network, provider, database, SQL, filesystem
//     write, process, or alert execution);
//   - rejects unknown fields, unknown enum values, invalid release SHA, and
//     every private identifier key on both input and output;
//   - is fail-closed on privacy boundaries: validation and canonical
//     serialization never include a caller-controlled key/value, never echo a
//     raw exception, and never disclose a stack;
//   - never persists, never writes, never executes a sentinel, and never
//     delivers an alert;
//   - exposes only bounded, immutable, deterministic, byte-stable authority.
//
// This file intentionally does NOT modify, import, or copy the existing
// journey-outcome-taxonomy.js or release-health-taxonomy.cjs authorities.
//
// Refs #3835.
// Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '1';

  // ---------------------------------------------------------------------------
  // Deep-freeze helper (equivalent immutable boundary).
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
    var target = values.slice();
    return Object.freeze(target);
  }

  // Own-property existence only. Inherited (prototype-carried) properties are
  // NEVER treated as present: an inherited required field is missing, an
  // inherited optional field is absent, and an inherited private field is never
  // read as authority.
  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  // Plain own-property record boundary. Only ordinary records whose prototype
  // is exactly Object.prototype or null are accepted. Date/Map/Set/class
  // instances/functions/arrays (and any caller-controlled prototype) are
  // rejected so caller prototype properties can never become authority.
  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  // ---------------------------------------------------------------------------
  // Operation classes (structural schema / parity plus write-read converge).
  // ---------------------------------------------------------------------------
  var OPERATION_CLASSES = Object.freeze({
    STRUCTURAL_SCHEMA_CHECK: 'STRUCTURAL_SCHEMA_CHECK',
    TREE_PARENT_INTEGRITY_CHECK: 'TREE_PARENT_INTEGRITY_CHECK',
    MEMORY_PARENT_INTEGRITY_CHECK: 'MEMORY_PARENT_INTEGRITY_CHECK',
    SOCIAL_TARGET_INTEGRITY_CHECK: 'SOCIAL_TARGET_INTEGRITY_CHECK',
    BROWSE_ELIGIBILITY_BASELINE_CHECK: 'BROWSE_ELIGIBILITY_BASELINE_CHECK',
    TREE_CREATE_CONVERGENCE: 'TREE_CREATE_CONVERGENCE',
    MEMORY_CREATE_CONVERGENCE: 'MEMORY_CREATE_CONVERGENCE',
    PUBLIC_THRESHOLD_CONVERGENCE: 'PUBLIC_THRESHOLD_CONVERGENCE'
  });

  // ---------------------------------------------------------------------------
  // Ordered convergence stages — immutable ordering authority.
  // ---------------------------------------------------------------------------
  var CONVERGENCE_STAGE_ORDER = makeFrozenArray([
    'REQUEST_DISPATCHED',
    'SERVER_ACKNOWLEDGED',
    'PERSISTED_REREAD_CONFIRMED',
    'UI_RENDER_CONFIRMED',
    'BROWSE_ELIGIBILITY_CONFIRMED'
  ]);

  var CONVERGENCE_STAGES = Object.freeze({
    REQUEST_DISPATCHED: 'REQUEST_DISPATCHED',
    SERVER_ACKNOWLEDGED: 'SERVER_ACKNOWLEDGED',
    PERSISTED_REREAD_CONFIRMED: 'PERSISTED_REREAD_CONFIRMED',
    UI_RENDER_CONFIRMED: 'UI_RENDER_CONFIRMED',
    BROWSE_ELIGIBILITY_CONFIRMED: 'BROWSE_ELIGIBILITY_CONFIRMED'
  });

  var STAGE_ORDER_INDEX = (function () {
    var map = {};
    for (var i = 0; i < CONVERGENCE_STAGE_ORDER.length; i++) {
      map[CONVERGENCE_STAGE_ORDER[i]] = i;
    }
    return deepFreeze(map);
  })();

  // ---------------------------------------------------------------------------
  // Bounded outcome codes — free-form codes are rejected.
  // ---------------------------------------------------------------------------
  var OUTCOME_CODES = Object.freeze({
    CONFIRMED: 'CONFIRMED',
    TRANSPORT_FAILED: 'TRANSPORT_FAILED',
    ACKNOWLEDGEMENT_MISSING: 'ACKNOWLEDGEMENT_MISSING',
    ACKNOWLEDGED_REREAD_MISSING: 'ACKNOWLEDGED_REREAD_MISSING',
    REREAD_CONFIRMED_UI_MISSING: 'REREAD_CONFIRMED_UI_MISSING',
    PUBLIC_THRESHOLD_NOT_CONFIRMED: 'PUBLIC_THRESHOLD_NOT_CONFIRMED',
    SCHEMA_AUTHORITY_UNAVAILABLE: 'SCHEMA_AUTHORITY_UNAVAILABLE',
    STRUCTURAL_DRIFT_DETECTED: 'STRUCTURAL_DRIFT_DETECTED',
    ORPHAN_SIGNAL_DETECTED: 'ORPHAN_SIGNAL_DETECTED',
    BASELINE_DISCONTINUITY_DETECTED: 'BASELINE_DISCONTINUITY_DETECTED',
    MONITORING_FAILED: 'MONITORING_FAILED',
    INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
  });

  // ---------------------------------------------------------------------------
  // Baseline-deviation classes — no numeric thresholds embedded anywhere.
  // ---------------------------------------------------------------------------
  var BASELINE_DEVIATION_CLASSES = Object.freeze({
    NONE: 'NONE',
    EXPECTED_VARIATION: 'EXPECTED_VARIATION',
    MATERIAL_DEVIATION: 'MATERIAL_DEVIATION',
    CRITICAL_DISCONTINUITY: 'CRITICAL_DISCONTINUITY',
    UNKNOWN: 'UNKNOWN'
  });

  // ---------------------------------------------------------------------------
  // Severity.
  // ---------------------------------------------------------------------------
  var SEVERITIES = Object.freeze({
    INFO: 'INFO',
    WARNING: 'WARNING',
    BLOCKING: 'BLOCKING'
  });

  // ---------------------------------------------------------------------------
  // Advisory owner actions — enum only, never executed.
  // ---------------------------------------------------------------------------
  var OWNER_ACTIONS = Object.freeze({
    NO_ACTION: 'NO_ACTION',
    OBSERVE: 'OBSERVE',
    INVESTIGATE: 'INVESTIGATE',
    STOP_SYNTHETIC_WRITES: 'STOP_SYNTHETIC_WRITES',
    OWNER_DECISION_REQUIRED: 'OWNER_DECISION_REQUIRED'
  });

  // ---------------------------------------------------------------------------
  // Evidence completeness — bounded; only 'complete' may resolve CONFIRMED.
  // ---------------------------------------------------------------------------
  var EVIDENCE_COMPLETENESS = Object.freeze({
    COMPLETE: 'complete',
    PARTIAL: 'partial',
    MISSING: 'missing',
    INVALID: 'invalid'
  });

  // ---------------------------------------------------------------------------
  // Latency buckets (bounded; mirrors safe vocabulary without timestamps).
  // ---------------------------------------------------------------------------
  var LATENCY_BUCKETS = Object.freeze({
    LT_250_MS: 'LT_250_MS',
    LT_500_MS: 'LT_500_MS',
    LT_1_S: 'LT_1_S',
    LT_2_S: 'LT_2_S',
    LT_5_S: 'LT_5_S',
    GTE_5_S: 'GTE_5_S',
    TIMEOUT_OR_UNKNOWN: 'TIMEOUT_OR_UNKNOWN'
  });

  // ---------------------------------------------------------------------------
  // Count buckets (bounded; never raw counts).
  // ---------------------------------------------------------------------------
  var COUNT_BUCKETS = Object.freeze({
    ZERO: 'zero',
    POSITIVE: 'positive',
    UNKNOWN: 'unknown'
  });

  // ---------------------------------------------------------------------------
  // Allowed input/output fields (exact; unknown keys are rejected).
  // ---------------------------------------------------------------------------
  var ALLOWED_FIELDS = makeFrozenArray([
    'operation_class',
    'stage',
    'outcome_code',
    'release_sha',
    'latency_bucket',
    'count_bucket',
    'baseline_deviation',
    'severity',
    'owner_action',
    'evidence_completeness'
  ]);

  var ALLOWED_FIELD_SET = (function () {
    var s = {};
    for (var i = 0; i < ALLOWED_FIELDS.length; i++) s[ALLOWED_FIELDS[i]] = true;
    return deepFreeze(s);
  })();

  // Required core fields (never defaulted to undefined; must be supplied).
  var REQUIRED_FIELDS = makeFrozenArray([
    'operation_class',
    'stage',
    'outcome_code',
    'release_sha',
    'baseline_deviation',
    'severity',
    'owner_action',
    'evidence_completeness'
  ]);

  // Optional fields (absent is allowed; still bounded when present).
  var OPTIONAL_FIELDS = makeFrozenArray(['latency_bucket', 'count_bucket']);

  var OPTIONAL_FIELD_SET = (function () {
    var s = {};
    for (var i = 0; i < OPTIONAL_FIELDS.length; i++) s[OPTIONAL_FIELDS[i]] = true;
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // Privacy-sensitive keys — rejected on BOTH input and output. Key-based strict
  // matching (NOT substring), so legitimate bounded enums (e.g. owner_action,
  // baseline_deviation) are never falsely rejected.
  // ---------------------------------------------------------------------------
  var PRIVATE_KEYS = makeFrozenArray([
    'token',
    'cookie',
    'authorization',
    'email',
    'user_id',
    'owner_id',
    'tree_id',
    'memory_id',
    'target_id',
    'title',
    'description',
    'content',
    'url',
    'query',
    'request_body',
    'response_body',
    'raw_error',
    'exception',
    'stack',
    'database_url',
    'request_id',
    'provider_id',
    'account_id',
    'project_id',
    'timestamp',
    'metadata'
  ]);

  var PRIVATE_KEY_SET = (function () {
    var s = {};
    for (var i = 0; i < PRIVATE_KEYS.length; i++) s[PRIVATE_KEYS[i]] = true;
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // Fixed, sanitized error codes. These are bounded, frozen and carry NO
  // caller-controlled key or value, no raw exception, and no stack. Thrown
  // errors expose only these codes (never a serialized validation list).
  // ---------------------------------------------------------------------------
  var ERROR_CODES = Object.freeze({
    INPUT_NOT_OBJECT: 'INPUT_NOT_OBJECT',
    UNKNOWN_FIELD: 'UNKNOWN_FIELD',
    PRIVATE_FIELD_REJECTED: 'PRIVATE_FIELD_REJECTED',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    UNKNOWN_ENUM: 'UNKNOWN_ENUM',
    INVALID_RELEASE_SHA: 'INVALID_RELEASE_SHA',
    CONFIRMED_EVIDENCE_INCOMPLETE: 'CONFIRMED_EVIDENCE_INCOMPLETE',
    NON_CANONICAL_RESULT: 'NON_CANONICAL_RESULT',
    UNKNOWN_KIND: 'UNKNOWN_KIND',
    UNKNOWN_VALUE: 'UNKNOWN_VALUE'
  });

  // ---------------------------------------------------------------------------
  // Set guards.
  // ---------------------------------------------------------------------------
  var OPERATION_SET = (function () { var s = {}; for (var k in OPERATION_CLASSES) { if (Object.prototype.hasOwnProperty.call(OPERATION_CLASSES, k)) s[OPERATION_CLASSES[k]] = true; } return deepFreeze(s); })();
  var STAGE_SET = (function () { var s = {}; for (var k in CONVERGENCE_STAGES) { if (CONVERGENCE_STAGES[k]) s[CONVERGENCE_STAGES[k]] = true; } return deepFreeze(s); })();
  var OUTCOME_SET = (function () { var s = {}; for (var k in OUTCOME_CODES) { if (Object.prototype.hasOwnProperty.call(OUTCOME_CODES, k)) s[OUTCOME_CODES[k]] = true; } return deepFreeze(s); })();
  var DEVIATION_SET = (function () { var s = {}; for (var k in BASELINE_DEVIATION_CLASSES) { if (Object.prototype.hasOwnProperty.call(BASELINE_DEVIATION_CLASSES, k)) s[BASELINE_DEVIATION_CLASSES[k]] = true; } return deepFreeze(s); })();
  var SEVERITY_SET = (function () { var s = {}; for (var k in SEVERITIES) { if (SEVERITIES[k]) s[SEVERITIES[k]] = true; } return deepFreeze(s); })();
  var ACTION_SET = (function () { var s = {}; for (var k in OWNER_ACTIONS) { if (Object.prototype.hasOwnProperty.call(OWNER_ACTIONS, k)) s[OWNER_ACTIONS[k]] = true; } return deepFreeze(s); })();
  var EVIDENCE_SET = (function () { var s = {}; for (var k in EVIDENCE_COMPLETENESS) { if (Object.prototype.hasOwnProperty.call(EVIDENCE_COMPLETENESS, k)) s[EVIDENCE_COMPLETENESS[k]] = true; } return deepFreeze(s); })();
  var LATENCY_SET = (function () { var s = {}; for (var k in LATENCY_BUCKETS) { if (LATENCY_BUCKETS[k]) s[LATENCY_BUCKETS[k]] = true; } return deepFreeze(s); })();
  var COUNT_SET = (function () { var s = {}; for (var k in COUNT_BUCKETS) { if (COUNT_BUCKETS[k]) s[COUNT_BUCKETS[k]] = true; } return deepFreeze(s); })();

  // ---------------------------------------------------------------------------
  // release_sha: lowercase 40-char hex only.
  // ---------------------------------------------------------------------------
  var RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;

  function isValidReleaseSha(value) {
    if (typeof value !== 'string') return false;
    return RELEASE_SHA_PATTERN.test(value);
  }

  // ---------------------------------------------------------------------------
  // Deterministic canonical byte-stable JSON. Keys are sorted; identical input
  // always yields identical bytes.
  // ---------------------------------------------------------------------------
  function replacerSorted(key, value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    var out = {};
    var keys = Object.keys(value).sort();
    for (var i = 0; i < keys.length; i++) {
      var v = value[keys[i]];
      if (v !== undefined) out[keys[i]] = v;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Enum guards used by validation and canonical serialization.
  // ---------------------------------------------------------------------------
  function enumValid(value, set) {
    return value !== undefined && value !== null && Object.prototype.hasOwnProperty.call(set, value) && Boolean(set[value]);
  }

  // ---------------------------------------------------------------------------
  // Exact-input validator. Fail closed on any unknown/invalid/private/required
  // violation. Returns { ok, errors } where errors is a frozen array of fixed
  // ERROR_CODES (never a caller-controlled key/value).
  // ---------------------------------------------------------------------------
  function validateInput(input) {
    var errors = [];

    // Plain own-property record boundary: only Object.prototype or null
    // prototype records. Date/Map/Set/class instance/function/array and any
    // caller-controlled prototype are rejected up front.
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

    // Required fields must be OWN properties. A prototype-carried (inherited)
    // required field is treated as MISSING (never read as authority).
    for (var r = 0; r < REQUIRED_FIELDS.length; r++) {
      var rf = REQUIRED_FIELDS[r];
      if (!hasOwn(input, rf) || input[rf] === undefined || input[rf] === null) {
        errors.push(ERROR_CODES.MISSING_REQUIRED_FIELD);
      }
    }

    if (hasOwn(input, 'operation_class') && !enumValid(input.operation_class, OPERATION_SET)) errors.push(ERROR_CODES.UNKNOWN_ENUM);
    if (hasOwn(input, 'stage') && !enumValid(input.stage, STAGE_SET)) errors.push(ERROR_CODES.UNKNOWN_ENUM);
    if (hasOwn(input, 'outcome_code') && !enumValid(input.outcome_code, OUTCOME_SET)) errors.push(ERROR_CODES.UNKNOWN_ENUM);
    if (hasOwn(input, 'baseline_deviation') && !enumValid(input.baseline_deviation, DEVIATION_SET)) errors.push(ERROR_CODES.UNKNOWN_ENUM);
    if (hasOwn(input, 'severity') && !enumValid(input.severity, SEVERITY_SET)) errors.push(ERROR_CODES.UNKNOWN_ENUM);
    if (hasOwn(input, 'owner_action') && !enumValid(input.owner_action, ACTION_SET)) errors.push(ERROR_CODES.UNKNOWN_ENUM);
    if (hasOwn(input, 'evidence_completeness') && !enumValid(input.evidence_completeness, EVIDENCE_SET)) errors.push(ERROR_CODES.UNKNOWN_ENUM);
    if (hasOwn(input, 'latency_bucket') && !enumValid(input.latency_bucket, LATENCY_SET)) errors.push(ERROR_CODES.UNKNOWN_ENUM);
    if (hasOwn(input, 'count_bucket') && !enumValid(input.count_bucket, COUNT_SET)) errors.push(ERROR_CODES.UNKNOWN_ENUM);

    if (hasOwn(input, 'release_sha') && !isValidReleaseSha(input.release_sha)) {
      errors.push(ERROR_CODES.INVALID_RELEASE_SHA);
    }

    // CONFIRMED is only ever accepted when evidence is COMPLETE. Completion by
    // partial/missing/invalid evidence is rejected (fail closed). Both values
    // are read only when they are own properties.
    if (hasOwn(input, 'outcome_code') && input.outcome_code === OUTCOME_CODES.CONFIRMED) {
      if (hasOwn(input, 'evidence_completeness') && input.evidence_completeness !== EVIDENCE_COMPLETENESS.COMPLETE) {
        errors.push(ERROR_CODES.CONFIRMED_EVIDENCE_INCOMPLETE);
      }
    }

    var unique = [];
    var seen = {};
    var sorted = errors.slice().sort();
    for (var u = 0; u < sorted.length; u++) {
      if (!seen[sorted[u]]) { seen[sorted[u]] = true; unique.push(sorted[u]); }
    }

    return { ok: unique.length === 0, errors: makeFrozenArray(unique) };
  }

  // ---------------------------------------------------------------------------
  // Canonical bounded result builder. Fails closed (throws) on any invalid
  // input with a single fixed ERROR_CODE (never a raw value/list). Returns a
  // deep-frozen, canonical result carrying only allowed fields and never an
  // undefined core field. The caller's input is never mutated.
  // ---------------------------------------------------------------------------
  function buildBoundedResult(input) {
    var validation = validateInput(input);
    if (!validation.ok) {
      throw new TypeError(validation.errors[0]);
    }

    // Build a fully detached ordinary own-property record. Only own values from
    // the validated input are copied; the caller's prototype never leaks in.
    var result = {};
    for (var f = 0; f < REQUIRED_FIELDS.length; f++) {
      result[REQUIRED_FIELDS[f]] = input[REQUIRED_FIELDS[f]];
    }
    for (var o = 0; o < OPTIONAL_FIELDS.length; o++) {
      if (hasOwn(input, OPTIONAL_FIELDS[o])) {
        result[OPTIONAL_FIELDS[o]] = input[OPTIONAL_FIELDS[o]];
      }
    }

    return deepFreeze(result);
  }

  // ---------------------------------------------------------------------------
  // Canonical-result validator. canonicalJson() only ever serializes an object
  // that passes this strict bound so arbitrary caller objects (containing
  // tokens, raw errors, unknown keys or free-form enums) can never be emitted.
  // ---------------------------------------------------------------------------
  function isCanonicalResult(value) {
    if (Object.isFrozen(value) !== true) return false;
    if (!isPlainRecord(value)) return false;

    var keys = Object.keys(value);
    if (keys.length === 0) return false;

    // Canonical exact own-key shape: every own key must be allowed, no private
    // key may be present (own or inherited), and the own-key count must equal
    // the 8 required own fields plus the own optional fields (0..2). This is
    // the cardinality guard: an object can never pass with an incomplete or
    // inflated key set.
    var optionalOwn = 0;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!Object.prototype.hasOwnProperty.call(ALLOWED_FIELD_SET, key)) return false;
      if (Object.prototype.hasOwnProperty.call(PRIVATE_KEY_SET, key)) return false;
      if (Object.prototype.hasOwnProperty.call(OPTIONAL_FIELD_SET, key)) optionalOwn++;
    }
    if (keys.length !== REQUIRED_FIELDS.length + optionalOwn) return false;

    // Required fields must be OWN properties (inherited required fields are not
    // authority and are rejected).
    for (var r = 0; r < REQUIRED_FIELDS.length; r++) {
      if (!hasOwn(value, REQUIRED_FIELDS[r]) || value[REQUIRED_FIELDS[r]] === undefined) return false;
    }

    if (!enumValid(value.operation_class, OPERATION_SET)) return false;
    if (!enumValid(value.stage, STAGE_SET)) return false;
    if (!enumValid(value.outcome_code, OUTCOME_SET)) return false;
    if (!enumValid(value.baseline_deviation, DEVIATION_SET)) return false;
    if (!enumValid(value.severity, SEVERITY_SET)) return false;
    if (!enumValid(value.owner_action, ACTION_SET)) return false;
    if (!enumValid(value.evidence_completeness, EVIDENCE_SET)) return false;
    if (hasOwn(value, 'latency_bucket') && !enumValid(value.latency_bucket, LATENCY_SET)) return false;
    if (hasOwn(value, 'count_bucket') && !enumValid(value.count_bucket, COUNT_SET)) return false;

    if (!isValidReleaseSha(value.release_sha)) return false;

    if (value.outcome_code === OUTCOME_CODES.CONFIRMED) {
      if (value.evidence_completeness !== EVIDENCE_COMPLETENESS.COMPLETE) return false;
    }

    return true;
  }

  function canonicalJson(value) {
    if (!isCanonicalResult(value)) {
      throw new TypeError(ERROR_CODES.NON_CANONICAL_RESULT);
    }
    return JSON.stringify(value, replacerSorted);
  }

  // ---------------------------------------------------------------------------
  // Repository-owned enum sets for bounded list normalization. A caller can
  // never supply an arbitrary allowed set; only these fixed kinds exist.
  // ---------------------------------------------------------------------------
  var NORMALIZE_ENUM_SETS = (function () {
    var sets = {
      operation_class: OPERATION_SET,
      stage: STAGE_SET,
      outcome_code: OUTCOME_SET,
      baseline_deviation: DEVIATION_SET,
      severity: SEVERITY_SET,
      owner_action: ACTION_SET,
      evidence: EVIDENCE_SET,
      latency_bucket: LATENCY_SET,
      count_bucket: COUNT_SET
    };
    return Object.freeze(sets);
  })();

  // Bounded list normalization: only repository-owned enum VALUES for a fixed
  // kind are allowed. Free-form values and private identifiers are rejected.
  function normalizeBoundedList(kind, values) {
    var set = NORMALIZE_ENUM_SETS[kind];
    if (!set) {
      throw new TypeError(ERROR_CODES.UNKNOWN_KIND);
    }
    if (!Array.isArray(values)) {
      throw new TypeError(ERROR_CODES.UNKNOWN_VALUE);
    }
    var unique = [];
    var seen = {};
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (!enumValid(v, set)) {
        throw new TypeError(ERROR_CODES.UNKNOWN_VALUE);
      }
      if (!seen[v]) { seen[v] = true; unique.push(v); }
    }
    unique.sort();
    return deepFreeze(unique);
  }

  // ---------------------------------------------------------------------------
  // Capabilities — this is a pure source authority; zero capabilities.
  // ---------------------------------------------------------------------------
  var CAPABILITIES = Object.freeze([]);

  // ---------------------------------------------------------------------------
  // Public API (exposed for both CommonJS and browser global).
  // ---------------------------------------------------------------------------
  var RELIABILITY_SENTINEL_TAXONOMY = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,

    OPERATION_CLASSES: OPERATION_CLASSES,
    CONVERGENCE_STAGE_ORDER: CONVERGENCE_STAGE_ORDER,
    CONVERGENCE_STAGES: CONVERGENCE_STAGES,
    STAGE_INDEX: STAGE_ORDER_INDEX, // stageIndex -> position (frozen)
    OUTCOME_CODES: OUTCOME_CODES,
    BASELINE_DEVIATION_CLASSES: BASELINE_DEVIATION_CLASSES,
    SEVERITIES: SEVERITIES,
    OWNER_ACTIONS: OWNER_ACTIONS,
    EVIDENCE_COMPLETENESS: EVIDENCE_COMPLETENESS,
    LATENCY_BUCKETS: LATENCY_BUCKETS,
    COUNT_BUCKETS: COUNT_BUCKETS,
    ALLOWED_FIELDS: ALLOWED_FIELDS,
    REQUIRED_FIELDS: REQUIRED_FIELDS,
    OPTIONAL_FIELDS: OPTIONAL_FIELDS,
    OPTIONAL_FIELD_SET: OPTIONAL_FIELD_SET,
    ERROR_CODES: ERROR_CODES,
    PRIVATE_KEYS: PRIVATE_KEYS,
    CAPABILITIES: CAPABILITIES,

    OPERATION_CLASS_SET: OPERATION_SET,
    STAGE_SET: STAGE_SET,
    OUTCOME_CODE_SET: OUTCOME_SET,
    DEVIATION_SET: DEVIATION_SET,
    SEVERITY_SET: SEVERITY_SET,
    OWNER_ACTION_SET: ACTION_SET,
    EVIDENCE_COMPLETENESS_SET: EVIDENCE_SET,
    LATENCY_BUCKET_SET: LATENCY_SET,
    COUNT_BUCKET_SET: COUNT_SET,

    RELEASE_SHA_PATTERN: RELEASE_SHA_PATTERN,

    isPlainRecord: isPlainRecord,
    isValidReleaseSha: isValidReleaseSha,
    validateInput: validateInput,
    buildBoundedResult: buildBoundedResult,
    isCanonicalResult: isCanonicalResult,
    canonicalJson: canonicalJson,
    normalizeBoundedList: normalizeBoundedList
  });

  // Attach to CommonJS / browser global.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RELIABILITY_SENTINEL_TAXONOMY;
  }
  if (typeof window !== 'undefined') {
    window.LoveBudReliabilitySentinelTaxonomy = RELIABILITY_SENTINEL_TAXONOMY;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.LoveBudReliabilitySentinelTaxonomy = RELIABILITY_SENTINEL_TAXONOMY;
  }
})(this);