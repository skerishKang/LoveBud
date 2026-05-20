(function () {
    'use strict';

    function buildSearchTreeUrl(treeId, origin) {
        if (!treeId) return '';
        var url = new URL('/pages/search', origin || window.location.origin);
        url.searchParams.set('tree', treeId);
        return url.toString();
    }

    function getStatusText(getSearchCopy) {
        var copy = typeof getSearchCopy === 'function' ? getSearchCopy : null;
        return {
            success: copy ? copy('search.previewShareLinkCopied', '링크가 복사됐어요', 'Link copied') : '링크가 복사됐어요',
            failure: copy ? copy('search.previewShareLinkFailed', '복사하지 못했어요', 'Copy failed') : '복사하지 못했어요'
        };
    }

    function restoreTextLater(element, text, delayMs) {
        if (!element) return;
        window.setTimeout(function () {
            element.textContent = text;
        }, delayMs || 1500);
    }

    window.LoveBudSearchShareLink = {
        buildSearchTreeUrl: buildSearchTreeUrl,
        getStatusText: getStatusText,
        restoreTextLater: restoreTextLater
    };
})();
