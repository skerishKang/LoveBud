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
    return getEditorBasePath() + 'editor.html' + (window.location.search || '');
  }

  function redirectToEditorLogin(delayMs) {
    var nextDelay = Number(delayMs || 0);
    var loginUrl =
      getEditorBasePath() +
      'login.html?redirect=' +
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
    return getEditorBasePath() + 'my-trees.html';
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

  window.LoveBudEditorPageHelpers = {
    getEditorBasePath: getEditorBasePath,
    buildEditorRedirectTarget: buildEditorRedirectTarget,
    redirectToEditorLogin: redirectToEditorLogin,
    getMyTreesHref: getMyTreesHref,
    renderTreeLoadError: renderTreeLoadError
  };
})();
