// #4234 Phase-4 owner Memory DELETE Cloudflare -> Neon WebSocket transaction candidate.
//
// Firebase remains the Product identity authority and principal.legacyOwnerId is
// the sole owner authority. Default/modal/unknown routing remains Modal-backed.
// This source candidate does not activate Production DELETE privileges, mutate
// provider bindings/secrets, or change the canonical schema/dependency graph.

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
import { validateRequiredUuid } from './memory-create-direct-neon.js';
import { REQUEST_ID_HEADER } from './request-id.js';

export const MEMORY_DELETE_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_MEMORY_DELETE_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

export const MEMORY_DELETE_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

export function isMemoryDeleteDirectNeonSelected(env = {}) {
  const value = typeof env?.[MEMORY_DELETE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[MEMORY_DELETE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === MEMORY_DELETE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

export function readMemoryDeleteWriteConfig(env = {}) {
  const dedicated = typeof env?.[MEMORY_DELETE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[MEMORY_DELETE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(dedicated);
  return Object.freeze({ configured, connectionString: configured ? dedicated : '' });
}

export function detectMemoryDeleteForbiddenWriterFallback(env = {}) {
  if (readMemoryDeleteWriteConfig(env).configured) return null;
  for (const name of MEMORY_DELETE_FORBIDDEN_FALLBACK_ENVS) {
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
    'memory delete work failed',
    { status }
  );
}

const OWNER_CHECK_SQL = `
SELECT m.id::text AS id,
       m.tree_id::text AS tree_id,
       t.owner_id::text AS tree_owner_id
FROM memories m
INNER JOIN trees t ON t.id = m.tree_id
WHERE m.id = $1
LIMIT 1;
`;

const CLEAR_CHILD_PARENT_SQL = `
UPDATE memories
SET parent_id = NULL
WHERE tree_id = $1
  AND parent_id = $2;
`;

const DELETE_MEMORY_SQL = `
DELETE FROM memories
WHERE id = $1
  AND EXISTS (
    SELECT 1
    FROM trees t
    WHERE t.id = memories.tree_id
      AND t.owner_id = $2
  )
RETURNING id::text AS id;
`;

async function runDeleteWork(tx, signal, { memoryId, ownerId }) {
  // Preserve Modal owner-first behavior while keeping ownership, child cleanup,
  // and destructive work inside one request-scoped transaction.
  const ownerRows = await tx.query(OWNER_CHECK_SQL, [memoryId]);
  const ownerRow = Array.isArray(ownerRows) && ownerRows.length ? ownerRows[0] : null;
  if (!ownerRow) {
    workFailure(signal, 404, { detail: 'Memory not found' }, 'memory-not-found');
  }
  if (String(ownerRow.tree_owner_id || '') !== ownerId) {
    workFailure(signal, 403, { detail: 'Access denied: not your memory' }, 'memory-owner-forbidden');
  }

  const authoritativeTreeId = String(ownerRow.tree_id || '');
  if (!authoritativeTreeId) {
    workFailure(signal, 500, { detail: 'Internal server error' }, 'memory-tree-authority-missing');
  }

  // Exact current Modal sequence: detach direct children in this same Tree,
  // then owner-predicated DELETE. Do not invent optional child-table cleanup.
  await tx.query(CLEAR_CHILD_PARENT_SQL, [authoritativeTreeId, memoryId]);
  const deletedRows = await tx.query(DELETE_MEMORY_SQL, [memoryId, ownerId]);
  const deleted = Array.isArray(deletedRows) && deletedRows.length ? deletedRows[0] : null;
  if (!deleted || typeof deleted.id !== 'string' || !deleted.id) {
    workFailure(signal, 404, { detail: 'Memory not found' }, 'memory-not-found');
  }

  return Object.freeze({
    deleted: true,
    id: deleted.id,
    treeId: authoritativeTreeId
  });
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
      error: 'Memory delete direct-Neon transaction failed',
      code: sanitized.code
    },
    Number.isInteger(sanitized.status) ? sanitized.status : 500,
    requestId,
    routeStatus
  );
}

export async function handleMemoryDeleteDirectNeon(
  request,
  memoryId,
  env = {},
  requestId = null,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null
  } = {}
) {
  if (!isMemoryDeleteDirectNeonSelected(env)) return null;

  // Firebase verification precedes every direct DB capability acquisition.
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

  const idResult = validateRequiredUuid(memoryId, 'memoryId');
  if (!idResult.ok) {
    return jsonResponse(idResult.body, idResult.status, requestId, idResult.routeStatus);
  }

  if (detectMemoryDeleteForbiddenWriterFallback(env)) {
    return jsonResponse(
      { error: 'Memory delete direct-Neon writer config invalid', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' },
      503,
      requestId,
      'config-forbidden-fallback'
    );
  }
  const config = readMemoryDeleteWriteConfig(env);
  if (!config.configured) {
    return jsonResponse(
      { error: 'Memory delete direct-Neon runtime not configured', code: 'DIRECT_NEON_CONFIG_ABSENT' },
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
      return runDeleteWork(tx, signal, {
        memoryId: idResult.value,
        ownerId: principal.legacyOwnerId
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
  if (!dto || dto.deleted !== true || typeof dto.id !== 'string' || !dto.id || typeof dto.treeId !== 'string' || !dto.treeId) {
    return jsonResponse({ detail: 'Internal server error' }, 500, requestId, 'no-delete-result');
  }
  return jsonResponse(dto, 200, requestId, 'memory-delete-complete');
}

export const MEMORY_DELETE_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'DELETE',
  path: '/api/memories/:id',
  gateEnv: MEMORY_DELETE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: MEMORY_DELETE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: MEMORY_DELETE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: MEMORY_DELETE_FORBIDDEN_FALLBACK_ENVS,
  ownerAuthority: 'verified-firebase-legacyOwnerId',
  modalDeleteSequence: Object.freeze([
    'owner-check-authoritative-tree-id',
    'clear-child-parent-id-same-tree',
    'delete-owner-memory-returning-id'
  ]),
  getUnchanged: true,
  putUnchanged: true,
  productionDeletePrivilegeAuthorized: false,
  productionGateActivationAuthorized: false,
  providerMutationAuthorized: false,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false
});
