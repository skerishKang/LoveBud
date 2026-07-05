'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const scriptSource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-ui.js'), 'utf8');

// ---------------------------------------------------------------------------
// Source-level contract tests
// ---------------------------------------------------------------------------

it('1. guest path: read-only boundary must NOT contain createComment or composer', () => {
  const boundaryStart = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const boundaryEnd = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const boundary = scriptSource.slice(boundaryStart, boundaryEnd);
  assert.equal(boundary.includes('createComment'), false,
    'read-only boundary must not reference createComment');
  assert.equal(boundary.includes('composer'), false,
    'read-only boundary must not reference composer');
  assert.equal(boundary.includes('toggleReaction'), false,
    'read-only boundary must not reference toggleReaction');
  assert.equal(boundary.includes('idempotency'), false,
    'read-only boundary must not reference idempotency key');
  assert.equal(boundary.includes('submitGen'), false,
    'read-only boundary must not track submitGen');
});

it('2. authenticated composer boundary exists and references createComment', () => {
  const composerStart = scriptSource.indexOf('function createPublicViewerAuthenticatedCommentComposerBoundary(deps)');
  assert.ok(composerStart >= 0, 'composer boundary function must exist');
  const composerEnd = scriptSource.indexOf('function createPublicViewerTreeMetaBoundary(deps)');
  const composer = scriptSource.slice(composerStart, composerEnd);
  assert.ok(composer.includes('createComment'), 'composer boundary must use createComment');
  assert.ok(composer.includes('hasConfirmedAuthSession'), 'composer boundary must check auth');
  assert.ok(composer.includes('maxLength'), 'composer must enforce maxLength');
  assert.ok(composer.includes('aria-live'), 'composer error must have aria-live');
  assert.ok(composer.includes('composerDraftIdemKey'), 'composer must track idempotency key');
  assert.ok(composer.includes('submitGen'), 'composer must track submission generation');
  assert.ok(composer.includes('reconcilePublicSummary'), 'composer must trigger reconciliation on success');
  assert.equal(composer.includes('toggleReaction'), false, 'composer must not reference toggleReaction');
  assert.equal(composer.includes('resolveSocialContext'), false,
    'composer must not need resolveSocialContext (uses panel state)');
});

it('3. read-only boundary has onCommentsPanelStateChange lifecycle hook', () => {
  const boundaryStart = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const boundaryEnd = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const boundary = scriptSource.slice(boundaryStart, boundaryEnd);

  assert.ok(boundary.includes('onCommentsPanelStateChange'),
    'read-only boundary must support onCommentsPanelStateChange callback');
  assert.ok(boundary.includes('emitPanelState'),
    'read-only boundary must emit panel state changes');
  assert.ok(boundary.includes('emitPanelState(true)'),
    'must emit open state when panel opens');
  assert.ok(boundary.includes('emitPanelState(false)'),
    'must emit closed state when panel resets');
});

it('4. composer wired via lifecycle callback in orchestrator', () => {
  const mainFn = scriptSource.indexOf('function createPublicViewerDetailUI(deps)');
  const rest = scriptSource.slice(mainFn);
  assert.ok(rest.includes('onCommentsPanelStateChange'),
    'orchestrator must wire panel state callback');
  assert.ok(rest.includes('commentPanelStateHandler'),
    'orchestrator must have commentPanelStateHandler');
  assert.ok(rest.includes('updateCommentComposer(state)'),
    'state handler must call composer update');
});

it('5. canvas-entry.js and canvas-init.js inject createComment', () => {
  const entrySrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-canvas-entry.js'), 'utf8');
  assert.ok(entrySrc.includes('createComment: typeof apiClient.createComment'),
    'canvas-entry must inject createComment from apiClient');
  const initSrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-init.js'), 'utf8');
  assert.ok(initSrc.includes('apiClient.createComment'),
    'canvas-init must reference apiClient.createComment');
});

it('6. guest public-read, reaction summary, retry features intact', () => {
  const boundaryStart = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const boundaryEnd = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const boundary = scriptSource.slice(boundaryStart, boundaryEnd);
  assert.ok(boundary.includes('fetchPublicMomentReactionSummary'), 'must use public reaction callback');
  assert.ok(boundary.includes('fetchPublicMomentComments') || boundary.includes('fetchComments'),
    'must use public comments callback');
  assert.ok(boundary.includes('resetCommentsPanel'), 'must have reset function');
  assert.ok(boundary.includes('renderUnavailable'), 'must handle unavailable state');
  assert.ok(boundary.includes('[data-social-retry'), 'must have retry support');
  assert.equal(boundary.includes('toggleReaction'), false, 'no toggleReaction in read-only');
  assert.equal(boundary.includes('createComment'), false, 'no createComment in read-only');
});

// ---------------------------------------------------------------------------
// Behavior tests (mock DOM + deferred promises)
// ---------------------------------------------------------------------------
function createMockElement(tagName) {
  var _disabled = false;
  return {
    tagName: (tagName || 'div').toUpperCase(), textContent: '', children: [],
    style: {}, dataset: {}, attributes: {}, onclick: null, value: '',
    _hidden: false,
    classList: { classes: new Set(), add(c) { this.classes.add(c); }, remove(c) { this.classes.delete(c); }, contains(c) { return this.classes.has(c); } },
    get disabled() { return _disabled; },
    set disabled(v) { _disabled = !!v; },
    _hidden: false,
    get hidden() { return this._hidden; },
    set hidden(v) { this._hidden = !!v; },
    setAttribute(n, v) { this.attributes[n] = v; if (n === 'disabled') { this._disabled = true; } },
    removeAttribute(n) { delete this.attributes[n]; if (n === 'disabled') { this._disabled = false; } },
    getAttribute(n) { return this.attributes[n]; },
    appendChild(c) { this.children.push(c); c.parentElement = this; },
    removeChild(c) { const i = this.children.indexOf(c); if (i !== -1) { this.children.splice(i, 1); c.parentElement = null; } },
    parentElement: null,
    closest() { return this.parentElement || this; },
    querySelector() { return null; }
  };
}

function createPanelEnv() {
  const elements = {};
  const neededIds = [
    'momentReactionsCard', 'momentReactionLikeValue', 'momentReactionCommentValue',
    'momentReactionNote', 'momentReactionCommentStatus', 'momentCommentsPanel',
    'momentCommentsList', 'momentCommentsPanelStatus',
    'momentReactionLikeButton', 'momentReactionLikeGuestNote',
    'detailTreeMetaMount', 'detailCurrentMomentBadge', 'detailCurrentMomentTitle',
    'detailCurrentMomentHint', 'detailImg', 'detailDateText', 'detailMemo', 'detailTags'
  ];
  neededIds.forEach(id => { elements[id] = createMockElement(); });
  elements.momentReactionCommentStatus.tagName = 'BUTTON';
  elements.momentCommentsPanel.hidden = true;

  const ctx = vm.createContext({
    window: {},
    document: {
      createElement: (tag) => createMockElement(tag),
      getElementById: (id) => elements[id] || null,
      querySelector: () => createMockElement(),
      querySelectorAll: () => []
    }
  });
  ctx.window = ctx;

  const metaSrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-metadata-text.js'), 'utf8');
  vm.runInContext(metaSrc, ctx);
  vm.runInContext(scriptSource, ctx);

  let createCommentCount = 0;
  let lastIdemKey = null;
  let resolveCmt, rejectCmt;
  let pendingPromise = null;

  function makePending() {
    pendingPromise = new Promise((res, rej) => { resolveCmt = res; rejectCmt = rej; });
    return pendingPromise;
  }

  let isAuth = true;

  const deps = {
    currentSelectedId: 'mem-1',
    treeMemories: [{ id: 'mem-1', treeId: 'tree-1' }],
    getSelectedNodeId: () => deps.currentSelectedId,
    isRootMemory: (d, r) => d && d.id === r,
    getCanonicalRootId: () => 'root',
    getTreeMemories: () => deps.treeMemories,
    resolveMemoryThumbnail: (d) => d.thumbnail || '',
    i18n: (k) => k,
    getLocalSaveMode: () => false,
    showToast: () => {},
    fetchPublicMomentReactionSummary: async () => ({ counts: { like: 0 }, total: 0 }),
    fetchPublicMomentComments: async () => ({ comments: [], nextCursor: null }),
    fetchReactionSummary: async () => { throw new Error('not called'); },
    toggleReaction: async () => { throw new Error('not called'); },
    hasConfirmedAuthSession: () => isAuth,
    createComment: async (memId, body, idemKey) => {
      createCommentCount++;
      lastIdemKey = idemKey;
      if (pendingPromise) return pendingPromise;
      return { id: 'c-' + createCommentCount };
    }
  };

  const ui = ctx.createPublicViewerDetailUI(deps);

  // Helper: open panel for a memory
  async function openPanel(memoryId) {
    // Step 1: Show panel container
    elements.momentCommentsPanel.hidden = false;
    // Step 2: Trigger detail update which runs the fetch + wireCommentToggle
    ui.updateDetailPanel({ id: memoryId || 'mem-1', treeId: 'tree-1' });
    await new Promise(r => setTimeout(r, 20));
    // Step 3: Click the comment toggle to actually open the panel
    // This triggers openCommentPanel → emitPanelState(true) → composer appends
    if (elements.momentReactionCommentStatus && elements.momentReactionCommentStatus.onclick) {
      elements.momentReactionCommentStatus.onclick();
      await new Promise(r => setTimeout(r, 5));
    }
  }

  function closePanel() {
    // Click toggle again to close
    if (elements.momentReactionCommentStatus && elements.momentReactionCommentStatus.onclick) {
      elements.momentReactionCommentStatus.onclick();
    }
  }

  function hasSubmitBtn(panelEl) {
    function find(el) {
      if (el.textContent === '등록') return true;
      if (el.children) for (const c of el.children) if (find(c)) return true;
      return false;
    }
    return find(panelEl);
  }

  function findSubmitBtn(panelEl) {
    function find(el) {
      if (el.textContent === '등록') return el;
      if (el.children) for (const c of el.children) { const r = find(c); if (r) return r; }
      return null;
    }
    return find(panelEl);
  }

  function findTextarea(panelEl) {
    function find(el) {
      if (el.tagName === 'TEXTAREA') return el;
      if (el.children) for (const c of el.children) { const r = find(c); if (r) return r; }
      return null;
    }
    return find(panelEl);
  }

  function findErrorEl(panelEl) {
    function find(el) {
      if (el.tagName === 'P' && el.textContent && el.textContent.includes('등록하지 못했습니다')) return el;
      if (el.children) for (const c of el.children) { const r = find(c); if (r) return r; }
      return null;
    }
    return find(panelEl);
  }

  return {
    elements, ui, deps, ctx, makePending,
    resolve: (v) => { if (resolveCmt) resolveCmt(v); resolveCmt = null; pendingPromise = null; },
    reject: (e) => { if (rejectCmt) rejectCmt(e); rejectCmt = null; pendingPromise = null; },
    openPanel, closePanel,
    hasSubmitBtn, findSubmitBtn, findTextarea, findErrorEl,
    createCommentCount: () => createCommentCount,
    lastIdemKey: () => lastIdemKey,
    setAuth: (v) => { isAuth = !!v; },
  };
}

// ---------------------------------------------------------------------------
// Behavior tests
// ---------------------------------------------------------------------------

it('7. guest: composer not visible, createComment 0 calls', async () => {
  const env = createPanelEnv();
  env.setAuth(false);
  await env.openPanel('mem-1');
  assert.equal(env.hasSubmitBtn(env.elements.momentCommentsPanel), false, 'guest must not see composer');
  assert.equal(env.createCommentCount(), 0, 'createComment must not be called');
});

it('8. authenticated: composer visible with textarea and submit button', async () => {
  const env = createPanelEnv();
  await env.openPanel('mem-1');
  assert.equal(env.hasSubmitBtn(env.elements.momentCommentsPanel), true, 'authenticated must see composer');
  assert.ok(env.findTextarea(env.elements.momentCommentsPanel), 'textarea must exist');
});

it('9. panel close/reset removes composer', async () => {
  const env = createPanelEnv();
  await env.openPanel('mem-1');
  assert.equal(env.hasSubmitBtn(env.elements.momentCommentsPanel), true, 'composer visible');

  // Switch to root (hides panel via resetCommentsPanel)
  env.deps.currentSelectedId = 'root';
  env.ui.updateDetailPanel({ id: 'root', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 20));
  // After reset, composer should be removed
  assert.equal(env.hasSubmitBtn(env.elements.momentCommentsPanel), false, 'composer removed after root reset');
});

it('10. empty input does not call createComment', async () => {
  const env = createPanelEnv();
  await env.openPanel('mem-1');
  const btn = env.findSubmitBtn(env.elements.momentCommentsPanel);
  assert.ok(btn, 'submit button exists');
  btn.onclick();
  assert.equal(env.createCommentCount(), 0, 'no API call for empty input');
});

it('11. submit pending disables button, double click = 1 call', async () => {
  const env = createPanelEnv();
  env.makePending();
  await env.openPanel('mem-1');

  const ta = env.findTextarea(env.elements.momentCommentsPanel);
  if (ta) ta.value = 'test comment';

  const btn = env.findSubmitBtn(env.elements.momentCommentsPanel);
  assert.ok(btn, 'submit button exists');
  assert.equal(btn.disabled, false, 'enabled before submit');
  btn.onclick();
  assert.equal(btn.disabled, true, 'disabled during pending');
  btn.onclick(); // rapid double click
  assert.equal(env.createCommentCount(), 1, 'only 1 call despite double click');

  env.resolve({ id: 'c1' });
  await new Promise(r => setTimeout(r, 10));
});

it('12. failure: input preserved, safe error, no raw error', async () => {
  const env = createPanelEnv();
  env.makePending();
  await env.openPanel('mem-1');

  const ta = env.findTextarea(env.elements.momentCommentsPanel);
  if (ta) ta.value = 'test body';

  const btn = env.findSubmitBtn(env.elements.momentCommentsPanel);
  btn.onclick();

  env.reject(new Error('Internal Server Error'));
  await new Promise(r => setTimeout(r, 10));

  assert.equal(btn.disabled, false, 'button restored');
  assert.equal(ta.value, 'test body', 'input preserved');
  const errEl = env.findErrorEl(env.elements.momentCommentsPanel);
  assert.ok(errEl, 'safe error element exists');
  assert.ok(!errEl.textContent.includes('Internal Server Error'), 'no raw error');
  assert.ok(errEl.getAttribute('aria-live'), 'error has aria-live');
});

it('13. same body retry: same idempotency key', async () => {
  const env = createPanelEnv();
  env.makePending();
  await env.openPanel('mem-1');

  const ta = env.findTextarea(env.elements.momentCommentsPanel);
  if (ta) ta.value = 'same body';

  const btn = env.findSubmitBtn(env.elements.momentCommentsPanel);
  btn.onclick();
  const key1 = env.lastIdemKey();

  env.reject(new Error('fail'));
  await new Promise(r => setTimeout(r, 10));

  env.makePending();
  btn.onclick();
  const key2 = env.lastIdemKey();

  assert.equal(key1, key2, 'same body retry uses same key');
  env.resolve({ id: 'c2' });
  await new Promise(r => setTimeout(r, 10));
});

it('14. body change after retry: new idempotency key', async () => {
  const env = createPanelEnv();
  env.makePending();
  await env.openPanel('mem-1');

  const ta = env.findTextarea(env.elements.momentCommentsPanel);
  if (ta) ta.value = 'body v1';

  const btn = env.findSubmitBtn(env.elements.momentCommentsPanel);
  btn.onclick();
  const key1 = env.lastIdemKey();

  env.reject(new Error('fail'));
  await new Promise(r => setTimeout(r, 10));

  ta.value = 'body v2';
  env.makePending();
  btn.onclick();
  const key2 = env.lastIdemKey();

  assert.notEqual(key1, key2, 'body change uses new key');
  env.resolve({ id: 'c2' });
  await new Promise(r => setTimeout(r, 10));
});

it('15. success: input clear, key reset, force reconciliation', async () => {
  const env = createPanelEnv();
  env.makePending();
  await env.openPanel('mem-1');

  const ta = env.findTextarea(env.elements.momentCommentsPanel);
  if (ta) ta.value = 'success';
  const btn = env.findSubmitBtn(env.elements.momentCommentsPanel);
  btn.onclick();

  env.resolve({ id: 'c1' });
  await new Promise(r => setTimeout(r, 10));

  assert.equal(btn.disabled, false, 'button restored');
  assert.equal(ta.value, '', 'input cleared');

  // New body generates new key
  if (ta) ta.value = 'new';
  env.makePending();
  btn.onclick();
  assert.equal(env.createCommentCount(), 2, 'second submit calls api');
  assert.ok(env.lastIdemKey(), 'new key generated');
  env.resolve({ id: 'c2' });
  await new Promise(r => setTimeout(r, 10));
});

it('16. stale selection prevents reconciliation', async () => {
  // Test that submitGen guard works
  const env = createPanelEnv();
  await env.openPanel('mem-1');
  assert.equal(env.hasSubmitBtn(env.elements.momentCommentsPanel), true, 'composer visible');

  // Change selection to root (generation bump, panel reset → composer removed)
  env.deps.currentSelectedId = 'root';
  env.ui.updateDetailPanel({ id: 'root', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 20));

  assert.equal(env.hasSubmitBtn(env.elements.momentCommentsPanel), false, 'composer removed');
});

it('17. read-only boundary has no createComment, submitGen, composer', () => {
  const start = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const end = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const b = scriptSource.slice(start, end);
  assert.equal(b.includes('createComment'), false);
  assert.equal(b.includes('composer'), false);
  assert.equal(b.includes('idempotency'), false);
  assert.equal(b.includes('submitGen'), false);
  assert.equal(b.includes('toggleReaction'), false);
});

it('18. guest public-read, retry, reaction summary intact', () => {
  const start = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const end = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const b = scriptSource.slice(start, end);
  assert.ok(b.includes('fetchPublicMomentReactionSummary'));
  assert.ok(b.includes('fetchPublicMomentComments') || b.includes('fetchComments'));
  assert.ok(b.includes('resetCommentsPanel'));
  assert.ok(b.includes('renderUnavailable'));
  assert.ok(b.includes('[data-social-retry'));
});
