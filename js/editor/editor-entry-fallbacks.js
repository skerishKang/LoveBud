/**
 * LoveBud - Editor Entry Fallbacks
 *
 * Responsibilities:
 * - expose entry-level fallback factories used by js/editor.js
 * - provide compatibility fallbacks only when canonical editor helper modules are absent
 *
 * This file is intentionally browser-global, not an ES module.
 * It must not register DOM event listeners at load time.
 */
(function() {
    function getEditorBasePath() {
        return window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
    }

    function buildEditorRedirectTarget() {
        return getEditorBasePath() + 'editor.html' + (window.location.search || '');
    }

    function getMyTreesHref() {
        return getEditorBasePath() + 'my-trees.html';
    }

    function createInlineShowToastFallback() {
        return function showToast(message, type) {
            var nextType = type || 'info';

            if (window.LoveBudUI && typeof window.LoveBudUI.showToast === 'function') {
                window.LoveBudUI.showToast(message, nextType, 3000);
                return;
            }

            if (!window.__editorToastWarningShown) {
                console.warn('[editor] LoveBudUI not loaded, toast degraded to console');
                window.__editorToastWarningShown = true;
            }

            console.log('[Toast ' + nextType + '] ' + message);
        };
    }

    function createInlineRedirectToEditorLoginFallback(options) {
        return function redirectToEditorLogin(delayMs) {
            var opts = options || {};
            var basePathResolver = opts.getEditorBasePath || getEditorBasePath;
            var redirectTargetResolver = opts.buildEditorRedirectTarget || buildEditorRedirectTarget;
            var nextDelay = Number(delayMs || 0);
            var loginUrl =
                basePathResolver() +
                'login.html?redirect=' +
                encodeURIComponent(redirectTargetResolver());

            if (nextDelay > 0) {
                setTimeout(function() {
                    window.location.href = loginUrl;
                }, nextDelay);
                return;
            }

            window.location.href = loginUrl;
        };
    }

    function createInlineRenderTreeLoadErrorFallback(options) {
        return function renderTreeLoadError(renderOptions) {
            var opts = options || {};
            var nextOptions = renderOptions || {};
            var canvas = nextOptions.canvas;
            var addBtn = nextOptions.addBtn;
            var errorTitle = nextOptions.errorTitle;
            var errorDesc = nextOptions.errorDesc;
            var i18n = nextOptions.i18n;
            var escapeHtml = nextOptions.escapeHtml;
            var setDetailEmptyState = nextOptions.setDetailEmptyState;
            var myTreesHrefResolver = opts.getMyTreesHref || getMyTreesHref;

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
                        '<a href="' + escapeHtml(myTreesHrefResolver()) + '" class="btn-round btn-primary" style="padding:10px 16px;text-decoration:none;">' +
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
        };
    }

    function createInlineFormatTimeAgoFallback() {
        return function formatTimeAgo(date) {
            if (!date) return '';

            var timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
            if (Number.isNaN(timestamp)) return '';

            var diff = Math.floor((Date.now() - timestamp) / 1000);
            if (diff < 60) return '방금';
            if (diff < 3600) return Math.floor(diff / 60) + '분 전';
            if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
            return Math.floor(diff / 86400) + '일 전';
        };
    }

    var entryFallbacks = {
        createInlineShowToastFallback: createInlineShowToastFallback,
        createInlineRedirectToEditorLoginFallback: createInlineRedirectToEditorLoginFallback,
        createInlineRenderTreeLoadErrorFallback: createInlineRenderTreeLoadErrorFallback,
        createInlineFormatTimeAgoFallback: createInlineFormatTimeAgoFallback
    };

    window.LoveBudEditorEntryFallbacks = Object.assign(
        {},
        entryFallbacks,
        window.LoveBudEditorEntryFallbacks || {}
    );

    window.LoveBudEditorHelpers = window.LoveBudEditorHelpers || {};
    if (typeof window.LoveBudEditorHelpers.createToast !== 'function') {
        window.LoveBudEditorHelpers.createToast = function() {
            return createInlineShowToastFallback();
        };
    }

    window.LoveBudEditorPageHelpers = window.LoveBudEditorPageHelpers || {};
    if (typeof window.LoveBudEditorPageHelpers.getEditorBasePath !== 'function') {
        window.LoveBudEditorPageHelpers.getEditorBasePath = getEditorBasePath;
    }
    if (typeof window.LoveBudEditorPageHelpers.buildEditorRedirectTarget !== 'function') {
        window.LoveBudEditorPageHelpers.buildEditorRedirectTarget = buildEditorRedirectTarget;
    }
    if (typeof window.LoveBudEditorPageHelpers.getMyTreesHref !== 'function') {
        window.LoveBudEditorPageHelpers.getMyTreesHref = getMyTreesHref;
    }
    if (typeof window.LoveBudEditorPageHelpers.redirectToEditorLogin !== 'function') {
        window.LoveBudEditorPageHelpers.redirectToEditorLogin = createInlineRedirectToEditorLoginFallback({
            getEditorBasePath: window.LoveBudEditorPageHelpers.getEditorBasePath,
            buildEditorRedirectTarget: window.LoveBudEditorPageHelpers.buildEditorRedirectTarget
        });
    }
    if (typeof window.LoveBudEditorPageHelpers.renderTreeLoadError !== 'function') {
        window.LoveBudEditorPageHelpers.renderTreeLoadError = createInlineRenderTreeLoadErrorFallback({
            getMyTreesHref: window.LoveBudEditorPageHelpers.getMyTreesHref
        });
    }

    window.LoveBudEditorSaveStatus = window.LoveBudEditorSaveStatus || {};
    if (typeof window.LoveBudEditorSaveStatus.formatTimeAgo !== 'function') {
        window.LoveBudEditorSaveStatus.formatTimeAgo = createInlineFormatTimeAgoFallback();
    }
})();
