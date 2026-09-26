// #4494 source-only candidate: authenticated Tree Likes GET from Cloudflare
// directly to Neon through the existing read credential boundary.
//
// Default/modal/unknown routing remains Modal-backed. This file does not
// authorize Production gate activation, DB/ACL/provider mutation, Product
// traffic, runtime-role inference, or secret operations.
//
// Behavioral parity authority:
//   modal_compute/tree_likes.py::fetch_tree_like_summary
//
// Observable parity is preserved without the Modal helper's incidental
// _ensure_tree_social_counts INSERT/COMMIT. A missing aggregate row is read as
// likeCount=0, so this candidate is SELECT-only.
//
// Required ordering:
//   verified Firebase principal
//   -> validated Tree path/UUID
//   -> read config
//   -> public Tree + requester active-like + aggregate count SELECT
//
// After explicit direct selection there is no per-request fallback to Modal.

import {
  FirebaseReadPrincipalError,
  buildFirebaseReadPrincipalErrorResponse,
  resolveFirebaseReadPrincipal
} from '../../workers/love-platform-api/firebase-read-principal.js';
import {
  createFirebaseIdTokenVerifier,
  readFirebaseProjectId
} from './firebase-id-token-verifier.js';
import {
  isInvalidPathEncodingError,
  normalizeEncodedPathSegment
} from './path-segment.js';
import { REQUEST_ID_HEADER } from './request-id.js';

export const TREE_LIKE_READ_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_TREE_LIKE_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;
const UUID_HEX = /^[0-9a-f]{32}$/;

export function isTreeLikeReadDirectNeonSelected(env = {}) {
  const value = typeof env?.[TREE_LIKE_READ_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[TREE_LIKE_READ_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === TREE_LIKE_READ_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

export function isTreeLikeReadNeonUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    return NEON_HOST.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function readTreeLikeReadConfig(env = {}) {
  const raw = typeof env?.[TREE_LIKE_READ_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[TREE_LIKE_READ_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isTreeLikeReadNeonUrl(raw);
  return Object.freeze({ configured, connectionString: configured ? raw : '' });
}

export async function createTreeLikeReadExecutor({ connectionString, executorOverride = null } = {}) {
  if (typeof executorOverride === 'function') return executorOverride;
  if (!isTreeLikeReadNeonUrl(connectionString)) {
    throw new TypeError('TREE_LIKE_READ_DIRECT_NEON_CONFIG_INVALID');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, { disableWarningInBrowsers: true });
  return async function treeLikeReadExecutor(text, values) {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    if (!Array.isArray(rows)) throw new TypeError('TREE_LIKE_READ_RESULT_INVALID');
    return rows;
  };
}

function responseHeaders(requestId, routeStatus) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon'
  });
  if (routeStatus) headers.set('x-lovebud-route-status', routeStatus);
  if (requestId) {
    headers.set(REQUEST_ID_HEADER, requestId);
    headers.set('Access-Control-Expose-Headers', REQUEST_ID_HEADER);
  }
  return headers;
}

function jsonResponse(body, status, requestId, routeStatus) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(requestId, routeStatus)
  });
}

function decorateDirectResponse(response, requestId, routeStatus = null) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-lovebud-upstream', 'direct-neon');
  headers.set('x-lovebud-runtime', 'direct_neon');
  if (routeStatus) headers.set('x-lovebud-route-status', routeStatus);
  if (requestId) {
    headers.set(REQUEST_ID_HEADER, requestId);
    const exposed = headers.get('Access-Control-Expose-Headers') || '';
    const items = exposed.split(',').map((item) => item.trim()).filter(Boolean);
    if (!items.includes(REQUEST_ID_HEADER)) {
      headers.set(
        'Access-Control-Expose-Headers',
        exposed ? `${exposed}, ${REQUEST_ID_HEADER}` : REQUEST_ID_HEADER
      );
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function requestWithId(request, requestId) {
  if (!requestId || request.headers.get(REQUEST_ID_HEADER)) return request;
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Request(request.url, { method: request.method, headers });
}

async function resolvePrincipal(request, env, requestId, options) {
  const authRequest = requestWithId(request, requestId);
  try {
    const verifyToken = options.verifyTokenOverride || createFirebaseIdTokenVerifier({
      projectId: readFirebaseProjectId(env)
    });
    const principal = await resolveFirebaseReadPrincipal(authRequest, verifyToken);
    return { ok: true, principal };
  } catch (error) {
    if (error instanceof FirebaseReadPrincipalError) {
      return {
        ok: false,
        response: decorateDirectResponse(
          buildFirebaseReadPrincipalErrorResponse(error, authRequest),
          requestId,
          'auth-rejected'
        )
      };
    }
    return {
      ok: false,
      response: jsonResponse(
        { error: { code: 'FIREBASE_VERIFIER_UNAVAILABLE', message: 'Authentication verifier unavailable' } },
        503,
        requestId,
        'auth-unavailable'
      )
    };
  }
}

function normalizePythonUuid(rawValue) {
  const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!raw) return { ok: false, detail: 'treeId is required' };
  let hex = raw.toLowerCase();
  if (hex.startsWith('urn:uuid:')) hex = hex.slice('urn:uuid:'.length);
  if (hex.startsWith('{') && hex.endsWith('}')) hex = hex.slice(1, -1);
  hex = hex.replace(/-/g, '');
  if (!UUID_HEX.test(hex)) return { ok: false, detail: 'Invalid treeId' };
  return {
    ok: true,
    value: `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
  };
}

function extractTreeId(request) {
  const parts = new URL(request.url).pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  return normalizeEncodedPathSegment(parts[2] || '');
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 't' || value === 'true' || value === 1 || value === '1') return true;
  if (value === 'f' || value === 'false' || value === 0 || value === '0') return false;
  throw new TypeError('TREE_LIKE_READ_BOOLEAN_INVALID');
}

export const TREE_LIKE_READ_SQL = `
SELECT
  t.id::text AS tree_id,
  EXISTS (
    SELECT 1
    FROM tree_likes tl
    WHERE tl.tree_id = t.id
      AND tl.owner_id = $2
      AND tl.deleted_at IS NULL
  ) AS active,
  COALESCE(tsc.like_count, 0)::int AS like_count
FROM trees t
LEFT JOIN tree_social_counts tsc ON tsc.tree_id = t.id
WHERE t.id = $1
  AND t.visibility = 'public'
LIMIT 1;
`;

export async function handleTreeLikeReadDirectNeon(request, env = {}, requestId = null, options = {}) {
  if (!isTreeLikeReadDirectNeonSelected(env)) return null;

  const auth = await resolvePrincipal(request, env, requestId, options);
  if (!auth.ok) return auth.response;

  let rawTreeId;
  try {
    rawTreeId = extractTreeId(request);
  } catch (error) {
    if (isInvalidPathEncodingError(error)) {
      return jsonResponse({ detail: 'Invalid treeId' }, 400, requestId, 'invalid-tree-id');
    }
    return jsonResponse({ detail: 'Invalid treeId' }, 400, requestId, 'invalid-tree-id');
  }

  const idResult = normalizePythonUuid(rawTreeId);
  if (!idResult.ok) {
    return jsonResponse({ detail: idResult.detail }, 400, requestId, 'invalid-tree-id');
  }

  const config = readTreeLikeReadConfig(env);
  if (!config.configured && typeof options.executorOverride !== 'function') {
    return jsonResponse({
      error: 'Tree like read direct-Neon runtime not configured',
      code: 'DIRECT_NEON_CONFIG_ABSENT'
    }, 503, requestId, 'config-absent');
  }

  let executor;
  try {
    executor = await createTreeLikeReadExecutor({
      connectionString: config.connectionString,
      executorOverride: options.executorOverride
    });
  } catch {
    return jsonResponse({
      error: 'Tree like read direct-Neon query failed',
      code: 'DIRECT_NEON_QUERY_FAILED'
    }, 500, requestId, 'executor-init-failed');
  }

  try {
    const rows = await executor(TREE_LIKE_READ_SQL, [
      idResult.value,
      auth.principal.legacyOwnerId
    ]);
    const row = rows?.[0];
    if (!row) {
      return jsonResponse({ detail: 'Tree not found' }, 404, requestId, 'not-found');
    }
    const likeCount = Number(row.like_count);
    if (!Number.isSafeInteger(likeCount) || likeCount < 0) {
      throw new TypeError('TREE_LIKE_READ_COUNT_INVALID');
    }
    return jsonResponse({
      treeId: idResult.value,
      active: normalizeBoolean(row.active),
      likeCount
    }, 200, requestId, 'tree-like-read-complete');
  } catch {
    return jsonResponse({
      error: 'Tree like read direct-Neon query failed',
      code: 'DIRECT_NEON_QUERY_FAILED'
    }, 500, requestId, 'query-failed');
  }
}

export const TREE_LIKE_READ_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  path: '/api/trees/:id/likes',
  gateEnv: TREE_LIKE_READ_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: TREE_LIKE_READ_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: TREE_LIKE_READ_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  requiredObjects: Object.freeze({
    trees: Object.freeze(['SELECT']),
    tree_likes: Object.freeze(['SELECT']),
    tree_social_counts: Object.freeze(['SELECT'])
  }),
  identity: 'verified Firebase uid',
  visibility: 'exact-public Tree only',
  response: Object.freeze(['treeId', 'active', 'likeCount']),
  writes: false,
  productionAclAuthorized: false,
  productionGateActivationAuthorized: false,
  providerMutationAuthorized: false,
  rawLogBodyReadAuthorized: false,
  perRequestModalFallbackAfterDirectStart: false
});
