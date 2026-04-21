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

exports.handler = async (event) => {
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

    const treeFetchLimit = view === 'summary'
      ? Math.min(Math.max(limit * SUMMARY_FETCH_MULTIPLIER, limit), 100)
      : limit;

    const trees = await queryTrees({ visibility: 'public', limit: treeFetchLimit });

    if (view !== 'summary') {
      return ok(serializeTreeList(trees), null, requestOrigin);
    }

    const treeIds = (Array.isArray(trees) ? trees : []).map((tree) => tree.id).filter(Boolean);
    const memoryCounts = await queryPublicMemoryCounts(treeIds, BROWSE_MIN_MEMORY_COUNT);
    const countMap = new Map(memoryCounts.map((row) => [row.tree_id, Number(row.memory_count || 0)]));

    let summaries = (Array.isArray(trees) ? trees : [])
      .filter((tree) => countMap.has(tree.id))
      .map((tree) => buildSummaryFromTreeRow(tree, countMap.get(tree.id)));

    if (sort === 'latest') {
      summaries = summaries.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return ok(summaries.slice(0, limit), null, requestOrigin);
  } catch (error) {
    return handleError('community-trees', error, requestOrigin);
  }
};
