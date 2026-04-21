document.addEventListener('DOMContentLoaded', async () => {
    const videoMain = document.getElementById('videoMain');
    const memoryTitle = document.getElementById('memoryTitle');
    const diaryQuote = document.getElementById('diaryQuote');
    const diaryContent = document.getElementById('diaryContent');
    const detailArtist = document.getElementById('detailArtist');
    const detailDate = document.getElementById('detailDate');
    const detailSubtitle = document.getElementById('detailSubtitle');
    const tagsContainer = document.getElementById('tagsContainer');
    const connectedFragments = document.getElementById('connectedFragments');
    const treeContextEl = document.getElementById('treeContext');
    const backButton = document.getElementById('backButton');
    const detailHeroTitle = document.getElementById('detailHeroTitle');
    const detailHeroDesc = document.getElementById('detailHeroDesc');
    const detailHeroKicker = document.getElementById('detailHeroKicker');
    const detailViewChipLabel = document.getElementById('detailViewChipLabel');
    const detailSideSummary = document.getElementById('detailSideSummary');
    const connectedKicker = document.getElementById('connectedKicker');
    const connectedTitle = document.getElementById('connectedTitle');
    const connectedSummary = document.getElementById('connectedSummary');
    const growthLabel = document.getElementById('growthLabel');
    const isPagesContext = window.location.pathname.indexOf('/pages/') !== -1;

    const buildPageHref = (page, params = {}) => {
        const base = isPagesContext ? `${page}.html` : `pages/${page}.html`;
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') searchParams.set(key, value);
        });
        const query = searchParams.toString();
        return query ? `${base}?${query}` : base;
    };

    const homeHref = isPagesContext ? '../index.html' : 'index.html';
    const searchHref = buildPageHref('search');
    const myTreesHref = buildPageHref('my-trees');
    const i18n = window.t || ((k) => k);
    const tText = (key, fallback) => {
        const translated = i18n(key);
        if (typeof translated !== 'string') return fallback;
        const normalized = translated.trim();
        if (!normalized || normalized === key) return fallback;
        return translated;
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const prettifyTagLabel = (tag) => {
        const raw = String(tag ?? '').trim();
        if (!raw) return '';
        const withoutPrefix = raw.replace(/^tag[_-]?/i, '');
        const spaced = withoutPrefix.replace(/[_-]+/g, ' ').trim();
        return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : raw;
    };

    const shouldHideEmotionTag = (tag) => {
        const raw = String(tag ?? '').trim();
        if (!raw) return true;
        const normalized = raw.toLowerCase().replace(/\s+/g, '');
        return normalized === 'tag_record'
            || normalized === 'tag-record'
            || normalized === '#기록';
    };

    const getLocalizedTagLabel = (tag) => {
        const raw = String(tag ?? '').trim();
        if (!raw || shouldHideEmotionTag(raw)) return '';
        return tText(raw, prettifyTagLabel(raw));
    };

    const normalizeVideoSourceUrl = (url) => {
        if (typeof url !== 'string') return '';
        const trimmed = url.trim();
        if (!trimmed) return '';

        try {
            const parsed = new URL(trimmed, window.location.origin);
            const host = parsed.hostname.toLowerCase();
            const isYouTubeHost = host.includes('youtube.com') || host.includes('youtu.be');

            if (isYouTubeHost) {
                const videoId = parsed.searchParams.get('v')
                    || (parsed.pathname.startsWith('/embed/') ? parsed.pathname.split('/embed/')[1].split('/')[0] : '')
                    || (host.includes('youtu.be') ? parsed.pathname.replace(/^\//, '').split('/')[0] : '');

                if (videoId) {
                    return {
                        embedUrl: `https://www.youtube.com/embed/${videoId}`,
                        watchUrl: `https://www.youtube.com/watch?v=${videoId}`
                    };
                }
            }

            return { embedUrl: trimmed, watchUrl: trimmed };
        } catch (error) {
            return { embedUrl: trimmed, watchUrl: trimmed };
        }
    };

    const buildSoftPanelMarkup = ({ icon, kicker, title, description }) => `
        <div style="display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:24px;border-radius:1.5rem;background:linear-gradient(180deg, rgba(250,246,243,0.96), rgba(255,255,255,0.98));border:1px solid rgba(144, 73, 81, 0.08);box-shadow:0 14px 34px rgba(75,64,57,0.05);">
            <span class="material-symbols-outlined" style="font-size:22px;color:var(--primary);">${icon}</span>
            <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--primary);">${escapeHtml(kicker)}</div>
            <div style="font-size:1rem;font-weight:800;line-height:1.5;color:var(--on-surface);">${escapeHtml(title)}</div>
            <p style="margin:0;font-size:0.95rem;line-height:1.7;color:var(--on-surface-variant);">${escapeHtml(description)}</p>
        </div>
    `;

    const buildVideoUnavailableMarkup = (memory) => {
        const normalizedVideo = normalizeVideoSourceUrl(memory?.sourceUrl || memory?.videoUrl || memory?.originalUrl || '');
        const watchUrl = normalizedVideo.watchUrl;
        const title = escapeHtml(memory?.title || tText('tree_context_moment', '순간 상세'));
        const hasWatchUrl = !!watchUrl;

        return `
            <div style="width:100%;height:100%;background:linear-gradient(180deg, rgba(35,28,29,0.82), rgba(62,45,48,0.92));display:flex;align-items:center;justify-content:center;padding:32px;">
                <div style="max-width:420px;text-align:center;color:rgba(255,255,255,0.92);">
                    <span class="material-symbols-outlined" style="font-size:34px;display:block;margin-bottom:14px;opacity:0.88;">play_circle</span>
                    <div style="font-size:1.05rem;font-weight:800;line-height:1.5;margin-bottom:10px;">${tText('video_unavailable_soft_title', '이 순간의 영상은 여기서 바로 열리지 않을 수 있어요.')}</div>
                    <p style="margin:0 0 18px;font-size:0.95rem;line-height:1.7;color:rgba(255,255,255,0.76);">${tText('video_unavailable_soft_desc', '재생이 열리지 않더라도 이 순간의 감상은 이어서 읽어볼 수 있어요.')}</p>
                    ${hasWatchUrl ? `<a href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${title}" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.18);color:#fff;text-decoration:none;font-size:13px;font-weight:700;backdrop-filter:blur(10px);">
                        <span class="material-symbols-outlined" style="font-size:18px;">open_in_new</span>
                        <span>${tText('video_embed_fallback_cta', '원본에서 감상 이어가기')}</span>
                    </a>` : ''}
                </div>
            </div>
        `;
    };

    const buildEmptyMemoMarkup = () => buildSoftPanelMarkup({
        icon: 'auto_stories',
        kicker: tText('empty_memo_kicker', '남겨진 마음'),
        title: tText('empty_memo_title', '아직 길게 남겨진 메모는 없지만, 이 순간의 여운은 그대로 머물러 있어요.'),
        description: tText('empty_memo_desc', '짧은 장면 하나만으로도 시작되는 감정이 있어요. 이 러브트리는 그 조용한 시작까지 함께 감상하는 공간이에요.')
    });

    const buildConnectedEmptyMarkup = ({ treeMomentCount = 0 } = {}) => buildSoftPanelMarkup({
        icon: 'device_hub',
        kicker: tText('connected_empty_kicker', '이어질 다음 장면'),
        title: treeMomentCount > 1
            ? tText('connected_missing_cards_title', '이 트리의 다른 순간은 아직 여기서 또렷하게 펼쳐지지 않았어요.')
            : tText('connected_empty_title', '지금은 이 순간이 가장 또렷하게 남아 있어요.'),
        description: treeMomentCount > 1
            ? `${treeMomentCount}${tText('connected_missing_cards_desc_suffix', '개의 순간이 이 트리에 남아 있지만, 지금은 현재 장면을 중심으로 감정의 흐름을 읽고 있어요.')}`
            : tText('connected_empty_desc', '아직 같은 흐름의 다른 순간은 보이지 않지만, 이 장면 하나만으로도 트리의 분위기를 천천히 느껴볼 수 있어요.')
    });

    const buildTemporarilyUnavailableMarkup = () => buildSoftPanelMarkup({
        icon: 'schedule',
        kicker: tText('connected_empty_kicker', '이어질 다음 장면'),
        title: tText('connected_temporarily_unavailable_title', '이어진 다른 순간은 잠시 후 다시 또렷해질 거예요.'),
        description: tText('connected_temporarily_unavailable_desc', '지금은 현재 장면을 중심으로 감상하고 있어요. 연결된 흐름은 잠시 후 다시 이어서 볼 수 있을 거예요.')
    });

    const getHeroFallbackTitle = (memory) => {
        const artist = String(memory?.artist || '').trim();
        if (artist) {
            return `${artist}${tText('public_tree_fallback_title_with_artist_suffix', '에게 마음이 닿기 시작한 순간을 감상하고 있어요')}`;
        }
        return tText('public_tree_fallback_title', '누군가의 러브트리를 감상하고 있어요');
    };

    const getHeroFallbackDesc = ({ memoryCount, memoryTitleText }) => {
        if (memoryTitleText) {
            return `“${memoryTitleText}”${tText('public_tree_desc_fallback_with_memory_suffix', '에서 시작된 마음을 따라가고 있어요. 연결된 순간이 많지 않아도, 이 장면만으로 남겨진 분위기를 천천히 감상해 보세요.')}`;
        }
        const baseCount = memoryCount > 0 ? memoryCount : 1;
        return `${baseCount}${tText('public_tree_desc_suffix', '개의 순간으로 이어진 감정의 흐름을 따라가고 있어요. 지금 보고 있는 순간을 시작으로 이 트리를 천천히 감상해 보세요.')}`;
    };

    const parseMomentOrderValue = (memory) => {
        const source = memory?.createdAt || memory?.timestamp || '';
        const parsed = new Date(source).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const isStructuralRootMemory = (memory) => {
        if (!memory) return true;
        const id = String(memory.id || '').trim().toLowerCase();
        return id === 'root'
            || memory.sourceType === 'system'
            || (!memory.parentId && !memory.sourceUrl && !memory.thumbnail);
    };

    const mergeTreeMemories = (memories, currentMemory) => {
        const list = Array.isArray(memories) ? memories.filter(Boolean) : [];
        if (!currentMemory?.id) return list;
        if (list.some(item => item && item.id === currentMemory.id)) return list;
        return [...list, currentMemory];
    };

    const sortTreeMemories = (memories, currentMemory) => mergeTreeMemories(memories, currentMemory)
        .sort((a, b) => parseMomentOrderValue(a) - parseMomentOrderValue(b));

    const resolveTreeMomentCount = ({ tree, memories, currentMemory }) => {
        const sortedMemories = sortTreeMemories(memories, currentMemory);
        const listCount = sortedMemories.length;
        const treeCount = Number(tree?.memoryCount) || 0;
        return Math.max(listCount, treeCount, currentMemory?.treeId ? 1 : 0);
    };

    const getConnectedFlowMoments = ({ memory, memories }) => {
        const sortedMemories = sortTreeMemories(memories, memory);
        return sortedMemories.filter(item => item.id !== memory.id && !isStructuralRootMemory(item));
    };

    const getConnectedRelationLabel = (targetMemory, currentMemory) => {
        if (!targetMemory || !currentMemory) return tText('connected_relation_same_tree', '같은 트리의 다른 순간');
        if (targetMemory.id === currentMemory.parentId) return tText('connected_relation_previous', '이전에 남겨진 순간');
        if (targetMemory.parentId === currentMemory.id) return tText('connected_relation_next', '이후에 이어진 순간');
        return tText('connected_relation_same_tree', '같은 트리의 다른 순간');
    };

    const applyViewingPageCopy = ({ sourceContext, treeTitle, memoryTitleText, treeMomentCount, connectedCount, memory }) => {
        if (detailViewChipLabel) detailViewChipLabel.textContent = tText('public_tree_view_chip', '공개 러브트리 감상');
        if (detailHeroKicker) detailHeroKicker.textContent = tText('public_tree_kicker', '공개 러브트리');
        if (detailHeroTitle) {
            detailHeroTitle.textContent = treeTitle || getHeroFallbackTitle(memory);
        }
        if (detailHeroDesc) {
            const baseCount = treeMomentCount > 0 ? treeMomentCount : 1;
            detailHeroDesc.textContent = treeTitle
                ? `${treeTitle}${tText('public_tree_desc_join', ' 안에서')} ${baseCount}${tText('public_tree_desc_suffix', '개의 순간으로 이어진 감정의 흐름을 따라가고 있어요. 지금 보고 있는 순간을 시작으로 이 트리를 천천히 감상해 보세요.')}`
                : getHeroFallbackDesc({ memoryCount: baseCount, memoryTitleText });
        }
        if (detailSideSummary) {
            detailSideSummary.textContent = memoryTitleText
                ? `“${memoryTitleText}” ${tText('current_moment_side_summary', '순간에 남겨진 마음을 천천히 읽어보세요.')}`
                : tText('current_moment_side_summary_fallback', '지금 이 순간에 남겨진 마음을 천천히 읽어보세요.');
        }
        if (connectedKicker) connectedKicker.textContent = tText('connected_flow_kicker', '이어진 흐름');
        if (connectedTitle) connectedTitle.textContent = tText('connected_flow_title', '이 트리의 이어진 기억');
        if (connectedSummary) {
            if (treeMomentCount > 1 && connectedCount > 0) {
                connectedSummary.textContent = `${treeMomentCount}${tText('connected_flow_count_suffix', '개의 순간 가운데 지금 장면과 함께 읽히는 기억들을 이어서 감상해 보세요.')}`;
            } else if (treeMomentCount > 1) {
                connectedSummary.textContent = `${treeMomentCount}${tText('connected_flow_count_pending_suffix', '개의 순간이 이 트리에 남아 있어요. 지금은 현재 장면을 중심으로 감정의 흐름을 읽고 있어요.')}`;
            } else {
                connectedSummary.textContent = tText('connected_flow_summary', '이 공개 러브트리 안에서 함께 이어지는 순간들을 천천히 따라가 보세요.');
            }
        }

        if (growthLabel) {
            const growthMap = {
                browse: tText('public_tree_growth_label', '공개 트리 감상 중'),
                'my-trees': tText('my_tree_growth_label', '내 트리를 다시 감상 중'),
                editor: tText('editor_tree_growth_label', '편집 트리를 감상 모드로 확인 중')
            };
            growthLabel.textContent = growthMap[sourceContext] || growthMap.browse;
        }
    };

    const configureBackButton = (sourceContext, treeId) => {
        if (!backButton) return;
        const backConfig = {
            browse: { label: tText('back_to_browse_soft', '둘러보기로 돌아가기'), url: searchHref },
            'my-trees': { label: tText('back_to_my_trees_soft', '내 트리로 돌아가기'), url: myTreesHref },
            editor: { label: tText('back_to_editor_soft', '편집 화면으로 돌아가기'), url: buildPageHref('editor', treeId ? { treeId } : {}) }
        };
        const config = backConfig[sourceContext] || backConfig.browse;
        const isAnchorButton = backButton.tagName === 'A';

        backButton.innerHTML = `<span class="material-symbols-outlined">arrow_back</span><span>${config.label}</span>`;
        backButton.setAttribute('aria-label', config.label);
        backButton.dataset.backUrl = config.url;

        if (isAnchorButton) {
            backButton.setAttribute('href', config.url);
            return;
        }

        backButton.type = 'button';
        if (!backButton.__detailBackHandler) {
            backButton.__detailBackHandler = (event) => {
                event.preventDefault();
                const url = backButton.dataset.backUrl || searchHref;
                window.location.assign(url);
            };
            backButton.addEventListener('click', backButton.__detailBackHandler);
        }
    };

    const setMetaPillVisibility = (valueEl, value) => {
        if (!valueEl) return;
        const pill = valueEl.closest('.detail-meta-pill');
        const hasValue = typeof value === 'string' ? value.trim().length > 0 : !!value;
        if (pill) pill.style.display = hasValue ? '' : 'none';
        valueEl.style.display = hasValue ? '' : 'none';
        if (hasValue) valueEl.textContent = value;
    };

    const inferTreeContext = ({ treeId, currentMemory, mergedMemories }) => {
        if (!treeId) return null;
        const explicitTitle = String(currentMemory?.treeTitle || '').trim();
        const artistTitle = String(currentMemory?.artist || '').trim();
        const memoryCount = Math.max(mergedMemories.length, currentMemory?.treeId ? 1 : 0);
        return {
            id: treeId,
            title: explicitTitle || artistTitle || '',
            memoryCount
        };
    };

    const renderMemoryBase = (memory) => {
        if (videoMain) {
            const normalizedVideo = normalizeVideoSourceUrl(memory.sourceUrl || memory.videoUrl || memory.originalUrl || '');
            const embedUrl = normalizedVideo.embedUrl;
            const watchUrl = normalizedVideo.watchUrl;
            const iframeSrc = embedUrl ? `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=0` : '';

            if (iframeSrc) {
                videoMain.innerHTML = `
                    <div style="position:relative;width:100%;height:100%;">
                        <iframe width="100%" height="100%"
                            src="${iframeSrc}"
                            title="${escapeHtml(memory.title || '')}" frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            referrerpolicy="strict-origin-when-cross-origin"
                            allowfullscreen></iframe>
                        ${watchUrl ? `
                            <a href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer"
                               style="position:absolute;top:16px;right:16px;display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;background:rgba(23,17,18,0.56);border:1px solid rgba(255,255,255,0.14);color:#fff;text-decoration:none;font-size:12px;font-weight:700;backdrop-filter:blur(10px);">
                                <span class="material-symbols-outlined" style="font-size:16px;">open_in_new</span>
                                <span>${tText('video_embed_fallback_cta', '원본에서 감상 이어가기')}</span>
                            </a>
                        ` : ''}
                    </div>
                `;
            } else {
                videoMain.innerHTML = buildVideoUnavailableMarkup(memory);
            }
        }

        if (memoryTitle) memoryTitle.textContent = memory.title || tText('tree_context_moment', '순간 상세');
        setMetaPillVisibility(detailArtist, memory.artist || '');
        const dateText = (memory.timestamp || '') + (memory.source ? ' · ' + memory.source : '');
        setMetaPillVisibility(detailDate, dateText);
        if (detailSubtitle) detailSubtitle.textContent = tText('current_moment_kicker', '지금 감상 중인 순간');

        if (tagsContainer) {
            const renderedTags = Array.isArray(memory.emotionTags)
                ? memory.emotionTags
                    .map(tag => getLocalizedTagLabel(tag))
                    .filter(Boolean)
                    .map(tag => `<span class="tag-chip active">${escapeHtml(tag)}</span>`)
                    .join('')
                : '';
            tagsContainer.innerHTML = renderedTags;
        }

        const quoteText = String(memory.quote || '').trim();
        const memoText = String(memory.memo || '').trim();
        if (diaryQuote) {
            diaryQuote.textContent = quoteText ? `\"${quoteText}\"` : tText('empty_memo_quote', '짧게 남은 장면 하나도 오래 머무는 마음이 될 수 있어요.');
        }
        if (diaryContent) {
            if (memoText) {
                diaryContent.textContent = memoText;
            } else {
                diaryContent.innerHTML = buildEmptyMemoMarkup();
            }
        }
    };

    const renderTreeContext = ({ hasTreeContext, tree, memories, sourceContext, degradedReason, currentMemory }) => {
        if (!treeContextEl) return;

        if (degradedReason === 'missing-tree-id') {
            treeContextEl.innerHTML = `
                <div style="display:flex; align-items:flex-start; gap:16px;">
                    <div style="width:48px; height:48px; background:var(--surface-container); border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <span class="material-symbols-outlined" style="color: var(--primary); font-size:24px;">favorite</span>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:12px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">${tText('tree_context_viewing', '감상 중')}</div>
                        <p style="margin:0; font-size:14px; color:var(--on-surface-variant); line-height:1.7;">${tText('tree_context_solo_view_warm', '아직 연결된 트리 정보는 보이지 않지만, 이 순간만으로도 남겨진 마음을 천천히 따라가 볼 수 있어요.')}</p>
                    </div>
                </div>
            `;
            return;
        }

        const treeMomentCount = resolveTreeMomentCount({ tree, memories, currentMemory });
        if (!hasTreeContext || treeMomentCount <= 0) {
            treeContextEl.innerHTML = '';
            return;
        }

        const treeTitle = tree?.title || tText('public_tree_fallback_title', '누군가의 러브트리를 감상하고 있어요');
        const contextMessages = {
            browse: degradedReason === 'tree-and-memories-load-failed'
                ? tText('tree_and_memories_load_failed_desc_warm', '지금은 현재 순간 하나가 가장 또렷하게 남아 있어요. 연결된 트리 흐름은 잠시 후 다시 이어서 볼 수 있을 거예요.')
                : degradedReason === 'tree-load-partial'
                    ? tText('tree_partial_context_desc', '트리의 전체 윤곽은 잠시 흐릿하지만, 지금 이 순간을 중심으로 감정의 분위기는 계속 따라가 볼 수 있어요.')
                    : degradedReason === 'memories-load-failed'
                        ? tText('memories_load_failed_desc_warm', '현재 순간은 또렷하게 남아 있어요. 이어진 다른 순간은 잠시 후 다시 불러올 수 있을 거예요.')
                        : tText('public_tree_context_desc', '지금은 다른 사람이 공개한 러브트리 안에서 한 순간을 감상하고 있어요.'),
            editor: tText('tree_context_editor_desc', '편집 중인 트리를 감상 모드로 보고 있어요'),
            'my-trees': tText('tree_context_my_trees_desc', '내가 기록한 순간들을 다시 감상하고 있어요')
        };

        treeContextEl.innerHTML = `
            <div style="display:flex; align-items:flex-start; gap:16px;">
                <div style="width:48px; height:48px; background:var(--surface-container); border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <span class="material-symbols-outlined" style="color: var(--primary); font-size:24px;">account_tree</span>
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:6px;">
                        <span style="font-size:12px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:1px;">${tText('current_tree', '현재 트리')}</span>
                        <span style="color: var(--outline-variant);">·</span>
                        <span style="font-size:12px; color:var(--on-surface-variant);">${treeMomentCount}${tText('tree_context_moment_count_short', '개 순간')}</span>
                    </div>
                    <div style="font-size:1.15rem; font-weight:800; color:var(--on-surface); line-height:1.4; margin-bottom:4px;">${escapeHtml(treeTitle)}</div>
                    <p style="margin:0; font-size:14px; color:var(--on-surface-variant); line-height:1.7;">${contextMessages[sourceContext] || contextMessages.browse}</p>
                </div>
            </div>
        `;
    };

    const buildDetailHref = (memoryId, treeId, sourceContext) => buildPageHref('detail', { id: memoryId, tree: treeId, from: sourceContext });

    const renderConnectedFragments = ({ memory, memories, treeId, sourceContext, degradedReason, treeMomentCount }) => {
      if (!connectedFragments) return;
      const flowMoments = getConnectedFlowMoments({ memory, memories });
      const connectedSection = connectedFragments.closest('.connected-section');
      connectedSection.classList.remove('is-empty', 'is-solo', 'is-threaded');

      if (degradedReason === 'missing-tree-id') {
            connectedFragments.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr;gap:24px;">
                    ${buildSoftPanelMarkup({
                        icon: 'forest',
                        kicker: tText('connected_empty_kicker', '이어질 다음 장면'),
                        title: tText('connected_path_missing_title', '아직 이 순간과 이어진 트리 흐름은 보이지 않아요.'),
                        description: tText('connected_path_missing_desc', '그래도 지금 보고 있는 장면 하나만으로도 이 러브트리의 분위기를 천천히 느껴볼 수 있어요.')
                    })}
                </div>
            `;
            return;
      }

      if (degradedReason === 'memories-load-failed' || degradedReason === 'tree-and-memories-load-failed') {
            connectedFragments.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr;gap:24px;">
                    ${buildTemporarilyUnavailableMarkup()}
                </div>
            `;
            connectedSection.classList.add('is-empty');
            return;
      }

      if (flowMoments.length > 0) {
            connectedFragments.innerHTML = flowMoments.map(moment => {
                const href = buildDetailHref(moment.id, treeId, sourceContext);
                const relationLabel = getConnectedRelationLabel(moment, memory);
                const thumbnailMarkup = moment.thumbnail
                    ? `<img src="${escapeHtml(moment.thumbnail)}" alt="${escapeHtml(moment.title || '')}" style="width: 80px; height: 80px; border-radius: 1rem; object-fit: cover;">`
                    : `<div style="width:80px;height:80px;border-radius:1rem;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg, rgba(250,246,243,0.98), rgba(255,255,255,0.98));border:1px solid rgba(144,73,81,0.08);color:var(--primary);flex-shrink:0;">
                            <span class="material-symbols-outlined" style="font-size:28px;">favorite</span>
                       </div>`;

                return `
                    <div class="moment-card" data-detail-href="${href}" tabindex="0" role="link">
                        ${thumbnailMarkup}
                        <div style="min-width:0;">
                            <div style="font-size: 11px; font-weight: 800; color: var(--primary); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.06em;">${escapeHtml(relationLabel)}</div>
                            <div style="font-size: 11px; font-weight: 800; color: #aaa; text-transform: uppercase; margin-bottom: 4px;">${escapeHtml(moment.timestamp || '')}</div>
                            <div style="font-weight: 800; color: var(--on-surface); font-size: 15px; line-height:1.5; margin-bottom: 6px;">${escapeHtml(moment.title || tText('tree_context_moment', '순간 상세'))}</div>
                            <div style="font-size: 12px; color: var(--on-surface-variant); line-height:1.6;">${escapeHtml(moment.artist || '')}</div>
                        </div>
                    </div>
                `;
            }).join('');

            connectedFragments.querySelectorAll('.moment-card[data-detail-href]').forEach(card => {
                const navigate = () => {
                    const href = card.getAttribute('data-detail-href');
                    if (href) window.location.href = href;
                };
                card.addEventListener('click', navigate);
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate();
                    }
                });
            });
            connectedSection.classList.add(flowMoments.length >= 2 ? 'is-threaded' : 'is-solo');
      } else {
        connectedFragments.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr;gap:24px;">
                ${buildConnectedEmptyMarkup({ treeMomentCount })}
            </div>
        `;
        connectedSection.classList.add('is-empty');
      }
    };

    const renderMissingMemoryState = () => {
        const detailTopbar = document.querySelector('.detail-topbar');
        const detailHero = document.getElementById('detailHero');
        const mainLayout = document.querySelector('.detail-layout');
        const contentSlot = document.querySelector('.detail-main') || document.querySelector('.detail-content') || mainLayout;

        if (detailTopbar) detailTopbar.style.display = 'none';
        if (detailHero) detailHero.style.display = 'none';
        if (mainLayout) mainLayout.style.display = 'block';

        const fallbackHTML = `
            <div style="max-width: 600px; margin: 80px auto; text-align: center; padding: 48px;">
                <span class="material-symbols-outlined" style="font-size: 64px; color: var(--on-surface-variant); opacity: 0.5; margin-bottom: 24px; display: block;">sentiment_dissatisfied</span>
                <h2 class="headline" style="font-size: 1.8rem; margin-bottom: 16px; color: var(--on-surface);">${tText('memory_not_found_title', '기억을 찾지 못했어요')}</h2>
                <p style="color: var(--on-surface-variant); margin-bottom: 32px; line-height: 1.6;">
                    ${tText('memory_not_found_desc', '요청하신 기억이 존재하지 않거나 접근할 수 없는 상태입니다.').replace('.', '<br>')}
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <a href="${homeHref}" class="btn-round btn-outline" style="text-decoration: none;">${tText('back_to_home', '홈으로')}</a>
                    <a href="${searchHref}" class="btn-round btn-outline" style="text-decoration: none;">${tText('browse_lovetrees', '러브트리 둘러보기')}</a>
                </div>
            </div>
        `;

        if (contentSlot) contentSlot.innerHTML = fallbackHTML;
    };

    const urlParams = new URLSearchParams(window.location.search);
    const memoryId = urlParams.get('id');
    if (!memoryId) {
        window.location.href = searchHref;
        return;
    }

    const fromParam = urlParams.get('from');
    const sourceContext = ['browse', 'my-trees', 'editor'].includes(fromParam) ? fromParam : 'browse';
    const requestedTreeId = urlParams.get('tree');
    configureBackButton(sourceContext, requestedTreeId);

    const cache = window.LoveBudCache;
    const MEMORY_CACHE_KEY = 'memory_' + memoryId;
    const TREE_CACHE_KEY = (tid) => 'tree_' + tid;
    const MEMORIES_CACHE_KEY = (tid) => 'memories_' + tid;

    let memory = null;
    const cachedMemory = cache ? cache.get(MEMORY_CACHE_KEY) : null;
    if (cachedMemory) memory = cachedMemory;

    const normalize = window.LoveBudNormalize?.normalizeMemory || ((m) => m);

    try {
        if (window.apiClient && window.apiClient.getMemory) {
            const apiMemory = await window.apiClient.getMemory(memoryId);
            if (apiMemory) {
                const normalizedMemory = normalize(apiMemory);
                if (cache) cache.set(MEMORY_CACHE_KEY, normalizedMemory, 3 * 60 * 1000);
                if (JSON.stringify(memory) !== JSON.stringify(normalizedMemory)) memory = normalizedMemory;
            }
        }
    } catch (e) {
        if (!memory && typeof getMemory === 'function') memory = normalize(getMemory(memoryId));
    }

    if (!memory) {
        renderMissingMemoryState();
        return;
    }

    const canonicalTreeId = memory.treeId || requestedTreeId || null;
    const hasTreeContext = !!canonicalTreeId;
    let degradedReason = null;
    if (!canonicalTreeId) degradedReason = 'missing-tree-id';

    let tree = hasTreeContext && cache ? cache.get(TREE_CACHE_KEY(canonicalTreeId)) : null;
    let memories = hasTreeContext && cache ? cache.get(MEMORIES_CACHE_KEY(canonicalTreeId)) : null;
    let treeFetchState = tree ? 'cache' : 'idle';
    let memoriesFetchState = Array.isArray(memories) ? 'cache' : 'idle';
    const loadPromises = [];

    if (hasTreeContext) {
        if (!tree && window.apiClient && window.apiClient.getTree) {
            treeFetchState = 'loading';
            loadPromises.push(window.apiClient.getTree(canonicalTreeId)
                .then(apiTree => {
                    if (apiTree) {
                        tree = apiTree;
                        treeFetchState = 'loaded';
                        if (cache) cache.set(TREE_CACHE_KEY(canonicalTreeId), apiTree, 5 * 60 * 1000);
                    } else {
                        treeFetchState = 'empty';
                    }
                })
                .catch(() => {
                    treeFetchState = 'failed';
                }));
        }

        if (!Array.isArray(memories) && window.apiClient && window.apiClient.getMemoriesByTree) {
            memoriesFetchState = 'loading';
            loadPromises.push(window.apiClient.getMemoriesByTree(canonicalTreeId)
                .then(apiMemories => {
                    if (Array.isArray(apiMemories)) {
                        memories = apiMemories;
                        memoriesFetchState = 'loaded';
                        if (cache) cache.set(MEMORIES_CACHE_KEY(canonicalTreeId), apiMemories, 3 * 60 * 1000);
                    } else {
                        memories = [];
                        memoriesFetchState = 'empty';
                    }
                })
                .catch(() => {
                    memories = [];
                    memoriesFetchState = 'failed';
                }));
        }

        if (loadPromises.length > 0) await Promise.all(loadPromises);

        if (!Array.isArray(memories)) memories = [];
    } else {
        tree = null;
        memories = [];
    }

    const mergedMemories = sortTreeMemories(memories, memory);
    const displayTree = tree || inferTreeContext({ treeId: canonicalTreeId, currentMemory: memory, mergedMemories });
    const treeMomentCount = resolveTreeMomentCount({ tree: displayTree, memories: mergedMemories, currentMemory: memory });
    const connectedFlowMoments = getConnectedFlowMoments({ memory, memories: mergedMemories });

    if (hasTreeContext) {
        if (treeFetchState === 'failed' && memoriesFetchState === 'failed') {
            degradedReason = 'tree-and-memories-load-failed';
        } else if (memoriesFetchState === 'failed') {
            degradedReason = 'memories-load-failed';
        } else if (treeFetchState === 'failed') {
            degradedReason = 'tree-load-partial';
        }
    }

    renderMemoryBase(memory);
    renderTreeContext({ hasTreeContext, tree: displayTree, memories: mergedMemories, sourceContext, degradedReason, currentMemory: memory });
    renderConnectedFragments({ memory, memories: mergedMemories, treeId: canonicalTreeId, sourceContext, degradedReason, treeMomentCount });

    const safeTitle = memory.title || tText('tree_context_moment', '순간 상세');
    const treeTitle = displayTree?.title || tText('lovetree_brand', '러브트리');
    const brandTitle = tText('lovetree_brand', '러브트리');
    document.title = (hasTreeContext && treeMomentCount > 0)
        ? `${safeTitle} | ${treeTitle} — ${brandTitle}`
        : `${safeTitle} — ${brandTitle}`;

    applyViewingPageCopy({
        sourceContext,
        treeTitle: displayTree?.title,
        memoryTitleText: memory.title,
        treeMomentCount,
        connectedCount: connectedFlowMoments.length,
        memory
    });

    configureBackButton(sourceContext, canonicalTreeId);
});
