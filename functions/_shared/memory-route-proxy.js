import { validateWritePayload } from './legacy-key-guard.js';
import { fetchModalWithTimeout, isModalTimeoutError } from './modal-fetch.js';

export const MAX_MEMORY_WRITE_BODY_BYTES = 128 * 1024;
export const MEMORY_ROUTE_REQUEST_ID_HEADER = 'x-lovebud-request-id';

export function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

export function getAuthorizationHeader(request) {
  return request.headers.get('authorization') || request.headers.get('Authorization') || '';
}

export function hasAuthorizationHeader(request) {
  return !!getAuthorizationHeader(request);
}

function getContentLengthBytes(request) {
  const raw = request.headers.get('content-length');
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function isWriteContentLengthTooLarge(request) {
  const contentLengthBytes = getContentLengthBytes(request);
  return contentLengthBytes !== null && contentLengthBytes > MAX_MEMORY_WRITE_BODY_BYTES;
}

export function normalizeMemoryId(rawMemoryId) {
  return encodeURIComponent(decodeURIComponent(String(rawMemoryId || '')));
}

export function isMemoryCollectionRequest(request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return path === '/api/memories';
}

export function isMemoryDetailRequest(request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  return /^\/api\/memories\/[^/]+$/.test(path);
}

export function isMemoryRouteRequest(request) {
  return isMemoryCollectionRequest(request) || isMemoryDetailRequest(request);
}

export function isMemoryWriteRequest(request) {
  const method = request.method.toUpperCase();
  if (method === 'POST' && isMemoryCollectionRequest(request)) return true;
  return ['PUT', 'DELETE'].includes(method) && isMemoryDetailRequest(request);
}

export function isMemoryReadRequest(request) {
  return request.method.toUpperCase() === 'GET' && isMemoryRouteRequest(request);
}

function getMemoryIdFromRequest(request, explicitMemoryId = null) {
  if (explicitMemoryId) return normalizeMemoryId(explicitMemoryId);
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const match = path.match(/^\/api\/memories\/([^/]+)$/);
  return match ? normalizeMemoryId(match[1]) : '';
}

function buildModalBaseUrl(env = {}) {
  const modalBaseUrl = stripTrailingSlash(env.MODAL_BASE_URL);
  return modalBaseUrl || '';
}

function clampCollectionLimit(rawLimit) {
  return Math.min(Math.max(Number(rawLimit || 100) || 100, 1), 200);
}

export function buildMemoryCollectionModalUrl(request, env = {}) {
  const modalBaseUrl = buildModalBaseUrl(env);
  if (!modalBaseUrl) return null;

  const sourceUrl = new URL(request.url);
  const target = new URL('/modal/private/memories', modalBaseUrl);

  if (request.method.toUpperCase() === 'GET') {
    const treeId = sourceUrl.searchParams.get('treeId');
    if (treeId) target.searchParams.set('treeId', treeId);
    target.searchParams.set('limit', String(clampCollectionLimit(sourceUrl.searchParams.get('limit'))));
  }

  return target;
}

export function buildMemoryDetailModalUrl(request, env = {}, explicitMemoryId = null) {
  const modalBaseUrl = buildModalBaseUrl(env);
  if (!modalBaseUrl) return null;

  const method = request.method.toUpperCase();
  const memoryId = getMemoryIdFromRequest(request, explicitMemoryId);
  if (!memoryId) return null;

  const authHeader = getAuthorizationHeader(request);
  const isPrivate = method !== 'GET' || !!authHeader;
  return new URL(`${isPrivate ? '/modal/private/memories' : '/modal/memories'}/${memoryId}`, modalBaseUrl);
}

export function buildMemoryModalUrl(request, env = {}, options = {}) {
  if (isMemoryCollectionRequest(request)) {
    return buildMemoryCollectionModalUrl(request, env);
  }
  if (isMemoryDetailRequest(request) || options.memoryId) {
    return buildMemoryDetailModalUrl(request, env, options.memoryId || null);
  }
  return null;
}

export function buildMemoryMissingModalConfigResponse(requestId = null) {
  const headers = { 'content-type': 'application/json; charset=utf-8' };
  if (requestId) headers[MEMORY_ROUTE_REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
    status: 503,
    headers
  });
}

export function buildMemoryPayloadTooLargeResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'payload-too-large'
  };
  if (requestId) headers[MEMORY_ROUTE_REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Request body too large' }), {
    status: 413,
    headers
  });
}

export function buildMemoryMissingAuthorizationResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'cloudflare',
    'x-lovebud-route-status': 'missing-authorization'
  };
  if (requestId) headers[MEMORY_ROUTE_REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers });
}

export function buildMemoryModalUnavailableResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'modal',
    'x-lovebud-degraded': 'modal-unavailable'
  };
  if (requestId) headers[MEMORY_ROUTE_REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Modal backend unavailable' }), { status: 503, headers });
}

export function buildMemoryModalTimeoutResponse(requestId = null) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'x-lovebud-upstream': 'modal',
    'x-lovebud-route-status': 'modal-timeout'
  };
  if (requestId) headers[MEMORY_ROUTE_REQUEST_ID_HEADER] = requestId;
  return new Response(JSON.stringify({ error: 'Modal upstream timeout' }), { status: 504, headers });
}

export async function readBoundedMemoryWriteBody(request) {
  if (isWriteContentLengthTooLarge(request)) {
    return { tooLarge: true, body: null };
  }

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
  if (encoded.byteLength > MAX_MEMORY_WRITE_BODY_BYTES) {
    return { tooLarge: true, body: null };
  }

  return { tooLarge: false, body: encoded };
}

export function buildMemoryReadHeaders(request, requestId = null) {
  const authHeader = getAuthorizationHeader(request);
  const headers = {
    accept: 'application/json',
    ...(authHeader ? { authorization: authHeader } : {})
  };
  if (requestId) headers[MEMORY_ROUTE_REQUEST_ID_HEADER] = requestId;
  return headers;
}

export function buildMemoryWriteHeaders(request, requestId = null) {
  const method = request.method.toUpperCase();
  const authHeader = getAuthorizationHeader(request);
  const headers = {
    accept: 'application/json',
    ...(method !== 'DELETE' ? { 'content-type': request.headers.get('content-type') || 'application/json' } : {}),
    ...(authHeader ? { authorization: authHeader } : {})
  };
  if (requestId) headers[MEMORY_ROUTE_REQUEST_ID_HEADER] = requestId;
  return headers;
}

export function withMemoryModalHeader(response, requestId = null) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-upstream', 'modal');
  if (requestId) headers.set(MEMORY_ROUTE_REQUEST_ID_HEADER, requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function withMemoryCloudflareHeader(response, routeStatus, requestId = null) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-upstream', 'cloudflare');
  if (routeStatus) headers.set('x-lovebud-route-status', routeStatus);
  if (requestId) headers.set(MEMORY_ROUTE_REQUEST_ID_HEADER, requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function validateMemoryWriteBody(body) {
  if (!body) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(body));
    return validateWritePayload(payload, ['title', 'memo']);
  } catch (_) {
    return null;
  }
}

export async function prepareMemoryWriteProxyRequest(request, env = {}, options = {}) {
  const requestId = options.requestId || null;
  const method = request.method.toUpperCase();

  if (!hasAuthorizationHeader(request)) {
    return { response: buildMemoryMissingAuthorizationResponse(requestId) };
  }

  let body = null;
  if (method !== 'DELETE') {
    const bodyResult = await readBoundedMemoryWriteBody(request);
    if (bodyResult.tooLarge) {
      return { response: buildMemoryPayloadTooLargeResponse(requestId) };
    }
    body = bodyResult.body;

    const guard = validateMemoryWriteBody(body);
    if (guard) return { response: withMemoryCloudflareHeader(guard, 'legacy-localization-key', requestId) };
  }

  const target = buildMemoryModalUrl(request, env, options);
  if (!target) {
    return { response: buildMemoryMissingModalConfigResponse(requestId) };
  }

  return {
    target,
    fetchOptions: {
      method,
      headers: buildMemoryWriteHeaders(request, requestId),
      body: method !== 'DELETE' ? body : null
    }
  };
}

async function fetchMemoryModal(target, fetchOptions, options = {}) {
  try {
    return await fetchModalWithTimeout(target.toString(), fetchOptions, {
      fetcher: options.fetcher,
      timeoutMs: options.timeoutMs
    });
  } catch (error) {
    if (isModalTimeoutError(error)) {
      return buildMemoryModalTimeoutResponse(options.requestId || null);
    }
    return buildMemoryModalUnavailableResponse(options.requestId || null);
  }
}

export async function proxyMemoryRouteRequest(context, options = {}) {
  const { request, env } = context;
  const requestId = options.requestId || null;
  const method = request.method.toUpperCase();

  if (method === 'GET') {
    const target = buildMemoryModalUrl(request, env || {}, options);
    if (!target) {
      return buildMemoryMissingModalConfigResponse(requestId);
    }
    const response = await fetchMemoryModal(target, {
      headers: buildMemoryReadHeaders(request, requestId)
    }, { ...options, requestId });
    return withMemoryModalHeader(response, requestId);
  }

  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const prepared = await prepareMemoryWriteProxyRequest(request, env || {}, options);
    if (prepared.response) return prepared.response;

    const response = await fetchMemoryModal(prepared.target, prepared.fetchOptions, { ...options, requestId });
    return withMemoryModalHeader(response, requestId);
  }

  return null;
}

export function getMemoryRouteAllowHeader(request) {
  if (isMemoryCollectionRequest(request)) return 'GET, POST';
  if (isMemoryDetailRequest(request)) return 'GET, PUT, DELETE';
  return 'GET';
}
