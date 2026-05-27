const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('viewer timestamp boundary is text-only', () => {
  const start = source.indexOf('function updatePublicViewerCurrentMomentDate(data)');
  const end = source.indexOf('function createPublicViewerMemoBodyBoundary(deps)');
  const boundary = source.slice(start, end);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.ok(source.includes('updatePublicViewerCurrentMomentDate: updatePublicViewerCurrentMomentDate'));
  assert.ok(boundary.includes('detailDateText'));
  assert.ok(boundary.includes('dateEl.textContent'));
  assert.ok(boundary.includes('data && data.timestamp'));
  assert.equal(boundary.includes('innerHTML'), false);
});

test('viewer timestamp boundary order is stable', () => {
  const delegatedIndex = source.indexOf('delegatedUpdateDetailPanel(data);');
  const dateIndex = source.indexOf('updatePublicViewerCurrentMomentDate(data);');
  const memoIndex = source.indexOf('updateMemoBody(data);');
  const tagsIndex = source.indexOf('updateCurrentMomentTags(data);');

  assert.ok(delegatedIndex < dateIndex);
  assert.ok(dateIndex < memoIndex);
  assert.ok(dateIndex < tagsIndex);
});
