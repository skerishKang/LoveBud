// #4000 Phase-4 Tree Comment LIST (read) Cloudflare -> Neon Serverless HTTP
// adapter. Anonymous public read of whole-tree (tree-level) comments.
//
// This is a gated MIGRATION CANDIDATE only. The Product Tree Comment list
// route remains Modal-backed unless the route-specific gate is explicitly
// selected:
//
//   LB_TREE_COMMENT_READ_RUNTIME=direct_neon
//
// unset / modal / unknown  -> existing Modal path (this adapter returns null)
// direct_neon             -> direct-Neon candidate
//
// After explicit direct execution begins there is NO per-request direct ->
// Modal fallback. Missing/bad read config or any query failure fails closed.
//
// Behavioral parity authority is the current Modal implementation
// (modal_compute/tree_comments.py::fetch_tree_comments and
// normalize_public_tree_comment_row). This adapter preserves the current
// public read sequence exactly:
//   - validate treeId (required UUID, canonical) -> 400 on invalid
//   - public-tree visibility gate BEFORE any comment read (non-public/missing
//     -> 404 "Tree not found", never distinguishable at the anonymous edge)
//   - bounded limit (default 20, clamp 1..50)
//   - oldest-first stable ordering (created_at ASC, id ASC)
//   - opaque base64url forward cursor (kind "tree_comments", target-scoped),
//     invalid cursor -> 400
//   - SELECT-only projection: id, tree_id, body, created_at, updated_at
//     (NO owner_id; safe public DTO never returns the raw account identifier)
//   - safe public DTO { id, treeId, body, createdAt, updatedAt,
//                       authorDisplayLabel: "anonymous" }
//   - empty list -> { comments: [], nextCursor: null }
//
// The tree_comments table has NO soft-delete column (only the moment-level
// `comments` table does; see scripts/migration-add-tree-comments.sql and
// modal_compute/comments.py::soft_delete_own_comment). Modal's
// fetch_tree_comments does not filter a deleted_at column, so this adapter
// intentionally does NOT add a non-existent soft-delete predicate.
//
// Credential boundary: read-only Product DB credential LOVE_PLATFORM_DATABASE_URL
// only. No writer credential, no generic/read fallback when the read credential
// is absent (fails closed). This source child does NOT create a Production
// secret/role, does NOT perform GRANT/REVOKE, does NOT change schema, and does
// NOT activate the Production route gate.

import { REQUEST_ID_HEADER } from './request-id.js';

export const TREE_COMMENT_READ_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_TREE_COMMENT_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

// Forbidden generic/write DB envs must never satisfy the dedicated read config.
// If the read-only Product DB credential is absent, fail closed rather than
// silently substituting a writer/generic connection string.
export const TREE_COMMENT_READ_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_WRITE_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANONYMOUS_DISPLAY_LABEL = 'anonymous';
const COMMENT_DEFAULT_LIMIT = 20;
const COMMENT_MIN_LIMIT = 1;
const COMMENT_MAX_LIMIT = 50;
const COMMENT_CURSOR_KIND = 'tree_comments';
const COMMENT_CURSOR_VERSION = 1;
const CURSOR_MAX_PAYLOAD_CHARS = 1024;
const FORBIDDEN_SET = new Set(TREE_COMMENT_READ_FORBIDDEN_FALLBACK_ENVS);

// ─── Gate / route selection ───────────────────────────────────────────────

export function isTreeCommentReadDirectNeonRequest(request) {
  if (!request || request.method.toUpperCase() !== 'GET') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  // [^/]* (not [^/]+) so a missing treeId segment ('/api/trees//comments') is
  // still recognized as a tree-comment read request and fails 400, mirroring
  // the Modal framework path param that arrives empty for that URL.
  return /^\/api\/trees\/[^/]*\/comments$/.test(path);
}

export function isTreeCommentReadDirectNeonSelected(env = {}) {
  const value = typeof env?.[TREE_COMMENT_READ_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[TREE_COMMENT_READ_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === TREE_COMMENT_READ_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

// ─── Read-only config (no generic/write fallback) ─────────────────────────

export function isNeonDatabaseUrl(value) {
  if (typeof value !== 'string' || !/^postgres(?:ql)?:\/\//i.test(value)) return false;
  try {
    return /(?:^|\.)neon\.tech$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function readTreeCommentReadConfig(env = {}) {
  const dedicated = typeof env?.[TREE_COMMENT_READ_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[TREE_COMMENT_READ_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonDatabaseUrl(dedicated);
  return Object.freeze({
    dedicated,
    configured,
    connectionString: configured ? dedicated : ''
  });
}

export function detectForbiddenReadFallback(env = {}) {
  if (readTreeCommentReadConfig(env).configured) return null;
  for (const name of TREE_COMMENT_READ_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonDatabaseUrl(raw)) {
      return Object.freeze({ name, connectionString: raw });
    }
  }
  return null;
}

// ─── Opaque base64url comment cursor (kind "tree_comments") ───────────────
// Port of modal_compute/social_cursor.py for the tree_comments kind. No HMAC;
// fail-closed on missing/malformed/oversized/wrong-kind/target-mismatch.

export class TreeCommentCursorError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'TreeCommentCursorError';
    this.reason = reason;
  }
}

function encodeCommentCursor(createdAtStr, rowId, targetId) {
  const payload = {
    v: COMMENT_CURSOR_VERSION,
    k: COMMENT_CURSOR_KIND,
    c: createdAtStr,
    i: String(rowId)
  };
  if (targetId !== null && targetId !== undefined) {
    payload.t = String(targetId);
  }
  const raw = JSON.stringify(payload);
  return Buffer.from(raw, 'utf8').toString('base64url');
}

function decodeCommentCursor(raw, expectedTargetId) {
  if (!raw || typeof raw !== 'string') {
    throw new TreeCommentCursorError('empty');
  }
  if (raw.length > CURSOR_MAX_PAYLOAD_CHARS) {
    throw new TreeCommentCursorError('oversized');
  }
  let json;
  try {
    const pad = -raw.length % 4;
    const decoded = Buffer.from(raw + '='.repeat(pad < 0 ? 0 : pad), 'base64url').toString('utf8');
    json = JSON.parse(decoded);
  } catch {
    throw new TreeCommentCursorError('not_base64_json');
  }
  if (!json || typeof json !== 'object') {
    throw new TreeCommentCursorError('not_object');
  }
  if (json.v !== COMMENT_CURSOR_VERSION) {
    throw new TreeCommentCursorError('bad_version');
  }
  if (json.k !== COMMENT_CURSOR_KIND) {
    throw new TreeCommentCursorError('wrong_kind');
  }
  const createdAt = json.c;
  const rowId = json.i;
  if (
    typeof createdAt !== 'string'
    || typeof rowId !== 'string'
    || !rowId
    || rowId.length > 64
    || createdAt.length > 64
  ) {
    throw new TreeCommentCursorError('missing_fields');
  }
  const targetId = json.t;
  if (expectedTargetId !== null && expectedTargetId !== undefined) {
    if (targetId === null || targetId === undefined || String(targetId) !== String(expectedTargetId)) {
      throw new TreeCommentCursorError('target_mismatch');
    }
  }
  return {
    createdAt,
    createdAtStr: createdAt,
    id: String(rowId),
    targetId: targetId !== null && targetId !== undefined ? String(targetId) : null
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function extractTreeId(request) {
  const url = new URL(request.url);
  // ['', 'api', 'trees', '<treeId>', 'comments'] — keep the empty segment
  // (do NOT filter(Boolean)) so a missing treeId ('/api/trees//comments')
  // resolves to '' and fails 400, instead of being mis-parsed as the sibling
  // 'comments' segment.
  const parts = url.pathname.split('/');
  const raw = parts[3] !== undefined ? parts[3] : '';
  return raw;
}

function normalizeTreeId(rawId) {
  const trimmed = String(rawId || '').trim();
  if (!trimmed) {
    return { ok: false, value: null, detail: 'treeId is required', status: 400 };
  }
  if (!UUID_PATTERN.test(trimmed)) {
    return { ok: false, value: null, detail: 'Invalid treeId', status: 400 };
  }
  return { ok: true, value: trimmed.toLowerCase(), detail: null, status: null };
}

// Python int() parity for query-string input. modal_compute/tree_comments.py::
// fetch_tree_comments does `int(limit)` inside try/except (TypeError, ValueError)
// -> 20. Python int() on a string accepts only an optionally signed run of decimal
// digits (surrounding whitespace allowed); it raises ValueError on fractional and
// exponent forms, so "1.9" and "1e2" fall back to the default rather than becoming
// 1 and 100. Number()/Math.trunc() would silently accept both, so the grammar is
// matched explicitly instead of relying on numeric coercion.
const PYTHON_INT_STRING_PATTERN = /^[+-]?\d+$/;

function normalizeLimit(rawLimit) {
  const text = rawLimit === null || rawLimit === undefined ? '' : String(rawLimit).trim();
  let parsed = COMMENT_DEFAULT_LIMIT;
  if (PYTHON_INT_STRING_PATTERN.test(text)) parsed = Number(text);
  if (parsed < COMMENT_MIN_LIMIT) parsed = COMMENT_MIN_LIMIT;
  if (parsed > COMMENT_MAX_LIMIT) parsed = COMMENT_MAX_LIMIT;
  return parsed;
}

// Safe public read DTO. Mirrors modal_compute/tree_comments.py::
// normalize_public_tree_comment_row: never returns the raw account identifier.
// The owner-variant normalizeTreeCommentRow (row DTO) is intentionally NOT
// reused here because the anonymous public contract omits ownerId and adds
// authorDisplayLabel, and widening to ownerId would leak the account id.
export function normalizePublicTreeCommentRow(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.id == null) return null;
  return {
    id: String(row.id),
    treeId: String(row.tree_id),
    body: String(row.body),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    authorDisplayLabel: ANONYMOUS_DISPLAY_LABEL
  };
}

function responseHeaders(requestId, routeStatus = null, extraHeaders = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon'
  };
  if (routeStatus) headers['x-lovebud-route-status'] = routeStatus;
  if (requestId) {
    headers['x-lovebud-request-id'] = requestId;
    headers['Access-Control-Expose-Headers'] = 'x-lovebud-request-id';
  }
  if (extraHeaders) {
    for (const [name, value] of Object.entries(extraHeaders)) {
      headers[name] = value;
    }
  }
  return headers;
}

function jsonResponse(body, status, requestId, routeStatus = null, extraHeaders = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(requestId, routeStatus, extraHeaders)
  });
}

// ─── Static, parameterized, SELECT-only queries ───────────────────────────

export const TREE_COMMENT_READ_VISIBILITY_SQL = `
SELECT id, visibility
FROM trees
WHERE id = $1
LIMIT 1;
`;

export function buildTreeCommentReadSql(useCursor) {
  const cursorPredicate = useCursor
    ? "AND ((created_at > $2) OR (created_at = $2 AND id > $3))"
    : '';
  const limitPlaceholder = useCursor ? '$4' : '$2';
  return `
SELECT id, tree_id, body, created_at::text AS created_at, updated_at::text AS updated_at
FROM tree_comments
WHERE tree_id = $1
  ${cursorPredicate}
ORDER BY created_at ASC, id ASC
LIMIT ${limitPlaceholder};
`;
}

// ─── Neon Serverless executor (read-only) ─────────────────────────────────

export async function createTreeCommentReadExecutor({ connectionString, neonOptions, executorOverride } = {}) {
  if (typeof executorOverride === 'function') return executorOverride;
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new TypeError('TREE_COMMENT_READ_DIRECT_NEON_CONFIG_INVALID');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, {
    disableWarningInBrowsers: true,
    ...(neonOptions && typeof neonOptions === 'object' ? neonOptions : {})
  });
  return async function treeCommentReadExecutor(text, values) {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    return Array.isArray(rows) ? rows : [];
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────

export async function handleTreeCommentReadDirectNeon(
  request,
  env = {},
  requestId = null,
  { executorOverride = null } = {}
) {
  // Default/unknown gate -> existing Modal path unchanged. Return null so the
  // gateway continues to the Modal-owned read route.
  if (!isTreeCommentReadDirectNeonRequest(request) || !isTreeCommentReadDirectNeonSelected(env)) {
    return null;
  }

  const url = new URL(request.url);

  // 1. treeId validation (Modal validate_required_uuid parity).
  const treeIdResult = normalizeTreeId(extractTreeId(request));
  if (!treeIdResult.ok) {
    return jsonResponse(
      { detail: treeIdResult.detail },
      treeIdResult.status,
      requestId,
      'invalid-tree-id'
    );
  }
  const treeId = treeIdResult.value;

  // 2. bounded limit (default 20, clamp 1..50).
  const limit = normalizeLimit(url.searchParams.get('limit'));

  // 3. dedicated read DB authority. No generic/write fallback.
  // Fail closed FIRST if only a writer/generic DB URL is present: never
  // substitute it for the dedicated read-only Product credential. This must be
  // checked before the "config absent" branch so a write-only environment is
  // refused with FORBIDDEN_FALLBACK rather than a misleading ABSENT.
  const forbidden = detectForbiddenReadFallback(env);
  if (forbidden) {
    return jsonResponse(
      {
        error: 'Tree Comment read direct-Neon config invalid',
        code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK'
      },
      503,
      requestId,
      'config-forbidden-fallback'
    );
  }
  const config = readTreeCommentReadConfig(env);
  if (!config.configured && !executorOverride) {
    return jsonResponse(
      {
        error: 'Tree Comment read direct-Neon runtime not configured',
        code: 'DIRECT_NEON_CONFIG_ABSENT'
      },
      503,
      requestId,
      'config-absent'
    );
  }

  // 4. cursor decode (fail closed 400 on invalid).
  let decoded = null;
  const rawCursor = url.searchParams.get('cursor');
  if (rawCursor !== null && rawCursor !== undefined && rawCursor !== '') {
    try {
      decoded = decodeCommentCursor(rawCursor, treeId);
    } catch (error) {
      if (error instanceof TreeCommentCursorError) {
        return jsonResponse(
          { detail: 'Invalid pagination cursor' },
          400,
          requestId,
          'invalid-cursor'
        );
      }
      return jsonResponse(
        {
          error: 'Tree Comment read direct-Neon query failed',
          code: 'DIRECT_NEON_QUERY_FAILED'
        },
        500,
        requestId,
        'query-failed'
      );
    }
  }

  // 5. execute: visibility gate first, then comments. SELECT-only.
  try {
    const executor = executorOverride || await createTreeCommentReadExecutor({
      connectionString: config.connectionString
    });

    const visibilityRows = await executor(TREE_COMMENT_READ_VISIBILITY_SQL, [treeId]);
    const treeRow = Array.isArray(visibilityRows) && visibilityRows.length > 0 ? visibilityRows[0] : null;
    // Defense in depth: non-public/missing row is indistinguishable from
    // not-found at the anonymous edge (mirrors is_explicit_public).
    if (!treeRow || treeRow.visibility !== 'public') {
      return jsonResponse(
        { detail: 'Tree not found' },
        404,
        requestId,
        'not-found'
      );
    }

    const params = [treeId];
    if (decoded) {
      params.push(decoded.createdAtStr, decoded.id);
    }
    params.push(limit + 1);

    const commentRows = await executor(buildTreeCommentReadSql(Boolean(decoded)), params);
    const rows = Array.isArray(commentRows) ? commentRows : [];

    const hasMore = rows.length > limit;
    const returnedRows = hasMore ? rows.slice(0, limit) : rows;
    const items = returnedRows
      .map((row) => normalizePublicTreeCommentRow(row))
      .filter((dto) => dto !== null);

    let nextCursor = null;
    if (hasMore && returnedRows.length > 0) {
      const last = returnedRows[returnedRows.length - 1];
      nextCursor = encodeCommentCursor(
        String(last.created_at),
        String(last.id),
        treeId
      );
    }

    return jsonResponse({ comments: items, nextCursor }, 200, requestId, 'ok');
  } catch {
    return jsonResponse(
      {
        error: 'Tree Comment read direct-Neon query failed',
        code: 'DIRECT_NEON_QUERY_FAILED'
      },
      500,
      requestId,
      'query-failed'
    );
  }
}

export const TREE_COMMENT_READ_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  path: '/api/trees/:id/comments',
  gateEnv: TREE_COMMENT_READ_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: TREE_COMMENT_READ_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: TREE_COMMENT_READ_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: TREE_COMMENT_READ_FORBIDDEN_FALLBACK_ENVS,
  credentialBoundary: 'read_only_product_db',
  ownerAuthority: 'none (anonymous public read)',
  visibilityGate: 'require_public_tree_before_read',
  defaultLimit: COMMENT_DEFAULT_LIMIT,
  limitRange: [COMMENT_MIN_LIMIT, COMMENT_MAX_LIMIT],
  cursorKind: COMMENT_CURSOR_KIND,
  projection: ['id', 'tree_id', 'body', 'created_at', 'updated_at'],
  responseDto: ['id', 'treeId', 'body', 'createdAt', 'updatedAt', 'authorDisplayLabel'],
  writes: false,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  softDeleteFilter: 'none (tree_comments has no soft-delete column; matches Modal fetch_tree_comments)'
});
