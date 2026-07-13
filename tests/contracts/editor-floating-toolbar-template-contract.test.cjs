const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('Floating Toolbar template helper exists and contains markup', () => {
    const helperPath = 'js/editor/templates/editor-floating-toolbar-template.js';
    assert.ok(fs.existsSync(helperPath), 'template helper file must exist');

    const helperCode = fs.readFileSync(helperPath, 'utf8');
    assert.ok(helperCode.includes('id="editorFloatingToolbar"'), 'must include floating toolbar root id');
    assert.ok(helperCode.includes('id="ftbDropdown"'), 'must include dropdown id');
    assert.ok(helperCode.includes('id="ftbTooltip"'), 'must include tooltip id');
    assert.ok(helperCode.includes('id="ftbQuickAdd"'), 'must include quick add id');
    
    assert.ok(helperCode.includes('id="ftbEditBtn"'), 'must preserve edit button');
    assert.ok(helperCode.includes('id="ftbDeleteAction"'), 'must preserve delete action');
    assert.ok(helperCode.includes('data-action="delete"'), 'must preserve delete data-action');
    assert.ok(helperCode.includes('data-action="share"'), 'must preserve share data-action');
    assert.ok(helperCode.includes('data-action="focus"'), 'must preserve focus data-action');
    
    assert.ok(helperCode.includes('class="editor-floating-toolbar'), 'must include floating toolbar root classes');
    assert.ok(helperCode.includes('class="editor-floating-quick-add'), 'must include quick add classes');
});

test('Floating Toolbar branch controls stay out of the default action row', () => {
    const helperCode = fs.readFileSync('js/editor/templates/editor-floating-toolbar-template.js', 'utf8');

    assert.ok(helperCode.includes('id="ftbMoreBtn"'), 'more menu must remain the intentional overflow affordance');
    assert.ok(helperCode.includes('id="ftbBranchBtn"'), 'branch button must remain available for deliberate flows');
    assert.ok(helperCode.includes('id="ftbForkBtn"'), 'fork button must remain available for deliberate flows');
    assert.ok(helperCode.includes('class="editor-ftb-dropdown-item" id="ftbBranchBtn"'), 'branch button must be scoped as an overflow dropdown action');
    assert.ok(helperCode.includes('class="editor-ftb-dropdown-item" id="ftbForkBtn"'), 'fork button must be scoped as an overflow dropdown action');

    const dropdownIdx = helperCode.indexOf('id="ftbDropdown"');
    assert.ok(dropdownIdx !== -1, 'overflow dropdown container must exist');
    assert.ok(helperCode.indexOf('id="ftbBranchBtn"') > dropdownIdx, 'branch button must live inside the overflow dropdown, out of the default action row');
    assert.ok(helperCode.indexOf('id="ftbForkBtn"') > dropdownIdx, 'fork button must live inside the overflow dropdown, out of the default action row');
    assert.ok(helperCode.includes('id="ftbForkBtn" role="menuitem" aria-label="분기하기" aria-hidden="true" tabindex="-1" hidden style="display:none;"'), 'fork button must stay hidden by default');
});

test('editor.html uses template mount and removes raw floating toolbar markup', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // Should have the mount anchor
    assert.ok(html.includes('id="editorFloatingToolbarTemplateMount"'), 'must have mount anchor');

    // Should not have the inner contents like ftbEditBtn in the raw HTML anymore
    assert.ok(!html.includes('id="ftbEditBtn"'), 'raw HTML should not contain floating toolbar inner contents');
    assert.ok(!html.includes('id="ftbDropdown"'), 'raw HTML should not contain floating toolbar dropdown');
});

test('editor.html loads template helper before editor runtime in correct order', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const addMemoryHelperIndex = html.indexOf('js/editor/templates/editor-add-memory-form-template.js');
    const sidebarHelperIndex = html.indexOf('js/editor/templates/editor-sidebar-template.js');
    const topbarHelperIndex = html.indexOf('js/editor/templates/editor-canvas-topbar-template.js');
    const emptyGuideHelperIndex = html.indexOf('js/editor/templates/editor-empty-guide-template.js');
    const floatingToolbarHelperIndex = html.indexOf('js/editor/templates/editor-floating-toolbar-template.js');
    const domSelectorsIndex = html.indexOf('js/editor/editor-dom-selectors.js');
    const editorJsIndex = html.indexOf('js/editor.js');

    assert.notEqual(emptyGuideHelperIndex, -1, 'editor.html must still load the empty guide helper script');
    assert.notEqual(floatingToolbarHelperIndex, -1, 'editor.html must load the new floating toolbar helper script');

    assert.ok(floatingToolbarHelperIndex < domSelectorsIndex, 'floating toolbar helper must load before dom selectors');
    assert.ok(floatingToolbarHelperIndex < editorJsIndex, 'floating toolbar helper must load before js/editor.js');
    assert.ok(emptyGuideHelperIndex < floatingToolbarHelperIndex, 'empty guide helper usually loads before floating toolbar helper for consistency');
});
