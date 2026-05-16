/**
 * LoveBud Security Utilities
 * v20260516-1
 *
 * Canonical sanitization utilities for frontend DOM XSS defense.
 * All modules should eventually reference window.LoveBudSecurity.
 */
(function() {
    'use strict';

    if (window.LoveBudSecurity) return;

    /**
     * HTML-escape a value for safe innerHTML and attribute injection.
     *
     * Escapes: & < > " '
     * Preserves 0 / false as strings.
     * null / undefined → ''.
     *
     * @param {*} value
     * @returns {string}
     */
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Sanitize a URL to only allow http: and https: protocols.
     *
     * Rejects:
     *   - javascript:
     *   - data: (use safeUrl with allowDataImage option for images)
     *   - vbscript:
     *   - Invalid or empty URLs
     *
     * @param {*} value
     * @returns {string} Sanitized URL or empty string
     */
    function sanitizeUrl(value) {
        if (!value) return '';
        var raw = String(value).trim();
        if (!raw) return '';
        // Only accept absolute URLs with explicit http/https protocol
        if (!/^https?:\/\//i.test(raw)) return '';
        try {
            var parsed = new URL(raw);
            var protocol = String(parsed.protocol).toLowerCase();
            if (protocol === 'http:' || protocol === 'https:') {
                return parsed.href;
            }
            return '';
        } catch (e) {
            return '';
        }
    }

    window.LoveBudSecurity = {
        escapeHtml: escapeHtml,
        sanitizeUrl: sanitizeUrl
    };
})();
