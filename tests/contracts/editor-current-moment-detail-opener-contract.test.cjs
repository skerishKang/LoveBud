const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');

test('editor shell helpers expose current moment detail opener factory', () => {
  assert.match(shellHelpersSource, /createCurrentMomentDetailOpener:\s*function\(options\)/);
  assert.match(shellHelpersSource, /var getCurrentEditingMemory\s*=\s*opts\.getCurrentEditingMemory/);
  assert.match(shellHelpersSource, /var getTreeMemories\s*=\s*opts\.getTreeMemories/);
  assert.match(shellHelpersSource, /var getSelectedNodeId\s*=\s*opts\.getSelectedNodeId/);
  assert.match(shellHelpersSource, /var createInitialMemory\s*=\s*opts\.createInitialMemory/);
  assert.match(shellHelpersSource, /var getTreeId\s*=\s*opts\.getTreeId/);
  assert.match(shellHelpersSource, /return function openCurrentMomentDetail\(\)/);
});

test('current moment detail opener preserves active memory fallback order', () => {
  const start = shellHelpersSource.indexOf('createCurrentMomentDetailOpener');
  assert.notEqual(start, -1, 'factory must exist');

  const end = shellHelpersSource.lastIndexOf('};');
  assert.notEqual(end, -1, 'factory must end');

  const block = shellHelpersSource.slice(start, end);
  const currentIndex = block.indexOf('getCurrentEditingMemory()');
  const findIndex = block.indexOf('treeMemories.find');
  const initialIndex = block.indexOf('createInitialMemory()');

  assert.ok(currentIndex !== -1, 'current editing memory fallback must exist');
  assert.ok(findIndex !== -1, 'selected tree memory lookup must exist');
  assert.ok(initialIndex !== -1, 'initial memory fallback must exist');
  assert.ok(currentIndex < findIndex, 'current editing memory must be checked first');
  assert.ok(findIndex < initialIndex, 'tree memory lookup must be checked before initial fallback');
});

test('current moment detail opener preserves guards and payload', () => {
  assert.match(shellHelpersSource, /if \(!activeMemory \|\| !activeMemory\.id \|\| !treeId\) return/);
  assert.match(shellHelpersSource, /typeof editorPageHelpers\.openMomentDetail === 'function'/);
  assert.match(shellHelpersSource, /memoryId:\s*activeMemory\.id/);
  assert.match(shellHelpersSource, /treeId:\s*treeId/);
  assert.match(shellHelpersSource, /getEditorBasePath:\s*getEditorBasePath/);
  assert.match(shellHelpersSource, /locationRef:\s*locationRef/);
  assert.match(shellHelpersSource, /reportError\('LoveBudEditorPageHelpers\.openMomentDetail missing'\)/);
});

test('editor delegates current moment detail opener with fallback', () => {
  assert.match(editorSource, /shellHelpers\.createCurrentMomentDetailOpener/);
  assert.match(editorSource, /const createCurrentMomentDetailOpener\s*=/);
  assert.match(editorSource, /const openCurrentMomentDetail\s*=\s*createCurrentMomentDetailOpener\(\{/);
  assert.match(editorSource, /getCurrentEditingMemory:\s*\(\)\s*=>\s*currentEditingMemory/);
  assert.match(editorSource, /getTreeMemories:\s*\(\)\s*=>\s*treeMemories\(\)/);
  assert.match(editorSource, /getSelectedNodeId:\s*\(\)\s*=>\s*selectedNodeId/);
  assert.match(editorSource, /getTreeId:\s*\(\)\s*=>\s*treeId/);
  assert.match(editorSource, /locationRef:\s*window\.location/);
});

test('editor no longer owns inline current moment detail opener body', () => {
  const start = editorSource.indexOf('const openCurrentMomentDetail =');
  assert.notEqual(start, -1, 'openCurrentMomentDetail must exist');

  const end = editorSource.indexOf('const updateTreeVisibility =', start);
  assert.notEqual(end, -1, 'updateTreeVisibility must follow openCurrentMomentDetail');

  const block = editorSource.slice(start, end);
  assert.match(block, /createCurrentMomentDetailOpener\(\{/);
  assert.doesNotMatch(block, /currentEditingMemory \|\| treeMemories\(\)\.find/);
  assert.doesNotMatch(block, /editorPageHelpers\.openMomentDetail\(\{/);
});

test('editor keeps detail UI openCurrentMomentDetail injection intact', () => {
  assert.match(editorSource, /window\.createEditorDetailUI\(\{/);
  assert.match(editorSource, /openCurrentMomentDetail/);
  assert.match(editorSource, /focusSelectedMoment/);
});

test('editor keeps updateTreeVisibility boundary after detail opener', () => {
  assert.match(editorSource, /const updateTreeVisibility\s*=\s*async\s*\(nextVisibility\)\s*=>/);
  assert.match(editorSource, /window\.apiClient\.updateTree/);
});
