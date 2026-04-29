(function () {
    function createSearchUrlState({ refs, state, callbacks, ui }) {
        const { searchInput, tagChips, resultsList, growingList } = refs;

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

        function updateUrlState() {
            if (state.isRestoringUrlState || !state.urlStateReady) return;
            try {
                const params = new URLSearchParams(window.location.search);
                if (state.currentQuery) params.set('q', state.currentQuery);
                else params.delete('q');
                if (state.currentCategory && state.currentCategory !== '전체') params.set('category', state.currentCategory);
                else params.delete('category');
                if (state.currentSort && state.currentSort !== 'latest') params.set('sort', state.currentSort);
                else params.delete('sort');
                if (state.currentLimit && state.currentLimit !== 10) params.set('limit', String(state.currentLimit));
                else params.delete('limit');
                if (state.selectedTreeId) params.set('tree', state.selectedTreeId);
                const newSearch = params.toString();
                const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
                if (newUrl !== (window.location.pathname + window.location.search)) {
                    history.pushState(null, '', newUrl);
                }
            } catch { /* ignore */ }
        }

        function restoreStateFromUrl() {
            window.readUrlState = readUrlState;
            window.updateUrlState = updateUrlState;
            window.restoreStateFromUrl = restoreStateFromUrl;
            const { query, category, sort, limit } = readUrlState();
            state.isRestoringUrlState = true;
            if (query) state.currentQuery = query;
            if (category) state.currentCategory = category;
            if (sort === 'latest' || sort === 'popular') state.currentSort = sort;
            if (limit) {
                const parsedLimit = parseInt(limit, 10);
                if (!isNaN(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 60) {
                    state.currentLimit = parsedLimit;
                }
            }
            if (query && searchInput) searchInput.value = query;
            if (category) {
                tagChips.forEach(chip => {
                    const chipCategory = chip.dataset.category || chip.textContent.trim();
                    chip.classList.toggle('active', chipCategory === state.currentCategory);
                });
            }
            if (sort) {
                ui.syncControlsFromState();
            }
            state.isRestoringUrlState = false;
        }

        function applySelectedTreeFromUrl() {
            if (state.initialTreeDeepLinkApplied) return;
            const urlState = readUrlState();
            if (!urlState.tree) return;

            const targetTree = state.allTrees.find(t => t.id === urlState.tree) || state.growingTrees.find(t => t.id === urlState.tree);
            if (!targetTree) return;

            let activeCard = null;
            let selector = '';
            try {
                selector = `.tree-card[data-tree-id="${CSS.escape(urlState.tree)}"]`;
            } catch (e) {
                selector = `.tree-card[data-tree-id="${urlState.tree.replace(/"/g, '\\"')}"]`;
            }

            const allCardContainers = [resultsList, growingList].filter(Boolean);
            for (const container of allCardContainers) {
                activeCard = container.querySelector(selector);
                if (activeCard) break;
            }

            callbacks.selectTree(targetTree, activeCard);
            state.initialTreeDeepLinkApplied = true;
        }

        return {
            readUrlState,
            updateUrlState,
            restoreStateFromUrl,
            applySelectedTreeFromUrl
        };
    }

    window.LoveBudSearchUrlState = { createSearchUrlState };
})();
