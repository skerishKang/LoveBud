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

        function isCurrent(gen) {
            return gen === currentGeneration;
        }

        /**
         * Start a new loading operation. Returns an operation token.
         * Only transitions with a matching token can modify DOM/timers.
         */
        function start() {
            clearAllTimers();
            var gen = ++currentGeneration;

            var el = loadingStatusEl;
            if (!el) return gen;

            // 0-500ms: hidden
            el.hidden = true;
            el.setAttribute('aria-busy', 'true');

            timers.indicator = setTimeout(function () {
                if (!isCurrent(gen)) return;
                // 500-1800ms: visual indicator visible, no explanatory copy
                el.className = 'lt-loading-inline';
                el.hidden = false;

                timers.copy = setTimeout(function () {
                    if (!isCurrent(gen)) return;
                    // 1800-8000ms: show page-specific copy
                    el.textContent = i18n('search.loadingPublicTrees');

                    timers.longWait = setTimeout(function () {
                        if (!isCurrent(gen)) return;
                        // 8000-15000ms: shared long-wait copy
                        setStatus('lt-long-wait', i18n('loading.long.wait'), true);

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
            // Visible error shell with heading, body, and retry button
            el.className = 'lt-loading-inline lt-error-shell';
            el.hidden = false;
            // Use safe child nodes - build with DOM methods, not innerHTML
            el.textContent = '';
            var heading = document.createElement('p');
            heading.className = 'lt-error-heading';
            heading.textContent = i18n('loading.error.primary');
            var body = document.createElement('p');
            body.className = 'lt-error-body';
            body.textContent = i18n('loading.error.body');
            var retryBtn = document.createElement('button');
            retryBtn.className = 'lt-retry-btn lt-error-retry-btn';
            retryBtn.textContent = i18n('loading.retry.action');
            el.appendChild(heading);
            el.appendChild(body);
            el.appendChild(retryBtn);
            // Wire retry button to trigger via CustomEvent
            retryBtn.onclick = function () {
                var event = new CustomEvent('lovetree-retry', { bubbles: true });
                el.dispatchEvent(event);
            };
        }

        function ready(gen) {
            if (gen !== undefined && !isCurrent(gen)) return;
            clearAllTimers();
            setStatus('', '', false);
        }

        function error(gen) {
            if (gen !== undefined && !isCurrent(gen)) return;
            clearAllTimers();
            setStatus('', '', false);
        }

        /**
         * Late success after escalation: accepted if same generation.
         * If user retried (new generation), late result is ignored.
         */
        function lateSuccess(gen) {
            if (!isCurrent(gen)) return false;
            clearAllTimers();
            setStatus('', '', false);
            return true;
        }

        function dispose(gen) {
            if (gen !== undefined && !isCurrent(gen)) return;
            clearAllTimers();
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

            // Serve from cache first (stale-while-revalidate)
            let cachedTrees = null;
            if (cache) {
                cachedTrees = cache.get(cacheKey);
                // On incremental load with cache hit, suppress loading status
                if (!resetSelection && cachedTrees && browseLoadingManager) {
                    browseLoadingManager.ready(state.currentLoadGen);
                }
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
