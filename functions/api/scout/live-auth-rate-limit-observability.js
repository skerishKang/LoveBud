/**
 * Scout Live Auth/Rate-Limit Boundary Observability Helper
 * v20260607-1
 *
 * Pure sanitizer / event-builder / safe-observer-invoker for the Scout live
 * auth/rate-limit boundary decisions. NO fetch, NO console.log, NO external
 * logging backend, NO Firebase Admin SDK, NO KV/DO/D1, NO provider SDK.
 *
 * Provides:
 * - SCOUT_LIVE_OBSERVABILITY_FIELDS: allowlist of permitted event field names
 * - SCOUT_LIVE_OBSERVABILITY_DECISIONS: allowed boundary decision strings
 * - buildScoutLiveAuthEvent: pure builder for an auth decision event
 * - buildScoutLiveRateLimitEvent: pure builder for a rate-limit decision event
 * - sanitizeScoutLiveBoundaryEvent: pure normalizer that strips unknown fields
 *   and re-applies the allowlist
 * - safeInvokeScoutLiveObserver: safe-swallow wrapper around an injected
 *   observer's recordBoundaryDecision method. Never throws.
 * - createScoutLiveBoundaryObserver: factory returning an observer object
 *   that records events into a local in-memory ring buffer (test only).
 *
 * Sanitization policy:
 * - All event fields are normalized to the SCOUT_LIVE_OBSERVABILITY_FIELDS
 *   allowlist; unknown fields are dropped.
 * - requestId: redacted to safe alnum + _ - characters (max 128 chars).
 * - userKey: NEVER included as raw. userKeyHash is `hk_` prefix + safe-alnum
 *   derived from userKey (max 64 chars). This is a stable, redacted form
 *   suitable for cross-request correlation but never reversible to a raw uid.
 * - providerMode: forced to "live" for these events.
 * - errorCode: only one of AUTH_REQUIRED / AUTH_INVALID / RATE_LIMITED /
 *   RATE_LIMIT_UNAVAILABLE or null. Any other value is dropped to null.
 * - quotaBucket: redacted to safe alnum + _ : - characters (max 256 chars).
 * - latencyMs: forced to non-negative integer.
 * - retryAfterSeconds: forced to non-negative integer.
 *
 * This module is a **pure helper**. No I/O. No state. No fetch. No console.
 *
 * Non-goals:
 * - No real LLM provider call
 * - No provider SDK import
 * - No Firebase Admin SDK import
 * - No KV / Durable Object / D1 import
 * - No fetch / XHR / axios
 * - No console.log / console.error
 * - No external observability/logging backend integration
 * - No real logging backend
 * - No persistent rate-limit storage call
 * - No external URL fetch
 * - No auto-save or persistence
 */

'use strict';

// ─── Allowed Fields Allowlist ────────────────────────────────────────────────

export const SCOUT_LIVE_OBSERVABILITY_FIELDS = Object.freeze([
  'requestId',
  'providerMode',
  'boundaryDecision',
  'authStatus',
  'rateLimitStatus',
  'errorCode',
  'retryAfterSeconds',
  'quotaBucket',
  'userKeyHash',
  'latencyMs',
]);

const ALLOWED_FIELDS_SET = new Set(SCOUT_LIVE_OBSERVABILITY_FIELDS);

// ─── Allowed Decision Values ─────────────────────────────────────────────────

export const SCOUT_LIVE_OBSERVABILITY_DECISIONS = Object.freeze({
  AUTHENTICATED: 'authenticated',
  AUTH_REQUIRED: 'auth_required',
  AUTH_INVALID: 'auth_invalid',
  RATE_LIMIT_ALLOWED: 'rate_limit_allowed',
  RATE_LIMITED: 'rate_limited',
  RATE_LIMIT_UNAVAILABLE: 'rate_limit_unavailable',
});

const ALLOWED_DECISIONS_SET = new Set(Object.values(SCOUT_LIVE_OBSERVABILITY_DECISIONS));

const ALLOWED_ERROR_CODES = new Set([
  'AUTH_REQUIRED',
  'AUTH_INVALID',
  'RATE_LIMITED',
  'RATE_LIMIT_UNAVAILABLE',
]);

// ─── Internal Sanitizers (Pure) ──────────────────────────────────────────────

const MAX_REQUEST_ID_LENGTH = 128;
const MAX_USER_KEY_HASH_LENGTH = 64;
const MAX_QUOTA_BUCKET_LENGTH = 256;

function safeAlnum(s, maxLen) {
  if (typeof s !== 'string') return '';
  // Allow a-zA-Z0-9_-
  return s.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLen);
}

function safeAlnumExtended(s, maxLen) {
  // For quotaBucket: allow a-zA-Z0-9_:- and :
  if (typeof s !== 'string') return '';
  return s.replace(/[^a-zA-Z0-9_:\-]/g, '').slice(0, maxLen);
}

function safeNonNegativeInt(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  return Math.floor(n);
}

function safeRequestId(requestId) {
  if (typeof requestId !== 'string' || requestId.length === 0) {
    return 'req_anon';
  }
  return 'req_' + safeAlnum(requestId, MAX_REQUEST_ID_LENGTH);
}

function safeUserKeyHash(userKey) {
  if (typeof userKey !== 'string' || userKey.length === 0) {
    return 'hk_anon';
  }
  return 'hk_' + safeAlnum(userKey, MAX_USER_KEY_HASH_LENGTH);
}

function safeErrorCode(errorCode) {
  if (typeof errorCode !== 'string') return null;
  if (!ALLOWED_ERROR_CODES.has(errorCode)) return null;
  return errorCode;
}

function safeBoundaryDecision(value) {
  if (typeof value !== 'string') return SCOUT_LIVE_OBSERVABILITY_DECISIONS.RATE_LIMIT_UNAVAILABLE;
  if (!ALLOWED_DECISIONS_SET.has(value)) return SCOUT_LIVE_OBSERVABILITY_DECISIONS.RATE_LIMIT_UNAVAILABLE;
  return value;
}

function safeStatusForAuth(authResult) {
  if (!authResult || typeof authResult !== 'object') return SCOUT_LIVE_OBSERVABILITY_DECISIONS.AUTH_INVALID;
  if (authResult.ok === true) return SCOUT_LIVE_OBSERVABILITY_DECISIONS.AUTHENTICATED;
  if (typeof authResult.status === 'string' && ALLOWED_DECISIONS_SET.has(authResult.status)) {
    return authResult.status;
  }
  return SCOUT_LIVE_OBSERVABILITY_DECISIONS.AUTH_INVALID;
}

function safeStatusForRateLimit(rateLimitResult) {
  if (!rateLimitResult || typeof rateLimitResult !== 'object') {
    return SCOUT_LIVE_OBSERVABILITY_DECISIONS.RATE_LIMIT_UNAVAILABLE;
  }
  if (rateLimitResult.ok === true) {
    return SCOUT_LIVE_OBSERVABILITY_DECISIONS.RATE_LIMIT_ALLOWED;
  }
  if (typeof rateLimitResult.status === 'string' && ALLOWED_DECISIONS_SET.has(rateLimitResult.status)) {
    return rateLimitResult.status;
  }
  return SCOUT_LIVE_OBSERVABILITY_DECISIONS.RATE_LIMIT_UNAVAILABLE;
}

// ─── Pure Event Builders ─────────────────────────────────────────────────────

/**
 * Builds a sanitized observability event for an auth decision.
 *
 * @param {Object} input
 * @param {string} [input.requestId]
 * @param {Object} input.authResult - the boundary auth result
 * @param {number} [input.latencyMs=0]
 * @returns {Object} sanitized event with allowlist keys only
 */
export function buildScoutLiveAuthEvent(input = {}) {
  const i = (input && typeof input === 'object') ? input : {};
  const authResult = i.authResult;
  const authStatus = safeStatusForAuth(authResult);
  const isAuthOk = authResult && authResult.ok === true;
  const boundaryDecision = isAuthOk
    ? SCOUT_LIVE_OBSERVABILITY_DECISIONS.AUTHENTICATED
    : (authStatus === SCOUT_LIVE_OBSERVABILITY_DECISIONS.AUTH_REQUIRED
      ? SCOUT_LIVE_OBSERVABILITY_DECISIONS.AUTH_REQUIRED
      : SCOUT_LIVE_OBSERVABILITY_DECISIONS.AUTH_INVALID);
  return {
    requestId: safeRequestId(i.requestId),
    providerMode: 'live',
    boundaryDecision: safeBoundaryDecision(boundaryDecision),
    authStatus: safeBoundaryDecision(authStatus),
    rateLimitStatus: null,
    errorCode: isAuthOk ? null : safeErrorCode(authResult && authResult.error && authResult.error.code),
    retryAfterSeconds: 0,
    quotaBucket: '',
    userKeyHash: safeUserKeyHash(authResult && authResult.userKey),
    latencyMs: safeNonNegativeInt(i.latencyMs),
  };
}

/**
 * Builds a sanitized observability event for a rate-limit decision.
 *
 * @param {Object} input
 * @param {string} [input.requestId]
 * @param {Object} [input.authResult] - upstream auth result (only safe fields used)
 * @param {Object} input.rateLimitResult - the boundary rate-limit result
 * @param {number} [input.latencyMs=0]
 * @returns {Object} sanitized event with allowlist keys only
 */
export function buildScoutLiveRateLimitEvent(input = {}) {
  const i = (input && typeof input === 'object') ? input : {};
  const authResult = i.authResult;
  const rateLimitResult = i.rateLimitResult;
  const rateLimitStatus = safeStatusForRateLimit(rateLimitResult);
  const isAllowed = rateLimitResult && rateLimitResult.ok === true;
  return {
    requestId: safeRequestId(i.requestId),
    providerMode: 'live',
    boundaryDecision: safeBoundaryDecision(rateLimitStatus),
    authStatus: authResult ? safeBoundaryDecision(safeStatusForAuth(authResult)) : null,
    rateLimitStatus: safeBoundaryDecision(rateLimitStatus),
    errorCode: isAllowed ? null : safeErrorCode(rateLimitResult && rateLimitResult.error && rateLimitResult.error.code),
    retryAfterSeconds: isAllowed
      ? 0
      : safeNonNegativeInt(rateLimitResult && rateLimitResult.retryAfterSeconds),
    quotaBucket: safeAlnumExtended(
      rateLimitResult && rateLimitResult.quotaBucket,
      MAX_QUOTA_BUCKET_LENGTH
    ),
    userKeyHash: safeUserKeyHash(authResult && authResult.userKey),
    latencyMs: safeNonNegativeInt(i.latencyMs),
  };
}

// ─── Event Sanitizer (drops unknown fields, re-applies allowlist) ────────────

/**
 * Sanitizes a candidate event object. Returns a new object with only allowed
 * fields, each re-normalized. Drops unknown fields, ignores null/undefined.
 * Never throws.
 *
 * @param {Object} event - candidate event
 * @returns {Object} sanitized event
 */
export function sanitizeScoutLiveBoundaryEvent(event) {
  if (!event || typeof event !== 'object') {
    return {
      requestId: 'req_anon',
      providerMode: 'live',
      boundaryDecision: SCOUT_LIVE_OBSERVABILITY_DECISIONS.RATE_LIMIT_UNAVAILABLE,
      authStatus: null,
      rateLimitStatus: SCOUT_LIVE_OBSERVABILITY_DECISIONS.RATE_LIMIT_UNAVAILABLE,
      errorCode: null,
      retryAfterSeconds: 0,
      quotaBucket: '',
      userKeyHash: 'hk_anon',
      latencyMs: 0,
    };
  }
  const out = {};
  for (const key of SCOUT_LIVE_OBSERVABILITY_FIELDS) {
    if (!(key in event)) continue;
    const v = event[key];
    if (v === undefined) continue;
    out[key] = v;
  }
  // Re-normalize each field
  out.requestId = safeRequestId(out.requestId);
  out.providerMode = 'live';
  out.boundaryDecision = safeBoundaryDecision(out.boundaryDecision);
  out.authStatus = out.authStatus === null || out.authStatus === undefined
    ? null
    : safeBoundaryDecision(out.authStatus);
  out.rateLimitStatus = out.rateLimitStatus === null || out.rateLimitStatus === undefined
    ? null
    : safeBoundaryDecision(out.rateLimitStatus);
  out.errorCode = safeErrorCode(out.errorCode);
  out.retryAfterSeconds = safeNonNegativeInt(out.retryAfterSeconds);
  out.quotaBucket = safeAlnumExtended(out.quotaBucket, MAX_QUOTA_BUCKET_LENGTH);
  out.userKeyHash = safeUserKeyHash(out.userKeyHash);
  out.latencyMs = safeNonNegativeInt(out.latencyMs);
  return out;
}

// ─── Safe Observer Invocation ────────────────────────────────────────────────

/**
 * Invokes an injected observer's `recordBoundaryDecision(event)` method with
 * the sanitized event. Never throws. Returns metadata about what happened.
 *
 * Behavior:
 * - If observer is missing or not a valid object → { ok: true, called: false }
 * - If observer.recordBoundaryDecision is not a function → { ok: true, called: false }
 * - If observer throws → { ok: false, called: true, error: 'swallowed' }
 * - Otherwise → { ok: true, called: true }
 *
 * @param {Object} observer - injected observer (may be null/undefined)
 * @param {Object} event - sanitized event
 * @returns {{ ok: boolean, called: boolean, error?: string }}
 */
export function safeInvokeScoutLiveObserver(observer, event) {
  if (!observer || typeof observer !== 'object') {
    return { ok: true, called: false };
  }
  if (typeof observer.recordBoundaryDecision !== 'function') {
    return { ok: true, called: false };
  }
  try {
    observer.recordBoundaryDecision(event);
    return { ok: true, called: true };
  } catch {
    return { ok: false, called: true, error: 'swallowed' };
  }
}

// ─── Test Boundary Observer Factory ──────────────────────────────────────────

const RING_BUFFER_DEFAULT_CAPACITY = 64;

function makeRingBuffer(capacity) {
  const cap = Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : RING_BUFFER_DEFAULT_CAPACITY;
  const buf = [];
  return {
    push(item) {
      buf.push(item);
      if (buf.length > cap) buf.shift();
    },
    snapshot() {
      return buf.slice();
    },
    size() {
      return buf.length;
    },
    clear() {
      buf.length = 0;
    },
  };
}

/**
 * Creates an in-memory Scout live boundary observer. The observer stores
 * sanitized events in a bounded ring buffer. Intended for tests only.
 *
 * The observer's `recordBoundaryDecision` is synchronous and never throws
 * (any thrown error would indicate a contract violation by the caller; the
 * buffer just refuses the event).
 *
 * @param {Object} [options={}]
 * @param {number} [options.capacity=64]
 * @returns {Object} observer
 */
export function createScoutLiveBoundaryObserver(options = {}) {
  const opts = (options && typeof options === 'object') ? options : {};
  const buffer = makeRingBuffer(opts.capacity);
  return {
    kind: 'scout_live_boundary_observer',
    recordBoundaryDecision(event) {
      // Pure contract: accept only sanitized events with allowlist keys.
      if (!event || typeof event !== 'object') return;
      buffer.push(event);
    },
    events: {
      snapshot: () => buffer.snapshot(),
      size: () => buffer.size(),
      clear: () => buffer.clear(),
    },
  };
}

// ─── Convenience: process a boundary result through the helper ───────────────

/**
 * Pure helper: builds + sanitizes an event for an auth or rate-limit decision.
 * Returns the sanitized event without invoking any observer.
 *
 * @param {'auth'|'rate_limit'} kind
 * @param {Object} input
 * @returns {Object} sanitized event
 */
export function buildScoutLiveBoundaryEvent(kind, input = {}) {
  if (kind === 'auth') return buildScoutLiveAuthEvent(input);
  if (kind === 'rate_limit') return buildScoutLiveRateLimitEvent(input);
  return sanitizeScoutLiveBoundaryEvent(input);
}
