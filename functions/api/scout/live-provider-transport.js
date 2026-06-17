/**
 * Scout Live Provider Transport Seam
 * v20260617-1
 *
 * Defines the transport interface contract for Scout live provider execution.
 * This module is injection-only by default:
 * - No real fetch/network call
 * - No provider SDK import (OpenAI, Anthropic, Gemini, Groq, Mistral, etc.)
 * - No API key storage or default
 * - No frontend/browser provider call
 * - Real transport can only be passed in by tests or staging config, never in production default
 *
 * Usage:
 *   const transport = createScoutLiveProviderTransport({ mode: 'disabled' });
 *   const result = await transport.call({ url, method, headers, body });
 *   // → { ok: false, error: { code: 'TRANSPORT_DISABLED', ... } }
 *
 *   For tests:
 *   const transport = createScoutLiveProviderTransport({ mode: 'injected', execute: myMockFn });
 *   const result = await transport.call({ url, method, headers, body });
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION = '0.0.1-seam';

const SCOUT_LIVE_PROVIDER_TRANSPORT_MODES = Object.freeze({
  DISABLED: 'disabled',
  INJECTED: 'injected',
});

const SCOUT_LIVE_PROVIDER_TRANSPORT_CODES = Object.freeze({
  TRANSPORT_DISABLED: 'TRANSPORT_DISABLED',
  TRANSPORT_MISSING: 'TRANSPORT_MISSING',
  TRANSPORT_ERROR: 'TRANSPORT_ERROR',
  TRANSPORT_VALIDATION_ERROR: 'TRANSPORT_VALIDATION_ERROR',
  OK: 'OK',
});

// Prohibited field patterns in transport responses — must not leak to callers.
// These are checked in sanitizeScoutTransportError only.
const SCOUT_TRANSPORT_PROHIBITED_RESPONSE_FIELDS = Object.freeze([
  'rawProviderResponse',
  'rawModelOutput',
  'authorization',
  'Authorization',
  'apiKey',
  'API_KEY',
  'token',
  'bearer',
  'secret',
  'password',
  'prompt',
  'excerpt',
  'sourceUrl',
  'rawRequestBody',
  'firebaseToken',
  'sessionCookie',
  'cookie',
  'uid',
  'email',
]);

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates a transport call request shape.
 * Pure function — no network, no side effects.
 *
 * @param {Object} req - { url, method, headers, body }
 * @returns {{ ok: boolean, error?: { code: string, message: string } }}
 */
function validateScoutTransportRequest(req) {
  if (!req || typeof req !== 'object' || Array.isArray(req)) {
    return {
      ok: false,
      error: {
        code: SCOUT_LIVE_PROVIDER_TRANSPORT_CODES.TRANSPORT_VALIDATION_ERROR,
        message: 'Transport request must be a non-null object.',
      },
    };
  }

  if (typeof req.url !== 'string' || req.url.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: SCOUT_LIVE_PROVIDER_TRANSPORT_CODES.TRANSPORT_VALIDATION_ERROR,
        message: 'Transport request url must be a non-empty string.',
      },
    };
  }

  if (typeof req.method !== 'string' || req.method.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: SCOUT_LIVE_PROVIDER_TRANSPORT_CODES.TRANSPORT_VALIDATION_ERROR,
        message: 'Transport request method must be a non-empty string.',
      },
    };
  }

  return { ok: true };
}

// ─── Error Sanitizer ──────────────────────────────────────────────────────────

/**
 * Returns a sanitized error code and message from a transport failure.
 * Ensures no secret/credential/PII leaks through error messages.
 *
 * @param {Error|unknown} err - The thrown error from transport
 * @returns {{ code: string, message: string }}
 */
function sanitizeScoutTransportError(err) {
  // Never expose raw error messages — they may contain URL, Auth, key fragments.
  // Only expose a generic safe-fail message.
  return {
    code: SCOUT_LIVE_PROVIDER_TRANSPORT_CODES.TRANSPORT_ERROR,
    message: 'Scout provider transport failed safely. Provider response was not returned.',
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a Scout live provider transport seam instance.
 *
 * Default mode: disabled — all calls return TRANSPORT_DISABLED safe-fail.
 * Injected mode: passes through to the injected execute function (test/local only).
 *
 * @param {Object} [options]
 * @param {string} [options.mode] - 'disabled' (default) or 'injected'
 * @param {Function} [options.execute] - Required when mode is 'injected'. Receives { url, method, headers, body }, returns parsed response object.
 * @returns {Object} transport seam — { version, mode, status, call }
 */
function createScoutLiveProviderTransport(options) {
  const opts = options || {};
  const rawMode = typeof opts.mode === 'string' ? opts.mode.trim().toLowerCase() : '';
  const mode = rawMode === SCOUT_LIVE_PROVIDER_TRANSPORT_MODES.INJECTED
    ? SCOUT_LIVE_PROVIDER_TRANSPORT_MODES.INJECTED
    : SCOUT_LIVE_PROVIDER_TRANSPORT_MODES.DISABLED;

  const execute = mode === SCOUT_LIVE_PROVIDER_TRANSPORT_MODES.INJECTED && typeof opts.execute === 'function'
    ? opts.execute
    : null;

  const status = (mode === SCOUT_LIVE_PROVIDER_TRANSPORT_MODES.INJECTED && execute !== null)
    ? 'ready'
    : 'disabled';

  return Object.freeze({
    version: SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION,
    mode,
    status,

    /**
     * Executes a provider transport request.
     *
     * - disabled mode: always returns TRANSPORT_DISABLED (no network call)
     * - injected mode without execute: returns TRANSPORT_MISSING
     * - injected mode with execute: delegates to injected function
     *
     * @param {Object} req - { url, method, headers, body }
     * @returns {Promise<{ ok: boolean, response?: Object, error?: { code: string, message: string } }>}
     */
    async call(req) {
      if (mode === SCOUT_LIVE_PROVIDER_TRANSPORT_MODES.DISABLED) {
        return {
          ok: false,
          error: {
            code: SCOUT_LIVE_PROVIDER_TRANSPORT_CODES.TRANSPORT_DISABLED,
            message: 'Scout live provider transport is disabled. No external provider call was made.',
          },
        };
      }

      if (!execute) {
        return {
          ok: false,
          error: {
            code: SCOUT_LIVE_PROVIDER_TRANSPORT_CODES.TRANSPORT_MISSING,
            message: 'Injected transport execute function is required but was not provided.',
          },
        };
      }

      // Validate request shape before calling
      const validationResult = validateScoutTransportRequest(req);
      if (!validationResult.ok) {
        return validationResult;
      }

      try {
        const response = await execute(req);
        return {
          ok: true,
          response,
        };
      } catch (err) {
        // Sanitize error: never expose raw transport error messages
        const sanitized = sanitizeScoutTransportError(err);
        return {
          ok: false,
          error: sanitized,
        };
      }
    },
  });
}

/**
 * Returns a disabled transport seam (convenience alias).
 * Intended for use in production default path.
 *
 * @returns {Object} disabled transport seam
 */
function createScoutDisabledProviderTransport() {
  return createScoutLiveProviderTransport({ mode: 'disabled' });
}

/**
 * Returns a transport seam wrapping an injected execute function.
 * For test / local-only use only.
 *
 * @param {Function} execute - The injected execute function
 * @returns {Object} injected transport seam
 */
function createScoutInjectedProviderTransport(execute) {
  return createScoutLiveProviderTransport({ mode: 'injected', execute });
}

export {
  SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION,
  SCOUT_LIVE_PROVIDER_TRANSPORT_MODES,
  SCOUT_LIVE_PROVIDER_TRANSPORT_CODES,
  SCOUT_TRANSPORT_PROHIBITED_RESPONSE_FIELDS,
  validateScoutTransportRequest,
  sanitizeScoutTransportError,
  createScoutLiveProviderTransport,
  createScoutDisabledProviderTransport,
  createScoutInjectedProviderTransport,
};
