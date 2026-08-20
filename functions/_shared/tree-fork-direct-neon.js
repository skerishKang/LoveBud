// #4135 Phase-4 public Tree fork Cloudflare -> Neon WebSocket interactive
// transaction candidate adapter.
//
// This is a gated MIGRATION CANDIDATE only. The Product fork route remains
// Modal-backed unless the route-specific gate is explicitly selected:
//
//   LB_TREE_FORK_WRITE_RUNTIME=direct_neon
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
// (modal_compute/tree_writes.py::fork_public_tree). This adapter preserves the
// hardened invariants exactly:
//   - advisory xact lock (sourceTreeId, owner) BEFORE source Tree FOR SHARE
//   - source Tree explicit visibility = 'public' authorization
//   - duplicate fork lookup inside semantic serialization
//   - public Memory snapshot ORDER BY created_at ASC, id ASC LIMIT 201 FOR SHARE
//   - >200 -> 409 FORK_SOURCE_TOO_LARGE before destination Tree INSERT
//   - destination Tree owned by verified principal.legacyOwnerId, visibility
//     'public', forked_from_tree_id lineage, source title + " (복사본)" <= 200
//   - fresh destination Memory IDs, parent_id remapped only through the copied
//     old->new map; parent outside the copied public set -> null (never a
//     cross-tree FK)
//   - owner-user bootstrap parity (schema-capability aware, fail closed)
//   - canonical reread; sanitized errors; no token/DB URL/JWK/private leakage
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
  FirebaseReadPrincipalError,
  FIREBASE_READ_PRINCIPAL_ERROR
} from '../../workers/love-platform-api/firebase-read-principal.js';

export const TREE_FORK_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_TREE_FORK_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

// Forbidden generic/read DB envs must never satisfy the dedicated writer config.
export const TREE_FORK_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

export const TREE_FORK_PUBLIC_MAX = 200;
export const TREE_FORK_SNAPSHOT_LIMIT = TREE_FORK_PUBLIC_MAX + 1; // 201

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TITLE_MAX = 200;
const FORBIDDEN_SET = new Set(TREE_FORK_FORBIDDEN_FALLBACK_ENVS);

// ─── Gate / route selection ───────────────────────────────────────────────

export function isTreeForkDirectNeonRequest(request) {
  if (!request || request.method.toUpperCase() !== 'POST') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return /^\/api\/trees\/[^/]+\/fork$/.test(path);
}

export function isTreeForkDirectNeonSelected(env = {}) {
  const value = typeof env?.[TREE_FORK_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[TREE_FORK_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === TREE_FORK_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

// ─── Dedicated writer config (no generic fallback) ───────────────────────

export function readTreeForkWriteConfig(env = {}) {
  const dedicated = typeof env?.[TREE_FORK_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[TREE_FORK_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(dedicated);
  return Object.freeze({
    dedicated,
    configured,
    connectionString: configured ? dedicated : ''
  });
}

// Generic/read-only DB envs are forbidden only as substitutes for the dedicated
// writer authority. They may legitimately coexist with a valid dedicated writer
// binding in the shared Worker environment; in that case the writer URL remains
// the sole selected connection string.
export function detectForbiddenWriterFallback(env = {}) {
  if (readTreeForkWriteConfig(env).configured) return null;
  for (const name of TREE_FORK_FORBIDDEN_FALLBACK_ENVS) {
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
  body = body.replace(' ', 'T');
  body = body.replace(/(\.\d+)$/, (match) => {
    const digits = match.slice(1);
    return '.' + (digits + '000000').slice(0, 6);
  });
  if (offset === 'Z') return body + '+00:00';
  if (!offset) return body;
  const sign = offset[0];
  const rest = offset.slice(1);
  return body + (rest.includes(':') ? offset : `${sign}${rest}:00`);
}

function normalizeStoredVisibility(value) {
  if (value === 'public') return 'public';
  if (value === 'private') return 'private';
  return null;
}

function validateSourceTreeId(rawId) {
  if (typeof rawId !== 'string' || !rawId.trim()) {
    return Object.freeze({ ok: false, status: 400, detail: 'sourceTreeId is required' });
  }
  const trimmed = rawId.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    return Object.freeze({ ok: false, status: 400, detail: 'Invalid sourceTreeId' });
  }
  return Object.freeze({ ok: true, value: trimmed.toLowerCase() });
}

function extractSourceTreeId(request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const match = path.match(/^\/api\/trees\/([^/]+)\/fork$/);
  return match ? decodeURIComponent(match[1]) : '';
}

const FORK_LOCK_SQL = 'SELECT pg_advisory_xact_lock($1)';
const FORK_LOCK_DOMAIN = 'tree-fork:v1:';

// ─── Cross-runtime fork lock key (Modal parity) ───────────────────────────
//
// The Modal fork_public_tree serializes the semantic identity
// (sourceTreeId, ownerId) by computing a domain-separated SHA-256 digest of
//
//   `tree-fork:v1:${sourceTreeId}\x1f${ownerId}`
//
// taking the first 8 bytes as a big-endian SIGNED int64 and acquiring
//
//   SELECT pg_advisory_xact_lock(<bigint>)
//
// (modal_compute/tree_writes.py::_tree_fork_lock_key). The direct candidate
// must acquire the SAME advisory lock identity so that a concurrent Modal
// request and a direct-Neon request for the same (sourceTreeId, ownerId)
// pair serialize against one another. This does NOT use the #4132 helper's
// `pg_advisory_xact_lock(hashtext($1::text))` path because Postgres
// `hashtext()` produces a different 32-bit identity than SHA-256[0..8] and
// would therefore NOT interlock with the Modal runtime.
//
// The signed 64-bit value is never routed through JS Number (which would lose
// precision above 2^53). It is carried as a BigInt and passed as a parameter
// directly to the Neon WS driver, which serializes BigInt as a Postgres
// numeric/int8 value.

async function computeForkLockKey(sourceTreeId, ownerId) {
  const text = `${FORK_LOCK_DOMAIN}${sourceTreeId}\x1f${ownerId}`;
  const encoded = new TextEncoder().encode(text);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoded));
  let value = 0n;
  for (let i = 0; i < 8; i += 1) {
    value = (value << 8n) | BigInt(digest[i]);
  }
  // Interpret the 8-byte big-endian value as a SIGNED int64 (two's complement).
  if (value >= 0x8000000000000000n) {
    value -= 0x10000000000000000n;
  }
  return value;
}

function buildForkedTitle(sourceTitle) {
  const base = typeof sourceTitle === 'string' && sourceTitle ? sourceTitle : 'LoveTree';
  return `${base} (복사본)`.slice(0, TITLE_MAX);
}

function normalizeTreeRow(row, memoryCount) {
  return {
    id: String(row.id),
    title: row.title || '',
    visibility: normalizeStoredVisibility(row.visibility),
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at),
    memoryCount: intOrZero(memoryCount),
    ownerId: row.owner_id ? String(row.owner_id) : null
  };
}

function intOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function normalizeDuplicateTreeRow(row) {
  // The duplicate canonical reread may carry social counts; preserve them when
  // present, but never fabricate them from input.
  const tree = normalizeTreeRow(row, row.memory_count ?? row.memoryCount ?? null);
  if (row.like_count != null) tree.likeCount = intOrZero(row.like_count);
  if (row.view_count != null) tree.viewCount = intOrZero(row.view_count);
  if (row.forked_from_tree_id != null) tree.forkedFromTreeId = String(row.forked_from_tree_id);
  return tree;
}

// ─── Schema-capability-aware owner-user bootstrap (parity) ───────────────

const USERS_SCHEMA_SQL = `
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'users';
`;

function readUsersSchemaCapabilities(rows) {
  const columns = Object.create(null);
  for (const row of Array.isArray(rows) ? rows : []) {
    const name = String(row?.column_name || '').trim();
    if (name) {
      columns[name] = {
        isNullable: String(row?.is_nullable || '').toUpperCase() === 'YES',
        hasDefault: row?.column_default != null
      };
    }
  }
  return columns;
}

function hasRequiredUnknownUsersColumns(columns) {
  const handled = new Set(['id', 'email', 'created_at', 'updated_at']);
  for (const name of Object.keys(columns)) {
    if (handled.has(name)) continue;
    const meta = columns[name];
    if (!meta.isNullable && !meta.hasDefault) return true;
  }
  return false;
}

function buildOwnerUserInsert(columns, ownerId) {
  const insertColumns = ['id'];
  const values = ['$1'];
  const params = [ownerId];
  // email is never ownership authority; the direct candidate passes no caller
  // email, mirroring the Modal fork call ensure_owner_user_exists(owner_id).
  if (columns.email) {
    insertColumns.push('email');
    values.push('$2');
    params.push('');
  }
  if (columns.created_at) {
    insertColumns.push('created_at');
    values.push('NOW()');
  }
  if (columns.updated_at) {
    insertColumns.push('updated_at');
    values.push('NOW()');
  }
  const updates = [];
  if (columns.updated_at) updates.push('updated_at = NOW()');
  const conflictClause = updates.length
    ? `DO UPDATE SET ${updates.join(', ')}`
    : 'DO NOTHING';
  const sql = `INSERT INTO users (${insertColumns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (id) ${conflictClause};`;
  return Object.freeze({ sql, params });
}

// Work-callback errors must signal an HTTP status AND a bounded body. The #4132
// adapter preserves `status` for NeonWsTransactionError instances when re-
// wrapping a work failure, but reconstructs the error via makeError() from its
// own fixed code vocabulary, so custom error codes/bodies do not survive the
// re-wrap (the constructor also rejects unknown codes). Fork work therefore
// records its HTTP outcome on a request-local `signal` object immediately
// before throwing a NeonWsTransactionError with a valid adapter code and the
// matching status; throwing still triggers the adapter's rollback path, and
// the catch handler rebuilds the exact bounded body from the signal. This
// does not edit or duplicate the #4132 state machine.
const FORK_WORK_OUTCOME = Object.freeze({
  SOURCE_NOT_FOUND: 'source-not-found',
  SOURCE_NOT_PUBLIC: 'source-not-public',
  SOURCE_TOO_LARGE: 'source-too-large',
  DEST_INSERT_EMPTY: 'dest-insert-empty',
  CANONICAL_MISSING: 'canonical-missing',
  DUPLICATE_MISSING: 'duplicate-missing',
  USERS_SCHEMA_UNAVAILABLE: 'users-schema-unavailable'
});

function forkWorkError(signal, outcome, status) {
  if (signal) signal.outcome = outcome;
  // Use a valid #4132 adapter code so it survives the re-wrap; the status is
  // preserved for NeonWsTransactionError instances. The outcome is recovered
  // from the signal, not the code.
  return new NeonWsTransactionError(
    NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
    'fork work failed',
    { status }
  );
}

function isForkWorkError(error, signal) {
  return error instanceof NeonWsTransactionError
    && signal
    && typeof signal.outcome === 'string'
    && Number.isInteger(error.status);
}

function forkWorkResponse(error, signal, requestId) {
  const status = error.status;
  switch (signal.outcome) {
    case FORK_WORK_OUTCOME.SOURCE_NOT_FOUND:
      return jsonResponse({ error: 'Source tree not found' }, status, requestId, 'source-not-found');
    case FORK_WORK_OUTCOME.SOURCE_NOT_PUBLIC:
      return jsonResponse({ error: 'Only public trees can be forked' }, status, requestId, 'source-not-public');
    case FORK_WORK_OUTCOME.SOURCE_TOO_LARGE:
      return jsonResponse(
        {
          error: 'Public source tree exceeds the supported 200-Moment fork limit',
          detail: {
            code: 'FORK_SOURCE_TOO_LARGE',
            supportedMax: TREE_FORK_PUBLIC_MAX,
            reason: 'Public source tree exceeds the supported 200-Moment fork limit'
          }
        },
        status,
        requestId,
        'source-too-large'
      );
    case FORK_WORK_OUTCOME.DEST_INSERT_EMPTY:
      return jsonResponse({ error: 'Fork creation failed' }, status, requestId, 'dest-insert-empty');
    case FORK_WORK_OUTCOME.CANONICAL_MISSING:
      return jsonResponse({ error: 'Fork creation failed' }, status, requestId, 'canonical-missing');
    case FORK_WORK_OUTCOME.DUPLICATE_MISSING:
      return jsonResponse({ error: 'Fork creation failed' }, status, requestId, 'duplicate-missing');
    case FORK_WORK_OUTCOME.USERS_SCHEMA_UNAVAILABLE:
      return jsonResponse({ error: 'Owner user bootstrap unavailable' }, status, requestId, 'users-schema-unavailable');
    default:
      return jsonResponse({ error: 'Fork creation failed' }, status, requestId, 'fork-work-failed');
  }
}

// ─── Fork transaction work ─────────────────────────────────────────────────

const SOURCE_TREE_FOR_SHARE_SQL = `
SELECT id, title, visibility
FROM trees
WHERE id = $1
FOR SHARE;
`;

const EXISTING_FORK_SQL = `
SELECT id, forked_from_tree_id
FROM trees
WHERE owner_id = $1
  AND forked_from_tree_id = $2
ORDER BY created_at DESC
LIMIT 1;
`;

const INSERT_DEST_TREE_SQL = `
INSERT INTO trees (id, owner_id, title, visibility, forked_from_tree_id, created_at, updated_at)
VALUES ($1, $2, $3, 'public', $4, NOW(), NOW())
RETURNING id, owner_id, title, visibility, forked_from_tree_id, created_at, updated_at;
`;

const FETCH_SOURCE_MEMORIES_FOR_SHARE_SQL = `
SELECT id, parent_id, title, memo, artist, source, source_url, source_type,
       thumbnail, emotion_tags, timestamp, channel_id, channel_name, channel_url
FROM memories
WHERE tree_id = $1
  AND visibility = 'public'
ORDER BY created_at ASC, id ASC
LIMIT 201
FOR SHARE;
`;

const INSERT_MEMORY_SQL = `
INSERT INTO memories (
  id, tree_id, parent_id, title, memo, artist, source, source_url,
  source_type, thumbnail, emotion_tags, timestamp, visibility,
  channel_id, channel_name, channel_url,
  created_at, updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'public', $13, $14, $15, NOW(), NOW());
`;

const CANONICAL_REREAD_DEST_TREE_SQL = `
SELECT t.id, t.owner_id, t.title, t.visibility, t.forked_from_tree_id,
       t.created_at, t.updated_at,
       COUNT(m.id)::int AS memory_count
FROM trees t
LEFT JOIN memories m ON m.tree_id = t.id
WHERE t.id = $1
GROUP BY t.id, t.owner_id, t.title, t.visibility, t.forked_from_tree_id,
         t.created_at, t.updated_at
LIMIT 1;
`;

const CANONICAL_REREAD_EXISTING_TREE_SQL = `
SELECT t.id, t.owner_id, t.title, t.visibility, t.forked_from_tree_id,
       t.created_at, t.updated_at,
       COUNT(m.id)::int AS memory_count
FROM trees t
LEFT JOIN memories m ON m.tree_id = t.id
WHERE t.id = $1
  AND t.owner_id = $2
GROUP BY t.id, t.owner_id, t.title, t.visibility, t.forked_from_tree_id,
         t.created_at, t.updated_at
LIMIT 1;
`;

function newUuid() {
  return crypto.randomUUID();
}

function buildMemoryInsertParams(mem, idMap, newTreeId) {
  const newMemId = idMap[mem.id];
  const oldParentId = mem.parent_id ? String(mem.parent_id) : null;
  const newParentId = oldParentId ? (idMap[oldParentId] || null) : null;
  return [
    newMemId,
    newTreeId,
    newParentId,
    mem.title ?? null,
    mem.memo ?? null,
    mem.artist ?? null,
    mem.source ?? null,
    mem.source_url ?? null,
    mem.source_type ?? null,
    mem.thumbnail ?? null,
    mem.emotion_tags ?? null,
    mem.timestamp ?? null,
    mem.channel_id ?? null,
    mem.channel_name ?? null,
    mem.channel_url ?? null
  ];
}

async function runForkWork(tx, signal, { sourceTreeId, ownerId, forkLockKey }) {
  // A. Semantic advisory transaction lock FIRST (sourceTreeId, ownerId).
  //
  // Modal parity: SHA-256-derived signed int64 bigint passed directly as
  // pg_advisory_xact_lock($1). This is the SAME lock identity the Modal
  // runtime acquires (modal_compute/tree_writes.py::_tree_fork_lock_key), so a
  // concurrent Modal request and a direct-Neon request for the same
  // (sourceTreeId, ownerId) pair interlock. The #4132 advisoryXactLock helper
  // (which uses hashtext) is intentionally NOT used here because hashtext
  // produces a different 32-bit identity than SHA-256[0..8].
  await tx.query(FORK_LOCK_SQL, [forkLockKey]);

  // B. Source Tree SELECT ... FOR SHARE.
  const sourceRows = await tx.forShare(SOURCE_TREE_FOR_SHARE_SQL, [sourceTreeId]);
  const sourceTree = Array.isArray(sourceRows) && sourceRows.length ? sourceRows[0] : null;
  if (!sourceTree) {
    throw forkWorkError(signal, FORK_WORK_OUTCOME.SOURCE_NOT_FOUND, 404);
  }
  if (String(sourceTree.visibility || '') !== 'public') {
    throw forkWorkError(signal, FORK_WORK_OUTCOME.SOURCE_NOT_PUBLIC, 403);
  }

  // C. Duplicate fork lookup inside the same semantic serialization.
  const existingRows = await tx.query(EXISTING_FORK_SQL, [ownerId, sourceTreeId]);
  const existing = Array.isArray(existingRows) && existingRows.length ? existingRows[0] : null;
  if (existing) {
    // Duplicate: do NOT create a second Tree. Canonical reread of the existing
    // fork inside the same transaction and return it as the canonical existing
    // fork (HTTP 200, forked=false, duplicate=true).
    const canonicalRows = await tx.canonicalReread(CANONICAL_REREAD_EXISTING_TREE_SQL, [
      String(existing.id),
      ownerId
    ]);
    const canonical = Array.isArray(canonicalRows) && canonicalRows.length ? canonicalRows[0] : null;
    if (!canonical) {
      throw forkWorkError(signal, FORK_WORK_OUTCOME.DUPLICATE_MISSING, 404);
    }
    const tree = normalizeDuplicateTreeRow(canonical);
    return Object.freeze({
      kind: 'duplicate',
      tree: { ...tree, forked: false, duplicate: true }
    });
  }

  // D. Source public Memory snapshot (public only, deterministic order, FOR SHARE).
  const memoryRows = await tx.forShare(FETCH_SOURCE_MEMORIES_FOR_SHARE_SQL, [sourceTreeId]);
  const memories = Array.isArray(memoryRows) ? memoryRows : [];

  // E. Over-limit decision BEFORE destination Tree INSERT.
  if (memories.length > TREE_FORK_PUBLIC_MAX) {
    throw forkWorkError(signal, FORK_WORK_OUTCOME.SOURCE_TOO_LARGE, 409);
  }

  // F. Destination Tree insert (owned by verified principal.legacyOwnerId).
  const newTreeId = newUuid();
  const newTitle = buildForkedTitle(sourceTree.title);
  const insertRows = await tx.query(INSERT_DEST_TREE_SQL, [
    newTreeId,
    ownerId,
    newTitle,
    sourceTreeId
  ]);
  const insertedTree = Array.isArray(insertRows) && insertRows.length ? insertRows[0] : null;
  if (!insertedTree) {
    throw forkWorkError(signal, FORK_WORK_OUTCOME.DEST_INSERT_EMPTY, 500);
  }

  // G. Copy ALL bounded public Memories with fresh IDs and parent remap.
  const idMap = Object.create(null);
  for (const mem of memories) {
    idMap[String(mem.id)] = newUuid();
  }
  for (const mem of memories) {
    const params = buildMemoryInsertParams(mem, idMap, newTreeId);
    await tx.query(INSERT_MEMORY_SQL, params);
  }

  // H. Canonical reread of the destination Tree for the response. Do not
  // fabricate canonical values solely from input.
  const canonicalRows = await tx.canonicalReread(CANONICAL_REREAD_DEST_TREE_SQL, [newTreeId]);
  const canonical = Array.isArray(canonicalRows) && canonicalRows.length ? canonicalRows[0] : null;
  if (!canonical) {
    throw forkWorkError(signal, FORK_WORK_OUTCOME.CANONICAL_MISSING, 500);
  }
  const tree = normalizeTreeRow(canonical, memories.length);
  return Object.freeze({
    kind: 'created',
    tree: {
      ...tree,
      forkedFromTreeId: sourceTreeId,
      forked: true,
      duplicate: false
    }
  });
}

// ─── Owner-user bootstrap parity (schema-capability aware, fail closed) ───

async function ensureOwnerUserExists(tx, signal, ownerId) {
  const schemaRows = await tx.query(USERS_SCHEMA_SQL, []);
  const columns = readUsersSchemaCapabilities(schemaRows);
  if (!columns.id || hasRequiredUnknownUsersColumns(columns)) {
    // Unknown required non-null users column -> fail closed rather than
    // fabricate data.
    throw forkWorkError(signal, FORK_WORK_OUTCOME.USERS_SCHEMA_UNAVAILABLE, 500);
  }
  const { sql, params } = buildOwnerUserInsert(columns, ownerId);
  await tx.query(sql, params);
}

// ─── Adapter ──────────────────────────────────────────────────────────────

export async function handleTreeForkDirectNeon(
  request,
  env = {},
  requestId = null,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null
  } = {}
) {
  if (!isTreeForkDirectNeonRequest(request) || !isTreeForkDirectNeonSelected(env)) {
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
    // Bounded sanitized verifier-infrastructure failure.
    return jsonResponse(
      { error: 'Authentication verifier unavailable' },
      503,
      requestId,
      'verifier-unavailable'
    );
  }

  const ownerId = principal.legacyOwnerId;

  // Validate the path source tree id (current Modal 400 parity for invalid UUID).
  const sourceTreeIdResult = validateSourceTreeId(extractSourceTreeId(request));
  if (!sourceTreeIdResult.ok) {
    return jsonResponse(
      { error: sourceTreeIdResult.detail },
      sourceTreeIdResult.status,
      requestId,
      'invalid-source-tree-id'
    );
  }
  const sourceTreeId = sourceTreeIdResult.value;

  // Dedicated writer DB authority. No generic/read-only fallback.
  const config = readTreeForkWriteConfig(env);
  if (!config.configured) {
    // Fail closed: missing/invalid dedicated writer config. No Modal fallback.
    return jsonResponse(
      {
        error: 'Tree fork direct-Neon runtime not configured',
        code: 'DIRECT_NEON_CONFIG_ABSENT'
      },
      503,
      requestId,
      'config-absent'
    );
  }

  // A generic/read DB env cannot satisfy the writer config. If a forbidden
  // fallback is present, fail closed rather than silently reuse a read
  // credential or invent a second writer authority.
  const forbidden = detectForbiddenWriterFallback(env);
  if (forbidden) {
    return jsonResponse(
      {
        error: 'Tree fork direct-Neon writer config invalid',
        code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK'
      },
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

  // Compute the cross-runtime fork lock key BEFORE the transaction starts.
  // The key is a SHA-256-derived signed int64 identical to the Modal runtime's
  // _tree_fork_lock_key so concurrent Modal/direct requests interlock. This is
  // deterministic and side-effect free (no DB/network), so computing it outside
  // the transaction does not change transaction semantics or ordering.
  const forkLockKey = await computeForkLockKey(sourceTreeId, ownerId);

  // Request-local fork work outcome signal. The work callback records its HTTP
  // outcome here immediately before throwing a NeonWsTransactionError (which
  // the #4132 adapter re-wraps, preserving only the status); the catch handler
  // rebuilds the exact bounded body from this signal.
  const workSignal = { outcome: undefined };

  let result;
  try {
    result = await adapter.runTransaction(async (tx) => {
      // Owner-user bootstrap parity inside the same request-scoped transaction
      // scope. The current Modal calls ensure_owner_user_exists(owner_id) before
      // the fork transaction; for the direct candidate this is represented as a
      // schema-capability-aware upsert at the start of the interactive
      // transaction so a new verified Firebase UID does not fail merely because
      // the direct runtime omitted the users bootstrap. Unknown required
      // non-null users columns fail closed.
      await ensureOwnerUserExists(tx, workSignal, ownerId);

      // Fork transaction work (advisory bigint lock -> FOR SHARE source ->
      // authorize public -> duplicate lookup -> memory snapshot -> >200 reject
      // before destination insert -> destination insert -> memory copy ->
      // canonical reread).
      return await runForkWork(tx, workSignal, { sourceTreeId, ownerId, forkLockKey });
    });
  } catch (error) {
    if (isForkWorkError(error, workSignal)) {
      return forkWorkResponse(error, workSignal, requestId);
    }
    return sanitizeAdapterErrorResponse(error, requestId, 'transaction-failed');
  }

  const tree = result.value?.tree;
  if (!tree) {
    return jsonResponse(
      { error: 'Fork creation failed' },
      500,
      requestId,
      'no-fork-result'
    );
  }

  return jsonResponse(tree, 200, requestId, 'fork-complete');
}

function sanitizeAdapterErrorResponse(error, requestId, routeStatus) {
  // Sanitized, leak-safe error. Never expose raw connection string, token, JWK,
  // provider material, DB error text, or owner/private source data.
  const sanitized = sanitizeNeonWsTransactionError(error);
  const isUnknownCommit = sanitized.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN;
  // For an unknown COMMIT outcome, return a bounded ambiguity response. Do not
  // blindly retry the fork (duplicate prevention does not make unknown COMMIT
  // outcome safe for an automatic whole-transaction retry).
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
    { error: 'Tree fork direct-Neon transaction failed', code: sanitized.code },
    status,
    requestId,
    routeStatus
  );
}

export const TREE_FORK_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'POST',
  path: '/api/trees/:id/fork',
  gateEnv: TREE_FORK_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: TREE_FORK_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: TREE_FORK_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: TREE_FORK_FORBIDDEN_FALLBACK_ENVS,
  publicMax: TREE_FORK_PUBLIC_MAX,
  snapshotLimit: TREE_FORK_SNAPSHOT_LIMIT,
  ownerAuthority: 'verified-firebase-uid',
  writes: true,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false,
  forkLockAlgorithm: 'sha256-first8-bytes-signed-int64',
  forkLockSql: FORK_LOCK_SQL,
  forkLockUsesHashtext: false
});

export {
  computeForkLockKey,
  FORK_LOCK_SQL,
  FORK_LOCK_DOMAIN
};
