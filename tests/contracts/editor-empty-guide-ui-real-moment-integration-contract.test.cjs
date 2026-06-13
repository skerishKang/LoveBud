/**
 * editor-empty-guide-ui-real-moment-integration-contract.test.cjs
 *
 * PR #2448: empty guide UI integration contract.
 *
 * - editor-empty-guide-ui.js가 hasRealMomentContent를 통해
 *   list-aware "real visible moment" 판정을 함을 source-level로 lock.
 * - inline fallback이 root helper와 같은 ROOT_PLACEHOLDER_TITLES 집합을 가진
 *   real-content 검사를 포함함을 lock.
 * - canvasEmptyGuide hide/show 로직이 hasVisibleMoment 결과를 반영함을
 *   integration test로 lock.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function createGuide() {
  const classes = new Set();
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
    _classes: classes,
  };
}

function loadAll(documentRef) {
  const context = { window: {}, document: documentRef, console: { warn() {} } };
  vm.createContext(context);
  vm.runInContext(read('js/editor/editor-root-helpers.js'), context);
  vm.runInContext(read('js/editor/editor-empty-guide-ui.js'), context);
  return context;
}

function runUpdate(memories) {
  const guide = createGuide();
  const doc = { getElementById: (id) => (id === 'canvasEmptyGuide' ? guide : null) };
  const ctx = loadAll(doc);
  const update = ctx.window.LoveBudEditorEmptyGuideUI.createCanvasEmptyGuideUpdater({
    getTreeMemories: () => memories,
    log() {},
  });
  update();
  return guide;
}

test('empty guide UI source uses hasRealMomentContent for list-aware visible moment detection', () => {
  const source = read('js/editor/editor-empty-guide-ui.js');

  // hasRealMomentContent를 import하거나 정의해야 함
  assert.match(source, /hasRealMomentContent/);

  // hasVisibleMoment 안에 isRootLikeMemory 단독 체크만 있지 않고,
  // hasRealMomentContent를 함께 봐야 함
  const hasVisibleMomentMatch = source.match(/function\s+hasVisibleMoment[\s\S]*?\n\s{4}\}/);
  assert.ok(hasVisibleMomentMatch, 'hasVisibleMoment function must exist');
  const body = hasVisibleMomentMatch[0];
  assert.match(body, /hasRealMomentContent/, 'hasVisibleMoment must consult hasRealMomentContent');
});

test('empty guide UI source defines inline ROOT_PLACEHOLDER_TITLES fallback aligned with root helper', () => {
  const source = read('js/editor/editor-empty-guide-ui.js');

  // inline fallback이 root helper와 같은 placeholder title set을 가져야 함
  assert.match(source, /ROOT_PLACEHOLDER_TITLES/);
  // placeholder 기본명 일부
  assert.match(source, /['"]root['"]/);
  assert.match(source, /['"]루트['"]/);
  assert.match(source, /['"]새 트리['"]/);
});

test('integration: PSY-like single moment → empty guide hidden (production regression guard)', () => {
  const guide = runUpdate([{
    id: '19ad873f-...',
    parentId: null,
    title: 'PSY - GANGNAM STYLE(강남스타일) M/V',
    source: 'YouTube',
    sourceUrl: 'https://www.youtube.com/embed/9bZkp7q19f0',
    thumbnail: 'https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg',
  }]);
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), true);
});

test('integration: real moment with text content only (memo) → empty guide hidden', () => {
  const guide = runUpdate([{
    id: 'm1',
    parentId: null,
    memo: '오늘 본 첫 순간',
  }]);
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), true);
});

test('integration: real moment with quote only → empty guide hidden', () => {
  const guide = runUpdate([{
    id: 'm1',
    parentId: null,
    quote: '인상 깊은 말',
  }]);
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), true);
});

test('integration: real moment with emotionTags only → empty guide hidden', () => {
  const guide = runUpdate([{
    id: 'm1',
    parentId: null,
    emotionTags: ['joy', 'first'],
  }]);
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), true);
});

test('integration: empty placeholder (no content) → empty guide visible', () => {
  const guide = runUpdate([{ id: 'tree-root', parentId: null }]);
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), false);
});

test('integration: placeholder title only ("root", "루트", "새 트리") → empty guide visible', () => {
  const titles = ['root', 'Root', '루트', '새 트리', '새 러브트리', 'untitled'];
  titles.forEach((title) => {
    const guide = runUpdate([{ id: 'm1', parentId: null, title }]);
    assert.equal(
      guide.classList.contains('editor-canvas-empty-guide-hidden'),
      false,
      `placeholder title "${title}" must not trigger hidden`,
    );
  });
});

test('integration: real moment with meaningful title → empty guide hidden', () => {
  const guide = runUpdate([{ id: 'm1', parentId: null, title: 'PSY - GANGNAM STYLE' }]);
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), true);
});

test('integration: legacy root + real child (with title) → empty guide hidden', () => {
  // PR #2448 핵심: real child with title → 가이드 hidden
  const guide = runUpdate([
    { id: 'root', parentId: null },
    { id: 'real-child', parentId: null, title: 'First real moment' },
  ]);
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), true);
});

test('integration: legacy root + placeholder child (no content) → empty guide visible', () => {
  // PR #2446 호환: 둘 다 root-like → visible
  const guide = runUpdate([
    { id: 'root', parentId: null },
    { id: 'real-child', parentId: null },
  ]);
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), false);
});

test('integration: blank-parent root placeholder → empty guide visible even with real content on it', () => {
  // PR #2448: blank-parent는 무조건 root placeholder (real content 있어도)
  const guide = runUpdate([
    { id: 'tree-root', parentId: '', title: 'PSY', sourceUrl: 'x' },
  ]);
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), false);
});

test('integration: self-parent root placeholder → empty guide visible even with real content on it', () => {
  const guide = runUpdate([
    { id: 'tree-root', parentId: 'tree-root', sourceUrl: 'x' },
  ]);
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), false);
});

test('integration: empty array → empty guide visible', () => {
  const guide = runUpdate([]);
  assert.equal(guide.classList.contains('editor-canvas-empty-guide-hidden'), false);
});
