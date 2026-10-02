/**
 * Scout Live Rate-Limit Durable Object Storage Adapter — SOURCE ONLY
 * v20261002-slice-b-1
 *
 * Slice issue: #4536 (Slice B — Durable Object strict quota source only)
 * Parent issue: #1882 (must remain OPEN; never auto-close)
 * Refs #4390
 *
 * This adapter is the Scout-side seam over the DO strict-quota backend in
 * `live-rate-limit-durable-object-quota-backend.js`. It is DI-ONLY: it is
 * constructed with an explicitly injected Durable Object admission surface
 * (`stub`, `backend`, or `namespace`, resolved in that precedence order), and
 * it defaults to disabled/unavailable without one.
 *
 * Slice B separation (this is the required stop property):
 * - DO backend source: real serialized admit/persist semantics, exercised only
 *   in isolated injected tests;
 * - dependency mapper: UNCHANGED. It does not recognize the DO result codes,
 *   so they still map to `RATE_LIMIT_STORAGE_UNAVAILABLE`;
 * - endpoint: 503 fail-closed, provider call count 0.
 *
 * Deliberately NOT done in this slice (Slice C):
 * - no `wrangler.toml` DO binding or migration;
 * - no `SCOUT_RUNTIME_RATE_LIMIT_BACKEND` / `SCOUT_RUNTIME_RATE_LIMIT_DO_BINDING`
 *   lookup anywhere (this module never reads `env` or `process.env`);
 * - no `suggest.js` wiring;
 * - no dependency-mapper allow/limited mapping.
 *
 * Privacy rules:
 * - the Durable Object name is the sanitized runtime key produced by the
 *   existing canonical key builder (`live-rate-limit-storage-key-builder.js`,
 *   runtime mode). No new hashing scheme is introduced here;
 * - only allowlisted sanitized identity fields cross into the namespace call
 *   and into the admission request;
 * - no raw UID, token, Authorization header, email, decoded claims, raw IP,
 *   session cookie/id, prompt, excerpt, sourceUrl, API key, secret, or raw
 *   request/provider body is accepted, sent, persisted, or returned;
 * - results expose only bounded safe fields: `allowed`, `code`, `limit`,
 *   `remaining`, `retryAfterSeconds`, bounded window metadata, `replayed`,
 *   and sanitized adapter mode/version. Never the DO id, the raw storage key,
 *   the namespace object, the persisted record, or exception detail.
 *
 * The adapter is admission-only on purpose: a client-side release/refund would
 * break strict atomic quota, so no `releaseQuota` seam exists.
 */

'use strict';

import { sanitizeScoutLiveRateLimitStoragePayload } from './live-rate-limit-storage-adapter.js';
import {
  createScoutLiveRateLimitStorageKeyBuilder,
  SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES,
} from './live-rate-limit-storage-key-builder.js';
import {
  SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_BACKEND_VERSION,
  SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES,
  SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS,
} from './live-rate-limit-durable-object-quota-backend.js';

// ─── Version / modes ───────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_VERSION = '20261002-slice-b-1';

export const SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_MODES = Object.freeze({
  DISABLED: 'durable_object_source_disabled',
  SOURCE: 'durable_object_source',
});

// Codes are intentionally shared with the DO backend so a result can never be
// silently reclassified between the two layers.
export const SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_CODES =
  SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES;
export const SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_RESULT_CODES =
  SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES;

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS = Object.freeze({
  disabled: true,
  namespace: null,
  stub: null,
  backend: null,
  storageKeyBuilder: null,
  runtimeKey: true,
  runtimeKeyKind: null,
  limit: null,
  windowMs: null,
  onProhibitedField: 'reject',
});

// The DO-side admission request fields this adapter is allowed to construct.
const ADMISSION_FIELDS = Object.freeze(['key', 'windowKey', 'limit', 'windowMs', 'nowMs', 'requestId']);

const SAFE_RESULT_CODES = new Set([
  SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_ADMITTED,
  SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_LIMITED,
  SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_BACKEND_DISABLED,
  SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_BACKEND_UNAVAILABLE,
  SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_PAYLOAD_PROHIBITED,
  SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_CONFIG_INVALID,
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// ─── Safe bounded output builder ────────────────────────────────────────────

/**
 * Build the adapter's safe bounded result. Only allowlisted bounded fields
 * survive; nothing else from the DO response is propagated.
 */
function buildAdapterResult(code, fields = {}) {
  const isAdmitted = code === SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_ADMITTED;
  const isLimited = code === SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_LIMITED;

  return Object.freeze({
    allowed: isAdmitted,
    code,
    mode: SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_MODES.SOURCE,
    adapterVersion: SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_VERSION,
    backendVersion: SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_BACKEND_VERSION,
    limit: Number.isInteger(fields.limit) && fields.limit > 0 ? fields.limit : null,
    remaining: Number.isInteger(fields.remaining) && fields.remaining >= 0
      ? fields.remaining
      : null,
    retryAfterSeconds: isLimited && Number.isFinite(fields.retryAfterSeconds)
      ? Math.min(
        SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxRetryAfterSeconds,
        Math.max(1, Math.floor(fields.retryAfterSeconds)),
      )
      : null,
    windowKey: typeof fields.windowKey === 'string'
      && fields.windowKey.length > 0
      && fields.windowKey.length <= SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxWindowKeyLength
      ? fields.windowKey
      : null,
    replayed: fields.replayed === true,
  });
}

function buildDisabledAdapterResult() {
  return Object.freeze({
    allowed: false,
    code: SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_BACKEND_DISABLED,
    mode: SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_MODES.DISABLED,
    adapterVersion: SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_VERSION,
    backendVersion: SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_BACKEND_VERSION,
    limit: null,
    remaining: null,
    retryAfterSeconds: null,
    windowKey: null,
    replayed: false,
  });
}

function normalizeBackendResult(raw) {
  if (!isPlainObject(raw)) {
    return buildAdapterResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_BACKEND_UNAVAILABLE);
  }
  if (typeof raw.code !== 'string' || !SAFE_RESULT_CODES.has(raw.code)) {
    return buildAdapterResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_BACKEND_UNAVAILABLE);
  }
  if (raw.code === SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_ADMITTED && raw.allowed !== true) {
    return buildAdapterResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_BACKEND_UNAVAILABLE);
  }
  return buildAdapterResult(raw.code, {
    limit: raw.limit,
    remaining: raw.remaining,
    retryAfterSeconds: raw.retryAfterSeconds,
    windowKey: raw.windowKey,
    replayed: raw.replayed,
  });
}

// ─── Admission-surface resolution (injected dependencies only) ──────────────

/**
 * Resolve the Durable Object admission surface from injected dependencies.
 *
 * Precedence is explicit and deterministic:
 *   1. `stub`    — an injected DO stub double,
 *   2. `backend` — an injected DO quota backend exposing the bounded
 *                  `admit(request)` seam (backend-only injection is fully
 *                  supported and needs no namespace or stub),
 *   3. `namespace` — resolved through `idFromName` / `get`.
 *
 * Nothing else is consulted: no env lookup, no runtime binding, no global.
 *
 * @param {Object} deps - { namespace, stub, backend }
 * @param {string} storageKey - canonical sanitized runtime key
 * @returns {Object|null} admission surface, or null when unresolvable
 */
function resolveStub(deps, storageKey) {
  const injectedStub = isPlainObject(deps.stub) ? deps.stub : null;
  if (injectedStub) return injectedStub;

  const injectedBackend = isPlainObject(deps.backend) ? deps.backend : null;
  if (injectedBackend) return injectedBackend;

  const namespace = isPlainObject(deps.namespace) ? deps.namespace : null;
  if (!namespace) return null;
  if (typeof namespace.idFromName !== 'function' || typeof namespace.get !== 'function') {
    return null;
  }
  const stubId = namespace.idFromName(storageKey);
  const resolved = namespace.get(stubId);
  return isPlainObject(resolved) ? resolved : null;
}

async function invokeStubAdmission(stub, admissionRequest) {
  if (typeof stub.admit === 'function') {
    return stub.admit(admissionRequest);
  }
  if (typeof stub.handle === 'function') {
    const handled = await stub.handle(admissionRequest);
    return isPlainObject(handled) && isPlainObject(handled.body) ? handled.body : handled;
  }
  return null;
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create the Scout Durable Object strict-quota storage adapter (DI only).
 *
 * @param {Object} [options]
 * @param {boolean} [options.disabled=true] explicit opt-out; the adapter is
 *   disabled unless `disabled: false` is passed AND a namespace/stub/backend
 *   is injected.
 * @param {Object} [options.namespace] injected Durable Object namespace double
 *   exposing `idFromName` / `get`
 * @param {Object} [options.stub] injected Durable Object stub double
 *   exposing `admit` (or `handle`)
 * @param {Object} [options.backend] pre-built DO quota backend exposing the
 *   bounded `admit(request)` seam. Backend-only injection is fully supported
 *   and needs no namespace or stub.
 * @param {Object} [options.storageKeyBuilder] optional injected key builder
 * @param {boolean} [options.runtimeKey=true] use the canonical runtime key
 * @param {number} [options.limit] configured strict quota limit (required)
 * @param {number} [options.windowMs] configured quota window (required)
 * @param {Function} [options.now] injectable clock
 * @returns {Object} frozen adapter with `checkQuota` / `consumeQuota`
 */
export function createScoutLiveRateLimitDurableObjectStorageAdapter(options = {}) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
  const nowFn = typeof opts.now === 'function' ? opts.now : () => Date.now();

  const injected = !!(
    opts.namespace || opts.stub || opts.backend
  );
  const enabled = opts.disabled === false && injected;

  if (!enabled) {
    // Default-disabled adapter: no namespace resolution, no storage access,
    // no env/binding lookup, safe unavailable result for every call.
    return Object.freeze({
      kind: 'scout_live_rate_limit_durable_object_storage_adapter',
      version: SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_VERSION,
      mode: SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_MODES.DISABLED,
      mockDisabled: false,
      isMockDisabled: false,
      isRuntimeScaffold: true,
      hasInjectedDurableObject: injected,
      hasStorageKeyBuilder: false,

      async checkQuota(_payload) {
        return buildDisabledAdapterResult();
      },

      async consumeQuota(_payload) {
        return buildDisabledAdapterResult();
      },

      sanitizePayload: sanitizeScoutLiveRateLimitStoragePayload,
    });
  }

  const storageKeyBuilder = (opts.storageKeyBuilder && typeof opts.storageKeyBuilder.buildKeyInRuntimeMode === 'function')
    ? opts.storageKeyBuilder
    : createScoutLiveRateLimitStorageKeyBuilder({
      disabled: false,
      runtime: opts.runtimeKey === true,
      kind: opts.runtimeKeyKind,
      onProhibitedField: opts.onProhibitedField,
    });

  const limit = opts.limit;
  const windowMs = opts.windowMs;

  async function admitQuota(payload) {
    // 1. Allowlist-only sanitize the caller payload (no raw token / identity).
    const sanitized = sanitizeScoutLiveRateLimitStoragePayload(payload, {
      onProhibitedField: opts.onProhibitedField,
    });
    if (sanitized.rejected) {
      return buildAdapterResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_PAYLOAD_PROHIBITED);
    }

    // 2. Reuse the canonical sanitized runtime key. No new hashing here.
    const keyResult = storageKeyBuilder.buildKeyInRuntimeMode(sanitized.payload);
    if (!keyResult || keyResult.ok !== true
      || keyResult.code !== SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_BUILT
      || typeof keyResult.storageKey !== 'string'
      || keyResult.storageKey.length === 0) {
      const prohibited = keyResult
        && keyResult.code === SCOUT_LIVE_RATE_LIMIT_STORAGE_KEY_BUILDER_CODES.STORAGE_KEY_PAYLOAD_PROHIBITED;
      return buildAdapterResult(prohibited
        ? SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_PAYLOAD_PROHIBITED
        : SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_CONFIG_INVALID);
    }

    // 3. Configured quota must be bounded and present, else fail closed.
    if (!Number.isInteger(limit) || limit <= 0 || limit > SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxLimit) {
      return buildAdapterResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_CONFIG_INVALID);
    }
    if (!Number.isInteger(windowMs) || windowMs <= 0 || windowMs > SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxWindowMs) {
      return buildAdapterResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_CONFIG_INVALID);
    }
    const windowKey = sanitized.payload.windowKey;
    if (typeof windowKey !== 'string' || windowKey.length === 0) {
      return buildAdapterResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_CONFIG_INVALID);
    }

    // 3b. At least one sanitized identity hash must be present, so a payload
    // without identity material can never collapse onto one shared bucket.
    const hasIdentityHash = ['userKeyHash', 'ipHash', 'sessionKeyHash']
      .some((field) => typeof sanitized.payload[field] === 'string' && sanitized.payload[field].length > 0);
    if (!hasIdentityHash) {
      return buildAdapterResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_CONFIG_INVALID);
    }

    // 4. Resolve the Durable Object admission surface from injected
    //    dependencies only (stub -> backend -> namespace).
    let stub = null;
    try {
      stub = resolveStub({ namespace: opts.namespace, stub: opts.stub, backend: opts.backend }, keyResult.storageKey);
    } catch {
      return buildAdapterResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_BACKEND_UNAVAILABLE);
    }
    if (!stub) {
      return buildAdapterResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_BACKEND_UNAVAILABLE);
    }

    // 5. One serialized DO-side admission operation (decision + persist).
    const admissionRequest = {
      key: keyResult.storageKey,
      windowKey,
      limit,
      windowMs,
      nowMs: nowFn(),
    };
    if (typeof sanitized.payload.requestId === 'string'
      && sanitized.payload.requestId.length > 0
      && sanitized.payload.requestId.length <= SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxRequestIdLength) {
      admissionRequest.requestId = sanitized.payload.requestId;
    }
    for (const field of Object.keys(admissionRequest)) {
      if (!ADMISSION_FIELDS.includes(field)) {
        return buildAdapterResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_CONFIG_INVALID);
      }
    }

    let rawResult;
    try {
      rawResult = await invokeStubAdmission(stub, admissionRequest);
    } catch {
      // Storage/binding/DO exception -> unavailable, never allow.
      return buildAdapterResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_BACKEND_UNAVAILABLE);
    }

    return normalizeBackendResult(rawResult);
  }

  return Object.freeze({
    kind: 'scout_live_rate_limit_durable_object_storage_adapter',
    version: SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_VERSION,
    mode: SCOUT_LIVE_RATE_LIMIT_DO_ADAPTER_MODES.SOURCE,
    mockDisabled: false,
    isMockDisabled: false,
    isRuntimeScaffold: true,
    hasInjectedDurableObject: true,
    hasStorageKeyBuilder: true,

    // `checkQuota` performs the same atomic admission as `consumeQuota`:
    // a strict counter must decide and persist in one operation, so there is
    // no read-only peek seam here.
    async checkQuota(payload) {
      return admitQuota(payload);
    },

    async consumeQuota(payload) {
      return admitQuota(payload);
    },

    sanitizePayload: sanitizeScoutLiveRateLimitStoragePayload,
  });
}