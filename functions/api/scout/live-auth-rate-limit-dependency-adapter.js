/**
 * Scout Live Auth / Rate-Limit Dependency Adapter Skeleton
 * v20260616-runtime-key-mapping-1
 *
 * Slice issue: #2577
 * Parent issue: #1882 (must remain OPEN; never auto-close)
 *
 * Mock-disabled dependency adapter skeleton for the Scout live provider path.
 * Provides a factory that returns default implementations of `verifyToken`,
 * `checkRateLimit`, and `requestId` for the DI seam established in
 * `functions/api/scout/suggest.js` LIVE branch (shape:
 * `liveDependencies = { verifyToken, checkRateLimit, observer, requestId }`).
 *
 * By default the adapter is **mock-disabled** and returns safe "not
 * implemented" responses so the endpoint can never accidentally allow real
 * traffic while the skeleton is in place. Real implementations of
 * `verifyToken` (Firebase Admin SDK or equivalent) and `checkRateLimit`
 * (KV / Durable Object / D1 or equivalent) will be added in future slices.
 *
 * `verifyToken` routes through an internal auth verifier adapter seam. The
 * default verifier dependency is `createScoutLiveAuthVerifierAdapter`
 * from `live-auth-verifier-adapter.js` (mock-disabled by default). The
 * verifier's `verifyToken` is called with an allowlisted payload only
 * (no raw token / authorization header / API key / firebaseToken / prompt
 * / excerpt / sourceUrl). Verifier results are mapped back to
 * dependency-adapter safe-fail shapes (`VERIFY_NOT_IMPLEMENTED`,
 * `VERIFY_PAYLOAD_PROHIBITED`, `VERIFY_UNAVAILABLE`, or the dedicated
 * success code `VERIFY_RUNTIME_VERIFIED` when the verifier adapter
 * returns `VERIFIER_FIREBASE_RUNTIME_VERIFIED` with a sanitized
 * `userKeyHash`). The verifier adapter itself is mock-disabled and does
 * NOT access any real Firebase Admin SDK, `getAuth`, `verifyIdToken`,
 * external auth service, or network call.
 *
 * `checkRateLimit` routes through an internal storage adapter seam. The
 * default storage dependency is `createScoutLiveRateLimitStorageAdapter`
 * from `live-rate-limit-storage-adapter.js` (mock-disabled by default). The
 * storage adapter's `checkQuota` is called with an allowlisted payload
 * only (no raw token / API key / prompt / excerpt / sourceUrl). Storage
 * adapter results are mapped back to dependency-adapter safe-fail shapes
 * (RATE_LIMIT_NOT_IMPLEMENTED or RATE_LIMIT_PAYLOAD_PROHIBITED). The
 * storage adapter itself is mock-disabled and does NOT access any real
 * KV / Durable Object / D1 / database.
 *
 * Provides:
 * - SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES: status / mode constants
 * - SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES: response code constants
 * - SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION: skeleton version
 * - createScoutLiveDependencyAdapter: returns a dependency adapter object
 *   with `verifyToken`, `checkRateLimit`, `requestId`, and metadata
 *   (`isMockDisabled`, `mode`, `version`, `storageAdapterKind`,
 *   `verifierAdapterKind`).
 *
 * Issue #2569 mapping: the verifier-result mapper now recognizes
 * `VERIFIER_FIREBASE_RUNTIME_VERIFIED` and converts it into a dependency
 * success response with `allowed: true`, the dedicated
 * `VERIFY_RUNTIME_VERIFIED` code, `userKey: null`, and a propagated
 * sanitized `userKeyHash`. The Firebase runtime disabled / failed codes
 * map to existing safe-fail shapes:
 * - `VERIFIER_FIREBASE_RUNTIME_DISABLED` → `VERIFY_NOT_IMPLEMENTED`
 *   (the runtime is not configured in this context);
 * - `VERIFIER_FIREBASE_RUNTIME_FAILED` → `VERIFY_UNAVAILABLE`
 *   (the runtime was invoked but safe-failed).
 *
 * Issue #2571 guarded raw auth-header token handoff: the dependency
 * adapter accepts a guarded factory option `allowRawTokenHandoff: true`.
 * When set, an `idToken` field present in the dependency-adapter
 * verifyToken input is forwarded to the verifier adapter payload. When
 * false or omitted (the default), the dependency adapter strips any
 * `idToken` and forwards derived fields only. The raw auth-header token
 * never reaches the verifier seam without the explicit opt-in.
 *
 * Issue #2577 runtime-key scaffold mapping: the dependency adapter
 * explicitly recognizes `STORAGE_KEY_BUILT` from the storage adapter
 * and maps it to `RATE_LIMIT_STORAGE_UNAVAILABLE`. The runtime key
 * output is sanitized scaffold metadata only and MUST NOT be
 * interpreted as a quota allow decision. The dependency adapter also
 * does not surface `storageKey`, `keyPreview`, or any other runtime
 * key builder field in its response — those stay on the storage
 * adapter side.
 *
 * This module is a **mock-disabled skeleton + factory**. No real Firebase
 * Admin SDK import, no real token verification, no real persistent storage
 * call, no fetch, no provider API call.
 *
 * Non-goals:
 * - No real LLM provider call
 * - No provider SDK import
 * - No Firebase Admin SDK import
 * - No Firebase token verification
 * - No KV / Durable Object / D1 import
 * - No persistent rate-limit storage call
 * - No external URL fetch
 * - No auto-save or persistence
 * - No raw token handoff from boundary to verifier
 *   (separate slice)
 * - No wiring into suggest.js LIVE branch (separate slice)
 */

'use strict';

import { createScoutLiveRateLimitStorageAdapter } from './live-rate-limit-storage-adapter.js';
import { createScoutLiveAuthVerifierAdapter } from './live-auth-verifier-adapter.js';

// ─── Version ────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION = '20260616-runtime-key-mapping-1';

// ─── Mode Constants ─────────────────────────────────────────────────────────

export const SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES = Object.freeze({
  MOCK_DISABLED: 'mock_disabled',
  NOT_IMPLEMENTED: 'not_implemented',
});

// ─── Response Codes ─────────────────────────────────────────────────────────

export const SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES = Object.freeze({
  VERIFY_NOT_IMPLEMENTED: 'VERIFY_NOT_IMPLEMENTED',
  VERIFY_PAYLOAD_PROHIBITED: 'VERIFY_PAYLOAD_PROHIBITED',
  VERIFY_UNAVAILABLE: 'VERIFY_UNAVAILABLE',
  VERIFY_RUNTIME_VERIFIED: 'VERIFY_RUNTIME_VERIFIED',
  RATE_LIMIT_NOT_IMPLEMENTED: 'RATE_LIMIT_NOT_IMPLEMENTED',
  RATE_LIMIT_PAYLOAD_PROHIBITED: 'RATE_LIMIT_PAYLOAD_PROHIBITED',
  RATE_LIMIT_STORAGE_UNAVAILABLE: 'RATE_LIMIT_STORAGE_UNAVAILABLE',
});

// ─── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_OPTIONS = Object.freeze({
  mockDisabled: true,
});

// ─── Storage Payload Allowlist (mirror of storage adapter) ──────────────────

// The dependency adapter's checkRateLimit builds a storage payload using
// ONLY these fields. No raw token / API key / prompt / excerpt / sourceUrl
// ever enters the storage payload. This allowlist is the single source
// of truth for safe payload fields at the dependency-adapter seam.
const STORAGE_PAYLOAD_ALLOWED_FIELDS = Object.freeze([
  'requestId',
  'userKeyHash',
  'ipHash',
  'sessionKeyHash',
  'endpointPath',
  'providerMode',
  'windowKey',
  'limitName',
  'nowMs',
]);

function buildSafeStoragePayload(input) {
  const src = (input && typeof input === 'object') ? input : {};
  const out = {};
  for (const key of STORAGE_PAYLOAD_ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
      out[key] = src[key];
    }
  }
  return out;
}

// ─── Verifier Payload Allowlist (mirror of verifier adapter) ───────────────

// The dependency adapter's verifyToken builds a verifier payload using
// ONLY these future-safe derived fields, plus an opt-in `idToken` when
// the factory option `allowRawTokenHandoff` is true. No raw token /
// authorization header / API key / firebaseToken / session cookie /
// password / prompt / excerpt / sourceUrl / raw request body ever
// enters the verifier payload. This allowlist is the single source of
// truth for safe payload fields at the dependency-adapter to
// verifier-adapter seam.
const AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS = Object.freeze([
  'requestId',
  'tokenHash',
  'authorizationScheme',
  'providerMode',
  'endpointPath',
  'nowMs',
  'idToken', // guarded: included ONLY when allowRawTokenHandoff is true
]);

function buildSafeVerifierPayload(input, options) {
  const src = (input && typeof input === 'object') ? input : {};
  const opts = (options && typeof options === 'object') ? options : {};
  const allowRawTokenHandoff = opts.allowRawTokenHandoff === true;
  const out = {};
  for (const key of AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS) {
    if (key === 'idToken') {
      // Guarded: only include idToken when the explicit opt-in is set
      // and the source actually provides one.
      if (
        allowRawTokenHandoff &&
        Object.prototype.hasOwnProperty.call(src, 'idToken') &&
        typeof src.idToken === 'string' &&
        src.idToken.length > 0
      ) {
        out.idToken = src.idToken;
      }
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
      out[key] = src[key];
    }
  }
  return out;
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function makeMockDisabledRequestId() {
  // Mock-disabled request id: clearly fake, never collides with real
  // upstream / W3C trace ids, contains only safe characters.
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return 'req_mock_disabled_' + ts + '_' + rand;
}

function buildMockDisabledVerifyResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED,
    reason: 'verifyToken is mock-disabled; real implementation is required',
    userKey: null,
    userKeyHash: null,
  };
}

function buildMockDisabledRateLimitResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED,
    reason: 'rate limiting is mock-disabled; real implementation is required',
  };
}

function buildNotImplementedVerifyResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED,
    reason: 'real verifyToken implementation is not yet provided',
    userKey: null,
    userKeyHash: null,
  };
}

function buildNotImplementedRateLimitResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED,
    reason: 'real checkRateLimit implementation is not yet provided',
  };
}

function buildNotImplementedRequestId() {
  return 'req_not_implemented_' + Date.now().toString(36);
}

// ─── Storage-to-Dependency Response Mapping ─────────────────────────────────

/**
 * Map a storage adapter result to a dependency-adapter safe-fail shape.
 * Storage result codes are translated to dependency-adapter codes so the
 * caller (boundary / endpoint) can reason about the decision consistently.
 *
 * @param {Object} storageResult - result from storageAdapter.checkQuota
 * @returns {Object} dependency-adapter safe-fail response
 */
function mapStorageResultToDependencyResponse(storageResult) {
  const res = (storageResult && typeof storageResult === 'object') ? storageResult : {};
  const code = res.code;
  if (code === 'STORAGE_PAYLOAD_PROHIBITED') {
    return {
      allowed: false,
      code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_PAYLOAD_PROHIBITED,
      reason: typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'rate-limit payload contained prohibited fields',
      retryAfterSeconds: null,
    };
  }
  if (code === 'STORAGE_NOT_IMPLEMENTED') {
    return {
      allowed: false,
      code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED,
      reason: typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'rate-limit storage adapter is not implemented',
      retryAfterSeconds: null,
    };
  }
  if (code === 'STORAGE_MOCK_DISABLED') {
    return {
      allowed: false,
      code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED,
      reason: typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'rate-limit storage adapter is mock-disabled',
      retryAfterSeconds: null,
    };
  }
  if (
    code === 'STORAGE_KV_DISABLED' ||
    code === 'STORAGE_KV_SKELETON' ||
    code === 'STORAGE_DURABLE_OBJECT_DISABLED' ||
    code === 'STORAGE_D1_DISABLED' ||
    code === 'STORAGE_CONFIG_MISSING' ||
    code === 'STORAGE_KEY_BUILDER_DISABLED' ||
    code === 'STORAGE_KEY_PAYLOAD_PROHIBITED' ||
    code === 'STORAGE_KEY_BUILT'
  ) {
    return {
      allowed: false,
      code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE,
      reason: typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'rate-limit storage scaffold is disabled or not configured',
      retryAfterSeconds: null,
    };
  }
  // Unknown / missing code → generic storage-unavailable safe-fail
  return {
    allowed: false,
    code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE,
    reason: typeof res.reason === 'string' && res.reason.length > 0
      ? res.reason
      : 'rate-limit storage adapter returned an unknown result',
    retryAfterSeconds: null,
  };
}

/**
 * Build a checkRateLimit function that routes through the given storage
 * adapter. The storage payload is built from an allowlist only (no raw
 * token / API key / prompt / excerpt / sourceUrl). Storage adapter
 * exceptions are safe-swallowed to a safe-fail response.
 *
 * @param {Object} storageAdapter - storage adapter (must have checkQuota)
 * @returns {Function} async checkRateLimit function
 */
function buildStorageRoutedCheckRateLimit(storageAdapter) {
  return async function checkRateLimit(payload) {
    const safePayload = buildSafeStoragePayload(payload);
    let storageResult;
    try {
      storageResult = await storageAdapter.checkQuota(safePayload);
    } catch {
      return {
        allowed: false,
        code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE,
        reason: 'rate-limit storage adapter threw an exception',
        retryAfterSeconds: null,
      };
    }
    return mapStorageResultToDependencyResponse(storageResult);
  };
}

// ─── Verifier-to-Dependency Response Mapping ───────────────────────────────

/**
 * Sanitized `userKeyHash` shape lock. The dependency adapter only
 * propagates a `userKeyHash` when it is a non-empty string of exactly 16
 * lowercase hex characters (matching the verifier adapter's
 * `deriveUserKeyHash` output). Any other shape is treated as invalid and
 * safe-fails the response.
 */
function isValidSanitizedUserKeyHash(value) {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{16}$/.test(value);
}

/**
 * Map a verifier adapter result to a dependency-adapter safe-fail shape.
 * Verifier result codes are translated to dependency-adapter codes so
 * the caller (boundary / endpoint) can reason about the decision
 * consistently. The dedicated success path is entered ONLY when the
 * verifier returns `VERIFIER_FIREBASE_RUNTIME_VERIFIED` with a valid
 * sanitized `userKeyHash`. All other paths remain safe-fail.
 *
 * Issue #2569: the Firebase runtime verified code is mapped to a
 * dedicated dependency success code `VERIFY_RUNTIME_VERIFIED` with
 * `allowed: true`, `userKey: null`, and the propagated `userKeyHash`.
 * No raw UID / email / token / claims / service account data is ever
 * propagated.
 *
 * @param {Object} verifierResult - result from verifierAdapter.verifyToken
 * @returns {Object} dependency-adapter response (success or safe-fail)
 */
function mapVerifierResultToDependencyResponse(verifierResult) {
  const res = (verifierResult && typeof verifierResult === 'object') ? verifierResult : {};
  const code = res.code;
  if (code === 'VERIFIER_PAYLOAD_PROHIBITED') {
    return {
      allowed: false,
      code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_PAYLOAD_PROHIBITED,
      reason: typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'verifier payload contained prohibited fields',
      userKey: null,
      userKeyHash: null,
    };
  }
  if (
    code === 'VERIFIER_FIREBASE_DISABLED' ||
    code === 'VERIFIER_MOCK_DISABLED' ||
    code === 'VERIFIER_NOT_IMPLEMENTED' ||
    code === 'VERIFIER_FIREBASE_RUNTIME_DISABLED'
  ) {
    return {
      allowed: false,
      code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED,
      reason: typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'auth verifier adapter is not implemented',
      userKey: null,
      userKeyHash: null,
    };
  }
  if (
    code === 'VERIFIER_CONFIG_MISSING' ||
    code === 'VERIFIER_FIREBASE_RUNTIME_FAILED'
  ) {
    return {
      allowed: false,
      code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE,
      reason: typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'auth verifier configuration is missing or runtime failed',
      userKey: null,
      userKeyHash: null,
    };
  }
  if (code === 'VERIFIER_FIREBASE_RUNTIME_VERIFIED') {
    const candidateHash = res.userKeyHash;
    if (!isValidSanitizedUserKeyHash(candidateHash)) {
      // A success code without a valid sanitized hash is treated as
      // an unknown / unsafe result and safe-fails.
      return {
        allowed: false,
        code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE,
        reason: 'verifier success result did not include a valid sanitized userKeyHash',
        userKey: null,
        userKeyHash: null,
      };
    }
    return {
      allowed: true,
      code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_RUNTIME_VERIFIED,
      reason: typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'auth verifier runtime accepted the token; only a sanitized userKeyHash is propagated',
      userKey: null,
      userKeyHash: candidateHash,
    };
  }
  // Unknown / missing code → generic verifier-unavailable safe-fail
  return {
    allowed: false,
    code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE,
    reason: typeof res.reason === 'string' && res.reason.length > 0
      ? res.reason
      : 'auth verifier adapter returned an unknown result',
    userKey: null,
    userKeyHash: null,
  };
}

/**
 * Build a verifyToken function that routes through the given verifier
 * adapter. The verifier payload is built from an allowlist only (no raw
 * token / authorization header / API key / firebaseToken / session cookie
 * / password / prompt / excerpt / sourceUrl / raw request body). Verifier
 * adapter exceptions are safe-swallowed to a safe-fail response.
 *
 * @param {Object} verifierAdapter - verifier adapter (must have verifyToken)
 * @returns {Function} async verifyToken function
 */
function buildVerifierRoutedVerifyToken(verifierAdapter, options) {
  const opts = (options && typeof options === 'object') ? options : {};
  const allowRawTokenHandoff = opts.allowRawTokenHandoff === true;
  return async function verifyToken(payload) {
    const safePayload = buildSafeVerifierPayload(payload, { allowRawTokenHandoff });
    let verifierResult;
    try {
      verifierResult = await verifierAdapter.verifyToken(safePayload);
    } catch {
      return {
        allowed: false,
        code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE,
        reason: 'auth verifier adapter threw an exception',
        userKey: null,
        userKeyHash: null,
      };
    }
    return mapVerifierResultToDependencyResponse(verifierResult);
  };
}

// ─── Factory: createScoutLiveDependencyAdapter ──────────────────────────────

/**
 * Create a Scout live dependency adapter.
 *
 * @param {Object} [options]
 * @param {boolean} [options.mockDisabled=true] when true (default), returns
 *   safe mock-disabled responses for verifyToken / checkRateLimit and a
 *   fake requestId. When false, returns "not implemented" responses from
 *   each method (real implementations will be added in future slices).
 * @param {Object} [options.storageAdapter] optional storage adapter
 *   dependency. When provided, checkRateLimit routes through
 *   `storageAdapter.checkQuota` with an allowlisted payload. When omitted,
 *   the canonical mock-disabled storage adapter
 *   (`createScoutLiveRateLimitStorageAdapter({ mockDisabled: true })`) is
 *   used as the default. The storage adapter itself is mock-disabled and
 *   does NOT access any real KV / Durable Object / D1 / database.
 * @param {Object} [options.verifierAdapter] optional auth verifier adapter
 *   dependency. When provided, verifyToken routes through
 *   `verifierAdapter.verifyToken` with an allowlisted payload. When
 *   omitted, the canonical mock-disabled verifier adapter
 *   (`createScoutLiveAuthVerifierAdapter({ mockDisabled: true })`) is
 *   used as the default. The verifier adapter itself is mock-disabled
 *   and does NOT access any real Firebase Admin SDK, `getAuth`,
 *   `verifyIdToken`, external auth service, or network call.
 * @param {boolean} [options.allowRawTokenHandoff] - guarded opt-in
 *   (issue #2571). When true, an `idToken` field present in the
 *   dependency-adapter verifyToken input is forwarded to the verifier
 *   adapter payload. When false or omitted (default), the dependency
 *   adapter strips any `idToken` and forwards derived fields only.
 * @returns {Object} adapter with verifyToken, checkRateLimit, requestId, and
 *   metadata (isMockDisabled, mode, version, storageAdapterKind,
 *   verifierAdapterKind).
 */
export function createScoutLiveDependencyAdapter(options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
  const mockDisabled = opts.mockDisabled !== false;
  const allowRawTokenHandoff = opts.allowRawTokenHandoff === true;
  const storageAdapter = (opts.storageAdapter && typeof opts.storageAdapter.checkQuota === 'function')
    ? opts.storageAdapter
    : createScoutLiveRateLimitStorageAdapter({ mockDisabled: true });
  const checkRateLimitFn = buildStorageRoutedCheckRateLimit(storageAdapter);
  const verifierAdapter = (opts.verifierAdapter && typeof opts.verifierAdapter.verifyToken === 'function')
    ? opts.verifierAdapter
    : createScoutLiveAuthVerifierAdapter({ mockDisabled: true });
  const verifyTokenFn = buildVerifierRoutedVerifyToken(verifierAdapter, { allowRawTokenHandoff });

  if (mockDisabled) {
    return Object.freeze({
      version: SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION,
      mode: SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES.MOCK_DISABLED,
      mockDisabled: true,
      isMockDisabled: true,
      storageAdapterKind: storageAdapter.kind || 'scout_live_rate_limit_storage_adapter',
      storageAdapterMockDisabled: storageAdapter.isMockDisabled === true,
      verifierAdapterKind: verifierAdapter.kind || 'scout_live_auth_verifier_adapter',
      verifierAdapterMockDisabled: verifierAdapter.isMockDisabled === true,
      verifyToken: verifyTokenFn,
      checkRateLimit: checkRateLimitFn,
      requestId: function requestId() {
        return makeMockDisabledRequestId();
      },
    });
  }

  return Object.freeze({
    version: SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION,
    mode: SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES.NOT_IMPLEMENTED,
    mockDisabled: false,
    isMockDisabled: false,
    storageAdapterKind: storageAdapter.kind || 'scout_live_rate_limit_storage_adapter',
    storageAdapterMockDisabled: storageAdapter.isMockDisabled === true,
    verifierAdapterKind: verifierAdapter.kind || 'scout_live_auth_verifier_adapter',
    verifierAdapterMockDisabled: verifierAdapter.isMockDisabled === true,
    verifyToken: verifyTokenFn,
    checkRateLimit: checkRateLimitFn,
    requestId: function requestId() {
      return buildNotImplementedRequestId();
    },
  });
}
