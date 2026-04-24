/**
 * LoveBud Search Page Orchestrator
 * v20260423-2
 *
 * Search page orchestration:
 * - Fast list-first loading for public trees
 * - Filter state management
 * - Event binding
 * - Lazy preview hydration on tree selection
 */

document.addEventListener('DOMContentLoaded', async () => {
    const resultsList = document.getElementById('resultsList');
    const previewSidebar = document.getElementById('previewSidebar');
    const previewMobileClose = document.getElementById('previewMobileClose');
    const previewContainer = document.getElementById('previewVideoContainer');
    const previewTitle = document.getElementById('previewTitle');
    const previewDesc = document.getElementById('previewDesc');
    const previewMemoriesCount = document.getElementById('previewMemoriesCount');
    const previewTreeDuration = document.getElementById('previewTreeDuration');
    const previewEmotionTags = document.getElementById('previewEmotionTags');
    const searchInput = document.getElementById('searchInput');
    const tagChips = document.querySelectorAll('.tag-chip');
    const resultsHead = document.querySelector('.browse-results-head');
    const resultsTitle = resultsHead?.querySelector('h3');
    const resultsBadge = resultsHead?.querySelector('.browse-results-badge');
    const growingSection = document.getElementById('growingTreesSection');
    const growingList = document.getElementById('growingTreesList');
    const mobilePreviewMediaQuery = window.matchMedia('(max-width: 768px)');

    const CardRenderer = window.LoveBudSearchCardRenderer;
    CardRenderer.init(resultsList);

    const PreviewRenderer = window.LoveBudSearchPreviewRenderer;
    PreviewRenderer.init({
        previewContainer,
        previewTitle,
        previewDesc,
        previewMemoriesCount,
        previewTreeDuration,
        previewEmotionTags
    });

    const Adapter = window.LoveBudSearchAdapter;
    const cache = window.LoveBudCache;
    const PUBLIC_TREES_CACHE_KEY = 'public_trees_summary_latest_10';
    const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
    const getPreviewCacheKey = (treeId) => `public_tree_preview_${treeId}`;

    let allTrees = [];
    let growingTrees = [];
    let loadError = null;
    let isFromCache = false;
    let apiTreesLoaded = false;
    let selectedTreeId = null;
    const previewCache = new Map();
    let currentPreviewRequestId = 0;

    let currentQuery = '';
    let currentSort = 'latest';
    let currentLimit = 10;
    let currentCategory = '전체';

    function getCurrentLocale() {
        const locale = window.i18n?.currentLang || window.getCurrentLang?.() || document.documentElement?.lang || 'ko';
        return String(locale).toLowerCase().startsWith('en') ? 'en' : 'ko';
    }

    function isMobilePreviewMode() {
        return Boolean(mobilePreviewMediaQuery?.matches);
    }

    function setMobilePreviewOpen(isOpen, options = {}) {
        if (!previewSidebar || !isMobilePreviewMode()) return;
        const { scrollIntoView = false } = options;
        previewSidebar.classList.toggle('is-open', Boolean(isOpen));

        if (isOpen && scrollIntoView) {
            window.requestAnimationFrame(() => {
                previewSidebar.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            });
        }
    }

    function syncPreviewVisibility() {
        if (!previewSidebar) return;
        if (isMobilePreviewMode()) {
            setMobilePreviewOpen(Boolean(selectedTreeId));
            return;
        }
        previewSidebar.classList.remove('is-open');
    }

    function clearSelectedPreview(options = {}) {
        const { preserveOpenState = false } = options;
        selectedTreeId = null;
        currentPreviewRequestId += 1;
        markActiveCard(null);
        PreviewRenderer.resetPreview();
        if (!preserveOpenState && isMobilePreviewMode()) {
            setMobilePreviewOpen(false);
        }
    }

    function getSearchCopy(key, fallbackKo, fallbackEn) {
        const locale = getCurrentLocale();
        const dict = window.i18nSearch?.[key];
        if (dict && typeof dict === 'object') {
            return dict[locale] || dict.ko || dict.en || fallbackKo;
        }
        return locale === 'en' ? fallbackEn : fallbackKo;
    }

    function readPreviewCache(treeId) {
        if (!treeId) return null;

        if (previewCache.has(treeId)) {
            return previewCache.get(treeId);
        }

        if (!cache || typeof cache.get !== 'function') {
            return null;
        }

        const cachedPreview = cache.get(getPreviewCacheKey(treeId));
        if (cachedPreview && typeof cachedPreview === 'object') {
            previewCache.set(treeId, cachedPreview);
            return cachedPreview;
        }

        return null;
    }

    function writePreviewCache(treeId, hydratedTree) {
        if (!treeId || !hydratedTree || typeof hydratedTree !== 'object') return;

        previewCache.set(treeId, hydratedTree);
        if (cache && typeof cache.set === 'function') {
            cache.set(getPreviewCacheKey(treeId), hydratedTree, PREVIEW_CACHE_TTL_MS);
        }
    }

    function mergeHydratedTree(hydratedTree) {
        if (!hydratedTree || !hydratedTree.id) return;
        allTrees = allTrees.map(item => item.id === hydratedTree.id ? hydratedTree : item);
    }

    const SORT_COPY = {
        latest: {
            title: () => getSearchCopy('search.resultsHeading', '최근 공개된 러브트리', 'Recently Shared LoveTrees'),
            badge: (count) => getCurrentLocale() === 'en' ? `${count} to start with` : `지금 먼저 볼 ${count}개`
        },
        popular: {
            title: () => getCurrentLocale() === 'en' ? 'Popular Public LoveTrees' : '인기 많은 공개 러브트리',
            badge: (count) => getCurrentLocale() === 'en' ? `${count} trending now` : `지금 반응이 큰 ${count}개`
        }
    };

    const syncStaticBrowseCopy = () => {
        if (typeof window.applyI18n === 'function') {
            window.applyI18n();
        }

        const eyebrow = document.querySelector('.search-panel-eyebrow span:last-child');
        if (eyebrow) {
            eyebrow.textContent = getSearchCopy('search.eyebrow', '오늘의 공개 감상', 'Today\'s Public Picks');
        }

        if (searchInput) {
            searchInput.placeholder = getSearchCopy('search.placeholder', '예: 첫 설렘 · 아티스트명 · 감정 태그', 'e.g., first spark, artist, emotion tag');
        }

        const previewHeading = document.querySelector('.preview-panel-header h3');
        if (previewHeading) {
            previewHeading.textContent = getSearchCopy('search.previewTitle', '감상 허브', 'Viewing Hub');
        }

        const previewBadge = document.querySelector('.preview-badge');
        if (previewBadge) {
            previewBadge.textContent = getSearchCopy('search.previewBadge', '선택한 트리', 'Selected Tree');
        }

        if (previewMobileClose) {
            previewMobileClose.setAttribute(
                'aria-label',
                getSearchCopy('search.previewClose', '감상 닫기', 'Close preview')
            );
        }

        const previewKicker = document.querySelector('.preview-kicker');
        if (previewKicker) {
            previewKicker.textContent = getSearchCopy('search.previewKicker', '대표 순간과 이어진 감정을 먼저 살펴보세요.', 'Begin with the featured moment and connected feelings.');
        }

        const previewStatsPending = document.querySelector('#previewTreeStats .tree-meta-item:first-child span:last-child');
        if (previewStatsPending) {
            previewStatsPending.textContent = getSearchCopy('search.previewStatsPending', '대표 순간이 열리면 함께 보여드릴게요', 'This will appear once the featured moment opens.');
        }

        const emotionLabel = document.querySelector('.emotion-tags-label span:last-child');
        if (emotionLabel) {
            emotionLabel.textContent = getSearchCopy('search.previewEmotionTagsLabel', '이어진 감정', 'Connected Feelings');
        }

        if (previewEmotionTags && !previewEmotionTags.children.length) {
            previewEmotionTags.textContent = getSearchCopy('search.previewNoEmotionTags', '아직 또렷한 감정의 결은 놓이지 않았어요.', 'No clear emotional thread has settled yet.');
        }
    };

    const syncBrowseHead = () => {
        const copy = SORT_COPY[currentSort] || SORT_COPY.latest;
        if (resultsTitle) {
            resultsTitle.textContent = typeof copy.title === 'function' ? copy.title() : copy.title;
        }
        if (resultsBadge) {
            resultsBadge.innerHTML = `
                <span class="material-symbols-outlined" style="font-size:15px;">auto_awesome</span>
                ${copy.badge(Math.min(currentLimit, 60))}
            `;
        }
        const loadMoreBtn = document.getElementById('browseLoadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = currentLimit >= 60;
            loadMoreBtn.textContent = currentLimit >= 60
                ? (getCurrentLocale() === 'en' ? 'Max 60' : '최대 60개')
                : (getCurrentLocale() === 'en' ? 'Load more' : '더 보기');
        }
    };

    const ensureBrowseControls = () => {
        if (!resultsHead || document.getElementById('browseSortControls')) return;

        const controls = document.createElement('div');
        controls.id = 'browseSortControls';
        controls.style.display = 'flex';
        controls.style.flexWrap = 'wrap';
        controls.style.alignItems = 'center';
        controls.style.justifyContent = 'flex-end';
        controls.style.gap = '10px';
        controls.innerHTML = `
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="tag-chip active" data-browse-sort="latest">${getCurrentLocale() === 'en' ? 'Latest' : '최신순'}</button>
                <button type="button" class="tag-chip" data-browse-sort="popular">${getCurrentLocale() === 'en' ? 'Popular' : '인기순'}</button>
            </div>
            <button type="button" id="browseLoadMoreBtn" class="tag-chip">${getCurrentLocale() === 'en' ? 'Load more' : '더 보기'}</button>
        `;
        resultsHead.appendChild(controls);

        controls.querySelectorAll('[data-browse-sort]').forEach((button) => {
            button.addEventListener('click', async () => {
                const nextSort = button.dataset.browseSort || 'latest';
                if (nextSort === currentSort) return;
                currentSort = nextSort;
                currentLimit = 10;
                controls.querySelectorAll('[data-browse-sort]').forEach((chip) => {
                    chip.classList.toggle('active', chip.dataset.browseSort === currentSort);
                });
                await loadPublicTrees({ resetSelection: true });
            });
        });

        controls.querySelector('#browseLoadMoreBtn')?.addEventListener('click', async () => {
            currentLimit = Math.min(currentLimit + 10, 60);
            await loadPublicTrees({ resetSelection: false });
        });
    };

    const areTreesEffectivelySame = (prevTrees, nextTrees) => {
        if (!Array.isArray(prevTrees) || !Array.isArray(nextTrees)) return false;
        if (prevTrees.length !== nextTrees.length) return false;

        return prevTrees.every((prevTree, index) => {
            const nextTree = nextTrees[index];
            if (!nextTree) return false;
            const prevStamp = prevTree.updatedAt || prevTree.createdAt || prevTree.memoryCount || 0;
            const nextStamp = nextTree.updatedAt || nextTree.createdAt || nextTree.memoryCount || 0;
            return prevTree.id === nextTree.id && prevStamp === nextStamp;
        });
    };

    const getFilteredTrees = () => Adapter.filterTrees(allTrees, currentQuery, currentCategory);

    const markActiveCard = (activeCard) => {
        const allCardContainers = [resultsList, growingList].filter(Boolean);
        allCardContainers.forEach(container => {
            container.querySelectorAll('.tree-card.is-active').forEach((card) => {
                card.classList.remove('is-active');
                card.setAttribute('aria-pressed', 'false');
            });
        });
        if (activeCard) {
            activeCard.classList.add('is-active');
            activeCard.setAttribute('aria-pressed', 'true');
        }
    };

    const syncActiveCard = () => {
        const allCardContainers = [resultsList, growingList].filter(Boolean);
        let activeCard = null;
        for (const container of allCardContainers) {
            const cards = container.querySelectorAll('.tree-card');
            activeCard = Array.from(cards).find(card => card.dataset.treeId === selectedTreeId);
            if (activeCard) break;
        }
        markActiveCard(activeCard || null);
    };

    const getSelectedTreeFromFiltered = (filteredTrees) => {
        if (!Array.isArray(filteredTrees) || filteredTrees.length === 0) return null;
        return filteredTrees.find(tree => tree.id === selectedTreeId) || null;
    };

    const renderLoadErrorState = () => {
        resultsList.innerHTML = `
            <div class="empty-state" style="padding:60px 24px; text-align:center; color: var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size: 56px; color: var(--error); opacity: 0.6; margin-bottom: 20px; display: block;">cloud_off</span>
                <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 12px; color: var(--on-surface);">${getCurrentLocale() === 'en' ? 'Failed to load' : '불러오기 실패'}</h3>
                <p style="font-size: 0.95rem; opacity: 0.8; margin-bottom: 24px; line-height: 1.6;">
                    ${getCurrentLocale() === 'en'
                        ? 'There was a problem reaching the server.<br>Please check your network and try again in a moment.'
                        : '서버 연결에 문제가 발생했습니다.<br>네트워크 상태를 확인하고 잠시 후 다시 시도해 주세요.'}
                </p>
                <button type="button" id="retryLoadBtn" class="btn-round btn-primary" style="padding: 10px 24px;">${getCurrentLocale() === 'en' ? 'Try again' : '다시 시도'}</button>
            </div>
        `;

        const retryBtn = document.getElementById('retryLoadBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => window.location.reload());
        }

        clearSelectedPreview();
    };

    const renderPreviewLoadingState = (tree) => {
        if (typeof PreviewRenderer.renderLoadingPreview === 'function') {
            PreviewRenderer.renderLoadingPreview(tree);
            return;
        }
        if (previewTitle) {
            previewTitle.textContent = tree?.title || getSearchCopy('search.previewDefaultTreeName', '러브트리', 'LoveTree');
        }
        if (previewDesc) {
            previewDesc.innerHTML = `<p style="margin-bottom:16px;">${getCurrentLocale() === 'en' ? 'Loading the featured moment of this tree.' : '대표 순간을 불러오는 중이에요.'}</p>`;
        }
        if (previewContainer) {
            previewContainer.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--on-surface-variant);font-size:14px;text-align:center;padding:20px;"><span class="material-symbols-outlined" style="font-size:40px;opacity:0.45;margin-bottom:12px;display:block;animation:spin 1s linear infinite;">progress_activity</span><p style="margin:0;line-height:1.5;">${getCurrentLocale() === 'en' ? 'Preparing the featured moment.' : '대표 순간을 준비하고 있어요.'}</p></div>`;
        }
    };

    const hydrateSelectedTreePreview = async (tree) => {
        if (!tree || !tree.id) return;
        const requestId = ++currentPreviewRequestId;
        renderPreviewLoadingState(tree);

        try {
            const cachedPreview = readPreviewCache(tree.id);
            const hydratedTree = cachedPreview || await window.apiClient.getPublicTreePreview(tree);

            writePreviewCache(tree.id, hydratedTree);
            mergeHydratedTree(hydratedTree);

            if (requestId !== currentPreviewRequestId || selectedTreeId !== tree.id) {
                return;
            }
            PreviewRenderer.updatePreview(hydratedTree);
            renderResults(false);
        } catch (error) {
            console.warn('[search] preview hydration failed:', error.message);
            if (requestId !== currentPreviewRequestId || selectedTreeId !== tree.id) {
                return;
            }
            clearSelectedPreview({ preserveOpenState: false });
        }
    };

    const selectTree = (tree, activeCard) => {
        if (!tree) return;
        selectedTreeId = tree.id;
        markActiveCard(activeCard);

        if (isMobilePreviewMode()) {
            setMobilePreviewOpen(true, { scrollIntoView: true });
        }

        if (Array.isArray(tree.memories) && tree.memories.length > 0) {
            writePreviewCache(tree.id, tree);
            PreviewRenderer.updatePreview(tree);
            return;
        }

        hydrateSelectedTreePreview(tree);
    };

    const attachCardEvents = (listElement, trees) => {
        if (!listElement) return;
        const cards = listElement.querySelectorAll('.tree-card');
        cards.forEach((card) => {
            const treeId = card.dataset.treeId;
            const tree = trees.find(t => t.id === treeId);
            if (!tree) return;

            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-pressed', tree.id === selectedTreeId ? 'true' : 'false');

            card.addEventListener('click', () => {
                selectTree(tree, card);
            });

            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectTree(tree, card);
                }
            });
        });
    };

    function renderResults(resetPreviewWhenNoSelection = true) {
        const filtered = getFilteredTrees();

        if (filtered.length === 0) {
            const hasNoData = loadError === null && allTrees.length === 0;
            const isApiFailure = loadError !== null && !isFromCache && allTrees.length === 0;

            if (isApiFailure) {
                renderLoadErrorState();
            } else if (hasNoData) {
                resultsList.innerHTML = CardRenderer.renderNoTreesState();
                clearSelectedPreview();
            } else {
                resultsList.innerHTML = CardRenderer.renderEmptySearchState();
                clearSelectedPreview();
            }
            return;
        }

        const html = CardRenderer.renderResults(filtered, {
            isDemo: !apiTreesLoaded && !loadError
        });
        resultsList.innerHTML = html;
        attachCardEvents(resultsList, filtered);
        syncActiveCard();

        const selectedTree = getSelectedTreeFromFiltered(filtered);
        if (!selectedTreeId && resetPreviewWhenNoSelection) {
            clearSelectedPreview();
            return;
        }

        if (selectedTree && Array.isArray(selectedTree.memories) && selectedTree.memories.length > 0) {
            writePreviewCache(selectedTree.id, selectedTree);
            PreviewRenderer.updatePreview(selectedTree);
            syncPreviewVisibility();
        } else if (!selectedTree && resetPreviewWhenNoSelection) {
            clearSelectedPreview();
        }
    }

    async function loadPublicTrees(options = {}) {
        const { resetSelection = false } = options;
        const cacheKey = `${PUBLIC_TREES_CACHE_KEY}_${currentSort}_${currentLimit}`;

        syncBrowseHead();

        if (resetSelection) {
            clearSelectedPreview();
        }

        let cachedTrees = null;
        if (cache) {
            cachedTrees = cache.get(cacheKey);
            if (cachedTrees && Array.isArray(cachedTrees) && cachedTrees.length > 0) {
                allTrees = cachedTrees;
                isFromCache = true;
                renderResults();
            }
        }

        try {
            if (window.apiClient && window.apiClient.getPublicTrees) {
                const apiTrees = await window.apiClient.getPublicTrees({ view: 'summary', sort: currentSort, limit: currentLimit });
                if (!Array.isArray(apiTrees)) {
                    throw new Error(getCurrentLocale() === 'en' ? 'Invalid API response format' : 'API 응답 형식 오류');
                }

                if (cache) {
                    cache.set(cacheKey, apiTrees, 5 * 60 * 1000);
                }
                if (!areTreesEffectivelySame(allTrees, apiTrees)) {
                    allTrees = apiTrees;
                }
                loadError = null;
                apiTreesLoaded = true;
                renderResults();
            } else {
                throw new Error(getCurrentLocale() === 'en' ? 'Tree API unavailable' : 'tree API 사용 불가');
            }
        } catch (error) {
            loadError = error;
            console.warn('[search] API 로드 실패:', error.message);
            if (!allTrees || allTrees.length === 0) {
                allTrees = [];
            }
            renderResults();
        }
    }

    function renderGrowingResults() {
        if (!growingSection || !growingList) return;

        if (!growingTrees || growingTrees.length === 0) {
            growingSection.style.display = 'none';
            return;
        }

        growingSection.style.display = 'block';
        // Pass disableFeatured: true for secondary growing section
        const html = CardRenderer.renderResults(growingTrees, { 
            isDemo: false,
            disableFeatured: true 
        });
        growingList.innerHTML = html;
        attachCardEvents(growingList, growingTrees);
        syncActiveCard();
    }

    async function loadGrowingTrees() {
        if (!window.LoveTreeBaseApiFetch || typeof window.LoveTreeBaseApiFetch.apiFetch !== 'function') return;

        try {
            // Use established base API layer for public community endpoints
            const apiResponse = await window.LoveTreeBaseApiFetch.apiFetch('/community/growing-trees?limit=3');
            const rawTrees = Array.isArray(apiResponse) ? apiResponse : (apiResponse?.data || []);
            
            // Normalize and enrich models
            const baseModels = window.LoveTreePublicTreeAdapter.buildPublicTreeSummaryModels(rawTrees);
            growingTrees = baseModels.map((tree, index) => {
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
            if (growingSection) growingSection.style.display = 'none';
        }
    }

    if (previewMobileClose) {
        previewMobileClose.addEventListener('click', () => {
            clearSelectedPreview();
        });
    }

    if (mobilePreviewMediaQuery?.addEventListener) {
        mobilePreviewMediaQuery.addEventListener('change', () => {
            syncPreviewVisibility();
        });
    } else if (mobilePreviewMediaQuery?.addListener) {
        mobilePreviewMediaQuery.addListener(() => {
            syncPreviewVisibility();
        });
    }

    ensureBrowseControls();
    syncStaticBrowseCopy();
    syncPreviewVisibility();
    if (typeof window.onLangChange === 'function') {
        window.onLangChange(() => {
            syncStaticBrowseCopy();
            syncBrowseHead();
        });
    }

    resultsList.innerHTML = CardRenderer.renderLoading();
    clearSelectedPreview();
    await Promise.allSettled([
        loadPublicTrees({ resetSelection: true }),
        loadGrowingTrees()
    ]);

    let searchInputTimer = null;
    searchInput.addEventListener('input', (e) => {
        currentQuery = e.target.value.trim();
        if (searchInputTimer) clearTimeout(searchInputTimer);
        searchInputTimer = setTimeout(() => {
            renderResults(false);
        }, 180);
    });

    tagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            tagChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.dataset.category || chip.textContent.trim();
            renderResults(false);
        });
    });
});
