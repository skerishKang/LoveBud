const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('viewer title helper is exposed', () => {
  assert.ok(source.includes('function createPublicViewerCurrentMomentTitleBoundary(deps)'));
  assert.ok(source.includes('createPublicViewerCurrentMomentTitleBoundary: createPublicViewerCurrentMomentTitleBoundary'));
  assert.ok(source.includes('detailCurrentMomentTitle'));
});

test('viewer title helper clears title without innerHTML', () => {
  assert.ok(source.includes('while (titleEl.firstChild)'));
  assert.ok(source.includes('titleEl.removeChild(titleEl.firstChild)'));
  assert.ok(!source.includes("titleEl.innerHTML = '';"));
});

test('viewer title helper does not wire editor inline edit', () => {
  const start = source.indexOf('function createPublicViewerCurrentMomentTitleBoundary(deps)');
  const end = source.indexOf('function updatePublicViewerCurrentMomentHint()');
  const boundary = source.slice(start, end);

  assert.ok(!boundary.includes('createTitleEditBoundary'));
  assert.ok(!boundary.includes('updateSelectedMemoryFields'));
  assert.ok(boundary.includes('memory-inline-edit'));
});

test('viewer title helper is called by detail wrapper', () => {
  assert.ok(source.includes('var updateCurrentMomentTitle = createPublicViewerCurrentMomentTitleBoundary(deps)'));
  assert.ok(source.includes('updateCurrentMomentBadge(data);'));
  assert.ok(source.includes('updateCurrentMomentTitle(data);'));
  assert.ok(source.indexOf('updateCurrentMomentBadge(data);') < source.indexOf('updateCurrentMomentTitle(data);'));
});
