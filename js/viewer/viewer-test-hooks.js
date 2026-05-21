(function() {
    'use strict';

    var MARKER = 'LoveBudViewerTestHooksLoaded';
    if (window[MARKER]) return;
    window[MARKER] = true;

    function exportTestHooks(context) {
        if (window.__LOVE_BUD_TREE_VIEWER_TEST_HOOKS__ && context && context.DT) {
            window.LoveBudTreeViewerTestHooks = {
                buildBranches: context.DT.buildBranches,
                getTreeId: context.Route && context.Route.getTreeId,
                renderShell: context.ShellRender && context.ShellRender.renderShell
            };
        }
    }

    window.LoveBudViewerTestHooks = {
        exportTestHooks: exportTestHooks
    };
})();
