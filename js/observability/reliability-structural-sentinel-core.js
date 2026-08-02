'use strict';

// Issue #3842 — Read-only structural sentinel evaluation authority
// (Reliability & Observability child of parent #3461).
//
// This module is the PRIVACY-SAFE READ-ONLY STRUCTURAL SENTINEL EVALUATOR.
// It is a PURE SOURCE AUTHORITY:
//   - carries NO capability (no network, provider, database, SQL execution,
//     filesystem write, process, or alert delivery);
//   - never accepts caller-supplied SQL, table, column, path, URL, env,
//     credential, or arbitrary metadata;
//   - executes only through an INJECTED read-only executor boundary and only
//     the fixed repository-owned aggregate query text from the query catalog;
//   - validates strictly one-row aggregate results with exact approved columns;
//   - reduces exact aggregate counts to the bounded #3835
//     count/deviation/outcome vocabulary;
//   - never emits an exact aggregate count, raw row, raw ID, raw SQL, or raw
//     database error in the public summary;
//   - is fail-closed on every privacy and safety boundary.
//
// Refs #3842.
// Refs #3835 — taxonomy authority.
// Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '1';

  // ---------------------------------------------------------------------------
  // Deep-freeze helpers (same equivalent immutable boundary as #3835 taxonomy).
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

  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function isCallable(value) {
    return typeof value === 'function';
  }

  // ---------------------------------------------------------------------------
  // Fixed sanitized error codes. These are bounded, frozen and carry NO
  // caller-controlled key/value, no raw exception, and no stack. They never
  // echo raw SQL, raw result rows, or raw database errors.
  // ---------------------------------------------------------------------------
  var ERROR_CODES = Object.freeze({
    UNKNOWN_DESCRIPTOR: 'UNKNOWN_DESCRIPTOR',
    EXECUTOR_MISSING: 'EXECUTOR_MISSING',
    EXECUTOR_NOT_CALLABLE: 'EXECUTOR_NOT_CALLABLE',
    RESULT_NOT_OBJECT: 'RESULT_NOT_OBJECT',
    RESULT_ROWS_NOT_ARRAY: 'RESULT_ROWS_NOT_ARRAY',
    ZERO_ROWS: 'ZERO_ROWS',
    MULTIPLE_ROWS: 'MULTIPLE_ROWS',
    ROW_NOT_OBJECT: 'ROW_NOT_OBJECT',
    EXTRA_COLUMN: 'EXTRA_COLUMN',
    MISSING_COLUMN: 'MISSING_COLUMN',
    COUNT_NOT_SAFE_INTEGER: 'COUNT_NOT_SAFE_INTEGER',
    COUNT_NEGATIVE: 'COUNT_NEGATIVE',
    COUNT_NAN: 'COUNT_NAN',
    COUNT_INFINITY: 'COUNT_INFINITY',
    COUNT_UNSAFE_BIGINT: 'COUNT_UNSAFE_BIGINT',
    PROXY_OR_ACCESSOR_INPUT: 'PROXY_OR_ACCESSOR_INPUT',
    INVALID_BASELINE_CLASS: 'INVALID_BASELINE_CLASS'
  });

  var ERROR_CODE_SET = (function () {
    var s = {};
    for (var k in ERROR_CODES) {
      if (Object.prototype.hasOwnProperty.call(ERROR_CODES, k)) s[ERROR_CODES[k]] = true;
    }
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // Fixed stage for read-only structural sentinel evaluations. The #3835
  // taxonomy requires a convergence stage; a read-only structural sentinel is a
  // single dispatched read-only request that returns a bounded result, so the
  // fixed stage is REQUEST_DISPATCHED. This is deterministic and bounded.
  // ---------------------------------------------------------------------------
  var FIXED_STAGE = 'REQUEST_DISPATCHED';

  // ---------------------------------------------------------------------------
  // Raw-result validation.
  //
  // Executor contract:
  //   executor.execute(descriptor) -> Promise<RawResult>
  //
  // RawResult must be an ordinary or null-prototype object with exactly:
  //   { rows: [ { <descriptor.result_contract.columns[0]>: <safe count> } ] }
  //
  // Accepted raw result shape:
  //   - rows is an array with exactly one row (reject zero rows and 2+ rows);
  //   - the row is an ordinary or null-prototype object with exactly the
  //     approved aggregate column(s) defined by the descriptor;
  //   - the count value is a non-negative safe integer, either as a JS number
  //     or as a decimal integer string (PostgreSQL bigint text form). Unsafe
  //     bigint, negative, fractional, NaN, Infinity, and non-numeric strings
  //     are rejected.
  //
  // Proxy/accessor/inherited/prototype-carried fields are rejected fail closed.
  // ---------------------------------------------------------------------------
  function validateRawResult(descriptor, rawResult) {
    if (!isPlainRecord(rawResult)) {
      return { ok: false, error: ERROR_CODES.RESULT_NOT_OBJECT };
    }
    if (!hasOwn(rawResult, 'rows') || !Array.isArray(rawResult.rows)) {
      return { ok: false, error: ERROR_CODES.RESULT_ROWS_NOT_ARRAY };
    }
    if (rawResult.rows.length !== 1) {
      return {
        ok: false,
        error: rawResult.rows.length === 0 ? ERROR_CODES.ZERO_ROWS : ERROR_CODES.MULTIPLE_ROWS
      };
    }
    var row = rawResult.rows[0];
    if (!isPlainRecord(row)) {
      return { ok: false, error: ERROR_CODES.ROW_NOT_OBJECT };
    }
    var expectedColumns = descriptor.result_contract.columns;
    var actualKeys = Object.keys(row);
    if (actualKeys.length !== expectedColumns.length) {
      return { ok: false, error: ERROR_CODES.EXTRA_COLUMN };
    }
    for (var i = 0; i < expectedColumns.length; i++) {
      if (!hasOwn(row, expectedColumns[i])) {
        return { ok: false, error: ERROR_CODES.MISSING_COLUMN };
      }
    }
    var column = expectedColumns[0];
    var value = row[column];
    var countResult = validateSafeCount(value);
    if (!countResult.ok) {
      return { ok: false, error: countResult.error };
    }
    return { ok: true, count: countResult.count };
  }

  function validateSafeCount(value) {
    if (typeof value === 'string') {
      if (!/^\d+$/.test(value)) {
        return { ok: false, error: ERROR_CODES.COUNT_NOT_SAFE_INTEGER };
      }
      var parsed = Number(value);
      if (!Number.isSafeInteger(parsed)) {
        return { ok: false, error: ERROR_CODES.COUNT_UNSAFE_BIGINT };
      }
      return { ok: true, count: parsed };
    }
    if (typeof value !== 'number') {
      return { ok: false, error: ERROR_CODES.COUNT_NOT_SAFE_INTEGER };
    }
    if (Number.isNaN(value)) {
      return { ok: false, error: ERROR_CODES.COUNT_NAN };
    }
    if (!Number.isFinite(value)) {
      return { ok: false, error: ERROR_CODES.COUNT_INFINITY };
    }
    if (!Number.isSafeInteger(value)) {
      return { ok: false, error: ERROR_CODES.COUNT_UNSAFE_BIGINT };
    }
    if (value < 0) {
      return { ok: false, error: ERROR_CODES.COUNT_NEGATIVE };
    }
    return { ok: true, count: value };
  }

  // ---------------------------------------------------------------------------
  // Bounded baseline classification boundary.
  //
  // This child never embeds a numeric Production threshold. The evaluator may
  // accept a separately supplied bounded baseline class string from the fixed
  // #3835 deviation vocabulary, or a synthetic-test-only policy seam, but it
  // REJECTS caller-provided arbitrary numeric threshold maps (objects, arrays,
  // numbers) fail closed.
  // ---------------------------------------------------------------------------
  function validateBaselineClass(taxonomy, baselineClass) {
    if (baselineClass === undefined || baselineClass === null) return { ok: true, value: null };
    if (typeof baselineClass !== 'string') {
      return { ok: false, error: ERROR_CODES.INVALID_BASELINE_CLASS };
    }
    var devSet = taxonomy && taxonomy.DEVIATION_SET;
    if (!devSet || !Object.prototype.hasOwnProperty.call(devSet, baselineClass) || !devSet[baselineClass]) {
      return { ok: false, error: ERROR_CODES.INVALID_BASELINE_CLASS };
    }
    return { ok: true, value: baselineClass };
  }

  // ---------------------------------------------------------------------------
  // Bounded reduction of an exact aggregate count.
  //
  // Required mapping (Issue #3842 "Baseline boundary"):
  //   zero orphan candidates + complete evidence
  //     -> outcome CONFIRMED, count_bucket zero, deviation NONE
  //   positive orphan candidates + complete evidence
  //     -> outcome ORPHAN_SIGNAL_DETECTED, count_bucket positive
  //   schema/query authority unavailable
  //     -> SCHEMA_AUTHORITY_UNAVAILABLE or INSUFFICIENT_EVIDENCE (non-success)
  //   executor failure or malformed result
  //     -> MONITORING_FAILED or INSUFFICIENT_EVIDENCE (non-success)
  //
  // No exact count is ever exposed; only the bounded bucket appears publicly.
  // ---------------------------------------------------------------------------
  function buildBoundedSummary(taxonomy, descriptor, releaseSha, opts) {
    var outcome = opts.outcome;
    var countBucket = opts.countBucket;
    var deviation = opts.deviation;
    var severity = opts.severity;
    var ownerAction = opts.ownerAction;
    var evidence = opts.evidence;

    var input = {
      operation_class: descriptor.operation_class,
      stage: FIXED_STAGE,
      outcome_code: outcome,
      release_sha: releaseSha,
      baseline_deviation: deviation,
      severity: severity,
      owner_action: ownerAction,
      evidence_completeness: evidence,
      count_bucket: countBucket
    };
    return taxonomy.buildBoundedResult(input);
  }

  // ---------------------------------------------------------------------------
  // Evaluator factory. The caller must inject the fixed query catalog and the
  // #3835 taxonomy. The executor is injected per-call; it never accepts
  // caller-selected SQL.
  // ---------------------------------------------------------------------------
  function createStructuralSentinelEvaluator(deps) {
    if (!deps || !isPlainRecord(deps)) {
      throw new TypeError(ERROR_CODES.EXECUTOR_NOT_CALLABLE);
    }
    var catalog = deps.catalog;
    var taxonomy = deps.taxonomy;
    if (!catalog || !taxonomy || !isPlainRecord(catalog) || !isPlainRecord(taxonomy)) {
      throw new TypeError(ERROR_CODES.EXECUTOR_MISSING);
    }
    if (!isCallable(catalog.getDescriptor) || !isCallable(taxonomy.buildBoundedResult)) {
      throw new TypeError(ERROR_CODES.EXECUTOR_MISSING);
    }

    async function evaluateSignal(signalOptions) {
      if (!signalOptions || !isPlainRecord(signalOptions)) {
        throw new TypeError(ERROR_CODES.EXECUTOR_MISSING);
      }
      var descriptorId = signalOptions.descriptorId;
      var executor = signalOptions.executor;
      var releaseSha = signalOptions.releaseSha;
      var baselineClass = signalOptions.baselineClass;

      if (typeof descriptorId !== 'string') {
        throw new TypeError(ERROR_CODES.UNKNOWN_DESCRIPTOR);
      }
      var descriptor = catalog.getDescriptor(descriptorId);
      if (!descriptor) {
        throw new TypeError(ERROR_CODES.UNKNOWN_DESCRIPTOR);
      }
      if (typeof releaseSha !== 'string') {
        throw new TypeError(ERROR_CODES.EXECUTOR_MISSING);
      }

      var baselineCheck = validateBaselineClass(taxonomy, baselineClass);
      if (!baselineCheck.ok) {
        throw new TypeError(baselineCheck.error);
      }

      // Deferred descriptor: schema/query authority unavailable. Non-success.
      if (descriptor.executable !== true) {
        return Promise.resolve(
          buildBoundedSummary(taxonomy, descriptor, releaseSha, {
            outcome: taxonomy.OUTCOME_CODES.SCHEMA_AUTHORITY_UNAVAILABLE,
            countBucket: taxonomy.COUNT_BUCKETS.UNKNOWN,
            deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
            severity: taxonomy.SEVERITIES.WARNING,
            ownerAction: taxonomy.OWNER_ACTIONS.OWNER_DECISION_REQUIRED,
            evidence: taxonomy.EVIDENCE_COMPLETENESS.MISSING
          })
        );
      }

      if (!executor || !isPlainRecord(executor) || !isCallable(executor.execute)) {
        throw new TypeError(ERROR_CODES.EXECUTOR_NOT_CALLABLE);
      }

      // Injected read-only executor boundary. The executor receives only the
      // fixed descriptor (never caller SQL). Any executor failure is sanitized
      // into MONITORING_FAILED; the raw error is never echoed.
      return Promise.resolve()
        .then(function () {
          return executor.execute(descriptor);
        })
        .then(function (rawResult) {
          var validation = validateRawResult(descriptor, rawResult);
          if (!validation.ok) {
            return buildBoundedSummary(taxonomy, descriptor, releaseSha, {
              outcome: taxonomy.OUTCOME_CODES.INSUFFICIENT_EVIDENCE,
              countBucket: taxonomy.COUNT_BUCKETS.UNKNOWN,
              deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
              severity: taxonomy.SEVERITIES.WARNING,
              ownerAction: taxonomy.OWNER_ACTIONS.INVESTIGATE,
              evidence: taxonomy.EVIDENCE_COMPLETENESS.INVALID
            });
          }
          var count = validation.count;
          if (count === 0) {
            return buildBoundedSummary(taxonomy, descriptor, releaseSha, {
              outcome: taxonomy.OUTCOME_CODES.CONFIRMED,
              countBucket: taxonomy.COUNT_BUCKETS.ZERO,
              deviation:
                baselineCheck.value || taxonomy.BASELINE_DEVIATION_CLASSES.NONE,
              severity: taxonomy.SEVERITIES.INFO,
              ownerAction: taxonomy.OWNER_ACTIONS.NO_ACTION,
              evidence: taxonomy.EVIDENCE_COMPLETENESS.COMPLETE
            });
          }
          return buildBoundedSummary(taxonomy, descriptor, releaseSha, {
            outcome: taxonomy.OUTCOME_CODES.ORPHAN_SIGNAL_DETECTED,
            countBucket: taxonomy.COUNT_BUCKETS.POSITIVE,
            deviation:
              baselineCheck.value || taxonomy.BASELINE_DEVIATION_CLASSES.MATERIAL_DEVIATION,
            severity: taxonomy.SEVERITIES.WARNING,
            ownerAction: taxonomy.OWNER_ACTIONS.INVESTIGATE,
            evidence: taxonomy.EVIDENCE_COMPLETENESS.COMPLETE
          });
        })
        .catch(function () {
          // Executor failure (or a rejected promise): sanitized to a fixed
          // bounded outcome. The raw error, SQL text, and stack are never
          // emitted.
          return buildBoundedSummary(taxonomy, descriptor, releaseSha, {
            outcome: taxonomy.OUTCOME_CODES.MONITORING_FAILED,
            countBucket: taxonomy.COUNT_BUCKETS.UNKNOWN,
            deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
            severity: taxonomy.SEVERITIES.BLOCKING,
            ownerAction: taxonomy.OWNER_ACTIONS.INVESTIGATE,
            evidence: taxonomy.EVIDENCE_COMPLETENESS.MISSING
          });
        });
    }

    return deepFreeze({
      CONTRACT_VERSION: CONTRACT_VERSION,
      FIXED_STAGE: FIXED_STAGE,
      ERROR_CODES: ERROR_CODES,
      validateBaselineClass: validateBaselineClass,
      validateRawResult: validateRawResult,
      validateSafeCount: validateSafeCount,
      evaluateSignal: evaluateSignal
    });
  }

  var STRUCTURAL_SENTINEL_CORE = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    FIXED_STAGE: FIXED_STAGE,
    ERROR_CODES: ERROR_CODES,
    ERROR_CODE_SET: ERROR_CODE_SET,
    CAPABILITIES: Object.freeze([]),
    createStructuralSentinelEvaluator: createStructuralSentinelEvaluator
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = STRUCTURAL_SENTINEL_CORE;
  }
  if (typeof window !== 'undefined') {
    window.LoveBudStructuralSentinelCore = STRUCTURAL_SENTINEL_CORE;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.LoveBudStructuralSentinelCore = STRUCTURAL_SENTINEL_CORE;
  }
})(this);
