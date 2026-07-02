(function() {
    'use strict';

    var MARKER = 'LoveBudViewerInitFlowLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    function startViewer(context) {
        var RS = context.RS;
        var SEL = context.SEL;
        var Route = context.Route;
        var DT = context.DT;
        var ShellRender = context.ShellRender;
        var showShareStatus = context.showShareStatus;
        var DataLoader = context.DataLoader;
        var State = context.State;
        var HandlerFactory = context.HandlerFactory;
        var ShareExportBridge = context.ShareExportBridge;
        var ClickActions = context.ClickActions;
        var RenderTree = context.RenderTree;
        var Panels = context.Panels;
        var RetrySetup = context.RetrySetup;
        var TestHooks = context.TestHooks;

        var currentTreeId = null;

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

                // #3060: Deterministic fallback for confirmed Neon hub snapshot
                // When data returns empty/null, instead of a generic empty state
                // we render the shell with hardcoded defaults so the viewer
                // still shows a meaningful tree context.
                if (!memories || memories.length === 0) {
                    var fallbackData = (State && typeof State.createDeterministicFallbackData === 'function')
                        ? State.createDeterministicFallbackData(treeId)
                        : { tree: { title: '\uB7EC\uBE0C\uD2B8\uB9AC', creator: '@lovetree_viewer', meta: '' } };
                    var fbContainer = RS.qs ? RS.qs('#viewerTreeContainer') : document.querySelector('#viewerTreeContainer');
                    if (fbContainer) {
                        RS.renderDeterministicFallback();
                        if (ShellRender && typeof ShellRender.renderFallbackShell === 'function') {
                            ShellRender.renderFallbackShell(fbContainer, fallbackData);
                        } else {
                            ShellRender.renderShell(fbContainer, fallbackData);
                        }
                    }
                    return;
                }

                var viewerData = DT.buildBranches(memories);

                // Set data for #953 modules
                window.LoveBudVisitorViewerData = viewerData;

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

                if (!ShareExportBridge || typeof ShareExportBridge.setupShareExportBridge !== 'function') {
                    throw new Error('Viewer share export bridge helper unavailable');
                }
                var shareExportHandlers = ShareExportBridge.setupShareExportBridge({
                    handler: handler,
                    showShareStatus: showShareStatus,
                    state: state
                });

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
            if (RetrySetup && typeof RetrySetup.setupRetry === 'function') {
                RetrySetup.setupRetry(function() { return currentTreeId; }, initViewer);
            }
        }

        if (TestHooks) {
            TestHooks.exportTestHooks({
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
    }

    window.LoveBudViewerInitFlow = {
        startViewer: startViewer
    };
})();
