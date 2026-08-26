// #4230 Phase-4 owner Tree DELETE Cloudflare -> Neon WebSocket transaction candidate.
//
// Firebase remains the Product identity authority and principal.legacyOwnerId is
// the sole owner authority. Default/modal/unknown routing remains Modal-backed.
// This source candidate intentionally does not activate Production DELETE
// privileges or change the canonical dependency graph.

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
import { normalizeOwnerTreeDetailId } from './owner-tree-detail-direct-neon.js';
import { REQUEST_ID_HEADER } from './request-id.js';

export const TREE_DELETE_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_TREE_DELETE_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

export const TREE_DELETE_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

export function isTreeDeleteDirectNeonSelected(env = {}) {
  const value = typeof env?.[TREE_DELETE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[TREE_DELETE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === TREE_DELETE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

export function readTreeDeleteWriteConfig(env = {}) {
  const dedicated = typeof env?.[TREE_DELETE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[TREE_DELETE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(dedicated);
  return Object.freeze({
    configured,
    connectionString: configured ? dedicated : ''
  });
}

export function detectTreeDeleteForbiddenWriterFallback(env = {}) {
  if (readTreeDeleteWriteConfig(env).configured) return null;
  for (const name of TREE_DELETE_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonWsConnectionString(raw)) return Object.freeze({ name });
  }
  return null;
}

function requestWithId(request, requestId) {
  if (!requestId || request.headers.get(REQUEST_ID_HEADER)) return request;
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Request(request.url, {
    method: request.method,
    headers
  });
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

function makeWorkFailure(signal, status, body, routeStatus) {
  signal.http = Object.freeze({ status, body, routeStatus });
  return new NeonWsTransactionError(
    NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
    'tree delete work failed',
    { status }
  );
}

function failWork(signal, status, detail, routeStatus) {
  throw makeWorkFailure(signal, status, { detail }, routeStatus);
}

const OWNER_CHECK_SQL = `
SELECT id::text AS id, owner_id::text AS owner_id
FROM trees
WHERE id = $1
LIMIT 1;
`;

const CLEAR_MEMORY_PARENT_SQL = `
UPDATE memories
SET parent_id = NULL
WHERE tree_id = $1
  AND parent_id IS NOT NULL;
`;

const DELETE_MEMORIES_SQL = `
DELETE FROM memories
WHERE tree_id = $1;
`;

const DELETE_TREE_SQL = `
DELETE FROM trees
WHERE id = $1
  AND owner_id = $2
RETURNING id::text AS id;
`;

async function runDeleteWork(tx, signal, { treeId, ownerId }) {
  // Preserve current Modal ordering: require_tree_owner precedes all destructive
  // statements. The check and all deletes now share one request transaction.
  const ownerRows = await tx.query(OWNER_CHECK_SQL, [treeId]);
  const ownerRow = Array.isArray(ownerRows) && ownerRows.length ? ownerRows[0] : null;
  if (!ownerRow) {
    failWork(signal, 404, 'Tree not found', 'tree-not-found');
  }
  if (String(ownerRow.owner_id || '') !== ownerId) {
    failWork(signal, 403, 'Access denied: not your tree', 'tree-owner-forbidden');
  }

  // Exact current Modal delete sequence. Do not add optional child-table cleanup
  // here; live Production dependency/FK readiness is a separate provider gate.
  await tx.query(CLEAR_MEMORY_PARENT_SQL, [treeId]);
  await tx.query(DELETE_MEMORIES_SQL, [treeId]);
  const deletedRows = await tx.query(DELETE_TREE_SQL, [treeId, ownerId]);
  const deleted = Array.isArray(deletedRows) && deletedRows.length ? deletedRows[0] : null;
  if (!deleted || typeof deleted.id !== 'string' || !deleted.id) {
    failWork(signal, 404, 'Tree not found', 'tree-not-found');
  }

  return Object.freeze({ deleted: true, id: deleted.id });
}

function sanitizeAdapterErrorResponse(error, requestId, routeStatus) {
  const sanitized = sanitizeNeonWsTransactionError(error);
  if (sanitized.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN) {
    return jsonResponse(
      { error: 'Transaction commit outcome unknown', code: 'COMMIT_OUTCOME_UNKNOWN' },
      502,
      requestId,
      'commit-outcome-unknown'
    );
  }
  const status = Number.isInteger(sanitized.status) ? sanitized.status : 500;
  return jsonResponse(
    { error: 'Tree delete direct-Neon transaction failed', code: sanitized.code },
    status,
    requestId,
    routeStatus
  );
}

export async function handleTreeDeleteDirectNeon(
  request,
  treeId,
  env = {},
  requestId = null,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null
  } = {}
) {
  if (!isTreeDeleteDirectNeonSelected(env)) return null;

  // Verified Firebase principal must be established before DB configuration or
  // client acquisition. Caller-supplied IDs and metadata never become authority.
  const authRequest = requestWithId(request, requestId);
  let verifyToken = verifyTokenOverride;
  if (typeof verifyToken !== 'function') {
    verifyToken = createFirebaseIdTokenVerifier({
      projectId: readFirebaseProjectId(env)
    });
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

  if (typeof treeId !== 'string' || !treeId.trim()) {
    return jsonResponse({ detail: 'treeId is required' }, 400, requestId, 'invalid-tree-id');
  }
  const safeTreeId = normalizeOwnerTreeDetailId(treeId);
  if (!safeTreeId) {
    return jsonResponse({ detail: 'Invalid treeId' }, 400, requestId, 'invalid-tree-id');
  }

  const config = readTreeDeleteWriteConfig(env);
  if (!config.configured) {
    const forbidden = detectTreeDeleteForbiddenWriterFallback(env);
    if (forbidden) {
      return jsonResponse(
        { error: 'Tree delete direct-Neon writer config invalid', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' },
        503,
        requestId,
        'config-forbidden-fallback'
      );
    }
    return jsonResponse(
      { error: 'Tree delete direct-Neon runtime not configured', code: 'DIRECT_NEON_CONFIG_ABSENT' },
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
      return await runDeleteWork(tx, signal, {
        treeId: safeTreeId,
        ownerId: principal.legacyOwnerId
      });
    });
  } catch (error) {
    if (error instanceof NeonWsTransactionError) {
      if (error.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN) {
        return jsonResponse(
          { error: 'Transaction commit outcome unknown', code: 'COMMIT_OUTCOME_UNKNOWN' },
          502,
          requestId,
          'commit-outcome-unknown'
        );
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
  if (!dto || dto.deleted !== true || typeof dto.id !== 'string' || !dto.id) {
    return jsonResponse({ detail: 'Internal server error' }, 500, requestId, 'no-delete-result');
  }
  return jsonResponse(dto, 200, requestId, 'tree-delete-complete');
}

export const TREE_DELETE_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'DELETE',
  path: '/api/trees/:id',
  gateEnv: TREE_DELETE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: TREE_DELETE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: TREE_DELETE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: TREE_DELETE_FORBIDDEN_FALLBACK_ENVS,
  ownerAuthority: 'verified-firebase-legacyOwnerId',
  modalDeleteSequence: Object.freeze([
    'owner-check',
    'clear-memory-parent-id',
    'delete-memories',
    'delete-owner-tree-returning-id'
  ]),
  getUnchanged: true,
  putUnchanged: true,
  productionDeletePrivilegeAuthorized: false,
  productionGateActivationAuthorized: false,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false
});
