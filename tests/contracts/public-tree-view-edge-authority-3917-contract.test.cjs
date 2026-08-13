'use strict';

/**
 * LoveBud — Public tree view edge authority contract (Issue #3917)
 *
 * Executes the real Cloudflare edge function (functions/api/trees/[tree_id]/views.js)
 * in a local Node process with a stubbed global fetch. Proves the security slice:
 *
 *   - The browser sends NO actor identity; the edge derives an anonymous,
 *     server-authoritative actor from CF-Connecting-IP + UTC day + secret and
 *     forwards ONLY a signed assertion as headers (no body).  (Controls A, B, D)
 *   - 100 attacker requests with rotated client body actorKey but the same
 *     trusted edge IP/day collapse to the SAME authoritative edge actor.
 *     (Control C)
 *   - A forged client actorKind=authenticated is ignored; the forwarded
 *     assertion is always actor-kind anonymous.  (Control D)
 *   - Missing secret or missing CF-Connecting-IP → fail closed: no Modal call
 *     and no count.  (Controls I, J)
 *   - The raw IP is never forwarded into the assertion body/headers beyond the
 *     opaque signed digest.  (Control L)
 *
 * Reads/executes production source with injected fetch/env only; no real
 * network, database, browser, auth provider, deployment, or Production resource.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const ROUTE_PATH = path.join(ROOT, 'functions', 'api', 'trees', '[tree_id]', 'views.js');
const ROUTE_SOURCE = fs.readFileSync(ROUTE_PATH, 'utf8');

const TEST_SECRET = 'test-tree-view-authority-secret-3917';

async function loadRoute() {
  return import(pathToFileURL(ROUTE_PATH).href);
}

function makeRequest({ method = 'POST', url, headers = {}, treeId } = {}) {
  const request = {
    method,
    url,
    headers: {
      get: (k) => (Object.prototype.hasOwnProperty.call(headers, k) ? headers[k] : null),
    },
  };
  if (treeId !== undefined) request.treeId = treeId;
  return request;
}

function makeContext(request, env) {
  return { request, env };
}

function installFetchCapture(captured) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    captured.push({ url: String(url), options });
    return new Response('{"counted":true,"viewCount":1}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return () => {
    globalThis.fetch = original;
  };
}

const BASE_URL = 'https://lovebud.pages.dev/api/trees/tree-A/views';
const MODAL_ENV = { MODAL_BASE_URL: 'https://modal.lovebud.internal', TREE_VIEW_AUTHORITY_SECRET: TEST_SECRET };

test('1. successful edge POST forwards a signed anonymous assertion and NO body', async () => {
  const mod = await loadRoute();
  const captured = [];
  const restore = installFetchCapture(captured);
  try {
    const ctx = makeContext(
      makeRequest({
        url: BASE_URL,
        headers: { 'CF-Connecting-IP': '203.0.113.7' },
      }),
      MODAL_ENV
    );
    const response = await mod.onRequestPost(ctx);
    assert.equal(response.status, 200, 'Modal count proxied');
    assert.equal(captured.length, 1, 'exactly one Modal call');
    const { url, options } = captured[0];
    assert.match(url, /modal\.lovebud\.internal\/modal\/public\/trees\/tree-A\/views$/);
    assert.equal(options.method, 'POST');
    assert.equal(options.body, undefined, 'no body forwarded to Modal');

    const h = options.headers;
    assert.equal(h['x-lovebud-tree-view-version'], 'v1');
    assert.equal(h['x-lovebud-tree-view-tree-id'], 'tree-A');
    assert.equal(h['x-lovebud-tree-view-actor-kind'], 'anonymous');
    assert.equal(h['x-lovebud-tree-view-source'], 'public_tree_detail');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(h['x-lovebud-tree-view-counted-window']), 'counted window is UTC day');
    assert.ok(/^[a-f0-9]{64}$/.test(h['x-lovebud-tree-view-actor-key']), 'actor key is opaque 64-hex digest');
    assert.ok(/^[a-f0-9]{64}$/.test(h['x-lovebud-tree-view-signature']), 'signature is 64-hex digest');

    const expected = await mod.signAssertion(
      TEST_SECRET,
      'tree-A',
      h['x-lovebud-tree-view-actor-key'],
      'anonymous',
      'public_tree_detail',
      h['x-lovebud-tree-view-counted-window']
    );
    assert.equal(h['x-lovebud-tree-view-signature'], expected, 'forwarded signature is valid');
  } finally {
    restore();
  }
});

test('2. 100 rotated client actorKeys collapse to the SAME authoritative edge actor', async () => {
  const mod = await loadRoute();
  const captured = [];
  const restore = installFetchCapture(captured);
  try {
    const baseHeaders = { 'CF-Connecting-IP': '198.51.100.23' };
    const actorKeys = new Set();
    const signatures = new Set();
    for (let i = 0; i < 100; i++) {
      const forgedBody = JSON.stringify({
        actorKey: 'attacker-chosen-' + i,
        actorKind: 'authenticated',
        source: 'public_tree_detail',
      });
      const ctx = makeContext(
        makeRequest({
          url: BASE_URL,
          headers: Object.assign({}, baseHeaders, { 'content-type': 'application/json' }),
        }),
        MODAL_ENV
      );
      ctx.request.body = forgedBody;
      await mod.onRequestPost(ctx);
    }
    assert.equal(captured.length, 100, '100 Modal calls proxied');
    for (const { options } of captured) {
      actorKeys.add(options.headers['x-lovebud-tree-view-actor-key']);
      signatures.add(options.headers['x-lovebud-tree-view-signature']);
    }
    assert.equal(actorKeys.size, 1, 'same authoritative edge actor across 100 rotated client keys');
    assert.equal(signatures.size, 1, 'same signed assertion across 100 rotated client keys');
    assert.ok(![...actorKeys][0].startsWith('attacker-chosen-'), 'edge actor ignores client key');
  } finally {
    restore();
  }
});

test('3. forged client actorKind=authenticated is ignored; assertion stays anonymous', async () => {
  const mod = await loadRoute();
  const captured = [];
  const restore = installFetchCapture(captured);
  try {
    const ctx = makeContext(
      makeRequest({
        url: BASE_URL,
        headers: { 'CF-Connecting-IP': '198.51.100.23' },
      }),
      MODAL_ENV
    );
    ctx.request.body = JSON.stringify({ actorKey: 'x', actorKind: 'authenticated' });
    await mod.onRequestPost(ctx);
    assert.equal(captured[0].options.headers['x-lovebud-tree-view-actor-kind'], 'anonymous', 'no authority upgrade');
  } finally {
    restore();
  }
});

test('4. missing secret → fail closed: no Modal call, no count', async () => {
  const mod = await loadRoute();
  const captured = [];
  const restore = installFetchCapture(captured);
  try {
    const ctx = makeContext(
      makeRequest({
        url: BASE_URL,
        headers: { 'CF-Connecting-IP': '198.51.100.23' },
      }),
      { MODAL_BASE_URL: 'https://modal.lovebud.internal' }
    );
    const response = await mod.onRequestPost(ctx);
    assert.equal(response.status, 503, 'fail-closed 503');
    assert.equal(captured.length, 0, 'no Modal call when secret missing');
  } finally {
    restore();
  }
});

test('5. missing CF-Connecting-IP → fail closed: no Modal call, no count', async () => {
  const mod = await loadRoute();
  const captured = [];
  const restore = installFetchCapture(captured);
  try {
    const ctx = makeContext(
      makeRequest({ url: BASE_URL, headers: {} }),
      MODAL_ENV
    );
    const response = await mod.onRequestPost(ctx);
    assert.equal(response.status, 503, 'fail-closed 503');
    assert.equal(captured.length, 0, 'no Modal call when client IP context missing');
  } finally {
    restore();
  }
});

test('6. non-POST method → 405, no Modal call', async () => {
  const mod = await loadRoute();
  const captured = [];
  const restore = installFetchCapture(captured);
  try {
    const ctx = makeContext(
      makeRequest({ method: 'GET', url: BASE_URL, headers: { 'CF-Connecting-IP': '198.51.100.23' } }),
      MODAL_ENV
    );
    const response = await mod.onRequestPost(ctx);
    assert.equal(response.status, 405, 'method not allowed');
    assert.equal(captured.length, 0, 'no Modal call for non-POST');
  } finally {
    restore();
  }
});

test('7. raw IP is never present in the forwarded assertion payload', async () => {
  const mod = await loadRoute();
  const captured = [];
  const restore = installFetchCapture(captured);
  try {
    const ctx = makeContext(
      makeRequest({ url: BASE_URL, headers: { 'CF-Connecting-IP': '203.0.113.7' } }),
      MODAL_ENV
    );
    await mod.onRequestPost(ctx);
    const { options } = captured[0];
    const serialized = JSON.stringify(options.headers);
    assert.ok(!serialized.includes('203.0.113.7'), 'raw IP must not appear in forwarded headers');
    assert.notEqual(options.headers['x-lovebud-tree-view-actor-key'], '203.0.113.7');
  } finally {
    restore();
  }
});

test('8. native Web Request preserves prototype-backed headers through edge authority', async () => {
  const mod = await loadRoute();
  const captured = [];
  const restore = installFetchCapture(captured);
  try {
    const request = new Request(BASE_URL, {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '203.0.113.7' },
    });
    assert.deepEqual(Object.keys(request), [], 'native Request has no enumerable own request fields');

    const response = await mod.onRequestPost(makeContext(request, MODAL_ENV));
    assert.equal(response.status, 200, 'native Request reaches Modal count proxy');
    assert.equal(captured.length, 1, 'exactly one Modal call for native Request');

    const { options } = captured[0];
    assert.equal(options.body, undefined, 'native Request body is not forwarded');
    assert.equal(options.headers['x-lovebud-tree-view-tree-id'], 'tree-A');
    assert.equal(options.headers['x-lovebud-tree-view-actor-kind'], 'anonymous');
    assert.match(options.headers['x-lovebud-tree-view-actor-key'], /^[a-f0-9]{64}$/);
    assert.match(options.headers['x-lovebud-tree-view-signature'], /^[a-f0-9]{64}$/);
  } finally {
    restore();
  }
});

test('9. route never strips native Request prototype fields with Object.assign clone', () => {
  assert.doesNotMatch(
    ROUTE_SOURCE,
    /Object\.assign\s*\(\s*Object\.create\(null\)\s*,\s*request\b/,
    'native Request must be passed intact to authority derivation'
  );
  assert.match(
    ROUTE_SOURCE,
    /buildSignedAssertionHeaders\(request,\s*env\s*\|\|\s*\{\},\s*treeId\)/,
    'treeId must be passed separately while preserving the original Request object'
  );
});
