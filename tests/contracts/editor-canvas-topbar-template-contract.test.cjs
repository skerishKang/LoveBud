const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Canvas Topbar template helper exists and contains markup', () => {
    const helperPath = 'js/editor/templates/editor-canvas-topbar-template.js';
    assert.ok(fs.existsSync(helperPath), 'template helper file must exist');

    const helperCode = fs.readFileSync(helperPath, 'utf8');
    assert.ok(helperCode.includes('class="editor-canvas-topbar"'), 'must include topbar wrapper');
    assert.ok(helperCode.includes('id="zoomOutCanvasBtn"'), 'must preserve zoom out button');
    assert.ok(helperCode.includes('id="zoomInCanvasBtn"'), 'must preserve zoom in button');
    assert.ok(helperCode.includes('id="recenterCanvasBtn"'), 'must preserve recenter button');
    assert.ok(helperCode.includes('id="focusSelectedBtn"'), 'must preserve focus selected button');
    assert.ok(helperCode.includes('id="layoutModeToggleBtn"'), 'must preserve layout mode toggle button');
    assert.ok(helperCode.includes('id="compactModeToggleBtn"'), 'must preserve compact mode toggle button');
});

test('Canvas Topbar toggle buttons have correct baseline state', () => {
    const helperCode = fs.readFileSync('js/editor/templates/editor-canvas-topbar-template.js', 'utf8');

    // Layout toggle baseline
    // #3581: static first paint is structured-first (정리된 트리).
    assert.ok(
      helperCode.includes('id="layoutModeToggleBtn"') && helperCode.includes('aria-pressed="true"'),
      'layout toggle must start pressed for structured'
    );
    assert.ok(
      helperCode.includes('aria-label="현재 정리된 트리, 자유 배치로 전환"'),
      'layout toggle must describe current structured state and next free action'
    );
    assert.ok(
      helperCode.includes('title="현재 정리된 트리, 자유 배치로 전환"'),
      'layout toggle title must match aria-label'
    );
    assert.ok(
      helperCode.includes('id="layoutModeToggleLabel">정리된 트리</span>'),
      'layout toggle must start with "정리된 트리"'
    );
    assert.ok(helperCode.includes('account_tree'), 'structured icon must be account_tree');

    // Compact toggle baseline
    assert.ok(helperCode.includes('id="compactModeToggleBtn" aria-pressed="false"'), 'compact toggle must start as not pressed');
    assert.ok(helperCode.includes('aria-label="현재 상세 보기, 간략 보기로 전환"'), 'compact toggle must describe current state and next action');
    assert.ok(helperCode.includes('title="현재 상세 보기, 간략 보기로 전환"'), 'compact toggle title must match aria-label');
    assert.ok(helperCode.includes('id="compactModeToggleLabel">상세 보기</span>'), 'compact toggle must start with "상세 보기"');
});

test('Canvas Topbar compact display toggle has clear visible copy', () => {
    const helperCode = fs.readFileSync('js/editor/templates/editor-canvas-topbar-template.js', 'utf8');

    assert.ok(helperCode.includes('aria-label="표시 옵션"'), 'display option group must be clearly named');
    assert.ok(helperCode.includes('id="compactModeToggleLabel"'), 'compact toggle must expose a label element');
    assert.ok(helperCode.includes('>상세 보기</span>'), 'compact toggle must have visible text');
});

test('editor.html uses template mount and removes raw canvas topbar markup', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    assert.ok(html.includes('id="editorCanvasTopbarTemplateMount"'), 'must have mount anchor');
    assert.ok(!html.includes('id="layoutModeToggleBtn"'), 'page shell should not contain canvas topbar inner contents');
});

test('editor.html loads template helper before editor runtime in correct order', () => {
    const html = fs.readFileSync('pages/editor.html', 'utf8');

    const addMemoryHelperIndex = html.indexOf('js/editor/templates/editor-add-memory-form-template.js');
    const sidebarHelperIndex = html.indexOf('js/editor/templates/editor-sidebar-template.js');
    const topbarHelperIndex = html.indexOf('js/editor/templates/editor-canvas-topbar-template.js');
    const domSelectorsIndex = html.indexOf('js/editor/editor-dom-selectors.js');
    const editorJsIndex = html.indexOf('js/editor.js');

    assert.notEqual(addMemoryHelperIndex, -1, 'editor.html must still load the add memory form helper');
    assert.notEqual(sidebarHelperIndex, -1, 'editor.html must still load the sidebar helper script');
    assert.notEqual(topbarHelperIndex, -1, 'editor.html must load the new canvas topbar helper script');

    assert.ok(topbarHelperIndex < domSelectorsIndex, 'topbar helper must load before dom selectors');
    assert.ok(topbarHelperIndex < editorJsIndex, 'topbar helper must load before js/editor.js');
    assert.ok(sidebarHelperIndex < topbarHelperIndex, 'sidebar helper usually loads before topbar helper for consistency');
});
