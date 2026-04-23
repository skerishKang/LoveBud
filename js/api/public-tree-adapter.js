(function () {
  /**
   * LoveTree public tree adapter
   *
   * Canonical namespace: LoveTreePublicTreeAdapter
   *
   * Transitional compatibility only for public browse paths.
   */

  function sanitizeUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      return u.toString();
    } catch (e) {
      return '';
    }
  }

  function isValidYouTubeVideoId(id) {
    return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id);
  }

  function extractYouTubeVideoId(url) {
    if (!url) return null;
    const s = String(url);
    
    // Standard watch URL or any URL with v= parameter
    const vMatch = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (vMatch) return vMatch[1];
    
    // youtu.be/ID, shorts/ID, embed/ID, live/ID, v/ID
    const pathMatch = s.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/);
    if (pathMatch) return pathMatch[1];

    return null;
  }

  function extractYouTubeVideoIdFromThumbnail(url) {
    if (!url) return null;
    const s = String(url);
    // img.youtube.com/vi/ID/..., i.ytimg.com/vi/ID/...
    const match = s.match(/(?:img\.youtube\.com|i\.ytimg\.com)\/vi\/([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  function buildCanonicalYouTubeThumbnailUrl(videoId) {
    if (!isValidYouTubeVideoId(videoId)) return '';
    return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  }

  function buildCanonicalYouTubeEmbedUrl(videoId) {
    if (!isValidYouTubeVideoId(videoId)) return '';
    return `https://www.youtube.com/embed/${videoId}`;
  }

  function canonicalizeYouTubeSourceUrl(url) {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) return buildCanonicalYouTubeEmbedUrl(videoId);
    return sanitizeUrl(url);
  }

  function canonicalizeYouTubeThumbnailUrl(url, fallbackSourceUrl) {
    let videoId = extractYouTubeVideoIdFromThumbnail(url);
    if (!videoId) {
      videoId = extractYouTubeVideoId(url) || extractYouTubeVideoId(fallbackSourceUrl);
    }
    
    if (videoId && isValidYouTubeVideoId(videoId)) {
      return buildCanonicalYouTubeThumbnailUrl(videoId);
    }
    
    return sanitizeUrl(url);
  }

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
    const rawThumb = tree.representativeThumbnail || tree.representative_thumbnail || tree.thumbnail || '';
    
    return {
      id: tree.id || rawTree?.id || null,
      title: tree.title || '',
      visibility: tree.visibility || 'private',
      createdAt: tree.createdAt || tree.created_at || null,
      updatedAt: tree.updatedAt || tree.updated_at || null,
      ownerId: tree.ownerId || tree.owner_id || null,
      representativeThumbnail: canonicalizeYouTubeThumbnailUrl(rawThumb),
      memoryCount: Number(tree.memoryCount || tree.memory_count || 0),
      theme: tree.theme || '',
      stage: tree.stage || ''
    };
  }

  function normalizeBrowseMemoryRecord(rawMemory) {
    const memory = unwrapMemoryRecord(rawMemory);
    const rawSource = memory.sourceUrl || memory.source_url || '';
    const rawThumb = memory.thumbnail || '';

    return {
      id: memory.id || null,
      treeId: memory.treeId || memory.tree_id || null,
      createdAt: memory.createdAt || memory.created_at || null,
      timestamp: memory.timestamp || '',
      thumbnail: canonicalizeYouTubeThumbnailUrl(rawThumb, rawSource),
      sourceUrl: canonicalizeYouTubeSourceUrl(rawSource),
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
    // Utils
    sanitizeUrl,
    isValidYouTubeVideoId,
    extractYouTubeVideoId,
    extractYouTubeVideoIdFromThumbnail,
    buildCanonicalYouTubeThumbnailUrl,
    buildCanonicalYouTubeEmbedUrl,
    canonicalizeYouTubeSourceUrl,
    canonicalizeYouTubeThumbnailUrl
  };

  if (typeof window !== 'undefined' && window.__LoveBudApiClientInternals) {
    Object.assign(window.__LoveBudApiClientInternals, {
      unwrapTreeRecord,
      unwrapMemoryRecord,
      getRecordTreeId,
      normalizeBrowseTreeRecord,
      normalizeBrowseMemoryRecord,
      canonicalizeYouTubeSourceUrl,
      canonicalizeYouTubeThumbnailUrl
    });
  }

})();
