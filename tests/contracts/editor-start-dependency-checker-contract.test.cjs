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

test('editor shell helpers expose start dependency checker factory', () => {
  assert.match(shellHelpersSource, /createEditorStartDependencyChecker:\s*function\(options\)/);
  assert.match(shellHelpersSource, /return function checkEditorStartDependencies\(\)/);
});

test('start dependency checker preserves order and returns true when all dependencies exist', () => {
  const shellHelpers = loadShellHelpers();
  const calls = [];

  const checkEditorStartDependencies = shellHelpers.createEditorStartDependencyChecker({
    ensureStartEditorDependency: (value, message) => {
      calls.push([value, message]);
      return typeof value === 'function';
    },
    dependencies: [
      { value: function a() {}, message: 'a missing' },
      { value: function b() {}, message: 'b missing' }
    ]
  });

  assert.equal(checkEditorStartDependencies(), true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][1], 'a missing');
  assert.equal(calls[1][1], 'b missing');
});

test('start dependency checker stops at first missing dependency', () => {
  const shellHelpers = loadShellHelpers();
  const calls = [];

  const checkEditorStartDependencies = shellHelpers.createEditorStartDependencyChecker({
    ensureStartEditorDependency: (value, message) => {
      calls.push([value, message]);
      return Boolean(value);
    },
    dependencies: [
      { value: function a() {}, message: 'a missing' },
      { value: null, message: 'b missing' },
      { value: function c() {}, message: 'c missing' }
    ]
  });

  assert.equal(checkEditorStartDependencies(), false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][1], 'b missing');
});

test('editor entrypoint delegates start dependency checks to shell helper', () => {
  assert.match(editorSource, /const createEditorStartDependencyChecker\s*=\s*deps\.shellHelpers\.createEditorStartDependencyChecker/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorStartDependencyChecker missing/);
  assert.match(editorSource, /const checkEditorStartDependencies\s*=\s*createEditorStartDependencyChecker\(\{/);
  assert.match(editorSource, /ensureStartEditorDependency,\s*dependencies:\s*\[/s);
  assert.match(editorSource, /if \(!checkEditorStartDependencies\(\)\) return;/);
});

test('editor preserves required start dependency messages inside delegated list', () => {
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorStartupDependencyWaiter missing/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.markEditorReady missing/);
  assert.match(editorSource, /LoveBudEditorInitialLoadFlow\.runEditorInitialLoadFlow missing/);
  assert.match(editorSource, /LoveBudEditorRefreshSaveRuntime\.createEditorRefreshSaveRuntime missing/);
});

test('editor no longer owns repeated inline start dependency checks', () => {
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(createEditorStartupDependencyWaiter, 'LoveBudEditorShellHelpers\.createEditorStartupDependencyWaiter missing'\)\) return;/
  );
  assert.doesNotMatch(
    editorSource,
    /if \(!ensureStartEditorDependency\(createEditorRefreshSaveRuntime, 'LoveBudEditorRefreshSaveRuntime\.createEditorRefreshSaveRuntime missing'\)\) return;/
  );
});

test('start dependency checker slice avoids runtime behavior changes', () => {
  assert.match(editorSource, /createEditorStartupDependencyWaiter\(\{\s*log,\s*reportError\s*\}\)/);
  assert.match(editorSource, /runEditorInitialLoadFlow\(\{/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(\{/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
