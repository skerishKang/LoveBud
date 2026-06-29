/**
 * Contract test: Browse preview share MVP (#2772).
 *
 * Validates:
 *   - Read-only URL builder encodes correctly
 *   - Social shell contains only share button + optional view count
 *   - Likes/comments/fake share count removed from hub patch
 *   - DOM patch no longer injects inactive social shell
 *   - Clipboard primary/fallback behaviour
 *   - Delegated handler single-bind
 *   - search.html script load order
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadShareLink(opts) {
  var src = read('js/search/search-share-link.js');
  var sandbox = {
    window: {
      location: { origin: 'https://example.test' },
      LoveBudSearchSharedUtils: opts && opts.sharedUtils ? opts.sharedUtils : null,
      LoveBudUI: opts && opts.ui ? opts.ui : null,
      LoveBudSecurity: { escapeHtml: function(v) {
        return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }},
      setTimeout: setTimeout
    },
    document: opts && opts.doc ? opts.doc : { createElement: function() { return { style: {}, value: '' }; }, body: { appendChild: function() {}, removeChild: function() {} }, execCommand: function() { return false; } },
    navigator: opts && opts.navigator ? opts.navigator : { clipboard: null },
    console: console,
    setTimeout: setTimeout,
    URL: URL,
    URLSearchParams: URLSearchParams,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.LoveBudSearchShareLink;
}

// ---------------------------------------------------------------------------
// 1. Read-only URL builder
// ---------------------------------------------------------------------------

test('buildReadOnlyTreeUrl with valid treeId', () => {
  var link = loadShareLink();
  var url = link.buildReadOnlyTreeUrl('abc-123');
  assert.ok(url.startsWith('https://example.test/pages/view.html?treeId='), 'must start with origin + path');
  assert.ok(url.includes('treeId=abc-123'), 'must contain treeId parameter');
});

test('buildReadOnlyTreeUrl encodes special characters', () => {
  var link = loadShareLink();
  var url = link.buildReadOnlyTreeUrl('my tree/id?query&foo=bar');
  // URLSearchParams encodes / as %2F, space as +, etc.
  assert.ok(url.includes('%2F'), 'must encode slash: ' + url);
  assert.ok(url.includes('%3F'), 'must encode question mark: ' + url);
  assert.ok(url.includes('%26'), 'must encode ampersand: ' + url);
  assert.ok(!url.includes(' '), 'must not contain raw spaces: ' + url);
});

test('buildReadOnlyTreeUrl returns empty string for falsy treeId', () => {
  var link = loadShareLink();
  assert.strictEqual(link.buildReadOnlyTreeUrl(''), '', 'empty string must return empty');
  assert.strictEqual(link.buildReadOnlyTreeUrl(null), '', 'null must return empty');
  assert.strictEqual(link.buildReadOnlyTreeUrl(undefined), '', 'undefined must return empty');
});

test('buildReadOnlyTreeUrl uses provided locationLike.origin', () => {
  var link = loadShareLink();
  var url = link.buildReadOnlyTreeUrl('t1', { origin: 'https://lovebud.pages.dev' });
  assert.ok(url.startsWith('https://lovebud.pages.dev/'), 'must use provided origin');
  assert.ok(url.includes('treeId=t1'), 'must include treeId');
});

test('buildReadOnlyTreeUrl uses URLSearchParams for proper encoding', () => {
  var link = loadShareLink();
  var url = link.buildReadOnlyTreeUrl('a&b=c/d?e');
  var expectedOrigin = 'https://example.test/pages/view.html';
  assert.ok(url.startsWith(expectedOrigin), 'must start with correct path');
  assert.ok(url.includes('treeId=' + encodeURIComponent('a&b=c/d?e')),
    'must properly encode special chars');
});

// ---------------------------------------------------------------------------
// 2. Social shell — share button + optional view count only
// ---------------------------------------------------------------------------

function makeSharedUtils(viewCountValue) {
  return {
    getViewCount: function(tree) { return viewCountValue !== undefined ? viewCountValue : null; },
    escapeHtml: function(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  };
}

test('social shell includes share button for valid tree ID', () => {
  var link = loadShareLink({ sharedUtils: makeSharedUtils() });
  var html = link.renderPreviewSocialShell({ id: 't1' });
  assert.ok(html.includes('data-preview-share-tree-id'), 'must have share button');
  assert.ok(html.includes('공유하기'), 'must have share label');
  assert.ok(!html.includes('data-preview-like'), 'must NOT have likes button');
  assert.ok(!html.includes('data-preview-comments'), 'must NOT have comments button');
});

test('social shell omits share button for missing tree ID', () => {
  var link = loadShareLink({ sharedUtils: makeSharedUtils(5) });
  var html = link.renderPreviewSocialShell({ id: '' });
  assert.ok(!html.includes('data-preview-share-tree-id'), 'must NOT have share button when treeId empty');
  // View count should still be shown
  assert.ok(html.includes('visibility'), 'must still show view count');
});

test('social shell shows view count 0', () => {
  var link = loadShareLink({ sharedUtils: makeSharedUtils(0) });
  var html = link.renderPreviewSocialShell({ id: 't1' });
  assert.ok(html.includes('visibility'), 'must show visibility for zero');
  assert.ok(html.includes('>0<'), 'must contain "0"');
});

test('social shell hides view count when absent', () => {
  var link = loadShareLink({ sharedUtils: makeSharedUtils() });
  var html = link.renderPreviewSocialShell({ id: 't1' });
  assert.ok(!html.includes('visibility'), 'must NOT show visibility when view count absent');
});

test('social shell returns empty for invalid tree', () => {
  var link = loadShareLink({ sharedUtils: makeSharedUtils() });
  assert.strictEqual(link.renderPreviewSocialShell(null), '', 'null tree must return empty');
  assert.strictEqual(link.renderPreviewSocialShell(undefined), '', 'undefined tree must return empty');
});

test('social shell has NO likes/comments/fake share count selectors', () => {
  var link = loadShareLink({ sharedUtils: makeSharedUtils(3) });
  var html = link.renderPreviewSocialShell({ id: 't1' });
  assert.ok(!html.includes('data-preview-like'), 'must NOT contain data-preview-like');
  assert.ok(!html.includes('data-preview-comments'), 'must NOT contain data-preview-comments');
  assert.ok(!html.includes('data-preview-comments-panel'), 'must NOT contain comments panel');
  assert.ok(!html.includes('아직 댓글이 없어요'), 'must NOT contain comments placeholder');
  assert.ok(!html.includes('댓글 작성 기능은 후속 기능으로 준비 중'), 'must NOT contain comments future note');
  // The share button text should be "공유하기" not a fake count
  assert.ok(html.includes('공유하기'), 'must contain share button with 공유하기 label');
});

// ---------------------------------------------------------------------------
// 3. Clipboard primary/fallback
// ---------------------------------------------------------------------------

test('clipboard primary copies canonical URL', async () => {
  var copiedText = null;
  var doc = { createElement: function() { return { style: {}, value: '', select: function() {}, setSelectionRange: function() {} }; }, body: { appendChild: function() {}, removeChild: function() {} }, execCommand: function() { return false; } };
  var nav = { clipboard: { writeText: function(text) { copiedText = text; return Promise.resolve(); } } };
  var link = loadShareLink({ doc: doc, navigator: nav, sharedUtils: makeSharedUtils() });
  var ok = await link.copyToClipboard('https://example.test/pages/view.html?treeId=my-tree');
  assert.ok(ok, 'clipboard write must succeed');
  assert.strictEqual(copiedText, 'https://example.test/pages/view.html?treeId=my-tree',
    'must copy exact canonical URL');
});

test('clipboard fallback textarea + execCommand works', async () => {
  var textareaValue = null;
  var doc = {
    createElement: function(tag) {
      var el = { style: {}, value: '', tagName: tag.toUpperCase(), select: function() {}, setSelectionRange: function(a,b) {} };
      return el;
    },
    body: { appendChild: function(el) { textareaValue = el; }, removeChild: function() {} },
    execCommand: function(cmd) { return cmd === 'copy'; }
  };
  var nav = { clipboard: null };
  var link = loadShareLink({ doc: doc, navigator: nav, sharedUtils: makeSharedUtils() });
  var ok = await link.copyToClipboard('https://example.test/pages/view.html?treeId=t1', doc, nav.clipboard);
  assert.ok(ok, 'fallback must succeed');
  assert.ok(textareaValue, 'textarea must have been created');
  assert.strictEqual(textareaValue.value, 'https://example.test/pages/view.html?treeId=t1',
    'textarea must contain canonical URL');
});

test('clipboard failure returns false (no throw)', async () => {
  var doc = {
    createElement: function(tag) {
      var el = { style: {}, value: '', tagName: tag.toUpperCase(), select: function() {}, setSelectionRange: function() {} };
      return el;
    },
    body: { appendChild: function() {}, removeChild: function() {} },
    execCommand: function() { return false; }
  };
  var nav = { clipboard: { writeText: function() { return Promise.reject(new Error('denied')); } } };
  var link = loadShareLink({ doc: doc, navigator: nav, sharedUtils: makeSharedUtils() });
  // Should not throw
  var ok = await link.copyToClipboard('test', doc, nav.clipboard);
  assert.strictEqual(ok, false, 'must return false on failure');
});

test('clipboard fallback also failing returns false (no throw)', async () => {
  var doc = {
    createElement: function(tag) { return { style: {}, value: '', tagName: tag.toUpperCase(), select: function() {}, setSelectionRange: function() {} }; },
    body: { appendChild: function() {}, removeChild: function() {} },
    execCommand: function() { throw new Error('not allowed'); }
  };
  var nav = { clipboard: { writeText: function() { return Promise.reject(new Error('denied')); } } };
  var link = loadShareLink({ doc: doc, navigator: nav, sharedUtils: makeSharedUtils() });
  var ok = await link.copyToClipboard('test', doc, nav.clipboard);
  assert.strictEqual(ok, false, 'must return false when both fail');
});

// ---------------------------------------------------------------------------
// 4. Feedback
// ---------------------------------------------------------------------------

test('showFeedback calls LoveBudUI.showToast when available', () => {
  var shown = null;
  var ui = { showToast: function(msg, type) { shown = { msg: msg, type: type }; } };
  var link = loadShareLink({ ui: ui, sharedUtils: makeSharedUtils() });
  link.showFeedback('링크가 복사됐어요', 'success');
  assert.ok(shown, 'showToast must be called');
  assert.strictEqual(shown.msg, '링크가 복사됐어요');
  assert.strictEqual(shown.type, 'success');
});

test('showFeedback falls back to button label swap', () => {
  var link = loadShareLink({ sharedUtils: makeSharedUtils() });
  var label = { textContent: '공유하기' };
  var button = { querySelector: function(sel) { return sel === '[data-preview-share-label]' ? label : null; } };
  link.showFeedback('복사하지 못했어요', 'error', button);
  assert.strictEqual(label.textContent, '복사하지 못했어요',
    'button label must be temporarily replaced');
});

// ---------------------------------------------------------------------------
// 5. Delegated handler — single bind
// ---------------------------------------------------------------------------

test('bindPreviewShareHandler binds only one listener (idempotent)', () => {
  var addCount = 0;
  var doc = {
    addEventListener: function(event, fn) { addCount++; },
    createElement: function() { return { style: {}, value: '', select: function() {}, setSelectionRange: function() {} }; },
    body: { appendChild: function() {}, removeChild: function() {} },
    execCommand: function() { return false; }
  };
  var nav = { clipboard: { writeText: function() { return Promise.resolve(); } } };
  var link = loadShareLink({ doc: doc, navigator: nav, sharedUtils: makeSharedUtils() });
  // Reset counter — first call increments
  addCount = 0;
  link.bindPreviewShareHandler(null, doc);
  assert.strictEqual(addCount, 1, 'first bind must register 1 listener');
  link.bindPreviewShareHandler(null, doc);
  assert.strictEqual(addCount, 1, 'second bind must NOT register another listener');
});

// ---------------------------------------------------------------------------
// 6. Playable hub patch — shares helper used; no likes/comments/getCount
// ---------------------------------------------------------------------------

test('playable hub patch uses share helper renderPreviewSocialShell', () => {
  var src = read('js/search/search-preview-playable-hub-patch.js');
  assert.ok(src.includes('shareLink.renderPreviewSocialShell(tree)'),
    'must delegate to share helper');
  assert.ok(src.includes('bindPreviewShareHandler'),
    'must call bindPreviewShareHandler');
});

test('playable hub patch no longer has getCount or bindCommentsToggle', () => {
  var src = read('js/search/search-preview-playable-hub-patch.js');
  assert.ok(!src.includes('function getCount(tree, keys)'),
    'must NOT define getCount');
  assert.ok(!src.includes('function bindCommentsToggle'),
    'must NOT define bindCommentsToggle');
  assert.ok(!src.includes('data-preview-like'),
    'must NOT contain data-preview-like');
  assert.ok(!src.includes('data-preview-comments'),
    'must NOT contain data-preview-comments');
  assert.ok(!src.includes('아직 댓글이 없어요'),
    'must NOT contain comments placeholder');
  assert.ok(!src.includes('댓글 작성 기능은 후속 기능'),
    'must NOT contain future comments note');
  assert.ok(!src.includes('data-preview-comments-panel'),
    'must NOT have comments panel');
});

test('playable hub patch gracefully degrades when share helper unavailable', () => {
  var src = read('js/search/search-preview-playable-hub-patch.js');
  assert.ok(src.includes('typeof shareLink.renderPreviewSocialShell ==='),
    'must guard against missing share helper');
});

// ---------------------------------------------------------------------------
// 7. DOM patch — no social shell, no comments toggle
// ---------------------------------------------------------------------------

test('hub DOM patch no longer has renderSocialShell or ensureSocialShell', () => {
  var src = read('js/search/search-preview-hub-dom-patch.js');
  assert.ok(!src.includes('function renderSocialShell'),
    'must NOT define renderSocialShell');
  assert.ok(!src.includes('function ensureSocialShell'),
    'must NOT define ensureSocialShell');
  assert.ok(!src.includes('socialBound'),
    'must NOT have socialBound flag');
  assert.ok(!src.includes('data-preview-comments'),
    'must NOT have comments toggle');
  assert.ok(!src.includes('preview-comments-panel'),
    'must NOT have comments panel');
  assert.ok(!src.includes('아직 댓글이 없어요'),
    'must NOT have comments placeholder');
  assert.ok(!src.includes('댓글 작성 기능은 후속 기능'),
    'must NOT have future comments text');
  assert.ok(!src.includes('data-preview-like'),
    'must NOT have likes button');
});

// ---------------------------------------------------------------------------
// 8. search.html script order
// ---------------------------------------------------------------------------

test('search.html loads share-link before playable hub and dom patch', () => {
  var html = read('pages/search.html');
  var scripts = [...html.matchAll(/<script[^>]*\s+src\s*=\s*"([^"]+)"/gi)].map(function(m) { return m[1]; });
  var shareIdx = scripts.findIndex(function(s) { return s.includes('search-share-link.js'); });
  var playableIdx = scripts.findIndex(function(s) { return s.includes('search-preview-playable-hub-patch.js'); });
  var domIdx = scripts.findIndex(function(s) { return s.includes('search-preview-hub-dom-patch.js'); });
  assert.ok(shareIdx >= 0, 'search-share-link.js must be present');
  assert.ok(playableIdx >= 0, 'search-preview-playable-hub-patch.js must be present');
  assert.ok(domIdx >= 0, 'search-preview-hub-dom-patch.js must be present');
  assert.ok(shareIdx < playableIdx,
    'search-share-link.js must load before search-preview-playable-hub-patch.js');
  assert.ok(shareIdx < domIdx,
    'search-share-link.js must load before search-preview-hub-dom-patch.js');
  assert.ok(playableIdx < domIdx,
    'search-preview-playable-hub-patch.js must load before search-preview-hub-dom-patch.js');
});

test('search.html share-link uses new cache version', () => {
  var html = read('pages/search.html');
  var match = html.match(/search-share-link\.js\?v=([\w-]+)/);
  assert.ok(match, 'search-share-link.js must have a cache version');
  assert.strictEqual(match[1], '20260629-2772-1',
    'search-share-link.js cache version must be 20260629-2772-1');
});

test('search.html has only one share-link script reference', () => {
  var html = read('pages/search.html');
  var count = (html.match(/search-share-link\.js/g) || []).length;
  assert.strictEqual(count, 1, 'must have exactly one search-share-link.js reference');
});

// ---------------------------------------------------------------------------
// 9. Share module exports
// ---------------------------------------------------------------------------

test('share link module exports required API', () => {
  var src = read('js/search/search-share-link.js');
  var exportMatch = src.match(/window\.LoveBudSearchShareLink\s*=\s*\{([^}]+)\}/s);
  assert.ok(exportMatch, 'LoveBudSearchShareLink export object not found');
  var exported = exportMatch[1];
  assert.match(exported, /\bbuildReadOnlyTreeUrl\b/);
  assert.match(exported, /\brenderPreviewSocialShell\b/);
  assert.match(exported, /\bcopyToClipboard\b/);
  assert.match(exported, /\bshowFeedback\b/);
  assert.match(exported, /\bbindPreviewShareHandler\b/);
  assert.match(exported, /\bescapeHtml\b/);
});

test('share link module does not export legacy buildSearchTreeUrl entry point', () => {
  var src = read('js/search/search-share-link.js');
  // Legacy function names must not be in new export block
  assert.ok(!src.includes('buildSearchTreeUrl'),
    'must NOT retain legacy buildSearchTreeUrl function');
  assert.ok(!src.includes('patchSearchUIFactory'),
    'must NOT retain legacy patchSearchUIFactory');
  assert.ok(!src.includes('__shareLinkHelperPatched'),
    'must NOT retain legacy __shareLinkHelperPatched');
});
