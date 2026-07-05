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
    _disabled: false,
    setAttribute(name, val) {
      this.attributes[name] = val;
      if (name === 'disabled') this._disabled = true;
    },
    removeAttribute(name) {
      delete this.attributes[name];
      if (name === 'disabled') this._disabled = false;
    },
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
  Object.defineProperty(element, 'disabled', {
    get() { return this._disabled; },
    set(val) {
      this._disabled = !!val;
      if (this._disabled) {
        this.attributes['disabled'] = '';
      } else {
        delete this.attributes['disabled'];
      }
    },
    enumerable: true,
    configurable: true
  });
  return element;
}

function createDetailUI(fetchReactionSummary, fetchComments) {
  const elements = {
    momentReactionsCard: createMockElement(),
    momentReactionLikeValue: createMockElement(),
    momentReactionCommentValue: createMockElement(),
    momentReactionNote: createMockElement(),
    momentReactionCommentStatus: createMockElement('button'),
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

  const likeStatus = createMockElement();
  elements.momentReactionLikeValue.parentElement = likeStatus;
  elements.momentReactionCommentValue.parentElement = elements.momentReactionCommentStatus;

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
    currentSelectedId: 'mem-1',
    treeMemories: [{ id: 'mem-1', treeId: 'tree-1' }],
    getSelectedNodeId: () => deps.currentSelectedId,
    isRootMemory: (data, rootId) => data && data.id === rootId,
    getCanonicalRootId: () => 'root',
    getTreeMemories: () => deps.treeMemories,
    resolveMemoryThumbnail: (data) => data.thumbnail || '',
    i18n: (key) => key,
    getLocalSaveMode: () => false,
    showToast: () => {},
    fetchPublicMomentReactionSummary: fetchReactionSummary,
    fetchPublicMomentComments: fetchComments,
    hasConfirmedAuthSession: () => false,
    createComment: async () => ({ id: 'mock-cmt-1' })
  };

  const detailUI = context.createPublicViewerDetailUI(deps);

  return { elements, detailUI, context, deps };
}

// Public DTO fixtures (authoritative endpoint shape only)
function reactionDTO(like) {
  return { counts: { like: like }, total: like };
}

function reactionDTOEmpty() {
  return { counts: {}, total: 0 };
}

const commentsDTOEmpty = { comments: [], nextCursor: null };
const commentsDTOThree = { comments: [{ id: 'c1', body: 'a' }, { id: 'c2', body: 'b' }, { id: 'c3', body: 'c' }], nextCursor: null };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('injected public-read callbacks are used in read-only boundary — no private API path invocations', () => {
  // Extract only the read-only boundary function body, not the new auth boundary
  const readOnlyFn = scriptSource.match(/function createPublicViewerReadOnlyReactionSummaryBoundary[\s\S]*?(?=function createPublicViewerAuthenticatedLikeBoundary|function createPublicViewerTreeMetaBoundary)/);
  const readOnlySource = readOnlyFn ? readOnlyFn[0] : scriptSource;
  assert.ok(!/toggleReaction|private.*reaction|reaction.*write/i.test(readOnlySource), 'read-only boundary must not reference private reaction API');
  // createComment may appear in the composer now
  const noPrivateCommentPath = !/comment.*drawer/i.test(readOnlySource);
  assert.ok(noPrivateCommentPath, 'read-only boundary must not reference comment drawer');
});

test('root moment or missing context causes no read', () => {
  const { elements, detailUI, deps } = createDetailUI(
    async () => { throw new Error('should not be called for root'); },
    async () => { throw new Error('should not be called for root'); }
  );

  elements.momentReactionsCard.style.display = '';

  // Root moment
  deps.currentSelectedId = 'root';
  deps.treeMemories = [{ id: 'root', treeId: 'tree-1' }];
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

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });

  assert.equal(elements.momentReactionsCard.style.display, '', 'card visible during loading');
  assert.equal(elements.momentReactionsCard.dataset.socialLoading, 'true', 'loading attribute set');
  assert.equal(elements.momentReactionLikeValue.textContent, '\u22EF', 'like shows loading indicator');
  assert.equal(elements.momentReactionCommentValue.textContent, '\u22EF', 'comment shows loading indicator');
  assert.equal(elements.momentReactionNote.textContent, '반응 기능은 준비 중이에요.', 'note unchanged during loading');

  resolveReaction(reactionDTO(0));
  resolveComments(commentsDTOEmpty);
});

test('loading to success with zero likes and zero comments', async () => {
  const { elements, detailUI } = createDetailUI(
    async () => reactionDTO(0),
    async () => commentsDTOEmpty
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionsCard.dataset.socialLoading, undefined, 'loading removed on success');
  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'like count is 0');
  assert.equal(elements.momentReactionCommentValue.textContent, '0', 'comment count is 0');
});

test('counts.like renders correct value', async () => {
  const { elements, detailUI } = createDetailUI(
    async () => reactionDTO(3),
    async () => commentsDTOEmpty
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionLikeValue.textContent, '3', 'like count renders value from counts.like');
});

test('missing counts.like means 0', async () => {
  const { elements, detailUI } = createDetailUI(
    async () => reactionDTOEmpty(),
    async () => commentsDTOEmpty
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionLikeValue.textContent, '0', 'missing counts.like defaults to 0');
});

test('bounded comment label for nonzero returned comments', async () => {
  const { elements, detailUI } = createDetailUI(
    async () => reactionDTO(2),
    async () => commentsDTOThree
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionLikeValue.textContent, '2', 'like count is 2');
  assert.equal(elements.momentReactionCommentValue.textContent, '3개 표시', 'bounded comment label');
});

test('malformed reaction DTO renders unavailable', async () => {
  const malformedCases = [
    async () => ({ counts: null }),
    async () => ({ counts: { like: 'abc' } }),
    async () => ({ counts: { like: -1 } }),
    async () => ({ counts: { like: 1.5 } }),
    async () => ({ counts: { like: NaN } }),
    async () => ({ counts: [] }),
    async () => ({}),
    async () => null,
  ];

  for (const badReaction of malformedCases) {
    const { elements, detailUI } = createDetailUI(badReaction, async () => commentsDTOEmpty);
    elements.momentReactionsCard.dataset.socialLoading = 'true';
    elements.momentReactionsCard.style.display = '';
    elements.momentReactionLikeValue.textContent = '\u22EF';
    elements.momentReactionCommentValue.textContent = '\u22EF';

    detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
    await new Promise(r => setTimeout(r, 50));

    assert.equal(elements.momentReactionsCard.dataset.socialLoading, undefined, 'loading removed for malformed reaction');
    assert.equal(elements.momentReactionLikeValue.textContent, '\u2014', 'like shows unavailable for malformed reaction');
    assert.equal(elements.momentReactionCommentValue.textContent, '\u2014', 'comment shows unavailable for malformed reaction');
    assert.equal(elements.momentReactionNote.textContent, '반응 정보를 불러올 수 없어요.', 'unavailable note for malformed reaction');
  }
});

test('malformed comments DTO renders unavailable', async () => {
  const malformedCases = [
    async () => ({ comments: null }),
    async () => ({ comments: 'not-array' }),
    async () => ({}),
    async () => null,
    async () => ({ comments: { id: 'oops' } }),
    // nextCursor contract violations
    async () => ({ comments: [] }),
    async () => ({ comments: [], nextCursor: 'unexpected' }),
    async () => ({ comments: [], nextCursor: {} }),
  ];

  for (const badComments of malformedCases) {
    const { elements, detailUI } = createDetailUI(
      async () => reactionDTO(1),
      badComments
    );
    elements.momentReactionsCard.dataset.socialLoading = 'true';
    elements.momentReactionsCard.style.display = '';
    elements.momentReactionLikeValue.textContent = '\u22EF';
    elements.momentReactionCommentValue.textContent = '\u22EF';

    detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
    await new Promise(r => setTimeout(r, 50));

    assert.equal(elements.momentReactionsCard.dataset.socialLoading, undefined, 'loading removed for malformed comments');
    assert.equal(elements.momentReactionLikeValue.textContent, '\u2014', 'like shows unavailable for malformed comments');
    assert.equal(elements.momentReactionCommentValue.textContent, '\u2014', 'comment shows unavailable for malformed comments');
    assert.equal(elements.momentReactionNote.textContent, '반응 정보를 불러올 수 없어요.', 'unavailable note for malformed comments');
  }
});

test('retry performs both reads again and renders success', async () => {
  let failReaction = true;
  let failComments = true;

  const { elements, detailUI } = createDetailUI(
    async () => {
      if (failReaction) { failReaction = false; throw new Error('first fail'); }
      return reactionDTO(7);
    },
    async () => {
      if (failComments) { failComments = false; throw new Error('first fail'); }
      return { comments: [{ id: 'c1', body: 'x' }, { id: 'c2', body: 'y' }], nextCursor: null };
    }
  );

  // First attempt — both fail
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionsCard.dataset.socialLoading, undefined, 'loading removed after failure');
  assert.equal(elements.momentReactionLikeValue.textContent, '\u2014', 'like shows unavailable after failure');
  assert.equal(elements.momentReactionCommentValue.textContent, '\u2014', 'comment shows unavailable after failure');

  const retryBtn = elements.momentReactionsCard.querySelector('[data-social-retry="1"]');
  assert.ok(retryBtn, 'retry button present');
  assert.ok(retryBtn.onclick, 'retry button has click handler');

  // Retry — second pair succeeds
  retryBtn.onclick();
  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionsCard.dataset.socialLoading, undefined, 'loading removed after retry success');
  assert.equal(elements.momentReactionLikeValue.textContent, '7', 'like count rendered after retry');
  assert.equal(elements.momentReactionCommentValue.textContent, '2개 표시', 'comment count rendered after retry');

  const retryAfterSuccess = elements.momentReactionsCard.querySelector('[data-social-retry="1"]');
  assert.ok(!retryAfterSuccess, 'retry button removed after success');
});

test('no raw error text rendered on failure', async () => {
  const { elements, detailUI } = createDetailUI(
    async () => { throw new Error('CONNECTION_REFUSED'); },
    async () => { throw new Error('INTERNAL_SERVER_ERROR'); }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

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

  const { elements, detailUI, deps } = createDetailUI(
    async (treeId, memoryId) => {
      if (memoryId === 'old') { oldCalled = true; return oldReactionP; }
      if (memoryId === 'new') { newCalled = true; return newReactionP; }
      return reactionDTO(0);
    },
    async (treeId, memoryId) => {
      if (memoryId === 'old') return oldCommentsP;
      if (memoryId === 'new') return newCommentsP;
      return commentsDTOEmpty;
    }
  );

  deps.currentSelectedId = 'old';
  deps.treeMemories = [{ id: 'old', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'old', treeId: 'tree-1' });
  assert.ok(oldCalled, 'old moment fetch started');

  deps.currentSelectedId = 'new';
  deps.treeMemories = [{ id: 'new', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'new', treeId: 'tree-1' });
  assert.ok(newCalled, 'new moment fetch started');

  // Old resolves first (should be ignored — generation mismatch)
  resolveOldReaction(reactionDTO(999));
  resolveOldComments(commentsDTOEmpty);
  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionsCard.dataset.socialLoading, 'true',
    'still loading because new moment not yet resolved');

  // New resolves with valid DTO
  resolveNewReaction(reactionDTO(5));
  resolveNewComments(commentsDTOEmpty);
  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionsCard.dataset.socialLoading, undefined,
    'loading removed after new resolves');
  assert.equal(elements.momentReactionLikeValue.textContent, '5',
    'new moment like count rendered (not stale 999)');
});

test('#1882 wording rule — only Refs, never Closes/Fixes', () => {
  assert.ok(!scriptSource.includes('Fixes #1882'), 'must not use Fixes #1882');
  assert.ok(!scriptSource.includes('Closes #1882'), 'must not use Closes #1882');
  assert.ok(!scriptSource.includes('Resolves #1882'), 'must not use Resolves #1882');
});

// ---------------------------------------------------------------------------
// #3218 — Comments panel regression tests
// ---------------------------------------------------------------------------

test('zero-comment payload opens panel with empty notice and closes correctly', async () => {
  const { elements, detailUI, deps } = createDetailUI(
    async () => reactionDTO(0),
    async () => commentsDTOEmpty
  );

  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  const toggle = elements.momentReactionCommentStatus;
  assert.equal(toggle.disabled, false, 'toggle enabled for zero comments');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false', 'initially collapsed');

  // Click to open
  toggle.onclick();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'expanded after click');
  assert.equal(elements.momentCommentsPanel.hidden, false, 'panel visible');
  assert.equal(elements.momentCommentsPanelStatus.textContent, '아직 댓글이 없어요.', 'empty notice');

  // Click to close
  toggle.onclick();
  assert.equal(toggle.getAttribute('aria-expanded'), 'false', 'collapsed after second click');
  assert.equal(elements.momentCommentsPanel.hidden, true, 'panel hidden after close');
});

test('metadata-null click cannot open comments panel', async () => {
  // When no successful summary has loaded, commentMemoryMeta is null
  const { elements, detailUI } = createDetailUI(
    async () => { throw new Error('fail'); },
    async () => { throw new Error('fail'); }
  );

  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  const toggle = elements.momentReactionCommentStatus;
  assert.equal(toggle.disabled, true, 'toggle disabled after failure');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false', 'expanded false');

  // The click handler from wireCommentToggle was never wired (fetch never succeeded),
  // so onclick is null or a no-op that returns early.
  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
    assert.equal(toggle.getAttribute('aria-expanded'), 'false', 'click must not flip expanded');
  }
});

test('unavailable result clears metadata and leaves toggle disabled', async () => {
  const { elements, detailUI, deps } = createDetailUI(
    async () => null,
    async () => ({ comments: null })
  );

  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  assert.equal(elements.momentReactionCommentStatus.disabled, true, 'toggle disabled after unavailable');
  assert.equal(elements.momentReactionCommentStatus.getAttribute('aria-expanded'), 'false', 'expanded false');
  assert.equal(elements.momentCommentsPanel.hidden, true, 'panel hidden');
  assert.equal(elements.momentCommentsList.textContent, '', 'list cleared');
});

test('malformed comment item body rejection', async () => {
  const malformedCases = [
    // Non-string body
    { comments: [{ id: 'c1', body: 'ok' }, { id: 'c2', body: 123 }], nextCursor: null },
    // Missing body property
    { comments: [{ id: 'c1', body: 'ok' }, { id: 'c2' }], nextCursor: null },
    // Array item (instead of object)
    { comments: [{ id: 'c1', body: 'ok' }, ['not-object']], nextCursor: null },
    // inherited body via prototype
    (function() {
      var proto = { body: 'inherited' };
      var item = Object.create(proto);
      item.id = 'c3';
      return { comments: [{ id: 'c1', body: 'ok' }, item], nextCursor: null };
    })(),
  ];

  for (const badData of malformedCases) {
    const { elements, detailUI, deps } = createDetailUI(
      async () => reactionDTO(1),
      async () => badData
    );

    deps.currentSelectedId = 'mem-1';
    deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
    elements.momentReactionsCard.dataset.socialLoading = 'true';
    elements.momentReactionsCard.style.display = '';

    detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
    await new Promise(r => setTimeout(r, 50));

    assert.equal(elements.momentReactionsCard.dataset.socialLoading, undefined, 'loading removed');
    assert.equal(elements.momentReactionCommentStatus.disabled, true, 'toggle disabled for malformed');
    assert.equal(elements.momentReactionCommentStatus.getAttribute('aria-expanded'), 'false', 'expanded false');
    assert.equal(elements.momentCommentsPanel.hidden, true, 'panel hidden');
  }
});

test('stale old moment response cannot reopen or replace newer moment comments panel', async () => {
  let resolveOldComments;
  const oldCommentsP = new Promise(r => { resolveOldComments = r; });
  let resolveNewComments;
  const newCommentsP = new Promise(r => { resolveNewComments = r; });

  const { elements, detailUI, deps } = createDetailUI(
    async () => reactionDTO(0),
    async (treeId, memoryId) => {
      if (memoryId === 'old') return oldCommentsP;
      if (memoryId === 'new') return newCommentsP;
      return commentsDTOEmpty;
    }
  );

  // Select old moment
  deps.currentSelectedId = 'old';
  deps.treeMemories = [{ id: 'old', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'old', treeId: 'tree-1' });

  // Switch to new before old resolves
  deps.currentSelectedId = 'new';
  deps.treeMemories = [{ id: 'new', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'new', treeId: 'tree-1' });

  // Resolve new moment first
  resolveNewComments({ comments: [{ id: 'n1', body: 'new comment' }], nextCursor: null });
  await new Promise(r => setTimeout(r, 50));

  // Open new moment's panel
  const toggle = elements.momentReactionCommentStatus;
  assert.equal(toggle.disabled, false, 'toggle enabled for new');
  toggle.onclick();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'new panel opened');
  assert.equal(elements.momentCommentsList.children.length, 1, 'one comment visible');
  assert.equal(elements.momentCommentsList.children[0].textContent, 'new comment', 'correct body');

  // Now resolve old (should be stale — generation mismatch)
  resolveOldComments({ comments: [{ id: 'o1', body: 'STALE_OVERWRITE' }], nextCursor: null });
  await new Promise(r => setTimeout(r, 50));

  // Old response must NOT change current panel
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'still expanded after stale resolve');
  assert.equal(elements.momentCommentsList.children.length, 1, 'still one comment');
  assert.equal(elements.momentCommentsList.children[0].textContent, 'new comment', 'body unchanged by stale');
});

test('read-only comment boundary uses no DocumentFragment or HTML insertion', () => {
  const readOnlyFn = scriptSource.match(/function createPublicViewerReadOnlyReactionSummaryBoundary[\s\S]*?(?=function createPublicViewerAuthenticatedLikeBoundary|function createPublicViewerTreeMetaBoundary)/);
  const readOnlySource = readOnlyFn ? readOnlyFn[0] : '';
  assert.ok(readOnlySource.length > 100, 'read-only boundary source found');

  assert.equal(readOnlySource.includes('createDocumentFragment'), false, 'no DocumentFragment');
  assert.equal(readOnlySource.includes('innerHTML'), false, 'no innerHTML');
  assert.equal(readOnlySource.includes('outerHTML'), false, 'no outerHTML');
  assert.equal(readOnlySource.includes('insertAdjacentHTML'), false, 'no insertAdjacentHTML');
});

test('forced unavailable reconciliation resets comments panel', async () => {
  // Track invocation counts and memory IDs to prove same-moment force reconciliation
  let reactionCallCount = 0;
  let commentsCallCount = 0;
  const reactionMemoryIds = [];
  const commentsMemoryIds = [];
  let shouldFail = false;

  const { elements, detailUI, deps } = createDetailUI(
    async (treeId, memoryId) => {
      reactionCallCount++;
      reactionMemoryIds.push(memoryId);
      if (shouldFail) throw new Error('reaction fail');
      return reactionDTO(1);
    },
    async (treeId, memoryId) => {
      commentsCallCount++;
      commentsMemoryIds.push(memoryId);
      if (shouldFail) throw new Error('comments fail');
      return { comments: [{ id: 'c1', body: 'visible comment' }], nextCursor: null };
    }
  );

  // Step 1: Load valid populated comments on mem-populated
  deps.currentSelectedId = 'mem-populated';
  deps.treeMemories = [{ id: 'mem-populated', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-populated', treeId: 'tree-1' });
  await new Promise(r => setTimeout(r, 50));

  assert.equal(reactionCallCount, 1, 'reaction read for initial load');
  assert.equal(commentsCallCount, 1, 'comments read for initial load');

  // Step 2: Open panel and confirm visible body
  const toggle = elements.momentReactionCommentStatus;
  assert.equal(toggle.disabled, false, 'toggle enabled after success');
  toggle.onclick();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'expanded after click');
  assert.equal(elements.momentCommentsList.children[0].textContent, 'visible comment', 'correct body');

  // Step 3: Make subsequent calls fail
  shouldFail = true;

  // Step 4: Invoke force reconciliation for the SAME moment immediately,
  // bypassing the 150ms debounce (force skips the outer debounce guard)
  detailUI.updateDetailPanel({ id: 'mem-populated', treeId: 'tree-1' }, true);
  await new Promise(r => setTimeout(r, 50));

  // Prove the force call produced a second read for mem-populated,
  // not for another memory id, without waiting for the normal 150ms debounce
  assert.equal(reactionCallCount, 2, 'force reconciliation triggered second reaction read — debounce bypassed');
  assert.equal(commentsCallCount, 2, 'force reconciliation triggered second comments read');

  assert.deepEqual(
    reactionMemoryIds,
    ['mem-populated', 'mem-populated'],
    'initial and forced reaction reads stay on the same moment'
  );

  assert.deepEqual(
    commentsMemoryIds,
    ['mem-populated', 'mem-populated'],
    'initial and forced comments reads stay on the same moment'
  );

  // Step 5: Assert panel is fully reset
  assert.equal(toggle.disabled, true, 'toggle disabled after force unavailable');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false', 'aria-expanded false');
  assert.equal(elements.momentCommentsPanel.hidden, true, 'panel hidden');
  assert.equal(elements.momentCommentsList.textContent, '', 'list empty');
  assert.equal(elements.momentCommentsPanelStatus.textContent, '', 'status empty');
  assert.ok(!elements.momentCommentsList.textContent.includes('visible comment'), 'previous body absent');

  // Step 6: Retained onclick must not reopen panel
  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
    assert.equal(toggle.getAttribute('aria-expanded'), 'false', 'onclick cannot reopen after force unavailable');
    assert.equal(elements.momentCommentsPanel.hidden, true, 'panel stays hidden after onclick');
  }
});
