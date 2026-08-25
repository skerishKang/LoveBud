// #4223 Phase-4 Memory Comment create direct-Neon candidate.
// Default/unset/modal/unknown remains Modal-backed. Production activation is out of scope.

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

export const MEMORY_COMMENT_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_MEMORY_COMMENT_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

export const MEMORY_COMMENT_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:\-]{8,128}$/;
const OPERATION = 'comment.create';
const REPLAY_OPERATION = 'comment.create.replay';
const COMMENT_BODY_MAX = 5000;
const ACTOR_RATE_SCOPE = 'comment:actor';
const ACTOR_MEMORY_RATE_SCOPE = 'comment:actor-memory';
const ACTOR_RATE_LIMIT = 10;
const ACTOR_MEMORY_RATE_LIMIT = 3;
const RATE_LIMIT_RETRY_AFTER_MS = 60_000;

export function isMemoryCommentDirectNeonRequest(request) {
  if (!request || String(request.method || '').toUpperCase() !== 'POST') return false;
  return /^\/api\/memories\/[^/]+\/comments$/.test(
    new URL(request.url).pathname.replace(/\/+$/, '')
  );
}

export function isMemoryCommentDirectNeonSelected(env = {}) {
  const value = typeof env?.[MEMORY_COMMENT_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[MEMORY_COMMENT_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === MEMORY_COMMENT_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

export function readMemoryCommentWriteConfig(env = {}) {
  const dedicated = typeof env?.[MEMORY_COMMENT_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[MEMORY_COMMENT_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(dedicated);
  return Object.freeze({ dedicated, configured, connectionString: configured ? dedicated : '' });
}

export function detectForbiddenMemoryCommentWriterFallback(env = {}) {
  if (readMemoryCommentWriteConfig(env).configured) return null;
  for (const name of MEMORY_COMMENT_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonWsConnectionString(raw)) return Object.freeze({ name });
  }
  return null;
}

function jsonResponse(body, status, routeStatus = null, extraHeaders = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon'
  };
  if (routeStatus) headers['x-lovebud-route-status'] = routeStatus;
  if (extraHeaders) {
    for (const [name, value] of Object.entries(extraHeaders)) headers[name] = value;
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function normalizePythonUuid(rawValue, name) {
  const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!raw) return { ok: false, status: 400, detail: `${name} is required` };

  let hex = raw.toLowerCase();
  if (hex.startsWith('urn:uuid:')) hex = hex.slice('urn:uuid:'.length);
  if (hex.startsWith('{') && hex.endsWith('}')) hex = hex.slice(1, -1);
  hex = hex.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    return { ok: false, status: 400, detail: `Invalid ${name}` };
  }
  return {
    ok: true,
    value: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  };
}

function validateIdempotencyKey(rawKey) {
  const key = typeof rawKey === 'string' ? rawKey : '';
  if (!key) {
    return {
      ok: false,
      status: 400,
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      detail: 'Idempotency-Key header is required for this operation'
    };
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return {
      ok: false,
      status: 400,
      code: 'IDEMPOTENCY_KEY_INVALID',
      detail: 'Idempotency-Key must be 8-128 ASCII characters from [A-Za-z0-9._:-]'
    };
  }
  return { ok: true, value: key };
}

function parseCommentBody(bodyBytes) {
  const bytes = bodyBytes instanceof Uint8Array
    ? bodyBytes
    : bodyBytes == null
      ? new Uint8Array()
      : new Uint8Array(bodyBytes);
  if (bytes.byteLength === 0) return { ok: true, payload: {} };

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, status: 500, body: { error: 'Internal server error' } };
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, body: { error: 'Invalid JSON body' } };
  }
  if (payload === null || Array.isArray(payload) || typeof payload !== 'object') {
    return { ok: false, status: 400, body: { error: 'JSON object required', code: 'JSON_OBJECT_REQUIRED' } };
  }
  return { ok: true, payload };
}

function normalizeCommentBody(value) {
  if (value === null || value === undefined || typeof value !== 'string') {
    return { ok: true, value: '' };
  }
  const trimmed = value.trim();
  if ([...trimmed].length > COMMENT_BODY_MAX) {
    return { ok: false, status: 400, body: { detail: `Field exceeds max ${COMMENT_BODY_MAX}` } };
  }
  return { ok: true, value: trimmed };
}

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
    else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return `${out}"`;
}

export function buildPythonCanonicalMemoryCommentBodyPayload(safeBody) {
  return `{"body": ${pythonJsonEscapeString(safeBody)}}`;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function utcMinuteStart() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`
    + `T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:00+00:00`;
}

function normalizeTimestamp(value) {
  if (value === null || value === undefined) return null;
  let text = String(value);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(text)) {
    text = `${text.slice(0, 10)}T${text.slice(11)}`;
  }
  if (/[+-]\d{2}$/.test(text)) text += ':00';
  return text;
}

function normalizeCommentRow(row, requesterUid) {
  return {
    id: String(row.id),
    memoryId: String(row.memory_id),
    body: String(row.body),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    isOwn: String(row.owner_id) === String(requesterUid)
  };
}

function workFailure(workSignal, status, body, routeStatus, code, extraHeaders = null) {
  workSignal.outcome = { status, body, routeStatus, extraHeaders };
  return new NeonWsTransactionError(NEON_WS_TRANSACTION_ERROR.WORK_FAILURE, code, { status });
}

async function audit(tx, ownerId, memoryId, action, keyHash) {
  await tx.query(
    `INSERT INTO social_audit_log
        (id, actor_id, memory_id, action, outcome_code, request_key_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [crypto.randomUUID(), ownerId, memoryId, action, 'success', keyHash]
  );
}

async function verifyLegacyIdempotencyRow(
  tx,
  workSignal,
  row,
  { ownerId, memoryId, fingerprint, keyHash }
) {
  if (String(row.target_memory_id || '') !== memoryId) {
    throw workFailure(
      workSignal,
      409,
      { error: 'Idempotency key was used for a different target memory', code: 'IDEMPOTENCY_KEY_REUSED' },
      'idempotency-key-reused',
      'IDEMPOTENCY_KEY_REUSED'
    );
  }
  if (String(row.request_fingerprint || '') !== fingerprint) {
    throw workFailure(
      workSignal,
      409,
      { error: 'Idempotency key was used with a different request payload', code: 'IDEMPOTENCY_KEY_REUSED' },
      'idempotency-key-reused',
      'IDEMPOTENCY_KEY_REUSED'
    );
  }

  const state = String(row.result_state || '');
  if (state === 'completed' || state === 'replayed') {
    await audit(tx, ownerId, memoryId, REPLAY_OPERATION, keyHash);
    const resultId = row.result_id ? String(row.result_id) : '';
    if (!resultId) {
      throw workFailure(
        workSignal,
        410,
        { error: 'The original comment is no longer available', code: 'IDEMPOTENCY_RESULT_UNAVAILABLE' },
        'idempotency-result-unavailable',
        'IDEMPOTENCY_RESULT_UNAVAILABLE'
      );
    }

    const commentRows = await tx.query(
      `SELECT id, memory_id, owner_id, body,
              created_at::text AS created_at,
              updated_at::text AS updated_at,
              status, deleted_at
       FROM comments
       WHERE id = $1 AND memory_id = $2
       LIMIT 1`,
      [resultId, memoryId]
    );
    const comment = commentRows?.[0];
    if (!comment || String(comment.status || 'visible') !== 'visible' || comment.deleted_at != null) {
      throw workFailure(
        workSignal,
        410,
        { error: 'The original comment is no longer available', code: 'IDEMPOTENCY_RESULT_UNAVAILABLE' },
        'idempotency-result-unavailable',
        'IDEMPOTENCY_RESULT_UNAVAILABLE'
      );
    }
    return normalizeCommentRow(comment, ownerId);
  }

  if (state === 'pending' || state === 'failed') {
    throw workFailure(
      workSignal,
      500,
      { error: 'Request is already being processed. Please retry with the same key.', code: 'SOCIAL_WRITE_UNAVAILABLE' },
      'social-write-unavailable',
      'SOCIAL_WRITE_UNAVAILABLE'
    );
  }

  return null;
}

async function reserveLegacyIdempotency(
  tx,
  workSignal,
  { ownerId, memoryId, key, safeBody }
) {
  const fingerprint = await sha256Hex(buildPythonCanonicalMemoryCommentBodyPayload(safeBody));
  const keyHash = await sha256Hex(key);
  const reservationId = crypto.randomUUID();
  const rows = await tx.query(
    `INSERT INTO social_idempotency
        (id, actor_id, operation, idempotency_key, request_fingerprint,
         target_memory_id, result_id, result_state, result_payload, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NULL, NOW())
     ON CONFLICT (actor_id, operation, idempotency_key)
     DO UPDATE SET
         target_memory_id = social_idempotency.target_memory_id,
         result_id = social_idempotency.result_id,
         result_state = social_idempotency.result_state,
         result_payload = social_idempotency.result_payload,
         request_fingerprint = social_idempotency.request_fingerprint
     WHERE social_idempotency.idempotency_key = $4
       AND social_idempotency.actor_id = $2
       AND social_idempotency.operation = $3
     RETURNING id, target_memory_id, result_id, result_state,
               request_fingerprint, result_payload, created_at`,
    [reservationId, ownerId, OPERATION, key, fingerprint, memoryId, reservationId]
  );
  const row = rows?.[0];
  if (!row || (String(row.result_id || '') === reservationId && String(row.result_state || '') === 'pending')) {
    return { replay: null, keyHash };
  }

  const replay = await verifyLegacyIdempotencyRow(
    tx,
    workSignal,
    row,
    { ownerId, memoryId, fingerprint, keyHash }
  );
  return { replay, keyHash };
}

async function consumeRateLimit(tx, workSignal, { ownerId, memoryId, scope, limit, exhaustedCode }) {
  let rows;
  try {
    rows = await tx.query(
      `INSERT INTO social_rate_limits
          (id, scope, actor_id, memory_id, window_start, request_count, created_at)
       VALUES ($1, $2, $3, $4, $5::timestamptz, 1, NOW())
       ON CONFLICT (scope, actor_id, COALESCE(memory_id, '00000000-0000-0000-0000-000000000000'), window_start)
       DO UPDATE SET
           request_count = social_rate_limits.request_count + 1
       WHERE social_rate_limits.request_count < $6
       RETURNING request_count`,
      [crypto.randomUUID(), scope, ownerId, memoryId, utcMinuteStart(), limit]
    );
  } catch {
    throw workFailure(
      workSignal,
      503,
      { error: 'Comment write service is temporarily unavailable', code: 'RATE_LIMIT_UNAVAILABLE' },
      'rate-limit-unavailable',
      'RATE_LIMIT_UNAVAILABLE'
    );
  }

  const allowed = !!(rows && rows.length > 0) && Number(rows[0].request_count) <= limit;
  if (!allowed) {
    const message = exhaustedCode === 'RATE_LIMITED_MEMORY'
      ? 'Too many comments on this memory. Please try again later.'
      : 'Too many comments. Please try again later.';
    throw workFailure(
      workSignal,
      429,
      { error: message, code: exhaustedCode, retryAfterMs: RATE_LIMIT_RETRY_AFTER_MS },
      exhaustedCode === 'RATE_LIMITED_MEMORY' ? 'rate-limited-memory' : 'rate-limited',
      exhaustedCode,
      { 'Retry-After': '60' }
    );
  }
}

async function runCommentWork(tx, workSignal, { ownerId, memoryId, key, safeBody }) {
  // Current Memory social writer authority: transaction-local visibility/owner
  // authorization first. There is NO advisory lock in create_comment().
  const authRows = await tx.query(
    `SELECT m.id, m.tree_id, m.visibility AS mem_visibility,
            t.owner_id AS tree_owner_id, t.visibility AS tree_visibility
     FROM memories m
     INNER JOIN trees t ON t.id = m.tree_id
     WHERE m.id = $1
     LIMIT 1
     FOR SHARE OF m, t`,
    [memoryId]
  );
  const target = authRows?.[0];
  if (!target) {
    throw workFailure(workSignal, 404, { detail: 'Memory not found' }, 'memory-not-found', 'MEMORY_NOT_FOUND');
  }
  const isOwner = String(target.tree_owner_id || '') === ownerId;
  const isPublic = target.mem_visibility === 'public' && target.tree_visibility === 'public';
  if (!isOwner && !isPublic) {
    throw workFailure(workSignal, 404, { detail: 'Memory not found' }, 'memory-not-found', 'MEMORY_NOT_FOUND');
  }

  // Legacy Memory social idempotency authority. Replay resolves before rate limiting.
  const reservation = await reserveLegacyIdempotency(
    tx,
    workSignal,
    { ownerId, memoryId, key, safeBody }
  );
  if (reservation.replay) {
    workSignal.outcome = { status: 200, body: reservation.replay, routeStatus: 'comment-replay' };
    return reservation.replay;
  }

  await consumeRateLimit(tx, workSignal, {
    ownerId,
    memoryId: null,
    scope: ACTOR_RATE_SCOPE,
    limit: ACTOR_RATE_LIMIT,
    exhaustedCode: 'RATE_LIMITED'
  });
  await consumeRateLimit(tx, workSignal, {
    ownerId,
    memoryId,
    scope: ACTOR_MEMORY_RATE_SCOPE,
    limit: ACTOR_MEMORY_RATE_LIMIT,
    exhaustedCode: 'RATE_LIMITED_MEMORY'
  });

  const commentId = crypto.randomUUID();
  const commentRows = await tx.query(
    `INSERT INTO comments
        (id, memory_id, owner_id, body, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'visible', NOW(), NOW())
     RETURNING id, memory_id, owner_id, body,
               created_at::text AS created_at,
               updated_at::text AS updated_at`,
    [commentId, memoryId, ownerId, safeBody]
  );
  const row = commentRows?.[0];
  if (!row) {
    throw workFailure(workSignal, 500, { error: 'Comment create failed' }, 'no-comment-result', 'COMMENT_INSERT_EMPTY');
  }
  const payload = normalizeCommentRow(row, ownerId);

  // Current Python comment writer completes legacy idempotency without result_payload.
  await tx.query(
    `UPDATE social_idempotency
     SET result_id = $1, result_state = $2
     WHERE actor_id = $3 AND operation = $4 AND idempotency_key = $5`,
    [commentId, 'completed', ownerId, OPERATION, key]
  );
  await audit(tx, ownerId, memoryId, OPERATION, reservation.keyHash);

  workSignal.outcome = { status: 200, body: payload, routeStatus: 'comment-complete' };
  return payload;
}

function sanitizedAdapterResponse(error, routeStatus) {
  const sanitized = sanitizeNeonWsTransactionError(error);
  if (sanitized.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN) {
    return jsonResponse(
      { error: 'Transaction commit outcome unknown', code: 'COMMIT_OUTCOME_UNKNOWN' },
      502,
      'commit-outcome-unknown'
    );
  }
  return jsonResponse(
    { error: 'Memory Comment direct-Neon transaction failed', code: sanitized.code },
    Number.isInteger(sanitized.status) ? sanitized.status : 500,
    routeStatus
  );
}

export async function handleMemoryCommentDirectNeon(request, env = {}, options = {}) {
  if (!isMemoryCommentDirectNeonRequest(request) || !isMemoryCommentDirectNeonSelected(env)) return null;

  // Full Firebase verification occurs before DB capability acquisition.
  let verifyToken = options.verifyTokenOverride;
  if (typeof verifyToken !== 'function') {
    try {
      verifyToken = createFirebaseIdTokenVerifier({ projectId: readFirebaseProjectId(env) });
    } catch {
      return jsonResponse({ error: 'Authentication verifier unavailable' }, 503, 'verifier-unavailable');
    }
  }

  let principal;
  try {
    principal = await resolveFirebaseReadPrincipal(request, verifyToken);
  } catch (error) {
    if (error instanceof FirebaseReadPrincipalError) {
      return buildFirebaseReadPrincipalErrorResponse(error, request);
    }
    return jsonResponse({ error: 'Authentication verifier unavailable' }, 503, 'verifier-unavailable');
  }
  const ownerId = principal.legacyOwnerId;

  const memoryResult = normalizePythonUuid(options.memoryIdOverride, 'memoryId');
  if (!memoryResult.ok) {
    return jsonResponse({ detail: memoryResult.detail }, memoryResult.status, 'invalid-memory-id');
  }
  const memoryId = memoryResult.value;

  const parsed = parseCommentBody(options.bodyBytesOverride);
  if (!parsed.ok) return jsonResponse(parsed.body, parsed.status, 'invalid-comment-body');

  const bodyResult = normalizeCommentBody(parsed.payload.body);
  if (!bodyResult.ok) return jsonResponse(bodyResult.body, bodyResult.status, 'comment-body-oversize');
  const safeBody = bodyResult.value;
  if (!safeBody) {
    return jsonResponse(
      { error: 'Comment body is required', code: 'SOCIAL_WRITE_UNAVAILABLE' },
      400,
      'comment-body-required'
    );
  }

  const keyResult = validateIdempotencyKey(
    options.idempotencyKeyOverride ?? request.headers.get('Idempotency-Key')
  );
  if (!keyResult.ok) {
    return jsonResponse(
      { error: keyResult.detail, code: keyResult.code },
      keyResult.status,
      keyResult.code === 'IDEMPOTENCY_KEY_REQUIRED'
        ? 'idempotency-key-required'
        : 'idempotency-key-invalid'
    );
  }
  const key = keyResult.value;

  const config = readMemoryCommentWriteConfig(env);
  if (!config.configured) {
    const forbidden = detectForbiddenMemoryCommentWriterFallback(env);
    if (forbidden) {
      return jsonResponse(
        { error: 'Memory Comment direct-Neon writer config invalid', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' },
        503,
        'config-forbidden-fallback'
      );
    }
    return jsonResponse(
      { error: 'Memory Comment direct-Neon runtime not configured', code: 'DIRECT_NEON_CONFIG_ABSENT' },
      503,
      'config-absent'
    );
  }

  let adapter = options.transactionAdapterOverride;
  if (!adapter) {
    try {
      adapter = await createNeonWsTransactionAdapter({
        connectionString: config.connectionString,
        ...(options.neonImporter ? { neonImporter: options.neonImporter } : {})
      });
    } catch (error) {
      return sanitizedAdapterResponse(error, 'adapter-init');
    }
  }

  const workSignal = { outcome: undefined };
  let result;
  try {
    result = await adapter.runTransaction((tx) => runCommentWork(
      tx,
      workSignal,
      { ownerId, memoryId, key, safeBody }
    ));
  } catch (error) {
    if (error instanceof NeonWsTransactionError) {
      if (error.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN) {
        return jsonResponse(
          { error: 'Transaction commit outcome unknown', code: 'COMMIT_OUTCOME_UNKNOWN' },
          502,
          'commit-outcome-unknown'
        );
      }
      if (workSignal.outcome) {
        return jsonResponse(
          workSignal.outcome.body,
          workSignal.outcome.status,
          workSignal.outcome.routeStatus,
          workSignal.outcome.extraHeaders
        );
      }
    }
    return sanitizedAdapterResponse(error, 'transaction-failed');
  }

  const payload = result && typeof result === 'object' && result.value ? result.value : null;
  if (
    !payload
    || typeof payload.id !== 'string'
    || typeof payload.memoryId !== 'string'
    || typeof payload.body !== 'string'
    || typeof payload.isOwn !== 'boolean'
    || Object.hasOwn(payload, 'ownerId')
  ) {
    return jsonResponse({ error: 'Comment create failed' }, 500, 'no-comment-result');
  }

  return jsonResponse(payload, 200, workSignal.outcome?.routeStatus || 'comment-complete');
}

export const MEMORY_COMMENT_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'POST',
  path: '/api/memories/:id/comments',
  gateEnv: MEMORY_COMMENT_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: MEMORY_COMMENT_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: MEMORY_COMMENT_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: MEMORY_COMMENT_FORBIDDEN_FALLBACK_ENVS,
  ownerAuthority: 'verified-firebase-uid',
  lockOrder: 'MEMORY_TREE_FOR_SHARE_ONLY_NO_ADVISORY_LOCK',
  idempotencyOperation: OPERATION,
  idempotencyTarget: 'target_memory_id',
  bodyBearingFingerprint: 'python_json_dumps_sort_keys_ensure_ascii_false_default_str',
  rateLimits: Object.freeze([
    Object.freeze({ scope: ACTOR_RATE_SCOPE, memoryId: null, limit: ACTOR_RATE_LIMIT, windowMinutes: 1 }),
    Object.freeze({ scope: ACTOR_MEMORY_RATE_SCOPE, memoryId: 'target-memory-id', limit: ACTOR_MEMORY_RATE_LIMIT, windowMinutes: 1 })
  ]),
  replayConsumesRateLimit: false,
  writes: true,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false
});