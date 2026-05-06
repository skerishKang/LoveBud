/**
 * LoveBud Search Preview Renderer Builders
 * v20260505-1
 *
 * Pure DOM builder helpers extracted from search-preview-renderer.js
 * Issue #656 — Phase 3: structural split
 *
 * Dependencies: LoveBudSearchSharedUtils, LoveBudSearchPreviewCopyHelper
 */

(function() {
    'use strict';

    function getSharedUtils() {
        return window.LoveBudSearchSharedUtils || null;
    }

    function escapeHtml(value) {
        var utils = getSharedUtils();
        if (utils && utils.escapeHtml) {
            return utils.escapeHtml(value);
        }
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getSearchCopy(key, fallbackKo, fallbackEn) {
        var helper = window.LoveBudSearchPreviewCopyHelper;
        if (helper && helper.getSearchCopy) {
            return helper.getSearchCopy(key, fallbackKo, fallbackEn);
        }
        var locale = String(window.i18n?.currentLang || document.documentElement?.lang || 'ko');
        locale = locale.toLowerCase().startsWith('en') ? 'en' : 'ko';
        var dict = window.i18nSearch && window.i18nSearch[key];
        if (dict && typeof dict === 'object') {
            return dict[locale] || dict.ko || dict.en || fallbackKo;
        }
        return locale === 'en' ? fallbackEn : fallbackKo;
    }

    function formatSearchCopy(key, replacements, fallbackKo, fallbackEn) {
        var helper = window.LoveBudSearchPreviewCopyHelper;
        if (helper && helper.formatSearchCopy) {
            return helper.formatSearchCopy(key, replacements, fallbackKo, fallbackEn);
        }
        var template = getSearchCopy(key, fallbackKo, fallbackEn);
        return String(template).replace(/\{(\w+)\}/g, function(_, token) {
            return Object.prototype.hasOwnProperty.call(replacements, token)
                ? String(replacements[token])
                : '';
        });
    }

    function getSearchTitleHelper() {
        return window.LoveBudSearchTitleHelper || null;
    }

    function getMomentLabel(memory, fallbackKo, fallbackEn) {
        if (fallbackKo === undefined) fallbackKo = '시작 순간';
        if (fallbackEn === undefined) fallbackEn = 'Starting moment';
        var helper = getSearchTitleHelper();
        var cleaned = helper && helper.cleanMomentTitle
            ? helper.cleanMomentTitle(memory && memory.title || '')
            : String(memory && memory.title || '').trim().replace(/\s*-\s*.*/, '');
        return cleaned || getSearchCopy('search.previewMomentFallback', fallbackKo, fallbackEn);
    }

    function renderSectionHeading(icon, label) {
        return '<div style="font-size:11px;font-weight:800;color:var(--on-surface-variant);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:4px;">' +
            '<span class="material-symbols-outlined" style="font-size:14px;">' + escapeHtml(icon) + '</span>' +
            escapeHtml(label) +
            '</div>';
    }

    function renderInfoCallout(icon, text, variant) {
        if (variant === undefined) variant = 'neutral';
        var isPrimary = variant === 'primary';
        var background = isPrimary ? 'var(--primary-container)' : 'var(--surface-container)';
        var color = isPrimary ? 'var(--on-primary-container)' : 'var(--on-surface-variant)';
        return '<div style="margin-top:12px;padding:12px;background:' + background +
            ';border-radius:0.75rem;font-size:13px;color:' + color +
            ';font-weight:500;display:flex;align-items:center;gap:8px;">' +
            '<span class="material-symbols-outlined" style="font-size:18px;">' + escapeHtml(icon) + '</span>' +
            escapeHtml(text) +
            '</div>';
    }

    function renderPathStageBadge(index, title) {
        return '<span class="preview-flow-stage" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--surface-container);border-radius:8px;font-size:13px;">' +
            '<span style="color:var(--primary);font-weight:800;flex:0 0 auto;">' + index + '</span>' +
            '<span class="preview-flow-stage-label" title="' + escapeHtml(title) + '" aria-label="' + escapeHtml(title) + '">' + escapeHtml(title) + '</span>' +
            '</span>';
    }

    function renderPathStages(memories, startIndex) {
        if (startIndex === undefined) startIndex = 0;
        return memories.map(function(memory, index) {
            var fallbackKo = startIndex + index === 0 ? '시작 순간' : '이어진 순간';
            var fallbackEn = startIndex + index === 0 ? 'Starting moment' : 'Connected moment';
            return renderPathStageBadge(startIndex + index + 1, getMomentLabel(memory, fallbackKo, fallbackEn));
        }).join('');
    }

    function renderFlowToggleButton(hiddenCount, isExpanded) {
        if (!hiddenCount || hiddenCount <= 0) return '';
        var label = isExpanded
            ? getSearchCopy('search.previewCollapseMoments', '접기', 'Collapse')
            : formatSearchCopy(
                'search.previewShowMoreMoments',
                { count: hiddenCount },
                '{count}개의 순간 더 보기',
                'Show {count} more moments'
            );
        var icon = isExpanded ? 'expand_less' : 'expand_more';
        return '<button type="button" class="preview-flow-toggle" data-preview-flow-toggle aria-expanded="' +
            (isExpanded ? 'true' : 'false') + '">' +
            '<span>' + escapeHtml(label) + '</span>' +
            '<span class="material-symbols-outlined" aria-hidden="true">' + icon + '</span>' +
            '</button>';
    }

    function renderHiddenPathStages(hiddenMemories, startIndex, isExpanded) {
        if (!isExpanded || !hiddenMemories.length) return '';
        return '<div class="preview-flow-more-list">' +
            renderPathStages(hiddenMemories, startIndex) +
            '</div>';
    }

    function renderPreviewThumbnailFallback(title, subtitle) {
        var helper = window.LoveBudSearchPreviewMediaHelper;
        if (helper && helper.renderPreviewThumbnailFallback) {
            return helper.renderPreviewThumbnailFallback(title, subtitle);
        }
        return '<div class="preview-media-fallback" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;background:linear-gradient(135deg,var(--surface-container-low),white);border-radius:1rem;color:var(--on-surface-variant);">' +
            '<span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);margin-bottom:12px;">movie</span>' +
            '<div style="font-size:14px;font-weight:800;color:var(--on-surface);margin-bottom:8px;">' + escapeHtml(title) + '</div>' +
            '<p style="margin:0;font-size:13px;line-height:1.6;">' + escapeHtml(subtitle) + '</p>' +
            '</div>';
    }

    function isSuspiciousYouTubeThumbnailImage(img) {
        var utils = getSharedUtils();
        if (utils && utils.isSuspiciousYouTubeThumbnailImage) {
            return utils.isSuspiciousYouTubeThumbnailImage(img);
        }
        if (!img || !img.currentSrc) return false;
        var src = String(img.currentSrc || img.src || '');
        var isYouTubeThumb = src.includes('ytimg.com/vi/') || src.includes('img.youtube.com/vi/');
        if (!isYouTubeThumb) return false;
        var width = Number(img.naturalWidth || 0);
        var height = Number(img.naturalHeight || 0);
        return width > 0 && height > 0 && width <= 120 && height <= 90;
    }

    function renderEmotionTags(tags) {
        var titleHelper = getSearchTitleHelper();
        var safeTags = (Array.isArray(tags) ? tags : [])
            .map(function(tag) {
                return titleHelper && titleHelper.sanitizeBrowseLabel
                    ? titleHelper.sanitizeBrowseLabel(tag)
                    : String(tag || '').trim();
            })
            .filter(Boolean)
            .filter(function(tag) { return tag !== '기록' && tag !== 'tag_record'; })
            .slice(0, 4);

        if (!safeTags.length) {
            return '<span style="padding:8px 14px;background:var(--surface-container-low);border-radius:99px;font-size:13px;font-weight:600;color:var(--on-surface-variant);border:1px solid var(--outline-variant);">' +
                escapeHtml(getSearchCopy('search.previewNoEmotionTags', '아직 이어진 감정은 없어요.', 'There are no clearly saved emotions yet.')) +
                '</span>';
        }

        return safeTags.map(function(tag) {
            return '<span style="padding:8px 14px;background:var(--primary-container);border-radius:99px;font-size:13px;font-weight:700;color:var(--on-primary-container);border:1px solid var(--outline-variant);">#' + escapeHtml(tag) + '</span>';
        }).join('');
    }

    function getDefaultTreeName() {
        return getSearchCopy('search.previewDefaultTreeName', '러브트리', 'LoveTree');
    }

    function getTreeIcon(stage) {
        var icons = { '입덕': '🌱', '성장': '🌿', '최애': '🌳', '새 트리': '🌱' };
        return icons[stage] || '🌱';
    }

    window.LoveBudSearchPreviewBuilders = {
        renderSectionHeading: renderSectionHeading,
        renderInfoCallout: renderInfoCallout,
        renderPathStageBadge: renderPathStageBadge,
        renderPathStages: renderPathStages,
        renderFlowToggleButton: renderFlowToggleButton,
        renderHiddenPathStages: renderHiddenPathStages,
        renderPreviewThumbnailFallback: renderPreviewThumbnailFallback,
        isSuspiciousYouTubeThumbnailImage: isSuspiciousYouTubeThumbnailImage,
        renderEmotionTags: renderEmotionTags,
        getDefaultTreeName: getDefaultTreeName,
        getTreeIcon: getTreeIcon,
        getSharedUtils: getSharedUtils
    };

    console.log('[LoveBudSearchPreviewBuilders] Preview builder helpers loaded v20260505-1');
})();
