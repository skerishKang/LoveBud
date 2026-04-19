/**
 * /api/trees
 * GET  → list user's trees
 * POST → create new tree
 */
const { requireUser } = require('./_lib/auth');
const { ok, created, preflight, httpError, handleError } = require('./_lib/http');
const {
  queryTrees,
  createTree,
  validateVisibility,
  validateOptionalString,
} = require('./_lib/doc-store');
const { serializeTree, serializeTreeList } = require('./_lib/serializers');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return preflight(requestOrigin);
  }

  try {
    if (event.httpMethod === 'POST') {
      let user;
      try {
        user = await requireUser(event);
      } catch (authError) {
        return handleError('trees-auth', authError, requestOrigin);
      }

      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (_) {
        throw httpError(400, 'Invalid JSON body');
      }

      const title = validateOptionalString(body.title, 200) || '나의 Lovetree';
      const visibility = validateVisibility(body.visibility, 'private');

      const tree = await createTree({
        ownerId: user.uid,
        title,
        visibility,
      });

      return created(serializeTree(tree), null, requestOrigin);
    }

    if (event.httpMethod === 'GET') {
      let user;
      try {
        user = await requireUser(event);
      } catch (authError) {
        return handleError('trees-auth', authError, requestOrigin);
      }

      try {
        const trees = await queryTrees({ ownerId: user.uid });
        return ok(serializeTreeList(trees), null, requestOrigin);
      } catch (dbError) {
        console.error('[trees] query failed', {
          error: dbError.message,
          code: dbError.code,
          stack: dbError.stack?.substring(0, 200),
        });
        return handleError('trees-db', dbError, requestOrigin);
      }
    }

    throw httpError(405, 'Method not allowed');
  } catch (error) {
    return handleError('trees', error, requestOrigin);
  }
};
