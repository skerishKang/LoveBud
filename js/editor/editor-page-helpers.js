/**
 * LoveBud - Editor Page Helpers
 * v20260420-1
 *
 * Responsibilities:
 * - editor/login/my-trees path helpers
 * - login redirect target builder
 * - tree-load error UI renderer
 */

(function() {
  function getEditorBasePath() {
    return window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
  }

  function buildEditorRedirectTarget() {
    return getEditorBasePath() + 'editor' + (window.location.search || '');
  }

  function redirectToEditorLogin(delayMs) {
    var nextDelay = Number(delayMs || 0);
    var loginUrl =
      getEditorBasePath() +
      'login?redirect=' +
      encodeURIComponent(buildEditorRedirectTarget());

    if (nextDelay > 0) {
      setTimeout(function() {
        window.location.href = loginUrl;
      }, nextDelay);
      return;
    }

    window.location.href = loginUrl;
  }

  function getMyTreesHref() {
    return getEditorBasePath() + 'my-trees';
  }

  function buildMomentDetailHref(options) {
    var opts = options || {};
    var memoryId = opts.memoryId || opts.id;
    var treeId = opts.treeId;
    var basePathResolver = opts.getEditorBasePath || getEditorBasePath;

    if (!memoryId || !treeId) return '';

    return (
      basePathResolver() +
      'detail.html?id=' +
      encodeURIComponent(memoryId) +
      '&tree=' +
      encodeURIComponent(treeId) +
      '&from=editor'
    );
  }

  function openMomentDetail(options) {
    var opts = options || {};
    var href = buildMomentDetailHref(opts);
    var locationRef = opts.locationRef || window.location;

    if (!href || !locationRef) return '';

    locationRef.href = href;
    return href;
  }

  function buildTreeLoadErrorCopy(options) {
    var opts = options || {};
    var treeLoadStatus = opts.treeLoadStatus || opts.status || 'not_found';
    var treeLoadErrorMessage = opts.treeLoadErrorMessage || opts.errorMessage || '';
    var i18n = opts.i18n || function(key) { return key; };
    var isAccessDenied = /Access denied/i.test(treeLoadErrorMessage);

    var errorTitle = treeLoadStatus === 'api_unavailable'
      ? (i18n('tree_load_fail_title') || '트리를 불러올 수 없어요')
      : isAccessDenied
        ? (i18n('tree_access_denied_title') || '이 러브트리를 열 권한이 없어요')
        : treeLoadStatus === 'error'
          ? (i18n('tree_load_error_title') || '트리를 여는 중 문제가 발생했어요')
          : (i18n('tree_not_found_title') || '트리를 찾을 수 없어요');

    var errorDesc = treeLoadStatus === 'api_unavailable'
      ? (i18n('tree_load_api_unavailable') || '트리 조회 API를 사용할 수 없는 상태입니다. 잠시 후 다시 시도해 주세요.')
      : isAccessDenied
        ? (i18n('tree_access_denied_desc') || '비공개 러브트리이거나 내 계정에 권한이 없어요. 다시 확인하거나 다른 계정으로 로그인해 보세요.')
        : treeLoadStatus === 'error'
          ? (i18n('tree_load_error_desc') || '일시적인 서버 문제 또는 접근 권한 문제일 수 있습니다. 다시 시도하거나 트리 목록으로 돌아가 주세요.')
          : (i18n('tree_load_not_found_desc') || '잘못된 링크이거나 접근 권한이 없는 트리입니다.');

    return {
      errorTitle: errorTitle,
      errorDesc: errorDesc
    };
  }

  function renderTreeLoadError(options) {
    var canvas = options && options.canvas;
    var addBtn = options && options.addBtn;
    var errorTitle = options && options.errorTitle;
    var errorDesc = options && options.errorDesc;
    var i18n = options && options.i18n;
    var escapeHtml = options && options.escapeHtml;
    var setDetailEmptyState = options && options.setDetailEmptyState;

    if (!canvas || typeof escapeHtml !== 'function') return;

    var retryLabel = (typeof i18n === 'function' && i18n('retry')) || '다시 시도';
    var myTreesLabel = (typeof i18n === 'function' && i18n('go_to_my_trees')) || '내 트리로 가기';

    canvas.innerHTML =
      '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;padding:32px;background:rgba(255,255,255,0.96);border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:360px;width:calc(100% - 32px);">' +
        '<div style="font-size:48px;margin-bottom:16px;">🌱</div>' +
        '<div style="font-size:1.2rem;font-weight:800;margin-bottom:8px;color:var(--on-surface);">' +
          escapeHtml(errorTitle) +
        '</div>' +
        '<div style="font-size:14px;color:var(--on-surface-variant);line-height:1.6;margin-bottom:20px;">' +
          escapeHtml(errorDesc) +
        '</div>' +
        '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">' +
          '<button type="button" id="retryOpenTreeBtn" class="btn-round btn-outline" style="padding:10px 16px;">' +
            retryLabel +
          '</button>' +
          '<a href="' + escapeHtml(getMyTreesHref()) + '" class="btn-round btn-primary" style="padding:10px 16px;text-decoration:none;">' +
            myTreesLabel +
          '</a>' +
        '</div>' +
      '</div>';

    if (typeof setDetailEmptyState === 'function') {
      setDetailEmptyState(true);
    }

    var retryBtn = document.getElementById('retryOpenTreeBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', function() {
        window.location.reload();
      });
    }

    if (addBtn) addBtn.disabled = true;
  }

  function registerEditorAuthStart(options) {
    var windowRef = options.windowRef;
    var startEditor = options.startEditor;
    var redirectToEditorLogin = options.redirectToEditorLogin;
    var readConfirmedAuthCache = options.readConfirmedAuthCache;

    var editorStarted = false;
    var editorRedirecting = false;

    function resolveSettledAuthUser(windowRef, callbackUser) {
      if (callbackUser && callbackUser.uid) {
        return { pending: false, user: callbackUser };
      }

      var bootstrap = windowRef.LoveBudAuthBootstrap;
      var snapshot = bootstrap && typeof bootstrap.getSnapshot === 'function'
        ? bootstrap.getSnapshot()
        : null;

      if (!snapshot || snapshot.ready !== true) {
        return { pending: true, user: null };
      }

      return { pending: false, user: snapshot.user || null };
    }

    function tryStartEditor(user) {
      if (editorStarted) {
        if (user && (!windowRef.currentTreeMemories || windowRef.currentTreeMemories.length <= 1)) {
          if (windowRef.refreshMemories) windowRef.refreshMemories();
        }
        return;
      }

      var search = windowRef.location.search || '';
      var params = new URLSearchParams(search);
      var treeId = params.get('treeId');

      if (treeId) {
        var settled = resolveSettledAuthUser(windowRef, user);
        if (settled.pending) {
          return;
        }

        if (!settled.user || !settled.user.uid) {
          if (!editorRedirecting) {
            editorRedirecting = true;
            redirectToEditorLogin();
          }
          return;
        }
      } else {
        // Fallback for new tree creation path (no treeId in URL)
        var settled = resolveSettledAuthUser(windowRef, user);
        if (settled.pending) {
          return;
        }
        if (!settled.user || !settled.user.uid) {
          var cachedUser = readConfirmedAuthCache();
          if (!cachedUser || !cachedUser.uid) {
            if (!editorRedirecting) {
              editorRedirecting = true;
              redirectToEditorLogin();
            }
            return;
          }
        }
      }

      editorStarted = true;
      startEditor();
    }

    if (typeof windowRef.registerOnAuthReady === 'function') {
      windowRef.registerOnAuthReady(tryStartEditor);
    } else {
      windowRef.onAuthReady = tryStartEditor;
    }

    return tryStartEditor;
  }

  window.LoveBudEditorPageHelpers = {
    getEditorBasePath: getEditorBasePath,
    buildEditorRedirectTarget: buildEditorRedirectTarget,
    redirectToEditorLogin: redirectToEditorLogin,
    getMyTreesHref: getMyTreesHref,
    buildMomentDetailHref: buildMomentDetailHref,
    openMomentDetail: openMomentDetail,
    buildTreeLoadErrorCopy: buildTreeLoadErrorCopy,
    renderTreeLoadError: renderTreeLoadError,
    registerEditorAuthStart: registerEditorAuthStart
  };
})();
