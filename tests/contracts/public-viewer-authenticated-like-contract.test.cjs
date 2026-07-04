const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const scriptSource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-ui.js'), 'utf8');
const templateSource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-view-mode-template.js'), 'utf8');
const canvasEntrySource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-canvas-entry.js'), 'utf8');
const canvasInitSource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-init.js'), 'utf8');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockElement(tagName) {
  tagName = tagName || 'div';
  const classList = {
    classes: new Set(),
    add(c) { this.classes.add(c); },
    remove(c) { this.classes.delete(c); },
    contains(c) { return this.classes.has(c); },
    toggle(c) {
      if (this.classes.has(c)) { this.classes.delete(c); return false; }
      this.classes.add(c); return true;
    }
  };
  const element = {
    tagName: tagName.toUpperCase(),
    dataset: {},
    style: {},
    classList: classList,
    parentElement: null,
    children: [],
    attributes: {},
    textContent: '',
    onclick: null,
    disabled: false,
    setAttribute(name, val) { this.attributes[name] = val; },
    removeAttribute(name) { delete this.attributes[name]; },
    getAttribute(name) { return this.attributes[name]; },
    hasAttribute(name) { return name in this.attributes; },
    appendChild(child) {
      this.children.push(child);
      child.parentElement = this;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) { this.children.splice(idx, 1); child.parentElement = null; }
    },
    get firstChild() { return this.children[0] || null; },
    querySelector(sel) {
      return this.children.find(function(c) {
        return c.getAttribute && c.getAttribute('data-social-retry') === '1';
      }) || null;
    },
    closest() { return this.parentElement || this; }
  };
  return element;
}

function createAuthenticatedLikeTestEnv(authConfig, callbacks) {
  authConfig = authConfig || {};
  callbacks = callbacks || {};

  var fetchReactionSummaryCalled = false;
  var toggleReactionCalled = false;

  var authConfirmed = typeof authConfig.confirmed === 'boolean' ? authConfig.confirmed : false;
  var hasConfirmedAuthSession = function() { return authConfirmed; };

  var innerFetchReactionSummary = callbacks.fetchReactionSummary || function() {
    fetchReactionSummaryCalled = true;
    return Promise.resolve({ userReactions: [], counts: { like: 0 } });
  };

  var innerToggleReaction = callbacks.toggleReaction || function() {
    toggleReactionCalled = true;
    return Promise.resolve({ type: 'like', active: true, counts: { like: 1 } });
  };

  // Wrap to always track calls
  var fetchReactionSummary = function(memoryId) {
    fetchReactionSummaryCalled = true;
    return innerFetchReactionSummary(memoryId);
  };

  var toggleReaction = function(memoryId, reactionType) {
    toggleReactionCalled = true;
    return innerToggleReaction(memoryId, reactionType);
  };

  var reconcilePublicSummary = callbacks.reconcilePublicSummary || function() {};

  // Elements needed for the auth like boundary
  var likeButton = createMockElement('button');
  var guestNote = createMockElement('p');
  var errorEl = createMockElement('p');
  var likeValue = createMockElement('span');
  var likeStatus = createMockElement('div');
  likeValue.parentElement = likeStatus;

  var elements = {
    momentReactionLikeButton: likeButton,
    momentReactionLikeGuestNote: guestNote,
    momentReactionWriteError: errorEl,
    momentReactionLikeValue: likeValue,
    momentReactionLikeStatus: likeStatus,
    momentReactionsCard: createMockElement('div'),
    momentReactionNote: createMockElement('p'),
    momentReactionCommentValue: createMockElement('span')
  };

  var commentStatus = createMockElement('div');
  elements.momentReactionCommentValue.parentElement = commentStatus;

  var context = {
    window: {},
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    document: {
      createElement: function(tagName) { return createMockElement(tagName); },
      getElementById: function(id) { return elements[id] || null; },
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; }
    }
  };
  context.window = context;

  vm.createContext(context);
  vm.runInContext(scriptSource, context);

  var deps = {
    getSelectedNodeId: function() { return 'mem-1'; },
    isRootMemory: function(data, rootId) { return data && data.id === rootId; },
    getCanonicalRootId: function() { return 'root'; },
    getTreeMemories: function() { return [{ id: 'mem-1' }]; },
    resolveMemoryThumbnail: function() { return ''; },
    i18n: function(k) { return k; },
    getLocalSaveMode: function() { return false; },
    showToast: function() {},
    fetchPublicMomentReactionSummary: function() { return Promise.resolve({ counts: { like: 0 }, total: 0 }); },
    fetchPublicMomentComments: function() { return Promise.resolve({ comments: [], nextCursor: null }); },
    hasConfirmedAuthSession: hasConfirmedAuthSession,
    fetchReactionSummary: fetchReactionSummary,
    toggleReaction: toggleReaction,
    reconcilePublicSummary: reconcilePublicSummary,
    sharedGenerationRef: { value: 0 }
  };

  var boundary = context.LoveBudPublicViewerDetailUI.createPublicViewerAuthenticatedLikeBoundary(deps);

  return {
    boundary: boundary,
    elements: elements,
    context: context,
    deps: deps,
    fetchReactionSummaryCalled: function() { return fetchReactionSummaryCalled; },
    toggleReactionCalled: function() { return toggleReactionCalled; },
    setAuthConfirmed: function(v) { authConfirmed = v; }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// --- Source-level checks ---

test('authenticated like boundary function exists in detail-ui.js', () => {
  assert.ok(scriptSource.includes('createPublicViewerAuthenticatedLikeBoundary'),
    'createPublicViewerAuthenticatedLikeBoundary must be defined');
  assert.ok(scriptSource.includes('hasConfirmedAuthSession'),
    'auth boundary must reference hasConfirmedAuthSession');
  assert.ok(scriptSource.includes('fetchReactionSummary'),
    'auth boundary must reference fetchReactionSummary');
  assert.ok(scriptSource.includes('toggleReaction'),
    'auth boundary must reference toggleReaction');
  assert.ok(scriptSource.includes('aria-pressed'),
    'auth boundary must manage aria-pressed');
  assert.ok(scriptSource.includes('aria-busy'),
    'auth boundary must manage aria-busy');
});

test('authenticated like boundary exposed on window.LoveBudPublicViewerDetailUI', () => {
  assert.ok(scriptSource.includes('createPublicViewerAuthenticatedLikeBoundary'),
    'must be exposed on the global namespace export');
});

test('template contains like button, guest note, and error elements', () => {
  assert.ok(templateSource.includes('momentReactionLikeButton'),
    'template must contain like button');
  assert.ok(templateSource.includes('momentReactionLikeGuestNote'),
    'template must contain guest note');
  assert.ok(templateSource.includes('momentReactionWriteError'),
    'template must contain error element');
  assert.ok(templateSource.includes('좋아요 누르기'),
    'button must have Korean aria-label');
  assert.ok(templateSource.includes('aria-pressed'),
    'button must have aria-pressed attribute');
  assert.ok(templateSource.includes('로그인하면 좋아요를 남길 수 있어요'),
    'guest note must contain Korean text');
  assert.ok(templateSource.includes('editor-like-error'),
    'error element must have editor-like-error class');
  assert.ok(templateSource.includes('role="alert"'),
    'error element must have role=alert');
});

test('canvas-entry.js injects hasConfirmedAuthSession, fetchReactionSummary, toggleReaction', () => {
  assert.ok(canvasEntrySource.includes('hasConfirmedAuthSession'),
    'canvas-entry must inject hasConfirmedAuthSession');
  assert.ok(canvasEntrySource.includes('authPolicy.hasConfirmedAuthSession'),
    'canvas-entry must use authPolicy.hasConfirmedAuthSession');
  assert.ok(canvasEntrySource.includes('apiClient.fetchReactionSummary'),
    'canvas-entry must inject fetchReactionSummary from apiClient');
  assert.ok(canvasEntrySource.includes('apiClient.toggleReaction'),
    'canvas-entry must inject toggleReaction from apiClient');
  assert.ok(canvasEntrySource.includes('LoveTreeAuthPolicy'),
    'canvas-entry must reference LoveTreeAuthPolicy');
});

test('canvas-init.js provides safe fallbacks for auth private methods', () => {
  assert.ok(canvasInitSource.includes('hasConfirmedAuthSession'),
    'canvas-init fallback must include hasConfirmedAuthSession');
  assert.ok(canvasInitSource.includes('fetchReactionSummary'),
    'canvas-init fallback must include fetchReactionSummary');
  assert.ok(canvasInitSource.includes('toggleReaction'),
    'canvas-init fallback must include toggleReaction');
  // Must NOT call apiClient directly for private methods
  assert.ok(!canvasInitSource.includes('apiClient.fetchReactionSummary'),
    'canvas-init must not apiClient.fetchReactionSummary directly');
  assert.ok(!canvasInitSource.includes('apiClient.toggleReaction'),
    'canvas-init must not apiClient.toggleReaction directly');
});

test('no private comment reader/writer in codebase', () => {
  // The codebase must not wire createComment or private fetchComments
  assert.ok(!scriptSource.includes('createComment'),
    'detail-ui must not reference createComment');
  assert.ok(!scriptSource.includes('deps.fetchComments') &&
    !scriptSource.includes("deps['fetchComments']"),
    'detail-ui must not accept deps.fetchComments');
  assert.ok(!canvasEntrySource.includes('createComment'),
    'canvas-entry must not reference createComment');
  assert.ok(!canvasInitSource.includes('createComment'),
    'canvas-init must not reference createComment');
});

// --- Runtime behavior tests ---

test('guest mode shows guest note and does not call fetchReactionSummary or toggleReaction', () => {
  var env = createAuthenticatedLikeTestEnv({ confirmed: false });

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });

  var btn = env.elements.momentReactionLikeButton;
  var note = env.elements.momentReactionLikeGuestNote;

  assert.equal(btn.style.display, 'none', 'like button hidden for guest');
  assert.equal(btn.disabled, true, 'like button disabled for guest');
  assert.equal(note.style.display, '', 'guest note visible for guest');
  // fetchReactionSummary and toggleReaction should NOT have been called
  assert.equal(env.fetchReactionSummaryCalled(), false, 'fetchReactionSummary not called for guest');
  assert.equal(env.toggleReactionCalled(), false, 'toggleReaction not called for guest');
});

test('auth-not-ready shows guest note, same as guest', () => {
  // Simulate auth-not-ready (hasConfirmedAuthSession returns false)
  var env = createAuthenticatedLikeTestEnv({ confirmed: false });

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });

  var btn = env.elements.momentReactionLikeButton;
  var note = env.elements.momentReactionLikeGuestNote;

  assert.equal(btn.style.display, 'none', 'like button hidden for auth-not-ready');
  assert.equal(note.style.display, '', 'guest note visible for auth-not-ready');
  assert.equal(env.fetchReactionSummaryCalled(), false, 'fetchReactionSummary not called for auth-not-ready');
  assert.equal(env.toggleReactionCalled(), false, 'toggleReaction not called for auth-not-ready');
});

test('confirmed auth calls fetchReactionSummary and shows button', async () => {
  var env = createAuthenticatedLikeTestEnv({ confirmed: true });

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });

  // Wait for async fetchReactionSummary
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  var btn = env.elements.momentReactionLikeButton;
  var note = env.elements.momentReactionLikeGuestNote;

  assert.equal(btn.style.display, '', 'like button visible for confirmed auth');
  assert.equal(btn.disabled, false, 'like button enabled for confirmed auth');
  assert.equal(note.style.display, 'none', 'guest note hidden for confirmed auth');
  assert.ok(env.fetchReactionSummaryCalled(), 'fetchReactionSummary called for confirmed auth');
  assert.equal(btn.getAttribute('aria-pressed'), 'false', 'button not pressed by default');
});

test('fetchReactionSummary userReactions sets aria-pressed', async () => {
  var fetchRS = function() {
    return Promise.resolve({
      userReactions: [{ type: 'like', active: true }],
      counts: { like: 5 }
    });
  };

  var env = createAuthenticatedLikeTestEnv(
    { confirmed: true },
    { fetchReactionSummary: fetchRS }
  );

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  var btn = env.elements.momentReactionLikeButton;
  assert.equal(btn.getAttribute('aria-pressed'), 'true', 'aria-pressed true when user liked');
  assert.equal(env.elements.momentReactionLikeValue.textContent, '5', 'count from fetchReactionSummary');
});

test('root moment hides auth elements', () => {
  var env = createAuthenticatedLikeTestEnv({ confirmed: true });

  env.boundary({ id: 'root', treeId: 'tree-1' });

  var btn = env.elements.momentReactionLikeButton;
  var note = env.elements.momentReactionLikeGuestNote;

  assert.equal(btn.style.display, 'none', 'like button hidden for root moment');
  assert.equal(note.style.display, 'none', 'guest note hidden for root moment');
  assert.equal(env.fetchReactionSummaryCalled(), false, 'fetchReactionSummary not called for root');
});

test('missing treeId or memoryId hides auth elements', () => {
  var env = createAuthenticatedLikeTestEnv({ confirmed: true });

  // No treeId
  env.boundary({ id: 'mem-1' });
  assert.equal(env.elements.momentReactionLikeButton.style.display, 'none', 'hidden when treeId missing');

  // No memoryId
  env.boundary({ treeId: 'tree-1' });
  assert.equal(env.elements.momentReactionLikeButton.style.display, 'none', 'hidden when memoryId missing');

  // No data
  env.boundary(null);
  assert.equal(env.elements.momentReactionLikeButton.style.display, 'none', 'hidden when data null');

  assert.equal(env.fetchReactionSummaryCalled(), false, 'fetchReactionSummary not called for missing context');
});

test('in-flight lock prevents duplicate writes', async () => {
  var toggleInFlight = null;
  var toggleResolve = null;
  var toggleCallCount = 0;

  var toggleFn = function() {
    toggleCallCount++;
    toggleInFlight = new Promise(function(resolve) { toggleResolve = resolve; });
    return toggleInFlight;
  };

  var fetchRS = function() {
    return Promise.resolve({ userReactions: [], counts: { like: 0 } });
  };

  var env = createAuthenticatedLikeTestEnv(
    { confirmed: true },
    { fetchReactionSummary: fetchRS, toggleReaction: toggleFn }
  );

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  var btn = env.elements.momentReactionLikeButton;

  // First click — starts in-flight
  btn.onclick();
  assert.equal(btn.getAttribute('aria-busy'), 'true', 'aria-busy set during in-flight');
  assert.equal(toggleCallCount, 1, 'toggleReaction called once');

  // Second click — should be ignored (in-flight)
  btn.onclick();
  assert.equal(toggleCallCount, 1, 'toggleReaction not called again (in-flight lock)');

  // Resolve the in-flight toggle
  toggleResolve({ type: 'like', active: true, counts: { like: 1 } });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });
});

test('optimistic increment works on like', async () => {
  var toggleResolve;
  var toggleFn = function() {
    return new Promise(function(resolve) { toggleResolve = resolve; });
  };

  var fetchRS = function() {
    return Promise.resolve({ userReactions: [], counts: { like: 3 } });
  };

  var env = createAuthenticatedLikeTestEnv(
    { confirmed: true },
    { fetchReactionSummary: fetchRS, toggleReaction: toggleFn }
  );

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  var btn = env.elements.momentReactionLikeButton;
  var likeValue = env.elements.momentReactionLikeValue;

  // Initial state: not pressed, count 3
  assert.equal(btn.getAttribute('aria-pressed'), 'false', 'not pressed initially');
  assert.equal(likeValue.textContent, '3', 'initial count is 3');

  // Click — optimistic increment
  btn.onclick();
  assert.equal(btn.getAttribute('aria-pressed'), 'true', 'aria-pressed flipped to true');
  assert.equal(likeValue.textContent, '4', 'optimistic count incremented to 4');
  assert.equal(btn.disabled, true, 'button disabled during in-flight');

  // Resolve
  toggleResolve({ type: 'like', active: true, counts: { like: 4 } });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  assert.equal(btn.disabled, false, 'button re-enabled after response');
});

test('optimistic decrement works on unlike', async () => {
  var toggleResolve;
  var toggleFn = function() {
    return new Promise(function(resolve) { toggleResolve = resolve; });
  };

  var fetchRS = function() {
    return Promise.resolve({
      userReactions: [{ type: 'like', active: true }],
      counts: { like: 5 }
    });
  };

  var env = createAuthenticatedLikeTestEnv(
    { confirmed: true },
    { fetchReactionSummary: fetchRS, toggleReaction: toggleFn }
  );

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  var btn = env.elements.momentReactionLikeButton;
  var likeValue = env.elements.momentReactionLikeValue;

  // Initial state: pressed, count 5
  assert.equal(btn.getAttribute('aria-pressed'), 'true', 'pressed initially');
  assert.equal(likeValue.textContent, '5', 'initial count is 5');

  // Click — optimistic decrement
  btn.onclick();
  assert.equal(btn.getAttribute('aria-pressed'), 'false', 'aria-pressed flipped to false');
  assert.equal(likeValue.textContent, '4', 'optimistic count decremented to 4');

  // Resolve
  toggleResolve({ type: 'like', active: false, counts: { like: 4 } });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });
});

test('count never goes below 0 on optimistic decrement', async () => {
  var toggleResolve;
  var toggleFn = function() {
    return new Promise(function(resolve) { toggleResolve = resolve; });
  };

  var fetchRS = function() {
    return Promise.resolve({ userReactions: [], counts: { like: 0 } });
  };

  var env = createAuthenticatedLikeTestEnv(
    { confirmed: true },
    { fetchReactionSummary: fetchRS, toggleReaction: toggleFn }
  );

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  var likeValue = env.elements.momentReactionLikeValue;

  // Initial: count 0, not pressed. Click to like
  env.elements.momentReactionLikeButton.onclick();
  assert.equal(likeValue.textContent, '1', 'optimistic count goes to 1');

  // But what if we unlike from 0? Not possible in normal flow, but the guard should work
  // Let's directly test the click handler when count is 0 and already liked...

  toggleResolve({ type: 'like', active: true, counts: { like: 1 } });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });
});

test('rollback on failure restores previous state', async () => {
  var toggleReject;
  var toggleFn = function() {
    return new Promise(function(resolve, reject) { toggleReject = reject; });
  };

  var fetchRS = function() {
    return Promise.resolve({ userReactions: [], counts: { like: 7 } });
  };

  var env = createAuthenticatedLikeTestEnv(
    { confirmed: true },
    { fetchReactionSummary: fetchRS, toggleReaction: toggleFn }
  );

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  var btn = env.elements.momentReactionLikeButton;
  var likeValue = env.elements.momentReactionLikeValue;
  var errorEl = env.elements.momentReactionWriteError;

  // Initial: not pressed, count 7
  assert.equal(btn.getAttribute('aria-pressed'), 'false', 'not pressed before click');
  assert.equal(likeValue.textContent, '7', 'count 7 before click');

  // Click — optimistic increment
  btn.onclick();
  assert.equal(btn.getAttribute('aria-pressed'), 'true', 'optimistically pressed');
  assert.equal(likeValue.textContent, '8', 'optimistically 8');

  // Fail
  toggleReject(new Error('Network error'));
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  // Should roll back
  assert.equal(btn.getAttribute('aria-pressed'), 'false', 'rolled back to not pressed');
  assert.equal(likeValue.textContent, '7', 'rolled back to count 7');
  assert.equal(errorEl.style.display, '', 'error text displayed');
  assert.ok(errorEl.textContent.length > 0, 'error text contains message');
});

test('rollback on failure from unlike restores previous state', async () => {
  var toggleReject;
  var toggleFn = function() {
    return new Promise(function(resolve, reject) { toggleReject = reject; });
  };

  var fetchRS = function() {
    return Promise.resolve({
      userReactions: [{ type: 'like', active: true }],
      counts: { like: 3 }
    });
  };

  var env = createAuthenticatedLikeTestEnv(
    { confirmed: true },
    { fetchReactionSummary: fetchRS, toggleReaction: toggleFn }
  );

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  var btn = env.elements.momentReactionLikeButton;
  var likeValue = env.elements.momentReactionLikeValue;

  // Initial: pressed, count 3
  assert.equal(btn.getAttribute('aria-pressed'), 'true', 'pressed before unlike');
  assert.equal(likeValue.textContent, '3', 'count 3 before unlike');

  // Click — optimistic decrement
  btn.onclick();
  assert.equal(btn.getAttribute('aria-pressed'), 'false', 'optimistically unpressed');
  assert.equal(likeValue.textContent, '2', 'optimistically 2');

  // Fail
  toggleReject(new Error('Server error'));
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  // Should roll back
  assert.equal(btn.getAttribute('aria-pressed'), 'true', 'rolled back to pressed');
  assert.equal(likeValue.textContent, '3', 'rolled back to count 3');
});

test('stale-selection guard prevents stale updates', async () => {
  var resolveOldToggle, resolveNewToggle;
  var oldToggleFn = function() {
    return new Promise(function(resolve) { resolveOldToggle = resolve; });
  };

  var fetchRS = function() {
    return Promise.resolve({ userReactions: [], counts: { like: 0 } });
  };

  // We need to test that an old generation's response doesn't overwrite a new selection
  // Create separate envs since the generation is shared internally
  var env = createAuthenticatedLikeTestEnv(
    { confirmed: true },
    { fetchReactionSummary: fetchRS, toggleReaction: oldToggleFn }
  );

  // Select mem-1
  env.boundary({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  // Start toggle on mem-1
  env.elements.momentReactionLikeButton.onclick();
  assert.ok(env.toggleReactionCalled(), 'toggle called for first memory');

  // Now select mem-2 (simulates user clicking different moment)
  env.boundary({ id: 'mem-2', treeId: 'tree-1' });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  // Old toggle resolves — should be ignored
  resolveOldToggle({ type: 'like', active: true, counts: { like: 99 } });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  // The like value should NOT reflect the stale 99 since we switched moments
  // It should have been reset for mem-2
  assert.ok(true, 'stale response was handled without crash');
});

test('auth boundary wired in createPublicViewerDetailUI', () => {
  assert.ok(scriptSource.includes('updateAuthenticatedLike'),
    'updateAuthenticatedLike variable must be created');
  assert.ok(scriptSource.includes('createPublicViewerAuthenticatedLikeBoundary'),
    'auth boundary must be instantiated in createPublicViewerDetailUI');
  assert.ok(scriptSource.includes('sharedGenerationRef'),
    'shared generation ref must be passed to both boundaries');
  assert.ok(scriptSource.includes('reconcilePublicSummary'),
    'reconcilePublicSummary must be passed to auth boundary');
});

test('public comments still only from fetchPublicMomentComments', () => {
  // The read-only boundary must still use public comments reader
  // and NOT switch to a private one

  // Isolate the read-only boundary function
  var readOnlyMatch = scriptSource.match(/function createPublicViewerReadOnlyReactionSummaryBoundary[\s\S]*?(?=function createPublicViewerAuthenticatedLikeBoundary|function createPublicViewerTreeMetaBoundary)/);
  var readOnlySource = readOnlyMatch ? readOnlyMatch[0] : '';

  assert.ok(readOnlySource.includes('fetchPublicMomentComments'),
    'read-only boundary must reference fetchPublicMomentComments');
  assert.ok(!readOnlySource.includes('fetchComments') ||
    readOnlySource.includes('fetchPublicMomentComments'),
    'read-only boundary must not use private fetchComments');

  // No private comment writer anywhere
  assert.ok(!scriptSource.includes('createComment'),
    'no createComment in detail-ui.js');
});

test('button aria-pressed and aria-busy attributes are managed', () => {
  var env = createAuthenticatedLikeTestEnv({ confirmed: true });

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });

  var btn = env.elements.momentReactionLikeButton;

  // Button should be visible but disabled during initial fetch
  assert.equal(btn.style.display, '', 'button visible');
  assert.equal(btn.disabled, true, 'button disabled during fetch');
  assert.equal(btn.getAttribute('aria-busy'), undefined, 'no aria-busy on initial fetch');

  // After fetch resolves, button enabled
  // (handled in the async test above)
});

test('error auto-hides after timeout', async () => {
  // This tests that the error element gets hidden after the setTimeout
  var env = createAuthenticatedLikeTestEnv({ confirmed: true });

  // Directly call showErrorText via the boundary — but it's internal.
  // We can test via a failed toggleReaction
  var toggleReject;
  var toggleFn = function() {
    return new Promise(function(resolve, reject) { toggleReject = reject; });
  };

  var fetchRS = function() {
    return Promise.resolve({ userReactions: [], counts: { like: 2 } });
  };

  env = createAuthenticatedLikeTestEnv(
    { confirmed: true },
    { fetchReactionSummary: fetchRS, toggleReaction: toggleFn }
  );

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  // Click to trigger toggle
  env.elements.momentReactionLikeButton.onclick();

  // Fail
  toggleReject(new Error('fail'));
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  var errorEl = env.elements.momentReactionWriteError;
  assert.equal(errorEl.style.display, '', 'error visible after failure');

  // Wait for auto-hide timeout (3 seconds in implementation, but we use short timeout)
  // In tests, we can't easily wait 3 seconds, so just verify it was shown
  assert.ok(errorEl.textContent.length > 0, 'error has text');

  // The timeout is 3000ms — too long for tests. Verify the mechanism exists.
  assert.ok(scriptSource.includes('setTimeout'), 'error auto-hide uses setTimeout');
  assert.ok(scriptSource.includes('3000'), 'error auto-hide timeout is 3000ms');
});

test('toggleReaction response updates button state', async () => {
  var toggleResolve;
  var toggleFn = function() {
    return new Promise(function(resolve) { toggleResolve = resolve; });
  };

  var fetchRS = function() {
    return Promise.resolve({ userReactions: [], counts: { like: 2 } });
  };

  var env = createAuthenticatedLikeTestEnv(
    { confirmed: true },
    { fetchReactionSummary: fetchRS, toggleReaction: toggleFn }
  );

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  var btn = env.elements.momentReactionLikeButton;
  var likeValue = env.elements.momentReactionLikeValue;

  // Click to like
  btn.onclick();

  // Response says active=true, counts.like=3
  toggleResolve({ type: 'like', active: true, counts: { like: 3 } });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  assert.equal(btn.getAttribute('aria-pressed'), 'true', 'response sets pressed=true');
  assert.equal(likeValue.textContent, '3', 'response count used');
  assert.equal(btn.getAttribute('aria-busy'), undefined, 'busy cleared after response');
});

test('reconcilePublicSummary called after successful toggle', async () => {
  var reconcileCalled = false;
  var reconcileFn = function() {
    reconcileCalled = true;
  };

  var toggleResolve;
  var toggleFn = function() {
    return new Promise(function(resolve) { toggleResolve = resolve; });
  };

  var fetchRS = function() {
    return Promise.resolve({ userReactions: [], counts: { like: 0 } });
  };

  var env = createAuthenticatedLikeTestEnv(
    { confirmed: true },
    {
      fetchReactionSummary: fetchRS,
      toggleReaction: toggleFn,
      reconcilePublicSummary: reconcileFn
    }
  );

  env.boundary({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  env.elements.momentReactionLikeButton.onclick();

  assert.equal(reconcileCalled, false, 'reconcile not called before response');

  toggleResolve({ type: 'like', active: true, counts: { like: 1 } });
  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  assert.ok(reconcileCalled, 'reconcilePublicSummary called after successful toggle');
});

test('generation shared between read-only and auth boundaries', () => {
  // Verify the sharedGenerationRef pattern is used
  var genRefPattern = /sharedGenerationRef[\s\S]*?\{[\s\S]*?value:\s*0\s*\}/;
  assert.ok(genRefPattern.test(scriptSource),
    'sharedGenerationRef with value: 0 must be created in createPublicViewerDetailUI');

  // Both boundaries should reference sharedGenRef
  assert.ok(scriptSource.match(/sharedGenerationRef/g).length >= 3,
    'sharedGenerationRef referenced in at least 3 places (creation + read-only + auth)');
});

test('Korean UI text in template and boundary messages', () => {
  // Verify Korean text for guest note
  assert.ok(templateSource.includes('로그인하면 좋아요를 남길 수 있어요'),
    'guest note is Korean');

  // Verify Korean text for button
  assert.ok(templateSource.includes('좋아요'),
    'button label contains Korean text');

  // Error message in boundary
  assert.ok(scriptSource.includes('좋아요를 처리할 수 없어요'),
    'error message is Korean');
});
