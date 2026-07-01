'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { test } = require('node:test');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const normalizePath = path.join(ROOT, 'js/utils/normalize.js');
const normalizeSrc = fs.readFileSync(normalizePath, 'utf8');

function getNormalizer() {
  const sandbox = {
    window: {},
    console,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(normalizeSrc, ctx, { filename: 'normalize.js' });
  return ctx.window.LoveBudNormalize;
}

// ============================================================
// normalizeTree — groupName / keywords
// ============================================================

test('normalizeTree preserves canonical camelCase', () => {
  const N = getNormalizer();
  const tree = N.normalizeTree({
    id: 't1',
    ownerId: 'u1',
    title: 'My Tree',
    visibility: 'public',
    groupName: 'kpop',
    keywords: ['a', 'b'],
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    memoryCount: 3,
  });
  assert.equal(tree.groupName, 'kpop');
  assert.deepEqual(tree.keywords, ['a', 'b']);
});

test('normalizeTree accepts legacy snake_case', () => {
  const N = getNormalizer();
  const tree = N.normalizeTree({
    id: 't1',
    ownerId: 'u1',
    title: 'My Tree',
    visibility: 'public',
    group_name: 'kpop',
    keywords: ['a', 'b'],
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    memory_count: 3,
  });
  assert.equal(tree.groupName, 'kpop');
  assert.deepEqual(tree.keywords, ['a', 'b']);
});

test('normalizeTree blank groupName passthrough', () => {
  const N = getNormalizer();
  const tree = N.normalizeTree({
    id: 't1', ownerId: 'u1', title: 'T', visibility: 'public',
    groupName: '   ', memoryCount: 0,
  });
  // JS normalizer passes raw value through; server validates
  assert.equal(tree.groupName, '   ');
});

test('normalizeTree non-string groupName passthrough', () => {
  const N = getNormalizer();
  const tree = N.normalizeTree({
    id: 't1', ownerId: 'u1', title: 'T', visibility: 'public',
    groupName: 42, memoryCount: 0,
  });
  // JS normalizer passes raw value through; server validates
  assert.equal(tree.groupName, 42);
});

test('normalizeTree missing groupName -> null', () => {
  const N = getNormalizer();
  const tree = N.normalizeTree({
    id: 't1', ownerId: 'u1', title: 'T', visibility: 'public',
    memoryCount: 0,
  });
  assert.equal(tree.groupName, null);
});

test('normalizeTree missing keywords -> []', () => {
  const N = getNormalizer();
  const tree = N.normalizeTree({
    id: 't1', ownerId: 'u1', title: 'T', visibility: 'public',
    memoryCount: 0,
  });
  // missing keywords → [] via Array.isArray(undefined) fallback
  assert.equal(Array.isArray(tree.keywords), true);
  assert.equal(tree.keywords.length, 0);
});

test('normalizeTree non-array keywords -> []', () => {
  const N = getNormalizer();
  const tree = N.normalizeTree({
    id: 't1', ownerId: 'u1', title: 'T', visibility: 'public',
    keywords: 'string', memoryCount: 0,
  });
  // non-array keywords → [] via Array.isArray('string') fallback
  assert.equal(Array.isArray(tree.keywords), true);
  assert.equal(tree.keywords.length, 0);
});

test('normalizeTree array keywords preserves values', () => {
  const N = getNormalizer();
  const tree = N.normalizeTree({
    id: 't1', ownerId: 'u1', title: 'T', visibility: 'public',
    keywords: ['a', 'b', 'c'], memoryCount: 0,
  });
  assert.deepEqual(tree.keywords, ['a', 'b', 'c']);
});

test('normalizeTree JSON round-trip preserves groupName', () => {
  const N = getNormalizer();
  const input = { id: 't1', ownerId: 'u1', title: 'T', visibility: 'public',
    groupName: 'kpop', keywords: ['a', 'b'], memoryCount: 0 };
  const tree = N.normalizeTree(input);
  const round = JSON.parse(JSON.stringify(tree));
  assert.equal(round.groupName, 'kpop');
  assert.deepEqual(round.keywords, ['a', 'b']);
});

// ============================================================
// normalizeTreeList
// ============================================================

test('normalizeTreeList filters nulls', () => {
  const N = getNormalizer();
  const trees = [null, undefined, { id: 't1', ownerId: 'u1', title: 'T', visibility: 'public', memoryCount: 0 }];
  const result = N.normalizeTreeList(trees);
  assert.equal(result.length, 1);
});

// ============================================================
// normalizeTree — existing fields unchanged
// ============================================================

test('normalizeTree preserves existing fields', () => {
  const N = getNormalizer();
  const tree = N.normalizeTree({
    id: 't1', ownerId: 'u1', userId: 'u1', title: 'My Tree',
    visibility: 'public', createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z', memoryCount: 5,
    isArchived: false,
  });
  assert.equal(tree.id, 't1');
  assert.equal(tree.ownerId, 'u1');
  assert.equal(tree.userId, 'u1');
  assert.equal(tree.title, 'My Tree');
  assert.equal(tree.visibility, 'public');
  assert.equal(tree.memoryCount, 5);
  assert.equal(tree.isArchived, false);
});