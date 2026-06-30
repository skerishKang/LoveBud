/**
 * LoveBud - My Trees Actions
 * v20260425-1
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
  function isMyTreesDebugEnabled() {
    return window.LOVEBUD_DEBUG === true || window.LOVEBUD_MY_TREES_DEBUG === true;
  }

  function myTreesDebugLog() {
    if (!isMyTreesDebugEnabled() || !window.console || typeof console.log !== 'function') return;
    console.log.apply(console, arguments);
  }

  function getErrorMessage(error) {
    return error && error.message ? error.message : String(error || 'Unknown error');
  }

  var PERSISTENT_TREES_CACHE_KEY = 'lovebud_my_trees_list_cache';
  var createTreeModalState = {
    initialized: false,
    backdrop: null,
    form: null,
    titleInput: null,
    errorEl: null,
    cancelBtn: null,
    closeBtn: null,
    submitBtn: null,
    lastFocusedEl: null,
    resolve: null,
    isSubmitting: false,
    escapeHandler: null
  };

  function getI18n(options) {
    return options?.i18n || window.t || function(k) { return k; };
  }

  function safeText(i18n, key, fallback) {
    var translated = typeof i18n === 'function' ? i18n(key) : '';
    return translated && translated !== key ? translated : fallback;
  }

  function clearPersistentTreesCache() {
    try {
      localStorage.removeItem(PERSISTENT_TREES_CACHE_KEY);
    } catch (e) {
      console.warn('[my-trees-actions] Failed to clear persistent trees cache:', getErrorMessage(e));
    }
  }

  function buildDom(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var key in attrs) {
        if (key === 'class') el.className = attrs[key];
        else if (key === 'style') el.setAttribute('style', attrs[key]);
        else el.setAttribute(key, attrs[key]);
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (typeof child === 'string') {
          el.appendChild(document.createTextNode(child));
        } else if (child) {
          el.appendChild(child);
        }
      }
    }
    return el;
  }

  function renderCreationGoalCard(form, i18n) {
    var visibilityGrid = form.querySelector('.create-tree-visibility');
    var visibilityField = visibilityGrid ? visibilityGrid.closest('.create-tree-field') : null;
    if (!visibilityField) return;

    var label = buildDom('div', { class: 'create-tree-label' }, [
      safeText(i18n, 'myTrees.create_modal_goal_label', '시작 목표')
    ]);

    var psychiatryIcon = buildDom('span', { class: 'material-symbols-outlined', style: 'font-size:18px;color:var(--primary);' }, ['psychiatry']);
    var goalTitleText = buildDom('span', null, [
      safeText(i18n, 'myTrees.create_modal_goal_title', '둘러보기에 소개될 트리로 키우기')
    ]);
    var goalTitleRow = buildDom('span', { style: 'display:inline-flex;align-items:center;gap:8px;' }, [
      psychiatryIcon,
      goalTitleText
    ]);

    var badgeText = safeText(i18n, 'myTrees.create_modal_goal_badge', '추천');
    var badge = buildDom('span', {
      style: 'display:inline-flex;align-items:center;justify-content:center;padding:4px 9px;border-radius:999px;background:rgba(144,73,81,0.10);color:var(--primary);font-size:11px;font-weight:900;white-space:nowrap;'
    }, [badgeText]);

    var top = buildDom('div', { class: 'create-tree-visibility-top', style: 'justify-content:space-between;align-items:flex-start;' }, [
      goalTitleRow,
      badge
    ]);

    var descText = safeText(
      i18n,
      'myTrees.create_modal_goal_desc',
      '좋아하는 순간을 3개 이상 남기면 둘러보기에 소개될 수 있어요. 첫 순간부터 차근차근 채워보세요.'
    );
    var desc = buildDom('div', { class: 'create-tree-visibility-desc', style: 'font-size:13px;line-height:1.65;' }, [descText]);

    var card = buildDom('div', {
      class: 'create-tree-visibility-card',
      style: 'cursor:default;min-height:auto;background:rgba(255,246,247,0.98);border-color:rgba(144,73,81,0.20);box-shadow:0 10px 24px rgba(144,73,81,0.08);'
    }, [top, desc]);

    var helpText = safeText(
      i18n,
      'myTrees.create_modal_goal_help',
      '처음에는 제목만 정하고 시작해도 괜찮아요. 좋아하는 순간을 3개 이상 남기면 둘러보기에 소개될 수 있어요.'
    );
    var help = buildDom('div', { class: 'create-tree-help' }, [helpText]);

    visibilityField.replaceChildren();
    visibilityField.appendChild(label);
    visibilityField.appendChild(card);
    visibilityField.appendChild(help);
  }

  function setupCreateTreeModal(options) {
    if (createTreeModalState.initialized) {
      return createTreeModalState;
    }

    var i18n = getI18n(options);
    var backdrop = document.getElementById('createTreeModalBackdrop');
    var form = document.getElementById('createTreeModalForm');
    var titleInput = document.getElementById('createTreeTitleInput');
    var errorEl = document.getElementById('createTreeModalError');
    var cancelBtn = document.getElementById('createTreeModalCancelBtn');
    var closeBtn = document.getElementById('createTreeModalCloseBtn');
    var submitBtn = document.getElementById('createTreeModalSubmitBtn');

    if (!backdrop || !form || !titleInput || !errorEl || !cancelBtn || !closeBtn || !submitBtn) {
      return null;
    }

    renderCreationGoalCard(form, i18n);

    createTreeModalState.backdrop = backdrop;
    createTreeModalState.form = form;
    createTreeModalState.titleInput = titleInput;
    createTreeModalState.errorEl = errorEl;
    createTreeModalState.cancelBtn = cancelBtn;
    createTreeModalState.closeBtn = closeBtn;
    createTreeModalState.submitBtn = submitBtn;

    function setError(message) {
      createTreeModalState.errorEl.textContent = message || '';
      createTreeModalState.titleInput.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    function setSubmitting(isSubmitting, localI18n) {
      var t = localI18n || i18n;
      createTreeModalState.isSubmitting = !!isSubmitting;
      createTreeModalState.titleInput.disabled = !!isSubmitting;
      createTreeModalState.cancelBtn.disabled = !!isSubmitting;
      createTreeModalState.closeBtn.disabled = !!isSubmitting;
      createTreeModalState.submitBtn.disabled = !!isSubmitting;
      createTreeModalState.submitBtn.textContent = isSubmitting
        ? safeText(t, 'creating', '만드는 중...')
        : safeText(t, 'myTrees.create_modal_submit', '이 트리로 시작하기');
    }

    function cleanupAndResolve(payload) {
      var resolver = createTreeModalState.resolve;
      createTreeModalState.resolve = null;
      if (resolver) {
        resolver(payload || null);
      }
    }

    function closeModal(payload) {
      if (!createTreeModalState.backdrop.classList.contains('show')) {
        cleanupAndResolve(payload);
        return;
      }

      createTreeModalState.backdrop.classList.remove('show');
      setSubmitting(false, i18n);
      setError('');
      if (createTreeModalState.escapeHandler) {
        document.removeEventListener('keydown', createTreeModalState.escapeHandler);
        createTreeModalState.escapeHandler = null;
      }
      // Move focus before setting aria-hidden to avoid
      // "Blocked aria-hidden on an element because its descendant retained focus"
      var restoreTarget = createTreeModalState.lastFocusedEl;
      createTreeModalState.lastFocusedEl = null;
      if (restoreTarget && typeof restoreTarget.focus === 'function') {
        restoreTarget.focus();
      }
      createTreeModalState.backdrop.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      cleanupAndResolve(payload);
    }

    createTreeModalState.closeModal = closeModal;
    createTreeModalState.setSubmitting = setSubmitting;
    createTreeModalState.setError = setError;

    cancelBtn.addEventListener('click', function() {
      if (createTreeModalState.isSubmitting) return;
      closeModal(null);
    });

    closeBtn.addEventListener('click', function() {
      if (createTreeModalState.isSubmitting) return;
      closeModal(null);
    });

    backdrop.addEventListener('click', function(event) {
      if (createTreeModalState.isSubmitting) return;
      if (event.target === backdrop) {
        closeModal(null);
      }
    });

    form.addEventListener('submit', function(event) {
      event.preventDefault();
      if (createTreeModalState.isSubmitting) return;

      var nextTitle = String(titleInput.value || '').trim();

      if (!nextTitle) {
        setError(safeText(i18n, 'myTrees.create_modal_title_required', '트리 제목을 입력해 주세요.'));
        titleInput.focus();
        return;
      }

      setError('');
      cleanupAndResolve({ title: nextTitle, visibility: 'public' });
    });

    titleInput.addEventListener('input', function() {
      if (titleInput.value.trim()) {
        setError('');
      }
    });

    createTreeModalState.initialized = true;
    return createTreeModalState;
  }

  function openCreateTreeModal(options) {
    var i18n = getI18n(options);
    var modal = setupCreateTreeModal(options);
    if (!modal) {
      return Promise.resolve(null);
    }

    return new Promise(function(resolve) {
      modal.resolve = resolve;
      modal.lastFocusedEl = document.activeElement;
      modal.backdrop.classList.add('show');
      modal.backdrop.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      modal.titleInput.value = safeText(i18n, 'default_tree_title', '나의 첫 러브트리');
      modal.setError('');
      modal.setSubmitting(false, i18n);

      modal.escapeHandler = function(event) {
        if (event.key === 'Escape' && !modal.isSubmitting) {
          event.preventDefault();
          modal.closeModal(null);
        }
      };
      document.addEventListener('keydown', modal.escapeHandler);

      setTimeout(function() {
        modal.titleInput.focus();
        modal.titleInput.select();
      }, 0);
    });
  }

  async function renameTree(treeId, currentTitle, options) {
    var i18n = getI18n(options);
    var newTitle = prompt(safeText(i18n, 'rename_tree_prompt', '트리 이름을 입력하세요:'), currentTitle);

    if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) {
      return;
    }

    try {
      if (window.apiClient && window.apiClient.updateTree) {
        await window.apiClient.updateTree(treeId, { title: newTitle.trim() });
        clearPersistentTreesCache();
        options?.showToast?.(safeText(i18n, 'rename_success', '트리 이름이 변경되었습니다.'), 'success');
        options?.reloadTrees?.();
      } else {
        options?.showToast?.(safeText(i18n, 'api_not_available', 'API를 사용할 수 없습니다.'), 'error');
      }
    } catch (e) {
      console.error('[my-trees-actions] renameTree failed:', getErrorMessage(e));
      options?.showToast?.(safeText(i18n, 'rename_fail', '이름 변경에 실패했습니다.'), 'error');
    }
  }

  async function deleteTree(treeId, treeTitle, options) {
    var i18n = getI18n(options);
    var confirmed = confirm(safeText(i18n, 'delete_tree_confirm', '정말 "{title}" 트리를 삭제하시겠습니까?').replace('{title}', treeTitle));

    if (!confirmed) return;

    try {
      if (window.apiClient && window.apiClient.deleteTree) {
        await window.apiClient.deleteTree(treeId);
        clearPersistentTreesCache();
        options?.showToast?.(safeText(i18n, 'delete_success', '트리가 삭제되었습니다.'), 'success');
        options?.reloadTrees?.();
      } else {
        options?.showToast?.(safeText(i18n, 'api_not_available', 'API를 사용할 수 없습니다.'), 'error');
      }
    } catch (e) {
      console.error('[my-trees-actions] deleteTree failed:', getErrorMessage(e));
      options?.showToast?.(safeText(i18n, 'delete_fail', '삭제에 실패했습니다.'), 'error');
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
            ? safeText(i18n, 'visibility_changed_public', '이 트리가 공개로 전환되었습니다.')
            : safeText(i18n, 'visibility_changed_private', '이 트리가 비공개로 전환되었습니다.'),
          'success'
        );
        options?.reloadTrees?.();
      } else {
        options?.showToast?.(safeText(i18n, 'api_not_available', 'API를 사용할 수 없습니다.'), 'error');
      }
    } catch (e) {
      console.error('[my-trees-actions] toggleTreeVisibility failed:', getErrorMessage(e));
      options?.showToast?.(safeText(i18n, 'visibility_change_fail', '공개 설정 변경에 실패했습니다.'), 'error');
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

  function getDefaultVisibility() {
    if (isTestPublicMode()) {
      myTreesDebugLog('[my-trees-actions] Test public mode ignored: new trees always start public');
    }
    return 'public';
  }

  function waitForCreateTreeModalResult(modal) {
    return new Promise(function(resolve) {
      modal.resolve = resolve;
    });
  }

  async function createNewTree(options) {
    var i18n = getI18n(options);
    var modal = setupCreateTreeModal(options);
    if (!modal) return { outcome: 'cancelled' };

    var modalOpen = false;

    while (true) {
      var modalResult;

      if (!modalOpen) {
        modalOpen = true;
        modalResult = await openCreateTreeModal(options);
      } else {
        modalResult = await waitForCreateTreeModalResult(modal);
      }

      if (!modalResult) {
        return { outcome: 'cancelled' };
      }

      modal.setSubmitting(true, i18n);

      try {
        var newTree;

        if (window.apiClient && window.apiClient.createTree) {
          newTree = await window.apiClient.createTree({
            title: modalResult.title,
            visibility: 'public'
          });
        } else {
          newTree = { id: 'tree-' + Date.now(), title: modalResult.title, visibility: 'public' };
          options?.showToast?.(safeText(i18n, 'demo_mode', '데모 모드입니다. 실제 트리는 생성되지 않습니다.'), 'error');
        }

        if (window.LoveBudCache && options?.cacheKey) {
          window.LoveBudCache.clear(options.cacheKey);
        }
        clearPersistentTreesCache();

        if (modal && typeof modal.closeModal === 'function') {
          modal.closeModal({ completed: true });
        }

        options?.showToast?.(safeText(i18n, 'create_tree_success', '러브트리가 생성되었습니다.'), 'success');

        await new Promise(function(r) { setTimeout(r, 300); });

        var treeId = newTree?.id;
        if (treeId) {
          window.location.href = 'editor?treeId=' + encodeURIComponent(treeId);
        } else {
          window.location.href = 'editor';
        }
        return { outcome: 'success' };
      } catch (e) {
        console.error('[my-trees-actions] createTree failed:', getErrorMessage(e));
        modal.setSubmitting(false, i18n);
        modal.setError(safeText(i18n, 'create_tree_fail', '러브트리 만들기 실패. 다시 시도해 주세요.'));
        options?.showToast?.(safeText(i18n, 'create_tree_fail', '러브트리 만들기 실패. 다시 시도해 주세요.'), 'error');
      }
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
