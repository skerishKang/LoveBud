const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('public viewer empty state is rendered without innerHTML', () => {
  const start = source.indexOf('function createPublicViewerEmptyStateContent()');
  const end = source.indexOf('function createPublicViewerCurrentMomentBadgeBoundary(deps)');
  const boundary = source.slice(start, end);

  assert.notEqual(start, -1, 'empty state content builder exists');
  assert.notEqual(end, -1, 'badge boundary follows empty state boundary');
  assert.equal(boundary.includes('innerHTML'), false, 'empty state boundary must not use innerHTML');
  assert.ok(boundary.includes("document.createElement('span')"), 'empty state creates icon element');
  assert.ok(boundary.includes("document.createElement('p')"), 'empty state creates text elements');
  assert.ok(boundary.includes('emptyState.appendChild(createPublicViewerEmptyStateContent())'), 'empty state appends DOM-built content');
  assert.ok(boundary.includes('textContent'), 'empty state assigns copy via textContent');
});
