'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('1. tokens.css has --lovetree-results-sort-control-inline-size: 112px', () => {
  const tokens = read('css/global/tokens.css');
  assert.match(tokens, /--lovetree-results-sort-control-inline-size:\s*112px;/,
    'tokens.css must have --lovetree-results-sort-control-inline-size: 112px');
});

test('2. .browse-sort-select uses --lovetree-results-sort-control-inline-size token', () => {
  const controls = read('css/search/search-controls.css');
  assert.match(controls, /\.browse-sort-select\s*{[^}]*inline-size:\s*var\(--lovetree-results-sort-control-inline-size\);[^}]*}/s,
    '.browse-sort-select must use inline-size: var(--lovetree-results-sort-control-inline-size)');
});

test('3. .summary-sort-control uses --lovetree-results-sort-control-inline-size token', () => {
  const header = read('css/my-trees/my-trees-header.css');
  assert.match(header, /\.summary-sort-control\s*{[^}]*inline-size:\s*var\(--lovetree-results-sort-control-inline-size\);[^}]*}/s,
    '.summary-sort-control must use inline-size: var(--lovetree-results-sort-control-inline-size)');
});

test('4. .browse-results-head has desktop margin: 0 0 16px', () => {
  const controls = read('css/search/search-controls.css');
  assert.match(controls, /\.browse-results-head\s*{[^}]*margin:\s*0\s+0\s+16px;[^}]*}/s,
    '.browse-results-head must have margin: 0 0 16px in desktop');
});

test('5. .my-trees-results-head has desktop margin: 0 0 16px', () => {
  const header = read('css/my-trees/my-trees-header.css');
  assert.match(header, /\.my-trees-results-head\s*{[^}]*margin:\s*0\s+0\s+16px;[^}]*}/s,
    '.my-trees-results-head must have margin: 0 0 16px in desktop');
});

test('6. margin: 4px 0 18px is not present in My Trees header CSS', () => {
  const header = read('css/my-trees/my-trees-header.css');
  assert.doesNotMatch(header, /\.my-trees-results-head[^}]*margin:\s*4px\s+0\s+18px;/,
    'My Trees header CSS must not have margin: 4px 0 18px override');
});

test('7. Browse mobile width: 100% rule is preserved', () => {
  const controls = read('css/search/search-controls.css');
  assert.match(controls, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.browse-sort-select[\s\S]*?width:\s*100%;/s,
    'Browse mobile .browse-sort-select width: 100% must be preserved');
});

test('8. My Trees mobile width: 100%, min-height: 40px, font-size: 13px rules are preserved', () => {
  const header = read('css/my-trees/my-trees-header.css');
  const mobileBlock = /@media\s*\(max-width:\s*768px\)[\s\S]*?\.my-trees-results-controls\s+\.summary-sort-control[\s\S]*?}/s.exec(header);
  assert.ok(mobileBlock, 'My Trees mobile .summary-sort-control block must exist');
  const block = mobileBlock[0];
  assert.match(block, /width:\s*100%;/, 'Mobile .summary-sort-control must have width: 100%');
  assert.match(block, /min-height:\s*40px;/, 'Mobile .summary-sort-control must have min-height: 40px');
  assert.match(block, /font-size:\s*13px;/, 'Mobile .summary-sort-control must have font-size: 13px');
});

test('9. Pages and JS files are not modified', () => {
  const searchHtml = read('pages/search.html');
  const myTreesHtml = read('pages/my-trees.html');
  assert.ok(searchHtml.includes('browse-utility-row'), 'search.html must still have browse-utility-row');
  assert.ok(myTreesHtml.includes('my-trees-finder'), 'my-trees.html must still have my-trees-finder');
});
