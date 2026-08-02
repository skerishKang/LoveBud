'use strict';

// Issue #3835 — Reliability & Observability child (parent #3461).
//
// Independent privacy-safe reliability sentinel and write-read outcome
// taxonomy authority.
//
// This module is a PURE SOURCE AUTHORITY. It:
//   - carries NO capability (no network, provider, database, SQL, filesystem
//     write, process, or alert execution);
//   - rejects unknown fields, unknown enum values, invalid release SHA, and
//     every private identifier key on both input and output;
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
  // Evidence completeness — bounded; missing/invalid can never resolve CONFIRMED.
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
  function canonicalJson(value) {
    return JSON.stringify(value, replacerSorted);
  }

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
  // Exact-input validator. Fail closed on any unknown or invalid field.
  // Returns { ok, errors } — never throws; the builder throws.
  // ---------------------------------------------------------------------------
  function validateInput(input) {
    var errors = [];

    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      return { ok: false, errors: ['input must be a plain object'] };
    }

    var keys = Object.keys(input);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!Object.prototype.hasOwnProperty.call(ALLOWED_FIELD_SET, key)) {
        errors.push('unknown_field:' + key);
      }
      if (Object.prototype.hasOwnProperty.call(PRIVATE_KEY_SET, key)) {
        errors.push('private_key_rejected:' + key);
      }
    }

    if ('operation_class' in input && !OPERATION_SET[input.operation_class]) {
      errors.push('unknown_operation_class');
    }
    if ('stage' in input && !STAGE_SET[input.stage]) {
      errors.push('unknown_stage');
    }
    if ('outcome_code' in input && !OUTCOME_SET[input.outcome_code]) {
      errors.push('unknown_outcome_code:' + String(input.outcome_code));
    }
    if ('baseline_deviation' in input && !DEVIATION_SET[input.baseline_deviation]) {
      errors.push('unknown_baseline_deviation');
    }
    if ('severity' in input && !SEVERITY_SET[input.severity]) {
      errors.push('unknown_severity');
    }
    if ('owner_action' in input && !ACTION_SET[input.owner_action]) {
      errors.push('unknown_owner_action');
    }
    if ('evidence_completeness' in input && !EVIDENCE_SET[input.evidence_completeness]) {
      errors.push('unknown_evidence_completeness');
    }
    if ('latency_bucket' in input && !LATENCY_SET[input.latency_bucket]) {
      errors.push('unknown_latency_bucket');
    }
    if ('count_bucket' in input && !COUNT_SET[input.count_bucket]) {
      errors.push('unknown_count_bucket');
    }

    if ('release_sha' in input && !isValidReleaseSha(input.release_sha)) {
      errors.push('invalid_release_sha');
    }

    // Missing/invalid evidence can never resolve to CONFIRMED (fail closed).
    if ('outcome_code' in input && input.outcome_code === OUTCOME_CODES.CONFIRMED) {
      var ev = input.evidence_completeness;
      if (ev === EVIDENCE_COMPLETENESS.MISSING || ev === EVIDENCE_COMPLETENESS.INVALID || ev === undefined) {
        errors.push('missing_evidence_not_confirmed');
      }
    }

    return { ok: errors.length === 0, errors: errors };
  }

  // ---------------------------------------------------------------------------
  // Canonical bounded result builder. Fails closed (throws) on any invalid
  // input. Returns a deep-frozen, canonical result carrying only allowed fields.
  // The caller's input is never mutated.
  // ---------------------------------------------------------------------------
  function buildBoundedResult(input) {
    var validation = validateInput(input);
    if (!validation.ok) {
      throw new TypeError('RELIABILITY_SENTINEL_VALIDATION_FAILED: ' + validation.errors.join(', '));
    }

    // Copy on read; never mutate the caller's object.
    var result = {};
    result.operation_class = input.operation_class;
    result.stage = input.stage;
    result.outcome_code = input.outcome_code;
    result.baseline_deviation = input.baseline_deviation;
    result.severity = input.severity;
    result.owner_action = input.owner_action;
    result.evidence_completeness = input.evidence_completeness;
    if (input.latency_bucket !== undefined) result.latency_bucket = input.latency_bucket;
    if (input.count_bucket !== undefined) result.count_bucket = input.count_bucket;
    if (input.release_sha !== undefined) result.release_sha = input.release_sha;

    return deepFreeze(result);
  }

  function normalizeList(values) {
    if (!Array.isArray(values)) throw new TypeError('normalizeList expects an array');
    var out = values.slice();
    var seen = {};
    var unique = [];
    for (var i = 0; i < out.length; i++) {
      var v = out[i];
      if (!Object.prototype.hasOwnProperty.call(seen, v)) {
        seen[v] = true;
        unique.push(v);
      }
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

    isValidReleaseSha: isValidReleaseSha,
    validateInput: validateInput,
    buildBoundedResult: buildBoundedResult,
    normalizeList: normalizeList,
    canonicalJson: canonicalJson
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