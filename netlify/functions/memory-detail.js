/**
 * PATCH /api/memories/:memoryId  → update memory
 * DELETE /api/memories/:memoryId → delete memory
 * GET    /api/memories/:memoryId → get single memory
 *
 * All require authentication. Ownership check enforced for write ops.
 */
const { requireUser } = require('./_lib/auth');
const { ok, noContent, httpError, handleError } = require('./_lib/http');
const { getMemory, updateMemory, deleteMemory, getTree, validateVisibility, validateSourceType, validateOptionalString, validateUuid } = require('./_lib/doc-store');

// Allowed fields for PATCH ( whitelist approach)
const ALLOWED_MEMORY_FIELDS = [
  'title', 'memo', 'artist', 'source', 'sourceUrl', 'sourceUrl',
  'sourceType', 'thumbnail', 'timestamp', 'visibility', 'parentId', 'emotionTags'
];

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return ok(null, { 'Access-Control-Allow-Origin': '*' });
  }

  try {
    const user = await requireUser(event);

    // Extract memoryId from path
    const pathParts = (event.path || '').split('/');
    const memoryId = pathParts[pathParts.length - 1];

    if (!memoryId) throw httpError(400, 'Missing memoryId');

    // Validate memoryId format
    const validatedMemoryId = validateUuid(memoryId, 'memoryId');

    // Load existing
    const existing = await getMemory(validatedMemoryId);
    if (!existing) throw httpError(404, 'Memory not found');

    // Ownership check: memory가 속한 tree의 owner 확인
    const tree = await getTree(existing.data.tree_id);
    const isOwner = tree && tree.data.owner_id === user.uid;

    // ── GET ─────────────────────────────────────────────────────────────────
    // GET: private memory는 owner만, public memory는 anyone (auth required)
    if (event.httpMethod === 'GET') {
      const isPublic = existing.data.visibility === 'public';
      if (!isPublic && !isOwner) {
        throw httpError(403, 'Access denied: private memory');
      }
      return ok(existing, { 'Access-Control-Allow-Origin': '*' });
    }

    // PATCH/DELETE: owner only
    if (!isOwner) {
      throw httpError(403, 'Access denied: not your memory');
    }

    // ── PATCH / PUT ─────────────────────────────────────────────────────────
    // PUT과 PATCH 모두 동일한 update 로직 사용 (JSON API 표준)
    if (event.httpMethod === 'PATCH' || event.httpMethod === 'PUT') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (_) {
        throw httpError(400, 'Invalid JSON body');
      }

      // Filter to only allowed fields (whitelist)
      const allowedPatch = {};
      for (const field of ALLOWED_MEMORY_FIELDS) {
        if (body[field] !== undefined) {
          // Field-specific validation
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
            allowedPatch[field] = body[field].map(tag => {
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
            // String fields with length limits
            const limits = { title: 200, memo: 5000, artist: 100, source: 200, sourceUrl: 1000, thumbnail: 500, timestamp: 100 };
            allowedPatch[field] = validateOptionalString(body[field], limits[field] || 5000);
          }
        }
      }

      const updated = await updateMemory(validatedMemoryId, allowedPatch);
      return ok(updated, { 'Access-Control-Allow-Origin': '*' });
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      const deleted = await deleteMemory(memoryId);
      if (!deleted) throw httpError(404, 'Memory not found');
      return noContent({ 'Access-Control-Allow-Origin': '*' });
    }

    throw httpError(405, 'Method not allowed');
  } catch (error) {
    return handleError('memory-detail', error, requestOrigin);
  }
};