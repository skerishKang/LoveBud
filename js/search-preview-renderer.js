/**
 * LoveBud Search Preview Renderer
 * v20260421-2
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

    // ─────────────────────────────────────────────────────────
    // DOM References (cached on init)
    // ─────────────────────────────────────────────────────────

    let _dom = null;

    function init(domRefs) {
        _dom = domRefs;
    }

    function getTreeIcon(stage) {
        const icons = { '입덕': '🌱', '성장': '🌿', '최애': '🌳' };
        return icons[stage] || '🌱';
    }

    function getSearchTitleHelper() {
        return window.LoveBudSearchTitleHelper || null;
    }

    function getMomentLabel(memory, fallbackKo = '첫 순간', fallbackEn = 'First moment') {
        const helper = getSearchTitleHelper();
        const cleaned = helper?.cleanMomentTitle
            ? helper.cleanMomentTitle(memory?.title || '')
            : String(memory?.title || '').trim().replace(/\s*-\s*.*/, '');
        return cleaned || getSearchCopy('search.previewMomentFallback', fallbackKo, fallbackEn);
    }

    function renderEmotionTags(tags) {
        const titleHelper = getSearchTitleHelper();
        const safeTags = (Array.isArray(tags) ? tags : [])
            .map(tag => titleHelper?.sanitizeBrowseLabel ? titleHelper.sanitizeBrowseLabel(tag) : String(tag || '').trim())
            .filter(Boolean)
            .filter(tag => tag !== '기록' && tag !== 'tag_record')
            .slice(0, 4);

        if (!safeTags.length) return '';
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
            return `${getSearchCopy('search.previewTimelineRecentUpdate', '최근 업데이트', 'Recently updated')} ${safeUpdated}`;
        }
        if (safeLast) {
            return `${getSearchCopy('search.previewTimelineLastMoment', '마지막 순간', 'Last moment')} ${safeLast}`;
        }
        if (safeFirst && safeLast && safeFirst !== safeLast) {
            return `${safeFirst} ~ ${safeLast}`;
        }
        if (safeCreated) {
            return `${safeCreated} ${getSearchCopy('search.previewTimelineCreated', '생성', 'Created')}`;
        }
        return getSearchCopy('search.previewTimelineUnavailable', '업데이트 정보 없음', 'No update info');
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
            : (() => {
                const themeRaw = String(tree?.theme || '').trim();
                if (!themeRaw || themeRaw === 'LoveTree' || themeRaw === 'Mixed') {
                    return '';
                }
                return themeRaw;
            })();
        const timeRange = String(tree?.timeRange || getSearchCopy('search.previewUnknownRange', '기록 없음', 'No timeline yet')).trim();
        const memoryCount = Number(tree?.memoryCount || 0);
        const safeTitle = escapeHtml(displayTitle);
        const safeTheme = escapeHtml(themeLabel);
        const safeRange = escapeHtml(timeRange);

        if (!memories.length) {
            if (themeLabel) {
                return formatSearchCopy(
                    'search.previewSummaryThemeStart',
                    { title: safeTitle, theme: safeTheme },
                    '<strong style="color:var(--on-surface);">{title}</strong>는 <strong style="color:var(--on-surface);">{theme}</strong> 테마로 시작된 공개 러브트리예요.',
                    '<strong style="color:var(--on-surface);">{title}</strong> is a public LoveTree that began with the <strong style="color:var(--on-surface);">{theme}</strong> theme.'
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
                '<strong style="color:var(--on-surface);">{theme}</strong>와 함께한 <span style="color:var(--primary);font-weight:700;">{count}개의 감정 순간</span>이 <strong>{range}</strong> 동안 기록되었어요.',
                '<strong style="color:var(--on-surface);">{count} emotional moments</strong> with <strong style="color:var(--on-surface);">{theme}</strong> were recorded across <strong>{range}</strong>.'
            );
        }

        return formatSearchCopy(
            'search.previewSummaryRange',
            { title: safeTitle, count: memoryCount, range: safeRange },
            '<strong style="color:var(--on-surface);">{title}</strong>에 담긴 <span style="color:var(--primary);font-weight:700;">{count}개의 감정 순간</span>이 <strong>{range}</strong> 동안 기록되었어요.',
            '<strong style="color:var(--on-surface);">{count} emotional moments</strong> in <strong style="color:var(--on-surface);">{title}</strong> were recorded across <strong>{range}</strong>.'
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
                            ${escapeHtml(getSearchCopy('search.previewNoMomentTitle', '아직 대표 순간이 없어요.', 'There is no featured moment yet.'))}<br>
                            ${escapeHtml(getSearchCopy('search.previewNoMomentBody', '첫 입덕 순간이 기록되면 여기에서 바로 미리 볼 수 있어요.', 'Once the first fandom moment is recorded, you will be able to preview it here.'))}
                        </p>
                    </div>
                `;
            } else {
                const safeSourceUrl = sanitizeUrl(firstMem.sourceUrl || '');
                const iframeSrc = safeSourceUrl
                    ? safeSourceUrl + (safeSourceUrl.includes('?') ? '&' : '?') + 'autoplay=0&mute=1'
                    : '';
                const safeFirstMemTitle = escapeHtml(getMomentLabel(firstMem));

                _dom.previewContainer.innerHTML = iframeSrc ? `
                    <div style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
                        <iframe width="100%" height="100%"
                            src="${iframeSrc}"
                            title="${safeTreeTitle}" frameborder="0"
                            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen style="position:absolute;top:0;left:0;"></iframe>
                        <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.8),transparent);padding:40px 20px 20px;color:white;text-align:center;">
                            <div style="font-size:14px;font-weight:700;margin-bottom:8px;opacity:0.9;">${escapeHtml(getSearchCopy('search.previewStartFromFirstMoment', '첫 순간부터 감상하기', 'Start from the first moment'))}</div>
                            <div style="font-size:12px;opacity:0.7;">${safeFirstMemTitle}</div>
                        </div>
                    </div>
                ` : renderPlaceholder();
            }
        }

        if (_dom.previewTitle) {
            const safeTimeRange = escapeHtml(String(tree?.timeRange || getSearchCopy('search.previewUnknownRange', '기록 없음', 'No timeline yet')).trim());
            const memoryCountSuffix = getSearchCopy('search.previewMomentCountSuffix', '개 순간', 'moments');

            _dom.previewTitle.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                    <span style="font-size:2rem;background:var(--surface-container-low);width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:12px;">${getTreeIcon(tree.stage)}</span>
                    <div>
                        <div style="font-size:1.1rem;font-weight:800;color:var(--on-surface);line-height:1.3;">${safeTreeTitle}</div>
                        <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px;">${tree.memoryCount} ${escapeHtml(memoryCountSuffix)} · ${safeTimeRange}</div>
                    </div>
                </div>
            `;
        }

        if (_dom.previewDesc) {
            if (!hasMemories) {
                const noRecordsLine = formatSearchCopy(
                    'search.previewNoRecordsLine',
                    {
                        countLabel: escapeHtml(getSearchCopy('search.previewNoRecordsYet', '아직 기록은 0개', 'There are still 0 records')),
                        followup: escapeHtml(getSearchCopy('search.previewNoRecordsFollowup', '다음 순간이 쌓이면 감정 경로가 여기서 채워집니다.', 'As new moments are added, the emotional path will fill in here.'))
                    },
                    '{countLabel}지만, {followup}',
                    '{countLabel}, and {followup}'
                );

                _dom.previewDesc.innerHTML = `
                    <div style="background:var(--surface-container-low);padding:20px;border-radius:1rem;margin-bottom:16px;">
                        ${renderSectionHeading('route', getSearchCopy('search.previewTimelineHeading', '어떻게 입덕했을까요?', 'How did this fandom begin?'))}
                        <div style="font-size:14px;line-height:1.7;color:var(--on-surface-variant);">
                            ${escapeHtml(getSearchCopy('search.previewTimelineEmpty', '아직 기록된 순간이 없어 감정 경로가 비어 있어요.', 'No moments have been recorded yet, so the emotional path is still empty.'))}<br>
                            ${escapeHtml(getSearchCopy('search.previewTimelineEmptyBody', '첫 순간이 추가되면 이 패널에서 흐름을 바로 미리 볼 수 있어요.', 'Once the first moment is added, you will be able to preview the flow in this panel.'))}
                        </div>
                    </div>

                    <div style="font-size:14px;color:var(--on-surface-variant);line-height:1.6;padding:0 4px;">
                        ${getPreviewSummaryCopy(tree, memories)}
                        <span style="color:var(--primary);font-weight:700;">${noRecordsLine}</span>
                        ${renderInfoCallout('info', getSearchCopy('search.previewNewTreeInfo', '새로 시작된 공개 트리입니다', 'This is a newly started public tree.'))}
                    </div>
                `;
            } else {
                const pathStages = memories.slice(0, 3).map((m, i) => {
                    return renderPathStageBadge(i + 1, getMomentLabel(m, '순간', 'Moment'));
                }).join('<span style="opacity:0.3;margin:0 4px;">→</span>');

                const moreStages = renderMoreStagesText(memories.length - 3);
                const firstMomentLabel = getMomentLabel(firstMem, '첫 순간', 'First moment');
                const lastMomentLabel = getMomentLabel(memories[memories.length - 1], '최근 순간', 'Latest moment');
                const themeLabel = titleHelper?.getThemeLabel ? titleHelper.getThemeLabel(tree) : '';
                const primaryTag = titleHelper?.getPrimaryBrowseTag ? titleHelper.getPrimaryBrowseTag(tree) : '';
                const moodText = themeLabel || primaryTag || getSearchCopy('search.previewMoodFallback', '팬의 마음', 'a fan heart');

                _dom.previewDesc.innerHTML = `
                    <div style="background:var(--surface-container-low);padding:20px;border-radius:1rem;margin-bottom:16px;">
                        ${renderSectionHeading('route', getSearchCopy('search.previewTimelineHeading', '어떻게 입덕했을까요?', 'How did this fandom begin?'))}
                        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;line-height:1.8;">
                            ${pathStages}
                        </div>
                        <div style="margin-top:8px;font-size:12px;color:var(--on-surface-variant);font-style:italic;">${escapeHtml(moreStages)}</div>
                    </div>

                    <div style="font-size:14px;color:var(--on-surface-variant);line-height:1.6;padding:0 4px;">
                        ${getPreviewSummaryCopy(tree, memories)}
                        ${renderInfoCallout('favorite', `${firstMomentLabel}에서 시작해 ${lastMomentLabel}까지 이어진 ${moodText}의 흐름이에요`)}
                        ${renderInfoCallout('touch_app', getSearchCopy('search.previewJourneyCta', '카드를 클릭하여 감정 경로를 따라가보세요', 'Click a card to follow the emotional path.'), 'primary')}
                    </div>
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
            '왼쪽 목록에서 공개 러브트리를 선택하면',
            'Choose a public LoveTree from the list to the left'
        );
        const body = getSearchCopy(
            'search.previewEmptyBody',
            '해당 트리의 감정 흐름과 대표 순간을 여기서 미리 볼 수 있어요.',
            'and preview its emotional flow and featured moment here.'
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
            '트리를 선택하여 감상하기',
            'Select a tree to preview'
        );
        const placeholderDescription = getSearchCopy(
            'search.previewDescriptionPlaceholder',
            '카드를 선택하면 감정의 흐름과 대표 순간을 미리 볼 수 있어요.',
            'Select a card to preview the emotional flow and featured moment.'
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
            _dom.previewEmotionTags.innerHTML = '';
        }
    }

    window.LoveBudSearchPreviewRenderer = {
        init: init,
        updatePreview: updatePreview,
        resetPreview: resetPreview,
        renderPlaceholder: renderPlaceholder,
        getTreeIcon: getTreeIcon,
        renderEmotionTags: renderEmotionTags
    };

    console.log('[LoveBudSearchPreviewRenderer] Search preview renderer loaded v20260421-2');
})();
