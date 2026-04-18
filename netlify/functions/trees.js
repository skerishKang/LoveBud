/**
 * GET /api/trees         → list user's trees
 * POST /api/trees        → create new tree
 * PUT /api/trees/{id}    → update tree
 * DELETE /api/trees/{id} → delete tree
 */
const { requireUser } = require('./_lib/auth');
const { ok, created, httpError, handleError } = require('./_lib/http');
const { queryTrees, createTree, getTreeById, updateTree, deleteTree, validateVisibility, validateOptionalString } = require('./_lib/doc-store');
const { serializeTree, serializeTreeList } = require('./_lib/serializers');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }

  try {
    // ── POST: create tree ───────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      let user;
      try {
        user = await requireUser(event);
      } catch (authError) {
        // 인증 실패 시 명확한 에러 반환
        return handleError('trees-auth', authError, requestOrigin);
      }
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (_) {
        throw httpError(400, 'Invalid JSON body');
      }

      // Validate input
      const title = validateOptionalString(body.title, 200) || '나의 Lovetree';
      const visibility = validateVisibility(body.visibility, 'private');

      const tree = await createTree({
        ownerId: user.uid,
        title,
        visibility,
      });

      return created(serializeTree(tree), { 'Access-Control-Allow-Origin': '*' });
    }

    // ── GET: list trees ─────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      // Try authenticated first; fall back to public community trees
      let trees;
      let user = null;
      try {
        user = await requireUser(event);
      } catch (_auth) {
        // Unauthenticated — will show public trees only
        user = null;
      }
      
      try {
        if (user) {
          trees = await queryTrees({ ownerId: user.uid });
        } else {
          trees = await queryTrees({ visibility: 'public', limit: 20 });
        }
      } catch (dbError) {
        return handleError('trees-db', dbError, requestOrigin);
      }

      return ok(serializeTreeList(trees), { 'Access-Control-Allow-Origin': '*' });
    }

    // ── PUT: update tree ───────────────────────────────────────────────────
    if (event.httpMethod === 'PUT') {
      let user;
      try {
        user = await requireUser(event);
      } catch (authError) {
        return handleError('trees-auth', authError, requestOrigin);
      }

      // Extract treeId from path: /trees/{id}
      const pathParts = event.path.split('/').filter(Boolean);
      const treeId = pathParts[pathParts.length - 1];
      if (!treeId) {
        return httpError(400, 'Tree ID required');
      }

      // Get tree and verify ownership
      const tree = await getTreeById(treeId);
      if (!tree) {
        return httpError(404, 'Tree not found');
      }
      if (tree.ownerId !== user.uid) {
        return httpError(403, 'Forbidden: not your tree');
      }

      // Parse and validate body
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (_) {
        throw httpError(400, 'Invalid JSON body');
      }

      // Update fields
      const updates = {};
      if (body.title !== undefined) {
        updates.title = validateOptionalString(body.title, 200) || tree.title;
      }
      if (body.visibility !== undefined) {
        updates.visibility = validateVisibility(body.visibility, tree.visibility);
      }

      const updated = await updateTree(treeId, updates);
      return ok(serializeTree(updated), { 'Access-Control-Allow-Origin': '*' });
    }

    // ── DELETE: delete tree ─────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      let user;
      try {
        user = await requireUser(event);
      } catch (authError) {
        return handleError('trees-auth', authError, requestOrigin);
      }

      // Extract treeId from path
      const pathParts = event.path.split('/').filter(Boolean);
      const treeId = pathParts[pathParts.length - 1];
      if (!treeId) {
        return httpError(400, 'Tree ID required');
      }

      // Get tree and verify ownership
      const tree = await getTreeById(treeId);
      if (!tree) {
        return httpError(404, 'Tree not found');
      }
      if (tree.ownerId !== user.uid) {
        return httpError(403, 'Forbidden: not your tree');
      }

      await deleteTree(treeId);
      return ok({ deleted: true, id: treeId }, { 'Access-Control-Allow-Origin': '*' });
    }

    throw httpError(405, 'Method not allowed');
  } catch (error) {
    return handleError('trees', error, requestOrigin);
  }
};