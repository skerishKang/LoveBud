document.addEventListener('DOMContentLoaded', async () => {
    const resultsList = document.getElementById('resultsList');
    const previewContainer = document.getElementById('previewVideoContainer');
    const previewTitle = document.getElementById('previewTitle');
    const previewDesc = document.getElementById('previewDesc');
    const detailArtist = document.getElementById('detailArtist');
    const detailDate = document.getElementById('detailDate');
    const searchInput = document.getElementById('searchInput');
    const tagChips = document.querySelectorAll('.tag-chip');

    // ── 초기 로딩 상태 표시 ──
    const showLoading = () => {
        resultsList.innerHTML = `
            <div style="text-align: center; padding: 80px 24px; color: var(--on-surface-variant);">
                <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.4; margin-bottom: 16px; display: block; animation: spin 1s linear infinite;">sync</span>
                <p style="font-size: 1.1rem; font-weight: 500;">기억들을 불러오는 중...</p>
            </div>
        `;
    };

    // 로딩 및 페이드 인 애니메이션 CSS (없으면 추가)
    if (!document.getElementById('search-anim-style')) {
        const style = document.createElement('style');
        style.id = 'search-anim-style';
        style.textContent = `
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            .results-fade-in { animation: fadeIn 0.3s ease-out; }
        `;
        document.head.appendChild(style);
    }

    showLoading();

    // ── 데이터 소스: API 우선, 실패 시 mock fallback ──
    // 최소 로딩 시간 (깜빡임 방지)
    const MIN_LOADING_TIME = 400;
    const startTime = Date.now();

    let allMemories = [];
    let loadError = null;
    try {
        // API 우선 시도
        if (window.apiClient && window.apiClient.getCommunityMemories) {
            const apiMemories = await window.apiClient.getCommunityMemories();
            // API 응답이 배열이면 사용, 아니면 fallback
            if (Array.isArray(apiMemories)) {
                allMemories = apiMemories;
                console.log('[search] API 데이터 사용:', apiMemories.length, '개');
            } else {
                throw new Error('API 응답 형식 오류');
            }
        } else {
            throw new Error('apiClient 사용 불가');
        }
    } catch (error) {
        // API 실패 시 mock-data.js fallback
        loadError = error;
        console.warn('[search] API 실패, mock fallback:', error.message);
        if (typeof memories !== 'undefined') {
            allMemories = memories.filter(m => m.id !== 'root');
        }
    }

    // 최소 로딩 시간 보장 (깜빡임 방지)
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_LOADING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
    }

    // ── 현재 필터/검색 상태 ──
    let currentQuery = '';
    let currentCategory = '전체';

    // 카테고리 → sourceType 매핑
    const CATEGORY_MAP = {
        '전체': null,
        '뮤직비디오': 'mv',
        '공식 무대': 'stage',
        '팬 비디오': 'fan'
    };

    // source가 어느 카테고리에 속하는지 판단
    const categorize = (mem) => {
        const src = (mem.source || '').toLowerCase();
        const title = (mem.title || '').toLowerCase();
        if (/mv|뮤직비디오|music video/.test(src + title)) return 'mv';
        if (/inkigayo|m-countdown|음악방송|show|music bank|공식|stage/.test(src + title)) return 'stage';
        return 'fan'; // 기본값: 팬 비디오
    };

    // ── 검색 필터 ──
    const matchesQuery = (mem, query) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return [
            mem.title, mem.artist, mem.memo, mem.source
        ].some(field => field && field.toLowerCase().includes(q));
    };

    const matchesCategory = (mem, category) => {
        if (category === '전체') return true;
        const cat = CATEGORY_MAP[category];
        if (!cat) return true;
        return categorize(mem) === cat;
    };

    // ── 필터링 실행 ──
    const getFilteredMemories = () => {
        return allMemories.filter(m =>
            matchesQuery(m, currentQuery) && matchesCategory(m, currentCategory)
        );
    };

    // ── Helpers ──
    const excerpt = (text, max = 60) => {
        if (!text) return '';
        return text.length > max ? text.slice(0, max) + '…' : text;
    };

    // ── 감정 태그 배지 ──
    const renderTags = (tags) => {
        if (!tags || !tags.length) return '';
        return tags.slice(0, 2).map(t =>
            `<span style="font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 99px; background: var(--surface-container-low); color: var(--on-surface-variant); letter-spacing: 0.5px;">${t}</span>`
        ).join(' ');
    };

    // ── 카테고리 뱃지 ──
    const categoryLabel = (mem) => {
        const cat = categorize(mem);
        const labels = { mv: '뮤직비디오', stage: '공식 무대', fan: '팬 비디오' };
        return labels[cat] || '';
    };

    // ── 결과 렌더링 ──
    // isDemo: true일 경우 "샘플 데이터" 배지를 표시
    const populateResults = (results, isDemo = false) => {
        resultsList.innerHTML = '';
        
        // 샘플 데이터 배지 (isDemo일 경우 상단에 표시)
        if (isDemo) {
            const demoBadge = document.createElement('div');
            demoBadge.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 8px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 12px; text-align: center;';
            demoBadge.innerHTML = '<span style="font-weight: 700;">⚠️ 샘플 데이터</span> — 실제 사용자 콘텐츠가 아닌 MVP 데모용 예시입니다';
            resultsList.appendChild(demoBadge);
        }
        
        resultsList.classList.add('results-fade-in');
        // 애니메이션 후 클래스 제거 (재사용 가능하게)
        setTimeout(() => resultsList.classList.remove('results-fade-in'), 350);

        if (results.length === 0) {
            // API는 성공했지만 데이터가 없는 경우 (빈 DB)
            const isEmptyApi = loadError === null && allMemories.length === 0;
            
            if (isEmptyApi) {
                // 빈 데이터베이스 상태 - 사용자 참여 유도
                resultsList.innerHTML = `
                    <div style="text-align: center; padding: 60px 24px; color: var(--on-surface-variant);">
                        <span class="material-symbols-outlined" style="font-size: 56px; color: var(--primary); opacity: 0.6; margin-bottom: 20px; display: block;">forest</span>
                        <p style="font-size: 1.25rem; font-weight: 800; margin-bottom: 12px; color: var(--on-surface);">러브트리가 자라나는 중입니다</p>
                        <p style="font-size: 0.95rem; opacity: 0.8; margin-bottom: 24px; line-height: 1.6;">
                            아직 공개된 기억이 없어요.<br>
                            첫 번째 기억을 기록하고 나무를 키워보세요!
                        </p>
                        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                            <a href="editor.html" class="btn-round btn-primary" style="text-decoration: none; font-size: 14px; padding: 10px 20px;">
                                <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">add_circle</span>
                                첫 기억 기록하기
                            </a>
                            <button id="loadDemoData" class="btn-round btn-outline" style="font-size: 14px; padding: 10px 20px;">
                                <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">play_circle</span>
                                데모 데이터 보기
                            </button>
                        </div>
                    </div>
                `;
                
                // 데모 데이터 버튼 이벤트 리스너
                const demoBtn = document.getElementById('loadDemoData');
                if (demoBtn) {
                    demoBtn.addEventListener('click', () => {
                        // mock 데이터로 폴백
                        if (typeof memories !== 'undefined') {
                            allMemories = memories.filter(m => m.id !== 'root' && m.visibility === 'public');
                            populateResults(allMemories, /* isDemo */ true);
                            // 검색/필터 UI 초기화
                            currentQuery = '';
                            currentCategory = '전체';
                            searchInput.value = '';
                            tagChips.forEach(c => c.classList.remove('active'));
                            document.querySelector('.tag-chip[data-category="전체"]')?.classList.add('active');
                        }
                    });
                }
            } else {
                // 필터 결과 없음
                resultsList.innerHTML = `
                    <div style="text-align: center; padding: 80px 24px; color: var(--on-surface-variant);">
                        <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px; display: block;">search_off</span>
                        <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">아직 이런 기억은 없네요</p>
                        <p style="font-size: 0.9rem; opacity: 0.7;">다른 키워드나 카테고리로 찾아보세요</p>
                    </div>
                `;
            }
            return;
        }

        results.forEach(mem => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <div class="thumbnail-wrapper">
                    <img src="${mem.thumbnail}" alt="${mem.title}" loading="lazy">
                </div>
                <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0;">
                    <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
                <span style="font-size: 9px; font-weight: 900; color: var(--primary); background: rgba(141,71,79,0.08); padding: 3px 8px; border-radius: 99px; letter-spacing: 1px; text-transform: uppercase;">${categoryLabel(mem)}</span>
                <span style="font-size: 10px; color: var(--on-surface-variant); letter-spacing: 0.5px;">${mem.timestamp}</span>
                ${mem.source ? `<span style="font-size: 10px; color: var(--on-surface-variant); opacity: 0.8; margin-left: 4px;">${mem.source}</span>` : ''}
            </div>
                        <h3 class="serif" style="font-size: 1.25rem; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${mem.title}</h3>
                        <p style="font-size: 0.85rem; color: var(--on-surface-variant); margin-bottom: 8px; line-height: 1.4;">
                            ${excerpt(mem.memo, 80)}
                        </p>
                        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                            ${mem.artist ? `<span style="font-size: 12px; font-weight: 700; color: var(--on-surface);">${mem.artist}</span>` : ''}
                            ${renderTags(mem.emotionTags)}
                        </div>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => {
                window.location.href = `detail.html?id=${mem.id}`;
            });
            // 호버 시 미리보기 업데이트
            card.addEventListener('mouseenter', () => updatePreview(mem));
            resultsList.appendChild(card);
        });
    };

    // ── 미리보기 업데이트 ──
    const updatePreview = (mem) => {
        previewContainer.innerHTML = `
            <iframe width="100%" height="100%"
                src="${mem.sourceUrl}"
                title="${mem.title}" frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>
        `;

        previewTitle.textContent = mem.title;
        previewDesc.textContent = `"${excerpt(mem.memo, 100)}"`;
        detailArtist.textContent = mem.artist || '-';
        detailDate.textContent = mem.timestamp || '-';
    };

    // ── 검색 입력 이벤트 ──
    searchInput.addEventListener('input', (e) => {
        currentQuery = e.target.value.trim();
        populateResults(getFilteredMemories());
    });

    // ── 필터 칩 클릭 이벤트 ──
    tagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            tagChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.textContent.trim();
            populateResults(getFilteredMemories());
        });
    });

    // ── 초기 로드 ──
    populateResults(allMemories);
    if (allMemories.length > 0) {
        updatePreview(allMemories[0]);
    }
});
