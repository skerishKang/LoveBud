// #4221 Phase-4 Memory reaction toggle direct-Neon candidate.
// Default/unset/modal/unknown stays Modal. Production activation is out of scope.

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

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:\-]{8,128}$/;
const OPERATION = 'reaction.toggle';
const REPLAY_OPERATION = 'reaction.toggle.replay';

export function isMemoryReactionDirectNeonRequest(request) {
  if (!request || String(request.method || '').toUpperCase() !== 'POST') return false;
  return /^\/api\/memories\/[^/]+\/reactions$/.test(
    new URL(request.url).pathname.replace(/\/+$/, '')
  );
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
  return Object.freeze({ dedicated, configured, connectionString: configured ? dedicated : '' });
}

export function detectForbiddenMemoryReactionWriterFallback(env = {}) {
  if (readMemoryReactionWriteConfig(env).configured) return null;
  for (const name of MEMORY_REACTION_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonWsConnectionString(raw)) return Object.freeze({ name });
  }
  return null;
}

function jsonResponse(body, status, routeStatus = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon'
  };
  if (routeStatus) headers['x-lovebud-route-status'] = routeStatus;
  return new Response(JSON.stringify(body), { status, headers });
}

function normalizePythonUuid(rawValue, name) {
  const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!raw) return { ok: false, status: 400, detail: `${name} is required` };

  // CPython uuid.UUID(string) removes urn:uuid:, surrounding braces and all
  // hyphens before validating 32 hexadecimal digits, then emits canonical form.
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
    return { ok: false, status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED', detail: 'Idempotency-Key header is required for this operation' };
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return { ok: false, status: 400, code: 'IDEMPOTENCY_KEY_INVALID', detail: 'Idempotency-Key must be 8-128 ASCII characters from [A-Za-z0-9._:-]' };
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
    return { ok: false, status: 400, body: { detail: { code: 'JSON_OBJECT_REQUIRED' } } };
  }
  return { ok: true, payload };
}

function normalizeReactionType(rawType) {
  if (typeof rawType !== 'string' || !rawType.trim()) {
    return { ok: false, status: 400, code: 'REACTION_TYPE_INVALID', detail: 'Reaction type is required' };
  }
  const value = rawType.trim().toLowerCase();
  if (value !== 'like') {
    return { ok: false, status: 400, code: 'REACTION_TYPE_INVALID', detail: 'Reaction type must be one of: like' };
  }
  return { ok: true, value };
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildAdvisoryLockKey(ownerId, memoryId, reactionType) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${ownerId}:${memoryId}:${reactionType}`)
  );
  const first8 = new Uint8Array(digest).slice(0, 8);
  let value = 0n;
  for (const byte of first8) value = (value << 8n) | BigInt(byte);
  if (value & (1n << 63n)) value -= 1n << 64n;
  return value.toString();
}

async function reactionFingerprint(type) {
  // Exact Python json.dumps spacing for {"type": "like"}.
  return sha256Hex(`{"type": "${type}"}`);
}

function workFailure(workSignal, status, body, routeStatus, code) {
  workSignal.outcome = { status, body, routeStatus };
  return new NeonWsTransactionError(NEON_WS_TRANSACTION_ERROR.WORK_FAILURE, code, { status });
}

async function readCounts(tx, memoryId) {
  const rows = await tx.query(
    `SELECT type, COUNT(*)::int AS count
     FROM reactions
     WHERE memory_id = $1
     GROUP BY type
     ORDER BY type`,
    [memoryId]
  );
  const counts = {};
  for (const row of rows || []) counts[String(row.type)] = Number(row.count || 0);
  return counts;
}

async function audit(tx, ownerId, memoryId, action, keyHash) {
  await tx.query(
    `INSERT INTO social_audit_log
        (id, actor_id, memory_id, action, outcome_code, request_key_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [crypto.randomUUID(), ownerId, memoryId, action, 'success', keyHash]
  );
}

function parseStoredPayload(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function reserveIdempotency(tx, workSignal, { ownerId, memoryId, type, key }) {
  const fingerprint = await reactionFingerprint(type);
  const keyHash = await sha256Hex(key);
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
     RETURNING id, target_memory_id, result_id, result_state,
               request_fingerprint, result_payload, created_at`,
    [resultId, ownerId, OPERATION, key, fingerprint, memoryId, resultId]
  );
  const row = rows?.[0];
  if (!row || (String(row.result_id || '') === resultId && String(row.result_state || '') === 'pending')) {
    return { replay: null, keyHash };
  }
  if (String(row.target_memory_id || '') !== memoryId) {
    throw workFailure(workSignal, 409, { error: 'Idempotency key was used for a different target memory', code: 'IDEMPOTENCY_KEY_REUSED' }, 'idempotency-key-reused', 'IDEMPOTENCY_KEY_REUSED');
  }
  if (String(row.request_fingerprint || '') !== fingerprint) {
    throw workFailure(workSignal, 409, { error: 'Idempotency key was used with a different request payload', code: 'IDEMPOTENCY_KEY_REUSED' }, 'idempotency-key-reused', 'IDEMPOTENCY_KEY_REUSED');
  }

  const state = String(row.result_state || '');
  if (state === 'completed' || state === 'replayed') {
    await audit(tx, ownerId, memoryId, REPLAY_OPERATION, keyHash);
    const stored = parseStoredPayload(row.result_payload);
    if (stored) return { replay: stored, keyHash };
    const counts = await readCounts(tx, memoryId);
    return {
      replay: { type, active: false, counts, total: Object.values(counts).reduce((a, b) => a + Number(b || 0), 0) },
      keyHash
    };
  }
  if (state === 'pending' || state === 'failed') {
    throw workFailure(workSignal, 500, { error: 'Request is already being processed. Please retry with the same key.', code: 'SOCIAL_WRITE_UNAVAILABLE' }, 'social-write-unavailable', 'SOCIAL_WRITE_UNAVAILABLE');
  }
  return { replay: null, keyHash };
}

async function runReactionWork(tx, workSignal, { ownerId, memoryId, type, key }) {
  // Current Moment-social authority: advisory lock BEFORE Memory+Tree FOR SHARE.
  const lockKey = await buildAdvisoryLockKey(ownerId, memoryId, type);
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
  const target = authRows?.[0];
  if (!target) {
    throw workFailure(workSignal, 404, { detail: 'Memory not found' }, 'memory-not-found', 'MEMORY_NOT_FOUND');
  }
  const isOwner = String(target.tree_owner_id || '') === ownerId;
  const isPublic = target.mem_visibility === 'public' && target.tree_visibility === 'public';
  if (!isOwner && !isPublic) {
    throw workFailure(workSignal, 404, { detail: 'Memory not found' }, 'memory-not-found', 'MEMORY_NOT_FOUND');
  }

  const reservation = await reserveIdempotency(tx, workSignal, { ownerId, memoryId, type, key });
  if (reservation.replay) {
    workSignal.outcome = { status: 200, body: reservation.replay, routeStatus: 'reaction-replay' };
    return reservation.replay;
  }

  const existingRows = await tx.query(
    `SELECT id FROM reactions
     WHERE memory_id = $1 AND owner_id = $2 AND type = $3
     LIMIT 1`,
    [memoryId, ownerId, type]
  );
  const existing = existingRows?.[0];
  let active;
  let mutationResultId;
  if (existing) {
    mutationResultId = String(existing.id);
    await tx.query(
      `DELETE FROM reactions WHERE memory_id = $1 AND owner_id = $2 AND type = $3`,
      [memoryId, ownerId, type]
    );
    active = false;
  } else {
    mutationResultId = crypto.randomUUID();
    await tx.query(
      `INSERT INTO reactions (id, memory_id, owner_id, type, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [mutationResultId, memoryId, ownerId, type]
    );
    active = true;
  }

  const counts = await readCounts(tx, memoryId);
  const payload = {
    type,
    active,
    counts,
    total: Object.values(counts).reduce((a, b) => a + Number(b || 0), 0)
  };
  await tx.query(
    `UPDATE social_idempotency
     SET result_id = $1, result_state = $2, result_payload = $3
     WHERE actor_id = $4 AND operation = $5 AND idempotency_key = $6`,
    [mutationResultId, 'completed', JSON.stringify(payload), ownerId, OPERATION, key]
  );
  await audit(tx, ownerId, memoryId, OPERATION, reservation.keyHash);
  workSignal.outcome = { status: 200, body: payload, routeStatus: 'reaction-complete' };
  return payload;
}

function sanitizedAdapterResponse(error, routeStatus) {
  const sanitized = sanitizeNeonWsTransactionError(error);
  if (sanitized.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN) {
    return jsonResponse({ error: 'Transaction commit outcome unknown', code: 'COMMIT_OUTCOME_UNKNOWN' }, 502, 'commit-outcome-unknown');
  }
  return jsonResponse(
    { error: 'Memory reaction direct-Neon transaction failed', code: sanitized.code },
    Number.isInteger(sanitized.status) ? sanitized.status : 500,
    routeStatus
  );
}

export async function handleMemoryReactionDirectNeon(request, env = {}, options = {}) {
  if (!isMemoryReactionDirectNeonRequest(request) || !isMemoryReactionDirectNeonSelected(env)) return null;

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
    if (error instanceof FirebaseReadPrincipalError) return buildFirebaseReadPrincipalErrorResponse(error, request);
    return jsonResponse({ error: 'Authentication verifier unavailable' }, 503, 'verifier-unavailable');
  }
  const ownerId = principal.legacyOwnerId;

  const parsed = parseReactionBody(options.bodyBytesOverride);
  if (!parsed.ok) return jsonResponse(parsed.body, parsed.status, 'invalid-json-body');

  const idResult = normalizePythonUuid(options.memoryIdOverride, 'memoryId');
  if (!idResult.ok) return jsonResponse({ detail: idResult.detail }, idResult.status, 'invalid-memory-id');
  const memoryId = idResult.value;

  const typeResult = normalizeReactionType(parsed.payload.type);
  if (!typeResult.ok) return jsonResponse({ error: typeResult.detail, code: typeResult.code }, typeResult.status, 'reaction-type-invalid');
  const type = typeResult.value;

  const keyResult = validateIdempotencyKey(options.idempotencyKeyOverride ?? request.headers.get('Idempotency-Key'));
  if (!keyResult.ok) return jsonResponse({ error: keyResult.detail, code: keyResult.code }, keyResult.status, 'idempotency-key-invalid');
  const key = keyResult.value;

  const config = readMemoryReactionWriteConfig(env);
  if (!config.configured) {
    const forbidden = detectForbiddenMemoryReactionWriterFallback(env);
    if (forbidden) return jsonResponse({ error: 'Memory reaction direct-Neon writer config invalid', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' }, 503, 'config-forbidden-fallback');
    return jsonResponse({ error: 'Memory reaction direct-Neon runtime not configured', code: 'DIRECT_NEON_CONFIG_ABSENT' }, 503, 'config-absent');
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
    result = await adapter.runTransaction((tx) => runReactionWork(tx, workSignal, { ownerId, memoryId, type, key }));
  } catch (error) {
    if (error instanceof NeonWsTransactionError) {
      if (error.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN) {
        return jsonResponse({ error: 'Transaction commit outcome unknown', code: 'COMMIT_OUTCOME_UNKNOWN' }, 502, 'commit-outcome-unknown');
      }
      if (workSignal.outcome) return jsonResponse(workSignal.outcome.body, workSignal.outcome.status, workSignal.outcome.routeStatus);
    }
    return sanitizedAdapterResponse(error, 'transaction-failed');
  }

  const payload = result && typeof result === 'object' && result.value ? result.value : null;
  if (!payload || payload.type !== type || typeof payload.active !== 'boolean' || !payload.counts || typeof payload.counts !== 'object' || !Number.isFinite(payload.total)) {
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
