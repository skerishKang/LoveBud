/**
 * postgres-client.js
 * Browser-side API client for LoveBud.
 *
 * Current runtime truth:
 * - official frontend entry: Cloudflare Pages (`lovebud.pages.dev`)
 * - browser contract: call same-origin `/api/*`
 * - routing behind `/api/*` may hit Cloudflare Pages functions directly,
 *   or pass through transitional adapters such as Vercel / Netlify during fallback
 * - direct browser-to-database access remains disabled
 *
 * The browser should stay deployment-agnostic and only rely on same-origin `/api/*`.
 */
(function() {
    const PublicTreeAdapter = window.LoveTreePublicTreeAdapter;
    const BaseApiFetch = window.LoveTreeBaseApiFetch;
    const AuthPolicy = window.LoveTreeAuthPolicy;

    function createTreeApi() {
        return {
            getTrees: async () => BaseApiFetch.apiFetch('/trees'),
            getTree: async (treeId) => BaseApiFetch.apiFetch(`/trees/${treeId}`),
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
            deleteMemory: async (memoryId) => BaseApiFetch.apiFetch(`/memories/${memoryId}`, { method: 'DELETE' })
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

    const apiClient = mergeApiGroupsWithCollisionWarning([
        { name: 'treeApi', api: treeApi },
        { name: 'memoryApi', api: memoryApi },
        { name: 'communityApi', api: communityApi },
        { name: 'browseApi', api: browseApi }
    ]);

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
        };
    }
})();
