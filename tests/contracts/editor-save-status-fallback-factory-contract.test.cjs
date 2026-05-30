const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const saveStatusOrchestrationSource = fs.readFileSync('js/editor/editor-save-status-orchestration.js', 'utf8');

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

test('editor delegates save status fallback while preserving primary orchestration priority', () => {
  assert.match(editorSource, /shellHelpers\.createSaveStatusOrchestrationFallback/);
  assert.match(editorSource, /const createSaveStatusOrchestrationFallback\s*=/);
  assert.match(editorSource, /const saveStatusOrchestrationHelper\s*=\s*window\.LoveBudEditorSaveStatusOrchestration\s*\|\|\s*\{\}/);
  assert.match(
    editorSource,
    /const createEditorSaveStatusOrchestration\s*=\s*saveStatusOrchestrationHelper\.createEditorSaveStatusOrchestration\s*\|\|\s*createSaveStatusOrchestrationFallback\(\)/
  );
});

test('editor no longer owns inline save status fallback body', () => {
  const start = editorSource.indexOf('const saveStatusOrchestrationHelper = window.LoveBudEditorSaveStatusOrchestration || {};');
  assert.notEqual(start, -1, 'save status orchestration helper setup must exist');

  const end = editorSource.indexOf('const { saveStatusData, updateSaveStatus } = createEditorSaveStatusOrchestration', start);
  assert.notEqual(end, -1, 'save status destructuring must follow factory resolution');

  const block = editorSource.slice(start, end);
  assert.match(block, /createSaveStatusOrchestrationFallback\(\)/);
  assert.doesNotMatch(block, /console\.warn\('\[editor\] LoveBudEditorSaveStatusOrchestration not loaded, using minimal fallback'\)/);
  assert.doesNotMatch(block, /let saveStatusData\s*=\s*\{\s*status:\s*'saved',\s*lastSaved:\s*null,\s*timer:\s*null\s*\}/);
});

test('editor keeps save status orchestration invocation intact', () => {
  assert.match(
    editorSource,
    /const \{\s*saveStatusData,\s*updateSaveStatus\s*\}\s*=\s*createEditorSaveStatusOrchestration\(\{\s*editorSaveStatus,\s*i18n,\s*formatTimeAgo\s*\}\)/
  );
});

test('normal save status orchestration module remains intact', () => {
  assert.match(saveStatusOrchestrationSource, /window\.LoveBudEditorSaveStatusOrchestration\s*=\s*\{/);
  assert.match(saveStatusOrchestrationSource, /createEditorSaveStatusOrchestration/);
  assert.match(saveStatusOrchestrationSource, /editorSaveStatus\.updateSaveStatus/);
});
