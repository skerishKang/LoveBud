const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');

test('editor shell helpers expose sidebar tree actions updater factory', () => {
  assert.match(shellHelpersSource, /createSidebarTreeActionsUpdater:\s*function\(options\)/);
  assert.match(shellHelpersSource, /var sidebarUIHelper\s*=\s*opts\.sidebarUIHelper\s*\|\|\s*\{\}/);
  assert.match(shellHelpersSource, /var i18n\s*=\s*opts\.i18n/);
  assert.match(shellHelpersSource, /var safeI18nText\s*=\s*opts\.safeI18nText/);
  assert.match(shellHelpersSource, /var getTreeId\s*=\s*opts\.getTreeId/);
  assert.match(shellHelpersSource, /return function updateSidebarTreeActions\(\)/);
});

test('sidebar tree actions updater preserves guarded call and payload', () => {
  assert.match(shellHelpersSource, /if \(sidebarUIHelper\.updateSidebarTreeActions\)/);
  assert.match(shellHelpersSource, /sidebarUIHelper\.updateSidebarTreeActions\(\{/);
  assert.match(shellHelpersSource, /i18n:\s*i18n/);
  assert.match(shellHelpersSource, /safeI18nText:\s*safeI18nText/);
  assert.match(shellHelpersSource, /getTreeId:\s*getTreeId/);
});

test('editor delegates sidebar tree actions updater with fallback', () => {
  assert.match(editorSource, /shellHelpers\.createSidebarTreeActionsUpdater/);
  assert.match(editorSource, /const createSidebarTreeActionsUpdater\s*=/);
  assert.match(editorSource, /const updateSidebarTreeActions\s*=\s*createSidebarTreeActionsUpdater\(\{/);
  assert.match(editorSource, /sidebarUIHelper,\s*i18n,\s*safeI18nText/);
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
