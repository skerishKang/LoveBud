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
        pendingUnknownTreeDeepLink: false,
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

        const treePassesCurrentFilter = (tree) => {
            if (!tree) return false;
            const matched = Adapter.filterTrees([tree], state.currentQuery, state.currentCategory);
            return Array.isArray(matched) && matched.length > 0;
        };

        const hasActiveClientFilter = () => {
            const query = String(state.currentQuery || '').trim();
            const category = state.currentCategory || '전체';
            return query !== '' || (category !== '전체' && category !== '전체 경로');
        };

        const clearSelectionAndTreeQuery = () => {
            ui.clearSelectedPreview();
            state.pendingUnknownTreeDeepLink = false;
            if (typeof window.updateUrlState === 'function') {
                window.updateUrlState({ historyMode: 'replace' });
            }
        };

        const selectTree = (tree, activeCard, options = {}) => {
            if (!tree) return;
            const openMobilePreview = options.openMobilePreview !== false;
            const historyMode = options.historyMode || 'push';
            const previousId = state.selectedTreeId;
            state.selectedTreeId = tree.id;
            state.pendingUnknownTreeDeepLink = false;
            ui.markActiveCard(activeCard);

            if (openMobilePreview && ui.isMobilePreviewMode()) {
                ui.setMobilePreviewOpen(true);
            }

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
        };

        const applySelectedTreeFromUrl = async (options = {}) => {
            const force = Boolean(options.force);
            const historyMode = options.historyMode || 'none';
            if (state.initialTreeDeepLinkApplied && !force) return;
            const treeId = readSelectedTreeFromUrl();
            if (!treeId) {
                state.initialTreeDeepLinkApplied = true;
                state.pendingUnknownTreeDeepLink = false;
                if (force && state.selectedTreeId) ui.clearSelectedPreview();
                return;
            }

            let targetTree = state.allTrees.find(t => t.id === treeId) || null;
            if (targetTree) {
                if (!treePassesCurrentFilter(targetTree)) {
                    state.initialTreeDeepLinkApplied = true;
                    clearSelectionAndTreeQuery();
                    return;
                }
            } else {
                const allowFetch = !force && !hasActiveClientFilter();
                if (allowFetch && window.apiClient && window.apiClient.getPublicTreePreview) {
                    try {
                        targetTree = await window.apiClient.getPublicTreePreview({ id: treeId });
                    } catch (error) {
                        targetTree = null;
                    }
                    if (targetTree && !treePassesCurrentFilter(targetTree)) {
                        targetTree = null;
                    }
                }
            }

            if (!targetTree) {
                state.initialTreeDeepLinkApplied = true;
                ui.clearSelectedPreview();
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
        };

        return {
            getSelectedTreeFromFiltered,
            readSelectedTreeFromUrl,
            selectTree,
            applySelectedTreeFromUrl,
            treePassesCurrentFilter,
            hasActiveClientFilter,
            clearSelectionAndTreeQuery
        };
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

        const clearStaleSelection = () => {
            ui.clearSelectedPreview();
            state.pendingUnknownTreeDeepLink = false;
            if (typeof urlState.updateUrlState === 'function') {
                urlState.updateUrlState({ historyMode: 'replace' });
            }
        };

        if (filtered.length === 0) {
            const hasNoData = state.loadError === null && state.allTrees.length === 0;
            const isApiFailure = state.loadError !== null && !state.isFromCache && state.allTrees.length === 0;

            if (isApiFailure) {
                ui.renderLoadErrorState();
            } else if (hasNoData) {
                refs.resultsList.innerHTML = CardRenderer.renderNoTreesState();
            } else {
                refs.resultsList.innerHTML = CardRenderer.renderEmptySearchState();
            }
            // Empty filtered set: never keep a stale selection/preview/tree query.
            if (state.selectedTreeId || resetPreviewWhenNoSelection) {
                clearStaleSelection();
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

        // Always drop selection that no longer appears in the current filtered set.
        // Do not substitute the first card.
        if (state.selectedTreeId && !selectedTree) {
            clearStaleSelection();
        }

        // Do not auto-select the first card while a deep-link tree is pending
        // or when an unknown deep-link ID was already resolved as unselected.
        const pendingUrlTree = (() => {
            try {
                return Boolean(new URLSearchParams(window.location.search).get('tree'));
            } catch {
                return false;
            }
        })();
        const blockAutoSelect =
            state.pendingUnknownTreeDeepLink ||
            (!state.initialTreeDeepLinkApplied && pendingUrlTree);

        if (
            !state.selectedTreeId &&
            resetPreviewWhenNoSelection &&
            filtered.length > 0 &&
            !blockAutoSelect
        ) {
            const firstTree = filtered[0];
            const firstCard = findRenderedTreeCard(firstTree.id);
            previewController.selectTree(firstTree, firstCard, {
                openMobilePreview: false,
                historyMode: 'replace'
            });
            return;
        }

        if (!state.selectedTreeId && resetPreviewWhenNoSelection) {
            clearStaleSelection();
            return;
        }

        if (selectedTree && Array.isArray(selectedTree.memories) && selectedTree.memories.length > 0) {
            previewCacheApi.writePreviewCache(selectedTree.id, selectedTree);
            PreviewRenderer.updatePreview(selectedTree);
            ui.syncPreviewVisibility();
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

    /* #3845: bounded Browse Story load-more boundary. The Story controller is
     * pure presentation and never reaches the loader directly; this tiny
     * adapter exposes only the EXISTING loader authority (the same guards as
     * the scroll path: api-loaded, has-more, not already loading, limit cap,
     * plus the load-more in-flight flag) to the controller's injected
     * canRequestMore/requestMore boundaries. No new fetch or pagination is
     * added here — it forwards to callbacks.loadMorePublicTrees. */
    window.LoveBudBrowseStoryLoadMore = {
        canRequestMore: function () {
            return !loadMoreRequestInFlight
                && state.apiTreesLoaded
                && state.hasMoreTrees
                && !state.isLoadingMore
                && Number(state.currentLimit || 0) < 60;
        },
        requestMore: function () {
            return callbacks.loadMorePublicTrees();
        }
    };

    const controls = window.LoveBudSearchControls.createSearchControls({
        refs,
        state,
        callbacks,
        ui
    });

    if (typeof ui.bindMobilePreviewHandlers === 'function') {
        ui.bindMobilePreviewHandlers();
    }

    var shareLink = window.LoveBudSearchShareLink;
    if (shareLink && typeof shareLink.bindPreviewShareHandler === 'function') {
        shareLink.bindPreviewShareHandler();
    }

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

    ui.clearSelectedPreview();

    urlState.restoreStateFromUrl();

    await dataApi.loadPublicTrees({ resetSelection: true });

    await previewController.applySelectedTreeFromUrl({ historyMode: 'none' });
    state.urlStateReady = true;
    // Sync URL once after initial deep-link / selection settles (replace, not push).
    urlState.updateUrlState({ historyMode: 'replace' });

    window.addEventListener('popstate', async () => {
        const previousSort = state.currentSort;
        const previousLimit = state.currentLimit;
        // History already moved; never pushState from this path.
        state.isRestoringUrlState = true;
        urlState.restoreStateFromUrl();
        state.isRestoringUrlState = false;

        if (previousSort !== state.currentSort || previousLimit !== state.currentLimit) {
            await dataApi.loadPublicTrees({ resetSelection: false });
        } else {
            renderResults(false);
        }

        await previewController.applySelectedTreeFromUrl({
            force: true,
            historyMode: 'none'
        });
        ui.syncBrowseHead();
    });
});
