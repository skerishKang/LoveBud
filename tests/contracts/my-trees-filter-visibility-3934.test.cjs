'use strict';

// Focused regression coverage for Issue #3934 My Trees visibility filter.
//
// Contract #5:
//   - public bucket:  tree.visibility === 'public'
//   - private bucket: tree.visibility === 'private'
//   - unresolved (NULL / missing / unknown / invalid) stays only in 'all';
//     it is excluded from BOTH the public and private buckets.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

function loadFilter() {
  const sandbox = { window: {}, document: {}, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'js/my-trees/my-trees-filter.js'), 'utf8'),
    sandbox
  );
  return sandbox.window.LoveBudMyTreesFilter;
}

const filter = loadFilter();

test('public bucket requires literal public (#3934)', () => {
  assert.equal(filter.treeMatchesFilter({ visibility: 'public' }, 'public'), true);
  assert.equal(filter.treeMatchesFilter({ visibility: 'private' }, 'public'), false);
  assert.equal(filter.treeMatchesFilter({ visibility: null }, 'public'), false);
  assert.equal(filter.treeMatchesFilter({}, 'public'), false);
});

test('private bucket requires literal private; unknown excluded (#3934)', () => {
  assert.equal(filter.treeMatchesFilter({ visibility: 'private' }, 'private'), true);
  assert.equal(filter.treeMatchesFilter({ visibility: 'public' }, 'private'), false);
  assert.equal(filter.treeMatchesFilter({ visibility: null }, 'private'), false);
  assert.equal(filter.treeMatchesFilter({}, 'private'), false);
});

test('unresolved visibility remains only in all bucket (#3934)', () => {
  const unknown = { visibility: null };
  assert.equal(filter.treeMatchesFilter(unknown, 'all'), true);
  assert.equal(filter.treeMatchesFilter(unknown, 'public'), false);
  assert.equal(filter.treeMatchesFilter(unknown, 'private'), false);

  const missing = {};
  assert.equal(filter.treeMatchesFilter(missing, 'all'), true);
  assert.equal(filter.treeMatchesFilter(missing, 'public'), false);
  assert.equal(filter.treeMatchesFilter(missing, 'private'), false);
});

test('explicit public and private trees keep their buckets (#3934)', () => {
  assert.equal(filter.treeMatchesFilter({ visibility: 'public' }, 'public'), true);
  assert.equal(filter.treeMatchesFilter({ visibility: 'public' }, 'private'), false);
  assert.equal(filter.treeMatchesFilter({ visibility: 'private' }, 'private'), true);
  assert.equal(filter.treeMatchesFilter({ visibility: 'private' }, 'public'), false);
});
