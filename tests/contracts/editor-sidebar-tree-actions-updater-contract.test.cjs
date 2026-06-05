const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const shellCanvasUISource = fs.readFileSync('js/editor/editor-shell-canvas-ui.js', 'utf8');

test('canvas ui fix editor shell helpers expose sidebar tree actions updater factory', () => {
  assert.match(shellCanvasUISource, /createSidebarTreeActionsUpdater:\s*function\(options\)/);
  assert.match(shellCanvasUISource, /var sidebarUIHelper\s*=\s*opts\.sidebarUIHelper\s*\|\|\s*\{\}/);
  assert.match(shellCanvasUISource, /var i18n\s*=\s*opts\.i18n/);
  assert.match(shellCanvasUISource, /var safeI18nText\s*=\s*opts\.safeI18nText/);
  assert.match(shellCanvasUISource, /var getTreeId\s*=\s*opts\.getTreeId/);
  assert.match(shellCanvasUISource, /return function updateSidebarTreeActions\(\)/);
});

test('canvas ui fix sidebar tree actions updater preserves guarded call and payload', () => {
  assert.match(shellCanvasUISource, /if \(sidebarUIHelper\.updateSidebarTreeActions\)/);
  assert.match(shellCanvasUISource, /sidebarUIHelper\.updateSidebarTreeActions\({/);
  assert.match(shellCanvasUISource, /i18n:\s*i18n/);
  assert.match(shellCanvasUISource, /safeI18nText:\s*safeI18nText/);
  assert.match(shellCanvasUISource, /getTreeId:\s*getTreeId/);
});

test('editor delegates sidebar tree actions updater with fallback', () => {
  assert.match(editorSource, /deps\.createSidebarTreeActionsUpdater/);
  assert.match(editorSource, /const createSidebarTreeActionsUpdater\s*=/);
  assert.match(editorSource, /const updateSidebarTreeActions\s*=\s*createSidebarTreeActionsUpdater\(\{/);
  assert.match(editorSource, /sidebarUIHelper,\s*i18n:\s*deps\.i18n,\s*safeI18nText:\s*deps\.safeI18nText/);
  assert.match(editorSource, /getTreeId:\s*\(\)\s*=>\s*treeId/);
});

test('editor no longer owns inline sidebar tree actions wrapper', () => {
  const start = editorSource.indexOf('const sidebarUIHelper = window.LoveBudEditorSidebarUI || {};');
  assert.notEqual(start, -1, 'sidebarUIHelper setup must exist');

  const end = editorSource.indexOf('const updateSidebarStatus =', start);
  assert.notEqual(end, -1, 'updateSidebarStatus must follow sidebar tree actions setup');

  const block = editorSource.slice(start, end);
  assert.match(block, /createSidebarTreeActionsUpdater\(\{/);
  assert.doesNotMatch(block, /const updateSidebarTreeActions\s*=\s*\(\)\s*=>\s*\{/);
  assert.doesNotMatch(block, /sidebarUIHelper\.updateSidebarTreeActions\(\{\s*i18n,\s*safeI18nText,\s*getTreeId:\s*\(\)\s*=>\s*treeId\s*\}\)/);
});

test('editor keeps updateSidebarStatus orchestration intact via factory delegation', () => {
  const start = editorSource.indexOf('const updateSidebarStatus =');
  assert.notEqual(start, -1, 'updateSidebarStatus must exist');

  const end = editorSource.indexOf("log('Creating Editor Canvas Instance...')", start);
  assert.notEqual(end, -1, 'canvas creation log must follow sidebar status setup');

  const block = editorSource.slice(start, end);
  assert.match(block, /createEditorSidebarStatusUpdater\(/);
  assert.match(block, /updateSidebarStatusBase,\s*updateCanvasEmptyGuide,\s*updateSidebarTreeActions/);
});

test('editor keeps sidebar visibility binding injection intact', () => {
  assert.match(editorSource, /bindEditorPageEvents\s*\(\{/);
  assert.match(editorSource, /getTreeId:\s*\(\)\s*=>\s*treeId/);
  assert.match(editorSource, /updateTreeVisibility/);
  assert.match(editorSource, /updateSidebarStatus/);
});
