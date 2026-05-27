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

test('public viewer memo body boundary is called by detail wrapper', () => {
  assert.ok(source.includes('var updateMemoBody = createPublicViewerMemoBodyBoundary(deps)'));
  assert.ok(source.includes('updateMemoBody(data);'));
  assert.ok(source.indexOf('updatePublicViewerCurrentMomentDate(data);') < source.indexOf('updateMemoBody(data);'));
  assert.ok(source.indexOf('updateMemoBody(data);') < source.indexOf('updateCurrentMomentTags(data);'));
});
