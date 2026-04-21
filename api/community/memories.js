const NETLIFY_API_BASE_URL = process.env.NETLIFY_API_BASE_URL || '';

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
}

function sendError(res, status, message) {
  setJsonHeaders(res);
  res.status(status).send(JSON.stringify({ error: message }));
}

async function safeJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!NETLIFY_API_BASE_URL) {
    return sendError(res, 500, 'NETLIFY_API_BASE_URL is not configured');
  }

  const searchParams = new URLSearchParams();
  if (typeof req.query?.treeId === 'string' && req.query.treeId.trim()) {
    searchParams.set('treeId', req.query.treeId.trim());
  }
  if (typeof req.query?.limit === 'string' && req.query.limit.trim()) {
    searchParams.set('limit', req.query.limit.trim());
  }

  try {
    const baseUrl = NETLIFY_API_BASE_URL.replace(/\/$/, '');
    const url = `${baseUrl}/community/memories${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });
    const data = await safeJson(response);
    if (!response.ok) {
      return sendError(res, response.status, data?.error || `Upstream error ${response.status}`);
    }
    setJsonHeaders(res);
    return res.status(200).send(JSON.stringify(data));
  } catch (error) {
    return sendError(res, 502, error.message || 'Failed to load community memories');
  }
};
