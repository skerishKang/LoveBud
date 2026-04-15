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
const { queryMemories, createMemory, queryTrees, getTree, validateRequired, validateVisibility, validateSourceType, validateOptionalString, validateUuid, validateLimit } = require('./_lib/doc-store');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return ok(null, { 'Access-Control-Allow-Origin': '*' });
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

      // Validate required fields
      validateRequired(body.treeId, 'treeId');
      const treeId = validateUuid(body.treeId, 'treeId');

      // Validate optional fields with limits
      const title = validateOptionalString(body.title, 200);
      const memo = validateOptionalString(body.memo, 5000);
      const artist = validateOptionalString(body.artist, 100);
      const source = validateOptionalString(body.source, 200);
      const sourceUrl = validateOptionalString(body.sourceUrl, 1000);
      const sourceType = validateSourceType(body.sourceType, 'youtube');
      const thumbnail = validateOptionalString(body.thumbnail, 500);
      const timestamp = validateOptionalString(body.timestamp, 100);
      const visibility = validateVisibility(body.visibility, 'private');

      // Validate emotionTags if provided
      let emotionTags = [];
      if (body.emotionTags !== undefined) {
        if (!Array.isArray(body.emotionTags)) {
          throw httpError(400, 'emotionTags must be an array');
        }
        if (body.emotionTags.length > 20) {
          throw httpError(400, 'emotionTags exceeds maximum of 20 items');
        }
        emotionTags = body.emotionTags.map(tag => {
          if (typeof tag !== 'string' || tag.trim().length === 0) {
            throw httpError(400, 'emotionTags must contain non-empty strings');
          }
          return tag.trim();
        });
      }

      // Validate parentId if provided (must be valid UUID)
      let parentId = null;
      if (body.parentId !== undefined && body.parentId !== null && body.parentId !== '') {
        parentId = validateUuid(body.parentId, 'parentId');
      }

      // tree ownership 검증: 본인 소유 tree에만 메모리 생성 가능
      const targetTree = await getTree(treeId);
      if (!targetTree || targetTree.data.owner_id !== user.uid) {
        throw httpError(403, 'Access denied: not your tree');
      }

      const memory = await createMemory({
        treeId,
        parentId,
        title,
        memo,
        artist,
        source,
        sourceUrl,
        sourceType,
        thumbnail,
        emotionTags,
        timestamp,
        visibility,
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
      if (params.limit) filters.limit = validateLimit(params.limit);

      const memories = await queryMemories(filters);
      return ok(memories, { 'Access-Control-Allow-Origin': '*' });
    }

    throw httpError(405, 'Method not allowed');
  } catch (error) {
    return handleError('memories', error, requestOrigin);
  }
};