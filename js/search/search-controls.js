(function () {
    function createSearchControls({ refs, state, callbacks, ui }) {
        const { searchInput, tagChips } = refs;
        let searchInputTimer = null;

        function bindSearchInput() {
            if (!searchInput) return;

            searchInput.addEventListener('input', (event) => {
                state.currentQuery = event.target.value.trim();
                if (searchInputTimer) clearTimeout(searchInputTimer);
                searchInputTimer = setTimeout(() => {
                    callbacks.renderResults(false);
                    callbacks.updateUrlState();
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
                    callbacks.renderResults(false);
                    callbacks.updateUrlState();
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
