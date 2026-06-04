const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');

// --- 1. Current state: local fallback removed, required boundary ---

test('editor.js now uses createEditorDebugReporter required deps helper without fallback', () => {
  assert.match(
    editorSource,
    /const\s+createEditorDebugReporter\s*=\s*deps\.createEditorDebugReporter/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+createEditorDebugReporter\s*=\s*deps\.createEditorDebugReporter\s*\|\|/
  );
});

// --- 2. Shell helper behavior already exists ---

test('editor-shell-helpers.js exports createEditorDebugReporter', () => {
  assert.match(
    shellHelpersSource,
    /createEditorDebugReporter:\s*function\(options\)/
  );
});

test('editor-shell-helpers.js createEditorDebugReporter pushes to debugState.logs', () => {
  assert.match(shellHelpersSource, /debugState\.logs\.push\(entry\)/);
});

test('editor-shell-helpers.js createEditorDebugReporter pushes to debugState.errors', () => {
  assert.match(shellHelpersSource, /debugState\.errors\.push\(/);
});

// --- 3. Missing-helper guard moved to bootstrap section ---

test('editor.js resolves createEditorDebugReporter through deps in bootstrap section', () => {
  const editorDebugIndex = editorSource.indexOf('createEditorDebugReporter = deps.createEditorDebugReporter');
  assert.ok(editorDebugIndex !== -1, 'createEditorDebugReporter must be resolved through deps');

  const guardContextStart = editorSource.lastIndexOf('reportEditorBootstrapMissingDependency', editorDebugIndex);
  assert.ok(guardContextStart !== -1, 'reportEditorBootstrapMissingDependency must exist before deps resolution');
});

test('editor.js createEditorDebugReporter deps resolution is before startEditor definition', () => {
  const editorDebugIndex = editorSource.indexOf('createEditorDebugReporter = deps.createEditorDebugReporter');
  const startEditorIndex = editorSource.indexOf('const startEditor = async () => {');

  assert.ok(editorDebugIndex !== -1, 'createEditorDebugReporter deps resolution must exist');
  assert.ok(startEditorIndex !== -1, 'startEditor must exist');
  assert.ok(editorDebugIndex < startEditorIndex, 'deps resolution must be before startEditor');
});

test('editor.js no longer guards createEditorDebugReporter inside startEditor', () => {
  const startEditorIndex = editorSource.indexOf('const startEditor = async () => {');
  const guardInside = editorSource.indexOf('createEditorDebugReporter missing', startEditorIndex);
  assert.equal(guardInside, -1, 'there must be no createEditorDebugReporter missing guard inside startEditor');
});

// --- 4. Startup dependency waiter unchanged ---

test('editor.js now uses createEditorStartupDependencyWaiter as required helper without fallback', () => {
  assert.match(
    editorSource,
    /const\s+createEditorStartupDependencyWaiter\s*=\s*shellHelpers\.createEditorStartupDependencyWaiter;/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+createEditorStartupDependencyWaiter\s*=\s*shellHelpers\.createEditorStartupDependencyWaiter\s*\|\|/
  );
});

test('editor.js guards missing createEditorStartupDependencyWaiter before use', () => {
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.createEditorStartupDependencyWaiter missing/
  );
});

// --- 5. Debug reporter call and log/reportError flow preserved ---

test('editor.js calls createEditorDebugReporter inside startEditor', () => {
  assert.match(editorSource, /const\s*\{\s*log,\s*reportError\s*\}\s*=\s*createEditorDebugReporter\(\)/);
});
