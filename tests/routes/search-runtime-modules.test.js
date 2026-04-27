const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('search runtime submodules load after existing search helpers and before search entrypoint', () => {
  const html = read('pages/search.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
  const indexOf = (needle) => scripts.findIndex((src) => src.includes(needle));

  const previewRendererIndex = indexOf('../js/search-preview-renderer.js');
  const searchEntrypointIndex = indexOf('../js/search.js');
  const expectedModules = [
    '../js/search/search-preview-cache.js',
    '../js/search/search-ui.js',
    '../js/search/search-url-state.js',
  ];
  const moduleIndexes = expectedModules.map(indexOf);

  assert.ok(previewRendererIndex >= 0);
  assert.ok(searchEntrypointIndex >= 0);
  assert.deepEqual(moduleIndexes, moduleIndexes.toSorted((a, b) => a - b));
  assert.ok(moduleIndexes.every((index) => index > previewRendererIndex));
  assert.ok(moduleIndexes.every((index) => index < searchEntrypointIndex));
  assert.equal(html.includes('type="module"'), false);
});

test('search UI module preserves orchestrator contract methods', () => {
  const uiModule = read('js/search/search-ui.js');
  const requiredMethods = [
    'syncStaticBrowseCopy',
    'clearSelectedPreview',
    'markActiveCard',
    'setMobilePreviewOpen',
    'renderLoadErrorState',
    'ensureBrowseControls',
    'syncBrowseHead',
  ];

  for (const method of requiredMethods) {
    assert.match(uiModule, new RegExp(`\\b${method}\\b`));
  }
});
