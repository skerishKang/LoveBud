(function() {
    'use strict';

    var data = window.LoveBudVisitorViewerData;
    if (!data) return;
    var renderTree = window.LoveBudVisitorViewerRenderTree;
    var panels = window.LoveBudVisitorViewerPanels;
    if (!renderTree || !panels) return;

    function escapeHtml(value) {
        var sec = window.LoveBudSecurity;
        if (sec) return sec.escapeHtml(value);
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getAllMoments() {
        var results = [];
        var s = data.rootSeed;
        results.push({ id: s.id, branchId: s.branchId, title: s.title, tag: s.tag, caption: s.caption, color: s.color, emoji: s.emoji });
        data.branches.forEach(function(b) {
            b.moments.forEach(function(m) { results.push({ id: m.id, branchId: b.id, title: m.title, tag: m.tag, caption: m.caption, color: m.color, emoji: m.emoji, cluster: m.cluster }); });
        });
        return results;
    }

    function init(containerId) {
        var container = document.getElementById(containerId || 'visitorViewerContainer');
        if (!container) return;

        var state = {
            selectedBranchId: null,
            selectedMomentId: null,
            activePanel: 'empty',
            likedTree: false
        };

        var allMoments = getAllMoments();

        function refresh() {
            var branch = data.branches.find(function(b) { return b.id === state.selectedBranchId; });
            var moment = allMoments.find(function(m) { return m.id === state.selectedMomentId; });
            var panelBranch = moment ? data.branches.find(function(b) { return b.id === moment.branchId; }) : branch;
            state.selectedBranch = branch;
            state.selectedMoment = moment;
            state.panelBranch = panelBranch;

            var treeBox = container.querySelector('.vv-tree-container');
            if (treeBox) renderTree.renderTree(treeBox, state, handler);
            var panelHtml = panels.renderPanel(state, handler);
            var panelHost = container.querySelector('.vv-panel-host');
            if (!panelHost) {
                var layout = container.querySelector('.vv-viewer-layout');
                if (layout) {
                    var host = document.createElement('aside');
                    host.className = 'vv-panel-host';
                    host.innerHTML = panelHtml;
                    layout.appendChild(host);
                }
            } else {
                panelHost.innerHTML = panelHtml;
            }
            updateMeta();
            updateActionDock();
        }

        function updateMeta() {
            var meta = container.querySelector('.vv-tree-meta');
            if (!meta) return;
            meta.querySelector('.vv-meta-likes').textContent = state.likedTree ? '2.9k' : data.tree.metrics.likes;
        }

        function updateActionDock() {
            var dock = container.querySelector('.vv-action-dock');
            if (!dock) return;
            dock.querySelectorAll('[data-action]').forEach(function(btn) {
                btn.classList.toggle('is-active', state.activePanel === btn.dataset.action);
            });
            var likeBtn = dock.querySelector('[data-action="toggle-like"]');
            if (likeBtn) {
                likeBtn.classList.toggle('is-liked', state.likedTree);
                likeBtn.querySelector('.vv-action-label').textContent = state.likedTree ? '좋아요 완료' : '좋아요';
                likeBtn.querySelector('.vv-action-count').textContent = state.likedTree ? '2.9k' : data.tree.metrics.likes;
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
                var m = allMoments.find(function(mm) { return mm.id === state.selectedMomentId; });
                if (m && m.branchId) state.selectedBranchId = m.branchId;
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
                updateMeta();
                updateActionDock();
            }
        };

        container.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-branch-id]');
            if (btn && !btn.closest('.vv-panel')) { handler.onSelectBranch(btn.dataset.branchId); return; }
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

        buildShell(container);
        state.selectedBranchId = data.branches[0].id;
        state.activePanel = 'empty'; // initial: whole tree view
        refresh();
    }

    function buildShell(container) {
        container.innerHTML =
            '<header class="vv-header">' +
            '  <div><p class="vv-eyebrow">Public LoveTree Viewer IA v4</p>' +
            '  <h1 class="vv-title">' + escapeHtml(data.tree.title) + '</h1>' +
            '  <div class="vv-meta-row"><span>' + escapeHtml(data.tree.creator) + '</span><span class="vv-dot">·</span><span>' + escapeHtml(data.tree.meta) + '</span></div></div>' +
            '</header>' +
            '<div class="vv-action-dock" data-action-dock>' +
            '  <div class="vv-action-group">' +
            '    <button type="button" class="vv-action-btn" data-action="toggle-like"><span class="vv-action-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" class="vv-icon"><path d="M12 20.2s-7.2-4.42-9.4-9.08C.92 7.58 2.68 4.3 6.15 4.3c2.02 0 3.38 1.12 3.98 2.02.58-.9 1.96-2.02 3.98-2.02 3.46 0 5.22 3.28 3.55 6.82C15.45 15.78 12 20.2 12 20.2Z" fill="currentColor"/></svg></span>' +
            '    <span class="vv-action-label">좋아요</span> <span class="vv-action-count" data-likes>' + data.tree.metrics.likes + '</span></button>' +
            '    <button type="button" class="vv-action-btn" data-action="open-tree-comments"><span class="vv-action-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" class="vv-icon"><path d="M5.3 17.6c-1.16-1.14-1.8-2.62-1.8-4.2 0-3.62 3.58-6.55 8-6.55s8 2.93 8 6.55-3.58 6.55-8 6.55c-.9 0-1.76-.12-2.56-.36L5.2 21.2l.1-3.6Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></span>' +
            '    <span class="vv-action-label">트리 댓글</span> <span class="vv-action-count">' + data.tree.metrics.comments + '</span></button>' +
            '    <button type="button" class="vv-action-btn" data-action="open-share"><span class="vv-action-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" class="vv-icon"><path d="M8.1 12.7 15.9 17M15.9 7 8.1 11.3M6.4 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Zm10.9-5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Zm0 10a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>' +
            '    <span class="vv-action-label">공유</span></button>' +
            '  </div>' +
            '</div>' +
            '<div class="vv-viewer-layout"><div class="vv-tree-container"></div></div>' +
            '<div class="vv-mobile-note">모바일에서는 패널이 화면 아래로 쌓이는 구조입니다.</div>';
    }

    document.addEventListener('DOMContentLoaded', function() { init('visitorViewerContainer'); });
})();