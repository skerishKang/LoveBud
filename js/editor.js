document.addEventListener('DOMContentLoaded', () => {
    // ── root memory 식별 헬퍼 (UUID/ mock 호환) ──
    // 규칙: parentId === null 이거나 id === 'root' (legacy mock)
    const findRootMemory = (memories) => {
        if (!Array.isArray(memories)) return null;
        // 1순위: parentId === null (실제 root)
        const byParentNull = memories.find(m => m.parentId === null);
        if (byParentNull) return byParentNull;
        // 2순위: id === 'root' (legacy mock)
        return memories.find(m => m.id === 'root');
    };

    // root ID 반환 (없으면 'root' fallback - backward compatibility)
    const getRootId = (memories) => {
        const root = findRootMemory(memories);
        return root ? root.id : 'root';
    };

    // ── canonical root 계산 (현재 메모리 배열 기준, 항상 fresh) ──
    // 규칙: 1) parentId === null 우선, 2) id === 'root' (legacy mock), 3) 없으면 'root' fallback
    const getCanonicalRootId = (memories) => {
        const root = findRootMemory(memories);
        return root ? root.id : 'root';
    };

    // memory가 지정된 root ID와 같은지 확인
    const isRootMemory = (mem, rootId) => {
        if (!mem || !rootId) return false;
        return mem.id === rootId;
    };

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

  // ── URL에서 treeId 읽기 (최우선) ──
  const urlParams = new URLSearchParams(window.location.search);
  const urlTreeId = urlParams.get('treeId');
  console.log('[editor] URL treeId:', urlTreeId);

  // ── 트리 데이터: treeId 우선, 없으면 getFirstTree fallback ──
  let tree = null;
  let isNewTree = false;

  if (urlTreeId) {
    // treeId가 URL에 있으면: 그 트리를 직접 조회
    // 실패해도 demo tree로 fallback하지 않음 (새 트리일 수 있음)
    try {
      if (window.apiClient && window.apiClient.getTree) {
        tree = await window.apiClient.getTree(urlTreeId);
        if (tree) {
          console.log('[editor] Tree from URL loaded:', tree.id || tree.data?.id);
        }
      }
    } catch (e) {
      // treeId가 있는데 조회가 실패하면: 새 트리이거나 API 없음
      // demo tree로 fallback하지 않고 빈 트리 상태로 진행
      console.warn('[editor] Tree from URL not found or API error:', e.message);
    }

    // tree를 못 찾았으면: 빈 트리 상태로 신규 생성
    if (!tree) {
      console.log('[editor] Creating/fetching new tree for URL treeId:', urlTreeId);
      try {
        const i18n = window.t || ((k) => k);
        if (window.apiClient && window.apiClient.createTree) {
          const newTree = await window.apiClient.createTree({
            title: i18n('default_tree_title'),
            visibility: 'private'
          });
          tree = newTree;
          isNewTree = true;
          console.log('[editor] New tree created:', newTree);
        } else {
          // API.createTree 없으면: client-side ID로 임시 트리 생성
          const i18n = window.t || ((k) => k);
          tree = { id: urlTreeId, title: i18n('default_tree_title'), visibility: 'private' };
          isNewTree = true;
          console.log('[editor] Client-side tree created:', urlTreeId);
        }
      } catch (e2) {
        const i18n = window.t || ((k) => k);
        console.warn('[editor] createTree failed, using client-side tree:', e2.message);
        tree = { id: urlTreeId, title: i18n('default_tree_title'), visibility: 'private' };
        isNewTree = true;
      }
    }
  } else {
    // treeId가 URL에 없으면: 기존 getFirstTree() flow
    try {
      if (window.apiClient && window.apiClient.getFirstTree) {
        const apiTree = await window.apiClient.getFirstTree();
        if (apiTree) {
          tree = apiTree;
          console.log('[editor] API tree loaded (getFirstTree)');
        } else {
          // API는 성공했지만 트리가 없음 → 신규 사용자, 기본 트리 생성
          console.log('[editor] No tree found, creating default tree...');
          if (window.apiClient.createTree) {
            const i18n = window.t || ((k) => k);
            const newTree = await window.apiClient.createTree({
              title: i18n('default_tree_title'),
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
      const i18n = window.t || ((k) => k);
      if (e.message?.includes('401') || e.message?.includes('Authentication')) {
        showToast(i18n('need_login'), 'error');
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
  }

        // ── 메모리 데이터: API 우선, 실패 시 mock fallback ──
        let memories = [];
        const treeId = tree.id || tree.data?.id;

        // ── API 응답 정규화: snake_case → camelCase, {id, data} → flat 형태로 변환
        // 저장 계약: window.currentTreeMemories는 항상 이 정규화가 적용된 배열
        // (normalizeMemory를 먼저 정의하고 이후에 사용)
        const normalizeMemory = (mem) => {
            if (!mem) return null;
            // snake_case → camelCase
            const normalized = {
                treeId: mem.tree_id || mem.treeId,
                parentId: mem.parent_id || mem.parentId,
                sourceUrl: mem.source_url || mem.sourceUrl,
                sourceType: mem.source_type || mem.sourceType,
                emotionTags: mem.emotion_tags || mem.emotionTags,
                createdAt: mem.created_at || mem.createdAt
            };
            // 공통 필드 복사 (id, title, memo 등)
            const commonFields = ['id', 'title', 'memo', 'quote', 'timestamp', 'thumbnail', 'visibility', 'artist', 'source', 'delay', 'x', 'y'];
            commonFields.forEach(field => {
                if (mem[field] !== undefined) normalized[field] = mem[field];
            });
            // {id, data} 형태 풀기 (data 객체의 필드도 병합)
            if (mem.data && typeof mem.data === 'object') {
                Object.keys(mem.data).forEach(key => {
                    if (normalized[key] === undefined) normalized[key] = mem.data[key];
                });
            }
            return normalized;
        };

        try {
            if (window.apiClient && window.apiClient.getMemoriesByTree) {
                const apiMemories = await window.apiClient.getMemoriesByTree(treeId);
                if (Array.isArray(apiMemories)) {
                    memories = apiMemories;
                    console.log('[editor] API memories loaded:', apiMemories.length);
                }
            }
        } catch (e) {
            const i18n = window.t || ((k) => k);
            console.warn('[editor] API getMemoriesByTree failed, fallback to mock:', e.message);
            if (e.message?.includes('401') || e.message?.includes('403')) {
                showToast(i18n('data_load_fail_demo'), 'warn');
            }
        }
        if (memories.length === 0) {
            memories = typeof getMemoriesByTree === 'function' ? getMemoriesByTree(treeId) : [];
        }
        // 저장 계약: 항상 정규화된 형태로 저장
        window.currentTreeMemories = memories.map(normalizeMemory).filter(Boolean);

        // ── root 초기 선택 안정화 ──
        const createInitialMemory = () => {
            const memories = treeMemories();
            // canonical root 찾기: 단일 root 기준 (parentId === null 우선, 그 다음 id === 'root')
            const rootMem = findRootMemory(memories);
            if (rootMem) return rootMem;
            if (memories.length > 0) return memories[0];
            // API/render에 root가 없을 때를 위한 기본 데이터
            const i18n = window.t || ((k) => k);
            return {
                id: canonicalRootId,
                treeId: treeId,
                title: i18n('first_memory'),
                memo: i18n('no_memory_yet'),
                timestamp: new Date().toISOString().slice(0,10).replace(/-/g,'.'),
                thumbnail: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect fill="%23f5f5f5" width="120" height="90"/><text x="60" y="50" text-anchor="middle" fill="%23999" font-size="12">No Memory</text></svg>',
                emotionTags: [],
                parentId: null
            };
        };

        // treeMemories 함수 먼저 정의 (TDZ 방지)
        const treeMemories = () => (window.currentTreeMemories || []).map(normalizeMemory);

        // canonical root ID 계산 (세션 기준 고정값)
        // 이 값은 editor 세션 동안 일관되게 사용됨 (새 메모리 추가로 root가 바뀌지 않음)
        const canonicalRootId = getCanonicalRootId(treeMemories());
        let selectedNodeId = canonicalRootId;

        // ── 배치 상수 ──
        const ROOT_X = 400, ROOT_Y = 300;
const RADIUS_L1 = 320; // L1 반경 (280→320) - 노드 겹침 방지
const RADIUS_L2 = 240; // L2 반경 (200→240) - 노드 겹침 방지
        const NODE_WIDTH = 80;  // 노드 카드 너비 (px)
        const MIN_ANGLE_GAP = 35; // 최소 각도 간격 (도) - 겹침 방지

        const FIXED_ANGLES = {
            v1: -60, v2: -130, v3: 10,
            m2: 130, m3: -170, m4: 70
        };

        // ── 각도 분산 헬퍼 ──
        // sibling 수에 따라 균등하게 각도 분배, 최소 간격 보장
        const distributeAngles = (count, baseAngle = -90) => {
            if (count <= 0) return [baseAngle];
            const angles = [];
            const totalSpread = Math.min(360, count * MIN_ANGLE_GAP * 1.5); // 분산 범위
            const startAngle = baseAngle - totalSpread / 2;
            for (let i = 0; i < count; i++) {
                const ratio = count === 1 ? 0.5 : i / (count - 1);
                angles.push(startAngle + totalSpread * ratio);
            }
            return angles;
        };

        const calcPosition = (mem, visited = new Set()) => {
            // canonical root 기준으로 위치 계산
            if (isRootMemory(mem, canonicalRootId)) return { x: ROOT_X, y: ROOT_Y };

            // 순환 참조 방지
            if (visited.has(mem.id)) {
                console.warn(`Cycle detected at memory ${mem.id}, falling back to root`);
                return { x: ROOT_X, y: ROOT_Y };
            }
            visited.add(mem.id);

            const parentId = mem.parentId || canonicalRootId;

            // 자기참조 방지
            if (parentId === mem.id) {
                console.warn(`Self-reference detected for ${mem.id}, using root as parent`);
                return { x: ROOT_X, y: ROOT_Y };
            }

            // siblings: canonical root는 제외, parentId가 같은 메모리들
            const siblings = treeMemories().filter(m =>
                m.parentId === parentId && !isRootMemory(m, canonicalRootId)
            );
            const idx = siblings.findIndex(m => m.id === mem.id); // indexOf 대신 findIndex 사용 (객체 비교 안정성)
            const count = siblings.length;

            if (parentId === canonicalRootId) {
                // root 직속: 고정 각도 우선, 없으면 분산
                let angle;
                if (FIXED_ANGLES[mem.id] !== undefined) {
                    angle = FIXED_ANGLES[mem.id];
                } else if (count > 0) {
                    const angles = distributeAngles(count);
                    angle = angles[idx] !== undefined ? angles[idx] : angles[0];
                } else {
                    angle = -90;
                }
                return {
                    x: ROOT_X + RADIUS_L1 * Math.cos(angle * Math.PI / 180),
                    y: ROOT_Y + RADIUS_L1 * Math.sin(angle * Math.PI / 180)
                };
            }

            // L2: 부모 기준 분산
            const parent = treeMemories().find(m => m.id === parentId);
            const parentPos = parent ? calcPosition(parent, visited) : { x: ROOT_X, y: ROOT_Y };
            
            // sibling이 많으면 각도 분산, 최소 간격 보장
            let angle;
            if (count > 0) {
                const angles = distributeAngles(count, 0); // 0도 기준 분산
                angle = angles[idx] !== undefined ? angles[idx] : (idx / count) * 360;
            } else {
                angle = 0;
            }
            
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
            // canonical root detection
            if (isRootMemory(node, canonicalRootId)) {
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
                if (isRootMemory(node, canonicalRootId)) return; // canonical root만 skip
                drawNode(node);
                const parentId = node.parentId || canonicalRootId;
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
const i18nToast = window.t || ((k) => k);
if (!url) {
    showToast(i18nToast('enter_youtube'), 'warn');
    return;
  }

  const match = url.match(/(?:v=|\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
  if (!match) {
    showToast(i18nToast('invalid_youtube'), 'error');
    return;
  }

            const videoId = match[1];
            const today = new Date();
            const i18n = window.t || ((k) => k);
            const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;

            // 기본 제목 자동 생성 (입력 없을 시)
            const title = titleInput.value.trim() || `${i18n('new_memory')} ${dateStr}`;

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
                const i18n = window.t || ((k) => k);
                console.warn('[editor] API createMemory failed, fallback to mock:', e.message);
                if (e.message?.includes('401') || e.message?.includes('403')) {
                    showToast(i18n('no_permission_local'), 'warn');
                } else if (e.message?.includes('400')) {
                    showToast(i18n('check_input'), 'error');
                } else {
                    showToast(i18n('server_fail_local'), 'warn');
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
  // 저장 계약: window.currentTreeMemories는 항상 normalizeMemory가 적용된 메모리 배열
  const normalizedNew = normalizeMemory(createdMemory);
  try {
    const refreshed = await window.apiClient.getMemoriesByTree(treeId);
    if (Array.isArray(refreshed)) {
      // 재조회 성공 시 정규화된 형태로 저장 ({id,data}+snake_case → flat+camelCase)
      window.currentTreeMemories = refreshed.map(normalizeMemory);
    } else {
      // 재조회 실패 시 로컬에 추가 (중복 방지, 정규화 적용)
      const exists = window.currentTreeMemories.some(m => m.id === normalizedNew.id);
      if (!exists && normalizedNew) window.currentTreeMemories.push(normalizedNew);
    }
  } catch (e) {
    // API 실패 시 로컬에 추가 (중복 방지, 정규화 적용)
    const exists = window.currentTreeMemories.some(m => m.id === normalizedNew.id);
    if (!exists && normalizedNew) window.currentTreeMemories.push(normalizedNew);
  }

            // ── UI 렌더링: API 응답 정규화 후 렌더링 ──
            // snake_case → camelCase, {id, data} 형태 정규화
            const normalizedMemory = normalizeMemory(createdMemory);
            if (!normalizedMemory) {
                console.error('[editor] Memory normalization failed');
                return;
            }

            drawNode(normalizedMemory);
            const effectiveParentId = normalizedMemory.parentId || canonicalRootId;
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
    // 완화: Firebase SDK 지연 또는 unavailable 시에도 cached auth가 있으면 진입 허용
    // 보안: cached auth가 있어도 Firebase 재검증은后台에서 진행
    
    function tryStartEditor(forceStart) {
        // Check for confirmed auth cache
        var cachedUser = null;
        try {
            if (localStorage.getItem('lovebud_auth_confirmed') === 'true') {
                var raw = localStorage.getItem('lovebud_auth_cache');
                if (raw && raw !== 'null') {
                    cachedUser = JSON.parse(raw);
                }
            }
        } catch (e) {}
        
        var hasFirebase = typeof firebase !== 'undefined' && firebase.auth && firebase.apps && firebase.apps.length;
        
        if (hasFirebase) {
            // Firebase available - use standard auth flow
            var unsubscribe = firebase.auth().onAuthStateChanged(function(user) {
                unsubscribe(); // One-shot
                if (!user && !forceStart && (!cachedUser || !cachedUser.uid)) {
                    window.location.href = 'login.html?redirect=editor.html';
                    return;
                }
                // Proceed regardless - cached auth or real user
                startEditor();
            });
        } else {
            // Firebase not available - rely on cached auth
            if (!forceStart && (!cachedUser || !cachedUser.uid)) {
                window.location.href = 'login.html?redirect=editor.html';
                return;
            }
            // Has cached auth - proceed (will try Firebase again in background if available later)
            console.log('[editor] Firebase unavailable, using cached auth');
            
            // Try to wait briefly for Firebase to initialize, but don't block
            setTimeout(function() {
                if (typeof firebase !== 'undefined' && firebase.auth && firebase.apps && firebase.apps.length) {
                    // Firebase now available - recheck auth
                    firebase.auth().onAuthStateChanged(function(user) {
                        if (!user) {
                            console.log('[editor] Firebase recheck: no user, but cached auth present');
                        }
                        // Don't redirect - we already have cached auth, proceed with editor
                    });
                }
            }, 1000);
            
            startEditor();
        }
    }
    
    // Start with force flag for direct access scenarios
    tryStartEditor(false);
});