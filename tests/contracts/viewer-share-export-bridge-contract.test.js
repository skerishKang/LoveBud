/**
 * LoveBud Viewer Share Export Bridge Contract Tests
 * Issue #1282
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('tree-viewer.js delegates share export bridge setup to helper', () => {
    const tvCode = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    assert.ok(tvCode.includes('window.LoveBudViewerShareExportBridge'), 'tree-viewer.js must read ShareExportBridge helper');
    assert.ok(tvCode.includes('ShareExportBridge.setupShareExportBridge('), 'tree-viewer.js must call setupShareExportBridge');
    assert.ok(!tvCode.includes('var shareExportHandlers = null;\n            (function() {'), 'tree-viewer.js must not directly execute the bridge setup closure');
    assert.ok(!tvCode.includes('handler.copyLink = se.copyLink;'), 'tree-viewer.js must not directly map share action methods to handler');
});

test('viewer-share-export-bridge.js implements correct bridge logic', () => {
    const code = fs.readFileSync('js/viewer/viewer-share-export-bridge.js', 'utf8');
    assert.ok(code.includes('window.LoveBudViewerShareExportBridge = {'), 'must export namespace');
    assert.ok(code.includes('function setupShareExportBridge(context)'), 'must export setupShareExportBridge');
    
    // Check mapping logic
    assert.ok(code.includes('handler.copyLink = se.copyLink;'), 'must map copyLink');
    assert.ok(code.includes('handler.nativeShare = se.nativeShare;'), 'must map nativeShare');
    assert.ok(code.includes('handler.platformShare = se.platformShare;'), 'must map platformShare');
    assert.ok(code.includes('handler.exportTreeImageCard = se.exportTreeImageCard;'), 'must map exportTreeImageCard');
    assert.ok(code.includes('handler.exportMomentImageCard = se.exportMomentImageCard;'), 'must map exportMomentImageCard');
    assert.ok(code.includes('handler.printTree = se.printTree;'), 'must map printTree');
    
    // Check reference
    assert.ok(code.includes('window.LoveBudViewerShareExportActions'), 'must reference ShareExportActions');
});
