/**
 * postgres-client.js
 * Client wrapper for LoveBud Netlify Functions (Neon PostgreSQL).
 * Exposes window.apiClient for fetching data from /api endpoints.
 * Provides API-first with mock-data.js fallback strategy.
 */
(function() {
const API_BASE = '/api';
const DEBUG = false;
const AUTH_TOKEN_KEY = 'lovebud_auth_token';
const AUTH_CONFIRMED_KEY = 'lovebud_auth_confirmed';
const AUTH_CACHE_KEY = 'lovebud_auth_cache';

// Auth wait settings - shared with auth-firebase.js
const AUTH_WAIT_MS =
  typeof window.__LOVEBUD_AUTH_WAIT_MS === 'number' &&
  window.__LOVEBUD_AUTH_WAIT_MS > 0
    ? window.__LOVEBUD_AUTH_WAIT_MS
    : 2000;

const AUTH_POLL_INTERVAL_MS = 100;

function getAuthWaitAttempts(forceLongWait) {
  const shouldLongWait = forceLongWait || shouldWaitLongerForAuth();
  if (!shouldLongWait) {
    return Math.max(1, Math.floor(500 / AUTH_POLL_INTERVAL_MS));
  }
  return Math.max(1, Math.floor(AUTH_WAIT_MS / AUTH_POLL_INTERVAL_MS));
}

function getCachedAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw || raw === 'null') return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.uid ? parsed : null;
  } catch (e) {
    return null;
  }
}

function hasConfirmedAuthSession() {
  try {
    if (localStorage.getItem(AUTH_CONFIRMED_KEY) !== 'true') return false;
    return !!getCachedAuthUser();
  } catch (e) {
    return false;
  }
}

function shouldWaitLongerForAuth() {
  try {
    if (hasConfirmedAuthSession()) return true;
    if (window.__lovebudAuthReady === true) return false;
    if (typeof firebase !== 'undefined' && firebase.auth) return true;
  } catch (e) {}
  return false;
}

function endpointLikelyRequiresAuth(endpoint) {
  return !String(endpoint || '').startsWith('/community/');
}

async function waitForAuthToken(extraMs) {
  const waitMs = Number(extraMs || 0);
  if (waitMs <= 0) return;
  await new Promise(resolve => setTimeout(resolve, waitMs));
}

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

    // Cache helpers for confirmed session
    function getCachedTokenRecord() {
        try {
            const raw = localStorage.getItem(AUTH_TOKEN_KEY);
            if (!raw || raw === 'null') return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.token || !parsed.expiresAt) return null;
            if (Date.now() >= Number(parsed.expiresAt) - 30000) return null;
            return parsed;
        } catch (e) {
            return null;
        }
    }

    function setCachedTokenRecord(user, tokenResult) {
        try {
            if (!user || !user.uid || !tokenResult || !tokenResult.token) return;
            localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify({
                uid: user.uid,
                token: tokenResult.token,
                expiresAt: new Date(tokenResult.expirationTime).getTime()
            }));
        } catch (e) {}
    }

    // Helper to get Firebase Auth Token with retry - cached token first
    async function getAuthHeaders(options = {}) {
        const headers = {
            'Content-Type': 'application/json'
        };

        // 1. 먼저 cached token이 유효한지 확인
        const cachedToken = getCachedTokenRecord();
        if (cachedToken && cachedToken.token) {
            headers['Authorization'] = `Bearer ${cachedToken.token}`;
            if (DEBUG) console.log('[apiClient] Using cached auth token');
            return headers;
        }

        // 2. Firebase/Auth 준비를 기다림
        // - 기본은 짧게
        // - confirmed auth cache 또는 auth init 진행 정황이 있으면 더 길게 대기
        let attempts = 0;
        const AUTH_READY_FLAG = '__lovebudAuthReady';
        const forceLongWait = !!options.forceLongWait;
        const maxAttempts = getAuthWaitAttempts(forceLongWait);

        while (attempts < maxAttempts) {
            const nextCachedToken = getCachedTokenRecord();
            if (nextCachedToken && nextCachedToken.token) {
                headers['Authorization'] = `Bearer ${nextCachedToken.token}`;
                if (DEBUG) console.log('[apiClient] Using refreshed cached auth token');
                return headers;
            }
            if (window[AUTH_READY_FLAG] && window.firebase && firebase.auth) {
                const user = firebase.auth().currentUser;
                if (user) {
                    try {
                        const tokenResult = typeof user.getIdTokenResult === 'function' ? await user.getIdTokenResult() : null;
                        const token = tokenResult ? tokenResult.token : await user.getIdToken();
                        if (token) {
                            headers['Authorization'] = `Bearer ${token}`;
                            if (tokenResult) setCachedTokenRecord(user, tokenResult);
                            if (DEBUG) console.log(`[apiClient] Auth token acquired on attempt ${attempts + 1}`);
                            return headers;
                        }
                    } catch (error) {
                        console.warn('[apiClient] Failed to get Firebase Auth token:', error);
                        break;
                    }
                } else {
                    // auth ready but no actual user
                    if (DEBUG) console.log(`[apiClient] Auth ready but no user found on attempt ${attempts + 1}`);
                    return headers;
                }
            }
            await new Promise(resolve => setTimeout(resolve, AUTH_POLL_INTERVAL_MS));
            attempts++;
        }

        if (DEBUG) console.warn('[apiClient] Auth headers fallback to public (max attempts reached)');
        return headers;
    }

    // Core fetch logic with error handling
    async function apiFetch(endpoint, options = {}) {
        const authHeaders = await getAuthHeaders();
        const hadAuthHeader = !!authHeaders.Authorization;
        const buildConfig = (baseHeaders) => ({
            ...options,
            headers: {
                ...baseHeaders,
                ...options.headers
            }
        });
        let config = buildConfig(authHeaders);

        try {
            let response = await fetch(`${API_BASE}${endpoint}`, config);

            // If a private-looking endpoint failed without Authorization, and we have
            // confirmed-auth signals locally, wait once more for token readiness and retry.
            if (
                (response.status === 401 || response.status === 403) &&
                !hadAuthHeader &&
                endpointLikelyRequiresAuth(endpoint) &&
                hasConfirmedAuthSession()
            ) {
                if (DEBUG) {
                    console.warn(`[apiClient] ${endpoint} got ${response.status} without auth header; retrying after auth wait`);
                }
                await waitForAuthToken(Math.min(1200, AUTH_WAIT_MS));
                const retryHeaders = await getAuthHeaders({ forceLongWait: true });
                if (retryHeaders.Authorization) {
                    config = buildConfig(retryHeaders);
                    response = await fetch(`${API_BASE}${endpoint}`, config);
                }
            }

            if (!response.ok) {
                let errorMsg = `HTTP Error ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) {
                    // Response is not JSON
                }
                throw new Error(errorMsg);
            }

            return await response.json();
        } catch (error) {
            console.error(`[apiClient] API fetch failed for ${endpoint}:`, error.message);
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
                () => apiFetch('/trees'),
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
                () => apiFetch(`/trees/${treeId}`),
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
                () => apiFetch('/community/memories'),
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
                return await apiFetch('/memories', {
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
                return await apiFetch(`/memories/${memoryId}`, {
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
                return await apiFetch(`/memories/${memoryId}`, {
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
                    return await apiFetch(`/memories/${memoryId}`);
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
                    return await apiFetch(`/memories?treeId=${encodeURIComponent(treeId)}`);
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
                    const trees = await apiFetch('/trees');
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
         *   /community/trees and /community/memories are confirmed to return flat camelCase only
         */
        getPublicTrees: async () => {
            return withFallback(
                async () => {
                    // 1) 공개 트리 목록 - normalize early
                    const apiTrees = await apiFetch('/community/trees');
                    const validTrees = (Array.isArray(apiTrees) ? apiTrees : [])
                        .map((rawTree) => normalizeBrowseTreeRecord(rawTree))
                        .filter((tree) => tree.visibility === 'public');

                    if (validTrees.length === 0) {
                        return [];
                    }

                    // 2) 공개 메모리 목록
                    const apiMemories = await apiFetch('/community/memories');
                    const publicMemories = Array.isArray(apiMemories) ? apiMemories : [];

                    // 3) treeId 기준 그룹핑 - normalize each memory
                    const grouped = {};
                    publicMemories.forEach((rawMemory) => {
                        const memory = normalizeBrowseMemoryRecord(rawMemory);
                        if (!memory.treeId) return;
                        if (!grouped[memory.treeId]) grouped[memory.treeId] = [];
                        grouped[memory.treeId].push(memory);
                    });

                    // 4) browse용 view model 생성 - use normalized fields only
                    return validTrees.map((tree) => {
                        const mems = grouped[tree.id] || [];
                        const sortedMems = [...mems].sort((a, b) =>
                            new Date(a.createdAt || a.timestamp || 0) -
                            new Date(b.createdAt || b.timestamp || 0)
                        );

                        const allTags = sortedMems
                            .flatMap((m) => m.emotionTags)
                            .filter(Boolean);
                        const uniqueTags = [...new Set(allTags)].slice(0, 3);

                        const timestamps = sortedMems.map((m) => m.timestamp).filter(Boolean);
                        const timeRange = timestamps.length >= 2
                            ? `${timestamps[0]} ~ ${timestamps[timestamps.length - 1]}`
                            : (timestamps[0] || 'recently');

                        return {
                            id: tree.id,
                            title: tree.title,
                            visibility: tree.visibility,
                            createdAt: tree.createdAt,
                            ownerId: tree.ownerId,
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
                return await apiFetch('/trees', {
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
                return await apiFetch('/trees/' + treeId, {
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
                return await apiFetch('/trees/' + treeId, {
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

    // Transitional helpers for public tree browse
    function unwrapTreeRecord(tree) {
        return tree?.data || tree || {};
    }

    function unwrapMemoryRecord(memory) {
        return memory?.data || memory || {};
    }

    function getRecordTreeId(record) {
        return record.treeId || record.tree_id || null;
    }

    // Browse-specific normalization helpers
    function normalizeBrowseTreeRecord(rawTree) {
        const tree = unwrapTreeRecord(rawTree);
        return {
            id: tree.id || rawTree?.id || null,
            title: tree.title || '',
            visibility: tree.visibility || 'private',
            createdAt: tree.createdAt || tree.created_at || null,
            ownerId: tree.ownerId || tree.owner_id || null,
        };
    }

    function normalizeBrowseMemoryRecord(rawMemory) {
        const memory = unwrapMemoryRecord(rawMemory);
        return {
            id: memory.id || null,
            treeId: memory.treeId || memory.tree_id || null,
            createdAt: memory.createdAt || memory.created_at || null,
            timestamp: memory.timestamp || '',
            thumbnail: memory.thumbnail || '',
            artist: memory.artist || '',
            emotionTags: Array.isArray(memory.emotionTags)
                ? memory.emotionTags
                : (Array.isArray(memory.emotion_tags) ? memory.emotion_tags : []),
        };
    }

    // Expose internals for testing
    if (typeof window !== 'undefined') {
        window.__LoveBudApiClientInternals = {
            endpointLikelyRequiresAuth,
            getAuthWaitAttempts,
            hasConfirmedAuthSession,
            unwrapTreeRecord,
            unwrapMemoryRecord,
            getRecordTreeId,
            normalizeBrowseTreeRecord,
            normalizeBrowseMemoryRecord,
        };
    }

})();
