'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const scriptSource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-ui.js'), 'utf8');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEl() {
  var _disabled = false;
  return {
    tagName: 'DIV', textContent: '', children: [],
    style: {}, dataset: {}, attributes: {}, onclick: null, value: '',
    _hidden: false,
    classList: { classes: new Set(), add(c) { this.classes.add(c); }, remove(c) { this.classes.delete(c); }, contains(c) { return this.classes.has(c); } },
    get disabled() { return _disabled; },
    set disabled(v) { _disabled = !!v; },
    get hidden() { return this._hidden; },
    set hidden(v) { this._hidden = !!v; },
    setAttribute(n, v) { this.attributes[n] = v; if (n === 'disabled') this._disabled = true; },
    removeAttribute(n) { delete this.attributes[n]; if (n === 'disabled') this._disabled = false; },
    getAttribute(n) { return this.attributes[n]; },
    appendChild(c) { this.children.push(c); c.parentElement = this; c.parentNode = this; },
    removeChild(c) { const i = this.children.indexOf(c); if (i !== -1) { this.children.splice(i, 1); c.parentElement = null; c.parentNode = null; } },
    parentElement: null, closest() { return this.parentElement || this; },
    querySelector() { return null; }
  };
}

function createEnv() {
  const els = {};
  const ids = ['momentReactionsCard','momentReactionLikeValue','momentReactionCommentValue',
    'momentReactionNote','momentReactionCommentStatus','momentCommentsPanel',
    'momentCommentsList','momentCommentsPanelStatus',
    'momentReactionLikeButton','momentReactionLikeGuestNote',
    'detailTreeMetaMount','detailCurrentMomentBadge','detailCurrentMomentTitle',
    'detailCurrentMomentHint','detailImg','detailDateText','detailMemo','detailTags'];
  ids.forEach(id => { els[id] = makeEl(); });
  els.momentReactionCommentStatus.tagName = 'BUTTON';
  els.momentCommentsPanel.hidden = true;

  const ctx = vm.createContext({
    window: {}, document: {
      createElement: (tag) => { const e = makeEl(); e.tagName = (tag || 'div').toUpperCase(); return e; },
      getElementById: (id) => els[id] || null,
      querySelector: () => makeEl(), querySelectorAll: () => []
    }
  });
  ctx.window = ctx;

  const metaSrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-metadata-text.js'), 'utf8');
  vm.runInContext(metaSrc, ctx);
  vm.runInContext(scriptSource, ctx);

  let ccCount = 0, lastKey = null, resCmt, rejCmt, pendingP = null, auth = true;

  function mkPending() { pendingP = new Promise((res, rej) => { resCmt = res; rejCmt = rej; }); return pendingP; }

  const deps = {
    currentSelectedId: 'mem-1',
    treeMemories: [{ id: 'mem-1', treeId: 'tree-1' }, { id: 'mem-2', treeId: 'tree-1' }],
    getSelectedNodeId: () => deps.currentSelectedId,
    isRootMemory: (d, r) => d && d.id === r,
    getCanonicalRootId: () => 'root',
    getTreeMemories: () => deps.treeMemories,
    resolveMemoryThumbnail: (d) => d.thumbnail || '',
    i18n: (k) => k, getLocalSaveMode: () => false, showToast: () => {},
    fetchPublicMomentReactionSummary: async () => ({ counts: { like: 0 }, total: 0 }),
    fetchPublicMomentComments: async () => ({ comments: [], nextCursor: null }),
    fetchReactionSummary: async () => { throw Error('x'); },
    toggleReaction: async () => { throw Error('x'); },
    hasConfirmedAuthSession: () => auth,
    createComment: async (memId, body, idemKey) => {
      ccCount++; lastKey = idemKey;
      if (pendingP) return pendingP;
      return { id: 'c-' + ccCount };
    }
  };

  const ui = ctx.createPublicViewerDetailUI(deps);

  async function openPanel(memoryId) {
    els.momentCommentsPanel.hidden = false;
    ui.updateDetailPanel({ id: memoryId || 'mem-1', treeId: 'tree-1' });
    await new Promise(r => setTimeout(r, 20));
    if (els.momentReactionCommentStatus && els.momentReactionCommentStatus.onclick) {
      els.momentReactionCommentStatus.onclick();
      await new Promise(r => setTimeout(r, 5));
    }
  }

  function findBtn(p) { function f(e) { if (e.textContent === '등록') return e; if (e.children) for (const c of e.children) { const r = f(c); if (r) return r; } return null; } return f(p); }
  function hasBtn(p) { return !!findBtn(p); }
  function findTA(p) { function f(e) { if (e.tagName === 'TEXTAREA') return e; if (e.children) for (const c of e.children) { const r = f(c); if (r) return r; } return null; } return f(p); }
  function findErr(p) { function f(e) { if (e.tagName === 'P' && e.textContent && e.textContent.includes('등록하지 못했습니다')) return e; if (e.children) for (const c of e.children) { const r = f(c); if (r) return r; } return null; } return f(p); }

  return {
    els, ui, deps, mkPending,
    resolve: (v) => { if (resCmt) resCmt(v); resCmt = null; pendingP = null; },
    reject: (e) => { if (rejCmt) rejCmt(e); rejCmt = null; pendingP = null; },
    openPanel, findBtn, hasBtn, findTA, findErr,
    ccCount: () => ccCount, lastKey: () => lastKey,
    setAuth: (v) => { auth = !!v; },
  };
}

async function flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

// ---------------------------------------------------------------------------
// 1-5: Source-level contract tests
// ---------------------------------------------------------------------------
it('1. read-only boundary contains no createComment/composer/idempotency', () => {
  const s = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const e = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const b = scriptSource.slice(s, e);
  assert.equal(b.includes('createComment'), false, 'no createComment');
  assert.equal(b.includes('composer'), false, 'no composer');
  assert.equal(b.includes('idempotency'), false, 'no idempotency');
  assert.equal(b.includes('submitGen'), false, 'no submitGen');
  assert.equal(b.includes('toggleReaction'), false, 'no toggleReaction');
});

it('2. composer boundary exists with required features', () => {
  const s = scriptSource.indexOf('function createPublicViewerAuthenticatedCommentComposerBoundary(deps)');
  const e = scriptSource.indexOf('function createPublicViewerTreeMetaBoundary(deps)');
  const c = scriptSource.slice(s, e);
  assert.ok(c.includes('createComment'));
  assert.ok(c.includes('hasConfirmedAuthSession'));
  assert.ok(c.includes('maxLength'));
  assert.ok(c.includes('aria-live'));
  assert.ok(c.includes('composerDraftIdemKey'));
  assert.ok(c.includes('composerInstanceToken'));
  assert.ok(c.includes('subCtx'));
  assert.ok(c.includes('reconcilePublicSummary'));
  assert.equal(c.includes('toggleReaction'), false);
  assert.equal(c.includes('resolveSocialContext'), false);
});

it('3. read-only boundary emits onCommentsPanelStateChange', () => {
  const s = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const e = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const b = scriptSource.slice(s, e);
  assert.ok(b.includes('onCommentsPanelStateChange'));
  assert.ok(b.includes('emitPanelState(true)'));
  assert.ok(b.includes('emitPanelState(false)'));
});

it('4. orchestrator wires lifecycle callback + composer', () => {
  const main = scriptSource.indexOf('function createPublicViewerDetailUI(deps)');
  const rest = scriptSource.slice(main);
  assert.ok(rest.includes('commentPanelStateHandler'));
  assert.ok(rest.includes('updateCommentComposer'));
});

it('5. canvas-entry/canvas-init inject createComment', () => {
  const eSrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-canvas-entry.js'), 'utf8');
  assert.ok(eSrc.includes('createComment: typeof apiClient.createComment'));
  const iSrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-canvas-init.js'), 'utf8');
  assert.ok(iSrc.includes('apiClient.createComment'));
});

// ---------------------------------------------------------------------------
// 6-17: Behavior tests with deferred Promise + mock DOM
// ---------------------------------------------------------------------------
it('6. guest: composer not visible, createComment 0 calls', async () => {
  const env = createEnv();
  env.setAuth(false);
  await env.openPanel('mem-1');
  assert.equal(env.hasBtn(env.els.momentCommentsPanel), false);
  assert.equal(env.ccCount(), 0);
});

it('7. authenticated: composer visible with textarea and submit button', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  assert.ok(env.findBtn(env.els.momentCommentsPanel), 'submit button');
  assert.ok(env.findTA(env.els.momentCommentsPanel), 'textarea');
});

it('8. panel close removes composer, reopen shows it again', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  assert.ok(env.findBtn(env.els.momentCommentsPanel), 'composer visible');

  // Close toggle
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();
  assert.equal(env.hasBtn(env.els.momentCommentsPanel), false, 'composer removed after close');

  // Reopen
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();
  assert.ok(env.findBtn(env.els.momentCommentsPanel), 'composer visible after reopen');
});

it('9. switch moments: composer visible on new moment', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  assert.ok(env.findBtn(env.els.momentCommentsPanel), 'composer on Moment A');

  // Switch to Moment B
  env.deps.currentSelectedId = 'mem-2';
  await env.openPanel('mem-2');
  assert.ok(env.findBtn(env.els.momentCommentsPanel), 'composer on Moment B');
});

it('10. submit calls createComment exactly once', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'hello';
  const btn = env.findBtn(env.els.momentCommentsPanel);
  btn.onclick();
  assert.equal(env.ccCount(), 1, 'one call on submit');
  env.resolve({ id: 'c1' });
  await flush();
});

it('11. empty input: no API call', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  const btn = env.findBtn(env.els.momentCommentsPanel);
  btn.onclick();
  assert.equal(env.ccCount(), 0);
});

it('12. pending: button disabled, double click = 1 call', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'test';
  const btn = env.findBtn(env.els.momentCommentsPanel);
  assert.equal(btn.disabled, false, 'enabled before');
  btn.onclick();
  assert.equal(btn.disabled, true, 'disabled during pending');
  btn.onclick(); // rapid double click
  assert.equal(env.ccCount(), 1, 'only 1 call');
  env.resolve({ id: 'c1' });
  await flush();
});

it('13. failure: input preserved, safe error, no raw error', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'test body';
  const btn = env.findBtn(env.els.momentCommentsPanel);
  btn.onclick();
  env.reject(new Error('Internal Server Error'));
  await flush();
  assert.equal(btn.disabled, false, 'button restored');
  assert.equal(ta.value, 'test body', 'input preserved');
  const errEl = env.findErr(env.els.momentCommentsPanel);
  assert.ok(errEl, 'safe error exists');
  assert.ok(!errEl.textContent.includes('Internal Server Error'), 'no raw error');
  assert.ok(errEl.getAttribute('aria-live'), 'error has aria-live');
});

it('14. same body retry: same idempotency key', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'same body';
  const btn = env.findBtn(env.els.momentCommentsPanel);
  btn.onclick();
  const k1 = env.lastKey();
  env.reject(new Error('fail'));
  await flush();
  env.mkPending();
  btn.onclick();
  const k2 = env.lastKey();
  assert.equal(k1, k2, 'same key on same body retry');
  env.resolve({ id: 'c2' });
  await flush();
});

it('15. body change after retry: new idempotency key', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'body v1';
  const btn = env.findBtn(env.els.momentCommentsPanel);
  btn.onclick();
  const k1 = env.lastKey();
  env.reject(new Error('fail'));
  await flush();
  ta.value = 'body v2';
  env.mkPending();
  btn.onclick();
  const k2 = env.lastKey();
  assert.notEqual(k1, k2, 'new key on body change');
  env.resolve({ id: 'c2' });
  await flush();
});

it('16. success: input cleared, key reset, panel stays open', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'success';
  const btn = env.findBtn(env.els.momentCommentsPanel);
  btn.onclick();
  env.resolve({ id: 'c1' });
  await flush();
  assert.equal(btn.disabled, false, 'button restored');
  assert.equal(ta.value, '', 'input cleared');
  assert.ok(env.findBtn(env.els.momentCommentsPanel), 'panel stays open');

  // New submit uses new key
  if (ta) ta.value = 'new';
  env.mkPending();
  btn.onclick();
  assert.equal(env.ccCount(), 2, 'second call');
  assert.ok(env.lastKey(), 'new key');
  env.resolve({ id: 'c2' });
  await flush();
});

it('17. stale close/reopen: old response does not affect new input', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'old';
  const btn = env.findBtn(env.els.momentCommentsPanel);
  btn.onclick();

  // Close panel
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();
  assert.equal(env.hasBtn(env.els.momentCommentsPanel), false, 'composer removed');

  // Reopen same moment
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();
  assert.ok(env.findBtn(env.els.momentCommentsPanel), 'composer re-appears');

  const ta2 = env.findTA(env.els.momentCommentsPanel);
  if (ta2) ta2.value = 'new input';

  // Old async response completes — should NOT affect new input
  env.resolve({ id: 'c1' });
  await flush();

  assert.equal(ta2.value, 'new input', 'old response did not clear new input');

  // New submit works
  env.mkPending();
  const btn2 = env.findBtn(env.els.momentCommentsPanel);
  btn2.onclick();
  assert.equal(env.ccCount(), 2, 'new submit calls api');
  env.resolve({ id: 'c2' });
  await flush();
});

// ---------------------------------------------------------------------------
// 18: Source-level: guest public-read, retry, reaction summary intact
// ---------------------------------------------------------------------------
it('18. guest read-only features intact', () => {
  const s = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const e = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const b = scriptSource.slice(s, e);
  assert.ok(b.includes('fetchPublicMomentReactionSummary'));
  assert.ok(b.includes('resetCommentsPanel'));
  assert.ok(b.includes('renderUnavailable'));
  assert.ok(b.includes('[data-social-retry'));
  assert.equal(b.includes('toggleReaction'), false);
  assert.equal(b.includes('createComment'), false);
});
