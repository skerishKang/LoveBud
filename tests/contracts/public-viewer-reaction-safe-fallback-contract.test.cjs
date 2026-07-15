const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const scriptSource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-ui.js'), 'utf8');

// Helper to create mock DOM elements
function createMockElement(tagName = 'div') {
  const classList = {
    classes: new Set(),
    add(c) { this.classes.add(c); },
    remove(c) { this.classes.delete(c); },
    contains(c) { return this.classes.has(c); }
  };
  const element = {
    tagName: tagName.toUpperCase(),
    dataset: {},
    style: {},
    classList: classList,
    parentElement: null,
    children: [],
    attributes: {},
    setAttribute(name, val) { this.attributes[name] = val; },
    removeAttribute(name) { delete this.attributes[name]; },
    getAttribute(name) { return this.attributes[name]; },
    appendChild(child) {
      this.children.push(child);
      child.parentElement = this;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) {
        this.children.splice(idx, 1);
        child.parentElement = null;
      }
    },
    get firstChild() { return this.children[0] || null; },
    querySelector(sel) {
      // Support retry button lookup
      if (sel === '[data-social-retry="1"]') {
        return this.children.find(c => c.getAttribute && c.getAttribute('data-social-retry') === '1') || null;
      }
      return null;
    },
    closest() { return this.parentElement || this; }
  };
  return element;
}

test('public-viewer-detail-ui static analysis constraints', () => {
  // 4. Verify updateCurrentMomentImage is called before updateReadOnlyReactionSummary
  const imgCallIdx = scriptSource.indexOf('updateCurrentMomentImage');
  const reactionsCallIdx = scriptSource.indexOf('updateReadOnlyReactionSummary');
  assert.ok(imgCallIdx !== -1, 'updateCurrentMomentImage should be defined');
  assert.ok(reactionsCallIdx !== -1, 'updateReadOnlyReactionSummary should be defined');
  assert.ok(imgCallIdx < reactionsCallIdx, 'image rendering must be scheduled before reactions update');
});

test('Public read-only social summary never invokes private reaction API and hides for root', () => {
  let currentSelectedId = 'mem-1';

  const elements = {
    detailTreeMetaMount: createMockElement(),
    detailCurrentMomentBadge: createMockElement(),
    detailCurrentMomentTitle: createMockElement(),
    detailCurrentMomentHint: createMockElement(),
    detailImg: createMockElement('img'),
    detailDateText: createMockElement(),
    detailMemo: createMockElement(),
    detailTags: createMockElement(),
    momentReactionsCard: createMockElement(),
    momentReactionLikeValue: createMockElement(),
    momentReactionCommentValue: createMockElement(),
    momentReactionNote: createMockElement(),
    momentReactionCommentStatus: createMockElement('button'),
    momentCommentsPanel: createMockElement(),
    momentCommentsList: createMockElement(),
    momentCommentsPanelStatus: createMockElement()
  };

  elements.momentReactionsCard.setAttribute('data-read-only-summary', 'true');
  elements.momentReactionsCard.classList.add('is-read-only');
  elements.momentReactionsCard.classList.add('is-public-readonly');

  const likeStatus = createMockElement();
  elements.momentReactionLikeValue.parentElement = likeStatus;
  elements.momentReactionCommentValue.parentElement = elements.momentReactionCommentStatus;

  const imgParent = createMockElement('div');
  imgParent.classList.add('detail-video');
  imgParent.appendChild(elements.detailImg);

  const context = {
    window: {},
    document: {
      createElement(tagName) {
        return createMockElement(tagName);
      },
      getElementById(id) {
        return elements[id] || null;
      },
      querySelector(sel) {
        if (sel === '#detailPanel h3') return createMockElement('h3');
        if (sel === '.detail-video img') return elements.detailImg;
        if (sel === '.diary-note') return elements.detailMemo;
        return null;
      },
      querySelectorAll(sel) {
        return [];
      }
    }
  };

  context.window = context;

  vm.createContext(context);
  const metadataCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-metadata-text.js'), 'utf8');
  vm.runInContext(metadataCode, context);
  // Load social split modules before detail-ui
  var socialFiles = [
    'js/viewer/public-viewer-read-only-social-summary.js',
    'js/viewer/public-viewer-authenticated-like.js',
    'js/viewer/public-viewer-authenticated-comment-composer.js',
  ];
  socialFiles.forEach(function(sf) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, sf), 'utf8'), context);
  });
  context.window.LoveBudPublicViewerAppreciationComposer = {
    composePublicViewerAppreciationPresentation: function() { return { slots: [] }; }
  };
  context.window.LoveBudPublicViewerAppreciationDomRenderer = {
    createPublicViewerAppreciationDomRenderer: function() {
      return { render: function() {}, reset: function() {} };
    }
  };
  vm.runInContext(scriptSource, context);

  const deps = {
    getSelectedNodeId: () => currentSelectedId,
    isRootMemory: (data, rootId) => data && data.id === rootId,
    getCanonicalRootId: () => 'root',
    getTreeMemories: () => [{ id: 'mem-1', treeId: 'tree-1' }],
    resolveMemoryThumbnail: (data) => data.thumbnail || '',
    i18n: (key) => key,
    getLocalSaveMode: () => false,
    showToast: () => {},
    fetchPublicMomentReactionSummary: async () => ({ counts: { like: 0 }, total: 0 }),
    fetchPublicMomentComments: async () => ({ comments: [], nextCursor: null })
  };

  const detailUI = context.createPublicViewerDetailUI(deps);

  // Non-root moment: card must be visible, loading state shown
  const data1 = { id: 'mem-1', title: 'Moment 1', thumbnail: '/thumb.jpg', treeId: 'tree-1' };
  detailUI.updateDetailPanel(data1);

  assert.equal(elements.momentReactionsCard.style.display, '', 'Reactions card is shown for valid moment');
  assert.equal(elements.momentReactionsCard.getAttribute('data-read-only-summary'), 'true', 'Reactions card has read only attribute');
  assert.equal(elements.momentReactionsCard.classList.contains('is-read-only'), true, 'Reactions card has is-read-only class');
  assert.equal(elements.momentReactionsCard.classList.contains('is-public-readonly'), true, 'Reactions card has is-public-readonly class');

  // Root moment: card must be hidden, no request issued
  const rootData = { id: 'root', title: 'Root Moment', treeId: 'tree-1' };
  deps.isRootMemory = (data, id) => data.id === id;
  detailUI.updateDetailPanel(rootData);
  assert.equal(elements.momentReactionsCard.style.display, 'none', 'Reactions card is hidden for root moment');

  // Moment with missing treeId: card must be hidden, no request issued
  elements.momentReactionsCard.style.display = ''; // reset
  const noTreeIdData = { id: 'mem-2', title: 'No Tree' };
  detailUI.updateDetailPanel(noTreeIdData);
  assert.equal(elements.momentReactionsCard.style.display, 'none', 'Reactions card is hidden when treeId is missing');

  // Moment with missing id: card must be hidden, no request issued
  elements.momentReactionsCard.style.display = ''; // reset
  const noIdData = { treeId: 'tree-1' };
  detailUI.updateDetailPanel(noIdData);
  assert.equal(elements.momentReactionsCard.style.display, 'none', 'Reactions card is hidden when memory id is missing');
});
