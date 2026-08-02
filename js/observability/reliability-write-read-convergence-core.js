'use strict';

// Issue #3852 — Memory-create write/read convergence core
// (Reliability & Observability child of parent #3461).
//
// This module is a PURE DEPENDENCY-INJECTED AUTHORITY. It:
//   - carries NO capability (no network, provider, database, SQL,
//     filesystem write, process, alert, timer, retry, or deployment);
//   - receives the release SHA, taxonomy, create dispatch, canonical
//     reread, and optional observer as injected dependencies;
//   - never fetches the release SHA itself;
//   - never exposes the stable internal identity in any public result,
//     error, event, console output, or test snapshot;
//   - uses an operation-local monotonic token to prevent stale earlier
//     completions from overwriting a later operation summary;
//   - never blocks, duplicates, retries, or modifies the normal user
//     write path;
//   - is fail-closed on every privacy and safety boundary.
//
// Refs #3852.
// Refs #3835 — taxonomy authority.
// Refs #3842 — structural sentinel pattern.
// Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '1';

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

  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return false;
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  function isCallable(value) {
    return typeof value === 'function';
  }

  function readOwnEnumerableDataProperty(object, key) {
    if (!isPlainRecord(object)) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    var descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(object, key);
    } catch (e) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    if (!descriptor) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    if (descriptor.enumerable !== true) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    if ('get' in descriptor || 'set' in descriptor) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    if (!('value' in descriptor)) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    return descriptor.value;
  }

  function readOptionalOwnEnumerableDataProperty(object, key) {
    if (!isPlainRecord(object)) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    var descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(object, key);
    } catch (e) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    if (!descriptor) {
      return undefined;
    }
    if (descriptor.enumerable !== true) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    if ('get' in descriptor || 'set' in descriptor) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    if (!('value' in descriptor)) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    return descriptor.value;
  }

  var ERROR_CODES = Object.freeze({
    UNKNOWN_OPERATION_CLASS: 'UNKNOWN_OPERATION_CLASS',
    UNKNOWN_STAGE: 'UNKNOWN_STAGE',
    UNKNOWN_OUTCOME: 'UNKNOWN_OUTCOME',
    MISSING_CREATE_DISPATCH: 'MISSING_CREATE_DISPATCH',
    MISSING_CANONICAL_REREAD: 'MISSING_CANONICAL_REREAD',
    MISSING_TAXONOMY: 'MISSING_TAXONOMY',
    MISSING_RELEASE_SHA: 'MISSING_RELEASE_SHA',
    INVALID_RELEASE_SHA: 'INVALID_RELEASE_SHA',
    CREATE_DISPATCH_NOT_CALLABLE: 'CREATE_DISPATCH_NOT_CALLABLE',
    CANONICAL_REREAD_NOT_CALLABLE: 'CANONICAL_REREAD_NOT_CALLABLE',
    INVALID_PAYLOAD: 'INVALID_PAYLOAD',
    PROXY_OR_ACCESSOR_INPUT: 'PROXY_OR_ACCESSOR_INPUT',
    UNKNOWN_INPUT: 'UNKNOWN_INPUT',
    OBSERVER_NOT_CALLABLE: 'OBSERVER_NOT_CALLABLE',
    STALE_RESULT_REJECTED: 'STALE_RESULT_REJECTED',
    IDENTITY_NOT_FOUND_IN_REREAD: 'IDENTITY_NOT_FOUND_IN_REREAD',
    ACKNOWLEDGEMENT_MISSING_ID: 'ACKNOWLEDGEMENT_MISSING_ID'
  });

  var ERROR_CODE_SET = (function () {
    var s = {};
    for (var k in ERROR_CODES) {
      if (Object.prototype.hasOwnProperty.call(ERROR_CODES, k)) s[ERROR_CODES[k]] = true;
    }
    return deepFreeze(s);
  })();

  var ALLOWED_OUTCOME_CODES = makeFrozenArray([
    'CONFIRMED',
    'TRANSPORT_FAILED',
    'ACKNOWLEDGEMENT_MISSING',
    'ACKNOWLEDGED_REREAD_MISSING',
    'MONITORING_FAILED',
    'INSUFFICIENT_EVIDENCE'
  ]);

  var ALLOWED_OUTCOME_SET = (function () {
    var s = {};
    for (var i = 0; i < ALLOWED_OUTCOME_CODES.length; i++) s[ALLOWED_OUTCOME_CODES[i]] = true;
    return deepFreeze(s);
  })();

  var RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;

  function isValidReleaseSha(value) {
    if (typeof value !== 'string') return false;
    return RELEASE_SHA_PATTERN.test(value);
  }

  function validateReleaseSha(releaseSha) {
    if (releaseSha === undefined || releaseSha === null) {
      return { ok: false, error: ERROR_CODES.MISSING_RELEASE_SHA };
    }
    if (!isValidReleaseSha(releaseSha)) {
      return { ok: false, error: ERROR_CODES.INVALID_RELEASE_SHA };
    }
    return { ok: true, value: releaseSha };
  }

  function validateDependencies(deps) {
    try {
      if (!deps || !isPlainRecord(deps)) {
        return { ok: false, error: ERROR_CODES.UNKNOWN_INPUT };
      }

      var createMemoryValue;
      try {
        createMemoryValue = readOptionalOwnEnumerableDataProperty(deps, 'createMemory');
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      if (createMemoryValue === undefined || createMemoryValue === null) {
        return { ok: false, error: ERROR_CODES.MISSING_CREATE_DISPATCH };
      }
      if (!isCallable(createMemoryValue)) {
        return { ok: false, error: ERROR_CODES.CREATE_DISPATCH_NOT_CALLABLE };
      }

      var canonicalRereadValue;
      try {
        canonicalRereadValue = readOptionalOwnEnumerableDataProperty(deps, 'canonicalReread');
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      if (canonicalRereadValue === undefined || canonicalRereadValue === null) {
        return { ok: false, error: ERROR_CODES.MISSING_CANONICAL_REREAD };
      }
      if (!isCallable(canonicalRereadValue)) {
        return { ok: false, error: ERROR_CODES.MISSING_CANONICAL_REREAD };
      }

      var taxonomyValue;
      try {
        taxonomyValue = readOptionalOwnEnumerableDataProperty(deps, 'taxonomy');
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      if (taxonomyValue === undefined || taxonomyValue === null || !isPlainRecord(taxonomyValue)) {
        return { ok: false, error: ERROR_CODES.MISSING_TAXONOMY };
      }

      var operationClasses;
      try {
        operationClasses = readOptionalOwnEnumerableDataProperty(taxonomyValue, 'OPERATION_CLASSES');
      } catch (e) {
        return { ok: false, error: ERROR_CODES.UNKNOWN_OPERATION_CLASS };
      }
      if (!isPlainRecord(operationClasses)) {
        return { ok: false, error: ERROR_CODES.UNKNOWN_OPERATION_CLASS };
      }
      var operationClassValue;
      try {
        operationClassValue = readOptionalOwnEnumerableDataProperty(
          operationClasses,
          'MEMORY_CREATE_CONVERGENCE'
        );
      } catch (e) {
        return { ok: false, error: ERROR_CODES.UNKNOWN_OPERATION_CLASS };
      }
      if (operationClassValue === undefined || operationClassValue === null || !operationClassValue) {
        return { ok: false, error: ERROR_CODES.UNKNOWN_OPERATION_CLASS };
      }

      var releaseShaValue;
      try {
        releaseShaValue = readOptionalOwnEnumerableDataProperty(deps, 'releaseSha');
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      if (releaseShaValue === undefined || releaseShaValue === null) {
        return { ok: false, error: ERROR_CODES.MISSING_RELEASE_SHA };
      }
      var shaCheck = validateReleaseSha(releaseShaValue);
      if (!shaCheck.ok) {
        return { ok: false, error: shaCheck.error };
      }

      var observerValue;
      try {
        observerValue = readOptionalOwnEnumerableDataProperty(deps, 'observer');
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      if (observerValue !== undefined && observerValue !== null) {
        if (!isCallable(observerValue)) {
          return { ok: false, error: ERROR_CODES.OBSERVER_NOT_CALLABLE };
        }
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
    }
  }

  function validateOutcomeCode(taxonomy, outcomeCode) {
    if (!taxonomy || !hasOwn(taxonomy, 'OUTCOME_CODES')) return false;
    var set = taxonomy.OUTCOME_CODES;
    return hasOwn(set, outcomeCode) && Boolean(set[outcomeCode]);
  }

  function validateStage(taxonomy, stage) {
    if (!taxonomy || !hasOwn(taxonomy, 'CONVERGENCE_STAGES')) return false;
    var set = taxonomy.CONVERGENCE_STAGES;
    return hasOwn(set, stage) && Boolean(set[stage]);
  }

  function validateOperationClass(taxonomy, opClass) {
    if (!taxonomy || !hasOwn(taxonomy, 'OPERATION_CLASSES')) return false;
    var set = taxonomy.OPERATION_CLASSES;
    return hasOwn(set, opClass) && Boolean(set[opClass]);
  }

  function monotonicToken() {
    var counter = 0;
    return function () {
      counter += 1;
      return counter;
    };
  }

  function createConvergenceCore(deps) {
    var validation = validateDependencies(deps);
    if (!validation.ok) {
      throw new TypeError(validation.error);
    }

    var createMemory;
    var canonicalReread;
    var taxonomy;
    var releaseSha;
    var observer = null;
    try {
      createMemory = readOwnEnumerableDataProperty(deps, 'createMemory');
      canonicalReread = readOwnEnumerableDataProperty(deps, 'canonicalReread');
      taxonomy = readOwnEnumerableDataProperty(deps, 'taxonomy');
      releaseSha = readOwnEnumerableDataProperty(deps, 'releaseSha');
      var observerValue = readOptionalOwnEnumerableDataProperty(deps, 'observer');
      if (observerValue !== undefined && observerValue !== null) {
        observer = observerValue;
      }
    } catch (e) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }

    var nextToken = monotonicToken();
    var latestToken = 0;
    var latestSummary = null;

    function sanitizeSummary(summary) {
      if (!summary || !isPlainRecord(summary)) return null;
      var result = {};
      var allowed = [
        'operation_class', 'stage', 'outcome_code', 'release_sha',
        'latency_bucket', 'count_bucket', 'baseline_deviation',
        'severity', 'owner_action', 'evidence_completeness'
      ];
      for (var i = 0; i < allowed.length; i++) {
        var key = allowed[i];
        if (hasOwn(summary, key) && summary[key] !== undefined && summary[key] !== null) {
          result[key] = summary[key];
        }
      }
      return deepFreeze(result);
    }

    function notifyObserver(summary) {
      if (!observer) return;
      try {
        observer(summary);
      } catch (e) {
        // Observer failure must never propagate or alter the save result.
      }
    }

    function recordSummary(token, summary) {
      if (token < latestToken) {
        return;
      }
      latestToken = token;
      latestSummary = summary;
    }

    function notifyProgress(stage) {
      notifyObserver(
        sanitizeSummary({
          operation_class: taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE,
          stage: stage,
          release_sha: releaseSha,
          baseline_deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
          severity: taxonomy.SEVERITIES.INFO,
          owner_action: taxonomy.OWNER_ACTIONS.NO_ACTION,
          evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.PARTIAL
        })
      );
    }

    async function converge(payload) {
      var token = nextToken();

      if (!payload || !isPlainRecord(payload)) {
        var invalidSummary = sanitizeSummary({
          operation_class: taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE,
          stage: taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED,
          outcome_code: taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING,
          release_sha: releaseSha,
          baseline_deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
          severity: taxonomy.SEVERITIES.BLOCKING,
          owner_action: taxonomy.OWNER_ACTIONS.INVESTIGATE,
          evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.INVALID
        });
        recordSummary(token, invalidSummary);
        notifyObserver(invalidSummary);
        return invalidSummary;
      }

      var acknowledgedIdentity = null;
      var useApi = false;
      var createdMemory = null;

      try {
        notifyProgress(taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED);
        var createResult = await createMemory(payload);

        if (!createResult || typeof createResult !== 'object') {
          var ackMissing = sanitizeSummary({
            operation_class: taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE,
            stage: taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED,
            outcome_code: taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING,
            release_sha: releaseSha,
            baseline_deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
            severity: taxonomy.SEVERITIES.BLOCKING,
            owner_action: taxonomy.OWNER_ACTIONS.INVESTIGATE,
            evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.MISSING
          });
          recordSummary(token, ackMissing);
          notifyObserver(ackMissing);
          return ackMissing;
        }

        createdMemory = createResult;
        var useApiValue;
        try {
          useApiValue = readOptionalOwnEnumerableDataProperty(createResult, 'useApi');
        } catch (e) {
          useApiValue = undefined;
        }
        useApi = useApiValue !== undefined && useApiValue !== null ? Boolean(useApiValue) : false;

        var rawMemory;
        try {
          rawMemory = readOptionalOwnEnumerableDataProperty(createResult, 'createdMemory');
        } catch (e) {
          rawMemory = null;
        }
        if (!rawMemory || typeof rawMemory !== 'object') {
          var ackMissing = sanitizeSummary({
            operation_class: taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE,
            stage: taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED,
            outcome_code: taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING,
            release_sha: releaseSha,
            baseline_deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
            severity: taxonomy.SEVERITIES.BLOCKING,
            owner_action: taxonomy.OWNER_ACTIONS.INVESTIGATE,
            evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.MISSING
          });
          recordSummary(token, ackMissing);
          notifyObserver(ackMissing);
          return ackMissing;
        }

        acknowledgedIdentity = readOwnEnumerableDataProperty(rawMemory, 'id');
        if (acknowledgedIdentity === undefined || acknowledgedIdentity === null) {
          var ackMissingId = sanitizeSummary({
            operation_class: taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE,
            stage: taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED,
            outcome_code: taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING,
            release_sha: releaseSha,
            baseline_deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
            severity: taxonomy.SEVERITIES.BLOCKING,
            owner_action: taxonomy.OWNER_ACTIONS.INVESTIGATE,
            evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.MISSING
          });
          recordSummary(token, ackMissingId);
          notifyObserver(ackMissingId);
          return ackMissingId;
        }

        notifyProgress(taxonomy.CONVERGENCE_STAGES.SERVER_ACKNOWLEDGED);

        var rereadResult;
        try {
          rereadResult = await canonicalReread(acknowledgedIdentity);
        } catch (e) {
          var monitoringFailed = sanitizeSummary({
            operation_class: taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE,
            stage: taxonomy.CONVERGENCE_STAGES.SERVER_ACKNOWLEDGED,
            outcome_code: taxonomy.OUTCOME_CODES.MONITORING_FAILED,
            release_sha: releaseSha,
            baseline_deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
            severity: taxonomy.SEVERITIES.WARNING,
            owner_action: taxonomy.OWNER_ACTIONS.INVESTIGATE,
            evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.MISSING
          });
          recordSummary(token, monitoringFailed);
          notifyObserver(monitoringFailed);
          return monitoringFailed;
        }

        if (!rereadResult || typeof rereadResult !== 'object') {
          var rereadMalformed = sanitizeSummary({
            operation_class: taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE,
            stage: taxonomy.CONVERGENCE_STAGES.SERVER_ACKNOWLEDGED,
            outcome_code: taxonomy.OUTCOME_CODES.INSUFFICIENT_EVIDENCE,
            release_sha: releaseSha,
            baseline_deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
            severity: taxonomy.SEVERITIES.WARNING,
            owner_action: taxonomy.OWNER_ACTIONS.INVESTIGATE,
            evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.INVALID
          });
          recordSummary(token, rereadMalformed);
          notifyObserver(rereadMalformed);
          return rereadMalformed;
        }

        var rereadMemories = null;
        if (hasOwn(rereadResult, 'memories') && Array.isArray(rereadResult.memories)) {
          rereadMemories = rereadResult.memories;
        } else if (Array.isArray(rereadResult)) {
          rereadMemories = rereadResult;
        }

        if (!rereadMemories) {
          var rereadMissing = sanitizeSummary({
            operation_class: taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE,
            stage: taxonomy.CONVERGENCE_STAGES.SERVER_ACKNOWLEDGED,
            outcome_code: taxonomy.OUTCOME_CODES.INSUFFICIENT_EVIDENCE,
            release_sha: releaseSha,
            baseline_deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
            severity: taxonomy.SEVERITIES.WARNING,
            owner_action: taxonomy.OWNER_ACTIONS.INVESTIGATE,
            evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.INVALID
          });
          recordSummary(token, rereadMissing);
          notifyObserver(rereadMissing);
          return rereadMissing;
        }

        var identityFound = false;
        for (var i = 0; i < rereadMemories.length; i++) {
          var mem = rereadMemories[i];
          if (!mem || typeof mem !== 'object') continue;
          try {
            var memId = readOwnEnumerableDataProperty(mem, 'id');
            if (String(memId) === String(acknowledgedIdentity)) {
              identityFound = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (identityFound) {
          var confirmed = sanitizeSummary({
            operation_class: taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE,
            stage: taxonomy.CONVERGENCE_STAGES.PERSISTED_REREAD_CONFIRMED,
            outcome_code: taxonomy.OUTCOME_CODES.CONFIRMED,
            release_sha: releaseSha,
            latency_bucket: taxonomy.LATENCY_BUCKETS.LT_250_MS,
            count_bucket: taxonomy.COUNT_BUCKETS.POSITIVE,
            baseline_deviation: taxonomy.BASELINE_DEVIATION_CLASSES.NONE,
            severity: taxonomy.SEVERITIES.INFO,
            owner_action: taxonomy.OWNER_ACTIONS.NO_ACTION,
            evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.COMPLETE
          });
          recordSummary(token, confirmed);
          notifyObserver(confirmed);
          return confirmed;
        }

        var ackRereadMissing = sanitizeSummary({
          operation_class: taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE,
          stage: taxonomy.CONVERGENCE_STAGES.SERVER_ACKNOWLEDGED,
          outcome_code: taxonomy.OUTCOME_CODES.ACKNOWLEDGED_REREAD_MISSING,
          release_sha: releaseSha,
          baseline_deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
          severity: taxonomy.SEVERITIES.WARNING,
          owner_action: taxonomy.OWNER_ACTIONS.INVESTIGATE,
          evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.COMPLETE
        });
        recordSummary(token, ackRereadMissing);
        notifyObserver(ackRereadMissing);
        return ackRereadMissing;
      } catch (e) {
        var isAccessorError = e.message === ERROR_CODES.PROXY_OR_ACCESSOR_INPUT;
        var transportFailedSummary = sanitizeSummary({
          operation_class: taxonomy.OPERATION_CLASSES.MEMORY_CREATE_CONVERGENCE,
          stage: taxonomy.CONVERGENCE_STAGES.REQUEST_DISPATCHED,
          outcome_code: isAccessorError
            ? taxonomy.OUTCOME_CODES.ACKNOWLEDGEMENT_MISSING
            : taxonomy.OUTCOME_CODES.TRANSPORT_FAILED,
          release_sha: releaseSha,
          baseline_deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
          severity: taxonomy.SEVERITIES.BLOCKING,
          owner_action: taxonomy.OWNER_ACTIONS.INVESTIGATE,
          evidence_completeness: taxonomy.EVIDENCE_COMPLETENESS.MISSING
        });
        recordSummary(token, transportFailedSummary);
        notifyObserver(transportFailedSummary);
        return transportFailedSummary;
      }
    }

    function getLatestSummary() {
      if (latestSummary === null) return null;
      return latestSummary;
    }

    return deepFreeze({
      CONTRACT_VERSION: CONTRACT_VERSION,
      converge: converge,
      getLatestSummary: getLatestSummary,
      ERROR_CODES: ERROR_CODES,
      ERROR_CODE_SET: ERROR_CODE_SET
    });
  }

  var WRITE_READ_CONVERGENCE_CORE = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    ERROR_CODES: ERROR_CODES,
    ERROR_CODE_SET: ERROR_CODE_SET,
    createConvergenceCore: createConvergenceCore
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WRITE_READ_CONVERGENCE_CORE;
  }
  if (typeof window !== 'undefined') {
    window.LoveBudWriteReadConvergenceCore = WRITE_READ_CONVERGENCE_CORE;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.LoveBudWriteReadConvergenceCore = WRITE_READ_CONVERGENCE_CORE;
  }
})(this);