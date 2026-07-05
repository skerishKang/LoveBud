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
    querySelector() { return null; },
    addEventListener: function(type, handler) { this._listeners = this._listeners || {}; this._listeners[type] = handler; },
    removeEventListener: function(type) { if (this._listeners) delete this._listeners[type]; },
    dispatchEvent: function() { var h = this._listeners && this._listeners.input; if (h) { h(); return true; } return false; },
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
  const socialSummaryCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-read-only-social-summary.js'), 'utf8');
  vm.runInContext(socialSummaryCode, ctx);
  const authLikeCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-authenticated-like.js'), 'utf8');
  vm.runInContext(authLikeCode, ctx);
  const authComposerCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-authenticated-comment-composer.js'), 'utf8');
  vm.runInContext(authComposerCode, ctx);
  vm.runInContext(scriptSource, ctx);

  let ccCount = 0, lastKey = null, resCmt, rejCmt, pendingP = null, auth = true;
  const publicReadCalls = [];

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
    fetchPublicMomentReactionSummary: async (treeId, memoryId) => {
      publicReadCalls.push({ kind: 'reaction', treeId, memoryId });
      return { counts: { like: 0 }, total: 0 };
    },
    fetchPublicMomentComments: async (treeId, memoryId) => {
      publicReadCalls.push({ kind: 'comments', treeId, memoryId });
      return { comments: [], nextCursor: null };
    },
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
    ccCount: () => ccCount, lastKey: () => lastKey, publicReadCount: () => publicReadCalls.length,
    setAuth: (v) => { auth = !!v; },
    findSuccess: (p) => { function f(e) { if (e.tagName === 'P' && e.textContent && e.textContent.includes('댓글이 등록되었습니다')) return e; if (e.children) for (const c of e.children) { const r = f(c); if (r) return r; } return null; } return f(p); },
    findCancel: (p) => { function f(e) { if (e.tagName === 'BUTTON' && e.textContent && e.textContent.includes('입력 취소')) return e; if (e.children) for (const c of e.children) { const r = f(c); if (r) return r; } return null; } return f(p); },
    findValidation: (p) => { function f(e) { if (e.tagName === 'P' && e.textContent && e.textContent.trim() === '댓글 내용을 입력해주세요.') return e; if (e.children) for (const c of e.children) { const r = f(c); if (r) return r; } return null; } return f(p); },
    findGuestNote: (p) => { function f(e) { if (e.getAttribute && e.getAttribute('data-guest-comment-note') === '1') return e; if (e.children) for (const c of e.children) { const r = f(c); if (r) return r; } return null; } return f(p); },
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
  const composerSrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-authenticated-comment-composer.js'), 'utf8');
  assert.ok(composerSrc.includes('createComment'));
  assert.ok(composerSrc.includes('hasConfirmedAuthSession'));
  assert.ok(composerSrc.includes('maxLength'));
  assert.ok(composerSrc.includes('aria-live'));
  assert.ok(composerSrc.includes('composerDraftIdemKey'));
  assert.ok(composerSrc.includes('composerInstanceToken'));
  assert.ok(composerSrc.includes('subCtx'));
  assert.ok(composerSrc.includes('reconcilePublicSummary'));
  assert.equal(composerSrc.includes('toggleReaction'), false);
  assert.equal(composerSrc.includes('resolveSocialContext'), false);
});

it('3. read-only boundary emits onCommentsPanelStateChange', () => {
  const ronlySrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-read-only-social-summary.js'), 'utf8');
  assert.ok(ronlySrc.includes('onCommentsPanelStateChange'));
  assert.ok(ronlySrc.includes('emitPanelState(true)'));
  assert.ok(ronlySrc.includes('emitPanelState(false)'));
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
  const ronlySrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-read-only-social-summary.js'), 'utf8');
  assert.ok(ronlySrc.includes('fetchPublicMomentReactionSummary'));
  assert.ok(ronlySrc.includes('resetCommentsPanel'));
  assert.ok(ronlySrc.includes('renderUnavailable'));
  assert.ok(ronlySrc.includes('[data-social-retry'));
  assert.equal(ronlySrc.includes('toggleReaction'), false);
  assert.equal(ronlySrc.includes('createComment'), false);
});

// ---------------------------------------------------------------------------
// 19: Cross-moment stale response guard
// ---------------------------------------------------------------------------
it('19. stale Moment A response does not affect Moment B composer or reconciliation', async () => {
  const env = createEnv();
  env.mkPending();

  // 1. Moment A comments panel open
  await env.openPanel('mem-1');
  const taA = env.findTA(env.els.momentCommentsPanel);
  assert.ok(taA, 'textarea on Moment A');
  assert.ok(env.findBtn(env.els.momentCommentsPanel), 'composer on Moment A');

  // 2. A textarea 입력
  taA.value = 'old A input';

  // 3. createComment(A) deferred pending
  const btnA = env.findBtn(env.els.momentCommentsPanel);
  btnA.onclick();

  // 4. A request 정확히 1회
  assert.equal(env.ccCount(), 1, 'createComment called once for A');

  // 5. Moment B로 변경
  env.deps.currentSelectedId = 'mem-2';

  // 6. Moment B comments panel open
  await env.openPanel('mem-2');

  // 7. B composer 보임
  assert.ok(env.findBtn(env.els.momentCommentsPanel), 'composer on Moment B');

  // 8. B textarea에 입력
  const taB = env.findTA(env.els.momentCommentsPanel);
  assert.ok(taB, 'textarea on Moment B');
  taB.value = 'new B input';

  // 9. A response 완료 직전 publicReadCount 저장
  const readCountBefore = env.publicReadCount();

  // 10. A deferred response resolve
  env.resolve({ id: 'c-a1' });

  // 11. microtasks flush
  await flush();

  // 12. Assert: A response가 B에 영향 주지 않음
  assert.equal(taB.value, 'new B input', 'B textarea preserved after A response');
  assert.ok(env.findBtn(env.els.momentCommentsPanel), 'B composer still exists');
  assert.equal(env.els.momentCommentsPanel.hidden, false, 'B panel stays open');
  assert.equal(env.ccCount(), 1, 'no extra createComment call');
  assert.equal(env.publicReadCount(), readCountBefore, 'no reconciliation triggered by stale A response');
});

// ---------------------------------------------------------------------------
// 20-28: Success feedback
// ---------------------------------------------------------------------------
it('20. success feedback shown after successful submit', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'test';
  const btn = env.findBtn(env.els.momentCommentsPanel);
  btn.onclick();
  env.resolve({ id: 'c-20' });
  await flush();
  const el = env.findSuccess(env.els.momentCommentsPanel);
  assert.ok(el, 'success element exists');
  assert.notEqual(el.style.display, 'none', 'success message visible');
  assert.equal(el.textContent.trim(), '댓글이 등록되었습니다.', 'correct text');
});

it('21. success status has aria-live', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'test';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  env.resolve({ id: 'c-21' });
  await flush();
  const el = env.findSuccess(env.els.momentCommentsPanel);
  assert.ok(el, 'success element');
  assert.ok(el.getAttribute('aria-live'), 'has aria-live');
});

it('22. success text has no raw content', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'secret body';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  env.resolve({ id: 'c-22' });
  await flush();
  const el = env.findSuccess(env.els.momentCommentsPanel);
  assert.ok(el, 'success element');
  assert.equal(el.textContent.includes('secret body'), false, 'no comment body');
  assert.equal(el.textContent.includes('c-22'), false, 'no backend ID');
});

it('23. new submit hides previous success', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'first';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  env.resolve({ id: 'c-23a' });
  await flush();
  assert.ok(env.findSuccess(env.els.momentCommentsPanel), 'success visible');
  // New submit
  env.mkPending();
  if (ta) ta.value = 'second';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  const el = env.findSuccess(env.els.momentCommentsPanel);
  assert.equal(el.style.display, 'none', 'success hidden on new submit');
  env.resolve({ id: 'c-23b' });
  await flush();
});

it('24. failed submit: no success feedback', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'test';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  env.reject(new Error('fail'));
  await flush();
  const el = env.findSuccess(env.els.momentCommentsPanel);
  assert.equal(el.style.display, 'none', 'success hidden on failure');
});

it('25. close/reopen clears success status', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'test';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  env.resolve({ id: 'c-25' });
  await flush();
  assert.ok(env.findSuccess(env.els.momentCommentsPanel), 'success visible');
  // Close
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();
  // Reopen
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();
  const el = env.findSuccess(env.els.momentCommentsPanel);
  assert.equal(el.style.display, 'none', 'success hidden after reopen');
});

it('26. A→B switch: old success not shown on B', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'A comment';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  env.resolve({ id: 'c-26a' });
  await flush();
  assert.ok(env.findSuccess(env.els.momentCommentsPanel), 'A success visible');
  // Switch to B
  env.deps.currentSelectedId = 'mem-2';
  await env.openPanel('mem-2');
  const el = env.findSuccess(env.els.momentCommentsPanel);
  assert.equal(el.style.display, 'none', 'B has no old A success');
});

it('27. A pending → B → A completes: no success on B', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const taA = env.findTA(env.els.momentCommentsPanel);
  if (taA) taA.value = 'A pending';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  assert.equal(env.ccCount(), 1, 'A submitted');
  // Switch to B
  env.deps.currentSelectedId = 'mem-2';
  await env.openPanel('mem-2');
  // A completes
  env.resolve({ id: 'c-27a' });
  await flush();
  // B should have no success text
  const el = env.findSuccess(env.els.momentCommentsPanel);
  assert.equal(el.style.display, 'none', 'B shows no success from stale A');
  assert.equal(env.els.momentCommentsPanel.hidden, false, 'B panel stays open');
});

it('28. guest: no composer, no success, 0 write calls', async () => {
  const env = createEnv();
  env.setAuth(false);
  await env.openPanel('mem-1');
  assert.equal(env.hasBtn(env.els.momentCommentsPanel), false, 'no composer');
  assert.equal(env.findSuccess(env.els.momentCommentsPanel), null, 'no success element');
  assert.equal(env.ccCount(), 0, 'no write calls');
});

// ---------------------------------------------------------------------------
// 29-37: Cancel draft
// ---------------------------------------------------------------------------
it('29. authenticated composer has cancel button with Korean accessible name', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  const btn = env.findCancel(env.els.momentCommentsPanel);
  assert.ok(btn, 'cancel button exists');
  assert.equal(btn.type, 'button', 'type=button');
  assert.equal(btn.getAttribute('aria-label'), '댓글 입력 취소', 'aria-label');
  assert.ok(btn.textContent.includes('입력 취소'), 'text contains 입력 취소');
});

it('30. cancel clears draft, preserves panel, no API call', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'draft text';
  const readCount = env.publicReadCount();
  env.findCancel(env.els.momentCommentsPanel).onclick();
  assert.equal(ta.value, '', 'textarea cleared');
  assert.equal(env.ccCount(), 0, 'no createComment call');
  assert.equal(env.publicReadCount(), readCount, 'no reconciliation');
  assert.equal(env.els.momentCommentsPanel.hidden, false, 'panel stays open');
  assert.ok(env.findBtn(env.els.momentCommentsPanel), 'composer still present');
});

it('31. cancel after success: success hidden, draft clear, panel stays', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'test';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  env.resolve({ id: 'c-31' });
  await flush();
  assert.ok(env.findSuccess(env.els.momentCommentsPanel), 'success visible');
  // New draft
  if (ta) ta.value = 'new draft';
  env.findCancel(env.els.momentCommentsPanel).onclick();
  const el = env.findSuccess(env.els.momentCommentsPanel);
  assert.equal(el.style.display, 'none', 'success hidden after cancel');
  assert.equal(ta.value, '', 'draft cleared');
  assert.equal(env.els.momentCommentsPanel.hidden, false, 'panel stays');
});

it('32. cancel after failure: error hidden, draft clear, new key on retry', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'fail body';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  const keyBefore = env.lastKey();
  env.reject(new Error('fail'));
  await flush();
  assert.ok(env.findErr(env.els.momentCommentsPanel), 'error visible');
  // Cancel
  env.findCancel(env.els.momentCommentsPanel).onclick();
  assert.ok(!env.findErr(env.els.momentCommentsPanel), 'error cleared');
  assert.equal(ta.value, '', 'input cleared');
  // Same body resubmit gets new key
  if (ta) ta.value = 'fail body';
  env.mkPending();
  env.findBtn(env.els.momentCommentsPanel).onclick();
  assert.notEqual(env.lastKey(), keyBefore, 'new key after cancel');
  env.resolve({ id: 'c-32' });
  await flush();
});

it('33. pending submit: cancel disabled', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'pending';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  const cancelBtn = env.findCancel(env.els.momentCommentsPanel);
  assert.equal(cancelBtn.disabled, true, 'cancel disabled during pending');
  // Click does nothing
  cancelBtn.onclick();
  assert.equal(ta.value, 'pending', 'input unchanged');
  assert.equal(env.ccCount(), 1, 'no extra call');
  env.resolve({ id: 'c-33' });
  await flush();
});

it('34. pending→success: cancel restored', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'test';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  env.resolve({ id: 'c-34' });
  await flush();
  const cancelBtn = env.findCancel(env.els.momentCommentsPanel);
  assert.equal(cancelBtn.disabled, false, 'cancel restored after success');
});

it('35. pending→failure: cancel restored', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'test';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  env.reject(new Error('fail'));
  await flush();
  const cancelBtn = env.findCancel(env.els.momentCommentsPanel);
  assert.equal(cancelBtn.disabled, false, 'cancel restored after failure');
});

it('36. detached old cancel button onclick does not affect reopened composer', async () => {
  const env = createEnv();
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'old draft';

  // Save reference to OLD cancel button before close
  const oldCancelBtn = env.findCancel(env.els.momentCommentsPanel);
  assert.ok(oldCancelBtn, 'old cancel exists');

  const readCountBefore = env.publicReadCount();

  // Close panel
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();

  // Reopen — new composer is created with new cancel button
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();

  // Type draft in NEW textarea
  const taNew = env.findTA(env.els.momentCommentsPanel);
  assert.ok(taNew, 'new textarea exists');
  taNew.value = 'new draft';

  // Call OLD cancel button's onclick — should be no-op due to stale guard
  if (oldCancelBtn.onclick) oldCancelBtn.onclick();
  await flush();

  // New textarea must NOT be cleared
  assert.equal(taNew.value, 'new draft', 'new draft preserved after old cancel onclick');
  // Panel stays open
  assert.equal(env.els.momentCommentsPanel.hidden, false, 'panel stays open');
  // No extra API calls
  assert.equal(env.ccCount(), 0, 'no createComment call');
  assert.equal(env.publicReadCount(), readCountBefore, 'no reconciliation');

  // NEW cancel button still works normally
  const newCancelBtn = env.findCancel(env.els.momentCommentsPanel);
  assert.ok(newCancelBtn, 'new cancel exists');
  newCancelBtn.onclick();
  assert.equal(taNew.value, '', 'new cancel clears draft');
});

it('37. guest: no cancel, no composer, 0 write calls', async () => {
  const env = createEnv();
  env.setAuth(false);
  await env.openPanel('mem-1');
  assert.equal(env.findCancel(env.els.momentCommentsPanel), null, 'no cancel');
  assert.equal(env.hasBtn(env.els.momentCommentsPanel), false, 'no composer');
  assert.equal(env.ccCount(), 0, 'no write');
});

it('38. read-only boundary has no composerCancelBtn or 입력 취소', () => {
  const s = scriptSource.indexOf('function createPublicViewerReadOnlyReactionSummaryBoundary(deps)');
  const e = scriptSource.indexOf('function createPublicViewerAuthenticatedLikeBoundary(deps)');
  const b = scriptSource.slice(s, e);
  assert.equal(b.includes('composerCancelBtn'), false, 'no composerCancelBtn in read-only');
  assert.equal(b.includes('입력 취소'), false, 'no 입력 취소 in read-only');
  assert.equal(b.includes('createComment'), false, 'no createComment in read-only');
  assert.equal(b.includes('composer'), false, 'no composer in read-only');
});

// ---------------------------------------------------------------------------
// 39-43: Blank input validation
// ---------------------------------------------------------------------------
it('39. empty input shows validation error, no API call', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = '';
  const readCount = env.publicReadCount();
  env.findBtn(env.els.momentCommentsPanel).onclick();
  const errEl = env.findValidation(env.els.momentCommentsPanel);
  assert.ok(errEl, 'validation error element exists');
  assert.equal(errEl.textContent.trim(), '댓글 내용을 입력해주세요.', 'validation message');
  assert.ok(errEl.getAttribute('aria-live'), 'has aria-live');
  assert.equal(env.ccCount(), 0, 'no createComment call');
  assert.equal(env.publicReadCount(), readCount, 'no reconciliation');
  assert.equal(env.els.momentCommentsPanel.hidden, false, 'panel stays open');
  assert.ok(env.findBtn(env.els.momentCommentsPanel), 'submit still enabled');
});

it('40. whitespace-only input shows validation error, no API call', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = '   ';
  const readCount = env.publicReadCount();
  env.findBtn(env.els.momentCommentsPanel).onclick();
  const errEl = env.findValidation(env.els.momentCommentsPanel);
  assert.ok(errEl, 'validation error');
  assert.equal(errEl.textContent.trim(), '댓글 내용을 입력해주세요.');
  assert.equal(env.ccCount(), 0, 'no write');
  assert.equal(env.publicReadCount(), readCount, 'no reconciliation');
});

it('41. correction clears validation, then valid submit calls API once', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = '';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  assert.ok(env.findValidation(env.els.momentCommentsPanel), 'validation shown');
  // Type to correct
  if (ta) {
    ta.value = 'valid comment';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // Validation should be cleared
  assert.equal(env.findValidation(env.els.momentCommentsPanel), null, 'validation cleared after input');

  // Now submit - should call API once
  env.mkPending();
  env.findBtn(env.els.momentCommentsPanel).onclick();
  assert.equal(env.ccCount(), 1, 'write called once');
  env.resolve({ id: 'c-41' });
  await flush();
});

it('42. server failure and local validation do not mix', async () => {
  const env = createEnv();
  // First trigger a server failure
  env.mkPending();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = 'will fail';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  env.reject(new Error('Server Error'));
  await flush();
  const serverErr = env.findErr(env.els.momentCommentsPanel);
  assert.ok(serverErr, 'server error shown');
  assert.equal(serverErr.textContent.includes('등록하지 못했습니다'), true, 'server error text');

  // Type in textarea - should NOT clear server error
  if (ta) {
    ta.value = 'typing...';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const afterInput = env.findErr(env.els.momentCommentsPanel);
  assert.ok(afterInput, 'server error still visible after input');
  assert.equal(afterInput.textContent.includes('등록하지 못했습니다'), true, 'server error preserved');

  // Clear manually via cancel
  env.findCancel(env.els.momentCommentsPanel).onclick();
  assert.equal(env.findErr(env.els.momentCommentsPanel), null, 'error cleared by cancel');

  // Now empty submit shows validation, not server error
  if (ta) ta.value = '';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  const validErr = env.findValidation(env.els.momentCommentsPanel);
  assert.ok(validErr, 'validation error after cancel+empty');
  assert.equal(validErr.textContent.trim(), '댓글 내용을 입력해주세요.', 'validation message');
});

it('43. close/reopen and moment switch clear validation', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = '';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  assert.ok(env.findValidation(env.els.momentCommentsPanel), 'validation shown');

  // Close panel
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();

  // Reopen - no validation
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();
  assert.equal(env.findValidation(env.els.momentCommentsPanel), null, 'validation gone after reopen');

  // Switch to Moment B and back
  env.deps.currentSelectedId = 'mem-2';
  await env.openPanel('mem-2');
  assert.equal(env.findValidation(env.els.momentCommentsPanel), null, 'no validation on B');
});

it('44. whitespace-only input does not clear validation', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  const ta = env.findTA(env.els.momentCommentsPanel);
  if (ta) ta.value = '';
  env.findBtn(env.els.momentCommentsPanel).onclick();
  assert.ok(env.findValidation(env.els.momentCommentsPanel), 'validation shown');

  // Whitespace-only input should NOT clear validation
  if (ta) {
    ta.value = '   ';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  assert.ok(env.findValidation(env.els.momentCommentsPanel), 'validation remains after whitespace input');
  assert.equal(env.ccCount(), 0, 'no createComment');
  assert.equal(env.lastKey(), null, 'no idempotency key');

  // Non-empty input clears validation
  if (ta) {
    ta.value = 'real comment';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  assert.equal(env.findValidation(env.els.momentCommentsPanel), null, 'validation cleared after non-empty input');

  // Valid submit works
  env.mkPending();
  env.findBtn(env.els.momentCommentsPanel).onclick();
  assert.equal(env.ccCount(), 1, 'write called');
  env.resolve({ id: 'c-44' });
  await flush();
});

it('45. composer boundary does not call focus() arbitrarily', () => {
  const cs = scriptSource.indexOf('function createPublicViewerAuthenticatedCommentComposerBoundary(deps)');
  const ce = scriptSource.indexOf('function createPublicViewerTreeMetaBoundary(deps)');
  const c = scriptSource.slice(cs, ce);
  // Composer boundary must not call .focus() anywhere
  assert.equal(c.includes('.focus()'), false, 'composer boundary has no .focus() call');
  // Must not import or reference document.activeElement
  assert.equal(c.includes('activeElement'), false, 'composer boundary does not reference activeElement');
});

// ---------------------------------------------------------------------------
// 46-54: Guest participation note
// ---------------------------------------------------------------------------
it('46. guest: guest note rendered with exact text, no composer elements', async () => {
  const env = createEnv();
  env.setAuth(false);
  await env.openPanel('mem-1');

  const panel = env.els.momentCommentsPanel;
  const note = env.findGuestNote(panel);
  assert.ok(note, 'guest note must exist in panel');
  assert.equal(note.getAttribute('data-guest-comment-note'), '1', 'data attribute');
  assert.equal(note.textContent.trim(),
    '댓글은 읽을 수 있어요. 로그인하면 댓글을 남길 수 있어요.',
    'exact guest note text');
  assert.equal(env.hasBtn(panel), false, 'no submit button');
  assert.equal(env.findTA(panel), null, 'no textarea');
  assert.equal(env.findCancel(panel), null, 'no cancel button');
  assert.equal(env.ccCount(), 0, 'no createComment calls');
});

it('47. guest note has aria-live but no focus move', async () => {
  const env = createEnv();
  env.setAuth(false);
  await env.openPanel('mem-1');
  const note = env.findGuestNote(env.els.momentCommentsPanel);
  assert.ok(note, 'guest note exists');
  assert.equal(note.getAttribute('aria-live'), 'polite', 'aria-live polite');
  // Verify no button/link/onclick on the note itself
  assert.equal(note.tagName, 'P', 'guest note is a <p> element');
  assert.equal(note.onclick, null, 'no onclick on note');
});

it('48. authenticated: no guest note, composer visible', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  const panel = env.els.momentCommentsPanel;
  const note = env.findGuestNote(panel);
  assert.equal(note, null, 'no guest note when authenticated');
  assert.ok(env.findBtn(panel), 'submit button present');
  assert.ok(env.findTA(panel), 'textarea present');
});

it('49. close panel removes guest note, reopen shows it again', async () => {
  const env = createEnv();
  env.setAuth(false);
  await env.openPanel('mem-1');
  const panel = env.els.momentCommentsPanel;
  assert.ok(env.findGuestNote(panel), 'guest note visible');

  // Close
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();
  assert.equal(env.findGuestNote(panel), null, 'guest note removed after close');

  // Reopen
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();
  assert.ok(env.findGuestNote(panel), 'guest note visible after reopen');
});

it('50. moment switch: guest note not duplicated', async () => {
  const env = createEnv();
  env.setAuth(false);
  await env.openPanel('mem-1');
  const panel = env.els.momentCommentsPanel;

  // Moment A: exactly one guest note
  const notesA = [].concat(env.findGuestNote(panel)).filter(Boolean);
  assert.ok(env.findGuestNote(panel), 'guest note on Moment A');

  // Switch to Moment B
  env.deps.currentSelectedId = 'mem-2';
  await env.openPanel('mem-2');
  assert.ok(env.findGuestNote(panel), 'guest note on Moment B');
  // No duplicate — there should be exactly one note at any time
  const notesB = [];
  (function walk(e) {
    if (e.getAttribute && e.getAttribute('data-guest-comment-note') === '1') notesB.push(e);
    if (e.children) for (const c of e.children) walk(c);
  })(panel);
  assert.equal(notesB.length, 1, 'exactly one guest note on moment switch');
  assert.equal(env.hasBtn(panel), false, 'no composer button on guest');
  assert.equal(env.ccCount(), 0, 'no createComment calls');
});

it('51. repeat update keeps exactly one guest note', async () => {
  const env = createEnv();
  env.setAuth(false);
  await env.openPanel('mem-1');
  const panel = env.els.momentCommentsPanel;

  // Trigger a second update (same moment, guest, open)
  env.ui.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 20));

  // Still exactly one note
  const notes = [];
  (function walk(e) {
    if (e.getAttribute && e.getAttribute('data-guest-comment-note') === '1') notes.push(e);
    if (e.children) for (const c of e.children) walk(c);
  })(panel);
  assert.equal(notes.length, 1, 'exactly one guest note after repeat update');
  assert.equal(env.hasBtn(panel), false, 'no composer');
  assert.equal(env.ccCount(), 0, 'no createComment');
});

it('52. guest→auth transition: guest note removed, composer shown', async () => {
  const env = createEnv();
  env.setAuth(false);
  await env.openPanel('mem-1');
  const panel = env.els.momentCommentsPanel;
  assert.ok(env.findGuestNote(panel), 'guest note visible');
  assert.equal(env.findBtn(panel), null, 'no composer');

  // Close panel, then auth + reopen to force fresh evaluation
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();
  env.setAuth(true);
  await env.openPanel('mem-1');
  assert.equal(env.findGuestNote(panel), null, 'guest note removed after auth');
  assert.ok(env.findBtn(panel), 'composer shown after auth');
});

it('53. auth→guest transition: composer removed, guest note shown', async () => {
  const env = createEnv();
  await env.openPanel('mem-1');
  const panel = env.els.momentCommentsPanel;
  assert.ok(env.findBtn(panel), 'composer visible when auth');
  assert.equal(env.findGuestNote(panel), null, 'no guest note');

  // Close panel, then guest + reopen to force fresh evaluation
  if (env.els.momentReactionCommentStatus && env.els.momentReactionCommentStatus.onclick) {
    env.els.momentReactionCommentStatus.onclick();
  }
  await flush();
  env.setAuth(false);
  await env.openPanel('mem-1');
  assert.equal(env.hasBtn(panel), false, 'composer removed after guest');
  assert.ok(env.findGuestNote(panel), 'guest note shown after guest');
});

it('54. composer source file has no .focus() or activeElement references', () => {
  const composerSrc = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-authenticated-comment-composer.js'), 'utf8');
  const codeOnly = composerSrc.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  assert.equal(/\.focus\s*\(/.test(codeOnly), false,
    'composer file must not call .focus()');
  assert.equal(/activeElement/.test(codeOnly), false,
    'composer file must not reference activeElement');
});

// ---------------------------------------------------------------------------
// 55-56: Standalone composer updater — panel stays open, no reset/close
// ---------------------------------------------------------------------------
function findGuestNote(p) { function f(e) { if (e.getAttribute && e.getAttribute('data-guest-comment-note') === '1') return e; if (e.children) for (var i = 0; i < e.children.length; i++) { var r = f(e.children[i]); if (r) return r; } return null; } return f(p); }
function findBtn(p) { function f(e) { if (e.textContent === '등록') return e; if (e.children) for (var i = 0; i < e.children.length; i++) { var r = f(e.children[i]); if (r) return r; } return null; } return f(p); }
function findTA(p) { function f(e) { if (e.tagName === 'TEXTAREA') return e; if (e.children) for (var i = 0; i < e.children.length; i++) { var r = f(e.children[i]); if (r) return r; } return null; } return f(p); }
function findCancel(p) { function f(e) { if (e.tagName === 'BUTTON' && e.textContent && e.textContent.indexOf('입력 취소') !== -1) return e; if (e.children) for (var i = 0; i < e.children.length; i++) { var r = f(e.children[i]); if (r) return r; } return null; } return f(p); }

function createStandaloneComposer() {
  var ccCount = 0;
  var auth = false;
  var panelEl = {
    tagName: 'DIV', hidden: false, children: [], style: {},
    attributes: {}, onclick: null,
    setAttribute: function(n, v) { this.attributes[n] = v; },
    getAttribute: function(n) { return this.attributes[n] || null; },
    appendChild: function(c) { this.children.push(c); c.parentElement = this; c.parentNode = this; },
    removeChild: function(c) { var i = this.children.indexOf(c); if (i !== -1) { this.children.splice(i, 1); c.parentElement = null; c.parentNode = null; } },
    parentElement: null,
    querySelector: function() { return null; },
    addEventListener: function() {},
  };
  var ctx = vm.createContext({
    window: {},
    document: {
      createElement: function(tag) {
        var e = {
          tagName: (tag || 'div').toUpperCase(), textContent: '', children: [],
          style: {}, attributes: {}, onclick: null, value: '', _hidden: false, _listeners: {},
          get hidden() { return this._hidden; },
          set hidden(v) { this._hidden = !!v; },
          classList: { classes: new Set(), add: function(c) { this.classes.add(c); }, remove: function(c) { this.classes.delete(c); }, contains: function(c) { return this.classes.has(c); } },
          disabled: false, _disabled: false,
          setAttribute: function(n, v) { this.attributes[n] = v; if (n === 'disabled') this._disabled = true; },
          removeAttribute: function(n) { delete this.attributes[n]; if (n === 'disabled') this._disabled = false; },
          getAttribute: function(n) { return this.attributes[n]; },
          get parentElement() { return this._parent || null; },
          set parentElement(v) { this._parent = v; },
          get parentNode() { return this._parent || null; },
          set parentNode(v) { this._parent = v; },
          appendChild: function(c) { this.children.push(c); c.parentElement = this; c.parentNode = this; },
          removeChild: function(c) { var i = this.children.indexOf(c); if (i !== -1) { this.children.splice(i, 1); c.parentElement = null; c.parentNode = null; } },
          focus: function() { this._focusCount = (this._focusCount || 0) + 1; },
          closest: function() { return this.parentElement || this; },
          contains: function(child) { if (!child) return false; if (child === this) return true; for (var ci = 0; ci < this.children.length; ci++) { var c = this.children[ci]; if (c === child || (c.contains && c.contains(child))) return true; } return false; },
          addEventListener: function(type, handler) { this._listeners[type] = handler; },
        };
        return e;
      },
      getElementById: function(id) {
        if (id === 'momentCommentsPanel') return panelEl;
        return null;
      },
    }
  });
  ctx.window = ctx;

  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-authenticated-comment-composer.js'), 'utf8'),
    ctx
  );

  var composerFn = ctx.LoveBudPublicViewerAuthenticatedCommentComposer
    .createPublicViewerAuthenticatedCommentComposerBoundary({
      hasConfirmedAuthSession: function() { return auth; },
      createComment: async function() { ccCount++; return { id: 'c-' + ccCount }; },
      reconcilePublicSummary: function() {},
      sharedGenerationRef: { value: 1 }
    });

  return {
    composer: composerFn,
    panel: panelEl,
    setAuth: function(v) { auth = !!v; },
    ccCount: function() { return ccCount; },
  };
}

it('55. guest→auth direct updater: panel stays open, stale note removed, composer shown', async () => {
  var sc = createStandaloneComposer();
  sc.panel.hidden = false;
  sc.setAuth(false);

  // First call: guest panel — guest note appears
  sc.composer({ open: true, treeId: 'tree-1', memoryId: 'mem-1', data: { id: 'mem-1', treeId: 'tree-1' }, generation: 1 });
  var note = findGuestNote(sc.panel);
  assert.ok(note, 'guest note visible on first call');
  assert.equal(note.getAttribute('data-guest-comment-note'), '1', 'data attribute on guest note');

  // No composer elements in guest state
  assert.equal(findBtn(sc.panel), null, 'no submit button');
  assert.equal(findTA(sc.panel), null, 'no textarea');
  assert.equal(findCancel(sc.panel), null, 'no cancel button');
  assert.equal(sc.ccCount(), 0, 'no createComment');

  // Second call: same panel, same updater, auth changed — panel stays open
  sc.setAuth(true);
  sc.composer({ open: true, treeId: 'tree-1', memoryId: 'mem-1', data: { id: 'mem-1', treeId: 'tree-1' }, generation: 1 });

  // Stale guest note must be gone; composer appears
  assert.equal(findGuestNote(sc.panel), null, 'stale guest note removed');
  assert.ok(findBtn(sc.panel), 'submit button shown');
  assert.ok(findTA(sc.panel), 'textarea shown');
  assert.ok(findCancel(sc.panel), 'cancel button shown');
  assert.equal(sc.panel.hidden, false, 'panel stays open');
  assert.equal(sc.ccCount(), 0, 'no createComment before submit');
});

it('56. auth→guest direct updater: panel stays open, stale composer removed, guest note shown', async () => {
  var sc = createStandaloneComposer();
  sc.panel.hidden = false;
  sc.setAuth(true);

  // First call: authenticated — composer appears
  sc.composer({ open: true, treeId: 'tree-1', memoryId: 'mem-1', data: { id: 'mem-1', treeId: 'tree-1' }, generation: 1 });
  assert.ok(findBtn(sc.panel), 'submit button visible on first call');
  assert.ok(findTA(sc.panel), 'textarea visible');
  assert.ok(findCancel(sc.panel), 'cancel button visible');
  assert.equal(findGuestNote(sc.panel), null, 'no guest note');

  // Second call: same panel, same updater, auth changed — panel stays open
  sc.setAuth(false);
  sc.composer({ open: true, treeId: 'tree-1', memoryId: 'mem-1', data: { id: 'mem-1', treeId: 'tree-1' }, generation: 1 });

  // Stale composer must be gone; guest note appears
  assert.equal(findBtn(sc.panel), null, 'submit button removed');
  assert.equal(findTA(sc.panel), null, 'textarea removed');
  assert.equal(findCancel(sc.panel), null, 'cancel button removed');

  var note = findGuestNote(sc.panel);
  assert.ok(note, 'guest note shown');
  assert.equal(note.getAttribute('data-guest-comment-note'), '1', 'data attribute on guest note');
  assert.equal(sc.panel.hidden, false, 'panel stays open');
  assert.equal(sc.ccCount(), 0, 'no createComment calls');
});
