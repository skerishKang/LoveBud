/**
 * LoveBud Search Card Renderer
 * v20260428-1
 * 
 * Rendering layer: tree cards, empty states.
 * DOM-agnostic - returns HTML strings.
 * 
 * Dependencies: LoveBudPath (for navigation), LoveBudSearchSharedUtils (for shared utilities)
 */

(function() {
    'use strict';

    function getSharedUtils() {
        return window.LoveBudSearchSharedUtils || null;
    }

    function escapeHtml(value) {
        const utils = getSharedUtils();
        if (utils?.escapeHtml) {
            return utils.escapeHtml(value);
        }
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeUrl(value) {
        const utils = getSharedUtils();
        if (utils?.sanitizeUrl) {
            return utils.sanitizeUrl(value);
        }
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

    function isSuspiciousYouTubeThumbnailImage(img) {
        const utils = getSharedUtils();
        if (utils?.isSuspiciousYouTubeThumbnailImage) {
            return utils.isSuspiciousYouTubeThumbnailImage(img);
        }
        if (!img || !img.currentSrc) return false;
        const src = String(img.currentSrc || img.src || '');
        const isYouTubeThumb = src.includes('ytimg.com/vi/') || src.includes('img.youtube.com/vi/');
        if (!isYouTubeThumb) return false;

        const width = Number(img.naturalWidth || 0);
        const height = Number(img.naturalHeight || 0);
        return width > 0 && height > 0 && width <= 120 && height <= 90;
    }

    function showImageFallback(img) {
        if (!img) return;
        if (img.dataset.fallbackTriggered) return;
        img.dataset.fallbackTriggered = 'true';
        img.style.display = 'none';
        const fallback = img.nextElementSibling;
        if (fallback) {
            fallback.hidden = false;
        }
    }

    let _resultsList = null;

    function init(resultsListEl) {
        _resultsList = resultsListEl;
    }

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

    function getSearchTitleHelper() {
        return window.LoveBudSearchTitleHelper || null;
    }

    function getTreeIcon(stage) {
        const icons = { '입덕': '🌱', '성장': '🌿', '최애': '🌳', 'empty': '🌷' };
        return icons[stage] || '🌱';
    }

    function getDisplayStageLabel(stage, memoryCount) {
        const raw = String(stage || '').trim();
        if (!raw || raw === 'empty') {
            return Number(memoryCount || 0) > 0 ? '시작 순간 중심' : '새로 열린 트리';
        }
        if (raw === '입덕') return '시작 순간 중심';
        if (raw === '성장') return '이어진 감정';
        if (raw === '최애') return '깊어진 마음';
        return raw;
    }

    function getDisplayThemeLabel(theme) {
        const raw = String(theme || '').trim();
        if (!raw || raw === 'LoveTree' || raw === 'Mixed') {
            return '';
        }
        return raw;
    }

    function getDisplayTimeRange(timeRange) {
        const raw = String(timeRange || '').trim();
        return raw || '방금 공개됨';
    }

    function getDisplayMemoryCount(memoryCount) {
        const count = Number(memoryCount || 0);
        return Number.isFinite(count) && count > 0 ? count : 0;
    }

    function renderMediaFallback(tree, titleText) {
        const safeTitle = escapeHtml(titleText || '러브트리');
        return `
            <div class="tree-card-media-fallback" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:20px;text-align:center;background:linear-gradient(135deg, rgba(250,242,243,0.96), rgba(255,255,255,0.96));width:100%;height:100%;">
                <span style="font-size:34px;line-height:1;">${escapeHtml(getTreeIcon(tree.stage))}</span>
                <div style="font-size:13px;font-weight:800;color:var(--on-surface);">${safeTitle}</div>
            </div>
        `;
    }

    function renderRepresentativeImage(src, alt, tree, titleText) {
        if (!src) {
            return renderMediaFallback(tree, titleText);
        }
        return `
            <img src="${src}" alt="${alt}" loading="lazy" onerror="window.LoveBudSearchCardRenderer?.showImageFallback?.(this)" onload="window.LoveBudSearchCardRenderer?.handleImageLoad?.(this)" style="width:100%;height:100%;object-fit:cover;">
            <div data-fallback-container hidden style="width:100%;height:100%;position:absolute;inset:0;">
                ${renderMediaFallback(tree, titleText)}
            </div>
        `;
    }

     function renderEmotionTags(tags) {
         const titleHelper = getSearchTitleHelper();
         const safeTags = (Array.isArray(tags) ? tags : [])
             .map(tag => titleHelper?.sanitizeBrowseLabel ? titleHelper.sanitizeBrowseLabel(tag) : String(tag || '').trim())
             .filter(Boolean)
             .filter(tag => tag !== '기록' && tag !== 'tag_record')
             .slice(0, 1);

         if (!safeTags.length) return '';
         return safeTags.map(tag =>
             `<span class="tree-meta-chip">#${escapeHtml(tag)}</span>`
         ).join('');
     }

     function renderRepresentativeMedia(tree, firstMem, titleText) {
         const mediaUrl = sanitizeUrl(
             firstMem?.thumbnail ||
             tree.representativeThumbnail ||
             tree.thumbnail ||
             ''
         );
         const firstMoment = escapeHtml(firstMem?.title || '대표 순간 준비 중');

         return `
             <div class="tree-card-media" aria-label="${firstMoment}" style="position:relative;overflow:hidden;">
                 ${renderRepresentativeImage(mediaUrl, firstMoment, tree, titleText)}
             </div>
         `;
     }

     function renderTreeCard(tree, index) {
         const memories = Array.isArray(tree.memories) ? tree.memories : [];
         const firstMem = memories[0];
         const titleHelper = getSearchTitleHelper();
         const memoryCount = getDisplayMemoryCount(tree.memoryCount);
         const displayStage = getDisplayStageLabel(tree.stage, memoryCount);
         const displayTheme = getDisplayThemeLabel(tree.theme);
         const safeTreeId = escapeHtml(tree.id);

         const displayTitleRaw = titleHelper?.getBrowseDisplayTitle
             ? titleHelper.getBrowseDisplayTitle(tree)
             : (String(tree.title || '').trim() || '러브트리');
         const primaryTag = titleHelper?.getPrimaryBrowseTag ? titleHelper.getPrimaryBrowseTag(tree) : '';

         const safeTitle = escapeHtml(displayTitleRaw);
         const emotionTag = renderEmotionTags(tree.emotionTags);
         const countLabel = memoryCount > 0 ? `${memoryCount}개의 순간` : '대표 순간 준비 중';
         const softMoodLine = displayTheme
             ? `${displayTheme}와 함께 시작된 마음`
             : primaryTag
                 ? `${primaryTag}의 결이 먼저 남겨진 트리`
                 : memoryCount > 0
                     ? '첫 순간에서 이어진 감정을 천천히 따라가 보세요.'
                     : '이제 막 열리기 시작한 공개 러브트리예요.';

         return `
             <div class="tree-card ${index === 0 ? 'tree-card-featured' : ''}" id="tree-card-${safeTreeId}" data-tree-id="${safeTreeId}" style="animation-delay: ${index * 0.05}s;">
                 ${renderRepresentativeMedia(tree, firstMem, displayTitleRaw)}
                 <div class="tree-card-body">
                     <div class="tree-title">${safeTitle}</div>
                     <p class="tree-subtitle">${escapeHtml(softMoodLine)}</p>
                     <div class="tree-meta-row">
                         <div class="tree-meta-left">${emotionTag}</div>
                         <div class="tree-meta-right"><span class="tree-meta-count">${escapeHtml(countLabel)}</span></div>
                     </div>
                 </div>
             </div>
         `;
     }

    function renderResults(trees, options = {}) {
        const { isDemo = false } = options;
        if (!Array.isArray(trees) || trees.length === 0) {
            return renderEmptySearchState();
        }
        return trees.map((tree, index) => renderTreeCard(tree, index)).join('');
    }

    function renderLoading() {
        return Array.from({ length: 3 }, (_, i) => `
            <div class="tree-card ${i === 0 ? 'tree-card-featured' : ''} search-skeleton-card" aria-hidden="true">
                <div class="tree-card-media search-skeleton-block"></div>
                <div class="tree-card-body">
                    <div class="search-skeleton-line search-skeleton-title"></div>
                    <div class="search-skeleton-line search-skeleton-copy"></div>
                    <div class="tree-meta-row">
                        <div class="tree-meta-left"><span class="tree-meta-chip search-skeleton-chip"></span></div>
                        <div class="tree-meta-right"><span class="search-skeleton-line search-skeleton-count"></span></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderEmptySearchState() {
        return `
            <div style="text-align:center;padding:60px 20px;color:var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size:48px;margin-bottom:16px;display:block;">search_off</span>
                <p style="font-size:15px;font-weight:700;">검색 결과가 없어요.</p>
                <p style="font-size:13px;margin-top:8px;">다른 키워드나 필터로 찾아보세요.</p>
            </div>
        `;
    }

    function renderNoTreesState() {
        return `
            <div style="text-align:center;padding:60px 20px;color:var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size:48px;margin-bottom:16px;display:block;">forest</span>
                <p style="font-size:15px;font-weight:700;">아직 공개된 러브트리가 없어요.</p>
                <p style="font-size:13px;margin-top:8px;">첫 번째 러브트리를 만들어 보세요.</p>
            </div>
        `;
    }

    window.LoveBudSearchCardRenderer = {
        init: init,
        renderTreeCard: renderTreeCard,
        renderResults: renderResults,
        renderLoading: renderLoading,
        renderEmptySearchState: renderEmptySearchState,
        renderNoTreesState: renderNoTreesState,
        showImageFallback: showImageFallback,
        handleImageLoad: (img) => {
            if (isSuspiciousYouTubeThumbnailImage(img)) {
                showImageFallback(img);
            }
        }
    };

    console.log('[LoveBudSearchCardRenderer] Search card renderer loaded v20260428-1');
})();
