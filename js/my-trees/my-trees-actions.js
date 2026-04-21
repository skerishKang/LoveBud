/**
 * LoveBud - My Trees Actions
 * v20260421-2
 *
 * Responsibilities:
 * - renameTree
 * - deleteTree
 * - toggleTreeVisibility
 * - isTestPublicMode
 * - getDefaultVisibility
 * - createNewTree
 */

(function() {
  var PERSISTENT_TREES_CACHE_KEY = 'lovebud_my_trees_list_cache';

  function getI18n(options) {
    return options?.i18n || window.t || function(k) { return k; };
  }

  function clearPersistentTreesCache() {
    try {
      localStorage.removeItem(PERSISTENT_TREES_CACHE_KEY);
    } catch (e) {
      console.warn('[my-trees-actions] Failed to clear persistent trees cache:', e);
    }
  }

  async function renameTree(treeId, currentTitle, options) {
    var i18n = getI18n(options);
    var newTitle = prompt(i18n('rename_tree_prompt') || '트리 이름을 입력하세요:', currentTitle);

    if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) {
      return;
    }

    try {
      if (window.apiClient && window.apiClient.updateTree) {
        await window.apiClient.updateTree(treeId, { title: newTitle.trim() });
        clearPersistentTreesCache();
        options?.showToast?.(i18n('rename_success') || '트리 이름이 변경되었습니다.', 'success');
        options?.reloadTrees?.();
      } else {
        options?.showToast?.(i18n('api_not_available') || 'API를 사용할 수 없습니다.', 'error');
      }
    } catch (e) {
      console.error('[my-trees-actions] renameTree failed:', e);
      options?.showToast?.(i18n('rename_fail') || '이름 변경에 실패했습니다.', 'error');
    }
  }

  async function deleteTree(treeId, treeTitle, options) {
    var i18n = getI18n(options);
    var confirmed = confirm((i18n('delete_tree_confirm') || '정말 "{title}" 트리를 삭제하시겠습니까?').replace('{title}', treeTitle));

    if (!confirmed) return;

    try {
      if (window.apiClient && window.apiClient.deleteTree) {
        await window.apiClient.deleteTree(treeId);
        clearPersistentTreesCache();
        options?.showToast?.(i18n('delete_success') || '트리가 삭제되었습니다.', 'success');
        options?.reloadTrees?.();
      } else {
        options?.showToast?.(i18n('api_not_available') || 'API를 사용할 수 없습니다.', 'error');
      }
    } catch (e) {
      console.error('[my-trees-actions] deleteTree failed:', e);
      options?.showToast?.(i18n('delete_fail') || '삭제에 실패했습니다.', 'error');
    }
  }

  async function toggleTreeVisibility(treeId, currentVisibility, options) {
    var i18n = getI18n(options);
    var nextVisibility = currentVisibility === 'public' ? 'private' : 'public';

    try {
      if (window.apiClient && window.apiClient.updateTree) {
        await window.apiClient.updateTree(treeId, { visibility: nextVisibility });
        clearPersistentTreesCache();
        options?.showToast?.(
          nextVisibility === 'public'
            ? (i18n('visibility_changed_public') || '이 트리가 공개로 전환되었습니다.')
            : (i18n('visibility_changed_private') || '이 트리가 비공개로 전환되었습니다.'),
          'success'
        );
        options?.reloadTrees?.();
      } else {
        options?.showToast?.(i18n('api_not_available') || 'API를 사용할 수 없습니다.', 'error');
      }
    } catch (e) {
      console.error('[my-trees-actions] toggleTreeVisibility failed:', e);
      options?.showToast?.(i18n('visibility_change_fail') || '공개 설정 변경에 실패했습니다.', 'error');
    }
  }

  function isTestPublicMode() {
    try {
      var urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('testPublic') === '1') return true;
      if (window.localStorage?.getItem('lovebud_test_public') === '1') return true;
      if (window.LoveBudRuntimeFlags?.forcePublicTrees) return true;
    } catch (e) {}
    return false;
  }

  function getDefaultVisibility(options) {
    var checkTestPublicMode = options?.isTestPublicMode || isTestPublicMode;

    if (checkTestPublicMode()) {
      console.log('[my-trees-actions] Test public mode: defaulting to public');
      return 'public';
    }
    return 'public';
  }

  async function maybeRenameNewTree(treeId, currentTitle, options) {
    var i18n = getI18n(options);
    if (!treeId || !window.apiClient || !window.apiClient.updateTree) {
      return currentTitle;
    }

    var promptedTitle = prompt(
      i18n('new_tree_name_prompt') || '새 러브트리의 제목을 정해볼까요?',
      currentTitle
    );

    if (!promptedTitle || promptedTitle.trim() === '' || promptedTitle.trim() === currentTitle) {
      return currentTitle;
    }

    try {
      await window.apiClient.updateTree(treeId, { title: promptedTitle.trim() });
      clearPersistentTreesCache();
      options?.showToast?.(i18n('rename_success') || '트리 이름이 변경되었습니다.', 'success');
      return promptedTitle.trim();
    } catch (e) {
      console.error('[my-trees-actions] maybeRenameNewTree failed:', e);
      options?.showToast?.(i18n('rename_fail') || '이름 변경에 실패했습니다.', 'error');
      return currentTitle;
    }
  }

  async function createNewTree(options) {
    var i18n = getI18n(options);
    var headerBtn = document.getElementById('headerCreateTreeBtn');
    var emptyBtn = document.getElementById('createTreeBtn');
    var restoreHeaderText = '<span class="material-symbols-outlined">add</span> ' + (i18n('myTrees.header_create') || '새 러브트리');
    var restoreEmptyText = '<span class="material-symbols-outlined" style="font-size:20px;">add_circle</span> ' + (i18n('create_tree_btn') || '새 러브트리 만들기');

    if (headerBtn) {
      headerBtn.disabled = true;
      headerBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> ' + (i18n('creating') || '생성 중...');
    }

    if (emptyBtn) {
      emptyBtn.disabled = true;
      emptyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;">hourglass_empty</span> ' + (i18n('creating') || '생성 중...');
    }

    var defaultVisibility = options?.getDefaultVisibility
      ? options.getDefaultVisibility()
      : getDefaultVisibility();

    console.log('[my-trees-actions] Creating tree with visibility:', defaultVisibility);

    try {
      var newTree;
      var defaultTitle = i18n('default_tree_title') || '나의 첫 러브트리';

      if (window.apiClient && window.apiClient.createTree) {
        newTree = await window.apiClient.createTree({
          title: defaultTitle,
          visibility: defaultVisibility
        });
        console.log('[my-trees-actions] Tree created:', newTree);
      } else {
        newTree = { id: 'tree-' + Date.now(), title: defaultTitle };
        options?.showToast?.((window.t || function(k){ return k; })('demo_mode'), 'error');
      }

      if (window.LoveBudCache && options?.cacheKey) {
        window.LoveBudCache.clear(options.cacheKey);
        console.log('[my-trees-actions] Cache cleared after new tree creation');
      }
      clearPersistentTreesCache();

      var treeId = newTree?.id;
      if (treeId) {
        await maybeRenameNewTree(treeId, newTree.title || defaultTitle, options);
        window.location.href = 'editor.html?treeId=' + encodeURIComponent(treeId);
      } else {
        window.location.href = 'editor.html';
      }
    } catch (e) {
      console.error('[my-trees-actions] createTree failed:', e);

      if (headerBtn) {
        headerBtn.disabled = false;
        headerBtn.innerHTML = restoreHeaderText;
      }

      if (emptyBtn) {
        emptyBtn.disabled = false;
        emptyBtn.innerHTML = restoreEmptyText;
      }

      options?.showToast?.(i18n('create_tree_fail') || '트리 생성에 실패했습니다', 'error');
    }
  }

  window.LoveBudMyTreesActions = {
    renameTree: renameTree,
    deleteTree: deleteTree,
    toggleTreeVisibility: toggleTreeVisibility,
    isTestPublicMode: isTestPublicMode,
    getDefaultVisibility: getDefaultVisibility,
    createNewTree: createNewTree
  };
})();
