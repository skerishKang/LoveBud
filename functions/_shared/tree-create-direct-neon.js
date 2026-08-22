// #4173 Phase-4 public Tree create Cloudflare -> Neon WebSocket interactive
// transaction candidate adapter.
//
// This is a gated MIGRATION CANDIDATE only. The Product Tree create route
// remains Modal-backed unless the route-specific gate is explicitly selected:
//
//   LB_TREE_CREATE_WRITE_RUNTIME=direct_neon
//
// unset / modal / unknown  -> existing Modal path (this adapter returns null)
// direct_neon             -> direct-Neon candidate for PUBLIC creation only
//
// Route split (decided BEFORE any direct DB connection or transaction):
//   omitted visibility        -> public direct-Neon candidate
//   explicit visibility=public -> public direct-Neon candidate
//   explicit visibility=private -> this adapter returns null so the route falls
//     through to the existing Modal authority; the Plus/private-storage
//     entitlement stays owned by Modal and no direct DB capability is acquired.
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
// (modal_compute/tree_writes.py::create_owner_tree). This adapter preserves the
// current writer sequence exactly:
//   - strict Tree scalar validation (#3935) BEFORE any owner-user upsert or
//     Tree INSERT: title (non-string 400 INVALID_TREE_SCALAR_TYPE, trim,
//     max 200 code points), groupName (non-string 400, trim, empty->null,
//     max 80 code points), keywords (array-only, string items, trim, empty
//     removed, order-preserving dedupe, max 5 items, max 24 code points each),
//     visibility (omitted/null -> 'public', 'public' allowed, anything else
//     400 'visibility: public, private');
//   - title default 'My LoveTree' when omitted/null/empty-after-trim;
//   - schema-capability-aware owner-user bootstrap inside the same
//     request-scoped transaction (fail closed on unknown required non-null
//     users columns; no fabricated values);
//   - INSERT INTO trees (...) VALUES ('public', ...) RETURNING with
//     created_at::text AS created_at / updated_at::text AS updated_at so pg
//     never coerces timestamptz into a JS Date (no precision loss);
//   - returned owner_id must equal the verified UID before commit;
//   - canonical owner-scoped reread whose owner_id must also equal the
//     verified UID before commit;
//   - work failure -> rollback; COMMIT ambiguity -> bounded 502, no blind
//     retry; sanitized errors; no token/DB URL/JWK/private leakage;
//   - response DTO { id, title, visibility, createdAt, updatedAt, memoryCount,
//     ownerId, groupName, keywords } built ONLY from canonical reread values.
//
// The current Modal Tree create writer has NO advisory lock, NO idempotency
// reservation, and NO audit/rate-limit writes; none are added here.
//
// This source child does NOT activate the Production route gate, does NOT
// mutate Production secrets/bindings or providers, does NOT change schema or
// GRANTs, does NOT migrate private Tree entitlement, and does NOT touch Tree
// update/delete or Memory/social write surfaces.

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
import { normalizeDirectNeonTimestamp } from './tree-fork-direct-neon.js';

export const TREE_CREATE_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_TREE_CREATE_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

// Forbidden generic/read DB envs must never satisfy the dedicated writer config.
export const TREE_CREATE_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

const TREE_TITLE_MAX = 200;
const TREE_GROUP_NAME_MAX = 80;
const TREE_KEYWORD_MAX = 24;
const TREE_KEYWORDS_MAX = 5;
const DEFAULT_TREE_TITLE = 'My LoveTree';

// ─── Gate / route selection ───────────────────────────────────────────────

export function isTreeCreateDirectNeonRequest(request) {
  if (!request || request.method.toUpperCase() !== 'POST') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return /^\/api\/trees$/.test(path);
}

export function isTreeCreateDirectNeonSelected(env = {}) {
  const value = typeof env?.[TREE_CREATE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[TREE_CREATE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === TREE_CREATE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

// ─── Dedicated writer config (no generic fallback) ───────────────────────

export function readTreeCreateWriteConfig(env = {}) {
  const dedicated = typeof env?.[TREE_CREATE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[TREE_CREATE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
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
  if (readTreeCreateWriteConfig(env).configured) return null;
  for (const name of TREE_CREATE_FORBIDDEN_FALLBACK_ENVS) {
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

// modal_compute/validation.py::validate_tree_title parity:
// None -> "" ; non-string -> 400 INVALID_TREE_SCALAR_TYPE(field=title,
// expected=string) ; string -> trim ; > 200 code points after trim -> 400.
export function normalizeTreeTitleInput(value) {
  if (value === null || value === undefined) {
    return { ok: true, value: '' };
  }
  if (typeof value !== 'string') {
    return {
      ok: false,
      status: 400,
      body: { error: 'Invalid tree scalar type', code: 'INVALID_TREE_SCALAR_TYPE', field: 'title', expected: 'string' },
      routeStatus: 'invalid-tree-title'
    };
  }
  const text = value.trim();
  if (codePointLength(text) > TREE_TITLE_MAX) {
    return {
      ok: false,
      status: 400,
      body: { error: `title exceeds max ${TREE_TITLE_MAX} characters` },
      routeStatus: 'tree-title-oversize'
    };
  }
  return { ok: true, value: text };
}

// modal_compute/validation.py::validate_tree_group_name parity:
// None -> null ; non-string -> 400 INVALID_TREE_SCALAR_TYPE(field=groupName) ;
// string -> trim ; empty -> null ; > 80 code points -> 400.
export function validateTreeGroupNameInput(value) {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return {
      ok: false,
      status: 400,
      body: { error: 'Invalid tree scalar type', code: 'INVALID_TREE_SCALAR_TYPE', field: 'groupName', expected: 'string' },
      routeStatus: 'invalid-group-name'
    };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (codePointLength(trimmed) > TREE_GROUP_NAME_MAX) {
    return {
      ok: false,
      status: 400,
      body: { error: `groupName exceeds max ${TREE_GROUP_NAME_MAX} characters` },
      routeStatus: 'group-name-oversize'
    };
  }
  return { ok: true, value: trimmed };
}

// modal_compute/validation.py::normalize_keywords parity:
// None -> [] ; non-array -> 400 'keywords must be an array' ; each item must be
// a string else 400 ; trim ; empty removed ; order-preserving dedupe ;
// item > 24 code points -> 400 ; more than 5 kept items -> 400.
export function normalizeTreeKeywordsInput(raw) {
  if (raw === null || raw === undefined) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      status: 400,
      body: { error: 'keywords must be an array' },
      routeStatus: 'invalid-keywords'
    };
  }
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      return {
        ok: false,
        status: 400,
        body: { error: 'each keyword must be a string' },
        routeStatus: 'invalid-keywords'
      };
    }
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (codePointLength(trimmed) > TREE_KEYWORD_MAX) {
      return {
        ok: false,
        status: 400,
        body: { error: `keyword '${trimmed.slice(0, 20)}...' exceeds max ${TREE_KEYWORD_MAX} characters` },
        routeStatus: 'invalid-keywords'
      };
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  if (result.length > TREE_KEYWORDS_MAX) {
    return {
      ok: false,
      status: 400,
      body: { error: `keywords exceeds max ${TREE_KEYWORDS_MAX}` },
      routeStatus: 'invalid-keywords'
    };
  }
  return { ok: true, value: result };
}

// normalize_group_name output parity on a stored DB value: non-string -> null,
// trim, empty -> null. Stored values are already normalized at input time.
function normalizeStoredGroupName(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

// normalize_tree_row(include_owner_metadata=True) keywords output parity:
// null -> [], otherwise [str(kw) for kw in raw_keywords if kw].
function normalizeStoredKeywords(raw) {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) return [];
  return raw.filter((kw) => kw).map((kw) => String(kw));
}

function normalizeStoredVisibility(value) {
  if (value === 'public') return 'public';
  if (value === 'private') return 'private';
  return null;
}

function normalizeCreatedTreeRow(row) {
  return {
    id: String(row.id),
    title: typeof row.title === 'string' ? row.title : '',
    visibility: normalizeStoredVisibility(row.visibility),
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at),
    memoryCount: intOrZero(row.memory_count),
    ownerId: row.owner_id ? String(row.owner_id) : null,
    groupName: normalizeStoredGroupName(row.group_name),
    keywords: normalizeStoredKeywords(row.keywords)
  };
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

// Owner-user upsert parity with ensure_owner_user_exists(uid, ''): email is
// users-table metadata only (never ownership); the direct candidate passes no
// caller email, so an existing row's email is never overwritten.
function buildOwnerUserInsert(columns, ownerId) {
  const insertColumns = ['id'];
  const values = ['$1'];
  const params = [ownerId];
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

// Work-callback errors must signal an HTTP status AND a bounded body. The
// #4132 adapter preserves `status` for NeonWsTransactionError instances when
// re-wrapping a work failure but reconstructs the error from its own fixed
// code vocabulary, so custom bodies do not survive the re-wrap. Create work
// therefore records its HTTP outcome on a request-local signal immediately
// before throwing; throwing still triggers the adapter's rollback path and the
// catch handler rebuilds the exact bounded body from the signal.
const CREATE_WORK_OUTCOME = Object.freeze({
  TREE_INSERT_EMPTY: 'tree-insert-empty',
  OWNER_BINDING_FAILED: 'owner-binding-failed',
  CANONICAL_MISSING: 'canonical-missing',
  USERS_SCHEMA_UNAVAILABLE: 'users-schema-unavailable'
});

function createWorkError(signal, outcome, status) {
  if (signal) signal.outcome = outcome;
  // Use a valid #4132 adapter code so it survives the re-wrap; the status is
  // preserved for NeonWsTransactionError instances. The outcome is recovered
  // from the signal, not the code.
  return new NeonWsTransactionError(
    NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
    'tree create work failed',
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
    case CREATE_WORK_OUTCOME.TREE_INSERT_EMPTY:
      return jsonResponse({ error: 'Tree creation failed' }, status, requestId, 'tree-insert-empty');
    case CREATE_WORK_OUTCOME.OWNER_BINDING_FAILED:
      // Fail closed before commit: never persist a tree whose returned or
      // reread owner_id does not exactly match the authenticated UID
      // (create_owner_tree parity).
      return jsonResponse({ error: 'Tree owner binding failed' }, status, requestId, 'owner-binding-failed');
    case CREATE_WORK_OUTCOME.CANONICAL_MISSING:
      return jsonResponse({ error: 'Tree creation failed' }, status, requestId, 'canonical-missing');
    case CREATE_WORK_OUTCOME.USERS_SCHEMA_UNAVAILABLE:
      return jsonResponse({ error: 'Owner user bootstrap unavailable' }, status, requestId, 'users-schema-unavailable');
    default:
      return jsonResponse({ error: 'Tree creation failed' }, status, requestId, 'tree-create-work-failed');
  }
}

// ─── Tree create transaction work ─────────────────────────────────────────

const INSERT_OWNER_TREE_SQL = `
INSERT INTO trees (id, owner_id, title, visibility, group_name, keywords, created_at, updated_at)
VALUES ($1, $2, $3, 'public', $4, $5, NOW(), NOW())
RETURNING id, owner_id, title, visibility, group_name, keywords,
          created_at::text AS created_at, updated_at::text AS updated_at;
`;

const CANONICAL_REREAD_CREATED_TREE_SQL = `
SELECT t.id, t.owner_id, t.title, t.visibility, t.group_name, t.keywords,
       t.created_at::text AS created_at, t.updated_at::text AS updated_at,
       COUNT(m.id)::int AS memory_count
FROM trees t
LEFT JOIN memories m ON m.tree_id = t.id
WHERE t.id = $1
  AND t.owner_id = $2
GROUP BY t.id, t.owner_id, t.title, t.visibility, t.group_name, t.keywords,
         t.created_at, t.updated_at
LIMIT 1;
`;

async function ensureOwnerUserExists(tx, signal, ownerId) {
  const schemaRows = await tx.query(USERS_SCHEMA_SQL, []);
  const columns = readUsersSchemaCapabilities(schemaRows);
  if (!columns.id || hasRequiredUnknownUsersColumns(columns)) {
    // Unknown required non-null users column -> fail closed rather than
    // fabricate data.
    throw createWorkError(signal, CREATE_WORK_OUTCOME.USERS_SCHEMA_UNAVAILABLE, 500);
  }
  const { sql, params } = buildOwnerUserInsert(columns, ownerId);
  await tx.query(sql, params);
}

async function runCreateWork(tx, signal, { ownerId, title, groupName, keywords }) {
  // A. Schema-capability-aware owner-user bootstrap inside the same
  // request-scoped transaction. All Tree scalar validation already happened
  // before the transaction started, so a malformed scalar can never trigger
  // an owner-row upsert or a Tree INSERT.
  await ensureOwnerUserExists(tx, signal, ownerId);

  // B. Tree INSERT ... RETURNING (canonical writer result authority), owned by
  // the verified principal. Text-cast timestamps keep PostgreSQL timestamp
  // text out of JS Date coercion (no precision loss).
  const newTreeId = crypto.randomUUID();
  const insertRows = await tx.query(INSERT_OWNER_TREE_SQL, [
    newTreeId,
    ownerId,
    title,
    groupName,
    keywords
  ]);
  const insertedTree = Array.isArray(insertRows) && insertRows.length ? insertRows[0] : null;
  if (!insertedTree) {
    throw createWorkError(signal, CREATE_WORK_OUTCOME.TREE_INSERT_EMPTY, 500);
  }

  // C. Fail closed before commit: the RETURNING owner_id must exactly match
  // the authenticated UID (create_owner_tree parity).
  if (String(insertedTree.owner_id || '') !== ownerId) {
    throw createWorkError(signal, CREATE_WORK_OUTCOME.OWNER_BINDING_FAILED, 500);
  }

  // D. Canonical reread scoped to the verified owner. Do not fabricate
  // canonical values solely from input; the reread owner must match too.
  const canonicalRows = await tx.canonicalReread(CANONICAL_REREAD_CREATED_TREE_SQL, [
    newTreeId,
    ownerId
  ]);
  const canonical = Array.isArray(canonicalRows) && canonicalRows.length ? canonicalRows[0] : null;
  if (!canonical) {
    throw createWorkError(signal, CREATE_WORK_OUTCOME.CANONICAL_MISSING, 500);
  }
  if (String(canonical.owner_id || '') !== ownerId) {
    throw createWorkError(signal, CREATE_WORK_OUTCOME.OWNER_BINDING_FAILED, 500);
  }

  return normalizeCreatedTreeRow(canonical);
}

// ─── Main handler ─────────────────────────────────────────────────────────

export async function handleTreeCreateDirectNeon(
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
  if (!isTreeCreateDirectNeonRequest(request) || !isTreeCreateDirectNeonSelected(env)) {
    // Default/unknown gate -> existing Modal path unchanged. Return null so the
    // gateway continues to the Modal-owned write route.
    return null;
  }

  // Auth FIRST: verify the Firebase principal before any body-dependent routing
  // decision, DB capability acquisition, or transaction start. transaction/
  // client calls = 0 and DB writes = 0 when auth is missing/malformed/invalid.
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

  // Bounded body read. The wired route reads the body once before dispatch and
  // passes the captured result here (a Request stream cannot be re-read);
  // standalone callers omit boundedBodyResult and the handler reads it itself.
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
      { error: 'Request body unavailable' },
      503,
      requestId,
      'body-unavailable'
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

  // Route split BEFORE any DB connection or transaction. Explicit private
  // visibility defers to the existing Modal authority (Plus/private-storage
  // entitlement stays Modal-owned): returning null sends the request back to
  // the route's unchanged Modal path with zero direct DB contact.
  const hasOwnVisibility = Object.prototype.hasOwnProperty.call(payload, 'visibility');
  const rawVisibility = hasOwnVisibility ? payload.visibility : undefined;
  if (rawVisibility === 'private') {
    return null;
  }
  let visibility;
  if (rawVisibility === undefined || rawVisibility === null || rawVisibility === 'public') {
    // validate_visibility(payload.get("visibility"), "public") parity.
    visibility = 'public';
  } else {
    return jsonResponse(
      { error: 'visibility: public, private' },
      400,
      requestId,
      'invalid-visibility'
    );
  }

  // Strict Tree scalar validation (#3935 parity) — ALL before any owner-user
  // upsert or Tree INSERT, so invalid input performs zero mutation.
  const titleResult = normalizeTreeTitleInput(payload.title);
  if (!titleResult.ok) {
    return jsonResponse(titleResult.body, titleResult.status, requestId, titleResult.routeStatus);
  }
  const safeTitle = titleResult.value || DEFAULT_TREE_TITLE;

  const groupNameResult = validateTreeGroupNameInput(payload.groupName);
  if (!groupNameResult.ok) {
    return jsonResponse(groupNameResult.body, groupNameResult.status, requestId, groupNameResult.routeStatus);
  }
  const safeGroupName = groupNameResult.value;

  const keywordsResult = normalizeTreeKeywordsInput(payload.keywords);
  if (!keywordsResult.ok) {
    return jsonResponse(keywordsResult.body, keywordsResult.status, requestId, keywordsResult.routeStatus);
  }
  const safeKeywords = keywordsResult.value;

  // Dedicated writer DB authority. No generic/read-only fallback.
  const config = readTreeCreateWriteConfig(env);
  if (!config.configured) {
    return jsonResponse(
      { error: 'Tree create direct-Neon runtime not configured', code: 'DIRECT_NEON_CONFIG_ABSENT' },
      503,
      requestId,
      'config-absent'
    );
  }

  const forbidden = detectForbiddenWriterFallback(env);
  if (forbidden) {
    return jsonResponse(
      { error: 'Tree create direct-Neon writer config invalid', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' },
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
      return await runCreateWork(tx, workSignal, {
        ownerId,
        title: safeTitle,
        groupName: safeGroupName,
        keywords: safeKeywords,
        visibility
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
    || typeof dto.ownerId !== 'string'
  ) {
    return jsonResponse(
      { error: 'Tree creation failed' },
      500,
      requestId,
      'no-tree-result'
    );
  }

  return jsonResponse(dto, 200, requestId, 'tree-create-complete');
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
    { error: 'Tree create direct-Neon transaction failed', code: sanitized.code },
    status,
    requestId,
    routeStatus
  );
}

export const TREE_CREATE_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'POST',
  path: '/api/trees',
  gateEnv: TREE_CREATE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: TREE_CREATE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: TREE_CREATE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: TREE_CREATE_FORBIDDEN_FALLBACK_ENVS,
  ownerAuthority: 'verified-firebase-legacyOwnerId',
  routeSplit: Object.freeze({
    omittedVisibility: 'direct-neon-public-candidate',
    explicitPublic: 'direct-neon-public-candidate',
    explicitPrivate: 'modal-before-any-db-connection-or-transaction',
    gateUnsetOrModalOrUnknown: 'modal'
  }),
  defaultTitle: DEFAULT_TREE_TITLE,
  defaultVisibility: 'public',
  titleMax: TREE_TITLE_MAX,
  groupNameMax: TREE_GROUP_NAME_MAX,
  keywordMax: TREE_KEYWORD_MAX,
  keywordsMax: TREE_KEYWORDS_MAX,
  scalarValidationBeforeOwnerUserUpsert: true,
  timestampProjection: 'created_at::text AS created_at, updated_at::text AS updated_at',
  lockOrder: 'NO_ADVISORY_LOCK_CURRENT_MODAL_PARITY',
  idempotencyReservation: false,
  rateLimitWrite: false,
  auditWrite: false,
  writes: true,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false,
  responseFields: Object.freeze([
    'id', 'title', 'visibility', 'createdAt', 'updatedAt',
    'memoryCount', 'ownerId', 'groupName', 'keywords'
  ])
});
