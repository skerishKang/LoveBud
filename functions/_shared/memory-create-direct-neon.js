// LOCAL-1 (#4178) Phase-4 explicit-public Memory create Cloudflare -> Neon
// WebSocket interactive transaction candidate adapter.
//
// This is a gated MIGRATION CANDIDATE only. The Product Memory create route
// remains Modal-backed unless the route-specific gate is explicitly selected:
//
//   LB_MEMORY_CREATE_WRITE_RUNTIME=direct_neon
//
// unset / modal / unknown  -> existing Modal path (this adapter returns null)
// direct_neon + visibility EXACTLY "public" -> direct-Neon candidate
//
// Route split (decided BEFORE any direct DB connection or transaction):
//   visibility omitted / null -> return null (Modal); parent-Tree inheritance
//     may resolve to private, so the direct runtime never touches the DB;
//   visibility "private" -> return null (Modal); Plus/private-storage
//     entitlement stays Modal-owned;
//   any other value -> return null (Modal keeps its exact validation parity).
//
// After explicit direct execution begins there is NO per-request direct ->
// Modal fallback. Missing/bad direct config or any auth/query/transaction
// failure fails closed.
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
// (modal_compute/memory_writes.py::create_owner_memory). This adapter
// preserves the current writer sequence exactly:
//   - strict scalar validation BEFORE any DB mutation (#3287/#3935 parity:
//     validate_optional_memory_string for title 200 / memo 5000 / artist 100 /
//     source 200 / sourceUrl 1000 / sourceType 50 default 'youtube' /
//     thumbnail 500 / timestamp 100 / channelId 100 empty->null / channelName
//     200 empty->null / channelUrl 1000 empty->null; INVALID_MEMORY_SCALAR_TYPE
//     structured 400s);
//   - emotionTags contract: array-only, string items, trim, drop empties,
//     max 20 items (INVALID_EMOTION_TAGS structured 400s);
//   - clientKey contract (#4058): omitted/null/"" -> NULL create (legacy
//     compatible); non-string -> 400 CLIENT_KEY_INVALID_TYPE; >100 code points
//     -> 400 CLIENT_KEY_TOO_LONG; validated BEFORE any DB mutation;
//   - legacy localization key write-boundary guard on title/memo (same
//     Cloudflare-side strengthening the Modal proxy applies) so the gated path
//     is never weaker than the ungated one;
//   - parent Tree ownership verified inside the transaction (403 parity);
//   - parentId same-tree membership verified under SELECT ... FOR KEY SHARE
//     before INSERT so the parent row cannot be deleted before commit (#3918
//     parity; FOR KEY SHARE blocks concurrent DELETE/PK UPDATE without
//     blocking reads);
//   - schema-capability detection of memories.client_key; column unavailable
//     + explicit clientKey -> bounded 501 MEMORY_CLIENT_KEY_SCHEMA_NOT_ACTIVATED
//     with zero mutation (#4058 parity: never silently ignore an explicit key);
//   - existing (tree_id, client_key) row found under FOR KEY SHARE -> converge:
//     canonical reread of the persisted Memory, no second INSERT;
//   - INSERT with ON CONFLICT (tree_id, client_key) DO NOTHING so a concurrent
//     same-key request converges to ONE canonical Memory via reread (the live
//     canonical schema carries UNIQUE (tree_id, client_key));
//   - canonical owner-scoped reread after INSERT builds the ENTIRE response;
//     the request payload is never echoed into a success body;
//   - created_at::text AS created_at / updated_at::text AS updated_at in every
//     projection so pg never coerces timestamptz into a JS Date;
//   - normalize_memory_row DTO parity incl. conditional clientKey field;
//   - work failure -> rollback; COMMIT ambiguity -> bounded 502 with no blind
//     retry; sanitized errors; no token/DB URL/JWK/private leakage.
//
// The current Modal Memory create writer has NO advisory lock, NO
// social_idempotency reservation, NO rate-limit write, NO audit write, and NO
// users-table bootstrap; none are added here.
//
// This source child does NOT activate the Production route gate, does NOT
// mutate Production secrets/bindings or providers, does NOT change schema or
// GRANTs, and does NOT touch Memory update/delete surfaces.

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
import { validateWritePayload } from './legacy-key-guard.js';
import { normalizeDirectNeonTimestamp } from './tree-fork-direct-neon.js';

export const MEMORY_CREATE_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_MEMORY_CREATE_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

// Forbidden generic/read DB envs must never satisfy the dedicated writer config.
export const MEMORY_CREATE_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_KEY_MAX = 100;
const EMOTION_TAGS_MAX = 20;

const MEMORY_FIELD_LIMITS = Object.freeze({
  title: 200,
  memo: 5000,
  artist: 100,
  source: 200,
  sourceUrl: 1000,
  sourceType: 50,
  thumbnail: 500,
  timestamp: 100,
  channelId: 100,
  channelName: 200,
  channelUrl: 1000
});

// ─── Gate / route selection ───────────────────────────────────────────────

export function isMemoryCreateDirectNeonRequest(request) {
  if (!request || request.method.toUpperCase() !== 'POST') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return /^\/api\/memories$/.test(path);
}

export function isMemoryCreateDirectNeonSelected(env = {}) {
  const value = typeof env?.[MEMORY_CREATE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[MEMORY_CREATE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === MEMORY_CREATE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

// ─── Dedicated writer config (no generic fallback) ───────────────────────

export function readMemoryCreateWriteConfig(env = {}) {
  const dedicated = typeof env?.[MEMORY_CREATE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[MEMORY_CREATE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(dedicated);
  return Object.freeze({
    dedicated,
    configured,
    connectionString: configured ? dedicated : ''
  });
}

export function detectForbiddenWriterFallback(env = {}) {
  if (readMemoryCreateWriteConfig(env).configured) return null;
  for (const name of MEMORY_CREATE_FORBIDDEN_FALLBACK_ENVS) {
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

// Python len() counts Unicode code points.
function codePointLength(text) {
  return [...text].length;
}

function intOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// modal_compute/validation.py::validate_required_uuid parity: missing/blank ->
// 400 "<name> is required"; invalid UUID -> 400 "Invalid <name>"; valid input
// is normalized to the canonical lowercase hyphenated form (str(uuid.UUID())).
export function validateRequiredUuid(value, name) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return { ok: false, status: 400, body: { error: `${name} is required` }, routeStatus: `invalid-${name.toLowerCase()}` };
  }
  if (!UUID_PATTERN.test(raw)) {
    return { ok: false, status: 400, body: { error: `Invalid ${name}` }, routeStatus: `invalid-${name.toLowerCase()}` };
  }
  return { ok: true, value: raw.toLowerCase() };
}

// validate_optional_memory_string parity: None -> ""; non-string -> structured
// 400 INVALID_MEMORY_SCALAR_TYPE; string -> trim; > max code points -> 400
// "Field exceeds max <n>". emptyToNull mirrors the `or None` call sites.
export function validateOptionalMemoryString(value, fieldName, options = {}) {
  const max = options.max;
  if (value === null || value === undefined) {
    return { ok: true, value: '' };
  }
  if (typeof value !== 'string') {
    return {
      ok: false,
      status: 400,
      body: { error: 'Invalid memory scalar type', code: 'INVALID_MEMORY_SCALAR_TYPE', field: fieldName, expected: 'string' },
      routeStatus: 'invalid-memory-scalar'
    };
  }
  const text = value.trim();
  if (codePointLength(text) > max) {
    return {
      ok: false,
      status: 400,
      body: { error: `Field exceeds max ${max}` },
      routeStatus: 'memory-scalar-oversize'
    };
  }
  return { ok: true, value: options.emptyToNull && !text ? null : text };
}

// validate_emotion_tags parity: non-array -> 400 INVALID_EMOTION_TAGS
// array_required; >20 items -> 400 message; non-string item -> 400
// string_items_required; trim; drop empties; order preserved.
export function validateEmotionTags(value) {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Invalid emotion tags', code: 'INVALID_EMOTION_TAGS', reason: 'array_required' },
      routeStatus: 'invalid-emotion-tags'
    };
  }
  if (value.length > EMOTION_TAGS_MAX) {
    return {
      ok: false,
      status: 400,
      body: { error: `emotionTags exceeds maximum of ${EMOTION_TAGS_MAX} items` },
      routeStatus: 'emotion-tags-oversize'
    };
  }
  const normalized = [];
  for (const tag of value) {
    if (typeof tag !== 'string') {
      return {
        ok: false,
        status: 400,
        body: { error: 'Invalid emotion tags', code: 'INVALID_EMOTION_TAGS', reason: 'string_items_required' },
        routeStatus: 'invalid-emotion-tags'
      };
    }
    const trimmed = tag.trim();
    if (trimmed) normalized.push(trimmed);
  }
  return { ok: true, value: normalized };
}

// validate_client_key parity: omitted/null/"" -> null; non-string -> 400
// CLIENT_KEY_INVALID_TYPE; >100 code points -> 400 CLIENT_KEY_TOO_LONG.
export function validateClientKeyInput(value) {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return {
      ok: false,
      status: 400,
      body: { error: 'Invalid clientKey', code: 'CLIENT_KEY_INVALID_TYPE', reason: 'string_required' },
      routeStatus: 'invalid-client-key'
    };
  }
  const stripped = value.trim();
  if (!stripped) {
    return { ok: true, value: null };
  }
  if (codePointLength(stripped) > CLIENT_KEY_MAX) {
    return {
      ok: false,
      status: 400,
      body: { error: 'clientKey exceeds max length', code: 'CLIENT_KEY_TOO_LONG', maxLength: CLIENT_KEY_MAX },
      routeStatus: 'client-key-too-long'
    };
  }
  return { ok: true, value: stripped };
}

// normalize_memory_row output parity for a stored emotion_tags value coming
// back from pg as an array: [str(tag) for tag in raw if tag].
function normalizeStoredEmotionTags(raw) {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw.filter((tag) => tag).map((tag) => String(tag));
  return [];
}

function normalizeStoredVisibility(value) {
  if (value === 'public') return 'public';
  if (value === 'private') return 'private';
  return null;
}

// normalize_memory_row DTO parity. clientKey appears only when the canonical
// row actually carries a persisted client_key (never fabricated).
function normalizeMemoryRowOutput(row) {
  const dto = {
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
    emotionTags: normalizeStoredEmotionTags(row.emotion_tags),
    timestamp: row.timestamp || '',
    visibility: normalizeStoredVisibility(row.visibility),
    channelId: row.channel_id || null,
    channelName: row.channel_name || null,
    channelUrl: row.channel_url || null,
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at)
  };
  if (row.client_key != null) {
    dto.clientKey = String(row.client_key);
  }
  return dto;
}

// ─── Transaction SQL (all projections text-cast timestamps) ──────────────

const OWNER_TREE_SQL = `
SELECT t.id, t.visibility
FROM trees t
WHERE t.id = $1
  AND t.owner_id = $2
LIMIT 1;
`;

const PARENT_FOR_KEY_SHARE_SQL = `
SELECT id, tree_id
FROM memories
WHERE id = $1
LIMIT 1
FOR KEY SHARE;
`;

const CLIENT_KEY_COLUMN_SQL = `
SELECT column_name
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'memories'
  AND column_name = 'client_key';
`;

const EXISTING_CLIENT_KEY_FOR_KEY_SHARE_SQL = `
SELECT id
FROM memories
WHERE tree_id = $1
  AND client_key = $2
LIMIT 1
FOR KEY SHARE;
`;

const CANONICAL_REREAD_BY_ID_SQL = `
SELECT m.id, m.tree_id, m.parent_id, m.title, m.memo, m.artist, m.source, m.source_url,
       m.source_type, m.thumbnail, m.emotion_tags, m.timestamp, m.visibility,
       m.channel_id, m.channel_name, m.channel_url, m.client_key,
       m.created_at::text AS created_at, m.updated_at::text AS updated_at,
       t.owner_id AS tree_owner_id
FROM memories m
INNER JOIN trees t ON t.id = m.tree_id
WHERE m.id = $1
LIMIT 1;
`;

const CANONICAL_REREAD_BY_CLIENT_KEY_SQL = `
SELECT m.id, m.tree_id, m.parent_id, m.title, m.memo, m.artist, m.source, m.source_url,
       m.source_type, m.thumbnail, m.emotion_tags, m.timestamp, m.visibility,
       m.channel_id, m.channel_name, m.channel_url, m.client_key,
       m.created_at::text AS created_at, m.updated_at::text AS updated_at,
       t.owner_id AS tree_owner_id
FROM memories m
INNER JOIN trees t ON t.id = m.tree_id
WHERE m.tree_id = $1
  AND m.client_key = $2
LIMIT 1;
`;

const INSERT_BASE_COLUMNS = `
  id, tree_id, parent_id, title, memo, artist, source, source_url,
  source_type, thumbnail, emotion_tags, timestamp, visibility,
  channel_id, channel_name, channel_url, created_at, updated_at`;

const INSERT_WITH_CLIENT_KEY_SQL = `
INSERT INTO memories (
  id, tree_id, parent_id, title, memo, artist, source, source_url,
  source_type, thumbnail, emotion_tags, timestamp, visibility,
  channel_id, channel_name, channel_url, client_key, created_at, updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'public', $13, $14, $15, $16, NOW(), NOW())
ON CONFLICT (tree_id, client_key) DO NOTHING
RETURNING id;
`;

const INSERT_BASE_SQL = `
INSERT INTO memories (${INSERT_BASE_COLUMNS})
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'public', $13, $14, $15, NOW(), NOW())
RETURNING id;
`;

// Work-callback errors must signal an HTTP status AND a bounded body. The
// #4132 adapter preserves `status` for NeonWsTransactionError instances when
// re-wrapping a work failure but reconstructs the error from its own fixed
// code vocabulary, so custom bodies do not survive the re-wrap. Create work
// therefore records its HTTP outcome on a request-local signal immediately
// before throwing; throwing still triggers the adapter's rollback path and the
// catch handler rebuilds the exact bounded body from the signal.
const CREATE_WORK_OUTCOME = Object.freeze({
  TREE_NOT_OWNED: 'tree-not-owned',
  INVALID_PARENT_ID: 'invalid-parent-id',
  CLIENT_KEY_SCHEMA_NOT_ACTIVATED: 'client-key-schema-not-activated',
  CONFLICT_UNRESOLVED: 'conflict-unresolved',
  MEMORY_INSERT_EMPTY: 'memory-insert-empty',
  CANONICAL_MISSING: 'canonical-missing',
  OWNER_REREAD_MISMATCH: 'owner-reread-mismatch'
});

function createWorkError(signal, outcome, status) {
  if (signal) signal.outcome = outcome;
  // Use a valid #4132 adapter code so it survives the re-wrap; the status is
  // preserved for NeonWsTransactionError instances. The outcome is recovered
  // from the signal, not the code.
  return new NeonWsTransactionError(
    NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
    'memory create work failed',
    { status }
  );
}

function isCreateWorkError(error, signal) {
  return error instanceof NeonWsTransactionError
    && signal
    && typeof signal.outcome === 'string'
    && Number.isInteger(error.status);
}

function createWorkResponse(error, signal, requestId) {
  const status = error.status;
  switch (signal.outcome) {
    case CREATE_WORK_OUTCOME.TREE_NOT_OWNED:
      return jsonResponse({ error: 'Access denied: not your tree' }, status, requestId, 'tree-not-owned');
    case CREATE_WORK_OUTCOME.INVALID_PARENT_ID:
      return jsonResponse(
        { error: 'Parent Memory is invalid', code: 'INVALID_PARENT_ID' },
        status,
        requestId,
        'invalid-parent-id'
      );
    case CREATE_WORK_OUTCOME.CLIENT_KEY_SCHEMA_NOT_ACTIVATED:
      return jsonResponse(
        {
          error: 'Memory clientKey schema not activated',
          code: 'MEMORY_CLIENT_KEY_SCHEMA_NOT_ACTIVATED',
          reason: 'client_key column unavailable; cannot honor idempotency'
        },
        status,
        requestId,
        'client-key-schema-not-activated'
      );
    case CREATE_WORK_OUTCOME.CONFLICT_UNRESOLVED:
      return jsonResponse(
        { error: 'Memory clientKey conflict unresolved', code: 'MEMORY_CLIENT_KEY_CONFLICT_UNRESOLVED' },
        status,
        requestId,
        'client-key-conflict-unresolved'
      );
    case CREATE_WORK_OUTCOME.MEMORY_INSERT_EMPTY:
      return jsonResponse({ error: 'Memory creation failed' }, status, requestId, 'memory-insert-empty');
    case CREATE_WORK_OUTCOME.CANONICAL_MISSING:
      return jsonResponse({ error: 'Memory creation failed' }, status, requestId, 'canonical-missing');
    case CREATE_WORK_OUTCOME.OWNER_REREAD_MISMATCH:
      return jsonResponse({ error: 'Memory creation failed' }, status, requestId, 'owner-reread-mismatch');
    default:
      return jsonResponse({ error: 'Memory creation failed' }, status, requestId, 'memory-create-work-failed');
  }
}

// ─── Memory create transaction work ───────────────────────────────────────

async function canonicalRereadAndVerify(tx, signal, {
  memoryId = null,
  treeId = null,
  clientKey = null,
  ownerId,
  missingOutcome = CREATE_WORK_OUTCOME.CANONICAL_MISSING,
  missingStatus = 500
}) {
  const rows = memoryId !== null
    ? await tx.canonicalReread(CANONICAL_REREAD_BY_ID_SQL, [memoryId])
    : await tx.canonicalReread(CANONICAL_REREAD_BY_CLIENT_KEY_SQL, [treeId, clientKey]);
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  if (!row) {
    throw createWorkError(signal, missingOutcome, missingStatus);
  }
  if (String(row.tree_owner_id || '') !== ownerId) {
    throw createWorkError(signal, CREATE_WORK_OUTCOME.OWNER_REREAD_MISMATCH, 500);
  }
  return normalizeMemoryRowOutput(row);
}

async function runCreateWork(tx, signal, { ownerId, treeId, parentId, clientKey, values }) {
  // A. Parent Tree ownership (403 parity) inside the request-scoped
  // transaction. Explicit-public routing already decided the visibility, so
  // the stored visibility is not needed here.
  const treeRows = await tx.query(OWNER_TREE_SQL, [treeId, ownerId]);
  if (!Array.isArray(treeRows) || treeRows.length === 0) {
    throw createWorkError(signal, CREATE_WORK_OUTCOME.TREE_NOT_OWNED, 403);
  }

  // B. Parent membership under FOR KEY SHARE (#3918 parity): blocks concurrent
  // DELETE/PK UPDATE of the parent row until our INSERT commits, without
  // blocking concurrent reads. Cross-tree or missing parents fail closed.
  if (parentId !== null) {
    const parentRows = await tx.query(PARENT_FOR_KEY_SHARE_SQL, [parentId]);
    const parentRow = Array.isArray(parentRows) && parentRows.length ? parentRows[0] : null;
    if (!parentRow || String(parentRow.tree_id) !== treeId) {
      throw createWorkError(signal, CREATE_WORK_OUTCOME.INVALID_PARENT_ID, 400);
    }
  }

  // C. Schema capability detection for memories.client_key (#4058 parity).
  const capabilityRows = await tx.query(CLIENT_KEY_COLUMN_SQL, []);
  const hasClientKeyColumn = Array.isArray(capabilityRows) && capabilityRows.length > 0;

  let insertSql;
  let insertParams;

  if (hasClientKeyColumn) {
    insertSql = INSERT_WITH_CLIENT_KEY_SQL;
    insertParams = [...values, clientKey];

    // D. Idempotency convergence pre-check under FOR KEY SHARE: an already
    // persisted (tree_id, client_key) row wins; return its canonical reread.
    if (clientKey !== null) {
      const existingRows = await tx.query(EXISTING_CLIENT_KEY_FOR_KEY_SHARE_SQL, [treeId, clientKey]);
      if (Array.isArray(existingRows) && existingRows.length > 0) {
        return await canonicalRereadAndVerify(tx, signal, { treeId, clientKey, ownerId });
      }
    }
  } else {
    // Compatibility path (#4058): never silently ignore an explicitly supplied
    // clientKey under a schema that cannot honor it.
    if (clientKey !== null) {
      throw createWorkError(signal, CREATE_WORK_OUTCOME.CLIENT_KEY_SCHEMA_NOT_ACTIVATED, 501);
    }
    insertSql = INSERT_BASE_SQL;
    insertParams = [...values];
  }

  // E. Insert. ON CONFLICT DO NOTHING makes a lost same-key race observable as
  // zero RETURNING rows (live UNIQUE (tree_id, client_key)); multiple NULL
  // client keys can never conflict, mirroring Modal UniqueViolation semantics.
  const insertedRows = await tx.query(insertSql, insertParams);
  const insertedRow = Array.isArray(insertedRows) ? insertedRows[insertedRows.length - 1] : null;

  // F. Lost race -> converge on the winning canonical row via the client-key
  // scoped canonical reread; a conflict row vanishing between insert and
  // reread -> bounded 409 (never fabricate success from the request payload).
  if (!insertedRow) {
    if (hasClientKeyColumn && clientKey !== null) {
      return await canonicalRereadAndVerify(tx, signal, {
        treeId,
        clientKey,
        ownerId,
        missingOutcome: CREATE_WORK_OUTCOME.CONFLICT_UNRESOLVED,
        missingStatus: 409
      });
    }
    throw createWorkError(signal, CREATE_WORK_OUTCOME.MEMORY_INSERT_EMPTY, 500);
  }

  // G. Canonical owner-scoped reread builds the whole response; verify the
  // reread still belongs to the verified owner before returning.
  return await canonicalRereadAndVerify(tx, signal, { memoryId: String(insertedRow.id), ownerId });
}

// ─── Main handler ─────────────────────────────────────────────────────────

export async function handleMemoryCreateDirectNeon(
  request,
  env = {},
  requestId = null,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null,
    boundedBodyResult = null
  } = {}
) {
  if (!isMemoryCreateDirectNeonRequest(request) || !isMemoryCreateDirectNeonSelected(env)) {
    // Default/unknown gate -> existing Modal path unchanged. Return null so the
    // gateway continues to the Modal-owned write route.
    return null;
  }

  // Bounded body read exactly once. The wired route reads the body before
  // dispatch and passes the captured result here (a Request stream cannot be
  // re-read); standalone callers omit boundedBodyResult and the handler reads
  // it itself.
  let bodyResult;
  if (boundedBodyResult && typeof boundedBodyResult === 'object') {
    bodyResult = boundedBodyResult;
  } else {
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
      { error: 'Request body could not be read' },
      503,
      requestId,
      'body-read-failed'
    );
  }

  // Object-only JSON contract (parse_json_body parity: empty body -> {}).
  let payload;
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

  // Route split BEFORE authentication so EVERY non-public request keeps the
  // exact existing Modal behavior (including Modal's own auth error shapes):
  // only an EXACT "public" string becomes a direct candidate. Omitted/null may
  // inherit a private parent Tree, private stays Plus/Modal-owned, and any
  // other value defers with zero direct DB contact. Authentication below still
  // runs before any DB capability acquisition or transaction start.
  if (payload.visibility !== 'public') {
    return null;
  }

  // Auth: verify the Firebase principal before any DB-dependent work.
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

  // Legacy localization key write-boundary guard (title/memo) — the same
  // Cloudflare-side strengthening the Modal proxy path applies, so the gated
  // candidate is never weaker than the ungated route.
  const guard = validateWritePayload(payload, ['title', 'memo']);
  if (guard) {
    let guardJson = {};
    try {
      guardJson = JSON.parse(await guard.text());
    } catch { /* bounded default below */ }
    return jsonResponse(
      guardJson && Object.keys(guardJson).length ? guardJson : { error: 'legacy localization key not allowed' },
      400,
      requestId,
      'legacy-localization-key'
    );
  }

  // Strict scalar validation BEFORE any mutation. Order follows
  // create_owner_memory: treeId first, then the remaining scalars.
  const treeIdResult = validateRequiredUuid(payload.treeId, 'treeId');
  if (!treeIdResult.ok) {
    return jsonResponse(treeIdResult.body, treeIdResult.status, requestId, treeIdResult.routeStatus);
  }

  const hasOwnEmotionTags = Object.prototype.hasOwnProperty.call(payload, 'emotionTags');
  const emotionTagsResult = hasOwnEmotionTags
    ? validateEmotionTags(payload.emotionTags)
    : { ok: true, value: [] };
  if (!emotionTagsResult.ok) {
    return jsonResponse(emotionTagsResult.body, emotionTagsResult.status, requestId, emotionTagsResult.routeStatus);
  }

  const clientKeyResult = validateClientKeyInput(payload.clientKey);
  if (!clientKeyResult.ok) {
    return jsonResponse(clientKeyResult.body, clientKeyResult.status, requestId, clientKeyResult.routeStatus);
  }

  const scalarFields = [
    ['title', MEMORY_FIELD_LIMITS.title, {}],
    ['memo', MEMORY_FIELD_LIMITS.memo, {}],
    ['artist', MEMORY_FIELD_LIMITS.artist, {}],
    ['source', MEMORY_FIELD_LIMITS.source, {}],
    ['sourceUrl', MEMORY_FIELD_LIMITS.sourceUrl, {}],
    ['sourceType', MEMORY_FIELD_LIMITS.sourceType, {}],
    ['thumbnail', MEMORY_FIELD_LIMITS.thumbnail, {}],
    ['timestamp', MEMORY_FIELD_LIMITS.timestamp, {}],
    ['channelId', MEMORY_FIELD_LIMITS.channelId, { emptyToNull: true }],
    ['channelName', MEMORY_FIELD_LIMITS.channelName, { emptyToNull: true }],
    ['channelUrl', MEMORY_FIELD_LIMITS.channelUrl, { emptyToNull: true }]
  ];
  const scalars = {};
  for (const [field, max, opts] of scalarFields) {
    const result = validateOptionalMemoryString(payload[field], field, { max, ...opts });
    if (!result.ok) {
      return jsonResponse(result.body, result.status, requestId, result.routeStatus);
    }
    scalars[field] = result.value;
  }

  const parentId = payload.parentId
    ? (() => {
        const result = validateRequiredUuid(payload.parentId, 'parentId');
        if (!result.ok) {
          return { error: result };
        }
        return { value: result.value };
      })()
    : { value: null };
  if (parentId.error) {
    return jsonResponse(
      parentId.error.body,
      parentId.error.status,
      requestId,
      parentId.error.routeStatus
    );
  }

  // sourceType default 'youtube' when empty/omitted (validate_optional_memory_string(p) or "youtube").
  const safeValues = [
    null, // placeholder for id, assigned inside the transaction
    treeIdResult.value,
    parentId.value,
    scalars.title,
    scalars.memo,
    scalars.artist,
    scalars.source,
    scalars.sourceUrl,
    scalars.sourceType || 'youtube',
    scalars.thumbnail,
    emotionTagsResult.value,
    scalars.timestamp,
    scalars.channelId,
    scalars.channelName,
    scalars.channelUrl
  ];

  // Dedicated writer DB authority. No generic/read-only fallback.
  const config = readMemoryCreateWriteConfig(env);
  if (!config.configured) {
    return jsonResponse(
      { error: 'Memory create direct-Neon runtime not configured', code: 'DIRECT_NEON_CONFIG_ABSENT' },
      503,
      requestId,
      'config-absent'
    );
  }

  const forbidden = detectForbiddenWriterFallback(env);
  if (forbidden) {
    return jsonResponse(
      { error: 'Memory create direct-Neon writer config invalid', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' },
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
      const values = [...safeValues];
      values[0] = crypto.randomUUID(); // fresh canonical Memory id
      return await runCreateWork(tx, workSignal, {
        ownerId,
        treeId: treeIdResult.value,
        parentId: parentId.value,
        clientKey: clientKeyResult.value,
        values
      });
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
        return createWorkResponse(error, workSignal, requestId);
      }
    }
    return sanitizeAdapterErrorResponse(error, requestId, 'transaction-failed');
  }

  const dto = result && typeof result === 'object' ? result.value : null;
  if (
    !dto
    || typeof dto.id !== 'string'
    || typeof dto.treeId !== 'string'
  ) {
    return jsonResponse(
      { error: 'Memory creation failed' },
      500,
      requestId,
      'no-memory-result'
    );
  }

  return jsonResponse(dto, 200, requestId, 'memory-create-complete');
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
    { error: 'Memory create direct-Neon transaction failed', code: sanitized.code },
    status,
    requestId,
    routeStatus
  );
}

export const MEMORY_CREATE_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'POST',
  path: '/api/memories',
  gateEnv: MEMORY_CREATE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: MEMORY_CREATE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: MEMORY_CREATE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: MEMORY_CREATE_FORBIDDEN_FALLBACK_ENVS,
  ownerAuthority: 'verified-firebase-legacyOwnerId',
  routeSplit: Object.freeze({
    explicitPublicOnly: 'direct-neon-candidate',
    omittedOrNullVisibility: 'modal-before-any-db-contact-parent-inheritance-may-be-private',
    explicitPrivate: 'modal-plus-entitlement-authority',
    otherVisibilityValues: 'modal-exact-validation-parity',
    gateUnsetOrModalOrUnknown: 'modal'
  }),
  routeSplitBeforeAuthKeepsModalErrorShapes: true,
  authBeforeDbCapabilityAcquisition: true,
  parentLock: 'FOR_KEY_SHARE_BEFORE_INSERT_3918_PARITY',
  clientKeyUniqueIndex: 'UNIQUE (tree_id, client_key)',
  clientKeyConflictStrategy: 'ON_CONFLICT_DO_NOTHING_THEN_CANONICAL_REREAD',
  clientKeySchemaNotActivated: 501,
  scalarValidationBeforeMutation: true,
  timestampProjection: 'created_at::text AS created_at, updated_at::text AS updated_at',
  responseFromCanonicalRereadOnly: true,
  lockOrder: 'NO_ADVISORY_LOCK_CURRENT_MODAL_PARITY',
  writes: true,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false
});
