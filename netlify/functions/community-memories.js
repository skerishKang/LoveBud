/**
 * GET /api/community/memories
 * Returns public memories from all trees, newest first.
 * No authentication required.
 */
const { ok, preflight, httpError, handleError } = require('./_lib/http');
const { queryMemories, validateLimit } = require('./_lib/doc-store');
const { serializeMemoryList } = require('./_lib/serializers');

const DEBUG_LOGS =
  process.env.DEBUG_COMMUNITY_MEMORIES === '1' ||
  process.env.LOG_LEVEL === 'debug';

function debugLog(message, meta) {
  if (!DEBUG_LOGS) return;
  if (meta !== undefined) {
    console.log(message, meta);
    return;
  }
  console.log(message);
}

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  debugLog('[community-memories] handler entry', {
    method: event.httpMethod,
    path: event.path,
  });

  if (event.httpMethod === 'OPTIONS') {
    return preflight(requestOrigin);
  }

  if (event.httpMethod !== 'GET') {
    throw httpError(405, 'Method not allowed');
  }

  try {
    const params = event.queryStringParameters || {};
    const limit = validateLimit(params.limit, 100, 200);

    debugLog('[community-memories] querying memories', { limit });

    const memories = await queryMemories({
      visibility: 'public',
      limit,
    });

    debugLog('[community-memories] handler success', {
      count: memories?.length || 0,
      limit,
    });

    return ok(serializeMemoryList(memories), null, requestOrigin);
  } catch (error) {
    console.error('[community-memories] handler failed', {
      error: error.message,
      code: error.code,
      stack: error.stack?.substring(0, 200),
    });
    return handleError('community-memories', error, requestOrigin);
  }
};