const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CATCHALL_JS = path.join(ROOT, 'functions/api/[[path]].js');
const MODAL_HELPERS_PY = path.join(ROOT, 'modal_compute/api_response_helpers.py');
const TREE_COMMENT_JS = path.join(ROOT, 'functions/api/trees/[tree_id]/comments.js');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function sliceBetween(content, startPattern, endPattern) {
  const start = content.search(startPattern);
  assert.notEqual(start, -1, `${startPattern} should exist`);

  const afterStart = content.slice(start);
  const end = afterStart.search(endPattern);
  assert.notEqual(end, -1, `${endPattern} should exist after ${startPattern}`);

  return afterStart.slice(0, end);
}

test('Cloudflare write proxy reads and rebuilds a bounded write body without relying on content-length', () => {
  const source = readFile(CATCHALL_JS);

  assert.match(source, /const\s+MAX_WRITE_BODY_BYTES\s*=\s*128\s*\*\s*1024/);
  assert.match(source, /function\s+getContentLengthBytes\s*\(/);
  assert.match(source, /async\s+function\s+readBoundedWriteBody\s*\(/);
  assert.match(source, /function\s+buildPayloadTooLargeResponse\s*\(/);

  const limitBlock = sliceBetween(
    source,
    /async\s+function\s+readBoundedWriteBody\s*\(/,
    /function\s+buildPayloadTooLargeResponse\s*\(/
  );
  assert.match(limitBlock, /await request\.text\(\)/, 'Cloudflare guard must read body with text()');
  assert.match(limitBlock, /encoded\.byteLength\s*>\s*MAX_WRITE_BODY_BYTES/);
  assert.match(limitBlock, /tooLarge:\s*true,\s*body:\s*null/);
  assert.match(limitBlock, /return\s*\{[^}]*tooLarge:\s*false[^}]*body:\s*encoded\s*\}/);
});

test('Cloudflare write proxy rejects oversized non-DELETE write requests before forwarding', () => {
  const source = readFile(CATCHALL_JS);
  const writeBlock = sliceBetween(
    source,
    /async\s+function\s+tryModalWrite\s*\(/,
    /export\s+async\s+function\s+onRequest\s*\(/
  );

  assert.match(writeBlock, /let\s+boundedBody\s*=\s*null/);
  assert.match(writeBlock, /const\s+bodyCheck\s*=\s*await\s+readBoundedWriteBody\(request\)/);
  assert.match(writeBlock, /if\s*\(bodyCheck\.tooLarge\)/);
  assert.match(writeBlock, /return\s+buildPayloadTooLargeResponse\(requestId\)/);
  assert.match(writeBlock, /boundedBody\s*=\s*bodyCheck\.body/);
  assert.match(writeBlock, /body:\s*method\s*!==\s*'DELETE'\s*\?\s*boundedBody\s*:\s*null/);
});

test('Cloudflare oversized body response is safe JSON and does not echo request body', () => {
  const source = readFile(CATCHALL_JS);
  const responseBlock = sliceBetween(
    source,
    /function\s+buildPayloadTooLargeResponse\s*\(/,
    /function\s+isBrowseSummaryRequest\s*\(/
  );

  assert.match(responseBlock, /status:\s*413/);
  assert.match(responseBlock, /Request body too large/);
  assert.match(responseBlock, /application\/json/);
  assert.match(responseBlock, /payload-too-large/);
  assert.doesNotMatch(responseBlock, /request\.body/);
  assert.doesNotMatch(responseBlock, /await\s+request\.text/);
  assert.doesNotMatch(responseBlock, /await\s+request\.json/);
});

test('Modal JSON parser enforces the same body size limit while reading the stream', () => {
  const source = readFile(MODAL_HELPERS_PY);

  assert.match(source, /MAX_JSON_BODY_BYTES\s*=\s*128\s*\*\s*1024/);
  assert.match(source, /def\s+_get_content_length\s*\(/);
  assert.match(source, /def\s+_raise_if_content_length_too_large\s*\(/);
  assert.match(source, /async\s+def\s+_read_bounded_body\s*\(/);
  assert.match(source, /async\s+for\s+chunk\s+in\s+request\.stream\(\)/);
  assert.match(source, /total_size\s*\+=\s*len\(chunk\)/);
  assert.match(source, /total_size\s*>\s*MAX_JSON_BODY_BYTES/);
  assert.match(source, /HTTPException\(status_code=413,\s*detail="Request body too large"\)/);

  const parseStart = source.indexOf('async def parse_json_body');
  assert.notEqual(parseStart, -1, 'parse_json_body should exist');
  const parseBody = source.slice(parseStart);
  assert.ok(
    parseBody.indexOf('body = await _read_bounded_body(request)') < parseBody.indexOf('json.loads(body)'),
    'Modal parser must enforce stream body size before JSON parsing'
  );
  assert.doesNotMatch(parseBody, /await\s+request\.json\(\)/, 'Modal parser must not call request.json() before size enforcement');
});

/**
 * Runtime test — actually invokes the Cloudflare Pages Function handler
 * with real Request objects to verify oversized body rejection.
 */
test('runtime: Cloudflare write proxy returns 413 for oversized POST /api/trees body', { timeout: 10_000 }, async () => {
  const mod = await import('../../functions/api/[[path]].js');
  const { onRequest } = mod;

  const oversizedBody = JSON.stringify({ title: 'x'.repeat(150 * 1024) });
  assert.ok(oversizedBody.length > 128 * 1024, 'test payload must exceed 128KB');

  const request = new Request('https://test5.lovebud.pages.dev/api/trees', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer mock-test-token' },
    body: oversizedBody,
  });

  const env = { MODAL_BASE_URL: 'https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run' };
  const response = await onRequest({ request, env });

  assert.equal(response.status, 413, 'oversized POST must return 413');
  assert.ok(response.headers.get('content-type')?.startsWith('application/json'), '413 must be JSON');

  const body = await response.json();
  assert.equal(typeof body.error, 'string', '413 body must have error string');
  assert.ok(body.error.length > 0, '413 error must not be empty');
  assert.doesNotMatch(JSON.stringify(body), /x{10,}/, '413 must not echo submitted body content');
  assert.equal(response.headers.get('x-lovebud-route-status'), 'payload-too-large');
  assert.equal(response.headers.get('x-lovebud-upstream'), 'cloudflare');
});

test('runtime: Cloudflare write proxy returns 413 for oversized POST /api/memories body', { timeout: 10_000 }, async () => {
  const mod = await import('../../functions/api/[[path]].js');
  const { onRequest } = mod;

  const oversizedBody = JSON.stringify({
    treeId: '00000000-0000-0000-0000-000000000000',
    content: 'y'.repeat(140 * 1024),
    memoryDate: '2026-05-15',
  });
  assert.ok(oversizedBody.length > 128 * 1024, 'test payload must exceed 128KB');

  const request = new Request('https://test5.lovebud.pages.dev/api/memories', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer mock-test-token' },
    body: oversizedBody,
  });

  const env = { MODAL_BASE_URL: 'https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run' };
  const response = await onRequest({ request, env });

  assert.equal(response.status, 413, 'oversized POST must return 413');
  const body = await response.json();
  assert.equal(typeof body.error, 'string');
  assert.ok(body.error.length > 0);
  assert.doesNotMatch(JSON.stringify(body), /y{10,}/, '413 must not echo submitted body content');
  assert.equal(response.headers.get('x-lovebud-route-status'), 'payload-too-large');
});

test('runtime: Cloudflare write proxy passes normal-sized POST to Modal', { timeout: 10_000 }, async () => {
  const mod = await import('../../functions/api/[[path]].js');
  const { onRequest } = mod;

  const smallBody = JSON.stringify({ title: 'runtime-test' });
  assert.ok(smallBody.length < 128 * 1024, 'small payload must be under 128KB');

  const request = new Request('https://test5.lovebud.pages.dev/api/trees', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer mock-test-token' },
    body: smallBody,
  });

  // Mock fetch to intercept Modal call
  const originalFetch = globalThis.fetch;
  let modalFetchCalled = false;
  let modalFetchUrl = '';
  globalThis.fetch = async (url, opts) => {
    modalFetchCalled = true;
    modalFetchUrl = typeof url === 'string' ? url : url.toString();
    // Return mock Modal response
    return new Response(JSON.stringify({ id: 'mock-tree-id', title: 'runtime-test' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const env = { MODAL_BASE_URL: 'https://padiemipu--lovebud-browse-snapshot-fastapi-app.modal.run' };
    const response = await onRequest({ request, env });

    assert.equal(response.status, 200, 'normal-sized POST must return 200');
    assert.ok(modalFetchCalled, 'Modal fetch must be called for normal-sized body');
    assert.ok(modalFetchUrl.includes('/modal/private/trees'), 'Modal fetch must target private trees');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('tree-comment POST uses a streaming 128 KiB edge bound and never request.text()', () => {
  const source = readFile(TREE_COMMENT_JS);
  assert.match(source, /const\s+MAX_WRITE_BODY_BYTES\s*=\s*128\s*\*\s*1024/);
  assert.match(source, /request\.body\.getReader\(\)/);
  assert.match(source, /totalBytes\s*\+=\s*chunk\.byteLength/);
  assert.match(source, /totalBytes\s*>\s*MAX_WRITE_BODY_BYTES/);
  assert.doesNotMatch(source, /await\s+request\.text\(\)/);
  assert.match(source, /status:\s*413/);
  assert.match(source, /payload-too-large/);
});

test('runtime: tree-comment POST rejects missing/invalid/understated Content-Length oversized bodies before Modal', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/comments.js');
  const env = { MODAL_BASE_URL: 'https://example.modal.run' };
  const oversizedBody = JSON.stringify({ body: 'z'.repeat(129 * 1024) });
  const originalFetch = globalThis.fetch;
  let modalFetchCalls = 0;
  globalThis.fetch = async () => {
    modalFetchCalls += 1;
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const variants = [
    {},
    { 'content-length': 'not-a-number' },
    { 'content-length': '1' },
  ];

  try {
    for (const extraHeaders of variants) {
      const request = new Request('https://test.example/api/trees/tree-3920/comments', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'Idempotency-Key': 'comment-key-3920',
          ...extraHeaders,
        },
        body: oversizedBody,
      });
      const response = await onRequestPost({ request, env });
      assert.equal(response.status, 413);
      assert.equal(response.headers.get('x-lovebud-route-status'), 'payload-too-large');
      assert.equal(response.headers.get('x-lovebud-upstream'), 'cloudflare');
    }
    assert.equal(modalFetchCalls, 0, 'oversized comment bodies must never reach Modal');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime: tree-comment POST preserves Authorization, Idempotency-Key, Modal target, and valid body bytes', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/comments.js');
  const env = { MODAL_BASE_URL: 'https://example.modal.run' };
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const body = JSON.stringify({ body: 'valid comment' });
    const request = new Request('https://test.example/api/trees/tree-3920/comments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'Idempotency-Key': 'comment-key-3920',
      },
      body,
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 200);
    assert.ok(captured, 'valid comment must reach Modal');
    assert.equal(captured.url, 'https://example.modal.run/modal/private/trees/tree-3920/comments');
    assert.equal(captured.options.headers.authorization, 'Bearer test-token');
    assert.equal(captured.options.headers['Idempotency-Key'], 'comment-key-3920');
    const forwarded = captured.options.body instanceof Uint8Array
      ? new TextDecoder().decode(captured.options.body)
      : String(captured.options.body);
    assert.equal(forwarded, body);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime: tree-comment accepts exactly 128 KiB and forwards the exact bytes', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/comments.js');
  const env = { MODAL_BASE_URL: 'https://example.modal.run' };
  const originalFetch = globalThis.fetch;
  const exactBody = new Uint8Array(128 * 1024).fill(0x61);
  let capturedBody = null;
  globalThis.fetch = async (_url, options) => {
    capturedBody = options.body;
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const request = new Request('https://test.example/api/trees/tree-3920/comments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'Idempotency-Key': 'comment-key-exact-limit',
      },
      body: exactBody,
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 200);
    assert.ok(capturedBody instanceof Uint8Array);
    assert.equal(capturedBody.byteLength, exactBody.byteLength);
    assert.deepEqual(capturedBody, exactBody);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime: tree-comment rejects 128 KiB + 1 byte with zero Modal fetches', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/comments.js');
  const env = { MODAL_BASE_URL: 'https://example.modal.run' };
  const originalFetch = globalThis.fetch;
  let modalFetchCalls = 0;
  globalThis.fetch = async () => {
    modalFetchCalls += 1;
    return new Response('{}', { status: 200 });
  };

  try {
    const request = new Request('https://test.example/api/trees/tree-3920/comments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'Idempotency-Key': 'comment-key-over-limit',
      },
      body: new Uint8Array(128 * 1024 + 1).fill(0x61),
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 413);
    assert.equal(modalFetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime: tree-comment counts UTF-8 multibyte payloads by bytes, not JavaScript characters', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/comments.js');
  const env = { MODAL_BASE_URL: 'https://example.modal.run' };
  const originalFetch = globalThis.fetch;
  let modalFetchCalls = 0;
  globalThis.fetch = async () => {
    modalFetchCalls += 1;
    return new Response('{}', { status: 200 });
  };

  try {
    const text = '한'.repeat(Math.floor((128 * 1024) / 3) + 1);
    assert.ok(text.length < 128 * 1024, 'character count must remain below byte limit');
    assert.ok(new TextEncoder().encode(text).byteLength > 128 * 1024, 'UTF-8 bytes must exceed limit');
    const request = new Request('https://test.example/api/trees/tree-3920/comments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'Idempotency-Key': 'comment-key-utf8-limit',
      },
      body: text,
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 413);
    assert.equal(modalFetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime: tree-comment attempts stream cancellation immediately after overflow', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/comments.js');
  const env = { MODAL_BASE_URL: 'https://example.modal.run' };
  const originalFetch = globalThis.fetch;
  let modalFetchCalls = 0;
  let cancelCalls = 0;
  globalThis.fetch = async () => {
    modalFetchCalls += 1;
    return new Response('{}', { status: 200 });
  };

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(128 * 1024).fill(0x61));
      controller.enqueue(new Uint8Array([0x62]));
    },
    cancel() {
      cancelCalls += 1;
    },
  });

  try {
    const request = new Request('https://test.example/api/trees/tree-3920/comments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'Idempotency-Key': 'comment-key-cancel-limit',
      },
      body: stream,
      duplex: 'half',
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 413);
    assert.equal(cancelCalls, 1, 'overflow should attempt reader cancellation exactly once');
    assert.equal(modalFetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime: tree-comment without Content-Length forwards accepted UTF-8 bytes exactly', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/comments.js');
  const env = { MODAL_BASE_URL: 'https://example.modal.run' };
  const originalFetch = globalThis.fetch;
  const expectedBody = new TextEncoder().encode('{"body":"안녕 🌱"}');
  let capturedBody = null;
  globalThis.fetch = async (_url, options) => {
    capturedBody = options.body;
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const request = new Request('https://test.example/api/trees/tree-3920/comments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'Idempotency-Key': 'comment-key-byte-exact',
      },
      body: expectedBody,
    });
    assert.equal(request.headers.get('content-length'), null);
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 200);
    assert.ok(capturedBody instanceof Uint8Array);
    assert.deepEqual(capturedBody, expectedBody);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
