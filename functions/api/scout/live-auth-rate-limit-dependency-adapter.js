/**
 * Scout Live Auth / Rate-Limit Dependency Adapter Skeleton
 * v20260607-1
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
 *   (`isMockDisabled`, `mode`, `version`, `storageAdapterKind`).
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
 * - No wiring into suggest.js LIVE branch (separate slice)
 */

'use strict';

import { createScoutLiveRateLimitStorageAdapter } from './live-rate-limit-storage-adapter.js';

// ─── Version ────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION = '20260607-1';

// ─── Mode Constants ─────────────────────────────────────────────────────────

export const SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES = Object.freeze({
  MOCK_DISABLED: 'mock_disabled',
  NOT_IMPLEMENTED: 'not_implemented',
});

// ─── Response Codes ────────────────────────────────────────────────────────

export const SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES = Object.freeze({
  VERIFY_NOT_IMPLEMENTED: 'VERIFY_NOT_IMPLEMENTED',
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
// ever enters the storage payload. This allowlist is the single source of
// truth for safe payload fields at the dependency-adapter seam.
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
 * @returns {Object} adapter with verifyToken, checkRateLimit, requestId, and
 *   metadata (isMockDisabled, mode, version, storageAdapterKind).
 */
export function createScoutLiveDependencyAdapter(options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
  const mockDisabled = opts.mockDisabled !== false;
  const storageAdapter = (opts.storageAdapter && typeof opts.storageAdapter.checkQuota === 'function')
    ? opts.storageAdapter
    : createScoutLiveRateLimitStorageAdapter({ mockDisabled: true });
  const checkRateLimitFn = buildStorageRoutedCheckRateLimit(storageAdapter);

  if (mockDisabled) {
    return Object.freeze({
      version: SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION,
      mode: SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES.MOCK_DISABLED,
      mockDisabled: true,
      isMockDisabled: true,
      storageAdapterKind: storageAdapter.kind || 'scout_live_rate_limit_storage_adapter',
      storageAdapterMockDisabled: storageAdapter.isMockDisabled === true,
      verifyToken: async function verifyToken() {
        return buildMockDisabledVerifyResponse();
      },
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
    verifyToken: async function verifyToken() {
      return buildNotImplementedVerifyResponse();
    },
    checkRateLimit: checkRateLimitFn,
    requestId: function requestId() {
      return buildNotImplementedRequestId();
    },
  });
}
