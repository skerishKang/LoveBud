/**
 * netlify/functions/_lib/serializers.js
 * 
 * Maps DB Schema (name, is_public, description) to Frontend API Contract (title, visibility, memo).
 */

function serializeMemory(input) {
  const raw = input || {};
  
  return {
    id: raw.id || null,
    treeId: raw.treeId || raw.tree_id || null,
    parentId: raw.parentId || raw.parent_id || null,
    title: raw.title || '',
    memo: raw.description || raw.memo || '', // DB description -> API memo
    artist: raw.artist || '',
    sourceUrl: raw.sourceUrl || raw.source_url || '',
    thumbnail: raw.thumbnail || '',
    emotionTags: raw.emotionTags || raw.emotion_tags || [],
    timestamp: raw.timestamp || raw.date || '',
    visibility: raw.visibility || 'private',
    createdAt: raw.created_at || raw.createdAt || null,
    updatedAt: raw.updated_at || raw.updatedAt || null,
  };
}

function serializeTree(input) {
  const raw = input || {};
  
  // Final Safety Fix: Ensure payload is an object
  let payload = raw.payload || { nodes: [], edges: [] };
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      payload = { nodes: [], edges: [] };
    }
  }
  
  return {
    id: raw.id || null,
    ownerId: raw.owner_id || raw.ownerId || null,
    title: raw.name || raw.title || '', // DB name -> API title
    visibility: raw.is_public === true ? 'public' : 'private', // DB is_public(bool) -> API visibility(string)
    createdAt: raw.created_at || raw.createdAt || null,
    updatedAt: raw.updated_at || raw.updatedAt || null,
    nodeCount: raw.node_count || 0,
    payload: payload
  };
}

module.exports = {
  serializeMemory,
  serializeMemoryList: (items) => (Array.isArray(items) ? items.map(serializeMemory) : []),
  serializeTree,
  serializeTreeList: (items) => (Array.isArray(items) ? items.map(serializeTree) : []),
};