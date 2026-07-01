const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const metadataTextSource = fs.readFileSync('js/viewer/public-viewer-detail-metadata-text.js', 'utf8');
const detailUiSource = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

function getTitleBoundary() {
  const start = metadataTextSource.indexOf('function createPublicViewerCurrentMomentTitleBoundary(deps)');
  const end = metadataTextSource.indexOf('function updatePublicViewerCurrentMomentHint()');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return metadataTextSource.slice(start, end);
}

test('viewer title boundary is exposed', () => {
  assert.ok(metadataTextSource.includes('function createPublicViewerCurrentMomentTitleBoundary(deps)'));
  assert.ok(metadataTextSource.includes('createPublicViewerCurrentMomentTitleBoundary: createPublicViewerCurrentMomentTitleBoundary'));
  assert.ok(metadataTextSource.includes('detailCurrentMomentTitle'));
});

test('viewer title boundary clears with removeChild loop, not innerHTML', () => {
  const boundary = getTitleBoundary();

  assert.ok(boundary.includes('while (titleEl.firstChild)'));
  assert.ok(boundary.includes('titleEl.removeChild(titleEl.firstChild)'));
  assert.equal(boundary.includes("titleEl.innerHTML = '';"), false);
});

test('viewer title boundary creates memory-inline-edit container and writes via textContent', () => {
  const boundary = getTitleBoundary();

  assert.ok(boundary.includes("document.createElement('div')"));
  assert.ok(boundary.includes("document.createElement('span')"));
  assert.ok(boundary.includes("className = 'memory-inline-edit'"));
  assert.ok(boundary.includes('.textContent ='));
  assert.equal(boundary.includes('innerHTML'), false);
});

test('viewer title boundary does not wire editor inline edit', () => {
  const boundary = getTitleBoundary();

  assert.equal(boundary.includes('createTitleEditBoundary'), false);
  assert.equal(boundary.includes('updateSelectedMemoryFields'), false);
});

test('viewer title boundary runs after badge and before hint in updatePublicViewerDetailPanel', () => {
  const wrapperStart = detailUiSource.indexOf('detailUI.updateDetailPanel = function updatePublicViewerDetailPanel(data)');
  const badgeCall = detailUiSource.indexOf('updateCurrentMomentBadge(data);', wrapperStart);
  const titleCall = detailUiSource.indexOf('updateCurrentMomentTitle(data);', wrapperStart);
  const hintCall = detailUiSource.indexOf('metadataText.updatePublicViewerCurrentMomentHint();', wrapperStart);

  assert.notEqual(wrapperStart, -1);
  assert.notEqual(badgeCall, -1);
  assert.notEqual(titleCall, -1);
  assert.notEqual(hintCall, -1);
  assert.ok(badgeCall < titleCall);
  assert.ok(titleCall < hintCall);
});
