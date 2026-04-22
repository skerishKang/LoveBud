const DEFAULT_UPSTREAM_ORIGIN = 'https://lovebud.vercel.app';

const HOP_BY_HOP_HEADERS = [
  'connection',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
];

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

function buildUpstreamUrl(request, env) {
  const sourceUrl = new URL(request.url);
  const upstreamOrigin = stripTrailingSlash(env.LOVEBUD_UPSTREAM_ORIGIN || DEFAULT_UPSTREAM_ORIGIN);
  return new URL(`${sourceUrl.pathname}${sourceUrl.search}`, upstreamOrigin);
}

function buildForwardHeaders(request) {
  const headers = new Headers(request.headers);

  HOP_BY_HOP_HEADERS.forEach((header) => headers.delete(header));
  headers.set('x-lovebud-proxy', 'cloudflare-pages');

  return headers;
}

function buildModalUrl(request, env) {
  const modalBaseUrl = stripTrailingSlash(env.MODAL_BASE_URL);
  if (!modalBaseUrl) return null;

  const sourceUrl = new URL(request.url);
  const path = sourceUrl.pathname.replace(/\/+$/, '');
  const target = new URL(modalBaseUrl);

  if (path === '/api/community/trees' && sourceUrl.searchParams.get('view') === 'summary') {
    const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 3) || 3, 1), 3);
    target.pathname = '/modal/browse/latest';
    target.searchParams.set('limit', String(limit));
    return target;
  }

  if (path === '/api/community/memories') {
    target.pathname = '/modal/community/memories';
    const treeId = sourceUrl.searchParams.get('treeId');
    const limit = Math.min(Math.max(Number(sourceUrl.searchParams.get('limit') || 100) || 100, 1), 200);
    if (treeId) target.searchParams.set('treeId', treeId);
    target.searchParams.set('limit', String(limit));
    return target;
  }

  const memoryMatch = path.match(/^\/api\/memories\/([^/]+)$/);
  if (memoryMatch) {
    target.pathname = `/modal/memories/${encodeURIComponent(decodeURIComponent(memoryMatch[1]))}`;
    return target;
  }

  const treeMatch = path.match(/^\/api\/trees\/([^/]+)$/);
  if (treeMatch) {
    target.pathname = `/modal/trees/${encodeURIComponent(decodeURIComponent(treeMatch[1]))}`;
    return target;
  }

  return null;
}

function withUpstreamHeader(response, upstream) {
  const headers = new Headers(response.headers);
  headers.set('x-lovebud-upstream', upstream);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function tryModalRead(request, env) {
  if (request.method.toUpperCase() !== 'GET') return null;

  const modalUrl = buildModalUrl(request, env || {});
  if (!modalUrl) return null;

  const response = await fetch(modalUrl.toString(), {
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`modal-${response.status}`);
  }

  return withUpstreamHeader(response, 'modal');
}

export async function onRequest(context) {
  const { request, env } = context;
  const upstreamUrl = buildUpstreamUrl(request, env || {});
  const method = request.method.toUpperCase();

  try {
    const modalResponse = await tryModalRead(request, env || {});
    if (modalResponse) return modalResponse;
  } catch (error) {
    console.warn('[LoveBudCloudflareProxy] Modal read failed, falling back to Vercel', error);
  }

  const response = await fetch(upstreamUrl.toString(), {
    method,
    headers: buildForwardHeaders(request),
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    redirect: 'follow'
  });

  return withUpstreamHeader(response, 'vercel');
}
