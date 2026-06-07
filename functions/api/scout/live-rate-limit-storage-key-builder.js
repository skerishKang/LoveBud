/**
 * Scout Live Rate-Limit Storage Key Builder — Disabled Scaffold
 * v20260607-1
 *
 * Disabled-by-default scaffold for future Scout live rate-limit storage key
 * construction. This module intentionally does not generate usable runtime
 * storage keys for live traffic and does not access hashing secrets, salts,
 * KV, Durable Object, D1, provider SDKs, network fetch, or endpoint state.
 */

'use strict';

// ─── Version ────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_VERSION = '20260607-1';

// ─── Modes ──────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_MODES = Object.freeze({
  DISABLED: 'disabled',
  NOT_IMPLEMENTED: 'not_implemented',
});

// ─── Codes ──────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES = Object.freeze({
  STORAGE_KEY_BUILDER_DISABLED: 'STORAGE_KEY_BUILDER_DISABLED',
  STORAGE_KEY_BUILDER_NOT_IMPLEMENTED: 'STORAGE_KEY_BUILDER_NOT_IMPLEMENTED',
  STORAGE_KEY_PAYLOAD_PROHIBITED: 'STORAGE_KEY_PAYLOAD_PROHIBITED',
});

// ─── Payload Policy ─────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_ALLOWED_INPUTS = Object.freeze([
  'userKeyHash',
  'ipHash',
  'sessionKeyHash',
  'endpointPath',
  'providerMode',
  'limitName',
  'windowKey',
]);

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_PROHIBITED_INPUTS = Object.freeze([
  'token',
  'rawToken',
  'authorization',
  'authorizationHeader',
  'rawUserId',
  'rawUserID',
  'rawUserIdentifier',
  'uid',
  'firebaseUid',
  'email',
  'phone',
  'phoneNumber',
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
]);

const DEFAULT_OPTIONS = Object.freeze({
  disabled: true,
  onProhibitedField: 'reject',
});

function normalizeOptions(options) {
  return Object.assign({}, DEFAULT_OPTIONS, options || {});
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeScoutLiveRateLimitStorageKeyPayload(payload, options) {
  const opts = normalizeOptions(options);
  const src = isPlainObject(payload) ? payload : {};
  const sanitized = {};
  const rejectedFields = [];

  for (const key of Object.keys(src)) {
    if (SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_PROHIBITED_INPUTS.includes(key)) {
      rejectedFields.push(key);
      if (opts.onProhibitedField === 'reject') {
        return { payload: {}, rejected: true, rejectedFields };
      }
      continue;
    }

    if (SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_ALLOWED_INPUTS.includes(key)) {
      sanitized[key] = src[key];
    }
  }

  return { payload: sanitized, rejected: false, rejectedFields };
}

function buildDisabledResponse(payload, rejectedFields) {
  return {
    ok: false,
    disabled: true,
    code: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_BUILDER_DISABLED,
    reason: 'Scout live rate-limit storage key builder is disabled; no runtime storage key is generated.',
    storageKey: null,
    keyPreview: null,
    payload,
    rejectedFields: rejectedFields || [],
  };
}

function buildProhibitedResponse(rejectedFields) {
  return {
    ok: false,
    disabled: true,
    code: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_PAYLOAD_PROHIBITED,
    reason: 'Scout live rate-limit storage key payload contains prohibited fields.',
    storageKey: null,
    keyPreview: null,
    payload: {},
    rejectedFields,
  };
}

export function buildScoutLiveRateLimitStorageKey(payload, options) {
  const sanitized = sanitizeScoutLiveRateLimitStorageKeyPayload(payload, options);

  if (sanitized.rejected) {
    return buildProhibitedResponse(sanitized.rejectedFields);
  }

  return buildDisabledResponse(sanitized.payload, sanitized.rejectedFields);
}

export function createScoutLiveRateLimitStorageKeyBuilder(options) {
  const opts = normalizeOptions(options);

  return Object.freeze({
    kind: 'scout_live_rate_limit_storage_key_builder',
    version: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_VERSION,
    mode: opts.disabled
      ? SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_MODES.DISABLED
      : SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_MODES.NOT_IMPLEMENTED,
    disabled: true,
    allowedInputs: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_ALLOWED_INPUTS,
    prohibitedInputs: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_PROHIBITED_INPUTS,
    buildKey: (payload) => buildScoutLiveRateLimitStorageKey(payload, opts),
  });
}
