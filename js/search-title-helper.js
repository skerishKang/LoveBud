/**
 * LoveBud Search Title Helper
 * v20260421-2
 * 
 * Shared helper for browse/search title formatting.
 * Used by: search-card-renderer.js, search-preview-renderer.js
 */
(function () {
    'use strict';

    function formatShortDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric'
        });
    }

    function getThemeLabel(tree) {
        const themeRaw = String(tree?.theme || '').trim();
        if (!themeRaw || themeRaw === 'LoveTree' || themeRaw === 'Mixed') {
            return '';
        }
        return themeRaw;
    }

    function getBrowseDisplayTitle(tree) {
        const rawTitle = String(tree?.title || '').trim();
        const filteredTags = (Array.isArray(tree?.emotionTags) ? tree.emotionTags : [])
            .filter(t => t && t !== '기록' && t !== 'tag_record');
        const firstTagRaw = filteredTags.length > 0 ? filteredTags[0].trim() : '';
        const themeRaw = getThemeLabel(tree);
        const createdDate = formatShortDate(tree?.createdAt || '');
        const isDefaultTitle = rawTitle === '새 러브트리' || rawTitle === '나의 첫 러브트리';

        if (!isDefaultTitle) {
            return rawTitle || '러브트리';
        }

        if (themeRaw) {
            return `${themeRaw} 러브트리`;
        }
        if (firstTagRaw) {
            return `${firstTagRaw}으로 시작한 러브트리`;
        }
        if (createdDate) {
            return `${createdDate} 시작한 러브트리`;
        }
        return '새로 시작된 러브트리';
    }

    window.LoveBudSearchTitleHelper = {
        formatShortDate,
        getThemeLabel,
        getBrowseDisplayTitle
    };
})();
