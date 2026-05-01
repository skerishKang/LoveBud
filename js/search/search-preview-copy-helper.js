/**
 * LoveBud Search Preview Copy Helper
 * v20260501-1
 * 
 * Copy and locale formatting helper for search preview.
 * Extracted from search-preview-renderer.js to separate concerns.
 * 
 * Dependencies: None (standalone helper)
 */

(function() {
    'use strict';

    /**
     * Get current locale from i18n or document
     * @returns {string} 'en' or 'ko'
     */
    function getCurrentLocale() {
        const locale = window.i18n?.currentLang || document.documentElement?.lang || 'ko';
        return String(locale).toLowerCase().startsWith('en') ? 'en' : 'ko';
    }

    /**
     * Get search copy from i18n dictionary with fallbacks
     * @param {string} key - i18n key
     * @param {string} fallbackKo - Korean fallback
     * @param {string} fallbackEn - English fallback
     * @returns {string} Localized copy
     */
    function getSearchCopy(key, fallbackKo, fallbackEn) {
        const locale = getCurrentLocale();
        const dict = window.i18nSearch?.[key];
        if (dict && typeof dict === 'object') {
            return dict[locale] || dict.ko || dict.en || fallbackKo;
        }
        return locale === 'en' ? fallbackEn : fallbackKo;
    }

    /**
     * Format search copy with template replacements
     * @param {string} key - i18n key
     * @param {Object} replacements - Template variables
     * @param {string} fallbackKo - Korean fallback template
     * @param {string} fallbackEn - English fallback template
     * @returns {string} Formatted copy
     */
    function formatSearchCopy(key, replacements, fallbackKo, fallbackEn) {
        const template = getSearchCopy(key, fallbackKo, fallbackEn);
        return String(template).replace(/\{(\w+)\}/g, (_, token) => {
            return Object.prototype.hasOwnProperty.call(replacements, token)
                ? String(replacements[token])
                : '';
        });
    }

    /**
     * Format date for locale display (minimal helper for timeline labels)
     * @param {string|Date} value - Date value
     * @returns {string} Formatted date
     */
    function formatShortDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString(getCurrentLocale() === 'en' ? 'en-US' : 'ko-KR', {
            month: 'short',
            day: 'numeric'
        });
    }

    // Public API
    window.LoveBudSearchPreviewCopyHelper = {
        getCurrentLocale: getCurrentLocale,
        getSearchCopy: getSearchCopy,
        formatSearchCopy: formatSearchCopy,
        formatShortDate: formatShortDate
    };

    console.log('[LoveBudSearchPreviewCopyHelper] Search preview copy helper loaded v20260501-1');
})();
