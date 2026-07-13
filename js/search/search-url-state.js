(function () {
    const DEFAULT_CATEGORY = '전체';
    const DEFAULT_SORT = 'latest';
    const DEFAULT_LIMIT = 6;
    const MAX_LIMIT = 60;

    function createSearchUrlState({ refs, state, ui }) {
        const { searchInput, tagChips } = refs;

        function readUrlState() {
            try {
                const params = new URLSearchParams(window.location.search);
                return {
                    query: params.get('q') || '',
                    category: params.get('category') || '',
                    sort: params.get('sort') || '',
                    limit: params.get('limit') || '',
                    tree: params.get('tree') || ''
                };
            } catch {
                return { query: '', category: '', sort: '', limit: '', tree: '' };
            }
        }

        /**
         * Write current Browse filter/sort/selection to the URL.
         * @param {{ historyMode?: 'push'|'replace'|'none' }} [options]
         */
        function writeUrlState(options) {
            const historyMode = options && options.historyMode ? options.historyMode : 'push';
            if (historyMode === 'none') return;
            if (state.isRestoringUrlState || !state.urlStateReady) return;

            try {
                const params = new URLSearchParams(window.location.search);

                if (state.currentQuery) params.set('q', state.currentQuery);
                else params.delete('q');

                if (state.currentCategory && state.currentCategory !== DEFAULT_CATEGORY) {
                    params.set('category', state.currentCategory);
                } else {
                    params.delete('category');
                }

                if (state.currentSort && state.currentSort !== DEFAULT_SORT) {
                    params.set('sort', state.currentSort);
                } else {
                    params.delete('sort');
                }

                if (state.currentLimit && state.currentLimit !== DEFAULT_LIMIT) {
                    params.set('limit', String(state.currentLimit));
                } else {
                    params.delete('limit');
                }

                // Selected tree deep-link / selection sync.
                if (state.selectedTreeId) params.set('tree', String(state.selectedTreeId));
                else params.delete('tree');

                const newSearch = params.toString();
                const newUrl = newSearch
                    ? `${window.location.pathname}?${newSearch}`
                    : window.location.pathname;

                const currentUrl = window.location.pathname + window.location.search;
                if (newUrl === currentUrl) return;

                if (historyMode === 'replace' && typeof history.replaceState === 'function') {
                    history.replaceState(null, '', newUrl);
                } else if (typeof history.pushState === 'function') {
                    history.pushState(null, '', newUrl);
                }
            } catch { /* ignore URL sync failures */ }
        }

        function restoreStateFromUrl() {
            window.readUrlState = readUrlState;
            window.updateUrlState = writeUrlState;
            window.restoreStateFromUrl = restoreStateFromUrl;

            const { query, category, sort, limit } = readUrlState();
            state.isRestoringUrlState = true;

            state.currentQuery = query || '';
            if (category) state.currentCategory = category;
            else state.currentCategory = DEFAULT_CATEGORY;

            if (sort === 'latest' || sort === 'popular') {
                state.currentSort = sort;
            } else {
                state.currentSort = DEFAULT_SORT;
            }

            if (limit) {
                const parsedLimit = parseInt(limit, 10);
                if (!Number.isNaN(parsedLimit) && parsedLimit >= 1 && parsedLimit <= MAX_LIMIT) {
                    state.currentLimit = parsedLimit;
                } else {
                    state.currentLimit = DEFAULT_LIMIT;
                }
            } else {
                state.currentLimit = DEFAULT_LIMIT;
            }

            if (searchInput) searchInput.value = state.currentQuery;

            if (tagChips) {
                tagChips.forEach(chip => {
                    const chipCategory = chip.dataset.category || chip.textContent.trim();
                    chip.classList.toggle('active', chipCategory === state.currentCategory);
                });
            }

            if (typeof ui?.syncControlsFromState === 'function') {
                ui.syncControlsFromState();
            }

            state.isRestoringUrlState = false;
        }

        return {
            readUrlState,
            updateUrlState: writeUrlState,
            restoreStateFromUrl
        };
    }

    window.LoveBudSearchUrlState = { createSearchUrlState };
})();
