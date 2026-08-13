import assert from 'node:assert/strict';

import {
  onRequestGet as getTreeCollection,
  onRequestPost as postTreeCollection,
} from '../../functions/api/trees.js';
import {
  onRequestGet as getTreeDetail,
  onRequestPut as putTreeDetail,
  onRequestDelete as deleteTreeDetail,
} from '../../functions/api/trees/[id].js';

const ENV = { MODAL_BASE_URL: 'https://modal.example.test/' };
const REQUEST_ID = 'req-3931';
const AUTH = 'Bearer synthetic-auth';

function abortError() {
  const error = new Error('synthetic abort');
  error.name = 'AbortError';
  return error;
}

async function withFetch(fetcher, callback) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = fetcher;
  try {
    return await callback();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function request(path, { method = 'GET', auth = false, body = null, requestId = REQUEST_ID } = {}) {
  const headers = new Headers();
  if (auth) headers.set('authorization', AUTH);
  if (requestId) headers.set('x-lovebud-request-id', requestId);
  if (body !== null) headers.set('content-type', 'application/json');
  return new Request(`https://lovebud.example.test${path}`, { method, headers, body });
}

function collectionContext(options = {}) {
  return { request: request('/api/trees', options), env: ENV };
}

function detailContext(options = {}) {
  return {
    request: request('/api/trees/tree-1', options),
    env: ENV,
    params: { id: 'tree-1' },
  };
}

function assertTimeout(response, requestId = null) {
  assert.equal(response.status, 504);
  assert.equal(response.headers.get('x-lovebud-upstream'), 'modal');
  assert.equal(response.headers.get('x-lovebud-route-status'), 'modal-timeout');
  assert.equal(response.headers.get('x-lovebud-degraded'), null);
  if (requestId) {
    assert.equal(response.headers.get('x-lovebud-request-id'), requestId);
    assert.match(response.headers.get('access-control-expose-headers') || '', /x-lovebud-request-id/i);
  }
}

function assertUnavailable(response, requestId = null) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-lovebud-upstream'), 'modal');
  assert.equal(response.headers.get('x-lovebud-degraded'), 'modal-unavailable');
  assert.equal(response.headers.get('x-lovebud-route-status'), null);
  if (requestId) assert.equal(response.headers.get('x-lovebud-request-id'), requestId);
}

async function testCollectionClassification() {
  const getTimeout = await withFetch(
    async () => { throw abortError(); },
    () => getTreeCollection(collectionContext())
  );
  assertTimeout(getTimeout, REQUEST_ID);

  const getUnavailable = await withFetch(
    async () => { throw new Error('network down'); },
    () => getTreeCollection(collectionContext())
  );
  assertUnavailable(getUnavailable, REQUEST_ID);

  const postTimeout = await withFetch(
    async () => { throw abortError(); },
    () => postTreeCollection(collectionContext({
      method: 'POST',
      auth: true,
      body: JSON.stringify({ title: 'Tree' }),
      requestId: null,
    }))
  );
  assertTimeout(postTimeout);

  const postUnavailable = await withFetch(
    async () => { throw new Error('connection reset'); },
    () => postTreeCollection(collectionContext({
      method: 'POST',
      auth: true,
      body: JSON.stringify({ title: 'Tree' }),
      requestId: null,
    }))
  );
  assertUnavailable(postUnavailable);
}

async function testDetailWriteClassification() {
  const putTimeout = await withFetch(
    async () => { throw abortError(); },
    () => putTreeDetail(detailContext({
      method: 'PUT',
      auth: true,
      body: JSON.stringify({ title: 'Updated' }),
      requestId: null,
    }))
  );
  assertTimeout(putTimeout);

  const putUnavailable = await withFetch(
    async () => { throw new Error('network down'); },
    () => putTreeDetail(detailContext({
      method: 'PUT',
      auth: true,
      body: JSON.stringify({ title: 'Updated' }),
      requestId: null,
    }))
  );
  assertUnavailable(putUnavailable);

  const deleteTimeout = await withFetch(
    async () => { throw abortError(); },
    () => deleteTreeDetail(detailContext({ method: 'DELETE', auth: true, requestId: null }))
  );
  assertTimeout(deleteTimeout);

  const deleteUnavailable = await withFetch(
    async () => { throw new Error('network down'); },
    () => deleteTreeDetail(detailContext({ method: 'DELETE', auth: true, requestId: null }))
  );
  assertUnavailable(deleteUnavailable);
}

async function testAuthenticatedFallbackHasIndependentBound() {
  let calls = 0;
  const fallbackTimeout = await withFetch(async (url) => {
    calls += 1;
    if (calls === 1) {
      assert.match(String(url), /\/modal\/private\/trees\/tree-1$/);
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    }
    assert.match(String(url), /\/modal\/trees\/tree-1$/);
    throw abortError();
  }, () => getTreeDetail(detailContext({ auth: true })));
  assert.equal(calls, 2);
  assertTimeout(fallbackTimeout, REQUEST_ID);

  calls = 0;
  const primaryTimeout = await withFetch(async () => {
    calls += 1;
    throw abortError();
  }, () => getTreeDetail(detailContext({ auth: true })));
  assert.equal(calls, 1, 'primary timeout must not start public fallback');
  assertTimeout(primaryTimeout, REQUEST_ID);

  calls = 0;
  const primaryUnavailable = await withFetch(async () => {
    calls += 1;
    throw new Error('network down');
  }, () => getTreeDetail(detailContext({ auth: true })));
  assert.equal(calls, 1, 'primary network rejection must not start public fallback');
  assertUnavailable(primaryUnavailable, REQUEST_ID);

  calls = 0;
  const forbidden = await withFetch(async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
  }, () => getTreeDetail(detailContext({ auth: true })));
  assert.equal(calls, 1, '403 must not start public fallback');
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get('x-lovebud-public-tree-cache'), 'bypass-auth');
  assert.equal(forbidden.headers.get('x-lovebud-request-id'), REQUEST_ID);
}

async function testAnonymousDetailRemainsNoStore() {
  let calls = 0;
  const response = await withFetch(async (url) => {
    calls += 1;
    assert.match(String(url), /\/modal\/trees\/tree-1$/);
    return new Response(JSON.stringify({ id: 'tree-1', visibility: 'public' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }, () => getTreeDetail(detailContext()));

  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'modal');
  assert.equal(response.headers.get('x-lovebud-request-id'), REQUEST_ID);
}

await testCollectionClassification();
await testDetailWriteClassification();
await testAuthenticatedFallbackHasIndependentBound();
await testAnonymousDetailRemainsNoStore();
console.log('PASS #3931 Tree Modal timeout/error parity regression');
