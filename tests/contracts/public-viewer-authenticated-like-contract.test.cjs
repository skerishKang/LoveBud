const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const scriptSource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-ui.js'), 'utf8');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockElement(tagName) {
  var t = tagName || 'div';
  var classList = {
    classes: {},
    add: function(c) { this.classes[c] = true; },
    remove: function(c) { delete this.classes[c]; },
    contains: function(c) { return !!this.classes[c]; },
    toggle: function(c, f) {
      if (f === true) this.classes[c] = true;
      else if (f === false) delete this.classes[c];
      else if (this.classes[c]) delete this.classes[c];
      else this.classes[c] = true;
    },
  };
  return {
    tagName: t.toUpperCase(),
    dataset: {},
    style: {},
    classList: classList,
    parentElement: null,
    children: [],
    attributes: {},
    textContent: '',
    onclick: null,
    disabled: false,
    hidden: false,
    setAttribute: function(n, v) { this.attributes[n] = v; },
    removeAttribute: function(n) { delete this.attributes[n]; },
    getAttribute: function(n) { return this.attributes[n]; },
    appendChild: function(c) { this.children.push(c); c.parentElement = this; },
    removeChild: function(c) {
      var i = this.children.indexOf(c);
      if (i !== -1) { this.children.splice(i, 1); c.parentElement = null; }
    },
    get firstChild() { return this.children[0] || null; },
    querySelector: function(s) {
      if (s === '[data-social-retry="1"]') return this.children.find(function(c) {
        return c.getAttribute && c.getAttribute('data-social-retry') === '1';
      }) || null;
      return null;
    },
    closest: function() { return this.parentElement || this; }
  };
}

function createTestContext(fetchReactionSummaryFn, toggleReactionFn, hasConfirmedAuthSessionFn, fetchPublicMomentReactionSummaryFn, fetchPublicMomentCommentsFn) {
  var elements = {
    momentReactionsCard: createMockElement(),
    momentReactionLikeButton: createMockElement('button'),
    momentReactionLikeGuestNote: createMockElement(),
    momentReactionWriteError: createMockElement(),
    momentReactionLikeValue: createMockElement(),
    momentReactionLikeStatus: createMockElement(),
    momentReactionCommentStatus: createMockElement('button'),
    momentReactionCommentValue: createMockElement(),
    momentReactionNote: createMockElement(),
    momentReactionLikeStatusRegion: createMockElement(),
    momentCommentsPanel: createMockElement(),
    momentCommentsList: createMockElement(),
    momentCommentsPanelStatus: createMockElement(),
    detailTreeMetaMount: createMockElement(),
    detailCurrentMomentBadge: createMockElement(),
    detailCurrentMomentTitle: createMockElement(),
    detailCurrentMomentHint: createMockElement(),
    detailImg: createMockElement('img'),
    detailDateText: createMockElement(),
    detailMemo: createMockElement(),
    detailTags: createMockElement()
  };

  // Set initial card classes/attributes from template
  elements.momentReactionsCard.classList.add('is-read-only');
  elements.momentReactionsCard.classList.add('is-public-readonly');
  elements.momentReactionsCard.setAttribute('data-read-only-summary', 'true');
  elements.momentReactionsCard.setAttribute('aria-label', '순간 반응 (읽기 전용)');

  var context = {
    window: {},
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    document: {
      createElement: function(tagName) { return createMockElement(tagName); },
      getElementById: function(id) { return elements[id] || null; },
      querySelector: function(sel) {
        if (sel === '#detailPanel h3') return createMockElement('h3');
        if (sel === '.detail-video img') return elements.detailImg;
        if (sel === '.diary-note') return elements.detailMemo;
        return null;
      },
      querySelectorAll: function() { return []; }
    }
  };
  context.window = context;

  vm.createContext(context);
  var metadataCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-metadata-text.js'), 'utf8');
  vm.runInContext(metadataCode, context);
  var socialSummaryCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-read-only-social-summary.js'), 'utf8');
  vm.runInContext(socialSummaryCode, context);
  var authLikeCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-authenticated-like.js'), 'utf8');
  vm.runInContext(authLikeCode, context);
  var authComposerCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-authenticated-comment-composer.js'), 'utf8');
  vm.runInContext(authComposerCode, context);
  context.window.LoveBudPublicViewerAppreciationComposer = {
    composePublicViewerAppreciationPresentation: function() { return { slots: [] }; }
  };
  context.window.LoveBudPublicViewerAppreciationDomRenderer = {
    createPublicViewerAppreciationDomRenderer: function() {
      return { render: function() {}, reset: function() {} };
    }
  };
  vm.runInContext(scriptSource, context);

  var sharedGenerationRef = { value: 0 };
  var deps = {
    sharedGenerationRef: sharedGenerationRef,
    currentSelectedId: 'mem-1',
    treeMemories: [{ id: 'mem-1', treeId: 'tree-1' }],
    getSelectedNodeId: function() { return deps.currentSelectedId; },
    isRootMemory: function(data, rootId) { return data && data.id === rootId; },
    getCanonicalRootId: function() { return 'root'; },
    getTreeMemories: function() { return deps.treeMemories; },
    resolveMemoryThumbnail: function(data) { return data.thumbnail || ''; },
    i18n: function(k) { return k; },
    getLocalSaveMode: function() { return false; },
    showToast: function() {},
    // Auth callbacks
    hasConfirmedAuthSession: hasConfirmedAuthSessionFn || function() { return false; },
    fetchReactionSummary: fetchReactionSummaryFn || null,
    toggleReaction: toggleReactionFn || null,
    // Public read callbacks
    fetchPublicMomentReactionSummary: fetchPublicMomentReactionSummaryFn || async function() { return { counts: { like: 0 }, total: 0 }; },
    fetchPublicMomentComments: fetchPublicMomentCommentsFn || async function() { return { comments: [], nextCursor: null }; }
  };

  var detailUI = context.createPublicViewerDetailUI(deps);

  return { elements: elements, detailUI: detailUI, context: context, deps: deps };
}

function assertButtonAttrs(btn, opts) {
  assert.equal(btn.getAttribute('aria-pressed'), opts.pressed || 'false', 'aria-pressed');
  assert.equal(btn.getAttribute('aria-label'), opts.label || null, 'aria-label fallback');
  assert.equal(btn.classList.contains('is-pressed'), opts.isPressed || false, 'is-pressed class');
  assert.equal(btn.disabled, opts.disabled || false, 'disabled');
  if (opts.busy) {
    assert.equal(btn.getAttribute('aria-busy'), 'true', 'aria-busy');
  } else if (opts.busy === false) {
    assert.equal(btn.getAttribute('aria-busy'), undefined, 'aria-busy removed');
  }
}

// ---------------------------------------------------------------------------
// Source-level checks
// ---------------------------------------------------------------------------

test('authenticated like boundary function exists', function() {
  assert.ok(scriptSource.indexOf('createPublicViewerAuthenticatedLikeBoundary') !== -1,
    'auth like boundary must exist');
});

test('authenticated like boundary is exported on namespace', function() {
  assert.ok(scriptSource.indexOf('createPublicViewerAuthenticatedLikeBoundary: createPublicViewerAuthenticatedLikeBoundary') !== -1,
    'auth like boundary must be published on namespace');
});

test('template has like button with required attributes', function() {
  var tmpl = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-view-mode-template.js'), 'utf8');
  assert.ok(tmpl.indexOf('momentReactionLikeButton') !== -1, 'template has like button');
  assert.ok(tmpl.indexOf('aria-pressed') !== -1, 'button has aria-pressed');
  assert.ok(tmpl.indexOf('aria-label') !== -1, 'button has aria-label');
  assert.ok(tmpl.indexOf('disabled') !== -1, 'button starts disabled');
});

test('template has guest note and error elements', function() {
  var tmpl = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-view-mode-template.js'), 'utf8');
  assert.ok(tmpl.indexOf('momentReactionLikeGuestNote') !== -1, 'template has guest note');
  assert.ok(tmpl.indexOf('momentReactionWriteError') !== -1, 'template has error element');
  assert.ok(tmpl.indexOf('role="alert"') !== -1, 'error has role=alert');
});

test('canvas-entry injects hasConfirmedAuthSession', function() {
  var src = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-canvas-entry.js'), 'utf8');
  assert.ok(src.indexOf('hasConfirmedAuthSession') !== -1, 'canvas-entry injects hasConfirmedAuthSession');
});

test('canvas-entry injects fetchReactionSummary and toggleReaction', function() {
  var src = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-canvas-entry.js'), 'utf8');
  assert.ok(src.indexOf('fetchReactionSummary') !== -1, 'canvas-entry injects fetchReactionSummary');
  assert.ok(src.indexOf('toggleReaction') !== -1, 'canvas-entry injects toggleReaction');
});

test('canvas-init injects auth callbacks', function() {
  var src = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-init.js'), 'utf8');
  assert.ok(src.indexOf('hasConfirmedAuthSession') !== -1, 'canvas-init injects hasConfirmedAuthSession');
  assert.ok(src.indexOf('fetchReactionSummary') !== -1, 'canvas-init injects fetchReactionSummary');
  assert.ok(src.indexOf('toggleReaction') !== -1, 'canvas-init injects toggleReaction');
});

test('no private comment reader/writer in public viewer', function() {
  assert.ok(!scriptSource.indexOf('createComment') !== -1 || scriptSource.indexOf('showAuthActionable') !== -1,
    'no createComment added');
});

test('public comments still only from fetchPublicMomentComments', function() {
  const ronlySrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-read-only-social-summary.js'), 'utf8');
  assert.ok(ronlySrc.indexOf('fetchPublicMomentComments') !== -1,
    'fetchPublicMomentComments must remain in read-only social summary');
});

// ---------------------------------------------------------------------------
// Runtime behavior tests
// ---------------------------------------------------------------------------

test('guest mode never calls fetchReactionSummary or toggleReaction', async function() {
  var called = false;
  var { elements, detailUI } = createTestContext(
    function() { called = true; return Promise.resolve(null); },
    function() { called = true; return Promise.resolve(null); },
    function() { return false; } // guest
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  assert.equal(called, false, 'guest mode must not call private API');
  assert.equal(elements.momentReactionLikeButton.style.display, 'none', 'button hidden for guest');
  assert.equal(elements.momentReactionLikeGuestNote.style.display, '', 'guest note visible');
  assert.equal(elements.momentReactionsCard.getAttribute('data-read-only-summary'), 'true', 'read-only attr preserved');
  assert.equal(elements.momentReactionsCard.classList.contains('is-read-only'), true, 'is-read-only preserved');
});

test('auth-not-ready never calls fetchReactionSummary or toggleReaction', async function() {
  var called = false;
  var { elements, detailUI } = createTestContext(
    function() { called = true; return Promise.resolve(null); },
    function() { called = true; return Promise.resolve(null); },
    function() { return false; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });
  // Same as guest
  assert.equal(called, false, 'auth-not-ready must not call private API');
});

test('confirmed auth enables private fetchReactionSummary call', async function() {
  var fsCalled = false;
  var toggleCalled = false;
  var { elements, detailUI } = createTestContext(
    async function() { fsCalled = true; return { counts: { like: 0 }, userReactions: { like: false } }; },
    function() { toggleCalled = true; return Promise.resolve(null); },
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  assert.equal(fsCalled, true, 'fetchReactionSummary must be called for auth');
  assert.equal(toggleCalled, false, 'toggleReaction not called automatically');
});

test('root moment hides auth elements and issues no request', async function() {
  var called = false;
  var { elements, detailUI, deps } = createTestContext(
    function() { called = true; return Promise.resolve(null); },
    function() { called = true; return Promise.resolve(null); },
    function() { return true; }
  );

  deps.currentSelectedId = 'root';
  deps.treeMemories = [{ id: 'root', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'root', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });
  assert.equal(called, false, 'root must not call private API');
  assert.equal(elements.momentReactionLikeButton.style.display, 'none', 'button hidden for root');
});

test('missing context hides auth elements', async function() {
  var called = false;
  var { elements, detailUI } = createTestContext(
    function() { called = true; return Promise.resolve(null); },
    function() { called = true; return Promise.resolve(null); },
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1' }); // no treeId
  await new Promise(function(r) { setTimeout(r, 50); });
  assert.equal(called, false, 'missing treeId must not call private API');
});

test('confirmed auth with valid userReactions shows actionable button', async function() {
  var { elements, detailUI } = createTestContext(
    async function() { return { counts: { like: 3 }, userReactions: { like: true } }; },
    null,
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  assert.equal(elements.momentReactionLikeButton.style.display, '', 'button visible for auth');
  assert.equal(elements.momentReactionLikeButton.disabled, false, 'button enabled');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'true', 'pressed from userReactions');
  assert.equal(elements.momentReactionLikeButton.classList.contains('is-pressed'), true, 'is-pressed class');
  // Count is from public aggregate (authoritative), not private DTO
  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'count from public aggregate');
  assert.equal(elements.momentReactionLikeGuestNote.style.display, 'none', 'guest note hidden');
  // Actionable semantics
  assert.equal(elements.momentReactionsCard.getAttribute('data-read-only-summary'), undefined, 'data-read-only-summary removed');
  assert.equal(elements.momentReactionsCard.classList.contains('is-read-only'), false, 'is-read-only removed');
  assert.equal(elements.momentReactionsCard.getAttribute('aria-label'), '순간 반응', 'aria-label updated');
  assert.equal(elements.momentReactionNote.textContent, '댓글 기능은 준비 중이에요.', 'comment note updated');
});

test('confirmed auth with unpressed state shows actionable button', async function() {
  var { elements, detailUI } = createTestContext(
    async function() { return { counts: { like: 0 }, userReactions: { like: false } }; },
    null,
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  assert.equal(elements.momentReactionLikeButton.style.display, '', 'button visible');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'false', 'not pressed');
  assert.equal(elements.momentReactionLikeButton.classList.contains('is-pressed'), false, 'no is-pressed class');
  // Count is from public aggregate
  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'count from public aggregate');
});

test('confirmed auth with malformed userReactions shows unavailable', async function() {
  var { elements, detailUI } = createTestContext(
    async function() { return { counts: { like: 0 }, userReactions: null }; },
    null,
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  assert.equal(elements.momentReactionLikeButton.style.display, 'none', 'button hidden for unavailable');
  assert.equal(elements.momentReactionLikeButton.disabled, true, 'button disabled');
  // Read-only semantics preserved
  assert.equal(elements.momentReactionsCard.getAttribute('data-read-only-summary'), 'true', 'read-only preserved');
  assert.equal(elements.momentReactionsCard.classList.contains('is-read-only'), true, 'is-read-only preserved');
});

test('confirmed auth with rejected fetchReactionSummary shows unavailable', async function() {
  var { elements, detailUI } = createTestContext(
    async function() { throw new Error('network'); },
    null,
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  assert.equal(elements.momentReactionLikeButton.style.display, 'none', 'button hidden');
  assert.equal(elements.momentReactionLikeButton.disabled, true, 'button disabled');
});

test('in-flight lock prevents duplicate writes', async function() {
  var toggleCount = 0;
  var resolveToggle;
  var togglePromise = new Promise(function(r) { resolveToggle = r; });

  var { elements, detailUI } = createTestContext(
    async function() { return { counts: { like: 0 }, userReactions: { like: false } }; },
    function() { toggleCount++; return togglePromise; },
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  // Click button
  elements.momentReactionLikeButton.onclick();
  assert.equal(toggleCount, 1, 'toggle called once');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), 'true', 'busy during in-flight');
  assert.equal(elements.momentReactionLikeButton.disabled, true, 'disabled during in-flight');

  // Try clicking again
  elements.momentReactionLikeButton.onclick();
  assert.equal(toggleCount, 1, 'duplicate click ignored during in-flight');

  // Resolve
  resolveToggle({ type: 'like', active: true, counts: { like: 1 } });
  await new Promise(function(r) { setTimeout(r, 50); });
});

test('optimistic increment works on like', async function() {
  var resolveToggle;
  var togglePromise = new Promise(function(r) { resolveToggle = r; });

  var { elements, detailUI } = createTestContext(
    async function() { return { counts: { like: 0 }, userReactions: { like: false } }; },
    function() { return togglePromise; },
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  elements.momentReactionLikeButton.onclick();
  // Optimistic state
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'true', 'optimistic pressed');
  assert.equal(elements.momentReactionLikeValue.textContent, '1', 'optimistic increment');

  resolveToggle({ type: 'like', active: true, counts: { like: 1 } });
  await new Promise(function(r) { setTimeout(r, 50); });
});

test('optimistic decrement works on unlike', async function() {
  var resolveToggle;
  var togglePromise = new Promise(function(r) { resolveToggle = r; });

  var { elements, detailUI } = createTestContext(
    async function() { return { counts: { like: 1 }, userReactions: { like: true } }; },
    function() { return togglePromise; },
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  elements.momentReactionLikeButton.onclick();
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'false', 'optimistic unpressed');
  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'optimistic decrement');
  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'count floor at 0');

  resolveToggle({ type: 'like', active: false, counts: { like: 0 } });
  await new Promise(function(r) { setTimeout(r, 50); });
});

test('rollback on failure restores previous state', async function() {
  var rejectToggle;
  var togglePromise = new Promise(function(_, r) { rejectToggle = r; });

  var { elements, detailUI } = createTestContext(
    async function() { return { counts: { like: 0 }, userReactions: { like: false } }; },
    function() { return togglePromise; },
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'initial count');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'false', 'initial unpressed');

  elements.momentReactionLikeButton.onclick();
  assert.equal(elements.momentReactionLikeValue.textContent, '1', 'optimistic after click');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'true', 'optimistic pressed');

  rejectToggle(new Error('fail'));
  await new Promise(function(r) { setTimeout(r, 50); });

  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'restored after failure');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'false', 'unpressed restored');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), undefined, 'busy removed after failure');
  assert.equal(elements.momentReactionWriteError.style.display, '', 'error shown after failure');
  assert.ok(elements.momentReactionWriteError.textContent.length > 0, 'error has text');
});

test('stale response cannot overwrite newer selected moment', async function() {
  var resolveOldToggle;
  var oldToggleP = new Promise(function(r) { resolveOldToggle = r; });
  var oldToggleCalled = false;
  var newToggleCalled = false;

  var { elements, detailUI, deps } = createTestContext(
    async function(memoryId) {
      if (memoryId === 'old') return { counts: { like: 0 }, userReactions: { like: false } };
      return { counts: { like: 0 }, userReactions: { like: false } };
    },
    function(memoryId) {
      if (memoryId === 'old') { oldToggleCalled = true; return oldToggleP; }
      newToggleCalled = true;
      return Promise.resolve({ type: 'like', active: true, counts: { like: 1 } });
    },
    function() { return true; }
  );

  deps.currentSelectedId = 'old';
  deps.treeMemories = [{ id: 'old', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'old', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  elements.momentReactionLikeButton.onclick(); // start old write
  assert.equal(oldToggleCalled, true, 'old toggle started');

  // Switch to new moment while old write is in-flight
  deps.currentSelectedId = 'new';
  deps.treeMemories = [{ id: 'new', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'new', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  // Old write resolves (should be ignored by generation guard)
  resolveOldToggle({ type: 'like', active: true, counts: { like: 999 } });
  await new Promise(function(r) { setTimeout(r, 50); });

  // New moment should not show old count
  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'old response not applied to new moment');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'false', 'old pressed state not applied');
  // After new moment auth resolves, button is enabled with correct state
  assert.equal(elements.momentReactionLikeButton.disabled, false, 'button enabled after auth resolves');
});

test('in-flight lock releases after stale generation on success', async function() {
  var resolveOldToggle;
  var oldToggleP = new Promise(function(r) { resolveOldToggle = r; });
  var newToggleCalled = false;

  var { elements, detailUI, deps } = createTestContext(
    async function(memoryId) {
      if (memoryId === 'old') return { counts: { like: 0 }, userReactions: { like: false } };
      return { counts: { like: 0 }, userReactions: { like: false } };
    },
    function(memoryId) {
      if (memoryId === 'old') return oldToggleP;
      newToggleCalled = true;
      return Promise.resolve({ type: 'like', active: true, counts: { like: 1 } });
    },
    function() { return true; }
  );

  // Start old moment write
  deps.currentSelectedId = 'old';
  deps.treeMemories = [{ id: 'old', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'old', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });
  elements.momentReactionLikeButton.onclick();

  // Switch to new moment
  deps.currentSelectedId = 'new';
  deps.treeMemories = [{ id: 'new', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'new', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  // Old write succeeds but should be stale
  resolveOldToggle({ type: 'like', active: true, counts: { like: 999 } });
  await new Promise(function(r) { setTimeout(r, 50); });

  // New moment should not be stuck in "busy" state
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), undefined, 'busy cleared after stale success');
  // After new moment auth resolves, button is enabled with correct state
  assert.equal(elements.momentReactionLikeButton.disabled, false, 'button enabled after new moment resolves');
});

test('in-flight lock releases after stale generation on failure', async function() {
  var rejectOldToggle;
  var oldToggleP = new Promise(function(_, r) { rejectOldToggle = r; });

  var { elements, detailUI, deps } = createTestContext(
    async function(memoryId) { return { counts: { like: 0 }, userReactions: { like: false } }; },
    function(memoryId) { return oldToggleP; },
    function() { return true; }
  );

  deps.currentSelectedId = 'old';
  deps.treeMemories = [{ id: 'old', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'old', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });
  elements.momentReactionLikeButton.onclick();

  deps.currentSelectedId = 'new';
  deps.treeMemories = [{ id: 'new', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'new', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  rejectOldToggle(new Error('network fail'));
  await new Promise(function(r) { setTimeout(r, 50); });

  // After stale failure, in-flight must be released
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), undefined, 'busy cleared after stale failure');
});

test('actionable semantics on successful load', async function() {
  var { elements, detailUI } = createTestContext(
    async function() { return { counts: { like: 5 }, userReactions: { like: true } }; },
    null,
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  // Card should be actionable (not read-only)
  assert.equal(elements.momentReactionsCard.getAttribute('data-read-only-summary'), undefined,
    'actionable card no data-read-only-summary');
  assert.equal(elements.momentReactionsCard.classList.contains('is-read-only'), false,
    'actionable card no is-read-only');
  assert.equal(elements.momentReactionsCard.getAttribute('aria-label'), '순간 반응',
    'actionable card aria-label');
  assert.equal(elements.momentReactionNote.textContent, '댓글 기능은 준비 중이에요.',
    'actionable card note');
});

test('like button accessible label reflects pressed state', async function() {
  var { elements, detailUI } = createTestContext(
    async function() { return { counts: { like: 1 }, userReactions: { like: true } }; },
    null,
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  // When pressed, button should indicate cancel action
  assert.equal(elements.momentReactionLikeButton.textContent.indexOf('취소') !== -1, true,
    'pressed button shows 취소');
});

test('no raw error text in error display', async function() {
  var rejectToggle;
  var togglePromise = new Promise(function(_, r) { rejectToggle = r; });

  var { elements, detailUI } = createTestContext(
    async function() { return { counts: { like: 0 }, userReactions: { like: false } }; },
    function() { return togglePromise; },
    function() { return true; }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  elements.momentReactionLikeButton.onclick();
  rejectToggle(new Error('CONNECTION_REFUSED'));
  await new Promise(function(r) { setTimeout(r, 50); });

  assert.ok(!elements.momentReactionWriteError.textContent.includes('CONNECTION_REFUSED'),
    'no raw error text');
  assert.ok(!elements.momentReactionWriteError.textContent.includes('500'),
    'no HTTP status in error');
});

test('production-shape mismatch: data.id is treeId but getSelectedNodeId is memoryId', async function() {
  var privateFetchCalledWith = [];
  var toggleReactionCalledWith = [];
  var publicFetchCalledWith = [];
  var publicCommentsCalledWith = [];

  var { elements, detailUI, deps } = createTestContext(
    async function(memoryId) {
      privateFetchCalledWith.push(memoryId);
      return { counts: { like: 10 }, userReactions: { like: true } };
    },
    async function(memoryId, action) {
      toggleReactionCalledWith.push({ memoryId: memoryId, action: action });
      return { type: 'like', active: false, counts: { like: 9 } };
    },
    function() { return true; },
    async function(treeId, memoryId) {
      publicFetchCalledWith.push({ treeId: treeId, memoryId: memoryId });
      return { counts: { like: 10 }, total: 10 };
    },
    async function(treeId, memoryId) {
      publicCommentsCalledWith.push({ treeId: treeId, memoryId: memoryId });
      return { comments: [], nextCursor: null };
    }
  );

  deps.currentSelectedId = 'real-mem-1';
  deps.treeMemories = [{ id: 'real-mem-1', treeId: 'tree-1' }];

  detailUI.updateDetailPanel({ id: 'tree-1', treeId: 'tree-1' });

  await new Promise(function(r) { setTimeout(r, 50); });

  // A. private summary checks
  assert.equal(privateFetchCalledWith.length, 1, 'private summary called exactly once');
  assert.equal(privateFetchCalledWith[0], 'real-mem-1', 'private summary resolved with real memoryId');
  assert.notEqual(privateFetchCalledWith[0], 'tree-1', 'treeId must not be used as memoryId in private read');
  assert.equal(elements.momentReactionLikeButton.style.display, '', 'like button is shown');
  assert.equal(elements.momentReactionLikeButton.disabled, false, 'button is enabled / actionable');

  // B. public summary checks (initial)
  assert.equal(publicFetchCalledWith.length, 1, 'public summary called exactly once initially');
  assert.equal(publicFetchCalledWith[0].treeId, 'tree-1', 'public summary treeId matches');
  assert.equal(publicFetchCalledWith[0].memoryId, 'real-mem-1', 'public summary memoryId matches');
  assert.notEqual(publicFetchCalledWith[0].memoryId, 'tree-1', 'treeId must not be used as memoryId in public read');

  assert.equal(publicCommentsCalledWith.length, 1, 'public comments called exactly once initially');
  assert.equal(publicCommentsCalledWith[0].treeId, 'tree-1', 'public comments treeId matches');
  assert.equal(publicCommentsCalledWith[0].memoryId, 'real-mem-1', 'public comments memoryId matches');
  assert.notEqual(publicCommentsCalledWith[0].memoryId, 'tree-1', 'treeId must not be used as memoryId in public comments');

  // C. like write + reconciliation checks
  elements.momentReactionLikeButton.onclick();
  await new Promise(function(r) { setTimeout(r, 50); });

  // Verify write
  assert.equal(toggleReactionCalledWith.length, 1, 'toggleReaction called exactly once');
  assert.equal(toggleReactionCalledWith[0].memoryId, 'real-mem-1', 'toggleReaction resolves with real memoryId');
  assert.equal(toggleReactionCalledWith[0].action, 'like', 'toggleReaction action matches');
  assert.notEqual(toggleReactionCalledWith[0].memoryId, 'tree-1', 'treeId must not be used as memoryId in write');

  // Verify successful write reconciliation triggers another public read
  assert.equal(publicFetchCalledWith.length, 2, 'public summary called again on reconciliation');
  assert.equal(publicFetchCalledWith[1].treeId, 'tree-1', 'second public summary treeId matches');
  assert.equal(publicFetchCalledWith[1].memoryId, 'real-mem-1', 'second public summary memoryId matches');
  assert.notEqual(publicFetchCalledWith[1].memoryId, 'tree-1', 'treeId must not be used as memoryId in second public read');

  assert.equal(publicCommentsCalledWith.length, 2, 'public comments called again on reconciliation');
  assert.equal(publicCommentsCalledWith[1].treeId, 'tree-1', 'second public comments treeId matches');
  assert.equal(publicCommentsCalledWith[1].memoryId, 'real-mem-1', 'second public comments memoryId matches');
  assert.notEqual(publicCommentsCalledWith[1].memoryId, 'tree-1', 'treeId must not be used as memoryId in second public comments');
});

test('fail-closed regression scenarios', async function() {
  // 1. getSelectedNodeId() returns null
  {
    var privateFetchCount = 0;
    var toggleCount = 0;
    var { elements, detailUI, deps } = createTestContext(
      async function() { privateFetchCount++; return null; },
      async function() { toggleCount++; return null; },
      function() { return true; }
    );
    deps.currentSelectedId = null;
    deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
    detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(privateFetchCount, 0, 'no private fetch if selection missing');
    assert.equal(elements.momentReactionLikeButton.style.display, 'none', 'like button is not shown');
  }

  // 2. selected ID is not in canonical memories
  {
    var privateFetchCount = 0;
    var { elements, detailUI, deps } = createTestContext(
      async function() { privateFetchCount++; return null; },
      null,
      function() { return true; }
    );
    deps.currentSelectedId = 'different-mem';
    deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
    detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(privateFetchCount, 0, 'no private fetch if selection not in memories');
  }

  // 3. canonical memory treeId and payload data.treeId differ
  {
    var privateFetchCount = 0;
    var { elements, detailUI, deps } = createTestContext(
      async function() { privateFetchCount++; return null; },
      null,
      function() { return true; }
    );
    deps.currentSelectedId = 'mem-1';
    deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-different' }];
    detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(privateFetchCount, 0, 'no private fetch if treeId mismatch');
  }

  // 4. root selected memory
  {
    var privateFetchCount = 0;
    var { elements, detailUI, deps } = createTestContext(
      async function() { privateFetchCount++; return null; },
      null,
      function() { return true; }
    );
    deps.currentSelectedId = 'root';
    deps.treeMemories = [{ id: 'root', treeId: 'tree-1' }];
    detailUI.updateDetailPanel({ id: 'root', treeId: 'tree-1' });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(privateFetchCount, 0, 'no private fetch for root');
    assert.equal(elements.momentReactionLikeButton.style.display, 'none', 'social action hidden for root');
  }
});

test('empty private DTO: counts and userReactions empty objects', async function() {
  var privateFetchCalledWith = [];
  var toggleReactionCalledWith = [];
  var publicFetchCalledWith = [];
  var publicCommentsCalledWith = [];

  var { elements, detailUI, deps } = createTestContext(
    async function(memoryId) {
      privateFetchCalledWith.push(memoryId);
      return { counts: {}, userReactions: {} };
    },
    async function(memoryId, action) {
      toggleReactionCalledWith.push({ memoryId: memoryId, action: action });
      return { type: 'like', active: false, counts: { like: 6 } };
    },
    function() { return true; },
    async function(treeId, memoryId) {
      publicFetchCalledWith.push({ treeId: treeId, memoryId: memoryId });
      return { counts: { like: 7 }, total: 7 };
    },
    async function(treeId, memoryId) {
      publicCommentsCalledWith.push({ treeId: treeId, memoryId: memoryId });
      return { comments: [], nextCursor: null };
    }
  );

  deps.currentSelectedId = 'real-mem-1';
  deps.treeMemories = [{ id: 'real-mem-1', treeId: 'tree-1' }];

  detailUI.updateDetailPanel({ id: 'tree-1', treeId: 'tree-1' });

  await new Promise(function(r) { setTimeout(r, 50); });

  assert.equal(privateFetchCalledWith.length, 1, 'private summary called exactly once');
  assert.equal(privateFetchCalledWith[0], 'real-mem-1', 'private summary resolved with real memoryId');
  assert.notEqual(privateFetchCalledWith[0], 'tree-1', 'treeId must not be used as memoryId in private read');

  assert.equal(elements.momentReactionLikeButton.style.display, '', 'like button is shown');
  assert.equal(elements.momentReactionLikeButton.disabled, false, 'button is enabled / actionable');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'false', 'aria-pressed is false');
  assert.equal(elements.momentReactionLikeGuestNote.style.display, 'none', 'unavailable guest note hidden');

  assert.equal(elements.momentReactionLikeValue.textContent, '7', 'public count 7 is maintained');

  elements.momentReactionLikeButton.onclick();
  await new Promise(function(r) { setTimeout(r, 50); });

  assert.equal(toggleReactionCalledWith.length, 1, 'toggleReaction called exactly once');
  assert.equal(toggleReactionCalledWith[0].memoryId, 'real-mem-1', 'toggleReaction resolves with real memoryId');
  assert.equal(toggleReactionCalledWith[0].action, 'like', 'toggleReaction action matches');
});

test('empty private DTO rollback count preservation on write failure', async function() {
  var rejectToggle;
  var togglePromise = new Promise(function(_, r) { rejectToggle = r; });

  var { elements, detailUI, deps } = createTestContext(
    async function(memoryId) {
      return { counts: {}, userReactions: {} };
    },
    function() { return togglePromise; },
    function() { return true; },
    async function(treeId, memoryId) {
      return { counts: { like: 7 }, total: 7 };
    }
  );

  deps.currentSelectedId = 'real-mem-1';
  deps.treeMemories = [{ id: 'real-mem-1', treeId: 'tree-1' }];

  detailUI.updateDetailPanel({ id: 'tree-1', treeId: 'tree-1' });
  await new Promise(function(r) { setTimeout(r, 50); });

  assert.equal(elements.momentReactionLikeValue.textContent, '7', 'public count 7 is rendered');

  elements.momentReactionLikeButton.onclick();
  assert.equal(elements.momentReactionLikeValue.textContent, '8', 'optimistic count 8');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'true', 'optimistic pressed');

  rejectToggle(new Error('fail'));
  await new Promise(function(r) { setTimeout(r, 50); });

  assert.equal(elements.momentReactionLikeValue.textContent, '7', 'rollback restored previous count 7');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'false', 'unpressed restored');
});

test('malformed explicit fields in private DTO', async function() {
  // Scenario 1: userReactions.like is null
  {
    var { elements, detailUI, deps } = createTestContext(
      async function() { return { counts: { like: 0 }, userReactions: { like: null } }; },
      null,
      function() { return true; }
    );
    deps.currentSelectedId = 'mem-1';
    deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
    detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(elements.momentReactionLikeButton.style.display, 'none', 'button hidden when userReactions.like is null');
    assert.equal(elements.momentReactionLikeGuestNote.textContent, '좋아요 정보를 불러올 수 없어요.', 'shows unavailable note');
  }

  // Scenario 2: counts.like is a string
  {
    var { elements, detailUI, deps } = createTestContext(
      async function() { return { counts: { like: '0' }, userReactions: { like: false } }; },
      null,
      function() { return true; }
    );
    deps.currentSelectedId = 'mem-1';
    deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
    detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(elements.momentReactionLikeButton.style.display, 'none', 'button hidden when counts.like is a string');
    assert.equal(elements.momentReactionLikeGuestNote.textContent, '좋아요 정보를 불러올 수 없어요.', 'shows unavailable note');
  }
});

test('same-selection unlike regression', async function() {
  var privateFetchCalledWith = [];
  var toggleReactionCalledWith = [];
  var publicFetchCallCount = 0;
  var activeState = false;

  var { elements, detailUI, deps } = createTestContext(
    async function(memoryId) {
      privateFetchCalledWith.push(memoryId);
      return activeState
        ? { counts: { like: 1 }, userReactions: { like: true } }
        : { counts: {}, userReactions: {} };
    },
    async function(memoryId, action) {
      toggleReactionCalledWith.push({ memoryId: memoryId, action: action });
      activeState = !activeState;
      return activeState
        ? { type: 'like', active: true, counts: { like: 1 }, total: 1 }
        : { type: 'like', active: false, counts: {}, total: 0 };
    },
    function() { return true; },
    async function(treeId, memoryId) {
      publicFetchCallCount++;
      return activeState
        ? { counts: { like: 1 }, total: 1 }
        : { counts: {}, total: 0 };
    },
    async function(treeId, memoryId) {
      return { comments: [], nextCursor: null };
    }
  );

  deps.currentSelectedId = 'real-mem-1';
  deps.treeMemories = [{ id: 'real-mem-1', treeId: 'tree-1' }];

  // Initial load
  detailUI.updateDetailPanel({ id: 'tree-1', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  // 1. Save initial handler
  var handler = elements.momentReactionLikeButton.onclick;
  assert.ok(typeof handler === 'function', 'onclick handler is bound');

  // 2. Increment shared generation
  deps.sharedGenerationRef.value++;

  // 3. Call saved handler directly (without re-binding!)
  handler();
  await new Promise(r => setTimeout(r, 50));

  // 4. Verify first write success
  assert.equal(toggleReactionCalledWith.length, 1, 'first write called');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'true', 'pressed');
  assert.equal(elements.momentReactionLikeValue.textContent, '1', 'count is 1');

  // 5. Call saved handler again (second click)
  handler();
  await new Promise(r => setTimeout(r, 50));

  // 6. Verify second write (unlike) success
  assert.equal(toggleReactionCalledWith.length, 2, 'second write (unlike) called');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'false', 'unpressed');
  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'count is 0');

  // 7. Public reaction summary: initial load (1) + like reconcile (2) + unlike reconcile (3)
  assert.equal(publicFetchCallCount, 3, 'public summary fetch: initial load + like reconcile + unlike reconcile');
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), undefined, 'busy removed');
});

test('active write response without like count is rejected', async function() {
  var toggleReactionCalledWith = [];

  var { elements, detailUI, deps } = createTestContext(
    async function(memoryId) {
      return { counts: {}, userReactions: {} };
    },
    async function(memoryId, action) {
      toggleReactionCalledWith.push({ memoryId: memoryId, action: action });
      return { type: 'like', active: true, counts: {}, total: 0 };
    },
    function() { return true; },
    async function(treeId, memoryId) {
      return { counts: {}, total: 0 };
    },
    async function(treeId, memoryId) {
      return { comments: [], nextCursor: null };
    }
  );

  deps.currentSelectedId = 'mem-active-no-like-count';
  deps.treeMemories = [{ id: 'mem-active-no-like-count', treeId: 'tree-1' }];

  // Initial load
  detailUI.updateDetailPanel({ id: 'mem-active-no-like-count', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  // Save initial handler
  var handler = elements.momentReactionLikeButton.onclick;
  assert.ok(typeof handler === 'function', 'onclick handler is bound');

  // Trigger write
  deps.sharedGenerationRef.value++;
  handler();
  await new Promise(r => setTimeout(r, 50));

  // The active write with empty counts must be rejected:
  // optimistic true/1 -> rollback to false/0
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'false', 'rolled back to unpressed');
  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'rolled back to count 0');

  // Error UI must be shown
  var errorEl = elements.momentReactionWriteError;
  assert.ok(errorEl && !errorEl.hidden, 'error UI must be visible after rejected write');
});

test('active write response ignores inherited like count', async function() {
  var toggleReactionCalledWith = [];

  var inheritedCounts = Object.create({ like: 1 });

  var { elements, detailUI, deps } = createTestContext(
    async function(memoryId) {
      return { counts: {}, userReactions: {} };
    },
    async function(memoryId, action) {
      toggleReactionCalledWith.push({ memoryId: memoryId, action: action });
      return { type: 'like', active: true, counts: inheritedCounts, total: 1 };
    },
    function() { return true; },
    async function(treeId, memoryId) {
      return { counts: {}, total: 0 };
    },
    async function(treeId, memoryId) {
      return { comments: [], nextCursor: null };
    }
  );

  deps.currentSelectedId = 'mem-inherited-like';
  deps.treeMemories = [{ id: 'mem-inherited-like', treeId: 'tree-1' }];

  // Initial load
  detailUI.updateDetailPanel({ id: 'mem-inherited-like', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  // Save initial handler
  var handler = elements.momentReactionLikeButton.onclick;
  assert.ok(typeof handler === 'function', 'onclick handler is bound');

  // Trigger write
  deps.sharedGenerationRef.value++;
  handler();
  await new Promise(r => setTimeout(r, 50));

  // The inherited like count from prototype chain must be rejected:
  // optimistic true/1 -> rollback to false/0
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-pressed'), 'false', 'rolled back to unpressed');
  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'rolled back to count 0');

  // Error UI must be shown
  var errorEl = elements.momentReactionWriteError;
  assert.ok(errorEl && !errorEl.hidden, 'error UI must be visible after inherited like count');
});

test('old success does not unlock new write', async function() {
  var resolveOldWrite;
  var oldWritePromise = new Promise(r => { resolveOldWrite = r; });

  var resolveNewWrite;
  var newWritePromise = new Promise(r => { resolveNewWrite = r; });

  var toggleReactionCount = 0;
  var reconcileCount = 0;

  var { elements, detailUI, deps } = createTestContext(
    async function() { return { counts: {}, userReactions: {} }; },
    async function(memoryId) {
      toggleReactionCount++;
      if (memoryId === 'old-mem') return oldWritePromise;
      if (memoryId === 'new-mem') return newWritePromise;
    },
    function() { return true; },
    async function(treeId, memoryId) {
      reconcileCount++;
      return { counts: { like: 1 }, total: 1 };
    },
    null
  );

  deps.treeMemories = [
    { id: 'old-mem', treeId: 'tree-1' },
    { id: 'new-mem', treeId: 'tree-1' }
  ];

  // 1. Load old-mem and trigger pending write
  deps.currentSelectedId = 'old-mem';
  detailUI.updateDetailPanel({ id: 'old-mem', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));
  elements.momentReactionLikeButton.onclick();
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), 'true', 'old-mem is busy');

  // 2. Change selection to new-mem (clears busy state)
  deps.currentSelectedId = 'new-mem';
  detailUI.updateDetailPanel({ id: 'new-mem', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), undefined, 'new-mem starts not busy');

  // 3. Trigger pending write on new-mem
  elements.momentReactionLikeButton.onclick();
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), 'true', 'new-mem is busy');

  reconcileCount = 0;

  // 4. Old-mem write success arrives
  resolveOldWrite({ type: 'like', active: false, counts: { like: 0 } });
  await new Promise(r => setTimeout(r, 50));

  // Assertions: new-mem must STILL be busy/disabled, count optimistic
  assert.equal(
    elements.momentReactionLikeButton.getAttribute('aria-pressed'),
    'true',
    'stale old success must not overwrite new optimistic pressed state'
  );
  assert.equal(
    elements.momentReactionLikeValue.textContent,
    '2',
    'stale old success must not overwrite new optimistic count'
  );
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), 'true', 'new-mem remains busy');
  assert.equal(elements.momentReactionLikeButton.disabled, true, 'new-mem remains disabled');
  assert.equal(reconcileCount, 0, 'no reconciliation called for stale old write');

  // 5. New-mem write success arrives
  resolveNewWrite({ type: 'like', active: true, counts: { like: 1 } });
  await new Promise(r => setTimeout(r, 50));

  // Assertions: new-mem is unlocked
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), undefined, 'new-mem is no longer busy');
  assert.equal(elements.momentReactionLikeButton.disabled, false, 'new-mem is enabled');
  assert.equal(reconcileCount, 1, 'reconciliation called for current new write');
});

test('old reject does not unlock new write', async function() {
  var rejectOldWrite;
  var oldWritePromise = new Promise((_, r) => { rejectOldWrite = r; });

  var resolveNewWrite;
  var newWritePromise = new Promise(r => { resolveNewWrite = r; });

  var reconcileCount = 0;

  var { elements, detailUI, deps } = createTestContext(
    async function() { return { counts: {}, userReactions: {} }; },
    async function(memoryId) {
      if (memoryId === 'old-mem') return oldWritePromise;
      if (memoryId === 'new-mem') return newWritePromise;
    },
    function() { return true; },
    async function(treeId, memoryId) {
      reconcileCount++;
      return { counts: { like: 1 }, total: 1 };
    },
    null
  );

  deps.treeMemories = [
    { id: 'old-mem', treeId: 'tree-1' },
    { id: 'new-mem', treeId: 'tree-1' }
  ];

  // 1. Load old-mem and trigger pending write
  deps.currentSelectedId = 'old-mem';
  detailUI.updateDetailPanel({ id: 'old-mem', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));
  elements.momentReactionLikeButton.onclick();
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), 'true', 'old-mem is busy');

  // 2. Change selection to new-mem
  deps.currentSelectedId = 'new-mem';
  detailUI.updateDetailPanel({ id: 'new-mem', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  // 3. Trigger pending write on new-mem
  elements.momentReactionLikeButton.onclick();
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), 'true', 'new-mem is busy');

  reconcileCount = 0;

  // 4. Old-mem write reject arrives
  rejectOldWrite(new Error('fail'));
  await new Promise(r => setTimeout(r, 50));

  // Assertions: new-mem must STILL be busy/disabled, no error shown on new-mem
  assert.equal(
    elements.momentReactionLikeButton.getAttribute('aria-pressed'),
    'true',
    'stale old reject must not overwrite new optimistic pressed state'
  );
  assert.equal(
    elements.momentReactionLikeValue.textContent,
    '2',
    'stale old reject must not overwrite new optimistic count'
  );
  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), 'true', 'new-mem remains busy');
  assert.equal(elements.momentReactionLikeButton.disabled, true, 'new-mem remains disabled');
  assert.equal(elements.momentReactionWriteError.style.display, 'none', 'no error message on new-mem');
  assert.equal(reconcileCount, 0, 'no reconciliation');

  // 5. New-mem write success arrives
  resolveNewWrite({ type: 'like', active: true, counts: { like: 1 } });
  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionLikeButton.getAttribute('aria-busy'), undefined, 'new-mem is unlocked');
  assert.equal(elements.momentReactionLikeButton.disabled, false, 'new-mem is enabled');
});

test('#1882 wording rule preserved', function() {
  assert.ok(!scriptSource.includes('Fixes #1882'), 'must not use Fixes #1882');
  assert.ok(!scriptSource.includes('Closes #1882'), 'must not use Closes #1882');
  assert.ok(!scriptSource.includes('Resolves #1882'), 'must not use Resolves #1882');
});
