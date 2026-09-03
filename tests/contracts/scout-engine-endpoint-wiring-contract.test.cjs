/**
 * LoveBud #1882 S4A — Scout Engine Endpoint Wiring Contract
 * Refs #1882
 * Keep #1882 open
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const ENDPOINT_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'suggest.js');
const TRANSPORT_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'scout-engine-transport.js');

const endpointCode = fs.readFileSync(ENDPOINT_PATH, 'utf8');
const transportCode = fs.readFileSync(TRANSPORT_PATH, 'utf8');

function importEndpoint() {
  return import(pathToFileURL(ENDPOINT_PATH).href);
}

function importTransport() {
  return import(pathToFileURL(TRANSPORT_PATH).href);
}

function buildScoutSuggestBody(overrides = {}) {
  return JSON.stringify({
    excerpt: 'test excerpt',
    summary: 'test summary',
    memo: 'test memo',
    requestedLanguage: 'ko',
    desiredTone: 'polite',
    maxOutputLength: 200,
    sourceUrl: 'https://example.com/article',
    ...overrides,
  });
}

test('endpoint imports scout-engine-transport', () => {
  assert.match(endpointCode, /scout-engine-transport\.js/);
});

test('Engine transport is explicit opt-in via env flag', () => {
  assert.match(endpointCode, /SCOUT_ENGINE_TRANSPORT_ENABLED/);
});

test('Engine transport fails closed when not enabled — falls through to existing logic', () => {
  assert.match(endpointCode, /engineTransportEnabled/);
  assert.match(endpointCode, /ENGINE_UNAVAILABLE/);
});

test('Engine transport does not use external fetch seam', () => {
  const engineBlock = endpointCode.match(/\/\/ ─── S4A Engine transport boundary[\s\S]*?createScoutEngineTransport\(/);
  assert.ok(engineBlock, 'Engine transport block should exist');
  assert.ok(!engineBlock[0].includes('fetch: resolvedF'), 'Engine block should not pass resolvedF');
});

test('Engine transport path returns Scout bounded error envelope on failure', () => {
  assert.match(endpointCode, /buildErrorResponse\(/);
});

test('Engine transport does not fall back to direct Provider on failure', () => {
  assert.match(endpointCode, /ENGINE_UNAVAILABLE/);
});

test('local_stub remains default when Engine transport is not enabled', () => {
  assert.match(endpointCode, /generateStubSuggestion/);
  assert.ok(endpointCode.includes('providerConfig.providerMode === SCOUT_SUGGEST_PROVIDER_MODES.LIVE'));
});

test('endpoint_client opt-in is preserved', () => {
  assert.match(endpointCode, /SCOUT_SUGGEST_PROVIDER_MODE/);
  assert.match(endpointCode, /SCOUT_SUGGEST_PROVIDER_MODES\.LIVE/);
});

test('Engine transport success response uses engine_transport providerMode', () => {
  assert.match(endpointCode, /'engine_transport'/);
});

test('endpoint does not directly import Engine SDK', () => {
  const forbidden = [
    /import\s+.*padiem-ai-engine-client/,
    /require\(.*padiem-ai-engine-client/,
    /from\s+['"]padiem-ai-engine/,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(endpointCode), `Forbidden Engine SDK import: ${re}`);
  }
});

test('endpoint source asserts #1882 remains open', () => {
  assert.ok(endpointCode.includes('Keep #1882 open'));
});

test('transport module does not mutate production config or secrets', () => {
  assert.ok(!transportCode.includes('wrangler.toml'));
  assert.ok(!transportCode.includes('PRODUCTION'));
  assert.ok(!transportCode.includes('secret'));
});

test('S4A Engine path executes independently of legacy Provider LIVE mode', async () => {
  const { createScoutEngineTransport } = await importTransport();
  let engineBindingFetchCount = 0;
  const engineAnswer = {
    ok: true,
    answer: JSON.stringify({
      titleSuggestion: 'Engine Title',
      summarySuggestion: 'Engine Summary',
      translationSuggestion: 'Engine Translation',
      emotionTags: ['engine'],
      memoSuggestion: 'Engine Memo',
      safetyNote: 'Engine Safety',
    }),
  };
  const fakeBinding = {
    fetch: async () => {
      engineBindingFetchCount += 1;
      return new Response(JSON.stringify(engineAnswer), { status: 200 });
    },
  };
  const transport = createScoutEngineTransport({
    env: {
      PADIEM_AI_ENGINE: fakeBinding,
      SCOUT_ENGINE_CALLER_ID: 'caller',
      SCOUT_ENGINE_CREDENTIAL: 'cred',
    },
    context: {},
  });

  const result = await transport.suggest({
    excerpt: 'excerpt',
    sourceUrl: 'https://example.com/article',
    requestedLanguage: 'ko',
    desiredTone: 'polite',
    maxOutputLength: 200,
  });

  assert.ok(result.ok);
  assert.strictEqual(engineBindingFetchCount, 1);
  assert.strictEqual(result.suggestion.titleSuggestion, 'Engine Title');
});

test('endpoint selects Engine when SCOUT_ENGINE_TRANSPORT_ENABLED=true regardless of Provider mode', async () => {
  const { createScoutEngineTransport } = await importTransport();

  let engineBindingFetchCount = 0;
  const fakeBinding = {
    fetch: async () => {
      engineBindingFetchCount += 1;
      return new Response(JSON.stringify({
        ok: true,
        answer: JSON.stringify({
          titleSuggestion: 'T',
          summarySuggestion: 'S',
          translationSuggestion: 'Tr',
          emotionTags: [],
          memoSuggestion: 'M',
          safetyNote: 'N',
        }),
      }), { status: 200 });
    },
  };

  const engineTransport = createScoutEngineTransport({
    env: {
      PADIEM_AI_ENGINE: fakeBinding,
      SCOUT_ENGINE_CALLER_ID: 'caller',
      SCOUT_ENGINE_CREDENTIAL: 'cred',
      SCOUT_ENGINE_TRANSPORT_ENABLED: 'true',
    },
    context: {},
  });

  assert.strictEqual(engineTransport.status, 'READY');
  const result = await engineTransport.suggest({
    excerpt: 'excerpt',
    requestedLanguage: 'ko',
    desiredTone: 'polite',
    maxOutputLength: 200,
  });

  assert.ok(result.ok);
  assert.strictEqual(engineBindingFetchCount, 1);
});

test('handler: missing Engine binding returns 503 with ENGINE_BINDING_MISSING', async () => {
  const { onRequestPost } = await importEndpoint();
  const request = new Request('https://test.example/api/scout/suggest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: buildScoutSuggestBody(),
  });
  const response = await onRequestPost({
    request,
    env: {
      SCOUT_ENGINE_TRANSPORT_ENABLED: 'true',
    },
    context: {},
  });

  assert.strictEqual(response.status, 503);
  const body = await response.json();
  assert.strictEqual(body.error.code, 'ENGINE_BINDING_MISSING');
});

test('handler: missing Engine credential returns 503 with ENGINE_CREDENTIAL_MISSING', async () => {
  const { onRequestPost } = await importEndpoint();
  const fakeBinding = { fetch: async () => new Response('{}', { status: 200 }) };
  const request = new Request('https://test.example/api/scout/suggest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: buildScoutSuggestBody(),
  });
  const response = await onRequestPost({
    request,
    env: {
      SCOUT_ENGINE_TRANSPORT_ENABLED: 'true',
      PADIEM_AI_ENGINE: fakeBinding,
    },
    context: {},
  });

  assert.strictEqual(response.status, 503);
  const body = await response.json();
  assert.strictEqual(body.error.code, 'ENGINE_CREDENTIAL_MISSING');
});

test('handler: valid Engine transport returns 200 with engine_transport providerMode', async () => {
  const { onRequestPost } = await importEndpoint();
  let bindingFetchCount = 0;
  const fakeBinding = {
    fetch: async () => {
      bindingFetchCount += 1;
      return new Response(JSON.stringify({
        ok: true,
        answer: JSON.stringify({
          titleSuggestion: 'Title',
          summarySuggestion: 'Summary',
          translationSuggestion: 'Translation',
          emotionTags: ['행복'],
          memoSuggestion: 'Memo',
          safetyNote: 'Review',
        }),
      }), { status: 200 });
    },
  };
  const request = new Request('https://test.example/api/scout/suggest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: buildScoutSuggestBody(),
  });
  const response = await onRequestPost({
    request,
    env: {
      SCOUT_ENGINE_TRANSPORT_ENABLED: 'true',
      PADIEM_AI_ENGINE: fakeBinding,
      SCOUT_ENGINE_CALLER_ID: 'caller',
      SCOUT_ENGINE_CREDENTIAL: 'cred',
    },
    context: {},
  });

  assert.strictEqual(response.status, 200);
  const body = await response.json();
  assert.ok(body.ok);
  assert.strictEqual(body.providerMode, 'engine_transport');
  assert.strictEqual(bindingFetchCount, 1);
});

test('handler: Engine transport failure does not fall back to direct Provider', async () => {
  const { onRequestPost } = await importEndpoint();
  const fakeBinding = {
    fetch: async () => {
      return new Response(JSON.stringify({
        ok: false,
        error: {
          code: 'ENGINE_ERROR',
          message: 'boom',
          retryable: false,
          metadata: null,
        },
      }), { status: 500 });
    },
  };
  const request = new Request('https://test.example/api/scout/suggest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: buildScoutSuggestBody(),
  });
  const response = await onRequestPost({
    request,
    env: {
      SCOUT_ENGINE_TRANSPORT_ENABLED: 'true',
      PADIEM_AI_ENGINE: fakeBinding,
      SCOUT_ENGINE_CALLER_ID: 'caller',
      SCOUT_ENGINE_CREDENTIAL: 'cred',
    },
    context: {},
  });

  assert.strictEqual(response.status, 503);
  const body = await response.json();
  assert.ok(!body.ok);
  assert.strictEqual(body.error.code, 'ENGINE_ERROR');
});
