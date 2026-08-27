// #4237 Phase-4 owner appreciation-order POST Cloudflare -> Neon WebSocket
// transaction source candidate.
//
// Firebase remains the Product identity authority. Only POST requests with the
// exact LB_APPRECIATION_ORDER_WRITE_RUNTIME=direct_neon gate enter this helper;
// default/unset/modal/unknown routing stays on the existing catch-all -> Modal
// path. This source candidate does not authorize Production writer privileges,
// provider/secret mutation, gate activation, schema/data mutation, or auth cutover.

import { readBoundedRequestBody } from './bounded-request-body.js';
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
  FirebaseReadPrincipalError,
  buildFirebaseReadPrincipalErrorResponse,
  resolveFirebaseReadPrincipal
} from '../../workers/love-platform-api/firebase-read-principal.js';
import {
  buildInvalidPathEncodingResponse,
  isInvalidPathEncodingError,
  normalizeEncodedPathSegment
} from './path-segment.js';

export const APPRECIATION_ORDER_DIRECT_NEON_RUNTIME = Object.freeze({
  GATE_FLAG: 'LB_APPRECIATION_ORDER_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

export const APPRECIATION_ORDER_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

export const APPRECIATION_ORDER_MAX_ITEMS = 500;

const APPRECIATION_ORDER_PATH = /^\/api\/trees\/([^/]+)\/appreciation-order$/;

export const APPRECIATION_ORDER_OWNER_SQL = `
SELECT t.id::text AS id, t.owner_id::text AS owner_id
FROM trees t
WHERE t.id = $1
LIMIT 1
FOR SHARE OF t;
`;

export const APPRECIATION_ORDER_MEMBERSHIP_SQL = `
SELECT m.id::text AS id
FROM memories m
WHERE m.tree_id = $1
  AND m.id = ANY($2)
FOR SHARE OF m;
`;

export const APPRECIATION_ORDER_UPSERT_SQL = `
INSERT INTO tree_appreciation_orders (tree_id, ordered_ids, updated_at)
VALUES ($1, $2::jsonb, NOW())
ON CONFLICT (tree_id)
DO UPDATE SET ordered_ids = EXCLUDED.ordered_ids, updated_at = NOW()
RETURNING ordered_ids;
`;

class AppreciationOrderPayloadError extends Error {
  constructor(detail) {
    super('appreciation order payload invalid');
    this.name = 'AppreciationOrderPayloadError';
    this.detail = detail;
  }
}

function directHeaders(requestId, routeStatus = null) {
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
    headers: directHeaders(requestId, routeStatus)
  });
}

function withDirectHeaders(response, requestId, routeStatus = null) {
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
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function isAppreciationOrderDirectNeonSelected(env = {}) {
  const value = typeof env?.[APPRECIATION_ORDER_DIRECT_NEON_RUNTIME.GATE_FLAG] === 'string'
    ? env[APPRECIATION_ORDER_DIRECT_NEON_RUNTIME.GATE_FLAG].trim()
    : '';
  return value === APPRECIATION_ORDER_DIRECT_NEON_RUNTIME.DIRECT_NEON_VALUE;
}

export function isAppreciationOrderDirectNeonWriteRequest(request) {
  if (!request || request.method.toUpperCase() !== 'POST') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return APPRECIATION_ORDER_PATH.test(path);
}

export function readAppreciationOrderWriteConfig(env = {}) {
  const raw = typeof env?.[APPRECIATION_ORDER_DIRECT_NEON_RUNTIME.DATABASE_URL] === 'string'
    ? env[APPRECIATION_ORDER_DIRECT_NEON_RUNTIME.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(raw);
  return Object.freeze({
    configured,
    connectionString: configured ? raw : ''
  });
}

export function detectAppreciationOrderForbiddenFallback(env = {}) {
  if (readAppreciationOrderWriteConfig(env).configured) return null;
  for (const name of APPRECIATION_ORDER_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonWsConnectionString(raw)) return Object.freeze({ name });
  }
  return null;
}

function extractAppreciationOrderTreeId(request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const match = path.match(APPRECIATION_ORDER_PATH);
  if (!match) return null;
  const normalized = normalizeEncodedPathSegment(match[1]);
  return normalized ? decodeURIComponent(normalized) : null;
}

export function validateAppreciationOrderPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppreciationOrderPayloadError({
      code: 'APPRECIATION_ORDER_OBJECT_REQUIRED'
    });
  }

  if (!Object.hasOwn(payload, 'order')) {
    throw new AppreciationOrderPayloadError({
      code: 'APPRECIATION_ORDER_REQUIRED',
      field: 'order'
    });
  }

  const unknownFields = Object.keys(payload)
    .filter((key) => key !== 'order')
    .sort();
  if (unknownFields.length) {
    throw new AppreciationOrderPayloadError({
      code: 'APPRECIATION_ORDER_UNKNOWN_FIELD',
      fields: unknownFields
    });
  }

  const { order } = payload;
  if (!Array.isArray(order)) {
    throw new AppreciationOrderPayloadError('order must be an array');
  }
  if (order.length > APPRECIATION_ORDER_MAX_ITEMS) {
    throw new AppreciationOrderPayloadError(
      `order exceeds max ${APPRECIATION_ORDER_MAX_ITEMS} items`
    );
  }

  const seen = new Set();
  const normalized = [];
  for (let index = 0; index < order.length; index += 1) {
    const item = order[index];
    if (typeof item !== 'string' || !item.trim()) {
      throw new AppreciationOrderPayloadError(
        `order[${index}] must be a non-empty string memoryId`
      );
    }
    const memoryId = item.trim();
    if (seen.has(memoryId)) {
      throw new AppreciationOrderPayloadError(
        `Duplicate memoryId in order: ${memoryId}`
      );
    }
    seen.add(memoryId);
    normalized.push(memoryId);
  }

  return Object.freeze([...normalized]);
}

async function readPayload(request) {
  const result = await readBoundedRequestBody(request);
  if (result.status !== 'ok') return result;
  if (result.body === null) {
    return { status: 'ok', payload: null };
  }
  try {
    const text = new TextDecoder().decode(result.body);
    return { status: 'ok', payload: JSON.parse(text) };
  } catch {
    return { status: 'invalidJson', payload: null };
  }
}

function makeWorkFailure(signal, status, detail, routeStatus) {
  signal.http = Object.freeze({ status, detail, routeStatus });
  return new NeonWsTransactionError(
    NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
    'appreciation order work failed',
    { status }
  );
}

function failWork(signal, status, detail, routeStatus) {
  throw makeWorkFailure(signal, status, detail, routeStatus);
}

async function runAppreciationOrderWork(tx, signal, { treeId, ownerId, order }) {
  const ownerRows = await tx.forShare(APPRECIATION_ORDER_OWNER_SQL, [treeId]);
  const tree = Array.isArray(ownerRows) && ownerRows.length ? ownerRows[0] : null;
  if (!tree) {
    failWork(signal, 404, 'Tree not found', 'tree-not-found');
  }
  if (String(tree.owner_id || '') !== ownerId) {
    failWork(signal, 403, 'Access denied: not your tree', 'not-owner');
  }

  if (order.length) {
    const membershipRows = await tx.forShare(
      APPRECIATION_ORDER_MEMBERSHIP_SQL,
      [treeId, order]
    );
    const foundIds = new Set(
      (Array.isArray(membershipRows) ? membershipRows : [])
        .map((row) => String(row?.id || ''))
        .filter(Boolean)
    );
    const missing = order.filter((memoryId) => !foundIds.has(memoryId));
    if (missing.length) {
      failWork(
        signal,
        400,
        'order contains memories not belonging to this tree',
        'membership-invalid'
      );
    }
  }

  const upsertRows = await tx.query(APPRECIATION_ORDER_UPSERT_SQL, [
    treeId,
    JSON.stringify(order)
  ]);
  const row = Array.isArray(upsertRows) && upsertRows.length ? upsertRows[0] : null;
  if (!row || !Array.isArray(row.ordered_ids)) {
    failWork(
      signal,
      500,
      { code: 'APPRECIATION_ORDER_STORAGE_INVALID' },
      'storage-invalid'
    );
  }

  return Object.freeze({
    orderedIds: Object.freeze(row.ordered_ids.map((memoryId) => String(memoryId)))
  });
}

function adapterErrorResponse(error, requestId, routeStatus = 'transaction-failed') {
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
      error: 'Appreciation order direct-Neon transaction failed',
      code: sanitized.code,
      wholeTransactionRetrySafe: false
    },
    sanitized.status || 500,
    requestId,
    routeStatus
  );
}

export async function handleAppreciationOrderDirectNeon(
  request,
  env = {},
  requestId = null,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null
  } = {}
) {
  if (
    !isAppreciationOrderDirectNeonWriteRequest(request)
    || !isAppreciationOrderDirectNeonSelected(env)
  ) {
    return null;
  }

  // Preserve catch-all path authority: malformed encoding fails before auth,
  // body materialization, or database capability acquisition.
  let treeId;
  try {
    treeId = extractAppreciationOrderTreeId(request);
  } catch (error) {
    if (isInvalidPathEncodingError(error)) {
      return buildInvalidPathEncodingResponse(requestId);
    }
    throw error;
  }
  if (!treeId) {
    return jsonResponse({ detail: 'Tree not found' }, 404, requestId, 'tree-not-found');
  }

  let principal;
  try {
    const verifyToken = verifyTokenOverride || createFirebaseIdTokenVerifier({
      projectId: readFirebaseProjectId(env)
    });
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

  const bodyResult = await readPayload(request);
  if (bodyResult.status === 'tooLarge') {
    return jsonResponse(
      { error: 'Payload too large' },
      413,
      requestId,
      'payload-too-large'
    );
  }
  if (bodyResult.status === 'readError') {
    return jsonResponse(
      { error: 'Request body read failed' },
      400,
      requestId,
      'body-read-failed'
    );
  }
  if (bodyResult.status === 'invalidJson') {
    return jsonResponse(
      { detail: { code: 'APPRECIATION_ORDER_OBJECT_REQUIRED' } },
      400,
      requestId,
      'invalid-json'
    );
  }

  let order;
  try {
    order = validateAppreciationOrderPayload(bodyResult.payload);
  } catch (error) {
    if (error instanceof AppreciationOrderPayloadError) {
      return jsonResponse(
        { detail: error.detail },
        400,
        requestId,
        'payload-invalid'
      );
    }
    return jsonResponse(
      { detail: 'Internal server error' },
      500,
      requestId,
      'payload-validation-failed'
    );
  }

  const config = readAppreciationOrderWriteConfig(env);
  if (!config.configured && !transactionAdapterOverride) {
    const forbidden = detectAppreciationOrderForbiddenFallback(env);
    return jsonResponse(
      forbidden
        ? {
            error: 'Appreciation order direct-Neon writer config invalid',
            code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK'
          }
        : {
            error: 'Appreciation order direct-Neon runtime not configured',
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
      return adapterErrorResponse(error, requestId, 'adapter-init');
    }
  }

  const signal = { http: null };
  let result;
  try {
    result = await adapter.runTransaction(async (tx) => {
      return runAppreciationOrderWork(tx, signal, {
        treeId,
        ownerId: principal.legacyOwnerId,
        order
      });
    });
  } catch (error) {
    if (
      error instanceof NeonWsTransactionError
      && error.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN
    ) {
      return adapterErrorResponse(error, requestId);
    }
    if (
      signal.http
      && error instanceof NeonWsTransactionError
      && error.code === NEON_WS_TRANSACTION_ERROR.WORK_FAILURE
    ) {
      return jsonResponse(
        { detail: signal.http.detail },
        signal.http.status,
        requestId,
        signal.http.routeStatus
      );
    }
    return adapterErrorResponse(error, requestId);
  }

  const dto = result && typeof result === 'object' ? result.value : null;
  if (!dto || !Array.isArray(dto.orderedIds)) {
    return jsonResponse(
      { detail: { code: 'APPRECIATION_ORDER_STORAGE_INVALID' } },
      500,
      requestId,
      'storage-invalid'
    );
  }

  return jsonResponse(
    { orderedIds: dto.orderedIds.map((memoryId) => String(memoryId)) },
    200,
    requestId,
    'saved'
  );
}

export const APPRECIATION_ORDER_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'POST',
  path: '/api/trees/:id/appreciation-order',
  gate: APPRECIATION_ORDER_DIRECT_NEON_RUNTIME.GATE_FLAG,
  directValue: APPRECIATION_ORDER_DIRECT_NEON_RUNTIME.DIRECT_NEON_VALUE,
  databaseUrlEnv: APPRECIATION_ORDER_DIRECT_NEON_RUNTIME.DATABASE_URL,
  ownerAuthority: 'principal.legacyOwnerId',
  firebaseOnly: true,
  maxOrderItems: APPRECIATION_ORDER_MAX_ITEMS,
  transaction: true,
  ownerLock: 'FOR SHARE OF t',
  memoryMembershipLock: 'FOR SHARE OF m',
  modalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false,
  productionWritePrivilegeAuthorized: false,
  productionGateActivationAuthorized: false
});
