const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('tree-viewer remains thin active entry after public viewer split', () => {
    const code = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');

    // IIFE remains
    assert.ok(code.includes('(function() {'), 'tree-viewer must be an IIFE');
    
    // Reads InitFlow
    assert.ok(code.includes('var InitFlow = window.LoveBudViewerInitFlow;'), 'must read LoveBudViewerInitFlow');
    
    // Calls startViewer
    assert.ok(code.includes('InitFlow.startViewer('), 'must call startViewer');

    // Dependencies are passed
    assert.ok(code.includes('DT:'), 'must pass DT');
    assert.ok(code.includes('Route:'), 'must pass Route');
    assert.ok(code.includes('DataLoader:'), 'must pass DataLoader');

    // Should NOT have old implementation details directly
    const forbidden = [
        'async function initViewer()',
        'function refresh()',
        'DataLoader.loadPublicData(',
        'State.createInitialState()',
        'State.resolveSelection(',
        'State.applySelection(',
        'RenderTree.renderTree(',
        'Panels.renderPanel(',
        'HandlerFactory.createHandler(',
        'ShareExportBridge.setupShareExportBridge(',
        'ClickActions.attachClickActions(',
        'RetrySetup.setupRetry(',
        'TestHooks.exportTestHooks('
    ];

    forbidden.forEach(str => {
        assert.ok(!code.includes(str), `tree-viewer must not contain ${str}`);
    });
});

test('viewer-init-flow owns public viewer init render orchestration', () => {
    const code = fs.readFileSync('js/viewer/viewer-init-flow.js', 'utf8');

    // Owns functions and calls
    const required = [
        'async function initViewer(',
        'function refresh(',
        'DataLoader.loadPublicData(',
        'DT.buildBranches(',
        'window.LoveBudVisitorViewerData',
        'State.createInitialState(',
        'State.getAllMoments(',
        'State.resolveSelection(',
        'State.applySelection(',
        'ShellRender.renderShell(',
        'RenderTree.renderTree(',
        'Panels.renderPanel(',
        'HandlerFactory.createHandler(',
        'ShareExportBridge.setupShareExportBridge(',
        'ClickActions.attachClickActions(',
        'RetrySetup.setupRetry(',
        'TestHooks.exportTestHooks(',
        'RS.renderError('
    ];

    required.forEach(str => {
        assert.ok(code.includes(str), `viewer-init-flow must contain ${str}`);
    });
});

test('tree route loads final viewer helpers before active entry', () => {
    const html = fs.readFileSync('pages/tree.html', 'utf8');

    const expectedOrder = [
        'viewer-route.js',
        'viewer-data-transform.js',
        'viewer-data-loader.js',
        'viewer-render-state.js',
        'viewer-shell-render.js',
        'viewer-state.js',
        'viewer-share-status-ui.js',
        'viewer-share-export-actions.js',
        'viewer-retry-setup.js',
        'viewer-test-hooks.js',
        'viewer-click-actions.js',
        'viewer-handler-factory.js',
        'viewer-share-export-bridge.js',
        'viewer-init-flow.js',
        'tree-viewer.js'
    ];

    let lastIndex = -1;
    expectedOrder.forEach(script => {
        const index = html.indexOf(script);
        assert.notEqual(index, -1, `tree.html must load ${script}`);
        assert.ok(index > lastIndex, `${script} must load after the previous scripts`);
        lastIndex = index;
    });
});

test('legacy public-tree-viewer remains inactive for tree route', () => {
    const html = fs.readFileSync('pages/tree.html', 'utf8');
    assert.ok(!html.includes('public-tree-viewer.js'), 'tree.html must not load public-tree-viewer.js');
});

test('final split guard avoids forbidden path changes by contract note', () => {
    // This is more of a smoke note to verify via git diff but asserting contextually
    const viewerScripts = fs.readdirSync('js/viewer');
    assert.ok(viewerScripts.includes('public-tree-viewer.js'), 'public-tree-viewer.js must not be deleted');
});
