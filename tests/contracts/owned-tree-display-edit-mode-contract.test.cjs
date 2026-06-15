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

  // 4. My LoveTree copy has 감상하기 / 편집하기 or fallback markers
  assert.match(previewHub, /'감상하기'/);
  assert.match(previewHub, /'편집하기'/);
  assert.match(myTreesUi, /'감상하기'/);
  assert.match(myTreesUi, /'편집하기'/);

  // 5. Raw ownerId/user ID must not be directly displayed in UI text
  assert.doesNotMatch(treeMeta, /\.textContent\s*=\s*(currentTree\.)?ownerId/);
  assert.doesNotMatch(treeMeta, /\.innerHTML\s*=\s*(currentTree\.)?ownerId/);
  assert.doesNotMatch(treeMeta, /\.textContent\s*=\s*owner_id/);

  // 6. Existing view.html path remains intact
  const viewHtml = read('pages/view.html');
  assert.match(viewHtml, /public-viewer-detail-tree-meta\.js/);
});

test('public-viewer-detail-tree-meta runtime owner edit button checks', () => {
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

  // Set up mock window and document for the meta boundary
  const context = {
    window: {},
    document: {
      createElement(tag) { return createMockElement(tag); },
      createTextNode(txt) { return { text: txt }; }
    },
    LoveTreeBaseApiFetch: {
      getCachedTokenRecord() {
        return { uid: 'user-owner' };
      }
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

  // Case A: Current user is the owner -> edit button should be generated
  const modelA = boundary.buildTreeMetaRenderModel({
    currentTree: { id: 'tree-1', title: 'My Tree', ownerId: 'user-owner' },
    treeState: { totalMomentCount: 5, hasMoments: true },
    data: { id: 'tree-1' },
    isEmptyState: false,
    localSaveMode: false
  });

  assert.ok(modelA.editButtonEl !== null, 'Owner must see edit button');

  // Case B: Current user is NOT the owner -> edit button should be null
  const modelB = boundary.buildTreeMetaRenderModel({
    currentTree: { id: 'tree-1', title: 'My Tree', ownerId: 'user-other' },
    treeState: { totalMomentCount: 5, hasMoments: true },
    data: { id: 'tree-1' },
    isEmptyState: false,
    localSaveMode: false
  });

  assert.equal(modelB.editButtonEl, null, 'Non-owner must NOT see edit button');

  // Case C: No logged in user -> edit button should be null
  context.LoveTreeBaseApiFetch.getCachedTokenRecord = () => null;
  const modelC = boundary.buildTreeMetaRenderModel({
    currentTree: { id: 'tree-1', title: 'My Tree', ownerId: 'user-owner' },
    treeState: { totalMomentCount: 5, hasMoments: true },
    data: { id: 'tree-1' },
    isEmptyState: false,
    localSaveMode: false
  });

  assert.equal(modelC.editButtonEl, null, 'Logged-out visitor must NOT see edit button');
});
