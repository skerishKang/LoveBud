const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('public viewer detail UI adapter exposes memo body boundary', () => {
  assert.ok(source.includes('function createPublicViewerMemoBodyBoundary(deps)'));
  assert.ok(source.includes('createPublicViewerMemoBodyBoundary: createPublicViewerMemoBodyBoundary'));
  assert.ok(source.includes("document.getElementById('detailMemo') || document.querySelector('.diary-note')"));
});

test('public viewer memo body boundary clears without innerHTML', () => {
  const start = source.indexOf('function createPublicViewerMemoBodyBoundary(deps)');
  const end = source.indexOf('function createPublicViewerCurrentMomentTagsBoundary(deps)');
  const boundary = source.slice(start, end);

  assert.notEqual(start, -1, 'memo body boundary exists');
  assert.notEqual(end, -1, 'tags boundary follows memo body boundary');
  assert.ok(boundary.includes('while (noteEl.firstChild)'));
  assert.ok(boundary.includes('noteEl.removeChild(noteEl.firstChild)'));
  assert.equal(boundary.includes('innerHTML'), false);
});

test('public viewer memo body boundary does not wire editor memo editing or hint markup', () => {
  const start = source.indexOf('function createPublicViewerMemoBodyBoundary(deps)');
  const end = source.indexOf('function createPublicViewerCurrentMomentTagsBoundary(deps)');
  const boundary = source.slice(start, end);

  assert.equal(boundary.includes('createMemoEditBoundary'), false);
  assert.equal(boundary.includes('updateSelectedMemoryFields'), false);
  assert.equal(boundary.includes('memoHint'), false);
});

test('public viewer memo body boundary post-processes delegated editor detail rendering', () => {
  const delegatedIndex = source.indexOf('delegatedUpdateDetailPanel(data);');
  const dateIndex = source.indexOf('updatePublicViewerCurrentMomentDate(data);');
  const memoIndex = source.indexOf('updateMemoBody(data);');
  const tagsIndex = source.indexOf('updateCurrentMomentTags(data);');
  const reactionsIndex = source.indexOf('updateReadOnlyReactionSummary(data);');

  assert.notEqual(delegatedIndex, -1, 'viewer wrapper delegates to editor detail rendering first');
  assert.notEqual(dateIndex, -1, 'viewer wrapper updates current moment date');
  assert.notEqual(memoIndex, -1, 'viewer wrapper updates memo body');
  assert.notEqual(tagsIndex, -1, 'viewer wrapper updates tags after memo body');
  assert.notEqual(reactionsIndex, -1, 'viewer wrapper updates read-only reactions after tags');
  assert.ok(delegatedIndex < memoIndex, 'memo body must run after delegated editor render to replace editor memo hint/edit output');
  assert.ok(dateIndex < memoIndex, 'date boundary should run before memo boundary');
  assert.ok(memoIndex < tagsIndex, 'memo boundary should run before tags boundary');
  assert.ok(tagsIndex < reactionsIndex, 'tags boundary should run before read-only reactions');
});
