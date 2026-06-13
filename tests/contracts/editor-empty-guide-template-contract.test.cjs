const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('Empty Guide template helper exists and contains primary-only CTA markup (PR #2449)', () => {
    const helperPath = 'js/editor/templates/editor-empty-guide-template.js';
    assert.ok(fs.existsSync(helperPath), 'template helper file must exist');

    const helperCode = fs.readFileSync(helperPath, 'utf8');
    assert.ok(helperCode.includes('id="canvasEmptyGuide"'), 'must include empty guide root id');
    assert.ok(helperCode.includes('class="editor-canvas-empty-guide editor-canvas-empty-guide-hidden"'), 'must include root classes');
    assert.ok(!helperCode.includes('id="canvasEmptyGuideIcon"'), 'must remove the decorative sprout icon');
    assert.ok(helperCode.includes('id="canvasEmptyGuideTitle"'), 'must preserve title id');
    assert.ok(helperCode.includes('이 트리의 첫 순간을 기록해볼까요?'), 'must include updated title copy');
    assert.ok(helperCode.includes('영상 링크나 텍스트는 다음 단계에서 선택할 수 있어요.'),
        'must include PR #2449 description copy (next-step selection)');
    // primary CTA only (PR #2449 simplify)
    assert.ok(helperCode.includes('id="canvasEmptyStartBtn"'), 'must include primary start button id');
    assert.ok(helperCode.includes('첫 순간 만들기'), 'must include primary CTA copy "첫 순간 만들기"');
    assert.ok(helperCode.includes('editor-canvas-empty-guide__primary-cta'),
        'must include primary CTA class for styling');
    // direct crowded controls removed (PR #2449)
    assert.ok(!helperCode.includes('id="canvasEmptyVideoBtn"'),
        'must remove direct video start button from first visible card');
    assert.ok(!helperCode.includes('id="canvasEmptyTextBtn"'),
        'must remove direct text start button from first visible card');
    assert.ok(!helperCode.includes('id="canvasEmptyQuickInput"'),
        'must remove direct YouTube quick input from first visible card');
    assert.ok(!helperCode.includes('체계적으로 입력하기'),
        'must remove crowded section heading');
    assert.ok(!helperCode.includes('빠르게 바로 시작하기'),
        'must remove crowded section heading');
    assert.ok(!helperCode.includes('YouTube 링크 붙여넣기'),
        'must remove direct YouTube paste placeholder');
});

test('editor.html uses template mount and removes raw empty guide markup', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    assert.ok(html.includes('id="editorEmptyGuideTemplateMount"'), 'must have mount anchor');
    assert.ok(!html.includes('id="canvasEmptyVideoBtn"'), 'raw HTML should not contain empty guide inner contents');
    assert.ok(!html.includes('id="canvasEmptyTextBtn"'), 'raw HTML should not contain empty guide inner contents');
    assert.ok(!html.includes('id="canvasEmptyQuickInput"'), 'raw HTML should not contain empty guide inner contents');
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
    assert.notEqual(emptyGuideHelperIndex, -1, 'editor.html must load the empty guide helper script');

    assert.ok(emptyGuideHelperIndex < domSelectorsIndex, 'empty guide helper must load before dom selectors');
    assert.ok(emptyGuideHelperIndex < editorJsIndex, 'empty guide helper must load before js/editor.js');
    assert.ok(topbarHelperIndex < emptyGuideHelperIndex, 'topbar helper usually loads before empty guide helper for consistency');
});
