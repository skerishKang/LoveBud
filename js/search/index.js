/**
 * LoveBud Search Page Orchestrator
 * v20260616-2539-1
 *
 * Search page orchestration:
 * - Fast list-first loading for public trees
 * - Delegates q/category/sort/limit URL state to js/search/search-url-state.js
 * - Delegates search/filter/sort/limit controls binding to js/search/search-controls.js
 * - Delegates preview selection/deep-link orchestration to js/search/search-preview-controller.js when loaded
 */

document.addEventListener('DOMContentLoaded', async () => {
    const refs = {
        resultsList: document.getElementById('resultsList'),
        previewSidebar: document.getElementById('previewSidebar'),
        previewMobileClose: document.getElementById('previewMobileClose'),
        previewContainer: document.getElementById('previewVideoContainer'),
        previewTitle: document.getElementById('previewTitle'),
        previewDesc: document.getElementById('previewDesc'),
        previewMemoriesCount: document.getElementById('previewMemoriesCount'),
        previewTreeDuration: document.getElementById('previewTreeDuration'),
        previewEmotionTags: document.getElementById('previewEmotionTags'),
        previewHubFlowSlot: document.getElementById('previewHubFlowSlot'),
        previewHubSummarySlot: document.getElementById('previewHubSummarySlot'),
        previewHubActionsSlot: document.getElementById('previewHubActionsSlot'),
        previewHubSocialSlot: document.getElementById('previewHubSocialSlot'),
        previewHubMetaSlot: document.getElementById('previewHubMetaSlot'),
        previewHubDynamicMetadataSlot: document.getElementById('previewHubDynamicMetadataSlot'),
        searchInput: document.getElementById('searchInput'),
        tagChips: document.querySelectorAll('.tag-chip'),
        resultsHead: document.querySelector('.browse-results-head'),
        mobilePreviewMediaQuery: window.matchMedia('(max-width: 768px)')
    };
    refs.resultsTitle = refs.resultsHead?.querySelector('h3');
    refs.resultsBadge = refs.resultsHead?.querySelector('.browse-results-badge');

    const CardRenderer = window.LoveBudSearchCardRenderer;
    CardRenderer.init(refs.resultsList);

    const PreviewRenderer = window.LoveBudSearchPreviewRenderer;
    PreviewRenderer.init({
        previewContainer: refs.previewContainer,
        previewTitle: refs.previewTitle,
        previewDesc: refs.previewDesc,
        previewMemoriesCount: refs.previewMemoriesCount,
        previewTreeDuration: refs.previewTreeDuration,
        previewEmotionTags: refs.previewEmotionTags,
        previewHubFlowSlot: refs.previewHubFlowSlot,
        previewHubSummarySlot: refs.previewHubSummarySlot,
        previewHubActionsSlot: refs.previewHubActionsSlot,
        previewHubSocialSlot: refs.previewHubSocialSlot,
        previewHubMetaSlot: refs.previewHubMetaSlot,
        previewHubDynamicMetadataSlot: refs.previewHubDynamicMetadataSlot
    });

    const Adapter = window.LoveBudSearchAdapter;
    const cache = window.LoveBudCache;
    const PUBLIC_TREES_CACHE_KEY = 'public_trees_summary_latest_10';
    const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
    const getPreviewCacheKey = (treeId) => `public_tree_preview_${treeId}`;

    const state = {
        allTrees: [],
        loadError: null,
        isFromCache: false,
        apiTreesLoaded: false,
        selectedTreeId: null,
        currentPreviewRequestId: 0,
        currentQuery: '',
        currentSort: 'latest',
        currentLimit: 6,
        currentCategory: '전체',
        isRestoringUrlState: false,
        urlStateReady: false,
        initialTreeDeepLinkApplied: false,
        isLoadingMore: false,
        hasMoreTrees: true,
        currentPublicTreeRequestId: 0
    };
    const previewCache = new Map();
    const callbacks = {};
    let loadMoreRequestInFlight = false;

    const ui = window.LoveBudSearchUI.createSearchUI({
        refs,
        state,
        renderers: { PreviewRenderer },
        callbacks
    });
    const previewCacheApi = window.LoveBudSearchPreviewCache.createPreviewCache({
        cache,
        previewCache,
        previewCacheTtlMs: PREVIEW_CACHE_TTL_MS,
        getPreviewCacheKey,
        state
    });
    const urlState = window.LoveBudSearchUrlState.createSearchUrlState({
        refs,
        state,
        ui
    });

    const dataApi = window.LoveBudSearchData.createSearchData({
        refs,
        state,
        previewCacheApi,
        ui,
        CardRenderer,
        PreviewRenderer,
        callbacks,
        cache,
        PUBLIC_TREES_CACHE_KEY,
        PREVIEW_CACHE_TTL_MS,
        getPreviewCacheKey
    });

    const createInlinePreviewController = () => {
        const getSelectedTreeFromFiltered = (filteredTrees) => {
            if (!Array.isArray(filteredTrees) || filteredTrees.length === 0) return null;
            return filteredTrees.find(tree => tree.id === state.selectedTreeId) || null;
        };

        const readSelectedTreeFromUrl = () => {
            try {
                return new URLSearchParams(window.location.search).get('tree') || '';
            } catch {
                return '';
            }
        };

        const findRenderedTreeCard = (treeId) => {
            let selector = '';
            try {
                selector = `.tree-card[data-tree-id="${CSS.escape(treeId)}"]`;
            } catch (e) {
                selector = `.tree-card[data-tree-id="${treeId.replace(/"/g, '\\"')}"]`;
            }
            return refs.resultsList ? refs.resultsList.querySelector(selector) : null;
        };

        const selectTree = (tree, activeCard, options = {}) => {
            if (!tree) return;
            const { openMobilePreview = true } = options;
            state.selectedTreeId = tree.id;
            ui.markActiveCard(activeCard);

            if (openMobilePreview && ui.isMobilePreviewMode()) {
                ui.setMobilePreviewOpen(true);
            }

            if (Array.isArray(tree.memories) && tree.memories.length > 0) {
                previewCacheApi.writePreviewCache(tree.id, tree);
                PreviewRenderer.updatePreview(tree);
                return;
            }

            dataApi.hydrateSelectedTreePreview(tree);
        };

        const applySelectedTreeFromUrl = () => {
            if (state.initialTreeDeepLinkApplied) return;
            const treeId = readSelectedTreeFromUrl();
            if (!treeId) return;

            const targetTree = state.allTrees.find(t => t.id === treeId);
            if (!targetTree) return;

            selectTree(targetTree, findRenderedTreeCard(treeId), { openMobilePreview: false });
            state.initialTreeDeepLinkApplied = true;
        };

        return { getSelectedTreeFromFiltered, selectTree, applySelectedTreeFromUrl };
    };

    const previewController = window.LoveBudSearchPreviewController?.createSearchPreviewController
        ? window.LoveBudSearchPreviewController.createSearchPreviewController({
            refs,
            state,
            ui,
            previewCacheApi,
            dataApi,
            PreviewRenderer
        })
        : createInlinePreviewController();

    const getFilteredTrees = () => dataApi.dedupeTreesById(
        Adapter.filterTrees(state.allTrees, state.currentQuery, state.currentCategory)
    );

    function renderResults(resetPreviewWhenNoSelection = true) {
        const filtered = getFilteredTrees();

        if (filtered.length === 0) {
            const hasNoData = state.loadError === null && state.allTrees.length === 0;
            const isApiFailure = state.loadError !== null && !state.isFromCache && state.allTrees.length === 0;

            if (isApiFailure) {
                ui.renderLoadErrorState();
            } else if (hasNoData) {
                refs.resultsList.innerHTML = CardRenderer.renderNoTreesState();
                ui.clearSelectedPreview();
            } else {
                refs.resultsList.innerHTML = CardRenderer.renderEmptySearchState();
                ui.clearSelectedPreview();
            }
            return;
        }

        const html = CardRenderer.renderResults(filtered, {
            isDemo: !state.apiTreesLoaded && !state.loadError
        });
        refs.resultsList.innerHTML = html;
        ui.attachCardEvents(refs.resultsList, filtered);
        ui.syncActiveCard();

        const selectedTree = previewController.getSelectedTreeFromFiltered(filtered);

        if (!state.selectedTreeId && resetPreviewWhenNoSelection && filtered.length > 0) {
            const firstTree = filtered[0];
            const firstCard = findRenderedTreeCard(firstTree.id);
            previewController.selectTree(firstTree, firstCard, { openMobilePreview: false });
            return;
        }

        if (!state.selectedTreeId && resetPreviewWhenNoSelection) {
            ui.clearSelectedPreview();
            return;
        }

        if (selectedTree && Array.isArray(selectedTree.memories) && selectedTree.memories.length > 0) {
            previewCacheApi.writePreviewCache(selectedTree.id, selectedTree);
            PreviewRenderer.updatePreview(selectedTree);
            ui.syncPreviewVisibility();
        } else if (!selectedTree && resetPreviewWhenNoSelection) {
            ui.clearSelectedPreview();
        }
    }

    function findRenderedTreeCard(treeId) {
        let selector = '';
        try {
            selector = `.tree-card[data-tree-id="${CSS.escape(treeId)}"]`;
        } catch (e) {
            selector = `.tree-card[data-tree-id="${treeId.replace(/"/g, '\\"')}"]`;
        }
        return refs.resultsList ? refs.resultsList.querySelector(selector) : null;
    }

    callbacks.selectTree = previewController.selectTree;
    callbacks.loadPublicTrees = dataApi.loadPublicTrees;
    callbacks.renderResults = renderResults;
    callbacks.updateUrlState = urlState.updateUrlState;

    callbacks.loadMorePublicTrees = async () => {
        if (loadMoreRequestInFlight || !state.apiTreesLoaded || state.isLoadingMore || !state.hasMoreTrees || state.currentLimit >= 60) {
            return false;
        }

        const nextLimit = Math.min(state.currentLimit + 10, 60);
        if (nextLimit === state.currentLimit) return false;

        loadMoreRequestInFlight = true;

        try {
            state.currentLimit = nextLimit;
            ui.syncControlsFromState();
            ui.syncBrowseHead();
            urlState.updateUrlState();

            await dataApi.loadPublicTrees({ resetSelection: false });
            return true;
        } finally {
            loadMoreRequestInFlight = false;
            ui.syncControlsFromState();
        }
    };

    const controls = window.LoveBudSearchControls.createSearchControls({
        refs,
        state,
        callbacks,
        ui
    });

    ui.bindMobilePreviewHandlers();
    ui.bindShareCopyHandler();

    controls.bind();
    ui.syncStaticBrowseCopy();
    ui.syncPreviewVisibility();
    if (typeof window.onLangChange === 'function') {
        window.onLangChange(() => {
            ui.syncStaticBrowseCopy();
            ui.syncBrowseHead();
            controls.syncControlsFromState();
        });
    }

    refs.resultsList.innerHTML = CardRenderer.renderLoading();
    ui.clearSelectedPreview();

    urlState.restoreStateFromUrl();

    await dataApi.loadPublicTrees({ resetSelection: true });

    await previewController.applySelectedTreeFromUrl();
    state.urlStateReady = true;

    window.addEventListener('popstate', async () => {
        const previousSort = state.currentSort;
        const previousLimit = state.currentLimit;
        urlState.restoreStateFromUrl();
        if (previousSort !== state.currentSort || previousLimit !== state.currentLimit) {
            await dataApi.loadPublicTrees({ resetSelection: true });
        } else {
            renderResults(false);
        }
        ui.syncBrowseHead();
    });
});
