/**
 * postgres-client.js
 * Client wrapper for LoveTree Netlify Functions (Neon PostgreSQL).
 * Exposes window.apiClient for fetching data from /api endpoints.
 * Provides API-first with mock-data.js fallback strategy.
 *
 * Responsibilities after separation:
 * - API surface composition
 * - Mock fallback wrapper (withFallback)
 * - Tree/Memory/Community/Browse sub-api composition
 * - Legacy test hooks
 *
 * Separated modules (must load before this file):
 * - js/api/auth-policy.js: Auth policy logic
 * - js/api/base-api-fetch.js: Token caching & fetch logic
 * - js/api/public-tree-adapter.js: Browse adapter (already separated)
 */
(function() {
const DEBUG = false;

const PublicTreeAdapter = window.LoveTreePublicTreeAdapter;
const BaseApiFetch = window.LoveTreeBaseApiFetch;
const AuthPolicy = window.LoveTreeAuthPolicy;

function isMockFallbackEnabled() {
return window.LoveBudRuntimeFlags?.isMockFallbackEnabled
? window.LoveBudRuntimeFlags.isMockFallbackEnabled()
: (
window.location.hostname === 'localhost' ||
window.location.hostname === '127.0.0.1' ||
window.location.search.includes('mock=1') ||
window.localStorage?.getItem('lovebud_force_mock') === '1'
);
}

async function withFallback(apiFn, mockFn, fnName) {
try {
const result = await apiFn();
if (DEBUG) console.log(`[apiClient] ${fnName} API success`);
return result;
} catch (error) {
const statusLikeError = /401|403|404|500|502|503|504|http error/i.test(error.message || '');

if (isMockFallbackEnabled()) {
console.warn(`[apiClient] ${fnName} API failed, using mock fallback:`, error.message);
return mockFn();
}

if (DEBUG || statusLikeError) {
console.error(`[apiClient] ${fnName} API failed (mock disabled):`, error.message);
}

throw error;
}
}

function getMockTrees() {
const trees = typeof getTrees === 'function' ? getTrees() : [];
return Array.isArray(trees) ? trees : [];
}

function getMockMemories() {
if (Array.isArray(window.memories)) return window.memories;
return typeof memories !== 'undefined' && Array.isArray(memories) ? memories : [];
}

function createTreeApi() {
return {
getTrees: async () => withFallback(
() => BaseApiFetch.apiFetch('/trees'),
() => getMockTrees(),
'getTrees'
),

getTree: async (treeId) => withFallback(
() => BaseApiFetch.apiFetch(`/trees/${treeId}`),
() => getMockTrees().find((tree) => tree.id === treeId) || null,
'getTree'
),

getFirstTree: async () => withFallback(
async () => {
const trees = await BaseApiFetch.apiFetch('/trees');
return Array.isArray(trees) && trees.length > 0 ? trees[0] : null;
},
() => {
const trees = getMockTrees();
return trees.length > 0 ? trees[0] : null;
},
'getFirstTree'
),

createTree: async (payload) => {
try {
return await BaseApiFetch.apiFetch('/trees', {
method: 'POST',
body: JSON.stringify(payload)
});
} catch (error) {
console.error('[apiClient] createTree failed:', error.message);
throw error;
}
},

updateTree: async (treeId, payload) => {
try {
return await BaseApiFetch.apiFetch('/trees/' + treeId, {
method: 'PUT',
body: JSON.stringify(payload)
});
} catch (error) {
console.error('[apiClient] updateTree failed:', error.message);
throw error;
}
},

deleteTree: async (treeId) => {
try {
return await BaseApiFetch.apiFetch('/trees/' + treeId, {
method: 'DELETE'
});
} catch (error) {
console.error('[apiClient] deleteTree failed:', error.message);
throw error;
}
}
};
}

function createMemoryApi() {
return {
getMemory: async (memoryId) => withFallback(
() => BaseApiFetch.apiFetch(`/memories/${memoryId}`),
() => (typeof getMemory === 'function' ? getMemory(memoryId) : null),
'getMemory'
),

getMemoriesByTree: async (treeId) => withFallback(
() => BaseApiFetch.apiFetch(`/memories?treeId=${encodeURIComponent(treeId)}`),
() => (typeof getMemoriesByTree === 'function' ? getMemoriesByTree(treeId) : []),
'getMemoriesByTree'
),

createMemory: async (payload) => {
try {
return await BaseApiFetch.apiFetch('/memories', {
method: 'POST',
body: JSON.stringify(payload)
});
} catch (error) {
console.error('[apiClient] createMemory failed (no mock fallback):', error.message);
throw error;
}
},

updateMemory: async (memoryId, payload) => {
try {
return await BaseApiFetch.apiFetch(`/memories/${memoryId}`, {
method: 'PUT',
body: JSON.stringify(payload)
});
} catch (error) {
console.error('[apiClient] updateMemory failed (no mock fallback):', error.message);
throw error;
}
},

deleteMemory: async (memoryId) => {
try {
return await BaseApiFetch.apiFetch(`/memories/${memoryId}`, {
method: 'DELETE'
});
} catch (error) {
console.error('[apiClient] deleteMemory failed (no mock fallback):', error.message);
throw error;
}
}
};
}

function createCommunityApi() {
return {
getCommunityMemories: async () => withFallback(
() => BaseApiFetch.apiFetch('/community/memories'),
() => getMockMemories().filter((memory) => memory.visibility === 'public' && memory.id !== 'root'),
'getCommunityMemories'
)
};
}

function createBrowseApi() {
return {
getPublicTrees: async () => withFallback(
async () => {
if (!PublicTreeAdapter) {
throw new Error('LoveTreePublicTreeAdapter not loaded');
}
const apiTrees = await BaseApiFetch.apiFetch('/community/trees');
const apiMemories = await BaseApiFetch.apiFetch('/community/memories');
return PublicTreeAdapter.buildPublicTreeViewModels(apiTrees, apiMemories);
},
() => {
const allMemories = getMockMemories();
const publicTrees = getMockTrees().filter((tree) => tree.visibility === 'public');
const grouped = {};

allMemories
.filter((memory) => memory.id !== 'root' && memory.visibility === 'public')
.forEach((memory) => {
const treeId = memory.treeId || 'ungrouped';
if (!grouped[treeId]) grouped[treeId] = [];
grouped[treeId].push(memory);
});

return publicTrees.map((tree) => {
const memoriesForTree = grouped[tree.id] || [];
const sortedMems = [...memoriesForTree].sort((a, b) =>
new Date(a.createdAt || a.timestamp || 0) - new Date(b.createdAt || b.timestamp || 0)
);
const allTags = sortedMems
.flatMap((memory) => (memory.emotionTags || memory.emotion_tags || []))
.filter(Boolean);
const uniqueTags = [...new Set(allTags)].slice(0, 3);
const timestamps = sortedMems.map((memory) => memory.timestamp).filter(Boolean);
const timeRange = timestamps.length >= 2
? `${timestamps[0]} ~ ${timestamps[timestamps.length - 1]}`
: (timestamps[0] || 'recently');

return {
...tree,
createdAt: tree.createdAt || tree.created_at || null,
ownerId: tree.ownerId || tree.owner_id || null,
memories: sortedMems,
memoryCount: sortedMems.length,
emotionTags: uniqueTags,
timeRange,
representativeThumbnail: sortedMems[0]?.thumbnail || '',
theme: sortedMems[0]?.artist || 'Mixed',
stage: sortedMems.length <= 2 ? '입덕' : (sortedMems.length <= 4 ? '성장' : '최애')
};
}).filter((tree) => tree.memoryCount > 0);
},
'getPublicTrees'
)
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
