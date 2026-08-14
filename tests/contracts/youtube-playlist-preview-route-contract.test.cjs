/**
 * Route contract test for the authenticated YouTube playlist preview proxy
 * (functions/api/import/youtube/playlist/preview.js) — Issue #3914.
 *
 * Verifies the Cloudflare Pages Function is a THIN same-origin proxy:
 *  - edge identity rule (exactly one of source / playlistId), no silent precedence
 *  - bounded 4KB body
 *  - Authorization header forwarded, never verified on the edge
 *  - returns Modal's normalized response (envelope pass-through)
 *  - no provider endpoint / no provider secret on the edge
 *  - bounded proxy failure (timeout / unavailable / misconfiguration)
 *
 * Executed fake: the ESM route is imported and executed against real Request
 * objects with global fetch stubbed to a fake Modal endpoint. No network,
 * no DB, no browser, no Production.
 *
 * Refs: #3914, #3906, #3897, #3903, #1882.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ROUTE_FILE = path.join(ROOT, 'functions/api/import/youtube/playlist/preview.js');
const PREVIEW_PATH = '/api/import/youtube/playlist/preview';
const MODAL_BASE = 'https://modal.lovebud.test';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function callPreview(body, options = {}) {
  const mod = await import('../../functions/api/import/youtube/playlist/preview.js');
  const { onRequestPost } = mod;
  const request = new Request(`https://lovebud.pages.dev${PREVIEW_PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.authorization ? { authorization: options.authorization } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const env = options.env || { MODAL_BASE_URL: MODAL_BASE };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = options.fetchHandler || (async () =>
    jsonResponse(200, { ok: true, playlist: {}, items: [], totalItems: 0, previewedItems: 0 }));
  try {
    const response = await onRequestPost({ request, env });
    const text = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      body: text ? JSON.parse(text) : null,
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('route file exists and is ESM (exported onRequestPost + buildPlaylistIdentity)', async () => {
  assert.ok(fs.existsSync(ROUTE_FILE), 'route file must exist');
  const mod = await import('../../functions/api/import/youtube/playlist/preview.js');
  assert.equal(typeof mod.onRequestPost, 'function');
  assert.equal(typeof mod.buildPlaylistIdentity, 'function');
});

test('edge contains no provider endpoint and no provider secret', () => {
  const source = fs.readFileSync(ROUTE_FILE, 'utf8');
  assert.doesNotMatch(source, /googleapis|youtube\.com\/playlist/i);
  assert.doesNotMatch(source, /YOUTUBE_DATA_API_KEY|API_KEY|api[_-]?key/i);
  assert.doesNotMatch(source, /fetch\s*\(\s*(source|playlistId|identity)/i);
});

test('proxy forwards the Authorization header to the Modal endpoint verbatim', async () => {
  let capturedAuthorization = null;
  const fetchHandler = async (url, options) => {
    const headers = options.headers || {};
    capturedAuthorization = headers.authorization || headers.Authorization || null;
    return jsonResponse(200, { ok: true, playlist: {}, items: [], totalItems: 0, previewedItems: 0 });
  };
  const result = await callPreview(
    { playlistId: 'PLtest1234567890' },
    { authorization: 'Bearer mock-token', fetchHandler }
  );
  assert.equal(result.status, 200);
  assert.equal(capturedAuthorization, 'Bearer mock-token');
});

test('proxy forwards the bounded body to the Modal endpoint', async () => {
  let capturedBody = null;
  const fetchHandler = async (url, options) => {
    capturedBody = options.body;
    return jsonResponse(200, { ok: true, playlist: {}, items: [], totalItems: 0, previewedItems: 0 });
  };
  await callPreview({ source: 'https://www.youtube.com/playlist?list=PLtest1234567890' }, { fetchHandler });
  const parsed = JSON.parse(capturedBody);
  assert.equal(parsed.source, 'https://www.youtube.com/playlist?list=PLtest1234567890');
});

test('proxy targets the fixed Modal preview endpoint', async () => {
  let capturedUrl = null;
  const fetchHandler = async (url) => {
    capturedUrl = String(url);
    return jsonResponse(200, { ok: true, playlist: {}, items: [], totalItems: 0, previewedItems: 0 });
  };
  await callPreview({ playlistId: 'PLtest1234567890' }, { fetchHandler });
  assert.ok(capturedUrl.startsWith(MODAL_BASE), 'must target configured Modal base');
  assert.ok(capturedUrl.includes('/modal/private/import/youtube/playlist/preview'), 'must target Modal preview endpoint');
});

test('edge identity rule: both source and playlistId are rejected (no silent precedence)', async () => {
  const result = await callPreview({
    source: 'https://www.youtube.com/playlist?list=PLtest1234567890',
    playlistId: 'PLtest1234567890',
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error.code, 'INVALID_PLAYLIST_SOURCE');
});

test('edge identity rule: neither source nor playlistId is rejected', async () => {
  const result = await callPreview({});
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_PLAYLIST_SOURCE');
});

test('edge identity rule: playlistId alone is accepted', async () => {
  const result = await callPreview({ playlistId: 'PLtest1234567890' });
  assert.equal(result.status, 200);
});

test('edge identity rule: source alone is accepted', async () => {
  const result = await callPreview({ source: 'https://www.youtube.com/playlist?list=PLtest1234567890' });
  assert.equal(result.status, 200);
});

test('4KB body limit is enforced', async () => {
  const oversized = { source: 'https://www.youtube.com/playlist?list=PL' + 'x'.repeat(5 * 1024) };
  const result = await callPreview(oversized);
  assert.equal(result.status, 413);
  assert.equal(result.body.error.code, 'INVALID_PLAYLIST_SOURCE');
});

// ── True 4KB streamed byte bound (#3914 correction / #3920) ─────────────────
// The authority is request.body.getReader() with cumulative UTF-8 BYTE length;
// request.text() is never called first, Content-Length is only an early-reject
// optimization, and a stream read failure is a bounded 500 (never 413).

const ENCODER = new TextEncoder();

function buildJsonBody(value) {
  return JSON.stringify({ playlistId: value });
}

function buildRequestBody({ body, headers = {}, duplex = false }) {
  const init = {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
  };
  if (typeof body === 'string') {
    init.body = body;
  } else if (body && typeof body.getReader === 'function') {
    init.body = body;
    init.duplex = 'half';
  }
  return new Request(`https://lovebud.pages.dev${PREVIEW_PATH}`, init);
}

async function callPreviewWithRequest(buildRequestFn, options = {}) {
  const mod = await import('../../functions/api/import/youtube/playlist/preview.js');
  const { onRequestPost } = mod;
  const request = buildRequestFn();
  const env = options.env || { MODAL_BASE_URL: MODAL_BASE };
  let upstreamCalls = 0;
  const userHandler = options.fetchHandler || null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    upstreamCalls += 1;
    if (userHandler) return userHandler(...args);
    return jsonResponse(200, { ok: true, playlist: {}, items: [], totalItems: 0, previewedItems: 0 });
  };
  try {
    const response = await onRequestPost({ request, env });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
      upstreamCalls,
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function chunkedStream(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(ENCODER.encode(chunk));
      }
      controller.close();
    },
  });
}

test('4KB streamed bound: exactly 4096 bytes is accepted and forwarded', async () => {
  // JSON wrapper is 15 prefix + 2 suffix = 17; value 2 + 4077 = 4079; total 4096.
  const body = buildJsonBody('PL' + 'x'.repeat(4077));
  assert.equal(ENCODER.encode(body).byteLength, 4096);
  const result = await callPreviewWithRequest(() => buildRequestBody({ body }));
  assert.equal(result.status, 200);
  assert.equal(result.upstreamCalls, 1, 'valid request must reach Modal');
});

test('4KB streamed bound: 4097 bytes is rejected 413 with zero upstream calls', async () => {
  const body = buildJsonBody('PL' + 'x'.repeat(4078)); // value 4080 + 17 = 4097 bytes
  assert.equal(ENCODER.encode(body).byteLength, 4097);
  const result = await callPreviewWithRequest(() => buildRequestBody({ body }));
  assert.equal(result.status, 413);
  assert.equal(result.body.error.code, 'INVALID_PLAYLIST_SOURCE');
  assert.equal(result.upstreamCalls, 0, 'overflow must never reach Modal');
});

test('4KB streamed bound: Content-Length > 4096 yields early 413 with zero upstream calls', async () => {
  // Content-Length is only an optimization: a small actual body with a large
  // declared length is rejected before any read and before any upstream call.
  const result = await callPreviewWithRequest(() =>
    buildRequestBody({ body: '{}', headers: { 'content-length': '5000' } })
  );
  assert.equal(result.status, 413);
  assert.equal(result.upstreamCalls, 0);
});

test('4KB streamed bound: no Content-Length + streamed <= 4096 is accepted', async () => {
  const body = buildJsonBody('PL' + 'x'.repeat(300));
  const stream = chunkedStream([body.slice(0, 100), body.slice(100)]);
  const result = await callPreviewWithRequest(() => buildRequestBody({ body: stream }));
  assert.equal(result.upstreamCalls, 1, 'no-content-length small body must reach Modal');
  assert.equal(result.status, 200);
});

test('4KB streamed bound: no Content-Length + streamed > 4096 is 413 with zero upstream calls', async () => {
  const body = buildJsonBody('PL' + 'x'.repeat(4078)); // 4097 bytes
  const stream = chunkedStream([body.slice(0, 1000), body.slice(1000, 2500), body.slice(2500)]);
  const result = await callPreviewWithRequest(() => buildRequestBody({ body: stream }));
  assert.equal(result.status, 413);
  assert.equal(result.upstreamCalls, 0, 'streamed overflow must never reach Modal');
});

test('4KB streamed bound: understated Content-Length with actual > 4096 is 413', async () => {
  // An attacker-controlled understated Content-Length must not be trusted:
  // the streamed reader still measures the actual byte length.
  const body = buildJsonBody('PL' + 'x'.repeat(4078)); // 4097 bytes
  const stream = chunkedStream([body]);
  const result = await callPreviewWithRequest(() =>
    buildRequestBody({ body: stream, headers: { 'content-length': '5' } })
  );
  assert.equal(result.status, 413);
  assert.equal(result.upstreamCalls, 0);
});

test('4KB streamed bound: UTF-8 multibyte input is counted by bytes, not characters', async () => {
  // '가' is 3 UTF-8 bytes; JSON wrapper overhead is 11 prefix + 2 suffix = 13.
  // 1361 chars = 4083 bytes (+13 = 4096, exactly at the limit) accepted;
  // 1362 chars = 4086 bytes (+13 = 4099) rejected. Character count alone
  // would accept both, so this proves byte authority.
  const acceptedBody = JSON.stringify({ source: '가'.repeat(1361) }); // 4096 bytes
  const rejectedBody = JSON.stringify({ source: '가'.repeat(1362) }); // 4099 bytes
  assert.equal(ENCODER.encode(acceptedBody).byteLength, 4096);
  assert.equal(ENCODER.encode(rejectedBody).byteLength, 4099);
  const accepted = await callPreviewWithRequest(() => buildRequestBody({ body: acceptedBody }));
  assert.equal(accepted.status, 200, '4096-byte multibyte body must be accepted');
  const rejected = await callPreviewWithRequest(() => buildRequestBody({ body: rejectedBody }));
  assert.equal(rejected.status, 413, '4099-byte multibyte body must be rejected');
  assert.equal(rejected.upstreamCalls, 0);
});

test('4KB streamed bound: overflow guarantees Modal fetch count is exactly 0', async () => {
  const body = buildJsonBody('PL' + 'x'.repeat(5000));
  const result = await callPreviewWithRequest(() => buildRequestBody({ body }), {
    fetchHandler: async () => {
      throw new Error('must never be called');
    },
  });
  assert.equal(result.status, 413);
  assert.equal(result.upstreamCalls, 0);
});

test('4KB streamed bound: valid existing request continues to forward the body', async () => {
  let capturedBody = null;
  const result = await callPreviewWithRequest(
    () => buildRequestBody({ body: JSON.stringify({ playlistId: 'PLtest1234567890' }) }),
    {
      fetchHandler: async (url, options) => {
        capturedBody = options.body;
        return jsonResponse(200, { ok: true, playlist: {}, items: [], totalItems: 0, previewedItems: 0 });
      },
    }
  );
  assert.equal(result.status, 200);
  const parsed = JSON.parse(capturedBody);
  assert.equal(parsed.playlistId, 'PLtest1234567890');
});

test('4KB streamed bound: stream read failure is a bounded 500, not payload-too-large', async () => {
  const errorStream = new ReadableStream({
    start(controller) {
      controller.error(new Error('stream exploded'));
    },
  });
  const result = await callPreviewWithRequest(() => buildRequestBody({ body: errorStream }));
  assert.equal(result.status, 500, 'read failure must not be mislabeled as 413');
  assert.notEqual(result.status, 413);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  assert.ok(!/exploded/.test(JSON.stringify(result.body)), 'raw stream exception must not leak');
  assert.equal(result.upstreamCalls, 0);
});

test('non-JSON content type is rejected', async () => {
  const mod = await import('../../functions/api/import/youtube/playlist/preview.js');
  const request = new Request(`https://lovebud.pages.dev${PREVIEW_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'hello',
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse(200, '{}');
  try {
    const response = await mod.onRequestPost({ request, env: { MODAL_BASE_URL: MODAL_BASE } });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invalid JSON body is rejected', async () => {
  const result = await callPreviewRaw('{not-json');
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'VALIDATION_ERROR');
});

async function callPreviewRaw(rawBody, options = {}) {
  const mod = await import('../../functions/api/import/youtube/playlist/preview.js');
  const request = new Request(`https://lovebud.pages.dev${PREVIEW_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: rawBody,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = options.fetchHandler || (async () =>
    jsonResponse(200, { ok: true, playlist: {}, items: [], totalItems: 0, previewedItems: 0 }));
  try {
    const response = await mod.onRequestPost({ request, env: { MODAL_BASE_URL: MODAL_BASE } });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('missing MODAL_BASE_URL yields bounded CONFIGURATION_REQUIRED with zero upstream calls', async () => {
  let upstreamCalls = 0;
  const result = await callPreview(
    { playlistId: 'PLtest1234567890' },
    {
      env: {},
      fetchHandler: async () => {
        upstreamCalls += 1;
        return jsonResponse(200, '{}');
      },
    }
  );
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, 'CONFIGURATION_REQUIRED');
  assert.equal(upstreamCalls, 0);
});

test('Modal timeout yields bounded PROVIDER_TIMEOUT 504', async () => {
  const result = await callPreview(
    { playlistId: 'PLtest1234567890' },
    {
      fetchHandler: async () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      },
    }
  );
  assert.equal(result.status, 504);
  assert.equal(result.body.error.code, 'PROVIDER_TIMEOUT');
});

test('Modal network failure yields bounded PROVIDER_UNAVAILABLE 503', async () => {
  const result = await callPreview(
    { playlistId: 'PLtest1234567890' },
    {
      fetchHandler: async () => {
        throw new Error('network down');
      },
    }
  );
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, 'PROVIDER_UNAVAILABLE');
});

test('Modal envelope errors pass through unchanged (bounded, no raw provider body)', async () => {
  const result = await callPreview(
    { playlistId: 'PLtest1234567890' },
    {
      fetchHandler: async () =>
        jsonResponse(404, { ok: false, error: { code: 'PLAYLIST_NOT_FOUND', message: 'Playlist not found.' } }),
    }
  );
  assert.equal(result.status, 404);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error.code, 'PLAYLIST_NOT_FOUND');
});

test('edge never verifies the token (Authorization is forwarded, not validated)', async () => {
  // Header presence must NOT satisfy authentication on the edge: the proxy
  // forwards it to Modal, which owns verified auth. The edge must not emit a
  // success decision based on header presence.
  const source = fs.readFileSync(ROUTE_FILE, 'utf8');
  // No verification *call* may exist on the edge (comments may mention the
  // Modal authority; only actual invocation syntax is forbidden).
  assert.doesNotMatch(source, /require_firebase_user\s*\(|verifyIdToken\s*\(|admin\.auth|firebase\.auth/);
  assert.match(source, /authorization/i);
});
