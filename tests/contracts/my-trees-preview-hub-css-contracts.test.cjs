/**
 * LoveBud — My Trees / Preview Hub CSS Contract
 * Issue #3578 Phase 2
 *
 * Verifies shared CSS does not introduce broad global selectors or new
 * !important rules, and that the visibility slot class is scoped correctly.
 *
 * Primary: STATIC — regex/grep based on source
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const SHARED_CSS = path.join(ROOT, 'css/shared/love-tree-card-composition.css');
const BROWSE_CSS = path.join(ROOT, 'css/search/search-tree-card/content.css');
const MYTREES_CSS = path.join(ROOT, 'css/my-trees/my-trees-cards.css');

test('S1. shared CSS exists and defines tree-card-body', function() {
  var src = fs.readFileSync(SHARED_CSS, 'utf8');
  assert.ok(src.includes('.tree-card-body'));
  assert.ok(src.includes('.tree-card-title'));
  assert.ok(src.includes('.tree-card-subcopy'));
});

test('S2. shared CSS has no !important', function() {
  var src = fs.readFileSync(SHARED_CSS, 'utf8');
  assert.doesNotMatch(src, /!important/);
});

test('S3. shared CSS does not use broad universal selector', function() {
  var src = fs.readFileSync(SHARED_CSS, 'utf8');
  assert.doesNotMatch(src, /\*\s*\{/);
});

test('S4. browse CSS mirrors shared classes (no NEW !important added)', function() {
  var src = fs.readFileSync(BROWSE_CSS, 'utf8');
  assert.ok(src.includes('.tree-card-title'));
  assert.ok(src.includes('.tree-card-subcopy'));
  assert.ok(src.includes('.tree-meta-row'));
  assert.ok(src.includes('.tree-card-reaction-metric'));
  assert.ok(src.includes('.tree-card-open-link'));
  // pre-existing !important on line-clamp is allowed; no NEW !important on shared classes
  assert.doesNotMatch(src, /\.tree-card-(title|subcopy|meta-row|reaction-metric|open-link|visibility)\s*\{[^}]*!important/);
});

test('S5. browse visibility slot is hidden (no slot in browse)', function() {
  var src = fs.readFileSync(BROWSE_CSS, 'utf8');
  assert.ok(src.includes('.tree-card-visibility'));
  // browse keeps it display:none, not a visible badge
  assert.ok(/\.tree-card-visibility\s*\{[^}]*display:\s*none/.test(src));
});

test('S6. my-trees CSS keeps visible visibility badge', function() {
  var src = fs.readFileSync(MYTREES_CSS, 'utf8');
  assert.ok(src.includes('.tree-card-visibility'));
  // my-trees keeps it as inline-flex (visible), not display:none
  assert.ok(src.includes('display: inline-flex'));
});

test('S7. no broad global selector regression in browse CSS', function() {
  var src = fs.readFileSync(BROWSE_CSS, 'utf8');
  assert.doesNotMatch(src, /^\s*\*\s*\{/m);
});
