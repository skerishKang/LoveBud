/**
 * LoveBud Viewer Handler Factory Contract Tests
 * Issue #1282
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('tree-viewer.js delegates handler creation to helper', () => {
    const tvCode = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    assert.ok(tvCode.includes('window.LoveBudViewerHandlerFactory'), 'tree-viewer.js must read HandlerFactory helper');
    assert.ok(!tvCode.includes('var handler = {\n'), 'tree-viewer.js must not directly construct handler object block');
    assert.ok(!tvCode.includes('state.layoutMode = state.layoutMode ==='), 'tree-viewer.js must not have onToggleLayout logic');
});

test('viewer-handler-factory.js implements correct handler logic', () => {
    const code = fs.readFileSync('js/viewer/viewer-handler-factory.js', 'utf8');
    assert.ok(code.includes('window.LoveBudViewerHandlerFactory = {'), 'must export namespace');
    assert.ok(code.includes('function createHandler(context)'), 'must export createHandler');
    
    // Check all 8 methods exist
    assert.ok(code.includes('getShareUrl:'), 'must have getShareUrl');
    assert.ok(code.includes('onSelectBranch:'), 'must have onSelectBranch');
    assert.ok(code.includes('onSelectMoment:'), 'must have onSelectMoment');
    assert.ok(code.includes('closeMoment:'), 'must have closeMoment');
    assert.ok(code.includes('openPanel:'), 'must have openPanel');
    assert.ok(code.includes('closePanel:'), 'must have closePanel');
    assert.ok(code.includes('toggleLike:'), 'must have toggleLike');
    assert.ok(code.includes('onToggleLayout:'), 'must have onToggleLayout');
    
    // Check key strings
    assert.ok(code.includes('viewerData.rootSeed && momentId === viewerData.rootSeed.id'), 'must contain rootSeed logic');
    assert.ok(code.includes("doc.getElementById('vvLayoutToggleLabel')"), 'must contain toggle label update logic');
    assert.ok(code.includes('state.likedTree = !state.likedTree'), 'must contain toggleLike logic');
});
