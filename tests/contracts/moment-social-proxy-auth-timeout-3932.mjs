import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = process.cwd();
const routes = [
  ['comments', path.join(root, 'functions/api/memories/[id]/comments.js')],
  ['reactions', path.join(root, 'functions/api/memories/[id]/reactions.js')]
];

function contextFor(request) {
  return { request, env: { MODAL_BASE_URL: 'https://modal.example' }, params: { id: 'memory-1' } };
}

for (const [name, file] of routes) {
  const mod = await import(pathToFileURL(file));

  test(`${name}: GET missing auth fails at edge before fetch`, async () => {
    let fetchCalls = 0;
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must not fetch'); };
    try {
      const response = await mod.onRequestGet(contextFor(new Request('https://lovebud.test/api', { method: 'GET' })));
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('x-lovebud-upstream'), 'cloudflare');
      assert.equal(response.headers.get('x-lovebud-route-status'), 'missing-authorization');
      assert.equal(fetchCalls, 0);
    } finally { globalThis.fetch = oldFetch; }
  });

  test(`${name}: POST missing auth wins before idempotency/body/fetch`, async () => {
    let bodyReads = 0;
    let fetchCalls = 0;
    const request = {
      headers: new Headers({ 'Idempotency-Key': 'bad' }),
      text: async () => { bodyReads += 1; throw new Error('must not read'); }
    };
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must not fetch'); };
    try {
      const response = await mod.onRequestPost(contextFor(request));
      assert.equal(response.status, 401);
      assert.equal(bodyReads, 0);
      assert.equal(fetchCalls, 0);
    } finally { globalThis.fetch = oldFetch; }
  });

  test(`${name}: authenticated POST preserves idempotency guard before fetch`, async () => {
    let fetchCalls = 0;
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalls += 1; return new Response('{}'); };
    try {
      const request = new Request('https://lovebud.test/api', {
        method: 'POST', headers: { authorization: 'Bearer token' }, body: '{}'
      });
      const response = await mod.onRequestPost(contextFor(request));
      assert.equal(response.status, 400);
      assert.equal(fetchCalls, 0);
    } finally { globalThis.fetch = oldFetch; }
  });

  test(`${name}: abort classifies 504; network rejection classifies 503`, async () => {
    const oldFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => { const error = new Error('aborted'); error.name = 'AbortError'; throw error; };
      let response = await mod.onRequestGet(contextFor(new Request('https://lovebud.test/api', { headers: { authorization: 'Bearer token' } })));
      assert.equal(response.status, 504);
      assert.equal(response.headers.get('x-lovebud-route-status'), 'modal-timeout');

      globalThis.fetch = async () => { throw new Error('network down'); };
      response = await mod.onRequestGet(contextFor(new Request('https://lovebud.test/api', { headers: { authorization: 'Bearer token' } })));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('x-lovebud-degraded'), 'modal-unavailable');
    } finally { globalThis.fetch = oldFetch; }
  });

  test(`${name}: success forwards Authorization and Idempotency-Key exactly`, async () => {
    let seen;
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => { seen = { url, options }; return new Response('{"ok":true}', { status: 200 }); };
    try {
      const request = new Request('https://lovebud.test/api', {
        method: 'POST',
        headers: { authorization: 'Bearer EXACT-token', 'Idempotency-Key': 'idem-1234', 'content-type': 'application/json' },
        body: '{"value":1}'
      });
      const response = await mod.onRequestPost(contextFor(request));
      assert.equal(response.status, 200);
      assert.equal(seen.options.headers.authorization, 'Bearer EXACT-token');
      assert.equal(seen.options.headers['Idempotency-Key'], 'idem-1234');
    } finally { globalThis.fetch = oldFetch; }
  });
}
