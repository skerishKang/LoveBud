const test = require('node:test');
const assert = require('node:assert/strict');

const MODAL_BASE_URL = 'https://modal.example.test/root/';
const ENV = { MODAL_BASE_URL };
const AUTH_VALUE = 'SyntheticAuth';
const MEMORY_ID = 'mem-synthetic-3285';
const TREE_ID = 'tree-synthetic-3285';

function jsonResponse(body = { ok: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

function captureFetch() {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ ok: true });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    }
  };
}

function makeRequest(pathname, { method = 'GET', auth = false, body = null, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (auth) requestHeaders.set('authorization', AUTH_VALUE);
  return new Request(`https://lovebud.example.test${pathname}`, {
    method,
    headers: requestHeaders,
    body
  });
}

function fakeRequest(pathname, { method = 'POST', auth = false, body = '' } = {}) {
  let textWasRead = false;
  return {
    method,
    url: `https://lovebud.example.test${pathname}`,
    headers: {
      get(name) {
        const lower = String(name).toLowerCase();
        if (lower === 'authorization' && auth) return AUTH_VALUE;
        if (lower === 'content-type') return 'application/json';
        if (lower === 'content-length') return String(body.length);
        return null;
      }
    },
    async text() {
      textWasRead = true;
      return body;
    },
    get textWasRead() {
      return textWasRead;
    }
  };
}

function decodeBody(body) {
  if (!body) return '';
  return new TextDecoder().decode(body);
}

async function modules() {
  const [collection, detail, catchall, helper] = await Promise.all([
    import('../../functions/api/memories.js'),
    import('../../functions/api/memories/[id].js'),
    import('../../functions/api/[[path]].js'),
    import('../../functions/_shared/memory-route-proxy.js')
  ]);
  return { collection, detail, catchall, helper };
}

async function callCollection(handlerName, request, env = ENV) {
  const { collection } = await modules();
  return collection[handlerName]({ request, env });
}

async function callDetail(handlerName, request, env = ENV, memoryId = MEMORY_ID) {
  const { detail } = await modules();
  return detail[handlerName]({ request, env, params: { id: memoryId } });
}

test('GET /api/memories maps to /modal/private/memories with treeId and bounded limit', async () => {
  const cap = captureFetch();
  try {
    await callCollection('onRequestGet', makeRequest(`/api/memories?treeId=${TREE_ID}`));
    await callCollection('onRequestGet', makeRequest(`/api/memories?treeId=${TREE_ID}&limit=999`));

    assert.equal(cap.calls.length, 2);
    const first = new URL(cap.calls[0].url);
    assert.equal(first.pathname, '/modal/private/memories');
    assert.equal(first.searchParams.get('treeId'), TREE_ID);
    assert.equal(first.searchParams.get('limit'), '100');

    const second = new URL(cap.calls[1].url);
    assert.equal(second.searchParams.get('limit'), '200');
  } finally {
    cap.restore();
  }
});

test('POST /api/memories forwards method, content-type, auth, and bounded body', async () => {
  const cap = captureFetch();
  try {
    const body = JSON.stringify({ title: 'Synthetic title', memo: 'Synthetic memo' });
    await callCollection('onRequestPost', makeRequest('/api/memories', {
      method: 'POST',
      auth: true,
      body,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    }));

    assert.equal(cap.calls.length, 1);
    assert.equal(new URL(cap.calls[0].url).pathname, '/modal/private/memories');
    assert.equal(cap.calls[0].options.method, 'POST');
    assert.equal(cap.calls[0].options.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(cap.calls[0].options.headers.authorization, AUTH_VALUE);
    assert.equal(decodeBody(cap.calls[0].options.body), body);
  } finally {
    cap.restore();
  }
});

test('GET /api/memories/:id without auth maps to public detail and omits authorization', async () => {
  const cap = captureFetch();
  try {
    await callDetail('onRequestGet', makeRequest(`/api/memories/${MEMORY_ID}`));

    assert.equal(cap.calls.length, 1);
    assert.equal(new URL(cap.calls[0].url).pathname, `/modal/memories/${MEMORY_ID}`);
    assert.equal(cap.calls[0].options.headers.authorization, undefined);
  } finally {
    cap.restore();
  }
});

test('GET /api/memories/:id with auth maps to private detail and forwards authorization', async () => {
  const cap = captureFetch();
  try {
    await callDetail('onRequestGet', makeRequest(`/api/memories/${MEMORY_ID}`, { auth: true }));

    assert.equal(cap.calls.length, 1);
    assert.equal(new URL(cap.calls[0].url).pathname, `/modal/private/memories/${MEMORY_ID}`);
    assert.equal(cap.calls[0].options.headers.authorization, AUTH_VALUE);
  } finally {
    cap.restore();
  }
});

test('PUT /api/memories/:id forwards private method/body/content-type/auth', async () => {
  const cap = captureFetch();
  try {
    const body = JSON.stringify({ title: 'Updated synthetic title' });
    await callDetail('onRequestPut', makeRequest(`/api/memories/${MEMORY_ID}`, {
      method: 'PUT',
      auth: true,
      body,
      headers: { 'content-type': 'application/json' }
    }));

    assert.equal(cap.calls.length, 1);
    assert.equal(new URL(cap.calls[0].url).pathname, `/modal/private/memories/${MEMORY_ID}`);
    assert.equal(cap.calls[0].options.method, 'PUT');
    assert.equal(cap.calls[0].options.headers.authorization, AUTH_VALUE);
    assert.equal(cap.calls[0].options.headers['content-type'], 'application/json');
    assert.equal(decodeBody(cap.calls[0].options.body), body);
  } finally {
    cap.restore();
  }
});

test('DELETE /api/memories/:id forwards private delete with auth and no body', async () => {
  const cap = captureFetch();
  try {
    await callDetail('onRequestDelete', makeRequest(`/api/memories/${MEMORY_ID}`, {
      method: 'DELETE',
      auth: true
    }));

    assert.equal(cap.calls.length, 1);
    assert.equal(new URL(cap.calls[0].url).pathname, `/modal/private/memories/${MEMORY_ID}`);
    assert.equal(cap.calls[0].options.method, 'DELETE');
    assert.equal(cap.calls[0].options.headers.authorization, AUTH_VALUE);
    assert.equal(cap.calls[0].options.body, null);
    assert.equal(cap.calls[0].options.headers['content-type'], undefined);
  } finally {
    cap.restore();
  }
});

test('unauthenticated POST /api/memories returns 401 before body read and fetch', async () => {
  const cap = captureFetch();
  const request = fakeRequest('/api/memories', { method: 'POST', body: JSON.stringify({ title: 'Synthetic title' }) });
  try {
    const response = await callCollection('onRequestPost', request);

    assert.equal(response.status, 401);
    assert.equal(request.textWasRead, false);
    assert.equal(cap.calls.length, 0);
  } finally {
    cap.restore();
  }
});

test('unauthenticated PUT /api/memories/:id returns 401 before body read and fetch', async () => {
  const cap = captureFetch();
  const request = fakeRequest(`/api/memories/${MEMORY_ID}`, { method: 'PUT', body: JSON.stringify({ memo: 'Synthetic memo' }) });
  try {
    const response = await callDetail('onRequestPut', request);

    assert.equal(response.status, 401);
    assert.equal(request.textWasRead, false);
    assert.equal(cap.calls.length, 0);
  } finally {
    cap.restore();
  }
});

test('oversized POST and PUT return 413 without fetch', async () => {
  const cap = captureFetch();
  try {
    const oversized = JSON.stringify({ title: 'x'.repeat(140 * 1024) });
    const post = await callCollection('onRequestPost', makeRequest('/api/memories', {
      method: 'POST',
      auth: true,
      body: oversized,
      headers: { 'content-type': 'application/json' }
    }));
    const put = await callDetail('onRequestPut', makeRequest(`/api/memories/${MEMORY_ID}`, {
      method: 'PUT',
      auth: true,
      body: oversized,
      headers: { 'content-type': 'application/json' }
    }));

    assert.equal(post.status, 413);
    assert.equal(put.status, 413);
    assert.equal(cap.calls.length, 0);
  } finally {
    cap.restore();
  }
});

test('missing MODAL_BASE_URL returns 503 without fetch', async () => {
  const cap = captureFetch();
  try {
    const response = await callCollection('onRequestGet', makeRequest('/api/memories'), {});

    assert.equal(response.status, 503);
    assert.equal(cap.calls.length, 0);
    const body = await response.json();
    assert.equal(body.error, 'MODAL_BASE_URL is not configured');
  } finally {
    cap.restore();
  }
});

test('legacy localization write-boundary guard rejects POST and PUT before fetch', async () => {
  const cap = captureFetch();
  try {
    const post = await callCollection('onRequestPost', makeRequest('/api/memories', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ title: 'tree.title' }),
      headers: { 'content-type': 'application/json' }
    }));
    const put = await callDetail('onRequestPut', makeRequest(`/api/memories/${MEMORY_ID}`, {
      method: 'PUT',
      auth: true,
      body: JSON.stringify({ memo: 'memory.content' }),
      headers: { 'content-type': 'application/json' }
    }));

    assert.equal(post.status, 400);
    assert.equal(put.status, 400);
    assert.equal(cap.calls.length, 0);
  } finally {
    cap.restore();
  }
});

test('#3288 auth-aware memory detail routing remains locked in catch-all buildModalUrl', async () => {
  const { catchall } = await modules();

  const anon = catchall.buildModalUrl(makeRequest(`/api/memories/${MEMORY_ID}`), ENV);
  const authed = catchall.buildModalUrl(makeRequest(`/api/memories/${MEMORY_ID}`, { auth: true }), ENV);

  assert.equal(anon.pathname, `/modal/memories/${MEMORY_ID}`);
  assert.equal(authed.pathname, `/modal/private/memories/${MEMORY_ID}`);
});

test('catch-all buildModalUrl and dedicated handlers agree on all memory route targets', async () => {
  const cap = captureFetch();
  const { catchall } = await modules();
  try {
    const cases = [
      {
        handler: () => callCollection('onRequestGet', makeRequest(`/api/memories?treeId=${TREE_ID}`)),
        request: makeRequest(`/api/memories?treeId=${TREE_ID}`)
      },
      {
        handler: () => callCollection('onRequestPost', makeRequest('/api/memories', {
          method: 'POST',
          auth: true,
          body: JSON.stringify({ title: 'Synthetic title' }),
          headers: { 'content-type': 'application/json' }
        })),
        request: makeRequest('/api/memories', { method: 'POST', auth: true })
      },
      {
        handler: () => callDetail('onRequestGet', makeRequest(`/api/memories/${MEMORY_ID}`)),
        request: makeRequest(`/api/memories/${MEMORY_ID}`)
      },
      {
        handler: () => callDetail('onRequestGet', makeRequest(`/api/memories/${MEMORY_ID}`, { auth: true })),
        request: makeRequest(`/api/memories/${MEMORY_ID}`, { auth: true })
      },
      {
        handler: () => callDetail('onRequestPut', makeRequest(`/api/memories/${MEMORY_ID}`, {
          method: 'PUT',
          auth: true,
          body: JSON.stringify({ memo: 'Synthetic memo' }),
          headers: { 'content-type': 'application/json' }
        })),
        request: makeRequest(`/api/memories/${MEMORY_ID}`, { method: 'PUT', auth: true })
      },
      {
        handler: () => callDetail('onRequestDelete', makeRequest(`/api/memories/${MEMORY_ID}`, {
          method: 'DELETE',
          auth: true
        })),
        request: makeRequest(`/api/memories/${MEMORY_ID}`, { method: 'DELETE', auth: true })
      }
    ];

    for (const item of cases) {
      const before = cap.calls.length;
      await item.handler();
      const dedicatedUrl = new URL(cap.calls[before].url);
      const catchallUrl = catchall.buildModalUrl(item.request, ENV);
      assert.equal(dedicatedUrl.pathname, catchallUrl.pathname);
      assert.equal(dedicatedUrl.search, catchallUrl.search);
    }
  } finally {
    cap.restore();
  }
});

test('method-not-allowed behavior remains compatible for collection and detail memory routes', async () => {
  const cap = captureFetch();
  const { catchall } = await modules();
  try {
    const collection = await catchall.onRequest({
      request: makeRequest('/api/memories', { method: 'PATCH' }),
      env: ENV
    });
    const detail = await catchall.onRequest({
      request: makeRequest(`/api/memories/${MEMORY_ID}`, { method: 'PATCH' }),
      env: ENV
    });

    assert.equal(collection.status, 405);
    assert.equal(collection.headers.get('allow'), 'GET, POST');
    assert.equal(detail.status, 405);
    assert.equal(detail.headers.get('allow'), 'GET, PUT, DELETE');
    assert.equal(cap.calls.length, 0);
  } finally {
    cap.restore();
  }
});

test('memory route proxy helper is the shared contract used by dedicated handlers and catch-all', async () => {
  const { helper } = await modules();
  assert.equal(typeof helper.buildMemoryModalUrl, 'function');
  assert.equal(typeof helper.prepareMemoryWriteProxyRequest, 'function');
  assert.equal(typeof helper.proxyMemoryRouteRequest, 'function');
});
