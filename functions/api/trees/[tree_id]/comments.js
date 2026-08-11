import { REQUEST_ID_HEADER, getOrCreateRequestId } from '../../../_shared/request-id.js';

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

const MODAL_FETCH_TIMEOUT_MS = 25000;
const MAX_WRITE_BODY_BYTES = 128 * 1024;

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

function getContentLengthBytes(request) {
  const raw = request.headers.get('content-length');
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function buildPayloadTooLargeResponse(requestId) {
  return new Response(JSON.stringify({ error: 'Request body too large' }), {
    status: 413,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'payload-too-large',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

async function readBoundedWriteBody(request) {
  if (!request.body) return { tooLarge: false, body: null, readError: false };

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_WRITE_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch (_) {
          // Best-effort cancellation only; the 413 boundary remains authoritative.
        }
        return { tooLarge: true, body: null, readError: false };
      }
      chunks.push(chunk);
    }
  } catch (_) {
    return { tooLarge: false, body: null, readError: true };
  }

  if (totalBytes === 0) return { tooLarge: false, body: null, readError: false };

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { tooLarge: false, body, readError: false };
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

  const contentLengthBytes = getContentLengthBytes(request);
  if (contentLengthBytes !== null && contentLengthBytes > MAX_WRITE_BODY_BYTES) {
    return buildPayloadTooLargeResponse(requestId);
  }

  const bodyCheck = await readBoundedWriteBody(request);
  if (bodyCheck.tooLarge) return buildPayloadTooLargeResponse(requestId);
  if (bodyCheck.readError) return buildModalUnavailableResponse(requestId);
  headers['content-type'] = 'application/json; charset=utf-8';

  try {
    const response = await fetchWithTimeout(modalUrl.toString(), {
      method,
      headers,
      body: bodyCheck.body || '{}'
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
