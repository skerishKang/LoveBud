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

  // Helper to get Firebase Auth Token with retry
  async function getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Firebase Auth가 준비될 때까지 최대 3초 대기 (500ms × 6회)
    let attempts = 0;
    const maxAttempts = 6;
    while (attempts < maxAttempts) {
      if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        try {
          const token = await firebase.auth().currentUser.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
          return headers;
        } catch (error) {
          console.warn("Failed to get Firebase Auth token:", error);
          break;
        }
      }
      // Firebase Auth가 아직 준비되지 않음 - 잠시 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    // 토큰 획득 실패 - 인증 없이 진행 (public API용)
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
     * 2024-04-17 updated: trees API already includes payload.nodes, no need for separate memories call
     */
    getPublicTrees: async () => {
      return withFallback(
        async () => {
          // 1. public 트리 목록 조회 (trees API는 이미 payload.nodes 포함)
          const apiTrees = await apiFetch('/trees');
          const validTrees = (Array.isArray(apiTrees) ? apiTrees : []).filter(tree => {
            const t = tree.data || tree;
            return t.visibility === 'public';
          });

          if (validTrees.length === 0) {
            return [];
          }

            // 2. 각 트리의 payload.nodes에서 memories 추출 및 그룹핑
            const treesWithMemories = validTrees.map(tree => {
              const t = tree.data || tree;
              const payload = t.payload || {};
              const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];

              // public memories만 (payload의 모든 node는 이미 public이어야 함)
              const sortedMems = nodes.sort((a, b) =>
                new Date(a.createdAt || a.timestamp || 0) - new Date(b.createdAt || b.timestamp || 0)
              );

              // 감정 태그 수집 (DB 필드명: emotion_tags, snake_case)
              const allTags = sortedMems.flatMap(m => (m.emotion_tags || [])).filter(Boolean);
              const uniqueTags = [...new Set(allTags)].slice(0, 3);

            // 시간 범위 계산 (timestamp 필드)
            const timestamps = sortedMems.map(m => m.timestamp).filter(Boolean);
            const timeRange = timestamps.length >= 2
              ? `${timestamps[0]} ~ ${timestamps[timestamps.length - 1]}`
              : (timestamps[0] || 'recently');

            return {
              id: tree.id,
              title: t.title,
              visibility: t.visibility,
              created_at: t.created_at,
              owner_id: t.owner_id,
              memories: sortedMems,
              memoryCount: sortedMems.length,
              emotionTags: uniqueTags,
              timeRange: timeRange,
              representativeThumbnail: sortedMems[0]?.thumbnail || '',
              theme: sortedMems[0]?.artist || 'Mixed',
              stage: sortedMems.length <= 2 ? '입덕' : (sortedMems.length <= 4 ? '성장' : '최애')
            };
          }).filter(t => t.memoryCount > 0);

          return treesWithMemories;
        },
        () => {
          // Mock fallback: search.js의 buildTreeData와 동일한 로직
          const allMemories = typeof memories !== 'undefined' ? memories : [];
          const trees = typeof getTrees === 'function' ? getTrees() : [];
          const publicTrees = trees.filter(t => t.visibility === 'public');

          // memories를 tree별로 그룹핑
          const grouped = {};
          allMemories.filter(m => m.id !== 'root' && m.visibility === 'public').forEach(m => {
            const tid = m.treeId || 'ungrouped';
            if (!grouped[tid]) grouped[tid] = [];
            grouped[tid].push(m);
          });

          return publicTrees.map(tree => {
            const mems = grouped[tree.id] || [];
            const sortedMems = mems.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
            const allTags = sortedMems.flatMap(m => m.emotionTags || []).filter(Boolean);
            const uniqueTags = [...new Set(allTags)].slice(0, 3);
            const timestamps = sortedMems.map(m => m.timestamp).filter(Boolean);
            const timeRange = timestamps.length >= 2
              ? `${timestamps[0]} ~ ${timestamps[timestamps.length - 1]}`
              : (timestamps[0] || 'recently');

            return {
              ...tree,
              memories: sortedMems,
              memoryCount: sortedMems.length,
              emotionTags: uniqueTags,
              timeRange: timeRange,
              representativeThumbnail: sortedMems[0]?.thumbnail || '',
              theme: sortedMems[0]?.artist || 'Mixed',
              stage: sortedMems.length <= 2 ? '입덕' : (sortedMems.length <= 4 ? '성장' : '최애')
            };
          }).filter(t => t.memoryCount > 0);
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
    }
  };

  // Expose as a global object
  window.apiClient = apiClient;

})();
