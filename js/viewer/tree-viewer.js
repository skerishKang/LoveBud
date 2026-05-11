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
            if (el) { el.style.display = ''; el.removeAttribute('hidden'); }
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
            title: t('viewer.rootOverviewAnchor', '러브트리의 시작점', 'LoveTree starting point'),
            tag: t('viewer.fullFlowAnchor', '전체 흐름', 'Full flow'),
            caption: t('viewer.rootOverviewCaption', '전체 흐름의 기준점', 'The anchor for the full tree overview'),
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

            function getAllMoments() {
                var results = [];
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
                copyLink: function() {
                    var Share = window.LoveBudShareActions;
                    if (!Share) return;
                    var result = Share.copyLink(handler);
                    showShareStatus(result);
                },
                nativeShare: function() {
                    var Share = window.LoveBudShareActions;
                    if (!Share) return;
                    Share.nativeShare(handler).then(function(result) {
                        showShareStatus(result);
                    });
                },
                platformShare: function(platform) {
                    var Share = window.LoveBudShareActions;
                    if (!Share || typeof Share.shareToPlatform !== 'function') return;
                    Promise.resolve(Share.shareToPlatform(handler, platform)).then(function(result) {
                        showShareStatus(result);
                    });
                },
                exportTreeImageCard: function() {
                    var Share = window.LoveBudShareActions;
                    if (!Share || typeof Share.exportTreeImageCard !== 'function') return;
                    Promise.resolve(Share.exportTreeImageCard(handler)).then(function(result) {
                        showShareStatus(result);
                    });
                }
            };

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
                    else if (a === 'copy-link') handler.copyLink();
                    else if (a === 'native-share') handler.nativeShare();
                    else if (a === 'platform-share') handler.platformShare(action.dataset.platform);
                    else if (a === 'export-tree-card') handler.exportTreeImageCard();
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
