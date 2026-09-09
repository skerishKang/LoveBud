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
// Behavioral parity authority is the observable MODAL HTTP BOUNDARY, i.e.
// PUBLIC REQUEST -> FastAPI Query validation/coercion -> route body
// (modal_compute/tree_comments.py::fetch_tree_comments and
// normalize_public_tree_comment_row). Query validation runs before the route
// body, so the internal int()/clamp in fetch_tree_comments is unreachable from
// HTTP and is NOT the parity authority. This adapter preserves the current
// public read sequence exactly:
//   - limit validated against `limit: int = Query(default=20, ge=1, le=50)`
//     FIRST: unparseable / <1 / >50 -> 422 FastAPI validation body with ZERO DB
//     calls; no silent default and no clamp for a supplied value
//   - validate treeId (required UUID, canonical) -> 400 on invalid
//   - public-tree visibility gate BEFORE any comment read (non-public/missing
//     -> 404 "Tree not found", never distinguishable at the anonymous edge)
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

// ─── Sanitized failure diagnostics (#4000 forensic support) ────────────────
// The live-gate canary failed with an undifferentiated 500
// DIRECT_NEON_QUERY_FAILED because the catch swallowed the underlying error.
// These helpers expose ONLY a fixed-vocabulary stage, a strictly normalized
// error class, and a PostgreSQL-shaped SQLSTATE via response headers on the
// existing 500 query-failed path. Error message, stack, detail, hint, where,
// schema/table/column/constraint, query text/parameters, credentials, and
// identifiers are NEVER read, formatted, or forwarded.

const DIAGNOSTIC_STAGES = Object.freeze([
  'executor-init',
  'visibility-query',
  'comments-query',
  'response-normalization',
  'unknown'
]);
const DIAGNOSTIC_ERROR_CLASS_MAX_CHARS = 64;
const DIAGNOSTIC_SQLSTATE_PATTERN = /^[A-Z0-9]{5}$/;
const DIAGNOSTIC_ERROR_CLASS_PATTERN = /[^A-Za-z0-9_-]/g;

// ─── Pages live database identity diagnostic probe (#4000 post-42501) ─────
// The 42501 canary proved the live Pages runtime connection is rejected on
// public.tree_comments while trees visibility succeeded, but the exact
// database/role identity the LOVE_PLATFORM_DATABASE_URL secret reaches is
// still unresolved. This probe answers ONLY with fixed vocabulary:
// raw database names, role names, and connection details NEVER cross the
// response boundary. Expected identities are supplied at activation time as
// one-way SHA-256 fingerprints through non-public (secret_text) env bindings;
// no private identifier is embedded in this source. Selection is via a
// DEDICATED temporary diagnostic env (NOT the read runtime gate) and fails
// closed for any other value. The read gate itself stays absent: the
// selection predicate treats a selector-active request as dispatch-eligible
// so the route can reach this branch without reactivating direct-Neon reads.

export const TREE_COMMENT_READ_DIAGNOSTIC_ENV = Object.freeze({
  SELECTOR: 'LB_TREE_COMMENT_READ_DIAGNOSTIC',
  SELECTOR_VALUE: 'database_identity_probe',
  FORENSIC_DB_FINGERPRINT: 'LOVEBUD_FORENSIC_DB_FINGERPRINT',
  ALTERNATE_DB_FINGERPRINT: 'LOVEBUD_ALTERNATE_DB_FINGERPRINT',
  RUNTIME_ROLE_FINGERPRINT: 'LOVEBUD_EXPECTED_RUNTIME_ROLE_FINGERPRINT'
});

export const TREE_COMMENT_READ_DATABASE_IDENTITY_CLASSES = Object.freeze([
  'EXPECTED_FORENSIC_DB',
  'ALTERNATE_KNOWN_DB',
  'UNKNOWN_DB'
]);
export const TREE_COMMENT_READ_PROBE_TRISTATE = Object.freeze(['YES', 'NO', 'UNKNOWN']);

const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

// ─── Gate / route selection ───────────────────────────────────────────────

export function isTreeCommentReadDirectNeonRequest(request) {
  if (!request || request.method.toUpperCase() !== 'GET') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  // [^/]* (not [^/]+) so a missing treeId segment ('/api/trees//comments') is
  // still recognized as a tree-comment read request and fails 400, mirroring
  // the Modal framework path param that arrives empty for that URL.
  return /^\/api\/trees\/[^/]*\/comments$/.test(path);
}

export function isTreeCommentReadDiagnosticProbeSelected(env = {}) {
  const value = typeof env?.[TREE_COMMENT_READ_DIAGNOSTIC_ENV.SELECTOR] === 'string'
    ? env[TREE_COMMENT_READ_DIAGNOSTIC_ENV.SELECTOR].trim()
    : '';
  return value === TREE_COMMENT_READ_DIAGNOSTIC_ENV.SELECTOR_VALUE;
}

export function isTreeCommentReadDirectNeonSelected(env = {}) {
  // Dispatch eligibility only: a request with the dedicated diagnostic
  // selector is routed into this handler so the identity-probe branch can
  // answer with fixed vocabulary. This does NOT select direct-Neon reads;
  // the handler short-circuits to the probe before any read query runs, and
  // the read runtime gate itself remains the sole trigger for real reads.
  if (isTreeCommentReadDiagnosticProbeSelected(env)) return true;
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

// FastAPI/Pydantic query-string integer grammar actually accepted by the Modal
// HTTP boundary (empirically pinned against fastapi 0.115.12 / pydantic 2.13.4):
// optional sign, decimal digits with single underscores between digits, and an
// optional fractional part that must be exactly zero-valued. Surrounding
// whitespace is stripped first. Exponent, radix, non-ASCII-digit, grouped-space,
// and non-integral fractional forms are all rejected.
const FASTAPI_INT_LAX_PATTERN = /^([+-]?)(\d(?:_?\d)*)(?:\.(\d(?:_?\d)*))?$/;

const LIMIT_VALIDATION_MESSAGES = Object.freeze({
  int_parsing: 'Input should be a valid integer, unable to parse string as an integer',
  greater_than_equal: `Input should be greater than or equal to ${COMMENT_MIN_LIMIT}`,
  less_than_equal: `Input should be less than or equal to ${COMMENT_MAX_LIMIT}`
});

function buildLimitValidationBody(errorType, rawInput) {
  const detail = {
    type: errorType,
    loc: ['query', 'limit'],
    msg: LIMIT_VALIDATION_MESSAGES[errorType],
    input: String(rawInput)
  };
  // FastAPI emits `ctx` only for constrained-value failures, never for
  // int_parsing, and emits it last in the Pydantic error-dict field order.
  if (errorType === 'greater_than_equal') detail.ctx = { ge: COMMENT_MIN_LIMIT };
  if (errorType === 'less_than_equal') detail.ctx = { le: COMMENT_MAX_LIMIT };
  return { detail: [detail] };
}

// Starlette resolves a repeated scalar query param to its LAST occurrence, so
// `?limit=5&limit=7` behaves as `?limit=7`. searchParams.get() returns the first.
function resolveRawLimit(searchParams) {
  const all = searchParams.getAll('limit');
  return all.length > 0 ? all[all.length - 1] : null;
}

// Returns { ok: true, value } or { ok: false, status: 422, body }.
// There is deliberately NO clamp and NO silent default for a supplied value:
// the Modal HTTP boundary rejects out-of-range and unparseable limits with 422
// before fetch_tree_comments() ever runs.
function normalizeLimit(rawLimit) {
  if (rawLimit === null || rawLimit === undefined) {
    return { ok: true, value: COMMENT_DEFAULT_LIMIT, status: null, body: null };
  }
  const text = String(rawLimit).trim();
  const match = FASTAPI_INT_LAX_PATTERN.exec(text);
  if (!match) {
    return { ok: false, value: null, status: 422, body: buildLimitValidationBody('int_parsing', rawLimit) };
  }
  const [, sign, integerDigits, fractionDigits] = match;
  if (fractionDigits !== undefined && /[^0]/.test(fractionDigits)) {
    return { ok: false, value: null, status: 422, body: buildLimitValidationBody('int_parsing', rawLimit) };
  }
  const value = Number(`${sign}${integerDigits.replace(/_/g, '')}`);
  if (value < COMMENT_MIN_LIMIT) {
    return { ok: false, value: null, status: 422, body: buildLimitValidationBody('greater_than_equal', rawLimit) };
  }
  if (value > COMMENT_MAX_LIMIT) {
    return { ok: false, value: null, status: 422, body: buildLimitValidationBody('less_than_equal', rawLimit) };
  }
  return { ok: true, value, status: null, body: null };
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

// Pure sanitizer: caught value + stage in, fixed safe structure out. Reads
// ONLY error.constructor.name (fallback error.name) and error.code; every
// other property of the error is never touched.
export function sanitizeTreeCommentReadFailure(error, stage) {
  const safeStage = DIAGNOSTIC_STAGES.includes(stage) ? stage : 'unknown';
  let errorClass = 'UnknownError';
  try {
    const raw = error && typeof error.constructor === 'function' && typeof error.constructor.name === 'string'
      ? error.constructor.name
      : (error && typeof error.name === 'string' ? error.name : '');
    const normalized = String(raw).replace(DIAGNOSTIC_ERROR_CLASS_PATTERN, '').slice(0, DIAGNOSTIC_ERROR_CLASS_MAX_CHARS);
    if (normalized) errorClass = normalized;
  } catch {
    errorClass = 'UnknownError';
  }
  let sqlstate = null;
  try {
    if (error && typeof error.code === 'string' && DIAGNOSTIC_SQLSTATE_PATTERN.test(error.code)) {
      sqlstate = error.code;
    }
  } catch {
    sqlstate = null;
  }
  return Object.freeze({ stage: safeStage, errorClass, sqlstate });
}

// Fixed diagnostic headers for the 500 query-failed path only. A null
// SQLSTATE omits its header entirely.
function diagnosticFailureHeaders(error, stage) {
  const sanitized = sanitizeTreeCommentReadFailure(error, stage);
  const headers = {
    'x-lovebud-error-stage': sanitized.stage,
    'x-lovebud-error-class': sanitized.errorClass
  };
  if (sanitized.sqlstate) headers['x-lovebud-sqlstate'] = sanitized.sqlstate;
  return headers;
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

// ─── Pages live database identity diagnostic probe (implementation) ───────

export const TREE_COMMENT_READ_DATABASE_IDENTITY_PROBE_SQL = [
  'SELECT',
  '  current_database() AS database_name,',
  "  current_user::text AS current_role_name,",
  "  session_user::text AS session_role_name,",
  "  has_table_privilege(current_user, 'public.trees', 'SELECT') AS trees_select,",
  "  has_table_privilege(current_user, 'public.tree_comments', 'SELECT') AS tree_comments_select"
].join('\n');

export async function fingerprintTreeCommentReadIdentity(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function expectedIdentityFingerprint(env, envName) {
  const raw = typeof env?.[envName] === 'string' ? env[envName].trim().toLowerCase() : '';
  return FINGERPRINT_PATTERN.test(raw) ? raw : null;
}

function probeTriState(value) {
  if (value === true || value === 't' || value === 'true') return 'YES';
  if (value === false || value === 'f' || value === 'false') return 'NO';
  return 'UNKNOWN';
}

// Pure classifier: consumes already-fetched probe row values plus locally
// injected expected SHA-256 fingerprints and returns ONLY fixed-vocabulary
// enums. Raw names are used solely for one-way hashing inside this function
// and never appear in its output.
export async function classifyTreeCommentReadDatabaseIdentity(probe, expected = {}) {
  let databaseClass = 'UNKNOWN_DB';
  try {
    const dbFingerprint = await fingerprintTreeCommentReadIdentity(probe?.databaseName ?? '');
    const forensic = typeof expected.forensicDbFingerprint === 'string'
      && FINGERPRINT_PATTERN.test(expected.forensicDbFingerprint)
      ? expected.forensicDbFingerprint.toLowerCase()
      : null;
    const alternate = typeof expected.alternateDbFingerprint === 'string'
      && FINGERPRINT_PATTERN.test(expected.alternateDbFingerprint)
      ? expected.alternateDbFingerprint.toLowerCase()
      : null;
    if (forensic && dbFingerprint === forensic) databaseClass = 'EXPECTED_FORENSIC_DB';
    else if (alternate && dbFingerprint === alternate) databaseClass = 'ALTERNATE_KNOWN_DB';
  } catch {
    databaseClass = 'UNKNOWN_DB';
  }

  let runtimeRoleMatch = 'UNKNOWN';
  try {
    const role = typeof expected.runtimeRoleFingerprint === 'string'
      && FINGERPRINT_PATTERN.test(expected.runtimeRoleFingerprint)
      ? expected.runtimeRoleFingerprint.toLowerCase()
      : null;
    if (role) {
      const currentFingerprint = await fingerprintTreeCommentReadIdentity(probe?.currentRole ?? '');
      const sessionFingerprint = await fingerprintTreeCommentReadIdentity(probe?.sessionRole ?? '');
      runtimeRoleMatch = currentFingerprint === role && sessionFingerprint === role ? 'YES' : 'NO';
    }
  } catch {
    runtimeRoleMatch = 'UNKNOWN';
  }

  return Object.freeze({
    databaseClass,
    runtimeRoleMatch,
    selectTrees: probeTriState(probe?.treesSelect),
    selectTreeComments: probeTriState(probe?.treeCommentsSelect)
  });
}

async function handleTreeCommentReadDatabaseIdentityProbe(request, env, requestId, { executorOverride }) {
  // Same credential boundary as real reads: dedicated read-only Product DB
  // authority only, fail closed, no generic/write fallback.
  const forbidden = detectForbiddenReadFallback(env);
  if (forbidden) {
    return jsonResponse(
      { error: 'Tree Comment read diagnostic probe configuration refused', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' },
      503,
      requestId,
      'config-forbidden-fallback'
    );
  }
  const config = readTreeCommentReadConfig(env);
  if (!config.configured) {
    return jsonResponse(
      { error: 'Tree Comment read diagnostic probe configuration absent', code: 'DIRECT_NEON_CONFIG_ABSENT' },
      503,
      requestId,
      'config-absent'
    );
  }

  let executor;
  try {
    executor = typeof executorOverride === 'function'
      ? executorOverride
      : await createTreeCommentReadExecutor({ connectionString: config.connectionString });
  } catch {
    return jsonResponse(
      { error: 'Tree Comment read diagnostic probe unavailable', code: 'DIRECT_NEON_DIAGNOSTIC_PROBE_FAILED' },
      500,
      requestId,
      'probe-unavailable'
    );
  }

  try {
    const rows = await executor(TREE_COMMENT_READ_DATABASE_IDENTITY_PROBE_SQL, []);
    const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
    if (!row || typeof row !== 'object') {
      return jsonResponse(
        { error: 'Tree Comment read diagnostic probe unavailable', code: 'DIRECT_NEON_DIAGNOSTIC_PROBE_FAILED' },
        500,
        requestId,
        'probe-shape-invalid'
      );
    }
    const classification = await classifyTreeCommentReadDatabaseIdentity(
      {
        databaseName: row.database_name,
        currentRole: row.current_role_name,
        sessionRole: row.session_role_name,
        treesSelect: row.trees_select,
        treeCommentsSelect: row.tree_comments_select
      },
      {
        forensicDbFingerprint: expectedIdentityFingerprint(env, TREE_COMMENT_READ_DIAGNOSTIC_ENV.FORENSIC_DB_FINGERPRINT),
        alternateDbFingerprint: expectedIdentityFingerprint(env, TREE_COMMENT_READ_DIAGNOSTIC_ENV.ALTERNATE_DB_FINGERPRINT),
        runtimeRoleFingerprint: expectedIdentityFingerprint(env, TREE_COMMENT_READ_DIAGNOSTIC_ENV.RUNTIME_ROLE_FINGERPRINT)
      }
    );
    return jsonResponse(
      {
        diagnostic: 'tree_comment_read_database_identity_probe',
        databaseClass: classification.databaseClass,
        runtimeRoleMatch: classification.runtimeRoleMatch,
        selectTrees: classification.selectTrees,
        selectTreeComments: classification.selectTreeComments
      },
      200,
      requestId,
      'diagnostic-probe'
    );
  } catch (error) {
    // Fixed-vocabulary failure only; underlying error details never surface.
    return jsonResponse(
      { error: 'Tree Comment read diagnostic probe unavailable', code: 'DIRECT_NEON_DIAGNOSTIC_PROBE_FAILED' },
      500,
      requestId,
      'probe-failed',
      diagnosticFailureHeaders(error, 'unknown')
    );
  }
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

  // Ephemeral identity-probe diagnostic: fixed-vocabulary answer only, zero
  // product-row reads, independent of the read runtime gate value.
  if (isTreeCommentReadDiagnosticProbeSelected(env)) {
    return handleTreeCommentReadDatabaseIdentityProbe(request, env, requestId, { executorOverride });
  }

  const url = new URL(request.url);

  // 1. limit validation FIRST. modal_compute/app.py::get_tree_comments declares
  // `limit: int = Query(default=20, ge=1, le=50)`, so FastAPI validates the query
  // string before the route body runs and before fetch_tree_comments() reaches
  // validate_required_uuid / the visibility gate. A rejected limit must therefore
  // produce 422 with ZERO executor calls, never a clamped/defaulted 200 and never
  // a treeId 400 or visibility 404 masking it.
  const limitResult = normalizeLimit(resolveRawLimit(url.searchParams));
  if (!limitResult.ok) {
    return jsonResponse(limitResult.body, limitResult.status, requestId, 'invalid-limit');
  }
  const limit = limitResult.value;

  // 2. treeId validation (Modal validate_required_uuid parity).
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
        'query-failed',
        diagnosticFailureHeaders(error, 'unknown')
      );
    }
  }

  // 5. execute: visibility gate first, then comments. SELECT-only.
  // stage tracks the last fixed diagnostic boundary entered before any throw;
  // it is reported sanitized on the 500 path and never affects behavior.
  let stage = 'unknown';
  try {
    stage = 'executor-init';
    const executor = typeof executorOverride === 'function'
      ? executorOverride
      : await createTreeCommentReadExecutor({
        connectionString: config.connectionString
      });

    stage = 'visibility-query';
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

    stage = 'comments-query';
    const commentRows = await executor(buildTreeCommentReadSql(Boolean(decoded)), params);
    const rows = Array.isArray(commentRows) ? commentRows : [];

    stage = 'response-normalization';
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
  } catch (error) {
    return jsonResponse(
      {
        error: 'Tree Comment read direct-Neon query failed',
        code: 'DIRECT_NEON_QUERY_FAILED'
      },
      500,
      requestId,
      'query-failed',
      diagnosticFailureHeaders(error, stage)
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
  limitValidation: 'http_422_fastapi_query_parity_no_clamp',
  limitValidationOrder: 'before_tree_id_and_before_any_db_query',
  cursorKind: COMMENT_CURSOR_KIND,
  projection: ['id', 'tree_id', 'body', 'created_at', 'updated_at'],
  responseDto: ['id', 'treeId', 'body', 'createdAt', 'updatedAt', 'authorDisplayLabel'],
  writes: false,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  softDeleteFilter: 'none (tree_comments has no soft-delete column; matches Modal fetch_tree_comments)'
});
