const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const shellCanvasUISource = fs.readFileSync('js/editor/editor-shell-canvas-ui.js', 'utf8');

test('canvas ui fix editor shell helpers expose selected moment focus handler factory', () => {
  assert.match(shellCanvasUISource, /createSelectedMomentFocusHandler:\s*function\(options\)/);
  assert.match(shellCanvasUISource, /var getEditorCanvas\s*=\s*opts\.getEditorCanvas/);
  assert.match(shellCanvasUISource, /var getSelectedNodeId\s*=\s*opts\.getSelectedNodeId/);
  assert.match(shellCanvasUISource, /return function focusSelectedMoment\(\)/);
});

test('canvas ui fix selected moment focus helper preserves focusNodeById guard', () => {
  assert.match(shellCanvasUISource, /var editorCanvas\s*=\s*getEditorCanvas\(\)/);
  assert.match(shellCanvasUISource, /var selectedNodeId\s*=\s*getSelectedNodeId\(\)/);
  assert.match(shellCanvasUISource, /editorCanvas && typeof editorCanvas\.focusNodeById === 'function' && selectedNodeId/);
  assert.match(shellCanvasUISource, /editorCanvas\.focusNodeById\(selectedNodeId\)/);
});

test('editor delegates selected moment focus handler through required shell helper', () => {
  assert.match(editorSource, /const createSelectedMomentFocusHandler\s*=\s*deps\.createSelectedMomentFocusHandler/);
  assert.doesNotMatch(editorSource, /createSelectedMomentFocusHandler\s*=\s*deps\.createSelectedMomentFocusHandler\s*\|\|/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createSelectedMomentFocusHandler missing/);
  assert.match(editorSource, /const focusSelectedMoment\s*=\s*createSelectedMomentFocusHandler\(\{/);
  assert.match(editorSource, /getEditorCanvas:\s*\(\)\s*=>\s*editorCanvas/);
  assert.match(editorSource, /getSelectedNodeId:\s*\(\)\s*=>\s*selectedNodeId/);
});

test('editor no longer owns inline selected moment focus body near selectNode', () => {
  const start = editorSource.indexOf('const selectNode =');
  assert.notEqual(start, -1, 'selectNode must exist');

  const end = editorSource.indexOf('const openCurrentMomentDetail =', start);
  assert.notEqual(end, -1, 'openCurrentMomentDetail must follow selected focus setup');

  const block = editorSource.slice(start, end);
  assert.match(block, /createSelectedMomentFocusHandler\(\{/);
  assert.doesNotMatch(block, /const focusSelectedMoment\s*=\s*\(\)\s*=>\s*\{/);
  assert.doesNotMatch(block, /editorCanvas\.focusNodeById\(selectedNodeId\)/);
});

test('editor keeps focusSelectedMoment consumers intact', () => {
  assert.match(editorSource, /focusSelectedMoment/);
  assert.match(editorSource, /bindEditorPageEvents/);
  assert.match(editorSource, /openCurrentMomentDetail,\s*focusSelectedMoment/);
});

test('editor does not change canvas creation injection in this slice', () => {
  assert.match(editorSource, /window\.createEditorCanvas\(\{/);
  assert.match(editorSource, /onNodeClick:\s*selectNode/);
  assert.match(editorSource, /canEdit/);
});
