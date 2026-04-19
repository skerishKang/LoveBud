const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('public tree adapter documents transitional fallback scope explicitly', () => {
  const src = read('js/api/public-tree-adapter.js');

  assert.match(src, /Transitional compatibility only for public browse paths/);
  assert.match(src, /legacy `\{ data \}` wrapper/);
  assert.match(src, /`tree_id`/);
  assert.match(src, /`created_at`/);
  assert.match(src, /`owner_id`/);
  assert.match(src, /`emotion_tags`/);
  assert.match(src, /New code outside this adapter must not directly read snake_case fields/);
});

test('snake_case and wrapper fallback stay isolated to the public tree adapter', () => {
  const searchHtml = read('pages/search.html');
  const searchJs = read('js/search.js');
  const searchDataAdapter = read('js/search-data-adapter.js');

  const forbiddenPatterns = [
    /tree_id/,
    /emotion_tags/,
    /created_at/,
    /owner_id/,
    /\.data\s*\|\|/,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(searchHtml, pattern);
    assert.doesNotMatch(searchJs, pattern);
    assert.doesNotMatch(searchDataAdapter, pattern);
  }
});