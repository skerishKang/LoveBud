const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');
const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');

function loadShellHelpers() {
  const context = { window: {}, console };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(shellHelpersSource, context);
  return context.window.LoveBudEditorShellHelpers;
}

test('editor shell helpers expose next memory id provider factory', () => {
  assert.match(shellHelpersSource, /createEditorNextMemoryIdProvider:\s*function\(options\)/);
  assert.match(shellHelpersSource, /return function nextMemoryId\(\)/);
});

test('next memory id provider delegates to tree helper with current memories', () => {
  const shellHelpers = loadShellHelpers();
  const calls = [];

  const nextMemoryId = shellHelpers.createEditorNextMemoryIdProvider({
    nextMemoryIdFromMemories: (memories) => {
      calls.push(memories);
      return 'm3';
    },
    getTreeMemories: () => [{ id: 'm1' }, { id: 'm2' }]
  });

  assert.equal(nextMemoryId(), 'm3');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [{ id: 'm1' }, { id: 'm2' }]);
});

test('editor entrypoint delegates next memory id provider construction to shell helper', () => {
  assert.match(editorSource, /const createEditorNextMemoryIdProvider\s*=\s*shellHelpers\.createEditorNextMemoryIdProvider/);
  assert.match(editorSource, /LoveBudEditorShellHelpers\.createEditorNextMemoryIdProvider missing/);
  assert.match(editorSource, /const nextMemoryId\s*=\s*createEditorNextMemoryIdProvider\(\{/);
  assert.match(editorSource, /nextMemoryIdFromMemories:\s*deps\.nextMemoryIdFromMemories,\s*getTreeMemories:\s*\(\)\s*=>\s*treeMemories\(\)/s);
});

test('editor preserves required tree helper guard before provider construction', () => {
  const guardIndex = editorSource.indexOf('LoveBudEditorTreeHelpers.nextMemoryIdFromMemories missing');
  const providerIndex = editorSource.indexOf('const nextMemoryId = createEditorNextMemoryIdProvider({');

  assert.ok(guardIndex !== -1, 'nextMemoryIdFromMemories guard must exist');
  assert.ok(providerIndex !== -1, 'next memory id provider construction must exist');
  assert.ok(guardIndex < providerIndex, 'tree helper guard must run before provider construction');
});

test('editor no longer owns inline next memory id provider body', () => {
  assert.doesNotMatch(
    editorSource,
    /const nextMemoryId\s*=\s*\(\)\s*=>\s*nextMemoryIdFromMemories\(treeMemories\(\)\)/
  );
});

test('next memory id provider slice avoids canvas and refresh-save runtime changes', () => {
  assert.doesNotMatch(editorSource, /initCanvas\s*=\s*/);
  assert.doesNotMatch(editorSource, /pan\/drag lifecycle/);
  assert.match(editorSource, /createEditorRefreshSaveRuntime\(\{/);
});
