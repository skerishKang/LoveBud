/**
 * postgres-client.js
 * Client wrapper for LoveBud Netlify Functions (Neon PostgreSQL).
 * Exposes window.apiClient for fetching data from /api endpoints.
 * Provides API-first with mock-data.js fallback strategy.
 */
(function() {
  const API_BASE = '/api';
  const DEBUG = false;

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
      if (DEBUG) console.warn(`[apiClient] ${fnName} API failed, fallback to mock:`, error.message);
      return mockFn();
    }
  }

  // Helper to get Firebase Auth Token
  async function getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (window.firebase && firebase.auth && firebase.auth().currentUser) {
      try {
        const token = await firebase.auth().currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.warn("Failed to get Firebase Auth token:", error);
      }
    }
    return headers;
  }

  // Core fetch logic with error handling
  async function apiFetch(endpoint, options = {}) {
    const authHeaders = await getAuthHeaders();
    const config = {
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers
      }
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      
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
      // Structured so UI scripts can catch this error and fallback to mock-data.js if needed.
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
    }
  };

  // Expose as a global object
  window.apiClient = apiClient;

})();
