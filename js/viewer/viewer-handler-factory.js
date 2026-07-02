(function() {
    'use strict';

    var MARKER = 'LoveBudViewerHandlerFactoryLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    function createHandler(context) {
        var state = context.state;
        var viewerData = context.viewerData;
        var refresh = context.refresh;
        var getShareUrl = context.getShareUrl || function() { return window.location.href; };
        var doc = context.documentRef || document;

        var handler = {
            getShareUrl: getShareUrl,
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
                
                // Check if there's an appreciation order and highlight next if available
                var appreciationOrder = window.currentTreeData && window.currentTreeData.appreciationOrder;
                if (appreciationOrder && Array.isArray(appreciationOrder) && appreciationOrder.length > 0) {
                    var currentIndex = appreciationOrder.indexOf(momentId);
                    if (currentIndex > -1 && currentIndex < appreciationOrder.length - 1) {
                        var nextId = appreciationOrder[currentIndex + 1];
                        var nextNode = document.querySelector('[data-memory-id="' + nextId + '"]');
                        if (nextNode) {
                            nextNode.classList.add('next-in-order');
                            nextNode.setAttribute('aria-label', '다음 순서');
                        }
                    }
                }
                
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
                var toggleLabel = doc.getElementById('vvLayoutToggleLabel');
                if (toggleLabel) {
                    toggleLabel.textContent = state.layoutMode === 'hierarchy' ? '유기적 보기' : '구조 보기';
                }
                refresh();
            }
        };

        return handler;
    }

    window.LoveBudViewerHandlerFactory = {
        createHandler: createHandler
    };
})();
