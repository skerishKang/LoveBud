/**
 * /api/trees/:treeId
 * GET    → tree metadata + memories
 * PUT    → update tree
 * DELETE → delete tree
 */
const { getUserFromEvent, requireUser } = require('./_lib/auth');
const { ok, httpError, handleError } = require('./_lib/http');
const {
  getTree,
  queryMemories,
  updateTree,
  deleteTree,
  validateUuid,
  validateVisibility,
  validateOptionalString,
} = require('./_lib/doc-store');
const { serializeTree, serializeMemoryList } = require('./_lib/serializers');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return ok(null, { 'Access-Control-Allow-Origin': '*' });
  }

  try {
    const pathParts = (event.path || '').split('/');
    const treeId = pathParts[pathParts.length - 1];

    if (!treeId) {
      throw httpError(400, 'Missing treeId');
    }

    const validatedTreeId = validateUuid(treeId, 'treeId');

    if (event.httpMethod === 'GET') {
      const rawTree = await getTree(validatedTreeId);
      if (!rawTree) throw httpError(404, 'Tree not found');

      const tree = serializeTree(rawTree);
      const isPublic = tree.visibility === 'public';

      if (!isPublic) {
        const user = await getUserFromEvent(event);
        if (!user || user.uid !== tree.ownerId) {
          throw httpError(403, 'Access denied');
        }
      }

      const rawMemories = await queryMemories({ treeId: validatedTreeId });
      const memories = serializeMemoryList(rawMemories);

      return ok(
        {
          ...tree,
          memories,
        },
        { 'Access-Control-Allow-Origin': '*' }
      );
    }

    if (event.httpMethod === 'PUT') {
      const user = await requireUser(event);
      const rawTree = await getTree(validatedTreeId);

      if (!rawTree) throw httpError(404, 'Tree not found');
      if (rawTree.owner_id !== user.uid) throw httpError(403, 'Forbidden: not your tree');

      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (_) {
        throw httpError(400, 'Invalid JSON body');
      }

      const patch = {};
      if (body.title !== undefined) {
        patch.title = validateOptionalString(body.title, 200) || rawTree.title;
      }
      if (body.visibility !== undefined) {
        patch.visibility = validateVisibility(body.visibility, rawTree.visibility);
      }

      const updated = await updateTree(validatedTreeId, patch);
      return ok(serializeTree(updated), { 'Access-Control-Allow-Origin': '*' });
    }

    if (event.httpMethod === 'DELETE') {
      const user = await requireUser(event);
      const rawTree = await getTree(validatedTreeId);

      if (!rawTree) throw httpError(404, 'Tree not found');
      if (rawTree.owner_id !== user.uid) throw httpError(403, 'Forbidden: not your tree');

      await deleteTree(validatedTreeId);
      return ok({ deleted: true, id: validatedTreeId }, { 'Access-Control-Allow-Origin': '*' });
    }

    throw httpError(405, 'Method not allowed');
  } catch (error) {
    return handleError('tree-detail', error, requestOrigin);
  }
};
