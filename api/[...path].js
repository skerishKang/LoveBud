const DEFAULT_UPSTREAM_BASE = 'https://lovebud.netlify.app/api';

function buildUpstreamUrl(pathSegments, queryString) {
  const normalizedBase = String(process.env.LOVEBUD_UPSTREAM_API_BASE || DEFAULT_UPSTREAM_BASE || '').replace(/\/$/, '');
  const safeSegments = Array.isArray(pathSegments) ? pathSegments : [];
  const encodedPath = safeSegments.map((segment) => encodeURIComponent(String(segment || ''))).join('/');
  const baseUrl = encodedPath ? `${normalizedBase}/${encodedPath}` : normalizedBase;
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

function copyResponseHeaders(upstreamHeaders, res) {
  const passthrough = [
    'content-type',
    'cache-control',
    'etag',
    'last-modified'
  ];

  passthrough.forEach((headerName) => {
    const value = upstreamHeaders.get(headerName);
    if (value) {
      res.setHeader(headerName, value);
    }
  });
}

async function readRawBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  if (req.body == null) return undefined;

  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    return req.body;
  }

  return JSON.stringify(req.body);
}

module.exports = async function handler(req, res) {
  const pathSegments = Array.isArray(req.query?.path)
    ? req.query.path
    : req.query?.path
      ? [req.query.path]
      : [];

  const url = new URL(req.url || '/', 'http://localhost');
  const queryParams = new URLSearchParams(url.search || '');
  queryParams.delete('path');
  const upstreamUrl = buildUpstreamUrl(pathSegments, queryParams.toString());

  const headers = {};
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  if (req.headers.accept) headers.accept = req.headers.accept;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: await readRawBody(req),
      redirect: 'follow'
    });

    copyResponseHeaders(upstreamResponse.headers, res);
    const bodyText = await upstreamResponse.text();
    res.status(upstreamResponse.status).send(bodyText);
  } catch (error) {
    res.status(502).json({
      error: 'API proxy request failed',
      detail: error && error.message ? error.message : 'unknown error'
    });
  }
};
