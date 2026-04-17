/**
 * GET /api/trees/:treeId
 * Returns tree metadata + all memories in the tree.
 * Public trees accessible without auth; private trees require ownership.
 */
const { getUserFromEvent } = require('./_lib/auth');
const { ok, httpError, handleError } = require('./_lib/http');
const { getTree, queryMemories, validateUuid } = require('./_lib/doc-store');
const { serializeTree, serializeMemoryList } = require('./_lib/serializers');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return ok(null, { 'Access-Control-Allow-Origin': '*' });
  }

  if (event.httpMethod !== 'GET') {
    throw httpError(405, 'Method not allowed');
  }

  try {
    const pathParts = (event.path || '').split('/');
    const treeId = pathParts[pathParts.length - 1];

    if (!treeId) throw httpError(400, 'Missing treeId');

    const validatedTreeId = validateUuid(treeId, 'treeId');

    const rawTree = await getTree(validatedTreeId);
    if (!rawTree) throw httpError(404, 'Tree not found');

    const rawMemories = await queryMemories({ treeId: validatedTreeId });
    const memories = serializeMemoryList(rawMemories);
    const tree = serializeTree(rawTree, { nodes: memories });

    const isPublic = tree.visibility === 'public';
    if (!isPublic) {
      const user = await getUserFromEvent(event);
      if (!user || user.uid !== tree.ownerId) {
        throw httpError(403, 'Access denied');
      }
    }

    return ok(
      {
        ...tree,
        memories,
      },
      { 'Access-Control-Allow-Origin': '*' }
    );
  } catch (error) {
    return handleError('tree-detail', error, requestOrigin);
  }
};