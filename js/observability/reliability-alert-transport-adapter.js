'use strict';

// Issue #3874 — Provider-unselected alert transport adapter boundary
// (Reliability & Observability child of parent #3461).
//
// This module is a PURE DEPENDENCY-INJECTED AUTHORITY that sits between the
// merged provider-neutral alert delivery core (#3861/#3868) and a future
// provider-specific transport. It:
//   - is provider-unselected: provider_class = PROVIDER_UNSELECTED,
//     runtime_binding = NOT_BOUND, Preview/Production transport DISABLED;
//   - accepts ONLY a canonical alert envelope already produced by
//     reliability-alert-delivery-core.js plus ONE exact bounded
//     transport-control object;
//   - never recomputes envelope severity/owner/dedupe semantics;
//   - carries NO capability (no network, fetch, provider SDK, filesystem,
//     environment variable, storage, database, SQL, queue, DOM, deployment,
//     or Production configuration);
//   - invokes the injected fake transport effect at most once, only through an
//     explicit synthetic test seam, and never on the default
//     provider-unselected production posture (effect count 0);
//   - is deterministic, descriptor-safe, fail-closed, frozen/detached,
//     provider-unselected, and non-throwing across the producer boundary;
//   - rejects any endpoint, URL, token, account, project, email, channel,
//     provider response body, or arbitrary provider metadata.
//
// Future provider-specific implementation remains separate and requires:
//   explicit provider selection, approved runtime placement, approved secret
//   store/injection, Preview/Production separation, bounded durable
//   dedupe/queue decision, fresh provider-specific test authority, and
//   separate Production activation approval. None are claimed here.
//
// Refs #3874.
// Refs #3873 — accepted provider-binding audit.
// Refs #3861 — completed Child 4A provider-neutral delivery core.
// Refs #3461 — Keep OPEN.
// Refs #1882 — Keep OPEN.

(function (root) {
  'use strict';

  var CONTRACT_VERSION = '1';

  // ---------------------------------------------------------------------------
  // Deep-freeze helpers (same immutable boundary as the other observability
  // modules).
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

  // Plain own-property record boundary. Never use Object.prototype.toString /
  // instanceof / in: those can invoke a Symbol.toStringTag getter or a Proxy
  // get trap. The bounded getPrototypeOf probe (terminal prototype root) is
  // realm-agnostic: VM sandbox objects and API responses are still recognized
  // as plain records, while class instances / Date / Map / Set / arrays /
  // functions and caller-controlled prototypes are rejected.
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

  // Private internal-error identity. Only TypeErrors created by this module are
  // ever re-thrown; a hostile thrown object's properties are NEVER read (no
  // .message / .stack / .cause / String / JSON access on external errors).
  var INTERNAL_ERROR_IDENTITY = new WeakMap();

  function internalError(code) {
    var err = new TypeError(code);
    INTERNAL_ERROR_IDENTITY.set(err, true);
    return err;
  }

  function isInternalError(value) {
    return typeof value === 'object' && value !== null && INTERNAL_ERROR_IDENTITY.has(value);
  }

  function proxyOrAccessorInput() {
    return internalError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
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

  // Descriptor-safe prototype-chain probe: true when `key` is an own property
  // of `object` or any ancestor. Never reads a value; a hostile trap only
  // fails closed to true. Used to reject an inherited `invokeTransport` on the
  // exact-empty-object deps path so it cannot silently pass as an empty deps
  // object.
  function hasOwnOnPrototypeChain(object, key) {
    var cursor = object;
    while (cursor !== null) {
      var descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(cursor, key);
      } catch (e) {
        return true;
      }
      if (descriptor !== undefined) return true;
      try {
        cursor = Object.getPrototypeOf(cursor);
      } catch (e) {
        return true;
      }
    }
    return false;
  }

  // Fixed internal key used only to probe a hostile getOwnPropertyDescriptor
  // trap on a non-standard deps prototype (see assertExactEmptyPrototypeChain).
  var PROTOTYPE_PROBE_KEY = '__lovebud_prototype_ownkey_probe__';

  // Descriptor-safe exact-empty prototype-chain proof for injected deps. The
  // only accepted deps postures are `{}`, `Object.create(null)`, and a null-root
  // exact object with one own enumerable data property `invokeTransport` — all
  // backed by either the standard Object.prototype or a null terminal root.
  // ANY caller-controlled own key on any non-standard prototype (inherited
  // private/unknown keys, an inherited invokeTransport) is rejected with a
  // fixed sanitized code. A hostile getPrototypeOf / ownKeys /
  // getOwnPropertyDescriptor trap anywhere in the chain fails closed WITHOUT
  // ever reading the thrown object. No inherited value is ever read.
  function assertExactEmptyPrototypeChain(object) {
    var cursor;
    try {
      cursor = Object.getPrototypeOf(object);
    } catch (e) {
      throw proxyOrAccessorInput();
    }
    while (cursor !== null) {
      if (cursor === Object.prototype) {
        // Standard terminal prototype: its fixed standard keys are not
        // caller-controlled private/unknown payload.
        return;
      }
      var keys;
      try {
        keys = Reflect.ownKeys(cursor);
      } catch (e) {
        throw proxyOrAccessorInput();
      }
      if (keys.length > 0) {
        throw internalError(ERROR_CODES.UNKNOWN_FIELD);
      }
      // Probe one fixed internal key so a hostile getOwnPropertyDescriptor trap
      // cannot slip through an empty ownKeys result. The descriptor result is
      // discarded; only a thrown trap fails closed.
      try {
        Object.getOwnPropertyDescriptor(cursor, PROTOTYPE_PROBE_KEY);
      } catch (e) {
        throw proxyOrAccessorInput();
      }
      try {
        cursor = Object.getPrototypeOf(cursor);
      } catch (e) {
        throw proxyOrAccessorInput();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Fixed sanitized error codes. These are bounded, frozen and carry NO
  // caller-controlled key/value, no raw exception, and no stack.
  // ---------------------------------------------------------------------------
  var ERROR_CODES = Object.freeze({
    INPUT_NOT_OBJECT: 'INPUT_NOT_OBJECT',
    UNKNOWN_FIELD: 'UNKNOWN_FIELD',
    PRIVATE_FIELD_REJECTED: 'PRIVATE_FIELD_REJECTED',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    UNKNOWN_ENUM: 'UNKNOWN_ENUM',
    INVALID_RELEASE_SHA: 'INVALID_RELEASE_SHA',
    MALFORMED_ENVELOPE: 'MALFORMED_ENVELOPE',
    PROXY_OR_ACCESSOR_INPUT: 'PROXY_OR_ACCESSOR_INPUT',
    UNKNOWN_INPUT: 'UNKNOWN_INPUT',
    SYNTHETIC_EFFECT_NOT_CALLABLE: 'SYNTHETIC_EFFECT_NOT_CALLABLE',
    SYNTHETIC_EFFECT_NOT_AUTHORIZED: 'SYNTHETIC_EFFECT_NOT_AUTHORIZED'
  });

  var ERROR_CODE_SET = (function () {
    var s = {};
    for (var k in ERROR_CODES) {
      if (Object.prototype.hasOwnProperty.call(ERROR_CODES, k)) s[ERROR_CODES[k]] = true;
    }
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // Fixed provider posture — this child is provider-unselected and unbound.
  // ---------------------------------------------------------------------------
  var PROVIDER_CLASSES = Object.freeze({
    PROVIDER_UNSELECTED: 'PROVIDER_UNSELECTED'
  });

  var PROVIDER_CLASS_SET = (function () {
    var s = {};
    for (var k in PROVIDER_CLASSES) {
      if (Object.prototype.hasOwnProperty.call(PROVIDER_CLASSES, k)) s[PROVIDER_CLASSES[k]] = true;
    }
    return deepFreeze(s);
  })();

  var RUNTIME_BINDINGS = Object.freeze({
    NOT_BOUND: 'NOT_BOUND'
  });

  var RUNTIME_BINDING_SET = (function () {
    var s = {};
    for (var k in RUNTIME_BINDINGS) {
      if (Object.prototype.hasOwnProperty.call(RUNTIME_BINDINGS, k)) s[RUNTIME_BINDINGS[k]] = true;
    }
    return deepFreeze(s);
  })();

  var SECRET_STATUSES = Object.freeze({
    NOT_REQUIRED_FOR_SOURCE_ADAPTER: 'NOT_REQUIRED_FOR_SOURCE_ADAPTER',
    SECRET_ABSENT: 'SECRET_ABSENT',
    SECRET_INVALID: 'SECRET_INVALID',
    SECRET_PRESENT_UNVERIFIED: 'SECRET_PRESENT_UNVERIFIED'
  });

  var SECRET_STATUS_SET = (function () {
    var s = {};
    for (var k in SECRET_STATUSES) {
      if (Object.prototype.hasOwnProperty.call(SECRET_STATUSES, k)) s[SECRET_STATUSES[k]] = true;
    }
    return deepFreeze(s);
  })();

  var RETRY_ATTEMPT_CLASSES = Object.freeze({
    FIRST_ATTEMPT: 'FIRST_ATTEMPT',
    BOUNDED_RETRY_ELIGIBLE: 'BOUNDED_RETRY_ELIGIBLE',
    RETRY_EXHAUSTED: 'RETRY_EXHAUSTED'
  });

  var RETRY_ATTEMPT_CLASS_SET = (function () {
    var s = {};
    for (var k in RETRY_ATTEMPT_CLASSES) {
      if (Object.prototype.hasOwnProperty.call(RETRY_ATTEMPT_CLASSES, k)) s[RETRY_ATTEMPT_CLASSES[k]] = true;
    }
    return deepFreeze(s);
  })();

  var DEDUPE_STATE_CLASSES = Object.freeze({
    DEDUPE_NOT_AVAILABLE: 'DEDUPE_NOT_AVAILABLE',
    DEDUPE_AVAILABLE_SYNTHETIC: 'DEDUPE_AVAILABLE_SYNTHETIC',
    DEDUPE_INVALID: 'DEDUPE_INVALID'
  });

  var DEDUPE_STATE_CLASS_SET = (function () {
    var s = {};
    for (var k in DEDUPE_STATE_CLASSES) {
      if (Object.prototype.hasOwnProperty.call(DEDUPE_STATE_CLASSES, k)) s[DEDUPE_STATE_CLASSES[k]] = true;
    }
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // Injected synthetic effect response vocabulary.
  // ---------------------------------------------------------------------------
  var SYNTHETIC_RESPONSES = Object.freeze({
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    TIMEOUT: 'TIMEOUT',
    UNAVAILABLE: 'UNAVAILABLE'
  });

  var SYNTHETIC_RESPONSE_SET = (function () {
    var s = {};
    for (var k in SYNTHETIC_RESPONSES) {
      if (Object.prototype.hasOwnProperty.call(SYNTHETIC_RESPONSES, k)) s[SYNTHETIC_RESPONSES[k]] = true;
    }
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // Fixed bounded result vocabulary.
  // ---------------------------------------------------------------------------
  var TRANSPORT_RESULTS = Object.freeze({
    TRANSPORT_NOT_ATTEMPTED_PROVIDER_UNSELECTED: 'TRANSPORT_NOT_ATTEMPTED_PROVIDER_UNSELECTED',
    TRANSPORT_NOT_ATTEMPTED_DISABLED: 'TRANSPORT_NOT_ATTEMPTED_DISABLED',
    TRANSPORT_NOT_ATTEMPTED_OPERATOR_DISABLED: 'TRANSPORT_NOT_ATTEMPTED_OPERATOR_DISABLED',
    TRANSPORT_NOT_ATTEMPTED_SECRET_STATE: 'TRANSPORT_NOT_ATTEMPTED_SECRET_STATE',
    TRANSPORT_NOT_ATTEMPTED_DEDUPE_STATE: 'TRANSPORT_NOT_ATTEMPTED_DEDUPE_STATE',
    TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT: 'TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT',
    TRANSPORT_EFFECT_ACCEPTED_SYNTHETIC: 'TRANSPORT_EFFECT_ACCEPTED_SYNTHETIC',
    TRANSPORT_EFFECT_REJECTED_SYNTHETIC: 'TRANSPORT_EFFECT_REJECTED_SYNTHETIC',
    TRANSPORT_EFFECT_TIMEOUT_SYNTHETIC: 'TRANSPORT_EFFECT_TIMEOUT_SYNTHETIC',
    TRANSPORT_EFFECT_UNAVAILABLE_SYNTHETIC: 'TRANSPORT_EFFECT_UNAVAILABLE_SYNTHETIC',
    TRANSPORT_EFFECT_FAILED_SANITIZED: 'TRANSPORT_EFFECT_FAILED_SANITIZED'
  });

  // ---------------------------------------------------------------------------
  // Exact transport-control schema. Every field is a fixed own key.
  // ---------------------------------------------------------------------------
  var TRANSPORT_CONTROL_FIELDS = makeFrozenArray([
    'provider_class',
    'runtime_binding',
    'secret_status',
    'transport_enabled',
    'operator_disabled',
    'retry_attempt_class',
    'dedupe_state_class',
    'release_sha',
    'synthetic_effect_authorized'
  ]);

  var TRANSPORT_CONTROL_FIELD_SET = (function () {
    var s = {};
    for (var i = 0; i < TRANSPORT_CONTROL_FIELDS.length; i++) s[TRANSPORT_CONTROL_FIELDS[i]] = true;
    return deepFreeze(s);
  })();

  // Required control fields (must be present own data properties).
  var REQUIRED_CONTROL_FIELDS = makeFrozenArray([
    'provider_class',
    'runtime_binding',
    'secret_status',
    'transport_enabled',
    'operator_disabled',
    'retry_attempt_class',
    'dedupe_state_class',
    'release_sha',
    'synthetic_effect_authorized'
  ]);

  // ---------------------------------------------------------------------------
  // Canonical envelope schema — the exact own-key envelope produced by
  // reliability-alert-delivery-core.js. The adapter NEVER recomputes its
  // severity/owner/dedupe semantics; it consumes it as opaque canonical
  // authority and only validates that its values are within the bounded
  // vocabulary so a forged or malformed envelope fails closed.
  // ---------------------------------------------------------------------------
  var CANONICAL_ENVELOPE_FIELDS = makeFrozenArray([
    'contract_version',
    'source_class',
    'operation_class',
    'outcome_code',
    'severity',
    'advisory_action',
    'owner_class',
    'evidence_completeness',
    'release_sha',
    'latency_bucket',
    'baseline_deviation_class',
    'dedupe_fingerprint'
  ]);

  var CANONICAL_ENVELOPE_FIELD_SET = (function () {
    var s = {};
    for (var i = 0; i < CANONICAL_ENVELOPE_FIELDS.length; i++) s[CANONICAL_ENVELOPE_FIELDS[i]] = true;
    return deepFreeze(s);
  })();

  // Bounded envelope vocabularies (mirrors the merged #3835 taxonomy values as
  // consumed by the delivery core). Validation only; never re-derivation.
  var ENVELOPE_SOURCE_CLASSES = deepFreeze(['STRUCTURAL_SENTINEL', 'WRITE_READ_CONVERGENCE']);
  var ENVELOPE_OPERATION_CLASSES = deepFreeze([
    'STRUCTURAL_SCHEMA_CHECK', 'TREE_PARENT_INTEGRITY_CHECK',
    'MEMORY_PARENT_INTEGRITY_CHECK', 'SOCIAL_TARGET_INTEGRITY_CHECK',
    'BROWSE_ELIGIBILITY_BASELINE_CHECK', 'TREE_CREATE_CONVERGENCE',
    'MEMORY_CREATE_CONVERGENCE', 'PUBLIC_THRESHOLD_CONVERGENCE'
  ]);
  var ENVELOPE_OUTCOME_CODES = deepFreeze([
    'CONFIRMED', 'TRANSPORT_FAILED', 'ACKNOWLEDGEMENT_MISSING',
    'ACKNOWLEDGED_REREAD_MISSING', 'REREAD_CONFIRMED_UI_MISSING',
    'PUBLIC_THRESHOLD_NOT_CONFIRMED', 'SCHEMA_AUTHORITY_UNAVAILABLE',
    'STRUCTURAL_DRIFT_DETECTED', 'ORPHAN_SIGNAL_DETECTED',
    'BASELINE_DISCONTINUITY_DETECTED', 'MONITORING_FAILED',
    'INSUFFICIENT_EVIDENCE'
  ]);
  var ENVELOPE_SEVERITIES = deepFreeze(['INFO', 'WARNING', 'BLOCKING']);
  var ENVELOPE_OWNER_ACTIONS = deepFreeze([
    'NO_ACTION', 'OBSERVE', 'INVESTIGATE', 'STOP_SYNTHETIC_WRITES',
    'OWNER_DECISION_REQUIRED'
  ]);
  var ENVELOPE_OWNER_CLASSES = deepFreeze([
    'RELIABILITY_OWNER', 'DATABASE_OWNER', 'PRODUCT_OWNER'
  ]);
  var ENVELOPE_EVIDENCE = deepFreeze(['complete', 'partial', 'missing', 'invalid']);
  var ENVELOPE_LATENCY_BUCKETS = deepFreeze([
    'LT_250_MS', 'LT_500_MS', 'LT_1_S', 'LT_2_S', 'LT_5_S', 'GTE_5_S',
    'TIMEOUT_OR_UNKNOWN', 'NOT_APPLICABLE'
  ]);
  var ENVELOPE_DEVIATIONS = deepFreeze([
    'NONE', 'EXPECTED_VARIATION', 'MATERIAL_DEVIATION',
    'CRITICAL_DISCONTINUITY', 'UNKNOWN', 'NOT_APPLICABLE'
  ]);

  function listContains(list, value) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] === value) return true;
    }
    return false;
  }

  // Privacy-sensitive own keys — rejected on both envelope and control input.
  var PRIVATE_KEYS = makeFrozenArray([
    'token', 'secret', 'cookie', 'authorization', 'authorization_header', 'email',
    'channel', 'endpoint', 'webhook_url', 'url', 'query', 'provider_id',
    'account_id', 'project_id', 'deployment_id', 'request_id', 'response_body',
    'request_body', 'raw_error', 'exception', 'message', 'stack', 'cause',
    'status_text', 'user_id', 'owner_id', 'tree_id', 'memory_id', 'comment_id',
    'reaction_id', 'title', 'description', 'content', 'timestamp', 'queue_payload',
    'metadata'
  ]);

  var PRIVATE_KEY_SET = (function () {
    var s = {};
    for (var i = 0; i < PRIVATE_KEYS.length; i++) s[PRIVATE_KEYS[i]] = true;
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // release_sha: lowercase 40-char hex only.
  // ---------------------------------------------------------------------------
  var RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;

  function isValidReleaseSha(value) {
    if (typeof value !== 'string') return false;
    return RELEASE_SHA_PATTERN.test(value);
  }

  // dedupe fingerprint: lowercase sha256 hex (64 chars).
  var SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

  function isValidSha256Hex(value) {
    if (typeof value !== 'string') return false;
    return SHA256_HEX_PATTERN.test(value);
  }

  function enumValid(value, set) {
    if (typeof value !== 'string') return false;
    if (value.length === 0) return false;
    return hasOwn(set, value) && set[value] === true;
  }

  // Exact own-key canonical-envelope validation. Accepts only the exact 12-key
  // shape (no more, no less), bounded enum values within the merged #3835
  // vocabulary, a valid release SHA, and a valid dedupe fingerprint. The
  // adapter consumes the envelope as opaque authority and never recomputes
  // severity/owner/dedupe.
  // Descriptor-safe canonical-envelope snapshot. Reads every envelope value
  // ONLY through Object.getOwnPropertyDescriptor (own, enumerable, data
  // property). No direct property access and no repeated read of the caller
  // object, so a Proxy `get` trap or an accessor getter is never invoked and a
  // hostile thrown trap object is never read. Returns a detached plain local
  // record, or null (fail closed).
  function snapshotCanonicalEnvelope(value) {
    var plain;
    try {
      plain = isPlainRecord(value);
    } catch (e) {
      return null;
    }
    if (!plain) return null;
    var keys;
    try {
      keys = Object.keys(value);
    } catch (e) {
      return null;
    }
    if (keys.length !== CANONICAL_ENVELOPE_FIELDS.length) return null;
    for (var i = 0; i < keys.length; i++) {
      if (hasOwn(PRIVATE_KEY_SET, keys[i])) return null;
      if (!hasOwn(CANONICAL_ENVELOPE_FIELD_SET, keys[i])) return null;
    }
    var out = {};
    try {
      for (var r = 0; r < CANONICAL_ENVELOPE_FIELDS.length; r++) {
        var field = CANONICAL_ENVELOPE_FIELDS[r];
        var descriptor = Object.getOwnPropertyDescriptor(value, field);
        if (!descriptor) return null;
        if (descriptor.enumerable !== true) return null;
        if ('get' in descriptor || 'set' in descriptor) return null;
        if (!('value' in descriptor)) return null;
        out[field] = descriptor.value;
      }
    } catch (e) {
      return null;
    }
    return out;
  }

  // Bounded value validation over the detached snapshot (never over the caller
  // object). Consumes the envelope as opaque canonical authority; never
  // recomputes severity/owner/dedupe semantics.
  function validateCanonicalSnapshot(snapshot) {
    if (snapshot.contract_version !== CONTRACT_VERSION) return false;
    if (!listContains(ENVELOPE_SOURCE_CLASSES, snapshot.source_class)) return false;
    if (!listContains(ENVELOPE_OPERATION_CLASSES, snapshot.operation_class)) return false;
    if (!listContains(ENVELOPE_OUTCOME_CODES, snapshot.outcome_code)) return false;
    if (!listContains(ENVELOPE_SEVERITIES, snapshot.severity)) return false;
    if (!listContains(ENVELOPE_OWNER_ACTIONS, snapshot.advisory_action)) return false;
    if (!listContains(ENVELOPE_OWNER_CLASSES, snapshot.owner_class)) return false;
    if (!listContains(ENVELOPE_EVIDENCE, snapshot.evidence_completeness)) return false;
    if (!listContains(ENVELOPE_LATENCY_BUCKETS, snapshot.latency_bucket)) return false;
    if (!listContains(ENVELOPE_DEVIATIONS, snapshot.baseline_deviation_class)) return false;
    if (!isValidReleaseSha(snapshot.release_sha)) return false;
    if (!isValidSha256Hex(snapshot.dedupe_fingerprint)) return false;
    return true;
  }

  function isCanonicalEnvelope(value) {
    var snapshot = snapshotCanonicalEnvelope(value);
    if (!snapshot) return false;
    return validateCanonicalSnapshot(snapshot);
  }

  // ---------------------------------------------------------------------------
  // Transport adapter factory. The caller may inject at most one fake
  // transport effect; the production/default provider-unselected path never
  // invokes it.
  // ---------------------------------------------------------------------------
  function createAlertTransportAdapter(deps) {
    var injectedEffect = null;
    var effectProvided = false;
    try {
      if (deps === undefined || deps === null) {
        effectProvided = false;
      } else {
        if (!isPlainRecord(deps)) {
          throw internalError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
        }
        // Descriptor-safe exact-empty prototype-chain proof: no caller-
        // controlled own key may exist on any non-standard prototype (inherited
        // private/unknown keys, an inherited invokeTransport). A hostile
        // getPrototypeOf / ownKeys / getOwnPropertyDescriptor trap fails
        // closed without ever reading the thrown object.
        assertExactEmptyPrototypeChain(deps);
        // Exact own-key schema: either an exact empty plain object (with no
        // inherited invokeTransport) or exactly one own enumerable data
        // property named 'invokeTransport' (callable). Unknown, extra,
        // private, inherited, non-enumerable, accessor, or Proxy-hostile deps
        // all fail closed with a fixed sanitized internal code.
        var depsKeys;
        try {
          depsKeys = Object.keys(deps);
        } catch (e) {
          throw internalError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
        }
        if (depsKeys.length === 0) {
          if (hasOwnOnPrototypeChain(deps, 'invokeTransport')) {
            throw internalError(ERROR_CODES.UNKNOWN_FIELD);
          }
          effectProvided = false;
        } else if (depsKeys.length === 1 && depsKeys[0] === 'invokeTransport') {
          var effectValue = readOwnEnumerableDataProperty(deps, 'invokeTransport');
          if (!isCallable(effectValue)) {
            throw internalError(ERROR_CODES.SYNTHETIC_EFFECT_NOT_CALLABLE);
          }
          injectedEffect = effectValue;
          effectProvided = true;
        } else {
          throw internalError(ERROR_CODES.UNKNOWN_FIELD);
        }
      }
    } catch (e) {
      if (isInternalError(e)) {
        throw e;
      }
      throw internalError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }

    function validateControl(control) {
      if (!isPlainRecord(control)) {
        return { ok: false, reason: ERROR_CODES.INPUT_NOT_OBJECT };
      }
      var keys = Object.keys(control);
      for (var i = 0; i < keys.length; i++) {
        if (hasOwn(PRIVATE_KEY_SET, keys[i])) {
          return { ok: false, reason: ERROR_CODES.PRIVATE_FIELD_REJECTED };
        }
        if (!hasOwn(TRANSPORT_CONTROL_FIELD_SET, keys[i])) {
          return { ok: false, reason: ERROR_CODES.UNKNOWN_FIELD };
        }
      }
      for (var r = 0; r < REQUIRED_CONTROL_FIELDS.length; r++) {
        if (!hasOwn(control, REQUIRED_CONTROL_FIELDS[r])) {
          return { ok: false, reason: ERROR_CODES.MISSING_REQUIRED_FIELD };
        }
      }
      var values = {};
      try {
        for (var f = 0; f < TRANSPORT_CONTROL_FIELDS.length; f++) {
          values[TRANSPORT_CONTROL_FIELDS[f]] = readOwnEnumerableDataProperty(control, TRANSPORT_CONTROL_FIELDS[f]);
        }
      } catch (e) {
        return { ok: false, reason: ERROR_CODES.PROXY_OR_ACCESSOR_INPUT };
      }

      if (!enumValid(values.provider_class, PROVIDER_CLASS_SET)) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_ENUM };
      }
      if (!enumValid(values.runtime_binding, RUNTIME_BINDING_SET)) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_ENUM };
      }
      if (!enumValid(values.secret_status, SECRET_STATUS_SET)) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_ENUM };
      }
      if (!enumValid(values.retry_attempt_class, RETRY_ATTEMPT_CLASS_SET)) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_ENUM };
      }
      if (!enumValid(values.dedupe_state_class, DEDUPE_STATE_CLASS_SET)) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_ENUM };
      }
      if (values.transport_enabled !== false) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_ENUM };
      }
      if (typeof values.operator_disabled !== 'boolean') {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_ENUM };
      }
      if (typeof values.synthetic_effect_authorized !== 'boolean') {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_ENUM };
      }
      if (!isValidReleaseSha(values.release_sha)) {
        return { ok: false, reason: ERROR_CODES.INVALID_RELEASE_SHA };
      }
      return { ok: true, values: values };
    }

    function buildNotAttemptedResult(reason, control, envelope) {
      var result = {
        outcome: reason,
        provider_class: control.provider_class,
        runtime_binding: control.runtime_binding,
        secret_status: control.secret_status,
        retry_attempt_class: control.retry_attempt_class,
        dedupe_state_class: control.dedupe_state_class,
        release_sha: control.release_sha,
        provider_selected: false,
        runtime_bound: false,
        secret_read: false,
        network_performed: false,
        persistence_performed: false,
        queue_performed: false,
        preview_effect_performed: false,
        production_effect_performed: false
      };
      if (envelope) {
        result.envelope_consumed = true;
      } else {
        result.envelope_consumed = false;
      }
      return deepFreeze(result);
    }

    // -------------------------------------------------------------------------
    // Provider-neutral dispatch boundary. Never throws. Effect count is 0 on
    // the default provider-unselected production posture and at most 1 through
    // the explicit synthetic seam.
    // -------------------------------------------------------------------------
    async function dispatchTransport(canonicalEnvelope, boundedControl) {
      var effectCount = 0;
      var envelopeFrozen = null;
      var control = null;
      try {
        // --- envelope boundary -------------------------------------------------
        // Descriptor-safe single snapshot: every envelope value is read exactly
        // once through getOwnPropertyDescriptor into a detached local record.
        // No direct property access afterwards, so a Proxy `get` trap or an
        // accessor getter is never invoked and a thrown trap object is never
        // read. Any malformed / private / non-bounded envelope fails closed.
        var envSnapshot = snapshotCanonicalEnvelope(canonicalEnvelope);
        if (!envSnapshot || !validateCanonicalSnapshot(envSnapshot)) {
          return buildNotAttemptedResult(
            TRANSPORT_RESULTS.TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT,
            { provider_class: 'PROVIDER_UNSELECTED', runtime_binding: 'NOT_BOUND', secret_status: 'NOT_REQUIRED_FOR_SOURCE_ADAPTER', retry_attempt_class: 'FIRST_ATTEMPT', dedupe_state_class: 'DEDUPE_NOT_AVAILABLE', release_sha: '' },
            null
          );
        }
        envelopeFrozen = deepFreeze(envSnapshot);

        // --- transport-control boundary ---------------------------------------
        var validation = validateControl(boundedControl);
        if (!validation.ok) {
          return buildNotAttemptedResult(
            TRANSPORT_RESULTS.TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT,
            { provider_class: 'PROVIDER_UNSELECTED', runtime_binding: 'NOT_BOUND', secret_status: 'NOT_REQUIRED_FOR_SOURCE_ADAPTER', retry_attempt_class: 'FIRST_ATTEMPT', dedupe_state_class: 'DEDUPE_NOT_AVAILABLE', release_sha: '' },
            envelopeFrozen
          );
        }
        // The effect receives a deeply frozen detached snapshot — never the
        // caller's control object. Mutation attempts inside the injected
        // effect (result fields, private values, release_sha) therefore cannot
        // alter the canonical values read by the result.
        control = deepFreeze(validation.values);

        // Release SHA consistency between envelope and control.
        if (control.release_sha !== envelopeFrozen.release_sha) {
          return buildNotAttemptedResult(
            TRANSPORT_RESULTS.TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT,
            control,
            envelopeFrozen
          );
        }

        // --- fail-closed guards (effect count 0) ------------------------------
        if (control.operator_disabled === true) {
          return buildNotAttemptedResult(
            TRANSPORT_RESULTS.TRANSPORT_NOT_ATTEMPTED_OPERATOR_DISABLED,
            control,
            envelopeFrozen
          );
        }
        if (control.transport_enabled !== false) {
          return buildNotAttemptedResult(
            TRANSPORT_RESULTS.TRANSPORT_NOT_ATTEMPTED_DISABLED,
            control,
            envelopeFrozen
          );
        }
        if (control.provider_class !== 'PROVIDER_UNSELECTED') {
          return buildNotAttemptedResult(
            TRANSPORT_RESULTS.TRANSPORT_NOT_ATTEMPTED_PROVIDER_UNSELECTED,
            control,
            envelopeFrozen
          );
        }
        if (control.secret_status === 'SECRET_ABSENT' || control.secret_status === 'SECRET_INVALID') {
          return buildNotAttemptedResult(
            TRANSPORT_RESULTS.TRANSPORT_NOT_ATTEMPTED_SECRET_STATE,
            control,
            envelopeFrozen
          );
        }
        if (control.dedupe_state_class === 'DEDUPE_INVALID') {
          return buildNotAttemptedResult(
            TRANSPORT_RESULTS.TRANSPORT_NOT_ATTEMPTED_DEDUPE_STATE,
            control,
            envelopeFrozen
          );
        }

        // Provider-unselected default posture: never invoke any effect.
        if (control.synthetic_effect_authorized !== true || !effectProvided) {
          return buildNotAttemptedResult(
            TRANSPORT_RESULTS.TRANSPORT_NOT_ATTEMPTED_PROVIDER_UNSELECTED,
            control,
            envelopeFrozen
          );
        }

        // --- explicit synthetic test seam (at most once) ----------------------
        var response;
        try {
          effectCount += 1;
          response = await injectedEffect(envelopeFrozen, control);
        } catch (e) {
          return deepFreeze({
            outcome: TRANSPORT_RESULTS.TRANSPORT_EFFECT_FAILED_SANITIZED,
            provider_class: control.provider_class,
            runtime_binding: control.runtime_binding,
            secret_status: control.secret_status,
            retry_attempt_class: control.retry_attempt_class,
            dedupe_state_class: control.dedupe_state_class,
            release_sha: control.release_sha,
            envelope_consumed: true,
            provider_selected: false,
            runtime_bound: false,
            secret_read: false,
            network_performed: false,
            persistence_performed: false,
            queue_performed: false,
            preview_effect_performed: false,
            production_effect_performed: false
          });
        }

        var outcome;
        if (response === SYNTHETIC_RESPONSES.ACCEPTED) {
          outcome = TRANSPORT_RESULTS.TRANSPORT_EFFECT_ACCEPTED_SYNTHETIC;
        } else if (response === SYNTHETIC_RESPONSES.REJECTED) {
          outcome = TRANSPORT_RESULTS.TRANSPORT_EFFECT_REJECTED_SYNTHETIC;
        } else if (response === SYNTHETIC_RESPONSES.TIMEOUT) {
          outcome = TRANSPORT_RESULTS.TRANSPORT_EFFECT_TIMEOUT_SYNTHETIC;
        } else if (response === SYNTHETIC_RESPONSES.UNAVAILABLE) {
          outcome = TRANSPORT_RESULTS.TRANSPORT_EFFECT_UNAVAILABLE_SYNTHETIC;
        } else {
          outcome = TRANSPORT_RESULTS.TRANSPORT_EFFECT_FAILED_SANITIZED;
        }

        return deepFreeze({
          outcome: outcome,
          provider_class: control.provider_class,
          runtime_binding: control.runtime_binding,
          secret_status: control.secret_status,
          retry_attempt_class: control.retry_attempt_class,
          dedupe_state_class: control.dedupe_state_class,
          release_sha: control.release_sha,
          envelope_consumed: true,
          provider_selected: false,
          runtime_bound: false,
          secret_read: false,
          network_performed: false,
          persistence_performed: false,
          queue_performed: false,
          preview_effect_performed: false,
          production_effect_performed: false
        });
      } catch (e) {
        // Producer boundary never throws. Any residual failure is a sanitized
        // invalid-input result with zero leakage.
        return buildNotAttemptedResult(
          TRANSPORT_RESULTS.TRANSPORT_NOT_ATTEMPTED_INVALID_INPUT,
          control || { provider_class: 'PROVIDER_UNSELECTED', runtime_binding: 'NOT_BOUND', secret_status: 'NOT_REQUIRED_FOR_SOURCE_ADAPTER', retry_attempt_class: 'FIRST_ATTEMPT', dedupe_state_class: 'DEDUPE_NOT_AVAILABLE', release_sha: '' },
          envelopeFrozen
        );
      }
    }

    return deepFreeze({
      CONTRACT_VERSION: CONTRACT_VERSION,
      PROVIDER_CLASSES: PROVIDER_CLASSES,
      RUNTIME_BINDINGS: RUNTIME_BINDINGS,
      SECRET_STATUSES: SECRET_STATUSES,
      RETRY_ATTEMPT_CLASSES: RETRY_ATTEMPT_CLASSES,
      DEDUPE_STATE_CLASSES: DEDUPE_STATE_CLASSES,
      SYNTHETIC_RESPONSES: SYNTHETIC_RESPONSES,
      TRANSPORT_RESULTS: TRANSPORT_RESULTS,
      TRANSPORT_CONTROL_FIELDS: TRANSPORT_CONTROL_FIELDS,
      REQUIRED_CONTROL_FIELDS: REQUIRED_CONTROL_FIELDS,
      CANONICAL_ENVELOPE_FIELDS: CANONICAL_ENVELOPE_FIELDS,
      PRIVATE_KEYS: PRIVATE_KEYS,
      ERROR_CODES: ERROR_CODES,
      ERROR_CODE_SET: ERROR_CODE_SET,
      isValidReleaseSha: isValidReleaseSha,
      isValidSha256Hex: isValidSha256Hex,
      isCanonicalEnvelope: isCanonicalEnvelope,
      dispatchTransport: dispatchTransport
    });
  }

  var RELIABILITY_ALERT_TRANSPORT_ADAPTER = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    PROVIDER_CLASSES: PROVIDER_CLASSES,
    RUNTIME_BINDINGS: RUNTIME_BINDINGS,
    SECRET_STATUSES: SECRET_STATUSES,
    RETRY_ATTEMPT_CLASSES: RETRY_ATTEMPT_CLASSES,
    DEDUPE_STATE_CLASSES: DEDUPE_STATE_CLASSES,
    SYNTHETIC_RESPONSES: SYNTHETIC_RESPONSES,
    TRANSPORT_RESULTS: TRANSPORT_RESULTS,
    TRANSPORT_CONTROL_FIELDS: TRANSPORT_CONTROL_FIELDS,
    REQUIRED_CONTROL_FIELDS: REQUIRED_CONTROL_FIELDS,
    CANONICAL_ENVELOPE_FIELDS: CANONICAL_ENVELOPE_FIELDS,
    PRIVATE_KEYS: PRIVATE_KEYS,
    ERROR_CODES: ERROR_CODES,
    ERROR_CODE_SET: ERROR_CODE_SET,
    CAPABILITIES: Object.freeze([]),
    createAlertTransportAdapter: createAlertTransportAdapter,
    isCanonicalEnvelope: isCanonicalEnvelope
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RELIABILITY_ALERT_TRANSPORT_ADAPTER;
  }
  if (typeof window !== 'undefined') {
    window.LoveBudReliabilityAlertTransportAdapter = RELIABILITY_ALERT_TRANSPORT_ADAPTER;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.LoveBudReliabilityAlertTransportAdapter = RELIABILITY_ALERT_TRANSPORT_ADAPTER;
  }
})(this);
