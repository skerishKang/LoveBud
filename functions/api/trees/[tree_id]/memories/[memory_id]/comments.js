import { REQUEST_ID_HEADER, getOrCreateRequestId } from '../../../../../_shared/request-id.js';

const MODAL_FETCH_TIMEOUT_MS = 25000;

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
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

function build503Response(requestId) {
  return new Response(JSON.stringify({ error: 'Modal service temporarily unavailable' }), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'modal',
      'x-lovebud-degraded': 'modal-unavailable',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

function build504Response(requestId) {
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

export async function onRequestGet(context) {
  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  const requestId = getOrCreateRequestId(context.request);

  if (!modalBaseUrl) {
    return build503Response(requestId);
  }

  const { tree_id, memory_id } = context.params;
  const target = new URL(`/modal/public/trees/${tree_id}/memories/${memory_id}/comments`, modalBaseUrl);

  const incomingUrl = new URL(context.request.url);
  const limit = context.request.url.includes('limit=')
    ? incomingUrl.searchParams.get('limit')
    : null;
  if (limit) {
    target.searchParams.set('limit', limit);
  }
  const cursor = context.request.url.includes('cursor=')
    ? incomingUrl.searchParams.get('cursor')
    : null;
  if (cursor) {
    target.searchParams.set('cursor', cursor);
  }

  let response;
  try {
    response = await fetchWithTimeout(target.toString(), {
      headers: {
        accept: 'application/json',
        [REQUEST_ID_HEADER]: requestId
      }
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return build504Response(requestId);
    }
    return build503Response(requestId);
  }

  return withUpstreamHeaders(response, requestId);
}
