const REQUEST_ID_HEADER = 'x-lovebud-request-id';
const MODAL_FETCH_TIMEOUT_MS = 25000;

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

function generateRequestId() {
  return 'req-' + crypto.randomUUID();
}

function getOrCreateRequestId(request) {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  if (existing && typeof existing === 'string' && existing.trim()) {
    return existing.trim();
  }
  return generateRequestId();
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

function build401Response(requestId) {
  return new Response(JSON.stringify({ error: 'Authorization required' }), {
    status: 401,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-lovebud-upstream': 'modal',
      [REQUEST_ID_HEADER]: requestId
    }
  });
}

export async function onRequestDelete(context) {
  const { request } = context;
  const requestId = getOrCreateRequestId(request);

  // Require Authorization
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return build401Response(requestId);
  }

  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return build503Response(requestId);
  }

  const commentId = context.params?.id;
  const target = new URL(`/modal/private/comments/${commentId}`, modalBaseUrl);

  let response;
  try {
    response = await fetchWithTimeout(target.toString(), {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        authorization: authHeader,
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
