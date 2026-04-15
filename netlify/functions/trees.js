/**
 * GET /api/trees      → list user's trees
 * POST /api/trees     → create new tree
 */
const { requireUser } = require('./_lib/auth');
const { ok, created, httpError, handleError } = require('./_lib/http');
const { queryTrees, createTree, validateRequired, validateVisibility, validateOptionalString } = require('./_lib/doc-store');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }

  try {
    // ── POST: create tree ───────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const user = await requireUser(event);
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

      return created(tree, { 'Access-Control-Allow-Origin': '*' });
    }

    // ── GET: list trees ─────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      // Try authenticated first; fall back to public community trees
      let trees;
      try {
        const user = await requireUser(event);
        trees = await queryTrees({ ownerId: user.uid });
      } catch (_auth) {
        // Unauthenticated — show public trees only
        trees = await queryTrees({ visibility: 'public', limit: 20 });
      }

      return ok(trees, { 'Access-Control-Allow-Origin': '*' });
    }

    throw httpError(405, 'Method not allowed');
  } catch (error) {
    return handleError('trees', error, requestOrigin);
  }
};