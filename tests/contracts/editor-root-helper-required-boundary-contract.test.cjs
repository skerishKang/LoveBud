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
  const html = read('pages/editor.html');
  return Array.from(html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/g))
    .map((match) => match[1]);
}

function sourceIndex(sources, needle) {
  return sources.findIndex((src) => src.includes(needle));
}

test('editor root helpers load before editor utils and editor entry', () => {
  const sources = scriptSources();
  const rootHelpers = sourceIndex(sources, 'js/editor/editor-root-helpers.js');
  const editorUtils = sourceIndex(sources, 'js/editor/editor-utils.js');
  const editorEntry = sourceIndex(sources, 'js/editor.js');

  assert.notEqual(rootHelpers, -1, 'editor-root-helpers.js must be loaded');
  assert.notEqual(editorUtils, -1, 'editor-utils.js must be loaded');
  assert.notEqual(editorEntry, -1, 'editor.js must be loaded');
  assert.ok(rootHelpers < editorUtils, 'root helpers must load before editor utils');
  assert.ok(editorUtils < editorEntry, 'editor utils must load before editor entry');
});

test('root helpers export root utilities and editor utils preserve the namespace', () => {
  const context = { window: {} };
  vm.createContext(context);

  vm.runInContext(read('js/editor/editor-root-helpers.js'), context);
  assert.equal(typeof context.window.LoveBudEditorUtils.findRootMemory, 'function');
  assert.equal(typeof context.window.LoveBudEditorUtils.getRootId, 'function');
  assert.equal(typeof context.window.LoveBudEditorUtils.getCanonicalRootId, 'function');
  assert.equal(typeof context.window.LoveBudEditorUtils.isRootMemory, 'function');
  assert.equal(typeof context.window.LoveBudEditorUtils.isRootLikeMemory, 'function');

  const rootFindRootMemory = context.window.LoveBudEditorUtils.findRootMemory;
  vm.runInContext(read('js/editor/editor-utils.js'), context);

  assert.equal(context.window.LoveBudEditorUtils.findRootMemory, rootFindRootMemory);
  assert.equal(typeof context.window.LoveBudEditorUtils.getYouTubeInputErrorMessage, 'function');

  const editorUtils = read('js/editor/editor-utils.js');
  assert.match(editorUtils, /const\s+utils\s*=\s*window\.LoveBudEditorUtils\s*\|\|\s*\{\}/);
  assert.match(editorUtils, /window\.LoveBudEditorUtils\s*=\s*utils/);
});

test('root helper isRootLikeMemory covers all five root placeholder variants', () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read('js/editor/editor-root-helpers.js'), context);
  const isRootLike = context.window.LoveBudEditorUtils.isRootLikeMemory;

  // 5가지 root-like variant — 모두 true
  assert.equal(isRootLike({ id: 'root', parentId: null }), true, 'legacy root');
  assert.equal(isRootLike({ id: 'tree-root-id', parentId: null }), true, 'parentId null');
  assert.equal(isRootLike({ id: 'tree-root-id', parentId: undefined }), true, 'parentId undefined');
  assert.equal(isRootLike({ id: 'tree-root-id', parentId: '' }), true, 'parentId blank');
  assert.equal(isRootLike({ id: 'tree-root-id', parentId: 'tree-root-id' }), true, 'self-parent');

  // non-root는 false
  assert.equal(isRootLike({ id: 'moment-1', parentId: 'root' }), false, 'real child of root');
  assert.equal(isRootLike({ id: 'moment-1', parentId: 'tree-root-id' }), false, 'real child of uuid root');
  assert.equal(isRootLike(null), false, 'null is not root-like');
  assert.equal(isRootLike(undefined), false, 'undefined is not root-like');
  // 빈 객체는 parentId === undefined로 root-like (지시서 3번 케이스)
  assert.equal(isRootLike({ id: 'tree-root-id' }), true, 'parentId undefined is root-like');
});

test('root helper findRootMemory aligns with isRootLikeMemory for all placeholder variants', () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read('js/editor/editor-root-helpers.js'), context);
  const { findRootMemory, getCanonicalRootId } = context.window.LoveBudEditorUtils;

  // 5가지 root-only 케이스 — 각자 자신이 root
  assert.equal(findRootMemory([{ id: 'root', parentId: null }])?.id, 'root');
  assert.equal(findRootMemory([{ id: 'tree-root-id', parentId: null }])?.id, 'tree-root-id');
  assert.equal(findRootMemory([{ id: 'tree-root-id', parentId: undefined }])?.id, 'tree-root-id');
  assert.equal(findRootMemory([{ id: 'tree-root-id', parentId: '' }])?.id, 'tree-root-id');
  assert.equal(findRootMemory([{ id: 'tree-root-id', parentId: 'tree-root-id' }])?.id, 'tree-root-id');

  // getCanonicalRootId도 같은 root를 가리킴
  assert.equal(getCanonicalRootId([{ id: 'tree-root-id', parentId: '' }]), 'tree-root-id');
  assert.equal(getCanonicalRootId([{ id: 'tree-root-id', parentId: 'tree-root-id' }]), 'tree-root-id');
});

test('root helper findRootMemory prefers legacy root over real child with parentId null', () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read('js/editor/editor-root-helpers.js'), context);
  const { findRootMemory, getCanonicalRootId } = context.window.LoveBudEditorUtils;

  // memories에 { id: 'root' }가 있고, real child가 parentId: null인 경우
  // → legacy 'root'가 canonical root. real child를 root로 오인하면 안 됨.
  const memories = [
    { id: 'root', parentId: null, title: 'LoveTree' },
    { id: 'real-child', parentId: null, title: 'First real moment' },
  ];
  const root = findRootMemory(memories);
  assert.equal(root?.id, 'root', 'legacy root must win over real child with parentId null');
  assert.equal(getCanonicalRootId(memories), 'root');
});

test('root helper findRootMemory returns null for memories with no root-like node', () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read('js/editor/editor-root-helpers.js'), context);
  const { findRootMemory } = context.window.LoveBudEditorUtils;

  // 모든 메모리가 실제 child (parentId가 다른 노드) — root-like 없음
  assert.equal(findRootMemory([
    { id: 'moment-1', parentId: 'root' },
    { id: 'moment-2', parentId: 'root' },
  ]), null);

  // 빈 배열
  assert.equal(findRootMemory([]), null);
  // 비-배열
  assert.equal(findRootMemory(null), null);
  assert.equal(findRootMemory(undefined), null);
});

test('root helpers load before editor empty guide UI script', () => {
  const sources = scriptSources();
  const rootHelpers = sourceIndex(sources, 'js/editor/editor-root-helpers.js');
  const emptyGuideUI = sourceIndex(sources, 'js/editor/editor-empty-guide-ui.js');

  assert.notEqual(rootHelpers, -1, 'editor-root-helpers.js must be loaded');
  assert.notEqual(emptyGuideUI, -1, 'editor-empty-guide-ui.js must be loaded');
  assert.ok(rootHelpers < emptyGuideUI, 'root helpers must load before empty guide UI');
});

test('editor entry requires preloaded root helper utilities through deps without inline fallbacks', () => {
  const editor = read('js/editor.js');

  assert.match(editor, /deps\.findRootMemory/);
  assert.match(editor, /deps\.getCanonicalRootId/);
  assert.match(editor, /deps\.isRootMemory/);
  assert.doesNotMatch(editor, /const\s+rootUtils\s*=\s*deps\.rootUtils/);
  assert.doesNotMatch(editor, /const\s+missingRootHelpers\s*=\s*\[/);

  assert.doesNotMatch(editor, /rootHelperWarningShown/);
  assert.doesNotMatch(editor, /warnRootHelperFallback/);
  assert.doesNotMatch(editor, /LoveBudEditorUtils not loaded, using local fallback for root helpers/);
  assert.doesNotMatch(editor, /const\s+findRootMemory\s*=\s*function/);
  assert.doesNotMatch(editor, /const\s+getRootId\s*=\s*function/);
  assert.doesNotMatch(editor, /const\s+getCanonicalRootId\s*=\s*function/);
  assert.doesNotMatch(editor, /const\s+isRootMemory\s*=\s*function/);
});

test('editor entry keeps root helper usage contracts', () => {
  const editor = read('js/editor.js');
  const refreshSaveRuntime = read('js/editor/editor-refresh-save-runtime.js');
  const runtimeSources = `${editor}\n${refreshSaveRuntime}`;

  assert.match(editor, /createInitialMemory[\s\S]*findRootMemory/);
  assert.match(editor, /canonicalRootId\s*=.*getCanonicalRootId\(treeMemories\(\)\)/);
  assert.match(editor, /applyEditorInitialSelection\(\);/);
  assert.match(runtimeSources, /isRootMemory\(refreshedEditingMemory,\s*canonicalRootId\)/);
  assert.match(editor, /memoryActions[\s\S]*isRootMemory[\s\S]*findRootMemory/);
  assert.match(editor, /detailUI[\s\S]*isRootMemory/);
  assert.match(editor, /editorCanvas[\s\S]*isRootMemory/);
});
