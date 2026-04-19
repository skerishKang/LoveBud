const { ok, preflight, httpError, handleError } = require('./_lib/http');
const { queryTrees } = require('./_lib/doc-store');
const { serializeTreeList } = require('./_lib/serializers');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return preflight(requestOrigin);
  }

  try {
    if (event.httpMethod !== 'GET') {
      throw httpError(405, 'Method not allowed');
    }

    const trees = await queryTrees({ visibility: 'public', limit: 20 });

    return ok(serializeTreeList(trees), null, requestOrigin);
  } catch (error) {
    return handleError('community-trees', error, requestOrigin);
  }
};
