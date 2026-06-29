/**
 * Runtime tests: normalizeBrowseTreeRecord and buildPublicTreeSummaryModels
 * three-state viewCount behavior.
 *
 * Tests run the actual exported adapter functions via vm sandbox.
 */
'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { test } = require('node:test');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const adapterPath = path.join(ROOT, 'js/api/public-tree-adapter.js');
const adapterSrc = fs.readFileSync(adapterPath, 'utf8');

function createSandbox() {
  return {
    window: {},
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
}

function getAdapter() {
  const sandbox = createSandbox();
  const ctx = vm.createContext(sandbox);
  vm.runInContext(adapterSrc, ctx, { filename: 'public-tree-adapter.js' });
  return ctx.window.LoveTreePublicTreeAdapter;
}

// ---------------------------------------------------------------------------
// _normalizeBrowseViewCount unit tests
// ---------------------------------------------------------------------------

test('normalizeViewCount: camelCase positive', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: 3 }), 3);
});

test('normalizeViewCount: snake_case positive', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ view_count: 5 }), 5);
});

test('normalizeViewCount: camelCase takes priority over snake_case', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: 7, view_count: 99 }), 7);
});

test('normalizeViewCount: persisted zero', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: 0 }), 0);
});

test('normalizeViewCount: missing field', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({}), undefined);
});

test('normalizeViewCount: explicit null', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: null }), undefined);
  assert.equal(a._normalizeBrowseViewCount({ view_count: null }), undefined);
});

test('normalizeViewCount: empty string', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: '' }), undefined);
});

test('normalizeViewCount: negative number', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: -1 }), undefined);
});

test('normalizeViewCount: raw=null/undefined', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount(null), undefined);
  assert.equal(a._normalizeBrowseViewCount(undefined), undefined);
});

// ---------------------------------------------------------------------------
// normalizeBrowseTreeRecord tests
// ---------------------------------------------------------------------------

test('normalizeBrowseTreeRecord: preserves camelCase viewCount', () => {
  const a = getAdapter();
  const result = a.normalizeBrowseTreeRecord({ id: 't1', visibility: 'public', viewCount: 3 });
  assert.equal(result.viewCount, 3);
});

test('normalizeBrowseTreeRecord: preserves snake_case view_count', () => {
  const a = getAdapter();
  const result = a.normalizeBrowseTreeRecord({ id: 't1', visibility: 'public', view_count: 5 });
  assert.equal(result.viewCount, 5);
});

test('normalizeBrowseTreeRecord: persisted zero viewCount', () => {
  const a = getAdapter();
  const result = a.normalizeBrowseTreeRecord({ id: 't1', visibility: 'public', viewCount: 0 });
  assert.equal(result.viewCount, 0);
});

test('normalizeBrowseTreeRecord: missing viewCount omitted', () => {
  const a = getAdapter();
  const result = a.normalizeBrowseTreeRecord({ id: 't1', visibility: 'public' });
  assert.equal(result.viewCount, undefined);
});

test('normalizeBrowseTreeRecord: null viewCount omitted', () => {
  const a = getAdapter();
  const result = a.normalizeBrowseTreeRecord({ id: 't1', visibility: 'public', viewCount: null });
  assert.equal(result.viewCount, undefined);
});

// ---------------------------------------------------------------------------
// buildPublicTreeSummaryModels tests
// ---------------------------------------------------------------------------

test('buildPublicTreeSummaryModels: viewCount passes through', () => {
  const a = getAdapter();
  const trees = [
    { id: 't1', visibility: 'public', viewCount: 3 },
    { id: 't2', visibility: 'public', viewCount: 0 },
    { id: 't3', visibility: 'public' }  // missing
  ];
  const results = a.buildPublicTreeSummaryModels(trees);
  assert.equal(results.length, 3);
  assert.equal(results[0].viewCount, 3);
  assert.equal(results[1].viewCount, 0);
  assert.equal(results[2].viewCount, undefined);
});

test('buildPublicTreeSummaryModels: private tree excluded', () => {
  const a = getAdapter();
  const trees = [
    { id: 'pub', visibility: 'public', viewCount: 3 },
    { id: 'priv', visibility: 'private', viewCount: 5 }
  ];
  const results = a.buildPublicTreeSummaryModels(trees);
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'pub');
});
