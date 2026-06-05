const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');

function loadShellHelpers() {
  const context = { window: {}, console, setTimeout };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(shellHelpersSource, context);
  return context.window.LoveBudEditorShellHelpers;
}

test('editor shell helpers expose required global waiter factory', () => {
  assert.match(shellHelpersSource, /createEditorRequiredGlobalWaiter:\s*function\(options\)/);
  assert.match(shellHelpersSource, /return async function waitForEditorRequiredGlobals\(\)/);
});

test('required global waiter preserves default global wait order', async () => {
  const shellHelpers = loadShellHelpers();
  const calls = [];

  const waitForEditorRequiredGlobals = shellHelpers.createEditorRequiredGlobalWaiter({
    waitForGlobal: async (name) => {
      calls.push(name);
      return true;
    }
  });

  const result = await waitForEditorRequiredGlobals();

  assert.equal(result, true);
  assert.deepEqual(calls, [
    'createEditorCanvas',
    'createEditorDetailUI',
    'createEditorMemoryActions',
    'createEditorMemoryForm'
  ]);
});

test('required global waiter stops on first missing global', async () => {
  const shellHelpers = loadShellHelpers();
  const calls = [];

  const waitForEditorRequiredGlobals = shellHelpers.createEditorRequiredGlobalWaiter({
    waitForGlobal: async (name) => {
      calls.push(name);
      return name !== 'createEditorDetailUI';
    }
  });

  const result = await waitForEditorRequiredGlobals();

  assert.equal(result, false);
  assert.deepEqual(calls, [
    'createEditorCanvas',
    'createEditorDetailUI'
  ]);
});

test('editor entrypoint delegates required global waits to shell helper', () => {
  assert.match(editorSource, /const createEditorRequiredGlobalWaiter\s*=\s*deps\.shellHelpers\.createEditorRequiredGlobalWaiter/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorRequiredGlobalWaiter missing/);
  assert.match(editorSource, /const waitForEditorRequiredGlobals\s*=\s*createEditorRequiredGlobalWaiter\(\{\s*waitForGlobal\s*\}\)/);
  assert.match(editorSource, /if \(!await waitForEditorRequiredGlobals\(\)\) return;/);
});

test('editor no longer owns inline required global wait sequence', () => {
  assert.doesNotMatch(editorSource, /if \(!await waitForGlobal\('createEditorCanvas'\)\) return;/);
  assert.doesNotMatch(editorSource, /if \(!await waitForGlobal\('createEditorDetailUI'\)\) return;/);
  assert.doesNotMatch(editorSource, /if \(!await waitForGlobal\('createEditorMemoryActions'\)\) return;/);
  assert.doesNotMatch(editorSource, /if \(!await waitForGlobal\('createEditorMemoryForm'\)\) return;/);
});

test('required global waiter slice avoids runtime behavior changes', () => {
  assert.match(editorSource, /createEditorStartupDependencyWaiter\(\{\s*log,\s*reportError\s*\}\)/);
  assert.match(editorSource, /createEditorStartupContext\(\{/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(\{/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
