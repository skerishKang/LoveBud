/**
 * Scout Suggest Endpoint Live Adapter Mock-Only Wiring Contract Tests
 * Issue Reference: #2620 (Keeps #1882 open.)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

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
  const mod = await import(SUGGEST_PATH);
  return mod.onRequestPost;
}

// ─── STATIC CONTRACT CHECKS ─────────────────────────────────────────────────

test('1. Static Checks: Prohibits provider SDK imports in suggest.js', () => {
  const code = readFileSafe(SUGGEST_PATH);
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

test('2. Static Checks: No direct fetch( or network client added to suggest.js code', () => {
  const code = readFileSafe(SUGGEST_PATH);
  const codeWithoutComments = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(codeWithoutComments, /\bffetch\s*\(/, 'Should not use ffetch');
  const executableFetch = codeWithoutComments.match(/\bfetch\s*\(/);
  assert.equal(executableFetch, null, 'Should not perform fetch calls directly in suggest.js');
});

test('3. Issue Reference Constraints: Mentions parent issue but prevents auto-closing', () => {
  const testCode = fs.readFileSync(__filename, 'utf8');
  assert.match(testCode, /#1882/, 'Must reference parent issue #1882');
  assert.doesNotMatch(testCode, /closes?\s+#1882/i, 'Must not close parent issue #1882');
  assert.doesNotMatch(testCode, /fixes?\s+#1882/i, 'Must not fix parent issue #1882');
  assert.doesNotMatch(testCode, /resolves?\s+#1882/i, 'Must not resolve parent issue #1882');
});

// ─── FUNCTIONAL BEHAVIOR CHECKS ──────────────────────────────────────────────

test('4. Default endpoint suggestion without env variables returns deterministic stub', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    body: { excerpt: 'Hello World', requestedLanguage: 'ko', desiredTone: 'polite' }
  });
  const res = await onRequestPost({ request: req, env: {} });
  assert.equal(res.status, 200);
  const data = JSON.parse(await res.text());
  assert.equal(data.ok, true);
  assert.equal(data.providerMode, 'stub');
  assert.ok(data.suggestion);
  assert.ok(data.suggestion.titleSuggestion);
});

test('5. Explicit stub provider mode returns deterministic stub', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    body: { excerpt: 'Hello World', requestedLanguage: 'en', desiredTone: 'casual' }
  });
  const res = await onRequestPost({
    request: req,
    env: { SCOUT_SUGGEST_PROVIDER_MODE: 'stub' }
  });
  assert.equal(res.status, 200);
  const data = JSON.parse(await res.text());
  assert.equal(data.ok, true);
  assert.equal(data.providerMode, 'stub');
});

test('6. Live mode with missing config returns CONFIG_MISSING safe-fail', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    headers: { Authorization: 'Bearer dummy-token' },
    body: { excerpt: 'Hello World' }
  });
  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    },
    verifyToken: async () => ({ ok: true, uid: 'user-123' }),
    checkRateLimit: async () => ({ allowed: true }),
  });
  assert.equal(res.status, 503);
  const data = JSON.parse(await res.text());
  assert.equal(data.ok, false);
  assert.equal(data.error.code, 'CONFIG_MISSING');
});

test('7. Live mode with disabled adapter returns PROVIDER_UNAVAILABLE safe-fail', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    headers: { Authorization: 'Bearer dummy-token' },
    body: { excerpt: 'Hello World' }
  });
  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'false',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4',
      SCOUT_SUGGEST_LLM_API_KEY: 'placeholder-key',
    },
    verifyToken: async () => ({ ok: true, uid: 'user-123' }),
    checkRateLimit: async () => ({ allowed: true }),
  });
  assert.equal(res.status, 503);
  const data = JSON.parse(await res.text());
  assert.equal(data.ok, false);
  assert.equal(data.error.code, 'PROVIDER_UNAVAILABLE');
});

test('8. Live mode ready but no injected transport/executor returns PROVIDER_UNAVAILABLE safe-fail', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    headers: { Authorization: 'Bearer dummy-token' },
    body: { excerpt: 'Hello World' }
  });
  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4',
      SCOUT_SUGGEST_LLM_API_KEY: 'placeholder-key',
    },
    verifyToken: async () => ({ ok: true, uid: 'user-123' }),
    checkRateLimit: async () => ({ allowed: true }),
  });
  assert.equal(res.status, 503);
  const data = JSON.parse(await res.text());
  assert.equal(data.ok, false);
  assert.equal(data.error.code, 'PROVIDER_UNAVAILABLE');
  assert.match(data.error.message, /not yet connected/);
});

test('9. Live mode ready with injected mock executor and allowed auth/rate-limit returns live_mock suggestion', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    headers: { Authorization: 'Bearer dummy-token' },
    body: { excerpt: 'Hello World', requestedLanguage: 'en' }
  });

  let executorCalled = false;
  const mockExecutor = async ({ prompt, normalizedInput }) => {
    executorCalled = true;
    return {
      titleSuggestion: 'Live Mock Injected Title',
      summarySuggestion: 'Live Mock Injected Summary',
      translationSuggestion: 'Live Mock Injected Translation',
      emotionTags: ['injected'],
      memoSuggestion: 'Live Mock Injected Memo',
      safetyNote: 'Live Mock Injected Safety Note',
    };
  };

  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4',
      SCOUT_SUGGEST_LLM_API_KEY: 'placeholder-key',
    },
    verifyToken: async () => ({ ok: true, uid: 'user-123' }),
    checkRateLimit: async () => ({ allowed: true }),
    executor: mockExecutor,
  });

  assert.equal(res.status, 200);
  const data = JSON.parse(await res.text());
  assert.equal(data.ok, true);
  assert.equal(data.providerMode, 'live_mock');
  assert.equal(executorCalled, true);
  assert.equal(data.suggestion.titleSuggestion, 'Live Mock Injected Title');
});

test('10. Auth boundary failure prevents live executor call and returns 401', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    // Missing Authorization header
    body: { excerpt: 'Hello World' }
  });

  let executorCalled = false;
  const mockExecutor = async () => {
    executorCalled = true;
    return {};
  };

  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4',
      SCOUT_SUGGEST_LLM_API_KEY: 'placeholder-key',
    },
    verifyToken: async () => ({ ok: true, uid: 'user-123' }),
    checkRateLimit: async () => ({ allowed: true }),
    executor: mockExecutor,
  });

  assert.equal(res.status, 401);
  const data = JSON.parse(await res.text());
  assert.equal(data.ok, false);
  assert.equal(executorCalled, false);
});

test('11. Rate limit boundary failure prevents live executor call and returns 429', async () => {
  const onRequestPost = await getOnRequestPost();
  const req = createMockRequest({
    headers: { Authorization: 'Bearer dummy-token' },
    body: { excerpt: 'Hello World' }
  });

  let executorCalled = false;
  const mockExecutor = async () => {
    executorCalled = true;
    return {};
  };

  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4',
      SCOUT_SUGGEST_LLM_API_KEY: 'placeholder-key',
    },
    verifyToken: async () => ({ ok: true, uid: 'user-123' }),
    checkRateLimit: async () => ({
      ok: false,
      status: 'rate_limited',
      retryAfterSeconds: 30,
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
    }),
    executor: mockExecutor,
  });

  assert.equal(res.status, 429);
  const data = JSON.parse(await res.text());
  assert.equal(data.ok, false);
  assert.equal(executorCalled, false);
});

test('12. No credential or raw executor leaks in error response', async () => {
  const onRequestPost = await getOnRequestPost();
  const fakeSecret = 's' + 'k-leakpatternkey123456789';
  const req = createMockRequest({
    headers: { Authorization: 'Bearer dummy-token' },
    body: { excerpt: 'Hello World' }
  });

  const mockExecutor = async () => {
    throw new Error(`Danger of leak: ${fakeSecret}`);
  };

  const res = await onRequestPost({
    request: req,
    env: {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_LLM_PROVIDER: 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4',
      SCOUT_SUGGEST_LLM_API_KEY: 'placeholder-key',
    },
    verifyToken: async () => ({ ok: true, uid: 'user-123' }),
    checkRateLimit: async () => ({ allowed: true }),
    executor: mockExecutor,
  });

  assert.equal(res.status, 503);
  const resStr = await res.text();
  assert.doesNotMatch(resStr, new RegExp(fakeSecret));
  assert.doesNotMatch(resStr, /Danger of leak/);
});

test('13. Contract source does not contain literal sk-prefixed fake secrets', () => {
  const testCode = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(testCode, /sk-[A-Za-z0-9_-]{10,}/, 'Contract source must not contain literal sk-prefixed fake secrets.');
});
