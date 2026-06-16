/**
 * Scout Live Rate-Limit Storage Adapter Skeleton + Runtime Key Output Scaffold
 * v20260616-runtime-output-1
 *
 * Slice issue: #2575
 * Parent issue: #1882 (must remain OPEN; never auto-close)
 *
 * Mock-disabled storage adapter skeleton for the Scout live provider path.
 * Provides a future interface for persistent rate-limit quota state
 * (KV / Durable Object / D1) without actually accessing any external
 * storage in this slice.
 *
 * Slice #2575 binds the non-default runtime scaffold path to the key
 * builder's runtime key output. The default path remains mock_disabled
 * and never calls the runtime key builder. The explicit runtime scaffold
 * path may opt into the runtime key builder via `runtimeKey: true`, in
 * which case the adapter propagates successful STORAGE_KEY_BUILT results
 * as sanitized adapter metadata only — never as a quota allow decision.
 *
 * Provides:
 * - SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION: skeleton version
 * - SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES: response mode constants
 * - SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES: response code constants
 * - SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_ALLOWED_FIELDS: allowlist
 * - SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_PROHIBITED_FIELDS: denylist
 * - sanitizeScoutLiveRateLimitStoragePayload: pure helper that strips
 *   prohibited fields from a payload
 * - createScoutLiveRateLimitStorageAdapter: factory
 *
 * This module is a **mock-disabled skeleton + factory**. No KV, no
 * Durable Object, no D1, no database, no fetch invocation, no env storage
 * binding is accessed. No real storage call is made. The factory returns
 * safe "not implemented" / "mock-disabled" / runtime scaffold disabled
 * responses from each method so the endpoint can never accidentally read
 * or write real storage while the skeleton is in place.
 *
 * Non-goals:
 * - No real LLM provider call
 * - No provider SDK import
 * - No Firebase Admin SDK import
 * - No Firebase token verification
 * - No persistent rate-limit storage call
 * - No external URL call
 * - No auto-save or persistence
 * - No env storage binding access
 * - No wiring into suggest.js LIVE branch (separate slice)
 * - No real quota persistence
 * - No real allow/deny decision backed by storage
 * - No closing of #1882
 */

'use strict';

import {
  createScoutLiveRateLimitStorageKeyBuilder,
  SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES,
} from './live-rate-limit-storage-key-builder.js';

// ─── Version ────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION = '20260616-runtime-output-1';

// ─── Storage Mode Constants ────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES = Object.freeze({
  MOCK_DISABLED: 'mock_disabled',
  NOT_IMPLEMENTED: 'not_implemented',
  KV_DISABLED: 'kv_disabled',
  DURABLE_OBJECT_DISABLED: 'durable_object_disabled',
  D1_DISABLED: 'd1_disabled',
  STORAGE_CONFIG_MISSING: 'storage_config_missing',
});

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_MODES = SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES;

// ─── Response Codes ────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES = Object.freeze({
  STORAGE_MOCK_DISABLED: 'STORAGE_MOCK_DISABLED',
  STORAGE_NOT_IMPLEMENTED: 'STORAGE_NOT_IMPLEMENTED',
  STORAGE_PAYLOAD_PROHIBITED: 'STORAGE_PAYLOAD_PROHIBITED',
  STORAGE_KEY_BUILDER_DISABLED: 'STORAGE_KEY_BUILDER_DISABLED',
  STORAGE_KEY_PAYLOAD_PROHIBITED: 'STORAGE_KEY_PAYLOAD_PROHIBITED',
  STORAGE_KV_DISABLED: 'STORAGE_KV_DISABLED',
  STORAGE_DURABLE_OBJECT_DISABLED: 'STORAGE_DURABLE_OBJECT_DISABLED',
  STORAGE_D1_DISABLED: 'STORAGE_D1_DISABLED',
  STORAGE_CONFIG_MISSING: 'STORAGE_CONFIG_MISSING',
});

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_CODES = SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES;

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
  'authorizationHeader',
  'apiKey',
  'secret',
  'prompt',
  'excerpt',
  'sourceUrl',
  'rawRequestBody',
  'rawProviderResponse',
  'rawModelOutput',
  'rawStorageKey',
  'rawUserIdentifier',
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
  storageMode: null,
  storageKeyBuilder: null,
  runtimeKey: false,
  runtimeKeyKind: null,
  onProhibitedField: 'drop', // 'drop' | 'reject'
});

const STORAGE_MODE_ALIASES = Object.freeze({
  kv: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.KV_DISABLED,
  kv_disabled: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.KV_DISABLED,
  durable_object: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.DURABLE_OBJECT_DISABLED,
  durable_object_disabled: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.DURABLE_OBJECT_DISABLED,
  d1: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.D1_DISABLED,
  d1_disabled: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.D1_DISABLED,
});

const STORAGE_RUNTIME_SCAFFOLD_MODE_CODES = Object.freeze({
  [SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.KV_DISABLED]: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KV_DISABLED,
  [SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.DURABLE_OBJECT_DISABLED]: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_DURABLE_OBJECT_DISABLED,
  [SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.D1_DISABLED]: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_D1_DISABLED,
  [SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.STORAGE_CONFIG_MISSING]: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_CONFIG_MISSING,
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

function getRuntimeScaffoldCode(mode) {
  return STORAGE_RUNTIME_SCAFFOLD_MODE_CODES[mode] || SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_CONFIG_MISSING;
}

function getRuntimeScaffoldReason(mode) {
  if (mode === SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.STORAGE_CONFIG_MISSING) {
    return 'Live rate-limit storage runtime scaffold is disabled or not configured; no real storage is accessed.';
  }
  return 'Live rate-limit storage runtime scaffold is disabled-by-default; no real storage is accessed.';
}

function resolveDisabledStorageKeyBuilder(options) {
  const injectedBuilder = options && options.storageKeyBuilder;
  if (injectedBuilder && typeof injectedBuilder.buildKey === 'function') {
    return injectedBuilder;
  }

  // Slice #2575: when the adapter is explicitly opted into the runtime key
  // builder (runtimeKey: true), the resolved builder is created with
  // runtime mode enabled. Default is runtimeKey: false, which preserves
  // the existing disabled buildKey() path.
  if (options && options.runtimeKey === true) {
    return createScoutLiveRateLimitStorageKeyBuilder({
      disabled: false,
      runtime: true,
      kind: options.runtimeKeyKind || null,
      onProhibitedField: options && options.onProhibitedField,
    });
  }

  return createScoutLiveRateLimitStorageKeyBuilder({
    disabled: true,
    onProhibitedField: options && options.onProhibitedField,
  });
}

function normalizeStorageKeyBuilderResult(result) {
  const src = result && typeof result === 'object' ? result : {};
  const code = src.code || SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_BUILDER_DISABLED;
  const isBuilt = code === SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_BUILT;

  // Legacy safe-fail response shape (preserved for the disabled / non-built
  // path): ok: false, disabled: true, storageKey: null, keyPreview: null.
  if (!isBuilt) {
    return {
      ok: false,
      disabled: true,
      code,
      storageKey: null,
      keyPreview: null,
      rejectedFields: Array.isArray(src.rejectedFields) ? src.rejectedFields : [],
    };
  }

  // STORAGE_KEY_BUILT path (slice #2575): propagate sanitized key builder
  // output. The adapter still does NOT treat this as a quota allow.
  return {
    ok: true,
    disabled: false,
    code,
    storageKey: typeof src.storageKey === 'string' ? src.storageKey : null,
    keyPreview: typeof src.keyPreview === 'string' ? src.keyPreview : null,
    rejectedFields: Array.isArray(src.rejectedFields) ? src.rejectedFields : [],
  };
}

function buildRuntimeScaffoldCheckResponse(mode, keyBuilderResult) {
  const normalizedKeyBuilderResult = normalizeStorageKeyBuilderResult(keyBuilderResult);
  return {
    allowed: false,
    code: normalizedKeyBuilderResult.code === SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_PAYLOAD_PROHIBITED
      ? SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KEY_PAYLOAD_PROHIBITED
      : getRuntimeScaffoldCode(mode),
    mode,
    reason: getRuntimeScaffoldReason(mode),
    retryAfterSeconds: null,
    remaining: null,
    storageKeyBuilder: normalizedKeyBuilderResult,
  };
}

function buildRuntimeScaffoldConsumeResponse(mode, keyBuilderResult) {
  const normalizedKeyBuilderResult = normalizeStorageKeyBuilderResult(keyBuilderResult);
  return {
    allowed: false,
    code: normalizedKeyBuilderResult.code === SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_PAYLOAD_PROHIBITED
      ? SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KEY_PAYLOAD_PROHIBITED
      : getRuntimeScaffoldCode(mode),
    mode,
    reason: getRuntimeScaffoldReason(mode),
    storageKeyBuilder: normalizedKeyBuilderResult,
  };
}

function buildRuntimeScaffoldReleaseResponse(mode, keyBuilderResult) {
  const normalizedKeyBuilderResult = normalizeStorageKeyBuilderResult(keyBuilderResult);
  return {
    released: false,
    code: normalizedKeyBuilderResult.code === SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_PAYLOAD_PROHIBITED
      ? SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KEY_PAYLOAD_PROHIBITED
      : getRuntimeScaffoldCode(mode),
    mode,
    reason: getRuntimeScaffoldReason(mode),
    storageKeyBuilder: normalizedKeyBuilderResult,
  };
}

function hasExplicitStorageModeOption(options) {
  return !!options && Object.prototype.hasOwnProperty.call(options, 'storageMode');
}

function resolveStorageMode(options, explicitStorageMode) {
  if (!explicitStorageMode) {
    return SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.NOT_IMPLEMENTED;
  }

  const rawMode = options && options.storageMode;
  const normalizedMode = String(rawMode || '').trim();

  if (!normalizedMode) {
    return SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.STORAGE_CONFIG_MISSING;
  }

  return STORAGE_MODE_ALIASES[normalizedMode] || SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.STORAGE_CONFIG_MISSING;
}

function isRuntimeScaffoldMode(mode) {
  return mode === SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.KV_DISABLED ||
    mode === SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.DURABLE_OBJECT_DISABLED ||
    mode === SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.D1_DISABLED ||
    mode === SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.STORAGE_CONFIG_MISSING;
}

function createRuntimeScaffoldAdapter(opts, mode) {
  const storageKeyBuilder = resolveDisabledStorageKeyBuilder(opts);
  const useRuntimeKey = opts.runtimeKey === true;

  return Object.freeze({
    kind: 'scout_live_rate_limit_storage_adapter',
    version: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION,
    mode,
    storageMode: mode,
    mockDisabled: false,
    isMockDisabled: false,
    isRuntimeScaffold: true,
    hasStorageKeyBuilder: true,
    useRuntimeKeyBuilder: useRuntimeKey,
    onProhibitedField: opts.onProhibitedField,

    async checkQuota(payload) {
      const keyBuilderResult = useRuntimeKey
        ? storageKeyBuilder.buildKeyInRuntimeMode(payload)
        : storageKeyBuilder.buildKey(payload);
      return buildRuntimeScaffoldCheckResponse(mode, keyBuilderResult);
    },

    async consumeQuota(payload) {
      const keyBuilderResult = useRuntimeKey
        ? storageKeyBuilder.buildKeyInRuntimeMode(payload)
        : storageKeyBuilder.buildKey(payload);
      return buildRuntimeScaffoldConsumeResponse(mode, keyBuilderResult);
    },

    async releaseQuota(payload) {
      const keyBuilderResult = useRuntimeKey
        ? storageKeyBuilder.buildKeyInRuntimeMode(payload)
        : storageKeyBuilder.buildKey(payload);
      return buildRuntimeScaffoldReleaseResponse(mode, keyBuilderResult);
    },

    sanitizePayload: sanitizeScoutLiveRateLimitStoragePayload,
  });
}

// ─── Factory: createScoutLiveRateLimitStorageAdapter ──────────────────────

/**
 * Create a Scout live rate-limit storage adapter.
 *
 * @param {Object} [options]
 * @param {boolean} [options.mockDisabled=true] when true (default), returns
 *   safe mock-disabled responses from checkQuota / consumeQuota /
 *   releaseQuota. When false without storageMode, returns "not implemented"
 *   responses. When false with explicit storageMode of kv / durable_object /
 *   d1, returns a disabled-by-default runtime scaffold that still safe-fails
 *   without touching storage.
 * @param {string} [options.storageMode] explicit future runtime storage mode
 * @param {Object} [options.storageKeyBuilder] optional disabled key builder seam
 * @param {string} [options.onProhibitedField='drop'] - 'drop' or 'reject'
 * @returns {Object} frozen adapter
 */
export function createScoutLiveRateLimitStorageAdapter(options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
  const mockDisabled = opts.mockDisabled !== false;
  const explicitStorageMode = hasExplicitStorageModeOption(options || {});
  const resolvedStorageMode = resolveStorageMode(opts, explicitStorageMode);

  if (mockDisabled) {
    return Object.freeze({
      kind: 'scout_live_rate_limit_storage_adapter',
      version: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION,
      mode: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.MOCK_DISABLED,
      storageMode: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.MOCK_DISABLED,
      mockDisabled: true,
      isMockDisabled: true,
      isRuntimeScaffold: false,
      hasStorageKeyBuilder: false,
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

  if (isRuntimeScaffoldMode(resolvedStorageMode)) {
    return createRuntimeScaffoldAdapter(opts, resolvedStorageMode);
  }

  return Object.freeze({
    kind: 'scout_live_rate_limit_storage_adapter',
    version: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION,
    mode: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.NOT_IMPLEMENTED,
    storageMode: SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.NOT_IMPLEMENTED,
    mockDisabled: false,
    isMockDisabled: false,
    isRuntimeScaffold: false,
    hasStorageKeyBuilder: false,
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
