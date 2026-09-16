// #4424 Phase-5 private Tree capability Cloudflare -> Neon read candidate.
//
// Source-only gated candidate for:
//   GET /api/private/trees/:treeId/capability
//
// The current Modal contract answers only whether the verified Firebase owner
// can edit the requested Tree. No Tree DTO or owner identifier is returned.
//
// unset / modal / unknown -> existing Modal route
// direct_neon             -> bounded direct-Neon SELECT
//
// Once direct execution begins there is no direct -> Modal fallback.
// Infrastructure/config/query failures fail closed with a bounded 503. The
// current viewer caller already degrades any request failure to viewerCanEdit
// false, while a successful non-owner/auth-rejected capability result remains
// the explicit 200 {viewerCanEdit:false} contract.

import {
  FIREBASE_READ_PRINCIPAL_ERROR,
  FirebaseReadPrincipalError,
  resolveFirebaseReadPrincipal
} from '../../workers/love-platform-api/firebase-read-principal.js';
import {
  createFirebaseIdTokenVerifier,
  readFirebaseProjectId
} from './firebase-id-token-verifier.js';
import {
  isNeonDatabaseUrl,
  normalizeOwnerTreeDetailId
} from './owner-tree-detail-direct-neon.js';
import { REQUEST_ID_HEADER } from './request-id.js';

export const PRIVATE_TREE_CAPABILITY_RUNTIME = Object.freeze({
  GATE_FLAG: 'LB_PRIVATE_TREE_CAPABILITY_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

export const PRIVATE_TREE_CAPABILITY_SQL = `
SELECT EXISTS (
  SELECT 1
  FROM trees
  WHERE id = $1
    AND owner_id = $2
) AS viewer_can_edit;
`;

export function isPrivateTreeCapabilityDirectNeonSelected(env = {}) {
  const value = typeof env?.[PRIVATE_TREE_CAPABILITY_RUNTIME.GATE_FLAG] === 'string'
    ? env[PRIVATE_TREE_CAPABILITY_RUNTIME.GATE_FLAG].trim()
    : '';
  return value === PRIVATE_TREE_CAPABILITY_RUNTIME.DIRECT_NEON_VALUE;
}

export function readPrivateTreeCapabilityConfig(env = {}) {
  const raw = typeof env?.[PRIVATE_TREE_CAPABILITY_RUNTIME.DATABASE_URL] === 'string'
    ? env[PRIVATE_TREE_CAPABILITY_RUNTIME.DATABASE_URL].trim()
    : '';
  const configured = isNeonDatabaseUrl(raw);
  return Object.freeze({
    configured,
    connectionString: configured ? raw : ''
  });
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
    headers[REQUEST_ID_HEADER] = requestId;
    headers['Access-Control-Expose-Headers'] = REQUEST_ID_HEADER;
  }
  return headers;
}

function jsonResponse(body, status, requestId, routeStatus = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: directHeaders(requestId, routeStatus)
  });
}

function falseCapability(requestId, routeStatus = 'tree-capability-complete') {
  return jsonResponse({ viewerCanEdit: false }, 200, requestId, routeStatus);
}

function isAuthDenial(error) {
  if (!(error instanceof FirebaseReadPrincipalError)) return false;
  return error.code === FIREBASE_READ_PRINCIPAL_ERROR.AUTHORIZATION_REQUIRED ||
    error.code === FIREBASE_READ_PRINCIPAL_ERROR.AUTHORIZATION_MALFORMED ||
    error.code === FIREBASE_READ_PRINCIPAL_ERROR.VERIFICATION_FAILED;
}

export async function createPrivateTreeCapabilityExecutor({ connectionString, executor } = {}) {
  if (typeof executor === 'function') return executor;
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new TypeError('PRIVATE_TREE_CAPABILITY_DIRECT_NEON_CONFIG_INVALID');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, { disableWarningInBrowsers: true });
  return async (text, values) => {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    return Array.isArray(rows) ? rows : [];
  };
}

export async function handlePrivateTreeCapabilityDirectNeon(
  request,
  treeId,
  env = {},
  requestId = null,
  { executorOverride = null, verifyTokenOverride = null, verifierOptions = null } = {}
) {
  if (!isPrivateTreeCapabilityDirectNeonSelected(env)) return null;

  let principal;
  try {
    const verifyToken = verifyTokenOverride || createFirebaseIdTokenVerifier({
      projectId: readFirebaseProjectId(env),
      ...(verifierOptions && typeof verifierOptions === 'object' ? verifierOptions : {})
    });
    principal = await resolveFirebaseReadPrincipal(request, verifyToken);
  } catch (error) {
    if (isAuthDenial(error)) {
      return falseCapability(requestId, 'tree-capability-complete');
    }
    return jsonResponse({
      error: {
        code: 'FIREBASE_VERIFIER_UNAVAILABLE',
        message: 'Authentication verifier unavailable'
      }
    }, 503, requestId, 'auth-unavailable');
  }

  // Modal validate_required_id accepts non-empty strings, and the current
  // capability handler collapses downstream lookup errors to false. Avoid
  // issuing a PostgreSQL UUID comparison for malformed/non-UUID ids and keep
  // the user-visible capability result safely false.
  const safeTreeId = normalizeOwnerTreeDetailId(treeId);
  if (!safeTreeId) {
    return falseCapability(requestId);
  }

  const config = readPrivateTreeCapabilityConfig(env);
  if (!config.configured && !executorOverride) {
    return jsonResponse({
      error: 'Private Tree capability direct-Neon runtime not configured',
      code: 'DIRECT_NEON_CONFIG_ABSENT'
    }, 503, requestId, 'config-absent');
  }

  try {
    const executor = await createPrivateTreeCapabilityExecutor({
      connectionString: config.connectionString,
      executor: executorOverride || undefined
    });
    const rows = await executor(PRIVATE_TREE_CAPABILITY_SQL, [
      safeTreeId,
      principal.legacyOwnerId
    ]);
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    return jsonResponse({
      viewerCanEdit: row?.viewer_can_edit === true
    }, 200, requestId, 'tree-capability-complete');
  } catch {
    return jsonResponse({
      error: 'Private Tree capability temporarily unavailable'
    }, 503, requestId, 'query-failed');
  }
}

export const PRIVATE_TREE_CAPABILITY_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  gate: PRIVATE_TREE_CAPABILITY_RUNTIME.GATE_FLAG,
  directValue: PRIVATE_TREE_CAPABILITY_RUNTIME.DIRECT_NEON_VALUE,
  databaseUrlEnv: PRIVATE_TREE_CAPABILITY_RUNTIME.DATABASE_URL,
  ownerAuthority: 'principal.legacyOwnerId',
  firebaseOnly: true,
  selectOnly: true,
  requiredObjects: Object.freeze(['trees:SELECT']),
  responseFields: Object.freeze(['viewerCanEdit']),
  productionCutover: false
});
