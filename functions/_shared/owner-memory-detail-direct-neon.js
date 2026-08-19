// #4123 Phase-2 authenticated owner Memory detail direct-Neon read adapter.
//
// This module is route-specific and read-only. Firebase remains the only
// accepted identity authority; the verified principal's legacyOwnerId is
// compared against the requested Memory's parent Tree owner. Anonymous/public
// Memory detail remains owned by the independent #4114 adapter.

import {
  FirebaseReadPrincipalError,
  buildFirebaseReadPrincipalErrorResponse,
  resolveFirebaseReadPrincipal
} from '../../workers/love-platform-api/firebase-read-principal.js';
import {
  createFirebaseIdTokenVerifier,
  readFirebaseProjectId
} from './firebase-id-token-verifier.js';
import { normalizeMemoryId } from './memory-route-proxy.js';
import {
  normalizeDirectNeonTimestamp,
  normalizeMemoryEmotionTags
} from './public-memory-detail-direct-neon.js';
import { REQUEST_ID_HEADER } from './request-id.js';
import {
  buildInvalidPathEncodingResponse,
  isInvalidPathEncodingError
} from './path-segment.js';

export const OWNER_MEMORY_DETAIL_RUNTIME = Object.freeze({
  GATE_FLAG: 'LB_OWNER_MEMORY_DETAIL_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL'
});

const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;

export function isNeonDatabaseUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    const parsed = new URL(value);
    return NEON_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function isOwnerMemoryDetailDirectNeonSelected(env = {}) {
  const value = typeof env?.[OWNER_MEMORY_DETAIL_RUNTIME.GATE_FLAG] === 'string'
    ? env[OWNER_MEMORY_DETAIL_RUNTIME.GATE_FLAG].trim()
    : '';
  return value === OWNER_MEMORY_DETAIL_RUNTIME.DIRECT_NEON_VALUE;
}

export function readOwnerMemoryDetailDirectConfig(env = {}) {
  const raw = typeof env?.[OWNER_MEMORY_DETAIL_RUNTIME.DATABASE_URL] === 'string'
    ? env[OWNER_MEMORY_DETAIL_RUNTIME.DATABASE_URL].trim()
    : '';
  const configured = isNeonDatabaseUrl(raw);
  return Object.freeze({
    configured,
    connectionString: configured ? raw : ''
  });
}

// Capability-safe parity with the existing owner Memory list/normalizer path.
// This inspection is read-only and determines whether selecting m.client_key is
// legal on an older schema; it never treats column absence as an error.
export const OWNER_MEMORY_DETAIL_CLIENT_KEY_CAPABILITY_SQL = `
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'memories'
    AND column_name = 'client_key'
) AS has_client_key;
`;

const OWNER_MEMORY_DETAIL_BASE_SELECT = `
SELECT
  m.id::text AS id,
  m.tree_id::text AS tree_id,
  m.parent_id::text AS parent_id,
  m.title,
  m.memo,
  m.artist,
  m.source,
  m.source_url,
  m.source_type,
  m.thumbnail,
  m.emotion_tags,
  m.timestamp,
  m.visibility,
  m.channel_id,
  m.channel_name,
  m.channel_url,
`;

// Keep two fixed static statements rather than interpolating a column name.
// Neither statement constrains Memory or Tree visibility: current private
// authority allows an owner to read public/private Memories regardless of the
// parent Tree visibility. Ownership is checked after this row is read so a
// non-owner remains a 403 while a missing/deleted Memory remains a 404.
export const OWNER_MEMORY_DETAIL_SQL_WITH_CLIENT_KEY = `${OWNER_MEMORY_DETAIL_BASE_SELECT}
  m.client_key,
  m.created_at::text AS created_at,
  m.updated_at::text AS updated_at,
  t.owner_id::text AS tree_owner_id,
  t.visibility AS tree_visibility
FROM memories m
INNER JOIN trees t
  ON t.id = m.tree_id
WHERE m.id = $1
LIMIT 1;
`;

export const OWNER_MEMORY_DETAIL_SQL_LEGACY = `${OWNER_MEMORY_DETAIL_BASE_SELECT}
  m.created_at::text AS created_at,
  m.updated_at::text AS updated_at,
  t.owner_id::text AS tree_owner_id,
  t.visibility AS tree_visibility
FROM memories m
INNER JOIN trees t
  ON t.id = m.tree_id
WHERE m.id = $1
LIMIT 1;
`;

function normalizeStoredVisibility(value) {
  if (value === 'public') return 'public';
  if (value === 'private') return 'private';
  return null;
}

export function projectOwnerMemoryDetailRow(row, { hasClientKey = false } = {}) {
  if (!row || typeof row !== 'object') {
    throw new TypeError('OWNER_MEMORY_DETAIL_NORMALIZATION_FAILURE');
  }
  if (row.id == null) {
    throw new TypeError('OWNER_MEMORY_DETAIL_NORMALIZATION_FAILURE');
  }

  const memory = {
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
    emotionTags: normalizeMemoryEmotionTags(row.emotion_tags),
    timestamp: row.timestamp || '',
    visibility: normalizeStoredVisibility(row.visibility),
    channelId: row.channel_id || null,
    channelName: row.channel_name || null,
    channelUrl: row.channel_url || null,
    createdAt: normalizeDirectNeonTimestamp(row.created_at),
    updatedAt: normalizeDirectNeonTimestamp(row.updated_at)
  };

  // Match normalize_memory_row(): never fabricate a clientKey for an absent
  // legacy column or a canonical NULL value.
  if (hasClientKey && row.client_key != null) {
    memory.clientKey = row.client_key;
  }

  return memory;
}

function makeRequestWithId(request, requestId) {
  if (!requestId || request.headers.get(REQUEST_ID_HEADER)) return request;
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Request(request.url, {
    method: request.method,
    headers
  });
}

function directHeaders(requestId = null, routeStatus = null) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon'
  });
  if (routeStatus) headers.set('x-lovebud-route-status', routeStatus);
  if (requestId) {
    headers.set(REQUEST_ID_HEADER, requestId);
    headers.set('Access-Control-Expose-Headers', REQUEST_ID_HEADER);
  }
  return headers;
}

function jsonResponse(body, status, requestId = null, routeStatus = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: directHeaders(requestId, routeStatus)
  });
}

function decorateDirectResponse(response, requestId = null) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-lovebud-upstream', 'direct-neon');
  headers.set('x-lovebud-runtime', 'direct_neon');
  if (requestId) {
    headers.set(REQUEST_ID_HEADER, requestId);
    const exposed = headers.get('Access-Control-Expose-Headers') || '';
    const items = exposed.split(',').map((item) => item.trim()).filter(Boolean);
    if (!items.includes(REQUEST_ID_HEADER)) {
      headers.set(
        'Access-Control-Expose-Headers',
        exposed ? `${exposed}, ${REQUEST_ID_HEADER}` : REQUEST_ID_HEADER
      );
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function createOwnerMemoryDetailDirectExecutor({ connectionString, executor } = {}) {
  if (typeof executor === 'function') return executor;
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new TypeError('OWNER_MEMORY_DETAIL_DIRECT_NEON_CONFIG_INVALID');
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, { disableWarningInBrowsers: true });
  return async function ownerMemoryDetailExecutor(text, values) {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    if (!Array.isArray(rows)) {
      throw new TypeError('OWNER_MEMORY_DETAIL_DIRECT_NEON_RESULT_INVALID');
    }
    return rows;
  };
}

function readClientKeyCapability(rows) {
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  return row?.has_client_key === true;
}

export async function handleOwnerMemoryDetailDirectNeon(
  request,
  env = {},
  rawMemoryId = null,
  requestId = null,
  {
    executorOverride = null,
    verifyTokenOverride = null,
    verifierOptions = null
  } = {}
) {
  if (!isOwnerMemoryDetailDirectNeonSelected(env)) return null;

  // The existing edge proxy canonicalizes/validates the dynamic segment before
  // Modal verifies the token. Preserve that malformed-path taxonomy here.
  let normalizedMemoryId;
  try {
    normalizedMemoryId = normalizeMemoryId(rawMemoryId);
  } catch (error) {
    if (isInvalidPathEncodingError(error)) {
      const response = buildInvalidPathEncodingResponse(requestId, REQUEST_ID_HEADER);
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'no-store');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }
    throw error;
  }

  if (!normalizedMemoryId) {
    return jsonResponse({ detail: 'memoryId is required' }, 400, requestId, 'invalid-memory-id');
  }
  const databaseMemoryId = decodeURIComponent(normalizedMemoryId);

  const requestWithId = makeRequestWithId(request, requestId);
  let principal;
  try {
    const verifyToken = verifyTokenOverride || createFirebaseIdTokenVerifier({
      projectId: readFirebaseProjectId(env),
      ...(verifierOptions && typeof verifierOptions === 'object' ? verifierOptions : {})
    });
    principal = await resolveFirebaseReadPrincipal(requestWithId, verifyToken);
  } catch (error) {
    if (error instanceof FirebaseReadPrincipalError) {
      return decorateDirectResponse(
        buildFirebaseReadPrincipalErrorResponse(error, requestWithId),
        requestId
      );
    }
    return jsonResponse({
      error: {
        code: 'FIREBASE_VERIFIER_UNAVAILABLE',
        message: 'Authentication verifier unavailable'
      }
    }, 503, requestId, 'auth-unavailable');
  }

  const config = readOwnerMemoryDetailDirectConfig(env);
  if (!config.configured && !executorOverride) {
    return jsonResponse({
      error: 'Owner Memory detail direct-Neon runtime not configured',
      code: 'DIRECT_NEON_CONFIG_ABSENT'
    }, 503, requestId, 'config-absent');
  }

  try {
    const executor = await createOwnerMemoryDetailDirectExecutor({
      connectionString: config.connectionString,
      executor: executorOverride || undefined
    });

    const capabilityRows = await executor(OWNER_MEMORY_DETAIL_CLIENT_KEY_CAPABILITY_SQL, []);
    const hasClientKey = readClientKeyCapability(capabilityRows);
    const query = hasClientKey
      ? OWNER_MEMORY_DETAIL_SQL_WITH_CLIENT_KEY
      : OWNER_MEMORY_DETAIL_SQL_LEGACY;
    const rows = await executor(query, [databaseMemoryId]);

    if (!Array.isArray(rows)) {
      throw new TypeError('OWNER_MEMORY_DETAIL_DIRECT_NEON_RESULT_INVALID');
    }
    if (rows.length === 0) {
      return jsonResponse({ detail: 'Memory not found' }, 404, requestId, 'not-found');
    }

    const row = rows[0];
    if (String(row?.tree_owner_id || '') !== principal.legacyOwnerId) {
      return jsonResponse(
        { detail: 'Access denied: not your memory' },
        403,
        requestId,
        'forbidden'
      );
    }

    const memory = projectOwnerMemoryDetailRow(row, { hasClientKey });
    return jsonResponse(memory, 200, requestId);
  } catch {
    return jsonResponse({ detail: 'Internal server error' }, 500, requestId, 'query-failed');
  }
}

export const OWNER_MEMORY_DETAIL_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  gate: OWNER_MEMORY_DETAIL_RUNTIME.GATE_FLAG,
  databaseEnv: OWNER_MEMORY_DETAIL_RUNTIME.DATABASE_URL,
  identityProvider: 'firebase',
  ownerAuthority: 'principal.legacyOwnerId -> parent Tree.owner_id',
  memoryVisibilityConstraint: false,
  treeVisibilityConstraint: false,
  clientKeyCapabilitySafe: true,
  writes: false
});
