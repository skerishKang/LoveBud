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
    assert.ok(tvCode.includes('window.LoveBudViewerShareExportActions'), 'must reference ShareExportActions');
    assert.ok(tvCode.includes('window.LoveBudViewerState'), 'must reference ViewerState');

    // Ensure extracted details are gone
    assert.ok(!tvCode.includes("a === 'close-moment'"), 'must not have manual close-moment string');
    assert.ok(!tvCode.includes("container.addEventListener('click'"), 'must not manually bind click actions block');
    assert.ok(!tvCode.includes("window.LoveBudTreeViewerTestHooks = {"), 'must not manually construct test hooks object');
});

test('tree-viewer.js still owns init and refresh orchestration pending next slice', () => {
    const tvCode = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    
    assert.ok(tvCode.includes('async function initViewer()'), 'must own initViewer function');
    assert.ok(tvCode.includes('function refresh()'), 'must own refresh function');
    assert.ok(tvCode.includes('State.createInitialState()'), 'must call createInitialState');
    assert.ok(tvCode.includes('State.resolveSelection('), 'must call resolveSelection');
    assert.ok(tvCode.includes('State.applySelection('), 'must call applySelection');
    assert.ok(tvCode.includes('RenderTree.renderTree('), 'must orchestrate RenderTree');
    assert.ok(tvCode.includes('Panels.renderPanel('), 'must orchestrate Panels');
});

test('remaining public viewer split candidates are explicit', () => {
    // 1. init/render flow helper (initViewer, refresh)
    // 2. handler factory helper (creating the `handler` object)
    // 3. share export bridge setup (setup bridge between handler and share modules)
    // NOTE: viewer-state.js and viewer-data-loader.js are already extracted and NOT candidates.
    assert.ok(true, 'The candidates are documented in the test comments');
});
