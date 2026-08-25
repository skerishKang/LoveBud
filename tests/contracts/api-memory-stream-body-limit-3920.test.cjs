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

// ---------------------------------------------------------------------------
// O. Canonical Content-Length syntax: only decimal digits are trusted for the
//    early-optimization over-limit check. Number-parseable-but-invalid syntax
//    ("1e9", "1.5", "+200000", "-1", "abc") must NOT yield a false early 413.
// ---------------------------------------------------------------------------
test('O. isContentLengthOverLimit trusts only canonical decimal Content-Length', async () => {
  const { isContentLengthOverLimit } = await loadBounded();
  const headerFor = (cl) => () => cl;

  // Canonical decimal just over the limit is a valid early-optimization signal.
  const over = makeFakeRequest({
    headersGet: headerFor('131073'),
    bodyReader: { getReader: () => { throw new Error('must not read'); } },
  });
  assert.equal(isContentLengthOverLimit(over, MAX), true, 'canonical 131073 must be over limit');

  // Exactly 128 KiB (canonical) is at the limit, not over.
  const atLimit = makeFakeRequest({
    headersGet: headerFor(String(MAX)),
    bodyReader: { getReader: () => { throw new Error('must not read'); } },
  });
  assert.equal(isContentLengthOverLimit(atLimit, MAX), false, 'exact-limit canonical value must not be over limit');

  // Invalid-but-number-parseable values must never be trusted.
  for (const bad of ['1e9', '1.5', '+200000', '-1', 'abc', '0x10', '1_000', '']) {
    const req = makeFakeRequest({
      headersGet: headerFor(bad),
      bodyReader: { getReader: () => { throw new Error('must not read'); } },
    });
    assert.equal(
      isContentLengthOverLimit(req, MAX),
      false,
      `invalid Content-Length "${bad}" must not be treated as over limit`
    );
  }

  // Missing header is never trusted either.
  const missing = makeFakeRequest({
    headersGet: () => null,
    bodyReader: { getReader: () => { throw new Error('must not read'); } },
  });
  assert.equal(isContentLengthOverLimit(missing, MAX), false, 'missing Content-Length must not be over limit');

  // A canonical decimal that exceeds Number.MAX_SAFE_INTEGER is not trusted as a
  // safe integer; fall back to stream enforcement rather than a wrong early 413.
  const huge = makeFakeRequest({
    headersGet: headerFor('9'.repeat(310)),
    bodyReader: { getReader: () => { throw new Error('must not read'); } },
  });
  assert.equal(isContentLengthOverLimit(huge, MAX), false, 'decimal beyond safe-integer range must not be over limit');
});

// ---------------------------------------------------------------------------
// P. Invalid-but-number-parseable over-limit-looking Content-Length plus a
//    small ACCEPTABLE stream must be accepted (NOT 413): the early-optimization
//    header is ignored and the real streamed byte count is the authority.
// ---------------------------------------------------------------------------
test('P. invalid-but-parseable Content-Length + small stream accepted, Modal called', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await loadComments();
  const small = new Uint8Array(16);
  for (const badHeader of ['1e9', '1.5', '+200000']) {
    const request = makeFakeRequest({
      headersGet: commentHeaderGet({ 'content-length': badHeader }),
      bodyReader: streamingReader([small]),
    });
    const { result, captured } = await withMockFetch(() =>
      onRequestPost({ request, env: { MODAL_BASE_URL: 'https://modal.test' }, params: { id: 'abc' } })
    );
    assert.equal(result.status, 200, `header "${badHeader}" must not cause early 413 for small stream`);
    assert.equal(captured.calls, 1, `Modal must be called once for header "${badHeader}"`);
    assert.ok(
      Buffer.from(captured.options.body).equals(Buffer.from(small)),
      `forwarded bytes must be byte-exact for header "${badHeader}"`
    );
  }
});

// ---------------------------------------------------------------------------
// #4221 Memory reaction direct-Neon executed-fake coverage
// ---------------------------------------------------------------------------

const DIRECT_MEMORY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const DIRECT_MEMORY_ID_HEX = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const DIRECT_REACTION_URL = `https://t.lovebud.pages.dev/api/memories/${DIRECT_MEMORY_ID}/reactions`;
const DIRECT_WRITE_URL = 'postgresql://ep-reaction-test.us-east-2.aws.neon.tech/neondb?sslmode=require';
const DIRECT_ENV = Object.freeze({
  LB_MEMORY_REACTION_WRITE_RUNTIME: 'direct_neon',
  LOVE_PLATFORM_WRITE_DATABASE_URL: DIRECT_WRITE_URL,
});

function reactionRequest({ body = JSON.stringify({ type: 'like' }), memoryId = DIRECT_MEMORY_ID, headers = {} } = {}) {
  return new Request(`https://t.lovebud.pages.dev/api/memories/${memoryId}/reactions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer verified-token',
      'Idempotency-Key': VALID_KEY,
      ...headers,
    },
    body,
  });
}

function makeReactionTransaction({
  ownerId = 'actor-1',
  treeOwnerId = 'someone-else',
  memVisibility = 'public',
  treeVisibility = 'public',
  targetExists = true,
  existingReaction = false,
  counts = [{ type: 'like', count: 1 }],
  replayPayload = null,
  replayState = null,
} = {}) {
  const logs = [];
  const tx = {
    async query(text, values = []) {
      logs.push({ text, values: Array.isArray(values) ? [...values] : values });

      if (text.includes('pg_advisory_xact_lock')) return [];
      if (text.includes('FROM memories m') && text.includes('FOR SHARE OF m, t')) {
        return targetExists
          ? [{
              id: DIRECT_MEMORY_ID,
              tree_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              mem_visibility: memVisibility,
              tree_owner_id: treeOwnerId,
              tree_visibility: treeVisibility,
            }]
          : [];
      }
      if (text.includes('INSERT INTO social_idempotency')) {
        if (replayState) {
          return [{
            id: 'idem-existing',
            target_memory_id: values[5],
            result_id: 'reaction-stored',
            result_state: replayState,
            request_fingerprint: values[4],
            result_payload: replayPayload,
          }];
        }
        return [{
          id: values[0],
          target_memory_id: values[5],
          result_id: values[6],
          result_state: 'pending',
          request_fingerprint: values[4],
          result_payload: null,
        }];
      }
      if (text.includes('SELECT id FROM reactions')) {
        return existingReaction ? [{ id: 'reaction-existing' }] : [];
      }
      if (text.includes('SELECT type, COUNT(*)::int AS count')) return counts;
      return [];
    },
  };
  const adapter = {
    async runTransaction(work) {
      return { value: await work(tx) };
    },
  };
  return { tx, adapter, logs, ownerId };
}

function findLog(logs, pattern) {
  return logs.findIndex((entry) => entry.text.includes(pattern));
}

async function expectedSha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Buffer.from(digest).toString('hex');
}

test('Q. #4221 direct gate is explicit and default/modal/unknown remain non-direct', async () => {
  const mod = await import('../../functions/_shared/memory-reaction-direct-neon.js');
  assert.equal(mod.isMemoryReactionDirectNeonSelected({}), false);
  assert.equal(mod.isMemoryReactionDirectNeonSelected({ LB_MEMORY_REACTION_WRITE_RUNTIME: 'modal' }), false);
  assert.equal(mod.isMemoryReactionDirectNeonSelected({ LB_MEMORY_REACTION_WRITE_RUNTIME: 'unknown' }), false);
  assert.equal(mod.isMemoryReactionDirectNeonSelected(DIRECT_ENV), true);
  assert.equal(mod.isMemoryReactionDirectNeonRequest(reactionRequest()), true);
  assert.equal(mod.isMemoryReactionDirectNeonRequest(new Request(DIRECT_REACTION_URL, { method: 'GET' })), false);
});

test('R. #4221 direct POST executes without MODAL_BASE_URL and preserves transaction ordering', async () => {
  const { onRequestPost } = await loadReactions();
  const fake = makeReactionTransaction();
  const request = reactionRequest({ headers: { 'x-owner-id': 'forged-browser-owner' } });

  const { result, captured } = await withMockFetch(() => onRequestPost({
    request,
    env: { ...DIRECT_ENV },
    params: { id: DIRECT_MEMORY_ID },
    directNeonTestOverrides: {
      verifyTokenOverride: async () => ({ uid: fake.ownerId }),
      transactionAdapterOverride: fake.adapter,
    },
  }));

  assert.equal(result.status, 200);
  assert.equal(captured.calls, 0, 'direct mode must not call Modal');
  assert.deepEqual(await result.json(), { type: 'like', active: true, counts: { like: 1 }, total: 1 });
  assert.equal(result.headers.get('x-lovebud-runtime'), 'direct_neon');

  const lock = findLog(fake.logs, 'pg_advisory_xact_lock');
  const auth = findLog(fake.logs, 'FROM memories m');
  const idem = findLog(fake.logs, 'INSERT INTO social_idempotency');
  const mutation = findLog(fake.logs, 'INSERT INTO reactions');
  const count = findLog(fake.logs, 'SELECT type, COUNT(*)::int AS count');
  const complete = findLog(fake.logs, 'UPDATE social_idempotency');
  const audit = findLog(fake.logs, 'INSERT INTO social_audit_log');
  assert.ok(lock >= 0 && auth > lock && idem > auth && mutation > idem && count > mutation && complete > count && audit > complete);

  const idemLog = fake.logs[idem];
  assert.equal(idemLog.values[1], fake.ownerId, 'verified Firebase UID must be actor authority');
  assert.notEqual(idemLog.values[1], 'forged-browser-owner');
});

test('S. #4221 owner may react to own private Memory while non-owner private access is leak-safe 404', async () => {
  const mod = await import('../../functions/_shared/memory-reaction-direct-neon.js');

  const ownerFake = makeReactionTransaction({
    treeOwnerId: 'actor-1',
    memVisibility: 'private',
    treeVisibility: 'private',
  });
  const ownerResponse = await mod.handleMemoryReactionDirectNeon(
    reactionRequest(),
    DIRECT_ENV,
    {
      memoryIdOverride: DIRECT_MEMORY_ID,
      idempotencyKeyOverride: VALID_KEY,
      bodyBytesOverride: Buffer.from(JSON.stringify({ type: 'like' })),
      verifyTokenOverride: async () => ({ uid: 'actor-1' }),
      transactionAdapterOverride: ownerFake.adapter,
    },
  );
  assert.equal(ownerResponse.status, 200);

  const nonOwnerFake = makeReactionTransaction({
    treeOwnerId: 'owner-2',
    memVisibility: 'private',
    treeVisibility: 'public',
  });
  const nonOwnerResponse = await mod.handleMemoryReactionDirectNeon(
    reactionRequest(),
    DIRECT_ENV,
    {
      memoryIdOverride: DIRECT_MEMORY_ID,
      idempotencyKeyOverride: VALID_KEY,
      bodyBytesOverride: Buffer.from(JSON.stringify({ type: 'like' })),
      verifyTokenOverride: async () => ({ uid: 'actor-1' }),
      transactionAdapterOverride: nonOwnerFake.adapter,
    },
  );
  assert.equal(nonOwnerResponse.status, 404);
  assert.deepEqual(await nonOwnerResponse.json(), { detail: 'Memory not found' });
  assert.equal(findLog(nonOwnerFake.logs, 'INSERT INTO social_idempotency'), -1, 'inaccessible target must fail before idempotency mutation');
  assert.equal(findLog(nonOwnerFake.logs, 'INSERT INTO reactions'), -1, 'inaccessible target must fail before reaction mutation');
});

test('T. #4221 existing reaction toggles off and returns canonical aggregate DTO', async () => {
  const mod = await import('../../functions/_shared/memory-reaction-direct-neon.js');
  const fake = makeReactionTransaction({ existingReaction: true, counts: [] });
  const response = await mod.handleMemoryReactionDirectNeon(
    reactionRequest(),
    DIRECT_ENV,
    {
      memoryIdOverride: DIRECT_MEMORY_ID,
      idempotencyKeyOverride: VALID_KEY,
      bodyBytesOverride: Buffer.from('{"type":"like"}'),
      verifyTokenOverride: async () => ({ uid: fake.ownerId }),
      transactionAdapterOverride: fake.adapter,
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { type: 'like', active: false, counts: {}, total: 0 });
  assert.ok(findLog(fake.logs, 'DELETE FROM reactions') >= 0);
  assert.equal(findLog(fake.logs, 'INSERT INTO reactions'), -1);
});

test('U. #4221 same-key completed replay returns stored DTO without second toggle', async () => {
  const mod = await import('../../functions/_shared/memory-reaction-direct-neon.js');
  const stored = { type: 'like', active: true, counts: { like: 3 }, total: 3 };
  const fake = makeReactionTransaction({ replayState: 'completed', replayPayload: stored });
  const response = await mod.handleMemoryReactionDirectNeon(
    reactionRequest(),
    DIRECT_ENV,
    {
      memoryIdOverride: DIRECT_MEMORY_ID,
      idempotencyKeyOverride: VALID_KEY,
      bodyBytesOverride: Buffer.from('{"type":"like"}'),
      verifyTokenOverride: async () => ({ uid: fake.ownerId }),
      transactionAdapterOverride: fake.adapter,
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), stored);
  assert.equal(findLog(fake.logs, 'SELECT id FROM reactions'), -1, 'replay must not inspect/apply a second toggle');
  assert.equal(findLog(fake.logs, 'INSERT INTO reactions'), -1);
  assert.equal(findLog(fake.logs, 'DELETE FROM reactions'), -1);
  const audit = fake.logs.find((entry) => entry.text.includes('INSERT INTO social_audit_log'));
  assert.equal(audit.values[3], 'reaction.toggle.replay');
});

test('V. #4221 Firebase verification failure occurs before DB transaction acquisition', async () => {
  const mod = await import('../../functions/_shared/memory-reaction-direct-neon.js');
  let transactionCalls = 0;
  const response = await mod.handleMemoryReactionDirectNeon(
    reactionRequest(),
    DIRECT_ENV,
    {
      memoryIdOverride: DIRECT_MEMORY_ID,
      idempotencyKeyOverride: VALID_KEY,
      bodyBytesOverride: Buffer.from('{"type":"like"}'),
      verifyTokenOverride: async () => null,
      transactionAdapterOverride: {
        async runTransaction() {
          transactionCalls += 1;
          throw new Error('must not run');
        },
      },
    },
  );
  assert.equal(response.status, 401);
  assert.equal(transactionCalls, 0);
});

test('W. #4221 generic/read DB URL cannot substitute for dedicated writer config', async () => {
  const mod = await import('../../functions/_shared/memory-reaction-direct-neon.js');
  const env = {
    LB_MEMORY_REACTION_WRITE_RUNTIME: 'direct_neon',
    LOVE_PLATFORM_DATABASE_URL: DIRECT_WRITE_URL,
  };
  assert.equal(mod.readMemoryReactionWriteConfig(env).configured, false);
  assert.equal(mod.detectForbiddenMemoryReactionWriterFallback(env).name, 'LOVE_PLATFORM_DATABASE_URL');
  const response = await mod.handleMemoryReactionDirectNeon(
    reactionRequest(),
    env,
    {
      memoryIdOverride: DIRECT_MEMORY_ID,
      idempotencyKeyOverride: VALID_KEY,
      bodyBytesOverride: Buffer.from('{"type":"like"}'),
      verifyTokenOverride: async () => ({ uid: 'actor-1' }),
    },
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'DIRECT_NEON_CONFIG_FORBIDDEN_FALLBACK');
});

test('X. #4221 unknown COMMIT outcome is explicit 502 and never falls back to Modal', async () => {
  const { onRequestPost } = await loadReactions();
  const txMod = await import('../../functions/_shared/db/neon-ws-transaction-adapter.js');
  const request = reactionRequest();
  const { result, captured } = await withMockFetch(() => onRequestPost({
    request,
    env: { ...DIRECT_ENV },
    params: { id: DIRECT_MEMORY_ID },
    directNeonTestOverrides: {
      verifyTokenOverride: async () => ({ uid: 'actor-1' }),
      transactionAdapterOverride: {
        async runTransaction() {
          throw new txMod.NeonWsTransactionError(
            txMod.NEON_WS_TRANSACTION_ERROR.COMMIT_OUTCOME_UNKNOWN,
            'COMMIT_OUTCOME_UNKNOWN'
          );
        },
      },
    },
  }));
  assert.equal(result.status, 502);
  assert.equal((await result.json()).code, 'COMMIT_OUTCOME_UNKNOWN');
  assert.equal(captured.calls, 0, 'unknown commit must not fall back to Modal');
});

test('Y. #4221 Python-compatible UUID normalization accepts 32-hex and emits canonical UUID', async () => {
  const mod = await import('../../functions/_shared/memory-reaction-direct-neon.js');
  const fake = makeReactionTransaction();
  const response = await mod.handleMemoryReactionDirectNeon(
    reactionRequest({ memoryId: DIRECT_MEMORY_ID_HEX }),
    DIRECT_ENV,
    {
      memoryIdOverride: DIRECT_MEMORY_ID_HEX,
      idempotencyKeyOverride: VALID_KEY,
      bodyBytesOverride: Buffer.from('{"type":"like"}'),
      verifyTokenOverride: async () => ({ uid: fake.ownerId }),
      transactionAdapterOverride: fake.adapter,
    },
  );
  assert.equal(response.status, 200);
  const auth = fake.logs.find((entry) => entry.text.includes('FROM memories m'));
  assert.equal(auth.values[0], DIRECT_MEMORY_ID);
});

test('Z. #4221 idempotency fingerprint matches Python json.dumps spacing, not compact JSON.stringify', async () => {
  const mod = await import('../../functions/_shared/memory-reaction-direct-neon.js');
  const fake = makeReactionTransaction();
  const response = await mod.handleMemoryReactionDirectNeon(
    reactionRequest(),
    DIRECT_ENV,
    {
      memoryIdOverride: DIRECT_MEMORY_ID,
      idempotencyKeyOverride: VALID_KEY,
      bodyBytesOverride: Buffer.from('{"type":"LIKE"}'),
      verifyTokenOverride: async () => ({ uid: fake.ownerId }),
      transactionAdapterOverride: fake.adapter,
    },
  );
  assert.equal(response.status, 200);
  const idem = fake.logs.find((entry) => entry.text.includes('INSERT INTO social_idempotency'));
  const pythonFingerprint = await expectedSha256('{"type": "like"}');
  const compactFingerprint = await expectedSha256('{"type":"like"}');
  assert.equal(idem.values[4], pythonFingerprint);
  assert.notEqual(idem.values[4], compactFingerprint);
});

test('AA. #4221 direct gate affects POST only; GET remains the existing Modal path', async () => {
  const { onRequestGet } = await loadReactions();
  const request = new Request(DIRECT_REACTION_URL, {
    method: 'GET',
    headers: { authorization: 'Bearer test-token' },
  });
  const { result, captured } = await withMockFetch(() => onRequestGet({
    request,
    env: { ...DIRECT_ENV, MODAL_BASE_URL: 'https://modal.test' },
    params: { id: DIRECT_MEMORY_ID },
  }));
  assert.equal(result.status, 200);
  assert.equal(captured.calls, 1);
  assert.ok(captured.url.includes(`/modal/private/memories/${DIRECT_MEMORY_ID}/reactions`));
});

test('AB. #4221 invalid direct JSON fails after auth but before DB transaction', async () => {
  const { onRequestPost } = await loadReactions();
  let transactionCalls = 0;
  const request = reactionRequest({ body: '{' });
  const { result, captured } = await withMockFetch(() => onRequestPost({
    request,
    env: { ...DIRECT_ENV },
    params: { id: DIRECT_MEMORY_ID },
    directNeonTestOverrides: {
      verifyTokenOverride: async () => ({ uid: 'actor-1' }),
      transactionAdapterOverride: {
        async runTransaction() {
          transactionCalls += 1;
          throw new Error('must not run');
        },
      },
    },
  }));
  assert.equal(result.status, 400);
  assert.deepEqual(await result.json(), { detail: 'Invalid JSON body' });
  assert.equal(transactionCalls, 0);
  assert.equal(captured.calls, 0);
});
