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
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const prettifyTagLabel = (tag) => {
        const raw = String(tag ?? '').trim();
        if (!raw) return '';
        const withoutPrefix = raw.replace(/^tag[_-]?/i, '');
        const spaced = withoutPrefix.replace(/[_-]+/g, ' ').trim();
        return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : raw;
    };

    const getLocalizedTagLabel = (tag) => {
        const raw = String(tag ?? '').trim();
        if (!raw) return '';
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
                    ${hasWatchUrl ? `<a href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(title)}" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.18);color:#fff;text-decoration:none;font-size:13px;font-weight:700;backdrop-filter:blur(10px);">
                        <span class="material-symbols-outlined" style="font-size:18px;">open_in_new</span>
                        <span>${tText('video_embed_fallback_cta', '원본에서 감상 이어가기')}</span>
                    </a>` : ''}
                </div>
            </div>
        `;
    };

    const applyViewingPageCopy = ({ sourceContext, treeTitle, memoryTitleText, memoryCount }) => {
        if (detailViewChipLabel) detailViewChipLabel.textContent = tText('public_tree_view_chip', '공개 러브트리 감상');
        if (detailHeroKicker) detailHeroKicker.textContent = tText('public_tree_kicker', '공개 러브트리');
        if (detailHeroTitle) {
            detailHeroTitle.textContent = treeTitle || tText('public_tree_fallback_title', '누군가의 러브트리를 감상하고 있어요');
        }
        if (detailHeroDesc) {
            const baseCount = memoryCount > 0 ? memoryCount : 1;
            detailHeroDesc.textContent = treeTitle
                ? `${treeTitle}${tText('public_tree_desc_join', ' 안에서')} ${baseCount}${tText('public_tree_desc_suffix', '개의 순간으로 이어진 감정의 흐름을 따라가고 있어요. 지금 보고 있는 순간을 시작으로 이 트리를 천천히 감상해 보세요.')}`
                : `${baseCount}${tText('public_tree_desc_suffix', '개의 순간으로 이어진 감정의 흐름을 따라가고 있어요. 지금 보고 있는 순간을 시작으로 이 트리를 천천히 감상해 보세요.')}`;
        }
        if (detailSideSummary) {
            detailSideSummary.textContent = memoryTitleText
                ? `“${memoryTitleText}” ${tText('current_moment_side_summary', '순간에 남겨진 마음을 천천히 읽어보세요.')}`
                : tText('current_moment_side_summary_fallback', '지금 이 순간에 남겨진 마음을 천천히 읽어보세요.');
        }
        if (connectedKicker) connectedKicker.textContent = tText('connected_flow_kicker', '이어진 흐름');
        if (connectedTitle) connectedTitle.textContent = tText('connected_flow_title', '이 트리의 이어진 기억');
        if (connectedSummary) connectedSummary.textContent = tText('connected_flow_summary', '이 공개 러브트리 안에서 함께 이어지는 순간들을 천천히 따라가 보세요.');

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
        if (detailArtist) detailArtist.textContent = memory.artist || tText('unknown_artist', '아티스트 정보 없음');
        if (detailDate) detailDate.textContent = (memory.timestamp || '') + (memory.source ? ' · ' + memory.source : '');
        if (detailSubtitle) detailSubtitle.textContent = tText('current_moment_kicker', '지금 감상 중인 순간');

        if (tagsContainer && memory.emotionTags && memory.emotionTags.length > 0) {
            tagsContainer.innerHTML = memory.emotionTags
                .map(tag => getLocalizedTagLabel(tag))
                .filter(Boolean)
                .map(tag => `<span class="tag-chip active">${escapeHtml(tag)}</span>`)
                .join('');
        }

        if (diaryQuote) diaryQuote.textContent = `"${memory.quote || memory.memo || ''}"`;
        if (diaryContent && memory.memo) diaryContent.textContent = memory.memo;
    };

    const renderTreeContext = ({ hasTreeContext, tree, memories, sourceContext, degradedReason }) => {
        if (!treeContextEl) return;

        if (degradedReason === 'missing-tree-id') {
            treeContextEl.innerHTML = `
                <div style="display:flex; align-items:flex-start; gap:16px;">
                    <div style="width:48px; height:48px; background:var(--surface-container); border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <span class="material-symbols-outlined" style="color: var(--primary); font-size:24px;">favorite</span>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:12px; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">${tText('tree_context_viewing', '감상 중')}</div>
                        <p style="margin:0; font-size:14px; color:var(--on-surface-variant); line-height:1.6;">${tText('tree_context_solo_view', '이 순간만 단독으로 감상하고 있어요.')}</p>
                    </div>
                </div>
            `;
            return;
        }

        if (degradedReason === 'tree-load-failed') {
            treeContextEl.innerHTML = `
                <div style="display:flex; align-items:flex-start; gap:16px;">
                    <div style="width:48px; height:48px; background:var(--surface-container); border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <span class="material-symbols-outlined" style="color: var(--on-surface-variant); font-size:24px;">forest</span>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:12px; font-weight:800; color:var(--on-surface-variant); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">${tText('tree_info_missing', '트리 정보 없음')}</div>
                        <p style="margin:0; font-size:14px; color:var(--on-surface-variant); line-height:1.6;">${tText('tree_load_failed_desc', '트리 정보를 불러오지 못했어요. 순간 감상은 계속할 수 있어요.')}</p>
                    </div>
                </div>
            `;
            return;
        }

        if (hasTreeContext && tree) {
            const memoryCount = Array.isArray(memories) ? memories.length : 0;
            const treeTitle = tree.title || tText('lovetree_brand', '러브트리');
            const contextMessages = {
                browse: tText('public_tree_context_desc', '지금은 다른 사람이 공개한 러브트리 안에서 한 순간을 감상하고 있어요.'),
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
                            <span style="font-size:12px; color:var(--on-surface-variant);">${memoryCount}${tText('tree_context_moment_count_short', '개 순간')}</span>
                        </div>
                        <div style="font-size:1.15rem; font-weight:800; color:var(--on-surface); line-height:1.4; margin-bottom:4px;">${treeTitle}</div>
                        <p style="margin:0; font-size:14px; color:var(--on-surface-variant); line-height:1.6;">${contextMessages[sourceContext] || contextMessages.browse}</p>
                    </div>
                </div>
            `;
        }
    };

    const buildDetailHref = (memoryId, treeId, sourceContext) => buildPageHref('detail', { id: memoryId, tree: treeId, from: sourceContext });

    const renderConnectedFragments = ({ memory, memories, treeId, sourceContext, degradedReason }) => {
        if (!connectedFragments) return;

        if (degradedReason === 'missing-tree-id' || degradedReason === 'tree-load-failed') {
            connectedFragments.innerHTML = `
                <div style="text-align:center; padding:24px; color:var(--on-surface-variant); font-size:13px;">
                    <span class="material-symbols-outlined" style="font-size:24px; opacity:0.5; margin-bottom:8px; display:block;">forest</span>
                    ${tText('tree_path_missing', '트리 경로 정보가 없어요')}<br>
                    <a href="${searchHref}" style="color: var(--primary); text-decoration: none; font-weight: 600;">${tText('find_tree_in_browse', '둘러보기에서 트리 찾기')}</a>
                </div>
            `;
            return;
        }

        if (!memories || memories.length === 0) {
            connectedFragments.innerHTML = '';
            return;
        }

        const siblings = memories.filter(m => m.id !== memory.id && m.parentId === memory.parentId);

        if (siblings.length > 0) {
            connectedFragments.innerHTML = siblings.map(sib => `
                <div class="moment-card" data-detail-href="${buildDetailHref(sib.id, treeId, sourceContext)}" tabindex="0" role="link">
                    <img src="${sib.thumbnail}" alt="${sib.title}" style="width: 80px; height: 80px; border-radius: 1rem; object-fit: cover;">
                    <div>
                        <div style="font-size: 11px; font-weight: 800; color: #aaa; text-transform: uppercase; margin-bottom: 4px;">${sib.timestamp}</div>
                        <div style="font-weight: 800; color: var(--on-surface); font-size: 15px; margin-bottom: 6px;">${sib.title}</div>
                        <div style="font-size: 12px; color: var(--on-surface-variant);">${sib.artist || ''}</div>
                    </div>
                </div>
            `).join('');

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
        } else {
            connectedFragments.innerHTML = `
                <div style="text-align:center; padding:24px; color:var(--on-surface-variant); font-size:13px;">
                    <span class="material-symbols-outlined" style="font-size:24px; opacity:0.5; margin-bottom:8px; display:block;">device_hub</span>
                    ${tText('no_siblings_in_path', '같은 경로의 다른 순간이 없어요')}
                </div>
            `;
        }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const memoryId = urlParams.get('id');
    if (!memoryId) {
        window.location.href = searchHref;
        return;
    }

    const fromParam = urlParams.get('from');
    const sourceContext = ['browse', 'my-trees', 'editor'].includes(fromParam) ? fromParam : 'browse';
    const initialTreeId = urlParams.get('tree');
    configureBackButton(sourceContext, initialTreeId);

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
        const mainLayout = document.querySelector('.detail-layout');
        const contentSlot = document.querySelector('.detail-main') || document.querySelector('.detail-content') || mainLayout;
        if (contentSlot) contentSlot.innerHTML = fallbackHTML;
        if (mainLayout) mainLayout.style.display = 'block';
        return;
    }

    const treeId = urlParams.get('tree') || memory.treeId || null;
    const hasTreeContext = !!treeId;
    let degradedReason = null;
    if (!treeId) degradedReason = 'missing-tree-id';

    let tree = hasTreeContext && cache ? cache.get(TREE_CACHE_KEY(treeId)) : null;
    let memories = hasTreeContext && cache ? cache.get(MEMORIES_CACHE_KEY(treeId)) : null;
    const loadPromises = [];

    if (hasTreeContext) {
        if (!tree && window.apiClient && window.apiClient.getTree) {
            loadPromises.push(window.apiClient.getTree(treeId)
                .then(apiTree => {
                    if (apiTree) {
                        tree = apiTree;
                        if (cache) cache.set(TREE_CACHE_KEY(treeId), apiTree, 5 * 60 * 1000);
                    }
                })
                .catch(() => {}));
        }

        if (!memories && window.apiClient && window.apiClient.getMemoriesByTree) {
            loadPromises.push(window.apiClient.getMemoriesByTree(treeId)
                .then(apiMemories => {
                    if (Array.isArray(apiMemories)) {
                        memories = apiMemories;
                        if (cache) cache.set(MEMORIES_CACHE_KEY(treeId), apiMemories, 3 * 60 * 1000);
                    }
                })
                .catch(() => {}));
        }

        if (loadPromises.length > 0) await Promise.all(loadPromises);

        if (!tree) {
            const mockTrees = typeof getTrees === 'function' ? getTrees() : [];
            tree = mockTrees.find(t => t.id === treeId) || null;
            if (!tree) degradedReason = 'tree-load-failed';
        }
        if (!memories) memories = typeof getMemoriesByTree === 'function' ? getMemoriesByTree(treeId) : [];
    } else {
        tree = null;
        memories = [];
    }

    renderMemoryBase(memory);
    renderTreeContext({ hasTreeContext, tree, memories, sourceContext, degradedReason });
    renderConnectedFragments({ memory, memories, treeId, sourceContext, degradedReason });

    const safeTitle = memory.title || tText('tree_context_moment', '순간 상세');
    const treeTitle = tree?.title || tText('lovetree_brand', '러브트리');
    const brandTitle = tText('lovetree_brand', '러브트리');
    document.title = (hasTreeContext && tree && !degradedReason)
        ? `${safeTitle} | ${treeTitle} — ${brandTitle}`
        : `${safeTitle} — ${brandTitle}`;

    applyViewingPageCopy({
        sourceContext,
        treeTitle: tree?.title,
        memoryTitleText: memory.title,
        memoryCount: Array.isArray(memories) ? memories.length : 0
    });

    configureBackButton(sourceContext, treeId);
});
