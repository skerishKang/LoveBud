function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

const REQUEST_ID_HEADER = 'x-lovebud-request-id';
const MODAL_FETCH_TIMEOUT_MS = 25000;

function generateRequestId() {
  return 'req-' + crypto.randomUUID();
}

function getOrCreateRequestId(request) {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  return existing || generateRequestId();
}

function hasAuthorizationHeader(request) {
  return !!(request.headers.get('authorization') || request.headers.get('Authorization'));
}

function buildMissingAuthorizationResponse(requestId) {
  return new Response(JSON.stringify({ error: 'Authorization required' }), {
    status: 401,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'missing-authorization',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildModalUnavailableResponse(requestId) {
  return new Response(JSON.stringify({ error: 'Modal backend unavailable' }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'modal',
      'x-lovebud-degraded': 'modal-unavailable',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildModalTimeoutResponse(requestId) {
  return new Response(JSON.stringify({ error: 'Modal upstream timeout' }), {
    status: 504,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'modal',
      'x-lovebud-route-status': 'modal-timeout',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildMethodNotAllowedResponse(requestId) {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'method-not-allowed',
      allow: 'GET, POST',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildModalUrl(request, env) {
  const modalBaseUrl = stripTrailingSlash(env.MODAL_BASE_URL);
  if (!modalBaseUrl) return null;
  const url = new URL(request.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const treeId = parts[2] || '';
  if (!treeId) return null;
  const target = new URL(modalBaseUrl);
  target.pathname = `/modal/private/trees/${encodeURIComponent(decodeURIComponent(treeId))}/likes`;
  return target;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODAL_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function proxyTreeLike(request, env) {
  const method = request.method.toUpperCase();
  const requestId = getOrCreateRequestId(request);
  if (!['GET', 'POST'].includes(method)) return buildMethodNotAllowedResponse(requestId);
  if (!hasAuthorizationHeader(request)) return buildMissingAuthorizationResponse(requestId);

  const modalUrl = buildModalUrl(request, env || {});
  if (!modalUrl) return buildModalUnavailableResponse(requestId);

  const headers = {
    accept: 'application/json',
    authorization: request.headers.get('authorization') || request.headers.get('Authorization'),
    [REQUEST_ID_HEADER]: requestId
  };

  try {
    const response = await fetchWithTimeout(modalUrl.toString(), {
      method,
      headers,
      body: null
    });
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('x-lovebud-upstream', 'modal');
    responseHeaders.set(REQUEST_ID_HEADER, requestId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    if (error.name === 'AbortError') return buildModalTimeoutResponse(requestId);
    return buildModalUnavailableResponse(requestId);
  }
}

export async function onRequestGet(context) {
  return proxyTreeLike(context.request, context.env || {});
}

export async function onRequestPost(context) {
  return proxyTreeLike(context.request, context.env || {});
}

export async function onRequest(context) {
  return proxyTreeLike(context.request, context.env || {});
}
