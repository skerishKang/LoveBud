const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const saveStatusOrchestrationSource = fs.readFileSync('js/editor/editor-save-status-orchestration.js', 'utf8');

test('editor shell helpers expose save status time formatter resolver', () => {
  assert.match(shellHelpersSource, /resolveSaveStatusTimeFormatter:\s*function\(options\)/);
  assert.match(shellHelpersSource, /var editorSaveStatus\s*=\s*opts\.editorSaveStatus\s*\|\|\s*\{\}/);
  assert.match(shellHelpersSource, /var createInlineFormatTimeAgoFallback\s*=\s*opts\.createInlineFormatTimeAgoFallback/);
});

test('save status time formatter resolver preserves primary formatter priority', () => {
  const start = shellHelpersSource.indexOf('resolveSaveStatusTimeFormatter');
  assert.notEqual(start, -1, 'resolver must exist');

  const end = shellHelpersSource.indexOf('},', start);
  assert.notEqual(end, -1, 'resolver must end');

  const block = shellHelpersSource.slice(start, end);
  assert.match(block, /return editorSaveStatus\.formatTimeAgo \|\| createInlineFormatTimeAgoFallback\(\)/);
});

test('editor delegates save status time formatter resolution through required shell helper', () => {
  assert.match(
    editorSource,
    /const\s+resolveSaveStatusTimeFormatter\s*=\s*shellHelpers\.resolveSaveStatusTimeFormatter/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+resolveSaveStatusTimeFormatter\s*=\s*shellHelpers\.resolveSaveStatusTimeFormatter\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.resolveSaveStatusTimeFormatter missing/
  );
  assert.match(
    editorSource,
    /const\s+formatTimeAgo\s*=\s*resolveSaveStatusTimeFormatter\(\{/
  );
  assert.match(
    editorSource,
    /editorSaveStatus,\s*createInlineFormatTimeAgoFallback/
  );
});

test('editor no longer owns inline save status time formatter resolver', () => {
  const start = editorSource.indexOf('const refreshMemories = editorDataLoader.createRefreshMemories');
  assert.notEqual(start, -1, 'refreshMemories setup must exist');

  const end = editorSource.indexOf('const saveStatusOrchestrationHelper =', start);
  assert.notEqual(end, -1, 'save status orchestration setup must follow formatTimeAgo setup');

  const block = editorSource.slice(start, end);
  assert.match(block, /const formatTimeAgo\s*=\s*resolveSaveStatusTimeFormatter\(\{/);
  assert.match(block, /LoveBudEditorShellHelpers\.resolveSaveStatusTimeFormatter missing/);
  assert.doesNotMatch(block, /const formatTimeAgo\s*=\s*editorSaveStatus\.formatTimeAgo\s*\|\|\s*createInlineFormatTimeAgoFallback\(\)/);
});

test('editor guards missing save status time formatter before resolution', () => {
  const guardIndex = editorSource.indexOf('LoveBudEditorShellHelpers.resolveSaveStatusTimeFormatter missing');
  const formatIndex = editorSource.indexOf('const formatTimeAgo = resolveSaveStatusTimeFormatter({');

  assert.ok(guardIndex !== -1, 'missing save status time formatter guard must exist');
  assert.ok(formatIndex !== -1, 'formatTimeAgo resolution must exist');
  assert.ok(guardIndex < formatIndex, 'guard must run before formatTimeAgo resolution');
});

test('editor keeps createInlineFormatTimeAgoFallback available and unchanged by boundary', () => {
  assert.match(editorSource, /createInlineFormatTimeAgoFallback/);
  assert.match(editorSource, /const formatTimeAgo\s*=\s*resolveSaveStatusTimeFormatter/);
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
  assert.match(saveStatusOrchestrationSource, /formatTimeAgo/);
});
