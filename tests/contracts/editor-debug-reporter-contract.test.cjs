const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

test('editor shell helpers expose debug reporter factory', () => {
  assert.match(shellHelpersSource, /createEditorDebugReporter:\s*function/);
  assert.match(shellHelpersSource, /window\.LoveBudEditorDebug\s*=\s*window\.LoveBudEditorDebug\s*\|\|\s*\{\s*logs:\s*\[\],\s*errors:\s*\[\]\s*\}/);
  assert.match(shellHelpersSource, /debugState\.logs\.push\(entry\)/);
  assert.match(shellHelpersSource, /debugState\.errors\.push\(\{/);
});

test('debug reporter preserves console formats and test hooks', () => {
  assert.match(shellHelpersSource, /\[editor-main\]/);
  assert.match(shellHelpersSource, /ERROR:/);
  assert.match(shellHelpersSource, /opts\.debugState/);
  assert.match(shellHelpersSource, /opts\.consoleRef/);
  assert.match(shellHelpersSource, /opts\.now/);
});

test('editor delegates debug reporter setup through deps', () => {
  assert.match(editorSource, /deps\.createEditorDebugReporter/);
  assert.match(editorSource, /const createEditorDebugReporter\s*=/);
  assert.match(editorSource, /const\s*\{\s*log,\s*reportError\s*\}\s*=\s*createEditorDebugReporter\(\)/);
  assert.match(editorSource, /window\.LoveBudEditorDebug\s*=\s*window\.LoveBudEditorDebug\s*\|\|\s*\{\s*logs:\s*\[\],\s*errors:\s*\[\]\s*\}/);
});

test('editor no longer owns inline debug setup inside startEditor', () => {
  const start = editorSource.indexOf('const startEditor = async () => {');
  assert.notEqual(start, -1, 'startEditor must exist');

  const end = editorSource.indexOf("log('startEditor sequence initiated')", start);
  assert.notEqual(end, -1, 'startEditor initial log must remain');

  const block = editorSource.slice(start, end);
  assert.match(block, /createEditorDebugReporter\(\)/);
  assert.doesNotMatch(block, /const log\s*=\s*\(msg\)\s*=>/);
  assert.doesNotMatch(block, /const reportError\s*=\s*\(msg,\s*err\)\s*=>/);
});

test('waitForGlobal behavior remains in editor start flow', () => {
  assert.match(shellHelpersSource, /return async function waitForGlobal\(name\)/);
  assert.match(shellHelpersSource, /while\s*\(typeof windowRef\[name\] !== 'function' && count < maxAttempts\)/);
  assert.match(editorSource, /createEditorStartupDependencyWaiter\(\{/);
});

test('editor shell helpers load before editor entrypoint', () => {
  const helperIndex = editorHtml.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(helperIndex, -1, 'editor-shell-helpers.js must be loaded');
  assert.notEqual(editorIndex, -1, 'editor.js must be loaded');
  assert.ok(helperIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});
