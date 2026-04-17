/**
 * LoveBud Search Preview Renderer
 * v20260418-1
 * 
 * Rendering layer: preview sidebar panel.
 * DOM-agnostic - updates passed DOM elements.
 * 
 * Dependencies: LoveBudPath (for navigation)
 */

(function() {
    'use strict';

    // ─────────────────────────────────────────────────────────
    // DOM References (cached on init)
    // ─────────────────────────────────────────────────────────

    let _dom = null;

    /**
     * Initializes DOM references
     * @param {Object} domRefs - { previewContainer, previewTitle, previewDesc, previewMemoriesCount, previewTreeDuration, previewEmotionTags }
     */
    function init(domRefs) {
        _dom = domRefs;
    }

    /**
     * Gets tree icon by stage
     * @param {string} stage 
     * @returns {string} Emoji
     */
    function getTreeIcon(stage) {
        const icons = { '입덕': '🌱', '성장': '🌿', '최애': '🌳' };
        return icons[stage] || '🌱';
    }

    /**
     * Renders emotion tags for preview panel
     * @param {Array} tags 
     * @returns {string} HTML string
     */
    function renderEmotionTags(tags) {
        if (!tags || !tags.length) return '';
        return tags.slice(0, 4).map(tag =>
            `<span style="padding:8px 14px;background:var(--primary-container);border-radius:99px;font-size:13px;font-weight:700;color:var(--on-primary-container);border:1px solid var(--outline-variant);">#${tag}</span>`
        ).join('');
    }

    /**
     * Updates preview details for a tree
     * 
     * @param {Object} tree - Tree view model
     */
    function updatePreview(tree) {
        if (!_dom) {
            console.warn('[LoveBudSearchPreviewRenderer] DOM not initialized');
            return;
        }

        const firstMem = tree.memories?.[0];
        if (!firstMem) return;

        // ─────────────────────────────────────────────
        // Video/Iframe container
        // ─────────────────────────────────────────────
        
        if (_dom.previewContainer) {
            _dom.previewContainer.innerHTML = `
                <div style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
                    <iframe width="100%" height="100%"
                        src="${firstMem.sourceUrl}?autoplay=0&mute=1"
                        title="${tree.title}" frameborder="0"
                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen style="position:absolute;top:0;left:0;"></iframe>
                    <!-- 감상 시작 CTA 오버레이 -->
                    <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.8),transparent);padding:40px 20px 20px;color:white;text-align:center;">
                        <div style="font-size:14px;font-weight:700;margin-bottom:8px;opacity:0.9;">첫 순간부터 감상하기</div>
                        <div style="font-size:12px;opacity:0.7;">${firstMem.title}</div>
                    </div>
                </div>
            `;
        }

        // ──��──────────────────────────────────────
        // Title
        // ─────────────────────────────────────────
        
        if (_dom.previewTitle) {
            _dom.previewTitle.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                    <span style="font-size:2rem;background:var(--surface-container-low);width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:12px;">${getTreeIcon(tree.stage)}</span>
                    <div>
                        <div style="font-size:1.1rem;font-weight:800;color:var(--on-surface);line-height:1.3;">${tree.title}</div>
                        <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px;">${tree.memoryCount}개 순간 · ${tree.timeRange}</div>
                    </div>
                </div>
            `;
        }

        // ─────────────────────────────────────────
        // Description with path visualization
        // ─────────────────────────────────────────
        
        if (_dom.previewDesc) {
            // Path stages visualization
            const pathStages = tree.memories.slice(0, 3).map((m, i) => {
                const momentTitle = m.title.replace(/\s*-\s*.*/, '');
                return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--surface-container);border-radius:8px;font-size:13px;"><span style="color:var(--primary);font-weight:800;">${i + 1}</span><span>${momentTitle}</span></span>`;
            }).join('<span style="opacity:0.3;margin:0 4px;">→</span>');
            
            const moreStages = tree.memories.length > 3 
                ? `<div style="margin-top:8px;font-size:12px;color:var(--on-surface-variant);font-style:italic;">... 그리고 ${tree.memories.length - 3}개의 순간 더</div>` 
                : '';

            _dom.previewDesc.innerHTML = `
                <!-- 감정 경로 시각화 -->
                <div style="background:var(--surface-container-low);padding:20px;border-radius:1rem;margin-bottom:16px;">
                    <div style="font-size:11px;font-weight:800;color:var(--on-surface-variant);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:14px;">route</span>
                        어떻게 입덕했을까요?
                    </div>
                    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;line-height:1.8;">
                        ${pathStages}
                    </div>
                    ${moreStages}
                </div>
                
                <!-- 감상 유도 문구 -->
                <div style="font-size:14px;color:var(--on-surface-variant);line-height:1.6;padding:0 4px;">
                    <strong style="color:var(--on-surface);">${tree.theme}</strong> 아티스트와 함께한 
                    <span style="color:var(--primary);font-weight:700;">${tree.memoryCount}개의 감정 순간</span>이 
                    <strong>${tree.timeRange}</strong> 동안 기록되었어요.
                    <div style="margin-top:12px;padding:12px;background:var(--primary-container);border-radius:0.75rem;font-size:13px;color:var(--on-primary-container);font-weight:500;display:flex;align-items:center;gap:8px;">
                        <span class="material-symbols-outlined" style="font-size:18px;">touch_app</span>
                        카드를 클릭하여 감정 경로를 따라가보세요
                    </div>
                </div>
            `;
        }

        // ─────────────────────────────────────────
        // Stats
        // ─────────────────────────────────────────
        
        if (_dom.previewMemoriesCount) {
            _dom.previewMemoriesCount.textContent = tree.memoryCount;
        }
        
        if (_dom.previewTreeDuration) {
            _dom.previewTreeDuration.textContent = tree.timeRange;
        }

        // ─────────────────────────────────────────
        // Emotion Tags
        // ─────────────────────────────────────────
        
        if (_dom.previewEmotionTags) {
            _dom.previewEmotionTags.innerHTML = renderEmotionTags(tree.emotionTags);
        }
    }

    /**
     * Renders placeholder when no tree selected
     * @returns {string} HTML string
     */
    function renderPlaceholder() {
        return `
            <div style="width:100%; height:100%; display:flex; flex-direction: column; align-items:center; justify-content:center; color: var(--on-surface-variant); font-size: 14px; text-align: center; padding: 20px;">
                <span class="material-symbols-outlined" style="font-size: 48px; margin-bottom: 12px; opacity: 0.4;">forest</span>
                <div>카드를 선택하여<br>감정 경로를 미리보세요</div>
            </div>
        `;
    }

    /**
     * Resets preview to placeholder state
     */
    function resetPreview() {
        if (!_dom || !_dom.previewContainer) return;
        
        if (_dom.previewContainer) {
            _dom.previewContainer.innerHTML = renderPlaceholder();
        }
        
        if (_dom.previewTitle) {
            _dom.previewTitle.innerHTML = '---';
        }
        
        if (_dom.previewDesc) {
            _dom.previewDesc.innerHTML = '<p style="font-style: italic; margin-bottom: 16px;">---</p>';
        }
        
        if (_dom.previewMemoriesCount) {
            _dom.previewMemoriesCount.textContent = '-';
        }
        
        if (_dom.previewTreeDuration) {
            _dom.previewTreeDuration.textContent = '-';
        }
        
        if (_dom.previewEmotionTags) {
            _dom.previewEmotionTags.innerHTML = '';
        }
    }

    // ─────────────────────────────────────────────────────────
    // Exports
    // ─────────────────────────────────────────────────────────

    window.LoveBudSearchPreviewRenderer = {
        init: init,
        updatePreview: updatePreview,
        resetPreview: resetPreview,
        renderPlaceholder: renderPlaceholder,
        // Helpers
        getTreeIcon: getTreeIcon,
        renderEmotionTags: renderEmotionTags
    };

    console.log('[LoveBudSearchPreviewRenderer] Search preview renderer loaded v20260418-1');
})();