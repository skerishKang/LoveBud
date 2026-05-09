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

    function isInternalKeyLike(value) {
        const raw = String(value || '').trim();
        if (!raw) return false;
        if (/^tag_[a-z0-9_]+$/i.test(raw)) return true;
        if (/^[a-z0-9]+(?:_[a-z0-9]+){1,}$/i.test(raw)) return true;
        return false;
    }

    function sanitizeBrowseLabel(value) {
        const raw = String(value || '').trim().replace(/^#/, '');
        if (!raw || isInternalKeyLike(raw)) {
            return '';
        }
        return raw;
    }

    function cleanMomentTitle(value) {
        const raw = String(value || '').trim().replace(/\s*-\s*.*/, '');
        if (!raw) return '';
        if (isInternalKeyLike(raw)) return '';
        return raw;
    }

    function getThemeLabel(tree) {
        const themeRaw = sanitizeBrowseLabel(tree?.theme || '');
        if (!themeRaw || themeRaw === 'LoveTree' || themeRaw === 'Mixed') {
            return '';
        }
        return themeRaw;
    }

    function getPrimaryBrowseTag(tree) {
        const tags = Array.isArray(tree?.emotionTags) ? tree.emotionTags : [];
        for (const tag of tags) {
            const safeTag = sanitizeBrowseLabel(tag);
            if (!safeTag) continue;
            if (safeTag === '기록' || safeTag === 'tag_record') continue;
            return safeTag;
        }
        return '';
    }

    function getFirstMomentLabel(tree) {
        const firstMoment = Array.isArray(tree?.memories) && tree.memories.length
            ? tree.memories[0]
            : null;
        return cleanMomentTitle(firstMoment?.title || '');
    }

    function getBrowseDisplayTitle(tree) {
        const rawTitle = sanitizeBrowseLabel(tree?.title || '');
        const themeRaw = getThemeLabel(tree);
        const firstMomentLabel = getFirstMomentLabel(tree);
        const firstTagRaw = getPrimaryBrowseTag(tree);
        const createdDate = formatShortDate(tree?.createdAt || '');
        const isDefaultTitle = !rawTitle || rawTitle === '새 러브트리' || rawTitle === '나의 첫 러브트리';

        if (!isDefaultTitle) {
            return rawTitle || '러브트리';
        }

        if (themeRaw) {
            return `${themeRaw} 러브트리`;
        }
        if (firstMomentLabel) {
            return `${firstMomentLabel}로 시작된 러브트리`;
        }
        if (firstTagRaw) {
            return `${firstTagRaw}의 순간을 담은 러브트리`;
        }
        if (createdDate) {
            return `${createdDate}부터 이어진 러브트리`;
        }
        return '한 사람의 입덕 러브트리';
    }

    window.LoveBudSearchTitleHelper = {
        formatShortDate,
        sanitizeBrowseLabel,
        cleanMomentTitle,
        getThemeLabel,
        getPrimaryBrowseTag,
        getFirstMomentLabel,
        getBrowseDisplayTitle
    };
})();
