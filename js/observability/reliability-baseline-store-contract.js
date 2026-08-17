'use strict';

// Issue #4079 — baseline-aware anomaly evaluation private-store boundary.
//
// PURE / dependency-injected source only. This module never reads a database,
// network, provider, environment, filesystem, timer, secret, or Production
// resource. Exact counts/measurements may exist inside an injected store
// implementation, but they never cross this boundary. The boundary accepts
// only bounded signal identity + injected calibration and returns only bounded
// baseline classification evidence.
//
// Refs #4079.
// Refs #3835 — bounded taxonomy/privacy authority.
// Refs #4061 — structural sentinel parity translation boundary.
// Refs #3860 — parity engine authority; not reimplemented here.
// Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '1';

  function deepFreeze(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) deepFreeze(value[i]);
      return Object.freeze(value);
    }
    var keys = Object.keys(value);
    for (var k = 0; k < keys.length; k++) deepFreeze(value[keys[k]]);
    return Object.freeze(value);
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

  function getOwnDataValue(record, key) {
    var descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(record, key);
    } catch (_) {
      throw new TypeError(ERROR_CODES.UNSAFE_RECORD);
    }
    if (!descriptor || descriptor.enumerable !== true || !('value' in descriptor) || 'get' in descriptor || 'set' in descriptor) {
      throw new TypeError(ERROR_CODES.UNSAFE_RECORD);
    }
    return descriptor.value;
  }

  function exactKeys(record, allowed) {
    if (!isPlainRecord(record)) return false;
    var keys;
    try {
      keys = Object.keys(record);
    } catch (_) {
      return false;
    }
    if (keys.length !== allowed.length) return false;
    var sorted = keys.slice().sort();
    var expected = allowed.slice().sort();
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i] !== expected[i]) return false;
      try {
        getOwnDataValue(record, sorted[i]);
      } catch (_) {
        return false;
      }
    }
    return true;
  }

  var SIGNAL_CLASSES = Object.freeze({
    ABSOLUTE_INVARIANT: 'ABSOLUTE_INVARIANT',
    CROSS_TABLE_INVARIANT: 'CROSS_TABLE_INVARIANT',
    RATIO_SIGNAL: 'RATIO_SIGNAL',
    RATE_OF_CHANGE_SIGNAL: 'RATE_OF_CHANGE_SIGNAL',
    DEPLOYMENT_CORRELATED_SIGNAL: 'DEPLOYMENT_CORRELATED_SIGNAL',
    TEMPORAL_BASELINE: 'TEMPORAL_BASELINE',
    INSUFFICIENT_BASELINE: 'INSUFFICIENT_BASELINE'
  });

  var SIGNAL_IDS = Object.freeze({
    ABSOLUTE_RELATIONAL_INVARIANT: 'ABSOLUTE_RELATIONAL_INVARIANT',
    CROSS_TABLE_RELATIONAL_INVARIANT: 'CROSS_TABLE_RELATIONAL_INVARIANT',
    BROWSE_ELIGIBILITY_RATIO: 'BROWSE_ELIGIBILITY_RATIO',
    ENTITY_RATE_OF_CHANGE: 'ENTITY_RATE_OF_CHANGE',
    DEPLOYMENT_CORRELATED_DISCONTINUITY: 'DEPLOYMENT_CORRELATED_DISCONTINUITY',
    TEMPORAL_BASELINE_DEVIATION: 'TEMPORAL_BASELINE_DEVIATION',
    BASELINE_EVIDENCE_SUFFICIENCY: 'BASELINE_EVIDENCE_SUFFICIENCY'
  });

  var SIGNAL_ID_TO_CLASS = Object.freeze({
    ABSOLUTE_RELATIONAL_INVARIANT: SIGNAL_CLASSES.ABSOLUTE_INVARIANT,
    CROSS_TABLE_RELATIONAL_INVARIANT: SIGNAL_CLASSES.CROSS_TABLE_INVARIANT,
    BROWSE_ELIGIBILITY_RATIO: SIGNAL_CLASSES.RATIO_SIGNAL,
    ENTITY_RATE_OF_CHANGE: SIGNAL_CLASSES.RATE_OF_CHANGE_SIGNAL,
    DEPLOYMENT_CORRELATED_DISCONTINUITY: SIGNAL_CLASSES.DEPLOYMENT_CORRELATED_SIGNAL,
    TEMPORAL_BASELINE_DEVIATION: SIGNAL_CLASSES.TEMPORAL_BASELINE,
    BASELINE_EVIDENCE_SUFFICIENCY: SIGNAL_CLASSES.INSUFFICIENT_BASELINE
  });

  var BASELINE_STATUSES = Object.freeze({
    ESTABLISHED: 'ESTABLISHED',
    NOT_ESTABLISHED: 'NOT_ESTABLISHED',
    INSUFFICIENT: 'INSUFFICIENT',
    MONITORING_FAILED: 'MONITORING_FAILED',
    AUTHORITY_UNAVAILABLE: 'AUTHORITY_UNAVAILABLE'
  });

  var ERROR_CODES = Object.freeze({
    INVALID_DEPENDENCY: 'INVALID_DEPENDENCY',
    INVALID_SIGNAL: 'INVALID_SIGNAL',
    INVALID_CALIBRATION: 'INVALID_CALIBRATION',
    INVALID_BASELINE_RESULT: 'INVALID_BASELINE_RESULT',
    UNSAFE_RECORD: 'UNSAFE_RECORD'
  });

  var CALIBRATION_FIELDS = Object.freeze([
    'signal_id',
    'expected_variation_max',
    'material_deviation_min',
    'critical_discontinuity_min'
  ]);

  var RESULT_FIELDS = Object.freeze([
    'status',
    'baseline_deviation',
    'evidence_completeness'
  ]);

  function isBaselineAwareClass(signalClass) {
    return signalClass === SIGNAL_CLASSES.RATIO_SIGNAL ||
      signalClass === SIGNAL_CLASSES.RATE_OF_CHANGE_SIGNAL ||
      signalClass === SIGNAL_CLASSES.DEPLOYMENT_CORRELATED_SIGNAL ||
      signalClass === SIGNAL_CLASSES.TEMPORAL_BASELINE;
  }

  function validateSignalIdentity(signalId, signalClass) {
    return typeof signalId === 'string' &&
      typeof signalClass === 'string' &&
      Object.prototype.hasOwnProperty.call(SIGNAL_ID_TO_CLASS, signalId) &&
      SIGNAL_ID_TO_CLASS[signalId] === signalClass;
  }

  function validateCalibration(calibration, signalId) {
    if (!exactKeys(calibration, CALIBRATION_FIELDS)) return false;
    var id;
    var expected;
    var material;
    var critical;
    try {
      id = getOwnDataValue(calibration, 'signal_id');
      expected = getOwnDataValue(calibration, 'expected_variation_max');
      material = getOwnDataValue(calibration, 'material_deviation_min');
      critical = getOwnDataValue(calibration, 'critical_discontinuity_min');
    } catch (_) {
      return false;
    }
    if (id !== signalId) return false;
    var values = [expected, material, critical];
    for (var i = 0; i < values.length; i++) {
      if (typeof values[i] !== 'number' || !Number.isFinite(values[i]) || values[i] < 0) return false;
    }
    if (expected > material || material > critical) return false;
    return true;
  }

  function detachCalibration(calibration) {
    return deepFreeze({
      signal_id: getOwnDataValue(calibration, 'signal_id'),
      expected_variation_max: getOwnDataValue(calibration, 'expected_variation_max'),
      material_deviation_min: getOwnDataValue(calibration, 'material_deviation_min'),
      critical_discontinuity_min: getOwnDataValue(calibration, 'critical_discontinuity_min')
    });
  }

  function boundedFailure(taxonomy, status) {
    return deepFreeze({
      status: status,
      baseline_deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
      evidence_completeness: status === BASELINE_STATUSES.INSUFFICIENT ?
        taxonomy.EVIDENCE_COMPLETENESS.INVALID : taxonomy.EVIDENCE_COMPLETENESS.MISSING
    });
  }

  function validateBaselineResult(taxonomy, result) {
    if (!exactKeys(result, RESULT_FIELDS)) return null;
    var status;
    var deviation;
    var evidence;
    try {
      status = getOwnDataValue(result, 'status');
      deviation = getOwnDataValue(result, 'baseline_deviation');
      evidence = getOwnDataValue(result, 'evidence_completeness');
    } catch (_) {
      return null;
    }
    if (!Object.prototype.hasOwnProperty.call(BASELINE_STATUSES, status)) return null;
    if (!taxonomy.DEVIATION_SET || !Object.prototype.hasOwnProperty.call(taxonomy.DEVIATION_SET, deviation)) return null;
    if (!taxonomy.EVIDENCE_COMPLETENESS_SET || !Object.prototype.hasOwnProperty.call(taxonomy.EVIDENCE_COMPLETENESS_SET, evidence)) return null;

    if (status === BASELINE_STATUSES.ESTABLISHED && evidence !== taxonomy.EVIDENCE_COMPLETENESS.COMPLETE) return null;
    if (status !== BASELINE_STATUSES.ESTABLISHED && deviation !== taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN) return null;
    if (status === BASELINE_STATUSES.NOT_ESTABLISHED && evidence === taxonomy.EVIDENCE_COMPLETENESS.COMPLETE) return null;
    if (status === BASELINE_STATUSES.INSUFFICIENT && evidence === taxonomy.EVIDENCE_COMPLETENESS.COMPLETE) return null;
    if (status === BASELINE_STATUSES.MONITORING_FAILED && evidence === taxonomy.EVIDENCE_COMPLETENESS.COMPLETE) return null;
    if (status === BASELINE_STATUSES.AUTHORITY_UNAVAILABLE && evidence === taxonomy.EVIDENCE_COMPLETENESS.COMPLETE) return null;

    return deepFreeze({
      status: status,
      baseline_deviation: deviation,
      evidence_completeness: evidence
    });
  }

  function createBaselineStoreBoundary(deps) {
    if (!isPlainRecord(deps) || !exactKeys(deps, ['store', 'taxonomy'])) {
      throw new TypeError(ERROR_CODES.INVALID_DEPENDENCY);
    }
    var store;
    var taxonomy;
    try {
      store = getOwnDataValue(deps, 'store');
      taxonomy = getOwnDataValue(deps, 'taxonomy');
    } catch (_) {
      throw new TypeError(ERROR_CODES.INVALID_DEPENDENCY);
    }
    if (!isPlainRecord(store) || !isPlainRecord(taxonomy)) {
      throw new TypeError(ERROR_CODES.INVALID_DEPENDENCY);
    }
    var evaluateDescriptor;
    try {
      evaluateDescriptor = Object.getOwnPropertyDescriptor(store, 'evaluate');
    } catch (_) {
      throw new TypeError(ERROR_CODES.INVALID_DEPENDENCY);
    }
    if (!evaluateDescriptor || !('value' in evaluateDescriptor) || typeof evaluateDescriptor.value !== 'function' || 'get' in evaluateDescriptor || 'set' in evaluateDescriptor) {
      throw new TypeError(ERROR_CODES.INVALID_DEPENDENCY);
    }

    async function evaluateBaselineSignal(request) {
      if (!isPlainRecord(request) || !exactKeys(request, ['signal_id', 'signal_class', 'calibration'])) {
        throw new TypeError(ERROR_CODES.INVALID_SIGNAL);
      }
      var signalId;
      var signalClass;
      var calibration;
      try {
        signalId = getOwnDataValue(request, 'signal_id');
        signalClass = getOwnDataValue(request, 'signal_class');
        calibration = getOwnDataValue(request, 'calibration');
      } catch (_) {
        throw new TypeError(ERROR_CODES.INVALID_SIGNAL);
      }
      if (!validateSignalIdentity(signalId, signalClass) || !isBaselineAwareClass(signalClass)) {
        throw new TypeError(ERROR_CODES.INVALID_SIGNAL);
      }
      if (!validateCalibration(calibration, signalId)) {
        throw new TypeError(ERROR_CODES.INVALID_CALIBRATION);
      }

      var boundedRequest = deepFreeze({
        signal_id: signalId,
        signal_class: signalClass,
        calibration: detachCalibration(calibration)
      });

      var raw;
      try {
        raw = await Promise.resolve(store.evaluate(boundedRequest));
      } catch (_) {
        return boundedFailure(taxonomy, BASELINE_STATUSES.MONITORING_FAILED);
      }
      var validated = validateBaselineResult(taxonomy, raw);
      if (!validated) {
        return boundedFailure(taxonomy, BASELINE_STATUSES.INSUFFICIENT);
      }
      return validated;
    }

    return deepFreeze({
      evaluateBaselineSignal: evaluateBaselineSignal
    });
  }

  var API = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    SIGNAL_CLASSES: SIGNAL_CLASSES,
    SIGNAL_IDS: SIGNAL_IDS,
    SIGNAL_ID_TO_CLASS: SIGNAL_ID_TO_CLASS,
    BASELINE_STATUSES: BASELINE_STATUSES,
    CALIBRATION_FIELDS: CALIBRATION_FIELDS,
    RESULT_FIELDS: RESULT_FIELDS,
    ERROR_CODES: ERROR_CODES,
    CAPABILITIES: Object.freeze([]),
    isBaselineAwareClass: isBaselineAwareClass,
    validateSignalIdentity: validateSignalIdentity,
    validateCalibration: validateCalibration,
    validateBaselineResult: validateBaselineResult,
    createBaselineStoreBoundary: createBaselineStoreBoundary
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.LoveBudReliabilityBaselineStoreContract = API;
  if (typeof globalThis !== 'undefined') globalThis.LoveBudReliabilityBaselineStoreContract = API;
})(this);
