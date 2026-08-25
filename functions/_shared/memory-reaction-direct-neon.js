// #4221 Phase-4 Memory reaction toggle Cloudflare -> Neon WebSocket
// interactive transaction candidate.
//
// Migration candidate only. The Product route remains Modal-backed unless:
//   LB_MEMORY_REACTION_WRITE_RUNTIME=direct_neon
//
// The candidate reuses the merged #4132 Neon WS transaction adapter and keeps
// Firebase as the Product identity authority. No Production gate, provider,
// schema, role, secret, or privilege mutation is performed here.

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

export const MEMORY_REACTION_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_MEMORY_REACTION_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

export const MEMORY_REACTION_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:\-]{8,128}$/;
const OPERATION = 'reaction.toggle';
const REPLAY_OPERATION = 'reaction.toggle.replay';
const ALLOWED_REACTION_TYPE = 'like';

export function isMemoryReactionDirectNeonRequest(request) {
  if (!request || String(request.method || '').toUpperCase() !== 'POST') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return /^\/api\/memories\/[^/]+\/reactions$/.test(path);
}

export function isMemoryReactionDirectNeonSelected(env = {}) {
  const value = typeof env?.[MEMORY_REACTION_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[MEMORY_REACTION_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === MEMORY_REACTION_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

export function readMemoryReactionWriteConfig(env = {}) {
  const dedicated = typeof env?.[MEMORY_REACTION_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[MEMORY_REACTION_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(dedicated);
  return Object.freeze({
    dedicated,
    configured,
    connectionString: configured ? dedicated : ''
  });
}

export function detectForbiddenMemoryReactionWriterFallback(env = {}) {
  if (readMemoryReactionWriteConfig(env).configured) return null;
  for (const name of MEMORY_REACTION_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonWsConnectionString(raw)) {
      return Object.freeze({ name, connectionString: raw });
    }
  }
  return null;
}

function responseHeaders(routeStatus = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon'
  };
  if (routeStatus) headers['x-lovebud-route-status'] = routeStatus;
  return headers;
}

function jsonResponse(body, status, routeStatus = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(routeStatus)
  });
}

function validateMemoryId(rawMemoryId) {
  const memoryId = String(rawMemoryId || '').trim();
  if (!memoryId) {
    return { ok: false, status: 400, detail: 'memoryId is required' };
  }
  if (!UUID_PATTERN.test(memoryId)) {
    return { ok: false, status: 400, detail: 'Invalid memoryId' };
  }
  return { ok: true, value: memoryId.toLowerCase() };
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

function parseReactionBody(bodyBytes) {
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
    return { ok: false, status: 400, body: { detail: 'Invalid JSON body' } };
  }

  if (payload === null || Array.isArray(payload) || typeof payload !== 'object') {
    return {
      ok: false,
      status: 400,
      body: { detail: { code: 'JSON_OBJECT_REQUIRED' } }
    };
  }
  return { ok: true, payload };
}

function normalizeReactionType(rawType) {
  if (typeof rawType !== 'string') {
    return {
      ok: false,
      status: 400,
      code: 'REACTION_TYPE_INVALID',
      detail: 'Reaction type is required'
    };
  }
  const value = rawType.trim().toLowerCase();
  if (!value) {
    return {
      ok: false,
      status: 400,
      code: 'REACTION_TYPE_INVALID',
      detail: 'Reaction type is required'
    };
  }
  if (value !== ALLOWED_REACTION_TYPE) {
    return {
      ok: false,
      status: 400,
      code: 'REACTION_TYPE_INVALID',
      detail: 'Reaction type must be one of: like'
    };
  }
  return { ok: true, value };
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function advisoryLockKey(ownerId, memoryId, reactionType) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${ownerId}:${memoryId}:${reactionType}`)
  );
  const bytes = new Uint8Array(digest).slice(0, 8);
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  if (value & (1n << 63n)) value -= 1n << 64n;
  return value.toString();
}

async function reactionFingerprint(reactionType) {
  // Python parity: json.dumps({"type": "like"}, sort_keys=True, ensure_ascii=False)
  // serializes with a space after ':'; plain JSON.stringify would drift.
  return sha256Hex(`{"type": "${reactionType}"}`);
}

function workFailure(workSignal, status, body, routeStatus, code) {
  workSignal.outcome = { status, body, routeStatus };
  return new NeonWsTransactionError(
    NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
    code,
    { status }
  );
}

async function readReactionCounts(tx, memoryId) {
  const rows = await tx.query(
    `SELECT type, COUNT(*)::int AS count
     FROM reactions
     WHERE memory_id = $1
     GROUP BY type
     ORDER BY type`,
    [memoryId]
  );
  const counts = {};
  for (const row of rows || []) {
    counts[String(row.type)] = Number(row.count || 0);
  }
  return counts;
}

async function recordReactionAudit(tx, ownerId, memoryId, action, keyHash) {
  await tx.query(
    `INSERT INTO social_audit_log
        (id, actor_id, memory_id, action, outcome_code, request_key_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [crypto.randomUUID(), ownerId, memoryId, action, 'success', keyHash]
  );
}

function parseStoredPayload(raw) {
  if (raw === null || raw === undefined) return null;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function reserveReactionIdempotency(
  tx,
  workSignal,
  { ownerId, memoryId, reactionType, idempotencyKey }
) {
  const fingerprint = await reactionFingerprint(reactionType);
  const keyHash = await sha256Hex(idempotencyKey);
  const resultId = crypto.randomUUID();

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
     RETURNING
         id, target_memory_id, result_id, result_state,
         request_fingerprint, result_payload, created_at`,
    [resultId, ownerId, OPERATION, idempotencyKey, fingerprint, memoryId, resultId]
  );

  const row = rows && rows.length > 0 ? rows[0] : null;
  if (!row) return { replay: null, keyHash, resultId };

  const storedResultId = row.result_id ? String(row.result_id) : null;
  const storedState = String(row.result_state || '');
  if (storedResultId === resultId && storedState === 'pending') {
    return { replay: null, keyHash, resultId };
  }

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

  if (storedState === 'completed' || storedState === 'replayed') {
    await recordReactionAudit(tx, ownerId, memoryId, REPLAY_OPERATION, keyHash);
    const storedPayload = parseStoredPayload(row.result_payload);
    if (storedPayload) {
      return { replay: storedPayload, keyHash, resultId: storedResultId || resultId };
    }
    const counts = await readReactionCounts(tx, memoryId);
    return {
      replay: {
        type: reactionType,
        active: false,
        counts,
        total: Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0)
      },
      keyHash,
      resultId: storedResultId || resultId
    };
  }

  if (storedState === 'pending' || storedState === 'failed') {
    throw workFailure(
      workSignal,
      500,
      {
        error: 'Request is already being processed. Please retry with the same key.',
        code: 'SOCIAL_WRITE_UNAVAILABLE'
      },
      'social-write-unavailable',
      'SOCIAL_WRITE_UNAVAILABLE'
    );
  }

  return { replay: null, keyHash, resultId };
}

async function runReactionWork(
  tx,
  workSignal,
  { ownerId, memoryId, reactionType, idempotencyKey }
) {
  // Canonical Moment-social order is intentionally different from Tree Like:
  // advisory lock FIRST, then transaction-local Memory+Tree FOR SHARE auth.
  const lockKey = await advisoryLockKey(ownerId, memoryId, reactionType);
  await tx.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

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
  const authRow = authRows && authRows.length > 0 ? authRows[0] : null;
  if (!authRow) {
    throw workFailure(
      workSignal,
      404,
      { detail: 'Memory not found' },
      'memory-not-found',
      'MEMORY_NOT_FOUND'
    );
  }

  const isOwner = String(authRow.tree_owner_id || '') === ownerId;
  const isPublic = authRow.mem_visibility === 'public' && authRow.tree_visibility === 'public';
  if (!isOwner && !isPublic) {
    throw workFailure(
      workSignal,
      404,
      { detail: 'Memory not found' },
      'memory-not-found',
      'MEMORY_NOT_FOUND'
    );
  }

  const reservation = await reserveReactionIdempotency(tx, workSignal, {
    ownerId,
    memoryId,
    reactionType,
    idempotencyKey
  });
  if (reservation.replay) {
    workSignal.outcome = { status: 200, body: reservation.replay, routeStatus: 'reaction-replay' };
    return reservation.replay;
  }

  const existingRows = await tx.query(
    `SELECT id FROM reactions
     WHERE memory_id = $1 AND owner_id = $2 AND type = $3
     LIMIT 1`,
    [memoryId, ownerId, reactionType]
  );
  const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

  let active;
  let mutationResultId;
  if (existing) {
    await tx.query(
      `DELETE FROM reactions
       WHERE memory_id = $1 AND owner_id = $2 AND type = $3`,
      [memoryId, ownerId, reactionType]
    );
    active = false;
    mutationResultId = String(existing.id);
  } else {
    mutationResultId = crypto.randomUUID();
    await tx.query(
      `INSERT INTO reactions (id, memory_id, owner_id, type, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [mutationResultId, memoryId, ownerId, reactionType]
    );
    active = true;
  }

  const counts = await readReactionCounts(tx, memoryId);
  const total = Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);
  const payload = { type: reactionType, active, counts, total };

  await tx.query(
    `UPDATE social_idempotency
     SET result_id = $1, result_state = $2, result_payload = $3
     WHERE actor_id = $4 AND operation = $5 AND idempotency_key = $6`,
    [mutationResultId, 'completed', JSON.stringify(payload), ownerId, OPERATION, idempotencyKey]
  );

  await recordReactionAudit(tx, ownerId, memoryId, OPERATION, reservation.keyHash);
  workSignal.outcome = { status: 200, body: payload, routeStatus: 'reaction-complete' };
  return payload;
}

function sanitizeAdapterErrorResponse(error, routeStatus) {
  const sanitized = sanitizeNeonWsTransactionError(error);
  if (sanitized.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN) {
    return jsonResponse(
      { error: 'Transaction commit outcome unknown', code: 'COMMIT_OUTCOME_UNKNOWN' },
      502,
      'commit-outcome-unknown'
    );
  }
  const status = Number.isInteger(sanitized.status) ? sanitized.status : 500;
  return jsonResponse(
    { error: 'Memory reaction direct-Neon transaction failed', code: sanitized.code },
    status,
    routeStatus
  );
}

export async function handleMemoryReactionDirectNeon(
  request,
  env = {},
  {
    memoryIdOverride = null,
    idempotencyKeyOverride = null,
    bodyBytesOverride = null,
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null
  } = {}
) {
  if (!isMemoryReactionDirectNeonRequest(request) || !isMemoryReactionDirectNeonSelected(env)) {
    return null;
  }

  // Full Firebase verification before any DB capability/client is acquired.
  let verifyToken = verifyTokenOverride;
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

  const parsedBody = parseReactionBody(bodyBytesOverride);
  if (!parsedBody.ok) {
    return jsonResponse(parsedBody.body, parsedBody.status, 'invalid-json-body');
  }

  const memoryResult = validateMemoryId(memoryIdOverride);
  if (!memoryResult.ok) {
    return jsonResponse({ detail: memoryResult.detail }, memoryResult.status, 'invalid-memory-id');
  }
  const memoryId = memoryResult.value;

  const reactionResult = normalizeReactionType(parsedBody.payload.type);
  if (!reactionResult.ok) {
    return jsonResponse(
      { error: reactionResult.detail, code: reactionResult.code },
      reactionResult.status,
      'reaction-type-invalid'
    );
  }
  const reactionType = reactionResult.value;

  const idempotencyResult = validateIdempotencyKey(
    idempotencyKeyOverride ?? request.headers.get('Idempotency-Key')
  );
  if (!idempotencyResult.ok) {
    return jsonResponse(
      { error: idempotencyResult.detail, code: idempotencyResult.code },
      idempotencyResult.status,
      idempotencyResult.code === 'IDEMPOTENCY_KEY_REQUIRED'
        ? 'idempotency-key-required'
        : 'idempotency-key-invalid'
    );
  }
  const idempotencyKey = idempotencyResult.value;

  const config = readMemoryReactionWriteConfig(env);
  if (!config.configured) {
    const forbidden = detectForbiddenMemoryReactionWriterFallback(env);
    if (forbidden) {
      return jsonResponse(
        { error: 'Memory reaction direct-Neon writer config invalid', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' },
        503,
        'config-forbidden-fallback'
      );
    }
    return jsonResponse(
      { error: 'Memory reaction direct-Neon runtime not configured', code: 'DIRECT_NEON_CONFIG_ABSENT' },
      503,
      'config-absent'
    );
  }

  let adapter = transactionAdapterOverride;
  if (!adapter) {
    try {
      adapter = await createNeonWsTransactionAdapter({
        connectionString: config.connectionString,
        ...(neonImporter ? { neonImporter } : {})
      });
    } catch (error) {
      return sanitizeAdapterErrorResponse(error, 'adapter-init');
    }
  }

  const workSignal = { outcome: undefined };
  let result;
  try {
    result = await adapter.runTransaction(async (tx) => {
      return runReactionWork(tx, workSignal, {
        ownerId,
        memoryId,
        reactionType,
        idempotencyKey
      });
    });
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
          workSignal.outcome.routeStatus
        );
      }
    }
    return sanitizeAdapterErrorResponse(error, 'transaction-failed');
  }

  const payload = result && typeof result === 'object' && result.value ? result.value : null;
  if (
    !payload ||
    payload.type !== reactionType ||
    typeof payload.active !== 'boolean' ||
    !payload.counts ||
    typeof payload.counts !== 'object' ||
    !Number.isFinite(payload.total)
  ) {
    return jsonResponse({ error: 'Reaction toggle failed' }, 500, 'no-reaction-result');
  }

  return jsonResponse(payload, 200, workSignal.outcome?.routeStatus || 'reaction-complete');
}

export const MEMORY_REACTION_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'POST',
  path: '/api/memories/:id/reactions',
  gateEnv: MEMORY_REACTION_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: MEMORY_REACTION_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: MEMORY_REACTION_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: MEMORY_REACTION_FORBIDDEN_FALLBACK_ENVS,
  ownerAuthority: 'verified-firebase-uid',
  lockOrder: 'ADVISORY_XACT_LOCK_THEN_MEMORY_TREE_FOR_SHARE',
  idempotencyOperation: OPERATION,
  writes: true,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false
});
