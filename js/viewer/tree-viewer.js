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

    function t(key, fallbackKo, fallbackEn) {
        var dict = window.i18nViewer && window.i18nViewer[key];
        if (dict && typeof dict === 'object') {
            var locale = (window.i18n && window.i18n.currentLang || 'ko').toLowerCase();
            return dict[locale] || dict.ko || dict.en || fallbackKo;
        }
        return dict || fallbackKo || fallbackEn || key;
    }

    function escapeHtml(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) {
            return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
    }

    function qs(sel) { return document.querySelector(sel); }
    function show() {
        for (var i = 0; i < arguments.length; i++) {
            var el = qs(arguments[i]);
            if (el) el.style.display = '';
        }
    }
    function hide() {
        for (var i = 0; i < arguments.length; i++) {
            var el = qs(arguments[i]);
            if (el) el.style.display = 'none';
        }
    }

    function showLoading() { hide(SEL.treeContainer, SEL.empty, SEL.error); show(SEL.loading); }
    function renderEmpty() { hide(SEL.treeContainer, SEL.loading, SEL.error); show(SEL.empty); }
    function renderError() { hide(SEL.treeContainer, SEL.loading, SEL.empty); show(SEL.error); }

    async function loadPublicData(treeId) {
        var getMemories = window.apiClient &&
            (window.apiClient.communityApi && window.apiClient.communityApi.getCachedCommunityMemories ||
             window.apiClient.getCachedCommunityMemories);

        if (typeof getMemories !== 'function') throw new Error('Community API not available');

        var memories = await getMemories({ treeId: treeId, limit: 100 });
        return Array.isArray(memories) ? memories.filter(function(m) { return m && m.visibility === 'public'; }) : [];
    }

    function buildBranches(memories) {
        // Group moments into a single main branch with computed positions
        var moments = memories.map(function(m, i) {
            return {
                id: 'moment-' + i,
                title: m.title || m.emotionMemo || '',
                tag: (m.emotionTags && m.emotionTags[0]) || '',
                caption: m.emotionMemo || m.title || '',
                emoji: '✦',
                t: (i + 0.5) / Math.max(memories.length, 1)
            };
        });

        var branch = {
            id: 'main',
            name: t('viewer.mainBranch', '전체 흐름', 'Full Flow'),
            side: 'left',
            color: 'rose',
            startY: 77,
            endY: 16,
            endX: 22,
            curveA: 38,
            curveB: 28,
            caption: memories.length + t('viewer.momentsConnected', '개의 순간이 이어져 있어요', ' connected moments'),
            count: memories.length,
            moments: moments
        };

        var rootSeed = {
            id: 'moment-root',
            branchId: 'main',
            title: (memories[0] && memories[0].title) || t('viewer.rootMoment', '시작된 순간', 'Starting moment'),
            tag: t('viewer.start', '시작', 'Start'),
            caption: (memories[0] && memories[0].emotionMemo) || '',
            color: 'from-rose-200 via-rose-100 to-amber-50',
            emoji: '✦'
        };

        return {
            branches: [branch],
            rootSeed: rootSeed,
            palette: { rose: { stroke:'#e99aac', soft:'#fff1f3', text:'#be123c', dim:'rgba(251,113,133,.16)' } },
            curvePoint: function(branch, t) {
                var x0=50, y0=branch.startY;
                var x1=branch.curveA, y1=branch.startY-8;
                var x2=branch.curveB, y2=branch.endY+8;
                var x3=branch.endX, y3=branch.endY;
                var mt=1-t;
                return { x: mt*mt*mt*x0 + 3*mt*mt*t*x1 + 3*mt*t*t*x2 + t*t*t*x3,
                         y: mt*mt*mt*y0 + 3*mt*mt*t*y1 + 3*mt*t*t*y2 + t*t*t*y3 };
            },
            tree: {
                title: (memories[0] && memories[0].treeTitle) || t('viewer.treeTitle', '러브트리', 'LoveTree'),
                creator: (memories[0] && memories[0].artist ? '@' + memories[0].artist : '@lovetree_viewer') || '',
                meta: memories.length + t('viewer.metaMoments', '개의 순간 · 공개 러브트리', ' moments · public LoveTree')
            },
            treeComments: [],
            momentComments: {}
        };
    }

    async function initViewer() {
        var params = new URLSearchParams(window.location.search);
        var treeId = params.get('treeId');
        if (!treeId) { renderEmpty(); return; }
        currentTreeId = treeId;
        showLoading();

        try {
            var memories = await loadPublicData(treeId);
            if (!memories || memories.length === 0) { renderEmpty(); return; }

            var viewerData = buildBranches(memories);

            // Set data for #953 modules
            window.LoveBudVisitorViewerData = viewerData;

            var RenderTree = window.LoveBudVisitorViewerRenderTree;
            var Panels = window.LoveBudVisitorViewerPanels;

            // Render state
            var state = { selectedBranchId: 'main', selectedMomentId: null, activePanel: 'empty', likedTree: false };

            show(SEL.treeContainer);
            hide(SEL.loading, SEL.empty, SEL.error);

            var container = qs('#viewerTreeContainer');
            if (!container) return;

            var treeTitle = viewerData.tree.title;
            var treeMetaText = viewerData.tree.meta;

            container.innerHTML =
                '<header class="vv-header">' +
                '  <div><p class="vv-eyebrow">Public LoveTree Viewer</p>' +
                '  <h1 class="vv-title">' + escapeHtml(treeTitle) + '</h1>' +
                '  <div class="vv-meta-row"><span>' + escapeHtml(viewerData.tree.creator) + '</span><span class="vv-dot">·</span><span>' + escapeHtml(treeMetaText) + '</span></div></div>' +
                '</header>' +
                '<div class="vv-viewer-layout">' +
                '  <div class="vv-tree-container"></div>' +
                '  <div class="vv-panel-host"></div>' +
                '</div>';

            function getAllMoments() {
                var results = [];
                results.push({ id: viewerData.rootSeed.id, branchId: 'main', title: viewerData.rootSeed.title, tag: viewerData.rootSeed.tag, caption: viewerData.rootSeed.caption, emoji: viewerData.rootSeed.emoji });
                viewerData.branches[0].moments.forEach(function(m) {
                    results.push({ id: m.id, branchId: 'main', title: m.title, tag: m.tag, caption: m.caption, emoji: m.emoji });
                });
                return results;
            }

            var allMoments = getAllMoments();

            function refresh() {
                var branch = viewerData.branches[0];
                var moment = allMoments.find(function(m) { return m.id === state.selectedMomentId; });
                state.selectedBranch = branch;
                state.selectedMoment = moment;
                state.panelBranch = branch;

                var treeBox = container.querySelector('.vv-tree-container');
                if (treeBox && RenderTree) RenderTree.renderTree(treeBox, state, handler);

                var panelHost = container.querySelector('.vv-panel-host');
                if (panelHost && Panels) panelHost.innerHTML = Panels.renderPanel(state, handler);
            }

            var handler = {
                onSelectBranch: function(branchId) {
                    state.selectedBranchId = branchId;
                    state.selectedMomentId = null;
                    state.activePanel = 'branch';
                    refresh();
                },
                onSelectMoment: function(momentId, branchId) {
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
                toggleLike: function() { state.likedTree = !state.likedTree; }
            };

            container.addEventListener('click', function(e) {
                var action = e.target.closest('[data-action]');
                if (action) {
                    var a = action.dataset.action;
                    if (a === 'close-moment') handler.closeMoment();
                    else if (a === 'close-panel') handler.closePanel();
                    else if (a === 'toggle-like') handler.toggleLike();
                    else if (a === 'open-tree-comments') handler.openPanel('tree-comments');
                    else if (a === 'open-share') handler.openPanel('share');
                    return;
                }
                var momentBtn = e.target.closest('[data-moment-id]');
                if (momentBtn) { handler.onSelectMoment(momentBtn.dataset.momentId, momentBtn.dataset.branchId); return; }
                var branchBtn = e.target.closest('.vv-branch-label[data-branch-id]');
                if (branchBtn) { handler.onSelectBranch(branchBtn.dataset.branchId); return; }
            });

            state.selectedBranchId = 'main';
            state.activePanel = 'empty';
            refresh();

        } catch (error) {
            console.error('[tree-viewer] load failed:', error);
            renderError();
        }
    }

    function setupRetry() {
        var btn = document.getElementById('viewerRetryBtn');
        if (btn) btn.addEventListener('click', function() { if (currentTreeId) initViewer(); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setupRetry(); initViewer(); });
    } else {
        setupRetry();
        initViewer();
    }
})();
