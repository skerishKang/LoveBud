import { fetchModalWithTimeout, isModalTimeoutError } from '../../_shared/modal-fetch.js';

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

function withPublicTreeCacheStatus(response, status) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-public-tree-cache', status);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function buildModalUnavailableResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'modal',
    'x-lovebud-degraded': 'modal-unavailable'
  };
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
    headers['Access-Control-Expose-Headers'] = REQUEST_ID_HEADER;
  }
  return new Response(JSON.stringify({ error: 'Modal backend unavailable' }), { status: 503, headers });
}

function buildModalTimeoutResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'modal',
    'x-lovebud-route-status': 'modal-timeout'
  };
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
    headers['Access-Control-Expose-Headers'] = REQUEST_ID_HEADER;
  }
  return new Response(JSON.stringify({ error: 'Modal upstream timeout' }), { status: 504, headers });
}

async function fetchTreeModal(target, fetchOptions, requestId = null) {
  try {
    return {
      response: await fetchModalWithTimeout(target.toString(), fetchOptions),
      errorResponse: null
    };
  } catch (error) {
    return {
      response: null,
      errorResponse: isModalTimeoutError(error)
        ? buildModalTimeoutResponse(requestId)
        : buildModalUnavailableResponse(requestId)
    };
  }
}

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

  // Authenticated requests: route through owner/private authority, cache-independent
  if (authHeader) {
    const primaryTarget = new URL(`/modal/private/trees/${treeId}`, modalBaseUrl);
    const primary = await fetchTreeModal(primaryTarget, {
      headers: {
        accept: 'application/json',
        authorization: authHeader
      }
    }, requestId);
    if (primary.errorResponse) return primary.errorResponse;

    let response = primary.response;
    if (response.status === 404) {
      const publicTarget = new URL(`/modal/trees/${treeId}`, modalBaseUrl);
      const fallback = await fetchTreeModal(publicTarget, {
        headers: {
          accept: 'application/json'
        }
      }, requestId);
      if (fallback.errorResponse) return fallback.errorResponse;
      response = fallback.response;
    }

    const finalResp = withPublicTreeCacheStatus(response, 'bypass-auth');
    return await withUpstreamHeaderAndId(finalResp, 'modal', requestId);
  }

  // Anonymous requests: reach the current public Modal authority on every request.
  // No explicit Cache API persistence: a Tree's visibility may be revoked at any
  // time, and a POP-local cache entry could keep serving a stale public body.
  const targetUrl = new URL(`/modal/trees/${treeId}`, modalBaseUrl);
  const result = await fetchTreeModal(targetUrl, {
    headers: {
      accept: 'application/json'
    }
  }, requestId);
  if (result.errorResponse) return result.errorResponse;

  // Forward status/body unchanged (404/403/5xx pass through); never cache.
  const headers = new Headers(result.response.headers);
  headers.set('Cache-Control', 'no-store');
  const freshResp = new Response(result.response.body, {
    status: result.response.status,
    statusText: result.response.statusText,
    headers
  });
  return await withUpstreamHeaderAndId(freshResp, 'modal', requestId);
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
  const result = await fetchTreeModal(target, {
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
  if (result.errorResponse) return result.errorResponse;

  return withModalHeader(result.response);
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
  const result = await fetchTreeModal(target, {
    method: 'DELETE',
    headers: {
      accept: 'application/json',
      ...(context.request.headers.get('authorization')
        ? { authorization: context.request.headers.get('authorization') }
        : {})
    }
  });
  if (result.errorResponse) return result.errorResponse;

  return withModalHeader(result.response);
}
