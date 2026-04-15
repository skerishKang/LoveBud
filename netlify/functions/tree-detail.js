/**
 * GET /api/trees/:treeId
 * Returns tree metadata + all memories in the tree.
 * Public trees accessible without auth; private trees require ownership.
 */
const { getUserFromEvent } = require('./_lib/auth');
const { ok, httpError, handleError } = require('./_lib/http');
const { getTree, queryMemories, validateUuid, validateLimit } = require('./_lib/doc-store');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return ok(null, { 'Access-Control-Allow-Origin': '*' });
  }

  if (event.httpMethod !== 'GET') {
    throw httpError(405, 'Method not allowed');
  }

  try {
    // Extract treeId from path — /api/trees/:treeId
    const pathParts = (event.path || '').split('/');
    const treeId = pathParts[pathParts.length - 1];

    if (!treeId) throw httpError(400, 'Missing treeId');

    // Validate treeId format
    const validatedTreeId = validateUuid(treeId, 'treeId');

    const tree = await getTree(validatedTreeId);
    if (!tree) throw httpError(404, 'Tree not found');

    // Load memories for this tree
    const memories = await queryMemories({ treeId: validatedTreeId });

    // Check access: public = OK, private = owner only
    const isPublic = tree.data.visibility === 'public';
    if (!isPublic) {
      const user = await getUserFromEvent(event);
      if (!user || user.uid !== tree.data.owner_id) {
        throw httpError(403, 'Access denied');
      }
    }

    return ok({ ...tree, memories }, { 'Access-Control-Allow-Origin': '*' });
  } catch (error) {
    return handleError('tree-detail', error, requestOrigin);
  }
};