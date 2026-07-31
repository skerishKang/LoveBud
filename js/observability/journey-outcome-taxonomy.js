(function () {
  'use strict';

  function makeFrozenSet(values) {
    var target = new Set(values);
    var rejectMutation = function () {
      throw new TypeError('Canonical set is immutable');
    };
    if (typeof Proxy !== 'undefined') {
      var readonlySet = new Proxy(target, {
        get: function (current, property) {
          if (property === 'add' || property === 'delete' || property === 'clear') {
            return rejectMutation;
          }
          var value = Reflect.get(current, property, current);
          return typeof value === 'function' ? value.bind(current) : value;
        },
        set: function () { return false; },
        defineProperty: function () { return false; },
        deleteProperty: function () { return false; }
      });
      Object.freeze(target);
      return Object.freeze(readonlySet);
    }
    // Fallback if Proxy is not available, just freeze the Set object itself
    Object.freeze(target);
    return target;
  }

  var CONTRACT_VERSION = '1';

  var STATUS_CLASSES = Object.freeze({
    HEALTHY: 'HEALTHY',
    FAILED: 'FAILED'
  });

  var EXPECTATION_CLASSES = Object.freeze({
    EXPECTED_SUCCESS: 'EXPECTED_SUCCESS',
    UNEXPECTED_FAILURE: 'UNEXPECTED_FAILURE'
  });

  var SEVERITY_CLASSES = Object.freeze({
    INFO: 'INFO',
    ERROR: 'ERROR'
  });

  var LATENCY_BUCKETS = Object.freeze({
    LT_250_MS: 'LT_250_MS',
    LT_500_MS: 'LT_500_MS',
    LT_1_S: 'LT_1_S',
    LT_2_S: 'LT_2_S',
    LT_5_S: 'LT_5_S',
    GTE_5_S: 'GTE_5_S',
    TIMEOUT_OR_UNKNOWN: 'TIMEOUT_OR_UNKNOWN'
  });

  var HTTP_STATUS_CLASSES = Object.freeze({
    HTTP_2XX: 'HTTP_2XX',
    HTTP_3XX: 'HTTP_3XX',
    HTTP_4XX: 'HTTP_4XX',
    HTTP_5XX: 'HTTP_5XX',
    HTTP_OTHER: 'HTTP_OTHER',
    NOT_MEASURED: 'NOT_MEASURED'
  });

  var JOURNEYS = Object.freeze({
    JOURNEY_AUTHENTICATED_MY_TREES_LOAD: 'JOURNEY_AUTHENTICATED_MY_TREES_LOAD'
  });

  var STAGES = Object.freeze({
    ACTION_STARTED: 'ACTION_STARTED',
    CLIENT_VALIDATION_PASSED: 'CLIENT_VALIDATION_PASSED',
    REQUEST_DISPATCHED: 'REQUEST_DISPATCHED',
    RESPONSE_ACCEPTED: 'RESPONSE_ACCEPTED',
    CLIENT_STATE_UPDATED: 'CLIENT_STATE_UPDATED',
    UI_ACKNOWLEDGED: 'UI_ACKNOWLEDGED',
    PERSISTENCE_CONFIRMED: 'PERSISTENCE_CONFIRMED',
    TERMINAL_SUCCESS: 'TERMINAL_SUCCESS',
    TERMINAL_FAILURE: 'TERMINAL_FAILURE',
    CANCELLED: 'CANCELLED',
    TIMED_OUT: 'TIMED_OUT',
    DUPLICATE_SUPPRESSED: 'DUPLICATE_SUPPRESSED',
    NOT_MEASURABLE: 'NOT_MEASURABLE'
  });

  var OUTCOME_EVENT_FIELDS = Object.freeze([
    'journey',
    'stage',
    'statusClass',
    'expectationClass',
    'severity',
    'failureCode',
    'httpStatus',
    'latencyBucket',
    'resultCountBucket'
  ]);

  var FAILURE_CODES = Object.freeze({
    NONE: 'NONE',
    LB_JOURNEY_AUTH_REQUIRED: 'LB_JOURNEY_AUTH_REQUIRED',
    LB_JOURNEY_AUTH_PREPARE_FAILED: 'LB_JOURNEY_AUTH_PREPARE_FAILED',
    LB_JOURNEY_API_UNAVAILABLE: 'LB_JOURNEY_API_UNAVAILABLE',
    LB_JOURNEY_NETWORK: 'LB_JOURNEY_NETWORK',
    LB_JOURNEY_HTTP_4XX: 'LB_JOURNEY_HTTP_4XX',
    LB_JOURNEY_HTTP_5XX: 'LB_JOURNEY_HTTP_5XX',
    LB_JOURNEY_RESPONSE_PARSE: 'LB_JOURNEY_RESPONSE_PARSE',
    LB_JOURNEY_INVALID_PAYLOAD: 'LB_JOURNEY_INVALID_PAYLOAD',
    LB_UNEXPECTED_FAILURE: 'LB_UNEXPECTED_FAILURE'
  });

  var STATUS_CLASS_SET = makeFrozenSet(Object.values(STATUS_CLASSES));
  var EXPECTATION_CLASS_SET = makeFrozenSet(Object.values(EXPECTATION_CLASSES));
  var SEVERITY_CLASS_SET = makeFrozenSet(Object.values(SEVERITY_CLASSES));
  var LATENCY_BUCKET_SET = makeFrozenSet(Object.values(LATENCY_BUCKETS));
  var HTTP_STATUS_CLASS_SET = makeFrozenSet(Object.values(HTTP_STATUS_CLASSES));
  var JOURNEY_SET = makeFrozenSet(Object.values(JOURNEYS));
  var STAGE_SET = makeFrozenSet(Object.values(STAGES));
  var FAILURE_CODE_SET = makeFrozenSet(Object.values(FAILURE_CODES));

  function classifyLatency(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) {
      return LATENCY_BUCKETS.TIMEOUT_OR_UNKNOWN;
    }
    if (ms < 250) return LATENCY_BUCKETS.LT_250_MS;
    if (ms < 500) return LATENCY_BUCKETS.LT_500_MS;
    if (ms < 1000) return LATENCY_BUCKETS.LT_1_S;
    if (ms < 2000) return LATENCY_BUCKETS.LT_2_S;
    if (ms < 5000) return LATENCY_BUCKETS.LT_5_S;
    return LATENCY_BUCKETS.GTE_5_S;
  }

  function classifyHttpStatus(status) {
    if (typeof status !== 'number' || !Number.isFinite(status) || !Number.isInteger(status)) {
      return HTTP_STATUS_CLASSES.NOT_MEASURED;
    }
    if (status >= 200 && status <= 299) return HTTP_STATUS_CLASSES.HTTP_2XX;
    if (status >= 300 && status <= 399) return HTTP_STATUS_CLASSES.HTTP_3XX;
    if (status >= 400 && status <= 499) return HTTP_STATUS_CLASSES.HTTP_4XX;
    if (status >= 500 && status <= 599) return HTTP_STATUS_CLASSES.HTTP_5XX;
    return HTTP_STATUS_CLASSES.HTTP_OTHER;
  }

  function normalizeFailureCode(value) {
    return typeof value === 'string' && FAILURE_CODE_SET.has(value)
      ? value
      : FAILURE_CODES.LB_UNEXPECTED_FAILURE;
  }

  function isAllowedFailureCode(value) {
    return typeof value === 'string' && FAILURE_CODE_SET.has(value);
  }

  function buildBoundedEvent(opts) {
    opts = opts || {};
    var stage = STAGE_SET.has(opts.stage) ? opts.stage : STAGES.TERMINAL_FAILURE;
    var isTerminalSuccess = stage === STAGES.TERMINAL_SUCCESS;
    var isTerminalFailure = stage === STAGES.TERMINAL_FAILURE;

    var statusClass;
    if (isTerminalSuccess) {
      statusClass = STATUS_CLASSES.HEALTHY;
    } else if (isTerminalFailure) {
      statusClass = STATUS_CLASSES.FAILED;
    } else {
      statusClass = STATUS_CLASS_SET.has(opts.statusClass)
        ? opts.statusClass
        : STATUS_CLASSES.HEALTHY;
    }

    var expectationClass;
    if (isTerminalSuccess) {
      expectationClass = EXPECTATION_CLASSES.EXPECTED_SUCCESS;
    } else if (isTerminalFailure) {
      expectationClass = EXPECTATION_CLASSES.UNEXPECTED_FAILURE;
    } else {
      expectationClass = EXPECTATION_CLASS_SET.has(opts.expectationClass)
        ? opts.expectationClass
        : EXPECTATION_CLASSES.EXPECTED_SUCCESS;
    }

    var severity;
    if (isTerminalSuccess) {
      severity = SEVERITY_CLASSES.INFO;
    } else if (isTerminalFailure) {
      severity = SEVERITY_CLASSES.ERROR;
    } else {
      severity = SEVERITY_CLASS_SET.has(opts.severity)
        ? opts.severity
        : SEVERITY_CLASSES.INFO;
    }

    var failureCode;
    if (isTerminalSuccess) {
      failureCode = FAILURE_CODES.NONE;
    } else if (isTerminalFailure) {
      failureCode = normalizeFailureCode(opts.failureCode);
    } else {
      failureCode = isAllowedFailureCode(opts.failureCode) ? opts.failureCode : FAILURE_CODES.NONE;
    }

    var httpStatus = HTTP_STATUS_CLASS_SET.has(opts.httpStatus)
      ? opts.httpStatus
      : classifyHttpStatus(opts.httpStatus);

    var latencyBucket = LATENCY_BUCKET_SET.has(opts.latencyBucket)
      ? opts.latencyBucket
      : classifyLatency(opts.latencyMs);

    var resultCountBucket = opts.resultCountBucket === 'positive' || opts.resultCountBucket === 'zero'
      ? opts.resultCountBucket
      : 'unknown';

    return Object.freeze({
      journey: JOURNEYS.JOURNEY_AUTHENTICATED_MY_TREES_LOAD,
      stage: stage,
      statusClass: statusClass,
      expectationClass: expectationClass,
      severity: severity,
      failureCode: failureCode,
      httpStatus: httpStatus,
      latencyBucket: latencyBucket,
      resultCountBucket: resultCountBucket
    });
  }

  window.LoveBudJourneyOutcomeTaxonomy = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    STATUS_CLASSES: STATUS_CLASSES,
    EXPECTATION_CLASSES: EXPECTATION_CLASSES,
    SEVERITY_CLASSES: SEVERITY_CLASSES,
    LATENCY_BUCKETS: LATENCY_BUCKETS,
    HTTP_STATUS_CLASSES: HTTP_STATUS_CLASSES,
    JOURNEYS: JOURNEYS,
    STAGES: STAGES,
    OUTCOME_EVENT_FIELDS: OUTCOME_EVENT_FIELDS,
    FAILURE_CODES: FAILURE_CODES,
    STATUS_CLASS_SET: STATUS_CLASS_SET,
    EXPECTATION_CLASS_SET: EXPECTATION_CLASS_SET,
    SEVERITY_CLASS_SET: SEVERITY_CLASS_SET,
    LATENCY_BUCKET_SET: LATENCY_BUCKET_SET,
    HTTP_STATUS_CLASS_SET: HTTP_STATUS_CLASS_SET,
    JOURNEY_SET: JOURNEY_SET,
    STAGE_SET: STAGE_SET,
    FAILURE_CODE_SET: FAILURE_CODE_SET,
    classifyLatency: classifyLatency,
    classifyHttpStatus: classifyHttpStatus,
    normalizeFailureCode: normalizeFailureCode,
    isAllowedFailureCode: isAllowedFailureCode,
    buildBoundedEvent: buildBoundedEvent
  });
})();
