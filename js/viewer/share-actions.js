(function() {
    'use strict';

    var MARKER = 'LoveBudShareActionsLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    function getCurrentUrl() {
        return window.location.href;
    }

    function getPublicShareUrl(url) {
        try {
            var u = new URL(url || getCurrentUrl(), getCurrentUrl());
            u.hash = '';
            return u.href;
        } catch(e) {
            return getCurrentUrl();
        }
    }

    function getShareData(handlers) {
        var tree = window.LoveBudVisitorViewerData && window.LoveBudVisitorViewerData.tree;
        var url = (handlers && handlers.getShareUrl) ? handlers.getShareUrl() : getCurrentUrl();
        return {
            title: (tree && tree.title) || document.title || '러브트리',
            url: getPublicShareUrl(url)
        };
    }

    function getPlatformIntent(platform, handlers) {
        var data = getShareData(handlers);
        var label = String(platform || '').toLowerCase();
        var intent;

        if (label === 'x' || label === 'twitter') {
            intent = new URL('https://twitter.com/intent/tweet');
            intent.searchParams.set('text', data.title);
            intent.searchParams.set('url', data.url);
            return { url: intent.href, mode: 'popup' };
        }

        if (label === 'facebook') {
            intent = new URL('https://www.facebook.com/sharer/sharer.php');
            intent.searchParams.set('u', data.url);
            return { url: intent.href, mode: 'popup' };
        }

        if (label === 'email' || label === 'mail') {
            return {
                url: 'mailto:?subject=' + encodeURIComponent(data.title) +
                    '&body=' + encodeURIComponent(data.title + '\n' + data.url),
                mode: 'location'
            };
        }

        return null;
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

    function shareToPlatform(handlers, platform) {
        var intent = getPlatformIntent(platform, handlers);
        if (!intent) return copyLink(handlers);

        try {
            if (intent.mode === 'location') {
                window.location.href = intent.url;
                return Promise.resolve({ success: true, message: '공유를 열었어요' });
            }

            var opened = window.open(intent.url, '_blank', 'noopener,noreferrer');
            if (!opened) return copyLink(handlers);
            return Promise.resolve({ success: true, message: '공유를 열었어요' });
        } catch(e) {
            return copyLink(handlers);
        }
    }

    window.LoveBudShareActions = {
        copyLink: copyLink,
        nativeShare: nativeShare,
        getPlatformIntent: getPlatformIntent,
        shareToPlatform: shareToPlatform
    };
})();
