(function () {
    function createSearchPreviewController({ refs, state, ui, previewCacheApi, dataApi, PreviewRenderer }) {
        const DEFAULT_CATEGORY = '전체';

        function getSelectedTreeFromFiltered(filteredTrees) {
            if (!Array.isArray(filteredTrees) || filteredTrees.length === 0) return null;
            return filteredTrees.find(tree => tree.id === state.selectedTreeId) || null;
        }

        function readSelectedTreeFromUrl() {
            try {
                const raw = new URLSearchParams(window.location.search).get('tree') || '';
                return String(raw).trim();
            } catch {
                return '';
            }
        }

        function getTreeCardSelector(treeId) {
            try {
                return `.tree-card[data-tree-id="${CSS.escape(treeId)}"]`;
            } catch (e) {
                return `.tree-card[data-tree-id="${treeId.replace(/"/g, '\\"')}"]`;
            }
        }

        function findRenderedTreeCard(treeId) {
            const selector = getTreeCardSelector(treeId);
            const allCardContainers = [refs.resultsList, refs.growingList].filter(Boolean);
            for (const container of allCardContainers) {
                const activeCard = container.querySelector(selector);
                if (activeCard) return activeCard;
            }
            return null;
        }

        function hasActiveClientFilter() {
            const query = String(state.currentQuery || '').trim();
            const category = state.currentCategory || DEFAULT_CATEGORY;
            return query !== '' || (category !== DEFAULT_CATEGORY && category !== '전체 경로');
        }

        function treePassesCurrentFilter(tree) {
            if (!tree) return false;
            const Adapter = window.LoveBudSearchAdapter;
            if (!Adapter || typeof Adapter.filterTrees !== 'function') return true;
            const matched = Adapter.filterTrees([tree], state.currentQuery, state.currentCategory);
            return Array.isArray(matched) && matched.length > 0;
        }

        function findLoadedTreeById(treeId) {
            if (!treeId) return null;
            const fromAll = Array.isArray(state.allTrees)
                ? state.allTrees.find((t) => t && t.id === treeId)
                : null;
            if (fromAll) return fromAll;
            if (Array.isArray(state.growingTrees)) {
                return state.growingTrees.find((t) => t && t.id === treeId) || null;
            }
            return null;
        }

        function clearSelectionAndTreeQuery() {
            if (typeof ui.clearSelectedPreview === 'function') {
                ui.clearSelectedPreview();
            } else {
                state.selectedTreeId = null;
            }
            state.pendingUnknownTreeDeepLink = false;
            // Drop stale tree query without creating a forward history entry.
            if (typeof window.updateUrlState === 'function') {
                window.updateUrlState({ historyMode: 'replace' });
            }
        }

        /**
         * Select a tree for preview and optionally sync history.
         * @param {object} tree
         * @param {Element|null} activeCard
         * @param {{ openMobilePreview?: boolean, historyMode?: 'push'|'replace'|'none' }} [options]
         */
        function selectTree(tree, activeCard, options = {}) {
            if (!tree) return;
            const openMobilePreview = options.openMobilePreview !== false;
            const historyMode = options.historyMode || 'push';
            const previousId = state.selectedTreeId;

            state.selectedTreeId = tree.id;
            // Valid selection always clears the unknown-deep-link hold.
            state.pendingUnknownTreeDeepLink = false;
            ui.markActiveCard(activeCard);

            if (openMobilePreview && ui.isMobilePreviewMode()) {
                ui.setMobilePreviewOpen(true);
            }

            // Same-tree reselect must not create a history entry.
            const effectiveHistory =
                historyMode === 'none'
                    ? 'none'
                    : previousId === tree.id
                        ? 'none'
                        : historyMode;

            if (typeof window.updateUrlState === 'function') {
                window.updateUrlState({ historyMode: effectiveHistory });
            }

            if (Array.isArray(tree.memories) && tree.memories.length > 0) {
                previewCacheApi.writePreviewCache(tree.id, tree);
                PreviewRenderer.updatePreview(tree);
                return;
            }

            dataApi.hydrateSelectedTreePreview(tree);
        }

        /**
         * Apply tree selection from URL once (or force on popstate).
         * Never substitutes an arbitrary first card for an unknown/filtered-out ID.
         * Honors current q/category filter before selecting.
         * @param {{ force?: boolean, historyMode?: 'push'|'replace'|'none' }} [options]
         */
        async function applySelectedTreeFromUrl(options = {}) {
            const force = Boolean(options.force);
            const historyMode = options.historyMode || 'none';

            if (state.initialTreeDeepLinkApplied && !force) return;

            const treeId = readSelectedTreeFromUrl();
            if (!treeId) {
                state.initialTreeDeepLinkApplied = true;
                state.pendingUnknownTreeDeepLink = false;
                if (force && state.selectedTreeId) {
                    if (typeof ui.clearSelectedPreview === 'function') ui.clearSelectedPreview();
                }
                return;
            }

            let targetTree = findLoadedTreeById(treeId);

            if (targetTree) {
                if (!treePassesCurrentFilter(targetTree)) {
                    // Loaded but filtered out by current query/category.
                    state.initialTreeDeepLinkApplied = true;
                    clearSelectionAndTreeQuery();
                    return;
                }
            } else {
                // Not in the currently loaded page.
                // Only allow public-preview fetch when there is no active client filter
                // and this is not a history-driven re-apply (force).
                const allowFetch = !force && !hasActiveClientFilter();
                if (allowFetch && window.apiClient && window.apiClient.getPublicTreePreview) {
                    try {
                        targetTree = await window.apiClient.getPublicTreePreview({ id: treeId });
                    } catch (error) {
                        console.warn('[preview-controller] deep link fetch failed:', error.message);
                        targetTree = null;
                    }
                    if (targetTree && !treePassesCurrentFilter(targetTree)) {
                        targetTree = null;
                    }
                }
            }

            if (!targetTree) {
                // Unknown / unavailable under current filter: leave unselected.
                state.initialTreeDeepLinkApplied = true;
                if (typeof ui.clearSelectedPreview === 'function') {
                    ui.clearSelectedPreview();
                } else {
                    state.selectedTreeId = null;
                }
                // Drop the unresolved tree query without push; keep the hold flag
                // so first-card auto-select stays blocked until a valid selection.
                if (typeof window.updateUrlState === 'function') {
                    window.updateUrlState({ historyMode: 'replace' });
                }
                state.pendingUnknownTreeDeepLink = true;
                return;
            }

            state.pendingUnknownTreeDeepLink = false;
            selectTree(targetTree, findRenderedTreeCard(treeId), {
                openMobilePreview: false,
                historyMode
            });
            state.initialTreeDeepLinkApplied = true;
        }

        return {
            getSelectedTreeFromFiltered,
            readSelectedTreeFromUrl,
            findRenderedTreeCard,
            selectTree,
            applySelectedTreeFromUrl,
            treePassesCurrentFilter,
            hasActiveClientFilter,
            clearSelectionAndTreeQuery
        };
    }

    window.LoveBudSearchPreviewController = { createSearchPreviewController };
})();
