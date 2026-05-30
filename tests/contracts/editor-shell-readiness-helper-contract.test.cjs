const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');

// --- 1. Shell helpers export check ---

test('editor shell helpers export markEditorReady', () => {
  assert.match(shellHelpersSource, /markEditorReady:\s*function\(options\)/);
});

test('editor shell helpers export applyEditorEditabilityState', () => {
  assert.match(shellHelpersSource, /applyEditorEditabilityState:\s*function\(options\)/);
});

test('editor shell helpers export createEditorDebugReporter', () => {
  assert.match(shellHelpersSource, /createEditorDebugReporter:\s*function\(options\)/);
});

test('editor shell helpers export createEditorStartupDependencyWaiter', () => {
  assert.match(shellHelpersSource, /createEditorStartupDependencyWaiter:\s*function\(options\)/);
});

// --- 2. markEditorReady behavior ---

test('markEditorReady removes editor-preload class from body', () => {
  const start = shellHelpersSource.indexOf('markEditorReady: function(options)');
  assert.notEqual(start, -1, 'markEditorReady must exist');

  const end = shellHelpersSource.indexOf('},', start);
  const block = shellHelpersSource.slice(start, end);

  assert.match(block, /body\.classList\.remove\('editor-preload'\)/);
});

// --- 3. applyEditorEditabilityState behavior ---

test('applyEditorEditabilityState sets editorNamespace.canEdit', () => {
  const start = shellHelpersSource.indexOf('applyEditorEditabilityState: function(options)');
  assert.notEqual(start, -1, 'applyEditorEditabilityState must exist');

  const end = shellHelpersSource.indexOf('},', start);
  const block = shellHelpersSource.slice(start, end);

  assert.match(block, /editorNamespace\.canEdit\s*=\s*canEdit/);
});

test('applyEditorEditabilityState toggles editor-readonly class', () => {
  const start = shellHelpersSource.indexOf('applyEditorEditabilityState: function(options)');
  const end = shellHelpersSource.indexOf('},', start);
  const block = shellHelpersSource.slice(start, end);

  assert.match(block, /body\.classList\.toggle\('editor-readonly',\s*!canEdit\)/);
});

test('applyEditorEditabilityState defaults canEdit to true', () => {
  const start = shellHelpersSource.indexOf('applyEditorEditabilityState: function(options)');
  const end = shellHelpersSource.indexOf('},', start);
  const block = shellHelpersSource.slice(start, end);

  assert.match(block, /opts\.canEdit\s*!==\s*false/);
});

// --- 4. createEditorDebugReporter behavior ---

test('createEditorDebugReporter logs entries to debugState.logs', () => {
  const start = shellHelpersSource.indexOf('createEditorDebugReporter: function(options)');
  assert.notEqual(start, -1, 'createEditorDebugReporter must exist');

  const end = shellHelpersSource.indexOf('},', start);
  const block = shellHelpersSource.slice(start, end);

  assert.match(block, /debugState\.logs\.push\(entry\)/);
});

test('createEditorDebugReporter records error entries to debugState.errors', () => {
  const start = shellHelpersSource.indexOf('createEditorDebugReporter: function(options)');
  const end = shellHelpersSource.indexOf('},', start);
  const block = shellHelpersSource.slice(start, end);

  assert.match(block, /debugState\.errors\.push\(/);
});

// --- 5. createEditorStartupDependencyWaiter behavior ---

test('createEditorStartupDependencyWaiter returns true when dependency exists', () => {
  const start = shellHelpersSource.indexOf('createEditorStartupDependencyWaiter: function(options)');
  assert.notEqual(start, -1, 'createEditorStartupDependencyWaiter must exist');

  const block = shellHelpersSource.slice(start);

  assert.match(block, /return true/);
});

test('createEditorStartupDependencyWaiter calls reportError and returns false when dependency missing', () => {
  const start = shellHelpersSource.indexOf('createEditorStartupDependencyWaiter: function(options)');
  const block = shellHelpersSource.slice(start);

  assert.match(block, /reportError\(name \+ ' not found after 5s'\)/);
  assert.match(block, /return false/);
});

// --- 6. editor.js still keeps local fallbacks (test-only, not removing) ---

test('editor.js still keeps markEditorReady local fallback', () => {
  assert.match(editorSource, /shellHelpers\.markEditorReady\s*\|\|/);
});

test('editor.js still keeps applyEditorEditabilityState local fallback', () => {
  assert.match(editorSource, /shellHelpers\.applyEditorEditabilityState\s*\|\|/);
});

test('editor.js still keeps createEditorDebugReporter local fallback', () => {
  assert.match(editorSource, /shellHelpers\.createEditorDebugReporter\s*\|\|/);
});

test('editor.js still keeps createEditorStartupDependencyWaiter local fallback', () => {
  assert.match(editorSource, /shellHelpers\.createEditorStartupDependencyWaiter\s*\|\|/);
});

// --- 7. editor.js uses helpers in startup path ---

test('editor.js calls createEditorDebugReporter in startup path', () => {
  assert.match(editorSource, /createEditorDebugReporter\(\)/);
});

test('editor.js calls createEditorStartupDependencyWaiter with log and reportError', () => {
  assert.match(editorSource, /createEditorStartupDependencyWaiter\(\{\s*log,\s*reportError\s*\}\)/);
});

test('editor.js calls applyEditorEditabilityState with canEdit', () => {
  assert.match(editorSource, /applyEditorEditabilityState\(\{\s*canEdit\s*\}\)/);
});

test('editor.js calls markEditorReady in startup completion', () => {
  assert.match(editorSource, /markEditorReady\(\)/);
});
