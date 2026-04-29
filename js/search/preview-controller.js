(function () {
    function createSearchPreviewController({ refs, state, ui, previewCacheApi, dataApi, PreviewRenderer }) {
        function getSelectedTreeFromFiltered(filteredTrees) {
            if (!Array.isArray(filteredTrees) || filteredTrees.length === 0) return null;
            return filteredTrees.find(tree => tree.id === state.selectedTreeId) || null;
        }

        function readSelectedTreeFromUrl() {
            try {
                return new URLSearchParams(window.location.search).get('tree') || '';
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

        function selectTree(tree, activeCard) {
            if (!tree) return;
            state.selectedTreeId = tree.id;
            ui.markActiveCard(activeCard);

            if (ui.isMobilePreviewMode()) {
                ui.setMobilePreviewOpen(true);
            }

            if (Array.isArray(tree.memories) && tree.memories.length > 0) {
                previewCacheApi.writePreviewCache(tree.id, tree);
                PreviewRenderer.updatePreview(tree);
                return;
            }

            dataApi.hydrateSelectedTreePreview(tree);
        }

        async function applySelectedTreeFromUrl() {
            if (state.initialTreeDeepLinkApplied) return;
            const treeId = readSelectedTreeFromUrl();
            if (!treeId) return;

            let targetTree = state.allTrees.find(t => t.id === treeId) || state.growingTrees.find(t => t.id === treeId);

            if (!targetTree && window.apiClient && window.apiClient.getPublicTreePreview) {
                try {
                    targetTree = await window.apiClient.getPublicTreePreview({ id: treeId });
                } catch (error) {
                    console.warn('[preview-controller] deep link fetch failed:', error.message);
                }
            }

            if (!targetTree) {
                state.initialTreeDeepLinkApplied = true;
                return;
            }

            selectTree(targetTree, findRenderedTreeCard(treeId));
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
