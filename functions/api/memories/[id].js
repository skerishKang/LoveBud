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

const MAX_BODY_SIZE = 131072; // 128KB

function buildPayloadTooLargeResponse() {
  return new Response(JSON.stringify({ error: 'Payload too large' }), {
    status: 413,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestGet(context) {
  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  const memoryId = context.params?.id;
  const target = new URL(`/modal/memories/${memoryId}`, modalBaseUrl);
  const response = await fetch(target.toString(), {
    headers: {
      accept: 'application/json',
      ...(context.request.headers.get('authorization')
        ? { authorization: context.request.headers.get('authorization') }
        : {})
    }
  });

  return withModalHeader(response);
}

export async function onRequestPut(context) {
  const contentLength = parseInt(context.request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_SIZE) {
    return buildPayloadTooLargeResponse();
  }

  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  const memoryId = context.params?.id;
  const target = new URL(`/modal/private/memories/${memoryId}`, modalBaseUrl);
  const response = await fetch(target.toString(), {
    method: 'PUT',
    headers: {
      accept: 'application/json',
      'content-type': context.request.headers.get('content-type') || 'application/json',
      ...(context.request.headers.get('authorization')
        ? { authorization: context.request.headers.get('authorization') }
        : {})
    },
    body: context.request.body
  });

  return withModalHeader(response);
}

export async function onRequestDelete(context) {
  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  const memoryId = context.params?.id;
  const target = new URL(`/modal/private/memories/${memoryId}`, modalBaseUrl);
  const response = await fetch(target.toString(), {
    method: 'DELETE',
    headers: {
      accept: 'application/json',
      ...(context.request.headers.get('authorization')
        ? { authorization: context.request.headers.get('authorization') }
        : {})
    }
  });

  return withModalHeader(response);
}
