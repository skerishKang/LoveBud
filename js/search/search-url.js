window.LoveBudSearchURL = {
    isRestoringUrlState: false,
    initialTreeDeepLinkApplied: false,

    readUrlState() {
        const params = new URLSearchParams(window.location.search);
        return {
            query: params.get('q') || '',
            category: params.get('category') || '',
            sort: params.get('sort') || 'latest',
            limit: params.get('limit') || '10',
            tree: params.get('tree') || ''
        };
    },

    updateUrlState() {
        if (this.isRestoringUrlState) return;
        try {
            const State = window.LoveBudSearchState;
            const params = new URLSearchParams();
            if (State.currentQuery) params.set('q', State.currentQuery);
            if (State.currentCategory && State.currentCategory !== '전체') params.set('category', State.currentCategory);
            if (State.currentSort && State.currentSort !== 'latest') params.set('sort', State.currentSort);
            if (State.currentLimit && State.currentLimit !== 10) params.set('limit', String(State.currentLimit));

            const newSearch = params.toString();
            const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;

            if (newUrl !== (window.location.pathname + window.location.search)) {
                history.pushState(null, '', newUrl);
            }
        } catch { /* ignore */ }
    },

    restoreStateFromUrl() {
        // Expose to window for backwards compatibility if needed
        window.readUrlState = () => this.readUrlState();
        window.updateUrlState = () => this.updateUrlState();
        window.restoreStateFromUrl = () => this.restoreStateFromUrl();

        const State = window.LoveBudSearchState;
        const { query, category, sort, limit } = this.readUrlState();
        this.isRestoringUrlState = true;

        if (query) State.currentQuery = query;
        if (category) State.currentCategory = category;
        if (sort === 'latest' || sort === 'popular') State.currentSort = sort;
        if (limit) {
            const parsedLimit = parseInt(limit, 10);
            if (!isNaN(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 60) {
                State.currentLimit = parsedLimit;
            }
        }

        const searchInput = document.getElementById('searchInput');
        const tagChips = document.querySelectorAll('.tag-chip');

        if (query && searchInput) searchInput.value = query;
        if (category) {
            tagChips.forEach(chip => {
                const chipCategory = chip.dataset.category || chip.textContent.trim();
                chip.classList.toggle('active', chipCategory === State.currentCategory);
            });
        }

        if (sort) {
            if (window.LoveBudSearchUI && typeof window.LoveBudSearchUI.syncControlsFromState === 'function') {
                window.LoveBudSearchUI.syncControlsFromState();
            } else {
                const sortBtn = document.querySelector(`[data-browse-sort="${State.currentSort}"]`);
                if (sortBtn) {
                    document.querySelectorAll('[data-browse-sort]').forEach(b => b.classList.remove('active'));
                    sortBtn.classList.add('active');
                }
            }
        }

        this.isRestoringUrlState = false;
    },

    applySelectedTreeFromUrl(selectTreeCallback) {
        if (this.initialTreeDeepLinkApplied) return;

        const state = this.readUrlState();
        if (!state.tree) return;

        const State = window.LoveBudSearchState;
        const targetTree = State.allTrees.find(t => t.id === state.tree) || State.growingTrees.find(t => t.id === state.tree);
        if (!targetTree) return;

        let activeCard = null;
        let selector = '';
        try {
            selector = `.tree-card[data-tree-id="${CSS.escape(state.tree)}"]`;
        } catch (e) {
            selector = `.tree-card[data-tree-id="${state.tree.replace(/"/g, '\\"')}"]`;
        }

        const resultsList = document.getElementById('resultsList');
        const growingList = document.getElementById('growingTreesList');
        const allCardContainers = [resultsList, growingList].filter(Boolean);

        for (const container of allCardContainers) {
            activeCard = container.querySelector(selector);
            if (activeCard) break;
        }

        if (typeof selectTreeCallback === 'function') {
            selectTreeCallback(targetTree, activeCard);
        }
        this.initialTreeDeepLinkApplied = true;
    }
};
