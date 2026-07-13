(function () {
    function createSearchControls({ refs, state, callbacks, ui }) {
        const { searchInput, tagChips } = refs;
        let searchInputTimer = null;
        const DEFAULT_LIMIT = 6;

        function resetPaginationState() {
            state.currentLimit = DEFAULT_LIMIT;
            state.hasMoreTrees = true;
        }

        function bindSearchInput() {
            if (!searchInput) return;

            searchInput.addEventListener('input', (event) => {
                state.currentQuery = event.target.value.trim();
                if (searchInputTimer) clearTimeout(searchInputTimer);
                searchInputTimer = setTimeout(() => {
                    resetPaginationState();
                    // Reconcile selection against the new filtered set (clear stale
                    // preview/URL when the selected tree drops out of results).
                    callbacks.renderResults(true);
                    callbacks.updateUrlState({ historyMode: 'replace' });
                    ui?.syncControlsFromState?.();
                }, 180);
            });
        }

        function bindCategoryChips() {
            if (!tagChips) return;

            tagChips.forEach(chip => {
                chip.addEventListener('click', () => {
                    tagChips.forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    state.currentCategory = chip.dataset.category || chip.textContent.trim();
                    resetPaginationState();
                    // Same reconciliation as query input: drop filtered-out selection.
                    callbacks.renderResults(true);
                    callbacks.updateUrlState({ historyMode: 'replace' });
                    ui?.syncControlsFromState?.();
                });
            });
        }

        function bindSortAndLimitControls() {
            if (typeof ui?.ensureBrowseControls === 'function') {
                ui.ensureBrowseControls();
            }
        }

        function syncControlsFromState() {
            if (searchInput) searchInput.value = state.currentQuery || '';

            if (tagChips) {
                tagChips.forEach(chip => {
                    const chipCategory = chip.dataset.category || chip.textContent.trim();
                    chip.classList.toggle('active', chipCategory === state.currentCategory);
                });
            }

            if (typeof ui?.syncControlsFromState === 'function') {
                ui.syncControlsFromState();
            }
        }

        function bind() {
            bindSortAndLimitControls();
            bindSearchInput();
            bindCategoryChips();
            syncControlsFromState();
        }

        return {
            bind,
            syncControlsFromState
        };
    }

    window.LoveBudSearchControls = { createSearchControls };
})();
