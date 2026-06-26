/**
 * LoveBud Search Preview Renderer
 * v20260506-1
 *
 * Rendering layer: preview sidebar panel.
 * DOM-agnostic - updates passed DOM elements.
 *
 * Dependencies: LoveBudPath (for navigation), LoveBudSearchSharedUtils (for shared utilities)
 */

(function() {
    'use strict';

    const previewBuilders = window.LoveBudSearchPreviewBuilders || {};

    function escapeHtml(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.escapeHtml(value);
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeUrl(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.sanitizeUrl(value);
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

    const isSuspiciousYouTubeThumbnailImage = previewBuilders.isSuspiciousYouTubeThumbnailImage || function(img) { return false; };

    function getCurrentLocale() {
        return window.LoveBudSearchPreviewCopyHelper?.getCurrentLocale() || 'ko';
    }

    function getSearchCopy(key, fallbackKo, fallbackEn) {
        return window.LoveBudSearchPreviewCopyHelper?.getSearchCopy(key, fallbackKo, fallbackEn)
            || (getCurrentLocale() === 'en' ? fallbackEn : fallbackKo);
    }

    function formatSearchCopy(key, replacements, fallbackKo, fallbackEn) {
        return window.LoveBudSearchPreviewCopyHelper?.formatSearchCopy(key, replacements, fallbackKo, fallbackEn)
            || String(getSearchCopy(key, fallbackKo, fallbackEn)).replace(/\{(\w+)\}/g, (_, token) => {
                return Object.prototype.hasOwnProperty.call(replacements, token) ? String(replacements[token]) : '';
            });
    }

    function getPreviewStatsElement() {
        return _dom?.previewMemoriesCount?.closest?.('#previewTreeStats') || document.getElementById('previewTreeStats');
    }

    function getBasePath() {
        const helper = window.LoveBudSearchPreviewActionHelper;
        if (helper?.getBasePath) {
            return helper.getBasePath();
        }
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

    function getTreeDetailHref(tree) {
        const helper = window.LoveBudSearchPreviewActionHelper;
        if (helper?.getTreeDetailHref) {
            return helper.getTreeDetailHref(tree);
        }
        return '';
    }

    function renderPreviewActionButton(tree) {
        const helper = window.LoveBudSearchPreviewActionHelper;
        if (helper?.renderPreviewActionButton) {
            return helper.renderPreviewActionButton(tree);
        }
        return '';
    }

    function renderShareButton(tree) {
        const helper = window.LoveBudSearchPreviewActionHelper;
        if (helper?.renderShareButton) {
            return helper.renderShareButton(tree);
        }
        return '';
    }

    function renderOpenTreeButton(tree) {
        const helper = window.LoveBudSearchPreviewActionHelper;
        if (helper?.renderOpenTreeButton) {
            return helper.renderOpenTreeButton(tree);
        }
        return '';
    }

    const VISIBLE_FLOW_MOMENT_COUNT = 4;

    let _dom = null;
    let currentPreviewTree = null;
    let expandedFlowTreeKey = null;
    let previewFlowToggleBound = false;

    function init(domRefs) {
        _dom = domRefs;
        bindPreviewFlowToggle();
    }

    function getPreviewTreeKey(tree) {
        if (!tree) return '';
        if (tree.id != null && tree.id !== '') {
            return String(tree.id);
        }
        const title = String(tree.title || '').trim();
        const memoryCount = Array.isArray(tree.memories) ? tree.memories.length : Number(tree.memoryCount || 0);
        return `${title}:${memoryCount}`;
    }

    function bindPreviewFlowToggle() {
        if (previewFlowToggleBound) return;
        previewFlowToggleBound = true;

        document.addEventListener('click', (event) => {
            const toggle = event.target?.closest?.('[data-preview-flow-toggle]');
            if (!toggle || !_dom?.previewDesc?.contains(toggle) || !currentPreviewTree) return;

            const treeKey = getPreviewTreeKey(currentPreviewTree);
            expandedFlowTreeKey = expandedFlowTreeKey === treeKey ? null : treeKey;
            updatePreview(currentPreviewTree);
        });
    }

    function setPreviewState(state) {
        const previewContainer = _dom?.previewContainer;
        const previewSidebar = document.getElementById('previewSidebar');
        const stateClassNames = [
            'preview-state-empty',
            'preview-state-loading',
            'preview-state-no-moments',
            'preview-state-media',
            'preview-state-thumbnail'
        ];

        [previewContainer, previewSidebar].forEach((element) => {
            if (!element) return;
            element.classList.remove(...stateClassNames);
            element.classList.add(`preview-state-${state}`);
            element.dataset.previewState = state;
        });
    }

    const getTreeIcon = previewBuilders.getTreeIcon || function(stage) { return '🌱'; };

    function getSearchTitleHelper() {
        return window.LoveBudSearchTitleHelper || null;
    }

    function getMomentLabel(memory, fallbackKo = '시작 순간', fallbackEn = 'Starting moment') {
        const helper = getSearchTitleHelper();
        const cleaned = helper?.cleanMomentTitle
            ? helper.cleanMomentTitle(memory?.title || '')
            : String(memory?.title || '').trim().replace(/\s*-\s*.*/, '');
        return cleaned || getSearchCopy('search.previewMomentFallback', fallbackKo, fallbackEn);
    }

    function getPreviewMediaMemory(memories) {
        return window.LoveBudSearchPreviewMediaHelper?.getPreviewMediaMemory(memories)
            || (Array.isArray(memories) ? memories : []).find(memory => {
                return sanitizeUrl(memory?.sourceUrl || '') || sanitizeUrl(memory?.thumbnail || '');
            }) || null;
    }

    const renderEmotionTags = previewBuilders.renderEmotionTags || function(tags) { return ''; };

    function getTimelineLabel(tree, memories) {
        return previewBuilders.getTimelineLabel?.(tree, memories)
            || getSearchCopy('search.previewTimelineUnavailable', '아직 시작 순간을 기다리는 중이에요', 'Still waiting for the first moment');
    }

    const getDefaultTreeName = previewBuilders.getDefaultTreeName || function() { return '러브트리'; };

    function getPreviewTimeRange(tree) {
        return previewBuilders.getPreviewTimeRange?.(tree)
            || (String(tree?.timeRange || '').trim() || '');
    }

    function getPreviewSummaryCopy(tree, memories) {
        return previewBuilders.getPreviewSummaryCopy?.(tree, memories)
            || formatSearchCopy('search.previewSummaryNoRange',
                { title: escapeHtml(String(tree?.title || '').trim() || '러브트리'), count: Number(tree?.memoryCount || 0) },
                '<strong style="color:var(--on-surface);">{title}</strong>에 담긴 <span style="color:var(--primary);font-weight:700;">{count}개의 순간</span>이 이어졌어요.',
                '<strong style="color:var(--on-surface);">{count} moments</strong> in <strong style="color:var(--on-surface);">{title}</strong> are connected.');
    }

    const renderSectionHeading = previewBuilders.renderSectionHeading || function(icon, label) { return ''; };

    const renderInfoCallout = previewBuilders.renderInfoCallout || function(icon, text, variant) { return ''; };

    const renderPathStageBadge = previewBuilders.renderPathStageBadge || function(index, title) { return ''; };

    const renderPathStages = previewBuilders.renderPathStages || function(memories, startIndex) { return ''; };

    const renderFlowToggleButton = previewBuilders.renderFlowToggleButton || function(hiddenCount, isExpanded) { return ''; };

    const renderHiddenPathStages = previewBuilders.renderHiddenPathStages || function(hiddenMemories, startIndex, isExpanded) { return ''; };

    function renderLoadingPreview(tree) {
        if (!_dom) return;
        currentPreviewTree = tree || null;
        expandedFlowTreeKey = null;
        const titleHelper = getSearchTitleHelper();
        const previewDisplayTitle = titleHelper?.getBrowseDisplayTitle
            ? titleHelper.getBrowseDisplayTitle(tree)
            : (String(tree?.title || '').trim() || getDefaultTreeName());
        const safeTreeTitle = escapeHtml(previewDisplayTitle);
        const previewStats = getPreviewStatsElement();
        setPreviewState('loading');

        if (_dom.previewContainer) {
            _dom.previewContainer.innerHTML = `
                <div class="preview-focus-loading-card" style="width:100%;height:100%;border-radius:1rem;background:linear-gradient(135deg, rgba(255,248,249,0.95), rgba(255,255,255,0.98));display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;color:var(--on-surface-variant);">
                    <span class="material-symbols-outlined" style="font-size:34px;color:var(--primary);margin-bottom:10px;animation:spin 1s linear infinite;">sync</span>
                    <div style="font-size:14px;font-weight:800;color:var(--on-surface);margin-bottom:8px;">${safeTreeTitle}</div>
                    <p style="margin:0;font-size:13px;line-height:1.6;">${escapeHtml(getSearchCopy('search.previewLoadingLead', '이 트리의 대표 순간과 이어진 감정을 불러오는 중이에요.', 'Loading the featured moment and connected feelings of this tree.'))}</p>
                </div>
            `;
        }

        if (_dom.previewTitle) {
            _dom.previewTitle.innerHTML = `<div class="preview-focus-title" style="font-size:1.05rem;font-weight:800;color:var(--on-surface);">${safeTreeTitle}</div>`;
        }

        if (_dom.previewHubFlowSlot) {
            _dom.previewHubFlowSlot.innerHTML = `
                <div class="preview-focus-flow-card preview-focus-flow-card-loading" style="background:var(--surface-container-low);padding:20px;border-radius:1rem;">
                    ${renderSectionHeading('auto_stories', getSearchCopy('search.previewLoadingHeading', '감상 허브를 여는 중', 'Opening the preview hub'))}
                    <div style="font-size:14px;line-height:1.7;color:var(--on-surface-variant);">
                        ${escapeHtml(getSearchCopy('search.previewLoadingBody', '선택한 트리의 대표 순간과 이어진 감정을 이곳에서 먼저 보여드릴게요.', 'The featured moment and connected feelings of this tree will appear here first.'))}
                    </div>
                </div>
            `;
        }
        if (_dom.previewHubSummarySlot) _dom.previewHubSummarySlot.innerHTML = '';
        if (_dom.previewHubActionsSlot) _dom.previewHubActionsSlot.innerHTML = '';
        if (_dom.previewHubSocialSlot) _dom.previewHubSocialSlot.innerHTML = '';

        if (previewStats) {
            previewStats.hidden = true;
        }
        if (_dom.previewEmotionTags) {
            _dom.previewEmotionTags.innerHTML = renderEmotionTags([]);
        }
        var emotionSection = document.getElementById('previewEmotionSection');
        if (emotionSection) emotionSection.hidden = false;
    }

    const renderPreviewThumbnailFallback = previewBuilders.renderPreviewThumbnailFallback || function(title, subtitle) { return ''; };

    function renderPreviewThumbnailMedia(thumbnailUrl, mediaTitle, treeTitle) {
        return window.LoveBudSearchPreviewMediaHelper?.renderPreviewThumbnailMedia(thumbnailUrl, mediaTitle, treeTitle)
            || `
            <div class="preview-media-frame preview-media-frame-thumbnail" style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
                <img src="${thumbnailUrl}" alt="${mediaTitle}" loading="lazy" data-preview-thumbnail-image="" onerror="if(!this.dataset.ytFallback&&this.src.indexOf('hqdefault.jpg')!==-1){this.dataset.ytFallback='1';this.src=this.src.replace('hqdefault.jpg','mqdefault.jpg');}" style="width:100%;height:100%;object-fit:cover;display:block;">
                <div data-preview-thumbnail-fallback hidden style="position:absolute;inset:0;">${renderPreviewThumbnailFallback(
                    treeTitle,
                    getSearchCopy('search.previewNoMomentBody', '시작 순간이 더해지면 이 감상 허브에서 가장 먼저 열어볼 수 있어요.', 'Once the starting moment is added, you will be able to open it here first.')
                )}</div>
                <div data-preview-overlay style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.72),rgba(0,0,0,0.04) 58%);"></div>
                <div data-preview-overlay style="position:absolute;left:18px;right:18px;bottom:18px;color:white;">
                    <div style="display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,0.18);backdrop-filter:blur(10px);font-size:12px;font-weight:800;margin-bottom:10px;">
                        <span class="material-symbols-outlined" style="font-size:14px;">play_circle</span>
                        ${escapeHtml(getSearchCopy('search.previewStartFromFirstMoment', '대표 순간부터 감상하기', 'Start from the featured moment'))}
                    </div>
                    <div style="font-size:14px;font-weight:800;line-height:1.4;">${mediaTitle}</div>
                </div>
            </div>
        `;
    }

    function renderSelectedTreeMediaFallback(treeTitle, memoryCount) {
        const countLabel = memoryCount > 0
            ? formatSearchCopy(
                'search.previewFallbackMomentCount',
                { count: memoryCount },
                '{count}개의 순간이 이어져 있어요.',
                '{count} moments are connected.'
            )
            : getSearchCopy('search.previewStatsPending', '첫 순간을 기다리는 중', 'Waiting for the first moment');

        return `
            <div class="preview-media-fallback preview-media-fallback-selected" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;background:linear-gradient(135deg,var(--surface-container-low),white);border-radius:1rem;color:var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);margin-bottom:12px;">account_tree</span>
                <div style="font-size:14px;font-weight:800;color:var(--on-surface);margin-bottom:8px;">${treeTitle}</div>
                <p style="margin:0;font-size:13px;line-height:1.6;">${escapeHtml(countLabel)}</p>
            </div>
        `;
    }

    function showPreviewImageFallback(img) {
        if (window.LoveBudSearchPreviewMediaHelper?.showPreviewImageFallback) {
            return window.LoveBudSearchPreviewMediaHelper.showPreviewImageFallback(img);
        }

        if (!img) return;
        if (img.dataset.fallbackTriggered) return;
        img.dataset.fallbackTriggered = 'true';
        img.style.display = 'none';
        const wrapper = img.parentElement;
        if (!wrapper) return;
        const fallback = wrapper.querySelector('[data-preview-thumbnail-fallback]');
        if (fallback) {
            fallback.hidden = false;
        }
        const overlays = wrapper.querySelectorAll('[data-preview-overlay]');
        overlays.forEach(overlay => overlay.style.display = 'none');
    }

    function bindPreviewThumbnailHandlers(root) {
        if (!root) return;
        root.querySelectorAll('[data-preview-thumbnail-image]').forEach(img => {
            if (img.dataset.previewImageHandlerBound === 'true') return;
            img.dataset.previewImageHandlerBound = 'true';

            var helper = window.LoveBudSearchPreviewMediaHelper;

            if (img.complete) {
                if (img.naturalWidth === 0) {
                    showPreviewImageFallback(img);
                } else if (helper?.handlePreviewImageLoad) {
                    helper.handlePreviewImageLoad(img);
                } else if (isSuspiciousYouTubeThumbnailImage(img)) {
                    showPreviewImageFallback(img);
                }
                return;
            }

            img.addEventListener('error', function onPreviewError() {
                showPreviewImageFallback(this);
            });
            img.addEventListener('load', function onPreviewLoad() {
                if (helper?.handlePreviewImageLoad) {
                    helper.handlePreviewImageLoad(this);
                } else if (isSuspiciousYouTubeThumbnailImage(this)) {
                    showPreviewImageFallback(this);
                }
            });
        });
    }

     function updatePreview(tree) {
         if (!_dom) {
             console.warn('[LoveBudSearchPreviewRenderer] DOM not initialized');
             return;
         }

         currentPreviewTree = tree || null;
         const memories = Array.isArray(tree.memories) ? tree.memories : [];
         const treeKey = getPreviewTreeKey(tree);
         const isFlowExpanded = !!treeKey && expandedFlowTreeKey === treeKey;
         const firstMem = memories[0];
         const hasMemories = memories.length > 0;
         const displayMemoryCount = Number(tree?.memoryCount || memories.length || 0);
         const previewStats = getPreviewStatsElement();
         const titleHelper = getSearchTitleHelper();
         const previewDisplayTitle = titleHelper?.getBrowseDisplayTitle
             ? titleHelper.getBrowseDisplayTitle(tree)
             : (String(tree?.title || '').trim() || getDefaultTreeName());
         const safeTreeTitle = escapeHtml(previewDisplayTitle);
         let previewState = 'empty';

         // Temporary performance optimization: hide eager video loads
         const hideEagerVideo = window.LoveBudHideEagerVideo === true;

         if (_dom.previewContainer) {
             if (!hasMemories) {
                 previewState = 'no-moments';
                 _dom.previewContainer.innerHTML = `
                     <div class="preview-focus-empty-card" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;background:linear-gradient(135deg,var(--surface-container-low),white);border-radius:1rem;color:var(--on-surface-variant);">
                         <span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);margin-bottom:12px;">psychiatry</span>
                         <div style="font-size:14px;font-weight:800;color:var(--on-surface);margin-bottom:8px;">${safeTreeTitle}</div>
                         <p style="margin:0;font-size:13px;line-height:1.6;">
                             ${escapeHtml(getSearchCopy('search.previewNoMomentTitle', '아직 대표 순간이 또렷하게 남아 있지 않아요.', 'There is no clearly featured moment yet.'))}<br>
                             ${escapeHtml(getSearchCopy('search.previewNoMomentBody', '시작 순간이 더해지면 이 감상 허브에서 가장 먼저 열어볼 수 있어요.', 'Once the starting moment is added, you will be able to open it here first.'))}
                         </p>
                     </div>
                 `;
             } else {
                 const mediaMem = getPreviewMediaMemory(memories);
                 const safeSourceUrl = sanitizeUrl(mediaMem?.sourceUrl || '');
                 const safeThumbnail = sanitizeUrl(mediaMem?.thumbnail || '');
                 const safeMediaMemTitle = escapeHtml(getMomentLabel(mediaMem || firstMem));
                 previewState = safeSourceUrl ? 'media' : 'thumbnail';

                  const mediaHelper = window.LoveBudSearchPreviewMediaHelper;

                  // When hiding eager video, skip iframe rendering and show thumbnail/fallback instead
                 if (mediaHelper?.renderPreviewIframe && safeSourceUrl && !hideEagerVideo) {
                     _dom.previewContainer.innerHTML = mediaHelper.renderPreviewIframe(safeSourceUrl, safeTreeTitle, safeMediaMemTitle);
                 } else {
                     // Show thumbnail or fallback (video is temporarily hidden)
                     const iframeSrc = safeSourceUrl && !hideEagerVideo
                         ? safeSourceUrl + (safeSourceUrl.includes('?') ? '&' : '?') + 'autoplay=0&mute=1'
                         : '';
                     _dom.previewContainer.innerHTML = iframeSrc && !hideEagerVideo ? `
                         <div class="preview-media-frame preview-media-frame-iframe" style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
                             <iframe width="100%" height="100%"
                                 src="${iframeSrc}"
                                 title="${safeTreeTitle}" frameborder="0"
                                 allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                 allowfullscreen style="position:absolute;top:0;left:0;"></iframe>
                             <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.8),transparent);padding:40px 20px 20px;color:white;text-align:center;">
                                 <div style="font-size:14px;font-weight:700;margin-bottom:8px;opacity:0.9;">${escapeHtml(getSearchCopy('search.previewStartFromFirstMoment', '대표 순간부터 감상하기', 'Start from the featured moment'))}</div>
                                 <div style="font-size:12px;opacity:0.7;">${safeMediaMemTitle}</div>
                             </div>
                         </div>
                     ` : (safeThumbnail
                         ? renderPreviewThumbnailMedia(safeThumbnail, safeMediaMemTitle, safeTreeTitle)
                         : renderSelectedTreeMediaFallback(safeTreeTitle, displayMemoryCount));
                 }
             }
            setPreviewState(previewState);
            bindPreviewThumbnailHandlers(_dom.previewContainer);
        }

        if (_dom.previewTitle) {
            const safeTimeRange = escapeHtml(String(tree?.timeRange || getSearchCopy('search.previewUnknownRange', '아직 흐름이 또렷하지 않아요', 'The flow is not clear yet')).trim());
            const memoryCountSuffix = getSearchCopy('search.previewMomentCountSuffix', '개의 순간', 'moments');
            const titleMeta = hasMemories
                ? `${displayMemoryCount}${escapeHtml(memoryCountSuffix)} · ${safeTimeRange}`
                : escapeHtml(getSearchCopy('search.previewStatsPending', '첫 순간을 기다리는 중', 'Waiting for the first moment'));

            _dom.previewTitle.innerHTML = `
                <div class="preview-focus-title-block" style="margin-bottom:12px;">
                    <div class="preview-focus-title" style="font-size:1.18rem;font-weight:900;color:var(--on-surface);line-height:1.25;overflow-wrap:anywhere;">${safeTreeTitle}</div>
                    <div class="preview-focus-title-meta" style="font-size:12px;color:var(--on-surface-variant);margin-top:2px;">${titleMeta}</div>
                </div>
            `;
        }

        if (_dom.previewDesc) {
            _dom.previewDesc.hidden = false;

            const metadataHelper = window.LoveBudSearchPublicMetadataHelper;
            const hubMetadataHtml = (metadataHelper && typeof metadataHelper.renderHubMetadata === 'function')
                ? metadataHelper.renderHubMetadata(tree)
                : '';

            var dynamicMeta = document.getElementById('previewHubDynamicMetadataSlot');
            if (dynamicMeta) {
                dynamicMeta.innerHTML = hubMetadataHtml;
            }

            if (!hasMemories) {
                const noRecordsLine = formatSearchCopy(
                    'search.previewNoRecordsLine',
                    {
                        countLabel: escapeHtml(getSearchCopy('search.previewNoRecordsYet', '아직 남아 있는 순간은 없지만', 'There are no saved moments yet, but')),
                        followup: escapeHtml(getSearchCopy('search.previewNoRecordsFollowup', '다음 순간이 이어지면 이곳에서 흐름이 함께 열려요.', 'when the next moment is added, the flow will open here together.'))
                    },
                    '{countLabel} {followup}',
                    '{countLabel} {followup}'
                );

                if (_dom.previewHubFlowSlot) {
                    _dom.previewHubFlowSlot.innerHTML = `
                        <div class="preview-focus-flow-card preview-focus-flow-card-empty" style="background:var(--surface-container-low);padding:20px;border-radius:1rem;margin-bottom:16px;">
                            ${renderSectionHeading('route', getSearchCopy('search.previewTimelineHeading', '이 트리는 어디서 시작될까요?', 'Where will this tree begin?'))}
                            <div style="font-size:14px;line-height:1.7;color:var(--on-surface-variant);">
                                ${escapeHtml(getSearchCopy('search.previewTimelineEmpty', '아직 시작 순간이 남아 있지 않아 흐름이 비어 있어요.', 'The flow is still empty because the starting moment has not been saved yet.'))}<br>
                                ${escapeHtml(getSearchCopy('search.previewTimelineEmptyBody', '첫 순간이 더해지면 이 패널에서 대표 순간과 흐름을 바로 볼 수 있어요.', 'Once the first moment is added, you will be able to see the featured moment and flow in this panel.'))}
                            </div>
                        </div>
                    `;
                }
                if (_dom.previewHubSummarySlot) {
                    _dom.previewHubSummarySlot.innerHTML = `
                        <div class="preview-focus-copy">
                            ${getPreviewSummaryCopy(tree, memories)}
                            <span style="color:var(--primary);font-weight:700;">${noRecordsLine}</span>
                            ${renderInfoCallout('info', getSearchCopy('search.previewNewTreeInfo', '이제 막 감상이 시작될 공개 러브트리예요.', 'This public LoveTree is just about to begin.'))}
                        </div>
                    `;
                }
                if (_dom.previewHubActionsSlot) {
                    _dom.previewHubActionsSlot.innerHTML = `
                        ${renderOpenTreeButton(tree)}
                        ${renderPreviewActionButton(tree)}
                        ${renderShareButton(tree)}
                    `;
                }
            } else {
                const visibleMemories = memories.slice(0, VISIBLE_FLOW_MOMENT_COUNT);
                const hiddenMemories = memories.slice(VISIBLE_FLOW_MOMENT_COUNT);
                const pathStages = renderPathStages(visibleMemories, 0, false);
                const flowToggle = renderFlowToggleButton(hiddenMemories.length, isFlowExpanded);
                const hiddenStages = renderHiddenPathStages(hiddenMemories, VISIBLE_FLOW_MOMENT_COUNT, isFlowExpanded);
                const firstMomentLabel = getMomentLabel(firstMem, '시작 순간', 'Starting moment');
                const lastMomentLabel = getMomentLabel(memories[memories.length - 1], '최근에 남은 순간', 'Latest saved moment');

                if (_dom.previewHubFlowSlot) {
                    _dom.previewHubFlowSlot.innerHTML = `
                        <div class="preview-focus-flow-card" style="background:var(--surface-container-low);padding:20px;border-radius:1rem;margin-bottom:16px;">
                            ${renderSectionHeading('route', getSearchCopy('search.previewTimelineHeading', '대표 순간에서 이어진 흐름', 'Flow connected from the featured moment'))}
                            <div class="preview-flow-list">
                                ${pathStages}
                            </div>
                            ${hiddenStages}
                            ${flowToggle ? `<div class="preview-flow-controls">${flowToggle}</div>` : ''}
                        </div>
                    `;
                }
                if (_dom.previewHubSummarySlot) {
                    _dom.previewHubSummarySlot.innerHTML = `
                        <div class="preview-focus-copy">
                            ${getPreviewSummaryCopy(tree, memories)}
                            ${renderInfoCallout('favorite', `${firstMomentLabel}에서 시작해 ${lastMomentLabel}까지 이어진 감정의 흐름이에요.`)}
                            ${renderInfoCallout('touch_app', getSearchCopy('search.previewJourneyCta', '이곳에서 대표 순간과 이어진 감정을 훑어보고, 마음이 머무는 순간으로 들어가 보세요.', 'Scan the featured moment and connected feelings here, then open the moment that draws you in.'), 'primary')}
                        </div>
                    `;
                }
                if (_dom.previewHubActionsSlot) {
                    _dom.previewHubActionsSlot.innerHTML = `
                        ${renderOpenTreeButton(tree)}
                        ${renderPreviewActionButton(tree)}
                        ${renderShareButton(tree)}
                    `;
                }
            }
        }

        if (previewStats) {
            previewStats.hidden = !hasMemories;
        }
        if (_dom.previewMemoriesCount) {
            _dom.previewMemoriesCount.textContent = hasMemories ? displayMemoryCount : '';
        }
        if (_dom.previewTreeDuration) {
            _dom.previewTreeDuration.textContent = hasMemories ? getTimelineLabel(tree, memories) : '';
        }
        if (_dom.previewEmotionTags) {
            _dom.previewEmotionTags.innerHTML = renderEmotionTags(tree.emotionTags);
        }
        var emotionSection = document.getElementById('previewEmotionSection');
        if (emotionSection) emotionSection.hidden = false;
    }

    const renderPlaceholder = previewBuilders.renderPlaceholder || function() {
        return '<div class="preview-empty-guide">' +
            '<p>' + escapeHtml(getSearchCopy('search.previewEmptyLead', '러브트리를 고르면', 'Choose a LoveTree')) + '</p>' +
            '<p>' + escapeHtml(getSearchCopy('search.previewEmptyBody', '이어진 순간의 흐름이 여기에 열려요.', 'to open its connected moments here.')) + '</p>' +
            '</div>';
    }

    function resetPreview() {
        if (!_dom || !_dom.previewContainer) return;

        currentPreviewTree = null;
        expandedFlowTreeKey = null;
        const previewStats = getPreviewStatsElement();
        const placeholderTitle = getSearchCopy(
            'search.previewPlaceholder',
            '러브트리를 고르면',
            'Choose a LoveTree'
        );
        const placeholderDescription = getSearchCopy(
            'search.previewDescriptionPlaceholder',
            '이어진 순간의 흐름이 여기에 열려요.',
            'to open its connected moments here.'
        );
        setPreviewState('empty');

        if (_dom.previewContainer) {
            _dom.previewContainer.innerHTML = renderPlaceholder();
        }
        if (_dom.previewTitle) {
            _dom.previewTitle.textContent = placeholderTitle;
        }
        if (_dom.previewDesc) {
            _dom.previewDesc.hidden = false;
        }
        var dynamicMeta = document.getElementById('previewHubDynamicMetadataSlot');
        if (dynamicMeta) dynamicMeta.innerHTML = '';
        if (_dom.previewHubFlowSlot) _dom.previewHubFlowSlot.innerHTML = '';
        if (_dom.previewHubSummarySlot) _dom.previewHubSummarySlot.innerHTML = '';
        if (_dom.previewHubActionsSlot) _dom.previewHubActionsSlot.innerHTML = '';
        if (_dom.previewHubSocialSlot) _dom.previewHubSocialSlot.innerHTML = '';
        if (_dom.previewHubSummarySlot) {
            _dom.previewHubSummarySlot.innerHTML = '<p class="preview-empty-description">' + escapeHtml(placeholderDescription) + '</p>';
        }
        if (previewStats) {
            previewStats.hidden = true;
        }
        if (_dom.previewMemoriesCount) {
            _dom.previewMemoriesCount.textContent = '0';
        }
        if (_dom.previewTreeDuration) {
            _dom.previewTreeDuration.textContent = '';
        }
        if (_dom.previewEmotionTags) {
            _dom.previewEmotionTags.innerHTML = renderEmotionTags([]);
        }
        var emotionSection = document.getElementById('previewEmotionSection');
        if (emotionSection) emotionSection.hidden = true;
    }

    window.LoveBudSearchPreviewRenderer = {
        init: init,
        updatePreview: updatePreview,
        resetPreview: resetPreview,
        renderPlaceholder: renderPlaceholder,
        renderLoadingPreview: renderLoadingPreview,
        getTreeIcon: getTreeIcon,
        renderEmotionTags: renderEmotionTags,
        showPreviewImageFallback: showPreviewImageFallback,
        handlePreviewImageLoad: (img) => {
            if (isSuspiciousYouTubeThumbnailImage(img)) {
                showPreviewImageFallback(img);
            }
        }
    };

})();
