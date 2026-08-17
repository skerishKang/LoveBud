'use strict';

// Issue #4079 — baseline-aware anomaly evaluation core.
//
// PURE / dependency-injected source only. The evaluator consumes:
//   1) already-bounded #3835 structural summaries for hard invariants; and
//   2) bounded baseline classifications from reliability-baseline-store-contract.
//
// It never receives raw DB rows/counts, never executes SQL, and performs no
// #3860 catalog fingerprint comparison. #4061 remains the sole
// structural-sentinel parity translation boundary. The `summary` member is the
// only telemetry-shaped output and is always built through #3835. `state` is a
// bounded evaluator control state; this module does not log or persist either.
//
// Refs #4079.
// Refs #3835 — taxonomy/privacy authority.
// Refs #4061 — parity translation boundary.
// Refs #3860 — parity authority; no second engine here.
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

  var PUBLIC_STATES = Object.freeze({
    BASELINE_NOT_ESTABLISHED: 'BASELINE_NOT_ESTABLISHED',
    HEALTHY: 'HEALTHY',
    DEGRADED: 'DEGRADED',
    INCIDENT_SUSPECTED: 'INCIDENT_SUSPECTED',
    INCIDENT_CONFIRMED: 'INCIDENT_CONFIRMED',
    INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
    MONITORING_FAILED: 'MONITORING_FAILED',
    AUTHORITY_UNAVAILABLE: 'AUTHORITY_UNAVAILABLE'
  });

  // Precedence is semantic fail-closed ordering, not a sensitivity threshold.
  // Hard-invariant confirmation outranks baseline absence, so statistical
  // suppression can never collapse a confirmed invariant failure to HEALTHY.
  var STATE_PRECEDENCE = Object.freeze([
    PUBLIC_STATES.HEALTHY,
    PUBLIC_STATES.BASELINE_NOT_ESTABLISHED,
    PUBLIC_STATES.INSUFFICIENT_EVIDENCE,
    PUBLIC_STATES.AUTHORITY_UNAVAILABLE,
    PUBLIC_STATES.DEGRADED,
    PUBLIC_STATES.INCIDENT_SUSPECTED,
    PUBLIC_STATES.MONITORING_FAILED,
    PUBLIC_STATES.INCIDENT_CONFIRMED
  ]);

  var ERROR_CODES = Object.freeze({
    INVALID_DEPENDENCY: 'INVALID_DEPENDENCY',
    INVALID_INPUT: 'INVALID_INPUT',
    INVALID_SIGNAL: 'INVALID_SIGNAL',
    DUPLICATE_SIGNAL: 'DUPLICATE_SIGNAL',
    INVALID_RELEASE_SHA: 'INVALID_RELEASE_SHA',
    INVALID_CALIBRATION: 'INVALID_CALIBRATION',
    UNSAFE_RECORD: 'UNSAFE_RECORD',
    NON_CANONICAL_SUMMARY: 'NON_CANONICAL_SUMMARY'
  });

  var TOP_LEVEL_FIELDS = Object.freeze(['release_sha', 'signals', 'calibration']);
  var HARD_SIGNAL_FIELDS = Object.freeze(['signal_id', 'signal_class', 'structural_summary']);
  var BASELINE_SIGNAL_FIELDS = Object.freeze(['signal_id', 'signal_class']);

  function stateRank(state) {
    return STATE_PRECEDENCE.indexOf(state);
  }

  function selectHigherState(current, candidate) {
    if (!current) return candidate;
    return stateRank(candidate.state) > stateRank(current.state) ? candidate : current;
  }

  function copyCanonicalSummary(taxonomy, summary) {
    var input = {
      operation_class: summary.operation_class,
      stage: summary.stage,
      outcome_code: summary.outcome_code,
      release_sha: summary.release_sha,
      baseline_deviation: summary.baseline_deviation,
      severity: summary.severity,
      owner_action: summary.owner_action,
      evidence_completeness: summary.evidence_completeness
    };
    if (Object.prototype.hasOwnProperty.call(summary, 'latency_bucket')) input.latency_bucket = summary.latency_bucket;
    if (Object.prototype.hasOwnProperty.call(summary, 'count_bucket')) input.count_bucket = summary.count_bucket;
    return taxonomy.buildBoundedResult(input);
  }

  function baselineSummary(taxonomy, releaseSha, state, deviation) {
    var outcome = taxonomy.OUTCOME_CODES.INSUFFICIENT_EVIDENCE;
    var severity = taxonomy.SEVERITIES.WARNING;
    var action = taxonomy.OWNER_ACTIONS.INVESTIGATE;
    var evidence = taxonomy.EVIDENCE_COMPLETENESS.MISSING;
    var boundedDeviation = deviation || taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN;

    if (state === PUBLIC_STATES.HEALTHY) {
      outcome = taxonomy.OUTCOME_CODES.CONFIRMED;
      severity = taxonomy.SEVERITIES.INFO;
      action = taxonomy.OWNER_ACTIONS.NO_ACTION;
      evidence = taxonomy.EVIDENCE_COMPLETENESS.COMPLETE;
    } else if (state === PUBLIC_STATES.DEGRADED) {
      outcome = taxonomy.OUTCOME_CODES.BASELINE_DISCONTINUITY_DETECTED;
      severity = taxonomy.SEVERITIES.WARNING;
      action = taxonomy.OWNER_ACTIONS.OBSERVE;
      evidence = taxonomy.EVIDENCE_COMPLETENESS.COMPLETE;
    } else if (state === PUBLIC_STATES.INCIDENT_SUSPECTED) {
      outcome = taxonomy.OUTCOME_CODES.BASELINE_DISCONTINUITY_DETECTED;
      severity = taxonomy.SEVERITIES.WARNING;
      action = taxonomy.OWNER_ACTIONS.INVESTIGATE;
      evidence = taxonomy.EVIDENCE_COMPLETENESS.COMPLETE;
    } else if (state === PUBLIC_STATES.INCIDENT_CONFIRMED) {
      outcome = taxonomy.OUTCOME_CODES.BASELINE_DISCONTINUITY_DETECTED;
      severity = taxonomy.SEVERITIES.BLOCKING;
      action = taxonomy.OWNER_ACTIONS.INVESTIGATE;
      evidence = taxonomy.EVIDENCE_COMPLETENESS.COMPLETE;
    } else if (state === PUBLIC_STATES.MONITORING_FAILED) {
      outcome = taxonomy.OUTCOME_CODES.MONITORING_FAILED;
      severity = taxonomy.SEVERITIES.BLOCKING;
      action = taxonomy.OWNER_ACTIONS.INVESTIGATE;
      evidence = taxonomy.EVIDENCE_COMPLETENESS.MISSING;
      boundedDeviation = taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN;
    } else if (state === PUBLIC_STATES.AUTHORITY_UNAVAILABLE) {
      outcome = taxonomy.OUTCOME_CODES.SCHEMA_AUTHORITY_UNAVAILABLE;
      severity = taxonomy.SEVERITIES.WARNING;
      action = taxonomy.OWNER_ACTIONS.OWNER_DECISION_REQUIRED;
      evidence = taxonomy.EVIDENCE_COMPLETENESS.MISSING;
      boundedDeviation = taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN;
    } else if (state === PUBLIC_STATES.INSUFFICIENT_EVIDENCE) {
      evidence = taxonomy.EVIDENCE_COMPLETENESS.INVALID;
      boundedDeviation = taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN;
    } else if (state === PUBLIC_STATES.BASELINE_NOT_ESTABLISHED) {
      evidence = taxonomy.EVIDENCE_COMPLETENESS.MISSING;
      boundedDeviation = taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN;
    }

    return taxonomy.buildBoundedResult({
      operation_class: taxonomy.OPERATION_CLASSES.BROWSE_ELIGIBILITY_BASELINE_CHECK,
      stage: taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED,
      outcome_code: outcome,
      release_sha: releaseSha,
      count_bucket: taxonomy.COUNT_BUCKETS.UNKNOWN,
      baseline_deviation: boundedDeviation,
      severity: severity,
      owner_action: action,
      evidence_completeness: evidence
    });
  }

  function hardSignalCandidate(taxonomy, summary, releaseSha) {
    if (!taxonomy.isCanonicalResult(summary) || summary.release_sha !== releaseSha) {
      return {
        state: PUBLIC_STATES.INSUFFICIENT_EVIDENCE,
        summary: baselineSummary(taxonomy, releaseSha, PUBLIC_STATES.INSUFFICIENT_EVIDENCE)
      };
    }
    var state;
    if (summary.outcome_code === taxonomy.OUTCOME_CODES.ORPHAN_SIGNAL_DETECTED ||
        summary.outcome_code === taxonomy.OUTCOME_CODES.STRUCTURAL_DRIFT_DETECTED) {
      state = PUBLIC_STATES.INCIDENT_CONFIRMED;
    } else if (summary.outcome_code === taxonomy.OUTCOME_CODES.MONITORING_FAILED) {
      state = PUBLIC_STATES.MONITORING_FAILED;
    } else if (summary.outcome_code === taxonomy.OUTCOME_CODES.SCHEMA_AUTHORITY_UNAVAILABLE) {
      state = PUBLIC_STATES.AUTHORITY_UNAVAILABLE;
    } else if (summary.outcome_code === taxonomy.OUTCOME_CODES.INSUFFICIENT_EVIDENCE) {
      state = PUBLIC_STATES.INSUFFICIENT_EVIDENCE;
    } else if (summary.outcome_code === taxonomy.OUTCOME_CODES.CONFIRMED &&
               summary.evidence_completeness === taxonomy.EVIDENCE_COMPLETENESS.COMPLETE) {
      state = PUBLIC_STATES.HEALTHY;
    } else {
      state = PUBLIC_STATES.INSUFFICIENT_EVIDENCE;
    }
    return { state: state, summary: copyCanonicalSummary(taxonomy, summary) };
  }

  function baselineCandidate(taxonomy, baselineContract, signalClass, baselineResult, releaseSha) {
    var S = baselineContract.BASELINE_STATUSES;
    var D = taxonomy.BASELINE_DEVIATION_CLASSES;
    var state;

    if (baselineResult.status === S.NOT_ESTABLISHED) {
      state = PUBLIC_STATES.BASELINE_NOT_ESTABLISHED;
    } else if (baselineResult.status === S.INSUFFICIENT) {
      state = PUBLIC_STATES.INSUFFICIENT_EVIDENCE;
    } else if (baselineResult.status === S.MONITORING_FAILED) {
      state = PUBLIC_STATES.MONITORING_FAILED;
    } else if (baselineResult.status === S.AUTHORITY_UNAVAILABLE) {
      state = PUBLIC_STATES.AUTHORITY_UNAVAILABLE;
    } else if (baselineResult.status === S.ESTABLISHED) {
      if (baselineResult.baseline_deviation === D.NONE || baselineResult.baseline_deviation === D.EXPECTED_VARIATION) {
        state = PUBLIC_STATES.HEALTHY;
      } else if (baselineResult.baseline_deviation === D.MATERIAL_DEVIATION) {
        state = signalClass === baselineContract.SIGNAL_CLASSES.DEPLOYMENT_CORRELATED_SIGNAL ?
          PUBLIC_STATES.INCIDENT_SUSPECTED : PUBLIC_STATES.DEGRADED;
      } else if (baselineResult.baseline_deviation === D.CRITICAL_DISCONTINUITY) {
        state = signalClass === baselineContract.SIGNAL_CLASSES.DEPLOYMENT_CORRELATED_SIGNAL ?
          PUBLIC_STATES.INCIDENT_CONFIRMED : PUBLIC_STATES.INCIDENT_SUSPECTED;
      } else {
        state = PUBLIC_STATES.INSUFFICIENT_EVIDENCE;
      }
    } else {
      state = PUBLIC_STATES.INSUFFICIENT_EVIDENCE;
    }

    return {
      state: state,
      summary: baselineSummary(taxonomy, releaseSha, state, baselineResult.baseline_deviation)
    };
  }

  function normalizeCalibration(baselineContract, calibration) {
    if (calibration === undefined || calibration === null) return Object.freeze([]);
    if (!Array.isArray(calibration)) throw new TypeError(ERROR_CODES.INVALID_CALIBRATION);
    var out = [];
    var seen = {};
    for (var i = 0; i < calibration.length; i++) {
      var entry = calibration[i];
      if (!isPlainRecord(entry)) throw new TypeError(ERROR_CODES.INVALID_CALIBRATION);
      var signalId;
      try {
        signalId = getOwnDataValue(entry, 'signal_id');
      } catch (_) {
        throw new TypeError(ERROR_CODES.INVALID_CALIBRATION);
      }
      if (!baselineContract.validateCalibration(entry, signalId)) throw new TypeError(ERROR_CODES.INVALID_CALIBRATION);
      if (seen[signalId]) throw new TypeError(ERROR_CODES.INVALID_CALIBRATION);
      seen[signalId] = true;
      out.push(deepFreeze({
        signal_id: signalId,
        expected_variation_max: getOwnDataValue(entry, 'expected_variation_max'),
        material_deviation_min: getOwnDataValue(entry, 'material_deviation_min'),
        critical_discontinuity_min: getOwnDataValue(entry, 'critical_discontinuity_min')
      }));
    }
    out.sort(function (a, b) { return a.signal_id < b.signal_id ? -1 : a.signal_id > b.signal_id ? 1 : 0; });
    return deepFreeze(out);
  }

  function findCalibration(calibration, signalId) {
    for (var i = 0; i < calibration.length; i++) {
      if (calibration[i].signal_id === signalId) return calibration[i];
    }
    return null;
  }

  function validateSignals(baselineContract, signals) {
    if (!Array.isArray(signals)) throw new TypeError(ERROR_CODES.INVALID_INPUT);
    var normalized = [];
    var seen = {};
    for (var i = 0; i < signals.length; i++) {
      var signal = signals[i];
      if (!isPlainRecord(signal)) throw new TypeError(ERROR_CODES.INVALID_SIGNAL);
      var signalId;
      var signalClass;
      try {
        signalId = getOwnDataValue(signal, 'signal_id');
        signalClass = getOwnDataValue(signal, 'signal_class');
      } catch (_) {
        throw new TypeError(ERROR_CODES.INVALID_SIGNAL);
      }
      if (!baselineContract.validateSignalIdentity(signalId, signalClass)) throw new TypeError(ERROR_CODES.INVALID_SIGNAL);
      if (seen[signalId]) throw new TypeError(ERROR_CODES.DUPLICATE_SIGNAL);
      seen[signalId] = true;

      var isHard = signalClass === baselineContract.SIGNAL_CLASSES.ABSOLUTE_INVARIANT ||
        signalClass === baselineContract.SIGNAL_CLASSES.CROSS_TABLE_INVARIANT;
      if (isHard) {
        if (!exactKeys(signal, HARD_SIGNAL_FIELDS)) throw new TypeError(ERROR_CODES.INVALID_SIGNAL);
        normalized.push({
          signal_id: signalId,
          signal_class: signalClass,
          structural_summary: getOwnDataValue(signal, 'structural_summary')
        });
      } else {
        if (!exactKeys(signal, BASELINE_SIGNAL_FIELDS)) throw new TypeError(ERROR_CODES.INVALID_SIGNAL);
        normalized.push({ signal_id: signalId, signal_class: signalClass });
      }
    }
    normalized.sort(function (a, b) { return a.signal_id < b.signal_id ? -1 : a.signal_id > b.signal_id ? 1 : 0; });
    return normalized;
  }

  function buildResult(state, summary) {
    return deepFreeze({ state: state, summary: summary });
  }

  function createAnomalyEvaluator(deps) {
    if (!isPlainRecord(deps) || !exactKeys(deps, ['taxonomy', 'baseline_contract', 'baseline_store'])) {
      throw new TypeError(ERROR_CODES.INVALID_DEPENDENCY);
    }
    var taxonomy = getOwnDataValue(deps, 'taxonomy');
    var baselineContract = getOwnDataValue(deps, 'baseline_contract');
    var baselineStore = getOwnDataValue(deps, 'baseline_store');
    if (!isPlainRecord(taxonomy) || !isPlainRecord(baselineContract) || !isPlainRecord(baselineStore)) {
      throw new TypeError(ERROR_CODES.INVALID_DEPENDENCY);
    }
    if (typeof taxonomy.buildBoundedResult !== 'function' || typeof taxonomy.isCanonicalResult !== 'function' ||
        typeof taxonomy.canonicalJson !== 'function' || typeof baselineContract.createBaselineStoreBoundary !== 'function') {
      throw new TypeError(ERROR_CODES.INVALID_DEPENDENCY);
    }

    var baselineBoundary = baselineContract.createBaselineStoreBoundary({ store: baselineStore, taxonomy: taxonomy });

    async function evaluate(input) {
      if (!isPlainRecord(input) || !exactKeys(input, TOP_LEVEL_FIELDS)) {
        throw new TypeError(ERROR_CODES.INVALID_INPUT);
      }
      var releaseSha = getOwnDataValue(input, 'release_sha');
      if (!taxonomy.isValidReleaseSha(releaseSha)) throw new TypeError(ERROR_CODES.INVALID_RELEASE_SHA);
      var signals = validateSignals(baselineContract, getOwnDataValue(input, 'signals'));
      var calibration = normalizeCalibration(baselineContract, getOwnDataValue(input, 'calibration'));

      if (signals.length === 0) {
        return buildResult(
          PUBLIC_STATES.INSUFFICIENT_EVIDENCE,
          baselineSummary(taxonomy, releaseSha, PUBLIC_STATES.INSUFFICIENT_EVIDENCE)
        );
      }

      var selected = null;
      for (var i = 0; i < signals.length; i++) {
        var signal = signals[i];
        var candidate;
        if (signal.signal_class === baselineContract.SIGNAL_CLASSES.ABSOLUTE_INVARIANT ||
            signal.signal_class === baselineContract.SIGNAL_CLASSES.CROSS_TABLE_INVARIANT) {
          candidate = hardSignalCandidate(taxonomy, signal.structural_summary, releaseSha);
        } else if (signal.signal_class === baselineContract.SIGNAL_CLASSES.INSUFFICIENT_BASELINE) {
          candidate = {
            state: PUBLIC_STATES.BASELINE_NOT_ESTABLISHED,
            summary: baselineSummary(taxonomy, releaseSha, PUBLIC_STATES.BASELINE_NOT_ESTABLISHED)
          };
        } else {
          var calibrationEntry = findCalibration(calibration, signal.signal_id);
          if (!calibrationEntry) {
            candidate = {
              state: PUBLIC_STATES.INSUFFICIENT_EVIDENCE,
              summary: baselineSummary(taxonomy, releaseSha, PUBLIC_STATES.INSUFFICIENT_EVIDENCE)
            };
          } else {
            var baselineResult = await baselineBoundary.evaluateBaselineSignal({
              signal_id: signal.signal_id,
              signal_class: signal.signal_class,
              calibration: calibrationEntry
            });
            candidate = baselineCandidate(taxonomy, baselineContract, signal.signal_class, baselineResult, releaseSha);
          }
        }
        selected = selectHigherState(selected, candidate);
      }

      return buildResult(selected.state, selected.summary);
    }

    function canonicalJson(result) {
      if (!isPlainRecord(result) || !exactKeys(result, ['state', 'summary'])) {
        throw new TypeError(ERROR_CODES.INVALID_INPUT);
      }
      var state = getOwnDataValue(result, 'state');
      var summary = getOwnDataValue(result, 'summary');
      if (!Object.prototype.hasOwnProperty.call(PUBLIC_STATES, state) || !taxonomy.isCanonicalResult(summary)) {
        throw new TypeError(ERROR_CODES.NON_CANONICAL_SUMMARY);
      }
      return '{"state":' + JSON.stringify(state) + ',"summary":' + taxonomy.canonicalJson(summary) + '}';
    }

    return deepFreeze({ evaluate: evaluate, canonicalJson: canonicalJson });
  }

  var API = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    PUBLIC_STATES: PUBLIC_STATES,
    STATE_PRECEDENCE: STATE_PRECEDENCE,
    ERROR_CODES: ERROR_CODES,
    CAPABILITIES: Object.freeze([]),
    createAnomalyEvaluator: createAnomalyEvaluator
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.LoveBudReliabilityAnomalyEvaluatorCore = API;
  if (typeof globalThis !== 'undefined') globalThis.LoveBudReliabilityAnomalyEvaluatorCore = API;
})(this);
