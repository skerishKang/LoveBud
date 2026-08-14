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

test('Cloudflare catch-all non-Memory write converges on the shared bounded-request-body authority', () => {
  const source = readFile(CATCHALL_JS);

  assert.match(source, /import\s*\{\s*readBoundedRequestBody\s*\}\s*from\s*['"]\.\.\/\_shared\/bounded-request-body\.js['"]/);
  assert.match(source, /await\s+readBoundedRequestBody\(request\)/);
  assert.match(source, /function\s+buildPayloadTooLargeResponse\s*\(/);

  // Local parser/helpers must be gone; the shared module is the sole authority.
  assert.doesNotMatch(source, /const\s+MAX_WRITE_BODY_BYTES\s*=/);
  assert.doesNotMatch(source, /function\s+getContentLengthBytes\s*\(/);
  assert.doesNotMatch(source, /function\s+isWriteContentLengthTooLarge\s*\(/);
  assert.doesNotMatch(source, /async\s+function\s+readBoundedWriteBody\s*\(/);
  assert.doesNotMatch(source, /await\s+request\.text\(\)/);

  // Shared status is mapped to the HTTP taxonomy.
  assert.match(source, /bodyResult\.status\s*===?\s*'tooLarge'/);
  assert.match(source, /bodyResult\.status\s*===?\s*'readError'/);
  assert.match(source, /return\s+buildPayloadTooLargeResponse\(requestId\)/);
  assert.match(source, /return\s+buildBodyReadFailedResponse\(requestId\)/);
});

test('Cloudflare catch-all non-DELETE write forwards bounded body and rejects oversized before Modal', () => {
  const source = readFile(CATCHALL_JS);
  const writeBlock = sliceBetween(
    source,
    /async\s+function\s+tryModalWrite\s*\(/,
    /export\s+async\s+function\s+onRequest\s*\(/
  );

  assert.match(writeBlock, /let\s+boundedBody\s*=\s*null/);
  assert.match(writeBlock, /const\s+bodyResult\s*=\s*await\s+readBoundedRequestBody\(request\)/);
  assert.match(writeBlock, /if\s*\(bodyResult\.status\s*===\s*'tooLarge'\)/);
  assert.match(writeBlock, /return\s+buildPayloadTooLargeResponse\(requestId\)/);
  assert.match(writeBlock, /if\s*\(bodyResult\.status\s*===\s*'readError'\)/);
  assert.match(writeBlock, /return\s+buildBodyReadFailedResponse\(requestId\)/);
  assert.match(writeBlock, /boundedBody\s*=\s*bodyResult\.body/);
  // The bounded body is forwarded for every non-DELETE write. The upstream method
  // may be `upstreamMethod` (PUT→POST translation for hub-layout) or `method`.
  assert.match(writeBlock, /body:\s*(?:upstreamMethod|method)\s*!==\s*'DELETE'\s*\?\s*boundedBody\s*:\s*null/);
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

test('tree-comment POST uses canonical shared readBoundedRequestBody and never request.text()', () => {
  const source = readFile(TREE_COMMENT_JS);
  assert.match(source, /import\s*\{\s*readBoundedRequestBody\s*\}\s*from\s*['"]\.\.\/\.\.\/\.\.\/_shared\/bounded-request-body\.js['"]/);
  assert.match(source, /await\s+readBoundedRequestBody\(request\)/);
  assert.doesNotMatch(source, /getContentLengthBytes/);
  assert.doesNotMatch(source, /MAX_WRITE_BODY_BYTES/);
  assert.doesNotMatch(source, /await\s+request\.text\(\)/);
  assert.doesNotMatch(source, /await\s+request\.json\(\)/);
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

test('runtime: tree-comment POST accepts small body despite invalid-but-number-parseable Content-Length header (1e9, 1.5, +200000)', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/comments.js');
  const env = { MODAL_BASE_URL: 'https://example.modal.run' };
  const smallBody = JSON.stringify({ body: 'valid small comment' });
  const originalFetch = globalThis.fetch;
  let modalFetchCalls = 0;
  globalThis.fetch = async () => {
    modalFetchCalls += 1;
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const invalidParseableHeaders = ['1e9', '1.5', '+200000', '-1'];

  try {
    for (const clValue of invalidParseableHeaders) {
      const sanitizedKey = clValue.replace(/[^A-Za-z0-9._:-]/g, '_');
      const request = new Request('https://test.example/api/trees/tree-3920/comments', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'Idempotency-Key': `comment-key-${sanitizedKey}`,
          'content-length': clValue,
        },
        body: smallBody,
      });
      const response = await onRequestPost({ request, env });
      assert.equal(response.status, 200, `small body with content-length ${clValue} must be accepted`);
    }
    assert.equal(modalFetchCalls, invalidParseableHeaders.length, 'all small bodies with un-canonical Content-Length must reach Modal');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime: tree-comment POST returns 503 (not 413) when stream reader throws read error', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/comments.js');
  const env = { MODAL_BASE_URL: 'https://example.modal.run' };
  const originalFetch = globalThis.fetch;
  let modalFetchCalls = 0;
  globalThis.fetch = async () => {
    modalFetchCalls += 1;
    return new Response('{}', { status: 200 });
  };

  const errorStream = new ReadableStream({
    start(controller) {
      controller.error(new Error('Simulated stream read failure'));
    }
  });

  try {
    const request = new Request('https://test.example/api/trees/tree-3920/comments', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'Idempotency-Key': 'comment-key-stream-error',
      },
      body: errorStream,
      duplex: 'half',
    });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 503, 'stream read error must return 503, not 413');
    assert.notEqual(response.status, 413, 'read failure must never be disguised as 413 tooLarge');
    assert.equal(modalFetchCalls, 0, 'read error must not call Modal');
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

// ─────────────────────────────────────────────────────────────────────────────
// #3920 FINAL CORE convergence regression matrix: the four remaining Tree write
// boundaries must now reuse the canonical shared bounded-request-body authority.
// ─────────────────────────────────────────────────────────────────────────────

const TREE_VIEW_JS = path.join(ROOT, 'functions/api/trees/[tree_id]/views.js');

async function withMockModalFetch(fn) {
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

test('runtime: Tree collection POST accepts exactly 128 KiB and forwards exact bytes (shared reader)', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees.js');
  const body = JSON.stringify({ title: 'a'.repeat(128 * 1024 - 12) });
  assert.equal(Buffer.byteLength(body, 'utf8'), 128 * 1024, 'payload must be exactly 128 KiB');
  const request = new Request('https://test.example/api/trees', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
      'x-lovebud-request-id': 'req-3920-trees-exact',
    },
    body,
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
  assert.equal(result.status, 200);
  assert.equal(captured.calls, 1);
  assert.equal(result.headers.get('x-lovebud-request-id'), 'req-3920-trees-exact');
  const forwarded = captured.options.body instanceof Uint8Array
    ? new TextDecoder().decode(captured.options.body)
    : String(captured.options.body);
  assert.equal(forwarded, body, 'forwarded bytes must be byte-exact');
});

test('runtime: Tree collection POST rejects 128 KiB + 1 byte with 413 and zero Modal fetches (shared reader)', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees.js');
  const body = JSON.stringify({ title: 'a'.repeat(128 * 1024 - 11) });
  assert.ok(Buffer.byteLength(body, 'utf8') > 128 * 1024, 'payload must exceed 128 KiB');
  const request = new Request('https://test.example/api/trees', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
    body,
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
  assert.equal(result.status, 413);
  assert.equal(captured.calls, 0, 'oversized Tree collection POST must not reach Modal');
});

test('runtime: Tree collection POST rejects oversized stream with missing Content-Length (no early bypass)', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees.js');
  const body = new Uint8Array(128 * 1024 + 100).fill(0x61);
  const request = new Request('https://test.example/api/trees', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
    body,
  });
  assert.equal(request.headers.get('content-length'), null);
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
  assert.equal(result.status, 413);
  assert.equal(captured.calls, 0);
});

test('runtime: Tree collection POST rejects oversized stream with understated Content-Length', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees.js');
  const body = new Uint8Array(128 * 1024 + 100).fill(0x61);
  const request = new Request('https://test.example/api/trees', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token', 'content-length': '10' },
    body,
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
  assert.equal(result.status, 413);
  assert.equal(captured.calls, 0);
});

test('runtime: Tree collection POST rejects oversized stream with invalid (non-canonical) Content-Length', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees.js');
  const body = new Uint8Array(128 * 1024 + 100).fill(0x61);
  const request = new Request('https://test.example/api/trees', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token', 'content-length': 'abc' },
    body,
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
  assert.equal(result.status, 413);
  assert.equal(captured.calls, 0);
});

test('runtime: Tree collection POST accepts small body despite invalid-but-parseable Content-Length (1e9, 1.5, +200000)', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees.js');
  const body = JSON.stringify({ title: 'small tree' });
  for (const cl of ['1e9', '1.5', '+200000']) {
    const request = new Request('https://test.example/api/trees', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test-token', 'content-length': cl },
      body,
    });
    const { result, captured } = await withMockModalFetch(() =>
      onRequestPost({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
    assert.equal(result.status, 200, `small body with content-length ${cl} must be accepted`);
    assert.equal(captured.calls, 1, 'Modal must be called once');
  }
});

test('runtime: Tree collection POST returns 503 (not 413) on stream reader failure', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees.js');
  const errorStream = new ReadableStream({ start(c) { c.error(new Error('Simulated read failure')); } });
  const request = new Request('https://test.example/api/trees', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
    body: errorStream,
    duplex: 'half',
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
  assert.equal(result.status, 503, 'stream read error must return 503, not 413');
  assert.notEqual(result.status, 413);
  assert.equal(result.headers.get('x-lovebud-route-status'), 'body-read-failed');
  assert.equal(result.headers.get('x-lovebud-upstream'), 'cloudflare');
  assert.equal(captured.calls, 0, 'read error must not call Modal');
});

test('runtime: Tree collection POST counts UTF-8 multibyte payloads by bytes, not characters', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees.js');
  const text = '한'.repeat(Math.floor((128 * 1024) / 3) + 1);
  const body = JSON.stringify({ title: text });
  assert.ok(body.length < 128 * 1024, 'character count must stay below byte limit');
  assert.ok(Buffer.byteLength(body, 'utf8') > 128 * 1024, 'UTF-8 bytes must exceed limit');
  const request = new Request('https://test.example/api/trees', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
    body,
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
  assert.equal(result.status, 413);
  assert.equal(captured.calls, 0);
});

test('runtime: Tree detail PUT accepts exactly 128 KiB and forwards exact bytes (shared reader)', { timeout: 10_000 }, async () => {
  const { onRequestPut } = await import('../../functions/api/trees/[id].js');
  const body = JSON.stringify({ title: 'a'.repeat(128 * 1024 - 12) });
  assert.equal(Buffer.byteLength(body, 'utf8'), 128 * 1024);
  const request = new Request('https://test.example/api/trees/tree-1', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
      'x-lovebud-request-id': 'req-3920-detail-exact',
    },
    body,
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPut({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' }, params: { id: 'tree-1' } }));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('x-lovebud-request-id'), 'req-3920-detail-exact');
  assert.equal(captured.calls, 1);
  const forwarded = captured.options.body instanceof Uint8Array
    ? new TextDecoder().decode(captured.options.body)
    : String(captured.options.body);
  assert.equal(forwarded, body);
});

test('runtime: Tree detail PUT rejects 128 KiB + 1 with 413 and zero Modal fetches', { timeout: 10_000 }, async () => {
  const { onRequestPut } = await import('../../functions/api/trees/[id].js');
  const body = JSON.stringify({ title: 'a'.repeat(128 * 1024 - 11) });
  assert.ok(Buffer.byteLength(body, 'utf8') > 128 * 1024);
  const request = new Request('https://test.example/api/trees/tree-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
    body,
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPut({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' }, params: { id: 'tree-1' } }));
  assert.equal(result.status, 413);
  assert.equal(captured.calls, 0);
});

test('runtime: Tree detail PUT rejects oversized stream despite invalid and understated Content-Length', { timeout: 10_000 }, async () => {
  const { onRequestPut } = await import('../../functions/api/trees/[id].js');
  const oversized = new Uint8Array(128 * 1024 + 100).fill(0x61);
  for (const cl of ['abc', '10']) {
    const request = new Request('https://test.example/api/trees/tree-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test-token', 'content-length': cl },
      body: oversized,
    });
    const { result, captured } = await withMockModalFetch(() =>
      onRequestPut({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' }, params: { id: 'tree-1' } }));
    assert.equal(result.status, 413, `oversized PUT with content-length ${cl} must be 413`);
    assert.equal(captured.calls, 0);
  }
});

test('runtime: Tree detail PUT returns 503 (not 413) on stream reader failure', { timeout: 10_000 }, async () => {
  const { onRequestPut } = await import('../../functions/api/trees/[id].js');
  const errorStream = new ReadableStream({ start(c) { c.error(new Error('Simulated read failure')); } });
  const request = new Request('https://test.example/api/trees/tree-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
    body: errorStream,
    duplex: 'half',
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPut({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' }, params: { id: 'tree-1' } }));
  assert.equal(result.status, 503);
  assert.notEqual(result.status, 413);
  assert.equal(result.headers.get('x-lovebud-route-status'), 'body-read-failed');
  assert.equal(captured.calls, 0);
});

test('runtime: catch-all non-Memory POST /api/trees accepts exactly 128 KiB and forwards bytes (shared reader)', { timeout: 10_000 }, async () => {
  const { onRequest } = await import('../../functions/api/[[path]].js');
  const body = new Uint8Array(128 * 1024).fill(0x61);
  const request = new Request('https://test.example/api/trees', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
    body,
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequest({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
  assert.equal(result.status, 200);
  assert.equal(captured.calls, 1);
  assert.ok(captured.options.body instanceof Uint8Array);
  assert.equal(captured.options.body.byteLength, 128 * 1024);
  assert.deepEqual(captured.options.body, body);
});

test('runtime: catch-all non-Memory POST /api/trees rejects 128 KiB + 1 with 413 and zero Modal fetches', { timeout: 10_000 }, async () => {
  const { onRequest } = await import('../../functions/api/[[path]].js');
  const body = new Uint8Array(128 * 1024 + 1).fill(0x61);
  const request = new Request('https://test.example/api/trees', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
    body,
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequest({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
  assert.equal(result.status, 413);
  assert.equal(captured.calls, 0);
});

test('runtime: catch-all non-Memory write does not trust invalid-but-parseable Content-Length for early 413', { timeout: 10_000 }, async () => {
  const { onRequest } = await import('../../functions/api/[[path]].js');
  const small = new Uint8Array(16).fill(0x61);
  for (const cl of ['1e9', '1.5', '+200000']) {
    const request = new Request('https://test.example/api/trees', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test-token', 'content-length': cl },
      body: small,
    });
    const { result, captured } = await withMockModalFetch(() =>
      onRequest({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
    assert.equal(result.status, 200, `content-length ${cl} must not early-413 small body`);
    assert.equal(captured.calls, 1);
    assert.deepEqual(captured.options.body, small);
  }
});

test('static: catch-all Memory write path still delegates to prepareMemoryWriteProxyRequest and is untouched', () => {
  const source = readFile(CATCHALL_JS);
  assert.match(source, /prepareMemoryWriteProxyRequest/);
  assert.match(source, /isMemoryWriteRequest/);
  assert.match(source, /isMemoryRouteRequest/);
  assert.notEqual(source.indexOf('prepareMemoryWriteProxyRequest('), -1);
});

const TREE_VIEW_AUTH_ENV = {
  MODAL_BASE_URL: 'https://example.modal.run',
  TREE_VIEW_AUTHORITY_SECRET: 'test-tree-view-authority-secret-3920-3917',
};

function treeViewHeaders(extra = {}) {
  return {
    'content-type': 'application/json',
    'CF-Connecting-IP': '203.0.113.91',
    ...extra,
  };
}

test('static: Tree view POST uses shared bounded reader and never forwards client body bytes', () => {
  const source = readFile(TREE_VIEW_JS);
  assert.match(source, /import\s*\{\s*readBoundedRequestBody\s*\}\s*from\s*['"]\.\.\/\.\.\/\.\.\/_shared\/bounded-request-body\.js['"]/);
  assert.match(source, /await\s+readBoundedRequestBody\(request\)/);
  assert.match(source, /'payload-too-large'/);
  assert.match(source, /'body-read-failed'/);
  assert.match(source, /TREE_VIEW_AUTHORITY_SECRET/);
  assert.match(source, /buildSignedAssertionHeaders/);
  assert.doesNotMatch(source, /body:\s*(?:request\.body|bodyResult\.body)/);
});

test('runtime: Tree view POST accepts exactly 128 KiB at the edge, discards it, and forwards only signed authority', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/views.js');
  const body = new Uint8Array(128 * 1024).fill(0x61);
  const request = new Request('https://test.example/api/trees/tree-1/views', {
    method: 'POST',
    headers: treeViewHeaders({ 'x-lovebud-request-id': 'req-3920-view-exact' }),
    body,
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPost({ request, env: TREE_VIEW_AUTH_ENV }));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('x-lovebud-request-id'), 'req-3920-view-exact');
  assert.equal(captured.calls, 1);
  assert.equal(captured.options.body, undefined, 'client body must be discarded before Modal');
  assert.equal(captured.options.headers['x-lovebud-tree-view-actor-kind'], 'anonymous');
  assert.match(captured.options.headers['x-lovebud-tree-view-actor-key'], /^[a-f0-9]{64}$/);
  assert.match(captured.options.headers['x-lovebud-tree-view-signature'], /^[a-f0-9]{64}$/);
});

test('runtime: Tree view POST rejects 128 KiB + 1 with 413 and zero Modal fetches', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/views.js');
  const body = new Uint8Array(128 * 1024 + 1).fill(0x61);
  const request = new Request('https://test.example/api/trees/tree-1/views', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
  assert.equal(result.status, 413);
  assert.equal(result.headers.get('x-lovebud-upstream'), 'cloudflare');
  assert.equal(result.headers.get('x-lovebud-route-status'), 'payload-too-large');
  assert.equal(captured.calls, 0);
});

test('runtime: Tree view POST rejects oversized streams with missing/invalid/understated Content-Length', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/views.js');
  const oversized = new Uint8Array(128 * 1024 + 100).fill(0x61);
  const variants = [{}, { 'content-length': 'abc' }, { 'content-length': '10' }];
  for (const extra of variants) {
    const request = new Request('https://test.example/api/trees/tree-1/views', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...extra },
      body: oversized,
    });
    const { result, captured } = await withMockModalFetch(() =>
      onRequestPost({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
    assert.equal(result.status, 413, `variant ${JSON.stringify(extra)} must be 413`);
    assert.equal(captured.calls, 0);
  }
});

test('runtime: Tree view POST returns 503 (not 413) on stream reader failure with request-id', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/views.js');
  const errorStream = new ReadableStream({ start(c) { c.error(new Error('Simulated read failure')); } });
  const request = new Request('https://test.example/api/trees/tree-1/views', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-lovebud-request-id': 'req-3920-view-readerr',
    },
    body: errorStream,
    duplex: 'half',
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPost({ request, env: { MODAL_BASE_URL: 'https://example.modal.run' } }));
  assert.equal(result.status, 503);
  assert.notEqual(result.status, 413);
  assert.equal(result.headers.get('x-lovebud-route-status'), 'body-read-failed');
  assert.equal(result.headers.get('x-lovebud-upstream'), 'cloudflare');
  assert.equal(result.headers.get('x-lovebud-request-id'), 'req-3920-view-readerr');
  assert.equal(captured.calls, 0);
});

test('runtime: Tree view POST preserves request-id and canonical Modal URL while discarding accepted client body', { timeout: 10_000 }, async () => {
  const { onRequestPost } = await import('../../functions/api/trees/[tree_id]/views.js');
  const request = new Request('https://test.example/api/trees/tree-1/views', {
    method: 'POST',
    headers: treeViewHeaders({ 'x-lovebud-request-id': 'req-3920-view-normal' }),
    body: JSON.stringify({ actorKey: 'forged-client-key', actorKind: 'authenticated' }),
  });
  const { result, captured } = await withMockModalFetch(() =>
    onRequestPost({ request, env: TREE_VIEW_AUTH_ENV }));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('x-lovebud-request-id'), 'req-3920-view-normal');
  assert.equal(captured.url, 'https://example.modal.run/modal/public/trees/tree-1/views');
  assert.equal(captured.options.body, undefined);
  assert.equal(captured.options.headers['x-lovebud-tree-view-actor-kind'], 'anonymous');
  assert.notEqual(captured.options.headers['x-lovebud-tree-view-actor-key'], 'forged-client-key');
});
