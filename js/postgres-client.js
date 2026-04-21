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
        return {
            getCommunityMemories: async () => BaseApiFetch.apiFetch('/community/memories')
        };
    }

    function createBrowseApi() {
        return {
            getPublicTrees: async () => {
                if (!PublicTreeAdapter) {
                    throw new Error('LoveTreePublicTreeAdapter not loaded');
                }
                const apiTrees = await BaseApiFetch.apiFetch('/community/trees');
                const apiMemories = await BaseApiFetch.apiFetch('/community/memories');
                return PublicTreeAdapter.buildPublicTreeViewModels(apiTrees, apiMemories);
            }
        };
    }

    const treeApi = createTreeApi();
    const memoryApi = createMemoryApi();
    const communityApi = createCommunityApi();
    const browseApi = createBrowseApi();

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
