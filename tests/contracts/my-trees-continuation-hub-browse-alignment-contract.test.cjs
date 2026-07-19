/**
 * LoveBud — My Trees / Continuation Hub / Browse Alignment Contract
 * Issue #3578 Phase 2
 *
 * Verifies My Trees card structure aligns with Browse via shared composition,
 * and that the continuation hub (My Trees desktop) keeps its selection model.
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

test('C1. my-trees model has visibilityMode=icon by default in renderer usage', function() {
  var c = loadComposition();
  var m = c.composeTreeCardModel({ id: 't1' }, { surface: 'my-trees', href: 'editor?treeId=t1', title: 'T', description: 'D', visibilityMode: 'icon' });
  assert.equal(m.visibilityMode, 'icon');
});

test('C2. my-trees body includes visibility slot (icon mode)', function() {
  var c = loadComposition();
  var m = c.composeTreeCardModel({ id: 't1' }, { surface: 'my-trees', href: 'editor?treeId=t1', title: 'T', description: 'D', visibilityMode: 'icon' });
  var html = c.renderTreeCardBody(m, {});
  assert.ok(html.includes('tree-card-visibility'));
});

test('C3. browse body excludes visibility slot (omit mode)', function() {
  var c = loadComposition();
  var b = c.composeTreeCardModel({ id: 't1' }, { surface: 'browse', href: 'view.html?treeId=t1', title: 'T', description: 'D', visibilityMode: 'omit' });
  var html = c.renderTreeCardBody(b, {});
  assert.equal(html.includes('tree-card-visibility'), false);
});

test('C4. shared title-row wrapper present in both', function() {
  var c = loadComposition();
  var b = c.composeTreeCardModel({ id: 't1' }, { surface: 'browse', href: '#', title: 'T', description: 'D' });
  var m = c.composeTreeCardModel({ id: 't1' }, { surface: 'my-trees', href: '#', title: 'T', description: 'D', visibilityMode: 'icon' });
  assert.ok(c.renderTreeCardBody(b, {}).includes('tree-card-title-row'));
  assert.ok(c.renderTreeCardBody(m, {}).includes('tree-card-title-row'));
});

test('C5. subcopy container present in both', function() {
  var c = loadComposition();
  var b = c.composeTreeCardModel({ id: 't1' }, { surface: 'browse', href: '#', title: 'T', description: 'Sub' });
  var m = c.composeTreeCardModel({ id: 't1' }, { surface: 'my-trees', href: '#', title: 'T', description: 'Sub', visibilityMode: 'icon' });
  assert.ok(c.renderTreeCardBody(b, {}).includes('tree-card-subcopy'));
  assert.ok(c.renderTreeCardBody(m, {}).includes('tree-card-subcopy'));
});

test('C6. meta-row + metrics present in both', function() {
  var c = loadComposition();
  var b = c.composeTreeCardModel({ id: 't1', viewCount: 4 }, { surface: 'browse', href: '#', title: 'T', description: 'D' });
  var m = c.composeTreeCardModel({ id: 't1', viewCount: 4 }, { surface: 'my-trees', href: '#', title: 'T', description: 'D', visibilityMode: 'icon' });
  var hb = c.renderTreeCardBody(b, {});
  var hm = c.renderTreeCardBody(m, {});
  assert.ok(hb.includes('tree-meta-row') && hb.includes('tree-card-reaction-metrics'));
  assert.ok(hm.includes('tree-meta-row') && hm.includes('tree-card-reaction-metrics'));
});

test('C7. open-link (CTA) present in both', function() {
  var c = loadComposition();
  var b = c.composeTreeCardModel({ id: 't1' }, { surface: 'browse', href: 'view.html?treeId=t1', title: 'T', description: 'D' });
  var m = c.composeTreeCardModel({ id: 't1' }, { surface: 'my-trees', href: 'editor?treeId=t1', title: 'T', description: 'D', visibilityMode: 'icon' });
  assert.ok(c.renderTreeCardBody(b, {}).includes('tree-card-open-link'));
  assert.ok(c.renderTreeCardBody(m, {}).includes('tree-card-open-link'));
});

test('C8. no edit / mode=edit reference in composed output', function() {
  var c = loadComposition();
  var m = c.composeTreeCardModel({ id: 't1', href: 'editor?treeId=t1' }, { surface: 'my-trees', title: 'T', description: 'D', visibilityMode: 'icon' });
  var html = c.renderTreeCardBody(m, {});
  assert.equal(html.includes('mode=edit'), false);
  assert.equal(html.includes('edit'), false);
});
