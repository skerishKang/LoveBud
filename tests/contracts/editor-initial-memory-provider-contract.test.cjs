const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const shellMemorySource = fs.readFileSync('js/editor/editor-shell-memory.js', 'utf8');

test('memory fix editor shell helpers expose initial memory provider factory', () => {
  assert.match(shellMemorySource, /createEditorInitialMemoryProvider:\s*function\(options\)/);
  assert.match(shellMemorySource, /return function createInitialMemory\(\)/);
});

test('memory fix initial memory provider preserves delegate call', () => {
  assert.match(shellMemorySource, /editorTreeHelpers\.createInitialMemory\(/);
  assert.match(shellMemorySource, /getTreeMemories:\s*getTreeMemories/);
  assert.match(shellMemorySource, /findRootMemory:\s*findRootMemory/);
  assert.match(shellMemorySource, /canonicalRootId:\s*canonicalRootId/);
  assert.match(shellMemorySource, /treeId:\s*treeId/);
  assert.match(shellMemorySource, /i18n:\s*i18n/);
});

test('editor entrypoint delegates initial memory provider construction to shell helper', () => {
  assert.match(editorSource, /const createEditorInitialMemoryProvider\s*=\s*deps\.shellHelpers\.createEditorInitialMemoryProvider/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorInitialMemoryProvider missing/);
  assert.match(editorSource, /const createInitialMemory\s*=\s*createEditorInitialMemoryProvider\(/);
  assert.match(editorSource, /getTreeMemories:\s*\(\)\s*=>\s*treeMemories\(\)/);
  assert.match(editorSource, /findRootMemory,/);
  assert.match(editorSource, /editorTreeHelpers: deps\.editorTreeHelpers,/);
});

test('editor keeps initial memory provider guard before factory call', () => {
  assert.match(editorSource, /LoveBudEditorTreeHelpers\.createInitialMemory missing/);
});

test('editor no longer owns inline createInitialMemory wrapper body', () => {
  assert.doesNotMatch(editorSource, /const createInitialMemory\s*=\s*\(\)\s*=>\s*editorTreeHelpers\.createInitialMemory\(/);
});

test('initial memory provider slice avoids canvas runtime changes', () => {
  assert.doesNotMatch(editorSource, /initCanvas\s*=\s*/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
});
