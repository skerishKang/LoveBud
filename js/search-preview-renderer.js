/**
 * LoveBud Search Preview Renderer
 * v20260422-4
 * 
 * Rendering layer: preview sidebar panel.
 * DOM-agnostic - updates passed DOM elements.
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
            .replace(/\\"/g, '&quot;')
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

    function getCurrentLocale() {
        const locale = window.i18n?.currentLang || document.documentElement?.lang || 'ko';
        return String(locale).toLowerCase().startsWith('en') ? 'en' : 'ko';
    }

    function getSearchCopy(key, fallbackKo, fallbackEn) {
        const locale = getCurrentLocale();
        const dict = window.i18nSearch?.[key];
        if (dict && typeof dict === 'object') {
            return dict[locale] || dict.ko || dict.en || fallbackKo;
        }
        return locale === 'en' ? fallbackEn : fallbackKo;
    }

    function formatSearchCopy(key, replacements, fallbackKo, fallbackEn) {
        const template = getSearchCopy(key, fallbackKo, fallbackEn);
        return String(template).replace(/\{(\w+)\}/g, (_, token) => {
            return Object.prototype.hasOwnProperty.call(replacements, token)
                ? String(replacements[token])
                : '';
        });
    }

    function getPreviewStatsElement() {
        return _dom?.previewMemoriesCount?.closest?.('#previewTreeStats') || document.getElementById('previewTreeStats');
    }

    function getBasePath() {
        if (window.LoveBudPath?.getBasePath) {
            return window.LoveBudPath.getBasePath();
        }
        const path = window.location.pathname;
        return path.indexOf('/pages/') !== -1 ? '' : 'pages/';
    }

    function getTreeDetailHref(tree) {
        const memories = Array.isArray(tree?.memories) ? tree.memories : [];
        const firstMemory = memories[0];
        if (!tree?.id || !firstMemory?.id) return '';
        const basePath = getBasePath();
        return `${basePath}detail.html?id=${encodeURIComponent(firstMemory.id)}&tree=${encodeURIComponent(tree.id)}&from=browse`;
    }

    function renderPreviewActionButton(tree) {
        const href = getTreeDetailHref(tree);
        if (!href) return '';
        const label = getSearchCopy(
            'search.previewOpenTreeCta',
            '이 트리 열기',
            'Open this tree'
        );
        return `
            <a href="${escapeHtml(href)}" class="btn-round btn-primary" style="width:100%;margin-top:18px;min-height:50px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:14px;font-weight:800;gap:8px;">
                <span class="material-symbols-outlined" style="font-size:18px;">play_circle</span>
                ${escapeHtml(label)}
            </a>
        `;
    }

    let _dom = null;

    function init(domRefs) {
        _dom = domRefs;
    }

    function getTreeIcon(stage) {
        const icons = { '입덕': '🌱', '성장': '🌿', '최애': '🌳', '새 트리': '🌱' };
        return icons[stage] || '🌱';
    }

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
        return (Array.isArray(memories) ? memories : []).find(memory => {
            return sanitizeUrl(memory?.sourceUrl || '') || sanitizeUrl(memory?.thumbnail || '');
        }) || null;
    }

    function renderEmotionTags(tags) {
        const titleHelper = getSearchTitleHelper();
        const safeTags = (Array.isArray(tags) ? tags : [])
            .map(tag => titleHelper?.sanitizeBrowseLabel ? titleHelper.sanitizeBrowseLabel(tag) : String(tag || '').trim())
            .filter(Boolean)
            .filter(tag => tag !== '기록' && tag !== 'tag_record')
            .slice(0, 4);

        if (!safeTags.length) {
            return `
                <span style="padding:8px 14px;background:var(--surface-container-low);border-radius:99px;font-size:13px;font-weight:600;color:var(--on-surface-variant);border:1px solid var(--outline-variant);">
                    ${escapeHtml(getSearchCopy('search.previewNoEmotionTags', '아직 이어진 감정은 없어요.', 'There are no clearly saved emotions yet.'))}
                </span>
            `;
        }

        return safeTags.map(tag =>
            `<span style="padding:8px 14px;background:var(--primary-container);border-radius:99px;font-size:13px;font-weight:700;color:var(--on-primary-container);border:1px solid var(--outline-variant);">#${escapeHtml(tag)}</span>`
        ).join('');
    }

    function getTimelineLabel(tree, memories) {
        const titleHelper = getSearchTitleHelper();
        const formatDate = titleHelper?.formatShortDate || ((value) => {
            if (!value) return '';
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return '';
            return date.toLocaleDateString(getCurrentLocale() === 'en' ? 'en-US' : 'ko-KR', {
                month: 'short',
                day: 'numeric'
            });
        });

        const updatedAt = tree.updatedAt || '';
        const createdAt = tree.createdAt || '';
        const firstTimestamp = memories[0]?.timestamp || '';
        const lastTimestamp = memories[memories.length - 1]?.timestamp || '';

        const safeUpdated = formatDate(updatedAt);
        const safeCreated = formatDate(createdAt);
        const safeFirst = formatDate(firstTimestamp);
        const safeLast = formatDate(lastTimestamp);

        if (safeUpdated) {
            return `${getSearchCopy('search.previewTimelineRecentUpdate', '최근에 이어진 감정', 'Recently added moment')} ${safeUpdated}`;
        }
        if (safeLast) {
            return `${getSearchCopy('search.previewTimelineLastMoment', '가장 최근에 남은 순간', 'Latest saved moment')} ${safeLast}`;
        }
        if (safeFirst && safeLast && safeFirst !== safeLast) {
            return `${safeFirst} ~ ${safeLast}`;
        }
        if (safeCreated) {
            return `${getSearchCopy('search.previewTimelineCreated', '처음 남긴 날', 'First saved on')} ${safeCreated}`;
        }
        return getSearchCopy('search.previewTimelineUnavailable', '아직 시작 순간을 기다리는 중이에요', 'Still waiting for the first moment');
    }

    function getDefaultTreeName() {
        return getSearchCopy('search.previewDefaultTreeName', '러브트리', 'LoveTree');
    }

    function getPreviewSummaryCopy(tree, memories) {
        const titleHelper = getSearchTitleHelper();
        const displayTitle = titleHelper?.getBrowseDisplayTitle
            ? titleHelper.getBrowseDisplayTitle(tree)
            : (String(tree?.title || '').trim() || getDefaultTreeName());
        const themeLabel = titleHelper?.getThemeLabel
            ? titleHelper.getThemeLabel(tree)
            : '';
        const timeRange = String(tree?.timeRange || getSearchCopy('search.previewUnknownRange', '아직 흐름이 또렷하지 않아요', 'The flow is not clear yet')).trim();
        const memoryCount = Number(tree?.memoryCount || 0);
        const safeTitle = escapeHtml(displayTitle);
        const safeTheme = escapeHtml(themeLabel);
        const safeRange = escapeHtml(timeRange);

        if (!memories.length) {
            if (themeLabel) {
                return formatSearchCopy(
                    'search.previewSummaryThemeStart',
                    { title: safeTitle, theme: safeTheme },
                    '<strong style="color:var(--on-surface);">{title}</strong>는 <strong style="color:var(--on-surface);">{theme}</strong>와 함께 막 시작된 공개 러브트리예요.',
                    '<strong style="color:var(--on-surface);">{title}</strong> is a public LoveTree that has just begun with <strong style="color:var(--on-surface);">{theme}</strong>.'
                );
            }
            return formatSearchCopy(
                'search.previewSummaryStart',
                { title: safeTitle },
                '<strong style="color:var(--on-surface);">{title}</strong>는 이제 막 시작된 공개 러브트리예요.',
                '<strong style="color:var(--on-surface);">{title}</strong> is a newly started public LoveTree.'
            );
        }

        if (themeLabel) {
            return formatSearchCopy(
                'search.previewSummaryThemeRange',
                { theme: safeTheme, count: memoryCount, range: safeRange },
                '<strong style="color:var(--on-surface);">{theme}</strong>와 함께한 <span style="color:var(--primary);font-weight:700;">{count}개의 순간</span>이 <strong>{range}</strong>에 걸쳐 이어졌어요.',
                '<strong style="color:var(--on-surface);">{count} moments</strong> with <strong style="color:var(--on-surface);">{theme}</strong> continued across <strong>{range}</strong>.'
            );
        }

        return formatSearchCopy(
            'search.previewSummaryRange',
            { title: safeTitle, count: memoryCount, range: safeRange },
            '<strong style="color:var(--on-surface);">{title}</strong>에 담긴 <span style="color:var(--primary);font-weight:700;">{count}개의 순간</span>이 <strong>{range}</strong>에 걸쳐 이어졌어요.',
            '<strong style="color:var(--on-surface);">{count} moments</strong> in <strong style="color:var(--on-surface);">{title}</strong> continued across <strong>{range}</strong>.'
        );
    }

    function renderSectionHeading(icon, label) {
        return `
            <div style="font-size:11px;font-weight:800;color:var(--on-surface-variant);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:4px;">
                <span class="material-symbols-outlined" style="font-size:14px;">${escapeHtml(icon)}</span>
                ${escapeHtml(label)}
            </div>
        `;
    }

    function renderInfoCallout(icon, text, variant = 'neutral') {
        const isPrimary = variant === 'primary';
        const background = isPrimary ? 'var(--primary-container)' : 'var(--surface-container)';
        const color = isPrimary ? 'var(--on-primary-container)' : 'var(--on-surface-variant)';

        return `
            <div style="margin-top:12px;padding:12px;background:${background};border-radius:0.75rem;font-size:13px;color:${color};font-weight:500;display:flex;align-items:center;gap:8px;">
                <span class="material-symbols-outlined" style="font-size:18px;">${escapeHtml(icon)}</span>
                ${escapeHtml(text)}
            </div>
        `;
    }

    function renderPathStageBadge(index, title) {
        return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--surface-container);border-radius:8px;font-size:13px;"><span style="color:var(--primary);font-weight:800;">${index}</span><span>${escapeHtml(title)}</span></span>`;
    }

    function renderMoreStagesText(count) {
        if (!count || count <= 0) return '';
        return formatSearchCopy(
            'search.previewMoreMoments',
            { count },
            '... 그리고 {count}개의 순간 더',
            '... and {count} more moments'
        );
    }

    function renderLoadingPreview(tree) {
        if (!_dom) return;
        const titleHelper = getSearchTitleHelper();
        const previewDisplayTitle = titleHelper?.getBrowseDisplayTitle
            ? titleHelper.getBrowseDisplayTitle(tree)
            : (String(tree?.title || '').trim() || getDefaultTreeName());
        const safeTreeTitle = escapeHtml(previewDisplayTitle);
        const previewStats = getPreviewStatsElement();

        if (_dom.previewContainer) {
            _dom.previewContainer.innerHTML = `
                <div style="width:100%;height:100%;border-radius:1rem;background:linear-gradient(135deg, rgba(255,248,249,0.95), rgba(255,255,255,0.98));display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;color:var(--on-surface-variant);">
                    <span class="material-symbols-outlined" style="font-size:34px;color:var(--primary);margin-bottom:10px;animation:spin 1s linear infinite;">sync</span>
                    <div style="font-size:14px;font-weight:800;color:var(--on-surface);margin-bottom:8px;">${safeTreeTitle}</div>
                    <p style="margin:0;font-size:13px;line-height:1.6;">${escapeHtml(getSearchCopy('search.previewLoadingLead', '이 트리의 대표 순간과 이어진 감정을 불러오는 중이에요.', 'Loading the featured moment and connected feelings of this tree.'))}</p>
                </div>
            `;
        }

        if (_dom.previewTitle) {
            _dom.previewTitle.innerHTML = `<div style="font-size:1.05rem;font-weight:800;color:var(--on-surface);">${safeTreeTitle}</div>`;
        }

        if (_dom.previewDesc) {
            _dom.previewDesc.innerHTML = `
                <div style="background:var(--surface-container-low);padding:20px;border-radius:1rem;">
                    ${renderSectionHeading('auto_stories', getSearchCopy('search.previewLoadingHeading', '감상 허브를 여는 중', 'Opening the preview hub'))}
                    <div style="font-size:14px;line-height:1.7;color:var(--on-surface-variant);">
                        ${escapeHtml(getSearchCopy('search.previewLoadingBody', '선택한 트리의 대표 순간과 이어진 감정을 이곳에서 먼저 보여드릴게요.', 'The featured moment and connected feelings of this tree will appear here first.'))}
                    </div>
                </div>
            `;
        }

        if (previewStats) {
            previewStats.hidden = true;
        }
        if (_dom.previewEmotionTags) {
            _dom.previewEmotionTags.innerHTML = renderEmotionTags([]);
        }
    }

    function renderPreviewThumbnailFallback(title, subtitle) {
        return `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;background:linear-gradient(135deg,var(--surface-container-low),white);border-radius:1rem;color:var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);margin-bottom:12px;">movie</span>
                <div style="font-size:14px;font-weight:800;color:var(--on-surface);margin-bottom:8px;">${escapeHtml(title)}</div>
                <p style="margin:0;font-size:13px;line-height:1.6;">${escapeHtml(subtitle)}</p>
            </div>
        `;
    }

    function renderPreviewThumbnailMedia(thumbnailUrl, mediaTitle, treeTitle) {
        const fallbackHtml = renderPreviewThumbnailFallback(
            treeTitle,
            getSearchCopy('search.previewNoMomentBody', '시작 순간이 더해지면 이 감상 허브에서 가장 먼저 열어볼 수 있어요.', 'Once the starting moment is added, you will be able to open it here first.')
        );

        return `
            <div style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
                <img src="${thumbnailUrl}" alt="${mediaTitle}" loading="lazy" onerror="window.LoveBudSearchPreviewRenderer?.showPreviewImageFallback?.(this)" onload="window.LoveBudSearchPreviewRenderer?.handlePreviewImageLoad?.(this)" style="width:100%;height:100%;object-fit:cover;display:block;">
                <div data-preview-thumbnail-fallback hidden style="position:absolute;inset:0;">${fallbackHtml}</div>
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

    function showPreviewImageFallback(img) {
        if (!img) return;
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

    function updatePreview(tree) {
        if (!_dom) {
            console.warn('[LoveBudSearchPreviewRenderer] DOM not initialized');
            return;
        }

        const memories = Array.isArray(tree.memories) ? tree.memories : [];
        const firstMem = memories[0];
        const hasMemories = memories.length > 0;
        const previewStats = getPreviewStatsElement();
        const titleHelper = getSearchTitleHelper();
        const previewDisplayTitle = titleHelper?.getBrowseDisplayTitle
            ? titleHelper.getBrowseDisplayTitle(tree)
            : (String(tree?.title || '').trim() || getDefaultTreeName());
        const safeTreeTitle = escapeHtml(previewDisplayTitle);

        if (_dom.previewContainer) {
            if (!hasMemories) {
                _dom.previewContainer.innerHTML = `
                    <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;background:linear-gradient(135deg,var(--surface-container-low),white);border-radius:1rem;color:var(--on-surface-variant);">
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
                const iframeSrc = safeSourceUrl
                    ? safeSourceUrl + (safeSourceUrl.includes('?') ? '&' : '?') + 'autoplay=0&mute=1'
                    : '';
                const safeMediaMemTitle = escapeHtml(getMomentLabel(mediaMem || firstMem));

                _dom.previewContainer.innerHTML = iframeSrc ? `
                    <div style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
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
                ` : (safeThumbnail ? renderPreviewThumbnailMedia(safeThumbnail, safeMediaMemTitle, safeTreeTitle) : renderPlaceholder());
            }
        }

        if (_dom.previewTitle) {
            const safeTimeRange = escapeHtml(String(tree?.timeRange || getSearchCopy('search.previewUnknownRange', '아직 흐름이 또렷하지 않아요', 'The flow is not clear yet')).trim());
            const memoryCountSuffix = getSearchCopy('search.previewMomentCountSuffix', '개의 순간', 'moments');

            _dom.previewTitle.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                    <span style="font-size:2rem;background:var(--surface-container-low);width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:12px;">${getTreeIcon(tree.stage)}</span>
                    <div>
                        <div style="font-size:1.1rem;font-weight:800;color:var(--on-surface);line-height:1.3;">${safeTreeTitle}</div>
                        <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px;">${tree.memoryCount}${escapeHtml(memoryCountSuffix)} · ${safeTimeRange}</div>
                    </div>
                </div>
            `;
        }

        if (_dom.previewDesc) {
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

                _dom.previewDesc.innerHTML = `
                    <div style="background:var(--surface-container-low);padding:20px;border-radius:1rem;margin-bottom:16px;">
                        ${renderSectionHeading('route', getSearchCopy('search.previewTimelineHeading', '이 트리는 어디서 시작될까요?', 'Where will this tree begin?'))}
                        <div style="font-size:14px;line-height:1.7;color:var(--on-surface-variant);">
                            ${escapeHtml(getSearchCopy('search.previewTimelineEmpty', '아직 시작 순간이 남아 있지 않아 흐름이 비어 있어요.', 'The flow is still empty because the starting moment has not been saved yet.'))}<br>
                            ${escapeHtml(getSearchCopy('search.previewTimelineEmptyBody', '첫 순간이 더해지면 이 패널에서 대표 순간과 흐름을 바로 볼 수 있어요.', 'Once the first moment is added, you will be able to see the featured moment and flow in this panel.'))}
                        </div>
                    </div>

                    <div style="font-size:14px;color:var(--on-surface-variant);line-height:1.6;padding:0 4px;">
                        ${getPreviewSummaryCopy(tree, memories)}
                        <span style="color:var(--primary);font-weight:700;">${noRecordsLine}</span>
                        ${renderInfoCallout('info', getSearchCopy('search.previewNewTreeInfo', '이제 막 감상이 시작될 공개 러브트리예요.', 'This public LoveTree is just about to begin.'))}
                    </div>
                    ${renderPreviewActionButton(tree)}
                `;
            } else {
                const pathStages = memories.slice(0, 3).map((m, i) => {
                    return renderPathStageBadge(i + 1, getMomentLabel(m, '시작 순간', 'Starting moment'));
                }).join('<span style="opacity:0.3;margin:0 4px;">→</span>');

                const moreStages = renderMoreStagesText(memories.length - 3);
                const firstMomentLabel = getMomentLabel(firstMem, '시작 순간', 'Starting moment');
                const lastMomentLabel = getMomentLabel(memories[memories.length - 1], '최근에 남은 순간', 'Latest saved moment');

                _dom.previewDesc.innerHTML = `
                    <div style="background:var(--surface-container-low);padding:20px;border-radius:1rem;margin-bottom:16px;">
                        ${renderSectionHeading('route', getSearchCopy('search.previewTimelineHeading', '대표 순간에서 이어진 흐름', 'Flow connected from the featured moment'))}
                        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;line-height:1.8;">
                            ${pathStages}
                        </div>
                        <div style="margin-top:8px;font-size:12px;color:var(--on-surface-variant);font-style:italic;">${escapeHtml(moreStages)}</div>
                    </div>

                    <div style="font-size:14px;color:var(--on-surface-variant);line-height:1.6;padding:0 4px;">
                        ${getPreviewSummaryCopy(tree, memories)}
                        ${renderInfoCallout('favorite', `${firstMomentLabel}에서 시작해 ${lastMomentLabel}까지 이어진 감정의 흐름이에요.`)}
                        ${renderInfoCallout('touch_app', getSearchCopy('search.previewJourneyCta', '이곳에서 대표 순간과 이어진 감정을 훑어보고, 마음이 머무는 순간으로 들어가 보세요.', 'Scan the featured moment and connected feelings here, then open the moment that draws you in.'), 'primary')}
                    </div>
                    ${renderPreviewActionButton(tree)}
                `;
            }
        }

        if (previewStats) {
            previewStats.hidden = false;
        }
        if (_dom.previewMemoriesCount) {
            _dom.previewMemoriesCount.textContent = tree.memoryCount;
        }
        if (_dom.previewTreeDuration) {
            _dom.previewTreeDuration.textContent = getTimelineLabel(tree, memories);
        }
        if (_dom.previewEmotionTags) {
            _dom.previewEmotionTags.innerHTML = renderEmotionTags(tree.emotionTags);
        }
    }

    function renderPlaceholder() {
        const lead = getSearchCopy(
            'search.previewEmptyLead',
            '트리를 고르면',
            'When you choose a tree,'
        );
        const body = getSearchCopy(
            'search.previewEmptyBody',
            '대표 순간과 이어진 감정이 이곳에 열립니다.',
            'the featured moment and connected feelings open here.'
        );

        return `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--on-surface-variant);font-size:14px;text-align:center;padding:20px;">
                <p style="margin:0 0 8px;">${escapeHtml(lead)}</p>
                <p style="margin:0;line-height:1.5;">${escapeHtml(body)}</p>
            </div>
        `;
    }

    function resetPreview() {
        if (!_dom || !_dom.previewContainer) return;

        const previewStats = getPreviewStatsElement();
        const placeholderTitle = getSearchCopy(
            'search.previewPlaceholder',
            '트리를 골라 감상하기',
            'Select a tree to preview'
        );
        const placeholderDescription = getSearchCopy(
            'search.previewDescriptionPlaceholder',
            '트리를 고르면 대표 순간과 이어진 감정이 이곳에 열립니다.',
            'Choose a tree to open the featured moment and connected feelings here.'
        );
        
        if (_dom.previewContainer) {
            _dom.previewContainer.innerHTML = renderPlaceholder();
        }
        if (_dom.previewTitle) {
            _dom.previewTitle.textContent = placeholderTitle;
        }
        if (_dom.previewDesc) {
            _dom.previewDesc.innerHTML = `<p style="margin-bottom:16px;">${escapeHtml(placeholderDescription)}</p>`;
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

    console.log('[LoveBudSearchPreviewRenderer] Search preview renderer loaded v20260422-4');
})();
