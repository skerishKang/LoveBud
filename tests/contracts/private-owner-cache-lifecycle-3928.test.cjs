'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const AUTH_CACHE_PATH = path.join(ROOT, 'js', 'auth', 'auth-cache.js');
const AUTH_SESSION_PATH = path.join(ROOT, 'js', 'auth', 'auth-session.js');
const AUTH_FALLBACK_PATH = path.join(ROOT, 'js', 'auth.js');
const MY_TREES_DATA_PATH = path.join(ROOT, 'js', 'my-trees', 'my-trees-data.js');

class FakeStorage {
  constructor() {
    this.map = new Map();
  }

  get length() {
    return this.map.size;
  }

  key(index) {
    return Array.from(this.map.keys())[index] ?? null;
  }

  getItem(key) {
    return this.map.has(String(key)) ? this.map.get(String(key)) : null;
  }

  setItem(key, value) {
    this.map.set(String(key), String(value));
  }

  removeItem(key) {
    this.map.delete(String(key));
  }

  clear() {
    this.map.clear();
  }
}

function createContext() {
  const localStorage = new FakeStorage();
  const sessionStorage = new FakeStorage();
  const memoryCache = new Map();
  const document = {
    getElementById() { return null; },
  };

  const window = {
    localStorage,
    sessionStorage,
    loveBudCache: {},
    LoveBudCache: {
      get(key) {
        return memoryCache.has(key) ? memoryCache.get(key) : null;
      },
      set(key, value) {
        memoryCache.set(key, value);
      },
      clear(key) {
        memoryCache.delete(key);
        sessionStorage.removeItem('lb_' + key);
      },
    },
    location: {
      origin: 'https://lovebud.test',
      search: '',
      pathname: '/pages/my-trees',
    },
    requestIdleCallback(callback) {
      callback();
    },
  };

  const context = vm.createContext({
    window,
    localStorage,
    sessionStorage,
    document,
    console,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setImmediate,
    queueMicrotask,
  });

  return { context, window, localStorage, sessionStorage, memoryCache };
}

function runScript(context, filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  vm.runInContext(source, context, { filename: filePath });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushAsync() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

function privateKeys(storage) {
  const out = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (
      key === 'lovebud_my_trees_list_cache' ||
      key === 'lovebud_trees_cache' ||
      (key && key.startsWith('tree_detail_')) ||
      (key && key.startsWith('tree_memories_'))
    ) {
      out.push(key);
    }
  }
  return out.sort();
}

function titlesOf(trees) {
  return Array.from(trees || [], (tree) => tree.title);
}

test('#3928 bounded purge preserves same-UID reuse and unrelated/public storage', () => {
  const env = createContext();
  runScript(env.context, AUTH_CACHE_PATH);
  const cache = env.window.LoveBudAuthCache;

  cache.syncConfirmedPrivateOwner('user-a');
  const authorityA = cache.capturePrivateCacheAuthority('user-a');
  assert.ok(authorityA, 'User A authority is established');

  assert.equal(cache.writePrivateCacheRecord('lovebud_my_trees_list_cache', 'user-a', {
    data: [{ id: 'a-tree', title: 'A private tree' }],
    expiry: Date.now() + 60000,
  }, authorityA), true);
  assert.equal(cache.writePrivateCacheRecord('lovebud_trees_cache', 'user-a', {
    data: [{ id: 'a-tree' }],
    timestamp: Date.now(),
  }, authorityA), true);
  assert.equal(cache.writePrivateCacheRecord('tree_detail_a-tree', 'user-a', {
    data: { id: 'a-tree', title: 'A private tree' },
    timestamp: Date.now(),
  }, authorityA), true);
  assert.equal(cache.writePrivateCacheRecord('tree_memories_a-tree', 'user-a', {
    data: [{ id: 'a-memory' }],
    timestamp: Date.now(),
  }, authorityA), true);

  env.localStorage.setItem('lovebud_public_trees_cache', JSON.stringify({ data: ['public'] }));
  env.localStorage.setItem('lovebud_theme_preference', 'dark');
  env.localStorage.setItem('draft_unrelated', 'keep-me');
  env.window.LoveBudCache.set('my_trees_list', [{ id: 'a-tree' }]);

  cache.syncConfirmedPrivateOwner('user-a');
  assert.equal(cache.isPrivateCacheAuthorityCurrent(authorityA), true, 'same UID keeps the epoch valid');
  assert.deepEqual(
    titlesOf(cache.readPrivateCacheRecord('lovebud_my_trees_list_cache', 'user-a').data),
    ['A private tree'],
    'same UID can reuse the private cache'
  );

  cache.syncConfirmedPrivateOwner('user-b');
  assert.equal(cache.isPrivateCacheAuthorityCurrent(authorityA), false, 'A authority is invalid after A -> B');
  assert.deepEqual(privateKeys(env.localStorage), [], 'A private key families are purged before B use');
  assert.equal(env.window.LoveBudCache.get('my_trees_list'), null, 'private in-memory/session list cache is purged');
  assert.ok(env.localStorage.getItem('lovebud_public_trees_cache'), 'public Browse cache survives');
  assert.equal(env.localStorage.getItem('lovebud_theme_preference'), 'dark', 'preference survives');
  assert.equal(env.localStorage.getItem('draft_unrelated'), 'keep-me', 'unrelated draft survives');

  const authorityB = cache.capturePrivateCacheAuthority('user-b');
  assert.ok(authorityB, 'User B authority is established');
  assert.equal(cache.writePrivateCacheRecord('tree_detail_b-tree', 'user-b', {
    data: { id: 'b-tree' },
  }, authorityB), true);

  cache.clearPrivateCaches();
  assert.deepEqual(privateKeys(env.localStorage), [], 'logout clears bounded private families');
  assert.equal(env.localStorage.getItem(cache.PRIVATE_OWNER_UID_KEY), null, 'logout clears owner marker');
  assert.ok(env.localStorage.getItem('lovebud_public_trees_cache'), 'logout does not clear public cache');
  assert.equal(env.localStorage.getItem('draft_unrelated'), 'keep-me', 'logout does not clear unrelated storage');
});

test('#3928 legacy or mismatched private records are misses and removed', () => {
  const env = createContext();
  runScript(env.context, AUTH_CACHE_PATH);
  const cache = env.window.LoveBudAuthCache;

  cache.syncConfirmedPrivateOwner('user-b');
  env.localStorage.setItem('lovebud_my_trees_list_cache', JSON.stringify({
    data: [{ id: 'legacy-a', title: 'Legacy A title' }],
    expiry: Date.now() + 60000,
  }));

  assert.equal(
    cache.readPrivateCacheRecord('lovebud_my_trees_list_cache', 'user-b'),
    null,
    'legacy record without UID is never returned'
  );
  assert.equal(env.localStorage.getItem('lovebud_my_trees_list_cache'), null, 'legacy record is removed');

  env.localStorage.setItem('tree_detail_wrong', JSON.stringify({
    uid: 'user-a',
    data: { id: 'wrong' },
  }));
  assert.equal(cache.readPrivateCacheRecord('tree_detail_wrong', 'user-b'), null, 'mismatched UID is a miss');
  assert.equal(env.localStorage.getItem('tree_detail_wrong'), null, 'mismatched UID record is removed');
});

test('#3928 canonical preload cannot repopulate User A data after UID transition', async () => {
  const env = createContext();
  runScript(env.context, AUTH_CACHE_PATH);
  runScript(env.context, AUTH_SESSION_PATH);

  const cache = env.window.LoveBudAuthCache;
  cache.syncConfirmedPrivateOwner('user-a');

  const treesDeferred = deferred();
  env.window.LoveBudAuthSession.preloadRedirectTargetData({
    getRedirectTarget: () => '/pages/my-trees',
    apiClient: {
      getTrees: () => treesDeferred.promise,
    },
    logger: { log() {}, warn() {} },
  });

  cache.syncConfirmedPrivateOwner('user-b');
  treesDeferred.resolve([{ id: 'a-tree', title: 'A private tree' }]);
  await flushAsync();
  assert.equal(env.localStorage.getItem('lovebud_trees_cache'), null, 'late A tree list cannot repopulate after switch');

  const detailDeferred = deferred();
  const memoriesDeferred = deferred();
  cache.syncConfirmedPrivateOwner('user-a');
  env.window.LoveBudAuthSession.preloadRedirectTargetData({
    getRedirectTarget: () => '/pages/editor',
    apiClient: {
      getTrees: async () => [{ id: 'a-tree', title: 'A private tree' }],
      getTree: () => detailDeferred.promise,
      getMemoriesByTree: () => memoriesDeferred.promise,
    },
    logger: { log() {}, warn() {} },
  });
  await flushAsync();
  assert.ok(env.localStorage.getItem('lovebud_trees_cache'), 'A preload list exists before the transition');

  cache.syncConfirmedPrivateOwner('user-b');
  detailDeferred.resolve({ id: 'a-tree', title: 'A late detail' });
  memoriesDeferred.resolve([{ id: 'a-memory' }]);
  await flushAsync();

  assert.equal(env.localStorage.getItem('tree_detail_a-tree'), null, 'late A detail cannot repopulate after switch');
  assert.equal(env.localStorage.getItem('tree_memories_a-tree'), null, 'late A memories cannot repopulate after switch');
  assert.equal(env.localStorage.getItem('lovebud_trees_cache'), null, 'transition purges the earlier A list');
});

test('#3928 My Trees cache-first paint is same-UID only and late A list results are stale', async () => {
  const env = createContext();
  runScript(env.context, AUTH_CACHE_PATH);
  const cache = env.window.LoveBudAuthCache;

  cache.syncConfirmedPrivateOwner('user-a');
  const authorityA = cache.capturePrivateCacheAuthority('user-a');
  cache.writePrivateCacheRecord('lovebud_my_trees_list_cache', 'user-a', {
    data: [{ id: 'a-cached', title: 'A cached title' }],
    expiry: Date.now() + 60000,
    cachedAt: Date.now(),
  }, authorityA);

  const firstNetwork = deferred();
  env.window.apiClient = { getTrees: () => firstNetwork.promise };
  runScript(env.context, MY_TREES_DATA_PATH);

  const renders = [];
  const firstLoad = env.window.LoveBudMyTreesData.loadTrees({
    setState() {},
    stateEnum: { LOADING: 'loading', ERROR: 'error' },
    renderTrees(trees) { renders.push(titlesOf(trees)); },
    acknowledgeUi() { return true; },
    showToast() {},
  });

  assert.deepEqual(renders[0], ['A cached title'], 'same UID retains cache-first paint');

  cache.syncConfirmedPrivateOwner('user-b');
  renders.length = 0;
  firstNetwork.resolve([{ id: 'a-network', title: 'A late network title' }]);
  await firstLoad;
  assert.deepEqual(renders, [], 'A network result does not render after the UID epoch changes');
  assert.equal(env.localStorage.getItem('lovebud_my_trees_list_cache'), null, 'A cache remains purged after late result');

  const secondNetwork = deferred();
  env.window.apiClient = { getTrees: () => secondNetwork.promise };
  const secondRenders = [];
  const secondLoad = env.window.LoveBudMyTreesData.loadTrees({
    setState() {},
    stateEnum: { LOADING: 'loading', ERROR: 'error' },
    renderTrees(trees) { secondRenders.push(titlesOf(trees)); },
    acknowledgeUi() { return true; },
    showToast() {},
  });

  assert.deepEqual(secondRenders, [], 'B receives no transient A cache paint');
  secondNetwork.resolve([{ id: 'b-network', title: 'B network title' }]);
  await secondLoad;
  assert.deepEqual(secondRenders, [['B network title']], 'B authoritative data renders normally');

  const storedForB = JSON.parse(env.localStorage.getItem('lovebud_my_trees_list_cache'));
  assert.equal(storedForB.uid, 'user-b', 'B persistent owner list is UID scoped');
  assert.deepEqual(storedForB.data.map((tree) => tree.title), ['B network title']);
});

test('#3928 legacy auth.js fallback uses private authority instead of raw private writes', () => {
  const source = fs.readFileSync(AUTH_FALLBACK_PATH, 'utf8');
  const match = source.match(/function preloadRedirectTargetData\(\) \{([\s\S]*?)\n\}\n\nfunction applyCachedAuthState/);
  assert.ok(match, 'fallback preload function exists');
  const body = match[1];

  assert.match(body, /capturePrivateCacheAuthority/);
  assert.match(body, /isPrivateCacheAuthorityCurrent/);
  assert.match(body, /writePrivateCacheRecord/);
  assert.doesNotMatch(body, /localStorage\.setItem\(['"]lovebud_trees_cache['"]/);
  assert.doesNotMatch(body, /localStorage\.setItem\(['"]tree_detail_/);
  assert.doesNotMatch(body, /localStorage\.setItem\(['"]tree_memories_/);
});
