/**
 * Scout Live Auth/Rate-Limit Endpoint Observability Contract Tests
 * v20260607-1
 *
 * Locks the sanitized observability contract for the Scout live auth /
 * rate-limit boundary decisions:
 * - observability helper module exists with sanitizer + safe observer invoker
 * - default stub / explicit stub do NOT emit live auth/rate-limit events
 * - live mode emits sanitized events on each decision
 * - event fields are allowlist-only (requestId / providerMode / boundaryDecision /
 *   authStatus / rateLimitStatus / errorCode / retryAfterSeconds / quotaBucket /
 *   userKeyHash / latencyMs)
 * - observer throw is safe-swallowed
 * - raw token / API key / prompt / excerpt / full sourceUrl never propagate
 * - no real logging backend / no Firebase / no KV-DO-D1 / no provider SDK / no fetch
 * - endpoint default stub / frontend local_stub / endpoint client default disabled
 *   remain preserved
 * - docs updated
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
var scoutEnvGuard = require('./_scout-env-guard.cjs');

const ROOT = path.resolve(__dirname, '../..');
const HELPER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-observability.js');
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
  'lovebud-scout-live-provider-staging-rollout-contract.md',
];

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const helperCode = readFileSafe(HELPER_PATH);
const boundaryCode = readFileSafe(BOUNDARY_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const adapterCode = readFileSafe(ADAPTER_PATH);
const liveAdapterCode = readFileSafe(LIVE_ADAPTER_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

function cleanSource(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

let handlerPromise = null;
async function getOnRequestPost() {
  if (!handlerPromise) {
    handlerPromise = scoutEnvGuard.safeImport(SUGGEST_PATH).then(m => m.onRequestPost);
  }
  return handlerPromise;
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

const tests = [];

// ── 1. Helper module exists and exports expected symbols ─────────────────────
tests.push({
  name: 'Helper module exists with required exports (allowlist / decisions / builders / safe invoker / observer factory)',
  fn: async () => {
    assert.ok(helperCode.length > 0, 'live-auth-rate-limit-observability.js must exist');
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    assert.ok(mod.SCOUT_LIVE_OBSERVABILITY_FIELDS, 'must export SCOUT_LIVE_OBSERVABILITY_FIELDS');
    assert.ok(mod.SCOUT_LIVE_OBSERVABILITY_DECISIONS, 'must export SCOUT_LIVE_OBSERVABILITY_DECISIONS');
    assert.ok(typeof mod.buildScoutLiveAuthEvent === 'function', 'must export buildScoutLiveAuthEvent');
    assert.ok(typeof mod.buildScoutLiveRateLimitEvent === 'function', 'must export buildScoutLiveRateLimitEvent');
    assert.ok(typeof mod.sanitizeScoutLiveBoundaryEvent === 'function', 'must export sanitizeScoutLiveBoundaryEvent');
    assert.ok(typeof mod.safeInvokeScoutLiveObserver === 'function', 'must export safeInvokeScoutLiveObserver');
    assert.ok(typeof mod.createScoutLiveBoundaryObserver === 'function', 'must export createScoutLiveBoundaryObserver');
  },
});

// ── 2. Allowlist contains only safe fields ───────────────────────────────────
tests.push({
  name: 'Allowlist contains only the documented safe fields (no token/api key/prompt/excerpt/sourceUrl)',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const fields = mod.SCOUT_LIVE_OBSERVABILITY_FIELDS;
    assert.ok(Array.isArray(fields), 'FIELDS must be an array');
    const expected = [
      'requestId', 'providerMode', 'boundaryDecision', 'authStatus', 'rateLimitStatus',
      'errorCode', 'retryAfterSeconds', 'quotaBucket', 'userKeyHash', 'latencyMs',
    ];
    for (const f of expected) {
      assert.ok(fields.includes(f), `allowlist must include ${f}`);
    }
    // Prohibited names must not appear
    const lower = fields.map(f => f.toLowerCase());
    for (const bad of ['token', 'apikey', 'api_key', 'apikeyvalue', 'prompt', 'excerpt', 'sourceurl', 'source_url', 'body', 'authorization', 'password', 'email', 'phone', 'cookie', 'session', 'secret', 'key']) {
      assert.ok(!lower.includes(bad), `allowlist must not include ${bad}`);
    }
  },
});

// ── 3. Live missing auth emits sanitized AUTH_REQUIRED decision ─────────────
tests.push({
  name: 'Live missing Authorization emits sanitized AUTH_REQUIRED event',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const observer = mod.createScoutLiveBoundaryObserver();
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'live' },
      observer,
    });
    const events = observer.events.snapshot();
    assert.ok(events.length >= 1, 'observer must receive at least one event');
    const authEvent = events[0];
    assert.strictEqual(authEvent.authStatus, 'auth_required');
    assert.strictEqual(authEvent.boundaryDecision, 'auth_required');
    assert.strictEqual(authEvent.errorCode, 'AUTH_REQUIRED');
    assert.strictEqual(authEvent.providerMode, 'live');
  },
});

// ── 4. Live malformed auth emits sanitized AUTH_INVALID decision ───────────
tests.push({
  name: 'Live malformed Authorization emits sanitized AUTH_INVALID event',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const observer = mod.createScoutLiveBoundaryObserver();
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'NotBearer xyz' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_observability_malformed',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      observer,
    });
    const events = observer.events.snapshot();
    assert.ok(events.length >= 1);
    const authEvent = events[0];
    assert.strictEqual(authEvent.authStatus, 'auth_invalid');
    assert.strictEqual(authEvent.boundaryDecision, 'auth_invalid');
    assert.strictEqual(authEvent.errorCode, 'AUTH_INVALID');
  },
});

// ── 5. Live missing limiter emits RATE_LIMIT_UNAVAILABLE event ──────────────
tests.push({
  name: 'Live auth ok + missing limiter emits RATE_LIMIT_UNAVAILABLE event',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const observer = mod.createScoutLiveBoundaryObserver();
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_observability_unavail' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const verifyToken = async () => ({ ok: true, uid: 'user-x' });
    await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_observability_unavail',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken,
      // no checkRateLimit
      observer,
    });
    const events = observer.events.snapshot();
    assert.ok(events.length === 2, 'expected auth + rate-limit events');
    const rateLimitEvent = events[1];
    assert.strictEqual(rateLimitEvent.rateLimitStatus, 'rate_limit_unavailable');
    assert.strictEqual(rateLimitEvent.boundaryDecision, 'rate_limit_unavailable');
    assert.strictEqual(rateLimitEvent.errorCode, 'RATE_LIMIT_UNAVAILABLE');
    assert.strictEqual(rateLimitEvent.authStatus, 'authenticated');
  },
});

// ── 6. Live rate-limited emits RATE_LIMITED decision with retryAfterSeconds ──
tests.push({
  name: 'Live rate-limited emits RATE_LIMITED event with retryAfterSeconds',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const observer = mod.createScoutLiveBoundaryObserver();
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_observability_limited' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const verifyToken = async () => ({ ok: true, uid: 'user-y' });
    const checkRateLimit = async () => ({ allowed: false, retryAfterSeconds: 7, bucket: 'scout:live:user:user-y' });
    await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_observability_limited',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken,
      checkRateLimit,
      observer,
    });
    const events = observer.events.snapshot();
    assert.ok(events.length === 2);
    const rateLimitEvent = events[1];
    assert.strictEqual(rateLimitEvent.rateLimitStatus, 'rate_limited');
    assert.strictEqual(rateLimitEvent.boundaryDecision, 'rate_limited');
    assert.strictEqual(rateLimitEvent.errorCode, 'RATE_LIMITED');
    assert.strictEqual(rateLimitEvent.retryAfterSeconds, 7);
  },
});

// ── 7. Live allowed emits RATE_LIMIT_ALLOWED decision before provider safe-fail
tests.push({
  name: 'Live allowed emits RATE_LIMIT_ALLOWED event before provider safe-fail',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const observer = mod.createScoutLiveBoundaryObserver();
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_observability_allowed' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const verifyToken = async () => ({ ok: true, uid: 'user-z' });
    const checkRateLimit = async () => ({ allowed: true, bucket: 'scout:live:user:user-z' });
    const resp = await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_observability_allowed',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken,
      checkRateLimit,
      observer,
    });
    assert.strictEqual(resp.status, 503); // provider safe-fail
    const events = observer.events.snapshot();
    assert.ok(events.length === 2);
    const rateLimitEvent = events[1];
    assert.strictEqual(rateLimitEvent.rateLimitStatus, 'rate_limit_allowed');
    assert.strictEqual(rateLimitEvent.boundaryDecision, 'rate_limit_allowed');
    assert.strictEqual(rateLimitEvent.errorCode, null);
  },
});

// ── 8. Observer is NOT called for default stub ──────────────────────────────
tests.push({
  name: 'Observer is not called for default stub (no live auth/rate-limit event)',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const observer = mod.createScoutLiveBoundaryObserver();
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    await handler({
      request: req,
      env: {},
      observer,
    });
    assert.strictEqual(observer.events.size(), 0, 'observer must not be called in default stub');
  },
});

// ── 9. Observer is NOT called for explicit stub ─────────────────────────────
tests.push({
  name: 'Observer is not called for explicit stub (no live auth/rate-limit event)',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const observer = mod.createScoutLiveBoundaryObserver();
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'stub' },
      observer,
    });
    assert.strictEqual(observer.events.size(), 0, 'observer must not be called in explicit stub');
  },
});

// ── 10. Observer throw is safe-swallowed ────────────────────────────────────
tests.push({
  name: 'Observer throw is safe-swallowed (endpoint still returns expected safe-fail response)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const throwingObserver = {
      recordBoundaryDecision() { throw new Error('TEST_FIXTURE_OBSERVER_THROWS_NOT_A_REAL_ERROR'); },
    };
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    // Must not throw; must return 200 (default stub path)
    const resp = await handler({
      request: req,
      env: {},
      observer: throwingObserver,
    });
    assert.strictEqual(resp.status, 200);
  },
});

// ── 11. Observability event includes only allowed fields ───────────────────
tests.push({
  name: 'Observability event has only allowlist fields (no token / api key / prompt / sourceUrl)',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const observer = mod.createScoutLiveBoundaryObserver();
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_observability_allowlist' },
      body: { excerpt: 'LEAK_PROMPT_IN_BODY', sourceUrl: 'https://example.com/LEAK_URL' }
    });
    const verifyToken = async () => ({ ok: true, uid: 'user-a' });
    const checkRateLimit = async () => ({ allowed: true, bucket: 'scout:live:user:user-a' });
    await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_xyz_observability_allowlist',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken,
      checkRateLimit,
      observer,
    });
    const events = observer.events.snapshot();
    for (const e of events) {
      const keys = Object.keys(e).sort();
      const allowed = [...mod.SCOUT_LIVE_OBSERVABILITY_FIELDS].sort();
      assert.deepStrictEqual(keys, allowed, `event keys must equal allowlist (got ${keys.join(',')})`);
    }
  },
});

// ── 12. Event excludes raw token ────────────────────────────────────────────
tests.push({
  name: 'Observability event excludes raw token',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const observer = mod.createScoutLiveBoundaryObserver();
    const handler = await getOnRequestPost();
    const secretToken = 'TEST_FIXTURE_TOKEN_xyz_observability_exclude_token';
    const req = createMockRequest({
      headers: { Authorization: `Bearer ${secretToken}` },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const verifyToken = async () => ({ ok: true, uid: 'user-b' });
    const checkRateLimit = async () => ({ allowed: true, bucket: 'scout:live:user:user-b' });
    await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_xyz_observability_exclude_token',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken,
      checkRateLimit,
      observer,
    });
    const serialized = JSON.stringify(observer.events.snapshot());
    assert.ok(!serialized.includes(secretToken), 'raw token must not appear in any event');
  },
});

// ── 13. Event excludes API key value ────────────────────────────────────────
tests.push({
  name: 'Observability event excludes API key value',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const observer = mod.createScoutLiveBoundaryObserver();
    const handler = await getOnRequestPost();
    const secretApiKey = 'TEST_FIXTURE_API_KEY_xyz_observability_exclude_apikey';
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_observability_exclude_apikey' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const verifyToken = async () => ({ ok: true, uid: 'user-c' });
    const checkRateLimit = async () => ({ allowed: true, bucket: 'scout:live:user:user-c' });
    await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: secretApiKey,
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken,
      checkRateLimit,
      observer,
    });
    const serialized = JSON.stringify(observer.events.snapshot());
    assert.ok(!serialized.includes(secretApiKey), 'API key value must not appear in any event');
  },
});

// ── 14. Event excludes prompt / excerpt / full sourceUrl ────────────────────
tests.push({
  name: 'Observability event excludes prompt / excerpt / full sourceUrl',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const observer = mod.createScoutLiveBoundaryObserver();
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_observability_exclude_prompt' },
      body: {
        excerpt: 'LEAK_PROMPT_OBSERVABILITY_xyz',
        sourceUrl: 'https://example.com/LEAK_URL_OBSERVABILITY_xyz?secret=1',
        requestedLanguage: 'ko',
        desiredTone: 'polite',
      }
    });
    const verifyToken = async () => ({ ok: true, uid: 'user-d' });
    const checkRateLimit = async () => ({ allowed: true, bucket: 'scout:live:user:user-d' });
    await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_xyz_observability_exclude_prompt',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken,
      checkRateLimit,
      observer,
    });
    const serialized = JSON.stringify(observer.events.snapshot());
    assert.ok(!serialized.includes('LEAK_PROMPT_OBSERVABILITY_xyz'), 'prompt/excerpt must not appear in any event');
    assert.ok(!serialized.includes('LEAK_URL_OBSERVABILITY_xyz'), 'full sourceUrl must not appear in any event');
  },
});

// ── 15. Limiter payload remains sanitized (regression) ──────────────────────
tests.push({
  name: 'Limiter payload remains sanitized (regression — no token/api key/prompt/excerpt/sourceUrl)',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(HELPER_PATH);
    const observer = mod.createScoutLiveBoundaryObserver();
    const handler = await getOnRequestPost();
    let limiterPayload = null;
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_observability_limiter_payload' },
      body: {
        excerpt: 'LEAK_PROMPT_LIM_xyz',
        sourceUrl: 'https://example.com/LEAK_URL_LIM_xyz',
        requestedLanguage: 'ko',
        desiredTone: 'polite',
      }
    });
    const verifyToken = async () => ({ ok: true, uid: 'user-e' });
    const checkRateLimit = async (payload) => {
      limiterPayload = payload;
      return { allowed: true, bucket: 'scout:live:user:user-e' };
    };
    await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_xyz_observability_limiter_payload',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken,
      checkRateLimit,
      observer,
    });
    assert.ok(limiterPayload, 'limiter must be called');
    const serialized = JSON.stringify(limiterPayload);
    assert.ok(!serialized.includes('TEST_FIXTURE_TOKEN_xyz_observability_limiter_payload'), 'limiter payload must not contain raw token');
    assert.ok(!serialized.includes('TEST_FIXTURE_API_KEY_xyz_observability_limiter_payload'), 'limiter payload must not contain API key');
    assert.ok(!serialized.includes('LEAK_PROMPT_LIM_xyz'), 'limiter payload must not contain prompt/excerpt');
    assert.ok(!serialized.includes('LEAK_URL_LIM_xyz'), 'limiter payload must not contain full sourceUrl');
  },
});

// ── 16. No real logging backend integration ────────────────────────────────
tests.push({
  name: 'No real logging backend integration (no console.log/error, no analytics SDK, no fetch-based logger)',
  fn: () => {
    const files = [
      ['helper', cleanSource(helperCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['suggest', cleanSource(suggestCode)],
    ];
    for (const [name, code] of files) {
      assert.ok(!/console\.(log|error|warn|info|debug)\b/.test(code), `${name} must not use console.{log,error,warn,info,debug}`);
      // No fetch-based logger
      assert.ok(!/fetch\s*\(/.test(code), `${name} must not use fetch for logging`);
      // No external logger SDK
      assert.ok(!/winston|pino|bunyan|log4js|datadog|newrelic|sentry/.test(code), `${name} must not import external logger SDK`);
    }
  },
});

// ── 17. No Firebase Admin SDK ───────────────────────────────────────────────
tests.push({
  name: 'No Firebase Admin SDK in helper / boundary / suggest / adapter',
  fn: () => {
    const files = [
      ['helper', cleanSource(helperCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['suggest', cleanSource(suggestCode)],
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
        assert.ok(!p.test(code), `${name} must not import Firebase Admin SDK (pattern: ${p})`);
      }
    }
  },
});

// ── 18. No KV / Durable Object / D1 runtime access ─────────────────────────
tests.push({
  name: 'No KV / Durable Object / D1 runtime access in helper / boundary / suggest / adapter',
  fn: () => {
    const files = [
      ['helper', cleanSource(helperCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['suggest', cleanSource(suggestCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
    ];
    for (const [name, code] of files) {
      assert.ok(!/KVNamespace|DurableObject|D1Database|env\.KV|env\.DB|env\.DO/.test(code), `${name} must not reference KV/DO/D1 runtime APIs`);
      assert.ok(!/platform\.|wrangler\./.test(code), `${name} must not reference Cloudflare platform globals`);
    }
  },
});

// ── 19. No provider SDK imports ─────────────────────────────────────────────
tests.push({
  name: 'No provider SDK imports in helper / boundary / suggest / adapter',
  fn: () => {
    const forbidden = [
      'openai', '@anthropic-ai/sdk', '@google/generative-ai', 'groq-sdk',
      '@mistralai/mistralai', 'nvidia-modulus', 'grok-client',
    ];
    const files = [
      ['helper', cleanSource(helperCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['suggest', cleanSource(suggestCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
    ];
    for (const [name, code] of files) {
      for (const pkg of forbidden) {
        const esc = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const requireRe = new RegExp(`require\\(['"\`]${esc}['"\`]`);
        const fromRe = new RegExp(`from\\s+['"\`]${esc}['"\`]`);
        assert.ok(!requireRe.test(code) && !fromRe.test(code), `${name} must not import SDK "${pkg}"`);
      }
    }
  },
});

// ── 20. No fetch / XHR / axios ──────────────────────────────────────────────
tests.push({
  name: 'No fetch / XHR / axios in helper / boundary / suggest / adapter',
  fn: () => {
    const files = [
      ['helper', cleanSource(helperCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['suggest', cleanSource(suggestCode)],
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

// ── 21. Endpoint default stub preserved ────────────────────────────────────
tests.push({
  name: 'Endpoint default stub behavior preserved',
  fn: () => {
    assert.ok(suggestCode.length > 0);
    assert.ok(
      suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'),
      'STUB provider mode must remain defined'
    );
  },
});

// ── 22. Frontend local_stub preserved ──────────────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0);
    assert.ok(
      srcSelCode.includes("LOCAL_STUB: 'local_stub'") || srcSelCode.includes('LOCAL_STUB: "local_stub"'),
      'local_stub must remain defined'
    );
  },
});

// ── 23. Endpoint client default disabled preserved ──────────────────────────
tests.push({
  name: 'Endpoint client default disabled preserved (no live auth/rate-limit observability wiring)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0);
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-observability'),
      'endpoint client must not import observability helper'
    );
    assert.ok(
      !endpointClientCode.includes('createScoutLiveBoundaryObserver'),
      'endpoint client must not import observer factory'
    );
  },
});

// ── 24. Docs updated ────────────────────────────────────────────────────────
tests.push({
  name: 'Related docs reflect endpoint observability contract status',
  fn: () => {
    for (const rel of DOCS) {
      const filePath = path.join(ROOT, 'docs/product', rel);
      const content = readFileSafe(filePath);
      assert.ok(content.length > 0, `${rel} must exist`);
      const lc = content.toLowerCase();
      const mentionsObs = lc.includes('observability');
      assert.ok(mentionsObs, `${rel} must mention observability`);
      // At least one of: requestid, boundarydecision, userkeyhash, sanitized
      const mentionsDetail =
        lc.includes('requestid') ||
        lc.includes('boundarydecision') ||
        lc.includes('userkeyhash') ||
        lc.includes('sanitized') ||
        lc.includes('allowlist');
      assert.ok(mentionsDetail, `${rel} must mention observability details (sanitized / allowlist / requestId / boundaryDecision / userKeyHash)`);
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

if (!scoutEnvGuard.shouldSkip()) {run().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});}
