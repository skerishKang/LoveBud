const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function loadDataLoader(apiClient) {
  const context = {
    window: {},
    console: { warn() {} },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/editor/editor-data-loader.js', 'utf8'), context);
  return context.window.LoveBudEditorDataLoader;
}

function createMemoryCache() {
  const store = new Map();
  return {
    get(key) { return store.has(key) ? store.get(key) : null; },
    set(key, value) { store.set(key, value); },
    delete(key) { store.delete(key); },
  };
}

function createApiClient(memories) {
  let shouldFail = false;
  return {
    getMemoriesByTree: async () => {
      if (shouldFail) throw new Error('API failure');
      return memories;
    },
    setShouldFail(value) { shouldFail = value; },
  };
}

test('filterMemoriesForTree keeps only memories matching current treeId and root placeholders', () => {
  const dataLoader = loadDataLoader();
  const filterMemoriesForTree = dataLoader.filterMemoriesForTree;

  // root placeholder + matching memories + different treeId memories + missing treeId
  const input = [
    { id: 'root', parentId: null, treeId: 'tree-A' },
    { id: 'm1', parentId: 'root', treeId: 'tree-A' },
    { id: 'm2', parentId: 'root', treeId: 'tree-B' },  // different treeId → drop
    { id: 'm3', parentId: 'root' },  // missing treeId → drop (real tree)
  ];
  const filtered = filterMemoriesForTree(input, 'tree-A');
  const ids = filtered.map((m) => m.id);
  assert.deepEqual(ids, ['root', 'm1']);
});

test('filterMemoriesForTree treats root placeholder variants as root', () => {
  const dataLoader = loadDataLoader();
  const filterMemoriesForTree = dataLoader.filterMemoriesForTree;

  // blank-parent + self-parent root placeholders are preserved
  const input = [
    { id: 'tree-root-id', parentId: '', treeId: 'tree-A' },
    { id: 'tree-root-id-2', parentId: 'tree-root-id-2', treeId: 'tree-A' },
  ];
  const filtered = filterMemoriesForTree(input, 'tree-A');
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].id, 'tree-root-id');
  assert.equal(filtered[1].id, 'tree-root-id-2');
});

test('filterMemoriesForTree returns all memories when treeId is missing (legacy default)', () => {
  const dataLoader = loadDataLoader();
  const filterMemoriesForTree = dataLoader.filterMemoriesForTree;

  const input = [
    { id: 'root', parentId: null },
    { id: 'm1', parentId: 'root' },
  ];
  const filtered = filterMemoriesForTree(input, null);
  assert.equal(filtered.length, 2);
});

test('loadEditorMemories: cached different treeId + API [] => currentTreeMemories []', async () => {
  const dataLoader = loadDataLoader();
  const cache = createMemoryCache();
  const apiClient = createApiClient([]);

  // Cache hit: previous tree's Psy-like moment (different treeId)
  cache.set('memories_tree-A', [
    { id: 'root', parentId: null, treeId: 'tree-A' },
    { id: 'psy-moment', parentId: 'root', treeId: 'tree-A', sourceUrl: 'https://youtube.com/psy' },
  ]);

  const result = await dataLoader.loadEditorMemories({
    treeId: 'tree-B',
    cache,
    cacheKey: 'memories_tree-B',
    apiClient,
    normalizeMemory: dataLoader.createNormalizeMemory(),
  });

  assert.deepEqual(result.memories, []);
  assert.deepEqual(globalThis.window ? globalThis.window.currentTreeMemories : result.memories, []);
  // API returned [] → cache cleared
  assert.equal(cache.get('memories_tree-B'), null);
});

test('loadEditorMemories: cached same treeId + API [] => currentTreeMemories []', async () => {
  const dataLoader = loadDataLoader();
  const cache = createMemoryCache();
  const apiClient = createApiClient([]);

  // Cache hit: same treeId but stale
  cache.set('memories_tree-B', [
    { id: 'root', parentId: null, treeId: 'tree-B' },
    { id: 'm1', parentId: 'root', treeId: 'tree-B' },
  ]);

  const result = await dataLoader.loadEditorMemories({
    treeId: 'tree-B',
    cache,
    cacheKey: 'memories_tree-B',
    apiClient,
    normalizeMemory: dataLoader.createNormalizeMemory(),
  });

  assert.deepEqual(result.memories, []);
});

test('loadEditorMemories: cached different treeId + API failure => real moments dropped, root placeholder kept', async () => {
  const dataLoader = loadDataLoader();
  const cache = createMemoryCache();
  const apiClient = createApiClient([]);
  apiClient.setShouldFail(true);

  // Cache: 이전 트리의 real moment + root placeholder
  cache.set('memories_tree-B', [
    { id: 'root', parentId: null, treeId: 'tree-A' },
    { id: 'm1', parentId: 'root', treeId: 'tree-A' },  // 다른 treeId → drop
  ]);

  const result = await dataLoader.loadEditorMemories({
    treeId: 'tree-B',
    cache,
    cacheKey: 'memories_tree-B',
    apiClient,
    normalizeMemory: dataLoader.createNormalizeMemory(),
  });

  // real moment는 filter로 drop, root placeholder는 유지
  const ids = result.memories.map((m) => m.id);
  assert.deepEqual(ids, ['root']);
});

test('loadEditorMemories: cached same treeId + API failure => currentTreeMemories keeps cached (validated)', async () => {
  const dataLoader = loadDataLoader();
  const cache = createMemoryCache();
  const apiClient = createApiClient([]);
  apiClient.setShouldFail(true);

  // Cache: 같은 treeId의 유효한 memories
  cache.set('memories_tree-B', [
    { id: 'root', parentId: null, treeId: 'tree-B' },
    { id: 'm1', parentId: 'root', treeId: 'tree-B' },
  ]);

  const result = await dataLoader.loadEditorMemories({
    treeId: 'tree-B',
    cache,
    cacheKey: 'memories_tree-B',
    apiClient,
    normalizeMemory: dataLoader.createNormalizeMemory(),
  });

  // filter 후 root + m1 유지
  assert.equal(result.memories.length, 2);
  assert.equal(result.memories[0].id, 'root');
  assert.equal(result.memories[1].id, 'm1');
});

test('loadEditorMemories: API returns one valid memory for same treeId => renders normally', async () => {
  const dataLoader = loadDataLoader();
  const cache = createMemoryCache();
  const apiClient = createApiClient([
    { id: 'root', parentId: null, treeId: 'tree-B' },
    { id: 'm1', parentId: 'root', treeId: 'tree-B', title: 'First moment' },
  ]);

  const result = await dataLoader.loadEditorMemories({
    treeId: 'tree-B',
    cache,
    cacheKey: 'memories_tree-B',
    apiClient,
    normalizeMemory: dataLoader.createNormalizeMemory(),
  });

  assert.equal(result.memories.length, 2);
  assert.equal(result.memories[0].id, 'root');
  assert.equal(result.memories[1].id, 'm1');
  // 캐시에 저장됨
  const cached = cache.get('memories_tree-B');
  assert.ok(Array.isArray(cached));
  assert.equal(cached.length, 2);
});

test('loadEditorMemories: stale Psy-like YouTube memory must not render in a new empty tree', async () => {
  const dataLoader = loadDataLoader();
  const cache = createMemoryCache();
  const apiClient = createApiClient([]);

  // Cache: 다른 트리의 Psy/Gangnam Style 메모리
  cache.set('memories_tree-B', [
    { id: 'root', parentId: null, treeId: 'tree-A' },
    {
      id: 'psy-gangnam',
      parentId: 'root',
      treeId: 'tree-A',
      title: 'Gangnam Style',
      sourceUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
      source: 'youtube',
    },
  ]);

  const result = await dataLoader.loadEditorMemories({
    treeId: 'tree-B',
    cache,
    cacheKey: 'memories_tree-B',
    apiClient,
    normalizeMemory: dataLoader.createNormalizeMemory(),
  });

  // Psy 메모리는 filter로 drop → API [] → cache clear → []
  assert.deepEqual(result.memories, []);
  const ids = result.memories.map((m) => m.id);
  assert.equal(ids.includes('psy-gangnam'), false);
});

test('createRefreshMemories: API response is filtered by treeId', async () => {
  const dataLoader = loadDataLoader();
  const apiClient = createApiClient([
    { id: 'm1', parentId: 'root', treeId: 'tree-A' },  // 다른 트리
    { id: 'm2', parentId: 'root', treeId: 'tree-B' },  // current 트리
  ]);
  let updatedWith = null;
  const refreshMemories = dataLoader.createRefreshMemories({
    treeId: 'tree-B',
    apiClient,
    normalizeMemory: dataLoader.createNormalizeMemory(),
    onMemoriesUpdated: (value) => { updatedWith = value; },
  });

  await refreshMemories();

  assert.equal(updatedWith.length, 1);
  assert.equal(updatedWith[0].id, 'm2');
});

test('data loader exports filterMemoriesForTree helper for shared use', () => {
  const dataLoader = loadDataLoader();
  assert.equal(typeof dataLoader.filterMemoriesForTree, 'function');
  assert.equal(typeof dataLoader.isCanonicalRootPlaceholder, 'function');
});

test('isCanonicalRootPlaceholder detects all five root variants', () => {
  const dataLoader = loadDataLoader();
  const isCanonicalRootPlaceholder = dataLoader.isCanonicalRootPlaceholder;

  assert.equal(isCanonicalRootPlaceholder({ id: 'root', parentId: null }), true, 'legacy root');
  assert.equal(isCanonicalRootPlaceholder({ id: 'tree-root-id', parentId: null }), true, 'parentId null');
  assert.equal(isCanonicalRootPlaceholder({ id: 'tree-root-id', parentId: undefined }), true, 'parentId undefined');
  assert.equal(isCanonicalRootPlaceholder({ id: 'tree-root-id', parentId: '' }), true, 'parentId blank');
  assert.equal(isCanonicalRootPlaceholder({ id: 'tree-root-id', parentId: 'tree-root-id' }), true, 'self-parent');

  assert.equal(isCanonicalRootPlaceholder({ id: 'm1', parentId: 'root' }), false, 'real child');
  assert.equal(isCanonicalRootPlaceholder(null), false, 'null');
});

test('filterMemoriesForTree drops stale real memory with parentId null and mismatched treeId', () => {
  const dataLoader = loadDataLoader();
  const filterMemoriesForTree = dataLoader.filterMemoriesForTree;

  // 핵심 regression boundary: parentId: null이어도 treeId가 다르면 stale.
  // 이전 (PR #2447) 로직은 isCanonicalRootPlaceholder 통과로 살려뒀음.
  // 이 케이스에서 싸이 memory 같은 stale real moment가 새 트리에 섞이는 게 가능했음.
  const input = [
    { id: 'psy-stale', parentId: null, treeId: 'tree-A', sourceUrl: 'https://youtube.com/psy' },
    { id: 'root', parentId: null, treeId: 'tree-A' },  // legacy 'root'만 예외 통과
  ];
  const filtered = filterMemoriesForTree(input, 'tree-B');
  const ids = filtered.map((m) => m.id);
  assert.deepEqual(ids, ['root'], 'only legacy root should survive; parentId:null stale must drop');
});

test('filterMemoriesForTree drops uuid root placeholder when its treeId mismatches', () => {
  const dataLoader = loadDataLoader();
  const filterMemoriesForTree = dataLoader.filterMemoriesForTree;

  // uuid root placeholder (id !== 'root', parentId === '')도 treeId mismatch면 drop.
  // 'root' id만 universal, 그 외 root placeholder는 자기 tree에만 valid.
  const input = [
    { id: 'tree-root-A', parentId: '', treeId: 'tree-A' },
    { id: 'tree-root-B', parentId: '', treeId: 'tree-B' },
  ];
  const filtered = filterMemoriesForTree(input, 'tree-B');
  const ids = filtered.map((m) => m.id);
  assert.deepEqual(ids, ['tree-root-B']);
});

test('filterMemoriesForTree keeps legacy id=root across mismatched treeId (universal exception)', () => {
  const dataLoader = loadDataLoader();
  const filterMemoriesForTree = dataLoader.filterMemoriesForTree;

  // legacy 'root'만 universal. treeId가 달라도 통과.
  const filtered = filterMemoriesForTree([
    { id: 'root', parentId: null, treeId: 'tree-A' },
  ], 'tree-B');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'root');
});

test('loadEditorMemories: stale real moment with parentId null + mismatched treeId is dropped', async () => {
  const dataLoader = loadDataLoader();
  const cache = createMemoryCache();
  const apiClient = createApiClient([]);

  // 이전 트리의 real moment가 parentId: null 형태로 캐시에 남은 경우
  // (root placeholder가 아니라 real moment인데 parentId가 누락된 edge case)
  cache.set('memories_tree-B', [
    { id: 'psy-moment', parentId: null, treeId: 'tree-A', sourceUrl: 'https://youtube.com/psy' },
    { id: 'root', parentId: null, treeId: 'tree-A' },
  ]);

  const result = await dataLoader.loadEditorMemories({
    treeId: 'tree-B',
    cache,
    cacheKey: 'memories_tree-B',
    apiClient,
    normalizeMemory: dataLoader.createNormalizeMemory(),
  });

  // psy-moment drop, root만 통과 → API [] → cache clear + root도 drop → []
  const ids = result.memories.map((m) => m.id);
  assert.equal(ids.includes('psy-moment'), false, 'stale parentId:null real moment must not leak');
  assert.deepEqual(ids, []);
});

test('editor page cache-busts data loader scripts for the stale cache filter', () => {
  const editorPage = fs.readFileSync('pages/editor.html', 'utf8');

  assert.match(editorPage, /\.\.\/js\/editor\/editor-data-loader\.js\?v=20260613-2447/);
  assert.match(editorPage, /\.\.\/js\/editor\/editor-data-loader-fallbacks\.js\?v=20260613-2447/);
  assert.doesNotMatch(editorPage, /\.\.\/js\/editor\/editor-data-loader\.js\?v=20260422-1/);
});
