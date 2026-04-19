/**
 * LoveBud Search Card Renderer
 * v20260420-1
 * 
 * Rendering layer: tree cards, empty states.
 * DOM-agnostic - returns HTML strings.
 * 
 * Dependencies: LoveBudPath (for navigation)
 */

 (function() {
     'use strict';

     // ─────────────────────────────────────────────────────────
     // Security helpers (XSS prevention)
     // ─────────────────────────────────────────────────────────

     function escapeHtml(value) {
         return String(value == null ? '' : value)
             .replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
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

     // ─────────────────────────────────────────────────────────
     // DOM References (cached on init)
     // ─────────────────────────────────────────────────────────

    let _resultsList = null;

    /**
     * Initializes DOM references
     * @param {HTMLElement} resultsListEl - Results container element
     */
    function init(resultsListEl) {
        _resultsList = resultsListEl;
    }

    /**
     * Gets base path for navigation
     * @returns {string}
     */
    function getBasePath() {
        if (window.LoveBudPath?.getBasePath) {
            return window.LoveBudPath.getBasePath();
        }
        // Fallback: detect from current path
        const path = window.location.pathname;
        return path.indexOf('/pages/') !== -1 ? '' : 'pages/';
    }

    /**
     * Excerpts text to max length
     * @param {string} text 
     * @param {number} max 
     * @returns {string}
     */
    function excerpt(text, max = 60) {
        if (!text) return '';
        return text.length > max ? text.slice(0, max) + '…' : text;
    }

    /**
     * Gets tree icon by stage
     * @param {string} stage - '입덕' | '성장' | '최애'
     * @returns {string} Emoji
     */
    function getTreeIcon(stage) {
        const icons = { '입덕': '🌱', '성장': '🌿', '최애': '🌳' };
        return icons[stage] || '🌱';
    }

    /**
     * Renders path preview (thumbnail row)
     * @param {Array} memories - Tree memories
     * @returns {string} HTML string
     */
     function renderPathPreview(memories) {
         if (!memories || memories.length === 0) return '';

         const previewCount = Math.min(memories.length, 3);
         const previewMems = memories.slice(0, previewCount);

         let html = '<div class="tree-path-preview">';

         previewMems.forEach((mem, idx) => {
             const safeTitle = escapeHtml(mem?.title || '');
             const safeThumb = sanitizeUrl(mem?.thumbnail || '');

             html += `
                 <div class="path-node" title="${safeTitle}">
                     <img src="${safeThumb}" alt="${safeTitle}" loading="lazy">
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

    /**
     * Renders emotion tags for card
     * @param {Array} tags - Emotion tags
     * @returns {string} HTML string
     */
     function renderEmotionTags(tags) {
         if (!tags || !tags.length) return '';
         return tags.slice(0, 3).map(tag =>
             `<span class="emotion-tag" style="background:var(--primary-container);color:var(--on-primary-container);font-weight:700;font-size:12px;padding:6px 12px;">#${escapeHtml(tag)}</span>`
         ).join('');
     }

    /**
     * Renders a single tree card
     *
     * @param {Object} tree - Tree view model
     * @param {number} index - Card index (for animation delay)
     * @returns {string} HTML string
     */
     function renderTreeCard(tree, index) {
         const firstMem = tree.memories[0];
         const lastMem = tree.memories[tree.memories.length - 1];
         
         // Clean titles
         const firstMomentRaw = firstMem?.title?.replace(/\s*-\s*.*/, '') || '첫 순간';
         const lastMomentRaw = tree.memories.length >= 2
             ? lastMem?.title?.replace(/\s*-\s*.*/, '')
             : null;
         
         const safeFirstMoment = escapeHtml(firstMomentRaw);
         const safeLastMoment = lastMomentRaw ? escapeHtml(lastMomentRaw) : null;
         const safeTreeId = escapeHtml(tree.id);
         const safeStage = escapeHtml(tree.stage);
         const safeTitle = escapeHtml(tree.title);
         const safeTimeRange = escapeHtml(tree.timeRange);
         
         // Path description
         const pathDesc = safeLastMoment
             ? `처음 <strong style="color:var(--primary);">${safeFirstMoment}</strong>의 감정이 <strong>${safeLastMoment}</strong>까지 이어졌어요`
             : `<strong style="color:var(--primary);">${safeFirstMoment}</strong> — 입덕의 첫 순간`;

         const emotionTagsHtml = renderEmotionTags(tree.emotionTags);
         
         // Default click handler (navigate to first memory)
         const cardId = `tree-card-${safeTreeId}`;
         
         let html = `
             <div class="tree-card" id="${cardId}" data-tree-id="${safeTreeId}" style="animation-delay: ${index * 0.05}s;">
                 <!-- 트리 헤더: 제목 + 단계 아이콘 -->
                 <div class="tree-header" style="margin-bottom:16px;">
                     <div class="tree-icon" title="${safeStage} 단계" style="width:48px;height:48px;border-radius:12px;font-size:24px;">${getTreeIcon(tree.stage)}</div>
                     <div class="tree-title-group" style="flex:1;min-width:0;">
                         <div class="tree-title" style="font-size:1.25rem;font-weight:800;line-height:1.3;">${safeTitle}</div>
                         <div style="font-size:12px;color:var(--on-surface-variant);margin-top:4px;display:flex;align-items:center;gap:8px;">
                             <span class="material-symbols-outlined" style="font-size:14px;">account_tree</span>
                             ${tree.memoryCount}개의 순간 · ${safeTimeRange}
                         </div>
                     </div>
                 </div>
                 
                 <!-- 감정 경로 미리보기 (시각적 중심) -->
                 <div class="tree-path-section" style="background:var(--surface-container-low);border-radius:1rem;padding:16px;margin-bottom:16px;">
                     <div style="font-size:11px;font-weight:800;color:var(--on-surface-variant);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">
                         <span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle;margin-right:4px;">route</span>
                         감정 경로
                     </div>
                     <div style="font-size:14px;line-height:1.5;color:var(--on-surface);">${pathDesc}</div>
                     ${renderPathPreview(tree.memories)}
                 </div>
                 
                 <!-- 감정 태그 -->
                 <div class="tree-emotions" style="margin-bottom:12px;">
                     ${emotionTagsHtml}
                 </div>
                 
                 <!-- 감상 유도 문구 -->
                 <div style="font-size:13px;color:var(--on-surface-variant);font-style:italic;padding-top:12px;border-top:1px solid var(--outline-variant);display:flex;align-items:center;gap:6px;">
                     <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary);">play_circle</span>
                     첫 순간부터 감상하기
                 </div>
             </div>
         `;

         // If custom handlers provided, return plain HTML - caller attaches events
         return html;
     }

    /**
     * Renders empty state (no trees at all)
     * @returns {string} HTML string
     */
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

    /**
     * Renders empty search result state
     * @returns {string} HTML string
     */
    function renderEmptySearchState() {
        return `
            <div style="text-align: center; padding: 80px 24px; color: var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px; display: block;">search_off</span>
                <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">조건에 맞는 공개 트리가 없네요</p>
                <p style="font-size: 0.9rem; opacity: 0.7;">다른 키워드나 태그로 공개된 러브트리를 찾아보세요.</p>
            </div>
        `;
    }

    /**
     * Renders demo badge
     * @returns {string} HTML string
     */
    function renderDemoBadge() {
        return `
            <div style="background: var(--surface-container); border: 1px solid var(--outline-variant); color: var(--on-surface-variant); padding: 12px 20px; border-radius: 1rem; margin-bottom: 24px; font-size: 13px; text-align: center; font-style: italic;">
                <span style="font-weight: 700;">🌸 샘플 러브트리</span> — 다른 팬들이 남긴 감정의 경로를 둘러보세요
            </div>
        `;
    }

    // ─────────────────────────────────────────────────────────
    // Batch Rendering
    // ─────────────────────────────────────────────────────────

    /**
     * Renders loading state
     * @returns {string} HTML string
     */
    function renderLoading() {
        return `
            <div style="text-align: center; padding: 80px 24px; color: var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.4; margin-bottom: 16px; display: block; animation: spin 1s linear infinite;">sync</span>
                <p style="font-size: 1.1rem; font-weight: 500;">기억들을 불러오는 중...</p>
            </div>
        `;
    }

    /**
     * Renders all results (cards or empty state)
     *
     * @param {Array} trees - Tree view models
     * @param {Object} options - Options { isDemo? }
     * @returns {string} HTML string
     */
    function renderResults(trees, options = {}) {
        const { isDemo = false } = options;

        // Ensure animations
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

    /**
     * Adds animation styles if not present
     */
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

    // ─────────────────────────────────────────────────────────
    // Exports
    // ─────────────────────────────────────────────────────────

    window.LoveBudSearchCardRenderer = {
        init: init,
        renderTreeCard: renderTreeCard,
        renderResults: renderResults,
        renderLoading: renderLoading,
        renderNoTreesState: renderNoTreesState,
        renderEmptySearchState: renderEmptySearchState,
        renderDemoBadge: renderDemoBadge,
        // Helpers
        getTreeIcon: getTreeIcon,
        renderPathPreview: renderPathPreview,
        renderEmotionTags: renderEmotionTags,
        getBasePath: getBasePath
    };

     console.log('[LoveBudSearchCardRenderer] Search card renderer loaded v20260420-1');
 })();