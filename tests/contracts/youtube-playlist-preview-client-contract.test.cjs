/**
 * Client wrapper contract test for the authenticated YouTube playlist preview
 * (js/api/import-youtube-playlist-preview.js) — Issue #3914.
 *
 * Verifies the client wrapper:
 *  - calls the same-origin route (never a Google endpoint)
 *  - acquires a Firebase token via the existing auth pipeline
 *  - sends bounded JSON
 *  - normalizes success / bounded errors (envelope codes)
 *  - honors AbortController timeout
 *  - never knows the provider secret or provider endpoint
 *
 * The wrapper is a browser IIFE, so it is executed inside a vm sandbox that
 * provides `window`, `fetch`, and timers. No network, no DB, no Production.
 *
 * Refs: #3914, #3906, #3897, #3903, #1882.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CLIENT_FILE = path.join(__dirname, '..', '..', 'js/api/import-youtube-playlist-preview.js');
const CLIENT_SOURCE = fs.readFileSync(CLIENT_FILE, 'utf8');

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function loadClient({ fetchHandler, authHandler }) {
  const window = {
    LoveTreeBaseApiFetch: authHandler
      ? { getAuthHeaders: authHandler }
      : undefined,
  };
  const sandbox = {
    window,
    document: undefined,
    module: { exports: {} },
    exports: {},
    AbortController,
    TextEncoder,
    TextDecoder,
    fetch: fetchHandler,
    setTimeout,
    clearTimeout,
    Promise,
    Error,
    JSON,
    console,
  };
  vm.runInNewContext(CLIENT_SOURCE, sandbox, { filename: CLIENT_FILE });
  const api = sandbox.window.LoveTreeYouTubePlaylistPreview;
  assert.ok(api, 'window.LoveTreeYouTubePlaylistPreview must be registered');
  return api;
}

test('client wrapper targets the same-origin route, never a Google endpoint', () => {
  const api = loadClient({ fetchHandler: async () => jsonResponse(200, '{}') });
  assert.equal(api.ENDPOINT, '/api/import/youtube/playlist/preview');
  assert.doesNotMatch(api.ENDPOINT, /googleapis|youtube\.com/);
});

test('client wrapper sends a bounded JSON body with Authorization header', async () => {
  let capturedRequest = null;
  const api = loadClient({
    authHandler: async () => ({ Authorization: 'Bearer mock-id-token' }),
    fetchHandler: async (url, options) => {
      capturedRequest = { url: String(url), options };
      return jsonResponse(200, {
        ok: true,
        playlist: { id: 'PLtest1234567890', title: 'T', channelTitle: 'C', itemCount: 1, truncated: false },
        items: [
          {
            position: 0,
            videoId: 'dQw4w9WgXcQ',
            title: 'Video',
            description: '',
            channelTitle: 'C',
            thumbnailUrl: null,
            state: 'AVAILABLE_METADATA',
            sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          },
        ],
        truncated: false,
        totalItems: 1,
        previewedItems: 1,
      });
    },
  });

  const result = await api.requestPreview(
    { source: 'https://www.youtube.com/playlist?list=PLtest1234567890' },
    { timeoutMs: 5000 }
  );
  assert.equal(capturedRequest.url, '/api/import/youtube/playlist/preview');
  assert.equal(capturedRequest.options.method, 'POST');
  const parsedBody = JSON.parse(capturedRequest.options.body);
  assert.equal(parsedBody.source, 'https://www.youtube.com/playlist?list=PLtest1234567890');
  assert.equal(capturedRequest.options.headers.Authorization, 'Bearer mock-id-token');
  assert.ok(capturedRequest.options.signal, 'must attach AbortController signal');
  assert.equal(result.ok, true);
  assert.equal(result.items.length, 1);
});

test('client wrapper normalizes bounded error envelope into a thrown error with code', async () => {
  const api = loadClient({
    authHandler: async () => ({ Authorization: 'Bearer mock-id-token' }),
    fetchHandler: async () =>
      jsonResponse(404, { ok: false, error: { code: 'PLAYLIST_NOT_FOUND', message: 'Playlist not found.' } }),
  });

  await assert.rejects(
    api.requestPreview({ playlistId: 'PLtest1234567890' }),
    (err) => {
      assert.equal(err.code, 'PLAYLIST_NOT_FOUND');
      assert.equal(err.status, 404);
      return true;
    }
  );
});

test('client wrapper surfaces a fetch abort as a bounded PROVIDER_TIMEOUT', async () => {
  const api = loadClient({
    authHandler: async () => ({ Authorization: 'Bearer mock-id-token' }),
    fetchHandler: async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    },
  });

  await assert.rejects(
    api.requestPreview({ playlistId: 'PLtest1234567890' }, { timeoutMs: 1 }),
    (err) => {
      assert.equal(err.code, 'PROVIDER_TIMEOUT');
      return true;
    }
  );
});

test('client wrapper validateSourceIdentity rejects both/neither and accepts exactly one', () => {
  const api = loadClient({ fetchHandler: async () => jsonResponse(200, '{}') });
  assert.equal(api.validateSourceIdentity({}), false);
  assert.equal(
    api.validateSourceIdentity({
      source: 'https://www.youtube.com/playlist?list=PLtest1234567890',
      playlistId: 'PLtest1234567890',
    }),
    false
  );
  assert.equal(api.validateSourceIdentity({ playlistId: 'PLtest1234567890' }), true);
  assert.equal(
    api.validateSourceIdentity({ source: 'https://www.youtube.com/playlist?list=PLtest1234567890' }),
    true
  );
});

test('client wrapper never references a provider secret or Google endpoint', () => {
  assert.doesNotMatch(CLIENT_SOURCE, /googleapis|youtube\/v3|apiKey|API_KEY|YOUTUBE_DATA_API_KEY/);
  assert.doesNotMatch(CLIENT_SOURCE, /fetch\(\s*['"`]https?:\/\//);
});
