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
const { queryMemories, createMemory, queryTrees, getTree } = require('./_lib/doc-store');

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

      // tree ownership 검증: 본인 소유 tree에만 메모리 생성 가능
      const targetTree = await getTree(body.treeId);
      if (!targetTree || targetTree.data.owner_id !== user.uid) {
        throw httpError(403, 'Access denied: not your tree');
      }

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

      // ownership enforcement: 사용자가 소유한 트리의 메모리만 조회
      let allowedTreeIds = [];

      if (params.treeId) {
        // 특정 treeId 조회 시 본인 소유인지 확인
        const tree = await getTree(params.treeId);
        if (!tree || tree.data.owner_id !== user.uid) {
          throw httpError(403, 'Access denied: not your tree');
        }
        allowedTreeIds = [params.treeId];
      } else {
        // treeId 없이 조회 시 본인 모든 트리 조회
        const userTrees = await queryTrees({ ownerId: user.uid });
        allowedTreeIds = userTrees.map((t) => t.id);
      }

      const filters = {};
      if (allowedTreeIds.length === 1) {
        filters.treeId = allowedTreeIds[0];
      } else if (allowedTreeIds.length > 1) {
        // 여러 트리 허용 (doc-store.js 수정 필요하지만 우선 첫 번째만)
        filters.treeId = allowedTreeIds[0]; // MVP: 첫 트리만 조회
      } else {
        // 소유한 트리 없음 → 빈 결과
        return ok([], { 'Access-Control-Allow-Origin': '*' });
      }

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