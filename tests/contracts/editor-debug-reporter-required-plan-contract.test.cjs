const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');

// --- 1. Current state: local fallback removed, required boundary ---

test('editor.js now uses createEditorDebugReporter required shell helper without fallback', () => {
  assert.match(
    editorSource,
    /const\s+createEditorDebugReporter\s*=\s*shellHelpers\.createEditorDebugReporter[^|]/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+createEditorDebugReporter\s*=\s*shellHelpers\.createEditorDebugReporter\s*\|\|/
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

// --- 3. Missing-helper runtime removal plan guard shape ---

const expectedRuntimeGuard = `
if (typeof createEditorDebugReporter !== 'function') {
    const debugState = window.LoveBudEditorDebug = window.LoveBudEditorDebug || { logs: [], errors: [] };
    const msg = 'LoveBudEditorShellHelpers.createEditorDebugReporter missing';
    console.error('[editor-main] ERROR: ' + msg);
    debugState.errors.push({ msg, error: msg });
    return;
}
`;

test('planned createEditorDebugReporter required path uses typeof guard', () => {
  assert.match(expectedRuntimeGuard, /typeof createEditorDebugReporter !== 'function'/);
});

test('planned createEditorDebugReporter required path reports missing helper message', () => {
  assert.match(expectedRuntimeGuard, /LoveBudEditorShellHelpers\.createEditorDebugReporter missing/);
});

test('planned createEditorDebugReporter required path uses console.error for bootstrap reporting', () => {
  assert.match(expectedRuntimeGuard, /console\.error/);
});

test('planned createEditorDebugReporter required path initializes LoveBudEditorDebug namespace', () => {
  assert.match(expectedRuntimeGuard, /LoveBudEditorDebug/);
});

test('planned createEditorDebugReporter required path pushes to debugState.errors', () => {
  assert.match(expectedRuntimeGuard, /debugState\.errors\.push/);
});

test('planned createEditorDebugReporter required path returns early on missing helper', () => {
  assert.match(expectedRuntimeGuard, /return;/);
});

// --- 4. Forbidden patterns in the planned guard ---

test('planned debug reporter removal must not depend on reportError before reporter exists', () => {
  assert.doesNotMatch(
    expectedRuntimeGuard,
    /reportError\(/,
    'missing debug reporter guard must not call reportError before createEditorDebugReporter runs'
  );
});

// --- 5. Startup dependency waiter now also required ---

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
