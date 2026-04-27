(function () {
    function createDetailLoader({ refs, hrefs, tText, sortTreeMemories, inferTreeContext, resolveTreeMomentCount, getConnectedFlowMoments, renderMemoryBase, renderTreeContext, renderConnectedFragments, renderMissingMemoryState, applyViewingPageCopy }) {
        const { backButton } = refs;
        const { searchHref, myTreesHref, buildPageHref } = hrefs;

        const configureBackButton = (sourceContext, treeId) => {
            if (!backButton) return;
            const backConfig = {
                browse: { label: tText('back_to_browse_soft', '둘러보기로 돌아가기'), url: searchHref },
                'my-trees': { label: tText('back_to_my_trees_soft', '내 트리로 돌아가기'), url: myTreesHref },
                editor: { label: tText('back_to_editor_soft', '편집 화면으로 돌아가기'), url: buildPageHref('editor', treeId ? { treeId } : {}) }
            };
            const config = backConfig[sourceContext] || backConfig.browse;
            const isAnchorButton = backButton.tagName === 'A';

            backButton.innerHTML = `<span class="material-symbols-outlined">arrow_back</span><span>${config.label}</span>`;
            backButton.setAttribute('aria-label', config.label);
            backButton.dataset.backUrl = config.url;

            if (isAnchorButton) {
                backButton.setAttribute('href', config.url);
                return;
            }

            backButton.type = 'button';
            if (!backButton.__detailBackHandler) {
                backButton.__detailBackHandler = (event) => {
                    event.preventDefault();
                    const url = backButton.dataset.backUrl || searchHref;
                    window.location.assign(url);
                };
                backButton.addEventListener('click', backButton.__detailBackHandler);
            }
        };

        const loadCurrentDetail = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const memoryId = urlParams.get('id');
            if (!memoryId) {
                window.location.href = searchHref;
                return;
            }

            const fromParam = urlParams.get('from');
            const sourceContext = ['browse', 'my-trees', 'editor'].includes(fromParam) ? fromParam : 'browse';
            const requestedTreeId = urlParams.get('tree');
            configureBackButton(sourceContext, requestedTreeId);

            const cache = window.LoveBudCache;
            const MEMORY_CACHE_KEY = 'memory_' + memoryId;
            const TREE_CACHE_KEY = (tid) => 'tree_' + tid;
            const MEMORIES_CACHE_KEY = (tid) => 'memories_' + tid;

            let memory = null;
            const cachedMemory = cache ? cache.get(MEMORY_CACHE_KEY) : null;
            if (cachedMemory) memory = cachedMemory;

            const normalize = window.LoveBudNormalize?.normalizeMemory || ((m) => m);
            const findPublicMemoryInTree = async () => {
                if (!requestedTreeId || !window.apiClient || !window.apiClient.getCommunityMemories) return null;
                const publicMemories = await window.apiClient.getCommunityMemories({ treeId: requestedTreeId, limit: 100 });
                if (!Array.isArray(publicMemories)) return null;
                return publicMemories
                    .map(item => normalize(item))
                    .find(item => item && item.id === memoryId) || null;
            };

            try {
                if (window.apiClient && window.apiClient.getMemory) {
                    const apiMemory = await window.apiClient.getMemory(memoryId);
                    if (apiMemory) {
                        const normalizedMemory = normalize(apiMemory);
                        if (cache) cache.set(MEMORY_CACHE_KEY, normalizedMemory, 3 * 60 * 1000);
                        if (JSON.stringify(memory) !== JSON.stringify(normalizedMemory)) memory = normalizedMemory;
                    }
                }
            } catch (e) {
                if (!memory && typeof getMemory === 'function') memory = normalize(getMemory(memoryId));
            }

            if (!memory && sourceContext === 'browse') {
                try {
                    const publicMemory = await findPublicMemoryInTree();
                    if (publicMemory) {
                        memory = publicMemory;
                        if (cache) cache.set(MEMORY_CACHE_KEY, publicMemory, 3 * 60 * 1000);
                    }
                } catch (e) {
                    console.warn('[LoveBudDetail] public browse memory fallback failed', e);
                }
            }

            if (!memory) {
                renderMissingMemoryState();
                return;
            }

            const canonicalTreeId = memory.treeId || requestedTreeId || null;
            const hasTreeContext = !!canonicalTreeId;
            let degradedReason = null;
            if (!canonicalTreeId) degradedReason = 'missing-tree-id';

            let tree = hasTreeContext && cache ? cache.get(TREE_CACHE_KEY(canonicalTreeId)) : null;
            let memories = hasTreeContext && cache ? cache.get(MEMORIES_CACHE_KEY(canonicalTreeId)) : null;
            let treeFetchState = tree ? 'cache' : 'idle';
            let memoriesFetchState = Array.isArray(memories) ? 'cache' : 'idle';
            const loadPromises = [];

            if (hasTreeContext) {
                if (!tree && window.apiClient && window.apiClient.getTree) {
                    treeFetchState = 'loading';
                    loadPromises.push(window.apiClient.getTree(canonicalTreeId)
                        .then(apiTree => {
                            if (apiTree) {
                                tree = apiTree;
                                treeFetchState = 'loaded';
                                if (cache) cache.set(TREE_CACHE_KEY(canonicalTreeId), apiTree, 5 * 60 * 1000);
                            } else {
                                treeFetchState = 'empty';
                            }
                        })
                        .catch(() => {
                            treeFetchState = 'failed';
                        }));
                }

                if (!Array.isArray(memories) && window.apiClient && window.apiClient.getMemoriesByTree) {
                    const loadTreeMemories = sourceContext === 'browse' && window.apiClient.getCommunityMemories
                        ? () => window.apiClient.getCommunityMemories({ treeId: canonicalTreeId, limit: 100 })
                        : () => window.apiClient.getMemoriesByTree(canonicalTreeId);
                    memoriesFetchState = 'loading';
                    loadPromises.push(loadTreeMemories()
                        .then(apiMemories => {
                            if (Array.isArray(apiMemories)) {
                                memories = apiMemories;
                                memoriesFetchState = 'loaded';
                                if (cache) cache.set(MEMORIES_CACHE_KEY(canonicalTreeId), apiMemories, 3 * 60 * 1000);
                            } else {
                                memories = [];
                                memoriesFetchState = 'empty';
                            }
                        })
                        .catch(() => {
                            memories = [];
                            memoriesFetchState = 'failed';
                        }));
                }

                if (loadPromises.length > 0) await Promise.all(loadPromises);

                if (!Array.isArray(memories)) memories = [];
            } else {
                tree = null;
                memories = [];
            }

            const mergedMemories = sortTreeMemories(memories, memory);
            const displayTree = tree || inferTreeContext({ treeId: canonicalTreeId, currentMemory: memory, mergedMemories });
            const treeMomentCount = resolveTreeMomentCount({ tree: displayTree, memories: mergedMemories, currentMemory: memory });
            const connectedFlowMoments = getConnectedFlowMoments({ memory, memories: mergedMemories });

            if (hasTreeContext) {
                if (treeFetchState === 'failed' && memoriesFetchState === 'failed') {
                    degradedReason = 'tree-and-memories-load-failed';
                } else if (memoriesFetchState === 'failed') {
                    degradedReason = 'memories-load-failed';
                } else if (treeFetchState === 'failed' || !String(displayTree?.title || '').trim()) {
                    degradedReason = 'tree-load-partial';
                }
            }

            renderMemoryBase(memory);
            renderTreeContext({ hasTreeContext, tree: displayTree, memories: mergedMemories, sourceContext, degradedReason, currentMemory: memory });
            renderConnectedFragments({ memory, memories: mergedMemories, treeId: canonicalTreeId, sourceContext, degradedReason, treeMomentCount });

            const safeTitle = memory.title || tText('tree_context_moment', '순간 상세');
            const treeTitle = String(displayTree?.title || '').trim() || tText('lovetree_brand', '러브트리');
            const brandTitle = tText('lovetree_brand', '러브트리');
            document.title = (hasTreeContext && treeMomentCount > 0)
                ? `${safeTitle} | ${treeTitle} — ${brandTitle}`
                : `${safeTitle} — ${brandTitle}`;

            applyViewingPageCopy({
                sourceContext,
                treeTitle: String(displayTree?.title || '').trim(),
                memoryTitleText: memory.title,
                treeMomentCount,
                connectedCount: connectedFlowMoments.length,
                memory,
                degradedReason
            });

            configureBackButton(sourceContext, canonicalTreeId);
        };

        return {
            configureBackButton,
            loadCurrentDetail
        };
    }

    window.LoveBudDetailLoader = { createDetailLoader };
})();
