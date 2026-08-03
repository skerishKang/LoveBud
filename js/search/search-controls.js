(function () {
    function createSearchControls({ refs, state, callbacks, ui }) {
        const { searchInput, tagChips } = refs;
        let searchInputTimer = null;
        const DEFAULT_LIMIT = 6;

        function resetPaginationState() {
            state.currentLimit = DEFAULT_LIMIT;
            state.hasMoreTrees = true;
        }

        function getChipCategory(chip) {
            return chip.dataset.category || chip.textContent.trim();
        }

        /**
         * Single authority for chip selection state (roving radio group):
         * exactly one chip carries .active + aria-checked="true" + tabindex="0",
         * every other chip is inactive with aria-checked="false" + tabindex="-1".
         *
         * Unknown/malformed categories fail closed to the canonical first chip:
         * when no chip matches state.currentCategory, the state is corrected to
         * the first chip's category and { didFallback: true } is returned so the
         * class-mutation observer can issue a bounded render/URL reconcile.
         */
        function syncCategoryChipSemantics() {
            if (!tagChips) return { activeChip: null, didFallback: false };

            let activeChip = null;
            for (const chip of tagChips) {
                if (getChipCategory(chip) === state.currentCategory) {
                    activeChip = chip;
                    break;
                }
            }

            let didFallback = false;
            if (!activeChip && tagChips.length > 0) {
                activeChip = tagChips[0];
                state.currentCategory = getChipCategory(activeChip);
                didFallback = true;
            }

            tagChips.forEach(chip => {
                const isActive = chip === activeChip;
                chip.classList.toggle('active', isActive);
                chip.setAttribute('aria-checked', isActive ? 'true' : 'false');
                chip.setAttribute('tabindex', isActive ? '0' : '-1');
            });

            return { activeChip, didFallback };
        }

        /**
         * Unified category activation path: updates state, resets pagination,
         * re-renders the filtered results, syncs the URL, syncs ui controls and
         * reconciles the radio-group semantics on the chips themselves.
         */
        function activateCategoryChip(chip, options = {}) {
            if (!chip) return;
            state.currentCategory = getChipCategory(chip);
            resetPaginationState();
            // Same reconciliation as query input: drop filtered-out selection.
            callbacks.renderResults(true);
            callbacks.updateUrlState({ historyMode: 'replace' });
            ui?.syncControlsFromState?.();
            syncCategoryChipSemantics();
            if (options.focus && typeof chip.focus === 'function') {
                chip.focus();
            }
        }

        /**
         * Roving-tabindex keyboard navigation over the category chips.
         * ArrowRight/Down -> next (wrap), ArrowLeft/Up -> previous (wrap),
         * Home -> first, End -> last. Movement both moves focus and activates.
         */
        function moveCategoryChipFocus(direction) {
            if (!tagChips || tagChips.length === 0) return;
            // tagChips is a static NodeList — convert before indexOf.
            const currentIndex = Array.prototype.indexOf.call(tagChips, document.activeElement);
            let nextIndex;
            if (direction === 'next') {
                nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % tagChips.length;
            } else if (direction === 'prev') {
                nextIndex = currentIndex === -1 ? tagChips.length - 1 : (currentIndex - 1 + tagChips.length) % tagChips.length;
            } else if (direction === 'home') {
                nextIndex = 0;
            } else {
                nextIndex = tagChips.length - 1;
            }
            activateCategoryChip(tagChips[nextIndex], { focus: true });
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
                    activateCategoryChip(chip, { focus: false });
                });

                chip.addEventListener('keydown', (event) => {
                    const key = event.key;
                    let direction = null;
                    if (key === 'ArrowRight' || key === 'ArrowDown') direction = 'next';
                    else if (key === 'ArrowLeft' || key === 'ArrowUp') direction = 'prev';
                    else if (key === 'Home') direction = 'home';
                    else if (key === 'End') direction = 'end';
                    if (direction) {
                        event.preventDefault();
                        moveCategoryChipFocus(direction);
                    }
                    // Enter/Space activate via the native <button> click path —
                    // never handled here, so a single press fires exactly one click.
                });
            });

            // URL-state restore (and any external code) toggles the active class
            // directly; converge the full radio-group semantics in that case too.
            // An unknown category fails closed to the canonical first chip — only
            // then (and only once the page is ready) is a bounded render/URL
            // reconcile issued, so valid restores never duplicate work.
            const container = tagChips.length ? tagChips[0].parentElement : null;
            if (container && typeof MutationObserver === 'function') {
                const observer = new MutationObserver(() => {
                    const result = syncCategoryChipSemantics();
                    if (result && result.didFallback && state.urlStateReady) {
                        callbacks.renderResults(true);
                        callbacks.updateUrlState({ historyMode: 'replace' });
                        ui?.syncControlsFromState?.();
                    }
                });
                observer.observe(container, {
                    attributes: true,
                    attributeFilter: ['class'],
                    subtree: true
                });
            }
        }

        function bindSortAndLimitControls() {
            if (typeof ui?.ensureBrowseControls === 'function') {
                ui.ensureBrowseControls();
            }
        }

        function syncControlsFromState() {
            if (searchInput) searchInput.value = state.currentQuery || '';

            syncCategoryChipSemantics();

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
