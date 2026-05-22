document.addEventListener('DOMContentLoaded', () => {
    const dataLoaderFallbacks = window.LoveBudEditorDataLoaderFallbacks || {};
    const entryFallbacks = window.LoveBudEditorEntryFallbacks || {};
    const resolverFallbacks = window.LoveBudEditorResolverFallbacks || {};
    const shellHelpers = window.LoveBudEditorShellHelpers || {};

    let rootHelperWarningShown = false;
    const rootUtils = window.LoveBudEditorUtils || {};
    const editorHelpers = window.LoveBudEditorHelpers || {};

    const warnRootHelperFallback = () => {
        if (!rootHelperWarningShown) {
            console.warn('[editor] LoveBudEditorUtils not loaded, using local fallback for root helpers');
            rootHelperWarningShown = true;
        }
    };

    const findRootMemory = rootUtils.findRootMemory || function(memories) {
        warnRootHelperFallback();
        if (!Array.isArray(memories)) return null;

        const parentNullNodes = memories.filter(m => m.parentId === null || m.parentId === undefined);
        if (parentNullNodes.length === 1) {
            return parentNullNodes[0];
        }
        if (parentNullNodes.length > 1) {
            const oldest = parentNullNodes.sort((a, b) => {
                const aTime = a.createdAt || a.timestamp || '9999';
                const bTime = b.createdAt || b.timestamp || '9999';
                return new Date(aTime) - new Date(bTime);
            })[0];
            return oldest;
        }

        return memories.find(m => m.id === 'root') || null;
    };

    const getRootId = rootUtils.getRootId || function(memories) {
        warnRootHelperFallback();
        const root = findRootMemory(memories);
        return root ? root.id : 'root';
    };

    const getCanonicalRootId = rootUtils.getCanonicalRootId || function(memories) {
        warnRootHelperFallback();
        const root = findRootMemory(memories);
        return root ? root.id : 'root';
    };

    const isRootMemory = rootUtils.isRootMemory || function(mem, rootId) {
        warnRootHelperFallback();
        return !!(mem && rootId && mem.id === rootId);
    };

    const editorSaveStatus = window.LoveBudEditorSaveStatus || {};
    const editorPageHelpers = window.LoveBudEditorPageHelpers || {};
    const editorTreeHelpers = window.LoveBudEditorTreeHelpers || {};
    const editorBindings = window.LoveBudEditorBindings || {};
    const editorDataLoader = window.LoveBudEditorDataLoader || {};
    const editorAuthHelpers = window.LoveBudEditorAuthHelpers || {};
    const readConfirmedAuthCacheFromHelper = () => (
        window.LoveBudEditorAuthHelpers?.readConfirmedAuthCache?.() || null
    );
    const getConfirmedSessionUser = function() {
        try {
            if (window.LoveBudProtectedRoute) {
                var state = window.LoveBudProtectedRoute.getAuthState();
                if (state.ready && state.user) return state.user;
            }
            if (window.getConfirmedAuthUser) return window.getConfirmedAuthUser();
        } catch (e) {}
        return readConfirmedAuthCacheFromHelper();
    };
    const hasConfirmedSessionUser = editorAuthHelpers.hasConfirmedSessionUser || (() => !!getConfirmedSessionUser());

    const getHttpStatus = (error) => Number(error?.status || error?.statusCode || error?.response?.status || 0);



    const createInlineShowToastFallback = shellHelpers.createInlineShowToastFallback ||
        entryFallbacks.createInlineShowToastFallback;

    const showToast = editorHelpers.createToast
        ? editorHelpers.createToast({ warningKey: '__editorToastWarningShown' })
        : createInlineShowToastFallback();

    const getI18n = shellHelpers.getI18n || (() => window.t || ((k) => k));
    const i18n = getI18n();

    const getEditorBasePath = shellHelpers.getEditorBasePath || (() =>
        window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/');

    const buildEditorRedirectTarget = shellHelpers.buildEditorRedirectTarget || (() =>
        getEditorBasePath() + 'editor' + (window.location.search || ''));

    const createInlineRedirectToEditorLoginFallback = entryFallbacks.createInlineRedirectToEditorLoginFallback;

    const redirectToEditorLogin = editorPageHelpers.redirectToEditorLogin || createInlineRedirectToEditorLoginFallback({
        getEditorBasePath,
        buildEditorRedirectTarget
    });

    const createInlineTextResolversFallbacks = resolverFallbacks.createInlineTextResolversFallbacks || (() => ({}));
    const inlineTextResolvers = editorHelpers.safeI18nText
        ? editorHelpers
        : createInlineTextResolversFallbacks();

    const safeI18nText = editorHelpers.safeI18nText || inlineTextResolvers.safeI18nText;
    const resolveHintText = editorHelpers.resolveHintText || inlineTextResolvers.resolveHintText;
    const resolveTreeTitleText = editorHelpers.resolveTreeTitleText || inlineTextResolvers.resolveTreeTitleText;
    const resolveInfoText = editorHelpers.resolveInfoText || inlineTextResolvers.resolveInfoText;

    const syncCurrentTreeData = editorTreeHelpers.syncCurrentTreeData || ((tree) => {
        window.currentTreeData = {
            ...tree,
            visibility: tree.visibility || 'public'
        };
    });

    const resolveParentIdForCreate = editorTreeHelpers.resolveParentIdForCreate || ((selectedNodeId, canonicalRootId) => {
        if (!selectedNodeId || selectedNodeId === canonicalRootId) {
            return canonicalRootId === 'root' ? null : canonicalRootId;
        }
        return selectedNodeId;
    });

    const getMyTreesHref = editorPageHelpers.getMyTreesHref || (() => getEditorBasePath() + 'my-trees');
    const createInlineMediaResolversFallbacks = resolverFallbacks.createInlineMediaResolversFallbacks || (() => ({}));

    const escapeHtml = editorHelpers.escapeHtml || ((value) => {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    });

    const inlineMediaResolvers = editorHelpers.safeUrl
        ? editorHelpers
        : createInlineMediaResolversFallbacks();

    const resolveMemoryThumbnail = editorHelpers.resolveMemoryThumbnail || inlineMediaResolvers.resolveMemoryThumbnail;

    const getYouTubeInputErrorMessage = rootUtils.getYouTubeInputErrorMessage || ((i18n, rawUrl) => {
        warnRootHelperFallback();
        const value = String(rawUrl || '').trim();
        if (!value) return i18n('enter_youtube') || 'YouTube 링크를 입력해 주세요.';
        const looksLikeUrl = /^(https?:\/\/|www\.)/i.test(value);
        const hasYouTubeHint = /(youtube\.com|youtu\.be|youtube\.com\/shorts\/)/i.test(value);
        const idLikeMatch = value.match(/(?:v=|\/|youtu\.be\/|shorts\/)([0-9A-Za-z_-]+)/i);
        const candidateId = idLikeMatch ? idLikeMatch[1] : '';
        if (!looksLikeUrl) return i18n('invalid_youtube_format') || '전체 YouTube 링크를 붙여 넣어 주세요.';
        if (!hasYouTubeHint) return i18n('invalid_youtube_unsupported') || 'YouTube 링크만 지원합니다. youtube.com 또는 youtu.be 링크를 사용해 주세요.';
        if (candidateId && candidateId.length !== 11) return i18n('invalid_youtube_id_length') || '링크가 중간에 잘린 것 같아요. 전체 YouTube 링크를 다시 복사해 주세요.';
        return i18n('invalid_youtube') || '유효한 YouTube 링크를 입력해 주세요.';
    });

    const renderTreeLoadError = editorPageHelpers.renderTreeLoadError ||
        entryFallbacks.createInlineRenderTreeLoadErrorFallback({ getMyTreesHref });
    const createInlineNextMemoryIdFallback = dataLoaderFallbacks.createInlineNextMemoryIdFallback || ((options) => () => 'm1');
    const createInlineFormatTimeAgoFallback = entryFallbacks.createInlineFormatTimeAgoFallback;

    const markEditorReady = () => document.body?.classList.remove('editor-preload');

    const editorShellCopyApplier = window.LoveBudEditorShellCopyApplier || {};
    const createEditorShellCopyApplier = editorShellCopyApplier.createEditorShellCopyApplier || (() => () => {});
    const createPrepareEditorShell = editorShellCopyApplier.createPrepareEditorShell || (() => () => {});

    const applyEditorShellCopy = shellHelpers.applyEditorShellCopy ||
        createEditorShellCopyApplier({ safeI18nText, i18n });

    applyEditorShellCopy(safeI18nText, i18n);

    const editorDomRefsBuilder = window.LoveBudEditorDomRefsBuilder || {};
    const createEditorDomRefs = editorDomRefsBuilder.createEditorDomRefs || (() => ({
        canvas: document.getElementById('canvasArea'),
        svg: document.getElementById('canvasSvg'),
        detailPanel: document.getElementById('detailPanel'),
        addBtn: document.getElementById('addMemoryBtn')
    }));
    const createEditorFormRefs = editorDomRefsBuilder.createEditorFormRefs || (() => ({
        urlInput: document.getElementById('memoryUrlInput'),
        titleInput: document.getElementById('memoryTitleInput'),
        memoInput: document.getElementById('memoryMemoInput'),
        cancelBtn: document.getElementById('cancelAddMemory'),
        confirmBtn: document.getElementById('confirmAddMemory')
    }));

    const prepareEditorShell = createPrepareEditorShell({ applyEditorShellCopy, safeI18nText, i18n, getMyTreesHref });


    const startEditor = async () => {
        // Wait for ESM module (editor-canvas.js) to be loaded
        let retryCount = 0;
        while (typeof window.createEditorCanvas !== 'function' && retryCount < 50) {
            await new Promise(resolve => setTimeout(resolve, 50));
            retryCount++;
        }
        if (typeof window.createEditorCanvas !== 'function') {
            console.error('[editor] window.createEditorCanvas is not loaded in time. ESM loading may have failed.');
            return;
        }

        const { canvas, svg, detailPanel, addBtn } = createEditorDomRefs();
        const urlParams = new URLSearchParams(window.location.search);
        const urlTreeId = urlParams.get('treeId');

        prepareEditorShell();

        const cache = window.LoveBudCache || null;
        let MEMORIES_CACHE_KEY = 'memories_default';
        let isLocalSaveMode = false;

        const loadInitialTree = editorDataLoader.loadInitialEditorTree;
        if (typeof loadInitialTree !== 'function') {
            console.error('[editor] LoveBudEditorDataLoader.loadInitialEditorTree is not loaded');
            return;
        }
        const treeLoadResult = await loadInitialTree({
            urlTreeId,
            apiClient: window.apiClient,
            createDefaultTreeTitle: () => safeI18nText(i18n, 'default_tree_title', '러브트리'),
            getConfirmedSessionUser
        });

        let tree = treeLoadResult.tree || null;
        if (!tree) {
            if (treeLoadResult.authRequired) {
                showToast(i18n('need_login'), 'error');
                redirectToEditorLogin(2000);
                return;
            }
            if (urlTreeId) {
                const treeLoadStatus = treeLoadResult.treeLoadStatus || 'not_found';
                const treeLoadErrorMessage = treeLoadResult.treeLoadErrorMessage || '';
                const errorTitle = treeLoadStatus === 'api_unavailable'
                    ? (i18n('tree_load_fail_title') || '트리를 불러올 수 없어요')
                    : /Access denied/i.test(treeLoadErrorMessage)
                        ? (i18n('tree_access_denied_title') || '이 러브트리를 열 권한이 없어요')
                        : treeLoadStatus === 'error'
                            ? (i18n('tree_load_error_title') || '트리를 여는 중 문제가 발생했어요')
                            : (i18n('tree_not_found_title') || '트리를 찾을 수 없어요');
                const errorDesc = treeLoadStatus === 'api_unavailable'
                    ? (i18n('tree_load_api_unavailable') || '트리 조회 API를 사용할 수 없는 상태입니다. 잠시 후 다시 시도해 주세요.')
                    : /Access denied/i.test(treeLoadErrorMessage)
                        ? (i18n('tree_access_denied_desc') || '비공개 러브트리이거나 내 계정에 권한이 없어요. 다시 확인하거나 다른 계정으로 로그인해 보세요.')
                        : treeLoadStatus === 'error'
                            ? (i18n('tree_load_error_desc') || '일시적인 서버 문제 또는 접근 권한 문제일 수 있습니다. 다시 시도하거나 트리 목록으로 돌아가 주세요.')
                            : (i18n('tree_load_not_found_desc') || '잘못된 링크이거나 접근 권한이 없는 트리입니다.');
                renderTreeLoadError({ canvas, addBtn, errorTitle, errorDesc, i18n, escapeHtml, setDetailEmptyState: null });
                markEditorReady();
                return;
            }
            markEditorReady();
            return;
        }

        syncCurrentTreeData(tree);
        const treeId = tree.id || null;
        MEMORIES_CACHE_KEY = 'memories_' + (treeId || 'default');

        if (typeof editorDataLoader.createNormalizeMemory !== 'function') {
            console.error('[editor] LoveBudEditorDataLoader.createNormalizeMemory is not loaded');
            return;
        }
        const normalizeMemory = editorDataLoader.createNormalizeMemory({ sharedNormalize: window.LoveBudNormalize?.normalizeMemory });

        if (typeof editorDataLoader.loadEditorMemories !== 'function') {
            console.error('[editor] LoveBudEditorDataLoader.loadEditorMemories is not loaded');
            return;
        }
        await editorDataLoader.loadEditorMemories({
            treeId,
            cache,
            cacheKey: MEMORIES_CACHE_KEY,
            apiClient: window.apiClient,
            showToast,
            i18n,
            normalizeMemory
        });
        const treeMemories = () => (window.currentTreeMemories || []).map(normalizeMemory).filter(Boolean);
        const canonicalRootId = getCanonicalRootId(treeMemories());
        let selectedNodeId = canonicalRootId;
        let currentEditingMemory = null;
        let editorCanvas = null;

        let memoryActions = null;
        const updateSelectedMemoryFields = async (...args) => {
            if (!memoryActions || typeof memoryActions.updateSelectedMemoryFields !== 'function') {
                console.warn('[editor] updateSelectedMemoryFields called before memory actions are ready');
                return false;
            }
            return memoryActions.updateSelectedMemoryFields(...args);
        };

        if (typeof editorTreeHelpers.createInitialMemory !== 'function') {
            console.error('[editor] LoveBudEditorTreeHelpers.createInitialMemory is not loaded');
            return;
        }
        const createInitialMemory = () => editorTreeHelpers.createInitialMemory({ getTreeMemories: () => treeMemories(), findRootMemory, canonicalRootId, treeId, i18n });

        const nextMemoryId = editorTreeHelpers.nextMemoryIdFromMemories
            ? () => editorTreeHelpers.nextMemoryIdFromMemories(treeMemories())
            : createInlineNextMemoryIdFallback({ treeMemories });

        const updateCanvasEmptyGuide = () => {
            const guide = document.getElementById('canvasEmptyGuide');
            if (!guide) return;
            const hasMoments = treeMemories().length > 0;
            guide.classList.toggle('editor-canvas-empty-guide-hidden', hasMoments);
        };

        const selectNode = (el, data) => {
            if (!data) return;
            selectedNodeId = data.id;
            currentEditingMemory = data;
            document.querySelectorAll('.memory-node').forEach(n => n.classList.remove('selected'));
            if (el) el.classList.add('selected');

            const indicator = document.getElementById('saveStatusIndicator');
            if (indicator && saveStatusData.timer) {
                clearTimeout(saveStatusData.timer);
                saveStatusData.timer = null;
            }
            if (indicator) indicator.style.display = 'none';

            updateDetailPanel(data);
            updateFocusSelectedBtn();
            setDetailEmptyState(false);

            // Immediately update the + tip affordance for the newly selected node
            if (editorCanvas && typeof editorCanvas.updateAffordance === 'function') {
                editorCanvas.updateAffordance();
            }
        };

        const focusSelectedMoment = () => {
            if (editorCanvas && typeof editorCanvas.focusNodeById === 'function' && selectedNodeId) {
                editorCanvas.focusNodeById(selectedNodeId);
            }
        };

        const openCurrentMomentDetail = () => {
            const activeMemory = currentEditingMemory || treeMemories().find((m) => m.id === selectedNodeId) || createInitialMemory();
            if (!activeMemory || !activeMemory.id || !treeId) return;
            const detailHref = getEditorBasePath() + 'detail.html?id=' + encodeURIComponent(activeMemory.id) + '&tree=' + encodeURIComponent(treeId) + '&from=editor';
            window.location.href = detailHref;
        };

        const updateTreeVisibility = async (nextVisibility) => {
            if (!treeId || !window.apiClient || typeof window.apiClient.updateTree !== 'function') {
                throw new Error('updateTree not available');
            }
            const updatedTree = await window.apiClient.updateTree(treeId, { visibility: nextVisibility });
            window.currentTreeData = {
                ...(window.currentTreeData || {}),
                ...(updatedTree || {}),
                visibility: updatedTree?.visibility || nextVisibility
            };
            updateSidebarStatus();
            if (currentEditingMemory) updateDetailPanel(currentEditingMemory);
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
            showToast,
            updateTreeVisibility,
            openCurrentMomentDetail,
            focusSelectedMoment,
            updateSelectedMemoryFields
        });

        const { setDetailEmptyState, updateFocusSelectedBtn, updateSidebarStatus: updateSidebarStatusBase, updateDetailPanel } = detailUI;
        window.updateDetailPanel = updateDetailPanel;

        const sidebarUIHelper = window.LoveBudEditorSidebarUI || {};
        const updateSidebarTreeActions = () => {
            if (sidebarUIHelper.updateSidebarTreeActions) {
                sidebarUIHelper.updateSidebarTreeActions({ i18n, safeI18nText, getTreeId: () => treeId });
            }
        };

        const updateSidebarStatus = () => {
            updateSidebarStatusBase();
            updateCanvasEmptyGuide();
            updateSidebarTreeActions();
        };

        editorCanvas = window.createEditorCanvas({
            canvas,
            svg,
            getTreeMemories: () => treeMemories(),
            getCanonicalRootId: () => canonicalRootId,
            isRootMemory,
            resolveMemoryThumbnail,
            updateDetailPanel,
            setDetailEmptyState,
            updateFocusSelectedBtn,
            createInitialMemory,
            onNodeClick: selectNode,
            openAddMoment: () => showAddMemoryForm()
        });

        // Store instance for global bridge
        if (canvas) canvas.__editorCanvasInstance = editorCanvas;

        const { calcPosition, drawBranch, drawNode, initCanvas } = editorCanvas;

        const handleMemoriesUpdated = () => {
            console.log(`[editor] Memories updated. Initializing canvas...`);
            initCanvas();
            updateSidebarStatus();
            if (currentEditingMemory) {
                const refreshedEditingMemory = treeMemories().find((memory) => memory.id === currentEditingMemory.id);
                if (refreshedEditingMemory && !isRootMemory(refreshedEditingMemory, canonicalRootId)) {
                    currentEditingMemory = refreshedEditingMemory;
                    updateDetailPanel(refreshedEditingMemory);
                }
            }
        };

        if (typeof editorDataLoader.createRefreshMemories !== 'function') {
            console.error('[editor] LoveBudEditorDataLoader.createRefreshMemories is not loaded');
            return;
        }
        const refreshMemories = editorDataLoader.createRefreshMemories({ treeId, apiClient: window.apiClient, normalizeMemory, onMemoriesUpdated: handleMemoriesUpdated });
        window.refreshMemories = refreshMemories;

        const formatTimeAgo = editorSaveStatus.formatTimeAgo || createInlineFormatTimeAgoFallback();

        const saveStatusOrchestrationHelper = window.LoveBudEditorSaveStatusOrchestration || {};
        const createEditorSaveStatusOrchestration = saveStatusOrchestrationHelper.createEditorSaveStatusOrchestration || (() => {
            console.warn('[editor] LoveBudEditorSaveStatusOrchestration not loaded, using minimal fallback');
            let saveStatusData = { status: 'saved', lastSaved: null, timer: null };
            return {
                saveStatusData,
                updateSaveStatus: (status, message) => {
                    saveStatusData.status = status;
                }
            };
        });

        const { saveStatusData, updateSaveStatus } = createEditorSaveStatusOrchestration({ editorSaveStatus, i18n, formatTimeAgo });

        memoryActions = window.createEditorMemoryActions({
            i18n,
            updateSaveStatus,
            updateDetailPanel,
            updateSidebarStatus,
            showToast,
            getCurrentEditingMemory: () => currentEditingMemory,
            setCurrentEditingMemory: (value) => { currentEditingMemory = value; },
            getTreeMemories: () => window.currentTreeMemories || [],
            setTreeMemories: (value) => { window.currentTreeMemories = value; },
            getSelectedNodeId: () => selectedNodeId,
            setSelectedNodeId: (value) => { selectedNodeId = value; },
            getCanonicalRootId: () => canonicalRootId,
            isRootMemory,
            findRootMemory,
            detailPanel,
            svg,
            calcPosition,
            setDetailEmptyState,
            rerenderCanvas: () => initCanvas(),
            getCurrentTreeData: () => window.currentTreeData || {},
            isLocalSaveMode: () => isLocalSaveMode
        });

        const { enterEditMode, exitEditMode, saveMemoryEdit, deleteMemory } = memoryActions;

        const memoryForm = window.createEditorMemoryForm({
            i18n,
            treeId,
            getSelectedNodeId: () => selectedNodeId,
            getCanonicalRootId: () => canonicalRootId,
            resolveParentIdForCreate,
            updateSaveStatus,
            showToast,
            getYouTubeInputErrorMessage: (rawUrl) => getYouTubeInputErrorMessage(i18n, rawUrl),
            nextMemoryId,
            normalizeMemory,
            getTreeMemories: () => window.currentTreeMemories || [],
            setTreeMemories: (value) => { window.currentTreeMemories = value; },
            setLocalSaveMode: (value) => { isLocalSaveMode = value; },
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
            canvasArea: canvas,
            rerenderCanvas: () => initCanvas(),
            focusNodeById: (id) => editorCanvas.focusNodeById(id)
        });

        const { showAddMemoryForm, hideAddMemoryForm, addMemoryFromForm } = memoryForm;
        const { urlInput, titleInput, memoInput, cancelBtn, confirmBtn } = createEditorFormRefs();
        if (sidebarUIHelper.bindSidebarVisibilityToggle) {
            sidebarUIHelper.bindSidebarVisibilityToggle({
                getTreeId: () => treeId, updateTreeVisibility, showToast, safeI18nText, i18n, getHttpStatus, updateSidebarStatus
            });
        }

        if (editorBindings.bindMemoryCreateControls) {
            editorBindings.bindMemoryCreateControls({ addBtn, cancelBtn, confirmBtn, urlInput, titleInput, memoInput, showAddMemoryForm, hideAddMemoryForm, addMemoryFromForm, updateSaveStatus, showToast, i18n });
        }

        const detailEmptyStartBtn = document.getElementById('detailEmptyStartBtn');
        if (detailEmptyStartBtn) {
            detailEmptyStartBtn.addEventListener('click', () => {
                showAddMemoryForm();
            });
        }

        const emptyGuideUIHelper = window.LoveBudEditorEmptyGuideUI || {};
        let createMemoryFromCanvasUrl = () => {};
        if (emptyGuideUIHelper.bindEmptyGuideEvents) {
            const guideResult = emptyGuideUIHelper.bindEmptyGuideEvents({
                getEditorCanvas: () => editorCanvas,
                showAddMemoryForm,
                addMemoryFromForm,
                getTreeMemories: () => treeMemories(),
                showToast,
                i18n
            });
            if (guideResult && guideResult.createMemoryFromCanvasUrl) {
                createMemoryFromCanvasUrl = guideResult.createMemoryFromCanvasUrl;
            }
        }

        initCanvas();
        console.log(`[editor] Canvas initialized. treeMemories count: ${treeMemories().length}`);
        updateCanvasEmptyGuide();
        const initialSelection = treeMemories().find((memory) => memory.id === selectedNodeId) || createInitialMemory();
        if (initialSelection && !isRootMemory(initialSelection, canonicalRootId)) {
            currentEditingMemory = initialSelection;
            console.log(`[editor] Initial selection: ${initialSelection.id}`);
        } else {
            console.log(`[editor] No initial selection or root selected.`);
        }

        const editMemoryBtn = document.getElementById('editMemoryBtn');
        const deleteMemoryBtn = document.getElementById('deleteMemoryBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const saveEditBtn = document.getElementById('saveEditBtn');
        if (editorBindings.bindDetailActionButtons) {
            editorBindings.bindDetailActionButtons({ editMemoryBtn, deleteMemoryBtn, cancelEditBtn, saveEditBtn, enterEditMode, deleteMemory, exitEditMode, saveMemoryEdit });
        }

        updateSidebarStatus();
        markEditorReady();
    };

    var editorStarted = false;

    function tryStartEditor(user) {
        if (editorStarted) {
            if (user && (!window.currentTreeMemories || window.currentTreeMemories.length <= 1)) {
                if (window.refreshMemories) window.refreshMemories();
            }
            return;
        }
        if (!user) {
            var cachedUser = readConfirmedAuthCacheFromHelper();
            if (!cachedUser || !cachedUser.uid) {
                redirectToEditorLogin();
                return;
            }
        }
        editorStarted = true;
        startEditor();
    }

    if (typeof window.registerOnAuthReady === 'function') {
        window.registerOnAuthReady(tryStartEditor);
    } else {
        window.onAuthReady = tryStartEditor;
    }
});
