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
    const readConfirmedAuthCache = deps.readConfirmedAuthCache;
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
    const registerEditorAuthStart = editorPageHelpers.registerEditorAuthStart;
    if (typeof registerEditorAuthStart !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorPageHelpers.registerEditorAuthStart missing'); return; }
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
    const createEditorStartDependencyGuard = shellHelpers.createEditorStartDependencyGuard;
    if (typeof createEditorStartDependencyGuard !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorStartDependencyGuard missing'); return; }
    const createEditorStartupDependencyWaiter = shellHelpers.createEditorStartupDependencyWaiter;
    const exposeCanvasEmptyGuideUpdater = shellHelpers.exposeCanvasEmptyGuideUpdater;
    const createEditorCanvasEmptyGuideUpdater = shellHelpers.createEditorCanvasEmptyGuideUpdater;
    if (typeof createEditorCanvasEmptyGuideUpdater !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorCanvasEmptyGuideUpdater missing');
        return;
    }
    const exposeDetailPanelUpdater = shellHelpers.exposeDetailPanelUpdater;
    const createSelectedMomentFocusHandler = shellHelpers.createSelectedMomentFocusHandler;
    const createEditorSelectNodeHandler = shellHelpers.createEditorSelectNodeHandler;
    if (typeof createEditorSelectNodeHandler !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorSelectNodeHandler missing');
        return;
    }
    const createSidebarTreeActionsUpdater = shellHelpers.createSidebarTreeActionsUpdater;
    const createEditorSidebarStatusUpdater = shellHelpers.createEditorSidebarStatusUpdater;
    if (typeof createEditorSidebarStatusUpdater !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorSidebarStatusUpdater missing');
        return;
    }
    const createMemoryActionsReadinessWrapper = shellHelpers.createMemoryActionsReadinessWrapper;
    const createCurrentMomentDetailOpener = shellHelpers.createCurrentMomentDetailOpener;
    const createEditorInitialMemoryProvider = shellHelpers.createEditorInitialMemoryProvider;
    if (typeof createEditorInitialMemoryProvider !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorInitialMemoryProvider missing');
        return;
    }
    const createEditorNextMemoryIdProvider = shellHelpers.createEditorNextMemoryIdProvider;
    if (typeof createEditorNextMemoryIdProvider !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorNextMemoryIdProvider missing');
        return;
    }
    const createEditorInitialSelectionApplier = shellHelpers.createEditorInitialSelectionApplier;
    if (typeof createEditorInitialSelectionApplier !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorInitialSelectionApplier missing');
        return;
    }
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

        const ensureStartEditorDependency = createEditorStartDependencyGuard({ reportError });

        if (!ensureStartEditorDependency(createEditorStartupDependencyWaiter, 'LoveBudEditorShellHelpers.createEditorStartupDependencyWaiter missing')) return;

        if (!ensureStartEditorDependency(markEditorReady, 'LoveBudEditorShellHelpers.markEditorReady missing')) return;

        if (!ensureStartEditorDependency(runEditorInitialLoadFlow, 'LoveBudEditorInitialLoadFlow.runEditorInitialLoadFlow missing')) return;

        if (!ensureStartEditorDependency(createEditorRefreshSaveRuntime, 'LoveBudEditorRefreshSaveRuntime.createEditorRefreshSaveRuntime missing')) return;

        log('startEditor sequence initiated');

        const waitForGlobal = createEditorStartupDependencyWaiter({ log, reportError });

        if (!await waitForGlobal('createEditorCanvas')) return;
        if (!await waitForGlobal('createEditorDetailUI')) return;
        if (!await waitForGlobal('createEditorMemoryActions')) return;
        if (!await waitForGlobal('createEditorMemoryForm')) return;

        if (!ensureStartEditorDependency(createEditorDomRefs, 'LoveBudEditorDomRefsBuilder.createEditorDomRefs missing')) return;

        if (!ensureStartEditorDependency(createEditorStartupContext, 'LoveBudEditorStartupContext.createEditorStartupContext missing')) return;

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

            if (!ensureStartEditorDependency(applyEditorEditabilityState, 'LoveBudEditorShellHelpers.applyEditorEditabilityState missing')) return;

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

            if (!ensureStartEditorDependency(createMemoryActionsReadinessWrapper, 'LoveBudEditorShellHelpers.createMemoryActionsReadinessWrapper missing')) return;

            const updateSelectedMemoryFields = createMemoryActionsReadinessWrapper({
                getMemoryActions: () => memoryActions
            });

            if (!ensureStartEditorDependency(editorTreeHelpers.createInitialMemory, 'LoveBudEditorTreeHelpers.createInitialMemory missing')) return;
            const createInitialMemory = createEditorInitialMemoryProvider({
                editorTreeHelpers,
                getTreeMemories: () => treeMemories(),
                findRootMemory,
                canonicalRootId,
                treeId,
                i18n
            });

            if (!ensureStartEditorDependency(nextMemoryIdFromMemories, 'LoveBudEditorTreeHelpers.nextMemoryIdFromMemories missing')) return;

            const nextMemoryId = createEditorNextMemoryIdProvider({
                nextMemoryIdFromMemories,
                getTreeMemories: () => treeMemories()
            });

            const emptyGuideUIHelper = window.LoveBudEditorEmptyGuideUI || {};
            const updateCanvasEmptyGuide = createEditorCanvasEmptyGuideUpdater({
                emptyGuideUIHelper,
                getTreeMemories: () => treeMemories(),
                log
            });
            
            // Bridge this back to LoveBudEditor so canvas can call it
            if (!ensureStartEditorDependency(exposeCanvasEmptyGuideUpdater, 'LoveBudEditorShellHelpers.exposeCanvasEmptyGuideUpdater missing')) return;

            exposeCanvasEmptyGuideUpdater({ updateCanvasEmptyGuide });

            const selectNode = createEditorSelectNodeHandler({
                getEditorCanvas: () => editorCanvas,
                getSaveStatusData: () => saveStatusData,
                editorSelectionUI,
                editorSaveStatus,
                setSelectedNodeId: (value) => { selectedNodeId = value; },
                setCurrentEditingMemory: (value) => { currentEditingMemory = value; },
                updateDetailPanel,
                updateFocusSelectedBtn,
                setDetailEmptyState,
                reportError
            });

            if (!ensureStartEditorDependency(createSelectedMomentFocusHandler, 'LoveBudEditorShellHelpers.createSelectedMomentFocusHandler missing')) return;

            const focusSelectedMoment = createSelectedMomentFocusHandler({
                getEditorCanvas: () => editorCanvas,
                getSelectedNodeId: () => selectedNodeId
            });

            if (!ensureStartEditorDependency(createCurrentMomentDetailOpener, 'LoveBudEditorShellHelpers.createCurrentMomentDetailOpener missing')) return;

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

            const updateTreeVisibility = editorTreeHelpers.createTreeVisibilityUpdater({
                canEdit,
                getTreeId: () => treeId,
                getApiClient: () => window.apiClient,
                applyUpdatedTreeVisibility: editorTreeHelpers.applyUpdatedTreeVisibility,
                getCurrentTreeData: () => window.currentTreeData || {},
                updateSidebarStatus,
                getCurrentEditingMemory: () => currentEditingMemory,
                updateDetailPanel,
                reportError
            });

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
            if (!ensureStartEditorDependency(exposeDetailPanelUpdater, 'LoveBudEditorShellHelpers.exposeDetailPanelUpdater missing')) return;

            exposeDetailPanelUpdater({ updateDetailPanel });

            const sidebarUIHelper = window.LoveBudEditorSidebarUI || {};
            if (!ensureStartEditorDependency(createSidebarTreeActionsUpdater, 'LoveBudEditorShellHelpers.createSidebarTreeActionsUpdater missing')) return;

            const updateSidebarTreeActions = createSidebarTreeActionsUpdater({
                sidebarUIHelper,
                i18n,
                safeI18nText,
                getTreeId: () => treeId
            });

            const updateSidebarStatus = createEditorSidebarStatusUpdater({
                updateSidebarStatusBase,
                updateCanvasEmptyGuide,
                updateSidebarTreeActions
            });

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
            if (!ensureStartEditorDependency(getHttpStatus, 'LoveBudEditorShellHelpers.getHttpStatus missing')) return;

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

            const applyEditorInitialSelection = createEditorInitialSelectionApplier({
                getTreeMemories: () => treeMemories(),
                getSelectedNodeId: () => selectedNodeId,
                createInitialMemory,
                isRootMemory,
                getCanonicalRootId: () => canonicalRootId,
                setCurrentEditingMemory: (value) => { currentEditingMemory = value; },
                log
            });

            applyEditorInitialSelection();

            updateSidebarStatus();
            markEditorReady();
            log('startEditor complete. Ready.');
        } catch (error) {
            reportError('CRITICAL: Exception in startEditor', error);
        }
    };

    registerEditorAuthStart({
        windowRef: window,
        startEditor: startEditor,
        redirectToEditorLogin: redirectToEditorLogin,
        readConfirmedAuthCache: readConfirmedAuthCache
    });
});
