/**
 * LoveBud Auth Session Module
 * Extracted from auth.js to keep redirect/session preload responsibility isolated.
 */
(function () {
  function getRedirectTarget(getBasePath) {
    var params = new URLSearchParams(window.location.search);
    var redirect = params.get('redirect');
    if (redirect) return redirect;
    var basePath = typeof getBasePath === 'function' ? getBasePath() : '';
    return basePath + 'my-trees.html';
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

            if ((isEditorTarget || isMyTreesTarget) && trees[0]) {
              var firstTreeId = trees[0].id || trees[0];
              if (firstTreeId) {
                Promise.all([
                  apiClient.getTree ? apiClient.getTree(firstTreeId).catch(function () {}) : Promise.resolve(),
                  apiClient.getMemoriesByTree ? apiClient.getMemoriesByTree(firstTreeId).catch(function () {}) : Promise.resolve()
                ]).then(function (results) {
                  var treeDetail = results[0];
                  var memories = results[1];
                  if (treeDetail) {
                    localStorage.setItem('tree_detail_' + firstTreeId, JSON.stringify({
                      data: treeDetail,
                      timestamp: Date.now()
                    }));
                  }
                  if (memories && Array.isArray(memories)) {
                    localStorage.setItem('tree_memories_' + firstTreeId, JSON.stringify({
                      data: memories,
                      timestamp: Date.now()
                    }));
                  }
                  logger.log(
                    '[auth] Preloaded first tree detail for editor:',
                    firstTreeId,
                    'memories:',
                    memories ? memories.length : 0
                  );
                }).catch(function (err) {
                  logger.warn('[auth] Preload first tree detail failed:', err && err.message);
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
