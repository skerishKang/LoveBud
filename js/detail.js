/**
 * detail.js - Memory Detail Renderer
 * 
 * Responsibilities:
 * 1. Renderer functions (renderMemoryBase, renderTreeContext, renderConnectedFragments)
 * 2. Data preparation (loadMemoryDetailContext)
 * 3. Page orchestration
 * 
 * Data flow:
 * URL params → loadMemoryDetailContext() → renderers → DOM
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: DOM 요소 참조 (null-safe)
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: 렌더링 헬퍼 함수들 (변경 없음)
    // ═══════════════════════════════════════════════════════════════════════
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
        if (memoryTitle) memoryTitle.textContent = memory.title || '기억의 순간';
        if (detailArtist) detailArtist.textContent = memory.artist || i18n('unknown_artist');
        if (detailDate) detailDate.textContent = (memory.timestamp || '') + (memory.source ? ' · ' + memory.source : '');
        if (detailSubtitle) detailSubtitle.textContent = '기록 — ' + (memory.timestamp || '');

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
                            <span style="font-size: 12px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 1px;">감상 중</span>
                        </div>
                        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--on-surface); margin: 0; line-height: 1.3;">기억의 순간</h2>
                        <p style="font-size: 13px; color: var(--on-surface-variant); margin-top: 6px; line-height: 1.5;">
                            이 순간을 단독으로 감상하고 있어요. 트리 전체 경로를 보시려면 둘러보기에서 선택해주세요.
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
                            <span style="font-size: 12px; font-weight: 800; color: var(--on-surface-variant); text-transform: uppercase; letter-spacing: 1px;">트리 정보 없음</span>
                        </div>
                        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--on-surface); margin: 0; line-height: 1.3;">기억의 순간</h2>
                        <p style="font-size: 13px; color: var(--on-surface-variant); margin-top: 6px; line-height: 1.5;">
                            트리 정보를 불러오지 못했어요. 순간 감상은 계속할 수 있어요.
                        </p>
                    </div>
                </div>
            `;
        } else if (hasTreeContext && tree) {
            // 정상 트리 컨텍스트
            const memoryCount = Array.isArray(memories) ? memories.length : 0;
            const treeTitle = tree.title || '러브트리';
            
            // 📌 visibility 표시
            const visibility = tree.visibility || 'private';
            const isPublic = visibility === 'public';
            const i18n = window.t || ((k) => k);
            const visIcon = isPublic ? 'public' : 'lock';
            const visLabel = isPublic ? i18n('visibility_public') : i18n('visibility_private');
            const visStyle = isPublic 
                ? 'background:rgba(76,175,80,0.1);color:#4caf50;'
                : 'background:rgba(158,158,158,0.1);color:#757575;';
            
            const contextMessages = {
                'browse': {
                    icon: 'explore',
                    label: '둘러보기',
                    desc: `${memoryCount}개의 순간이 이어진 감정 경로를 따라가고 있어요`
                },
                'editor': {
                    icon: 'edit',
                    label: '편집 중',
                    desc: '편집 중인 트리를 감상 모드로 보고 있어요'
                },
                'my-trees': {
                    icon: 'account_tree',
                    label: '내 러브트리',
                    desc: '내가 기록한 순간들을 다시 감상하고 있어요'
                }
            };
            const contextInfo = contextMessages[sourceContext] || contextMessages['browse'];

            treeContextEl.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <div style="width: 48px; height: 48px; background: var(--surface-container); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <span class="material-symbols-outlined" style="color: var(--primary); font-size: 24px;">${contextInfo.icon}</span>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;flex-wrap:wrap;">
                            <span style="font-size: 12px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 1px;">${contextInfo.label}</span>
                            <span style="color: var(--outline-variant);">·</span>
                            <span style="font-size: 12px; color: var(--on-surface-variant);">${memoryCount}개 순간</span>
                            <!-- visibility 배지 -->
                            <span style="${visStyle}font-size:11px;padding:2px 8px;border-radius:99px;display:inline-flex;align-items:center;gap:4px;margin-left:4px;">
                                <span class="material-symbols-outlined" style="font-size:12px;">${visIcon}</span>
                                ${visLabel}
                            </span>
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

    // connectedFragments 렌더링
    const renderConnectedFragments = ({ memory, memories, treeId, sourceContext, degradedReason }) => {
        if (!connectedFragments) return;

        // tree context가 없으면 안내 메시지
        if (degradedReason === 'missing-tree-id' || degradedReason === 'tree-load-failed') {
            connectedFragments.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--on-surface-variant); font-size: 13px;">
                    <span class="material-symbols-outlined" style="font-size: 24px; opacity: 0.5; margin-bottom: 8px; display: block;">forest</span>
                    트리 경로 정보가 없어요<br>
                    <a href="search.html" style="color: var(--primary); text-decoration: none; font-weight: 600;">둘러보기에서 트리 찾기</a>
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
                <div class="moment-card" onclick="location.href='detail.html?id=${sib.id}&tree=${treeId}&from=${sourceContext}'">
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
        } else {
            connectedFragments.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--on-surface-variant); font-size: 13px;">
                    <span class="material-symbols-outlined" style="font-size: 24px; opacity: 0.5; margin-bottom: 8px; display: block;">device_hub</span>
                    같은 경로의 다른 순간이 없어요
                </div>
            `;
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: URL 파라미터 파싱
    // ═══════════════════════════════════════════════════════════════════════
    const urlParams = new URLSearchParams(window.location.search);
    const memoryId = urlParams.get('id');

    // ID 없이 진입 시 search.html로 리다이렉트
    if (!memoryId) {
        var isPagesContext = window.location.pathname.indexOf('/pages/') !== -1;
        var searchHref = isPagesContext ? 'search.html' : 'pages/search.html';
        window.location.href = searchHref;
        return;
    }

    // URL 파라미터에서 감상 맥락 확인
    // from: 'browse' (둘러보기) | 'my-trees' (내 트리) | 'editor' (편집기)
    const fromParam = urlParams.get('from');
    const sourceContext = ['browse', 'my-trees', 'editor'].includes(fromParam) ? fromParam : 'browse';

// ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: 데이터 로드 및 렌더링 실행
    // ═══════════════════════════════════════════════════════════════════════
    
    // treeId 추출 (URL 우선, memory.treeId fallback)
    const treeId = urlParams.get('tree') || null;
    
    // 데이터 로드
    const context = await loadMemoryDetailContext(memoryId, treeId);
    
    // memory 없으면 fallback UI
    if (!context.memory) {
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
                    <a href="../index.html" class="btn-round btn-outline" style="text-decoration: none;">${i18n('back_to_home')}</a>
                    <a href="search.html" class="btn-round btn-outline" style="text-decoration: none;">${i18n('browse_lovetrees')}</a>
                </div>
            </div>
        `;
        const mainLayout = document.querySelector('.detail-layout');
        if (mainLayout) {
            mainLayout.innerHTML = fallbackHTML;
            mainLayout.style.display = 'block';
        }
        return;
    }
    
    // 분해된 값 사용
    const { memory, tree, memories, hasTreeContext, degradedReason } = context;
    const actualTreeId = treeId || memory?.treeId || null;

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 7: 렌더링 실행 (분리된 함수 호출)
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * memory 상세 페이지에 필요한 모든 데이터를 준비합니다.
     * @param {string} memoryId - 메모리 ID
     * @param {string|null} treeId - 트리 ID (URL 또는 memory에서 추출)
     * @returns {Promise<{memory, tree, memories, sourceContext, hasTreeContext, degradedReason}>}
     */
    async function loadMemoryDetailContext(mid, tid) {
        const cache = window.LoveBudCache;
        const normalize = window.LoveBudNormalize?.normalizeMemory || ((m) => m);
        
        const MEMORY_CACHE_KEY = 'memory_' + mid;
        const TREE_CACHE_KEY = (t) => 'tree_' + t;
        const MEMORIES_CACHE_KEY = (t) => 'memories_' + t;
        
        let memory = null;
        let tree = null;
        let memories = [];
        let degradedReason = null;
        
        // 1. memory 캐시/API 로드
        const cachedMemory = cache ? cache.get(MEMORY_CACHE_KEY) : null;
        if (cachedMemory) {
            console.log('[detail] 캐시된 memory 사용:', mid);
            memory = cachedMemory;
        }
        
        try {
            if (window.apiClient && window.apiClient.getMemory) {
                const apiMemory = await window.apiClient.getMemory(mid);
                if (apiMemory) {
                    const normalizedMemory = normalize(apiMemory);
                    if (cache) {
                        cache.set(MEMORY_CACHE_KEY, normalizedMemory, 3 * 60 * 1000);
                    }
                    memory = normalizedMemory;
                    console.log('[detail] API memory loaded:', mid);
                }
            }
        } catch (e) {
            console.warn('[detail] API getMemory failed:', e.message);
            if (!memory && typeof getMemory === 'function') {
                memory = normalize(getMemory(mid));
            }
        }
        
        // memory 없으면 조기 반환
        if (!memory) {
            return { memory: null, tree: null, memories: [], sourceContext, hasTreeContext: false, degradedReason: 'not-found' };
        }
        
        // 2. treeId 결정
        let actualTreeId = tid || memory.treeId || null;
        const hasTreeContext = !!actualTreeId;
        
        if (!actualTreeId) {
            degradedReason = 'missing-tree-id';
            console.warn('[detail] Tree ID missing. Rendering memory-only detail view.');
        }
        
        // 3. tree + memories 로드
        if (hasTreeContext) {
            tree = cache ? cache.get(TREE_CACHE_KEY(actualTreeId)) : null;
            memories = cache ? cache.get(MEMORIES_CACHE_KEY(actualTreeId)) : [];
            
            const loadPromises = [];
            
            if (!tree && window.apiClient?.getTree) {
                loadPromises.push(
                    window.apiClient.getTree(actualTreeId)
                        .then(apiTree => {
                            if (apiTree) {
                                tree = apiTree;
                                if (cache) cache.set(TREE_CACHE_KEY(actualTreeId), apiTree, 5 * 60 * 1000);
                            }
                        })
                        .catch(e => console.warn('[detail] API getTree failed:', e.message))
                );
            }
            
            if ((!memories || memories.length === 0) && window.apiClient?.getMemoriesByTree) {
                loadPromises.push(
                    window.apiClient.getMemoriesByTree(actualTreeId)
                        .then(apiMemories => {
                            if (Array.isArray(apiMemories)) {
                                memories = apiMemories;
                                if (cache) cache.set(MEMORIES_CACHE_KEY(actualTreeId), apiMemories, 3 * 60 * 1000);
                            }
                        })
                        .catch(e => console.warn('[detail] API getMemoriesByTree failed:', e.message))
                );
            }
            
            if (loadPromises.length > 0) {
                await Promise.all(loadPromises);
            }
            
            // mock fallback (임의 선택 금지)
            if (!tree) {
                const mockTrees = typeof getTrees === 'function' ? getTrees() : [];
                tree = mockTrees.find(t => t.id === actualTreeId) || null;
                if (!tree) {
                    degradedReason = 'tree-load-failed';
                }
            }
            if (!memories || memories.length === 0) {
                memories = typeof getMemoriesByTree === 'function' ? getMemoriesByTree(actualTreeId) : [];
            }
        }
        
        return { memory, tree, memories, sourceContext, hasTreeContext, degradedReason };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // (Legacy 코드 제거됨 - loadMemoryDetailContext로 대체됨)
    // ══════════════════════════════════════════════════════���═��══════════════

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 8: 렌더링 실행 (분리된 함수 호출)
    // ═══════════════════════════════════════════════════════════════════════
    
    // 1. memory 본문 (tree context와 무관)
    renderMemoryBase(memory);

    // 2. tree context (상태에 따라 분기)
    renderTreeContext({ hasTreeContext, tree, memories, sourceContext, degradedReason });

    // 3. connectedFragments
    renderConnectedFragments({ memory, memories, treeId: actualTreeId, sourceContext, degradedReason });

    // 4. 페이지 타이틀 업데이트
    const safeTitle = memory.title || '기억의 순간';
    const treeTitle = tree?.title || '러브트리';
    const pageTitle = (hasTreeContext && tree && !degradedReason)
        ? `${safeTitle} | ${treeTitle} — Lovetree`
        : `${safeTitle} — Lovetree`;
    document.title = pageTitle;

    // 5. 돌아가기 버튼
    if (backButton) {
        // 백 버튼 라벨 및 동작 설정 (treeId 없을 때 editor fallback)
        let editorUrl = 'editor.html';
        if (actualTreeId) {
            editorUrl = `editor.html?treeId=${actualTreeId}`;
        }

        const backConfig = {
            'browse': { label: '둘러보기', url: 'search.html' },
            'my-trees': { label: '내 트리', url: 'my-trees.html' },
            'editor': { label: '편집하기', url: editorUrl }
        };
        const config = backConfig[sourceContext] || backConfig['browse'];

        backButton.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;margin-right:4px;">arrow_back</span> ${config.label}`;
        backButton.onclick = () => {
            window.location.href = config.url;
        };
    }

    console.log('[detail] Detail view loaded:', memory.title || 'Untitled');
});
