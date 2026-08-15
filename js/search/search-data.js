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
    /** ── Timed loading state manager for Browse with operation-token ownership ── */
    function createBrowseLoadingManager(loadingStatusEl, getLocale) {
        var timers = {
            indicator: null,
            copy: null,
            longWait: null,
            error: null
        };
        var currentGeneration = 0;
        var i18n = window.t || function (k) { return k; };

        var INDICATOR_DELAY = 500;
        var COPY_THRESHOLD = 1800;
        var LONG_WAIT = 8000;
        var ERROR_ESCALATION = 15000;

        // Cache child references from prebuilt HTML
        var spinnerEl = loadingStatusEl ? loadingStatusEl.querySelector('.lt-spinner') : null;
        var copyEl = loadingStatusEl ? loadingStatusEl.querySelector('.browse-loading-copy') : null;
        var errorHeadingEl = loadingStatusEl ? loadingStatusEl.querySelector('.lt-error-heading') : null;
        var errorBodyEl = loadingStatusEl ? loadingStatusEl.querySelector('.lt-error-body') : null;
        var retryBtnEl = loadingStatusEl ? loadingStatusEl.querySelector('.lt-error-retry-btn') : null;

        function clearAllTimers() {
            Object.keys(timers).forEach(function (key) {
                if (timers[key]) { clearTimeout(timers[key]); timers[key] = null; }
            });
        }

        function isCurrent(gen) {
            return gen === currentGeneration;
        }

        /**
         * Start a new loading operation. Returns an operation token.
         * Only transitions with a matching token can modify DOM/timers.
         * Uses prebuilt child nodes to avoid innerHTML/document.createElement.
         */
        function start() {
            clearAllTimers();
            var gen = ++currentGeneration;

            var el = loadingStatusEl;
            if (!el) return gen;

            // 0-500ms: hidden, hide error nodes
            el.hidden = true;
            el.className = 'lt-loading-inline';
            el.setAttribute('aria-busy', 'true');
            if (spinnerEl) spinnerEl.hidden = false;
            if (copyEl) { copyEl.textContent = ''; copyEl.hidden = false; }
            if (errorHeadingEl) errorHeadingEl.hidden = true;
            if (errorBodyEl) errorBodyEl.hidden = true;
            if (retryBtnEl) retryBtnEl.hidden = true;

            timers.indicator = setTimeout(function () {
                if (!isCurrent(gen)) return;
                // 500-1800ms: visual indicator visible, no explanatory copy
                el.hidden = false;
                if (spinnerEl) spinnerEl.hidden = false;
                if (copyEl) copyEl.textContent = '';

                timers.copy = setTimeout(function () {
                    if (!isCurrent(gen)) return;
                    // 1800-8000ms: show page-specific copy
                    if (copyEl) copyEl.textContent = i18n('search.loadingPublicTrees');

                    timers.longWait = setTimeout(function () {
                        if (!isCurrent(gen)) return;
                        // 8000-15000ms: shared long-wait copy
                        el.className = 'lt-loading-inline lt-long-wait';
                        if (copyEl) copyEl.textContent = i18n('loading.long.wait');
                        el.setAttribute('aria-busy', 'true');

                        timers.error = setTimeout(function () {
                            if (!isCurrent(gen)) return;
                            // 15000ms+: visible error shell with retry
                            // UI escalation only — not an abort
                            showErrorShell(gen);
                        }, ERROR_ESCALATION - LONG_WAIT);
                    }, LONG_WAIT - COPY_THRESHOLD);
                }, COPY_THRESHOLD - INDICATOR_DELAY);
            }, INDICATOR_DELAY);

            return gen;
        }

        function showErrorShell(gen) {
            if (!isCurrent(gen)) return;
            clearAllTimers();
            var el = loadingStatusEl;
            if (!el) return;
            // Use prebuilt child nodes: spinner/copy hidden, error heading/body/retry visible
            el.className = 'lt-loading-inline lt-error-shell';
            el.hidden = false;
            el.setAttribute('aria-busy', 'false');
            if (spinnerEl) spinnerEl.hidden = true;
            if (copyEl) { copyEl.textContent = ''; copyEl.hidden = true; }
            if (errorHeadingEl) { errorHeadingEl.textContent = i18n('loading.error.primary'); errorHeadingEl.hidden = false; }
            if (errorBodyEl) { errorBodyEl.textContent = i18n('loading.error.body'); errorBodyEl.hidden = false; }
            if (retryBtnEl) { retryBtnEl.textContent = i18n('loading.retry.action'); retryBtnEl.hidden = false; }
            // Wire retry button to trigger via CustomEvent
            if (retryBtnEl) {
                retryBtnEl.onclick = function () {
                    var event = new CustomEvent('lovetree-retry', { bubbles: true });
                    el.dispatchEvent(event);
                };
            }
        }

        function resetToHidden() {
            var el = loadingStatusEl;
            if (!el) return;
            el.hidden = true;
            el.className = 'lt-loading-inline';
            el.setAttribute('aria-busy', 'false');
            if (spinnerEl) spinnerEl.hidden = true;
            if (copyEl) { copyEl.textContent = ''; copyEl.hidden = true; }
            if (errorHeadingEl) errorHeadingEl.hidden = true;
            if (errorBodyEl) errorBodyEl.hidden = true;
            if (retryBtnEl) retryBtnEl.hidden = true;
        }

        function ready(gen) {
            if (gen !== undefined && !isCurrent(gen)) return;
            clearAllTimers();
            resetToHidden();
        }

        function error(gen) {
            if (gen !== undefined && !isCurrent(gen)) return;
            clearAllTimers();
            resetToHidden();
        }

        /**
         * Late success after escalation: accepted if same generation.
         * If user retried (new generation), late result is ignored.
         */
        function lateSuccess(gen) {
            if (!isCurrent(gen)) return false;
            clearAllTimers();
            resetToHidden();
            return true;
        }

        function dispose(gen) {
            if (gen !== undefined && !isCurrent(gen)) return;
            clearAllTimers();
            resetToHidden();
            var el = loadingStatusEl;
            if (el) {
                el.removeAttribute('aria-busy');
            }
        }

        return {
            start: start,
            ready: ready,
            error: error,
            lateSuccess: lateSuccess,
            dispose: dispose,
            getGeneration: function () { return currentGeneration; },
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

            // #4055 (Web CTO blocking review): the persisted cached preview
            // must NEVER be returned as user-visible authority. Tree presence in
            // fresh Browse proves only Tree visibility — it does NOT prove the
            // representative Memory embedded in the cached preview is still
            // public (FRESH_TREE_MEMBERSHIP != FRESH_REPRESENTATIVE_MEMORY_AUTHORITY).
            // Every preview open therefore consults current public Memory
            // authority via getPublicTreePreview (fresh /community/memories).
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
                // Start timed loading for initial load, capture generation
                if (browseLoadingManager) {
                    state.currentLoadGen = browseLoadingManager.start();
                }
            } else {
                // Incremental loading: start a new operation token
                // Preserves existing READY cards, selection, preview
                if (browseLoadingManager) {
                    state.currentLoadGen = browseLoadingManager.start();
                }
            }

            // Set loading state for incremental loading
            if (!resetSelection) {
                state.isLoadingMore = true;
                ui.syncControlsFromState();
            }

            // #4055: authority-first Browse. A cached public Tree projection
            // must not be rendered as current public content before the fresh
            // authority confirms it. The cache is used only as a non-sensitive
            // loading hint (suppress the loading status on incremental loads);
            // user-visible Trees always come from the fresh authority response.
            let cachedTrees = null;
            if (cache) {
                cachedTrees = cache.get(cacheKey);
                // On incremental load with cache hit, suppress loading status
                if (!resetSelection && cachedTrees && browseLoadingManager) {
                    browseLoadingManager.ready(state.currentLoadGen);
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
                // #4055 network-failure negative control: after a revocation, a
                // failed fresh-authority fetch must NOT leave a stale cached
                // public Tree on screen or in the cache. The last-known-list
                // fallback is forbidden for visibility-sensitive content — drop
                // the stale projection and the cached entry so neither can be
                // resurrected; render a truthful loading/error/empty shell.
                if (cache && typeof cache.clear === 'function') {
                    cache.clear(cacheKey);
                }
                state.allTrees = [];
                state.isFromCache = false;
                callbacks.renderResults();
            } finally {
                if (isCurrentRequest()) {
                    state.isLoadingMore = false;
                    ui.syncControlsFromState();
                    // On success, mark ready; on error, mark error
                    if (browseLoadingManager) {
                        if (state.loadError) {
                            browseLoadingManager.error(state.currentLoadGen);
                        } else if (state.apiTreesLoaded) {
                            browseLoadingManager.ready(state.currentLoadGen);
                        }
                    }
                } else {
                    // Stale request — not current; do NOT dispose manager
                    // (dispose would affect the current generation)
                }
            }
        }

        /**
         * Dispose the loading manager on pagehide/navigation.
         * Clears all pending timers and resets generation.
         */
        function dispose() {
            if (browseLoadingManager && typeof browseLoadingManager.dispose === 'function') {
                browseLoadingManager.dispose();
            }
        }

        return {
            dedupeTreesById,
            hydrateSelectedTreePreview,
            loadPublicTrees,
            initLoadingManager: initLoadingManager,
            dispose: dispose
        };
    }

    window.LoveBudSearchData = {
        createSearchData: createSearchData,
        createBrowseLoadingManager: createBrowseLoadingManager
    };
})();
