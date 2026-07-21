const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('display/edit mode static constraints', () => {
  const searchHelper = read('js/search/search-preview-action-helper.js');
  const previewHub = read('js/my-trees/my-trees-preview-hub.js');
  const treeMeta = read('js/viewer/public-viewer-detail-tree-meta.js');
  const myTreesUi = read('js/my-trees/my-trees-ui.js');
  const cardEvents = read('js/my-trees/my-trees-card-events.js');

  // 1. Browse renderOpenTreeButton() uses view.html?treeId=
  assert.match(searchHelper, /view\.html\?treeId=/);

  // 4. My LoveTree copy uses 감상하기 only (#3563/#3578: edit removed from card/hub)
  assert.match(previewHub, /'감상하기'/);
  assert.doesNotMatch(previewHub, /'편집하기'/, 'Hub must not contain edit copy (#3578)');
  assert.doesNotMatch(previewHub, /publicViewBtn\.hidden = false/);
  assert.match(myTreesUi, /'감상하기'/);
  assert.doesNotMatch(myTreesUi, /'편집하기'/, 'Card UI must not contain edit copy (#3578)');
  assert.doesNotMatch(myTreesUi, /tree-card-public-view-link/);

  // 4b. #3578 Phase 1: direct Edit DOM must be absent from card and hub
  assert.doesNotMatch(myTreesUi, /tree-card-edit-link/, 'Card must not render edit link (#3578)');
  assert.doesNotMatch(previewHub, /my-trees-hub-edit-btn/, 'Hub must not render edit button (#3578)');

  // 5. Raw ownerId/user ID must not be directly displayed in UI text
  assert.doesNotMatch(treeMeta, /\.textContent\s*=\s*(currentTree\.)?ownerId/);
  assert.doesNotMatch(treeMeta, /\.innerHTML\s*=\s*(currentTree\.)?ownerId/);
  assert.doesNotMatch(treeMeta, /\.textContent\s*=\s*owner_id/);

  // 6. Existing view.html path remains intact
  const viewHtml = read('pages/view.html');
  assert.match(viewHtml, /public-viewer-detail-tree-meta\.js/);
});

test('public-viewer-detail-tree-meta no longer creates edit buttons', () => {
  const metaSource = read('js/viewer/public-viewer-detail-tree-meta.js');

  function createMockElement(tagName = 'div') {
    const children = [];
    return {
      tagName: tagName.toUpperCase(),
      style: {},
      children,
      appendChild(c) { children.push(c); },
      replaceChildren() { children.length = 0; },
      addEventListener() {}
    };
  }

  const context = {
    window: {},
    document: {
      createElement(tag) { return createMockElement(tag); },
      createTextNode(txt) { return { text: txt }; }
    },
    location: {
      pathname: '/pages/view.html',
      origin: 'http://localhost'
    }
  };
  context.window = context;

  vm.createContext(context);
  vm.runInContext(metaSource, context);

  const factory = context.createPublicViewerDetailTreeMetaBoundary || context.window.createPublicViewerDetailTreeMetaBoundary;
  assert.ok(typeof factory === 'function', 'Factory should be defined on window');

  const deps = {
    i18n: (k) => k,
    formatI18nText: (k, fallback) => fallback,
    resolveTreeTitleText: (t) => t || 'LoveTree',
    createInlineIcon: () => createMockElement('span'),
    showToast: () => {}
  };

  const boundary = factory(deps);

  // Case A: Owner context - editButtonEl must NOT exist
  const modelA = boundary.buildTreeMetaRenderModel({
    currentTree: { id: 'tree-1', title: 'My Tree', ownerId: 'user-owner' },
    treeState: { totalMomentCount: 5, hasMoments: true },
    data: { id: 'tree-1' },
    isEmptyState: false,
    localSaveMode: false
  });

  assert.equal(modelA.editButtonEl, undefined, 'Owner edit CTA removed: editButtonEl must not exist');
  assert.equal(modelA.editBtn, undefined, 'Owner edit CTA removed: editBtn must not exist');

  // Case B: Non-owner context - editButtonEl must NOT exist
  const modelB = boundary.buildTreeMetaRenderModel({
    currentTree: { id: 'tree-1', title: 'My Tree', ownerId: 'user-other' },
    treeState: { totalMomentCount: 5, hasMoments: true },
    data: { id: 'tree-1' },
    isEmptyState: false,
    localSaveMode: false
  });

  assert.equal(modelB.editButtonEl, undefined, 'Non-owner edit CTA also absent');
});

test('public-viewer-detail-tree-meta no longer has async owner verification or auth callback injection', async () => {
  const metaSource = read('js/viewer/public-viewer-detail-tree-meta.js');

  // Source-level assertions: dynamic injection and auth callback are removed
  assert.equal(metaSource.indexOf('vv-edit-btn-dynamic'), -1, 'vv-edit-btn-dynamic class must be removed');
  assert.equal(metaSource.indexOf('registerOnAuthReady'), -1, 'registerOnAuthReady must be removed');
  assert.equal(metaSource.indexOf("apiFetch('/trees/"), -1, 'apiFetch(/trees/) dynamic re-fetch must be removed');
});

test('My LoveTrees routing contract for public and private trees', () => {
  const resolverSource = read('js/my-trees/my-trees-entry-target-resolver.js');
  const uiSource = read('js/my-trees/my-trees-ui.js');
  const eventsSource = read('js/my-trees/my-trees-card-events.js');

  function createMockElement(tagName = 'div') {
    const attrs = {};
    const dataset = {};
    const listeners = {};
    const children = [];
    const innerStates = { hidden: false, innerHTML: '' };
    return {
      tagName: tagName.toUpperCase(),
      style: {},
      attrs,
      dataset,
      listeners,
      children,
      hidden: false,
      innerHTML: '',
      setAttribute(k, v) { attrs[k] = v; },
      getAttribute(k) { return attrs[k] !== undefined ? attrs[k] : null; },
      removeAttribute(k) { delete attrs[k]; },
      addEventListener(name, fn) {
        if (!listeners[name]) listeners[name] = [];
        listeners[name].push(fn);
      },
      cloneNode(deep) {
        const clone = createMockElement(tagName);
        clone.attrs = Object.assign({}, attrs);
        clone.dataset = Object.assign({}, dataset);
        clone.hidden = this.hidden;
        clone.innerHTML = this.innerHTML;
        return clone;
      },
      appendChild(c) { children.push(c); },
      replaceChildren() { children.length = 0; },
      querySelector(sel) { return null; },
      closest() { return null; }
    };
  }

  // Production browser always provides the URL constructor and a complete
  // location object. The VM sandbox must supply Production-equivalent globals
  // so toSameOriginAbsoluteUrl() can resolve relative appreciation targets.
  const context = {
    window: {},
    // Bare `new URL(...)` in production code resolves the global URL.
    URL: URL,
    document: {
      createElement(tag) { return createMockElement(tag); },
      createTextNode(txt) { return { text: txt }; },
      createDocumentFragment() { return { nodeType: 11, children: [], appendChild(c) { this.children.push(c); return c; } }; },
      getElementById() { return createMockElement('div'); }
    },
    LoveBudPath: {
      // Under /pages/* LoveBudPath.getBasePath() returns '' (not 'pages/').
      getBasePath() { return ''; }
    },
    LoveTreeBaseApiFetch: {
      getCachedTokenRecord() { return null; }
    },
    // #3578 Phase 2: shared composition mock
    LoveBudTreeCardComposition: {
      buildTreeCard: function (tree, opts) {
        var el = createMockElement('div');
        el.className = 'love-tree-card love-tree-card-my-trees';
        if (tree.id) el.dataset.treeId = tree.id;
        if (opts.accessibilityLabel) el.setAttribute('aria-label', opts.accessibilityLabel);
        if (tree.visibility) el.dataset.visibility = tree.visibility;
        // Build inner HTML for test assertions (href extraction via regex)
        var inner = '';
        if (opts.mediaHtml) inner += opts.mediaHtml;
        inner += '<div class="love-tree-card-body">';
        inner += '<div class="love-tree-card-title-row">';
        inner += '<div class="love-tree-card-title">' + (opts.title || '') + '</div>';
        if (opts.visibilityBadgeHtml) inner += opts.visibilityBadgeHtml;
        inner += '</div>';
        if (opts.subtitleHtml) inner += '<div class="love-tree-card-subtitle">' + opts.subtitleHtml + '</div>';
        inner += '<div class="love-tree-card-meta-row">';
        inner += '<div class="love-tree-card-meta-left">' + (opts.metricsHtml || '') + '</div>';
        if (opts.primaryHref) {
          inner += '<div class="love-tree-card-meta-right"><a class="tree-card-open-link love-tree-card-open-link" href="' + opts.primaryHref + '">' + (opts.primaryLabel || '') + '</a></div>';
        }
        inner += '</div></div></div>';
        el.innerHTML = inner;
        el._innerHTML = inner;
        return el;
      }
    },
    LoveBudTreeCardMetrics: {
      getTreeMetrics: function () { return {}; },
      getFirstFiniteCount: function (tree, keys) {
        if (!tree) return null;
        for (var i = 0; i < keys.length; i++) {
          var raw = tree[keys[i]];
          if (raw === undefined || raw === null || raw === '') continue;
          var val = Number(raw);
          if (Number.isFinite(val) && val >= 0) return val;
        }
        return null;
      }
    },
    location: {
      href: 'https://lovebud.test/pages/my-trees.html',
      pathname: '/pages/my-trees.html',
      origin: 'https://lovebud.test'
    }
  };
  context.window = context;

  vm.createContext(context);
  vm.runInContext(resolverSource, context);
  vm.runInContext(uiSource, context);
  vm.runInContext(eventsSource, context);

  const UI = context.window.LoveBudMyTreesUI || context.LoveBudMyTreesUI;
  assert.ok(UI && typeof UI.buildTreeCard === 'function');

  const i18n = (k) => k;

  /* ── Public tree: primary → editor (appreciation) ── */
  const publicCard = UI.buildTreeCard({
    id: 'tree-public-1',
    title: 'Public Tree',
    visibility: 'public',
    stage: 0
  }, { i18n });

  // Note: mock DOM stores innerHTML as string without parsing child elements.
  // We extract the href from each <a> tag using a regex that matches the full tag.
  var html = publicCard.innerHTML;

  function getLinkHref(html, className) {
    var m = html.match(new RegExp('<a[^>]*class="[^"]*' + className + '[^"]*"[^>]*href="([^"]*)"'));
    return m ? m[1] : null;
  }

  var publicHref = getLinkHref(html, 'tree-card-open-link');
  assert.ok(publicHref, 'Public tree must have open link');
  assert.ok(publicHref.includes('editor?treeId=tree-public-1'), 'Public tree open link must target editor');
  assert.equal(publicHref.includes('view.html'), false, 'Public tree open link must NOT target view.html');
  assert.equal(publicHref.includes('mode=edit'), false, 'Public tree open link must NOT have mode=edit');

  /* ── Public tree: #3563 no public-view card action (shareTarget internal only) ── */
  assert.equal(html.includes('tree-card-public-view-link'), false, 'Public tree must NOT render public-view card action');
  var resolvedPublic = UI.validateAndResolveEntryTargets({ id: 'tree-public-1', visibility: 'public' });
  assert.ok(resolvedPublic.shareTarget || resolvedPublic.publicView, 'Public tree keeps internal shareTarget');
  assert.ok((resolvedPublic.shareTarget || resolvedPublic.publicView).includes('view.html?treeId=tree-public-1'));

  /* ── Public tree: #3578 Phase 1 — direct Edit link removed (no mode=edit on card) ── */
  var editHref = getLinkHref(html, 'tree-card-edit-link');
  assert.equal(editHref, null, 'Public tree must NOT have a direct edit link (#3578)');

  /* ── Private tree → primary targets editor ── */
  const privateCard = UI.buildTreeCard({
    id: 'tree-private-1',
    title: 'Private Tree',
    visibility: 'private',
    stage: 0
  }, { i18n });

  var privHtml = privateCard.innerHTML;
  var privHref = getLinkHref(privHtml, 'tree-card-open-link');
  assert.ok(privHref, 'Private tree must have open link');
  assert.ok(privHref.includes('editor?treeId=tree-private-1'), 'Private tree open link must target editor');
  assert.equal(privHref.includes('view.html'), false, 'Private tree open link must NOT target view.html');

  /* ── Private tree: no public-view link ── */
  assert.equal(privHtml.includes('tree-card-public-view-link'), false, 'Private tree must NOT have public-view link');

  /* ── Unlisted tree → primary targets editor ── */
  const unlistedCard = UI.buildTreeCard({
    id: 'tree-unlisted-1',
    title: 'Unlisted Tree',
    visibility: 'unlisted',
    stage: 0
  }, { i18n });

  var unlistedHref = getLinkHref(unlistedCard.innerHTML, 'tree-card-open-link');
  assert.ok(unlistedHref, 'Unlisted tree must have open link');
  assert.ok(unlistedHref.includes('editor?treeId=tree-unlisted-1'), 'Unlisted tree open link must target editor');

  /* ── Unknown/null visibility → primary targets editor ── */
  const unknownCard = UI.buildTreeCard({
    id: 'tree-unknown-1',
    title: 'Unknown Tree',
    visibility: null,
    stage: 0
  }, { i18n });

  var unknownHref = getLinkHref(unknownCard.innerHTML, 'tree-card-open-link');
  assert.ok(unknownHref, 'Unknown tree must have open link');
  assert.ok(unknownHref.includes('editor?treeId=tree-unknown-1'), 'Null visibility tree open link must target editor');
  assert.equal(unknownHref.includes('view.html'), false, 'Null visibility tree open link must NOT target view.html');
});
