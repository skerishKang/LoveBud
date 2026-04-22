const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('detail route alias exists in netlify.toml', () => {
  const toml = read('netlify.toml');
  assert.match(toml, /from\s*=\s*"\/detail\.html"/);
  assert.match(toml, /to\s*=\s*"\/pages\/detail\.html"/);
});

test('search page navigation still targets detail.html alias path', () => {
  const previewRendererJs = read('js/search-preview-renderer.js');
  assert.match(previewRendererJs, /detail\.html\?id=/);
});
