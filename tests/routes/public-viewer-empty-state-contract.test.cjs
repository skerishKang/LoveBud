const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const detailUiSource = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('public viewer empty state is rendered without innerHTML', () => {
  const start = detailUiSource.indexOf('function createPublicViewerEmptyStateContent()');
  const end = detailUiSource.indexOf('function createPublicViewerCurrentMomentImageBoundary(deps)');
  const boundary = detailUiSource.slice(start, end);

  assert.notEqual(start, -1, 'empty state content builder exists');
  assert.notEqual(end, -1, 'image boundary follows empty state boundary');
  assert.equal(boundary.includes('innerHTML'), false, 'empty state boundary must not use innerHTML');
  assert.ok(boundary.includes("document.createElement('span')"), 'empty state creates icon element');
  assert.ok(boundary.includes("document.createElement('p')"), 'empty state creates text elements');
  assert.ok(boundary.includes('emptyState.appendChild(createPublicViewerEmptyStateContent())'), 'empty state appends DOM-built content');
  assert.ok(boundary.includes('textContent'), 'empty state assigns copy via textContent');
});
