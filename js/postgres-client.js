/**
 * postgres-client.js
 * Client wrapper for LoveTree Netlify Functions (Neon PostgreSQL).
 * Exposes window.apiClient for fetching data from /api endpoints.
 *
 * STRICT API-ONLY VERSION
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

    function createCommunityApi() {
        let publicMemoriesCache = null;

        async function getCommunityMemories() {
            const memories = await BaseApiFetch.apiFetch('/community/memories');
            publicMemoriesCache = Array.isArray(memories) ? memories : [];
            return publicMemoriesCache;
        }

        async function getCachedCommunityMemories() {
            if (Array.isArray(publicMemoriesCache)) {
                return publicMemoriesCache;
            }
            return getCommunityMemories();
        }

        return {
            getCommunityMemories,
            getCachedCommunityMemories
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
                return PublicTreeAdapter.buildPublicTreeSummaryModels(apiTrees);
            },
            getPublicTreePreview: async (tree) => {
                if (!PublicTreeAdapter) {
                    throw new Error('LoveTreePublicTreeAdapter not loaded');
                }
                const apiMemories = await communityApi.getCachedCommunityMemories();
                return PublicTreeAdapter.hydrateTreeWithPublicMemories(tree, apiMemories);
            }
        };
    }

    const treeApi = createTreeApi();
    const memoryApi = createMemoryApi();
    const communityApi = createCommunityApi();
    const browseApi = createBrowseApi(communityApi);

    const apiClient = {
        ...treeApi,
        ...memoryApi,
        ...communityApi,
        ...browseApi
    };

    window.apiClient = apiClient;

    if (typeof window !== 'undefined') {
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
