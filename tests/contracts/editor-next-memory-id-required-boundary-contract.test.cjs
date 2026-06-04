const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const treeHelpersSource = fs.readFileSync('js/editor/editor-tree-helpers.js', 'utf8');

test('editor tree helpers expose nextMemoryIdFromMemories', () => {
  assert.match(treeHelpersSource, /treeHelpers\.nextMemoryIdFromMemories/);
  assert.match(treeHelpersSource, /function nextMemoryIdFromMemories\(memories\)/);
});

test('editor.js requires nextMemoryIdFromMemories through deps', () => {
  assert.match(
    editorSource,
    /deps\.nextMemoryIdFromMemories/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+nextMemoryIdFromMemories\s*=\s*editorTreeHelpers\.nextMemoryIdFromMemories\s*\|\|/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+nextMemoryIdFromMemories\s*=\s*editorTreeHelpers\.nextMemoryIdFromMemories/
  );
});

test('editor.js removes createInlineNextMemoryIdFallback', () => {
  assert.doesNotMatch(editorSource, /createInlineNextMemoryIdFallback/);
  assert.doesNotMatch(editorSource, /dataLoaderFallbacks\.createInlineNextMemoryIdFallback/);
});

test('editor.js guards missing nextMemoryIdFromMemories through delegated checker', () => {
  assert.match(
    editorSource,
    /LoveBudEditorTreeHelpers\.nextMemoryIdFromMemories missing/
  );
  assert.match(editorSource, /checkEditorMemoryProviderDependencies\(\)/);
});

test('editor.js delegates nextMemoryId through shell helper factory', () => {
  assert.match(
    editorSource,
    /const\s+nextMemoryId\s*=\s*createEditorNextMemoryIdProvider\(/
  );
  assert.doesNotMatch(
    editorSource,
    /createInlineNextMemoryIdFallback\(\{/
  );
});

test('editor.js keeps redirectToEditorLogin fallback intact', () => {
  assert.match(editorSource, /redirectToEditorLogin/);
});
