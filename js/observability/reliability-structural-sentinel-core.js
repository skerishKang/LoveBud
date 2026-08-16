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
//   - evaluates PARITY_EVIDENCE descriptors ONLY against bounded sanitized
//     parity evidence supplied through the source-only translation seam,
//     reusing the #3860 outcome vocabulary exactly (PARITY_CONFIRMED,
//     PARITY_MISMATCH, AUTHORITY_ADOPTION_REQUIRED, CATALOG_COLLECTION_FAILED,
//     INSUFFICIENT_EVIDENCE) and mapping them to the bounded #3835 public
//     vocabulary (CONFIRMED, STRUCTURAL_DRIFT_DETECTED,
//     SCHEMA_AUTHORITY_UNAVAILABLE, MONITORING_FAILED, INSUFFICIENT_EVIDENCE);
//   - never emits an exact aggregate count, raw row, raw ID, raw SQL, raw
//     provider identity, or raw database error in the public summary;
//   - is fail-closed on every privacy and safety boundary.
//
// Refs #3842.
// Refs #3835 — taxonomy authority.
// Refs #3458 — canonical migration/expected-schema authority (completed).
// Refs #3860 — read-only parity core vocabulary (completed; NOT extended to
//              PRODUCTION scope).
// Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '2';

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
    INVALID_BASELINE_CLASS: 'INVALID_BASELINE_CLASS',
    PARITY_EVIDENCE_MISSING: 'PARITY_EVIDENCE_MISSING',
    PARITY_EVIDENCE_NOT_OBJECT: 'PARITY_EVIDENCE_NOT_OBJECT',
    PARITY_ENVELOPE_INVALID: 'PARITY_ENVELOPE_INVALID',
    PARITY_AUTHORITY_INVALID: 'PARITY_AUTHORITY_INVALID',
    PARITY_OBSERVED_INVALID: 'PARITY_OBSERVED_INVALID',
    PARITY_OBJECT_INVALID: 'PARITY_OBJECT_INVALID',
    PARITY_DUPLICATE_OBJECT: 'PARITY_DUPLICATE_OBJECT',
    PARITY_UNSUPPORTED_STATUS: 'PARITY_UNSUPPORTED_STATUS',
    PARITY_UNSUPPORTED_VERSION: 'PARITY_UNSUPPORTED_VERSION',
    PARITY_EMPTY_CRITICAL_OBJECTS: 'PARITY_EMPTY_CRITICAL_OBJECTS',
    PARITY_COLLECTION_FAILED: 'PARITY_COLLECTION_FAILED'
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
    var rows;
    try {
      rows = readOwnEnumerableDataProperty(rawResult, 'rows');
    } catch (e) {
      return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
    }
    if (!Array.isArray(rows)) {
      return { ok: false, error: ERROR_CODES.RESULT_ROWS_NOT_ARRAY };
    }
    if (rows.length !== 1) {
      return {
        ok: false,
        error: rows.length === 0 ? ERROR_CODES.ZERO_ROWS : ERROR_CODES.MULTIPLE_ROWS
      };
    }
    var row = rows[0];
    if (!isPlainRecord(row)) {
      return { ok: false, error: ERROR_CODES.ROW_NOT_OBJECT };
    }
    var expectedColumns = descriptor.result_contract.columns;
    var actualKeys;
    try {
      actualKeys = Object.keys(row);
    } catch (e) {
      return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
    }
    if (actualKeys.length !== expectedColumns.length) {
      return { ok: false, error: ERROR_CODES.EXTRA_COLUMN };
    }
    for (var i = 0; i < expectedColumns.length; i++) {
      if (!hasOwn(row, expectedColumns[i])) {
        return { ok: false, error: ERROR_CODES.MISSING_COLUMN };
      }
    }
    var column = expectedColumns[0];
    var value;
    try {
      value = readOwnEnumerableDataProperty(row, column);
    } catch (e) {
      return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
    }
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
  // Parity-evidence fixed key sets. A parity evidence envelope is accepted only
  // when it is an ordinary or null-prototype record with EXACTLY the fixed
  // keys below. Any extra key (including provider/database identity keys) is
  // rejected fail closed and never echoed.
  // ---------------------------------------------------------------------------
  var PARITY_ENVELOPE_KEYS = makeFrozenArray(['authority', 'observed']);
  var PARITY_FAILURE_KEYS = makeFrozenArray(['collection_failed']);
  var PARITY_AUTHORITY_KEYS = makeFrozenArray(['status', 'critical_objects']);
  var PARITY_OBSERVED_KEYS = makeFrozenArray(['format_version', 'normalizer_version', 'objects']);
  var PARITY_OBJECT_KEYS = makeFrozenArray(['name', 'fingerprint']);

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

  // Parity-evidence summaries carry NO count_bucket (a parity signal is not an
  // aggregate count signal). The summary still uses the bounded #3835 public
  // vocabulary; the #3860 parity outcome is reduced to the mapped public code
  // and is never echoed as a raw string.
  function buildParitySummary(taxonomy, descriptor, releaseSha, opts) {
    var input = {
      operation_class: descriptor.operation_class,
      stage: FIXED_STAGE,
      outcome_code: opts.outcome,
      release_sha: releaseSha,
      baseline_deviation: opts.deviation,
      severity: opts.severity,
      owner_action: opts.ownerAction,
      evidence_completeness: opts.evidence
    };
    return taxonomy.buildBoundedResult(input);
  }

  // ---------------------------------------------------------------------------
  // Bounded parity evidence validation. The evidence is a plain record with
  // exactly the fixed envelope keys. `authority` carries the committed
  // expected-schema critical objects; `observed` carries the sanitized observed
  // catalog. A bounded collection-failure marker `{ collection_failed: true }`
  // is accepted and mapped to the #3860 CATALOG_COLLECTION_FAILED outcome.
  // Every key set is exact-key; every object name/fingerprint must match the
  // fixed contract patterns; duplicates are rejected. Provider/database
  // identity keys are rejected fail closed and never echoed.
  // ---------------------------------------------------------------------------
  function validateParityEvidence(catalog, descriptor, parityEvidence) {
    if (parityEvidence === undefined || parityEvidence === null) {
      return { ok: false, error: ERROR_CODES.PARITY_EVIDENCE_MISSING };
    }
    if (!isPlainRecord(parityEvidence)) {
      return { ok: false, error: ERROR_CODES.PARITY_EVIDENCE_NOT_OBJECT };
    }

    // Bounded collection-failure marker (exact #3860 vocabulary mapping).
    if (hasOwn(parityEvidence, 'collection_failed') && !hasOwn(parityEvidence, 'authority') && !hasOwn(parityEvidence, 'observed')) {
      var keys1;
      try {
        keys1 = Object.keys(parityEvidence);
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      if (keys1.length !== 1) {
        return { ok: false, error: ERROR_CODES.PARITY_ENVELOPE_INVALID };
      }
      var flag;
      try {
        flag = readOwnEnumerableDataProperty(parityEvidence, 'collection_failed');
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      if (flag !== true) {
        return { ok: false, error: ERROR_CODES.PARITY_ENVELOPE_INVALID };
      }
      return { ok: true, collectionFailed: true };
    }

    var keys;
    try {
      keys = Object.keys(parityEvidence);
    } catch (e) {
      return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
    }
    if (keys.length !== PARITY_ENVELOPE_KEYS.length) {
      return { ok: false, error: ERROR_CODES.PARITY_ENVELOPE_INVALID };
    }
    for (var e = 0; e < PARITY_ENVELOPE_KEYS.length; e++) {
      if (keys.indexOf(PARITY_ENVELOPE_KEYS[e]) === -1) {
        return { ok: false, error: ERROR_CODES.PARITY_ENVELOPE_INVALID };
      }
    }

    var authority;
    var observed;
    try {
      authority = readOwnEnumerableDataProperty(parityEvidence, 'authority');
      observed = readOwnEnumerableDataProperty(parityEvidence, 'observed');
    } catch (err) {
      return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
    }

    var authorityResult = validateParityAuthority(catalog, descriptor, authority);
    if (!authorityResult.ok) return authorityResult;
    var observedResult = validateParityObserved(catalog, descriptor, observed);
    if (!observedResult.ok) return observedResult;
    return {
      ok: true,
      collectionFailed: false,
      authority: authorityResult.authority,
      observed: observedResult.observed
    };
  }

  function validateParityAuthority(catalog, descriptor, authority) {
    if (!isPlainRecord(authority)) {
      return { ok: false, error: ERROR_CODES.PARITY_AUTHORITY_INVALID };
    }
    var keys;
    try {
      keys = Object.keys(authority);
    } catch (e) {
      return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
    }
    if (keys.length !== PARITY_AUTHORITY_KEYS.length) {
      return { ok: false, error: ERROR_CODES.PARITY_AUTHORITY_INVALID };
    }
    for (var a = 0; a < PARITY_AUTHORITY_KEYS.length; a++) {
      if (keys.indexOf(PARITY_AUTHORITY_KEYS[a]) === -1) {
        return { ok: false, error: ERROR_CODES.PARITY_AUTHORITY_INVALID };
      }
    }
    var status;
    var criticalObjects;
    try {
      status = readOwnEnumerableDataProperty(authority, 'status');
      criticalObjects = readOwnEnumerableDataProperty(authority, 'critical_objects');
    } catch (err) {
      return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
    }
    var contract = (descriptor && descriptor.parity_contract) || {};
    var supportedStatuses = (contract.supported_authority_statuses && contract.supported_authority_statuses.slice) ? contract.supported_authority_statuses : [];
    if (supportedStatuses.indexOf(status) === -1) {
      return { ok: false, error: ERROR_CODES.PARITY_UNSUPPORTED_STATUS };
    }
    if (!Array.isArray(criticalObjects)) {
      return { ok: false, error: ERROR_CODES.PARITY_AUTHORITY_INVALID };
    }
    if (criticalObjects.length === 0) {
      return { ok: false, error: ERROR_CODES.PARITY_EMPTY_CRITICAL_OBJECTS };
    }
    var listResult = validateParityObjectList(catalog, descriptor, criticalObjects);
    if (!listResult.ok) return listResult;
    return { ok: true, authority: { status: status, critical_objects: listResult.objects } };
  }

  function validateParityObserved(catalog, descriptor, observed) {
    if (!isPlainRecord(observed)) {
      return { ok: false, error: ERROR_CODES.PARITY_OBSERVED_INVALID };
    }
    var keys;
    try {
      keys = Object.keys(observed);
    } catch (e) {
      return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
    }
    if (keys.length !== PARITY_OBSERVED_KEYS.length) {
      return { ok: false, error: ERROR_CODES.PARITY_OBSERVED_INVALID };
    }
    for (var o = 0; o < PARITY_OBSERVED_KEYS.length; o++) {
      if (keys.indexOf(PARITY_OBSERVED_KEYS[o]) === -1) {
        return { ok: false, error: ERROR_CODES.PARITY_OBSERVED_INVALID };
      }
    }
    var formatVersion;
    var normalizerVersion;
    var objects;
    try {
      formatVersion = readOwnEnumerableDataProperty(observed, 'format_version');
      normalizerVersion = readOwnEnumerableDataProperty(observed, 'normalizer_version');
      objects = readOwnEnumerableDataProperty(observed, 'objects');
    } catch (err) {
      return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
    }
    var contract = (descriptor && descriptor.parity_contract) || {};
    if (formatVersion !== contract.evidence_format_version) {
      return { ok: false, error: ERROR_CODES.PARITY_UNSUPPORTED_VERSION };
    }
    if (normalizerVersion !== contract.evidence_normalizer_version) {
      return { ok: false, error: ERROR_CODES.PARITY_UNSUPPORTED_VERSION };
    }
    if (!Array.isArray(objects)) {
      return { ok: false, error: ERROR_CODES.PARITY_OBSERVED_INVALID };
    }
    var listResult = validateParityObjectList(catalog, descriptor, objects);
    if (!listResult.ok) return listResult;
    return { ok: true, observed: { format_version: formatVersion, normalizer_version: normalizerVersion, objects: listResult.objects } };
  }

  function validateParityObjectList(catalog, descriptor, objects) {
    if (!Array.isArray(objects)) {
      return { ok: false, error: ERROR_CODES.PARITY_OBJECT_INVALID };
    }
    var contract = (descriptor && descriptor.parity_contract) || {};
    var namePattern = contract.object_name_pattern;
    var fingerprintPattern = contract.fingerprint_pattern;
    var normalized = [];
    var seen = {};
    for (var i = 0; i < objects.length; i++) {
      var object = objects[i];
      if (!isPlainRecord(object)) {
        return { ok: false, error: ERROR_CODES.PARITY_OBJECT_INVALID };
      }
      var keys;
      try {
        keys = Object.keys(object);
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      if (keys.length !== PARITY_OBJECT_KEYS.length) {
        return { ok: false, error: ERROR_CODES.PARITY_OBJECT_INVALID };
      }
      for (var k = 0; k < PARITY_OBJECT_KEYS.length; k++) {
        if (keys.indexOf(PARITY_OBJECT_KEYS[k]) === -1) {
          return { ok: false, error: ERROR_CODES.PARITY_OBJECT_INVALID };
        }
      }
      var name;
      var fingerprint;
      try {
        name = readOwnEnumerableDataProperty(object, 'name');
        fingerprint = readOwnEnumerableDataProperty(object, 'fingerprint');
      } catch (err) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      if (typeof name !== 'string' || !namePattern.test(name)) {
        return { ok: false, error: ERROR_CODES.PARITY_OBJECT_INVALID };
      }
      if (typeof fingerprint !== 'string' || !fingerprintPattern.test(fingerprint)) {
        return { ok: false, error: ERROR_CODES.PARITY_OBJECT_INVALID };
      }
      if (hasOwn(seen, name)) {
        return { ok: false, error: ERROR_CODES.PARITY_DUPLICATE_OBJECT };
      }
      seen[name] = true;
      normalized.push({ name: name, fingerprint: fingerprint });
    }
    return { ok: true, objects: normalized };
  }

  // ---------------------------------------------------------------------------
  // Parity comparison — exact reuse of the #3860 comparison semantics:
  // confirmed only when every expected critical object name is present in the
  // observed catalog with an identical fingerprint. A missing expected object,
  // a fingerprint difference, or an unexpected extra observed object is a
  // mismatch. CATALOGUED != APPLIED: an object being listed in the committed
  // authority NEVER implies it was observed live; only observed evidence can
  // confirm.
  // ---------------------------------------------------------------------------
  function compareParityVocabularies(authority, observed) {
    var expected = {};
    for (var i = 0; i < authority.critical_objects.length; i++) {
      expected[authority.critical_objects[i].name] = authority.critical_objects[i].fingerprint;
    }
    var seen = {};
    for (var j = 0; j < observed.objects.length; j++) {
      seen[observed.objects[j].name] = observed.objects[j].fingerprint;
    }
    var mismatched = [];
    var expectedNames = Object.keys(expected).sort();
    var observedNames = Object.keys(seen).sort();
    var allNames = {};
    for (var n = 0; n < expectedNames.length; n++) allNames[expectedNames[n]] = true;
    for (var m = 0; m < observedNames.length; m++) allNames[observedNames[m]] = true;
    var names = Object.keys(allNames).sort();
    for (var x = 0; x < names.length; x++) {
      var name = names[x];
      if (!hasOwn(seen, name)) {
        mismatched.push(name);
      } else if (hasOwn(expected, name) && seen[name] !== expected[name]) {
        mismatched.push(name);
      } else if (!hasOwn(expected, name)) {
        mismatched.push(name);
      }
    }
    return { confirmed: mismatched.length === 0, mismatchCount: mismatched.length };
  }

  // Map the bounded #3860 parity outcome to the bounded #3835 public
  // vocabulary. The #3860 outcome string is never echoed; only the fixed
  // public codes below are emitted.
  function parityOutcomeToSummary(taxonomy, descriptor, releaseSha, parityOutcome) {
    switch (parityOutcome) {
      case 'PARITY_CONFIRMED':
        return buildParitySummary(taxonomy, descriptor, releaseSha, {
          outcome: taxonomy.OUTCOME_CODES.CONFIRMED,
          deviation: taxonomy.BASELINE_DEVIATION_CLASSES.NONE,
          severity: taxonomy.SEVERITIES.INFO,
          ownerAction: taxonomy.OWNER_ACTIONS.NO_ACTION,
          evidence: taxonomy.EVIDENCE_COMPLETENESS.COMPLETE
        });
      case 'PARITY_MISMATCH':
        return buildParitySummary(taxonomy, descriptor, releaseSha, {
          outcome: taxonomy.OUTCOME_CODES.STRUCTURAL_DRIFT_DETECTED,
          deviation: taxonomy.BASELINE_DEVIATION_CLASSES.MATERIAL_DEVIATION,
          severity: taxonomy.SEVERITIES.WARNING,
          ownerAction: taxonomy.OWNER_ACTIONS.INVESTIGATE,
          evidence: taxonomy.EVIDENCE_COMPLETENESS.COMPLETE
        });
      case 'AUTHORITY_ADOPTION_REQUIRED':
        return buildParitySummary(taxonomy, descriptor, releaseSha, {
          outcome: taxonomy.OUTCOME_CODES.SCHEMA_AUTHORITY_UNAVAILABLE,
          deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
          severity: taxonomy.SEVERITIES.WARNING,
          ownerAction: taxonomy.OWNER_ACTIONS.OWNER_DECISION_REQUIRED,
          evidence: taxonomy.EVIDENCE_COMPLETENESS.PARTIAL
        });
      case 'CATALOG_COLLECTION_FAILED':
        return buildParitySummary(taxonomy, descriptor, releaseSha, {
          outcome: taxonomy.OUTCOME_CODES.MONITORING_FAILED,
          deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
          severity: taxonomy.SEVERITIES.BLOCKING,
          ownerAction: taxonomy.OWNER_ACTIONS.INVESTIGATE,
          evidence: taxonomy.EVIDENCE_COMPLETENESS.MISSING
        });
      default:
        return buildParitySummary(taxonomy, descriptor, releaseSha, {
          outcome: taxonomy.OUTCOME_CODES.INSUFFICIENT_EVIDENCE,
          deviation: taxonomy.BASELINE_DEVIATION_CLASSES.UNKNOWN,
          severity: taxonomy.SEVERITIES.WARNING,
          ownerAction: taxonomy.OWNER_ACTIONS.INVESTIGATE,
          evidence: taxonomy.EVIDENCE_COMPLETENESS.INVALID
        });
    }
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
      var parityEvidence = signalOptions.parityEvidence;

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

      // PARITY_EVIDENCE descriptor: evaluate ONLY against bounded sanitized
      // parity evidence through the source-only translation seam. No executor,
      // no SQL, no count rows.
      if (descriptor.descriptor_mode === 'PARITY_EVIDENCE') {
        return evaluateParitySignal(descriptor, releaseSha, parityEvidence);
      }

      // Deferred descriptor: schema/query authority unavailable. Non-success.
      if (descriptor.descriptor_mode === 'DEFERRED' || descriptor.executable !== true) {
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

    // Dedicated parity-evidence integration function. Accepts a bounded
    // sanitized parity evidence envelope (or a bounded collection-failure
    // marker) and returns a #3835 public summary. Never echoes the #3860
    // outcome string, object names, fingerprints, SQL, or provider identity.
    async function evaluateParitySignal(descriptor, releaseSha, parityEvidence) {
      var validation = validateParityEvidence(catalog, descriptor, parityEvidence);
      if (!validation.ok) {
        var code = validation.error;
        if (code === ERROR_CODES.PARITY_EMPTY_CRITICAL_OBJECTS) {
          return parityOutcomeToSummary(taxonomy, descriptor, releaseSha, 'AUTHORITY_ADOPTION_REQUIRED');
        }
        if (code === ERROR_CODES.PARITY_EVIDENCE_MISSING || code === ERROR_CODES.PARITY_EVIDENCE_NOT_OBJECT) {
          return parityOutcomeToSummary(taxonomy, descriptor, releaseSha, 'INSUFFICIENT_EVIDENCE');
        }
        return parityOutcomeToSummary(taxonomy, descriptor, releaseSha, 'INSUFFICIENT_EVIDENCE');
      }
      if (validation.collectionFailed) {
        return parityOutcomeToSummary(taxonomy, descriptor, releaseSha, 'CATALOG_COLLECTION_FAILED');
      }
      var comparison = compareParityVocabularies(validation.authority, validation.observed);
      if (comparison.confirmed) {
        return parityOutcomeToSummary(taxonomy, descriptor, releaseSha, 'PARITY_CONFIRMED');
      }
      return parityOutcomeToSummary(taxonomy, descriptor, releaseSha, 'PARITY_MISMATCH');
    }

    return deepFreeze({
      CONTRACT_VERSION: CONTRACT_VERSION,
      FIXED_STAGE: FIXED_STAGE,
      ERROR_CODES: ERROR_CODES,
      validateBaselineClass: validateBaselineClass,
      validateRawResult: validateRawResult,
      validateSafeCount: validateSafeCount,
      validateParityEvidence: validateParityEvidence,
      evaluateParitySignal: evaluateParitySignal,
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
