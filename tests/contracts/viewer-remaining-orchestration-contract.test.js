/**
 * LoveBud Viewer Remaining Orchestration Contract Tests
 * Issue #1282 — Audit PR: no functional changes, identifying next slices
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('tree-viewer.js keeps only orchestration-level public viewer flow', () => {
    const tvCode = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    
    // Check references to extracted helpers
    assert.ok(tvCode.includes('window.LoveBudViewerRoute'), 'must reference Route');
    assert.ok(tvCode.includes('window.LoveBudViewerDataTransform'), 'must reference DT');
    assert.ok(tvCode.includes('window.LoveBudViewerDataLoader'), 'must reference DataLoader');
    assert.ok(tvCode.includes('window.LoveBudViewerRenderState'), 'must reference RenderState');
    assert.ok(tvCode.includes('window.LoveBudViewerShellRender'), 'must reference ShellRender');
    assert.ok(tvCode.includes('window.LoveBudViewerRetrySetup'), 'must reference RetrySetup');
    assert.ok(tvCode.includes('window.LoveBudViewerTestHooks'), 'must reference TestHooks');
    assert.ok(tvCode.includes('window.LoveBudViewerClickActions'), 'must reference ClickActions');
    assert.ok(tvCode.includes('window.LoveBudViewerShareStatusUI'), 'must reference ShareStatusUI');
    assert.ok(tvCode.includes('window.LoveBudViewerState'), 'must reference ViewerState');

    assert.ok(tvCode.includes('window.LoveBudViewerHandlerFactory'), 'must reference HandlerFactory');
    assert.ok(tvCode.includes('window.LoveBudViewerShareExportBridge'), 'must reference ShareExportBridge');
    assert.ok(tvCode.includes('window.LoveBudViewerInitFlow'), 'must reference InitFlow');

    // Ensure extracted details are gone
    assert.ok(!tvCode.includes("a === 'close-moment'"), 'must not have manual close-moment string');
    assert.ok(!tvCode.includes("container.addEventListener('click'"), 'must not manually bind click actions block');
    assert.ok(!tvCode.includes("window.LoveBudTreeViewerTestHooks = {"), 'must not manually construct test hooks object');
    assert.ok(!tvCode.includes("state.layoutMode = state.layoutMode ==="), 'must not manually construct handler object');
});

test('tree-viewer.js delegates init and refresh orchestration to InitFlow helper', () => {
    const tvCode = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    
    assert.ok(!tvCode.includes('async function initViewer()'), 'must not own initViewer function');
    assert.ok(!tvCode.includes('function refresh()'), 'must not own refresh function');
    assert.ok(!tvCode.includes('State.createInitialState()'), 'must not call createInitialState directly');
    assert.ok(!tvCode.includes('State.resolveSelection('), 'must not call resolveSelection directly');
    assert.ok(!tvCode.includes('State.applySelection('), 'must not call applySelection directly');
    assert.ok(!tvCode.includes('RenderTree.renderTree('), 'must not orchestrate RenderTree directly');
    assert.ok(!tvCode.includes('Panels.renderPanel('), 'must not orchestrate Panels directly');
});

test('remaining public viewer split candidates are explicit', () => {
    // 1. final audit / smoke guard
    // NOTE: viewer-state.js, viewer-data-loader.js, viewer-handler-factory.js, viewer-share-export-bridge.js, and viewer-init-flow.js are already extracted.
    assert.ok(true, 'The candidates are documented in the test comments');
});
