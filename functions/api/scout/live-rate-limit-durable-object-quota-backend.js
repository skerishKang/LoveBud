/**
 * Scout Live Rate-Limit Durable Object Strict Quota Backend — SOURCE ONLY
 * v20261002-slice-b-1
 *
 * Slice issue: #4536 (Slice B — Durable Object strict quota source only)
 * Parent issue: #1882 (must remain OPEN; never auto-close)
 * Refs #4390
 *
 * Backend-selection authority for this slice:
 * 1. Durable Object FIRST for strict serialized per-key live quota counters.
 * 2. KV only for coarse auxiliary / non-strict throttles.
 * 3. D1 only for audit / reporting / lower-frequency policy state.
 *
 * This module implements the DO-side **single serialized admission
 * operation** for one quota key + window. The quota decision and the
 * persistent counter update happen inside ONE serialized operation, so a
 * client-side `read -> return allowed -> later write` oversubscription
 * split is structurally impossible from this surface.
 *
 * Slice B is SOURCE ONLY. This module is NOT wired into:
 * - `wrangler.toml` (no DO binding, no migration),
 * - `functions/api/scout/suggest.js`,
 * - the live dependency mapper,
 * - any Production / Preview environment.
 *
 * The module therefore cannot be reached from normal Scout runtime
 * traffic. It is constructed only with an explicitly injected
 * Durable-Object-shaped `state` (or raw storage double) and is exercised
 * by synthetic in-memory contract tests.
 *
 * Identity / privacy rules (enforced, not merely documented):
 * - the only key material accepted is the already-sanitized runtime key
 *   produced by `functions/api/scout/live-rate-limit-storage-key-builder.js`
 *   plus a bounded `windowKey`;
 * - no raw Firebase UID, raw token, Authorization header, email, decoded
 *   claims, raw IP, session cookie/id, prompt, excerpt, sourceUrl, API key,
 *   secret, or raw request/provider body may be a DO name, a persisted
 *   value, a log field, or a returned field;
 * - no new hashing scheme: the sanitized runtime key is reused verbatim;
 * - persisted state holds only `{ windowKey, windowStartMs, count, seen }`;
 * - every returned value is bounded and sanitized; no exception detail,
 *   no raw key, no DO id, no namespace object, no persisted record.
 *
 * Fail-closed rules:
 * - storage/config exception -> unavailable, never automatic allow;
 * - malformed / untrusted persisted state -> unavailable, never
 *   unconditional allow;
 * - a missing record is the ONLY case that initializes a fresh window, and
 *   that first-use contract is explicit and covered by tests.
 *
 * Idempotency: an optional bounded `requestId` may be supplied. A repeated
 * `requestId` inside the same window replays its admitted decision without
 * consuming quota again. Idempotency metadata is bounded by the quota limit
 * itself (only admissions are recorded, and admissions are capped by
 * `limit`), so it can never grow without bound. Denied requests never consume
 * quota, so a replayed denial needs no idempotency record.
 *
 * Non-goals (this slice):
 * - no DO class registration, no migration, no namespace/binding creation;
 * - no dependency-mapper allow/limited mapping (that is Slice C);
 * - no endpoint activation;
 * - no KV / D1 / fetch / provider / Engine / Firebase Admin call;
 * - no release/refund operation (a client-side release would break strict
 *   atomicity, so this backend is admission-only by design).
 */

'use strict';

// ─── Version ────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_BACKEND_VERSION = '20261002-slice-b-1';

// ─── Bounded storage-layer result codes ────────────────────────────────────
//
// These codes are local to this DO backend and its adapter. The existing live
// dependency mapper deliberately does NOT recognize them in Slice B, so an
// unrecognized code keeps mapping to RATE_LIMIT_STORAGE_UNAVAILABLE and the
// endpoint keeps failing closed. Slice C owns the mapper change.

export const SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES = Object.freeze({
  DO_QUOTA_ADMITTED: 'DO_QUOTA_ADMITTED',
  DO_QUOTA_LIMITED: 'DO_QUOTA_LIMITED',
  DO_QUOTA_BACKEND_DISABLED: 'DO_QUOTA_BACKEND_DISABLED',
  DO_QUOTA_BACKEND_UNAVAILABLE: 'DO_QUOTA_BACKEND_UNAVAILABLE',
  DO_QUOTA_PAYLOAD_PROHIBITED: 'DO_QUOTA_PAYLOAD_PROHIBITED',
  DO_QUOTA_CONFIG_INVALID: 'DO_QUOTA_CONFIG_INVALID',
});

export const SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_RESULT_CODES =
  SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES;

// ─── Admission request policy ──────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_ALLOWED_FIELDS = Object.freeze([
  'key',
  'windowKey',
  'limit',
  'windowMs',
  'nowMs',
  'requestId',
]);

export const SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_PROHIBITED_FIELDS = Object.freeze([
  'token',
  'rawToken',
  'bearer',
  'jwt',
  'authorization',
  'authorizationHeader',
  'uid',
  'firebaseUid',
  'rawUserId',
  'rawUserIdentifier',
  'email',
  'phone',
  'phoneNumber',
  'claims',
  'decodedClaims',
  'ip',
  'rawIp',
  'ipAddress',
  'cookie',
  'sessionCookie',
  'sessionId',
  'prompt',
  'excerpt',
  'sourceUrl',
  'apiKey',
  'secret',
  'password',
  'rawRequestBody',
  'rawProviderResponse',
  'rawModelOutput',
  'userContent',
]);

// ─── Hard bounds ───────────────────────────────────────────────────────────

export const SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS = Object.freeze({
  maxKeyLength: 200,
  maxWindowKeyLength: 64,
  maxLimit: 1000,
  minWindowMs: 1000,
  maxWindowMs: 24 * 60 * 60 * 1000,
  maxRequestIdLength: 64,
  maxRetryAfterSeconds: 24 * 60 * 60,
});

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;
const BOUNDED_TOKEN_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;
const SAFE_KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,200}$/;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isBoundedPositiveInteger(value, max) {
  return Number.isInteger(value) && value > 0 && value <= max;
}

// ─── Safe result builders ───────────────────────────────────────────────────

function buildResult(code, fields = {}) {
  const isAdmitted = code === SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_ADMITTED;
  const isLimited = code === SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_LIMITED;
  const retryAfterSeconds = isLimited && Number.isFinite(fields.retryAfterSeconds)
    ? Math.min(
      SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxRetryAfterSeconds,
      Math.max(1, Math.floor(fields.retryAfterSeconds)),
    )
    : null;

  return Object.freeze({
    ok: isAdmitted,
    allowed: isAdmitted,
    code,
    limit: Number.isInteger(fields.limit) ? fields.limit : null,
    remaining: Number.isInteger(fields.remaining) && fields.remaining >= 0
      ? fields.remaining
      : null,
    retryAfterSeconds,
    windowKey: typeof fields.windowKey === 'string' && fields.windowKey.length > 0
      ? fields.windowKey
      : null,
    windowStartMs: Number.isFinite(fields.windowStartMs) ? fields.windowStartMs : null,
    count: Number.isInteger(fields.count) && fields.count >= 0 ? fields.count : null,
    replayed: fields.replayed === true,
    backendVersion: SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_BACKEND_VERSION,
  });
}

function buildUnavailableResult() {
  return buildResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_BACKEND_UNAVAILABLE);
}

function buildProhibitedResult() {
  return buildResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_PAYLOAD_PROHIBITED);
}

function buildConfigInvalidResult() {
  return buildResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_CONFIG_INVALID);
}

// ─── Request sanitization / validation ─────────────────────────────────────

/**
 * Pure helper: allowlist-only sanitize an admission request.
 *
 * @param {Object} request
 * @returns {Object} { ok, code, rejected, rejectedFields, value }
 */
export function sanitizeScoutRateLimitDurableObjectAdmissionRequest(request) {
  const src = isPlainObject(request) ? request : {};
  const out = {};
  const rejectedFields = [];

  for (const field of Object.keys(src)) {
    if (SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_PROHIBITED_FIELDS.includes(field)) {
      rejectedFields.push(field);
      continue;
    }
    if (SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_ALLOWED_FIELDS.includes(field)) {
      out[field] = src[field];
    }
    // Unknown fields are dropped (allowlist-only).
  }

  if (rejectedFields.length > 0) {
    return {
      ok: false,
      code: SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_PAYLOAD_PROHIBITED,
      rejected: true,
      rejectedFields,
      value: null,
    };
  }

  const key = out.key;
  const windowKey = out.windowKey;
  const limit = out.limit;
  const windowMs = out.windowMs;
  const nowMs = out.nowMs;
  const requestId = out.requestId;

  const keyOk = typeof key === 'string'
    && key.length > 0
    && key.length <= SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxKeyLength
    && SAFE_KEY_PATTERN.test(key);
  const windowKeyOk = typeof windowKey === 'string'
    && windowKey.length > 0
    && windowKey.length <= SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxWindowKeyLength
    && BOUNDED_TOKEN_PATTERN.test(windowKey);
  const limitOk = isBoundedPositiveInteger(limit, SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxLimit);
  const windowMsOk = isBoundedPositiveInteger(
    windowMs,
    SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxWindowMs,
  )
    && windowMs >= SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.minWindowMs;
  const nowMsOk = Number.isFinite(nowMs) && nowMs >= 0;
  const requestIdOk = requestId === undefined
    || requestId === null
    || (typeof requestId === 'string' && REQUEST_ID_PATTERN.test(requestId));

  if (!keyOk || !windowKeyOk || !limitOk || !windowMsOk || !nowMsOk || !requestIdOk) {
    return {
      ok: false,
      code: SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_CONFIG_INVALID,
      rejected: false,
      rejectedFields,
      value: null,
    };
  }

  return {
    ok: true,
    code: SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_ADMITTED,
    rejected: false,
    rejectedFields,
    value: {
      key,
      windowKey,
      limit,
      windowMs,
      nowMs: Math.floor(nowMs),
      requestId: typeof requestId === 'string' ? requestId : null,
    },
  };
}

// ─── Persisted-record validation ────────────────────────────────────────────

function buildFreshRecord(windowKey, nowMs) {
  return { windowKey, windowStartMs: nowMs, count: 0, seen: {} };
}

/**
 * Validate persisted state shape. Malformed / untrusted state is never treated
 * as a fresh window and never produces an allow. A structurally valid record
 * from a DIFFERENT window is returned as-is so the caller can roll over.
 *
 * @param {Object} record persisted record
 * @returns {Object|null} validated record, or null when untrusted
 */
export function validateScoutRateLimitDurableObjectQuotaRecord(record) {
  if (!isPlainObject(record)) return null;
  if (typeof record.windowKey !== 'string' || record.windowKey.length === 0) return null;
  if (record.windowKey.length > SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxWindowKeyLength) return null;
  if (!BOUNDED_TOKEN_PATTERN.test(record.windowKey)) return null;
  if (!Number.isFinite(record.windowStartMs) || record.windowStartMs < 0) return null;
  if (!Number.isInteger(record.count) || record.count < 0) return null;
  if (record.count > SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxLimit) return null;
  if (!isPlainObject(record.seen)) return null;

  const seenKeys = Object.keys(record.seen);
  if (seenKeys.length > SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxLimit) return null;

  const seen = {};
  for (const seenKey of seenKeys) {
    if (typeof seenKey !== 'string' || !REQUEST_ID_PATTERN.test(seenKey)) return null;
    const index = record.seen[seenKey];
    if (!Number.isInteger(index) || index < 0 || index > SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_LIMITS.maxLimit) {
      return null;
    }
    seen[seenKey] = index;
  }

  return {
    windowKey: record.windowKey,
    windowStartMs: record.windowStartMs,
    count: record.count,
    seen,
  };
}

// ─── Durable Object quota class ─────────────────────────────────────────────

/**
 * Bounded Durable Object strict-quota backend.
 *
 * `state` is a Durable-Object-shaped object exposing async storage
 * (`state.storage.get` / `state.storage.put`, or the state itself in tests).
 * Nothing else is reachable: no env, no bindings, no fetch, no SQL.
 */
export class ScoutRateLimitDurableObjectQuota {
  constructor(state, options = {}) {
    const opts = isPlainObject(options) ? options : {};
    this.kind = 'scout_rate_limit_durable_object_quota';
    this.version = SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_BACKEND_VERSION;
    this._state = isPlainObject(state) ? state : null;
    this._storage = this._resolveStorage(opts);
    this._now = typeof opts.now === 'function' ? opts.now : () => Date.now();
    // Serialization tail: every admission runs through this promise chain so
    // the read-decide-write sequence can never interleave. On a real Durable
    // Object the runtime input gate already serializes requests; this chain
    // makes the same property hold in-process for isolated tests and for any
    // same-instance caller.
    this._tail = Promise.resolve();
  }

  get hasStorage() {
    return !!this._storage;
  }

  _resolveStorage(options) {
    const injected = options.storage;
    if (injected && typeof injected.get === 'function' && typeof injected.put === 'function') {
      return injected;
    }
    const state = this._state;
    if (!state) return null;
    if (state.storage && typeof state.storage.get === 'function' && typeof state.storage.put === 'function') {
      return state.storage;
    }
    if (typeof state.get === 'function' && typeof state.put === 'function') {
      return state;
    }
    return null;
  }

  /**
   * Single serialized admission operation.
   *
   * @param {Object} request allowlisted admission request
   * @returns {Promise<Object>} bounded safe result
   */
  async admit(request) {
    const run = this._tail.then(
      () => this._admitSerialized(request),
      () => this._admitSerialized(request),
    );
    this._tail = run.then(() => undefined, () => undefined);
    return run;
  }

  async _admitSerialized(request) {
    const sanitized = sanitizeScoutRateLimitDurableObjectAdmissionRequest(request);
    if (sanitized.rejected) return buildProhibitedResult();
    if (!sanitized.ok) return buildConfigInvalidResult();

    const { key, windowKey, limit, windowMs, nowMs, requestId } = sanitized.value;

    if (!this._storage) return buildUnavailableResult();

    let stored;
    try {
      stored = await this._storage.get(key);
    } catch {
      return buildUnavailableResult();
    }

    // Explicit first-use contract: a missing record initializes a fresh,
    // empty window. This is the ONLY initializing path.
    let record;
    if (stored === undefined || stored === null) {
      record = buildFreshRecord(windowKey, nowMs);
    } else {
      record = validateScoutRateLimitDurableObjectQuotaRecord(stored);
      // Untrusted / malformed / out-of-window state never auto-allows.
      if (!record) return buildUnavailableResult();
      // Window rollover: a different windowKey starts a fresh counter.
      if (record.windowKey !== windowKey) {
        record = buildFreshRecord(windowKey, nowMs);
      }
    }

    // Idempotent replay: an already-admitted requestId consumes no quota and
    // never writes state again.
    if (requestId && Object.prototype.hasOwnProperty.call(record.seen, requestId)) {
      return buildResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_ADMITTED, {
        limit,
        remaining: Math.max(0, limit - record.count),
        windowKey,
        windowStartMs: record.windowStartMs,
        count: record.count,
        replayed: true,
      });
    }

    if (record.count >= limit) {
      const elapsed = Math.max(0, nowMs - record.windowStartMs);
      const remainingMs = Math.max(0, windowMs - elapsed);
      return buildResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_LIMITED, {
        limit,
        remaining: 0,
        retryAfterSeconds: Math.ceil(remainingMs / 1000),
        windowKey,
        windowStartMs: record.windowStartMs,
        count: record.count,
      });
    }

    record.count += 1;
    if (requestId) record.seen[requestId] = record.count;

    try {
      await this._storage.put(key, record);
    } catch {
      return buildUnavailableResult();
    }

    return buildResult(SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_ADMITTED, {
      limit,
      remaining: Math.max(0, limit - record.count),
      windowKey,
      windowStartMs: record.windowStartMs,
      count: record.count,
    });
  }

  /**
   * Bounded Durable-Object-shaped HTTP surface (POST /admit only). Carries
   * only the allowlisted admission fields and returns only bounded safe
   * fields. Never used by checked-in configuration in Slice B.
   *
   * @param {Object} request-like object with `method` and `json()`
   * @returns {Promise<Object>} { ok, status, body }
   */
  async handle(request) {
    const req = isPlainObject(request) ? request : {};
    if (String(req.method || '').toUpperCase() !== 'POST') {
      return { ok: false, status: 405, body: buildConfigInvalidResult() };
    }

    let payload = null;
    try {
      payload = typeof req.json === 'function' ? await req.json() : null;
    } catch {
      payload = null;
    }

    const result = await this.admit(payload);
    return {
      ok: result.ok,
      status: result.ok ? 200 : (result.code === SCOUT_LIVE_RATE_LIMIT_DO_QUOTA_CODES.DO_QUOTA_LIMITED ? 429 : 503),
      body: result,
    };
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Factory for the DO strict-quota backend.
 *
 * Without an injected Durable-Object-shaped `state`/`storage` the backend is
 * disabled and every admission safe-fails as unavailable. There is no env,
 * binding, or `SCOUT_*` lookup in this module.
 *
 * @param {Object} [options]
 * @param {Object} [options.state] Durable-Object-shaped state double
 * @param {Object} [options.storage] raw storage double ({ get, put })
 * @param {Function} [options.now] injectable clock
 * @returns {Object} frozen backend with `admit(request)`
 */
export function createScoutRateLimitDurableObjectQuotaBackend(options = {}) {
  const opts = isPlainObject(options) ? options : {};
  const backend = new ScoutRateLimitDurableObjectQuota(opts.state || null, opts);

  return Object.freeze({
    kind: backend.kind,
    version: backend.version,
    hasStorage: backend.hasStorage,
    admit: (request) => backend.admit(request),
    handle: (request) => backend.handle(request),
  });
}

