const { ok, preflight, httpError, handleError } = require('./_lib/http');
const { queryTrees, validateLimit } = require('./_lib/doc-store');
const { serializeTreeList } = require('./_lib/serializers');

function estimateStage(memoryCount) {
  if (memoryCount <= 0) return 'empty';
  if (memoryCount <= 2) return '입덕';
  if (memoryCount <= 4) return '성장';
  return '최애';
}

function buildSummaryFromTreeRow(tree) {
  const memoryCount = 0;
  return {
    id: tree.id,
    title: tree.title || '',
    visibility: tree.visibility || 'private',
    createdAt: tree.created_at || null,
    updatedAt: tree.updated_at || null,
    representativeThumbnail: '',
    memoryCount,
    emotionTags: [],
    stage: estimateStage(memoryCount),
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

    const trees = await queryTrees({ visibility: 'public', limit });

    if (view !== 'summary') {
      return ok(serializeTreeList(trees), null, requestOrigin);
    }

    let summaries = (Array.isArray(trees) ? trees : []).map((tree) => buildSummaryFromTreeRow(tree));

    if (sort === 'latest') {
      summaries = summaries.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return ok(summaries.slice(0, limit), null, requestOrigin);
  } catch (error) {
    return handleError('community-trees', error, requestOrigin);
  }
};
