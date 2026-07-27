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
    /** ── Timed loading state manager for Browse ── */
    function createBrowseLoadingManager(loadingStatusEl, getLocale) {
        var timers = {
            indicator: null,
            copy: null,
            longWait: null,
            error: null
        };
        var state = 'PENDING';
        var i18n = window.t || function (k) { return k; };

        var INDICATOR_DELAY = 500;
        var COPY_THRESHOLD = 1800;
        var LONG_WAIT = 8000;
        var ERROR_ESCALATION = 15000;

        function clearAllTimers() {
            Object.keys(timers).forEach(function (key) {
                if (timers[key]) { clearTimeout(timers[key]); timers[key] = null; }
            });
        }

        function setStatus(className, text, busy) {
            var el = loadingStatusEl;
            if (!el) return;
            el.className = 'lt-loading-inline';
            if (className) el.classList.add(className);
            el.textContent = text || '';
            el.hidden = !text;
            if (typeof busy === 'boolean') {
                el.setAttribute('aria-busy', String(busy));
            }
        }

        function start() {
            clearAllTimers();
            state = 'LOADING';
            var el = loadingStatusEl;
            if (el) {
                el.setAttribute('aria-busy', 'true');
                el.removeAttribute('hidden');
            }

            timers.indicator = setTimeout(function () {
                setStatus('', i18n('loading.list.load'), true);
                timers.copy = setTimeout(function () {
                    setStatus('', i18n('loading.list.load'), true);
                    timers.longWait = setTimeout(function () {
                        setStatus('lt-long-wait', i18n('loading.long.wait'), true);
                        timers.error = setTimeout(function () {
                            // UI escalation only — not an abort
                            state = 'ERROR_ESCALATED';
                            setStatus('lt-error-shell', '', true);
                        }, ERROR_ESCALATION - LONG_WAIT);
                    }, LONG_WAIT - COPY_THRESHOLD);
                }, COPY_THRESHOLD - INDICATOR_DELAY);
            }, INDICATOR_DELAY);
        }

        function ready() {
            clearAllTimers();
            state = 'READY';
            setStatus('', '', false);
        }

        function error() {
            clearAllTimers();
            state = 'ERROR';
            setStatus('', '', false);
        }

        function escalateError() {
            if (state === 'ERROR_ESCALATED' || state === 'ERROR') return;
            clearAllTimers();
            state = 'ERROR_ESCALATED';
            setStatus('lt-error-shell', '', true);
        }

        function dispose() {
            clearAllTimers();
            state = 'DISPOSED';
            var el = loadingStatusEl;
            if (el) {
                el.hidden = true;
                el.removeAttribute('aria-busy');
                el.textContent = '';
            }
        }

        return {
            start: start,
            ready: ready,
            error: error,
            escalateError: escalateError,
            dispose: dispose,
            getState: function () { return state; },
            INDICATOR_DELAY: INDICATOR_DELAY,
            COPY_THRESHOLD: COPY_THRESHOLD,
            LONG_WAIT: LONG_WAIT,
            ERROR_ESCALATION: ERROR_ESCALATION
        };
    }

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
        var browseLoadingManager = null;

        // ── Initialize the timed loading manager ──
        // Called after DOM is ready from the orchestrator
        function initLoadingManager(loadingStatusEl) {
            if (!loadingStatusEl) return;
            browseLoadingManager = createBrowseLoadingManager(loadingStatusEl, ui.getCurrentLocale);
        }

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
                // Start timed loading for initial load
                if (browseLoadingManager) {
                    browseLoadingManager.start();
                }
            }

            // Set loading state for incremental loading
            if (!resetSelection) {
                state.isLoadingMore = true;
                ui.syncControlsFromState();
            }

            // Serve from cache first (stale-while-revalidate)
            let cachedTrees = null;
            if (cache && !resetSelection && cachedTrees) {
                // On incremental load with cache hit, suppress loading status
                if (browseLoadingManager) browseLoadingManager.ready();
            }
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
                    // On success, mark ready; on error, mark error
                    if (browseLoadingManager) {
                        if (state.loadError) {
                            browseLoadingManager.error();
                        } else if (state.apiTreesLoaded) {
                            browseLoadingManager.ready();
                        }
                    }
                } else {
                    // Stale request — suppress its loading state
                    if (browseLoadingManager && resetSelection) {
                        browseLoadingManager.dispose();
                    }
                }
            }
        }

        return {
            dedupeTreesById,
            hydrateSelectedTreePreview,
            loadPublicTrees,
            initLoadingManager: initLoadingManager
        };
    }

    window.LoveBudSearchData = { createSearchData };
})();
