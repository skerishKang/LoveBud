document.addEventListener('DOMContentLoaded', () => {
    // ── Root Memory Helpers ──
    // 분리된 모듈(editor-root-helpers.js) 사용, fallback 유지
    let rootHelperWarningShown = false;
    const rootUtils = window.LoveBudEditorUtils || {};

    const findRootMemory = rootUtils.findRootMemory || function(memories) {
        if (!rootHelperWarningShown) {
            console.warn('[editor] LoveBudEditorUtils not loaded, using local fallback for root helpers');
            rootHelperWarningShown = true;
        }
        if (!Array.isArray(memories)) return null;
        const parentNullNodes = memories.filter(m => m.parentId === null || m.parentId === undefined);
        if (parentNullNodes.length === 1) {
            return parentNullNodes[0];
        } else if (parentNullNodes.length > 1) {
            const oldest = parentNullNodes.sort((a, b) => {
                const aTime = a.createdAt || a.timestamp || '9999';
                const bTime = b.createdAt || b.timestamp || '9999';
                return new Date(aTime) - new Date(bTime);
            })[0];
            console.log('[editor] Multiple parentId=null nodes found, using oldest as root:', oldest.id);
            return oldest;
        }
        return memories.find(m => m.id === 'root');
    };

    const getRootId = rootUtils.getRootId || function(memories) {
        const root = findRootMemory(memories);
        return root ? root.id : 'root';
    };

    const getCanonicalRootId = rootUtils.getCanonicalRootId || function(memories) {
        const root = findRootMemory(memories);
        return root ? root.id : 'root';
    };

    const isRootMemory = rootUtils.isRootMemory || function(mem, rootId) {
        if (!mem || !rootId) return false;
        return mem.id === rootId;
    };

    // ── 인증 가드: onAuthReady 콜백 기반 ──
    // ── 사용자 알림용 토스트 유틸리티 (공통 UI 사용) ──
    let toastWarningShown = false;
    const showToast = (message, type = 'info') => {
        if (window.LoveBudUI?.showToast) {
            window.LoveBudUI.showToast(message, type, 3000);
        } else {
            // fallback: 간단한 console 로그
            if (!toastWarningShown) {
                console.warn('[editor] LoveBudUI not loaded, toast degraded to console');
                toastWarningShown = true;
            }
            console.log(`[Toast ${type}] ${message}`);
        }
    };

    const getI18n = () => window.t || ((k) => k);
    const i18n = getI18n();

    const getEditorBasePath = () =>
        window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';

    const buildEditorRedirectTarget = () =>
        getEditorBasePath() + 'editor.html' + (window.location.search || '');

    const redirectToEditorLogin = (delayMs = 0) => {
        const loginUrl =
            getEditorBasePath() + 'login.html?redirect=' + encodeURIComponent(buildEditorRedirectTarget());

        if (delayMs > 0) {
            setTimeout(() => {
                window.location.href = loginUrl;
            }, delayMs);
            return;
        }

        window.location.href = loginUrl;
    };

    // ── i18n 결과가 raw key일 때를 방어하는 safe fallback ──
    const safeI18nText = (i18nFn, key, fallback) => {
        const result = i18nFn(key);
        if (!result || result === key) return fallback;
        return result;
    };

    const syncCurrentTreeData = (tree) => {
        window.currentTreeData = {
            ...tree,
            visibility: tree.visibility || 'private'
        };
        console.log('[editor] currentTreeData set:', window.currentTreeData.visibility);
    };

    const resolveParentIdForCreate = (selectedNodeId, canonicalRootId) => {
        if (!selectedNodeId || selectedNodeId === canonicalRootId) {
            return canonicalRootId === 'root' ? null : canonicalRootId;
        }
        return selectedNodeId;
    };

    const getMyTreesHref = () => getEditorBasePath() + 'my-trees.html';

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const safeUrl = (value, { allowDataImage = false } = {}) => {
        const raw = String(value || '').trim();
        if (!raw) return '';

        if (allowDataImage && raw.startsWith('data:image/')) {
            return raw;
        }

        try {
            const url = new URL(raw, window.location.origin);
            const protocol = url.protocol.toLowerCase();
            if (protocol === 'http:' || protocol === 'https:') {
                return url.toString();
            }
            return '';
        } catch (e) {
            return '';
        }
    };

    const getYouTubeInputErrorMessage = (rawUrl) => {
        const value = String(rawUrl || '').trim();

        if (!value) {
            return i18n('enter_youtube') || 'YouTube 링크를 입력해 주세요.';
        }

        const looksLikeUrl = /^(https?:\/\/|www\.)/i.test(value);
        const hasYouTubeHint = /(youtube\.com|youtu\.be|youtube\.com\/shorts\/)/i.test(value);
        const idLikeMatch = value.match(/(?:v=|\/|youtu\.be\/|shorts\/)([0-9A-Za-z_-]+)/i);
        const candidateId = idLikeMatch ? idLikeMatch[1] : '';

        if (!looksLikeUrl) {
            return i18n('invalid_youtube_format') || '전체 YouTube 링크를 붙여넣어 주세요.';
        }

        if (!hasYouTubeHint) {
            return i18n('invalid_youtube_unsupported') || 'YouTube 링크만 지원합니다. youtube.com 또는 youtu.be 링크를 사용해 주세요.';
        }

        if (candidateId && candidateId.length !== 11) {
            return i18n('invalid_youtube_id_length') || '링크가 중간에 잘린 것 같아요. 전체 YouTube 링크를 다시 복사해 주세요.';
        }

        return i18n('invalid_youtube') || '유효한 YouTube 링크를 입력해 주세요.';
    };

    const renderTreeLoadError = ({ canvas, detailPanel, addBtn, errorTitle, errorDesc }) => {
        canvas.innerHTML = `
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;padding:32px;background:rgba(255,255,255,0.96);border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:360px;width:calc(100% - 32px);">
                <div style="font-size:48px;margin-bottom:16px;">🌿</div>
                <div style="font-size:1.2rem;font-weight:800;margin-bottom:8px;color:var(--on-surface);">${escapeHtml(errorTitle)}</div>
                <div style="font-size:14px;color:var(--on-surface-variant);line-height:1.6;margin-bottom:20px;">
                    ${escapeHtml(errorDesc)}
                </div>
                <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                    <button type="button" id="retryOpenTreeBtn" class="btn-round btn-outline" style="padding:10px 16px;">
                        ${i18n('retry') || '다시 시도'}
                    </button>
                    <a href="${escapeHtml(getMyTreesHref())}" class="btn-round btn-primary" style="padding:10px 16px;text-decoration:none;">
                        ${i18n('go_to_my_trees') || '내 트리로 가기'}
                    </a>
                </div>
            </div>
        `;

        const headerEl = detailPanel.querySelector('h3');
        if (headerEl) {
            headerEl.textContent = errorTitle;
        }

        const retryBtn = document.getElementById('retryOpenTreeBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => window.location.reload());
        }

        if (addBtn) addBtn.disabled = true;
    };

    const getFirstMockTree = () => {
        const mockTrees = typeof getTrees === 'function' ? getTrees() : [];
        return mockTrees[0] || null;
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
        const cache = window.LoveBudCache || null;
        let TREE_CACHE_KEY = 'tree_default';
        let MEMORIES_CACHE_KEY = 'memories_default';
        // 로컬 폴백 모드 추적 (상세 패널에 표시용)
        let isLocalSaveMode = false;

        // ── 트리 데이터: treeId 우선, 없으면 getFirstTree fallback ──
        let tree = null;
        let isNewTree = false;

        if (urlTreeId) {
            // treeId가 URL에 있으면: 그 트리를 직접 조회
            // 이 경우 조회 실패를 신규 트리 생성으로 바꾸면 안 됨
            let treeLoadStatus = 'not_found';

            try {
                if (window.apiClient && window.apiClient.getTree) {
                    tree = await window.apiClient.getTree(urlTreeId);
                    if (tree) {
                        treeLoadStatus = 'loaded';
                        console.log('[editor] Tree from URL loaded:', tree.id);
                    }
                } else {
                    treeLoadStatus = 'api_unavailable';
                }
            } catch (e) {
                treeLoadStatus = 'error';
                console.warn('[editor] Tree from URL load failed:', e.message);
            }

            if (!tree) {
                const errorTitle =
                    treeLoadStatus === 'api_unavailable'
                        ? (i18n('tree_load_fail_title') || '트리를 불러올 수 없어요')
                        : treeLoadStatus === 'error'
                            ? (i18n('tree_load_error_title') || '트리를 여는 중 문제가 발생했어요')
                            : (i18n('tree_not_found_title') || '트리를 찾을 수 없어요');

                const errorDesc =
                    treeLoadStatus === 'api_unavailable'
                        ? (i18n('tree_load_api_unavailable') || '트리 조회 API를 사용할 수 없는 상태입니다. 잠시 후 다시 시도해주세요.')
                        : treeLoadStatus === 'error'
                            ? (i18n('tree_load_error_desc') || '일시적인 서버 문제 또는 접근 권한 문제일 수 있습니다. 다시 시도하거나 내 트리 목록으로 돌아가 주세요.')
                            : (i18n('tree_load_not_found_desc') || '잘못된 링크이거나 접근 권한이 없는 트리입니다.');

                renderTreeLoadError({ canvas, detailPanel, addBtn, errorTitle, errorDesc });

                return;
            }

            // urlTreeId 분기에서 tree 확보 성공 시 여기까지 내려옴
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
                            const i18n = getI18n();
                            const newTree = await window.apiClient.createTree({
                                title: safeI18nText(i18n, 'default_tree_title', '새 러브트리'),
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
                    showToast(i18n('need_login'), 'error');
                    redirectToEditorLogin(2000);
                    return;
                }
            }
            // API 실패 시에만 mock fallback
            if (!tree) {
                tree = getFirstMockTree();
            }
        } // end else (no urlTreeId)

        if (!tree) {
            console.warn('Tree data not found.');
            return;
        }

        // urlTreeId 직접 진입이든 일반 진입이든 현재 트리 상태를 항상 전역에 동기화
        syncCurrentTreeData(tree);

        const treeId = tree.id || null;

        // 실제 treeId 기준으로 캐시 키 재계산
        TREE_CACHE_KEY = 'tree_' + (treeId || 'default');
        MEMORIES_CACHE_KEY = 'memories_' + (treeId || 'default');

        // ── API 응답 정규화: 공통 유틸 사용
        // 백엔드는 flat camelCase 응답을 반환하므로 mem.data 처리 불필요
        // 저장 계약: window.currentTreeMemories는 항상 이 정규화가 적용된 배열
        let normalizeWarningShown = false;
        const normalizeMemory = window.LoveBudNormalize?.normalizeMemory || ((mem) => {
            // fallback: 공통 유틸 로드 실패 시 기본 정규화
            if (!normalizeWarningShown) {
                console.warn('[editor] LoveBudNormalize not loaded, using local fallback');
                normalizeWarningShown = true;
            }
            if (!mem) return null;
            return {
                id: mem.id,
                treeId: mem.treeId || mem.tree_id || null,
                parentId: mem.parentId ?? mem.parent_id ?? null,
                title: mem.title || '',
                memo: mem.memo || mem.description || '',
                quote: mem.quote || '',
                timestamp: mem.timestamp || '',
                thumbnail: mem.thumbnail || '',
                visibility: mem.visibility || 'private',
                artist: mem.artist || '',
                source: mem.source || '',
                sourceUrl: mem.sourceUrl || mem.source_url || '',
                sourceType: mem.sourceType || mem.source_type || 'youtube',
                emotionTags: mem.emotionTags || mem.emotion_tags || [],
                createdAt: mem.createdAt || mem.created_at || null,
                updatedAt: mem.updatedAt || mem.updated_at || null,
                delay: mem.delay,
                x: mem.x,
                y: mem.y
            };
        });

        // ── memories 캐시 우선 로딩 ──
        let memories = [];

        // 1. 캐시된 memories 먼저 확인
        const cachedMemories = cache ? cache.get(MEMORIES_CACHE_KEY) : null;
        if (cachedMemories && Array.isArray(cachedMemories)) {
            console.log('[editor] Using cached memories:', cachedMemories.length);
            memories = cachedMemories;
            window.currentTreeMemories = memories.map(normalizeMemory).filter(Boolean);
            // initCanvas()는 아래에서 함수 선언 후 한 번만 호출
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

            // 📌 새 트리(empty) 감지 - memories가 0이면 새 트리
            const isNewTree = memories.length === 0;

            return {
                id: canonicalRootId,
                treeId: treeId,
                // 📌 새 트리일 때 명확한 제목
                title: isNewTree ? i18n('first_memory') : i18n('first_memory'),
                memo: i18n('no_memory_yet'),
                timestamp: new Date().toISOString().slice(0,10).replace(/-/g,'.'),
                // 📌 새 트리일 때 빈 공간 아이콘
                thumbnail: isNewTree
                    ? 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect fill="%23e8f5e9" width="120" height="90"/><text x="60" y="45" text-anchor="middle" fill="%234caf50" font-size="24">🌱</text><text x="60" y="70" text-anchor="middle" fill="%23666" font-size="10">새 트리</text></svg>'
                    : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect fill="%23f5f5f5" width="120" height="90"/><text x="60" y="50" text-anchor="middle" fill="%23999" font-size="12">No Memory</text></svg>',
                emotionTags: [],
                parentId: null,
                // 📌 새 트리 표시용 플래그
                isNewTree: isNewTree
            };
        };

        // treeMemories 함수 먼저 정의 (TDZ 방지)
        const treeMemories = () => (window.currentTreeMemories || []).map(normalizeMemory);

        // canonical root ID 계산 (세션 기준 고정값)
        // 이 값은 editor 세션 동안 일관되게 사용됨 (새 메모리 추가로 root가 바뀌지 않음)
        const canonicalRootId = getCanonicalRootId(treeMemories());
        let selectedNodeId = canonicalRootId;

        // Viewport & Pan State
        const viewportState = {
            offsetX: 0,
            offsetY: 0,
            initialized: false,
            isPanning: false,
            startX: 0,
            startY: 0
        };

        const toViewportPos = (pos) => ({
            x: pos.x + viewportState.offsetX,
            y: pos.y + viewportState.offsetY
        });

        const centerOnLogicalPos = (pos) => {
            viewportState.offsetX = Math.round(canvas.clientWidth / 2 - pos.x);
            viewportState.offsetY = Math.round(canvas.clientHeight / 2 - pos.y);
        };

            }
        }
    }
} catch (e) {
    console.warn('[editor] API getMemoriesByTree failed:', e.message);
    if (e.message?.includes('401') || e.message?.includes('403')) {
        showToast(i18n('data_load_fail_demo'), 'warn');
    }
    // API 실패해도 캐시가 있으면 그대로 사용
}
        };

        const bindCanvasPan = () => {
            canvas.addEventListener('mousedown', (e) => {
                if (e.target.closest('.memory-node') || e.target.closest('#addMemoryForm')) return;
                viewportState.isPanning = true;
                viewportState.startX = e.clientX;
                viewportState.startY = e.clientY;
                canvas.classList.add('panning');
            });

            window.addEventListener('mousemove', (e) => {
                if (!viewportState.isPanning) return;
                const dx = e.clientX - viewportState.startX;
                const dy = e.clientY - viewportState.startY;
                viewportState.startX = e.clientX;
                viewportState.startY = e.clientY;
                viewportState.offsetX += dx;
                viewportState.offsetY += dy;
                initCanvas();
                selectNodeById(selectedNodeId);
            });

            window.addEventListener('mouseup', () => {
                viewportState.isPanning = false;
                canvas.classList.remove('panning');
            });
        };

        // ── 배치 상수 ──
        const ROOT_X = Math.max(460, Math.round(canvas.clientWidth * 0.42));
        const ROOT_Y = Math.max(420, Math.round(canvas.clientHeight * 0.52));
        const RADIUS_L1 = 260;
        const RADIUS_L2 = 210;
        const NODE_WIDTH = 80;
        const MIN_ANGLE_GAP = 32;

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
                let angle;

                if (count === 1) {
                    angle = -35;
                } else if (count === 2) {
                    angle = idx === 0 ? -55 : -5;
                } else if (FIXED_ANGLES[mem.id] !== undefined) {
                    angle = FIXED_ANGLES[mem.id];
                } else if (count > 0) {
                    const angles = distributeAngles(count, -35);
                    angle = angles[idx] !== undefined ? angles[idx] : angles[0];
                } else {
                    angle = -35;
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
            const currentTree = window.currentTreeData || {};
            const treeId = currentTree.id || urlTreeId;

            const visibility = currentTree.visibility || 'private';
            const isPublic = visibility === 'public';
            const visIcon = isPublic ? 'public' : 'lock';
            const visLabel = isPublic ? i18n('visibility_public') : i18n('visibility_private');
            const visInfo = isPublic ? i18n('share_info') : safeI18nText(i18n, 'private_info', '나만 볼 수 있는 트리입니다');
            const visStyle = isPublic
                ? 'background:rgba(76,175,80,0.1);color:#4caf50;border:1px solid rgba(76,175,80,0.3);'
                : 'background:rgba(158,158,158,0.1);color:#757575;border:1px solid rgba(158,158,158,0.3);';

            const isEmptyState = !!data?.isNewTree;
            const isRootSelected = !isEmptyState && isRootMemory(data, canonicalRootId);

            const headerEl = detailPanel.querySelector('h3');
            if (headerEl) {
                const localBadge = isLocalSaveMode
                    ? `<span style="font-size:11px;padding:2px 8px;background:rgba(239,108,0,0.1);color:#ef6c00;border-radius:99px;font-weight:600;margin-left:8px;">${i18n('local_save_badge') || '로컬 저장'}</span>`
                    : '';

                const treeMetaHtml = `
                    <div style="margin-top:10px;padding:12px 14px;border-radius:12px;background:var(--surface-container);display:flex;flex-direction:column;gap:8px;">
                        <div style="font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--on-surface-variant);text-transform:uppercase;">
                            ${i18n('current_tree') || '현재 트리'}
                        </div>
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                            <div style="font-size:14px;font-weight:700;color:var(--on-surface);">${escapeHtml(currentTree.title || (i18n('lovetree_brand') || '러브트리'))}</div>
                            <span style="${visStyle}padding:4px 10px;border-radius:99px;display:inline-flex;align-items:center;gap:4px;font-size:12px;">
                                <span class="material-symbols-outlined" style="font-size:12px;">${escapeHtml(visIcon)}</span>
                                ${escapeHtml(visLabel)}
                            </span>
                        </div>
                        <div style="font-size:11px;color:var(--on-surface-variant);">${escapeHtml(visInfo)}</div>
                    </div>
                `;

                let shareBtn = '';
                if (isPublic && !isEmptyState && data?.id) {
                    shareBtn = `<button id="shareTreeBtn" style="${visStyle}font-size:12px;padding:6px 12px;border-radius:99px;cursor:pointer;border:none;font-weight:600;display:flex;align-items:center;gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:14px;">content_copy</span>
                        ${i18n('share_link')}
                    </button>`;
                }

                if (isEmptyState) {
                    headerEl.innerHTML = `
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                                <span style="font-size:1.4rem;line-height:1.2;font-weight:900;letter-spacing:-0.03em;color:var(--on-surface);">${i18n('waiting_first_moment') || '첫 순간을 기다리고 있어요'}${localBadge}</span>
                            </div>
                            <div style="font-size:13px;color:var(--on-surface-variant);line-height:1.5;">
                                ${i18n('empty_panel_hint_short') || '첫 영상을 추가하면 여기에 표시됩니다.'}
                            </div>
                            ${treeMetaHtml}
                        </div>
                    `;
                } else {
                    const sectionLabel = isRootSelected ? (i18n('start_moment') || '시작 순간') : (i18n('selected_moment') || '선택된 순간');
                    var basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';

                    headerEl.innerHTML = `
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            <div style="font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--primary);text-transform:uppercase;">
                                ${sectionLabel}
                            </div>
                            <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
                                <span style="font-size:1.4rem;line-height:1.2;font-weight:900;letter-spacing:-0.03em;color:var(--on-surface);">${escapeHtml(data.title || '')}${localBadge}</span>
                                ${shareBtn}
                            </div>
                            ${treeMetaHtml}
                        </div>
                    `;

                    if (isPublic && data?.id) {
                        setTimeout(() => {
                            const btn = document.getElementById('shareTreeBtn');
                            if (btn) {
                                btn.addEventListener('click', () => {
                                    const shareUrl = window.location.origin + '/' + basePath + 'detail.html?id=' + data.id + '&tree=' + treeId;
                                    navigator.clipboard?.writeText(shareUrl).then(() => {
                                        showToast(i18n('copied_link') || '링크가 복사되었습니다!', 'success');
                                    }).catch(() => {
                                        showToast('링크 복사에 실패했습니다', 'error');
                                    });
                                });
                            }
                        }, 100);
                    }
                }
            }

            const imgEl = detailPanel.querySelector('.detail-video img');
            if (imgEl) {
                imgEl.src = data?.thumbnail || '';
            }

            const dateEl = document.getElementById('detailDateText');
            if (dateEl) {
                dateEl.textContent = isEmptyState ? '' : (data?.timestamp || '');
                dateEl.style.fontSize = '0.85rem';
                dateEl.style.color = 'var(--on-surface-variant)';
                dateEl.style.opacity = '0.8';
                dateEl.style.fontWeight = '500';
            }

            const tagsContainer = detailPanel.querySelector('.tags-container');
            if (tagsContainer) {
                tagsContainer.innerHTML = '';
                if (!isEmptyState && Array.isArray(data.emotionTags)) {
                    data.emotionTags.forEach((tag) => {
                        const tagEl = document.createElement('span');
                        tagEl.className = 'tag tag-primary';
                        tagEl.textContent = tag;
                        tagsContainer.appendChild(tagEl);
                    });
                }
            }

            const noteEl = detailPanel.querySelector('.diary-note');
            if (noteEl) {
                noteEl.innerHTML = '';

                const memoBody = document.createElement('div');
                memoBody.style.lineHeight = '1.7';
                memoBody.style.fontSize = '0.95rem';
                memoBody.style.color = 'var(--on-surface)';
                memoBody.textContent = isEmptyState
                    ? i18n('empty_tree_memo') || '이 트리는 아직 비어 있습니다. "영상 추가" 버튼으로 첫 순간을 기록해 보세요.'
                    : (data.memo || '');
                noteEl.appendChild(memoBody);

                if (!isEmptyState) {
                    const hintEl = document.createElement('div');
                    hintEl.style.marginTop = '12px';
                    hintEl.style.fontSize = '12px';

                    if (isRootSelected) {
                        hintEl.style.color = 'var(--primary)';
                        hintEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px;">star</span> ${i18n('root_moment_hint') || '이 순간은 현재 트리의 시작점입니다'}`;
                    } else if (data.parentId) {
                        hintEl.style.paddingTop = '12px';
                        hintEl.style.borderTop = '1px solid var(--outline-variant)';
                        hintEl.style.color = 'var(--on-surface-variant)';
                        hintEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:4px;">account_tree</span> ${i18n('path_moment_hint') || '이 순간은 감정 경로의 한 지점입니다'}`;
                    }

                    if (hintEl.innerHTML) {
                        noteEl.appendChild(hintEl);
                    }
                }
            }

            // 빈 트리/비선택 상태에서는 수정/삭제 버튼 숨김
            const memoryActions = detailPanel.querySelector('.memory-actions');
            if (memoryActions) {
                memoryActions.style.display = isEmptyState ? 'none' : 'flex';
            }
        };

        // 전역에 노출 (메모리 추가 후 업데이트용)
        window.updateDetailPanel = updateDetailPanel;

        const updateSidebarStatus = () => {
            const treeTitleEl = document.getElementById('sidebarTreeTitle');
            const momentCountEl = document.getElementById('sidebarMomentCount');
            if (treeTitleEl) {
                treeTitleEl.textContent = (window.currentTreeData?.title) || i18n('default_tree_title') || '새 러브트리';
            }
            if (momentCountEl) {
                const count = treeMemories().filter(m => !isRootMemory(m, canonicalRootId)).length;
                momentCountEl.textContent = `순간 ${count}개`;
            }
        };

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

            const titleInput = document.getElementById('editTitleInput');
            const memoInput = document.getElementById('editMemoInput');
            const tagsInput = document.getElementById('editTagsInput');

            const payload = {
                title: titleInput ? titleInput.value.trim() : currentEditingMemory.title,
                memo: memoInput ? memoInput.value.trim() : currentEditingMemory.memo,
                emotionTags: tagsInput ? tagsInput.value.split(',').map(t => t.trim()).filter(t => t) : currentEditingMemory.emotionTags
            };

            // ── Show saving status (UX hardening) ──
            updateSaveStatus('saving', i18n('save_saving'));

            try {
                if (window.apiClient && typeof window.apiClient.updateMemory === 'function') {
                    await window.apiClient.updateMemory(currentEditingMemory.id, payload);

                    // ── Save success (UX hardening) ──
                    updateSaveStatus('saved', i18n('save_saved'));

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

                // ── Save failed status (UX hardening) ──
                updateSaveStatus('failed', i18n('save_failed'));

                showToast(i18n('update_failed'), 'error');
            }
        };

        const deleteMemory = async () => {
            if (!currentEditingMemory) return;

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
                        detailPanel.querySelector('h3').innerHTML = i18n('moment_detail') || '순간 상세';
                        const imgEl = detailPanel.querySelector('.detail-video img');
                        if (imgEl) imgEl.src = '';
                    }

                    showToast(i18n('memory_deleted'), 'success');
                    updateSidebarStatus();
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

            // Hide save status when switching nodes (UX hardening)
            const indicator = document.getElementById('saveStatusIndicator');
            if (indicator) {
                indicator.style.display = 'none';
                if (saveStatusData.timer) {
                    clearTimeout(saveStatusData.timer);
                    saveStatusData.timer = null;
                }
            }

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

        // drawRoot 제거 - 붉은 점/루트 마커 노출 방지
        // const drawRoot = () => { ... }

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
            // 중복 노드 방지: 이미 동일 memory-id가 있으면 skip
            const existingNode = document.querySelector(`.memory-node[data-memory-id="${mem.id}"]`);
            if (existingNode) {
                console.log('[editor] Node already exists, skipping:', mem.id);
                return;
            }
            const pos = calcPosition(mem);
            const nodeEl = document.createElement('div');
            nodeEl.className = 'memory-node floating-node';
            nodeEl.dataset.memoryId = mem.id;
            nodeEl.style.left = `${pos.x - 40}px`;
            nodeEl.style.top = `${pos.y - 40}px`;
            nodeEl.style.animationDelay = mem.delay || '0s';

            const card = document.createElement('div');
            card.className = 'node-card';

            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'node-img-wrapper';
            imgWrapper.style.position = 'relative';

            const skeleton = document.createElement('div');
            skeleton.className = 'node-skeleton';
            imgWrapper.appendChild(skeleton);

            const img = document.createElement('img');
            img.src = safeUrl(mem.thumbnail, { allowDataImage: true }) || '';
            img.alt = mem.title || '';
            
            img.onload = () => {
                img.classList.add('loaded');
                skeleton.style.display = 'none';
            };
            img.onerror = () => {
                img.style.display = 'none';
                skeleton.classList.add('error');
            };
            if (img.complete) {
                img.classList.add('loaded');
                skeleton.style.display = 'none';
            }

            imgWrapper.appendChild(img);
            card.appendChild(imgWrapper);

            const infoLabel = document.createElement('div');
            infoLabel.className = 'node-info-label';

            const titleEl = document.createElement('p');
            titleEl.className = 'node-title';
            titleEl.textContent = mem.title || '';

            const dateEl = document.createElement('p');
            dateEl.className = 'node-date';
            dateEl.textContent = mem.timestamp || '';

            infoLabel.appendChild(titleEl);
            infoLabel.appendChild(dateEl);

            nodeEl.appendChild(card);
            nodeEl.appendChild(infoLabel);

            nodeEl.addEventListener('click', () => selectNode(nodeEl, mem));
            canvas.appendChild(nodeEl);
        };

        const initCanvas = () => {
            // 기존 노드 중복 방지: 초기화 전 기존 DOM 노드 제거
            canvas.querySelectorAll('.memory-node').forEach(n => n.remove());
            canvas.querySelectorAll('#emptyTreeMessage').forEach(el => el.remove());
            svg.querySelectorAll('.branch-line').forEach(l => l.remove());
            treeMemories().forEach(node => {
                if (isRootMemory(node, canonicalRootId)) return; // canonical root만 skip
                drawNode(node);
                const parentId = node.parentId || canonicalRootId;
                const parent = treeMemories().find(m => m.id === parentId);
                if (parent) drawBranch(calcPosition(parent), calcPosition(node));
            });

            // 새 트리 확인 - 캔버스에 메시지 표시
            const initialMem = createInitialMemory();
            if (initialMem.isNewTree) {
                const emptyMsg = document.createElement('div');
                emptyMsg.id = 'emptyTreeMessage';
                emptyMsg.innerHTML = `
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;padding:32px;background:rgba(255,255,255,0.95);border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:320px;">
                        <div style="font-size:48px;margin-bottom:16px;">🌱</div>
                        <div style="font-size:1.25rem;font-weight:800;margin-bottom:8px;color:var(--on-surface);">${i18n('empty_tree_title') || '새 트리가 비어있어요'}</div>
                        <div style="font-size:14px;color:var(--on-surface-variant);margin-bottom:16px;line-height:1.5;">
                            ${i18n('empty_tree_desc') || '"영상 추가" 버튼을 클릭하여 첫 번째 감정을 기록해보세요!'}
                        </div>
                    </div>
                `;
                canvas.appendChild(emptyMsg);
            }

            const selectedMem = createInitialMemory();
            if (selectedMem) {
                updateDetailPanel(selectedMem);
            }
        };

        // ── Save status indicator ────────────────────────────────────────────
        let saveStatusData = {
            status: 'saved',
            lastSaved: null,
            timer: null
        };

        function updateSaveStatus(status, message) {
            const indicator = document.getElementById('saveStatusIndicator');
            const iconEl = document.getElementById('saveStatusIcon');
            const textEl = document.getElementById('saveStatusText');
            const timeEl = document.getElementById('lastSavedTime');

            if (!indicator || !iconEl || !textEl) return;

            if (saveStatusData.timer) {
                clearTimeout(saveStatusData.timer);
                saveStatusData.timer = null;
            }

            saveStatusData.status = status;

            switch (status) {
                case 'saving':
                    iconEl.textContent = 'hourglass_empty';
                    textEl.textContent = message || i18n('save_saving');
                    indicator.className = 'save-status-indicator saving';
                    indicator.style.display = 'flex';
                    // saving 상태에서는 시간 영역 완전히 숨김
                    if (timeEl) timeEl.style.display = 'none';
                    break;
                case 'saved':
                    iconEl.textContent = 'check_circle';
                    textEl.textContent = message || i18n('save_saved');
                    indicator.className = 'save-status-indicator saved';
                    saveStatusData.lastSaved = new Date();
                    // saved 상태에서만 시간 영역 표시
                    if (timeEl) {
                        timeEl.style.display = 'inline';
                        timeEl.textContent = formatTimeAgo(saveStatusData.lastSaved);
                    }
                    saveStatusData.timer = setTimeout(() => {
                        indicator.style.display = 'none';
                    }, 3000);
                    break;
                case 'failed':
                    iconEl.textContent = 'error';
                    textEl.textContent = message || i18n('save_failed');
                    indicator.className = 'save-status-indicator failed';
                    // failed 상태에서도 시간 영역 완전히 숨김
                    if (timeEl) timeEl.style.display = 'none';
                    saveStatusData.timer = setTimeout(() => {
                        indicator.style.display = 'none';
                    }, 5000);
                    break;
            }
        }

        function formatTimeAgo(date) {
            if (!date) return '';
            const now = new Date();
            const diff = Math.floor((now - date) / 1000);
            if (diff < 60) return '방금';
            if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
            return `${Math.floor(diff / 86400)}일 전`;
        }

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
                showToast(i18n('enter_youtube'), 'warn');
                return;
            }

            // ── YouTube 처리: LoveBudMedia 공통 유틸 사용 ──
            let videoId;
            let embedUrl;
            let thumbnailUrl;

            if (window.LoveBudMedia?.extractYouTubeId) {
                videoId = window.LoveBudMedia.extractYouTubeId(url);
                if (!videoId) {
                    showToast(getYouTubeInputErrorMessage(url), 'error');
                    return;
                }
                embedUrl = window.LoveBudMedia.getEmbedUrl(url, 'youtube');
                thumbnailUrl = window.LoveBudMedia.getThumbnailUrl(url, 'youtube', 'mqdefault');
            } else {
                // fallback: 기존 정규식 로직 (media.js 로드 실패 시)
                console.warn('[editor] LoveBudMedia not loaded, using fallback YouTube parsing');
                const match = url.match(/(?:v=|\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
                if (!match) {
                    showToast(getYouTubeInputErrorMessage(url), 'error');
                    return;
                }
                videoId = match[1];
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
                thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            }

            // ── 검증 통과 후에만 저장 상태 표시 ──
            updateSaveStatus('saving', i18n('save_saving'));

            const today = new Date();
            const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;

            // 기본 제목 자동 생성 (입력 없을 시)
            const title = titleInput.value.trim() || `새 순간`;

            const newMemoryData = {
                treeId: treeId,
                title: title,
                memo: memoInput.value.trim() || '',
                timestamp: dateStr,
                sourceUrl: embedUrl,
                sourceType: 'youtube',
                emotionTags: [i18n('tag_record') || '기록'],
                // synthetic root('root') 선택 상태에서는 첫 메모리를 root-level(null)로 저장
                parentId: resolveParentIdForCreate(selectedNodeId, canonicalRootId),
                thumbnail: thumbnailUrl,
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
                } else {
                    throw new Error('createMemory API not available');
                }
            } catch (e) {
                console.warn('[editor] API createMemory failed, fallback to mock:', e?.message || e);

                if (e?.message?.includes('401') || e?.message?.includes('403')) {
                    showToast(i18n('no_permission_local'), 'warn');
                } else if (e?.message?.includes('400')) {
                    updateSaveStatus('failed', i18n('check_input') || '입력값을 다시 확인해주세요.');
                    showToast(i18n('check_input') || '입력값을 다시 확인해주세요.', 'error');
                } else {
                    showToast(i18n('server_fail_local') || '서버 저장에 실패해 로컬 저장으로 전환됩니다.', 'error');
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
            let didRefreshFromServer = false;

            try {
                if (useApi && window.apiClient && typeof window.apiClient.getMemoriesByTree === 'function') {
                    const refreshed = await window.apiClient.getMemoriesByTree(treeId);
                    if (Array.isArray(refreshed)) {
                        window.currentTreeMemories = refreshed.map(normalizeMemory).filter(Boolean);
                        didRefreshFromServer = true;
                    }
                }

                if (!didRefreshFromServer) {
                    if (!Array.isArray(window.currentTreeMemories)) window.currentTreeMemories = [];
                    const exists = window.currentTreeMemories.some(m => m.id === normalizedNew?.id);
                    if (!exists && normalizedNew) window.currentTreeMemories.push(normalizedNew);
                }
            } catch (e) {
                if (!Array.isArray(window.currentTreeMemories)) window.currentTreeMemories = [];
                const exists = window.currentTreeMemories.some(m => m.id === normalizedNew?.id);
                if (!exists && normalizedNew) window.currentTreeMemories.push(normalizedNew);
            }

            // ── UI 렌더링: API 응답 정규화 후 렌더링 ──
            // snake_case → camelCase, {id, data} 형태 정규화
            const normalizedMemory = normalizeMemory(createdMemory);
            if (!normalizedMemory) {
                console.error('[editor] Memory normalization failed');
                updateSaveStatus('failed', i18n('save_failed'));
                return;
            }

            // 첫 노드 추가 시 "비어있음" 메시지 제거
            const emptyMsg = document.getElementById('emptyTreeMessage');
            if (emptyMsg) {
                emptyMsg.remove();
                console.log('[editor] Removed emptyTreeMessage after first node added');
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

             // ── 최종 저장 상태: 재조회 성공 여부에 따라 구분 ──
             if (useApi && didRefreshFromServer) {
                 updateSaveStatus('saved', i18n('save_saved') || '저장됨');
             } else {
                 updateSaveStatus('saved', i18n('save_saved_local') || '로컬 저장됨');
             }

            // ── 메모리 추가 후 캐시 동기화 ──
            if (typeof window.setCachedMemories === 'function' && treeId) {
                window.setCachedMemories(treeId, window.currentTreeMemories);
                console.log('[editor] 메모리 추가 후 캐시 저장:', window.currentTreeMemories.length, '개');
            }

            // ── 사이드바 업데이트 ──
            updateSidebarStatus();
        };
        };

        // 폼 버튼 이벤트 리스너
        if (addBtn) addBtn.addEventListener('click', showAddMemoryForm);
        if (cancelBtn) cancelBtn.addEventListener('click', hideAddMemoryForm);
        if (confirmBtn) {
             confirmBtn.addEventListener('click', (e) => {
                 e.preventDefault();
                 addMemoryFromForm().catch(err => {
                     console.error('[editor] Failed to add memory:', err);
                     updateSaveStatus('failed', i18n('save_failed'));
                     showToast(i18n('record_error') || '기록 저장 중 오류가 발생했습니다', 'error');
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
        updateSidebarStatus();
    };

    // ── 인증 가드: my-trees.js와 동일한 패턴 ──
    // user 없으면 cache 확인 후 redirect, 있으면 startEditor 진행
    var editorStarted = false;

    function tryStartEditor(user) {
        if (editorStarted) return;

        if (!user) {
            // No Firebase user - check confirmed auth cache before redirect
            var cachedUser = null;
            try {
                if (localStorage.getItem('lovebud_auth_confirmed') === 'true') {
                    var raw = localStorage.getItem('lovebud_auth_cache');
                    if (raw && raw !== 'null') {
                        cachedUser = JSON.parse(raw);
                    }
                }
            } catch (e) {}

            if (!cachedUser || !cachedUser.uid) {
                redirectToEditorLogin();
                return;
            }
            // cached auth 있으면 아래로 진행
        }

        editorStarted = true;
        console.log('[editor] Auth confirmed, starting editor');
        startEditor();
    }

    // 새로운 배열 콜백 패턴 사용 (폴백 포함)
    if (typeof window.registerOnAuthReady === 'function') {
        window.registerOnAuthReady(tryStartEditor);
    } else {
        window.onAuthReady = tryStartEditor;
    }
});