const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/* ── 1. Browse CSS untouched ── */
test('1. Browse search-base.css two-column grid is intact', () => {
  const css = read('css/search/search-base.css');
  assert.match(css, /\.search-container/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /minmax\(360px,\s*400px\)/);
});

test('2. Browse search-controls.css browse-utility-row is intact', () => {
  const css = read('css/search/search-controls.css');
  assert.match(css, /\.browse-utility-row/);
});

test('3. Browse search-preview-sidebar/layout.css preview-sidebar sticky top unchanged', () => {
  const css = read('css/search/search-preview-sidebar/layout.css');
  assert.match(css, /\.preview-sidebar/);
  assert.match(css, /position:\s*sticky/);
  assert.match(css, /top:\s*133px/);
});

/* ── 2. My Trees two-column shell matches Browse rhythm ── */
test('4. my-trees-preview-hub/layout.css uses Browse-aligned two-column grid', () => {
  const css = read('css/my-trees/my-trees-preview-hub/layout.css');
  assert.match(css, /\.my-trees-with-hub/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /minmax\(360px,\s*400px\)/);
});

test('5. my-trees-preview-hub/layout.css hub panel sticky top is 133px (Browse parity)', () => {
  const css = read('css/my-trees/my-trees-preview-hub/layout.css');
  assert.match(css, /\.my-trees-hub-panel/);
  assert.match(css, /position:\s*sticky/);
  assert.match(css, /top:\s*133px/);
});

/* ── 3. My Trees layout shell has no duplicate grid shell ── */
test('6. my-trees-layout.css does NOT define .my-trees-dashboard-grid-shell', () => {
  const css = read('css/my-trees/my-trees-layout.css');
  assert.doesNotMatch(
    css,
    /\.my-trees-dashboard-grid-shell/,
    '.my-trees-dashboard-grid-shell must be removed from my-trees-layout.css'
  );
});

/* ── 4. Finder stays in left cell ── */
test('7. my-trees-finder.css has width:100% and max-width:100%', () => {
  const css = read('css/my-trees/my-trees-finder.css');
  assert.match(css, /\.my-trees-finder/);
  assert.match(css, /width:\s*100%/);
  assert.match(css, /max-width:\s*100%/);
});

/* ── 5. Mobile collapses to single column ── */
test('8. my-trees-preview-hub/responsive.css mobile collapses to 1fr single column', () => {
  const css = read('css/my-trees/my-trees-preview-hub/responsive.css');
  assert.match(css, /@media\s*\(max-width:\s*768px\)/);
  assert.match(css, /grid-template-columns:\s*1fr/);
});

/* ── 6. Browse files are untouched ── */
test('9. css/search/search-base.css is not modified beyond its original Browse-owned content', () => {
  const css = read('css/search/search-base.css');
  assert.doesNotMatch(css, /my-trees/, 'Browse search-base.css must not reference my-trees classes');
});

test('10. css/search/search-controls.css is not modified beyond its original Browse-owned content', () => {
  const css = read('css/search/search-controls.css');
  assert.doesNotMatch(css, /my-trees/, 'Browse search-controls.css must not reference my-trees classes');
});
