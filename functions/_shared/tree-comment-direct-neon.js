// #4145 Phase-4 Tree Comment create Cloudflare -> Neon WebSocket interactive
// transaction candidate adapter.
//
// This is a gated MIGRATION CANDIDATE only. The Product Tree Comment route
// remains Modal-backed unless the route-specific gate is explicitly selected:
//
//   LB_TREE_COMMENT_WRITE_RUNTIME=direct_neon
//
// unset / modal / unknown  -> existing Modal path (this adapter returns null)
// direct_neon             -> direct-Neon candidate
//
// After explicit direct execution begins there is NO per-request direct -> Modal
// fallback. Missing/bad direct config or any auth/query/transaction failure fails
// closed.
//
// Ownership is derived ONLY from a server-verified Firebase principal
// (principal.legacyOwnerId). Body/query/header UID, email, unverified decoded
// claims, custom headers, and Neon Auth tokens are never owner authority.
//
// The direct candidate reuses the merged #4132 Neon WS interactive transaction
// adapter verbatim and does NOT duplicate its state machine. One request-scoped
// Neon Client per invocation; adapter-owned BEGIN/COMMIT/ROLLBACK; no automatic
// whole-transaction retry; COMMIT transport failure -> explicit unknown outcome
// with no rollback and no blind retry.
//
// Behavioral parity authority is the current Modal implementation
// (modal_compute/tree_comments.py::create_tree_comment). This adapter preserves
// the current writer sequence exactly:
//   - Tree explicit-public authorization FOR SHARE (require_public_tree_cursor)
//   - NO advisory lock (the current Tree Comment writer has none; none is added)
//   - generic idempotency reserve/replay (SELECT-first, target_kind='tree')
//   - tree-comment actor rate limit AFTER replay resolution, BEFORE insert
//   - INSERT INTO tree_comments ... RETURNING as canonical writer result
//   - idempotency completion + audit before commit
//   - normalized comment DTO { id, treeId, ownerId, body, createdAt, updatedAt }
//   - work failure -> rollback
//   - COMMIT ambiguity -> bounded non-success; no blind retry
//   - sanitized errors; no token/DB URL/JWK/private leakage
//
// BODY-BEARING FINGERPRINT PARITY (#4145 Web CTO correction): the authoritative
// Modal fingerprint hashes the UTF-8 bytes of
//   json.dumps({"body": safe_body}, sort_keys=True, ensure_ascii=False, default=str)
// which uses Python separator spacing (`{"body": "..."}` with a space after the
// colon), preserves non-ASCII characters raw, and escapes per the Python JSON
// encoder. A plain JavaScript JSON.stringify would hash different bytes for any
// body-bearing payload, so this adapter implements the Python canonical encoder
// directly instead of reusing the body-empty Like serializer.
//
// This source child does NOT create a Production writer secret/role, does NOT
// perform GRANT/REVOKE, does NOT change schema, and does NOT activate the
// Production route gate.

import {
  createNeonWsTransactionAdapter,
  isNeonWsConnectionString,
  NeonWsTransactionError,
  NEON_WS_TRANSACTION_ERROR,
  sanitizeNeonWsTransactionError
} from './db/neon-ws-transaction-adapter.js';
import {
  createFirebaseIdTokenVerifier,
  readFirebaseProjectId
} from './firebase-id-token-verifier.js';
import {
  resolveFirebaseReadPrincipal,
  buildFirebaseReadPrincipalErrorResponse,
  FirebaseReadPrincipalError
} from '../../workers/love-platform-api/firebase-read-principal.js';
import { readBoundedRequestBody } from './bounded-request-body.js';

export const TREE_COMMENT_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_TREE_COMMENT_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

// Forbidden generic/read DB envs must never satisfy the dedicated writer config.
export const TREE_COMMENT_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:\-]{8,128}$/;
const FORBIDDEN_SET = new Set(TREE_COMMENT_FORBIDDEN_FALLBACK_ENVS);
const COMMENT_OPERATION = 'tree.comment.create';
const TARGET_KIND = 'tree';
const COMMENT_BODY_MAX = 5000;
const TREE_COMMENT_ACTOR_RATE_SCOPE = 'tree-comment:actor';
const TREE_COMMENT_ACTOR_LIMIT = 10;
const RATE_LIMIT_WINDOW_MINUTES = 1;
const RATE_LIMIT_RETRY_AFTER_MS = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

// ─── Gate / route selection ───────────────────────────────────────────────

export function isTreeCommentDirectNeonRequest(request) {
  if (!request || request.method.toUpperCase() !== 'POST') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return /^\/api\/trees\/[^/]+\/comments$/.test(path);
}

export function isTreeCommentDirectNeonSelected(env = {}) {
  const value = typeof env?.[TREE_COMMENT_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[TREE_COMMENT_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === TREE_COMMENT_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

// ─── Dedicated writer config (no generic fallback) ───────────────────────

export function readTreeCommentWriteConfig(env = {}) {
  const dedicated = typeof env?.[TREE_COMMENT_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[TREE_COMMENT_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(dedicated);
  return Object.freeze({
    dedicated,
    configured,
    connectionString: configured ? dedicated : ''
  });
}

export function detectForbiddenWriterFallback(env = {}) {
  if (readTreeCommentWriteConfig(env).configured) return null;
  for (const name of TREE_COMMENT_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonWsConnectionString(raw)) {
      return Object.freeze({ name, connectionString: raw });
    }
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

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

function extractTreeId(request) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  return parts[2] || '';
}

function validateTreeId(rawId) {
  const trimmed = String(rawId || '').trim();
  if (!trimmed) {
    return { ok: false, value: null, detail: 'treeId is required', status: 400 };
  }
  if (!UUID_PATTERN.test(trimmed)) {
    return { ok: false, value: null, detail: 'Invalid treeId', status: 400 };
  }
  return { ok: true, value: trimmed, detail: null, status: null };
}

function validateIdempotencyKey(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key) {
    return { ok: false, value: null, detail: 'Idempotency-Key header is required for this operation', code: 'IDEMPOTENCY_KEY_REQUIRED', status: 400 };
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return { ok: false, value: null, detail: 'Idempotency-Key must be 8-128 ASCII characters from [A-Za-z0-9._:-]', code: 'IDEMPOTENCY_KEY_INVALID', status: 400 };
  }
  return { ok: true, value: key, detail: null, code: null, status: null };
}

async function computeSha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function computeKeyHash(key) {
  return computeSha256Hex(key);
}

// Python json.dumps ensure_ascii=False string escaping parity. Escapes exactly
// `"`, `\`, and control characters < 0x20 (short forms for \b \t \n \f \r,
// lowercase `\u00xx` for the rest); every other code point stays raw UTF-8,
// including non-ASCII text and U+2028/U+2029 which JSON.stringify would escape.
function pythonJsonEscapeString(value) {
  let out = '"';
  for (const ch of String(value)) {
    const code = ch.codePointAt(0);
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (code === 0x08) out += '\\b';
    else if (code === 0x09) out += '\\t';
    else if (code === 0x0a) out += '\\n';
    else if (code === 0x0c) out += '\\f';
    else if (code === 0x0d) out += '\\r';
    else if (code < 0x20) out += '\\u' + code.toString(16).padStart(4, '0');
    else out += ch;
  }
  return out + '"';
}

// Canonical fingerprint payload bytes for the authoritative Modal body dict:
//   json.dumps({"body": safe_body}, sort_keys=True, ensure_ascii=False, default=str)
// Python default separators are (', ', ': '), so a single-key dict renders as
// `{"body": "<escaped>"}` with a space after the colon.
export function buildPythonCanonicalCommentBodyPayload(safeBody) {
  return `{"body": ${pythonJsonEscapeString(safeBody)}}`;
}

function computeCommentFingerprintPayload(safeBody) {
  return buildPythonCanonicalCommentBodyPayload(safeBody);
}

async function computeCommentFingerprintHash(safeBody) {
  return computeSha256Hex(computeCommentFingerprintPayload(safeBody));
}

// modal_compute/validation.py::validate_optional_string(value, 5000) parity:
// None/non-string -> "" ; string -> trim ; > max after trim -> 400.
// Length is counted in Unicode code points to match Python len().
function normalizeCommentBody(value) {
  if (value === null || value === undefined || typeof value !== 'string') {
    return { ok: true, value: '', oversized: false };
  }
  const trimmed = value.trim();
  const codePointLength = [...trimmed].length;
  if (codePointLength > COMMENT_BODY_MAX) {
    return { ok: false, value: null, oversized: true };
  }
  return { ok: true, value: trimmed, oversized: false };
}

// UTC minute bucket matching social_rate_limit.check_and_increment_rate_limit:
// datetime.now(timezone.utc) truncated to the minute, isoformat() (+00:00).
function rateLimitWindowStartUtcMinute() {
  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}` +
    `T${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}:00+00:00`
  );
}

function normalizeTreeCommentRow(row) {
  return {
    id: String(row.id),
    treeId: String(row.tree_id),
    ownerId: String(row.owner_id),
    body: String(row.body),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

// ─── Shared idempotency conflict verification ─────────────────────────────
// Used by both SELECT-first and INSERT-conflict paths so verification cannot
// drift. Throws a NeonWsTransactionError carrying a bounded workSignal outcome
// for different-target/different-fingerprint/pending/failed conflicts. Returns
// the replay DTO for completed/replayed rows, or null for a fresh reservation
// (matching generated resultId + pending state).
async function verifyIdempotencyRow(
  tx,
  row,
  workSignal,
  { targetKind, treeId, fingerprint, ownerId, keyHash }
) {
  const storedKind = String(row.target_kind);
  const storedTarget = String(row.target_id);
  const storedFingerprint = String(row.request_fingerprint);
  const storedResultId = row.result_id ? String(row.result_id) : null;
  const storedState = String(row.result_state);

  // Different target -> 409 IDEMPOTENCY_KEY_REUSED.
  if (storedKind !== targetKind || storedTarget !== treeId) {
    workSignal.outcome = { status: 409, body: { error: 'Idempotency key was used for a different target', code: 'IDEMPOTENCY_KEY_REUSED' }, routeStatus: 'idempotency-key-reused' };
    const err = new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
      'IDEMPOTENCY_KEY_REUSED'
    );
    err.status = 409;
    throw err;
  }

  // Different fingerprint -> 409 IDEMPOTENCY_KEY_REUSED.
  if (storedFingerprint !== fingerprint) {
    workSignal.outcome = { status: 409, body: { error: 'Idempotency key was used with a different request payload', code: 'IDEMPOTENCY_KEY_REUSED' }, routeStatus: 'idempotency-key-reused' };
    const err = new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
      'IDEMPOTENCY_KEY_REUSED'
    );
    err.status = 409;
    throw err;
  }

  // Completed/replayed -> canonical replay; no second comment insert.
  // Parity: audit replay first, then re-read the ORIGINAL tree_comments row by
  // result_id (the original row is the canonical writer result authority).
  // Missing original row -> rollback + 410 IDEMPOTENCY_RESULT_UNAVAILABLE.
  if (storedState === 'completed' || storedState === 'replayed') {
    await tx.query(
      `INSERT INTO social_audit_log
          (id, actor_id, target_kind, target_id, memory_id, action, outcome_code, request_key_hash, created_at)
       VALUES ($1, $2, $3, $4, NULL, $5, 'success', $6, NOW())`,
      [crypto.randomUUID(), ownerId, targetKind, treeId, 'tree.comment.create.replay', keyHash]
    );

    if (!storedResultId) {
      workSignal.outcome = { status: 410, body: { error: 'The original comment is no longer available', code: 'IDEMPOTENCY_RESULT_UNAVAILABLE' }, routeStatus: 'idempotency-result-unavailable' };
      const err = new NeonWsTransactionError(
        NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
        'IDEMPOTENCY_RESULT_UNAVAILABLE'
      );
      err.status = 410;
      throw err;
    }

    const commentRows = await tx.query(
      `SELECT id, tree_id, owner_id, body, created_at, updated_at
       FROM tree_comments
       WHERE id = $1
       LIMIT 1`,
      [storedResultId]
    );
    if (commentRows && commentRows.length > 0) {
      const replayDto = normalizeTreeCommentRow(commentRows[0]);
      workSignal.outcome = { status: 200, body: replayDto, routeStatus: 'comment-replay' };
      return replayDto;
    }

    workSignal.outcome = { status: 410, body: { error: 'The original comment is no longer available', code: 'IDEMPOTENCY_RESULT_UNAVAILABLE' }, routeStatus: 'idempotency-result-unavailable' };
    const err = new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
      'IDEMPOTENCY_RESULT_UNAVAILABLE'
    );
    err.status = 410;
    throw err;
  }

  // Pending/failed -> 500 SOCIAL_WRITE_UNAVAILABLE.
  if (storedState === 'pending' || storedState === 'failed') {
    workSignal.outcome = { status: 500, body: { error: 'Request is already being processed. Please retry with the same key.', code: 'SOCIAL_WRITE_UNAVAILABLE' }, routeStatus: 'social-write-unavailable' };
    const err = new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
      'SOCIAL_WRITE_UNAVAILABLE'
    );
    err.status = 500;
    throw err;
  }

  // Unknown state falls through to fresh reservation.
  return null;
}

// ─── Tree Comment create work ─────────────────────────────────────────────

async function runCommentWork(tx, workSignal, { treeId, ownerId, idempotencyKey, safeBody }) {
  const operation = COMMENT_OPERATION;
  const targetKind = TARGET_KIND;

  // 1. Tree explicit-public authorization FOR SHARE (BEFORE anything else).
  // Exact require_public_tree_cursor semantics: the SQL predicate scopes the
  // row lock to the explicitly-public row so a concurrent owner visibility
  // revocation conflicts; private/missing/NULL fails closed with zero mutation.
  // NOTE: the current Tree Comment writer has NO advisory lock; none is added.
  const authRows = await tx.query(
    `SELECT id, visibility
     FROM trees
     WHERE id = $1
       AND visibility = 'public'
     FOR SHARE`,
    [treeId]
  );
  if (!authRows || authRows.length === 0 || authRows[0].visibility !== 'public') {
    workSignal.outcome = { status: 404, body: { error: 'Tree not found' }, routeStatus: 'tree-not-found' };
    const err = new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
      'TREE_NOT_FOUND'
    );
    err.status = 404;
    throw err;
  }

  // 2. Idempotency fingerprint/key material (body-bearing canonical bytes).
  const fingerprint = await computeCommentFingerprintHash(safeBody);
  const keyHash = await computeKeyHash(idempotencyKey);

  // 3. Idempotency: SELECT-first replay detection.
  const existingRows = await tx.query(
    `SELECT target_kind, target_id, target_memory_id, result_id,
            result_state, request_fingerprint, result_payload
     FROM social_idempotency
     WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3
     LIMIT 1`,
    [ownerId, operation, idempotencyKey]
  );

  if (existingRows && existingRows.length > 0) {
    const existing = existingRows[0];
    const replayResult = await verifyIdempotencyRow(
      tx, existing, workSignal,
      { targetKind, treeId, fingerprint, ownerId, keyHash }
    );
    if (replayResult !== null) return replayResult;
    // Unknown state falls through to a fresh reservation below.
  }

  // 4. Fresh reservation with RETURNING + conflict re-verification.
  // The SELECT-first lookup may miss a concurrent same-(actor, operation, key)
  // reservation. The INSERT ... ON CONFLICT preserves the canonical existing
  // row (never overwrites target/fingerprint/state/payload) and RETURNING
  // exposes it so we re-verify exactly like the SELECT-first path.
  const resultId = crypto.randomUUID();
  const insertRows = await tx.query(
    `INSERT INTO social_idempotency
        (id, actor_id, operation, idempotency_key, request_fingerprint,
         target_kind, target_id, target_memory_id, result_id, result_state,
         result_payload, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NULL, NOW())
     ON CONFLICT (actor_id, operation, idempotency_key)
     DO UPDATE SET
       target_kind = social_idempotency.target_kind,
       target_id = social_idempotency.target_id,
       target_memory_id = social_idempotency.target_memory_id,
       request_fingerprint = social_idempotency.request_fingerprint,
       result_id = social_idempotency.result_id,
       result_state = social_idempotency.result_state,
       result_payload = social_idempotency.result_payload
     RETURNING
       target_kind, target_id, target_memory_id,
       result_id, result_state, request_fingerprint, result_payload`,
    [crypto.randomUUID(), ownerId, operation, idempotencyKey, fingerprint, targetKind, treeId, "", resultId]
  );

  if (insertRows && insertRows.length > 0) {
    const returnedRow = insertRows[0];
    const returnedResultId = returnedRow.result_id ? String(returnedRow.result_id) : null;
    const returnedState = String(returnedRow.result_state);

    // Fresh INSERT (our generated resultId + pending) -> mutation may proceed.
    const isFreshInsert = returnedResultId === resultId && returnedState === 'pending';
    if (!isFreshInsert) {
      // Conflict: INSERT hit an existing row. Re-verify with the shared helper
      // so different-target/different-fingerprint/replay/pending cases are
      // handled identically to the SELECT-first path. NEVER continue to the
      // comment INSERT after a conflicting different-target reservation.
      const replayResult = await verifyIdempotencyRow(
        tx, returnedRow, workSignal,
        { targetKind, treeId, fingerprint, ownerId, keyHash }
      );
      if (replayResult !== null) return replayResult;
      // Unknown state falls through (should not normally happen).
    }
  }

  // 5. Tree-comment actor rate limit: AFTER replay resolution, BEFORE insert.
  // Atomic upsert/increment with the existing conflict key and bounded
  // outcomes: allowed -> continue; exhausted -> 429 RATE_LIMITED;
  // infrastructure failure -> 503 RATE_LIMIT_UNAVAILABLE. A replay never
  // reaches this query, so replays consume no slot.
  let rateRows;
  try {
    rateRows = await tx.query(
      `INSERT INTO social_rate_limits
          (id, scope, actor_id, memory_id, window_start, request_count, created_at)
       VALUES ($1, $2, $3, $4, $5::timestamptz, 1, NOW())
       ON CONFLICT (scope, actor_id, COALESCE(memory_id, '00000000-0000-0000-0000-000000000000'), window_start)
       DO UPDATE SET
           request_count = social_rate_limits.request_count + 1
       WHERE social_rate_limits.request_count < $6
       RETURNING request_count`,
      [
        crypto.randomUUID(),
        TREE_COMMENT_ACTOR_RATE_SCOPE,
        ownerId,
        null,
        rateLimitWindowStartUtcMinute(),
        TREE_COMMENT_ACTOR_LIMIT
      ]
    );
  } catch {
    workSignal.outcome = { status: 503, body: { error: 'Comment write service is temporarily unavailable', code: 'RATE_LIMIT_UNAVAILABLE' }, routeStatus: 'rate-limit-unavailable' };
    const err = new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
      'RATE_LIMIT_UNAVAILABLE'
    );
    err.status = 503;
    throw err;
  }

  const rateAllowed = !!(rateRows && rateRows.length > 0)
    && Number(rateRows[0].request_count) <= TREE_COMMENT_ACTOR_LIMIT;
  if (!rateAllowed) {
    workSignal.outcome = {
      status: 429,
      body: { error: 'Too many comments. Please try again later.', code: 'RATE_LIMITED', retryAfterMs: RATE_LIMIT_RETRY_AFTER_MS },
      routeStatus: 'rate-limited',
      extraHeaders: { 'Retry-After': String(RATE_LIMIT_RETRY_AFTER_MS / 1000) }
    };
    const err = new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
      'RATE_LIMITED'
    );
    err.status = 429;
    throw err;
  }

  // 6. Comment INSERT ... RETURNING (canonical writer result authority).
  const commentRows = await tx.query(
    `INSERT INTO tree_comments
        (id, tree_id, owner_id, body, target_kind, target_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'tree', $5, NOW(), NOW())
     RETURNING id, tree_id, owner_id, body, created_at, updated_at`,
    [crypto.randomUUID(), treeId, ownerId, safeBody, treeId]
  );
  if (!commentRows || commentRows.length === 0) {
    workSignal.outcome = { status: 500, body: { error: 'Tree Comment create failed' }, routeStatus: 'no-comment-result' };
    const err = new NeonWsTransactionError(
      NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
      'COMMENT_INSERT_EMPTY'
    );
    err.status = 500;
    throw err;
  }
  const resultPayload = normalizeTreeCommentRow(commentRows[0]);

  // 7. Idempotency completion + audit BEFORE commit.
  await tx.query(
    `UPDATE social_idempotency
     SET result_id = $1, result_state = 'completed', result_payload = $2
     WHERE actor_id = $3 AND operation = $4 AND idempotency_key = $5`,
    [resultId, JSON.stringify(resultPayload), ownerId, operation, idempotencyKey]
  );
  await tx.query(
    `INSERT INTO social_audit_log
        (id, actor_id, target_kind, target_id, memory_id, action, outcome_code, request_key_hash, created_at)
     VALUES ($1, $2, $3, $4, NULL, $5, 'success', $6, NOW())`,
    [crypto.randomUUID(), ownerId, targetKind, treeId, 'tree.comment.create', keyHash]
  );

  workSignal.outcome = { status: 200, body: resultPayload, routeStatus: 'comment-complete' };
  return resultPayload;
}

// ─── Main handler ─────────────────────────────────────────────────────────

export async function handleTreeCommentDirectNeon(
  request,
  env = {},
  requestId = null,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null
  } = {}
) {
  if (!isTreeCommentDirectNeonRequest(request) || !isTreeCommentDirectNeonSelected(env)) {
    // Default/unknown gate -> existing Modal path unchanged. Return null so the
    // gateway continues to the Modal-owned write route.
    return null;
  }

  // Auth FIRST: verify the Firebase principal before any body-dependent work,
  // DB capability acquisition, or transaction start. transaction/client calls
  // = 0 and DB writes = 0 when auth is missing/malformed/invalid/expired.
  let verifyToken = verifyTokenOverride;
  if (typeof verifyToken !== 'function') {
    verifyToken = createFirebaseIdTokenVerifier({
      projectId: readFirebaseProjectId(env)
    });
  }

  let principal;
  try {
    principal = await resolveFirebaseReadPrincipal(request, verifyToken);
  } catch (error) {
    if (error instanceof FirebaseReadPrincipalError) {
      return buildFirebaseReadPrincipalErrorResponse(error, request);
    }
    return jsonResponse(
      { error: 'Authentication verifier unavailable' },
      503,
      requestId,
      'verifier-unavailable'
    );
  }

  const ownerId = principal.legacyOwnerId;

  // Path tree id validation (current Modal 400 parity).
  const treeIdResult = validateTreeId(extractTreeId(request));
  if (!treeIdResult.ok) {
    return jsonResponse(
      { error: treeIdResult.detail },
      treeIdResult.status,
      requestId,
      'invalid-tree-id'
    );
  }
  const treeId = treeIdResult.value;

  // Bounded body read + JSON/object contract (parse_json_body parity).
  let bodyResult;
  try {
    bodyResult = await readBoundedRequestBody(request);
  } catch {
    return jsonResponse(
      { error: 'Request body unavailable' },
      503,
      requestId,
      'body-unavailable'
    );
  }
  if (bodyResult.status === 'tooLarge') {
    return jsonResponse(
      { error: 'Request body too large' },
      413,
      requestId,
      'payload-too-large'
    );
  }
  if (bodyResult.status === 'readError') {
    return jsonResponse(
      { error: 'Request body unavailable' },
      503,
      requestId,
      'body-unavailable'
    );
  }

  let payload;
  // readBoundedRequestBody returns byte-exact Uint8Array bytes (or null).
  const rawBodyText = bodyResult.body ? new TextDecoder().decode(bodyResult.body) : '';
  if (!rawBodyText) {
    payload = {};
  } else {
    try {
      payload = JSON.parse(rawBodyText);
    } catch {
      return jsonResponse(
        { error: 'Invalid JSON body' },
        400,
        requestId,
        'invalid-json-body'
      );
    }
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return jsonResponse(
        { error: 'JSON object required', code: 'JSON_OBJECT_REQUIRED' },
        400,
        requestId,
        'json-object-required'
      );
    }
  }

  // Body contract: validate_optional_string(body, 5000) parity then required.
  const normalizedBody = normalizeCommentBody(payload ? payload.body : undefined);
  if (normalizedBody.oversized) {
    return jsonResponse(
      { error: `Field exceeds max ${COMMENT_BODY_MAX}` },
      400,
      requestId,
      'comment-body-oversize'
    );
  }
  const safeBody = normalizedBody.value;
  if (!safeBody) {
    return jsonResponse(
      { error: 'Comment body is required', code: 'SOCIAL_WRITE_UNAVAILABLE' },
      400,
      requestId,
      'comment-body-required'
    );
  }

  // Idempotency-Key validation parity (before DB contact).
  const idempotencyKeyResult = validateIdempotencyKey(request.headers.get('Idempotency-Key'));
  if (!idempotencyKeyResult.ok) {
    return jsonResponse(
      { error: idempotencyKeyResult.detail, code: idempotencyKeyResult.code },
      idempotencyKeyResult.status,
      requestId,
      idempotencyKeyResult.code === 'IDEMPOTENCY_KEY_REQUIRED' ? 'idempotency-key-required' : 'idempotency-key-invalid'
    );
  }
  const idempotencyKey = idempotencyKeyResult.value;

  // Dedicated writer DB authority. No generic/read-only fallback.
  const config = readTreeCommentWriteConfig(env);
  if (!config.configured) {
    return jsonResponse(
      { error: 'Tree Comment direct-Neon runtime not configured', code: 'DIRECT_NEON_CONFIG_ABSENT' },
      503,
      requestId,
      'config-absent'
    );
  }

  const forbidden = detectForbiddenWriterFallback(env);
  if (forbidden) {
    return jsonResponse(
      { error: 'Tree Comment direct-Neon writer config invalid', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' },
      503,
      requestId,
      'config-forbidden-fallback'
    );
  }

  // One request-scoped Neon WS interactive transaction adapter.
  let adapter = transactionAdapterOverride;
  if (!adapter) {
    try {
      adapter = await createNeonWsTransactionAdapter({
        connectionString: config.connectionString,
        ...(neonImporter ? { neonImporter } : {})
      });
    } catch (error) {
      return sanitizeAdapterErrorResponse(error, requestId, 'adapter-init');
    }
  }

  const workSignal = { outcome: undefined };

  let result;
  try {
    result = await adapter.runTransaction(async (tx) => {
      return await runCommentWork(tx, workSignal, { treeId, ownerId, idempotencyKey, safeBody });
    });
  } catch (error) {
    if (error instanceof NeonWsTransactionError) {
      const isUnknownCommit = error.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN;
      if (isUnknownCommit) {
        return jsonResponse(
          { error: 'Transaction commit outcome unknown', code: 'COMMIT_OUTCOME_UNKNOWN' },
          502,
          requestId,
          'commit-outcome-unknown'
        );
      }
      if (workSignal.outcome) {
        return jsonResponse(
          workSignal.outcome.body,
          workSignal.outcome.status,
          requestId,
          workSignal.outcome.routeStatus,
          workSignal.outcome.extraHeaders || null
        );
      }
    }
    return sanitizeAdapterErrorResponse(error, requestId, 'transaction-failed');
  }

  const dto = result && typeof result === 'object' ? result.value : null;
  if (
    !dto
    || typeof dto.id !== 'string'
    || typeof dto.treeId !== 'string'
    || typeof dto.ownerId !== 'string'
    || typeof dto.body !== 'string'
  ) {
    return jsonResponse(
      { error: 'Tree Comment create failed' },
      500,
      requestId,
      'no-comment-result'
    );
  }

  return jsonResponse(dto, 200, requestId, 'comment-complete');
}

function sanitizeAdapterErrorResponse(error, requestId, routeStatus) {
  const sanitized = sanitizeNeonWsTransactionError(error);
  const isUnknownCommit = sanitized.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN;
  if (isUnknownCommit) {
    return jsonResponse(
      { error: 'Transaction commit outcome unknown', code: 'COMMIT_OUTCOME_UNKNOWN' },
      502,
      requestId,
      'commit-outcome-unknown'
    );
  }
  const status = Number.isInteger(sanitized.status) ? sanitized.status : 500;
  return jsonResponse(
    { error: 'Tree Comment direct-Neon transaction failed', code: sanitized.code },
    status,
    requestId,
    routeStatus
  );
}

export const TREE_COMMENT_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'POST',
  path: '/api/trees/:id/comments',
  gateEnv: TREE_COMMENT_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: TREE_COMMENT_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: TREE_COMMENT_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: TREE_COMMENT_FORBIDDEN_FALLBACK_ENVS,
  ownerAuthority: 'verified-firebase-legacyOwnerId',
  lockOrder: 'TREE_FOR_SHARE_ONLY_NO_ADVISORY_LOCK',
  bodyBearingFingerprint: 'python_json_dumps_sort_keys_ensure_ascii_false_default_str',
  commentBodyMax: COMMENT_BODY_MAX,
  rateLimit: Object.freeze({
    scope: TREE_COMMENT_ACTOR_RATE_SCOPE,
    memoryId: null,
    limit: TREE_COMMENT_ACTOR_LIMIT,
    windowMinutes: RATE_LIMIT_WINDOW_MINUTES,
    consumedOnReplay: false
  }),
  writes: true,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false
});
