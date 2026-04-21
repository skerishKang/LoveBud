const { ok, preflight, httpError, handleError } = require('./_lib/http');
const { queryTrees, queryPublicMemoryCounts, validateLimit } = require('./_lib/doc-store');
const { serializeTreeList } = require('./_lib/serializers');

const BROWSE_MIN_MEMORY_COUNT = 3;
const SUMMARY_FETCH_MULTIPLIER = 8;

function estimateStage(memoryCount) {
  if (memoryCount <= 0) return 'empty';
  if (memoryCount <= 2) return '입덕';
  if (memoryCount <= 4) return '성장';
  return '최애';
}

function buildSummaryFromTreeRow(tree, memoryCount) {
  const safeCount = Number(memoryCount || 0);
  return {
    id: tree.id,
    title: tree.title || '',
    visibility: tree.visibility || 'private',
    createdAt: tree.created_at || null,
    updatedAt: tree.updated_at || null,
    representativeThumbnail: '',
    memoryCount: safeCount,
    emotionTags: [],
    stage: estimateStage(safeCount),
    theme: 'LoveTree',
    timeRange: ''
  };
}

const MODAL_BASE_URL = process.env.MODAL_BASE_URL;

/**
 * Attempts to fetch browse summaries from the Modal compute layer.
 * Returns null if not configured, or if the fetch fails/times out.
 */
async function fetchModalSummary(limit) {
  if (!MODAL_BASE_URL) return null;

  try {
    const url = `${MODAL_BASE_URL}/modal/browse/latest?limit=${limit}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second short timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error('[community-trees] Modal summary fetch failed:', error.message);
    return null;
  }
}

exports.handler = async (event) => {
  const handlerStart = Date.now();
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return preflight(requestOrigin);
  }

  try {
    if (event.httpMethod !== 'GET') {
      throw httpError(405, 'Method not allowed');
    }

    const params = event.queryStringParameters || {};
    const view = String(params.view || '').trim().toLowerCase() || 'default';
    const sort = String(params.sort || '').trim().toLowerCase() || 'latest';
    const limit = validateLimit(params.limit, 50, 100);

    // ── Summary View Pathway ──────────────────────────────────────────────────
    if (view === 'summary') {
      console.log(`[community-trees][perf] Start summary view (limit: ${limit})`);
      
      // 1. Try Modal Compute Layer first
      const modalStart = Date.now();
      const modalData = await fetchModalSummary(limit === 50 ? 3 : limit);
      const modalDuration = Date.now() - modalStart;
      
      if (modalData) {
        console.log(`[community-trees][perf] Modal SUCCESS: ${modalDuration}ms`);
        console.log(`[community-trees][perf] TOTAL (Modal path): ${Date.now() - handlerStart}ms`);
        return ok(modalData, null, requestOrigin);
      }
      console.log(`[community-trees][perf] Modal FAILED/MISSING: ${modalDuration}ms (Moving to fallback)`);
      
      // 2. Fallback to existing Netlify summary logic
      const fallbackStart = Date.now();
      const treeFetchLimit = Math.min(Math.max(limit * SUMMARY_FETCH_MULTIPLIER, limit), 100);
      
      const qTreesStart = Date.now();
      const trees = await queryTrees({ visibility: 'public', limit: treeFetchLimit });
      console.log(`[community-trees][perf] DB queryTrees: ${Date.now() - qTreesStart}ms`);

      const treeIds = (Array.isArray(trees) ? trees : []).map((tree) => tree.id).filter(Boolean);
      
      const qCountsStart = Date.now();
      const memoryCounts = await queryPublicMemoryCounts(treeIds, BROWSE_MIN_MEMORY_COUNT);
      console.log(`[community-trees][perf] DB queryPublicMemoryCounts: ${Date.now() - qCountsStart}ms`);

      const countMap = new Map(memoryCounts.map((row) => [row.tree_id, Number(row.memory_count || 0)]));

      let summaries = (Array.isArray(trees) ? trees : [])
        .filter((tree) => countMap.has(tree.id))
        .map((tree) => buildSummaryFromTreeRow(tree, countMap.get(tree.id)));

      if (sort === 'latest') {
        summaries = summaries.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }

      console.log(`[community-trees][perf] Fallback processing: ${Date.now() - fallbackStart}ms`);
      console.log(`[community-trees][perf] TOTAL (Fallback path): ${Date.now() - handlerStart}ms`);
      return ok(summaries.slice(0, limit), null, requestOrigin);
    }

    // ── Default View Pathway ──────────────────────────────────────────────────
    const trees = await queryTrees({ visibility: 'public', limit });
    return ok(serializeTreeList(trees), null, requestOrigin);
  } catch (error) {
    console.error(`[community-trees][perf] ERROR after ${Date.now() - handlerStart}ms:`, error.message);
    return handleError('community-trees', error, requestOrigin);
  }
};
