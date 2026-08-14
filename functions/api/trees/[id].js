import {
  REQUEST_ID_HEADER,
  getOrCreateRequestId
} from '../../_shared/request-id.js';
import { fetchModalWithTimeout, isModalTimeoutError } from '../../_shared/modal-fetch.js';

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
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

function withModalHeader(response, requestId = null) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-upstream', 'modal');
  if (requestId) {
    headers.set(REQUEST_ID_HEADER, requestId);
    const existingExposeHeaders = headers.get('Access-Control-Expose-Headers') || '';
    if (!existingExposeHeaders.includes(REQUEST_ID_HEADER)) {
      const exposeHeaders = existingExposeHeaders ? `${existingExposeHeaders}, ${REQUEST_ID_HEADER}` : `${REQUEST_ID_HEADER}`;
      headers.set('Access-Control-Expose-Headers', exposeHeaders);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

const MAX_BODY_SIZE = 131072; // 128KB

function buildPayloadTooLargeResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'payload-too-large'
  };
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
    headers['Access-Control-Expose-Headers'] = REQUEST_ID_HEADER;
  }
  return new Response(JSON.stringify({ error: 'Payload too large' }), {
    status: 413,
    headers
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

export async function onRequestGet(context) {
  const { request, env } = context;
  const requestId = getOrCreateRequestId(request);

  const modalBaseUrl = stripTrailingSlash(env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return buildModalConfigMissingResponse(requestId);
  }

  const treeId = context.params?.id;
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');

  // Authenticated requests: route through owner/private authority, cache-independent
  if (authHeader) {
    const primaryTarget = new URL(`/modal/private/trees/${treeId}`, modalBaseUrl);
    let response;
    try {
      response = await fetchModalWithTimeout(primaryTarget.toString(), {
        headers: {
          accept: 'application/json',
          authorization: authHeader
        }
      });

      if (response.status === 404) {
        const publicTarget = new URL(`/modal/trees/${treeId}`, modalBaseUrl);
        response = await fetchModalWithTimeout(publicTarget.toString(), {
          headers: {
            accept: 'application/json'
          }
        });
      }
    } catch (error) {
      if (isModalTimeoutError(error)) {
        return buildModalTimeoutResponse(requestId);
      }
      return buildModalUnavailableResponse(requestId);
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
    modalResponse = await fetchModalWithTimeout(targetUrl.toString(), {
      headers: {
        accept: 'application/json'
      }
    });
  } catch (error) {
    if (isModalTimeoutError(error)) {
      return buildModalTimeoutResponse(requestId);
    }
    return buildModalUnavailableResponse(requestId);
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

function buildMissingAuthorizationResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'missing-authorization'
  };
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
    headers['Access-Control-Expose-Headers'] = REQUEST_ID_HEADER;
  }
  return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers });
}

function buildModalConfigMissingResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'modal-config-missing'
  };
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
    headers['Access-Control-Expose-Headers'] = REQUEST_ID_HEADER;
  }
  return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
    status: 503,
    headers
  });
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
  return new Response(JSON.stringify({ error: 'Modal upstream timeout' }), {
    status: 504,
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
  return new Response(JSON.stringify({ error: 'Modal backend unavailable' }), {
    status: 503,
    headers
  });
}

export async function onRequestPut(context) {
  const { request } = context;
  const requestId = getOrCreateRequestId(request);

  if (!hasAuthorizationHeader(request)) {
    return buildMissingAuthorizationResponse(requestId);
  }

  const bodyResult = await readBoundedWriteBody(request);
  if (bodyResult.tooLarge) {
    return buildPayloadTooLargeResponse(requestId);
  }

  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return buildModalConfigMissingResponse(requestId);
  }

  const treeId = context.params?.id;
  const target = new URL(`/modal/private/trees/${treeId}`, modalBaseUrl);

  let response;
  try {
    response = await fetchModalWithTimeout(target.toString(), {
      method: 'PUT',
      headers: {
        accept: 'application/json',
        'content-type': request.headers.get('content-type') || 'application/json',
        ...(request.headers.get('authorization')
          ? { authorization: request.headers.get('authorization') }
          : {}),
        [REQUEST_ID_HEADER]: requestId
      },
      body: bodyResult.body
    });
  } catch (error) {
    if (isModalTimeoutError(error)) {
      return buildModalTimeoutResponse(requestId);
    }
    return buildModalUnavailableResponse(requestId);
  }

  return withModalHeader(response, requestId);
}

export async function onRequestDelete(context) {
  const { request } = context;
  const requestId = getOrCreateRequestId(request);

  if (!hasAuthorizationHeader(context.request)) {
    return buildMissingAuthorizationResponse(requestId);
  }

  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return buildModalConfigMissingResponse(requestId);
  }

  const treeId = context.params?.id;
  const target = new URL(`/modal/private/trees/${treeId}`, modalBaseUrl);

  let response;
  try {
    response = await fetchModalWithTimeout(target.toString(), {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        ...(context.request.headers.get('authorization')
          ? { authorization: context.request.headers.get('authorization') }
          : {}),
        [REQUEST_ID_HEADER]: requestId
      }
    });
  } catch (error) {
    if (isModalTimeoutError(error)) {
      return buildModalTimeoutResponse(requestId);
    }
    return buildModalUnavailableResponse(requestId);
  }

  return withModalHeader(response, requestId);
}
