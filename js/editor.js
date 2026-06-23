document.addEventListener('DOMContentLoaded', () => {
    const entryDependencies = window.LoveBudEditorEntryDependencies || {};
    const resolveEditorEntryDependencies = entryDependencies.resolveEditorEntryDependencies;

    function reportEditorBootstrapMissingDependency(msg) {
        const debugState = window.LoveBudEditorDebug = window.LoveBudEditorDebug || { logs: [], errors: [] };
        console.error('[editor-main] ERROR: ' + msg);
        debugState.errors.push({ msg, error: msg });
    }

    function reportEditorBootstrapMissingList(missingHelpers) {
        reportEditorBootstrapMissingDependency(missingHelpers.map(([name]) => name + ' missing').join('; '));
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
    const bindEditorPageEvents = deps.bindEditorPageEvents;
    const runEditorInitialLoadFlow = deps.runEditorInitialLoadFlow;
    const createEditorRefreshSaveRuntime = deps.createEditorRefreshSaveRuntime;
    const createEditorStartupContext = deps.createEditorStartupContext;
    if (typeof deps.registerEditorAuthStart !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorPageHelpers.registerEditorAuthStart missing'); return; }
    deps.applyEditorShellCopy(deps.safeI18nText, deps.i18n);
    const prepareEditorShell = deps.createPrepareEditorShell({
        applyEditorShellCopy: deps.applyEditorShellCopy,
        safeI18nText: deps.safeI18nText,
        i18n: deps.i18n,
        getMyTreesHref: deps.getMyTreesHref
    });
    const markEditorReady = deps.markEditorReady;
    const applyEditorEditabilityState = deps.applyEditorEditabilityState;
    const createEditorDomRefs = deps.createEditorDomRefs;
    const createEditorStartDependencyGuard = deps.shellHelpers.createEditorStartDependencyGuard;
    if (typeof createEditorStartDependencyGuard !== 'function') { reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorStartDependencyGuard missing'); return; }
    const createEditorStartDependencyChecker = deps.shellHelpers.createEditorStartDependencyChecker;
    if (typeof createEditorStartDependencyChecker !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorStartDependencyChecker missing');
        return;
    }
    const createEditorStartupDependencyWaiter = deps.createEditorStartupDependencyWaiter;
    const createEditorRequiredGlobalWaiter = deps.shellHelpers.createEditorRequiredGlobalWaiter;
    if (typeof createEditorRequiredGlobalWaiter !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorRequiredGlobalWaiter missing');
        return;
    }
    const createEditorStartupShellApplier = deps.shellHelpers.createEditorStartupShellApplier;
    if (typeof createEditorStartupShellApplier !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorStartupShellApplier missing');
        return;
    }
    const exposeCanvasEmptyGuideUpdater = deps.exposeCanvasEmptyGuideUpdater;
    const createEditorCanvasEmptyGuideUpdater = deps.shellHelpers.createEditorCanvasEmptyGuideUpdater;
    if (typeof createEditorCanvasEmptyGuideUpdater !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorCanvasEmptyGuideUpdater missing');
        return;
    }
    const exposeDetailPanelUpdater = deps.exposeDetailPanelUpdater;
    const createSelectedMomentFocusHandler = deps.createSelectedMomentFocusHandler;
    const createEditorSelectNodeHandler = deps.shellHelpers.createEditorSelectNodeHandler;
    if (typeof createEditorSelectNodeHandler !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorSelectNodeHandler missing');
        return;
    }
    const createSidebarTreeActionsUpdater = deps.createSidebarTreeActionsUpdater;
    const createEditorSidebarStatusUpdater = deps.shellHelpers.createEditorSidebarStatusUpdater;
    if (typeof createEditorSidebarStatusUpdater !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorSidebarStatusUpdater missing');
        return;
    }
    const createMemoryActionsReadinessWrapper = deps.createMemoryActionsReadinessWrapper;
    const createCurrentMomentDetailOpener = deps.createCurrentMomentDetailOpener;
    const createEditorInitialMemoryProvider = deps.shellHelpers.createEditorInitialMemoryProvider;
    if (typeof createEditorInitialMemoryProvider !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorInitialMemoryProvider missing');
        return;
    }
    const createEditorNextMemoryIdProvider = deps.shellHelpers.createEditorNextMemoryIdProvider;
    if (typeof createEditorNextMemoryIdProvider !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorNextMemoryIdProvider missing');
        return;
    }
    const createEditorInitialSelectionApplier = deps.shellHelpers.createEditorInitialSelectionApplier;
    if (typeof createEditorInitialSelectionApplier !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorInitialSelectionApplier missing');
        return;
    }
    const createEditorReadyFinalizer = deps.shellHelpers.createEditorReadyFinalizer;
    if (typeof createEditorReadyFinalizer !== 'function') {
        reportEditorBootstrapMissingDependency('LoveBudEditorShellHelpers.createEditorReadyFinalizer missing');
        return;
    }
    const resolveSaveStatusTimeFormatter = deps.resolveSaveStatusTimeFormatter;

    const startEditor = async () => {
        const { log, reportError } = deps.createEditorDebugReporter();

        const ensureStartEditorDependency = createEditorStartDependencyGuard({ reportError });

        const checkEditorStartDependencies = createEditorStartDependencyChecker({
            ensureStartEditorDependency,
            dependencies: [
                {
                    value: createEditorStartupDependencyWaiter,
                    message: 'LoveBudEditorShellHelpers.createEditorStartupDependencyWaiter missing'
                },
                {
                    value: markEditorReady,
                    message: 'LoveBudEditorShellHelpers.markEditorReady missing'
                },
                {
                    value: runEditorInitialLoadFlow,
                    message: 'LoveBudEditorInitialLoadFlow.runEditorInitialLoadFlow missing'
                },
                {
                    value: createEditorRefreshSaveRuntime,
                    message: 'LoveBudEditorRefreshSaveRuntime.createEditorRefreshSaveRuntime missing'
                }
            ]
        });

        if (!checkEditorStartDependencies()) return;

        log('startEditor sequence initiated');

        const waitForGlobal = createEditorStartupDependencyWaiter({ log, reportError });
        const waitForEditorRequiredGlobals = createEditorRequiredGlobalWaiter({
            waitForGlobal
        });

        if (!await waitForEditorRequiredGlobals()) return;

        const checkEditorStartupContextDependencies = createEditorStartDependencyChecker({
            ensureStartEditorDependency,
            dependencies: [
                {
                    value: createEditorDomRefs,
                    message: 'LoveBudEditorDomRefsBuilder.createEditorDomRefs missing'
                },
                {
                    value: createEditorStartupContext,
                    message: 'LoveBudEditorStartupContext.createEditorStartupContext missing'
                }
            ]
        });

        if (!checkEditorStartupContextDependencies()) return;

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

            const checkEditorStartupShellDependencies = createEditorStartDependencyChecker({
                ensureStartEditorDependency,
                dependencies: [
                    {
                        value: applyEditorEditabilityState,
                        message: 'LoveBudEditorShellHelpers.applyEditorEditabilityState missing'
                    }
                ]
            });

            if (!checkEditorStartupShellDependencies()) return;

            const applyEditorStartupShell = createEditorStartupShellApplier({
                prepareEditorShell,
                applyEditorEditabilityState,
                canEdit,
                log
            });

            applyEditorStartupShell();

            let isLocalSaveMode = false;

            const initialLoadResult = await runEditorInitialLoadFlow({
                urlTreeId,
                canvas,
                addBtn,
                cache: window.LoveBudCache || null,
                i18n: deps.i18n,
                apiClient: window.apiClient,
                createDefaultTreeTitle: () => deps.safeI18nText(deps.i18n, 'default_tree_title', '러브트리'),
                getConfirmedSessionUser: deps.getConfirmedSessionUser,
                showToast: deps.showToast,
                redirectToEditorLogin: deps.redirectToEditorLogin,
                buildTreeLoadErrorCopy: deps.buildTreeLoadErrorCopy,
                renderTreeLoadError: deps.renderTreeLoadError,
                markEditorReady,
                syncCurrentTreeData: deps.syncCurrentTreeData,
                editorDataLoader: deps.editorDataLoader,
                sharedNormalize: window.LoveBudNormalize?.normalizeMemory,
                escapeHtml: deps.escapeHtml,
                log,
                reportError
            });

            if (initialLoadResult.status === 'stopped') {
                return;
            }

            const treeId = initialLoadResult.treeId;
            const normalizeMemory = initialLoadResult.normalizeMemory;
            const treeMemories = initialLoadResult.treeMemories;

            const canonicalRootId = deps.getCanonicalRootId(treeMemories());
            let selectedNodeId = canonicalRootId;
            let currentEditingMemory = null;
            let editorCanvas = null;

            let memoryActions = null;

            const checkEditorMemoryActionsReadinessDependencies = createEditorStartDependencyChecker({
                ensureStartEditorDependency,
                dependencies: [
                    {
                        value: createMemoryActionsReadinessWrapper,
                        message: 'LoveBudEditorShellHelpers.createMemoryActionsReadinessWrapper missing'
                    }
                ]
            });

            if (!checkEditorMemoryActionsReadinessDependencies()) return;

            const updateSelectedMemoryFields = createMemoryActionsReadinessWrapper({
                getMemoryActions: () => memoryActions
            });

            const checkEditorMemoryProviderDependencies = createEditorStartDependencyChecker({
                ensureStartEditorDependency,
                dependencies: [
                    {
                        value: deps.editorTreeHelpers.createInitialMemory,
                        message: 'LoveBudEditorTreeHelpers.createInitialMemory missing'
                    },
                    {
                        value: deps.nextMemoryIdFromMemories,
                        message: 'LoveBudEditorTreeHelpers.nextMemoryIdFromMemories missing'
                    }
                ]
            });

            if (!checkEditorMemoryProviderDependencies()) return;

            const createInitialMemory = createEditorInitialMemoryProvider({
                editorTreeHelpers: deps.editorTreeHelpers,
                getTreeMemories: () => treeMemories(),
                findRootMemory: deps.findRootMemory,
                canonicalRootId,
                treeId,
                i18n: deps.i18n
            });

            const nextMemoryId = createEditorNextMemoryIdProvider({
                nextMemoryIdFromMemories: deps.nextMemoryIdFromMemories,
                getTreeMemories: () => treeMemories()
            });

            const emptyGuideUIHelper = window.LoveBudEditorEmptyGuideUI || {};
            const updateCanvasEmptyGuide = createEditorCanvasEmptyGuideUpdater({
                emptyGuideUIHelper,
                getTreeMemories: () => treeMemories(),
                log
            });

            // Bridge this back to LoveBudEditor so canvas can call it
            const checkEditorCanvasEmptyGuideBridgeDependencies = createEditorStartDependencyChecker({
                ensureStartEditorDependency,
                dependencies: [
                    {
                        value: exposeCanvasEmptyGuideUpdater,
                        message: 'LoveBudEditorShellHelpers.exposeCanvasEmptyGuideUpdater missing'
                    }
                ]
            });

            if (!checkEditorCanvasEmptyGuideBridgeDependencies()) return;

            exposeCanvasEmptyGuideUpdater({ updateCanvasEmptyGuide });

            // Lazy stubs for detail updaters. The real implementations are
            // assigned after `detailUI` and `updateSidebarStatus` are created
            // further below. These wrappers are captured by `selectNode` and
            // `updateTreeVisibility` so that they can be wired before the
            // detail UI is constructed without throwing a temporal dead zone
            // ReferenceError at `startEditor` startup.
            let setDetailEmptyState = () => {};
            let updateFocusSelectedBtn = () => {};
            let updateDetailPanel = () => {};
            let updateSidebarStatus = () => {};

            const callSetDetailEmptyState = (...args) => setDetailEmptyState(...args);
            const callUpdateFocusSelectedBtn = (...args) => updateFocusSelectedBtn(...args);
            const callUpdateDetailPanel = (...args) => updateDetailPanel(...args);
            const callUpdateSidebarStatus = (...args) => updateSidebarStatus(...args);

            const selectNode = createEditorSelectNodeHandler({
                getEditorCanvas: () => editorCanvas,
                getSaveStatusData: () => saveStatusData,
                editorSelectionUI: deps.editorSelectionUI,
                editorSaveStatus: deps.editorSaveStatus,
                setSelectedNodeId: (value) => { selectedNodeId = value; },
                setCurrentEditingMemory: (value) => { currentEditingMemory = value; },
                updateDetailPanel: callUpdateDetailPanel,
                updateFocusSelectedBtn: callUpdateFocusSelectedBtn,
                setDetailEmptyState: callSetDetailEmptyState,
                reportError
            });

            const checkEditorSelectedMomentFocusDependencies = createEditorStartDependencyChecker({
                ensureStartEditorDependency,
                dependencies: [
                    {
                        value: createSelectedMomentFocusHandler,
                        message: 'LoveBudEditorShellHelpers.createSelectedMomentFocusHandler missing'
                    }
                ]
            });

            if (!checkEditorSelectedMomentFocusDependencies()) return;

            const focusSelectedMoment = createSelectedMomentFocusHandler({
                getEditorCanvas: () => editorCanvas,
                getSelectedNodeId: () => selectedNodeId
            });

            const checkEditorCurrentMomentDetailDependencies = createEditorStartDependencyChecker({
                ensureStartEditorDependency,
                dependencies: [
                    {
                        value: createCurrentMomentDetailOpener,
                        message: 'LoveBudEditorShellHelpers.createCurrentMomentDetailOpener missing'
                    }
                ]
            });

            if (!checkEditorCurrentMomentDetailDependencies()) return;

            const openCurrentMomentDetail = createCurrentMomentDetailOpener({
                getCurrentEditingMemory: () => currentEditingMemory,
                getTreeMemories: () => treeMemories(),
                getSelectedNodeId: () => selectedNodeId,
                createInitialMemory,
                getTreeId: () => treeId,
                editorPageHelpers: deps.editorPageHelpers,
                getEditorBasePath: deps.getEditorBasePath,
                locationRef: window.location,
                reportError
            });

            const updateTreeVisibility = deps.editorTreeHelpers.createTreeVisibilityUpdater({
                canEdit,
                getTreeId: () => treeId,
                getApiClient: () => window.apiClient,
                applyUpdatedTreeVisibility: deps.editorTreeHelpers.applyUpdatedTreeVisibility,
                getCurrentTreeData: () => window.currentTreeData || {},
                updateSidebarStatus: callUpdateSidebarStatus,
                getCurrentEditingMemory: () => currentEditingMemory,
                updateDetailPanel: callUpdateDetailPanel,
                reportError
            });

            log('Initializing Detail UI...');
            const detailUI = window.createEditorDetailUI({
                detailPanel,
                i18n: deps.i18n,
                resolveTreeTitleText: deps.resolveTreeTitleText,
                resolveHintText: deps.resolveHintText,
                resolveInfoText: deps.resolveInfoText,
                resolveMemoryThumbnail: deps.resolveMemoryThumbnail,
                escapeHtml: deps.escapeHtml,
                isRootMemory: deps.isRootMemory,
                getCanonicalRootId: () => canonicalRootId,
                getSelectedNodeId: () => selectedNodeId,
                getTreeMemories: () => treeMemories(),
                getCurrentTreeData: () => window.currentTreeData || {},
                getLocalSaveMode: () => isLocalSaveMode,
                showToast: deps.showToast,
                updateTreeVisibility,
                openCurrentMomentDetail,
                focusSelectedMoment,
                updateSelectedMemoryFields
            });

            // Wire the lazy stubs with the real detail UI handlers. The
            // wrappers captured by `selectNode` and `updateTreeVisibility`
            // earlier now resolve to these implementations.
            setDetailEmptyState = detailUI.setDetailEmptyState;
            updateFocusSelectedBtn = detailUI.updateFocusSelectedBtn;
            updateDetailPanel = detailUI.updateDetailPanel;
            const updateSidebarStatusBase = detailUI.updateSidebarStatus;
            const checkEditorDetailPanelExposureDependencies = createEditorStartDependencyChecker({
                ensureStartEditorDependency,
                dependencies: [
                    {
                        value: exposeDetailPanelUpdater,
                        message: 'LoveBudEditorShellHelpers.exposeDetailPanelUpdater missing'
                    }
                ]
            });

            if (!checkEditorDetailPanelExposureDependencies()) return;

            exposeDetailPanelUpdater({ updateDetailPanel });

            const sidebarUIHelper = window.LoveBudEditorSidebarUI || {};
            const checkEditorSidebarTreeActionsDependencies = createEditorStartDependencyChecker({
                ensureStartEditorDependency,
                dependencies: [
                    {
                        value: createSidebarTreeActionsUpdater,
                        message: 'LoveBudEditorShellHelpers.createSidebarTreeActionsUpdater missing'
                    }
                ]
            });

            if (!checkEditorSidebarTreeActionsDependencies()) return;

            const updateSidebarTreeActions = createSidebarTreeActionsUpdater({
                sidebarUIHelper,
                i18n: deps.i18n,
                safeI18nText: deps.safeI18nText,
                getTreeId: () => treeId
            });

            updateSidebarStatus = createEditorSidebarStatusUpdater({
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
                isRootMemory: deps.isRootMemory,
                resolveMemoryThumbnail: deps.resolveMemoryThumbnail,
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
                log, reportError, editorDataLoader: deps.editorDataLoader, treeId, apiClient: window.apiClient, normalizeMemory, treeMemories,
                getCurrentEditingMemory: () => currentEditingMemory, setCurrentEditingMemory: (value) => { currentEditingMemory = value; },
                isRootMemory: deps.isRootMemory, canonicalRootId, updateDetailPanel, updateSidebarStatus, initCanvas, exposeRefreshMemoriesBridge: deps.exposeRefreshMemoriesBridge,
                resolveSaveStatusTimeFormatter, editorSaveStatus: deps.editorSaveStatus, i18n: deps.i18n, createSaveStatusOrchestrationFallback: deps.createSaveStatusOrchestrationFallback, saveStatusOrchestrationHelper: window.LoveBudEditorSaveStatusOrchestration || {}
            });

            if (refreshSaveRuntime.status === 'stopped') return;
            const { saveStatusData, updateSaveStatus } = refreshSaveRuntime;

            log('Initializing Memory Actions...');
            memoryActions = window.createEditorMemoryActions({
                i18n: deps.i18n,
                updateSaveStatus,
                updateDetailPanel,
                updateSidebarStatus,
                showToast: deps.showToast,
                getCurrentEditingMemory: () => currentEditingMemory,
                setCurrentEditingMemory: (value) => { currentEditingMemory = value; },
                getTreeMemories: () => window.currentTreeMemories || [],
                setTreeMemories: (value) => { window.currentTreeMemories = value; },
                getSelectedNodeId: () => selectedNodeId,
                setSelectedNodeId: (value) => { selectedNodeId = value; },
                getCanonicalRootId: () => canonicalRootId,
                isRootMemory: deps.isRootMemory,
                findRootMemory: deps.findRootMemory,
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
                i18n: deps.i18n,
                treeId,
                getSelectedNodeId: () => selectedNodeId,
                getCanonicalRootId: () => canonicalRootId,
                resolveParentIdForCreate: deps.resolveParentIdForCreate,
                updateSaveStatus,
                showToast: deps.showToast,
                getYouTubeInputErrorMessage: (rawUrl) => deps.getYouTubeInputErrorMessage(deps.i18n, rawUrl),
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

            const { showAddMemoryForm, hideAddMemoryForm, addMemoryFromForm, addMemoryFromScoutPayload } = memoryForm;

            const createRelationshipHintsUIController = window.LoveBudRelationshipHintsUIController && typeof window.LoveBudRelationshipHintsUIController.createRelationshipHintsUIController === 'function'
                ? window.LoveBudRelationshipHintsUIController.createRelationshipHintsUIController
                : null;
            const createRelationshipHintStateMachine = window.LoveBudRelationshipHintStateMachine && typeof window.LoveBudRelationshipHintStateMachine.createRelationshipHintStateMachine === 'function'
                ? window.LoveBudRelationshipHintStateMachine.createRelationshipHintStateMachine
                : null;
            let relationshipHintsUIController = null;
            if (createRelationshipHintsUIController && createRelationshipHintStateMachine) {
                try {
                    relationshipHintsUIController = createRelationshipHintsUIController({
                        documentRef: document,
                        stateMachineFactory: createRelationshipHintStateMachine,
                        i18n: deps.i18n,
                        getTreeId: () => treeId,
                        getSelectedNodeId: () => selectedNodeId,
                        getTreeMemories: () => treeMemories(),
                        getCurrentEditingMemory: () => currentEditingMemory,
                        showToast: deps.showToast,
                        reportError,
                        onPresent: function (hint, transitionResult) {
                            log('relationship hint presented for review; no persistence in this slice', hint, transitionResult);
                        },
                        onAccept: function (hint, transitionResult) {
                            log('relationship hint accepted for review; no saved relationship created', hint, transitionResult);
                        },
                        onDismiss: function (hint, transitionResult) {
                            log('relationship hint dismissed without persistence', hint, transitionResult);
                        },
                        onHide: function (hint, transitionResult) {
                            log('relationship hint hidden without persistence', hint, transitionResult);
                        },
                        onRetry: function (hint, transitionResult) {
                            log('relationship hint retry requested without network work', hint, transitionResult);
                        }
                    });
                    window.LoveBudRelationshipHintsUI = relationshipHintsUIController;
                } catch (error) {
                    reportError('Failed to create relationship hints UI controller', error);
                }
            }

            // Initialize Scout Draft UI singleton with onDraftSave callback
            if (
                window.LoveBudScoutDraftUI &&
                typeof window.LoveBudScoutDraftUI.createScoutDraftUI === 'function' &&
                typeof addMemoryFromScoutPayload === 'function'
            ) {
                const scoutDraftUI = window.LoveBudScoutDraftUI.createScoutDraftUI({
                    treeId,
                    getSelectedNodeId: () => selectedNodeId,
                    getCanonicalRootId: () => canonicalRootId,
                    resolveParentIdForCreate: deps.resolveParentIdForCreate,
                    showToast: deps.showToast,
                    i18n: deps.i18n,
                    onDraftSave: async (payload, draft) => {
                        await addMemoryFromScoutPayload(payload, draft);
                    }
                });

                // Bridge singleton methods
                window.LoveBudScoutDraftUI.open = function () {
                    return scoutDraftUI.open();
                };
                window.LoveBudScoutDraftUI.close = function () {
                    return scoutDraftUI.close();
                };
                window.LoveBudScoutDraftUI.isOpen = function () {
                    return scoutDraftUI.isOpen();
                };
            }

            log('Binding events...');
            const checkEditorPageEventStatusDependencies = createEditorStartDependencyChecker({
                ensureStartEditorDependency,
                dependencies: [
                    {
                        value: deps.getHttpStatus,
                        message: 'LoveBudEditorShellHelpers.getHttpStatus missing'
                    }
                ]
            });

            if (!checkEditorPageEventStatusDependencies()) return;

            if (typeof bindEditorPageEvents === 'function') {
                bindEditorPageEvents({
                    canEdit,
                    sidebarUIHelper,
                    editorBindings: deps.editorBindings,
                    emptyGuideUIHelper,
                    getTreeId: () => treeId,
                    updateTreeVisibility,
                    showToast: deps.showToast,
                    safeI18nText: deps.safeI18nText,
                    i18n: deps.i18n,
                    getHttpStatus: deps.getHttpStatus,
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
                setSelectedNodeId: (value) => { selectedNodeId = value; },
                createInitialMemory,
                isRootMemory: deps.isRootMemory,
                getCanonicalRootId: () => canonicalRootId,
                setCurrentEditingMemory: (value) => { currentEditingMemory = value; },
                setDetailEmptyState: callSetDetailEmptyState,
                log
            });

            applyEditorInitialSelection();

            // Initialize Moment List (optional feature)
            const createMomentListBinding = deps.shellHelpers.createMomentListBinding;
            if (typeof createMomentListBinding === 'function') {
                log('Initializing Moment List...');
                const momentList = createMomentListBinding({
                    documentRef: document,
                    getTreeMemories: () => treeMemories(),
                    getSelectedNodeId: () => selectedNodeId,
                    setSelectedNodeId: (value) => { selectedNodeId = value; },
                    updateDetailPanel: callUpdateDetailPanel,
                    rerenderCanvas: () => initCanvas(),
                    isRootMemory: deps.isRootMemory,
                    getCanonicalRootId: () => canonicalRootId,
                    i18n: deps.i18n
                });
                window.LoveBudEditorMomentListInstance = momentList;
                log('Moment List initialized');
            }

            const finalizeEditorReady = createEditorReadyFinalizer({
                updateSidebarStatus,
                markEditorReady,
                log
            });

            finalizeEditorReady();
        } catch (error) {
            reportError('CRITICAL: Exception in startEditor', error);
        }
    };

    deps.registerEditorAuthStart({
        windowRef: window,
        startEditor: startEditor,
        redirectToEditorLogin: deps.redirectToEditorLogin,
        readConfirmedAuthCache: deps.readConfirmedAuthCache
    });
});
