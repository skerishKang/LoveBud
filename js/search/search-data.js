/**
 * LoveBud Search Data Loading Module
 * v20260616-2539-1
 *
 * Extracted from js/search.js (orchestrator).
 * Owns: loadPublicTrees, hydrateSelectedTreePreview
 *
 * Contract:
 * - window.apiClient.getPublicTrees / getPublicTreePreview
 * - window.LoveBudCache (optional)
 *
 * None of the above contracts are modified here.
 * CSS, HTML, preview renderer, card renderer, url-state are untouched.
 */
(function () {
    function dedupeTreesById(trees) {
        if (!Array.isArray(trees)) return [];

        const seenIds = new Set();
        return trees.filter((tree) => {
            const rawId = tree?.id ?? tree?.treeId ?? tree?.tree_id;
            if (rawId === null || rawId === undefined || rawId === '') {
                return true;
            }

            const key = String(rawId);
            if (seenIds.has(key)) {
                return false;
            }

            seenIds.add(key);
            return true;
        });
    }

    function createSearchData({ refs, state, previewCacheApi, ui, CardRenderer, PreviewRenderer, callbacks, cache, PUBLIC_TREES_CACHE_KEY, PREVIEW_CACHE_TTL_MS, getPreviewCacheKey }) {
        const pendingPreviewHydrations = new Map();

        function getPreviewTreeId(tree) {
            const rawId = tree?.id ?? tree?.treeId ?? tree?.tree_id;
            return rawId === null || rawId === undefined || rawId === '' ? '' : String(rawId);
        }

        async function getHydratedTreePreview(tree) {
            const treeId = getPreviewTreeId(tree);
            if (!treeId) return null;

            const cachedPreview = previewCacheApi.readPreviewCache(treeId);
            if (cachedPreview) {
                return cachedPreview;
            }

            if (pendingPreviewHydrations.has(treeId)) {
                return pendingPreviewHydrations.get(treeId);
            }

            const pendingPreview = window.apiClient.getPublicTreePreview(tree)
                .then((hydratedTree) => {
                    previewCacheApi.writePreviewCache(treeId, hydratedTree);
                    previewCacheApi.mergeHydratedTree(hydratedTree);
                    return hydratedTree;
                })
                .finally(() => {
                    pendingPreviewHydrations.delete(treeId);
                });

            pendingPreviewHydrations.set(treeId, pendingPreview);
            return pendingPreview;
        }

        // ── Hydrate selected tree preview ──────────────────────────────────────
        async function hydrateSelectedTreePreview(tree) {
            if (!tree || !tree.id) return;
            const requestId = ++state.currentPreviewRequestId;
            ui.renderPreviewLoadingState(tree);

            try {
                const hydratedTree = await getHydratedTreePreview(tree);
                if (!hydratedTree) return;

                if (requestId !== state.currentPreviewRequestId || state.selectedTreeId !== tree.id) {
                    return;
                }
                 PreviewRenderer.updatePreview(hydratedTree);
                 ui.syncPreviewVisibility();
                 callbacks.renderResults(false);
            } catch (error) {
                console.warn('[search/data] preview hydration failed:', error.message);
                if (requestId !== state.currentPreviewRequestId || state.selectedTreeId !== tree.id) {
                    return;
                }
                ui.clearSelectedPreview({ preserveOpenState: false });
            }
        }

        // ── Load public trees (main browse) ────────────────────────────────────
        async function loadPublicTrees(options = {}) {
            const { resetSelection = false } = options;

            // Prevent duplicate concurrent requests
            if (state.isLoadingMore && !resetSelection) {
                return;
            }

            const cacheKey = `${PUBLIC_TREES_CACHE_KEY}_${state.currentSort}_${state.currentLimit}`;
            const requestId = (state.currentPublicTreeRequestId || 0) + 1;
            const requestSort = state.currentSort;
            const requestLimit = state.currentLimit;
            state.currentPublicTreeRequestId = requestId;
            const isCurrentRequest = () => state.currentPublicTreeRequestId === requestId
                && state.currentSort === requestSort
                && state.currentLimit === requestLimit;

            ui.syncBrowseHead();

            if (resetSelection) {
                ui.clearSelectedPreview();
            }

            // Set loading state for incremental loading
            if (!resetSelection) {
                state.isLoadingMore = true;
                ui.syncControlsFromState();
            }

            // Serve from cache first (stale-while-revalidate)
            let cachedTrees = null;
            if (cache) {
                cachedTrees = cache.get(cacheKey);
                if (cachedTrees && Array.isArray(cachedTrees) && cachedTrees.length > 0) {
                    state.allTrees = dedupeTreesById(cachedTrees);
                    state.isFromCache = true;
                    callbacks.renderResults();
                }
            }

            try {
                if (window.apiClient && window.apiClient.getPublicTrees) {
                    const apiTrees = await window.apiClient.getPublicTrees({
                        view: 'summary',
                        sort: state.currentSort,
                        limit: state.currentLimit
                    });
                    if (!Array.isArray(apiTrees)) {
                        throw new Error(
                            ui.getCurrentLocale() === 'en'
                                ? 'Invalid API response format'
                                : 'API 응답 형식 오류'
                        );
                    }
                    if (!isCurrentRequest()) {
                        return;
                    }
                    const uniqueApiTrees = dedupeTreesById(apiTrees);

                    if (cache) {
                        cache.set(cacheKey, uniqueApiTrees, 5 * 60 * 1000);
                    }
                    if (!previewCacheApi.areTreesEffectivelySame(state.allTrees, uniqueApiTrees)) {
                        state.allTrees = uniqueApiTrees;
                    }
                    state.loadError = null;
                    state.apiTreesLoaded = true;
                    state.hasMoreTrees = apiTrees.length >= requestLimit && requestLimit < 60;
                    callbacks.renderResults();
                } else {
                    throw new Error(
                        ui.getCurrentLocale() === 'en'
                            ? 'Tree API unavailable'
                            : 'tree API 사용 불가'
                    );
                }
            } catch (error) {
                if (!isCurrentRequest()) {
                    return;
                }
                state.loadError = error;
                console.warn('[search/data] API 로드 실패:', error.message);
                if (!state.allTrees || state.allTrees.length === 0) {
                    state.allTrees = [];
                }
                callbacks.renderResults();
            } finally {
                if (isCurrentRequest()) {
                    state.isLoadingMore = false;
                    ui.syncControlsFromState();
                }
            }
        }

        return {
            dedupeTreesById,
            hydrateSelectedTreePreview,
            loadPublicTrees
        };
    }

    window.LoveBudSearchData = { createSearchData };
})();
