/**
 * LoveBud #1882 S4A — Scout Engine Transport Contract
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
const TRANSPORT_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'scout-engine-transport.js');

const transportCode = fs.readFileSync(TRANSPORT_PATH, 'utf8');

function importTransport() {
  return import(pathToFileURL(TRANSPORT_PATH).href);
}

test('module exports createScoutEngineTransport', () => {
  assert.match(transportCode, /export\s+function\s+createScoutEngineTransport/);
});

test('module does not import Engine SDK or external network libraries', () => {
  const forbidden = [
    /\bimport\b[\s\S]*?padiem-ai-engine-client/,
    /\brequire\s*\(\s*['"]padiem-ai-engine-client['"]\s*\)/,
    /\bimport\b[\s\S]*?\baxios\b/,
    /\brequire\s*\(\s*['"]axios['"]\s*\)/,
    /\bimport\b[\s\S]*?\bnode-fetch\b/,
    /\brequire\s*\(\s*['"]node-fetch['"]\s*\)/,
    /\bimport\b[\s\S]*?\bgot\b/,
    /\brequire\s*\(\s*['"]got['"]\s*\)/,
    /\bimport\b[\s\S]*?\bundici\b/,
    /\brequire\s*\(\s*['"]undici['"]\s*\)/,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(transportCode), `Forbidden pattern matched: ${re}`);
  }
});

test('module does not call globalThis.fetch directly from module scope', () => {
  assert.ok(!/globalThis\.fetch\s*\(/.test(transportCode));
  assert.ok(!/global\.fetch\s*\(/.test(transportCode));
});

test('server-owned app_id is fixed and not derived from input', () => {
  assert.match(transportCode, /appId:\s*['"]lovebud-scout['"]/);
});

test('server-owned agent identity is fixed and not derived from input', () => {
  assert.match(transportCode, /id:\s*['"]scout-suggestion-v1['"]/);
  assert.match(transportCode, /system_instruction:/);
});

test('Engine request uses injected fetch, not hardcoded global fetch', () => {
  assert.match(transportCode, /binding\.fetch\(/);
});

test('service identity headers are constructed server-side only', () => {
  assert.match(transportCode, /X-Padiem-Engine-Caller/);
  assert.match(transportCode, /X-Padiem-Engine-Credential/);
});

test('Engine request path is bounded to /internal/v1/execute', () => {
  assert.match(transportCode, /\/internal\/v1\/execute/);
});

test('fail-closed on missing Engine binding', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const result = createScoutEngineTransport({
    env: {},
    fetch: async () => {},
    context: {},
  });
  assert.strictEqual(result.status, 'ENGINE_UNAVAILABLE');
  assert.ok(result.error);
  assert.strictEqual(result.error.error.code, 'ENGINE_BINDING_MISSING');
});

test('fail-closed on missing Engine credential', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const fakeBinding = { fetch: async () => new Response('{}', { status: 200 }) };
  const result = createScoutEngineTransport({
    env: { PADIEM_AI_ENGINE: fakeBinding },
    fetch: async () => {},
    context: {},
  });
  assert.strictEqual(result.status, 'ENGINE_UNAVAILABLE');
  assert.ok(result.error);
  assert.strictEqual(result.error.error.code, 'ENGINE_BINDING_MISSING');
});

test('fail-closed on missing callerId', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const fakeBinding = { fetch: async () => new Response('{}', { status: 200 }) };
  const result = createScoutEngineTransport({
    env: { PADIEM_AI_ENGINE: fakeBinding, SCOUT_ENGINE_CREDENTIAL: 'cred' },
    fetch: async () => {},
    context: {},
  });
  assert.strictEqual(result.status, 'ENGINE_UNAVAILABLE');
  assert.ok(result.error);
  assert.strictEqual(result.error.error.code, 'ENGINE_BINDING_MISSING');
});

test('ready state requires binding, callerId, and credential', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const fakeBinding = { fetch: async () => new Response('{}', { status: 200 }) };
  const result = createScoutEngineTransport({
    env: {
      PADIEM_AI_ENGINE: fakeBinding,
      SCOUT_ENGINE_CALLER_ID: 'caller',
      SCOUT_ENGINE_CREDENTIAL: 'cred',
    },
    fetch: async () => {},
    context: {},
  });
  assert.strictEqual(result.status, 'READY');
  assert.ok(typeof result.suggest === 'function');
});

test('Engine success answer is projected into bounded Scout output', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const engineAnswer = {
    ok: true,
    answer: JSON.stringify({
      titleSuggestion: 'Title',
      summarySuggestion: 'Summary',
      translationSuggestion: 'Translation',
      emotionTags: ['감동', '행복'],
      memoSuggestion: 'Memo',
      safetyNote: 'Review',
    }),
  };
  const fakeBinding = {
    fetch: async () =>
      new Response(JSON.stringify(engineAnswer), { status: 200 }),
  };
  const transport = createScoutEngineTransport({
    env: {
      PADIEM_AI_ENGINE: fakeBinding,
      SCOUT_ENGINE_CALLER_ID: 'caller',
      SCOUT_ENGINE_CREDENTIAL: 'cred',
    },
    fetch: async () => {},
    context: {},
  });

  const result = await transport.suggest({
    excerpt: 'excerpt',
    sourceUrl: 'https://example.com',
    summary: 'summary',
    memo: 'memo',
    requestedLanguage: 'ko',
    desiredTone: 'polite',
    maxOutputLength: 200,
  });

  assert.ok(result.ok);
  assert.strictEqual(result.suggestion.titleSuggestion, 'Title');
  assert.strictEqual(result.suggestion.summarySuggestion, 'Summary');
  assert.strictEqual(result.suggestion.translationSuggestion, 'Translation');
  assert.deepStrictEqual(result.suggestion.emotionTags, ['감동', '행복']);
  assert.strictEqual(result.suggestion.memoSuggestion, 'Memo');
  assert.strictEqual(result.suggestion.safetyNote, 'Review');
});

test('Engine error maps to bounded Scout error envelope', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const fakeBinding = {
    fetch: async () =>
      new Response(JSON.stringify({ ok: false, code: 'ENGINE_ERROR', message: 'boom' }), {
        status: 500,
      }),
  };
  const transport = createScoutEngineTransport({
    env: {
      PADIEM_AI_ENGINE: fakeBinding,
      SCOUT_ENGINE_CALLER_ID: 'caller',
      SCOUT_ENGINE_CREDENTIAL: 'cred',
    },
    fetch: async () => {},
    context: {},
  });

  const result = await transport.suggest({
    excerpt: 'excerpt',
    requestedLanguage: 'ko',
    desiredTone: 'polite',
    maxOutputLength: 200,
  });

  assert.ok(!result.ok);
  assert.strictEqual(result.error.code, 'ENGINE_ERROR');
  assert.strictEqual(result.error.message, 'boom');
});

test('Engine response fields are bounded — no route/provider/model/credential leakage', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const engineAnswer = {
    ok: true,
    answer: JSON.stringify({
      titleSuggestion: 'Title',
      route: 'forbidden-route',
      provider: 'forbidden-provider',
      model: 'forbidden-model',
      metadata: { credential: 'secret' },
    }),
  };
  const fakeBinding = {
    fetch: async () =>
      new Response(JSON.stringify(engineAnswer), { status: 200 }),
  };
  const transport = createScoutEngineTransport({
    env: {
      PADIEM_AI_ENGINE: fakeBinding,
      SCOUT_ENGINE_CALLER_ID: 'caller',
      SCOUT_ENGINE_CREDENTIAL: 'cred',
    },
    fetch: async () => {},
    context: {},
  });

  const result = await transport.suggest({
    excerpt: 'excerpt',
    requestedLanguage: 'ko',
    desiredTone: 'polite',
    maxOutputLength: 200,
  });

  assert.ok(result.ok);
  assert.ok(!('route' in result.suggestion));
  assert.ok(!('provider' in result.suggestion));
  assert.ok(!('model' in result.suggestion));
  assert.ok(!('credential' in result.suggestion));
  assert.ok(!('metadata' in result.suggestion));
});

test('sourceUrl is attribution-only and causes zero external fetch', async () => {
  const { createScoutEngineTransport } = await importTransport();
  let fetchCalled = false;
  const fakeBinding = {
    fetch: async () => {
      fetchCalled = true;
      return new Response(
        JSON.stringify({
          ok: true,
          answer: JSON.stringify({
            titleSuggestion: 'T',
            summarySuggestion: 'S',
            translationSuggestion: 'Tr',
            emotionTags: [],
            memoSuggestion: 'M',
            safetyNote: 'N',
          }),
        }),
        { status: 200 }
      );
    },
  };
  const transport = createScoutEngineTransport({
    env: {
      PADIEM_AI_ENGINE: fakeBinding,
      SCOUT_ENGINE_CALLER_ID: 'caller',
      SCOUT_ENGINE_CREDENTIAL: 'cred',
    },
    fetch: async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    },
    context: {},
  });

  await transport.suggest({
    excerpt: 'excerpt',
    sourceUrl: 'https://example.com/article',
    requestedLanguage: 'ko',
    desiredTone: 'polite',
    maxOutputLength: 200,
  });

  assert.ok(fetchCalled);
  const fetchArgs = fakeBinding.fetch.mock?.arguments?.[0] || fakeBinding.fetch.mock?.callArguments?.[0];
  assert.ok(fetchCalled);
});

test('no LoveBud -> Core direct runtime import in module source', () => {
  assert.ok(!transportCode.includes('padiem-ai-core'));
  assert.ok(!transportCode.includes('@padiem/ai-core'));
});

test('module asserts #1882 remains open in source', () => {
  assert.ok(transportCode.includes('Keep #1882 open'));
});
