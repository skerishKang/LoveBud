/**
 * #4069 private-first YouTube playlist import-intent review contract test.
 *
 * Executes the real production preview UI module
 * (js/import/youtube-playlist-preview-ui.js, a browser IIFE) inside a vm
 * sandbox with a stubbed DOM, exactly like the #4062 contract test.
 *
 * Verifies the #4069 import-intent contract:
 *
 *  - canonical Tree-title bound reused from #3935 (validate_tree_title
 *    max_length=200) — no new persisted limit invented
 *  - deterministic trim; empty/whitespace-only and over-limit titles fail
 *    closed
 *  - prepared intent visibility is exactly 'private'; no public /
 *    import-and-publish shortcut exists (public YouTube playlist is not
 *    publication authority)
 *  - buildPrivateImportIntent() is pure/deterministic: source order
 *    preserved, duplicate video occurrences distinct, unavailable excluded,
 *    caller inputs never mutated, returned intent detached
 *  - no persisted Tree/Moment/Connection IDs or semantic Connections; no
 *    client-side persistence claim
 *  - review state is never cached — new preview / selection / title change
 *    invalidates any prior review, so a stale intent can never remain
 *    silently actionable
 *  - no fetch / XMLHttpRequest / write-route capability introduced
 *  - static popover markup exposes label + aria-describedby + role="alert"
 *    for the title input and an aria-live review region
 *
 * No network, no DB, no browser, no Production.
 *
 * Refs: #4069, #4062, #3914, #3935, #3897, #1882.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const UI_FILE = path.join(__dirname, '..', '..', 'js/import/youtube-playlist-preview-ui.js');
const UI_SOURCE = fs.readFileSync(UI_FILE, 'utf8');
const HTML_FILE = path.join(__dirname, '..', '..', 'pages/my-trees.html');
const HTML_SOURCE = fs.readFileSync(HTML_FILE, 'utf8');

const TITLE_INPUT_ID = 'youtubePlaylistTreeTitle';
const TITLE_ERROR_ID = 'youtubePlaylistTitleError';
const REVIEW_ID = 'youtubePlaylistReview';
const COUNT_ID = 'youtubePlaylistSelectedCount';

function makeElement(id) {
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    setAttribute() {},
    getAttribute() { return null; },
    classList: { contains() { return false; } },
    querySelectorAll() { return []; },
    addEventListener() {},
    focus() {},
  };
}

function loadUi(ids) {
  const elements = {};
  (ids || []).forEach((id) => {
    elements[id] = makeElement(id);
  });
  const sandbox = {
    window: {},
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      addEventListener() {},
    },
    module: { exports: {} },
    exports: {},
    console,
    URL,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(UI_SOURCE, sandbox, { filename: UI_FILE });
  const api = sandbox.window.LoveTreeYouTubePlaylistPreviewUI;
  assert.ok(api, 'window.LoveTreeYouTubePlaylistPreviewUI must be registered');
  return { api, elements };
}

function intentHarness() {
  return loadUi([TITLE_INPUT_ID, TITLE_ERROR_ID, REVIEW_ID, COUNT_ID]);
}

// Canonical #3914 preview item shape.
function item(position, videoId, state, overrides) {
  return Object.assign(
    {
      position,
      videoId,
      title: 'T' + position,
      channelTitle: 'C',
      state,
      thumbnailUrl: 'https://i.ytimg.com/' + position + '.jpg',
      sourceUrl: 'https://www.youtube.com/watch?v=' + videoId,
    },
    overrides || {}
  );
}

function previewData(items, truncated) {
  return {
    ok: true,
    playlist: { id: 'PLtest1234567890', title: '재생목록', channelTitle: '채널', itemCount: items.length, truncated: !!truncated },
    items,
    truncated: !!truncated,
  };
}

test('4069: canonical Tree-title bound is reused from #3935 (200)', () => {
  const { api } = intentHarness();
  assert.equal(api.TREE_TITLE_MAX, 200, 'must match validate_tree_title max_length=200 (#3935)');
  // The create-tree modal input uses the same bound.
  assert.match(HTML_SOURCE, /maxlength="200"/);
});

test('4069: normalizeTreeTitle trims deterministically and fails closed', () => {
  const { api } = intentHarness();
  const trimmed = api.normalizeTreeTitle('  My Tree  ');
  assert.equal(trimmed.ok, true);
  assert.equal(trimmed.value, 'My Tree');
  assert.equal(api.normalizeTreeTitle('').ok, false);
  assert.equal(api.normalizeTreeTitle('').code, 'TITLE_REQUIRED');
  assert.equal(api.normalizeTreeTitle('   ').ok, false);
  assert.equal(api.normalizeTreeTitle('   ').code, 'TITLE_REQUIRED');
  assert.equal(api.normalizeTreeTitle('a'.repeat(201)).ok, false);
  assert.equal(api.normalizeTreeTitle('a'.repeat(201)).code, 'TITLE_TOO_LONG');
  assert.equal(api.normalizeTreeTitle('a'.repeat(200)).ok, true, 'exactly 200 is allowed');
  assert.equal(api.normalizeTreeTitle(123).ok, false);
  assert.equal(api.normalizeTreeTitle(123).code, 'TITLE_INVALID_TYPE');
  assert.equal(api.normalizeTreeTitle(null).ok, false);
});

test('4069: valid title + eligible selection -> deterministic private intent', () => {
  const { api } = intentHarness();
  const data = previewData([
    item(0, 'v1', 'AVAILABLE_METADATA'),
    item(1, 'v2', 'THUMBNAIL_UNAVAILABLE'),
  ]);
  const result = api.buildPrivateImportIntent(data, { '0': true, '1': true }, '  My Tree  ');
  assert.equal(result.ok, true);
  const intent = result.intent;
  assert.equal(intent.tree.title, 'My Tree');
  assert.equal(intent.tree.visibility, 'private');
  assert.equal(intent.pending, true, 'no persisted entity — later write child creates it');
  assert.equal(intent.source.playlistId, 'PLtest1234567890');
  assert.equal(intent.source.playlistTitle, '재생목록');
  assert.equal(intent.source.channelTitle, '채널');
  assert.equal(intent.items.length, 2);
  assert.equal(intent.items.map((d) => d.position).join(','), '0,1');
  assert.equal(intent.items[1].state, 'THUMBNAIL_UNAVAILABLE', 'thumbnail-unavailable stays eligible');
});

test('4069: blank / over-limit / non-string titles fail closed', () => {
  const { api } = intentHarness();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA')]);
  const blank = api.buildPrivateImportIntent(data, { '0': true }, '   ');
  assert.equal(blank.ok, false);
  assert.equal(blank.error.code, 'TITLE_REQUIRED');
  const long = api.buildPrivateImportIntent(data, { '0': true }, 'x'.repeat(201));
  assert.equal(long.ok, false);
  assert.equal(long.error.code, 'TITLE_TOO_LONG');
  const badType = api.buildPrivateImportIntent(data, { '0': true }, 42);
  assert.equal(badType.ok, false);
  assert.equal(badType.error.code, 'TITLE_INVALID_TYPE');
});

test('4069: no eligible selection -> NO_SELECTED_ELIGIBLE_ITEMS', () => {
  const { api } = intentHarness();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA')]);
  const none = api.buildPrivateImportIntent(data, {}, 'My Tree');
  assert.equal(none.ok, false);
  assert.equal(none.error.code, 'NO_SELECTED_ELIGIBLE_ITEMS');
});

test('4069: duplicate videoId occurrences remain distinct in the intent', () => {
  const { api } = intentHarness();
  const data = previewData([
    item(2, 'ABC', 'AVAILABLE_METADATA'),
    item(8, 'ABC', 'AVAILABLE_METADATA'),
  ]);
  const result = api.buildPrivateImportIntent(data, { '2': true, '8': true }, 'Tree');
  assert.equal(result.ok, true);
  assert.equal(result.intent.items.map((d) => d.position).join(','), '2,8');
  assert.equal(result.intent.items[0].videoId, 'ABC');
  assert.equal(result.intent.items[1].videoId, 'ABC');
});

test('4069: intent items are in canonical source order, never click order', () => {
  const { api } = intentHarness();
  const data = previewData([
    item(2, 'v8', 'AVAILABLE_METADATA'),
    item(5, 'v5', 'AVAILABLE_METADATA'),
    item(8, 'v2', 'AVAILABLE_METADATA'),
  ]);
  // User "selected" 8, then 2, then 5 — output must be 2, 5, 8.
  const result = api.buildPrivateImportIntent(data, { '8': true, '2': true, '5': true }, 'Tree');
  assert.equal(result.ok, true);
  assert.equal(result.intent.items.map((d) => d.position).join(','), '2,5,8');
  assert.equal(result.intent.items.map((d) => d.videoId).join(','), 'v8,v5,v2');
});

test('4069: unavailable / unknown occurrences can never re-enter the intent', () => {
  const { api } = intentHarness();
  const data = previewData([
    item(0, 'ok1', 'AVAILABLE_METADATA'),
    item(1, 'priv', 'PRIVATE_OR_UNAVAILABLE'),
    item(2, 'unk', 'UNKNOWN'),
    item(3, 'thumb', 'THUMBNAIL_UNAVAILABLE'),
  ]);
  // Explicitly "select" everything; only eligible occurrences may enter.
  const result = api.buildPrivateImportIntent(data, { '0': true, '1': true, '2': true, '3': true }, 'Tree');
  assert.equal(result.ok, true);
  assert.equal(result.intent.items.map((d) => d.position).join(','), '0,3');
});

test('4069: visibility is exactly private — no public shortcut exists', () => {
  const { api } = intentHarness();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA')]);
  const result = api.buildPrivateImportIntent(data, { '0': true }, 'Tree');
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.intent.tree).sort(), ['title', 'visibility']);
  assert.equal(result.intent.tree.visibility, 'private');
  assert.equal(result.intent.tree.visibility, api.PRIVATE_VISIBILITY);
  assert.ok(!('public' in result.intent.tree), 'no public visibility option');
  assert.ok(!('publish' in result.intent), 'no publish flag');
  assert.doesNotMatch(UI_SOURCE, /visibility:\s*'public'/, 'no public visibility literal in the module');
  assert.doesNotMatch(UI_SOURCE, /import-and-publish/, 'no import-and-publish shortcut');
});

test('4069: builder never mutates caller inputs', () => {
  const { api } = intentHarness();
  const data = previewData([
    item(0, 'v1', 'AVAILABLE_METADATA', { nested: { a: 1 } }),
    item(1, 'v2', 'AVAILABLE_METADATA'),
  ]);
  const before = JSON.stringify(data);
  const title = '  My Tree  ';
  api.buildPrivateImportIntent(data, { '0': true, '1': true }, title);
  assert.equal(JSON.stringify(data), before, 'preview object must be unchanged');
  assert.equal(title, '  My Tree  ', 'title string must be unchanged');
  assert.equal(data.items[0].nested.a, 1);
});

test('4069: returned intent is detached and carries no persisted identities', () => {
  const { api } = intentHarness();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA'), item(1, 'v2', 'AVAILABLE_METADATA')]);
  const result = api.buildPrivateImportIntent(data, { '0': true }, 'Tree');
  assert.equal(result.ok, true);
  // Mutating the returned intent must not affect later builds.
  result.intent.items.push({ position: 99, videoId: 'junk' });
  result.intent.tree.title = 'Mutated';
  const again = api.buildPrivateImportIntent(data, { '0': true }, 'Tree');
  assert.equal(again.ok, true);
  assert.equal(again.intent.items.length, 1);
  assert.equal(again.intent.tree.title, 'Tree');
  // No persisted identities / semantic connections.
  for (const d of result.intent.items) {
    assert.ok(!('treeId' in d) && !('memoryId' in d) && !('id' in d), 'no DB identity minted');
    assert.ok(!('sortOrder' in d), 'no Production sortOrder invented');
    assert.ok(!('connectionId' in d), 'no Connection identity');
  }
  assert.ok(!('connections' in result.intent), 'no adjacency-derived semantic Connections');
  assert.ok(!('persisted' in result.intent) && !('saved' in result.intent), 'no client-side persistence claim');
});

test('4069: no fetch / XMLHttpRequest / write-route capability is introduced', () => {
  const { api } = intentHarness();
  assert.doesNotMatch(UI_SOURCE, /fetch\s*\(/, 'module must not call fetch');
  assert.doesNotMatch(UI_SOURCE, /XMLHttpRequest/, 'module must not use XHR');
  const writeVerbs = ['createTree', 'saveImport', 'submitImport', 'persist', 'writeImport', 'postImport', 'requestImport'];
  for (const verb of writeVerbs) {
    assert.ok(!(verb in api), 'exported API must not expose ' + verb);
  }
  // The only network seam remains the existing read-only preview client.
  assert.equal(typeof api.buildRequest, 'function');
});

test('4069: review renders ready summary only with valid title + selection', () => {
  const { api, elements } = intentHarness();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA'), item(1, 'v2', 'AVAILABLE_METADATA')]);
  api.setStateSuccess(data);
  elements[TITLE_INPUT_ID].value = '  My Tree  ';
  api.selectAllEligible(data.items);
  api.renderReview();
  assert.match(elements[REVIEW_ID].innerHTML, /data-review-ready="true"/);
  assert.match(elements[REVIEW_ID].innerHTML, /My Tree/);
  assert.match(elements[REVIEW_ID].innerHTML, /선택 항목: 2개/);
  assert.match(elements[REVIEW_ID].innerHTML, /비공개/);
  assert.match(elements[REVIEW_ID].innerHTML, /아직 Tree가 생성되지 않았어요/);
  assert.equal(elements[TITLE_ERROR_ID].hidden, true, 'no error when title valid');
});

test('4069: review shows associated validation error for blank title', () => {
  const { api, elements } = intentHarness();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA')]);
  api.setStateSuccess(data);
  elements[TITLE_INPUT_ID].value = '   ';
  api.selectAllEligible(data.items);
  api.renderReview();
  assert.equal(elements[TITLE_ERROR_ID].hidden, false);
  assert.match(elements[TITLE_ERROR_ID].textContent, /제목을 입력해주세요/);
  assert.doesNotMatch(elements[REVIEW_ID].innerHTML, /data-review-ready="true"/);
  assert.equal(api.getPreparedImportIntent(), null, 'blank title -> no actionable intent');
});

test('4069: over-limit title shows bounded-length validation error', () => {
  const { api, elements } = intentHarness();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA')]);
  api.setStateSuccess(data);
  elements[TITLE_INPUT_ID].value = 'x'.repeat(201);
  api.selectAllEligible(data.items);
  api.renderReview();
  assert.equal(elements[TITLE_ERROR_ID].hidden, false);
  assert.match(elements[TITLE_ERROR_ID].textContent, /200자 이하/);
  assert.equal(api.getPreparedImportIntent(), null);
});

test('4069: selection change invalidates a previously ready review', () => {
  const { api, elements } = intentHarness();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA'), item(1, 'v2', 'AVAILABLE_METADATA')]);
  api.setStateSuccess(data);
  elements[TITLE_INPUT_ID].value = 'My Tree';
  api.selectAllEligible(data.items);
  api.renderReview();
  assert.match(elements[REVIEW_ID].innerHTML, /data-review-ready="true"/);
  assert.notEqual(api.getPreparedImportIntent(), null);
  // Clear selection -> review no longer actionable, intent gone.
  api.clearSelection();
  assert.match(elements[REVIEW_ID].innerHTML, /가져올 항목을 선택해주세요/);
  assert.equal(api.getPreparedImportIntent(), null);
});

test('4069: title change re-derives review (stale intent never actionable)', () => {
  const { api, elements } = intentHarness();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA')]);
  api.setStateSuccess(data);
  elements[TITLE_INPUT_ID].value = 'Old Tree';
  api.selectAllEligible(data.items);
  api.renderReview();
  assert.equal(api.getPreparedImportIntent().tree.title, 'Old Tree');
  elements[TITLE_INPUT_ID].value = 'New Tree';
  api.renderReview();
  assert.match(elements[REVIEW_ID].innerHTML, /New Tree/);
  assert.equal(api.getPreparedImportIntent().tree.title, 'New Tree', 'intent re-derived, never cached');
});

test('4069: new preview success invalidates the prior review and intent', () => {
  const { api, elements } = intentHarness();
  const data1 = previewData([item(0, 'v1', 'AVAILABLE_METADATA')]);
  api.setStateSuccess(data1);
  elements[TITLE_INPUT_ID].value = 'My Tree';
  api.selectAllEligible(data1.items);
  api.renderReview();
  assert.notEqual(api.getPreparedImportIntent(), null);
  // A second (different) preview completes — prior review must not survive.
  const data2 = previewData([item(0, 'other', 'AVAILABLE_METADATA')]);
  api.setStateSuccess(data2);
  assert.equal(elements[TITLE_INPUT_ID].value, '', 'title cleared on new preview success');
  assert.doesNotMatch(elements[REVIEW_ID].innerHTML, /data-review-ready="true"/);
  assert.equal(api.getPreparedImportIntent(), null, 'stale intent must not remain actionable');
});

test('4069: loading / error paths clear review state', () => {
  const { api, elements } = intentHarness();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA')]);
  api.setStateSuccess(data);
  elements[TITLE_INPUT_ID].value = 'My Tree';
  api.selectAllEligible(data.items);
  api.renderReview();
  assert.notEqual(api.getPreparedImportIntent(), null);
  api.setStateLoading();
  assert.equal(api.getPreparedImportIntent(), null);
  assert.equal(elements[TITLE_INPUT_ID].value, '');
  api.setStateSuccess(data);
  elements[TITLE_INPUT_ID].value = 'My Tree';
  api.selectAllEligible(data.items);
  api.renderReview();
  assert.notEqual(api.getPreparedImportIntent(), null);
  api.setStateError('PREVIEW_ERROR', 'failed');
  assert.equal(api.getPreparedImportIntent(), null);
  assert.doesNotMatch(elements[REVIEW_ID].innerHTML, /data-review-ready="true"/);
});

test('4069: popover close clears review (reopen starts clean)', () => {
  const { api, elements } = intentHarness();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA')]);
  api.setStateSuccess(data);
  elements[TITLE_INPUT_ID].value = 'My Tree';
  api.selectAllEligible(data.items);
  api.renderReview();
  // Simulate close semantics exposed by the module (clearTitleInput resets
  // title; review region is emptied by closePopover before focus return).
  api.clearTitleInput();
  assert.equal(elements[TITLE_INPUT_ID].value, '');
  assert.equal(api.getPreparedImportIntent(), null);
});

test('4069: static popover markup exposes accessible title control and review region', () => {
  assert.match(HTML_SOURCE, /<label[^>]*for="youtubePlaylistTreeTitle"/);
  assert.match(HTML_SOURCE, /id="youtubePlaylistTreeTitle"[^>]*aria-describedby="youtubePlaylistTitleError"/);
  assert.match(HTML_SOURCE, /id="youtubePlaylistTitleError"[^>]*role="alert"/);
  assert.match(HTML_SOURCE, /id="youtubePlaylistTitleError"[^>]*aria-live="polite"/);
  assert.match(HTML_SOURCE, /id="youtubePlaylistReview"[^>]*aria-live="polite"/);
});
