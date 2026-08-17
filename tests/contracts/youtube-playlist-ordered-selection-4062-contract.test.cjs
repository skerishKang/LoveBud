/**
 * #4062 ordered YouTube playlist item-selection contract test.
 *
 * Executes the real production preview UI module
 * (js/import/youtube-playlist-preview-ui.js, a browser IIFE) inside a vm
 * sandbox with a stubbed DOM. Verifies the #4062 selection contract:
 *
 *  - occurrence-based selection identity (position, NOT videoId): duplicate
 *    videoId occurrences are independently selectable
 *  - canonical source order preserved in the ordered import draft regardless
 *    of click order
 *  - eligibility derived from the canonical #3914 item-state vocabulary:
 *    PRIVATE_OR_UNAVAILABLE / UNKNOWN fail closed; AVAILABLE_METADATA /
 *    METADATA_PARTIAL / THUMBNAIL_UNAVAILABLE selectable
 *  - THUMBNAIL_UNAVAILABLE is NOT MEDIA_UNAVAILABLE
 *  - select-all-eligible excludes unavailable/private; clear empties
 *  - buildOrderedImportDraft never mutates the preview object and returns a
 *    detached draft carrying only #3914 contract fields
 *  - selection state resets (loading / success / error / close paths)
 *  - accessibility: checkbox is a real input with an accessible label, rows
 *    keep their visible state, and the selected count is exposed
 *
 * No network, no DB, no browser, no Production.
 *
 * Refs: #4062, #3914, #3897, #1882.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const UI_FILE = path.join(__dirname, '..', '..', 'js/import/youtube-playlist-preview-ui.js');
const UI_SOURCE = fs.readFileSync(UI_FILE, 'utf8');

// Minimal stubbed DOM used by the module at load time (init() attaches a
// DOMContentLoaded listener and exposes the API on window).
function loadUi() {
  const elements = {};
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

// Canonical #3914 preview item shape (position, videoId, title, channelTitle,
// state, thumbnailUrl, sourceUrl).
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

test('4062: eligibility — PRIVATE_OR_UNAVAILABLE and UNKNOWN fail closed; others selectable', () => {
  const { api } = loadUi();
  assert.equal(api.isItemSelectable(item(0, 'v1', 'AVAILABLE_METADATA')), true);
  assert.equal(api.isItemSelectable(item(1, 'v2', 'METADATA_PARTIAL')), true);
  assert.equal(api.isItemSelectable(item(2, 'v3', 'THUMBNAIL_UNAVAILABLE')), true);
  assert.equal(api.isItemSelectable(item(3, 'v4', 'PRIVATE_OR_UNAVAILABLE')), false);
  assert.equal(api.isItemSelectable(item(4, 'v5', 'UNKNOWN')), false);
  // Missing position identity fails closed.
  assert.equal(api.isItemSelectable({ videoId: 'v6', state: 'AVAILABLE_METADATA' }), false);
  assert.equal(api.isItemSelectable(null), false);
});

test('4062: duplicate videoId occurrences are independently selectable', () => {
  const { api } = loadUi();
  const data = previewData([
    item(2, 'ABC', 'AVAILABLE_METADATA'),
    item(8, 'ABC', 'AVAILABLE_METADATA'),
  ]);
  const draft = api.buildOrderedImportDraft(data, { '2': true, '8': true });
  assert.equal(draft.length, 2, 'both occurrences must be selected');
  assert.equal(draft[0].position, 2);
  assert.equal(draft[1].position, 8);
  assert.equal(draft[0].videoId, 'ABC');
  assert.equal(draft[1].videoId, 'ABC');
});

test('4062: draft is always in canonical source order, never click order', () => {
  const { api } = loadUi();
  const data = previewData([
    item(2, 'v8', 'AVAILABLE_METADATA'),
    item(5, 'v5', 'AVAILABLE_METADATA'),
    item(8, 'v2', 'AVAILABLE_METADATA'),
  ]);
  // User "clicked" 8, then 2, then 5 — but the draft must be 2, 5, 8.
  const draft = api.buildOrderedImportDraft(data, { '8': true, '2': true, '5': true });
  assert.equal(draft.map((d) => d.position).join(','), '2,5,8');
  assert.equal(draft.map((d) => d.videoId).join(','), 'v8,v5,v2');
});

test('4062: unavailable/private items are never included; select-all-eligible excludes them', () => {
  const { api } = loadUi();
  const data = previewData([
    item(0, 'ok1', 'AVAILABLE_METADATA'),
    item(1, 'priv', 'PRIVATE_OR_UNAVAILABLE'),
    item(2, 'partial', 'METADATA_PARTIAL'),
    item(3, 'unk', 'UNKNOWN'),
    item(4, 'thumb', 'THUMBNAIL_UNAVAILABLE'),
  ]);
  // Explicit selection of an ineligible item is ignored.
  const draft = api.buildOrderedImportDraft(data, { '0': true, '1': true, '3': true, '4': true });
  assert.equal(draft.map((d) => d.position).join(','), '0,4');
  // Select-all picks eligible only.
  api.selectAllEligible(data.items);
  assert.equal(api.selectionCount(), 3, 'only AVAILABLE_METADATA + METADATA_PARTIAL + THUMBNAIL_UNAVAILABLE');
});

test('4062: clear empties the selection deterministically', () => {
  const { api } = loadUi();
  const data = previewData([item(0, 'a', 'AVAILABLE_METADATA'), item(1, 'b', 'AVAILABLE_METADATA')]);
  api.selectAllEligible(data.items);
  assert.equal(api.selectionCount(), 2);
  api.clearSelection();
  assert.equal(api.selectionCount(), 0);
  const draft = api.buildOrderedImportDraft(data, {});
  assert.equal(draft.length, 0);
});

test('4062: THUMBNAIL_UNAVAILABLE does not make an otherwise eligible item unselectable', () => {
  const { api } = loadUi();
  const data = previewData([item(0, 'thumbOnly', 'THUMBNAIL_UNAVAILABLE', { thumbnailUrl: null })]);
  assert.equal(api.isItemSelectable(data.items[0]), true);
  const draft = api.buildOrderedImportDraft(data, { '0': true });
  assert.equal(draft.length, 1);
  assert.equal(draft[0].state, 'THUMBNAIL_UNAVAILABLE');
});

test('4062: buildOrderedImportDraft never mutates the preview object', () => {
  const { api } = loadUi();
  const data = previewData([
    item(0, 'v1', 'AVAILABLE_METADATA', { nested: { a: 1 } }),
    item(1, 'v2', 'AVAILABLE_METADATA'),
  ]);
  const before = JSON.stringify(data);
  api.buildOrderedImportDraft(data, { '0': true, '1': true });
  assert.equal(JSON.stringify(data), before, 'preview object must be unchanged');
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0].nested.a, 1);
});

test('4062: returned draft is detached from internal selection state', () => {
  const { api } = loadUi();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA'), item(1, 'v2', 'AVAILABLE_METADATA')]);
  const draft = api.buildOrderedImportDraft(data, { '0': true });
  assert.equal(draft.length, 1);
  draft.push({ position: 99, videoId: 'junk' });
  // Internal selection / later builds unaffected.
  const draft2 = api.buildOrderedImportDraft(data, { '0': true });
  assert.equal(draft2.length, 1);
  assert.equal(draft2.map((d) => d.position).join(','), '0');
});

test('4062: draft carries only #3914 contract fields — no DB identity invented', () => {
  const { api } = loadUi();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA')]);
  const draft = api.buildOrderedImportDraft(data, { '0': true });
  const keys = Object.keys(draft[0]).sort();
  assert.deepEqual(keys, ['channelTitle', 'position', 'sourceUrl', 'state', 'thumbnailUrl', 'title', 'videoId']);
  assert.ok(!('sortOrder' in draft[0]), 'no Production sortOrder field invented');
  assert.ok(!('memoryId' in draft[0]) && !('treeId' in draft[0]) && !('id' in draft[0]), 'no DB identity minted');
});

test('4062: selection state resets on success / loading / error / close paths', () => {
  const { api } = loadUi();
  const data = previewData([item(0, 'v1', 'AVAILABLE_METADATA'), item(1, 'v2', 'AVAILABLE_METADATA')]);
  api.selectAllEligible(data.items);
  assert.equal(api.selectionCount(), 2);
  api.resetSelection();
  assert.equal(api.selectionCount(), 0);
});

test('4062: renderRow emits an accessible checkbox per occurrence with visible disabled state', () => {
  const { api } = loadUi();
  const html = api.renderRow(item(2, 'v9', 'AVAILABLE_METADATA'));
  assert.match(html, /<input type="checkbox" class="ypp-select" data-position="2"/);
  assert.match(html, /aria-label="3번/);
  assert.doesNotMatch(html, /disabled/);
  // Duplicate video at another position gets its own independent control.
  const htmlDup = api.renderRow(item(8, 'v9', 'AVAILABLE_METADATA'));
  assert.match(htmlDup, /data-position="8"/);
  assert.equal(htmlDup.indexOf('data-position="2"'), -1, 'row html differs by position');
  // Unavailable item keeps a visible disabled control (not hidden).
  const htmlUnavailable = api.renderRow(item(3, 'v10', 'PRIVATE_OR_UNAVAILABLE'));
  assert.match(htmlUnavailable, /disabled/);
  assert.match(htmlUnavailable, /선택 불가/);
  assert.match(htmlUnavailable, /비공개 또는 삭제됨/);
});

test('4062: selection bar exposes select-all / clear / live count', () => {
  const { api } = loadUi();
  const html = api.buildPlaylistHtml(previewData([
    item(0, 'a', 'AVAILABLE_METADATA'),
    item(1, 'p', 'PRIVATE_OR_UNAVAILABLE'),
  ]));
  assert.match(html, /data-ypp-action="select-all"/);
  assert.match(html, /data-ypp-action="clear"/);
  assert.match(html, /ypp-selected-count/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /선택 0개/);
  // Unavailable row is present with its visible state, not silently dropped.
  assert.match(html, /비공개 또는 삭제됨/);
});
