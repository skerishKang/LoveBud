/**
 * LoveBud Browse Preview Share Helper
 * v20260629-2772-1
 *
 * Manages the read-only LoveTree share URL for the Browse preview hub.
 * Produces canonical /pages/view.html?treeId=<encoded> links and handles
 * clipboard copy with toast feedback.
 *
 * This module is independent of the SearchUI factory — it provides a
 * dedicated preview social shell renderer that the playable hub patch
 * delegates to.
 */
(function () {
    'use strict';

    // -----------------------------------------------------------------------
    // Utilities
    // -----------------------------------------------------------------------

    function getSharedUtils() {
        return window.LoveBudSearchSharedUtils || null;
    }

    function escapeHtml(value) {
        var utils = getSharedUtils();
        if (utils && typeof utils.escapeHtml === 'function') return utils.escapeHtml(value);
        if (window.LoveBudSecurity && typeof window.LoveBudSecurity.escapeHtml === 'function') {
            return window.LoveBudSecurity.escapeHtml(value);
        }
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // -----------------------------------------------------------------------
    // Canonical read-only URL builder
    // -----------------------------------------------------------------------

    /**
     * Build a read-only LoveTree viewer URL for sharing.
     *
     * @param {string} treeId - The tree's unique identifier.
     * @param {object} locationLike - An object with an `origin` property
     *   (defaults to `window.location`).
     * @returns {string} Absolute URL to the read-only view page, or empty
     *   string if treeId is falsy.
     */
    function buildReadOnlyTreeUrl(treeId, locationLike) {
        if (!treeId) return '';
        var base = (locationLike && locationLike.origin) || window.location.origin;
        var url = new URL('/pages/view.html', base);
        url.searchParams.set('treeId', String(treeId));
        return url.toString();
    }

    // -----------------------------------------------------------------------
    // Preview social shell renderer (truthful — no fake counts)
    // -----------------------------------------------------------------------

    /**
     * Render the preview social shell for the Browse hub.
     *
     * The shell contains only:
     *   - A view-count stat (when a valid count exists)
     *   - A read-only "공유하기" share button
     *
     * No likes, comments, or fake share counts are displayed.
     *
     * @param {object} tree - The tree object from the Browse API.
     * @returns {string} HTML string for the social shell, or empty string
     *   when tree is missing.
     */
    function renderPreviewSocialShell(tree) {
        if (!tree) return '';

        var utils = getSharedUtils();
        var viewCount = utils && typeof utils.getViewCount === 'function' ? utils.getViewCount(tree) : null;
        var safeTreeId = escapeHtml(String(tree.id || ''));

        // ---- View count stat ----
        var viewsHtml = '';
        if (viewCount !== null) {
            viewsHtml = '<div class="preview-social-action preview-social-stat" aria-label="조회수 ' +
                escapeHtml(String(viewCount)) +
                '" role="status"><span class="material-symbols-outlined" aria-hidden="true">visibility</span><strong>' +
                escapeHtml(String(viewCount)) +
                '</strong><span>조회수</span></div>';
        }

        // ---- Share button (only when tree ID is valid) ----
        var shareHtml = '';
        if (safeTreeId) {
            shareHtml = '<button type="button" class="preview-social-action" data-preview-share-tree-id="' +
                safeTreeId +
                '" aria-label="공유하기"><span class="material-symbols-outlined" aria-hidden="true">share</span><span data-preview-share-label>공유하기</span></button>';
        }

        if (!viewsHtml && !shareHtml) return '';

        return '<div class="preview-social-shell" data-preview-social-shell>' +
            '<div class="preview-social-bar" aria-label="트리 반응">' +
                viewsHtml +
                shareHtml +
            '</div>' +
        '</div>';
    }

    // -----------------------------------------------------------------------
    // Clipboard helpers
    // -----------------------------------------------------------------------

    /**
     * Attempt to copy text to the clipboard.
     *
     * Primary: `navigator.clipboard.writeText` (requires secure context /
     *   user gesture).
     * Fallback: create a temporary textarea, select it, and run
     *   `document.execCommand('copy')`.
     *
     * @param {string} text - The text to copy.
     * @param {Document} doc - Document instance (defaults to `document`).
     * @param {object} clipboard - Clipboard API object (defaults to
     *   `navigator.clipboard`).
     * @returns {Promise<boolean>} Resolves true on success, false on failure.
     *   Never throws.
     */
    async function copyToClipboard(text, doc, clipboard) {
        var targetDoc = doc || document;
        var targetClipboard = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);

        try {
            // Primary: native Clipboard API
            if (targetClipboard && typeof targetClipboard.writeText === 'function') {
                await targetClipboard.writeText(text);
                return true;
            }
        } catch (clipError) {
            // Fall through to textarea fallback
        }

        try {
            // Fallback: textarea + execCommand
            var textarea = targetDoc.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            textarea.style.width = '1px';
            textarea.style.height = '1px';
            textarea.style.opacity = '0';
            targetDoc.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, text.length);
            var ok = targetDoc.execCommand('copy');
            targetDoc.body.removeChild(textarea);
            return ok;
        } catch (fallbackError) {
            return false;
        }
    }

    /**
     * Show a brief user-facing notification.
     *
     * Prefers `window.LoveBudUI.showToast(message, type)`. Falls back to
     * temporarily changing the share button's label when the button element
     * is provided.
     *
     * @param {string} message - The text to display.
     * @param {string} type - Toast type ('success' or 'error').
     * @param {HTMLElement} [button] - Optional share button for fallback.
     */
    function showFeedback(message, type, button) {
        var ui = window.LoveBudUI;
        if (ui && typeof ui.showToast === 'function') {
            ui.showToast(message, type);
            return;
        }
        // Fallback: swap button label then restore
        if (!button) return;
        var label = button.querySelector('[data-preview-share-label]');
        if (!label) return;
        var original = label.textContent;
        label.textContent = message;
        window.setTimeout(function () {
            label.textContent = original;
        }, 1500);
    }

    // -----------------------------------------------------------------------
    // Delegated share click handler
    // -----------------------------------------------------------------------

    var _handlerBound = false;

    /**
     * Bind a single delegated click handler for share buttons.
     *
     * The handler matches `[data-preview-share-tree-id]`. It builds the
     * canonical read-only URL, copies it to the clipboard, and shows
     * success/failure feedback.
     *
     * Calling this function more than once is safe — only one listener
     * is ever attached to the document.
     *
     * @param {function} [getSearchCopy] - Optional i18n copy function
     *   (unused placeholder for backward compat).
     * @param {Document} doc - The document to listen on.
     */
    function bindPreviewShareHandler(getSearchCopy, doc) {
        if (_handlerBound) return;
        _handlerBound = true;

        var targetDoc = doc || document;

        targetDoc.addEventListener('click', async function (event) {
            var shareButton = event.target.closest('[data-preview-share-tree-id]');
            if (!shareButton) return;

            event.preventDefault();

            var treeId = shareButton.getAttribute('data-preview-share-tree-id');
            if (!treeId) return;

            var url = buildReadOnlyTreeUrl(treeId);
            if (!url) return;

            var ok = await copyToClipboard(url);
            if (ok) {
                showFeedback('링크가 복사됐어요', 'success', shareButton);
            } else {
                showFeedback('복사하지 못했어요', 'error', shareButton);
            }
        });
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    window.LoveBudSearchShareLink = {
        buildReadOnlyTreeUrl: buildReadOnlyTreeUrl,
        renderPreviewSocialShell: renderPreviewSocialShell,
        copyToClipboard: copyToClipboard,
        showFeedback: showFeedback,
        bindPreviewShareHandler: bindPreviewShareHandler,
        escapeHtml: escapeHtml
    };

})();
