const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const publicTreeAdapter = fs.readFileSync(path.join(ROOT, 'js/api/public-tree-adapter.js'), 'utf8');
const searchDataAdapter = fs.readFileSync(path.join(ROOT, 'js/search/search-data-adapter.js'), 'utf8');
const myTreesCardVisuals = fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-card-visuals.js'), 'utf8');
const searchHtml = fs.readFileSync(path.join(ROOT, 'pages/search.html'), 'utf8');
const myTreesHtml = fs.readFileSync(path.join(ROOT, 'pages/my-trees.html'), 'utf8');

test('public adapter exposes canonical YouTube thumbnail helper', () => {
  assert.match(publicTreeAdapter, /function\s+canonicalizeYouTubeThumbnailUrl/);
  assert.match(publicTreeAdapter, /buildCanonicalYouTubeThumbnailUrl/);
  assert.match(publicTreeAdapter, /i\.ytimg\.com\/vi/);
  assert.match(publicTreeAdapter, /hqdefault\.jpg/);
});

test('Browse adapter canonicalizes memory and representative thumbnails', () => {
  assert.match(searchDataAdapter, /LoveTreePublicTreeAdapter/);
  assert.match(searchDataAdapter, /canonicalizeYouTubeThumbnailUrl/);
  assert.match(searchDataAdapter, /thumbnail\s*=\s*canonicalizeThumbnailUrl/);
  assert.match(searchDataAdapter, /representativeThumbnail:\s*representativeMedia\.thumbnail/);
  assert.match(searchDataAdapter, /representativeSourceUrl:\s*representativeMedia\.sourceUrl/);
});

test('My LoveTree cards canonicalize representative thumbnails through the shared adapter', () => {
  assert.match(myTreesCardVisuals, /LoveTreePublicTreeAdapter/);
  assert.match(myTreesCardVisuals, /canonicalizeYouTubeThumbnailUrl/);
  assert.match(myTreesCardVisuals, /getRepresentativeThumbnail/);
  assert.match(myTreesCardVisuals, /getFirstMemory/);
});

test('My LoveTree loads public-tree adapter before card visuals', () => {
  const adapterIndex = myTreesHtml.indexOf('js/api/public-tree-adapter.js');
  const cardVisualsIndex = myTreesHtml.indexOf('js/my-trees/my-trees-card-visuals.js');
  assert.ok(adapterIndex > -1, 'my-trees page should load public-tree-adapter.js');
  assert.ok(cardVisualsIndex > -1, 'my-trees page should load my-trees-card-visuals.js');
  assert.ok(adapterIndex < cardVisualsIndex, 'public adapter must load before my trees card visuals');
});

test('changed thumbnail runtime files are cache-busted', () => {
  assert.match(searchHtml, /js\/search\/search-data-adapter\.js\?v=20260616-2534-1/);
  assert.match(myTreesHtml, /js\/my-trees\/my-trees-card-visuals\.js\?v=20260719-3578-1/);
});
