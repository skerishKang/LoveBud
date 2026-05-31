document.addEventListener('DOMContentLoaded', () => {
    const entryDependencies = window.LoveBudEditorEntryDependencies || {};
    const resolveEditorEntryDependencies = entryDependencies.resolveEditorEntryDependencies;

    function reportEditorBootstrapMissingDependency(msg) {
        const debugState = window.LoveBudEditorDebug = window.LoveBudEditorDebug || { logs: [], errors: [] };
        console.error('[editor-main] ERROR: ' + msg);
        debugState.errors.push({ msg, error: msg });
    }

    if (typeof resolveEditorEntryDependencies !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorEntryDependencies.resolveEditorEntryDependencies missing');
        return;
    }

    const entryDependenciesResult = resolveEditorEntryDependencies({
        windowRef: window,
        URLSearchParamsRef: URLSearchParams
    });

    if (entryDependenciesResult.status === 'stopped') return;

    const deps = entryDependenciesResult.deps;
    const dataLoaderFallbacks = window.LoveBudEditorDataLoaderFallbacks || deps.dataLoaderFallbacks;
    const entryFallbacks = window.LoveBudEditorEntryFallbacks || deps.entryFallbacks;
    const shellHelpers = window.LoveBudEditorShellHelpers || deps.shellHelpers;
    const rootUtils = window.LoveBudEditorUtils || {};
    const editorHelpers = deps.editorHelpers;
    const editorSaveStatus = deps.editorSaveStatus;
    const editorPageHelpers = deps.editorPageHelpers;
    const editorTreeHelpers = deps.editorTreeHelpers;
    const editorSelectionUI = window.LoveBudEditorSelectionUI || {};
    const editorBindings = deps.editorBindings;
    const editorPageEventBindings = window.LoveBudEditorPageEventBindings || deps.editorPageEventBindings;
    const editorDataLoader = deps.editorDataLoader;
    const editorInitialLoadFlow = deps.editorInitialLoadFlow;
    const editorRefreshSaveRuntime = window.LoveBudEditorRefreshSaveRuntime || deps.editorRefreshSaveRuntime;
    const editorStartupContext = deps.editorStartupContext;
    const editorAuthHelpers = window.LoveBudEditorAuthHelpers || {};
    const editorShellCopyApplier = window.LoveBudEditorShellCopyApplier || deps.editorShellCopyApplier;
    const editorDomRefsBuilder = window.LoveBudEditorDomRefsBuilder || deps.editorDomRefsBuilder;
    const bindEditorPageEvents = editorPageEventBindings.bindEditorPageEvents;
    const runEditorInitialLoadFlow = editorInitialLoadFlow.runEditorInitialLoadFlow;
    const createEditorRefreshSaveRuntime = editorRefreshSaveRuntime.createEditorRefreshSaveRuntime;
    const createEditorStartupContext = editorStartupContext.createEditorStartupContext;
    const getConfirmedSessionUser = deps.getConfirmedSessionUser;
    const readConfirmedAuthCacheFromHelper = () => (
        window.LoveBudEditorAuthHelpers?.readConfirmedAuthCache?.() || null
    );
    const getHttpStatus = shellHelpers.getHttpStatus;
    const createInlineShowToastFallback = shellHelpers.createInlineShowToastFallback;
    if (typeof createInlineShowToastFallback !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createInlineShowToastFallback missing'); return; }
    const showToast = deps.showToast;
    const getI18n = shellHelpers.getI18n;
    if (typeof getI18n !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.getI18n missing'); return; }
    const i18n = getI18n();
    const getEditorBasePath = shellHelpers.getEditorBasePath;
    if (typeof getEditorBasePath !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.getEditorBasePath missing'); return; }
    const buildEditorRedirectTargetHelper = shellHelpers.buildEditorRedirectTarget;
    if (typeof buildEditorRedirectTargetHelper !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.buildEditorRedirectTarget missing'); return; }
    const buildEditorRedirectTarget = () => buildEditorRedirectTargetHelper.call(shellHelpers);
    const redirectToEditorLogin = editorPageHelpers.redirectToEditorLogin;
    if (typeof redirectToEditorLogin !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorPageHelpers.redirectToEditorLogin missing'); return; }
    const safeI18nText = editorHelpers.safeI18nText;
    const resolveHintText = editorHelpers.resolveHintText;
    const resolveTreeTitleText = editorHelpers.resolveTreeTitleText;
    const resolveInfoText = editorHelpers.resolveInfoText;
    const missingTextResolvers = [
        ['LoveBudEditorHelpers.safeI18nText', safeI18nText],
        ['LoveBudEditorHelpers.resolveHintText', resolveHintText],
        ['LoveBudEditorHelpers.resolveTreeTitleText', resolveTreeTitleText],
        ['LoveBudEditorHelpers.resolveInfoText', resolveInfoText]
    ].filter(([, helper]) => typeof helper !== 'function');
    if (missingTextResolvers.length) { reportEditorBootstrapMissingDependency(missingTextResolvers.map(([name]) => name + ' missing').join('; ')); return; }
    const syncCurrentTreeData = editorTreeHelpers.syncCurrentTreeData;
    if (typeof syncCurrentTreeData !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorTreeHelpers.syncCurrentTreeData missing'); return; }
    const resolveParentIdForCreate = editorTreeHelpers.resolveParentIdForCreate;
    if (typeof resolveParentIdForCreate !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorTreeHelpers.resolveParentIdForCreate missing'); return; }
    const getMyTreesHref = editorPageHelpers.getMyTreesHref;
    if (typeof getMyTreesHref !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorPageHelpers.getMyTreesHref missing'); return; }
    const escapeHtml = editorHelpers.escapeHtml;
    const safeUrl = editorHelpers.safeUrl;
    const resolveMemoryThumbnail = editorHelpers.resolveMemoryThumbnail;
    const missingMediaResolvers = [
        ['LoveBudEditorHelpers.escapeHtml', escapeHtml],
        ['LoveBudEditorHelpers.safeUrl', safeUrl],
        ['LoveBudEditorHelpers.resolveMemoryThumbnail', resolveMemoryThumbnail]
    ].filter(([, helper]) => typeof helper !== 'function');
    if (missingMediaResolvers.length) { reportEditorBootstrapMissingDependency(missingMediaResolvers.map(([name]) => name + ' missing').join('; ')); return; }
    const getYouTubeInputErrorMessageFallback = shellHelpers.getYouTubeInputErrorMessageFallback;
    if (typeof getYouTubeInputErrorMessageFallback !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.getYouTubeInputErrorMessageFallback missing'); return; }
    const getYouTubeInputErrorMessage = typeof rootUtils.getYouTubeInputErrorMessage === 'function' ? rootUtils.getYouTubeInputErrorMessage : getYouTubeInputErrorMessageFallback;
    const renderTreeLoadError = editorPageHelpers.renderTreeLoadError;
    if (typeof renderTreeLoadError !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorPageHelpers.renderTreeLoadError missing'); return; }
    const buildTreeLoadErrorCopy = editorPageHelpers.buildTreeLoadErrorCopy;
    if (typeof buildTreeLoadErrorCopy !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorPageHelpers.buildTreeLoadErrorCopy missing'); return; }
    const applyEditorShellCopy = shellHelpers.applyEditorShellCopy;
    if (typeof applyEditorShellCopy !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.applyEditorShellCopy missing'); return; }
    applyEditorShellCopy(safeI18nText, i18n);
    const createPrepareEditorShell = editorShellCopyApplier.createPrepareEditorShell;
    if (typeof createPrepareEditorShell !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorShellCopyApplier.createPrepareEditorShell missing'); return; }
    const prepareEditorShell = createPrepareEditorShell({ applyEditorShellCopy, safeI18nText, i18n, getMyTreesHref });
    const nextMemoryIdFromMemories = editorTreeHelpers.nextMemoryIdFromMemories;
    const markEditorReady = shellHelpers.markEditorReady;
    const applyEditorEditabilityState = shellHelpers.applyEditorEditabilityState;
    const createEditorDomRefs = editorDomRefsBuilder.createEditorDomRefs;
    const createEditorDebugReporter = shellHelpers.createEditorDebugReporter;
    if (typeof createEditorDebugReporter !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorDebugReporter missing'); return; }
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
    const findRootMemory = rootUtils.findRootMemory;
    const getCanonicalRootId = rootUtils.getCanonicalRootId;
    const isRootMemory = rootUtils.isRootMemory;
    const missingRootHelpers = [
        ['LoveBudEditorUtils.findRootMemory', findRootMemory],
        ['LoveBudEditorUtils.getCanonicalRootId', getCanonicalRootId],
        ['LoveBudEditorUtils.isRootMemory', isRootMemory]
    ].filter(([, helper]) => typeof helper !== 'function');
    if (missingRootHelpers.length) { reportEditorBootstrapMissingDependency(missingRootHelpers.map(([name]) => name + ' missing').join('; ')); return; }

    const startEditor = async () => {
        const { log, reportError } = createEditorDebugReporter();

        if (typeof createEditorStartupDependencyWaiter !== 'function') {
            reportError('LoveBudEditorShellHelpers.createEditorStartupDependencyWaiter missing');
            return;
        }

        if (typeof markEditorReady !== 'function') {
            reportError('LoveBudEditorShellHelpers.markEditorReady missing');
            return;
        }

        if (typeof runEditorInitialLoadFlow !== 'function') {
            reportError('LoveBudEditorInitialLoadFlow.runEditorInitialLoadFlow missing');
            return;
        }

        if (typeof createEditorRefreshSaveRuntime !== 'function') { reportError('LoveBudEditorRefreshSaveRuntime.createEditorRefreshSaveRuntime missing'); return; }

        log('startEditor sequence initiated');

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

            let isLocalSaveMode = false;

            const initialLoadResult = await runEditorInitialLoadFlow({
                urlTreeId,
                canvas,
                addBtn,
                cache: window.LoveBudCache || null,
                i18n,
                apiClient: window.apiClient,
                createDefaultTreeTitle: () => safeI18nText(i18n, 'default_tree_title', '러브트리'),
                getConfirmedSessionUser,
                showToast,
                redirectToEditorLogin,
                buildTreeLoadErrorCopy,
                renderTreeLoadError,
                markEditorReady,
                syncCurrentTreeData,
                editorDataLoader,
                sharedNormalize: window.LoveBudNormalize?.normalizeMemory,
                escapeHtml,
                log,
                reportError
            });

            if (initialLoadResult.status === 'stopped') {
                return;
            }

            const tree = initialLoadResult.tree;
            const treeId = initialLoadResult.treeId;
            const normalizeMemory = initialLoadResult.normalizeMemory;
            const treeMemories = initialLoadResult.treeMemories;
            
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

            if (typeof nextMemoryIdFromMemories !== 'function') {
                reportError('LoveBudEditorTreeHelpers.nextMemoryIdFromMemories missing');
                return;
            }

            const nextMemoryId = () => nextMemoryIdFromMemories(treeMemories());

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

            const refreshSaveRuntime = createEditorRefreshSaveRuntime({
                log, reportError, editorDataLoader, treeId, apiClient: window.apiClient, normalizeMemory, treeMemories,
                getCurrentEditingMemory: () => currentEditingMemory, setCurrentEditingMemory: (value) => { currentEditingMemory = value; },
                isRootMemory, canonicalRootId, updateDetailPanel, updateSidebarStatus, initCanvas, exposeRefreshMemoriesBridge,
                resolveSaveStatusTimeFormatter, editorSaveStatus, i18n, createSaveStatusOrchestrationFallback, saveStatusOrchestrationHelper: window.LoveBudEditorSaveStatusOrchestration || {}
            });

            if (refreshSaveRuntime.status === 'stopped') return;
            const { saveStatusData, updateSaveStatus } = refreshSaveRuntime;

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
