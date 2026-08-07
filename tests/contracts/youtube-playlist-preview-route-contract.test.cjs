/**
 * Route contract test for the authenticated YouTube playlist preview proxy
 * (functions/api/import/youtube/playlist/preview.js) — Issue #3914.
 *
 * Verifies the Cloudflare Pages Function is a THIN same-origin proxy:
 *  - edge identity rule (exactly one of source / playlistId), no silent precedence
 *  - bounded 4KB body
 *  - Authorization header forwarded, never verified on the edge
 *  - returns Modal's normalized response
 *  - no provider endpoint / no provider secret on the edge
 *  - bounded proxy failure (timeout / unavailable / misconfiguration)
 *
 * No network, no DB, no browser, no Production.
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

function readRoute() {
  return fs.readFileSync(ROUTE_FILE, 'utf8');
}

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
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('non-POST method is rejected', async () => {
  const mod = await import('../../functions/api/import/youtube/playlist/preview.js');
  const request = new Request(`https://lovebud.pages.dev${PREVIEW_PATH}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse(200, '{}');
  try {
    const response = await mod.onRequestPost({ request, env: { MODAL_BASE_URL: MODAL_BASE } });
    assert.equal(response.status, 405);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('missing MODAL_BASE_URL yields bounded configuration failure (no provider call)', async () => {
  let providerCalled = false;
  const result = await callPreview(
    { playlistId: 'PLtest1234567890' },
    {
      env: {},
      fetchHandler: async () => {
        providerCalled = true;
        return jsonResponse(200, '{}');
      },
    }
  );
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, 'CONFIGURATION_REQUIRED');
  assert.equal(providerCalled, false);
});

test('Modal fetch rejection yields bounded PROVIDER_UNAVAILABLE', async () => {
  const result = await callPreview(
    { playlistId: 'PLtest1234567890' },
    { fetchHandler: async () => { throw new Error('modal down'); } }
  );
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, 'PROVIDER_UNAVAILABLE');
});

test('Modal fetch abort yields bounded PROVIDER_TIMEOUT', async () => {
  const result = await callPreview(
    { playlistId: 'PLtest1234567890' },
    {
      fetchHandler: async () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      },
    }
  );
  assert.equal(result.status, 504);
  assert.equal(result.body.error.code, 'PROVIDER_TIMEOUT');
});

test('Modal normalized error response is forwarded as-is (error envelope)', async () => {
  const result = await callPreview(
    { playlistId: 'PLtest1234567890' },
    {
      fetchHandler: async () =>
        jsonResponse(404, {
          ok: false,
          error: { code: 'PLAYLIST_NOT_FOUND', message: 'Playlist not found.' },
        }),
    }
  );
  assert.equal(result.status, 404);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error.code, 'PLAYLIST_NOT_FOUND');
});

test('source edge source string does not need host validation (Modal owns parsing)', async () => {
  // Edge is a thin proxy: an arbitrary source string is forwarded for Modal to
  // parse/validate. Cloudflare does NOT fetch it.
  let providerCalled = false;
  const result = await callPreview(
    { source: 'http://localhost:8080/secret' },
    {
      fetchHandler: async () => {
        providerCalled = true;
        return jsonResponse(200, { ok: true, playlist: {}, items: [], totalItems: 0, previewedItems: 0 });
      },
    }
  );
  assert.equal(result.status, 200);
  assert.equal(providerCalled, true);
});

test('edge file never calls fetch(userSuppliedUrl) and never holds provider secret', () => {
  const source = readRoute();
  // The only fetch on the edge targets the configured Modal base URL.
  assert.match(source, /fetch\(modalUrl|fetchModalWithTimeout/);
  assert.match(source, /MODAL_BASE_URL/);
  // No Google provider URL, no API key, no env secret.
  assert.doesNotMatch(source, /www\.googleapis\.com/);
  assert.doesNotMatch(source, /youtube\/v3/);
  assert.doesNotMatch(source, /apiKey|API_KEY|YOUTUBE_DATA_API_KEY/);
  assert.doesNotMatch(source, /fetch\(\s*(userSuppliedUrl|body\.source|body\.playlistId)/);
  assert.match(source, /MODAL_PROXY_TIMEOUT_MS/);
  assert.match(source, /MAX_REQUEST_BODY_BYTES\s*=\s*4\s*\*\s*1024/);
});

test('edge route rejects both source and playlistId with a 400 envelope', async () => {
  const source = readRoute();
  assert.match(source, /INVALID_PLAYLIST_SOURCE/);
  assert.match(source, /buildPlaylistIdentity/);
});
