/**
 * LoveBud - My Trees Actions
 * v20260420-1
 *
 * Responsibilities:
 * - renameTree
 * - deleteTree
 * - isTestPublicMode
 * - getDefaultVisibility
 * - createNewTree
 */

(function() {
  function getI18n(options) {
    return options?.i18n || window.t || function(k) { return k; };
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

    try {
      var settings = localStorage.getItem('lovebud_user_settings');
      if (settings) {
        var parsed = JSON.parse(settings);
        if (parsed.defaultVisibility === 'public' || parsed.defaultVisibility === 'private') {
          return parsed.defaultVisibility;
        }
      }
    } catch (e) {
      console.warn('[my-trees-actions] Failed to read settings:', e);
    }

    return 'private';
  }

  async function createNewTree(options) {
    var i18n = getI18n(options);
    var headerBtn = document.getElementById('headerCreateTreeBtn');
    var emptyBtn = document.getElementById('createTreeBtn');
    var restoreHeaderText = '<span class="material-symbols-outlined">add</span> 새 러브트리';
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
      if (window.apiClient && window.apiClient.createTree) {
        newTree = await window.apiClient.createTree({
          title: i18n('default_tree_title') || '나의 첫 러브트리',
          visibility: defaultVisibility
        });
        console.log('[my-trees-actions] Tree created:', newTree);
      } else {
        newTree = { id: 'tree-' + Date.now() };
        options?.showToast?.((window.t || function(k){ return k; })('demo_mode'), 'error');
      }

      if (window.LoveBudCache && options?.cacheKey) {
        window.LoveBudCache.clear(options.cacheKey);
        console.log('[my-trees-actions] Cache cleared after new tree creation');
      }

      var treeId = newTree?.id;
      if (treeId) {
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
    isTestPublicMode: isTestPublicMode,
    getDefaultVisibility: getDefaultVisibility,
    createNewTree: createNewTree
  };
})();
