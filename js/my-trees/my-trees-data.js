/**
 * LoveBud - My Trees Data
 * v20260420-1
 *
 * Responsibilities:
 * - cache keys
 * - preloadFirstTreeDetail
 * - loadTrees
 */

(function() {
  function getI18n(options) {
    return options?.i18n || window.t || function(k) { return k; };
  }

  var TREES_CACHE_KEY = 'my_trees_list';
  var TREE_DETAIL_CACHE_KEY = 'tree_detail_';
  var TREE_MEMORIES_CACHE_KEY = 'tree_memories_';
  var PERSISTENT_TREES_CACHE_KEY = 'lovebud_my_trees_list_cache';
  var PERSISTENT_TREES_CACHE_TTL_MS = 3 * 60 * 1000;

  function readPersistentTreesCache() {
    try {
      var raw = localStorage.getItem(PERSISTENT_TREES_CACHE_KEY);
      if (!raw) return null;

      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.data)) return null;
      if (parsed.expiry && Date.now() > parsed.expiry) {
        localStorage.removeItem(PERSISTENT_TREES_CACHE_KEY);
        return null;
      }

      return parsed.data;
    } catch (e) {
      console.warn('[my-trees-data] Failed to read persistent trees cache:', e);
      return null;
    }
  }

  function writePersistentTreesCache(trees) {
    try {
      localStorage.setItem(PERSISTENT_TREES_CACHE_KEY, JSON.stringify({
        data: trees,
        expiry: Date.now() + PERSISTENT_TREES_CACHE_TTL_MS,
        cachedAt: Date.now()
      }));
    } catch (e) {
      console.warn('[my-trees-data] Failed to write persistent trees cache:', e);
    }
  }

  function preloadFirstTreeDetail(trees) {
    try {
      if (!trees || !trees.length || !window.apiClient) return;

      var firstTree = trees[0];
      var treeId = firstTree.id || firstTree;
      if (!treeId) return;

      Promise.all([
        window.apiClient.getTree ? window.apiClient.getTree(treeId).catch(function() {}) : Promise.resolve(),
        window.apiClient.getMemoriesByTree ? window.apiClient.getMemoriesByTree(treeId).catch(function() {}) : Promise.resolve()
      ]).then(function(results) {
        var treeDetail = results[0];
        var memories = results[1];

        if (treeDetail) {
          localStorage.setItem(TREE_DETAIL_CACHE_KEY + treeId, JSON.stringify({
            data: treeDetail,
            timestamp: Date.now()
          }));
        }

        if (memories && Array.isArray(memories)) {
          localStorage.setItem(TREE_MEMORIES_CACHE_KEY + treeId, JSON.stringify({
            data: memories,
            timestamp: Date.now()
          }));
        }

        console.log('[my-trees-data] Preloaded first tree detail:', treeId, 'memories:', memories ? memories.length : 0);
      }).catch(function(err) {
        console.warn('[my-trees-data] Preload first tree detail failed:', err.message);
      });
    } catch (e) {
      console.warn('[my-trees-data] Preload first tree detail error:', e);
    }
  }

  async function loadTrees(options) {
    var cache = window.LoveBudCache;
    var i18n = getI18n(options);
    var setState = options?.setState;
    var stateEnum = options?.stateEnum;
    var renderTrees = options?.renderTrees;
    var showToast = options?.showToast;

    var cachedTrees = cache ? cache.get(TREES_CACHE_KEY) : null;
    if ((!cachedTrees || !Array.isArray(cachedTrees)) ) {
      cachedTrees = readPersistentTreesCache();
      if (cachedTrees && Array.isArray(cachedTrees) && cache) {
        cache.set(TREES_CACHE_KEY, cachedTrees, PERSISTENT_TREES_CACHE_TTL_MS);
      }
    }

    if (cachedTrees && Array.isArray(cachedTrees) && typeof renderTrees === 'function') {
      console.log('[my-trees-data] Rendering cached trees:', cachedTrees.length);
      renderTrees(cachedTrees);
    } else if (typeof setState === 'function' && stateEnum?.LOADING) {
      setState(stateEnum.LOADING);
    }

    try {
      var trees;
      if (window.apiClient && window.apiClient.getTrees) {
        trees = await window.apiClient.getTrees();
      } else {
        throw new Error('apiClient.getTrees is not available');
      }

      if (Array.isArray(trees)) {
        if (cache) {
          cache.set(TREES_CACHE_KEY, trees, 3 * 60 * 1000);
        }
        writePersistentTreesCache(trees);

        if (typeof renderTrees === 'function') {
          renderTrees(trees);
        }

        preloadFirstTreeDetail(trees);
      } else {
        console.error('[my-trees-data] Invalid trees response:', trees);
        if (!cachedTrees && typeof setState === 'function' && stateEnum?.ERROR) {
          setState(stateEnum.ERROR);
        }
      }
    } catch (e) {
      if (cachedTrees && Array.isArray(cachedTrees)) {
        console.error('[my-trees-data] loadTrees error:', e);
        console.log('[my-trees-data] Showing cached trees after API error');
        if (typeof renderTrees === 'function') {
          renderTrees(cachedTrees);
        }
        showToast?.(i18n('myTrees.offline_mode') || '오프라인 모드 - 캐시된 데이터를 표시합니다', 'warn');
      } else {
        console.error('[my-trees-data] loadTrees error:', e);
        if (typeof setState === 'function' && stateEnum?.ERROR) {
          setState(stateEnum.ERROR);
        }
        showToast?.(i18n('myTrees.load_failed') || '트리 목록을 불러오는데 실패했습니다', 'error');
      }
    }
  }

  window.LoveBudMyTreesData = {
    TREES_CACHE_KEY: TREES_CACHE_KEY,
    TREE_DETAIL_CACHE_KEY: TREE_DETAIL_CACHE_KEY,
    TREE_MEMORIES_CACHE_KEY: TREE_MEMORIES_CACHE_KEY,
    PERSISTENT_TREES_CACHE_KEY: PERSISTENT_TREES_CACHE_KEY,
    preloadFirstTreeDetail: preloadFirstTreeDetail,
    loadTrees: loadTrees
  };
})();
