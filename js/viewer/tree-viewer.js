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

    var DT = window.LoveBudViewerDataTransform;
    function escapeHtml(v) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.escapeHtml(v);
        return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) {
            return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
    }

    async function loadPublicData(treeId) {
        var getMemories = window.apiClient &&
            (window.apiClient.communityApi && window.apiClient.communityApi.getCachedCommunityMemories ||
             window.apiClient.getCachedCommunityMemories);

        if (typeof getMemories !== 'function') throw new Error('Community API not available');

        var memories = await getMemories({ treeId: treeId, limit: 100 });
        return Array.isArray(memories) ? memories.filter(function(m) { return m && m.visibility === 'public'; }) : [];
    }

    async function initViewer() {
        var params = new URLSearchParams(window.location.search);
        var treeId = params.get('treeId');
        if (!treeId) { RS.renderEmpty(); return; }
        currentTreeId = treeId;
        RS.showLoading();

        try {
            var memories = await loadPublicData(treeId);
            if (!memories || memories.length === 0) { RS.renderEmpty(); return; }

            var viewerData = DT.buildBranches(memories);

            // Set data for #953 modules
            window.LoveBudVisitorViewerData = viewerData;

            var RenderTree = window.LoveBudVisitorViewerRenderTree;
            var Panels = window.LoveBudVisitorViewerPanels;

            // State helper (extracted to viewer-state.js)
            var State = window.LoveBudViewerState;
            if (!State) throw new Error('Viewer state helper unavailable');

            // Render state
            var state = State.createInitialState();

            RS.show(SEL.treeContainer);
            RS.hide(SEL.loading, SEL.empty, SEL.error);

            var container = RS.qs('#viewerTreeContainer');
            if (!container) return;

            var treeTitle = viewerData.tree.title;
            var treeMetaText = viewerData.tree.meta;

            container.innerHTML =
                '<header class="vv-header">' +
                '  <div><p class="vv-eyebrow">Public LoveTree Viewer</p>' +
                '  <h1 class="vv-title">' + escapeHtml(treeTitle) + '</h1>' +
                '  <div class="vv-meta-row"><span>' + escapeHtml(viewerData.tree.creator) + '</span><span class="vv-dot">·</span><span>' + escapeHtml(treeMetaText) + '</span></div></div>' +
                '  <div class="vv-header-actions">' +
                '    <button type="button" class="vv-layout-toggle" data-action="toggle-layout" aria-label="&#xB808;&#xC774;&#xC544;&#xC6B0;&#xCDE8; &#xC804;&#xD658;" title="&#xB808;&#xC774;&#xC544;&#xC6B0;&#xCDE8; &#xC804;&#xD658;">' +
                '      <span class="vv-layout-toggle-label" id="vvLayoutToggleLabel">&#xAD6C;&#xC870; &#xBCF4;&#xAE30;</span>' +
                '    </button>' +
                '  </div>' +
                '</header>' +
                '<div class="vv-action-dock">' +
                '  <div class="vv-action-group">' +
                '    <button type="button" class="vv-action-btn" data-action="toggle-like" aria-label="트리 좋아요"><span class="vv-action-icon">' +
                '<svg viewBox="0 0 24 24" fill="none" class="vv-icon vv-icon-heart"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg></span>' +
                '    좋아요</button>' +
                '    <button type="button" class="vv-action-btn" data-action="open-tree-comments" aria-label="트리 댓글 보기"><span class="vv-action-icon">' +
                '<svg viewBox="0 0 24 24" fill="none" class="vv-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg></span>' +
                '    댓글</button>' +
                '    <button type="button" class="vv-action-btn" data-action="open-share" aria-label="트리 공유하기"><span class="vv-action-icon">' +
                '<svg viewBox="0 0 24 24" fill="none" class="vv-icon"><path d="M8.1 12.7 15.9 17M15.9 7 8.1 11.3M6.4 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Zm10.9-5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Zm0 10a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>' +
                '    공유</button>' +
                '  </div>' +
                '</div>' +
                '<div class="vv-viewer-layout">' +
                '  <div class="vv-tree-container"></div>' +
                '  <div class="vv-panel-host"></div>' +
                '</div>';

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

            function showShareStatus(result) {
                if (!result || !result.message) return;
                var statusEl = document.getElementById('vvShareStatus');
                if (!statusEl) return;
                statusEl.textContent = result.message;
                statusEl.className = 'vv-share-status ' + (result.success ? 'is-success' : 'is-error');
                clearTimeout(statusEl._hideTimer);
                statusEl._hideTimer = setTimeout(function() {
                    statusEl.textContent = '';
                    statusEl.className = 'vv-share-status';
                }, 3000);
            }

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
            buildBranches: DT.buildBranches
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
