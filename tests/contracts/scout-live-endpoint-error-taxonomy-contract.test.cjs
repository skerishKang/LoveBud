/**
 * Scout Live Endpoint Error Taxonomy Contract Tests
 * v20260607-1
 *
 * Locks the Scout live endpoint error taxonomy contract:
 * - taxonomy document exists with required sections
 * - error categories / canonical error codes / HTTP status mapping are documented
 * - response body shape and Retry-After policy are documented
 * - observability mapping is documented
 * - sensitive data prohibition is documented
 * - endpoint response shape matches taxonomy at the code level
 *   (missing auth / malformed auth / rate-limited / rate-limit unavailable /
 *    provider unavailable / observer throw / default stub / explicit stub)
 * - no Firebase Admin SDK / no KV-DO-D1 / no provider SDK / no fetch
 * - endpoint default stub / frontend local_stub / endpoint client default
 *   disabled remain preserved
 * - related docs updated
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
var scoutEnvGuard = require('./_scout-env-guard.cjs');

const ROOT = path.resolve(__dirname, '../..');
const TAXONOMY_DOC = path.join(ROOT, 'docs/product/lovebud-scout-live-endpoint-error-taxonomy-contract.md');
const HELPER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-observability.js');
const BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/provider-specific-adapter.js');
const LIVE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const RELATED_DOCS = [
  'lovebud-scout-live-auth-rate-limit-readiness-audit.md',
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-production-readiness-gates-audit.md',
  'lovebud-scout-live-provider-staging-rollout-contract.md',
  'lovebud-scout-ai-suggestion-mvp-readiness.md',
  'lovebud-scout-live-provider-readiness-audit.md',
];

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const taxonomyDoc = readFileSafe(TAXONOMY_DOC);
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

// ── 1. Taxonomy document exists ─────────────────────────────────────────────
tests.push({
  name: 'Taxonomy document exists',
  fn: () => {
    assert.ok(taxonomyDoc.length > 0, 'taxonomy document must exist at docs/product/lovebud-scout-live-endpoint-error-taxonomy-contract.md');
    assert.ok(/^#\s.*Error Taxonomy/m.test(taxonomyDoc), 'document must start with a top-level heading');
  },
});

// ── 2. Error categories are documented ─────────────────────────────────────
tests.push({
  name: 'Error categories are documented (9 categories)',
  fn: () => {
    const lc = taxonomyDoc.toLowerCase();
    for (const cat of [
      'request_validation',
      'auth',
      'rate_limit',
      'config',
      'provider_availability',
      'provider_response',
      'output_safety',
      'observability',
      'internal_boundary',
    ]) {
      assert.ok(lc.includes(cat), `taxonomy must mention category "${cat}"`);
    }
  },
});

// ── 3. Canonical error codes are documented ─────────────────────────────────
tests.push({
  name: 'Canonical error codes are documented (12 codes)',
  fn: () => {
    for (const code of [
      'INVALID_REQUEST',
      'VALIDATION_ERROR',
      'AUTH_REQUIRED',
      'AUTH_INVALID',
      'RATE_LIMITED',
      'RATE_LIMIT_UNAVAILABLE',
      'CONFIG_MISSING',
      'PROVIDER_UNAVAILABLE',
      'PROVIDER_ERROR',
      'OUTPUT_SAFETY_BLOCKED',
      'OBSERVABILITY_UNAVAILABLE',
      'INTERNAL_BOUNDARY_ERROR',
    ]) {
      assert.ok(taxonomyDoc.includes(code), `taxonomy must mention code "${code}"`);
    }
  },
});

// ── 4. HTTP status mapping is documented ────────────────────────────────────
tests.push({
  name: 'HTTP status mapping is documented (400/401/405/413/422/429/500/502/503)',
  fn: () => {
    for (const status of ['400', '401', '405', '413', '422', '429', '500', '502', '503']) {
      assert.ok(taxonomyDoc.includes(status), `taxonomy must mention HTTP status ${status}`);
    }
  },
});

// ── 5. Response body shape is documented ────────────────────────────────────
tests.push({
  name: 'Response body shape is documented (ok/providerMode/error.code/error.message)',
  fn: () => {
    assert.ok(taxonomyDoc.includes('"ok"') || /`ok`/.test(taxonomyDoc), 'taxonomy must document `ok` field');
    assert.ok(taxonomyDoc.includes('"providerMode"') || /`providerMode`/.test(taxonomyDoc), 'taxonomy must document `providerMode` field');
    assert.ok(taxonomyDoc.includes('error.code') || /`error\.code`/.test(taxonomyDoc) || /`code`/.test(taxonomyDoc), 'taxonomy must document error.code');
    assert.ok(taxonomyDoc.includes('error.message') || /`error\.message`/.test(taxonomyDoc) || /`message`/.test(taxonomyDoc), 'taxonomy must document error.message');
  },
});

// ── 6. Retry-After policy is documented ─────────────────────────────────────
tests.push({
  name: 'Retry-After policy is documented (only on RATE_LIMITED with positive retryAfterSeconds)',
  fn: () => {
    const lc = taxonomyDoc.toLowerCase();
    assert.ok(lc.includes('retry-after'), 'taxonomy must mention Retry-After');
    assert.ok(lc.includes('rate_limited') || lc.includes('ratelimited'), 'taxonomy must connect Retry-After to RATE_LIMITED');
    assert.ok(
      lc.includes('retry-after') && /Retry-After[\s\S]{0,200}RATE_LIMITED/i.test(taxonomyDoc),
      'taxonomy must explain Retry-After is only on RATE_LIMITED'
    );
  },
});

// ── 7. Observability mapping is documented ─────────────────────────────────
tests.push({
  name: 'Observability mapping is documented (auth/rate-limit decisions; OBSERVABILITY_UNAVAILABLE safe-swallowed)',
  fn: () => {
    const lc = taxonomyDoc.toLowerCase();
    assert.ok(lc.includes('boundarydecision'), 'taxonomy must mention boundaryDecision');
    assert.ok(lc.includes('authstatus'), 'taxonomy must mention authStatus');
    assert.ok(lc.includes('ratelimitstatus'), 'taxonomy must mention rateLimitStatus');
    assert.ok(
      lc.includes('safe-swallow') || lc.includes('safe swallow') || lc.includes('safely swallowed') || lc.includes('never returned'),
      'taxonomy must explain OBSERVABILITY_UNAVAILABLE is safe-swallowed / never returned to client'
    );
  },
});

// ── 8. Sensitive data prohibition is documented ─────────────────────────────
tests.push({
  name: 'Sensitive data prohibition is documented (no raw token / API key / prompt / excerpt / sourceUrl / raw body / raw provider output / PII / credentials)',
  fn: () => {
    const lc = taxonomyDoc.toLowerCase();
    for (const term of ['raw token', 'api key', 'prompt', 'excerpt', 'sourceurl', 'raw request body', 'raw provider output', 'credentials', 'pii']) {
      assert.ok(lc.includes(term), `taxonomy must prohibit "${term}"`);
    }
  },
});

// ── 9. Endpoint missing auth response matches taxonomy ─────────────────────
tests.push({
  name: 'Endpoint missing auth response matches taxonomy (401 + AUTH_REQUIRED + safe shape)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'live' },
    });
    assert.strictEqual(resp.status, 401);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'AUTH_REQUIRED');
    assert.ok(typeof body.error.message === 'string' && body.error.message.length > 0);
  },
});

// ── 10. Endpoint malformed auth response matches taxonomy ──────────────────
tests.push({
  name: 'Endpoint malformed auth response matches taxonomy (401 + AUTH_INVALID + safe shape)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'NotBearer xyz' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_xyz_taxonomy_malformed',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
    });
    assert.strictEqual(resp.status, 401);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'AUTH_INVALID');
    assert.ok(typeof body.error.message === 'string' && body.error.message.length > 0);
  },
});

// ── 11. Endpoint rate-limited response matches taxonomy ────────────────────
tests.push({
  name: 'Endpoint rate-limited response matches taxonomy (429 + RATE_LIMITED + Retry-After)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_taxonomy_limited' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const verifyToken = async () => ({ ok: true, uid: 'user-t1' });
    const checkRateLimit = async () => ({ allowed: false, retryAfterSeconds: 9, bucket: 'scout:live:user:user-t1' });
    const resp = await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_xyz_taxonomy_limited',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken,
      checkRateLimit,
    });
    assert.strictEqual(resp.status, 429);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'RATE_LIMITED');
    const retryAfter = resp.headers.get('retry-after');
    assert.strictEqual(retryAfter, '9');
  },
});

// ── 12. Endpoint rate-limit unavailable response matches taxonomy ──────────
tests.push({
  name: 'Endpoint rate-limit unavailable response matches taxonomy (503 + RATE_LIMIT_UNAVAILABLE)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_taxonomy_unavail' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const verifyToken = async () => ({ ok: true, uid: 'user-t2' });
    // no checkRateLimit
    const resp = await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: 'TEST_FIXTURE_API_KEY_xyz_taxonomy_unavail',
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken,
    });
    assert.strictEqual(resp.status, 503);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, 'RATE_LIMIT_UNAVAILABLE');
  },
});

// ── 13. Endpoint config/provider unavailable response matches taxonomy ─────
tests.push({
  name: 'Endpoint config/provider unavailable response matches taxonomy (503 + CONFIG_MISSING or PROVIDER_UNAVAILABLE)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      headers: { Authorization: 'Bearer TEST_FIXTURE_TOKEN_xyz_taxonomy_provider' },
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const verifyToken = async () => ({ ok: true, uid: 'user-t3' });
    const checkRateLimit = async () => ({ allowed: true, bucket: 'scout:live:user:user-t3' });
    // env has no LLM_PROVIDER/API_KEY/MODEL — CONFIG_MISSING is expected
    const resp = await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      },
      verifyToken,
      checkRateLimit,
    });
    assert.strictEqual(resp.status, 503);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, false);
    assert.ok(
      body.error.code === 'CONFIG_MISSING' || body.error.code === 'PROVIDER_UNAVAILABLE',
      `expected CONFIG_MISSING or PROVIDER_UNAVAILABLE, got ${body.error.code}`
    );
  },
});

// ── 14. Response never leaks raw token/API key/prompt/sourceUrl ────────────
tests.push({
  name: 'Response never leaks raw token / API key / prompt / sourceUrl',
  fn: async () => {
    const handler = await getOnRequestPost();
    const secretToken = 'TEST_FIXTURE_TOKEN_xyz_taxonomy_leak';
    const secretApiKey = 'TEST_FIXTURE_API_KEY_xyz_taxonomy_leak';
    const req = createMockRequest({
      headers: { Authorization: `Bearer ${secretToken}` },
      body: {
        excerpt: 'LEAK_PROMPT_TAX_xyz',
        sourceUrl: 'https://example.com/LEAK_URL_TAX_xyz?secret=1',
        requestedLanguage: 'ko',
        desiredTone: 'polite',
      }
    });
    const verifyToken = async () => ({ ok: true, uid: 'user-t4' });
    const checkRateLimit = async () => ({ allowed: true, bucket: 'scout:live:user:user-t4' });
    const resp = await handler({
      request: req,
      env: {
        SCOUT_SUGGEST_PROVIDER_MODE: 'live',
        SCOUT_SUGGEST_LLM_PROVIDER: 'openai',
        SCOUT_SUGGEST_LLM_API_KEY: secretApiKey,
        SCOUT_SUGGEST_MODEL: 'gpt-4',
      },
      verifyToken,
      checkRateLimit,
    });
    const bodyText = await resp.text();
    assert.ok(!bodyText.includes(secretToken), 'response body must not include raw token');
    assert.ok(!bodyText.includes(secretApiKey), 'response body must not include API key value');
    assert.ok(!bodyText.includes('LEAK_PROMPT_TAX_xyz'), 'response body must not include prompt/excerpt');
    assert.ok(!bodyText.includes('LEAK_URL_TAX_xyz'), 'response body must not include full sourceUrl');
  },
});

// ── 15. Observability throw does not change client response ────────────────
tests.push({
  name: 'Observability throw does not change client response (taxonomy response unchanged)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const throwingObserver = {
      recordBoundaryDecision() { throw new Error('TEST_FIXTURE_OBSERVER_THROWS_TAX'); },
    };
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'live' },
      observer: throwingObserver,
    });
    assert.strictEqual(resp.status, 401);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.error.code, 'AUTH_REQUIRED');
  },
});

// ── 16. Default stub remains unchanged ──────────────────────────────────────
tests.push({
  name: 'Default stub remains unchanged (providerMode: stub success response)',
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
  },
});

// ── 17. Explicit stub remains unchanged ────────────────────────────────────
tests.push({
  name: 'Explicit stub remains unchanged (providerMode: stub success response)',
  fn: async () => {
    const handler = await getOnRequestPost();
    const req = createMockRequest({
      body: { excerpt: 'Valid excerpt text', requestedLanguage: 'ko', desiredTone: 'polite' }
    });
    const resp = await handler({
      request: req,
      env: { SCOUT_SUGGEST_PROVIDER_MODE: 'stub' },
    });
    assert.strictEqual(resp.status, 200);
    const body = JSON.parse(await resp.text());
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.providerMode, 'stub');
  },
});

// ── 18. Frontend local_stub preserved ──────────────────────────────────────
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

// ── 19. Endpoint client default disabled preserved ──────────────────────────
tests.push({
  name: 'Endpoint client default disabled preserved (no boundary / observability / taxonomy wiring)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0);
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-boundary'),
      'endpoint client must not import auth/rate-limit boundary'
    );
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-observability'),
      'endpoint client must not import observability helper'
    );
    assert.ok(
      !endpointClientCode.includes('live-endpoint-error-taxonomy'),
      'endpoint client must not import error taxonomy helper'
    );
  },
});

// ── 20. No Firebase Admin SDK ───────────────────────────────────────────────
tests.push({
  name: 'No Firebase Admin SDK in any scout source file',
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
        assert.ok(!p.test(code), `${name} must not import Firebase Admin SDK`);
      }
    }
  },
});

// ── 21. No KV / Durable Object / D1 runtime access ─────────────────────────
tests.push({
  name: 'No KV / Durable Object / D1 runtime access in any scout source file',
  fn: () => {
    const files = [
      ['helper', cleanSource(helperCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['suggest', cleanSource(suggestCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
    ];
    for (const [name, code] of files) {
      assert.ok(
        !/KVNamespace|DurableObject|D1Database|env\.KV|env\.DB|env\.DO/.test(code),
        `${name} must not reference KV/DO/D1 runtime APIs`
      );
      assert.ok(
        !/platform\.|wrangler\./.test(code),
        `${name} must not reference Cloudflare platform globals`
      );
    }
  },
});

// ── 22. No provider SDK imports ─────────────────────────────────────────────
tests.push({
  name: 'No provider SDK imports in any scout source file',
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
        assert.ok(
          !requireRe.test(code) && !fromRe.test(code),
          `${name} must not import SDK "${pkg}"`
        );
      }
    }
  },
});

// ── 23. No fetch / XHR / axios ──────────────────────────────────────────────
tests.push({
  name: 'No fetch / XHR / axios in any scout source file',
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

// ── 24. Related docs updated ────────────────────────────────────────────────
tests.push({
  name: 'Related docs reflect endpoint error taxonomy contract status',
  fn: () => {
    for (const rel of RELATED_DOCS) {
      const filePath = path.join(ROOT, 'docs/product', rel);
      const content = readFileSafe(filePath);
      assert.ok(content.length > 0, `${rel} must exist`);
      const lc = content.toLowerCase();
      assert.ok(
        lc.includes('error taxonomy') || lc.includes('error-taxonomy'),
        `${rel} must mention the error taxonomy contract`
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

if (!scoutEnvGuard.shouldSkip()) {run().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});}
