/**
 * GET /api/community/memories
 * Returns public memories from all trees, newest first.
 * No authentication required.
 */
const { ok, httpError, handleError } = require('./_lib/http');
const { queryMemories, validateLimit } = require('./_lib/doc-store');
const { serializeMemoryList } = require('./_lib/serializers');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';
  
  // 관측성: 핸들러 진입 로깅
  console.log('[community-memories] handler entry', { method: event.httpMethod, path: event.path });

  if (event.httpMethod === 'OPTIONS') {
    return ok(null, { 'Access-Control-Allow-Origin': '*' });
  }

  if (event.httpMethod !== 'GET') {
    throw httpError(405, 'Method not allowed');
  }

  try {
    console.log('[community-memories] parsing params');
    const params = event.queryStringParameters || {};
    const limit = validateLimit(params.limit, 20, 50);
    console.log('[community-memories] limit validated', { limit });

    console.log('[community-memories] querying memories');
    const memories = await queryMemories({
      visibility: 'public',
      limit,
    });
    console.log('[community-memories] query success', { count: memories?.length || 0 });

    console.log('[community-memories] handler success');
    return ok(serializeMemoryList(memories), { 'Access-Control-Allow-Origin': '*' });
  } catch (error) {
    console.error('[community-memories] handler failed', {
      error: error.message,
      code: error.code,
      stack: error.stack?.substring(0, 200)
    });
    return handleError('community-memories', error, requestOrigin);
  }
};