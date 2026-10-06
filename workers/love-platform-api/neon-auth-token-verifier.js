// Isolated Neon Auth (Managed Better Auth) JWT verifier candidate.
//
// #4565 / #4006 Phase B source-only slice. This module is NOT wired into the
// Product authentication path: the Production composition boundary
// (authenticated-principal.js) keeps CURRENT_ACCEPTED_PROVIDER = firebase and
// must never import this file. The trusted issuer/audience/JWKS URL are
// server-side composition inputs; token header/payload material is fully
// untrusted until the EdDSA/Ed25519 signature verifies.

const DEFAULT_JWKS_CACHE_TTL_SECONDS = 300;
const MAX_CACHE_TTL_SECONDS = 24 * 60 * 60;
const MAX_JWKS_KEYS = 32;
const CLOCK_SKEW_SECONDS = 5;
const ALLOWED_ALG = 'EdDSA';
const ALLOWED_KTY = 'OKP';
const ALLOWED_CRV = 'Ed25519';

export const NEON_AUTH_TOKEN_VERIFIER_ERROR = Object.freeze({
  TOKEN_INVALID: 'TOKEN_INVALID',
  VERIFIER_UNAVAILABLE: 'VERIFIER_UNAVAILABLE',
  CONFIG_INVALID: 'CONFIG_INVALID'
});

export const NEON_AUTH_TOKEN_VERIFIER_CONTRACT = Object.freeze({
  provider: 'neon',
  identityFields: Object.freeze(['provider', 'providerSubject']),
  signingAlgorithm: ALLOWED_ALG,
  keyType: ALLOWED_KTY,
  curve: ALLOWED_CRV,
  clockSkewSeconds: CLOCK_SKEW_SECONDS,
  defaultJwksCacheTtlSeconds: DEFAULT_JWKS_CACHE_TTL_SECONDS,
  maxJwksCacheTtlSeconds: MAX_CACHE_TTL_SECONDS,
  maxAgeZeroDisablesCacheReuse: true,
  maxJwksKeys: MAX_JWKS_KEYS,
  unknownKidForcedRefreshMax: 1,
  wiredIntoProductBoundary: false,
  acceptsEmailAuthority: false
});

export class NeonAuthTokenVerifierError extends Error {
  constructor(code) {
    const safeCode = Object.values(NEON_AUTH_TOKEN_VERIFIER_ERROR).includes(code)
      ? code
      : NEON_AUTH_TOKEN_VERIFIER_ERROR.VERIFIER_UNAVAILABLE;
    super(safeCode);
    this.name = 'NeonAuthTokenVerifierError';
    this.code = safeCode;
  }
}

function fail(code) {
  throw new NeonAuthTokenVerifierError(code);
}

function base64UrlDecode(segment) {
  if (typeof segment !== 'string' || !segment) return null;
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function decodeJsonSegment(segment) {
  const bytes = base64UrlDecode(segment);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function numericDate(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function responseMaxAgeSeconds(response) {
  try {
    const cacheControl = response && response.headers && typeof response.headers.get === 'function'
      ? response.headers.get('cache-control')
      : null;
    if (typeof cacheControl === 'string') {
      for (const part of cacheControl.split(',')) {
        const match = /^\s*max-age=(\d+)\s*$/i.exec(part);
        if (match) {
          const seconds = Number(match[1]);
          if (!Number.isFinite(seconds)) break;
          // An explicit max-age=0 disables cache reuse for subsequent
          // verifications and must never be promoted to the default TTL.
          return Math.min(Math.max(seconds, 0), MAX_CACHE_TTL_SECONDS);
        }
      }
    }
  } catch {
    // Cache-Control is an optional optimization; fall through to the default TTL.
  }
  return DEFAULT_JWKS_CACHE_TTL_SECONDS;
}

export function createNeonAuthTokenVerifier(config = null) {
  const composition = config && typeof config === 'object' ? config : {};
  const trustedIssuer = composition.issuer;
  const trustedAudience = composition.audience;
  const jwksUrl = composition.jwksUrl;
  // Explicit injected dependencies are authoritative: anything other than an
  // absent key (null, wrong type) is an invalid composition.
  const fetchImpl = composition.fetchImpl !== undefined ? composition.fetchImpl : globalThis.fetch;
  const cryptoImpl = composition.cryptoImpl !== undefined ? composition.cryptoImpl : globalThis.crypto;
  const now = composition.now !== undefined ? composition.now : (() => Date.now());

  if (typeof trustedIssuer !== 'string' || !trustedIssuer) fail('CONFIG_INVALID');
  if (typeof trustedAudience !== 'string' || !trustedAudience) fail('CONFIG_INVALID');
  if (typeof jwksUrl !== 'string' || !jwksUrl.startsWith('https://')) fail('CONFIG_INVALID');
  if (typeof fetchImpl !== 'function') fail('CONFIG_INVALID');
  if (!cryptoImpl || typeof cryptoImpl !== 'object' || !cryptoImpl.subtle
    || typeof cryptoImpl.subtle.importKey !== 'function'
    || typeof cryptoImpl.subtle.verify !== 'function') fail('CONFIG_INVALID');
  if (typeof now !== 'function') fail('CONFIG_INVALID');

  // Bounded in-memory JWKS cache: finite TTL, one entry set, no eviction of
  // individual kids needed because the whole set is replaced per refresh.
  const cache = { keys: null, expiresAt: 0 };

  async function fetchJwks() {
    let response;
    try {
      response = await fetchImpl(jwksUrl, { method: 'GET', headers: { accept: 'application/json' } });
    } catch {
      fail('VERIFIER_UNAVAILABLE');
    }
    if (!response || !response.ok) fail('VERIFIER_UNAVAILABLE');
    let payload;
    try {
      payload = await response.json();
    } catch {
      fail('VERIFIER_UNAVAILABLE');
    }
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.keys)) {
      fail('VERIFIER_UNAVAILABLE');
    }
    if (payload.keys.length > MAX_JWKS_KEYS) {
      // Bounded cardinality: an oversized remote key set is unusable and fails
      // closed before any Map is built, so the cache stays bounded too.
      fail('VERIFIER_UNAVAILABLE');
    }
    const keys = new Map();
    for (const key of payload.keys) {
      if (!key || typeof key !== 'object') continue;
      if (typeof key.kid !== 'string' || !key.kid) continue;
      if (key.kty !== ALLOWED_KTY || key.crv !== ALLOWED_CRV) continue;
      if (typeof key.x !== 'string' || !key.x) continue;
      keys.set(key.kid, Object.freeze({ kty: key.kty, crv: key.crv, kid: key.kid, x: key.x }));
    }
    cache.keys = keys;
    cache.expiresAt = now() + responseMaxAgeSeconds(response) * 1000;
    return keys;
  }

  async function lookupCachedKey(kid) {
    if (!cache.keys || cache.expiresAt <= now()) {
      await fetchJwks();
    }
    return cache.keys ? cache.keys.get(kid) || null : null;
  }

  return Object.freeze({
    async verify(token) {
      if (typeof token !== 'string' || !token) fail('TOKEN_INVALID');
      const segments = token.split('.');
      if (segments.length !== 3 || segments.some((segment) => !segment)) fail('TOKEN_INVALID');

      const header = decodeJsonSegment(segments[0]);
      if (!header) fail('TOKEN_INVALID');
      if (header.alg !== ALLOWED_ALG) fail('TOKEN_INVALID');
      if (typeof header.kid !== 'string' || !header.kid) fail('TOKEN_INVALID');
      const payload = decodeJsonSegment(segments[1]);
      if (!payload) fail('TOKEN_INVALID');

      let key = await lookupCachedKey(header.kid);
      if (!key) {
        // Unknown kid: exactly one forced refresh maximum, never a retry loop.
        await fetchJwks();
        key = cache.keys ? cache.keys.get(header.kid) || null : null;
        if (!key) fail('TOKEN_INVALID');
      }

      const signingInput = new TextEncoder().encode(`${segments[0]}.${segments[1]}`);
      const signature = base64UrlDecode(segments[2]);
      if (!signature || signature.length === 0) fail('TOKEN_INVALID');

      let cryptoKey;
      try {
        cryptoKey = await cryptoImpl.subtle.importKey(
          'jwk',
          { kty: key.kty, crv: key.crv, x: key.x, ext: true, key_ops: ['verify'] },
          { name: 'Ed25519' },
          false,
          ['verify']
        );
      } catch {
        fail('VERIFIER_UNAVAILABLE');
      }
      let signatureValid;
      try {
        signatureValid = await cryptoImpl.subtle.verify({ name: 'Ed25519' }, cryptoKey, signature, signingInput);
      } catch {
        fail('VERIFIER_UNAVAILABLE');
      }
      if (!signatureValid) fail('TOKEN_INVALID');

      // Signature verified: only now is the payload trusted enough to validate.
      if (payload.iss !== trustedIssuer) fail('TOKEN_INVALID');
      if (payload.aud !== trustedAudience) fail('TOKEN_INVALID');
      const currentTimeMs = now();
      const exp = numericDate(payload.exp);
      if (exp === null) fail('TOKEN_INVALID');
      if (currentTimeMs > (exp + CLOCK_SKEW_SECONDS) * 1000) fail('TOKEN_INVALID');
      const iat = numericDate(payload.iat);
      if (iat === null) fail('TOKEN_INVALID');
      if ((iat - CLOCK_SKEW_SECONDS) * 1000 > currentTimeMs) fail('TOKEN_INVALID');
      if (payload.nbf !== undefined) {
        const nbf = numericDate(payload.nbf);
        if (nbf === null) fail('TOKEN_INVALID');
        if ((nbf - CLOCK_SKEW_SECONDS) * 1000 > currentTimeMs) fail('TOKEN_INVALID');
      }
      const subject = payload.sub;
      if (typeof subject !== 'string' || subject.length === 0 || subject !== subject.trim()) {
        fail('TOKEN_INVALID');
      }

      return Object.freeze({
        provider: 'neon',
        providerSubject: subject
      });
    }
  });
}
