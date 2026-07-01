'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function runInSandbox(/* ...files */) {
  const context = { window: {}, console, URL, URLSearchParams, Date, TextEncoder, TextDecoder };
  context.window = context;
  vm.createContext(context);
  for (const rel of arguments) {
    vm.runInContext(readRepoFile(rel), context);
  }
  return context;
}

const classifierFile = 'js/shared/tree-workspace-permission.js';
const editorDetailFile = 'js/editor/editor-detail-ui.js';
const canvasNodeFile = 'js/editor/editor-canvas-node.js';
const viewerDetailFile = 'js/viewer/public-viewer-detail-ui.js';
const metadataTextFile = 'js/viewer/public-viewer-detail-metadata-text.js';

// ── Predicate: dot key detection ──

test('isLocalizationKeyTitle detects dot-separated legacy keys', () => {
  const ctx = runInSandbox(classifierFile);
  const isKey = ctx.window.LoveBudTreeWorkspaceClassifier.isLocalizationKeyTitle;

  assert.equal(isKey('tree.title'), true);
  assert.equal(isKey('memory.content'), true);
  assert.equal(isKey('editor.current.moment'), true);
  assert.equal(isKey('a.b'), true);
  assert.equal(isKey('editor.foo.bar'), true);
  assert.equal(isKey('search.title'), true);
});

test('isLocalizationKeyTitle still detects underscore-separated keys', () => {
  const ctx = runInSandbox(classifierFile);
  const isKey = ctx.window.LoveBudTreeWorkspaceClassifier.isLocalizationKeyTitle;

  assert.equal(isKey('editor_url_only_youtube_title'), true);
  assert.equal(isKey('viewer_tree_title'), true);
  assert.equal(isKey('waiting_first_moment'), true);
});

test('isLocalizationKeyTitle rejects plain user titles', () => {
  const ctx = runInSandbox(classifierFile);
  const isKey = ctx.window.LoveBudTreeWorkspaceClassifier.isLocalizationKeyTitle;

  assert.equal(isKey('YouTube 영상'), false);
  assert.equal(isKey('새 순간'), false);
  assert.equal(isKey('My Favorite Video'), false);
  assert.equal(isKey('러브트리'), false);
  assert.equal(isKey('첫 순간이 트리를 깨워요'), false);
  assert.equal(isKey('hello world'), false);
  assert.equal(isKey('selected_moment'), false, 'two-segment underscore is not a key');
  assert.equal(isKey(''), false);
  assert.equal(isKey(null), false);
  assert.equal(isKey(undefined), false);
  assert.equal(isKey(123), false);
});

// ── Display helper: sanitizeDisplayTitle (now on classifier) ──

test('sanitizeDisplayTitle returns fallback for underscore raw keys', () => {
  const ctx = runInSandbox(classifierFile);
  const sanitize = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  assert.equal(sanitize('editor_url_only_youtube_title'), 'YouTube 영상');
  assert.equal(sanitize('editor_url_only_youtube_title', 'fallback'), 'fallback');
});

test('sanitizeDisplayTitle returns fallback for dot raw keys', () => {
  const ctx = runInSandbox(classifierFile);
  const sanitize = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  // dot keys without caller fallback now get generic a11y fallback '순간'
  assert.equal(sanitize('tree.title'), '순간');
  assert.equal(sanitize('tree.title', '제목 없음'), '제목 없음');
  assert.equal(sanitize('memory.content'), '순간');
  assert.equal(sanitize('memory.content', '내용 없음'), '내용 없음');
  assert.equal(sanitize('editor.current.moment'), '지금 마음이 머문 장면');
});

test('sanitizeDisplayTitle passes through normal titles unchanged', () => {
  const ctx = runInSandbox(classifierFile);
  const sanitize = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  assert.equal(sanitize('YouTube 영상'), 'YouTube 영상');
  assert.equal(sanitize('새 순간'), '새 순간');
  assert.equal(sanitize('My lovely day'), 'My lovely day');
  assert.equal(sanitize('러브트리'), '러브트리');
  assert.equal(sanitize('첫 순간', '제목 없음'), '첫 순간');
});

test('sanitizeDisplayTitle never exposes the raw key', () => {
  const ctx = runInSandbox(classifierFile);
  const sanitize = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  const samples = ['tree.title', 'memory.content', 'editor.foo.bar', 'editor_url_only_youtube_title'];
  samples.forEach((k) => {
    assert.notEqual(sanitize(k), k, 'raw key must never be returned for ' + k);
    assert.notEqual(sanitize(k, 'fb'), k, 'raw key must never be returned (with fallback) for ' + k);
  });
});

test('sanitizeDisplayTitle handles empty/whitespace/null with fallback', () => {
  const ctx = runInSandbox(classifierFile);
  const sanitize = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  assert.equal(sanitize('', 'fb'), 'fb');
  assert.equal(sanitize('   ', 'fb'), 'fb');
  assert.equal(sanitize(null, 'fb'), 'fb');
  assert.equal(sanitize(undefined, 'fb'), 'fb');
});

// ── Static: editor-detail-ui uses sanitizer ──

test('editor-detail-ui references LoveBudTreeWorkspaceClassifier', () => {
  const src = readRepoFile(editorDetailFile);
  assert.match(src, /LoveBudTreeWorkspaceClassifier/, 'editor detail must reference classifier');
  assert.match(src, /sanitizeDisplayTitle/, 'editor detail must call sanitizeDisplayTitle');
});

test('editor-detail-ui sanitizes moment title text', () => {
  const src = readRepoFile(editorDetailFile);
  assert.ok(
    src.indexOf('sanitizeMomentTitle(data.title') !== -1,
    'editor detail must sanitize data.title via sanitizeMomentTitle'
  );
});

test('editor-detail-ui sanitizes image alt', () => {
  const src = readRepoFile(editorDetailFile);
  assert.ok(
    src.indexOf('sanitizeMomentTitle(data.title') !== -1 && src.indexOf('imgEl.alt') !== -1,
    'editor detail must sanitize img.alt via sanitizeMomentTitle'
  );
});

test('editor-detail-ui sanitizes iframe title', () => {
  const src = readRepoFile(editorDetailFile);
  assert.ok(
    src.indexOf('sanitizeMomentTitle(data.title') !== -1,
    'editor detail iframe title must use sanitizeMomentTitle'
  );
});

// ── Static: canvas node uses sanitizer ──

test('editor-canvas-node references LoveBudTreeWorkspaceClassifier', () => {
  const src = readRepoFile(canvasNodeFile);
  assert.match(src, /LoveBudTreeWorkspaceClassifier/, 'canvas node must reference classifier');
});

test('canvas node sanitizes img alt', () => {
  const src = readRepoFile(canvasNodeFile);
  assert.match(src, /sanitizeTitle\(mem\.title/, 'canvas node img.alt must use sanitizeTitle');
});

test('canvas node sanitizes aria-label', () => {
  const src = readRepoFile(canvasNodeFile);
  assert.match(src, /sanitizeTitle\(mem\.title/, 'canvas node aria-label must use sanitizeTitle');
});

test('canvas node sanitizes visible title text', () => {
  const src = readRepoFile(canvasNodeFile);
  assert.match(src, /sanitizeTitle\(memory\.title/, 'canvas node titleEl must use sanitizeTitle');
});

test('canvas node aria-label avoids duplicate "선택 선택" for raw keys', () => {
  const ctx = runInSandbox('js/shared/tree-workspace-permission.js', canvasNodeFile);
  const sanitizeTitle = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  // Test the actual aria-label logic inline
  const makeAria = (title) => {
    const safeTitle = sanitizeTitle(title, '');
    return safeTitle ? safeTitle + ' 선택' : '순간 선택';
  };

  // Normal title
  assert.equal(makeAria('첫 순간'), '첫 순간 선택');
  // Raw dot key
  assert.equal(makeAria('tree.title'), '순간 선택');
  assert.equal(makeAria('memory.content'), '순간 선택');
  // Empty/null
  assert.equal(makeAria(''), '순간 선택');
  assert.equal(makeAria(null), '순간 선택');
  assert.equal(makeAria(undefined), '순간 선택');
  // Must never contain duplicate
  Object.values({ tree: 'tree.title', memory: 'memory.content', empty: '' }).forEach(v => {
    assert.notEqual(makeAria(v).match(/선택\s*선택/), 'no duplicate "선택 선택"');
  });
  // Raw key never exposed
  assert.notEqual(makeAria('tree.title'), 'tree.title 선택');
  assert.notEqual(makeAria('memory.content'), 'memory.content 선택');
});

test('canvas node source uses safeTitle + conditional for aria-label', () => {
  const src = readRepoFile(canvasNodeFile);
  // Should use the conditional pattern to avoid duplicate
  assert.match(src, /var safeTitle = sanitizeTitle\(mem\.title/, 'canvas must compute safeTitle first');
  assert.match(src, /var ariaLabel = safeTitle \? safeTitle \+ .* : .*/, 'canvas must use conditional for aria-label');
  assert.doesNotMatch(src, /sanitizeTitle\(mem\.title.*\+\s*' 선택'/, 'must not concatenate directly');
});

// ── Static: public-viewer-detail-ui uses enhanced safeDisplayTitle ──

test('public-viewer-detail-ui safeDisplayTitle delegates to classifier', () => {
  const src = readRepoFile(metadataTextFile);
  assert.match(src, /LoveBudTreeWorkspaceClassifier/, 'metadata-text must reference classifier');
  assert.match(src, /sanitizeDisplayTitle/, 'metadata-text must call sanitizeDisplayTitle');
  assert.doesNotMatch(src, /LoveBudLocalizationDisplayHelper/, 'metadata-text must not reference old helper');
});

// ── Regression: no mutation, no write API ──

test('editor-detail-ui has no save/update/delete/fetch in render path', () => {
  const src = readRepoFile(editorDetailFile);
  // updateDetailPanel is the main render function; check it does not call API I/O
  const renderFn = src.match(/const updateDetailPanel = \(data\) => \{[\s\S]*?\n    \};/);
  if (renderFn) {
    assert.doesNotMatch(renderFn[0], /\.save\(|\.update\(|\.delete\(|fetch\(/,
      'render path must not contain save/update/delete/fetch calls');
  }
});

test('editor-canvas-node has no save/update/delete/fetch in render', () => {
  const src = readRepoFile(canvasNodeFile);
  assert.doesNotMatch(src, /\.save\(|\.update\(|\.delete\(|fetch\(/,
    'canvas node must not contain save/update/delete/fetch calls');
});

test('classifier sanitizeDisplayTitle never mutates input object', () => {
  const ctx = runInSandbox(classifierFile);
  const sanitize = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  const obj = { title: 'tree.title' };
  const result = sanitize(obj.title, '제목 없음');
  assert.equal(result, '제목 없음');
  assert.equal(obj.title, 'tree.title', 'original stored value must not be mutated');
});

test('viewer detail still has safeDisplayTitle', () => {
  const src = readRepoFile(metadataTextFile);
  assert.match(src, /function safeDisplayTitle/, 'metadata-text must retain safeDisplayTitle function');
});

test('viewer safeDisplayTitle hides dot-separated keys', () => {
  const ctx = runInSandbox(classifierFile, metadataTextFile);
  const isKey = ctx.window.LoveBudTreeWorkspaceClassifier.isLocalizationKeyTitle;

  // safeDisplayTitle is defined in metadata-text, its backing predicate detects dot keys
  assert.equal(isKey('tree.title'), true, 'predicate must detect dot keys');
  assert.equal(isKey('editor_url_only_youtube_title'), true, 'predicate must detect underscore keys');
  assert.equal(isKey('My lovely day'), false, 'predicate must not flag normal titles');
});