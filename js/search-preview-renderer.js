/**
 * LoveBud Search Preview Renderer
 * v20260420-1
 * 
 * Rendering layer: preview sidebar panel.
 * DOM-agnostic - updates passed DOM elements.
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
             `<span style="padding:8px 14px;background:var(--primary-container);border-radius:99px;font-size:13px;font-weight:700;color:var(--on-primary-container);border:1px solid var(--outline-variant);">#${escapeHtml(tag)}</span>`
         ).join('');
     }

     function formatShortDate(value) {
         if (!value) return '';
         const date = new Date(value);
         if (Number.isNaN(date.getTime())) return '';
         return date.toLocaleDateString('ko-KR', {
             month: 'short',
             day: 'numeric'
         });
     }

     function getTimelineLabel(tree, memories) {
         const updatedAt = tree.updatedAt || '';
         const createdAt = tree.createdAt || '';
         const firstTimestamp = memories[0]?.timestamp || '';
         const lastTimestamp = memories[memories.length - 1]?.timestamp || '';

         const safeUpdated = formatShortDate(updatedAt);
         const safeCreated = formatShortDate(createdAt);
         const safeFirst = formatShortDate(firstTimestamp);
         const safeLast = formatShortDate(lastTimestamp);

         if (safeUpdated) {
             return `최근 업데이트 ${safeUpdated}`;
         }
         if (safeLast) {
             return `마지막 순간 ${safeLast}`;
         }
         if (safeFirst && safeLast && safeFirst !== safeLast) {
             return `${safeFirst} ~ ${safeLast}`;
         }
         if (safeCreated) {
             return `${safeCreated} 생성`;
         }
         return '업데이트 정보 없음';
     }

     function getPreviewDisplayTitle(tree) {
         const rawTitle = String(tree?.title || '').trim();
         const firstTagRaw = Array.isArray(tree?.emotionTags) && tree.emotionTags.length
             ? String(tree.emotionTags[0] || '').trim()
             : '';
         const themeRaw = String(tree?.theme || '').trim();
         const createdDate = formatShortDate(tree?.createdAt || '');
         const isDefaultTitle = rawTitle === '새 러브트리' || rawTitle === '나의 첫 러브트리';

         if (!isDefaultTitle) {
             return rawTitle || '러브트리';
         }

         if (themeRaw && themeRaw !== 'LoveTree' && themeRaw !== 'Mixed') {
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

         const memories = Array.isArray(tree.memories) ? tree.memories : [];
        const firstMem = memories[0];
        const hasMemories = memories.length > 0;

         // ─────────────────────────────────────────────
         // Video/Iframe container
         // ─────────────────────────────────────────────
         
         if (_dom.previewContainer) {
            const previewDisplayTitle = getPreviewDisplayTitle(tree);
            const safeTreeTitle = escapeHtml(previewDisplayTitle);

            if (!hasMemories) {
                _dom.previewContainer.innerHTML = `
                    <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;background:linear-gradient(135deg,var(--surface-container-low),white);border-radius:1rem;color:var(--on-surface-variant);">
                        <span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);margin-bottom:12px;">psychiatry</span>
                        <div style="font-size:14px;font-weight:800;color:var(--on-surface);margin-bottom:8px;">${safeTreeTitle}</div>
                        <p style="margin:0;font-size:13px;line-height:1.6;">
                            아직 대표 순간이 없어요.<br>
                            첫 입덕 순간이 기록되면 여기에서 바로 미리 볼 수 있어요.
                        </p>
                    </div>
                `;
            } else {
                const safeSourceUrl = sanitizeUrl(firstMem.sourceUrl || '');
                const iframeSrc = safeSourceUrl
                    ? safeSourceUrl + (safeSourceUrl.includes('?') ? '&' : '?') + 'autoplay=0&mute=1'
                    : '';
                const safeFirstMemTitle = escapeHtml(firstMem.title || '');

                _dom.previewContainer.innerHTML = iframeSrc ? `
                    <div style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
                        <iframe width="100%" height="100%"
                            src="${iframeSrc}"
                            title="${safeTreeTitle}" frameborder="0"
                            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen style="position:absolute;top:0;left:0;"></iframe>
                        <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.8),transparent);padding:40px 20px 20px;color:white;text-align:center;">
                            <div style="font-size:14px;font-weight:700;margin-bottom:8px;opacity:0.9;">첫 순간부터 감상하기</div>
                            <div style="font-size:12px;opacity:0.7;">${safeFirstMemTitle}</div>
                        </div>
                    </div>
                ` : renderPlaceholder();
            }
        }

         // ──��──────────────────────────────────────
         // Title
         // ─────────────────────────────────────────
         
         if (_dom.previewTitle) {
             const previewDisplayTitle = getPreviewDisplayTitle(tree);
             const safeTreeTitle = escapeHtml(previewDisplayTitle);
             const safeTimeRange = escapeHtml(tree.timeRange || '기록 없음');

             _dom.previewTitle.innerHTML = `
                 <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                     <span style="font-size:2rem;background:var(--surface-container-low);width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:12px;">${getTreeIcon(tree.stage)}</span>
                     <div>
                         <div style="font-size:1.1rem;font-weight:800;color:var(--on-surface);line-height:1.3;">${safeTreeTitle}</div>
                         <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px;">${tree.memoryCount}개 순간 · ${safeTimeRange}</div>
                     </div>
                 </div>
             `;
         }

         // ─────────────────────────────────────────
         // Description with path visualization
         // ─────────────────────────────────────────
         
         if (_dom.previewDesc) {
            const previewDisplayTitle = getPreviewDisplayTitle(tree);
            const safePreviewDisplayTitle = escapeHtml(previewDisplayTitle);
            const safeTreeTheme = escapeHtml(tree.theme || 'LoveTree');
            const safeTimeRange = escapeHtml(tree.timeRange || '기록 없음');

            if (!hasMemories) {
                _dom.previewDesc.innerHTML = `
                    <div style="background:var(--surface-container-low);padding:20px;border-radius:1rem;margin-bottom:16px;">
                        <div style="font-size:11px;font-weight:800;color:var(--on-surface-variant);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:4px;">
                            <span class="material-symbols-outlined" style="font-size:14px;">route</span>
                            어떻게 입덕했을까요?
                        </div>
                        <div style="font-size:14px;line-height:1.7;color:var(--on-surface-variant);">
                            아직 기록된 순간이 없어 감정 경로가 비어 있어요.<br>
                            첫 순간이 추가되면 이 패널에서 흐름을 바로 미리 볼 수 있어요.
                        </div>
                    </div>

                    <div style="font-size:14px;color:var(--on-surface-variant);line-height:1.6;padding:0 4px;">
                        <strong style="color:var(--on-surface);">${safePreviewDisplayTitle}</strong>는
                        <strong style="color:var(--on-surface);">${safeTreeTheme}</strong> 테마로 시작된 공개 러브트리예요.
                        <span style="color:var(--primary);font-weight:700;">아직 기록은 0개</span>지만,
                        다음 순간이 쌓이면 감정 경로가 여기서 채워집니다.
                        <div style="margin-top:12px;padding:12px;background:var(--surface-container);border-radius:0.75rem;font-size:13px;color:var(--on-surface-variant);font-weight:500;display:flex;align-items:center;gap:8px;">
                            <span class="material-symbols-outlined" style="font-size:18px;">info</span>
                            새로 시작된 공개 트리입니다
                        </div>
                    </div>
                `;
            } else {
                const pathStages = memories.slice(0, 3).map((m, i) => {
                    const momentTitle = escapeHtml((m.title || '').replace(/\s*-\s*.*/, ''));
                    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--surface-container);border-radius:8px;font-size:13px;"><span style="color:var(--primary);font-weight:800;">${i + 1}</span><span>${momentTitle}</span></span>`;
                }).join('<span style="opacity:0.3;margin:0 4px;">→</span>');

                const moreStages = memories.length > 3
                    ? `<div style="margin-top:8px;font-size:12px;color:var(--on-surface-variant);font-style:italic;">... 그리고 ${memories.length - 3}개의 순간 더</div>` 
                    : '';

                _dom.previewDesc.innerHTML = `
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

                    <div style="font-size:14px;color:var(--on-surface-variant);line-height:1.6;padding:0 4px;">
                        <strong style="color:var(--on-surface);">${safeTreeTheme}</strong> 아티스트와 함께한
                        <span style="color:var(--primary);font-weight:700;">${tree.memoryCount}개의 감정 순간</span>이
                        <strong>${safeTimeRange}</strong> 동안 기록되었어요.
                        <div style="margin-top:12px;padding:12px;background:var(--primary-container);border-radius:0.75rem;font-size:13px;color:var(--on-primary-container);font-weight:500;display:flex;align-items:center;gap:8px;">
                            <span class="material-symbols-outlined" style="font-size:18px;">touch_app</span>
                            카드를 클릭하여 감정 경로를 따라가보세요
                        </div>
                    </div>
                `;
            }
        }

         // ─────────────────────────────────────────
         // Stats
         // ─────────────────────────────────────────
         
         if (_dom.previewMemoriesCount) {
             _dom.previewMemoriesCount.textContent = tree.memoryCount;
         }

         if (_dom.previewTreeDuration) {
             _dom.previewTreeDuration.textContent = getTimelineLabel(tree, memories);
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
                <p>카드를 선택하면 감정의 흐름과 대표 순간을 미리 볼 수 있어요.</p>
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

     console.log('[LoveBudSearchPreviewRenderer] Search preview renderer loaded v20260420-1');
 })();