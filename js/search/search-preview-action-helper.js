/**
 * LoveBud Search Preview Action Helper
 * v20260501-1
 * 
 * CTA and share markup helper for search preview.
 * Extracted from search-preview-renderer.js to separate concerns.
 * 
 * Dependencies: LoveBudSearchPreviewCopyHelper (for copy/locale)
 */

(function() {
    'use strict';

    /**
     * Get shared utilities from LoveBudSearchSharedUtils
     * @returns {Object|null} Shared utils instance
     */
    function getSharedUtils() {
        return window.LoveBudSearchSharedUtils || null;
    }

    /**
     * Escape HTML for safe rendering
     * @param {string} value - Value to escape
     * @returns {string} Escaped HTML
     */
    function escapeHtml(value) {
        const utils = getSharedUtils();
        if (utils?.escapeHtml) {
            return utils.escapeHtml(value);
        }
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Get base path for navigation
     * @returns {string} Base path
     */
    function getBasePath() {
        const utils = getSharedUtils();
        if (utils?.getBasePath) {
            return utils.getBasePath();
        }
        if (window.LoveBudPath?.getBasePath) {
            return window.LoveBudPath.getBasePath();
        }
        const path = window.location.pathname;
        return path.indexOf('/pages/') !== -1 ? '' : 'pages/';
    }

    /**
     * Get search copy from copy helper with fallbacks
     * @param {string} key - i18n key
     * @param {string} fallbackKo - Korean fallback
     * @param {string} fallbackEn - English fallback
     * @returns {string} Localized copy
     */
    function getSearchCopy(key, fallbackKo, fallbackEn) {
        const helper = window.LoveBudSearchPreviewCopyHelper;
        if (helper?.getSearchCopy) {
            return helper.getSearchCopy(key, fallbackKo, fallbackEn);
        }
        // Fallback to basic logic if copy helper not available
        const locale = window.i18n?.currentLang || document.documentElement?.lang || 'ko';
        const dict = window.i18nSearch?.[key];
        if (dict && typeof dict === 'object') {
            return dict[locale] || dict.ko || dict.en || fallbackKo;
        }
        return String(locale).toLowerCase().startsWith('en') ? fallbackEn : fallbackKo;
    }

    /**
     * Generate tree detail href for CTA button
     * @param {Object} tree - Tree object
     * @returns {string} Detail page href
     */
    function getTreeDetailHref(tree) {
        const memories = Array.isArray(tree?.memories) ? tree.memories : [];
        const firstMemory = memories[0];
        if (!tree?.id || !firstMemory?.id) return '';
        const basePath = getBasePath();
        return `${basePath}detail.html?id=${encodeURIComponent(firstMemory.id)}&tree=${encodeURIComponent(tree.id)}&from=browse`;
    }

    /**
     * Render preview action button (CTA)
     * @param {Object} tree - Tree object
     * @returns {string} Button HTML markup
     */
    function renderPreviewActionButton(tree) {
        const href = getTreeDetailHref(tree);
        if (!href) return '';
        const label = getSearchCopy(
            'search.previewOpenTreeCta',
            '이 트리 열기',
            'Open this tree'
        );
        return `
            <a href="${escapeHtml(href)}" class="btn-round btn-primary preview-primary-action" style="width:100%;margin-top:18px;min-height:50px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:14px;font-weight:800;gap:8px;">
                <span class="material-symbols-outlined" style="font-size:18px;">play_circle</span>
                ${escapeHtml(label)}
            </a>
        `;
    }

    /**
     * Render share button
     * @param {Object} tree - Tree object
     * @returns {string} Share button HTML markup
     */
    function renderShareButton(tree) {
        if (!tree?.id) return '';
        const label = getSearchCopy(
            'search.previewShareLink',
            '감상 링크 복사',
            'Copy view link'
        );
        return `
            <button type="button" data-share-tree-link="${escapeHtml(tree.id)}" class="btn-round preview-share-action" style="width:100%;margin-top:12px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;gap:6px;background:var(--surface-container);color:var(--on-surface-variant);border:1px solid var(--outline-variant);">
                <span class="material-symbols-outlined" style="font-size:16px;">link</span>
                <span data-share-tree-link-label>${escapeHtml(label)}</span>
            </button>
        `;
    }

    // Public API
    window.LoveBudSearchPreviewActionHelper = {
        getTreeDetailHref: getTreeDetailHref,
        renderPreviewActionButton: renderPreviewActionButton,
        renderShareButton: renderShareButton
    };

    console.log('[LoveBudSearchPreviewActionHelper] Search preview action helper loaded v20260501-1');
})();
