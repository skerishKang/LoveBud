import { REQUEST_ID_HEADER, getOrCreateRequestId } from '../../../_shared/request-id.js';

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

const MODAL_FETCH_TIMEOUT_MS = 25000;

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

function withUpstreamHeaders(response, requestId) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-upstream', 'modal');
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

const KEY_PATTERN = /^[A-Za-z0-9._:\-]{8,128}$/;

function buildIdempotencyKeyRequiredResponse(requestId) {
  return new Response(JSON.stringify({
    error: 'Idempotency-Key header is required for this operation',
    code: 'IDEMPOTENCY_KEY_REQUIRED'
  }), {
    status: 400,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'idempotency-key-required',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildIdempotencyKeyInvalidResponse(requestId) {
  return new Response(JSON.stringify({
    error: 'Idempotency-Key must be 8-128 ASCII characters from [A-Za-z0-9._:-]',
    code: 'IDEMPOTENCY_KEY_INVALID'
  }), {
    status: 400,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'idempotency-key-invalid',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildModalUrl(request, env, query = '') {
  const modalBaseUrl = stripTrailingSlash(env.MODAL_BASE_URL);
  if (!modalBaseUrl) return null;
  const url = new URL(request.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const treeId = parts[2] || '';
  if (!treeId) return null;
  const target = new URL(modalBaseUrl);
  target.pathname = `/modal/private/trees/${encodeURIComponent(decodeURIComponent(treeId))}/comments`;
  if (query) target.search = query;
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

async function proxyTreeCommentCreate(request, env) {
  const method = request.method.toUpperCase();
  const requestId = getOrCreateRequestId(request);
  if (method !== 'POST') return buildMethodNotAllowedResponse(requestId);
  if (!hasAuthorizationHeader(request)) return buildMissingAuthorizationResponse(requestId);

  const modalUrl = buildModalUrl(request, env || {});
  if (!modalUrl) return buildModalUnavailableResponse(requestId);

  const headers = {
    accept: 'application/json',
    authorization: request.headers.get('authorization') || request.headers.get('Authorization'),
    [REQUEST_ID_HEADER]: requestId
  };

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey) return buildIdempotencyKeyRequiredResponse(requestId);
  if (!KEY_PATTERN.test(idempotencyKey)) return buildIdempotencyKeyInvalidResponse(requestId);
  headers['Idempotency-Key'] = idempotencyKey;

  let bodyText;
  try {
    bodyText = await request.text();
  } catch (error) {
    return buildModalUnavailableResponse(requestId);
  }
  const hasBody = typeof bodyText === 'string' && bodyText.length > 0;
  headers['content-type'] = 'application/json; charset=utf-8';

  try {
    const response = await fetchWithTimeout(modalUrl.toString(), {
      method,
      headers,
      body: hasBody ? bodyText : '{}'
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

async function proxyTreeCommentRead(request, env) {
  const requestId = getOrCreateRequestId(request);
  const modalUrl = buildModalUrl(request, env || {}, new URL(request.url).search);
  if (!modalUrl) return buildModalUnavailableResponse(requestId);

  try {
    const response = await fetchWithTimeout(modalUrl.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        [REQUEST_ID_HEADER]: requestId
      }
    });
    return withUpstreamHeaders(response, requestId);
  } catch (error) {
    if (error.name === 'AbortError') return buildModalTimeoutResponse(requestId);
    return buildModalUnavailableResponse(requestId);
  }
}

export async function onRequestGet(context) {
  return proxyTreeCommentRead(context.request, context.env || {});
}

export async function onRequestPost(context) {
  return proxyTreeCommentCreate(context.request, context.env || {});
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  if (method === 'GET') return proxyTreeCommentRead(context.request, context.env || {});
  if (method === 'POST') return proxyTreeCommentCreate(context.request, context.env || {});
  return buildMethodNotAllowedResponse(getOrCreateRequestId(context.request));
}
