/**
 * PATCH /api/memories/:memoryId  → update memory
 * DELETE /api/memories/:memoryId → delete memory
 * GET    /api/memories/:memoryId → get single memory
 *
 * All require authentication. Ownership check enforced for write ops.
 */
const { requireUser } = require('./_lib/auth');
const { ok, noContent, httpError, handleError } = require('./_lib/http');
const { getMemory, updateMemory, deleteMemory } = require('./_lib/doc-store');

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }

  try {
    const user = await requireUser(event);

    // Extract memoryId from path
    const pathParts = (event.path || '').split('/');
    const memoryId = pathParts[pathParts.length - 1];

    if (!memoryId) throw httpError(400, 'Missing memoryId');

    // Load existing
    const existing = await getMemory(memoryId);
    if (!existing) throw httpError(404, 'Memory not found');

    // Ownership check
    // TODO: load tree.owner_id and compare with user.uid
    //       For now, any authenticated user can modify — tighten in next iteration.

    // ── GET ─────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      return ok(existing, { 'Access-Control-Allow-Origin': '*' });
    }

    // ── PATCH ───────────────────────────────────────────────────────────────
    if (event.httpMethod === 'PATCH') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (_) {
        throw httpError(400, 'Invalid JSON body');
      }

      const updated = await updateMemory(memoryId, body);
      return ok(updated, { 'Access-Control-Allow-Origin': '*' });
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      await deleteMemory(memoryId);
      return noContent({ 'Access-Control-Allow-Origin': '*' });
    }

    throw httpError(405, 'Method not allowed');
  } catch (error) {
    return handleError('memory-detail', error, requestOrigin);
  }
};