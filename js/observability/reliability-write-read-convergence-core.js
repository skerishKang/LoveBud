'use strict';

// Issue #3852/#3855 — Memory-create and tree-create write/read convergence core
// (Reliability & Observability children of parent #3461).
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
// #3855 — bounded generalization: the create dispatch key, the acknowledgement
// record key, and the taxonomy operation class are configurable with memory
// defaults (createKey='createMemory', ackKey='createdMemory',
// operationClass='MEMORY_CREATE_CONVERGENCE') so the memory-create behavior
// and its contract remain byte-identical while the tree-create path reuses the
// same engine with operationClass='TREE_CREATE_CONVERGENCE'.
//
// Refs #3852.
// Refs #3855.
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

  // Plain own-property record boundary (#3852). We never use
  // Object.prototype.toString.call(value) because it can invoke a
  // Symbol.toStringTag getter or a Proxy get trap. Instead we use a bounded
  // getPrototypeOf probe (the prototype chain root is the terminal prototype,
  // i.e. an Object.prototype-like with prototype null, or the object has a
  // null prototype). This is realm-agnostic: objects created in other realms
  // (VM sandboxes, API responses) are still recognized as plain records while
  // class instances / Date / Map / Set / arrays / functions are rejected.
  // Callers wrap the probe so a throwing getPrototypeOf Proxy is mapped to a
  // fixed PROXY_OR_ACCESSOR_INPUT code (never a raw leakage).
  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    if (proto === null) return true;
    var rootProto = Object.getPrototypeOf(proto);
    return rootProto === null;
  }

  function isCallable(value) {
    return typeof value === 'function';
  }

  function proxyOrAccessorInput() {
    return new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
  }

  function readOwnEnumerableDataProperty(object, key) {
    var plain;
    try {
      plain = isPlainRecord(object);
    } catch (e) {
      throw proxyOrAccessorInput();
    }
    if (!plain) {
      throw proxyOrAccessorInput();
    }
    var descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(object, key);
    } catch (e) {
      throw proxyOrAccessorInput();
    }
    if (!descriptor) {
      throw proxyOrAccessorInput();
    }
    if (descriptor.enumerable !== true) {
      throw proxyOrAccessorInput();
    }
    if ('get' in descriptor || 'set' in descriptor) {
      throw proxyOrAccessorInput();
    }
    if (!('value' in descriptor)) {
      throw proxyOrAccessorInput();
    }
    return descriptor.value;
  }

  function readOptionalOwnEnumerableDataProperty(object, key) {
    var plain;
    try {
      plain = isPlainRecord(object);
    } catch (e) {
      throw proxyOrAccessorInput();
    }
    if (!plain) {
      throw proxyOrAccessorInput();
    }
    var descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(object, key);
    } catch (e) {
      throw proxyOrAccessorInput();
    }
    if (!descriptor) {
      return undefined;
    }
    if (descriptor.enumerable !== true) {
      throw proxyOrAccessorInput();
    }
    if ('get' in descriptor || 'set' in descriptor) {
      throw proxyOrAccessorInput();
    }
    if (!('value' in descriptor)) {
      throw proxyOrAccessorInput();
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

      // #3855 — bounded generalization. operationClass (default
      // MEMORY_CREATE_CONVERGENCE), createKey (default 'createMemory'), and
      // ackKey (default 'createdMemory') are optional deps read through the
      // descriptor-safe reader; memory defaults keep the #3852 contract
      // unchanged while tree-create passes TREE_CREATE_CONVERGENCE / 'createTree'
      // / 'createdTree'.
      var operationClassValue;
      try {
        operationClassValue = readOptionalOwnEnumerableDataProperty(deps, 'operationClass');
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      var operationClass =
        operationClassValue === undefined || operationClassValue === null
          ? 'MEMORY_CREATE_CONVERGENCE'
          : operationClassValue;
      if (typeof operationClass !== 'string' || operationClass.length === 0) {
        return { ok: false, error: ERROR_CODES.UNKNOWN_OPERATION_CLASS };
      }

      var createKeyValue;
      try {
        createKeyValue = readOptionalOwnEnumerableDataProperty(deps, 'createKey');
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      var createKey = createKeyValue === undefined || createKeyValue === null
        ? 'createMemory'
        : createKeyValue;
      if (typeof createKey !== 'string' || createKey.length === 0) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }

      var ackKeyValue;
      try {
        ackKeyValue = readOptionalOwnEnumerableDataProperty(deps, 'ackKey');
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      var ackKey = ackKeyValue === undefined || ackKeyValue === null
        ? 'createdMemory'
        : ackKeyValue;
      if (typeof ackKey !== 'string' || ackKey.length === 0) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }

      var createMemoryValue;
      try {
        createMemoryValue = readOptionalOwnEnumerableDataProperty(deps, createKey);
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
      var operationClassEnumValue;
      try {
        operationClassEnumValue = readOptionalOwnEnumerableDataProperty(operationClasses, operationClass);
      } catch (e) {
        return { ok: false, error: ERROR_CODES.UNKNOWN_OPERATION_CLASS };
      }
      if (operationClassEnumValue === undefined || operationClassEnumValue === null || !operationClassEnumValue) {
        return { ok: false, error: ERROR_CODES.UNKNOWN_OPERATION_CLASS };
      }

      var releaseShaValue;
      try {
        releaseShaValue = readOptionalOwnEnumerableDataProperty(deps, 'releaseSha');
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      var releaseReadinessValue;
      try {
        releaseReadinessValue = readOptionalOwnEnumerableDataProperty(deps, 'releaseReadiness');
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      if (releaseShaValue === undefined || releaseShaValue === null) {
        // #3852 — a deferred release SHA is allowed only when a callable
        // releaseReadiness seam is provided. The SHA is resolved inside
        // converge() AFTER REQUEST_DISPATCHED is recorded, so the first save
        // is always observed even when the release manifest is still PENDING.
        if (!isCallable(releaseReadinessValue)) {
          return { ok: false, error: ERROR_CODES.MISSING_RELEASE_SHA };
        }
      } else {
        var shaCheck = validateReleaseSha(releaseShaValue);
        if (!shaCheck.ok) {
          return { ok: false, error: shaCheck.error };
        }
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
    var releaseReadiness = null;
    var observer = null;
    var operationClass;
    var createKey;
    var ackKey;
    try {
      operationClass = readOptionalOwnEnumerableDataProperty(deps, 'operationClass');
      if (operationClass === undefined || operationClass === null || typeof operationClass !== 'string' || operationClass.length === 0) {
        operationClass = 'MEMORY_CREATE_CONVERGENCE';
      }
      createKey = readOptionalOwnEnumerableDataProperty(deps, 'createKey');
      if (createKey === undefined || createKey === null || typeof createKey !== 'string' || createKey.length === 0) {
        createKey = 'createMemory';
      }
      ackKey = readOptionalOwnEnumerableDataProperty(deps, 'ackKey');
      if (ackKey === undefined || ackKey === null || typeof ackKey !== 'string' || ackKey.length === 0) {
        ackKey = 'createdMemory';
      }
      createMemory = readOwnEnumerableDataProperty(deps, createKey);
      canonicalReread = readOwnEnumerableDataProperty(deps, 'canonicalReread');
      taxonomy = readOwnEnumerableDataProperty(deps, 'taxonomy');
      releaseSha = readOptionalOwnEnumerableDataProperty(deps, 'releaseSha') || null;
      var readinessValue = readOptionalOwnEnumerableDataProperty(deps, 'releaseReadiness');
      if (typeof readinessValue === 'function') {
        releaseReadiness = readinessValue;
      }
      var observerValue = readOptionalOwnEnumerableDataProperty(deps, 'observer');
      if (observerValue !== undefined && observerValue !== null) {
        observer = observerValue;
      }
    } catch (e) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }

    // -------------------------------------------------------------------------
    // #3852 — One-time descriptor-safe taxonomy capture. Every enum table and
    // every enum value used below is read exactly once through own-enumerable
    // data descriptors at core creation. The execution flow never performs a
    // repeated direct read (taxonomy.OPERATION_CLASSES, ...) so Proxy get traps
    // and accessor getters can never be invoked.
    // -------------------------------------------------------------------------
    var taxOpClasses;
    var taxStages;
    var taxOutcomes;
    var taxLatency;
    var taxCount;
    var taxDeviation;
    var taxSeverity;
    var taxActions;
    var taxCompleteness;
    var OP_MEMORY_CREATE;
    var STAGE_REQUEST_DISPATCHED;
    var STAGE_SERVER_ACKNOWLEDGED;
    var STAGE_PERSISTED_REREAD_CONFIRMED;
    var OUTCOME_ACK_MISSING;
    var OUTCOME_TRANSPORT_FAILED;
    var OUTCOME_MONITORING_FAILED;
    var OUTCOME_INSUFFICIENT_EVIDENCE;
    var OUTCOME_CONFIRMED;
    var OUTCOME_ACK_REREAD_MISSING;
    var LATENCY_LT_250_MS;
    var COUNT_POSITIVE;
    var DEV_NONE;
    var DEV_UNKNOWN;
    var SEV_INFO;
    var SEV_WARNING;
    var SEV_BLOCKING;
    var ACT_NO_ACTION;
    var ACT_INVESTIGATE;
    var EV_COMPLETE;
    var EV_MISSING;
    var EV_INVALID;
    var EV_PARTIAL;
    try {
      taxOpClasses = readOwnEnumerableDataProperty(taxonomy, 'OPERATION_CLASSES');
      taxStages = readOwnEnumerableDataProperty(taxonomy, 'CONVERGENCE_STAGES');
      taxOutcomes = readOwnEnumerableDataProperty(taxonomy, 'OUTCOME_CODES');
      taxLatency = readOwnEnumerableDataProperty(taxonomy, 'LATENCY_BUCKETS');
      taxCount = readOwnEnumerableDataProperty(taxonomy, 'COUNT_BUCKETS');
      taxDeviation = readOwnEnumerableDataProperty(taxonomy, 'BASELINE_DEVIATION_CLASSES');
      taxSeverity = readOwnEnumerableDataProperty(taxonomy, 'SEVERITIES');
      taxActions = readOwnEnumerableDataProperty(taxonomy, 'OWNER_ACTIONS');
      taxCompleteness = readOwnEnumerableDataProperty(taxonomy, 'EVIDENCE_COMPLETENESS');

      OP_MEMORY_CREATE = readOwnEnumerableDataProperty(taxOpClasses, operationClass);
      STAGE_REQUEST_DISPATCHED = readOwnEnumerableDataProperty(taxStages, 'REQUEST_DISPATCHED');
      STAGE_SERVER_ACKNOWLEDGED = readOwnEnumerableDataProperty(taxStages, 'SERVER_ACKNOWLEDGED');
      STAGE_PERSISTED_REREAD_CONFIRMED = readOwnEnumerableDataProperty(
        taxStages,
        'PERSISTED_REREAD_CONFIRMED'
      );
      OUTCOME_ACK_MISSING = readOwnEnumerableDataProperty(taxOutcomes, 'ACKNOWLEDGEMENT_MISSING');
      OUTCOME_TRANSPORT_FAILED = readOwnEnumerableDataProperty(taxOutcomes, 'TRANSPORT_FAILED');
      OUTCOME_MONITORING_FAILED = readOwnEnumerableDataProperty(taxOutcomes, 'MONITORING_FAILED');
      OUTCOME_INSUFFICIENT_EVIDENCE = readOwnEnumerableDataProperty(
        taxOutcomes,
        'INSUFFICIENT_EVIDENCE'
      );
      OUTCOME_CONFIRMED = readOwnEnumerableDataProperty(taxOutcomes, 'CONFIRMED');
      OUTCOME_ACK_REREAD_MISSING = readOwnEnumerableDataProperty(
        taxOutcomes,
        'ACKNOWLEDGED_REREAD_MISSING'
      );
      LATENCY_LT_250_MS = readOwnEnumerableDataProperty(taxLatency, 'LT_250_MS');
      COUNT_POSITIVE = readOwnEnumerableDataProperty(taxCount, 'POSITIVE');
      DEV_NONE = readOwnEnumerableDataProperty(taxDeviation, 'NONE');
      DEV_UNKNOWN = readOwnEnumerableDataProperty(taxDeviation, 'UNKNOWN');
      SEV_INFO = readOwnEnumerableDataProperty(taxSeverity, 'INFO');
      SEV_WARNING = readOwnEnumerableDataProperty(taxSeverity, 'WARNING');
      SEV_BLOCKING = readOwnEnumerableDataProperty(taxSeverity, 'BLOCKING');
      ACT_NO_ACTION = readOwnEnumerableDataProperty(taxActions, 'NO_ACTION');
      ACT_INVESTIGATE = readOwnEnumerableDataProperty(taxActions, 'INVESTIGATE');
      EV_COMPLETE = readOwnEnumerableDataProperty(taxCompleteness, 'COMPLETE');
      EV_MISSING = readOwnEnumerableDataProperty(taxCompleteness, 'MISSING');
      EV_INVALID = readOwnEnumerableDataProperty(taxCompleteness, 'INVALID');
      EV_PARTIAL = readOwnEnumerableDataProperty(taxCompleteness, 'PARTIAL');
    } catch (e) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }

    var nextToken = monotonicToken();
    var latestToken = 0;
    var latestSummary = null;
    // #3852 — first-save boundary. The release SHA is page-global and may be
    // resolved asynchronously (via releaseReadiness) AFTER REQUEST_DISPATCHED
    // is recorded; every summary uses the resolved value so the final
    // CONFIRMED always carries a valid SHA while progress summaries emitted
    // before readiness simply omit the field.
    var currentReleaseSha = releaseSha;

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

    // Returns true only when the summary is stored (the latest token). A stale
    // earlier completion is rejected here and must never reach the observer.
    function recordSummary(token, summary) {
      if (token < latestToken) {
        return false;
      }
      latestToken = token;
      latestSummary = summary;
      return true;
    }

    function notifyProgress(token, stage) {
      if (token < latestToken) {
        return;
      }
      notifyObserver(
        sanitizeSummary({
          operation_class: OP_MEMORY_CREATE,
          stage: stage,
          release_sha: currentReleaseSha,
          baseline_deviation: DEV_UNKNOWN,
          severity: SEV_INFO,
          owner_action: ACT_NO_ACTION,
          evidence_completeness: EV_PARTIAL
        })
      );
    }

    async function converge(payload) {
      var token = nextToken();

      var payloadPlain = false;
      try {
        payloadPlain = payload !== null && payload !== undefined && isPlainRecord(payload);
      } catch (e) {
        payloadPlain = false;
      }

      if (!payloadPlain) {
        var invalidSummary = sanitizeSummary({
          operation_class: OP_MEMORY_CREATE,
          stage: STAGE_REQUEST_DISPATCHED,
          outcome_code: OUTCOME_ACK_MISSING,
          release_sha: currentReleaseSha,
          baseline_deviation: DEV_UNKNOWN,
          severity: SEV_BLOCKING,
          owner_action: ACT_INVESTIGATE,
          evidence_completeness: EV_INVALID
        });
        if (recordSummary(token, invalidSummary)) {
          notifyObserver(invalidSummary);
        }
        return invalidSummary;
      }

      var acknowledgedIdentity = null;
      var useApi = false;
      var createdMemory = null;

      try {
        notifyProgress(token, STAGE_REQUEST_DISPATCHED);

        // #3852 — first-save boundary. When the release manifest is still
        // PENDING at save time, the SHA is resolved through the release
        // readiness seam AFTER REQUEST_DISPATCHED is recorded (dispatch
        // chronology never waits for the manifest) and BEFORE the canonical
        // reread / final CONFIRMED. A missing or invalid release SHA resolves
        // to a bounded MONITORING_FAILED — the operation is never classified
        // CONFIRMED without a valid SHA.
        if (currentReleaseSha === null && typeof releaseReadiness === 'function') {
          var ready = null;
          try {
            ready = await releaseReadiness();
          } catch (e) {
            ready = null;
          }
          var readyOk = false;
          var readySha = null;
          if (ready !== null && ready !== undefined && typeof ready === 'object') {
            var okValue;
            var shaValue;
            try {
              okValue = readOptionalOwnEnumerableDataProperty(ready, 'ok');
              shaValue = readOwnEnumerableDataProperty(ready, 'releaseSha');
            } catch (e) {
              okValue = undefined;
              shaValue = undefined;
            }
            readyOk =
              okValue === true &&
              typeof shaValue === 'string' &&
              isValidReleaseSha(shaValue);
            if (readyOk) {
              readySha = shaValue;
            }
          }
          if (!readyOk) {
            var releaseUnavailable = sanitizeSummary({
              operation_class: OP_MEMORY_CREATE,
              stage: STAGE_REQUEST_DISPATCHED,
              outcome_code: OUTCOME_MONITORING_FAILED,
              release_sha: null,
              baseline_deviation: DEV_UNKNOWN,
              severity: SEV_WARNING,
              owner_action: ACT_INVESTIGATE,
              evidence_completeness: EV_MISSING
            });
            if (recordSummary(token, releaseUnavailable)) {
              notifyObserver(releaseUnavailable);
            }
            return releaseUnavailable;
          }
          currentReleaseSha = readySha;
        }

        var createResult = await createMemory(payload);

        if (!createResult || typeof createResult !== 'object') {
          var ackMissing = sanitizeSummary({
            operation_class: OP_MEMORY_CREATE,
            stage: STAGE_REQUEST_DISPATCHED,
            outcome_code: OUTCOME_ACK_MISSING,
            release_sha: currentReleaseSha,
            baseline_deviation: DEV_UNKNOWN,
            severity: SEV_BLOCKING,
            owner_action: ACT_INVESTIGATE,
            evidence_completeness: EV_MISSING
          });
          if (recordSummary(token, ackMissing)) {
            notifyObserver(ackMissing);
          }
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
          rawMemory = readOptionalOwnEnumerableDataProperty(createResult, ackKey);
        } catch (e) {
          rawMemory = null;
        }
        if (!rawMemory || typeof rawMemory !== 'object') {
          var ackMissingMemory = sanitizeSummary({
            operation_class: OP_MEMORY_CREATE,
            stage: STAGE_REQUEST_DISPATCHED,
            outcome_code: OUTCOME_ACK_MISSING,
            release_sha: currentReleaseSha,
            baseline_deviation: DEV_UNKNOWN,
            severity: SEV_BLOCKING,
            owner_action: ACT_INVESTIGATE,
            evidence_completeness: EV_MISSING
          });
          if (recordSummary(token, ackMissingMemory)) {
            notifyObserver(ackMissingMemory);
          }
          return ackMissingMemory;
        }

        // #3852 — the acknowledgement identity is a non-empty string only.
        // String()/toString()/valueOf() are never called on the identity, so no
        // user code can run. Accessor identity is rejected via the descriptor.
        try {
          acknowledgedIdentity = readOwnEnumerableDataProperty(rawMemory, 'id');
        } catch (e) {
          acknowledgedIdentity = null;
        }
        if (typeof acknowledgedIdentity !== 'string' || acknowledgedIdentity.length === 0) {
          var ackMissingId = sanitizeSummary({
            operation_class: OP_MEMORY_CREATE,
            stage: STAGE_REQUEST_DISPATCHED,
            outcome_code: OUTCOME_ACK_MISSING,
            release_sha: currentReleaseSha,
            baseline_deviation: DEV_UNKNOWN,
            severity: SEV_BLOCKING,
            owner_action: ACT_INVESTIGATE,
            evidence_completeness: EV_MISSING
          });
          if (recordSummary(token, ackMissingId)) {
            notifyObserver(ackMissingId);
          }
          return ackMissingId;
        }

        notifyProgress(token, STAGE_SERVER_ACKNOWLEDGED);

        var rereadResult;
        try {
          rereadResult = await canonicalReread(acknowledgedIdentity);
        } catch (e) {
          var monitoringFailed = sanitizeSummary({
            operation_class: OP_MEMORY_CREATE,
            stage: STAGE_SERVER_ACKNOWLEDGED,
            outcome_code: OUTCOME_MONITORING_FAILED,
            release_sha: currentReleaseSha,
            baseline_deviation: DEV_UNKNOWN,
            severity: SEV_WARNING,
            owner_action: ACT_INVESTIGATE,
            evidence_completeness: EV_MISSING
          });
          if (recordSummary(token, monitoringFailed)) {
            notifyObserver(monitoringFailed);
          }
          return monitoringFailed;
        }

        if (!rereadResult || typeof rereadResult !== 'object') {
          var rereadMalformed = sanitizeSummary({
            operation_class: OP_MEMORY_CREATE,
            stage: STAGE_SERVER_ACKNOWLEDGED,
            outcome_code: OUTCOME_INSUFFICIENT_EVIDENCE,
            release_sha: currentReleaseSha,
            baseline_deviation: DEV_UNKNOWN,
            severity: SEV_WARNING,
            owner_action: ACT_INVESTIGATE,
            evidence_completeness: EV_INVALID
          });
          if (recordSummary(token, rereadMalformed)) {
            notifyObserver(rereadMalformed);
          }
          return rereadMalformed;
        }

        // #3852 — the reread memories array is read through a descriptor-safe
        // reader; direct `rereadResult.memories` access is forbidden because it
        // could invoke a getter or Proxy get trap.
        var rereadMemories = null;
        if (Array.isArray(rereadResult)) {
          rereadMemories = rereadResult;
        } else {
          var memoriesValue;
          try {
            memoriesValue = readOwnEnumerableDataProperty(rereadResult, 'memories');
          } catch (e) {
            memoriesValue = null;
          }
          if (Array.isArray(memoriesValue)) {
            rereadMemories = memoriesValue;
          }
        }

        if (!rereadMemories) {
          var rereadMissing = sanitizeSummary({
            operation_class: OP_MEMORY_CREATE,
            stage: STAGE_SERVER_ACKNOWLEDGED,
            outcome_code: OUTCOME_INSUFFICIENT_EVIDENCE,
            release_sha: currentReleaseSha,
            baseline_deviation: DEV_UNKNOWN,
            severity: SEV_WARNING,
            owner_action: ACT_INVESTIGATE,
            evidence_completeness: EV_INVALID
          });
          if (recordSummary(token, rereadMissing)) {
            notifyObserver(rereadMissing);
          }
          return rereadMissing;
        }

        var identityFound = false;
        for (var i = 0; i < rereadMemories.length; i++) {
          var mem = rereadMemories[i];
          if (!mem || typeof mem !== 'object') continue;
          var memId;
          try {
            memId = readOwnEnumerableDataProperty(mem, 'id');
          } catch (e) {
            continue;
          }
          if (typeof memId === 'string' && memId === acknowledgedIdentity) {
            identityFound = true;
            break;
          }
        }

        if (identityFound) {
          var confirmed = sanitizeSummary({
            operation_class: OP_MEMORY_CREATE,
            stage: STAGE_PERSISTED_REREAD_CONFIRMED,
            outcome_code: OUTCOME_CONFIRMED,
            release_sha: currentReleaseSha,
            latency_bucket: LATENCY_LT_250_MS,
            count_bucket: COUNT_POSITIVE,
            baseline_deviation: DEV_NONE,
            severity: SEV_INFO,
            owner_action: ACT_NO_ACTION,
            evidence_completeness: EV_COMPLETE
          });
          if (recordSummary(token, confirmed)) {
            notifyObserver(confirmed);
          }
          return confirmed;
        }

        var ackRereadMissing = sanitizeSummary({
          operation_class: OP_MEMORY_CREATE,
          stage: STAGE_SERVER_ACKNOWLEDGED,
          outcome_code: OUTCOME_ACK_REREAD_MISSING,
          release_sha: currentReleaseSha,
          baseline_deviation: DEV_UNKNOWN,
          severity: SEV_WARNING,
          owner_action: ACT_INVESTIGATE,
          evidence_completeness: EV_COMPLETE
        });
        if (recordSummary(token, ackRereadMissing)) {
          notifyObserver(ackRereadMissing);
        }
        return ackRereadMissing;
      } catch (e) {
        var isAccessorError =
          typeof e === 'object' &&
          e !== null &&
          e.message === ERROR_CODES.PROXY_OR_ACCESSOR_INPUT;
        var transportFailedSummary = sanitizeSummary({
          operation_class: OP_MEMORY_CREATE,
          stage: STAGE_REQUEST_DISPATCHED,
          outcome_code: isAccessorError
            ? OUTCOME_ACK_MISSING
            : OUTCOME_TRANSPORT_FAILED,
          release_sha: currentReleaseSha,
          baseline_deviation: DEV_UNKNOWN,
          severity: SEV_BLOCKING,
          owner_action: ACT_INVESTIGATE,
          evidence_completeness: EV_MISSING
        });
        if (recordSummary(token, transportFailedSummary)) {
          notifyObserver(transportFailedSummary);
        }
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
