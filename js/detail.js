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

    // URL에서 memory ID 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const memoryId = urlParams.get('id');

    // ID 없이 진입 시 search.html로 리다이렉트
    if (!memoryId) {
        window.location.href = 'search.html';
        return;
    }

    // URL 파라미터에서 감상 맥락 확인
    // from: 'browse' (둘러보기) | 'my-trees' (내 트리) | 'editor' (편집기)
    const fromParam = urlParams.get('from');
    const sourceContext = ['browse', 'my-trees', 'editor'].includes(fromParam) ? fromParam : 'browse';

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
    try {
        if (window.apiClient && window.apiClient.getMemory) {
            const apiMemory = await window.apiClient.getMemory(memoryId);
            if (apiMemory) {
                // 캐시 업데이트
                if (cache) {
                    cache.set(MEMORY_CACHE_KEY, apiMemory, 3 * 60 * 1000); // 3분 TTL
                }
                // 캐시와 다르면 갱신
                if (JSON.stringify(memory) !== JSON.stringify(apiMemory)) {
                    memory = apiMemory;
                }
                console.log('[detail] API memory loaded:', memoryId);
            }
        }
    } catch (e) {
        console.warn('[detail] API getMemory failed:', e.message);
        // 캐시가 없으면 mock fallback
        if (!memory && typeof getMemory === 'function') {
            memory = getMemory(memoryId);
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
                    <a href="../index.html" class="btn-round btn-outline" style="text-decoration: none;">${i18n('back_to_home')}</a>
                    <a href="search.html" class="btn-round btn-outline" style="text-decoration: none;">${i18n('browse_lovetrees')}</a>
                </div>
            </div>
        `;
        // 메인 콘텐츠 영역을 fallback으로 교체
        const mainLayout = document.querySelector('.detail-layout');
        if (mainLayout) {
            mainLayout.innerHTML = fallbackHTML;
            mainLayout.style.display = 'block';
        }
        return;
    }

    // ── 트리 + siblings 병렬 로딩 (캐시 우선) ──
    const treeId = urlParams.get('tree') || memory.treeId || memory.data?.tree_id;
    if (!treeId) {
        console.warn('[detail] Tree ID not found. Detail page cannot initialize.');
        return;
    }

    // 캐시에서 먼저 확인
    let tree = cache ? cache.get(TREE_CACHE_KEY(treeId)) : null;
    let memories = cache ? cache.get(MEMORIES_CACHE_KEY(treeId)) : null;

    // 병렬로 API 호출 (tree와 memories 동시에)
    const loadPromises = [];

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

    // 캐시/API 모두 실패 시 mock fallback
    if (!tree) {
        const trees = typeof getTrees === 'function' ? getTrees() : [];
        tree = trees.find(t => t.id === treeId) || trees[0];
        console.log('[detail] mock tree fallback');
    }
    if (!memories) {
        memories = typeof getMemoriesByTree === 'function' ? getMemoriesByTree(treeId) : [];
        console.log('[detail] mock memories fallback');
    }

    // ── 트리 맥락 표시: 감상 흐름 강화 ──
    const i18n = window.t || ((k) => k);
    const treeTitle = tree.title || tree.data?.title || '러브트리';
    const treeContextEl = document.getElementById('treeContext');
    
    // 감상 맥락별 안내 문구
    const contextMessages = {
        'browse': {
            icon: 'explore',
            label: '둘러보기',
            desc: `${tree.memories?.length || 0}개의 순간이 이어진 감정 경로를 따라가고 있어요`
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
    
    if (treeContextEl) {
        treeContextEl.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 16px;">
                <div style="width: 48px; height: 48px; background: var(--surface-container); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span class="material-symbols-outlined" style="color: var(--primary); font-size: 24px;">${contextInfo.icon}</span>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="font-size: 12px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 1px;">${contextInfo.label}</span>
                        <span style="color: var(--outline-variant);">·</span>
                        <span style="font-size: 12px; color: var(--on-surface-variant);">${tree.memories?.length || 0}개 순간</span>
                    </div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--on-surface); margin: 0; line-height: 1.3;">${treeTitle}</h2>
                    <p style="font-size: 13px; color: var(--on-surface-variant); margin-top: 6px; line-height: 1.5;">
                        ${contextInfo.desc}
                    </p>
                </div>
            </div>
        `;
    }

    // ── 페이지 타이틀 업데이트 ──
    document.title = `${memory.title} | ${treeTitle} — Lovetree`;

    // ── 돌아가기 버튼 설정: 흐름 일관성 유지 ───
    const backButton = document.getElementById('backButton');
    if (backButton) {
        // 백 버튼 라벨 및 동작 설정
        const backConfig = {
            'browse': { label: '둘러보기', url: 'search.html' },
            'my-trees': { label: '내 트리', url: 'my-trees.html' },
            'editor': { label: '편집하기', url: `editor.html?treeId=${treeId || ''}` }
        };
        const config = backConfig[sourceContext] || backConfig['browse'];

        backButton.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;margin-right:4px;">arrow_back</span> ${config.label}`;
        backButton.onclick = () => {
            window.location.href = config.url;
        };
    }

    // 비디오 로드 (sourceUrl은 이미 embed URL)
    if (memory.sourceUrl) {
        videoMain.innerHTML = `
            <iframe width="100%" height="100%"
                src="${memory.sourceUrl}?autoplay=0"
                title="${memory.title}" frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>
        `;
    } else {
        const i18n = window.t || ((k) => k);
        videoMain.innerHTML = `
            <div style="width:100%;height:100%;background:var(--surface-container);display:flex;align-items:center;justify-content:center;color:var(--on-surface-variant);">
                ${i18n('no_video')}
            </div>
        `;
    }

    // 메타데이터 채우기
    memoryTitle.textContent = memory.title;
    detailArtist.textContent = memory.artist || ((window.t || ((k) => k))('unknown_artist'));
    detailDate.textContent = memory.timestamp + (memory.source ? ' · ' + memory.source : '');
    if (detailSubtitle) detailSubtitle.textContent = '기록 — ' + memory.timestamp;

    // 감정 태그
    if (memory.emotionTags && memory.emotionTags.length > 0) {
        tagsContainer.innerHTML = memory.emotionTags.map(tag =>
            `<span class="tag-chip active">${tag}</span>`
        ).join('');
    }

    // 일기 내용
    diaryQuote.textContent = `"${memory.quote || memory.memo}"`;
    if (memory.memo) {
        diaryContent.textContent = memory.memo;
    }

    // 연결된 기억 (같은 부모를 가진 다른 메모리)
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
        connectedFragments.innerHTML = '';
    }

    console.log('Detail View Loaded for:', memory.title);
});
