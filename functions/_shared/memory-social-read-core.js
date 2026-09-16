// #4423 shared read-only primitives for residual Memory social GET migration.
// This file deliberately owns no runtime gate. Four thin route-specific
// direct-Neon helpers select it independently so every read can be rolled back
// without coupling unrelated Product surfaces.

import {
  FirebaseReadPrincipalError,
  buildFirebaseReadPrincipalErrorResponse,
  resolveFirebaseReadPrincipal
} from '../../workers/love-platform-api/firebase-read-principal.js';
import {
  createFirebaseIdTokenVerifier,
  readFirebaseProjectId
} from './firebase-id-token-verifier.js';
import { normalizeDirectNeonTimestamp } from './public-memory-detail-direct-neon.js';
import { REQUEST_ID_HEADER } from './request-id.js';

const DATABASE_URL_ENV = 'LOVE_PLATFORM_DATABASE_URL';
const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;
const UUID_HEX = /^[0-9a-f]{32}$/;
const FASTAPI_INT_LAX_PATTERN = /^([+-]?)(\d(?:_?\d)*)(?:\.(\d(?:_?\d)*))?$/;
const CURSOR_KIND = 'moment_comments';
const CURSOR_VERSION = 1;
const CURSOR_MAX_PAYLOAD_CHARS = 1024;

export function isMemorySocialReadNeonUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    return NEON_HOST.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function readMemorySocialReadConfig(env = {}) {
  const raw = typeof env?.[DATABASE_URL_ENV] === 'string' ? env[DATABASE_URL_ENV].trim() : '';
  const configured = isMemorySocialReadNeonUrl(raw);
  return Object.freeze({ configured, connectionString: configured ? raw : '' });
}

export async function createMemorySocialReadExecutor({ connectionString, executorOverride = null } = {}) {
  if (typeof executorOverride === 'function') return executorOverride;
  if (!isMemorySocialReadNeonUrl(connectionString)) {
    throw new TypeError('MEMORY_SOCIAL_READ_DIRECT_NEON_CONFIG_INVALID');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, { disableWarningInBrowsers: true });
  return async function memorySocialReadExecutor(text, values) {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    if (!Array.isArray(rows)) throw new TypeError('MEMORY_SOCIAL_READ_RESULT_INVALID');
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

function makeRequestWithId(request, requestId) {
  if (!requestId || request.headers.get(REQUEST_ID_HEADER)) return request;
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Request(request.url, { method: request.method, headers });
}

async function resolvePrincipal(request, env, requestId, options = {}) {
  const requestWithId = makeRequestWithId(request, requestId);
  try {
    const verifyToken = options.verifyTokenOverride || createFirebaseIdTokenVerifier({
      projectId: readFirebaseProjectId(env),
      ...(options.verifierOptions && typeof options.verifierOptions === 'object'
        ? options.verifierOptions
        : {})
    });
    const principal = await resolveFirebaseReadPrincipal(requestWithId, verifyToken);
    return { ok: true, principal, requestWithId };
  } catch (error) {
    if (error instanceof FirebaseReadPrincipalError) {
      return {
        ok: false,
        response: decorateDirectResponse(
          buildFirebaseReadPrincipalErrorResponse(error, requestWithId),
          requestId,
          'auth-rejected'
        )
      };
    }
    return {
      ok: false,
      response: jsonResponse({
        error: {
          code: 'FIREBASE_VERIFIER_UNAVAILABLE',
          message: 'Authentication verifier unavailable'
        }
      }, 503, requestId, 'auth-unavailable')
    };
  }
}

function normalizePythonUuid(rawValue, name) {
  const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!raw) return { ok: false, status: 400, detail: `${name} is required` };
  let hex = raw.toLowerCase();
  if (hex.startsWith('urn:uuid:')) hex = hex.slice('urn:uuid:'.length);
  if (hex.startsWith('{') && hex.endsWith('}')) hex = hex.slice(1, -1);
  hex = hex.replace(/-/g, '');
  if (!UUID_HEX.test(hex)) return { ok: false, status: 400, detail: `Invalid ${name}` };
  return {
    ok: true,
    value: `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
  };
}

function normalizeRequiredId(rawValue, name) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!value) return { ok: false, status: 400, detail: `${name} is required` };
  return { ok: true, value };
}

function lastSearchParam(searchParams, name) {
  const all = searchParams.getAll(name);
  return all.length ? all[all.length - 1] : null;
}

function limitValidationBody(errorType, rawInput, min, max) {
  const messages = {
    int_parsing: 'Input should be a valid integer, unable to parse string as an integer',
    greater_than_equal: `Input should be greater than or equal to ${min}`,
    less_than_equal: `Input should be less than or equal to ${max}`
  };
  const detail = {
    type: errorType,
    loc: ['query', 'limit'],
    msg: messages[errorType],
    input: String(rawInput)
  };
  if (errorType === 'greater_than_equal') detail.ctx = { ge: min };
  if (errorType === 'less_than_equal') detail.ctx = { le: max };
  return { detail: [detail] };
}

function normalizeFastApiLimit(rawLimit, { defaultValue, min, max }) {
  if (rawLimit === null || rawLimit === undefined) {
    return { ok: true, value: defaultValue };
  }
  const text = String(rawLimit).trim();
  const match = FASTAPI_INT_LAX_PATTERN.exec(text);
  if (!match) {
    return { ok: false, body: limitValidationBody('int_parsing', rawLimit, min, max) };
  }
  const [, sign, integerDigits, fractionDigits] = match;
  if (fractionDigits !== undefined && /[^0]/.test(fractionDigits)) {
    return { ok: false, body: limitValidationBody('int_parsing', rawLimit, min, max) };
  }
  const value = Number(`${sign}${integerDigits.replace(/_/g, '')}`);
  if (value < min) {
    return { ok: false, body: limitValidationBody('greater_than_equal', rawLimit, min, max) };
  }
  if (value > max) {
    return { ok: false, body: limitValidationBody('less_than_equal', rawLimit, min, max) };
  }
  return { ok: true, value };
}

export class MemorySocialCursorError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'MemorySocialCursorError';
    this.reason = reason;
  }
}

function encodeCommentCursor(createdAt, rowId, targetId) {
  const payload = { v: CURSOR_VERSION, k: CURSOR_KIND, c: String(createdAt), i: String(rowId) };
  if (targetId != null) payload.t = String(targetId);
  // Python urlsafe_b64encode retains padding. Buffer base64url omits it, so use
  // base64 then translate the alphabet to preserve the existing wire format.
  return Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeCommentCursor(raw, expectedTargetId) {
  if (!raw || typeof raw !== 'string') throw new MemorySocialCursorError('empty');
  if (raw.length > CURSOR_MAX_PAYLOAD_CHARS) throw new MemorySocialCursorError('oversized');
  let payload;
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    throw new MemorySocialCursorError('not_base64_json');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new MemorySocialCursorError('not_object');
  }
  if (payload.v !== CURSOR_VERSION) throw new MemorySocialCursorError('bad_version');
  if (payload.k !== CURSOR_KIND) throw new MemorySocialCursorError('wrong_kind');
  const createdAt = payload.c;
  const rowId = payload.i;
  if (
    typeof createdAt !== 'string' ||
    typeof rowId !== 'string' ||
    !rowId ||
    rowId.length > 64 ||
    createdAt.length > 64 ||
    Number.isNaN(Date.parse(createdAt.replace('Z', '+00:00')))
  ) {
    throw new MemorySocialCursorError('missing_fields');
  }
  const targetId = payload.t;
  if (expectedTargetId != null && (targetId == null || String(targetId) !== String(expectedTargetId))) {
    throw new MemorySocialCursorError('target_mismatch');
  }
  return { createdAt, id: rowId };
}

export const MEMORY_VISIBLE_OR_OWNER_SQL = `
SELECT
  m.id::text AS id,
  m.tree_id::text AS tree_id,
  m.visibility AS mem_visibility,
  t.owner_id::text AS tree_owner_id,
  t.visibility AS tree_visibility
FROM memories m
INNER JOIN trees t ON t.id = m.tree_id
WHERE m.id = $1
LIMIT 1;
`;

export const PUBLIC_MEMORY_MEMBERSHIP_SQL = `
SELECT m.id::text AS id, m.tree_id::text AS tree_id
FROM memories m
INNER JOIN trees t ON t.id = m.tree_id
WHERE m.id = $1
  AND m.tree_id = $2
  AND m.visibility = 'public'
  AND t.visibility = 'public'
LIMIT 1;
`;

export const AUTH_REACTION_SUMMARY_SQL = `
SELECT
  type,
  COUNT(*)::int AS count,
  BOOL_OR(owner_id = $2) AS requester_active
FROM reactions
WHERE memory_id = $1
GROUP BY type
ORDER BY type;
`;

export const PUBLIC_REACTION_SUMMARY_SQL = `
SELECT type, COUNT(*)::int AS count
FROM reactions
WHERE memory_id = $1
GROUP BY type
ORDER BY type;
`;

function commentsSql({ authenticated, cursor }) {
  const fields = authenticated
    ? 'id::text AS id, memory_id::text AS memory_id, owner_id::text AS owner_id, body, created_at::text AS created_at, updated_at::text AS updated_at'
    : 'id::text AS id, body, created_at::text AS created_at';
  const predicate = cursor
    ? 'AND ((created_at > $2) OR (created_at = $2 AND id > $3))'
    : '';
  const limitPlaceholder = cursor ? '$4' : '$2';
  return `
SELECT ${fields}
FROM comments
WHERE memory_id = $1
  AND status = 'visible'
  AND deleted_at IS NULL
  ${predicate}
ORDER BY created_at ASC, id ASC
LIMIT ${limitPlaceholder};
`;
}

function reactionCounts(rows) {
  const counts = {};
  for (const row of rows || []) {
    const count = Number(row?.count);
    if (!Number.isSafeInteger(count) || count < 0 || row?.type == null) {
      throw new TypeError('MEMORY_SOCIAL_REACTION_NORMALIZATION_FAILED');
    }
    counts[String(row.type)] = count;
  }
  return counts;
}

function normalizeAuthenticatedComment(row, requesterUid) {
  if (!row || row.id == null || row.memory_id == null || row.owner_id == null) {
    throw new TypeError('MEMORY_SOCIAL_COMMENT_NORMALIZATION_FAILED');
  }
  return {
    id: String(row.id),
    memoryId: String(row.memory_id),
    body: String(row.body),
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at),
    isOwn: String(row.owner_id) === String(requesterUid)
  };
}

function normalizePublicComment(row) {
  if (!row || row.id == null) throw new TypeError('MEMORY_SOCIAL_COMMENT_NORMALIZATION_FAILED');
  return {
    id: String(row.id),
    body: String(row.body),
    createdAt: normalizeDirectNeonTimestamp(row.created_at)
  };
}

async function executorFor(env, options, requestId) {
  const config = readMemorySocialReadConfig(env);
  if (!config.configured && typeof options.executorOverride !== 'function') {
    return {
      ok: false,
      response: jsonResponse({
        error: 'Memory social read direct-Neon runtime not configured',
        code: 'DIRECT_NEON_CONFIG_ABSENT'
      }, 503, requestId, 'config-absent')
    };
  }
  try {
    return {
      ok: true,
      executor: await createMemorySocialReadExecutor({
        connectionString: config.connectionString,
        executorOverride: options.executorOverride
      })
    };
  } catch {
    return {
      ok: false,
      response: jsonResponse({
        error: 'Memory social read direct-Neon query failed',
        code: 'DIRECT_NEON_QUERY_FAILED'
      }, 500, requestId, 'executor-init-failed')
    };
  }
}

async function requireVisibleOrOwner(executor, memoryId, ownerId) {
  const rows = await executor(MEMORY_VISIBLE_OR_OWNER_SQL, [memoryId]);
  const row = rows?.[0];
  if (!row) return false;
  if (String(row.tree_owner_id || '') === String(ownerId)) return true;
  return row.mem_visibility === 'public' && row.tree_visibility === 'public';
}

async function requirePublicMembership(executor, treeId, memoryId) {
  const rows = await executor(PUBLIC_MEMORY_MEMBERSHIP_SQL, [memoryId, treeId]);
  return Boolean(rows?.[0]);
}

export async function handleAuthenticatedMemoryReactionRead(
  request, env, rawMemoryId, requestId, options = {}
) {
  const auth = await resolvePrincipal(request, env, requestId, options);
  if (!auth.ok) return auth.response;

  const idResult = normalizePythonUuid(rawMemoryId, 'memoryId');
  if (!idResult.ok) {
    return jsonResponse({ detail: idResult.detail }, idResult.status, requestId, 'invalid-memory-id');
  }
  const memoryId = idResult.value;

  const ex = await executorFor(env, options, requestId);
  if (!ex.ok) return ex.response;

  try {
    if (!await requireVisibleOrOwner(ex.executor, memoryId, auth.principal.legacyOwnerId)) {
      return jsonResponse({ detail: 'Memory not found' }, 404, requestId, 'not-found');
    }
    const rows = await ex.executor(AUTH_REACTION_SUMMARY_SQL, [memoryId, auth.principal.legacyOwnerId]);
    const counts = {};
    const userReactions = {};
    for (const row of rows || []) {
      const count = Number(row?.count);
      if (!Number.isSafeInteger(count) || count < 0 || row?.type == null) {
        throw new TypeError('MEMORY_SOCIAL_REACTION_NORMALIZATION_FAILED');
      }
      const type = String(row.type);
      counts[type] = count;
      if (Boolean(row.requester_active)) userReactions[type] = true;
    }
    return jsonResponse({ counts, userReactions }, 200, requestId, 'memory-reaction-read-complete');
  } catch {
    return jsonResponse({
      error: 'Memory reaction read direct-Neon query failed',
      code: 'DIRECT_NEON_QUERY_FAILED'
    }, 500, requestId, 'query-failed');
  }
}

export async function handlePublicMemoryReactionRead(
  request, env, rawTreeId, rawMemoryId, requestId, options = {}
) {
  const treeResult = normalizeRequiredId(rawTreeId, 'treeId');
  if (!treeResult.ok) return jsonResponse({ detail: treeResult.detail }, 400, requestId, 'invalid-tree-id');
  const memoryResult = normalizeRequiredId(rawMemoryId, 'memoryId');
  if (!memoryResult.ok) return jsonResponse({ detail: memoryResult.detail }, 400, requestId, 'invalid-memory-id');

  const ex = await executorFor(env, options, requestId);
  if (!ex.ok) return ex.response;

  try {
    if (!await requirePublicMembership(ex.executor, treeResult.value, memoryResult.value)) {
      return jsonResponse({ detail: 'Memory not found' }, 404, requestId, 'not-found');
    }
    const rows = await ex.executor(PUBLIC_REACTION_SUMMARY_SQL, [memoryResult.value]);
    const counts = reactionCounts(rows);
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return jsonResponse({ counts, total }, 200, requestId, 'public-memory-reaction-read-complete');
  } catch {
    return jsonResponse({
      error: 'Public Memory reaction read direct-Neon query failed',
      code: 'DIRECT_NEON_QUERY_FAILED'
    }, 500, requestId, 'query-failed');
  }
}

export async function handleAuthenticatedMemoryCommentRead(
  request, env, rawMemoryId, requestId, options = {}
) {
  const url = new URL(request.url);
  const limitResult = normalizeFastApiLimit(lastSearchParam(url.searchParams, 'limit'), {
    defaultValue: 50, min: 1, max: 200
  });
  if (!limitResult.ok) return jsonResponse(limitResult.body, 422, requestId, 'invalid-limit');

  const auth = await resolvePrincipal(request, env, requestId, options);
  if (!auth.ok) return auth.response;

  const idResult = normalizePythonUuid(rawMemoryId, 'memoryId');
  if (!idResult.ok) {
    return jsonResponse({ detail: idResult.detail }, idResult.status, requestId, 'invalid-memory-id');
  }
  const memoryId = idResult.value;

  const ex = await executorFor(env, options, requestId);
  if (!ex.ok) return ex.response;

  try {
    if (!await requireVisibleOrOwner(ex.executor, memoryId, auth.principal.legacyOwnerId)) {
      return jsonResponse({ detail: 'Memory not found' }, 404, requestId, 'not-found');
    }

    const rawCursor = lastSearchParam(url.searchParams, 'cursor');
    const pagination = lastSearchParam(url.searchParams, 'pagination');
    const cursorMode = pagination === 'cursor' || rawCursor !== null;

    let decoded = null;
    if (cursorMode && rawCursor !== null) {
      try {
        decoded = decodeCommentCursor(rawCursor, memoryId);
      } catch (error) {
        if (error instanceof MemorySocialCursorError) {
          return jsonResponse({ detail: 'Invalid pagination cursor' }, 400, requestId, 'invalid-cursor');
        }
        throw error;
      }
    }

    if (!cursorMode) {
      const rows = await ex.executor(commentsSql({ authenticated: true, cursor: false }), [memoryId, 50]);
      return jsonResponse(
        rows.map((row) => normalizeAuthenticatedComment(row, auth.principal.legacyOwnerId)),
        200,
        requestId,
        'memory-comment-read-complete'
      );
    }

    const params = [memoryId];
    if (decoded) params.push(decoded.createdAt, decoded.id);
    params.push(limitResult.value + 1);
    const rows = await ex.executor(commentsSql({ authenticated: true, cursor: Boolean(decoded) }), params);
    const hasMore = rows.length > limitResult.value;
    const returnedRows = hasMore ? rows.slice(0, limitResult.value) : rows;
    const comments = returnedRows.map((row) => normalizeAuthenticatedComment(row, auth.principal.legacyOwnerId));
    let nextCursor = null;
    if (hasMore && returnedRows.length) {
      const last = returnedRows[returnedRows.length - 1];
      nextCursor = encodeCommentCursor(
        normalizeDirectNeonTimestamp(last.created_at),
        String(last.id),
        memoryId
      );
    }
    return jsonResponse({ comments, nextCursor }, 200, requestId, 'memory-comment-read-complete');
  } catch {
    return jsonResponse({
      error: 'Memory comment read direct-Neon query failed',
      code: 'DIRECT_NEON_QUERY_FAILED'
    }, 500, requestId, 'query-failed');
  }
}

export async function handlePublicMemoryCommentRead(
  request, env, rawTreeId, rawMemoryId, requestId, options = {}
) {
  const url = new URL(request.url);
  const limitResult = normalizeFastApiLimit(lastSearchParam(url.searchParams, 'limit'), {
    defaultValue: 20, min: 1, max: 50
  });
  if (!limitResult.ok) return jsonResponse(limitResult.body, 422, requestId, 'invalid-limit');

  const treeResult = normalizeRequiredId(rawTreeId, 'treeId');
  if (!treeResult.ok) return jsonResponse({ detail: treeResult.detail }, 400, requestId, 'invalid-tree-id');
  const memoryResult = normalizeRequiredId(rawMemoryId, 'memoryId');
  if (!memoryResult.ok) return jsonResponse({ detail: memoryResult.detail }, 400, requestId, 'invalid-memory-id');

  const ex = await executorFor(env, options, requestId);
  if (!ex.ok) return ex.response;

  try {
    if (!await requirePublicMembership(ex.executor, treeResult.value, memoryResult.value)) {
      return jsonResponse({ detail: 'Memory not found' }, 404, requestId, 'not-found');
    }

    const rawCursor = lastSearchParam(url.searchParams, 'cursor');
    let decoded = null;
    if (rawCursor !== null) {
      try {
        decoded = decodeCommentCursor(rawCursor, memoryResult.value);
      } catch (error) {
        if (error instanceof MemorySocialCursorError) {
          return jsonResponse({ detail: 'Invalid pagination cursor' }, 400, requestId, 'invalid-cursor');
        }
        throw error;
      }
    }

    const params = [memoryResult.value];
    if (decoded) params.push(decoded.createdAt, decoded.id);
    params.push(limitResult.value + 1);
    const rows = await ex.executor(commentsSql({ authenticated: false, cursor: Boolean(decoded) }), params);
    const hasMore = rows.length > limitResult.value;
    const returnedRows = hasMore ? rows.slice(0, limitResult.value) : rows;
    const comments = returnedRows.map(normalizePublicComment);
    let nextCursor = null;
    if (hasMore && returnedRows.length) {
      const last = returnedRows[returnedRows.length - 1];
      nextCursor = encodeCommentCursor(
        normalizeDirectNeonTimestamp(last.created_at),
        String(last.id),
        memoryResult.value
      );
    }
    return jsonResponse({ comments, nextCursor }, 200, requestId, 'public-memory-comment-read-complete');
  } catch {
    return jsonResponse({
      error: 'Public Memory comment read direct-Neon query failed',
      code: 'DIRECT_NEON_QUERY_FAILED'
    }, 500, requestId, 'query-failed');
  }
}

export const MEMORY_SOCIAL_READ_CORE_CONTRACT = Object.freeze({
  databaseEnv: DATABASE_URL_ENV,
  credentialBoundary: 'direct_neon_runtime',
  cursorKind: CURSOR_KIND,
  writes: false,
  directToModalFallbackAfterExecutionBegins: false
});
