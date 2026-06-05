(function () {
    'use strict';

    window.LoveBudEditorShellUtils = {
        getI18n: function() {
        return window.t || ((k) => k);
    },
        getEditorBasePath: function() {
        return window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
    },
        buildEditorRedirectTarget: function() {
        return this.getEditorBasePath() + 'editor' + (window.location.search || '');
    },
        getHttpStatus: function(error) {
        return Number(
            (error && error.status) ||
            (error && error.statusCode) ||
            (error && error.response && error.response.status) ||
            0
        );
    },
        resolveSaveStatusTimeFormatter: function(options) {
        var opts = options || {};
        var editorSaveStatus = opts.editorSaveStatus || {};

        return editorSaveStatus.formatTimeAgo;
    },
        createInlineShowToastFallback: function() {
        return (message, type = 'info') => {
            if (window.LoveBudUI?.showToast) {
                window.LoveBudUI.showToast(message, type, 3000);
            } else {
                if (!window.__editorToastWarningShown) {
                    console.warn('[editor] LoveBudUI not loaded, toast degraded to console');
                    window.__editorToastWarningShown = true;
                }
                console.log(`[Toast ${type}] ${message}`);
            }
        };
    },
        getYouTubeInputErrorMessageFallback: function(i18n, rawUrl) {
        var value = String(rawUrl || '').trim();

        if (!value) {
            return i18n('enter_youtube') || 'YouTube 링크를 입력해 주세요.';
        }

        if (!/^(https?:\/\/|www\.)/i.test(value)) {
            return i18n('invalid_youtube_format') || '전체 YouTube 링크를 붙여 넣어 주세요.';
        }

        if (!/(youtube\.com|youtu\.be|youtube\.com\/shorts\/)/i.test(value)) {
            return i18n('invalid_youtube_unsupported') || 'YouTube 링크만 지원합니다. youtube.com 또는 youtu.be 링크를 사용해 주세요.';
        }

        var match = value.match(/(?:v=|\/|youtu\.be\/|shorts\/)([0-9A-Za-z_-]+)/i);
        if (match && match[1].length !== 11) {
            return i18n('invalid_youtube_id_length') || '링크가 중간에 잘린 것 같아요. 전체 YouTube 링크를 다시 복사해 주세요.';
        }

        return i18n('invalid_youtube') || '유효한 YouTube 링크를 입력해 주세요.';
    },
        createEditorDebugReporter: function(options) {
        var opts = options || {};
        var debugState = opts.debugState || (window.LoveBudEditorDebug = window.LoveBudEditorDebug || { logs: [], errors: [] });
        var consoleRef = opts.consoleRef || console;
        var now = opts.now || function() { return new Date(); };

        var log = function(msg) {
            var entry = '[editor-main] ' + now().toISOString().split('T')[1] + ' ' + msg;
            consoleRef.log(entry);
            debugState.logs.push(entry);
        };

        var reportError = function(msg, err) {
            consoleRef.error('[editor-main] ERROR: ' + msg, err);
            debugState.errors.push({ msg: msg, error: err && err.message ? err.message : err });
        };

        return {
            debugState: debugState,
            log: log,
            reportError: reportError
        };
    }
    };
})();
