const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');
const TARGET = path.join(ROOT, 'netlify/functions/memory-detail.js');

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
    noContent: () => ({ statusCode: 204, body: '' }),
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

test('memory-detail: anonymous cannot access private memory', async () => {
  const handler = loadWithMocks({
    './_lib/auth': {
      requireUser: async () => ({ uid: 'owner-1' }),
      getUserFromEvent: async () => null,
    },
    './_lib/doc-store': {
      getMemory: async () => ({ id: 'm1', tree_id: 't1', visibility: 'private' }),
      updateMemory: async () => null,
      deleteMemory: async () => null,
      getTree: async () => ({ id: 't1', owner_id: 'owner-1' }),
      validateVisibility: (v) => v,
      validateSourceType: (v) => v,
      validateOptionalString: (v) => v,
      validateUuid: (v) => v,
    },
    './_lib/serializers': {
      serializeMemory: (m) => ({
        id: m.id,
        treeId: m.tree_id || m.treeId,
        visibility: m.visibility,
      }),
    },
    './_lib/http': httpMocks(),
  }).handler;

  const result = await handler({
    httpMethod: 'GET',
    path: '/api/memories/m1',
    headers: {},
  });

  assert.equal(result.statusCode, 403);
});

test('memory-detail: anonymous can access public memory', async () => {
  const handler = loadWithMocks({
    './_lib/auth': {
      requireUser: async () => ({ uid: 'owner-1' }),
      getUserFromEvent: async () => null,
    },
    './_lib/doc-store': {
      getMemory: async () => ({ id: 'm2', tree_id: 't1', visibility: 'public' }),
      updateMemory: async () => null,
      deleteMemory: async () => null,
      getTree: async () => ({ id: 't1', owner_id: 'owner-1' }),
      validateVisibility: (v) => v,
      validateSourceType: (v) => v,
      validateOptionalString: (v) => v,
      validateUuid: (v) => v,
    },
    './_lib/serializers': {
      serializeMemory: (m) => ({
        id: m.id,
        treeId: m.tree_id || m.treeId,
        visibility: m.visibility,
      }),
    },
    './_lib/http': httpMocks(),
  }).handler;

  const result = await handler({
    httpMethod: 'GET',
    path: '/api/memories/m2',
    headers: {},
  });

  assert.equal(result.statusCode, 200);
});

test('memory-detail: non-owner cannot patch memory', async () => {
  const handler = loadWithMocks({
    './_lib/auth': {
      requireUser: async () => ({ uid: 'intruder' }),
      getUserFromEvent: async () => ({ uid: 'intruder' }),
    },
    './_lib/doc-store': {
      getMemory: async () => ({ id: 'm3', tree_id: 't1', visibility: 'private' }),
      updateMemory: async () => null,
      deleteMemory: async () => null,
      getTree: async () => ({ id: 't1', owner_id: 'owner-1' }),
      validateVisibility: (v) => v,
      validateSourceType: (v) => v,
      validateOptionalString: (v) => v,
      validateUuid: (v) => v,
    },
    './_lib/serializers': {
      serializeMemory: (m) => ({
        id: m.id,
        treeId: m.tree_id || m.treeId,
        visibility: m.visibility,
      }),
    },
    './_lib/http': httpMocks(),
  }).handler;

  const result = await handler({
    httpMethod: 'PATCH',
    path: '/api/memories/m3',
    headers: {},
    body: JSON.stringify({ title: 'hack' }),
  });

  assert.equal(result.statusCode, 403);
});