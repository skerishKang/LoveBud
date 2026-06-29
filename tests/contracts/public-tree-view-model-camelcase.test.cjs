/**
 * Runtime tests: normalizeBrowseTreeRecord, normalizeBrowseMemoryRecord,
 * buildPublicTreeSummaryModels, and _normalizeBrowseViewCount.
 *
 * Restores original camelCase/snake_case schema contracts and adds
 * comprehensive viewCount three-state policy coverage.
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

function getInternals() {
  const sandbox = {
    window: {
      location: { hostname: 'localhost', search: '' },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      LoveBudRuntimeFlags: null,
      LoveTreeAuthPolicy: {
        endpointLikelyRequiresAuth: () => false,
        hasConfirmedAuthSession: () => false,
      },
      LoveTreeBaseApiFetch: {
        apiFetch: async () => [],
      },
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    console,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setTimeout,
    clearTimeout,
    URLSearchParams,
    URL,
  };
  const ctx = vm.createContext(sandbox);
  // postgres-client.js must run first to create __LoveBudApiClientInternals
  // (required by the original camelCase/snake_case record tests)
  const pgSrc = fs.readFileSync(path.join(ROOT, 'js/postgres-client.js'), 'utf8');
  vm.runInContext(pgSrc, ctx, { filename: 'postgres-client.js' });
  vm.runInContext(adapterSrc, ctx, { filename: 'public-tree-adapter.js' });
  return ctx;
}

function getAdapter() {
  return getInternals().window.LoveTreePublicTreeAdapter;
}

// ============================================================
// Original contract: camelCase tree record normalizer
// ============================================================

test('browse tree helper normalizes camelCase tree record', () => {
  const I = getInternals().window.__LoveBudApiClientInternals;
  const tree = I.normalizeBrowseTreeRecord({
    id: 't1',
    title: 'Tree',
    visibility: 'public',
    createdAt: '2026-04-20T00:00:00Z',
    ownerId: 'u1',
  });
  assert.equal(tree.id, 't1');
  assert.equal(tree.createdAt, '2026-04-20T00:00:00Z');
  assert.equal(tree.ownerId, 'u1');
});

// ============================================================
// Original contract: legacy wrapped snake_case memory record
// ============================================================

test('browse memory helper normalizes legacy wrapped snake_case record', () => {
  const I = getInternals().window.__LoveBudApiClientInternals;
  const memory = I.normalizeBrowseMemoryRecord({
    data: {
      id: 'm1',
      tree_id: 't1',
      created_at: '2026-04-20T00:00:00Z',
      emotion_tags: ['legacy'],
    }
  });
  assert.equal(memory.treeId, 't1');
  assert.equal(memory.createdAt, '2026-04-20T00:00:00Z');
  assert.deepEqual(memory.emotionTags, ['legacy']);
});

// ============================================================
// _normalizeBrowseViewCount — strict validation rules
// ============================================================

// --- ACCEPT ---

test('normalizeViewCount: camelCase positive', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: 3 }), 3);
});

test('normalizeViewCount: snake_case positive', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ view_count: 5 }), 5);
});

test('normalizeViewCount: camelCase takes priority', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: 7, view_count: 99 }), 7);
});

test('normalizeViewCount: persisted zero', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: 0 }), 0);
});

test('normalizeViewCount: numeric string zero', () => {
  // canonical decimal "0" is accepted
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '0' }), 0);
});

test('normalizeViewCount: numeric string positive', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '42' }), 42);
});

// --- REJECT ---

test('normalizeViewCount: missing field', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({}), undefined);
});

test('normalizeViewCount: explicit null', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: null }), undefined);
  assert.equal(a._normalizeBrowseViewCount({ view_count: null }), undefined);
});

test('normalizeViewCount: empty string', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '' }), undefined);
});

test('normalizeViewCount: whitespace string', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '  ' }), undefined);
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '\t\n' }), undefined);
});

test('normalizeViewCount: boolean true/false', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: true }), undefined);
  assert.equal(a._normalizeBrowseViewCount({ viewCount: false }), undefined);
});

test('normalizeViewCount: negative number', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: -1 }), undefined);
});

test('normalizeViewCount: fractional number', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: 3.14 }), undefined);
});

test('normalizeViewCount: fractional string', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '3.14' }), undefined);
});

test('normalizeViewCount: NaN', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: NaN }), undefined);
});

test('normalizeViewCount: Infinity', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount({ viewCount: Infinity }), undefined);
  assert.equal(a._normalizeBrowseViewCount({ viewCount: -Infinity }), undefined);
});

test('normalizeViewCount: array', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: [3] }), undefined);
});

test('normalizeViewCount: object', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: { n: 3 } }), undefined);
});

test('normalizeViewCount: unsafe integer (over MAX_SAFE_INTEGER)', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: Number.MAX_SAFE_INTEGER + 1 }), undefined);
});

test('normalizeViewCount: numeric string with leading zeros', () => {
  // "01" is not canonical decimal → reject
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '01' }), undefined);
});

test('normalizeViewCount: numeric string with leading plus', () => {
  assert.equal(getAdapter()._normalizeBrowseViewCount({ viewCount: '+3' }), undefined);
});

test('normalizeViewCount: raw=null/undefined', () => {
  const a = getAdapter();
  assert.equal(a._normalizeBrowseViewCount(null), undefined);
  assert.equal(a._normalizeBrowseViewCount(undefined), undefined);
});

// ============================================================
// normalizeBrowseTreeRecord — viewCount passthrough
// ============================================================

test('normalizeBrowseTreeRecord: preserves camelCase viewCount', () => {
  const r = getAdapter().normalizeBrowseTreeRecord({ id: 't1', visibility: 'public', viewCount: 3 });
  assert.equal(r.viewCount, 3);
});

test('normalizeBrowseTreeRecord: preserves snake_case view_count', () => {
  const r = getAdapter().normalizeBrowseTreeRecord({ id: 't1', visibility: 'public', view_count: 5 });
  assert.equal(r.viewCount, 5);
});

test('normalizeBrowseTreeRecord: persisted zero', () => {
  const r = getAdapter().normalizeBrowseTreeRecord({ id: 't1', visibility: 'public', viewCount: 0 });
  assert.equal(r.viewCount, 0);
});

test('normalizeBrowseTreeRecord: missing viewCount omitted', () => {
  const r = getAdapter().normalizeBrowseTreeRecord({ id: 't1', visibility: 'public' });
  assert.equal(r.viewCount, undefined);
});

test('normalizeBrowseTreeRecord: null viewCount omitted', () => {
  const r = getAdapter().normalizeBrowseTreeRecord({ id: 't1', visibility: 'public', viewCount: null });
  assert.equal(r.viewCount, undefined);
});

// ============================================================
// buildPublicTreeSummaryModels
// ============================================================

test('buildPublicTreeSummaryModels: positive/zero/missing three-state', () => {
  const a = getAdapter();
  const trees = [
    { id: 't1', visibility: 'public', viewCount: 3 },
    { id: 't2', visibility: 'public', viewCount: 0 },
    { id: 't3', visibility: 'public' },
  ];
  const r = a.buildPublicTreeSummaryModels(trees);
  assert.equal(r.length, 3);
  assert.equal(r[0].viewCount, 3);
  assert.equal(r[1].viewCount, 0);
  assert.equal(r[2].viewCount, undefined);
});

test('buildPublicTreeSummaryModels: private tree excluded', () => {
  const a = getAdapter();
  const r = a.buildPublicTreeSummaryModels([
    { id: 'pub', visibility: 'public', viewCount: 3 },
    { id: 'priv', visibility: 'private', viewCount: 5 },
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'pub');
  assert.equal(r[0].viewCount, 3);
});
