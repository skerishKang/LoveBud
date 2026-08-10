/**
 * LoveBud Auth Session Module
 * Extracted from auth.js to keep redirect/session preload responsibility isolated.
 */
(function () {
  var LEGACY_PAGE_ROUTES = ['intro', 'search', 'detail', 'editor', 'my-trees', 'settings'];

  function canonicalizeRoute(raw) {
    if (!raw) return null;
    var cleaned = raw.replace(/\.html([?#]|$)/, '$1');
    if (/^\/pages\/(intro|search|detail|editor|my-trees|settings)([?#].*)?$/.test(cleaned)) return cleaned;
    if (/^pages\/(intro|search|detail|editor|my-trees|settings)([?#].*)?$/.test(cleaned)) return '/' + cleaned;
    if (/^(intro|search|detail|editor|my-trees|settings)([?#].*)?$/.test(cleaned)) return '/pages/' + cleaned;
    return null;
  }

  function getRedirectTarget(getBasePath) {
    var rawSearch = window.location.search || '';
    // raw query string에서 returnTo / redirect 값을 직접 추출 (중첩 query 보존)
    // 예: ?returnTo=/pages/editor.html?treeId=123&memoryId=456&mode=edit
    // 중첩 &는 내부 query의 일부이므로, 다음 top-level &returnTo= 또는 &redirect=
    // marker 전까지 search 끝까지 추출
    function extractParam(name) {
      var startRegex = new RegExp('[?&]' + name + '=');
      var startMatch = rawSearch.match(startRegex);
      if (!startMatch) return { found: false };
      var valueStart = startMatch.index + startMatch[0].length;
      // 다음 top-level &returnTo= 또는 &redirect= marker 탐색
      var nextMarkerRegex = new RegExp('&(?:returnTo|redirect)=');
      var nextMatch = rawSearch.substring(valueStart).match(nextMarkerRegex);
      var value;
      if (nextMatch) {
        value = rawSearch.substring(valueStart, valueStart + nextMatch.index);
      } else {
        value = rawSearch.substring(valueStart);
      }
      try {
        return { found: true, value: decodeURIComponent(value) };
      } catch (e) {
        return { found: true, value: value };
      }
    }

    // extractor가 값뿐 아니라 파라미터 존재 여부도 구분
    // returnTo가 존재하면(빈 값이어도) redirect를 절대 재시도하지 않음
    var returnToResult = extractParam('returnTo');
    var rawTarget;
    if (returnToResult.found) {
      rawTarget = returnToResult.value;
    } else {
      var redirectResult = extractParam('redirect');
      rawTarget = redirectResult.found ? redirectResult.value : null;
    }
    if (!rawTarget) {
      var basePath = typeof getBasePath === 'function' ? getBasePath() : '';
      return basePath + 'my-trees.html';
    }

    // canonicalizeRoute로 legacy bare route / pages/* → /pages/<route> 정규화
    var canon = canonicalizeRoute(rawTarget);
    if (canon) return canon;

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
        /\/login(?:\.html)?$/.test(pathname)) {
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
    var privateCache = window.LoveBudAuthCache || null;
    var ownerUid = privateCache && typeof privateCache.getPrivateCacheOwnerUid === 'function'
      ? privateCache.getPrivateCacheOwnerUid()
      : null;
    var authority = privateCache && typeof privateCache.capturePrivateCacheAuthority === 'function'
      ? privateCache.capturePrivateCacheAuthority(ownerUid)
      : null;

    function isAuthorityCurrent() {
      return !!(
        privateCache &&
        authority &&
        typeof privateCache.isPrivateCacheAuthorityCurrent === 'function' &&
        privateCache.isPrivateCacheAuthorityCurrent(authority)
      );
    }

    function writePrivateRecord(key, record) {
      if (
        !privateCache ||
        !ownerUid ||
        !authority ||
        typeof privateCache.writePrivateCacheRecord !== 'function'
      ) {
        return false;
      }
      return privateCache.writePrivateCacheRecord(key, ownerUid, record, authority) === true;
    }

    if (!ownerUid || !authority) {
      logger.warn('[auth] Private preload skipped: confirmed owner cache authority unavailable');
      return;
    }

    var redirectTarget = typeof getRedirectTargetFn === 'function' ? getRedirectTargetFn() : '';

    function matchRedirect(routeName) {
      if (redirectTarget.indexOf(routeName + '.html') !== -1) return true;
      var path = '/pages/' + routeName;
      return redirectTarget === path ||
             redirectTarget.indexOf(path + '?') === 0 ||
             redirectTarget.indexOf(path + '#') === 0;
    }
    var isEditorTarget = matchRedirect('editor');
    var isMyTreesTarget = matchRedirect('my-trees');

    try {
      if (apiClient && apiClient.getTrees) {
        apiClient.getTrees().then(function (trees) {
          if (!isAuthorityCurrent()) return;
          if (trees && trees.length > 0) {
            if (!writePrivateRecord('lovebud_trees_cache', {
              data: trees,
              timestamp: Date.now()
            })) {
              return;
            }
            logger.log('[auth] Preloaded my-trees cache:', trees.length, 'trees');

            // Optimization: Only preload detail for editor target.
            // my-trees target will handle its own (deferred) preload to avoid redundant blocking.
            if (isEditorTarget && trees[0]) {
              var firstTreeId = trees[0].id || trees[0];
              if (firstTreeId) {
                // 1. Fetch tree detail immediately (smaller payload, higher priority for editor)
                if (apiClient.getTree && isAuthorityCurrent()) {
                  apiClient.getTree(firstTreeId).then(function (treeDetail) {
                    if (treeDetail) {
                      writePrivateRecord('tree_detail_' + firstTreeId, {
                        data: treeDetail,
                        timestamp: Date.now()
                      });
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
                  if (!isAuthorityCurrent()) return;
                  if (apiClient.getMemoriesByTree) {
                    apiClient.getMemoriesByTree(firstTreeId).then(function (memories) {
                      if (memories && Array.isArray(memories)) {
                        if (writePrivateRecord('tree_memories_' + firstTreeId, {
                          data: memories,
                          timestamp: Date.now()
                        })) {
                          logger.log('[auth] Background preloaded memories:', firstTreeId, memories.length);
                        }
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
