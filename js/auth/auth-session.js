/**
 * LoveBud Auth Session Module
 * Extracted from auth.js to keep redirect/session preload responsibility isolated.
 */
(function () {
  function getRedirectTarget(getBasePath) {
    var rawSearch = window.location.search || '';
    // raw query string에서 returnTo / redirect 값을 직접 추출 (중첩 query 보존)
    // 예: ?returnTo=/pages/editor.html?treeId=123&memoryId=456&mode=edit
    function extractParam(name) {
      var regex = new RegExp('[?&]' + name + '=([^&]*)');
      var match = rawSearch.match(regex);
      if (match && match[1]) {
        // decodeURIComponent로 디코딩하되, 중첩된 & 등은 그대로 둠
        return decodeURIComponent(match[1]);
      }
      return null;
    }

    var returnTo = extractParam('returnTo');
    var redirect = extractParam('redirect');

    // returnTo 우선, 없을 때만 redirect 사용
    var rawTarget = returnTo || redirect;
    if (!rawTarget) {
      var basePath = typeof getBasePath === 'function' ? getBasePath() : '';
      return basePath + 'my-trees.html';
    }

    // URL 파싱 및 검증
    var parsed;
    try {
      parsed = new URL(rawTarget, window.location.origin);
    } catch (e) {
      // malformed URL → fallback
      var basePath = typeof getBasePath === 'function' ? getBasePath() : '';
      return basePath + 'my-trees.html';
    }

    // cross-origin 차단
    if (parsed.origin !== window.location.origin) {
      var basePath = typeof getBasePath === 'function' ? getBasePath() : '';
      return basePath + 'my-trees.html';
    }

    // protocol 스킴 차단 (javascript:, data:, //host 등)
    var protocol = parsed.protocol;
    if (protocol !== 'http:' && protocol !== 'https:') {
      var basePath = typeof getBasePath === 'function' ? getBasePath() : '';
      return basePath + 'my-trees.html';
    }

    // login-page loop 차단
    var pathname = parsed.pathname || '';
    if (pathname.indexOf('/pages/login') !== -1 ||
        pathname.indexOf('login.html') !== -1) {
      var basePath = typeof getBasePath === 'function' ? getBasePath() : '';
      return basePath + 'my-trees.html';
    }

    // same-origin internal route만 허용: pathname + search + hash 반환
    return pathname + parsed.search + parsed.hash;
  }

  function preloadRedirectTargetData(options) {
    var getRedirectTargetFn = options && options.getRedirectTarget;
    var apiClient = options && options.apiClient;
    var logger = (options && options.logger) || console;

    var redirectTarget = typeof getRedirectTargetFn === 'function' ? getRedirectTargetFn() : '';
    var isEditorTarget = redirectTarget.indexOf('editor.html') !== -1;
    var isMyTreesTarget = redirectTarget.indexOf('my-trees.html') !== -1;

    try {
      if (apiClient && apiClient.getTrees) {
        apiClient.getTrees().then(function (trees) {
          if (trees && trees.length > 0) {
            localStorage.setItem('lovebud_trees_cache', JSON.stringify({
              data: trees,
              timestamp: Date.now()
            }));
            logger.log('[auth] Preloaded my-trees cache:', trees.length, 'trees');

            // Optimization: Only preload detail for editor target.
            // my-trees target will handle its own (deferred) preload to avoid redundant blocking.
            if (isEditorTarget && trees[0]) {
              var firstTreeId = trees[0].id || trees[0];
              if (firstTreeId) {
                // 1. Fetch tree detail immediately (smaller payload, higher priority for editor)
                if (apiClient.getTree) {
                  apiClient.getTree(firstTreeId).then(function (treeDetail) {
                    if (treeDetail) {
                      localStorage.setItem('tree_detail_' + firstTreeId, JSON.stringify({
                        data: treeDetail,
                        timestamp: Date.now()
                      }));
                    }
                  }).catch(function () {});
                }

                // 2. Defer memories fetch (heavy payload) to background
                var runWhenIdle = function (cb) {
                  if (window.requestIdleCallback) {
                    window.requestIdleCallback(cb, { timeout: 2000 });
                  } else {
                    setTimeout(cb, 1000);
                  }
                };

                runWhenIdle(function () {
                  if (apiClient.getMemoriesByTree) {
                    apiClient.getMemoriesByTree(firstTreeId).then(function (memories) {
                      if (memories && Array.isArray(memories)) {
                        localStorage.setItem('tree_memories_' + firstTreeId, JSON.stringify({
                          data: memories,
                          timestamp: Date.now()
                        }));
                        logger.log('[auth] Background preloaded memories:', firstTreeId, memories.length);
                      }
                    }).catch(function () {});
                  }
                });
              }
            }
          }
        }).catch(function (err) {
          logger.warn('[auth] Preload trees cache failed:', err && err.message);
        });
      }
    } catch (e) {
      logger.warn('[auth] Preload redirect target data error:', e);
    }
  }

  window.LoveBudAuthSession = {
    getRedirectTarget: getRedirectTarget,
    preloadRedirectTargetData: preloadRedirectTargetData
  };
})();