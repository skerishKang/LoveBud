const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('editor-dom-refs-builder.js exists and exposes correct namespace', () => {
    const js = fs.readFileSync('js/editor/editor-dom-refs-builder.js', 'utf8');

    assert.ok(js.includes('window.LoveBudEditorDomRefsBuilder = {'), 'must expose namespace');
    assert.ok(js.includes('createEditorDomRefs'), 'must contain createEditorDomRefs');
    assert.ok(js.includes('createEditorFormRefs'), 'must contain createEditorFormRefs');
    
    // Check DOM id markers for createEditorDomRefs
    assert.ok(js.includes("canvasArea"), 'must retain canvasArea id');
    assert.ok(js.includes("canvasSvg"), 'must retain canvasSvg id');
    assert.ok(js.includes("detailPanel"), 'must retain detailPanel id');
    assert.ok(js.includes("addMemoryBtn"), 'must retain addMemoryBtn id');

    // Check DOM id markers for createEditorFormRefs
    assert.ok(js.includes("memoryUrlInput"), 'must retain memoryUrlInput id');
    assert.ok(js.includes("memoryTitleInput"), 'must retain memoryTitleInput id');
    assert.ok(js.includes("memoryMemoInput"), 'must retain memoryMemoInput id');
    assert.ok(js.includes("cancelAddMemory"), 'must retain cancelAddMemory id');
    assert.ok(js.includes("confirmAddMemory"), 'must retain confirmAddMemory id');
});

test('editor.html loads editor-dom-refs-builder.js before editor.js', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const builderIndex = html.indexOf('js/editor/editor-dom-refs-builder.js');
    const editorJsIndex = html.indexOf('js/editor.js');

    assert.notEqual(builderIndex, -1, 'builder script must be loaded');
    assert.notEqual(editorJsIndex, -1, 'editor.js must be loaded');
    assert.ok(builderIndex < editorJsIndex, 'builder must load before editor.js');
});
