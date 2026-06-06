/**
 * Scout Live Auth / Rate-Limit Runtime Boundary Skeleton
 * v20260607-1
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
 * Non-goals:
 * - No real LLM provider call
 * - No provider SDK import
 * - No Firebase Admin SDK import
 * - No Firebase token verification
 * - No KV / Durable Object / D1 import
 * - No persistent rate-limit storage call
 * - No external URL fetch
 * - No auto-save or persistence
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

/**
 * Creates a Scout live auth boundary.
 *
 * The boundary exposes an `authenticate(request, context)` method.
 * It NEVER calls a real Firebase Admin SDK. If `context.verifyToken` is
 * provided (e.g. a mock verifier for tests), the boundary calls it.
 * Otherwise the boundary returns safe AUTH_REQUIRED / AUTH_INVALID results.
 *
 * @param {Object} [options={}] - factory options
 * @param {Function} [options.verifyToken] - optional injected mock verifier
 * @returns {Object} boundary
 */
export function createScoutLiveAuthBoundary(options = {}) {
  const opts = (options && typeof options === 'object') ? options : {};
  const injectedVerifyToken = (typeof opts.verifyToken === 'function') ? opts.verifyToken : null;

  return {
    kind: 'scout_live_auth_boundary',
    hasInjectedVerifier: injectedVerifyToken !== null,

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

      let verifierResult;
      try {
        verifierResult = await verifier(parsed.token, ctx);
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

      if (!verifierResult || typeof verifierResult !== 'object' || verifierResult.ok !== true) {
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

      const userId = verifierResult.uid || verifierResult.userId || verifierResult.subject || 'anon';
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
 * @param {Object} request - request-like object with `headers.authorization`
 * @param {Object} [context={}] - context (may include `verifyToken`)
 * @returns {Promise<Object>} { ok, status, userKey, error }
 */
export async function verifyScoutLiveAuthBoundary(request, context = {}) {
  const ctx = (context && typeof context === 'object') ? context : {};
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
