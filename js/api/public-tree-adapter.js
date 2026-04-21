(function () {
  /**
   * LoveTree public tree adapter
   *
   * Canonical namespace: LoveTreePublicTreeAdapter
   *
   * Transitional compatibility only for public browse paths.
   */

  function unwrapTreeRecord(tree) {
    return tree?.data || tree || {};
  }

  function unwrapMemoryRecord(memory) {
    return memory?.data || memory || {};
  }

  function getRecordTreeId(record) {
    return record.treeId || record.tree_id || null;
  }

  function normalizeBrowseTreeRecord(rawTree) {
    const tree = unwrapTreeRecord(rawTree);
    return {
      id: tree.id || rawTree?.id || null,
      title: tree.title || '',
      visibility: tree.visibility || 'private',
      createdAt: tree.createdAt || tree.created_at || null,
      updatedAt: tree.updatedAt || tree.updated_at || null,
      ownerId: tree.ownerId || tree.owner_id || null,
      representativeThumbnail: tree.representativeThumbnail || tree.representative_thumbnail || tree.thumbnail || '',
      memoryCount: Number(tree.memoryCount || tree.memory_count || 0),
      theme: tree.theme || '',
      stage: tree.stage || ''
    };
  }

  function normalizeBrowseMemoryRecord(rawMemory) {
    const memory = unwrapMemoryRecord(rawMemory);
    return {
      id: memory.id || null,
      treeId: memory.treeId || memory.tree_id || null,
      createdAt: memory.createdAt || memory.created_at || null,
      timestamp: memory.timestamp || '',
      thumbnail: memory.thumbnail || '',
      sourceUrl: memory.sourceUrl || memory.source_url || '',
      title: memory.title || '',
      memo: memory.memo || '',
      artist: memory.artist || '',
      emotionTags: Array.isArray(memory.emotionTags)
        ? memory.emotionTags
        : (Array.isArray(memory.emotion_tags) ? memory.emotion_tags : []),
    };
  }

  function estimateStage(count) {
    if (count <= 0) return '새 트리';
    if (count <= 2) return '입덕';
    if (count <= 4) return '성장';
    return '최애';
  }

  function buildPublicTreeSummaryModels(apiTrees) {
    return (Array.isArray(apiTrees) ? apiTrees : [])
      .map((rawTree) => normalizeBrowseTreeRecord(rawTree))
      .filter((tree) => tree.visibility === 'public')
      .map((tree) => ({
        id: tree.id,
        title: tree.title,
        visibility: tree.visibility,
        createdAt: tree.createdAt,
        updatedAt: tree.updatedAt,
        ownerId: tree.ownerId,
        memories: [],
        memoryCount: Number.isFinite(tree.memoryCount) ? tree.memoryCount : 0,
        emotionTags: [],
        timeRange: '기록 없음',
        representativeThumbnail: tree.representativeThumbnail || '',
        theme: tree.theme || '',
        stage: tree.stage || estimateStage(tree.memoryCount)
      }));
  }

  function hydrateTreeWithPublicMemories(tree, apiMemories) {
    const safeTree = tree || {};
    const treeId = safeTree.id;
    const mems = (Array.isArray(apiMemories) ? apiMemories : [])
      .map((rawMemory) => normalizeBrowseMemoryRecord(rawMemory))
      .filter((memory) => memory.treeId && memory.treeId === treeId)
      .sort((a, b) =>
        new Date(a.createdAt || a.timestamp || 0) -
        new Date(b.createdAt || b.timestamp || 0)
      );

    const allTags = mems.flatMap((m) => m.emotionTags).filter(Boolean);
    const uniqueTags = [...new Set(allTags)].slice(0, 3);
    const timestamps = mems.map((m) => m.timestamp).filter(Boolean);
    const timeRange = timestamps.length >= 2
      ? `${timestamps[0]} ~ ${timestamps[timestamps.length - 1]}`
      : (timestamps[0] || '기록 없음');
    const representativeThumbnail = mems[0]?.thumbnail || safeTree.representativeThumbnail || '';
    const theme = mems[0]?.artist || safeTree.theme || 'LoveTree';
    const memoryCount = Math.max(mems.length, Number(safeTree.memoryCount || 0));

    return {
      ...safeTree,
      memories: mems,
      memoryCount,
      emotionTags: uniqueTags,
      timeRange,
      representativeThumbnail,
      theme,
      stage: safeTree.stage || estimateStage(memoryCount)
    };
  }

  function buildPublicTreeViewModels(apiTrees, apiMemories) {
    return buildPublicTreeSummaryModels(apiTrees).map((tree) => hydrateTreeWithPublicMemories(tree, apiMemories));
  }

  window.LoveTreePublicTreeAdapter = {
    unwrapTreeRecord,
    unwrapMemoryRecord,
    getRecordTreeId,
    normalizeBrowseTreeRecord,
    normalizeBrowseMemoryRecord,
    buildPublicTreeSummaryModels,
    hydrateTreeWithPublicMemories,
    buildPublicTreeViewModels,
  };

  if (typeof window !== 'undefined' && window.__LoveBudApiClientInternals) {
    Object.assign(window.__LoveBudApiClientInternals, {
      unwrapTreeRecord,
      unwrapMemoryRecord,
      getRecordTreeId,
      normalizeBrowseTreeRecord,
      normalizeBrowseMemoryRecord,
    });
  }

})();
