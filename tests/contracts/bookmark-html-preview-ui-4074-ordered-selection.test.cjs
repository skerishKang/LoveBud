/**
 * #4074 Local Bookmark HTML Preview — Ordered Occurrence Selection contract.
 *
 * Stacks on the #4072 preview UI (#4073) and the #4065 parser (#4067).
 * Executes the real production UI module
 * (js/import/bookmark-html-preview-ui.js, a browser IIFE) inside a vm
 * sandbox with a stubbed DOM, with the real #4065 parser injected as the
 * only parsing authority.
 *
 * Verifies the #4074 ordered-selection contract:
 *
 *  - occurrence-based selection by canonical sourceIndex identity (not URL)
 *  - duplicate identical URLs stay independently selectable
 *  - click order is NOT canonical import order (source order preserved)
 *  - select all eligible / clear operate only on eligible occurrences
 *  - unsupported / rejected / credential-bearing occurrences are excluded
 *    and never silently selected
 *  - unsafe URL rows still have no clickable href (preserves #4072 safety)
 *  - selection resets on new file / READING / ERROR / EMPTY / explicit reset
 *  - selected count is visible and announced via role=status aria-live
 *  - buildOrderedBookmarkImportDraft is pure, detached, canonical-source-order
 *
 * No network, no browser, no Production.
 *
 * Refs: #4074, #4072, #4065, #3897, #3903, #1882.
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

function loadParser() {
  const sandbox = {
    window: {},
    module: { exports: {} },
    exports: {},
    URL,
    TextEncoder,
    encodeURIComponent,
    unescape,
  };
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

function rowCheckbox(row) {
  const last = row.children[row.children.length - 1];
  return last && last.tagName === 'INPUT' ? last : null;
}

// The UI module runs in a vm sandbox, so arrays it returns belong to the vm
// realm. assert.deepStrictEqual rejects cross-realm arrays even with identical
// content; coerce to a host-realm array before comparison.
function hostArr(x) {
  return Array.prototype.slice.call(x);
}

function findRowCheckbox(elements, sourceIndex) {
  const rows = elements[PREVIEW_ID].children;
  for (const row of rows) {
    if (row.getAttribute('data-source-index') === String(sourceIndex)) {
      return rowCheckbox(row);
    }
  }
  return null;
}

// ─── 1. one eligible occurrence select ─────────────────────────────────────
test('4074: one eligible occurrence can be selected', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml('<DT><A HREF="https://example.com/a">Alpha</A>');
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  assert.equal(api.getState(), 'READY');
  assert.equal(api.toggleOccurrence(0), true, 'occurrence becomes selected');
  assert.equal(api.getSelectedCount(), 1);
  assert.equal(findRowCheckbox(elements, 0).checked, true);
});

// ─── 2. deselect ───────────────────────────────────────────────────────────
test('4074: a selected occurrence can be deselected', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml('<DT><A HREF="https://example.com/a">Alpha</A>');
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  api.toggleOccurrence(0);
  assert.equal(api.getSelectedCount(), 1);
  assert.equal(api.toggleOccurrence(0), false, 'occurrence becomes deselected');
  assert.equal(api.getSelectedCount(), 0);
  assert.equal(findRowCheckbox(elements, 0).checked, false);
});

// ─── 3. duplicate identical URLs independently selectable ──────────────────
test('4074: duplicate identical URLs stay independently selectable', async () => {
  const { api } = loadUi();
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/dup">First</A>',
    '<DT><A HREF="https://example.com/dup">Second</A>',
  ]);
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  const entries = api.getPreview().entries;
  assert.equal(entries[0].url, entries[1].url, 'duplicate URLs');
  assert.notEqual(entries[0].sourceIndex, entries[1].sourceIndex, 'distinct occurrences');
  api.setOccurrenceSelected(0, true);
  api.setOccurrenceSelected(1, false);
  assert.deepEqual(hostArr(api.getSelectedOccurrences()), [0], 'occurrence 0 selected, 1 not');
  api.setOccurrenceSelected(1, true);
  assert.deepEqual(hostArr(api.getSelectedOccurrences().sort((a, b) => a - b)), [0, 1]);
  const draft = api.buildOrderedBookmarkImportDraft(api.getPreview(), api.getSelectedOccurrences());
  assert.equal(draft.count, 2, 'both duplicate occurrences preserved in draft');
  assert.equal(draft.entries[0].url, 'https://example.com/dup');
  assert.equal(draft.entries[1].url, 'https://example.com/dup');
});

// ─── 4. click order != canonical source order ──────────────────────────────
test('4074: click order is not canonical import order — source order preserved', async () => {
  const { api } = loadUi();
  const html = exportedHtml(nBookmarks(9, (i) => `https://example.com/${i}`));
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  // User clicks in order 8, 2, 5.
  api.toggleOccurrence(8);
  api.toggleOccurrence(2);
  api.toggleOccurrence(5);
  assert.deepEqual(hostArr(api.getSelectedOccurrences()), [8, 2, 5], 'click order retained internally');
  const draft = api.buildOrderedBookmarkImportDraft(api.getPreview(), api.getSelectedOccurrences());
  assert.equal(draft.count, 3);
  assert.deepEqual(
    hostArr(draft.entries.map((e) => e.sourceIndex)),
    [2, 5, 8],
    'draft emitted in canonical source order'
  );
});

// ─── 5. select all eligible ────────────────────────────────────────────────
test('4074: select all selects only eligible occurrences', async () => {
  const { api } = loadUi();
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/a">A</A>',
    '<DT><A HREF="https://example.com/b">B</A>',
    '<DT><A HREF="javascript:alert(1)">Bad</A>',
    '<DT><A HREF="https://user:pass@example.com/secret">Cred</A>',
    '<DT><A HREF="https://example.com/a">DupA</A>',
  ]);
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  api.selectAllEligible();
  assert.equal(api.getSelectedCount(), 3, 'only the 3 supported http(s) occurrences');
  assert.deepEqual(hostArr(api.getSelectedOccurrences().sort((a, b) => a - b)), [0, 1, 4]);
  const draft = api.buildOrderedBookmarkImportDraft(api.getPreview(), api.getSelectedOccurrences());
  assert.equal(draft.count, 3);
  assert.deepEqual(hostArr(draft.entries.map((e) => e.sourceIndex)), [0, 1, 4]);
});

// ─── 6. clear selection ─────────────────────────────────────────────────────
test('4074: clear selection empties the selection', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml(nBookmarks(3, (i) => `https://example.com/${i}`));
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  api.selectAllEligible();
  assert.equal(api.getSelectedCount(), 3);
  api.clearSelection();
  assert.equal(api.getSelectedCount(), 0);
  assert.deepEqual(hostArr(api.getSelectedOccurrences()), []);
  for (let i = 0; i < 3; i++) {
    assert.equal(findRowCheckbox(elements, i).checked, false, `occurrence ${i} unchecked`);
  }
});

// ─── 7. unsupported excluded ───────────────────────────────────────────────
test('4074: unsupported occurrences are excluded and never silently selected', async () => {
  const { api } = loadUi();
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/a">A</A>',
    '<DT><A HREF="ftp://example.com/x">Ftp</A>',
  ]);
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  const entries = api.getPreview().entries;
  assert.equal(entries[0].supported, true);
  assert.equal(entries[1].supported, false, 'unsupported scheme');
  // Toggle on an unsupported occurrence must be a no-op.
  assert.equal(api.toggleOccurrence(1), false, 'cannot select unsupported');
  assert.equal(api.getSelectedCount(), 0, 'unsupported not in selection');
  api.toggleOccurrence(0);
  api.selectAllEligible();
  assert.deepEqual(hostArr(api.getSelectedOccurrences()), [0], 'select-all excludes unsupported');
});

// ─── 8. credential-bearing excluded ─────────────────────────────────────────
test('4074: credential-bearing occurrences are excluded', async () => {
  const { api } = loadUi();
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/a">A</A>',
    '<DT><A HREF="https://user:pass@example.com/secret">Cred</A>',
  ]);
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  const entries = api.getPreview().entries;
  assert.equal(entries[1].supported, false);
  assert.equal(entries[1].reasonCode, 'URL_CREDENTIALS_FORBIDDEN');
  assert.equal(api.toggleOccurrence(1), false, 'cannot select credential-bearing');
  api.toggleOccurrence(0);
  api.selectAllEligible();
  assert.deepEqual(hostArr(api.getSelectedOccurrences()), [0], 'select-all excludes credential-bearing');
});

// ─── 9. unsafe URL still no href ────────────────────────────────────────────
test('4074: unsafe URL rows still have no clickable href (#4072 preserved)', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/a">A</A>',
    '<DT><A HREF="javascript:alert(1)">Bad</A>',
  ]);
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  const rows = elements[PREVIEW_ID].children;
  assert.equal(rows[0].getAttribute('data-supported'), 'true');
  assert.equal(rows[0].children[2].tagName, 'A', 'supported row keeps link at index 2');
  assert.equal(rows[1].getAttribute('data-supported'), 'false');
  assert.equal(rows[1].children.length, 3, 'unsupported row has NO checkbox (only 3 children)');
  assert.ok(!rows[1].children.some((c) => c.tagName === 'A'), 'no navigation target for unsafe URL');
});

// ─── 10. new file resets selection ─────────────────────────────────────────
test('4074: selecting a new file resets the previous selection', async () => {
  const { api } = loadUi();
  const first = exportedHtml('<DT><A HREF="https://example.com/a">A</A>');
  await api.handleFileSelected(fakeFile(first.length, () => Promise.resolve(first)));
  api.toggleOccurrence(0);
  assert.equal(api.getSelectedCount(), 1);
  const second = exportedHtml('<DT><A HREF="https://example.com/b">B</A>');
  await api.handleFileSelected(fakeFile(second.length, () => Promise.resolve(second)));
  assert.equal(api.getState(), 'READY');
  assert.equal(api.getSelectedCount(), 0, 'stale selection cleared on new file');
  assert.equal(api.getPreview().entries[0].url, 'https://example.com/b');
});

// ─── 11. READING resets selection ──────────────────────────────────────────
test('4074: READING transition resets selection', async () => {
  const { api } = loadUi();
  const first = exportedHtml(nBookmarks(3, (i) => `https://example.com/${i}`));
  await api.handleFileSelected(fakeFile(first.length, () => Promise.resolve(first)));
  api.selectAllEligible();
  assert.equal(api.getSelectedCount(), 3);
  // Read never resolves, but selection must already be cleared at READING.
  api.handleFileSelected(fakeFile(100, () => new Promise(() => {})));
  assert.equal(api.getState(), 'READING');
  assert.equal(api.getSelectedCount(), 0, 'selection cleared on READING');
});

// ─── 12. ERROR resets selection ─────────────────────────────────────────────
test('4074: parser/read ERROR resets selection', async () => {
  const { api } = loadUi();
  const good = exportedHtml('<DT><A HREF="https://example.com/a">A</A>');
  await api.handleFileSelected(fakeFile(good.length, () => Promise.resolve(good)));
  api.toggleOccurrence(0);
  assert.equal(api.getSelectedCount(), 1);
  const bad = '<html><body>no bookmark structure here';
  await api.handleFileSelected(fakeFile(bad.length, () => Promise.resolve(bad)));
  assert.equal(api.getState(), 'ERROR');
  assert.equal(api.getSelectedCount(), 0, 'selection cleared on ERROR');
});

// ─── 13. EMPTY resets selection ────────────────────────────────────────────
test('4074: EMPTY result resets selection', async () => {
  const { api } = loadUi();
  const good = exportedHtml(nBookmarks(2, (i) => `https://example.com/${i}`));
  await api.handleFileSelected(fakeFile(good.length, () => Promise.resolve(good)));
  api.selectAllEligible();
  assert.equal(api.getSelectedCount(), 2);
  const empty = exportedHtml('');
  await api.handleFileSelected(fakeFile(empty.length, () => Promise.resolve(empty)));
  assert.equal(api.getState(), 'EMPTY');
  assert.equal(api.getSelectedCount(), 0, 'selection cleared on EMPTY');
});

// ─── 14. explicit surface reset clears selection ───────────────────────────
test('4074: explicit reset clears selection and preview', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml(nBookmarks(3, (i) => `https://example.com/${i}`));
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  api.selectAllEligible();
  assert.equal(api.getSelectedCount(), 3);
  api.resetSurface();
  assert.equal(api.getState(), 'IDLE');
  assert.equal(api.getSelectedCount(), 0);
  assert.equal(elements[PREVIEW_ID].children.length, 0);
});

// ─── 15. draft builder does not mutate preview ─────────────────────────────
test('4074: buildOrderedBookmarkImportDraft does not mutate the preview', async () => {
  const { api } = loadUi();
  const html = exportedHtml(nBookmarks(3, (i) => `https://example.com/${i}`));
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  api.toggleOccurrence(1);
  const preview = api.getPreview();
  const beforeTitle = preview.entries[1].title;
  const beforeUrl = preview.entries[1].url;
  const beforeFolderLen = preview.entries[1].folderPath.length;
  const draft = api.buildOrderedBookmarkImportDraft(preview, api.getSelectedOccurrences());
  assert.equal(preview.entries[1].title, beforeTitle, 'preview title unchanged');
  assert.equal(preview.entries[1].url, beforeUrl, 'preview url unchanged');
  assert.equal(preview.entries[1].folderPath.length, beforeFolderLen, 'preview folderPath unchanged');
  // Mutating the draft must not reach the preview.
  const draftEntry = draft.entries[0];
  try { draftEntry.title = 'MUTATED'; } catch (_) { /* frozen in strict mode */ }
  assert.equal(preview.entries[1].title, beforeTitle, 'mutating draft does not mutate preview');
});

// ─── 16. returned draft is detached ────────────────────────────────────────
test('4074: returned draft is detached from internal selection state', async () => {
  const { api } = loadUi();
  const html = exportedHtml(nBookmarks(3, (i) => `https://example.com/${i}`));
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  api.toggleOccurrence(0);
  api.toggleOccurrence(2);
  const preview = api.getPreview();
  const selected = api.getSelectedOccurrences();
  const draft = api.buildOrderedBookmarkImportDraft(preview, selected);
  // Different object references — detached.
  assert.notEqual(draft.entries[0], preview.entries[0]);
  assert.notEqual(draft.entries[0], preview.entries[2]);
  assert.equal(draft.count, 2);
  // Later internal mutation must not alter the already-built draft.
  api.clearSelection();
  assert.equal(api.getSelectedCount(), 0, 'internal selection cleared');
  assert.equal(draft.count, 2, 'detached draft unaffected by later clear');
  assert.deepEqual(hostArr(draft.entries.map((e) => e.sourceIndex)), [0, 2]);
});

// ─── 17. selected-count accessibility ──────────────────────────────────────
test('4074: selected count is visible and announced via role=status aria-live', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml(nBookmarks(3, (i) => `https://example.com/${i}`));
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  api.toggleOccurrence(0);
  assert.equal(elements[SELECTED_COUNT_ID].textContent, '1 selected');
  api.selectAllEligible();
  assert.equal(elements[SELECTED_COUNT_ID].textContent, '3 selected');
  api.clearSelection();
  assert.equal(elements[SELECTED_COUNT_ID].textContent, '0 selected');
  // The static page must host a bounded status region for assistive tech.
  assert.match(HTML_SOURCE, /id="bookmarkHtmlSelectedCount"/, 'count region present in page');
  assert.match(HTML_SOURCE, /id="bookmarkHtmlSelectedCount"[^>]*role="status"/, 'count region is role=status');
  assert.match(HTML_SOURCE, /id="bookmarkHtmlSelectedCount"[^>]*aria-live="polite"/, 'count region is aria-live');
});

// ─── #4072 regression: unsafe URL no raw href echo ─────────────────────────
test('4074 (#4072 regression): credential-bearing URL never echoed as text', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml('<DT><A HREF="https://user:pass@example.com/secret">Cred</A>');
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  const rows = elements[PREVIEW_ID].children;
  const fullText = elements[PREVIEW_ID].textContent + rows[0].children[2].textContent;
  assert.doesNotMatch(fullText, /user:pass/, 'raw credential URL must not be displayed');
  assert.doesNotMatch(fullText, /@example\.com/, 'credential-bearing URL not echoed');
});

// ─── 18. preview authority invalidates on READING (blocking #4075) ───────────
test('4075: preview authority invalidates during a never-resolving READING', async () => {
  const { api } = loadUi();
  const first = exportedHtml(nBookmarks(3, (i) => `https://example.com/${i}`));
  await api.handleFileSelected(fakeFile(first.length, () => Promise.resolve(first)));
  api.selectAllEligible();
  assert.equal(api.getState(), 'READY');
  assert.equal(api.getSelectedCount(), 3);
  assert.ok(api.getPreview(), 'preview present before stale read');
  // Begin a second read that never resolves.
  api.handleFileSelected(fakeFile(100, () => new Promise(() => {})));
  assert.equal(api.getState(), 'READING');
  // Preview authority must be gone while the new file is in flight.
  assert.equal(api.getPreview(), null, 'getPreview() is null during READING');
});

// ─── 19. select-all during READING cannot resurrect old occurrences ──────────
test('4075: select-all during READING cannot resurrect prior occurrences', async () => {
  const { api } = loadUi();
  const first = exportedHtml(nBookmarks(3, (i) => `https://example.com/${i}`));
  await api.handleFileSelected(fakeFile(first.length, () => Promise.resolve(first)));
  api.selectAllEligible();
  assert.equal(api.getSelectedCount(), 3);
  api.handleFileSelected(fakeFile(100, () => new Promise(() => {})));
  assert.equal(api.getState(), 'READING');
  api.selectAllEligible(); // public + reads lastResult
  assert.equal(api.getSelectedCount(), 0, 'no occurrences resurrected from previous file');
  assert.equal(api.getPreview(), null);
});

// ─── 20. ERROR + explicit reset also drop preview authority ─────────────────
test('4075: ERROR and explicit reset leave getPreview() null and selection empty', async () => {
  const { api } = loadUi();
  const good = exportedHtml(nBookmarks(2, (i) => `https://example.com/${i}`));
  await api.handleFileSelected(fakeFile(good.length, () => Promise.resolve(good)));
  api.selectAllEligible();
  assert.equal(api.getSelectedCount(), 2);
  assert.ok(api.getPreview());

  const bad = '<html><body>no bookmark structure here';
  await api.handleFileSelected(fakeFile(bad.length, () => Promise.resolve(bad)));
  assert.equal(api.getState(), 'ERROR');
  assert.equal(api.getPreview(), null, 'ERROR drops preview authority');
  assert.equal(api.getSelectedCount(), 0, 'ERROR empties selection');

  const again = exportedHtml(nBookmarks(2, (i) => `https://example.com/${i}`));
  await api.handleFileSelected(fakeFile(again.length, () => Promise.resolve(again)));
  api.selectAllEligible();
  assert.equal(api.getSelectedCount(), 2);
  assert.ok(api.getPreview());

  api.resetSurface();
  assert.equal(api.getState(), 'IDLE');
  assert.equal(api.getPreview(), null, 'explicit reset drops preview authority');
  assert.equal(api.getSelectedCount(), 0, 'explicit reset empties selection');
});

// ─── capability guardrail: still no network / storage / HTML-execution ──────
test('4074: UI module still has no network / upload / storage / HTML-execution capability', () => {
  assert.doesNotMatch(UI_CODE, /\bfetch\s*\(/, 'no fetch');
  assert.doesNotMatch(UI_CODE, /XMLHttpRequest/, 'no XHR');
  assert.doesNotMatch(UI_CODE, /FormData/, 'no FormData upload');
  assert.doesNotMatch(UI_CODE, /sendBeacon/, 'no beacon');
  assert.doesNotMatch(UI_CODE, /localStorage|sessionStorage|indexedDB|cookie/i, 'no persistent storage');
  assert.doesNotMatch(UI_CODE, /\.innerHTML\s*=/, 'no innerHTML sink');
  assert.doesNotMatch(UI_CODE, /insertAdjacentHTML|outerHTML\s*=/, 'no adjacent/outer HTML sink');
  assert.doesNotMatch(UI_CODE, /srcdoc|document\.write/, 'no srcdoc / document.write');
  // #4074 selection must never persist across reloads.
  assert.doesNotMatch(UI_CODE, /\.setItem\s*\(|\.getItem\s*\(/, 'no storage read/write for selection');
});
