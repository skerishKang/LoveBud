'use strict';

// Issue #4082 — NONPROD/Preview reliability runtime configuration.
//
// Fixed owner decisions for the non-Production rehearsal package only.
// This module grants no Production authority and binds no provider resource.
// Invalid/missing/malformed control values fail closed to DISABLED.
//
// Refs #4082. Refs #3461 — Keep OPEN. Refs #1882 — Keep OPEN.

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

    return Object.freeze({
      CONTRACT_VERSION: CONTRACT_VERSION,
      RUNTIME_BOUNDS: Object.freeze(merged),
      KILL_SWITCH_NAMES: KILL_SWITCH_NAMES,
      kill_switches: Object.freeze({
        read_only_sentinel: classifyKillSwitch(sentinelRaw),
        alert_delivery: classifyKillSwitch(alertRaw)
      })
    });
  }

  var API = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    RUNTIME_BOUNDS: RUNTIME_BOUNDS,
    KILL_SWITCH_NAMES: KILL_SWITCH_NAMES,
    KILL_SWITCH_DEFAULT: KILL_SWITCH_DEFAULT,
    CAPABILITIES: Object.freeze([]),
    classifyKillSwitch: classifyKillSwitch,
    createPreviewConfig: createPreviewConfig
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.LoveBudReliabilityPreviewConfig = API;
  if (typeof globalThis !== 'undefined') globalThis.LoveBudReliabilityPreviewConfig = API;
})(this);
