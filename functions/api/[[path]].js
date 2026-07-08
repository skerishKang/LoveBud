function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

const REQUEST_ID_HEADER = 'x-lovebud-request-id';
const MAX_REQUEST_ID_LENGTH = 80;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const MAX_WRITE_BODY_BYTES = 128 * 1024;
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

function getContentLengthBytes(request) {
  const raw = request.headers.get('content-length');
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function isWriteContentLengthTooLarge(request) {
  const contentLengthBytes = getContentLengthBytes(request);
  return contentLengthBytes !== null && contentLengthBytes > MAX_WRITE_BODY_BYTES;
}

async function readBoundedWriteBody(request) {
  let bodyText;
  try {
    bodyText = await request.text();
  } catch (e) {
    return { tooLarge: true, body: null };
  }

  if (!bodyText) {
    return { tooLarge: false, body: null };
  }

  const encoder = new TextEncoder();
  const encoded = encoder.encode(bodyText);
  if (encoded.byteLength > MAX_WRITE_BODY_BYTES) {
    return { tooLarge: true, body: null };
  }

  return { tooLarge: false, body: encoded };
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

  if (path === '/api/memories') {
    target.pathname = '/modal/private/memories';
    if (method === 'GET') {
      const treeId = sourceUrl.searchParams.get('treeId');
      const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 100) || 100, 1), 200);
      if (treeId) target.searchParams.set('treeId', treeId);
      target.searchParams.set('limit', String(limit));
    }
    return target;
  }

  const memoryMatch = path.match(/^\/api\/memories\/([^/]+)$/);
  if (memoryMatch) {
    const memoryId = encodeURIComponent(decodeURIComponent(memoryMatch[1]));
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    // Signed-in reads use the authenticated detail endpoint so private memories
    // resolve; anonymous reads use the public detail endpoint. Mirrors /api/trees/:id (#3288).
    if (method === 'GET' && authHeader) {
      target.pathname = `/modal/private/memories/${memoryId}`;
      return target;
    }
    const isWrite = ['PUT', 'DELETE'].includes(method);
    target.pathname = isWrite ? `/modal/private/memories/${memoryId}` : `/modal/memories/${memoryId}`;
    return target;
  }

  // POST /api/trees/:id/fork → /modal/private/trees/:id/fork
  const treeForkMatch = path.match(/^\/api\/trees\/([^/]+)\/fork$/);
  if (treeForkMatch && method === 'POST') {
    const treeId = encodeURIComponent(decodeURIComponent(treeForkMatch[1]));
    target.pathname = `/modal/private/trees/${treeId}/fork`;
    return target;
  }

  const capabilityMatch = path.match(/^\/api\/private\/trees\/([^/]+)\/capability$/);
  if (capabilityMatch) {
    const treeId = encodeURIComponent(decodeURIComponent(capabilityMatch[1]));
    target.pathname = `/modal/private/trees/${treeId}/capability`;
    return target;
  }

  const treeMatch = path.match(/^\/api\/trees\/([^/]+)$/);
  if (treeMatch) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const isWrite = ['PUT', 'DELETE'].includes(method);
    target.pathname = (isWrite || authHeader)
      ? `/modal/private/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}`
      : `/modal/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}`;
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
  const modalUrl = buildModalUrl(request, env || {});
  return modalUrl !== null;
}

function isModalOwnedWriteRoute(request, env) {
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'DELETE'].includes(method)) return false;

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

  const headers = {
    accept: 'application/json',
    ...(request.headers.get('authorization') ? { authorization: request.headers.get('authorization') } : {})
  };

  if (requestId) headers[REQUEST_ID_HEADER] = requestId;

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
    publicTarget.pathname = `/modal/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}`;
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
  if (!['POST', 'PUT', 'DELETE'].includes(method)) return null;
  if (!isModalOwnedWriteRoute(request, env || {})) return null;

  // Reject private write without Authorization before body read
  if (!hasAuthorizationHeader(request)) {
    console.warn(`[LoveBudCloudflareProxy] Missing auth for ${method} private write (id=${requestId})`);
    return buildMissingAuthorizationResponse(requestId);
  }

  let boundedBody = null;
  if (method !== 'DELETE') {
    if (isWriteContentLengthTooLarge(request)) {
      return buildPayloadTooLargeResponse(requestId);
    }

    const bodyCheck = await readBoundedWriteBody(request);
    if (bodyCheck.tooLarge) {
      return buildPayloadTooLargeResponse(requestId);
    }
    boundedBody = bodyCheck.body;
  }

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
      method,
      headers,
      body: method !== 'DELETE' ? boundedBody : null
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`[LoveBudCloudflareProxy] Modal write timeout (25s): ${urlLog} (id=${requestId})`);
      return buildModalTimeoutResponse(requestId);
    }
    throw error;
  }
}

// ─── Public Tree Read Caching Helper Functions ───────────────────────────────

function isAnonymousPublicTreeReadRequest(request) {
  if (request.method.toUpperCase() !== 'GET') return false;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const match = path.match(/^\/api\/trees\/([^/]+)$/);
  if (!match) return false;
  return !hasAuthorizationHeader(request);
}

function buildPublicTreeReadCacheRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const match = path.match(/^\/api\/trees\/([^/]+)$/);
  const rawTreeId = match ? match[1] : '';
  const canonicalTreeId = encodeURIComponent(decodeURIComponent(rawTreeId));

  const cacheUrl = new URL(url.origin);
  cacheUrl.pathname = `/__cache/public/trees/${canonicalTreeId}`;
  return new Request(cacheUrl.toString(), { method: 'GET' });
}

function isFreshPublicTreeCacheResponse(response) {
  if (!response) return false;
  const expiresAtHeader = response.headers.get('x-lovebud-public-tree-cache-expires-at');
  if (!expiresAtHeader) return false;
  const expiresAt = Number(expiresAtHeader);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt;
}

async function isVerifiedPublicTreeCacheCandidate(response) {
  if (!response) return false;
  if (response.status !== 200) return false;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return false;

  if (response.headers.has('set-cookie') || response.headers.has('Set-Cookie')) return false;

  try {
    const cloned = response.clone();
    const data = await cloned.json();
    return data && data.visibility === 'public';
  } catch (e) {
    return false;
  }
}

function withPublicTreeCacheStatus(response, status) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-public-tree-cache', status);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;
  const requestId = getOrCreateRequestId(request);

  const isModalOwned = isModalOwnedGetRoute(request, env || {});
  const isModalOwnedWrite = isModalOwnedWriteRoute(request, env || {});

  if (isModalOwnedWrite) {
    try {
      const modalResponse = await tryModalWrite(request, env || {}, requestId);
      if (modalResponse) return await withUpstreamHeader(modalResponse, 'modal', requestId);
    } catch (error) {
      console.warn('[LoveBudCloudflareProxy] Modal write failed, returning 503', error);
      return buildModalUnavailableResponse(requestId);
    }
  }

  // ─── Public Tree Read Edge Cache Logic ─────────────────────────────────────
  if (isAnonymousPublicTreeReadRequest(request)) {
    const cache = (typeof globalThis !== 'undefined' && globalThis.caches) ? globalThis.caches.default : (typeof caches !== 'undefined' ? caches.default : null);
    if (!cache) {
      // Bypassed or stubbed when caches global is unavailable (e.g. in some unit tests)
      try {
        const modalResponse = await tryModalRead(request, env || {}, requestId);
        if (modalResponse) {
          const isCandidate = await isVerifiedPublicTreeCacheCandidate(modalResponse);
          if (isCandidate) {
            const freshResp = withPublicTreeCacheStatus(modalResponse, 'store-failed');
            return await withUpstreamHeader(freshResp, 'modal', requestId);
          } else {
            const skipResp = withPublicTreeCacheStatus(modalResponse, 'skip-noncacheable');
            return await withUpstreamHeader(skipResp, 'modal', requestId);
          }
        }
      } catch (error) {
        console.warn('[LoveBudCloudflareProxy] Modal read failed for public tree, returning 503', error);
        return buildModalUnavailableResponse(requestId);
      }
    } else {
      const cacheKey = buildPublicTreeReadCacheRequest(request);
      let cachedResponse = null;

      try {
        cachedResponse = await cache.match(cacheKey);
      } catch (e) {
        console.warn('[LoveBudCloudflareProxy] Cache match throw, bypassing to hit upstream', e);
      }

      if (cachedResponse) {
        if (isFreshPublicTreeCacheResponse(cachedResponse)) {
          const hitResp = withPublicTreeCacheStatus(cachedResponse, 'hit');
          return await withUpstreamHeader(hitResp, 'modal', requestId);
        } else {
          try {
            await cache.delete(cacheKey);
          } catch (e) {
            console.warn('[LoveBudCloudflareProxy] Cache delete throw', e);
          }
        }
      }

      try {
        const modalResponse = await tryModalRead(request, env || {}, requestId);
        if (modalResponse) {
          const isCandidate = await isVerifiedPublicTreeCacheCandidate(modalResponse);
          if (isCandidate) {
            const cacheableResponse = new Response(modalResponse.clone().body, {
              status: modalResponse.status,
              statusText: modalResponse.statusText,
              headers: modalResponse.headers
            });

            cacheableResponse.headers.set('Cache-Control', 'public, max-age=30, must-revalidate');
            const expiresAt = Date.now() + 30000;
            cacheableResponse.headers.set('x-lovebud-public-tree-cache-expires-at', String(expiresAt));

            let putStatus = 'miss';
            try {
              await cache.put(cacheKey, cacheableResponse.clone());
            } catch (e) {
              console.warn('[LoveBudCloudflareProxy] Cache put failed', e);
              putStatus = 'store-failed';
            }

            const freshResp = withPublicTreeCacheStatus(cacheableResponse, putStatus);
            return await withUpstreamHeader(freshResp, 'modal', requestId);
          } else {
            const skipResp = withPublicTreeCacheStatus(modalResponse, 'skip-noncacheable');
            return await withUpstreamHeader(skipResp, 'modal', requestId);
          }
        }
      } catch (error) {
        console.warn('[LoveBudCloudflareProxy] Modal read failed for public tree, returning 503', error);
        return buildModalUnavailableResponse(requestId);
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

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
      if (isModalOwned) {
        console.warn('[LoveBudCloudflareProxy] Modal read failed, returning 503', error);
        return buildModalUnavailableResponse(requestId);
      }
    }
  } else {
    if (isPrivateTreeCapabilityRequest(request) && !hasAuthorizationHeader(request)) {
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
      if (isModalOwned) {
        console.warn('[LoveBudCloudflareProxy] Modal read failed, returning 503', error);
        return buildModalUnavailableResponse(requestId);
      }
    }
  }

  const modalUrl = buildModalUrl(request, env || {});
  if (modalUrl) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const isForkPath = path.match(/^\/api\/trees\/[^/]+\/fork$/);
    const isCollection = ['/api/trees', '/api/memories'].includes(path);
    const isDetail = path.match(/^\/api\/(trees|memories)\/[^/]+$/);
    const isCapability = path.match(/^\/api\/private\/trees\/[^/]+\/capability$/);
    const allow = isForkPath ? 'POST' : (isCollection ? 'GET, POST' : (isDetail ? 'GET, PUT, DELETE' : (isCapability ? 'GET' : 'GET')));
    return buildMethodNotAllowedResponse(allow, requestId);
  }

  return buildNotFoundResponse(requestId);
}
