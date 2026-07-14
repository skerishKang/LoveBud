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

test('public viewer detail adapter owns detail UI object shell', () => {
  const adapter = getDetailAdapterSlice();

  assert.ok(adapter.includes("var detailUI = {};"), 'public viewer adapter creates its own detail UI shell');
  assert.equal(adapter.includes('window.createEditorDetailUI(deps)'), false, 'public viewer adapter no longer constructs through editor detail factory');
  assert.equal(adapter.includes('delegatedUpdateDetailPanel(data);'), false, 'public viewer adapter no longer delegates detail panel rendering');
  assert.ok(source.includes('delegatesToEditorDetailUI: false'), 'public viewer adapter marks editor detail delegation as removed');
  assert.ok(adapter.includes('detailUI.updateDetailPanel = function updatePublicViewerDetailPanel(data)'), 'public viewer adapter owns the updateDetailPanel function');
});

test('public viewer detail adapter owns detail render flow from heading boundary', () => {
  const adapter = getDetailAdapterSlice();
  const headingCallRaw = adapter.indexOf('updateDetailHeading();');
  const realFlowSlice = adapter.slice(headingCallRaw);

  const headingCall = realFlowSlice.indexOf('updateDetailHeading();');
  const badgeCall = realFlowSlice.indexOf('updateCurrentMomentBadge(data);');
  const titleCall = realFlowSlice.indexOf('updateCurrentMomentTitle(data);');
  const hintCall = realFlowSlice.indexOf('updatePublicViewerCurrentMomentHint();');
  const imageCall = realFlowSlice.indexOf('updateCurrentMomentImage(data);');
  const dateCall = realFlowSlice.indexOf('updatePublicViewerCurrentMomentDate(data);');
  const memoCall = realFlowSlice.indexOf('updateMemoBody(data);');
  const tagsCall = realFlowSlice.indexOf('updateCurrentMomentTags(data);');
  const reactionsCall = realFlowSlice.indexOf('updateReadOnlyReactionSummary(data);');

  assert.equal(adapter.indexOf('delegatedUpdateDetailPanel(data);'), -1, 'adapter no longer delegates detail panel rendering');

  [headingCall, badgeCall, titleCall, hintCall, imageCall, dateCall, memoCall, tagsCall, reactionsCall]
    .forEach((index) => assert.notEqual(index, -1));

  assert.ok(headingCall < badgeCall);
  assert.ok(badgeCall < hintCall);
  assert.ok(hintCall < imageCall);
  assert.ok(imageCall < titleCall);
  assert.ok(imageCall < dateCall);
  assert.ok(dateCall < memoCall);
  assert.ok(memoCall < tagsCall);
  assert.ok(tagsCall < reactionsCall);
});

test('public viewer detail adapter loads after viewer helper scripts and before channel patch', () => {
  const scripts = getScriptSrcs();

  assert.equal(scriptIndex(scripts, 'js/editor/editor-detail-ui.js'), -1, 'public viewer no longer loads editor detail UI core script');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-detail-tree-meta.js', 'js/viewer/public-viewer-detail-ui.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-detail-builders.js', 'js/viewer/public-viewer-detail-ui.js');
  assertScriptOrder(scripts, 'js/viewer/public-viewer-detail-ui.js', 'js/viewer/public-viewer-detail-channel-link.js');
});
