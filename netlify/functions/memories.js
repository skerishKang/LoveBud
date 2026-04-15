/**
 * GET /api/memories         → list memories (auth required, own trees only)
 * POST /api/memories        → create memory (auth required)
 *
 * Query params for GET:
 *   ?treeId=<treeId>   — filter by tree
 *   ?parentId=<id>     — filter by parent memory (null = root-level)
 */
const { requireUser } = require('./_lib/auth');
const { ok, created, httpError, handleError } = require('./_lib/http');
const { queryMemories, createMemory } = require('./_lib/doc-store');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }

  try {
    const user = await requireUser(event);

    // ── POST: create memory ─────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (_) {
        throw httpError(400, 'Invalid JSON body');
      }

      if (!body.treeId) throw httpError(400, 'treeId is required');

      const memory = await createMemory({
        treeId: body.treeId,
        parentId: body.parentId || null,
        title: body.title || '',
        memo: body.memo || '',
        artist: body.artist || '',
        source: body.source || '',
        sourceUrl: body.sourceUrl || '',
        sourceType: body.sourceType || 'youtube',
        thumbnail: body.thumbnail || '',
        emotionTags: body.emotionTags || [],
        timestamp: body.timestamp || '',
        visibility: body.visibility || 'private',
      });

      return created(memory, { 'Access-Control-Allow-Origin': '*' });
    }

    // ── GET: list memories ──────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};

      // TODO: enforce that only memories belonging to user's trees are returned.
      // Currently returns memories filtered only by query params — no ownership check.
      // MVP scope: implement tree ownership check in next iteration.
      const filters = {};
      if (params.treeId) filters.treeId = params.treeId;
      if ('parentId' in params) {
        filters.parentId = params.parentId === 'null' ? null : params.parentId;
      }
      if (params.visibility) filters.visibility = params.visibility;
      if (params.limit) filters.limit = Number(params.limit);

      const memories = await queryMemories(filters);
      return ok(memories, { 'Access-Control-Allow-Origin': '*' });
    }

    throw httpError(405, 'Method not allowed');
  } catch (error) {
    return handleError('memories', error, requestOrigin);
  }
};