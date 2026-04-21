const MODAL_BASE_URL = process.env.MODAL_BASE_URL || '';
const NETLIFY_API_BASE_URL = process.env.NETLIFY_API_BASE_URL || '';

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
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

async function fetchModalSummary(limit) {
  if (!MODAL_BASE_URL) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2200);
  try {
    const url = `${MODAL_BASE_URL.replace(/\/$/, '')}/modal/browse/latest?limit=${encodeURIComponent(limit)}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const data = await safeJson(response);
    return Array.isArray(data) ? data : null;
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchNetlifyCommunityTrees(queryString) {
  if (!NETLIFY_API_BASE_URL) {
    throw new Error('NETLIFY_API_BASE_URL is not configured');
  }
  const baseUrl = NETLIFY_API_BASE_URL.replace(/\/$/, '');
  const url = `${baseUrl}/community/trees${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });
  const data = await safeJson(response);
  if (!response.ok) {
    const message = data?.error || `Upstream error ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  const searchParams = new URLSearchParams();
  const view = typeof req.query?.view === 'string' ? req.query.view : 'default';
  const sort = typeof req.query?.sort === 'string' ? req.query.sort : 'latest';
  const limit = typeof req.query?.limit === 'string' ? req.query.limit : '50';

  if (view) searchParams.set('view', view);
  if (sort) searchParams.set('sort', sort);
  if (limit) searchParams.set('limit', limit);

  try {
    if (String(view).toLowerCase() === 'summary') {
      const modalLimit = Number(limit) > 0 ? Number(limit) : 3;
      const modalData = await fetchModalSummary(modalLimit);
      if (Array.isArray(modalData) && modalData.length > 0) {
        setJsonHeaders(res);
        return res.status(200).send(JSON.stringify(modalData));
      }
    }

    const data = await fetchNetlifyCommunityTrees(searchParams.toString());
    setJsonHeaders(res);
    return res.status(200).send(JSON.stringify(data));
  } catch (error) {
    return sendError(res, Number(error.status) || 502, error.message || 'Failed to load community trees');
  }
};
