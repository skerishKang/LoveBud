// #4232 Phase-4 owner Memory update Cloudflare -> Neon WebSocket transaction candidate.
//
// Gated source candidate for PUT /api/memories/:id only. Firebase remains the
// Product identity authority and principal.legacyOwnerId is the sole owner key.
// Default/modal/unknown routing stays Modal-backed. Explicit visibility=private
// is returned to Modal before any direct DB capability so the existing
// Plus/private-storage entitlement remains authoritative.
//
// This source does not activate Production routing, mutate provider bindings,
// change DB grants, perform schema/data migration, or migrate Memory DELETE.

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
import {
  validateRequiredUuid,
  validateOptionalMemoryString,
  validateEmotionTags
} from './memory-create-direct-neon.js';
import { normalizeDirectNeonTimestamp } from './tree-fork-direct-neon.js';
import { REQUEST_ID_HEADER } from './request-id.js';

export const MEMORY_UPDATE_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_MEMORY_UPDATE_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

export const MEMORY_UPDATE_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

const ALLOWED_UPDATE_FIELDS = Object.freeze([
  'title',
  'memo',
  'artist',
  'source',
  'sourceUrl',
  'sourceType',
  'thumbnail',
  'emotionTags',
  'timestamp',
  'visibility',
  'channelId',
  'channelName',
  'channelUrl',
  'parentId'
]);
const ALLOWED_UPDATE_SET = new Set(ALLOWED_UPDATE_FIELDS);

const FIELD_LIMITS = Object.freeze({
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

const SOURCE_ACK_FIELDS = Object.freeze([
  Object.freeze(['source', 'source']),
  Object.freeze(['sourceUrl', 'source_url']),
  Object.freeze(['sourceType', 'source_type']),
  Object.freeze(['thumbnail', 'thumbnail'])
]);

const OWNER_CHECK_SQL = `
SELECT m.id::text AS id,
       m.tree_id::text AS tree_id,
       m.parent_id::text AS parent_id,
       t.owner_id::text AS tree_owner_id
FROM memories m
INNER JOIN trees t ON t.id = m.tree_id
WHERE m.id = $1
LIMIT 1;
`;

const REPARENT_SOURCE_SQL = `
SELECT m.id::text AS id,
       m.tree_id::text AS tree_id,
       m.parent_id::text AS parent_id,
       m.visibility,
       t.owner_id::text AS tree_owner_id
FROM memories m
INNER JOIN trees t ON t.id = m.tree_id
WHERE m.id = $1
LIMIT 1;
`;

const REPARENT_TARGET_SQL = `
SELECT id::text AS id, tree_id::text AS tree_id, parent_id::text AS parent_id
FROM memories
WHERE id = $1;
`;

const ANCESTOR_SQL = `
SELECT parent_id::text AS parent_id
FROM memories
WHERE id = $1;
`;

export function isMemoryUpdateDirectNeonSelected(env = {}) {
  const value = typeof env?.[MEMORY_UPDATE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[MEMORY_UPDATE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === MEMORY_UPDATE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

export function readMemoryUpdateWriteConfig(env = {}) {
  const dedicated = typeof env?.[MEMORY_UPDATE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[MEMORY_UPDATE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(dedicated);
  return Object.freeze({ configured, connectionString: configured ? dedicated : '' });
}

export function detectMemoryUpdateForbiddenWriterFallback(env = {}) {
  if (readMemoryUpdateWriteConfig(env).configured) return null;
  for (const name of MEMORY_UPDATE_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonWsConnectionString(raw)) return Object.freeze({ name });
  }
  return null;
}

function requestWithId(request, requestId) {
  if (!requestId || request.headers.get(REQUEST_ID_HEADER)) return request;
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Request(request.url, { method: request.method, headers });
}

function responseHeaders(requestId, routeStatus = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon'
  };
  if (routeStatus) headers['x-lovebud-route-status'] = routeStatus;
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
    headers['Access-Control-Expose-Headers'] = REQUEST_ID_HEADER;
  }
  return headers;
}

function jsonResponse(body, status, requestId, routeStatus = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(requestId, routeStatus)
  });
}

function workFailure(signal, status, body, routeStatus) {
  signal.http = Object.freeze({ status, body, routeStatus });
  throw new NeonWsTransactionError(
    NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
    'memory update work failed',
    { status }
  );
}

function validateScalar(value, field, { emptyToNull = false } = {}) {
  return validateOptionalMemoryString(value, field, {
    max: FIELD_LIMITS[field],
    emptyToNull
  });
}

function normalizeStoredEmotionTags(raw) {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map((item) => String(item));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map((item) => String(item)) : [];
    } catch {
      return raw ? [raw] : [];
    }
  }
  return [];
}

function normalizeStoredVisibility(value) {
  if (value === 'public') return 'public';
  if (value === 'private') return 'private';
  return null;
}

function normalizeMemoryRow(row) {
  return Object.freeze({
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
  });
}

function validateUpdatePayloadAfterOwner(payload, signal) {
  const unknownFields = Object.keys(payload)
    .filter((key) => !ALLOWED_UPDATE_SET.has(key))
    .sort();
  if (unknownFields.length) {
    workFailure(signal, 400, {
      detail: {
        code: 'UNSUPPORTED_MEMORY_UPDATE_FIELDS',
        fields: unknownFields
      }
    }, 'unsupported-memory-update-fields');
  }
  if (Object.keys(payload).length === 0) {
    workFailure(signal, 400, {
      detail: { code: 'EMPTY_MEMORY_UPDATE' }
    }, 'empty-memory-update');
  }

  const assignments = [];
  const values = [];
  const normalizedRequested = {};
  let reparentTarget = null;

  function add(column, value) {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  }

  for (const field of ['title', 'memo', 'source', 'sourceUrl', 'sourceType', 'thumbnail', 'channelId', 'channelName', 'channelUrl', 'artist', 'timestamp']) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;
    const emptyToNull = ['channelId', 'channelName', 'channelUrl'].includes(field);
    const result = validateScalar(payload[field], field, { emptyToNull });
    if (!result.ok) {
      workFailure(signal, result.status, result.body, result.routeStatus);
    }
    let value = result.value;
    if (field === 'sourceType' && !value) value = 'youtube';
    const column = {
      sourceUrl: 'source_url',
      sourceType: 'source_type',
      channelId: 'channel_id',
      channelName: 'channel_name',
      channelUrl: 'channel_url'
    }[field] || field;
    add(column, value);
    if (SOURCE_ACK_FIELDS.some(([requestField]) => requestField === field)) {
      normalizedRequested[field] = value ?? '';
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'emotionTags')) {
    const result = validateEmotionTags(payload.emotionTags);
    if (!result.ok) {
      workFailure(signal, result.status, result.body, result.routeStatus);
    }
    add('emotion_tags', result.value);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'visibility')) {
    if (typeof payload.visibility !== 'string' || payload.visibility !== 'public') {
      workFailure(signal, 400, { detail: 'visibility: public, private' }, 'invalid-visibility');
    }
    add('visibility', 'public');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'parentId')) {
    const rawParent = payload.parentId;
    if (rawParent === null || (typeof rawParent === 'string' && rawParent.trim() === '')) {
      assignments.push('parent_id = NULL');
    } else {
      const result = validateRequiredUuid(rawParent, 'parentId');
      if (!result.ok) {
        workFailure(signal, result.status, result.body, result.routeStatus);
      }
      reparentTarget = result.value;
      add('parent_id', reparentTarget);
    }
  }

  if (!assignments.length) {
    workFailure(signal, 400, { detail: { code: 'EMPTY_MEMORY_UPDATE' } }, 'empty-memory-update');
  }

  return Object.freeze({
    assignments: Object.freeze(assignments),
    values: Object.freeze(values),
    normalizedRequested: Object.freeze(normalizedRequested),
    reparentTarget
  });
}

export async function computeMemoryParentLockKey(treeId) {
  const encoded = new TextEncoder().encode(`memory-parent-graph:${treeId}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoded));
  let value = 0n;
  for (let index = 0; index < 8; index += 1) {
    value = (value << 8n) | BigInt(digest[index]);
  }
  if (value >= 0x8000000000000000n) value -= 0x10000000000000000n;
  return value;
}

async function validateReparentLocked(tx, signal, sourceId, parentId, ownerId) {
  if (parentId === sourceId) {
    workFailure(signal, 400, {
      detail: { code: 'INVALID_PARENT_ID', reason: 'self_parent' }
    }, 'invalid-parent-id');
  }

  const sourceRows = await tx.query(REPARENT_SOURCE_SQL, [sourceId]);
  const source = Array.isArray(sourceRows) && sourceRows.length ? sourceRows[0] : null;
  if (!source) {
    workFailure(signal, 404, { detail: 'Memory not found' }, 'memory-not-found');
  }
  if (String(source.tree_owner_id || '') !== ownerId) {
    workFailure(signal, 403, { detail: 'Access denied: not your memory' }, 'memory-owner-forbidden');
  }

  const targetRows = await tx.query(REPARENT_TARGET_SQL, [parentId]);
  const target = Array.isArray(targetRows) && targetRows.length ? targetRows[0] : null;
  if (!target) {
    workFailure(signal, 400, {
      detail: { code: 'INVALID_PARENT_ID', reason: 'not_found' }
    }, 'invalid-parent-id');
  }
  if (String(target.tree_id || '') !== String(source.tree_id || '')) {
    workFailure(signal, 400, {
      detail: { code: 'PARENT_MEMORY_TREE_MISMATCH' }
    }, 'parent-tree-mismatch');
  }

  const visited = new Set();
  let current = parentId;
  while (current) {
    if (visited.has(current) || current === sourceId) {
      workFailure(signal, 400, { detail: { code: 'PARENT_CYCLE' } }, 'parent-cycle');
    }
    visited.add(current);
    const rows = await tx.query(ANCESTOR_SQL, [current]);
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row || !row.parent_id) break;
    current = String(row.parent_id);
  }
}

function enforceSourceAck(payload, row, normalizedRequested, signal) {
  for (const [requestField, dbColumn] of SOURCE_ACK_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, requestField)) continue;
    const requested = normalizedRequested[requestField] ?? '';
    const persisted = row?.[dbColumn] || (dbColumn === 'source_type' ? 'youtube' : '');
    if (requested !== persisted) {
      workFailure(signal, 409, {
        detail: {
          code: 'SOURCE_WRITE_ACK_DIVERGENCE',
          field: requestField,
          classification: 'STALE_SOURCE_ACKNOWLEDGEMENT'
        }
      }, 'source-write-ack-divergence');
    }
  }
}

async function runUpdateWork(tx, signal, { memoryId, ownerId, payload }) {
  // Preserve Modal's owner-first ordering before update allowlist/scalar checks.
  const ownerRows = await tx.query(OWNER_CHECK_SQL, [memoryId]);
  const ownerRow = Array.isArray(ownerRows) && ownerRows.length ? ownerRows[0] : null;
  if (!ownerRow) {
    workFailure(signal, 404, { detail: 'Memory not found' }, 'memory-not-found');
  }
  if (String(ownerRow.tree_owner_id || '') !== ownerId) {
    workFailure(signal, 403, { detail: 'Access denied: not your memory' }, 'memory-owner-forbidden');
  }

  const update = validateUpdatePayloadAfterOwner(payload, signal);

  if (update.reparentTarget !== null) {
    // The transaction-local owner row is the authoritative pre-lock source row.
    const authoritativeTreeId = String(ownerRow.tree_id || '');
    const lockKey = await computeMemoryParentLockKey(authoritativeTreeId);
    await tx.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
    await validateReparentLocked(tx, signal, memoryId, update.reparentTarget, ownerId);
  }

  const memoryPlaceholder = update.values.length + 1;
  const ownerPlaceholder = update.values.length + 2;
  const updateSql = `
UPDATE memories
SET ${update.assignments.join(', ')}, updated_at = NOW()
WHERE id = $${memoryPlaceholder}
  AND EXISTS (
    SELECT 1
    FROM trees t
    WHERE t.id = memories.tree_id
      AND t.owner_id = $${ownerPlaceholder}
  )
RETURNING id::text AS id,
          tree_id::text AS tree_id,
          parent_id::text AS parent_id,
          title, memo, artist, source, source_url, source_type, thumbnail,
          emotion_tags, timestamp, visibility,
          channel_id, channel_name, channel_url,
          created_at::text AS created_at,
          updated_at::text AS updated_at;
`;
  const rows = await tx.query(updateSql, [...update.values, memoryId, ownerId]);
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  if (!row) {
    workFailure(signal, 404, { detail: 'Memory not found' }, 'memory-not-found');
  }

  // #3922: this is intentionally inside work(), before adapter COMMIT.
  enforceSourceAck(payload, row, update.normalizedRequested, signal);

  try {
    return normalizeMemoryRow(row);
  } catch {
    workFailure(signal, 500, { detail: 'Internal server error' }, 'memory-normalization-failed');
  }
}

function sanitizeAdapterErrorResponse(error, requestId, routeStatus) {
  const sanitized = sanitizeNeonWsTransactionError(error);
  if (sanitized.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN) {
    return jsonResponse(
      {
        error: 'Transaction commit outcome unknown',
        code: 'COMMIT_OUTCOME_UNKNOWN',
        commitOutcome: 'unknown',
        wholeTransactionRetrySafe: false
      },
      502,
      requestId,
      'commit-outcome-unknown'
    );
  }
  return jsonResponse(
    {
      error: 'Memory update direct-Neon transaction failed',
      code: sanitized.code
    },
    Number.isInteger(sanitized.status) ? sanitized.status : 500,
    requestId,
    routeStatus
  );
}

export async function handleMemoryUpdateDirectNeon(
  request,
  memoryId,
  env = {},
  requestId = null,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null,
    boundedBodyResult = null
  } = {}
) {
  if (!isMemoryUpdateDirectNeonSelected(env)) return null;

  // Match owner-write authority: verified Firebase principal precedes JSON parse
  // and every direct DB capability acquisition.
  const authRequest = requestWithId(request, requestId);
  let verifyToken = verifyTokenOverride;
  if (typeof verifyToken !== 'function') {
    verifyToken = createFirebaseIdTokenVerifier({ projectId: readFirebaseProjectId(env) });
  }

  let principal;
  try {
    principal = await resolveFirebaseReadPrincipal(authRequest, verifyToken);
  } catch (error) {
    if (error instanceof FirebaseReadPrincipalError) {
      return buildFirebaseReadPrincipalErrorResponse(error, authRequest);
    }
    return jsonResponse(
      { error: 'Authentication verifier unavailable' },
      503,
      requestId,
      'verifier-unavailable'
    );
  }

  let bodyResult = boundedBodyResult;
  if (!bodyResult || typeof bodyResult !== 'object') {
    try {
      bodyResult = await readBoundedRequestBody(request);
    } catch {
      return jsonResponse({ error: 'Request body could not be read' }, 503, requestId, 'body-read-failed');
    }
  }
  if (bodyResult.status === 'tooLarge') {
    return jsonResponse({ error: 'Request body too large' }, 413, requestId, 'payload-too-large');
  }
  if (bodyResult.status === 'readError') {
    return jsonResponse({ error: 'Request body could not be read' }, 503, requestId, 'body-read-failed');
  }

  let payload;
  const raw = bodyResult.body ? new TextDecoder().decode(bodyResult.body) : '';
  if (!raw) {
    payload = {};
  } else {
    try {
      payload = JSON.parse(raw);
    } catch {
      return jsonResponse({ detail: 'Invalid JSON body' }, 400, requestId, 'invalid-json-body');
    }
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return jsonResponse({ detail: { code: 'JSON_OBJECT_REQUIRED' } }, 400, requestId, 'json-object-required');
    }
  }

  // Existing Cloudflare write-boundary guard runs before Modal owner mutation.
  const guard = validateWritePayload(payload, ['title', 'memo']);
  if (guard) {
    let guardBody = {};
    try {
      guardBody = JSON.parse(await guard.text());
    } catch { /* bounded fallback */ }
    return jsonResponse(
      Object.keys(guardBody).length ? guardBody : { error: 'legacy localization key not allowed' },
      400,
      requestId,
      'legacy-localization-key'
    );
  }

  // Exact private update stays on Modal/Plus before direct DB capability.
  if (Object.prototype.hasOwnProperty.call(payload, 'visibility') && payload.visibility === 'private') {
    return null;
  }

  const idResult = validateRequiredUuid(memoryId, 'memoryId');
  if (!idResult.ok) {
    return jsonResponse(idResult.body, idResult.status, requestId, idResult.routeStatus);
  }

  if (detectMemoryUpdateForbiddenWriterFallback(env)) {
    return jsonResponse(
      { error: 'Memory update direct-Neon writer config invalid', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' },
      503,
      requestId,
      'config-forbidden-fallback'
    );
  }
  const config = readMemoryUpdateWriteConfig(env);
  if (!config.configured) {
    return jsonResponse(
      { error: 'Memory update direct-Neon runtime not configured', code: 'DIRECT_NEON_CONFIG_ABSENT' },
      503,
      requestId,
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
      return sanitizeAdapterErrorResponse(error, requestId, 'adapter-init');
    }
  }

  const signal = { http: null };
  let result;
  try {
    result = await adapter.runTransaction(async (tx) => {
      return runUpdateWork(tx, signal, {
        memoryId: idResult.value,
        ownerId: principal.legacyOwnerId,
        payload
      });
    });
  } catch (error) {
    if (error instanceof NeonWsTransactionError) {
      if (error.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN) {
        return sanitizeAdapterErrorResponse(error, requestId, 'commit-outcome-unknown');
      }
      if (signal.http) {
        return jsonResponse(
          signal.http.body,
          signal.http.status,
          requestId,
          signal.http.routeStatus
        );
      }
    }
    return sanitizeAdapterErrorResponse(error, requestId, 'transaction-failed');
  }

  const dto = result && typeof result === 'object' ? result.value : null;
  if (!dto || typeof dto.id !== 'string') {
    return jsonResponse({ detail: 'Internal server error' }, 500, requestId, 'no-memory-result');
  }
  return jsonResponse(dto, 200, requestId, 'memory-update-complete');
}

export const MEMORY_UPDATE_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'PUT',
  path: '/api/memories/:id',
  gateEnv: MEMORY_UPDATE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: MEMORY_UPDATE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: MEMORY_UPDATE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: MEMORY_UPDATE_FORBIDDEN_FALLBACK_ENVS,
  ownerAuthority: 'verified-firebase-legacyOwnerId',
  allowedFields: ALLOWED_UPDATE_FIELDS,
  clientKeyMutable: false,
  explicitPrivate: 'modal-before-direct-db',
  getUnchanged: true,
  deleteUnchanged: true,
  sourceAckBeforeCommit: true,
  reparentLockIdentity: 'sha256-int64:memory-parent-graph:<treeId>',
  productionGateActivationAuthorized: false,
  providerMutationAuthorized: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false,
  perRequestModalFallbackAfterDirectStart: false
});