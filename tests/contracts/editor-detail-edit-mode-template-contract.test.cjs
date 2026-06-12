const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('Detail Edit Mode template helper exists and contains markup', () => {
    const helperPath = 'js/editor/templates/editor-detail-edit-mode-template.js';
    assert.ok(fs.existsSync(helperPath), 'template helper file must exist');

    const helperCode = fs.readFileSync(helperPath, 'utf8');
    assert.ok(helperCode.includes('id="detailEditMode"'), 'must include detail edit mode root id');
    assert.ok(helperCode.includes('id="editTitleLabel"'), 'must include title label id');
    assert.ok(helperCode.includes('id="editTitleInput"'), 'must include title input id');
    assert.ok(helperCode.includes('id="editMemoLabel"'), 'must include memo label id');
    assert.ok(helperCode.includes('id="editMemoInput"'), 'must include memo input id');
    assert.ok(helperCode.includes('id="editTagsLabel"'), 'must include tags label id');
    assert.ok(helperCode.includes('id="editTagsInput"'), 'must include tags input id');
    assert.ok(helperCode.includes('id="cancelEditBtn"'), 'must include cancel btn id');
    assert.ok(helperCode.includes('id="saveEditBtn"'), 'must include save btn id');
    assert.ok(helperCode.includes('id="deleteMemoryBtn"'), 'must include delete btn id');

    assert.ok(helperCode.includes('editor-hidden-initial'), 'must include editor-hidden-initial class');
    assert.match(helperCode, /id="detailEditMode"[^>]*style="display:\s*none;"/, 'detail edit mode root must be initially hidden');
    assert.ok(helperCode.includes('editor-form-stack'), 'must include editor-form-stack class');
    assert.ok(helperCode.includes('editor-form-input'), 'must include editor-form-input class');
    assert.ok(helperCode.includes('editor-form-textarea'), 'must include editor-form-textarea class');
    assert.ok(helperCode.includes('editor-form-actions'), 'must include editor-form-actions class');
    assert.ok(helperCode.includes('editor-delete-link'), 'must include editor-delete-link class');
    
    assert.ok(helperCode.includes('margin-top: 12px;'), 'must preserve inline margins');
    assert.ok(helperCode.includes('rows="4"'), 'must preserve textarea rows');

    assert.ok(helperCode.includes('editorDetailEditModeTemplateMount'), 'must find mount element');
});

test('editor.html uses template mount and removes raw detail edit mode markup', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // Should have the shell mount anchor (inner mounts are inside the shell helper)
    // assert.ok(html.includes('id="editorDetailEditModeTemplateMount"'), 'must have mount anchor');

    // Should not have the inner contents like editTitleInput in the raw HTML anymore
    assert.ok(!html.includes('id="editTitleInput"'), 'raw HTML should not contain edit title input');
    assert.ok(!html.includes('id="saveEditBtn"'), 'raw HTML should not contain save edit btn');
    assert.ok(!html.includes('id="deleteMemoryBtn"'), 'raw HTML should not contain delete btn');
    assert.ok(!html.includes('id="detailEditMode"'), 'raw HTML should not contain detail edit mode wrapper directly');
});

test('editor.html loads template helper before editor runtime in correct order', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const detailViewModeHelperIndex = html.indexOf('js/editor/templates/editor-detail-view-mode-template.js');
    const detailEditModeHelperIndex = html.indexOf('js/editor/templates/editor-detail-edit-mode-template.js');
    const domSelectorsIndex = html.indexOf('js/editor/editor-dom-selectors.js');
    const editorJsIndex = html.indexOf('js/editor.js');

    assert.notEqual(detailViewModeHelperIndex, -1, 'editor.html must still load the detail view mode helper script');
    assert.notEqual(detailEditModeHelperIndex, -1, 'editor.html must load the new detail edit mode helper script');

    assert.ok(detailEditModeHelperIndex < domSelectorsIndex, 'detail edit mode helper must load before dom selectors');
    assert.ok(detailEditModeHelperIndex < editorJsIndex, 'detail edit mode helper must load before js/editor.js');
    assert.ok(detailViewModeHelperIndex < detailEditModeHelperIndex, 'detail view mode helper usually loads before detail edit mode helper for consistency');
});
