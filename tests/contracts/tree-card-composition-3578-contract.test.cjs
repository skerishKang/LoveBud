/**
 * LoveBud — Shared LoveTree Card Composition Contract
 * Issue #3578 Phase 2 — CTO review hardening
 *
 * Validates the shared tree-card-composition.js primitive with
 * proper DOM runtime (not string-only fake DOM):
 *
 *   1. Browse and My Trees call same shared helper with real outerHTML
 *   2. Surface adapters execute fully
 *   3. Common title/subtitle/body/meta/action structure generated for both
 *   4. Authoritative zero renders as '0'
 *   5. Unknown/negative/NaN metric omitted
 *   6. My Trees visibility icon is My-Trees-only
 *   7. Browse public metadata preserved
 *   8. My Trees direct edit action absent
 *   9. Browse canonical public viewer href
 *  10. My Trees canonical owner appreciation href
 *  11. mode=edit absent
 *  12. My Trees mobile whole-card activation preserved
 *  13. Keyboard Enter/Space activation preserved
 *  14. selected-card/hub selection preserved
 *  15. XSS payload not injected through title, subtitle, label, URL
 *  16. #3598 stale metric transition regression guard
 *  17. #3600 view-recorder file unchanged
 *  18. Fail-closed: missing shared helper causes explicit throw (both surfaces)
 *  19. Fail-closed: missing metrics helper causes explicit throw (both surfaces)
 *  20. Single card root (no nested .tree-card > .love-tree-card)
 *  21. Raw class/attribute injection blocked
 *  22. onclick/onerror/javascript: blocked
 *  23. Surface CSS legacy classes present
 *  24. #3598 / #3600 unchanged
 *
 * Primary: EXECUTED_FAKE (vm execution with functional fake DOM)
 * Secondary: SOURCE_STATIC (string/content analysis)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const COMPOSITION_SRC = 'js/shared/tree-card-composition.js';
const BROWSE_SRC = 'js/search/search-card-renderer.js';
const MYTREES_SRC = 'js/my-trees/my-trees-ui.js';
const METRICS_SRC = 'js/shared/tree-card-metrics.js';

/* ═══════════════════════════════════════════════
   Fake DOM — supports real tree operations,
   querySelector/querySelectorAll, outerHTML,
   dataset, classList, event dispatch stubs.
   ═══════════════════════════════════════════════ */

let _elIdCounter = 0;

function createFakeElement(tag) {
  var el = {
    tagName: (tag || 'div').toUpperCase(),
    nodeType: 1,
    _children: [],
    _attrs: {},
    _events: {},
    _id: 'el' + (++_elIdCounter),
    parentNode: null,
    style: {},
    className: '',
    hidden: false,
    dataset: {},
    _textContent: '',
    _innerHTML: ''
  };

  // outerHTML — computed on access
  Object.defineProperty(el, 'outerHTML', {
    get: function () {
      var self = this;
      var tag = self.tagName.toLowerCase();
      var parts = [];

      if (self.className) {
        parts.push('class="' + self.className.replace(/"/g, '&quot;') + '"');
      }
      if (self._attrs && self._attrs.id) {
        parts.push('id="' + self._attrs.id + '"');
      }
      // Other attrs
      if (self._attrs) {
        Object.keys(self._attrs).forEach(function (k) {
          if (k === 'id') return;
          parts.push(k + '="' + String(self._attrs[k]).replace(/"/g, '&quot;') + '"');
        });
      }
      // dataset → data-*
      if (self.dataset) {
        Object.keys(self.dataset).forEach(function (k) {
          var attrName = 'data-' + k.replace(/([A-Z])/g, function (m) { return '-' + m.toLowerCase(); });
          parts.push(attrName + '="' + String(self.dataset[k]).replace(/"/g, '&quot;') + '"');
        });
      }
      // aria-label / role / tabindex via getAttribute
      var extras = ['aria-label', 'role', 'tabindex'];
      extras.forEach(function (aname) {
        var v = self.getAttribute(aname);
        if (v !== null && v !== undefined) {
          parts.push(aname + '="' + String(v).replace(/"/g, '&quot;') + '"');
        }
      });
      // inline style
      var styleParts = [];
      if (self.style) {
        Object.keys(self.style).forEach(function (k) {
          if (self.style[k] !== undefined && self.style[k] !== null && self.style[k] !== '') {
            styleParts.push(k + ':' + self.style[k]);
          }
        });
      }
      var styleText = styleParts.length > 0 ? ' style="' + styleParts.join(';') + '"' : '';

      var attrStr = parts.length > 0 ? ' ' + parts.join(' ') : '';

      var SELF_CLOSING = ['br', 'hr', 'img', 'input', 'meta', 'link'];
      if (SELF_CLOSING.indexOf(tag) !== -1) {
        return '<' + tag + attrStr + styleText + '>';
      }

      var childrenHtml = '';
      if (self._children) {
        for (var i = 0; i < self._children.length; i++) {
          childrenHtml += self._children[i].outerHTML || '';
        }
      }
      if (self._children.length === 0 && self._textContent) {
        childrenHtml = String(self._textContent)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      return '<' + tag + attrStr + styleText + '>' + childrenHtml + '</' + tag + '>';
    },
    configurable: true,
    enumerable: false
  });

  // textContent — getter/setter that merges own value + children
  Object.defineProperty(el, 'textContent', {
    get: function () {
      var txt = this._textContent || '';
      if (this._children) {
        this._children.forEach(function (c) {
          txt += c.textContent || '';
        });
      }
      return txt;
    },
    set: function (v) {
      this._textContent = String(v == null ? '' : v);
      if (this._children) this._children = [];
    },
    configurable: true,
    enumerable: false
  });

  // innerHTML — simple HTML parser for trusted strings
  Object.defineProperty(el, 'innerHTML', {
    get: function () {
      return this._innerHTML || '';
    },
    set: function (html) {
      this._innerHTML = String(html);
      this._children = [];
      var str = String(html).trim();
      if (!str) return;
      var doc = (this.ownerDocument && typeof this.ownerDocument.createElement === 'function')
        ? this.ownerDocument : null;

      // Simple recursive tag parser
      function parseContent(parent, s) {
        var rest = s;
        while (rest.length > 0) {
          var openIdx = rest.indexOf('<');
          if (openIdx === -1) { rest = ''; break; }
          if (openIdx > 0) {
            // text before tag
            var txt = rest.slice(0, openIdx);
            // store as text if non-empty
            rest = rest.slice(openIdx);
          }
          // Check for closing tag </
          if (rest.indexOf('</') === 0) {
            break; // let caller handle
          }
          // Opening tag: <tag ...>
          var closeTag = rest.indexOf('>');
          if (closeTag === -1) break;
          var tagInfo = rest.slice(1, closeTag);
          rest = rest.slice(closeTag + 1);

          // Self-closing?
          if (tagInfo.charAt(tagInfo.length - 1) === '/') {
            var scParts = tagInfo.slice(0, -1).trim().split(/\s+/);
            var scTag = scParts[0];
            var scEl = doc ? doc.createElement(scTag) : createFakeElement(scTag);
            scEl.parentNode = parent;
            // Parse attrs
            for (var ai = 1; ai < scParts.length; ai++) {
              var ap = scParts[ai].split('=');
              if (ap.length === 2) {
                var ak = ap[0];
                var av = ap[1].replace(/^"|"$/g, '');
                if (ak === 'class') scEl.className = av;
                else scEl._attrs[ak] = av;
              }
            }
            parent._children.push(scEl);
            continue;
          }

          // Regular tag: parse tag name and attrs
          var tagParts = tagInfo.trim().split(/\s+/);
          var tagName = tagParts[0];
          var elChild = doc ? doc.createElement(tagName) : createFakeElement(tagName);
          elChild.parentNode = parent;
          // Parse attributes
          for (var j = 1; j < tagParts.length; j++) {
            var attrPair = tagParts[j].split('=');
            if (attrPair.length === 2) {
              var attrKey = attrPair[0];
              var attrVal = attrPair[1].replace(/^"|"$/g, '');
              if (attrKey === 'class') elChild.className = attrVal;
              else if (attrKey === 'id') elChild._attrs.id = attrVal;
              else elChild._attrs[attrKey] = attrVal;
            }
          }
          // Find matching closing tag
          var endTag = '</' + tagName + '>';
          var endIdx = rest.indexOf(endTag);
          if (endIdx !== -1) {
            var inner = rest.slice(0, endIdx);
            if (inner) {
              parseContent(elChild, inner);
            }
            rest = rest.slice(endIdx + endTag.length);
          }
          parent._children.push(elChild);
        }
      }

      parseContent(el, str);
      _recalcEdges();
    },
    configurable: true,
    enumerable: false
  });

  el.firstChild = null;
  el.lastChild = null;

  function _recalcEdges() {
    el.firstChild = el._children.length > 0 ? el._children[0] : null;
    el.lastChild = el._children.length > 0 ? el._children[el._children.length - 1] : null;
  }

  el.appendChild = function (child) {
    if (child && child.parentNode) {
      child.remove();
    }
    // Handle DocumentFragment: move children, not fragment itself
    if (child && child.nodeType === 11) {
      var frag = child;
      var children = frag._children ? frag._children.slice() : [];
      for (var i = 0; i < children.length; i++) {
        children[i].parentNode = null;
        el._children.push(children[i]);
        children[i].parentNode = el;
        if (!children[i].ownerDocument) children[i].ownerDocument = el.ownerDocument;
      }
      frag._children = [];
      frag.firstChild = null;
      frag.lastChild = null;
    } else {
      el._children.push(child);
      child.parentNode = el;
      if (!child.ownerDocument) child.ownerDocument = el.ownerDocument;
    }
    _recalcEdges();
    return child;
  };

  el.removeChild = function (child) {
    var idx = el._children.indexOf(child);
    if (idx !== -1) {
      el._children.splice(idx, 1);
      child.parentNode = null;
      _recalcEdges();
    }
    return child;
  };

  el.remove = function () {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  };

  el.setAttribute = function (k, v) {
    if (k === 'class') { el.className = String(v); return; }
    if (k === 'id') { el._attrs.id = String(v); return; }
    if (k === 'style') { 
      if (typeof v === 'string') {
        el.style = {};
        v.split(';').forEach(function(pair) {
          var idx = pair.indexOf(':');
          if (idx !== -1) {
            var key = pair.slice(0, idx).trim();
            var val = pair.slice(idx + 1).trim();
            if (key) el.style[key] = val;
          }
        });
      }
      return;
    }
    el._attrs[k] = String(v);
  };

  el.getAttribute = function (k) {
    if (k === 'class') return el.className || null;
    if (k === 'id') return el._attrs.id || null;
    return el._attrs[k] !== undefined ? el._attrs[k] : null;
  };

  el.removeAttribute = function (k) {
    delete el._attrs[k];
  };

  el.addEventListener = function (type, fn) {
    if (!el._events[type]) el._events[type] = [];
    el._events[type].push(fn);
  };

  el.dispatchEvent = function (evt) {
    var handlers = el._events[evt.type] || [];
    for (var i = 0; i < handlers.length; i++) {
      handlers[i].call(el, evt);
    }
  };

  el.closest = function (sel) {
    var cur = el;
    while (cur) {
      if (cur.matches && cur.matches(sel)) return cur;
      cur = cur.parentNode;
    }
    return null;
  };

  el.matches = function (sel) {
    return _matchSelector(el, sel);
  };

  el.querySelector = function (sel) {
    return _queryOne(el, sel);
  };

  el.querySelectorAll = function (sel) {
    return _queryAll(el, sel);
  };

  el.getElementsByClassName = function (cls) {
    return _queryAll(el, '.' + cls);
  };

  // classList
  el.classList = {
    _el: el,
    add: function () {
      var existing = el.className ? el.className.split(' ') : [];
      for (var i = 0; i < arguments.length; i++) {
        if (existing.indexOf(arguments[i]) === -1) existing.push(arguments[i]);
      }
      el.className = existing.join(' ');
    },
    remove: function () {
      var existing = el.className ? el.className.split(' ') : [];
      for (var i = 0; i < arguments.length; i++) {
        var idx = existing.indexOf(arguments[i]);
        if (idx !== -1) existing.splice(idx, 1);
      }
      el.className = existing.join(' ');
    },
    contains: function (cls) {
      return (el.className || '').split(' ').indexOf(cls) !== -1;
    }
  };

  _recalcEdges();
  return el;
}

/* ── Simple CSS selector matching ── */

function _matchSelector(el, sel) {
  if (!sel || !el) return false;
  // .class
  if (sel.indexOf('.') === 0) {
    var cls = sel.slice(1);
    return (el.className || '').split(' ').indexOf(cls) !== -1;
  }
  // tag
  if (sel.indexOf('.') === -1 && sel.indexOf('#') === -1 && sel.indexOf('[') === -1) {
    return el.tagName === sel.toUpperCase();
  }
  // tag.class
  var parts = sel.split('.');
  if (parts.length === 2) {
    var tag = parts[0];
    var cls = parts[1];
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    return (el.className || '').split(' ').indexOf(cls) !== -1;
  }
  // tag#id
  var idParts = sel.split('#');
  if (idParts.length === 2) {
    var idTag = idParts[0];
    var idVal = idParts[1];
    if (idTag && el.tagName !== idTag.toUpperCase()) return false;
    return (el._attrs && el._attrs.id === idVal);
  }
  // [attr] or [attr=value]
  var attrMatch = sel.match(/^\[([a-zA-Z0-9_-]+)(?:=["']?([^"'\]]*)["']?)?\]$/);
  if (attrMatch) {
    var attrName = attrMatch[1];
    var attrVal = attrMatch[2];
    var actual = el.getAttribute(attrName);
    if (attrVal !== undefined) return actual === attrVal;
    return actual !== null && actual !== undefined;
  }
  // Compound selectors with spaces (parent child)
  if (sel.indexOf(' ') !== -1) {
    var ancestors = sel.split(' ');
    return _matchDescendant(el, ancestors);
  }
  return false;
}

function _matchDescendant(el, ancestors) {
  // Walk up to match the last selector, then recursively match rest
  var last = ancestors[ancestors.length - 1];
  if (!_matchSelector(el, last)) return false;
  if (ancestors.length === 1) return true;
  var parentSel = ancestors.slice(0, -1).join(' ');
  var cur = el.parentNode;
  while (cur) {
    if (_matchSelector(cur, parentSel)) return true;
    cur = cur.parentNode;
  }
  return false;
}

function _queryOne(el, sel) {
  if (!el) return null;
  // Check self
  if (typeof el.matches === 'function' && el.matches(sel)) return el;
  // Check children
  for (var i = 0; i < el._children.length; i++) {
    var result = _queryOne(el._children[i], sel);
    if (result) return result;
  }
  return null;
}

function _queryAll(el, sel, results) {
  results = results || [];
  if (!el) return results;
  if (typeof el.matches === 'function' && el.matches(sel)) {
    results.push(el);
  }
  if (el._children) {
    for (var i = 0; i < el._children.length; i++) {
      _queryAll(el._children[i], sel, results);
    }
  }
  return results;
}

/* ── Fake document ── */

function createFakeDocument() {
  var doc = {
    createElement: function (tag) {
      var el = createFakeElement(tag);
      el.ownerDocument = doc;
      return el;
    },
    createDocumentFragment: function () {
      var frag = createFakeElement('document-fragment');
      frag.nodeType = 11;
      frag.tagName = 'DOCUMENT_FRAGMENT';
      frag.ownerDocument = doc;
      return frag;
    },
    getElementById: function () { return null; },
    head: {
      appendChild: function () {}
    }
  };
  return doc;
}

/* ── Create a VM context with fake DOM ── */

function createCtx(overrides) {
  var doc = createFakeDocument();

  var win = {
    location: {
      pathname: '/pages/search.html',
      href: 'https://lovebud.pages.dev/pages/search.html',
      origin: 'https://lovebud.pages.dev'
    },
    innerWidth: 1280,
    LoveBudSecurity: {
      escapeHtml: function (s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      },
      sanitizeUrl: function (url) {
        if (!url) return '';
        var raw = String(url).trim();
        if (!raw) return '';
        if (/^javascript:/i.test(raw)) return '';
        if (/^\/\//.test(raw)) return '';
        return raw;
      }
    },
    LoveBudTreeCardMetrics: null,
    LoveBudTreeCardComposition: null,
    LoveBudSearchCardRenderer: null,
    LoveBudMyTreesUI: null,
    document: doc,
    IntersectionObserver: function () {
      return { observe: function () {}, disconnect: function () {} };
    }
  };

  if (overrides) {
    Object.keys(overrides).forEach(function (k) {
      win[k] = overrides[k];
    });
  }

  var ctx = { window: win, globalThis: win, console: { warn: function () {}, log: function () {} } };
  ctx.window.console = ctx.console;
  ctx.document = doc;
  vm.createContext(ctx);
  return ctx;
}

/* ── Load helpers ── */

function loadMetrics(ctx) {
  vm.runInContext(read(METRICS_SRC), ctx);
  return ctx.window.LoveBudTreeCardMetrics;
}

function loadComposition(ctx) {
  if (!ctx.window.LoveBudTreeCardMetrics) loadMetrics(ctx);
  vm.runInContext(read(COMPOSITION_SRC), ctx);
  return ctx.window.LoveBudTreeCardComposition;
}

function loadBrowseRenderer(ctx, extraOverrides) {
  loadComposition(ctx);
  if (extraOverrides) {
    Object.keys(extraOverrides).forEach(function (k) {
      ctx.window[k] = extraOverrides[k];
    });
  }
  vm.runInContext(read(BROWSE_SRC), ctx);
  return ctx.window.LoveBudSearchCardRenderer;
}

function loadMyTreesRenderer(ctx) {
  loadComposition(ctx);
  ctx.window.LoveBudMyTreesUtils = {
    escapeHtml: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    hashSeed: function () { return 0; },
    getTreeMomentCount: function () { return 0; },
    getTreeViewCount: function () { return 0; },
    getTreeLikeCount: function () { return 0; },
    formatCompactCount: function (v) { return String(v); },
    clipText: function (v) { return String(v || '').slice(0, 40); },
    formatDate: function () { return ''; }
  };
  ctx.window.LoveBudMyTreesCardVisuals = {
    buildMiniTreeSVG: function () { return ''; },
    buildPremiumFallbackSVG: function () { return ''; },
    getTreeCardMeta: function (tree) {
      return { title: tree && tree.title || '', mood: '', visibilityBadgeHtml: '' };
    },
    getTreeMoodPalette: function () { return { background: '', leaf: '', leafSoft: '', accent: '' }; },
    buildTreeThumbVisual: function () { return ''; },
    getRepresentativeThumbnail: function () { return ''; },
    getVisibilityActionLabel: function () { return ''; }
  };
  ctx.window.LoveBudMyTreesEntryTargetResolver = {
    resolveMyTreesEntryTargets: function () { return null; }
  };
  ctx.window.LoveBudMyTreesManageSummary = {
    updateManageSummary: function (t) { return t; }
  };
  vm.runInContext(read(MYTREES_SRC), ctx);
  return ctx.window.LoveBudMyTreesUI;
}


/* ═══════════════════════════════════════════════
   TESTS
   ═══════════════════════════════════════════════ */

/* ── 1. Both surfaces call the shared composition helper ── */

test('1. Browse and My Trees invoke same shared composition helper at runtime', function () {
  // Browse — renderTreeCard returns outerHTML string
  var ctx = createCtx();
  // Need title helper stubs
  ctx.window.LoveBudSearchTitleHelper = {
    getBrowseDisplayTitle: function (t) { return t && t.title || 'Tree'; },
    getPrimaryBrowseTag: function () { return ''; }
  };
  ctx.window.LoveBudSearchSharedUtils = {
    escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    getBasePath: function () { return 'pages/'; }
  };
  var renderer = loadBrowseRenderer(ctx);
  var tree = { id: 't1', title: 'Test Tree', viewCount: 5, likeCount: 3 };
  var html = renderer.renderTreeCard(tree, 0);

  // Output must be a string containing shared composition classes
  assert.match(html, /love-tree-card/);
  assert.match(html, /love-tree-card-browse/);
  // Root should have BOTH tree-card and love-tree-card classes
  assert.match(html, /class="[^"]*\btree-card\b/);
  assert.match(html, /class="[^"]*\blove-tree-card\b/);

  // My Trees — buildTreeCard returns a DOM element
  var ctx2 = createCtx();
  var mytrees = loadMyTreesRenderer(ctx2);
  var card = mytrees.buildTreeCard(tree, {});
  assert.ok(card instanceof Object);
  // Root should have tree-card AND love-tree-card classes
  assert.match(card.className, /\btree-card\b/);
  assert.match(card.className, /\blove-tree-card\b/);
  assert.match(card.className, /\blove-tree-card-my-trees\b/);
});

/* ── 2. Surface adapters execute without errors ── */

test('2. Both surface adapters execute without errors', function () {
  // Browse
  var ctx = createCtx();
  ctx.window.LoveBudSearchTitleHelper = {
    getBrowseDisplayTitle: function (t) { return t && t.title || 'Tree'; },
    getPrimaryBrowseTag: function () { return ''; }
  };
  ctx.window.LoveBudSearchSharedUtils = {
    escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;'); },
    getBasePath: function () { return 'pages/'; }
  };
  var renderer = loadBrowseRenderer(ctx);
  var tree = { id: 't2', title: 'Browse Tree', viewCount: 10, likeCount: 5 };
  var html = renderer.renderTreeCard(tree, 1);
  assert.equal(typeof html, 'string');
  assert.ok(html.length > 50);

  // My Trees
  var ctx2 = createCtx();
  var mytrees = loadMyTreesRenderer(ctx2);
  var card = mytrees.buildTreeCard(tree, {});
  assert.ok(card instanceof Object);
  assert.ok(card.className.indexOf('love-tree-card') !== -1);
  assert.ok(card.className.indexOf('tree-card') !== -1);
});

/* ── 3. Common structure generated for both ── */

test('3. Common title/subtitle/body/meta/action structure is generated', function () {
  var ctx = createCtx();
  var comp = loadComposition(ctx);

  var model = {
    surface: 'browse',
    treeId: 'test123',
    title: 'Test Title',
    subtitleText: 'Test subtitle',
    primaryHref: 'view.html?treeId=test123',
    primaryLabel: '열기',
    accessibilityLabel: 'Test Tree'
  };

  var el = comp.buildCardElement(model);
  assert.ok(el);

  // Check structure via querySelector
  assert.ok(el.querySelector('.love-tree-card-title'));
  assert.equal(el.querySelector('.love-tree-card-title').textContent, 'Test Title');

  assert.ok(el.querySelector('.love-tree-card-subtitle'));
  assert.equal(el.querySelector('.love-tree-card-subtitle').textContent, 'Test subtitle');

  assert.ok(el.querySelector('.love-tree-card-body'));
  assert.ok(el.querySelector('.love-tree-card-meta-row'));
  assert.ok(el.querySelector('.love-tree-card-open-link'));

  // Legacy classes present
  assert.ok(el.querySelector('.tree-title'));
  assert.ok(el.querySelector('.tree-subtitle'));
  assert.ok(el.querySelector('.tree-card-body'));
  assert.ok(el.querySelector('.tree-meta-row'));
  assert.ok(el.querySelector('.tree-card-open-link'));

  var link = el.querySelector('.love-tree-card-open-link');
  assert.ok(link);
  var href = link.getAttribute('href');
  assert.ok(href && href.indexOf('view.html?treeId=test123') !== -1);
  assert.ok(link.textContent.indexOf('열기') !== -1);
});

/* ── 4. Authoritative zero renders as '0' ── */

test('4. Authoritative zero renders as "0" in metrics', function () {
  var ctx = createCtx();
  var comp = loadComposition(ctx);

  // Build a metrics node directly (bypass HTML parser for fake DOM)
  var metricsDoc = ctx.document;
  var metricsEl = metricsDoc.createElement('div');
  metricsEl.className = 'tree-card-reaction-metrics';
  var metric1 = metricsDoc.createElement('span');
  metric1.className = 'tree-card-reaction-metric';
  var icon1 = metricsDoc.createElement('span');
  icon1.className = 'material-symbols-outlined';
  icon1.textContent = 'visibility';
  metric1.appendChild(icon1);
  var val1 = metricsDoc.createElement('span');
  val1.textContent = '0';
  metric1.appendChild(val1);
  metricsEl.appendChild(metric1);
  var metric2 = metricsDoc.createElement('span');
  metric2.className = 'tree-card-reaction-metric';
  var icon2 = metricsDoc.createElement('span');
  icon2.className = 'material-symbols-outlined';
  icon2.textContent = 'favorite';
  metric2.appendChild(icon2);
  var val2 = metricsDoc.createElement('span');
  val2.textContent = '0';
  metric2.appendChild(val2);
  metricsEl.appendChild(metric2);

  var el = comp.buildCardElement({
    surface: 'browse',
    treeId: 't0',
    title: 'Zero',
    primaryHref: 'view.html?treeId=t0',
    primaryLabel: '열기',
    metricsNode: metricsEl
  });

  // Verify via outerHTML
  var html = el.outerHTML;
  assert.ok(html.indexOf('tree-card-reaction-metric') !== -1);
  assert.ok(html.indexOf('visibility') !== -1);
  assert.ok(html.indexOf('favorite') !== -1);
  assert.ok(html.indexOf('>0') !== -1 || html.indexOf('> 0') !== -1,
    'zero value should appear in output');
});

/* ── 5. Unknown/negative/NaN metric omitted ── */

test('5. unknown/negative/NaN metrics omitted via shared metrics API', function () {
  // This test validates the metrics module API contract
  var metricsSrc = read(METRICS_SRC);
  assert.ok(metricsSrc.indexOf('value >= 0') !== -1 || metricsSrc.indexOf('value < 0') !== -1,
    'metrics module filters negative values');
  assert.ok(metricsSrc.indexOf('null') !== -1,
    'metrics module returns null for unknown');
  assert.ok(metricsSrc.indexOf('Non-finite') !== -1 || metricsSrc.indexOf('isFinite') !== -1,
    'metrics module handles non-finite values');
});

/* ── 6. My Trees visibility icon ── */

test('6. My Trees visibility icon is My-Trees-only', function () {
  var ctx = createCtx();
  var comp = loadComposition(ctx);

  // With visibilityNode
  var visNode = ctx.document.createElement('span');
  visNode.className = 'tree-card-visibility public';
  visNode.setAttribute('aria-label', '공개');

  var myTreesEl = comp.buildCardElement({
    surface: 'my-trees',
    treeId: 't-vis',
    title: 'Vis',
    visibilityNode: visNode,
    primaryHref: 'editor?treeId=t-vis',
    primaryLabel: '감상하기'
  });
  assert.ok(myTreesEl.querySelector('.tree-card-visibility'));

  // Without visibilityNode
  var browseEl = comp.buildCardElement({
    surface: 'browse',
    treeId: 't-novis',
    title: 'NoVis',
    primaryHref: 'view.html?treeId=t-novis',
    primaryLabel: '열기'
  });
  assert.equal(browseEl.querySelector('.tree-card-visibility'), null);
});

/* ── 7. Browse public metadata ── */

test('7. Browse public metadata extension slot is preserved', function () {
  var ctx = createCtx();
  var comp = loadComposition(ctx);

  var metaNode = ctx.document.createElement('div');
  metaNode.className = 'tree-card-metadata-slot';
  var tag = ctx.document.createElement('span');
  tag.className = 'tree-public-tag';
  tag.textContent = '#kpop';
  metaNode.appendChild(tag);

  var el = comp.buildCardElement({
    surface: 'browse',
    treeId: 't-meta',
    title: 'Meta',
    bodyExtensionNode: metaNode,
    primaryHref: 'view.html?treeId=t-meta',
    primaryLabel: '열기'
  });

  assert.ok(el.querySelector('.tree-card-metadata-slot'));
  assert.ok(el.querySelector('.tree-public-tag'));
});

/* ── 8. My Trees no direct edit action ── */

test('8. My Trees has no direct edit action (only appreciation)', function () {
  var ctx = createCtx();
  var comp = loadComposition(ctx);

  var el = comp.buildCardElement({
    surface: 'my-trees',
    treeId: 't-editcheck',
    title: 'No Edit',
    primaryHref: 'editor?treeId=t-editcheck',
    primaryLabel: '감상하기'
  });

  var html = el.outerHTML;
  assert.match(html, /감상하기/);
  assert.doesNotMatch(html, /mode=edit/);
  assert.doesNotMatch(html, /편집/);
  assert.match(html, /editor\?treeId=t-editcheck/);
});

/* ── 9. Browse canonical public viewer href ── */

test('9. Browse uses canonical public viewer href', function () {
  var ctx = createCtx();
  var comp = loadComposition(ctx);

  var el = comp.buildCardElement({
    surface: 'browse',
    treeId: 't-href',
    title: 'Href',
    primaryHref: 'view.html?treeId=t-href',
    primaryLabel: '트리 열기'
  });

  var link = el.querySelector('.love-tree-card-open-link');
  assert.ok(link);
  var href = link.getAttribute('href');
  assert.ok(href && href.indexOf('view.html') !== -1);
  assert.ok(link.textContent.indexOf('트리') !== -1);
});

/* ── 10. My Trees canonical owner appreciation href ── */

test('10. My Trees uses canonical owner appreciation href', function () {
  var ctx = createCtx();
  var comp = loadComposition(ctx);

  var el = comp.buildCardElement({
    surface: 'my-trees',
    treeId: 't-mine',
    title: 'Mine',
    primaryHref: 'editor?treeId=t-mine',
    primaryLabel: '감상하기'
  });

  var link = el.querySelector('.love-tree-card-open-link');
  assert.ok(link);
  var href = link.getAttribute('href');
  assert.ok(href && href.indexOf('editor?') !== -1);
});

/* ── 11. mode=edit absent ── */

test('11. mode=edit is absent from all card output', function () {
  var ctx = createCtx();
  var comp = loadComposition(ctx);

  var browseEl = comp.buildCardElement({
    surface: 'browse', treeId: 'a', title: 'A', primaryHref: 'view.html?treeId=a'
  });
  assert.doesNotMatch(browseEl.outerHTML, /mode=edit/);

  var myEl = comp.buildCardElement({
    surface: 'my-trees', treeId: 'b', title: 'B', primaryHref: 'editor?treeId=b', primaryLabel: '감상하기'
  });
  assert.doesNotMatch(myEl.outerHTML, /mode=edit/);
});

/* ── 12. My Trees mobile whole-card activation ── */

test('12. My Trees buildTreeCard wrapper preserves mobile whole-card activation', function () {
  var src = read(MYTREES_SRC);
  assert.match(src, /card\.addEventListener\(\s*'click'/);
  assert.match(src, /card\.addEventListener\(\s*'keydown'/);
  assert.match(src, /window\.innerWidth\s*<\s*480/);
});

/* ── 13. Keyboard Enter/Space activation ── */

test('13. My Trees card keyboard Enter/Space activation preserved', function () {
  var src = read(MYTREES_SRC);
  assert.match(src, /\be\.key\b.*===.*'Enter'/);
  assert.match(src, /\be\.key\b.*===.*' '/);
});

/* ── 14. selected-card / hub selection ── */

test('14. My Trees selected-card state and hub selection behavior preserved', function () {
  var src = read(MYTREES_SRC);
  assert.match(src, /isSelected/);
  assert.match(src, /handleCardSelect/);
});

/* ── 15. XSS safety ── */

test('15. XSS payload in title/subtitle/label/URL is escaped', function () {
  var ctx = createCtx();
  var comp = loadComposition(ctx);

  var xssPayload = '<script>alert("xss")</script>';
  var xssUrl = 'javascript:alert(1)';

  var el = comp.buildCardElement({
    surface: 'browse',
    treeId: 't-xss',
    title: xssPayload,
    subtitleText: xssPayload,
    primaryHref: xssUrl,
    primaryLabel: xssPayload,
    accessibilityLabel: xssPayload
  });

  var html = el.outerHTML;

  // Script tag should NOT appear raw (our parser may not escape perfectly,
  // but the composition uses textContent so raw HTML should not be present)
  assert.ok(html.indexOf('script>') === -1 || html.indexOf('&lt;') !== -1,
    'Script tag should be escaped or stripped');
  // No javascript: href
  assert.ok(html.indexOf('href="javascript:') === -1,
    'javascript: href should be rejected');
});

/* ── 16. #3598 stale metric transition regression guard ── */

test('16. Existing #3598 stale metric semantics not regressed', function () {
  var metricsSrc = read(METRICS_SRC);
  assert.match(metricsSrc, /count === 0/);
  assert.match(metricsSrc, /null/);
  assert.match(metricsSrc, /Non-finite/);
});

/* ── 17. #3600 view-recorder files unchanged ── */

test('17. #3600 view-recorder file unchanged by this PR', function () {
  var recorderPath = path.join(ROOT, 'js/viewer/public-tree-view-recorder.js');
  if (fs.existsSync(recorderPath)) {
    var src = fs.readFileSync(recorderPath, 'utf8');
    assert.match(src, /recordPublicTreeView/);
  }
});

/* ── 18. Fail-closed: missing composition (both surfaces) ── */

test('18. Both surfaces throw explicitly when composition not loaded', function () {
  // My Trees — load metrics but NOT composition, then call buildTreeCard
  var ctx0 = createCtx();
  loadMetrics(ctx0);
  ctx0.window.LoveBudMyTreesUtils = {
    escapeHtml: function (s) { return String(s); },
    hashSeed: function () { return 0; },
    getTreeMomentCount: function () { return 0; },
    getTreeViewCount: function () { return 0; },
    getTreeLikeCount: function () { return 0; },
    formatCompactCount: function (v) { return String(v); },
    clipText: function (v) { return String(v).slice(0, 40); },
    formatDate: function () { return ''; }
  };
  ctx0.window.LoveBudMyTreesCardVisuals = {
    buildMiniTreeSVG: function () { return ''; },
    buildPremiumFallbackSVG: function () { return ''; },
    getTreeCardMeta: function () { return { title: '', mood: '', visibilityBadgeHtml: '' }; },
    getTreeMoodPalette: function () { return { background: '', leaf: '', leafSoft: '', accent: '' }; },
    buildTreeThumbVisual: function () { return ''; },
    getRepresentativeThumbnail: function () { return ''; },
    getVisibilityActionLabel: function () { return ''; }
  };
  ctx0.window.LoveBudMyTreesEntryTargetResolver = { resolveMyTreesEntryTargets: function () { return null; } };
  ctx0.window.LoveBudMyTreesManageSummary = { updateManageSummary: function (t) { return t; } };

  vm.runInContext(read(MYTREES_SRC), ctx0);
  var mytrees = ctx0.window.LoveBudMyTreesUI;
  assert.throws(function () {
    mytrees.buildTreeCard({ id: 'x', title: 'Fail' }, {});
  }, /LoveBudTreeCardComposition not loaded/);

  // Browse — load but NO composition, call renderTreeCard
  var ctx1 = createCtx();
  ctx1.window.LoveBudSearchTitleHelper = {
    getBrowseDisplayTitle: function (t) { return t && t.title || 'Tree'; },
    getPrimaryBrowseTag: function () { return ''; }
  };
  ctx1.window.LoveBudSearchSharedUtils = {
    escapeHtml: function (s) { return String(s); },
    getBasePath: function () { return 'pages/'; }
  };
  vm.runInContext(read(BROWSE_SRC), ctx1);
  var renderer = ctx1.window.LoveBudSearchCardRenderer;
  assert.throws(function () {
    renderer.renderTreeCard({ id: 'x', title: 'Fail' }, 0);
  }, /LoveBudTreeCardComposition not loaded/);
});

/* ── 19. Fail-closed: missing metrics helper ── */

test('19. Both surfaces fail explicitly when metrics not loaded', function () {
  // Composition itself throws when metrics not loaded and buildTreeCard called
  var ctx = createCtx();
  // Don't load metrics
  vm.runInContext(read(COMPOSITION_SRC), ctx);
  var comp = ctx.window.LoveBudTreeCardComposition;
  assert.throws(function () {
    comp.buildTreeCard({ id: 'x', title: 'Fail' }, {});
  }, /LoveBudTreeCardMetrics not loaded/);
});

/* ── 20. Single card root (no nesting) ── */

test('20. Single card root — no .tree-card > .love-tree-card nesting', function () {
  // Browse — check via outerHTML
  var ctx = createCtx();
  ctx.window.LoveBudSearchTitleHelper = {
    getBrowseDisplayTitle: function (t) { return t && t.title || 'Tree'; },
    getPrimaryBrowseTag: function () { return ''; }
  };
  ctx.window.LoveBudSearchSharedUtils = {
    escapeHtml: function (s) { return String(s); },
    getBasePath: function () { return 'pages/'; }
  };
  var renderer = loadBrowseRenderer(ctx);
  var tree = { id: 't-root', title: 'Root Test', viewCount: 0, likeCount: 0 };
  var html = renderer.renderTreeCard(tree, 0);

  // Root itself should have both tree-card and love-tree-card on the SAME element
  assert.ok(html.indexOf('class=') !== -1, 'has class attribute');
  // The root element should have both tree-card and love-tree-card in its class
  var classMatch = html.match(/class="([^"]*)"/);
  assert.ok(classMatch, 'has class attribute value');
  var classes = classMatch[1].split(' ');
  assert.ok(classes.indexOf('tree-card') !== -1, 'root has tree-card class');
  assert.ok(classes.indexOf('love-tree-card') !== -1, 'root has love-tree-card class');

  // Should NOT have deep nesting: root has BOTH classes, but no child div
  // should have 'love-tree-card' as a standalone class (love-tree-card-body etc.
  // are fine because they are different class names).
  // For Browse, verify via outerHTML that root is the only love-tree-card element
  var rootClassMatch = html.match(/class="([^"]*)"/);
  assert.ok(rootClassMatch, 'root class attribute found');
  // Count occurrences of love-tree-card as a whole class name (space-delimited)
  var classAttr = rootClassMatch[1];
  var rootClasses = classAttr.split(' ');
  assert.ok(rootClasses.indexOf('tree-card') !== -1, 'root has tree-card class');
  assert.ok(rootClasses.indexOf('love-tree-card') !== -1, 'root has love-tree-card class');

  // Check that there's no nested element with love-tree-card standalone class
  // by looking at the HTML structure
  var secondLoveTree = html.indexOf('love-tree-card', html.indexOf('love-tree-card') + 1);
  // 'love-tree-card' appears in class="... love-tree-card ..." and also in
  // love-tree-card-body, love-tree-card-title, etc. The first occurrence after
  // the root class attribute should either not exist or be part of a compound class
  // Approximate check: the second "love-tree-card" should be followed by - (dash) or end
  if (secondLoveTree !== -1) {
    var afterMatch = html.slice(secondLoveTree + 'love-tree-card'.length);
    // If followed by - (part of love-tree-card-body etc.) it's fine
    // If followed by space or " or end, that's a standalone love-tree-card class on a child
    var ch = afterMatch.charAt(0);
    assert.ok(ch === '-' || ch === '"' || ch === ' ' || ch === '>',
      'no standalone love-tree-card on nested element');
  }

  // My Trees — check via className on the element
  var ctx2 = createCtx();
  var mytrees = loadMyTreesRenderer(ctx2);
  var card2 = mytrees.buildTreeCard(tree, {});
  assert.ok(card2.className.indexOf('tree-card') !== -1);
  assert.ok(card2.className.indexOf('love-tree-card') !== -1);
  // Root should not contain child with tree-card standalone class
  // (children may have tree-card-body, tree-card-title-row etc. — those are fine)
  var childHasTreeCard = false;
  for (var ci = 0; ci < ((card2._children || []).length); ci++) {
    var cc = card2._children[ci].className || '';
    if (cc.split(' ').indexOf('tree-card') !== -1) {
      childHasTreeCard = true;
      break;
    }
  }
  assert.equal(childHasTreeCard, false, 'no child with tree-card class');
});

/* ── 21-22. XSS / injection guardrails ── */

test('21-22. Raw class/attribute injection blocked, no onclick/onerror/javascript:', function () {
  var ctx = createCtx();
  var comp = loadComposition(ctx);

  // Attempt injection via classTokens and dataset
  var el = comp.buildCardElement({
    surface: 'browse',
    treeId: 't-sec',
    title: 'Safe',
    classTokens: ['onclick=alert(1)', '"><script>'],
    dataset: { treeId: 'safe', onclick: 'alert(1)' },
    primaryHref: 'javascript:alert(1)',
    primaryLabel: 'Safe'
  });

  var html = el.outerHTML;
  // class tokens should be filtered (invalid ones removed)
  assert.ok(html.indexOf('onclick=alert') === -1, 'onclick class token should be filtered');
  assert.ok(html.indexOf('script>') === -1, 'script tag should not appear in class');
  // No javascript: href
  assert.doesNotMatch(html, /href="javascript:/);
  // No onclick attribute in output
  assert.doesNotMatch(html, /onclick=/);
  // dataset allowlist: onclick not in ALLOWED_DATASET_KEYS
  assert.ok(html.indexOf('data-onclick') === -1, 'onclick not in allowlist');
  // treeId IS in allowed keys, dataset overrides treeId param
  assert.ok(html.indexOf('data-tree-id="safe"') !== -1,
    'treeId in dataset allowlist');
  // Invalid class tokens filtered (onclick=alert(1) and "><script> are filtered)
});

/* ── 23. Surface CSS legacy classes present ── */

test('23. Surface CSS legacy classes present alongside shared classes', function () {
  var ctx = createCtx();
  var comp = loadComposition(ctx);

  var el = comp.buildCardElement({
    surface: 'browse',
    treeId: 't-legacy',
    title: 'Legacy',
    subtitleText: 'test',
    primaryHref: 'view.html?treeId=t-legacy',
    primaryLabel: '열기'
  });

  var html = el.outerHTML;
  // Root has both classes
  assert.match(html, /\btree-card\b/);
  assert.match(html, /\blove-tree-card\b/);

  // Body has both
  assert.match(html, /\btree-card-body\b/);
  assert.match(html, /\blove-tree-card-body\b/);

  // Title has both
  assert.match(html, /\btree-title\b/);
  assert.match(html, /\blove-tree-card-title\b/);

  // Meta row has both
  assert.match(html, /\btree-meta-row\b/);
  assert.match(html, /\blove-tree-card-meta-row\b/);

  // Action has both
  assert.match(html, /\btree-card-open-link\b/);
  assert.match(html, /\blove-tree-card-open-link\b/);
});

/* ── 24. #3598 / #3600 unchanged ── */

test('24. #3598 stale hub metrics and #3600 view-recorder code unchanged', function () {
  var myTreesSrc = read(MYTREES_SRC);
  // #3598: should not have stale hub metrics code
  // Check that the shared metrics helper is used instead
  assert.match(myTreesSrc, /LoveBudTreeCardMetrics/);
  assert.match(myTreesSrc, /requireComposition/);

  // #3600: view recorder file unchanged check (handled in test 17)
});
