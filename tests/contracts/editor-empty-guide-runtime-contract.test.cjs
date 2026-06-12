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
  // Root helper 공통 predicate를 우선 사용하므로 root helpers도 함께 로드
  vm.runInContext(fs.readFileSync('js/editor/editor-root-helpers.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('js/editor/editor-empty-guide-ui.js', 'utf8'), context);
  return {
    rootUtils: context.window.LoveBudEditorUtils,
    emptyGuideUI: context.window.LoveBudEditorEmptyGuideUI,
  };
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
  const { emptyGuideUI } = loadEmptyGuideUI(documentRef);
  const updateCanvasEmptyGuide = emptyGuideUI.createCanvasEmptyGuideUpdater({
    getTreeMemories: () => memories,
    log() {},
  });

  updateCanvasEmptyGuide();

  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), false);
}

function assertGuideHiddenFor(memories) {
  const guide = createGuide();
  const documentRef = {
    getElementById(id) {
      return id === 'canvasEmptyGuide' ? guide : null;
    },
  };
  const { emptyGuideUI } = loadEmptyGuideUI(documentRef);
  const updateCanvasEmptyGuide = emptyGuideUI.createCanvasEmptyGuideUpdater({
    getTreeMemories: () => memories,
    log() {},
  });

  updateCanvasEmptyGuide();

  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), true);
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

test('empty guide runtime shows guide when only legacy root exists with real child having parentId null', () => {
  // legacy { id: 'root' } + real child whose parentId === null
  // real child는 root-like로 분류되지만, legacy root가 canonical root.
  // real child는 root-like 이므로 가이드는 여전히 visible (real moment 아님).
  assertGuideVisibleFor([
    { id: 'root', parentId: null, title: 'LoveTree' },
    { id: 'real-child', parentId: null, title: 'First real moment' },
  ]);
});

test('empty guide runtime hides guide when a non-root moment exists', () => {
  assertGuideHiddenFor([
    { id: 'root', parentId: null, title: 'LoveTree' },
    { id: 'moment-1', parentId: 'root', title: 'First moment' },
  ]);
});

test('empty guide runtime hides guide when uuid root placeholder has a non-root child', () => {
  // blank-parent root placeholder + real child with proper parentId
  assertGuideHiddenFor([
    { id: 'tree-root-id', parentId: '', title: 'LoveTree' },
    { id: 'moment-1', parentId: 'tree-root-id', title: 'First moment' },
  ]);
});

test('empty guide runtime hides guide when self-parent root placeholder has a non-root child', () => {
  assertGuideHiddenFor([
    { id: 'tree-root-id', parentId: 'tree-root-id', title: 'LoveTree' },
    { id: 'moment-1', parentId: 'tree-root-id', title: 'First moment' },
  ]);
});

test('root helper findRootMemory picks legacy root over real child with parentId null', () => {
  const documentRef = { getElementById() { return null; } };
  const { rootUtils } = loadEmptyGuideUI(documentRef);
  const root = rootUtils.findRootMemory([
    { id: 'root', parentId: null, title: 'LoveTree' },
    { id: 'real-child', parentId: null, title: 'First real moment' },
  ]);
  assert.equal(root && root.id, 'root');
});

test('root helper findRootMemory picks blank-parent root placeholder', () => {
  const documentRef = { getElementById() { return null; } };
  const { rootUtils } = loadEmptyGuideUI(documentRef);
  const root = rootUtils.findRootMemory([
    { id: 'tree-root-id', parentId: '', title: 'LoveTree' },
  ]);
  assert.equal(root && root.id, 'tree-root-id');
});

test('root helper findRootMemory picks self-parent root placeholder', () => {
  const documentRef = { getElementById() { return null; } };
  const { rootUtils } = loadEmptyGuideUI(documentRef);
  const root = rootUtils.findRootMemory([
    { id: 'tree-root-id', parentId: 'tree-root-id', title: 'LoveTree' },
  ]);
  assert.equal(root && root.id, 'tree-root-id');
});

test('root helper getCanonicalRootId matches root placeholder variants', () => {
  const documentRef = { getElementById() { return null; } };
  const { rootUtils } = loadEmptyGuideUI(documentRef);

  assert.equal(rootUtils.getCanonicalRootId([{ id: 'root', parentId: null }]), 'root');
  assert.equal(rootUtils.getCanonicalRootId([{ id: 'tree-root-id', parentId: null }]), 'tree-root-id');
  assert.equal(rootUtils.getCanonicalRootId([{ id: 'tree-root-id', parentId: '' }]), 'tree-root-id');
  assert.equal(rootUtils.getCanonicalRootId([{ id: 'tree-root-id', parentId: 'tree-root-id' }]), 'tree-root-id');
  assert.equal(rootUtils.getCanonicalRootId([
    { id: 'root', parentId: null },
    { id: 'real-child', parentId: null },
  ]), 'root');
});

test('root helper isRootLikeMemory agrees with empty guide isRootLikeMemory fallback on all variants', () => {
  const documentRef = { getElementById() { return null; } };
  const { rootUtils, emptyGuideUI } = loadEmptyGuideUI(documentRef);

  // 5가지 root-like variant — 둘 다 true
  const rootLikeVariants = [
    { id: 'root', parentId: null },
    { id: 'tree-root-id', parentId: null },
    { id: 'tree-root-id', parentId: '' },
    { id: 'tree-root-id', parentId: 'tree-root-id' },
  ];
  rootLikeVariants.forEach((memory) => {
    assert.equal(rootUtils.isRootLikeMemory(memory), true, `root helper should treat ${JSON.stringify(memory)} as root-like`);
  });

  // empty guide는 root helper의 공통 predicate를 위임해서 사용한다.
  // 5가지 root-like variant에 대해 root helper와 같은 결과를 내야 한다.
  // 빈 가이드 isRootLikeMemory는 closure 내부 함수이므로 간접 검증:
  // root helper와 같은 메모리 셋에 대해 같은 가시성 결과를 내야 한다.
  const guide = createGuide();
  const docRef = { getElementById(id) { return id === 'canvasEmptyGuide' ? guide : null; } };
  const ctx = { window: {}, document: docRef, console: { warn() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('js/editor/editor-root-helpers.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('js/editor/editor-empty-guide-ui.js', 'utf8'), ctx);
  const updateCanvasEmptyGuide = ctx.window.LoveBudEditorEmptyGuideUI.createCanvasEmptyGuideUpdater({
    getTreeMemories: () => rootLikeVariants,
    log() {},
  });
  updateCanvasEmptyGuide();
  // 모든 root-like면 가이드는 visible (real moment 없음)
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), false);

  // real child 추가 시 가이드 hidden — root helper의 hasVisibleMoment과 같은 결과
  const guide2 = createGuide();
  const docRef2 = { getElementById(id) { return id === 'canvasEmptyGuide' ? guide2 : null; } };
  const ctx2 = { window: {}, document: docRef2, console: { warn() {} } };
  vm.createContext(ctx2);
  vm.runInContext(fs.readFileSync('js/editor/editor-root-helpers.js', 'utf8'), ctx2);
  vm.runInContext(fs.readFileSync('js/editor/editor-empty-guide-ui.js', 'utf8'), ctx2);
  const update2 = ctx2.window.LoveBudEditorEmptyGuideUI.createCanvasEmptyGuideUpdater({
    getTreeMemories: () => [
      { id: 'root', parentId: null },
      { id: 'real-child', parentId: 'root' },  // parentId: 'root' → not root-like
    ],
    log() {},
  });
  update2();
  assert.equal(guide2.classList.contains('editor-canvas-empty-guide-hidden'), true);
});

test('empty guide UI does not redefine its own local isRootLikeMemory when root helper is missing — fallback keeps same criteria', () => {
  // root helpers 로드하지 않은 컨텍스트에서 empty guide UI만 로드
  // → local fallback이 동작해야 하며, 같은 5가지 기준으로 판정해야 한다
  const guide = createGuide();
  const documentRef = {
    getElementById(id) { return id === 'canvasEmptyGuide' ? guide : null; },
  };
  const context = { window: {}, document: documentRef, console: { warn() {} } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/editor/editor-empty-guide-ui.js', 'utf8'), context);

  const updateCanvasEmptyGuide = context.window.LoveBudEditorEmptyGuideUI.createCanvasEmptyGuideUpdater({
    getTreeMemories: () => [
      { id: 'tree-root-id', parentId: '' },
      { id: 'tree-root-id', parentId: 'tree-root-id' },
    ],
    log() {},
  });
  updateCanvasEmptyGuide();
  // fallback도 같은 기준이므로 가이드 visible
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), false);
});

test('editor page cache-busts empty guide runtime script', () => {
  const editorPage = fs.readFileSync('pages/editor.html', 'utf8');

  assert.match(editorPage, /\.\.\/js\/editor\/editor-empty-guide-ui\.js\?v=20260613-2446/);
  assert.doesNotMatch(editorPage, /\.\.\/js\/editor\/editor-empty-guide-ui\.js\?v=20260612-2441/);
});
