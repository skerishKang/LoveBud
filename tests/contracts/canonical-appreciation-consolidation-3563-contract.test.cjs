/**
 * Contract: LoveBud #3563 — remove duplicate Public Viewer product surface;
 * canonical appreciation is the sole non-editing LoveTree experience.
 *
 * EXECUTED_FAKE + SOURCE_STATIC hybrid:
 * - Runs My Trees resolver/UI in a fake DOM
 * - Asserts two-action interaction model + internal shareTarget
 * - Asserts public route marks canonical appreciation without owner authority
 * - Asserts #3564 geometry guard remains
 *
 * Keep #3562 OPEN. Keep #3425 OPEN. Keep #1882 OPEN.
 * #3075 CLOSED / completed. #3188 CLOSED / completed. Do not reopen.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function createMinimalDomCardContext() {
  function FakeEl(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.attrs = {};
    this.className = '';
    this.style = {};
    this.dataset = {};
    this.hidden = false;
    this._html = '';
    this.onclick = null;
    this.listeners = {};
  }
  FakeEl.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); };
  FakeEl.prototype.getAttribute = function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; };
  FakeEl.prototype.removeAttribute = function (k) { delete this.attrs[k]; };
  FakeEl.prototype.addEventListener = function (type, fn) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  };
  FakeEl.prototype.querySelector = function (sel) {
    if (!sel) return null;
    var all = this._all();
    for (var i = 0; i < all.length; i++) {
      if (sel.charAt(0) === '.' && (' ' + all[i].className + ' ').indexOf(' ' + sel.slice(1) + ' ') !== -1) return all[i];
      if (sel.charAt(0) === '#' && all[i].id === sel.slice(1)) return all[i];
    }
    return null;
  };
  FakeEl.prototype.querySelectorAll = function (sel) {
    var out = [];
    var all = this._all();
    for (var i = 0; i < all.length; i++) {
      if (sel.charAt(0) === '.' && (' ' + all[i].className + ' ').indexOf(' ' + sel.slice(1) + ' ') !== -1) out.push(all[i]);
    }
    return out;
  };
  FakeEl.prototype._all = function () {
    var out = [this];
    for (var i = 0; i < this.children.length; i++) out = out.concat(this.children[i]._all());
    return out;
  };
  Object.defineProperty(FakeEl.prototype, 'innerHTML', {
    get: function () { return this._html; },
    set: function (html) {
      this._html = String(html || '');
      this.children = [];
      // very small class/href extractor for anchors used by tests
      var re = /<a\b([^>]*)>/gi;
      var m;
      while ((m = re.exec(this._html))) {
        var attrs = m[1];
        var el = new FakeEl('a');
        var classMatch = attrs.match(/class="([^"]*)"/);
        var hrefMatch = attrs.match(/href="([^"]*)"/);
        if (classMatch) el.className = classMatch[1];
        if (hrefMatch) el.setAttribute('href', hrefMatch[1]);
        this.children.push(el);
      }
    }
  });

  var document = {
    body: new FakeEl('body'),
    createElement: function (tag) { return new FakeEl(tag); },
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };
  var window = {
    document: document,
    location: { pathname: '/pages/my-trees.html', href: 'https://example.test/pages/my-trees.html', origin: 'https://example.test' },
    innerWidth: 1280,
    LoveBudMyTreesUtils: {
      escapeHtml: function (s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }
    }
  };
  document.defaultView = window;
  return { window: window, document: document };
}

test('#3563 resolver exposes shareTarget without making it a third interaction mode', () => {
  var ctx = createMinimalDomCardContext();
  vm.createContext(ctx);
  vm.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  var resolve = ctx.window.LoveBudMyTreesEntryTargetResolver.resolveMyTreesEntryTargets;
  var publicTree = resolve({ id: 'p1', visibility: 'public' });
  assert.equal(publicTree.primary.action, 'appreciation');
  assert.equal(publicTree.edit.action, 'edit');
  assert.equal(publicTree.shareTarget.available, true);
  assert.equal(publicTree.publicView.href, publicTree.shareTarget.href);
  assert.match(publicTree.shareTarget.href, /view\.html\?treeId=p1/);
  assert.equal(publicTree.primary.routeSurface, 'editor');
  assert.equal(publicTree.edit.routeSurface, 'editor');

  var privateTree = resolve({ id: 'v1', visibility: 'private' });
  assert.equal(privateTree.shareTarget.available, false);
  assert.equal(privateTree.publicView.available, false);
});

test('#3563 My Trees card renders only 감상하기 and 편집하기', () => {
  var ctx = createMinimalDomCardContext();
  vm.createContext(ctx);
  vm.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  vm.runInContext(read('js/my-trees/my-trees-ui.js'), ctx);
  var UI = ctx.window.LoveBudMyTreesUI;
  var card = UI.buildTreeCard({ id: 't1', visibility: 'public', title: 'T' }, { i18n: function () { return ''; } });
  assert.ok(card.querySelector('.tree-card-open-link'));
  assert.ok(card.querySelector('.tree-card-edit-link'));
  assert.equal(card.querySelector('.tree-card-public-view-link'), null);
  assert.ok(card.innerHTML.indexOf('공개 화면 보기') === -1);
});

test('#3563 public hub HTML no longer presents public-view as an action label', () => {
  const html = read('pages/my-trees.html');
  assert.ok(html.includes('myTreesHubOpenBtn'));
  assert.ok(html.includes('myTreesHubEditBtn'));
  assert.ok(html.includes('myTreesHubShareBtn'));
  assert.ok(!html.includes('공개 화면 보기'));
});

test('#3563 public route marks canonical appreciation authority surface', () => {
  const init = read('js/viewer/public-canvas-init.js');
  const entry = read('js/viewer/public-viewer-canvas-entry.js');
  assert.match(init, /data-appreciation-surface['"]\s*,\s*['"]canonical['"]/);
  assert.match(init, /data-route-authority['"]\s*,\s*['"]public-safe['"]/);
  assert.match(entry, /data-appreciation-surface['"]\s*,\s*['"]canonical['"]/);
  assert.match(entry, /data-editor-interaction-mode['"]\s*,\s*['"]view['"]/);
});

test('#3563 public detail template is canonical appreciation shell without owner chips', () => {
  const tpl = read('js/viewer/public-viewer-detail-view-mode-template.js');
  assert.match(tpl, /data-appreciation-surface="canonical"/);
  assert.match(tpl, /data-route-authority="public-safe"/);
  assert.match(tpl, /detailCurrentMomentTitle/);
  assert.match(tpl, /detailMemo/);
  assert.match(tpl, /momentReactionsCard/);
  assert.doesNotMatch(tpl, /id="editMemoryBtn"/);
  assert.doesNotMatch(tpl, /id="continueFromMomentBtn"/);
  assert.doesNotMatch(tpl, /id="viewMomentDetailBtn"/);
});

test('#3563 browse/shared links still use view.html compatibility route', () => {
  const card = read('js/search/search-card-renderer.js');
  const share = read('js/search/search-share-link.js');
  assert.match(card, /view\.html\?treeId=/);
  assert.match(share, /view\.html\?treeId=/);
});

test('#3563 owner appreciation remains editor route (not guest bootstrap)', () => {
  const resolver = read('js/my-trees/my-trees-entry-target-resolver.js');
  assert.match(resolver, /editor\?treeId=/);
  assert.match(resolver, /mode=edit/);
  // Guests must not be forced into editor.js.
  assert.match(resolver, /view\.html\?treeId=/);
});

test('#3564 geometry guard remains (no transform:none on structured hover)', () => {
  const css = read('css/editor/editor-memory-node.css');
  assert.doesNotMatch(
    css,
    /\.layout-structured\s+\.memory-node:hover\s*\{[^}]*transform:\s*none\s*!important/i
  );
  assert.match(css, /min-width:\s*108px/);
  const geom = read('tests/contracts/viewer-moment-card-geometry-3561-contract.test.cjs');
  assert.match(geom, /#3561/);
});

test('#3563 does not implement #3562 panel hierarchy moves', () => {
  // Soft scope guard: changed product files must not claim #3562 layout work.
  const ui = read('js/my-trees/my-trees-ui.js');
  const hub = read('js/my-trees/my-trees-preview-hub.js');
  assert.match(ui, /#3563/);
  assert.match(hub, /#3563/);
  assert.doesNotMatch(ui, /tree description left rail|whole-tree comment relocation/i);
  assert.doesNotMatch(hub, /tree description left rail|whole-tree comment relocation/i);
});

test('#3563 closed-issue hygiene for changed sources', () => {
  const resolver = read('js/my-trees/my-trees-entry-target-resolver.js');
  assert.doesNotMatch(resolver, /Keep #3075 OPEN/);
  assert.doesNotMatch(resolver, /Keep #3188 OPEN/);
});
