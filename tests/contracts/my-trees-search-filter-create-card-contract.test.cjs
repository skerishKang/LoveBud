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

// ── i18n key-leak guard tests ──────────────────────────────────────────────

test('12. my-trees-ui.js exports getI18nText helper on LoveBudMyTreesUI', () => {
  const source = read('js/my-trees/my-trees-ui.js');
  // Minimal browser globals needed to execute the module
  const context = {
    window: {},
    document: { getElementById: () => null, createElement: () => ({ style: {}, classList: { add: () => {} }, dataset: {}, setAttribute: () => {}, addEventListener: () => {}, innerHTML: '', appendChild: () => {}, querySelector: () => null }) },
    IntersectionObserver: function() { return { observe: () => {} }; }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const ui = context.window.LoveBudMyTreesUI;
  assert.ok(ui, 'LoveBudMyTreesUI must be exported');
  assert.strictEqual(typeof ui.getI18nText, 'function', 'getI18nText must be a function on LoveBudMyTreesUI');
});

test('13. getI18nText returns fallback when i18n echoes the key', () => {
  const source = read('js/my-trees/my-trees-ui.js');
  const context = {
    window: {},
    document: { getElementById: () => null, createElement: () => ({ style: {}, classList: { add: () => {} }, dataset: {}, setAttribute: () => {}, addEventListener: () => {}, innerHTML: '', appendChild: () => {}, querySelector: () => null }) },
    IntersectionObserver: function() { return { observe: () => {} }; }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const { getI18nText } = context.window.LoveBudMyTreesUI;

  // When i18n returns the key itself (key-echo), fallback must be used
  const echoI18n = (k) => k;
  assert.strictEqual(getI18nText(echoI18n, 'myTrees.card_edit', '편집하기'), '편집하기',
    'Must return fallback when i18n returns the key string');
  assert.strictEqual(getI18nText(echoI18n, 'myTrees.card_view', '감상하기'), '감상하기',
    'Must return fallback when i18n returns the key string');

  // When i18n returns a proper translation, use it
  const realI18n = (k) => k === 'myTrees.card_edit' ? '수정' : k;
  assert.strictEqual(getI18nText(realI18n, 'myTrees.card_edit', '편집하기'), '수정',
    'Must return translated value when i18n returns a real translation');

  // When i18n is not a function, fallback must be used
  assert.strictEqual(getI18nText(null, 'myTrees.card_edit', '편집하기'), '편집하기',
    'Must return fallback when i18n is null');
});

test('14. my-trees-ui.js source does not use bare (i18n(key) || fallback) for card_edit or card_view', () => {
  const source = read('js/my-trees/my-trees-ui.js');
  // The old pattern that could leak keys
  assert.ok(
    !source.includes("i18n('myTrees.card_edit') ||"),
    'Should not use bare (i18n(key) || fallback) for card_edit'
  );
  assert.ok(
    !source.includes("i18n('myTrees.card_view') ||"),
    'Should not use bare (i18n(key) || fallback) for card_view'
  );
});

test('15. my-trees-card-visuals.js exports getI18nText helper and implements key-echo fallback', () => {
  const source = read('js/my-trees/my-trees-card-visuals.js');
  const context = {
    window: {},
    document: { getElementById: () => null, createElement: () => ({ style: {}, classList: { add: () => {} }, dataset: {}, setAttribute: () => {}, addEventListener: () => {}, innerHTML: '', appendChild: () => {}, querySelector: () => null }) }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const visuals = context.window.LoveBudMyTreesCardVisuals;
  assert.ok(visuals, 'LoveBudMyTreesCardVisuals must be exported');
  assert.strictEqual(typeof visuals.getI18nText, 'function', 'getI18nText must be a function on LoveBudMyTreesCardVisuals');

  const { getI18nText } = visuals;
  const echoI18n = (k) => k;
  assert.strictEqual(getI18nText(echoI18n, 'myTrees.card_growing', '차곡차곡 자라는 중'), '차곡차곡 자라는 중',
    'Must return fallback when i18n returns the key string');
});

test('16. my-trees-card-visuals.js does not use bare (i18n(key) || fallback) for growing, waiting, or moment_count_compact', () => {
  const source = read('js/my-trees/my-trees-card-visuals.js');
  assert.ok(!source.includes("i18n('myTrees.card_growing') ||"), 'No bare i18n call for card_growing');
  assert.ok(!source.includes("i18n('myTrees.card_waiting') ||"), 'No bare i18n call for card_waiting');
  assert.ok(!source.includes("i18n('myTrees.moment_count_compact') ||"), 'No bare i18n call for moment_count_compact');
});

test('17. buildTreeThumbVisual delegation path resolves key-echo i18n with safe fallbacks and no raw keys in HTML', () => {
  const source = read('js/my-trees/my-trees-card-visuals.js');
  const context = {
    window: {},
    document: { getElementById: () => null, createElement: () => ({ style: {}, classList: { add: () => {} }, dataset: {}, setAttribute: () => {}, addEventListener: () => {}, innerHTML: '', appendChild: () => {}, querySelector: () => null }) }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const { buildTreeThumbVisual } = context.window.LoveBudMyTreesCardVisuals;

  const mockTree = { id: 'test-tree', title: 'My Test Tree', memoryCount: 3 };
  const echoI18n = (k) => k;

  const html = buildTreeThumbVisual(mockTree, echoI18n);

  // Check that raw keys are NOT in the returned HTML
  assert.ok(!html.includes('myTrees.card_growing'), 'HTML must not leak raw key: card_growing');
  assert.ok(!html.includes('myTrees.moment_count_compact'), 'HTML must not leak raw key: moment_count_compact');

  // Check that correct Korean fallbacks are used
  assert.ok(html.includes('차곡차곡 자라는 중'), 'HTML must contain fallback text: 차곡차곡 자라는 중');
  assert.ok(html.includes('순간 3개'), 'HTML must contain formatted fallback text: 순간 3개');
});
