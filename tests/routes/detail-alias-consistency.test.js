const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('detail route alias exists in netlify.toml', (t) => {
  const tomlPath = path.join(ROOT, 'netlify.toml');
  if (!fs.existsSync(tomlPath)) {
    t.skip('netlify.toml not found');
    return;
  }
  const toml = read('netlify.toml');
  assert.match(toml, /from\s*=\s*"\/detail\.html"/);
  assert.match(toml, /to\s*=\s*"\/pages\/detail\.html"/);
});

test('search page navigation still targets detail.html alias path', () => {
  const previewRendererJs = read('js/search-preview-renderer.js');
  assert.match(previewRendererJs, /detail\.html\?id=/);
});

test('detail runtime submodules load after API client and before detail entrypoint', () => {
  const html = read('pages/detail.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
  const indexOf = (needle) => scripts.findIndex((src) => src.includes(needle));

  const postgresIndex = indexOf('../js/postgres-client.js');
  const detailEntrypointIndex = indexOf('../js/detail.js');
  const expectedModules = [
    '../js/detail/detail-utils.js',
    '../js/detail/detail-video.js',
    '../js/detail/detail-copy.js',
    '../js/detail/detail-render.js',
    '../js/detail/detail-connected.js',
    '../js/detail/detail-loader.js',
  ];
  const moduleIndexes = expectedModules.map(indexOf);

  assert.ok(postgresIndex >= 0);
  assert.ok(detailEntrypointIndex >= 0);
  assert.deepEqual(moduleIndexes, moduleIndexes.toSorted((a, b) => a - b));
  assert.ok(moduleIndexes.every((index) => index > postgresIndex));
  assert.ok(moduleIndexes.every((index) => index < detailEntrypointIndex));
});
