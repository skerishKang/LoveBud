/**
 * Scout Live Auth / Rate-Limit Dependency Adapter Skeleton
 * v20260607-2
 *
 * Mock-disabled dependency adapter skeleton for the Scout live provider path.
 * Provides a factory that returns default implementations of `verifyToken`,
 * `checkRateLimit`, and `requestId` for the DI seam established in
 * `functions/api/scout/suggest.js` LIVE branch.
 *
 * This module is a mock-disabled skeleton. It maps storage adapter safe-fail
 * results, including disabled storage key builder results, into
 * dependency-adapter safe-fail shapes. It does not access real Firebase Admin,
 * KV, Durable Object, D1, fetch, provider SDKs, or provider APIs.
 */

'use strict';

import { createScoutLiveRateLimitStorageAdapter } from './live-rate-limit-storage-adapter.js';
import { createScoutLiveAuthVerifierAdapter } from './live-auth-verifier-adapter.js';

// ─── Version ────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION = '20260607-2';

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
  RATE_LIMIT_NOT_IMPLEMENTED: 'RATE_LIMIT_NOT_IMPLEMENTED',
  RATE_LIMIT_PAYLOAD_PROHIBITED: 'RATE_LIMIT_PAYLOAD_PROHIBITED',
  RATE_LIMIT_STORAGE_UNAVAILABLE: 'RATE_LIMIT_STORAGE_UNAVAILABLE',
});

// ─── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_OPTIONS = Object.freeze({
  mockDisabled: true,
});

// ─── Payload Allowlists ─────────────────────────────────────────────────────

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

const AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS = Object.freeze([
  'requestId',
  'tokenHash',
  'authorizationScheme',
  'providerMode',
  'endpointPath',
  'nowMs',
]);

function buildAllowlistedPayload(input, allowedFields) {
  const src = (input && typeof input === 'object') ? input : {};
  const out = {};
  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
      out[key] = src[key];
    }
  }
  return out;
}

function buildSafeStoragePayload(input) {
  return buildAllowlistedPayload(input, STORAGE_PAYLOAD_ALLOWED_FIELDS);
}

function buildSafeVerifierPayload(input) {
  return buildAllowlistedPayload(input, AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS);
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function makeMockDisabledRequestId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return 'req_mock_disabled_' + ts + '_' + rand;
}

function buildNotImplementedRequestId() {
  return 'req_not_implemented_' + Date.now().toString(36);
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

// ─── Storage-to-Dependency Response Mapping ─────────────────────────────────

function buildRateLimitResponse(code, reason, retryAfterSeconds) {
  return {
    allowed: false,
    code,
    reason,
    retryAfterSeconds: retryAfterSeconds == null ? null : retryAfterSeconds,
  };
}

/**
 * Map a storage adapter result to a dependency-adapter safe-fail shape.
 * Storage key builder safe-fail codes are intentionally collapsed to the
 * generic RATE_LIMIT_STORAGE_UNAVAILABLE dependency boundary so endpoint
 * responses do not expose raw key-builder fields or storage internals.
 *
 * @param {Object} storageResult - result from storageAdapter.checkQuota
 * @returns {Object} dependency-adapter safe-fail response
 */
function mapStorageResultToDependencyResponse(storageResult) {
  const res = (storageResult && typeof storageResult === 'object') ? storageResult : {};
  const code = res.code;

  if (code === 'STORAGE_PAYLOAD_PROHIBITED') {
    return buildRateLimitResponse(
      SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_PAYLOAD_PROHIBITED,
      typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'rate-limit payload contained prohibited fields',
      null,
    );
  }

  if (code === 'STORAGE_NOT_IMPLEMENTED') {
    return buildRateLimitResponse(
      SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED,
      typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'rate-limit storage adapter is not implemented',
      null,
    );
  }

  if (code === 'STORAGE_MOCK_DISABLED') {
    return buildRateLimitResponse(
      SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED,
      typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'rate-limit storage adapter is mock-disabled',
      null,
    );
  }

  if (
    code === 'STORAGE_KV_DISABLED' ||
    code === 'STORAGE_DURABLE_OBJECT_DISABLED' ||
    code === 'STORAGE_D1_DISABLED' ||
    code === 'STORAGE_CONFIG_MISSING' ||
    code === 'STORAGE_KEY_BUILDER_DISABLED' ||
    code === 'STORAGE_KEY_PAYLOAD_PROHIBITED'
  ) {
    return buildRateLimitResponse(
      SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE,
      typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'rate-limit storage scaffold is disabled or not configured',
      null,
    );
  }

  return buildRateLimitResponse(
    SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE,
    typeof res.reason === 'string' && res.reason.length > 0
      ? res.reason
      : 'rate-limit storage adapter returned an unknown result',
    null,
  );
}

function buildStorageRoutedCheckRateLimit(storageAdapter) {
  return async function checkRateLimit(payload) {
    const safePayload = buildSafeStoragePayload(payload);
    let storageResult;
    try {
      storageResult = await storageAdapter.checkQuota(safePayload);
    } catch {
      return buildRateLimitResponse(
        SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE,
        'rate-limit storage adapter threw an exception',
        null,
      );
    }
    return mapStorageResultToDependencyResponse(storageResult);
  };
}

// ─── Verifier-to-Dependency Response Mapping ───────────────────────────────

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

  if (code === 'VERIFIER_FIREBASE_DISABLED' || code === 'VERIFIER_MOCK_DISABLED' || code === 'VERIFIER_NOT_IMPLEMENTED') {
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

  if (code === 'VERIFIER_CONFIG_MISSING') {
    return {
      allowed: false,
      code: SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_UNAVAILABLE,
      reason: typeof res.reason === 'string' && res.reason.length > 0
        ? res.reason
        : 'auth verifier configuration is missing',
      userKey: null,
      userKeyHash: null,
    };
  }

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

function buildVerifierRoutedVerifyToken(verifierAdapter) {
  return async function verifyToken(payload) {
    const safePayload = buildSafeVerifierPayload(payload);
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
 *   fake requestId. When false, routes through injected or default mock
 *   storage/verifier adapters.
 * @param {Object} [options.storageAdapter] optional storage adapter dependency.
 * @param {Object} [options.verifierAdapter] optional auth verifier adapter dependency.
 * @returns {Object} adapter with verifyToken, checkRateLimit, requestId, and metadata.
 */
export function createScoutLiveDependencyAdapter(options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
  const mockDisabled = opts.mockDisabled !== false;
  const storageAdapter = (opts.storageAdapter && typeof opts.storageAdapter.checkQuota === 'function')
    ? opts.storageAdapter
    : createScoutLiveRateLimitStorageAdapter({ mockDisabled: true });
  const checkRateLimitFn = buildStorageRoutedCheckRateLimit(storageAdapter);
  const verifierAdapter = (opts.verifierAdapter && typeof opts.verifierAdapter.verifyToken === 'function')
    ? opts.verifierAdapter
    : createScoutLiveAuthVerifierAdapter({ mockDisabled: true });
  const verifyTokenFn = buildVerifierRoutedVerifyToken(verifierAdapter);

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
