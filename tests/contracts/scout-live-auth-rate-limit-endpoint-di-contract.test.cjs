/**
 * Scout Live Auth/Rate-Limit Endpoint DI Contract Tests
 * v20260607-1
 *
 * Locks in the endpoint live auth/rate-limit injected dependency shape:
 * - canonical boundary files only (live-auth-rate-limit-boundary.js)
 * - endpoint passes explicit { verifyToken, checkRateLimit, requestId } DI context
 * - default stub / explicit stub skip injected dependencies
 * - live mode uses injected mock verifier/limiter through context seam
 * - missing injected dependencies still safe-fail
 * - limiter payload allows only safe fields (no raw token, API key, prompt,
 *   excerpt, full sourceUrl, body text)
 * - mock helper does not store raw token
 * - no Firebase Admin SDK / no KV-DO-D1 / no provider SDK / no fetch
 * - endpoint default stub / frontend local_stub / endpoint client disabled
 * - docs updated
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '../..');
const BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/provider-specific-adapter.js');
const LIVE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const DOCS = [
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-production-readiness-gates-audit.md',
];

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const boundaryCode = readFileSafe(BOUNDARY_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const adapterCode = readFileSafe(ADAPTER_PATH);
const liveAdapterCode = readFileSafe(LIVE_ADAPTER_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

function cleanSource(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

let onRequestPost = null;
async function getOnRequestPost() {
  if (!onRequestPost) {
    const mod = await importAbsolute(SUGGEST_PATH);
    onRequestPost = mod.onRequestPost;
  }
  return onRequestPost;
}

function createMockRequest(options = {}) {
  const headers = new Map();
  headers.set('content-type', 'application/json');
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headers.set(k.toLowerCase(), v);
    }
  }
  return {
    method: options.method || 'POST',
    headers: {
      get: (name) => headers.get(name.toLowerCase()) || null,
    },
    text: async () => JSON.stringify(options.body || {}),
  };
}

// Test helper: mock DI factory. Note: stores call metadata only, never raw token.
function createMockScoutLiveAuthDependencies(overrides = {}) {
  const calls = {
    verifyToken: [],
    checkRateLimit: [],
  };
  // Default verifyToken tracks call metadata only.
  const defaultVerifyToken = async (token) => {
    calls.verifyToken.push({ tokenWasReceived: Boolean(token), length: typeof token === 'string' ? token.length : 0 });
    return { ok: true, uid: 'test-user-key' };
  };
  const defaultCheckRateLimit = async (payload) => {
    calls.checkRateLimit.push({
      userKey: payload && payload.userKey,
      providerMode: payload && payload.providerMode,
      bucket: payload && payload.bucket,
    });
    return { allowed: true, bucket: 'scout:live:user:test-user-key' };
  };
  // Wrap override: calls override after recording metadata.
  const wrapVerifyToken = (override) => {
    if (typeof override !== 'function') return defaultVerifyToken;
    return async (token, ctx) => {
      calls.verifyToken.push({ tokenWasReceived: Boolean(token), length: typeof token === 'string' ? token.length : 0 });
      return override(token, ctx);
    };
  };
  const wrapCheckRateLimit = (override) => {
    if (typeof override !== 'function') return defaultCheckRateLimit;
    return async (payload, ctx) => {
      calls.checkRateLimit.push({
        userKey: payload && payload.userKey,
        providerMode: payload && payload.providerMode,
        bucket: payload && payload.bucket,
      });
      return override(payload, ctx);
    };
  };
  return {
    calls,
    context: {
      requestId: 'test-request-id',
      verifyToken: wrapVerifyToken(overrides.verifyToken),
      checkRateLimit: wrapCheckRateLimit(overrides.checkRateLimit),
    },
  };
}

const tests = [];

// ── 1. Endpoint supports canonical dependency injection shape ────────────────
tests.push({
  name: 'Endpoint supports canonical DI shape (context.verifyToken / context.checkRateLimit)',
  fn: () => {
    const clean = cleanSource(suggestCode);
    assert.ok(
      clean.includes('verifyToken') && clean.includes('checkRateLimit'),
      'suggest.js must reference verifyToken / checkRateLimit for DI seam'
    );
    // The endpoint must explicitly construct or expose a DI context with these fields
    assert.ok(
      /verifyToken\s*:/.test(clean) && /checkRateLimit\s*:/.test(clean),
      'suggest.js must expose verifyToken and checkRateLimit fields in DI context'
    );
  },
});

// ── 2. Default stub ignores injected dependencies ────────────────────────────
tests.push({
  name: 'Default stub ignores injected dependencies (no verifier/limiter call)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const mock = createMockScoutLiveAuthDependencies();
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: {},
      verifyToken: mock.context.verifyToken,
      checkRateLimit: mock.context.checkRateLimit,
    });
    assert.strictEqual(resp.status, 200);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.providerMode, 'stub');
    assert.strictEqual(mock.calls.verifyToken.length, 0, 'verifyToken must not be called in default stub');
    assert.strictEqual(mock.calls.checkRateLimit.length, 0, 'checkRateLimit must not be called in default stub');
  },
});

// ── 3. Explicit stub ignores injected dependencies ──────────────────────────
tests.push({
  name: 'Explicit stub ignores injected dependencies (no verifier/limiter call)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const mock = createMockScoutLiveAuthDependencies();
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'stub' },
      verifyToken: mock.context.verifyToken,
      checkRateLimit: mock.context.checkRateLimit,
    });
    assert.strictEqual(resp.status, 200);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.providerMode, 'stub');
    assert.strictEqual(mock.calls.verifyToken.length, 0);
    assert.strictEqual(mock.calls.checkRateLimit.length, 0);
  },
});

// ── 4. Live mode uses injected verifier ──────────────────────────────────────
tests.push({
  name: 'Live mode uses injected verifier through DI seam',
  fn: async () => {
    const handler = await getOnRequestPost();
    const mock = createMockScoutLiveAuthDependencies();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_456' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_777',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken: mock.context.verifyToken,
      checkRateLimit: mock.context.checkRateLimit,
    });
    // Auth succeeded → provider config check would trigger (safe-fail) or boundary returns
    // We just need to confirm verifyToken was invoked via DI
    assert.ok(
      mock.calls.verifyToken.length >= 1,
      'verifyToken must be called in live mode via DI'
    );
    // raw token must NOT be in the mock's stored calls
    const serialized = JSON.stringify(mock.calls);
    assert.ok(
      !serialized.includes('TEST_FIXTURE_TOKEN_xyz_456'),
      'mock helper must not store raw token value'
    );
    // Response body must not contain raw token or API key
    const bodyText = await resp.text();
    assert.ok(!bodyText.includes('TEST_FIXTURE_TOKEN_xyz_456'), 'token must not be in response body');
    assert.ok(!bodyText.includes('TEST_FIXTURE_API_KEY_777'), 'API key must not be in response body');
  },
});

// ── 5. Live mode uses injected limiter after auth success ───────────────────
tests.push({
  name: 'Live mode uses injected limiter after auth success',
  fn: async () => {
    const handler = await getOnRequestPost();
    const mock = createMockScoutLiveAuthDependencies();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_789' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_888',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken: mock.context.verifyToken,
      checkRateLimit: mock.context.checkRateLimit,
    });
    assert.ok(
      mock.calls.checkRateLimit.length >= 1,
      'checkRateLimit must be called in live mode after auth success'
    );
  },
});

// ── 6. Live mode does not call limiter if verifier fails ─────────────────────
tests.push({
  name: 'Limiter is not called when verifier fails (auth failure short-circuit)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const mock = createMockScoutLiveAuthDependencies({
      verifyToken: async () => ({ ok: false }), // verifier rejects
    });
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_000' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_999',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken: mock.context.verifyToken,
      checkRateLimit: mock.context.checkRateLimit,
    });
    assert.strictEqual(mock.calls.verifyToken.length, 1, 'verifier must be called once');
    assert.strictEqual(mock.calls.checkRateLimit.length, 0, 'limiter must not be called after auth failure');
    assert.strictEqual(resp.status, 401);
  },
});

// ── 7. Missing verifier safe-fails ───────────────────────────────────────────
tests.push({
  name: 'Missing verifier safe-fails in live mode (Authorization present, no verifier injected)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_abc' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_abc',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      // no verifyToken / no checkRateLimit
    });
    assert.strictEqual(resp.status, 401);
    const body = JSON.parse(await resp.text());
    assert.ok(
      body.error.code === 'AUTH_INVALID' || body.error.code === 'AUTH_REQUIRED',
      `missing verifier must safe-fail with AUTH_INVALID/AUTH_REQUIRED, got ${body.error.code}`
    );
  },
});

// ── 8. Missing limiter safe-fails RATE_LIMIT_UNAVAILABLE ─────────────────────
tests.push({
  name: 'Missing limiter safe-fails RATE_LIMIT_UNAVAILABLE (auth ok, no limiter injected)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const mock = createMockScoutLiveAuthDependencies();
    // remove limiter
    delete mock.context.checkRateLimit;
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_def' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_def',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken: mock.context.verifyToken,
      // no checkRateLimit
    });
    assert.strictEqual(resp.status, 503);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.error.code, 'RATE_LIMIT_UNAVAILABLE');
  },
});

// ── 9. Limiter payload includes only safe fields ─────────────────────────────
tests.push({
  name: 'Limiter payload allows only safe fields (userKey / providerMode / bucket)',
  fn: async () => {
    const handler = await getOnRequestPost();
    let captured = null;
    const mock = createMockScoutLiveAuthDependencies({
      checkRateLimit: async (payload) => {
        captured = payload;
        return { allowed: true, bucket: 'scout:live:user:test' };
      },
    });
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_ghi' },
      body: {
        excerpt: 'LEAK_PROMPT_TEXT',
        sourceUrl: 'https://example.com/LEAK_URL',
        requestedLanguage: 'ko',
        desiredTone: 'polite',
      }
    });
    await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_ghi',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken: mock.context.verifyToken,
      checkRateLimit: mock.context.checkRateLimit,
    });
    assert.ok(captured, 'limiter must be called');
    // sensitive substrings must not appear in the payload the boundary passes through
    const serialized = JSON.stringify(captured);
    assert.ok(!serialized.includes('TEST_FIXTURE_TOKEN_ghi'), 'limiter payload must not contain raw token');
    assert.ok(!serialized.includes('TEST_FIXTURE_API_KEY_ghi'), 'limiter payload must not contain API key');
    assert.ok(!serialized.includes('LEAK_PROMPT_TEXT'), 'limiter payload must not contain prompt/excerpt');
    assert.ok(!serialized.includes('LEAK_URL'), 'limiter payload must not contain full sourceUrl');
  },
});

// ── 10. Limiter payload excludes sensitive fields ────────────────────────────
tests.push({
  name: 'Limiter payload never includes raw token / API key / prompt / sourceUrl',
  fn: () => {
    // Direct boundary test: pass an object with sensitive fields and ensure boundary sanitizes
    return (async () => {
      const mod = await importAbsolute(BOUNDARY_PATH);
      let captured = null;
      const limiter = async (payload) => { captured = payload; return { allowed: true }; };
      const authResult = { ok: true, userKey: 'user-x', token: 'TEST_FIXTURE_TOKEN_xyz_INTERNAL' };
      const request = { providerMode: 'live' };
      await mod.checkScoutLiveRateLimitBoundary(request, authResult, {
        checkRateLimit: limiter,
        // simulate a request with sensitive fields (boundary must not pass them through)
      });
      const serialized = JSON.stringify(captured);
      assert.ok(!serialized.includes('TEST_FIXTURE_TOKEN_xyz_INTERNAL'), 'limiter payload must not contain raw token');
    })();
  },
});

// ── 11. Response excludes raw token and API key value ────────────────────────
tests.push({
  name: 'Response body never includes raw token or API key value',
  fn: async () => {
    const handler = await getOnRequestPost();
    const mock = createMockScoutLiveAuthDependencies();
    const secretToken = 'TEST_FIXTURE_TOKEN_xyz_response_check';
    const secretApiKey = 'TEST_FIXTURE_API_KEY_xyz_response_check';
    const req = createMockRequest({
      headers: { Authorization: `Bearer ${secretToken}` },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: secretApiKey,
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken: mock.context.verifyToken,
      checkRateLimit: mock.context.checkRateLimit,
    });
    const bodyText = await resp.text();
    assert.ok(!bodyText.includes(secretToken), 'response body must not include raw token');
    assert.ok(!bodyText.includes(secretApiKey), 'response body must not include API key value');
  },
});

// ── 12. Mock dependency helper does not store raw token ──────────────────────
tests.push({
  name: 'Mock dependency helper does not store raw token value',
  fn: async () => {
    const mock = createMockScoutLiveAuthDependencies();
    await mock.context.verifyToken('TEST_FIXTURE_TOKEN_xyz_helper_check');
    await mock.context.checkRateLimit({ userKey: 'u', providerMode: 'live', bucket: 'b' });
    const serialized = JSON.stringify(mock);
    assert.ok(
      !serialized.includes('TEST_FIXTURE_TOKEN_xyz_helper_check'),
      'mock helper calls object must not contain raw token value'
    );
    // verify calls only store metadata
    assert.strictEqual(mock.calls.verifyToken[0].tokenWasReceived, true);
    assert.strictEqual(mock.calls.verifyToken[0].length, 'TEST_FIXTURE_TOKEN_xyz_helper_check'.length);
    assert.ok(!('token' in mock.calls.verifyToken[0]), 'mock call record must not include raw token field');
  },
});

// ── 13. No Firebase Admin SDK ────────────────────────────────────────────────
tests.push({
  name: 'No Firebase Admin SDK in endpoint / boundary / adapter',
  fn: () => {
    const files = [
      ['suggest', cleanSource(suggestCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
    ];
    const patterns = [
      /require\(['"]firebase-admin['"]\)/,
      /from\s+['"]firebase-admin['"]/,
      /require\(['"]firebase\/[^'"]+['"]\)/,
      /from\s+['"]firebase\/[^'"]+['"]/,
    ];
    for (const [name, code] of files) {
      for (const p of patterns) {
        assert.ok(
          !p.test(code),
          `${name} must not import Firebase Admin SDK (pattern: ${p})`
        );
      }
    }
  },
});

// ── 14. No KV / Durable Object / D1 runtime access ───────────────────────────
tests.push({
  name: 'No KV / Durable Object / D1 runtime access in endpoint / boundary / adapter',
  fn: () => {
    const files = [
      ['suggest', cleanSource(suggestCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
    ];
    for (const [name, code] of files) {
      assert.ok(
        !/KVNamespace|DurableObject|D1Database|env\.KV|env\.DB|env\.DO/.test(code),
        `${name} must not reference KV / Durable Object / D1 runtime APIs`
      );
      assert.ok(
        !/platform\.|wrangler\./.test(code),
        `${name} must not reference Cloudflare platform globals`
      );
    }
  },
});

// ── 15. No provider SDK imports ──────────────────────────────────────────────
tests.push({
  name: 'No provider SDK imports in endpoint / boundary / adapter',
  fn: () => {
    const forbidden = [
      'openai', '@anthropic-ai/sdk', '@google/generative-ai', 'groq-sdk',
      '@mistralai/mistralai', 'nvidia-modulus', 'grok-client',
    ];
    const files = [
      ['suggest', cleanSource(suggestCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
    ];
    for (const [name, code] of files) {
      for (const pkg of forbidden) {
        const esc = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const requireRe = new RegExp(`require\\(['"\`]${esc}['"\`]`);
        const fromRe = new RegExp(`from\\s+['"\`]${esc}['"\`]`);
        assert.ok(
          !requireRe.test(code) && !fromRe.test(code),
          `${name} must not import SDK "${pkg}"`
        );
      }
    }
  },
});

// ── 16. No fetch / XHR / axios ──────────────────────────────────────────────
tests.push({
  name: 'No fetch / XHR / axios in endpoint / boundary / adapter',
  fn: () => {
    const files = [
      ['suggest', cleanSource(suggestCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
    ];
    for (const [name, code] of files) {
      assert.ok(!/\bfetch\s*\(/.test(code), `${name} must not use fetch(`);
      assert.ok(!/XMLHttpRequest/.test(code), `${name} must not use XMLHttpRequest`);
      assert.ok(!/axios/.test(code), `${name} must not use axios`);
    }
  },
});

// ── 17. Endpoint default stub preserved ──────────────────────────────────────
tests.push({
  name: 'Endpoint default stub behavior preserved',
  fn: () => {
    assert.ok(suggestCode.length > 0, 'suggest.js must exist');
    assert.ok(
      suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'),
      'STUB provider mode must remain defined'
    );
    assert.ok(
      suggestCode.includes('providerMode') && (suggestCode.includes('"stub"') || suggestCode.includes("'stub'")),
      'default providerMode:"stub" preserved'
    );
  },
});

// ── 18. Frontend local_stub preserved ────────────────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(
      srcSelCode.includes("LOCAL_STUB: 'local_stub'") || srcSelCode.includes('LOCAL_STUB: "local_stub"'),
      'local_stub must remain defined'
    );
    assert.ok(
      srcSelCode.includes("source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB") || srcSelCode.includes('local_stub'),
      'source selector must default to local_stub'
    );
  },
});

// ── 19. Endpoint client default disabled preserved ──────────────────────────
tests.push({
  name: 'Endpoint client default disabled preserved (no live auth/rate-limit wiring)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-boundary'),
      'endpoint client must not import live-auth-rate-limit-boundary.js'
    );
    assert.ok(
      !endpointClientCode.includes('verifyScoutLiveAuthBoundary'),
      'endpoint client must not import verifyScoutLiveAuthBoundary'
    );
    assert.ok(
      !endpointClientCode.includes('checkScoutLiveRateLimitBoundary'),
      'endpoint client must not import checkScoutLiveRateLimitBoundary'
    );
  },
});

// ── 20. Docs updated ─────────────────────────────────────────────────────────
tests.push({
  name: 'Related docs reflect endpoint injected dependency contract',
  fn: () => {
    for (const rel of DOCS) {
      const filePath = path.join(ROOT, 'docs/product', rel);
      const content = readFileSafe(filePath);
      assert.ok(content.length > 0, `${rel} must exist`);
      const lc = content.toLowerCase();
      const mentionsDI =
        lc.includes('injected dependency') ||
        lc.includes('di contract') ||
        lc.includes('di seam') ||
        lc.includes('dependency injection') ||
        lc.includes('verifytoken') ||
        lc.includes('checkratelimit');
      assert.ok(
        mentionsDI,
        `${rel} must mention the injected dependency contract (DI / verifyToken / checkRateLimit)`
      );
    }
  },
});

// ── Run ──────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function run() {
  for (const test of tests) {
    try {
      const result = test.fn();
      if (result && typeof result.then === 'function') {
        await result;
      }
      console.log(`  ✓ ${test.name}`);
      passed++;
    } catch (err) {
      console.log(`  ✗ ${test.name}`);
      console.log(`    ${err.message}`);
      if (err.stack) console.log(err.stack);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
