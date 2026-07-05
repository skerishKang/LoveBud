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
  assert.equal(boundary.includes('createComment'), false);
  assert.equal(boundary.includes('composer'), false);
  assert.equal(boundary.includes('toggleReaction'), false);
  assert.equal(boundary.includes('idempotency'), false);
  assert.equal(boundary.includes('submitGen'), false);
});

it('2. authenticated composer boundary exists and references createComment', () => {
  const composerStart = scriptSource.indexOf('function createPublicViewerAuthenticatedCommentComposerBoundary(deps)');
  assert.ok(composerStart >= 0);
  const composerEnd = scriptSource.indexOf('function createPublicViewerTreeMetaBoundary(deps)');
  const composer = scriptSource.slice(composerStart, composerEnd);
  assert.ok(composer.includes('createComment'));
  assert.ok(composer.includes('hasConfirmedAuthSession'));
  assert.ok(composer.includes('maxLength'));
  assert.ok(composer.includes('aria-live'));
  assert.ok(composer.includes('composerDraftIdemKey'));
  assert.ok(composer.includes('submitGen'));
  assert.ok(composer.includes('reconcilePublicSummary'));
  assert.equal(composer.includes('toggleReaction'), false);
  assert.equal(composer.includes('resolveSocialContext'), false);
});

it('3. read-only boundary has onCommentsPanelStateChange lifecycle hook', () => {
  const boundaryStart = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const boundaryEnd = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const boundary = scriptSource.slice(boundaryStart, boundaryEnd);
  assert.ok(boundary.includes('onCommentsPanelStateChange'));
  assert.ok(boundary.includes('emitPanelState'));
  assert.ok(boundary.includes('emitPanelState(true)'));
  assert.ok(boundary.includes('emitPanelState(false)'));
});

it('4. composer wired via lifecycle callback in orchestrator', () => {
  const mainFn = scriptSource.indexOf('function createPublicViewerDetailUI(deps)');
  const rest = scriptSource.slice(mainFn);
  assert.ok(rest.includes('onCommentsPanelStateChange'));
  assert.ok(rest.includes('commentPanelStateHandler'));
  assert.ok(rest.includes('updateCommentComposer'));
});

it('5. canvas-entry.js and canvas-init.js inject createComment', () => {
  const entrySrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-canvas-entry.js'), 'utf8');
  assert.ok(entrySrc.includes('createComment: typeof apiClient.createComment'));
  const initSrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-init.js'), 'utf8');
  assert.ok(initSrc.includes('apiClient.createComment'));
});

it('6. guest public-read, reaction summary, retry features intact', () => {
  const rs = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const re = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const r = scriptSource.slice(rs, re);
  assert.ok(r.includes('fetchPublicMomentReactionSummary'));
  assert.ok(r.includes('fetchPublicMomentComments') || r.includes('fetchComments'));
  assert.ok(r.includes('resetCommentsPanel'));
  assert.ok(r.includes('renderUnavailable'));
  assert.ok(r.includes('[data-social-retry'));
  assert.equal(r.includes('toggleReaction'), false);
  assert.equal(r.includes('createComment'), false);
});

// ---------------------------------------------------------------------------
// Behavior tests (mock DOM)
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

  async function openPanel(memoryId) {
    elements.momentCommentsPanel.hidden = false;
    ui.updateDetailPanel({ id: memoryId || 'mem-1', treeId: 'tree-1' });
    await new Promise(r => setTimeout(r, 20));
    if (elements.momentReactionCommentStatus && elements.momentReactionCommentStatus.onclick) {
      elements.momentReactionCommentStatus.onclick();
      await new Promise(r => setTimeout(r, 5));
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

  return {
    elements, ui, deps, ctx, makePending,
    resolve: (v) => { if (resolveCmt) resolveCmt(v); resolveCmt = null; pendingPromise = null; },
    reject: (e) => { if (rejectCmt) rejectCmt(e); rejectCmt = null; pendingPromise = null; },
    openPanel, hasSubmitBtn, findSubmitBtn, findTextarea,
    createCommentCount: () => createCommentCount,
    setAuth: (v) => { isAuth = !!v; },
  };
}

it('7. guest: composer not visible, createComment 0 calls', async () => {
  const env = createPanelEnv();
  env.setAuth(false);
  await env.openPanel('mem-1');
  assert.equal(env.hasSubmitBtn(env.elements.momentCommentsPanel), false, 'guest must not see composer');
  assert.equal(env.createCommentCount(), 0, 'createComment must not be called');
});

it('8. authenticated: composer visible with textarea', async () => {
  const env = createPanelEnv();
  await env.openPanel('mem-1');
  assert.ok(env.findSubmitBtn(env.elements.momentCommentsPanel), 'authenticated must see composer');
  assert.ok(env.findTextarea(env.elements.momentCommentsPanel), 'textarea must exist');
});

it('9. source verify: read-only emits open/close state', () => {
  const rs = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const re = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const r = scriptSource.slice(rs, re);
  assert.ok(r.includes('emitPanelState(true)'));
  assert.ok(r.includes('emitPanelState(false)'));
  assert.ok(r.includes('resetCommentsPanel'));
});

it('10. empty input: no API call', async () => {
  const env = createPanelEnv();
  await env.openPanel('mem-1');
  const btn = env.findSubmitBtn(env.elements.momentCommentsPanel);
  assert.ok(btn, 'submit button exists');
  btn.onclick();
  assert.equal(env.createCommentCount(), 0);
});

it('11. submit pending: button disabled, double click guard, idempotency key', () => {
  const cs = scriptSource.indexOf('function createPublicViewerAuthenticatedCommentComposerBoundary(deps)');
  const ce = scriptSource.indexOf('function createPublicViewerTreeMetaBoundary(deps)');
  const c = scriptSource.slice(cs, ce);
  assert.ok(c.includes('submitBtn.disabled = true'));
  assert.ok(c.includes('if (submitBtn.disabled) return;'));
  assert.ok(c.includes('composerDraftIdemKey'));
  assert.ok(c.includes('composerDraftBody'));
  assert.ok(c.includes('submitGen'));
  assert.ok(c.includes('reconcilePublicSummary(lastContext.data'));
  assert.ok(c.includes('preserveCommentsPanel'));
});

it('12. failure: safe error, no raw error leak', () => {
  const cs = scriptSource.indexOf('function createPublicViewerAuthenticatedCommentComposerBoundary(deps)');
  const ce = scriptSource.indexOf('function createPublicViewerTreeMetaBoundary(deps)');
  const c = scriptSource.slice(cs, ce);
  assert.ok(c.includes("'댓글을 등록하지 못했습니다. 다시 시도해주세요.'"));
  assert.ok(c.includes('aria-live'));
  assert.ok(c.includes('.catch(function() {'));
});

it('13. idempotency key: same body retry reuses key', () => {
  const cs = scriptSource.indexOf('function createPublicViewerAuthenticatedCommentComposerBoundary(deps)');
  const ce = scriptSource.indexOf('function createPublicViewerTreeMetaBoundary(deps)');
  const c = scriptSource.slice(cs, ce);
  assert.ok(c.includes('body !== composerDraftBody'));
  assert.ok(c.includes('composerDraftIdemKey'));
  assert.ok(c.includes("composerDraftIdemKey = 'c-'"));
});

it('14. body change after retry: new key', () => {
  const cs = scriptSource.indexOf('function createPublicViewerAuthenticatedCommentComposerBoundary(deps)');
  const ce = scriptSource.indexOf('function createPublicViewerTreeMetaBoundary(deps)');
  const c = scriptSource.slice(cs, ce);
  assert.ok(c.includes('body !== composerDraftBody'));
  assert.ok(c.includes("composerDraftIdemKey = null"));
  assert.ok(c.includes("composerDraftBody = null"));
});

it('15. success: input clear, key reset, force reconciliation with preservePanel', () => {
  const cs = scriptSource.indexOf('function createPublicViewerAuthenticatedCommentComposerBoundary(deps)');
  const ce = scriptSource.indexOf('function createPublicViewerTreeMetaBoundary(deps)');
  const c = scriptSource.slice(cs, ce);
  assert.ok(c.includes("composerInputEl.value = ''"));
  assert.ok(c.includes('composerDraftIdemKey = null'));
  assert.ok(c.includes('composerDraftBody = null'));
  assert.ok(c.includes('currentGen === getGeneration()'));
  assert.ok(c.includes('reconcilePublicSummary'));

  const rs = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const re = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const r = scriptSource.slice(rs, re);
  assert.ok(r.includes('preserveCommentsPanel'));
  assert.ok(r.includes('preservePanel'));
});

it('16. stale selection: generation guard, submitGen reset on remove', () => {
  const cs = scriptSource.indexOf('function createPublicViewerAuthenticatedCommentComposerBoundary(deps)');
  const ce = scriptSource.indexOf('function createPublicViewerTreeMetaBoundary(deps)');
  const c = scriptSource.slice(cs, ce);
  assert.ok(c.includes('currentGen === getGeneration()'));
  assert.ok(c.includes('lastContext'));
  assert.ok(c.includes('submitGen = 0'));
  assert.ok(c.includes('lastContext = null'));
});

it('17. read-only boundary has no createComment, submitGen, composer', () => {
  const rs = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const re = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const r = scriptSource.slice(rs, re);
  assert.equal(r.includes('createComment'), false);
  assert.equal(r.includes('composer'), false);
  assert.equal(r.includes('idempotency'), false);
  assert.equal(r.includes('submitGen'), false);
  assert.equal(r.includes('toggleReaction'), false);
});

it('18. guest public-read, retry, reaction summary intact', () => {
  const rs = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const re = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const r = scriptSource.slice(rs, re);
  assert.ok(r.includes('fetchPublicMomentReactionSummary'));
  assert.ok(r.includes('resetCommentsPanel'));
  assert.ok(r.includes('renderUnavailable'));
  assert.ok(r.includes('[data-social-retry'));
  assert.equal(r.includes('toggleReaction'), false);
  assert.equal(r.includes('createComment'), false);
});
