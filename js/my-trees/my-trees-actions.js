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
    escapeHandler: null,
    createFlowGuard: false,
    _checkMode: false
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
      if (isSubmitting) {
        createTreeModalState.submitBtn.textContent = safeText(t, 'myTrees.creating', '러브트리를 준비하고 있어요…');
        createTreeModalState.backdrop.setAttribute('aria-busy', 'true');
      } else {
        createTreeModalState.submitBtn.textContent = safeText(t, 'myTrees.create_modal_submit', '이 트리로 시작하기');
        createTreeModalState.backdrop.removeAttribute('aria-busy');
      }
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
        createTreeModalState._checkMode = false;
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
      if (createTreeModalState.createFlowGuard) return;
      createTreeModalState.createFlowGuard = true;

      var nextTitle = String(titleInput.value || '').trim();

      if (!nextTitle) {
        setError(safeText(i18n, 'myTrees.create_modal_title_required', '트리 제목을 입력해 주세요.'));
        titleInput.focus();
        createTreeModalState.createFlowGuard = false;
        return;
      }

      setError('');
      setSubmitting(true, i18n);

      if (createTreeModalState._checkMode) {
        cleanupAndResolve({ title: nextTitle, visibility: 'public', _check: true });
        return;
      }

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
      createTreeModalState.createFlowGuard = false;
      createTreeModalState.isSubmitting = false;
      createTreeModalState._checkMode = false;
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

  function findNewTree(trees, title, excludeIds, attemptStartedAt) {
    var candidates = trees.filter(function(t) {
      return t.title === title && excludeIds.indexOf(t.id) === -1;
    });
    if (candidates.length === 0) return null;
    candidates.sort(function(a, b) {
      var aTime = Math.abs(new Date(a.createdAt).getTime() - attemptStartedAt);
      var bTime = Math.abs(new Date(b.createdAt).getTime() - attemptStartedAt);
      return aTime - bTime;
    });
    return candidates[0];
  }

  async function createNewTree(options) {
    var i18n = getI18n(options);
    var headerBtn = document.getElementById('headerCreateTreeBtn');
    var emptyBtn = document.getElementById('createTreeBtn');
    var modal = setupCreateTreeModal(options);
    if (!modal) return { outcome: 'cancelled' };

    if (window.__myTreesCreateFlowActive) {
      return;
    }
    window.__myTreesCreateFlowActive = true;

    var modalResult = await openCreateTreeModal(options);
    if (!modalResult) {
      window.__myTreesCreateFlowActive = false;
      return;
    }

    var preCreateTreeIds = [];
    var snapshotAvailable = false;
    var attemptStartedAt = 0;

    function setCtaContent(btn, iconName, iconSize, text) {
      if (!btn) return;
      btn.replaceChildren();
      var icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      if (iconSize) icon.style.fontSize = iconSize;
      icon.textContent = iconName;
      btn.appendChild(icon);
      btn.appendChild(document.createTextNode(' ' + text));
    }

    function disableCtas() {
      if (headerBtn) {
        headerBtn.disabled = true;
        setCtaContent(headerBtn, 'hourglass_empty', '', safeText(i18n, 'myTrees.creating', '러브트리를 준비하고 있어요…'));
      }
      if (emptyBtn) {
        emptyBtn.disabled = true;
        setCtaContent(emptyBtn, 'hourglass_empty', '20px', safeText(i18n, 'myTrees.creating', '러브트리를 준비하고 있어요…'));
      }
    }

    function restoreCtas() {
      if (headerBtn) {
        headerBtn.disabled = false;
        setCtaContent(headerBtn, 'add', '', safeText(i18n, 'myTrees.header_create', '새 러브트리'));
      }
      if (emptyBtn) {
        emptyBtn.disabled = false;
        setCtaContent(emptyBtn, 'add_circle', '20px', safeText(i18n, 'create_tree_btn', '새 러브트리 만들기'));
      }
    }

    function showSuccessAndRedirect(treeId, successMsg) {
      if (headerBtn) {
        headerBtn.disabled = true;
        setCtaContent(headerBtn, 'check_circle', '', successMsg);
      }
      if (emptyBtn) {
        emptyBtn.disabled = true;
        setCtaContent(emptyBtn, 'check_circle', '20px', successMsg);
      }
      if (modal) {
        if (modal.titleInput) modal.titleInput.disabled = true;
        if (modal.submitBtn) {
          modal.submitBtn.textContent = successMsg;
          modal.submitBtn.disabled = true;
        }
        if (modal.backdrop) {
          modal.backdrop.removeAttribute('aria-busy');
        }
        if (typeof modal.closeModal === 'function') {
          modal.closeModal({ completed: true, treeId: treeId });
        }
      }
      var redirectTarget = treeId ? 'editor?treeId=' + encodeURIComponent(treeId) : 'editor';
      setTimeout(function() {
        window.location.href = redirectTarget;
      }, 1200);
    }

    async function takeSnapshot() {
      preCreateTreeIds = [];
      snapshotAvailable = false;
      if (window.apiClient && window.apiClient.getTrees) {
        try {
          var trees = await window.apiClient.getTrees();
          preCreateTreeIds = trees.map(function(t) { return t.id; });
          snapshotAvailable = true;
        } catch (e) {
          myTreesDebugLog('[my-trees-actions] Snapshot getTrees failed, using empty snapshot', e);
        }
      }
      attemptStartedAt = Date.now();
    }

    async function reconcile(modalResult) {
      if (!window.apiClient || !window.apiClient.getTrees) return null;
      try {
        var trees = await window.apiClient.getTrees();
        return findNewTree(trees, modalResult.title, preCreateTreeIds, attemptStartedAt);
      } catch (e) {
        myTreesDebugLog('[my-trees-actions] Reconciliation getTrees failed', e);
        return null;
      }
    }

    function enterCheckMode() {
      if (modal) {
        modal.setError(safeText(i18n, 'myTrees.create_tree_ambiguous', '생성 요청이 처리 중입니다. 상태를 확인해 보세요.'));
        modal.setSubmitting(false, i18n);
        modal.submitBtn.textContent = safeText(i18n, 'myTrees.check_status', '생성 상태 확인');
        createTreeModalState._checkMode = true;
        createTreeModalState.createFlowGuard = false;
      }
    }

    function awaitModalAgain() {
      createTreeModalState.resolve = null;
      return new Promise(function(resolve) {
        createTreeModalState.resolve = resolve;
      });
    }

    disableCtas();
    if (modal && typeof modal.setSubmitting === 'function') {
      modal.setSubmitting(true, i18n);
    }

    myTreesDebugLog('[my-trees-actions] Creating tree with visibility: public');

    while (modalResult) {
      try {
        if (modalResult._check) {
          myTreesDebugLog('[my-trees-actions] Check mode: reconciling via getTrees');

          if (!snapshotAvailable) {
            myTreesDebugLog('[my-trees-actions] Snapshot not available, calling reconcile for getTrees but never auto-redirecting.');
            await reconcile(modalResult);
            if (modal) {
              modal.setError(safeText(i18n, 'myTrees.snapshot_check_hint', '자동 식별할 수 없으니 새로고침 후 내 러브트리 목록에서 확인해 달라.'));
              modal.setSubmitting(false, i18n);
              modal.submitBtn.textContent = safeText(i18n, 'myTrees.check_status', '생성 상태 확인');
              createTreeModalState._checkMode = true;
              createTreeModalState.createFlowGuard = false;
            }
            modalResult = await awaitModalAgain();
            if (!modalResult) {
              restoreCtas();
              break;
            }
            continue;
          }

          var checkMatch = await reconcile(modalResult);
          if (checkMatch) {
            myTreesDebugLog('[my-trees-actions] Check mode reconciliation successful');
            showSuccessAndRedirect(checkMatch.id, safeText(i18n, 'myTrees.create_success', '러브트리가 만들어졌어요. 이동 중이에요…'));
            return { outcome: 'redirecting' };
          }
          enterCheckMode();
          modalResult = await awaitModalAgain();
          if (!modalResult) {
            restoreCtas();
            break;
          }
          continue;
        }

        var newTree;

        if (window.apiClient && window.apiClient.createTree) {
          await takeSnapshot();
          newTree = await window.apiClient.createTree({
            title: modalResult.title,
            visibility: 'public'
          });
          myTreesDebugLog('[my-trees-actions] Tree created');
        } else {
          newTree = { id: 'tree-' + Date.now(), title: modalResult.title, visibility: 'public' };
          options?.showToast?.(safeText(i18n, 'demo_mode', '데모 모드입니다. 실제 트리는 생성되지 않습니다.'), 'error');
        }

        if (window.LoveBudCache && options?.cacheKey) {
          window.LoveBudCache.clear(options.cacheKey);
          myTreesDebugLog('[my-trees-actions] Cache cleared after new tree creation');
        }
        clearPersistentTreesCache();

        var treeId = newTree?.id;
        var successMsg = safeText(i18n, 'myTrees.create_success', '러브트리가 만들어졌어요. 이동 중이에요…');
        if (modal && typeof modal.setError === 'function') {
          modal.setError('');
        }
        showSuccessAndRedirect(treeId, successMsg);
        return { outcome: 'redirecting' };
      } catch (e) {
        console.error('[my-trees-actions] createTree failed:', getErrorMessage(e));

        var status = e.status;

        if (status === 401 || status === 403) {
          myTreesDebugLog('[my-trees-actions] Auth error, deferring to auth UX', e);
          restoreCtas();
          if (modal && typeof modal.closeModal === 'function') {
            modal.closeModal(null);
          }
          options?.showToast?.(safeText(i18n, 'myTrees.auth_required', '로그인이 필요한 기능입니다'), 'error');
          break;
        }

        if (status === 409 || status === 429) {
          myTreesDebugLog('[my-trees-actions] Conflict/rate-limit, safe stop', e);
          restoreCtas();
          if (modal && typeof modal.closeModal === 'function') {
            modal.closeModal(null);
          }
          options?.showToast?.(safeText(i18n, 'myTrees.create_tree_fail', '러브트리 만들기 실패. 다시 시도해 주세요.'), 'error');
          break;
        }

        if (!status || (status >= 500 && status <= 599)) {
          myTreesDebugLog('[my-trees-actions] Ambiguous error, attempting reconciliation', e);

          if (!snapshotAvailable) {
            myTreesDebugLog('[my-trees-actions] Snapshot not available, cannot automatically reconcile. Enter check mode.');
            enterCheckMode();
            modalResult = await awaitModalAgain();
            if (!modalResult) {
              restoreCtas();
              break;
            }
            continue;
          }

          var match = await reconcile(modalResult);
          if (match) {
            myTreesDebugLog('[my-trees-actions] Reconciliation successful, tree found');
            showSuccessAndRedirect(match.id, safeText(i18n, 'myTrees.create_success', '러브트리가 만들어졌어요. 이동 중이에요…'));
            return { outcome: 'redirecting' };
          }

          enterCheckMode();
          modalResult = await awaitModalAgain();
          if (!modalResult) {
            restoreCtas();
            break;
          }
          continue;
        }

        if (status === 400 || status === 422) {
          myTreesDebugLog('[my-trees-actions] Validation error, retry allowed', e);
          restoreCtas();
          if (modal) {
            modal.setSubmitting(false, i18n);
            modal.setError(safeText(i18n, 'myTrees.create_tree_fail', '러브트리 만들기 실패. 다시 시도해 주세요.'));
            modal.createFlowGuard = false;
          }
          options?.showToast?.(safeText(i18n, 'myTrees.create_tree_fail', '러브트리 만들기 실패. 다시 시도해 주세요.'), 'error');
          modalResult = await awaitModalAgain();
          if (!modalResult) break;
          disableCtas();
          if (modal && typeof modal.setSubmitting === 'function') {
            modal.setSubmitting(true, i18n);
          }
          continue;
        }

        myTreesDebugLog('[my-trees-actions] Unknown error, safe stop', e);
        restoreCtas();
        if (modal && typeof modal.closeModal === 'function') {
          modal.closeModal(null);
        }
        options?.showToast?.(safeText(i18n, 'myTrees.create_tree_fail', '러브트리 만들기 실패. 다시 시도해 주세요.'), 'error');
        break;
      }
    }

    window.__myTreesCreateFlowActive = false;
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
