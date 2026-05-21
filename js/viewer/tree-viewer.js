(function() {
    'use strict';

    var MARKER = 'LoveBudTreeViewerLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    var SEL = {
        shell: '#viewerTreeShell',
        loading: '#viewerLoadingState',
        empty: '#viewerEmptyState',
        error: '#viewerErrorState',
        treeContainer: '#viewerTreeContainer',
        treeTitle: '#viewerTreeTitle',
        treeMeta: '#viewerTreeMeta'
    };

    var currentTreeId = null;

    var RS = window.LoveBudViewerRenderState.create(SEL);

    var Route = window.LoveBudViewerRoute;
    var DT = window.LoveBudViewerDataTransform;
    var ShellRender = window.LoveBudViewerShellRender;
    var ShareStatusUI = window.LoveBudViewerShareStatusUI;
    var showShareStatus = ShareStatusUI && typeof ShareStatusUI.showShareStatus === 'function'
        ? ShareStatusUI.showShareStatus
        : function() {};

    var DataLoader = window.LoveBudViewerDataLoader;
    var State = window.LoveBudViewerState;
    var RenderTree = window.LoveBudVisitorViewerRenderTree;
    var Panels = window.LoveBudVisitorViewerPanels;
    var HandlerFactory = window.LoveBudViewerHandlerFactory;
    var ShareExportBridge = window.LoveBudViewerShareExportBridge;
    var ClickActions = window.LoveBudViewerClickActions;
    var RetrySetup = window.LoveBudViewerRetrySetup;
    var TestHooks = window.LoveBudViewerTestHooks;

    var InitFlow = window.LoveBudViewerInitFlow;
    if (!InitFlow || typeof InitFlow.startViewer !== 'function') {
        throw new Error('Viewer init flow helper unavailable');
    }

    InitFlow.startViewer({
        RS: RS,
        SEL: SEL,
        Route: Route,
        DT: DT,
        ShellRender: ShellRender,
        showShareStatus: showShareStatus,
        DataLoader: DataLoader,
        State: State,
        HandlerFactory: HandlerFactory,
        ShareExportBridge: ShareExportBridge,
        ClickActions: ClickActions,
        RenderTree: RenderTree,
        Panels: Panels,
        RetrySetup: RetrySetup,
        TestHooks: TestHooks
    });
})();
