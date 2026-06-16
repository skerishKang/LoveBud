/**
 * Scout Live Auth Verifier Adapter Skeleton
 * v20260616-firebase-mode-1
 *
 * Mock-disabled auth verifier adapter skeleton for the Scout live provider
 * path. Provides a future interface for Firebase-style auth token
 * verification (e.g. Firebase Admin SDK `verifyIdToken`, or an equivalent
 * custom auth service) **without** actually calling any external auth
 * backend in this slice.
 *
 * Provides:
 * - SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION: skeleton version
 * - SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES: status / mode constants
 *   (MOCK_DISABLED, NOT_IMPLEMENTED, FIREBASE_DISABLED,
 *   FIREBASE_CONFIG_MISSING, FIREBASE_RUNTIME)
 * - SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES: response code constants
 *   (VERIFIER_MOCK_DISABLED, VERIFIER_NOT_IMPLEMENTED,
 *   VERIFIER_PAYLOAD_PROHIBITED, VERIFIER_FIREBASE_DISABLED,
 *   VERIFIER_CONFIG_MISSING, VERIFIER_FIREBASE_RUNTIME_DISABLED,
 *   VERIFIER_FIREBASE_RUNTIME_FAILED, VERIFIER_FIREBASE_RUNTIME_VERIFIED)
 * - SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS: allowlist for
 *   future-safe fields that may be present in a verifier payload
 * - SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_PROHIBITED_FIELDS: denylist for
 *   sensitive fields that must never enter a verifier payload, response,
 *   log, or storage record
 * - sanitizeScoutLiveAuthVerifierPayload: pure helper that strips
 *   prohibited fields from a verifier payload (drop or reject modes)
 * - createScoutLiveAuthVerifierAdapter: factory
 *
 * This module is a **mock-disabled skeleton + factory**. No Firebase
 * Admin SDK, no `getAuth`, no `verifyIdToken`, no external auth service,
 * no fetch, no env auth binding is accessed by the default factory. The
 * factory returns safe "mock-disabled" or "not-implemented" responses from
 * `verifyToken` so the endpoint can never accidentally verify a real
 * token while the skeleton is in place.
 *
 * Gate step 3 scaffold: when the factory is called with
 * `{ mockDisabled: false, verifierMode: "firebase_disabled" }`, it
 * returns a Firebase scaffold adapter that safe-fails with
 * `VERIFIER_FIREBASE_DISABLED` (or `VERIFIER_CONFIG_MISSING` if the
 * scaffold is asked for the config-missing branch). The scaffold does
 * NOT import or call the Firebase Admin SDK, does NOT verify any token,
 * and does NOT read any env / secret. It exists so that a future
 * implementation PR can fill in the verification logic without changing
 * the factory signature or the mode / code surface.
 *
 * Firebase runtime mode (issue #2567): when the factory is called with
 * `{ mockDisabled: false, verifierMode: "firebase" }`, it returns a
 * Firebase runtime adapter that:
 * - is **disabled-by-default** (only entered when both flags are
 *   explicitly set);
 * - does **not** import the Firebase Admin SDK;
 * - does **not** initialize any auth service at module import time or
 *   at factory construction time;
 * - does **not** verify tokens at import time;
 * - requires an explicit `firebaseConfig` object AND an explicit
 *   `firebaseVerifier` async function to be supplied via options. If
 *   either is missing, the adapter safe-fails with
 *   `VERIFIER_FIREBASE_RUNTIME_DISABLED` (or `VERIFIER_CONFIG_MISSING`
 *   when the call is reached without the runtime config being present);
 * - lazily calls the injected `firebaseVerifier(idToken)` only when
 *   `verifyToken` is invoked;
 * - sanitizes the success response: only a `userKeyHash` derived from
 *   the verifier's returned identifier is kept; raw UID, raw email,
 *   raw decoded token, raw claims, and raw service account data are
 *   dropped. The success path returns
 *   `code: VERIFIER_FIREBASE_RUNTIME_VERIFIED` (NOT any disabled or
 *   failed code) so that downstream mapping cannot interpret a
 *   successful verification as a disabled or failed state;
 * - safe-fails (returns `allowed: false` with
 *   `VERIFIER_FIREBASE_RUNTIME_FAILED`) on any thrown or rejected
 *   verifier error, never throwing through the endpoint boundary;
 * - never logs, returns, persists, or echoes the raw token, raw
 *   Authorization header, raw decoded token, raw Firebase claims, raw
 *   email, or raw service account key.
 *
 * Non-goals:
 * - No real LLM provider call
 * - No provider SDK import
 * - No Firebase Admin SDK import
 * - No automatic token verification
 * - No getAuth / verifyIdToken / cert / initializeApp call performed by
 *   this module
 * - No external auth service call performed by this module
 * - No fetch / XMLHttpRequest / axios
 * - No env auth binding access
 * - No raw token, authorization header, API key, or session cookie
 *   in any response, log, or storage payload
 * - No wiring into suggest.js LIVE branch (separate slice)
 */

'use strict';

// ─── Version ────────────────────────────────────────────────────────────────

export const SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION = '20260616-firebase-mode-1';

// ─── Verifier Mode Constants ────────────────────────────────────────────────

export const SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES = Object.freeze({
  MOCK_DISABLED: 'mock_disabled',
  NOT_IMPLEMENTED: 'not_implemented',
  FIREBASE_DISABLED: 'firebase_disabled',
  FIREBASE_CONFIG_MISSING: 'firebase_config_missing',
  FIREBASE_RUNTIME: 'firebase',
});

// ─── Response Codes ─────────────────────────────────────────────────────────

export const SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES = Object.freeze({
  VERIFIER_MOCK_DISABLED: 'VERIFIER_MOCK_DISABLED',
  VERIFIER_NOT_IMPLEMENTED: 'VERIFIER_NOT_IMPLEMENTED',
  VERIFIER_PAYLOAD_PROHIBITED: 'VERIFIER_PAYLOAD_PROHIBITED',
  VERIFIER_FIREBASE_DISABLED: 'VERIFIER_FIREBASE_DISABLED',
  VERIFIER_CONFIG_MISSING: 'VERIFIER_CONFIG_MISSING',
  VERIFIER_FIREBASE_RUNTIME_DISABLED: 'VERIFIER_FIREBASE_RUNTIME_DISABLED',
  VERIFIER_FIREBASE_RUNTIME_FAILED: 'VERIFIER_FIREBASE_RUNTIME_FAILED',
  VERIFIER_FIREBASE_RUNTIME_VERIFIED: 'VERIFIER_FIREBASE_RUNTIME_VERIFIED',
});

// ─── Payload Policy ─────────────────────────────────────────────────────────

// Only future-safe, derived, non-sensitive fields are allowed to enter a
// verifier payload. A token hash, scheme, request id, or a generated
// nonce is acceptable; the raw token, raw authorization header, raw API
// key, or raw request body is not.
export const SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS = Object.freeze([
  'requestId',
  'tokenHash',
  'authorizationScheme',
  'providerMode',
  'endpointPath',
  'nowMs',
]);

// Sensitive fields that must never be returned, logged, persisted, or
// routed through the verifier payload. The list is the single source
// of truth at the verifier seam; sanitizePayload enforces it.
export const SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_PROHIBITED_FIELDS = Object.freeze([
  'token',
  'rawToken',
  'authorization',
  'authorizationHeader',
  'apiKey',
  'secret',
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
  'prompt',
  'excerpt',
  'sourceUrl',
  'rawRequestBody',
]);

// ─── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_OPTIONS = Object.freeze({
  mockDisabled: true,
  onProhibitedField: 'drop', // 'drop' | 'reject'
});

// ─── Pure Helper: sanitizeScoutLiveAuthVerifierPayload ──────────────────────

/**
 * Pure helper: strip prohibited fields from an auth verifier payload.
 * Returns a new object with only allowed fields. Prohibited fields are
 * dropped (default) or cause the helper to return a rejection result.
 *
 * @param {Object} payload
 * @param {Object} [options]
 * @param {string} [options.onProhibitedField='drop'] - 'drop' or 'reject'
 * @returns {Object} { payload: sanitized, rejected: boolean, rejectedFields: string[] }
 */
export function sanitizeScoutLiveAuthVerifierPayload(payload, options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
  const src = (payload && typeof payload === 'object') ? payload : {};
  const out = {};
  const rejectedFields = [];

  for (const key of Object.keys(src)) {
    if (SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_PROHIBITED_FIELDS.includes(key)) {
      rejectedFields.push(key);
      if (opts.onProhibitedField === 'reject') {
        // Reject immediately: return empty payload with rejected flag
        return { payload: {}, rejected: true, rejectedFields };
      }
      // 'drop': skip this field
      continue;
    }
    // Only copy allowed fields
    if (SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS.includes(key)) {
      out[key] = src[key];
    }
    // Unknown fields are also dropped (allowlist-only)
  }

  return { payload: out, rejected: false, rejectedFields };
}

// ─── Internal Response Builders ─────────────────────────────────────────────

function buildMockDisabledVerifyResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_MOCK_DISABLED,
    reason: 'Live auth verifier adapter is mock-disabled; no real verification is performed.',
    userKey: null,
    userKeyHash: null,
  };
}

function buildNotImplementedVerifyResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_NOT_IMPLEMENTED,
    reason: 'Live auth verifier adapter is not implemented; real verification is required.',
    userKey: null,
    userKeyHash: null,
  };
}

function buildFirebaseDisabledVerifyResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_DISABLED,
    reason: 'Firebase auth verifier runtime scaffold is disabled; no real verification is performed in this scaffold slice.',
    userKey: null,
    userKeyHash: null,
  };
}

function buildFirebaseConfigMissingVerifyResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_CONFIG_MISSING,
    reason: 'Firebase auth verifier runtime scaffold is missing required configuration; no real verification is performed.',
    userKey: null,
    userKeyHash: null,
  };
}

function buildFirebaseRuntimeDisabledVerifyResponse() {
  return {
    allowed: false,
    code: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_RUNTIME_DISABLED,
    reason: 'Firebase auth verifier runtime mode is disabled by default; explicit firebaseConfig and firebaseVerifier are required.',
    userKey: null,
    userKeyHash: null,
  };
}

function buildFirebaseRuntimeFailedVerifyResponse(reason) {
  return {
    allowed: false,
    code: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_RUNTIME_FAILED,
    reason: typeof reason === 'string' && reason.length > 0
      ? reason
      : 'Firebase auth verifier runtime call failed safely; no real verification result is returned.',
    userKey: null,
    userKeyHash: null,
  };
}

// ─── Sanitized Identifier Derivation ───────────────────────────────────────

/**
 * Derive a non-reversible `userKeyHash` from a raw identifier returned by
 * an injected Firebase verifier. The function never returns the raw UID,
 * raw email, raw decoded token, or raw claims. Only a deterministic
 * 16-character hex digest and a length hint are produced.
 *
 * @param {*} rawIdentifier
 * @returns {string|null} 16-character lowercase hex string, or null if no
 *   identifier is provided.
 */
function deriveUserKeyHash(rawIdentifier) {
  if (rawIdentifier === null || rawIdentifier === undefined) return null;
  if (typeof rawIdentifier !== 'string' && typeof rawIdentifier !== 'number') {
    return null;
  }
  const s = String(rawIdentifier);
  if (s.length === 0) return null;
  // FNV-1a 32-bit hash, hex-encoded, fixed width 8 chars
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  const hex = h.toString(16).padStart(8, '0');
  // 16 chars: 8 hex + 8 hex (length-derived) — keeps determinism but never
  // echoes the raw identifier.
  const lenHex = (s.length & 0xffffffff).toString(16).padStart(8, '0');
  return (hex + lenHex).toLowerCase();
}

// ─── Factory: createScoutLiveAuthVerifierAdapter ────────────────────────────

/**
 * Resolve the verifier mode from options. The default is MOCK_DISABLED.
 * The Firebase scaffold modes (FIREBASE_DISABLED, FIREBASE_CONFIG_MISSING)
 * are only entered when `mockDisabled: false` AND an explicit
 * `verifierMode` option is provided. The default `options = {}` and the
 * `options = { mockDisabled: false }` paths preserve the existing
 * mock-disabled / not-implemented behavior.
 *
 * @param {Object} opts
 * @returns {string} one of the SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES values
 */
function resolveVerifierMode(opts) {
  if (opts.mockDisabled !== false) {
    return SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.MOCK_DISABLED;
  }
  if (opts.verifierMode === SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME) {
    return SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME;
  }
  if (opts.verifierMode === SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED) {
    return SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED;
  }
  if (opts.verifierMode === SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING) {
    return SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING;
  }
  return SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.NOT_IMPLEMENTED;
}

/**
 * Create a Scout live auth verifier adapter.
 *
 * @param {Object} [options]
 * @param {boolean} [options.mockDisabled=true] when true (default), returns
 *   safe mock-disabled responses from verifyToken. When false, returns
 *   "not implemented" responses (or Firebase scaffold responses if
 *   `verifierMode` is also provided).
 * @param {string} [options.verifierMode] - optional explicit mode. When
 *   `mockDisabled: false` AND `verifierMode` is one of
 *   `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED`,
 *   `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING`,
 *   or `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME`, the
 *   factory returns the corresponding adapter. Any other value (or no
 *   value) keeps the existing not-implemented behavior.
 * @param {string} [options.onProhibitedField='drop'] - 'drop' or 'reject'
 * @param {Object} [options.firebaseConfig] - explicit Firebase config
 *   object. Required only for FIREBASE_RUNTIME mode. Never read from
 *   env or process.
 * @param {Function} [options.firebaseVerifier] - async
 *   `(idToken, firebaseConfig) => { uid?, userKey? }`. Required only for
 *   FIREBASE_RUNTIME mode. Injected for testability; the factory itself
 *   does not import the Firebase Admin SDK and does not bind to env.
 * @returns {Object} frozen adapter
 */
export function createScoutLiveAuthVerifierAdapter(options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});
  const mockDisabled = opts.mockDisabled !== false;
  const resolvedMode = resolveVerifierMode(opts);

  if (resolvedMode === SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.MOCK_DISABLED) {
    return Object.freeze({
      kind: 'scout_live_auth_verifier_adapter',
      version: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION,
      mode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.MOCK_DISABLED,
      mockDisabled: true,
      isMockDisabled: true,
      verifierMode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.MOCK_DISABLED,
      onProhibitedField: opts.onProhibitedField,

      async verifyToken(_payload) {
        return buildMockDisabledVerifyResponse();
      },

      sanitizePayload: sanitizeScoutLiveAuthVerifierPayload,
    });
  }

  if (resolvedMode === SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED) {
    return Object.freeze({
      kind: 'scout_live_auth_verifier_adapter',
      version: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION,
      mode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED,
      mockDisabled: false,
      isMockDisabled: false,
      verifierMode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED,
      onProhibitedField: opts.onProhibitedField,

      async verifyToken(_payload) {
        return buildFirebaseDisabledVerifyResponse();
      },

      sanitizePayload: sanitizeScoutLiveAuthVerifierPayload,
    });
  }

  if (resolvedMode === SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING) {
    return Object.freeze({
      kind: 'scout_live_auth_verifier_adapter',
      version: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION,
      mode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING,
      mockDisabled: false,
      isMockDisabled: false,
      verifierMode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_CONFIG_MISSING,
      onProhibitedField: opts.onProhibitedField,

      async verifyToken(_payload) {
        return buildFirebaseConfigMissingVerifyResponse();
      },

      sanitizePayload: sanitizeScoutLiveAuthVerifierPayload,
    });
  }

  if (resolvedMode === SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME) {
    // Capture the explicit config and dependency-injected verifier.
    // The factory itself does not import the Firebase Admin SDK, does not
    // call any auth service, and does not call verifyToken. The runtime
    // work is fully deferred until the caller invokes `verifyToken`.
    const firebaseConfig = opts.firebaseConfig;
    const firebaseVerifier = opts.firebaseVerifier;
    const hasConfig = firebaseConfig !== null && firebaseConfig !== undefined
      && typeof firebaseConfig === 'object';
    const hasVerifier = typeof firebaseVerifier === 'function';

    return Object.freeze({
      kind: 'scout_live_auth_verifier_adapter',
      version: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION,
      mode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      mockDisabled: false,
      isMockDisabled: false,
      verifierMode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      onProhibitedField: opts.onProhibitedField,
      hasFirebaseConfig: hasConfig,
      hasFirebaseVerifier: hasVerifier,

      async verifyToken(payload) {
        if (!hasConfig || !hasVerifier) {
          return buildFirebaseRuntimeDisabledVerifyResponse();
        }
        // Reject up-front if the payload contains any prohibited field.
        // The runtime branch is stricter than the default 'drop' policy
        // and refuses to verify when raw sensitive material is present.
        const sanitization = sanitizeScoutLiveAuthVerifierPayload(
          payload,
          { onProhibitedField: 'reject' }
        );
        if (sanitization.rejected) {
          return buildFirebaseRuntimeFailedVerifyResponse(
            'Verifier payload contains prohibited fields; refusing to verify.'
          );
        }
        // Pull the idToken from the input payload directly. We never
        // echo the idToken (or any other raw field) back in the response.
        const src = (payload && typeof payload === 'object') ? payload : {};
        const idTokenCandidate = src.idToken;
        if (typeof idTokenCandidate !== 'string' || idTokenCandidate.length === 0) {
          return buildFirebaseRuntimeFailedVerifyResponse(
            'Verifier payload does not contain a non-empty idToken string.'
          );
        }
        let verified;
        try {
          verified = await firebaseVerifier(idTokenCandidate, firebaseConfig);
        } catch (_err) {
          return buildFirebaseRuntimeFailedVerifyResponse();
        }
        if (!verified || typeof verified !== 'object') {
          return buildFirebaseRuntimeFailedVerifyResponse();
        }
        // Pull only the safe, derived identifier. We never copy uid,
        // email, claims, or any other field from the verifier result.
        const rawIdentifier = (typeof verified.uid === 'string' && verified.uid.length > 0)
          ? verified.uid
          : (typeof verified.userKey === 'string' && verified.userKey.length > 0
              ? verified.userKey
              : null);
        const userKeyHash = deriveUserKeyHash(rawIdentifier);
        if (!userKeyHash) {
          return buildFirebaseRuntimeFailedVerifyResponse(
            'Verifier returned no usable identifier; refusing to mint userKeyHash.'
          );
        }
        return Object.freeze({
          allowed: true,
          code: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_RUNTIME_VERIFIED,
          reason: 'Firebase auth verifier runtime accepted the token; only a sanitized userKeyHash is returned.',
          userKey: null,
          userKeyHash,
        });
      },

      sanitizePayload: sanitizeScoutLiveAuthVerifierPayload,
    });
  }

  return Object.freeze({
    kind: 'scout_live_auth_verifier_adapter',
    version: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION,
    mode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.NOT_IMPLEMENTED,
    mockDisabled: false,
    isMockDisabled: false,
    verifierMode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.NOT_IMPLEMENTED,
    onProhibitedField: opts.onProhibitedField,

    async verifyToken(_payload) {
      return buildNotImplementedVerifyResponse();
    },

      sanitizePayload: sanitizeScoutLiveAuthVerifierPayload,
  });
}
