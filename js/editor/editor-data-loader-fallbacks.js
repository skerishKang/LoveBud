// Editor data loader inline fallbacks
// Extracted from js/editor.js to reduce entry file size
// Used when LoveBudEditorDataLoader is not available

(function() {
    function isEditorDebugEnabled() {
        return window.LOVEBUD_DEBUG === true || window.LOVEBUD_EDITOR_DEBUG === true;
    }

    function editorDebugLog() {
        if (!isEditorDebugEnabled() || !window.console || typeof console.log !== 'function') return;
        console.log.apply(console, arguments);
    }

    /**
     * 메모리가 canonical root placeholder인지 판정 (inline fallback).
     */
    function inlineIsCanonicalRootPlaceholder(memory) {
        if (!memory) return false;
        if (memory.id === 'root') return true;
        const parentId = memory.parentId;
        if (parentId === null || parentId === undefined || parentId === '') return true;
        if (typeof parentId === 'string' && parentId === memory.id) return true;
        return false;
    }

    /**
     * 메모리 배열을 current treeId 기준으로 필터링 (inline fallback).
     * LoveBudEditorDataLoader.filterMemoriesForTree와 같은 기준.
     */
    function inlineFilterMemoriesForTree(memories, treeId) {
        if (!Array.isArray(memories)) return [];
        if (!treeId) return memories.slice();

        return memories.filter((m) => {
            if (!m) return false;
            if (inlineIsCanonicalRootPlaceholder(m)) return true;
            const memTreeId = m.treeId || m.tree_id || null;
            if (memTreeId && memTreeId === treeId) return true;
            return false;
        });
    }

    window.LoveBudEditorDataLoaderFallbacks = {
    createInlineNormalizeMemoryFallback: () => (mem) => {
        if (!window.__editorNormalizeWarningShown) {
            console.warn('[editor] LoveBudNormalize not loaded, using local fallback');
            window.__editorNormalizeWarningShown = true;
        }
        if (!mem) return null;

        return {
            id: mem.id,
            treeId: mem.treeId || mem.tree_id || null,
            parentId: mem.parentId ?? mem.parent_id ?? null,
            title: mem.title || '',
            memo: mem.memo || mem.description || '',
            quote: mem.quote || '',
            timestamp: mem.timestamp || '',
            thumbnail: mem.thumbnail || '',
            visibility: mem.visibility || 'public',
            artist: mem.artist || '',
            source: mem.source || '',
            sourceUrl: mem.sourceUrl || mem.source_url || '',
            sourceType: mem.sourceType || mem.source_type || 'youtube',
            emotionTags: mem.emotionTags || mem.emotion_tags || [],
            createdAt: mem.createdAt || mem.created_at || null,
            updatedAt: mem.updatedAt || mem.updated_at || null,
            delay: mem.delay,
            x: mem.x,
            y: mem.y
        };
    },

    createInlineLoadInitialTreeFallback: () => async (options) => {
        const opts = options || {};
        const requestedTreeId = opts.urlTreeId || '';
        const apiClient = opts.apiClient || null;
        const createDefaultTreeTitle = opts.createDefaultTreeTitle || (() => '러브트리');
        const getConfirmedSessionUserFallback = opts.getConfirmedSessionUser || (() => null);

        let tree = null;
        let isNewTree = false;
        let treeLoadStatus = 'not_found';
        let treeLoadErrorMessage = '';
        let authRequired = false;

        if (requestedTreeId) {
            try {
                if (apiClient && apiClient.getTree) {
                    tree = await apiClient.getTree(requestedTreeId);
                    if (tree) {
                        treeLoadStatus = 'loaded';
                        editorDebugLog('[editor] Tree from URL loaded');
                    }
                } else {
                    treeLoadStatus = 'api_unavailable';
                }
            } catch (e) {
                treeLoadStatus = 'error';
                treeLoadErrorMessage = String(e?.message || '');
                console.warn('[editor] Tree from URL load failed:', e.message);
            }

            if (!tree) {
                authRequired =
                    /401|Authentication required|Invalid ID token/i.test(treeLoadErrorMessage) ||
                    (/Access denied/i.test(treeLoadErrorMessage) && !getConfirmedSessionUserFallback());
            }

            return {
                tree,
                isNewTree,
                treeLoadStatus,
                treeLoadErrorMessage,
                authRequired
            };
        }

        try {
            if (apiClient && apiClient.getFirstTree) {
                const apiTree = await apiClient.getFirstTree();
                if (apiTree) {
                    tree = apiTree;
                    treeLoadStatus = 'loaded';
                    editorDebugLog('[editor] API tree loaded');
                } else {
                    editorDebugLog('[editor] No tree found, creating default tree');
                    if (apiClient.createTree) {
                        const newTree = await apiClient.createTree({
                            title: createDefaultTreeTitle(),
                            visibility: 'public'
                        });
                        tree = newTree;
                        isNewTree = true;
                        treeLoadStatus = 'created';
                        editorDebugLog('[editor] Default tree created');
                    }
                }
            }
        } catch (e) {
            treeLoadErrorMessage = String(e?.message || '');
            console.warn('[editor] API tree 로드 실패:', e.message);
            authRequired = /401|Authentication/i.test(treeLoadErrorMessage);
        }

        if (authRequired) {
            return {
                tree: null,
                isNewTree: false,
                treeLoadStatus: 'auth_required',
                treeLoadErrorMessage,
                authRequired: true
            };
        }

        return {
            tree,
            isNewTree,
            treeLoadStatus: tree ? (treeLoadStatus === 'not_found' ? 'loaded' : treeLoadStatus) : 'not_found',
            treeLoadErrorMessage,
            authRequired: false
        };
    },

    createInlineLoadEditorMemoriesFallback: () => async (options) => {
        const opts = options || {};
        const treeId = opts.treeId || null;
        const cache = opts.cache || null;
        const cacheKey = opts.cacheKey || 'memories_default';
        const apiClient = opts.apiClient || null;
        const showToast = opts.showToast || function() {};
        const i18n = opts.i18n || function(key) { return key; };
        const normalizeMemory = opts.normalizeMemory || ((mem) => mem);
        const cacheTtlMs = 2 * 60 * 1000;

        let memories = [];
        const cachedMemories = cache ? cache.get(cacheKey) : null;

        // 1) cache hit: treeId 필터를 거친 cached memories만 사용
        if (cachedMemories && Array.isArray(cachedMemories)) {
            editorDebugLog('[editor] Using cached memories:', cachedMemories.length);
            memories = inlineFilterMemoriesForTree(cachedMemories, treeId);
            window.currentTreeMemories = memories.map(normalizeMemory).filter(Boolean);
        }

        // 2) API 호출. API 응답이 source of truth (빈 배열 포함).
        try {
            if (apiClient && apiClient.getMemoriesByTree) {
                const apiMemories = await apiClient.getMemoriesByTree(treeId);
                if (Array.isArray(apiMemories)) {
                    const normalizedApi = apiMemories.map(normalizeMemory).filter(Boolean);
                    const filteredApi = inlineFilterMemoriesForTree(normalizedApi, treeId);
                    memories = filteredApi;
                    editorDebugLog('[editor] API memories loaded (filtered):', filteredApi.length);
                    if (cache) {
                        if (filteredApi.length === 0) {
                            // API []: cache clear
                            if (typeof cache.delete === 'function') {
                                cache.delete(cacheKey);
                            } else if (typeof cache.set === 'function') {
                                cache.set(cacheKey, [], cacheTtlMs);
                            }
                        } else {
                            cache.set(cacheKey, filteredApi, cacheTtlMs);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[editor] API getMemoriesByTree failed:', e.message);
            if (e.message?.includes('401') || e.message?.includes('403')) {
                showToast(i18n('data_load_fail_demo'), 'warn');
            }
        }

        // 3) 최종 할당. memories는 이미 filter 거침.
        const finalMemories = memories.map(normalizeMemory).filter(Boolean);
        window.currentTreeMemories = finalMemories;

        return {
            memories: finalMemories,
            normalizedMemories: finalMemories,
            cachedMemories
        };
    },

    createInlineCreateInitialMemoryFallback: (options) => () => {
        const opts = options || {};
        const treeMemories = opts.treeMemories || (() => []);
        const findRootMemory = opts.findRootMemory || (() => null);
        const canonicalRootId = opts.canonicalRootId || 'root';
        const treeId = opts.treeId || null;
        const i18n = opts.i18n || ((key) => key);

        const memories = treeMemories();
        const rootMem = findRootMemory(memories);
        if (rootMem) return rootMem;
        if (memories.length > 0) return memories[0];

        const isNewTree = memories.length === 0;

        return {
            id: canonicalRootId,
            treeId: treeId,
            title: i18n('first_memory'),
            memo: i18n('no_memory_yet'),
            timestamp: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
            thumbnail: isNewTree
                ? 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect fill="%23e8f5e9" width="120" height="90"/><text x="60" y="45" text-anchor="middle" fill="%234caf50" font-size="24">🌱</text><text x="60" y="70" text-anchor="middle" fill="%23666" font-size="10">빈 트리</text></svg>'
                : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect fill="%23f5f5f5" width="120" height="90"/><text x="60" y="50" text-anchor="middle" fill="%23999" font-size="12">No Memory</text></svg>',
            emotionTags: [],
            parentId: null,
            isNewTree: isNewTree
        };
    },

    createInlineNextMemoryIdFallback: (options) => () => {
        const opts = options || {};
        const treeMemories = opts.treeMemories || (() => []);

        let max = 0;
        treeMemories().forEach((m) => {
            const match = m.id.match(/^m(\d+)$/);
            if (match) max = Math.max(max, parseInt(match[1], 10));
        });

        return 'm' + (max + 1);
    },

    createInlineRefreshMemoriesFallback: (options) => async () => {
        const opts = options || {};
        const treeId = opts.treeId || null;
        const apiClient = opts.apiClient || null;
        const normalizeMemory = opts.normalizeMemory || ((mem) => mem);
        const onMemoriesUpdated = opts.onMemoriesUpdated || (() => {});

        if (!treeId) return;

        try {
            if (apiClient && apiClient.getMemoriesByTree) {
                const apiMemories = await apiClient.getMemoriesByTree(treeId);
                if (Array.isArray(apiMemories)) {
                    const normalizedApi = apiMemories.map(normalizeMemory).filter(Boolean);
                    const filteredApi = inlineFilterMemoriesForTree(normalizedApi, treeId);
                    window.currentTreeMemories = filteredApi;
                    editorDebugLog('[editor] Memories refreshed (filtered):', filteredApi.length);
                    onMemoriesUpdated(filteredApi);
                }
            }
        } catch (e) {
            console.warn('[editor] Failed to refresh memories:', e.message);
        }
    }
    };
})();
