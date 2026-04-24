const DEFAULT_UPSTREAM_ORIGIN = 'https://lovebud.vercel.app';

const HOP_BY_HOP_HEADERS = [
  'connection',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
];

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

function buildUpstreamUrl(request, env) {
  const sourceUrl = new URL(request.url);
  const upstreamOrigin = stripTrailingSlash(env.LOVEBUD_UPSTREAM_ORIGIN || DEFAULT_UPSTREAM_ORIGIN);
  return new URL(`${sourceUrl.pathname}${sourceUrl.search}`, upstreamOrigin);
}

function buildForwardHeaders(request) {
  const headers = new Headers(request.headers);

  HOP_BY_HOP_HEADERS.forEach((header) => headers.delete(header));
  headers.set('x-lovebud-proxy', 'cloudflare-pages');

  return headers;
}

function isBrowseSummaryRequest(request) {
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
    const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 100) || 100, 1), 200);
    target.searchParams.set('limit', String(limit));
    return target;
  }

  if (path === '/api/memories') {
    target.pathname = '/modal/private/memories';
    const treeId = sourceUrl.searchParams.get('treeId');
    const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 100) || 100, 1), 200);
    if (treeId) target.searchParams.set('treeId', treeId);
    target.searchParams.set('limit', String(limit));
    return target;
  }

  const memoryMatch = path.match(/^\/api\/memories\/([^/]+)$/);
  if (memoryMatch) {
    target.pathname = `/modal/memories/${encodeURIComponent(decodeURIComponent(memoryMatch[1]))}`;
    return target;
  }

  const treeMatch = path.match(/^\/api\/trees\/([^/]+)$/);
  if (treeMatch) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    target.pathname = authHeader
      ? `/modal/private/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}`
      : `/modal/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}`;
    return target;
  }

  return null;
}

function withUpstreamHeader(response, upstream) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-upstream', upstream);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function tryModalRead(request, env) {
  if (request.method.toUpperCase() !== 'GET') return null;

  const modalUrl = buildModalUrl(request, env || {});
  if (!modalUrl) return null;

  const response = await fetch(modalUrl.toString(), {
    headers: {
      accept: 'application/json',
      ...(request.headers.get('authorization')
        ? { authorization: request.headers.get('authorization') }
        : {})
    }
  });

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

export async function onRequest(context) {
  const { request, env } = context;
  const upstreamUrl = buildUpstreamUrl(request, env || {});
  const method = request.method.toUpperCase();

  if (isBrowseSummaryRequest(request)) {
    const cache = caches.default;
    const cacheKey = buildBrowseCacheRequest(request);
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return withUpstreamHeader(cachedResponse, 'modal');
    }

    try {
      const modalResponse = await tryModalRead(request, env || {});
      if (modalResponse && modalResponse.ok) {
        const cacheableResponse = new Response(modalResponse.body, modalResponse);
        cacheableResponse.headers.set('Cache-Control', 'public, max-age=300');
        await cache.put(cacheKey, cacheableResponse.clone());
        return withUpstreamHeader(cacheableResponse, 'modal');
      }
      if (modalResponse) return modalResponse;
    } catch (error) {
      console.warn('[LoveBudCloudflareProxy] Modal read failed before response, falling back to Vercel', error);
    }
  } else {
    try {
      const modalResponse = await tryModalRead(request, env || {});
      if (modalResponse) return modalResponse;
    } catch (error) {
      console.warn('[LoveBudCloudflareProxy] Modal read failed before response, falling back to Vercel', error);
    }
  }

  const response = await fetch(upstreamUrl.toString(), {
    method,
    headers: buildForwardHeaders(request),
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    redirect: 'follow'
  });

  return withUpstreamHeader(response, 'vercel');
}
