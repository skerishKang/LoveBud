const MODAL_BASE_URL = process.env.MODAL_BASE_URL || '';
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

function getTreeId(record) {
  const source = record?.data || record || {};
  return source.id || record?.id || null;
}

function getEmotionTags(source) {
  if (Array.isArray(source.emotionTags)) return source.emotionTags;
  if (Array.isArray(source.emotion_tags)) return source.emotion_tags;
  return [];
}

async function fetchModalSummary(limit) {
  if (!MODAL_BASE_URL) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2200);
  try {
    const safeLimit = Number(limit) > 0 ? Number(limit) : 50;
    const url = `${MODAL_BASE_URL.replace(/\/$/, '')}/modal/browse/latest?limit=${encodeURIComponent(safeLimit)}`;
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

function buildPreviewMemoryFromSummary(summary, treeId) {
  const source = summary?.data || summary || {};
  const representativeSourceUrl = source.representativeMemorySourceUrl || source.representative_memory_source_url || '';
  const thumbnail = source.representativeThumbnail || source.representative_thumbnail || source.thumbnail || '';

  return {
    id: null,
    treeId,
    createdAt: source.createdAt || source.created_at || source.updatedAt || source.updated_at || null,
    timestamp: source.createdAt || source.created_at || source.updatedAt || source.updated_at || '',
    thumbnail,
    sourceUrl: representativeSourceUrl,
    title: source.representativeMemoryTitle || source.representative_memory_title || source.title || '',
    memo: source.title || '',
    artist: source.theme || 'LoveTree',
    emotionTags: getEmotionTags(source)
  };
}

async function fetchModalPreviewMemories(treeId, limit) {
  if (!treeId) return null;
  const summaries = await fetchModalSummary(limit);
  if (!Array.isArray(summaries)) return null;

  const matchedSummary = summaries.find((summary) => getTreeId(summary) === treeId);
  if (!matchedSummary) return null;
  return [buildPreviewMemoryFromSummary(matchedSummary, treeId)];
}

function sendDegradedPreview(res, reason) {
  setJsonHeaders(res);
  res.setHeader('X-LoveBud-Degraded', reason);
  return res.status(200).send(JSON.stringify([]));
}

async function fetchNetlifyCommunityMemories(queryString) {
  if (!NETLIFY_API_BASE_URL) {
    throw new Error('NETLIFY_API_BASE_URL is not configured');
  }
  const baseUrl = NETLIFY_API_BASE_URL.replace(/\/$/, '');
  const url = `${baseUrl}/community/memories${queryString ? `?${queryString}` : ''}`;
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
  const treeId = typeof req.query?.treeId === 'string' ? req.query.treeId.trim() : '';
  const limit = typeof req.query?.limit === 'string' ? req.query.limit.trim() : '';

  if (treeId) {
    searchParams.set('treeId', treeId);
  }
  if (limit) {
    searchParams.set('limit', limit);
  }

  try {
    const modalPreviewMemories = await fetchModalPreviewMemories(treeId, limit);
    if (Array.isArray(modalPreviewMemories) && modalPreviewMemories.length > 0) {
      setJsonHeaders(res);
      return res.status(200).send(JSON.stringify(modalPreviewMemories));
    }

    const data = await fetchNetlifyCommunityMemories(searchParams.toString());
    setJsonHeaders(res);
    return res.status(200).send(JSON.stringify(data));
  } catch (error) {
    if (treeId) {
      return sendDegradedPreview(res, error.message || 'preview-hydration-degraded');
    }
    return sendError(res, 502, error.message || 'Failed to load community memories');
  }
};
