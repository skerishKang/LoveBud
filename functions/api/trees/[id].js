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

export async function onRequestGet(context) {
  const modalBaseUrl = stripTrailingSlash(context.env?.MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return new Response(JSON.stringify({ error: 'MODAL_BASE_URL is not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  const treeId = context.params?.id;
  const authHeader = context.request.headers.get('authorization');
  const primaryTarget = new URL(authHeader ? `/modal/private/trees/${treeId}` : `/modal/trees/${treeId}`, modalBaseUrl);
  let response = await fetch(primaryTarget.toString(), {
    headers: {
      accept: 'application/json',
      ...(authHeader ? { authorization: authHeader } : {})
    }
  });

  if (authHeader && response.status === 404) {
    const publicTarget = new URL(`/modal/trees/${treeId}`, modalBaseUrl);
    response = await fetch(publicTarget.toString(), {
      headers: {
        accept: 'application/json'
      }
    });
  }

  return withModalHeader(response);
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
  const response = await fetch(target.toString(), {
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
