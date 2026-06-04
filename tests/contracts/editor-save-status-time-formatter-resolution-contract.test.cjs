const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const saveStatusOrchestrationSource = fs.readFileSync('js/editor/editor-save-status-orchestration.js', 'utf8');
const refreshSaveRuntimeSource = fs.readFileSync('js/editor/editor-refresh-save-runtime.js', 'utf8');

test('editor shell helpers expose save status time formatter resolver', () => {
  assert.match(shellHelpersSource, /resolveSaveStatusTimeFormatter:\s*function\(options\)/);
  assert.match(shellHelpersSource, /var editorSaveStatus\s*=\s*opts\.editorSaveStatus\s*\|\|\s*\{\}/);
  assert.doesNotMatch(shellHelpersSource, /createInlineFormatTimeAgoFallback/);
});

test('save status time formatter resolver returns editorSaveStatus.formatTimeAgo', () => {
  const start = shellHelpersSource.indexOf('resolveSaveStatusTimeFormatter');
  assert.notEqual(start, -1, 'resolver must exist');

  const end = shellHelpersSource.indexOf('},', start);
  assert.notEqual(end, -1, 'resolver must end');

  const block = shellHelpersSource.slice(start, end);
  assert.match(block, /return editorSaveStatus\.formatTimeAgo/);
  assert.doesNotMatch(block, /createInlineFormatTimeAgoFallback/);
});

test('editor delegates save status time formatter resolution through required shell helper', () => {
  assert.match(
    editorSource,
    /const\s+resolveSaveStatusTimeFormatter\s*=\s*deps\.resolveSaveStatusTimeFormatter/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+resolveSaveStatusTimeFormatter\s*=\s*deps\.resolveSaveStatusTimeFormatter\s*\|\|/
  );
  assert.match(refreshSaveRuntimeSource, /LoveBudEditorShellHelpers\.resolveSaveStatusTimeFormatter missing/);
  assert.match(
    refreshSaveRuntimeSource,
    /const\s+formatTimeAgo\s*=\s*resolveSaveStatusTimeFormatter\(\s*\{/
  );
  assert.doesNotMatch(
    editorSource,
    /createInlineFormatTimeAgoFallback/
  );
  assert.match(
    refreshSaveRuntimeSource,
    /LoveBudEditorSaveStatus\.formatTimeAgo missing/
  );
});

test('refresh save runtime owns save status time formatter resolver without inline fallback', () => {
  const start = refreshSaveRuntimeSource.indexOf('const refreshMemories = editorDataLoader.createRefreshMemories');
  assert.notEqual(start, -1, 'refreshMemories setup must exist');

  const end = refreshSaveRuntimeSource.indexOf('let createEditorSaveStatusOrchestration =', start);
  assert.notEqual(end, -1, 'save status orchestration setup must follow formatTimeAgo setup');

  const block = refreshSaveRuntimeSource.slice(start, end);
  assert.match(block, /const formatTimeAgo\s*=\s*resolveSaveStatusTimeFormatter\(\{/);
  assert.match(refreshSaveRuntimeSource, /LoveBudEditorShellHelpers\.resolveSaveStatusTimeFormatter missing/);
  assert.doesNotMatch(block, /const formatTimeAgo\s*=\s*editorSaveStatus\.formatTimeAgo\s*\|\|\s*createInlineFormatTimeAgoFallback\(\)/);
  assert.doesNotMatch(editorSource, /const\s+formatTimeAgo\s*=\s*resolveSaveStatusTimeFormatter/);
});

test('refresh save runtime guards missing save status time formatter before resolution', () => {
  const guardIndex = refreshSaveRuntimeSource.indexOf('LoveBudEditorShellHelpers.resolveSaveStatusTimeFormatter missing');
  const formatIndex = refreshSaveRuntimeSource.indexOf('const formatTimeAgo = resolveSaveStatusTimeFormatter({');

  assert.ok(guardIndex !== -1, 'missing save status time formatter guard must exist');
  assert.ok(formatIndex !== -1, 'formatTimeAgo resolution must exist');
  assert.ok(guardIndex < formatIndex, 'guard must run before formatTimeAgo resolution');
});

test('editor.js removes createInlineFormatTimeAgoFallback and requires formatTimeAgo helper', () => {
  assert.doesNotMatch(editorSource, /createInlineFormatTimeAgoFallback/);
  assert.doesNotMatch(editorSource, /entryFallbacks\.createInlineFormatTimeAgoFallback/);
  assert.match(refreshSaveRuntimeSource, /LoveBudEditorSaveStatus\.formatTimeAgo missing/);
  assert.match(refreshSaveRuntimeSource, /const formatTimeAgo\s*=\s*resolveSaveStatusTimeFormatter/);
});

test('refresh save runtime formatTimeAgo guard uses reportError', () => {
  const guardIndex = refreshSaveRuntimeSource.indexOf('LoveBudEditorSaveStatus.formatTimeAgo missing');
  assert.ok(guardIndex !== -1, 'missing formatTimeAgo guard must exist');
  const guardReportStart = refreshSaveRuntimeSource.indexOf('reportError', guardIndex - 100);
  assert.ok(guardReportStart !== -1, 'guard must use reportError');
  const guardReportExpr = refreshSaveRuntimeSource.slice(guardReportStart, refreshSaveRuntimeSource.indexOf(';', guardReportStart) + 1);
  assert.match(guardReportExpr, /reportError,\s*['"]LoveBudEditorSaveStatus\.formatTimeAgo missing['"]/);
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
  assert.match(saveStatusOrchestrationSource, /formatTimeAgo/);
});
