// #4228 Phase-4 owner Tree update Cloudflare -> Neon WebSocket transaction candidate.
//
// This module is a gated migration candidate for PUT /api/trees/:id only.
// Firebase remains Product identity authority and principal.legacyOwnerId is the
// sole owner authority. Default/modal/unknown routing remains Modal-backed.
// An explicit visibility='private' update is intentionally deferred to Modal
// before any direct DB capability is acquired so Plus/private entitlement stays
// owned by the existing Product authority.

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
  normalizeOwnerTreeDetailId,
  OWNER_TREE_DETAIL_SCHEMA_CAPABILITIES_SQL,
  buildOwnerTreeDetailSql,
  projectOwnerTreeDetailRow
} from './owner-tree-detail-direct-neon.js';
import { REQUEST_ID_HEADER } from './request-id.js';

export const TREE_UPDATE_DIRECT_NEON_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_TREE_UPDATE_WRITE_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_WRITE_DATABASE_URL'
});

export const TREE_UPDATE_FORBIDDEN_FALLBACK_ENVS = Object.freeze([
  'LOVE_PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'DIRECT_NEON_BROWSE_DATABASE_URL'
]);

const ALLOWED_UPDATE_FIELDS = Object.freeze([
  'title',
  'visibility',
  'groupName',
  'keywords'
]);
const ALLOWED_UPDATE_SET = new Set(ALLOWED_UPDATE_FIELDS);
const TREE_TITLE_MAX = 200;
const TREE_GROUP_NAME_MAX = 80;
const TREE_KEYWORD_MAX = 24;
const TREE_KEYWORDS_MAX = 5;

export function isTreeUpdateDirectNeonSelected(env = {}) {
  const value = typeof env?.[TREE_UPDATE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[TREE_UPDATE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return value === TREE_UPDATE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

export function readTreeUpdateWriteConfig(env = {}) {
  const dedicated = typeof env?.[TREE_UPDATE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[TREE_UPDATE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonWsConnectionString(dedicated);
  return Object.freeze({
    configured,
    connectionString: configured ? dedicated : ''
  });
}

export function detectTreeUpdateForbiddenWriterFallback(env = {}) {
  if (readTreeUpdateWriteConfig(env).configured) return null;
  for (const name of TREE_UPDATE_FORBIDDEN_FALLBACK_ENVS) {
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

function codePointLength(text) {
  return [...text].length;
}

function makeWorkFailure(signal, status, body, routeStatus) {
  signal.http = Object.freeze({ status, body, routeStatus });
  return new NeonWsTransactionError(
    NEON_WS_TRANSACTION_ERROR.WORK_FAILURE,
    'tree update work failed',
    { status }
  );
}

function failWork(signal, status, detail, routeStatus) {
  throw makeWorkFailure(signal, status, { detail }, routeStatus);
}

function normalizeTitle(value, signal) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') {
    failWork(signal, 400, {
      code: 'INVALID_TREE_SCALAR_TYPE',
      field: 'title',
      expected: 'string'
    }, 'invalid-tree-title');
  }
  const text = value.trim();
  if (codePointLength(text) > TREE_TITLE_MAX) {
    failWork(signal, 400, `title exceeds max ${TREE_TITLE_MAX} characters`, 'tree-title-oversize');
  }
  return text;
}

function normalizeGroupName(value, signal) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    failWork(signal, 400, {
      code: 'INVALID_TREE_SCALAR_TYPE',
      field: 'groupName',
      expected: 'string'
    }, 'invalid-group-name');
  }
  const text = value.trim();
  if (!text) return null;
  if (codePointLength(text) > TREE_GROUP_NAME_MAX) {
    failWork(signal, 400, `groupName exceeds max ${TREE_GROUP_NAME_MAX} characters`, 'group-name-oversize');
  }
  return text;
}

function normalizeKeywords(value, signal) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) {
    failWork(signal, 400, 'keywords must be an array', 'invalid-keywords');
  }
  const result = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string') {
      failWork(signal, 400, 'each keyword must be a string', 'invalid-keywords');
    }
    const text = item.trim();
    if (!text) continue;
    if (codePointLength(text) > TREE_KEYWORD_MAX) {
      failWork(
        signal,
        400,
        `keyword '${text.slice(0, 20)}...' exceeds max ${TREE_KEYWORD_MAX} characters`,
        'invalid-keywords'
      );
    }
    if (!seen.has(text)) {
      seen.add(text);
      result.push(text);
    }
  }
  if (result.length > TREE_KEYWORDS_MAX) {
    failWork(signal, 400, `keywords exceeds max ${TREE_KEYWORDS_MAX}`, 'invalid-keywords');
  }
  return result;
}

function normalizeCapabilities(rows) {
  const row = Array.isArray(rows) && rows.length ? rows[0] : {};
  return Object.freeze({
    hasSocialCounts: row?.has_social_counts === true,
    hasLikeCount: row?.has_like_count === true,
    hasViewCount: row?.has_view_count === true
  });
}

const OWNER_CHECK_SQL = `
SELECT id::text AS id, owner_id::text AS owner_id
FROM trees
WHERE id = $1
LIMIT 1;
`;

function buildUpdateSql(payload, signal) {
  const assignments = [];
  const values = [];

  function add(column, value) {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
    add('title', normalizeTitle(payload.title, signal));
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'visibility')) {
    if (payload.visibility !== 'public') {
      failWork(signal, 400, 'visibility: public, private', 'invalid-visibility');
    }
    add('visibility', 'public');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'groupName')) {
    add('group_name', normalizeGroupName(payload.groupName, signal));
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'keywords')) {
    add('keywords', normalizeKeywords(payload.keywords, signal));
  }

  return Object.freeze({ assignments, values });
}

async function runUpdateWork(tx, signal, { treeId, ownerId, payload }) {
  // Preserve Modal ordering: validate UUID before this transaction, then owner
  // authorization before unsupported/empty payload validation.
  const ownerRows = await tx.query(OWNER_CHECK_SQL, [treeId]);
  const ownerRow = Array.isArray(ownerRows) && ownerRows.length ? ownerRows[0] : null;
  if (!ownerRow) {
    failWork(signal, 404, 'Tree not found', 'tree-not-found');
  }
  if (String(ownerRow.owner_id || '') !== ownerId) {
    failWork(signal, 403, 'Access denied: not your tree', 'tree-owner-forbidden');
  }

  const unknownFields = Object.keys(payload)
    .filter((key) => !ALLOWED_UPDATE_SET.has(key))
    .sort();
  if (unknownFields.length) {
    failWork(signal, 400, {
      code: 'UNSUPPORTED_TREE_UPDATE_FIELDS',
      fields: unknownFields
    }, 'unsupported-tree-update-fields');
  }
  if (Object.keys(payload).length === 0) {
    failWork(signal, 400, { code: 'EMPTY_TREE_UPDATE' }, 'empty-tree-update');
  }

  const update = buildUpdateSql(payload, signal);
  if (!update.assignments.length) {
    failWork(signal, 400, { code: 'EMPTY_TREE_UPDATE' }, 'empty-tree-update');
  }

  const treeIdPlaceholder = update.values.length + 1;
  const ownerIdPlaceholder = update.values.length + 2;
  const updateSql = `
UPDATE trees
SET ${update.assignments.join(', ')}, updated_at = NOW()
WHERE id = $${treeIdPlaceholder}
  AND owner_id = $${ownerIdPlaceholder}
RETURNING id::text AS id;
`;
  const updatedRows = await tx.query(updateSql, [...update.values, treeId, ownerId]);
  if (!Array.isArray(updatedRows) || !updatedRows.length) {
    failWork(signal, 404, 'Tree not found', 'tree-not-found');
  }

  // Exact owner-detail canonical reread parity: memoryCount and capability-safe
  // like/view counts are derived from canonical DB state, never from the input.
  const capabilityRows = await tx.query(OWNER_TREE_DETAIL_SCHEMA_CAPABILITIES_SQL, []);
  const capabilities = normalizeCapabilities(capabilityRows);
  const query = buildOwnerTreeDetailSql(capabilities);
  const canonicalRows = await tx.canonicalReread(query.text, [treeId, ownerId]);
  const canonical = Array.isArray(canonicalRows) && canonicalRows.length ? canonicalRows[0] : null;
  if (!canonical) {
    failWork(signal, 404, 'Tree not found', 'tree-not-found');
  }

  try {
    return projectOwnerTreeDetailRow(canonical, query);
  } catch {
    failWork(signal, 500, 'Internal server error', 'canonical-normalization-failed');
  }
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
    { error: 'Tree update direct-Neon transaction failed', code: sanitized.code },
    status,
    requestId,
    routeStatus
  );
}

export async function handleTreeUpdateDirectNeon(
  request,
  treeId,
  env = {},
  requestId = null,
  {
    verifyTokenOverride = null,
    neonImporter = null,
    transactionAdapterOverride = null,
    boundedBodyResult = null
  } = {}
) {
  if (!isTreeUpdateDirectNeonSelected(env)) return null;

  // Match Modal route authority: verified Firebase principal precedes JSON parse
  // and all direct DB capability acquisition.
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

  let bodyResult;
  if (boundedBodyResult && typeof boundedBodyResult === 'object') {
    bodyResult = boundedBodyResult;
  } else {
    try {
      bodyResult = await readBoundedRequestBody(request);
    } catch {
      return jsonResponse({ error: 'Request body read failed' }, 503, requestId, 'body-read-failed');
    }
  }
  if (bodyResult.status === 'tooLarge') {
    return jsonResponse({ error: 'Payload too large' }, 413, requestId, 'payload-too-large');
  }
  if (bodyResult.status === 'readError') {
    return jsonResponse({ error: 'Request body read failed' }, 503, requestId, 'body-read-failed');
  }

  let payload;
  const rawText = bodyResult.body ? new TextDecoder().decode(bodyResult.body) : '';
  if (!rawText) {
    payload = {};
  } else {
    try {
      payload = JSON.parse(rawText);
    } catch {
      return jsonResponse({ detail: 'Invalid JSON body' }, 400, requestId, 'invalid-json-body');
    }
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return jsonResponse({ detail: { code: 'JSON_OBJECT_REQUIRED' } }, 400, requestId, 'json-object-required');
    }
  }

  // Entitlement boundary: exact explicit private is handed back to the current
  // Modal route before UUID normalization or direct DB acquisition. Modal then
  // performs the existing tree-id/owner/allowlist/entitlement ordering.
  if (
    Object.prototype.hasOwnProperty.call(payload, 'visibility')
    && payload.visibility === 'private'
  ) {
    return null;
  }

  if (typeof treeId !== 'string' || !treeId.trim()) {
    return jsonResponse({ detail: 'treeId is required' }, 400, requestId, 'invalid-tree-id');
  }
  const safeTreeId = normalizeOwnerTreeDetailId(treeId);
  if (!safeTreeId) {
    return jsonResponse({ detail: 'Invalid treeId' }, 400, requestId, 'invalid-tree-id');
  }

  const config = readTreeUpdateWriteConfig(env);
  if (!config.configured) {
    return jsonResponse(
      { error: 'Tree update direct-Neon runtime not configured', code: 'DIRECT_NEON_CONFIG_ABSENT' },
      503,
      requestId,
      'config-absent'
    );
  }
  if (detectTreeUpdateForbiddenWriterFallback(env)) {
    return jsonResponse(
      { error: 'Tree update direct-Neon writer config invalid', code: 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK' },
      503,
      requestId,
      'config-forbidden-fallback'
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
      return await runUpdateWork(tx, signal, {
        treeId: safeTreeId,
        ownerId: principal.legacyOwnerId,
        payload
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
  if (!dto || typeof dto.id !== 'string' || typeof dto.ownerId !== 'string') {
    return jsonResponse({ detail: 'Internal server error' }, 500, requestId, 'no-tree-result');
  }
  return jsonResponse(dto, 200, requestId, 'tree-update-complete');
}

export const TREE_UPDATE_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'PUT',
  path: '/api/trees/:id',
  gateEnv: TREE_UPDATE_DIRECT_NEON_RUNTIME_ENV.GATE_FLAG,
  directNeonValue: TREE_UPDATE_DIRECT_NEON_RUNTIME_ENV.DIRECT_NEON_VALUE,
  databaseEnv: TREE_UPDATE_DIRECT_NEON_RUNTIME_ENV.DATABASE_URL,
  forbiddenFallbackEnvs: TREE_UPDATE_FORBIDDEN_FALLBACK_ENVS,
  ownerAuthority: 'verified-firebase-legacyOwnerId',
  allowedFields: ALLOWED_UPDATE_FIELDS,
  explicitPrivate: 'modal-before-direct-db',
  getUnchanged: true,
  deleteUnchanged: true,
  writes: true,
  perRequestModalFallbackAfterDirectStart: false,
  automaticWholeTransactionRetry: false,
  retryOnUnknownCommitOutcome: false
});
