/**
 * Scout Live Auth/Rate-Limit Runtime Boundary Contract Tests
 * v20260607-1
 *
 * Contract tests verifying the Scout live provider auth/rate-limit runtime
 * boundary skeleton:
 * - boundary file exists with expected exports
 * - missing Authorization header maps AUTH_REQUIRED
 * - malformed Authorization header maps AUTH_INVALID
 * - injected mock verifier can authenticate a user
 * - injected verifier is NOT called without Authorization header
 * - raw token never appears in auth result
 * - verifier throw maps AUTH_INVALID
 * - missing limiter maps RATE_LIMIT_UNAVAILABLE
 * - rate-limit is not checked if auth failed
 * - injected mock limiter can allow request
 * - injected mock limiter can rate-limit request
 * - limiter throw maps RATE_LIMIT_UNAVAILABLE
 * - raw token / API key / prompt / full sourceUrl are not passed to limiter
 * - no Firebase Admin SDK / no KV-DO-D1 / no provider SDK
 * - no fetch / XHR / axios in boundary / adapter / suggest
 * - endpoint default stub preserved
 * - frontend default local_stub preserved
 * - no persistence / no auto-save
 * - docs updated
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
var scoutEnvGuard = require('./_scout-env-guard.cjs');

const ROOT = path.resolve(__dirname, '../..');
const BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/provider-specific-adapter.js');
const LIVE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');
const BOUNDARY_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-auth-rate-limit-boundary.md');
const AUDIT_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-production-readiness-gates-audit.md');

const RELATED_DOCS = [
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-live-provider-production-readiness-gates-audit.md',
  'lovebud-scout-live-provider-staging-rollout-contract.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-provider-secret-config-deployment-checklist.md',
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

const boundaryCode = readFileSafe(BOUNDARY_PATH);
const adapterCode = readFileSafe(ADAPTER_PATH);
const liveAdapterCode = readFileSafe(LIVE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);
const boundaryDoc = readFileSafe(BOUNDARY_DOC_PATH);
const auditDoc = readFileSafe(AUDIT_DOC_PATH);

async function importBoundary() {
  return await scoutEnvGuard.safeImport(BOUNDARY_PATH);
}

let _boundaryMod = null;
async function getBoundaryMod() {
  if (!_boundaryMod) _boundaryMod = await importBoundary();
  return _boundaryMod;
}

const _noopForwards = {
  verifyScoutLiveAuthBoundary: null,
  checkScoutLiveRateLimitBoundary: null,
};

function cleanSource(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const tests = [];

// ── 1. Boundary file exists ──────────────────────────────────────────────────
tests.push({
  name: 'Auth/rate-limit runtime boundary file exists',
  fn: async () => {
    assert.ok(
      fs.existsSync(BOUNDARY_PATH),
      'live-auth-rate-limit-boundary.js must exist'
    );
    assert.ok(boundaryCode.length > 0, 'boundary file must not be empty');
  },
});

// ── 2. Expected exports exist ────────────────────────────────────────────────
tests.push({
  name: 'Boundary exports expected constants and functions',
  fn: async () => {
    const mod = await importBoundary();
    assert.ok(
      mod.SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS,
      'SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS must be exported'
    );
    assert.ok(
      mod.SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES,
      'SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES must be exported'
    );
    assert.strictEqual(typeof mod.createScoutLiveAuthBoundary, 'function');
    assert.strictEqual(typeof mod.createScoutLiveRateLimitBoundary, 'function');
    assert.strictEqual(typeof mod.verifyScoutLiveAuthBoundary, 'function');
    assert.strictEqual(typeof mod.checkScoutLiveRateLimitBoundary, 'function');
  },
});

// ── 3. Status constants match spec ───────────────────────────────────────────
tests.push({
  name: 'Auth/rate-limit status values match spec',
  fn: async () => {
    const mod = await importBoundary();
    const s = mod.SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS;
    assert.strictEqual(s.AUTHENTICATED, 'authenticated');
    assert.strictEqual(s.AUTH_REQUIRED, 'auth_required');
    assert.strictEqual(s.AUTH_INVALID, 'auth_invalid');
    assert.strictEqual(s.RATE_LIMIT_ALLOWED, 'rate_limit_allowed');
    assert.strictEqual(s.RATE_LIMITED, 'rate_limited');
    assert.strictEqual(s.RATE_LIMIT_UNAVAILABLE, 'rate_limit_unavailable');
  },
});

// ── 4. Error codes match spec ────────────────────────────────────────────────
tests.push({
  name: 'Auth/rate-limit error codes match spec',
  fn: async () => {
    const mod = await importBoundary();
    const e = mod.SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES;
    assert.strictEqual(e.AUTH_REQUIRED, 'AUTH_REQUIRED');
    assert.strictEqual(e.AUTH_INVALID, 'AUTH_INVALID');
    assert.strictEqual(e.RATE_LIMITED, 'RATE_LIMITED');
    assert.strictEqual(e.RATE_LIMIT_UNAVAILABLE, 'RATE_LIMIT_UNAVAILABLE');
  },
});

// ── 5. Missing Authorization header → AUTH_REQUIRED ──────────────────────────
tests.push({
  name: 'Missing Authorization header maps AUTH_REQUIRED',
  fn: async () => {
    const mod = await getBoundaryMod();
    const result = await mod.verifyScoutLiveAuthBoundary({}, {});
    assert.strictEqual(result.status, 'auth_required');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.userKey, 'anon');
    assert.strictEqual(result.error.code, 'AUTH_REQUIRED');
  },
});

// ── 6. Malformed Authorization header → AUTH_INVALID ─────────────────────────
tests.push({
  name: 'Malformed (non-Bearer) Authorization header maps AUTH_INVALID',
  fn: async () => {
    const mod = await getBoundaryMod();
    const result = await mod.verifyScoutLiveAuthBoundary({ headers: { authorization: 'Basic abc' } }, {});
    assert.strictEqual(result.status, 'auth_invalid');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.userKey, 'anon');
    assert.strictEqual(result.error.code, 'AUTH_INVALID');
  },
});

tests.push({
  name: 'Bearer with blank token maps AUTH_INVALID',
  fn: async () => {
    const mod = await getBoundaryMod();
    const result = await mod.verifyScoutLiveAuthBoundary({ headers: { authorization: 'Bearer   ' } }, {});
    assert.strictEqual(result.status, 'auth_invalid');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'AUTH_INVALID');
  },
});

// ── 7. Injected mock verifier can authenticate a user ────────────────────────
tests.push({
  name: 'Injected mock verifier can authenticate a mock user',
  fn: async () => {
    const mod = await getBoundaryMod();
    // Issue #2571: by default the boundary calls the verifier with a
    // safe payload (derived fields only, no idToken). The mock seam
    // now receives a payload object instead of a raw token string.
    const mockVerify = async (payload) => {
      assert.strictEqual(typeof payload, 'object');
      assert.ok(payload !== null);
      // Default path must NOT include idToken.
      assert.strictEqual(
        Object.prototype.hasOwnProperty.call(payload, 'idToken'),
        false,
        'default boundary must not include idToken in verifier payload'
      );
      // authorizationScheme is always 'Bearer' when we reach this point.
      assert.strictEqual(payload.authorizationScheme, 'Bearer');
      return { ok: true, uid: 'mock-user-abc' };
    };
    const result = await mod.verifyScoutLiveAuthBoundary(
      { headers: { authorization: 'Bearer mock-token-123' } },
      { verifyToken: mockVerify }
    );
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.status, 'authenticated');
    assert.strictEqual(result.userKey, 'mock-user-abc');
    assert.strictEqual(result.error, null);
  },
});

// ── 8. Verifier is NOT called without Authorization header ──────────────────
tests.push({
  name: 'Injected verifier is not called when Authorization header is missing',
  fn: async () => {
    const mod = await getBoundaryMod();
    let called = false;
    const mockVerify = async () => { called = true; return { ok: true, uid: 'u' }; };
    const result = await mod.verifyScoutLiveAuthBoundary({}, { verifyToken: mockVerify });
    assert.strictEqual(called, false, 'verifier must not be called without auth header');
    assert.strictEqual(result.status, 'auth_required');
  },
});

// ── 9. Raw token never appears in auth result ────────────────────────────────
tests.push({
  name: 'Raw token value never appears in auth result JSON',
  fn: async () => {
    const mod = await getBoundaryMod();
    const secret = 'super-secret-token-xyz-987';
    const result = await mod.verifyScoutLiveAuthBoundary(
      { headers: { authorization: `Bearer ${secret}` } },
      {
        verifyToken: async () => ({ ok: true, uid: 'u' }),
      }
    );
    const serialized = JSON.stringify(result);
    assert.ok(
      !serialized.includes(secret),
      `auth result must not contain raw token. Got: ${serialized}`
    );
  },
});

tests.push({
  name: 'Raw token not in auth result even on AUTH_INVALID',
  fn: async () => {
    const mod = await getBoundaryMod();
    const secret = 'leaky-token-payload-12345';
    const result = await mod.verifyScoutLiveAuthBoundary(
      { headers: { authorization: `Bearer ${secret}` } },
      {}
    );
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes(secret), 'auth result must not contain raw token on invalid');
    assert.strictEqual(result.status, 'auth_invalid');
  },
});

// ── 10. Verifier throw maps AUTH_INVALID ─────────────────────────────────────
tests.push({
  name: 'Verifier throw maps AUTH_INVALID safe result',
  fn: async () => {
    const mod = await getBoundaryMod();
    const result = await mod.verifyScoutLiveAuthBoundary(
      { headers: { authorization: 'Bearer good' } },
      { verifyToken: async () => { throw new Error('verifier blew up'); } }
    );
    assert.strictEqual(result.status, 'auth_invalid');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'AUTH_INVALID');
  },
});

// ── 11. Rate-limit without limiter maps RATE_LIMIT_UNAVAILABLE ───────────────
tests.push({
  name: 'Rate-limit without injected limiter maps RATE_LIMIT_UNAVAILABLE',
  fn: async () => {
    const mod = await getBoundaryMod();
    const authOk = { ok: true, userKey: 'u-1' };
    const result = await mod.checkScoutLiveRateLimitBoundary({ providerMode: 'live' }, authOk, {});
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 'rate_limit_unavailable');
    assert.strictEqual(result.error.code, 'RATE_LIMIT_UNAVAILABLE');
  },
});

// ── 12. Rate-limit is not checked if auth failed ─────────────────────────────
tests.push({
  name: 'Limiter is not called when auth did not succeed',
  fn: async () => {
    const mod = await getBoundaryMod();
    let called = false;
    const mockLimit = async () => { called = true; return { allowed: true }; };
    const result = await mod.checkScoutLiveRateLimitBoundary(
      { providerMode: 'live' },
      { ok: false, userKey: 'anon' },
      { checkRateLimit: mockLimit }
    );
    assert.strictEqual(called, false, 'limiter must not be called when auth failed');
    assert.strictEqual(result.status, 'rate_limit_unavailable');
  },
});

// ── 13. Injected mock limiter can allow request ─────────────────────────────
tests.push({
  name: 'Injected mock limiter can allow a request',
  fn: async () => {
    const mod = await getBoundaryMod();
    const mockLimit = async (payload) => {
      assert.strictEqual(payload.userKey, 'u-2');
      return { allowed: true, bucket: 'scout:live:user:u-2' };
    };
    const result = await mod.checkScoutLiveRateLimitBoundary(
      { providerMode: 'live' },
      { ok: true, userKey: 'u-2' },
      { checkRateLimit: mockLimit }
    );
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.status, 'rate_limit_allowed');
    assert.strictEqual(result.quotaBucket, 'scout:live:user:u-2');
  },
});

// ── 14. Injected mock limiter can rate-limit request ────────────────────────
tests.push({
  name: 'Injected mock limiter can rate-limit a request',
  fn: async () => {
    const mod = await getBoundaryMod();
    const mockLimit = async () => ({ allowed: false, retryAfterSeconds: 30 });
    const result = await mod.checkScoutLiveRateLimitBoundary(
      { providerMode: 'live' },
      { ok: true, userKey: 'u-3' },
      { checkRateLimit: mockLimit }
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 'rate_limited');
    assert.strictEqual(result.retryAfterSeconds, 30);
    assert.strictEqual(result.error.code, 'RATE_LIMITED');
  },
});

// ── 15. Limiter throw maps RATE_LIMIT_UNAVAILABLE ────────────────────────────
tests.push({
  name: 'Limiter throw maps RATE_LIMIT_UNAVAILABLE safe result',
  fn: async () => {
    const mod = await getBoundaryMod();
    const result = await mod.checkScoutLiveRateLimitBoundary(
      { providerMode: 'live' },
      { ok: true, userKey: 'u-4' },
      { checkRateLimit: async () => { throw new Error('KV unavailable'); } }
    );
    assert.strictEqual(result.status, 'rate_limit_unavailable');
    assert.strictEqual(result.error.code, 'RATE_LIMIT_UNAVAILABLE');
  },
});

// ── 16. Sensitive fields not propagated to limiter payload ───────────────────
tests.push({
  name: 'Limiter payload never contains raw token / API key / prompt / sourceUrl',
  fn: async () => {
    const mod = await getBoundaryMod();
    let captured = null;
    const mockLimit = async (payload) => { captured = payload; return { allowed: true }; };
    await mod.checkScoutLiveRateLimitBoundary(
      {
        providerMode: 'live',
        rawToken: 'leak-token-1',
        apiKey: 'leak-key-1',
        prompt: 'leak-prompt-1',
        sourceUrl: 'https://example.com/leak-source-url-1',
        excerpt: 'leak-excerpt-1',
      },
      { ok: true, userKey: 'u-5' },
      { checkRateLimit: mockLimit }
    );
    const serialized = JSON.stringify(captured);
    assert.ok(!serialized.includes('leak-token-1'), 'limiter payload must not contain raw token');
    assert.ok(!serialized.includes('leak-key-1'), 'limiter payload must not contain API key');
    assert.ok(!serialized.includes('leak-prompt-1'), 'limiter payload must not contain prompt');
    assert.ok(!serialized.includes('leak-source-url-1'), 'limiter payload must not contain full sourceUrl');
    assert.ok(!serialized.includes('leak-excerpt-1'), 'limiter payload must not contain excerpt');
    assert.strictEqual(captured.userKey, 'u-5');
  },
});

// ── 17. No Firebase Admin SDK import ─────────────────────────────────────────
tests.push({
  name: 'No Firebase Admin SDK import in boundary / adapter / suggest',
  fn: () => {
    const files = [
      ['boundary', cleanSource(boundaryCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
      ['suggest', cleanSource(suggestCode)],
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

// ── 18. No KV / Durable Object / D1 runtime import/call ─────────────────────
tests.push({
  name: 'No KV / Durable Object / D1 runtime import in boundary',
  fn: () => {
    const clean = cleanSource(boundaryCode);
    assert.ok(
      !/KVNamespace|DurableObject|D1Database|env\.KV|env\.DB|env\.DO/.test(clean),
      'boundary must not reference KV / Durable Object / D1 runtime APIs'
    );
    assert.ok(
      !/platform\.|wrangler\./.test(clean),
      'boundary must not reference Cloudflare platform globals'
    );
  },
});

// ── 19. No provider SDK imports ──────────────────────────────────────────────
tests.push({
  name: 'No provider SDK imports in boundary / adapter / suggest',
  fn: () => {
    const forbidden = [
      'openai', '@anthropic-ai/sdk', '@google/generative-ai', 'groq-sdk',
      '@mistralai/mistralai', 'nvidia-modulus', 'grok-client',
    ];
    const files = [
      ['boundary', cleanSource(boundaryCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
      ['suggest', cleanSource(suggestCode)],
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

// ── 20. No fetch / XHR / axios ───────────────────────────────────────────────
tests.push({
  name: 'No fetch / XHR / axios in boundary / adapter / suggest',
  fn: () => {
    const files = [
      ['boundary', cleanSource(boundaryCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
      ['suggest', cleanSource(suggestCode)],
    ];
    for (const [name, code] of files) {
      assert.ok(
        !/\bfetch\s*\(/.test(code),
        `${name} must not use fetch(`
      );
      assert.ok(
        !/XMLHttpRequest/.test(code),
        `${name} must not use XMLHttpRequest`
      );
      assert.ok(
        !/axios/.test(code),
        `${name} must not use axios`
      );
    }
  },
});

// ── 21. Endpoint default stub preserved ──────────────────────────────────────
tests.push({
  name: 'suggest.js default deterministic stub behavior preserved',
  fn: async () => {
    assert.ok(suggestCode.length > 0, 'suggest.js must exist');
    assert.ok(
      suggestCode.includes('providerMode') && (suggestCode.includes('"stub"') || suggestCode.includes("'stub'")),
      'suggest.js must keep default providerMode:"stub"'
    );
    // Boundary is now wired into suggest.js
    assert.ok(
      suggestCode.includes('live-auth-rate-limit-boundary'),
      'suggest.js must import live-auth-rate-limit-boundary.js'
    );
    assert.ok(
      suggestCode.includes('verifyScoutLiveAuthBoundary'),
      'suggest.js must import verifyScoutLiveAuthBoundary'
    );
  },
});

// ── 22. Frontend default local_stub preserved ────────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub preserved',
  fn: async () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(
      srcSelCode.includes('local_stub'),
      'source selector must keep local_stub default'
    );
  },
});

tests.push({
  name: 'Endpoint client default behavior preserved',
  fn: async () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    // The endpoint client should not import the new runtime boundary skeleton
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-boundary'),
      'endpoint client must not import live-auth-rate-limit-boundary.js (slice scope)'
    );
  },
});

// ── 23. No persistence / auto-save ───────────────────────────────────────────
tests.push({
  name: 'No localStorage / sessionStorage / auto-save in boundary / adapter / suggest',
  fn: () => {
    const files = [
      ['boundary', cleanSource(boundaryCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
      ['suggest', cleanSource(suggestCode)],
    ];
    for (const [name, code] of files) {
      assert.ok(
        !/localStorage/.test(code),
        `${name} must not call localStorage`
      );
      assert.ok(
        !/sessionStorage/.test(code),
        `${name} must not call sessionStorage`
      );
      assert.ok(
        !/indexedDB/.test(code),
        `${name} must not call indexedDB`
      );
      assert.ok(
        !/addMemoryFromForm/.test(code),
        `${name} must not call addMemoryFromForm`
      );
    }
  },
});

// ── 24. Boundary doc updated ─────────────────────────────────────────────────
tests.push({
  name: 'Auth/rate-limit boundary document reflects runtime boundary skeleton status',
  fn: async () => {
    assert.ok(boundaryDoc.length > 0, 'boundary doc must exist');
    const d = boundaryDoc.toLowerCase();
    assert.ok(
      d.includes('runtime boundary skeleton') || d.includes('auth/rate-limit runtime boundary'),
      'boundary doc must mention runtime boundary skeleton'
    );
    assert.ok(
      d.includes('dependency injection') || d.includes('di seam') || d.includes('injected'),
      'boundary doc must mention DI seam / dependency injection'
    );
  },
});

// ── 25. Audit / related docs updated ─────────────────────────────────────────
tests.push({
  name: 'Related docs reflect runtime boundary skeleton status',
  fn: async () => {
    for (const rel of RELATED_DOCS) {
      const filePath = path.join(ROOT, 'docs/product', rel);
      const content = readFileSafe(filePath);
      if (content.length === 0) continue; // skip missing optional docs
      const lc = content.toLowerCase();
      const hasMention =
        lc.includes('runtime boundary skeleton') ||
        lc.includes('auth/rate-limit runtime boundary') ||
        lc.includes('live-auth-rate-limit-boundary');
      if (rel === 'lovebud-scout-live-provider-auth-rate-limit-boundary.md' ||
          rel === 'lovebud-scout-live-provider-production-readiness-gates-audit.md') {
        assert.ok(
          hasMention,
          `${rel} should mention runtime boundary skeleton / live-auth-rate-limit-boundary`
        );
      }
    }
    // audit doc must mention live-auth-rate-limit-boundary explicitly
    assert.ok(
      auditDoc.toLowerCase().includes('live-auth-rate-limit-boundary') ||
      auditDoc.toLowerCase().includes('auth/rate-limit runtime boundary'),
      'audit doc should reference live-auth-rate-limit-boundary'
    );
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
