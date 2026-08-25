// #4217 Phase-4 Hub Layout PUT Cloudflare -> Neon WebSocket transaction candidate.
//
// This module is a gated source candidate only. Default/unset/modal/unknown
// routing remains the existing Cloudflare -> Modal path. The direct candidate
// accepts only PUT /api/trees/:id/hub-layout and preserves the current Modal
// ownership, payload-validation, revision-conflict, and advisory-lock semantics.
//
// Production gate activation, writer secret/role creation, schema/provider
// mutation, and deployment cutover are explicitly out of scope.

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
import {
  buildInvalidPathEncodingResponse,
  isInvalidPathEncodingError,
  normalizeEncodedPathSegment
} from './path-segment.js';

export const HUB_LAYOUT_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_HUB_LAYOUT_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

export const HUB_LAYOUT_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

export const HUB_LAYOUT_MAX_POSITIONS = 500;
export const HUB_LAYOUT_MAX_POSITION_VALUE = 1_000_000;

const HUB_LAYOUT_PATH = /^\/api\/trees\/([^/]+)\/hub-layout$/;
const HUB_LAYOUT_LOCK_SQL = 'SELECT pg_advisory_xact_lock($1)';
const OWNER_TREE_SQL = `
SELECT id, owner_id
FROM trees
WHERE id = $1
LIMIT 1;
`;
const LATEST_REVISION_SQL = `
SELECT revision
FROM tree_hub_layouts
WHERE tree_id = $1
ORDER BY revision DESC
LIMIT 1;
`;
const INSERT_LAYOUT_SQL = `
INSERT INTO tree_hub_layouts (
  id, tree_id, revision, layout_mode, manual_positions, created_at, updated_at
)
VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
RETURNING revision, updated_at::text AS updated_at;
`;

const HUB_LAYOUT_WORK_OUTCOME = Object.freeze({
  TREE_NOT_FOUND: 'tree-not-found',
  NOT_OWNER: 'not-owner',
  REVISION_CONFLICT: 'revision-conflict',
  INSERT_EMPTY: 'insert-empty',
  REVISION_INVALID: 'revision-invalid'
});

class HubLayoutPayloadError extends Error {
  constructor(status, detail, routeStatus) {
    super(typeof detail === 'string' ? detail : 'Hub layout payload invalid');
    this.name = 'HubLayoutPayloadError';
    this.status = status;
    this.detail = detail;
    this.routeStatus = routeStatus;
  }
}

export function isHubLayoutDirectNeonWriteRequest(request) {
  if (!request || request.method.toUpperCase() !== 'PUT') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return HUB_LAYOUT_PATH.test(path);
}

export function isHubLayoutDirectNeonSelected(env = {}) {
  const value = typeof env?.[HUB_LAYOUT_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[HUB_LAYOUT_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === HUB_LAYOUT_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

export function readHubLayoutWriteConfig(env = {}) {
  const raw = typeof env?.[HUB_LAYOUT_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[HUB_LAYOUT_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(raw);
  return Object.freeze({
    configured,
    connectionString: configured ? raw : ''
  });
}

export function detectHubLayoutForbiddenWriterFallback(env = {}) {
  if (readHubLayoutWriteConfig(env).configured) return null;
  for (const name of HUB_LAYOUT_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonWsConnectionString(raw)) return name;
  }
  return null;
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

async function withDirectHeaders(response, requestId, routeStatus = null) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-lovebud-upstream', 'direct-neon');
  headers.set('x-lovebud-runtime', 'direct_neon');
  if (routeStatus) headers.set('x-lovebud-route-status', routeStatus);
  if (requestId) {
    headers.set('x-lovebud-request-id', requestId);
    const exposed = headers.get('Access-Control-Expose-Headers') || '';
    if (!exposed.toLowerCase().includes('x-lovebud-request-id')) {
      headers.set(
        'Access-Control-Expose-Headers',
        exposed ? `${exposed}, x-lovebud-request-id` : 'x-lovebud-request-id'
      );
    }
  }
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function extractHubLayoutTreeId(request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const match = path.match(HUB_LAYOUT_PATH);
  if (!match) return null;
  const normalized = normalizeEncodedPathSegment(match[1]);
  return normalized ? decodeURIComponent(normalized) : null;
}

async function parseBoundedJsonObject(request, requestId) {
  const bodyResult = await readBoundedRequestBody(request);
  if (bodyResult.status === 'tooLarge') {
    return {
      response: jsonResponse(
        { error: 'Request body too large' },
        413,
        requestId,
        'payload-too-large'
      )
    };
  }
  if (bodyResult.status === 'readError') {
    return {
      response: jsonResponse(
        { error: 'Request body read failed' },
        503,
        requestId,
        'body-read-failed'
      )
    };
  }

  if (!bodyResult.body || bodyResult.body.byteLength === 0) {
    return { payload: {} };
  }

  let payload;
  try {
    const text = new TextDecoder().decode(bodyResult.body);
    payload = JSON.parse(text);
  } catch {
    return {
      response: jsonResponse(
        { detail: 'Invalid JSON body' },
        400,
        requestId,
        'invalid-json'
      )
    };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      response: jsonResponse(
        { detail: { code: 'JSON_OBJECT_REQUIRED' } },
        400,
        requestId,
        'json-object-required'
      )
    };
  }

  return { payload };
}

function requireFiniteCoordinate(value, typeDetail, rangeDetail) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HubLayoutPayloadError(
      400,
      typeDetail,
      'invalid-manual-positions'
    );
  }
  if (Math.abs(value) > HUB_LAYOUT_MAX_POSITION_VALUE) {
    throw new HubLayoutPayloadError(
      400,
      rangeDetail,
      'invalid-manual-positions'
    );
  }
}

export function validateHubLayoutPayload(payload) {
  const baseRevision = payload?.baseRevision;
  if (baseRevision === undefined || baseRevision === null) {
    throw new HubLayoutPayloadError(400, 'baseRevision is required', 'invalid-base-revision');
  }
  if (!Number.isInteger(baseRevision) || baseRevision < 0) {
    throw new HubLayoutPayloadError(
      400,
      'baseRevision must be a non-negative integer',
      'invalid-base-revision'
    );
  }

  const rawMode = payload.layoutMode;
  const layoutMode = rawMode === undefined || rawMode === null ? 'manual' : rawMode;
  if (typeof layoutMode !== 'string' || !['manual', 'auto'].includes(layoutMode)) {
    throw new HubLayoutPayloadError(
      400,
      "layoutMode must be 'manual' or 'auto'",
      'invalid-layout-mode'
    );
  }

  const rawPositions = payload.manualPositions === undefined
    ? []
    : payload.manualPositions;
  if (!Array.isArray(rawPositions)) {
    throw new HubLayoutPayloadError(
      400,
      'manualPositions must be an array',
      'invalid-manual-positions'
    );
  }
  if (rawPositions.length > HUB_LAYOUT_MAX_POSITIONS) {
    throw new HubLayoutPayloadError(
      400,
      `manualPositions exceeds max ${HUB_LAYOUT_MAX_POSITIONS} items`,
      'invalid-manual-positions'
    );
  }

  const seen = new Set();
  for (let index = 0; index < rawPositions.length; index += 1) {
    const item = rawPositions[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HubLayoutPayloadError(
        400,
        `manualPositions[${index}] must be an object`,
        'invalid-manual-positions'
      );
    }

    const memoryId = item.memoryId;
    if (typeof memoryId !== 'string' || !memoryId.trim()) {
      throw new HubLayoutPayloadError(
        400,
        `manualPositions[${index}].memoryId is required`,
        'invalid-manual-positions'
      );
    }
    if (seen.has(memoryId)) {
      throw new HubLayoutPayloadError(
        400,
        `Duplicate memoryId in manualPositions: ${memoryId}`,
        'invalid-manual-positions'
      );
    }
    seen.add(memoryId);

    const position = item.position;
    if (!position || typeof position !== 'object' || Array.isArray(position)) {
      throw new HubLayoutPayloadError(
        400,
        `manualPositions[${index}].position must be an object`,
        'invalid-manual-positions'
      );
    }
    if (position.x === undefined || position.y === undefined) {
      throw new HubLayoutPayloadError(
        400,
        `manualPositions[${index}].position must have x and y`,
        'invalid-manual-positions'
      );
    }

    const coordinateTypeDetail =
      `manualPositions[${index}].position x and y must be numbers`;
    const coordinateRangeDetail =
      `manualPositions[${index}].position coordinates exceed limit of ${HUB_LAYOUT_MAX_POSITION_VALUE}`;
    requireFiniteCoordinate(
      position.x,
      coordinateTypeDetail,
      coordinateRangeDetail
    );
    requireFiniteCoordinate(
      position.y,
      coordinateTypeDetail,
      coordinateRangeDetail
    );
  }

  return Object.freeze({
    baseRevision,
    layoutMode,
    manualPositions: rawPositions
  });
}

export async function computeHubLayoutLockKey(treeId) {
  const encoded = new TextEncoder().encode(`hub-layout:${treeId}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoded));
  let value = 0n;
  for (let index = 0; index < 8; index += 1) {
    value = (value << 8n) | BigInt(digest[index]);
  }
  if (value >= 0x8000000000000000n) {
    value -= 0x10000000000000000n;
  }
  return value;
}

export function normalizeHubLayoutTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    throw new TypeError('HUB_LAYOUT_TIMESTAMP_PRECISION_LOST');
  }
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

function hubLayoutWorkError(signal, outcome, status) {
  signal.outcome = outcome;
  return new NeonWsTransactionError(
    NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
    'hub layout work failed',
    { status }
  );
}

function isHubLayoutWorkError(error, signal) {
  return Boolean(
    signal?.outcome
    && error instanceof NeonWsTransactionError
    && error.code === NEON_WS_TRANSACTION_ERROR.WORK_FAILURE
  );
}

function hubLayoutWorkErrorResponse(error, signal, requestId) {
  const outcome = signal.outcome;
  if (outcome === HUB_LAYOUT_WORK_OUTCOME.TREE_NOT_FOUND) {
    return jsonResponse({ detail: 'Tree not found' }, 404, requestId, 'tree-not-found');
  }
  if (outcome === HUB_LAYOUT_WORK_OUTCOME.NOT_OWNER) {
    return jsonResponse(
      { detail: 'Access denied: not your tree' },
      403,
      requestId,
      'not-owner'
    );
  }
  if (outcome === HUB_LAYOUT_WORK_OUTCOME.REVISION_CONFLICT) {
    return jsonResponse(
      { detail: 'Conflict: baseRevision does not match the latest revision' },
      409,
      requestId,
      'revision-conflict'
    );
  }

  const sanitized = sanitizeNeonWsTransactionError(error);
  return jsonResponse(
    {
      error: 'Hub layout save failed',
      code: sanitized.code
    },
    sanitized.status || 500,
    requestId,
    'hub-layout-save-failed'
  );
}

function sanitizeAdapterErrorResponse(error, requestId, routeStatus) {
  const sanitized = sanitizeNeonWsTransactionError(error);
  return jsonResponse(
    {
      error: 'Hub layout direct-Neon transaction failed',
      code: sanitized.code,
      commitOutcome: sanitized.commit_outcome,
      wholeTransactionRetrySafe: false
    },
    sanitized.status || 500,
    requestId,
    routeStatus
  );
}

async function runHubLayoutSaveWork(
  tx,
  signal,
  { treeId, ownerId, lockKey, validated }
) {
  // Current Modal parity: ownership is checked before the Hub Layout semantic
  // advisory lock. Keep the same order while using the request-scoped
  // transaction client.
  const ownerRows = await tx.query(OWNER_TREE_SQL, [treeId]);
  const tree = Array.isArray(ownerRows) && ownerRows.length ? ownerRows[0] : null;
  if (!tree) {
    throw hubLayoutWorkError(signal, HUB_LAYOUT_WORK_OUTCOME.TREE_NOT_FOUND, 404);
  }
  if (String(tree.owner_id || '') !== ownerId) {
    throw hubLayoutWorkError(signal, HUB_LAYOUT_WORK_OUTCOME.NOT_OWNER, 403);
  }

  // Cross-runtime lock identity MUST match modal_compute/hub_layouts.py:
  // SHA-256("hub-layout:" + treeId), first 8 bytes, signed big-endian int64.
  // The generic #4132 hashtext helper is intentionally not used.
  await tx.query(HUB_LAYOUT_LOCK_SQL, [lockKey]);

  const revisionRows = await tx.query(LATEST_REVISION_SQL, [treeId]);
  const latestRow = Array.isArray(revisionRows) && revisionRows.length
    ? revisionRows[0]
    : null;
  const latestRevision = latestRow ? Number(latestRow.revision) : 0;
  if (!Number.isInteger(latestRevision) || latestRevision < 0) {
    throw hubLayoutWorkError(signal, HUB_LAYOUT_WORK_OUTCOME.REVISION_INVALID, 500);
  }

  if (validated.baseRevision !== latestRevision) {
    throw hubLayoutWorkError(signal, HUB_LAYOUT_WORK_OUTCOME.REVISION_CONFLICT, 409);
  }

  const newRevision = latestRevision + 1;
  const insertRows = await tx.query(INSERT_LAYOUT_SQL, [
    crypto.randomUUID(),
    treeId,
    newRevision,
    validated.layoutMode,
    JSON.stringify(validated.manualPositions)
  ]);
  const inserted = Array.isArray(insertRows) && insertRows.length
    ? insertRows[0]
    : null;
  if (!inserted) {
    throw hubLayoutWorkError(signal, HUB_LAYOUT_WORK_OUTCOME.INSERT_EMPTY, 500);
  }

  const returnedRevision = Number(inserted.revision);
  if (!Number.isInteger(returnedRevision) || returnedRevision !== newRevision) {
    throw hubLayoutWorkError(signal, HUB_LAYOUT_WORK_OUTCOME.REVISION_INVALID, 500);
  }

  return Object.freeze({
    revision: returnedRevision,
    updatedAt: normalizeHubLayoutTimestamp(inserted.updated_at),
    positions: validated.manualPositions
  });
}

export async function handleHubLayoutDirectNeon(
  request,
  env = {},
  requestId = null,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null
  } = {}
) {
  if (!isHubLayoutDirectNeonWriteRequest(request) || !isHubLayoutDirectNeonSelected(env)) {
    return null;
  }

  // Preserve the existing catch-all path-encoding boundary: malformed dynamic
  // segments are rejected before auth/body/DB work.
  let treeId;
  try {
    treeId = extractHubLayoutTreeId(request);
  } catch (error) {
    if (isInvalidPathEncodingError(error)) {
      return buildInvalidPathEncodingResponse(requestId);
    }
    throw error;
  }
  if (!treeId) {
    return jsonResponse(
      { detail: 'Tree not found' },
      404,
      requestId,
      'tree-not-found'
    );
  }

  // Auth still precedes body materialization and every database/transaction
  // boundary.
  let verifyToken = verifyTokenOverride;
  let principal;
  try {
    if (typeof verifyToken !== 'function') {
      verifyToken = createFirebaseIdTokenVerifier({
        projectId: readFirebaseProjectId(env)
      });
    }
    principal = await resolveFirebaseReadPrincipal(request, verifyToken);
  } catch (error) {
    if (error instanceof FirebaseReadPrincipalError) {
      return withDirectHeaders(
        buildFirebaseReadPrincipalErrorResponse(error, request),
        requestId,
        'auth-failed'
      );
    }
    return jsonResponse(
      { error: 'Authentication verifier unavailable' },
      503,
      requestId,
      'verifier-unavailable'
    );
  }

  const parsed = await parseBoundedJsonObject(request, requestId);
  if (parsed.response) return parsed.response;

  let validated;
  try {
    validated = validateHubLayoutPayload(parsed.payload);
  } catch (error) {
    if (error instanceof HubLayoutPayloadError) {
      return jsonResponse(
        { detail: error.detail },
        error.status,
        requestId,
        error.routeStatus
      );
    }
    throw error;
  }

  const config = readHubLayoutWriteConfig(env);
  if (!config.configured) {
    const forbidden = detectHubLayoutForbiddenWriterFallback(env);
    return jsonResponse(
      forbidden
        ? {
            error: 'Hub layout direct-Neon writer config invalid',
            code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK'
          }
        : {
            error: 'Hub layout direct-Neon runtime not configured',
            code: 'DIRECT_NEON_CONFIG_ABSENT'
          },
      503,
      requestId,
      forbidden ? 'config-forbidden-fallback' : 'config-absent'
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
  if (!adapter || typeof adapter.runTransaction !== 'function') {
    return jsonResponse(
      {
        error: 'Hub layout direct-Neon transaction adapter unavailable',
        code: 'TRANSACTION_ADAPTER_UNAVAILABLE'
      },
      503,
      requestId,
      'adapter-unavailable'
    );
  }

  const lockKey = await computeHubLayoutLockKey(treeId);
  const workSignal = { outcome: undefined };
  let result;
  try {
    result = await adapter.runTransaction((tx) =>
      runHubLayoutSaveWork(tx, workSignal, {
        treeId,
        ownerId: principal.legacyOwnerId,
        lockKey,
        validated
      })
    );
  } catch (error) {
    if (isHubLayoutWorkError(error, workSignal)) {
      return hubLayoutWorkErrorResponse(error, workSignal, requestId);
    }
    return sanitizeAdapterErrorResponse(error, requestId, 'transaction-failed');
  }

  const value = result?.value;
  if (!value || !Number.isInteger(value.revision)) {
    return jsonResponse(
      { error: 'Hub layout save failed' },
      500,
      requestId,
      'hub-layout-save-failed'
    );
  }

  return jsonResponse(value, 200, requestId, 'saved');
}
