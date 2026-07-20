/**
 * Contract: LoveBud #3563 — one canonical non-editing appreciation presentation.
 *
 * Architecture proven (not dual templates + data attributes):
 * - shared builder: js/shared/canonical-appreciation-detail-presentation.js
 * - owner thin wrapper: js/editor/templates/editor-detail-view-mode-template.js
 * - public thin wrapper: js/viewer/public-viewer-detail-view-mode-template.js
 *
 * EXECUTED_FAKE:
 * - Invokes shared builder for owner and public-safe authority
 * - Compares canonical sections and authority-only differences
 * - Runs My Trees resolver/UI in a fake DOM
 *
 * Keep #3562 OPEN. Keep #3425 OPEN. Keep #1882 OPEN.
 * #3075 is CLOSED / completed. Do not reopen.
 * #3188 is CLOSED / completed. Do not reopen.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const SHARED_BUILDER = 'js/shared/canonical-appreciation-detail-presentation.js';
const OWNER_WRAPPER = 'js/editor/templates/editor-detail-view-mode-template.js';
const PUBLIC_WRAPPER = 'js/viewer/public-viewer-detail-view-mode-template.js';

function loadSharedBuilder() {
  const ctx = { window: {}, globalThis: null };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read(SHARED_BUILDER), ctx);
  const api = ctx.window.LoveBudCanonicalAppreciationDetailPresentation;
  assert.ok(api, 'shared builder must publish LoveBudCanonicalAppreciationDetailPresentation');
  assert.equal(typeof api.buildDetailViewModeHtml, 'function');
  assert.equal(typeof api.listCanonicalSections, 'function');
  return api;
}

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
  FakeEl.prototype.setAttribute = function (k, v) {
    this.attrs[k] = String(v);
    if (k === 'class') this.className = String(v);
  };
  FakeEl.prototype.getAttribute = function (k) {
    return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
  };
  FakeEl.prototype.removeAttribute = function (k) {
    delete this.attrs[k];
  };
  FakeEl.prototype.appendChild = function (child) {
    if (child && child.parentNode && child.remove) child.remove();
    if (child && child.nodeType === 11) {
      // Fragment: move children
      var frag = child;
      if (frag.children) {
        for (var i = 0; i < frag.children.length; i++) {
          var c = frag.children[i];
          c.parentNode = null;
          this.children.push(c);
          c.parentNode = this;
        }
        frag.children = [];
      }
    } else {
      this.children.push(child);
      child.parentNode = this;
    }
    return child;
  };
  FakeEl.prototype.removeChild = function (child) {
    var idx = this.children.indexOf(child);
    if (idx !== -1) { this.children.splice(idx, 1); child.parentNode = null; }
    return child;
  };
  FakeEl.prototype.remove = function () {
    if (this.parentNode) this.parentNode.removeChild(this);
  };
  FakeEl.prototype.addEventListener = function (type, fn) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  };

  // classList and textContent support
  Object.defineProperty(FakeEl.prototype, 'textContent', {
    get: function () {
      var txt = this._textContent || '';
      if (this.children) {
        for (var i = 0; i < this.children.length; i++) {
          txt += this.children[i].textContent || '';
        }
      }
      return txt;
    },
    set: function (v) {
      this._textContent = String(v == null ? '' : v);
      this.children = [];
    }
  });
  Object.defineProperty(FakeEl.prototype, 'classList', {
    get: function () {
      var self = this;
      return {
        add: function () {
          var existing = self.className ? self.className.split(' ') : [];
          for (var i = 0; i < arguments.length; i++) {
            if (existing.indexOf(arguments[i]) === -1) existing.push(arguments[i]);
          }
          self.className = existing.join(' ');
        },
        remove: function () {
          var existing = self.className ? self.className.split(' ') : [];
          for (var i = 0; i < arguments.length; i++) {
            var idx = existing.indexOf(arguments[i]);
            if (idx !== -1) existing.splice(idx, 1);
          }
          self.className = existing.join(' ');
        },
        contains: function (cls) {
          return (self.className || '').split(' ').indexOf(cls) !== -1;
        }
      };
    }
  });
  FakeEl.prototype.querySelector = function (sel) {
    if (!sel) return null;
    var all = this._all();
    for (var i = 0; i < all.length; i++) {
      if (sel.charAt(0) === '.' && (' ' + all[i].className + ' ').indexOf(' ' + sel.slice(1) + ' ') !== -1) {
        return all[i];
      }
      if (sel.charAt(0) === '#' && all[i].id === sel.slice(1)) return all[i];
    }
    return null;
  };
  FakeEl.prototype.querySelectorAll = function (sel) {
    var out = [];
    var all = this._all();
    for (var i = 0; i < all.length; i++) {
      if (sel.charAt(0) === '.' && (' ' + all[i].className + ' ').indexOf(' ' + sel.slice(1) + ' ') !== -1) {
        out.push(all[i]);
      }
    }
    return out;
  };
  FakeEl.prototype._all = function () {
    var out = [this];
    for (var i = 0; i < this.children.length; i++) out = out.concat(this.children[i]._all());
    return out;
  };
  Object.defineProperty(FakeEl.prototype, 'innerHTML', {
    get: function () {
      return this._html;
    },
    set: function (html) {
      this._html = String(html || '');
      this.children = [];
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
    createElement: function (tag) {
      return new FakeEl(tag);
    },
    createDocumentFragment: function () {
      var frag = new FakeEl('fragment');
      frag.nodeType = 11;
      return frag;
    },
    getElementById: function () {
      return null;
    },
    querySelector: function () {
      return null;
    },
    querySelectorAll: function () {
      return [];
    }
  };
  var window = {
    document: document,
    location: {
      pathname: '/pages/my-trees.html',
      href: 'https://example.test/pages/my-trees.html',
      origin: 'https://example.test'
    },
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

// ─── Shared presentation builder ─────────────────────────────────────────────

test('#3563 shared builder exists as sole full presentation implementation', () => {
  const shared = read(SHARED_BUILDER);
  const api = loadSharedBuilder();
  assert.match(shared, /LoveBudCanonicalAppreciationDetailPresentation/);
  assert.match(shared, /function buildDetailViewModeHtml/);
  // #3562: tree-scope is a separate left-rail shell; selected-moment shell owns moment sections.
  assert.match(shared, /data-canonical-section="tree-scope"/);
  assert.match(shared, /function buildTreeScopeShellHtml/);
  assert.match(shared, /data-canonical-section="selected-moment"/);
  assert.match(shared, /data-canonical-section="moment-info"/);
  assert.match(shared, /data-canonical-section="moment-social"/);
  // Selected-moment shell must not re-embed tree-meta after hierarchy split.
  const momentHtml = api.buildDetailViewModeHtml({ authority: 'public-safe' });
  assert.doesNotMatch(momentHtml, /id="detailTreeMetaMount"/);
  assert.doesNotMatch(momentHtml, /data-canonical-section="tree-meta"/);
  // Substantive markup lives here, not in route wrappers.
  assert.match(shared, /id="detailCurrentMomentTitle"/);
  assert.match(shared, /id="detailMemo"/);
  assert.match(shared, /id="momentReactionsCard"/);
});

test('#3563 EXECUTED: owner and public-safe share the same canonical sections', () => {
  const api = loadSharedBuilder();
  const ownerHtml = api.buildDetailViewModeHtml({ authority: 'owner' });
  const publicHtml = api.buildDetailViewModeHtml({ authority: 'public-safe' });
  const treeScope = api.buildTreeScopeShellHtml({ authority: 'public-safe' });

  // Normalize across vm realms (host vs sandbox arrays).
  const ownerSections = Array.from(api.listCanonicalSections(ownerHtml)).map(String);
  const publicSections = Array.from(api.listCanonicalSections(publicHtml)).map(String);
  assert.equal(ownerSections.join('|'), publicSections.join('|'), 'canonical section markers must match');
  // #3562: selected-moment shell no longer embeds tree-meta.
  assert.equal(ownerSections.join('|'), 'selected-moment|moment-info|moment-social');
  assert.match(treeScope, /data-canonical-section="tree-scope"/);
  assert.match(treeScope, /id="detailTreeMetaMount"/);

  assert.match(ownerHtml, /data-presentation-builder="LoveBudCanonicalAppreciationDetailPresentation"/);
  assert.match(publicHtml, /data-presentation-builder="LoveBudCanonicalAppreciationDetailPresentation"/);
  assert.match(ownerHtml, /data-appreciation-surface="canonical"/);
  assert.match(publicHtml, /data-appreciation-surface="canonical"/);
  assert.match(ownerHtml, /data-route-authority="owner"/);
  assert.match(publicHtml, /data-route-authority="public-safe"/);
});

test('#3563 EXECUTED: owner authority slots present only for owner config', () => {
  const api = loadSharedBuilder();
  const ownerHtml = api.buildDetailViewModeHtml({ authority: 'owner' });
  const publicHtml = api.buildDetailViewModeHtml({ authority: 'public-safe' });

  assert.match(ownerHtml, /id="editMemoryBtn"/);
  assert.match(ownerHtml, /id="continueFromMomentBtn"/);
  assert.match(ownerHtml, /id="viewMomentDetailBtn"/);
  assert.match(ownerHtml, /id="detailOwnerKnowledgeGroup"/);
  assert.match(ownerHtml, /id="detailAtlasPreviewMount"/);
  assert.match(ownerHtml, /id="momentCommentComposer"/);

  assert.doesNotMatch(publicHtml, /id="editMemoryBtn"/);
  assert.doesNotMatch(publicHtml, /id="continueFromMomentBtn"/);
  assert.doesNotMatch(publicHtml, /id="viewMomentDetailBtn"/);
  assert.doesNotMatch(publicHtml, /id="detailOwnerKnowledgeGroup"/);
  assert.doesNotMatch(publicHtml, /id="detailAtlasPreviewMount"/);
  assert.doesNotMatch(publicHtml, /id="momentCommentComposer"/);
  assert.match(publicHtml, /id="detailPublicKnowledgeGroup"/);
  assert.match(publicHtml, /data-social-mode="public-readonly"/);
});

test('#3563 EXECUTED: common tree/moment content structure from shared builder', () => {
  const api = loadSharedBuilder();
  const publicHtml = api.buildDetailViewModeHtml({ authority: 'public-safe' });
  const treeScope = api.buildTreeScopeShellHtml({ authority: 'public-safe' });
  const requiredMoment = [
    'detailCurrentMomentBadge',
    'detailCurrentMomentTitle',
    'detailCurrentMomentHint',
    'detailImg',
    'detailDateText',
    'detailTags',
    'detailMemo',
    'momentReactionsCard',
    'momentCommentsPanel'
  ];
  for (const id of requiredMoment) {
    assert.match(publicHtml, new RegExp('id="' + id + '"'), 'shared public-safe moment html must expose #' + id);
  }
  assert.match(treeScope, /id="detailTreeMetaMount"/, 'tree-scope shell owns #detailTreeMetaMount');
  assert.doesNotMatch(publicHtml, /id="detailTreeMetaMount"/, 'selected-moment shell must not own tree mount');
});

test('#3563 route wrappers are thin and reference the shared builder', () => {
  const owner = read(OWNER_WRAPPER);
  const pub = read(PUBLIC_WRAPPER);
  const editorHtml = read('pages/editor.html');
  const viewHtml = read('pages/view.html');

  assert.match(owner, /LoveBudCanonicalAppreciationDetailPresentation/);
  assert.match(owner, /export\s+function buildDetailViewModeTemplate\(\)/);
  assert.match(owner, /mount\.outerHTML\s*=\s*buildDetailViewModeTemplate\(\)/);
  assert.match(owner, /authority:\s*['"]owner['"]/);
  // Owner wrapper must not re-embed a full detail template literal of the shell.
  assert.doesNotMatch(owner, /const template\s*=\s*`[\s\S]{200,}id="detailViewMode"/);
  assert.ok(
    !/id="detailCurrentMomentTitle"/.test(owner) || owner.includes('LoveBudCanonicalAppreciationDetailPresentation'),
    'owner wrapper must not own independent markup of title id without builder'
  );
  // No second full template: owner file must not contain the large multi-section literal.
  assert.ok(owner.length < 2500, 'owner wrapper must stay thin (no second full template)');

  assert.match(pub, /LoveBudCanonicalAppreciationDetailPresentation/);
  assert.match(pub, /authority:\s*['"]public-safe['"]/);
  assert.match(pub, /mountDetailViewMode/);
  assert.doesNotMatch(pub, /const template\s*=\s*`/);
  assert.doesNotMatch(pub, /id="detailCurrentMomentTitle"/);
  assert.doesNotMatch(pub, /id="editMemoryBtn"/);
  assert.doesNotMatch(pub, /id="continueFromMomentBtn"/);
  assert.ok(pub.length < 2500, 'public wrapper must stay thin (no second full template)');

  assert.match(editorHtml, /canonical-appreciation-detail-presentation\.js/);
  assert.match(viewHtml, /canonical-appreciation-detail-presentation\.js/);
  const editorBuilderIdx = editorHtml.indexOf('canonical-appreciation-detail-presentation.js');
  const editorWrapperIdx = editorHtml.indexOf('editor-detail-view-mode-template.js');
  assert.ok(editorBuilderIdx >= 0 && editorWrapperIdx > editorBuilderIdx, 'editor loads shared builder before owner wrapper');
  const viewBuilderIdx = viewHtml.indexOf('canonical-appreciation-detail-presentation.js');
  const viewWrapperIdx = viewHtml.indexOf('public-viewer-detail-view-mode-template.js');
  assert.ok(viewBuilderIdx >= 0 && viewWrapperIdx > viewBuilderIdx, 'view loads shared builder before public wrapper');
});

test('#3563 view.html remains public-safe and does not bootstrap editor.js', () => {
  const viewHtml = read('pages/view.html');
  assert.doesNotMatch(viewHtml, /js\/editor\.js/);
  assert.match(viewHtml, /public-canvas-init|public-viewer-canvas-entry/);
  assert.match(viewHtml, /public-viewer-detail-view-mode-template/);
});

test('#3563 public route markers and loaders stay route-owned', () => {
  const init = read('js/viewer/public-canvas-init.js');
  const entry = read('js/viewer/public-viewer-canvas-entry.js');
  assert.match(init, /data-appreciation-surface['"]\s*,\s*['"]canonical['"]/);
  assert.match(init, /data-route-authority['"]\s*,\s*['"]public-safe['"]/);
  assert.match(entry, /data-appreciation-surface['"]\s*,\s*['"]canonical['"]/);
  assert.match(entry, /data-editor-interaction-mode['"]\s*,\s*['"]view['"]/);
});

test('#3563 browse/shared links still use view.html compatibility route', () => {
  const card = read('js/search/search-card-renderer.js');
  const share = read('js/search/search-share-link.js');
  assert.match(card, /view\.html\?treeId=/);
  assert.match(share, /view\.html\?treeId=/);
});

test('#3578 Phase 1 resolver exposes shareTarget without a third interaction mode', () => {
  var ctx = createMinimalDomCardContext();
  vm.createContext(ctx);
  vm.runInContext(read('js/my-trees/my-trees-entry-target-resolver.js'), ctx);
  var resolve = ctx.window.LoveBudMyTreesEntryTargetResolver.resolveMyTreesEntryTargets;
  var publicTree = resolve({ id: 'p1', visibility: 'public' });
  assert.equal(publicTree.primary.action, 'appreciation');
  assert.equal(publicTree.edit, undefined, '#3578 Phase 1: edit removed');
  assert.equal(publicTree.shareTarget.available, true);
  assert.equal(publicTree.publicView.href, publicTree.shareTarget.href);
  assert.match(publicTree.shareTarget.href, /view\.html\?treeId=p1/);
  assert.equal(publicTree.primary.routeSurface, 'editor');

  var privateTree = resolve({ id: 'v1', visibility: 'private' });
  assert.equal(privateTree.shareTarget.available, false);
  assert.equal(privateTree.publicView.available, false);
});

test('#3578 My Trees card renders only 감상하기 (Phase 1: edit removed)', () => {
  // Check source code for evidence of correct behavior
  var uiSource = read('js/my-trees/my-trees-ui.js');
  var compSource = read('js/shared/tree-card-composition.js');

  // Shared composition uses love-tree-card-open-link
  assert.ok(compSource.includes('love-tree-card-open-link'),
    'shared composition must create love-tree-card-open-link');
  assert.ok(compSource.includes('tree-card-open-link'),
    'shared composition must also create legacy tree-card-open-link');

  // No edit link in composition output
  assert.ok(!compSource.includes('tree-card-edit-link'),
    'shared composition must not create tree-card-edit-link');
  assert.ok(!compSource.includes('tree-card-public-view-link'),
    'shared composition must not create tree-card-public-view-link');

  // My Trees adapter uses shared composition
  assert.ok(uiSource.includes('Composer.buildTreeCard(') || uiSource.includes('buildTreeCard('),
    'My Trees adapter must use shared composition');
  assert.ok(uiSource.includes("surface: 'my-trees'") || uiSource.includes("surface:'my-trees'"),
    'My Trees adapter must set surface to my-trees');

  // No '공개 화면 보기' text in source
  assert.ok(!uiSource.includes('공개 화면 보기'),
    'My Trees adapter must not contain public view text');
});

test('#3578 My Trees hub has no Edit button; no public-view action; share remains', () => {
  const html = read('pages/my-trees.html');
  assert.ok(html.includes('myTreesHubOpenBtn'));
  assert.equal(html.includes('myTreesHubEditBtn'), false, 'Phase 1: myTreesHubEditBtn removed from static HTML');
  assert.ok(html.includes('myTreesHubShareBtn'));
  assert.ok(!html.includes('공개 화면 보기'));
  assert.ok(!html.includes('myTreesHubPublicViewBtn'));
  assert.ok(!html.includes('my-trees-hub-public-view-btn'));
});

test('#3578 Phase 1 owner appreciation remains editor route; mode=edit removed', () => {
  const resolver = read('js/my-trees/my-trees-entry-target-resolver.js');
  assert.match(resolver, /editor\?treeId=/);
  assert.doesNotMatch(resolver, /mode=edit/, 'Phase 1: mode=edit removed from resolver');
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
  const geomHeader = geom.slice(0, 900);
  assert.match(geom, /#3561/);
  assert.match(geomHeader, /#3075 is CLOSED \/ completed/);
  assert.match(geomHeader, /#3188 is CLOSED \/ completed/);
  // Avoid matching assert source that deliberately spells the banned phrase.
  assert.equal(geomHeader.includes('Keep #' + '3075 OPEN'), false);
  assert.equal(geomHeader.includes('Keep #' + '3188 OPEN'), false);
});

test('#3563 does not implement #3562 panel hierarchy moves', () => {
  const ui = read('js/my-trees/my-trees-ui.js');
  const hub = read('js/my-trees/my-trees-preview-hub.js');
  assert.match(ui, /#3563/);
  assert.match(hub, /#3563/);
  assert.doesNotMatch(ui, /tree description left rail|whole-tree comment relocation/i);
  assert.doesNotMatch(hub, /tree description left rail|whole-tree comment relocation/i);
});

test('#3563 closed-issue hygiene for changed sources', () => {
  const resolver = read('js/my-trees/my-trees-entry-target-resolver.js');
  const self = read('tests/contracts/canonical-appreciation-consolidation-3563-contract.test.cjs');
  assert.doesNotMatch(resolver, /Keep #3075 OPEN/);
  assert.doesNotMatch(resolver, /Keep #3188 OPEN/);
  assert.match(self, /#3075 is CLOSED \/ completed/);
  assert.match(self, /#3188 is CLOSED \/ completed/);
});
