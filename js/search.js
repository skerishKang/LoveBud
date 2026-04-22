/**
 * LoveBud Search Page Orchestrator
 * v20260422-3
 *
 * Search page orchestration:
 * - Fast list-first loading for public trees
 * - Filter state management
 * - Event binding
 * - Lazy preview hydration on tree selection
 */

document.addEventListener('DOMContentLoaded', async () => {
    const resultsList = document.getElementById('resultsList');
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
    const PUBLIC_TREES_CACHE_KEY = 'public_trees_summary_latest_12';

    let allTrees = [];
    let loadError = null;
    let isFromCache = false;
    let apiTreesLoaded = false;
    let selectedTreeId = null;
    const previewCache = new Map();
    let currentPreviewRequestId = 0;

    let currentQuery = '';
    let currentSort = 'latest';
    let currentLimit = 12;
    let currentCategory = '전체';

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
        resultsList.querySelectorAll('.tree-card.is-active').forEach((card) => {
            card.classList.remove('is-active');
            card.setAttribute('aria-pressed', 'false');
        });
        if (activeCard) {
            activeCard.classList.add('is-active');
            activeCard.setAttribute('aria-pressed', 'true');
        }
    };

    const syncActiveCard = () => {
        const cards = resultsList.querySelectorAll('.tree-card');
        const activeCard = Array.from(cards).find(card => card.dataset.treeId === selectedTreeId);
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
                <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 12px; color: var(--on-surface);">불러오기 실패</h3>
                <p style="font-size: 0.95rem; opacity: 0.8; margin-bottom: 24px; line-height: 1.6;">
                    서버 연결에 문제가 발생했습니다.<br>
                    네트워크 상태를 확인하고 잠시 후 다시 시도해 주세요.
                </p>
                <button type="button" id="retryLoadBtn" class="btn-round btn-primary" style="padding: 10px 24px;">다시 시도</button>
            </div>
        `;

        const retryBtn = document.getElementById('retryLoadBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => window.location.reload());
        }

        PreviewRenderer.resetPreview();
    };

    const renderPreviewLoadingState = (tree) => {
        if (typeof PreviewRenderer.renderLoadingPreview === 'function') {
            PreviewRenderer.renderLoadingPreview(tree);
            return;
        }
        if (previewTitle) {
            previewTitle.textContent = tree?.title || '러브트리';
        }
        if (previewDesc) {
            previewDesc.innerHTML = '<p style="margin-bottom:16px;">선택한 트리의 대표 순간을 불러오는 중입니다.</p>';
        }
        if (previewContainer) {
            previewContainer.innerHTML = '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--on-surface-variant);font-size:14px;text-align:center;padding:20px;"><span class="material-symbols-outlined" style="font-size:40px;opacity:0.45;margin-bottom:12px;display:block;animation:spin 1s linear infinite;">progress_activity</span><p style="margin:0;line-height:1.5;">선택한 트리의 preview를 준비하고 있어요.</p></div>';
        }
    };

    const hydrateSelectedTreePreview = async (tree) => {
        if (!tree || !tree.id) return;
        const requestId = ++currentPreviewRequestId;
        renderPreviewLoadingState(tree);

        try {
            const hydratedTree = previewCache.get(tree.id) || await window.apiClient.getPublicTreePreview(tree);
            previewCache.set(tree.id, hydratedTree);
            allTrees = allTrees.map(item => item.id === hydratedTree.id ? hydratedTree : item);

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
            PreviewRenderer.resetPreview();
        }
    };

    const selectTree = (tree, activeCard) => {
        if (!tree) return;
        selectedTreeId = tree.id;
        markActiveCard(activeCard);

        if (Array.isArray(tree.memories) && tree.memories.length > 0) {
            PreviewRenderer.updatePreview(tree);
            return;
        }

        hydrateSelectedTreePreview(tree);
    };

    const attachCardEvents = (filtered) => {
        const cards = resultsList.querySelectorAll('.tree-card');
        cards.forEach((card) => {
            const treeId = card.dataset.treeId;
            const tree = filtered.find(t => t.id === treeId);
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
                PreviewRenderer.resetPreview();
            } else {
                resultsList.innerHTML = CardRenderer.renderEmptySearchState();
                PreviewRenderer.resetPreview();
            }
            return;
        }

        const html = CardRenderer.renderResults(filtered, {
            isDemo: !apiTreesLoaded && !loadError
        });
        resultsList.innerHTML = html;
        attachCardEvents(filtered);
        syncActiveCard();

        const selectedTree = getSelectedTreeFromFiltered(filtered);
        if (!selectedTreeId && resetPreviewWhenNoSelection) {
            PreviewRenderer.resetPreview();
            return;
        }

        if (selectedTree && Array.isArray(selectedTree.memories) && selectedTree.memories.length > 0) {
            PreviewRenderer.updatePreview(selectedTree);
        } else if (!selectedTree && resetPreviewWhenNoSelection) {
            PreviewRenderer.resetPreview();
        }
    }

    resultsList.innerHTML = CardRenderer.renderLoading();
    PreviewRenderer.resetPreview();

    let cachedTrees = null;
    if (cache) {
        cachedTrees = cache.get(PUBLIC_TREES_CACHE_KEY);
        if (cachedTrees && Array.isArray(cachedTrees) && cachedTrees.length > 0) {
            allTrees = cachedTrees;
            isFromCache = true;
            renderResults();
        }
    }

    try {
        if (window.apiClient && window.apiClient.getPublicTrees) {
            const apiTrees = await window.apiClient.getPublicTrees({ view: 'summary', sort: 'latest', limit: 12 });
            if (!Array.isArray(apiTrees)) {
                throw new Error('API 응답 형식 오류');
            }

            if (cache) {
                cache.set(PUBLIC_TREES_CACHE_KEY, apiTrees, 5 * 60 * 1000);
            }
            if (!areTreesEffectivelySame(allTrees, apiTrees)) {
                allTrees = apiTrees;
            }
            apiTreesLoaded = true;
            renderResults();
        } else {
            throw new Error('tree API 사용 불가');
        }
    } catch (error) {
        loadError = error;
        console.warn('[search] API 로드 실패:', error.message);
        if (!allTrees || allTrees.length === 0) {
            allTrees = [];
        }
        renderResults();
    }

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
