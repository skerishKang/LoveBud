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
  assert.ok(html.includes('placeholder="내 트리, 순간, 메모로 찾아보기"'), 'placeholder text must match');
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

  // Test search query (title)
  const res1 = filter.applyFilters(mockTrees, { query: 'Spring' });
  assert.equal(res1.length, 1);
  assert.equal(res1[0].id, '1');

  // Test search query (representativeTitle)
  const res2 = filter.applyFilters(mockTrees, { query: 'Step' });
  assert.equal(res2.length, 1);
  assert.equal(res2[0].id, '2');

  // Test search query (representativeMemo)
  const res3 = filter.applyFilters(mockTrees, { query: 'snowman' });
  assert.equal(res3.length, 1);
  assert.equal(res3[0].id, '4');

  // Test public filter
  const resPublic = filter.applyFilters(mockTrees, { filter: 'public' });
  assert.equal(resPublic.length, 2);
  assert.ok(resPublic.every(t => t.visibility === 'public'));

  // Test private filter
  const resPrivate = filter.applyFilters(mockTrees, { filter: 'private' });
  assert.equal(resPrivate.length, 2);
  assert.ok(resPrivate.every(t => t.visibility === 'private'));

  // Test has-moments filter
  const resHasMoments = filter.applyFilters(mockTrees, { filter: 'has-moments' });
  assert.equal(resHasMoments.length, 2); // 1 and 4

  // Test empty filter
  const resEmpty = filter.applyFilters(mockTrees, { filter: 'empty' });
  assert.equal(resEmpty.length, 2); // 2 and 3

  // Test unknown filter fallback to all
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
  
  // No new fetch or api call logic
  assert.doesNotMatch(filterSource, /fetch\s*\(/);
  assert.doesNotMatch(filterSource, /apiClient\./);
  assert.doesNotMatch(filterSource, /postgres/i);
  
  // No Scout/AI strings
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
