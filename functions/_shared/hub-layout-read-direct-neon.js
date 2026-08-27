// #4238 Phase-2/4 Hub Layout GET Cloudflare -> direct-Neon read candidate.
//
// Firebase remains the Product identity authority. Only GET requests with the
// exact LB_HUB_LAYOUT_READ_RUNTIME=direct_neon gate enter this helper; all
// default/unset/modal/unknown routing stays on the existing catch-all -> Modal
// path. This module is SELECT-only and does not authorize Production gate,
// provider, secret, privilege, schema, or data mutation.

import {
  FirebaseReadPrincipalError,
  buildFirebaseReadPrincipalErrorResponse,
  resolveFirebaseReadPrincipal
} from '../../workers/love-platform-api/firebase-read-principal.js';
import {
  createFirebaseIdTokenVerifier,
  readFirebaseProjectId
} from './firebase-id-token-verifier.js';
import {
  buildInvalidPathEncodingResponse,
  isInvalidPathEncodingError,
  normalizeEncodedPathSegment
} from './path-segment.js';
import { normalizeHubLayoutTimestamp } from './hub-layout-direct-neon.js';

export const HUB_LAYOUT_READ_DIRECT_NEON_RUNTIME = Object.freeze({
  GATE_FLAG: 'LB_HUB_LAYOUT_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

export const HUB_LAYOUT_READ_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_WRITE_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

const HUB_LAYOUT_PATH = /^\/api\/trees\/([^/]+)\/hub-layout$/;
const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;

export const HUB_LAYOUT_OWNER_READ_SQL = `
SELECT id, owner_id
FROM trees
WHERE id = $1
LIMIT 1;
`;

export const HUB_LAYOUT_LATEST_READ_SQL = `
SELECT revision,
       layout_mode,
       manual_positions,
       updated_at::text AS updated_at
FROM tree_hub_layouts
WHERE tree_id = $1
ORDER BY revision DESC
LIMIT 1;
`;

export function isNeonDatabaseUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    const parsed = new URL(value);
    return NEON_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function isHubLayoutDirectNeonReadRequest(request) {
  if (!request || request.method.toUpperCase() !== 'GET') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return HUB_LAYOUT_PATH.test(path);
}

export function isHubLayoutReadDirectNeonSelected(env = {}) {
  const value = typeof env?.[HUB_LAYOUT_READ_DIRECT_NEON_RUNTIME.GATE_FLAG] === 'string'
    ? env[HUB_LAYOUT_READ_DIRECT_NEON_RUNTIME.GATE_FLAG].trim()
    : '';
  return value === HUB_LAYOUT_READ_DIRECT_NEON_RUNTIME.DIRECT_NEON_VALUE;
}

export function readHubLayoutReadConfig(env = {}) {
  const raw = typeof env?.[HUB_LAYOUT_READ_DIRECT_NEON_RUNTIME.DATABASE_URL] === 'string'
    ? env[HUB_LAYOUT_READ_DIRECT_NEON_RUNTIME.DATABASE_URL].trim()
    : '';
  const configured = isNeonDatabaseUrl(raw);
  return Object.freeze({
    configured,
    connectionString: configured ? raw : ''
  });
}

export function detectHubLayoutReadForbiddenFallback(env = {}) {
  if (readHubLayoutReadConfig(env).configured) return null;
  for (const name of HUB_LAYOUT_READ_FORBIDDEN_FALLBACK_ENVS) {
    const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (raw && isNeonDatabaseUrl(raw)) return name;
  }
  return null;
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

function extractHubLayoutTreeId(request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const match = path.match(HUB_LAYOUT_PATH);
  if (!match) return null;
  const normalized = normalizeEncodedPathSegment(match[1]);
  return normalized ? decodeURIComponent(normalized) : null;
}

export async function createHubLayoutReadDirectExecutor({ connectionString, executor } = {}) {
  if (typeof executor === 'function') return executor;
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new TypeError('HUB_LAYOUT_READ_DIRECT_NEON_CONFIG_INVALID');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, { disableWarningInBrowsers: true });
  return async (text, values) => {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    return Array.isArray(rows) ? rows : [];
  };
}

export function projectHubLayoutReadRow(row) {
  if (!row || typeof row !== 'object') {
    throw new TypeError('HUB_LAYOUT_READ_NORMALIZATION_FAILURE');
  }
  const revision = Number(row.revision);
  if (!Number.isInteger(revision) || revision < 0) {
    throw new TypeError('HUB_LAYOUT_READ_REVISION_INVALID');
  }
  return Object.freeze({
    revision,
    layoutMode: row.layout_mode,
    positions: row.manual_positions,
    updatedAt: normalizeHubLayoutTimestamp(row.updated_at)
  });
}

export async function handleHubLayoutReadDirectNeon(
  request,
  env = {},
  requestId = null,
  { executorOverride = null, verifyTokenOverride = null } = {}
) {
  if (!isHubLayoutDirectNeonReadRequest(request) || !isHubLayoutReadDirectNeonSelected(env)) {
    return null;
  }

  // Match the catch-all boundary: malformed path encoding is rejected before
  // verifier or database capability acquisition.
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

  const config = readHubLayoutReadConfig(env);
  if (!config.configured && !executorOverride) {
    const forbidden = detectHubLayoutReadForbiddenFallback(env);
    return jsonResponse(
      forbidden
        ? {
            error: 'Hub layout direct-Neon read config invalid',
            code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK'
          }
        : {
            error: 'Hub layout direct-Neon read runtime not configured',
            code: 'DIRECT_NEON_CONFIG_ABSENT'
          },
      503,
      requestId,
      forbidden ? 'config-forbidden-fallback' : 'config-absent'
    );
  }

  try {
    const executor = await createHubLayoutReadDirectExecutor({
      connectionString: config.connectionString,
      executor: executorOverride || undefined
    });

    // Preserve Modal's two-stage error authority: Tree missing vs foreign owner
    // is decided before tree_hub_layouts is queried.
    const ownerRows = await executor(HUB_LAYOUT_OWNER_READ_SQL, [treeId]);
    const tree = Array.isArray(ownerRows) && ownerRows.length ? ownerRows[0] : null;
    if (!tree) {
      return jsonResponse({ detail: 'Tree not found' }, 404, requestId, 'tree-not-found');
    }
    if (String(tree.owner_id || '') !== principal.legacyOwnerId) {
      return jsonResponse(
        { detail: 'Access denied: not your tree' },
        403,
        requestId,
        'not-owner'
      );
    }

    const layoutRows = await executor(HUB_LAYOUT_LATEST_READ_SQL, [treeId]);
    const row = Array.isArray(layoutRows) && layoutRows.length ? layoutRows[0] : null;
    if (!row) {
      return jsonResponse(
        { error: 'Hub layout not found', code: 'HUB_LAYOUT_NOT_FOUND' },
        404,
        requestId,
        'hub-layout-not-found'
      );
    }

    return jsonResponse(projectHubLayoutReadRow(row), 200, requestId, 'loaded');
  } catch {
    return jsonResponse(
      { detail: 'Internal server error' },
      500,
      requestId,
      'query-failed'
    );
  }
}

export const HUB_LAYOUT_READ_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  gate: HUB_LAYOUT_READ_DIRECT_NEON_RUNTIME.GATE_FLAG,
  directValue: HUB_LAYOUT_READ_DIRECT_NEON_RUNTIME.DIRECT_NEON_VALUE,
  databaseUrlEnv: HUB_LAYOUT_READ_DIRECT_NEON_RUNTIME.DATABASE_URL,
  ownerAuthority: 'principal.legacyOwnerId',
  firebaseOnly: true,
  selectOnly: true,
  transaction: false,
  advisoryLock: false,
  modalFallbackAfterDirectStart: false,
  productionReadPrivilegeAuthorized: false,
  productionGateActivationAuthorized: false
});
