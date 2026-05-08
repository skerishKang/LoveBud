(function() {
    'use strict';

    const data = window.LoveBudVisitorViewerData;
    const treeRenderer = window.LoveBudVisitorViewerRenderTree;
    const panels = window.LoveBudVisitorViewerPanels;
    if (!data || !treeRenderer || !panels) return;

    const state = {
        panel: 'hint',
        selectedBranchId: null,
        selectedMomentId: null,
        treeLiked: false,
        treeLikeCount: data.tree.likes
    };

    function init() {
        document.getElementById('visitorTreeTitle').textContent = data.tree.title;
        document.getElementById('visitorTreeMeta').textContent = `${data.tree.creator} · ${data.tree.meta}`;
        bindTreeActions();
        render();
    }

    function render() {
        treeRenderer.renderTree(document, data, state, {
            onBranch: selectBranch,
            onMoment: selectMoment
        });
        panels.renderPanel(document.getElementById('visitorPanelContent'), data, state, {
            onStepMoment: stepMoment
        });
        bindPanelClose();
        updateLikeButton();
    }

    function bindTreeActions() {
        document.querySelector('[data-tree-action="like"]')?.addEventListener('click', () => {
            state.treeLiked = !state.treeLiked;
            state.treeLikeCount += state.treeLiked ? 1 : -1;
            updateLikeButton();
        });
        document.querySelector('[data-tree-action="comments"]')?.addEventListener('click', () => {
            state.panel = 'comments';
            render();
        });
        document.querySelector('[data-tree-action="share"]')?.addEventListener('click', () => {
            state.panel = 'share';
            render();
        });
    }

    function bindPanelClose() {
        document.querySelector('[data-panel-close]')?.addEventListener('click', () => {
            if (state.panel === 'comments' || state.panel === 'share') {
                state.panel = getSelectionPanel();
            } else {
                state.panel = 'hint';
                state.selectedBranchId = null;
                state.selectedMomentId = null;
            }
            render();
        });
    }

    function updateLikeButton() {
        const button = document.querySelector('[data-tree-action="like"]');
        const count = document.querySelector('[data-tree-like-count]');
        if (!button || !count) return;
        button.setAttribute('aria-pressed', String(state.treeLiked));
        count.textContent = formatCount(state.treeLikeCount);
    }

    function selectBranch(branchId) {
        state.panel = 'branch';
        state.selectedBranchId = branchId;
        state.selectedMomentId = null;
        render();
    }

    function selectMoment(momentId) {
        const moment = data.moments.find((item) => item.id === momentId);
        state.panel = 'moment';
        state.selectedMomentId = momentId;
        state.selectedBranchId = moment?.branchId || null;
        render();
    }

    function getSelectionPanel() {
        if (state.selectedMomentId) return 'moment';
        if (state.selectedBranchId) return 'branch';
        return 'hint';
    }

    function stepMoment(direction) {
        const index = data.moments.findIndex((moment) => moment.id === state.selectedMomentId);
        const next = data.moments[(index + direction + data.moments.length) % data.moments.length];
        selectMoment(next.id);
    }

    function formatCount(value) {
        if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
        return String(value);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
