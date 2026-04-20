document.addEventListener('DOMContentLoaded', async () => {
    // ── DOM 요소 참조 (null-safe 처리를 위해 상단에서 한 번만) ──
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
    const isPagesContext = window.location.pathname.indexOf('/pages/') !== -1;

    // 공통 경로 헬퍼 - pages 컨텍스트 일관성 유지
    const buildPageHref = (page, params = {}) => {
        const base = isPagesContext ? `${page}.html` : `pages/${page}.html`;
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                searchParams.set(key, value);
            }
        });

        const query = searchParams.toString();
        return query ? `${base}?${query}` : base;
    };

    const homeHref = isPagesContext ? '../index.html' : 'index.html';
    const searchHref = buildPageHref('search');
    const myTreesHref = buildPageHref('my-trees');
    const i18n = window.t || ((k) => k);

    // Back button 설정 - 핸들러는 한 번만 등록, 이후 URL만 변경
    const configureBackButton = (sourceContext, treeId) => {
        if (!backButton) return;

        const backConfig = {
            'browse': { label: i18n('browse_label'), url: searchHref },
            'my-trees': { label: i18n('my_trees_short'), url: myTreesHref },
            'editor': {
                label: i18n('edit_action'),
                url: buildPageHref('editor', treeId ? { treeId } : {})
            }
        };

        const config = backConfig[sourceContext] || backConfig.browse;

        backButton.type = 'button';
        backButton.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;margin-right:4px;">arrow_back</span> ${config.label}`;
        backButton.setAttribute('aria-label', config.label);

        // 핸들러는 최초 한 번만 등록 - 재등록/제거 반복 리스크 제거
        if (!backButton.__detailBackHandler) {
            backButton.__detailBackHandler = (event) => {
                event.preventDefault();
                const url = backButton.dataset.backUrl || searchHref;
                window.location.assign(url);
            };
            backButton.addEventListener('click', backButton.__detailBackHandler);
        }

        // URL은 dataset에 저장하여 핸들러가 참조
        backButton.dataset.backUrl = config.url;
    };

    // ── 렌더링 헬퍼 함수들 ──
    // memory 본문 렌더링 (tree context와 무관)
    const renderMemoryBase = (memory) => {
        const i18n = window.t || ((k) => k);

        // 비디오 로드
        if (videoMain) {
            if (memory.sourceUrl) {
                videoMain.innerHTML = `
                    <iframe width="100%" height="100%"
                        src="${memory.sourceUrl}?autoplay=0"
                        title="${memory.title || ''}" frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen></iframe>
                `;
            } else {
                videoMain.innerHTML = `
                    <div style="width:100%;height:100%;background:var(--surface-container);display:flex;align-items:center;justify-content:center;color:var(--on-surface-variant);">
                        ${i18n('no_video')}
                    </div>
                `;
            }
        }

        // 메타데이터 채우기
        if (memoryTitle) memoryTitle.textContent = memory.title || i18n('tree_context_moment');
        if (detailArtist) detailArtist.textContent = memory.artist || i18n('unknown_artist');
        if (detailDate) detailDate.textContent = (memory.timestamp || '') + (memory.source ? ' · ' + memory.source : '');
        if (detailSubtitle) detailSubtitle.textContent = i18n('memory_record_prefix') + (memory.timestamp || '');

        // 감정 태그
        if (tagsContainer && memory.emotionTags && memory.emotionTags.length > 0) {
            tagsContainer.innerHTML = memory.emotionTags.map(tag =>
                `<span class="tag-chip active">${tag}</span>`
            ).join('');
        }

        // 일기 내용
        if (diaryQuote) diaryQuote.textContent = `"${memory.quote || memory.memo || ''}"`;
        if (diaryContent && memory.memo) {
            diaryContent.textContent = memory.memo;
        }
    };

    // tree context 렌더링
    const renderTreeContext = ({ hasTreeContext, tree, memories, sourceContext, degradedReason }) => {
        if (!treeContextEl) return;

        const i18n = window.t || ((k) => k);

        if (degradedReason === 'missing-tree-id') {
            // treeId 자체가 없음
            treeContextEl.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <div style="width: 48px; height: 48px; background: var(--surface-container); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <span class="material-symbols-outlined" style="color: var(--primary); font-size: 24px;">favorite</span>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 12px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 1px;">${i18n('tree_context_viewing')}</span>
                        </div>
                        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--on-surface); margin: 0; line-height: 1.3;">${i18n('tree_context_moment')}</h2>
                        <p style="font-size: 13px; color: var(--on-surface-variant); margin-top: 6px; line-height: 1.5;">
                            ${i18n('tree_context_solo_view')}
                        </p>
                    </div>
                </div>
            `;
        } else if (degradedReason === 'tree-load-failed') {
            // treeId는 있었으나 로드 실패
            treeContextEl.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <div style="width: 48px; height: 48px; background: var(--surface-container); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <span class="material-symbols-outlined" style="color: var(--on-surface-variant); font-size: 24px;">forest</span>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 12px; font-weight: 800; color: var(--on-surface-variant); text-transform: uppercase; letter-spacing: 1px;">${i18n('tree_info_missing')}</span>
                        </div>
                        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--on-surface); margin: 0; line-height: 1.3;">${i18n('tree_context_moment')}</h2>
                        <p style="font-size: 13px; color: var(--on-surface-variant); margin-top: 6px; line-height: 1.5;">
                            ${i18n('tree_load_failed_desc')}
                        </p>
                    </div>
                </div>
            `;
        } else if (hasTreeContext && tree) {
            // 정상 트리 컨텍스트
            const memoryCount = Array.isArray(memories) ? memories.length : 0;
            const treeTitle = tree.title || i18n('lovetree_brand');
            const contextMessages = {
                'browse': {
                    icon: 'explore',
                    label: i18n('browse_label'),
                    desc: `${memoryCount}${i18n('tree_context_moment_count_desc') || '개의 순간이 이어진 감정 경로를 따라가고 있어요'}`
                },
                'editor': {
                    icon: 'edit',
                    label: i18n('editor_label'),
                    desc: i18n('tree_context_editor_desc') || '편집 중인 트리를 감상 모드로 보고 있어요'
                },
                'my-trees': {
                    icon: 'account_tree',
                    label: i18n('my_trees_label'),
                    desc: i18n('tree_context_my_trees_desc') || '내가 기록한 순간들을 다시 감상하고 있어요'
                }
            };
            const contextInfo = contextMessages[sourceContext] || contextMessages['browse'];

            treeContextEl.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <div style="width: 48px; height: 48px; background: var(--surface-container); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <span class="material-symbols-outlined" style="color: var(--primary); font-size: 24px;">${contextInfo.icon}</span>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 12px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 1px;">${contextInfo.label}</span>
                            <span style="color: var(--outline-variant);">·</span>
                            <span style="font-size: 12px; color: var(--on-surface-variant);">${memoryCount}개 순간</span>
                        </div>
                        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--on-surface); margin: 0; line-height: 1.3;">${treeTitle}</h2>
                        <p style="font-size: 13px; color: var(--on-surface-variant); margin-top: 6px; line-height: 1.5;">
                            ${contextInfo.desc}
                        </p>
                    </div>
                </div>
            `;
        }
    };

    // Detail 페이지 링크 생성 헬퍼
    const buildDetailHref = (memoryId, treeId, sourceContext) =>
        buildPageHref('detail', {
            id: memoryId,
            tree: treeId,
            from: sourceContext
        });

    // connectedFragments 렌더링
    const renderConnectedFragments = ({ memory, memories, treeId, sourceContext, degradedReason }) => {
        if (!connectedFragments) return;

        // tree context가 없으면 안내 메시지
        if (degradedReason === 'missing-tree-id' || degradedReason === 'tree-load-failed') {
            connectedFragments.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--on-surface-variant); font-size: 13px;">
                    <span class="material-symbols-outlined" style="font-size: 24px; opacity: 0.5; margin-bottom: 8px; display: block;">forest</span>
                    ${i18n('tree_path_missing')}<br>
                    <a href="${searchHref}" style="color: var(--primary); text-decoration: none; font-weight: 600;">${i18n('find_tree_in_browse')}</a>
                </div>
            `;
            return;
        }

        // tree는 있지만 memories가 없으면
        if (!memories || memories.length === 0) {
            connectedFragments.innerHTML = '';
            return;
        }

        const siblings = memories.filter(m =>
            m.id !== memory.id && m.parentId === memory.parentId
        );

        if (siblings.length > 0) {
            connectedFragments.innerHTML = siblings.map(sib => `
                <div class="moment-card" data-detail-href="${buildDetailHref(sib.id, treeId, sourceContext)}" tabindex="0" role="link">
                    <img src="${sib.thumbnail}" alt="${sib.title}" style="width: 80px; height: 80px; border-radius: 1rem; object-fit: cover;">
                    <div>
                        <div style="font-size: 11px; font-weight: 800; color: #aaa; text-transform: uppercase;">
                            ${sib.timestamp}
                        </div>
                        <div style="font-weight: 800; color: var(--on-surface); font-size: 15px; margin-bottom: 4px;">
                            ${sib.title}
                        </div>
                        <div style="font-size: 12px; color: var(--on-surface-variant);">
                            ${sib.artist || ''}
                        </div>
                    </div>
                </div>
            `).join('');

            // data-detail-href 기반 이벤트 등록 (Enter/Space 지원)
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
                <div style="text-align: center; padding: 24px; color: var(--on-surface-variant); font-size: 13px;">
                    <span class="material-symbols-outlined" style="font-size: 24px; opacity: 0.5; margin-bottom: 8px; display: block;">device_hub</span>
                    ${i18n('no_siblings_in_path')}
                </div>
            `;
        }
    };

    // URL에서 memory ID 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const memoryId = urlParams.get('id');

    // ID 없이 진입 시 search.html로 리다이렉트
    if (!memoryId) {
        window.location.href = searchHref;
        return;
    }

    // URL 파라미터에서 감상 맥락 확인
    // from: 'browse' (둘러보기) | 'my-trees' (내 트리) | 'editor' (편집기)
    const fromParam = urlParams.get('from');
    const sourceContext = ['browse', 'my-trees', 'editor'].includes(fromParam) ? fromParam : 'browse';
    const initialTreeId = urlParams.get('tree');
    configureBackButton(sourceContext, initialTreeId);

    // ── 캐시 키 설정 ──
    const cache = window.LoveBudCache;
    const MEMORY_CACHE_KEY = 'memory_' + memoryId;
    const TREE_CACHE_KEY = (tid) => 'tree_' + tid;
    const MEMORIES_CACHE_KEY = (tid) => 'memories_' + tid;

    // ── 메모리 데이터: 캐시 우선, API로 background refresh ──
    let memory = null;

    // 1. 캐시된 memory 먼저 확인
    const cachedMemory = cache ? cache.get(MEMORY_CACHE_KEY) : null;
    if (cachedMemory) {
        console.log('[detail] 캐시된 memory 사용:', memoryId);
        memory = cachedMemory;
    }

    // 2. API로 최신 memory 가져오기
    // 백엔드는 flat camelCase 응답을 반환하므로 별도의 {id, data} 처리 불필요
    // 공통 normalize 유틸 사용 (window.LoveBudNormalize.normalizeMemory)
    const normalize = window.LoveBudNormalize?.normalizeMemory || ((m) => m);

    try {
        if (window.apiClient && window.apiClient.getMemory) {
            const apiMemory = await window.apiClient.getMemory(memoryId);
            if (apiMemory) {
                const normalizedMemory = normalize(apiMemory);

                if (cache) {
                    cache.set(MEMORY_CACHE_KEY, normalizedMemory, 3 * 60 * 1000);
                }

                if (JSON.stringify(memory) !== JSON.stringify(normalizedMemory)) {
                    memory = normalizedMemory;
                }

                console.log('[detail] API memory loaded:', memoryId);
            }
        }
    } catch (e) {
        console.warn('[detail] API getMemory failed:', e.message);
        // 캐시가 없으면 mock fallback (normalize 적용)
        if (!memory && typeof getMemory === 'function') {
            memory = normalize(getMemory(memoryId));
        }
    }
    if (!memory) {
        // ── memory 조회 실패 시 fallback UI 표시 ──
        console.warn('[detail] Memory not found, showing fallback UI');
        const i18n = window.t || ((k) => k);
        const fallbackHTML = `
            <div style="max-width: 600px; margin: 80px auto; text-align: center; padding: 48px;">
                <span class="material-symbols-outlined" style="font-size: 64px; color: var(--on-surface-variant); opacity: 0.5; margin-bottom: 24px; display: block;">sentiment_dissatisfied</span>
                <h2 class="headline" style="font-size: 1.8rem; margin-bottom: 16px; color: var(--on-surface);">${i18n('memory_not_found_title')}</h2>
                <p style="color: var(--on-surface-variant); margin-bottom: 32px; line-height: 1.6;">
                    ${i18n('memory_not_found_desc').replace('.', '<br>')}
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <a href="${homeHref}" class="btn-round btn-outline" style="text-decoration: none;">${i18n('back_to_home')}</a>
                    <a href="${searchHref}" class="btn-round btn-outline" style="text-decoration: none;">${i18n('browse_lovetrees')}</a>
                </div>
            </div>
        `;
        // 콘텐츠 영역만 fallback으로 교체 (레이아웃/네비게이션 유지)
        const mainLayout = document.querySelector('.detail-layout');
        const contentSlot =
            document.querySelector('.detail-main') ||
            document.querySelector('.detail-content') ||
            mainLayout;

        if (contentSlot) {
            contentSlot.innerHTML = fallbackHTML;
        }

        if (mainLayout) {
            mainLayout.style.display = 'block';
        }
        return;
    }

    // ── 트리 + siblings 병렬 로딩 (캐시 우선) ──
    // treeId가 없어도 memory 단독 렌더링은 가능해야 함 (graceful degradation)
    const treeId = urlParams.get('tree') || memory.treeId || null;
    const hasTreeContext = !!treeId;
    let degradedReason = null;

    if (!treeId) {
        degradedReason = 'missing-tree-id';
        console.warn('[detail] Tree ID missing. Rendering memory-only detail view.');
    }

    // 캐시에서 먼저 확인 (treeId 없으면 스킵)
    let tree = hasTreeContext && cache ? cache.get(TREE_CACHE_KEY(treeId)) : null;
    let memories = hasTreeContext && cache ? cache.get(MEMORIES_CACHE_KEY(treeId)) : null;

    // 병렬로 API 호출 (tree와 memories 동시에) - treeId 있을 때만
    const loadPromises = [];

    if (hasTreeContext) {
        // Tree 로드
        if (!tree && window.apiClient && window.apiClient.getTree) {
            loadPromises.push(
                window.apiClient.getTree(treeId)
                    .then(apiTree => {
                        if (apiTree) {
                            tree = apiTree;
                            if (cache) cache.set(TREE_CACHE_KEY(treeId), apiTree, 5 * 60 * 1000);
                        }
                    })
                    .catch(e => console.warn('[detail] API getTree failed:', e.message))
            );
        }

        // Memories 로드 (siblings용)
        if (!memories && window.apiClient && window.apiClient.getMemoriesByTree) {
            loadPromises.push(
                window.apiClient.getMemoriesByTree(treeId)
                    .then(apiMemories => {
                        if (Array.isArray(apiMemories)) {
                            memories = apiMemories;
                            if (cache) cache.set(MEMORIES_CACHE_KEY(treeId), apiMemories, 3 * 60 * 1000);
                        }
                    })
                    .catch(e => console.warn('[detail] API getMemoriesByTree failed:', e.message))
            );
        }

        // 모든 API 호출 완료 대기
        if (loadPromises.length > 0) {
            await Promise.all(loadPromises);
        }

        // 캐시/API 모두 실패 시 mock fallback (단, 임의 첫 트리 선택은 금지)
        if (!tree) {
            const mockTrees = typeof getTrees === 'function' ? getTrees() : [];
            // 안전하게: treeId와 일치하는 트리만 사용, 없으면 null
            tree = mockTrees.find(t => t.id === treeId) || null;
            if (tree) {
                console.log('[detail] Mock tree matched:', tree.id);
            } else {
                console.warn('[detail] Tree context unavailable. Rendering degraded detail view.');
                degradedReason = 'tree-load-failed';
            }
        }
        if (!memories) {
            memories = typeof getMemoriesByTree === 'function' ? getMemoriesByTree(treeId) : [];
            if (memories.length > 0) {
                console.log('[detail] Mock memories loaded:', memories.length);
            }
        }
    } else {
        // treeId 없음: tree/memories는 null/빈 배열로 유지
        tree = null;
        memories = [];
    }

    // ── 렌더링 단계 ──
    // 1. memory 본문 (tree context와 무관)
    renderMemoryBase(memory);

    // 2. tree context (상태에 따라 분기)
    renderTreeContext({ hasTreeContext, tree, memories, sourceContext, degradedReason });

    // 3. connectedFragments
    renderConnectedFragments({ memory, memories, treeId, sourceContext, degradedReason });

    // 4. 페이지 타이틀 업데이트
    const safeTitle = memory.title || i18n('tree_context_moment');
    const treeTitle = tree?.title || i18n('lovetree_brand');
    const brandTitle = i18n('lovetree_brand');
    const pageTitle = (hasTreeContext && tree && !degradedReason)
        ? `${safeTitle} | ${treeTitle} — ${brandTitle}`
        : `${safeTitle} — ${brandTitle}`;
    document.title = pageTitle;

    // 5. 돌아가기 버튼 URL 재확정
    configureBackButton(sourceContext, treeId);

    console.log('[detail] Detail view loaded:', memory.title || 'Untitled');
});
