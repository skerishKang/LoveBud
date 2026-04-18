/**
 * LoveBud Search Page Orchestrator
 * v20260418-1
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
                if (JSON.stringify(allTrees) !== JSON.stringify(apiTrees)) {
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
        if (
            !cachedTrees &&
            isMockFallbackEnabled() &&
            typeof memories !== 'undefined' &&
            typeof trees !== 'undefined'
        ) {
            allTrees = Adapter.buildTreeData(memories, trees);
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

    // ─────────────────────────────────────────────────────────
    // Event Handlers
    // ─────────────────────────────────────────────────────────

    const navigateToTreeDetail = (tree) => {
        if (!tree?.memories || tree.memories.length === 0) return;

        const basePath = window.LoveBudPath?.getBasePath
            ? window.LoveBudPath.getBasePath()
            : (window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/');

        const firstMemory = tree.memories[0];
        window.location.href = `${basePath}detail.html?id=${firstMemory.id}&tree=${tree.id}&from=browse`;
    };

    const showTreePreview = (tree) => {
        if (!tree) return;
        PreviewRenderer.updatePreview(tree);
    };

    // Search input
    searchInput.addEventListener('input', (e) => {
        currentQuery = e.target.value.trim();
        renderResults();
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
            <div class="empty-state" style="padding:24px;text-align:center;">
                <h3 style="margin-bottom:8px;">데이터를 불러오지 못했어요</h3>
                <p style="margin-bottom:16px;color:var(--on-surface-variant);">
                    서버 연결 또는 인증 상태를 확인한 뒤 다시 시도해주세요.
                </p>
                <button type="button" id="retryLoadBtn" class="primary-btn">다시 시도</button>
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
                resultsList.innerHTML = CardRenderer.renderNoTreesState();
                PreviewRenderer.resetPreview();
            } else {
                resultsList.innerHTML = CardRenderer.renderEmptySearchState();
                PreviewRenderer.resetPreview();
            }

            return;
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

            card.addEventListener('click', () => {
                navigateToTreeDetail(tree);
            });

            card.addEventListener('mouseenter', () => {
                showTreePreview(tree);
            });
        });

        // Auto-select first tree preview
        if (filtered.length > 0) {
            showTreePreview(filtered[0]);
        }
    };

    // ─────────────────────────────────────────────────────────
    // Initial Render
    // ─────────────────────────────────────────────────────────

    renderResults();
});

// End of search.js orchestrator
