/**
 * LoveBud Search Page Orchestrator
 * v20260421-2
 *
 * Search page orchestration:
 * - Data loading (cache → API → mock fallback)
 * - Filter state management
 * - Event binding
 * - Renderer coordination
 *
 * Dependencies (loaded before this):
 * - mock-data.js, cache-utils.js
 * - utils/normalize.js, utils/path.js, utils/ui.js
 * - search-data-adapter.js, search-card-renderer.js, search-preview-renderer.js
 * - postgres-client.js
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ─────────────────────────────────────────────────────────
    // DOM References
    // ─────────────────────────────────────────────────────────

    const resultsList = document.getElementById('resultsList');
    const previewContainer = document.getElementById('previewVideoContainer');
    const previewTitle = document.getElementById('previewTitle');
    const previewDesc = document.getElementById('previewDesc');
    const previewMemoriesCount = document.getElementById('previewMemoriesCount');
    const previewTreeDuration = document.getElementById('previewTreeDuration');
    const previewEmotionTags = document.getElementById('previewEmotionTags');
    const searchInput = document.getElementById('searchInput');
    const tagChips = document.querySelectorAll('.tag-chip');

    // ─────────────────────────────────────────────────────────
    // Initialize Renderers
    // ─────────────────────────────────────────────────────────

    // Card renderer
    const CardRenderer = window.LoveBudSearchCardRenderer;
    CardRenderer.init(resultsList);

    // Preview renderer
    const PreviewRenderer = window.LoveBudSearchPreviewRenderer;
    PreviewRenderer.init({
        previewContainer,
        previewTitle,
        previewDesc,
        previewMemoriesCount,
        previewTreeDuration,
        previewEmotionTags
    });

    // Adapter (data layer)
    const Adapter = window.LoveBudSearchAdapter;

    // ─────────────────────────────────────────────────────────
    // Show Loading
    // ─────────────────────────────────────────────────────────

    resultsList.innerHTML = CardRenderer.renderLoading();

    // ─────────────────────────────────────────────────────────
    // Data Loading: Cache → API → Mock Fallback
    // ─────────────────────────────────────────────────────────

    const cache = window.LoveBudCache;
    const PUBLIC_TREES_CACHE_KEY = 'public_trees_list';
    const MIN_LOADING_TIME = 400;
    const isMockFallbackEnabled = () =>
        window.LoveBudRuntimeFlags?.isMockFallbackEnabled
            ? window.LoveBudRuntimeFlags.isMockFallbackEnabled()
            : (
                  window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  window.location.search.includes('mock=1') ||
                  window.localStorage?.getItem('lovebud_force_mock') === '1'
              );

    const startTime = Date.now();
    let allTrees = [];
    let loadError = null;
    let isFromCache = false;
    let selectedTreeId = null;

    // Shallow comparison helper to avoid unnecessary re-renders
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

    // 1. Try cache first
    let cachedTrees = null;
    if (cache) {
        cachedTrees = cache.get(PUBLIC_TREES_CACHE_KEY);
        if (cachedTrees && Array.isArray(cachedTrees) && cachedTrees.length > 0) {
            console.log('[search] 캐시된 public trees 사용:', cachedTrees.length, '개');
            allTrees = cachedTrees;
            isFromCache = true;
        }
    }

    // 2. Fetch from API in background
    let apiTreesLoaded = false;
    try {
        if (window.apiClient && window.apiClient.getPublicTrees) {
            const apiTrees = await window.apiClient.getPublicTrees();
            if (Array.isArray(apiTrees)) {
                console.log('[search] API public trees 로드:', apiTrees.length, '개');

                // Update cache
                if (cache) {
                    cache.set(PUBLIC_TREES_CACHE_KEY, apiTrees, 5 * 60 * 1000); // 5분 TTL
                }

                // Use API data (replace cache)
                if (!areTreesEffectivelySame(allTrees, apiTrees)) {
                    allTrees = apiTrees;
                }

                apiTreesLoaded = true;
            } else {
                throw new Error('API 응답 형식 오류');
            }
        } else {
            throw new Error('tree API 사용 불가');
        }
    } catch (error) {
        loadError = error;
        console.warn('[search] API 실패:', error.message);

        // 개발/데모 모드에서만 mock fallback 허용
        const mockMemories = Array.isArray(window.memories)
            ? window.memories
            : (typeof memories !== 'undefined' && Array.isArray(memories) ? memories : null);
        const mockTrees = Array.isArray(window.trees)
            ? window.trees
            : (typeof trees !== 'undefined' && Array.isArray(trees) ? trees : null);

        if (
            !cachedTrees &&
            isMockFallbackEnabled() &&
            mockMemories &&
            mockTrees
        ) {
            allTrees = Adapter.buildTreeData(mockMemories, mockTrees);
            console.log('[search] mock 데이터 fallback:', allTrees.length, '개 트리');
        } else if (!cachedTrees) {
            allTrees = [];
        }
    }

    // 4. Ensure minimum loading time (prevents flash)
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_LOADING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
    }

    // ─────────────────────────────────────────────────────────
    // Filter State
    // ─────────────────────────────────────────────────────────

    let currentQuery = '';
    let currentCategory = '전체';

    /**
     * Gets filtered trees
     */
    const getFilteredTrees = () => {
        return Adapter.filterTrees(allTrees, currentQuery, currentCategory);
    };

    const getSelectedTree = (filteredTrees) => {
        if (!Array.isArray(filteredTrees) || filteredTrees.length === 0) return null;
        const matched = filteredTrees.find(tree => tree.id === selectedTreeId);
        return matched || filteredTrees[0];
    };

    // ─────────────────────────────────────────────────────────
    // Event Handlers
    // ─────────────────────────────────────────────────────────

    const selectTree = (tree, activeCard) => {
        if (!tree) return;
        selectedTreeId = tree.id;
        markActiveCard(activeCard);
        showTreePreview(tree);
    };

    const showTreePreview = (tree) => {
        if (!tree) return;
        PreviewRenderer.updatePreview(tree);
    };

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

    // Search input with debounce
    let searchInputTimer = null;
    searchInput.addEventListener('input', (e) => {
        currentQuery = e.target.value.trim();

        if (searchInputTimer) {
            clearTimeout(searchInputTimer);
        }

        searchInputTimer = setTimeout(() => {
            renderResults();
        }, 200);
    });

    // Filter chips
    tagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            tagChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.dataset.category || chip.textContent.trim();
            renderResults();
        });
    });

    /**
     * Renders empty/error state when data load fails
     */
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

    /**
     * Renders results to DOM
     */
    const renderResults = () => {
        const filtered = getFilteredTrees();

        if (filtered.length === 0) {
            const hasNoData = loadError === null && allTrees.length === 0;
            const isApiFailureWithoutFallback =
                loadError !== null &&
                !isFromCache &&
                !isMockFallbackEnabled() &&
                allTrees.length === 0;

            if (isApiFailureWithoutFallback) {
                renderLoadErrorState();
            } else if (hasNoData) {
                // 공개 트리가 0개인 상태 (API 정상, 데이터 없음)
                resultsList.innerHTML = CardRenderer.renderNoTreesState();
                PreviewRenderer.resetPreview();
            } else {
                // 검색 결과 없음 (필터링 결과 0개)
                resultsList.innerHTML = CardRenderer.renderEmptySearchState();
                PreviewRenderer.resetPreview();
            }

            return;
        }

        const selectedTree = getSelectedTree(filtered);
        if (selectedTree) {
            selectedTreeId = selectedTree.id;
        }

        // Render cards (no event handlers passed)
        const html = CardRenderer.renderResults(filtered, {
            isDemo: !apiTreesLoaded && !loadError
        });

        resultsList.innerHTML = html;

        // Attach events to cards
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

        const activeCard = Array.from(cards).find(card => card.dataset.treeId === selectedTreeId) || cards[0];
        markActiveCard(activeCard);
        showTreePreview(selectedTree || filtered[0]);
    };

    // ─────────────────────────────────────────────────────────
    // Initial Render
    // ─────────────────────────────────────────────────────────

    renderResults();
});

// End of search.js orchestrator
