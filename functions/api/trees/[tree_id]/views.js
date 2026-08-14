import { REQUEST_ID_HEADER, getOrCreateRequestId } from '../../../_shared/request-id.js';
import { readBoundedRequestBody } from '../../../_shared/bounded-request-body.js';

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

const MODAL_FETCH_TIMEOUT_MS = 25000;

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
      allow: 'POST',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildPayloadTooLargeResponse(requestId) {
  return new Response(JSON.stringify({ error: 'Payload too large' }), {
    status: 413,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'payload-too-large',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function buildBodyReadFailedResponse(requestId) {
  return new Response(JSON.stringify({ error: 'Request body read failed' }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'cloudflare',
      'x-lovebud-route-status': 'body-read-failed',
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
  target.pathname = `/modal/public/trees/${encodeURIComponent(decodeURIComponent(treeId))}/views`;
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

async function proxyTreeView(request, env) {
  const method = request.method.toUpperCase();
  const requestId = getOrCreateRequestId(request);
  if (method !== 'POST') return buildMethodNotAllowedResponse(requestId);

  const bodyResult = await readBoundedRequestBody(request);
  if (bodyResult.status === 'tooLarge') {
    return buildPayloadTooLargeResponse(requestId);
  }
  if (bodyResult.status === 'readError') {
    return buildBodyReadFailedResponse(requestId);
  }

  const modalUrl = buildModalUrl(request, env || {});
  if (!modalUrl) return buildModalUnavailableResponse(requestId);

  const headers = {
    accept: 'application/json',
    'content-type': request.headers.get('content-type') || 'application/json',
    [REQUEST_ID_HEADER]: requestId
  };

  try {
    const response = await fetchWithTimeout(modalUrl.toString(), {
      method: 'POST',
      headers,
      body: bodyResult.body
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

export async function onRequestPost(context) {
  return proxyTreeView(context.request, context.env || {});
}

export async function onRequest(context) {
  return proxyTreeView(context.request, context.env || {});
}
