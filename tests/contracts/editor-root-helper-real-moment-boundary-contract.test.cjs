/**
 * editor-root-helper-real-moment-boundary-contract.test.cjs
 *
 * PR #2448: "rootless real moments vs root placeholders" 핵심 invariant lock.
 *
 * editor-root-helpers.js의 hasRealMomentContent, isRootLikeMemory, findRootMemory
 * 가 PR #2448의 real-content-aware 기준으로 동작함을 lock.
 *
 * 핵심 규칙:
 *   - id === 'root'               → 무조건 root-like
 *   - parentId === ''              → 무조건 root-like (blank-parent placeholder)
 *   - parentId === memory.id       → 무조건 root-like (self-parent placeholder)
 *   - parentId === null/undefined:
 *     - hasRealMomentContent(m) === true  → real moment (root 아님)
 *     - hasRealMomentContent(m) === false → root-like (legacy placeholder)
 *
 * filterMemoriesForTree() (PR #2447)는 이 helper를 직접 사용하지 않고
 * treeId 매칭을 최우선으로 한다는 invariant도 함께 lock.
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

function loadRootHelpers() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read('js/editor/editor-root-helpers.js'), context);
  return context.window.LoveBudEditorUtils;
}

function assertVersionedAsset(html, assetPattern, message) {
  assert.match(html, new RegExp(assetPattern + "\\?v=[A-Za-z0-9][A-Za-z0-9._-]*['\"]"), message);
}

test('hasRealMomentContent detects real moment from each strong signal', () => {
  const utils = loadRootHelpers();
  assert.equal(typeof utils.hasRealMomentContent, 'function');

  // sourceUrl
  assert.equal(utils.hasRealMomentContent({ sourceUrl: 'https://youtu.be/abc' }), true);
  // source
  assert.equal(utils.hasRealMomentContent({ source: 'YouTube' }), true);
  // thumbnail
  assert.equal(utils.hasRealMomentContent({ thumbnail: 'https://img/abc.jpg' }), true);
  // memo
  assert.equal(utils.hasRealMomentContent({ memo: 'some memo' }), true);
  // quote
  assert.equal(utils.hasRealMomentContent({ quote: 'some quote' }), true);
  // emotionTags (non-empty)
  assert.equal(utils.hasRealMomentContent({ emotionTags: ['joy'] }), true);
  assert.equal(utils.hasRealMomentContent({ emotionTags: [] }), false);
});

test('hasRealMomentContent detects real moment from meaningful title', () => {
  const utils = loadRootHelpers();

  // 의미있는 title은 real moment
  assert.equal(utils.hasRealMomentContent({ title: 'PSY - GANGNAM STYLE' }), true);
  assert.equal(utils.hasRealMomentContent({ title: '첫 순간' }), true);

  // placeholder 기본명은 real 아님
  assert.equal(utils.hasRealMomentContent({ title: 'root' }), false);
  assert.equal(utils.hasRealMomentContent({ title: '루트' }), false);
  assert.equal(utils.hasRealMomentContent({ title: '새 트리' }), false);
  assert.equal(utils.hasRealMomentContent({ title: 'untitled' }), false);

  // 빈 title은 real 아님
  assert.equal(utils.hasRealMomentContent({ title: '' }), false);
  assert.equal(utils.hasRealMomentContent({ title: '   ' }), false);
  assert.equal(utils.hasRealMomentContent({}), false);
  assert.equal(utils.hasRealMomentContent(null), false);
  assert.equal(utils.hasRealMomentContent(undefined), false);
});

test('isRootLikeMemory always returns true for hard-coded root placeholders', () => {
  const utils = loadRootHelpers();

  // id === 'root' — content 무관, 무조건 root
  assert.equal(utils.isRootLikeMemory({ id: 'root', parentId: null, title: 'PSY' }), true);
  assert.equal(utils.isRootLikeMemory({ id: 'root', parentId: null, sourceUrl: 'x' }), true);
  // blank-parent
  assert.equal(utils.isRootLikeMemory({ id: 'uuid', parentId: '', title: 'PSY' }), true);
  // self-parent
  assert.equal(utils.isRootLikeMemory({ id: 'uuid', parentId: 'uuid', sourceUrl: 'x' }), true);
});

test('isRootLikeMemory treats parentId null with real content as real moment (not root)', () => {
  const utils = loadRootHelpers();

  // PSY 케이스 (production 발견)
  const psy = {
    id: '19ad873f-...',
    parentId: null,
    title: 'PSY - GANGNAM STYLE(강남스타일) M/V',
    source: 'YouTube',
    sourceUrl: 'https://www.youtube.com/embed/9bZkp7q19f0',
    thumbnail: 'https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg',
  };
  assert.equal(utils.isRootLikeMemory(psy), false, 'PSY-like with real content must not be root-like');

  // parentId: undefined + sourceUrl
  assert.equal(utils.isRootLikeMemory({ id: 'm1', parentId: undefined, sourceUrl: 'x' }), false);
  // parentId: null + memo
  assert.equal(utils.isRootLikeMemory({ id: 'm1', parentId: null, memo: 'note' }), false);
  // parentId: null + emotionTags
  assert.equal(utils.isRootLikeMemory({ id: 'm1', parentId: null, emotionTags: ['joy'] }), false);
  // parentId: null + meaningful title only
  assert.equal(utils.isRootLikeMemory({ id: 'm1', parentId: null, title: '내가 본 첫 순간' }), false);
});

test('isRootLikeMemory keeps parentId null as root when no real content exists (legacy placeholder)', () => {
  const utils = loadRootHelpers();

  // parentId null + 모든 content 비어있음 → root-like (legacy placeholder)
  assert.equal(utils.isRootLikeMemory({ id: 'm1', parentId: null }), true);
  // 빈 title도 root-like
  assert.equal(utils.isRootLikeMemory({ id: 'm1', parentId: null, title: '' }), true);
  // placeholder 기본명 title도 root-like
  assert.equal(utils.isRootLikeMemory({ id: 'm1', parentId: null, title: 'root' }), true);
  assert.equal(utils.isRootLikeMemory({ id: 'm1', parentId: null, title: '루트' }), true);
  // whitespace만
  assert.equal(utils.isRootLikeMemory({ id: 'm1', parentId: null, title: '   ' }), true);
});

test('findRootMemory returns null for PSY-like single real moment (no root placeholder)', () => {
  const utils = loadRootHelpers();

  const psy = {
    id: '19ad873f-...',
    parentId: null,
    title: 'PSY - GANGNAM STYLE',
    sourceUrl: 'https://youtu.be/abc',
  };
  // PSY는 root-like 아님 → findRootMemory는 null
  assert.equal(utils.findRootMemory([psy]), null);
  assert.equal(utils.getCanonicalRootId([psy]), 'root', 'no root-like → fallback to "root" string');
});

test('findRootMemory keeps legacy root as canonical even when real child exists with title', () => {
  const utils = loadRootHelpers();

  const memories = [
    { id: 'root', parentId: null, title: 'LoveTree' },
    { id: 'real-child', parentId: null, title: 'First real moment' },
  ];
  // root-like nodes = [root] (real-child는 real)
  // legacy root 우선
  assert.equal(utils.findRootMemory(memories)?.id, 'root');
  assert.equal(utils.getCanonicalRootId(memories), 'root');
});

test('findRootMemory picks blank-parent / self-parent root placeholders regardless of content', () => {
  const utils = loadRootHelpers();

  // blank-parent + real content여도 root placeholder
  const blank = { id: 'tree-root', parentId: '', title: 'PSY', sourceUrl: 'x' };
  assert.equal(utils.findRootMemory([blank])?.id, 'tree-root');

  // self-parent + real content여도 root placeholder
  const self = { id: 'tree-root', parentId: 'tree-root', sourceUrl: 'x' };
  assert.equal(utils.findRootMemory([self])?.id, 'tree-root');
});

test('isRootLikeMemory signature preserved (memory → boolean) for backward compat', () => {
  const utils = loadRootHelpers();

  // signature: takes 1 arg, returns boolean
  assert.equal(utils.isRootLikeMemory.length, 1);
  assert.equal(typeof utils.isRootLikeMemory({ id: 'root' }), 'boolean');
  assert.equal(typeof utils.isRootLikeMemory(null), 'boolean');
});

test('editor-data-loader.js filterMemoriesForTree does NOT use isRootLikeMemory directly (PR #2447 invariant)', () => {
  const dataLoader = read('js/editor/editor-data-loader.js');

  // PR #2447 invariant: filterMemoriesForTree는 treeId 매칭을 최우선으로 본다.
  // hasRealMomentContent/isRootLikeMemory/isCanonicalRootPlaceholder를 직접 호출하면 안 됨.
  // 함수 본문에서 .filter(isCanonicalRootPlaceholder ...) 같은 패턴이 없어야 함.
  const fnMatch = dataLoader.match(/function\s+filterMemoriesForTree[\s\S]*?\n\s{4}\}/);
  if (fnMatch) {
    const body = fnMatch[0];
    assert.doesNotMatch(body, /isCanonicalRootPlaceholder\s*\(/);
    assert.doesNotMatch(body, /isRootLikeMemory\s*\(/);
    assert.doesNotMatch(body, /hasRealMomentContent\s*\(/);
  } else {
    // 함수 본문을 못 찾으면 fail-safe로 isRootLikeMemory 호출이 없는지만 확인
    assert.doesNotMatch(dataLoader, /isRootLikeMemory\s*\(\s*memories?\b/);
  }
});

test('editor page cache-busts root helpers and CTA files to PR #2448/#2449', () => {
  const editorPage = read('pages/editor.html');
  const publicCanvas = read('pages/public-canvas.html');
  const viewPage = read('pages/view.html');

  // PR #2448: 셋 다 editor-root-helpers.js?v=20260613-2448 이상
  assert.match(editorPage, /\.\.\/js\/editor\/editor-root-helpers\.js\?v=20260613-2448/);
  assert.match(publicCanvas, /\.\.\/js\/editor\/editor-root-helpers\.js\?v=20260613-2448/);
  assert.match(viewPage, /\.\.\/js\/editor\/editor-root-helpers\.js\?v=20260613-2448/);

  // PR #2448: editor.html: editor-shell-canvas-ui/memory/helpers + editor.js도 2448 이상
  assert.match(editorPage, /\.\.\/js\/editor\/editor-shell-canvas-ui\.js\?v=20260613-2448/);
  assert.match(editorPage, /\.\.\/js\/editor\/editor-shell-memory\.js\?v=20260613-2448/);
  assert.match(editorPage, /\.\.\/js\/editor\/editor-shell-helpers\.js\?v=20260613-2448/);
  // RELEASE_TOKEN: editor.js must have non-empty version token, not hardcoded literal
  assertVersionedAsset(editorPage, '\\.\\./js/editor\\.js', 'editor.js must have non-empty version token');

  // PR #2449: editor-empty-guide-ui.js + editor-page-event-bindings.js + editor-empty-guide-template.js
  // + editor-panel-history.js 모두 ?v=20260613-2449로 bust
  assert.match(editorPage, /\.\.\/js\/editor\/editor-empty-guide-ui\.js\?v=20260613-2449/);
  assert.match(editorPage, /\.\.\/js\/editor\/editor-page-event-bindings\.js\?v=b052aca84130/);
  assert.match(
    editorPage,
    /\.\.\/js\/editor\/templates\/editor-empty-guide-template\.js\?v=20260613-2449/,
  );
  assert.match(editorPage, /\.\.\/js\/editor\/editor-panel-history\.js\?v=20260613-2449/);

  // 2446 stale 못 들어가게
  assert.doesNotMatch(editorPage, /editor-root-helpers\.js\?v=20260613-2446/);
  assert.doesNotMatch(editorPage, /editor-empty-guide-ui\.js\?v=20260613-2446/);
  assert.doesNotMatch(editorPage, /editor-shell-canvas-ui\.js\?v=20260605/);
  // RELEASE_TOKEN: reject only the definitively stale editor.js token, not any date-based token
  assert.doesNotMatch(editorPage, /editor\.js\?v=20260612-2400/);
});
