/**
 * Entry-actions runtime contract: executes resolver + UI + card-events + hub
 * in node:vm with fake DOM and asserts 26 enumerated requirements.
 * Issue #3511
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/* ── Fake DOM helpers ── */

class FakeElement {
  constructor(tagName) {
    this.tagName = (tagName || 'div').toUpperCase();
    this.attrs = {};
    this._dataset = {};
    this._children = [];
    this.listeners = {};
    this.style = {};
    this._hidden = false;
    this._innerHTML = '';
    this._textContent = '';
    this.parentNode = null;
    this._closestResult = null;
  }
  get hidden() { return this._hidden; }
  set hidden(v) { this._hidden = !!v; }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = v;
    this._children = [];
  }
  get textContent() { return this._textContent; }
  set textContent(v) { this._textContent = String(v); }
  get dataset() { return this._dataset; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] !== undefined ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  // Forward commonly set DOM properties to attrs so getAttribute works
  get href() { return this.attrs['href'] !== undefined ? this.attrs['href'] : null; }
  set href(v) { this.attrs['href'] = String(v); }
  getAttributeNames() { return Object.keys(this.attrs); }
  addEventListener(name, fn) {
    if (!this.listeners[name]) this.listeners[name] = [];
    this.listeners[name].push(fn);
  }
  appendChild(c) { this._children.push(c); if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; }
  removeChild(c) { var idx = this._children.indexOf(c); if (idx !== -1) this._children.splice(idx, 1); c.parentNode = null; }
  replaceChildren() { this._children.length = 0; }
  _matches(sel) {
    function matchClass(el, cls) {
      var c = (el.attrs && el.attrs.class) || (el.className) || '';
      return c.split(/\s+/).indexOf(cls) !== -1;
    }
    function matchTag(el, tag) {
      return el.tagName === tag.toUpperCase();
    }
    if (sel.charAt(0) === '.') {
      return matchClass(this, sel.slice(1));
    } else if (sel.charAt(0) === '#') {
      return this.attrs && this.attrs.id === sel.slice(1);
    } else {
      return matchTag(this, sel);
    }
  }
  _findDescendant(sel) {
    for (var i = 0; i < this._children.length; i++) {
      var child = this._children[i];
      if (child._matches(sel)) return child;
      var deep = child._findDescendant(sel);
      if (deep) return deep;
    }
    return null;
  }
  querySelector(sel) {
    // Support simple descendant selectors: ".parent .child"
    var parts = sel.split(/\s+/).filter(function(p) { return p.length > 0; });
    if (parts.length > 1) {
      var firstMatch = this._findDescendant(parts[0]);
      if (!firstMatch) return null;
      var rest = parts.slice(1).join(' ');
      return firstMatch.querySelector(rest);
    }
    // Simple selector — check self then recurse children
    if (this._matches(parts[0])) return this;
    return this._findDescendant(parts[0]);
  }
  querySelectorAll(sel) { return []; }
  cloneNode(deep) {
    var c = new FakeElement(this.tagName);
    c.attrs = Object.assign({}, this.attrs);
    c._dataset = Object.assign({}, this._dataset);
    c._hidden = this._hidden;
    c._innerHTML = this._innerHTML;
    c._textContent = this._textContent;
    return c;
  }
  get classList() {
    if (!this._classList) {
      var _classes = [];
      this._classList = {
        add: function() {
          for (var i = 0; i < arguments.length; i++) {
            if (_classes.indexOf(arguments[i]) === -1) _classes.push(arguments[i]);
          }
        },
        remove: function() {
          for (var i = 0; i < arguments.length; i++) {
            var idx = _classes.indexOf(arguments[i]);
            if (idx !== -1) _classes.splice(idx, 1);
          }
        },
        contains: function(c) { return _classes.indexOf(c) !== -1; },
        toggle: function(c) {
          var idx = _classes.indexOf(c);
          if (idx !== -1) { _classes.splice(idx, 1); return false; }
          _classes.push(c); return true;
        },
        toString: function() { return _classes.join(' '); }
      };
    }
    return this._classList;
  }
  get className() {
    return this._classList ? this._classList.toString() : '';
  }
  set className(v) {
    // Reset classList then add each class
    const oldClasses = this._classList ? this._classList.toString().split(/\s+/) : [];
    if (this._classList) {
      oldClasses.forEach(function(c) { if (c) this.classList.remove(c); }.bind(this));
    }
    if (v) v.split(/\s+/).forEach(function(c) { if (c) this.classList.add(c); }.bind(this));
    // Sync to attrs.class so getAttribute('class') and querySelector see it
    this.attrs['class'] = this._classList ? this._classList.toString() : '';
  }
  after() {}
  closest(sel) { return this._closestResult || null; }
  get firstChild() { return this._children[0] || null; }
}

function createDocument() {
  var doc = {
    _elements: {},
    createElement(tag) { return new FakeElement(tag); },
    createTextNode(txt) { return { textContent: String(txt) }; },
    createDocumentFragment() {
      var frag = new FakeElement('fragment');
      frag.nodeType = 11;
      return frag;
    },
    getElementById(id) { return doc._elements[id] || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    documentElement: { lang: 'ko' },
    body: new FakeElement('body')
  };
  return doc;
}

function createFakeWindow() {
  var win = {};
  win.innerWidth = 1024;
  win.location = { href: 'http://localhost/pages/my-trees.html', origin: 'http://localhost', pathname: '/pages/my-trees.html', assign: function() {}, replace: function() {} };
  win.addEventListener = function() {};
  win.setTimeout = function(fn) { if (typeof fn === 'function') fn(); return 0; };
  win.clearTimeout = function() {};
  win.navigator = { clipboard: null, userAgent: 'test' };
  win.IntersectionObserver = function() { return { observe: function() {}, disconnect: function() {} }; };
  win.console = { warn: function() {}, log: function() {}, error: function() {} };
  win.document = createDocument();
  win.window = win;
  win.self = win;
  win.top = win;
  win.t = function(k) { return ''; };
  win.i18n = { currentLang: 'ko' };
  win.LoveBudPath = { getBasePath: function() { return ''; } };
  win.LoveBudSecurity = {
    escapeHtml: function(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); },
    sanitizeUrl: function(v) { var s = String(v || '').trim(); if (!s) return ''; try { var u = new URL(s, 'http://localhost'); if (u.protocol === 'http:' || u.protocol === 'https:') return u.href; return ''; } catch(e) { return ''; } }
  };
  win.Math = Math;
  win.JSON = JSON;
  win.URL = URL;
  win.encodeURIComponent = function(s) { return global.encodeURIComponent(s); };
  return win;
}

// Context factory: returns a vm-ready context whose window (the context itself)
// has all the FakeWindow properties.
function createVMContext() {
  var win = createFakeWindow();
  // All of win's properties are copied onto the context so window.X resolves.
  var ctx = Object.assign({}, win);
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.top = ctx;
  return ctx;
}

function buildFakePreloadedWindow() {
  var ctx = createVMContext();
  var doc = ctx.document;

  var hubPanel = new FakeElement('div');
  hubPanel.id = 'myTreesHubPanel';
  var hubContent = new FakeElement('div');
  hubContent.id = 'myTreesHubContent';
  hubContent.hidden = true;
  var hubActions = new FakeElement('div');
  hubActions.id = 'myTreesHubActions';
  hubActions.hidden = true;
  var openBtn = new FakeElement('a');
  openBtn.id = 'myTreesHubOpenBtn';
  openBtn.hidden = true;
  var publicViewBtn = new FakeElement('a');
  publicViewBtn.id = 'myTreesHubPublicViewBtn';
  publicViewBtn.hidden = true;
  var shareBtn = new FakeElement('button');
  shareBtn.id = 'myTreesHubShareBtn';
  shareBtn.hidden = true;

  hubActions._children = [openBtn, publicViewBtn, shareBtn];
  hubContent._children = [hubActions];
  hubPanel._children = [hubContent];

  doc._elements['myTreesHubPanel'] = hubPanel;
  doc._elements['myTreesHubContent'] = hubContent;
  doc._elements['myTreesHubActions'] = hubActions;
  doc._elements['myTreesHubOpenBtn'] = openBtn;
  doc._elements['myTreesHubPublicViewBtn'] = publicViewBtn;
  doc._elements['myTreesHubShareBtn'] = shareBtn;

  return ctx;
}

function triggerClick(el) {
  var fns = el.listeners && el.listeners['click'];
  if (fns) fns.forEach(function(fn) { fn({ type: 'click', target: el, preventDefault: function() {}, stopPropagation: function() {} }); });
  // Also invoke a direct onclick property (used by hub action buttons).
  if (typeof el.onclick === 'function') {
    el.onclick({ type: 'click', target: el, preventDefault: function() {}, stopPropagation: function() {} });
  }
}

function triggerKeydown(el, key) {
  var fns = el.listeners && el.listeners['keydown'];
  if (fns) fns.forEach(function(fn) { fn({ type: 'keydown', key: key, preventDefault: function() {}, stopPropagation: function() {} }); });
}

/* ── Helper to build minmal hub els hash for applyHubActions ── */
function buildMinimalEls() {
  return {
    actions: new FakeElement('div'),
    openBtn: new FakeElement('a'),
    publicViewBtn: new FakeElement('a'),
    shareBtn: new FakeElement('button')
  };
}

/* ── Tests ── */

test('1. resolver loaded before consumers (script order)', function() {
  var ctx = createVMContext();
  var api = require('node:vm');
  api.createContext(ctx);

  // Simulate loading order: resolver first, then UI
  var resolverCode = read('js/my-trees/my-trees-entry-target-resolver.js');
  api.runInContext(resolverCode, ctx);

  assert.ok(ctx.window.LoveBudMyTreesEntryTargetResolver);
  assert.equal(typeof ctx.window.LoveBudMyTreesEntryTargetResolver.resolveMyTreesEntryTargets, 'function');
});

test('2. public primary card href → editor (appreciation)', function() {
  var ctx = createVMContext();
  var api = require('node:vm');
  api.createContext(ctx);

  var resolverCode = read('js/my-trees/my-trees-entry-target-resolver.js');
  var uiCode = read('js/my-trees/my-trees-ui.js');
  api.runInContext(resolverCode, ctx);
  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(uiCode, ctx);

  var UI = ctx.window.LoveBudMyTreesUI;
  var card = UI.buildTreeCard({ id: 't1', visibility: 'public', title: 'T' }, { i18n: function(k) { return k; } });

  var link = card.querySelector('.love-tree-card-open-link');
  assert.ok(link);
  var href = link.getAttribute('href');
  assert.ok(href.includes('editor?treeId=t1'), 'public primary href should target editor');
  assert.equal(href.includes('mode='), false, 'primary should not have mode parameter');
  assert.equal(href.includes('view.html'), false, 'primary should not target view.html');
});

test('3. private primary card href → editor (appreciation)', function() {
  var ctx = createVMContext();
  var api = require('node:vm');
  api.createContext(ctx);

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);

  var UI = ctx.window.LoveBudMyTreesUI;
  var card = UI.buildTreeCard({ id: 't2', visibility: 'private', title: 'T' }, { i18n: function(k) { return k; } });

  var link = card.querySelector('.love-tree-card-open-link');
  assert.ok(link);
  var href = link.getAttribute('href');
  assert.ok(href.includes('editor?treeId=t2'), 'private primary href should target editor');
  assert.equal(href.includes('mode='), false);
});

test('4. valid unknown visibility primary → editor (appreciation)', function() {
  var ctx = createVMContext();
  var api = require('node:vm');
  api.createContext(ctx);

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);

  var UI = ctx.window.LoveBudMyTreesUI;
  var card = UI.buildTreeCard({ id: 't3', visibility: null, title: 'T' }, { i18n: function(k) { return k; } });

  var link = card.querySelector('.love-tree-card-open-link');
  assert.ok(link);
  var href = link.getAttribute('href');
  assert.ok(href.includes('editor?treeId=t3'), 'unknown visibility primary should target editor');
  assert.equal(href.includes('mode='), false);
});

test('5. #3578 Phase 1 cards expose only appreciation; public shareTarget stays internal', function() {
  var ctx = createVMContext();
  var api = require('node:vm');
  api.createContext(ctx);

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);

  var UI = ctx.window.LoveBudMyTreesUI;

  var publicCard = UI.buildTreeCard({ id: 't-pub', visibility: 'public', title: 'T' }, { i18n: function(k) { return k; } });
  assert.equal(publicCard.querySelector('.tree-card-public-view-link'), null, 'public tree must not render public-view action');
  assert.equal(publicCard.querySelector('.tree-card-edit-link'), null, 'Phase 1: public tree must not render edit link');
  assert.ok(publicCard.querySelector('.love-tree-card-open-link'), 'public tree should have appreciation link');
  var resolvedPublic = UI.validateAndResolveEntryTargets({ id: 't-pub', visibility: 'public' });
  assert.ok(resolvedPublic.shareTarget || resolvedPublic.publicView, 'public tree keeps internal shareTarget');
  assert.ok((resolvedPublic.shareTarget || resolvedPublic.publicView).includes('view.html?treeId=t-pub'));
  assert.equal(resolvedPublic.edit, undefined, 'Phase 1: no edit target in resolved bundle');

  var privateCard = UI.buildTreeCard({ id: 't-priv', visibility: 'private', title: 'T' }, { i18n: function(k) { return k; } });
  assert.equal(privateCard.querySelector('.tree-card-public-view-link'), null, 'private tree should NOT have public-view link');
  assert.equal(privateCard.querySelector('.tree-card-edit-link'), null, 'Phase 1: private tree must not render edit link');
  var resolvedPrivate = UI.validateAndResolveEntryTargets({ id: 't-priv', visibility: 'private' });
  assert.equal(resolvedPrivate.shareTarget, null, 'private tree has no shareTarget');
  assert.equal(resolvedPrivate.publicView, null, 'private tree has no publicView');
  assert.equal(resolvedPrivate.edit, undefined, 'Phase 1: no edit target in resolved bundle');
});

test('6. #3578 Phase 1: no edit link; primary href has no mode param', function() {
  var ctx = createVMContext();
  var api = require('node:vm');
  api.createContext(ctx);

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);

  var UI = ctx.window.LoveBudMyTreesUI;
  var card = UI.buildTreeCard({ id: 't1', visibility: 'public', title: 'T' }, { i18n: function(k) { return k; } });

  var editLink = card.querySelector('.tree-card-edit-link');
  assert.equal(editLink, null, 'Phase 1: no edit link should exist');
  var openLink = card.querySelector('.love-tree-card-open-link');
  assert.ok(openLink, 'appreciation link should exist');
  var href = openLink.getAttribute('href');
  assert.ok(href.includes('editor?treeId=t1'), 'appreciation href must target editor');
  assert.ok(!href.includes('mode='), 'appreciation href must not have mode parameter');
});

test('7. mobile public click → appreciation navigation', function() {
  var win = buildFakePreloadedWindow();
  win.innerWidth = 375;
  var ctx = win;
  ctx.window = ctx;
  var api = require('node:vm');
  api.createContext(ctx);

  var navLog = [];
  ctx.window.location.href = '';
  Object.defineProperty(ctx.window.location, 'href', {
    set: function(v) { navLog.push(v); },
    get: function() { return navLog[navLog.length - 1] || ''; }
  });

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-card-events.js'), ctx);

  var CardEvents = ctx.window.LoveBudMyTreesCardEvents;
  var card = ctx.window.LoveBudMyTreesUI.buildTreeCard(
    { id: 'mobile-pub', visibility: 'public', title: 'T' },
    { i18n: function(k) { return k; } }
  );

  triggerClick(card);
  assert.ok(navLog.length > 0, 'mobile public click should navigate');
  var href = navLog[navLog.length - 1];
  assert.ok(href.includes('editor?treeId=mobile-pub'), 'mobile public nav should target editor');
  assert.equal(href.includes('view.html'), false);
});

test('8. mobile private click → appreciation navigation', function() {
  var win = buildFakePreloadedWindow();
  win.innerWidth = 375;
  var ctx = win;
  ctx.window = ctx;
  var api = require('node:vm');
  api.createContext(ctx);

  var navLog = [];
  Object.defineProperty(ctx.window.location, 'href', {
    set: function(v) { navLog.push(v); },
    get: function() { return navLog[navLog.length - 1] || ''; }
  });

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-card-events.js'), ctx);

  var card = ctx.window.LoveBudMyTreesUI.buildTreeCard(
    { id: 'mobile-priv', visibility: 'private', title: 'T' },
    { i18n: function(k) { return k; } }
  );

  triggerClick(card);
  assert.ok(navLog.length > 0, 'mobile private click should navigate');
  var href = navLog[navLog.length - 1];
  assert.ok(href.includes('editor?treeId=mobile-priv'));
  assert.equal(href.includes('view.html'), false);
});

test('9. mobile Enter/Space → appreciation navigation', function() {
  var win = buildFakePreloadedWindow();
  win.innerWidth = 375;
  var ctx = win;
  ctx.window = ctx;
  var api = require('node:vm');
  api.createContext(ctx);

  var navLog = [];
  Object.defineProperty(ctx.window.location, 'href', {
    set: function(v) { navLog.push(v); },
    get: function() { return navLog[navLog.length - 1] || ''; }
  });

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-card-events.js'), ctx);

  var card = ctx.window.LoveBudMyTreesUI.buildTreeCard(
    { id: 'mobile-enter', visibility: 'public', title: 'T' },
    { i18n: function(k) { return k; } }
  );

  triggerKeydown(card, 'Enter');
  assert.ok(navLog.length > 0, 'mobile Enter should navigate');

  navLog.length = 0;
  triggerKeydown(card, ' ');
  assert.ok(navLog.length > 0, 'mobile Space should navigate');
});

test('10. desktop click does not navigate (selection-only)', function() {
  var win = buildFakePreloadedWindow();
  win.innerWidth = 1024;
  var ctx = win;
  ctx.window = ctx;
  var api = require('node:vm');
  api.createContext(ctx);

  var navLog = [];
  Object.defineProperty(ctx.window.location, 'href', {
    set: function(v) { navLog.push(v); },
    get: function() { return navLog[navLog.length - 1] || ''; }
  });

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-card-events.js'), ctx);

  var card = ctx.window.LoveBudMyTreesUI.buildTreeCard(
    { id: 'desktop', visibility: 'public', title: 'T' },
    { i18n: function(k) { return k; } }
  );

  triggerClick(card);
  assert.equal(navLog.length, 0, 'desktop click should NOT navigate');
});

test('11. interactive child click does not activate card', function() {
  var win = buildFakePreloadedWindow();
  win.innerWidth = 375;
  var ctx = win;
  ctx.window = ctx;
  var api = require('node:vm');
  api.createContext(ctx);

  var navLog = [];
  Object.defineProperty(ctx.window.location, 'href', {
    set: function(v) { navLog.push(v); },
    get: function() { return navLog[navLog.length - 1] || ''; }
  });

  var selectedTree = null;
  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-card-events.js'), ctx);

  var CardEvents = ctx.window.LoveBudMyTreesCardEvents;
  var card = ctx.window.LoveBudMyTreesUI.buildTreeCard(
    { id: 'interactive', visibility: 'public', title: 'T' },
    { i18n: function(k) { return k; }, onSelect: function(t) { selectedTree = t; } }
  );

  // Simulate click on interactive child
  var fakeTarget = { closest: function() { return { tagName: 'A' }; } };
  var fns = card.listeners['click'] || [];
  fns.forEach(function(fn) {
    fn({ type: 'click', target: fakeTarget, preventDefault: function() {}, stopPropagation: function() {} });
  });

  assert.equal(navLog.length, 0, 'interactive child click should not navigate');
  assert.equal(selectedTree, null, 'interactive child click should not select');
});

test('12. invalid ID → zero navigation assignments', function() {
  var win = buildFakePreloadedWindow();
  win.innerWidth = 375;
  var ctx = win;
  ctx.window = ctx;
  var api = require('node:vm');
  api.createContext(ctx);

  var navLog = [];
  Object.defineProperty(ctx.window.location, 'href', {
    set: function(v) { navLog.push(v); },
    get: function() { return navLog[navLog.length - 1] || ''; }
  });

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-card-events.js'), ctx);

  var card = ctx.window.LoveBudMyTreesUI.buildTreeCard(
    { id: '', visibility: 'public', title: 'T' },
    { i18n: function(k) { return k; } }
  );

  triggerClick(card);
  triggerKeydown(card, 'Enter');
  assert.equal(navLog.length, 0, 'invalid ID should produce zero navigation assignments');
});

test('13. malformed target → zero navigation assignments', function() {
  var win = buildFakePreloadedWindow();
  win.innerWidth = 375;
  var ctx = win;
  ctx.window = ctx;
  var api = require('node:vm');
  api.createContext(ctx);

  var navLog = [];
  Object.defineProperty(ctx.window.location, 'href', {
    set: function(v) { navLog.push(v); },
    get: function() { return navLog[navLog.length - 1] || ''; }
  });

  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);

  var card = ctx.window.LoveBudMyTreesUI.buildTreeCard(
    { id: 't1', visibility: 'public', title: 'T' },
    { i18n: function(k) { return k; } }
  );

  triggerClick(card);
  triggerKeydown(card, 'Enter');
  assert.equal(navLog.length, 0, 'malformed target (no resolver) should produce zero navigation');
});

test('14. hub applyHubActions resets and sets properly', function() {
  var ctx = buildFakePreloadedWindow();
  var api = require('node:vm');
  api.createContext(ctx);

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-preview-hub.js'), ctx);

  var hub = ctx.window.LoveBudMyTreesPreviewHub;
  var els = buildMinimalEls();
  hub.showPlaceholder();

  var openBtn = ctx.document.getElementById('myTreesHubOpenBtn');
  var shareBtn = ctx.document.getElementById('myTreesHubShareBtn');
  assert.ok(openBtn.hidden, 'placeholder should hide open button');
  assert.ok(shareBtn.hidden, 'placeholder should hide share button');
});

test('15. applyHubActions with public tree produces primary, share (no public-view action, no edit)', function() {
  var ctx = buildFakePreloadedWindow();
  var api = require('node:vm');
  api.createContext(ctx);

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-preview-hub.js'), ctx);

  var hub = ctx.window.LoveBudMyTreesPreviewHub;

  // Make applyHubActions a function on the hub's scope by calling showContent with a minimal tree
  var openBtn = ctx.document.getElementById('myTreesHubOpenBtn');
  var publicViewBtn = ctx.document.getElementById('myTreesHubPublicViewBtn');
  var shareBtn = ctx.document.getElementById('myTreesHubShareBtn');

  hub.showContent({
    id: 'pub-tree',
    visibility: 'public',
    title: 'Public Tree'
  });

  assert.equal(openBtn.hidden, false, 'public tree open btn should be visible');
  assert.ok(openBtn.getAttribute('href').includes('editor?treeId=pub-tree'), 'public open should be editor');
  assert.equal(publicViewBtn.hidden, true, '#3563: public-view action must stay hidden');
  assert.equal(shareBtn.hidden, false, 'public tree share btn should be visible');
});

test('16. applyHubActions with private tree hides public-view and share', function() {
  var ctx = buildFakePreloadedWindow();
  var api = require('node:vm');
  api.createContext(ctx);

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-preview-hub.js'), ctx);

  var hub = ctx.window.LoveBudMyTreesPreviewHub;
  var openBtn = ctx.document.getElementById('myTreesHubOpenBtn');
  var publicViewBtn = ctx.document.getElementById('myTreesHubPublicViewBtn');
  var shareBtn = ctx.document.getElementById('myTreesHubShareBtn');

  hub.showContent({
    id: 'priv-tree',
    visibility: 'private',
    title: 'Private Tree'
  });

  assert.equal(openBtn.hidden, false, 'private tree open btn should be visible');
  assert.ok(openBtn.getAttribute('href').includes('editor?treeId=priv-tree'), 'private open should be editor');
  assert.equal(publicViewBtn.hidden, true, 'private tree public-view btn should be hidden');
  assert.equal(shareBtn.hidden, true, 'private tree share btn should be hidden');
});

test('17. applyHubActions with unknown tree hides public-view and share', function() {
  var ctx = buildFakePreloadedWindow();
  var api = require('node:vm');
  api.createContext(ctx);

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-preview-hub.js'), ctx);

  var hub = ctx.window.LoveBudMyTreesPreviewHub;
  var publicViewBtn = ctx.document.getElementById('myTreesHubPublicViewBtn');
  var shareBtn = ctx.document.getElementById('myTreesHubShareBtn');

  hub.showContent({
    id: 'unk-tree',
    visibility: null,
    title: 'Unknown'
  });

  assert.equal(publicViewBtn.hidden, true, 'unknown tree public-view btn should be hidden');
  assert.equal(shareBtn.hidden, true, 'unknown tree share btn should be hidden');
});

test('18. public→private transition clears stale share state', function() {
  var ctx = buildFakePreloadedWindow();
  var api = require('node:vm');
  api.createContext(ctx);

  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-preview-hub.js'), ctx);

  var hub = ctx.window.LoveBudMyTreesPreviewHub;
  var shareBtn = ctx.document.getElementById('myTreesHubShareBtn');

  hub.showContent({ id: 'pub-tree', visibility: 'public', title: 'Pub' });
  assert.equal(shareBtn.hidden, false, 'public tree share should be visible');
  assert.ok(shareBtn.getAttribute('data-tree-id'), 'share data-tree-id should exist');

  hub.showContent({ id: 'priv-tree', visibility: 'private', title: 'Priv' });
  assert.equal(shareBtn.hidden, true, 'after private transition share should be hidden');
  assert.equal(shareBtn.getAttribute('data-tree-id'), null, 'stale data-tree-id should be removed');
  assert.equal(shareBtn.onclick, null, 'stale onclick should be removed');
});

test('19. Korean/English appreciation labels are present in i18n file', function() {
  var i18nSource = read('js/i18n/i18n-my-trees.js');
  assert.match(i18nSource, /'감상하기'/);
  assert.match(i18nSource, /'Open appreciation view'/);
});

test('20. card action links use appreciation text (primaryLabel slot)', function() {
  var uiSource = read('js/my-trees/my-trees-ui.js');
  var compSource = read('js/shared/tree-card-composition.js');
  assert.ok(uiSource.includes("primaryLabel: primaryLabel"), 'primaryLabel slot must be wired');
  assert.ok(compSource.includes('감상하기'), 'shared composition must default to 감상하기');
  assert.doesNotMatch(uiSource, /tree-card-edit-link/, '#3578 Phase 1: edit link removed from card source');
  assert.doesNotMatch(uiSource, /tree-card-public-view-link/, '#3563: public-view card action removed');
});

test('21. source tree object is not mutated', function() {
  var ctx = createVMContext();
  var api = require('node:vm');
  api.createContext(ctx);
  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);

  var resolver = ctx.window.LoveBudMyTreesEntryTargetResolver;
  var tree = { id: 't-mut', visibility: 'public' };
  var before = JSON.parse(JSON.stringify(tree));
  resolver.resolveMyTreesEntryTargets(tree);
  assert.deepEqual(tree, before);
});

test('22. arbitrary URL or route injection is blocked in resolveMyTreesEntryTargets', function() {
  var ctx = createVMContext();
  var api = require('node:vm');
  api.createContext(ctx);
  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);

  var resolver = ctx.window.LoveBudMyTreesEntryTargetResolver;
  var model = resolver.resolveMyTreesEntryTargets({
    id: 'safe',
    visibility: 'public',
    url: 'javascript:alert(1)',
    basePath: 'https://evil.example/'
  });
  assert.equal(model.primary.href.indexOf('javascript:'), -1);
  assert.equal(model.primary.href.indexOf('https://'), -1);
  assert.equal(model.primary.href.indexOf('//'), -1);
  assert.equal(model.primary.href, 'editor?treeId=safe');
});

/* ── Helpers for malformed resolver output tests (Section 4) ── */

// Build a UI context with a fake resolver overriding the real one.
function buildUIContextWithFakeResolver(fakeResolver) {
  var ctx = createVMContext();
  var api = require('node:vm');
  api.createContext(ctx);
  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  // Override with the fake implementation.
  ctx.window.LoveBudMyTreesEntryTargetResolver = fakeResolver;
  return ctx;
}

// A fully canonical resolver bundle factory for a given id/visibility,
// so tests can override only the malformed field.
function canonicalBundle(id, visibility) {
  var encId = encodeURIComponent(id);
  return {
    treeId: id,
    accessState: visibility === 'public' ? 'public' : (visibility === 'private' ? 'private' : 'unknown'),
    primary: { available: true, href: 'editor?treeId=' + encId, action: 'appreciation', interactionMode: 'appreciation', routeSurface: 'editor' },
    publicView: visibility === 'public'
      ? { available: true, href: 'view.html?treeId=' + encId, action: 'public-view', interactionMode: 'none', routeSurface: 'public-viewer' }
      : { available: false, href: null, action: 'public-view', interactionMode: 'none', routeSurface: 'public-viewer' }
  };
}

// Each malformed case: run validateAndResolveEntryTargets and assert the
// expected fail-closed result. Conflicting metadata → whole bundle null.
test('23. malformed: primary href targets view.html but metadata editor/appreciation → bundle null', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'public');
  bundle.primary.href = 'view.html?treeId=' + encodeURIComponent(id);
  var ctx = buildUIContextWithFakeResolver({ resolveMyTreesEntryTargets: function() { return bundle; } });
  var UI = ctx.window.LoveBudMyTreesUI;
  var resolved = UI.validateAndResolveEntryTargets({ id: id, visibility: 'public' });
  assert.equal(resolved.primary, null);
  assert.equal(resolved.publicView, null);
  assert.equal(resolved.edit, undefined);
});

test('24. malformed: primary href is arbitrary-relative-page → bundle null', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'public');
  bundle.primary.href = 'some-other-page?treeId=' + encodeURIComponent(id);
  var ctx = buildUIContextWithFakeResolver({ resolveMyTreesEntryTargets: function() { return bundle; } });
  var UI = ctx.window.LoveBudMyTreesUI;
  var resolved = UI.validateAndResolveEntryTargets({ id: id, visibility: 'public' });
  assert.equal(resolved.primary, null);
  assert.equal(resolved.edit, undefined);
});

test('25. malformed: primary href tree id differs from input id → bundle null', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'public');
  bundle.primary.href = 'editor?treeId=other-id';
  var ctx = buildUIContextWithFakeResolver({ resolveMyTreesEntryTargets: function() { return bundle; } });
  var UI = ctx.window.LoveBudMyTreesUI;
  var resolved = UI.validateAndResolveEntryTargets({ id: id, visibility: 'public' });
  assert.equal(resolved.primary, null);
  assert.equal(resolved.publicView, null);
  assert.equal(resolved.edit, undefined);
});

test('26. malformed: primary href has extra query → bundle null', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'public');
  bundle.primary.href = 'editor?treeId=' + encodeURIComponent(id) + '&extra=1';
  var ctx = buildUIContextWithFakeResolver({ resolveMyTreesEntryTargets: function() { return bundle; } });
  var UI = ctx.window.LoveBudMyTreesUI;
  var resolved = UI.validateAndResolveEntryTargets({ id: id, visibility: 'public' });
  assert.equal(resolved.primary, null);
});

test('27. malformed: primary href has fragment → bundle null', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'public');
  bundle.primary.href = 'editor?treeId=' + encodeURIComponent(id) + '#frag';
  var ctx = buildUIContextWithFakeResolver({ resolveMyTreesEntryTargets: function() { return bundle; } });
  var UI = ctx.window.LoveBudMyTreesUI;
  var resolved = UI.validateAndResolveEntryTargets({ id: id, visibility: 'public' });
  assert.equal(resolved.primary, null);
});

test('28. #3578 Phase 1: validateAndResolveEntryTargets returns no edit target', function() {
  var ctx = createVMContext();
  var api = require('node:vm');
  api.createContext(ctx);
  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);

  var UI = ctx.window.LoveBudMyTreesUI;
  var resolved = UI.validateAndResolveEntryTargets({ id: 't1', visibility: 'public' });
  assert.equal(resolved.edit, undefined, 'Phase 1: resolved bundle should have no edit key');
});

test('30. malformed: publicView href is editor route → publicView null', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'public');
  bundle.publicView.href = 'editor?treeId=' + encodeURIComponent(id);
  var ctx = buildUIContextWithFakeResolver({ resolveMyTreesEntryTargets: function() { return bundle; } });
  var UI = ctx.window.LoveBudMyTreesUI;
  var resolved = UI.validateAndResolveEntryTargets({ id: id, visibility: 'public' });
  assert.equal(resolved.publicView, null);
});

test('31. malformed: publicView href extra query/fragment → publicView null', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'public');
  bundle.publicView.href = 'view.html?treeId=' + encodeURIComponent(id) + '&x=1#f';
  var ctx = buildUIContextWithFakeResolver({ resolveMyTreesEntryTargets: function() { return bundle; } });
  var UI = ctx.window.LoveBudMyTreesUI;
  var resolved = UI.validateAndResolveEntryTargets({ id: id, visibility: 'public' });
  assert.equal(resolved.publicView, null);
});

test('30. malformed: private input but targets.accessState=public → bundle null', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'private');
  bundle.accessState = 'public';
  bundle.publicView = { available: true, href: 'view.html?treeId=' + encodeURIComponent(id), action: 'public-view', interactionMode: 'none', routeSurface: 'public-viewer' };
  var ctx = buildUIContextWithFakeResolver({ resolveMyTreesEntryTargets: function() { return bundle; } });
  var UI = ctx.window.LoveBudMyTreesUI;
  var resolved = UI.validateAndResolveEntryTargets({ id: id, visibility: 'private' });
  assert.equal(resolved.primary, null);
  assert.equal(resolved.publicView, null);
  assert.equal(resolved.edit, undefined);
});

test('31. malformed: private input but publicView.available=true → bundle null', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'private');
  bundle.publicView = { available: true, href: 'view.html?treeId=' + encodeURIComponent(id), action: 'public-view', interactionMode: 'none', routeSurface: 'public-viewer' };
  // accessState stays 'private' (correct), but publicView wrongly available.
  var ctx = buildUIContextWithFakeResolver({ resolveMyTreesEntryTargets: function() { return bundle; } });
  var UI = ctx.window.LoveBudMyTreesUI;
  var resolved = UI.validateAndResolveEntryTargets({ id: id, visibility: 'private' });
  assert.equal(resolved.primary, null);
  assert.equal(resolved.publicView, null);
  assert.equal(resolved.edit, undefined);
});

test('32. malformed: targets.treeId != input tree id → bundle null', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'public');
  bundle.treeId = 'different-id';
  var ctx = buildUIContextWithFakeResolver({ resolveMyTreesEntryTargets: function() { return bundle; } });
  var UI = ctx.window.LoveBudMyTreesUI;
  var resolved = UI.validateAndResolveEntryTargets({ id: id, visibility: 'public' });
  assert.equal(resolved.primary, null);
  assert.equal(resolved.publicView, null);
  assert.equal(resolved.edit, undefined);
});

test('33. malformed: accessState is not a canonical value → bundle null', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'public');
  bundle.accessState = 'PUBLIC';
  var ctx = buildUIContextWithFakeResolver({ resolveMyTreesEntryTargets: function() { return bundle; } });
  var UI = ctx.window.LoveBudMyTreesUI;
  var resolved = UI.validateAndResolveEntryTargets({ id: id, visibility: 'public' });
  assert.equal(resolved.primary, null);
  assert.equal(resolved.publicView, null);
  assert.equal(resolved.edit, undefined);
});

test('36. card with malformed resolver output → zero navigation assignments', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'public');
  bundle.primary.href = 'view.html?treeId=' + encodeURIComponent(id); // malformed
  var win = buildFakePreloadedWindow();
  win.innerWidth = 375;
  var ctx = win;
  ctx.window = ctx;
  var api = require('node:vm');
  api.createContext(ctx);
  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  api.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-card-events.js'), ctx);
  ctx.window.LoveBudMyTreesEntryTargetResolver = { resolveMyTreesEntryTargets: function() { return bundle; } };

  var navLog = [];
  Object.defineProperty(ctx.window.location, 'href', {
    set: function(v) { navLog.push(v); },
    get: function() { return navLog[navLog.length - 1] || ''; }
  });

  var card = ctx.window.LoveBudMyTreesUI.buildTreeCard(
    { id: id, visibility: 'public', title: 'T' },
    { i18n: function(k) { return k; } }
  );
  triggerClick(card);
  triggerKeydown(card, 'Enter');
  assert.equal(navLog.length, 0, 'malformed resolver output should produce zero navigation assignments');
});

test('35. hub with malformed resolver output → actions hidden, share hidden', function() {
  var id = 't1';
  var bundle = canonicalBundle(id, 'public');
  bundle.primary.href = 'view.html?treeId=' + encodeURIComponent(id); // malformed
  var ctx = buildFakePreloadedWindow();
  var api = require('node:vm');
  api.createContext(ctx);
  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-preview-hub.js'), ctx);
  ctx.window.LoveBudMyTreesEntryTargetResolver = { resolveMyTreesEntryTargets: function() { return bundle; } };

  var hub = ctx.window.LoveBudMyTreesPreviewHub;
  var openBtn = ctx.document.getElementById('myTreesHubOpenBtn');
  var publicViewBtn = ctx.document.getElementById('myTreesHubPublicViewBtn');
  var shareBtn = ctx.document.getElementById('myTreesHubShareBtn');

  hub.showContent({ id: id, visibility: 'public', title: 'T' });

  assert.equal(openBtn.hidden, true, 'malformed bundle should hide open button');
  assert.equal(publicViewBtn.hidden, true, 'malformed bundle should hide public-view button');
  assert.equal(shareBtn.hidden, true, 'malformed bundle should hide share button');
});

/* ── Section 5: Share clipboard URL execution ── */

function buildShareContext(currentHref) {
  var ctx = buildFakePreloadedWindow();
  var api = require('node:vm');
  api.createContext(ctx);
  api.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  api.runInContext(read('js/my-trees/my-trees-preview-hub.js'), ctx);

  // Set the current document URL for share URL resolution.
  Object.defineProperty(ctx.window.location, 'href', {
    configurable: true,
    get: function() { return currentHref; },
    set: function() {}
  });
  ctx.window.location.origin = currentHref.split('?')[0].split('/pages/')[0].split('/my-trees')[0];
  ctx.window.location.pathname = currentHref.split('?')[0].replace(ctx.window.location.origin, '');

  // Base path resolver must reflect the actual deploy context:
  // on /pages/* the relative hrefs are already rooted, elsewhere prefix 'pages/'.
  ctx.window.LoveBudPath = {
    getBasePath: function() {
      return ctx.window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
    }
  };

  // Fake clipboard log.
  var clipboardLog = [];
  ctx.window.navigator.clipboard = {
    writeText: function(value) {
      clipboardLog.push(value);
      return Promise.resolve();
    }
  };
  ctx._clipboardLog = clipboardLog;
  return ctx;
}

test('38. public tree share clipboard URL is exact (pages context)', function() {
  var currentHref = 'http://localhost/pages/my-trees.html';
  var ctx = buildShareContext(currentHref);
  var hub = ctx.window.LoveBudMyTreesPreviewHub;
  var shareBtn = ctx.document.getElementById('myTreesHubShareBtn');

  hub.showContent({ id: 'pub-tree', visibility: 'public', title: 'Pub' });
  assert.equal(shareBtn.hidden, false, 'public share should be visible');

  triggerClick(shareBtn);

  assert.equal(ctx._clipboardLog.length, 1, 'clipboard should be called exactly once');
  var written = ctx._clipboardLog[0];
  var url = new URL(written);
  assert.equal(url.origin, 'http://localhost');
  assert.equal(url.pathname, '/pages/view.html');
  assert.equal(url.searchParams.get('treeId'), 'pub-tree');
  assert.equal(url.searchParams.get('from'), 'shared');
});

test('39. public tree share clipboard URL is exact (root context)', function() {
  var currentHref = 'http://localhost/my-trees';
  var ctx = buildShareContext(currentHref);
  var hub = ctx.window.LoveBudMyTreesPreviewHub;
  var shareBtn = ctx.document.getElementById('myTreesHubShareBtn');

  hub.showContent({ id: 'pub-tree', visibility: 'public', title: 'Pub' });
  assert.equal(shareBtn.hidden, false, 'public share should be visible');

  triggerClick(shareBtn);

  assert.equal(ctx._clipboardLog.length, 1, 'clipboard should be called exactly once');
  var written = ctx._clipboardLog[0];
  var url = new URL(written);
  assert.equal(url.origin, 'http://localhost');
  assert.equal(url.pathname, '/pages/view.html');
  assert.equal(url.searchParams.get('treeId'), 'pub-tree');
  assert.equal(url.searchParams.get('from'), 'shared');
});

test('40. private tree share clipboard calls = 0', function() {
  var ctx = buildShareContext('http://localhost/pages/my-trees.html');
  var hub = ctx.window.LoveBudMyTreesPreviewHub;
  var shareBtn = ctx.document.getElementById('myTreesHubShareBtn');

  hub.showContent({ id: 'priv-tree', visibility: 'private', title: 'Priv' });
  assert.equal(shareBtn.hidden, true, 'private share should be hidden');

  if (typeof shareBtn.onclick === 'function') triggerClick(shareBtn);
  assert.equal(ctx._clipboardLog.length, 0, 'private tree should never call clipboard');
});

test('41. unknown tree share clipboard calls = 0', function() {
  var ctx = buildShareContext('http://localhost/pages/my-trees.html');
  var hub = ctx.window.LoveBudMyTreesPreviewHub;
  var shareBtn = ctx.document.getElementById('myTreesHubShareBtn');

  hub.showContent({ id: 'unk-tree', visibility: null, title: 'Unk' });
  assert.equal(shareBtn.hidden, true, 'unknown share should be hidden');

  if (typeof shareBtn.onclick === 'function') triggerClick(shareBtn);
  assert.equal(ctx._clipboardLog.length, 0, 'unknown tree should never call clipboard');
});

test('42. invalid id tree share clipboard calls = 0', function() {
  var ctx = buildShareContext('http://localhost/pages/my-trees.html');
  var hub = ctx.window.LoveBudMyTreesPreviewHub;
  var shareBtn = ctx.document.getElementById('myTreesHubShareBtn');

  hub.showContent({ id: '', visibility: 'public', title: 'Empty' });
  assert.equal(shareBtn.hidden, true, 'invalid id share should be hidden');

  if (typeof shareBtn.onclick === 'function') triggerClick(shareBtn);
  assert.equal(ctx._clipboardLog.length, 0, 'invalid id tree should never call clipboard');
});

test('43. public→private transition removes stale share handler (no clipboard)', function() {
  var ctx = buildShareContext('http://localhost/pages/my-trees.html');
  var hub = ctx.window.LoveBudMyTreesPreviewHub;
  var shareBtn = ctx.document.getElementById('myTreesHubShareBtn');

  hub.showContent({ id: 'pub-tree', visibility: 'public', title: 'Pub' });
  assert.equal(shareBtn.hidden, false, 'public share visible');
  assert.equal(typeof shareBtn.onclick, 'function', 'public share handler attached');

  triggerClick(shareBtn);
  assert.equal(ctx._clipboardLog.length, 1, 'public click should write clipboard once');

  hub.showContent({ id: 'priv-tree', visibility: 'private', title: 'Priv' });
  assert.equal(shareBtn.hidden, true, 'private transition hides share');
  assert.equal(shareBtn.onclick, null, 'stale public onclick removed');

  if (typeof shareBtn.onclick === 'function') triggerClick(shareBtn);
  assert.equal(ctx._clipboardLog.length, 1, 'after private transition clipboard must not be called again');
});
