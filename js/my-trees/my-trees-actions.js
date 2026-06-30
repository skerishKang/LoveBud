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

  function renderCreationGoalCard(form, i18n) {
    var visibilityGrid = form.querySelector('.create-tree-visibility');
    var visibilityField = visibilityGrid ? visibilityGrid.closest('.create-tree-field') : null;
    if (!visibilityField) return;

    // Clear container safely
    visibilityField.replaceChildren();

    var labelDiv = document.createElement('div');
    labelDiv.className = 'create-tree-label';
    labelDiv.textContent = safeText(i18n, 'myTrees.create_modal_goal_label', '시작 목표');
    visibilityField.appendChild(labelDiv);

    var cardDiv = document.createElement('div');
    cardDiv.className = 'create-tree-visibility-card';
    cardDiv.style.cssText = 'cursor:default;min-height:auto;background:rgba(255,246,247,0.98);border-color:rgba(144,73,81,0.20);box-shadow:0 10px 24px rgba(144,73,81,0.08);';

    var topDiv = document.createElement('div');
    topDiv.className = 'create-tree-visibility-top';
    topDiv.style.cssText = 'justify-content:space-between;align-items:flex-start;';

    var spanLeft = document.createElement('span');
    spanLeft.style.cssText = 'display:inline-flex;align-items:center;gap:8px;';

    var icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.style.cssText = 'font-size:18px;color:var(--primary);';
    icon.textContent = 'psychiatry';
    spanLeft.appendChild(icon);

    var titleSpan = document.createElement('span');
    titleSpan.textContent = safeText(i18n, 'myTrees.create_modal_goal_title', '둘러보기에 소개될 트리로 키우기');
    spanLeft.appendChild(titleSpan);

    topDiv.appendChild(spanLeft);

    var badgeSpan = document.createElement('span');
    badgeSpan.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:4px 9px;border-radius:999px;background:rgba(144,73,81,0.10);color:var(--primary);font-size:11px;font-weight:900;white-space:nowrap;';
    badgeSpan.textContent = safeText(i18n, 'myTrees.create_modal_goal_badge', '추천');
    topDiv.appendChild(badgeSpan);

    cardDiv.appendChild(topDiv);

    var descDiv = document.createElement('div');
    descDiv.className = 'create-tree-visibility-desc';
    descDiv.style.cssText = 'font-size:13px;line-height:1.65;';
    descDiv.textContent = safeText(
      i18n,
      'myTrees.create_modal_goal_desc',
      '좋아하는 순간을 3개 이상 남기면 둘러보기에 소개될 수 있어요. 첫 순간부터 차근차근 채워보세요.'
    );
    cardDiv.appendChild(descDiv);

    visibilityField.appendChild(cardDiv);

    var helpDiv = document.createElement('div');
    helpDiv.className = 'create-tree-help';
    helpDiv.textContent = safeText(
      i18n,
      'myTrees.create_modal_goal_help',
      '처음에는 제목만 정하고 시작해도 괜찮아요. 좋아하는 순간을 3개 이상 남기면 둘러보기에 소개될 수 있어요.'
    );
    visibilityField.appendChild(helpDiv);
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

  async function createNewTree(options) {
    var i18n = getI18n(options);
    var headerBtn = document.getElementById('headerCreateTreeBtn');
    var emptyBtn = document.getElementById('createTreeBtn');
    var modal = setupCreateTreeModal(options);

    if (window.__myTreesCreateFlowActive) {
      return;
    }
    window.__myTreesCreateFlowActive = true;

    var modalResult = await openCreateTreeModal(options);
    if (!modalResult) {
      window.__myTreesCreateFlowActive = false;
      return;
    }

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

    if (headerBtn) {
      headerBtn.disabled = true;
      setCtaContent(headerBtn, 'hourglass_empty', '', safeText(i18n, 'myTrees.creating', '러브트리를 준비하고 있어요…'));
    }

    if (emptyBtn) {
      emptyBtn.disabled = true;
      setCtaContent(emptyBtn, 'hourglass_empty', '20px', safeText(i18n, 'myTrees.creating', '러브트리를 준비하고 있어요…'));
    }

    if (modal && typeof modal.setSubmitting === 'function') {
      modal.setSubmitting(true, i18n);
    }

    myTreesDebugLog('[my-trees-actions] Creating tree with visibility: public');

    var attemptStartedAt = Date.now();

    while (modalResult) {
      try {
        if (modalResult._check) {
          myTreesDebugLog('[my-trees-actions] Check mode: reconciling via getTrees');
          var checkMatch = null;
          if (window.apiClient && window.apiClient.getTrees) {
            try {
              var checkTrees = await window.apiClient.getTrees();
              checkMatch = checkTrees.find(function(t) {
                return t.title === modalResult.title && new Date(t.createdAt).getTime() >= attemptStartedAt;
              });
            } catch (checkErr) {
              myTreesDebugLog('[my-trees-actions] Check mode getTrees failed', checkErr);
            }
          }
          if (checkMatch) {
            myTreesDebugLog('[my-trees-actions] Check mode reconciliation successful');
            var checkSuccessMsg = safeText(i18n, 'myTrees.create_success', '러브트리가 만들어졌어요. 이동 중이에요…');
            if (headerBtn) {
              headerBtn.disabled = true;
              setCtaContent(headerBtn, 'check_circle', '', checkSuccessMsg);
            }
            if (emptyBtn) {
              emptyBtn.disabled = true;
              setCtaContent(emptyBtn, 'check_circle', '20px', checkSuccessMsg);
            }
            if (modal && typeof modal.closeModal === 'function') {
              modal.closeModal({ completed: true, treeId: checkMatch.id });
            }
            setTimeout(function() {
              window.location.href = 'editor?treeId=' + encodeURIComponent(checkMatch.id);
            }, 1200);
            break;
          }
          if (modal) {
            modal.setError(safeText(i18n, 'myTrees.create_tree_ambiguous', '생성 요청이 처리 중입니다. 상태를 확인해 보세요.'));
            modal.setSubmitting(false, i18n);
            modal.submitBtn.textContent = safeText(i18n, 'myTrees.check_status', '생성 상태 확인');
            createTreeModalState.createFlowGuard = false;
          }
          createTreeModalState.resolve = null;
          modalResult = await new Promise(function(resolve) {
            createTreeModalState.resolve = resolve;
          });
          if (!modalResult) {
            if (headerBtn) {
              headerBtn.disabled = false;
              setCtaContent(headerBtn, 'add', '', safeText(i18n, 'myTrees.header_create', '새 러브트리'));
            }
            if (emptyBtn) {
              emptyBtn.disabled = false;
              setCtaContent(emptyBtn, 'add_circle', '20px', safeText(i18n, 'create_tree_btn', '새 러브트리 만들기'));
            }
            break;
          }
          continue;
        }

        var newTree;

        if (window.apiClient && window.apiClient.createTree) {
          attemptStartedAt = Date.now();
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
        var redirectTarget = treeId ? 'editor?treeId=' + encodeURIComponent(treeId) : 'editor';
        var redirectDelay = 1200;
        var successMsg = safeText(i18n, 'myTrees.create_success', '러브트리가 만들어졌어요. 이동 중이에요…');
        if (modal && typeof modal.setError === 'function') {
          modal.setError('');
        }
          if (modal) {
            if (modal.titleInput) modal.titleInput.disabled = true;
            if (modal.submitBtn) {
              modal.submitBtn.textContent = successMsg;
              modal.submitBtn.disabled = true;
            }
            if (modal.backdrop) {
              modal.backdrop.removeAttribute('aria-busy');
              // Keep aria-hidden="false" during success confirmation so screen readers
              // can announce the success message. Modal stays visually open (.show class).
            }
          }
        if (headerBtn) {
          headerBtn.disabled = true;
          setCtaContent(headerBtn, 'check_circle', '', successMsg);
        }
        if (emptyBtn) {
          emptyBtn.disabled = true;
          setCtaContent(emptyBtn, 'check_circle', '20px', successMsg);
        }
        setTimeout(function() {
          window.location.href = redirectTarget;
        }, redirectDelay);
        break;
      } catch (e) {
        console.error('[my-trees-actions] createTree failed:', getErrorMessage(e));

        var status = e.status;
        var isAmbiguous = !status || (status >= 500 && status <= 599);

        if (status === 401 || status === 403) {
          myTreesDebugLog('[my-trees-actions] Auth error, deferring to auth UX', e);
          if (headerBtn) {
            headerBtn.disabled = false;
            setCtaContent(headerBtn, 'add', '', safeText(i18n, 'myTrees.header_create', '새 러브트리'));
          }
          if (emptyBtn) {
            emptyBtn.disabled = false;
            setCtaContent(emptyBtn, 'add_circle', '20px', safeText(i18n, 'create_tree_btn', '새 러브트리 만들기'));
          }
          if (modal && typeof modal.closeModal === 'function') {
            modal.closeModal(null);
          }
          options?.showToast?.(safeText(i18n, 'myTrees.auth_required', '로그인이 필요한 기능입니다'), 'error');
          break;
        }

        if (isAmbiguous) {
          myTreesDebugLog('[my-trees-actions] Ambiguous error, attempting reconciliation', e);

          if (window.apiClient && window.apiClient.getTrees) {
            try {
              var trees = await window.apiClient.getTrees();
              var match = trees.find(function(t) {
                return t.title === modalResult.title && new Date(t.createdAt).getTime() >= attemptStartedAt;
              });

              if (match) {
                myTreesDebugLog('[my-trees-actions] Reconciliation successful, tree found');
                var recSuccessMsg = safeText(i18n, 'myTrees.create_success', '러브트리가 만들어졌어요. 이동 중이에요…');
                if (headerBtn) {
                  headerBtn.disabled = true;
                  setCtaContent(headerBtn, 'check_circle', '', recSuccessMsg);
                }
                if (emptyBtn) {
                  emptyBtn.disabled = true;
                  setCtaContent(emptyBtn, 'check_circle', '20px', recSuccessMsg);
                }
                if (modal && typeof modal.closeModal === 'function') {
                  modal.closeModal({ completed: true, treeId: match.id });
                }
                setTimeout(function() {
                  window.location.href = 'editor?treeId=' + encodeURIComponent(match.id);
                }, 1200);
                break;
              }
            } catch (reconcileError) {
              myTreesDebugLog('[my-trees-actions] Reconciliation fetch failed', reconcileError);
            }
          }

          if (modal) {
            modal.setError(safeText(i18n, 'myTrees.create_tree_ambiguous', '생성 요청이 처리 중입니다. 상태를 확인해 보세요.'));
            modal.setSubmitting(false, i18n);
            modal.submitBtn.textContent = safeText(i18n, 'myTrees.check_status', '생성 상태 확인');
            createTreeModalState._checkMode = true;
            createTreeModalState.createFlowGuard = false;
          }

          createTreeModalState.resolve = null;
          modalResult = await new Promise(function(resolve) {
            createTreeModalState.resolve = resolve;
          });
          if (!modalResult) {
            if (headerBtn) {
              headerBtn.disabled = false;
              setCtaContent(headerBtn, 'add', '', safeText(i18n, 'myTrees.header_create', '새 러브트리'));
            }
            if (emptyBtn) {
              emptyBtn.disabled = false;
              setCtaContent(emptyBtn, 'add_circle', '20px', safeText(i18n, 'create_tree_btn', '새 러브트리 만들기'));
            }
            break;
          }
          continue;
        }

        myTreesDebugLog('[my-trees-actions] Non-ambiguous error, retry allowed', e);

        if (headerBtn) {
          headerBtn.disabled = false;
          setCtaContent(headerBtn, 'add', '', safeText(i18n, 'myTrees.header_create', '새 러브트리'));
        }

        if (emptyBtn) {
          emptyBtn.disabled = false;
          setCtaContent(emptyBtn, 'add_circle', '20px', safeText(i18n, 'create_tree_btn', '새 러브트리 만들기'));
        }

        if (modal) {
          modal.setSubmitting(false, i18n);
          modal.setError(safeText(i18n, 'myTrees.create_tree_fail', '러브트리 만들기 실패. 다시 시도해 주세요.'));
          modal.createFlowGuard = false;
        }

        options?.showToast?.(safeText(i18n, 'myTrees.create_tree_fail', '러브트리 만들기 실패. 다시 시도해 주세요.'), 'error');

        createTreeModalState.resolve = null;
        modalResult = await new Promise(function(resolve) {
          createTreeModalState.resolve = resolve;
        });
        if (!modalResult) break;
        if (headerBtn) {
          headerBtn.disabled = true;
          setCtaContent(headerBtn, 'hourglass_empty', '', safeText(i18n, 'myTrees.creating', '러브트리를 준비하고 있어요…'));
        }
        if (emptyBtn) {
          emptyBtn.disabled = true;
          setCtaContent(emptyBtn, 'hourglass_empty', '20px', safeText(i18n, 'myTrees.creating', '러브트리를 준비하고 있어요…'));
        }
        if (modal && typeof modal.setSubmitting === 'function') {
          modal.setSubmitting(true, i18n);
        }
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
