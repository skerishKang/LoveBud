/**
 * Runtime API chain test: viewCount flows through getPublicTrees.
 *
 * Loads adapter + postgres-client with a mock BaseApiFetch,
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

function createSandbox(mockFetch) {
  const sandbox = {
    window: {},
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    URLSearchParams: URLSearchParams,
    URL: URL,
    crypto: { randomUUID: () => 'mock-uuid' }
  };
  return sandbox;
}

function setupEnv(mockApiTrees) {
  const sandbox = {
    window: {},
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    URLSearchParams: URLSearchParams,
    URL: URL,
    crypto: { randomUUID: () => 'mock-uuid' }
  };

  // Mock BaseApiFetch.apiFetch
  sandbox.window.LoveTreeBaseApiFetch = {
    apiFetch: async (endpoint) => {
      if (endpoint.includes('/community/trees')) {
        return mockApiTrees;
      }
      return [];
    }
  };

  // Mock AuthPolicy
  sandbox.window.LoveTreeAuthPolicy = {
    endpointLikelyRequiresAuth: () => false,
    hasConfirmedAuthSession: () => false
  };

  const ctx = vm.createContext(sandbox);

  // Load adapter first
  vm.runInContext(adapterSrc, ctx, { filename: 'public-tree-adapter.js' });
  // Then load postgres-client
  vm.runInContext(pgClientSrc, ctx, { filename: 'postgres-client.js' });

  return ctx;
}

// ---------------------------------------------------------------------------
// getPublicTrees chain tests
// ---------------------------------------------------------------------------

test('api chain: camelCase viewCount preserved', async () => {
  const mockData = [
    { id: 't1', visibility: 'public', viewCount: 3, likeCount: 0 }
  ];
  const ctx = setupEnv(mockData);
  const result = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(result.length, 1);
  assert.equal(result[0].viewCount, 3);
  assert.equal(result[0].id, 't1');
});

test('api chain: persisted zero viewCount', async () => {
  const mockData = [
    { id: 't1', visibility: 'public', viewCount: 0, likeCount: 5 }
  ];
  const ctx = setupEnv(mockData);
  const result = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(result.length, 1);
  assert.equal(result[0].viewCount, 0);
});

test('api chain: missing viewCount undefined', async () => {
  const mockData = [
    { id: 't1', visibility: 'public', likeCount: 0 }
  ];
  const ctx = setupEnv(mockData);
  const result = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(result.length, 1);
  assert.equal(result[0].viewCount, undefined);
});

test('api chain: null viewCount undefined', async () => {
  const mockData = [
    { id: 't1', visibility: 'public', viewCount: null, likeCount: 0 }
  ];
  const ctx = setupEnv(mockData);
  const result = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(result.length, 1);
  assert.equal(result[0].viewCount, undefined);
});

test('api chain: private tree excluded', async () => {
  const mockData = [
    { id: 'pub', visibility: 'public', viewCount: 3 },
    { id: 'priv', visibility: 'private', viewCount: 5 }
  ];
  const ctx = setupEnv(mockData);
  const result = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'pub');
  assert.equal(result[0].viewCount, 3);
});

test('api chain: snake_case view_count normalized', async () => {
  const mockData = [
    { id: 't1', visibility: 'public', view_count: 7, likeCount: 0 }
  ];
  const ctx = setupEnv(mockData);
  const result = await ctx.window.apiClient.getPublicTrees({ view: 'summary' });
  assert.equal(result.length, 1);
  assert.equal(result[0].viewCount, 7);
});