const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');
const viewHtml = fs.readFileSync('pages/view.html', 'utf8');

function getScriptSrcs() {
  return [...viewHtml.matchAll(/<script(?:\s+type="module")?\s+src="([^"]+)"/g)].map((match) => String(match[1] || '').split('?')[0]);
}

function scriptIndex(scripts, needle) {
  return scripts.findIndex((src) => src.includes(needle));
}

function assertScriptOrder(scripts, beforeNeedle, afterNeedle) {
  const beforeIndex = scriptIndex(scripts, beforeNeedle);
  const afterIndex = scriptIndex(scripts, afterNeedle);
  assert.notEqual(beforeIndex, -1, `missing script: ${beforeNeedle}`);
  assert.notEqual(afterIndex, -1, `missing script: ${afterNeedle}`);
  assert.ok(beforeIndex < afterIndex, `${beforeNeedle} must load before ${afterNeedle}`);
}

function getDetailAdapterSlice() {
  const start = source.indexOf('function createPublicViewerDetailUI(deps)');
  const end = source.indexOf('window.createPublicViewerDetailUI = createPublicViewerDetailUI;');
  assert.notEqual(start, -1, 'missing createPublicViewerDetailUI');
  assert.notEqual(end, -1, 'missing public viewer detail UI export');
  return source.slice(start, end);
}

test('public viewer detail adapter keeps explicit editor detail UI delegation seam', () => {
  const adapter = getDetailAdapterSlice();

  assert.ok(adapter.includes("typeof window.createEditorDetailUI !== 'function'"));
  assert.ok(adapter.includes("throw new Error('createEditorDetailUI is required for public viewer detail UI adapter')"));
  assert.ok(adapter.includes('var detailUI = window.createEditorDetailUI(deps);'));
  assert.ok(source.includes('delegatesToEditorDetailUI: true'));
});

test('public viewer detail adapter owns detail render flow from heading boundary', () => {
  const adapter = getDetailAdapterSlice();
  const headingCall = adapter.indexOf('updateDetailHeading();');
  const badgeCall = adapter.indexOf('updateCurrentMomentBadge(data);');
  const titleCall = adapter.indexOf('updateCurrentMomentTitle(data);');
  const hintCall = adapter.indexOf('updatePublicViewerCurrentMomentHint();');
  const imageCall = adapter.indexOf('updateCurrentMomentImage(data);');
  const dateCall = adapter.indexOf('updatePublicViewerCurrentMomentDate(data);');
  const memoCall = adapter.indexOf('updateMemoBody(data);');
  const tagsCall = adapter.indexOf('updateCurrentMomentTags(data);');
  const reactionsCall = adapter.indexOf('updateReadOnlyReactionSummary(data);');

  assert.equal(adapter.indexOf('delegatedUpdateDetailPanel(data);'), -1, 'adapter no longer delegates detail panel rendering');

  [headingCall, badgeCall, titleCall, hintCall, imageCall, dateCall, memoCall, tagsCall, reactionsCall]
    .forEach((index) => assert.notEqual(index, -1));

  assert.ok(headingCall < badgeCall);
  assert.ok(badgeCall < titleCall);
  assert.ok(titleCall < hintCall);
  assert.ok(hintCall < imageCall);
  assert.ok(imageCall < dateCall);
  assert.ok(dateCall < memoCall);
  assert.ok(memoCall < tagsCall);
  assert.ok(tagsCall < reactionsCall);
});

test('public viewer detail adapter loads after editor detail UI core and before channel patch', () => {
  const scripts = getScriptSrcs();

  assertScriptOrder(scripts, 'js/viewer/public-viewer-detail-tree-meta.js', 'js/editor/editor-detail-ui.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-detail-builders.js', 'js/editor/editor-detail-ui.js');
  assertScriptOrder(scripts, 'js/editor/editor-detail-ui.js', 'js/viewer/public-viewer-detail-ui.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-detail-ui.js', 'js/viewer/public-viewer-detail-channel-link.js');
});
