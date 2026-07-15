/**
 * Scout Live Auth/Rate-Limit Endpoint Safe-Fail Wiring Contract Tests
 * v20260607-1
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '../..');
const BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const DOCS = [
  'docs/product/lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'docs/product/lovebud-scout-serverless-endpoint-boundary.md',
  'docs/product/lovebud-scout-llm-provider-boundary.md',
  'docs/product/lovebud-scout-live-provider-staging-rollout-contract.md',
  'docs/product/lovebud-scout-live-provider-production-readiness-gates-audit.md'
];

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

const suggestCode = readFileSafe(SUGGEST_PATH);
const boundaryCode = readFileSafe(BOUNDARY_PATH);
const adapterCode = readFileSafe(ADAPTER_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

function cleanSource(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Simple Request/Response mock helper
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

// Helper to load suggest endpoint onRequestPost
let onRequestPost = null;
async function getOnRequestPost() {
  if (!onRequestPost) {
    const mod = await importAbsolute(SUGGEST_PATH);
    onRequestPost = mod.onRequestPost;
  }
  return onRequestPost;
}

const tests = [];

// 1. default endpoint POST still returns stub response
tests.push({
  name: 'Default endpoint POST still returns stub response',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({ request: req, env: {} });
    assert.strictEqual(resp.status, 200);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.providerMode, 'stub');
    assert.ok(body.suggestion);
    assert.ok(body.suggestion.safetyNote.includes('자동 생성') || body.suggestion.safetyNote.includes('suggested') || body.suggestion.safetyNote.includes('AI-generated') || body.suggestion.safetyNote.includes('Always review'));
  }
});

// 2. explicit stub/local mode still returns stub response
tests.push({
  name: 'Explicit stub mode still returns stub response',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'stub' }
    });
    assert.strictEqual(resp.status, 200);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.providerMode, 'stub');
  }
});

// 3. live mode without Authorization returns AUTH_REQUIRED
tests.push({
  name: 'Live mode without Authorization returns AUTH_REQUIRED',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'live' }
    });
    assert.strictEqual(resp.status, 401);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'AUTH_REQUIRED');
  }
});

// 4. live mode malformed Authorization returns AUTH_INVALID
tests.push({
  name: 'Live mode malformed Authorization returns AUTH_INVALID',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Basic abc' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'live' }
    });
    assert.strictEqual(resp.status, 401);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'AUTH_INVALID');
  }
});

// 5. live mode with missing verifier safe-fails before provider selection/call
tests.push({
  name: 'Live mode with missing verifier safe-fails before provider selection/call',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer my-token' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'live' }
      // verifyToken is missing in context/dependencies
    });
    assert.strictEqual(resp.status, 401);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'AUTH_INVALID');
  }
});

// 6. live mode with verifier success but missing rate-limit checker returns RATE_LIMIT_UNAVAILABLE
tests.push({
  name: 'Live mode with verifier success but missing rate-limit checker returns RATE_LIMIT_UNAVAILABLE',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer my-token' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const mockVerify = async (token) => {
      return { ok: true, uid: 'user-123' };
    };
    const resp = await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'live' },
      verifyToken: mockVerify
      // checkRateLimit is missing in context/dependencies
    });
    assert.strictEqual(resp.status, 503);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'RATE_LIMIT_UNAVAILABLE');
  }
});

// 7. live mode with rate-limit denied returns RATE_LIMITED
tests.push({
  name: 'Live mode with rate-limit denied returns RATE_LIMITED',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer my-token' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const mockVerify = async () => ({ ok: true, uid: 'user-123' });
    const mockLimiter = async () => ({ allowed: false, retryAfterSeconds: 45 });
    const resp = await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'live' },
      verifyToken: mockVerify,
      checkRateLimit: mockLimiter
    });
    assert.strictEqual(resp.status, 429);
    assert.strictEqual(resp.headers.get('retry-after'), '45');
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'RATE_LIMITED');
  }
});

// 8. live mode with injected verifier/checker success still does not call real provider
tests.push({
  name: 'Live mode with injected verifier/checker success still does not call real provider',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer my-token' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const mockVerify = async () => ({ ok: true, uid: 'user-123' });
    const mockLimiter = async () => ({ allowed: true });
    
    // We pass config so we resolve ready_for_adapter status
    const env = {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_LLM_PROVIDER: 'mock-provider',
      SCOUT_SUGGEST_MODEL: 'mock-model',
      SCOUT_SUGGEST_LLM_API_KEY: 'mock-api-key'
    };
    
    const resp = await handler({
      request: req,
      env,
      verifyToken: mockVerify,
      checkRateLimit: mockLimiter
    });
    
    // Should fail at provider layer with PROVIDER_UNAVAILABLE or similar
    // because no real executor/provider is connected.
    assert.strictEqual(resp.status, 503);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'PROVIDER_UNAVAILABLE');
    assert.strictEqual(body.error.message.includes('not yet connected'), true);
  }
});

// 9. provider-specific adapter selection is not reached unless auth/rate-limit boundary allows it, if observable
tests.push({
  name: 'Provider-specific adapter selection not reached unless auth/rate-limit allowed',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    
    // If auth fails, it must return 401 early.
    const resp = await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'live' }
    });
    assert.strictEqual(resp.status, 401);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.error.code, 'AUTH_REQUIRED');
  }
});

// 10. token value is not included in response
tests.push({
  name: 'Token value is not included in response',
  fn: async () => {
    const handler = await getOnRequestPost();
    const token = 'TEST_FIXTURE_TOKEN_NOT_A_REAL_SECRET_xyz_123';
    const req = createMockRequest({
      headers: { Authorization: `Bearer ${token}` },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'live' }
    });
    const bodyText = await resp.text();
    assert.strictEqual(bodyText.includes(token), false, 'Token must not be present in response body');
  }
});

// 11. API key/env values are not included in response
tests.push({
  name: 'API key/env values are not included in response',
  fn: async () => {
    const handler = await getOnRequestPost();
    const apiKey = 'TEST_FIXTURE_API_KEY_NOT_A_REAL_SECRET_999_aaa';
    const req = createMockRequest({
      headers: { Authorization: 'Bearer my-token' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_API_KEY: apiKey
      }
    });
    const bodyText = await resp.text();
    assert.strictEqual(bodyText.includes(apiKey), false, 'API key value must not be present in response body');
  }
});

// 12. no Firebase Admin SDK import
tests.push({
  name: 'No Firebase Admin SDK import',
  fn: () => {
    assert.strictEqual(cleanSource(suggestCode).includes('firebase-admin'), false);
    assert.strictEqual(cleanSource(boundaryCode).includes('firebase-admin'), false);
  }
});

// 13. no KV/Durable Object/D1 runtime call
tests.push({
  name: 'No KV/Durable Object/D1 runtime call',
  fn: () => {
    const cleanSuggest = cleanSource(suggestCode);
    const cleanBoundary = cleanSource(boundaryCode);
    assert.strictEqual(/KVNamespace/.test(cleanSuggest), false);
    assert.strictEqual(/DurableObject/.test(cleanSuggest), false);
    assert.strictEqual(/D1/.test(cleanSuggest), false);
    assert.strictEqual(/KVNamespace/.test(cleanBoundary), false);
    assert.strictEqual(/DurableObject/.test(cleanBoundary), false);
    assert.strictEqual(/D1/.test(cleanBoundary), false);
  }
});

// 14. no fetch/axios/request/http client
tests.push({
  name: 'No fetch/axios/request/http client in executable code',
  fn: () => {
    const cleanSuggest = cleanSource(suggestCode);
    const cleanBoundary = cleanSource(boundaryCode);
    assert.strictEqual(cleanSuggest.includes('fetch('), false);
    assert.strictEqual(cleanSuggest.includes('axios'), false);
    assert.strictEqual(cleanSuggest.includes('XMLHttpRequest'), false);
    assert.strictEqual(cleanBoundary.includes('fetch('), false);
    assert.strictEqual(cleanBoundary.includes('axios'), false);
    assert.strictEqual(cleanBoundary.includes('XMLHttpRequest'), false);
  }
});

// 15. no sourceUrl fetch
tests.push({
  name: 'No sourceUrl fetch',
  fn: () => {
    const cleanSuggest = cleanSource(suggestCode);
    // Check for actual fetch(sourceUrl) patterns, not just the strings
    // 'sourceUrl' and 'fetch' appearing anywhere. The endpoint validates
    // sourceUrl as a URL but does NOT fetch it. The API-key transport
    // uses fetch for provider calls, not for sourceUrl.
    const sourceUrlFetchRe = /fetch\s*\(\s*[^)]*sourceUrl/i;
    assert.strictEqual(sourceUrlFetchRe.test(cleanSuggest), false,
      'suggest.js must not fetch sourceUrl');
  }
});

// 16. no persistence/auto-save
tests.push({
  name: 'No persistence/auto-save',
  fn: () => {
    const cleanSuggest = cleanSource(suggestCode);
    assert.strictEqual(/localStorage/.test(cleanSuggest), false);
    assert.strictEqual(/sessionStorage/.test(cleanSuggest), false);
    assert.strictEqual(/indexedDB/.test(cleanSuggest), false);
    assert.strictEqual(/addMemoryFromForm/.test(cleanSuggest), false);
  }
});

// 17. endpoint default stub preserved
tests.push({
  name: 'Endpoint default stub preserved',
  fn: () => {
    assert.ok(suggestCode.includes('generateStubSuggestion'));
    assert.ok(suggestCode.includes('Return deterministic stub suggestion'));
  }
});

// 18. frontend default local_stub preserved
tests.push({
  name: 'Frontend default local_stub preserved',
  fn: () => {
    assert.ok(srcSelCode.includes('local_stub'));
  }
});

// 19. staging_live and production_live remain blocked in docs
tests.push({
  name: 'staging_live and production_live remain blocked in docs',
  fn: () => {
    for (const rel of DOCS) {
      const content = readFileSafe(path.join(ROOT, rel));
      if (!content) continue;
      const lc = content.toLowerCase();
      // must contain "staging_live" and "production_live" and "blocked" or "disabled" or "not yet enabled"
      const mentionsStaging = lc.includes('staging_live');
      const mentionsProd = lc.includes('production_live');
      if (mentionsStaging || mentionsProd) {
        assert.ok(
          lc.includes('blocked') || lc.includes('disabled') || lc.includes('not yet enabled') || lc.includes('fail-safe') || lc.includes('no real') || lc.includes('under disabled'),
          `${rel} should describe staging_live / production_live as blocked or disabled`
        );
      }
    }
  }
});

// 20. docs updated
tests.push({
  name: 'docs updated with endpoint safe-fail wiring',
  fn: () => {
    let hasWiredPhrase = false;
    for (const rel of DOCS) {
      const content = readFileSafe(path.join(ROOT, rel));
      if (!content) continue;
      const lc = content.toLowerCase();
      if (lc.includes('live auth/rate-limit endpoint safe-fail wiring') || lc.includes('endpoint safe-fail wiring')) {
        hasWiredPhrase = true;
      }
    }
    assert.ok(hasWiredPhrase, 'At least one document must mention "live auth/rate-limit endpoint safe-fail wiring" or "endpoint safe-fail wiring"');
  }
});

// Runner
let passedCount = 0;
let failedCount = 0;

async function run() {
  console.log('\n🧪 Scout Live Auth/Rate-Limit Endpoint Safe-Fail Contract Tests\n');
  for (const t of tests) {
    try {
      const p = t.fn();
      if (p && typeof p.then === 'function') {
        await p;
      }
      console.log("  ✓ " + t.name);
      passedCount++;
    } catch (err) {
      console.log("  ✗ " + t.name);
      console.log("    " + err.message);
      if (err.stack) {
        console.log(err.stack);
      }
      failedCount++;
    }
  }
  console.log(`\n📊 Results: ${passedCount} passed, ${failedCount} failed`);
  process.exit(failedCount > 0 ? 1 : 0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
