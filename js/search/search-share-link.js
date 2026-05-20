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

    function bindShareLinkHandler(getSearchCopy, doc, clipboard, locationLike) {
        var targetDocument = doc || document;
        var targetClipboard = clipboard || navigator.clipboard;
        var targetLocation = locationLike || window.location;

        targetDocument.addEventListener('click', async function (event) {
            var shareButton = event.target.closest('[data-share-tree-link]');
            if (!shareButton) return;

            event.preventDefault();

            var treeId = shareButton.dataset.shareTreeLink;
            if (!treeId) return;

            var labelSpan = shareButton.querySelector('[data-share-tree-link-label]');
            if (!labelSpan) return;

            var originalText = labelSpan.textContent;
            var statusText = getStatusText(getSearchCopy);

            try {
                var shareUrl = buildSearchTreeUrl(treeId, targetLocation.origin);
                await targetClipboard.writeText(shareUrl);
                labelSpan.textContent = statusText.success;
                restoreTextLater(labelSpan, originalText, 1500);
            } catch (error) {
                console.warn('[search] clipboard copy failed:', error.message);
                labelSpan.textContent = statusText.failure;
                restoreTextLater(labelSpan, originalText, 1500);
            }
        });
    }

    function patchSearchUIFactory() {
        var SearchUI = window.LoveBudSearchUI;
        if (!SearchUI || typeof SearchUI.createSearchUI !== 'function' || SearchUI.__shareLinkHelperPatched) return;

        var originalCreateSearchUI = SearchUI.createSearchUI;
        SearchUI.createSearchUI = function (config) {
            var ui = originalCreateSearchUI(config);
            if (!ui || ui.__shareLinkHelperPatched) return ui;

            ui.bindShareCopyHandler = function () {
                return bindShareLinkHandler(ui.getSearchCopy, document, navigator.clipboard, window.location);
            };
            ui.__shareLinkHelperPatched = true;
            return ui;
        };

        SearchUI.__shareLinkHelperPatched = true;
    }

    window.LoveBudSearchShareLink = {
        buildSearchTreeUrl: buildSearchTreeUrl,
        getStatusText: getStatusText,
        restoreTextLater: restoreTextLater,
        bindShareLinkHandler: bindShareLinkHandler,
        patchSearchUIFactory: patchSearchUIFactory
    };

    patchSearchUIFactory();
})();
