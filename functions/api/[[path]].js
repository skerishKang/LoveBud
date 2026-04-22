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

function buildUpstreamUrl(request, env) {
  const sourceUrl = new URL(request.url);
  const upstreamOrigin = String(env.LOVEBUD_UPSTREAM_ORIGIN || DEFAULT_UPSTREAM_ORIGIN).replace(/\/$/, '');
  return new URL(`${sourceUrl.pathname}${sourceUrl.search}`, upstreamOrigin);
}

function buildForwardHeaders(request) {
  const headers = new Headers(request.headers);

  HOP_BY_HOP_HEADERS.forEach((header) => headers.delete(header));
  headers.set('x-lovebud-proxy', 'cloudflare-pages');

  return headers;
}

export async function onRequest(context) {
  const { request, env } = context;
  const upstreamUrl = buildUpstreamUrl(request, env || {});
  const method = request.method.toUpperCase();

  return fetch(upstreamUrl.toString(), {
    method,
    headers: buildForwardHeaders(request),
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    redirect: 'follow'
  });
}
