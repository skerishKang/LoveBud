document.addEventListener('DOMContentLoaded', () => {
    // ── 인증 가드: onAuthReady 콜백 기반 ──
    // ── 사용자 알림용 토스트 유틸리티 ──
    const showToast = (message, type = 'info') => {
        const existing = document.getElementById('editorToast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'editorToast';
        toast.style.cssText = `
            position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
            background: ${type === 'error' ? '#c62828' : type === 'warn' ? '#ef6c00' : '#2e7d32'};
            color: white; padding: 12px 24px; border-radius: 8px;
            font-size: 14px; font-weight: 500; z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: fadeInUp 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    const startEditor = async () => {
        const canvas = document.getElementById('canvasArea');
        const svg = document.getElementById('canvasSvg');
        const detailPanel = document.getElementById('detailPanel');
        const addBtn = document.getElementById('addMemoryBtn');

        // ── 트리 데이터: API 우선, 없으면 생성, 실패 시 mock fallback ──
        let tree = null;
        let isNewTree = false;
        try {
            if (window.apiClient && window.apiClient.getFirstTree) {
                const apiTree = await window.apiClient.getFirstTree();
                if (apiTree) {
                    tree = apiTree;
                    console.log('[editor] API tree loaded');
                } else {
                    // API는 성공했지만 트리가 없음 → 신규 사용자, 기본 트리 생성
                    console.log('[editor] No tree found, creating default tree...');
                    if (window.apiClient.createTree) {
                        const newTree = await window.apiClient.createTree({
                            title: '나의 첫 러브트리',
                            visibility: 'private'
                        });
                        tree = newTree;
                        isNewTree = true;
                        console.log('[editor] Default tree created:', newTree);
                    }
                }
            }
        } catch (e) {
            console.warn('[editor] API tree failed, fallback to mock:', e.message);
            if (e.message?.includes('401') || e.message?.includes('Authentication')) {
                showToast('로그인이 필요합니다. 로그인 페이지로 이동합니다.', 'error');
                setTimeout(() => window.location.href = 'login.html?redirect=editor.html', 2000);
                return;
            }
        }
        // API 실패 시에만 mock fallback
        if (!tree) {
            const trees = typeof getTrees === 'function' ? getTrees() : [];
            tree = trees[0];
        }
        if (!tree) {
            console.warn('Tree data not found.');
            return;
        }

        // ── 메모리 데이터: API 우선, 실패 시 mock fallback ──
        let memories = [];
        const treeId = tree.id || tree.data?.id;
        try {
            if (window.apiClient && window.apiClient.getMemoriesByTree) {
                const apiMemories = await window.apiClient.getMemoriesByTree(treeId);
                if (Array.isArray(apiMemories)) {
                    memories = apiMemories;
                    console.log('[editor] API memories loaded:', apiMemories.length);
                }
            }
        } catch (e) {
            console.warn('[editor] API getMemoriesByTree failed, fallback to mock:', e.message);
            if (e.message?.includes('401') || e.message?.includes('403')) {
                showToast('데이터를 불러올 수 없습니다. 데모 모드로 전환됩니다.', 'warn');
            }
        }
        if (memories.length === 0) {
            memories = typeof getMemoriesByTree === 'function' ? getMemoriesByTree(treeId) : [];
        }
        // 전역 접근 가능하게 설정 (기존 코드 호환)
        window.currentTreeMemories = memories;

        // ── API 응답 정규화: snake_case → camelCase, {id, data} 형태 변환 ──
        const normalizeMemory = (mem) => {
            if (!mem) return null;
            // snake_case → camelCase
            const normalized = {
                ...mem,
                treeId: mem.tree_id || mem.treeId,
                parentId: mem.parent_id || mem.parentId,
                sourceUrl: mem.source_url || mem.sourceUrl,
                sourceType: mem.source_type || mem.sourceType,
                emotionTags: mem.emotion_tags || mem.emotionTags,
                createdAt: mem.created_at || mem.createdAt
            };
            // {id, data} 형태 풀기
            if (mem.data && typeof mem.data === 'object') {
                Object.assign(normalized, mem.data);
            }
            return normalized;
        };

        // ── root 초기 선택 안정화 ──
        const createInitialMemory = () => {
            const memories = treeMemories();
            // root가 있으면 root, 없으면 첫 번째 메모리, 없으면 더미 root
            const rootMem = memories.find(m => m.id === 'root');
            if (rootMem) return rootMem;
            if (memories.length > 0) return memories[0];
            // API/render에 root가 없을 때를 위한 기본 데이터
            return {
                id: 'root',
                treeId: treeId,
                title: '첫 번째 기억',
                memo: '아직 등록된 기억이 없습니다. "영상 추가" 버튼을 클릭하여 첫 번째 추억을 기록해보세요.',
                timestamp: new Date().toISOString().slice(0,10).replace(/-/g,'.'),
                thumbnail: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect fill="%23f5f5f5" width="120" height="90"/><text x="60" y="50" text-anchor="middle" fill="%23999" font-size="12">No Memory</text></svg>',
                emotionTags: [],
                parentId: null
            };
        };

        let selectedNodeId = 'root';

        const treeMemories = () => (window.currentTreeMemories || []).map(normalizeMemory);

        // ── 배치 상수 ──
        const ROOT_X = 400, ROOT_Y = 300;
        const RADIUS_L1 = 250;
        const RADIUS_L2 = 150;

        const FIXED_ANGLES = {
            v1: -60, v2: -130, v3: 10,
            m2: 130, m3: -170, m4: 70
        };

        const calcPosition = (mem, visited = new Set()) => {
            if (mem.id === 'root') return { x: ROOT_X, y: ROOT_Y };

            // 순환 참조 방지
            if (visited.has(mem.id)) {
                console.warn(`Cycle detected at memory ${mem.id}, falling back to root`);
                return { x: ROOT_X, y: ROOT_Y };
            }
            visited.add(mem.id);

            const parentId = mem.parentId || 'root';

            // 자기참조 방지
            if (parentId === mem.id) {
                console.warn(`Self-reference detected for ${mem.id}, using root as parent`);
                return { x: ROOT_X, y: ROOT_Y };
            }

            const siblings = treeMemories().filter(m => m.parentId === parentId && m.id !== 'root');
            const idx = siblings.indexOf(mem);
            const count = siblings.length;

            if (parentId === 'root') {
                let angle = (FIXED_ANGLES[mem.id] !== undefined)
                    ? FIXED_ANGLES[mem.id]
                    : (count > 0 ? (idx / count) * 360 - 90 : -90);
                return {
                    x: ROOT_X + RADIUS_L1 * Math.cos(angle * Math.PI / 180),
                    y: ROOT_Y + RADIUS_L1 * Math.sin(angle * Math.PI / 180)
                };
            }

            const parent = treeMemories().find(m => m.id === parentId);
            const parentPos = parent ? calcPosition(parent, visited) : { x: ROOT_X, y: ROOT_Y };
            const angle = count > 0 ? (idx / count) * 360 : 0;
            return {
                x: parentPos.x + RADIUS_L2 * Math.cos(angle * Math.PI / 180),
                y: parentPos.y + RADIUS_L2 * Math.sin(angle * Math.PI / 180)
            };
        };

        const nextMemoryId = () => {
            let max = 0;
            treeMemories().forEach(m => {
                const match = m.id.match(/^m(\d+)$/);
                if (match) max = Math.max(max, parseInt(match[1]));
            });
            return 'm' + (max + 1);
        };

        const updateDetailPanel = (data) => {
            detailPanel.querySelector('h3').textContent = data.title;
            const imgEl = detailPanel.querySelector('.detail-video img');
            if (imgEl) imgEl.src = data.thumbnail;
            const dateEl = document.getElementById('detailDateText');
            if (dateEl) dateEl.textContent = data.timestamp;
            const tagsContainer = detailPanel.querySelector('.tags-container');
            if (tagsContainer && data.emotionTags) {
                tagsContainer.innerHTML = data.emotionTags.map(tag =>
                    `<span class="tag tag-primary">${tag}</span>`
                ).join('');
            }
            const noteEl = detailPanel.querySelector('.diary-note');
            if (noteEl) noteEl.textContent = data.memo || '';
        };

        const selectNode = (el, data) => {
            selectedNodeId = data.id;
            document.querySelectorAll('.memory-node').forEach(n => n.classList.remove('selected'));
            el.classList.add('selected');
            updateDetailPanel(data);
        };

        const selectNodeById = (id) => {
            const node = treeMemories().find(m => m.id === id);
            if (!node) return;
            selectedNodeId = id;
            if (id === 'root') {
                document.querySelectorAll('.memory-node').forEach(n => n.classList.remove('selected'));
                updateDetailPanel(node);
                return;
            }
            const el = document.querySelector(`.memory-node[data-memory-id="${id}"]`);
            if (el) selectNode(el, node);
        };

        const drawRoot = () => {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", ROOT_X);
            circle.setAttribute("cy", ROOT_Y);
            circle.setAttribute("r", "10");
            circle.setAttribute("fill", "var(--primary)");
            circle.setAttribute("stroke", "white");
            circle.setAttribute("stroke-width", "3");
            svg.appendChild(circle);
        };

        const drawBranch = (startPos, endPos) => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const cp1x = startPos.x + (endPos.x - startPos.x) / 2;
            const d = `M ${startPos.x},${startPos.y} Q ${cp1x},${startPos.y} ${endPos.x},${endPos.y}`;
            path.setAttribute("d", d);
            path.setAttribute("class", "branch-line");
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", "var(--secondary)");
            path.setAttribute("stroke-width", "2");
            path.setAttribute("opacity", "0.5");
            svg.appendChild(path);
        };

        const drawNode = (mem) => {
            const pos = calcPosition(mem);
            const nodeEl = document.createElement('div');
            nodeEl.className = 'memory-node floating-node';
            nodeEl.dataset.memoryId = mem.id;
            nodeEl.style.left = `${pos.x - 40}px`;
            nodeEl.style.top = `${pos.y - 40}px`;
            nodeEl.style.animationDelay = mem.delay || '0s';
            nodeEl.innerHTML = `
                <div class="node-card">
                    <div class="node-img-wrapper">
                        <img src="${mem.thumbnail}" alt="${mem.title}">
                    </div>
                </div>
                <div class="node-info-label">
                    <p class="node-title">${mem.title}</p>
                    <p class="node-date">${mem.timestamp}</p>
                </div>
            `;
            nodeEl.addEventListener('click', () => selectNode(nodeEl, mem));
            canvas.appendChild(nodeEl);
        };

        const initCanvas = () => {
            drawRoot();
            treeMemories().forEach(node => {
                if (node.id === 'root') return; // root는 skip
                drawNode(node);
                const parentId = node.parentId || 'root';
                const parent = treeMemories().find(m => m.id === parentId);
                if (parent) drawBranch(calcPosition(parent), calcPosition(node));
            });
            // root 초기 선택: 안정화된 함수를 사용
            const initialMem = createInitialMemory();
            if (initialMem) {
                updateDetailPanel(initialMem);
            }
        };

        // ── 폼 상태 추적 ──
        let isFormOpen = false;
        let escHandler = null;
        let outsideClickHandler = null;

        // ── 새 기억 추가 폼 제어 ──
        const addMemoryForm = document.getElementById('addMemoryForm');
        const urlInput = document.getElementById('memoryUrlInput');
        const titleInput = document.getElementById('memoryTitleInput');
        const memoInput = document.getElementById('memoryMemoInput');
        const canvasArea = document.getElementById('canvasArea');
        const cancelBtn = document.getElementById('cancelAddMemory');
        const confirmBtn = document.getElementById('confirmAddMemory');

        // 포커스 트랩: 폼 내 순환 포커스 유지
        const formInputs = [urlInput, titleInput, memoInput];
        const focusTrap = (e) => {
            if (!isFormOpen) return;
            if (e.key !== 'Tab') return;
            
            const focused = document.activeElement;
            const lastInput = formInputs[formInputs.length - 1];
            const firstInput = formInputs[0];
            
            if (e.shiftKey && focused === firstInput) {
                e.preventDefault();
                lastInput.focus();
            } else if (!e.shiftKey && focused === lastInput) {
                e.preventDefault();
                firstInput.focus();
            }
        };

        const showAddMemoryForm = () => {
            urlInput.value = '';
            titleInput.value = '';
            memoInput.value = '';
            addMemoryForm.style.display = 'block';
            isFormOpen = true;
            
            // 포커스 트랩 활성화
            document.addEventListener('keydown', focusTrap);
            urlInput.focus();

            // Esc 키 핸들러
            escHandler = (e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    hideAddMemoryForm();
                }
            };
            document.addEventListener('keydown', escHandler);

            // 외부 클릭 핸들러 (캡처링으로 폼 외부 클릭 감지)
            outsideClickHandler = (e) => {
                const target = e.target;
                // 폼 내부 클릭은 무시
                if (addMemoryForm.contains(target)) return;
                // 버튼 클릭 무시
                if (target.closest('#addMemoryBtn')) return;
                hideAddMemoryForm();
            };
            // 지연 등록: 현재 클릭 이벤트 방해 방지
            setTimeout(() => {
                document.addEventListener('click', outsideClickHandler, true);
            }, 0);
        };

        const hideAddMemoryForm = () => {
            addMemoryForm.style.display = 'none';
            isFormOpen = false;
            
            // 이벤트 핸들러 정리
            document.removeEventListener('keydown', focusTrap);
            if (escHandler) {
                document.removeEventListener('keydown', escHandler);
                escHandler = null;
            }
            if (outsideClickHandler) {
                document.removeEventListener('click', outsideClickHandler, true);
                outsideClickHandler = null;
            }
        };

        const addMemoryFromForm = async () => {
            const url = urlInput.value.trim();
            if (!url) {
                alert('YouTube 링크를 입력해주세요.');
                return;
            }

            const match = url.match(/(?:v=|\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
            if (!match) {
                alert('유효한 YouTube 링크가 아닙니다.\n예: https://www.youtube.com/watch?v=dQw4w9WgXcQ');
                return;
            }

            const videoId = match[1];
            const today = new Date();
            const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;

            // 기본 제목 자동 생성 (입력 없을 시)
            const title = titleInput.value.trim() || `새로운 기억 ${dateStr}`;

            const newMemoryData = {
                treeId: treeId,
                title: title,
                memo: memoInput.value.trim() || '',
                timestamp: dateStr,
                sourceUrl: `https://www.youtube.com/embed/${videoId}`,
                sourceType: 'youtube',
                emotionTags: ['기록'],
                parentId: selectedNodeId,
                thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                artist: '',
                source: 'YouTube'
            };

            hideAddMemoryForm();

            // ── API 우선 생성 시도 ──
            let createdMemory = null;
            let useApi = false;
            try {
                if (window.apiClient && window.apiClient.createMemory) {
                    createdMemory = await window.apiClient.createMemory(newMemoryData);
                    useApi = true;
                    console.log('[editor] API createMemory success:', createdMemory);
                }
            } catch (e) {
                console.warn('[editor] API createMemory failed, fallback to mock:', e.message);
                if (e.message?.includes('401') || e.message?.includes('403')) {
                    showToast('저장 권한이 없습니다. 로컬에만 추가됩니다.', 'warn');
                } else if (e.message?.includes('400')) {
                    showToast('입력값을 확인해주세요.', 'error');
                } else {
                    showToast('서버 연결 실패. 로컬에만 추가됩니다.', 'warn');
                }
            }

            // API 실패 시 mock fallback - 로컬에만 추가
            if (!createdMemory) {
                createdMemory = {
                    id: nextMemoryId(),
                    ...newMemoryData,
                    createdAt: dateStr,
                    delay: '0.5s'
                };
            }

            // ── createMemory 후 갱신: 재조회 우선, 실패 시 로컬 추가 ──
            try {
                const refreshed = await window.apiClient.getMemoriesByTree(treeId);
                if (Array.isArray(refreshed)) {
                    window.currentTreeMemories = refreshed;
                } else {
                    // 재조회 실패 시 로컬에 추가 (중복 방지)
                    const exists = window.currentTreeMemories.some(m => m.id === createdMemory.id);
                    if (!exists) window.currentTreeMemories.push(createdMemory);
                }
            } catch (e) {
                // API 실패 시 로컬에 추가 (중복 방지)
                const exists = window.currentTreeMemories.some(m => m.id === createdMemory.id);
                if (!exists) window.currentTreeMemories.push(createdMemory);
            }

            // ── UI 렌더링: API 응답 정규화 후 렌더링 ──
            // snake_case → camelCase, {id, data} 형태 정규화
            const normalizedMemory = normalizeMemory(createdMemory);
            if (!normalizedMemory) {
                console.error('[editor] Memory normalization failed');
                return;
            }

            drawNode(normalizedMemory);
            const effectiveParentId = normalizedMemory.parentId || 'root';
            const parent = treeMemories().find(m => m.id === effectiveParentId);
            if (parent) drawBranch(calcPosition(parent), calcPosition(normalizedMemory));

            const el = document.querySelector(`.memory-node[data-memory-id="${normalizedMemory.id}"]`);
            if (el) {
                selectNode(el, normalizedMemory);
                
                // 새 노드 피드백: 선택 강조 + 오토스크롤
                el.classList.add('new-node-highlight');
                setTimeout(() => el.classList.remove('new-node-highlight'), 2000);
                
                // 오토스크롤: 노드 위치로 smooth scroll
                const nodeRect = el.getBoundingClientRect();
                const canvasRect = canvasArea.getBoundingClientRect();
                const scrollX = el.offsetLeft - canvasRect.width / 2 + nodeRect.width / 2;
                const scrollY = el.offsetTop - canvasRect.height / 2 + nodeRect.height / 2;
                canvasArea.scrollTo({
                    left: Math.max(0, scrollX),
                    top: Math.max(0, scrollY),
                    behavior: 'smooth'
                });
            }
        };

        // 폼 버튼 이벤트 리스너
        if (addBtn) addBtn.addEventListener('click', showAddMemoryForm);
        if (cancelBtn) cancelBtn.addEventListener('click', hideAddMemoryForm);
        if (confirmBtn) confirmBtn.addEventListener('click', addMemoryFromForm);

        // Enter 키로 폼 제출
        if (urlInput) {
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') titleInput.focus();
            });
        }
        if (titleInput) {
            titleInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') memoInput.focus();
            });
        }
        if (memoInput) {
            memoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    addMemoryFromForm();
                }
            });
        }

        // 미구현 버튼 숨김 처리
        const hideUnimplementedButtons = () => {
            const moreBtn = detailPanel.querySelector('.icon-btn');
            const footerBtn = detailPanel.querySelector('.panel-footer');
            if (moreBtn) moreBtn.style.display = 'none';
            if (footerBtn) footerBtn.style.display = 'none';
        };
        hideUnimplementedButtons();

        initCanvas();
        console.log('[editor] Ready — tree:', treeId, 'memories:', treeMemories().length);
    };

    // ── 인증 상태에 따라 시작 ──
    // Use onAuthStateChanged directly (not onAuthReady) to avoid race conditions
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.apps && firebase.apps.length) {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            unsubscribe(); // One-shot: only need the first resolution
            if (!user) {
                window.location.href = 'login.html?redirect=editor.html';
                return;
            }
            startEditor();
        });
    } else {
        // Firebase unavailable (offline/dev) — skip guard
        startEditor();
    }
});