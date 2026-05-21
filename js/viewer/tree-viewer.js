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

    async function initViewer() {
        var treeId = Route.getTreeId();
        if (!treeId) { RS.renderEmpty(); return; }
        currentTreeId = treeId;
        RS.showLoading();

        try {
            if (!DataLoader || typeof DataLoader.loadPublicData !== 'function') {
                throw new Error('Viewer data loader helper unavailable');
            }
            var memories = await DataLoader.loadPublicData(treeId);
            if (!memories || memories.length === 0) { RS.renderEmpty(); return; }

            var viewerData = DT.buildBranches(memories);

            // Set data for #953 modules
            window.LoveBudVisitorViewerData = viewerData;

            var RenderTree = window.LoveBudVisitorViewerRenderTree;
            var Panels = window.LoveBudVisitorViewerPanels;

            // State helper (extracted to viewer-state.js)
            var State = window.LoveBudViewerState;
            if (!State) throw new Error('Viewer state helper unavailable');
            if (!ShellRender || typeof ShellRender.renderShell !== 'function') throw new Error('Viewer shell render helper unavailable');

            // Render state
            var state = State.createInitialState();

            RS.show(SEL.treeContainer);
            RS.hide(SEL.loading, SEL.empty, SEL.error);

            var container = RS.qs('#viewerTreeContainer');
            if (!container) return;

            ShellRender.renderShell(container, viewerData);

            var allMoments = State.getAllMoments(viewerData);

            function refresh() {
                var selection = State.resolveSelection(viewerData, allMoments, state);
                State.applySelection(state, selection);

                var treeBox = container.querySelector('.vv-tree-container');
                if (treeBox && RenderTree) RenderTree.renderTree(treeBox, state, handler);

                var panelHost = container.querySelector('.vv-panel-host');
                if (panelHost && Panels) panelHost.innerHTML = Panels.renderPanel(state, handler);
            }

            var HandlerFactory = window.LoveBudViewerHandlerFactory;
            if (!HandlerFactory || typeof HandlerFactory.createHandler !== 'function') {
                throw new Error('Viewer handler factory helper unavailable');
            }
            var handler = HandlerFactory.createHandler({
                state: state,
                viewerData: viewerData,
                refresh: refresh,
                getShareUrl: function() { return window.location.href; },
                documentRef: document
            });

            var ShareExportBridge = window.LoveBudViewerShareExportBridge;
            if (!ShareExportBridge || typeof ShareExportBridge.setupShareExportBridge !== 'function') {
                throw new Error('Viewer share export bridge helper unavailable');
            }
            var shareExportHandlers = ShareExportBridge.setupShareExportBridge({
                handler: handler,
                showShareStatus: showShareStatus,
                state: state
            });

            var ClickActions = window.LoveBudViewerClickActions;
            if (!ClickActions || typeof ClickActions.attachClickActions !== 'function') {
                throw new Error('Viewer click actions helper unavailable');
            }
            ClickActions.attachClickActions(container, handler, shareExportHandlers);

            state.selectedBranchId = (viewerData.branches[0] && viewerData.branches[0].id) || 'main';
            state.activePanel = 'empty';
            refresh();

        } catch (error) {
            console.error('[tree-viewer] load failed:', error);
            RS.renderError();
        }
    }

    function setupRetry() {
        var RetrySetup = window.LoveBudViewerRetrySetup;
        if (RetrySetup && typeof RetrySetup.setupRetry === 'function') {
            RetrySetup.setupRetry(function() { return currentTreeId; }, initViewer);
        }
    }

    if (window.LoveBudViewerTestHooks) {
        window.LoveBudViewerTestHooks.exportTestHooks({
            DT: DT,
            Route: Route,
            ShellRender: ShellRender
        });
    }

    if (window.__LOVE_BUD_TREE_VIEWER_SKIP_INIT__) return;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setupRetry(); initViewer(); });
    } else {
        setupRetry();
        initViewer();
    }
})();
