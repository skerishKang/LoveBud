// #4142 Phase-4 Tree Like toggle Cloudflare -> Neon WebSocket interactive
// transaction candidate adapter.
//
// This is a gated MIGRATION CANDIDATE only. The Product Like route remains
// Modal-backed unless the route-specific gate is explicitly selected:
//
//   LB_TREE_LIKE_WRITE_RUNTIME=direct_neon
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
// (modal_compute/tree_likes.py::toggle_tree_like). This adapter preserves the
// hardened invariants exactly:
//   - Tree explicit-public authorization FOR SHARE (BEFORE advisory lock)
//   - actor/tree advisory xact lock AFTER FOR SHARE authorization
//   - tree_social_counts ensure
//   - idempotency reserve/replay (SELECT-first, target_kind='tree')
//   - active -> soft delete + decrement like_count (floor 0)
//   - inactive -> fresh Like row + increment like_count
//   - likeCount reread parity
//   - idempotency completion + audit before commit
//   - { treeId, active, likeCount } response contract
//   - work failure -> rollback
//   - COMMIT ambiguity -> bounded non-success; no blind retry
//   - sanitized errors; no token/DB URL/JWK/private leakage
//
// IMPORTANT: do NOT move the advisory lock ahead of the Tree FOR SHARE
// authorization. Current Product ordering is:
//   Tree FOR SHARE -> advisory lock -> aggregate/idempotency/mutation
//
// This source child does NOT create a Production writer secret/role, does NOT
// perform GRANT/REVOKE, and does NOT activate the Production route gate.

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

export const TREE_LIKE_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_TREE_LIKE_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

// Forbidden generic/read DB envs must never satisfy the dedicated writer config.
export const TREE_LIKE_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:\-]{8,128}$/;
const FORBIDDEN_SET = new Set(TREE_LIKE_FORBIDDEN_FALLBACK_ENVS);
const LIKE_OPERATION = 'tree.like.toggle';
const TARGET_KIND = 'tree';

// ─── Gate / route selection ───────────────────────────────────────────────

export function isTreeLikeDirectNeonRequest(request) {
  if (!request || request.method.toUpperCase() !== 'POST') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return /^\/api\/trees\/[^/]+\/likes$/.test(path);
}

export function isTreeLikeDirectNeonSelected(env = {}) {
  const value = typeof env?.[TREE_LIKE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[TREE_LIKE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === TREE_LIKE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

// ─── Dedicated writer config (no generic fallback) ───────────────────────

export function readTreeLikeWriteConfig(env = {}) {
  const dedicated = typeof env?.[TREE_LIKE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[TREE_LIKE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(dedicated);
  return Object.freeze({
    dedicated,
    configured,
    connectionString: configured ? dedicated : ''
  });
}

export function detectForbiddenWriterFallback(env = {}) {
  if (readTreeLikeWriteConfig(env).configured) return null;
  for (const name of TREE_LIKE_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonWsConnectionString(raw)) {
      return Object.freeze({ name, connectionString: raw });
    }
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function responseHeaders(requestId, routeStatus = null) {
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
  return headers;
}

function jsonResponse(body, status, requestId, routeStatus = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(requestId, routeStatus)
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
    return { ok: false, value: null, detail: 'Tree ID is required', status: 400 };
  }
  if (!UUID_PATTERN.test(trimmed)) {
    return { ok: false, value: null, detail: 'Tree ID must be a valid UUID', status: 400 };
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

async function computeKeyHash(key) {
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function computeFingerprint(body) {
  const raw = JSON.stringify(body, Object.keys(body).sort());
  // Simple deterministic fingerprint (parity with Python _compute_fingerprint).
  // Uses a text encoder + SHA-256 via the same crypto.subtle path at call sites.
  return raw;
}

async function computeFingerprintHash(body) {
  const raw = computeFingerprint(body);
  const data = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildLikeLockKey(actorId, treeId) {
  // Parity with Python _tree_like_advisory_lock: SHA-256(actor:tree) first 8 bytes
  // as a signed 64-bit integer.
  const raw = `${actorId}:${treeId}`;
  // Use a deterministic synchronous hash (parity: first 8 bytes of SHA-256).
  // crypto.subtle is async; for the advisory lock key we compute it inside the
  // work callback (async) below.
  return raw;
}

async function buildLikeLockKeyAsync(actorId, treeId) {
  const raw = `${actorId}:${treeId}`;
  const data = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const first8 = hashArray.slice(0, 8);
  // Convert to signed 64-bit bigint (parity with Python int.from_bytes signed=True).
  let value = 0n;
  for (let i = 0; i < 8; i++) {
    value = (value << 8n) | BigInt(first8[i]);
  }
  // Interpret as signed 64-bit (two's complement).
  const SIGN_BIT = 1n << 63n;
  if (value & SIGN_BIT) {
    value = value - (1n << 64n);
  }
  return value.toString();
}

// ─── Like toggle work ─────────────────────────────────────────────────────

async function runLikeWork(tx, workSignal, { treeId, ownerId, idempotencyKey }) {
  const operation = LIKE_OPERATION;
  const targetKind = TARGET_KIND;
  const body = {};

  // 1. Tree explicit-public authorization FOR SHARE (BEFORE advisory lock).
  // This serializes a concurrent owner public->private visibility UPDATE so the
  // social mutation cannot durably commit after visibility revocation.
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

  // 2. Advisory xact lock AFTER FOR SHARE authorization (actor, tree).
  const lockKey = await buildLikeLockKeyAsync(ownerId, treeId);
  await tx.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

  // 3. Ensure tree_social_counts row exists.
  await tx.query(
    `INSERT INTO tree_social_counts (tree_id, like_count, view_count, updated_at)
     VALUES ($1, 0, 0, NOW())
     ON CONFLICT (tree_id) DO NOTHING`,
    [treeId]
  );

  // 4. Idempotency: SELECT-first replay detection.
  const fingerprint = await computeFingerprintHash(body);
  const keyHash = await computeKeyHash(idempotencyKey);

  const existingRows = await tx.query(
    `SELECT target_kind, target_id, result_id, result_state,
            request_fingerprint, result_payload
     FROM social_idempotency
     WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3
     LIMIT 1`,
    [ownerId, operation, idempotencyKey]
  );

  if (existingRows && existingRows.length > 0) {
    const existing = existingRows[0];
    const storedKind = String(existing.target_kind);
    const storedTarget = String(existing.target_id);
    const storedFingerprint = String(existing.request_fingerprint);
    const storedState = String(existing.result_state);

    if (storedKind !== targetKind || storedTarget !== treeId) {
      workSignal.outcome = { status: 409, body: { error: 'Idempotency key was used for a different target', code: 'IDEMPOTENCY_KEY_REUSED' }, routeStatus: 'idempotency-key-reused' };
      const err = new NeonWsTransactionError(
        NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
        'IDEMPOTENCY_KEY_REUSED'
      );
      err.status = 409;
      throw err;
    }
    if (storedFingerprint !== fingerprint) {
      workSignal.outcome = { status: 409, body: { error: 'Idempotency key was used with a different request payload', code: 'IDEMPOTENCY_KEY_REUSED' }, routeStatus: 'idempotency-key-reused' };
      const err = new NeonWsTransactionError(
        NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
        'IDEMPOTENCY_KEY_REUSED'
      );
      err.status = 409;
      throw err;
    }
    if (storedState === 'completed' || storedState === 'replayed') {
      // Replay: return stored canonical result.
      let storedPayload = existing.result_payload;
      if (storedPayload != null && typeof storedPayload === 'string') {
        try {
          storedPayload = JSON.parse(storedPayload);
        } catch {
          storedPayload = null;
        }
      }

      // Record audit for replay.
      await tx.query(
        `INSERT INTO social_audit_log
            (id, actor_id, target_kind, target_id, memory_id, action, outcome_code, request_key_hash, created_at)
         VALUES ($1, $2, $3, $4, NULL, $5, 'success', $6, NOW())`,
        [crypto.randomUUID(), ownerId, targetKind, treeId, 'tree.like.toggle.replay', keyHash]
      );

      workSignal.outcome = { status: 200, body: storedPayload || (await readActiveAndCount(tx, treeId, ownerId)), routeStatus: 'like-replay' };
      return storedPayload || (await readActiveAndCount(tx, treeId, ownerId));
    }
    if (storedState === 'pending' || storedState === 'failed') {
      workSignal.outcome = { status: 500, body: { error: 'Request is already being processed. Please retry with the same key.', code: 'SOCIAL_WRITE_UNAVAILABLE' }, routeStatus: 'social-write-unavailable' };
      const err = new NeonWsTransactionError(
        NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
        'SOCIAL_WRITE_UNAVAILABLE'
      );
      err.status = 500;
      throw err;
    }
  }

  // Fresh reservation.
  const resultId = crypto.randomUUID();
  await tx.query(
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
       result_payload = social_idempotency.result_payload`,
    [crypto.randomUUID(), ownerId, operation, idempotencyKey, fingerprint, targetKind, treeId, null, resultId]
  );

  // 5. Toggle: fetch active like.
  const activeRows = await tx.query(
    `SELECT id
     FROM tree_likes
     WHERE tree_id = $1 AND owner_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [treeId, ownerId]
  );
  const existing = activeRows && activeRows.length > 0 ? activeRows[0] : null;

  let active;
  if (existing) {
    // active -> soft delete + decrement (floor 0).
    await tx.query(
      `UPDATE tree_likes SET deleted_at = NOW() WHERE id = $1`,
      [existing.id]
    );
    await tx.query(
      `UPDATE tree_social_counts
       SET like_count = GREATEST(like_count - 1, 0), updated_at = NOW()
       WHERE tree_id = $1`,
      [treeId]
    );
    active = false;
  } else {
    // inactive -> fresh Like row + increment.
    await tx.query(
      `INSERT INTO tree_likes (id, tree_id, owner_id, created_at, deleted_at)
       VALUES ($1, $2, $3, NOW(), NULL)`,
      [crypto.randomUUID(), treeId, ownerId]
    );
    await tx.query(
      `UPDATE tree_social_counts
       SET like_count = like_count + 1, updated_at = NOW()
       WHERE tree_id = $1`,
      [treeId]
    );
    active = true;
  }

  // 6. likeCount reread parity.
  const countRows = await tx.query(
    `SELECT like_count FROM tree_social_counts WHERE tree_id = $1 LIMIT 1`,
    [treeId]
  );
  const likeCount = countRows && countRows.length > 0 ? Number(countRows[0].like_count || 0) : 0;
  const resultPayload = { treeId, active, likeCount };

  // 7. Idempotency completion + audit before commit.
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
    [crypto.randomUUID(), ownerId, targetKind, treeId, 'tree.like.toggle', keyHash]
  );

  workSignal.outcome = { status: 200, body: resultPayload, routeStatus: 'like-complete' };
  return resultPayload;
}

async function readActiveAndCount(tx, treeId, ownerId) {
  const activeRows = await tx.query(
    `SELECT id FROM tree_likes WHERE tree_id = $1 AND owner_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [treeId, ownerId]
  );
  const active = !!(activeRows && activeRows.length > 0);
  const countRows = await tx.query(
    `SELECT like_count FROM tree_social_counts WHERE tree_id = $1 LIMIT 1`,
    [treeId]
  );
  const likeCount = countRows && countRows.length > 0 ? Number(countRows[0].like_count || 0) : 0;
  return { treeId, active, likeCount };
}

// ─── Main handler ─────────────────────────────────────────────────────────

export async function handleTreeLikeDirectNeon(
  request,
  env = {},
  requestId = null,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null
  } = {}
) {
  if (!isTreeLikeDirectNeonRequest(request) || !isTreeLikeDirectNeonSelected(env)) {
    // Default/unknown gate -> existing Modal path unchanged. Return null so the
    // gateway continues to the Modal-owned write route.
    return null;
  }

  // Auth FIRST: verify the Firebase principal before any DB capability is
  // acquired or any transaction starts. transaction/client calls = 0 and
  // DB writes = 0 when auth is missing/malformed/invalid/expired.
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

  // Validate the path tree id (current Modal 400 parity for invalid UUID).
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
  const config = readTreeLikeWriteConfig(env);
  if (!config.configured) {
    return jsonResponse(
      { error: 'Tree Like direct-Neon runtime not configured', code: 'DIRECT_NEON_CONFIG_ABSENT' },
      503,
      requestId,
      'config-absent'
    );
  }

  const forbidden = detectForbiddenWriterFallback(env);
  if (forbidden) {
    return jsonResponse(
      { error: 'Tree Like direct-Neon writer config invalid', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' },
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
      return await runLikeWork(tx, workSignal, { treeId, ownerId, idempotencyKey });
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
        return jsonResponse(workSignal.outcome.body, workSignal.outcome.status, requestId, workSignal.outcome.routeStatus);
      }
    }
    return sanitizeAdapterErrorResponse(error, requestId, 'transaction-failed');
  }

  const payload = result && typeof result === 'object' && result.value ? result.value : null;
  if (!payload || typeof payload.treeId !== 'string' || typeof payload.active !== 'boolean' || typeof payload.likeCount !== 'number') {
    return jsonResponse(
      { error: 'Like toggle failed' },
      500,
      requestId,
      'no-like-result'
    );
  }

  return jsonResponse(payload, 200, requestId, 'like-complete');
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
    { error: 'Tree Like direct-Neon transaction failed', code: sanitized.code },
    status,
    requestId,
    routeStatus
  );
}

export const TREE_LIKE_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'POST',
  path: '/api/trees/:id/likes',
  gateEnv: TREE_LIKE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: TREE_LIKE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: TREE_LIKE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: TREE_LIKE_FORBIDDEN_FALLBACK_ENVS,
  ownerAuthority: 'verified-firebase-uid',
  lockOrder: 'FOR_SHARE_THEN_ADVISORY_XACT_LOCK',
  writes: true,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false
});
