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
    const fromBrowse = urlParams.get('from') === 'browse';
    const treeIdFromUrl = urlParams.get('tree');

    // ── 메모리 데이터: API 우선, 실패 시 mock fallback ──
    let memory = null;
    try {
        if (window.apiClient && window.apiClient.getMemory) {
            const apiMemory = await window.apiClient.getMemory(memoryId);
            if (apiMemory) {
                memory = apiMemory;
                console.log('[detail] API memory loaded:', memoryId);
            }
        }
    } catch (e) {
        console.warn('[detail] API getMemory failed, fallback to mock:', e.message);
    }
    // API 실패 시 mock fallback
    if (!memory) {
        memory = typeof getMemory === 'function' ? getMemory(memoryId) : null;
    }
    if (!memory) {
        // ── memory 조회 실패 시 fallback UI 표시 ──
        console.warn('[detail] Memory not found, showing fallback UI');
        const fallbackHTML = `
            <div style="max-width: 600px; margin: 80px auto; text-align: center; padding: 48px;">
                <span class="material-symbols-outlined" style="font-size: 64px; color: var(--on-surface-variant); opacity: 0.5; margin-bottom: 24px; display: block;">sentiment_dissatisfied</span>
                <h2 class="headline" style="font-size: 1.8rem; margin-bottom: 16px; color: var(--on-surface);">기억을 찾지 못했어요</h2>
                <p style="color: var(--on-surface-variant); margin-bottom: 32px; line-height: 1.6;">
                    요청하신 기억이 존재하지 않거나<br>접근할 수 없는 상태입니다.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <a href="../index.html" class="btn-round btn-outline" style="text-decoration: none;">첫화면으로</a>
                    <a href="search.html" class="btn-round btn-outline" style="text-decoration: none;">러브트리 둘러보기</a>
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

    // ── 트리 데이터: API 우선, 실패 시 mock fallback ──
    let tree = null;
    try {
        if (window.apiClient && window.apiClient.getTree) {
            const apiTree = await window.apiClient.getTree(memory.treeId || memory.data?.tree_id);
            if (apiTree) tree = apiTree;
        }
    } catch (e) {
        console.warn('[detail] API getTree failed, using mock fallback:', e.message);
    }
    if (!tree) {
        const trees = typeof getTrees === 'function' ? getTrees() : [];
        const targetTreeId = memory.treeId || memory.data?.tree_id;
        tree = trees.find(t => t.id === targetTreeId) || trees[0];
    }
    if (!tree) {
        console.warn('Tree data not found. Detail page cannot initialize.');
        return;
    }

    // ── 트리 맥락 표시 ──
    const treeTitle = tree.title || tree.data?.title || '러브트리';
    const treeContextEl = document.getElementById('treeContext');
    if (treeContextEl) {
        treeContextEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <span class="material-symbols-outlined" style="color: var(--primary); font-size: 20px;">account_tree</span>
                <span style="font-size: 14px; font-weight: 700; color: var(--on-surface-variant);">러브트리 감상 중</span>
            </div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--on-surface); margin: 0;">${treeTitle}</h2>
            <p style="font-size: 13px; color: var(--on-surface-variant); margin-top: 4px;">
                ${fromBrowse ? '둘러보기에서 선택한 트리의 첫 순간' : '러브트리의 감정 경로'}
            </p>
        `;
    }

    // ── 페이지 타이틀 업데이트 ──
    document.title = `${memory.title} | ${treeTitle} — Lovetree`;

    // ── 돌아가기 버튼 설정 ──
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.onclick = () => {
            window.location.href = fromBrowse ? 'search.html' : 'search.html';
        };
    }

    // ── 형제 메모리: API 우선, 실패 시 mock fallback ──
    let memories = [];
    const treeId = tree.id || tree.data?.id;
    try {
        if (window.apiClient && window.apiClient.getMemoriesByTree) {
            const apiMemories = await window.apiClient.getMemoriesByTree(treeId);
            if (Array.isArray(apiMemories)) {
                memories = apiMemories;
                console.log('[detail] API memories loaded:', apiMemories.length);
            }
        }
    } catch (e) {
        console.warn('[detail] API getMemoriesByTree failed, fallback to mock:', e.message);
    }
    if (memories.length === 0) {
        memories = typeof getMemoriesByTree === 'function' ? getMemoriesByTree(treeId) : [];
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
        videoMain.innerHTML = `
            <div style="width:100%;height:100%;background:var(--surface-container);display:flex;align-items:center;justify-content:center;color:var(--on-surface-variant);">
                비디오가 없습니다
            </div>
        `;
    }

    // 메타데이터 채우기
    memoryTitle.textContent = memory.title;
    detailArtist.textContent = memory.artist || 'Unknown';
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
            <div class="moment-card" onclick="location.href='detail.html?id=${sib.id}'">
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
