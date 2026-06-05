const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function scriptSources() {
  return Array.from(read('pages/editor.html').matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/g))
    .map((match) => match[1]);
}

function sourceIndex(sources, needle) {
  return sources.findIndex((src) => src.includes(needle));
}

test('editor refresh/save runtime loads before editor entry', () => {
  const sources = scriptSources();
  const runtime = sourceIndex(sources, 'js/editor/editor-refresh-save-runtime.js');
  const editor = sourceIndex(sources, 'js/editor.js');

  assert.notEqual(runtime, -1, 'editor-refresh-save-runtime.js must be loaded');
  assert.notEqual(editor, -1, 'editor.js must be loaded');
  assert.ok(runtime < editor, 'editor-refresh-save-runtime.js must load before editor.js');
});

test('editor refresh/save runtime exports createEditorRefreshSaveRuntime', () => {
  const context = { window: {}, Object };
  vm.createContext(context);
  vm.runInContext(read('js/editor/editor-refresh-save-runtime.js'), context);

  assert.equal(
    typeof context.window.LoveBudEditorRefreshSaveRuntime.createEditorRefreshSaveRuntime,
    'function'
  );
  assert.equal(Object.isFrozen(context.window.LoveBudEditorRefreshSaveRuntime), true);
});

test('editor entry delegates refresh/save runtime wiring', () => {
  const editor = read('js/editor.js');

  assert.match(editor, /deps\.createEditorRefreshSaveRuntime/);
  assert.match(editor, /createEditorRefreshSaveRuntime\s*=\s*deps\.createEditorRefreshSaveRuntime/);
  assert.match(editor, /LoveBudEditorRefreshSaveRuntime\.createEditorRefreshSaveRuntime/);
  assert.match(editor, /createEditorRefreshSaveRuntime\(\{/);
  assert.match(editor, /getCurrentEditingMemory:\s*\(\)\s*=>\s*currentEditingMemory/);
  assert.match(editor, /setCurrentEditingMemory:\s*\(value\)\s*=>\s*\{\s*currentEditingMemory\s*=\s*value;\s*\}/);
  assert.match(editor, /saveStatusOrchestrationHelper:\s*window\.LoveBudEditorSaveStatusOrchestration\s*\|\|\s*\{\}/);
  assert.match(editor, /const\s+\{\s*saveStatusData,\s*updateSaveStatus\s*\}\s*=\s*refreshSaveRuntime/);

  assert.doesNotMatch(editor, /const\s+handleMemoriesUpdated\s*=\s*\(\)\s*=>/);
  assert.doesNotMatch(editor, /LoveBudEditorDataLoader\.createRefreshMemories missing/);
  assert.doesNotMatch(editor, /const\s+refreshMemories\s*=\s*editorDataLoader\.createRefreshMemories/);
  assert.doesNotMatch(editor, /let\s+createEditorSaveStatusOrchestration\s*=/);
  assert.doesNotMatch(editor, /createSaveStatusOrchestrationFallback\(\);\s*\n\s*\}\s*\n\s*\n\s*const\s+\{\s*saveStatusData,\s*updateSaveStatus\s*\}\s*=/);
});

test('refresh/save helper preserves memory refresh bridge behavior', () => {
  const helper = read('js/editor/editor-refresh-save-runtime.js');

  assert.match(helper, /log\('Memories updated externally\. Rerendering\.\.\.'\)/);
  assert.match(helper, /initCanvas\(\)/);
  assert.match(helper, /updateSidebarStatus\(\)/);
  assert.match(helper, /getCurrentEditingMemory\(\)/);
  assert.match(helper, /treeMemories\(\)\.find\(\(memory\)\s*=>\s*memory\.id\s*===\s*currentEditingMemory\.id\)/);
  assert.match(helper, /setCurrentEditingMemory\(refreshedEditingMemory\)/);
  assert.match(helper, /updateDetailPanel\(refreshedEditingMemory\)/);
  assert.match(helper, /editorDataLoader\.createRefreshMemories\(\{/);
  assert.match(helper, /onMemoriesUpdated:\s*handleMemoriesUpdated/);
  assert.match(helper, /exposeRefreshMemoriesBridge\(\{\s*refreshMemories\s*\}\)/);
});

test('refresh/save helper preserves save status orchestration behavior', () => {
  const helper = read('js/editor/editor-refresh-save-runtime.js');

  assert.match(helper, /resolveSaveStatusTimeFormatter\(\{\s*[\s\S]*editorSaveStatus[\s\S]*\}\)/);
  assert.match(helper, /LoveBudEditorSaveStatus\.formatTimeAgo missing/);
  assert.match(helper, /createSaveStatusOrchestrationFallback\(\)/);
  assert.match(helper, /createEditorSaveStatusOrchestration\(\{\s*[\s\S]*editorSaveStatus,\s*[\s\S]*i18n,\s*[\s\S]*formatTimeAgo[\s\S]*\}\)/);
  assert.match(helper, /return\s+\{\s*[\s\S]*status:\s*'ready'[\s\S]*refreshMemories[\s\S]*saveStatusData[\s\S]*updateSaveStatus[\s\S]*\}/);
});
