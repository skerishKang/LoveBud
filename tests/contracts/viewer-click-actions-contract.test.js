/**
 * LoveBud Viewer Click Actions Contract Tests
 * Issue #1282
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('tree-viewer.js delegates click events to helper', () => {
    const tvCode = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    assert.ok(tvCode.includes('window.LoveBudViewerClickActions'), 'tree-viewer.js must read ClickActions helper');
    assert.ok(tvCode.includes('ClickActions.attachClickActions(container, handler, shareExportHandlers)'), 'tree-viewer.js must call attachClickActions');
    assert.ok(!tvCode.includes("a === 'close-moment'"), 'tree-viewer.js must not have click dispatch branches internally');
});

test('viewer-click-actions.js implements correct dispatch logic', () => {
    const code = fs.readFileSync('js/viewer/viewer-click-actions.js', 'utf8');
    assert.ok(code.includes('window.LoveBudViewerClickActions = {'), 'must export namespace');
    assert.ok(code.includes('function attachClickActions(container, handler, shareExportHandlers)'), 'must accept container, handler, shareExportHandlers');
    assert.ok(code.includes("container.addEventListener('click',"), 'must bind click listener');
    assert.ok(code.includes("action.dataset.action"), 'must handle [data-action]');
    assert.ok(code.includes("a === 'close-moment'"), 'must dispatch close-moment');
    assert.ok(code.includes("a === 'close-panel'"), 'must dispatch close-panel');
    assert.ok(code.includes("a === 'toggle-like'"), 'must dispatch toggle-like');
    assert.ok(code.includes("action.classList.toggle('is-liked')"), 'must toggle is-liked class');
    assert.ok(code.includes("a === 'open-tree-comments'"), 'must dispatch open-tree-comments');
    assert.ok(code.includes("a === 'open-share'"), 'must dispatch open-share');
    assert.ok(code.includes("a === 'toggle-layout'"), 'must dispatch toggle-layout');
    assert.ok(code.includes("window.LoveBudViewerShareExportActions"), 'must bridge share/export actions');
    assert.ok(code.includes("momentBtn.dataset.momentId"), 'must dispatch moment selection');
    assert.ok(code.includes("branchBtn.dataset.branchId"), 'must dispatch branch selection');
});
