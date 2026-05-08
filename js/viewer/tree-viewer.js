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
    var viewerState = {};

    // i18n helper
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
            if (el) el.removeAttribute('hidden');
        }
    }
    function hide() {
        for (var i = 0; i < arguments.length; i++) {
            var el = qs(arguments[i]);
            if (el) el.setAttribute('hidden', '');
        }
    }

    function getCurrentLocale() {
        var locale = window.i18n && window.i18n.currentLang || 'ko';
        return String(locale).toLowerCase().startsWith('en') ? 'en' : 'ko';
    }

    function formatDate(raw) {
        if (!raw) return '';
        try {
            return new Date(raw).toLocaleDateString(getCurrentLocale() === 'en' ? 'en-US' : 'ko-KR');
        } catch(e) { return raw; }
    }

    function showLoading() {
        hide(SEL.treeContainer, SEL.empty, SEL.error);
        show(SEL.loading);
    }

    function renderEmpty() {
        hide(SEL.treeContainer, SEL.loading, SEL.error);
        show(SEL.empty);
    }

    function renderError() {
        hide(SEL.treeContainer, SEL.loading, SEL.empty);
        show(SEL.error);
    }

    function transformToRenderFormat(treeId, memories) {
        // Convert flat memory list to branch/moment structure for Canvas v4 renderer
        // Group memories by parentId or create a flat single-branch structure
        var moments = memories.map(function(m, i) {
            return {
                id: m.id,
                title: m.title || m.emotionMemo || '',
                tag: (m.emotionTags && m.emotionTags[0]) || '',
                caption: m.emotionMemo || m.title || '',
                color: 'from-rose-100 via-rose-50 to-white',
                emoji: '✦',
                t: (i + 0.5) / Math.max(memories.length, 1)
            };
        });

        return {
            tree: {
                id: treeId,
                title: memories[0] && memories[0].treeTitle || t('viewer.treeTitle', '러브트리', 'LoveTree'),
                memoryCount: memories.length,
                creator: '@lovetree_viewer',
                meta: memories.length + '개의 순간 · 꾸민 트리'
            },
            branch: {
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
                rootSeed: {
                    id: 'root-' + (memories[0] && memories[0].id || treeId),
                    branchId: 'main',
                    title: memories[0] && memories[0].title || t('viewer.rootMoment', '시작된 순간', 'Starting moment'),
                    tag: t('viewer.start', '시작', 'Start'),
                    caption: memories[0] && memories[0].emotionMemo || '',
                    color: 'from-rose-200 via-rose-100 to-amber-50',
                    emoji: '✦'
                },
                moments: moments
            }
        };
    }

    async function loadPublicData(treeId) {
        var getMemories = window.apiClient &&
            (window.apiClient.communityApi && window.apiClient.communityApi.getCachedCommunityMemories ||
             window.apiClient.getCachedCommunityMemories);

        if (typeof getMemories !== 'function') {
            throw new Error('Community API not available');
        }

        var memories = await getMemories({ treeId: treeId, limit: 100 });
        return Array.isArray(memories) ? memories.filter(function(m) { return m && m.visibility === 'public'; }) : [];
    }

    async function initViewer() {
        var params = new URLSearchParams(window.location.search);
        var treeId = params.get('treeId');
        if (!treeId) {
            renderEmpty();
            return;
        }

        currentTreeId = treeId;
        showLoading();

        try {
            var memories = await loadPublicData(treeId);
            if (!memories || memories.length === 0) {
                renderEmpty();
                return;
            }

            var renderData = transformToRenderFormat(treeId, memories);

            // Set up the viewer state using the #953 renderer modules
            var RenderTree = window.LoveBudVisitorViewerRenderTree;
            var Panels = window.LoveBudVisitorViewerPanels;

            if (!RenderTree || !Panels) {
                // Fallback: show simple tree list if Canvas modules not loaded
                renderSimpleTree(renderData);
                return;
            }

            // Build the Canvas v4 tree shell
            show(SEL.treeContainer);
            hide(SEL.loading, SEL.empty, SEL.error);

            var container = qs('#viewerTreeContainer');
            if (!container) return;

            // Set tree identity
            var titleEl = qs(SEL.treeTitle);
            var metaEl = qs(SEL.treeMeta);
            if (titleEl) titleEl.textContent = renderData.tree.title;
            if (metaEl) metaEl.textContent = renderData.tree.meta;

            // Inject Canvas v4 structure
            container.innerHTML =
                '<div class="vv-viewer-layout">' +
                '  <div class="vv-tree-container"></div>' +
                '  <div class="vv-panel-host"></div>' +
                '</div>';

            // Set up the global data object the #953 modules expect
            window.__viewerTreeData = {
                palette: window.LoveBudVisitorViewerData && window.LoveBudVisitorViewerData.palette || {
                    rose: { stroke:'#e99aac', soft:'#fff1f3', text:'#be123c', dim:'rgba(251,113,133,.16)' }
                },
                branches: [renderData.branch],
                rootSeed: renderData.branch.rootSeed,
                curvePoint: function(branch, t) {
                    var x0=50, y0=branch.startY;
                    var x1=branch.curveA, y1=branch.startY-8;
                    var x2=branch.curveB, y2=branch.endY+8;
                    var x3=branch.endX, y3=branch.endY;
                    var mt=1-t;
                    return {
                        x: mt*mt*mt*x0 + 3*mt*mt*t*x1 + 3*mt*t*t*x2 + t*t*t*x3,
                        y: mt*mt*mt*y0 + 3*mt*mt*t*y1 + 3*mt*t*t*y2 + t*t*t*y3
                    };
                }
            };

            var state = {
                selectedBranchId: null,
                selectedMomentId: null,
                activePanel: 'empty',
                likedTree: false
            };

            function getAllMoments() {
                var results = [];
                var rs = renderData.branch.rootSeed;
                results.push({ id: rs.id, branchId: 'main', title: rs.title, tag: rs.tag, caption: rs.caption, color: rs.color, emoji: rs.emoji });
                renderData.branch.moments.forEach(function(m) {
                    results.push({ id: m.id, branchId: 'main', title: m.title, tag: m.tag, caption: m.caption, color: m.color, emoji: m.emoji });
                });
                return results;
            }

            var allMoments = getAllMoments();

            function refresh() {
                var branch = renderData.branch;
                var moment = allMoments.find(function(m) { return m.id === state.selectedMomentId; });
                state.selectedBranch = branch;
                state.selectedMoment = moment;
                state.panelBranch = branch;

                var treeBox = container.querySelector('.vv-tree-container');
                if (treeBox && RenderTree) {
                    // Patch data temporarily for renderer
                    var origData = window.LoveBudVisitorViewerData;
                    window.LoveBudVisitorViewerData = window.__viewerTreeData;
                    RenderTree.renderTree(treeBox, state, handler);
                    window.LoveBudVisitorViewerData = origData;
                }

                var panelHost = container.querySelector('.vv-panel-host');
                if (panelHost && Panels) {
                    var origData2 = window.LoveBudVisitorViewerData;
                    window.LoveBudVisitorViewerData = window.__viewerTreeData;
                    panelHost.innerHTML = Panels.renderPanel(state, handler);
                    window.LoveBudVisitorViewerData = origData2;
                }
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
                openPanel: function(panel) {
                    state.activePanel = panel;
                    refresh();
                },
                closePanel: function() {
                    if (state.selectedMomentId) { state.activePanel = 'moment'; }
                    else if (state.selectedBranchId) { state.activePanel = 'branch'; }
                    else { state.activePanel = 'empty'; }
                    refresh();
                },
                toggleLike: function() {
                    state.likedTree = !state.likedTree;
                }
            };

            container.addEventListener('click', function(e) {
                var branchBtn = e.target.closest('[data-branch-id]');
                if (branchBtn) { handler.onSelectBranch(branchBtn.dataset.branchId); return; }
                var momentBtn = e.target.closest('[data-moment-id]');
                if (momentBtn) { handler.onSelectMoment(momentBtn.dataset.momentId, momentBtn.dataset.branchId); return; }
                var action = e.target.closest('[data-action]');
                if (!action) return;
                var a = action.dataset.action;
                if (a === 'close-moment') handler.closeMoment();
                else if (a === 'close-panel') handler.closePanel();
                else if (a === 'toggle-like') handler.toggleLike();
                else if (a === 'open-tree-comments') handler.openPanel('tree-comments');
                else if (a === 'open-share') handler.openPanel('share');
            });

            state.selectedBranchId = 'main';
            state.activePanel = 'empty';
            refresh();

        } catch (error) {
            console.error('[tree-viewer] load failed:', error);
            renderError();
        }
    }

    function renderSimpleTree(renderData) {
        show(SEL.treeContainer);
        hide(SEL.loading, SEL.empty, SEL.error);
        var titleEl = qs(SEL.treeTitle);
        var metaEl = qs(SEL.treeMeta);
        if (titleEl) titleEl.textContent = renderData.tree.title;
        if (metaEl) metaEl.textContent = renderData.tree.meta;
        var container = qs('#viewerTreeContainer');
        if (!container) return;
        container.innerHTML = '';
        var list = document.createElement('div');
        list.className = 'viewer-nodes-list';
        renderData.branch.moments.forEach(function(m) {
            var node = document.createElement('div');
            node.className = 'viewer-node';
            node.innerHTML = '<span class="viewer-node-title">' + escapeHtml(m.title) + '</span>' +
                (m.tag ? '<span class="viewer-node-tag">' + escapeHtml(m.tag) + '</span>' : '');
            list.appendChild(node);
        });
        container.appendChild(list);
    }

    function setupRetry() {
        var btn = document.getElementById('viewerRetryBtn');
        if (btn) {
            btn.addEventListener('click', function() {
                if (currentTreeId) initViewer();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setupRetry(); initViewer(); });
    } else {
        setupRetry();
        initViewer();
    }
})();