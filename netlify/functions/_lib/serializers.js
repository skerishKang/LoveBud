/**
 * API response serializers
 * Internal doc-store shape ({ id, data: {...} }) -> flat camelCase API shape
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
  const payload = {};

  // 기존 payload가 있으면 우선 반영
  if (raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)) {
    Object.assign(payload, raw.payload);
  }

  // doc-store가 payload를 spread해서 올려보내는 구조도 payload로 다시 묶음
  const reserved = new Set([
    'id',
    'owner_id',
    'ownerId',
    'title',
    'visibility',
    'created_at',
    'createdAt',
    'updated_at',
    'updatedAt',
    'node_count',
    'nodeCount',
    'payload',
  ]);

  Object.keys(raw).forEach((key) => {
    if (!reserved.has(key)) {
      payload[key] = raw[key];
    }
  });

  if (options.nodes) {
    payload.nodes = options.nodes;
  }

  return {
    id: raw.id || null,
    ownerId: raw.owner_id ?? raw.ownerId ?? null,
    title: raw.title || '',
    visibility: raw.visibility || 'private',
    createdAt: raw.created_at ?? raw.createdAt ?? null,
    updatedAt: raw.updated_at ?? raw.updatedAt ?? null,
    nodeCount:
      raw.node_count ??
      raw.nodeCount ??
      (Array.isArray(payload.nodes) ? payload.nodes.length : 0),
    payload,
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
