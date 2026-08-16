/**
 * #4072 Local Bookmark HTML Preview UI contract test.
 *
 * Executes the real production UI module
 * (js/import/bookmark-html-preview-ui.js, a browser IIFE) inside a vm
 * sandbox with a stubbed DOM, with the real #4065 parser
 * (js/import/bookmark-html-preview-parser.js) injected as the only parsing
 * authority.
 *
 * Verifies the #4072 UI contract:
 *
 *  - local File.text() read only; oversized files fail closed before read
 *    continuation (UI preflight uses parser HARD_LIMITS.maxInputBytes, never
 *    weaker)
 *  - parser authority is #4065 ONLY — no second parser created in the UI
 *  - ordered preview in exact canonical sourceIndex order; duplicate URLs
 *    stay independent occurrences
 *  - clickable link only when parser returned supported=true + non-null url;
 *    unsupported/credential/rejected entries are inert status only, raw href
 *    never reconstructed or displayed
 *  - textContent/createElement rendering only — user text cannot execute as
 *    HTML (zero innerHTML/srcdoc/document.write sinks)
 *  - states IDLE/READING/READY/EMPTY/ERROR; new file invalidates previous
 *    preview immediately; read/parser error clears stale preview; reset
 *    clears input + preview + error
 *  - no fetch/XHR/FormData/backend route/storage capability in the module
 *
 * No network, no browser, no Production.
 *
 * Refs: #4072, #4065, #3897, #3903, #1882.
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

const FILE_INPUT_ID = 'bookmarkHtmlFileInput';
const STATUS_ID = 'bookmarkHtmlStatus';
const ERROR_ID = 'bookmarkHtmlError';
const PREVIEW_ID = 'bookmarkHtmlPreview';
const RESET_ID = 'bookmarkHtmlResetBtn';

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
  // Mirror real DOM: reflected attributes stay in sync with the property.
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

function fakeFile(size, textFn) {
  return { name: 'bookmarks.html', size, text: textFn };
}

function rowTitle(row) {
  return row.children[1].children[0].textContent;
}

function rowPath(row) {
  return row.children[1].children[1].textContent;
}

test('4072: valid bookmark HTML -> ordered READY preview in sourceIndex order', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml([
    '<DT><H3>Music</H3>',
    '<DL><p>',
    '<DT><A HREF="https://example.com/a">Alpha</A>',
    '<DT><A HREF="https://example.com/b">Beta</A>',
    '</DL><p>',
  ]);
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  assert.equal(api.getState(), 'READY');
  const rows = elements[PREVIEW_ID].children;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].getAttribute('data-source-index'), '0');
  assert.equal(rows[1].getAttribute('data-source-index'), '1');
  assert.equal(rowTitle(rows[0]), 'Alpha');
  assert.equal(rowTitle(rows[1]), 'Beta');
  assert.equal(rows[0].getAttribute('data-supported'), 'true');
  // Supported rows expose exactly one safe normalized link.
  assert.equal(rows[0].children[2].tagName, 'A');
  assert.equal(rows[0].children[2].getAttribute('href'), 'https://example.com/a');
});

test('4072: duplicate URL occurrences stay independent', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml([
    '<DT><A HREF="https://example.com/dup">First</A>',
    '<DT><A HREF="https://example.com/dup">Second</A>',
  ]);
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  const rows = elements[PREVIEW_ID].children;
  assert.equal(rows.length, 2, 'duplicate URLs are NOT deduped');
  assert.equal(rowTitle(rows[0]), 'First');
  assert.equal(rowTitle(rows[1]), 'Second');
  assert.equal(rows[0].children[2].getAttribute('href'), 'https://example.com/dup');
  assert.equal(rows[1].children[2].getAttribute('href'), 'https://example.com/dup');
});

test('4072: nested folder path renders safely as text', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml([
    '<DT><H3>Music</H3>',
    '<DL><p>',
    '<DT><H3>Live</H3>',
    '<DL><p>',
    '<DT><A HREF="https://example.com/b">Beta</A>',
    '</DL><p>',
    '</DL><p>',
  ]);
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  const rows = elements[PREVIEW_ID].children;
  assert.equal(rows.length, 1);
  assert.equal(rowPath(rows[0]), 'Music / Live');
});

test('4072: unsupported scheme gets no clickable href, only inert status', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml('<DT><A HREF="javascript:alert(1)">Bad</A>');
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  const rows = elements[PREVIEW_ID].children;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].getAttribute('data-supported'), 'false');
  // Row children: [order, meta, state] — no <a> at all.
  assert.equal(rows[0].children.length, 3);
  assert.equal(rows[0].children[2].tagName, 'SPAN');
  assert.match(rows[0].children[2].textContent, /지원 안 함/);
  assert.doesNotMatch(rows[0].children[2].textContent, /javascript:/, 'raw href not echoed');
});

test('4072: credential-bearing URL gets no href and no raw credential display', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml('<DT><A HREF="https://user:pass@example.com/secret">Cred</A>');
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  const rows = elements[PREVIEW_ID].children;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].getAttribute('data-supported'), 'false');
  assert.equal(rows[0].children.length, 3, 'no link element');
  assert.ok(!rows[0].children.some((c) => c.tagName === 'A'), 'no navigation target');
  const fullText = elements[PREVIEW_ID].textContent + rows[0].children[2].textContent;
  assert.doesNotMatch(fullText, /user:pass/, 'raw credential URL must not be displayed');
  assert.doesNotMatch(fullText, /@example\.com/, 'credential-bearing URL not echoed');
});

test('4072: malformed parser input -> bounded ERROR and stale preview cleared', async () => {
  const { api, elements } = loadUi();
  const good = exportedHtml('<DT><A HREF="https://example.com/a">Alpha</A>');
  await api.handleFileSelected(fakeFile(good.length, () => Promise.resolve(good)));
  assert.equal(api.getState(), 'READY');
  assert.equal(elements[PREVIEW_ID].children.length, 1);
  const bad = '<html><body>no bookmark structure here';
  await api.handleFileSelected(fakeFile(bad.length, () => Promise.resolve(bad)));
  assert.equal(api.getState(), 'ERROR');
  assert.equal(elements[PREVIEW_ID].children.length, 0, 'stale preview removed');
  assert.equal(elements[ERROR_ID].hidden, false);
  assert.match(elements[ERROR_ID].textContent, /읽지 못했어요|형식이 아니에요/, 'bounded message only');
});

test('4072: oversized file fails closed before File.text() continuation', async () => {
  const { api, elements } = loadUi();
  const bound = api.maxInputBytes();
  assert.equal(bound, 1024 * 1024, 'UI preflight bound equals parser HARD_LIMITS.maxInputBytes');
  let textCalled = false;
  await api.handleFileSelected(fakeFile(bound + 1, () => {
    textCalled = true;
    return Promise.resolve(exportedHtml('<DT><A HREF="https://example.com/a">A</A>'));
  }));
  assert.equal(api.getState(), 'ERROR');
  assert.equal(textCalled, false, 'read must not continue past preflight');
  assert.match(elements[ERROR_ID].textContent, /너무 커요/);
});

test('4072: new file selection invalidates the previous preview immediately', async () => {
  const { api, elements } = loadUi();
  const first = exportedHtml('<DT><A HREF="https://example.com/a">Alpha</A>');
  await api.handleFileSelected(fakeFile(first.length, () => Promise.resolve(first)));
  assert.equal(api.getState(), 'READY');
  assert.equal(elements[PREVIEW_ID].children.length, 1);
  // Second selection: read never resolves, but the old preview must already
  // be gone (invalidated before the read completes).
  api.handleFileSelected(fakeFile(100, () => new Promise(() => {})));
  assert.equal(api.getState(), 'READING');
  assert.equal(elements[PREVIEW_ID].children.length, 0, 'previous preview invalidated immediately');
});

test('4072: empty bookmark set -> EMPTY state', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml('');
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  assert.equal(api.getState(), 'EMPTY');
  assert.match(elements[STATUS_ID].textContent, /항목이 없어요/);
  assert.equal(elements[PREVIEW_ID].children.length, 0);
});

test('4072: reset clears file input, preview, and error', async () => {
  const { api, elements } = loadUi();
  const html = exportedHtml('<DT><A HREF="https://example.com/a">Alpha</A>');
  await api.handleFileSelected(fakeFile(html.length, () => Promise.resolve(html)));
  assert.equal(api.getState(), 'READY');
  elements[FILE_INPUT_ID].value = 'C:\\fakepath\\bookmarks.html';
  api.resetSurface();
  assert.equal(api.getState(), 'IDLE');
  assert.equal(elements[FILE_INPUT_ID].value, '');
  assert.equal(elements[PREVIEW_ID].children.length, 0);
  assert.equal(elements[ERROR_ID].hidden, true);
});

test('4072: read failure -> bounded ERROR and stale preview cleared', async () => {
  const { api, elements } = loadUi();
  const good = exportedHtml('<DT><A HREF="https://example.com/a">Alpha</A>');
  await api.handleFileSelected(fakeFile(good.length, () => Promise.resolve(good)));
  assert.equal(api.getState(), 'READY');
  await api.handleFileSelected(fakeFile(100, () => Promise.reject(new Error('disk'))));
  assert.equal(api.getState(), 'ERROR');
  assert.match(elements[ERROR_ID].textContent, /읽지 못했어요/);
  assert.equal(elements[PREVIEW_ID].children.length, 0);
});

test('4072: buildRow renders user text as inert textContent, never executable HTML', () => {
  const { api } = loadUi();
  const row = api.buildRow({
    sourceIndex: 0,
    title: '<img src=x onerror=alert(1)>',
    folderPath: ['<script>alert(1)</script>'],
    supported: true,
    url: 'https://example.com/a',
    reasonCode: null,
  });
  assert.equal(rowTitle(row), '<img src=x onerror=alert(1)>', 'title stays plain text');
  assert.equal(rowPath(row), '<script>alert(1)</script>', 'path stays plain text');
  const tags = [];
  (function walk(node) {
    tags.push(node.tagName);
    for (const child of node.children) walk(child);
  })(row);
  assert.ok(!tags.includes('IMG'), 'no img element can be created from title text');
  assert.ok(!tags.includes('SCRIPT'), 'no script element can be created from path text');
});

test('4072: UI module has no network / upload / storage / HTML-execution capability', () => {
  assert.doesNotMatch(UI_CODE, /\bfetch\s*\(/, 'no fetch');
  assert.doesNotMatch(UI_CODE, /XMLHttpRequest/, 'no XHR');
  assert.doesNotMatch(UI_CODE, /FormData/, 'no FormData upload');
  assert.doesNotMatch(UI_CODE, /sendBeacon/, 'no beacon');
  assert.doesNotMatch(UI_CODE, /localStorage|sessionStorage|indexedDB|cookie/i, 'no persistence');
  assert.doesNotMatch(UI_CODE, /\.innerHTML\s*=/, 'no innerHTML sink');
  assert.doesNotMatch(UI_CODE, /insertAdjacentHTML|outerHTML\s*=/, 'no adjacent/outer HTML sink');
  assert.doesNotMatch(UI_CODE, /srcdoc|document\.write/, 'no srcdoc / document.write');
});

test('4072: UI only calls the #4065 parser authority — no second parser', () => {
  // The UI must delegate to the shared parser API and must not implement its
  // own bookmark HTML tokenizer / DOMParser path.
  assert.match(UI_CODE, /parseBookmarkHtmlPreview/, 'delegates to the #4065 parser');
  assert.doesNotMatch(UI_CODE, /DOMParser/, 'no DOMParser in UI');
  assert.doesNotMatch(UI_CODE, /querySelectorAll\(['"]a|getElementsByTagName\(['"]a/, 'no own <a> scanner');
});
