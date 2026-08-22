'use strict';

// Issue #4082 — NONPROD/Preview reliability runtime configuration.
//
// Fixed owner decisions for the non-Production rehearsal package only.
// This module grants no Production authority and binds no provider resource.
// Invalid/missing/malformed control values fail closed to DISABLED.
//
// #4175 reconciliation: adds the fail-closed release provenance contract.
// The deployed source revision is injected externally through the
// RELIABILITY_PREVIEW_RELEASE_SHA variable; no SHA is hard-coded in source
// and a missing/malformed/all-zero value is classified INVALID_RELEASE_SHA
// so no run can present fabricated provenance.
//
// Refs #4082. Refs #4148/#4149. Refs #4175.
// Refs #3461 — Keep OPEN. Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '1';

  var RUNTIME_BOUNDS = Object.freeze({
    SCHEDULE_CADENCE_MS: 5 * 60 * 1000,
    COLLECTOR_TIMEOUT_MS: 5000,
    FULL_RUN_TIMEOUT_MS: 30000,
    LEASE_DURATION_MS: 90000,
    BASELINE_RETENTION_MS: 30 * 24 * 60 * 60 * 1000,
    MAX_SAMPLES_PER_SIGNAL: 8640,
    MIN_BASELINE_SAMPLES: 2,
    DEDUPE_MAX_ENTRIES: 2048,
    HEARTBEAT_HISTORY_MAX: 2016,
    DEADMAN_STALE_THRESHOLD_MS: 7 * 60 * 1000
  });

  var KILL_SWITCH_NAMES = Object.freeze({
    READ_ONLY_SENTINEL: 'RELIABILITY_READ_ONLY_SENTINEL_ENABLED',
    ALERT_DELIVERY: 'RELIABILITY_ALERT_DELIVERY_ENABLED'
  });

  var KILL_SWITCH_DEFAULT = false;

  // #4175 release provenance: the exact deployed source revision is injected
  // externally (Worker env var RELIABILITY_PREVIEW_RELEASE_SHA). It is plain
  // configuration, not a secret: no value lives in source, and an absent,
  // malformed, non-hex, wrong-length, or all-zero value classifies as
  // INVALID_RELEASE_SHA so the runner fails closed before any capability use.
  var RELEASE_SHA_VAR_NAME = 'RELIABILITY_PREVIEW_RELEASE_SHA';
  var RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;
  // Built without a literal so source carries no 40-hex token at all.
  var RELEASE_SHA_ALL_ZERO = '0'.repeat(40);

  function normalizeReleaseSha(rawValue) {
    if (typeof rawValue !== 'string') return null;
    var normalized = rawValue.trim().toLowerCase();
    if (!RELEASE_SHA_PATTERN.test(normalized)) return null;
    if (normalized === RELEASE_SHA_ALL_ZERO) return null;
    return normalized;
  }

  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    try {
      var proto = Object.getPrototypeOf(value);
      return proto === Object.prototype || proto === null;
    } catch (_) {
      return false;
    }
  }

  function classifyKillSwitch(rawValue) {
    if (rawValue === undefined || rawValue === null) return 'DISABLED';
    if (rawValue === true) return 'ENABLED';
    if (rawValue === false) return 'DISABLED';
    if (typeof rawValue === 'string') {
      var normalized = rawValue.trim().toLowerCase();
      if (normalized === 'true') return 'ENABLED';
      if (normalized === 'false' || normalized === '') return 'DISABLED';
    }
    return 'DISABLED';
  }

  function createPreviewConfig(input) {
    if (input !== undefined && input !== null && !isPlainRecord(input)) {
      throw new TypeError('INVALID_CONFIG');
    }
    var overrides = input || {};
    var merged = {};
    var keys = Object.keys(RUNTIME_BOUNDS);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var value = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : RUNTIME_BOUNDS[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || Math.floor(value) !== value) {
        throw new TypeError('INVALID_CONFIG:' + key);
      }
      merged[key] = value;
    }
    var sentinelRaw = Object.prototype.hasOwnProperty.call(overrides, 'kill_switch_sentinel') ?
      overrides.kill_switch_sentinel : KILL_SWITCH_DEFAULT;
    var alertRaw = Object.prototype.hasOwnProperty.call(overrides, 'kill_switch_alert') ?
      overrides.kill_switch_alert : KILL_SWITCH_DEFAULT;
    var releaseShaRaw = Object.prototype.hasOwnProperty.call(overrides, 'release_sha_env') ?
      overrides.release_sha_env : undefined;
    var normalizedReleaseSha = normalizeReleaseSha(releaseShaRaw);

    return Object.freeze({
      CONTRACT_VERSION: CONTRACT_VERSION,
      RUNTIME_BOUNDS: Object.freeze(merged),
      KILL_SWITCH_NAMES: KILL_SWITCH_NAMES,
      kill_switches: Object.freeze({
        read_only_sentinel: classifyKillSwitch(sentinelRaw),
        alert_delivery: classifyKillSwitch(alertRaw)
      }),
      release_sha_var_name: RELEASE_SHA_VAR_NAME,
      release_provenance: Object.freeze(normalizedReleaseSha === null ? {
        status: 'INVALID_RELEASE_SHA',
        release_sha: null
      } : {
        status: 'VALID',
        release_sha: normalizedReleaseSha
      })
    });
  }

  var API = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    RUNTIME_BOUNDS: RUNTIME_BOUNDS,
    KILL_SWITCH_NAMES: KILL_SWITCH_NAMES,
    KILL_SWITCH_DEFAULT: KILL_SWITCH_DEFAULT,
    RELEASE_SHA_VAR_NAME: RELEASE_SHA_VAR_NAME,
    normalizeReleaseSha: normalizeReleaseSha,
    CAPABILITIES: Object.freeze([]),
    classifyKillSwitch: classifyKillSwitch,
    createPreviewConfig: createPreviewConfig
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.LoveBudReliabilityPreviewConfig = API;
  if (typeof globalThis !== 'undefined') globalThis.LoveBudReliabilityPreviewConfig = API;
})(this);
