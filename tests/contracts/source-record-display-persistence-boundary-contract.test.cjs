const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-source-record-display-persistence-boundary.md');
const doc = fs.readFileSync(DOC_PATH, 'utf8');

test('source records stay tree-scoped until explicit storage design', () => {
  assert.match(doc, /tree-scoped source records/);
  assert.match(doc, /Source recognition = frontend helper/);
  assert.match(doc, /Source display = tree-scoped source area or source card/);
  assert.match(doc, /Source persistence = deferred until an explicit schema\/API plan/);
});

test('source records are not default canvas moment cards', () => {
  assert.match(doc, /source records as default canvas `\.memory-node` cards/);
  assert.match(doc, /Source records are not moments/);
  assert.match(doc, /should not affect canvas edge routing/);
  assert.match(doc, /moment order/);
});

test('persistence boundary blocks schema and API work for now', () => {
  assert.match(doc, /Do not add DB\/API persistence/);
  assert.match(doc, /persisted source records/);
  assert.match(doc, /new DB tables or columns/);
  assert.match(doc, /API payload changes/);
  assert.match(doc, /account-global source libraries/);
});

test('moment linkage remains review-before-save and non-automatic', () => {
  assert.match(doc, /review-before-save/);
  assert.match(doc, /must not silently create a moment/);
  assert.match(doc, /create a tree edge/);
  assert.match(doc, /rethread the tree/);
  assert.match(doc, /connect existing moments/);
});

test('decision preserves guardrails from unrelated tracks', () => {
  assert.match(doc, /No YouTube API calls/);
  assert.match(doc, /No channel page fetches/);
  assert.match(doc, /No feed\/video list import/);
  assert.match(doc, /No Scout\/live\/provider work/);
  assert.match(doc, /No Browse\/Search or #1661 work/);
  assert.match(doc, /No rethread or arrange behavior work/);
  assert.match(doc, /No relationship graph or Obsidian-style link work/);
  assert.match(doc, /No #2465 closure/);
});
