const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const initSource = fs.readFileSync('js/viewer/public-canvas-init.js', 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const startupContextSource = fs.readFileSync('js/editor/editor-startup-context.js', 'utf8');

test('public-canvas-init uses LoveBudTreeWorkspacePermission for owner edit gate', () => {
  assert.match(initSource, /LoveBudTreeWorkspacePermission/);
  assert.match(initSource, /resolveTreeWorkspaceCanEdit/);
  assert.match(initSource, /if \(canEdit\)/);
});

test('public-canvas-init owner edit button passes memoryId and mode=edit', () => {
  assert.match(initSource, /mode=edit/);
  assert.match(initSource, /memoryId/);
  assert.match(initSource, /getSelectedNodeId/);
});

test('public-canvas-init owner edit URL no longer contains legacy from=view only param', () => {
  assert.doesNotMatch(initSource, /from=view/);
});

test('editor-startup-context exposes mode and memoryId from URL params', () => {
  assert.match(startupContextSource, /params\.get\('mode'\)/);
  assert.match(startupContextSource, /params\.get\('memoryId'\)/);
  assert.match(startupContextSource, /mode:/);
  assert.match(startupContextSource, /memoryId:/);
});

test('editor.js applies mode=edit from URL when canEdit is true', () => {
  assert.match(editorSource, /mode === 'edit'/);
  assert.match(editorSource, /LoveBudEditorInteractionMode\.setMode/);
  assert.match(editorSource, /LoveBudEditorInteractionMode\.MODE_EDIT/);
});

test('editor.js validates memoryId against loaded memories before applying selection', () => {
  assert.match(editorSource, /memoryId/);
  assert.match(editorSource, /\.find/);
  assert.match(editorSource, /m\.id === memoryId/);
});

test('editor.js mode=edit gate respects effectiveCanEdit', () => {
  assert.match(editorSource, /effectiveCanEdit\b/);
});
