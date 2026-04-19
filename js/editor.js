document.addEventListener('DOMContentLoaded', () => {
    // Root memory helpers
    // Prefer editor-root-helpers.js and keep a local fallback.
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

    // Auth guard bootstrapping via onAuthReady callback
    // Shared toast utility wrapper
    let toastWarningShown = false;
    const showToast = (message, type = 'info') => {
        if (window.LoveBudUI?.showToast) {
            window.LoveBudUI.showToast(message, type, 3000);
        } else {
            // Fallback: log to console when shared UI helper is unavailable
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

    // Safe fallback for raw i18n keys leaking into the UI
    const safeI18nText = (i18nFn, key, fallback) => {
        const result = i18nFn(key);
        if (!result || result === key) return fallback;
        return result;
    };

    const resolveHintText = (rawValue, fallbackKey, fallbackText) => {
        const value = String(rawValue || '').trim();
        if (!value || value === fallbackKey) {
            return safeI18nText(i18n, fallbackKey, fallbackText);
        }
        return value;
    };

    const resolveTreeTitleText = (rawTitle) => {
        const value = String(rawTitle || '').trim();
        if (!value) {
            return safeI18nText(i18n, 'default_tree_title', '러브트리');
        }
        if (value === 'default_tree_title') {
            return safeI18nText(i18n, 'default_tree_title', '러브트리');
        }
        if (value === 'lovetree_brand') {
            return safeI18nText(i18n, 'lovetree_brand', '러브트리');
        }
        return value;
    };

    const resolveInfoText = (rawValue, fallbackKey, fallbackText) => {
        const value = String(rawValue || '').trim();
        if (!value || value === fallbackKey) {
            return safeI18nText(i18n, fallbackKey, fallbackText);
        }
        return value;
    };

    const syncCurrentTreeData = (tree) => {
        window.currentTreeData = {
            ...tree,
            visibility: tree.visibility || 'public'
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

    const resolveMemoryThumbnail = (memory, quality = 'hqdefault') => {
        const thumbnail = safeUrl(memory?.thumbnail, { allowDataImage: true });
        if (thumbnail) return thumbnail;

        const sourceUrl = safeUrl(memory?.sourceUrl);
        const sourceType = memory?.sourceType || window.LoveBudMedia?.detectSourceType?.(sourceUrl) || 'youtube';
        if (sourceUrl && sourceType === 'youtube') {
            const videoId = window.LoveBudMedia?.extractYouTubeId?.(sourceUrl) || 
                           extractYouTubeIdFallback(sourceUrl);
            if (videoId) {
                return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
            }
        }
        return '';
    };

    const extractYouTubeIdFallback = (url) => {
        const patterns = [
            /(?:v=|\/|youtu\.be\/|shorts\/)([0-9A-Za-z_-]{11})/i,
            /youtube\.com\/watch\?v=([0-9A-Za-z_-]{11})/i,
            /youtu\.be\/([0-9A-Za-z_-]{11})/i
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    const getThumbnailFallbackChain = (memory) => {
        const qualities = ['hqdefault', 'mqdefault', 'default'];
        return qualities.map(q => resolveMemoryThumbnail(memory, q));
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
            return i18n('invalid_youtube_format') || '전체 YouTube 링크를 붙여 넣어 주세요.';
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
                <div style="font-size:48px;margin-bottom:16px;">🌱</div>
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

        setDetailEmptyState(true);

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

        // Read treeId from URL first
        const urlParams = new URLSearchParams(window.location.search);
        const urlTreeId = urlParams.get('treeId');
        console.log('[editor] URL treeId:', urlTreeId);

        // Cache keys
        const cache = window.LoveBudCache || null;
        let TREE_CACHE_KEY = 'tree_default';
        let MEMORIES_CACHE_KEY = 'memories_default';
        // Track local fallback mode for sidebar/detail UI
        let isLocalSaveMode = false;

        // Tree load order: direct treeId first, then getFirstTree fallback
        let tree = null;
        let isNewTree = false;

        if (urlTreeId) {
            // When treeId exists in URL, load that tree directly.
            // If this fails, surface an explicit error instead of creating a new tree.
            let treeLoadStatus = 'not_found';
            let treeLoadErrorMessage = '';

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
                treeLoadErrorMessage = String(e?.message || '');
                console.warn('[editor] Tree from URL load failed:', e.message);
            }

            if (!tree) {
                const authRequired =
                    /401|Authentication required|Invalid ID token/i.test(treeLoadErrorMessage) ||
                    (/Access denied/i.test(treeLoadErrorMessage) && !getConfirmedSessionUser());

                if (authRequired) {
                    showToast(i18n('need_login'), 'error');
                    redirectToEditorLogin(2000);
                    return;
                }

                const errorTitle =
                    treeLoadStatus === 'api_unavailable'
                        ? (i18n('tree_load_fail_title') || '트리를 불러올 수 없어요')
                        : /Access denied/i.test(treeLoadErrorMessage)
                            ? (i18n('tree_access_denied_title') || '이 러브트리를 열 권한이 없어요')
                        : treeLoadStatus === 'error'
                            ? (i18n('tree_load_error_title') || '트리를 여는 중 문제가 발생했어요')
                            : (i18n('tree_not_found_title') || '트리를 찾을 수 없어요');

                const errorDesc =
                    treeLoadStatus === 'api_unavailable'
                        ? (i18n('tree_load_api_unavailable') || '트리 조회 API를 사용할 수 없는 상태입니다. 잠시 후 다시 시도해 주세요.')
                        : /Access denied/i.test(treeLoadErrorMessage)
                            ? (i18n('tree_access_denied_desc') || '비공개 러브트리이거나 내 계정에 권한이 없어요. 다시 확인하거나 다른 계정으로 로그인해 보세요.')
                        : treeLoadStatus === 'error'
                            ? (i18n('tree_load_error_desc') || '일시적인 서버 문제 또는 접근 권한 문제일 수 있습니다. 다시 시도하거나 트리 목록으로 돌아가 주세요.')
                            : (i18n('tree_load_not_found_desc') || '잘못된 링크이거나 접근 권한이 없는 트리입니다.');

                renderTreeLoadError({ canvas, detailPanel, addBtn, errorTitle, errorDesc });

                return;
            }

            // In the urlTreeId branch, wait until the tree is loaded successfully.
        } else {
            // No treeId in URL: continue with the existing getFirstTree() flow
            try {
                if (window.apiClient && window.apiClient.getFirstTree) {
                    const apiTree = await window.apiClient.getFirstTree();
                    if (apiTree) {
                        tree = apiTree;
                        console.log('[editor] API tree loaded (getFirstTree)');
                    } else {
                        // API succeeded but there is no tree yet, so create a default tree
                        console.log('[editor] No tree found, creating default tree...');
                        if (window.apiClient.createTree) {
                            const i18n = getI18n();
                            const newTree = await window.apiClient.createTree({
                                title: safeI18nText(i18n, 'default_tree_title', '러브트리'),
                                visibility: 'public'
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
            // API failed, fall back to the local mock source
            if (!tree) {
                tree = getFirstMockTree();
            }
        } // end else (no urlTreeId)

        if (!tree) {
            console.warn('Tree data not found.');
            return;
        }

        // Keep current tree state in sync for both direct entry and normal entry
        syncCurrentTreeData(tree);

        const treeId = tree.id || null;

        // Rebuild cache keys from the resolved treeId
        TREE_CACHE_KEY = 'tree_' + (treeId || 'default');
        MEMORIES_CACHE_KEY = 'memories_' + (treeId || 'default');

        const refreshMemories = async () => {
            if (!treeId) return;
            try {
                if (window.apiClient && window.apiClient.getMemoriesByTree) {
                    const apiMemories = await window.apiClient.getMemoriesByTree(treeId);
                    if (Array.isArray(apiMemories)) {
                        window.currentTreeMemories = apiMemories.map(normalizeMemory).filter(Boolean);
                        console.log('[editor] Memories refreshed:', window.currentTreeMemories.length);
                        if (typeof initCanvas === 'function') initCanvas();
                        if (typeof updateSidebarStatus === 'function') updateSidebarStatus();
                    }
                }
            } catch (e) {
                console.warn('[editor] Failed to refresh memories:', e.message);
            }
        };
        window.refreshMemories = refreshMemories;

        // Normalize API responses through the shared utility.
        // Backend returns a flat camelCase shape, so mem.data handling is unnecessary.
        // Contract: window.currentTreeMemories always stores normalized memory objects.
        let normalizeWarningShown = false;
        const normalizeMemory = window.LoveBudNormalize?.normalizeMemory || ((mem) => {
            // Fallback: local normalizer when the shared util is unavailable
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
                visibility: mem.visibility || 'public',
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

        // Load memories from cache first
        let memories = [];

        // 1) Check cached memories first
        const cachedMemories = cache ? cache.get(MEMORIES_CACHE_KEY) : null;
        if (cachedMemories && Array.isArray(cachedMemories)) {
            console.log('[editor] Using cached memories:', cachedMemories.length);
            memories = cachedMemories;
            window.currentTreeMemories = memories.map(normalizeMemory).filter(Boolean);
            // initCanvas() is called later, so only seed state here once
        }

        // 2) Refresh from the API in the background
        try {
            if (window.apiClient && window.apiClient.getMemoriesByTree) {
                const apiMemories = await window.apiClient.getMemoriesByTree(treeId);
                if (Array.isArray(apiMemories)) {
                    memories = apiMemories;
                    console.log('[editor] API memories loaded:', apiMemories.length);
                    // Cache update
                    if (cache) {
                        cache.set(MEMORIES_CACHE_KEY, memories, 2 * 60 * 1000); // 2 min TTL
                    }
                }
            }
        } catch (e) {
            console.warn('[editor] API getMemoriesByTree failed:', e.message);
            if (e.message?.includes('401') || e.message?.includes('403')) {
                showToast(i18n('data_load_fail_demo'), 'warn');
            }
            // If API fails but cache exists, keep using the cache
        }

        if (memories.length === 0 && !cachedMemories) {
            memories = typeof getMemoriesByTree === 'function' ? getMemoriesByTree(treeId) : [];
        }

        // Contract: always store normalized memory state
        window.currentTreeMemories = memories.map(normalizeMemory).filter(Boolean);

        // Choose the initial root selection
        const createInitialMemory = () => {
            const memories = treeMemories();
            // Find canonical root: prefer a single parentId === null root, then fallback to id === 'root'
            const rootMem = findRootMemory(memories);
            if (rootMem) return rootMem;
            if (memories.length > 0) return memories[0];

            // Empty tree detection: no memories means an empty tree
            const isNewTree = memories.length === 0;

            return {
                id: canonicalRootId,
                treeId: treeId,
                // Clear placeholder title for an empty tree
                title: isNewTree ? i18n('first_memory') : i18n('first_memory'),
                memo: i18n('no_memory_yet'),
                timestamp: new Date().toISOString().slice(0,10).replace(/-/g,'.'),
                // Dedicated empty-tree illustration
                thumbnail: isNewTree
                    ? 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect fill="%23e8f5e9" width="120" height="90"/><text x="60" y="45" text-anchor="middle" fill="%234caf50" font-size="24">🌱</text><text x="60" y="70" text-anchor="middle" fill="%23666" font-size="10">빈 트리</text></svg>'
                    : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect fill="%23f5f5f5" width="120" height="90"/><text x="60" y="50" text-anchor="middle" fill="%23999" font-size="12">No Memory</text></svg>',
                emotionTags: [],
                parentId: null,
                // Mark as a synthetic empty-tree placeholder
                isNewTree: isNewTree
            };
        };

        // Define treeMemories before other helpers use it (avoid TDZ issues)
        const treeMemories = () => (window.currentTreeMemories || []).map(normalizeMemory);

        // Compute canonical root ID once and keep it stable for this editor session.
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

        const centerOnMemory = (mem) => {
            if (!mem) return;
            centerOnLogicalPos(calcPosition(mem));
        };

        const updateSidebarSummary = () => {
            const treeTitleEl = document.getElementById('sidebarTreeTitle');
            const momentCountEl = document.getElementById('sidebarMomentCount');
            if (treeTitleEl) {
                treeTitleEl.textContent = resolveTreeTitleText(window.currentTreeData && window.currentTreeData.title);
            }
            if (momentCountEl) {
                const count = treeMemories().filter(m => !isRootMemory(m, canonicalRootId)).length;
                momentCountEl.textContent = `순간 ${count}개`;
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

        // Layout constants
        const ROOT_X = Math.max(460, Math.round(canvas.clientWidth * 0.42));
        const ROOT_Y = Math.max(420, Math.round(canvas.clientHeight * 0.52));
        const RADIUS_L1 = 320;
        const RADIUS_L2 = 250;
        const NODE_WIDTH = 108;
        const MIN_ANGLE_GAP = 40;

        const FIXED_ANGLES = {
            v1: -60, v2: -130, v3: 10,
            m2: 130, m3: -170, m4: 70
        };

        // Angle distribution helper
        // Spread siblings evenly while keeping a minimum gap.
        const distributeAngles = (count, baseAngle = -90) => {
            if (count <= 0) return [baseAngle];
            if (count === 1) return [baseAngle];

            const safeCount = Math.max(count - 1, 1);
            const totalSpread = Math.min(300, Math.max(110, safeCount * MIN_ANGLE_GAP));
            const startAngle = baseAngle - totalSpread / 2;

            return Array.from({ length: count }, (_, i) => {
                const ratio = count === 1 ? 0.5 : i / (count - 1);
                return startAngle + totalSpread * ratio;
            });
        };

        const calcPosition = (mem, visited = new Set()) => {
            // Position relative to the canonical root
            if (isRootMemory(mem, canonicalRootId)) return { x: ROOT_X, y: ROOT_Y };

            // Prevent circular references
            if (visited.has(mem.id)) {
                console.warn(`Cycle detected at memory ${mem.id}, falling back to root`);
                return { x: ROOT_X, y: ROOT_Y };
            }
            visited.add(mem.id);

            const parentId = mem.parentId || canonicalRootId;

            // Prevent self-reference
            if (parentId === mem.id) {
                console.warn(`Self-reference detected for ${mem.id}, using root as parent`);
                return { x: ROOT_X, y: ROOT_Y };
            }

            // Siblings share the same parent and exclude the canonical root.
            const siblings = treeMemories().filter(m =>
                m.parentId === parentId && !isRootMemory(m, canonicalRootId)
            );
            const idx = siblings.findIndex(m => m.id === mem.id); // Prefer findIndex for object-safe lookup
            const count = siblings.length;

            if (parentId === canonicalRootId) {
                let angle;

                if (FIXED_ANGLES[mem.id] !== undefined) {
                    angle = FIXED_ANGLES[mem.id];
                } else if (count > 0) {
                    const angles = distributeAngles(count, -20);
                    angle = angles[idx] !== undefined ? angles[idx] : angles[0];
                } else {
                    angle = -20;
                }

                return {
                    x: ROOT_X + RADIUS_L1 * Math.cos(angle * Math.PI / 180),
                    y: ROOT_Y + RADIUS_L1 * Math.sin(angle * Math.PI / 180)
                };
            }

            // L2: spread around the parent branch
            const parent = treeMemories().find(m => m.id === parentId);
            const parentPos = parent ? calcPosition(parent, visited) : { x: ROOT_X, y: ROOT_Y };

            // Spread siblings with minimum angular separation
            let angle;
            if (count > 0) {
                const angles = distributeAngles(count, 0); // centered around 0 degrees
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

        const detailUI = window.createEditorDetailUI({
            detailPanel,
            i18n,
            resolveTreeTitleText,
            resolveHintText,
            resolveInfoText,
            resolveMemoryThumbnail,
            escapeHtml,
            isRootMemory,
            getCanonicalRootId: () => canonicalRootId,
            getSelectedNodeId: () => selectedNodeId,
            getTreeMemories: () => treeMemories(),
            getCurrentTreeData: () => window.currentTreeData || {},
            getLocalSaveMode: () => isLocalSaveMode,
            showToast
        });

        const {
            setDetailEmptyState,
            updateFocusSelectedBtn,
            updateSidebarStatus,
            updateDetailPanel
        } = detailUI;

        window.updateDetailPanel = updateDetailPanel;

        let currentEditingMemory = null;

        const memoryActions = window.createEditorMemoryActions({
            i18n,
            updateSaveStatus,
            updateDetailPanel,
            updateSidebarStatus,
            showToast,
            getCurrentEditingMemory: () => currentEditingMemory,
            setCurrentEditingMemory: (value) => {
                currentEditingMemory = value;
            },
            getTreeMemories: () => window.currentTreeMemories || [],
            setTreeMemories: (value) => {
                window.currentTreeMemories = value;
            },
            getSelectedNodeId: () => selectedNodeId,
            setSelectedNodeId: (value) => {
                selectedNodeId = value;
            },
            getCanonicalRootId: () => canonicalRootId,
            isRootMemory,
            findRootMemory,
            detailPanel,
            svg,
            calcPosition,
            setDetailEmptyState
        });

        const {
            enterEditMode,
            exitEditMode,
            saveMemoryEdit,
            deleteMemory
        } = memoryActions;

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
            updateFocusSelectedBtn();
            setDetailEmptyState(false);
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

        // drawRoot removed to prevent exposing the red root marker
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
            // Avoid drawing duplicate nodes with the same memory id
            const existingNode = document.querySelector(`.memory-node[data-memory-id="${mem.id}"]`);
            if (existingNode) {
                console.log('[editor] Node already exists, skipping:', mem.id);
                return;
            }
            const pos = calcPosition(mem);
            const nodeEl = document.createElement('div');
            nodeEl.className = 'memory-node floating-node';
            nodeEl.dataset.memoryId = mem.id;
            const nodeHalf = Math.round(NODE_WIDTH / 2);
            nodeEl.style.left = `${pos.x - nodeHalf}px`;
            nodeEl.style.top = `${pos.y - nodeHalf}px`;
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
            img.src = resolveMemoryThumbnail(mem);
            img.alt = mem.title || '';
            
            img.onload = () => {
                img.classList.add('loaded');
                skeleton.style.display = 'none';
            };
            
            img.onerror = () => {
                const currentSrc = img.getAttribute('src') || '';

                if (currentSrc.includes('/hqdefault.jpg')) {
                    img.src = currentSrc.replace('/hqdefault.jpg', '/mqdefault.jpg');
                    return;
                }

                if (currentSrc.includes('/mqdefault.jpg')) {
                    img.src = currentSrc.replace('/mqdefault.jpg', '/default.jpg');
                    return;
                }

                img.style.display = 'none';
                skeleton.classList.add('error');
                skeleton.textContent = '♪';
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
            // 기존 노드 중복 방지: 초기화 시 기존 DOM 노드 제거
            canvas.querySelectorAll('.memory-node').forEach(n => n.remove());
            canvas.querySelectorAll('#emptyTreeMessage').forEach(el => el.remove());
            svg.querySelectorAll('.branch-line').forEach(l => l.remove());

            // 트리가 비어있으면 선택 상태 초기화 및 상세 패널 empty state로
            const hasMoments = treeMemories().length > 0;
            if (!hasMoments) {
                selectedNodeId = null;
                setDetailEmptyState(true);
            } else {
                setDetailEmptyState(false);
            }
            updateFocusSelectedBtn();

            treeMemories().forEach(node => {
                if (isRootMemory(node, canonicalRootId)) return; // canonical root?skip
                drawNode(node);
                const parentId = node.parentId || canonicalRootId;
                const parent = treeMemories().find(m => m.id === parentId);
                if (parent) drawBranch(calcPosition(parent), calcPosition(node));
            });

            // 트리가 비어있지 않을 때만 첫 메모리 선택
            if (hasMoments) {
                const selectedMem = createInitialMemory();
                if (selectedMem) {
                    updateDetailPanel(selectedMem);
                }
            }
        };

        // Save status indicator state
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
                    // Hide last-saved time while actively saving
                    if (timeEl) timeEl.style.display = 'none';
                    break;
                case 'saved':
                    iconEl.textContent = 'check_circle';
                    textEl.textContent = message || i18n('save_saved');
                    indicator.className = 'save-status-indicator saved';
                    saveStatusData.lastSaved = new Date();
                    // Restore last-saved time after a successful save
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
                    // Hide last-saved time after a failed save
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

        const memoryForm = window.createEditorMemoryForm({
            i18n,
            treeId,
            getSelectedNodeId: () => selectedNodeId,
            getCanonicalRootId: () => canonicalRootId,
            resolveParentIdForCreate,
            updateSaveStatus,
            showToast,
            getYouTubeInputErrorMessage,
            nextMemoryId,
            normalizeMemory,
            getTreeMemories: () => window.currentTreeMemories || [],
            setTreeMemories: (value) => {
                window.currentTreeMemories = value;
            },
            setLocalSaveMode: (value) => {
                isLocalSaveMode = value;
            },
            getLocalSaveMode: () => isLocalSaveMode,
            drawNode,
            drawBranch,
            calcPosition,
            updateSidebarStatus,
            updateFocusSelectedBtn,
            setDetailEmptyState,
            selectNode,
            treeMemories,
            setCachedMemories: window.setCachedMemories,
            canvasArea: canvas
        });

        const {
            showAddMemoryForm,
            hideAddMemoryForm,
            addMemoryFromForm
        } = memoryForm;

        const urlInput = document.getElementById('memoryUrlInput');
        const titleInput = document.getElementById('memoryTitleInput');
        const memoInput = document.getElementById('memoryMemoInput');
        const cancelBtn = document.getElementById('cancelAddMemory');
        const confirmBtn = document.getElementById('confirmAddMemory');

        // Button event listeners
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showAddMemoryForm();
            });
        }
        if (cancelBtn) cancelBtn.addEventListener('click', hideAddMemoryForm);
        if (confirmBtn) {
             confirmBtn.addEventListener('click', (e) => {
                 e.preventDefault();
                 addMemoryFromForm().catch(err => {
                     console.error('[editor] Failed to add memory:', err);
                     updateSaveStatus('failed', i18n('save_failed'));
                     showToast(i18n('record_error') || '기록 중 오류가 발생했습니다', 'error');
                 });
             });
        }

        // Enter key submit shortcuts
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

        // Hide unimplemented buttons for now
        const hideUnimplementedButtons = () => {
            const moreBtn = detailPanel.querySelector('.icon-btn');
            const footerBtn = detailPanel.querySelector('.panel-footer');
            if (moreBtn) moreBtn.style.display = 'none';
            if (footerBtn) footerBtn.style.display = 'none';
        };
        hideUnimplementedButtons();

        initCanvas();

        // Detail panel edit/delete button listeners
        const editMemoryBtn = document.getElementById('editMemoryBtn');
        const deleteMemoryBtn = document.getElementById('deleteMemoryBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const saveEditBtn = document.getElementById('saveEditBtn');

        if (editMemoryBtn) editMemoryBtn.addEventListener('click', enterEditMode);
        if (deleteMemoryBtn) deleteMemoryBtn.addEventListener('click', deleteMemory);
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', exitEditMode);
        if (saveEditBtn) saveEditBtn.addEventListener('click', saveMemoryEdit);

        console.log('[editor] Ready for tree:', treeId, 'memories:', treeMemories().length);
        updateSidebarStatus();
    };

    // Same auth-guard pattern as my-trees.js
    // If there is no user, check cache and redirect; otherwise continue to startEditor.
    var editorStarted = false;

    // Confirmed session helper (from auth.js or local fallback)
    function getConfirmedSessionUser() {
      try {
        if (window.getConfirmedAuthUser) {
          return window.getConfirmedAuthUser();
        }
        if (localStorage.getItem('lovebud_auth_confirmed') === 'true') {
          var raw = localStorage.getItem('lovebud_auth_cache');
          if (raw && raw !== 'null') {
            return JSON.parse(raw);
          }
        }
      } catch (e) {}
      return null;
    }

    function tryStartEditor(user) {
        // If the editor already started and real auth arrives later, try re-fetching data
        if (editorStarted) {
            if (user && (!window.currentTreeMemories || window.currentTreeMemories.length <= 1)) {
                console.log('[editor] Real user detected late, re-fetching data...');
                // Use the shared refresh helper if available
                if (window.refreshMemories) window.refreshMemories();
            }
            return;
        }

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
            // Proceed with confirmed cached auth
        }

        editorStarted = true;
        console.log('[editor] Auth confirmed, starting editor (user source: ' + (user ? 'firebase' : 'cache') + ')');
        startEditor();
    }

    // DOMContentLoaded: confirmed session이 있으면 즉시 boot (before auth ready callback)
    var cachedUser = getConfirmedSessionUser();
    if (cachedUser) {
        console.log('[editor] Booting immediately from confirmed session cache');
        tryStartEditor(cachedUser);
    }

    // Use the callback-array auth pattern when available
    if (typeof window.registerOnAuthReady === 'function') {
        window.registerOnAuthReady(tryStartEditor);
    } else {
        window.onAuthReady = tryStartEditor;
    }
});
