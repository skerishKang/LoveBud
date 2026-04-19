/**
 * postgres-client.js
 * Client wrapper for LoveTree Netlify Functions (Neon PostgreSQL).
 * Exposes window.apiClient for fetching data from /api endpoints.
 * Provides API-first with mock-data.js fallback strategy.
 *
 * Responsibilities after separation:
 * - API surface (public methods)
 * - Mock fallback wrapper (withFallback)
 * - Public tree adapter integration
 * - Legacy test hooks
 *
 * Separated modules (must load before this file):
 * - js/api/auth-policy.js: Auth policy logic
 * - js/api/base-api-fetch.js: Token caching & fetch logic
 * - js/api/public-tree-adapter.js: Browse adapter (already separated)
 */
(function() {
const DEBUG = false;

// Module references - loaded before this file
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

/**
 * API 호출 실패 시 mock-data.js로 fallback wrapper
 * @param {Function} apiFn - API 호출 함수
 * @param {Function} mockFn - fallback mock 함수
 * @param {string} fnName - 함수명 (로깅용)
 */
async function withFallback(apiFn, mockFn, fnName) {
try {
const result = await apiFn();
if (DEBUG) console.log(`[apiClient] ${fnName} API success`);
return result;
} catch (error) {
const statusLikeError =
/401|403|404|500|502|503|504|http error/i.test(error.message || '');

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

// API Client Interface with mock fallback
const apiClient = {
/**
 * 1. Fetch all trees
 * API 우선, 실패 시 mock-data.js의 getTrees() fallback
 */
getTrees: async () => {
return withFallback(
() => BaseApiFetch.apiFetch('/trees'),
() => {
const trees = typeof getTrees === 'function' ? getTrees() : [];
return Array.isArray(trees) ? trees : [];
},
'getTrees'
);
},

/**
 * 2. Fetch a specific tree
 * API 우선, 실패 시 mock-data.js에서 treeId 매칭 fallback
 */
getTree: async (treeId) => {
return withFallback(
() => BaseApiFetch.apiFetch(`/trees/${treeId}`),
() => {
const trees = typeof getTrees === 'function' ? getTrees() : [];
const found = trees.find(t => t.id === treeId);
return found || null;
},
'getTree'
);
},

/**
 * 3. Fetch community memories
 * API 우선, 실패 시 mock-data.js의 public memories fallback
 * root는 목록에서 제외 (실제 카드형 memory만)
 */
getCommunityMemories: async () => {
return withFallback(
() => BaseApiFetch.apiFetch('/community/memories'),
() => {
const all = typeof memories !== 'undefined' ? memories : [];
// mock에서 public만 필터링, root는 제외
return all.filter(m => m.visibility === 'public' && m.id !== 'root');
},
'getCommunityMemories'
);
},

/**
 * 4. Create a new memory
 * API 필수 (mock에는 create 기능 없음)
 * 실패 시 에러를 throw하여 UI에서 처리
 */
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

/**
 * 4-1. Update an existing memory
 * API 필수 (mock에는 update 기능 없음)
 * 실패 시 에러를 throw하여 UI에서 처리
 */
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

/**
 * 4-2. Delete a memory
 * API 필수 (mock에는 delete 기능 없음)
 * 실패 시 에러를 throw하여 UI에서 처리
 */
deleteMemory: async (memoryId) => {
try {
return await BaseApiFetch.apiFetch(`/memories/${memoryId}`, {
method: 'DELETE'
});
} catch (error) {
console.error('[apiClient] deleteMemory failed (no mock fallback):', error.message);
throw error;
}
},

/**
 * 5. Get memory by ID (detail 화면용)
 * API 우선: GET /api/memories/:memoryId 직접 호출
 * 실패 시 mock fallback
 */
getMemory: async (memoryId) => {
return withFallback(
async () => {
return await BaseApiFetch.apiFetch(`/memories/${memoryId}`);
},
() => {
return typeof getMemory === 'function' ? getMemory(memoryId) : null;
},
'getMemory'
);
},

/**
 * 6. Get memories by tree (detail 화면의 형제 메모리용)
 * API 우선: GET /api/memories?treeId=... 호출
 * 실패 시 mock fallback
 */
getMemoriesByTree: async (treeId) => {
return withFallback(
async () => {
return await BaseApiFetch.apiFetch(`/memories?treeId=${encodeURIComponent(treeId)}`);
},
() => {
return typeof getMemoriesByTree === 'function'
? getMemoriesByTree(treeId)
: [];
},
'getMemoriesByTree'
);
},

/**
 * 7. Get first tree for current user (editor/detail 초기 로드용)
 * 현재 API는 /api/trees 전체 목록 반환, 첫 번째 선택
 */
getFirstTree: async () => {
return withFallback(
async () => {
const trees = await BaseApiFetch.apiFetch('/trees');
return Array.isArray(trees) && trees.length > 0 ? trees[0] : null;
},
() => {
const trees = typeof getTrees === 'function' ? getTrees() : [];
return Array.isArray(trees) && trees.length > 0 ? trees[0] : null;
},
'getFirstTree'
);
},

/**
 * 8. Fetch public trees only (search/둘러보기 화면용)
 * API 우선, 실패 시 mock-data.js의 public trees fallback
 * Note: browse용 tree view model을 반환 (memories, emotionTags, theme 등 포함)
 * Updated: combines /community/trees + /community/memories to build view model
 *
 * Transitional contract note:
 * - target response shape is flat camelCase
 * - current runtime still accepts legacy `{ id, data }` wrappers and snake_case fields
 * - this compatibility is migration-only and should be removed once
 * /community/trees and /community/memories are confirmed to return flat camelCase only
 */
getPublicTrees: async () => {
return withFallback(
async () => {
if (!PublicTreeAdapter) {
throw new Error('LoveTreePublicTreeAdapter not loaded');
}
const apiTrees = await BaseApiFetch.apiFetch('/community/trees');
const apiMemories = await BaseApiFetch.apiFetch('/community/memories');
return PublicTreeAdapter.buildPublicTreeViewModels(apiTrees, apiMemories);
},
() => {
const allMemories = typeof memories !== 'undefined' ? memories : [];
const trees = typeof getTrees === 'function' ? getTrees() : [];
const publicTrees = trees.filter((t) => t.visibility === 'public');

const grouped = {};
allMemories
.filter((m) => m.id !== 'root' && m.visibility === 'public')
.forEach((m) => {
const tid = m.treeId || 'ungrouped';
if (!grouped[tid]) grouped[tid] = [];
grouped[tid].push(m);
});

return publicTrees.map((tree) => {
const mems = grouped[tree.id] || [];
const sortedMems = [...mems].sort((a, b) =>
new Date(a.createdAt || a.timestamp || 0) - new Date(b.createdAt || b.timestamp || 0)
);
const allTags = sortedMems
.flatMap((m) => (m.emotionTags || m.emotion_tags || []))
.filter(Boolean);
const uniqueTags = [...new Set(allTags)].slice(0, 3);
const timestamps = sortedMems.map((m) => m.timestamp).filter(Boolean);
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
}).filter((t) => t.memoryCount > 0);
},
'getPublicTrees'
);
},

/**
 * 9. Create a new tree (신규 사용자 첫 트리 생성용)
 * API 필수 (mock에는 create 기능 없음)
 */
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

/**
 * 10. Update tree (이름 변경 등)
 * @param {string} treeId - 트리 ID
 * @param {Object} payload - { title, visibility } 등 변경할 필드
 */
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

/**
 * 11. Delete tree (트리 삭제)
 * @param {string} treeId - 트리 ID
 */
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

// Expose as a global object
window.apiClient = apiClient;

// Legacy test hook name retained for compatibility.
// Auth policy and tree/memory adapters moved to js/api/
if (typeof window !== 'undefined') {
window.__LoveBudApiClientInternals = {
endpointLikelyRequiresAuth: AuthPolicy.endpointLikelyRequiresAuth,
getAuthWaitAttempts: AuthPolicy.getAuthWaitAttempts,
hasConfirmedAuthSession: AuthPolicy.hasConfirmedAuthSession,
unwrapTreeRecord: PublicTreeAdapter.unwrapTreeRecord,
unwrapMemoryRecord: PublicTreeAdapter.unwrapMemoryRecord,
getRecordTreeId: PublicTreeAdapter.getRecordTreeId,
normalizeBrowseTreeRecord: PublicTreeAdapter.normalizeBrowseTreeRecord,
normalizeBrowseMemoryRecord: PublicTreeAdapter.normalizeBrowseMemoryRecord,
};
}

})();