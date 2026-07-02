'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('1. Browse/My Trees outer shell grid uses same shared tokens via lovetree-calm-two-column-shell single owner', () => {
  const shellCss = read('css/global/lovetree-calm-page-shell.css');
  const searchBase = read('css/search/search-base.css');
  const myTreesLayout = read('css/my-trees/my-trees-layout.css');

  // Shared shell is now the single owner of grid geometry
  assert.match(shellCss, /\.lovetree-calm-two-column-shell\s*\{[^}]*var\(--page-shell-max\)/, 'shared shell must use page-shell-max');
  assert.match(shellCss, /\.lovetree-calm-two-column-shell\s*\{[^}]*var\(--hero-gap\)/, 'shared shell must use hero-gap');

  // Page-specific files still reference page-pad tokens for padding
  assert.ok(searchBase.includes('var(--page-pad-desktop)'), 'search-base.css must use page-pad-desktop');
  assert.ok(myTreesLayout.includes('var(--page-pad-desktop)'), 'my-trees-layout.css must use page-pad-desktop');
});

test('2. My Trees HTML maintains shared hero/control classes', () => {
  const html = read('pages/my-trees.html');

  assert.ok(html.includes('class="search-panel-header"'), 'Must keep search-panel-header class');
  assert.ok(html.includes('class="search-panel-eyebrow page-hero-eyebrow shared-mobile-hero-eyebrow"'), 'Must keep eyebrow classes');
  assert.ok(html.includes('class="headline shared-mobile-hero-title"'), 'Must keep headline class');
  assert.ok(html.includes('class="browse-utility-row my-trees-finder lovetree-calm-utility-row reveal-up"'), 'Must keep browse-utility-row class');
  assert.ok(html.includes('class="search-input-wrapper my-trees-search-box"'), 'Must keep search-input-wrapper class');
  assert.ok(html.includes('class="search-input my-trees-search-input"'), 'Must keep search-input class');
  assert.ok(html.includes('class="filter-row my-trees-filter-chips"'), 'Must keep filter-row class');
});

test('3. My Trees desktop selectors do not introduce conflicting geometry styles', () => {
  const header = read('css/my-trees/my-trees-header.css');

  // Eyebrow margin-bottom is aligned to Browse's 14px
  assert.match(header, /\.my-trees-eyebrow\s*\{[^}]*margin-bottom:\s*14px;?/, 'Eyebrow margin-bottom must be 14px');

  // Results head margin aligned to Browse's 0 0 16px (#2892)
  assert.match(header, /\.my-trees-results-head\s*\{[^}]*margin:\s*0\s+0\s+16px;?/, 'Results head margin must be 0 0 16px (#2892)');

  // Title row & controls alignments must be correct
  assert.match(header, /\.my-trees-results-controls\s*\{[^}]*flex-wrap:\s*nowrap;/, 'Controls must use flex-wrap: nowrap');
  // margin-left: auto is no longer needed — canonical slot order and title-slot flex handle desktop alignment
  // .my-trees-results-title-row is removed in Phase 2b
  assert.ok(!header.includes('.my-trees-results-title-row'), '.my-trees-results-title-row must be removed from my-trees-header.css');
});

test('4. Right rail geometry related selectors are not overridden', () => {
  const layout = read('css/my-trees/my-trees-layout.css');
  const header = read('css/my-trees/my-trees-header.css');

  // Check that right column has no overrides in my-trees-layout.css that alters width/flex
  assert.ok(!layout.includes('.lovetree-calm-secondary-column'), 'Should not override secondary column class');
  assert.ok(!header.includes('.lovetree-calm-secondary-column'), 'Should not override secondary column class');
});

test('5. Mobile media queries are not modified in layout', () => {
  const layout = read('css/my-trees/my-trees-layout.css');
  
  // Verify standard media queries are intact
  assert.ok(layout.includes('@media (max-width: 1024px)'), 'Tablet layout media query must be present');
  assert.ok(layout.includes('@media (max-width: 768px)'), 'Mobile layout media query must be present');
});

test('6. Stylesheets use the current My Trees controls cache key for busting', () => {
  const html = read('pages/my-trees.html');
  const css = read('css/my-trees.css');

  assert.match(
    html,
    /href="\.\.\/css\/my-trees\.css\?v=[^"'\s>]+"/,
    'my-trees.html must load my-trees.css with a non-empty cache-bust query'
  );
  assert.doesNotMatch(
    html,
    /href="\.\.\/css\/my-trees\.css\?v=20260622-title-row-1"/,
    'my-trees.html must not still pin the pre-#social-bar-path cache-bust 20260622-title-row-1 on my-trees.css'
  );

  assert.match(
    css,
    /my-trees-header\.css\?v=20260702-2710-shared-rhythm-1/,
    'my-trees.css must import my-trees-header.css with the current controls cache query'
  );
});
