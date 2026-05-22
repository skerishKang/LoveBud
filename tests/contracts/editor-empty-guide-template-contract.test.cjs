const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('Empty Guide template helper exists and contains markup', () => {
    const helperPath = 'js/editor/templates/editor-empty-guide-template.js';
    assert.ok(fs.existsSync(helperPath), 'template helper file must exist');

    const helperCode = fs.readFileSync(helperPath, 'utf8');
    assert.ok(helperCode.includes('id="canvasEmptyGuide"'), 'must include empty guide root id');
    assert.ok(helperCode.includes('class="editor-canvas-empty-guide editor-canvas-empty-guide-hidden"'), 'must include root classes');
    assert.ok(helperCode.includes('id="canvasEmptyGuideIcon"'), 'must preserve icon');
    assert.ok(helperCode.includes('id="canvasEmptyGuideTitle"'), 'must preserve title');
    assert.ok(helperCode.includes('id="canvasEmptyYoutubeInput"'), 'must preserve youtube input');
    assert.ok(helperCode.includes('id="canvasEmptyStartBtn"'), 'must preserve start button');
    assert.ok(helperCode.includes('id="canvasEmptyTextStartBtn"'), 'must preserve text start button');
});

test('editor.html uses template mount and removes raw empty guide markup', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    // Should have the mount anchor
    assert.ok(html.includes('id="editorEmptyGuideTemplateMount"'), 'must have mount anchor');

    // Should not have the inner contents like canvasEmptyTextStartBtn in the raw HTML anymore
    assert.ok(!html.includes('id="canvasEmptyTextStartBtn"'), 'raw HTML should not contain empty guide inner contents');
});

test('editor.html loads template helper before editor runtime in correct order', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const addMemoryHelperIndex = html.indexOf('js/editor/templates/editor-add-memory-form-template.js');
    const sidebarHelperIndex = html.indexOf('js/editor/templates/editor-sidebar-template.js');
    const topbarHelperIndex = html.indexOf('js/editor/templates/editor-canvas-topbar-template.js');
    const emptyGuideHelperIndex = html.indexOf('js/editor/templates/editor-empty-guide-template.js');
    const domSelectorsIndex = html.indexOf('js/editor/editor-dom-selectors.js');
    const editorJsIndex = html.indexOf('js/editor.js');

    assert.notEqual(addMemoryHelperIndex, -1, 'editor.html must still load the add memory form helper');
    assert.notEqual(sidebarHelperIndex, -1, 'editor.html must still load the sidebar helper script');
    assert.notEqual(topbarHelperIndex, -1, 'editor.html must still load the canvas topbar helper script');
    assert.notEqual(emptyGuideHelperIndex, -1, 'editor.html must load the new empty guide helper script');

    assert.ok(emptyGuideHelperIndex < domSelectorsIndex, 'empty guide helper must load before dom selectors');
    assert.ok(emptyGuideHelperIndex < editorJsIndex, 'empty guide helper must load before js/editor.js');
    assert.ok(topbarHelperIndex < emptyGuideHelperIndex, 'topbar helper usually loads before empty guide helper for consistency');
});
