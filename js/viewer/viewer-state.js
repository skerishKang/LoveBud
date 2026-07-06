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
     *   - layoutMode: 'hierarchy'
     */
    function createInitialState() {
        return {
            selectedBranchId: 'main',
            selectedMomentId: null,
            activePanel: 'empty',
            likedTree: false,
            layoutMode: 'hierarchy'
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

    /**
     * Create a deterministic fallback viewerData object when a confirmed
     * Neon hub snapshot is missing or corrupted.
     *
     * Returns a minimal but structurally valid object so ShellRender can
     * produce a meaningful shell (header, meta, empty tree area) instead of
     * a generic empty/error state.  All values are hardcoded defaults —
     * deterministic, no network, no external data.
     *
     * @param {string} [treeId] - Optional tree identifier (used for context)
     * @returns {Object} Minimal viewerData with deterministic defaults
     */
    function createDeterministicFallbackData(treeId) {
        return {
            branches: [],
            rootSeed: null,
            palette: {
                rose: { stroke:'#e99aac', soft:'#fff1f3', text:'#be123c', dim:'rgba(251,113,133,.16)' }
            },
            tree: {
                title: '\uB7EC\uBE0C\uD2B8\uB9AC',         /* 러브트리 */
                creator: '@lovetree_viewer',
                meta: '0\uAC1C\uC758 \uC21C\uAC04 \u00B7 \uACF5\uAC1C \uB7EC\uBE0C\uD2B8\uB9AC'
                /* 0개의 순간 · 공개 러브트리 */
            },
            treeComments: [],
            momentComments: {}
        };
    }

    window.LoveBudViewerState = {
        createInitialState: createInitialState,
        getAllMoments: getAllMoments,
        resolveSelection: resolveSelection,
        applySelection: applySelection,
        createDeterministicFallbackData: createDeterministicFallbackData
    };
})();
