import {
  buildMemoryModalUrl,
  buildMemoryMissingModalConfigResponse,
  buildMemoryReadHeaders,
  isMemoryReadRequest,
  isMemoryRouteRequest,
  isMemoryWriteRequest,
  prepareMemoryWriteProxyRequest
} from '../_shared/memory-route-proxy.js';
import { readBoundedRequestBody } from '../_shared/bounded-request-body.js';
import {
  buildInvalidPathEncodingResponse,
  isInvalidPathEncodingError,
  normalizeEncodedPathSegment
} from '../_shared/path-segment.js';
import {
  handlePublicGrowingDirectNeon
} from '../_shared/love-platform-api-growing-neon-query.js';
import {
  handlePublicCommunityMemoriesDirectNeon,
  isPublicCommunityMemoriesDirectNeonSelected,
  isPublicCommunityMemoriesRequest
} from '../_shared/public-community-memories-direct-neon.js';

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

const REQUEST_ID_HEADER = 'x-lovebud-request-id';
const MAX_REQUEST_ID_LENGTH = 80;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const MODAL_FETCH_TIMEOUT_MS = 25000;

function generateRequestId() {
  return 'req-' + crypto.randomUUID();
}

function normalizeRequestId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_REQUEST_ID_LENGTH) return null;
  if (!SAFE_REQUEST_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function getOrCreateRequestId(request) {
  const existingRequestId = normalizeRequestId(request.headers.get(REQUEST_ID_HEADER));
  if (existingRequestId) return existingRequestId;
  return generateRequestId();
}

function buildBodyReadFailedResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'body-read-failed'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Request body read failed' }), {
    status: 503,
    headers
  });
}

function buildPayloadTooLargeResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'payload-too-large'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Request body too large' }), { status: 413, headers });
}

function isBrowseSummaryRequest(request) {
  if (request.method.toUpperCase() !== 'GET') return false;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  return path === '/api/community/trees' && url.searchParams.get('view') === 'summary';
}

function isPrivateTreeCapabilityRequest(request) {
  if (request.method.toUpperCase() !== 'GET') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return /^\/api\/private\/trees\/[^/]+\/capability$/.test(path);
}

// Hub-layout is a private/owner sub-resource read. Same-origin GET must be
// auth-first at the edge so an unauthenticated request never reaches Modal.
function isHubLayoutReadRequest(request) {
  if (request.method.toUpperCase() !== 'GET') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return /^\/api\/trees\/[^/]+\/hub-layout$/.test(path);
}

function isGrowingTreesRequest(request) {
  if (request.method.toUpperCase() !== 'GET') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return path === '/api/community/growing-trees';
}

function buildBrowseCacheRequest(request) {
  const url = new URL(request.url);
  const requestedSort = url.searchParams.get('sort');
  const sort = requestedSort === 'popular'
    ? 'popular'
    : requestedSort === 'likes'
      ? 'likes'
      : requestedSort === 'views'
        ? 'views'
        : 'latest';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 12) || 12, 1), 60);
  const cacheUrl = new URL(url.origin);
  cacheUrl.pathname = '/__cache/community/trees';
  cacheUrl.searchParams.set('view', 'summary');
  cacheUrl.searchParams.set('sort', sort);
  cacheUrl.searchParams.set('limit', String(limit));
  return new Request(cacheUrl.toString(), { method: 'GET' });
}

function normalizeGrowingTreesLimit(rawLimit) {
  return Math.min(Math.max(Number(rawLimit || 6) || 6, 3), 12);
}

export function buildModalUrl(request, env) {
  const modalBaseUrl = stripTrailingSlash(env.MODAL_BASE_URL);
  if (!modalBaseUrl) return null;

  const sourceUrl = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = sourceUrl.pathname.replace(/\/+$/, '');
  const target = new URL(modalBaseUrl);

  if (path === '/api/community/trees' && sourceUrl.searchParams.get('view') === 'summary') {
    const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 12) || 12, 1), 60);
    const requestedSort = sourceUrl.searchParams.get('sort');
    const sort = requestedSort === 'popular'
      ? 'popular'
      : requestedSort === 'likes'
        ? 'likes'
        : requestedSort === 'views'
          ? 'views'
          : 'latest';
    target.pathname = '/modal/browse/latest';
    target.searchParams.set('limit', String(limit));
    target.searchParams.set('sort', sort);
    return target;
  }

  if (path === '/api/community/growing-trees') {
    const limit = normalizeGrowingTreesLimit(sourceUrl.searchParams.get('limit'));
    target.pathname = '/modal/browse/growing';
    target.searchParams.set('limit', String(limit));
    return target;
  }

  if (path === '/api/community/memories') {
    target.pathname = '/modal/community/memories';
    const treeId = sourceUrl.searchParams.get('treeId');
    const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 100) || 100, 1), 200);
    if (treeId) target.searchParams.set('treeId', treeId);
    target.searchParams.set('limit', String(limit));
    return target;
  }

  if (path === '/api/trees') {
    target.pathname = '/modal/private/trees';
    if (method === 'GET') {
      const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 100) || 100, 1), 200);
      target.searchParams.set('limit', String(limit));
    }
    return target;
  }

  const memoryTarget = buildMemoryModalUrl(request, env);
  if (memoryTarget) return memoryTarget;

  // POST /api/trees/:id/fork → /modal/private/trees/:id/fork
  const treeForkMatch = path.match(/^\/api\/trees\/([^/]+)\/fork$/);
  if (treeForkMatch && method === 'POST') {
    const treeId = normalizeEncodedPathSegment(treeForkMatch[1]);
    target.pathname = `/modal/private/trees/${treeId}/fork`;
    return target;
  }

  const capabilityMatch = path.match(/^\/api\/private\/trees\/([^/]+)\/capability$/);
  if (capabilityMatch) {
    const treeId = normalizeEncodedPathSegment(capabilityMatch[1]);
    target.pathname = `/modal/private/trees/${treeId}/capability`;
    return target;
  }

  const treeMatch = path.match(/^\/api\/trees\/([^/]+)$/);
  if (treeMatch) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const isWrite = ['PUT', 'DELETE'].includes(method);
    const treeId = normalizeEncodedPathSegment(treeMatch[1]);
    target.pathname = (isWrite || authHeader)
      ? `/modal/private/trees/${treeId}`
      : `/modal/trees/${treeId}`;
    return target;
  }

  // Tree hub-layout (same-origin PUT) → Modal POST /modal/private/trees/:id/hub-layout.
  // The canonical same-origin contract is PUT (#3058); the upstream Modal endpoint
  // is POST, so the edge gateway translates PUT → POST (see tryModalWrite).
  const hubLayoutMatch = path.match(/^\/api\/trees\/([^/]+)\/hub-layout$/);
  if (hubLayoutMatch) {
    const treeId = normalizeEncodedPathSegment(hubLayoutMatch[1]);
    target.pathname = `/modal/private/trees/${treeId}/hub-layout`;
    return target;
  }

  return null;
}

async function withUpstreamHeader(response, upstream, requestId = null) {
  const headers = new Headers(response.headers);
  if (upstream && !headers.has('x-lovebud-upstream')) {
    headers.set('x-lovebud-upstream', upstream);
  }
  if (requestId) {
    headers.set(REQUEST_ID_HEADER, requestId);
    const existingExposeHeaders = headers.get('Access-Control-Expose-Headers') || '';
    if (!existingExposeHeaders.includes(REQUEST_ID_HEADER)) {
      const exposeHeaders = existingExposeHeaders ? `${existingExposeHeaders}, ${REQUEST_ID_HEADER}` : `${REQUEST_ID_HEADER}`;
      headers.set('Access-Control-Expose-Headers', exposeHeaders);
    }
  }

  try {
    const bodyText = await response.text();
    return new Response(bodyText, { status: response.status, statusText: response.statusText, headers });
  } catch (e) {
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}

function isModalOwnedGetRoute(request, env) {
  if (request.method.toUpperCase() !== 'GET') return false;
  if (isMemoryReadRequest(request)) return true;
  const modalUrl = buildModalUrl(request, env || {});
  return modalUrl !== null;
}

function isModalOwnedWriteRoute(request, env) {
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'DELETE'].includes(method)) return false;
  if (isMemoryWriteRequest(request)) return true;

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');

  if (method === 'POST' && path.match(/^\/api\/trees\/[^/]+\/fork$/)) {
    return buildModalUrl(request, env || {}) !== null;
  }

  if (method === 'POST' && ['/api/trees', '/api/memories'].includes(path)) {
    return buildModalUrl(request, env || {}) !== null;
  }

  const isDetail = path.match(/^\/api\/(trees|memories)\/[^/]+$/);
  if (['PUT', 'DELETE'].includes(method) && isDetail) {
    return buildModalUrl(request, env || {}) !== null;
  }

  // Same-origin PUT /api/trees/:id/hub-layout → Modal POST (translated in tryModalWrite).
  if (method === 'PUT' && path.match(/^\/api\/trees\/[^/]+\/hub-layout$/)) {
    return buildModalUrl(request, env || {}) !== null;
  }

  return false;
}

function buildNotFoundResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'unhandled'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Route not found' }), { status: 404, headers });
}

function buildMethodNotAllowedResponse(allow = 'GET', requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'method-not-allowed',
    'allow': allow,
    [REQUEST_ID_HEADER]: requestId
  };
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}

function buildModalUnavailableResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'modal',
    'x-lovebud-degraded': 'modal-unavailable'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Modal backend unavailable' }), { status: 503, headers });
}

function hasAuthorizationHeader(request) {
  return !!(request.headers.get('authorization') || request.headers.get('Authorization'));
}

function buildMissingAuthorizationResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'missing-authorization'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers });
}

function buildModalTimeoutResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'modal',
    'x-lovebud-route-status': 'modal-timeout'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Modal upstream timeout' }), { status: 504, headers });
}

function getSafeUrlLog(url) {
  if (!url) return 'null';
  try {
    const u = new URL(url.toString());
    return `${u.origin}${u.pathname}`;
  } catch (e) {
    return 'invalid-url';
  }
}

async function fetchWithTimeout(url, options = {}) {
  const { timeout = MODAL_FETCH_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function tryModalRead(request, env, requestId = null) {
  if (request.method.toUpperCase() !== 'GET') return null;

  const modalUrl = buildModalUrl(request, env || {});
  if (!modalUrl) return null;

  const isMemoryRead = isMemoryReadRequest(request);
  const headers = isMemoryRead
    ? buildMemoryReadHeaders(request, requestId)
    : {
        accept: 'application/json',
        ...(request.headers.get('authorization') ? { authorization: request.headers.get('authorization') } : {})
      };
  if (!isMemoryRead && requestId) headers[REQUEST_ID_HEADER] = requestId;

  const urlLog = getSafeUrlLog(modalUrl);
  console.log(`[LoveBudCloudflareProxy] GET -> ${urlLog} (id=${requestId})`);

  let response;
  try {
    response = await fetchWithTimeout(modalUrl.toString(), { headers });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`[LoveBudCloudflareProxy] Modal read timeout (25s): ${urlLog} (id=${requestId})`);
      return buildModalTimeoutResponse(requestId);
    }
    throw error;
  }

  const sourceUrl = new URL(request.url);
  const path = sourceUrl.pathname.replace(/\/+$/, '');
  const treeMatch = path.match(/^\/api\/trees\/([^/]+)$/);
  if (treeMatch && response.status === 404 && request.headers.get('authorization')) {
    const publicTarget = new URL(stripTrailingSlash(env.MODAL_BASE_URL));
    publicTarget.pathname = `/modal/trees/${normalizeEncodedPathSegment(treeMatch[1])}`;
    const publicUrlLog = getSafeUrlLog(publicTarget);
    console.log(`[LoveBudCloudflareProxy] 404 Fallback GET -> ${publicUrlLog} (id=${requestId})`);
    try {
      return await fetchWithTimeout(publicTarget.toString(), { headers: { accept: 'application/json' } });
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`[LoveBudCloudflareProxy] Modal fallback read timeout (25s): ${publicUrlLog} (id=${requestId})`);
        return buildModalTimeoutResponse(requestId);
      }
      throw error;
    }
  }

  return response;
}

async function tryModalWrite(request, env, requestId = null) {
  const method = request.method.toUpperCase();
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  if (!['POST', 'PUT', 'DELETE'].includes(method)) return null;
  if (!isModalOwnedWriteRoute(request, env || {})) return null;

  if (isMemoryWriteRequest(request)) {
    const prepared = await prepareMemoryWriteProxyRequest(request, env || {}, { requestId });
    if (prepared.response) return prepared.response;

    const urlLog = getSafeUrlLog(prepared.target);
    console.log(`[LoveBudCloudflareProxy] ${method} -> ${urlLog} (id=${requestId})`);

    try {
      return await fetchWithTimeout(prepared.target.toString(), prepared.fetchOptions);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`[LoveBudCloudflareProxy] Modal write timeout (25s): ${urlLog} (id=${requestId})`);
        return buildModalTimeoutResponse(requestId);
      }
      throw error;
    }
  }

  // Reject private write without Authorization before body read
  if (!hasAuthorizationHeader(request)) {
    console.warn(`[LoveBudCloudflareProxy] Missing auth for ${method} private write (id=${requestId})`);
    return buildMissingAuthorizationResponse(requestId);
  }

  let boundedBody = null;
  if (method !== 'DELETE') {
    const bodyResult = await readBoundedRequestBody(request);
    if (bodyResult.status === 'tooLarge') {
      return buildPayloadTooLargeResponse(requestId);
    }
    if (bodyResult.status === 'readError') {
      return buildBodyReadFailedResponse(requestId);
    }
    boundedBody = bodyResult.body;
  }

  const hubLayoutPath = path.match(/^\/api\/trees\/[^/]+\/hub-layout$/);
  // Modal upstream only exposes POST for hub-layout; translate the canonical
  // same-origin PUT to POST while preserving headers, body and request-id.
  const upstreamMethod = hubLayoutPath ? 'POST' : method;

  const modalUrl = buildModalUrl(request, env || {});
  if (!modalUrl) return null;

  const headers = {
    accept: 'application/json',
    'content-type': request.headers.get('content-type') || 'application/json',
    ...(request.headers.get('authorization') ? { authorization: request.headers.get('authorization') } : {})
  };

  if (requestId) headers[REQUEST_ID_HEADER] = requestId;

  const urlLog = getSafeUrlLog(modalUrl);
  console.log(`[LoveBudCloudflareProxy] ${method} -> ${urlLog} (id=${requestId})`);

  try {
    return await fetchWithTimeout(modalUrl.toString(), {
      method: upstreamMethod,
      headers,
      body: upstreamMethod !== 'DELETE' ? boundedBody : null
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`[LoveBudCloudflareProxy] Modal write timeout (25s): ${urlLog} (id=${requestId})`);
      return buildModalTimeoutResponse(requestId);
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function withPublicTreeCacheStatus(response, status) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-public-tree-cache', status);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function isAnonymousPublicTreeReadRequest(request) {
  if (request.method.toUpperCase() !== 'GET') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const match = path.match(/^\/api\/trees\/([^/]+)$/);
  if (!match) return false;
  return !hasAuthorizationHeader(request);
}

// ─────────────────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;
  const requestId = getOrCreateRequestId(request);

  if (isMemoryRouteRequest(request) && !stripTrailingSlash((env || {}).MODAL_BASE_URL)) {
    return buildMemoryMissingModalConfigResponse(requestId);
  }

  let isModalOwned;
  let isModalOwnedWrite;
  try {
    isModalOwned = isModalOwnedGetRoute(request, env || {});
    isModalOwnedWrite = isModalOwnedWriteRoute(request, env || {});
  } catch (error) {
    if (isInvalidPathEncodingError(error)) {
      return buildInvalidPathEncodingResponse(requestId, REQUEST_ID_HEADER);
    }
    throw error;
  }

  if (isModalOwnedWrite) {
    try {
      const modalResponse = await tryModalWrite(request, env || {}, requestId);
      if (modalResponse) return await withUpstreamHeader(modalResponse, 'modal', requestId);
    } catch (error) {
      if (isInvalidPathEncodingError(error)) {
        return buildInvalidPathEncodingResponse(requestId, REQUEST_ID_HEADER);
      }
      console.warn('[LoveBudCloudflareProxy] Modal write failed, returning 503', error);
      return buildModalUnavailableResponse(requestId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  // ─── Public Community Memories (Phase-2 Gated Direct Neon Runtime) ──────────
  if (isPublicCommunityMemoriesRequest(request) && isPublicCommunityMemoriesDirectNeonSelected(env || {})) {
    return await handlePublicCommunityMemoriesDirectNeon(request, env || {}, requestId);
  }

  // ─── Anonymous Public Growing Trees (Phase-2 Gated Direct Neon Runtime) ──────
  if (isGrowingTreesRequest(request)) {
    const runtime = typeof env?.LB_GROWING_READ_RUNTIME === 'string'
      ? env.LB_GROWING_READ_RUNTIME.trim()
      : '';
    if (runtime === 'direct_neon') {
      return await handlePublicGrowingDirectNeon(request, env || {}, requestId);
    }
  }

  // ─── Anonymous Public Tree Detail (no explicit Cache API) ───────────────────────
  // A Tree visibility may be revoked at any time; a POP-local Cache API entry could
  // keep serving a stale public body. Anonymous Tree detail therefore reaches the
  // current public Modal authority on every request and is marked no-store.
  if (isAnonymousPublicTreeReadRequest(request)) {
    try {
      const modalResponse = await tryModalRead(request, env || {}, requestId);
      if (modalResponse) {
        const headers = new Headers(modalResponse.headers);
        headers.set('Cache-Control', 'no-store');
        const freshResp = new Response(modalResponse.body, {
          status: modalResponse.status,
          statusText: modalResponse.statusText,
          headers
        });
        return await withUpstreamHeader(freshResp, 'modal', requestId);
      }
      // Fail closed: anonymous Tree detail must always produce an answer from authority.
      return buildModalUnavailableResponse(requestId);
    } catch (error) {
      if (isInvalidPathEncodingError(error)) {
        return buildInvalidPathEncodingResponse(requestId, REQUEST_ID_HEADER);
      }
      console.warn('[LoveBudCloudflareProxy] Modal read failed for public tree, returning 503', error);
      return buildModalUnavailableResponse(requestId);
    }
  }

  if (isBrowseSummaryRequest(request)) {
    const cache = caches.default;
    const cacheKey = buildBrowseCacheRequest(request);
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) return await withUpstreamHeader(cachedResponse, 'modal', requestId);

    try {
      const modalResponse = await tryModalRead(request, env || {}, requestId);
      if (modalResponse && modalResponse.ok) {
        const cacheableResponse = new Response(modalResponse.body, {
          status: modalResponse.status,
          statusText: modalResponse.statusText,
          headers: modalResponse.headers
        });
        cacheableResponse.headers.set('Cache-Control', 'public, max-age=420, stale-while-revalidate=120');
        await cache.put(cacheKey, cacheableResponse.clone());
        return await withUpstreamHeader(cacheableResponse, 'modal', requestId);
      }
      if (modalResponse) return await withUpstreamHeader(modalResponse, 'modal', requestId);
    } catch (error) {
      if (isInvalidPathEncodingError(error)) {
        return buildInvalidPathEncodingResponse(requestId, REQUEST_ID_HEADER);
      }
      if (isModalOwned) {
        console.warn('[LoveBudCloudflareProxy] Modal read failed, returning 503', error);
        return buildModalUnavailableResponse(requestId);
      }
    }
  } else {
    if (isPrivateTreeCapabilityRequest(request) && !hasAuthorizationHeader(request)) {
      return buildMissingAuthorizationResponse(requestId);
    }
    // Hub-layout is a private/owner read: block unauthenticated GET at the edge
    // (auth-first) so it never triggers a Modal fetch; rely on Modal 401 only as
    // the downstream fallback, not the primary gate.
    if (isHubLayoutReadRequest(request) && !hasAuthorizationHeader(request)) {
      return buildMissingAuthorizationResponse(requestId);
    }
    try {
      const modalResponse = await tryModalRead(request, env || {}, requestId);
      if (modalResponse) {
        let finalResponse = modalResponse;
        if (request.method.toUpperCase() === 'GET' && hasAuthorizationHeader(request)) {
          const path = new URL(request.url).pathname.replace(/\/+$/, '');
          if (path.match(/^\/api\/trees\/[^/]+$/)) {
            finalResponse = withPublicTreeCacheStatus(modalResponse, 'bypass-auth');
          }
        }
        return await withUpstreamHeader(finalResponse, 'modal', requestId);
      }
    } catch (error) {
      if (isInvalidPathEncodingError(error)) {
        return buildInvalidPathEncodingResponse(requestId, REQUEST_ID_HEADER);
      }
      if (isModalOwned) {
        console.warn('[LoveBudCloudflareProxy] Modal read failed, returning 503', error);
        return buildModalUnavailableResponse(requestId);
      }
    }
  }

  let modalUrl;
  try {
    modalUrl = buildModalUrl(request, env || {});
  } catch (error) {
    if (isInvalidPathEncodingError(error)) {
      return buildInvalidPathEncodingResponse(requestId, REQUEST_ID_HEADER);
    }
    throw error;
  }
  if (modalUrl) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const isForkPath = path.match(/^\/api\/trees\/[^/]+\/fork$/);
    const isCollection = ['/api/trees', '/api/memories'].includes(path);
    const isDetail = path.match(/^\/api\/(trees|memories)\/[^/]+$/);
    const isCapability = path.match(/^\/api\/private\/trees\/[^/]+\/capability$/);
    const isHubLayoutPath = path.match(/^\/api\/trees\/[^/]+\/hub-layout$/);
    const allow = isForkPath ? 'POST' : (isCollection ? 'GET, POST' : (isDetail ? 'GET, PUT, DELETE' : (isCapability ? 'GET' : (isHubLayoutPath ? 'GET, PUT' : 'GET'))));
    return buildMethodNotAllowedResponse(allow, requestId);
  }

  return buildNotFoundResponse(requestId);
}