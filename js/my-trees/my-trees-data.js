/**
 * LoveBud - My Trees Data
 * v20260429-2
 *
 * Responsibilities:
 * - cache keys
 * - preloadFirstTreeDetail
 * - loadTrees
 */

(function() {
  function isMyTreesDebugEnabled() {
    return window.LOVEBUD_DEBUG === true || window.LOVEBUD_MY_TREES_DEBUG === true;
  }

  function myTreesDebugLog() {
    if (!isMyTreesDebugEnabled() || !window.console || typeof console.log !== 'function') return;
    console.log.apply(console, arguments);
  }

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

        myTreesDebugLog('[my-trees-data] Preloaded first tree detail:', 'memories:', memories ? memories.length : 0);
      }).catch(function(err) {
        console.warn('[my-trees-data] Preload first tree detail failed:', err.message);
      });
    } catch (e) {
      console.warn('[my-trees-data] Preload first tree detail error:', e);
    }
  }

  function normalizeTreesForList(trees) {
    return (Array.isArray(trees) ? trees : []).map(function(tree) {
      return Object.assign({}, normalizeTreeRecord(tree) || tree);
    });
  }

  function readTreeMemoriesCache(treeId) {
    try {
      var raw = localStorage.getItem(TREE_MEMORIES_CACHE_KEY + treeId);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.data)) return null;
      return parsed.data;
    } catch (e) {
      console.warn('[my-trees-data] Failed to read tree memories cache:', e);
      return null;
    }
  }

  function normalizeTreeRecord(tree) {
    if (window.LoveBudNormalize && typeof window.LoveBudNormalize.normalizeTree === 'function') {
      return window.LoveBudNormalize.normalizeTree(tree);
    }
    return tree;
  }

  function normalizeMemoryRecord(memory) {
    if (window.LoveBudNormalize && typeof window.LoveBudNormalize.normalizeMemory === 'function') {
      return window.LoveBudNormalize.normalizeMemory(memory);
    }
    return memory;
  }

  var VALID_PHASES = {
    loaded: true, fetch_rejected: true, auth_prepare_failed: true, parse: true, invalid_payload: true,
    auth: true, client: true, server: true, generic: true, none: true
  };
  var VALID_STATUS_CLASSES = { success: true, client: true, server: true, none: true };

  function normalizePhase(v) {
    return VALID_PHASES[v] ? v : 'generic';
  }

  function normalizeStatusClass(v) {
    return VALID_STATUS_CLASSES[v] ? v : 'none';
  }

  function sanitizeRequestLifecycle(meta) {
    if (!meta || typeof meta !== 'object') return {};
    return {
      attempt: meta.attempt === 2 ? 2 : 1,
      retried: meta.retried === true,
      authHeaderPresent: meta.authHeaderPresent === true,
      statusClass: normalizeStatusClass(meta.statusClass)
    };
  }

  function emitLifecycleDiagnostic(event) {
    if (!event || typeof event !== 'object') return;
    var enabled = !!(window.__LoveBudMyTreesDiagnosticSink || window.LOVEBUD_MY_TREES_DEBUG === true);
    if (!enabled) return;
    try {
      var sink = window.__LoveBudMyTreesDiagnosticSink;
      if (sink && typeof sink === 'object' && typeof sink.emit === 'function') {
        var safeEvent = Object.freeze({
          phase: normalizePhase(event.phase),
          attempt: event.attempt === 2 ? 2 : 1,
          retried: event.retried === true,
          authHeaderPresent: event.authHeaderPresent === true,
          cachePresent: event.cachePresent === true,
          cacheUsed: event.cacheUsed === true,
          statusClass: normalizeStatusClass(event.statusClass),
          resultCountBucket: normalizeCountBucket(event.resultCountBucket)
        });
        sink.emit(safeEvent);
      }
    } catch (e) {}
  }

  function normalizeCountBucket(v) {
    if (v === 'positive' || v === 'zero') return v;
    return 'unknown';
  }

  function sortMemoriesByFirstMoment(memories) {
    return (Array.isArray(memories) ? memories.slice() : []).sort(function(a, b) {
      var left = new Date((a && (a.createdAt || a.created_at || a.timestamp)) || 0).getTime();
      var right = new Date((b && (b.createdAt || b.created_at || b.timestamp)) || 0).getTime();
      return left - right;
    });
  }

  function deriveTreeMemoryMeta(tree, memories) {
    var normalizedTree = normalizeTreeRecord(tree) || tree || {};
    var ordered = sortMemoriesByFirstMoment((Array.isArray(memories) ? memories : []).map(function(memory) {
      return normalizeMemoryRecord(memory) || memory;
    }));
    var firstMoment = ordered[0] || null;

    return {
      memoryCount: ordered.length,
      representativeThumbnail: normalizedTree.representativeThumbnail || normalizedTree.representative_thumbnail || (firstMoment && (firstMoment.thumbnail || firstMoment.sourceUrl)) || '',
      representativeTitle: normalizedTree.representativeTitle || normalizedTree.representative_title || (firstMoment && firstMoment.title) || '',
      representativeMemo: normalizedTree.representativeMemo || normalizedTree.representative_memo || (firstMoment && firstMoment.memo) || ''
    };
  }

  async function enrichTreesWithMemoryMeta(trees) {
    if (!Array.isArray(trees) || trees.length === 0 || !window.apiClient || !window.apiClient.getMemoriesByTree) {
      return Array.isArray(trees) ? trees.map(function(tree) {
        return Object.assign({}, normalizeTreeRecord(tree) || tree);
      }) : [];
    }

    var enriched = await Promise.all(trees.map(async function(tree) {
      var normalizedTree = normalizeTreeRecord(tree) || tree;
      if (!normalizedTree || !normalizedTree.id) return normalizedTree;

      var cachedMemories = readTreeMemoriesCache(normalizedTree.id);
      var memories = cachedMemories;

      if (!Array.isArray(memories)) {
        try {
          memories = await window.apiClient.getMemoriesByTree(normalizedTree.id);
          if (Array.isArray(memories)) {
            localStorage.setItem(TREE_MEMORIES_CACHE_KEY + normalizedTree.id, JSON.stringify({
              data: memories,
              timestamp: Date.now()
            }));
          }
        } catch (e) {
          console.warn('[my-trees-data] Failed to fetch memories for tree:', e.message);
          memories = [];
        }
      }

      var meta = deriveTreeMemoryMeta(normalizedTree, memories);
      return Object.assign({}, normalizedTree, meta);
    }));

    return enriched;
  }

  /**
   * Extract a numeric HTTP status from an error object.
   * Supports: error.status, error.statusCode, error.response?.status.
   * Returns 0 if no status is extractable.
   */
  function extractHttpStatus(error) {
    if (!error) return 0;
    var status = error.status || error.statusCode || (error.response && error.response.status) || 0;
    return Number(status) || 0;
  }

  /**
   * Classify an API error into one of:
   * - fetch_rejected       : explicit fetch rejection phase only
   * - auth_prepare_failed  : fetch() never called, auth/token prep failed
   * - parse                : JSON parse failure after successful HTTP response (phase metadata, checked third)
   * - invalid_payload      : successful HTTP response with non-array payload (phase metadata, checked fourth)
   * - auth                 : HTTP 401 or 403
   * - server               : HTTP 5xx
   * - client               : HTTP 4xx other than 401/403
   * - generic              : unphased/status-less unexpected client failure
   *
   * Phase checks precede status checks so that HTTP 200 parse failures
   * and invalid payloads are classified by phase, not by status code.
   *
   * Privacy-safe: never logs or exposes tokens, UIDs, emails, tree IDs, titles, or response bodies.
   */
  function classifyLoadError(error) {
    if (error && error._phase === 'fetch_rejected') return 'fetch_rejected';
    if (error && error._phase === 'auth_prepare_failed') return 'auth_prepare_failed';
    if (error && error._phase === 'json_parse_failed') return 'parse';
    if (error && error._phase === 'invalid_success_payload') return 'invalid_payload';
    var status = extractHttpStatus(error);
    if (status === 401 || status === 403) return 'auth';
    if (status >= 500 && status < 600) return 'server';
    if (status >= 400 && status < 500) return 'client';
    return 'generic';
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
      myTreesDebugLog('[my-trees-data] Rendering cached trees:', cachedTrees.length);
      renderTrees(cachedTrees);
    } else if (typeof setState === 'function' && stateEnum?.LOADING) {
      setState(stateEnum.LOADING);
    }

    try {
      var trees;
      var requestLifecycle = {
        attempt: 1,
        retried: false,
        authHeaderPresent: false,
        statusClass: 'none'
      };

      if (window.apiClient && window.apiClient.getTrees) {
        trees = await window.apiClient.getTrees({
          onLifecycle: function(meta) {
            requestLifecycle = sanitizeRequestLifecycle(meta);
          }
        });
      } else {
        throw new Error('apiClient.getTrees is not available');
      }

      if (Array.isArray(trees)) {
        trees = normalizeTreesForList(trees);

        if (cache) {
          cache.set(TREES_CACHE_KEY, trees, 3 * 60 * 1000);
        }
        writePersistentTreesCache(trees);

        if (typeof renderTrees === 'function') {
          renderTrees(trees);
        }

        emitLifecycleDiagnostic({
          phase: 'loaded',
          attempt: requestLifecycle.attempt,
          authHeaderPresent: requestLifecycle.authHeaderPresent,
          retried: requestLifecycle.retried,
          cachePresent: !!cachedTrees,
          cacheUsed: false,
          statusClass: requestLifecycle.statusClass,
          resultCountBucket: trees.length > 0 ? 'positive' : 'zero'
        });

        // Optimization: Defer preloading detail/memories to background to ensure TTI is not blocked
        if (window.requestIdleCallback) {
          window.requestIdleCallback(function() {
            preloadFirstTreeDetail(trees);
          }, { timeout: 2000 });
        } else {
          setTimeout(function() {
            preloadFirstTreeDetail(trees);
          }, 1000);
        }
      } else {
        var invalidPayloadError = new Error('Invalid owner-tree list payload');
        invalidPayloadError._phase = 'invalid_success_payload';
        invalidPayloadError.status = 200;
        invalidPayloadError.statusCode = 200;
        throw invalidPayloadError;
      }
    } catch (e) {
      var errorType = classifyLoadError(e);
      console.error('[my-trees-data] loadTrees error (type=' + errorType + ')');

      var errorAttempt = Number(e._attempt) || requestLifecycle.attempt;
      var errorRetried = e._retried === true || requestLifecycle.retried;
      var errorAuthHeaderPresent = e._authHeaderPresent === true || requestLifecycle.authHeaderPresent;

      emitLifecycleDiagnostic({
        phase: errorType,
        attempt: errorAttempt,
        authHeaderPresent: errorAuthHeaderPresent,
        retried: errorRetried,
        cachePresent: !!cachedTrees,
        cacheUsed: !!(cachedTrees && Array.isArray(cachedTrees)),
        statusClass: (function() {
          var s = extractHttpStatus(e);
          return s >= 500 ? 'server' : s >= 400 ? 'client' : s > 0 ? 'success' : requestLifecycle.statusClass;
        })(),
        resultCountBucket: 'unknown'
      });

      // auth errors (401/403): do not silently keep stale cache.
      // Show auth error state regardless of cache presence.
      if (errorType === 'auth') {
        if (typeof setState === 'function' && stateEnum?.ERROR) {
          setState(stateEnum.ERROR, { errorType: 'auth' });
        } else {
          // setState not injected — DOM fallback
          _domFallbackErrorState('auth');
        }
        return;
      }

      // server / network / generic: keep cached fallback if available
      if (cachedTrees && Array.isArray(cachedTrees)) {
        myTreesDebugLog('[my-trees-data] Showing cached trees after ' + errorType + ' error');
        if (typeof renderTrees === 'function') {
          renderTrees(cachedTrees);
        }
        var warnKey = errorType === 'server'
          ? (i18n('myTrees.server_error_cached') || '서버 오류가 발생했습니다. 저장된 목록을 표시합니다.')
          : (i18n('myTrees.offline_mode') || '오프라인 모드 - 캐시된 데이터를 표시합니다');
        showToast?.(warnKey, 'warn');
      } else {
        // No cache: transition to error state
        if (typeof setState === 'function' && stateEnum?.ERROR) {
          setState(stateEnum.ERROR, { errorType: errorType });
        } else {
          _domFallbackErrorState(errorType);
        }
        var failKey = errorType === 'server'
          ? (i18n('myTrees.server_load_failed') || '서버 오류로 트리 목록을 불러오지 못했습니다')
          : (i18n('myTrees.load_failed') || '트리 목록을 불러오는데 실패했습니다');
        showToast?.(failKey, 'error');
      }
    }
  }

  /**
   * DOM fallback for error state when setState is not injected.
   * Hides loading, shows state-error with appropriate message.
   */
  function _domFallbackErrorState(errorType) {
    var loading = document.getElementById('state-loading');
    var error = document.getElementById('state-error');
    var empty = document.getElementById('state-empty');
    var loaded = document.getElementById('state-loaded');
    if (loading) loading.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (loaded) loaded.style.display = 'none';
    if (error) {
      error.style.display = 'flex';
      _updateErrorStateMessage(error, errorType);
    }
  }

  /**
   * Update error state DOM message elements based on errorType.
   * Targets h2[data-i18n] and p[data-i18n] inside the error container.
   */
  function _updateErrorStateMessage(errorEl, errorType) {
    if (!errorEl) return;
    var h2 = errorEl.querySelector('h2');
    var p = errorEl.querySelector('p');
    if (errorType === 'auth') {
      if (h2) h2.textContent = '로그인이 필요합니다';
      if (p) p.textContent = '세션이 만료되었거나 인증이 필요합니다. 다시 로그인해 주세요.';
    } else if (errorType === 'server') {
      if (h2) h2.textContent = '서버 오류가 발생했습니다';
      if (p) p.textContent = '잠시 후 다시 시도해 주세요.';
    } else if (errorType === 'fetch_rejected' || errorType === 'network') {
      if (h2) h2.textContent = '불러오기에 실패했습니다';
      if (p) p.textContent = '네트워크 연결을 확인하고 다시 시도해주세요.';
    } else if (errorType === 'parse') {
      if (h2) h2.textContent = '불러오기에 실패했습니다';
      if (p) p.textContent = '데이터를 불러오는데 문제가 발생했습니다. 다시 시도해 주세요.';
    } else if (errorType === 'invalid_payload') {
      if (h2) h2.textContent = '데이터를 불러오는데 문제가 발생했습니다';
      if (p) p.textContent = '올바른 형식의 데이터를 받지 못했습니다. 다시 시도해 주세요.';
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
