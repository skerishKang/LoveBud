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
        var sec = window.LoveBudSecurity;
        if (sec) return sec.escapeHtml(v);
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

    function getMemoryKey(memory) {
        return memory && memory.id ? String(memory.id) : '';
    }

    function getParentKey(memory) {
        return memory && (memory.parentId || memory.parent_id) ? String(memory.parentId || memory.parent_id) : '';
    }

    function mapBranchMoment(memory, index, tValue) {
        return {
            id: 'moment-' + index,
            title: memory.title || memory.emotionMemo || '',
            tag: (memory.emotionTags && memory.emotionTags[0]) || '',
            caption: memory.emotionMemo || memory.title || '',
            emoji: '??',
            t: tValue,
            channelId: memory.channelId || memory.channel_id || '',
            channelName: memory.channelName || memory.channel_name || '',
            channelUrl: memory.channelUrl || memory.channel_url || ''
        };
    }

    function collectBranchPath(startKey, childrenByParent, memoryByKey, indexByKey) {
        var path = [];
        var queue = [startKey];
        var seen = {};

        while (queue.length) {
            var key = queue.shift();
            if (!key || seen[key]) return null;
            var memory = memoryByKey[key];
            if (!memory) continue;

            seen[key] = true;
            path.push(memory);

            var children = (childrenByParent[key] || []).slice().sort(function(a, b) {
                return (indexByKey[a] || 0) - (indexByKey[b] || 0);
            });
            for (var i = 0; i < children.length; i++) queue.push(children[i]);
        }

        return path;
    }

    function buildForkBranches(memories) {
        var memoryByKey = {};
        var indexByKey = {};
        var childrenByParent = {};

        memories.forEach(function(memory, index) {
            var key = getMemoryKey(memory);
            if (!key) return;
            memoryByKey[key] = memory;
            indexByKey[key] = index;
        });

        memories.forEach(function(memory) {
            var key = getMemoryKey(memory);
            var parentKey = getParentKey(memory);
            if (!key || !parentKey || !memoryByKey[parentKey]) return;
            if (!childrenByParent[parentKey]) childrenByParent[parentKey] = [];
            childrenByParent[parentKey].push(key);
        });

        var forkParentKey = '';
        Object.keys(childrenByParent).some(function(parentKey) {
            if (childrenByParent[parentKey].length < 2) return false;
            forkParentKey = parentKey;
            return true;
        });
        if (!forkParentKey) return null;

        var colors = ['rose', 'amber', 'emerald', 'violet'];
        var children = childrenByParent[forkParentKey].slice().sort(function(a, b) {
            return (indexByKey[a] || 0) - (indexByKey[b] || 0);
        });
        var branches = [];

        for (var branchIndex = 0; branchIndex < children.length; branchIndex++) {
            var branchPath = collectBranchPath(children[branchIndex], childrenByParent, memoryByKey, indexByKey);
            if (!branchPath || !branchPath.length) return null;

            var moments = branchPath.map(function(memory, momentIndex) {
                return mapBranchMoment(memory, indexByKey[getMemoryKey(memory)], (momentIndex + 0.5) / Math.max(branchPath.length, 1));
            });
            var sideLeft = branchIndex % 2 === 0;
            var startY = 77 - (branchIndex * 9);
            var endY = Math.max(14, 48 - (branchIndex * 9));
            var endX = sideLeft ? 18 + Math.min(branchIndex, 2) * 4 : 82 - Math.min(branchIndex, 2) * 4;

            branches.push({
                id: 'branch-' + (branchIndex + 1),
                name: 'Branch ' + (branchIndex + 1),
                side: sideLeft ? 'left' : 'right',
                color: colors[branchIndex % colors.length],
                startY: startY,
                endY: endY,
                endX: endX,
                curveA: sideLeft ? 36 : 64,
                curveB: sideLeft ? 28 : 72,
                caption: moments.length + t('viewer.momentsConnected', 'connected moments', ' connected moments'),
                count: moments.length,
                moments: moments
            });
        }

        return branches.length >= 2 ? branches : null;
    }

    function buildBranches(memories) {
        // Group moments into a single main branch with computed positions
        var moments = memories.map(function(m, i) {
            var moment = mapBranchMoment(m, i, (i + 0.5) / Math.max(memories.length, 1));
            moment.emoji = '✦';
            return moment;
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

        var forkBranches = buildForkBranches(memories);
        var branches = forkBranches || [branch];
        var rootBranch = branches[0] || branch;

        var rootSeed = {
            id: 'moment-root',
            branchId: rootBranch.id,
            title: t('viewer.rootOverviewAnchor', '러브트리의 시작점', 'LoveTree starting point'),
            tag: t('viewer.fullFlowAnchor', '전체 흐름', 'Full flow'),
            caption: t('viewer.rootOverviewCaption', '전체 흐름의 기준점', 'The anchor for the full tree overview'),
            color: 'from-rose-200 via-rose-100 to-amber-50',
            emoji: '✦'
        };

        return {
            branches: branches,
            rootSeed: rootSeed,
            palette: {
                rose: { stroke:'#e99aac', soft:'#fff1f3', text:'#be123c', dim:'rgba(251,113,133,.16)' },
                amber: { stroke:'#eac86f', soft:'#fff7df', text:'#a16207', dim:'rgba(251,191,36,.15)' },
                emerald: { stroke:'#8fd8bc', soft:'#ecfdf5', text:'#047857', dim:'rgba(110,231,183,.16)' },
                violet: { stroke:'#c8b8f8', soft:'#f5f3ff', text:'#7c3aed', dim:'rgba(167,139,250,.16)' }
            },
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
            var state = { selectedBranchId: 'main', selectedMomentId: null, activePanel: 'empty', likedTree: false, layoutMode: 'organic' };

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

            function getAllMoments() {
                var results = [];
                viewerData.branches.forEach(function(branch) {
                    (branch.moments || []).forEach(function(m) {
                        results.push({
                            id: m.id,
                            branchId: branch.id,
                            title: m.title,
                            tag: m.tag,
                            caption: m.caption,
                            emoji: m.emoji,
                            channelId: m.channelId || '',
                            channelName: m.channelName || '',
                            channelUrl: m.channelUrl || ''
                        });
                    });
                });
                return results;
            }

            var allMoments = getAllMoments();

            function refresh() {
                var branch = viewerData.branches.find(function(b) { return b.id === state.selectedBranchId; }) || viewerData.branches[0];
                var moment = allMoments.find(function(m) { return m.id === state.selectedMomentId; });
                state.selectedBranch = branch;
                state.selectedMoment = moment;
                state.panelBranch = moment ? (viewerData.branches.find(function(b) { return b.id === moment.branchId; }) || branch) : branch;

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
            renderError();
        }
    }

    function setupRetry() {
        var btn = document.getElementById('viewerRetryBtn');
        if (btn) btn.addEventListener('click', function() { if (currentTreeId) initViewer(); });
    }

    if (window.__LOVE_BUD_TREE_VIEWER_TEST_HOOKS__) {
        window.LoveBudTreeViewerTestHooks = {
            buildBranches: buildBranches
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
