// Focused regression contract for the Memory-side true-bounded request-body
// stream (#3920 child). Exercises the shared streaming primitive and the three
// migrated Memory write boundaries (owner proxy, comments, reactions) with
// mocked fetch only. No real network, database, auth provider, deployment, or
// Production resource is used.
//
// Refs #3920
// Refs #1882

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SHARED = path.join(ROOT, 'functions', '_shared', 'bounded-request-body.js');
const PROXY = path.join(ROOT, 'functions', '_shared', 'memory-route-proxy.js');
const COMMENTS = path.join(ROOT, 'functions', 'api', 'memories', '[id]', 'comments.js');
const REACTIONS = path.join(ROOT, 'functions', 'api', 'memories', '[id]', 'reactions.js');

const MAX = 128 * 1024;

async function loadBounded() {
  return import('../../functions/_shared/bounded-request-body.js');
}
async function loadComments() {
  return import('../../functions/api/memories/[id]/comments.js');
}
async function loadReactions() {
  return import('../../functions/api/memories/[id]/reactions.js');
}
async function loadProxy() {
  return import('../../functions/_shared/memory-route-proxy.js');
}

// Run `fn` while globalThis.fetch is a capturing mock that returns a 200 JSON
// Modal response. Returns the route result plus captured fetch call data.
async function withMockFetch(fn) {
  const original = globalThis.fetch;
  const captured = { calls: 0, url: null, options: null };
  globalThis.fetch = async (url, options) => {
    captured.calls += 1;
    captured.url = typeof url === 'string' ? url : url.toString();
    captured.options = options;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await fn();
    return { result, captured };
  } finally {
    globalThis.fetch = original;
  }
}

// A reader that yields the provided chunks then done. Optionally throws on the
// first read, and records cancel() invocations.
function streamingReader(chunks, { throwOnRead = false, cancelSpy = null } = {}) {
  let i = 0;
  return {
    async read() {
      if (throwOnRead) throw new Error('stream exploded');
      if (i >= chunks.length) return { done: true, value: undefined };
      return { done: false, value: chunks[i++] };
    },
    async cancel() {
      if (cancelSpy) cancelSpy();
    },
  };
}

function makeFakeRequest({ headersGet, bodyReader }) {
  return {
    method: 'POST',
    headers: { get: headersGet },
    body: { getReader: () => bodyReader },
  };
}

const VALID_KEY = 'valid-idempotency-key-0123456789';

function commentHeaderGet(overrides = {}) {
  const map = {
    authorization: 'Bearer test-token',
    'idempotency-key': VALID_KEY,
    ...overrides,
  };
  return (h) => (h.toLowerCase() in map ? map[h.toLowerCase()] : null);
}

function oversizedChunks() {
  return [new Uint8Array(MAX + 100), new Uint8Array(50)];
}

// ---------------------------------------------------------------------------
// A. Exact 128 KiB accepted, Modal receives byte-exact payload (comments route)
// ---------------------------------------------------------------------------
test('A. exact 128 KiB comment body accepted and forwarded byte-exact', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await loadComments();
  const payload = new Uint8Array(MAX);
  const request = new Request('https://t.lovebud.pages.dev/api/memories/abc/comments', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
      'Idempotency-Key': VALID_KEY,
    },
    body: payload,
  });

  const { result, captured } = await withMockFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://modal.test' }, params: { id: 'abc' } })
  );

  assert.equal(result.status, 200, 'exact-limit body must be accepted');
  assert.equal(captured.calls, 1, 'Modal fetch must be called once');
  assert.ok(captured.url.includes('/modal/private/memories/abc/comments'));
  assert.ok(Buffer.isBuffer(captured.options.body) || captured.options.body instanceof Uint8Array);
  const sent = Buffer.from(captured.options.body);
  assert.equal(sent.length, MAX, 'forwarded body must be exactly 128 KiB');
  assert.ok(sent.equals(Buffer.from(payload)), 'forwarded bytes must be byte-exact');
});

// ---------------------------------------------------------------------------
// B. +1 byte rejected with 413, Modal fetch count 0 (comments route)
// ---------------------------------------------------------------------------
test('B. 128 KiB + 1 comment body rejected with 413 and Modal not called', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await loadComments();
  const payload = new Uint8Array(MAX + 1);
  const request = new Request('https://t.lovebud.pages.dev/api/memories/abc/comments', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
      'Idempotency-Key': VALID_KEY,
    },
    body: payload,
  });

  const { result, captured } = await withMockFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://modal.test' }, params: { id: 'abc' } })
  );

  assert.equal(result.status, 413, 'over-limit body must be 413');
  assert.equal(captured.calls, 0, 'Modal must not be called for oversized body');
  assert.ok(result.headers.get('content-type')?.startsWith('application/json'));
});

// ---------------------------------------------------------------------------
// C. Missing Content-Length, oversized stream -> 413, Modal fetch 0
// ---------------------------------------------------------------------------
test('C. missing Content-Length oversized stream rejected 413, Modal not called', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await loadComments();
  const request = makeFakeRequest({
    headersGet: commentHeaderGet({ 'content-length': null }),
    bodyReader: streamingReader(oversizedChunks()),
  });

  const { result, captured } = await withMockFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://modal.test' }, params: { id: 'abc' } })
  );

  assert.equal(result.status, 413);
  assert.equal(captured.calls, 0);
});

// ---------------------------------------------------------------------------
// D. Invalid Content-Length, oversized stream -> 413, Modal fetch 0
// ---------------------------------------------------------------------------
test('D. invalid Content-Length oversized stream rejected 413, Modal not called', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await loadComments();
  const request = makeFakeRequest({
    headersGet: commentHeaderGet({ 'content-length': 'abc' }),
    bodyReader: streamingReader(oversizedChunks()),
  });

  const { result, captured } = await withMockFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://modal.test' }, params: { id: 'abc' } })
  );

  assert.equal(result.status, 413);
  assert.equal(captured.calls, 0);
});

// ---------------------------------------------------------------------------
// E. Understated Content-Length, oversized stream -> 413, Modal fetch 0
// ---------------------------------------------------------------------------
test('E. understated Content-Length oversized stream rejected 413, Modal not called', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await loadComments();
  const request = makeFakeRequest({
    headersGet: commentHeaderGet({ 'content-length': '10' }),
    bodyReader: streamingReader(oversizedChunks()),
  });

  const { result, captured } = await withMockFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://modal.test' }, params: { id: 'abc' } })
  );

  assert.equal(result.status, 413);
  assert.equal(captured.calls, 0);
});

// ---------------------------------------------------------------------------
// F. UTF-8 multibyte: byte count (not JS string length) is the authority
// ---------------------------------------------------------------------------
test('F. UTF-8 multibyte enforced by encoded bytes, not string length', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await loadComments();

  // 50k emoji: string length 100000 (< 131072) but 200000 bytes (> limit).
  // Each emoji is a surrogate pair (2 UTF-16 units, 4 UTF-8 bytes), so string
  // length is NOT the byte count.
  const overString = '🫶'.repeat(50_000);
  assert.ok(overString.length < MAX, 'string length must be under limit to isolate byte rule');
  const overRequest = new Request('https://t.lovebud.pages.dev/api/memories/abc/comments', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
      'Idempotency-Key': VALID_KEY,
    },
    body: overString,
  });
  const over = await withMockFetch(() =>
    onRequestPost({ request: overRequest, env: { MODAL_BASE_URL: 'https://modal.test' }, params: { id: 'abc' } })
  );
  assert.equal(over.result.status, 413, 'multibyte over-limit by bytes must be rejected');
  assert.equal(over.captured.calls, 0);

  // 32768 emoji: exactly 131072 bytes, string length 32768.
  const exactString = '🫶'.repeat(32_768);
  assert.equal(Buffer.byteLength(exactString, 'utf8'), MAX, 'multibyte payload must be exactly 128 KiB');
  const exactRequest = new Request('https://t.lovebud.pages.dev/api/memories/abc/comments', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
      'Idempotency-Key': VALID_KEY,
    },
    body: exactString,
  });
  const exact = await withMockFetch(() =>
    onRequestPost({ request: exactRequest, env: { MODAL_BASE_URL: 'https://modal.test' }, params: { id: 'abc' } })
  );
  assert.equal(exact.result.status, 200, 'multibyte exact-limit body must be accepted');
  assert.ok(Buffer.from(exact.captured.options.body).equals(Buffer.from(exactString, 'utf8')));
});

// ---------------------------------------------------------------------------
// G. reader.cancel() attempted on overflow (helper level)
// ---------------------------------------------------------------------------
test('G. helper attempts reader.cancel() on overflow', async () => {
  const { readBoundedRequestBody } = await loadBounded();
  let cancelCalled = false;
  const request = makeFakeRequest({
    headersGet: () => null,
    bodyReader: streamingReader([new Uint8Array(MAX + 50)], { cancelSpy: () => { cancelCalled = true; } }),
  });

  const result = await readBoundedRequestBody(request);
  assert.equal(result.status, 'tooLarge');
  assert.equal(cancelCalled, true, 'reader.cancel() must be attempted on overflow');
});

// ---------------------------------------------------------------------------
// H. Stream read error -> NOT 413, safe failure, Modal fetch 0, no raw leak
// ---------------------------------------------------------------------------
test('H. stream read error maps to safe failure (not 413), Modal not called', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await loadComments();
  const request = makeFakeRequest({
    headersGet: commentHeaderGet(),
    bodyReader: streamingReader([], { throwOnRead: true }),
  });

  const { result, captured } = await withMockFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://modal.test' }, params: { id: 'abc' } })
  );

  assert.notEqual(result.status, 413, 'read failure must not be classified as tooLarge');
  assert.ok([500, 503].includes(result.status), 'read failure must be a safe unavailable/failure status');
  assert.equal(captured.calls, 0, 'Modal must not be called on read failure');
  const body = await result.json();
  assert.equal(typeof body.error, 'string');
  assert.doesNotMatch(JSON.stringify(body), /stream exploded/, 'raw exception text must not be exposed');
});

// ---------------------------------------------------------------------------
// I. Exact forwarding: accepted input bytes === Modal request body bytes
//    (owner proxy POST/PUT path)
// ---------------------------------------------------------------------------
test('I. owner proxy forwards accepted body bytes byte-exact', { timeout: 10_000 }, async () => {
  const { proxyMemoryRouteRequest } = await loadProxy();
  const payload = JSON.stringify({ title: 'hello', memo: 'world' });
  const request = new Request('https://t.lovebud.pages.dev/api/memories', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
    },
    body: payload,
  });

  const { result, captured } = await withMockFetch(() =>
    proxyMemoryRouteRequest({ request, env: { MODAL_BASE_URL: 'https://modal.test' } })
  );

  assert.equal(result.status, 200);
  assert.equal(captured.calls, 1);
  assert.ok(Buffer.from(captured.options.body).equals(Buffer.from(payload)));
});

// ---------------------------------------------------------------------------
// J. Memory comment accepted request preserves Authorization + Idempotency-Key
// ---------------------------------------------------------------------------
test('J. accepted comment request preserves Authorization and Idempotency-Key', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await loadComments();
  const payload = new Uint8Array(16);
  const auth = 'Bearer preserve-auth-xyz';
  const key = VALID_KEY;
  const request = new Request('https://t.lovebud.pages.dev/api/memories/abc/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: auth, 'Idempotency-Key': key },
    body: payload,
  });

  const { result, captured } = await withMockFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://modal.test' }, params: { id: 'abc' } })
  );

  assert.equal(result.status, 200);
  const headers = captured.options.headers;
  assert.equal(headers.authorization, auth, 'Authorization must be forwarded');
  assert.equal(headers['Idempotency-Key'], key, 'Idempotency-Key must be forwarded');
});

// ---------------------------------------------------------------------------
// K. Memory reaction accepted request preserves Authorization + Idempotency-Key
// ---------------------------------------------------------------------------
test('K. accepted reaction request preserves Authorization and Idempotency-Key', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await loadReactions();
  const payload = new Uint8Array(16);
  const auth = 'Bearer preserve-auth-xyz';
  const key = VALID_KEY;
  const request = new Request('https://t.lovebud.pages.dev/api/memories/abc/reactions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: auth, 'Idempotency-Key': key },
    body: payload,
  });

  const { result, captured } = await withMockFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://modal.test' }, params: { id: 'abc' } })
  );

  assert.equal(result.status, 200);
  const headers = captured.options.headers;
  assert.equal(headers.authorization, auth, 'Authorization must be forwarded');
  assert.equal(headers['Idempotency-Key'], key, 'Idempotency-Key must be forwarded');
});

// ---------------------------------------------------------------------------
// L. Memory owner POST/PUT preserves request ID, Content-Type, body bytes
// ---------------------------------------------------------------------------
test('L. owner POST preserves request ID, Content-Type, and body bytes', { timeout: 10_000 }, async () => {
  const { proxyMemoryRouteRequest } = await loadProxy();
  const payload = JSON.stringify({ title: 'keep', memo: 'this' });
  const request = new Request('https://t.lovebud.pages.dev/api/memories', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', authorization: 'Bearer test-token' },
    body: payload,
  });

  const { result, captured } = await withMockFetch(() =>
    proxyMemoryRouteRequest({ request, env: { MODAL_BASE_URL: 'https://modal.test' } }, { requestId: 'req-3920-1' })
  );

  assert.equal(result.status, 200);
  const headers = captured.options.headers;
  assert.equal(headers['x-lovebud-request-id'], 'req-3920-1', 'request ID must be forwarded');
  assert.equal(headers['content-type'], 'application/json; charset=utf-8', 'Content-Type must be forwarded');
  assert.ok(Buffer.from(captured.options.body).equals(Buffer.from(payload)), 'body bytes must be forwarded');
});

// ---------------------------------------------------------------------------
// M. DELETE does not read the body (owner proxy)
// ---------------------------------------------------------------------------
test('M. DELETE request never invokes the body reader', { timeout: 10_000 }, async () => {
  const { proxyMemoryRouteRequest } = await loadProxy();
  let getReaderCalls = 0;
  const request = {
    method: 'DELETE',
    url: 'https://t.lovebud.pages.dev/api/memories/abc',
    headers: { get: (h) => (h.toLowerCase() === 'authorization' ? 'Bearer test-token' : null) },
    body: {
      getReader: () => {
        getReaderCalls += 1;
        throw new Error('DELETE body must not be read');
      },
    },
  };

  const { result, captured } = await withMockFetch(() =>
    proxyMemoryRouteRequest({ request, env: { MODAL_BASE_URL: 'https://modal.test' } })
  );

  assert.equal(getReaderCalls, 0, 'DELETE must not read the request body');
  assert.equal(result.status, 200);
  assert.equal(captured.calls, 1);
});

// ---------------------------------------------------------------------------
// N. Static negative guard: migrated Memory boundaries do not use raw
//    await request.text() / request.json() before limit enforcement.
// ---------------------------------------------------------------------------
test('N. migrated Memory boundaries use streaming read, not raw request.text()/json()', async () => {
  const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const rawBeforeEnforcement = /\bawait\s+request\.(text|json)\s*\(/;
  for (const p of [SHARED, PROXY, COMMENTS, REACTIONS]) {
    const src = fs.readFileSync(p, 'utf8');
    assert.doesNotMatch(stripComments(src), rawBeforeEnforcement, 'no raw await request.text()/json() before enforcement');
  }
  assert.match(fs.readFileSync(SHARED, 'utf8'), /\.getReader\(/);
  assert.match(fs.readFileSync(COMMENTS, 'utf8'), /readBoundedRequestBody\s*\(/);
  assert.match(fs.readFileSync(REACTIONS, 'utf8'), /readBoundedRequestBody\s*\(/);
  assert.match(fs.readFileSync(PROXY, 'utf8'), /readBoundedRequestBody/);
});
