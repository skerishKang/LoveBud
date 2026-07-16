const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Sidebar template helper exists and contains markup', () => {
    const helperPath = 'js/editor/templates/editor-sidebar-template.js';
    assert.ok(fs.existsSync(helperPath), 'template helper file must exist');

    const helperCode = fs.readFileSync(helperPath, 'utf8');
    assert.ok(helperCode.includes('class="sidebar reveal-fade"'), 'must include sidebar wrapper');
    assert.ok(helperCode.includes('id="editorFlowHeading"'), 'must preserve key DOM IDs');
    assert.ok(helperCode.includes('id="renameTreeBtn"'), 'must preserve rename button');
    assert.ok(helperCode.includes('class="editor-status-section'), 'must preserve status section class');
    assert.ok(helperCode.includes('id="addMemoryBtn"'), 'must preserve add button');
    // #3562: left rail consumes shared tree-scope builder (not hard-coded markup)
    assert.ok(helperCode.includes('buildTreeScopeShellHtml'), 'must call shared tree-scope builder');
    assert.ok(helperCode.includes('LoveBudCanonicalAppreciationDetailPresentation'), 'must use shared presentation builder');
});

test('editor.html uses template mount and removes raw sidebar markup', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // Should have the mount anchor
    assert.ok(html.includes('id="editorSidebarTemplateMount"'), 'must have mount anchor');

    // Should not have the inner contents like renameTreeBtn in the raw HTML anymore
    assert.ok(!html.includes('id="renameTreeBtn"'), 'raw HTML should not contain sidebar inner contents');
});

test('editor.html loads template helper before editor runtime in correct order', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const addMemoryHelperIndex = html.indexOf('js/editor/templates/editor-add-memory-form-template.js');
    const sidebarHelperIndex = html.indexOf('js/editor/templates/editor-sidebar-template.js');
    const domSelectorsIndex = html.indexOf('js/editor/editor-dom-selectors.js');
    const editorJsIndex = html.indexOf('js/editor.js');

    assert.notEqual(addMemoryHelperIndex, -1, 'editor.html must still load the add memory form helper');
    assert.notEqual(sidebarHelperIndex, -1, 'editor.html must load the new sidebar helper script');

    assert.ok(sidebarHelperIndex < domSelectorsIndex, 'sidebar helper must load before dom selectors');
    assert.ok(sidebarHelperIndex < editorJsIndex, 'sidebar helper must load before js/editor.js');
    assert.ok(addMemoryHelperIndex < sidebarHelperIndex, 'add memory helper usually loads before sidebar helper for consistency');
});
