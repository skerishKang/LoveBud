const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const saveStatusOrchestrationSource = fs.readFileSync('js/editor/editor-save-status-orchestration.js', 'utf8');
const refreshSaveRuntimeSource = fs.readFileSync('js/editor/editor-refresh-save-runtime.js', 'utf8');

test('editor shell helpers expose save status orchestration fallback factory', () => {
  assert.match(shellHelpersSource, /createSaveStatusOrchestrationFallback:\s*function\(options\)/);
  assert.match(shellHelpersSource, /var consoleRef\s*=\s*opts\.consoleRef\s*\|\|\s*console/);
  assert.match(shellHelpersSource, /return function createEditorSaveStatusOrchestrationFallback\(\)/);
});

test('save status fallback preserves warning and initial state shape', () => {
  assert.match(shellHelpersSource, /consoleRef\.warn\('\[editor\] LoveBudEditorSaveStatusOrchestration not loaded, using minimal fallback'\)/);
  assert.match(shellHelpersSource, /status:\s*'saved'/);
  assert.match(shellHelpersSource, /lastSaved:\s*null/);
  assert.match(shellHelpersSource, /timer:\s*null/);
});

test('save status fallback preserves minimal updateSaveStatus behavior', () => {
  assert.match(shellHelpersSource, /updateSaveStatus:\s*function\(status,\s*message\)/);
  assert.match(shellHelpersSource, /saveStatusData\.status\s*=\s*status/);
});

test('editor delegates save status fallback through required shell helper while preserving primary orchestration priority', () => {
  assert.match(
    editorSource,
    /createSaveStatusOrchestrationFallback:\s*deps\.createSaveStatusOrchestrationFallback/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+createSaveStatusOrchestrationFallback\s*=\s*deps\.shellHelpers\.createSaveStatusOrchestrationFallback\s*\|\|/
  );
  assert.match(
    editorSource,
    /saveStatusOrchestrationHelper:\s*window\.LoveBudEditorSaveStatusOrchestration\s*\|\|\s*\{\}/
  );
  assert.match(
    refreshSaveRuntimeSource,
    /let\s+createEditorSaveStatusOrchestration\s*=\s*\(saveStatusOrchestrationHelper\s*\|\|\s*\{\}\)\.createEditorSaveStatusOrchestration/
  );
  assert.match(
    refreshSaveRuntimeSource,
    /typeof\s+createEditorSaveStatusOrchestration\s*!==\s*'function'/
  );
  assert.match(
    refreshSaveRuntimeSource,
    /LoveBudEditorShellHelpers\.createSaveStatusOrchestrationFallback missing/
  );
  assert.match(
    refreshSaveRuntimeSource,
    /createEditorSaveStatusOrchestration\s*=\s*createSaveStatusOrchestrationFallback\(\)/
  );
});

test('refresh save runtime owns save status fallback delegation without inline fallback body', () => {
  const start = refreshSaveRuntimeSource.indexOf('let createEditorSaveStatusOrchestration =');
  assert.notEqual(start, -1, 'save status orchestration helper setup must exist');

  const end = refreshSaveRuntimeSource.indexOf('const { saveStatusData, updateSaveStatus } = createEditorSaveStatusOrchestration', start);
  assert.notEqual(end, -1, 'save status destructuring must follow factory resolution');

  const block = refreshSaveRuntimeSource.slice(start, end);
  assert.match(block, /createSaveStatusOrchestrationFallback\(\)/);
  assert.match(block, /LoveBudEditorShellHelpers\.createSaveStatusOrchestrationFallback missing/);
  assert.doesNotMatch(block, /console\.warn\('\[editor\] LoveBudEditorSaveStatusOrchestration not loaded, using minimal fallback'\)/);
  assert.doesNotMatch(block, /let saveStatusData\s*=\s*\{\s*status:\s*'saved',\s*lastSaved:\s*null,\s*timer:\s*null\s*\}/);
  assert.doesNotMatch(editorSource, /let\s+createEditorSaveStatusOrchestration\s*=/);
});

test('refresh save runtime guards missing save status fallback factory before fallback creation', () => {
  const guardIndex = refreshSaveRuntimeSource.indexOf('LoveBudEditorShellHelpers.createSaveStatusOrchestrationFallback missing');
  const fallbackIndex = refreshSaveRuntimeSource.indexOf('createEditorSaveStatusOrchestration = createSaveStatusOrchestrationFallback();');

  assert.ok(guardIndex !== -1, 'missing save status fallback factory guard must exist');
  assert.ok(fallbackIndex !== -1, 'fallback factory assignment must exist');
  assert.ok(guardIndex < fallbackIndex, 'guard must run before fallback factory assignment');
});

test('refresh save runtime keeps save status orchestration invocation intact', () => {
  assert.match(
    refreshSaveRuntimeSource,
    /const \{\s*saveStatusData,\s*updateSaveStatus\s*\}\s*=\s*createEditorSaveStatusOrchestration\(\{\s*editorSaveStatus,\s*i18n,\s*formatTimeAgo\s*\}\)/
  );
});

test('normal save status orchestration module remains intact', () => {
  assert.match(saveStatusOrchestrationSource, /window\.LoveBudEditorSaveStatusOrchestration\s*=\s*\{/);
  assert.match(saveStatusOrchestrationSource, /createEditorSaveStatusOrchestration/);
  assert.match(saveStatusOrchestrationSource, /editorSaveStatus\.updateSaveStatus/);
});
