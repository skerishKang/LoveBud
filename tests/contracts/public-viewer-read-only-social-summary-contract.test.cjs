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
    _textContent: '',
    onclick: null,
    _disabled: false,
    _focusCallCount: 0,
    isConnected: true,
    _isConnected: true,
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
    append(...nodes) { for (const n of nodes) { this.children.push(n); n.parentElement = this; } },
    replaceChildren(...nodes) { this.children.length = 0; for (const n of nodes) { this.children.push(n); n.parentElement = this; } },
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
    closest() { return this.parentElement || this; },
    contains(child) {
      if (!child) return false;
      if (child === this) return true;
      if (!this.children) return false;
      if (this.children.includes(child)) return true;
      for (const c of this.children) {
        if (c.contains && c.contains(child)) return true;
      }
      return false;
    },
    focus() { this._focusCallCount++; },
  };
  Object.defineProperty(element, 'textContent', {
    get() { return this._textContent; },
    set(val) {
      this._textContent = val;
      if (val === '') this.children.length = 0;
    },
    enumerable: true,
    configurable: true
  });
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
    _activeElement: elements.momentCommentsList,
    document: {
      createElement(tagName) { return createMockElement(tagName); },
      getElementById(id) { return elements[id] || null; },
      querySelector(sel) {
        if (sel === '#detailPanel h3') return createMockElement('h3');
        if (sel === '.detail-video img') return elements.detailImg;
        if (sel === '.diary-note') return elements.detailMemo;
        return null;
      },
      querySelectorAll() { return []; },
      get activeElement() {
        return context._activeElement || null;
      }
    }
  };
  context.window = context;

  vm.createContext(context);
  const metadataCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-metadata-text.js'), 'utf8');
  vm.runInContext(metadataCode, context);
  const socialSummaryCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-read-only-social-summary.js'), 'utf8');
  vm.runInContext(socialSummaryCode, context);
  const authLikeCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-authenticated-like.js'), 'utf8');
  vm.runInContext(authLikeCode, context);
  const authComposerCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-authenticated-comment-composer.js'), 'utf8');
  vm.runInContext(authComposerCode, context);
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
    fetchPublicMomentComments: fetchComments
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
  const readOnlySource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-read-only-social-summary.js'), 'utf8');
  const noPrivateReactionPath = !/toggleReaction|private.*reaction|reaction.*write/i.test(readOnlySource);
  const noPrivateCommentPath = !/createComment|composer|comment.*drawer/i.test(readOnlySource);
  assert.ok(noPrivateReactionPath, 'read-only boundary must not reference private reaction API');
  assert.ok(noPrivateCommentPath, 'read-only boundary must not reference private comment API');
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
  assert.equal(elements.momentReactionNote.textContent, '반응과 댓글을 불러오는 중이에요.', 'note shows loading copy');

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
  assert.equal(elements.momentReactionCommentValue.textContent, '3', 'bounded comment label');
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
  assert.equal(elements.momentReactionCommentValue.textContent, '2', 'comment count rendered after retry');

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
  // Panel auto-opened by the read-only summary on success
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'auto-expanded after load');
  assert.equal(elements.momentCommentsPanel.hidden, false, 'panel visible after auto-open');
  assert.equal(elements.momentCommentsPanelStatus.textContent, '아직 댓글이 없어요. 이 순간에 첫 댓글을 남겨보세요.', 'empty notice (clarified #3346)');

  // Click to close
  toggle.onclick();
  assert.equal(toggle.getAttribute('aria-expanded'), 'false', 'collapsed after click');
  assert.equal(elements.momentCommentsPanel.hidden, true, 'panel hidden after close');

  // Click to reopen
  toggle.onclick();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 're-expanded after second click');
  assert.equal(elements.momentCommentsPanel.hidden, false, 'panel visible after reopen');
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

  // Panel auto-opened by read-only summary after new moment resolves
  const toggle = elements.momentReactionCommentStatus;
  assert.equal(toggle.disabled, false, 'toggle enabled for new');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'panel auto-opened');
  assert.equal(elements.momentCommentsPanel.hidden, false, 'panel visible');
  assert.equal(elements.momentCommentsList.children.length, 1, 'one comment visible');
  assert.equal(elements.momentCommentsList.children.length, 1, 'one comment rendered');
  assert.equal(elements.momentCommentsList.children[0].children[1].textContent, 'new comment', 'correct body');

  // Now resolve old (should be stale — generation mismatch)
  resolveOldComments({ comments: [{ id: 'o1', body: 'STALE_OVERWRITE' }], nextCursor: null });
  await new Promise(r => setTimeout(r, 50));

  // Old response must NOT change current panel
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'still expanded after stale resolve');
  assert.equal(elements.momentCommentsList.children.length, 1, 'still one comment');
  assert.equal(elements.momentCommentsList.children[0].children[1].textContent, 'new comment', 'body unchanged by stale');
});

test('read-only comment boundary uses no DocumentFragment or HTML insertion', () => {
  const readOnlySource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-read-only-social-summary.js'), 'utf8');
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

  // Step 2: Panel auto-opened by read-only summary after success
  const toggle = elements.momentReactionCommentStatus;
  assert.equal(toggle.disabled, false, 'toggle enabled after success');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'auto-expanded after load');
  assert.equal(elements.momentCommentsPanel.hidden, false, 'panel visible after auto-open');
  assert.equal(elements.momentCommentsList.children[0].children[1].textContent, 'visible comment', 'correct body in comment item');

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

// ---------------------------------------------------------------------------
// Focus-return contract
// ---------------------------------------------------------------------------
async function flush() {
  await new Promise(r => setTimeout(r, 30));
  // Second yield to ensure async fetch chain fully completes
  await Promise.resolve();
}

test('close with focus inside panel restores focus to enabled toggle exactly once', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async () => ({ comments: [], nextCursor: null })
  );

  // Open panel
  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  // Simulate toggle open
  const toggle = elements.momentReactionCommentStatus;
  assert.ok(typeof toggle.onclick === 'function', 'toggle onclick must be wired');
  toggle.setAttribute('aria-expanded', 'true');
  elements.momentReactionsCard.style.display = '';

  // Simulate focus on panel descendant (tests recursive contains() via child)
  elements.momentCommentsPanel.appendChild(elements.momentCommentsList);
  context._activeElement = elements.momentCommentsList;

  // Close via toggle onclick
  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
  }

  // Strong assertion: focus must be called exactly once on normal close
  assert.equal(toggle._focusCallCount, 1, 'toggle focus() called exactly once on normal close');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false', 'aria-expanded false after close');
  assert.equal(elements.momentCommentsPanel.hidden, true, 'panel hidden after close');
});

test('open panel does not call focus on toggle', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async () => ({ comments: [], nextCursor: null })
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  assert.ok(typeof toggle.onclick === 'function', 'toggle onclick must be wired');
  // Panel is auto-opened by read-only summary; no click needed
  assert.equal(toggle._focusCallCount, 0, 'no focus call on auto-open');
});

test('disabled toggle does not receive focus on close', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async () => ({ comments: [], nextCursor: null })
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  toggle.setAttribute('aria-expanded', 'true');
  elements.momentReactionsCard.style.display = '';
  context._activeElement = elements.momentCommentsPanel;

  // Disable the toggle
  toggle.setAttribute('disabled', '');

  // Close — focus should not be called on disabled toggle
  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
  }

  assert.equal(toggle._focusCallCount, 0, 'no focus on disabled toggle');
});

test('disabled="disabled" attribute prevents focus on close', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async () => ({ comments: [], nextCursor: null })
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  toggle.setAttribute('aria-expanded', 'true');
  elements.momentReactionsCard.style.display = '';
  context._activeElement = elements.momentCommentsPanel;

  // Disable with non-empty value
  toggle.setAttribute('disabled', 'disabled');

  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
  }

  assert.equal(toggle._focusCallCount, 0, 'no focus on disabled="disabled" toggle');
});

test('hidden toggle does not receive focus on close', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async () => ({ comments: [], nextCursor: null })
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  toggle.setAttribute('aria-expanded', 'true');
  elements.momentReactionsCard.style.display = '';
  context._activeElement = elements.momentCommentsPanel;

  // Hide the toggle via display
  toggle.style.display = 'none';

  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
  }

  assert.equal(toggle._focusCallCount, 0, 'no focus on hidden toggle');
});

test('toggle hidden property prevents focus on close', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async () => ({ comments: [], nextCursor: null })
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  toggle.setAttribute('aria-expanded', 'true');
  elements.momentReactionsCard.style.display = '';
  context._activeElement = elements.momentCommentsPanel;

  toggle.hidden = true;

  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
  }

  assert.equal(toggle._focusCallCount, 0, 'no focus on toggle hidden=true');
});

test('hidden card does not receive focus attempt on close', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async () => ({ comments: [], nextCursor: null })
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  toggle.setAttribute('aria-expanded', 'true');
  context._activeElement = elements.momentCommentsPanel;

  // Hide the card
  elements.momentReactionsCard.style.display = 'none';

  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
  }

  assert.equal(toggle._focusCallCount, 0, 'no focus when card is hidden');
});

test('card hidden property prevents focus on close', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async () => ({ comments: [], nextCursor: null })
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  toggle.setAttribute('aria-expanded', 'true');
  elements.momentReactionsCard.style.display = '';
  context._activeElement = elements.momentCommentsPanel;

  elements.momentReactionsCard.hidden = true;

  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
  }

  assert.equal(toggle._focusCallCount, 0, 'no focus when card hidden=true');
});

test('detached toggle does not receive focus on close', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async () => ({ comments: [], nextCursor: null })
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  toggle.setAttribute('aria-expanded', 'true');
  elements.momentReactionsCard.style.display = '';
  context._activeElement = elements.momentCommentsPanel;

  // Mark toggle as detached
  toggle._isConnected = false;
  Object.defineProperty(toggle, 'isConnected', { get() { return this._isConnected; }, configurable: true });

  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
  }

  assert.equal(toggle._focusCallCount, 0, 'no focus on detached toggle');
});

test('generation mismatch prevents focus on close', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async () => ({ comments: [], nextCursor: null })
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  toggle.setAttribute('aria-expanded', 'true');
  elements.momentReactionsCard.style.display = '';
  context._activeElement = elements.momentCommentsPanel;

  // Save reference to old onclick (gen=1, memId='mem-1') before switching
  var oldOnClick = toggle.onclick;

  // Switch to mem-2 — advances generation, replaces toggle.onclick
  deps.currentSelectedId = 'mem-2';
  deps.treeMemories = [{ id: 'mem-2', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-2', treeId: 'tree-1' });
  await flush();

  // Call OLD onclick — its closure has gen=1 but current gen is now 2
  if (typeof oldOnClick === 'function') {
    oldOnClick();
  }

  assert.equal(toggle._focusCallCount, 0, 'no focus on generation mismatch');
});

test('metadata mismatch prevents focus on close', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async (treeId, memoryId) => {
      if (memoryId === 'mem-1') return { comments: [{ id: 'c-a', body: 'moment-a comment' }], nextCursor: null };
      if (memoryId === 'mem-2') return { comments: [{ id: 'c-b', body: 'moment-b comment' }], nextCursor: null };
      return { comments: [], nextCursor: null };
    }
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  // Capture A's closure (gen=1, memId='mem-1')
  const oldOnClick = toggle.onclick;

  // Switch to Moment B with force=true: same generation, but commentMemoryMeta
  // memoryId becomes 'mem-2' while the existing onclick closure is preserved.
  deps.currentSelectedId = 'mem-2';
  deps.treeMemories = [{ id: 'mem-2', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-2', treeId: 'tree-1' }, true);
  await flush();

  // Preconditions: B panel is auto-open with B content, stale A closure preserved
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'B panel auto-open after force load');
  assert.equal(elements.momentCommentsPanel.hidden, false, 'B panel visible');
  assert.equal(elements.momentCommentsList.children.length, 1, 'B has exactly one comment');
  assert.equal(elements.momentCommentsList.children[0].children[1].textContent, 'moment-b comment', 'B comment body rendered');
  assert.equal(toggle.onclick, oldOnClick, 'stale A closure preserved (not rewired by force path)');

  // Focus inside current B panel
  const focusNode = createMockElement();
  elements.momentCommentsPanel.appendChild(focusNode);
  context._activeElement = focusNode;

  // Run stale A closure — generation matches (force path) but metadata memoryId differs
  oldOnClick();

  // Metadata/memoryId guard must block close + focus restoration
  assert.equal(toggle._focusCallCount, 0, 'no focus on metadata mismatch');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'B stays expanded after stale A click');
  assert.equal(elements.momentCommentsPanel.hidden, false, 'B panel stays visible after stale A click');
  assert.equal(elements.momentCommentsList.children.length, 1, 'B comment count unchanged after stale A click');
  assert.equal(elements.momentCommentsList.children[0].children[1].textContent, 'moment-b comment', 'B comment body unchanged after stale A click');
});

test('Moment A→B reset: old toggle focus not called even with old panel focus', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async (treeId, memoryId) => {
      if (memoryId === 'mem-1') return { comments: [{ id: 'c-a', body: 'moment-a comment' }], nextCursor: null };
      if (memoryId === 'mem-2') return { comments: [{ id: 'c-b', body: 'moment-b comment' }], nextCursor: null };
      return { comments: [], nextCursor: null };
    }
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  // Capture A's closure (gen=1, memId='mem-1')
  const oldOnClick = toggle.onclick;

  // Separate focus descendant inside A panel
  const oldPanelFocusNode = createMockElement();
  elements.momentCommentsPanel.appendChild(oldPanelFocusNode);
  context._activeElement = oldPanelFocusNode;

  // Normal switch to Moment B — advances generation and rewires toggle.onclick
  deps.currentSelectedId = 'mem-2';
  deps.treeMemories = [{ id: 'mem-2', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-2', treeId: 'tree-1' });
  await flush();

  // Preconditions: toggle rewired to B closure, B panel auto-open with B content
  assert.notEqual(toggle.onclick, oldOnClick, 'toggle onclick replaced with B closure');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'B panel auto-open');
  assert.equal(elements.momentCommentsPanel.hidden, false, 'B panel visible');
  assert.equal(elements.momentCommentsList.children.length, 1, 'B has exactly one comment');
  assert.equal(elements.momentCommentsList.children[0].children[1].textContent, 'moment-b comment', 'B comment body rendered');

  // Run stale A closure — generation mismatch path must block focus + mutation
  oldOnClick();

  assert.equal(toggle._focusCallCount, 0, 'no focus on stale A closure');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'B stays expanded after stale A click');
  assert.equal(elements.momentCommentsPanel.hidden, false, 'B panel stays visible after stale A click');
  assert.equal(elements.momentCommentsList.children.length, 1, 'B comment count unchanged after stale A click');
  assert.equal(elements.momentCommentsList.children[0].children[1].textContent, 'moment-b comment', 'B comment body unchanged after stale A click');
});

test('root moment reset: no focus call', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async () => ({ comments: [], nextCursor: null })
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }, { id: 'root', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  toggle.setAttribute('aria-expanded', 'true');
  elements.momentReactionsCard.style.display = '';
  context._activeElement = elements.momentCommentsPanel;

  // Switch to root — hides card / resets panel
  deps.currentSelectedId = 'root';
  deps.treeMemories = [{ id: 'root', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'root', treeId: 'tree-1' });
  await flush();

  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
  }

  assert.equal(toggle._focusCallCount, 0, 'no focus on root moment reset');
});

test('unavailable state reset: no focus call', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => { throw new Error('unavailable'); },
    async () => { throw new Error('unavailable'); }
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  assert.equal(toggle.getAttribute('aria-expanded'), 'false', 'toggle collapsed when unavailable');
  context._activeElement = elements.momentCommentsPanel;

  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
  }

  assert.equal(toggle._focusCallCount, 0, 'no focus when toggle is disabled after unavailable');
});

test('loading state reset: no focus call', async () => {
  let resolveReaction, resolveComments;
  const reactionPromise = new Promise(r => { resolveReaction = r; });
  const commentsPromise = new Promise(r => { resolveComments = r; });

  const { elements, detailUI, deps, context } = createDetailUI(
    async () => reactionPromise,
    async () => commentsPromise
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  context._activeElement = elements.momentCommentsPanel;

  // While loading, toggle should be disabled
  assert.equal(toggle.disabled, true, 'toggle disabled during loading');

  if (typeof toggle.onclick === 'function') {
    toggle.onclick();
  }

  assert.equal(toggle._focusCallCount, 0, 'no focus during loading state');
});

test('preserveCommentsPanel reconciliation does not move focus', async () => {
  const { elements, detailUI, deps, context } = createDetailUI(
    async () => ({ counts: { like: 0 }, total: 0 }),
    async () => ({ comments: [], nextCursor: null })
  );

  elements.momentReactionCommentStatus.removeAttribute('disabled');
  elements.momentCommentsPanel.hidden = false;
  deps.currentSelectedId = 'mem-1';
  deps.treeMemories = [{ id: 'mem-1', treeId: 'tree-1' }];
  detailUI.updateDetailPanel({ id: 'mem-1', treeId: 'tree-1' });
  await flush();

  const toggle = elements.momentReactionCommentStatus;
  // Simulate panel open state — resetCommentsPanel hid it during loading
  elements.momentCommentsPanel.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
  elements.momentReactionsCard.style.display = '';
  context._activeElement = elements.momentCommentsPanel;

  // Force reconciliation with preserveCommentsPanel — must not close panel
  detailUI.updateDetailPanel(
    { id: 'mem-1', treeId: 'tree-1' },
    { force: true, preserveCommentsPanel: true }
  );
  await flush();

  assert.equal(toggle._focusCallCount, 0, 'no focus call during preserve reconciliation');
  assert.equal(elements.momentCommentsPanel.hidden, false, 'panel stays open after preserve reconciliation');
});
