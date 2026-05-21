/**
 * LoveBud Viewer Init Flow Contract Tests
 * Issue #1282
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('tree-viewer.js delegates init flow to helper', () => {
    const tvCode = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    assert.ok(tvCode.includes('window.LoveBudViewerInitFlow'), 'tree-viewer.js must read InitFlow helper');
    assert.ok(tvCode.includes('InitFlow.startViewer('), 'tree-viewer.js must call startViewer');
    
    // Check that init flow responsibilities are gone from tree-viewer.js
    assert.ok(!tvCode.includes('async function initViewer()'), 'tree-viewer.js must not define initViewer');
    assert.ok(!tvCode.includes('function refresh()'), 'tree-viewer.js must not define refresh');
    assert.ok(tvCode.includes('(function() {'), 'tree-viewer.js must remain an active entry IIFE');
});

test('viewer-init-flow.js implements init flow logic', () => {
    const code = fs.readFileSync('js/viewer/viewer-init-flow.js', 'utf8');
    assert.ok(code.includes('window.LoveBudViewerInitFlow = {'), 'must export namespace');
    assert.ok(code.includes('startViewer: startViewer'), 'must export startViewer');
    
    // Check flow responsibilities
    assert.ok(code.includes('async function initViewer()'), 'must own initViewer');
    assert.ok(code.includes('function refresh()'), 'must own refresh');
    assert.ok(code.includes('State.createInitialState()'), 'must call createInitialState');
    assert.ok(code.includes('DataLoader.loadPublicData'), 'must call loadPublicData');
    assert.ok(code.includes('State.resolveSelection('), 'must call resolveSelection');
    assert.ok(code.includes('State.applySelection('), 'must call applySelection');
    assert.ok(code.includes('ShellRender.renderShell('), 'must call renderShell');
    assert.ok(code.includes('RenderTree.renderTree('), 'must call renderTree');
    assert.ok(code.includes('Panels.renderPanel('), 'must call renderPanel');
    assert.ok(code.includes('HandlerFactory.createHandler('), 'must call createHandler');
    assert.ok(code.includes('ShareExportBridge.setupShareExportBridge('), 'must call setupShareExportBridge');
    assert.ok(code.includes('ClickActions.attachClickActions('), 'must call attachClickActions');
    assert.ok(code.includes('RetrySetup.setupRetry('), 'must call setupRetry');
});
