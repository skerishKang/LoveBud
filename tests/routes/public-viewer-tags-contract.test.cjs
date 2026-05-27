const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync('js/viewer/public-viewer-detail-ui.js', 'utf8');

test('viewer tags helper is exposed', () => {
  assert.ok(source.includes('function createPublicViewerCurrentMomentTagsBoundary(deps)'));
  assert.ok(source.includes('createPublicViewerCurrentMomentTagsBoundary: createPublicViewerCurrentMomentTagsBoundary'));
  assert.ok(source.includes('detailTags'));
  assert.ok(source.includes('createEditorDetailUIBuilders'));
});

test('viewer tags helper renders tag spans', () => {
  assert.ok(source.includes("tagEl.className = 'tag tag-primary'"));
  assert.ok(source.includes('tagEl.textContent = tag'));
  assert.ok(source.includes('tagsContainer.appendChild(tagEl)'));
});

test('viewer tags helper is called by detail wrapper', () => {
  assert.ok(source.includes('var updateCurrentMomentTags = createPublicViewerCurrentMomentTagsBoundary(deps)'));
  assert.ok(source.includes('updatePublicViewerCurrentMomentDate(data);'));
  assert.ok(source.includes('updateCurrentMomentTags(data);'));
});
