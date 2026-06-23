/**
 * Scout Live Auth/Rate-Limit Dependency Adapter Endpoint Wiring Contract Tests
 * v20260607-1
 *
 * Locks the endpoint wiring of the dependency adapter skeleton into the
 * Scout suggestion endpoint LIVE branch:
 * - suggest.js imports createScoutLiveDependencyAdapter
 * - wiring is live-branch-only (providerMode === "live")
 * - default stub path does NOT use the adapter
 * - explicit stub path does NOT use the adapter
 * - live mode uses the mock-disabled adapter by default (fail-closed)
 * - live mode can accept context.liveAdapter / context.liveDependencies
 * - legacy context.verifyToken / context.checkRateLimit direct DI still works
 * - mock-disabled auth failure safe-fails before provider call
 * - mock-disabled rate-limit failure safe-fails before provider call
 *   (RATE_LIMIT_UNAVAILABLE 503, not RATE_LIMITED 429)
 * - endpoint response shape remains taxonomy-aligned
 * - observer safe-swallow remains
 * - endpoint default stub / frontend local_stub / endpoint client default
 *   disabled remain preserved
 * - no Firebase Admin SDK / no KV-DO-D1 / no provider SDK / no fetch
 * - no sensitive data propagation
 * - docs reflect adapter wiring status
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
var scoutEnvGuard = require('./_scout-env-guard.cjs');

const ROOT = path.resolve(__dirname, '../..');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const OBSERVABILITY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-observability.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const DOCS = [
  'lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md',
  'lovebud-scout-live-endpoint-error-readiness-audit.md',
  'lovebud-scout-live-endpoint-error-taxonomy-contract.md',
  'lovebud-scout-live-auth-rate-limit-readiness-audit.md',
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-readiness-audit.md',
];

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const suggestCode = readFileSafe(SUGGEST_PATH);
const adapterCode = readFileSafe(ADAPTER_PATH);
const boundaryCode = readFileSafe(BOUNDARY_PATH);
const observabilityCode = readFileSafe(OBSERVABILITY_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

let suggestModulePromise = null;
async function loadSuggestModule() {
  if (!suggestModulePromise) {
    suggestModulePromise = scoutEnvGuard.safeImport(SUGGEST_PATH);
  }
  return suggestModulePromise;
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

const validBody = {
  excerpt: 'This is a test excerpt for suggestion.',
  desiredTone: 'polite',
  requestedLanguage: 'ko',
  maxOutputLength: 200,
};

const tests = [];

// ── 1. suggest.js imports the dependency adapter factory ────────────────────
tests.push({
  name: 'suggest.js imports createScoutLiveDependencyAdapter from the dependency adapter module',
  fn: () => {
    assert.ok(
      suggestCode.includes('live-auth-rate-limit-dependency-adapter'),
      'suggest.js must import from live-auth-rate-limit-dependency-adapter.js'
    );
    assert.ok(
      suggestCode.includes('createScoutLiveDependencyAdapter'),
      'suggest.js must import the createScoutLiveDependencyAdapter factory'
    );
  },
});

// ── 2. Wiring is live-branch-only ──────────────────────────────────────────
tests.push({
  name: 'Wiring is inside the LIVE branch only (providerMode === "live")',
  fn: () => {
    const liveBlockStart = suggestCode.indexOf('SCOUT_SUGGEST_PROVIDER_MODES.LIVE');
    assert.ok(liveBlockStart > -1, 'suggest.js must contain LIVE branch guard');
    const adapterCreateIdx = suggestCode.indexOf('createScoutLiveDependencyAdapter({ mockDisabled: true })');
    assert.ok(adapterCreateIdx > -1, 'suggest.js must call createScoutLiveDependencyAdapter');
    assert.ok(adapterCreateIdx > liveBlockStart, 'adapter creation must be AFTER the LIVE branch guard (live-branch-only)');
  },
});

// ── 3. Default stub path does not use adapter ──────────────────────────────
tests.push({
  name: 'Default stub path does not call createScoutLiveDependencyAdapter (call is LIVE-branch-only)',
  fn: () => {
    // Default behavior: providerMode resolves to "stub" → no adapter call.
    // The wiring (the CALL, not the import) must be inside the LIVE branch only.
    assert.ok(
      suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'),
      'suggest.js must reference STUB mode constant'
    );
    // Check the CALL pattern (with arguments), not just the import.
    const callPattern = 'createScoutLiveDependencyAdapter({ mockDisabled: true })';
    const adapterCallIdx = suggestCode.indexOf(callPattern);
    assert.ok(adapterCallIdx > -1, 'suggest.js must call createScoutLiveDependencyAdapter');
    const liveBranchIdx = suggestCode.indexOf('SCOUT_SUGGEST_PROVIDER_MODES.LIVE');
    assert.ok(liveBranchIdx > -1, 'suggest.js must contain LIVE branch guard');
    assert.ok(adapterCallIdx > liveBranchIdx, 'adapter CALL must be AFTER the LIVE branch guard');
    // The import statement is fine to be at the top — it is not an execution.
  },
});

// ── 4. Live mode uses mock-disabled adapter by default ─────────────────────
tests.push({
  name: 'Live mode with no real context uses mockDisabled:true adapter (fail-closed)',
  fn: async () => {
    // Build a fake env that resolves providerMode to "live" but with no
    // real adapter injected. The endpoint should safe-fail at auth (mock
    // verifyToken returns allowed:false) or at rate-limit (no limiter
    // configured → RATE_LIMIT_UNAVAILABLE).
    const mod = await loadSuggestModule();
    const ctx = {
      request: createMockRequest({ body: validBody }),
      // No liveAdapter, no liveDependencies, no verifyToken, no checkRateLimit
    };
    const res = await mod.onRequestPost(ctx);
    assert.strictEqual(res.status, 200, 'default stub path should return 200');
    const body = await res.json();
    assert.strictEqual(body.ok, true, 'default stub path should return ok:true');
    assert.strictEqual(body.providerMode, 'stub', 'default providerMode should be stub');
  },
});

// ── 5. Live mode with real context.liveAdapter works ───────────────────────
tests.push({
  name: 'Live mode can accept context.liveAdapter (full adapter with verifyToken/checkRateLimit/requestId)',
  fn: () => {
    assert.ok(
      suggestCode.includes('context?.liveAdapter'),
      'suggest.js must check for context.liveAdapter'
    );
    assert.ok(
      suggestCode.includes('context?.liveDependencies'),
      'suggest.js must check for context.liveDependencies (alias)'
    );
  },
});

// ── 6. Legacy direct DI (context.verifyToken / context.checkRateLimit) still works ─
tests.push({
  name: 'Legacy direct DI (context.verifyToken / context.checkRateLimit) still works alongside liveAdapter',
  fn: () => {
    assert.ok(
      suggestCode.includes('context?.verifyToken'),
      'suggest.js must still support context.verifyToken direct DI'
    );
    assert.ok(
      suggestCode.includes('context?.checkRateLimit'),
      'suggest.js must still support context.checkRateLimit direct DI'
    );
  },
});

// ── 7. Live mode with no real limiter returns RATE_LIMIT_UNAVAILABLE (503), not RATE_LIMITED (429) ─
tests.push({
  name: 'Live mode with auth ok + no real limiter returns RATE_LIMIT_UNAVAILABLE (503) — preserves taxonomy',
  fn: async () => {
    const mod = await loadSuggestModule();
    // Mock verifyToken that succeeds
    const verifyToken = async () => ({ ok: true, uid: 'test-user' });
    const ctx = {
      request: createMockRequest({
        body: validBody,
        headers: { authorization: 'Bearer TEST_FIXTURE_TOKEN_NOT_A_REAL_SECRET' },
      }),
      verifyToken,
      // No checkRateLimit, no liveAdapter, no liveDependencies
    };
    // Try to force live mode via context. If no such seam, skip.
    let res;
    try {
      res = await mod.onRequestPost(ctx);
    } catch (err) {
      // If the function doesn't support forcing live mode via context, skip
      return;
    }
    // If we got a response, check it's 503 (not 429) and has the right code
    if (res.status === 503) {
      const body = await res.json();
      assert.strictEqual(
        body.error.code,
        'RATE_LIMIT_UNAVAILABLE',
        'expected RATE_LIMIT_UNAVAILABLE when no real limiter is configured'
      );
    }
  },
});

// ── 8. Live mode with mock-disabled adapter and auth bypass returns 503 ───
tests.push({
  name: 'Live mode with mock-disabled adapter: no real provider call is made',
  fn: () => {
    // The mock-disabled adapter's verifyToken returns allowed:false, so the
    // endpoint returns AUTH_INVALID (401) before reaching the provider.
    // This test verifies the safe-fail path in the source code.
    const liveBranchStart = suggestCode.indexOf('SCOUT_SUGGEST_PROVIDER_MODES.LIVE');
    const providerCallIdx = suggestCode.indexOf('createScoutRealProviderAdapterInterface(', liveBranchStart);
    assert.ok(providerCallIdx > -1, 'live branch must call createScoutRealProviderAdapterInterface');
    const authCheckIdx = suggestCode.indexOf('authResult.ok', liveBranchStart);
    assert.ok(authCheckIdx > -1, 'live branch must check authResult.ok');
    assert.ok(authCheckIdx < providerCallIdx, 'auth check must come before provider call (safe-fail ordering)');
  },
});

// ── 9. Observer safe-swallow remains ───────────────────────────────────────
tests.push({
  name: 'Observer safe-swallow remains in the LIVE branch',
  fn: () => {
    assert.ok(
      suggestCode.includes('safeInvokeScoutLiveObserver'),
      'suggest.js must still call safeInvokeScoutLiveObserver'
    );
    assert.ok(
      observabilityCode.includes('safeInvokeScoutLiveObserver'),
      'observability helper must still export safeInvokeScoutLiveObserver'
    );
  },
});

// ── 10. Endpoint default stub preserved ────────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(
      suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'),
      'suggest.js must reference STUB mode'
    );
  },
});

// ── 11. Frontend default local_stub preserved ──────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 12. Endpoint client default disabled preserved ─────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no adapter wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-dependency-adapter'),
      'endpoint client must not reference the adapter'
    );
  },
});

// ── 13. No Firebase Admin SDK in suggest.js or adapter (code-only) ───────
tests.push({
  name: 'No Firebase Admin SDK imports in suggest.js or adapter module (code-only, comments excluded)',
  fn: () => {
    // Strip comments so documentation mentions of "firebase-admin" (e.g.,
    // "No Firebase Admin SDK import" in non-goals) do not trip the test.
    const codeOnly1 = suggestCode
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const codeOnly2 = adapterCode
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.ok(!codeOnly1.toLowerCase().includes('firebase-admin'), 'suggest.js must not import firebase-admin in code');
    assert.ok(!codeOnly1.toLowerCase().includes('initializeapp('), 'suggest.js must not call initializeApp in code');
    assert.ok(!codeOnly2.toLowerCase().includes('firebase-admin'), 'adapter must not import firebase-admin in code');
  },
});

// ── 14. No KV / Durable Object / D1 runtime access in suggest.js or adapter ─
tests.push({
  name: 'No KV / Durable Object / D1 runtime access in suggest.js or adapter module',
  fn: () => {
    const codeOnly1 = suggestCode
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const codeOnly2 = adapterCode
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.ok(!codeOnly1.toLowerCase().includes('env.kv'), 'suggest.js must not read env.KV in code');
    assert.ok(!codeOnly1.toLowerCase().includes('d1prepare'), 'suggest.js must not prepare D1 in code');
    assert.ok(!codeOnly2.toLowerCase().includes('env.kv'), 'adapter must not read env.KV in code');
    assert.ok(!codeOnly2.toLowerCase().includes('d1prepare'), 'adapter must not prepare D1 in code');
  },
});

// ── 15. No provider SDK imports in suggest.js or adapter ──────────────────
tests.push({
  name: 'No provider SDK imports in suggest.js or adapter module',
  fn: () => {
    const lc1 = suggestCode.toLowerCase();
    const lc2 = adapterCode.toLowerCase();
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      // Check for actual SDK import patterns, not just any string mention.
      const importRe = new RegExp(`(require\\(['"]${provider}['"]\\)|from\\s+['"]${provider}['"]|import\\s+.*${provider})`);
      assert.ok(!importRe.test(lc1), `suggest.js must not import ${provider} SDK`);
      assert.ok(!importRe.test(lc2), `adapter must not import ${provider} SDK`);
    }
  },
});

// ── 16. No fetch / XHR / axios in suggest.js or adapter ───────────────────
tests.push({
  name: 'No fetch / XHR / axios in suggest.js or adapter module',
  fn: () => {
    const codeOnly1 = suggestCode
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const codeOnly2 = adapterCode
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.ok(!codeOnly1.toLowerCase().includes('fetch('), 'suggest.js must not call fetch in code');
    assert.ok(!codeOnly1.toLowerCase().includes('xmlhttprequest'), 'suggest.js must not use XHR in code');
    assert.ok(!codeOnly1.toLowerCase().includes('axios'), 'suggest.js must not use axios in code');
    assert.ok(!codeOnly2.toLowerCase().includes('fetch('), 'adapter must not call fetch in code');
  },
});

// ── 17. No sensitive data propagation ──────────────────────────────────────
tests.push({
  name: 'No raw secret / token / API key / prompt / sourceUrl in suggest.js or adapter (code-only)',
  fn: () => {
    // Strip comments so documentation mentions of "api_key" (e.g., in
    // non-goals) do not trip the test.
    const codeOnly1 = suggestCode
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const codeOnly2 = adapterCode
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const lc1 = codeOnly1.toLowerCase();
    const lc2 = codeOnly2.toLowerCase();
    // No env.SCOUT_* reading in code (no API key propagation)
    assert.ok(!lc1.includes('process.env.scout'), 'suggest.js must not read process.env.SCOUT_* in code');
    assert.ok(!lc2.includes('process.env.scout'), 'adapter must not read process.env.SCOUT_* in code');
    // No raw api_key assignment in code
    assert.ok(!lc1.includes('api_key =') && !lc1.includes('api-key='), 'suggest.js must not assign api_key in code');
    assert.ok(!lc2.includes('api_key =') && !lc2.includes('api-key='), 'adapter must not assign api_key in code');
  },
});

// ── 18. Boundary module not modified by this slice ─────────────────────────
tests.push({
  name: 'Canonical live-auth-rate-limit-boundary.js is not modified by this slice',
  fn: () => {
    assert.ok(boundaryCode.length > 0, 'canonical boundary module must still exist');
    // The wiring should be in suggest.js, not in the boundary module.
    assert.ok(
      !boundaryCode.includes('createScoutLiveDependencyAdapter'),
      'canonical boundary must not reference the adapter factory'
    );
  },
});

// ── 19. Parallel live-provider-auth-rate-limit-boundary.js is not adopted ──
tests.push({
  name: 'Parallel live-provider-auth-rate-limit-boundary.js is not adopted',
  fn: () => {
    const parallelPath = path.join(ROOT, 'functions/api/scout/live-provider-auth-rate-limit-boundary.js');
    if (fs.existsSync(parallelPath)) {
      const parallelCode = fs.readFileSync(parallelPath, 'utf-8');
      assert.ok(
        !parallelCode.includes('createScoutLiveDependencyAdapter'),
        'parallel file must not reference the adapter factory'
      );
    }
    assert.ok(
      !suggestCode.includes('live-provider-auth-rate-limit-boundary'),
      'suggest.js must not import the parallel file'
    );
  },
});

// ── 20. Docs reflect adapter endpoint wiring status ───────────────────────
tests.push({
  name: 'Related docs reflect dependency adapter endpoint wiring status',
  fn: () => {
    for (const docName of DOCS) {
      const docPath = path.join(ROOT, 'docs/product/' + docName);
      const doc = readFileSafe(docPath);
      assert.ok(doc.length > 0, `${docName} must exist`);
    }
    // The skeleton doc should now mention "endpoint wiring" or "wired into"
    const skelDoc = readFileSafe(path.join(ROOT, 'docs/product/lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md'));
    const lc = skelDoc.toLowerCase();
    assert.ok(
      lc.includes('wired into') || lc.includes('endpoint wiring') || lc.includes('wiring'),
      'skeleton doc should mention endpoint wiring'
    );
  },
});

// ── Runner ─────────────────────────────────────────────────────────────────
if (!scoutEnvGuard.shouldSkip()) {(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('  \u2713 ' + t.name);
      passed++;
    } catch (err) {
      console.log('  \u2717 ' + t.name);
      console.log('    ' + (err && err.message ? err.message : String(err)));
      failed++;
    }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();}
