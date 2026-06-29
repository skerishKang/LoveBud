/**
 * LoveBud Search Shared Renderer Utilities
 * v20260428-1
 *
 * Pure utility functions shared by search card and preview renderers.
 * DOM-agnostic, stateless helpers.
 *
 * This module is the SINGLE AUTHORITATIVE source for view-count alias
 * precedence across all Browse consumers (card renderer, preview hub).
 */

(function() {
    'use strict';

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeUrl(value) {
        if (!value) return '';
        const raw = String(value).trim();
        if (!raw) return '';
        try {
            const parsed = new URL(raw, window.location.origin);
            const protocol = parsed.protocol;
            if (protocol === 'http:' || protocol === 'https:') {
                return parsed.href;
            }
            return '';
        } catch (e) {
            return '';
        }
    }

    function getBasePath() {
        if (window.LoveBudPath?.getBasePath) {
            return window.LoveBudPath.getBasePath();
        }
        const path = window.location.pathname;
        return path.indexOf('/pages/') !== -1 ? '' : 'pages/';
    }

    function isSuspiciousYouTubeThumbnailImage(img) {
        if (!img || !img.currentSrc) return false;
        const src = String(img.currentSrc || img.src || '');
        const isYouTubeThumb = src.includes('ytimg.com/vi/') || src.includes('img.youtube.com/vi/');
        if (!isYouTubeThumb) return false;

        const width = Number(img.naturalWidth || 0);
        const height = Number(img.naturalHeight || 0);
        return width > 0 && height > 0 && width <= 120 && height <= 90;
    }

    /**
     * Canonical view-count alias precedence.
     * Order-sensitive: the first match wins.
     * 0 is a valid display value; null/undefined/NaN/Infinity/negative/empty-string
     * cause fallthrough to the next alias. If no alias yields a valid value,
     * getViewCount returns null (UI hides the views metric).
     */
    var VIEW_COUNT_KEYS = [
        'totalViewCount',
        'viewCount',
        'viewsCount',
        'views',
        'view_count',
        'views_count',
        'visitorCount',
        'visitorsCount',
        'visitCount',
        'visitsCount',
        'visits',
        'openCount',
        'opensCount',
        'open_count'
    ];

    function getViewCount(tree) {
        for (var i = 0; i < VIEW_COUNT_KEYS.length; i += 1) {
            var value = tree && tree[VIEW_COUNT_KEYS[i]];
            if (value !== null && value !== undefined && value !== '') {
                var num = Number(value);
                if (Number.isFinite(num) && num >= 0) return num;
            }
        }
        return null;
    }

    window.LoveBudSearchSharedUtils = {
        escapeHtml: escapeHtml,
        sanitizeUrl: sanitizeUrl,
        getBasePath: getBasePath,
        isSuspiciousYouTubeThumbnailImage: isSuspiciousYouTubeThumbnailImage,
        VIEW_COUNT_KEYS: VIEW_COUNT_KEYS,
        getViewCount: getViewCount
    };

})();
