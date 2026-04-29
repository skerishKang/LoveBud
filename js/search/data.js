/**
 * LoveBud Search Data Loading Module
 * v20260429-1
 *
 * Extracted from js/search.js (orchestrator).
 * Owns: loadPublicTrees, loadGrowingTrees, hydrateSelectedTreePreview
 *
 * Contract:
 * - window.apiClient.getPublicTrees / getPublicTreePreview
 * - window.LoveTreeBaseApiFetch.apiFetch
 * - window.LoveTreePublicTreeAdapter.buildPublicTreeSummaryModels
 * - window.LoveBudCache (optional)
 *
 * None of the above contracts are modified here.
 * CSS, HTML, preview renderer, card renderer, url-state are untouched.
 */
(function () {
    function createSearchData({ refs, state, previewCacheApi, ui, CardRenderer, PreviewRenderer, callbacks, cache, PUBLIC_TREES_CACHE_KEY, PREVIEW_CACHE_TTL_MS, getPreviewCacheKey }) {

        // ── Hydrate selected tree preview ──────────────────────────────────────
        async function hydrateSelectedTreePreview(tree) {
            if (!tree || !tree.id) return;
            const requestId = ++state.currentPreviewRequestId;
            ui.renderPreviewLoadingState(tree);

            try {
                const cachedPreview = previewCacheApi.readPreviewCache(tree.id);
                const hydratedTree = cachedPreview || await window.apiClient.getPublicTreePreview(tree);

                previewCacheApi.writePreviewCache(tree.id, hydratedTree);
                previewCacheApi.mergeHydratedTree(hydratedTree);

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
            const cacheKey = `${PUBLIC_TREES_CACHE_KEY}_${state.currentSort}_${state.currentLimit}`;

            ui.syncBrowseHead();

            if (resetSelection) {
                ui.clearSelectedPreview();
            }

            // Serve from cache first (stale-while-revalidate)
            let cachedTrees = null;
            if (cache) {
                cachedTrees = cache.get(cacheKey);
                if (cachedTrees && Array.isArray(cachedTrees) && cachedTrees.length > 0) {
                    state.allTrees = cachedTrees;
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

                    if (cache) {
                        cache.set(cacheKey, apiTrees, 5 * 60 * 1000);
                    }
                    if (!previewCacheApi.areTreesEffectivelySame(state.allTrees, apiTrees)) {
                        state.allTrees = apiTrees;
                    }
                    state.loadError = null;
                    state.apiTreesLoaded = true;
                    callbacks.renderResults();
                } else {
                    throw new Error(
                        ui.getCurrentLocale() === 'en'
                            ? 'Tree API unavailable'
                            : 'tree API 사용 불가'
                    );
                }
            } catch (error) {
                state.loadError = error;
                console.warn('[search/data] API 로드 실패:', error.message);
                if (!state.allTrees || state.allTrees.length === 0) {
                    state.allTrees = [];
                }
                callbacks.renderResults();
            }
        }

        // ── Load growing trees (secondary section) ─────────────────────────────
        async function loadGrowingTrees() {
            if (!window.LoveTreeBaseApiFetch || typeof window.LoveTreeBaseApiFetch.apiFetch !== 'function') return;

            try {
                const apiResponse = await window.LoveTreeBaseApiFetch.apiFetch('/community/growing-trees?limit=3');
                const rawTrees = Array.isArray(apiResponse)
                    ? apiResponse
                    : (apiResponse?.data || []);
                const baseModels = window.LoveTreePublicTreeAdapter.buildPublicTreeSummaryModels(rawTrees);
                state.growingTrees = baseModels.map((tree, index) => {
                    const raw = rawTrees[index]?.data || rawTrees[index] || {};
                    const rawEmotionTags = Array.isArray(raw.emotionTags)
                        ? raw.emotionTags
                        : (Array.isArray(raw.emotion_tags) ? raw.emotion_tags : []);
                    return {
                        ...tree,
                        emotionTags: rawEmotionTags.filter(Boolean).slice(0, 3),
                        timeRange: raw.timeRange || raw.time_range || tree.timeRange
                    };
                });

                callbacks.renderGrowingResults();
            } catch (error) {
                console.warn('[search/data] growing trees load failed:', error.message);
                if (refs.growingSection) refs.growingSection.style.display = 'none';
            }
        }

        return {
            hydrateSelectedTreePreview,
            loadPublicTrees,
            loadGrowingTrees
        };
    }

    window.LoveBudSearchData = { createSearchData };
})();
