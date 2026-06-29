function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

const REQUEST_ID_HEADER = 'x-lovebud-request-id';
const MAX_REQUEST_ID_LENGTH = 80;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

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

async function withUpstreamHeaderAndId(response, upstream, requestId = null) {
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

function withModalHeader(response) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-upstream', 'modal');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

const MAX_BODY_SIZE = 131072; // 128KB

function buildPayloadTooLargeResponse() {
  return new Response(JSON.stringify({ error: 'Payload too large' }), {
    status: 413,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
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
  if (encoded.byteLength > MAX_BODY_SIZE) {
    return { tooLarge: true, body: null };
  }

  return { tooLarge: false, body: encoded };
}

// ─── Cache Helpers ───────────────────────────────────────────────────────────

function buildPublicTreeReadCacheRequest(url, treeId) {
  const parsedUrl = new URL(url);
  const canonicalTreeId = encodeURIComponent(decodeURIComponent(treeId));
  const cacheUrl = new URL(parsedUrl.origin);
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

export async function onRequestGet(context) {
  const { request, env } = context;
  const requestId = getOrCreateRequestId(request);

  const modalBaseUrl = stripTrailingSlash(env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    const errResp = new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
    return await withUpstreamHeaderAndId(errResp, 'cloudflare', requestId);
  }

  const treeId = context.params?.id;
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');

  // Authenticated requests: bypass cache entirely
  if (authHeader) {
    const primaryTarget = new URL(`/modal/private/trees/${treeId}`, modalBaseUrl);
    let response;
    try {
      response = await fetch(primaryTarget.toString(), {
        headers: {
          accept: 'application/json',
          authorization: authHeader
        }
      });

      if (response.status === 404) {
        const publicTarget = new URL(`/modal/trees/${treeId}`, modalBaseUrl);
        response = await fetch(publicTarget.toString(), {
          headers: {
            accept: 'application/json'
          }
        });
      }
    } catch (e) {
      const errResp = new Response(JSON.stringify({ error: 'Modal backend unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } });
      return await withUpstreamHeaderAndId(errResp, 'modal', requestId);
    }

    const finalResp = withPublicTreeCacheStatus(response, 'bypass-auth');
    return await withUpstreamHeaderAndId(finalResp, 'modal', requestId);
  }

  // Anonymous requests: check cache first
  const cache = (typeof globalThis !== 'undefined' && globalThis.caches) ? globalThis.caches.default : (typeof caches !== 'undefined' ? caches.default : null);
  const cacheKey = buildPublicTreeReadCacheRequest(request.url, treeId);

  if (cache) {
    let cachedResponse = null;
    try {
      cachedResponse = await cache.match(cacheKey);
    } catch (e) {
      console.warn('[LoveBudCloudflareProxy] Cache match throw, bypassing to hit upstream', e);
    }

    if (cachedResponse) {
      if (isFreshPublicTreeCacheResponse(cachedResponse)) {
        const hitResp = withPublicTreeCacheStatus(cachedResponse, 'hit');
        return await withUpstreamHeaderAndId(hitResp, 'modal', requestId);
      } else {
        try {
          await cache.delete(cacheKey);
        } catch (e) {
          console.warn('[LoveBudCloudflareProxy] Cache delete throw', e);
        }
      }
    }
  }

  // Fetch fresh response
  const targetUrl = new URL(`/modal/trees/${treeId}`, modalBaseUrl);
  let modalResponse;
  try {
    modalResponse = await fetch(targetUrl.toString(), {
      headers: {
        accept: 'application/json'
      }
    });
  } catch (e) {
    const errResp = new Response(JSON.stringify({ error: 'Modal backend unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } });
    return await withUpstreamHeaderAndId(errResp, 'modal', requestId);
  }

  // Process eligibility and caching
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
    if (cache) {
      try {
        await cache.put(cacheKey, cacheableResponse.clone());
      } catch (e) {
        console.warn('[LoveBudCloudflareProxy] Cache put failed', e);
        putStatus = 'store-failed';
      }
    } else {
      putStatus = 'store-failed';
    }

    const freshResp = withPublicTreeCacheStatus(cacheableResponse, putStatus);
    return await withUpstreamHeaderAndId(freshResp, 'modal', requestId);
  } else {
    const skipResp = withPublicTreeCacheStatus(modalResponse, 'skip-noncacheable');
    return await withUpstreamHeaderAndId(skipResp, 'modal', requestId);
  }
}

function hasAuthorizationHeader(request) {
  return !!(request.headers.get('authorization') || request.headers.get('Authorization'));
}

function buildMissingAuthorizationResponse() {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'missing-authorization'
  };
  return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers });
}

export async function onRequestPut(context) {
  const { request } = context;

  if (!hasAuthorizationHeader(request)) {
    return buildMissingAuthorizationResponse();
  }

  const bodyResult = await readBoundedWriteBody(request);
  if (bodyResult.tooLarge) {
    return buildPayloadTooLargeResponse();
  }

  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  const treeId = context.params?.id;
  const target = new URL(`/modal/private/trees/${treeId}`, modalBaseUrl);
  const response = await fetch(target.toString(), {
    method: 'PUT',
    headers: {
      accept: 'application/json',
      'content-type': request.headers.get('content-type') || 'application/json',
      ...(request.headers.get('authorization')
        ? { authorization: request.headers.get('authorization') }
        : {})
    },
    body: bodyResult.body
  });

  return withModalHeader(response);
}

export async function onRequestDelete(context) {
  if (!hasAuthorizationHeader(context.request)) {
    return buildMissingAuthorizationResponse();
  }

  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  const treeId = context.params?.id;
  const target = new URL(`/modal/private/trees/${treeId}`, modalBaseUrl);
  const response = await fetch(target.toString(), {
    method: 'DELETE',
    headers: {
      accept: 'application/json',
      ...(context.request.headers.get('authorization')
        ? { authorization: context.request.headers.get('authorization') }
        : {})
    }
  });

  return withModalHeader(response);
}
