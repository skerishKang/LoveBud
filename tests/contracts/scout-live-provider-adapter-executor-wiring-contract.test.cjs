/**
 * Scout Live Provider Adapter-Executor Wiring Contract Tests
 * Issue Reference: #2620 (Keeps #1882 open.)
 *
 * Verifies that the live provider adapter is wired to the executor skeleton via dependency-injected transport.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');

function readAdapterCode() {
  assert.ok(fs.existsSync(ADAPTER_PATH), 'Adapter file must exist');
  return fs.readFileSync(ADAPTER_PATH, 'utf8');
}

async function importAdapter() {
  return await importAbsolute(ADAPTER_PATH);
}

// ─── STATIC CONTRACT CHECKS ─────────────────────────────────────────────────

test('1. Adapter file imports live-provider-executor.js', () => {
  const code = readAdapterCode();
  assert.match(code, /import[\s\S]*?['"]\.\/live-provider-executor\.js['"]/, 'Must import live-provider-executor.js');
});

test('2. Static Checks: Prohibits provider SDK imports in adapter', () => {
  const code = readAdapterCode();
  
  const prohibitedSdks = [
    'openai',
    'anthropic',
    '@google/generative-ai',
    'gemini',
    'nvidia',
    'openrouter',
    'groq',
    'mistral',
  ];
  
  for (const sdk of prohibitedSdks) {
    const importRegex = new RegExp(`(import|require)\\s+.*['"]${sdk}['"]`, 'i');
    assert.doesNotMatch(code, importRegex, `Should not import or require provider SDK: ${sdk}`);
  }
});

test('3. Static Checks: No direct fetch( or network client added to adapter code', () => {
  const code = readAdapterCode();
  const codeWithoutComments = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  
  assert.doesNotMatch(codeWithoutComments, /\bffetch\s*\(/, 'Should not use ffetch');
  
  // Verify fetch is not called (the word fetch might appear in comments, so check executive paths only)
  const executableFetch = codeWithoutComments.match(/\bfetch\s*\(/);
  assert.equal(executableFetch, null, 'Should not perform fetch calls directly in adapter');
});

test('4. Issue Reference Constraints: Mentions parent issue but prevents auto-closing', () => {
  const testCode = fs.readFileSync(__filename, 'utf8');
  assert.match(testCode, /#1882/, 'Must reference parent issue #1882');
  assert.doesNotMatch(testCode, /closes?\s+#1882/i, 'Must not close parent issue #1882');
  assert.doesNotMatch(testCode, /fixes?\s+#1882/i, 'Must not fix parent issue #1882');
  assert.doesNotMatch(testCode, /resolves?\s+#1882/i, 'Must not resolve parent issue #1882');
});

// ─── FUNCTIONAL SKELETON CHECKS ─────────────────────────────────────────────

test('5. Default adapter path without transport safe-fails with PROVIDER_UNAVAILABLE', async () => {
  const { createScoutRealProviderAdapterInterface } = await importAdapter();

  const env = {
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'gpt-4o',
    SCOUT_SUGGEST_LLM_API_KEY: 'test-provider-key-placeholder',
  };

  const adapter = createScoutRealProviderAdapterInterface(env);
  assert.equal(adapter.status, 'ready_for_adapter');

  const res = await adapter.suggest({ excerpt: 'test prompt' });
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'PROVIDER_UNAVAILABLE');
  assert.equal(res.error.message, 'Scout live provider adapter is not yet connected.');
});

test('6. Missing configuration safe-fails', async () => {
  const { createScoutRealProviderAdapterInterface } = await importAdapter();

  // Disabled mode
  const env1 = {
    SCOUT_SUGGEST_PROVIDER_MODE: 'stub',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'gpt-4o',
    SCOUT_SUGGEST_LLM_API_KEY: 'test-provider-key-placeholder',
  };

  const adapter1 = createScoutRealProviderAdapterInterface(env1);
  assert.equal(adapter1.status, 'disabled');

  const res1 = await adapter1.suggest({ excerpt: 'test prompt' });
  assert.equal(res1.ok, false);
  assert.equal(res1.error.code, 'PROVIDER_UNAVAILABLE');

  // Missing API key
  const env2 = {
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'gpt-4o',
  };

  const adapter2 = createScoutRealProviderAdapterInterface(env2);
  assert.equal(adapter2.status, 'config_missing');

  const res2 = await adapter2.suggest({ excerpt: 'test prompt' });
  assert.equal(res2.ok, false);
  assert.equal(res2.error.code, 'CONFIG_MISSING');
});

test('7. Mock transport success path works network-free, delegates to executor and processes suggestion', async () => {
  const { createScoutRealProviderAdapterInterface } = await importAdapter();

  const mockResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            titleSuggestion: 'Wiring Success Title',
            summarySuggestion: 'Wiring Success Summary',
            translationSuggestion: 'Wiring Success Translation',
            emotionTags: ['happy', 'excited'],
            memoSuggestion: 'Wiring Success Memo',
            safetyNote: 'Wiring Success Safety Note',
          }),
        },
      },
    ],
  };

  let transportCalled = false;
  const mockTransport = async (options) => {
    transportCalled = true;
    assert.equal(options.method, 'POST');
    assert.match(options.headers['Authorization'], /Bearer test-provider-key-placeholder/);
    return mockResponse;
  };

  // Environment with live enabled and providerExecutorTransport injected
  const env = {
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'gpt-4o',
    SCOUT_SUGGEST_LLM_API_KEY: 'test-provider-key-placeholder',
    providerExecutorTransport: mockTransport,
  };

  const adapter = createScoutRealProviderAdapterInterface(env);
  assert.equal(adapter.status, 'ready_for_adapter');

  const res = await adapter.suggest({
    excerpt: 'Test excerpt text.',
    requestedLanguage: 'ko',
    desiredTone: 'polite',
  });

  assert.equal(transportCalled, true);
  assert.equal(res.ok, true);
  assert.ok(res.suggestion);
  assert.equal(res.suggestion.titleSuggestion, 'Wiring Success Title');
  assert.equal(res.suggestion.summarySuggestion, 'Wiring Success Summary');
  assert.deepEqual(res.suggestion.emotionTags, ['happy', 'excited']);
  assert.equal(res.suggestion.safetyNote, 'Wiring Success Safety Note');
  
  // API key must never be returned in suggestion result
  assert.equal(res.apiKey, undefined);
  assert.equal(res.suggestion.apiKey, undefined);
});

test('8. Alternative transport dependency names (executorTransport, mockProviderTransport) are supported', async () => {
  const { createScoutRealProviderAdapterInterface } = await importAdapter();

  const mockResponse = {
    choices: [{ message: { content: JSON.stringify({ titleSuggestion: 'Test' }) } }],
  };

  // Test executorTransport
  const env1 = {
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'gpt-4o',
    SCOUT_SUGGEST_LLM_API_KEY: 'test-provider-key-placeholder',
    executorTransport: async () => mockResponse,
  };
  const adapter1 = createScoutRealProviderAdapterInterface(env1);
  const res1 = await adapter1.suggest({ excerpt: 'text' });
  assert.equal(res1.ok, true);

  // Test mockProviderTransport
  const env2 = {
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'gpt-4o',
    SCOUT_SUGGEST_LLM_API_KEY: 'test-provider-key-placeholder',
    mockProviderTransport: async () => mockResponse,
  };
  const adapter2 = createScoutRealProviderAdapterInterface(env2);
  const res2 = await adapter2.suggest({ excerpt: 'text' });
  assert.equal(res2.ok, true);
});

test('9. Thrown transport errors safe-fail without leaking raw error/token/key', async () => {
  const { createScoutRealProviderAdapterInterface } = await importAdapter();

  const leakedToken = 's' + 'k-leaked-key-12345';
  const mockTransport = async () => {
    throw new Error(`Secret leakage threat: ${leakedToken} in transport failure`);
  };

  const env = {
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'gpt-4o',
    SCOUT_SUGGEST_LLM_API_KEY: 'test-provider-key-placeholder',
    providerExecutorTransport: mockTransport,
  };

  const adapter = createScoutRealProviderAdapterInterface(env);
  const res = await adapter.suggest({ excerpt: 'Fail this.' });

  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'PROVIDER_ERROR');
  assert.equal(res.error.message, 'Scout live suggestion provider failed safely.');
  
  // Assure no trace of raw key or error text in response string
  const resStr = JSON.stringify(res);
  assert.doesNotMatch(resStr, new RegExp(leakedToken));
  assert.doesNotMatch(resStr, /Secret leakage threat/);
});

test('10. Malformed completions responses safe-fail with PROVIDER_ERROR', async () => {
  const { createScoutRealProviderAdapterInterface } = await importAdapter();

  const runWithResponse = async (mockResponse) => {
    const env = {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4o',
      SCOUT_SUGGEST_LLM_API_KEY: 'test-provider-key-placeholder',
      providerExecutorTransport: async () => mockResponse,
    };
    const adapter = createScoutRealProviderAdapterInterface(env);
    return await adapter.suggest({ excerpt: 'test' });
  };

  // Malformed: message choices empty
  const res1 = await runWithResponse({ choices: [] });
  assert.equal(res1.ok, false);
  assert.equal(res1.error.code, 'PROVIDER_ERROR');

  // Malformed: content invalid JSON
  const res2 = await runWithResponse({ choices: [{ message: { content: '{invalid' } }] });
  assert.equal(res2.ok, false);
  assert.equal(res2.error.code, 'PROVIDER_ERROR');
});

test('11. Output validation/safety filter checks are executed on success response', async () => {
  const { createScoutRealProviderAdapterInterface } = await importAdapter();

  const leakedOutputToken = 's' + 'k-keyleakpattern20characterslong';
  // Return flat suggestion containing credential-like pattern in title
  const mockResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            titleSuggestion: `Failure with ${leakedOutputToken}`,
            summarySuggestion: 'Summary text',
            translationSuggestion: 'Translation text',
            emotionTags: [],
            memoSuggestion: '',
            safetyNote: 'Note',
          }),
        },
      },
    ],
  };

  const env = {
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'gpt-4o',
    SCOUT_SUGGEST_LLM_API_KEY: 'test-provider-key-placeholder',
    providerExecutorTransport: async () => mockResponse,
  };

  const adapter = createScoutRealProviderAdapterInterface(env);
  const res = await adapter.suggest({ excerpt: 'Test excerpt' });

  // Output safety filter should catch the 'sk-' key leakage pattern in title and fail the request
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'PROVIDER_ERROR');
});

test('12. Contract source does not contain literal sk-prefixed fake secrets', () => {
  const testCode = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(testCode, /sk-[A-Za-z0-9_-]{10,}/, 'Contract source must not contain literal sk-prefixed fake secrets.');
});
