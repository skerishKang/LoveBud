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
    let currentCategory = '?„ì²´';
    let isRestoringUrlState = false;

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
            title: () => getSearchCopy('search.resultsHeading', 'ìµœê·¼ ê³µê°œ???¬ë¸Œ?¸ë¦¬', 'Recently Shared LoveTrees'),
            badge: (count) => getCurrentLocale() === 'en' ? `${count} to start with` : `ì§€ê¸?ë¨¼ì? ë³?${count}ê°?
        },
        popular: {
            title: () => getCurrentLocale() === 'en' ? 'Popular Public LoveTrees' : '?¸ê¸° ë§ì? ê³µê°œ ?¬ë¸Œ?¸ë¦¬',
            badge: (count) => getCurrentLocale() === 'en' ? `${count} trending now` : `ì§€ê¸?ë°˜ì‘????${count}ê°?
        }
    };

    const syncStaticBrowseCopy = () => {
        if (typeof window.applyI18n === 'function') {
            window.applyI18n();
        }

        const eyebrow = document.querySelector('.search-panel-eyebrow span:last-child');
        if (eyebrow) {
            eyebrow.textContent = getSearchCopy('search.eyebrow', '?¤ëŠ˜??ê³µê°œ ê°ìƒ', 'Today\'s Public Picks');
        }

        if (searchInput) {
            searchInput.placeholder = getSearchCopy('search.placeholder', '?? ì²??¤ë ˜ Â· ?„í‹°?¤íŠ¸ëª?Â· ê°ì • ?œê·¸', 'e.g., first spark, artist, emotion tag');
        }

        const previewHeading = document.querySelector('.preview-panel-header h3');
        if (previewHeading) {
            previewHeading.textContent = getSearchCopy('search.previewTitle', 'ê°ìƒ ?ˆë¸Œ', 'Viewing Hub');
        }

        const previewBadge = document.querySelector('.preview-badge');
        if (previewBadge) {
            previewBadge.textContent = getSearchCopy('search.previewBadge', '? íƒ???¸ë¦¬', 'Selected Tree');
        }

        if (previewMobileClose) {
            previewMobileClose.setAttribute(
                'aria-label',
                getSearchCopy('search.previewClose', 'ê°ìƒ ?«ê¸°', 'Close preview')
            );
        }

        const previewKicker = document.querySelector('.preview-kicker');
        if (previewKicker) {
            previewKicker.textContent = getSearchCopy('search.previewKicker', '?€???œê°„ê³??´ì–´ì§?ê°ì •??ë¨¼ì? ?´í´ë³´ì„¸??', 'Begin with the featured moment and connected feelings.');
        }

        const previewStatsPending = document.querySelector('#previewTreeStats .tree-meta-item:first-child span:last-child');
        if (previewStatsPending) {
            previewStatsPending.textContent = getSearchCopy('search.previewStatsPending', '?€???œê°„???´ë¦¬ë©??¨ê»˜ ë³´ì—¬?œë¦´ê²Œìš”', 'This will appear once the featured moment opens.');
        }

        const emotionLabel = document.querySelector('.emotion-tags-label span:last-child');
        if (emotionLabel) {
            emotionLabel.textContent = getSearchCopy('search.previewEmotionTagsLabel', '?´ì–´ì§?ê°ì •', 'Connected Feelings');
        }

        if (previewEmotionTags && !previewEmotionTags.children.length) {
            previewEmotionTags.textContent = getSearchCopy('search.previewNoEmotionTags', '?„ì§ ?ë ·??ê°ì •??ê²°ì? ?“ì´ì§€ ?Šì•˜?´ìš”.', 'No clear emotional thread has settled yet.');
        }
    };

    function readUrlState() {
        try {
            const params = new URLSearchParams(window.location.search);
            return {
                query: params.get('q') || '',
                category: params.get('category') || '',
                sort: params.get('sort') || '',
                limit: params.get('limit') || ''
            };
        } catch {
            return { query: '', category: '', sort: '', limit: '' };
        }
    }

    function updateUrlState() {
        if (isRestoringUrlState) return;
        try {
            const params = new URLSearchParams();
            if (currentQuery) params.set('q', currentQuery);
            if (currentCategory && currentCategory !== '??') params.set('category', currentCategory);
            if (currentSort && currentSort !== 'latest') params.set('sort', currentSort);
            if (currentLimit && currentLimit !== 10) params.set('limit', String(currentLimit));
            const newSearch = params.toString();
            const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
            if (newUrl !== (window.location.pathname + window.location.search)) {
                history.pushState(null, '', newUrl);
            }
        } catch { /* ignore */ }
    }

    function restoreStateFromUrl() {
        const { query, category, sort, limit } = readUrlState();
        isRestoringUrlState = true;
        if (query) currentQuery = query;
        if (category) currentCategory = category;
        if (sort === 'latest' || sort === 'popular') currentSort = sort;
        if (limit) {
            const parsedLimit = parseInt(limit, 10);
            if (!isNaN(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 60) {
                currentLimit = parsedLimit;
            }
        }
        if (query && searchInput) searchInput.value = query;
        if (category) {
            tagChips.forEach(chip => {
                const chipCategory = chip.dataset.category || chip.textContent.trim();
                chip.classList.toggle('active', chipCategory === currentCategory);
            });
        }
        if (sort) {
            const sortBtn = document.querySelector(`[data-browse-sort="${currentSort}"]`);
            if (sortBtn) {
                document.querySelectorAll('[data-browse-sort]').forEach(b => b.classList.remove('active'));
                sortBtn.classList.add('active');
            }
        }
        isRestoringUrlState = false;
    }

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
                ? (getCurrentLocale() === 'en' ? 'Max 60' : 'ìµœë? 60ê°?)
                : (getCurrentLocale() === 'en' ? 'Load more' : '??ë³´ê¸°');
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
                <button type="button" class="tag-chip active" data-browse-sort="latest">${getCurrentLocale() === 'en' ? 'Latest' : 'ìµœì‹ ??}</button>
                <button type="button" class="tag-chip" data-browse-sort="popular">${getCurrentLocale() === 'en' ? 'Popular' : '?¸ê¸°??}</button>
            </div>
            <button type="button" id="browseLoadMoreBtn" class="tag-chip">${getCurrentLocale() === 'en' ? 'Load more' : '??ë³´ê¸°'}</button>
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
                updateUrlState();
            });
        });

        controls.querySelector('#browseLoadMoreBtn')?.addEventListener('click', async () => {
            currentLimit = Math.min(currentLimit + 10, 60);
            await loadPublicTrees({ resetSelection: false });
            updateUrlState();
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
                <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 12px; color: var(--on-surface);">${getCurrentLocale() === 'en' ? 'Failed to load' : 'ë¶ˆëŸ¬?¤ê¸° ?¤íŒ¨'}</h3>
                <p style="font-size: 0.95rem; opacity: 0.8; margin-bottom: 24px; line-height: 1.6;">
                    ${getCurrentLocale() === 'en'
                        ? 'There was a problem reaching the server.<br>Please check your network and try again in a moment.'
                        : '?œë²„ ?°ê²°??ë¬¸ì œê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.<br>?¤íŠ¸?Œí¬ ?íƒœë¥??•ì¸?˜ê³  ? ì‹œ ???¤ì‹œ ?œë„??ì£¼ì„¸??'}
                </p>
                <button type="button" id="retryLoadBtn" class="btn-round btn-primary" style="padding: 10px 24px;">${getCurrentLocale() === 'en' ? 'Try again' : '?¤ì‹œ ?œë„'}</button>
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
            previewTitle.textContent = tree?.title || getSearchCopy('search.previewDefaultTreeName', '?¬ë¸Œ?¸ë¦¬', 'LoveTree');
        }
        if (previewDesc) {
            previewDesc.innerHTML = `<p style="margin-bottom:16px;">${getCurrentLocale() === 'en' ? 'Loading the featured moment of this tree.' : '?€???œê°„??ë¶ˆëŸ¬?¤ëŠ” ì¤‘ì´?ìš”.'}</p>`;
        }
        if (previewContainer) {
            previewContainer.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--on-surface-variant);font-size:14px;text-align:center;padding:20px;"><span class="material-symbols-outlined" style="font-size:40px;opacity:0.45;margin-bottom:12px;display:block;animation:spin 1s linear infinite;">progress_activity</span><p style="margin:0;line-height:1.5;">${getCurrentLocale() === 'en' ? 'Preparing the featured moment.' : '?€???œê°„??ì¤€ë¹„í•˜ê³??ˆì–´??'}</p></div>`;
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
                    throw new Error(getCurrentLocale() === 'en' ? 'Invalid API response format' : 'API ?‘ë‹µ ?•ì‹ ?¤ë¥˜');
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
                throw new Error(getCurrentLocale() === 'en' ? 'Tree API unavailable' : 'tree API ?¬ìš© ë¶ˆê?');
            }
        } catch (error) {
            loadError = error;
            console.warn('[search] API ë¡œë“œ ?¤íŒ¨:', error.message);
            if (!allTrees || allTrees.length === 0) {
                allTrees = [];
            }
            renderResults();
        }
    }

    function renderGrowingResults() {
        if (!growingSection || !growingList) return;

        if (!growingTrees || growingTrees.length === 0) {
            growingSection.hidden = true;
            growingList.innerHTML = '';
            return;
        }

        growingSection.hidden = false;
        // Use CardRenderer.renderTreeCard with index + 1 to prevent "featured" styling
        growingList.innerHTML = growingTrees
            .slice(0, 3)
            .map((tree, index) => CardRenderer.renderTreeCard(tree, index + 1))
            .join('');

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
            updateUrlState();
        }, 180);
    });

    tagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            tagChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.dataset.category || chip.textContent.trim();
            renderResults(false);
            updateUrlState();
        });
    });

    window.addEventListener('popstate', () => {
        restoreStateFromUrl();
        renderResults(false);
        syncBrowseHead();
    });

    restoreStateFromUrl();
});
