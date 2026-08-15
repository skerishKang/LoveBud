'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

const TREES_JS = path.join(ROOT, 'functions/api/trees.js');
const TREE_DETAIL_JS = path.join(ROOT, 'functions/api/trees/[id].js');

function readSrc(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractFunctionBlock(content, functionName) {
  let idx = content.indexOf(`async function ${functionName}`);
  if (idx === -1) idx = content.indexOf(`function ${functionName}`);
  assert.notEqual(idx, -1, `${functionName} should exist`);
  const openBrace = content.indexOf('{', idx);
  assert.notEqual(openBrace, -1, `${functionName} should have body`);
  let depth = 0;
  for (let i = openBrace; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') depth--;
    if (depth === 0) return content.slice(openBrace, i + 1);
  }
  assert.fail(`${functionName} body should be closed`);
}

// ─── Static source-level tests ─────────────────────────────────────────────

test('A. trees.js imports shared request-id and modal-fetch helpers', () => {
  const content = readSrc('functions/api/trees.js');
  assert.ok(content.includes("from '../_shared/request-id.js'"));
  assert.ok(content.includes('REQUEST_ID_HEADER'));
  assert.ok(content.includes('getOrCreateRequestId'));
  assert.ok(content.includes("from '../_shared/modal-fetch.js'"));
  assert.ok(content.includes('fetchModalWithTimeout'), 'trees.js must use shared bounded fetchModalWithTimeout');
  assert.ok(content.includes('isModalTimeoutError'));
  assert.doesNotMatch(content, /await fetch\((?!ModalWithTimeout)/, 'trees.js must not bypass Modal timeout authority with raw fetch');
});

test('B. trees/[id].js imports shared request-id and modal-fetch helpers', () => {
  const content = readSrc('functions/api/trees/[id].js');
  assert.ok(content.includes("from '../../_shared/request-id.js'"));
  assert.ok(content.includes('REQUEST_ID_HEADER'));
  assert.ok(content.includes('getOrCreateRequestId'));
  assert.ok(content.includes("from '../../_shared/modal-fetch.js'"));
  assert.ok(content.includes('fetchModalWithTimeout'), 'trees/[id].js must use shared bounded fetchModalWithTimeout');
  assert.ok(content.includes('isModalTimeoutError'));
  assert.doesNotMatch(content, /await fetch\((?!ModalWithTimeout)/, 'trees/[id].js must not bypass Modal timeout authority with raw fetch');
});

test('C. onRequestPost creates requestId at entry and propagates through all paths', () => {
  const content = readSrc('functions/api/trees.js');
  const block = extractFunctionBlock(content, 'onRequestPost');
  assert.ok(block.includes('const requestId = getOrCreateRequestId(request)'));
  assert.ok(block.includes('buildMissingAuthorizationResponse(requestId)'));
  assert.ok(block.includes('buildPayloadTooLargeResponse(requestId)'));
  assert.ok(block.includes('buildModalConfigMissingResponse(requestId)'));
  assert.ok(block.includes('buildModalTimeoutResponse(requestId)'));
  assert.ok(block.includes('buildModalUnavailableResponse(requestId)'));
  assert.ok(block.includes('withModalHeaderAndId(response, requestId)'));
  assert.ok(block.includes('[REQUEST_ID_HEADER]: requestId'));
});

test('D. onRequestPut creates requestId at entry and propagates through all paths', () => {
  const content = readSrc('functions/api/trees/[id].js');
  const block = extractFunctionBlock(content, 'onRequestPut');
  assert.ok(block.includes('const requestId = getOrCreateRequestId(request)'));
  assert.ok(block.includes('buildMissingAuthorizationResponse(requestId)'));
  assert.ok(block.includes('buildPayloadTooLargeResponse(requestId)'));
  assert.ok(block.includes('buildModalConfigMissingResponse(requestId)'));
  assert.ok(block.includes('buildModalTimeoutResponse(requestId)'));
  assert.ok(block.includes('buildModalUnavailableResponse(requestId)'));
  assert.ok(block.includes('withModalHeader(response, requestId)'));
  assert.ok(block.includes('[REQUEST_ID_HEADER]: requestId'));
});

test('E. onRequestDelete creates requestId at entry and propagates through all paths', () => {
  const content = readSrc('functions/api/trees/[id].js');
  const block = extractFunctionBlock(content, 'onRequestDelete');
  assert.ok(block.includes('const requestId = getOrCreateRequestId(request)'));
  assert.ok(block.includes('buildMissingAuthorizationResponse(requestId)'));
  assert.ok(block.includes('buildModalConfigMissingResponse(requestId)'));
  assert.ok(block.includes('buildModalTimeoutResponse(requestId)'));
  assert.ok(block.includes('buildModalUnavailableResponse(requestId)'));
  assert.ok(block.includes('withModalHeader(response, requestId)'));
  assert.ok(block.includes('[REQUEST_ID_HEADER]: requestId'));
});

// ─── Runtime no-network tests ──────────────────────────────────────────────

test('F. POST /api/trees missing-auth response includes x-lovebud-request-id', async () => {
  const treesModule = await importAbsolute(TREES_JS);
  const context = {
    request: new Request('https://lovebud.pages.dev/api/trees', { method: 'POST' }),
    env: {}
  };
  const response = await treesModule.onRequestPost(context);
  assert.equal(response.status, 401, 'missing auth should return 401');
  const requestId = response.headers.get('x-lovebud-request-id');
  assert.ok(requestId, 'missing-auth must include x-lovebud-request-id');
  assert.ok(requestId.startsWith('req-'), 'request-id must use req- prefix');
  const exposeHeaders = response.headers.get('Access-Control-Expose-Headers');
  assert.ok(exposeHeaders && exposeHeaders.includes('x-lovebud-request-id'));
});

test('G. PUT /api/trees/[id] missing-auth response includes x-lovebud-request-id', async () => {
  const treeDetailModule = await importAbsolute(TREE_DETAIL_JS);
  const context = {
    request: new Request('https://lovebud.pages.dev/api/trees/123', { method: 'PUT' }),
    params: { id: '123' },
    env: {}
  };
  const response = await treeDetailModule.onRequestPut(context);
  assert.equal(response.status, 401, 'missing auth should return 401');
  const requestId = response.headers.get('x-lovebud-request-id');
  assert.ok(requestId, 'missing-auth must include x-lovebud-request-id');
  assert.ok(requestId.startsWith('req-'), 'request-id must use req- prefix');
});

test('H. DELETE /api/trees/[id] missing-auth response includes x-lovebud-request-id', async () => {
  const treeDetailModule = await importAbsolute(TREE_DETAIL_JS);
  const context = {
    request: new Request('https://lovebud.pages.dev/api/trees/123', { method: 'DELETE' }),
    params: { id: '123' },
    env: {}
  };
  const response = await treeDetailModule.onRequestDelete(context);
  assert.equal(response.status, 401, 'missing auth should return 401');
  const requestId = response.headers.get('x-lovebud-request-id');
  assert.ok(requestId, 'missing-auth must include x-lovebud-request-id');
  assert.ok(requestId.startsWith('req-'), 'request-id must use req- prefix');
});

test('I. POST /api/trees success response includes x-lovebud-request-id', async () => {
  const treesModule = await importAbsolute(TREES_JS);
  const originalFetch = global.fetch;
  global.fetch = () => Promise.resolve(new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  }));
  try {
    const context = {
      request: new Request('https://lovebud.pages.dev/api/trees', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-token'
        },
        body: JSON.stringify({ title: 'Test', memo: 'Test' })
      }),
      env: { MODAL_BASE_URL: 'https://test.modal.com' }
    };
    const response = await treesModule.onRequestPost(context);
    assert.equal(response.status, 200, 'success should return 200');
    const requestId = response.headers.get('x-lovebud-request-id');
    assert.ok(requestId, 'success must include x-lovebud-request-id');
    assert.ok(requestId.startsWith('req-'), 'request-id must use req- prefix');
    const exposeHeaders = response.headers.get('Access-Control-Expose-Headers');
    assert.ok(exposeHeaders && exposeHeaders.includes('x-lovebud-request-id'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('J. PUT /api/trees/[id] success response includes x-lovebud-request-id', async () => {
  const treeDetailModule = await importAbsolute(TREE_DETAIL_JS);
  const originalFetch = global.fetch;
  global.fetch = () => Promise.resolve(new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  }));
  try {
    const context = {
      request: new Request('https://lovebud.pages.dev/api/trees/123', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer test-token'
        },
        body: JSON.stringify({ title: 'Test', memo: 'Test' })
      }),
      params: { id: '123' },
      env: { MODAL_BASE_URL: 'https://test.modal.com' }
    };
    const response = await treeDetailModule.onRequestPut(context);
    assert.equal(response.status, 200, 'success should return 200');
    const requestId = response.headers.get('x-lovebud-request-id');
    assert.ok(requestId, 'success must include x-lovebud-request-id');
    assert.ok(requestId.startsWith('req-'), 'request-id must use req- prefix');
  } finally {
    global.fetch = originalFetch;
  }
});