/**
 * LoveBud Search Page Orchestrator
 * v20260427-1
 *
 * Search page orchestration:
 * - Fast list-first loading for public trees
 * - Filter state management
 * - Event binding
 * - Lazy preview hydration on tree selection
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
        searchInput: document.getElementById('searchInput'),
        tagChips: document.querySelectorAll('.tag-chip'),
        resultsHead: document.querySelector('.browse-results-head'),
        growingSection: document.getElementById('growingTreesSection'),
        growingList: document.getElementById('growingTreesList'),
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
        previewEmotionTags: refs.previewEmotionTags
    });

    const Adapter = window.LoveBudSearchAdapter;
    const cache = window.LoveBudCache;
    const PUBLIC_TREES_CACHE_KEY = 'public_trees_summary_latest_10';
    const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
    const getPreviewCacheKey = (treeId) => `public_tree_preview_${treeId}`;

    const state = {
        allTrees: [],
        growingTrees: [],
        loadError: null,
        isFromCache: false,
        apiTreesLoaded: false,
        selectedTreeId: null,
        currentPreviewRequestId: 0,
        currentQuery: '',
        currentSort: 'latest',
        currentLimit: 10,
        currentCategory: '전체',
        isRestoringUrlState: false,
        urlStateReady: false,
        initialTreeDeepLinkApplied: false
    };
    const previewCache = new Map();
    const callbacks = {};

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
        callbacks,
        ui
    });

    const getFilteredTrees = () => Adapter.filterTrees(state.allTrees, state.currentQuery, state.currentCategory);

    const getSelectedTreeFromFiltered = (filteredTrees) => {
        if (!Array.isArray(filteredTrees) || filteredTrees.length === 0) return null;
        return filteredTrees.find(tree => tree.id === state.selectedTreeId) || null;
    };

    const hydrateSelectedTreePreview = async (tree) => {
        if (!tree || !tree.id) return;
        const requestId = ++state.currentPreviewRequestId;
        ui.renderPreviewLoadingState(tree);

        try {
            const cachedPreview = previewCacheApi.readPreviewCache(tree.id);
            const hydratedTree = cachedPreview || await window.apiClient.getPublicTreePreview(tree);

            previewCacheApi.writePreviewCache(tree.id, hydratedTree);
            previewCacheApi.mergeHydratedTree(hydratedTree);

            if (requestId !== state.currentPreviewRequestId || state.selectedTreeId !== tree.id) {
                return;
            }
            PreviewRenderer.updatePreview(hydratedTree);
            renderResults(false);
        } catch (error) {
            console.warn('[search] preview hydration failed:', error.message);
            if (requestId !== state.currentPreviewRequestId || state.selectedTreeId !== tree.id) {
                return;
            }
            ui.clearSelectedPreview({ preserveOpenState: false });
        }
    };

    const selectTree = (tree, activeCard) => {
        if (!tree) return;
        state.selectedTreeId = tree.id;
        ui.markActiveCard(activeCard);

        if (ui.isMobilePreviewMode()) {
            // scrollIntoView: false — 목록 scrollY를 유지하고 bottom sheet만 열림
            ui.setMobilePreviewOpen(true, { scrollIntoView: false });
        }

        if (Array.isArray(tree.memories) && tree.memories.length > 0) {
            previewCacheApi.writePreviewCache(tree.id, tree);
            PreviewRenderer.updatePreview(tree);
            return;
        }

        hydrateSelectedTreePreview(tree);
    };

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

        const selectedTree = getSelectedTreeFromFiltered(filtered);
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

    async function loadPublicTrees(options = {}) {
        const { resetSelection = false } = options;
        const cacheKey = `${PUBLIC_TREES_CACHE_KEY}_${state.currentSort}_${state.currentLimit}`;

        ui.syncBrowseHead();

        if (resetSelection) {
            ui.clearSelectedPreview();
        }

        let cachedTrees = null;
        if (cache) {
            cachedTrees = cache.get(cacheKey);
            if (cachedTrees && Array.isArray(cachedTrees) && cachedTrees.length > 0) {
                state.allTrees = cachedTrees;
                state.isFromCache = true;
                renderResults();
            }
        }

        try {
            if (window.apiClient && window.apiClient.getPublicTrees) {
                const apiTrees = await window.apiClient.getPublicTrees({
                    view: 'summary',
                    sort: state.currentSort,
                    limit: state.currentLimit
                });
                if (!Array.isArray(apiTrees)) {
                    throw new Error(ui.getCurrentLocale() === 'en' ? 'Invalid API response format' : 'API 응답 형식 오류');
                }

                if (cache) {
                    cache.set(cacheKey, apiTrees, 5 * 60 * 1000);
                }
                if (!previewCacheApi.areTreesEffectivelySame(state.allTrees, apiTrees)) {
                    state.allTrees = apiTrees;
                }
                state.loadError = null;
                state.apiTreesLoaded = true;
                renderResults();
            } else {
                throw new Error(ui.getCurrentLocale() === 'en' ? 'Tree API unavailable' : 'tree API 사용 불가');
            }
        } catch (error) {
            state.loadError = error;
            console.warn('[search] API 로드 실패:', error.message);
            if (!state.allTrees || state.allTrees.length === 0) {
                state.allTrees = [];
            }
            renderResults();
        }
    }

    function renderGrowingResults() {
        if (!refs.growingSection || !refs.growingList) return;

        if (!state.growingTrees || state.growingTrees.length === 0) {
            refs.growingSection.hidden = true;
            refs.growingList.innerHTML = '';
            return;
        }

        refs.growingSection.hidden = false;
        refs.growingList.innerHTML = state.growingTrees
            .slice(0, 3)
            .map((tree, index) => CardRenderer.renderTreeCard(tree, index + 1))
            .join('');

        ui.attachCardEvents(refs.growingList, state.growingTrees);
        ui.syncActiveCard();
    }

    async function loadGrowingTrees() {
        if (!window.LoveTreeBaseApiFetch || typeof window.LoveTreeBaseApiFetch.apiFetch !== 'function') return;

        try {
            const apiResponse = await window.LoveTreeBaseApiFetch.apiFetch('/community/growing-trees?limit=3');
            const rawTrees = Array.isArray(apiResponse) ? apiResponse : (apiResponse?.data || []);
            const baseModels = window.LoveTreePublicTreeAdapter.buildPublicTreeSummaryModels(rawTrees);
            state.growingTrees = baseModels.map((tree, index) => {
                const raw = rawTrees[index]?.data || rawTrees[index] || {};
                const rawEmotionTags = Array.isArray(raw.emotionTags) ? raw.emotionTags : (Array.isArray(raw.emotion_tags) ? raw.emotion_tags : []);
                return {
                    ...tree,
                    emotionTags: rawEmotionTags.filter(Boolean).slice(0, 3),
                    timeRange: raw.timeRange || raw.time_range || tree.timeRange
                };
            });

            renderGrowingResults();
        } catch (error) {
            console.warn('[search] growing trees load failed:', error.message);
            if (refs.growingSection) refs.growingSection.style.display = 'none';
        }
    }

    callbacks.selectTree = selectTree;
    callbacks.loadPublicTrees = loadPublicTrees;
    callbacks.renderResults = renderResults;
    callbacks.updateUrlState = urlState.updateUrlState;

    ui.bindMobilePreviewHandlers();
    ui.bindShareCopyHandler();

    ui.ensureBrowseControls();
    ui.syncStaticBrowseCopy();
    ui.syncPreviewVisibility();
    if (typeof window.onLangChange === 'function') {
        window.onLangChange(() => {
            ui.syncStaticBrowseCopy();
            ui.syncBrowseHead();
            ui.syncControlsFromState();
        });
    }

    refs.resultsList.innerHTML = CardRenderer.renderLoading();
    ui.clearSelectedPreview();
    await Promise.allSettled([
        loadPublicTrees({ resetSelection: true }),
        loadGrowingTrees()
    ]);

    urlState.restoreStateFromUrl();
    urlState.applySelectedTreeFromUrl();
    state.urlStateReady = true;

    let searchInputTimer = null;
    refs.searchInput.addEventListener('input', (e) => {
        state.currentQuery = e.target.value.trim();
        if (searchInputTimer) clearTimeout(searchInputTimer);
        searchInputTimer = setTimeout(() => {
            renderResults(false);
            urlState.updateUrlState();
        }, 180);
    });

    refs.tagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            refs.tagChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.currentCategory = chip.dataset.category || chip.textContent.trim();
            renderResults(false);
            urlState.updateUrlState();
        });
    });

    window.addEventListener('popstate', async () => {
        const previousSort = state.currentSort;
        const previousLimit = state.currentLimit;
        urlState.restoreStateFromUrl();
        if (previousSort !== state.currentSort || previousLimit !== state.currentLimit) {
            await loadPublicTrees({ resetSelection: true });
        } else {
            renderResults(false);
        }
        ui.syncBrowseHead();
    });
});
