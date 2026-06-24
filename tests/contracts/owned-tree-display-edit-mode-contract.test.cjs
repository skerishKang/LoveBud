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

  // 2. My LoveTree hub display/view href uses view.html?treeId=
  assert.match(previewHub, /view\.html\?treeId=/);

  // 3. My LoveTree edit href uses editor?treeId=
  assert.match(previewHub, /editor\?treeId=/);

  // 4. My LoveTree copy uses 트리 열기 / 편집하기 (Browse parity, Step 5) as
  // both primary copy and i18n fallback. The legacy '감상하기' marker is
  // retained for non-i18n contexts (e.g. card link fallback before refresh).
  assert.match(previewHub, /'트리\s*열기'/);
  assert.match(previewHub, /'편집하기'/);
  assert.match(myTreesUi, /'트리\s*열기'/);
  assert.match(myTreesUi, /'편집하기'/);

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
  const uiSource = read('js/my-trees/my-trees-ui.js');
  const eventsSource = read('js/my-trees/my-trees-card-events.js');

  function createMockElement(tagName = 'div') {
    const attrs = {};
    const dataset = {};
    const listeners = {};
    const children = [];
    return {
      tagName: tagName.toUpperCase(),
      style: {},
      attrs,
      dataset,
      listeners,
      children,
      setAttribute(k, v) { attrs[k] = v; },
      getAttribute(k) { return attrs[k]; },
      addEventListener(name, fn) {
        if (!listeners[name]) listeners[name] = [];
        listeners[name].push(fn);
      },
      appendChild(c) { children.push(c); },
      replaceChildren() { children.length = 0; },
      querySelector(sel) {
        if (sel === '.tree-card-open-link') {
          return {
            getAttribute(k) { return attrs[k] || this[k]; },
            addEventListener() {}
          };
        }
        return null;
      }
    };
  }

  const context = {
    window: {},
    document: {
      createElement(tag) { return createMockElement(tag); },
      createTextNode(txt) { return { text: txt }; },
      getElementById() { return createMockElement('div'); }
    },
    LoveBudPath: {
      getBasePath() { return 'pages/'; }
    },
    LoveTreeBaseApiFetch: {
      getCachedTokenRecord() { return null; }
    },
    location: {
      pathname: '/pages/my-trees.html',
      origin: 'http://localhost'
    }
  };
  context.window = context;

  vm.createContext(context);
  vm.runInContext(uiSource, context);
  vm.runInContext(eventsSource, context);

  const UI = context.window.LoveBudMyTreesUI || context.LoveBudMyTreesUI;
  assert.ok(UI && typeof UI.buildTreeCard === 'function');

  const i18n = (k) => k;

  const publicCard = UI.buildTreeCard({
    id: 'tree-public-1',
    title: 'Public Tree',
    visibility: 'public',
    stage: 0
  }, { i18n });

  const CardEvents = context.window.LoveBudMyTreesCardEvents;
  const publicOpenHref = CardEvents.resolveOpenHref(publicCard, {
    id: 'tree-public-1',
    visibility: 'public'
  });
  assert.ok(publicOpenHref.includes('view.html?treeId=tree-public-1'), 'Public tree view link must target view.html');

  const privateCard = UI.buildTreeCard({
    id: 'tree-private-1',
    title: 'Private Tree',
    visibility: 'private',
    stage: 0
  }, { i18n });

  const privateOpenHref = CardEvents.resolveOpenHref(privateCard, {
    id: 'tree-private-1',
    visibility: 'private'
  });
  assert.ok(privateOpenHref.includes('editor?treeId=tree-private-1'), 'Private tree view link must target editor');
  assert.equal(privateOpenHref.includes('view.html'), false, 'Private tree view link must NOT target view.html');

  const unlistedCard = UI.buildTreeCard({
    id: 'tree-unlisted-1',
    title: 'Unlisted Tree',
    visibility: 'unlisted',
    stage: 0
  }, { i18n });

  const unlistedOpenHref = CardEvents.resolveOpenHref(unlistedCard, {
    id: 'tree-unlisted-1',
    visibility: 'unlisted'
  });
  assert.ok(unlistedOpenHref.includes('editor?treeId=tree-unlisted-1'), 'Unlisted tree view link must target editor');

  const unknownCard = UI.buildTreeCard({
    id: 'tree-unknown-1',
    title: 'Unknown Tree',
    visibility: null,
    stage: 0
  }, { i18n });

  const unknownOpenHref = CardEvents.resolveOpenHref(unknownCard, {
    id: 'tree-unknown-1',
    visibility: null
  });
  assert.ok(unknownOpenHref.includes('editor?treeId=tree-unknown-1'), 'Null visibility tree view link must target editor');
  assert.equal(unknownOpenHref.includes('view.html'), false, 'Null visibility tree view link must NOT target view.html');
});
