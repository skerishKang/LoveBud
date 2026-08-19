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

export const OWNER_TREES_READ_RUNTIME = Object.freeze({
  GATE_FLAG: 'LB_OWNER_TREES_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

const OWNER_TREE_DEFAULT_LIMIT = 100;
const OWNER_TREE_MIN_LIMIT = 1;
const OWNER_TREE_MAX_LIMIT = 200;
const CURSOR_VERSION = 1;
const CURSOR_KIND = 'trees';
const MAX_CURSOR_CHARS = 1024;
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

export function normalizeDirectNeonTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Date) throw new TypeError('DIRECT_NEON_TIMESTAMP_PRECISION_LOST');
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
    return '.' + (digits + '000000').slice(0, 6);
  });
  if (offset === 'Z') return body + '+00:00';
  if (!offset) return body;
  const sign = offset[0];
  const rest = offset.slice(1);
  return body + (rest.includes(':') ? offset : `${sign}${rest}:00`);
}

export function isOwnerTreesDirectNeonSelected(env = {}) {
  const value = typeof env?.[OWNER_TREES_READ_RUNTIME.GATE_FLAG] === 'string'
    ? env[OWNER_TREES_READ_RUNTIME.GATE_FLAG].trim()
    : '';
  return value === OWNER_TREES_READ_RUNTIME.DIRECT_NEON_VALUE;
}

export function normalizeOwnerTreeLimit(rawLimit) {
  return Math.min(
    Math.max(Number(rawLimit || OWNER_TREE_DEFAULT_LIMIT) || OWNER_TREE_DEFAULT_LIMIT, OWNER_TREE_MIN_LIMIT),
    OWNER_TREE_MAX_LIMIT
  );
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
    'x-lovebud-runtime': 'direct_neon'
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

function decorateDirectResponse(response, requestId) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-lovebud-upstream', 'direct-neon');
  headers.set('x-lovebud-runtime', 'direct_neon');
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

export function readOwnerTreesDirectConfig(env = {}) {
  const raw = typeof env?.[OWNER_TREES_READ_RUNTIME.DATABASE_URL] === 'string'
    ? env[OWNER_TREES_READ_RUNTIME.DATABASE_URL].trim()
    : '';
  const configured = isNeonDatabaseUrl(raw);
  return Object.freeze({
    configured,
    connectionString: configured ? raw : ''
  });
}

function decodeBase64UrlJson(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_CURSOR_CHARS) return null;
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const parsed = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
    ));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function encodeBase64UrlJson(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_');
}

export function decodeOwnerTreeCursor(raw) {
  const payload = decodeBase64UrlJson(raw);
  if (!payload || payload.v !== CURSOR_VERSION || payload.k !== CURSOR_KIND) return null;
  const createdAt = payload.c;
  const id = payload.i;
  if (
    typeof createdAt !== 'string' || !createdAt || createdAt.length > 64 ||
    typeof id !== 'string' || !id || id.length > 64
  ) {
    return null;
  }
  const timestamp = Date.parse(createdAt.replace('Z', '+00:00'));
  if (!Number.isFinite(timestamp)) return null;
  return Object.freeze({ createdAt, id });
}

export function encodeOwnerTreeCursor(createdAt, id) {
  return encodeBase64UrlJson({
    v: CURSOR_VERSION,
    k: CURSOR_KIND,
    c: String(createdAt),
    i: String(id)
  });
}

export const OWNER_TREE_SCHEMA_CAPABILITIES_SQL = `
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

function socialProjection(capabilities) {
  const hasTable = capabilities.hasSocialCounts;
  const hasLike = hasTable && capabilities.hasLikeCount;
  const hasView = hasTable && capabilities.hasViewCount;
  if (!hasLike && !hasView) {
    return { join: '', select: '', group: '', hasLike: false, hasView: false };
  }
  const selects = [];
  const groups = [];
  if (hasLike) {
    selects.push('COALESCE(s.like_count, 0) AS like_count');
    groups.push('s.like_count');
  }
  if (hasView) {
    selects.push('COALESCE(s.view_count, 0) AS view_count');
    groups.push('s.view_count');
  }
  return {
    join: 'LEFT JOIN tree_social_counts s ON t.id = s.tree_id',
    select: `,\n       ${selects.join(',\n       ')}`,
    group: `,\n             ${groups.join(', ')}`,
    hasLike,
    hasView
  };
}

export function buildOwnerTreesSql({ cursorMode = false, cursor = null, capabilities = {} } = {}) {
  const social = socialProjection({
    hasSocialCounts: capabilities.hasSocialCounts === true,
    hasLikeCount: capabilities.hasLikeCount === true,
    hasViewCount: capabilities.hasViewCount === true
  });
  const cursorPredicate = cursor
    ? 'AND ((t.created_at < $2) OR (t.created_at = $2 AND t.id < $3))'
    : '';
  const limitParameter = cursor ? '$4' : '$2';
  const order = cursorMode
    ? 'ORDER BY t.created_at DESC, t.id DESC'
    : 'ORDER BY t.created_at DESC';

  return Object.freeze({
    text: `
SELECT t.id::text AS id, t.owner_id::text AS owner_id, t.title, t.visibility,
       t.group_name, t.keywords,
       t.created_at::text AS created_at, t.updated_at::text AS updated_at,
       COUNT(m.id)::int AS memory_count${social.select}
FROM trees t
LEFT JOIN memories m ON m.tree_id = t.id
${social.join}
WHERE t.owner_id = $1
${cursorPredicate}
GROUP BY t.id, t.owner_id, t.title, t.visibility,
         t.group_name, t.keywords,
         t.created_at, t.updated_at${social.group}
${order}
LIMIT ${limitParameter};
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
  if (trimmed.length > 80) throw new Error('OWNER_TREE_LIST_NORMALIZATION_FAILURE');
  return trimmed;
}

function normalizeKeywords(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((item) => String(item));
}

export function projectOwnerTreeRow(row, { hasLike = false, hasView = false } = {}) {
  if (!row || typeof row !== 'object') throw new Error('OWNER_TREE_LIST_NORMALIZATION_FAILURE');
  const tree = {
    id: String(row.id),
    title: row.title || '',
    visibility: normalizeStoredVisibility(row.visibility),
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at),
    memoryCount: Number(row.memory_count || 0),
    ownerId: row.owner_id ? String(row.owner_id) : null,
    groupName: normalizeGroupName(row.group_name),
    keywords: normalizeKeywords(row.keywords)
  };
  if (hasLike) {
    const value = Number(row.like_count ?? 0);
    if (Number.isInteger(value) && value >= 0) tree.likeCount = value;
  }
  if (hasView) {
    const value = Number(row.view_count ?? 0);
    if (Number.isInteger(value) && value >= 0) tree.viewCount = value;
  }
  return tree;
}

function readCapabilities(rows) {
  const row = Array.isArray(rows) && rows.length ? rows[0] : {};
  return Object.freeze({
    hasSocialCounts: row?.has_social_counts === true,
    hasLikeCount: row?.has_like_count === true,
    hasViewCount: row?.has_view_count === true
  });
}

export async function createOwnerTreesDirectExecutor({ connectionString, executor } = {}) {
  if (typeof executor === 'function') return executor;
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new TypeError('OWNER_TREES_DIRECT_NEON_CONFIG_INVALID');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, { disableWarningInBrowsers: true });
  return async (text, values) => {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    return Array.isArray(rows) ? rows : [];
  };
}

export async function handleOwnerTreesDirectNeon(
  request,
  env = {},
  requestId = null,
  { executorOverride = null, verifyTokenOverride = null, verifierOptions = null } = {}
) {
  if (!isOwnerTreesDirectNeonSelected(env)) return null;

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
      return decorateDirectResponse(
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

  const config = readOwnerTreesDirectConfig(env);
  if (!config.configured && !executorOverride) {
    return jsonResponse({
      error: 'Owner Tree direct-Neon runtime not configured',
      code: 'DIRECT_NEON_CONFIG_ABSENT'
    }, 503, requestId, 'config-absent');
  }

  const sourceUrl = new URL(request.url);
  const limit = normalizeOwnerTreeLimit(sourceUrl.searchParams.get('limit'));
  const cursorMode = sourceUrl.searchParams.get('pagination') === 'cursor';
  let cursor = null;
  if (cursorMode && sourceUrl.searchParams.has('cursor')) {
    cursor = decodeOwnerTreeCursor(sourceUrl.searchParams.get('cursor'));
    if (!cursor) {
      return jsonResponse({ detail: 'Invalid pagination cursor' }, 400, requestId, 'invalid-cursor');
    }
  }

  try {
    const executor = await createOwnerTreesDirectExecutor({
      connectionString: config.connectionString,
      executor: executorOverride || undefined
    });
    const capabilityRows = await executor(OWNER_TREE_SCHEMA_CAPABILITIES_SQL, []);
    const capabilities = readCapabilities(capabilityRows);
    const query = buildOwnerTreesSql({ cursorMode, cursor, capabilities });
    const values = [principal.legacyOwnerId];
    if (cursor) values.push(cursor.createdAt, cursor.id);
    values.push(cursorMode ? limit + 1 : limit);

    const rawRows = await executor(query.text, values);
    const normalized = (Array.isArray(rawRows) ? rawRows : []).map((row) => projectOwnerTreeRow(row, query));

    if (!cursorMode) {
      return jsonResponse(normalized, 200, requestId);
    }

    const hasMore = normalized.length > limit;
    const items = normalized.slice(0, limit);
    const nextCursor = hasMore && items.length
      ? encodeOwnerTreeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
      : null;
    return jsonResponse({ items, nextCursor }, 200, requestId);
  } catch {
    return jsonResponse({ detail: 'Internal server error' }, 500, requestId, 'query-failed');
  }
}

export const OWNER_TREE_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  ownerAuthority: 'principal.legacyOwnerId',
  defaultLimit: OWNER_TREE_DEFAULT_LIMIT,
  minLimit: OWNER_TREE_MIN_LIMIT,
  maxLimit: OWNER_TREE_MAX_LIMIT,
  paginationMode: 'cursor',
  databaseEnv: OWNER_TREES_READ_RUNTIME.DATABASE_URL,
  gateEnv: OWNER_TREES_READ_RUNTIME.GATE_FLAG,
  writes: false,
  entitlementLookup: false,
  alternateAuthProvider: false
});
