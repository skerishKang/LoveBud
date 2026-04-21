(function () {
  /**
   * LoveTree public tree adapter
   *
   * Canonical namespace: LoveTreePublicTreeAdapter
   *
   * Transitional compatibility only for public browse paths.
   *
   * Migration-only fallback scope:
   * - legacy `{ data }` wrapper
   * - `tree_id`
   * - `created_at`
   * - `owner_id`
   * - `emotion_tags`
   *
   * Remove these fallback paths after:
   * 1) /api/community/trees is camelCase-only
   * 2) /api/community/memories is camelCase-only
   * 3) contract tests stay green without legacy fixtures
   *
   * New code outside this adapter must not directly read snake_case fields.
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
      ownerId: tree.ownerId || tree.owner_id || null,
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

  function buildPublicTreeViewModels(apiTrees, apiMemories) {
    const validTrees = (Array.isArray(apiTrees) ? apiTrees : [])
      .map((rawTree) => normalizeBrowseTreeRecord(rawTree))
      .filter((tree) => tree.visibility === 'public');

    if (validTrees.length === 0) {
      return [];
    }

    const grouped = {};
    (Array.isArray(apiMemories) ? apiMemories : []).forEach((rawMemory) => {
      const memory = normalizeBrowseMemoryRecord(rawMemory);
      if (!memory.treeId) return;
      if (!grouped[memory.treeId]) grouped[memory.treeId] = [];
      grouped[memory.treeId].push(memory);
    });

    return validTrees.map((tree) => {
      const mems = grouped[tree.id] || [];
      const sortedMems = [...mems].sort((a, b) =>
        new Date(a.createdAt || a.timestamp || 0) -
        new Date(b.createdAt || b.timestamp || 0)
      );

      const allTags = sortedMems.flatMap((m) => m.emotionTags).filter(Boolean);
      const uniqueTags = [...new Set(allTags)].slice(0, 3);
      const timestamps = sortedMems.map((m) => m.timestamp).filter(Boolean);
      const timeRange = timestamps.length >= 2
        ? `${timestamps[0]} ~ ${timestamps[timestamps.length - 1]}`
        : (timestamps[0] || '');

      return {
        id: tree.id,
        title: tree.title,
        visibility: tree.visibility,
        createdAt: tree.createdAt,
        ownerId: tree.ownerId,
        memories: sortedMems,
        memoryCount: sortedMems.length,
        emotionTags: uniqueTags,
        timeRange: timeRange || '기록 없음',
        representativeThumbnail: sortedMems[0]?.thumbnail || '',
        theme: sortedMems[0]?.artist || 'LoveTree',
        stage: sortedMems.length === 0
          ? '새 트리'
          : (sortedMems.length <= 2 ? '입덕' : (sortedMems.length <= 4 ? '성장' : '최애'))
      };
    });
  }

  // Expose as LoveTreePublicTreeAdapter
  window.LoveTreePublicTreeAdapter = {
    unwrapTreeRecord,
    unwrapMemoryRecord,
    getRecordTreeId,
    normalizeBrowseTreeRecord,
    normalizeBrowseMemoryRecord,
    buildPublicTreeViewModels,
  };

  // Also expose via __LoveBudApiClientInternals for backward compatibility with tests
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
