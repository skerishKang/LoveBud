document.addEventListener('DOMContentLoaded', async () => {
    // ── 경로 유틸 ──
    const getBasePath = () => {
        var path = window.location.pathname;
        return path.indexOf('/pages/') !== -1 ? '' : 'pages/';
    };

    const resultsList = document.getElementById('resultsList');
    const previewContainer = document.getElementById('previewVideoContainer');
    const previewTitle = document.getElementById('previewTitle');
    const previewDesc = document.getElementById('previewDesc');
    const previewMemoriesCount = document.getElementById('previewMemoriesCount');
    const previewTreeDuration = document.getElementById('previewTreeDuration');
    const previewEmotionTags = document.getElementById('previewEmotionTags');
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

    // ── 캐시 키 설정 ──
    const cache = window.LoveBudCache;
    const PUBLIC_TREES_CACHE_KEY = 'public_trees_list';

    showLoading();

    // ── 데이터 소스: 캐시 우선, API로 background refresh ──
    // 최소 로딩 시간 (깜빡임 방지)
    const MIN_LOADING_TIME = 400;
    const startTime = Date.now();

    let allTrees = [];
    let treeToMemories = {}; // treeId -> memories[] 매핑
    let loadError = null;

    // 트리 데이터 어댑터: memories를 tree 단위로 그룹핑
    const buildTreeData = (memories, trees) => {
        const validMemories = memories.filter(m => m.id !== 'root' && m.visibility === 'public');

        // treeId별로 memories 그룹핑
        const grouped = {};
        validMemories.forEach(m => {
            const tid = m.treeId || 'ungrouped';
            if (!grouped[tid]) grouped[tid] = [];
            grouped[tid].push(m);
        });

        // trees 배열 기반으로 트리 메타데이터 구성
        return trees.map(tree => {
            const mems = grouped[tree.id] || [];
            const sortedMems = mems.sort((a, b) => new Date(a.timestamp || a.createdAt || 0) - new Date(b.timestamp || b.createdAt || 0));

            // 대표 감정 태그 수집 (중복 제거, 최대 3개)
            const allTags = sortedMems.flatMap(m => (m.emotion_tags || m.emotionTags || [])).filter(Boolean);
            const uniqueTags = [...new Set(allTags)].slice(0, 3);

            // 시간 범위 계산
            const timestamps = sortedMems.map(m => m.timestamp).filter(Boolean);
            const timeRange = timestamps.length >= 2
                ? `${timestamps[0]} ~ ${timestamps[timestamps.length - 1]}`
                : (timestamps[0] || ' recently');

            return {
                ...tree,
                memories: sortedMems,
                memoryCount: sortedMems.length,
                emotionTags: uniqueTags,
                timeRange: timeRange,
                representativeThumbnail: sortedMems[0]?.thumbnail || '',
                // 트리 테마 추정 (첫 memory의 아티스트 또는 트리 제목 기반)
                theme: sortedMems[0]?.artist || 'Mixed',
                // 입덕/성장/최애 단계 추정
                stage: sortedMems.length <= 2 ? '입덕' : (sortedMems.length <= 4 ? '성장' : '최애')
            };
}).filter(t => t.memoryCount > 0); // 메모리가 없는 트리는 제외
    };

    // ── 1. 캐시된 public trees 먼저 확인 ──
    let cachedTrees = null;
    if (cache) {
        cachedTrees = cache.get(PUBLIC_TREES_CACHE_KEY);
        if (cachedTrees && Array.isArray(cachedTrees) && cachedTrees.length > 0) {
            console.log('[search] 캐시된 public trees 사용:', cachedTrees.length, '개');
            allTrees = cachedTrees;
            // 초기 로드 시 populateResults가 뒤에서 호출됨
        }
    }

    // ── 2. Background에서 API로 최신 데이터 가져오기 ──
    let apiTreesLoaded = false;
    try {
        if (window.apiClient && window.apiClient.getPublicTrees) {
            const apiTrees = await window.apiClient.getPublicTrees();
            if (Array.isArray(apiTrees)) {
                console.log('[search] API public trees 로드:', apiTrees.length, '개');

                if (cache) {
                    cache.set(PUBLIC_TREES_CACHE_KEY, apiTrees, 5 * 60 * 1000); // 5분 TTL
                }

                if (JSON.stringify(allTrees) !== JSON.stringify(apiTrees)) {
                    allTrees = apiTrees;
                }

                apiTreesLoaded = true;
            } else {
                throw new Error('API 응답 형식 오류');
            }
        } else {
            throw new Error('tree API 사용 불가');
        }
    } catch (error) {
        // API 실패 시, 캐시가 없으면 mock fallback
        loadError = error;
        console.warn('[search] API 실패:', error.message);

        if (!cachedTrees && typeof memories !== 'undefined' && typeof trees !== 'undefined') {
            allTrees = buildTreeData(memories, trees);
            console.log('[search] mock 데이터 fallback:', allTrees.length, '개 트리');
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

    // 트리 단계 필터 매핑 (입덕/성장/최애)
    const CATEGORY_MAP = {
        '전체': null,
        '입덕': '입덕',
        '성장': '성장',
        '최애': '최애'
    };

    // ── 검색 필터 (트리 중심) ──
    const matchesQuery = (tree, query) => {
        if (!query) return true;
        const q = query.toLowerCase();
        // 트리 제목, 테마, 내부 메모리들의 아티스트/제목 검색
        const treeFields = [tree.title, tree.theme, tree.memo].filter(Boolean);
        const memoryFields = tree.memories?.flatMap(m => [m.title, m.artist, m.memo]) || [];
        return [...treeFields, ...memoryFields].some(field =>
            field && field.toLowerCase().includes(q)
        );
    };

    const matchesCategory = (tree, category) => {
        if (category === '전체' || category === '전체 경로') return true;
        return tree.stage === category;
    };

    // ── 필터링 실행 ──
    const getFilteredTrees = () => {
        return allTrees.filter(t =>
            matchesQuery(t, currentQuery) && matchesCategory(t, currentCategory)
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

    // ── 카테고리 분류 헬퍼 ──
    const categorize = (mem) => {
        if (!mem || !mem.emotionTags) return null;
        const tags = mem.emotionTags;
        if (tags.includes('MV') || tags.includes('뮤직비디오')) return 'mv';
        if (tags.includes('공식') || tags.includes('무대')) return 'stage';
        if (tags.includes('팬')) return 'fan';
        return null;
    };

    // ── 카테고리 뱃지 ──
    const categoryLabel = (mem) => {
        const cat = categorize(mem);
        const labels = { mv: '뮤직비디오', stage: '공식 무대', fan: '팬 비디오' };
        return labels[cat] || '';
    };

    // ── 트리 경로 미리보기 렌더링 ──
    const renderPathPreview = (memories) => {
        if (!memories || memories.length === 0) return '';

        const previewCount = Math.min(memories.length, 3);
        const previewMems = memories.slice(0, previewCount);

        let html = '<div class="tree-path-preview">';

        previewMems.forEach((mem, idx) => {
            html += `
                <div class="path-node" title="${mem.title}">
                    <img src="${mem.thumbnail}" alt="${mem.title}" loading="lazy">
                </div>
            `;
            if (idx < previewCount - 1) {
                html += '<span class="path-arrow material-symbols-outlined">arrow_forward</span>';
            }
        });

        if (memories.length > previewCount) {
            html += `<div class="path-more">+${memories.length - previewCount}</div>`;
        }

        html += '</div>';
        return html;
    };

    // ── 트리 아이콘 (단계별) ──
    const getTreeIcon = (stage) => {
        const icons = { '입덕': '🌱', '성장': '🌿', '최애': '🌳' };
        return icons[stage] || '🌱';
    };

    // ── 결과 렌더링 (트리 중심) ──
    const populateResults = (trees, isDemo = false) => {
        resultsList.innerHTML = '';

        // 샘플 데이터 배지 (isDemo일 경우 상단에 표시)
        if (isDemo) {
            const demoBadge = document.createElement('div');
            demoBadge.style.cssText = 'background: var(--surface-container); border: 1px solid var(--outline-variant); color: var(--on-surface-variant); padding: 12px 20px; border-radius: 1rem; margin-bottom: 24px; font-size: 13px; text-align: center; font-style: italic;';
            demoBadge.innerHTML = '<span style="font-weight: 700;">🌸 샘플 러브트리</span> — 다른 팬들이 남긴 감정의 경로를 둘러보세요';
            resultsList.appendChild(demoBadge);
        }

        resultsList.classList.add('results-fade-in');
        setTimeout(() => resultsList.classList.remove('results-fade-in'), 350);

        if (trees.length === 0) {
            const isEmptyApi = loadError === null && allTrees.length === 0;

            if (isEmptyApi) {
                var basePath = getBasePath();
                resultsList.innerHTML = `
                    <div style="text-align: center; padding: 60px 24px; color: var(--on-surface-variant);">
                        <span class="material-symbols-outlined" style="font-size: 56px; color: var(--primary); opacity: 0.6; margin-bottom: 20px; display: block;">forest</span>
                        <p style="font-size: 1.25rem; font-weight: 800; margin-bottom: 12px; color: var(--on-surface);">러브트리가 자라나는 중입니다</p>
                        <p style="font-size: 0.95rem; opacity: 0.8; margin-bottom: 24px; line-height: 1.6;">
                            아직 공개된 러브트리가 없어요.<br>
                            첫 번째 순간을 기록하고 당신의 나무를 키워보세요!
                        </p>
                        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                            <a href="${basePath}my-trees.html" class="btn-round btn-primary" style="text-decoration: none; font-size: 14px; padding: 10px 20px;">
                                <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">account_tree</span>
                                내 러브트리 시작하기
                            </a>
                            <a href="${basePath}index.html" class="btn-round btn-outline" style="text-decoration: none; font-size: 14px; padding: 10px 20px;">
                                <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">home</span>
                                소개 보기
                            </a>
                        </div>
                    </div>
                `;
            } else {
                resultsList.innerHTML = `
                    <div style="text-align: center; padding: 80px 24px; color: var(--on-surface-variant);">
                        <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px; display: block;">search_off</span>
                        <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">이런 러브트리는 아직 없네요</p>
                        <p style="font-size: 0.9rem; opacity: 0.7;">다른 키워드나 단계로 찾아보세요</p>
                    </div>
                `;
            }
            return;
        }

        trees.forEach((tree, index) => {
            const card = document.createElement('div');
            card.className = 'tree-card';
            card.style.animationDelay = `${index * 0.05}s`;

            // 감정 경로 요약: 첫 순간 → 마지막 순간 (감정 흐름 강조)
            const firstMem = tree.memories[0];
            const lastMem = tree.memories[tree.memories.length - 1];
            const firstMoment = firstMem?.title?.replace(/\s*-\s*.*/, '') || '첫 순간';
            const lastMoment = tree.memories.length >= 2
                ? lastMem?.title?.replace(/\s*-\s*.*/, '')
                : null;
            
            // 감정 경로 설명 텍스트
            const pathDesc = lastMoment
                ? `처음 <strong style="color:var(--primary);">${firstMoment}</strong>의 감정이 <strong>${lastMoment}</strong>까지 이어졌어요`
                : `<strong style="color:var(--primary);">${firstMoment}</strong> — 입덕의 첫 순간`;

            // 대표 순간 썸네일 (첫 번째 순간)
            const representativeThumb = firstMem?.thumbnail || '';
            
            // 감정 태그 (최대 3개, 시각적 강조)
            const emotionTagsHtml = tree.emotionTags
                .slice(0, 3)
                .map(tag => `<span class="emotion-tag" style="background:var(--primary-container);color:var(--on-primary-container);font-weight:700;font-size:12px;padding:6px 12px;">#${tag}</span>`)
                .join('');

            // 카드 구조: 감정 경로 중심으로 재편성
            card.innerHTML = `
                <!-- 트리 헤더: 제목 + 단계 아이콘 -->
                <div class="tree-header" style="margin-bottom:16px;">
                    <div class="tree-icon" title="${tree.stage} 단계" style="width:48px;height:48px;border-radius:12px;font-size:24px;">${getTreeIcon(tree.stage)}</div>
                    <div class="tree-title-group" style="flex:1;min-width:0;">
                        <div class="tree-title" style="font-size:1.25rem;font-weight:800;line-height:1.3;">${tree.title}</div>
                        <div style="font-size:12px;color:var(--on-surface-variant);margin-top:4px;display:flex;align-items:center;gap:8px;">
                            <span class="material-symbols-outlined" style="font-size:14px;">account_tree</span>
                            ${tree.memoryCount}개의 순간 · ${tree.timeRange}
                        </div>
                    </div>
                </div>
                
                <!-- 감정 경로 미리보기 (시각적 중심) -->
                <div class="tree-path-section" style="background:var(--surface-container-low);border-radius:1rem;padding:16px;margin-bottom:16px;">
                    <div style="font-size:11px;font-weight:800;color:var(--on-surface-variant);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">
                        <span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle;margin-right:4px;">route</span>
                        감정 경로
                    </div>
                    <div style="font-size:14px;line-height:1.5;color:var(--on-surface);">${pathDesc}</div>
                    ${renderPathPreview(tree.memories)}
                </div>
                
                <!-- 감정 태그 -->
                <div class="tree-emotions" style="margin-bottom:12px;">
                    ${emotionTagsHtml}
                </div>
                
                <!-- 감상 유도 문구 -->
                <div style="font-size:13px;color:var(--on-surface-variant);font-style:italic;padding-top:12px;border-top:1px solid var(--outline-variant);display:flex;align-items:center;gap:6px;">
                    <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary);">play_circle</span>
                    첫 순간부터 감상하기
                </div>
            `;

            card.addEventListener('click', () => {
                // 러브트리 감상 흐름: 트리의 첫 번째 순간부터 감상 시작
                if (tree.memories && tree.memories.length > 0) {
                    const firstMemory = tree.memories[0];
                    // tree 파라미터와 from 파라미터로 감상 맥락 전달
                    var basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
                    window.location.href = `${basePath}detail.html?id=${firstMemory.id}&tree=${tree.id}&from=browse`;
                }
            });

            card.addEventListener('mouseenter', () => updatePreview(tree));
            resultsList.appendChild(card);
        });
    };

    // ── 미리보기 업데이트: 감상 안내판 스타일 ──
    const updatePreview = (tree) => {
        const firstMem = tree.memories?.[0];
        if (!firstMem) return;

        // 감정 경로 텍스트 생성 (더 자연스러운 흐름)
        const pathStages = tree.memories.slice(0, 3).map((m, i) => {
            const momentTitle = m.title.replace(/\s*-\s*.*/, '');
            return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--surface-container);border-radius:8px;font-size:13px;"><span style="color:var(--primary);font-weight:800;">${i + 1}</span><span>${momentTitle}</span></span>`;
        }).join('<span style="opacity:0.3;margin:0 4px;">→</span>');
        
        const moreStages = tree.memories.length > 3 
            ? `<div style="margin-top:8px;font-size:12px;color:var(--on-surface-variant);font-style:italic;">... 그리고 ${tree.memories.length - 3}개의 순간 더</div>` 
            : '';

        // preview 비디오 컨테이너 (감상 유도 강화)
        previewContainer.innerHTML = `
            <div style="position:relative;width:100%;height:100%;border-radius:1rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
                <iframe width="100%" height="100%"
                    src="${firstMem.sourceUrl}?autoplay=0&mute=1"
                    title="${tree.title}" frameborder="0"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen style="position:absolute;top:0;left:0;"></iframe>
                <!-- 감상 시작 CTA 오버레이 -->
                <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,0.8),transparent);padding:40px 20px 20px;color:white;text-align:center;">
                    <div style="font-size:14px;font-weight:700;margin-bottom:8px;opacity:0.9;">첫 순간부터 감상하기</div>
                    <div style="font-size:12px;opacity:0.7;">${firstMem.title}</div>
                </div>
            </div>
        `;

        // 트리 타이틀 (단계 아이콘 포함)
        previewTitle.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <span style="font-size:2rem;background:var(--surface-container-low);width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:12px;">${getTreeIcon(tree.stage)}</span>
                <div>
                    <div style="font-size:1.1rem;font-weight:800;color:var(--on-surface);line-height:1.3;">${tree.title}</div>
                    <div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px;">${tree.memoryCount}개 순간 · ${tree.timeRange}</div>
                </div>
            </div>
        `;

        // 감상 맥락 설명 (핵심 개선)
        previewDesc.innerHTML = `
            <!-- 감정 경로 시각화 -->
            <div style="background:var(--surface-container-low);padding:20px;border-radius:1rem;margin-bottom:16px;">
                <div style="font-size:11px;font-weight:800;color:var(--on-surface-variant);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:14px;">route</span>
                    어떻게 입덕했을까요?
                </div>
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;line-height:1.8;">
                    ${pathStages}
                </div>
                ${moreStages}
            </div>
            
            <!-- 감상 유도 문구 -->
            <div style="font-size:14px;color:var(--on-surface-variant);line-height:1.6;padding:0 4px;">
                <strong style="color:var(--on-surface);">${tree.theme}</strong> 아티스트와 함께한 
                <span style="color:var(--primary);font-weight:700;">${tree.memoryCount}개의 감정 순간</span>이 
                <strong>${tree.timeRange}</strong> 동안 기록되었어요.
                <div style="margin-top:12px;padding:12px;background:var(--primary-container);border-radius:0.75rem;font-size:13px;color:var(--on-primary-container);font-weight:500;display:flex;align-items:center;gap:8px;">
                    <span class="material-symbols-outlined" style="font-size:18px;">touch_app</span>
                    카드를 클릭하여 감정 경로를 따라가보세요
                </div>
            </div>
        `;

        previewMemoriesCount.textContent = tree.memoryCount;
        previewTreeDuration.textContent = tree.timeRange;

        // 감정 태그 업데이트 (더 눈에 띄게)
        previewEmotionTags.innerHTML = tree.emotionTags.slice(0, 4).map(tag =>
            `<span style="padding:8px 14px;background:var(--primary-container);border-radius:99px;font-size:13px;font-weight:700;color:var(--on-primary-container);border:1px solid var(--outline-variant);">#${tag}</span>`
        ).join('');
    };

    // ── 검색 입력 이벤트 ──
    searchInput.addEventListener('input', (e) => {
        currentQuery = e.target.value.trim();
        populateResults(getFilteredTrees());
    });

    // ── 필터 칩 클릭 이벤트 ──
    tagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            tagChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.dataset.category || chip.textContent.trim();
            populateResults(getFilteredTrees());
        });
    });

    // ── 초기 로드 ──
    populateResults(allTrees);
    if (allTrees.length > 0) {
        updatePreview(allTrees[0]);
    }
});
