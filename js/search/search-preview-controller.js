(function () {
    function createSearchPreviewController({ refs, state, ui, previewCacheApi, dataApi, PreviewRenderer }) {
        function getSelectedTreeFromFiltered(filteredTrees) {
            if (!Array.isArray(filteredTrees) || filteredTrees.length === 0) return null;
            return filteredTrees.find(tree => tree.id === state.selectedTreeId) || null;
        }

        function readSelectedTreeFromUrl() {
            try {
                const raw = new URLSearchParams(window.location.search).get('tree') || '';
                const trimmed = String(raw).trim();
                return trimmed;
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
         * Never substitutes an arbitrary first card for an unknown ID.
         * @param {{ force?: boolean, historyMode?: 'push'|'replace'|'none' }} [options]
         */
        async function applySelectedTreeFromUrl(options = {}) {
            const force = Boolean(options.force);
            const historyMode = options.historyMode || 'none';

            if (state.initialTreeDeepLinkApplied && !force) return;

            const treeId = readSelectedTreeFromUrl();
            if (!treeId) {
                state.initialTreeDeepLinkApplied = true;
                if (force && state.selectedTreeId) {
                    ui.clearSelectedPreview();
                }
                return;
            }

            let targetTree =
                state.allTrees.find(t => t.id === treeId) ||
                (Array.isArray(state.growingTrees)
                    ? state.growingTrees.find(t => t.id === treeId)
                    : null);

            // Only fetch on initial deep-link when list does not yet include the tree.
            // Popstate force path stays within currently loaded results (no surprise network).
            if (!targetTree && !force && window.apiClient && window.apiClient.getPublicTreePreview) {
                try {
                    targetTree = await window.apiClient.getPublicTreePreview({ id: treeId });
                } catch (error) {
                    console.warn('[preview-controller] deep link fetch failed:', error.message);
                }
            }

            if (!targetTree) {
                // Unknown / filtered-out ID: leave unselected; do not pick the first card.
                state.initialTreeDeepLinkApplied = true;
                state.pendingUnknownTreeDeepLink = true;
                if (force && state.selectedTreeId) {
                    ui.clearSelectedPreview();
                }
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
            applySelectedTreeFromUrl
        };
    }

    window.LoveBudSearchPreviewController = { createSearchPreviewController };
})();
