const FIREBASE_JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const DEFAULT_PROJECT_ID = 'relovetree';
const DEFAULT_CACHE_SECONDS = 300;
const MAX_CACHE_SECONDS = 24 * 60 * 60;

let jwkCache = {
  expiresAt: 0,
  keys: new Map()
};

function decodeBase64UrlBytes(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function decodeJwtJson(value) {
  const bytes = decodeBase64UrlBytes(value);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseMaxAge(cacheControl) {
  if (typeof cacheControl !== 'string') return DEFAULT_CACHE_SECONDS;
  for (const part of cacheControl.split(',')) {
    const match = /^\s*max-age=(\d+)\s*$/i.exec(part);
    if (match) {
      return Math.min(Math.max(Number(match[1]) || DEFAULT_CACHE_SECONDS, 1), MAX_CACHE_SECONDS);
    }
  }
  return DEFAULT_CACHE_SECONDS;
}

function normalizeJwkSet(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.keys)) return null;
  const keys = new Map();
  for (const key of payload.keys) {
    if (!key || typeof key !== 'object') continue;
    if (typeof key.kid !== 'string' || !key.kid) continue;
    if (key.kty !== 'RSA') continue;
    if (key.alg && key.alg !== 'RS256') continue;
    if (typeof key.n !== 'string' || !key.n || typeof key.e !== 'string' || !key.e) continue;
    keys.set(key.kid, Object.freeze({ ...key }));
  }
  return keys.size ? keys : null;
}

async function fetchFirebaseJwks(fetchImpl, nowMs) {
  let response;
  try {
    response = await fetchImpl(FIREBASE_JWK_URL, {
      method: 'GET',
      headers: { accept: 'application/json' }
    });
  } catch (error) {
    throw new Error('FIREBASE_JWK_FETCH_UNAVAILABLE', { cause: error });
  }

  if (!response || !response.ok) {
    throw new Error('FIREBASE_JWK_FETCH_UNAVAILABLE');
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error('FIREBASE_JWK_METADATA_INVALID', { cause: error });
  }

  const keys = normalizeJwkSet(payload);
  if (!keys) throw new Error('FIREBASE_JWK_METADATA_INVALID');

  jwkCache = {
    expiresAt: nowMs + parseMaxAge(response.headers.get('cache-control')) * 1000,
    keys
  };
  return keys;
}

async function getFirebaseJwk(kid, { fetchImpl, nowMs }) {
  let keys = jwkCache.expiresAt > nowMs ? jwkCache.keys : null;
  if (!keys) keys = await fetchFirebaseJwks(fetchImpl, nowMs);
  if (keys.has(kid)) return keys.get(kid);

  // Firebase rotates signing keys. A token with an unknown kid gets one forced
  // metadata refresh before it is treated as an invalid token.
  keys = await fetchFirebaseJwks(fetchImpl, nowMs);
  return keys.get(kid) || null;
}

function claimsAreFirebaseIdToken(payload, projectId, nowSeconds) {
  if (!payload || typeof payload !== 'object') return false;
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) return false;
  if (payload.aud !== projectId) return false;
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return false;
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) return false;
  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds) return false;
  if (typeof payload.auth_time !== 'number' || payload.auth_time > nowSeconds) return false;
  return true;
}

export function readFirebaseProjectId(env = {}) {
  const configured = typeof env?.FIREBASE_PROJECT_ID === 'string'
    ? env.FIREBASE_PROJECT_ID.trim()
    : '';
  return configured || DEFAULT_PROJECT_ID;
}

export function createFirebaseIdTokenVerifier({
  projectId = DEFAULT_PROJECT_ID,
  fetchImpl = globalThis.fetch,
  cryptoImpl = globalThis.crypto,
  now = () => Date.now()
} = {}) {
  if (typeof projectId !== 'string' || !projectId.trim()) {
    throw new TypeError('Firebase project id is required');
  }
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('Firebase verifier requires fetch');
  }
  if (!cryptoImpl?.subtle || typeof cryptoImpl.subtle.importKey !== 'function' || typeof cryptoImpl.subtle.verify !== 'function') {
    throw new TypeError('Firebase verifier requires Web Crypto');
  }
  if (typeof now !== 'function') throw new TypeError('Firebase verifier requires a clock');

  const safeProjectId = projectId.trim();

  return async function verifyFirebaseIdToken(token) {
    if (typeof token !== 'string' || !token) return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((part) => !part)) return null;

    const header = decodeJwtJson(parts[0]);
    const payload = decodeJwtJson(parts[1]);
    const signature = decodeBase64UrlBytes(parts[2]);
    if (!header || !payload || !signature) return null;
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) return null;

    const nowMs = Number(now());
    if (!Number.isFinite(nowMs)) throw new Error('FIREBASE_VERIFIER_CLOCK_INVALID');
    const nowSeconds = Math.floor(nowMs / 1000);
    if (!claimsAreFirebaseIdToken(payload, safeProjectId, nowSeconds)) return null;

    const jwk = await getFirebaseJwk(header.kid, { fetchImpl, nowMs });
    if (!jwk) return null;

    let publicKey;
    try {
      publicKey = await cryptoImpl.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
    } catch (error) {
      throw new Error('FIREBASE_JWK_IMPORT_UNAVAILABLE', { cause: error });
    }

    let verified;
    try {
      verified = await cryptoImpl.subtle.verify(
        { name: 'RSASSA-PKCS1-v1_5' },
        publicKey,
        signature,
        new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
      );
    } catch (error) {
      throw new Error('FIREBASE_SIGNATURE_VERIFICATION_UNAVAILABLE', { cause: error });
    }

    if (!verified) return null;
    return Object.freeze({ uid: payload.sub });
  };
}

export function clearFirebaseJwkCacheForTests() {
  jwkCache = { expiresAt: 0, keys: new Map() };
}

export const FIREBASE_ID_TOKEN_VERIFIER_CONTRACT = Object.freeze({
  provider: 'firebase',
  algorithm: 'RS256',
  projectIdEnv: 'FIREBASE_PROJECT_ID',
  jwkUrl: FIREBASE_JWK_URL,
  outputFields: Object.freeze(['uid'])
});
