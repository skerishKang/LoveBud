const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const treeHelpersSource = fs.readFileSync('js/editor/editor-tree-helpers.js', 'utf8');

test('editor tree helpers expose nextMemoryIdFromMemories', () => {
  assert.match(treeHelpersSource, /treeHelpers\.nextMemoryIdFromMemories/);
  assert.match(treeHelpersSource, /function nextMemoryIdFromMemories\(memories\)/);
});

test('editor.js requires nextMemoryIdFromMemories through required tree helper', () => {
  assert.match(
    editorSource,
    /const\s+nextMemoryIdFromMemories\s*=\s*editorTreeHelpers\.nextMemoryIdFromMemories/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+nextMemoryIdFromMemories\s*=\s*editorTreeHelpers\.nextMemoryIdFromMemories\s*\|\|/
  );
});

test('editor.js removes createInlineNextMemoryIdFallback', () => {
  assert.doesNotMatch(editorSource, /createInlineNextMemoryIdFallback/);
  assert.doesNotMatch(editorSource, /dataLoaderFallbacks\.createInlineNextMemoryIdFallback/);
});

test('editor.js guards missing nextMemoryIdFromMemories with reportError', () => {
  assert.match(
    editorSource,
    /ensureStartEditorDependency\(nextMemoryIdFromMemories,\s*'LoveBudEditorTreeHelpers\.nextMemoryIdFromMemories missing'\)/
  );
});

test('editor.js delegates nextMemoryId through required tree helper', () => {
  assert.match(
    editorSource,
    /const\s+nextMemoryId\s*=\s*\(\s*\)\s*=>\s*nextMemoryIdFromMemories\(treeMemories\(\)\)/
  );
  assert.doesNotMatch(
    editorSource,
    /createInlineNextMemoryIdFallback\(\{/
  );
});

test('editor.js keeps redirectToEditorLogin fallback intact', () => {
  assert.match(editorSource, /redirectToEditorLogin/);
});
