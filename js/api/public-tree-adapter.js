(function () {
  /**
   * LoveTree public tree adapter
   *
   * Canonical namespace: LoveTreePublicTreeAdapter
   *
   * Transitional compatibility only for public browse paths.
   * Handles legacy `{ data }` wrapper and `tree_id`, `created_at`, `owner_id`, `emotion_tags`.
   * New code outside this adapter must not directly read snake_case fields.
   */

  const TRUSTED_YOUTUBE_SOURCE_HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be'
  ]);
  const TRUSTED_YOUTUBE_THUMBNAIL_HOSTS = new Set([
    'img.youtube.com',
    'i.ytimg.com'
  ]);

  function parseHttpUrl(url) {
    if (!url) return null;
    const raw = String(url).trim();
    if (!raw) return null;

    const schemeMatch = raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    if (schemeMatch && !/^https?:$/i.test(schemeMatch[0])) return null;

    try {
      const parsed = new URL(schemeMatch ? raw : `https://${raw}`);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function sanitizeUrl(url) {
    const parsed = parseHttpUrl(url);
    return parsed ? parsed.toString() : '';
  }

  function isValidYouTubeVideoId(id) {
    return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id);
  }

  function normalizeHost(host) {
    return String(host || '').trim().toLowerCase();
  }

  function isTrustedYouTubeSourceHost(host) {
    return TRUSTED_YOUTUBE_SOURCE_HOSTS.has(normalizeHost(host));
  }

  function isTrustedYouTubeThumbnailHost(host) {
    return TRUSTED_YOUTUBE_THUMBNAIL_HOSTS.has(normalizeHost(host));
  }

  function isYouTubeHost(url) {
    const parsed = parseHttpUrl(url);
    if (!parsed) return false;
    return isTrustedYouTubeSourceHost(parsed.hostname) || isTrustedYouTubeThumbnailHost(parsed.hostname);
  }

  function extractYouTubeVideoIdFromParsedSource(parsed) {
    if (!parsed || !isTrustedYouTubeSourceHost(parsed.hostname)) return null;

    const host = normalizeHost(parsed.hostname);
    const segments = parsed.pathname.split('/').filter(Boolean);
    let videoId = '';

    if (host === 'youtu.be') {
      videoId = segments[0] || '';
    } else if (['embed', 'v', 'shorts', 'live'].includes(segments[0])) {
      videoId = segments[1] || '';
    } else {
      videoId = parsed.searchParams.get('v') || '';
    }

    return isValidYouTubeVideoId(videoId) ? videoId : null;
  }

  function extractYouTubeVideoId(url) {
    const parsed = parseHttpUrl(url);
    return extractYouTubeVideoIdFromParsedSource(parsed);
  }

  function extractYouTubeVideoIdFromParsedThumbnail(parsed) {
    if (!parsed || !isTrustedYouTubeThumbnailHost(parsed.hostname)) return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'vi') return null;
    const videoId = segments[1] || '';
    return isValidYouTubeVideoId(videoId) ? videoId : null;
  }

  function extractYouTubeVideoIdFromThumbnail(url) {
    const parsed = parseHttpUrl(url);
    return extractYouTubeVideoIdFromParsedThumbnail(parsed);
  }

  function buildCanonicalYouTubeThumbnailUrl(videoId) {
    if (!isValidYouTubeVideoId(videoId)) return '';
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  function buildCanonicalYouTubeEmbedUrl(videoId) {
    if (!isValidYouTubeVideoId(videoId)) return '';
    return `https://www.youtube.com/embed/${videoId}`;
  }

  function canonicalizeYouTubeSourceUrl(url) {
    const parsed = parseHttpUrl(url);
    if (!parsed) return '';

    const safeUrl = parsed.toString();
    if (!isTrustedYouTubeSourceHost(parsed.hostname)) return safeUrl;

    const videoId = extractYouTubeVideoIdFromParsedSource(parsed);
    return videoId ? buildCanonicalYouTubeEmbedUrl(videoId) : safeUrl;
  }

  function canonicalizeYouTubeThumbnailUrl(url, fallbackSourceUrl) {
    const parsedUrl = parseHttpUrl(url);
    const parsedFallbackSourceUrl = parseHttpUrl(fallbackSourceUrl);
    const safeUrl = parsedUrl ? parsedUrl.toString() : '';

    let videoId = extractYouTubeVideoIdFromParsedThumbnail(parsedUrl);
    if (!videoId) videoId = extractYouTubeVideoIdFromParsedSource(parsedUrl);
    if (!videoId) videoId = extractYouTubeVideoIdFromParsedSource(parsedFallbackSourceUrl);

    if (videoId) {
      return buildCanonicalYouTubeThumbnailUrl(videoId);
    }

    if (safeUrl && !isTrustedYouTubeSourceHost(parsedUrl.hostname) && !isTrustedYouTubeThumbnailHost(parsedUrl.hostname)) {
      return safeUrl;
    }

    return '';
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

  function _normalizeBrowseViewCount(raw) {
    // Strict viewCount normalizer: three-state policy.
    //   valid positive/zero integer (camelCase or snake_case) → preserve
    //   null / missing / invalid → undefined (never synthetic 0)
    var v = raw && (raw.viewCount !== undefined ? raw.viewCount : raw.view_count);
    // Fast-path: null, undefined, empty/whitespace string
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'string') {
      if (!/^(0|[1-9]\d*)$/.test(v)) return undefined;
      var n = Number(v);
      return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
    }
    // Boolean, array, object (including null already caught above)
    if (typeof v !== 'number') return undefined;
    // Number: must be safe integer, non-negative, finite
    if (!Number.isFinite(v)) return undefined;
    if (!Number.isSafeInteger(v)) return undefined;
    if (v < 0) return undefined;
    return v;
  }

  function normalizeBrowseTreeRecord(rawTree) {
    const tree = unwrapTreeRecord(rawTree);
    const rawThumb = tree.representativeThumbnail || tree.representative_thumbnail || tree.thumbnail || '';
    const rawSource = tree.representativeMemorySourceUrl || tree.representative_memory_source_url || tree.sourceUrl || tree.source_url || '';
    
    return {
      id: tree.id || rawTree?.id || null,
      title: tree.title || '',
      visibility: tree.visibility || 'private',
      createdAt: tree.createdAt || tree.created_at || null,
      updatedAt: tree.updatedAt || tree.updated_at || null,
      ownerId: tree.ownerId || tree.owner_id || null,
      representativeThumbnail: canonicalizeYouTubeThumbnailUrl(rawThumb, rawSource),
      memoryCount: Number(tree.memoryCount || tree.memory_count || 0),
      viewCount: _normalizeBrowseViewCount(tree),
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
        viewCount: tree.viewCount,
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
    // Internal helpers exposed for contract tests
    _normalizeBrowseViewCount,
    // Utils
    sanitizeUrl,
    isValidYouTubeVideoId,
    isYouTubeHost,
    isTrustedYouTubeSourceHost,
    isTrustedYouTubeThumbnailHost,
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
