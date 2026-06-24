const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellStartupSource = fs.readFileSync('js/editor/editor-shell-startup.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');

function loadShellHelpers() {
  const context = { window: {}, console, setTimeout };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(shellStartupSource, context);
  vm.runInContext(shellHelpersSource, context);
  return context.window.LoveBudEditorShellHelpers;
}

test('editor shell startup sub-module exposes startup shell applier factory', () => {
  assert.match(shellStartupSource, /createEditorStartupShellApplier:\s*function\(options\)/);
  assert.match(shellStartupSource, /return function applyEditorStartupShell\(\)/);
});

test('startup shell applier preserves log, shell preparation, and editability order', () => {
  const shellHelpers = loadShellHelpers();
  const calls = [];

  const applyEditorStartupShell = shellHelpers.createEditorStartupShellApplier({
    prepareEditorShell: () => calls.push('prepare'),
    applyEditorEditabilityState: (payload) => calls.push(['editability', payload]),
    canEdit: true,
    log: (message) => calls.push(message)
  });

  applyEditorStartupShell();

  assert.equal(calls.length, 4);
  assert.equal(calls[0], 'DOM refs and URL params prepared');
  assert.equal(calls[1], 'prepare');
  assert.equal(calls[2], 'Editor shell mounted');
  assert.equal(calls[3][0], 'editability');
  assert.equal(calls[3][1].canEdit, true);
});

test('editor entrypoint delegates startup shell preparation to shell helper', () => {
  assert.match(editorSource, /const createEditorStartupShellApplier\s*=\s*deps\.shellHelpers\.createEditorStartupShellApplier/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorStartupShellApplier missing/);
  assert.match(editorSource, /const applyEditorStartupShell\s*=\s*createEditorStartupShellApplier\({/);
  assert.match(editorSource, /prepareEditorShell,\s*applyEditorEditabilityState,\s*canEdit:\s*false,\s*log/s);
  assert.match(editorSource, /applyEditorStartupShell\(\);/);
});

test('editor delegates applyEditorEditabilityState dependency guard before startup shell applier', () => {
  const checkerIndex = editorSource.indexOf('checkEditorStartupShellDependencies');
  const applyIndex = editorSource.indexOf('const applyEditorStartupShell = createEditorStartupShellApplier({');

  assert.ok(checkerIndex !== -1, 'startup shell dependency checker must exist');
  assert.ok(applyIndex !== -1, 'startup shell applier construction must exist');
  assert.ok(checkerIndex < applyIndex, 'dependency checker must run before startup shell applier construction');

  assert.match(editorSource, /LoveBudEditorShellHelpers\.applyEditorEditabilityState missing/);
});

test('editor no longer owns inline startup shell preparation block', () => {
  assert.doesNotMatch(editorSource, /log\('DOM refs and URL params prepared'\);\s*prepareEditorShell\(\);\s*log\('Editor shell mounted'\);/);
  assert.doesNotMatch(editorSource, /applyEditorEditabilityState\(\{\s*canEdit\s*\}\)/);
});

test('startup shell applier slice avoids load, canvas, and refresh-save runtime changes', () => {
  assert.match(editorSource, /runEditorInitialLoadFlow\({/);
  assert.match(editorSource, /createEditorStartupContext\({/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\({/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
