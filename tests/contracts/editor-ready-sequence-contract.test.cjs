const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const editorSource = fs.readFileSync('js/editor.js', 'utf8');

function indexOfRequired(source, needle) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `${needle} must exist`);
  return index;
}

test('editor ready sequence keeps event binding before final canvas setup', () => {
  const bindIndex = indexOfRequired(editorSource, 'bindEditorPageEvents({');
  const finalCanvasLogIndex = indexOfRequired(editorSource, "log('Final Canvas Initialization...');");
  const initCanvasIndex = indexOfRequired(editorSource, 'initCanvas();');
  const emptyGuideIndex = indexOfRequired(editorSource, 'updateCanvasEmptyGuide();');

  assert.ok(bindIndex < finalCanvasLogIndex, 'event binding must happen before final canvas setup log');
  assert.ok(finalCanvasLogIndex < initCanvasIndex, 'final canvas setup log must happen before initCanvas');
  assert.ok(initCanvasIndex < emptyGuideIndex, 'initCanvas must happen before empty guide update');
});

test('editor ready sequence keeps initial selection after final canvas setup', () => {
  const emptyGuideIndex = indexOfRequired(editorSource, 'updateCanvasEmptyGuide();');
  const initialSelectionFactoryIndex = indexOfRequired(
    editorSource,
    'const applyEditorInitialSelection = createEditorInitialSelectionApplier({'
  );
  const initialSelectionCallIndex = indexOfRequired(editorSource, 'applyEditorInitialSelection();');

  assert.ok(
    emptyGuideIndex < initialSelectionFactoryIndex,
    'initial selection factory must be created after final canvas setup'
  );
  assert.ok(
    initialSelectionFactoryIndex < initialSelectionCallIndex,
    'initial selection must run after its factory is created'
  );
});

test('editor ready sequence keeps ready finalizer after initial selection', () => {
  const initialSelectionCallIndex = indexOfRequired(editorSource, 'applyEditorInitialSelection();');
  const readyFinalizerFactoryIndex = indexOfRequired(
    editorSource,
    'const finalizeEditorReady = createEditorReadyFinalizer({'
  );
  const readyFinalizerCallIndex = indexOfRequired(editorSource, 'finalizeEditorReady();');

  assert.ok(
    initialSelectionCallIndex < readyFinalizerFactoryIndex,
    'ready finalizer factory must be created after initial selection'
  );
  assert.ok(
    readyFinalizerFactoryIndex < readyFinalizerCallIndex,
    'ready finalizer must run after its factory is created'
  );
});

test('editor ready sequence preserves initial selection payload', () => {
  const factoryIndex = indexOfRequired(
    editorSource,
    'const applyEditorInitialSelection = createEditorInitialSelectionApplier({'
  );
  const callIndex = indexOfRequired(editorSource, 'applyEditorInitialSelection();');
  const block = editorSource.slice(factoryIndex, callIndex);

  assert.match(block, /getTreeMemories:\s*\(\)\s*=>\s*treeMemories\(\)/);
  assert.match(block, /getSelectedNodeId:\s*\(\)\s*=>\s*selectedNodeId/);
  assert.match(block, /createInitialMemory,/);
  assert.match(block, /isRootMemory,/);
  assert.match(block, /getCanonicalRootId:\s*\(\)\s*=>\s*canonicalRootId/);
  assert.match(block, /setCurrentEditingMemory:\s*\(value\)\s*=>\s*\{ currentEditingMemory = value; \}/);
  assert.match(block, /log/);
});

test('editor ready sequence preserves ready finalizer payload', () => {
  const factoryIndex = indexOfRequired(
    editorSource,
    'const finalizeEditorReady = createEditorReadyFinalizer({'
  );
  const callIndex = indexOfRequired(editorSource, 'finalizeEditorReady();');
  const block = editorSource.slice(factoryIndex, callIndex);

  assert.match(block, /updateSidebarStatus,/);
  assert.match(block, /markEditorReady,/);
  assert.match(block, /log/);
});

test('editor ready sequence remains before auth registration exits entrypoint', () => {
  const readyFinalizerCallIndex = indexOfRequired(editorSource, 'finalizeEditorReady();');
  const registerIndex = indexOfRequired(editorSource, 'deps.registerEditorAuthStart({');

  assert.ok(
    readyFinalizerCallIndex < registerIndex,
    'ready finalizer call should remain inside startEditor before auth start registration block'
  );
});
