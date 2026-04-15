/**
 * GET /api/community/memories
 * Returns public memories from all trees, newest first.
 * No authentication required.
 */
const { ok, httpError, handleError } = require('./_lib/http');
const { queryMemories } = require('./_lib/doc-store');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const params = event.queryStringParameters || {};
    const limit = params.limit ? Math.min(Number(params.limit), 50) : 20;

    const memories = await queryMemories({
      visibility: 'public',
      limit,
    });

    return ok(memories, { 'Access-Control-Allow-Origin': '*' });
  } catch (error) {
    return handleError('community-memories', error, requestOrigin);
  }
};