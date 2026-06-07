/**
 * Scout Live Auth Verifier Adapter Skeleton
 * v20260607-1
 *
 * Mock-disabled auth verifier adapter skeleton for the Scout live provider
 * path. Provides a future interface for Firebase-style auth token
 * verification (e.g. Firebase Admin SDK `verifyIdToken`, or an equivalent
 * custom auth service) **without** actually calling any external auth
 * backend in this slice.
 *
 * Provides:
 * - SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION: skeleton version
 * - SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES: status / mode constants
 * - SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES: response code constants
 * - SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS: allowlist for
 *   future-safe fields that may be present in a verifier payload
 * - SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_PROHIBITED_FIELDS: denylist for
 *   sensitive fields that must never enter a verifier payload, response,
 *   log, or storage record
 * - sanitizeScoutLiveAuthVerifierPayload: pure helper that strips
 *   prohibited fields from a verifier payload (drop or reject modes)
 * - createScoutLiveAuthVerifierAdapter: factory
 *
 * This module is a **mock-disabled skeleton + factory**. No Firebase
 * Admin SDK, no `getAuth`, no `verifyIdToken`, no external auth service,
 * no fetch, no env auth binding is accessed. The factory returns safe
 * "mock-disabled" or "not-implemented" responses from `verifyToken` so
 * the endpoint can never accidentally verify a real token while the
 * skeleton is in place.
 *
 * Non-goals:
 * - No real LLM provider call
 * - No provider SDK import
 * - No Firebase Admin SDK import
 * - No Firebase token verification
 * - No getAuth / verifyIdToken / cert / initializeApp call
 * - No external auth service call
 * - No fetch / XMLHttpRequest / axios
 * - No env auth binding access
 * - No raw token, authorization header, API key, or session cookie
 *   in any response, log, or storage payload
 * - No wiring into suggest.js LIVE branch (separate slice)
 */

'use strict';

// ─── Version ────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION = '20260607-1';

// ─── Verifier Mode Constants ────────────────────────────────────────────────

export const SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES = Object.freeze({
  MOCK_DISABLED: 'mock_disabled',
  NOT_IMPLEMENTED: 'not_implemented',
});

// ─── Response Codes ─────────────────────────────────────────────────────────

export const SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES = Object.freeze({
  VERIFIER_MOCK_DISABLED: 'VERIFIER_MOCK_DISABLED',
  VERIFIER_NOT_IMPLEMENTED: 'VERIFIER_NOT_IMPLEMENTED',
  VERIFIER_PAYLOAD_PROHIBITED: 'VERIFIER_PAYLOAD_PROHIBITED',
});

// ─── Payload Policy ─────────────────────────────────────────────────────────

// Only future-safe, derived, non-sensitive fields are allowed to enter a
// verifier payload. A token hash, scheme, request id, or a generated
// nonce is acceptable; the raw token, raw authorization header, raw API
// key, or raw request body is not.
export const SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS = Object.freeze([
  'requestId',
  'tokenHash',
  'authorizationScheme',
  'providerMode',
  'endpointPath',
  'nowMs',
]);

// Sensitive fields that must never be returned, logged, persisted, or
// routed through the verifier payload. The list is the single source
// of truth at the verifier seam; sanitizePayload enforces it.
export const SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_PROHIBITED_FIELDS = Object.freeze([
  'token',
  'rawToken',
  'authorization',
  'authorizationHeader',
  'apiKey',
  'secret',
  'password',
  'cookie',
  'sessionCookie',
  'firebaseToken',
  'openaiApiKey',
  'anthropicApiKey',
  'geminiApiKey',
  'groqApiKey',
  'mistralApiKey',
  'nvidiaApiKey',
  'prompt',
  'excerpt',
  'sourceUrl',
  'rawRequestBody',
]);

// ─── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_OPTIONS = Object.freeze({
  mockDisabled: true,
  onProhibitedField: 'drop', // 'drop' | 'reject'
});

// ─── Pure Helper: sanitizeScoutLiveAuthVerifierPayload ──────────────────────

/**
 * Pure helper: strip prohibited fields from an auth verifier payload.
 * Returns a new object with only allowed fields. Prohibited fields are
 * dropped (default) or cause the helper to return a rejection result.
 *
 * @param {Object} payload
 * @param {Object} [options]
 * @param {string} [options.onProhibitedField='drop'] - 'drop' or 'reject'
 * @returns {Object} { payload: sanitized, rejected: boolean, rejectedFields: string[] }
 */
export function sanitizeScoutLiveAuthVerifierPayload(payload, options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
  const src = (payload && typeof payload === 'object') ? payload : {};
  const out = {};
  const rejectedFields = [];

  for (const key of Object.keys(src)) {
    if (SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_PROHIBITED_FIELDS.includes(key)) {
      rejectedFields.push(key);
      if (opts.onProhibitedField === 'reject') {
        // Reject immediately: return empty payload with rejected flag
        return { payload: {}, rejected: true, rejectedFields };
      }
      // 'drop': skip this field
      continue;
    }
    // Only copy allowed fields
    if (SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS.includes(key)) {
      out[key] = src[key];
    }
    // Unknown fields are also dropped (allowlist-only)
  }

  return { payload: out, rejected: false, rejectedFields };
}

// ─── Internal Response Builders ─────────────────────────────────────────────

function buildMockDisabledVerifyResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_MOCK_DISABLED,
    reason: 'Live auth verifier adapter is mock-disabled; no real verification is performed.',
    userKey: null,
    userKeyHash: null,
  };
}

function buildNotImplementedVerifyResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_NOT_IMPLEMENTED,
    reason: 'Live auth verifier adapter is not implemented; real verification is required.',
    userKey: null,
    userKeyHash: null,
  };
}

// ─── Factory: createScoutLiveAuthVerifierAdapter ────────────────────────────

/**
 * Create a Scout live auth verifier adapter.
 *
 * @param {Object} [options]
 * @param {boolean} [options.mockDisabled=true] when true (default), returns
 *   safe mock-disabled responses from verifyToken. When false, returns
 *   "not implemented" responses (real implementations will be added in
 *   future slices).
 * @param {string} [options.onProhibitedField='drop'] - 'drop' or 'reject'
 * @returns {Object} frozen adapter
 */
export function createScoutLiveAuthVerifierAdapter(options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
  const mockDisabled = opts.mockDisabled !== false;

  if (mockDisabled) {
    return Object.freeze({
      kind: 'scout_live_auth_verifier_adapter',
      version: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION,
      mode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.MOCK_DISABLED,
      mockDisabled: true,
      isMockDisabled: true,
      onProhibitedField: opts.onProhibitedField,

      async verifyToken(_payload) {
        return buildMockDisabledVerifyResponse();
      },

      sanitizePayload: sanitizeScoutLiveAuthVerifierPayload,
    });
  }

  return Object.freeze({
    kind: 'scout_live_auth_verifier_adapter',
    version: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION,
    mode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.NOT_IMPLEMENTED,
    mockDisabled: false,
    isMockDisabled: false,
    onProhibitedField: opts.onProhibitedField,

    async verifyToken(_payload) {
      return buildNotImplementedVerifyResponse();
    },

    sanitizePayload: sanitizeScoutLiveAuthVerifierPayload,
  });
}
