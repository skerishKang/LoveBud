// #4128 Phase-2 Product Browse summary Cloudflare -> Neon Serverless HTTP adapter.
//
// The normal Product route remains Modal-backed unless the route-specific
// direct gate is explicitly selected. Direct mode uses only the dedicated
// LOVE_PLATFORM_DATABASE_URL boundary and fails closed without per-request
// fallback to Modal.

import {
  fetchDirectNeonBrowseSummary,
} from './direct-neon-browse-summary-core.js';

export const BROWSE_SUMMARY_RUNTIME_ENV = Object.freeze({
  GATE_FLAG: 'LB_BROWSE_SUMMARY_READ_RUNTIME',
  DIRECT_NEON_VALUE: 'direct_neon',
  DATABASE_URL: 'LOVE_PLATFORM_DATABASE_URL',
});

const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const NEON_HOST = /(?:^|\.)neon\.tech$/i;

export function isPublicBrowseSummaryRequest(request) {
  if (!request || request.method.toUpperCase() !== 'GET') return false;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  return path === '/api/community/trees' && url.searchParams.get('view') === 'summary';
}

export function isPublicBrowseSummaryDirectNeonSelected(env = {}) {
  const raw = typeof env?.[BROWSE_SUMMARY_RUNTIME_ENV.GATE_FLAG] === 'string'
    ? env[BROWSE_SUMMARY_RUNTIME_ENV.GATE_FLAG].trim()
    : '';
  return raw === BROWSE_SUMMARY_RUNTIME_ENV.DIRECT_NEON_VALUE;
}

export function isNeonDatabaseUrl(value) {
  if (typeof value !== 'string' || !POSTGRES_URL.test(value)) return false;
  try {
    return NEON_HOST.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function readBrowseSummaryDirectConfig(env = {}) {
  const raw = typeof env?.[BROWSE_SUMMARY_RUNTIME_ENV.DATABASE_URL] === 'string'
    ? env[BROWSE_SUMMARY_RUNTIME_ENV.DATABASE_URL].trim()
    : '';
  const configured = isNeonDatabaseUrl(raw);
  return Object.freeze({
    configured,
    connectionString: configured ? raw : '',
  });
}

// Match the existing Product edge coercion in buildModalUrl() exactly before
// the FastAPI integer validator sees the forwarded value:
// Number(raw || 12) || 12, then clamp 1..60. This intentionally keeps
// Infinity -> 60 and -Infinity -> 1 rather than using the #4003 core's
// prototype-only non-finite fallback.
export function normalizeProductBrowseLimit(rawLimit) {
  const parsed = Number(rawLimit || 12) || 12;
  return Math.min(Math.max(parsed, 1), 60);
}

export async function createPublicBrowseSummaryDirectExecutor({ connectionString, executor } = {}) {
  if (typeof executor === 'function') return executor;
  if (!isNeonDatabaseUrl(connectionString)) {
    throw new TypeError('BROWSE_SUMMARY_DIRECT_NEON_CONFIG_INVALID');
  }

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString, { disableWarningInBrowsers: true });
  return async (text, values) => {
    const rows = await sql.query(text, Array.isArray(values) ? values : []);
    return Array.isArray(rows) ? rows : [];
  };
}

function responseHeaders(requestId, routeStatus = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'direct-neon',
    'x-lovebud-runtime': 'direct_neon',
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
    headers: responseHeaders(requestId, routeStatus),
  });
}

function buildIntegerLimitValidationBody(rawLimit) {
  return {
    detail: [{
      type: 'int_parsing',
      loc: ['query', 'limit'],
      msg: 'Input should be a valid integer, unable to parse string as an integer',
      input: String(rawLimit),
    }],
  };
}

export async function handlePublicBrowseSummaryDirectNeon(
  request,
  env = {},
  requestId = null,
  { executorOverride = null } = {}
) {
  if (!isPublicBrowseSummaryRequest(request) || !isPublicBrowseSummaryDirectNeonSelected(env)) {
    return null;
  }

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get('limit');
  const limit = normalizeProductBrowseLimit(rawLimit);
  if (!Number.isInteger(limit)) {
    return jsonResponse(buildIntegerLimitValidationBody(rawLimit), 422, requestId, 'invalid-limit');
  }

  const config = readBrowseSummaryDirectConfig(env);
  if (!config.configured && !executorOverride) {
    return jsonResponse({
      error: 'Browse summary direct-Neon runtime not configured',
      code: 'DIRECT_NEON_CONFIG_ABSENT',
    }, 503, requestId, 'config-absent');
  }

  try {
    const executor = await createPublicBrowseSummaryDirectExecutor({
      connectionString: config.connectionString,
      executor: executorOverride || undefined,
    });
    const trees = await fetchDirectNeonBrowseSummary(executor, {
      sort: url.searchParams.get('sort') || undefined,
      limit,
    });
    return jsonResponse(trees, 200, requestId, 'ok');
  } catch {
    return jsonResponse({
      error: 'Browse summary direct-Neon query failed',
      code: 'DIRECT_NEON_QUERY_FAILED',
    }, 500, requestId, 'query-failed');
  }
}

export const BROWSE_SUMMARY_DIRECT_NEON_CONTRACT = Object.freeze({
  method: 'GET',
  path: '/api/community/trees?view=summary',
  gateEnv: BROWSE_SUMMARY_RUNTIME_ENV.GATE_FLAG,
  databaseEnv: BROWSE_SUMMARY_RUNTIME_ENV.DATABASE_URL,
  directValue: BROWSE_SUMMARY_RUNTIME_ENV.DIRECT_NEON_VALUE,
  defaultRuntime: 'modal',
  writes: false,
});
