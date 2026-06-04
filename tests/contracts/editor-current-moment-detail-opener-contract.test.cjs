const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const shellHelpersSource = fs.readFileSync('js/editor/editor-shell-helpers.js', 'utf8');
const editorSource = fs.readFileSync('js/editor.js', 'utf8');

function loadShellHelpers() {
  const context = {
    window: {
      location: { href: 'https://example.test/pages/editor.html?treeId=tree-1' }
    },
    console
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(shellHelpersSource, context);
  return context.window.LoveBudEditorShellHelpers;
}

test('shell helpers expose current moment detail opener factory contract', () => {
  assert.match(shellHelpersSource, /createCurrentMomentDetailOpener:\s*function\(options\)/);
  assert.match(shellHelpersSource, /var getCurrentEditingMemory\s*=\s*opts\.getCurrentEditingMemory/);
  assert.match(shellHelpersSource, /var getTreeMemories\s*=\s*opts\.getTreeMemories/);
  assert.match(shellHelpersSource, /var getSelectedNodeId\s*=\s*opts\.getSelectedNodeId/);
  assert.match(shellHelpersSource, /var createInitialMemory\s*=\s*opts\.createInitialMemory/);
  assert.match(shellHelpersSource, /var getTreeId\s*=\s*opts\.getTreeId/);
  assert.match(shellHelpersSource, /var editorPageHelpers\s*=\s*opts\.editorPageHelpers/);
});

test('current moment detail opener preserves active memory selection order', () => {
  const currentIndex = shellHelpersSource.indexOf('getCurrentEditingMemory()');
  const selectedIndex = shellHelpersSource.indexOf('treeMemories.find');
  const initialIndex = shellHelpersSource.indexOf('createInitialMemory()');

  assert.ok(currentIndex !== -1);
  assert.ok(selectedIndex !== -1);
  assert.ok(initialIndex !== -1);
  assert.ok(currentIndex < selectedIndex);
  assert.ok(selectedIndex < initialIndex);
});

test('current moment detail opener opens current editing memory first', () => {
  const shellHelpers = loadShellHelpers();
  const calls = [];

  const openCurrentMomentDetail = shellHelpers.createCurrentMomentDetailOpener({
    getCurrentEditingMemory: () => ({ id: 'current-1' }),
    getTreeMemories: () => [{ id: 'selected-1' }],
    getSelectedNodeId: () => 'selected-1',
    createInitialMemory: () => ({ id: 'initial-1' }),
    getTreeId: () => 'tree-1',
    editorPageHelpers: {
      openMomentDetail: (payload) => calls.push(payload)
    },
    getEditorBasePath: () => 'pages/',
    locationRef: { href: 'before' },
    reportError: assert.fail
  });

  openCurrentMomentDetail();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].memoryId, 'current-1');
  assert.equal(calls[0].treeId, 'tree-1');
  assert.equal(typeof calls[0].getEditorBasePath, 'function');
  assert.deepEqual(calls[0].locationRef, { href: 'before' });
});

test('current moment detail opener falls back to selected tree memory', () => {
  const shellHelpers = loadShellHelpers();
  const calls = [];

  const openCurrentMomentDetail = shellHelpers.createCurrentMomentDetailOpener({
    getCurrentEditingMemory: () => null,
    getTreeMemories: () => [{ id: 'other-1' }, { id: 'selected-1' }],
    getSelectedNodeId: () => 'selected-1',
    createInitialMemory: () => ({ id: 'initial-1' }),
    getTreeId: () => 'tree-1',
    editorPageHelpers: {
      openMomentDetail: (payload) => calls.push(payload)
    }
  });

  openCurrentMomentDetail();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].memoryId, 'selected-1');
});

test('current moment detail opener falls back to initial memory when no current or selected memory exists', () => {
  const shellHelpers = loadShellHelpers();
  const calls = [];

  const openCurrentMomentDetail = shellHelpers.createCurrentMomentDetailOpener({
    getCurrentEditingMemory: () => null,
    getTreeMemories: () => [],
    getSelectedNodeId: () => 'missing-1',
    createInitialMemory: () => ({ id: 'initial-1' }),
    getTreeId: () => 'tree-1',
    editorPageHelpers: {
      openMomentDetail: (payload) => calls.push(payload)
    }
  });

  openCurrentMomentDetail();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].memoryId, 'initial-1');
});

test('current moment detail opener does not route without active memory or tree id', () => {
  const shellHelpers = loadShellHelpers();
  const calls = [];

  const missingMemoryOpener = shellHelpers.createCurrentMomentDetailOpener({
    getCurrentEditingMemory: () => null,
    getTreeMemories: () => [],
    getSelectedNodeId: () => null,
    createInitialMemory: () => null,
    getTreeId: () => 'tree-1',
    editorPageHelpers: {
      openMomentDetail: (payload) => calls.push(payload)
    }
  });

  missingMemoryOpener();

  const missingTreeOpener = shellHelpers.createCurrentMomentDetailOpener({
    getCurrentEditingMemory: () => ({ id: 'current-1' }),
    getTreeMemories: () => [],
    getSelectedNodeId: () => null,
    createInitialMemory: () => null,
    getTreeId: () => null,
    editorPageHelpers: {
      openMomentDetail: (payload) => calls.push(payload)
    }
  });

  missingTreeOpener();

  assert.equal(calls.length, 0);
});

test('current moment detail opener reports missing page helper instead of routing', () => {
  const shellHelpers = loadShellHelpers();
  const errors = [];

  const openCurrentMomentDetail = shellHelpers.createCurrentMomentDetailOpener({
    getCurrentEditingMemory: () => ({ id: 'current-1' }),
    getTreeMemories: () => [],
    getSelectedNodeId: () => null,
    createInitialMemory: () => null,
    getTreeId: () => 'tree-1',
    editorPageHelpers: {},
    reportError: (message) => errors.push(message)
  });

  openCurrentMomentDetail();

  assert.deepEqual(errors, ['LoveBudEditorPageHelpers.openMomentDetail missing']);
});

test('editor entrypoint delegates current moment detail opener through required shell helper', () => {
  assert.match(
    editorSource,
    /const\s+createCurrentMomentDetailOpener\s*=\s*deps\.createCurrentMomentDetailOpener/
  );
  assert.doesNotMatch(
    editorSource,
    /const\s+createCurrentMomentDetailOpener\s*=\s*deps\.createCurrentMomentDetailOpener\s*\|\|/
  );
  assert.match(
    editorSource,
    /LoveBudEditorShellHelpers\.createCurrentMomentDetailOpener missing/
  );
  assert.match(
    editorSource,
    /const\s+openCurrentMomentDetail\s*=\s*createCurrentMomentDetailOpener\(\{/
  );
});
