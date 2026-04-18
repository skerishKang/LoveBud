/**
 * API response serializers
 * For production schema v1: trees (title, visibility), memories (separate table)
 */

function serializeMemory(row) {
  if (!row) return null;
  return {
    id: row.id || null,
    treeId: row.tree_id || null,
    parentId: row.parent_id || null,
    title: row.title || '',
    memo: row.memo || '',
    artist: row.artist || '',
    source: row.source || '',
    sourceUrl: row.source_url || '',
    sourceType: row.source_type || 'youtube',
    thumbnail: row.thumbnail || '',
    emotionTags: row.emotion_tags || [],
    timestamp: row.timestamp || '',
    visibility: row.visibility || 'private',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function serializeMemoryList(items) {
  return Array.isArray(items) ? items.map(serializeMemory) : [];
}

function serializeTree(row) {
  if (!row) return null;
  return {
    id: row.id || null,
    ownerId: row.owner_id || null,
    title: row.title || '',
    visibility: row.visibility || 'private',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function serializeTreeList(items) {
  return Array.isArray(items) ? items.map(serializeTree) : [];
}

module.exports = {
  serializeMemory,
  serializeMemoryList,
  serializeTree,
  serializeTreeList,
};