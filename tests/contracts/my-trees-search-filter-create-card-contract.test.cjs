const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('1. my-trees.html has finder elements', () => {
  const html = read('pages/my-trees.html');
  assert.ok(html.includes('id="myTreesSearchInput"'), 'myTreesSearchInput must exist');
  assert.ok(html.includes('id="myTreesFilterChips"'), 'myTreesFilterChips must exist');
});

test('2. my-trees.html search input placeholder check', () => {
  const html = read('pages/my-trees.html');
  assert.ok(html.includes('placeholder="\ub0b4 \ud2b8\ub9ac, \uc21c\uac04, \uba54\ubaa8\ub85c \ucc3e\uc544\ubcf4\uae30"'), 'placeholder text must match');
});

test('3. my-trees.html filter chips data-filter values check', () => {
  const html = read('pages/my-trees.html');
  const filterChipsMatch = html.match(/data-filter="([^"]+)"/g);
  assert.ok(filterChipsMatch, 'Should find data-filter attributes');
  const allowedFilters = ['all', 'public', 'private', 'has-moments', 'empty'];
  for (const match of filterChipsMatch) {
    const val = match.match(/data-filter="([^"]+)"/)[1];
    assert.ok(allowedFilters.includes(val), `Filter ${val} must be one of the allowed filters`);
  }
});

test('4. my-trees-filter.js exports window.LoveBudMyTreesFilter', () => {
  const source = read('js/my-trees/my-trees-filter.js');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  const filter = context.window.LoveBudMyTreesFilter;
  assert.ok(filter, 'window.LoveBudMyTreesFilter must be exported');
  assert.ok(typeof filter.applyFilters === 'function');
  assert.ok(typeof filter.bindFinderControls === 'function');
});

test('5 & 6 & 7. applyFilters searches title/representativeTitle/representativeMemo and applies filters with unknown filter fallback', () => {
  const source = read('js/my-trees/my-trees-filter.js');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  const filter = context.window.LoveBudMyTreesFilter;

  const mockTrees = [
    { id: '1', title: 'Spring Rain', visibility: 'public', memoryCount: 2 },
    { id: '2', title: 'Summer Breeze', visibility: 'private', memoryCount: 0, representativeTitle: 'First Step', representativeMemo: 'hot day memory' },
    { id: '3', title: 'Autumn Leaf', visibility: 'public', memoryCount: 0 },
    { id: '4', title: 'Winter Snow', visibility: 'private', memoryCount: 4, representativeTitle: 'cold day', representativeMemo: 'fun snowman' }
  ];

  const res1 = filter.applyFilters(mockTrees, { query: 'Spring' });
  assert.equal(res1.length, 1);
  assert.equal(res1[0].id, '1');

  const res2 = filter.applyFilters(mockTrees, { query: 'Step' });
  assert.equal(res2.length, 1);
  assert.equal(res2[0].id, '2');

  const res3 = filter.applyFilters(mockTrees, { query: 'snowman' });
  assert.equal(res3.length, 1);
  assert.equal(res3[0].id, '4');

  const resPublic = filter.applyFilters(mockTrees, { filter: 'public' });
  assert.equal(resPublic.length, 2);
  assert.ok(resPublic.every(t => t.visibility === 'public'));

  const resPrivate = filter.applyFilters(mockTrees, { filter: 'private' });
  assert.equal(resPrivate.length, 2);
  assert.ok(resPrivate.every(t => t.visibility === 'private'));

  const resHasMoments = filter.applyFilters(mockTrees, { filter: 'has-moments' });
  assert.equal(resHasMoments.length, 2);

  const resEmpty = filter.applyFilters(mockTrees, { filter: 'empty' });
  assert.equal(resEmpty.length, 2);

  const resUnknown = filter.applyFilters(mockTrees, { filter: 'unknown-filter-value' });
  assert.equal(resUnknown.length, 4);
});

test('8. my-trees.js uses finder controls, renderCurrentTrees', () => {
  const source = read('js/my-trees.js');
  assert.ok(source.includes('renderCurrentTrees()'), 'my-trees.js must have renderCurrentTrees function');
  assert.ok(source.includes('currentSearchQuery'), 'my-trees.js must have currentSearchQuery state');
  assert.ok(source.includes('currentFilter'), 'my-trees.js must have currentFilter state');
  assert.ok(source.includes('bindFinderControls'), 'my-trees.js must call bindFinderControls');
});

test('9 & 10. No DB/API/fetch changes or Scout/AI/provider related strings added', () => {
  const source = read('js/my-trees.js');
  const filterSource = read('js/my-trees/my-trees-filter.js');

  assert.doesNotMatch(filterSource, /fetch\s*\(/);
  assert.doesNotMatch(filterSource, /apiClient\./);
  assert.doesNotMatch(filterSource, /postgres/i);

  assert.doesNotMatch(filterSource, /scout/i);
  assert.doesNotMatch(filterSource, /aiSuggestion/i);
  assert.doesNotMatch(filterSource, /gpt/i);
  assert.doesNotMatch(filterSource, /gemini/i);
});

test('11. pages/my-trees.html has cache-bust link and script', () => {
  const html = read('pages/my-trees.html');
  assert.match(html, /my-trees\.css\?v=\d+/);
  assert.ok(!/my-trees-finder\.css\?v=/.test(html), 'pages/my-trees.html must NOT directly link my-trees-finder.css (bundle owns finder import)');
  assert.match(html, /my-trees-filter\.js\?v=\d+/);
});

test('12. my-trees-header.css mobile compact CTA rule exists and max-width is 160px or less', () => {
  const css = read('css/my-trees/my-trees-header.css');
  assert.match(
    css,
    /\.my-trees-results-title-row\s+\.btn-header-create/,
    '.my-trees-results-title-row .btn-header-create mobile rule must exist'
  );
  const maxWidthMatch = css.match(/\.my-trees-results-title-row\s+\.btn-header-create[\s\S]*?max-width:\s*(\d+)px/);
  assert.ok(maxWidthMatch, 'max-width px value must be present in the compact CTA rule');
  const maxWidthValue = parseInt(maxWidthMatch[1], 10);
  assert.ok(
    maxWidthValue <= 160,
    `max-width must be 160px or less for compact mobile CTA, got ${maxWidthValue}px`
  );
});

test('13. create CTA is in title row, not in results controls', () => {
  const html = read('pages/my-trees.html');
  const titleRowMatch = html.match(/my-trees-results-title-row[\s\S]*?btn-header-create/);
  const controlsMatch = html.match(/my-trees-results-controls[\s\S]*?btn-header-create/);
  assert.ok(titleRowMatch, 'btn-header-create must appear inside my-trees-results-title-row');
  assert.ok(!controlsMatch, 'btn-header-create must NOT appear inside my-trees-results-controls');
});

test('14. my-trees-header.css mobile view-mode-mount is shrink-to-fit (width auto / max-content / flex none)', () => {
  const css = read('css/my-trees/my-trees-header.css');
  // Rule must exist inside a <=768px media query
  const mobileBlock = css.match(/@media\s*\(max-width:\s*768px\)[\s\S]*?\{([\s\S]*?)\}\s*(?=@media|$)/);
  assert.ok(mobileBlock, '@media (max-width: 768px) block must exist');
  const block = mobileBlock[1];
  assert.match(
    block,
    /\.my-trees-view-mode-mount/,
    '.my-trees-view-mode-mount rule must be present inside mobile media block'
  );
  // At least one of: width:auto, max-width:max-content, flex:0 0 auto
  const hasAutoWidth = /\.my-trees-view-mode-mount[\s\S]*?width:\s*auto/.test(block);
  const hasMaxContent = /\.my-trees-view-mode-mount[\s\S]*?max-width:\s*max-content/.test(block);
  const hasFlexNone = /\.my-trees-view-mode-mount[\s\S]*?flex:\s*0\s+0\s+auto/.test(block);
  assert.ok(
    hasAutoWidth || hasMaxContent || hasFlexNone,
    '.my-trees-view-mode-mount mobile rule must include width:auto, max-width:max-content, or flex:0 0 auto'
  );
});
