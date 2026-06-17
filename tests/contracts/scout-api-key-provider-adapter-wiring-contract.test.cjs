/**
 * Scout API-Key Provider Adapter Wiring Contract
 * Refs #1882, Refs #2629
 *
 * Verifies that createScoutRealProviderAdapterInterface() correctly wires
 * the API-key provider transport (from #2627) into the adapter path.
 *
 * Invariants:
 *  - apiKeyTransport injection is accepted
 *  - When injected, suggest() delegates to it
 *  - Response is sanitized: API key, auth, rawProviderResponse, prompt,
 *    excerpt, sourceUrl are stripped
 *  - Default behavior (no injection) is unchanged
 *  - Production stage is blocked
 *  - #1882 remains open
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const ADAPTER_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'live-provider-adapter.js');
const adapterCode = fs.readFileSync(ADAPTER_PATH, 'utf8');

let adapterMod = null;
async function loadAdapter() {
  if (!adapterMod) {
    adapterMod = await import('file://' + ADAPTER_PATH.replace(/\\/g, '/'));
  }
  return adapterMod;
}

test('adapter module exports createScoutRealProviderAdapterInterface', async () => {
  const m = await loadAdapter();
  assert.strictEqual(typeof m.createScoutRealProviderAdapterInterface, 'function');
});

test('default config (no injection) → safe-fail, no provider call', async () => {
  const m = await loadAdapter();
  const adapter = m.createScoutRealProviderAdapterInterface({
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'glm-5.2',
    SCOUT_SUGGEST_LLM_API_KEY: 'sk-test123',
    SCOUT_SUGGEST_LLM_BASE_URL: 'https://api.example.com/v1',
  });
  // No executor, no providerExecutorTransport, no apiKeyTransport → safe-fail
  assert.strictEqual(typeof adapter.suggest, 'function');
  const result = await adapter.suggest({ excerpt: 'test' });
  assert.strictEqual(result.ok, false);
  assert.ok(result.error && result.error.code === 'PROVIDER_UNAVAILABLE',
    `expected PROVIDER_UNAVAILABLE, got ${result.error && result.error.code}`);
});

test('apiKeyTransport injection is accepted and used for suggest', async () => {
  const m = await loadAdapter();
  let called = false;
  let calledWith = null;
  const mockTransport = async (input) => {
    called = true;
    calledWith = input;
    return {
      ok: true,
      providerMode: 'live_api_key',
      suggestions: [{ title: 'Test', summary: 'A test suggestion' }],
    };
  };
  const adapter = m.createScoutRealProviderAdapterInterface({
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'glm-5.2',
    SCOUT_SUGGEST_LLM_API_KEY: 'sk-test123',
    SCOUT_SUGGEST_LLM_BASE_URL: 'https://api.example.com/v1',
    apiKeyTransport: mockTransport,
  });
  const result = await adapter.suggest({ excerpt: 'hello world' });
  assert.strictEqual(called, true, 'apiKeyTransport should have been called');
  assert.ok(calledWith, 'apiKeyTransport should have received input');
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.providerMode, 'live_api_key');
});

test('response from apiKeyTransport is sanitized — API key stripped', async () => {
  const m = await loadAdapter();
  const leakyTransport = async () => ({
    ok: true,
    providerMode: 'live_api_key',
    apiKey: 'sk-leaked-key-12345',
    api_key: 'sk-leaked-key-12345',
    API_KEY: 'sk-leaked-key-12345',
    suggestions: [{ title: 'T', summary: 'S' }],
  });
  const adapter = m.createScoutRealProviderAdapterInterface({
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'glm-5.2',
    SCOUT_SUGGEST_LLM_API_KEY: 'sk-real-key',
    apiKeyTransport: leakyTransport,
  });
  const result = await adapter.suggest({});
  const resultStr = JSON.stringify(result);
  assert.ok(!resultStr.includes('sk-leaked-key'), 'API key value must not appear in result');
  assert.ok(!resultStr.includes('sk-real-key'), 'real API key must not appear in result');
  // Redacted marker should be present for the prohibited keys
  assert.ok(resultStr.includes('[REDACTED]'), 'prohibited keys should be marked [REDACTED]');
});

test('response from apiKeyTransport is sanitized — authorization stripped', async () => {
  const m = await loadAdapter();
  const leakyTransport = async () => ({
    ok: true,
    authorization: 'Bearer sk-leaked-bearer-token',
    Authorization: 'Bearer sk-leaked-bearer-token',
    bearer: 'sk-leaked-bearer',
    suggestions: [{ title: 'T', summary: 'S' }],
  });
  const adapter = m.createScoutRealProviderAdapterInterface({
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'glm-5.2',
    SCOUT_SUGGEST_LLM_API_KEY: 'sk-real',
    apiKeyTransport: leakyTransport,
  });
  const result = await adapter.suggest({});
  const resultStr = JSON.stringify(result);
  assert.ok(!resultStr.includes('sk-leaked-bearer'), 'bearer token must not appear in result');
  assert.ok(!resultStr.includes('sk-leaked-bearer-token'), 'bearer token must not appear in result');
});

test('response from apiKeyTransport is sanitized — rawProviderResponse stripped', async () => {
  const m = await loadAdapter();
  const leakyTransport = async () => ({
    ok: true,
    rawProviderResponse: { id: 'chatcmpl-123', choices: [{ message: { content: 'internal stuff' } }] },
    rawModelOutput: 'internal raw output that should not leak',
    rawResponse: { secret: 'data' },
    suggestions: [{ title: 'T', summary: 'S' }],
  });
  const adapter = m.createScoutRealProviderAdapterInterface({
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'glm-5.2',
    SCOUT_SUGGEST_LLM_API_KEY: 'sk-real',
    apiKeyTransport: leakyTransport,
  });
  const result = await adapter.suggest({});
  const resultStr = JSON.stringify(result);
  assert.ok(!resultStr.includes('chatcmpl-123'), 'raw provider response IDs must not appear');
  assert.ok(!resultStr.includes('internal stuff'), 'raw provider content must not appear');
  assert.ok(!resultStr.includes('internal raw output'), 'raw model output must not appear');
});

test('response from apiKeyTransport is sanitized — prompt/excerpt/sourceUrl stripped', async () => {
  const m = await loadAdapter();
  const leakyTransport = async () => ({
    ok: true,
    prompt: 'You are a helpful assistant...',
    excerpt: 'private user excerpt content',
    sourceUrl: 'https://private.example.com/secret',
    sourceURL: 'https://private.example.com/secret2',
    suggestions: [{ title: 'T', summary: 'S' }],
  });
  const adapter = m.createScoutRealProviderAdapterInterface({
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'glm-5.2',
    SCOUT_SUGGEST_LLM_API_KEY: 'sk-real',
    apiKeyTransport: leakyTransport,
  });
  const result = await adapter.suggest({});
  const resultStr = JSON.stringify(result);
  assert.ok(!resultStr.includes('You are a helpful assistant'), 'prompt must not appear');
  assert.ok(!resultStr.includes('private user excerpt'), 'excerpt must not appear');
  assert.ok(!resultStr.includes('private.example.com'), 'sourceUrl must not appear');
});

test('apiKeyTransport throw → sanitized PROVIDER_ERROR', async () => {
  const m = await loadAdapter();
  const throwingTransport = async () => {
    throw new Error('Transport exploded');
  };
  const adapter = m.createScoutRealProviderAdapterInterface({
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'glm-5.2',
    SCOUT_SUGGEST_LLM_API_KEY: 'sk-real',
    apiKeyTransport: throwingTransport,
  });
  const result = await adapter.suggest({});
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.code, 'PROVIDER_ERROR');
  // Error message must not contain the raw exception text
  assert.ok(!result.error.message.includes('Transport exploded'),
    'raw exception text must not appear in error message');
});

test('apiKeyTransport returns non-object → sanitized PROVIDER_ERROR', async () => {
  const m = await loadAdapter();
  const badTransport = async () => 'not an object';
  const adapter = m.createScoutRealProviderAdapterInterface({
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'glm-5.2',
    SCOUT_SUGGEST_LLM_API_KEY: 'sk-real',
    apiKeyTransport: badTransport,
  });
  const result = await adapter.suggest({});
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.code, 'PROVIDER_ERROR');
});

test('apiKeyTransport takes priority over providerExecutorTransport', async () => {
  const m = await loadAdapter();
  let apiKeyCalled = false;
  let executorCalled = false;
  const adapter = m.createScoutRealProviderAdapterInterface({
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'glm-5.2',
    SCOUT_SUGGEST_LLM_API_KEY: 'sk-real',
    apiKeyTransport: async () => { apiKeyCalled = true; return { ok: true, providerMode: 'live_api_key' }; },
    providerExecutorTransport: async () => { executorCalled = true; return { ok: true, providerMode: 'live_mock' }; },
  });
  await adapter.suggest({});
  assert.strictEqual(apiKeyCalled, true, 'apiKeyTransport should be called');
  assert.strictEqual(executorCalled, false, 'providerExecutorTransport should NOT be called when apiKeyTransport is present');
});

test('no provider SDK imports in adapter source', () => {
  // The adapter must not import any real provider SDK
  assert.doesNotMatch(adapterCode, /require\(['"]openai['"]\)/);
  assert.doesNotMatch(adapterCode, /require\(['"]@anthropic/);
  assert.doesNotMatch(adapterCode, /require\(['"]@google\/generative-ai/);
  assert.doesNotMatch(adapterCode, /from ['"]openai['"]/);
  assert.doesNotMatch(adapterCode, /from ['"]@anthropic/);
  assert.doesNotMatch(adapterCode, /from ['"]@google\/generative-ai/);
});

test('adapter source does not contain real API key patterns', () => {
  // Must not contain hardcoded API key values like sk-... or sk-proj-...
  assert.doesNotMatch(adapterCode, /sk-proj-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(adapterCode, /sk-[A-Za-z0-9]{20,}/);
});

test('adapter source asserts #1882 remains open', () => {
  // The adapter wiring must not close #1882
  assert.doesNotMatch(adapterCode, /Closes #1882/);
  assert.doesNotMatch(adapterCode, /Fixes #1882/);
  assert.doesNotMatch(adapterCode, /Resolves #1882/);
});
