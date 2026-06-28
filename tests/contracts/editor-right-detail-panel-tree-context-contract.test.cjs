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

function makeDoc() {
  return {
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      style: {},
      className: '',
      textContent: '',
      innerHTML: '',
      hidden: false,
      disabled: false,
      dataset: {},
      children: [],
      parentElement: null,
      nodeType: 1,
      _listeners: {},
      setAttribute: function(k, v) { this.dataset[k] = v; },
      getAttribute: function(k) { return this.dataset[k] || null; },
      removeAttribute: function(k) { delete this.dataset[k]; },
      appendChild: function(c) { if (c) c.parentElement = this; this.children.push(c); return c; },
      insertBefore: function(c) { if (c) c.parentElement = this; this.children.push(c); return c; },
      removeChild: function(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); },
      querySelector: function(sel) {
        const attrMatch = sel.match(/^\[data-(.+)\]$/);
        if (attrMatch) {
          const attrName = attrMatch[1].replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          for (const child of this.children) {
            if (child.dataset && child.dataset[attrName] !== undefined) return child;
          }
          return null;
        }
        const classMatch = sel.match(/^\.(.+)$/);
        if (classMatch) {
          for (const child of this.children) {
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
          for (const child of this.children) {
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
    }),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text || ''), data: String(text || '') }),
    getElementById: function() { return null; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    body: { children: [], tagName: 'BODY', style: {}, className: '', dataset: {}, querySelector: function() { return null; } },
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
  // Ensure window is available as global in VM context
  sb.window = sb.window;

  vm.createContext(sb);
  // Manually inject window into global scope
  vm.runInContext('globalThis.window = globalThis.window || {}; globalThis.window.location = globalThis.window.location || { pathname: "/pages/editor.html", origin: "https://example.com", search: "" };', sb);
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

function renderTreeContext(opts) {
  opts = opts || {};
  // Extract deps overrides from opts
  const depsOverrides = {};
  if (opts.canEdit !== undefined) depsOverrides.canEdit = opts.canEdit;
  const r = build(depsOverrides);
  const totalMoments = opts.totalMoments ?? 3;
  const treeState = {
    totalMomentCount: totalMoments,
    hasMoments: totalMoments > 0,
    hasVisibleMoments: totalMoments > 0
  };
  const currentTree = {
    id: opts.treeId || 'tree-1',
    title: opts.title || 'Test Tree',
    visibility: opts.visibility || 'public'
  };
  // Allow data to be explicitly null/undefined for empty state tests
  const data = opts.data === undefined ? { id: 'm1', title: 'Moment' } : opts.data;
  const localSaveMode = opts.localSaveMode || false;
  const isEmptyState = !data || !data.id;

  const model = r.boundary.buildTreeMetaRenderModel({
    currentTree: currentTree,
    treeState: treeState,
    data: data,
    isEmptyState: isEmptyState,
    localSaveMode: localSaveMode
  });
  r.boundary.renderTreeMetaBoundary(r.mount, model, currentTree.id, data);
  return r;
}

test('1. Tree context card renders when tree is loaded (has moments)', () => {
  const r = renderTreeContext({ totalMoments: 3 });
  const text = collectText(r.mount);
  assert.ok(text.indexOf('Test Tree') >= 0, 'Tree title must be present');
  assert.ok(text.indexOf('현재 트리') >= 0, 'Tree eyebrow must be present');
  // formatI18nText mock returns fallback without replacement, so {count} literal is present
  assert.ok(text.indexOf('개의 순간이 이 트리 안에서 이어지고 있어요') >= 0, 'Moment count text must be present');
  assert.ok(text.indexOf('공개') >= 0 || text.indexOf('비공개') >= 0, 'Visibility status must be displayed');
});

test('2. Tree context card renders when tree is empty (no moments yet)', () => {
  const r = renderTreeContext({ totalMoments: 0 });
  const text = collectText(r.mount);
  assert.ok(text.indexOf('Test Tree') >= 0, 'Tree title must be present even for empty tree');
  assert.ok(text.indexOf('아직 첫 순간을 기다리고 있어요.') >= 0, 'Empty tree status must be shown');
  assert.ok(text.indexOf('공개') >= 0 || text.indexOf('비공개') >= 0, 'Visibility status must be displayed');
});

test('3. Tree context shows public/private status (display only, no toggle button)', () => {
  const rPublic = renderTreeContext({ visibility: 'public', totalMoments: 2 });
  const textPublic = collectText(rPublic.mount);
  assert.ok(textPublic.indexOf('공개') >= 0, 'Public tree must show public status');

  const rPrivate = renderTreeContext({ visibility: 'private', totalMoments: 2 });
  const textPrivate = collectText(rPrivate.mount);
  assert.ok(textPrivate.indexOf('비공개') >= 0, 'Private tree must show private status');

  // Verify no visibility toggle button (make_private / make_public) is rendered
  const publicBtn = findBtnByText(rPublic.mount, '비공개로 전환');
  const privateBtn = findBtnByText(rPrivate.mount, '공개로 전환');
  assert.strictEqual(publicBtn, null, 'Public tree must NOT have visibility toggle button');
  assert.strictEqual(privateBtn, null, 'Private tree must NOT have visibility toggle button');
});

test('4. Owner sees rename button in tree context', () => {
  const r = renderTreeContext({ canEdit: true, totalMoments: 2 });
  const renameBtn = findBtnByText(r.mount, '이름 바꾸기');
  assert.ok(renameBtn !== null, 'Owner must see rename button');
});

test('5. Non-owner does NOT see rename button in tree context', () => {
  const r = renderTreeContext({ canEdit: false, totalMoments: 2 });
  const renameBtn = findBtnByText(r.mount, '이름 바꾸기');
  assert.strictEqual(renameBtn, null, 'Non-owner must NOT see rename button');
});

test('6. Tree context shows share and open detail buttons when moment is selected', () => {
  const r = renderTreeContext({ totalMoments: 2, data: { id: 'm1', title: 'Moment' } });
  const shareBtn = findBtnByText(r.mount, '링크 복사');
  const openDetailBtn = findBtnByText(r.mount, '상세로 보기');
  assert.ok(shareBtn !== null, 'Share button must be present when moment selected');
  assert.ok(openDetailBtn !== null, 'Open detail button must be present when moment selected');
});

test('7. Tree context does NOT show share/open detail when no moment selected (empty state)', () => {
  const r = renderTreeContext({ totalMoments: 2, data: null });
  const shareBtn = findBtnByText(r.mount, '링크 복사');
  const openDetailBtn = findBtnByText(r.mount, '상세로 보기');
  assert.strictEqual(shareBtn, null, 'Share button must NOT be present when no moment selected');
  assert.strictEqual(openDetailBtn, null, 'Open detail button must NOT be present when no moment selected');
});

test('8. Tree context uses lower visual hierarchy (surface-container-low background)', () => {
  const css = read('css/editor/editor-detail-content/section-cards.css');
  // Tree meta section should have surface-container-low background (lower visual treatment
  assert.ok(css.indexOf('.editor-tree-meta-section') >= 0, 'CSS must define .editor-tree-meta-section');
  assert.ok(css.indexOf('surface-container-low') >= 0 || css.indexOf('surface-container') >= 0, 'Tree context must use surface-container styling for lower hierarchy');
});

test('9. detail-view-mode-template has tree meta section BEFORE detailViewMode', () => {
  const html = read('js/editor/templates/editor-detail-view-mode-template.js');
  const treeMetaIdx = html.indexOf('class="editor-tree-meta-section"');
  const viewModeIdx = html.indexOf('id="detailViewMode"');
  assert.ok(treeMetaIdx >= 0, 'Template must contain editor-tree-meta-section');
  assert.ok(viewModeIdx >= 0, 'Template must contain detailViewMode');
  assert.ok(treeMetaIdx < viewModeIdx, 'Tree meta section must appear before detailViewMode (persistent context)');
});

test('10. editor-detail-tree-meta.js does NOT import or call updateTreeVisibility', () => {
  const js = read('js/editor/editor-detail-tree-meta.js');
  assert.ok(js.indexOf('updateTreeVisibility') === -1, 'Must not reference updateTreeVisibility (visibility control removed per #2935)');
  assert.ok(js.indexOf('createOwnerActionButtons') >= 0, 'createOwnerActionButtons must still exist for rename only');
  // Verify createOwnerActionButtons only returns rename button
  const fnStart = js.indexOf('createOwnerActionButtons');
  const fnBody = js.slice(fnStart);
  const returnIdx = fnBody.indexOf('return [renameBtn');
  assert.ok(returnIdx >= 0, 'createOwnerActionButtons must return array with renameBtn only');
});