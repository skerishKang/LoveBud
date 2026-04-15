document.addEventListener('DOMContentLoaded', () => {
    const resultsList = document.getElementById('resultsList');
    const previewContainer = document.getElementById('previewVideoContainer');
    const previewTitle = document.getElementById('previewTitle');
    const previewDesc = document.getElementById('previewDesc');
    const detailArtist = document.getElementById('detailArtist');
    const detailDate = document.getElementById('detailDate');

    // 공통 데이터에서 모든 메모리 가져오기 (root 제외)
    const allMemories = memories.filter(m => m.id !== 'root');

    // Helpers
    const excerpt = (text, max = 60) => {
        if (!text) return '';
        return text.length > max ? text.slice(0, max) + '...' : text;
    };

    const populateResults = (results) => {
        resultsList.innerHTML = '';
        results.forEach(mem => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <div class="thumbnail-wrapper">
                    <img src="${mem.thumbnail}" alt="${mem.title}">
                </div>
                <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <h3 class="serif" style="font-size: 1.25rem; margin-bottom: 4px;">${mem.title}</h3>
                        <p style="font-size: 10px; color: var(--on-surface-variant); text-transform: uppercase; letter-spacing: 1px;">
                            ${mem.timestamp} • ${mem.source || ''}
                        </p>
                    </div>
                    <button class="btn-round btn-primary save-btn" data-id="${mem.id}" style="width: fit-content; margin-top: 16px;">
                        저장하기
                    </button>
                </div>
            `;
            // 카드 클릭 시 detail 페이지로 이동
            card.addEventListener('click', (e) => {
                if (e.target.closest('.save-btn')) return;
                window.location.href = `detail.html?id=${mem.id}`;
            });
            resultsList.appendChild(card);
        });
    };

    const updatePreview = (mem) => {
        previewContainer.innerHTML = `
            <iframe width="100%" height="100%"
                src="${mem.sourceUrl}"
                title="${mem.title}" frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>
        `;

        previewTitle.textContent = mem.title;
        previewDesc.textContent = `"${excerpt(mem.quote || mem.memo)}"`;
        detailArtist.textContent = mem.artist || '';
        detailDate.textContent = mem.timestamp;
    };

    // Initial Load
    populateResults(allMemories);
    if (allMemories.length > 0) {
        updatePreview(allMemories[0]);
    }

    console.log('Search Logic Initialized');
});
