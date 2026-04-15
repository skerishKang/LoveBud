document.addEventListener('DOMContentLoaded', () => {
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
    const memoryId = urlParams.get('id') || 'root';

    // 공통 데이터에서 메모리 찾기
    const memory = getMemory(memoryId) || getMemory('root');
    if (!memory) {
        console.warn('Memory data not found. Detail page cannot initialize.');
        return;
    }
    const tree = getTrees()[0];
    if (!tree) {
        console.warn('Tree data not found. Detail page cannot initialize.');
        return;
    }
    const memories = getMemoriesByTree(tree.id);

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
    detailDate.textContent = memory.timestamp;
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

    // 연결된 파편 (같은 부모를 가진 다른 메모리)
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
                    <div style="font-weight: 800; color: var(--on-surface); font-size: 15px;">
                        ${sib.title}
                    </div>
                </div>
            </div>
        `).join('');
    } else {
        connectedFragments.innerHTML = '';
    }

    console.log('Detail View Loaded for:', memory.title);
});
