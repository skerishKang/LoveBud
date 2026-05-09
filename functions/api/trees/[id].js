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

export async function onRequestPut(context) {
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
