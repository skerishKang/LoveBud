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

function getTreeHtmlScriptSrcs() {
    const html = fs.readFileSync('pages/tree.html', 'utf8');
    return [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
}

function findScriptIndex(scripts, needle) {
    return scripts.findIndex((src) => src.includes(needle));
}

test('tree viewer route page exists', () => {
    assert.ok(fs.existsSync('pages/tree.html'), 'pages/tree.html must exist');
});

test('tree viewer orchestrator JS exists', () => {
    assert.ok(fs.existsSync('js/viewer/tree-viewer.js'), 'js/viewer/tree-viewer.js must exist');
});

test('tree-viewer.js is the active public viewer entry for tree.html', () => {
    const scripts = getTreeHtmlScriptSrcs();

    assert.ok(
        scripts.some((src) => src.includes('js/viewer/tree-viewer.js')),
        'pages/tree.html must load js/viewer/tree-viewer.js as the active public viewer entry'
    );
});

test('public-tree-viewer.js remains legacy/static and is not loaded by tree.html', () => {
    const scripts = getTreeHtmlScriptSrcs();

    assert.ok(
        fs.existsSync('js/viewer/public-tree-viewer.js'),
        'legacy/static js/viewer/public-tree-viewer.js should remain available for guardrail tests'
    );
    assert.equal(
        scripts.some((src) => src.includes('js/viewer/public-tree-viewer.js')),
        false,
        'pages/tree.html must not load legacy/static js/viewer/public-tree-viewer.js'
    );
});

test('tree viewer route loads share status UI before active tree-viewer entry', () => {
    const scripts = getTreeHtmlScriptSrcs();
    const shareExportIndex = findScriptIndex(scripts, 'js/viewer/viewer-share-export-actions.js');
    const shareStatusIndex = findScriptIndex(scripts, 'js/viewer/viewer-share-status-ui.js');
    const treeViewerIndex = findScriptIndex(scripts, 'js/viewer/tree-viewer.js');

    assert.notEqual(shareStatusIndex, -1, 'tree.html must load viewer-share-status-ui.js');
    assert.notEqual(shareExportIndex, -1, 'tree.html must load viewer-share-export-actions.js');
    assert.notEqual(treeViewerIndex, -1, 'tree.html must load tree-viewer.js');
    assert.ok(shareStatusIndex < shareExportIndex, 'viewer-share-status-ui.js should load before viewer-share-export-actions.js');
    assert.ok(shareStatusIndex < treeViewerIndex, 'viewer-share-status-ui.js must load before tree-viewer.js');
});

test('tree viewer route loads data loader before active tree-viewer entry', () => {
    const scripts = getTreeHtmlScriptSrcs();
    const dataLoaderIndex = findScriptIndex(scripts, 'js/viewer/viewer-data-loader.js');
    const treeViewerIndex = findScriptIndex(scripts, 'js/viewer/tree-viewer.js');

    assert.notEqual(dataLoaderIndex, -1, 'pages/tree.html must load js/viewer/viewer-data-loader.js');
    assert.ok(
        dataLoaderIndex < treeViewerIndex,
        'viewer-data-loader.js must load before js/viewer/tree-viewer.js'
    );
});

test('tree viewer route loads retry setup helper before active tree-viewer entry', () => {
    const scripts = getTreeHtmlScriptSrcs();
    const retrySetupIndex = findScriptIndex(scripts, 'js/viewer/viewer-retry-setup.js');
    const treeViewerIndex = findScriptIndex(scripts, 'js/viewer/tree-viewer.js');

    assert.notEqual(retrySetupIndex, -1, 'pages/tree.html must load js/viewer/viewer-retry-setup.js');
    assert.ok(
        retrySetupIndex < treeViewerIndex,
        'viewer-retry-setup.js must load before js/viewer/tree-viewer.js'
    );
});

test('tree viewer route loads test hooks helper before active tree-viewer entry', () => {
    const scripts = getTreeHtmlScriptSrcs();
    const testHooksIndex = findScriptIndex(scripts, 'js/viewer/viewer-test-hooks.js');
    const treeViewerIndex = findScriptIndex(scripts, 'js/viewer/tree-viewer.js');

    assert.notEqual(testHooksIndex, -1, 'pages/tree.html must load js/viewer/viewer-test-hooks.js');
    assert.ok(
        testHooksIndex < treeViewerIndex,
        'viewer-test-hooks.js must load before js/viewer/tree-viewer.js'
    );
});

test('tree viewer route loads helper scripts in correct order before active entry', () => {
    const scripts = getTreeHtmlScriptSrcs();
    const shareExportIndex = findScriptIndex(scripts, 'js/viewer/viewer-share-export-actions.js');
    const clickActionsIndex = findScriptIndex(scripts, 'js/viewer/viewer-click-actions.js');
    const handlerFactoryIndex = findScriptIndex(scripts, 'js/viewer/viewer-handler-factory.js');
    const shareExportBridgeIndex = findScriptIndex(scripts, 'js/viewer/viewer-share-export-bridge.js');
    const initFlowIndex = findScriptIndex(scripts, 'js/viewer/viewer-init-flow.js');
    const treeViewerIndex = findScriptIndex(scripts, 'js/viewer/tree-viewer.js');

    assert.notEqual(clickActionsIndex, -1, 'pages/tree.html must load js/viewer/viewer-click-actions.js');
    assert.notEqual(handlerFactoryIndex, -1, 'pages/tree.html must load js/viewer/viewer-handler-factory.js');
    assert.notEqual(shareExportBridgeIndex, -1, 'pages/tree.html must load js/viewer/viewer-share-export-bridge.js');
    assert.notEqual(initFlowIndex, -1, 'pages/tree.html must load js/viewer/viewer-init-flow.js');
    
    assert.ok(
        shareExportIndex < clickActionsIndex,
        'viewer-click-actions.js must load after viewer-share-export-actions.js'
    );
    assert.ok(
        clickActionsIndex < handlerFactoryIndex,
        'viewer-handler-factory.js must load after viewer-click-actions.js'
    );
    assert.ok(
        handlerFactoryIndex < shareExportBridgeIndex,
        'viewer-share-export-bridge.js must load after viewer-handler-factory.js'
    );
    assert.ok(
        shareExportBridgeIndex < initFlowIndex,
        'viewer-init-flow.js must load after viewer-share-export-bridge.js'
    );
    assert.ok(
        initFlowIndex < treeViewerIndex,
        'viewer-init-flow.js must load before js/viewer/tree-viewer.js'
    );
});

test('viewer share status UI helper preserves status message behavior contract', () => {
    const src = fs.readFileSync('js/viewer/viewer-share-status-ui.js', 'utf8');

    assert.match(src, /window\.LoveBudViewerShareStatusUI/, 'helper must export LoveBudViewerShareStatusUI namespace');
    assert.match(src, /showShareStatus:\s*showShareStatus/, 'helper must export showShareStatus');
    assert.match(src, /getElementById\(['"]vvShareStatus['"]\)/, 'helper must target #vvShareStatus');
    assert.ok(src.includes("'vv-share-status ' + (result.success ? 'is-success' : 'is-error')"),
        'helper must preserve success/error class assignment');
    assert.match(src, /clearTimeout\(statusEl\._hideTimer\)/, 'helper must clear the previous hide timer');
    assert.match(src, /statusEl\._hideTimer\s*=\s*setTimeout/, 'helper must store the hide timer');
    assert.match(src, /},\s*3000\)/, 'helper must reset after 3000ms');
});

test('tree-viewer.js delegates share status UI instead of owning DOM status updates', () => {
    const src = fs.readFileSync('js/viewer/tree-viewer.js', 'utf8');

    assert.match(src, /window\.LoveBudViewerShareStatusUI/, 'tree-viewer.js must read the share status UI helper');
    assert.doesNotMatch(src, /getElementById\(['"]vvShareStatus['"]\)/,
        'tree-viewer.js must not directly query #vvShareStatus');
    assert.doesNotMatch(src, /_hideTimer/, 'tree-viewer.js must not own the share status hide timer');
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

test('Browse tree-open CTA targets public-canvas read-only route with treeId param', () => {
    const helper = fs.readFileSync('js/search/search-preview-action-helper.js', 'utf8');
    const hasCanvasUrl = helper.includes('view.html?treeId=');
    assert.ok(hasCanvasUrl, 'search-preview-action-helper.js must use view.html?treeId= for tree-open CTA');
    const noDetailUrl = !helper.includes('detail.html?tree=');
    assert.ok(noDetailUrl, 'search-preview-action-helper.js must not use detail.html?tree= for tree-open CTA');
});

test('Browse card renderer targets public-canvas read-only route with treeId param', () => {
    const renderer = fs.readFileSync('js/search/search-card-renderer.js', 'utf8');
    assert.ok(renderer.includes('view.html?treeId='), 'search-card-renderer.js must use view.html?treeId= for card tree-open link');
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
    assert.ok(src.includes('} else if (safeThumb)'),
        'iframe rejection must fall back to thumbnail branch');
});

test('public-tree-viewer.js iframe src uses escapeHtml around safeEmbedUrl', () => {
    const src = fs.readFileSync('js/viewer/public-tree-viewer.js', 'utf8');
    assert.ok(src.includes('escapeHtml(safeEmbedUrl)'),
        'iframe src value must pass through escapeHtml');
});

test('viewer state elements have correct ARIA roles and live regions', () => {
    const html = fs.readFileSync('pages/tree.html', 'utf8');

    const shellMatch = html.match(/<div id="viewerTreeShell"[^>]*>/);
    assert.ok(shellMatch, 'viewerTreeShell must exist');
    assert.ok(shellMatch[0].includes('aria-busy="true"'), 'viewerTreeShell must have initial aria-busy="true"');

    const loadingMatch = html.match(/<div id="viewerLoadingState"[^>]*>/);
    assert.ok(loadingMatch, 'viewerLoadingState must exist');
    assert.ok(loadingMatch[0].includes('role="status"'), 'viewerLoadingState must have role="status"');
    assert.ok(loadingMatch[0].includes('aria-live="polite"'), 'viewerLoadingState must have aria-live="polite"');

    const emptyMatch = html.match(/<div id="viewerEmptyState"[^>]*>/);
    assert.ok(emptyMatch, 'viewerEmptyState must exist');
    assert.ok(emptyMatch[0].includes('role="status"'), 'viewerEmptyState must have role="status"');
    assert.ok(emptyMatch[0].includes('aria-live="polite"'), 'viewerEmptyState must have aria-live="polite"');

    const errorMatch = html.match(/<div id="viewerErrorState"[^>]*>/);
    assert.ok(errorMatch, 'viewerErrorState must exist');
    assert.ok(errorMatch[0].includes('role="alert"'), 'viewerErrorState must have role="alert"');
});

test('viewer render state uses hidden attribute as display authority', () => {
    const src = fs.readFileSync('js/viewer/viewer-render-state.js', 'utf8');

    assert.ok(src.includes("removeAttribute('hidden')"), 'show() must use removeAttribute(hidden)');
    assert.ok(src.includes("setAttribute('hidden'"), 'hide() must use setAttribute(hidden)');
    assert.doesNotMatch(src, /el\.style\.display\s*=\s*'none'/, 'hide() must not use inline display:none');
});

test('viewer render state manages aria-busy on shell', () => {
    const src = fs.readFileSync('js/viewer/viewer-render-state.js', 'utf8');

    assert.ok(src.includes('aria-busy'), 'viewer-render-state.js must manage aria-busy');
    assert.ok(src.includes("setAttribute('aria-busy', 'true')"), 'showLoading must set aria-busy true');
    assert.ok(src.includes("removeAttribute('aria-busy')"), 'show must clear aria-busy');
});

test('viewer state CSS includes reduced-motion rule for icons', () => {
    const css = fs.readFileSync('css/viewer/public-tree-viewer/state.css', 'utf8');

    assert.ok(css.includes('prefers-reduced-motion: reduce'), 'state.css must include prefers-reduced-motion media query');
    assert.ok(css.includes('.viewer-state .material-symbols-outlined'), 'reduced-motion rule must target viewer state icons');
    assert.ok(css.includes('animation: none'), 'reduced-motion must disable animation');
});

test('viewer error state includes retry button', () => {
    const html = fs.readFileSync('pages/tree.html', 'utf8');
    assert.ok(html.includes('id="viewerRetryBtn"'), 'tree.html must include #viewerRetryBtn');
});

test('viewer state CSS guards against Material Symbols ligature overflow', () => {
    const css = fs.readFileSync('css/viewer/public-tree-viewer/state.css', 'utf8');

    assert.ok(css.includes('.viewer-state'), 'state.css must scope overflow guard to viewer-state');
    assert.ok(css.includes('overflow-wrap'), 'state.css must include overflow-wrap to prevent ligature text overflow when external fonts are blocked');
});

test('viewer state CSS ends with trailing newline', () => {
    const css = fs.readFileSync('css/viewer/public-tree-viewer/state.css', 'utf8');
    assert.ok(css.endsWith('\n'), 'state.css must end with a trailing newline');
});
