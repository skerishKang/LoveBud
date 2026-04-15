/**
 * GET /api/community/memories
 * Returns public memories from all trees, newest first.
 * No authentication required.
 */
const { ok, httpError, handleError } = require('./_lib/http');
const { queryMemories, validateLimit } = require('./_lib/doc-store');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return ok(null, { 'Access-Control-Allow-Origin': '*' });
  }

  if (event.httpMethod !== 'GET') {
    throw httpError(405, 'Method not allowed');
  }

  try {
    const params = event.queryStringParameters || {};
    const limit = validateLimit(params.limit, 20, 50);

    const memories = await queryMemories({
      visibility: 'public',
      limit,
    });

    return ok(memories, { 'Access-Control-Allow-Origin': '*' });
  } catch (error) {
    return handleError('community-memories', error, requestOrigin);
  }
};