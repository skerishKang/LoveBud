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
 * Provides:
 * - SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES: status / mode constants
 * - SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES: response code constants
 * - SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION: skeleton version
 * - createScoutLiveDependencyAdapter: returns a dependency adapter object
 *   with `verifyToken`, `checkRateLimit`, `requestId`, and metadata
 *   (`isMockDisabled`, `mode`, `version`).
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
});

// ─── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_OPTIONS = Object.freeze({
  mockDisabled: true,
});

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

// ─── Factory: createScoutLiveDependencyAdapter ──────────────────────────────

/**
 * Create a Scout live dependency adapter.
 *
 * @param {Object} [options]
 * @param {boolean} [options.mockDisabled=true] when true (default), returns
 *   safe mock-disabled responses for verifyToken / checkRateLimit and a
 *   fake requestId. When false, returns "not implemented" responses from
 *   each method (real implementations will be added in future slices).
 * @returns {Object} adapter with verifyToken, checkRateLimit, requestId, and
 *   metadata (isMockDisabled, mode, version).
 */
export function createScoutLiveDependencyAdapter(options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
  const mockDisabled = opts.mockDisabled !== false;

  if (mockDisabled) {
    return Object.freeze({
      version: SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION,
      mode: SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES.MOCK_DISABLED,
      isMockDisabled: true,
      verifyToken: async function verifyToken() {
        return buildMockDisabledVerifyResponse();
      },
      checkRateLimit: async function checkRateLimit() {
        return buildMockDisabledRateLimitResponse();
      },
      requestId: function requestId() {
        return makeMockDisabledRequestId();
      },
    });
  }

  return Object.freeze({
    version: SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION,
    mode: SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES.NOT_IMPLEMENTED,
    isMockDisabled: false,
    verifyToken: async function verifyToken() {
      return buildNotImplementedVerifyResponse();
    },
    checkRateLimit: async function checkRateLimit() {
      return buildNotImplementedRateLimitResponse();
    },
    requestId: function requestId() {
      return buildNotImplementedRequestId();
    },
  });
}
