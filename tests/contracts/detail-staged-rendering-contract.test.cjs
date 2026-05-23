const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('detail loader renders current memory before tree and connected fetches settle', () => {
  const src = read('js/detail/detail-loader.js');
  const memoryMissingIndex = src.indexOf('if (!memory) {');
  const stagedRenderIndex = src.indexOf('renderMemoryBase(memory);');
  const loadPromisesIndex = src.indexOf('const loadPromises = [];');
  const awaitTreeContextIndex = src.indexOf('await Promise.all(loadPromises)');

  assert.ok(memoryMissingIndex >= 0, 'loader must keep missing memory boundary');
  assert.ok(stagedRenderIndex > memoryMissingIndex, 'current memory should render only after missing memory guard');
  assert.ok(loadPromisesIndex > stagedRenderIndex, 'tree/connected fetch setup should happen after staged current render');
  assert.ok(awaitTreeContextIndex > stagedRenderIndex, 'current memory render must not wait for tree/connected fetches');
});

test('detail page exposes explicit initial media loading state', () => {
  const html = read('pages/detail.html');
  const css = read('css/detail/components.css');

  assert.match(html, /class="detail-media-loading"/);
  assert.match(html, /대표 장면을 준비하고 있어요/);
  assert.match(css, /\.detail-media-loading/);
  assert.doesNotMatch(html, /type="module"/);
});

test('detail connected flow has a separate staged loading state', () => {
  const loader = read('js/detail/detail-loader.js');
  const connected = read('js/detail/detail-connected.js');
  const copy = read('js/detail/detail-copy.js');

  assert.match(loader, /stagedDegradedReason = hasTreeContext \? 'context-loading' : 'missing-tree-id'/);
  assert.match(connected, /degradedReason === 'context-loading'/);
  assert.match(copy, /isContextLoading/);
});

test('browse detail context uses public tree detail read path', () => {
  const loader = read('js/detail/detail-loader.js');
  const client = read('js/postgres-client.js');

  assert.match(client, /getPublicTree:\s*async \(treeId\) => BaseApiFetch\.apiFetch\(`\/trees\/\$\{treeId\}`,\s*\{ publicRead: true \}\)/);
  assert.match(loader, /sourceContext === 'browse' && window\.apiClient\.getPublicTree/);
  assert.match(loader, /window\.apiClient\.getPublicTree\(canonicalTreeId\)/);
  assert.match(loader, /window\.apiClient\.getTree\(canonicalTreeId\)/);
});
