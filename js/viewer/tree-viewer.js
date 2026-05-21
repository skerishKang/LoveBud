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

            var handler = {
                getShareUrl: function() { return window.location.href; },
                onSelectBranch: function(branchId) {
                    state.selectedBranchId = branchId;
                    state.selectedMomentId = null;
                    state.activePanel = 'branch';
                    refresh();
                },
                onSelectMoment: function(momentId, branchId) {
                    if (viewerData.rootSeed && momentId === viewerData.rootSeed.id) {
                        handler.onSelectBranch(branchId || viewerData.rootSeed.branchId || 'main');
                        return;
                    }
                    state.selectedBranchId = branchId;
                    state.selectedMomentId = momentId;
                    state.activePanel = 'moment';
                    refresh();
                },
                closeMoment: function() {
                    state.selectedMomentId = null;
                    state.activePanel = 'branch';
                    refresh();
                },
                openPanel: function(panel) { state.activePanel = panel; refresh(); },
                closePanel: function() {
                    if (state.selectedMomentId) state.activePanel = 'moment';
                    else if (state.selectedBranchId) state.activePanel = 'branch';
                    else state.activePanel = 'empty';
                    refresh();
                },
                toggleLike: function() { state.likedTree = !state.likedTree; },
                onToggleLayout: function() {
                    state.layoutMode = state.layoutMode === 'organic' ? 'hierarchy' : 'organic';
                    var toggleLabel = document.getElementById('vvLayoutToggleLabel');
                    if (toggleLabel) {
                        toggleLabel.textContent = state.layoutMode === 'hierarchy' ? '유기적 보기' : '구조 보기';
                    }
                    refresh();
                },
            };

            // Share/export action bridge extracted to viewer-share-export-actions.js
            var shareExportHandlers = null;
            (function() {
                var SE = window.LoveBudViewerShareExportActions;
                if (!SE) return;
                var se = SE.createShareExportHandlers({
                    handler: handler,
                    showShareStatus: showShareStatus,
                    get selectedMoment() { return state.selectedMoment; },
                    get panelBranch() { return state.panelBranch; }
                });
                shareExportHandlers = se;
                handler.copyLink = se.copyLink;
                handler.nativeShare = se.nativeShare;
                handler.platformShare = se.platformShare;
                handler.exportTreeImageCard = se.exportTreeImageCard;
                handler.exportMomentImageCard = se.exportMomentImageCard;
                handler.printTree = se.printTree;
            })();

            container.addEventListener('click', function(e) {
                var action = e.target.closest('[data-action]');
                if (action) {
                    var a = action.dataset.action;
                    if (a === 'close-moment') handler.closeMoment();
                    else if (a === 'close-panel') handler.closePanel();
                    else if (a === 'toggle-like') { handler.toggleLike(); action.classList.toggle('is-liked'); }
                    else if (a === 'open-tree-comments') handler.openPanel('tree-comments');
                    else if (a === 'open-share') handler.openPanel('share');
                    else if (a === 'toggle-layout') handler.onToggleLayout();
                    else {
                        var SE = window.LoveBudViewerShareExportActions;
                        if (SE && shareExportHandlers && SE.handleShareExportAction(action, shareExportHandlers)) {}
                    }
                    return;
                }
                var momentBtn = e.target.closest('[data-moment-id]');
                if (momentBtn) { handler.onSelectMoment(momentBtn.dataset.momentId, momentBtn.dataset.branchId); return; }
                var branchBtn = e.target.closest('.vv-branch-label[data-branch-id]');
                if (branchBtn) { handler.onSelectBranch(branchBtn.dataset.branchId); return; }
            });

            state.selectedBranchId = (viewerData.branches[0] && viewerData.branches[0].id) || 'main';
            state.activePanel = 'empty';
            refresh();

        } catch (error) {
            console.error('[tree-viewer] load failed:', error);
            RS.renderError();
        }
    }

    function setupRetry() {
        var btn = document.getElementById('viewerRetryBtn');
        if (btn) btn.addEventListener('click', function() { if (currentTreeId) initViewer(); });
    }

    if (window.__LOVE_BUD_TREE_VIEWER_TEST_HOOKS__ && DT) {
        window.LoveBudTreeViewerTestHooks = {
            buildBranches: DT.buildBranches,
            getTreeId: Route && Route.getTreeId,
            renderShell: ShellRender && ShellRender.renderShell
        };
    }

    if (window.__LOVE_BUD_TREE_VIEWER_SKIP_INIT__) return;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setupRetry(); initViewer(); });
    } else {
        setupRetry();
        initViewer();
    }
})();
