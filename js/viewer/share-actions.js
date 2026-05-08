(function() {
    'use strict';

    var MARKER = 'LoveBudShareActionsLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    function getCurrentUrl() {
        return window.location.href;
    }

    function getShareData(handlers) {
        var tree = window.LoveBudVisitorViewerData && window.LoveBudVisitorViewerData.tree;
        return {
            title: (tree && tree.title) || document.title || '러브트리',
            url: (handlers && handlers.getShareUrl) ? handlers.getShareUrl() : getCurrentUrl()
        };
    }

    function copyLink(handlers) {
        var data = getShareData(handlers);
        if (!navigator.clipboard) {
            // Fallback: select and copy via textarea
            try {
                var ta = document.createElement('textarea');
                ta.value = data.url;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                return { success: true, message: '링크를 복사했어요' };
            } catch(e) {
                return { success: false, message: '복사하지 못했어요' };
            }
        }
        return navigator.clipboard.writeText(data.url).then(function() {
            return { success: true, message: '링크를 복사했어요' };
        }).catch(function() {
            return { success: false, message: '복사하지 못했어요' };
        });
    }

    function nativeShare(handlers) {
        var data = getShareData(handlers);
        if (typeof navigator.share !== 'function') {
            // Fallback to link copy
            return copyLink(handlers);
        }
        return navigator.share({
            title: data.title,
            text: data.title,
            url: data.url
        }).then(function() {
            return { success: true, message: '공유를 열었어요' };
        }).catch(function(err) {
            if (err.name === 'AbortError') {
                return { success: false, message: '' }; // User cancelled, no feedback needed
            }
            return { success: false, message: '공유하지 못했어요' };
        });
    }

    window.LoveBudShareActions = {
        copyLink: copyLink,
        nativeShare: nativeShare
    };
})();