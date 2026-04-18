/**
 * API response serializers
 * Internal doc-store shape ({ id, data: {...} }) -> flat camelCase API shape
 * 
 * Adapted for production schema v1 (001_initial_schema.sql):
 *   trees: id, owner_id, title, visibility, created_at, updated_at
 *   memories: id, tree_id, parent_id, title, memo, artist, source, source_url,
 *              source_type, thumbnail, emotion_tags, timestamp, visibility,
 *              created_at, updated_at
 */

function serializeMemory(input) {
  const raw = input && input.data ? { id: input.id, ...input.data } : (input || {});

  return {
    id: raw.id || null,
    treeId: raw.tree_id ?? raw.treeId ?? null,
    parentId: raw.parent_id ?? raw.parentId ?? null,
    title: raw.title || '',
    memo: raw.memo ?? raw.description ?? '',
    artist: raw.artist || '',
    source: raw.source || '',
    sourceUrl: raw.source_url ?? raw.sourceUrl ?? '',
    sourceType: raw.source_type ?? raw.sourceType ?? 'youtube',
    thumbnail: raw.thumbnail || '',
    emotionTags: raw.emotion_tags ?? raw.emotionTags ?? [],
    timestamp: raw.timestamp || '',
    visibility: raw.visibility || 'private',
    createdAt: raw.created_at ?? raw.createdAt ?? null,
    updatedAt: raw.updated_at ?? raw.updatedAt ?? null,
  };
}

function serializeMemoryList(items) {
  return Array.isArray(items) ? items.map(serializeMemory) : [];
}

function serializeTree(input, options = {}) {
  const raw = input && input.data ? { id: input.id, ...input.data } : (input || {});

  return {
    id: raw.id || null,
    ownerId: raw.owner_id ?? raw.ownerId ?? null,
    title: raw.title || '',
    visibility: raw.visibility || 'private',
    createdAt: raw.created_at ?? raw.createdAt ?? null,
    updatedAt: raw.updated_at ?? raw.updatedAt ?? null,
  };
}

function serializeTreeList(items) {
  return Array.isArray(items) ? items.map((item) => serializeTree(item)) : [];
}

module.exports = {
  serializeMemory,
  serializeMemoryList,
  serializeTree,
  serializeTreeList,
};