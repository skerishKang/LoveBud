const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');
const TARGET = path.join(ROOT, 'netlify/functions/tree-detail.js');

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

test('tree-detail: anonymous cannot access private tree', async () => {
  const handler = loadWithMocks({
    './_lib/auth': {
      getUserFromEvent: async () => null,
      requireUser: async () => ({ uid: 'owner-1' }),
    },
    './_lib/doc-store': {
      getTree: async () => ({ id: 't1', owner_id: 'owner-1', visibility: 'private' }),
      queryMemories: async () => [],
      updateTree: async () => null,
      deleteTree: async () => null,
      validateUuid: (v) => v,
      validateVisibility: (v) => v,
      validateOptionalString: (v) => v,
    },
    './_lib/serializers': {
      serializeTree: (t) => ({
        id: t.id,
        ownerId: t.owner_id,
        visibility: t.visibility,
      }),
      serializeMemoryList: (rows) => rows,
    },
    './_lib/http': httpMocks(),
  }).handler;

  const result = await handler({
    httpMethod: 'GET',
    path: '/api/trees/t1',
    headers: {},
  });

  assert.equal(result.statusCode, 403);
});

test('tree-detail: anonymous can access public tree', async () => {
  const handler = loadWithMocks({
    './_lib/auth': {
      getUserFromEvent: async () => null,
      requireUser: async () => ({ uid: 'owner-1' }),
    },
    './_lib/doc-store': {
      getTree: async () => ({ id: 't2', owner_id: 'owner-1', visibility: 'public' }),
      queryMemories: async () => [],
      updateTree: async () => null,
      deleteTree: async () => null,
      validateUuid: (v) => v,
      validateVisibility: (v) => v,
      validateOptionalString: (v) => v,
    },
    './_lib/serializers': {
      serializeTree: (t) => ({
        id: t.id,
        ownerId: t.owner_id,
        visibility: t.visibility,
      }),
      serializeMemoryList: (rows) => rows,
    },
    './_lib/http': httpMocks(),
  }).handler;

  const result = await handler({
    httpMethod: 'GET',
    path: '/api/trees/t2',
    headers: {},
  });

  assert.equal(result.statusCode, 200);
});

test('tree-detail: non-owner cannot update tree', async () => {
  const handler = loadWithMocks({
    './_lib/auth': {
      getUserFromEvent: async () => ({ uid: 'intruder' }),
      requireUser: async () => ({ uid: 'intruder' }),
    },
    './_lib/doc-store': {
      getTree: async () => ({ id: 't3', owner_id: 'owner-1', visibility: 'private', title: 'T' }),
      queryMemories: async () => [],
      updateTree: async () => null,
      deleteTree: async () => null,
      validateUuid: (v) => v,
      validateVisibility: (v) => v,
      validateOptionalString: (v) => v,
    },
    './_lib/serializers': {
      serializeTree: (t) => ({
        id: t.id,
        ownerId: t.owner_id,
        visibility: t.visibility,
      }),
      serializeMemoryList: (rows) => rows,
    },
    './_lib/http': httpMocks(),
  }).handler;

  const result = await handler({
    httpMethod: 'PUT',
    path: '/api/trees/t3',
    headers: {},
    body: JSON.stringify({ title: 'hack' }),
  });

  assert.equal(result.statusCode, 403);
});