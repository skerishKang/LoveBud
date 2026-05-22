const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('editor.html retains top-level core structure', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // 1. Top-level application layout wrappers
    assert.ok(html.includes('class="editor-layout page-transition-enter"'), 'must have editor-layout shell');
    assert.ok(html.includes('id="shared-header"'), 'must have shared-header container');
    assert.ok(html.includes('class="noise-overlay"'), 'must have noise-overlay');
    assert.ok(html.includes('<body class="editor-preload">'), 'must have editor-preload on body');

    // 2. Canvas Area main
    assert.ok(html.includes('id="canvasArea"'), 'must have canvasArea container');
    assert.ok(html.includes('class="canvas-area reveal-scale reveal-up"'), 'must have canvas-area classes');
    
    // 3. SVG Canvas (Runtime heavily depends on this, likely won't be extracted easily without breaking SVG logic)
    assert.ok(html.includes('id="canvasSvg"'), 'must have canvasSvg');
    assert.ok(html.includes('class="canvas-svg"'), 'must have canvas-svg class');

    // 4. Mobile Bottom Bar (explicitly mentioned as non-goal for #1280)
    assert.ok(html.includes('id="mobileBottomBar"'), 'must have mobileBottomBar');
    assert.ok(html.includes('class="editor-mobile-bottom-bar'), 'must have editor-mobile-bottom-bar class');
    assert.ok(html.includes('id="mobileBottomAction"'), 'must have mobileBottomAction button');
});

test('editor.html uses extracted mounts and has no direct raw components', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // Validate that mounts are in the document
    assert.ok(html.includes('id="editorSidebarTemplateMount"'), 'must have sidebar mount');
    assert.ok(html.includes('id="editorCanvasTopbarTemplateMount"'), 'must have topbar mount');
    assert.ok(html.includes('id="editorFloatingToolbarTemplateMount"'), 'must have floating toolbar mount');
    assert.ok(html.includes('id="editorEmptyGuideTemplateMount"'), 'must have empty guide mount');
    assert.ok(html.includes('id="addMemoryFormTemplateMount"'), 'must have add memory form mount');
    assert.ok(html.includes('id="editorDetailPanelShellTemplateMount"'), 'must have detail panel shell mount');

    // Validate that their internal structures are gone from the raw HTML
    assert.ok(!html.includes('id="detailPanel"'), 'raw HTML should not contain detailPanel');
    assert.ok(!html.includes('id="detailContent"'), 'raw HTML should not contain detailContent');
    assert.ok(!html.includes('id="detailEmptyState"'), 'raw HTML should not contain detailEmptyState');
    assert.ok(!html.includes('id="detailViewMode"'), 'raw HTML should not contain detailViewMode');
    assert.ok(!html.includes('id="detailEditMode"'), 'raw HTML should not contain detailEditMode');
    assert.ok(!html.includes('id="detailEmptyStartBtn"'), 'raw HTML should not contain detailEmptyStartBtn');
    assert.ok(!html.includes('id="detailCurrentMomentTitle"'), 'raw HTML should not contain detailCurrentMomentTitle');
    assert.ok(!html.includes('id="editTitleInput"'), 'raw HTML should not contain editTitleInput');

    assert.ok(!html.includes('id="addMemoryModal"'), 'raw HTML should not contain addMemoryModal');
    assert.ok(!html.includes('class="sidebar"'), 'raw HTML should not contain sidebar class (except maybe in mount string but not as a tag if possible)'); // Just checking general absence
    assert.ok(!html.includes('id="canvasTopbar"'), 'raw HTML should not contain canvasTopbar');
    assert.ok(!html.includes('id="canvasEmptyGuide"'), 'raw HTML should not contain canvasEmptyGuide');
    assert.ok(!html.includes('id="editorFloatingToolbar"'), 'raw HTML should not contain editorFloatingToolbar');
});

test('editor.html loads template helpers before editor runtime in correct order', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const addMemoryIndex = html.indexOf('js/editor/templates/editor-add-memory-form-template.js');
    const sidebarIndex = html.indexOf('js/editor/templates/editor-sidebar-template.js');
    const canvasTopbarIndex = html.indexOf('js/editor/templates/editor-canvas-topbar-template.js');
    const emptyGuideIndex = html.indexOf('js/editor/templates/editor-empty-guide-template.js');
    const floatingToolbarIndex = html.indexOf('js/editor/templates/editor-floating-toolbar-template.js');
    const detailPanelShellIndex = html.indexOf('js/editor/templates/editor-detail-panel-shell-template.js');
    const detailEmptyStateIndex = html.indexOf('js/editor/templates/editor-detail-empty-state-template.js');
    const detailViewModeIndex = html.indexOf('js/editor/templates/editor-detail-view-mode-template.js');
    const detailEditModeIndex = html.indexOf('js/editor/templates/editor-detail-edit-mode-template.js');
    
    const domSelectorsIndex = html.indexOf('js/editor/editor-dom-selectors.js');
    const editorJsIndex = html.indexOf('js/editor.js');

    // All must exist
    assert.notEqual(addMemoryIndex, -1);
    assert.notEqual(sidebarIndex, -1);
    assert.notEqual(canvasTopbarIndex, -1);
    assert.notEqual(emptyGuideIndex, -1);
    assert.notEqual(floatingToolbarIndex, -1);
    assert.notEqual(detailPanelShellIndex, -1);
    assert.notEqual(detailEmptyStateIndex, -1);
    assert.notEqual(detailViewModeIndex, -1);
    assert.notEqual(detailEditModeIndex, -1);
    assert.notEqual(domSelectorsIndex, -1);
    assert.notEqual(editorJsIndex, -1);

    // Order assertions
    assert.ok(addMemoryIndex < sidebarIndex, 'addMemory before sidebar');
    assert.ok(sidebarIndex < canvasTopbarIndex, 'sidebar before canvasTopbar');
    assert.ok(canvasTopbarIndex < emptyGuideIndex, 'canvasTopbar before emptyGuide');
    assert.ok(emptyGuideIndex < floatingToolbarIndex, 'emptyGuide before floatingToolbar');
    assert.ok(floatingToolbarIndex < detailPanelShellIndex, 'floatingToolbar before detailPanelShell');
    assert.ok(detailPanelShellIndex < detailEmptyStateIndex, 'detailPanelShell before detailEmptyState');
    assert.ok(detailEmptyStateIndex < detailViewModeIndex, 'detailEmptyState before detailViewMode');
    assert.ok(detailViewModeIndex < detailEditModeIndex, 'detailViewMode before detailEditMode');
    
    // Everything before dom-selectors
    assert.ok(detailEditModeIndex < domSelectorsIndex, 'detailEditMode before domSelectors');
    
    // Everything before editor.js
    assert.ok(domSelectorsIndex < editorJsIndex, 'domSelectors before editorJs');
});
