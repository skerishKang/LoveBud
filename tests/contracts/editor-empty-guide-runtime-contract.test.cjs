const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function loadEmptyGuideUI(documentRef) {
  const context = {
    window: {},
    document: documentRef,
    console: { warn() {} },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/editor/editor-empty-guide-ui.js', 'utf8'), context);
  return context.window.LoveBudEditorEmptyGuideUI;
}

function createGuide() {
  const classes = new Set(['editor-canvas-empty-guide-hidden']);
  return {
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
  };
}

function assertGuideVisibleFor(memories) {
  const guide = createGuide();
  const documentRef = {
    getElementById(id) {
      return id === 'canvasEmptyGuide' ? guide : null;
    },
  };
  const emptyGuideUI = loadEmptyGuideUI(documentRef);
  const updateCanvasEmptyGuide = emptyGuideUI.createCanvasEmptyGuideUpdater({
    getTreeMemories: () => memories,
    log() {},
  });

  updateCanvasEmptyGuide();

  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), false);
}

test('empty guide runtime shows guide for root-only tree memories', () => {
  assertGuideVisibleFor([{ id: 'root', parentId: null, title: 'LoveTree' }]);
});

test('empty guide runtime shows guide for uuid root-only tree memories', () => {
  assertGuideVisibleFor([{ id: 'tree-root-id', parentId: null, title: 'LoveTree' }]);
});

test('empty guide runtime shows guide for blank-parent root placeholder', () => {
  assertGuideVisibleFor([{ id: 'tree-root-id', parentId: '', title: 'LoveTree' }]);
});

test('empty guide runtime shows guide for self-parent root placeholder', () => {
  assertGuideVisibleFor([{ id: 'tree-root-id', parentId: 'tree-root-id', title: 'LoveTree' }]);
});

test('empty guide runtime hides guide when a non-root moment exists', () => {
  const guide = createGuide();
  const documentRef = {
    getElementById(id) {
      return id === 'canvasEmptyGuide' ? guide : null;
    },
  };
  const emptyGuideUI = loadEmptyGuideUI(documentRef);
  const updateCanvasEmptyGuide = emptyGuideUI.createCanvasEmptyGuideUpdater({
    getTreeMemories: () => [
      { id: 'root', parentId: null, title: 'LoveTree' },
      { id: 'moment-1', parentId: 'root', title: 'First moment' },
    ],
    log() {},
  });

  updateCanvasEmptyGuide();

  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), true);
});

test('editor page cache-busts empty guide runtime script', () => {
  const editorPage = fs.readFileSync('pages/editor.html', 'utf8');

  assert.match(editorPage, /\.\.\/js\/editor\/editor-empty-guide-ui\.js\?v=20260612-2441/);
  assert.doesNotMatch(editorPage, /\.\.\/js\/editor\/editor-empty-guide-ui\.js\?v=20260523-1276/);
});
