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

test('Engine request uses binding.fetch only', () => {
  assert.match(transportCode, /binding\.fetch\(/);
});

test('service identity headers are constructed server-side only', () => {
  assert.match(transportCode, /X-Padiem-Engine-Caller/);
  assert.match(transportCode, /X-Padiem-Engine-Credential/);
});

test('Engine request path is bounded to /internal/v1/execute', () => {
  assert.match(transportCode, /\/internal\/v1\/execute/);
});

test('agent task_type is general for B14 compatibility', () => {
  assert.match(transportCode, /task_type:\s*['"]general['"]/);
  assert.ok(!/task_type:\s*['"]scout_suggestion['"]/.test(transportCode));
});

test('agent optimize_for is balanced for B14 compatibility', () => {
  assert.match(transportCode, /optimize_for:\s*['"]balanced['"]/);
  assert.ok(!/optimize_for:\s*['"]quality['"]/.test(transportCode));
});

test('agent max_tokens is derived from normalizedIntent.maxOutputLength, not hardcoded', () => {
  assert.ok(!/max_tokens:\s*500/.test(transportCode));
  assert.match(transportCode, /clampMaxTokens\(normalizedIntent\.maxOutputLength\)/);
});

test('max_tokens is bounded to 500 from Product contract', () => {
  assert.match(transportCode, /MAX_ENGINE_MAX_TOKENS\s*=\s*500/);
  assert.match(transportCode, /Math\.min\(Math\.floor\(numeric\)\,\s*MAX_ENGINE_MAX_TOKENS\)/);
});

test('fail-closed on missing Engine binding', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const result = createScoutEngineTransport({
    env: {},
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
    context: {},
  });
  assert.strictEqual(result.status, 'ENGINE_UNAVAILABLE');
  assert.ok(result.error);
  assert.strictEqual(result.error.error.code, 'ENGINE_CREDENTIAL_MISSING');
});

test('fail-closed on missing callerId', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const fakeBinding = { fetch: async () => new Response('{}', { status: 200 }) };
  const result = createScoutEngineTransport({
    env: { PADIEM_AI_ENGINE: fakeBinding, SCOUT_ENGINE_CREDENTIAL: 'cred' },
    context: {},
  });
  assert.strictEqual(result.status, 'ENGINE_UNAVAILABLE');
  assert.ok(result.error);
  assert.strictEqual(result.error.error.code, 'ENGINE_CREDENTIAL_MISSING');
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
      emotionTags: ['감독', '행복'],
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
  assert.deepStrictEqual(result.suggestion.emotionTags, ['감독', '행복']);
  assert.strictEqual(result.suggestion.memoSuggestion, 'Memo');
  assert.strictEqual(result.suggestion.safetyNote, 'Review');
});

test('Engine error maps to bounded Scout error envelope using canonical nested error', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const fakeBinding = {
    fetch: async () =>
      new Response(JSON.stringify({
        ok: false,
        error: {
          code: 'ENGINE_ERROR',
          message: 'boom',
          retryable: false,
          metadata: null,
        },
      }), {
        status: 500,
      }),
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
    requestedLanguage: 'ko',
    desiredTone: 'polite',
    maxOutputLength: 200,
  });

  assert.ok(!result.ok);
  assert.strictEqual(result.error.code, 'ENGINE_ERROR');
  assert.strictEqual(result.error.message, 'boom');
});

test('memoSuggestion is bounded to 500 chars', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const longMemo = 'M'.repeat(1000);
  const engineAnswer = {
    ok: true,
    answer: JSON.stringify({
      titleSuggestion: 'Title',
      summarySuggestion: 'Summary',
      translationSuggestion: 'Translation',
      emotionTags: [],
      memoSuggestion: longMemo,
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
    context: {},
  });

  const result = await transport.suggest({
    excerpt: 'excerpt',
    requestedLanguage: 'ko',
    desiredTone: 'polite',
    maxOutputLength: 200,
  });

  assert.ok(result.ok);
  assert.strictEqual(result.suggestion.memoSuggestion.length, 500);
});

test('maxOutputLength is propagated to agent.max_tokens bounded at 500', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const engineAnswer = {
    ok: true,
    answer: JSON.stringify({
      titleSuggestion: 'Title',
      summarySuggestion: 'Summary',
      translationSuggestion: 'Translation',
      emotionTags: [],
      memoSuggestion: 'Memo',
      safetyNote: 'Review',
    }),
  };
  let capturedBody = null;
  const fakeBinding = {
    fetch: async (_url, options) => {
      capturedBody = options?.body || null;
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

  await transport.suggest({
    excerpt: 'excerpt',
    requestedLanguage: 'ko',
    desiredTone: 'polite',
    maxOutputLength: 200,
  });

  assert.ok(capturedBody);
  const body = JSON.parse(capturedBody);
  assert.strictEqual(body.agent.max_tokens, 200);
});

test('maxOutputLength over 500 is clamped to 500 for agent.max_tokens', async () => {
  const { createScoutEngineTransport } = await importTransport();
  const engineAnswer = {
    ok: true,
    answer: JSON.stringify({
      titleSuggestion: 'Title',
      summarySuggestion: 'Summary',
      translationSuggestion: 'Translation',
      emotionTags: [],
      memoSuggestion: 'Memo',
      safetyNote: 'Review',
    }),
  };
  let capturedBody = null;
  const fakeBinding = {
    fetch: async (_url, options) => {
      capturedBody = options?.body || null;
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

  await transport.suggest({
    excerpt: 'excerpt',
    requestedLanguage: 'ko',
    desiredTone: 'polite',
    maxOutputLength: 9999,
  });

  assert.ok(capturedBody);
  const body = JSON.parse(capturedBody);
  assert.strictEqual(body.agent.max_tokens, 500);
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
  let engineBindingFetchCount = 0;
  const fakeBinding = {
    fetch: async () => {
      engineBindingFetchCount += 1;
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
    context: {},
  });

  await transport.suggest({
    excerpt: 'excerpt',
    sourceUrl: 'https://example.com/article',
    requestedLanguage: 'ko',
    desiredTone: 'polite',
    maxOutputLength: 200,
  });

  assert.strictEqual(engineBindingFetchCount, 1);
});

test('no LoveBud -> Core direct runtime import in module source', () => {
  assert.ok(!transportCode.includes('padiem-ai-core'));
  assert.ok(!transportCode.includes('@padiem/ai-core'));
});

test('module asserts #1882 remains open in source', () => {
  assert.ok(transportCode.includes('Keep #1882 open'));
});
