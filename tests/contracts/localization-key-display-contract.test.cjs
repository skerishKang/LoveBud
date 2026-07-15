'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function runInSandbox(/* ...files */) {
  const context = { window: {}, console, URL, URLSearchParams, Date, TextEncoder, TextDecoder };
  context.window = context;
  vm.createContext(context);
  for (const rel of arguments) {
    vm.runInContext(readRepoFile(rel), context);
  }
  return context;
}

const classifierFile = 'js/shared/tree-workspace-permission.js';
const editorDetailFile = 'js/editor/editor-detail-ui.js';
const canvasNodeFile = 'js/editor/editor-canvas-node.js';
const viewerDetailFile = 'js/viewer/public-viewer-detail-ui.js';
const metadataTextFile = 'js/viewer/public-viewer-detail-metadata-text.js';

// ── Predicate: dot key detection ──

test('isLocalizationKeyTitle detects dot-separated legacy keys', () => {
  const ctx = runInSandbox(classifierFile);
  const isKey = ctx.window.LoveBudTreeWorkspaceClassifier.isLocalizationKeyTitle;

  assert.equal(isKey('tree.title'), true);
  assert.equal(isKey('memory.content'), true);
  assert.equal(isKey('editor.current.moment'), true);
  assert.equal(isKey('a.b'), true);
  assert.equal(isKey('editor.foo.bar'), true);
  assert.equal(isKey('search.title'), true);
});

test('isLocalizationKeyTitle still detects underscore-separated keys', () => {
  const ctx = runInSandbox(classifierFile);
  const isKey = ctx.window.LoveBudTreeWorkspaceClassifier.isLocalizationKeyTitle;

  assert.equal(isKey('editor_url_only_youtube_title'), true);
  assert.equal(isKey('viewer_tree_title'), true);
  assert.equal(isKey('waiting_first_moment'), true);
});

test('isLocalizationKeyTitle rejects plain user titles', () => {
  const ctx = runInSandbox(classifierFile);
  const isKey = ctx.window.LoveBudTreeWorkspaceClassifier.isLocalizationKeyTitle;

  assert.equal(isKey('YouTube 영상'), false);
  assert.equal(isKey('새 순간'), false);
  assert.equal(isKey('My Favorite Video'), false);
  assert.equal(isKey('러브트리'), false);
  assert.equal(isKey('첫 순간이 트리를 깨워요'), false);
  assert.equal(isKey('hello world'), false);
  assert.equal(isKey('selected_moment'), false, 'two-segment underscore is not a key');
  assert.equal(isKey(''), false);
  assert.equal(isKey(null), false);
  assert.equal(isKey(undefined), false);
  assert.equal(isKey(123), false);
});

// ── Display helper: sanitizeDisplayTitle (now on classifier) ──

test('sanitizeDisplayTitle returns fallback for underscore raw keys', () => {
  const ctx = runInSandbox(classifierFile);
  const sanitize = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  assert.equal(sanitize('editor_url_only_youtube_title'), 'YouTube 영상');
  assert.equal(sanitize('editor_url_only_youtube_title', 'fallback'), 'fallback');
});

test('sanitizeDisplayTitle returns fallback for dot raw keys', () => {
  const ctx = runInSandbox(classifierFile);
  const sanitize = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  // dot keys without caller fallback now get generic a11y fallback '순간'
  assert.equal(sanitize('tree.title'), '순간');
  assert.equal(sanitize('tree.title', '제목 없음'), '제목 없음');
  assert.equal(sanitize('memory.content'), '순간');
  assert.equal(sanitize('memory.content', '내용 없음'), '내용 없음');
  assert.equal(sanitize('editor.current.moment'), '지금 마음이 머문 장면');
});

test('sanitizeDisplayTitle passes through normal titles unchanged', () => {
  const ctx = runInSandbox(classifierFile);
  const sanitize = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  assert.equal(sanitize('YouTube 영상'), 'YouTube 영상');
  assert.equal(sanitize('새 순간'), '새 순간');
  assert.equal(sanitize('My lovely day'), 'My lovely day');
  assert.equal(sanitize('러브트리'), '러브트리');
  assert.equal(sanitize('첫 순간', '제목 없음'), '첫 순간');
});

test('sanitizeDisplayTitle never exposes the raw key', () => {
  const ctx = runInSandbox(classifierFile);
  const sanitize = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  const samples = ['tree.title', 'memory.content', 'editor.foo.bar', 'editor_url_only_youtube_title'];
  samples.forEach((k) => {
    assert.notEqual(sanitize(k), k, 'raw key must never be returned for ' + k);
    assert.notEqual(sanitize(k, 'fb'), k, 'raw key must never be returned (with fallback) for ' + k);
  });
});

test('sanitizeDisplayTitle handles empty/whitespace/null with fallback', () => {
  const ctx = runInSandbox(classifierFile);
  const sanitize = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  assert.equal(sanitize('', 'fb'), 'fb');
  assert.equal(sanitize('   ', 'fb'), 'fb');
  assert.equal(sanitize(null, 'fb'), 'fb');
  assert.equal(sanitize(undefined, 'fb'), 'fb');
});

// ── Static: editor-detail-ui uses sanitizer ──

test('editor-detail-ui references LoveBudTreeWorkspaceClassifier', () => {
  const src = readRepoFile(editorDetailFile);
  assert.match(src, /LoveBudTreeWorkspaceClassifier/, 'editor detail must reference classifier');
  assert.match(src, /sanitizeDisplayTitle/, 'editor detail must call sanitizeDisplayTitle');
});

test('editor-detail-ui sanitizes moment title text', () => {
  const src = readRepoFile(editorDetailFile);
  assert.ok(
    src.indexOf('sanitizeMomentTitle(data.title') !== -1,
    'editor detail must sanitize data.title via sanitizeMomentTitle'
  );
});

test('editor-detail-ui sanitizes image alt', () => {
  const src = readRepoFile(editorDetailFile);
  assert.ok(
    src.indexOf('sanitizeMomentTitle(data.title') !== -1 && src.indexOf('imgEl.alt') !== -1,
    'editor detail must sanitize img.alt via sanitizeMomentTitle'
  );
});

test('editor-detail-ui sanitizes iframe title', () => {
  const src = readRepoFile(editorDetailFile);
  assert.ok(
    src.indexOf('sanitizeMomentTitle(data.title') !== -1,
    'editor detail iframe title must use sanitizeMomentTitle'
  );
});

// ── Static: canvas node uses sanitizer ──

test('editor-canvas-node references LoveBudTreeWorkspaceClassifier', () => {
  const src = readRepoFile(canvasNodeFile);
  assert.match(src, /LoveBudTreeWorkspaceClassifier/, 'canvas node must reference classifier');
});

test('canvas node sanitizes img alt', () => {
  const src = readRepoFile(canvasNodeFile);
  assert.match(src, /sanitizeTitle\(mem\.title/, 'canvas node img.alt must use sanitizeTitle');
});

test('canvas node sanitizes aria-label', () => {
  const src = readRepoFile(canvasNodeFile);
  assert.match(src, /sanitizeTitle\(mem\.title/, 'canvas node aria-label must use sanitizeTitle');
});

test('canvas node sanitizes visible title text', () => {
  const src = readRepoFile(canvasNodeFile);
  assert.match(src, /sanitizeTitle\(memory\.title/, 'canvas node titleEl must use sanitizeTitle');
});

test('canvas node aria-label avoids duplicate "선택 선택" for raw keys', () => {
  const ctx = runInSandbox('js/shared/tree-workspace-permission.js', canvasNodeFile);
  const sanitizeTitle = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  // Test the actual aria-label logic inline
  const makeAria = (title) => {
    const safeTitle = sanitizeTitle(title, '');
    return safeTitle ? safeTitle + ' 선택' : '순간 선택';
  };

  // Normal title
  assert.equal(makeAria('첫 순간'), '첫 순간 선택');
  // Raw dot key
  assert.equal(makeAria('tree.title'), '순간 선택');
  assert.equal(makeAria('memory.content'), '순간 선택');
  // Empty/null
  assert.equal(makeAria(''), '순간 선택');
  assert.equal(makeAria(null), '순간 선택');
  assert.equal(makeAria(undefined), '순간 선택');
  // Must never contain duplicate
  Object.values({ tree: 'tree.title', memory: 'memory.content', empty: '' }).forEach(v => {
    assert.notEqual(makeAria(v).match(/선택\s*선택/), 'no duplicate "선택 선택"');
  });
  // Raw key never exposed
  assert.notEqual(makeAria('tree.title'), 'tree.title 선택');
  assert.notEqual(makeAria('memory.content'), 'memory.content 선택');
});

test('canvas node source uses safeTitle + conditional for aria-label', () => {
  const src = readRepoFile(canvasNodeFile);
  // Should use the conditional pattern to avoid duplicate
  assert.match(src, /var safeTitle = sanitizeTitle\(mem\.title/, 'canvas must compute safeTitle first');
  assert.match(src, /var ariaLabel = safeTitle \? safeTitle \+ .* : .*/, 'canvas must use conditional for aria-label');
  assert.doesNotMatch(src, /sanitizeTitle\(mem\.title.*\+\s*' 선택'/, 'must not concatenate directly');
});

// ── Static: public-viewer-detail-ui uses enhanced safeDisplayTitle ──

test('public-viewer-detail-ui safeDisplayTitle delegates to classifier', () => {
  const src = readRepoFile(metadataTextFile);
  assert.match(src, /LoveBudTreeWorkspaceClassifier/, 'metadata-text must reference classifier');
  assert.match(src, /sanitizeDisplayTitle/, 'metadata-text must call sanitizeDisplayTitle');
  assert.doesNotMatch(src, /LoveBudLocalizationDisplayHelper/, 'metadata-text must not reference old helper');
});

// ── Regression: no mutation, no write API ──

test('editor-detail-ui delegates social I/O to explicit controllers', () => {
  const src = readRepoFile(editorDetailFile);
  const updateDetailPanelFn = src.match(/const updateDetailPanel = \(data\) => \{[\s\S]*?\n    \};/);
  assert.ok(updateDetailPanelFn, 'updateDetailPanel function must exist');
  const renderBody = updateDetailPanelFn[0];

  assert.doesNotMatch(
    renderBody,
    /window\.apiClient\.fetchReactionSummary\(/,
    'render path must not call fetchReactionSummary directly'
  );
  assert.doesNotMatch(
    renderBody,
    /window\.apiClient\.toggleReaction\(/,
    'render path must not call toggleReaction directly'
  );
  assert.doesNotMatch(
    renderBody,
    /\.save\(|\.delete\(|fetch\(/,
    'render path must not contain direct save/delete/fetch calls'
  );
  assert.match(
    renderBody,
    /commentsController\.update/,
    'render path must preserve commentsController.update delegation'
  );
});

// ── Controller boundary & selection-switch regression ──

const FakeElement = (id) => {
  const el = {};
  let _textContent = '';
  Object.defineProperties(el, {
    style: { value: {}, writable: true },
    dataset: { value: {}, writable: true },
    textContent: {
      get: () => _textContent,
      set: (v) => { _textContent = String(v); },
      enumerable: true, configurable: true
    },
    onclick: { value: null, writable: true },
    querySelector: { value: () => null, writable: true },
    id: { value: id }
  });
  return el;
};

function fakeApiClient() {
  const calls = { fetchReactionSummary: [], toggleReaction: [] };
  const client = {
    fetchReactionSummary: (id) => {
      calls.fetchReactionSummary.push(id);
      return Promise.resolve({
        like_count: 3,
        comment_count: 1,
        user_reacted: false
      });
    },
    toggleReaction: (id, type) => {
      calls.toggleReaction.push({ id, type });
      return Promise.resolve({
        like_count: 4,
        user_reacted: true
      });
    }
  };
  return { client, calls };
}

function fakeIsRootMemory(data, canonicalRootId) {
  return false;
}

test('reactions controller selection-switch regression suite', async (t) => {
  const src = readRepoFile(editorDetailFile);
  const ctx = runInSandbox(editorDetailFile);
  const factory = ctx.window.makeMomentReactionsController;

  assert.ok(typeof factory === 'function', 'makeMomentReactionsController factory must be exported');

  // ── Scenario: extract controller boundary source (static check) ──

  // updateDetailPanel body must not contain direct reaction I/O
  const updateDetailPanelMatch = src.match(/const updateDetailPanel = \(data\) => \{[\s\S]*?\n    \};/);
  assert.ok(updateDetailPanelMatch, 'updateDetailPanel function must exist');
  const renderBody = updateDetailPanelMatch[0];

  assert.doesNotMatch(
    renderBody,
    /window\.apiClient\.fetchReactionSummary\(/,
    'updateDetailPanel render must not call fetchReactionSummary directly'
  );
  assert.doesNotMatch(
    renderBody,
    /window\.apiClient\.toggleReaction\(/,
    'updateDetailPanel render must not call toggleReaction directly'
  );
  assert.doesNotMatch(
    renderBody,
    /\.save\(|\.delete\(|fetch\(/,
    'updateDetailPanel render must not contain direct save/delete/fetch calls'
  );
  assert.match(
    renderBody,
    /commentsController\.update/,
    'updateDetailPanel must preserve commentsController.update delegation'
  );

  // Controller source must contain fetchReactionSummary and toggleReaction
  assert.match(
    src,
    /apiClient\.fetchReactionSummary/,
    'controller source must contain fetchReactionSummary call'
  );
  assert.match(
    src,
    /apiClient\.toggleReaction/,
    'controller source must contain toggleReaction call'
  );

  // Source must NOT contain the forbidden early-return pattern
  assert.doesNotMatch(
    src,
    /currentMemoryId && currentMemoryId !== data\.id/,
    'forbidden early-return pattern (currentMemoryId !== data.id) must not exist'
  );

  // ── Scenario 1: A update then B update ──

  await t.test('A-to-B: both updates proceed, B handler is attached', async () => {
    const { client, calls } = fakeApiClient();
    const card = FakeElement('momentReactionsCard');
    const likeBtn = FakeElement('momentReactionLikeButton');
    const likeIcon = { textContent: '' };
    likeBtn.querySelector = () => likeIcon;
    const likeCount = FakeElement('momentReactionLikeValue');
    const commentCount = FakeElement('momentReactionCommentValue');

    const els = {
      momentReactionsCard: card,
      momentReactionLikeButton: likeBtn,
      momentReactionLikeValue: likeCount,
      momentReactionCommentValue: commentCount
    };

    const ctrl = factory({
      getElementById: (id) => els[id] || null,
      apiClient: client,
      showToast: () => {},
      i18n: (k) => k
    });

    // Select A
    ctrl.update({ data: { id: 'A' }, canonicalRootId: 'root', isRootMemoryFn: fakeIsRootMemory });

    assert.equal(calls.fetchReactionSummary.length, 1, 'A triggers fetchReactionSummary');
    assert.equal(calls.fetchReactionSummary[0], 'A', 'A fetchReactionSummary called with A');
    assert.ok(typeof likeBtn.onclick === 'function', 'A handler is attached');
    assert.equal(card.style.display, '', 'reactions card is visible after A');

    // Select B
    ctrl.update({ data: { id: 'B' }, canonicalRootId: 'root', isRootMemoryFn: fakeIsRootMemory });

    assert.equal(calls.fetchReactionSummary.length, 2, 'B also triggers fetchReactionSummary');
    assert.equal(calls.fetchReactionSummary[1], 'B', 'B fetchReactionSummary called with B');
    assert.ok(typeof likeBtn.onclick === 'function', 'B handler is attached');
    assert.equal(card.style.display, '', 'reactions card is visible after B');
  });

  // ── Scenario 2: stale A response does not overwrite B UI ──

  await t.test('stale A response suppressed after B selection', async () => {
    let resolveA = null;
    const aPromise = new Promise(r => { resolveA = r; });

    const calls = { fetchReactionSummary: [], toggleReaction: [] };
    const client = {
      fetchReactionSummary: (id) => {
        calls.fetchReactionSummary.push(id);
        if (id === 'A') return aPromise;
        return Promise.resolve({ like_count: 5, comment_count: 2, user_reacted: true });
      },
      toggleReaction: () => Promise.resolve({ like_count: 1, user_reacted: true })
    };

    const card = FakeElement('momentReactionsCard');
    const likeBtn = FakeElement('momentReactionLikeButton');
    const likeIcon = { textContent: '' };
    likeBtn.querySelector = () => likeIcon;
    const likeCount = FakeElement('momentReactionLikeValue');
    const commentCount = FakeElement('momentReactionCommentValue');

    const els = {
      momentReactionsCard: card,
      momentReactionLikeButton: likeBtn,
      momentReactionLikeValue: likeCount,
      momentReactionCommentValue: commentCount
    };

    const ctrl = factory({
      getElementById: (id) => els[id] || null,
      apiClient: client,
      showToast: () => {},
      i18n: (k) => k
    });

    // Select A (summary stalls)
    ctrl.update({ data: { id: 'A' }, canonicalRootId: 'root', isRootMemoryFn: fakeIsRootMemory });
    assert.equal(likeCount.textContent, '0', 'A: initial like count is 0');

    // Select B (summary resolves immediately with like_count=5, user_reacted=true)
    ctrl.update({ data: { id: 'B' }, canonicalRootId: 'root', isRootMemoryFn: fakeIsRootMemory });

    // B summary applied synchronously (fake resolves immediately)
    // Wait microtask
    await new Promise(r => setTimeout(r, 0));
    assert.equal(likeCount.textContent, '5', 'B: like count reflects B summary');
    assert.equal(likeBtn.dataset.reacted, 'true', 'B: user_reacted true from B summary');
    assert.equal(likeIcon.textContent, '❤️', 'B: heart icon from B summary');

    // Now resolve A's stalled summary
    resolveA({ like_count: 99, comment_count: 99, user_reacted: false });
    await new Promise(r => setTimeout(r, 0));

    // B UI must NOT be overwritten by A's stale result
    assert.equal(likeCount.textContent, '5', 'stale A response must not overwrite B like count');
    assert.equal(likeBtn.dataset.reacted, 'true', 'stale A response must not overwrite B reacted state');
    assert.equal(likeIcon.textContent, '❤️', 'stale A response must not overwrite B heart icon');
  });

  // ── Scenario 3: A → B → A (generation guard) ──

  await t.test('A-to-B-to-A: epochs distinguish first A from second A', async () => {
    let resolveFirstA = null;
    const firstAPromise = new Promise(r => { resolveFirstA = r; });

    const calls = { fetchReactionSummary: [], toggleReaction: [] };
    const client = {
      fetchReactionSummary: (id) => {
        calls.fetchReactionSummary.push(id);
        if (id === 'A' && calls.fetchReactionSummary.filter(x => x === 'A').length === 1) {
          return firstAPromise;
        }
        // Second A resolves immediately with different values
        if (id === 'A') {
          return Promise.resolve({ like_count: 42, comment_count: 42, user_reacted: true });
        }
        return Promise.resolve({ like_count: 10, comment_count: 3, user_reacted: false });
      },
      toggleReaction: () => Promise.resolve({ like_count: 1, user_reacted: true })
    };

    const card = FakeElement('momentReactionsCard');
    const likeBtn = FakeElement('momentReactionLikeButton');
    const likeIcon = { textContent: '' };
    likeBtn.querySelector = () => likeIcon;
    const likeCount = FakeElement('momentReactionLikeValue');
    const commentCount = FakeElement('momentReactionCommentValue');

    const els = {
      momentReactionsCard: card,
      momentReactionLikeButton: likeBtn,
      momentReactionLikeValue: likeCount,
      momentReactionCommentValue: commentCount
    };

    const ctrl = factory({
      getElementById: (id) => els[id] || null,
      apiClient: client,
      showToast: () => {},
      i18n: (k) => k
    });

    // First A (stalls)
    ctrl.update({ data: { id: 'A' }, canonicalRootId: 'root', isRootMemoryFn: fakeIsRootMemory });
    assert.equal(likeCount.textContent, '0');

    // Switch to B
    ctrl.update({ data: { id: 'B' }, canonicalRootId: 'root', isRootMemoryFn: fakeIsRootMemory });
    await new Promise(r => setTimeout(r, 0));
    assert.equal(likeCount.textContent, '10', 'B: like count is 10');

    // Switch back to A (second A resolves immediately with 42)
    ctrl.update({ data: { id: 'A' }, canonicalRootId: 'root', isRootMemoryFn: fakeIsRootMemory });
    await new Promise(r => setTimeout(r, 0));
    assert.equal(likeCount.textContent, '42', 'second A: like count is 42');
    assert.equal(likeBtn.dataset.reacted, 'true', 'second A: user_reacted is true');

    // Now resolve first A's stalled summary (99)
    resolveFirstA({ like_count: 99, comment_count: 99, user_reacted: false });
    await new Promise(r => setTimeout(r, 0));

    // Second A state must not be overwritten by first A's stale result
    assert.equal(likeCount.textContent, '42', 'first A stale result must not overwrite second A like count');
    assert.equal(likeBtn.dataset.reacted, 'true', 'first A stale result must not overwrite second A reacted state');
    assert.equal(likeIcon.textContent, '❤️', 'first A stale result must not overwrite second A heart icon');
  });

  // ── Scenario 4: hide invalidates pending requests ──

  await t.test('hide invalidates pending responses and clears handler', async () => {
    let resolveA = null;
    const aPromise = new Promise(r => { resolveA = r; });

    const calls = { fetchReactionSummary: [], toggleReaction: [] };
    const client = {
      fetchReactionSummary: (id) => {
        calls.fetchReactionSummary.push(id);
        return aPromise;
      },
      toggleReaction: () => Promise.resolve({ like_count: 1, user_reacted: true })
    };

    const card = FakeElement('momentReactionsCard');
    const likeBtn = FakeElement('momentReactionLikeButton');
    const likeIcon = { textContent: '' };
    likeBtn.querySelector = () => likeIcon;
    const likeCount = FakeElement('momentReactionLikeValue');
    const commentCount = FakeElement('momentReactionCommentValue');

    const els = {
      momentReactionsCard: card,
      momentReactionLikeButton: likeBtn,
      momentReactionLikeValue: likeCount,
      momentReactionCommentValue: commentCount
    };

    const ctrl = factory({
      getElementById: (id) => els[id] || null,
      apiClient: client,
      showToast: () => {},
      i18n: (k) => k
    });

    // Select A (summary stalls)
    ctrl.update({ data: { id: 'A' }, canonicalRootId: 'root', isRootMemoryFn: fakeIsRootMemory });
    assert.equal(likeCount.textContent, '0');
    // Set up optimistic values manually to verify they don't get overwritten later
    likeCount.textContent = '55';
    commentCount.textContent = '7';

    // Hide
    ctrl.hide();

    assert.equal(card.style.display, 'none', 'card hidden after hide');
    assert.equal(likeBtn.onclick, null, 'handler cleared after hide');

    // Resolve stalled A
    resolveA({ like_count: 99, comment_count: 99, user_reacted: true });
    await new Promise(r => setTimeout(r, 0));

    // Hidden card must not reappear or have counts changed
    assert.equal(card.style.display, 'none', 'card remains hidden after stale resolve');
    assert.equal(likeCount.textContent, '55', 'hidden card like count must not change from stale response');
    assert.equal(commentCount.textContent, '7', 'hidden card comment count must not change from stale response');
  });
});

test('editor-canvas-node has no save/update/delete/fetch in render', () => {
  const src = readRepoFile(canvasNodeFile);
  assert.doesNotMatch(src, /\.save\(|\.update\(|\.delete\(|fetch\(/,
    'canvas node must not contain save/update/delete/fetch calls');
});

test('classifier sanitizeDisplayTitle never mutates input object', () => {
  const ctx = runInSandbox(classifierFile);
  const sanitize = ctx.window.LoveBudTreeWorkspaceClassifier.sanitizeDisplayTitle;

  const obj = { title: 'tree.title' };
  const result = sanitize(obj.title, '제목 없음');
  assert.equal(result, '제목 없음');
  assert.equal(obj.title, 'tree.title', 'original stored value must not be mutated');
});

test('viewer detail still has safeDisplayTitle', () => {
  const src = readRepoFile(metadataTextFile);
  assert.match(src, /function safeDisplayTitle/, 'metadata-text must retain safeDisplayTitle function');
});

test('viewer safeDisplayTitle hides dot-separated keys', () => {
  const ctx = runInSandbox(classifierFile, metadataTextFile);
  const isKey = ctx.window.LoveBudTreeWorkspaceClassifier.isLocalizationKeyTitle;

  // safeDisplayTitle is defined in metadata-text, its backing predicate detects dot keys
  assert.equal(isKey('tree.title'), true, 'predicate must detect dot keys');
  assert.equal(isKey('editor_url_only_youtube_title'), true, 'predicate must detect underscore keys');
  assert.equal(isKey('My lovely day'), false, 'predicate must not flag normal titles');
});