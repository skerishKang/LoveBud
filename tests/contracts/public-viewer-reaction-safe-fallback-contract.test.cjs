const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const scriptSource = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-ui.js'), 'utf8');

// Helper to create mock DOM elements
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
    classList: classList,
    parentElement: null,
    children: [],
    attributes: {},
    setAttribute(name, val) { this.attributes[name] = val; },
    removeAttribute(name) { delete this.attributes[name]; },
    getAttribute(name) { return this.attributes[name]; },
    appendChild(child) {
      this.children.push(child);
      child.parentElement = this;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) {
        this.children.splice(idx, 1);
        child.parentElement = null;
      }
    },
    get firstChild() { return this.children[0] || null; },
    querySelector() { return null; },
    closest() { return this.parentElement || this; }
  };
  return element;
}

test('public-viewer-detail-ui static analysis constraints', () => {
  // 1. Verify cache/dedupe variables are present
  assert.match(scriptSource, /reactionSummaryCache\s*=\s*/);
  assert.match(scriptSource, /reactionSummaryInFlight\s*=\s*/);
  assert.match(scriptSource, /reactionSummaryAuthFailures\s*=\s*/);

  // 2. Verify isAuthFailure helper is present
  assert.match(scriptSource, /function\s+isAuthFailure/);

  // 3. Verify no console error logging on reactions failure
  assert.doesNotMatch(scriptSource, /console\.error.*fetchReactionSummary/);

  // 4. Verify updateCurrentMomentImage is called before updateReadOnlyReactionSummary
  const imgCallIdx = scriptSource.indexOf('updateCurrentMomentImage');
  const reactionsCallIdx = scriptSource.indexOf('updateReadOnlyReactionSummary');
  assert.ok(imgCallIdx !== -1, 'updateCurrentMomentImage should be defined');
  assert.ok(reactionsCallIdx !== -1, 'updateReadOnlyReactionSummary should be defined');
  assert.ok(imgCallIdx < reactionsCallIdx, 'image rendering must be scheduled before reactions update');
});

test('public-viewer-detail-ui runtime cache, fallback, and throttle contract', async () => {
  let fetchCalls = 0;
  let apiResolve = null;
  let apiReject = null;
  let currentFakeTime = 10000;
  let currentSelectedId = 'mem-1';

  const elements = {
    detailTreeMetaMount: createMockElement(),
    detailCurrentMomentBadge: createMockElement(),
    detailCurrentMomentTitle: createMockElement(),
    detailCurrentMomentHint: createMockElement(),
    detailImg: createMockElement('img'),
    detailDateText: createMockElement(),
    detailMemo: createMockElement(),
    detailTags: createMockElement(),
    momentReactionsCard: createMockElement(),
    momentLikeBtn: createMockElement('div'),
    momentLikeCount: createMockElement('span'),
    momentCommentCount: createMockElement('span'),
    momentCommentBtn: createMockElement('div')
  };

  // Setup parent hierarchy for image container empty state testing
  const imgParent = createMockElement('div');
  imgParent.classList.add('detail-video');
  imgParent.appendChild(elements.detailImg);

  const likeIcon = createMockElement('span');
  likeIcon.className = 'editor-reaction-like-icon';
  elements.momentLikeBtn.appendChild(likeIcon);
  elements.momentLikeBtn.querySelector = (sel) => {
    if (sel === '.editor-reaction-like-icon') return likeIcon;
    return null;
  };

  const context = {
    window: {},
    document: {
      createElement(tagName) {
        return createMockElement(tagName);
      },
      getElementById(id) {
        return elements[id] || null;
      },
      querySelector(sel) {
        if (sel === '#detailPanel h3') return createMockElement('h3');
        if (sel === '.detail-video img') return elements.detailImg;
        if (sel === '.diary-note') return elements.detailMemo;
        return null;
      },
      querySelectorAll(sel) {
        return [];
      }
    },
    Date: {
      now: () => currentFakeTime
    },
    apiClient: {
      fetchReactionSummary(memoryId) {
        fetchCalls++;
        return new Promise((resolve, reject) => {
          apiResolve = resolve;
          apiReject = reject;
        });
      }
    }
  };

  context.window = context;

  vm.createContext(context);
  const metadataCode = fs.readFileSync(path.join(ROOT, 'js/viewer/public-viewer-detail-metadata-text.js'), 'utf8');
  vm.runInContext(metadataCode, context);
  assert.ok(context.window.LoveBudPublicViewerDetailMetadataText, 'window.LoveBudPublicViewerDetailMetadataText must exist');
  assert.ok(context.window.LoveBudPublicViewerDetailMetadataText.safeDisplayTitle, 'safeDisplayTitle helper must exist');
  assert.ok(context.window.LoveBudPublicViewerDetailMetadataText.createPublicViewerCurrentMomentBadgeBoundary, 'createPublicViewerCurrentMomentBadgeBoundary helper must exist');
  assert.ok(context.window.LoveBudPublicViewerDetailMetadataText.createPublicViewerCurrentMomentTitleBoundary, 'createPublicViewerCurrentMomentTitleBoundary helper must exist');
  assert.ok(context.window.LoveBudPublicViewerDetailMetadataText.updatePublicViewerCurrentMomentHint, 'updatePublicViewerCurrentMomentHint helper must exist');
  assert.ok(context.window.LoveBudPublicViewerDetailMetadataText.updatePublicViewerCurrentMomentDate, 'updatePublicViewerCurrentMomentDate helper must exist');

  vm.runInContext(scriptSource, context);

  assert.equal(typeof context.createPublicViewerDetailUI, 'function', 'UI factory should be exposed on window');

  const deps = {
    getSelectedNodeId: () => currentSelectedId,
    isRootMemory: (data, rootId) => false,
    getCanonicalRootId: () => 'root',
    getTreeMemories: () => [{ id: 'mem-1' }],
    resolveMemoryThumbnail: (data) => data.thumbnail || '',
    i18n: (key) => key,
    getLocalSaveMode: () => false,
    showToast: () => {}
  };

  const detailUI = context.createPublicViewerDetailUI(deps);

  const data1 = { id: 'mem-1', title: 'Moment 1', thumbnail: '/thumb.jpg' };

  // 1. Initial panel update: should request from API
  detailUI.updateDetailPanel(data1);
  assert.equal(fetchCalls, 1, 'First update should invoke API client fetch');
  assert.equal(elements.momentLikeBtn.tagName, 'DIV', 'Like stat must not be a button');
  assert.equal(elements.momentCommentBtn.tagName, 'DIV', 'Comment stat must not be a button');
  assert.equal(elements.momentLikeBtn.disabled, undefined, 'Read-only stat must not depend on disabled button state');
  assert.equal(elements.momentLikeBtn.getAttribute('aria-disabled'), undefined, 'Read-only stat must not depend on aria-disabled');
  assert.equal(elements.momentReactionsCard.getAttribute('data-read-only-summary'), 'true', 'Card must flag read-only summary');
  assert.equal(elements.momentLikeBtn.getAttribute('aria-label'), '좋아요 0', 'Like stat aria-label starts with neutral count');
  assert.equal(elements.momentCommentBtn.getAttribute('aria-label'), '댓글 0', 'Comment stat aria-label starts with neutral count');
  assert.ok(imgParent.classList.contains('is-empty') === false, 'Image container should not have is-empty if thumbnail exists');

  // 2. Immediate repeat update (< 150ms): should short-circuit and NOT request fetch
  currentFakeTime += 50;
  detailUI.updateDetailPanel(data1);
  assert.equal(fetchCalls, 1, 'Short-circuit within 150ms should prevent extra calls');

  // 3. Update after 200ms: still in-flight, should deduplicate and NOT request fetch
  currentFakeTime += 200;
  detailUI.updateDetailPanel(data1);
  assert.equal(fetchCalls, 1, 'In-flight check should prevent parallel request for same memory ID');

  // 4. Resolve the in-flight promise and verify elements update
  apiResolve({ likeCount: 7, commentCount: 2, userReacted: true });
  await new Promise(resolve => process.nextTick(resolve));

  assert.equal(elements.momentLikeCount.textContent.toString(), '7', 'Like count updated after success');
  assert.equal(elements.momentCommentCount.textContent.toString(), '2', 'Comment count updated after success');
  assert.equal(elements.momentLikeBtn.getAttribute('aria-label'), '좋아요 7', 'Like stat aria-label reflects latest count');
  assert.equal(elements.momentCommentBtn.getAttribute('aria-label'), '댓글 2', 'Comment stat aria-label reflects latest count');
  assert.equal(likeIcon.textContent, '🤍', 'userReacted must not switch the read-only icon to pressed state');

  // 5. Subsequent update: should read from cache and NOT call API
  currentFakeTime += 500;
  detailUI.updateDetailPanel(data1);
  assert.equal(fetchCalls, 1, 'Cache hit should prevent refetching entirely');
  assert.equal(elements.momentLikeBtn.getAttribute('aria-label'), '좋아요 7', 'Cached like count keeps aria-label in sync');
  assert.equal(elements.momentCommentBtn.getAttribute('aria-label'), '댓글 2', 'Cached comment count keeps aria-label in sync');

  // 6. Test 401 Failure Fallback behaviour
  fetchCalls = 0;
  const data2 = { id: 'mem-2', title: 'Moment 2', thumbnail: '' };
  currentSelectedId = 'mem-2';

  detailUI.updateDetailPanel(data2);
  assert.equal(fetchCalls, 1, 'New memory ID fetch started');
  assert.ok(imgParent.classList.contains('is-empty') === true, 'Image container should be marked as empty when no thumbnail');

  const error401 = new Error('Unauthorized');
  error401.status = 401;
  apiReject(error401);
  await new Promise(resolve => process.nextTick(resolve));

  // Should remain neutral fallback (zero counts)
  assert.equal(elements.momentLikeCount.textContent.toString(), '0');
  assert.equal(elements.momentCommentCount.textContent.toString(), '0');
  assert.equal(elements.momentLikeBtn.getAttribute('aria-label'), '좋아요 0');
  assert.equal(elements.momentCommentBtn.getAttribute('aria-label'), '댓글 0');

  // Next update for mem-2 should NOT request fetch because it's in auth failure / cached neutral state
  currentFakeTime += 500;
  detailUI.updateDetailPanel(data2);
  assert.equal(fetchCalls, 1, 'Should reuse failure fallback cache and not fetch again');
});
