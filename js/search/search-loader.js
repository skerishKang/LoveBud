window.LoveBudSearchLoader = {
    PUBLIC_TREES_CACHE_KEY: 'public_trees_summary_latest_10',
    PREVIEW_CACHE_TTL_MS: 5 * 60 * 1000,

    getPreviewCacheKey(treeId) {
        return `public_tree_preview_${treeId}`;
    },

    readPreviewCache(treeId) {
        if (!treeId) return null;
        try {
            const cached = localStorage.getItem(this.getPreviewCacheKey(treeId));
            if (!cached) return null;
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp > this.PREVIEW_CACHE_TTL_MS) {
                localStorage.removeItem(this.getPreviewCacheKey(treeId));
                return null;
            }
            return parsed.data;
        } catch (e) {
            return null;
        }
    },

    writePreviewCache(treeId, data) {
        if (!treeId || !data) return;
        try {
            localStorage.setItem(this.getPreviewCacheKey(treeId), JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        } catch (e) { /* ignore */ }
    },

    async fetchPublicTrees(params) {
        if (!window.LoveTreeBaseApiFetch || typeof window.LoveTreeBaseApiFetch.apiFetch !== 'function') {
            throw new Error('API fetch layer not available');
        }

        const queryParams = new URLSearchParams();
        if (params.query) queryParams.set('q', params.query);
        if (params.category && params.category !== '전체') queryParams.set('category', params.category);
        if (params.sort) queryParams.set('sort', params.sort);
        if (params.limit) queryParams.set('limit', params.limit);

        const url = `/community/public-trees?${queryParams.toString()}`;
        return await window.LoveTreeBaseApiFetch.apiFetch(url);
    },

    async fetchTreeDetail(treeId) {
        if (!window.LoveTreeBaseApiFetch || typeof window.LoveTreeBaseApiFetch.apiFetch !== 'function') {
            throw new Error('API fetch layer not available');
        }

        // Try cache first
        const cached = this.readPreviewCache(treeId);
        if (cached) return cached;

        const data = await window.LoveTreeBaseApiFetch.apiFetch(`/community/public-trees/${treeId}`);
        if (data) {
            this.writePreviewCache(treeId, data);
        }
        return data;
    },

    async hydratePreview(tree, UI) {
        if (!tree || !UI) return;

        const State = window.LoveBudSearchState;
        const requestId = ++State.currentPreviewRequestId;

        UI.showPreviewLoading();
        UI.setPreviewMobileState(true);

        try {
            const treeData = await this.fetchTreeDetail(tree.id);

            // Race guard: only update if this is still the most recent request
            if (requestId !== State.currentPreviewRequestId) {
                console.log('Preview hydration race guard: ignoring stale response');
                return;
            }

            UI.renderPreviewContent(tree, treeData);
        } catch (error) {
            if (requestId === State.currentPreviewRequestId) {
                console.error('Failed to hydrate preview:', error);
                UI.renderPreviewContent(null, null);
            }
        }
    },

    async loadPublicTrees(renderResultsCallback) {
        const State = window.LoveBudSearchState;
        const UI = window.LoveBudSearchUI;

        if (UI) UI.showLoading(true);
        if (UI) UI.showError('');

        try {
            const apiResponse = await this.fetchPublicTrees({
                query: State.currentQuery,
                category: State.currentCategory,
                sort: State.currentSort,
                limit: State.currentLimit
            });

            const rawTrees = Array.isArray(apiResponse) ? apiResponse : (apiResponse?.data || []);
            const baseModels = window.LoveTreePublicTreeAdapter.buildPublicTreeSummaryModels(rawTrees);

            State.allTrees = baseModels;

            if (State.isInitialLoad && !State.currentQuery && State.currentCategory === '전체' && State.currentSort === 'latest') {
                try {
                    localStorage.setItem(this.PUBLIC_TREES_CACHE_KEY, JSON.stringify({
                        timestamp: Date.now(),
                        data: baseModels
                    }));
                } catch (e) { /* ignore */ }
            }

            if (typeof renderResultsCallback === 'function') renderResultsCallback();
        } catch (error) {
            console.error('Search failed:', error);
            if (UI) UI.showError('데이터를 불러오지 못했습니다.');
            State.allTrees = [];
            if (typeof renderResultsCallback === 'function') renderResultsCallback();
        } finally {
            if (UI) UI.showLoading(false);
            State.isInitialLoad = false;
        }
    },

    async loadGrowingTrees(renderGrowingResultsCallback) {
        if (!window.LoveTreeBaseApiFetch || typeof window.LoveTreeBaseApiFetch.apiFetch !== 'function') return;

        try {
            const apiResponse = await window.LoveTreeBaseApiFetch.apiFetch('/community/growing-trees?limit=3');
            const rawTrees = Array.isArray(apiResponse) ? apiResponse : (apiResponse?.data || []);
            const baseModels = window.LoveTreePublicTreeAdapter.buildPublicTreeSummaryModels(rawTrees);
            const State = window.LoveBudSearchState;
            State.growingTrees = baseModels.map((tree, index) => {
                const raw = rawTrees[index]?.data || rawTrees[index] || {};
                const rawEmotionTags = Array.isArray(raw.emotionTags) ? raw.emotionTags : (Array.isArray(raw.emotion_tags) ? raw.emotion_tags : []);
                return {
                    ...tree,
                    emotionTags: rawEmotionTags
                };
            });
            if (typeof renderGrowingResultsCallback === 'function') renderGrowingResultsCallback();
        } catch (error) {
            console.error('Failed to load growing trees:', error);
            const State = window.LoveBudSearchState;
            State.growingTrees = [];
            if (typeof renderGrowingResultsCallback === 'function') renderGrowingResultsCallback();
        }
    }
};
