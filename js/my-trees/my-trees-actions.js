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
    createFlowGuard: false,
    _checkMode: false
  };

  // Shared accessibility lifecycle (js/shared/modal-a11y.js). Owns Tab
  // containment, gated Escape, initial focus, guarded invoker restoration,
  // and reference-counted body scroll lock. API calls, validation, Auth, and
  // persistence stay page-owned.
  var createTreeA11y = window.LoveBudModalA11y && window.LoveBudModalA11y.createLifecycle({
    getModal: function() { return document.getElementById('createTreeModalBackdrop'); },
    isOpen: function() {
      return !!(createTreeModalState.backdrop && createTreeModalState.backdrop.classList.contains('show'));
    },
    onRequestClose: function() {
      if (createTreeModalState && typeof createTreeModalState.closeModal === 'function') {
        createTreeModalState.closeModal(null);
      }
    },
    canClose: function() { return !createTreeModalState.isSubmitting; },
    getInitialFocus: function() { return createTreeModalState.titleInput; },
    getRestoreFocus: function() { return createTreeModalState.lastFocusedEl; },
    scrollLock: true,
    bindTarget: 'document'
  });

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

  /* ── #3855 — page-level bounded release manifest authority ──────────────────
   * Registered from this actions module (pages/my-trees.html forbids active
   * inline script blocks, so the authority cannot live in the page markup).
   * At most one no-store same-origin fetch to /.well-known/release.json per
   * page, initiated lazily on the first read so page load never issues a
   * network request. The manifest contract is enforced exactly: only the own
   * keys release_sha (40-char lowercase hex data property) and
   * contract_version ("1") are accepted; extra keys, missing keys, accessor
   * keys, inherited keys, non-"1" contract versions, invalid SHAs, non-ok
   * HTTP responses, missing response.json, and malformed JSON all map to
   * UNAVAILABLE. State distinguishes PENDING / READY / UNAVAILABLE.
   * getCurrent() is synchronous; getState() exposes the state; whenReady()
   * is the bounded async readiness seam that monitoring awaits, sharing the
   * single in-flight fetch promise. Never persists to storage, never
   * retries, never schedules timers, and never emits dynamic console output.
   * A shared shell / existing authority is never overwritten.
   */
  if (
    typeof window !== 'undefined' &&
    (!window.LoveBudReleaseManifestAuthority ||
      typeof window.LoveBudReleaseManifestAuthority.getCurrent !== 'function')
  ) {
    window.LoveBudReleaseManifestAuthority = (function () {
      var state = 'PENDING';
      var releaseSha = null;
      var requestPromise = null;

      function isValidReleaseSha(value) {
        return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
      }

      function hasExactManifestKeys(data) {
        var keys;
        try {
          keys = Object.keys(data).sort();
        } catch (e) {
          return false;
        }
        if (keys.length !== 2) return false;
        if (keys[0] !== 'contract_version' || keys[1] !== 'release_sha') return false;
        for (var i = 0; i < keys.length; i++) {
          var descriptor;
          try {
            descriptor = Object.getOwnPropertyDescriptor(data, keys[i]);
          } catch (e) {
            return false;
          }
          if (!descriptor || !('value' in descriptor)) return false;
        }
        return true;
      }

      function applyManifest(data) {
        if (!data || typeof data !== 'object' || data === null) {
          state = 'UNAVAILABLE';
          return;
        }
        if (!hasExactManifestKeys(data)) {
          state = 'UNAVAILABLE';
          return;
        }
        if (data.contract_version !== '1') {
          state = 'UNAVAILABLE';
          return;
        }
        if (!isValidReleaseSha(data.release_sha)) {
          state = 'UNAVAILABLE';
          return;
        }
        releaseSha = data.release_sha;
        state = 'READY';
      }

      function boundedResult() {
        if (state === 'READY' && releaseSha !== null) {
          return Object.freeze({ ok: true, releaseSha: releaseSha });
        }
        return Object.freeze({ ok: false, code: 'RELEASE_SHA_UNAVAILABLE' });
      }

      function readBoundedManifest() {
        if (requestPromise) return requestPromise;
        requestPromise = new Promise(function (resolve) {
          function settleUnavailable() {
            state = 'UNAVAILABLE';
            resolve(boundedResult());
          }
          try {
            if (typeof window.fetch !== 'function') {
              settleUnavailable();
              return;
            }
            // Same-origin is the fetch default for the auth-mode option, so it
            // is not spelled out here.
            window
              .fetch('/.well-known/release.json', {
                cache: 'no-store',
                headers: { Accept: 'application/json' }
              })
              .then(function (response) {
                if (!response || response.ok !== true || typeof response.json !== 'function') {
                  settleUnavailable();
                  return null;
                }
                return response.json();
              })
              .then(function (data) {
                applyManifest(data);
                resolve(boundedResult());
              })
              .catch(function () {
                settleUnavailable();
              });
          } catch (e) {
            settleUnavailable();
          }
        });
        return requestPromise;
      }

      return Object.freeze({
        getCurrent: function () {
          if (state === 'PENDING') {
            readBoundedManifest();
          }
          return boundedResult();
        },
        getState: function () {
          return state;
        },
        whenReady: function () {
          if (state !== 'PENDING') {
            return Promise.resolve(boundedResult());
          }
          return readBoundedManifest();
        }
      });
    })();
  }

  /* ── #3855 — tree-create write/read convergence wiring ──────────────────────
   * Reuses the #3852 convergence core (js/observability/reliability-write-read-
   * convergence-core.js) with operationClass TREE_CREATE_CONVERGENCE. Bounded
   * and non-blocking: the real apiClient.createTree write is created exactly
   * once per submit and shared by the UI path and the monitoring task; the
   * monitoring task never blocks the redirect, never issues a second write,
   * never mutates modal/cache state, and never exposes the acknowledged tree
   * identity or raw errors. A page-lifetime monotonic generation suppresses
   * stale earlier create flows' observer events after a newer flow starts.
   */
  var apiTreeCreatePromise = null;
  var latestTreeConvergenceGeneration = 0;

  function beginTreeConvergenceGeneration() {
    latestTreeConvergenceGeneration += 1;
    return latestTreeConvergenceGeneration;
  }

  function isLatestTreeGeneration(generation) {
    return generation === latestTreeConvergenceGeneration;
  }

  function getTreeConvergenceCore() {
    if (typeof window.LoveBudWriteReadConvergenceCore !== 'object' || window.LoveBudWriteReadConvergenceCore === null) return null;
    if (typeof window.LoveBudWriteReadConvergenceCore.createConvergenceCore !== 'function') return null;
    return window.LoveBudWriteReadConvergenceCore;
  }

  function getTreeTaxonomy() {
    if (typeof window.LoveBudReliabilitySentinelTaxonomy !== 'object' || window.LoveBudReliabilitySentinelTaxonomy === null) return null;
    return window.LoveBudReliabilitySentinelTaxonomy;
  }

  // #3855 — page-level bounded release authority registered by this module
  // (window.LoveBudReleaseManifestAuthority; pages/my-trees.html forbids active
  // inline script blocks, so the authority lives in this actions module and is
  // available before any create flow runs). getState() is synchronous;
  // getCurrent() returns READY result only; whenReady() is the async readiness
  // seam used by monitoring so the first create is observed while PENDING.
  function getTreeReleaseAuthority() {
    try {
      var authority = window.LoveBudReleaseManifestAuthority;
      if (!authority || typeof authority.getCurrent !== 'function') return null;
      if (typeof authority.getState !== 'function') return null;
      if (typeof authority.whenReady !== 'function') return null;
      return authority;
    } catch (e) {
      return null;
    }
  }

  function getTreeReleaseState() {
    try {
      var authority = getTreeReleaseAuthority();
      if (!authority) return 'UNAVAILABLE';
      return authority.getState();
    } catch (e) {
      return 'UNAVAILABLE';
    }
  }

  // READY -> 40-char lowercase hex; PENDING/UNAVAILABLE -> null. Never blocks.
  function getCurrentTreeReleaseSha() {
    try {
      if (getTreeReleaseState() !== 'READY') return null;
      var authority = getTreeReleaseAuthority();
      if (!authority) return null;
      var state = authority.getCurrent();
      if (!state || state.ok !== true || typeof state.releaseSha !== 'string') return null;
      return /^[0-9a-f]{40}$/.test(state.releaseSha) ? state.releaseSha : null;
    } catch (e) {
      return null;
    }
  }

  // #3855 — canonical reread through the existing repository-owned read
  // authority window.apiClient.getTrees() (the same authority that backs the
  // create snapshot and reconciliation). Returns the authoritative tree list;
  // the convergence core filters rows by the acknowledged repository-owned id.
  function resolveTreeCanonicalReread() {
    try {
      var client = window.apiClient;
      if (!client || typeof client.getTrees !== 'function') return null;
      return function canonicalTreeReread() {
        return client.getTrees();
      };
    } catch (e) {
      return null;
    }
  }

  // #3855 — exactly-once API write. The real apiClient.createTree promise is
  // created once and shared by the UI path and the convergence monitoring path,
  // so monitoring observes the actual transport outcome and can never issue a
  // second write.
  function dispatchTreeCreateOnce(payload) {
    if (apiTreeCreatePromise) return apiTreeCreatePromise;
    var client = window.apiClient;
    if (!client || typeof client.createTree !== 'function') {
      apiTreeCreatePromise = Promise.reject(new Error('createTree API not available'));
      return apiTreeCreatePromise;
    }
    apiTreeCreatePromise = client.createTree(payload).then(function (createdTree) {
      return { createdTree: createdTree, useApi: true };
    });
    return apiTreeCreatePromise;
  }

  // #3855 — fire-and-observe monitoring. Starts synchronously at the creation
  // of the single API write promise so the core records REQUEST_DISPATCHED
  // BEFORE the transport settles. The UI create result never awaits this task,
  // the canonical reread, the observer, or the final summary. Each create flow
  // claims the next generation at start, before any guard, so a later flow
  // always supersedes an earlier flow's observer events — even when the later
  // flow's own monitoring safe-skips. Generation values are closure-local and
  // never exposed in summaries, observer payloads, console, DOM, or storage.
  function monitorTreeCreateConvergence(apiPromise, convergenceObserver) {
    var generation = beginTreeConvergenceGeneration();

    function guardedObserver(summary) {
      if (!isLatestTreeGeneration(generation)) return;
      if (typeof convergenceObserver === 'function') {
        convergenceObserver(summary);
      }
    }

    try {
      var coreFactory = getTreeConvergenceCore();
      var taxonomy = getTreeTaxonomy();
      if (!coreFactory || !taxonomy) return null;
      var authority = getTreeReleaseAuthority();
      if (!authority) return null;
      var canonicalReread = resolveTreeCanonicalReread();
      if (!canonicalReread || typeof canonicalReread !== 'function') return null;

      // A terminal UNAVAILABLE release state safe-skips with zero observer
      // events (no manifest, HTTP error, or already-settled failure).
      if (getTreeReleaseState() === 'UNAVAILABLE') return null;

      var releaseSha = getCurrentTreeReleaseSha();
      var convergence = coreFactory.createConvergenceCore({
        operationClass: 'TREE_CREATE_CONVERGENCE',
        createTree: function () { return apiPromise; },
        canonicalReread: canonicalReread,
        taxonomy: taxonomy,
        releaseSha: releaseSha,
        releaseReadiness: releaseSha
          ? null
          : function () { return authority.whenReady(); },
        observer: guardedObserver
      });
      // converge() records REQUEST_DISPATCHED synchronously before its first
      // await, so this call precedes any API settlement.
      return convergence.converge({});
    } catch (e) {
      myTreesDebugLog('[my-trees-actions] Convergence monitoring unavailable');
      return null;
    }
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
      if (createTreeA11y) {
        createTreeA11y.close();
      } else if (createTreeModalState.escapeHandler) {
        document.removeEventListener('keydown', createTreeModalState.escapeHandler);
        createTreeModalState.escapeHandler = null;
      }
      // Move focus before setting aria-hidden to avoid
      // "Blocked aria-hidden on an element because its descendant retained focus"
      var restoreTarget = createTreeModalState.lastFocusedEl;
      createTreeModalState.lastFocusedEl = null;
      if (createTreeA11y) {
        createTreeA11y.restoreFocusElement(restoreTarget);
      } else if (restoreTarget && typeof restoreTarget.focus === 'function') {
        restoreTarget.focus();
      }
      createTreeModalState.backdrop.setAttribute('aria-hidden', 'true');
      if (!createTreeA11y) {
        document.body.style.overflow = '';
      }
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
      modal.titleInput.value = safeText(i18n, 'default_tree_title', '나의 첫 러브트리');
      modal.setError('');
      modal.setSubmitting(false, i18n);

      if (createTreeA11y) {
        createTreeA11y.open();
      } else {
        // Fallback for helper-absent environments.
        document.body.style.overflow = 'hidden';
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
      }
      if (modal.titleInput && typeof modal.titleInput.select === 'function') {
        modal.titleInput.select();
      }
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
          apiTreeCreatePromise = null;
          var treeApiPromise = dispatchTreeCreateOnce({
            title: modalResult.title,
            visibility: 'public'
          });
          // Start convergence monitoring at dispatch time — before the UI awaits
          // the shared API promise — so REQUEST_DISPATCHED precedes settlement.
          // The returned task is fire-and-observe and never blocks the redirect.
          var treeMonitoringTask = monitorTreeCreateConvergence(treeApiPromise, options && options.convergenceObserver);
          var treeApiResult = await treeApiPromise;
          newTree = treeApiResult ? treeApiResult.createdTree : null;
          if (treeMonitoringTask && typeof treeMonitoringTask.catch === 'function') {
            treeMonitoringTask.catch(function () {
              myTreesDebugLog('[my-trees-actions] Convergence monitoring unavailable');
            });
          }
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
