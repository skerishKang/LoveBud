'use strict';

/**
 * #4055 — Client Browse/preview caches must not outlive Tree/Memory visibility
 * revocation.
 *
 * Executes the real js/cache-utils.js and js/search/search-data.js modules in a
 * fake browser environment (memory + sessionStorage) and proves the six
 * revocation sequences deterministically:
 *
 *   Case A — Tree public -> private -> Browse must not render the cached Tree
 *   Case B — Memory public -> private -> preview must not return the old
 *            thumbnail/source projection
 *   Case C — Tree delete -> fresh Browse network failure must not restore the
 *            deleted Tree from cache
 *   Case D — sessionStorage stale copy must not resurrect after reload
 *   Case E — failed mutation must not falsely invalidate local cache state
 *   Case F — per-Tree invalidation preserves unrelated Tree cache entries
 *
 * No real network, no browser, no Production, no DB, no provider mutation.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const CACHE_UTILS_PATH = path.join(ROOT, 'js', 'cache-utils.js');
const SEARCH_DATA_PATH = path.join(ROOT, 'js', 'search', 'search-data.js');
const SEARCH_PREVIEW_CACHE_PATH = path.join(ROOT, 'js', 'search', 'search-preview-cache.js');

class FakeStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(index) { return Array.from(this.map.keys())[index] ?? null; }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
  clear() { this.map.clear(); }
}

function createCacheContext() {
  const sessionStorage = new FakeStorage();
  const window = {
    sessionStorage,
    loveBudCache: {},
    console
  };
  const context = vm.createContext({
    window,
    sessionStorage,
    console,
    Date,
    JSON,
    String,
    Object,
    Array
  });
  return { context, window, sessionStorage };
}

function runScript(context, filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  vm.runInContext(source, context, { filename: filePath });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flushAsync() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

// ── Case F + D: targeted per-Tree purge, sessionStorage resurrection ─────────

test('#4055 Case F+D: per-Tree public-projection purge preserves unrelated trees and blocks sessionStorage resurrection', () => {
  const env = createCacheContext();
  runScript(env.context, CACHE_UTILS_PATH);
  const cache = env.window.LoveBudCache;

  const treeA = { id: 'tree-a', title: 'Public A', thumbnail: 'https://cdn.test/a.jpg' };
  const treeB = { id: 'tree-b', title: 'Public B', thumbnail: 'https://cdn.test/b.jpg' };

  // Seed the browse list + preview caches (memory + sessionStorage)
  cache.set('public_trees_summary_latest_10_latest_10', [treeA, treeB], 5 * 60 * 1000);
  cache.set('public_tree_preview_tree-a', treeA, 5 * 60 * 1000);
  cache.set('public_tree_preview_tree-b', treeB, 5 * 60 * 1000);

  // Per-Tree revocation purge (what apiClient.clearCommunityCaches(treeId) does)
  cache.clearPublicTreeCaches('tree-a');

  // Case F: the revoked tree is gone from the browse list; the unrelated one stays.
  const browseAfter = cache.get('public_trees_summary_latest_10_latest_10');  assert.deepEqual(Array.from(browseAfter, (t) => String(t.id)),
    ['tree-b'],
    'Case F: unrelated Tree B survives the per-Tree purge'
  );
  assert.equal(cache.get('public_tree_preview_tree-a'), null, 'revoked Tree preview purged');
  assert.deepEqual(
    JSON.parse(JSON.stringify(cache.get('public_tree_preview_tree-b'))),
    treeB,
    'unrelated Tree preview survives'
  );

  // Case D: no stale lb_ sessionStorage copy remains for the revoked Tree.
  for (let i = 0; i < env.sessionStorage.length; i += 1) {
    const key = env.sessionStorage.key(i);
    assert.ok(!key.startsWith('lb_public_tree_preview_tree-a'), `sessionStorage resurrect key: ${key}`);
  }
  assert.ok(
    !env.sessionStorage.getItem('lb_public_trees_summary_latest_10_latest_10')
      .includes('tree-a'),
    'Case D: sessionStorage browse copy no longer contains the revoked Tree'
  );
  assert.ok(
    env.sessionStorage.getItem('lb_public_trees_summary_latest_10_latest_10')
      .includes('tree-b'),
    'unrelated Tree B still in sessionStorage'
  );
});

test('#4055 Case D: full public projection purge blocks browse + preview resurrection on reload', () => {
  const env = createCacheContext();
  runScript(env.context, CACHE_UTILS_PATH);
  const cache = env.window.LoveBudCache;

  cache.set('public_trees_summary_latest_10_latest_10', [{ id: 'tree-a', title: 'Public A' }], 5 * 60 * 1000);
  cache.set('public_tree_preview_tree-a', { id: 'tree-a', title: 'Public A' }, 5 * 60 * 1000);

  // Browse-wide revocation purge (used when no single treeId is known)
  cache.clearPublicBrowseCaches();

  assert.equal(cache.get('public_trees_summary_latest_10_latest_10'), null, 'browse list purged');
  assert.equal(cache.get('public_tree_preview_tree-a'), null, 'preview purged');

  // Reload simulation: a brand-new window reads only sessionStorage.
  const reloadEnv = createCacheContext();
  runScript(reloadEnv.context, CACHE_UTILS_PATH);
  assert.equal(
    reloadEnv.window.LoveBudCache.get('public_trees_summary_latest_10_latest_10'),
    null,
    'Case D: revoked public projection cannot be resurrected after reload'
  );
  assert.equal(
    reloadEnv.window.LoveBudCache.get('public_tree_preview_tree-a'),
    null,
    'Case D: revoked preview cannot be resurrected after reload'
  );
});

// ── Case A + C: Browse authority-first render + network-failure negative ─────

function createSearchDataEnv({ getPublicTrees, previewRendererSpy }) {
  const env = createCacheContext();
  runScript(env.context, CACHE_UTILS_PATH);
  runScript(env.context, SEARCH_PREVIEW_CACHE_PATH);
  runScript(env.context, SEARCH_DATA_PATH);

  const state = {
    allTrees: [],
    growingTrees: [],
    loadError: null,
    isFromCache: false,
    apiTreesLoaded: false,
    selectedTreeId: null,
    currentPreviewRequestId: 0,
    currentQuery: '',
    currentSort: 'latest',
    currentLimit: 10,
    currentCategory: '전체',
    isRestoringUrlState: false,
    urlStateReady: false,
    initialTreeDeepLinkApplied: false,
    currentLoadGen: 0,
    currentPublicTreeRequestId: 0,
    isLoadingMore: false,
    hasMoreTrees: false
  };

  const renderCalls = [];
  const ui = {
    syncBrowseHead() {},
    clearSelectedPreview() {},
    syncControlsFromState() {},
    getCurrentLocale() { return 'ko'; },
    renderPreviewLoadingState() {},
    syncPreviewVisibility() {}
  };
  const callbacks = {
    renderResults() { renderCalls.push(state.allTrees.map((t) => t.id)); }
  };
  const previewCache = new Map();
  const previewCacheApi = env.window.LoveBudSearchPreviewCache.createPreviewCache({
    cache: env.window.LoveBudCache,
    previewCache,
    previewCacheTtlMs: 5 * 60 * 1000,
    getPreviewCacheKey: (treeId) => `public_tree_preview_${treeId}`,
    state
  });
  const cache = env.window.LoveBudCache;

  env.window.apiClient = {
    getPublicTrees: getPublicTrees
      ? getPublicTrees
      : () => Promise.resolve([]),
    getPublicTreePreview: () => Promise.resolve(null)
  };

  const searchData = env.window.LoveBudSearchData.createSearchData({
    refs: {},
    state,
    previewCacheApi,
    ui,
    CardRenderer: {},
    PreviewRenderer: {
      updatePreview(preview) {
        if (previewRendererSpy) previewRendererSpy.push(preview);
      }
    },
    callbacks,
    cache,
    PUBLIC_TREES_CACHE_KEY: 'public_trees_summary_latest_10',
    PREVIEW_CACHE_TTL_MS: 5 * 60 * 1000,
    getPreviewCacheKey: (treeId) => `public_tree_preview_${treeId}`
  });

  return { env, window: env.window, state, cache, searchData, renderCalls, previewCacheApi, previewCache };
}

test('#4055 Case A: Browse is authority-first — a cached Tree revoked to private is not rendered before/after fresh authority', async () => {
  const staleTree = { id: 'tree-a', title: 'Public A' };
  const freshTrees = [{ id: 'tree-b', title: 'Public B' }];

  const env = createSearchDataEnv({
    getPublicTrees: () => Promise.resolve(freshTrees)
  });

  // Seed a stale cached browse list that still contains the revoked Tree.
  env.cache.set('public_trees_summary_latest_10_latest_10', [staleTree], 5 * 60 * 1000);

  await env.searchData.loadPublicTrees({ resetSelection: true });
  await flushAsync();

  assert.deepEqual(env.state.allTrees.map((t) => t.id), ['tree-b'],
    'Case A: fresh authority replaces the stale cached projection');
  assert.equal(env.state.isFromCache, false, 'Case A: no cache-first render flag');
  assert.deepEqual(env.renderCalls.flat(), ['tree-b'],
    'Case A: the revoked Tree is never painted as public content');
});

test('#4055 Case A2: mutation purge then reload — revoked Tree absent from fresh Browse', async () => {
  const treeA = { id: 'tree-a', title: 'Public A' };
  const treeB = { id: 'tree-b', title: 'Public B' };

  const env = createSearchDataEnv({
    getPublicTrees: () => Promise.resolve([treeB])
  });

  // First load caches both trees.
  await env.searchData.loadPublicTrees({ resetSelection: true });
  await flushAsync();

  // Owner revokes Tree A -> the mutation wiring calls clearCommunityCaches('tree-a').
  env.cache.clearPublicTreeCaches('tree-a');

  // Next Browse: only Tree B remains in the fresh authority and in the cache.
  await env.searchData.loadPublicTrees({ resetSelection: true });
  await flushAsync();

  assert.deepEqual(env.state.allTrees.map((t) => t.id), ['tree-b'],
    'Case A2: revoked Tree does not reappear');
  assert.deepEqual(env.cache.get('public_trees_summary_latest_10_latest_10').map((t) => t.id), ['tree-b'],
    'Case A2: cached browse list no longer contains the revoked Tree');
});

test('#4055 Case C: network failure after revocation must not restore the deleted Tree from cache', async () => {
  const deletedTree = { id: 'tree-a', title: 'Deleted A' };
  let failNext = false;

  const env = createSearchDataEnv({
    getPublicTrees: () => {
      if (failNext) return Promise.reject(new Error('network down'));
      return Promise.resolve([deletedTree]);
    }
  });

  // Populate the cache with the (then-public) Tree.
  await env.searchData.loadPublicTrees({ resetSelection: true });
  await flushAsync();
  assert.deepEqual(env.state.allTrees.map((t) => t.id), ['tree-a']);

  // Owner deletes Tree A -> purge runs.
  env.cache.clearPublicTreeCaches('tree-a');

  // Next Browse network request fails.
  failNext = true;
  await env.searchData.loadPublicTrees({ resetSelection: true });
  await flushAsync();

  assert.deepEqual(Array.from(env.state.allTrees, (t) => String(t.id)), [],
    'Case C: stale cached Tree must not remain/reappear as public content after a network failure');
  assert.equal(env.cache.get('public_trees_summary_latest_10_latest_10'), null,
    'Case C: the stale cache entry is dropped so it cannot be resurrected on reload');
  assert.ok(env.state.loadError, 'Case C: a truthful error state is shown instead');
});

// ── Case B: preview authority gate ───────────────────────────────────────────

test('#4055 Case B: cached preview with old thumbnail is not returned after fresh Browse authority excludes the Tree', async () => {
  const previewUpdates = [];
  const env = createSearchDataEnv({
    getPublicTrees: () => Promise.resolve([{ id: 'tree-b', title: 'Public B' }]),
    previewRendererSpy: previewUpdates
  });

  // Fresh Browse authority loaded — Tree A is absent (revoked).
  await env.searchData.loadPublicTrees({ resetSelection: true });
  await flushAsync();

  // A stale preview with the old representative thumbnail exists in the cache.
  env.cache.set('public_tree_preview_tree-a', {
    id: 'tree-a',
    title: 'Public A',
    representativeThumbnail: 'https://cdn.test/old-a.jpg'
  }, 5 * 60 * 1000);

  // Select Tree A so the preview flow proceeds past its guard.
  env.state.selectedTreeId = 'tree-a';
  env.state.currentPreviewRequestId = 0;

  let reHydrationAttempted = false;
  env.window.apiClient.getPublicTreePreview = () => {
    reHydrationAttempted = true;
    return Promise.resolve(null);
  };

  await env.searchData.hydrateSelectedTreePreview({ id: 'tree-a' });
  await flushAsync();

  assert.equal(reHydrationAttempted, true,
    'Case B: stale cached preview is bypassed; current authority is re-checked');
  assert.deepEqual(previewUpdates, [],
    'Case B: old thumbnail/source projection is never painted as public content');
});

test('#4055 Case B2: cached preview IS served only when the fresh Browse authority still contains the Tree', async () => {
  const treeB = { id: 'tree-b', title: 'Public B' };
  const previewUpdates = [];
  const env = createSearchDataEnv({
    getPublicTrees: () => Promise.resolve([treeB]),
    previewRendererSpy: previewUpdates
  });

  await env.searchData.loadPublicTrees({ resetSelection: true });
  await flushAsync();

  // Cache a valid preview for Tree B (still public per fresh authority).
  env.previewCacheApi.writePreviewCache('tree-b', {
    id: 'tree-b',
    title: 'Public B',
    representativeThumbnail: 'https://cdn.test/b.jpg'
  });

  // Select Tree B so hydrateSelectedTreePreview proceeds past its guard.
  env.state.selectedTreeId = 'tree-b';
  env.state.currentPreviewRequestId = 0;

  let networkCalled = false;
  env.window.apiClient.getPublicTreePreview = () => {
    networkCalled = true;
    return Promise.resolve(null);
  };

  await env.searchData.hydrateSelectedTreePreview({ id: 'tree-b' });
  await flushAsync();

  assert.equal(networkCalled, false,
    'Case B2: valid cached preview served from cache, not the network');
  assert.deepEqual(
    previewUpdates.map((p) => p.title),
    ['Public B'],
    'Case B2: cached preview painted with the current public projection'
  );
});

// ── Case E: failed mutation must not falsely invalidate ──────────────────────

test('#4055 Case E: mutation purge wiring runs only after confirmed success (source-static)', () => {
  const treeHelpers = fs.readFileSync(path.join(ROOT, 'js', 'editor', 'editor-tree-helpers.js'), 'utf8');
  const myTreesActions = fs.readFileSync(path.join(ROOT, 'js', 'my-trees', 'my-trees-actions.js'), 'utf8');
  const editorRenameUi = fs.readFileSync(path.join(ROOT, 'js', 'editor', 'editor-rename-ui.js'), 'utf8');
  const editorMemoryActions = fs.readFileSync(path.join(ROOT, 'js', 'editor', 'editor-memory-actions.js'), 'utf8');

  // Visibility toggle: the purge call must appear AFTER the awaited updateTree
  // succeeds and be inside a try that cannot swallow a failed mutation as success.
  const visibilityBlock = treeHelpers.slice(treeHelpers.indexOf('updateTreeVisibility'));
  const awaitIdx = visibilityBlock.indexOf('await apiClient.updateTree');
  const purgeIdx = visibilityBlock.indexOf('clearCommunityCaches(treeId)');
  assert.ok(awaitIdx !== -1 && purgeIdx !== -1 && purgeIdx > awaitIdx,
    'Case E: Tree visibility purge runs only after the mutation succeeds');

  // Rename: purge inside the .then() success callback of the awaited updateTree.
  const renameBlock = editorRenameUi.slice(editorRenameUi.indexOf('updateTree(treeId'));
  const renameAwait = renameBlock.indexOf('updateTree(treeId, { title: nextTitle })');
  const renameSuccessThen = renameBlock.indexOf('.then(');
  const renamePurge = renameBlock.indexOf('win.apiClient.clearCommunityCaches(treeId)');
  assert.ok(renameAwait !== -1 && renameSuccessThen !== -1 && renamePurge !== -1
    && renamePurge > renameSuccessThen,
    'Case E: rename purge runs only after the mutation succeeds');

  // My Trees delete/toggle/rename: purge after each awaited mutation.
  assert.ok(
    /await window\.apiClient\.deleteTree\(treeId\);\s*[\s\S]*?clearPublicTreeProjectionCaches\(treeId\)/.test(myTreesActions),
    'Case E: My Trees delete purge runs after success'
  );
  assert.ok(
    /await window\.apiClient\.updateTree\(treeId, \{ visibility: nextVisibility \}\);\s*[\s\S]*?clearPublicTreeProjectionCaches\(treeId\)/.test(myTreesActions),
    'Case E: My Trees visibility purge runs after success'
  );
  assert.ok(
    /await window\.apiClient\.updateTree\(treeId, \{ title: newTitle\.trim\(\) \}\);\s*[\s\S]*?clearPublicTreeProjectionCaches\(treeId\)/.test(myTreesActions),
    'Case E: My Trees rename purge runs after success'
  );

  // Memory delete: purge after the awaited deleteMemory resolves.
  const deleteMemoryBlock = editorMemoryActions.slice(editorMemoryActions.indexOf('window.apiClient.deleteMemory'));
  const memDeleteAwait = deleteMemoryBlock.indexOf('await window.apiClient.deleteMemory');
  const memDeletePurge = deleteMemoryBlock.indexOf('clearCommunityCaches(treeId)');
  assert.ok(memDeleteAwait !== -1 && memDeletePurge !== -1 && memDeletePurge > memDeleteAwait,
    'Case E: Memory delete purge runs only after success');

  // Memory save: purge only when NOT localSaveMode and a savedMemory confirmed.
  assert.ok(
    /if \(!localSaveMode && savedMemory\) \{\s*clearCommunityCaches\(treeId\);/.test(editorMemoryActions),
    'Case E: Memory save purge only after a confirmed remote save'
  );
});
