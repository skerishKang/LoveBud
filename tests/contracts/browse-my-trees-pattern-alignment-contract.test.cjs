/**
 * LoveBud — Browse vs My Trees Card Pattern Alignment Contract
 * Issue #3578 Phase 2
 *
 * Verifies both Browse (search) and My Trees renderers use the shared
 * LoveBudTreeCardComposition API and emit the same shared class structure.
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

function loadComposition() {
  var ctx = { window: {}, console: {} };
  vm.createContext(ctx);
  vm.runInContext(read('js/shared/tree-card-metrics.js'), ctx);
  vm.runInContext(read('js/shared/tree-card-composition.js'), ctx);
  return ctx.window.LoveBudTreeCardComposition;
}

test('G1. both surfaces share the same composition module', function() {
  var c = loadComposition();
  assert.equal(typeof c.composeTreeCardModel, 'function');
  assert.equal(typeof c.renderTreeCardBody, 'function');
});

test('G2. browse model uses surface=browse and my-trees uses surface=my-trees', function() {
  var c = loadComposition();
  var b = c.composeTreeCardModel({ id: 't1', viewCount: 5 }, { surface: 'browse', href: 'view.html?treeId=t1', title: 'B', description: 'D' });
  var m = c.composeTreeCardModel({ id: 't1', viewCount: 5 }, { surface: 'my-trees', href: 'editor?treeId=t1', title: 'B', description: 'D' });
  assert.equal(b.surface, 'browse');
  assert.equal(m.surface, 'my-trees');
});

test('G3. browse visibilityMode defaults to omit', function() {
  var c = loadComposition();
  var b = c.composeTreeCardModel({ id: 't1' }, { surface: 'browse', href: '#', title: 'T', description: 'D' });
  assert.equal(b.visibilityMode, 'omit');
});

test('G4. my-trees visibilityMode icon emits visibility slot', function() {
  var c = loadComposition();
  var m = c.composeTreeCardModel({ id: 't1' }, { surface: 'my-trees', href: '#', title: 'T', description: 'D', visibilityMode: 'icon' });
  var html = c.renderTreeCardBody(m, {});
  assert.ok(html.includes('tree-card-visibility'), 'my-trees should include visibility slot');
});

test('G5. browse body does NOT include visibility slot', function() {
  var c = loadComposition();
  var b = c.composeTreeCardModel({ id: 't1' }, { surface: 'browse', href: '#', title: 'T', description: 'D', visibilityMode: 'omit' });
  var html = c.renderTreeCardBody(b, {});
  assert.equal(html.includes('tree-card-visibility'), false);
});

test('G6. both emit shared class structure', function() {
  var c = loadComposition();
  var b = c.composeTreeCardModel({ id: 't1', viewCount: 3 }, { surface: 'browse', href: '#', title: 'T', description: 'D' });
  var m = c.composeTreeCardModel({ id: 't1', viewCount: 3 }, { surface: 'my-trees', href: '#', title: 'T', description: 'D', visibilityMode: 'icon' });
  var hb = c.renderTreeCardBody(b, {});
  var hm = c.renderTreeCardBody(m, {});
  var sharedClasses = ['tree-card-body', 'tree-card-title', 'tree-card-subcopy', 'tree-meta-row', 'tree-card-reaction-metrics', 'tree-card-reaction-metric', 'tree-card-open-link'];
  sharedClasses.forEach(function(cls) {
    assert.ok(hb.includes(cls), 'browse missing ' + cls);
    assert.ok(hm.includes(cls), 'my-trees missing ' + cls);
  });
});

test('G7. metric order is identical (views first)', function() {
  var c = loadComposition();
  var tree = { viewCount: 10, likeCount: 2, commentCount: 1, shareCount: 0 };
  var b = c.composeTreeCardModel(tree, { surface: 'browse', href: '#', title: 'T', description: 'D' });
  var m = c.composeTreeCardModel(tree, { surface: 'my-trees', href: '#', title: 'T', description: 'D', visibilityMode: 'icon' });
  var kb = b.metrics.map(function(x) { return x.key; });
  var km = m.metrics.map(function(x) { return x.key; });
  assert.deepEqual(kb, km);
  assert.equal(kb[0], 'views');
});

test('G8. CTA label differs by surface', function() {
  var c = loadComposition();
  var b = c.composeTreeCardModel({ id: 't1' }, { surface: 'browse', href: '#', title: 'T', description: 'D' });
  var m = c.composeTreeCardModel({ id: 't1' }, { surface: 'my-trees', href: '#', title: 'T', description: 'D' });
  var hb = c.renderTreeCardBody(b, {});
  var hm = c.renderTreeCardBody(m, {});
  assert.ok(hb.includes('트리 열기'));
  assert.ok(hm.includes('감상하기'));
});

test('G9. href is preserved per surface (browse=view.html, my-trees=editor)', function() {
  var c = loadComposition();
  var b = c.composeTreeCardModel({ id: 't1' }, { surface: 'browse', href: 'view.html?treeId=t1', title: 'T', description: 'D' });
  var m = c.composeTreeCardModel({ id: 't1' }, { surface: 'my-trees', href: 'editor?treeId=t1', title: 'T', description: 'D', visibilityMode: 'icon' });
  assert.equal(b.href, 'view.html?treeId=t1');
  assert.equal(m.href, 'editor?treeId=t1');
});
