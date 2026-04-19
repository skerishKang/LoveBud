const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');
const TARGET = path.join(ROOT, 'netlify/functions/memories.js');

function loadWithMocks(mocks) {
  const originalLoad = Module._load;
  delete require.cache[require.resolve(TARGET)];

  Module._load = function (request, parent, isMain) {
    if (mocks[request]) return mocks[request];
    return originalLoad.apply(this, arguments);
  };

  try {
    return require(TARGET);
  } finally {
    Module._load = originalLoad;
  }
}

function httpMocks() {
  return {
    ok: (body) => ({ statusCode: 200, body: JSON.stringify(body) }),
    created: (body) => ({ statusCode: 201, body: JSON.stringify(body) }),
    httpError: (status, message) => {
      const err = new Error(message);
      err.status = status;
      return err;
    },
    handleError: (_scope, error) => ({
      statusCode: error.status || 500,
      body: JSON.stringify({ error: error.message }),
    }),
    preflight: () => ({ statusCode: 204, body: '' }),
  };
}

test('memories: cannot create memory in someone else tree', async () => {
  const handler = loadWithMocks({
    './_lib/auth': {
      requireUser: async () => ({ uid: 'intruder' }),
    },
    './_lib/doc-store': {
      queryMemories: async () => [],
      createMemory: async () => null,
      queryTrees: async () => [],
      getTree: async () => ({ id: 't1', owner_id: 'owner-1' }),
      validateRequired: (v) => v,
      validateVisibility: (v) => v,
      validateSourceType: (v) => v,
      validateOptionalString: (v) => v,
      validateUuid: (v) => v,
      validateLimit: (v) => v,
    },
    './_lib/serializers': {
      serializeMemory: (m) => m,
      serializeMemoryList: (rows) => rows,
    },
    './_lib/http': httpMocks(),
  }).handler;

  const result = await handler({
    httpMethod: 'POST',
    path: '/api/memories',
    headers: {},
    body: JSON.stringify({
      treeId: 't1',
      title: 'hack',
      emotionTags: [],
    }),
  });

  assert.equal(result.statusCode, 403);
});

test('memories: cannot list memories for someone else tree', async () => {
  const handler = loadWithMocks({
    './_lib/auth': {
      requireUser: async () => ({ uid: 'intruder' }),
    },
    './_lib/doc-store': {
      queryMemories: async () => [],
      createMemory: async () => null,
      queryTrees: async () => [],
      getTree: async () => ({ id: 't1', owner_id: 'owner-1' }),
      validateRequired: (v) => v,
      validateVisibility: (v) => v,
      validateSourceType: (v) => v,
      validateOptionalString: (v) => v,
      validateUuid: (v) => v,
      validateLimit: (v) => v,
    },
    './_lib/serializers': {
      serializeMemory: (m) => m,
      serializeMemoryList: (rows) => rows,
    },
    './_lib/http': httpMocks(),
  }).handler;

  const result = await handler({
    httpMethod: 'GET',
    path: '/api/memories',
    headers: {},
    queryStringParameters: { treeId: 't1' },
  });

  assert.equal(result.statusCode, 403);
});