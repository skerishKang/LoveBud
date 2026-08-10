import assert from 'node:assert/strict';
import {
  proxyMemoryRouteRequest,
  buildMemoryModalTimeoutResponse,
  buildMemoryModalUnavailableResponse,
} from '../../functions/_shared/memory-route-proxy.js';
import { MODAL_FETCH_TIMEOUT_MS } from '../../functions/_shared/modal-fetch.js';

const ENV = { MODAL_BASE_URL: 'https://modal.example.test/' };
const AUTH = 'SyntheticAuth';

function request(path, { method = 'GET', auth = false, body = null } = {}) {
  const headers = new Headers();
  if (auth) headers.set('authorization', AUTH);
  if (body !== null) headers.set('content-type', 'application/json');
  return new Request('https://lovebud.example.test' + path, { method, headers, body });
}

function timeoutFetcher() {
  return (_url, options = {}) => new Promise((_resolve, reject) => {
    const abort = () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    };
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
  });
}

async function run() {
  assert.equal(MODAL_FETCH_TIMEOUT_MS, 25000);

  for (const item of [
    { path: '/api/memories', method: 'GET', auth: false },
    { path: '/api/memories', method: 'POST', auth: true, body: JSON.stringify({ title: 'ok' }) },
    { path: '/api/memories/m1', method: 'PUT', auth: true, body: JSON.stringify({ memo: 'ok' }), memoryId: 'm1' },
    { path: '/api/memories/m1', method: 'DELETE', auth: true, memoryId: 'm1' },
  ]) {
    const response = await proxyMemoryRouteRequest(
      { request: request(item.path, item), env: ENV },
      { memoryId: item.memoryId, fetcher: timeoutFetcher(), timeoutMs: 5, requestId: 'req-3930' }
    );
    assert.equal(response.status, 504, `${item.method} timeout status`);
    assert.equal(response.headers.get('x-lovebud-route-status'), 'modal-timeout');
    assert.equal(response.headers.get('x-lovebud-upstream'), 'modal');
    assert.equal(response.headers.get('x-lovebud-request-id'), 'req-3930');
  }

  const rejected = await proxyMemoryRouteRequest(
    { request: request('/api/memories'), env: ENV },
    { fetcher: async () => { throw new Error('network down'); }, requestId: 'req-3930' }
  );
  assert.equal(rejected.status, 503);
  assert.equal(rejected.headers.get('x-lovebud-degraded'), 'modal-unavailable');
  assert.equal(rejected.headers.get('x-lovebud-route-status'), null);

  let fetchCalls = 0;
  const success = await proxyMemoryRouteRequest(
    { request: request('/api/memories/m1', { auth: true }), env: ENV },
    {
      memoryId: 'm1',
      fetcher: async (_url, options) => {
        fetchCalls += 1;
        assert.ok(options.signal instanceof AbortSignal);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
    }
  );
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('x-lovebud-upstream'), 'modal');
  assert.equal(fetchCalls, 1);

  let bodyRead = false;
  const unauth = {
    method: 'POST',
    url: 'https://lovebud.example.test/api/memories',
    headers: { get() { return null; } },
    async text() { bodyRead = true; return '{"title":"x"}'; }
  };
  const authFail = await proxyMemoryRouteRequest(
    { request: unauth, env: ENV },
    { fetcher: async () => { throw new Error('must not fetch'); } }
  );
  assert.equal(authFail.status, 401);
  assert.equal(bodyRead, false);

  assert.equal(buildMemoryModalTimeoutResponse().status, 504);
  assert.equal(buildMemoryModalUnavailableResponse().status, 503);
  console.log('PASS #3930 focused timeout/rejection/auth-order regression');
}

await run();
