function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

const REQUEST_ID_HEADER = 'x-lovebud-request-id';
const MAX_REQUEST_ID_LENGTH = 80;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const MAX_WRITE_BODY_BYTES = 128 * 1024;

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
    'x-lovebud-route-status': 'payload-too-large',
    'x-lovebud-dbg-entered': '1'
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

function withUpstreamHeader(response, upstream, requestId = null, dbgPath = null) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-upstream', upstream);
  headers.set('x-lovebud-dbg-entered', '1');
  if (dbgPath) headers.set('x-lovebud-dbg-path', dbgPath);
  if (requestId) {
    headers.set(REQUEST_ID_HEADER, requestId);
    const existingExposeHeaders = headers.get('Access-Control-Expose-Headers') || '';
    const exposeHeaders = existingExposeHeaders ? `${existingExposeHeaders}, ${REQUEST_ID_HEADER}, x-lovebud-dbg-entered, x-lovebud-dbg-path, x-lovebud-dbg-write` : `${REQUEST_ID_HEADER}, x-lovebud-dbg-entered, x-lovebud-dbg-path, x-lovebud-dbg-write`;
    headers.set('Access-Control-Expose-Headers', exposeHeaders);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
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
    'x-lovebud-route-status': 'unhandled',
    'x-lovebud-dbg-entered': '1'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Route not found' }), { status: 404, headers });
}

function buildMethodNotAllowedResponse(allow = 'GET', requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'method-not-allowed',
    'x-lovebud-dbg-entered': '1',
    'allow': allow,
    [REQUEST_ID_HEADER]: requestId
  };
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}

function buildModalUnavailableResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'modal',
    'x-lovebud-dbg-entered': '1',
    'x-lovebud-degraded': 'modal-unavailable'
  };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Modal backend unavailable' }), { status: 503, headers });
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

  const response = await fetch(modalUrl.toString(), { headers });

  const sourceUrl = new URL(request.url);
  const path = sourceUrl.pathname.replace(/\/+$/, '');
  const treeMatch = path.match(/^\/api\/trees\/([^/]+)$/);
  if (treeMatch && response.status === 404 && request.headers.get('authorization')) {
    const publicTarget = new URL(stripTrailingSlash(env.MODAL_BASE_URL));
    publicTarget.pathname = `/modal/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}`;
    const publicResponse = await fetch(publicTarget.toString(), { headers: { accept: 'application/json' } });
    return withUpstreamHeader(publicResponse, 'modal', requestId, 'read-public-fallback');
  }

  return withUpstreamHeader(response, 'modal', requestId, 'read');
}

async function tryModalWrite(request, env, requestId = null) {
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'DELETE'].includes(method)) return null;
  if (!isModalOwnedWriteRoute(request, env || {})) return null;

  let boundedBody = null;
  if (method !== 'DELETE') {
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

  const response = await fetch(modalUrl.toString(), {
    method,
    headers,
    body: method !== 'DELETE' ? boundedBody : null
  });

  return withUpstreamHeader(response, 'modal', requestId, 'write');
}

// Debug: test header passthrough with Modal response
async function testModalPassthrough(request, env) {
  const requestId = getOrCreateRequestId(request);
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url') || '/api/community/trees?view=summary';
  const method = url.searchParams.get('method') || 'GET';
  
  const modalUrl = buildModalUrl(new Request(new URL(targetUrl, request.url), { method }), env || {});
  if (!modalUrl) {
    return new Response(JSON.stringify({ error: 'no modal url' }), { status: 400, headers: { 'content-type': 'application/json' }});
  }
  
  const modalResponse = await fetch(modalUrl.toString(), {
    method,
    headers: { accept: 'application/json' }
  });
  
  // Test 1: new Response with stream body + custom headers
  const headers1 = new Headers(modalResponse.headers);
  headers1.set('x-lovebud-upstream', 'modal');
  headers1.set('x-lovebud-dbg-entered', '1');
  headers1.set('x-lovebud-dbg-method', 'stream-passthrough');
  headers1.set('x-lovebud-test-stream', '1');
  if (requestId) headers1.set(REQUEST_ID_HEADER, requestId);
  const resp1 = new Response(modalResponse.body, { status: modalResponse.status, headers: headers1 });
  
  // Add special header after construction
  resp1.headers.set('x-lovebud-dbg-post-construct', '1');
  
  // Read body and wrap in response with metadata
  const bodyText = await resp1.text();
  const wrap = {
    meta: {
      method: 'stream-passthrough',
      status: modalResponse.status,
      headersFromConstructor: Array.from(headers1.entries()).reduce((acc, [k,v]) => { acc[k] = v; return acc; }, {}),
      finalHeaders: Array.from(resp1.headers.entries()).reduce((acc, [k,v]) => { acc[k] = v; return acc; }, {}),
      bodyLength: bodyText.length
    },
    body: bodyText.length > 500 ? bodyText.substring(0, 500) + '...' : bodyText
  };
  
  return new Response(JSON.stringify(wrap, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-dbg-entered': '1',
      'x-lovebud-dbg-path': 'passthrough-test',
      [REQUEST_ID_HEADER]: requestId,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': `${REQUEST_ID_HEADER}, x-lovebud-dbg-entered, x-lovebud-dbg-path, x-lovebud-dbg-write`
    }
  });
}

async function handleBodySizeDiagnostic(request) {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const requestId = getOrCreateRequestId(request);
  const readMethod = url.searchParams.get('read') || 'text';

  const diag = {
    method,
    path: url.pathname,
    requestId,
    readMethod,
    contentLength: {
      present: request.headers.get('content-length') !== null,
      value: (() => { const v = request.headers.get('content-length'); return v !== null ? Number(v) : null; })()
    },
    requestBodyPresent: request.body !== null,
    codePaths: ['diagnostic-endpoint']
  };

  if (['POST', 'PUT'].includes(method)) {
    try {
      if (readMethod === 'text') {
        const text = await request.text();
        const encoded = new TextEncoder().encode(text);
        diag.readResult = {
          method: 'text()',
          length: text.length,
          byteLength: encoded.byteLength,
          exceeds128KB: encoded.byteLength > 128 * 1024
        };
      } else if (readMethod === 'arraybuffer') {
        const ab = await request.arrayBuffer();
        diag.readResult = {
          method: 'arrayBuffer()',
          byteLength: ab.byteLength,
          exceeds128KB: ab.byteLength > 128 * 1024
        };
      } else if (readMethod === 'stream') {
        const reader = request.body.getReader();
        let totalBytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;
        }
        diag.readResult = {
          method: 'stream.getReader()',
          byteLength: totalBytes,
          exceeds128KB: totalBytes > 128 * 1024
        };
      }
    } catch (e) {
      diag.readError = e.message || String(e);
      diag.readErrorName = e.name || 'Error';
    }
  }

  return new Response(JSON.stringify(diag, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-dbg-entered': '1',
      'x-lovebud-dbg-path': 'diagnostic',
      [REQUEST_ID_HEADER]: requestId,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': `${REQUEST_ID_HEADER}, x-lovebud-dbg-entered, x-lovebud-dbg-path, x-lovebud-dbg-write`
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const requestId = getOrCreateRequestId(request);

  // Diagnostic endpoints — runs before any routing
  const url = new URL(request.url);
  if (url.pathname === '/api/__diag/body-size') {
    return handleBodySizeDiagnostic(request);
  }
  if (url.pathname === '/api/__diag/passthrough') {
    return testModalPassthrough(request, env);
  }

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
    if (cachedResponse) return withUpstreamHeader(cachedResponse, 'modal', requestId, 'read-cache');

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
        return withUpstreamHeader(cacheableResponse, 'modal', requestId, 'read-browse-cacheable');
      }
      if (modalResponse) return withUpstreamHeader(modalResponse, 'modal', requestId, 'read-browse');
    } catch (error) {
      if (isModalOwned) {
        console.warn('[LoveBudCloudflareProxy] Modal read failed, returning 503', error);
        return buildModalUnavailableResponse(requestId);
      }
    }
  } else {
    try {
      const modalResponse = await tryModalRead(request, env || {}, requestId);
      if (modalResponse) return withUpstreamHeader(modalResponse, 'modal', requestId, 'read-nonbrowse');
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
