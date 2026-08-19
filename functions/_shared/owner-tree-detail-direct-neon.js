// #4121 Phase-2 authenticated owner Tree detail direct-Neon read adapter.
//
// Firebase remains the only identity authority. This module resolves the
// server-verified #4100 read principal and authorizes the Tree by
// principal.legacyOwnerId before projecting the current owner-detail DTO.
// It is GET/read-only and does not replace the independently gated #4115
// anonymous/public Tree detail authority.

import {
  FirebaseReadPrincipalError,
  buildFirebaseReadPrincipalErrorResponse,
  resolveFirebaseReadPrincipal
} from '../../workers/love-platform-api/firebase-read-principal.js';
import {
  createFirebaseIdTokenVerifier,
  readFirebaseProjectId
} from './firebase-id-token-verifier.js';
import { REQUEST_ID_HEADER } from './request-id.js';

export const OWNER_TREE_DETAIL_RUNTIME = Object.freeze({
  GATE_FLAG: 'LB_OWNER_TREE_DETAIL_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

const OWNER_NOT_FOUND_ROUTE_STATUS = 'owner-not-found';
const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;

export function isNeonDatabaseUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    const parsed = new URL(value);
    return NEON_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function isOwnerTreeDetailDirectNeonSelected(env = {}) {
  const value = typeof env?.[OWNER_TREE_DETAIL_RUNTIME.GATE_FLAG] === 'string'
    ? env[OWNER_TREE_DETAIL_RUNTIME.GATE_FLAG].trim()
    : '';
  return value === OWNER_TREE_DETAIL_RUNTIME.DIRECT_NEON_VALUE;
}

export function readOwnerTreeDetailDirectConfig(env = {}) {
  const raw = typeof env?.[OWNER_TREE_DETAIL_RUNTIME.DATABASE_URL] === 'string'
    ? env[OWNER_TREE_DETAIL_RUNTIME.DATABASE_URL].trim()
    : '';
  const configured = isNeonDatabaseUrl(raw);
  return Object.freeze({
    configured,
    connectionString: configured ? raw : ''
  });
}

function makeRequestWithId(request, requestId) {
  if (!requestId || request.headers.get(REQUEST_ID_HEADER)) return request;
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Request(request.url, {
    method: request.method,
    headers
  });
}

function directHeaders(requestId, routeStatus = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon',
    'x-lovebud-public-tree-cache': 'bypass-auth'
  };
  if (routeStatus) headers['x-lovebud-route-status'] = routeStatus;
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
    headers['Access-Control-Expose-Headers'] = REQUEST_ID_HEADER;
  }
  return headers;
}

function jsonResponse(body, status, requestId, routeStatus = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: directHeaders(requestId, routeStatus)
  });
}

function decoratePrincipalResponse(response, requestId) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-lovebud-upstream', 'direct-neon');
  headers.set('x-lovebud-runtime', 'direct_neon');
  headers.set('x-lovebud-public-tree-cache', 'bypass-auth');
  if (requestId) {
    headers.set(REQUEST_ID_HEADER, requestId);
    const exposed = headers.get('Access-Control-Expose-Headers') || '';
    if (!exposed.split(',').map((value) => value.trim()).includes(REQUEST_ID_HEADER)) {
      headers.set('Access-Control-Expose-Headers', exposed ? `${exposed}, ${REQUEST_ID_HEADER}` : REQUEST_ID_HEADER);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Mirrors Python uuid.UUID(value.strip()) used by the current private Modal
// Tree-detail route. It accepts canonical, compact, braced, and exact lowercase
// urn:uuid forms and returns the canonical lowercase 8-4-4-4-12 representation.
export function normalizeOwnerTreeDetailId(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let raw = value.trim();
  if (raw.startsWith('urn:uuid:')) raw = raw.slice('urn:uuid:'.length);
  if (raw.startsWith('{') && raw.endsWith('}')) raw = raw.slice(1, -1);
  const hex = raw.replace(/-/g, '');
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) return null;
  const normalizedHex = hex.toLowerCase();
  return [
    normalizedHex.slice(0, 8),
    normalizedHex.slice(8, 12),
    normalizedHex.slice(12, 16),
    normalizedHex.slice(16, 20),
    normalizedHex.slice(20)
  ].join('-');
}

export function normalizeDirectNeonTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Date) throw new TypeError('OWNER_TREE_DETAIL_TIMESTAMP_PRECISION_LOST');
  if (typeof value !== 'string') return String(value);

  const text = value.trim();
  const offsetMatch = text.match(/([+-]\d{2}(?::?\d{2})?|Z)$/);
  let offset = '';
  let body = text;
  if (offsetMatch) {
    offset = offsetMatch[1];
    body = text.slice(0, offsetMatch.index);
  }
  body = body.replace(' ', 'T').replace(/(\.\d+)$/, (match) => {
    const digits = match.slice(1);
    return `.${(digits + '000000').slice(0, 6)}`;
  });
  if (offset === 'Z') return body + '+00:00';
  if (!offset) return body;
  const sign = offset[0];
  const rest = offset.slice(1);
  return body + (rest.includes(':') ? offset : `${sign}${rest}:00`);
}

export const OWNER_TREE_DETAIL_SCHEMA_CAPABILITIES_SQL = `
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tree_social_counts'
  ) AS has_social_counts,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tree_social_counts' AND column_name = 'like_count'
  ) AS has_like_count,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tree_social_counts' AND column_name = 'view_count'
  ) AS has_view_count;
`;

function normalizeCapabilities(rows) {
  const row = Array.isArray(rows) && rows.length ? rows[0] : {};
  return Object.freeze({
    hasSocialCounts: row?.has_social_counts === true,
    hasLikeCount: row?.has_like_count === true,
    hasViewCount: row?.has_view_count === true
  });
}

function socialProjection(capabilities = {}) {
  const hasTable = capabilities.hasSocialCounts === true;
  const hasLike = hasTable && capabilities.hasLikeCount === true;
  const hasView = hasTable && capabilities.hasViewCount === true;
  if (!hasLike && !hasView) {
    return Object.freeze({ join: '', select: '', group: '', hasLike: false, hasView: false });
  }

  const select = [];
  const group = [];
  if (hasLike) {
    select.push('COALESCE(s.like_count, 0) AS like_count');
    group.push('s.like_count');
  }
  if (hasView) {
    select.push('COALESCE(s.view_count, 0) AS view_count');
    group.push('s.view_count');
  }
  return Object.freeze({
    join: 'LEFT JOIN tree_social_counts s ON s.tree_id = t.id',
    select: `,\n       ${select.join(',\n       ')}`,
    group: `,\n         ${group.join(', ')}`,
    hasLike,
    hasView
  });
}

export function buildOwnerTreeDetailSql(capabilities = {}) {
  const social = socialProjection(capabilities);
  return Object.freeze({
    text: `
SELECT t.id::text AS id, t.owner_id::text AS owner_id, t.title, t.visibility,
       t.group_name, t.keywords,
       t.created_at::text AS created_at, t.updated_at::text AS updated_at,
       COUNT(m.id)::int AS memory_count${social.select}
FROM trees t
LEFT JOIN memories m ON m.tree_id = t.id
${social.join}
WHERE t.id = $1
  AND t.owner_id = $2
GROUP BY t.id, t.owner_id, t.title, t.visibility,
         t.group_name, t.keywords,
         t.created_at, t.updated_at${social.group}
LIMIT 1;
`,
    hasLike: social.hasLike,
    hasView: social.hasView
  });
}

function normalizeStoredVisibility(value) {
  if (value === 'public') return 'public';
  if (value === 'private') return 'private';
  return null;
}

function normalizeGroupName(value) {
  if (value == null || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 80) throw new Error('OWNER_TREE_DETAIL_NORMALIZATION_FAILURE');
  return trimmed;
}

function normalizeKeywords(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((item) => String(item));
}

function normalizeCount(value, field) {
  const numeric = Number(value ?? 0);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new TypeError(`OWNER_TREE_DETAIL_INVALID_${field.toUpperCase()}`);
  }
  return numeric;
}

export function projectOwnerTreeDetailRow(row, { hasLike = false, hasView = false } = {}) {
  if (!row || typeof row !== 'object') throw new Error('OWNER_TREE_DETAIL_NORMALIZATION_FAILURE');
  if (row.id == null || row.owner_id == null) throw new Error('OWNER_TREE_DETAIL_NORMALIZATION_FAILURE');

  const tree = {
    id: String(row.id),
    title: row.title || '',
    visibility: normalizeStoredVisibility(row.visibility),
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at),
    memoryCount: normalizeCount(row.memory_count, 'memory_count'),
    ownerId: String(row.owner_id),
    groupName: normalizeGroupName(row.group_name),
    keywords: normalizeKeywords(row.keywords)
  };

  if (hasLike) tree.likeCount = normalizeCount(row.like_count, 'like_count');
  if (hasView) tree.viewCount = normalizeCount(row.view_count, 'view_count');
  return tree;
}

export async function createOwnerTreeDetailDirectExecutor({ connectionString, executor } = {}) {
  if (typeof executor === 'function') return executor;
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new TypeError('OWNER_TREE_DETAIL_DIRECT_NEON_CONFIG_INVALID');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, { disableWarningInBrowsers: true });
  return async (text, values) => {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    return Array.isArray(rows) ? rows : [];
  };
}

export function isOwnerTreeDetailPublicFallbackResponse(response) {
  return response instanceof Response &&
    response.status === 404 &&
    response.headers.get('x-lovebud-route-status') === OWNER_NOT_FOUND_ROUTE_STATUS;
}

export async function handleOwnerTreeDetailDirectNeon(
  request,
  treeId,
  env = {},
  requestId = null,
  { executorOverride = null, verifyTokenOverride = null, verifierOptions = null } = {}
) {
  if (!isOwnerTreeDetailDirectNeonSelected(env)) return null;

  const requestWithId = makeRequestWithId(request, requestId);
  let principal;
  try {
    const verifyToken = verifyTokenOverride || createFirebaseIdTokenVerifier({
      projectId: readFirebaseProjectId(env),
      ...(verifierOptions && typeof verifierOptions === 'object' ? verifierOptions : {})
    });
    principal = await resolveFirebaseReadPrincipal(requestWithId, verifyToken);
  } catch (error) {
    if (error instanceof FirebaseReadPrincipalError) {
      return decoratePrincipalResponse(
        buildFirebaseReadPrincipalErrorResponse(error, requestWithId),
        requestId
      );
    }
    return jsonResponse({
      error: {
        code: 'FIREBASE_VERIFIER_UNAVAILABLE',
        message: 'Authentication verifier unavailable'
      }
    }, 503, requestId, 'auth-unavailable');
  }

  if (typeof treeId !== 'string' || !treeId.trim()) {
    return jsonResponse({ detail: 'treeId is required' }, 400, requestId, 'invalid-tree-id');
  }
  const safeTreeId = normalizeOwnerTreeDetailId(treeId);
  if (!safeTreeId) {
    return jsonResponse({ detail: 'Invalid treeId' }, 400, requestId, 'invalid-tree-id');
  }

  const config = readOwnerTreeDetailDirectConfig(env);
  if (!config.configured && !executorOverride) {
    return jsonResponse({
      error: 'Owner Tree detail direct-Neon runtime not configured',
      code: 'DIRECT_NEON_CONFIG_ABSENT'
    }, 503, requestId, 'config-absent');
  }

  try {
    const executor = await createOwnerTreeDetailDirectExecutor({
      connectionString: config.connectionString,
      executor: executorOverride || undefined
    });
    const capabilityRows = await executor(OWNER_TREE_DETAIL_SCHEMA_CAPABILITIES_SQL, []);
    const capabilities = normalizeCapabilities(capabilityRows);
    const query = buildOwnerTreeDetailSql(capabilities);
    const rows = await executor(query.text, [safeTreeId, principal.legacyOwnerId]);
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;

    if (!row) {
      // The current authenticated edge contract performs a public Tree lookup
      // only after owner/private detail returns 404. The route recognizes this
      // bounded marker and performs that one compatibility fallback; query and
      // configuration failures never fall back to Modal.
      return jsonResponse({ detail: 'Tree not found' }, 404, requestId, OWNER_NOT_FOUND_ROUTE_STATUS);
    }

    const tree = projectOwnerTreeDetailRow(row, query);
    return jsonResponse(tree, 200, requestId);
  } catch {
    return jsonResponse({ detail: 'Internal server error' }, 500, requestId, 'query-failed');
  }
}

export const OWNER_TREE_DETAIL_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  gate: OWNER_TREE_DETAIL_RUNTIME.GATE_FLAG,
  directValue: OWNER_TREE_DETAIL_RUNTIME.DIRECT_NEON_VALUE,
  databaseUrlEnv: OWNER_TREE_DETAIL_RUNTIME.DATABASE_URL,
  ownerAuthority: 'principal.legacyOwnerId',
  firebaseOnly: true,
  selectOnly: true,
  publicFallbackOnlyAfterOwnerNotFound: true,
  productionCutover: false
});
