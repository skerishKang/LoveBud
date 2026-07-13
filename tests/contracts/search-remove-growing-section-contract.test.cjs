const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const searchHtml = fs.readFileSync(path.join(ROOT, 'pages/search.html'), 'utf8');
const searchIndex = fs.readFileSync(path.join(ROOT, 'js/search/index.js'), 'utf8');
const searchData = fs.readFileSync(path.join(ROOT, 'js/search/search-data.js'), 'utf8');

test('Browse page omits the secondary growing LoveTree section', () => {
  assert.equal(searchHtml.includes('growingTreesSection'), false);
  assert.equal(searchHtml.includes('growingTreesList'), false);
  assert.equal(searchHtml.includes('search.growingTreesTitle'), false);
  assert.equal(searchHtml.includes('새로 자라는 러브트리'), false);
});

test('Search runtime uses only the primary Browse feed', () => {
  assert.equal(searchIndex.includes('loadGrowingTrees'), false);
  assert.equal(searchIndex.includes('renderGrowingResults'), false);
  assert.equal(searchIndex.includes('renderGrowingLoading'), false);
  assert.equal(searchIndex.includes('renderGrowingError'), false);
  assert.equal(searchIndex.includes('growingTrees'), false);
  assert.equal(searchIndex.includes('loadPublicTrees({ resetSelection: true })'), true);
});

test('Search data module does not request the growing-trees endpoint', () => {
  assert.equal(searchData.includes('/community/growing-trees'), false);
  assert.equal(searchData.includes('loadGrowingTrees'), false);
  assert.equal(searchData.includes('loadPublicTrees'), true);
});

test('Search page cache-busts runtime modules per actual change range', () => {
  assert.equal(searchHtml.includes('js/search/search-data.js?v=20260616-2539-1'), true);
  assert.equal(searchHtml.includes('js/search/index.js?v=20260713-3482-2'), true);
});
