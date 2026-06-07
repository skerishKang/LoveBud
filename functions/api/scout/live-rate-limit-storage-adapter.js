/**
 * Scout Live Rate-Limit Storage Adapter Skeleton
 * v20260607-1
 *
 * Mock-disabled storage adapter skeleton for the Scout live provider path.
 * Provides a future interface for persistent rate-limit quota state
 * (KV / Durable Object / D1) without actually accessing any external
 * storage in this slice.
 *
 * Provides:
 * - SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION: skeleton version
 * - SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES: response code constants
 * - SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_ALLOWED_FIELDS: allowlist
 * - SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_PROHIBITED_FIELDS: denylist
 * - sanitizeScoutLiveRateLimitStoragePayload: pure helper that strips
 *   prohibited fields from a payload
 * - createScoutLiveRateLimitStorageAdapter: factory
 *
 * This module is a **mock-disabled skeleton + factory**. No KV, no
 * Durable Object, no D1, no database, no fetch, no env storage binding
 * is accessed. No real storage call is made. The factory returns
 * safe "not implemented" / "mock-disabled" responses from each method
 * so the endpoint can never accidentally read or write real storage
 * while the skeleton is in place.
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
 * - No env storage binding access
 * - No wiring into suggest.js LIVE branch (separate slice)
 */

'use strict';

// ─── Version ────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION = '20260607-1';

// ─── Storage Mode Constants ────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES = Object.freeze({
  MOCK_DISABLED: 'mock_disabled',
  NOT_IMPLEMENTED: 'not_implemented',
});

// ─── Response Codes ────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES = Object.freeze({
  STORAGE_MOCK_DISABLED: 'STORAGE_MOCK_DISABLED',
  STORAGE_NOT_IMPLEMENTED: 'STORAGE_NOT_IMPLEMENTED',
  STORAGE_PAYLOAD_PROHIBITED: 'STORAGE_PAYLOAD_PROHIBITED',
});

// ─── Payload Policy ────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_ALLOWED_FIELDS = Object.freeze([
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

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_PROHIBITED_FIELDS = Object.freeze([
  'token',
  'rawToken',
  'authorization',
  'apiKey',
  'secret',
  'prompt',
  'excerpt',
  'sourceUrl',
  'rawRequestBody',
  'rawProviderResponse',
  'rawModelOutput',
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
]);

// ─── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_OPTIONS = Object.freeze({
  mockDisabled: true,
  onProhibitedField: 'drop', // 'drop' | 'reject'
});

// ─── Pure Helper: sanitizeScoutLiveRateLimitStoragePayload ─────────────────

/**
 * Pure helper: strip prohibited fields from a storage payload.
 * Returns a new object with only allowed fields. Prohibited fields are
 * dropped (default) or cause the helper to return a rejection result.
 *
 * @param {Object} payload
 * @param {Object} [options]
 * @param {string} [options.onProhibitedField='drop'] - 'drop' or 'reject'
 * @returns {Object} { payload: sanitized, rejected: boolean, rejectedFields: string[] }
 */
export function sanitizeScoutLiveRateLimitStoragePayload(payload, options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
  const src = (payload && typeof payload === 'object') ? payload : {};
  const out = {};
  const rejectedFields = [];

  for (const key of Object.keys(src)) {
    if (SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_PROHIBITED_FIELDS.includes(key)) {
      rejectedFields.push(key);
      if (opts.onProhibitedField === 'reject') {
        // Reject immediately: return empty payload with rejected flag
        return { payload: {}, rejected: true, rejectedFields };
      }
      // 'drop': skip this field
      continue;
    }
    // Only copy allowed fields
    if (SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_ALLOWED_FIELDS.includes(key)) {
      out[key] = src[key];
    }
    // Unknown fields are also dropped (allowlist-only)
  }

  return { payload: out, rejected: false, rejectedFields };
}

// ─── Internal Response Builders ─────────────────────────────────────────────

function buildMockDisabledCheckResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED,
    reason: 'Live rate-limit storage adapter is mock-disabled; no real storage is accessed.',
    retryAfterSeconds: null,
    remaining: null,
  };
}

function buildMockDisabledConsumeResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED,
    reason: 'Live rate-limit storage adapter is mock-disabled; no real storage is accessed.',
  };
}

function buildMockDisabledReleaseResponse() {
  return {
    released: false,
    code: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED,
    reason: 'Live rate-limit storage adapter is mock-disabled; no real storage is accessed.',
  };
}

function buildNotImplementedCheckResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_NOT_IMPLEMENTED,
    reason: 'Live rate-limit storage adapter is not implemented; real implementation is required.',
    retryAfterSeconds: null,
    remaining: null,
  };
}

function buildNotImplementedConsumeResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_NOT_IMPLEMENTED,
    reason: 'Live rate-limit storage adapter is not implemented; real implementation is required.',
  };
}

function buildNotImplementedReleaseResponse() {
  return {
    released: false,
    code: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_NOT_IMPLEMENTED,
    reason: 'Live rate-limit storage adapter is not implemented; real implementation is required.',
  };
}

// ─── Factory: createScoutLiveRateLimitStorageAdapter ──────────────────────

/**
 * Create a Scout live rate-limit storage adapter.
 *
 * @param {Object} [options]
 * @param {boolean} [options.mockDisabled=true] when true (default), returns
 *   safe mock-disabled responses from checkQuota / consumeQuota /
 *   releaseQuota. When false, returns "not implemented" responses
 *   (real implementations will be added in future slices).
 * @param {string} [options.onProhibitedField='drop'] - 'drop' or 'reject'
 * @returns {Object} frozen adapter
 */
export function createScoutLiveRateLimitStorageAdapter(options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
  const mockDisabled = opts.mockDisabled !== false;

  if (mockDisabled) {
    return Object.freeze({
      kind: 'scout_live_rate_limit_storage_adapter',
      version: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION,
      mode: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.MOCK_DISABLED,
      mockDisabled: true,
      isMockDisabled: true,
      onProhibitedField: opts.onProhibitedField,

      async checkQuota(_payload) {
        return buildMockDisabledCheckResponse();
      },

      async consumeQuota(_payload) {
        return buildMockDisabledConsumeResponse();
      },

      async releaseQuota(_payload) {
        return buildMockDisabledReleaseResponse();
      },

      sanitizePayload: sanitizeScoutLiveRateLimitStoragePayload,
    });
  }

  return Object.freeze({
    kind: 'scout_live_rate_limit_storage_adapter',
    version: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION,
    mode: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.NOT_IMPLEMENTED,
    mockDisabled: false,
    isMockDisabled: false,
    onProhibitedField: opts.onProhibitedField,

    async checkQuota(_payload) {
      return buildNotImplementedCheckResponse();
    },

    async consumeQuota(_payload) {
      return buildNotImplementedConsumeResponse();
    },

    async releaseQuota(_payload) {
      return buildNotImplementedReleaseResponse();
    },

    sanitizePayload: sanitizeScoutLiveRateLimitStoragePayload,
  });
}
