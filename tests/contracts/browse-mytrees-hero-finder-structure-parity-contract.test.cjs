'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('1. My Trees main-column section uses same static class structure as Browse', () => {
  const myTreesHtml = read('pages/my-trees.html');
  const searchHtml = read('pages/search.html');

  // Both should have the same base class for main column
  assert.match(myTreesHtml, /<section class="lovetree-calm-main-column">/, 'My Trees must use static lovetree-calm-main-column class without extra classes');
  assert.match(searchHtml, /<section class="lovetree-calm-main-column">/, 'Browse must use lovetree-calm-main-column class');

  // My Trees should NOT have my-trees-main-column, reveal-scale, or reveal-up on the section
  assert.doesNotMatch(myTreesHtml, /<section class="[^"]*my-trees-main-column[^"]*">/, 'My Trees section must not have my-trees-main-column class');
  assert.doesNotMatch(myTreesHtml, /<section class="[^"]*reveal-scale[^"]*">/, 'My Trees section must not have reveal-scale class');
  assert.doesNotMatch(myTreesHtml, /<section class="[^"]*reveal-up[^"]*">/, 'My Trees section must not have reveal-up class on main-column section');
});

test('2. My Trees hero title spans use only shared title-line and title-accent classes', () => {
  const myTreesHtml = read('pages/my-trees.html');

  // Must have title-line class
  assert.match(myTreesHtml, /<span class="title-line">내가 키운<\/span>/, 'First span must have title-line class');
  assert.match(myTreesHtml, /<span class="title-line title-accent">러브트리를<\/span>/, 'Second span must have title-line and title-accent classes');
  assert.match(myTreesHtml, /<span class="title-line">다시 열어보세요<\/span>/, 'Third span must have title-line class');

  // Must NOT have my-trees specific title classes
  assert.doesNotMatch(myTreesHtml, /my-trees-title-line/, 'Must not have my-trees-title-line class');
  assert.doesNotMatch(myTreesHtml, /my-trees-title-accent/, 'Must not have my-trees-title-accent class');
});

test('3. My Trees hero description uses shared search-panel-header p rule without duplicate desktop selector', () => {
  const myTreesHtml = read('pages/my-trees.html');
  const headerCss = read('css/my-trees/my-trees-header.css');

  // HTML must have the description p with id
  assert.match(myTreesHtml, /<p id="myTreesPageDesc">/, 'Must have myTreesPageDesc id');

  // CSS must NOT have duplicate desktop selector for this p
  assert.doesNotMatch(headerCss, /\.search-panel-header p#myTreesPageDesc/, 'Must not have duplicate desktop selector for search-panel-header p#myTreesPageDesc');
});

test('4. My Trees finder.css desktop base has no duplicate geometry declarations', () => {
  const finderCss = read('css/my-trees/my-trees-finder.css');

  // Must NOT have desktop base selectors for my-trees finder geometry
  assert.doesNotMatch(finderCss, /^\.my-trees-finder\s*{/m, 'Must not have .my-trees-finder base block in desktop');
  assert.doesNotMatch(finderCss, /^\.my-trees-search-box\s*{/m, 'Must not have .my-trees-search-box base block in desktop');
  assert.doesNotMatch(finderCss, /^\.my-trees-filter-chips\s*{/m, 'Must not have .my-trees-filter-chips base block in desktop');
  assert.doesNotMatch(finderCss, /^\.my-trees-filter-chip\s*{/m, 'Must not have .my-trees-filter-chip base block in desktop');
  assert.doesNotMatch(finderCss, /\.my-trees-filter-chip\.is-active\s*{/m, 'Must not have .my-trees-filter-chip.is-active base block in desktop');
});

test('5. My Trees HTML maintains shared class names for finder section', () => {
  const myTreesHtml = read('pages/my-trees.html');

  // Must use shared classes
  assert.match(myTreesHtml, /class="[^"]*browse-utility-row[^"]*"/, 'Must have browse-utility-row class on finder');
  assert.match(myTreesHtml, /class="[^"]*search-input-wrapper[^"]*"/, 'Must have search-input-wrapper class');
  assert.match(myTreesHtml, /class="[^"]*search-input[^"]*"/, 'Must have search-input class');
  assert.match(myTreesHtml, /class="[^"]*filter-row[^"]*"/, 'Must have filter-row class');
  assert.match(myTreesHtml, /class="[^"]*tag-chip[^"]*"/, 'Must have tag-chip class on filter chips');
});

test('6. My Trees preserves id attributes and button semantics', () => {
  const myTreesHtml = read('pages/my-trees.html');

  // Preserve important ids
  assert.match(myTreesHtml, /id="myTreesPageTitle"/, 'Must preserve myTreesPageTitle id');
  assert.match(myTreesHtml, /id="myTreesPageDesc"/, 'Must preserve myTreesPageDesc id');
  assert.match(myTreesHtml, /id="myTreesPageEyebrow"/, 'Must preserve myTreesPageEyebrow id');
  assert.match(myTreesHtml, /id="myTreesSearchInput"/, 'Must preserve myTreesSearchInput id');
  assert.match(myTreesHtml, /id="myTreesFilterChips"/, 'Must preserve myTreesFilterChips id');

  // Filter chips must be buttons
  assert.match(myTreesHtml, /<button[^>]*class="[^"]*my-trees-filter-chip[^"]*"[^>]*>/, 'Filter chips must be button elements');
});

test('7. My Trees CSS cache keys are updated for structure parity', () => {
  const myTreesHtml = read('pages/my-trees.html');
  const myTreesCss = read('css/my-trees.css');

  // Check HTML cache key
  assert.match(myTreesHtml, /href="\.\.\/css\/my-trees\.css\?v=20260625-2878-structure-1"/, 'my-trees.html must use v=20260625-2878-structure-1');

  // Check CSS import cache key
  assert.match(myTreesCss, /my-trees-header\.css\?v=20260625-2878-structure-1/, 'my-trees.css must import my-trees-header.css with v=20260625-2878-structure-1');
});

test('8. My Trees header CSS removes duplicate hero selectors', () => {
  const headerCss = read('css/my-trees/my-trees-header.css');

  // Must NOT have duplicate hero selectors
  assert.doesNotMatch(headerCss, /\.search-panel-eyebrow\.page-hero-eyebrow#myTreesPageEyebrow/, 'Must not have duplicate eyebrow selector');
  assert.doesNotMatch(headerCss, /\.my-trees-title-line/, 'Must not have .my-trees-title-line selector');
  assert.doesNotMatch(headerCss, /\.my-trees-title-accent/, 'Must not have .my-trees-title-accent selector');
  assert.doesNotMatch(headerCss, /\.my-trees-title-line:nth-child/, 'Must not have .my-trees-title-line:nth-child selector');
  assert.doesNotMatch(headerCss, /\.search-panel-header p#myTreesPageDesc/, 'Must not have duplicate p#myTreesPageDesc selector');
});

test('9. Search empty state styles are preserved in my-trees-finder.css', () => {
  const finderCss = read('css/my-trees/my-trees-finder.css');

  // Search empty state should still be there
  assert.match(finderCss, /\.my-trees-search-empty/, 'Must preserve my-trees-search-empty class');
  assert.match(finderCss, /\.search-empty-icon/, 'Must preserve search-empty-icon class');
  assert.match(finderCss, /\.search-empty-text/, 'Must preserve search-empty-text class');
  assert.match(finderCss, /\.search-empty-subtext/, 'Must preserve search-empty-subtext class');
});

test('10. My Trees results head and controls CSS is preserved', () => {
  const headerCss = read('css/my-trees/my-trees-header.css');

  // Results head styles should be preserved
  assert.match(headerCss, /\.my-trees-results-head/, 'Must preserve my-trees-results-head selector');
  assert.match(headerCss, /\.my-trees-results-title-row/, 'Must preserve my-trees-results-title-row selector');
  assert.match(headerCss, /\.my-trees-results-label/, 'Must preserve my-trees-results-label selector');
  assert.match(headerCss, /\.my-trees-results-controls/, 'Must preserve my-trees-results-controls selector');
  assert.match(headerCss, /\.btn-header-create/, 'Must preserve btn-header-create selector');
});
