/**
 * Runtime API chain test: viewCount flows through getPublicTrees.
 *
 * Loads adapter + postgres-client with mock BaseApiFetch,
 * then calls window.apiClient.getPublicTrees() with controlled data.
 */
'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { test } = require('node:test');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const adapterSrc = fs.readFileSync(path.join(ROOT, 'js/api/public-tree-adapter.js'), 'utf8');
const pgClientSrc = fs.readFileSync(path.join(ROOT, 'js/postgres-client.js'), 'utf8');

function setupEnv(mockApiTrees) {
  const sandbox = {
    window: {
      location: { hostname: 'localhost', search: '' },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      LoveBudRuntimeFlags: null,
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    URL,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
  };
  sandbox.window.LoveTreeBaseApiFetch = {
    apiFetch: async (endpoint) => {
      if (endpoint.includes('/community/trees')) return mockApiTrees;
      return [];
    }
  };
  sandbox.window.LoveTreeAuthPolicy = {
    endpointLikelyRequiresAuth: () => false,
    hasConfirmedAuthSession: () => false,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(adapterSrc, ctx, { filename: 'public-tree-adapter.js' });
  vm.runInContext(pgClientSrc, ctx, { filename: 'postgres-client.js' });
  return ctx;
}

test('api chain: camelCase positive viewCount preserved', async () => {
  const ctx = setupEnv([{ id: 't1', visibility: 'public', viewCount: 3 }]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r[0].viewCount, 3);
});

test('api chain: persisted zero', async () => {
  const ctx = setupEnv([{ id: 't1', visibility: 'public', viewCount: 0 }]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r[0].viewCount, 0);
});

test('api chain: missing viewCount undefined', async () => {
  const ctx = setupEnv([{ id: 't1', visibility: 'public' }]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r[0].viewCount, undefined);
});

test('api chain: null viewCount undefined', async () => {
  const ctx = setupEnv([{ id: 't1', visibility: 'public', viewCount: null }]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r[0].viewCount, undefined);
});

test('api chain: private tree excluded', async () => {
  const ctx = setupEnv([
    { id: 'pub', visibility: 'public', viewCount: 3 },
    { id: 'priv', visibility: 'private', viewCount: 5 },
  ]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'pub');
});

test('api chain: invalid boolean does not produce synthetic 0', async () => {
  const ctx = setupEnv([{ id: 't1', visibility: 'public', viewCount: true }]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r[0].viewCount, undefined);
});

test('api chain: whitespace string does not produce synthetic 0', async () => {
  const ctx = setupEnv([{ id: 't1', visibility: 'public', viewCount: '  ' }]);
  const r = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(r[0].viewCount, undefined);
});
