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

function assertVersionedAsset(html, assetPattern, message) {
  assert.match(html, new RegExp(assetPattern + "\\?v=[A-Za-z0-9][A-Za-z0-9._-]*['\"]"), message);
}

function collectText(node) {
  var result = '';
  if (!node) return result;
  if (node.children && node.children.length) {
    for (var i = 0; i < node.children.length; i++) {
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
    for (var i = 0; i < node.children.length; i++) {
      var child = node.children[i];
      if (child.tagName === 'button') {
        var btnText = collectText(child);
        if (btnText.indexOf(text) >= 0) return child;
      }
      var found = search(child);
      if (found) return found;
    }
    return null;
  }
  return search(mount);
}

function makeEl(tag) {
  var el = {
    id: '', tagName: tag, style: {}, className: '',
    textContent: '', innerHTML: '', hidden: false, disabled: false,
    dataset: {}, children: [], parentElement: null, nodeType: 1,
    _listeners: {},
    classList: {
      add: function() {
        for (var i = 0; i < arguments.length; i++) {
          var token = String(arguments[i] || '').trim();
          if (!token) continue;
          var parts = el.className ? el.className.split(/\s+/) : [];
          if (parts.indexOf(token) === -1) parts.push(token);
          el.className = parts.join(' ').trim();
        }
      },
      remove: function() {
        for (var i = 0; i < arguments.length; i++) {
          var token = String(arguments[i] || '').trim();
          if (!token) continue;
          el.className = (el.className || '')
            .split(/\s+/)
            .filter(function(part) { return part && part !== token; })
            .join(' ');
        }
      },
      contains: function(token) {
        return (' ' + (el.className || '') + ' ').indexOf(' ' + token + ' ') >= 0;
      }
    },
    setAttribute: function(k, v) {
      if (k === 'class') {
        el.className = String(v || '');
        return;
      }
      el.dataset[k] = v;
      // Preserve common aria-* attributes for getAttribute assertions.
      if (String(k).indexOf('aria-') === 0 || k === 'role' || k === 'title') {
        el['__attr_' + k] = String(v);
      }
    },
    getAttribute: function(k) {
      if (k === 'class') return el.className || null;
      if (el['__attr_' + k] !== undefined) return el['__attr_' + k];
      return el.dataset[k] !== undefined ? el.dataset[k] : null;
    },
    removeAttribute: function(k) {
      delete el.dataset[k];
      delete el['__attr_' + k];
    },
    appendChild: function(c) { if (c) c.parentElement = el; el.children.push(c); return c; },
    insertBefore: function(c) { if (c) c.parentElement = el; el.children.push(c); return c; },
    removeChild: function(c) { var i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); },
    querySelector: function(sel) {
      // Support simple attribute selectors: [data-xyz]
      var attrMatch = sel.match(/^\[data-(.+)\]$/);
      if (attrMatch) {
        var attrName = attrMatch[1];
        // Convert kebab-case to camelCase for dataset access
        var camelName = attrName.replace(/-([a-z])/g, function(g) { return g[1].toUpperCase(); });
        for (var i = 0; i < el.children.length; i++) {
          var child = el.children[i];
          if (child.dataset && child.dataset[camelName] !== undefined) return child;
        }
        return null;
      }
      // Support .className selectors
      var classMatch = sel.match(/^\.(.+)$/);
      if (classMatch) {
        for (var i = 0; i < el.children.length; i++) {
          var child = el.children[i];
          if (child.className && child.className.indexOf(classMatch[1]) >= 0) return child;
        }
        return null;
      }
      return null;
    },
    querySelectorAll: function(sel) {
      var attrMatch = sel.match(/^\[data-(.+)\]$/);
      if (attrMatch) {
        var attrName = attrMatch[1];
        var camelName = attrName.replace(/-([a-z])/g, function(g) { return g[1].toUpperCase(); });
        var results = [];
        for (var i = 0; i < el.children.length; i++) {
          var child = el.children[i];
          if (child.dataset && child.dataset[camelName] !== undefined) results.push(child);
        }
        return results;
      }
      return [];
    },
    addEventListener: function(type, cb) {
      if (!el._listeners) el._listeners = {};
      (el._listeners[type] = el._listeners[type] || []).push(cb);
      if (type === 'click') el._clickHandler = cb;
    },
    click: function() {
      if (typeof el._clickHandler === 'function') {
        return el._clickHandler();
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

function setInteractionMode(sb, mode) {
  var edit = mode === 'edit';
  sb.window.LoveBudEditorInteractionMode = {
    MODE_VIEW: 'view',
    MODE_EDIT: 'edit',
    isEditMode: function() { return edit === true; },
    getMode: function() { return edit ? 'edit' : 'view'; }
  };
}

function build(depsOverrides, modeOpts) {
  depsOverrides = depsOverrides || {};
  modeOpts = modeOpts || {};
  var doc = makeDoc();
  var sb = {
    window: { location: { pathname: '/pages/editor.html', origin: 'https://example.com', search: '' } },
    document: doc, console: { log: function() {}, error: function() {}, warn: function() {} },
    globalThis: null, setTimeout: setTimeout, clearTimeout: clearTimeout
  };
  sb.globalThis = sb;
  sb.window = sb;
  // #3586: mutations require explicit edit mode. Default view unless tests opt in.
  setInteractionMode(sb, modeOpts.interactionMode || 'view');

  vm.createContext(sb);
  vm.runInContext(read('js/editor/editor-detail-tree-meta.js'), sb);

  var deps = Object.assign({
    i18n: function(k) { return k; },
    formatI18nText: function(k, fb) { return fb; },
    resolveTreeTitleText: function(t) { return t || ''; },
    createInlineIcon: function(name) { return { textContent: name || '', style: {}, className: '' }; },
    showToast: function() {},
    openCurrentMomentDetail: function() {},
    canEdit: true,
    openRenameTree: function() {},
    updateTreeVisibility: function() { return Promise.resolve(); },
    updateDetailPanel: function() { return function() {}; }
  }, depsOverrides);

  var boundary = sb.window.createEditorDetailTreeMetaBoundary(deps);
  var mount = doc.createElement('div');
  return { boundary: boundary, mount: mount, sb: sb, deps: deps };
}

function render(depsOverrides, opts) {
  opts = opts || {};
  var r = build(depsOverrides || {}, {
    interactionMode: opts.interactionMode || 'view'
  });
  var isPub = opts.isPublic !== undefined ? opts.isPublic : true;
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

var DATA = { id: 'm1', title: 'Test Moment' };

test('1. canEdit:false - owner buttons not rendered', () => {
  var r = render({ canEdit: false }, { data: DATA, interactionMode: 'edit' });
  assert.ok(collectText(r.mount).indexOf('이름 바꾸기') === -1);
  assert.ok(collectText(r.mount).indexOf('비공개로 전환') === -1);
});

test('1B. canEdit:true appreciation (view) - owner mutation buttons not rendered', () => {
  // #3586: rename/visibility mutations belong only in explicit edit mode.
  var r = render({ canEdit: true }, { isPublic: true, data: DATA, interactionMode: 'view' });
  assert.ok(collectText(r.mount).indexOf('이름 바꾸기') === -1);
  assert.ok(collectText(r.mount).indexOf('비공개로 전환') === -1);
  assert.ok(collectText(r.mount).indexOf('공개로 전환') === -1);
});

test('2. canEdit:true public edit mode - rename + vis toggle', () => {
  var r = render({ canEdit: true }, { isPublic: true, data: DATA, interactionMode: 'edit' });
  assert.ok(collectText(r.mount).indexOf('이름 바꾸기') >= 0);
  assert.ok(collectText(r.mount).indexOf('비공개로 전환') >= 0);
});

test('3. canEdit:true private edit mode - 공개로 전환', () => {
  var r = render({ canEdit: true }, { isPublic: false, data: DATA, interactionMode: 'edit' });
  assert.ok(collectText(r.mount).indexOf('공개로 전환') >= 0);
});

test('4. rename click calls openRenameTree with canEdit, triggerEl, onSaved', () => {
  var captured = null;
  var r = render({
    canEdit: true,
    openRenameTree: function(o) { captured = o; }
  }, { isPublic: true, data: DATA, interactionMode: 'edit' });

  var btn = findBtnByText(r.mount, '이름 바꾸기');
  assert.ok(btn !== null, 'Rename button must exist in tree');
  btn.click();

  assert.ok(captured !== null, 'openRenameTree must be called on rename click');
  assert.strictEqual(captured.canEdit, true, 'canEdit passed');
  assert.ok(typeof captured.triggerEl === 'object', 'triggerEl passed');
  assert.ok(typeof captured.onSaved === 'function', 'onSaved callback passed');
});

test('5. onSaved passes original data, not {}', () => {
  var renameOpts = null;
  var rerenderArgs = null;
  var testData = { id: 'm1', title: 'Original' };

  var r = render({
    canEdit: true,
    openRenameTree: function(o) { renameOpts = o; },
    updateDetailPanel: function() { return function(d) { rerenderArgs = d; }; }
  }, { isPublic: true, data: testData, interactionMode: 'edit' });

  var btn = findBtnByText(r.mount, '이름 바꾸기');
  assert.ok(btn !== null, 'Rename button must exist');
  btn.click();

  assert.ok(renameOpts !== null);
  renameOpts.onSaved({ id: 'tree-1', title: 'Renamed' });

  assert.ok(rerenderArgs !== null);
  assert.strictEqual(rerenderArgs, testData, 'Original data reference preserved');
  assert.ok(Object.keys(rerenderArgs).length > 0, 'Not empty object {}');
});

test('6A. public tree visibility toggle - pending state then resolve', async () => {
  var resolveVis;
  var visPromise = new Promise(function(r) { resolveVis = r; });
  var capturedVis = null;

  var r = render({
    canEdit: true,
    updateTreeVisibility: function(vis) {
      capturedVis = vis;
      return visPromise;
    }
  }, { isPublic: true, data: DATA, interactionMode: 'edit' });

  var visBtn = findBtnByText(r.mount, '비공개로 전환');
  assert.ok(visBtn !== null, 'Visibility toggle must exist');

  // Click triggers async handler
  visBtn.click();

  // Tick to let pending state apply
  await new Promise(function(r) { setTimeout(r, 10); });

  // Verify pending state
  assert.strictEqual(visBtn.disabled, true, 'Button must be disabled during pending');
  var busyAttr = visBtn.getAttribute('aria-busy');
  assert.strictEqual(busyAttr, 'true', 'aria-busy must be true during pending');

  // Verify icon and label via structured data attributes
  var iconEl = visBtn.querySelector('[data-owner-action-icon]');
  assert.ok(iconEl !== null, 'Icon element must exist');
  assert.strictEqual(iconEl.textContent, 'hourglass_empty', 'Icon must be hourglass during pending');

  var labelEl = visBtn.querySelector('[data-owner-action-label]');
  assert.ok(labelEl !== null, 'Label element must exist');
  assert.strictEqual(labelEl.textContent, '상태 변경 중...', 'Label must show pending text');

  // Resolve the visibility change
  resolveVis();
  await new Promise(function(r) { setTimeout(r, 10); });

  // Verify restored state
  assert.strictEqual(visBtn.disabled, false, 'Button must be re-enabled after resolve');
  busyAttr = visBtn.getAttribute('aria-busy');
  assert.strictEqual(busyAttr, 'false', 'aria-busy must be false after resolve');

  assert.strictEqual(iconEl.textContent, 'lock', 'Icon must be restored to lock');
  assert.ok(labelEl.textContent.indexOf('비공개로 전환') >= 0, 'Label must be restored');

  // Verify updateTreeVisibility was called with 'private'
  assert.strictEqual(capturedVis, 'private', 'updateTreeVisibility must be called with private');
});

test('6B. private tree visibility toggle - reject restores original, shows error toast', async () => {
  var rejectVis;
  var visPromise = new Promise(function(resolve, reject) { rejectVis = reject; });
  var capturedVis = null;
  var toastMessage = null;

  var r = render({
    canEdit: true,
    updateTreeVisibility: function(vis) {
      capturedVis = vis;
      return visPromise;
    },
    showToast: function(msg) { toastMessage = msg; }
  }, { isPublic: false, data: DATA, interactionMode: 'edit' });

  var visBtn = findBtnByText(r.mount, '공개로 전환');
  assert.ok(visBtn !== null, 'Visibility toggle must exist for private tree');

  // Click triggers async handler
  visBtn.click();
  await new Promise(function(r) { setTimeout(r, 10); });

  // Verify pending
  assert.strictEqual(visBtn.disabled, true, 'Button must be disabled during pending');

  var iconEl = visBtn.querySelector('[data-owner-action-icon]');
  assert.strictEqual(iconEl.textContent, 'hourglass_empty', 'Icon must be hourglass during pending');

  var labelEl = visBtn.querySelector('[data-owner-action-label]');
  assert.strictEqual(labelEl.textContent, '상태 변경 중...', 'Label must show pending text');

  // Reject the visibility change
  rejectVis(new Error('network error'));
  await new Promise(function(r) { setTimeout(r, 10); });

  // Verify restored state after rejection
  assert.strictEqual(visBtn.disabled, false, 'Button must be re-enabled after reject');
  var busyAttr = visBtn.getAttribute('aria-busy');
  assert.strictEqual(busyAttr, 'false', 'aria-busy must be false after reject');

  assert.strictEqual(iconEl.textContent, 'public', 'Icon restored to public');
  assert.ok(labelEl.textContent.indexOf('공개로 전환') >= 0, 'Label restored to 공개로 전환');

  // Verify error toast — formatI18nText mock returns fallback string
  assert.strictEqual(toastMessage, '공개 상태를 바꾸지 못했어요.',
    'Error toast must use exact fallback text');

  // Verify updateTreeVisibility was called with 'public'
  assert.strictEqual(capturedVis, 'public', 'updateTreeVisibility must be called with public');
});

test('6C. createOwnerActionButtons has no rerender logic', () => {
  var js = read('js/editor/editor-detail-tree-meta.js');
  // Extract the createOwnerActionButtons function body
  var fnStart = js.indexOf('createOwnerActionButtons =');
  assert.ok(fnStart >= 0, 'createOwnerActionButtons must exist');
  // The body after the function signature should not contain updateDetailPanel
  var fnBody = js.slice(fnStart);
  // updateDetailPanel should only appear in renderTreeMetaBoundary, not in createOwnerActionButtons
  var actionFnEnd = fnBody.indexOf('return [renameBtn, visBtn];');
  assert.ok(actionFnEnd >= 0, 'createOwnerActionButtons must return');
  var actionFnBody = fnBody.slice(0, actionFnEnd);
  assert.ok(actionFnBody.indexOf('updateDetailPanel') === -1,
    'createOwnerActionButtons must not reference updateDetailPanel');
  // renderTreeMetaBoundary should contain the rerender call
  var renderFnStart = js.indexOf('renderTreeMetaBoundary =');
  assert.ok(renderFnStart >= 0, 'renderTreeMetaBoundary must exist');
  var renderBody = js.slice(renderFnStart);
  assert.ok(renderBody.indexOf('updateDetailPanel') >= 0,
    'renderTreeMetaBoundary owns the rerender');
});

test('7. cache-bust: all 4 use non-empty version tokens (release-managed)', () => {
  var html = read('pages/editor.html');
  assertVersionedAsset(html, 'editor-rename-ui\\.js', 'editor-rename-ui.js must have non-empty version token');
  assertVersionedAsset(html, 'editor-detail-tree-meta\\.js', 'editor-detail-tree-meta.js must have non-empty version token');
  assertVersionedAsset(html, 'editor-detail-ui\\.js', 'editor-detail-ui.js must have non-empty version token');
  assertVersionedAsset(html, 'editor\\.js', 'editor.js must have non-empty version token');
});

test('8. no direct API calls', () => {
  var js = read('js/editor/editor-detail-tree-meta.js');
  assert.doesNotMatch(js, /apiClient/);
  assert.doesNotMatch(js, /fetch\(/);
  assert.doesNotMatch(js, /SQL/);
});

test('9. No Closes/Fixes/Resolves #2882 or #1882', () => {
  var files = ['js/editor/editor-rename-ui.js', 'js/editor/editor-detail-tree-meta.js',
    'js/editor/editor-detail-ui.js', 'js/editor.js', 'pages/editor.html'];
  for (var i = 0; i < files.length; i++) {
    var c = read(files[i]);
    assert.ok(c.indexOf('Closes #2882') === -1);
    assert.ok(c.indexOf('Fixes #2882') === -1);
    assert.ok(c.indexOf('Resolves #2882') === -1);
    assert.ok(c.indexOf('Closes #1882') === -1);
  }
});
