const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockElement(id) {
  var listeners = {};
  return {
    id: id,
    style: {},
    dataset: {},
    classList: { _classes: [], add: function(n) { if (!this._classes.includes(n)) this._classes.push(n); }, remove: function(n) { this._classes = this._classes.filter(function(c) { return c !== n; }); }, contains: function(n) { return this._classes.includes(n); }, toggle: function(n, f) { if (f === undefined) f = !this.contains(n); if (f) this.add(n); else this.remove(n); } },
    disabled: false,
    textContent: '',
    innerHTML: '',
    tabIndex: 0,
    addEventListener: function() {},
    removeEventListener: function() {},
    setAttribute: function(n, v) { this.dataset[n] = v; },
    getAttribute: function(n) { return this.dataset[n]; },
    appendChild: function(c) { return c; },
    insertBefore: function(c, r) { return c; },
    querySelector: function() { return null; },
    closest: function() { return null; }
  };
}

function loadI18nRefresh() {
  var doc = {
    getElementById: function() { return null; },
    createElement: function() { return createMockElement('dummy'); },
    createTextNode: function() { return {}; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    body: { classList: { add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() {} }, setAttribute: function() {}, getAttribute: function() { return null; }, dataset: {} },
    documentElement: { dataset: {} },
    head: { appendChild: function() {} },
    addEventListener: function() {},
    readyState: 'complete',
    title: ''
  };

  var ctx = vm.createContext({
    window: { t: function() { return ''; }, applyI18n: function() {}, addEventListener: function() {}, LoveBudNormalize: { normalizeMemory: function(m) { return m; } }, LoveBudSecurity: { escapeHtml: function(v) { return String(v); } }, currentTreeMemories: [], currentTreeData: {} },
    document: doc,
    localStorage: { getItem: function() { return null; }, setItem: function() {} },
    console: { error: function() {}, log: function() {}, warn: function() {} },
    setTimeout: function() {},
    clearTimeout: function() {}
  });

  vm.runInContext(fs.readFileSync('js/editor/editor-i18n-refresh.js', 'utf8'), ctx);
  return ctx;
}

function loadSidebarBoundary() {
  var ctx = vm.createContext({
    window: {},
    document: { getElementById: function() { return null; }, createElement: function() { return createMockElement('dummy'); }, createTextNode: function() { return {}; }, querySelector: function() { return null; }, querySelectorAll: function() { return []; }, body: { setAttribute: function() {}, getAttribute: function() { return null; }, dataset: {} }, documentElement: { dataset: {} }, addEventListener: function() {} },
    console: { error: function() {}, log: function() {}, warn: function() {} }
  });

  vm.runInContext(fs.readFileSync('js/editor/editor-detail-sidebar-status-boundary.js', 'utf8'), ctx);
  return ctx;
}

function loadEditorJS() {
  // Read raw editor.js to check lovebud-lang-change binding position
  return fs.readFileSync('js/editor.js', 'utf8');
}

// ── Test 1: editor-i18n-refresh.js has no sidebarFlowSummary reference ──

test('editor-i18n-refresh.js has no sidebarFlowSummary or dynamic summary renderer', function() {
  var source = fs.readFileSync('js/editor/editor-i18n-refresh.js', 'utf8');

  assert.doesNotMatch(source, /sidebarFlowSummary/);
  assert.doesNotMatch(source, /updateEditorDynamicSummary/);
  assert.doesNotMatch(source, /getCanonicalRootId/);
});

// ── Test 2: editor-i18n-refresh.js retains lang-change listener (static copy only) ──

test('editor-i18n-refresh.js retains lovebud-lang-change listener for static copy', function() {
  var source = fs.readFileSync('js/editor/editor-i18n-refresh.js', 'utf8');

  assert.match(source, /lovebud-lang-change/,
    'must retain lovebud-lang-change for static copy refresh');
  assert.match(source, /__lovebudEditorLangRefreshBound/,
    'must retain dedup guard');
  assert.match(source, /refreshEditorLanguage/,
    'listener must delegate to refreshEditorLanguage');
});

test('editor-i18n-refresh.js lovebud-lang-change listener calls refreshEditorLanguage not updateSidebarStatus', function() {
  var source = fs.readFileSync('js/editor/editor-i18n-refresh.js', 'utf8');

  var guardPos = source.indexOf('__lovebudEditorLangRefreshBound');
  var listenerBody = source.slice(guardPos, guardPos + 300);

  assert.match(listenerBody, /refreshEditorLanguage/,
    'listener must call refreshEditorLanguage');
  assert.doesNotMatch(listenerBody, /sidebarFlowSummary/,
    'i18n refresh listener must not write sidebarFlowSummary');
  assert.doesNotMatch(listenerBody, /updateSidebarStatus/,
    'i18n refresh listener must not call updateSidebarStatus');
});

// ── Test 3: editor-i18n-refresh.js still exports refreshEditorLanguage ──

test('editor-i18n-refresh.js still exports refreshEditorLanguage', function() {
  var source = fs.readFileSync('js/editor/editor-i18n-refresh.js', 'utf8');

  assert.match(source, /function refreshEditorLanguage/);
  assert.match(source, /document\.addEventListener\('DOMContentLoaded'/);
});

// ── Test 4: editor.js has lovebud-lang-change bound after updateSidebarStatus created ──

test('editor.js lovebud-lang-change bound after updateSidebarStatus creation', function() {
  var source = loadEditorJS();

  var createPos = source.indexOf('updateSidebarStatus = createEditorSidebarStatusUpdater');
  var eventPos = source.indexOf('lovebud-lang-change');

  assert.ok(createPos >= 0, 'createEditorSidebarStatusUpdater call must exist');
  assert.ok(eventPos >= 0, 'lovebud-lang-change listener must exist');
  assert.ok(eventPos > createPos, 'lovebud-lang-change must be bound after updateSidebarStatus creation');
});

test('editor.js lovebud-lang-change has dedup guard', function() {
  var source = loadEditorJS();

  var guardPos = source.indexOf('__lovebudSidebarStatusRefreshBound');
  assert.ok(guardPos >= 0, 'dedup guard __lovebudSidebarStatusRefreshBound must exist');
});

test('editor.js lovebud-lang-change calls updateSidebarStatus', function() {
  var source = loadEditorJS();

  var eventPos = source.indexOf('lovebud-lang-change');
  var slice = source.slice(eventPos, eventPos + 120);
  assert.match(slice, /updateSidebarStatus/);
});

// ── Test 5: Canonical boundary produces complete count summary for populated tree ──

test('canonical boundary produces complete count summary for populated tree', function() {
  var ctx = loadSidebarBoundary();

  var flowSummaryEl = createMockElement('sidebarFlowSummary');
  ctx.document.getElementById = function(id) {
    return id === 'sidebarFlowSummary' ? flowSummaryEl : null;
  };

  var formatCallArgs = null;
  var createFn = ctx.window.createEditorDetailSidebarStatusBoundary;

  var boundary = createFn({
    i18n: function(key) { return ''; },
    formatI18nText: function(key, fallback, replacements) {
      formatCallArgs = { key: key, fallback: fallback, replacements: replacements };
      if (replacements) {
        var result = fallback;
        Object.keys(replacements).forEach(function(k) {
          result = result.replace('{' + k + '}', replacements[k]);
        });
        return result;
      }
      return fallback;
    },
    resolveTreeTitleText: function(i18n, title) { return title || '러브트리'; },
    getCurrentTreeData: function() { return { title: '내 트리', timeRange: '2025-01 ~ 2025-06' }; },
    getTreeState: function() { return { totalMomentCount: 12, hasVisibleMoments: true }; }
  });

  boundary.updateSidebarStatus();

  assert.ok(formatCallArgs !== null, 'formatI18nText should be called');
  assert.equal(formatCallArgs.key, 'sidebar_flow_summary_connected_with_range');
  assert.equal(formatCallArgs.replacements.count, '12');
  assert.equal(flowSummaryEl.innerHTML.includes('12'), true, 'summary should include count 12');
});

// ── Test 6: Empty tree produces complete empty fallback ──

test('canonical boundary produces empty fallback for empty tree', function() {
  var ctx = loadSidebarBoundary();

  var flowSummaryEl = createMockElement('sidebarFlowSummary');
  ctx.document.getElementById = function(id) {
    return id === 'sidebarFlowSummary' ? flowSummaryEl : null;
  };

  var createFn = ctx.window.createEditorDetailSidebarStatusBoundary;

  boundary = createFn({
    i18n: function(key) { return ''; },
    formatI18nText: function(key, fallback, replacements) {
      if (key === 'editor_tree_status_empty') return '아직 첫 순간을 기다리고 있어요.';
      return fallback;
    },
    resolveTreeTitleText: function(i18n, title) { return title || '러브트리'; },
    getCurrentTreeData: function() { return {}; },
    getTreeState: function() { return { totalMomentCount: 0, hasVisibleMoments: false }; }
  });

  boundary.updateSidebarStatus();

  assert.equal(flowSummaryEl.textContent, '아직 첫 순간을 기다리고 있어요.');
});

// ── Test 7: Count/root semantics remain unchanged (boundary uses totalMomentCount) ──

test('canonical boundary uses totalMomentCount from treeState', function() {
  var ctx = loadSidebarBoundary();

  var flowSummaryEl = createMockElement('sidebarFlowSummary');
  ctx.document.getElementById = function(id) {
    return id === 'sidebarFlowSummary' ? flowSummaryEl : null;
  };

  var capturedCount = null;
  var createFn = ctx.window.createEditorDetailSidebarStatusBoundary;

  var boundary = createFn({
    i18n: function(key) { return ''; },
    formatI18nText: function(key, fallback, replacements) {
      capturedCount = replacements ? replacements.count : null;
      return fallback;
    },
    resolveTreeTitleText: function(i18n, title) { return title || '러브트리'; },
    getCurrentTreeData: function() { return {}; },
    getTreeState: function() { return { totalMomentCount: 7, hasVisibleMoments: true }; }
  });

  boundary.updateSidebarStatus();

  assert.equal(capturedCount, '7', 'totalMomentCount=7 should produce count=7');
});

// ── Test 8: editor.js lovebud-lang-change handler delegates to updateSidebarStatus ──

test('editor.js language-change refresh invokes updateSidebarStatus only', function() {
  var source = loadEditorJS();

  var eventHandlerStart = source.indexOf('lovebud-lang-change', source.indexOf('__lovebudSidebarStatusRefreshBound'));
  var handlerBody = source.slice(eventHandlerStart, eventHandlerStart + 200);

  // Must call updateSidebarStatus
  assert.match(handlerBody, /updateSidebarStatus/);

  // Must not call refreshEditorLanguage (that would be the i18n-refresh duplicate path)
  assert.doesNotMatch(handlerBody, /refreshEditorLanguage/);
});
