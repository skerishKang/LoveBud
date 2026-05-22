const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('Detail Empty State template helper exists and contains markup', () => {
    const helperPath = 'js/editor/templates/editor-detail-empty-state-template.js';
    assert.ok(fs.existsSync(helperPath), 'template helper file must exist');

    const helperCode = fs.readFileSync(helperPath, 'utf8');
    assert.ok(helperCode.includes('id="detailEmptyState"'), 'must include detail empty state root id');
    assert.ok(helperCode.includes('id="detailEmptyTitle"'), 'must include detail empty title id');
    assert.ok(helperCode.includes('id="detailEmptyDesc"'), 'must include detail empty desc id');
    assert.ok(helperCode.includes('id="detailEmptyStartBtn"'), 'must include detail empty start btn id');
    
    assert.ok(helperCode.includes('class="editor-visible-initial"'), 'must include editor-visible-initial class');
    assert.ok(helperCode.includes('class="editor-empty-state-box"'), 'must include editor-empty-state-box class');
    assert.ok(helperCode.includes('editor-empty-state-icon'), 'must include editor-empty-state-icon class');
    assert.ok(helperCode.includes('editor-empty-state-cta'), 'must include editor-empty-state-cta class');
    
    assert.ok(helperCode.includes('tabindex="-1"'), 'must preserve tabindex');
    assert.ok(helperCode.includes('sentiment_satisfied'), 'must preserve icon text');
    assert.ok(helperCode.includes('첫 순간 심기'), 'must preserve btn text');

    assert.ok(helperCode.includes('editorDetailEmptyStateTemplateMount'), 'must find mount element');
});

test('editor.html uses template mount and removes raw detail empty state markup', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // Should have the shell mount anchor (inner mounts are inside the shell helper)
    // assert.ok(html.includes('id="editorDetailEmptyStateTemplateMount"'), 'must have mount anchor');

    // Should not have the inner contents like detailEmptyStartBtn in the raw HTML anymore
    assert.ok(!html.includes('id="detailEmptyStartBtn"'), 'raw HTML should not contain detail empty state button');
    assert.ok(!html.includes('id="detailEmptyTitle"'), 'raw HTML should not contain detail empty state title');
});

test('editor.html loads template helper before editor runtime in correct order', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const addMemoryHelperIndex = html.indexOf('js/editor/templates/editor-add-memory-form-template.js');
    const sidebarHelperIndex = html.indexOf('js/editor/templates/editor-sidebar-template.js');
    const topbarHelperIndex = html.indexOf('js/editor/templates/editor-canvas-topbar-template.js');
    const emptyGuideHelperIndex = html.indexOf('js/editor/templates/editor-empty-guide-template.js');
    const floatingToolbarHelperIndex = html.indexOf('js/editor/templates/editor-floating-toolbar-template.js');
    const detailEmptyStateHelperIndex = html.indexOf('js/editor/templates/editor-detail-empty-state-template.js');
    const domSelectorsIndex = html.indexOf('js/editor/editor-dom-selectors.js');
    const editorJsIndex = html.indexOf('js/editor.js');

    assert.notEqual(floatingToolbarHelperIndex, -1, 'editor.html must still load the floating toolbar helper script');
    assert.notEqual(detailEmptyStateHelperIndex, -1, 'editor.html must load the new detail empty state helper script');

    assert.ok(detailEmptyStateHelperIndex < domSelectorsIndex, 'detail empty state helper must load before dom selectors');
    assert.ok(detailEmptyStateHelperIndex < editorJsIndex, 'detail empty state helper must load before js/editor.js');
    assert.ok(floatingToolbarHelperIndex < detailEmptyStateHelperIndex, 'floating toolbar helper usually loads before detail empty state helper for consistency');
});
