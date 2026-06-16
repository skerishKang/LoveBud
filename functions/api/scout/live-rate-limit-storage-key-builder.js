/**
 * Scout Live Rate-Limit Storage Key Builder — Disabled Scaffold + Runtime Mode
 * v20260616-runtime-mode-1
 *
 * Slice issue: #2573
 * Parent issue: #1882 (must remain OPEN; never auto-close)
 *
 * Disabled-by-default scaffold for Scout live rate-limit storage key
 * construction. This module intentionally does not generate usable runtime
 * storage keys for live traffic by default and does not access hashing
 * secrets, salts, KV, Durable Object, D1, provider SDKs, network fetch, or
 * endpoint state.
 *
 * Runtime mode (v20260616-runtime-mode-1) adds an opt-in `STORAGE_RUNTIME`
 * mode that builds a deterministic, bounded, sanitized storage key from
 * pre-derived safe inputs only. Runtime mode does NOT execute any live
 * storage, network, DB, provider, or fetch call. It only derives a key
 * string from already-sanitized inputs. The default behavior remains
 * disabled. Runtime mode must be explicitly requested via the `runtime`
 * option flag and is never triggered by default.
 */

'use strict';

// ─── Version ────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_VERSION = '20260616-runtime-mode-1';

// ─── Modes ──────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_MODES = Object.freeze({
  DISABLED: 'disabled',
  NOT_IMPLEMENTED: 'not_implemented',
  RUNTIME: 'runtime',
});

// ─── Codes ──────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES = Object.freeze({
  STORAGE_KEY_BUILDER_DISABLED: 'STORAGE_KEY_BUILDER_DISABLED',
  STORAGE_KEY_BUILDER_NOT_IMPLEMENTED: 'STORAGE_KEY_BUILDER_NOT_IMPLEMENTED',
  STORAGE_KEY_PAYLOAD_PROHIBITED: 'STORAGE_KEY_PAYLOAD_PROHIBITED',
  STORAGE_KEY_BUILT: 'STORAGE_KEY_BUILT',
  STORAGE_KEY_BUILDER_RUNTIME_PAYLOAD_MISSING: 'STORAGE_KEY_BUILDER_RUNTIME_PAYLOAD_MISSING',
  STORAGE_KEY_BUILDER_RUNTIME_KIND_UNKNOWN: 'STORAGE_KEY_BUILDER_RUNTIME_KIND_UNKNOWN',
  STORAGE_KEY_BUILDER_RUNTIME_OUTPUT_OVERFLOW: 'STORAGE_KEY_BUILDER_RUNTIME_OUTPUT_OVERFLOW',
  STORAGE_KEY_BUILDER_RUNTIME_DISABLED: 'STORAGE_KEY_BUILDER_RUNTIME_DISABLED',
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

// ─── Runtime Mode Kinds ─────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_RUNTIME_KINDS = Object.freeze({
  USER_KEY_HASH: 'userKeyHash',
  IP_HASH: 'ipHash',
  SESSION_KEY_HASH: 'sessionKeyHash',
  COMPOSITE: 'composite',
});

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS = Object.freeze({
  disabled: true,
  onProhibitedField: 'reject',
});

const MAX_RUNTIME_KEY_LENGTH = 200;
const RUNTIME_KEY_NAMESPACE = 'scout:rl:v1';
const RUNTIME_HASH_HEX_LEN = 16;

function normalizeOptions(options) {
  return Object.assign({}, DEFAULT_OPTIONS, options || {});
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Pure-JS FNV-1a 32-bit hash. Deterministic, no crypto SDK, no secrets, no
// fetch. Produces 8 hex chars. No external state.
function fnv1a32(input) {
  const str = typeof input === 'string' ? input : String(input);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
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

// ─── Runtime Mode (opt-in only, default still disabled) ─────────────────────

function buildRuntimeKindInput(sanitizedPayload, kind) {
  const kinds = SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_RUNTIME_KINDS;
  switch (kind) {
    case kinds.USER_KEY_HASH: {
      if (!sanitizedPayload.userKeyHash) return null;
      return `userKeyHash=${String(sanitizedPayload.userKeyHash)}`;
    }
    case kinds.IP_HASH: {
      if (!sanitizedPayload.ipHash) return null;
      return `ipHash=${String(sanitizedPayload.ipHash)}`;
    }
    case kinds.SESSION_KEY_HASH: {
      if (!sanitizedPayload.sessionKeyHash) return null;
      return `sessionKeyHash=${String(sanitizedPayload.sessionKeyHash)}`;
    }
    case kinds.COMPOSITE:
    default: {
      return JSON.stringify({
        userKeyHash: sanitizedPayload.userKeyHash || null,
        ipHash: sanitizedPayload.ipHash || null,
        sessionKeyHash: sanitizedPayload.sessionKeyHash || null,
        endpointPath: sanitizedPayload.endpointPath || null,
        providerMode: sanitizedPayload.providerMode || null,
        limitName: sanitizedPayload.limitName || null,
        windowKey: sanitizedPayload.windowKey || null,
      });
    }
  }
}

function buildScoutLiveRateLimitRuntimeStorageKey(sanitizedPayload, kind) {
  const kinds = SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_RUNTIME_KINDS;
  const knownKinds = Object.values(kinds);

  if (kind && !knownKinds.includes(kind)) {
    return {
      ok: false,
      code: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES
        .STORAGE_KEY_BUILDER_RUNTIME_KIND_UNKNOWN,
      reason: `Unknown runtime kind '${kind}'.`,
      storageKey: null,
    };
  }

  const resolvedKind = kind || kinds.COMPOSITE;
  const kindInput = buildRuntimeKindInput(sanitizedPayload, resolvedKind);

  if (kindInput === null) {
    return {
      ok: false,
      code: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES
        .STORAGE_KEY_BUILDER_RUNTIME_PAYLOAD_MISSING,
      reason: `Runtime kind '${resolvedKind}' requires the corresponding sanitized input field.`,
      storageKey: null,
    };
  }

  // Double-hash the kindInput to derive a stable, bounded hash. FNV-1a is
  // deterministic, pure JS, and uses no secrets, salts, SDK, fetch, or
  // network. This is not cryptographic hashing; it is a deterministic
  // string-to-hex projection for a non-secret storage key namespace.
  const primary = fnv1a32(kindInput);
  const secondary = fnv1a32(`${resolvedKind}|${primary}`);
  const hash = (primary + secondary).slice(0, RUNTIME_HASH_HEX_LEN);

  const storageKey = `${RUNTIME_KEY_NAMESPACE}:${resolvedKind}:${hash}`;

  if (storageKey.length > MAX_RUNTIME_KEY_LENGTH) {
    return {
      ok: false,
      code: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES
        .STORAGE_KEY_BUILDER_RUNTIME_OUTPUT_OVERFLOW,
      reason: 'Runtime storage key exceeds bounded length.',
      storageKey: null,
    };
  }

  return {
    ok: true,
    code: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_BUILT,
    storageKey,
  };
}

export function buildScoutLiveRateLimitStorageKeyInRuntimeMode(payload, options) {
  const opts = normalizeOptions(options);

  // Default behavior is still disabled. Runtime mode requires explicit
  // opt-in via `runtime: true` option. Without that flag, this function
  // refuses to generate a key.
  if (opts.disabled || opts.runtime !== true) {
    return {
      ok: false,
      disabled: true,
      code: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES
        .STORAGE_KEY_BUILDER_RUNTIME_DISABLED,
      reason: 'Scout live rate-limit storage key runtime mode is disabled by default; pass { runtime: true } to opt in.',
      storageKey: null,
      keyPreview: null,
      mode: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_MODES.DISABLED,
      payload: {},
      rejectedFields: [],
    };
  }

  const sanitized = sanitizeScoutLiveRateLimitStorageKeyPayload(payload, opts);
  if (sanitized.rejected) {
    return {
      ok: false,
      disabled: false,
      code: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_PAYLOAD_PROHIBITED,
      reason: 'Scout live rate-limit storage key payload contains prohibited fields.',
      storageKey: null,
      keyPreview: null,
      mode: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_MODES.RUNTIME,
      payload: {},
      rejectedFields: sanitized.rejectedFields,
    };
  }

  const requestedKind = opts.kind;
  const built = buildScoutLiveRateLimitRuntimeStorageKey(sanitized.payload, requestedKind);

  if (!built.ok) {
    return {
      ok: false,
      disabled: false,
      code: built.code,
      reason: built.reason,
      storageKey: null,
      keyPreview: null,
      mode: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_MODES.RUNTIME,
      payload: sanitized.payload,
      rejectedFields: sanitized.rejectedFields,
    };
  }

  const storageKey = built.storageKey;
  const keyPreview = storageKey.length <= 24
    ? storageKey
    : `${storageKey.slice(0, 12)}…${storageKey.slice(-8)}`;

  return {
    ok: true,
    disabled: false,
    code: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_BUILT,
    reason: 'Scout live rate-limit runtime storage key built from sanitized inputs only.',
    storageKey,
    keyPreview,
    mode: SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_MODES.RUNTIME,
    payload: sanitized.payload,
    rejectedFields: sanitized.rejectedFields,
  };
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
    buildKeyInRuntimeMode: (payload) =>
      buildScoutLiveRateLimitStorageKeyInRuntimeMode(payload, opts),
  });
}
