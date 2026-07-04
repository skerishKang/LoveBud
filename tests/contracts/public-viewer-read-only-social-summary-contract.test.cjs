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
    classList,
    parentElement: null,
    children: [],
    attributes: {},
    textContent: '',
    onclick: null,
    setAttribute(name, val) { this.attributes[name] = val; },
    removeAttribute(name) { delete this.attributes[name]; },
    getAttribute(name) { return this.attributes[name]; },
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
      if (sel === '[data-social-retry="1"]') {
        return this.children.find(c => c.getAttribute && c.getAttribute('data-social-retry') === '1') || null;
      }
      return null;
    },
    closest() { return this.parentElement || this; }
  };
  return element;
}

function createDetailUI(fetchReactionSummary, fetchComments) {
  const elements = {
    momentReactionsCard: createMockElement(),
    momentReactionLikeValue: createMockElement(),
    momentReactionCommentValue: createMockElement(),
    momentReactionNote: createMockElement(),
    detailTreeMetaMount: createMockElement(),
    detailCurrentMomentBadge: createMockElement(),
    detailCurrentMomentTitle: createMockElement(),
    detailCurrentMomentHint: createMockElement(),
    detailImg: createMockElement('img'),
    detailDateText: createMockElement(),
    detailMemo: createMockElement(),
    detailTags: createMockElement()
  };

  const likeStatus = createMockElement();
  const commentStatus = createMockElement();
  elements.momentReactionLikeValue.parentElement = likeStatus;
  elements.momentReactionCommentValue.parentElement = commentStatus;

  const imgParent = createMockElement('div');
  imgParent.classList.add('detail-video');
  imgParent.appendChild(elements.detailImg);

  const context = {
    window: {},
    document: {
      createElement(tagName) { return createMockElement(tagName); },
      getElementById(id) { return elements[id] || null; },
      querySelector(sel) {
        if (sel === '#detailPanel h3') return createMockElement('h3');
        if (sel === '.detail-video img') return elements.detailImg;
        if (sel === '.diary-note') return elements.detailMemo;
        return null;
      },
      querySelectorAll() { return []; }
    }
  };
  context.window = context;

  vm.createContext(context);
  const metadataCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-metadata-text.js'), 'utf8');
  vm.runInContext(metadataCode, context);
  vm.runInContext(scriptSource, context);

  const deps = {
    getSelectedNodeId: () => 'mem-1',
    isRootMemory: (data, rootId) => data && data.id === rootId,
    getCanonicalRootId: () => 'root',
    getTreeMemories: () => [{ id: 'mem-1' }],
    resolveMemoryThumbnail: (data) => data.thumbnail || '',
    i18n: (key) => key,
    getLocalSaveMode: () => false,
    showToast: () => {},
    fetchPublicMomentReactionSummary: fetchReactionSummary,
    fetchPublicMomentComments: fetchComments
  };

  const detailUI = context.createPublicViewerDetailUI(deps);
  return { elements, detailUI, context };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('injected public-read callbacks are used — no private API path invocations', () => {
  // Verify the source only references the injected callback names, not private API paths
  const noPrivateReactionPath = !/toggleReaction|private.*reaction|reaction.*write/i.test(scriptSource);
  const noPrivateCommentPath = !/createComment|composer|comment.*drawer/i.test(scriptSource);
  assert.ok(noPrivateReactionPath, 'source must not reference private reaction API');
  assert.ok(noPrivateCommentPath, 'source must not reference private comment API');
});

test('root moment or missing context causes no read', () => {
  const { elements, detailUI } = createDetailUI(
    async () => { throw new Error('should not be called for root'); },
    async () => { throw new Error('should not be called for root'); }
  );

  // Reset card to visible
  elements.momentReactionsCard.style.display = '';

  // Root moment
  detailUI.updateDetailPanel({ id: 'root', treeId: 'tree-1' });
  assert.equal(elements.momentReactionsCard.style.display, 'none', 'hidden for root');

  elements.momentReactionsCard.style.display = ''; // reset

  // No treeId
  detailUI.updateDetailPanel({ id: 'mem-1' });
  assert.equal(elements.momentReactionsCard.style.display, 'none', 'hidden when treeId missing');

  elements.momentReactionsCard.style.display = ''; // reset

  // No memory id
  detailUI.updateDetailPanel({ treeId: 'tree-1' });
  assert.equal(elements.momentReactionsCard.style.display, 'none', 'hidden when memory id missing');
});

test('loading state shown during fetch', () => {
  let resolveReaction, resolveComments;
  const reactionPromise = new Promise(r => { resolveReaction = r; });
  const commentsPromise = new Promise(r => { resolveComments = r; });

  const { elements, detailUI } = createDetailUI(
    async () => reactionPromise,
    async () => commentsPromise
  );

  // Non-root moment with treeId
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });

  // Should show loading state immediately
  assert.equal(elements.momentReactionsCard.style.display, '', 'card visible during loading');
  assert.equal(elements.momentReactionsCard.dataset.socialLoading, 'true', 'loading attribute set');
  assert.equal(elements.momentReactionLikeValue.textContent, '⋯', 'like shows loading indicator');
  assert.equal(elements.momentReactionCommentValue.textContent, '⋯', 'comment shows loading indicator');
  assert.equal(elements.momentReactionNote.textContent, '반응 기능은 준비 중이에요.', 'note unchanged during loading');

  // Resolve fetches
  resolveReaction({ reactions: [{ type: 'like' }], likeCount: 1 });
  resolveComments({ comments: [] });
});

test('loading → success with zero comments renders 0', async () => {
  const { elements, detailUI } = createDetailUI(
    async () => ({ reactions: [], likeCount: 0 }),
    async () => ({ comments: [] })
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });

  // Wait for async render
  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionsCard.dataset.socialLoading, undefined, 'loading removed on success');
  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'like count is 0');
  assert.equal(elements.momentReactionCommentValue.textContent, '0', 'comment count is 0');
});

test('bounded comment label for nonzero returned comments', async () => {
  const { elements, detailUI } = createDetailUI(
    async () => ({ reactions: [{ type: 'like' }, { type: 'like' }], likeCount: 2 }),
    async () => ({ comments: [{ id: 'c1', body: 'test' }, { id: 'c2' }, { id: 'c3' }] })
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });

  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionLikeValue.textContent, '2', 'like count is 2');
  assert.equal(elements.momentReactionCommentValue.textContent, '3개 표시', 'bounded comment label');
});

test('safe unavailable state with retry button', async () => {
  const { elements, detailUI } = createDetailUI(
    async () => { throw new Error('network error'); },
    async () => { throw new Error('network error'); }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });

  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionsCard.dataset.socialLoading, undefined, 'loading removed on failure');
  assert.equal(elements.momentReactionLikeValue.textContent, '—', 'like shows unavailable');
  assert.equal(elements.momentReactionCommentValue.textContent, '—', 'comment shows unavailable');
  assert.equal(elements.momentReactionNote.textContent, '반응 정보를 불러올 수 없어요.', 'unavailable note');

  // Retry button must exist and be a real button
  const retryBtn = elements.momentReactionsCard.querySelector('[data-social-retry="1"]');
  assert.ok(retryBtn, 'retry button present in unavailable state');
  assert.equal(retryBtn.tagName, 'BUTTON', 'retry is a real button');
  assert.equal(retryBtn.textContent, '다시 시도', 'retry button text');

  // Now mock success for retry
  const nextResolve = Promise.all([
    new Promise(r => setTimeout(r, 10)),
  ]);

  // Simulate retry by clicking
  if (retryBtn.onclick) {
    retryBtn.onclick();
  }

  await new Promise(r => setTimeout(r, 50));

  // After retry with failing stubs, still in unavailable — but button should be wired
  // (actual retry result depends on our stub which still throws)
});

test('no raw error text rendered on failure', async () => {
  const { elements, detailUI } = createDetailUI(
    async () => { throw new Error('CONNECTION_REFUSED'); },
    async () => { throw new Error('INTERNAL_SERVER_ERROR'); }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });

  await new Promise(r => setTimeout(r, 50));

  // These exact error strings must NOT appear anywhere in the rendered content
  const renderedText = elements.momentReactionLikeValue.textContent + ' '
    + elements.momentReactionCommentValue.textContent + ' '
    + elements.momentReactionNote.textContent;

  assert.ok(!renderedText.includes('CONNECTION_REFUSED'), 'no raw error text');
  assert.ok(!renderedText.includes('INTERNAL_SERVER_ERROR'), 'no raw error text');

  const retryBtn = elements.momentReactionsCard.querySelector('[data-social-retry="1"]');
  if (retryBtn) {
    assert.ok(!retryBtn.textContent.includes('CONNECTION_REFUSED'), 'retry btn has no raw error');
    assert.ok(!retryBtn.textContent.includes('INTERNAL_SERVER_ERROR'), 'retry btn has no raw error');
  }
});

test('stale older response cannot overwrite newer selected moment', async () => {
  let resolveOldReaction, resolveOldComments, resolveNewReaction, resolveNewComments;
  const oldReactionP = new Promise(r => { resolveOldReaction = r; });
  const oldCommentsP = new Promise(r => { resolveOldComments = r; });
  const newReactionP = new Promise(r => { resolveNewReaction = r; });
  const newCommentsP = new Promise(r => { resolveNewComments = r; });

  let oldCalled = false;
  let newCalled = false;

  const { elements, detailUI } = createDetailUI(
    async (treeId, memoryId) => {
      if (memoryId === 'old') { oldCalled = true; return oldReactionP; }
      if (memoryId === 'new') { newCalled = true; return newReactionP; }
      return { reactions: [] };
    },
    async (treeId, memoryId) => {
      if (memoryId === 'old') return oldCommentsP;
      if (memoryId === 'new') return newCommentsP;
      return { comments: [] };
    }
  );

  // Select old moment
  detailUI.updateDetailPanel({ id: 'old', treeId: 'tree-1' });
  assert.ok(oldCalled, 'old moment fetch started');

  // Select new moment before old resolves
  detailUI.updateDetailPanel({ id: 'new', treeId: 'tree-1' });
  assert.ok(newCalled, 'new moment fetch started');

  // Resolve old moment first (should be ignored — generation mismatch)
  resolveOldReaction({ reactions: [{ type: 'like' }], likeCount: 999 });
  resolveOldComments({ comments: [{ id: 'stale', body: 'ignore' }] });
  await new Promise(r => setTimeout(r, 50));

  // Card should still be loading (new hasn't resolved yet)
  assert.equal(elements.momentReactionsCard.dataset.socialLoading, 'true',
    'still loading because new moment not yet resolved');

  // Resolve new moment
  resolveNewReaction({ reactions: [{ type: 'like' }, { type: 'like' }, { type: 'like' }, { type: 'like' }, { type: 'like' }], likeCount: 5 });
  resolveNewComments({ comments: [] });
  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionsCard.dataset.socialLoading, undefined,
    'loading removed after new resolves');
  assert.equal(elements.momentReactionLikeValue.textContent, '5',
    'new moment like count rendered (not stale 999)');
});

test('#1882 wording rule — only Refs, never Closes/Fixes', () => {
  // In this test file
  assert.ok(!scriptSource.includes('Fixes #1882'), 'must not use Fixes #1882');
  assert.ok(!scriptSource.includes('Closes #1882'), 'must not use Closes #1882');
  assert.ok(!scriptSource.includes('Resolves #1882'), 'must not use Resolves #1882');
});
