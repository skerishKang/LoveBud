/**
 * LoveBud Search Card Renderer
 * v20260422-1
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
            return Number(memoryCount || 0) > 0 ? '입덕' : '새로 열린 트리';
        }
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

    function renderPathFallback() {
        return '<div class="path-node-fallback">감상<br>준비중</div>';
    }

    function renderPathImage(src, alt) {
        if (!src) {
            return renderPathFallback();
        }
        return `
            <img src="${src}" alt="${alt}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
            <div class="path-node-fallback" hidden>감상<br>준비중</div>
        `;
    }

    function renderMediaFallback(tree, titleText) {
        const safeTitle = escapeHtml(titleText || '러브트리');
        return `
            <div class="tree-card-media-fallback" style="flex-direction:column;gap:8px;padding:20px;text-align:center;">
                <span style="font-size:38px;line-height:1;">${escapeHtml(getTreeIcon(tree.stage))}</span>
                <div style="font-size:13px;font-weight:800;color:var(--on-surface);">${safeTitle}</div>
                <div style="font-size:11px;font-weight:700;color:var(--on-surface-variant);">대표 장면 준비 중</div>
            </div>
        `;
    }

    function renderRepresentativeImage(src, alt, tree, titleText) {
        if (!src) {
            return renderMediaFallback(tree, titleText);
        }
        return `
            <img src="${src}" alt="${alt}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
            <div class="tree-card-media-fallback" hidden>${renderMediaFallback(tree, titleText)}</div>
        `;
    }

     function renderPathPreview(memories) {
         if (!memories || memories.length === 0) {
             return renderEmptyTreePreview();
         }

         const previewCount = Math.min(memories.length, 3);
         const previewMems = memories.slice(0, previewCount);

         let html = '<div class="tree-path-preview">';

         previewMems.forEach((mem, idx) => {
             const safeTitle = escapeHtml(mem?.title || '');
             const safeThumb = sanitizeUrl(mem?.thumbnail || '');

             html += `
                 <div class="path-node" title="${safeTitle}">
                     ${renderPathImage(safeThumb, safeTitle)}
                 </div>
             `;
             if (idx < previewCount - 1) {
                 html += '<span class="path-arrow material-symbols-outlined">arrow_forward</span>';
             }
         });

         if (memories.length > previewCount) {
             html += `<div class="path-more">+${memories.length - previewCount}</div>`;
         }

         html += '</div>';
         return html;
     }

     function renderEmotionTags(tags) {
         const titleHelper = getSearchTitleHelper();
         const safeTags = (Array.isArray(tags) ? tags : [])
             .map(tag => titleHelper?.sanitizeBrowseLabel ? titleHelper.sanitizeBrowseLabel(tag) : String(tag || '').trim())
             .filter(Boolean)
             .filter(tag => tag !== '기록' && tag !== 'tag_record')
             .slice(0, 3);

         if (!safeTags.length) return '';
         return safeTags.map(tag =>
             `<span class="emotion-tag" style="background:var(--primary-container);color:var(--on-primary-container);font-weight:700;font-size:12px;padding:6px 12px;">#${escapeHtml(tag)}</span>`
         ).join('');
     }

     function renderCardSectionHeading(icon, label) {
         return `
             <div style="font-size:11px;font-weight:800;color:var(--on-surface-variant);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">
                 <span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle;margin-right:4px;">${escapeHtml(icon)}</span>
                 ${escapeHtml(label)}
             </div>
         `;
     }

     function renderCardMetaRow(memoryCount, timeRange, createdDate) {
         const safeTimeRange = escapeHtml(getDisplayTimeRange(timeRange));
         const count = getDisplayMemoryCount(memoryCount);
         const countLabel = count > 0 ? `${count}개의 순간` : '대표 순간 준비 중';

         return `
             <div style="font-size:12px;color:var(--on-surface-variant);margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                 <span class="material-symbols-outlined" style="font-size:14px;">account_tree</span>
                 ${escapeHtml(countLabel)} · ${safeTimeRange}
                 ${createdDate ? `<span style="margin-left:4px;padding-left:8px;border-left:1px solid var(--outline-variant);">${escapeHtml(createdDate)} 공개</span>` : ''}
             </div>
         `;
     }

     function renderCardFooterCta(text) {
         return `
             <div style="font-size:13px;color:var(--primary);font-weight:800;padding-top:14px;border-top:1px solid var(--outline-variant);display:flex;align-items:center;gap:6px;">
                 <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary);">play_circle</span>
                 ${escapeHtml(text)}
             </div>
         `;
     }

     function renderRepresentativeMedia(tree, firstMem, isFeatured, titleText) {
         const mediaUrl = sanitizeUrl(
             firstMem?.thumbnail ||
             tree.representativeThumbnail ||
             tree.thumbnail ||
             ''
         );
         const firstMoment = escapeHtml(firstMem?.title || '대표 순간 준비 중');
         const label = isFeatured ? '먼저 열어볼 공개 러브트리' : '이 트리의 감상 장면';
         const count = getDisplayMemoryCount(tree.memoryCount);
         const countLabel = count > 0 ? `${count}개의 순간` : '대표 순간 준비 중';

         return `
             <div class="tree-card-media" aria-label="${firstMoment}">
                 ${renderRepresentativeImage(mediaUrl, firstMoment, tree, titleText)}
                 <div class="tree-card-media-label">
                     <span><span class="material-symbols-outlined" style="font-size:15px;">auto_stories</span>${escapeHtml(label)}</span>
                     <span>${escapeHtml(countLabel)}</span>
                 </div>
             </div>
         `;
     }

     function renderEmptyTreePreview() {
         return `
             <div class="tree-path-preview empty-tree-preview" style="display:flex;align-items:center;justify-content:center;gap:12px;padding:20px;background:linear-gradient(135deg,var(--surface-container-low),var(--surface-container));border-radius:12px;">
                 <span class="material-symbols-outlined" style="font-size:32px;color:var(--primary-soft);">psychiatry</span>
                 <span style="font-size:13px;color:var(--on-surface-variant);font-weight:500;">대표 순간은 아직 준비 중이에요. 먼저 고르고 감상 흐름을 열어보세요.</span>
             </div>
         `;
     }

     function renderTreeCard(tree, index) {
         const memories = Array.isArray(tree.memories) ? tree.memories : [];
         const firstMem = memories[0];
         const lastMem = memories[memories.length - 1];
         const titleHelper = getSearchTitleHelper();
         const isFeatured = index === 0;
         const memoryCount = getDisplayMemoryCount(tree.memoryCount);
         const displayStage = getDisplayStageLabel(tree.stage, memoryCount);
         const displayTheme = getDisplayThemeLabel(tree.theme);
        
        const firstMomentRaw = titleHelper?.cleanMomentTitle
            ? titleHelper.cleanMomentTitle(firstMem?.title || '')
            : (firstMem?.title?.replace(/\s*-\s*.*/, '') || '첫 순간');
        const lastMomentRaw = memories.length >= 2
            ? (titleHelper?.cleanMomentTitle
                ? titleHelper.cleanMomentTitle(lastMem?.title || '')
                : lastMem?.title?.replace(/\s*-\s*.*/, ''))
            : null;
        
        const safeFirstMoment = escapeHtml(firstMomentRaw || '첫 순간');
        const safeLastMoment = lastMomentRaw ? escapeHtml(lastMomentRaw) : null;
        const safeTreeId = escapeHtml(tree.id);
        const safeStage = escapeHtml(displayStage);

        const displayTitleRaw = titleHelper?.getBrowseDisplayTitle
            ? titleHelper.getBrowseDisplayTitle(tree)
            : (String(tree.title || '').trim() || '러브트리');
        const primaryTag = titleHelper?.getPrimaryBrowseTag ? titleHelper.getPrimaryBrowseTag(tree) : '';

        const createdDate = tree.createdAt
            ? new Date(tree.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
            : '';

        const safeTitle = escapeHtml(displayTitleRaw);
         
        let pathDesc;
        if (safeLastMoment) {
            pathDesc = `처음 <strong style="color:var(--primary);">${safeFirstMoment}</strong>의 감정이 <strong>${safeLastMoment}</strong>까지 이어졌어요`;
        } else if (displayTheme) {
            pathDesc = `<strong style="color:var(--primary);">${escapeHtml(displayTheme)}</strong>와 함께 시작된 공개 트리예요`;
        } else if (primaryTag) {
            pathDesc = `<strong style="color:var(--primary);">${escapeHtml(primaryTag)}</strong>의 감정 결이 먼저 남겨진 공개 트리예요`;
        } else if (memoryCount === 0) {
            pathDesc = `<strong style="color:var(--primary);">${safeTitle}</strong>의 첫 감상 흐름을 준비 중이에요`;
        } else {
            pathDesc = `<strong style="color:var(--primary);">${safeFirstMoment}</strong>에서 시작된 공개 트리예요`;
        }

         const emotionTagsHtml = renderEmotionTags(tree.emotionTags);
         const cardId = `tree-card-${safeTreeId}`;
         
         const contextLabel = isFeatured
             ? '오늘 먼저 열어볼 트리'
             : (memoryCount > 1 ? '이어진 기억이 있는 트리' : memoryCount === 0 ? '이제 막 열린 트리' : '첫 순간이 남은 트리');
         const startMomentLabel = displayTheme
             ? `${displayTheme}에서 시작된 마음`
             : memoryCount > 0
                 ? `${firstMomentRaw || '첫 순간'}에서 시작된 마음`
                 : '첫 감상 흐름을 기다리는 공개 트리';

         let html = `
             <div class="tree-card ${isFeatured ? 'tree-card-featured' : ''}" id="${cardId}" data-tree-id="${safeTreeId}" style="animation-delay: ${index * 0.05}s;">
                 ${renderRepresentativeMedia(tree, firstMem, isFeatured, displayTitleRaw)}
                 <div class="tree-card-body">
                 <div class="tree-context-pill">
                     <span class="material-symbols-outlined" style="font-size:15px;">local_florist</span>
                     ${escapeHtml(contextLabel)}
                 </div>
                 <div class="tree-header" style="margin-bottom:16px;">
                     <div class="tree-icon" title="${safeStage}" style="width:48px;height:48px;border-radius:12px;font-size:24px;">${getTreeIcon(tree.stage)}</div>
                     <div class="tree-title-group" style="flex:1;min-width:0;">
                        <div class="tree-title" style="font-size:1.25rem;font-weight:800;line-height:1.3;">${safeTitle}</div>
                        ${renderCardMetaRow(memoryCount, tree.timeRange, createdDate)}
                    </div>
                 </div>
                 <div style="font-size:13px;color:var(--on-surface-variant);line-height:1.55;margin:-6px 0 14px;">
                     ${escapeHtml(startMomentLabel)}
                 </div>
                 
                 <div class="tree-path-section" style="background:var(--surface-container-low);border-radius:1rem;padding:16px;margin-bottom:16px;border:1px solid rgba(144,73,81,0.06);">
                     ${renderCardSectionHeading('route', '이 트리의 감정 경로')}
                     <div style="font-size:14px;line-height:1.5;color:var(--on-surface);">${pathDesc}</div>
                     ${renderPathPreview(memories)}
                 </div>
                 
                 ${emotionTagsHtml ? `<div class="tree-emotions" style="margin-bottom:12px;">${emotionTagsHtml}</div>` : ''}
                 
                 ${renderCardFooterCta(memoryCount > 0 ? '첫 순간부터 감상하기' : '이 트리 먼저 열어보기')}
                 </div>
             </div>
         `;

         return html;
     }

    function renderNoTreesState() {
        const basePath = getBasePath();

        return `
            <div style="text-align: center; padding: 60px 24px; color: var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size: 56px; color: var(--primary); opacity: 0.6; margin-bottom: 20px; display: block;">public</span>
                <p style="font-size: 1.25rem; font-weight: 800; margin-bottom: 12px; color: var(--on-surface);">아직 공개된 러브트리가 없어요</p>
                <p style="font-size: 0.95rem; opacity: 0.8; margin-bottom: 24px; line-height: 1.6;">
                    다른 사람의 공개 트리가 생기면 여기서 둘러볼 수 있어요.<br>
                    지금은 둘러볼 공개 러브트리가 아직 없는 상태입니다.
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
            <div style="text-align: center; padding: 80px 24px; color: var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px; display: block;">search_off</span>
                <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">조건에 맞는 공개 트리가 없네요</p>
                <p style="font-size: 0.9rem; opacity: 0.7;">다른 키워드나 태그로 공개된 러브트리를 찾아보세요.</p>
            </div>
        `;
    }

    function renderDemoBadge() {
        return `
            <div style="background: var(--surface-container); border: 1px solid var(--outline-variant); color: var(--on-surface-variant); padding: 12px 20px; border-radius: 1rem; margin-bottom: 24px; font-size: 13px; text-align: center; font-style: italic;">
                <span style="font-weight: 700;">🌸 샘플 러브트리</span> — 다른 팬들이 남긴 감정의 경로를 둘러보세요
            </div>
        `;
    }

    function renderLoading() {
        return `
            <div style="text-align: center; padding: 80px 24px; color: var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.4; margin-bottom: 16px; display: block; animation: spin 1s linear infinite;">sync</span>
                <p style="font-size: 1.1rem; font-weight: 500;">공개 러브트리를 불러오는 중...</p>
            </div>
        `;
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
            .results-fade-in { animation: fadeIn 0.3s ease-out; }
        `;
        document.head.appendChild(style);
    }

    window.LoveBudSearchCardRenderer = {
        init: init,
        renderTreeCard: renderTreeCard,
        renderResults: renderResults,
        renderLoading: renderLoading,
        renderNoTreesState: renderNoTreesState,
        renderEmptySearchState: renderEmptySearchState,
        renderDemoBadge: renderDemoBadge,
        getTreeIcon: getTreeIcon,
        renderPathPreview: renderPathPreview,
        renderEmotionTags: renderEmotionTags,
        getBasePath: getBasePath
    };

     console.log('[LoveBudSearchCardRenderer] Search card renderer loaded v20260422-1');
 })();
