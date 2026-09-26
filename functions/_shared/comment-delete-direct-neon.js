// #4492 source-only candidate: generic self Comment DELETE from Cloudflare to
// Neon through the existing request-scoped WebSocket transaction adapter.
//
// Default/modal/unknown routing remains Modal-backed. This file does not
// authorize Production gate activation, DB/ACL/provider mutation, or Product
// traffic. Firebase remains the Product identity authority.
//
// Behavioral parity authority:
//   modal_compute/comments.py::soft_delete_own_comment
//
// Required ordering:
//   verified Firebase principal
//   -> validated comment UUID
//   -> dedicated writer config
//   -> comment lookup / author check
//   -> idempotent already-non-visible return OR soft-delete update
//   -> social audit
//   -> COMMIT
//
// After direct execution starts there is no per-request fallback to Modal.
// COMMIT ambiguity is explicit and must never be blindly retried.

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

export const COMMENT_DELETE_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_COMMENT_DELETE_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

export const COMMENT_DELETE_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

export function isCommentDeleteDirectNeonSelected(env = {}) {
  const raw = typeof env?.[COMMENT_DELETE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[COMMENT_DELETE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return raw === COMMENT_DELETE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

export function readCommentDeleteWriteConfig(env = {}) {
  const dedicated = typeof env?.[COMMENT_DELETE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[COMMENT_DELETE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(dedicated);
  return Object.freeze({
    configured,
    connectionString: configured ? dedicated : ''
  });
}

export function detectCommentDeleteForbiddenWriterFallback(env = {}) {
  if (readCommentDeleteWriteConfig(env).configured) return null;
  for (const name of COMMENT_DELETE_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonWsConnectionString(raw)) {
      return Object.freeze({ name });
    }
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

function failWork(signal, status, message, routeStatus) {
  signal.http = Object.freeze({
    status,
    body: {
      error: message,
      code: 'SOCIAL_WRITE_UNAVAILABLE'
    },
    routeStatus
  });
  throw new NeonWsTransactionError(
    NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
    'comment delete work failed',
    { status }
  );
}

const COMMENT_LOOKUP_SQL = `
SELECT id::text AS id,
       owner_id::text AS owner_id,
       memory_id::text AS memory_id,
       COALESCE(status, 'visible') AS status,
       deleted_at
FROM comments
WHERE id = $1
LIMIT 1;
`;

const COMMENT_SOFT_DELETE_SQL = `
UPDATE comments
SET status = 'deleted',
    deleted_at = NOW(),
    deleted_by = $1
WHERE id = $2;
`;

const COMMENT_AUDIT_SQL = `
INSERT INTO social_audit_log
    (id, actor_id, memory_id, action, outcome_code, request_key_hash, created_at)
VALUES ($1, $2, $3, 'comment.soft_delete', 'success', NULL, NOW());
`;

async function runCommentDeleteWork(tx, signal, { commentId, actorId }) {
  const rows = await tx.query(COMMENT_LOOKUP_SQL, [commentId]);
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;

  if (!row) {
    failWork(signal, 404, 'Comment not found', 'comment-not-found');
  }

  if (String(row.owner_id || '') !== actorId) {
    failWork(
      signal,
      403,
      'Only the comment author can delete this comment',
      'comment-author-forbidden'
    );
  }

  const status = String(row.status || 'visible');
  if (status !== 'visible') {
    return Object.freeze({ id: commentId, status });
  }

  const memoryId = String(row.memory_id || '');
  if (!memoryId) {
    failWork(
      signal,
      500,
      'Comment write service is temporarily unavailable',
      'comment-memory-authority-missing'
    );
  }

  await tx.query(COMMENT_SOFT_DELETE_SQL, [actorId, commentId]);
  await tx.query(COMMENT_AUDIT_SQL, [
    crypto.randomUUID(),
    actorId,
    memoryId
  ]);

  return Object.freeze({ id: commentId, status: 'deleted' });
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
      error: 'Comment delete direct-Neon transaction failed',
      code: sanitized.code
    },
    Number.isInteger(sanitized.status) ? sanitized.status : 500,
    requestId,
    routeStatus
  );
}

export async function handleCommentDeleteDirectNeon(
  request,
  commentId,
  env = {},
  requestId = null,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null
  } = {}
) {
  if (!isCommentDeleteDirectNeonSelected(env)) return null;

  // Authentication precedes DB configuration/capability acquisition.
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

  const idResult = validateRequiredUuid(commentId, 'commentId');
  if (!idResult.ok) {
    return jsonResponse(
      idResult.body,
      idResult.status,
      requestId,
      idResult.routeStatus
    );
  }

  if (detectCommentDeleteForbiddenWriterFallback(env)) {
    return jsonResponse(
      {
        error: 'Comment delete direct-Neon writer config invalid',
        code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK'
      },
      503,
      requestId,
      'config-forbidden-fallback'
    );
  }

  const config = readCommentDeleteWriteConfig(env);
  if (!config.configured) {
    return jsonResponse(
      {
        error: 'Comment delete direct-Neon runtime not configured',
        code: 'DIRECT_NEON_CONFIG_ABSENT'
      },
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
      return await runCommentDeleteWork(tx, signal, {
        commentId: idResult.value,
        actorId: principal.legacyOwnerId
      });
    });
  } catch (error) {
    if (error instanceof NeonWsTransactionError) {
      if (error.code === NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN) {
        return sanitizeAdapterErrorResponse(
          error,
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
    return sanitizeAdapterErrorResponse(
      error,
      requestId,
      'transaction-failed'
    );
  }

  const dto = result && typeof result === 'object' ? result.value : null;
  if (
    !dto
    || dto.id !== idResult.value
    || typeof dto.status !== 'string'
    || !dto.status
  ) {
    return jsonResponse(
      { error: 'Comment write service is temporarily unavailable', code: 'SOCIAL_WRITE_UNAVAILABLE' },
      500,
      requestId,
      'no-delete-result'
    );
  }

  return jsonResponse(dto, 200, requestId, 'comment-delete-complete');
}

export const COMMENT_DELETE_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'DELETE',
  path: '/api/comments/:id',
  gateEnv: COMMENT_DELETE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: COMMENT_DELETE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: COMMENT_DELETE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: COMMENT_DELETE_FORBIDDEN_FALLBACK_ENVS,
  actorAuthority: 'verified-firebase-legacyOwnerId',
  modalParity: Object.freeze([
    'comment-lookup',
    'author-check',
    'already-non-visible-idempotent-return',
    'soft-delete-status-deleted',
    'audit-comment.soft_delete'
  ]),
  productionDeletePrivilegeAuthorized: false,
  productionGateActivationAuthorized: false,
  providerMutationAuthorized: false,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false
});
