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

    /**
     * 메모리가 canonical root placeholder인지 판정.
     * (root-like: id='root' 또는 parentId null/undefined/''/==id)
     * legacy root + uuid root placeholder 모두 포함.
     *
     * 참고: filterMemoriesForTree()는 이 helper를 직접 사용하지 않는다.
     * parentId만으로 root로 분류하면, 다른 트리에서 캐시된
     * "parentId: null인 real moment"가 stale로 새 트리에 섞일 수 있다.
     * filterMemoriesForTree는 treeId 매칭을 먼저 본 뒤,
     * 예외적으로 id === 'root' (legacy universal root)만 통과시킨다.
     */
    function isCanonicalRootPlaceholder(memory) {
        if (!memory) return false;
        if (memory.id === 'root') return true;
        const parentId = memory.parentId;
        if (parentId === null || parentId === undefined || parentId === '') return true;
        if (typeof parentId === 'string' && parentId === memory.id) return true;
        return false;
    }

    /**
     * 메모리 배열을 current treeId 기준으로 필터링.
     *
     * 핵심 원칙: treeId가 다르면 root-like보다 먼저 drop한다.
     * 단, id === 'root' (legacy universal root)만 예외로 통과.
     *
     * 규칙:
     * 1) current treeId가 없는 경우 (legacy default) → 모든 메모리 유지
     * 2) memory.treeId가 current treeId와 다른 값 → drop.
     *    예외: memory.id === 'root' (legacy universal root)만 통과.
     * 3) memory.treeId === current treeId → 유지
     * 4) memory.treeId가 없고 current treeId가 있는 경우 →
     *    memory.id === 'root' (legacy universal root)만 통과.
     *    (server-loaded real tree의 메모리는 treeId를 가져야 한다.
     *     parentId: null이라도 treeId가 없는 메모리는 stale로 간주)
     */
    function filterMemoriesForTree(memories, treeId) {
        if (!Array.isArray(memories)) return [];
        if (!treeId) return memories.slice();

        return memories.filter((m) => {
            if (!m) return false;
            const memTreeId = m.treeId || m.tree_id || null;

            if (memTreeId && memTreeId !== treeId) {
                return m.id === 'root';
            }

            if (memTreeId === treeId) return true;

            return m.id === 'root';
        });
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

        // Only fall back to getFirstTree if no specific treeId was requested
        if (!urlTreeId) {
            try {
                if (apiClient && apiClient.getFirstTree) {
                    const apiTree = await apiClient.getFirstTree();
                    if (apiTree) {
                        tree = apiTree;
                        treeLoadStatus = 'loaded';
                    } else if (apiClient.createTree) {
                        const newTree = await apiClient.createTree({
                            title: createDefaultTreeTitle(),
                            visibility: 'public'
                        });
                        tree = newTree;
                        isNewTree = true;
                        treeLoadStatus = 'created';
                    }
                }
            } catch (e) {
                treeLoadErrorMessage = String(e?.message || '');
                console.warn('[editor] API tree load failed:', e.message);
                authRequired = /401|Authentication/i.test(treeLoadErrorMessage);
            }
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

        // 1) cache hit: treeId 필터를 거친 cached memories만 사용.
        //    필터 결과가 empty면 그 자체로 stale 신호 → 빈 트리로 신뢰.
        if (cachedMemories && Array.isArray(cachedMemories)) {
            memories = filterMemoriesForTree(cachedMemories, treeId);
            const normalizedCached = memories.map(normalizeMemory).filter(Boolean);
            window.currentTreeMemories = normalizedCached;
        }

        // 2) API 호출. API 응답이 source of truth (array 자체가 truth).
        //    빈 배열도 valid response로 처리 → cache clear + 빈 트리.
        let apiReturnedArray = false;
        try {
            if (apiClient && apiClient.getMemoriesByTree) {
                const apiMemories = await apiClient.getMemoriesByTree(treeId);
                if (Array.isArray(apiMemories)) {
                    apiReturnedArray = true;
                    const normalizedApi = apiMemories.map(normalizeMemory).filter(Boolean);
                    const filteredApi = filterMemoriesForTree(normalizedApi, treeId);
                    memories = filteredApi;
                    if (cache) {
                        if (filteredApi.length === 0) {
                            // API []: source of truth. stale cached memories를 위해 cache clear.
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

        // 3) 최종 할당. memories는 이미 filterMemoriesForTree + normalize 거침.
        //    API 실패 시 (apiReturnedArray === false) cached memories를 그대로 사용 —
        //    cached는 1단계에서 이미 filterMemoriesForTree를 거쳤으므로 안전.
        const finalMemories = memories.map(normalizeMemory).filter(Boolean);
        window.currentTreeMemories = finalMemories;

        return {
            memories: finalMemories,
            normalizedMemories: finalMemories,
            cachedMemories
        };
    }

    function createCanonicalReread(options) {
        const opts = options || {};
        const treeId = opts.treeId;
        const apiClient = opts.apiClient || null;
        const normalizeMemory = opts.normalizeMemory || createNormalizeMemory();

        return async function canonicalReread(identity) {
            if (!treeId) return { memories: [] };
            if (!apiClient || !apiClient.getMemoriesByTree) return { memories: [] };

            try {
                const apiMemories = await apiClient.getMemoriesByTree(treeId);
                if (Array.isArray(apiMemories)) {
                    const normalizedApi = apiMemories.map(normalizeMemory).filter(Boolean);
                    const filteredApi = filterMemoriesForTree(normalizedApi, treeId);
                    return { memories: filteredApi };
                }
                return { memories: [] };
            } catch (e) {
                console.warn('[editor] Canonical reread failed:', e.message);
                return { memories: [] };
            }
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
                        const normalizedApi = apiMemories.map(normalizeMemory).filter(Boolean);
                        const filteredApi = filterMemoriesForTree(normalizedApi, treeId);
                        window.currentTreeMemories = filteredApi;
                        onMemoriesUpdated(filteredApi);
                    }
                }
            } catch (e) {
                console.warn('[editor] Failed to refresh memories:', e.message);
            }
        };
    }

    window.LoveBudEditorDataLoader = {
        createNormalizeMemory,
        filterMemoriesForTree,
        isCanonicalRootPlaceholder,
        loadInitialEditorTree,
        loadEditorMemories,
        createRefreshMemories,
        createCanonicalReread
    };
})();
