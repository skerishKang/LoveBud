'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function collectText(node) {
  let result = '';
  if (!node) return result;
  if (node.children && node.children.length) {
    for (let i = 0; i < node.children.length; i++) {
      result += collectText(node.children[i]);
    }
  }
  if (node.data) result += node.data;
  if (node.textContent && node.nodeType !== 3) result += node.textContent;
  return result;
}

function findBtnByText(mount, text) {
  function search(node) {
    if (!node || !node.children) return null;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.tagName === 'BUTTON') {
        const btnText = collectText(child);
        if (btnText.indexOf(text) >= 0) return child;
      }
      const found = search(child);
      if (found) return found;
    }
    return null;
  }
  return search(mount);
}

function makeEl(tag) {
  const el = {
    id: '', tagName: tag.toUpperCase(), style: {}, className: '',
    textContent: '', innerHTML: '', hidden: false, disabled: false,
    dataset: {}, children: [], parentElement: null, nodeType: 1,
    _listeners: {},
    setAttribute: function(k, v) { this.dataset[k] = v; },
    getAttribute: function(k) { return this.dataset[k] || null; },
    removeAttribute: function(k) { delete this.dataset[k]; },
    appendChild: function(c) { if (c) c.parentElement = this; this.children.push(c); return c; },
    insertBefore: function(c) { if (c) c.parentElement = this; this.children.push(c); return c; },
    removeChild: function(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); },
    querySelector: function(sel) {
      // Support simple attribute selectors: [data-xyz]
      const attrMatch = sel.match(/^\[data-(.+)\]$/);
      if (attrMatch) {
        const attrName = attrMatch[1].replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        for (let i = 0; i < this.children.length; i++) {
          const child = this.children[i];
          if (child.dataset && child.dataset[attrName] !== undefined) return child;
        }
        return null;
      }
      // Support .className selectors
      const classMatch = sel.match(/^\.(.+)$/);
      if (classMatch) {
        for (let i = 0; i < this.children.length; i++) {
          const child = this.children[i];
          if (child.className && child.className.indexOf(classMatch[1]) >= 0) return child;
        }
        return null;
      }
      return null;
    },
    querySelectorAll: function(sel) {
      const attrMatch = sel.match(/^\[data-(.+)\]$/);
      if (attrMatch) {
        const attrName = attrMatch[1].replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        const results = [];
        for (let i = 0; i < this.children.length; i++) {
          const child = this.children[i];
          if (child.dataset && child.dataset[attrName] !== undefined) results.push(child);
        }
        return results;
      }
      return [];
    },
    addEventListener: function(type, cb) {
      if (!this._listeners) this._listeners = {};
      (this._listeners[type] = this._listeners[type] || []).push(cb);
      if (type === 'click') this._clickHandler = cb;
    },
    click: function() {
      if (typeof this._clickHandler === 'function') {
        return this._clickHandler();
      }
    },
    focus: function() {}
  };
  return el;
}

function makeDoc() {
  return {
    createElement: makeEl,
    createTextNode: function(text) {
      return { nodeType: 3, textContent: String(text || ''), data: String(text || '') };
    },
    getElementById: function() { return null; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    body: makeEl('body'),
    activeElement: null,
    addEventListener: function() {}
  };
}

function build(depsOverrides) {
  depsOverrides = depsOverrides || {};
  const doc = makeDoc();
  const sb = {
    window: { location: { pathname: '/pages/editor.html', origin: 'https://example.com', search: '' } },
    document: doc, console: { log: function() {}, error: function() {}, warn: function() {} },
    globalThis: null, setTimeout: setTimeout, clearTimeout: clearTimeout
  };
  sb.globalThis = sb;
  sb.window = sb;

  vm.createContext(sb);
  vm.runInContext(read('js/editor/editor-detail-tree-meta.js'), sb);

  const deps = Object.assign({
    i18n: function(k) { return k; },
    formatI18nText: function(k, fb) { return fb; },
    resolveTreeTitleText: function(t) { return t || ''; },
    createInlineIcon: function(name) { return { textContent: name || '', style: {}, className: '' }; },
    showToast: function() {},
    openCurrentMomentDetail: function() {},
    canEdit: true,
    openRenameTree: function() {},
    updateDetailPanel: function() { return function() {}; }
  }, depsOverrides);

  const boundary = sb.window.createEditorDetailTreeMetaBoundary(deps);
  const mount = doc.createElement('div');
  return { boundary: boundary, mount: mount, sb: sb, deps: deps };
}

function render(depsOverrides, opts) {
  opts = opts || {};
  const r = build(depsOverrides || {});
  const isPub = opts.isPublic !== undefined ? opts.isPublic : true;
  r.boundary.renderTreeMetaBoundary(r.mount, {
    displayTreeTitle: opts.title || 'Test',
    visIcon: isPub ? 'public' : 'lock',
    visLabel: isPub ? '공개' : '비공개',
    visInfo: 'info', isPublic: isPub, countLabel: '3',
    shareButtonEl: null, openDetailButtonEl: null,
    shareBtn: null, openDetailBtn: null
  }, 'tree-1', opts.data || { id: 'm1', title: 'Moment' });
  return r;
}

const DATA = { id: 'm1', title: 'Test Moment' };

test('1. canEdit:false - owner buttons not rendered (no rename, no visibility toggle)', () => {
  const r = render({ canEdit: false }, { data: DATA });
  assert.ok(collectText(r.mount).indexOf('이름 바꾸기') === -1, 'Rename button must not appear when canEdit=false');
  assert.ok(collectText(r.mount).indexOf('비공개로 전환') === -1, 'Visibility toggle must not appear when canEdit=false');
  assert.ok(collectText(r.mount).indexOf('공개로 전환') === -1, 'Visibility toggle must not appear when canEdit=false');
});

test('2. canEdit:true public - only rename button (no visibility toggle per #2935)', () => {
  const r = render({ canEdit: true }, { isPublic: true, data: DATA });
  assert.ok(collectText(r.mount).indexOf('이름 바꾸기') >= 0, 'Owner must see rename button');
  assert.ok(collectText(r.mount).indexOf('비공개로 전환') === -1, 'Visibility toggle must NOT appear (display-only per #2935)');
});

test('3. canEdit:true private - only rename button (no visibility toggle per #2935)', () => {
  const r = render({ canEdit: true }, { isPublic: false, data: DATA });
  assert.ok(collectText(r.mount).indexOf('이름 바꾸기') >= 0, 'Owner must see rename button');
  assert.ok(collectText(r.mount).indexOf('공개로 전환') === -1, 'Visibility toggle must NOT appear (display-only per #2935)');
});

test('4. rename click calls openRenameTree with canEdit, triggerEl, onSaved', () => {
  let captured = null;
  const r = render({
    canEdit: true,
    openRenameTree: function(o) { captured = o; }
  }, { isPublic: true, data: DATA });

  const btn = findBtnByText(r.mount, '이름 바꾸기');
  assert.ok(btn !== null, 'Rename button must exist in tree');
  btn.click();

  assert.ok(captured !== null, 'openRenameTree must be called on rename click');
  assert.strictEqual(captured.canEdit, true, 'canEdit passed');
  assert.ok(typeof captured.triggerEl === 'object', 'triggerEl passed');
  assert.ok(typeof captured.onSaved === 'function', 'onSaved callback passed');
});

test('5. onSaved passes original data, not {}', () => {
  let renameOpts = null;
  let rerenderArgs = null;
  const testData = { id: 'm1', title: 'Original' };

  const r = render({
    canEdit: true,
    openRenameTree: function(o) { renameOpts = o; },
    updateDetailPanel: function() { return function(d) { rerenderArgs = d; }; }
  }, { isPublic: true, data: testData });

  const btn = findBtnByText(r.mount, '이름 바꾸기');
  assert.ok(btn !== null, 'Rename button must exist');
  btn.click();

  assert.ok(renameOpts !== null);
  renameOpts.onSaved({ id: 'tree-1', title: 'Renamed' });

  assert.ok(rerenderArgs !== null);
  assert.strictEqual(rerenderArgs, testData, 'Original data reference preserved');
  assert.ok(Object.keys(rerenderArgs).length > 0, 'Not empty object {}');
});

test('6. Visibility status displays correctly (public/private) - display only', () => {
  const rPublic = render({ canEdit: true }, { isPublic: true, data: DATA });
  const textPublic = collectText(rPublic.mount);
  assert.ok(textPublic.indexOf('공개') >= 0, 'Public tree must show public status');

  const rPrivate = render({ canEdit: true }, { isPublic: false, data: DATA });
  const textPrivate = collectText(rPrivate.mount);
  assert.ok(textPrivate.indexOf('비공개') >= 0, 'Private tree must show private status');
});

test('7. No updateTreeVisibility call in createOwnerActionButtons', () => {
  const js = read('js/editor/editor-detail-tree-meta.js');
  const fnStart = js.indexOf('createOwnerActionButtons');
  assert.ok(fnStart >= 0, 'createOwnerActionButtons must exist');
  const fnBody = js.slice(fnStart, js.indexOf('return [', fnStart)) + js.slice(js.indexOf('return [', fnStart), js.indexOf('];', js.indexOf('return [', fnStart)) + 2);
  assert.ok(fnBody.indexOf('updateTreeVisibility') === -1,
    'createOwnerActionButtons must not reference updateTreeVisibility (removed per #2935)');
});

test('8. Share and open detail buttons appear when moment is selected', () => {
  const r = render({ canEdit: true }, { isPublic: true, data: DATA });
  const shareBtn = findBtnByText(r.mount, '링크 복사');
  const openDetailBtn = findBtnByText(r.mount, '상세로 보기');
  assert.ok(shareBtn !== null, 'Share button must appear when moment selected');
  assert.ok(openDetailBtn !== null, 'Open detail button must appear when moment selected');
});

test('9. No share/open detail buttons when no moment selected', () => {
  const r = render({ canEdit: true }, { isPublic: true, data: null });
  const shareBtn = findBtnByText(r.mount, '링크 복사');
  const openDetailBtn = findBtnByText(r.mount, '상세로 보기');
  assert.strictEqual(shareBtn, null, 'Share button must NOT appear when no moment selected');
  assert.strictEqual(openDetailBtn, null, 'Open detail button must NOT appear when no moment selected');
});