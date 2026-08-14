import { validateWritePayload } from '../_shared/legacy-key-guard.js';
import {
  REQUEST_ID_HEADER,
  getOrCreateRequestId
} from '../_shared/request-id.js';
import { fetchModalWithTimeout, isModalTimeoutError } from '../_shared/modal-fetch.js';
import { readBoundedRequestBody } from '../_shared/bounded-request-body.js';

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
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

async function withModalHeaderAndId(response, requestId = null) {
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

function buildPayloadTooLargeResponse(requestId = null) {
  const headers = { 'content-type': 'application/json; charset=utf-8' };
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
    headers['Access-Control-Expose-Headers'] = REQUEST_ID_HEADER;
  }
  return new Response(JSON.stringify({ error: 'Payload too large' }), {
    status: 413,
    headers
  });
}

function buildBodyReadFailedResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'body-read-failed'
  };
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
    headers['Access-Control-Expose-Headers'] = REQUEST_ID_HEADER;
  }
  return new Response(JSON.stringify({ error: 'Request body read failed' }), {
    status: 503,
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
  return new Response(JSON.stringify({ error: 'Modal service temporarily unavailable' }), {
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

function clampOwnerTreesLimit(rawLimit) {
  return Math.min(Math.max(Number(rawLimit || 100) || 100, 1), 200);
}

export function buildPrivateTreesModalUrl(request, env = {}) {
  const modalBaseUrl = stripTrailingSlash(env?.MODAL_BASE_URL);
  if (!modalBaseUrl) return null;

  const sourceUrl = new URL(request.url);
  const target = new URL('/modal/private/trees', modalBaseUrl);
  target.searchParams.set('limit', String(clampOwnerTreesLimit(sourceUrl.searchParams.get('limit'))));

  const pagination = sourceUrl.searchParams.get('pagination');
  if (pagination) target.searchParams.set('pagination', pagination);
  const cursor = sourceUrl.searchParams.get('cursor');
  if (cursor) target.searchParams.set('cursor', cursor);

  return target;
}

export async function onRequestGet(context) {
  const request = context.request;
  const requestId = getOrCreateRequestId(request);

  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
      status: 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        [REQUEST_ID_HEADER]: requestId,
        'Access-Control-Expose-Headers': REQUEST_ID_HEADER
      }
    });
  }

  const target = buildPrivateTreesModalUrl(request, context.env);

  const modalRequestHeaders = {
    accept: 'application/json',
  };
  if (request.headers.get('authorization')) {
    modalRequestHeaders.authorization = request.headers.get('authorization');
  }
  modalRequestHeaders[REQUEST_ID_HEADER] = requestId;

  let response;
  try {
    response = await fetchModalWithTimeout(target.toString(), {
      headers: modalRequestHeaders
    });
  } catch (error) {
    if (isModalTimeoutError(error)) {
      return buildModalTimeoutResponse(requestId);
    }
    return buildModalUnavailableResponse(requestId);
  }

  return await withModalHeaderAndId(response, requestId);
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

export async function onRequestPost(context) {
  const { request } = context;
  const requestId = getOrCreateRequestId(request);

  if (!hasAuthorizationHeader(request)) {
    return buildMissingAuthorizationResponse(requestId);
  }

  const bodyResult = await readBoundedRequestBody(request);
  if (bodyResult.status === 'tooLarge') {
    return buildPayloadTooLargeResponse(requestId);
  }
  if (bodyResult.status === 'readError') {
    return buildBodyReadFailedResponse(requestId);
  }

  if (bodyResult.body) {
    try {
      const payload = JSON.parse(new TextDecoder().decode(bodyResult.body));
      let guard = validateWritePayload(payload, ['title', 'memo']);
      if (guard) {
        const h = new Headers(guard.headers);
        h.set(REQUEST_ID_HEADER, requestId);
        h.set('Access-Control-Expose-Headers', REQUEST_ID_HEADER);
        guard = new Response(guard.body, {
          status: guard.status,
          statusText: guard.statusText,
          headers: h
        });
      }
      if (guard) return guard;
    } catch (_) { }
  }

  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return buildModalConfigMissingResponse(requestId);
  }

  let response;
  try {
    response = await fetchModalWithTimeout(new URL('/modal/private/trees', modalBaseUrl).toString(), {
      method: 'POST',
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

  return await withModalHeaderAndId(response, requestId);
}
