function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

const REQUEST_ID_HEADER = 'x-lovebud-request-id';
const MAX_REQUEST_ID_LENGTH = 80;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
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

function buildModalUnavailableResponse() {
  return new Response(JSON.stringify({ error: 'Modal backend unavailable' }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'modal',
      'x-lovebud-degraded': 'modal-unavailable'
    }
  });
}

function buildModalTimeoutResponse() {
  return new Response(JSON.stringify({ error: 'Modal upstream timeout' }), {
    status: 504,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'modal',
      'x-lovebud-route-status': 'modal-timeout'
    }
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = MODAL_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function modalFailureResponse(error) {
  if (error && error.name === 'AbortError') {
    return buildModalTimeoutResponse();
  }
  return buildModalUnavailableResponse();
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
    let response;
    try {
      response = await fetchWithTimeout(primaryTarget.toString(), {
        headers: {
          accept: 'application/json',
          authorization: authHeader
        }
      });

      if (response.status === 404) {
        const publicTarget = new URL(`/modal/trees/${treeId}`, modalBaseUrl);
        response = await fetchWithTimeout(publicTarget.toString(), {
          headers: {
            accept: 'application/json'
          }
        });
      }
    } catch (e) {
      const errResp = modalFailureResponse(e);
      return await withUpstreamHeaderAndId(errResp, 'modal', requestId);
    }

    const finalResp = withPublicTreeCacheStatus(response, 'bypass-auth');
    return await withUpstreamHeaderAndId(finalResp, 'modal', requestId);
  }

  // Anonymous requests: reach the current public Modal authority on every request.
  // No explicit Cache API persistence: a Tree's visibility may be revoked at any
  // time, and a POP-local cache entry could keep serving a stale public body.
  const targetUrl = new URL(`/modal/trees/${treeId}`, modalBaseUrl);
  let modalResponse;
  try {
    modalResponse = await fetchWithTimeout(targetUrl.toString(), {
      headers: {
        accept: 'application/json'
      }
    });
  } catch (e) {
    const errResp = modalFailureResponse(e);
    return await withUpstreamHeaderAndId(errResp, 'modal', requestId);
  }

  // Forward status/body unchanged (404/403/5xx pass through); never cache.
  const headers = new Headers(modalResponse.headers);
  headers.set('Cache-Control', 'no-store');
  const freshResp = new Response(modalResponse.body, {
    status: modalResponse.status,
    statusText: modalResponse.statusText,
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
  let response;
  try {
    response = await fetchWithTimeout(target.toString(), {
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
  } catch (error) {
    return modalFailureResponse(error);
  }

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
  let response;
  try {
    response = await fetchWithTimeout(target.toString(), {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        ...(context.request.headers.get('authorization')
          ? { authorization: context.request.headers.get('authorization') }
          : {})
      }
    });
  } catch (error) {
    return modalFailureResponse(error);
  }

  return withModalHeader(response);
}
