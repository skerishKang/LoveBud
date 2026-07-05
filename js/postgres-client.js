(function() {
    const PublicTreeAdapter = window.LoveTreePublicTreeAdapter;
    const BaseApiFetch = window.LoveTreeBaseApiFetch;
    const AuthPolicy = window.LoveTreeAuthPolicy;

    function generateIdempotencyKey() {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(36).padStart(2, '0')).join('');
    }

    function addIdempotencyKey(options, key) {
        const idempotencyKey = key || generateIdempotencyKey();
        const headers = options.headers || {};
        headers['Idempotency-Key'] = idempotencyKey;
        return { ...options, headers };
    }

    function createTreeApi() {
        return {
            getTrees: async () => BaseApiFetch.apiFetch('/trees'),
            getTree: async (treeId) => BaseApiFetch.apiFetch(`/trees/${treeId}`),
            getPublicTree: async (treeId) => BaseApiFetch.apiFetch(`/trees/${treeId}`, { publicRead: true }),
            getFirstTree: async () => {
                const trees = await BaseApiFetch.apiFetch('/trees');
                return Array.isArray(trees) && trees.length > 0 ? trees[0] : null;
            },
            createTree: async (payload) => BaseApiFetch.apiFetch('/trees', { method: 'POST', body: JSON.stringify(payload) }),
            forkPublicTree: async (treeId) => BaseApiFetch.apiFetch(`/trees/${encodeURIComponent(treeId)}/fork`, { method: 'POST', body: JSON.stringify({}) }),
            updateTree: async (treeId, payload) => BaseApiFetch.apiFetch('/trees/' + treeId, { method: 'PUT', body: JSON.stringify(payload) }),
            deleteTree: async (treeId) => BaseApiFetch.apiFetch('/trees/' + treeId, { method: 'DELETE' })
        };
    }

    function createMemoryApi() {
        return {
            getMemory: async (memoryId) => BaseApiFetch.apiFetch(`/memories/${memoryId}`),
            getMemoriesByTree: async (treeId) => BaseApiFetch.apiFetch(`/memories?treeId=${encodeURIComponent(treeId)}`),
            createMemory: async (payload) => BaseApiFetch.apiFetch('/memories', { method: 'POST', body: JSON.stringify(payload) }),
            updateMemory: async (memoryId, payload) => BaseApiFetch.apiFetch(`/memories/${memoryId}`, { method: 'PUT', body: JSON.stringify(payload) }),
            deleteMemory: async (memoryId) => BaseApiFetch.apiFetch(`/memories/${memoryId}`, { method: 'DELETE' }),
            toggleReaction: async (memoryId, type = 'like', idempotencyKey) => {
                const options = { method: 'POST', body: JSON.stringify({ type }) };
                return BaseApiFetch.apiFetch(`/memories/${memoryId}/reactions`, addIdempotencyKey(options, idempotencyKey));
            },
            fetchReactionSummary: async (memoryId) => BaseApiFetch.apiFetch(`/memories/${memoryId}/reactions`),
            createComment: async (memoryId, body, idempotencyKey) => {
                const options = { method: 'POST', body: JSON.stringify({ body }) };
                return BaseApiFetch.apiFetch(`/memories/${memoryId}/comments`, addIdempotencyKey(options, idempotencyKey));
            },
            fetchComments: async (memoryId) => BaseApiFetch.apiFetch(`/memories/${memoryId}/comments`),
            fetchPublicMomentReactionSummary: async (treeId, memoryId) => BaseApiFetch.apiFetch(`/trees/${encodeURIComponent(treeId)}/memories/${encodeURIComponent(memoryId)}/reactions`, { publicRead: true }),
            fetchPublicMomentComments: async (treeId, memoryId) => BaseApiFetch.apiFetch(`/trees/${encodeURIComponent(treeId)}/memories/${encodeURIComponent(memoryId)}/comments`, { publicRead: true })
        };
    }

    function normalizeChannelMetadata(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const channelName = String(raw.channelName || '').trim();
        const channelUrl = String(raw.channelUrl || '').trim();
        if (!channelName || !channelUrl) return null;
        return {
            channelId: raw.channelId || null,
            channelName,
            channelUrl
        };
    }

    function createYouTubeApi() {
        return {
            getYouTubeOEmbedChannel: async (url) => {
                const rawUrl = String(url || '').trim();
                if (!rawUrl) return null;
                try {
                    const result = await BaseApiFetch.apiFetch(`/youtube/oembed?url=${encodeURIComponent(rawUrl)}`, {
                        publicRead: true
                    });
                    return normalizeChannelMetadata(result);
                } catch (e) {
                    return null;
                }
            }
        };
    }

    function enrichBrowseSummaryTree(rawTree, fallbackTree) {
        const tree = (fallbackTree && typeof fallbackTree === 'object') ? { ...fallbackTree } : {};
        const source = rawTree?.data || rawTree || {};

        const rawEmotionTags = Array.isArray(source.emotionTags)
            ? source.emotionTags
            : (Array.isArray(source.emotion_tags) ? source.emotion_tags : []);

        const rawThumb = source.representativeThumbnail || source.representative_thumbnail || source.thumbnail || tree.representativeThumbnail || '';
        const rawSource = source.sourceUrl || source.source_url || '';

        return {
            ...tree,
            representativeThumbnail: PublicTreeAdapter
                ? PublicTreeAdapter.canonicalizeYouTubeThumbnailUrl(rawThumb, rawSource)
                : rawThumb,
            emotionTags: rawEmotionTags.filter(Boolean).slice(0, 4),
            timeRange: source.timeRange || source.time_range || tree.timeRange || '기록 없음',
            theme: source.theme || tree.theme || '',
            stage: source.stage || tree.stage || '',
            memoryCount: Number.isFinite(Number(source.memoryCount || source.memory_count))
                ? Number(source.memoryCount || source.memory_count)
                : Number(tree.memoryCount || 0)
        };
    }

    function createCommunityApi() {
        let publicMemoriesCache = null;
        const publicMemoriesByTreeCache = new Map();

        async function getCommunityMemories(options = {}) {
            const params = new URLSearchParams();
            if (options.treeId) params.set('treeId', options.treeId);
            if (options.limit) params.set('limit', options.limit);
            const query = params.toString();
            const endpoint = '/community/memories' + (query ? `?${query}` : '');
            const memories = await BaseApiFetch.apiFetch(endpoint);
            const safeMemories = Array.isArray(memories) ? memories : [];

            if (options.treeId) {
                publicMemoriesByTreeCache.set(options.treeId, safeMemories);
            } else {
                publicMemoriesCache = safeMemories;
            }
            return safeMemories;
        }

        async function getCachedCommunityMemories(options = {}) {
            if (options.treeId) {
                if (publicMemoriesByTreeCache.has(options.treeId)) {
                    return publicMemoriesByTreeCache.get(options.treeId);
                }
                return getCommunityMemories({ treeId: options.treeId, limit: options.limit || 100 });
            }
            if (Array.isArray(publicMemoriesCache)) {
                return publicMemoriesCache;
            }
            return getCommunityMemories(options);
        }

        function clearCommunityCaches() {
            publicMemoriesCache = null;
            publicMemoriesByTreeCache.clear();
        }

        return {
            getCommunityMemories,
            getCachedCommunityMemories,
            clearCommunityCaches
        };
    }

    function createBrowseApi(communityApi) {
        return {
            getPublicTrees: async (options = {}) => {
                if (!PublicTreeAdapter) {
                    throw new Error('LoveTreePublicTreeAdapter not loaded');
                }

                let endpoint = '/community/trees';
                const params = new URLSearchParams();
                if (options.view) params.append('view', options.view);
                if (options.sort) params.append('sort', options.sort);
                if (options.limit) params.append('limit', options.limit);

                const qs = params.toString();
                if (qs) endpoint += '?' + qs;

                const apiTrees = await BaseApiFetch.apiFetch(endpoint);
                const baseModels = PublicTreeAdapter.buildPublicTreeSummaryModels(apiTrees);
                return baseModels.map((tree, index) => enrichBrowseSummaryTree(apiTrees[index], tree));
            },
            getPublicTreePreview: async (tree) => {
                if (!PublicTreeAdapter) {
                    throw new Error('LoveTreePublicTreeAdapter not loaded');
                }
                const apiMemories = await communityApi.getCachedCommunityMemories({ treeId: tree?.id, limit: 100 });
                return PublicTreeAdapter.hydrateTreeWithPublicMemories(tree, apiMemories);
            }
        };
    }

    function mergeApiGroupsWithCollisionWarning(groups) {
        const merged = {};
        const owners = {};

        groups.forEach((group) => {
            const groupName = group.name;
            const api = group.api || {};

            Object.keys(api).forEach((key) => {
                if (Object.prototype.hasOwnProperty.call(merged, key) && typeof console !== 'undefined' && console.warn) {
                    console.warn(
                        `[apiClient] Duplicate API method "${key}" from ${owners[key]} overwritten by ${groupName}.`
                    );
                }

                merged[key] = api[key];
                owners[key] = groupName;
            });
        });

        return merged;
    }

    function shouldExposeApiClientInternals() {
        if (typeof window === 'undefined' || !window.location) return false;
        const hostname = window.location.hostname || '';
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    }

    const treeApi = createTreeApi();
    const memoryApi = createMemoryApi();
    const communityApi = createCommunityApi();
    const browseApi = createBrowseApi(communityApi);
    const youtubeApi = createYouTubeApi();

    const apiClient = mergeApiGroupsWithCollisionWarning([
        { name: 'treeApi', api: treeApi },
        { name: 'memoryApi', api: memoryApi },
        { name: 'communityApi', api: communityApi },
        { name: 'browseApi', api: browseApi },
        { name: 'youtubeApi', api: youtubeApi }
    ]);

    const base = memoryApi;
    apiClient.fetchPublicMomentReactionSummary = base.fetchPublicMomentReactionSummary;
    apiClient.fetchPublicMomentComments = base.fetchPublicMomentComments;

    window.apiClient = apiClient;

    if (shouldExposeApiClientInternals()) {
        window.__LoveBudApiClientInternals = {
            endpointLikelyRequiresAuth: AuthPolicy?.endpointLikelyRequiresAuth,
            getAuthWaitAttempts: AuthPolicy?.getAuthWaitAttempts,
            hasConfirmedAuthSession: AuthPolicy?.hasConfirmedAuthSession,
            unwrapTreeRecord: PublicTreeAdapter?.unwrapTreeRecord,
            unwrapMemoryRecord: PublicTreeAdapter?.unwrapMemoryRecord,
            getRecordTreeId: PublicTreeAdapter?.getRecordTreeId,
            normalizeBrowseTreeRecord: PublicTreeAdapter?.normalizeBrowseTreeRecord,
            normalizeBrowseMemoryRecord: PublicTreeAdapter?.normalizeBrowseMemoryRecord,
            normalizeChannelMetadata,
            generateIdempotencyKey,
            addIdempotencyKey,
        };
    }
})();
