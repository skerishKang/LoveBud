/**
 * Scout Runtime Firebase Auth Composition
 * v20260616-runtime-firebase-auth-composition-1
 *
 * Issue #4536 Slice A — Runtime Firebase auth composition (SOURCE ONLY,
 * DISABLED BY DEFAULT). Parent issue: #1882 (must remain OPEN).
 *
 * Binds the existing production-used Cloudflare-edge Firebase ID-token
 * verifier (`functions/_shared/firebase-id-token-verifier.js`) into the
 * Scout live auth dependency chain behind one explicit opt-in runtime
 * gate. This module composes existing seams only; it does NOT create a
 * second JWT verifier and does NOT import the Firebase Admin SDK.
 *
 * Gate:
 * `SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED=true`
 *
 * - Default / absent / any value other than `true`: no verifier
 *   construction, no JWK fetch, no raw token handoff, and the caller keeps
 *   its current mock-disabled behavior exactly.
 * - Explicit `true` (and no injected live dependencies): the composition
 *   builds the shared Firebase verifier from the current
 *   `FIREBASE_PROJECT_ID` authority, constructs the existing Scout
 *   verifier adapter in `FIREBASE_RUNTIME` mode, constructs the existing
 *   dependency adapter with `mockDisabled:false` + `allowRawTokenHandoff:
 *   true`, and returns the existing auth boundary factory configured with
 *   `includeIdTokenForVerifier:true` so the parsed Bearer token exists
 *   only in the in-memory verifier handoff.
 *
 * Critical stop property: persistent rate limiting is NOT implemented in
 * Slice A. Even when Firebase auth succeeds, the endpoint rate-limit
 * boundary stays UNAVAILABLE / fail-closed, so
 * `PROVIDER_REACHED = NO` and `ENGINE_REACHED_FROM_THIS_PATH = NO`.
 * This module does not wire a persistent limiter and does not weaken the
 * rate-limit safe-fail.
 *
 * Sanitization: only the sanitized `userKeyHash` crosses the Scout
 * verifier/dependency boundary. The raw token, Authorization header, UID,
 * email, decoded claims, JWK body, and verifier exception detail never
 * enter the returned composition object, the endpoint response, the
 * observer metadata, or storage.
 *
 * Non-goals (this slice):
 * - No persistent rate-limit backend (KV / Durable Object / D1)
 * - No Firebase Admin SDK import
 * - No second JWT verifier
 * - No provider call, no Engine call, no fetch at module import time
 * - No real Firebase token, user, or project mutation
 */

'use strict';

import {
  readFirebaseProjectId,
  createFirebaseIdTokenVerifier,
} from '../../_shared/firebase-id-token-verifier.js';
import {
  createScoutLiveAuthVerifierAdapter,
  SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES,
} from './live-auth-verifier-adapter.js';
import { createScoutLiveDependencyAdapter } from './live-auth-rate-limit-dependency-adapter.js';
import { createScoutLiveAuthBoundary } from './live-auth-rate-limit-boundary.js';

// ─── Version ────────────────────────────────────────────────────────────────

export const SCOUT_RUNTIME_AUTH_COMPOSITION_VERSION = '20260616-runtime-firebase-auth-composition-1';

// ─── Gate ───────────────────────────────────────────────────────────────────

export const SCOUT_RUNTIME_FIREBASE_AUTH_GATE = 'SCOUT_RUNTIME_FIREBASE_AUTH_ENABLED';

// ─── Composition Status ─────────────────────────────────────────────────────

export const SCOUT_RUNTIME_AUTH_COMPOSITION_STATUS = Object.freeze({
  GATE_DISABLED: 'gate_disabled',
  INJECTED_DEPENDENCIES: 'injected_dependencies',
  FIREBASE_RUNTIME: 'firebase_runtime',
  FIREBASE_RUNTIME_UNAVAILABLE: 'firebase_runtime_unavailable',
});

// ─── Gate Evaluation ────────────────────────────────────────────────────────

/**
 * Evaluate the explicit opt-in gate. Only the exact string `true`
 * (case-insensitive, trimmed) enables the composition. Absent, empty,
 * false, or any other value keeps the current mock-disabled behavior.
 *
 * @param {Object} [env]
 * @returns {boolean}
 */
export function isScoutRuntimeFirebaseAuthEnabled(env = {}) {
  const raw = (env && typeof env === 'object')
    ? env[SCOUT_RUNTIME_FIREBASE_AUTH_GATE]
    : undefined;
  if (raw === undefined || raw === null) return false;
  return String(raw).trim().toLowerCase() === 'true';
}

// ─── Safe Disabled / Unavailable Results ────────────────────────────────────

function buildCompositionResult(status, fields) {
  return Object.freeze(Object.assign({
    version: SCOUT_RUNTIME_AUTH_COMPOSITION_VERSION,
    status,
    enabled: status !== SCOUT_RUNTIME_AUTH_COMPOSITION_STATUS.GATE_DISABLED,
    verifierConstructed: false,
    dependencyAdapter: null,
    authBoundary: null,
  }, fields || {}));
}

// ─── Composition Factory ────────────────────────────────────────────────────

/**
 * Compose the Scout runtime Firebase auth chain when the gate is enabled.
 *
 * The function never throws. On any construction problem it returns the
 * `firebase_runtime_unavailable` status with `dependencyAdapter: null`
 * and `authBoundary: null`, so the caller falls back to its existing
 * mock-disabled path (fail-closed) instead of reaching a provider.
 *
 * Injected live dependencies (`context.liveAdapter`,
 * `context.liveDependencies`, or `context.verifyToken`) always take
 * precedence so existing DI-based tests and callers are unchanged even
 * when the gate is enabled.
 *
 * @param {Object} [options]
 * @param {Object} [options.env] runtime env (gate + FIREBASE_PROJECT_ID)
 * @param {Object} [options.context] endpoint context (DI precedence)
 * @param {Function} [options.fetchImpl] optional fetch (tests / DI)
 * @param {Object} [options.cryptoImpl] optional Web Crypto (tests / DI)
 * @param {Function} [options.now] optional clock (tests / DI)
 * @returns {Object} frozen composition result
 */
export function composeScoutRuntimeFirebaseAuth(options = {}) {
  const opts = (options && typeof options === 'object') ? options : {};
  const env = (opts.env && typeof opts.env === 'object') ? opts.env : {};
  const context = (opts.context && typeof opts.context === 'object') ? opts.context : {};

  if (!isScoutRuntimeFirebaseAuthEnabled(env)) {
    return buildCompositionResult(SCOUT_RUNTIME_AUTH_COMPOSITION_STATUS.GATE_DISABLED);
  }

  const hasInjectedDependencies = !!(
    context.liveAdapter ||
    context.liveDependencies ||
    typeof context.verifyToken === 'function'
  );
  if (hasInjectedDependencies) {
    // Dependency injection wins: do not construct a verifier, do not
    // fetch JWKs, and keep the caller's existing DI behavior.
    return buildCompositionResult(SCOUT_RUNTIME_AUTH_COMPOSITION_STATUS.INJECTED_DEPENDENCIES);
  }

  try {
    // Gate is explicitly enabled and no DI override is present. Build the
    // shared verifier lazily from current project-id authority. This is
    // the only place in the Scout live path that constructs the shared
    // Firebase verifier.
    const projectId = readFirebaseProjectId(env);

    const fetchImpl = (typeof opts.fetchImpl === 'function')
      ? opts.fetchImpl
      : ((typeof context.fetch === 'function') ? context.fetch : undefined);
    const cryptoImpl = opts.cryptoImpl
      || context.cryptoImpl
      || (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined);
    const now = (typeof opts.now === 'function')
      ? opts.now
      : ((typeof context.now === 'function') ? context.now : undefined);

    const firebaseVerifier = createFirebaseIdTokenVerifier(
      Object.assign(
        { projectId },
        fetchImpl ? { fetchImpl } : {},
        cryptoImpl ? { cryptoImpl } : {},
        now ? { now } : {}
      )
    );

    const verifierAdapter = createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
      firebaseConfig: Object.freeze({ projectId }),
      firebaseVerifier,
    });

    const dependencyAdapter = createScoutLiveDependencyAdapter({
      mockDisabled: false,
      verifierAdapter,
      allowRawTokenHandoff: true,
    });

    const authBoundary = createScoutLiveAuthBoundary({
      includeIdTokenForVerifier: true,
    });

    return buildCompositionResult(SCOUT_RUNTIME_AUTH_COMPOSITION_STATUS.FIREBASE_RUNTIME, {
      verifierConstructed: true,
      dependencyAdapter,
      authBoundary,
    });
  } catch {
    // Missing Web Crypto / fetch / invalid config → fail closed without
    // surfacing any exception detail. The caller keeps its mock-disabled
    // dependency adapter, so no provider can be reached.
    return buildCompositionResult(SCOUT_RUNTIME_AUTH_COMPOSITION_STATUS.FIREBASE_RUNTIME_UNAVAILABLE);
  }
}

export const SCOUT_RUNTIME_AUTH_COMPOSITION_CONTRACT = Object.freeze({
  gate: SCOUT_RUNTIME_FIREBASE_AUTH_GATE,
  defaultEnabled: false,
  verifierModule: 'functions/_shared/firebase-id-token-verifier.js',
  verifierAdapterMode: SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_RUNTIME,
  allowRawTokenHandoff: true,
  includeIdTokenForVerifier: true,
  persistentRateLimitImplemented: false,
  providerReachedWithoutLimiter: false,
});
