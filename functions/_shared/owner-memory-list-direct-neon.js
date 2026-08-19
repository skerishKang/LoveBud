// #4122 authenticated owner Memory-list direct-Neon read candidate.
//
// This helper is GET-only and independently gated. Firebase remains the only
// authentication authority; ownership is derived solely from the verified
// principal.legacyOwnerId established by #4100. POST/write authority remains
// on the existing Modal path.

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

export const OWNER_MEMORIES_READ_RUNTIME = Object.freeze({
  GATE_FLAG: 'LB_OWNER_MEMORIES_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

const DEFAULT_LIMIT = 100;
const MIN_LIMIT = 1;
const MAX_LIMIT = 200;
const CURSOR_VERSION = 1;
const CURSOR_KIND = 'memories';
const MAX_CURSOR_CHARS = 1024;
const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;

export function isOwnerMemoriesDirectNeonSelected(env = {}) {
  const value = typeof env?.[OWNER_MEMORIES_READ_RUNTIME.GATE_FLAG] === 'string'
    ? env[OWNER_MEMORIES_READ_RUNTIME.GATE_FLAG].trim()
    : '';
  return value === OWNER_MEMORIES_READ_RUNTIME.DIRECT_NEON_VALUE;
}

export function isNeonDatabaseUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    const parsed = new URL(value);
    return NEON_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function readOwnerMemoriesDirectConfig(env = {}) {
  const raw = typeof env?.[OWNER_MEMORIES_READ_RUNTIME.DATABASE_URL] === 'string'
    ? env[OWNER_MEMORIES_READ_RUNTIME.DATABASE_URL].trim()
    : '';
  const configured = isNeonDatabaseUrl(raw);
  return Object.freeze({
    configured,
    connectionString: configured ? raw : ''
  });
}

// Preserve the existing Cloudflare Memory-collection preprocessing exactly:
// Number(raw || 100) -> falsy fallback 100 -> clamp 1..200. A finite fraction
// that survives the clamp is subsequently rejected by FastAPI's int parser.
export function normalizeOwnerMemoryLimit(rawLimit) {
  return Math.min(
    Math.max(Number(rawLimit || DEFAULT_LIMIT) || DEFAULT_LIMIT, MIN_LIMIT),
    MAX_LIMIT
  );
}

export function hasFractionalOwnerMemoryLimit(rawLimit) {
  const value = normalizeOwnerMemoryLimit(rawLimit);
  return Number.isFinite(value) && !Number.isInteger(value);
}

export function buildOwnerMemoryIntegerLimitValidationBody(rawLimit) {
  return {
    detail: [{
      type: 'int_parsing',
      loc: ['query', 'limit'],
      msg: 'Input should be a valid integer, unable to parse string as an integer',
      input: String(rawLimit)
    }]
  };
}

export function normalizeDirectNeonTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    throw new TypeError('OWNER_MEMORY_TIMESTAMP_PRECISION_LOST');
  }
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

function normalizeTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map((tag) => String(tag));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map((tag) => String(tag)) : [];
    } catch {
      return raw ? [raw] : [];
    }
  }
  return [];
}

function normalizeStoredVisibility(value) {
  if (value === 'public') return 'public';
  if (value === 'private') return 'private';
  return null;
}

export function projectOwnerMemoryRow(row) {
  if (!row || typeof row !== 'object') {
    throw new TypeError('OWNER_MEMORY_LIST_NORMALIZATION_FAILURE');
  }
  const result = {
    id: String(row.id),
    treeId: row.tree_id ? String(row.tree_id) : null,
    parentId: row.parent_id ? String(row.parent_id) : null,
    title: row.title || '',
    memo: row.memo || '',
    artist: row.artist || '',
    source: row.source || '',
    sourceUrl: row.source_url || '',
    sourceType: row.source_type || 'youtube',
    thumbnail: row.thumbnail || '',
    emotionTags: normalizeTags(row.emotion_tags),
    timestamp: row.timestamp || '',
    visibility: normalizeStoredVisibility(row.visibility),
    channelId: row.channel_id || null,
    channelName: row.channel_name || null,
    channelUrl: row.channel_url || null,
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at)
  };
  if (row.client_key !== null && row.client_key !== undefined) {
    result.clientKey = row.client_key;
  }
  return result;
}

class OwnerMemoryInputError extends Error {
  constructor(detail, routeStatus) {
    super(detail);
    this.detail = detail;
    this.routeStatus = routeStatus;
  }
}

// Mirrors Python uuid.UUID(value.strip()) sufficiently for the current Tree-ID
// route contract, including canonicalization of 32-hex, hyphenated, braces, and
// lowercase urn:uuid: forms into lowercase 8-4-4-4-12 text.
export function normalizeOptionalOwnerMemoryTreeId(raw) {
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new OwnerMemoryInputError('treeId is required', 'invalid-tree-id');
  }
  let hex = raw.trim().replace(/urn:/g, '').replace(/uuid:/g, '');
  hex = hex.replace(/^[{}]+/, '').replace(/[{}]+$/, '').replace(/-/g, '');
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
    throw new OwnerMemoryInputError('Invalid treeId', 'invalid-tree-id');
  }
  hex = hex.toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

export function decodeOwnerMemoryCursor(raw) {
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
  if (!Number.isFinite(Date.parse(createdAt.replace('Z', '+00:00')))) return null;
  const treeId = payload.t === undefined ? null : payload.t;
  if (treeId !== null && (typeof treeId !== 'string' || !treeId || treeId.length > 64)) {
    return null;
  }
  return Object.freeze({ createdAt, id, treeId });
}

export function encodeOwnerMemoryCursor(createdAt, id, treeId = null) {
  const payload = {
    v: CURSOR_VERSION,
    k: CURSOR_KIND,
    c: createdAt == null ? 'None' : String(createdAt),
    i: String(id)
  };
  if (treeId !== null) payload.t = treeId;
  return encodeBase64UrlJson(payload);
}

// The current Modal owner Memory-list authority has no Tree-payload schema
// fallback. Its only optional schema projection is memories.client_key. Detect
// that exact column instead of assuming table existence implies capability.
export const OWNER_MEMORY_CAPABILITY_SQL = `
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'memories'
    AND column_name = 'client_key'
) AS has_client_key;
`;

function readClientKeyCapability(rows) {
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  return row?.has_client_key === true;
}

function memorySelect(hasClientKey) {
  return `m.id::text AS id, m.tree_id::text AS tree_id, m.parent_id::text AS parent_id,
       m.title, m.memo, m.artist, m.source, m.source_url,
       m.source_type, m.thumbnail, m.emotion_tags, m.timestamp, m.visibility,
       m.channel_id, m.channel_name, m.channel_url,
       ${hasClientKey ? 'm.client_key,\n       ' : ''}m.created_at::text AS created_at, m.updated_at::text AS updated_at`;
}

export function buildOwnerMemoryListSql({
  hasClientKey = false,
  treeId = null,
  cursorMode = false,
  cursor = null
} = {}) {
  const values = [];
  let next = 1;
  const ownerParam = `$${next++}`;
  let treePredicate = '';
  let treeParam = null;
  if (treeId !== null) {
    treeParam = `$${next++}`;
    treePredicate = `AND m.tree_id = ${treeParam}`;
  }

  let cursorPredicate = '';
  let cursorParams = null;
  if (cursor) {
    const createdA = `$${next++}`;
    const createdB = `$${next++}`;
    const idParam = `$${next++}`;
    cursorParams = [createdA, createdB, idParam];
    cursorPredicate = `AND ((m.created_at < ${createdA}) OR (m.created_at = ${createdB} AND m.id < ${idParam}))`;
  }
  const limitParam = `$${next}`;
  const order = cursorMode
    ? 'ORDER BY m.created_at DESC, m.id DESC'
    : 'ORDER BY m.created_at DESC';

  return Object.freeze({
    text: `
SELECT ${memorySelect(hasClientKey)}
FROM memories m
INNER JOIN trees t
  ON t.id = m.tree_id
WHERE t.owner_id = ${ownerParam}
${treePredicate}
${cursorPredicate}
${order}
LIMIT ${limitParam};
`,
    ownerParam,
    treeParam,
    cursorParams,
    limitParam,
    hasClientKey
  });
}

export async function createOwnerMemoryListDirectExecutor({ connectionString, executor } = {}) {
  if (typeof executor === 'function') return executor;
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new TypeError('OWNER_MEMORY_LIST_DIRECT_NEON_CONFIG_INVALID');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, { disableWarningInBrowsers: true });
  return async (text, values) => {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    return Array.isArray(rows) ? rows : [];
  };
}

function makeRequestWithId(request, requestId) {
  if (!requestId || request.headers.get(REQUEST_ID_HEADER)) return request;
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Request(request.url, { method: request.method, headers });
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
    const values = exposed.split(',').map((value) => value.trim()).filter(Boolean);
    if (!values.includes(REQUEST_ID_HEADER)) {
      headers.set('Access-Control-Expose-Headers', values.length ? `${exposed}, ${REQUEST_ID_HEADER}` : REQUEST_ID_HEADER);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function handleOwnerMemoriesDirectNeon(
  request,
  env = {},
  requestId = null,
  { executorOverride = null, verifyTokenOverride = null, verifierOptions = null } = {}
) {
  if (!isOwnerMemoriesDirectNeonSelected(env)) return null;

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

  const sourceUrl = new URL(request.url);
  let treeId;
  try {
    treeId = normalizeOptionalOwnerMemoryTreeId(sourceUrl.searchParams.get('treeId'));
  } catch (error) {
    if (error instanceof OwnerMemoryInputError) {
      return jsonResponse({ detail: error.detail }, 400, requestId, error.routeStatus);
    }
    throw error;
  }

  const cursorMode = sourceUrl.searchParams.get('pagination') === 'cursor';
  const rawCursor = sourceUrl.searchParams.get('cursor');
  let cursor = null;
  if (cursorMode && rawCursor) {
    cursor = decodeOwnerMemoryCursor(rawCursor);
    if (!cursor) {
      return jsonResponse({ detail: 'Invalid pagination cursor' }, 400, requestId, 'invalid-cursor');
    }
    if (treeId !== null) {
      if (cursor.treeId !== treeId) {
        return jsonResponse({ detail: 'Invalid pagination cursor' }, 400, requestId, 'invalid-cursor');
      }
    } else if (cursor.treeId !== null) {
      return jsonResponse({ detail: 'Invalid pagination cursor' }, 400, requestId, 'invalid-cursor');
    }
  }

  const config = readOwnerMemoriesDirectConfig(env);
  if (!config.configured && !executorOverride) {
    return jsonResponse({
      error: 'Owner Memory list direct-Neon runtime not configured',
      code: 'DIRECT_NEON_CONFIG_ABSENT'
    }, 503, requestId, 'config-absent');
  }

  const limit = normalizeOwnerMemoryLimit(sourceUrl.searchParams.get('limit'));

  try {
    const executor = await createOwnerMemoryListDirectExecutor({
      connectionString: config.connectionString,
      executor: executorOverride || undefined
    });
    const capabilityRows = await executor(OWNER_MEMORY_CAPABILITY_SQL, []);
    const hasClientKey = readClientKeyCapability(capabilityRows);
    const query = buildOwnerMemoryListSql({ hasClientKey, treeId, cursorMode, cursor });

    const values = [principal.legacyOwnerId];
    if (treeId !== null) values.push(treeId);
    if (cursor) values.push(cursor.createdAt, cursor.createdAt, cursor.id);
    values.push(cursorMode ? limit + 1 : limit);

    const rows = await executor(query.text, values);
    const normalized = (Array.isArray(rows) ? rows : []).map(projectOwnerMemoryRow);

    if (!cursorMode) {
      return jsonResponse(normalized, 200, requestId);
    }

    const hasMore = normalized.length > limit;
    const items = normalized.slice(0, limit);
    const nextCursor = hasMore && items.length
      ? encodeOwnerMemoryCursor(items[items.length - 1].createdAt, items[items.length - 1].id, treeId)
      : null;
    return jsonResponse({ items, nextCursor }, 200, requestId);
  } catch {
    // Current owner Memory-list authority has no schema fallback. Undefined
    // table/column and all other query/capability failures therefore remain
    // bounded, sanitized failures instead of silently changing authorities.
    return jsonResponse({ detail: 'Internal server error' }, 500, requestId, 'query-failed');
  }
}

export const OWNER_MEMORY_LIST_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  ownerAuthority: 'principal.legacyOwnerId',
  defaultLimit: DEFAULT_LIMIT,
  minLimit: MIN_LIMIT,
  maxLimit: MAX_LIMIT,
  rawOrder: 'created_at DESC',
  cursorOrder: 'created_at DESC, id DESC',
  cursorKind: CURSOR_KIND,
  databaseEnv: OWNER_MEMORIES_READ_RUNTIME.DATABASE_URL,
  writeAuthority: 'modal'
});
