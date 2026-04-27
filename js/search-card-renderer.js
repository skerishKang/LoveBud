/**
 * LoveBud Search Card Renderer
 * v20260422-4
 * 
 * Rendering layer: tree cards, empty states.
 * DOM-agnostic - returns HTML strings.
 * 
 * Dependencies: LoveBudPath (for navigation)
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

    function isSuspiciousYouTubeThumbnailImage(img) {
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
                         <div class="tree-meta-left">
                             <span class="tree-meta-chip">
                                 <span class="material-symbols-outlined">schedule</span>
                                 ${escapeHtml(displayStage)}
                             </span>
                         </div>
                         <div class="tree-meta-right">
                             <span style="font-size:13px;color:var(--on-surface-variant);white-space:nowrap;">${escapeHtml(countLabel)}</span>
                             ${emotionTag}
                         </div>
                     </div>
                 </div>
             </div>
         `;
     }

    function renderNoTreesState() {
        const basePath = getBasePath();

        return `
            <div style="grid-column:1 / -1;text-align: center; padding: 60px 24px; color: var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size: 56px; color: var(--primary); opacity: 0.6; margin-bottom: 20px; display: block;">public</span>
                <p style="font-size: 1.25rem; font-weight: 800; margin-bottom: 12px; color: var(--on-surface);">아직 공개된 러브트리가 없어요</p>
                <p style="font-size: 0.95rem; opacity: 0.8; margin-bottom: 24px; line-height: 1.6;">
                    다른 팬이 공개한 러브트리가 생기면 이곳이 감상 허브가 됩니다.<br>
                    지금은 첫 공개 러브트리를 기다리는 중이에요.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <a href="${basePath}my-trees.html" class="btn-round btn-primary" style="text-decoration: none; font-size: 14px; padding: 10px 20px;">
                        <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">account_tree</span>
                        내 러브트리 시작하기
                    </a>
                    <a href="${basePath}index.html" class="btn-round btn-outline" style="text-decoration: none; font-size: 14px; padding: 10px 20px;">
                        <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">home</span>
                        소개 보기
                    </a>
                </div>
            </div>
        `;
    }

    function renderEmptySearchState() {
        return `
            <div style="grid-column:1 / -1;text-align: center; padding: 80px 24px; color: var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px; display: block;">search_off</span>
                <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">조건에 맞는 공개 러브트리가 아직 보이지 않아요</p>
                <p style="font-size: 0.9rem; opacity: 0.7;">다른 이름이나 감정 결로 다시 좁혀보면 새로운 공개 트리를 만날 수 있어요.</p>
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

    window.LoveBudSearchCardRenderer = {
        init: init,
        renderTreeCard: renderTreeCard,
        renderResults: renderResults,
        renderLoading: renderLoading,
        renderSkeletonGrid: renderSkeletonGrid,
        renderNoTreesState: renderNoTreesState,
        renderEmptySearchState: renderEmptySearchState,
        renderDemoBadge: renderDemoBadge,
        getTreeIcon: getTreeIcon,
        renderEmotionTags: renderEmotionTags,
        getBasePath: getBasePath,
        showImageFallback: showImageFallback,
        handleImageLoad: (img) => {
            if (isSuspiciousYouTubeThumbnailImage(img)) {
                showImageFallback(img);
            }
        }
    };

     console.log('[LoveBudSearchCardRenderer] Search card renderer loaded v20260422-4');
 })();
