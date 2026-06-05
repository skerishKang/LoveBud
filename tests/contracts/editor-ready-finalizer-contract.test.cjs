const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');

function loadShellHelpers() {
  const context = { window: {}, console };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(shellHelpersSource, context);
  return context.window.LoveBudEditorShellHelpers;
}

test('editor shell helpers expose ready finalizer factory', () => {
  assert.match(shellHelpersSource, /createEditorReadyFinalizer:\s*function\(options\)/);
  assert.match(shellHelpersSource, /return function finalizeEditorReady\(\)/);
});

test('ready finalizer preserves sidebar update, ready marker, and final log order', () => {
  const shellHelpers = loadShellHelpers();
  const calls = [];

  const finalizeEditorReady = shellHelpers.createEditorReadyFinalizer({
    updateSidebarStatus: () => calls.push('sidebar'),
    markEditorReady: () => calls.push('ready'),
    log: (message) => calls.push(message)
  });

  finalizeEditorReady();

  assert.deepEqual(calls, [
    'sidebar',
    'ready',
    'startEditor complete. Ready.'
  ]);
});

test('editor entrypoint delegates final ready block to shell helper', () => {
  assert.match(editorSource, /const createEditorReadyFinalizer\s*=\s*deps\.shellHelpers\.createEditorReadyFinalizer/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorReadyFinalizer missing/);
  assert.match(editorSource, /const finalizeEditorReady\s*=\s*createEditorReadyFinalizer\(\{/);
  assert.match(editorSource, /updateSidebarStatus,\s*markEditorReady,\s*log/s);
  assert.match(editorSource, /finalizeEditorReady\(\);/);
});

test('editor no longer owns inline final ready block', () => {
  assert.doesNotMatch(
    editorSource,
    /updateSidebarStatus\(\);\s*markEditorReady\(\);\s*log\('startEditor complete\. Ready\.'\);/
  );
});

test('ready finalizer runs after initial selection application', () => {
  const selectionIndex = editorSource.indexOf('applyEditorInitialSelection();');
  const finalizerIndex = editorSource.indexOf('finalizeEditorReady();');

  assert.ok(selectionIndex !== -1, 'initial selection call must exist');
  assert.ok(finalizerIndex !== -1, 'ready finalizer call must exist');
  assert.ok(selectionIndex < finalizerIndex, 'ready finalizer must run after initial selection');
});

test('ready finalizer slice avoids canvas and refresh-save runtime changes', () => {
  assert.match(editorSource, /initCanvas\(\);/);
  assert.match(editorSource, /updateCanvasEmptyGuide\(\);/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(\{/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
