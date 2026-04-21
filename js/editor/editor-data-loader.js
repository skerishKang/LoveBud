(function() {
    function createNormalizeMemory(options) {
        const opts = options || {};
        const sharedNormalize = opts.sharedNormalize || window.LoveBudNormalize?.normalizeMemory;
        let warningShown = false;

        return function normalizeMemory(mem) {
            if (sharedNormalize) {
                return sharedNormalize(mem);
            }

            if (!warningShown) {
                console.warn('[editor] LoveBudNormalize not loaded, using local fallback');
                warningShown = true;
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
        };
    }

    async function loadInitialEditorTree(options) {
        const opts = options || {};
        const urlTreeId = opts.urlTreeId || '';
        const apiClient = opts.apiClient || null;
        const createDefaultTreeTitle = opts.createDefaultTreeTitle || function() { return '러브트리'; };
        const getConfirmedSessionUser = opts.getConfirmedSessionUser || function() { return null; };

        let tree = null;
        let isNewTree = false;
        let treeLoadStatus = 'not_found';
        let treeLoadErrorMessage = '';
        let authRequired = false;

        if (urlTreeId) {
            try {
                if (apiClient && apiClient.getTree) {
                    tree = await apiClient.getTree(urlTreeId);
                    if (tree) {
                        treeLoadStatus = 'loaded';
                        console.log('[editor] Tree from URL loaded:', tree.id);
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
                    (/Access denied/i.test(treeLoadErrorMessage) && !getConfirmedSessionUser());
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
                    console.log('[editor] API tree loaded (getFirstTree)');
                } else if (apiClient.createTree) {
                    console.log('[editor] No tree found, creating default tree...');
                    const newTree = await apiClient.createTree({
                        title: createDefaultTreeTitle(),
                        visibility: 'public'
                    });
                    tree = newTree;
                    isNewTree = true;
                    treeLoadStatus = 'created';
                    console.log('[editor] Default tree created:', newTree);
                }
            }
        } catch (e) {
            treeLoadErrorMessage = String(e?.message || '');
            console.warn('[editor] API tree load failed:', e.message);
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
    }

    async function loadEditorMemories(options) {
        const opts = options || {};
        const treeId = opts.treeId;
        const cache = opts.cache || null;
        const cacheKey = opts.cacheKey || 'memories_default';
        const apiClient = opts.apiClient || null;
        const showToast = opts.showToast || function() {};
        const i18n = opts.i18n || function(key) { return key; };
        const normalizeMemory = opts.normalizeMemory || createNormalizeMemory();
        const cacheTtlMs = typeof opts.cacheTtlMs === 'number' ? opts.cacheTtlMs : 2 * 60 * 1000;

        let memories = [];
        const cachedMemories = cache ? cache.get(cacheKey) : null;

        if (cachedMemories && Array.isArray(cachedMemories)) {
            console.log('[editor] Using cached memories:', cachedMemories.length);
            memories = cachedMemories;
            window.currentTreeMemories = memories.map(normalizeMemory).filter(Boolean);
        }

        try {
            if (apiClient && apiClient.getMemoriesByTree) {
                const apiMemories = await apiClient.getMemoriesByTree(treeId);
                if (Array.isArray(apiMemories)) {
                    memories = apiMemories;
                    console.log('[editor] API memories loaded:', apiMemories.length);

                    if (cache) {
                        cache.set(cacheKey, memories, cacheTtlMs);
                    }
                }
            }
        } catch (e) {
            console.warn('[editor] API getMemoriesByTree failed:', e.message);
            if (e.message?.includes('401') || e.message?.includes('403')) {
                showToast(i18n('data_load_fail_demo'), 'warn');
            }
        }

        const normalizedMemories = memories.map(normalizeMemory).filter(Boolean);
        window.currentTreeMemories = normalizedMemories;

        return {
            memories,
            normalizedMemories,
            cachedMemories
        };
    }

    function createRefreshMemories(options) {
        const opts = options || {};
        const treeId = opts.treeId;
        const apiClient = opts.apiClient || null;
        const normalizeMemory = opts.normalizeMemory || createNormalizeMemory();
        const onMemoriesUpdated = opts.onMemoriesUpdated || function() {};

        return async function refreshMemories() {
            if (!treeId) return;

            try {
                if (apiClient && apiClient.getMemoriesByTree) {
                    const apiMemories = await apiClient.getMemoriesByTree(treeId);
                    if (Array.isArray(apiMemories)) {
                        window.currentTreeMemories = apiMemories.map(normalizeMemory).filter(Boolean);
                        console.log('[editor] Memories refreshed:', window.currentTreeMemories.length);
                        onMemoriesUpdated(window.currentTreeMemories);
                    }
                }
            } catch (e) {
                console.warn('[editor] Failed to refresh memories:', e.message);
            }
        };
    }

    window.LoveBudEditorDataLoader = {
        createNormalizeMemory,
        loadInitialEditorTree,
        loadEditorMemories,
        createRefreshMemories
    };
})();
