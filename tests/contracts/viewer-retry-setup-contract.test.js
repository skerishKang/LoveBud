/**
 * LoveBud Viewer Retry Setup Contract Tests
 * Issue #1282
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('tree-viewer.js delegates retry setup to helper', () => {
    const tvCode = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    assert.ok(tvCode.includes('window.LoveBudViewerRetrySetup'), 'tree-viewer.js must bind RetrySetup');
    assert.ok(tvCode.includes('RetrySetup.setupRetry'), 'tree-viewer.js must call RetrySetup.setupRetry');
    assert.ok(!tvCode.includes("getElementById('viewerRetryBtn')"), 'tree-viewer.js must not query viewerRetryBtn directly');
});

test('viewer-retry-setup.js correctly implements setupRetry contract', () => {
    const code = fs.readFileSync('js/viewer/viewer-retry-setup.js', 'utf8');
    assert.ok(code.includes('window.LoveBudViewerRetrySetup'), 'must export namespace');
    assert.ok(code.includes('function setupRetry(getCurrentTreeId, initViewer)'), 'must accept getCurrentTreeId and initViewer context callbacks');
    assert.ok(code.includes("document.getElementById('viewerRetryBtn')"), 'must query viewerRetryBtn');
    assert.ok(code.includes("btn.addEventListener('click',"), 'must bind click listener');
    assert.ok(code.includes('typeof getCurrentTreeId === \'function\''), 'must verify getCurrentTreeId is a function');
    assert.ok(code.includes('typeof initViewer === \'function\''), 'must verify initViewer is a function');
});
