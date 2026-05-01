function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

function generateRequestId() {
  // Generate a non-sensitive request ID (UUID v4 format)
  // This is safe to log and propagate without exposing user data
  return 'req-' + crypto.randomUUID();
}

function getOrCreateRequestId(request) {
  // Check if request ID exists in incoming headers
  const existingRequestId = request.headers.get('x-lovebud-request-id');
  if (existingRequestId && typeof existingRequestId === 'string' && existingRequestId.length > 0) {
    return existingRequestId;
  }

  // Generate new request ID at Cloudflare boundary
  return generateRequestId();
}

function isBrowseSummaryRequest(request) {
  if (request.method.toUpperCase() !== 'GET') return false;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  return path === '/api/community/trees' && url.searchParams.get('view') === 'summary';
}

function buildBrowseCacheRequest(request) {
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
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

function buildModalUrl(request, env) {
  const modalBaseUrl = stripTrailingSlash(env.MODAL_BASE_URL);
  if (!modalBaseUrl) return null;

  const sourceUrl = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = sourceUrl.pathname.replace(/\/+$/, '');
  const target = new URL(modalBaseUrl);

  if (path === '/api/community/trees' && sourceUrl.searchParams.get('view') === 'summary') {
    const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 12) || 12, 1), 60);
    const sort = sourceUrl.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
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
    const isWrite = ['PUT', 'DELETE'].includes(method);
    target.pathname = isWrite
      ? `/modal/private/memories/${memoryId}`
      : `/modal/memories/${memoryId}`;
    return target;
  }

  // POST /api/trees/:id/fork → /modal/private/trees/:id/fork
  const treeForkMatch = path.match(/^\/api\/trees\/([^/]+)\/fork$/);
  if (treeForkMatch && method === 'POST') {
    const treeId = encodeURIComponent(decodeURIComponent(treeForkMatch[1]));
    target.pathname = `/modal/private/trees/${treeId}/fork`;
    return target;
  }

  const treeMatch = path.match(/^\/api\/trees\/([^/]+)$/);
  if (treeMatch) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const isWrite = ['PUT', 'DELETE'].includes(method);
    // GET: uses private path ONLY IF auth exists (for owner view), else public.
    // PUT/DELETE: always uses private path (auth failure handled by backend).
    target.pathname = (isWrite || authHeader)
      ? `/modal/private/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}`
      : `/modal/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}`;
    return target;
  }

  return null;
}

function withUpstreamHeader(response, upstream, requestId = null) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-upstream', upstream);
  if (requestId) {
    headers.set('x-lovebud-request-id', requestId);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
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

  // POST /api/trees/:id/fork
  if (method === 'POST' && path.match(/^\/api\/trees\/[^/]+\/fork$/)) {
    return buildModalUrl(request, env || {}) !== null;
  }

  // POST is for collection paths
  if (method === 'POST' && ['/api/trees', '/api/memories'].includes(path)) {
    return buildModalUrl(request, env || {}) !== null;
  }

  // PUT/DELETE are for detail paths
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
  if (requestId) {
    headers['x-lovebud-request-id'] = requestId;
  }
  return new Response(
    JSON.stringify({ error: 'Route not found' }),
    {
      status: 404,
      headers
    }
  );
}

function buildMethodNotAllowedResponse(allow = 'GET', requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'method-not-allowed',
    'allow': allow
  };
  if (requestId) {
    headers['x-lovebud-request-id'] = requestId;
  }
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    {
      status: 405,
      headers
    }
  );
}

function buildModalUnavailableResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'modal',
    'x-lovebud-degraded': 'modal-unavailable'
  };
  if (requestId) {
    headers['x-lovebud-request-id'] = requestId;
  }
  return new Response(
    JSON.stringify({ error: 'Modal backend unavailable' }),
    {
      status: 503,
      headers
    }
  );
}

async function tryModalRead(request, env, requestId = null) {
  if (request.method.toUpperCase() !== 'GET') return null;

  const modalUrl = buildModalUrl(request, env || {});
  if (!modalUrl) return null;

  const headers = {
    accept: 'application/json',
    ...(request.headers.get('authorization')
      ? { authorization: request.headers.get('authorization') }
      : {})
  };

  // Forward request ID to Modal
  if (requestId) {
    headers['x-lovebud-request-id'] = requestId;
  }

  const response = await fetch(modalUrl.toString(), { headers });

  const sourceUrl = new URL(request.url);
  const path = sourceUrl.pathname.replace(/\/+$/, '');
  const treeMatch = path.match(/^\/api\/trees\/([^/]+)$/);
  if (treeMatch && response.status === 404 && request.headers.get('authorization')) {
    const publicTarget = new URL(stripTrailingSlash(env.MODAL_BASE_URL));
    publicTarget.pathname = `/modal/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}`;
    const publicResponse = await fetch(publicTarget.toString(), {
      headers: {
        accept: 'application/json'
      }
    });
    return withUpstreamHeader(publicResponse, 'modal');
  }

  return withUpstreamHeader(response, 'modal');
}

async function tryModalWrite(request, env, requestId = null) {
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'DELETE'].includes(method)) return null;
  if (!isModalOwnedWriteRoute(request, env || {})) return null;

  const modalUrl = buildModalUrl(request, env || {});
  if (!modalUrl) return null;

  const headers = {
    accept: 'application/json',
    'content-type': request.headers.get('content-type') || 'application/json',
    ...(request.headers.get('authorization')
      ? { authorization: request.headers.get('authorization') }
      : {})
  };

  // Forward request ID to Modal
  if (requestId) {
    headers['x-lovebud-request-id'] = requestId;
  }

  const response = await fetch(modalUrl.toString(), {
    method,
    headers,
    body: method !== 'DELETE' ? request.body : null
  });

  return withUpstreamHeader(response, 'modal', requestId);
}

export async function onRequest(context) {
  const { request, env } = context;

  // Generate or retrieve request ID at Cloudflare boundary
  const requestId = getOrCreateRequestId(request);

  const isModalOwned = isModalOwnedGetRoute(request, env || {});
  const isModalOwnedWrite = isModalOwnedWriteRoute(request, env || {});

  if (isModalOwnedWrite) {
    try {
      const modalResponse = await tryModalWrite(request, env || {}, requestId);
      if (modalResponse) return modalResponse;
    } catch (error) {
      console.warn('[LoveBudCloudflareProxy] Modal write failed, returning 503', error);
      return buildModalUnavailableResponse(requestId);
    }
  }

  if (isBrowseSummaryRequest(request)) {
    const cache = caches.default;
    const cacheKey = buildBrowseCacheRequest(request);
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return withUpstreamHeader(cachedResponse, 'modal', requestId);
    }

    try {
      const modalResponse = await tryModalRead(request, env || {}, requestId);
      if (modalResponse && modalResponse.ok) {
        const cacheableResponse = new Response(modalResponse.body, modalResponse);
        cacheableResponse.headers.set('Cache-Control', 'public, max-age=420, stale-while-revalidate=120');
        await cache.put(cacheKey, cacheableResponse.clone());
        return withUpstreamHeader(cacheableResponse, 'modal', requestId);
      }
      if (modalResponse) return withUpstreamHeader(modalResponse, 'modal', requestId);
    } catch (error) {
      if (isModalOwned) {
        console.warn('[LoveBudCloudflareProxy] Modal read failed, returning 503', error);
        return buildModalUnavailableResponse(requestId);
      }
    }
  } else {
    try {
      const modalResponse = await tryModalRead(request, env || {}, requestId);
      if (modalResponse) return withUpstreamHeader(modalResponse, 'modal', requestId);
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
    const allow = isForkPath ? 'POST' : (isCollection ? 'GET, POST' : (isDetail ? 'GET, PUT, DELETE' : 'GET'));
    return buildMethodNotAllowedResponse(allow, requestId);
  }

  return buildNotFoundResponse(requestId);
}
