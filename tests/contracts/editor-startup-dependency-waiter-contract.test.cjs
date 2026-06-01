const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

test('editor shell helpers expose startup dependency waiter factory', () => {
  assert.match(shellHelpersSource, /createEditorStartupDependencyWaiter:\s*function/);
  assert.match(shellHelpersSource, /return async function waitForGlobal\(name\)/);
});

test('startup dependency waiter preserves default timing and messages', () => {
  assert.match(shellHelpersSource, /var maxAttempts\s*=\s*opts\.maxAttempts\s*\|\|\s*100/);
  assert.match(shellHelpersSource, /var intervalMs\s*=\s*opts\.intervalMs\s*\|\|\s*50/);
  assert.match(shellHelpersSource, /log\('Waiting for '\s*\+\s*name\s*\+\s*'\.\.\.'\)/);
  assert.match(shellHelpersSource, /reportError\(name\s*\+\s*' not found after 5s'\)/);
  assert.match(shellHelpersSource, /log\(name\s*\+\s*' found\.'\)/);
});

test('startup dependency waiter keeps testable hooks', () => {
  assert.match(shellHelpersSource, /opts\.log/);
  assert.match(shellHelpersSource, /opts\.reportError/);
  assert.match(shellHelpersSource, /opts\.windowRef/);
  assert.match(shellHelpersSource, /opts\.wait/);
  assert.match(shellHelpersSource, /opts\.maxAttempts/);
  assert.match(shellHelpersSource, /opts\.intervalMs/);
});

test('editor delegates startup dependency waiter with fallback', () => {
  assert.match(editorSource, /shellHelpers\.createEditorStartupDependencyWaiter/);
  assert.match(editorSource, /const createEditorStartupDependencyWaiter\s*=/);
  assert.match(editorSource, /const waitForGlobal\s*=\s*createEditorStartupDependencyWaiter\(\{\s*log,\s*reportError\s*\}\)/);
});

test('editor no longer owns inline startup dependency waiter inside startEditor', () => {
  const start = editorSource.indexOf('const startEditor = async () => {');
  assert.notEqual(start, -1, 'startEditor must exist');

  const end = editorSource.indexOf("if (!await waitForEditorRequiredGlobals()) return;", start);
  assert.notEqual(end, -1, 'required global wait call must remain');

  const block = editorSource.slice(start, end);
  assert.match(block, /createEditorStartupDependencyWaiter\(\{\s*log,\s*reportError\s*\}\)/);
  assert.doesNotMatch(block, /const waitForGlobal\s*=\s*async\s*\(name\)\s*=>/);
});

test('editor shell helper owns required global wait sequence', () => {
  assert.match(shellHelpersSource, /createEditorRequiredGlobalWaiter:\s*function\(options\)/);
  assert.match(shellHelpersSource, /'createEditorCanvas'/);
  assert.match(shellHelpersSource, /'createEditorDetailUI'/);
  assert.match(shellHelpersSource, /'createEditorMemoryActions'/);
  assert.match(shellHelpersSource, /'createEditorMemoryForm'/);
});

test('editor delegates required global waits through shell helper', () => {
  assert.match(editorSource, /const createEditorRequiredGlobalWaiter\s*=\s*shellHelpers\.createEditorRequiredGlobalWaiter/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorRequiredGlobalWaiter missing/);
  assert.match(editorSource, /const waitForEditorRequiredGlobals\s*=\s*createEditorRequiredGlobalWaiter\(\{\s*waitForGlobal\s*\}\)/);
  assert.match(editorSource, /if \(!await waitForEditorRequiredGlobals\(\)\) return;/);
  assert.doesNotMatch(editorSource, /if \(!await waitForGlobal\('createEditorCanvas'\)\) return;/);
});

test('editor shell helpers load before editor entrypoint', () => {
  const helperIndex = editorHtml.indexOf('js/editor/editor-shell-helpers.js');
  const editorIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(helperIndex, -1, 'editor-shell-helpers.js must be loaded');
  assert.notEqual(editorIndex, -1, 'editor.js must be loaded');
  assert.ok(helperIndex < editorIndex, 'editor-shell-helpers.js must load before editor.js');
});
