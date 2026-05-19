(function() {
    'use strict';

    var MARKER = 'LoveBudViewerStateLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    /**
     * Create initial viewer state object.
     *
     * @returns {Object} state
     *   - selectedBranchId: default 'main'
     *   - selectedMomentId: null
     *   - activePanel: 'empty'
     *   - likedTree: false
     *   - layoutMode: 'organic'
     */
    function createInitialState() {
        return {
            selectedBranchId: 'main',
            selectedMomentId: null,
            activePanel: 'empty',
            likedTree: false,
            layoutMode: 'organic'
        };
    }

    /**
     * Flatten all moments from all branches.
     *
     * @param {Object} viewerData - Viewer data object with branches array
     * @returns {Array} Flattened moment objects with:
     *   id, branchId, title, tag, caption, emoji, channelId, channelName, channelUrl
     */
    function getAllMoments(viewerData) {
        if (!viewerData || !Array.isArray(viewerData.branches)) return [];
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

    /**
     * Resolve the selected branch, moment, and panel branch from current state.
     *
     * @param {Object} viewerData - Viewer data with branches
     * @param {Array} allMoments - Flattened moments array
     * @param {Object} state - Current state with selectedBranchId and selectedMomentId
     * @returns {Object} selection with selectedBranch, selectedMoment, panelBranch
     */
    function resolveSelection(viewerData, allMoments, state) {
        var branch = viewerData.branches.find(function(b) { return b.id === state.selectedBranchId; }) || viewerData.branches[0];
        var moment = allMoments.find(function(m) { return m.id === state.selectedMomentId; });
        var panelBranch = moment ? (viewerData.branches.find(function(b) { return b.id === moment.branchId; }) || branch) : branch;
        return {
            selectedBranch: branch,
            selectedMoment: moment,
            panelBranch: panelBranch
        };
    }

    /**
     * Apply resolved selection to the state object.
     * Preserves state object identity — mutates the passed object.
     *
     * @param {Object} state - The mutable state object
     * @param {Object} selection - Result from resolveSelection()
     */
    function applySelection(state, selection) {
        state.selectedBranch = selection.selectedBranch;
        state.selectedMoment = selection.selectedMoment;
        state.panelBranch = selection.panelBranch;
    }

    window.LoveBudViewerState = {
        createInitialState: createInitialState,
        getAllMoments: getAllMoments,
        resolveSelection: resolveSelection,
        applySelection: applySelection
    };
})();
