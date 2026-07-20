/**
 * Runtime test: browse card renderer three-state viewCount display.
 *
 * Calls renderTreeCard() with test tree objects and validates the
 * rendered HTML output for correct metrics inclusion/omission.
 */
'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { test } = require('node:test');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

// ─── Fake DOM factory ──────────────────────────────────────────────

function makeFakeDocument() {
  var _elIdCounter = 0;

  function createFakeElement(tag) {
    var el = {
      tagName: (tag || 'div').toUpperCase(),
      nodeType: 1,
      _children: [],
      _attrs: {},
      parentNode: null,
      style: {},
      className: '',
      dataset: {},
      _textContent: '',
      _innerHTML: '',
      firstChild: null,
      lastChild: null,
      ownerDocument: null,
      // Helper to render HTML string for this element
      toHTML: function () {
        var tag = this.tagName.toLowerCase();
        var parts = [];
        if (this.className) parts.push('class="' + this.className.replace(/"/g, '&quot;') + '"');
        if (this._attrs) Object.keys(this._attrs).forEach(function(k) { parts.push(k + '="' + String(this._attrs[k]).replace(/"/g, '&quot;') + '"'); }, this);
        var attrStr = parts.length > 0 ? ' ' + parts.join(' ') : '';
        var childrenHtml = '';
        for (var i = 0; i < this._children.length; i++) {
          if (typeof this._children[i].toHTML === 'function') childrenHtml += this._children[i].toHTML();
          else if (this._children[i].outerHTML) childrenHtml += this._children[i].outerHTML;
        }
        if (this._children.length === 0 && this._textContent) {
          childrenHtml = String(this._textContent)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        return '<' + tag + attrStr + '>' + childrenHtml + '</' + tag + '>';
      }
    };

    // outerHTML as getter delegating to toHTML
    Object.defineProperty(el, 'outerHTML', {
      get: function () {
        var self = this;
        var tag = self.tagName.toLowerCase();
        var parts = [];
        if (self.className) parts.push('class="' + self.className.replace(/"/g, '&quot;') + '"');
        if (self._attrs) Object.keys(self._attrs).forEach(function(k) { parts.push(k + '="' + String(self._attrs[k]).replace(/"/g, '&quot;') + '"'); });
        var attrStr = parts.length > 0 ? ' ' + parts.join(' ') : '';
        var childrenHtml = '';
        for (var i = 0; i < self._children.length; i++) {
          childrenHtml += self._children[i].outerHTML || '';
        }
        if (self._children.length === 0 && self._textContent) {
          childrenHtml = String(self._textContent)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        return '<' + tag + attrStr + '>' + childrenHtml + '</' + tag + '>';
      },
      configurable: true
    });

    function recalcEdges() {
      el.firstChild = el._children.length > 0 ? el._children[0] : null;
      el.lastChild = el._children.length > 0 ? el._children[el._children.length - 1] : null;
    }

    el.appendChild = function (child) {
      if (child && child.parentNode && child.remove) child.remove();
      if (child && child.nodeType === 11) {
        var frag = child, children = frag._children ? frag._children.slice() : [];
        for (var i = 0; i < children.length; i++) {
          children[i].parentNode = null;
          el._children.push(children[i]);
          children[i].parentNode = el;
        }
        frag._children = []; frag.firstChild = null; frag.lastChild = null;
      } else {
        el._children.push(child);
        child.parentNode = el;
      }
      recalcEdges();
      return child;
    };

    el.removeChild = function (child) {
      var idx = el._children.indexOf(child);
      if (idx !== -1) { el._children.splice(idx, 1); child.parentNode = null; recalcEdges(); }
      return child;
    };

    el.remove = function () { if (el.parentNode) el.parentNode.removeChild(el); };

    el.setAttribute = function (k, v) {
      if (k === 'class') { el.className = String(v); return; }
      el._attrs[k] = String(v);
    };

    el.getAttribute = function (k) {
      if (k === 'class') return el.className || null;
      return el._attrs[k];
    };

    el.classList = {
      add: function () {
        var ex = el.className ? el.className.split(' ') : [];
        for (var i = 0; i < arguments.length; i++) {
          if (ex.indexOf(arguments[i]) === -1) ex.push(arguments[i]);
        }
        el.className = ex.join(' ');
      },
      contains: function (c) { return (el.className || '').split(' ').indexOf(c) !== -1; }
    };

    Object.defineProperty(el, 'textContent', {
      get: function () { var t = this._textContent || ''; if (this._children) this._children.forEach(function(c) { t += c.textContent || ''; }); return t; },
      set: function (v) { this._textContent = String(v == null ? '' : v); if (this._children) this._children = []; recalcEdges(); },
      configurable: true
    });

    Object.defineProperty(el, 'innerHTML', {
      get: function () { return this._innerHTML || ''; },
      set: function (html) {
        this._innerHTML = String(html);
        this._children = [];
        this.firstChild = null;
        this.lastChild = null;
        var str = String(html).trim();
        if (!str) return;
        var doc = this.ownerDocument;
        var _this = this;
        function parseContent(parent, s) {
          var rest = s;
          while (rest.length > 0) {
            var openIdx = rest.indexOf('<');
            if (openIdx === -1) { if (rest.trim()) parent._textContent = (parent._textContent || '') + rest; break; }
            if (openIdx > 0) {
              var tb = rest.slice(0, openIdx);
              if (tb.trim()) parent._textContent = (parent._textContent || '') + tb;
              rest = rest.slice(openIdx);
            }
            if (rest.indexOf('</') === 0) break;
            var closeTag = rest.indexOf('>');
            if (closeTag === -1) break;
            var tagInfo = rest.slice(1, closeTag);
            rest = rest.slice(closeTag + 1);
            if (tagInfo.charAt(tagInfo.length - 1) === '/') continue;
            var tagParts = tagInfo.trim().split(/\s+/);
            var child = doc ? doc.createElement(tagParts[0]) : null;
            if (!child) continue;
            // Extract attributes via regex (handles quoted multi-word values)
            var attrRe = /(\w[\w-]*)\s*=\s*"([^"]*)"/g;
            var attrMatch;
            while ((attrMatch = attrRe.exec(tagInfo)) !== null) {
              var ak = attrMatch[1], av = attrMatch[2];
              if (ak === 'class') child.className = av;
              else child._attrs[ak] = av;
            }
            var endTag = '</' + tagParts[0] + '>';
            var endIdx = rest.indexOf(endTag);
            if (endIdx !== -1) {
              var inner = rest.slice(0, endIdx);
              if (inner) {
                if (inner.indexOf('<') === -1) child._textContent = inner;
                else parseContent(child, inner);
              }
              rest = rest.slice(endIdx + endTag.length);
            }
            parent.appendChild(child);
          }
        }
        parseContent(_this, str);
      },
      configurable: true
    });

    return el;
  }

  return {
    createElement: function (tag) { var el = createFakeElement(tag); el.ownerDocument = this; return el; },
    createDocumentFragment: function () { var frag = createFakeElement('fragment'); frag.nodeType = 11; frag.ownerDocument = this; return frag; },
    documentElement: { lang: 'ko' }
  };
}

// ─── Test helpers ──────────────────────────────────────────────────

function buildTree(overrides) {
  return Object.assign({
    id: 'test-tree-001',
    title: 'Test Tree',
    visibility: 'public',
    memoryCount: 5,
    likeCount: 2,
    emotions: [],
    emotionTags: [],
    representativeThumbnail: '',
    representativeSourceUrl: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, overrides);
}

var securitySource = fs.readFileSync(path.join(ROOT, 'js/utils/security.js'), 'utf8');
var metricsSource = fs.readFileSync(path.join(ROOT, 'js/shared/tree-card-metrics.js'), 'utf8');
var compositionSource = fs.readFileSync(path.join(ROOT, 'js/shared/tree-card-composition.js'), 'utf8');
var rendererSource = fs.readFileSync(path.join(ROOT, 'js/search/search-card-renderer.js'), 'utf8');

function getRenderer() {
  var fakeDoc = makeFakeDocument();
  var sandbox = {
    window: {
      location: { pathname: '/pages/search', origin: 'https://lovebud.pages.dev' }
    },
    document: fakeDoc,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  var context = vm.createContext(sandbox);
  vm.runInContext(securitySource, context, { filename: 'security.js' });
  vm.runInContext(metricsSource, context, { filename: 'tree-card-metrics.js' });
  vm.runInContext(compositionSource, context, { filename: 'tree-card-composition.js' });
  vm.runInContext(rendererSource, context, { filename: 'search-card-renderer.js' });
  return context.window.LoveBudSearchCardRenderer;
}

// ─── Tests ─────────────────────────────────────────────────────────

test('card runtime: viewCount:3 → visibility metric rendered', () => {
  const renderer = getRenderer();
  const tree = buildTree({ viewCount: 3 });
  const html = renderer.renderTreeCard(tree, 0);
  assert.ok(html && html.length > 0, 'renderTreeCard should return non-empty HTML');
  assert.ok(html.includes('tree-card-reaction-metric'), 'metrics should be rendered');
  assert.ok(html.match(/\b3\b/), 'view count 3 must be rendered in output');
});

test('card runtime: viewCount:0 → visibility metric with 0 rendered', () => {
  const renderer = getRenderer();
  const tree = buildTree({ viewCount: 0 });
  const html = renderer.renderTreeCard(tree, 0);
  assert.ok(html && html.length > 0, 'renderTreeCard should return non-empty HTML');
  assert.ok(html.includes('tree-card-reaction-metric'), 'metrics should be rendered for zero');
  assert.ok(html.match(/\b0\b/), 'view count 0 must be in output');
});

test('card runtime: viewCount absent → visibility metric omitted', () => {
  const renderer = getRenderer();
  const tree = buildTree({});
  const html = renderer.renderTreeCard(tree, 0);
  assert.ok(html && html.length > 0, 'renderTreeCard should return non-empty HTML');
  // When viewCount is absent, the metrics should still render available ones
  assert.ok(html.includes('tree-card-reaction-metric'), 'available metrics should render');
});

test('card runtime: viewCount null → visibility omitted', () => {
  const renderer = getRenderer();
  const tree = buildTree({ viewCount: null });
  const html = renderer.renderTreeCard(tree, 0);
  assert.ok(html && html.length > 0, 'renderTreeCard should return non-empty HTML');
  // When viewCount is null, other metrics still render
  assert.ok(html.includes('tree-card-reaction-metric'), 'available metrics should render');
});

test('card runtime: only available metrics render (truthful; no unknown→0)', () => {
  const renderer = getRenderer();
  const tree = buildTree({ likeCount: 7 });
  delete tree.viewCount;
  delete tree.commentCount;
  delete tree.shareCount;
  const html = renderer.renderTreeCard(tree, 0);
  assert.ok(html && html.length > 0, 'renderTreeCard should return non-empty HTML');
  // likeCount 7 should be present
  assert.ok(html.match(/\b7\b/), 'like count 7 must be rendered');
});

test('card runtime: likeCount 0 is shown; missing likeCount is hidden', () => {
  const renderer = getRenderer();
  const zeroHtml = renderer.renderTreeCard(buildTree({ likeCount: 0, viewCount: 1, commentCount: 0, shareCount: 0 }), 0);
  assert.ok(zeroHtml && zeroHtml.length > 0, 'renderTreeCard should return non-empty HTML');
  // likeCount 0 renders
  assert.ok(zeroHtml.includes('tree-card-reaction-metric'), 'persisted zero likes must show metric');

  const missing = buildTree({ viewCount: 1 });
  delete missing.likeCount;
  const missingHtml = renderer.renderTreeCard(missing, 0);
  assert.ok(missingHtml && missingHtml.length > 0, 'renderTreeCard should return non-empty HTML');
  // When likeCount is missing, viewCount metric should still show
});
