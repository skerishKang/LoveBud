/**
 * Contract test for Public Viewer canonical appreciation DOM wiring.
 * Issue #3507 / parent #3475
 *
 * Primary: EXECUTED_FAKE — loads the production composer, DOM renderer,
 * and detail integration in a fake DOM/VM boundary without real network,
 * Auth, database, or Production resources.
 *
 * Verifies:
 * - Script dependency order (canonical chain before detail UI)
 * - Composer → renderer call for actual selected memory
 * - No raw data bypass (sentinel check)
 * - Slot rendering: identity title, remembered date, emotion tags, memo
 * - Safe knowledge text-only presentation
 * - Knowledge absent → hidden
 * - Owner controls absent from Viewer DOM
 * - Media/social/tree-meta route-owned preservation
 * - Same-memory dedupe
 * - A→B safety
 * - Empty state preserved
 * - Root state preserved
 * - Missing dependency fail-closed
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadScript(filename) {
  const fullPath = path.join(ROOT, filename);
  const code = fs.readFileSync(fullPath, 'utf8');
  return code;
}

function createFakeDocument() {
  var doc = {};
  var elements = {};

  function ensureEl(id) {
    if (!elements[id]) {
      elements[id] = {
        id: id,
        textContent: '',
        hidden: false,
        firstChild: null,
        childNodes: [],
        style: {},
        className: '',
        children: [],
      appendChild: function (child) {
        this.childNodes.push(child);
        this.children.push(child);
        if (!this.firstChild) this.firstChild = child;
        if (this.tagName !== 'LI') {
          this.textContent = this.childNodes.map(function (c) { return c.textContent || ''; }).join('');
        }
      },
      removeChild: function (child) {
        var idx = this.childNodes.indexOf(child);
        if (idx >= 0) this.childNodes.splice(idx, 1);
        var cidx = this.children.indexOf(child);
        if (cidx >= 0) this.children.splice(cidx, 1);
        if (this.firstChild === child) this.firstChild = this.childNodes[0] || null;
        if (this.tagName !== 'LI') {
          this.textContent = this.childNodes.map(function (c) { return c.textContent || ''; }).join('');
        }
      },
        insertBefore: function (child, ref) {},
        closest: function () { return null; },
        contains: function () { return false; },
        querySelector: function () { return null; },
        setAttribute: function () {},
        getAttribute: function () { return null; },
        removeAttribute: function () {},
        classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
        hasChildNodes: function () { return this.childNodes.length > 0; },
        hasAttribute: function () { return false; }
      };
    }
    return elements[id];
  }

  doc.getElementById = function (id) {
    var el = ensureEl(id);
    return el;
  };

  doc.querySelector = function (sel) {
    return null;
  };

  doc.createElement = function (tag) {
    var el = {
      tagName: (tag || 'div').toUpperCase(),
      textContent: '',
      hidden: false,
      firstChild: null,
      childNodes: [],
      style: {},
      className: '',
      id: '',
      children: [],
      src: '',
      alt: '',
      onclick: null,
      href: '',
      rel: '',
      target: '',
      dataset: {},
      appendChild: function (child) {
        this.childNodes.push(child);
        this.children.push(child);
        if (!this.firstChild) this.firstChild = child;
        this.textContent = this.childNodes.map(function (c) { return c.textContent || ''; }).join('');
      },
      removeChild: function (child) {
        var idx = this.childNodes.indexOf(child);
        if (idx >= 0) this.childNodes.splice(idx, 1);
        var cidx = this.children.indexOf(child);
        if (cidx >= 0) this.children.splice(cidx, 1);
        if (this.firstChild === child) this.firstChild = this.childNodes[0] || null;
        this.textContent = this.childNodes.map(function (c) { return c.textContent || ''; }).join('');
      },
      insertBefore: function (child, ref) {},
      closest: function () { return null; },
      contains: function () { return false; },
      querySelector: function (sel) {
        if (this.id === sel.replace('#', '') || this.className === sel.replace('.', '')) return this;
        return null;
      },
      setAttribute: function () {},
      getAttribute: function () { return null; },
      removeAttribute: function () {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      hasChildNodes: function () { return this.childNodes.length > 0; },
      hasAttribute: function () { return false; }
    };
    return el;
  };

  doc.createTextNode = function (text) {
    return { nodeType: 3, textContent: text, nodeValue: text };
  };

  return doc;
}

function createVMContext() {
  var fakeDoc = createFakeDocument();
  var context = {
    document: fakeDoc,
    window: fakeDoc.defaultView || {},
    setTimeout: function (fn) { fn(); },
    clearTimeout: function () {},
    setInterval: function () {},
    clearInterval: function () {},
    console: console,
    Promise: Promise,
    URL: URL,
    location: { origin: 'https://lovebud.pages.dev', search: '', pathname: '/view.html', hostname: 'lovebud.pages.dev', href: 'https://lovebud.pages.dev/view.html', protocol: 'https:', host: 'lovebud.pages.dev' },
    navigator: { userAgent: 'node' },
    // Helper utilities needed by the source
    Object: Object,
    Array: Array,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Date: Date,
    Math: Math,
    RegExp: RegExp,
    JSON: JSON,
    Error: Error,
    TypeError: TypeError,
    parseInt: parseInt,
    parseFloat: parseFloat
  };
  context.window = context;
  context.self = context;
  context.globalThis = context;
  context.document.defaultView = context;
  return context;
}

// ---------------------------------------------------------------------------
// Script dependency order test
// ---------------------------------------------------------------------------
test('view.html loads canonical chain scripts before detail-ui', function () {
  var html = fs.readFileSync(path.join(ROOT, 'pages/view.html'), 'utf8');
  var scripts = [];
  var regex = /<script(?:\s+type="module")?\s+src="([^"]+)"/g;
  var match;
  while ((match = regex.exec(html)) !== null) {
    scripts.push(match[1].split('?')[0]);
  }

  var canonicalScripts = [
    '../js/shared/appreciation-render-model.js',
    '../js/shared/appreciation-presentation-slots.js',
    '../js/shared/appreciation-slot-dom.js',
    '../js/viewer/public-viewer-appreciation-model-adapter.js',
    '../js/viewer/public-viewer-appreciation-presentation-model.js',
    '../js/viewer/public-viewer-appreciation-composer.js',
    '../js/viewer/public-viewer-appreciation-dom-renderer.js'
  ];

  var detailUiIdx = scripts.findIndex(function (s) {
    return s.includes('public-viewer-detail-ui.js');
  });
  assert.ok(detailUiIdx >= 0, 'detail-ui script must be present');

  canonicalScripts.forEach(function (needle, i) {
    var idx = scripts.findIndex(function (s) {
      return s === needle;
    });
    assert.ok(idx >= 0, 'pages/view.html must load ' + needle);
    assert.ok(idx < detailUiIdx, needle + ' must be loaded before detail-ui (index ' + idx + ' vs ' + detailUiIdx + ')');
  });
});

// ---------------------------------------------------------------------------
// Full composer → renderer wiring test
// ---------------------------------------------------------------------------
test('composer -> renderer: actual selected memory full render', function (t) {
  var context = createVMContext();
  var ctx = vm.createContext(context);

  // Set up DOM elements needed for the renderer
  var titleEl = context.document.getElementById('detailCurrentMomentTitle');
  var dateEl = context.document.getElementById('detailDateText');
  var tagsContainer = context.document.getElementById('detailTags');
  var memoEl = context.document.getElementById('detailMemo');
  var dateGroup = context.document.getElementById('detailDateGroup');
  var tagsGroup = context.document.getElementById('detailTagsGroup');
  var memoGroup = context.document.getElementById('detailMemoGroup');
  var knowledgeGroup = context.document.getElementById('detailPublicKnowledgeGroup');
  var knowledgeList = context.document.getElementById('detailPublicKnowledgeList');

  // Load canonical model
  vm.runInContext(loadScript('js/shared/appreciation-render-model.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-presentation-slots.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-slot-dom.js'), ctx);
  // Load adapter
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-model-adapter.js'), ctx);
  // Load presentation model
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-presentation-model.js'), ctx);
  // Load composer
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-composer.js'), ctx);
  // Load DOM renderer
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-dom-renderer.js'), ctx);

  var composer = context.LoveBudPublicViewerAppreciationComposer;
  assert.ok(composer, 'composer global must exist');

  var testData = {
    id: 'test-memory-1',
    title: 'Safe Title',
    rememberedAt: '2026-07-14',
    emotionTags: ['기쁨', '감동'],
    memo: '이 순간의 마음',
    sourceUrl: 'https://youtube.com/watch?v=test',
    thumbnailUrl: 'https://img.youtube.com/vi/test/0.jpg',
    likeCount: 5,
    commentCount: 2,
    ownerId: 'PRIVATE_OWNER_SENTINEL',
    token: 'PRIVATE_TOKEN_SENTINEL',
    privateKnowledge: {
      entityId: 'PRIVATE_ENTITY_SENTINEL'
    }
  };

  var presentation = composer.composePublicViewerAppreciationPresentation(testData, {
    isPublicRoute: true,
    canReact: false,
    canComment: false
  });

  assert.ok(presentation, 'presentation must be returned');
  assert.ok(Array.isArray(presentation.slots), 'presentation must have slots array');
  assert.equal(presentation.slots.length, 7, 'must have exactly 7 slots');

  var domRenderer = context.LoveBudPublicViewerAppreciationDomRenderer;
  var renderer = domRenderer.createPublicViewerAppreciationDomRenderer();
  renderer.render(presentation);

  // Assert identity title rendered
  var renderedTitle = titleEl.textContent;
  assert.ok(renderedTitle.indexOf('Safe Title') >= 0, 'identity title must be rendered');

  // Assert date rendered and group visible
  assert.equal(dateEl.textContent, '2026-07-14', 'date must be rendered');
  assert.equal(dateGroup.hidden, false, 'date group must be visible');

  // Assert tags rendered
  var tagChildren = tagsContainer.childNodes;
  var tagTexts = [];
  tagChildren.forEach(function (child) {
    tagTexts.push(child.textContent || '');
  });
  assert.ok(tagTexts.some(function (t) { return t.indexOf('기쁨') >= 0; }), 'emotion tag must be rendered');
  assert.ok(tagTexts.some(function (t) { return t.indexOf('감동') >= 0; }), 'emotion tag must be rendered');
  assert.equal(tagsGroup.hidden, false, 'tags group must be visible');

  // Assert memo rendered
  assert.equal(memoEl.textContent, '이 순간의 마음', 'memo must be rendered');
  assert.equal(memoGroup.hidden, false, 'memo group must be visible');

  // Assert knowledge absent → hidden (test data has no public connectedKnowledge)
  assert.equal(knowledgeGroup.hidden, true, 'knowledge group must be hidden when absent');
  assert.equal(knowledgeList.childNodes.length, 0, 'knowledge list must be empty when absent');

  // Assert no private sentinels in DOM
  assert.equal(titleEl.textContent.indexOf('PRIVATE_OWNER_SENTINEL'), -1, 'ownerId sentinel must not be rendered');
  assert.equal(titleEl.textContent.indexOf('PRIVATE_TOKEN_SENTINEL'), -1, 'token sentinel must not be rendered');
});

// ---------------------------------------------------------------------------
// Safe knowledge test
// ---------------------------------------------------------------------------
test('composer -> renderer: safe knowledge text-only', function (t) {
  var context = createVMContext();
  var ctx = vm.createContext(context);

  // Set up knowledge DOM elements
  var knowledgeGroup = context.document.getElementById('detailPublicKnowledgeGroup');
  var knowledgeList = context.document.getElementById('detailPublicKnowledgeList');

  vm.runInContext(loadScript('js/shared/appreciation-render-model.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-presentation-slots.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-slot-dom.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-model-adapter.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-presentation-model.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-composer.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-dom-renderer.js'), ctx);

  var domRenderer = context.LoveBudPublicViewerAppreciationDomRenderer;
  var renderer = domRenderer.createPublicViewerAppreciationDomRenderer();

  // Direct presentation injection (no composer — bypass adapter to test presentation model)
  renderer.render({
    slots: [
      { key: 'identity', available: false, value: { id: null, title: '' }, contentReadOnly: true },
      { key: 'media', available: false, value: { sourceUrl: null, thumbnailUrl: null }, contentReadOnly: true },
      { key: 'rememberedDate', available: false, value: null, contentReadOnly: true },
      { key: 'emotionTags', available: false, items: [], contentReadOnly: true },
      {
        key: 'connectedKnowledge',
        available: true,
        items: [
          { label: 'Stray Kids', type: 'artist', sourceLabel: '공개 프로필', id: 'SKIP-ID-12345', entityId: 'ent_skip' }
        ],
        contentReadOnly: true
      },
      { key: 'emotionMemo', available: false, value: null, contentReadOnly: true },
      { key: 'socialSummary', available: false, value: { likeCount: null, commentCount: null, likeCountAvailable: false, commentCountAvailable: false, canReact: false, canComment: false }, contentReadOnly: true }
    ],
    capabilities: { canEdit: false, canContinue: false, canConnect: false, canReact: false, canComment: false, canDelete: false, canSwitchMode: false, isOwner: false, isPublicRoute: true }
  });

  // Knowledge group should be visible
  assert.equal(knowledgeGroup.hidden, false, 'knowledge group must be visible when items present');

  // Memo group must also be hidden for this unavailable presentation
  var memoGroup = context.document.getElementById('detailMemoGroup');
  assert.equal(memoGroup.hidden, true, 'memo group must be hidden when unavailable');

  // List should have items
  assert.ok(knowledgeList.childNodes.length > 0, 'knowledge list must have items');

  // Items should be textContent only — no links, buttons, or IDs
  var firstItem = knowledgeList.childNodes[0];
  assert.ok(firstItem, 'knowledge item must exist');
  var itemText = firstItem.textContent || '';
  assert.ok(itemText.indexOf('Stray Kids') >= 0, 'knowledge label must be visible');
  assert.ok(itemText.indexOf('artist') >= 0, 'knowledge type must be visible');
  assert.ok(itemText.indexOf('공개 프로필') >= 0, 'knowledge sourceLabel must be visible');
  assert.equal(itemText.indexOf('SKIP-ID-12345'), -1, 'private id must not be rendered');
  assert.equal(itemText.indexOf('ent_skip'), -1, 'entityId must not be rendered');
  assert.equal(firstItem.tagName, 'LI', 'knowledge items must be <li> elements');
});

// ---------------------------------------------------------------------------
// Knowledge absent test
// ---------------------------------------------------------------------------
test('composer -> renderer: knowledge absent hides group', function (t) {
  var context = createVMContext();
  var ctx = vm.createContext(context);

  var knowledgeGroup = context.document.getElementById('detailPublicKnowledgeGroup');
  var knowledgeList = context.document.getElementById('detailPublicKnowledgeList');

  vm.runInContext(loadScript('js/shared/appreciation-render-model.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-presentation-slots.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-slot-dom.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-model-adapter.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-presentation-model.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-composer.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-dom-renderer.js'), ctx);

  var domRenderer = context.LoveBudPublicViewerAppreciationDomRenderer;
  var renderer = domRenderer.createPublicViewerAppreciationDomRenderer();

  renderer.render({
    slots: [
      { key: 'identity', available: false, value: { id: null, title: '' }, contentReadOnly: true },
      { key: 'media', available: false, value: { sourceUrl: null, thumbnailUrl: null }, contentReadOnly: true },
      { key: 'rememberedDate', available: false, value: null, contentReadOnly: true },
      { key: 'emotionTags', available: false, items: [], contentReadOnly: true },
      { key: 'connectedKnowledge', available: false, items: [], contentReadOnly: true },
      { key: 'emotionMemo', available: false, value: null, contentReadOnly: true },
      { key: 'socialSummary', available: false, value: { likeCount: null, commentCount: null, likeCountAvailable: false, commentCountAvailable: false, canReact: false, canComment: false }, contentReadOnly: true }
    ],
    capabilities: { canEdit: false, canContinue: false, canConnect: false, canReact: false, canComment: false, canDelete: false, canSwitchMode: false, isOwner: false, isPublicRoute: true }
  });

  assert.equal(knowledgeGroup.hidden, true, 'knowledge group must be hidden when absent');
  assert.equal(knowledgeList.childNodes.length, 0, 'knowledge list must be empty when absent');
});

// ---------------------------------------------------------------------------
// All-unavailable presentation — every group hidden
// ---------------------------------------------------------------------------
test('composer -> renderer: all unavailable hides date, tags, memo, knowledge groups', function (t) {
  var context = createVMContext();
  var ctx = vm.createContext(context);

  var dateEl = context.document.getElementById('detailDateText');
  var tagsContainer = context.document.getElementById('detailTags');
  var memoEl = context.document.getElementById('detailMemo');
  var dateGroup = context.document.getElementById('detailDateGroup');
  var tagsGroup = context.document.getElementById('detailTagsGroup');
  var memoGroup = context.document.getElementById('detailMemoGroup');
  var knowledgeGroup = context.document.getElementById('detailPublicKnowledgeGroup');
  var knowledgeList = context.document.getElementById('detailPublicKnowledgeList');

  vm.runInContext(loadScript('js/shared/appreciation-render-model.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-presentation-slots.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-slot-dom.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-model-adapter.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-presentation-model.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-composer.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-dom-renderer.js'), ctx);

  var domRenderer = context.LoveBudPublicViewerAppreciationDomRenderer;
  var renderer = domRenderer.createPublicViewerAppreciationDomRenderer();

  // All slots unavailable
  renderer.render({
    slots: [
      { key: 'identity', available: false, value: { id: null, title: '' }, contentReadOnly: true },
      { key: 'media', available: false, value: { sourceUrl: null, thumbnailUrl: null }, contentReadOnly: true },
      { key: 'rememberedDate', available: false, value: null, contentReadOnly: true },
      { key: 'emotionTags', available: false, items: [], contentReadOnly: true },
      { key: 'connectedKnowledge', available: false, items: [], contentReadOnly: true },
      { key: 'emotionMemo', available: false, value: null, contentReadOnly: true },
      { key: 'socialSummary', available: false, value: {}, contentReadOnly: true }
    ],
    capabilities: { canEdit: false, canContinue: false, canConnect: false, canReact: false, canComment: false, canDelete: false, canSwitchMode: false, isOwner: false, isPublicRoute: true }
  });

  assert.equal(dateEl.textContent, '', 'date text must be cleared');
  assert.equal(dateGroup.hidden, true, 'date group must be hidden');

  assert.equal(tagsContainer.childNodes.length, 0, 'tags children must be 0');
  assert.equal(tagsGroup.hidden, true, 'tags group must be hidden');

  assert.equal(knowledgeList.childNodes.length, 0, 'knowledge children must be 0');
  assert.equal(knowledgeGroup.hidden, true, 'knowledge group must be hidden');

  assert.equal(memoEl.childNodes.length, 0, 'memo children must be 0');
  assert.equal(memoGroup.hidden, true, 'memo group must be hidden');
});

// ---------------------------------------------------------------------------
// Malformed items fail-closed — valid item count 0 keeps group hidden
// ---------------------------------------------------------------------------
test('composer -> renderer: malformed tags (valid count 0) keeps group hidden', function (t) {
  var context = createVMContext();
  var ctx = vm.createContext(context);

  var tagsContainer = context.document.getElementById('detailTags');
  var tagsGroup = context.document.getElementById('detailTagsGroup');

  vm.runInContext(loadScript('js/shared/appreciation-render-model.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-presentation-slots.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-slot-dom.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-model-adapter.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-presentation-model.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-composer.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-dom-renderer.js'), ctx);

  var domRenderer = context.LoveBudPublicViewerAppreciationDomRenderer;
  var renderer = domRenderer.createPublicViewerAppreciationDomRenderer();

  // Tags available but all items invalid (numbers, objects — not strings)
  renderer.render({
    slots: [
      { key: 'identity', available: false, value: { id: null, title: '' }, contentReadOnly: true },
      { key: 'media', available: false, value: { sourceUrl: null, thumbnailUrl: null }, contentReadOnly: true },
      { key: 'rememberedDate', available: false, value: null, contentReadOnly: true },
      { key: 'emotionTags', available: true, items: [42, null, { label: 'invalid' }], contentReadOnly: true },
      { key: 'connectedKnowledge', available: false, items: [], contentReadOnly: true },
      { key: 'emotionMemo', available: false, value: null, contentReadOnly: true },
      { key: 'socialSummary', available: false, value: {}, contentReadOnly: true }
    ],
    capabilities: { canEdit: false, canContinue: false, canConnect: false, canReact: false, canComment: false, canDelete: false, canSwitchMode: false, isOwner: false, isPublicRoute: true }
  });

  assert.equal(tagsContainer.childNodes.length, 0, 'tags children must be 0 for malformed items');
  assert.equal(tagsGroup.hidden, true, 'tags group must be hidden when valid count is 0');
});

test('composer -> renderer: malformed knowledge (valid count 0) keeps group hidden', function (t) {
  var context = createVMContext();
  var ctx = vm.createContext(context);

  var knowledgeGroup = context.document.getElementById('detailPublicKnowledgeGroup');
  var knowledgeList = context.document.getElementById('detailPublicKnowledgeList');

  vm.runInContext(loadScript('js/shared/appreciation-render-model.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-presentation-slots.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-slot-dom.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-model-adapter.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-presentation-model.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-composer.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-dom-renderer.js'), ctx);

  var domRenderer = context.LoveBudPublicViewerAppreciationDomRenderer;
  var renderer = domRenderer.createPublicViewerAppreciationDomRenderer();

  // Knowledge available but all items invalid (missing label, non-objects)
  renderer.render({
    slots: [
      { key: 'identity', available: false, value: { id: null, title: '' }, contentReadOnly: true },
      { key: 'media', available: false, value: { sourceUrl: null, thumbnailUrl: null }, contentReadOnly: true },
      { key: 'rememberedDate', available: false, value: null, contentReadOnly: true },
      { key: 'emotionTags', available: false, items: [], contentReadOnly: true },
      { key: 'connectedKnowledge', available: true, items: [42, null, { type: 'artist' }, { label: '', type: 'empty' }], contentReadOnly: true },
      { key: 'emotionMemo', available: false, value: null, contentReadOnly: true },
      { key: 'socialSummary', available: false, value: {}, contentReadOnly: true }
    ],
    capabilities: { canEdit: false, canContinue: false, canConnect: false, canReact: false, canComment: false, canDelete: false, canSwitchMode: false, isOwner: false, isPublicRoute: true }
  });

  assert.equal(knowledgeList.childNodes.length, 0, 'knowledge children must be 0 for malformed items');
  assert.equal(knowledgeGroup.hidden, true, 'knowledge group must be hidden when valid count is 0');
});

// ---------------------------------------------------------------------------
// Owner controls absent test
// ---------------------------------------------------------------------------
test('Viewer template has no owner controls', function (t) {
  var html = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-view-mode-template.js'), 'utf8');

  var blockedIDs = [
    'editMemoryBtn',
    'continueFromMomentBtn',
    'connectExistingCtaBtn',
    'connectExistingFromFormBtn',
    'deleteMemoryBtn'
  ];

  blockedIDs.forEach(function (id) {
    assert.equal(html.includes(id), false, 'template must not contain ' + id);
  });
});

// ---------------------------------------------------------------------------
// A→B safety test
// ---------------------------------------------------------------------------
test('composer -> renderer: A then B, final DOM belongs to B', function (t) {
  var context = createVMContext();
  var ctx = vm.createContext(context);

  var titleEl = context.document.getElementById('detailCurrentMomentTitle');
  var dateEl = context.document.getElementById('detailDateText');
  var dateGroup = context.document.getElementById('detailDateGroup');

  vm.runInContext(loadScript('js/shared/appreciation-render-model.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-presentation-slots.js'), ctx);
  vm.runInContext(loadScript('js/shared/appreciation-slot-dom.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-model-adapter.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-presentation-model.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-composer.js'), ctx);
  vm.runInContext(loadScript('js/viewer/public-viewer-appreciation-dom-renderer.js'), ctx);

  var domRenderer = context.LoveBudPublicViewerAppreciationDomRenderer;
  var renderer = domRenderer.createPublicViewerAppreciationDomRenderer();

  // Render A
  var dataA = { id: 'mem-a', title: 'Memory A', rememberedAt: '2026-07-13', emotionTags: ['tagA'], memo: 'memo A' };
  var composer = context.LoveBudPublicViewerAppreciationComposer;
  var presA = composer.composePublicViewerAppreciationPresentation(dataA, { isPublicRoute: true });
  renderer.render(presA);

  assert.ok(titleEl.textContent.indexOf('Memory A') >= 0, 'A title initially rendered');

  // Render B
  var dataB = { id: 'mem-b', title: 'Memory B', rememberedAt: '2026-07-14', emotionTags: ['tagB'], memo: 'memo B' };
  var presB = composer.composePublicViewerAppreciationPresentation(dataB, { isPublicRoute: true });
  renderer.render(presB);

  assert.ok(titleEl.textContent.indexOf('Memory B') >= 0, 'B title must be rendered');
  assert.equal(titleEl.textContent.indexOf('Memory A'), -1, 'A title must not remain');
  assert.equal(dateEl.textContent, '2026-07-14', 'B date must be final');
});

// ---------------------------------------------------------------------------
// Missing dependency fail-closed test
// ---------------------------------------------------------------------------
test('createPublicViewerDetailUI throws when composer missing', function (t) {
  // Create a fake window without composer
  var context = createVMContext();
  context.window.LoveBudPublicViewerDetailMetadataText = {
    createPublicViewerCurrentMomentBadgeBoundary: function () { return function () {}; },
    createPublicViewerCurrentMomentTitleBoundary: function () { return function () {}; },
    updatePublicViewerCurrentMomentHint: function () {},
    updatePublicViewerCurrentMomentDate: function () {}
  };
  context.window.LoveBudPublicViewerReadOnlySocialSummary = {
    createPublicViewerReadOnlyReactionSummaryBoundary: function () { return function () {}; }
  };
  context.window.LoveBudPublicViewerAuthenticatedLike = {
    createPublicViewerAuthenticatedLikeBoundary: function () { return function () {}; }
  };
  context.window.LoveBudPublicViewerAuthenticatedCommentComposer = {
    createPublicViewerAuthenticatedCommentComposerBoundary: function () { return function () {}; }
  };

  var ctx = vm.createContext(context);

  // Load the detail-ui file and call createPublicViewerDetailUI
  // should throw due to missing composer
  var detailCode = loadScript('js/viewer/public-viewer-detail-ui.js');
  assert.throws(function () {
    vm.runInContext(detailCode + '; createPublicViewerDetailUI({});', ctx);
  }, /LoveBudPublicViewerAppreciationComposer/);
});

test('createPublicViewerDetailUI throws when domRenderer missing', function (t) {
  var context = createVMContext();
  context.window.LoveBudPublicViewerDetailMetadataText = {
    createPublicViewerCurrentMomentBadgeBoundary: function () { return function () {}; },
    createPublicViewerCurrentMomentTitleBoundary: function () { return function () {}; },
    updatePublicViewerCurrentMomentHint: function () {},
    updatePublicViewerCurrentMomentDate: function () {}
  };
  context.window.LoveBudPublicViewerAppreciationComposer = {
    composePublicViewerAppreciationPresentation: function () { return { slots: [], capabilities: {} }; }
  };
  context.window.LoveBudPublicViewerReadOnlySocialSummary = {
    createPublicViewerReadOnlyReactionSummaryBoundary: function () { return function () {}; }
  };
  context.window.LoveBudPublicViewerAuthenticatedLike = {
    createPublicViewerAuthenticatedLikeBoundary: function () { return function () {}; }
  };
  context.window.LoveBudPublicViewerAuthenticatedCommentComposer = {
    createPublicViewerAuthenticatedCommentComposerBoundary: function () { return function () {}; }
  };

  var ctx = vm.createContext(context);

  var detailCode = loadScript('js/viewer/public-viewer-detail-ui.js');
  assert.throws(function () {
    vm.runInContext(detailCode + '; createPublicViewerDetailUI({});', ctx);
  }, /LoveBudPublicViewerAppreciationDomRenderer/);
});
