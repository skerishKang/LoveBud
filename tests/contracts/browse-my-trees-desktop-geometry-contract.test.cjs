'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('1. Browse/My Trees outer shell grid uses same shared tokens', () => {
  const searchBase = read('css/search/search-base.css');
  const myTreesLayout = read('css/my-trees/my-trees-layout.css');

  // Both should use same shared page shell tokens
  assert.ok(searchBase.includes('var(--page-shell-max)'), 'search-base.css must use page-shell-max');
  assert.ok(myTreesLayout.includes('var(--page-shell-max)'), 'my-trees-layout.css must use page-shell-max');
  assert.ok(searchBase.includes('var(--page-pad-desktop)'), 'search-base.css must use page-pad-desktop');
  assert.ok(myTreesLayout.includes('var(--page-pad-desktop)'), 'my-trees-layout.css must use page-pad-desktop');
  assert.ok(searchBase.includes('var(--hero-gap)'), 'search-base.css must use hero-gap');
  assert.ok(myTreesLayout.includes('var(--hero-gap)'), 'my-trees-layout.css must use hero-gap');
});

test('2. My Trees HTML maintains shared hero/control classes', () => {
  const html = read('pages/my-trees.html');

  assert.ok(html.includes('class="search-panel-header my-trees-header-block"'), 'Must keep search-panel-header class');
  assert.ok(html.includes('class="search-panel-eyebrow my-trees-eyebrow page-hero-eyebrow shared-mobile-hero-eyebrow"'), 'Must keep eyebrow classes');
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

  // Results head margin-bottom aligned to Browse's 4px 0 18px
  assert.match(header, /\.my-trees-results-head\s*\{[^}]*margin:\s*4px\s+0\s+18px;?/, 'Results head margin must be 4px 0 18px');

  // Title row & controls alignments must be correct
  assert.match(header, /\.my-trees-results-title-row\s*\{[^}]*justify-content:\s*flex-start;/, 'Title row must justify-content: flex-start');
  assert.match(header, /\.my-trees-results-controls\s*\{[^}]*margin-left:\s*auto;[^}]*flex-wrap:\s*nowrap;/, 'Controls must use margin-left: auto and flex-wrap: nowrap');
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
