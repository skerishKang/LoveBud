const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellGuardsSource = fs.readFileSync('js/editor/editor-shell-guards.js', 'utf8');
const editorHtml = fs.readFileSync('pages/editor.html', 'utf8');

test('editor shell guards expose startup dependency waiter factory', () => {
  assert.match(shellGuardsSource, /createEditorStartupDependencyWaiter:\s*function/);
  assert.match(shellGuardsSource, /return async function waitForGlobal\(name\)/);
});

test('startup dependency waiter preserves default timing and messages', () => {
  assert.match(shellGuardsSource, /var maxAttempts\s*=\s*opts\.maxAttempts\s*\|\|\s*100/);
  assert.match(shellGuardsSource, /var intervalMs\s*=\s*opts\.intervalMs\s*\|\|\s*50/);
  assert.match(shellGuardsSource, /log\('Waiting for '\s*\+\s*name\s*\+\s*'\.\.\.'\)/);
  assert.match(shellGuardsSource, /reportError\(name\s*\+\s*' not found after 5s'\)/);
  assert.match(shellGuardsSource, /log\(name\s*\+\s*' found\.'\)/);
});

test('startup dependency waiter keeps testable hooks', () => {
  assert.match(shellGuardsSource, /opts\.log/);
  assert.match(shellGuardsSource, /opts\.reportError/);
  assert.match(shellGuardsSource, /opts\.windowRef/);
  assert.match(shellGuardsSource, /opts\.wait/);
  assert.match(shellGuardsSource, /opts\.maxAttempts/);
  assert.match(shellGuardsSource, /opts\.intervalMs/);
});

test('editor delegates startup dependency waiter with fallback', () => {
  assert.match(editorSource, /deps\.createEditorStartupDependencyWaiter/);
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

test('editor shell guards owns required global wait sequence', () => {
  assert.match(shellGuardsSource, /createEditorRequiredGlobalWaiter:\s*function\(options\)/);
  assert.match(shellGuardsSource, /'createEditorCanvas'/);
  assert.match(shellGuardsSource, /'createEditorDetailUI'/);
  assert.match(shellGuardsSource, /'createEditorMemoryActions'/);
  assert.match(shellGuardsSource, /'createEditorMemoryForm'/);
});

test('editor delegates required global waits through shell guards', () => {
  assert.match(editorSource, /const createEditorRequiredGlobalWaiter\s*=\s*deps\.shellHelpers\.createEditorRequiredGlobalWaiter/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorRequiredGlobalWaiter missing/);
  assert.match(editorSource, /const waitForEditorRequiredGlobals\s*=\s*createEditorRequiredGlobalWaiter\(\{\s*waitForGlobal\s*\}\)/);
  assert.match(editorSource, /if \(!await waitForEditorRequiredGlobals\(\)\) return;/);
  assert.doesNotMatch(editorSource, /if \(!await waitForGlobal\('createEditorCanvas'\)\) return;/);
});

test('editor shell guards load before editor entrypoint', () => {
  const helperIndex = editorHtml.indexOf('js/editor/editor-shell-guards.js');
  const editorIndex = editorHtml.indexOf('js/editor.js');

  assert.notEqual(helperIndex, -1, 'editor-shell-guards.js must be loaded');
  assert.notEqual(editorIndex, -1, 'editor.js must be loaded');
  assert.ok(helperIndex < editorIndex, 'editor-shell-guards.js must load before editor.js');
});
