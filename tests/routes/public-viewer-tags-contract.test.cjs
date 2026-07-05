const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

function getTagsBoundary() {
  const start = source.indexOf('function createPublicViewerCurrentMomentTagsBoundary(deps)');
  const end = source.indexOf('function createPublicViewerDetailUI(deps)');
  assert.notEqual(start, -1, 'tags boundary function must be found');
  assert.notEqual(end, -1, 'detail UI function must be found as boundary end');
  return source.slice(start, end);
}

test('viewer tags boundary is exposed', () => {
  assert.ok(source.includes('function createPublicViewerCurrentMomentTagsBoundary(deps)'));
  assert.ok(source.includes('createPublicViewerCurrentMomentTagsBoundary: createPublicViewerCurrentMomentTagsBoundary'));
  assert.ok(source.includes('var updateCurrentMomentTags = createPublicViewerCurrentMomentTagsBoundary(deps)'));
  assert.ok(source.includes('updateCurrentMomentTags(data);'));
});

test('viewer tags boundary clears safely and writes text nodes', () => {
  const boundary = getTagsBoundary();

  assert.ok(boundary.includes('detailTags'));
  assert.ok(boundary.includes('while (tagsContainer.firstChild)'));
  assert.ok(boundary.includes('tagsContainer.removeChild(tagsContainer.firstChild)'));
  assert.equal(boundary.includes('innerHTML'), false);
  assert.ok(boundary.includes("document.createElement('span')"));
  assert.ok(boundary.includes("tagEl.className = 'tag tag-primary'"));
  assert.ok(boundary.includes('tagEl.textContent = tag'));
});

test('viewer tags boundary keeps fallback and builder paths', () => {
  const boundary = getTagsBoundary();

  assert.ok(boundary.includes('window.createEditorDetailUIBuilders'));
  assert.ok(boundary.includes('builders.getDisplayEmotionTags'));
  assert.ok(boundary.includes('createFallbackTags(data, options)'));
  assert.ok(boundary.includes('editor_root_emotion_tag'));
  assert.ok(boundary.includes("trimmed === '기록'"));
});

test('viewer tags boundary runs after memo and before reactions', () => {
  const headingCallRaw = source.indexOf('updateDetailHeading();');
  const realFlowSlice = source.slice(headingCallRaw);

  const memoIndex = realFlowSlice.indexOf('updateMemoBody(data);');
  const tagsIndex = realFlowSlice.indexOf('updateCurrentMomentTags(data);');
  const reactionsIndex = realFlowSlice.indexOf('updateReadOnlyReactionSummary(data);');

  assert.ok(memoIndex < tagsIndex);
  assert.ok(tagsIndex < reactionsIndex);
});
