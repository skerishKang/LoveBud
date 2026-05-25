/**
 * LoveBud Search Card Renderer
 * v20260523-1490-1
 * 
 * Rendering layer: tree cards, empty states.
 * DOM-agnostic - returns HTML strings.
 * 
 * Dependencies: LoveBudPath (for navigation), LoveBudSearchSharedUtils (for shared utilities)
 */

(function() {
    'use strict';

    function escapeHtml(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.escapeHtml(value);
        var utils = window.LoveBudSearchSharedUtils;
        if (utils?.escapeHtml) return utils.escapeHtml(value);
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeUrl(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.sanitizeUrl(value);
        var utils = window.LoveBudSearchSharedUtils;
        if (utils?.sanitizeUrl) return utils.sanitizeUrl(value);
        if (!value) return '';
        var raw = String(value).trim();
        if (!raw) return '';
        try {
            var parsed = new URL(raw, window.location.origin);
            var protocol = parsed.protocol;
            if (protocol === 'http:' || protocol === 'https:') {
                return parsed.href;
            }
            return '';
        } catch (e) {
            return '';
        }
    }

    function isSuspiciousYouTubeThumbnailImage(img) {
        var utils = window.LoveBudSearchSharedUtils;
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
        const mediaPreview = img.parentElement?.querySelector?.('.tree-card-preview-strip-media');
        if (mediaPreview) {
            mediaPreview.hidden = true;
        }
    }

    let _resultsList = null;

    function init(resultsListEl) {
        _resultsList = resultsListEl;
    }

    function getBasePath() {
        var utils = window.LoveBudSearchSharedUtils;
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

    function getDisplayThemeLabel(theme) {
        const raw = String(theme || '').trim();
        if (!raw || raw === 'LoveTree' || raw === 'Mixed') {
            return '';
        }
        return raw;
    }

    function getDisplayMemoryCount(memoryCount) {
        const count = Number(memoryCount || 0);
        return Number.isFinite(count) && count > 0 ? count : 0;
    }

    function getTreeViewerHref(tree) {
        if (!tree?.id) return '';
        return `${getBasePath()}public-canvas.html?treeId=${encodeURIComponent(tree.id)}`;
    }

    function getTreePreviewTone(tree) {
        const memoryCount = getDisplayMemoryCount(tree?.memoryCount);
        if (memoryCount >= 6) return 'full';
        if (memoryCount >= 3) return 'growing';
        if (memoryCount >= 1) return 'sprout';
        return 'empty';
    }

    function getFirstFiniteCount(tree, keys) {
        for (const key of keys) {
            const value = Number(tree?.[key]);
            if (Number.isFinite(value) && value >= 0) return value;
        }
        return 0;
    }

    function formatCompactCount(value) {
        const count = Number(value || 0);
        if (!Number.isFinite(count) || count <= 0) return '0';
        if (count >= 1000000) return `${Math.floor(count / 100000) / 10}M`;
        if (count >= 1000) return `${Math.floor(count / 100) / 10}K`;
        return String(count);
    }

    function getTreeReactionCounts(tree) {
        return {
            likes: getFirstFiniteCount(tree, ['likeCount', 'likesCount', 'likes', 'reactionCount', 'reaction_count']),
            views: getFirstFiniteCount(tree, [
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
            ])
        };
    }

    // Issue #1488 #1490: 조회수 → 좋아요 순서로 통일 (댓글·공유 제거)
    function renderTreeReactionMetrics(tree) {
        const counts = getTreeReactionCounts(tree);
        const metrics = [
            { icon: 'visibility', label: '조회수', value: counts.views },
            { icon: 'favorite', label: '좋아요', value: counts.likes }
        ];

        return `
            <div class="tree-card-reaction-metrics" aria-label="트리 반응 요약">
                ${metrics.map(metric => `
                    <span class="tree-card-reaction-metric" title="${escapeHtml(metric.label)} ${formatCompactCount(metric.value)}">
                        <span class="material-symbols-outlined" aria-hidden="true">${metric.icon}</span>
                        <span>${escapeHtml(formatCompactCount(metric.value))}</span>
                    </span>
                `).join('')}
            </div>
        `;
    }

    function hashSeed(value) {
        var source = String(value || 'lovetree');
        var hash = 0;
        for (var i = 0; i < source.length; i++) {
            hash = ((hash << 5) - hash) + source.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function buildPremiumFallbackSVG(tree, palette) {
        var seed = hashSeed((tree && tree.id) || (tree && tree.title) || 'lovetree');
        var trunkId = 'trunkGrad-' + seed;

        var branches = [
            '<path d="M 100 178 Q 98 142 100 112 Q 102 82 95 52" stroke="url(#' + trunkId + ')" stroke-width="5" fill="none" stroke-linecap="round"/>',
            '<path d="M 100 132 Q 72 122 56 98 Q 46 80 52 58" stroke="' + palette.leaf + '" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>',
            '<path d="M 100 112 Q 128 102 145 84 Q 157 70 152 50" stroke="' + palette.leaf + '" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>',
            '<path d="M 98 82 Q 78 72 68 52 Q 60 38 66 24" stroke="' + palette.leaf + '" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.75"/>'
        ].join('');

        var nodePositions = [
            { x: 52, y: 58, type: 'heart', r: 8 },
            { x: 152, y: 50, type: 'pearl', r: 7 },
            { x: 66, y: 24, type: 'pearl', r: 6 },
            { x: 102, y: 52, type: 'heart', r: 8 },
            { x: 138, y: 84, type: 'pearl', r: 6 },
            { x: 80, y: 104, type: 'heart', r: 7 }
        ];

        var nodesHtml = [];
        for (var i = 0; i < nodePositions.length; i++) {
            var pos = nodePositions[i];
            if (pos.type === 'heart') {
                var scale = (pos.r / 10).toFixed(2);
                nodesHtml.push(
                    '<g transform="translate(' + pos.x + ', ' + (pos.y - 5) + ') scale(' + scale + ')" opacity="0.95">' +
                        '<path d="M0,3 C-3,-3 -10,-3 -10,3 C-10,9 0,16 0,18 C0,16 10,9 10,3 C10,-3 3,-3 0,3 Z" fill="' + palette.accent + '" opacity="0.85"/>' +
                        '<path d="M0,3 C-3,-3 -10,-3 -10,3 C-10,9 0,16 0,18 C0,16 10,9 10,3 C10,-3 3,-3 0,3 Z" fill="#ffb4c1" transform="scale(0.85)"/>' +
                    '</g>'
                );
            } else {
                nodesHtml.push(
                    '<g opacity="0.95">' +
                        '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + pos.r + '" fill="' + palette.leafSoft + '" stroke="' + palette.leaf + '" stroke-width="1.5"/>' +
                        '<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + (pos.r * 0.7).toFixed(1) + '" fill="rgba(255, 255, 255, 0.9)"/>' +
                        '<circle cx="' + (pos.x - pos.r * 0.2).toFixed(1) + '" cy="' + (pos.y - pos.r * 0.2).toFixed(1) + '" r="' + (pos.r * 0.25).toFixed(1) + '" fill="#ffffff"/>' +
                    '</g>'
                );
            }
        }

        return [
            '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: 100%; height: 100%; max-height: 120px; display: block; margin: 0 auto;">',
                '<defs>',
                    '<linearGradient id="' + trunkId + '" x1="0%" y1="0%" x2="100%" y2="0%">',
                        '<stop offset="0%" style="stop-color:#904951;stop-opacity:1" />',
                        '<stop offset="50%" style="stop-color:#c87480;stop-opacity:1" />',
                        '<stop offset="100%" style="stop-color:#904951;stop-opacity:1" />',
                    '</linearGradient>',
                '</defs>',
                branches,
                nodesHtml.join(''),
                '<ellipse cx="100" cy="176" rx="34" ry="8" fill="none" stroke="' + palette.accent + '" stroke-width="1" opacity="0.15" stroke-dasharray="4,4"/>',
            '</svg>'
        ].join('');
    }

    function renderMediaFallback(tree, titleText) {
        var seed = hashSeed((tree && tree.id) || (tree && tree.title) || 'lovetree');
        var palettes = [
            {
                background: 'linear-gradient(135deg, #fff3f6 0%, #f8e4ea 42%, #f6efe8 100%)',
                leaf: '#d8839a',
                leafSoft: 'rgba(216, 131, 154, 0.18)',
                accent: '#904951'
            },
            {
                background: 'linear-gradient(135deg, #fdf6ea 0%, #f7ebd7 46%, #f5f0f7 100%)',
                leaf: '#c79d68',
                leafSoft: 'rgba(199, 157, 104, 0.18)',
                accent: '#9d6b4d'
            },
            {
                background: 'linear-gradient(135deg, #f2f6ef 0%, #e4efe1 48%, #f8efe8 100%)',
                leaf: '#7a8b6e',
                leafSoft: 'rgba(122, 139, 110, 0.18)',
                accent: '#5d6f52'
            },
            {
                background: 'linear-gradient(135deg, #f6f0fb 0%, #ece4f7 42%, #fdf2f3 100%)',
                leaf: '#9f7ec2',
                leafSoft: 'rgba(159, 126, 194, 0.18)',
                accent: '#7d5ba6'
            }
        ];
        var activePalette = palettes[seed % palettes.length];

        var locale = window.i18n?.currentLang || window.getCurrentLang?.() || document.documentElement?.lang || 'ko';
        var isEnglish = String(locale).toLowerCase().startsWith('en');
        var pill1 = isEnglish ? 'First Moment' : '첫 순간';
        var pill2 = isEnglish ? 'Memory Note' : '마음 메모';
        var pill3 = isEnglish ? 'Favorite Scene' : '다시 보고 싶은 장면';

        var svgHtml = buildPremiumFallbackSVG(tree, activePalette);

        return `
            <div class="tree-card-media-fallback" style="background: ${activePalette.background};">
                <div class="fallback-svg-container">
                    ${svgHtml}
                </div>
                <div class="fallback-pills">
                    <span class="fallback-pill" style="color: ${activePalette.accent};">${pill1}</span>
                    <span class="fallback-pill" style="color: ${activePalette.accent};">${pill2}</span>
                    <span class="fallback-pill" style="color: ${activePalette.accent};">${pill3}</span>
                </div>
                <div class="fallback-title" style="display:none !important;"></div>
            </div>
        `;
    }

    function renderRepresentativeImage(src, alt, tree, titleText) {
        if (!src) {
            return renderMediaFallback(tree, titleText);
        }
        return `
            <img src="${src}" alt="${alt}" loading="lazy" data-search-card-image="" style="width:100%;height:100%;object-fit:cover;">
            <div data-fallback-container hidden style="width:100%;height:100%;position:absolute;inset:0;">
                ${renderMediaFallback(tree, titleText)}
            </div>
        `;
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
         const displayTheme = getDisplayThemeLabel(tree.theme);
         const safeTreeId = escapeHtml(tree.id);

         const displayTitleRaw = titleHelper?.getBrowseDisplayTitle
             ? titleHelper.getBrowseDisplayTitle(tree)
             : (String(tree.title || '').trim() || '러브트리');
         const primaryTag = titleHelper?.getPrimaryBrowseTag ? titleHelper.getPrimaryBrowseTag(tree) : '';

         const safeTitle = escapeHtml(displayTitleRaw);
         const viewerHref = getTreeViewerHref(tree);
         const cardSelectLabel = `${displayTitleRaw} 러브트리를 감상 허브에서 미리보기`;
         const viewerLabel = `${displayTitleRaw} 러브트리 열기`;
         const hasDerivedDescription = Boolean(displayTheme || primaryTag);
         const softMoodLine = displayTheme
             ? `${displayTheme}와 함께 시작된 마음`
             : primaryTag
                 ? `${primaryTag}의 결이 먼저 남겨진 트리`
                 : memoryCount > 0
                     ? '첫 순간에서 이어진 감정을 천천히 따라가 보세요.'
                     : '이제 막 열리기 시작한 공개 러브트리예요.';
         const subtitleClass = hasDerivedDescription
             ? 'tree-subtitle tree-subtitle-derived'
             : 'tree-subtitle tree-subtitle-fallback';

         return `
             <div class="tree-card ${index === 0 ? 'tree-card-featured' : ''}" id="tree-card-${safeTreeId}" data-tree-id="${safeTreeId}" aria-label="${escapeHtml(cardSelectLabel)}" style="animation-delay: ${index * 0.05}s;">
                 ${renderRepresentativeMedia(tree, firstMem, displayTitleRaw)}
                 <div class="tree-card-body">
                     <div class="tree-title">${safeTitle}</div>
                     <p class="${subtitleClass}">${escapeHtml(softMoodLine)}</p>
                     <div class="tree-meta-row">
                         <div class="tree-meta-left">
                             ${renderTreeReactionMetrics(tree)}
                         </div>
                         <div class="tree-meta-right">
                             ${viewerHref ? `
                                 <a href="${escapeHtml(viewerHref)}" class="tree-card-open-link" aria-label="${escapeHtml(viewerLabel)}">
                                     <span class="material-symbols-outlined" aria-hidden="true">account_tree</span>
                                     트리 열기
                                 </a>
                             ` : ''}
                         </div>
                     </div>
                 </div>
             </div>
         `;
     }

    function renderNoTreesState() {
        const locale = window.i18n?.currentLang || window.getCurrentLang?.() || document.documentElement?.lang || 'ko';
        const isEnglish = String(locale).toLowerCase().startsWith('en');
        const heading = window.i18nSearch?.['search.noTreesHeading']?.[isEnglish ? 'en' : 'ko'] || (isEnglish ? 'No public LoveTrees yet' : '아직 공개된 러브트리가 없어요');
        const body = window.i18nSearch?.['search.noTreesBody']?.[isEnglish ? 'en' : 'ko'] || (isEnglish ? 'Public LoveTrees will appear here once someone shares one.' : '다른 팬이 공개한 러브트리가 생기면 이곳에서 만날 수 있어요.');

        return `
            <div class="search-empty-state">
                <span class="material-symbols-outlined search-empty-icon" aria-hidden="true">public</span>
                <h3 class="search-empty-heading">${escapeHtml(heading)}</h3>
                <p class="search-empty-body">${escapeHtml(body)}</p>
            </div>
        `;
    }

    function renderEmptySearchState() {
        const locale = window.i18n?.currentLang || window.getCurrentLang?.() || document.documentElement?.lang || 'ko';
        const isEnglish = String(locale).toLowerCase().startsWith('en');
        const heading = window.i18nSearch?.['search.emptySearchHeading']?.[isEnglish ? 'en' : 'ko'] || (isEnglish ? 'No matches found' : '조건에 맞는 트리가 없어요');
        const body = window.i18nSearch?.['search.emptySearchBody']?.[isEnglish ? 'en' : 'ko'] || (isEnglish ? 'Try a different keyword or filter.' : '다른 키워드나 필터로 다시 찾아보세요.');

        return `
            <div class="search-empty-state">
                <span class="material-symbols-outlined search-empty-icon" aria-hidden="true">search_off</span>
                <h3 class="search-empty-heading">${escapeHtml(heading)}</h3>
                <p class="search-empty-body">${escapeHtml(body)}</p>
            </div>
        `;
    }

    function renderDemoBadge() {
        return `
            <div style="grid-column:1 / -1;background: var(--surface-container); border: 1px solid var(--outline-variant); color: var(--on-surface-variant); padding: 12px 20px; border-radius: 1rem; margin-bottom: 6px; font-size: 13px; text-align: center; font-style: italic;">
                <span style="font-weight: 700;">🌸 샘플 러브트리</span> — 다른 팬들이 남긴 감정의 경로를 둘러보세요
            </div>
        `;
    }

    function renderSkeletonCard(index) {
        return `
            <div class="tree-card search-skeleton-card" aria-hidden="true" style="animation-delay:${index * 0.04}s;pointer-events:none;">
                <div class="tree-card-media search-skeleton-block" style="min-height:${index === 0 ? 210 : 182}px;"></div>
                <div class="tree-card-body">
                    <div class="search-skeleton-line search-skeleton-title"></div>
                    <div class="search-skeleton-line search-skeleton-copy"></div>
                    <div class="tree-meta-row">
                        <div class="tree-meta-left">
                            <span class="tree-meta-chip search-skeleton-chip"></span>
                        </div>
                        <div class="tree-meta-right">
                            <span class="search-skeleton-line search-skeleton-count"></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderSkeletonGrid(options = {}) {
        _addAnimations();
        const count = Math.max(1, Math.min(Number(options.count || 6), 8));
        return Array.from({ length: count }, (_, index) => renderSkeletonCard(index)).join('');
    }

    function renderLoading(options = {}) {
        return renderSkeletonGrid(options);
    }

    function renderResults(trees, options = {}) {
        const { isDemo = false } = options;

        _addAnimations();

        if (trees.length === 0) {
            return renderEmptySearchState();
        }

        let html = '';

        if (isDemo) {
            html += renderDemoBadge();
        }

        trees.forEach((tree, index) => {
            html += renderTreeCard(tree, index);
        });

        return html;
    }

    function _addAnimations() {
        if (document.getElementById('search-card-anim-style')) return;
        
        const style = document.createElement('style');
        style.id = 'search-card-anim-style';
        style.textContent = `
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes searchSkeletonPulse { 0%, 100% { opacity: 0.58; } 50% { opacity: 1; } }
            .results-fade-in { animation: fadeIn 0.3s ease-out; }
            .search-skeleton-card { cursor: default; box-shadow: 0 16px 32px rgba(75, 64, 57, 0.035); }
            .search-skeleton-card::before { opacity: 0; }
            .search-skeleton-block,
            .search-skeleton-line,
            .search-skeleton-chip {
                display: block;
                border-radius: 999px;
                background: linear-gradient(90deg, rgba(144,73,81,0.07), rgba(255,255,255,0.72), rgba(122,139,110,0.07));
                background-size: 220% 100%;
                animation: searchSkeletonPulse 1.35s ease-in-out infinite;
            }
            .search-skeleton-block { border-radius: 1.35rem; width: 100%; }
            .search-skeleton-title { width: 72%; height: 18px; }
            .search-skeleton-copy { width: 92%; height: 13px; opacity: 0.75; }
            .search-skeleton-chip { width: 96px; height: 28px; }
            .search-skeleton-count { width: 82px; height: 13px; }
            @media (prefers-reduced-motion: reduce) {
                .search-skeleton-block,
                .search-skeleton-line,
                .search-skeleton-chip { animation: none; }
            }
        `;
        document.head.appendChild(style);
    }

    function handleImageLoad(img) {
        if (!img) return;
        if (isSuspiciousYouTubeThumbnailImage(img)) {
            showImageFallback(img);
        }
    }

    function bindCardImageHandlers(root) {
        if (!root) return;
        root.querySelectorAll('[data-search-card-image]').forEach(img => {
            if (img.dataset.searchCardImageHandlerBound === 'true') return;
            img.dataset.searchCardImageHandlerBound = 'true';

            if (img.complete) {
                if (img.naturalWidth === 0) {
                    showImageFallback(img);
                } else {
                    handleImageLoad(img);
                }
                return;
            }

            img.addEventListener('error', function onCardImageError() {
                showImageFallback(this);
            });
            img.addEventListener('load', function onCardImageLoad() {
                handleImageLoad(this);
            });
        });
    }

    window.LoveBudSearchCardRenderer = {
        init: init,
        renderTreeCard: renderTreeCard,
        renderResults: renderResults,
        renderLoading: renderLoading,
        renderSkeletonGrid: renderSkeletonGrid,
        renderNoTreesState: renderNoTreesState,
        renderEmptySearchState: renderEmptySearchState,
        renderDemoBadge: renderDemoBadge,
        getBasePath: getBasePath,
        getTreeViewerHref: getTreeViewerHref,
        showImageFallback: showImageFallback,
        handleImageLoad: handleImageLoad,
        bindCardImageHandlers: bindCardImageHandlers
    };


 })();
