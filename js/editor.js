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
  
  // ── 캐시 키 설정 ──
  const cache = window.LoveBudCache;
  const TREE_CACHE_KEY = 'tree_' + (urlTreeId || 'default');
const MEMORIES_CACHE_KEY = 'memories_' + (urlTreeId || 'default');
 // 로컬 폴백 모드 추적 (상세 패널에 표시용)
 let isLocalSaveMode = false;

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
        var basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
        setTimeout(() => window.location.href = basePath + 'login.html?redirect=' + basePath + 'editor.html', 2000);
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

        // ── memories 캐시 우선 로딩 ──
        let memories = [];
        
        // 1. 캐시된 memories 먼저 확인
        const cachedMemories = cache ? cache.get(MEMORIES_CACHE_KEY) : null;
        if (cachedMemories && Array.isArray(cachedMemories)) {
            console.log('[editor] Using cached memories:', cachedMemories.length);
            memories = cachedMemories;
            window.currentTreeMemories = memories.map(normalizeMemory).filter(Boolean);
            // 캐시 데이터로 먼저 UI 그리기 (빠른 첫 paint)
            initCanvas();
        }
        
        // 2. Background에서 API로 최신 데이터 가져오기
        try {
            if (window.apiClient && window.apiClient.getMemoriesByTree) {
                const apiMemories = await window.apiClient.getMemoriesByTree(treeId);
                if (Array.isArray(apiMemories)) {
                    memories = apiMemories;
                    console.log('[editor] API memories loaded:', apiMemories.length);
                    // 캐시 업데이트
                    if (cache) {
                        cache.set(MEMORIES_CACHE_KEY, memories, 2 * 60 * 1000); // 2분 TTL
                    }
                }
            }
        } catch (e) {
            const i18n = window.t || ((k) => k);
            console.warn('[editor] API getMemoriesByTree failed:', e.message);
            if (e.message?.includes('401') || e.message?.includes('403')) {
                showToast(i18n('data_load_fail_demo'), 'warn');
            }
            // API 실패해도 캐시가 있으면 그대로 사용
        }
        
        if (memories.length === 0 && !cachedMemories) {
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
        const ROOT_X = 400, ROOT_Y = 350; // 300→350: 첫 노드가 화면 위로 벗어나는 문제 완화
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

const nextMemoryId = () => {
    let max = 0;
    treeMemories().forEach(m => {
        const match = m.id.match(/^m(\d+)$/);
        if (match) max = Math.max(max, parseInt(match[1]));
    });
    return 'm' + (max + 1);
};

const updateDetailPanel = (data) => {
    // 현재 트리 정보 가져오기
    const currentTree = window.currentTreeData || {};
    const treeId = currentTree.id || urlTreeId;

// 헤더: 제목 + 로컬 저장 배지 + detail 페이지 링크
 const headerEl = detailPanel.querySelector('h3');
 if (headerEl) {
 const localBadge = isLocalSaveMode
 ? '<span style="font-size:11px;padding:2px 8px;background:rgba(239,108,0,0.1);color:#ef6c00;border-radius:99px;font-weight:600;margin-left:8px;">로컬 저장</span>'
 : '';
 var basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
 headerEl.innerHTML = `
 <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
 <span style="font-size:1.1rem;line-height:1.3;">${data.title}${localBadge}</span>
 <a href="${basePath}detail.html?id=${data.id}&tree=${treeId}&from=editor"
 title="전체 화면으로 감상하기"
 style="display:flex;align-items:center;gap:4px;padding:6px 12px;background:var(--primary-container);color:var(--on-primary-container);border-radius:99px;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap;">
 <span class="material-symbols-outlined" style="font-size:14px;">open_in_new</span>
 전체 보기
 </a>
 </div>
 `;
            }

            // 썸네일 업데이트
            const imgEl = detailPanel.querySelector('.detail-video img');
            if (imgEl) imgEl.src = data.thumbnail;

            // 날짜 업데이트
            const dateEl = document.getElementById('detailDateText');
            if (dateEl) dateEl.textContent = data.timestamp;

            // 감정 태그 업데이트
            const tagsContainer = detailPanel.querySelector('.tags-container');
            if (tagsContainer && data.emotionTags) {
                tagsContainer.innerHTML = data.emotionTags.map(tag =>
                    `<span class="tag tag-primary">${tag}</span>`
                ).join('');
            }

            // 메모 업데이트 + 감정 경로 힌트
            const noteEl = detailPanel.querySelector('.diary-note');
            if (noteEl) {
                const parentInfo = data.parentId
                    ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--outline-variant);font-size:12px;color:var(--on-surface-variant);">
                         <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px;">account_tree</span>
                         이 순간은 감정 경로의 한 지점입니다
                       </div>`
                    : '<div style="margin-top:12px;font-size:12px;color:var(--primary);"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px;">star</span> 러브트리의 시작점</div>';
                noteEl.innerHTML = `<div style="line-height:1.6;">${data.memo || ''}</div>${parentInfo}`;
            }
        };

        // 전역에 노출 (메모리 추가 후 업데이트용)
        window.updateDetailPanel = updateDetailPanel;

        // 현재 편집 중인 메모리 데이터 저장
        let currentEditingMemory = null;
        let isEditMode = false;

        const enterEditMode = () => {
            if (!currentEditingMemory) return;
            isEditMode = true;

            const viewMode = document.getElementById('detailViewMode');
            const editMode = document.getElementById('detailEditMode');

            if (viewMode) viewMode.style.display = 'none';
            if (editMode) editMode.style.display = 'block';

            const titleInput = document.getElementById('editTitleInput');
            const memoInput = document.getElementById('editMemoInput');
            const tagsInput = document.getElementById('editTagsInput');

            if (titleInput) titleInput.value = currentEditingMemory.title || '';
            if (memoInput) memoInput.value = currentEditingMemory.memo || '';
            if (tagsInput) tagsInput.value = (currentEditingMemory.emotionTags || []).join(', ');
        };

        const exitEditMode = () => {
            isEditMode = false;
            const viewMode = document.getElementById('detailViewMode');
            const editMode = document.getElementById('detailEditMode');
            if (viewMode) viewMode.style.display = 'block';
            if (editMode) editMode.style.display = 'none';
        };

        const saveMemoryEdit = async () => {
            if (!currentEditingMemory) return;

            const i18n = window.t || ((k) => k);
            const titleInput = document.getElementById('editTitleInput');
            const memoInput = document.getElementById('editMemoInput');
            const tagsInput = document.getElementById('editTagsInput');

            const payload = {
                title: titleInput ? titleInput.value.trim() : currentEditingMemory.title,
                memo: memoInput ? memoInput.value.trim() : currentEditingMemory.memo,
                emotionTags: tagsInput ? tagsInput.value.split(',').map(t => t.trim()).filter(t => t) : currentEditingMemory.emotionTags
            };

            try {
                if (window.apiClient && typeof window.apiClient.updateMemory === 'function') {
                    await window.apiClient.updateMemory(currentEditingMemory.id, payload);

                    const memIndex = window.currentTreeMemories.findIndex(m => m.id === currentEditingMemory.id);
                    if (memIndex >= 0) {
                        window.currentTreeMemories[memIndex] = { ...window.currentTreeMemories[memIndex], ...payload };
                    }

                    currentEditingMemory = { ...currentEditingMemory, ...payload };
                    exitEditMode();
                    updateDetailPanel(currentEditingMemory);

                    const nodeEl = document.querySelector(`.memory-node[data-memory-id="${currentEditingMemory.id}"]`);
                    if (nodeEl) {
                        const titleEl = nodeEl.querySelector('.node-title');
                        if (titleEl) titleEl.textContent = payload.title;
                    }

                    showToast(i18n('memory_updated'), 'success');
                } else {
                    throw new Error('updateMemory not available');
                }
            } catch (error) {
                console.error('[editor] Failed to update memory:', error);
                showToast(i18n('update_failed'), 'error');
            }
        };

        const deleteMemory = async () => {
            if (!currentEditingMemory) return;

            const i18n = window.t || ((k) => k);

            if (!confirm(i18n('delete_confirm'))) {
                return;
            }

            try {
                if (window.apiClient && typeof window.apiClient.deleteMemory === 'function') {
                    await window.apiClient.deleteMemory(currentEditingMemory.id);

                    window.currentTreeMemories = window.currentTreeMemories.filter(m => m.id !== currentEditingMemory.id);

                    const nodeEl = document.querySelector(`.memory-node[data-memory-id="${currentEditingMemory.id}"]`);
                    if (nodeEl) {
                        const branches = svg.querySelectorAll('.branch-line');
                        const nodePos = calcPosition(currentEditingMemory);
                        branches.forEach(branch => {
                            const d = branch.getAttribute('d');
                            if (d && d.includes(`${nodePos.x},${nodePos.y}`)) {
                                branch.remove();
                            }
                        });
                        nodeEl.remove();
                    }

                    currentEditingMemory = null;
                    exitEditMode();

                    const rootMem = findRootMemory(window.currentTreeMemories);
                    if (rootMem) {
                        selectedNodeId = rootMem.id;
                        updateDetailPanel(rootMem);
                    } else if (window.currentTreeMemories.length > 0) {
                        selectedNodeId = window.currentTreeMemories[0].id;
                        updateDetailPanel(window.currentTreeMemories[0]);
                    } else {
                        detailPanel.querySelector('h3').innerHTML = '순간 상세';
                        const imgEl = detailPanel.querySelector('.detail-video img');
                        if (imgEl) imgEl.src = '';
                    }

                    showToast(i18n('memory_deleted'), 'success');
                } else {
                    throw new Error('deleteMemory not available');
                }
            } catch (error) {
                console.error('[editor] Failed to delete memory:', error);
                showToast(i18n('delete_failed'), 'error');
            }
        };

        const selectNode = (el, data) => {
            selectedNodeId = data.id;
            document.querySelectorAll('.memory-node').forEach(n => n.classList.remove('selected'));
            el.classList.add('selected');
            updateDetailPanel(data);
            currentEditingMemory = data;
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
                // root가 선택되어 있으면 parentId는 null (서버의 root 메모리와 연결)
                parentId: selectedNodeId === canonicalRootId ? null : selectedNodeId,
                thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                artist: '',
                source: 'YouTube'
            };

            hideAddMemoryForm();

            // ── API 우선 생성 시도 ──
            let createdMemory = null;
            let useApi = false;
            try {
                if (window.apiClient && typeof window.apiClient.createMemory === 'function') {
createdMemory = await window.apiClient.createMemory(newMemoryData);
 useApi = true;
 isLocalSaveMode = false; // API 성공 시 로컬 모드 해제
 console.log('[editor] API createMemory success:', createdMemory);
                }
            } catch (e) {
                const i18n = window.t || ((k) => k);
                console.warn('[editor] API createMemory failed, fallback to mock:', e?.message || e);
                if (e?.message?.includes('401') || e?.message?.includes('403')) {
                    showToast(i18n('no_permission_local'), 'warn');
                } else if (e?.message?.includes('400')) {
                    showToast(i18n('check_input'), 'error');
                } else {
                    showToast(i18n('server_fail_local'), 'warn');
                }
            }

            // API 실패 시 mock fallback - 로컬에만 추가
            // 방어적 처리: createdMemory가 null/undefined인 경우에도 로컬 객체 생성
if (!createdMemory || typeof createdMemory !== 'object') {
 console.log('[editor] Using local fallback memory');
 isLocalSaveMode = true; // 로컬 폴백 모드 표시
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
                    window.currentTreeMemories = refreshed.map(normalizeMemory);
                } else {
                    if (!Array.isArray(window.currentTreeMemories)) window.currentTreeMemories = [];
                    const exists = window.currentTreeMemories.some(m => m.id === normalizedNew.id);
                    if (!exists && normalizedNew) window.currentTreeMemories.push(normalizedNew);
                }
            } catch (e) {
                if (!Array.isArray(window.currentTreeMemories)) window.currentTreeMemories = [];
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

// 새 메모리 추가 성공 토스트 (로컬 폴백 시 메시지 변경)
 const i18nToast = window.t || ((k) => k);
 const successMsg = useApi
 ? (i18nToast('memory_added') || '새 기억이 추가되었습니다!')
 : (i18nToast('memory_added_local') || '기억이 저장되었습니다 (로컬만)');
 showToast(successMsg, useApi ? 'success' : 'warn');
            }

            // ── 메모리 추가 후 캐시 동기화 ──
            if (typeof window.setCachedMemories === 'function' && treeId) {
                window.setCachedMemories(treeId, window.currentTreeMemories);
                console.log('[editor] 메모리 추가 후 캐시 저장:', window.currentTreeMemories.length, '개');
            }
        };

        // 폼 버튼 이벤트 리스너
        if (addBtn) addBtn.addEventListener('click', showAddMemoryForm);
        if (cancelBtn) cancelBtn.addEventListener('click', hideAddMemoryForm);
        if (confirmBtn) {
            confirmBtn.addEventListener('click', (e) => {
                e.preventDefault();
                addMemoryFromForm().catch(err => {
                    console.error('[editor] Failed to add memory:', err);
                    showToast('기록 저장 중 오류가 발생했습니다', 'error');
                });
            });
        }

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

        // 상세 패널 수정/삭제 버튼 이벤트 리스너
        const editMemoryBtn = document.getElementById('editMemoryBtn');
        const deleteMemoryBtn = document.getElementById('deleteMemoryBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const saveEditBtn = document.getElementById('saveEditBtn');

        if (editMemoryBtn) editMemoryBtn.addEventListener('click', enterEditMode);
        if (deleteMemoryBtn) deleteMemoryBtn.addEventListener('click', deleteMemory);
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', exitEditMode);
        if (saveEditBtn) saveEditBtn.addEventListener('click', saveMemoryEdit);

        console.log('[editor] Ready — tree:', treeId, 'memories:', treeMemories().length);
    };

    // ── 인증 상태에 따라 시작 ──
    // 완화: Firebase SDK 지연 또는 unavailable 시에도 cached auth가 있으면 진입 허용
    // 보안: cached auth가 있어도 Firebase 재검증은后台에서 진행
    
    function waitForFirebase(maxWaitMs, intervalMs, callback) {
        var elapsed = 0;
        var checkInterval = setInterval(function() {
            elapsed += intervalMs;
            var hasFirebase = typeof firebase !== 'undefined' && firebase.auth && firebase.apps && firebase.apps.length;
            if (hasFirebase) {
                clearInterval(checkInterval);
                callback(true);
            } else if (elapsed >= maxWaitMs) {
                clearInterval(checkInterval);
                callback(false);
            }
        }, intervalMs);
    }

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
                    var basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
                    window.location.href = basePath + 'login.html?redirect=' + basePath + 'editor.html';
                    return;
                }
                // Firebase 준비 완료 후에만 editor 시작
                console.log('[editor] Firebase ready, starting editor');
                startEditor();
            });
        } else if (cachedUser && cachedUser.uid) {
            // Firebase not available but has cached auth - wait for Firebase
            console.log('[editor] Firebase not ready, waiting with cached auth...');
            
            // preparing UI 유지하면서 Firebase 준비 대기
            waitForFirebase(5000, 200, function(ready) {
                if (ready) {
                    // Firebase now ready - start with auth check
                    var unsubscribe = firebase.auth().onAuthStateChanged(function(user) {
                        unsubscribe();
                        if (!user && !forceStart) {
                            var basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
                            window.location.href = basePath + 'login.html?redirect=' + basePath + 'editor.html';
                            return;
                        }
                        console.log('[editor] Firebase became ready, starting editor');
                        startEditor();
                    });
                } else {
                    // Firebase never ready - don't start API calls, show error
                    console.error('[editor] Firebase failed to initialize after timeout');
                    const i18n = window.t || ((k) => k);
                    showToast(i18n('firebase_init_fail') || 'Firebase 준비 실패. 페이지를 새로고침해 주세요.', 'error');
                    // startEditor()를 호출하지 않음 - API 호출 방지
                }
            });
        } else {
            // No Firebase and no cached auth - redirect to login
            if (!forceStart) {
                var basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
                window.location.href = basePath + 'login.html?redirect=' + basePath + 'editor.html';
            }
        }
    }
    
    // Start with force flag for direct access scenarios
    tryStartEditor(false);
});