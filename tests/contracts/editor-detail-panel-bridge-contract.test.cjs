const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

test('editor shell helpers expose detail panel bridge helper', () => {
  assert.match(shellHelpersSource, /exposeDetailPanelUpdater:\s*function\(options\)/);
  assert.match(shellHelpersSource, /var windowRef\s*=\s*opts\.windowRef\s*\|\|\s*window/);
  assert.match(shellHelpersSource, /windowRef\.updateDetailPanel\s*=\s*updateDetailPanel/);
  assert.match(shellHelpersSource, /return windowRef/);
});

test('detail panel bridge helper keeps testable window hook', () => {
  assert.match(shellHelpersSource, /opts\.windowRef/);
  assert.match(shellHelpersSource, /opts\.updateDetailPanel/);
});

test('editor delegates detail panel bridge through required shell helper', () => {
    assert.match(
      editorSource,
      /const\s+exposeDetailPanelUpdater\s*=\s*shellHelpers\.exposeDetailPanelUpdater/
    );
    assert.doesNotMatch(
      editorSource,
      /const\s+exposeDetailPanelUpdater\s*=\s*shellHelpers\.exposeDetailPanelUpdater\s*\|\|/
    );
    assert.match(
      editorSource,
      /LoveBudEditorShellHelpers\.exposeDetailPanelUpdater missing/
    );
    assert.match(
      editorSource,
      /exposeDetailPanelUpdater\(\{\s*updateDetailPanel\s*\}\)/
    );
  });

test('editor no longer assigns detail panel bridge inline', () => {
    const start = editorSource.indexOf('const { setDetailEmptyState, updateFocusSelectedBtn');
    assert.notEqual(start, -1, 'detailUI destructuring must exist');

    const end = editorSource.indexOf('const sidebarUIHelper =', start);
    assert.notEqual(end, -1, 'sidebar helper setup must follow detail bridge setup');

    const block = editorSource.slice(start, end);
    assert.match(block, /exposeDetailPanelUpdater\(\{\s*updateDetailPanel\s*\}/);
    assert.doesNotMatch(block, /window\.updateDetailPanel\s*=\s*updateDetailPanel/);
    assert.doesNotMatch(block, /windowRef\.updateDetailPanel\s*=/);
  });

test('editor guards missing detail panel bridge before exposure', () => {
    const guardIndex = editorSource.indexOf('LoveBudEditorShellHelpers.exposeDetailPanelUpdater missing');
    const exposeIndex = editorSource.indexOf('exposeDetailPanelUpdater({ updateDetailPanel });');

    assert.ok(guardIndex !== -1, 'missing detail panel bridge guard must exist');
    assert.ok(exposeIndex !== -1, 'detail panel bridge exposure must exist');
    assert.ok(guardIndex < exposeIndex, 'guard must run before detail panel bridge exposure');
  });

test('editor keeps detail panel destructuring and canvas injection intact', () => {
  assert.match(
    editorSource,
    /const \{\s*setDetailEmptyState,\s*updateFocusSelectedBtn,\s*updateSidebarStatus:\s*updateSidebarStatusBase,\s*updateDetailPanel\s*\}\s*=\s*detailUI/
  );
  assert.match(editorSource, /window\.createEditorCanvas\(\{/);
  assert.match(editorSource, /updateDetailPanel,\s*setDetailEmptyState/);
});

test('editor does not change canvas empty guide bridge in this slice', () => {
  assert.match(editorSource, /exposeCanvasEmptyGuideUpdater\(\{\s*updateCanvasEmptyGuide\s*\}\)/);
});

test('editor shell helpers load before editor entrypoint', () => {
  const helperIndex = editorHtml.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(helperIndex, -1, 'editor-shell-helpers.js must be loaded');
  assert.notEqual(editorIndex, -1, 'editor.js must be loaded');
  assert.ok(helperIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});
