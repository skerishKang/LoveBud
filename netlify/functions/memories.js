/**
 * GET /api/memories         → list memories (auth required, own trees only)
 * POST /api/memories        → create memory (auth required, visibility inherits parent tree, private requires Plus)
 *
 * Query params for GET:
 *   ?treeId=<treeId>   — filter by tree
 *   ?parentId=<id>     — filter by parent memory (null = root-level)
 */
const { requireUser, requirePlusEntitlement } = require('./_lib/auth');
const { ok, created, preflight, httpError, handleError } = require('./_lib/http');
const {
  queryMemories,
  createMemory,
  queryTrees,
  getTree,
  validateRequired,
  validateVisibility,
  validateSourceType,
  validateOptionalString,
  validateUuid,
  validateLimit
} = require('./_lib/doc-store');
const { serializeMemory, serializeMemoryList } = require('./_lib/serializers');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return preflight(requestOrigin);
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

      validateRequired(body.treeId, 'treeId');
      const treeId = validateUuid(body.treeId, 'treeId');

      // 트리 먼저 조회 (owner 확인 및 visibility 상속용)
      const targetTree = await getTree(treeId);
      if (!targetTree || targetTree.owner_id !== user.uid) {
        throw httpError(403, 'Access denied: not your tree');
      }

      const title = validateOptionalString(body.title, 200);
      const memo = validateOptionalString(body.memo, 5000);
      const artist = validateOptionalString(body.artist, 100);
      const source = validateOptionalString(body.source, 200);
      const sourceUrl = validateOptionalString(body.sourceUrl, 1000);
      const sourceType = validateSourceType(body.sourceType, 'youtube');
      const thumbnail = validateOptionalString(body.thumbnail, 500);
      const timestamp = validateOptionalString(body.timestamp, 100);

      // visibility omitted 시 parent tree visibility 상속
      let visibility;
      if (body.visibility === undefined || body.visibility === null) {
        visibility = targetTree.visibility || 'public';
      } else {
        visibility = validateVisibility(body.visibility, targetTree.visibility || 'public');
      }

      // private memory 생성은 Plus entitlement 필요
      if (visibility === 'private') {
        await requirePlusEntitlement(user.uid);
      }

      let emotionTags = [];
      if (body.emotionTags !== undefined) {
        if (!Array.isArray(body.emotionTags)) {
          throw httpError(400, 'emotionTags must be an array');
        }
        if (body.emotionTags.length > 20) {
          throw httpError(400, 'emotionTags exceeds maximum of 20 items');
        }
        emotionTags = body.emotionTags.map((tag) => {
          if (typeof tag !== 'string' || tag.trim().length === 0) {
            throw httpError(400, 'emotionTags must contain non-empty strings');
          }
          return tag.trim();
        });
      }

      let parentId = null;
      if (body.parentId !== undefined && body.parentId !== null && body.parentId !== '') {
        parentId = validateUuid(body.parentId, 'parentId');
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

      return created(serializeMemory(memory), null, requestOrigin);
    }

    // ── GET: list memories ──────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      let allowedTreeIds = [];

      if (params.treeId) {
        const tree = await getTree(params.treeId);
        if (!tree || tree.owner_id !== user.uid) {
          throw httpError(403, 'Access denied: not your tree');
        }
        allowedTreeIds = [params.treeId];
      } else {
        const userTrees = await queryTrees({ ownerId: user.uid });
        allowedTreeIds = userTrees.map((t) => t.id);
      }

      const baseFilters = {};
      if ('parentId' in params) {
        baseFilters.parentId = params.parentId === 'null' ? null : params.parentId;
      }
      if (params.visibility) baseFilters.visibility = params.visibility;
      if (params.limit) baseFilters.limit = validateLimit(params.limit);

      const memories = await queryMemories({
        ...baseFilters,
        ...(allowedTreeIds.length === 1
          ? { treeId: allowedTreeIds[0] }
          : { treeIds: allowedTreeIds }),
      });
      return ok(serializeMemoryList(memories), null, requestOrigin);
    }

    throw httpError(405, 'Method not allowed');
  } catch (error) {
    return handleError('memories', error, requestOrigin);
  }
};