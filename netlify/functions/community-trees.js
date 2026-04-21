const { ok, preflight, httpError, handleError } = require('./_lib/http');
const { queryTrees, queryMemories, validateLimit } = require('./_lib/doc-store');
const { serializeTreeList } = require('./_lib/serializers');

function estimateStage(memoryCount) {
  if (memoryCount <= 0) return 'empty';
  if (memoryCount <= 2) return '입덕';
  if (memoryCount <= 4) return '성장';
  return '최애';
}

function sortMemoriesAscending(memories) {
  return [...memories].sort((a, b) => {
    const left = new Date(a.created_at || a.timestamp || 0).getTime();
    const right = new Date(b.created_at || b.timestamp || 0).getTime();
    return left - right;
  });
}

function buildTreeSummaries(trees, memories) {
  const grouped = {};
  (Array.isArray(memories) ? memories : []).forEach((memory) => {
    const treeId = memory?.tree_id;
    if (!treeId) return;
    if (!grouped[treeId]) grouped[treeId] = [];
    grouped[treeId].push(memory);
  });

  return (Array.isArray(trees) ? trees : []).map((tree) => {
    const treeMemories = sortMemoriesAscending(grouped[tree.id] || []);
    const memoryCount = treeMemories.length;
    const representativeMemory = treeMemories[0] || null;
    const tags = [...new Set(
      treeMemories
        .flatMap((memory) => Array.isArray(memory.emotion_tags) ? memory.emotion_tags : [])
        .map((tag) => String(tag || '').trim())
        .filter(Boolean)
    )].slice(0, 3);
    const timestamps = treeMemories
      .map((memory) => String(memory.timestamp || '').trim())
      .filter(Boolean);

    return {
      id: tree.id,
      title: tree.title || '',
      visibility: tree.visibility || 'private',
      createdAt: tree.created_at || null,
      updatedAt: tree.updated_at || null,
      representativeThumbnail: representativeMemory?.thumbnail || '',
      memoryCount,
      emotionTags: tags,
      stage: estimateStage(memoryCount),
      theme: representativeMemory?.artist || 'LoveTree',
      timeRange: timestamps.length >= 2
        ? `${timestamps[0]} ~ ${timestamps[timestamps.length - 1]}`
        : (timestamps[0] || '')
    };
  });
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

    const publicTreeIds = trees.map((tree) => tree.id).filter(Boolean);
    const memories = publicTreeIds.length > 0
      ? await queryMemories({ treeIds: publicTreeIds, visibility: 'public' })
      : [];

    let summaries = buildTreeSummaries(trees, memories);

    if (sort === 'latest') {
      summaries = summaries.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return ok(summaries.slice(0, limit), null, requestOrigin);
  } catch (error) {
    return handleError('community-trees', error, requestOrigin);
  }
};
