'use strict';

// Issue #4081 — Source-only synthetic canary lifecycle harness (parent #3461).
//
// This module is a PURE, DEPENDENCY-INJECTED source authority that models the
// synthetic canary write/read/cleanup lifecycle:
//
//   IDLE
//   -> AUTH_ACQUIRED
//   -> FIXTURE_READY
//   -> MEMORY_WRITE_DISPATCHED
//   -> MEMORY_WRITE_ACKNOWLEDGED
//   -> CANONICAL_REREAD_CONFIRMED
//   -> OWNER_READ_CONFIRMED
//   -> [VISIBILITY_OBSERVED]           (optional; ALWAYS PRIVATE here)
//   -> CLEANUP_CONFIRMED | FIXTURE_RETAINED_DETERMINISTIC
//
// Failure / control terminals:
//   BOUNDED_STAGE_FAILURE | CLEANUP_FAILED | FENCED
//   plus interrupted-run recovery + deterministic retained terminal.
//
// It carries NO capability (no network, provider, database, SQL, filesystem
// write, process, timer, retry, alert, scheduler, or deployment). Every effect
// (QA auth, fixture identity, memory write dispatch, canonical reread, owner
// read, cleanup, fence, #4080 write-outcome classifier, optional visibility /
// browse observers) is INJECTED; real auth/network/DB writes = 0.
//
// It reuses the #3835 canonical action vocabulary (STOP_SYNTHETIC_WRITES,
// OWNER_DECISION_REQUIRED) and the #3835 bounded enums only; it does NOT
// define a new public action enum, and it does NOT invent a retry authority.
//
// It consumes the finalized #4080 write-outcome classifier BY VALUE through an
// injected seam. A missing/unavailable classifier authority fails closed
// (the lifecycle never falls back to an alternate write vocabulary, and no
// write acknowledgement is ever treated as a canonical reread confirmation).
//
// CRITICAL SAFETY CONTRACTS:
//   - QA identity is an OPAQUE injected capability: no raw credential, email,
//     UID, owner/tree/memory id, fixture id, fence token/generation, connection
//     string, raw count, or real content is ever emitted into a public output,
//     log, event, or result. PRIVATE_KEYS are rejected on input and output.
//   - No non-QA-owned row is ever read, mutated, or cleaned up; ownership is
//     re-verified immediately before every mutation and cleanup. Ownership
//     mismatch -> FENCED -> STOP_SYNTHETIC_WRITES + OWNER_DECISION_REQUIRED.
//   - Concurrent-run fencing: fence authority exposes
//     acquire(runKey, boundedExpiry) / assertCurrent(fence) / renew(fence) /
//     release(fence). A stale or superseded runner can neither write nor clean
//     up. Fencing authority unavailable => fail closed (mutation = 0).
//   - WRITE_STATUS_UNKNOWN (#4080) is retry_safe=false: no blind retry; a
//     canonical reread/reconciliation must run first. Residual ambiguity =>
//     STOP_SYNTHETIC_WRITES + OWNER_DECISION_REQUIRED.
//   - The standard canary is ALWAYS PRIVATE and NON_BROWSE_ELIGIBLE; there is
//     no API to self-promote. Unexpected observed Browse eligibility fails
//     closed (STOP_SYNTHETIC_WRITES). Deep Browse/publication behavior is a
//     separate owner approval.
//   - Synthetic fixtures carry a fixed exclusion marker and are separated from
//     user baselines/metrics at the provenance boundary (never deduplicated
//     afterwards). No Production schema field is invented.
//
// Refs #4081.
// Refs #3461 — Keep OPEN.
// Refs #3835.
// Refs #3852.
// Refs #3855.
// Refs #4079.
// Refs #4080.
// Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '1';

  // ---------------------------------------------------------------------------
  // Boundaries.
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

  // Realm-agnostic plain record boundary. Array/Date/Map/Set/class instance/
  // function all rejected; caller prototype can never become authority.
  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return false;
    var proto;
    try {
      proto = Object.getPrototypeOf(value);
    } catch (e) {
      return false;
    }
    if (proto === null) return true;
    var rootProto;
    try {
      rootProto = Object.getPrototypeOf(proto);
    } catch (e) {
      return false;
    }
    return rootProto === null;
  }

  function isCallable(value) {
    return typeof value === 'function';
  }

  function readOwnData(object, key) {
    var descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(object, key);
    } catch (e) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    if (!descriptor || descriptor.enumerable !== true || !('value' in descriptor) || 'get' in descriptor || 'set' in descriptor) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }
    return descriptor.value;
  }

  function readOwnDataOptional(object, key) {
    if (!hasOwn(object, key)) return undefined;
    return readOwnData(object, key);
  }

  // ---------------------------------------------------------------------------
  // Fixed, sanitized error codes. Never a caller-controlled value.
  // ---------------------------------------------------------------------------
  var ERROR_CODES = Object.freeze({
    UNKNOWN_INPUT: 'UNKNOWN_INPUT',
    PROXY_OR_ACCESSOR_INPUT: 'PROXY_OR_ACCESSOR_INPUT',
    INVALID_DEPENDENCY: 'INVALID_DEPENDENCY',
    MISSING_TAXONOMY: 'MISSING_TAXONOMY',
    CLASSIFIER_UNAVAILABLE: 'CLASSIFIER_UNAVAILABLE',
    INVALID_RUN_KEY: 'INVALID_RUN_KEY',
    PRIVATE_FIELD_REJECTED: 'PRIVATE_FIELD_REJECTED',
    NON_CANONICAL_RESULT: 'NON_CANONICAL_RESULT',
    STALE_RUNNER: 'STALE_RUNNER',
    OWNERSHIP_MISMATCH: 'OWNERSHIP_MISMATCH'
  });

  // ---------------------------------------------------------------------------
  // PRIVATE_KEYS — rejected on input and output. Key-based strict matching.
  // ---------------------------------------------------------------------------
  var PRIVATE_KEYS = makeFrozenArray([
    'token', 'cookie', 'authorization', 'email', 'user_id', 'uid',
    'owner_id', 'tree_id', 'memory_id', 'target_id', 'title', 'description',
    'content', 'memo', 'url', 'query', 'payload', 'request_body',
    'response_body', 'sql', 'raw_error', 'exception', 'stack', 'database_url',
    'secret', 'credential', 'request_id', 'provider', 'provider_id',
    'connection', 'account_id', 'project_id', 'timestamp', 'metadata',
    'fixture_id', 'fence_token', 'fence_generation', 'run_key', 'row_count',
    'raw_count'
  ]);

  var PRIVATE_KEY_SET = (function () {
    var s = {};
    for (var i = 0; i < PRIVATE_KEYS.length; i++) s[PRIVATE_KEYS[i]] = true;
    return deepFreeze(s);
  })();

  function hasPrivateKeyIn(record) {
    var keys = Object.keys(record);
    for (var i = 0; i < keys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(PRIVATE_KEY_SET, keys[i])) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle stage vocabulary (#4081).
  // ---------------------------------------------------------------------------
  var LIFECYCLE_STAGE_ORDER = makeFrozenArray([
    'IDLE',
    'AUTH_ACQUIRED',
    'FIXTURE_READY',
    'MEMORY_WRITE_DISPATCHED',
    'MEMORY_WRITE_ACKNOWLEDGED',
    'CANONICAL_REREAD_CONFIRMED',
    'OWNER_READ_CONFIRMED',
    'VISIBILITY_OBSERVED'
  ]);

  var LIFECYCLE_STAGES = Object.freeze({
    IDLE: 'IDLE',
    AUTH_ACQUIRED: 'AUTH_ACQUIRED',
    FIXTURE_READY: 'FIXTURE_READY',
    MEMORY_WRITE_DISPATCHED: 'MEMORY_WRITE_DISPATCHED',
    MEMORY_WRITE_ACKNOWLEDGED: 'MEMORY_WRITE_ACKNOWLEDGED',
    CANONICAL_REREAD_CONFIRMED: 'CANONICAL_REREAD_CONFIRMED',
    OWNER_READ_CONFIRMED: 'OWNER_READ_CONFIRMED',
    VISIBILITY_OBSERVED: 'VISIBILITY_OBSERVED'
  });

  var TERMINAL_STATES = Object.freeze({
    CLEANUP_CONFIRMED: 'CLEANUP_CONFIRMED',
    FIXTURE_RETAINED_DETERMINISTIC: 'FIXTURE_RETAINED_DETERMINISTIC'
  });

  var FAILURE_STATES = Object.freeze({
    BOUNDED_STAGE_FAILURE: 'BOUNDED_STAGE_FAILURE',
    CLEANUP_FAILED: 'CLEANUP_FAILED',
    FENCED: 'FENCED'
  });

  // Visibility of the standard canary: always private, never Browse eligible.
  var SYNTHETIC_VISIBILITY = Object.freeze({
    VISIBILITY: 'PRIVATE',
    BROWSE_ELIGIBLE: 'NON_BROWSE_ELIGIBLE'
  });

  // Fixed synthetic-exclusion marker (provenance boundary, pre-aggregation).
  var SYNTHETIC_EXCLUSION = 'SYNTHETIC_CANARY_EXCLUDED';

  // ---------------------------------------------------------------------------
  // Release SHA (mirrors #3835) + opaque bounded run key.
  // ---------------------------------------------------------------------------
  var RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;
  function isValidReleaseSha(value) {
    return typeof value === 'string' && RELEASE_SHA_PATTERN.test(value);
  }

  function isValidRunKey(value) {
    if (typeof value !== 'string') return false;
    if (value.length === 0 || value.length > 128) return false;
    return !/[\s\u0000-\u001f]/.test(value);
  }

  // ---------------------------------------------------------------------------
  // Injected-effect surface checks. An injected effect object is a plain record
  // whose named method is an own enumerable data function.
  // ---------------------------------------------------------------------------
  function validateEffectMethod(object, methodName) {
    if (!isPlainRecord(object)) return false;
    var descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(object, methodName);
    } catch (e) {
      return false;
    }
    if (!descriptor || descriptor.enumerable !== true || !('value' in descriptor) || 'get' in descriptor || 'set' in descriptor) {
      return false;
    }
    return isCallable(descriptor.value);
  }

  // Required effect methods per injected effect.
  function validateDependencies(deps) {
    if (!deps || !isPlainRecord(deps)) {
      return { ok: false, error: ERROR_CODES.UNKNOWN_INPUT };
    }

    var required = [
      { key: 'qaAuth', methods: ['acquireAuth'] },
      { key: 'fixture', methods: ['prepareFixture'] },
      { key: 'writeDispatch', methods: ['dispatchMemory'] },
      { key: 'canonicalReread', methods: ['reread'] },
      { key: 'ownerRead', methods: ['readOwner'] },
      { key: 'cleanup', methods: ['cleanup'] },
      { key: 'fence', methods: ['acquire', 'assertCurrent', 'renew', 'release'] },
      { key: 'classifier', methods: ['classifyWriteOutcome'] }
    ];

    var collected = {};
    for (var i = 0; i < required.length; i++) {
      var entry = required[i];
      var value;
      try {
        value = readOwnDataOptional(deps, entry.key);
      } catch (e) {
        return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }
      if (!value) {
        if (entry.key === 'classifier') {
          return { ok: false, error: ERROR_CODES.CLASSIFIER_UNAVAILABLE };
        }
        return { ok: false, error: ERROR_CODES.INVALID_DEPENDENCY };
      }
      for (var m = 0; m < entry.methods.length; m++) {
        if (!validateEffectMethod(value, entry.methods[m])) {
          return { ok: false, error: ERROR_CODES.INVALID_DEPENDENCY };
        }
      }
      collected[entry.key] = value;
    }

    // taxonomy: plain record carrying the required #3835 enums.
    var taxonomy;
    try {
      taxonomy = readOwnDataOptional(deps, 'taxonomy');
    } catch (e) {
      return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
    }
    if (!taxonomy || !isPlainRecord(taxonomy) || !hasOwn(taxonomy, 'OWNER_ACTIONS')) {
      return { ok: false, error: ERROR_CODES.MISSING_TAXONOMY };
    }
    collected.taxonomy = taxonomy;

    // Optional observers.
    var visibilityObserver = null;
    var browseObserver = null;
    try {
      var vo = readOwnDataOptional(deps, 'visibilityObserver');
      var bo = readOwnDataOptional(deps, 'browseObserver');
      if (vo !== undefined && vo !== null) {
        if (!validateEffectMethod(vo, 'observeVisibility')) {
          return { ok: false, error: ERROR_CODES.INVALID_DEPENDENCY };
        }
        visibilityObserver = vo;
      }
      if (bo !== undefined && bo !== null) {
        if (!validateEffectMethod(bo, 'observeBrowseEligibility')) {
          return { ok: false, error: ERROR_CODES.INVALID_DEPENDENCY };
        }
        browseObserver = bo;
      }
    } catch (e) {
      return { ok: false, error: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
    }
    collected.visibilityObserver = visibilityObserver;
    collected.browseObserver = browseObserver;

    return { ok: true, deps: collected };
  }

  // ---------------------------------------------------------------------------
  // Safe taxonomy enum read. Missing enum -> undefined (callers fail closed).
  // ---------------------------------------------------------------------------
  function taxonomyPath(taxonomy, path) {
    var parts = path.split('.');
    var cur = taxonomy;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || typeof cur !== 'object') return undefined;
      if (!hasOwn(cur, parts[i])) return undefined;
      cur = cur[parts[i]];
    }
    return typeof cur === 'string' ? cur : undefined;
  }

  // ---------------------------------------------------------------------------
  // Bounded public result record. Frozen; exact key surface; no private keys.
  // ---------------------------------------------------------------------------
  function buildRecord(fields) {
    return deepFreeze({
      stage: fields.stage,
      outcome_code: fields.outcome_code,
      owner_action: fields.owner_action,
      visibility: fields.visibility,
      browse_eligible: fields.browse_eligible,
      synthetic_exclusion: fields.synthetic_exclusion
    });
  }

  function failureRecord(taxonomy, stage, ownerAction) {
    var action = ownerAction || taxonomyPath(taxonomy, 'OWNER_ACTIONS.OWNER_DECISION_REQUIRED') || 'OWNER_DECISION_REQUIRED';
    return buildRecord({
      stage: stage,
      outcome_code: taxonomyPath(taxonomy, 'OUTCOME_CODES.MONITORING_FAILED') || 'MONITORING_FAILED',
      owner_action: action,
      visibility: SYNTHETIC_VISIBILITY.VISIBILITY,
      browse_eligible: SYNTHETIC_VISIBILITY.BROWSE_ELIGIBLE,
      synthetic_exclusion: SYNTHETIC_EXCLUSION
    });
  }

  // ---------------------------------------------------------------------------
  // The lifecycle runner factory. All effects injected; zero source capability.
  // ---------------------------------------------------------------------------
  function createCanaryLifecycle(deps) {
    var validation = validateDependencies(deps);
    if (!validation.ok) {
      throw new TypeError(validation.error);
    }
    var D = validation.deps;
    var taxonomy = D.taxonomy;

    function stopAction() {
      return taxonomyPath(taxonomy, 'OWNER_ACTIONS.STOP_SYNTHETIC_WRITES') || 'STOP_SYNTHETIC_WRITES';
    }
    function decisionAction() {
      return taxonomyPath(taxonomy, 'OWNER_ACTIONS.OWNER_DECISION_REQUIRED') || 'OWNER_DECISION_REQUIRED';
    }

    // Invoke an injected effect and wrap any throw as a bounded sentinel value.
    function call(effect, method, args) {
      try {
        return { ok: true, value: effect[method].apply(effect, args) };
      } catch (e) {
        return { ok: false };
      }
    }

    // Fence-current + QA ownership gate. Re-run before every mutation and cleanup.
    async function assertMutationAuthority(fence) {
      var current = call(D.fence, 'assertCurrent', [fence]);
      if (!current.ok || current.value !== true) {
        return { ok: false };
      }
      var own = call(D.ownerRead, 'readOwner', []);
      if (!own.ok || !isPlainRecord(own.value) || own.value.owner_match !== true) {
        return { ok: false };
      }
      return { ok: true };
    }

    async function run(runKey, options) {
      if (!isValidRunKey(runKey)) {
        throw new TypeError(ERROR_CODES.INVALID_RUN_KEY);
      }
      var opts = (options && isPlainRecord(options)) ? options : {};

      // 1. Bounded-expiry fence acquire. Unavailable -> FENCED, mutation = 0.
      var fenceAcquire = call(D.fence, 'acquire', [runKey, fenceExpiry(opts)]);
      if (!fenceAcquire.ok || fenceAcquire.value === null || fenceAcquire.value === undefined || fenceAcquire.value === false) {
        return failureRecord(taxonomy, FAILURE_STATES.FENCED, decisionAction());
      }
      var fence = fenceAcquire.value;

      try {
        // 2. QA auth seam: opaque capability only.
        var auth = call(D.qaAuth, 'acquireAuth', []);
        if (!auth.ok || !isPlainRecord(auth.value)) {
          return failureRecord(taxonomy, FAILURE_STATES.BOUNDED_STAGE_FAILURE, stopAction());
        }

        // 3. Deterministic bounded fixture identity.
        var fixture = call(D.fixture, 'prepareFixture', [auth.value]);
        if (!fixture.ok || !isPlainRecord(fixture.value) || hasPrivateKeyIn(fixture.value)) {
          return failureRecord(taxonomy, FAILURE_STATES.BOUNDED_STAGE_FAILURE, stopAction());
        }

        // 4. Mutation authority (fence current + ownership) before write.
        var authority = await assertMutationAuthority(fence);
        if (!authority.ok) {
          return failureRecord(taxonomy, FAILURE_STATES.FENCED, decisionAction());
        }

        // 5. Synthetic memory write dispatch. Dispatch result is a #4080 fact
        //    tuple (already bounded names); passed to the classifier seam.
        var dispatch = call(D.writeDispatch, 'dispatchMemory', [fixture.value]);
        if (!dispatch.ok || !isPlainRecord(dispatch.value)) {
          return failureRecord(taxonomy, FAILURE_STATES.BOUNDED_STAGE_FAILURE, stopAction());
        }

        // 6. Classify via #4080 seam (by value). WRITE_STATUS_UNKNOWN => no
        //    blind retry; canonical reread/reconciliation required first.
        var classification = call(D.classifier, 'classifyWriteOutcome', [dispatch.value.facts || dispatch.value]);
        if (!classification.ok || !isPlainRecord(classification.value) || !hasOwn(classification.value, 'outcome_code')) {
          return failureRecord(taxonomy, FAILURE_STATES.BOUNDED_STAGE_FAILURE, decisionAction());
        }
        if (classification.value.outcome_code === 'WRITE_STATUS_UNKNOWN') {
          return failureRecord(taxonomy, FAILURE_STATES.BOUNDED_STAGE_FAILURE, decisionAction());
        }

        // 7. Canonical reread (ACK != reread confirmation).
        var reread = call(D.canonicalReread, 'reread', [fixture.value]);
        if (!reread.ok) {
          return failureRecord(taxonomy, FAILURE_STATES.BOUNDED_STAGE_FAILURE, decisionAction());
        }

        // 8. Owner read confirmation.
        var ownerConfirm = call(D.ownerRead, 'readOwner', []);
        if (!ownerConfirm.ok) {
          return failureRecord(taxonomy, FAILURE_STATES.BOUNDED_STAGE_FAILURE, decisionAction());
        }

        // 9. Optional visibility observation (ALWAYS PRIVATE; this path only
        //    records it, never promotes).
        if (D.visibilityObserver) {
          var vis = call(D.visibilityObserver, 'observeVisibility', []);
          if (!vis.ok) {
            return failureRecord(taxonomy, FAILURE_STATES.BOUNDED_STAGE_FAILURE, stopAction());
          }
        }

        // 10. Browse eligibility trap: standard canary must stay non-eligible.
        var browseEligible = SYNTHETIC_VISIBILITY.BROWSE_ELIGIBLE;
        if (D.browseObserver) {
          var browse = call(D.browseObserver, 'observeBrowseEligibility', []);
          if (browse.ok && isPlainRecord(browse.value)) {
            if (browse.value.eligible === true || browse.value.browse_eligible === true) {
              return failureRecord(taxonomy, FAILURE_STATES.FENCED, stopAction());
            }
          }
        }

        // 11. Cleanup authority re-verified, then cleanup.
        var authority2 = await assertMutationAuthority(fence);
        if (!authority2.ok) {
          return failureRecord(taxonomy, FAILURE_STATES.FENCED, decisionAction());
        }
        var cleanup = call(D.cleanup, 'cleanup', [fixture.value]);
        if (!cleanup.ok) {
          return buildRecord({
            stage: FAILURE_STATES.CLEANUP_FAILED,
            outcome_code: taxonomyPath(taxonomy, 'OUTCOME_CODES.MONITORING_FAILED') || 'MONITORING_FAILED',
            owner_action: stopAction(),
            visibility: SYNTHETIC_VISIBILITY.VISIBILITY,
            browse_eligible: browseEligible,
            synthetic_exclusion: SYNTHETIC_EXCLUSION
          });
        }

        // 12. Deterministic terminal: cleaned vs retained-deterministic.
        var disposition = (isPlainRecord(cleanup.value) && hasOwn(cleanup.value, 'disposition'))
          ? cleanup.value.disposition
          : 'cleaned';
        var terminal;
        if (disposition === 'cleaned') {
          terminal = TERMINAL_STATES.CLEANUP_CONFIRMED;
        } else if (disposition === 'retained') {
          terminal = TERMINAL_STATES.FIXTURE_RETAINED_DETERMINISTIC;
        } else {
          return failureRecord(taxonomy, FAILURE_STATES.BOUNDED_STAGE_FAILURE, stopAction());
        }

        return buildRecord({
          stage: terminal,
          outcome_code: taxonomyPath(taxonomy, 'OUTCOME_CODES.CONFIRMED') || 'CONFIRMED',
          owner_action: taxonomyPath(taxonomy, 'OWNER_ACTIONS.NO_ACTION') || 'NO_ACTION',
          visibility: SYNTHETIC_VISIBILITY.VISIBILITY,
          browse_eligible: browseEligible,
          synthetic_exclusion: SYNTHETIC_EXCLUSION
        });
      } finally {
        try {
          D.fence.release(fence);
        } catch (e) {
          // best-effort, sanitized
        }
      }
    }

    return deepFreeze({
      run: run,
      resume: run
    });
  }

  function fenceExpiry(opts) {
    if (opts && isPlainRecord(opts) && typeof opts.bounded_expiry_ms === 'number' &&
        opts.bounded_expiry_ms > 0 && opts.bounded_expiry_ms <= 600000) {
      return opts.bounded_expiry_ms;
    }
    return 60000;
  }

  var CAPABILITIES = Object.freeze([]);

  var API = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    LIFECYCLE_STAGE_ORDER: LIFECYCLE_STAGE_ORDER,
    LIFECYCLE_STAGES: LIFECYCLE_STAGES,
    TERMINAL_STATES: TERMINAL_STATES,
    FAILURE_STATES: FAILURE_STATES,
    SYNTHETIC_VISIBILITY: SYNTHETIC_VISIBILITY,
    SYNTHETIC_EXCLUSION: SYNTHETIC_EXCLUSION,
    ERROR_CODES: ERROR_CODES,
    PRIVATE_KEYS: PRIVATE_KEYS,
    PRIVATE_KEY_SET: PRIVATE_KEY_SET,
    CAPABILITIES: CAPABILITIES,
    createCanaryLifecycle: createCanaryLifecycle,
    isPlainRecord: isPlainRecord,
    hasPrivateKeyIn: hasPrivateKeyIn,
    isValidRunKey: isValidRunKey,
    isValidReleaseSha: isValidReleaseSha
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
  if (typeof window !== 'undefined') {
    window.LoveBudReliabilityCanaryLifecycleCore = API;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.LoveBudReliabilityCanaryLifecycleCore = API;
  }
})(this);
