/**
 * LoveBud Viewer Route Contract Tests
 * Issue #923 — First slice of read-only LoveTree viewer route
 *
 * Verifies:
 * - Viewer page file (pages/tree.html) exists
 * - Viewer JS does not expose Editor/Builder controls
 * - Viewer does not load Editor entry script
 * - Browse "트리 열기" targets extensionless tree route (not editor or detail)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('tree viewer route page exists', () => {
    assert.ok(fs.existsSync('pages/tree.html'), 'pages/tree.html must exist');
});

test('tree viewer orchestrator JS exists', () => {
    assert.ok(fs.existsSync('js/viewer/tree-viewer.js'), 'js/viewer/tree-viewer.js must exist');
});

test('tree viewer route does not load editor entry script', () => {
    const html = fs.readFileSync('pages/tree.html', 'utf8');
    const noEditorScript = !html.includes('js/editor.js') && !html.includes('pages/editor.html');
    assert.ok(noEditorScript, 'tree.html must not load editor entry script');
});

test('tree viewer JS does not contain editing affordances', () => {
    const content = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    const forbidden = ['contentEditable', 'edit-control', 'edit-btn', 'delete-btn', 'add-moment', 'drag-handle'];
    const violations = forbidden.filter(f => content.includes(f));
    assert.equal(violations.length, 0, 'tree-viewer.js must not contain editing affordances: ' + violations.join(', '));
});

test('tree viewer route does not reference Editor/Builder page', () => {
    const html = fs.readFileSync('pages/tree.html', 'utf8');
    const noEditorPage = !html.includes('editor.html') && !html.includes('js/editor/') && !html.includes('js/editor.js');
    assert.ok(noEditorPage, 'tree.html must not load any Editor module');
});

test('Browse tree-open CTA targets extensionless tree route with treeId param', () => {
    const helper = fs.readFileSync('js/search/search-preview-action-helper.js', 'utf8');
    const hasTreeUrl = helper.includes('tree?treeId=');
    assert.ok(hasTreeUrl, 'search-preview-action-helper.js must use tree?treeId= for tree-open CTA');
    assert.ok(!helper.includes('tree.html?treeId='), 'search-preview-action-helper.js must not use .html tree route for tree-open CTA');
    const noDetailUrl = !helper.includes('detail.html?tree=');
    assert.ok(noDetailUrl, 'search-preview-action-helper.js must not use detail.html?tree= for tree-open CTA');
});

test('Browse card renderer targets extensionless tree route with treeId param', () => {
    const renderer = fs.readFileSync('js/search/search-card-renderer.js', 'utf8');
    assert.ok(renderer.includes('tree?treeId='), 'search-card-renderer.js must use tree?treeId= for card tree-open link');
    assert.ok(!renderer.includes('tree.html?treeId='), 'search-card-renderer.js must not use .html tree route for card tree-open link');
});

test('My Trees owner routes target extensionless editor route with treeId param', () => {
    const ui = fs.readFileSync('js/my-trees/my-trees-ui.js', 'utf8');
    const actions = fs.readFileSync('js/my-trees/my-trees-actions.js', 'utf8');
    const source = ui + '\n' + actions;
    assert.ok(source.includes("'editor?treeId='"), 'My Trees must use editor?treeId= for owner editor navigation');
    assert.ok(!source.includes("'editor.html?treeId='"), 'My Trees must not use .html editor route for owner editor navigation');
});

test('tree viewer loads Canvas v4 modules', () => {
    const html = fs.readFileSync('pages/tree.html', 'utf8');
    const hasRenderer = html.includes('visitor-viewer/visitor-viewer-render-tree.js');
    const hasPanels = html.includes('visitor-viewer/visitor-viewer-panels.js');
    const noMockData = !html.includes('visitor-viewer/visitor-viewer-data.js');
    assert.ok(hasRenderer && hasPanels && noMockData, 'tree.html must load render-tree and panels but NOT visitor-viewer-data.js');
});

test('tree viewer does not load mock visitor-viewer orchestrator', () => {
    const html = fs.readFileSync('pages/tree.html', 'utf8');
    const noMockOrch = !html.includes('visitor-viewer/visitor-viewer.js');
    assert.ok(noMockOrch, 'tree.html must not load visitor-viewer.js (mock data orchestrator)');
});

test('tree viewer scripts are scoped as viewer code', () => {
    const content = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');
    const marker = content.includes('LoveBudTreeViewerLoaded');
    assert.ok(marker, 'tree-viewer.js must have a unique loaded marker');
    const noEditorMarkers = !content.includes('editorCanvas') && !content.includes('nodeContextMenu') && !content.includes('addMemory');
    assert.ok(noEditorMarkers, 'tree-viewer.js must not reference Editor internals');
});

test('public-tree-viewer.js uses sanitizeUrl before iframe src insertion', () => {
    const src = fs.readFileSync('js/viewer/public-tree-viewer.js', 'utf8');
    const hasSanitizeRef = src.includes('window.LoveBudSecurity') && src.includes('sanitizeUrl');
    assert.ok(hasSanitizeRef, 'public-tree-viewer.js must reference LoveBudSecurity.sanitizeUrl');
});

test('public-tree-viewer.js iframe branch has safeEmbedUrl guard', () => {
    const src = fs.readFileSync('js/viewer/public-tree-viewer.js', 'utf8');
    assert.ok(src.includes('if (safeEmbedUrl)'),
        'iframe src must be gated behind safeEmbedUrl check');
    assert.ok(src.includes('} else if (thumb)'),
        'iframe rejection must fall back to thumbnail branch');
});

test('public-tree-viewer.js iframe src uses escapeHtml around safeEmbedUrl', () => {
    const src = fs.readFileSync('js/viewer/public-tree-viewer.js', 'utf8');
    assert.ok(src.includes('escapeHtml(safeEmbedUrl)'),
        'iframe src value must pass through escapeHtml');
});
