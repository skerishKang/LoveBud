'use strict';

// Issue #3861 — Bounded alert envelope and provider-neutral delivery core
// (Reliability & Observability Child 4A of parent #3461).
//
// This module is a PURE DEPENDENCY-INJECTED AUTHORITY. It:
//   - consumes only the already-sanitized bounded outputs of the merged
//     #3835 taxonomy / #3851 structural sentinel / #3852+#3855 write-read
//     convergence authorities and builds a canonical alert envelope;
//   - carries NO capability (no network, fetch, XMLHttpRequest, provider SDK,
//     filesystem, environment variable, storage, database, SQL, DOM,
//     deployment, or Production configuration);
//   - is provider-neutral: the only side effect is ONE injected delivery
//     function invoked at most once per alert;
//   - applies fail-closed severity / owner / dedupe policy over bounded fields
//     only;
//   - never hashes raw IDs, text, URLs, errors, timestamps, provider metadata,
//     or caller-selected arbitrary data into the dedupe fingerprint;
//   - never throws across the producer boundary and never blocks or mutates the
//     normal user write/read path;
//   - is fail-closed on every privacy and safety boundary.
//
// Accepted alert source classes (exactly two):
//   STRUCTURAL_SENTINEL
//   WRITE_READ_CONVERGENCE
//
// Child 4B (concrete provider/deployment binding) and Child 5 (Production
// synthetic canary) are NOT authorized by this module. STOP_SYNTHETIC_WRITES
// and OWNER_DECISION_REQUIRED are advisory outputs only.
//
// Refs #3861.
// Refs #3835 — taxonomy authority.
// Refs #3851 — read-only structural sentinel.
// Refs #3852 / #3855 — write/read convergence.
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

  // ---------------------------------------------------------------------------
  // Fixed sanitized error codes. These are bounded, frozen and carry NO
  // caller-controlled key/value, no raw exception, and no stack. Thrown errors
  // expose only these codes.
  // ---------------------------------------------------------------------------
  var ERROR_CODES = Object.freeze({
    UNKNOWN_SOURCE_CLASS: 'UNKNOWN_SOURCE_CLASS',
    UNKNOWN_OPERATION_CLASS: 'UNKNOWN_OPERATION_CLASS',
    UNKNOWN_OUTCOME: 'UNKNOWN_OUTCOME',
    UNKNOWN_SEVERITY: 'UNKNOWN_SEVERITY',
    UNKNOWN_OWNER_ACTION: 'UNKNOWN_OWNER_ACTION',
    UNKNOWN_OWNER_CLASS: 'UNKNOWN_OWNER_CLASS',
    UNKNOWN_EVIDENCE: 'UNKNOWN_EVIDENCE',
    UNKNOWN_LATENCY: 'UNKNOWN_LATENCY',
    UNKNOWN_DEVIATION: 'UNKNOWN_DEVIATION',
    INVALID_RELEASE_SHA: 'INVALID_RELEASE_SHA',
    MISSING_TAXONOMY: 'MISSING_TAXONOMY',
    MISSING_DELIVERY_EFFECT: 'MISSING_DELIVERY_EFFECT',
    DELIVERY_EFFECT_NOT_CALLABLE: 'DELIVERY_EFFECT_NOT_CALLABLE',
    INVALID_FINGERPRINT: 'INVALID_FINGERPRINT',
    PROXY_OR_ACCESSOR_INPUT: 'PROXY_OR_ACCESSOR_INPUT',
    UNKNOWN_INPUT: 'UNKNOWN_INPUT',
    INVALID_INPUT: 'INVALID_INPUT',
    INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
    UNKNOWN_RESPONSE: 'UNKNOWN_RESPONSE'
  });

  var ERROR_CODE_SET = (function () {
    var s = {};
    for (var k in ERROR_CODES) {
      if (Object.prototype.hasOwnProperty.call(ERROR_CODES, k)) s[ERROR_CODES[k]] = true;
    }
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // Accepted alert source classes — exactly two.
  // ---------------------------------------------------------------------------
  var SOURCE_CLASSES = Object.freeze({
    STRUCTURAL_SENTINEL: 'STRUCTURAL_SENTINEL',
    WRITE_READ_CONVERGENCE: 'WRITE_READ_CONVERGENCE'
  });

  var SOURCE_CLASS_SET = (function () {
    var s = {};
    for (var k in SOURCE_CLASSES) {
      if (Object.prototype.hasOwnProperty.call(SOURCE_CLASSES, k)) s[SOURCE_CLASSES[k]] = true;
    }
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // Bounded owner classes (exactly three, defined by this child).
  // ---------------------------------------------------------------------------
  var OWNER_CLASSES = Object.freeze({
    RELIABILITY_OWNER: 'RELIABILITY_OWNER',
    DATABASE_OWNER: 'DATABASE_OWNER',
    PRODUCT_OWNER: 'PRODUCT_OWNER'
  });

  var OWNER_CLASS_SET = (function () {
    var s = {};
    for (var k in OWNER_CLASSES) {
      if (Object.prototype.hasOwnProperty.call(OWNER_CLASSES, k)) s[OWNER_CLASSES[k]] = true;
    }
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // Injected delivery effect response vocabulary.
  // ---------------------------------------------------------------------------
  var DELIVERY_RESPONSES = Object.freeze({
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    TIMEOUT: 'TIMEOUT',
    UNAVAILABLE: 'UNAVAILABLE'
  });

  var DELIVERY_RESPONSE_SET = (function () {
    var s = {};
    for (var k in DELIVERY_RESPONSES) {
      if (Object.prototype.hasOwnProperty.call(DELIVERY_RESPONSES, k)) s[DELIVERY_RESPONSES[k]] = true;
    }
    return deepFreeze(s);
  })();

  // ---------------------------------------------------------------------------
  // Canonical delivery outcomes.
  // ---------------------------------------------------------------------------
  var DELIVERY_OUTCOMES = Object.freeze({
    DELIVERY_ACCEPTED: 'DELIVERY_ACCEPTED',
    DELIVERY_REJECTED: 'DELIVERY_REJECTED',
    DELIVERY_TIMEOUT: 'DELIVERY_TIMEOUT',
    DELIVERY_UNAVAILABLE: 'DELIVERY_UNAVAILABLE',
    DELIVERY_SUPPRESSED_DUPLICATE: 'DELIVERY_SUPPRESSED_DUPLICATE',
    DELIVERY_NOT_ATTEMPTED_INVALID_INPUT: 'DELIVERY_NOT_ATTEMPTED_INVALID_INPUT',
    DELIVERY_NOT_ATTEMPTED_INSUFFICIENT_EVIDENCE: 'DELIVERY_NOT_ATTEMPTED_INSUFFICIENT_EVIDENCE',
    DELIVERY_FAILED_SANITIZED: 'DELIVERY_FAILED_SANITIZED'
  });

  // ---------------------------------------------------------------------------
  // Canonical envelope schema — exact own-key field set, fixed order.
  // ---------------------------------------------------------------------------
  var ENVELOPE_FIELDS = makeFrozenArray([
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

  var ENVELOPE_FIELD_SET = (function () {
    var s = {};
    for (var i = 0; i < ENVELOPE_FIELDS.length; i++) s[ENVELOPE_FIELDS[i]] = true;
    return deepFreeze(s);
  })();

  // Fields hashed into the dedupe fingerprint (all canonical bounded envelope
  // fields EXCEPT dedupe_fingerprint itself, which is derived).
  var FINGERPRINT_FIELDS = makeFrozenArray([
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
    'baseline_deviation_class'
  ]);

  // Fixed bounded value for fields that are not applicable to a source. One
  // exact schema: every envelope carries all 12 keys, using NOT_APPLICABLE when
  // a field is not applicable to the source.
  var NOT_APPLICABLE = 'NOT_APPLICABLE';

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

  // ---------------------------------------------------------------------------
  // Pure SHA-256 (FIPS 180-4) implementation. Embedded so the core is fully
  // deterministic, realm-agnostic, and requires no external crypto dependency
  // (no Node crypto, no WebCrypto, no provider SDK).
  // ---------------------------------------------------------------------------
  var SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function sha256Hex(message) {
    if (typeof message !== 'string') {
      throw new TypeError(ERROR_CODES.INVALID_INPUT);
    }
    // UTF-8 encode.
    var bytes = [];
    for (var i = 0; i < message.length; i++) {
      var c = message.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < message.length) {
        var c2 = message.charCodeAt(i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) {
          var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
          bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
          i += 1;
        } else {
          bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        }
      } else {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var bitLenHi = Math.floor(bitLen / 4294967296) >>> 0;
    var bitLenLo = bitLen >>> 0;
    bytes.push(
      (bitLenHi >>> 24) & 0xff, (bitLenHi >>> 16) & 0xff, (bitLenHi >>> 8) & 0xff, bitLenHi & 0xff,
      (bitLenLo >>> 24) & 0xff, (bitLenLo >>> 16) & 0xff, (bitLenLo >>> 8) & 0xff, bitLenLo & 0xff
    );

    var H = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    var W = new Uint32Array(64);

    function rotr(x, n) {
      return (x >>> n) | (x << (32 - n));
    }

    for (var chunk = 0; chunk < bytes.length; chunk += 64) {
      for (var t = 0; t < 16; t++) {
        var idx = chunk + t * 4;
        W[t] = ((bytes[idx] << 24) | (bytes[idx + 1] << 16) | (bytes[idx + 2] << 8) | bytes[idx + 3]) >>> 0;
      }
      for (var w = 16; w < 64; w++) {
        var s0 = rotr(W[w - 15], 7) ^ rotr(W[w - 15], 18) ^ (W[w - 15] >>> 3);
        var s1 = rotr(W[w - 2], 17) ^ rotr(W[w - 2], 19) ^ (W[w - 2] >>> 10);
        W[w] = (W[w - 16] + s0 + W[w - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3];
      var e = H[4], f = H[5], g = H[6], h = H[7];
      for (var j = 0; j < 64; j++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + SHA256_K[j] + W[j]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }

    var out = '';
    for (var k = 0; k < 8; k++) {
      var hex = H[k].toString(16);
      while (hex.length < 8) hex = '0' + hex;
      out += hex;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Deterministic canonical JSON for the fingerprint input. Keys are sorted and
  // only the bounded fingerprint fields are serialized, so identical input
  // always yields identical bytes.
  // ---------------------------------------------------------------------------
  function replacerSorted(key, value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    var out = {};
    var keys = Object.keys(value).sort();
    for (var i = 0; i < keys.length; i++) {
      var v = value[keys[i]];
      if (v !== undefined) out[keys[i]] = v;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Fixed deterministic owner-class mapping. Exactly one rule per outcome.
  // ---------------------------------------------------------------------------
  var OWNER_CLASS_BY_OUTCOME = (function () {
    var map = {
      // Structural sentinel signals: database/schema integrity owned by
      // DATABASE_OWNER.
      STRUCTURAL_DRIFT_DETECTED: 'DATABASE_OWNER',
      ORPHAN_SIGNAL_DETECTED: 'DATABASE_OWNER',
      BASELINE_DISCONTINUITY_DETECTED: 'DATABASE_OWNER',
      // Write/read convergence evidence problems are reliability-owned.
      ACKNOWLEDGED_REREAD_MISSING: 'RELIABILITY_OWNER',
      MONITORING_FAILED: 'RELIABILITY_OWNER',
      ACKNOWLEDGEMENT_MISSING: 'RELIABILITY_OWNER',
      TRANSPORT_FAILED: 'RELIABILITY_OWNER',
      INSUFFICIENT_EVIDENCE: 'RELIABILITY_OWNER',
      SCHEMA_AUTHORITY_UNAVAILABLE: 'RELIABILITY_OWNER',
      // Product-visible threshold / UI evidence problems are product-owned.
      PUBLIC_THRESHOLD_NOT_CONFIRMED: 'PRODUCT_OWNER',
      REREAD_CONFIRMED_UI_MISSING: 'PRODUCT_OWNER'
    };
    return deepFreeze(map);
  })();

  function resolveOwnerClass(outcomeCode) {
    if (hasOwn(OWNER_CLASS_BY_OUTCOME, outcomeCode)) {
      return OWNER_CLASS_BY_OUTCOME[outcomeCode];
    }
    // Deterministic default: any other valid outcome is reliability-owned.
    return 'RELIABILITY_OWNER';
  }

  // ---------------------------------------------------------------------------
  // Prior fingerprint normalization. Accepts a single exact fingerprint string
  // or an array of fingerprint strings. Validates lowercase sha256 hex, then
  // sorts/dedupes deterministically. Never persists dedupe state itself and
  // never reads storage or timestamps.
  // ---------------------------------------------------------------------------
  function normalizePriorFingerprints(value) {
    var fingerprints = [];
    if (value === undefined || value === null) {
      return deepFreeze(fingerprints);
    }
    if (typeof value === 'string') {
      if (!isValidSha256Hex(value)) {
        throw new TypeError(ERROR_CODES.INVALID_FINGERPRINT);
      }
      fingerprints.push(value);
    } else if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        var item = value[i];
        if (typeof item !== 'string' || !isValidSha256Hex(item)) {
          throw new TypeError(ERROR_CODES.INVALID_FINGERPRINT);
        }
        fingerprints.push(item);
      }
    } else {
      throw new TypeError(ERROR_CODES.INVALID_FINGERPRINT);
    }
    fingerprints.sort();
    var unique = [];
    for (var u = 0; u < fingerprints.length; u++) {
      if (unique.length === 0 || unique[unique.length - 1] !== fingerprints[u]) {
        unique.push(fingerprints[u]);
      }
    }
    return deepFreeze(unique);
  }

  // ---------------------------------------------------------------------------
  // Bounded input-field schema for the producer boundary. The core consumes
  // exactly these own keys (the already-sanitized bounded authority output
  // fields); any other own key is rejected before any delivery effect.
  // ---------------------------------------------------------------------------
  var INPUT_FIELDS = makeFrozenArray([
    'source_class',
    'operation_class',
    'stage',
    'outcome_code',
    'release_sha',
    'latency_bucket',
    'count_bucket',
    'baseline_deviation',
    'severity',
    'owner_action',
    'evidence_completeness'
  ]);

  var INPUT_FIELD_SET = (function () {
    var s = {};
    for (var i = 0; i < INPUT_FIELDS.length; i++) s[INPUT_FIELDS[i]] = true;
    return deepFreeze(s);
  })();

  // Privacy-sensitive own keys — rejected on input before the delivery effect.
  var PRIVATE_KEYS = makeFrozenArray([
    'token', 'cookie', 'authorization', 'authorization_header', 'email',
    'user_id', 'owner_id', 'tree_id', 'memory_id', 'comment_id', 'reaction_id',
    'title', 'description', 'content', 'url', 'query', 'request_body',
    'response_body', 'raw_error', 'exception', 'message', 'stack', 'cause',
    'provider_id', 'account_id', 'project_id', 'deployment_id', 'endpoint',
    'webhook_url', 'database_url', 'request_id', 'timestamp', 'metadata'
  ]);

  var PRIVATE_KEY_SET = (function () {
    var s = {};
    for (var i = 0; i < PRIVATE_KEYS.length; i++) s[PRIVATE_KEYS[i]] = true;
    return deepFreeze(s);
  })();

  function enumValid(value, set) {
    return value !== undefined && value !== null && hasOwn(set, value) && Boolean(set[value]);
  }

  // ---------------------------------------------------------------------------
  // Per-source bounded operation-class subsets. The core consumes only these
  // fixed subsets of the merged taxonomy; unknown or non-alertable
  // source/operation combinations fail before the delivery effect.
  // ---------------------------------------------------------------------------
  var SOURCE_OPERATION_CLASSES = Object.freeze({
    STRUCTURAL_SENTINEL: deepFreeze([
      'STRUCTURAL_SCHEMA_CHECK',
      'TREE_PARENT_INTEGRITY_CHECK',
      'MEMORY_PARENT_INTEGRITY_CHECK',
      'SOCIAL_TARGET_INTEGRITY_CHECK',
      'BROWSE_ELIGIBILITY_BASELINE_CHECK'
    ]),
    WRITE_READ_CONVERGENCE: deepFreeze([
      'TREE_CREATE_CONVERGENCE',
      'MEMORY_CREATE_CONVERGENCE',
      'PUBLIC_THRESHOLD_CONVERGENCE'
    ])
  });

  // ---------------------------------------------------------------------------
  // Alert core factory. The caller injects the merged #3835 taxonomy, the ONE
  // provider-neutral delivery effect, and (optionally) a prior bounded
  // fingerprint set.
  // ---------------------------------------------------------------------------
  function createAlertDeliveryCore(deps) {
    var taxonomy;
    var deliverAlertEffect;
    var priorFingerprints;
    try {
      if (!deps || !isPlainRecord(deps)) {
        throw new TypeError(ERROR_CODES.UNKNOWN_INPUT);
      }
      var taxonomyValue = readOptionalOwnEnumerableDataProperty(deps, 'taxonomy');
      if (taxonomyValue === undefined || taxonomyValue === null || !isPlainRecord(taxonomyValue)) {
        throw new TypeError(ERROR_CODES.MISSING_TAXONOMY);
      }
      taxonomy = taxonomyValue;

      var effectValue = readOptionalOwnEnumerableDataProperty(deps, 'deliverAlert');
      if (effectValue === undefined || effectValue === null) {
        throw new TypeError(ERROR_CODES.MISSING_DELIVERY_EFFECT);
      }
      if (!isCallable(effectValue)) {
        throw new TypeError(ERROR_CODES.DELIVERY_EFFECT_NOT_CALLABLE);
      }
      deliverAlertEffect = effectValue;

      var priorValue = readOptionalOwnEnumerableDataProperty(deps, 'priorFingerprints');
      priorFingerprints = normalizePriorFingerprints(priorValue);
    } catch (e) {
      if (typeof e === 'object' && e !== null && hasOwn(ERROR_CODE_SET, e.message)) {
        throw e;
      }
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }

    // One-time descriptor-safe taxonomy capture. Every enum set is read
    // exactly once at core creation; the execution flow never performs a
    // repeated direct read so Proxy get traps / accessor getters are never
    // invoked. The *SET maps are keyed by the bounded enum VALUE (e.g. the
    // evidence values are lowercase 'complete'/'partial'/'missing'/'invalid'),
    // which is exactly the vocabulary the envelope consumes.
    var taxOpClasses;
    var taxOutcomes;
    var taxOutcomeValues;
    var taxSeverities;
    var taxActions;
    var taxEvidence;
    var taxEvidenceValues;
    var taxLatency;
    var taxDeviation;
    try {
      taxOpClasses = readOwnEnumerableDataProperty(taxonomy, 'OPERATION_CLASS_SET');
      taxOutcomes = readOwnEnumerableDataProperty(taxonomy, 'OUTCOME_CODE_SET');
      taxOutcomeValues = readOwnEnumerableDataProperty(taxonomy, 'OUTCOME_CODES');
      taxSeverities = readOwnEnumerableDataProperty(taxonomy, 'SEVERITY_SET');
      taxActions = readOwnEnumerableDataProperty(taxonomy, 'OWNER_ACTION_SET');
      taxEvidence = readOwnEnumerableDataProperty(taxonomy, 'EVIDENCE_COMPLETENESS_SET');
      taxEvidenceValues = readOwnEnumerableDataProperty(taxonomy, 'EVIDENCE_COMPLETENESS');
      taxLatency = readOwnEnumerableDataProperty(taxonomy, 'LATENCY_BUCKET_SET');
      taxDeviation = readOwnEnumerableDataProperty(taxonomy, 'DEVIATION_SET');
    } catch (e) {
      throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
    }

    // -------------------------------------------------------------------------
    // Bounded envelope builder. Fails closed (returns a sanitized result) on
    // any unknown/invalid/private field; never throws across the producer
    // boundary and never invokes the delivery effect before full validation
    // and dedupe evaluation.
    // -------------------------------------------------------------------------
    function buildEnvelope(input) {
      var sourceClass = input.source_class;
      if (!enumValid(sourceClass, SOURCE_CLASS_SET)) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_SOURCE_CLASS };
      }
      var operationClass = input.operation_class;
      if (!enumValid(operationClass, taxOpClasses)) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_OPERATION_CLASS };
      }
      var allowedOps = SOURCE_OPERATION_CLASSES[sourceClass];
      var allowedOp = false;
      for (var i = 0; i < allowedOps.length; i++) {
        if (allowedOps[i] === operationClass) { allowedOp = true; break; }
      }
      if (!allowedOp) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_OPERATION_CLASS };
      }
      var outcomeCode = input.outcome_code;
      if (!enumValid(outcomeCode, taxOutcomes)) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_OUTCOME };
      }
      var severity = input.severity;
      if (!enumValid(severity, taxSeverities)) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_SEVERITY };
      }
      var ownerAction = input.owner_action;
      if (!enumValid(ownerAction, taxActions)) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_OWNER_ACTION };
      }
      var evidence = input.evidence_completeness;
      if (!enumValid(evidence, taxEvidence)) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_EVIDENCE };
      }
      var releaseSha = input.release_sha;
      if (!isValidReleaseSha(releaseSha)) {
        return { ok: false, reason: ERROR_CODES.INVALID_RELEASE_SHA };
      }
      var latencyBucket = input.latency_bucket;
      if (latencyBucket !== undefined && latencyBucket !== null) {
        if (!enumValid(latencyBucket, taxLatency)) {
          return { ok: false, reason: ERROR_CODES.UNKNOWN_LATENCY };
        }
      } else {
        latencyBucket = NOT_APPLICABLE;
      }
      var deviation = input.baseline_deviation;
      if (deviation !== undefined && deviation !== null) {
        if (!enumValid(deviation, taxDeviation)) {
          return { ok: false, reason: ERROR_CODES.UNKNOWN_DEVIATION };
        }
      } else {
        deviation = NOT_APPLICABLE;
      }

      var ownerClass = resolveOwnerClass(outcomeCode);
      if (!enumValid(ownerClass, OWNER_CLASS_SET)) {
        return { ok: false, reason: ERROR_CODES.UNKNOWN_OWNER_CLASS };
      }

      var fingerprintBase = {
        contract_version: CONTRACT_VERSION,
        source_class: sourceClass,
        operation_class: operationClass,
        outcome_code: outcomeCode,
        severity: severity,
        advisory_action: ownerAction,
        owner_class: ownerClass,
        evidence_completeness: evidence,
        release_sha: releaseSha,
        latency_bucket: latencyBucket,
        baseline_deviation_class: deviation
      };
      var dedupeFingerprint = sha256Hex(JSON.stringify(fingerprintBase, replacerSorted));

      var envelope = {
        contract_version: CONTRACT_VERSION,
        source_class: sourceClass,
        operation_class: operationClass,
        outcome_code: outcomeCode,
        severity: severity,
        advisory_action: ownerAction,
        owner_class: ownerClass,
        evidence_completeness: evidence,
        release_sha: releaseSha,
        latency_bucket: latencyBucket,
        baseline_deviation_class: deviation,
        dedupe_fingerprint: dedupeFingerprint
      };
      return { ok: true, envelope: deepFreeze(envelope) };
    }

    // Evidence gate: CONFIRMED can never be alerted with incomplete evidence,
    // and missing/invalid evidence is never alertable.
    function hasSufficientEvidence(input) {
      var evidence = input.evidence_completeness;
      var outcomeCode = input.outcome_code;
      if (evidence === taxEvidenceValues.MISSING || evidence === taxEvidenceValues.INVALID) {
        return false;
      }
      if (outcomeCode === taxOutcomeValues.CONFIRMED && evidence !== taxEvidenceValues.COMPLETE) {
        return false;
      }
      return true;
    }

    // -------------------------------------------------------------------------
    // Provider-neutral delivery boundary. Returns a bounded frozen result and
    // NEVER throws. The injected effect is invoked at most once, and only after
    // full validation and dedupe evaluation. Any throw/rejection from the
    // effect maps to DELIVERY_FAILED_SANITIZED with zero raw leakage.
    // -------------------------------------------------------------------------
    async function deliverAlert(input) {
      var effectCount = 0;
      try {
        if (!input || !isPlainRecord(input)) {
          return deepFreeze({
            outcome: DELIVERY_OUTCOMES.DELIVERY_NOT_ATTEMPTED_INVALID_INPUT,
            envelope: null
          });
        }

        var keys = Object.keys(input);
        for (var i = 0; i < keys.length; i++) {
          if (hasOwn(PRIVATE_KEY_SET, keys[i])) {
            return deepFreeze({
              outcome: DELIVERY_OUTCOMES.DELIVERY_NOT_ATTEMPTED_INVALID_INPUT,
              envelope: null
            });
          }
          if (!hasOwn(INPUT_FIELD_SET, keys[i])) {
            return deepFreeze({
              outcome: DELIVERY_OUTCOMES.DELIVERY_NOT_ATTEMPTED_INVALID_INPUT,
              envelope: null
            });
          }
        }

        // Optional fields are allowed to be absent; required fields must be own
        // data properties. Descriptor-safe reads.
        var sourceClassValue;
        var operationClassValue;
        var outcomeCodeValue;
        var releaseShaValue;
        var severityValue;
        var ownerActionValue;
        var evidenceValue;
        var latencyBucketValue;
        var deviationValue;
        try {
          sourceClassValue = readOptionalOwnEnumerableDataProperty(input, 'source_class');
          operationClassValue = readOptionalOwnEnumerableDataProperty(input, 'operation_class');
          outcomeCodeValue = readOptionalOwnEnumerableDataProperty(input, 'outcome_code');
          releaseShaValue = readOptionalOwnEnumerableDataProperty(input, 'release_sha');
          severityValue = readOptionalOwnEnumerableDataProperty(input, 'severity');
          ownerActionValue = readOptionalOwnEnumerableDataProperty(input, 'owner_action');
          evidenceValue = readOptionalOwnEnumerableDataProperty(input, 'evidence_completeness');
          latencyBucketValue = readOptionalOwnEnumerableDataProperty(input, 'latency_bucket');
          deviationValue = readOptionalOwnEnumerableDataProperty(input, 'baseline_deviation');
        } catch (e) {
          return deepFreeze({
            outcome: DELIVERY_OUTCOMES.DELIVERY_NOT_ATTEMPTED_INVALID_INPUT,
            envelope: null
          });
        }

        if (
          sourceClassValue === undefined || sourceClassValue === null ||
          operationClassValue === undefined || operationClassValue === null ||
          outcomeCodeValue === undefined || outcomeCodeValue === null ||
          releaseShaValue === undefined || releaseShaValue === null ||
          severityValue === undefined || severityValue === null ||
          ownerActionValue === undefined || ownerActionValue === null ||
          evidenceValue === undefined || evidenceValue === null
        ) {
          return deepFreeze({
            outcome: DELIVERY_OUTCOMES.DELIVERY_NOT_ATTEMPTED_INVALID_INPUT,
            envelope: null
          });
        }

        var normalizedInput = {
          source_class: sourceClassValue,
          operation_class: operationClassValue,
          outcome_code: outcomeCodeValue,
          release_sha: releaseShaValue,
          severity: severityValue,
          owner_action: ownerActionValue,
          evidence_completeness: evidenceValue
        };
        if (latencyBucketValue !== undefined && latencyBucketValue !== null) {
          normalizedInput.latency_bucket = latencyBucketValue;
        }
        if (deviationValue !== undefined && deviationValue !== null) {
          normalizedInput.baseline_deviation = deviationValue;
        }

        var built = buildEnvelope(normalizedInput);
        if (!built.ok) {
          return deepFreeze({
            outcome: DELIVERY_OUTCOMES.DELIVERY_NOT_ATTEMPTED_INVALID_INPUT,
            envelope: null
          });
        }

        if (!hasSufficientEvidence(normalizedInput)) {
          return deepFreeze({
            outcome: DELIVERY_OUTCOMES.DELIVERY_NOT_ATTEMPTED_INSUFFICIENT_EVIDENCE,
            envelope: built.envelope
          });
        }

        // Dedupe: an exact duplicate prior fingerprint is suppressed before the
        // delivery effect. Never persists dedupe state itself.
        for (var p = 0; p < priorFingerprints.length; p++) {
          if (priorFingerprints[p] === built.envelope.dedupe_fingerprint) {
            return deepFreeze({
              outcome: DELIVERY_OUTCOMES.DELIVERY_SUPPRESSED_DUPLICATE,
              envelope: built.envelope
            });
          }
        }

        // Exactly-once effect boundary.
        var response;
        try {
          effectCount += 1;
          response = await deliverAlertEffect(built.envelope);
        } catch (e) {
          return deepFreeze({
            outcome: DELIVERY_OUTCOMES.DELIVERY_FAILED_SANITIZED,
            envelope: built.envelope
          });
        }

        if (response === DELIVERY_RESPONSES.ACCEPTED) {
          return deepFreeze({
            outcome: DELIVERY_OUTCOMES.DELIVERY_ACCEPTED,
            envelope: built.envelope
          });
        }
        if (response === DELIVERY_RESPONSES.REJECTED) {
          return deepFreeze({
            outcome: DELIVERY_OUTCOMES.DELIVERY_REJECTED,
            envelope: built.envelope
          });
        }
        if (response === DELIVERY_RESPONSES.TIMEOUT) {
          return deepFreeze({
            outcome: DELIVERY_OUTCOMES.DELIVERY_TIMEOUT,
            envelope: built.envelope
          });
        }
        if (response === DELIVERY_RESPONSES.UNAVAILABLE) {
          return deepFreeze({
            outcome: DELIVERY_OUTCOMES.DELIVERY_UNAVAILABLE,
            envelope: built.envelope
          });
        }
        // Any other response value (including a raw object or undefined) is a
        // protocol violation: sanitized, no raw leakage.
        return deepFreeze({
          outcome: DELIVERY_OUTCOMES.DELIVERY_FAILED_SANITIZED,
          envelope: built.envelope
        });
      } catch (e) {
        return deepFreeze({
          outcome: DELIVERY_OUTCOMES.DELIVERY_NOT_ATTEMPTED_INVALID_INPUT,
          envelope: null
        });
      }
    }

    // Static bounded helpers exposed for tests / bounded normalization.
    function validatePriorFingerprintSet(value) {
      return normalizePriorFingerprints(value);
    }

    return deepFreeze({
      CONTRACT_VERSION: CONTRACT_VERSION,
      SOURCE_CLASSES: SOURCE_CLASSES,
      OWNER_CLASSES: OWNER_CLASSES,
      DELIVERY_RESPONSES: DELIVERY_RESPONSES,
      DELIVERY_OUTCOMES: DELIVERY_OUTCOMES,
      ENVELOPE_FIELDS: ENVELOPE_FIELDS,
      FINGERPRINT_FIELDS: FINGERPRINT_FIELDS,
      NOT_APPLICABLE: NOT_APPLICABLE,
      ERROR_CODES: ERROR_CODES,
      ERROR_CODE_SET: ERROR_CODE_SET,
      OWNER_CLASS_BY_OUTCOME: OWNER_CLASS_BY_OUTCOME,
      SOURCE_OPERATION_CLASSES: SOURCE_OPERATION_CLASSES,
      sha256Hex: sha256Hex,
      isValidReleaseSha: isValidReleaseSha,
      isValidSha256Hex: isValidSha256Hex,
      normalizePriorFingerprints: normalizePriorFingerprints,
      validatePriorFingerprintSet: validatePriorFingerprintSet,
      createEnvelope: function (input) {
        try {
          if (!input || !isPlainRecord(input)) {
            throw new TypeError(ERROR_CODES.INVALID_INPUT);
          }
          var built = buildEnvelope(input);
          if (!built.ok) {
            throw new TypeError(built.reason);
          }
          return built.envelope;
        } catch (e) {
          if (typeof e === 'object' && e !== null && hasOwn(ERROR_CODE_SET, e.message)) {
            throw e;
          }
          throw new TypeError(ERROR_CODES.PROXY_OR_ACCESSOR_INPUT);
        }
      },
      deliverAlert: deliverAlert
    });
  }

  var RELIABILITY_ALERT_DELIVERY_CORE = Object.freeze({
    CONTRACT_VERSION: CONTRACT_VERSION,
    SOURCE_CLASSES: SOURCE_CLASSES,
    OWNER_CLASSES: OWNER_CLASSES,
    DELIVERY_RESPONSES: DELIVERY_RESPONSES,
    DELIVERY_OUTCOMES: DELIVERY_OUTCOMES,
    ENVELOPE_FIELDS: ENVELOPE_FIELDS,
    FINGERPRINT_FIELDS: FINGERPRINT_FIELDS,
    NOT_APPLICABLE: NOT_APPLICABLE,
    ERROR_CODES: ERROR_CODES,
    ERROR_CODE_SET: ERROR_CODE_SET,
    CAPABILITIES: Object.freeze([]),
    createAlertDeliveryCore: createAlertDeliveryCore,
    sha256Hex: sha256Hex
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RELIABILITY_ALERT_DELIVERY_CORE;
  }
  if (typeof window !== 'undefined') {
    window.LoveBudReliabilityAlertDeliveryCore = RELIABILITY_ALERT_DELIVERY_CORE;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.LoveBudReliabilityAlertDeliveryCore = RELIABILITY_ALERT_DELIVERY_CORE;
  }
})(this);
