/**
 * PATCH /api/memories/:memoryId  → update memory
 * DELETE /api/memories/:memoryId → delete memory
 * GET    /api/memories/:memoryId → get single memory
 *
 * GET: public memory는 비로그인도 허용
 * PATCH/PUT/DELETE: owner only
 */
const { requireUser, getUserFromEvent } = require('./_lib/auth');
const { ok, noContent, httpError, handleError } = require('./_lib/http');
const {
  getMemory,
  updateMemory,
  deleteMemory,
  getTree,
  validateVisibility,
  validateSourceType,
  validateOptionalString,
  validateUuid
} = require('./_lib/doc-store');
const { serializeMemory } = require('./_lib/serializers');

// Allowed fields for PATCH / PUT
const ALLOWED_MEMORY_FIELDS = [
  'title',
  'memo',
  'artist',
  'source',
  'sourceUrl',
  'sourceType',
  'thumbnail',
  'timestamp',
  'visibility',
  'parentId',
  'emotionTags',
];

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return ok(null, { 'Access-Control-Allow-Origin': '*' });
  }

  try {
    // Extract memoryId from path
    const pathParts = (event.path || '').split('/');
    const memoryId = pathParts[pathParts.length - 1];

    if (!memoryId) throw httpError(400, 'Missing memoryId');

    // Validate memoryId format
    const validatedMemoryId = validateUuid(memoryId, 'memoryId');

    // Load existing
    const existing = await getMemory(validatedMemoryId);
    if (!existing) throw httpError(404, 'Memory not found');

    const existingFlat = serializeMemory(existing);

    // Ownership check: memory가 속한 tree의 owner 확인
    const tree = await getTree(existingFlat.treeId);
    const ownerId = tree?.owner_id;
    const optionalUser = await getUserFromEvent(event);
    const isOwner = !!optionalUser && ownerId === optionalUser.uid;

    // ── GET ─────────────────────────────────────────────────────────────────
    // GET: public memory는 비로그인 허용, private는 owner만
    if (event.httpMethod === 'GET') {
      const isPublic = existingFlat.visibility === 'public';
      if (!isPublic && !isOwner) {
        throw httpError(403, 'Access denied: private memory');
      }
      return ok(existingFlat, { 'Access-Control-Allow-Origin': '*' });
    }

    // PATCH/DELETE는 인증 필수
    const user = await requireUser(event);
    if (!tree || ownerId !== user.uid) {
      throw httpError(403, 'Access denied: not your memory');
    }

    // ── PATCH / PUT ─────────────────────────────────────────────────────────
    if (event.httpMethod === 'PATCH' || event.httpMethod === 'PUT') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (_) {
        throw httpError(400, 'Invalid JSON body');
      }

      const allowedPatch = {};

      for (const field of ALLOWED_MEMORY_FIELDS) {
        if (body[field] === undefined) continue;

        if (field === 'visibility') {
          allowedPatch[field] = validateVisibility(body[field], 'private');
        } else if (field === 'sourceType') {
          allowedPatch[field] = validateSourceType(body[field], 'youtube');
        } else if (field === 'emotionTags') {
          if (!Array.isArray(body[field])) {
            throw httpError(400, 'emotionTags must be an array');
          }
          if (body[field].length > 20) {
            throw httpError(400, 'emotionTags exceeds maximum of 20 items');
          }
          allowedPatch[field] = body[field].map((tag) => {
            if (typeof tag !== 'string' || tag.trim().length === 0) {
              throw httpError(400, 'emotionTags must contain non-empty strings');
            }
            return tag.trim();
          });
        } else if (field === 'parentId') {
          if (body[field] === null || body[field] === '') {
            allowedPatch[field] = null;
          } else {
            allowedPatch[field] = validateUuid(body[field], 'parentId');
          }
        } else {
          const limits = {
            title: 200,
            memo: 5000,
            artist: 100,
            source: 200,
            sourceUrl: 1000,
            thumbnail: 500,
            timestamp: 100,
          };
          allowedPatch[field] = validateOptionalString(body[field], limits[field] || 5000);
        }
      }

      const updated = await updateMemory(validatedMemoryId, allowedPatch);
      if (!updated) throw httpError(404, 'Memory not found');

      return ok(serializeMemory(updated), { 'Access-Control-Allow-Origin': '*' });
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      const deleted = await deleteMemory(validatedMemoryId);
      if (!deleted) throw httpError(404, 'Memory not found');
      return noContent({ 'Access-Control-Allow-Origin': '*' });
    }

    throw httpError(405, 'Method not allowed');
  } catch (error) {
    return handleError('memory-detail', error, requestOrigin);
  }
};