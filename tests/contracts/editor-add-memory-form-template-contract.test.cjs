const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Add Memory Form Modal template helper exists and contains markup', () => {
    const helperPath = 'js/editor/templates/editor-add-memory-form-template.js';
    assert.ok(fs.existsSync(helperPath), 'template helper file must exist');

    const helperCode = fs.readFileSync(helperPath, 'utf8');
    assert.ok(helperCode.includes('id="addMemoryForm"'), 'must include addMemoryForm wrapper');
    assert.ok(helperCode.includes('id="addMemoryFormEyebrow"'), 'must preserve key DOM IDs');
    assert.ok(helperCode.includes('id="memoryUrlInput"'), 'must preserve input elements');
    assert.ok(helperCode.includes('id="memoryTitleInput"'), 'must preserve title input');
    assert.ok(helperCode.includes('id="cancelAddMemory"'), 'must preserve action buttons');
});

test('editor.html uses template mount and removes raw markup', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // Should not have the raw form element wrapper directly in HTML text (unless it's the mount point itself)
    // Actually, checking for the mount point first
    assert.ok(html.includes('id="addMemoryFormTemplateMount"'), 'must have mount anchor');

    // Should not have the inner contents like addMemoryFormEyebrow in the raw HTML anymore
    assert.ok(!html.includes('id="addMemoryFormEyebrow"'), 'raw HTML should not contain form inner contents');
});

test('editor.html loads template helper before editor runtime', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const helperIndex = html.indexOf('js/editor/templates/editor-add-memory-form-template.js');
    assert.notEqual(helperIndex, -1, 'editor.html must load the new helper script');

    const editorJsIndex = html.indexOf('js/editor.js');
    const memoryFormJsIndex = html.indexOf('js/editor/editor-memory-form.js');

    assert.ok(helperIndex < editorJsIndex, 'helper must load before js/editor.js');
    assert.ok(helperIndex < memoryFormJsIndex, 'helper must load before editor-memory-form.js');
});
