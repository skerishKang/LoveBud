/**
 * Scout Live Auth / Rate-Limit Runtime Boundary Skeleton
 * v20260616-bearer-handoff-1
 *
 * Runtime boundary skeleton for the Scout live provider path.
 * Provides a dependency-injection seam and safe-fail defaults for
 * Firebase token verification and rate-limit checks.
 *
 * Provides:
 * - SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS / SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES constants
 * - createScoutLiveAuthBoundary: returns a boundary object that does NOT call any
 *   real Firebase Admin SDK
 * - createScoutLiveRateLimitBoundary: returns a boundary object that does NOT call
 *   any real KV / Durable Object / D1
 * - verifyScoutLiveAuthBoundary: parses Authorization header and optionally
 *   delegates to an injected mock verifier. Returns safe AUTH_REQUIRED /
 *   AUTH_INVALID results if no verifier is wired in.
 * - checkScoutLiveRateLimitBoundary: optionally delegates to an injected mock
 *   limiter. Returns safe RATE_LIMIT_UNAVAILABLE result if no limiter is wired
 *   in.
 *
 * This module is a **runtime boundary skeleton + DI seam**. No real Firebase
 * Admin SDK import, no real token verification, no real persistent storage
 * call, no fetch, no provider API call.
 *
 * Issue #2571 guarded Bearer token handoff:
 * - The default boundary NEVER includes the raw parsed Bearer token in
 *   the verifier payload.
 * - The boundary accepts an explicit non-default factory option
 *   `includeIdTokenForVerifier: true`. When set, the boundary builds a
 *   payload that includes the parsed token as `idToken` and forwards
 *   the payload to the verifier.
 * - The boundary still sanitizes the verifier response. The raw token
 *   never appears in the boundary response, userKey, userKeyHash,
 *   reason, rate-limit payload, request ids, logs, or error objects.
 * - The boundary continues to safe-fail on missing / malformed / empty
 *   / too-long Authorization headers before calling the verifier.
 * - Verifier exceptions continue to safe-fail without throw-through.
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
 * - No live provider execution
 */

'use strict';

// ─── Status Constants ─────────────────────────────────────────────────────────

export const SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS = Object.freeze({
  AUTHENTICATED: 'authenticated',
  AUTH_REQUIRED: 'auth_required',
  AUTH_INVALID: 'auth_invalid',
  RATE_LIMIT_ALLOWED: 'rate_limit_allowed',
  RATE_LIMITED: 'rate_limited',
  RATE_LIMIT_UNAVAILABLE: 'rate_limit_unavailable',
});

// ─── Error Codes ──────────────────────────────────────────────────────────────

export const SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES = Object.freeze({
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  RATE_LIMITED: 'RATE_LIMITED',
  RATE_LIMIT_UNAVAILABLE: 'RATE_LIMIT_UNAVAILABLE',
});

// ─── Internal Helpers ─────────────────────────────────────────────────────────

const BEARER_PREFIX = 'Bearer ';
const MAX_TOKEN_LENGTH = 4096;
const MAX_USER_KEY_LENGTH = 256;

function readAuthorizationHeader(request) {
  if (!request || typeof request !== 'object') return null;
  const headers = request.headers;
  if (!headers || typeof headers !== 'object') return null;

  const candidates = [
    headers.authorization,
    headers.Authorization,
    headers.AUTHORIZATION,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }

  if (typeof headers.get === 'function') {
    try {
      const v = headers.get('authorization');
      if (typeof v === 'string' && v.length > 0) return v;
    } catch {
      // ignore
    }
  }
  return null;
}

function parseAuthorizationHeader(rawHeader) {
  if (typeof rawHeader !== 'string') {
    return { ok: false, reason: 'missing' };
  }
  const trimmed = rawHeader.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'missing' };
  }
  if (!trimmed.startsWith(BEARER_PREFIX)) {
    return { ok: false, reason: 'malformed_scheme' };
  }
  const token = trimmed.slice(BEARER_PREFIX.length).trim();
  if (token.length === 0) {
    return { ok: false, reason: 'empty_token' };
  }
  if (token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: 'token_too_long' };
  }
  return { ok: true, token };
}

function safeUserKey(userId) {
  if (typeof userId !== 'string') return 'anon';
  const trimmed = userId.trim();
  if (trimmed.length === 0) return 'anon';
  return trimmed.slice(0, MAX_USER_KEY_LENGTH);
}

function hashPayloadForLimiter(payload) {
  // The limiter payload is normalized to a small shape that never contains
  // raw tokens, API keys, prompts, excerpts, or full source URLs.
  const bucket = payload && typeof payload.bucket === 'string' && payload.bucket.length > 0
    ? payload.bucket
    : 'default';
  return {
    userKey: payload && typeof payload.userKey === 'string' ? safeUserKey(payload.userKey) : 'anon',
    providerMode: payload && typeof payload.providerMode === 'string' ? payload.providerMode : 'unknown',
    bucket,
  };
}

function buildRateLimitQuotaBucket(request, authResult) {
  const userKey = authResult && authResult.userKey ? authResult.userKey : 'anon';
  return `scout:live:user:${userKey}`;
}

// ─── Auth Boundary Factory ────────────────────────────────────────────────────

// Allowlisted, derived verifier payload fields. The boundary only
// forwards these to the verifier, plus an opt-in `idToken` when the
// factory option `includeIdTokenForVerifier` is true.
const AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS = Object.freeze([
  'requestId',
  'authorizationScheme',
  'providerMode',
  'endpointPath',
  'nowMs',
]);

/**
 * Build a safe verifier payload from a parsed Bearer token and a
 * request context. The `idToken` field is included ONLY when
 * `includeIdToken` is true (the explicit guarded opt-in from issue
 * #2571). The raw token is never copied to any other field.
 *
 * @param {Object} parsed - { ok, token } from parseAuthorizationHeader
 * @param {Object} context - request context
 * @param {Object} [options]
 * @param {boolean} [options.includeIdToken] - guarded opt-in
 * @returns {Object} safe payload
 */
function buildAuthVerifierPayload(parsed, context, options) {
  const opts = (options && typeof options === 'object') ? options : {};
  const includeIdToken = opts.includeIdToken === true;
  const ctx = (context && typeof context === 'object') ? context : {};
  const out = {};
  // requestId
  if (typeof ctx.requestId === 'string' && ctx.requestId.length > 0) {
    out.requestId = ctx.requestId;
  }
  // authorizationScheme (always 'Bearer' when we reach this point)
  out.authorizationScheme = 'Bearer';
  // providerMode
  if (typeof ctx.providerMode === 'string' && ctx.providerMode.length > 0) {
    out.providerMode = ctx.providerMode;
  } else if (ctx.request && typeof ctx.request.providerMode === 'string') {
    out.providerMode = ctx.request.providerMode;
  }
  // endpointPath
  if (typeof ctx.endpointPath === 'string' && ctx.endpointPath.length > 0) {
    out.endpointPath = ctx.endpointPath;
  } else if (ctx.request && typeof ctx.request.endpointPath === 'string') {
    out.endpointPath = ctx.request.endpointPath;
  }
  // nowMs
  if (Number.isFinite(ctx.nowMs)) {
    out.nowMs = ctx.nowMs;
  } else if (Number.isFinite(Date.now())) {
    out.nowMs = Date.now();
  }
  // idToken — only with the explicit opt-in
  if (includeIdToken && parsed && parsed.ok === true && typeof parsed.token === 'string') {
    out.idToken = parsed.token;
  }
  // Sanity: drop anything that is not in the allowlist (defense in depth).
  for (const key of Object.keys(out)) {
    if (!AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS.includes(key) && key !== 'idToken') {
      delete out[key];
    }
  }
  return out;
}

/**
 * Creates a Scout live auth boundary.
 *
 * The boundary exposes an `authenticate(request, context)` method.
 * It NEVER calls a real Firebase Admin SDK. If `context.verifyToken` is
 * provided (e.g. a mock verifier for tests), the boundary calls it.
 * Otherwise the boundary returns safe AUTH_REQUIRED / AUTH_INVALID results.
 *
 * Issue #2571: the boundary accepts a guarded factory option
 * `includeIdTokenForVerifier: true`. When set, the parsed Bearer token
 * is forwarded to the verifier as `idToken` in a safe payload. When
 * unset (the default), the verifier is called with derived fields only
 * and the raw token never reaches the verifier seam.
 *
 * @param {Object} [options={}] - factory options
 * @param {Function} [options.verifyToken] - optional injected mock verifier
 * @param {boolean} [options.includeIdTokenForVerifier] - guarded opt-in to
 *   forward the parsed Bearer token to the verifier as `idToken`
 * @returns {Object} boundary
 */
export function createScoutLiveAuthBoundary(options = {}) {
  const opts = (options && typeof options === 'object') ? options : {};
  const injectedVerifyToken = (typeof opts.verifyToken === 'function') ? opts.verifyToken : null;
  const includeIdTokenForVerifier = opts.includeIdTokenForVerifier === true;

  return {
    kind: 'scout_live_auth_boundary',
    hasInjectedVerifier: injectedVerifyToken !== null,
    includeIdTokenForVerifier,

    async authenticate(request, context = {}) {
      const ctx = (context && typeof context === 'object') ? context : {};
      const verifier = (typeof ctx.verifyToken === 'function')
        ? ctx.verifyToken
        : injectedVerifyToken;

      const rawHeader = readAuthorizationHeader(request);
      if (rawHeader === null) {
        return {
          ok: false,
          status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.AUTH_REQUIRED,
          userKey: 'anon',
          error: {
            code: SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES.AUTH_REQUIRED,
            message: 'Scout live auth requires a Bearer token.',
          },
        };
      }

      const parsed = parseAuthorizationHeader(rawHeader);
      if (!parsed.ok) {
        return {
          ok: false,
          status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.AUTH_INVALID,
          userKey: 'anon',
          error: {
            code: SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES.AUTH_INVALID,
            message: 'Scout live auth header is malformed.',
          },
        };
      }

      if (typeof verifier !== 'function') {
        // No real Firebase Admin SDK call. Safe-fail to AUTH_INVALID.
        return {
          ok: false,
          status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.AUTH_INVALID,
          userKey: 'anon',
          error: {
            code: SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES.AUTH_INVALID,
            message: 'Scout live auth verifier is not configured.',
          },
        };
      }

      // Build the safe verifier payload. The `idToken` field is included
      // ONLY when the explicit guarded opt-in was set on the factory.
      const safePayload = buildAuthVerifierPayload(
        parsed,
        Object.assign({}, ctx, { request }),
        { includeIdToken: includeIdTokenForVerifier }
      );

      let verifierResult;
      try {
        verifierResult = await verifier(safePayload, ctx);
      } catch {
        return {
          ok: false,
          status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.AUTH_INVALID,
          userKey: 'anon',
          error: {
            code: SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES.AUTH_INVALID,
            message: 'Scout live auth verifier rejected the token.',
          },
        };
      }

      if (!verifierResult || typeof verifierResult !== 'object') {
        return {
          ok: false,
          status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.AUTH_INVALID,
          userKey: 'anon',
          error: {
            code: SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES.AUTH_INVALID,
            message: 'Scout live auth verifier returned an invalid result.',
          },
        };
      }

      // Support both legacy verifier shape ({ok, uid, ...}) and the new
      // dependency-adapter shape ({allowed, code, userKey, userKeyHash, ...}).
      const isSuccess = (
        verifierResult.ok === true ||
        verifierResult.allowed === true
      );
      if (!isSuccess) {
        return {
          ok: false,
          status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.AUTH_INVALID,
          userKey: 'anon',
          error: {
            code: SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES.AUTH_INVALID,
            message: 'Scout live auth verifier returned a non-success result.',
          },
        };
      }

      // Build a sanitized userKey from non-sensitive identifiers only.
      // The raw token is never copied to userKey / userKeyHash.
      const userId = (
        (typeof verifierResult.uid === 'string' && verifierResult.uid.length > 0)
          ? verifierResult.uid
          : (typeof verifierResult.userId === 'string' && verifierResult.userId.length > 0)
              ? verifierResult.userId
              : (typeof verifierResult.subject === 'string' && verifierResult.subject.length > 0)
                  ? verifierResult.subject
                  : (typeof verifierResult.userKey === 'string' && verifierResult.userKey.length > 0)
                      ? verifierResult.userKey
                      : 'anon'
      );
      return {
        ok: true,
        status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.AUTHENTICATED,
        userKey: safeUserKey(userId),
        // raw token is intentionally NOT included
        token: null,
        error: null,
      };
    },
  };
}

// ─── Rate-Limit Boundary Factory ───────────────────────────────────────────────

/**
 * Creates a Scout live rate-limit boundary.
 *
 * The boundary exposes a `check(request, authResult, context)` method.
 * It NEVER calls a real KV / Durable Object / D1. If `context.checkRateLimit`
 * is provided (e.g. a mock limiter for tests), the boundary calls it.
 * Otherwise the boundary returns safe RATE_LIMIT_UNAVAILABLE results.
 *
 * If `authResult.ok` is false, the limiter is NOT called.
 *
 * @param {Object} [options={}] - factory options
 * @param {Function} [options.checkRateLimit] - optional injected mock limiter
 * @returns {Object} boundary
 */
export function createScoutLiveRateLimitBoundary(options = {}) {
  const opts = (options && typeof options === 'object') ? options : {};
  const injectedCheckRateLimit = (typeof opts.checkRateLimit === 'function') ? opts.checkRateLimit : null;

  return {
    kind: 'scout_live_rate_limit_boundary',
    hasInjectedLimiter: injectedCheckRateLimit !== null,

    async check(request, authResult, context = {}) {
      const ctx = (context && typeof context === 'object') ? context : {};
      const limiter = (typeof ctx.checkRateLimit === 'function')
        ? ctx.checkRateLimit
        : injectedCheckRateLimit;

      const auth = (authResult && typeof authResult === 'object') ? authResult : { ok: false, userKey: 'anon' };

      if (auth.ok !== true) {
        // Do not call limiter if auth failed
        return {
          ok: false,
          status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.RATE_LIMIT_UNAVAILABLE,
          quotaBucket: '',
          retryAfterSeconds: 0,
          error: {
            code: SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
            message: 'Scout live rate-limit check skipped because auth did not succeed.',
          },
        };
      }

      if (typeof limiter !== 'function') {
        return {
          ok: false,
          status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.RATE_LIMIT_UNAVAILABLE,
          quotaBucket: buildRateLimitQuotaBucket(request, auth),
          retryAfterSeconds: 0,
          error: {
            code: SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
            message: 'Scout live rate-limit checker is not configured.',
          },
        };
      }

      const safePayload = hashPayloadForLimiter({
        userKey: auth.userKey,
        providerMode: (request && request.providerMode) || 'unknown',
        bucket: 'live',
      });

      let limiterResult;
      try {
        limiterResult = await limiter(safePayload, ctx);
      } catch {
        return {
          ok: false,
          status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.RATE_LIMIT_UNAVAILABLE,
          quotaBucket: safePayload.bucket ? `scout:live:user:${safePayload.userKey}` : 'scout:live:user:anon',
          retryAfterSeconds: 0,
          error: {
            code: SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
            message: 'Scout live rate-limit checker threw an exception.',
          },
        };
      }

      if (!limiterResult || typeof limiterResult !== 'object') {
        return {
          ok: false,
          status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.RATE_LIMIT_UNAVAILABLE,
          quotaBucket: `scout:live:user:${safePayload.userKey}`,
          retryAfterSeconds: 0,
          error: {
            code: SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
            message: 'Scout live rate-limit checker returned an invalid result.',
          },
        };
      }

      if (limiterResult.allowed === true) {
        return {
          ok: true,
          status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.RATE_LIMIT_ALLOWED,
          quotaBucket: typeof limiterResult.bucket === 'string' && limiterResult.bucket.length > 0
            ? limiterResult.bucket
            : `scout:live:user:${safePayload.userKey}`,
          retryAfterSeconds: 0,
          error: null,
        };
      }

      const retryAfter = Number.isFinite(limiterResult.retryAfterSeconds)
        ? Math.max(0, Math.floor(limiterResult.retryAfterSeconds))
        : 0;
      return {
        ok: false,
        status: SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS.RATE_LIMITED,
        quotaBucket: typeof limiterResult.bucket === 'string' && limiterResult.bucket.length > 0
          ? limiterResult.bucket
          : `scout:live:user:${safePayload.userKey}`,
        retryAfterSeconds: retryAfter,
        error: {
          code: SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES.RATE_LIMITED,
          message: 'Scout live request was rate-limited.',
        },
      };
    },
  };
}

// ─── Top-Level Wrappers ───────────────────────────────────────────────────────

/**
 * Verifies a Scout live auth boundary. Wraps `createScoutLiveAuthBoundary` for
 * one-shot use. The injected verifier (if any) is taken from `context.verifyToken`.
 *
 * Issue #2571: callers that need the guarded Bearer token handoff must use
 * the `createScoutLiveAuthBoundary` factory directly with the
 * `includeIdTokenForVerifier: true` option, because this one-shot wrapper
 * defaults to the safe (no-handoff) behavior.
 *
 * @param {Object} request - request-like object with `headers.authorization`
 * @param {Object} [context={}] - context (may include `verifyToken`)
 * @returns {Promise<Object>} { ok, status, userKey, error }
 */
export async function verifyScoutLiveAuthBoundary(request, context = {}) {
  const ctx = (context && typeof context === 'object') ? context : {};
  // Default: includeIdTokenForVerifier is false. The one-shot wrapper
  // intentionally does NOT forward a guarded handoff option.
  const boundary = createScoutLiveAuthBoundary({});
  return boundary.authenticate(request, ctx);
}

/**
 * Checks a Scout live rate-limit boundary. Wraps
 * `createScoutLiveRateLimitBoundary` for one-shot use. The injected limiter
 * (if any) is taken from `context.checkRateLimit`.
 *
 * @param {Object} request - request-like object
 * @param {Object} authResult - result from `verifyScoutLiveAuthBoundary`
 * @param {Object} [context={}] - context (may include `checkRateLimit`)
 * @returns {Promise<Object>} { ok, status, quotaBucket, retryAfterSeconds, error }
 */
export async function checkScoutLiveRateLimitBoundary(request, authResult, context = {}) {
  const ctx = (context && typeof context === 'object') ? context : {};
  const boundary = createScoutLiveRateLimitBoundary({});
  return boundary.check(request, authResult, ctx);
}
