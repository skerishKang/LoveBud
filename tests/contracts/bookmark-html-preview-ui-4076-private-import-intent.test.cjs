/**
 * #4076 Local Bookmark HTML Preview — Private-First Pre-Write Import Intent Review.
 *
 * Stacks on the #4074 ordered-selection UI (#4075) and the #4072 preview UI /
 * #4065 parser. Executes the real production UI module
 * (js/import/bookmark-html-preview-ui.js, a browser IIFE) inside a vm sandbox
 * with a stubbed DOM, with the real #4065 parser injected as the only parsing
 * authority.
 *
 * Verifies the #4076 private-first pre-write import intent contract:
 *
 *  - Tree title input: the title is plain text/data only (never trusted
 *    markup). Two distinct authorities:
 *      (a) backend canonical (modal_compute/validation.py::validate_tree_title,
 *          max_length=200): deterministic trim + reject over 200 Unicode CODE
 *          POINTS (counted via Array.from so emoji/non-BMP align with Python
 *          len()); the HTML maxlength attribute is intentionally NOT used as the
 *          authority because it counts UTF-16 code units.
 *      (b) #4076 product fail-closed requirement: reject non-string, empty, or
 *          whitespace-only title (separate from the backend trim+max authority).
 *  - private-first visibility: buildBookmarkImportIntent always returns
 *    visibility === 'private'; no public toggle / import-and-publish shortcut
 *  - deterministic detached builder: selected eligible occurrences only, exact
 *    canonical source order, duplicate identical URLs stay independent, unsafe
 *    (unsupported / credential-bearing / null) URLs cannot re-enter; URL safety
 *    is enforced with the WHATWG URL parser (http/https only, hostname required,
 *    credentials rejected, malformed URLs rejected)
 *  - pre-write review summary: normalized title, selected count, private
 *    visibility, explicit "not yet saved" statement; becomes stale/non-actionable
 *    the instant any authority input changes (new file / READING / ERROR / EMPTY
 *    / reset / selection / select-all / clear / title)
 *  - #4075 async lifecycle preserved: a superseded late File.text() fulfillment
 *    cannot restore an old review, a late rejection cannot destroy the current
 *    review, and reset-while-pending cannot be resurrected
 *  - intent carries NO raw HTML, NO browser filesystem / local absolute path,
 *    NO credentials; no fetch/XHR/FormData/storage capability is added
 *
 * No network, no browser, no Production, no DB/schema/backend write.
 *
 * Refs: #4076, #4074, #4072, #4065, #3897, #3903, #1882.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PARSER_FILE = path.join(__dirname, '..', '..', 'js/import/bookmark-html-preview-parser.js');
const PARSER_SOURCE = fs.readFileSync(PARSER_FILE, 'utf8');
const UI_FILE = path.join(__dirname, '..', '..', 'js/import/bookmark-html-preview-ui.js');
const UI_SOURCE = fs.readFileSync(UI_FILE, 'utf8');
const HTML_FILE = path.join(__dirname, '..', '..', 'pages/bookmark-html-preview.html');
const HTML_SOURCE = fs.readFileSync(HTML_FILE, 'utf8');

const FILE_INPUT_ID = 'bookmarkHtmlFileInput';
const STATUS_ID = 'bookmarkHtmlStatus';
const ERROR_ID = 'bookmarkHtmlError';
const PREVIEW_ID = 'bookmarkHtmlPreview';
const RESET_ID = 'bookmarkHtmlResetBtn';
const SELECT_ALL_ID = 'bookmarkHtmlSelectAllBtn';
const CLEAR_ID = 'bookmarkHtmlClearBtn';
const SELECTED_COUNT_ID = 'bookmarkHtmlSelectedCount';
const TREE_TITLE_INPUT_ID = 'bookmarkHtmlTreeTitleInput';
const TREE_TITLE_ERROR_ID = 'bookmarkHtmlTreeTitleError';
const REVIEW_BUILD_ID = 'bookmarkHtmlReviewBtn';
const INTENT_REVIEW_ID = 'bookmarkHtmlImportReview';

function loadParser() {
  const sandbox = { window: {}, module: { exports: {} }, exports: {}, URL, TextEncoder, encodeURIComponent, unescape };
  vm.runInNewContext(PARSER_SOURCE, sandbox, { filename: PARSER_FILE });
  return sandbox.module.exports;
}

const parser = loadParser();

function makeElement(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    className: '',
    value: '',
    hidden: false,
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      return child;
    },
    addEventListener() {},
    focus() {},
  };
  for (const name of ['href', 'target', 'rel']) {
    Object.defineProperty(el, name, {
      get() { return name in this.attributes ? this.attributes[name] : ''; },
      set(v) { this.attributes[name] = String(v); },
    });
  }
  let text = '';
  Object.defineProperty(el, 'textContent', {
    get() { return text; },
    set(v) {
      text = String(v);
      if (text === '') this.children = [];
    },
  });
  return el;
}

// Code-only view of the UI module (comments stripped) for capability greps.
const UI_CODE = UI_SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function loadUi() {
  const elements = {
    [FILE_INPUT_ID]: makeElement('input'),
    [STATUS_ID]: makeElement('p'),
    [ERROR_ID]: makeElement('p'),
    [PREVIEW_ID]: makeElement('div'),
    [RESET_ID]: makeElement('button'),
    [SELECT_ALL_ID]: makeElement('button'),
    [CLEAR_ID]: makeElement('button'),
    [SELECTED_COUNT_ID]: makeElement('p'),
    [TREE_TITLE_INPUT_ID]: makeElement('input'),
    [TREE_TITLE_ERROR_ID]: makeElement('p'),
    [REVIEW_BUILD_ID]: makeElement('button'),
    [INTENT_REVIEW_ID]: makeElement('section'),
  };
  const sandbox = {
    window: {},
    document: {
      getElementById(id) { return elements[id] || null; },
      createElement(tag) { return makeElement(tag); },
      addEventListener() {},
    },
    module: { exports: {} },
    exports: {},
    console,
    URL,
    TextEncoder,
    encodeURIComponent,
    unescape,
  };
  sandbox.window = sandbox;
  sandbox.window.LoveBudBookmarkHtmlPreviewParser = parser;
  vm.runInNewContext(UI_SOURCE, sandbox, { filename: UI_FILE });
  const api = sandbox.window.LoveBudBookmarkHtmlPreviewUI;
  assert.ok(api, 'window.LoveBudBookmarkHtmlPreviewUI must be registered');
  return { api, elements };
}

function exportedHtml(body) {
  return [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    body,
    '</DL><p>',
  ].join('\n');
}

function nBookmarks(n, urlFor) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    parts.push(`<DT><A HREF="${urlFor(i)}">Item ${i}</A>`);
  }
  return parts.join('\n');
}

function fakeFile(size, textFn) {
  return { name: 'bookmarks.html', size, text: textFn };
}

function deferredFile(size) {
  let resolveFn, rejectFn;
  const p = new Promise((res, rej) => { resolveFn = res; rejectFn = rej; });
  return { name: 'bookmarks.html', size, text: () => p, resolve: resolveFn, reject: rejectFn };
}

function flushMicrotasks() {
  return new Promise((r) => setImmediate(r));
}

// vm-realm arrays must be coerced to host realm before deepStrictEqual.
function hostArr(x) {
  return Array.prototype.slice.call(x);
}

// Prepare a READY preview with the given occurrences selected and a valid title,
// then build the pre-write import intent.
async function readyTitledIntent({ api, html, select = [], title = '나의 러브트리' }) {
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  select.forEach((i) => api.setOccurrenceSelected(i, true));
  api.setTreeTitle(title);
  return api.buildImportIntent();
}

const GOOD = () => exportedHtml(nBookmarks(5, (i) => `https://example.com/${i}`));

// ─── 1. valid title + selected eligible => deterministic private intent ───────
test('4076: valid title + selected eligible occurrences produce a deterministic private intent', async () => {
  const { api } = loadUi();
  const intent = await readyTitledIntent({ api, html: GOOD(), select: [0, 2, 4] });
  assert.ok(intent, 'intent built');
  assert.equal(intent.visibility, 'private');
  assert.equal(intent.count, 3);
  assert.equal(intent.treeTitle, '나의 러브트리');
  assert.equal(intent.persisted, false, 'NOT_PERSISTED');
  assert.equal(intent.created, false, 'no created=true claim');
  assert.equal(api.getImportIntent(), intent, 'review authority holds the intent');
  assert.equal(api.hasActionableReview(), true);
});

// ─── 2. blank title => fail closed ────────────────────────────────────────────
test('4076: blank title fails closed (no intent)', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(0, true);
  api.setTreeTitle('   '); // whitespace-only handled in test 3; here test empty
  api.setTreeTitle('');
  const intent = api.buildImportIntent();
  assert.equal(intent, null, 'no intent on empty title');
  assert.equal(api.getImportIntent(), null);
  assert.equal(api.hasActionableReview(), false);
});

// ─── 3. whitespace-only => fail closed ───────────────────────────────────────
test('4076: whitespace-only title fails closed', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(0, true);
  api.setTreeTitle('   \t\n  ');
  assert.equal(api.buildImportIntent(), null, 'no intent on whitespace-only title');
  assert.equal(api.hasActionableReview(), false);
});

// ─── 4. over canonical max (200 code points) => fail closed ──────────────────
// The 200 bound is the BACKEND canonical authority (validate_tree_title
// max_length=200), measured in Unicode CODE POINTS. Empty / whitespace-only
// rejection is the separate #4076 product fail-closed requirement.
test('4076: over canonical Tree-title max length (200 code points) fails closed', async () => {
  const { api } = loadUi();
  assert.equal(api.TREE_TITLE_MAX_LENGTH, 200, 'reuses canonical max 200');
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(0, true);
  api.setTreeTitle('a'.repeat(201));
  assert.equal(api.buildImportIntent(), null, 'no intent over max length');
  assert.equal(api.hasActionableReview(), false);
  // Exactly at the max is accepted.
  api.setTreeTitle('a'.repeat(200));
  const intent = api.buildImportIntent();
  assert.ok(intent, 'exactly-max title accepted');
  assert.equal(intent.treeTitle.length, 200);
});

// ─── 4b. max length is code-point based (emoji-safe, matches Python len()) ───
test('4076: title max length counts Unicode code points, not UTF-16 units', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(0, true);
  // 200 emoji = 200 code points but 400 UTF-16 code units. Backend len()==200,
  // so this MUST be accepted (the old .length check would have wrongly failed).
  api.setTreeTitle('🙂'.repeat(200));
  const intent = api.buildImportIntent();
  assert.ok(intent, '200 emoji accepted (code-point count aligns with backend)');
  assert.equal(Array.from(intent.treeTitle).length, 200, '200 code points');
  assert.equal(intent.treeTitle.length, 400, 'UTF-16 length is 400 but still allowed');
  // 201 emoji = 201 code points -> rejected.
  api.setTreeTitle('🙂'.repeat(201));
  assert.equal(api.buildImportIntent(), null, '201 emoji rejected (over code-point max)');
  assert.equal(api.hasActionableReview(), false);
});

// ─── 5. duplicate identical URLs remain independent occurrences ───────────────
test('4076: duplicate identical URLs stay independent in the intent', async () => {
  const { api } = loadUi();
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/dup">First</A>',
    '<DT><A HREF="https://example.com/dup">Second</A>',
  ]);
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  api.setOccurrenceSelected(0, true);
  api.setOccurrenceSelected(1, true);
  api.setTreeTitle('Dup Tree');
  const intent = api.buildImportIntent();
  assert.equal(intent.count, 2, 'both duplicate occurrences preserved');
  assert.equal(intent.entries[0].url, 'https://example.com/dup');
  assert.equal(intent.entries[1].url, 'https://example.com/dup');
  assert.notEqual(intent.entries[0].sourceIndex, intent.entries[1].sourceIndex);
});

// ─── 6. click order != canonical source order ────────────────────────────────
test('4076: output order is canonical source order, not click order', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(4, true);
  api.setOccurrenceSelected(1, true);
  api.setOccurrenceSelected(3, true);
  api.setTreeTitle('Order Tree');
  const intent = api.buildImportIntent();
  assert.deepEqual(hostArr(intent.entries.map((e) => e.sourceIndex)), [1, 3, 4]);
});

// ─── 7. unsupported URL cannot enter the intent ──────────────────────────────
test('4076: unsupported-scheme entry cannot enter the intent', async () => {
  const { api } = loadUi();
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/a">A</A>',
    '<DT><A HREF="javascript:alert(1)">Bad</A>',
  ]);
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  api.selectAllEligible();
  api.setTreeTitle('Mixed Tree');
  const intent = api.buildImportIntent();
  assert.equal(intent.count, 1, 'only the supported occurrence');
  assert.equal(intent.entries[0].url, 'https://example.com/a');
  // Direct builder defense: a hand-passed unsupported entry is refused.
  const bad = { entries: [
    { occurrenceKey: 'k0', sourceIndex: 0, title: 'A', url: 'https://example.com/a' },
    { occurrenceKey: 'k1', sourceIndex: 1, title: 'Bad', url: 'javascript:alert(1)' },
  ], count: 2, source: 'bookmark-html-local' };
  const built = api.buildBookmarkImportIntent(bad, 'T');
  assert.equal(built.count, 1, 'builder refuses unsupported URL even if passed directly');
});

// ─── 8. credential-bearing URL cannot enter + no raw credential exposure ──────
test('4076: credential-bearing URL is excluded and raw credentials never exposed', async () => {
  const { api } = loadUi();
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/a">A</A>',
    '<DT><A HREF="https://user:pass@example.com/secret">Cred</A>',
  ]);
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  api.selectAllEligible();
  api.setTreeTitle('Cred Tree');
  const intent = api.buildImportIntent();
  assert.equal(intent.count, 1, 'credential-bearing excluded from intent');
  const serialized = JSON.stringify(intent);
  assert.doesNotMatch(serialized, /user:pass/, 'raw credential not in intent');
  assert.doesNotMatch(serialized, /@example\.com/, 'credential-bearing URL not in intent');
  // Direct builder defense: supported:true but credential url is refused.
  const bad = { entries: [
    { occurrenceKey: 'k0', sourceIndex: 0, title: 'A', url: 'https://example.com/a' },
    { occurrenceKey: 'k1', sourceIndex: 1, title: 'Cred', url: 'https://user:pass@example.com/x' },
  ], count: 2, source: 'bookmark-html-local' };
  const built = api.buildBookmarkImportIntent(bad, 'T');
  assert.equal(built.count, 1, 'builder refuses credential-bearing URL even if passed directly');
});

// ─── 8b. malformed / non-http URL is excluded by URL-parser validation ───────
test('4076: malformed / non-http URL is excluded via WHATWG URL parser', async () => {
  const { api } = loadUi();
  const good = { entries: [
    { occurrenceKey: 'k0', sourceIndex: 0, title: 'A', url: 'https://example.com/a' },
  ], count: 1, source: 'bookmark-html-local' };
  assert.equal(api.buildBookmarkImportIntent(good, 'T').count, 1, 'baseline good url accepted');
  // Each malformed/unsafe url must be excluded even if a caller passes it.
  const malicious = [
    'http://',              // no hostname (parse fails / empty host)
    'ht tp://example.com',  // malformed -> URL parser throws
    'not a url at all',     // URL parser throws
    'ftp://example.com/x',  // unsupported scheme
    'file:///etc/passwd',   // wrong scheme + absolute path
    'https://user:pass@x',  // credentials
  ];
  malicious.forEach((url, i) => {
    const draft = {
      entries: [
        { occurrenceKey: 'k0', sourceIndex: 0, title: 'A', url: 'https://example.com/a' },
        { occurrenceKey: 'k' + i, sourceIndex: i + 1, title: 'Bad', url },
      ],
      count: 2,
      source: 'bookmark-html-local',
    };
    const built = api.buildBookmarkImportIntent(draft, 'T');
    assert.equal(built.count, 1, 'malformed/unsafe url excluded: ' + JSON.stringify(url));
  });
});

// ─── 9. visibility is exactly private ─────────────────────────────────────────
test('4076: built intent visibility is exactly "private"', async () => {
  const { api } = loadUi();
  const intent = await readyTitledIntent({ api, html: GOOD(), select: [0] });
  assert.equal(intent.visibility, 'private');
});

// ─── 10. no public / import-and-publish shortcut exists ──────────────────────
test('4076: no public toggle / import-and-publish shortcut exists', () => {
  assert.doesNotMatch(UI_CODE, /import-and-publish/i, 'no import-and-publish shortcut');
  assert.doesNotMatch(UI_CODE, /공개.*가져오기|가져오기.*공개/i, 'no Korean public-import shortcut');
  assert.doesNotMatch(UI_CODE, /visibility\s*[:=]\s*['"]public['"]/, 'no public visibility written for import');
  assert.doesNotMatch(UI_CODE, /\bpublish\b/i, 'no publish capability');
});

// ─── 11. returned intent is detached ─────────────────────────────────────────
test('4076: returned intent is detached from preview/selection state', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(0, true);
  api.setOccurrenceSelected(2, true);
  api.setTreeTitle('Detach Tree');
  const preview = api.getPreview();
  const intent = api.buildImportIntent();
  assert.notEqual(intent.entries[0], preview.entries[0]);
  // Mutating the returned intent must not reach the preview.
  try { intent.entries[0].title = 'MUTATED'; } catch (_) { /* frozen */ }
  assert.equal(preview.entries[0].title, 'Item 0', 'mutating intent does not mutate preview');
  // Later internal mutation must not alter the already-built intent.
  api.clearSelection();
  assert.equal(api.getSelectedCount(), 0, 'selection cleared');
  assert.equal(intent.count, 2, 'detached intent unaffected by later clear');
});

// ─── 12. caller draft is not mutated ─────────────────────────────────────────
test('4076: building the intent does not mutate the caller draft', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(1, true);
  api.setTreeTitle('Draft Tree');
  const draft = api.buildOrderedBookmarkImportDraft(api.getPreview(), api.getSelectedOccurrences());
  const draftTitleBefore = draft.entries[0].title;
  const draftCountBefore = draft.count;
  const intent = api.buildBookmarkImportIntent(draft, 'Draft Tree');
  try { draft.entries[0].title = 'MUTATED'; } catch (_) { /* frozen */ }
  assert.equal(intent.entries[0].title, draftTitleBefore, 'intent reflects original draft');
  assert.equal(intent.count, draftCountBefore, 'intent count unaffected by later draft mutation');
});

// ─── 13. selection change after review invalidates old intent ────────────────
test('4076: selection change after review invalidates the old intent', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(0, true);
  api.setTreeTitle('Sel Tree');
  assert.ok(api.buildImportIntent(), 'intent built');
  api.setOccurrenceSelected(1, true); // selection change
  assert.equal(api.getImportIntent(), null, 'old intent invalid after selection change');
  assert.equal(api.hasActionableReview(), false);
});

// ─── 14. select-all after review invalidates old intent ──────────────────────
test('4076: select-all after review invalidates the old intent', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(0, true);
  api.setTreeTitle('All Tree');
  assert.ok(api.buildImportIntent(), 'intent built');
  api.selectAllEligible();
  assert.equal(api.getImportIntent(), null, 'old intent invalid after select-all');
});

// ─── 15. clear selection invalidates old intent ──────────────────────────────
test('4076: clear selection invalidates the old intent', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(0, true);
  api.setTreeTitle('Clear Tree');
  assert.ok(api.buildImportIntent(), 'intent built');
  api.clearSelection();
  assert.equal(api.getImportIntent(), null, 'old intent invalid after clear-selection');
});

// ─── 16. title change after review invalidates old intent ────────────────────
test('4076: title change after review invalidates the old intent', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(0, true);
  api.setTreeTitle('First Title');
  assert.ok(api.buildImportIntent(), 'intent built');
  api.setTreeTitle('Changed Title');
  assert.equal(api.getImportIntent(), null, 'old intent invalid after title change');
  // The new title can build a fresh intent.
  assert.ok(api.buildImportIntent(), 'fresh intent builds with new title');
  assert.equal(api.getImportIntent().treeTitle, 'Changed Title');
});

// ─── 17. new file / READING invalidates old review immediately ───────────────
test('4076: selecting a new file invalidates the old review immediately', async () => {
  const { api } = loadUi();
  const first = GOOD();
  await api.handleFileSelected(fakeFile(first.length, () => Promise.resolve(first)));
  api.setOccurrenceSelected(0, true);
  api.setTreeTitle('Old Tree');
  assert.ok(api.buildImportIntent(), 'intent built');
  const second = exportedHtml('<DT><A HREF="https://example.com/b">B</A>');
  await api.handleFileSelected(fakeFile(second.length, () => Promise.resolve(second)));
  assert.equal(api.getImportIntent(), null, 'old review dropped on new file');
  assert.equal(api.hasActionableReview(), false);
  assert.equal(api.getState(), 'READY');
});

// ─── 18. ERROR invalidates old review ────────────────────────────────────────
test('4076: parser/read ERROR invalidates the old review', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(0, true);
  api.setTreeTitle('Err Tree');
  assert.ok(api.buildImportIntent(), 'intent built');
  const bad = '<html><body>no bookmark structure here';
  await api.handleFileSelected(fakeFile(bad.length, () => Promise.resolve(bad)));
  assert.equal(api.getState(), 'ERROR');
  assert.equal(api.getImportIntent(), null, 'old review dropped on ERROR');
});

// ─── 19. EMPTY invalidates old review ────────────────────────────────────────
test('4076: EMPTY result invalidates the old review', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(0, true);
  api.setTreeTitle('Empty Tree');
  assert.ok(api.buildImportIntent(), 'intent built');
  const empty = exportedHtml('');
  await api.handleFileSelected(fakeFile(empty.length, () => Promise.resolve(empty)));
  assert.equal(api.getState(), 'EMPTY');
  assert.equal(api.getImportIntent(), null, 'old review dropped on EMPTY');
});

// ─── 20. explicit reset invalidates old review ───────────────────────────────
test('4076: explicit reset invalidates the old review', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.setOccurrenceSelected(0, true);
  api.setTreeTitle('Reset Tree');
  assert.ok(api.buildImportIntent(), 'intent built');
  api.resetSurface();
  assert.equal(api.getState(), 'IDLE');
  assert.equal(api.getImportIntent(), null, 'old review dropped on reset');
});

// ─── 21. stale late fulfillment cannot restore old review ─────────────────────
test('4076: stale late fulfillment of a superseded read cannot restore the old review', async () => {
  const { api } = loadUi();
  const aHtml = exportedHtml(nBookmarks(2, (i) => `https://a.example.com/${i}`));
  const bHtml = exportedHtml(nBookmarks(2, (i) => `https://b.example.com/${i}`));
  const aFile = deferredFile(aHtml.length);
  const bFile = fakeFile(bHtml.length, () => Promise.resolve(bHtml));
  api.handleFileSelected(aFile); // A pending
  await api.handleFileSelected(bFile); // B supersedes + resolves
  api.selectAllEligible();
  api.setTreeTitle('B Tree');
  const intent = api.buildImportIntent();
  assert.ok(intent, 'B intent built');
  assert.equal(intent.entries[0].url, 'https://b.example.com/0');
  aFile.resolve(aHtml); // A late fulfillment — must be ignored
  await flushMicrotasks();
  assert.equal(api.getState(), 'READY', 'state stays READY for B');
  assert.equal(api.getImportIntent(), intent, 'B review remains authoritative');
  assert.equal(api.getImportIntent().entries[0].url, 'https://b.example.com/0');
});

// ─── 22. stale late rejection cannot destroy current review ──────────────────
test('4076: stale late rejection of a superseded read cannot destroy the current review', async () => {
  const { api } = loadUi();
  const aHtml = exportedHtml(nBookmarks(2, (i) => `https://a.example.com/${i}`));
  const bHtml = exportedHtml(nBookmarks(2, (i) => `https://b.example.com/${i}`));
  const aFile = deferredFile(aHtml.length);
  const bFile = fakeFile(bHtml.length, () => Promise.resolve(bHtml));
  api.handleFileSelected(aFile);
  await api.handleFileSelected(bFile);
  api.selectAllEligible();
  api.setTreeTitle('B Tree');
  const intent = api.buildImportIntent();
  assert.ok(intent, 'B intent built');
  aFile.reject(new Error('read failed')); // A late rejection — must be ignored
  await flushMicrotasks();
  assert.equal(api.getState(), 'READY', 'state stays READY');
  assert.equal(api.getImportIntent(), intent, 'B review not destroyed by stale rejection');
  assert.equal(api.getPreview().entries[0].url, 'https://b.example.com/0');
});

// ─── 23. pending read + reset + late completion cannot resurrect review ───────
test('4076: explicit reset while a read is pending prevents late-review resurrection', async () => {
  const { api } = loadUi();
  const aHtml = exportedHtml(nBookmarks(2, (i) => `https://a.example.com/${i}`));
  const aFile = deferredFile(aHtml.length);
  // First build a review from a completed read.
  await api.handleFileSelected(fakeFile(aHtml.length, () => Promise.resolve(aHtml)));
  api.setOccurrenceSelected(0, true);
  api.setTreeTitle('A Tree');
  assert.ok(api.buildImportIntent(), 'intent built');
  // Begin a new pending read, then reset it.
  api.handleFileSelected(aFile); // A2 pending
  assert.equal(api.getState(), 'READING');
  api.resetSurface(); // supersede the pending read
  assert.equal(api.getImportIntent(), null, 'review dropped on reset');
  aFile.resolve(aHtml); // late completion must be ignored
  await flushMicrotasks();
  assert.equal(api.getState(), 'IDLE', 'pending read cannot reclaim surface after reset');
  assert.equal(api.getImportIntent(), null, 'review not resurrected');
});

// ─── 24. missing file.text() keeps the negative unsupported-browser message ──
test('4076: missing file.text() surfaces the negative unsupported-browser error (no review)', async () => {
  const { api, elements } = loadUi();
  await api.handleFileSelected({ name: 'bookmarks.html', size: 10, text: undefined });
  assert.equal(api.getState(), 'ERROR');
  assert.equal(elements[ERROR_ID].textContent, '이 브라우저에서는 파일을 읽을 수 없어요.', 'negative message polarity preserved');
  assert.equal(api.getImportIntent(), null, 'no review authority on unsupported browser');
});

// ─── 25. intent carries no raw bookmark HTML ─────────────────────────────────
test('4076: intent contains no raw bookmark HTML', async () => {
  const { api } = loadUi();
  const intent = await readyTitledIntent({ api, html: GOOD(), select: [0, 1] });
  const serialized = JSON.stringify(intent);
  assert.doesNotMatch(serialized, /<!DOCTYPE/i, 'no DOCTYPE');
  assert.doesNotMatch(serialized, /<A\s+HREF/i, 'no raw <A HREF>');
  assert.doesNotMatch(serialized, /HREF=/i, 'no HREF attribute');
  assert.doesNotMatch(serialized, /<DL>/i, 'no DL markup');
});

// ─── 26. intent carries no filesystem / local absolute path ──────────────────
test('4076: intent contains no browser filesystem / local absolute path', async () => {
  const { api } = loadUi();
  const intent = await readyTitledIntent({ api, html: GOOD(), select: [0, 1] });
  const serialized = JSON.stringify(intent).toLowerCase();
  assert.doesNotMatch(serialized, /file:\/\//, 'no file:// URL');
  assert.doesNotMatch(serialized, /\/users\//, 'no /Users/ path');
  assert.doesNotMatch(serialized, /\/home\//, 'no /home/ path');
  assert.doesNotMatch(serialized, /lovebud-comp2/, 'no worktree path token');
});

// ─── 27. no network capability added ──────────────────────────────────────────
test('4076: no network / upload / storage / HTML-execution capability added', () => {
  assert.doesNotMatch(UI_CODE, /\bfetch\s*\(/, 'no fetch');
  assert.doesNotMatch(UI_CODE, /XMLHttpRequest/, 'no XHR');
  assert.doesNotMatch(UI_CODE, /FormData/, 'no FormData upload');
  assert.doesNotMatch(UI_CODE, /sendBeacon/, 'no beacon');
  assert.doesNotMatch(UI_CODE, /localStorage|sessionStorage|indexedDB|cookie/i, 'no persistent storage');
  assert.doesNotMatch(UI_CODE, /\.innerHTML\s*=/, 'no innerHTML sink');
  assert.doesNotMatch(UI_CODE, /insertAdjacentHTML|outerHTML\s*=/, 'no adjacent/outer HTML sink');
  assert.doesNotMatch(UI_CODE, /srcdoc|document\.write/, 'no srcdoc / document.write');
});

// ─── accessibility: title input label + review region semantics ──────────────
test('4076: title input has an accessible label and the review region is a live status', () => {
  assert.match(HTML_SOURCE, /id="bookmarkHtmlTreeTitleInput"/, 'title input present');
  assert.match(HTML_SOURCE, /<label[^>]+for="bookmarkHtmlTreeTitleInput"/, 'title input has a label');
  assert.match(HTML_SOURCE, /id="bookmarkHtmlTreeTitleError"[^>]*role="alert"/, 'title error is role=alert');
  assert.match(HTML_SOURCE, /id="bookmarkHtmlImportReview"[^>]*role="status"[^>]*aria-live="polite"/, 'review region is role=status aria-live');
});

// ─── regression: #4074 draft builder still present and unchanged in authority ─
test('4076 (#4074 regression): buildOrderedBookmarkImportDraft still produces a detached canonical-order draft', async () => {
  const { api } = loadUi();
  await api.handleFileSelected(fakeFile(GOOD().length, () => Promise.resolve(GOOD())));
  api.toggleOccurrence(4);
  api.toggleOccurrence(1);
  const draft = api.buildOrderedBookmarkImportDraft(api.getPreview(), api.getSelectedOccurrences());
  assert.equal(draft.count, 2);
  assert.deepEqual(hostArr(draft.entries.map((e) => e.sourceIndex)), [1, 4]);
});
