const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..', '..');
const SAVE_RUNTIME = path.join(ROOT, 'js', 'editor', 'editor-memory-form-save.js');
const TX_ADAPTER = path.join(ROOT, 'functions', '_shared', 'db', 'neon-ws-transaction-adapter.js');

function createSaveSandbox(apiClient) {
  const sandbox = vm.createContext({
    console,
    setTimeout,
    window: {
      apiClient,
      crypto: {
        randomUUID() {
          return '11111111-2222-4333-8444-555555555555';
        }
      }
    }
  });
  vm.runInContext(fs.readFileSync(SAVE_RUNTIME, 'utf8'), sandbox);
  return sandbox;
}

function defaultDeps(overrides = {}) {
  return {
    i18n: (key) => key,
    treeId: 'tree-4410',
    updateSaveStatus: () => {},
    showToast: () => {},
    nextMemoryId: () => 'local-4410',
    normalizeMemory: (value) => value,
    getTreeMemories: () => [],
    setTreeMemories: () => {},
    setLocalSaveMode: () => {},
    drawNode: () => {},
    drawBranch: () => {},
    calcPosition: () => ({}),
    updateSidebarStatus: () => {},
    updateFocusSelectedBtn: () => {},
    setDetailEmptyState: () => {},
    selectNode: () => {},
    treeMemories: () => [],
    setCachedMemories: () => {},
    rerenderCanvas: () => {},
    focusNodeById: () => {},
    getCanonicalRootId: () => 'root',
    editorDebugLog: () => {},
    ...overrides
  };
}

function errorWith(fields) {
  const error = new Error(fields.message || 'synthetic');
  Object.assign(error, fields);
  return error;
}

test('#4410 COMMIT_OUTCOME_UNKNOWN reconciles by exact clientKey with one POST and no local substitute', async () => {
  let createCount = 0;
  let rereadCount = 0;
  let dispatchedPayload = null;
  const localModes = [];

  const apiClient = {
    async createMemory(payload) {
      createCount += 1;
      dispatchedPayload = payload;
      throw errorWith({ code: 'COMMIT_OUTCOME_UNKNOWN', status: 502 });
    },
    async getMemoriesByTree(treeId) {
      rereadCount += 1;
      assert.equal(treeId, 'tree-4410');
      return [{
        id: 'canonical-4410',
        treeId,
        clientKey: dispatchedPayload.clientKey,
        title: 'canonical'
      }];
    }
  };

  const sandbox = createSaveSandbox(apiClient);
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps({
    setLocalSaveMode(value) {
      localModes.push(value);
    }
  }));

  const result = await save.createMemoryWithFallback({ title: 'request-title' });

  assert.equal(createCount, 1, 'exactly one POST dispatch for the logical save');
  assert.equal(rereadCount, 1, 'one read-only reconciliation after ambiguous acknowledgement');
  assert.ok(dispatchedPayload.clientKey);
  assert.ok(dispatchedPayload.clientKey.length <= 100);
  assert.equal(result.useApi, true);
  assert.equal(result.createdMemory.id, 'canonical-4410');
  assert.equal(result.createdMemory.clientKey, dispatchedPayload.clientKey);
  assert.equal(localModes.includes(true), false, 'must never enter local-save mode');
});

test('#4410 transport ambiguity unresolved: no blind POST retry and no synthetic local Memory', async () => {
  let createCount = 0;
  let rereadCount = 0;
  let localIdCount = 0;
  const localModes = [];

  const apiClient = {
    async createMemory() {
      createCount += 1;
      throw errorWith({ _phase: 'fetch_rejected' });
    },
    async getMemoriesByTree() {
      rereadCount += 1;
      return [];
    }
  };

  const sandbox = createSaveSandbox(apiClient);
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps({
    nextMemoryId() {
      localIdCount += 1;
      return 'must-not-be-created';
    },
    setLocalSaveMode(value) {
      localModes.push(value);
    }
  }));

  const result = await save.createMemoryWithFallback({ title: 'request-title' });

  assert.equal(createCount, 1, 'ambiguous transport must not retry POST');
  assert.equal(rereadCount, 1);
  assert.equal(localIdCount, 0, 'no synthetic local identity after ambiguity');
  assert.equal(result.createdMemory, null);
  assert.equal(result.useApi, false);
  assert.equal(result.ambiguous, true);
  assert.equal(localModes.includes(true), false);
});

test('#4410 definitely pre-commit failure retains existing local fallback policy', async () => {
  let createCount = 0;
  let rereadCount = 0;
  let localMode = null;

  const apiClient = {
    async createMemory() {
      createCount += 1;
      throw errorWith({ code: 'DIRECT_NEON_CONFIG_ABSENT', status: 503 });
    },
    async getMemoriesByTree() {
      rereadCount += 1;
      return [];
    }
  };

  const sandbox = createSaveSandbox(apiClient);
  const save = sandbox.window.LoveBudEditorMemoryFormSave(defaultDeps({
    setLocalSaveMode(value) {
      localMode = value;
    }
  }));

  const result = await save.createMemoryWithFallback({ title: 'request-title' });

  assert.equal(createCount, 1);
  assert.equal(rereadCount, 0, 'definitely pre-commit failure needs no reconciliation');
  assert.equal(localMode, true);
  assert.equal(result.useApi, false);
  assert.equal(result.createdMemory.id, 'local-4410');
});

async function loadAdapter() {
  return import(pathToFileURL(TX_ADAPTER).href + '?issue=4410');
}

function fakeNeonImporter({ commitFails = false, closeFails = false } = {}) {
  return async () => ({
    Client: class FakeClient {
      async connect() {}

      async query(text) {
        if (text === 'COMMIT' && commitFails) {
          throw new Error('synthetic commit transport failure');
        }
        return { rows: [] };
      }

      async end() {
        if (closeFails) {
          throw new Error('synthetic close failure');
        }
      }
    }
  });
}

test('#4410 known COMMIT + connection close failure returns committed result, not write failure', async () => {
  const mod = await loadAdapter();
  const adapter = await mod.createNeonWsTransactionAdapter({
    connectionString: 'postgresql://user:pass@fixture.neon.tech/neondb',
    neonImporter: fakeNeonImporter({ closeFails: true })
  });

  const result = await adapter.runTransaction(async () => ({ canonical: true }));

  assert.deepEqual(result.value, { canonical: true });
  assert.equal(result.outcome, 'committed');
  assert.equal(result.commitOutcome, mod.NEON_WS_TRANSACTION_COMMIT_OUTCOME.COMMITTED);
  assert.equal(result.state, mod.NEON_WS_TRANSACTION_STATE.CLOSED);
  assert.equal(result.stats.closeCount, 0, 'failed cleanup is observable in stats without rewriting commit result');
});

test('#4410 COMMIT transport failure remains explicit unknown outcome and is never converted to success', async () => {
  const mod = await loadAdapter();
  const adapter = await mod.createNeonWsTransactionAdapter({
    connectionString: 'postgresql://user:pass@fixture.neon.tech/neondb',
    neonImporter: fakeNeonImporter({ commitFails: true })
  });

  await assert.rejects(
    () => adapter.runTransaction(async () => ({ canonical: true })),
    (error) => {
      assert.equal(error.code, mod.NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN);
      assert.equal(error.commitOutcome, mod.NEON_WS_TRANSACTION_COMMIT_OUTCOME.UNKNOWN);
      return true;
    }
  );
});
