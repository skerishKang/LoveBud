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
    // from: 'browse' (둘러보기에서 진입) | 'my-trees' (내 트리에서 진입)
    const sourceContext = urlParams.get('from') === 'browse' ? 'browse' : 'my-trees';

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
    const i18n = window.t || ((k) => k);
    const treeTitle = tree.title || tree.data?.title || '러브트리';
    const treeContextEl = document.getElementById('treeContext');
    if (treeContextEl) {
        treeContextEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <span class="material-symbols-outlined" style="color: var(--primary); font-size: 20px;">account_tree</span>
                <span style="font-size: 14px; font-weight: 700; color: var(--on-surface-variant);">${i18n('viewing_lovetree')}</span>
            </div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--on-surface); margin: 0;">${treeTitle}</h2>
            <p style="font-size: 13px; color: var(--on-surface-variant); margin-top: 4px;">
                ${sourceContext === 'browse' ? i18n('from_browse') : i18n('from_my_trees')}
            </p>
        `;
    }

    // ── 페이지 타이틀 업데이트 ──
    document.title = `${memory.title} | ${treeTitle} — Lovetree`;

    // ── 돌아가기 버튼 설정 ───
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.onclick = () => {
            // 감상 맥락에 따라 자연스럽게 돌아가기
            window.location.href = sourceContext === 'browse' ? 'search.html' : 'my-trees.html';
        };
    }

    // ── 트리 ID 결정 ───
    // URL의 tree 파라미터가 있으면 사용, 없으면 API/memory 데이터에서 추출
    const effectiveTreeId = urlParams.get('tree') || tree.id || tree.data?.id;

    // ── 형제 메모리: API 우선, 실패 시 mock fallback ───
    let memories = [];
    const treeId = effectiveTreeId;
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
