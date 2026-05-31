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

    const findRootMemory = function(memories) {
        if (typeof rootUtils.findRootMemory === 'function') {
            return rootUtils.findRootMemory(memories);
        }
        warnRootHelperFallback();
        if (!Array.isArray(memories)) return null;
        const parentNullNodes = memories.filter(m => m.parentId === null || m.parentId === undefined);
        if (parentNullNodes.length === 1) return parentNullNodes[0];
        if (parentNullNodes.length > 1) {
            return parentNullNodes.sort((a, b) => {
                const aTime = a.createdAt || a.timestamp || '9999';
                const bTime = b.createdAt || b.timestamp || '9999';
                return new Date(aTime) - new Date(bTime);
            })[0];
        }
        return memories.find(m => m.id === 'root') || null;
    };

    const getRootId = function(memories) {
        if (typeof rootUtils.getRootId === 'function') {
            return rootUtils.getRootId(memories);
        }
        warnRootHelperFallback();
        const root = findRootMemory(memories);
        return root ? root.id : 'root';
    };

    const getCanonicalRootId = function(memories) {
        if (typeof rootUtils.getCanonicalRootId === 'function') {
            return rootUtils.getCanonicalRootId(memories);
        }
        warnRootHelperFallback();
        const root = findRootMemory(memories);
        return root ? root.id : 'root';
    };

    const isRootMemory = function(mem, rootId) {
        if (typeof rootUtils.isRootMemory === 'function') {
            return rootUtils.isRootMemory(mem, rootId);
        }
        warnRootHelperFallback();
        return !!(mem && rootId && mem.id === rootId);
    };

    const editorSaveStatus = window.LoveBudEditorSaveStatus || {};
    const editorPageHelpers = window.LoveBudEditorPageHelpers || {};
    const editorTreeHelpers = window.LoveBudEditorTreeHelpers || {};
    const editorSelectionUI = window.LoveBudEditorSelectionUI || {};
    const editorBindings = window.LoveBudEditorBindings || {};
    const editorPageEventBindings = window.LoveBudEditorPageEventBindings || {};
    const bindEditorPageEvents = editorPageEventBindings.bindEditorPageEvents;
    const editorDataLoader = window.LoveBudEditorDataLoader || {};
    const editorStartupContext = window.LoveBudEditorStartupContext || {};
    const createEditorStartupContext = editorStartupContext.createEditorStartupContext;
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

    const getHttpStatus = shellHelpers.getHttpStatus;

    const createInlineShowToastFallback = shellHelpers.createInlineShowToastFallback;
    if (typeof createInlineShowToastFallback !== 'function') {
        const debugState = window.LoveBudEditorDebug = window.LoveBudEditorDebug || { logs: [], errors: [] };
        const msg = 'LoveBudEditorShellHelpers.createInlineShowToastFallback missing';
        console.error('[editor-main] ERROR: ' + msg);
        debugState.errors.push({ msg, error: msg });
        return;
    }

    const showToast = editorHelpers.createToast
        ? editorHelpers.createToast({ warningKey: '__editorToastWarningShown' })
        : createInlineShowToastFallback();

    const getI18n = shellHelpers.getI18n;
    if (typeof getI18n !== 'function') {
        const debugState = window.LoveBudEditorDebug = window.LoveBudEditorDebug || { logs: [], errors: [] };
        const msg = 'LoveBudEditorShellHelpers.getI18n missing';
        console.error('[editor-main] ERROR: ' + msg);
        debugState.errors.push({ msg, error: msg });
        return;
    }
    const i18n = getI18n();

    const getEditorBasePath = shellHelpers.getEditorBasePath;
    if (typeof getEditorBasePath !== 'function') {
        const debugState = window.LoveBudEditorDebug = window.LoveBudEditorDebug || { logs: [], errors: [] };
        const msg = 'LoveBudEditorShellHelpers.getEditorBasePath missing';
        console.error('[editor-main] ERROR: ' + msg);
        debugState.errors.push({ msg, error: msg });
        return;
    }

    const buildEditorRedirectTargetHelper = shellHelpers.buildEditorRedirectTarget;
    if (typeof buildEditorRedirectTargetHelper !== 'function') {
        const debugState = window.LoveBudEditorDebug = window.LoveBudEditorDebug || { logs: [], errors: [] };
        const msg = 'LoveBudEditorShellHelpers.buildEditorRedirectTarget missing';
        console.error('[editor-main] ERROR: ' + msg);
        debugState.errors.push({ msg, error: msg });
        return;
    }
    const buildEditorRedirectTarget = () => buildEditorRedirectTargetHelper.call(shellHelpers);

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

    const getMyTreesHref = editorPageHelpers.getMyTreesHref;
    if (typeof getMyTreesHref !== 'function') {
        const debugState = window.LoveBudEditorDebug = window.LoveBudEditorDebug || { logs: [], errors: [] };
        const msg = 'LoveBudEditorPageHelpers.getMyTreesHref missing';
        console.error('[editor-main] ERROR: ' + msg);
        debugState.errors.push({ msg, error: msg });
        return;
    }
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

    const getYouTubeInputErrorMessageFallback = shellHelpers.getYouTubeInputErrorMessageFallback || ((i18n, rawUrl) => {
        const value = String(rawUrl || '').trim();
        if (!value) return i18n('enter_youtube') || 'YouTube 링크를 입력해 주세요.';
        if (!/^(https?:\/\/|www\.)/i.test(value)) return i18n('invalid_youtube_format') || '전체 YouTube 링크를 붙여 넣어 주세요.';
        if (!/(youtube\.com|youtu\.be|youtube\.com\/shorts\/)/i.test(value)) return i18n('invalid_youtube_unsupported') || 'YouTube 링크만 지원합니다. youtube.com 또는 youtu.be 링크를 사용해 주세요.';
        const match = value.match(/(?:v=|\/|youtu\.be\/|shorts\/)([0-9A-Za-z_-]+)/i);
        if (match && match[1].length !== 11) return i18n('invalid_youtube_id_length') || '링크가 중간에 잘린 것 같아요. 전체 YouTube 링크를 다시 복사해 주세요.';
        return i18n('invalid_youtube') || '유효한 YouTube 링크를 입력해 주세요.';
    });

    const getYouTubeInputErrorMessage = function(i18n, rawUrl) {
        if (typeof rootUtils.getYouTubeInputErrorMessage === 'function') {
            return rootUtils.getYouTubeInputErrorMessage(i18n, rawUrl);
        }
        warnRootHelperFallback();
        return getYouTubeInputErrorMessageFallback(i18n, rawUrl);
    };

    const renderTreeLoadError = editorPageHelpers.renderTreeLoadError;

    if (typeof renderTreeLoadError !== 'function') {
        const debugState = window.LoveBudEditorDebug = window.LoveBudEditorDebug || { logs: [], errors: [] };
        const msg = 'LoveBudEditorPageHelpers.renderTreeLoadError missing';
        console.error('[editor-main] ERROR: ' + msg);
        debugState.errors.push({ msg, error: msg });
        return;
    }

    const createInlineNextMemoryIdFallback = dataLoaderFallbacks.createInlineNextMemoryIdFallback || ((options) => () => 'm1');
    const createInlineFormatTimeAgoFallback = entryFallbacks.createInlineFormatTimeAgoFallback;

    const markEditorReady = shellHelpers.markEditorReady;

    const applyEditorEditabilityState = shellHelpers.applyEditorEditabilityState;

    const editorShellCopyApplier = window.LoveBudEditorShellCopyApplier || {};
    const createEditorShellCopyApplier = editorShellCopyApplier.createEditorShellCopyApplier || (() => () => {});
    const createPrepareEditorShell = editorShellCopyApplier.createPrepareEditorShell || (() => () => {});

    const applyEditorShellCopy = shellHelpers.applyEditorShellCopy ||
        createEditorShellCopyApplier({ safeI18nText, i18n });

    applyEditorShellCopy(safeI18nText, i18n);

    const editorDomRefsBuilder = window.LoveBudEditorDomRefsBuilder || {};
    const createEditorDomRefs = editorDomRefsBuilder.createEditorDomRefs;

    const prepareEditorShell = createPrepareEditorShell({ applyEditorShellCopy, safeI18nText, i18n, getMyTreesHref });

    const createEditorDebugReporter = shellHelpers.createEditorDebugReporter;

    const createEditorStartupDependencyWaiter = shellHelpers.createEditorStartupDependencyWaiter;

    const exposeCanvasEmptyGuideUpdater = shellHelpers.exposeCanvasEmptyGuideUpdater;

    const exposeDetailPanelUpdater = shellHelpers.exposeDetailPanelUpdater;

    const createSelectedMomentFocusHandler = shellHelpers.createSelectedMomentFocusHandler;

    const createSidebarTreeActionsUpdater = shellHelpers.createSidebarTreeActionsUpdater;

    const createMemoryActionsReadinessWrapper = shellHelpers.createMemoryActionsReadinessWrapper;

    const createCurrentMomentDetailOpener = shellHelpers.createCurrentMomentDetailOpener;

    const createSaveStatusOrchestrationFallback = shellHelpers.createSaveStatusOrchestrationFallback;

    const exposeRefreshMemoriesBridge = shellHelpers.exposeRefreshMemoriesBridge;

    const resolveSaveStatusTimeFormatter = shellHelpers.resolveSaveStatusTimeFormatter;

    const startEditor = async () => {
        if (typeof createEditorDebugReporter !== 'function') {
            const debugState = window.LoveBudEditorDebug = window.LoveBudEditorDebug || { logs: [], errors: [] };
            const msg = 'LoveBudEditorShellHelpers.createEditorDebugReporter missing';
            console.error('[editor-main] ERROR: ' + msg);
            debugState.errors.push({ msg, error: msg });
            return;
        }

        const { log, reportError } = createEditorDebugReporter();

        if (typeof markEditorReady !== 'function') {
            reportError('LoveBudEditorShellHelpers.markEditorReady missing');
            return;
        }

        log('startEditor sequence initiated');

        if (typeof createEditorStartupDependencyWaiter !== 'function') {
            reportError('LoveBudEditorShellHelpers.createEditorStartupDependencyWaiter missing');
            return;
        }

        const waitForGlobal = createEditorStartupDependencyWaiter({ log, reportError });

        if (!await waitForGlobal('createEditorCanvas')) return;
        if (!await waitForGlobal('createEditorDetailUI')) return;
        if (!await waitForGlobal('createEditorMemoryActions')) return;
        if (!await waitForGlobal('createEditorMemoryForm')) return;

        if (typeof createEditorDomRefs !== 'function') {
            reportError('LoveBudEditorDomRefsBuilder.createEditorDomRefs missing');
            return;
        }

        if (typeof createEditorStartupContext !== 'function') {
            reportError('LoveBudEditorStartupContext.createEditorStartupContext missing');
            return;
        }

        try {
            const {
                canvas,
                svg,
                detailPanel,
                addBtn,
                urlTreeId,
                canEdit
            } = createEditorStartupContext({
                createEditorDomRefs,
                locationRef: window.location,
                URLSearchParamsRef: URLSearchParams
            });

            log('DOM refs and URL params prepared');
            prepareEditorShell();
            log('Editor shell mounted');

            if (typeof applyEditorEditabilityState !== 'function') {
                reportError('LoveBudEditorShellHelpers.applyEditorEditabilityState missing');
                return;
            }

            // Expose canEdit for modules that read it after DOMContentLoaded
            applyEditorEditabilityState({ canEdit });

            const cache = window.LoveBudCache || null;
            let MEMORIES_CACHE_KEY = 'memories_default';
            let isLocalSaveMode = false;

            const loadInitialTree = editorDataLoader.loadInitialEditorTree;
            if (typeof loadInitialTree !== 'function') {
                reportError('LoveBudEditorDataLoader.loadInitialEditorTree missing');
                return;
            }
            
            log('Loading initial tree data...');
            const treeLoadResult = await loadInitialTree({
                urlTreeId,
                apiClient: window.apiClient,
                createDefaultTreeTitle: () => safeI18nText(i18n, 'default_tree_title', '러브트리'),
                getConfirmedSessionUser
            });

            let tree = treeLoadResult.tree || null;
            if (!tree) {
                log('Tree not found or auth required');
                if (treeLoadResult.authRequired) {
                    showToast(i18n('need_login'), 'error');
                    redirectToEditorLogin(2000);
                    return;
                }
                if (urlTreeId) {
                    const treeLoadStatus = treeLoadResult.treeLoadStatus || 'not_found';
                    const treeLoadErrorMessage = treeLoadResult.treeLoadErrorMessage || '';
                    let treeLoadErrorCopy = {
                        errorTitle: i18n('tree_not_found_title') || '트리를 찾을 수 없어요',
                        errorDesc: i18n('tree_load_not_found_desc') || '잘못된 링크이거나 접근 권한이 없는 트리입니다.'
                    };

                    if (typeof editorPageHelpers.buildTreeLoadErrorCopy === 'function') {
                        treeLoadErrorCopy = editorPageHelpers.buildTreeLoadErrorCopy({
                            treeLoadStatus,
                            treeLoadErrorMessage,
                            i18n
                        });
                    } else {
                        reportError('LoveBudEditorPageHelpers.buildTreeLoadErrorCopy missing');
                    }

                    renderTreeLoadError({
                        canvas,
                        addBtn,
                        errorTitle: treeLoadErrorCopy.errorTitle,
                        errorDesc: treeLoadErrorCopy.errorDesc,
                        i18n,
                        escapeHtml,
                        setDetailEmptyState: null
                    });
                    markEditorReady();
                    return;
                }
                markEditorReady();
                return;
            }

            syncCurrentTreeData(tree);
            const treeId = tree.id || null;
            MEMORIES_CACHE_KEY = 'memories_' + (treeId || 'default');
            log(`Tree loaded: ${treeId}`);

            if (typeof editorDataLoader.createNormalizeMemory !== 'function') {
                reportError('LoveBudEditorDataLoader.createNormalizeMemory missing');
                return;
            }
            const normalizeMemory = editorDataLoader.createNormalizeMemory({ sharedNormalize: window.LoveBudNormalize?.normalizeMemory });

            if (typeof editorDataLoader.loadEditorMemories !== 'function') {
                reportError('LoveBudEditorDataLoader.loadEditorMemories missing');
                return;
            }
            
            log('Loading editor memories...');
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
            const memoriesCount = treeMemories().length;
            log(`Memories loaded: ${memoriesCount}`);
            
            const canonicalRootId = getCanonicalRootId(treeMemories());
            let selectedNodeId = canonicalRootId;
            let currentEditingMemory = null;
            let editorCanvas = null;

            let memoryActions = null;

            if (typeof createMemoryActionsReadinessWrapper !== 'function') {
                reportError('LoveBudEditorShellHelpers.createMemoryActionsReadinessWrapper missing');
                return;
            }

            const updateSelectedMemoryFields = createMemoryActionsReadinessWrapper({
                getMemoryActions: () => memoryActions
            });

            if (typeof editorTreeHelpers.createInitialMemory !== 'function') {
                reportError('LoveBudEditorTreeHelpers.createInitialMemory missing');
                return;
            }
            const createInitialMemory = () => editorTreeHelpers.createInitialMemory({ getTreeMemories: () => treeMemories(), findRootMemory, canonicalRootId, treeId, i18n });

            const nextMemoryId = editorTreeHelpers.nextMemoryIdFromMemories
                ? () => editorTreeHelpers.nextMemoryIdFromMemories(treeMemories())
                : createInlineNextMemoryIdFallback({ treeMemories });

            const emptyGuideUIHelper = window.LoveBudEditorEmptyGuideUI || {};
            const updateCanvasEmptyGuide = emptyGuideUIHelper.createCanvasEmptyGuideUpdater
                ? emptyGuideUIHelper.createCanvasEmptyGuideUpdater({
                    getTreeMemories: () => treeMemories(),
                    log
                })
                : () => {
                    log('WARNING: LoveBudEditorEmptyGuideUI.createCanvasEmptyGuideUpdater missing');
                };
            
            // Bridge this back to LoveBudEditor so canvas can call it
            if (typeof exposeCanvasEmptyGuideUpdater !== 'function') {
                reportError('LoveBudEditorShellHelpers.exposeCanvasEmptyGuideUpdater missing');
                return;
            }

            exposeCanvasEmptyGuideUpdater({ updateCanvasEmptyGuide });

            const selectNode = (el, data) => {
                if (!data) return;
                selectedNodeId = data.id;
                currentEditingMemory = data;

                if (typeof editorSelectionUI.applySelectedMemoryNode === 'function') {
                    editorSelectionUI.applySelectedMemoryNode(el);
                } else {
                    reportError('LoveBudEditorSelectionUI.applySelectedMemoryNode missing');
                }

                if (typeof editorSaveStatus.hideSaveStatusIndicator === 'function') {
                    editorSaveStatus.hideSaveStatusIndicator(saveStatusData);
                }

                updateDetailPanel(data);
                updateFocusSelectedBtn();
                setDetailEmptyState(false);

                if (editorCanvas && typeof editorCanvas.updateAffordance === 'function') {
                    editorCanvas.updateAffordance();
                }
            };

            if (typeof createSelectedMomentFocusHandler !== 'function') {
                reportError('LoveBudEditorShellHelpers.createSelectedMomentFocusHandler missing');
                return;
            }

            const focusSelectedMoment = createSelectedMomentFocusHandler({
                getEditorCanvas: () => editorCanvas,
                getSelectedNodeId: () => selectedNodeId
            });

            if (typeof createCurrentMomentDetailOpener !== 'function') {
                reportError('LoveBudEditorShellHelpers.createCurrentMomentDetailOpener missing');
                return;
            }

            const openCurrentMomentDetail = createCurrentMomentDetailOpener({
                getCurrentEditingMemory: () => currentEditingMemory,
                getTreeMemories: () => treeMemories(),
                getSelectedNodeId: () => selectedNodeId,
                createInitialMemory,
                getTreeId: () => treeId,
                editorPageHelpers,
                getEditorBasePath,
                locationRef: window.location,
                reportError
            });

            const updateTreeVisibility = async (nextVisibility) => {
                if (canEdit === false) return;
                if (!treeId || !window.apiClient || typeof window.apiClient.updateTree !== 'function') {
                    throw new Error('updateTree not available');
                }
                const updatedTree = await window.apiClient.updateTree(treeId, { visibility: nextVisibility });
                if (typeof editorTreeHelpers.applyUpdatedTreeVisibility === 'function') {
                    editorTreeHelpers.applyUpdatedTreeVisibility({
                        updatedTree,
                        nextVisibility,
                        currentTreeData: window.currentTreeData || {}
                    });
                } else {
                    reportError('LoveBudEditorTreeHelpers.applyUpdatedTreeVisibility missing');
                }
                updateSidebarStatus();
                if (currentEditingMemory) updateDetailPanel(currentEditingMemory);
            };

            log('Initializing Detail UI...');
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
            if (typeof exposeDetailPanelUpdater !== 'function') {
                reportError('LoveBudEditorShellHelpers.exposeDetailPanelUpdater missing');
                return;
            }

            exposeDetailPanelUpdater({ updateDetailPanel });

            const sidebarUIHelper = window.LoveBudEditorSidebarUI || {};
            if (typeof createSidebarTreeActionsUpdater !== 'function') {
                reportError('LoveBudEditorShellHelpers.createSidebarTreeActionsUpdater missing');
                return;
            }

            const updateSidebarTreeActions = createSidebarTreeActionsUpdater({
                sidebarUIHelper,
                i18n,
                safeI18nText,
                getTreeId: () => treeId
            });

            const updateSidebarStatus = () => {
                updateSidebarStatusBase();
                updateCanvasEmptyGuide();
                updateSidebarTreeActions();
            };

            log('Creating Editor Canvas Instance...');
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
                openAddMoment: () => showAddMemoryForm(),
                canEdit
            });

            // Store instance for global bridge
            if (canvas) canvas.__editorCanvasInstance = editorCanvas;
            log('Canvas instance bound to DOM');

            const { calcPosition, drawBranch, drawNode, initCanvas } = editorCanvas;

            const handleMemoriesUpdated = () => {
                log('Memories updated externally. Rerendering...');
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
                reportError('LoveBudEditorDataLoader.createRefreshMemories missing');
                return;
            }
            const refreshMemories = editorDataLoader.createRefreshMemories({ treeId, apiClient: window.apiClient, normalizeMemory, onMemoriesUpdated: handleMemoriesUpdated });

            if (typeof exposeRefreshMemoriesBridge !== 'function') {
                reportError('LoveBudEditorShellHelpers.exposeRefreshMemoriesBridge missing');
                return;
            }

            exposeRefreshMemoriesBridge({ refreshMemories });

            if (typeof resolveSaveStatusTimeFormatter !== 'function') {
                reportError('LoveBudEditorShellHelpers.resolveSaveStatusTimeFormatter missing');
                return;
            }

            const formatTimeAgo = resolveSaveStatusTimeFormatter({
                editorSaveStatus,
                createInlineFormatTimeAgoFallback
            });

            const saveStatusOrchestrationHelper = window.LoveBudEditorSaveStatusOrchestration || {};
            let createEditorSaveStatusOrchestration = saveStatusOrchestrationHelper.createEditorSaveStatusOrchestration;

            if (typeof createEditorSaveStatusOrchestration !== 'function') {
                if (typeof createSaveStatusOrchestrationFallback !== 'function') {
                    reportError('LoveBudEditorShellHelpers.createSaveStatusOrchestrationFallback missing');
                    return;
                }

                createEditorSaveStatusOrchestration = createSaveStatusOrchestrationFallback();
            }

            const { saveStatusData, updateSaveStatus } = createEditorSaveStatusOrchestration({ editorSaveStatus, i18n, formatTimeAgo });

            log('Initializing Memory Actions...');
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
                isLocalSaveMode: () => isLocalSaveMode,
                canEdit
            });

            const { enterEditMode, exitEditMode, saveMemoryEdit, deleteMemory } = memoryActions;

            log('Initializing Memory Form...');
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
                focusNodeById: (id) => editorCanvas.focusNodeById(id),
                canEdit
            });

            const { showAddMemoryForm, hideAddMemoryForm, addMemoryFromForm } = memoryForm;

            log('Binding events...');
            if (typeof getHttpStatus !== 'function') {
                reportError('LoveBudEditorShellHelpers.getHttpStatus missing');
                return;
            }

            if (typeof bindEditorPageEvents === 'function') {
                bindEditorPageEvents({
                    canEdit,
                    sidebarUIHelper,
                    editorBindings,
                    emptyGuideUIHelper,
                    getTreeId: () => treeId,
                    updateTreeVisibility,
                    showToast,
                    safeI18nText,
                    i18n,
                    getHttpStatus,
                    updateSidebarStatus,
                    showAddMemoryForm,
                    hideAddMemoryForm,
                    addMemoryFromForm,
                    updateSaveStatus,
                    getEditorCanvas: () => editorCanvas,
                    getTreeMemories: () => treeMemories(),
                    enterEditMode,
                    deleteMemory,
                    exitEditMode,
                    saveMemoryEdit
                });
            }

            log('Final Canvas Initialization...');
            initCanvas();
            updateCanvasEmptyGuide();
            
            const initialSelection = treeMemories().find((memory) => memory.id === selectedNodeId) || createInitialMemory();
            if (initialSelection && !isRootMemory(initialSelection, canonicalRootId)) {
                currentEditingMemory = initialSelection;
                log(`Initial selection set: ${initialSelection.id}`);
            }

            updateSidebarStatus();
            markEditorReady();
            log('startEditor complete. Ready.');
        } catch (error) {
            reportError('CRITICAL: Exception in startEditor', error);
        }
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
