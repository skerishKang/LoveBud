'use strict';

/*
 * #3576 focused runtime behavior test
 *
 * Executes the REAL production boundary factories:
 *   - js/editor/editor-detail-tree-meta.js  -> window.createEditorDetailTreeMetaBoundary
 *   - js/viewer/public-viewer-detail-tree-meta.js -> window.createPublicViewerDetailTreeMetaBoundary
 *
 * and calls their REAL buildTreeMetaRenderModel() to prove that
 * resolveTreeTitleText(i18n, rawTitle) is invoked with the i18n function first,
 * so custom tree titles survive and locale fallbacks only apply to sentinel keys.
 *
 * Layer: EXECUTED_FAKE
 *   Reads production module source and executes it in a local vm context with
 *   injected fake DOM + stubbed i18n deps. No real browser / network / DB.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

// Minimal fake DOM element (only what createTreeMetaBlock needs indirectly).
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    style: {},
    dataset: {},
    className: '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    disabled: false,
    children: [],
    parentElement: null,
    nodeType: 1,
    _listeners: {},
    setAttribute(k, v) { el.dataset[k] = v; },
    getAttribute(k) { return el.dataset[k] || null; },
    removeAttribute(k) { delete el.dataset[k]; },
    appendChild(c) { if (c) c.parentElement = el; el.children.push(c); return c; },
    insertBefore(c) { if (c) c.parentElement = el; el.children.push(c); return c; },
    removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); },
    addEventListener(type, fn) { (el._listeners[type] = el._listeners[type] || []).push(fn); },
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    replaceChildren() { el.children = []; },
    classList: { add() {}, remove() {}, contains() { return false; } }
  };
  return el;
}

function makeDocument() {
  return {
    createElement: (tag) => makeEl(tag),
    createTextNode: (t) => ({ nodeType: 3, textContent: t, data: t, children: [] }),
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

// Locale table mirroring the production ko strings used by resolveTreeTitleText.
const LOCALE = {
  default_tree_title: '내 러브트리',
  lovetree_brand: '러브트리 브랜드'
};

function makeI18n() {
  return (key) => (Object.prototype.hasOwnProperty.call(LOCALE, key) ? LOCALE[key] : key);
}

function makeFormatI18nText() {
  return (key, fallback, vars) => {
    if (vars && typeof vars === 'object') {
      return (fallback || key).replace(/\{(\w+)\}/g, (m, name) =>
        Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m);
    }
    return fallback || key;
  };
}

function makeInlineIcon() {
  return () => makeEl('span');
}

// Load a production IIFE module into a fresh context that exposes window globals.
function loadBoundary(file, win) {
  const src = read(file);
  const ctx = {
    window: win,
    document: win.document,
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    console,
    setTimeout,
    clearTimeout,
    Promise,
    Math,
    String,
    Object,
    Array,
    JSON,
    RegExp,
    Error
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: file });
}

function buildDeps(win) {
  return {
    i18n: makeI18n(),
    formatI18nText: makeFormatI18nText(),
    resolveTreeTitleText: win.LoveBudEditorHelpers.resolveTreeTitleText,
    createInlineIcon: makeInlineIcon(),
    showToast: () => {},
    openCurrentMomentDetail: () => {},
    canEdit: false,
    openRenameTree: () => {},
    updateTreeVisibility: () => Promise.resolve(),
    updateDetailPanel: () => null
  };
}

function baseTreeState(hasMoments) {
  return {
    totalMomentCount: hasMoments ? 3 : 0,
    hasMoments: !!hasMoments
  };
}

test('owner buildTreeMetaRenderModel preserves custom title', () => {
  const win = { document: makeDocument(), LoveBudEditorHelpers: {} };
  // editor-helpers exposes resolveTreeTitleText via window.LoveBudEditorHelpers
  const helpersSrc = read('js/editor/editor-helpers.js');
  const hctx = {
    window: win,
    document: win.document,
    console,
    Math, String, Object, Array, JSON, RegExp, Error, setTimeout, clearTimeout
  };
  hctx.globalThis = hctx;
  vm.createContext(hctx);
  vm.runInContext(helpersSrc, hctx, { filename: 'js/editor/editor-helpers.js' });

  loadBoundary('js/editor/editor-detail-tree-meta.js', win);
  const boundary = win.createEditorDetailTreeMetaBoundary(buildDeps(win));

  const model = boundary.buildTreeMetaRenderModel({
    currentTree: { title: '나의 추억 트리', visibility: 'public' },
    treeState: baseTreeState(true),
    data: { id: 'tree-1' },
    isEmptyState: false,
    localSaveMode: false
  });

  assert.equal(model.displayTreeTitle, '나의 추억 트리',
    'owner custom title must be preserved verbatim');
});

test('public viewer buildTreeMetaRenderModel preserves custom title', () => {
  const win = { document: makeDocument(), LoveBudEditorHelpers: {} };
  const helpersSrc = read('js/editor/editor-helpers.js');
  const hctx = {
    window: win,
    document: win.document,
    console,
    Math, String, Object, Array, JSON, RegExp, Error, setTimeout, clearTimeout
  };
  hctx.globalThis = hctx;
  vm.createContext(hctx);
  vm.runInContext(helpersSrc, hctx, { filename: 'js/editor/editor-helpers.js' });

  loadBoundary('js/viewer/public-viewer-detail-tree-meta.js', win);
  const boundary = win.createPublicViewerDetailTreeMetaBoundary(buildDeps(win));

  const model = boundary.buildTreeMetaRenderModel({
    currentTree: { title: '공개 여행 트리', visibility: 'public' },
    treeState: baseTreeState(true),
    data: { id: 'tree-2' },
    isEmptyState: false,
    localSaveMode: false
  });

  assert.equal(model.displayTreeTitle, '공개 여행 트리',
    'public viewer custom title must be preserved verbatim');
});

test('empty title falls back to locale default_tree_title', () => {
  const win = { document: makeDocument(), LoveBudEditorHelpers: {} };
  const helpersSrc = read('js/editor/editor-helpers.js');
  const hctx = {
    window: win, document: win.document, console,
    Math, String, Object, Array, JSON, RegExp, Error, setTimeout, clearTimeout
  };
  hctx.globalThis = hctx;
  vm.createContext(hctx);
  vm.runInContext(helpersSrc, hctx, { filename: 'js/editor/editor-helpers.js' });

  loadBoundary('js/editor/editor-detail-tree-meta.js', win);
  const boundary = win.createEditorDetailTreeMetaBoundary(buildDeps(win));

  const model = boundary.buildTreeMetaRenderModel({
    currentTree: { title: '', visibility: 'public' },
    treeState: baseTreeState(false),
    data: null,
    isEmptyState: true,
    localSaveMode: false
  });

  assert.equal(model.displayTreeTitle, '내 러브트리',
    'empty title must fall back to i18n default_tree_title');
});

test('raw title "default_tree_title" maps to locale string', () => {
  const win = { document: makeDocument(), LoveBudEditorHelpers: {} };
  const helpersSrc = read('js/editor/editor-helpers.js');
  const hctx = {
    window: win, document: win.document, console,
    Math, String, Object, Array, JSON, RegExp, Error, setTimeout, clearTimeout
  };
  hctx.globalThis = hctx;
  vm.createContext(hctx);
  vm.runInContext(helpersSrc, hctx, { filename: 'js/editor/editor-helpers.js' });

  loadBoundary('js/editor/editor-detail-tree-meta.js', win);
  const boundary = win.createEditorDetailTreeMetaBoundary(buildDeps(win));

  const model = boundary.buildTreeMetaRenderModel({
    currentTree: { title: 'default_tree_title', visibility: 'public' },
    treeState: baseTreeState(true),
    data: { id: 't' },
    isEmptyState: false,
    localSaveMode: false
  });

  assert.equal(model.displayTreeTitle, '내 러브트리',
    'sentinel key default_tree_title must map to locale string');
});

test('raw title "lovetree_brand" maps to locale string', () => {
  const win = { document: makeDocument(), LoveBudEditorHelpers: {} };
  const helpersSrc = read('js/editor/editor-helpers.js');
  const hctx = {
    window: win, document: win.document, console,
    Math, String, Object, Array, JSON, RegExp, Error, setTimeout, clearTimeout
  };
  hctx.globalThis = hctx;
  vm.createContext(hctx);
  vm.runInContext(helpersSrc, hctx, { filename: 'js/editor/editor-helpers.js' });

  loadBoundary('js/viewer/public-viewer-detail-tree-meta.js', win);
  const boundary = win.createPublicViewerDetailTreeMetaBoundary(buildDeps(win));

  const model = boundary.buildTreeMetaRenderModel({
    currentTree: { title: 'lovetree_brand', visibility: 'public' },
    treeState: baseTreeState(true),
    data: { id: 't' },
    isEmptyState: false,
    localSaveMode: false
  });

  assert.equal(model.displayTreeTitle, '러브트리 브랜드',
    'sentinel key lovetree_brand must map to locale string');
});

test('title preserved with and without selected moment', () => {
  const win = { document: makeDocument(), LoveBudEditorHelpers: {} };
  const helpersSrc = read('js/editor/editor-helpers.js');
  const hctx = {
    window: win, document: win.document, console,
    Math, String, Object, Array, JSON, RegExp, Error, setTimeout, clearTimeout
  };
  hctx.globalThis = hctx;
  vm.createContext(hctx);
  vm.runInContext(helpersSrc, hctx, { filename: 'js/editor/editor-helpers.js' });

  loadBoundary('js/editor/editor-detail-tree-meta.js', win);
  const boundary = win.createEditorDetailTreeMetaBoundary(buildDeps(win));

  const noMoment = boundary.buildTreeMetaRenderModel({
    currentTree: { title: '나의 추억 트리', visibility: 'private' },
    treeState: baseTreeState(false),
    data: null,
    isEmptyState: true,
    localSaveMode: false
  });

  const withMoment = boundary.buildTreeMetaRenderModel({
    currentTree: { title: '나의 추억 트리', visibility: 'private' },
    treeState: baseTreeState(true),
    data: { id: 't' },
    isEmptyState: false,
    localSaveMode: false
  });

  assert.equal(noMoment.displayTreeTitle, '나의 추억 트리');
  assert.equal(withMoment.displayTreeTitle, '나의 추억 트리');
  assert.equal(noMoment.displayTreeTitle, withMoment.displayTreeTitle,
    'title must be stable regardless of selected moment presence');
});

test('owner and public viewer agree on identical input', () => {
  const win1 = { document: makeDocument(), LoveBudEditorHelpers: {} };
  const win2 = { document: makeDocument(), LoveBudEditorHelpers: {} };
  const helpersSrc = read('js/editor/editor-helpers.js');
  for (const win of [win1, win2]) {
    const hctx = {
      window: win, document: win.document, console,
      Math, String, Object, Array, JSON, RegExp, Error, setTimeout, clearTimeout
    };
    hctx.globalThis = hctx;
    vm.createContext(hctx);
    vm.runInContext(helpersSrc, hctx, { filename: 'js/editor/editor-helpers.js' });
  }

  loadBoundary('js/editor/editor-detail-tree-meta.js', win1);
  loadBoundary('js/viewer/public-viewer-detail-tree-meta.js', win2);

  const ownerModel = win1.createEditorDetailTreeMetaBoundary(buildDeps(win1))
    .buildTreeMetaRenderModel({
      currentTree: { title: '공개 여행 트리', visibility: 'public' },
      treeState: baseTreeState(true),
      data: { id: 't' },
      isEmptyState: false,
      localSaveMode: false
    });

  const viewerModel = win2.createPublicViewerDetailTreeMetaBoundary(buildDeps(win2))
    .buildTreeMetaRenderModel({
      currentTree: { title: '공개 여행 트리', visibility: 'public' },
      treeState: baseTreeState(true),
      data: { id: 't' },
      isEmptyState: false,
      localSaveMode: false
    });

  assert.equal(ownerModel.displayTreeTitle, viewerModel.displayTreeTitle,
    'owner and public viewer must return identical title for identical input');
});

test('regression: 1-arg call would clobber custom title to fallback', () => {
  // Directly assert the helper contract: resolveTreeTitleText(rawTitle) is WRONG
  // because rawTitle is then treated as the i18nFn and returns falsy -> fallback.
  const win = { document: makeDocument(), LoveBudEditorHelpers: {} };
  const helpersSrc = read('js/editor/editor-helpers.js');
  const hctx = {
    window: win, document: win.document, console,
    Math, String, Object, Array, JSON, RegExp, Error, setTimeout, clearTimeout
  };
  hctx.globalThis = hctx;
  vm.createContext(hctx);
  vm.runInContext(helpersSrc, hctx, { filename: 'js/editor/editor-helpers.js' });

  const resolveTreeTitleText = win.LoveBudEditorHelpers.resolveTreeTitleText;

  // Correct 2-arg call
  const correct = resolveTreeTitleText(makeI18n(), '나의 추억 트리');
  assert.equal(correct, '나의 추억 트리');

  // Buggy 1-arg call (rawTitle passed as i18nFn)
  const buggy = resolveTreeTitleText('나의 추억 트리');
  assert.notEqual(buggy, '나의 추억 트리',
    '1-arg call must NOT preserve custom title — it clobbers to fallback');
  assert.equal(buggy, '러브트리',
    '1-arg call falls back to built-in default because i18nFn is undefined');
});
