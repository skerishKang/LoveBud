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
  const path = authHeader ? `/modal/private/trees/${treeId}` : `/modal/trees/${treeId}`;
  const target = new URL(path, modalBaseUrl);

  const response = await fetch(target.toString(), {
    headers: {
      accept: 'application/json',
      ...(authHeader ? { authorization: authHeader } : {})
    }
  });

  return withModalHeader(response);
}
