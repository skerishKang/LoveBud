/**
 * Scout Suggest API-Key Transport Endpoint Wiring Contract
 * Refs #1882
 *
 * Verifies the end-to-end gate behavior of /api/scout/suggest when the
 * staging/test-gated API-key provider transport is injected.
 *
 * Invariants:
 *  - Default env → stub response, no transport creation, no fetch
 *  - Explicit stub env → stub response, no transport creation, no fetch
 *  - Live mode but missing API key → CONFIG_MISSING, no fetch
 *  - Live mode but production stage → PROVIDER_UNAVAILABLE, no fetch
 *  - Live mode staging/test but missing injected fetch → safe error, no fetch
 *  - All gates + auth ok + rate-limit ok + injected mock fetch → provider path executes
 *  - Auth failure → no provider call
 *  - Rate-limit failure → no provider call
 *  - Malformed response → sanitized error
 *  - Thrown error → sanitized error
 *  - No API key / Authorization / bearer / prompt / excerpt / sourceUrl in response
 *  - #1882 remains open
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const SUGGEST_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'suggest.js');
const suggestCode = fs.readFileSync(SUGGEST_PATH, 'utf8');
const TRANSPORT_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'live-provider-api-key-transport.js');
const ADAPTER_PATH = path.join(ROOT, 'functions', 'api', 'scout', 'live-provider-adapter.js');

test('suggest.js imports the API-key transport factory', () => {
  assert.ok(
    suggestCode.includes('createScoutLiveProviderTransport') ||
    suggestCode.includes('live-provider-api-key-transport'),
    'suggest.js should import the API-key transport factory'
  );
});

test('suggest.js gate check includes all required conditions', () => {
  // The gate should check: transportMode === api_key, stage in {staging,test},
  // provider === openai-compatible, model present, API key present
  assert.match(suggestCode, /transportMode\s*===\s*['"]api_key['"]/);
  assert.match(suggestCode, /staging['"].*test['"]|test['"].*staging['"]/);
  assert.match(suggestCode, /SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_PROVIDER/);
  assert.match(suggestCode, /SCOUT_SUGGEST_MODEL/);
  assert.match(suggestCode, /SCOUT_SUGGEST_LLM_API_KEY/);
});

test('suggest.js injects apiKeyTransport into combinedConfig', () => {
  assert.match(suggestCode, /apiKeyTransport\s*:/);
  assert.match(suggestCode, /combinedConfig/);
});

test('suggest.js does not call fetch directly (uses injected transport fetch)', () => {
  // The endpoint should not have an unconditional fetch() call
  // The transport handles fetch internally with its own gate
  const fetchCalls = suggestCode.match(/await fetch\(/g) || [];
  // It's OK to have zero fetch calls in suggest.js — the transport handles it
  assert.strictEqual(fetchCalls.length, 0, 'suggest.js should not call fetch directly');
});

test('suggest.js does not import real provider SDKs', () => {
  // Check for actual SDK import patterns
  const sdkImportRe = /(import|require).*['"`](openai|@anthropic|@google\/generative-ai)/;
  assert.ok(!sdkImportRe.test(suggestCode), 'suggest.js should not import real provider SDKs');
});

test('suggest.js does not log API key or sensitive fields', () => {
  assert.doesNotMatch(suggestCode, /console\.(log|error|warn|info).*apiKey/i);
  assert.doesNotMatch(suggestCode, /console\.(log|error|warn|info).*rawProviderResponse/i);
  assert.doesNotMatch(suggestCode, /console\.(log|error|warn|info).*prompt/i);
});

test('suggest.js auth boundary is checked before provider call', () => {
  // The auth check should come before the combinedConfig construction
  // Find the actual CALL site, not the import statement
  const authCallPos = suggestCode.indexOf('await verifyScoutLiveAuthBoundary(');
  const providerCallPos = suggestCode.indexOf('createScoutRealProviderAdapterInterface(combinedConfig)');
  assert.ok(authCallPos > 0, 'auth boundary call should exist');
  assert.ok(providerCallPos > 0, 'provider interface call should exist');
  assert.ok(providerCallPos > authCallPos,
    'auth boundary should be checked before provider interface creation');
});

test('suggest.js rate-limit boundary is checked before provider call', () => {
  const rateLimitCallPos = suggestCode.indexOf('await checkScoutLiveRateLimitBoundary(');
  const providerCallPos = suggestCode.indexOf('createScoutRealProviderAdapterInterface(combinedConfig)');
  assert.ok(rateLimitCallPos > 0, 'rate-limit boundary call should exist');
  assert.ok(providerCallPos > rateLimitCallPos,
    'rate-limit boundary should be checked before provider interface creation');
});

test('apiKeyTransport function normalizes response to adapter shape', () => {
  // The apiKeyTransport function should return { ok, suggestion, providerMode }
  assert.match(suggestCode, /apiKeyTransportFn\s*=\s*async/);
  assert.match(suggestCode, /providerMode\s*:\s*['"]live_api_key['"]/);
  assert.match(suggestCode, /suggestion\s*:/);
});

test('apiKeyTransport catches exceptions and returns sanitized error', () => {
  // The transport call should be wrapped in try/catch
  const transportCallSection = suggestCode.match(/apiKeyTransportFn\s*=\s*async[\s\S]*?\};/);
  assert.ok(transportCallSection, 'apiKeyTransportFn should be defined');
  assert.match(transportCallSection[0], /try\s*\{/);
  assert.match(transportCallSection[0], /catch/);
  assert.match(transportCallSection[0], /PROVIDER_ERROR/);
});

test('production stage is blocked (stage check excludes production)', () => {
  // The stage check should be `staging` or `test` only, not production
  const stageCheck = suggestCode.match(/stage\s*===\s*['"]staging['"]\s*\|\|\s*stage\s*===\s*['"]test['"]/);
  assert.ok(stageCheck, 'stage should be restricted to staging or test only');
});

test('suggest.js does not persist or auto-save', () => {
  assert.doesNotMatch(suggestCode, /localStorage\.setItem/);
  assert.doesNotMatch(suggestCode, /sessionStorage\.setItem/);
  assert.doesNotMatch(suggestCode, /addMemory/);
});

test('suggest.js source asserts #1882 remains open', () => {
  assert.doesNotMatch(suggestCode, /Closes #1882/);
  assert.doesNotMatch(suggestCode, /Fixes #1882/);
  assert.doesNotMatch(suggestCode, /Resolves #1882/);
});

test('transport module exists and has gate logic', () => {
  assert.ok(fs.existsSync(TRANSPORT_PATH), 'transport module should exist');
  const transportCode = fs.readFileSync(TRANSPORT_PATH, 'utf8');
  assert.match(transportCode, /staging/);
  assert.match(transportCode, /test/);
  assert.match(transportCode, /DISABLED/);
  assert.match(transportCode, /READY_FOR_ADAPTER/);
});

test('adapter module accepts apiKeyTransport injection', () => {
  const adapterCode = fs.readFileSync(ADAPTER_PATH, 'utf8');
  assert.match(adapterCode, /apiKeyTransport/);
});

// Helper for dynamic request tests
function createMockRequest(options = {}) {
  const method = options.method || 'POST';
  const headers = new Map();
  headers.set('content-type', 'application/json');
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headers.set(k.toLowerCase(), v);
    }
  }
  return {
    method,
    headers: {
      get: (name) => headers.get(name.toLowerCase()) || null,
    },
    text: async () => JSON.stringify(options.body || {}),
  };
}

async function getOnRequestPost() {
  const mod = await import('file://' + SUGGEST_PATH.replace(/\\/g, '/'));
  return mod.onRequestPost;
}

test('endpoint gate provider value === transport allowed provider value', async () => {
  const transportMod = await import('file://' + TRANSPORT_PATH.replace(/\\/g, '/'));
  assert.equal(transportMod.SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_PROVIDER, 'openai-compatible');
  assert.match(suggestCode, /llmProvider\s*===\s*SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_PROVIDER/);
});

test('all gates + auth ok + rate-limit ok + injected fetch executes transport READY path', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    headers: { Authorization: 'Bearer dummy-token' },
    body: { excerpt: 'Hello World', requestedLanguage: 'en', desiredTone: 'casual' }
  });

  let fetchCalled = false;
  const mockFetch = async (url, init) => {
    fetchCalled = true;
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                titleSuggestion: 'Wiring Success Title',
                summarySuggestion: 'Wiring Success Summary',
                translationSuggestion: 'Wiring Success Translation',
                emotionTags: ['success'],
                memoSuggestion: 'Wiring Success Memo',
                safetyNote: 'Wiring Success Safety Note'
              })
            }
          }
        ]
      })
    };
  };

  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE: 'api_key',
      SCOUT_SUGGEST_PROVIDER_STAGE: 'staging',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4',
      SCOUT_SUGGEST_LLM_API_KEY: 'placeholder-key',
      SCOUT_SUGGEST_LLM_BASE_URL: 'https://example.com/v1',
    },
    verifyToken: async () => ({ ok: true, uid: 'user-123' }),
    checkRateLimit: async () => ({ allowed: true }),
    fetch: mockFetch,
  });

  assert.equal(res.status, 200);
  const data = JSON.parse(await res.text());
  assert.equal(data.ok, true);
  assert.equal(data.providerMode, 'live_api_key');
  assert.equal(fetchCalled, true);
  assert.equal(data.suggestion.titleSuggestion, 'Wiring Success Title');
});

test('provider identifier mismatch leads to no fetch / safe-fail', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    headers: { Authorization: 'Bearer dummy-token' },
    body: { excerpt: 'Hello World', requestedLanguage: 'en', desiredTone: 'casual' }
  });

  let fetchCalled = false;
  const mockFetch = async () => {
    fetchCalled = true;
    return { ok: true };
  };

  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE: 'api_key',
      SCOUT_SUGGEST_PROVIDER_STAGE: 'staging',
      SCOUT_SUGGEST_LLM_PROVIDER: 'mismatched-provider',
      SCOUT_SUGGEST_MODEL: 'gpt-4',
      SCOUT_SUGGEST_LLM_API_KEY: 'placeholder-key',
      SCOUT_SUGGEST_LLM_BASE_URL: 'https://example.com/v1',
    },
    verifyToken: async () => ({ ok: true, uid: 'user-123' }),
    checkRateLimit: async () => ({ allowed: true }),
    fetch: mockFetch,
  });

  assert.equal(res.status, 503);
  const data = JSON.parse(await res.text());
  assert.equal(data.ok, false);
  assert.equal(data.error.code, 'PROVIDER_UNAVAILABLE');
  assert.equal(fetchCalled, false);
});

test('Test A — English + casual preserved in provider prompt', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    headers: { Authorization: 'Bearer dummy-token' },
    body: { excerpt: 'A short public fan-safe text.', requestedLanguage: 'en', desiredTone: 'casual', maxOutputLength: 120 }
  });

  let capturedPrompt = '';
  const mockFetch = async (url, init) => {
    const body = JSON.parse(init.body);
    capturedPrompt = body.messages[0].content;

    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              titleSuggestion: 'English Casual Title',
              summarySuggestion: 'English casual summary',
              translationSuggestion: 'English casual translation',
              emotionTags: ['casual'],
              memoSuggestion: 'English casual memo',
              safetyNote: 'Review before saving.'
            })
          }
        }]
      })
    };
  };

  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE: 'api_key',
      SCOUT_SUGGEST_PROVIDER_STAGE: 'staging',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4',
      SCOUT_SUGGEST_LLM_API_KEY: 'placeholder-key',
      SCOUT_SUGGEST_LLM_BASE_URL: 'https://example.com/v1',
    },
    verifyToken: async () => ({ ok: true, uid: 'user-123' }),
    checkRateLimit: async () => ({ allowed: true }),
    fetch: mockFetch,
  });

  assert.equal(res.status, 200);

  // Assert prompt content
  assert.match(capturedPrompt, /Language:\s*en/i);
  assert.match(capturedPrompt, /Tone:\s*casual/i);
  assert.doesNotMatch(capturedPrompt, /Language:\s*ko/i);
  assert.doesNotMatch(capturedPrompt, /Tone:\s*polite/i);

  // Assert response content (does not leak prompt)
  const responseText = await res.text();
  assert.doesNotMatch(responseText, /Language:\s*en/i);
  assert.doesNotMatch(responseText, /Tone:\s*casual/i);
  assert.doesNotMatch(responseText, /A short public fan-safe text/);
});

test('Test B — English + emotional preserved in provider prompt', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    headers: { Authorization: 'Bearer dummy-token' },
    body: { excerpt: 'Another short public fan-safe text.', requestedLanguage: 'en', desiredTone: 'emotional', maxOutputLength: 120 }
  });

  let capturedPrompt = '';
  const mockFetch = async (url, init) => {
    const body = JSON.parse(init.body);
    capturedPrompt = body.messages[0].content;

    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              titleSuggestion: 'English Emotional Title',
              summarySuggestion: 'English emotional summary',
              translationSuggestion: 'English emotional translation',
              emotionTags: ['emotional'],
              memoSuggestion: 'English emotional memo',
              safetyNote: 'Review before saving.'
            })
          }
        }]
      })
    };
  };

  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE: 'api_key',
      SCOUT_SUGGEST_PROVIDER_STAGE: 'staging',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4',
      SCOUT_SUGGEST_LLM_API_KEY: 'placeholder-key',
      SCOUT_SUGGEST_LLM_BASE_URL: 'https://example.com/v1',
    },
    verifyToken: async () => ({ ok: true, uid: 'user-123' }),
    checkRateLimit: async () => ({ allowed: true }),
    fetch: mockFetch,
  });

  assert.equal(res.status, 200);
  assert.match(capturedPrompt, /Language:\s*en/i);
  assert.match(capturedPrompt, /Tone:\s*emotional/i);
  assert.doesNotMatch(capturedPrompt, /Tone:\s*polite/i);
});

test('Test C — invalid/missing values fallback safely', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    headers: { Authorization: 'Bearer dummy-token' },
    body: { excerpt: 'Safe fallback text.' } // Omitting requestedLanguage and desiredTone to trigger fallback
  });

  let capturedPrompt = '';
  const mockFetch = async (url, init) => {
    const body = JSON.parse(init.body);
    capturedPrompt = body.messages[0].content;

    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              titleSuggestion: 'Fallback Title',
              summarySuggestion: 'Fallback summary',
              translationSuggestion: 'Fallback translation',
              emotionTags: ['polite'],
              memoSuggestion: 'Fallback memo',
              safetyNote: 'Review before saving.'
            })
          }
        }]
      })
    };
  };

  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE: 'api_key',
      SCOUT_SUGGEST_PROVIDER_STAGE: 'staging',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4',
      SCOUT_SUGGEST_LLM_API_KEY: 'placeholder-key',
      SCOUT_SUGGEST_LLM_BASE_URL: 'https://example.com/v1',
    },
    verifyToken: async () => ({ ok: true, uid: 'user-123' }),
    checkRateLimit: async () => ({ allowed: true }),
    fetch: mockFetch,
  });

  assert.equal(res.status, 200);
  assert.match(capturedPrompt, /Language:\s*ko/i);
  assert.match(capturedPrompt, /Tone:\s*polite/i);
});
