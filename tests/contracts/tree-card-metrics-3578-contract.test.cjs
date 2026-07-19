/**
 * LoveBud — Tree Card Metrics helper contract
 * Issue #3578 Phase 1
 *
 * Verifies the shared tree-card-metrics.js helper implements the
 * three-state metric semantics:
 *   - finite 0         → render as '0'
 *   - finite positive  → compact formatted string
 *   - null/undefined/absent/non-finite → omit (never coerce to 0)
 *
 * Order: views → likes → comments → shares
 *
 * Primary: EXECUTED_FAKE — runs helper in node:vm
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function loadMetrics() {
  var ctx = { window: {}, console: { warn: function() {}, log: function() {} } };
  vm.createContext(ctx);
  vm.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  return ctx.window.LoveBudTreeCardMetrics;
}

/* ── API surface ── */

test('A1. LoveBudTreeCardMetrics is an object', function() {
  var m = loadMetrics();
  assert.equal(typeof m, 'object');
});

test('A2. getFirstFiniteCount is a function', function() {
  var m = loadMetrics();
  assert.equal(typeof m.getFirstFiniteCount, 'function');
});

test('A3. getTreeMetrics is a function', function() {
  var m = loadMetrics();
  assert.equal(typeof m.getTreeMetrics, 'function');
});

test('A4. formatCompactCount is a function', function() {
  var m = loadMetrics();
  assert.equal(typeof m.formatCompactCount, 'function');
});

/* ── Three-state: 0 → rendered, positive → compact, absent → omit ── */

test('B1. getFirstFiniteCount: finite 0 returns 0 (not null)', function() {
  var m = loadMetrics();
  var result = m.getFirstFiniteCount({ views: 0 }, ['views']);
  assert.equal(result, 0);
});

test('B2. getFirstFiniteCount: finite positive returns the value', function() {
  var m = loadMetrics();
  assert.equal(m.getFirstFiniteCount({ views: 42 }, ['views']), 42);
  assert.equal(m.getFirstFiniteCount({ views: 1000 }, ['views']), 1000);
});

test('B3. getFirstFiniteCount: absent key returns null', function() {
  var m = loadMetrics();
  assert.equal(m.getFirstFiniteCount({}, ['views']), null);
  assert.equal(m.getFirstFiniteCount({ likes: 5 }, ['views']), null);
});

test('B4. getFirstFiniteCount: null/undefined/empty string returns null', function() {
  var m = loadMetrics();
  assert.equal(m.getFirstFiniteCount({ views: null }, ['views']), null);
  assert.equal(m.getFirstFiniteCount({ views: undefined }, ['views']), null);
  assert.equal(m.getFirstFiniteCount({ views: '' }, ['views']), null);
});

test('B5. getFirstFiniteCount: NaN returns null', function() {
  var m = loadMetrics();
  assert.equal(m.getFirstFiniteCount({ views: NaN }, ['views']), null);
});

test('B6. getFirstFiniteCount: negative returns null', function() {
  var m = loadMetrics();
  assert.equal(m.getFirstFiniteCount({ views: -1 }, ['views']), null);
  assert.equal(m.getFirstFiniteCount({ views: -100 }, ['views']), null);
});

test('B7. getFirstFiniteCount: Infinity returns null', function() {
  var m = loadMetrics();
  assert.equal(m.getFirstFiniteCount({ views: Infinity }, ['views']), null);
  assert.equal(m.getFirstFiniteCount({ views: -Infinity }, ['views']), null);
});

test('B8. getFirstFiniteCount: string number "0" returns 0', function() {
  var m = loadMetrics();
  assert.equal(m.getFirstFiniteCount({ views: '0' }, ['views']), 0);
  assert.equal(m.getFirstFiniteCount({ views: '42' }, ['views']), 42);
});

/* ── formatCompactCount ── */

test('C1. formatCompactCount: 0 → "0"', function() {
  var m = loadMetrics();
  assert.equal(m.formatCompactCount(0), '0');
});

test('C2. formatCompactCount: finite positive → compact', function() {
  var m = loadMetrics();
  assert.equal(m.formatCompactCount(999), '999');
  assert.equal(m.formatCompactCount(1000), '1K');
  assert.equal(m.formatCompactCount(1500), '1.5K');
  assert.equal(m.formatCompactCount(999999), '999.9K');
  assert.equal(m.formatCompactCount(1000000), '1M');
  assert.equal(m.formatCompactCount(3500000), '3.5M');
});

test('C3. formatCompactCount: null → "0" (not ""), undefined → ""', function() {
  var m = loadMetrics();
  assert.equal(m.formatCompactCount(null), '0', 'Number(null)===0, so returns "0"');
  assert.equal(m.formatCompactCount(undefined), '');
});

test('C4. formatCompactCount: NaN/Infinity/negative → ""', function() {
  var m = loadMetrics();
  assert.equal(m.formatCompactCount(NaN), '');
  assert.equal(m.formatCompactCount(Infinity), '');
  assert.equal(m.formatCompactCount(-Infinity), '');
  assert.equal(m.formatCompactCount(-1), '');
});

/* ── getTreeMetrics ── */

test('D1. getTreeMetrics: returns views/likes/comments/shares keys', function() {
  var m = loadMetrics();
  var result = m.getTreeMetrics({ id: 't1' });
  assert.equal(typeof result, 'object');
  assert.ok('views' in result);
  assert.ok('likes' in result);
  assert.ok('comments' in result);
  assert.ok('shares' in result);
});

test('D2. getTreeMetrics: absent tree → all null', function() {
  var m = loadMetrics();
  var result = m.getTreeMetrics(null);
  assert.equal(result.views, null);
  assert.equal(result.likes, null);
  assert.equal(result.comments, null);
  assert.equal(result.shares, null);
});

test('D3. getTreeMetrics: canonical field names resolved', function() {
  var m = loadMetrics();
  var tree = {
    viewCount: 10,
    likeCount: 20,
    commentCount: 30,
    shareCount: 40
  };
  var result = m.getTreeMetrics(tree);
  assert.equal(result.views, 10);
  assert.equal(result.likes, 20);
  assert.equal(result.comments, 30);
  assert.equal(result.shares, 40);
});

test('D4. getTreeMetrics: canonical priority (viewCount before views)', function() {
  var m = loadMetrics();
  // VIEW_COUNT_KEYS: viewCount comes BEFORE views, so first finite wins
  var tree = {
    views: 1,
    viewCount: 2,
    viewsCount: 3
  };
  var result = m.getTreeMetrics(tree);
  assert.equal(result.views, 2, 'viewCount wins (priority over views)');
});

test('D5. getTreeMetrics: 0 is authoritative (not null)', function() {
  var m = loadMetrics();
  var tree = {
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0
  };
  var result = m.getTreeMetrics(tree);
  assert.equal(result.views, 0);
  assert.equal(result.likes, 0);
  assert.equal(result.comments, 0);
  assert.equal(result.shares, 0);
});

test('D6. getTreeMetrics: mixed — present=finite, absent=null', function() {
  var m = loadMetrics();
  var tree = {
    viewCount: 100,
    likeCount: 0,      // authoritative 0
    commentCount: null, // null is absent
    // shareCount: absent
  };
  var result = m.getTreeMetrics(tree);
  assert.equal(result.views, 100);
  assert.equal(result.likes, 0);
  assert.equal(result.comments, null);
  assert.equal(result.shares, null);
});

test('D7. getTreeMetrics: non-finite fields are omitted', function() {
  var m = loadMetrics();
  var tree = {
    viewCount: NaN,
    likeCount: Infinity,
    commentCount: -100
  };
  var result = m.getTreeMetrics(tree);
  assert.equal(result.views, null);
  assert.equal(result.likes, null);
  assert.equal(result.comments, null);
  assert.equal(result.shares, null);
});

/* ── Order: views → likes → comments → shares ── */

test('E1. getTreeMetrics key order is views/likes/comments/shares', function() {
  var m = loadMetrics();
  var tree = { viewCount: 1, likeCount: 2, commentCount: 3, shareCount: 4 };
  var result = m.getTreeMetrics(tree);
  var keys = Object.keys(result);
  assert.deepEqual(keys, ['views', 'likes', 'comments', 'shares']);
});

/* ── Static boundary ── */

test('F1. helper has no DOM dependency', function() {
  var src = read('js/shared/tree-card-metrics.js');
  assert.doesNotMatch(src, /\bdocument\b/);
  assert.doesNotMatch(src, /\bquerySelector\b/);
  assert.doesNotMatch(src, /\bwindow\.location\b/);
  assert.doesNotMatch(src, /\bnavigator\b/);
});

test('F2. helper is self-contained (no import)', function() {
  var src = read('js/shared/tree-card-metrics.js');
  assert.doesNotMatch(src, /require\s*\(/);
  assert.doesNotMatch(src, /^import\s+/m);
});