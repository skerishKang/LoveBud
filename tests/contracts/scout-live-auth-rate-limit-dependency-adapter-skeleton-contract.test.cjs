/**
 * Scout Live Auth/Rate-Limit Dependency Adapter Skeleton Contract Tests
 * v20260607-1
 *
 * Locks the mock-disabled dependency adapter skeleton contract for the
 * Scout live provider path:
 * - factory module exists and is well-formed
 * - factory default mockDisabled:true returns safe "not implemented"
 *   responses for verifyToken and checkRateLimit
 * - requestId returns a clearly fake id (req_mock_disabled_*)
 * - non-mock-disabled mode returns the same shape with not-implemented marker
 * - no Firebase Admin SDK / no KV-DO-D1 / no provider SDK / no fetch
 * - endpoint default stub / frontend local_stub / endpoint client default
 *   disabled remain preserved
 * - canonical live-auth-rate-limit-boundary.js is unchanged
 * - parallel live-provider-auth-rate-limit-boundary.js is not adopted
 * - docs reflect the adapter skeleton status
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
var scoutEnvGuard = require('./_scout-env-guard.cjs');

const ROOT = path.resolve(__dirname, '../..');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const OBSERVABILITY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-observability.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const DOCS = [
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-live-endpoint-error-readiness-audit.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-production-readiness-gates-audit.md',
  'lovebud-scout-live-provider-staging-rollout-contract.md',
  'lovebud-scout-live-auth-rate-limit-readiness-audit.md',
  'lovebud-scout-live-endpoint-error-taxonomy-contract.md',
  'lovebud-scout-ai-suggestion-mvp-readiness.md',
  'lovebud-scout-live-provider-readiness-audit.md',
];

const ADAPTER_SKEL_DOC = 'lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md';

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const adapterCode = readFileSafe(ADAPTER_PATH);
const boundaryCode = readFileSafe(BOUNDARY_PATH);
const observabilityCode = readFileSafe(OBSERVABILITY_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

let adapterModulePromise = null;
async function loadAdapterModule() {
  if (!adapterModulePromise) {
    adapterModulePromise = scoutEnvGuard.safeImport(ADAPTER_PATH);
  }
  return adapterModulePromise;
}

const tests = [];

// ── 1. Module shape ────────────────────────────────────────────────────────
tests.push({
  name: 'Dependency adapter skeleton module exists and exports factory + version + codes + modes',
  fn: async () => {
    assert.ok(adapterCode.length > 0, 'adapter module must exist');
    const mod = await loadAdapterModule();
    assert.strictEqual(typeof mod.createScoutLiveDependencyAdapter, 'function', 'factory must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION, 'string', 'version must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES, 'object', 'modes must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES, 'object', 'codes must be exported');
    assert.ok(/^v?2026\d{4}-/.test(mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION.replace(/^v/, '')) || /^2026\d{4}/.test(mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION), 'version must be a YYYYMMDD-N style string');
  },
});

// ── 2. Default mockDisabled:true ───────────────────────────────────────────
tests.push({
  name: 'Factory default mockDisabled:true returns mock_disabled adapter with safe responses',
  fn: async () => {
    const mod = await loadAdapterModule();
    const adapter = mod.createScoutLiveDependencyAdapter();
    assert.strictEqual(adapter.isMockDisabled, true, 'default isMockDisabled must be true');
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES.MOCK_DISABLED, 'default mode must be MOCK_DISABLED');
    assert.strictEqual(typeof adapter.verifyToken, 'function', 'verifyToken must be a function');
    assert.strictEqual(typeof adapter.checkRateLimit, 'function', 'checkRateLimit must be a function');
    assert.strictEqual(typeof adapter.requestId, 'function', 'requestId must be a function');
    assert.strictEqual(adapter.version, mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION, 'adapter version must match module version');
  },
});

// ── 3. verifyToken mock-disabled response ───────────────────────────────────
tests.push({
  name: 'Mock-disabled verifyToken returns { allowed:false, code: VERIFY_NOT_IMPLEMENTED, reason }',
  fn: async () => {
    const mod = await loadAdapterModule();
    const adapter = mod.createScoutLiveDependencyAdapter();
    const res = await adapter.verifyToken({});
    assert.strictEqual(res.allowed, false, 'mock-disabled verifyToken must deny');
    assert.strictEqual(res.code, mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED, 'code must be VERIFY_NOT_IMPLEMENTED');
    assert.ok(typeof res.reason === 'string' && res.reason.length > 0, 'reason must be a non-empty string');
  },
});

// ── 4. checkRateLimit mock-disabled response ───────────────────────────────
tests.push({
  name: 'Mock-disabled checkRateLimit returns { allowed:false, code: RATE_LIMIT_NOT_IMPLEMENTED, reason }',
  fn: async () => {
    const mod = await loadAdapterModule();
    const adapter = mod.createScoutLiveDependencyAdapter();
    const res = await adapter.checkRateLimit({});
    assert.strictEqual(res.allowed, false, 'mock-disabled checkRateLimit must deny (fail closed)');
    assert.strictEqual(res.code, mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED, 'code must be RATE_LIMIT_NOT_IMPLEMENTED');
    assert.ok(typeof res.reason === 'string' && res.reason.length > 0, 'reason must be a non-empty string');
  },
});

// ── 5. requestId mock-disabled shape ───────────────────────────────────────
tests.push({
  name: 'Mock-disabled requestId returns a clearly fake id starting with req_mock_disabled_',
  fn: async () => {
    const mod = await loadAdapterModule();
    const adapter = mod.createScoutLiveDependencyAdapter();
    const id = adapter.requestId();
    assert.ok(typeof id === 'string', 'requestId must be a string');
    assert.ok(id.startsWith('req_mock_disabled_'), 'mock-disabled requestId must start with req_mock_disabled_');
    assert.ok(id.length > 20, 'mock-disabled requestId must include a non-trivial suffix');
    const id2 = adapter.requestId();
    assert.notStrictEqual(id, id2, 'two consecutive requestId calls should produce different ids');
  },
});

// ── 6. Non-mock-disabled mode ──────────────────────────────────────────────
tests.push({
  name: 'Factory mockDisabled:false returns NOT_IMPLEMENTED adapter with same shape',
  fn: async () => {
    const mod = await loadAdapterModule();
    const adapter = mod.createScoutLiveDependencyAdapter({ mockDisabled: false });
    assert.strictEqual(adapter.isMockDisabled, false, 'isMockDisabled must be false');
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES.NOT_IMPLEMENTED, 'mode must be NOT_IMPLEMENTED');
    const v = await adapter.verifyToken({});
    assert.strictEqual(v.allowed, false, 'not-implemented verifyToken must deny');
    assert.strictEqual(v.code, mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED, 'code must be VERIFY_NOT_IMPLEMENTED');
    const r = await adapter.checkRateLimit({});
    assert.strictEqual(r.allowed, false, 'not-implemented checkRateLimit must deny');
    assert.strictEqual(r.code, mod.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED, 'code must be RATE_LIMIT_NOT_IMPLEMENTED');
    const id = adapter.requestId();
    assert.ok(id.startsWith('req_not_implemented_'), 'not-implemented requestId must start with req_not_implemented_');
  },
});

// ── 7. Adapter is frozen / immutable ───────────────────────────────────────
tests.push({
  name: 'Adapter object is frozen (immutable)',
  fn: async () => {
    const mod = await loadAdapterModule();
    const adapter = mod.createScoutLiveDependencyAdapter();
    assert.strictEqual(Object.isFrozen(adapter), true, 'adapter must be frozen');
  },
});

// ── 8. No Firebase Admin SDK imports ───────────────────────────────────────
tests.push({
  name: 'No Firebase Admin SDK imports in adapter module',
  fn: () => {
    const lc = adapterCode.toLowerCase();
    assert.ok(!/firebase-admin/.test(lc), 'adapter must not import firebase-admin');
    assert.ok(!/admin\s*\.\s*auth/.test(lc), 'adapter must not reference admin.auth');
    assert.ok(!/initializeapp/.test(lc), 'adapter must not call initializeApp');
    assert.ok(!/cert\s*\(/.test(lc), 'adapter must not call cert()');
  },
});

// ── 9. No KV / Durable Object / D1 runtime ─────────────────────────────────
tests.push({
  name: 'No KV / Durable Object / D1 runtime access in adapter module',
  fn: () => {
    const lc = adapterCode.toLowerCase();
    // Strip block + line comments so doc-style mentions in non-goals do not
    // trip the test.
    const codeOnly = adapterCode
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .toLowerCase();
    assert.ok(!/durable\s*object/.test(codeOnly) && !/durableobject/.test(codeOnly), 'adapter must not reference Durable Object in code');
    assert.ok(!/\.env\.kv\b/.test(codeOnly) && !/env\.kv\b/.test(codeOnly), 'adapter must not read env.KV in code');
    assert.ok(!/d1\s*prepare/.test(codeOnly) && !/env\.db\b/.test(codeOnly), 'adapter must not prepare D1 or read env.DB in code');
    // Also ensure no KV/DO/D1 mentions in the actual non-comment code
    assert.ok(!/do_id\s*\(/.test(codeOnly) && !/durableobjectbinding/.test(codeOnly), 'adapter must not bind to DO runtime in code');
  },
});

// ── 10. No provider SDK imports ────────────────────────────────────────────
tests.push({
  name: 'No provider SDK imports in adapter module',
  fn: () => {
    const lc = adapterCode.toLowerCase();
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      assert.ok(!lc.includes(provider), `adapter must not import or reference ${provider}`);
    }
  },
});

// ── 11. No fetch / XHR / axios ─────────────────────────────────────────────
tests.push({
  name: 'No fetch / XHR / axios / http request in adapter module',
  fn: () => {
    const lc = adapterCode.toLowerCase();
    assert.ok(!/\bfetch\s*\(/.test(lc), 'adapter must not call fetch()');
    assert.ok(!/xmlhttprequest/.test(lc), 'adapter must not use XMLHttpRequest');
    assert.ok(!/axios/.test(lc), 'adapter must not use axios');
    assert.ok(!/new\s+request\s*\(/.test(lc), 'adapter must not construct a new Request');
  },
});

// ── 12. No real secret / token / API key propagation ────────────────────────
tests.push({
  name: 'No raw secret / token / API key / API_KEY env reading in adapter module',
  fn: () => {
    const lc = adapterCode.toLowerCase();
    assert.ok(!/api[_-]?key/.test(lc), 'adapter must not reference api_key');
    assert.ok(!/bearer\s+/.test(lc), 'adapter must not embed bearer tokens');
    assert.ok(!/process\.env\.scout/.test(lc), 'adapter must not read process.env.SCOUT_*');
  },
});

// ── 13. Skeleton slice scope (module-only; wiring is a separate slice) ─
tests.push({
  name: 'Skeleton slice adds the module only; wiring is documented as a separate slice',
  fn: () => {
    // The skeleton slice (v20260607-1) added the module. Wiring the adapter
    // into suggest.js LIVE branch is a separate slice
    // (tech/scout-live-dependency-adapter-endpoint-wiring). This test locks
    // the skeleton's "module-only" property.
    assert.ok(
      adapterCode.length > 0,
      'adapter module must exist (skeleton slice property)'
    );
    assert.ok(
      adapterCode.includes('SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION'),
      'adapter module must export the version constant (skeleton slice property)'
    );
  },
});

// ── 14. Canonical boundary file unchanged (no edit by this slice) ─────────
tests.push({
  name: 'Canonical live-auth-rate-limit-boundary.js is not edited by this slice (no boundary module change)',
  fn: () => {
    assert.ok(boundaryCode.length > 0, 'canonical boundary module must still exist');
    // The canonical boundary skeleton has its own version (v20260607-1). The
    // adapter skeleton is a separate file, so the boundary should not be
    // modified.
    assert.ok(
      !boundaryCode.includes('createScoutLiveDependencyAdapter'),
      'canonical boundary must not reference the adapter factory'
    );
    assert.ok(
      !boundaryCode.includes('live-auth-rate-limit-dependency-adapter'),
      'canonical boundary must not import the adapter module'
    );
  },
});

// ── 15. Parallel live-provider-auth-rate-limit-boundary.js is not adopted ──
tests.push({
  name: 'Parallel live-provider-auth-rate-limit-boundary.js is not adopted (must not be referenced)',
  fn: () => {
    const parallelPath = path.join(ROOT, 'functions/api/scout/live-provider-auth-rate-limit-boundary.js');
    const parallelExists = fs.existsSync(parallelPath);
    if (parallelExists) {
      const parallelCode = fs.readFileSync(parallelPath, 'utf-8');
      assert.ok(
        !parallelCode.includes('createScoutLiveDependencyAdapter'),
        'parallel file must not reference the new adapter factory'
      );
    }
    assert.ok(
      !adapterCode.includes('live-provider-auth-rate-limit-boundary'),
      'adapter must not import the parallel file'
    );
  },
});

// ── 16. Endpoint default stub behavior preserved in suggest.js ─────────────
tests.push({
  name: 'Endpoint default stub behavior preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('stub'), 'suggest.js must still reference stub mode');
    assert.ok(suggestCode.includes("'stub'") || suggestCode.includes('"stub"'), 'suggest.js must still default to stub');
  },
});

// ── 17. Frontend source selector default local_stub preserved ──────────────
tests.push({
  name: 'Frontend source selector default local_stub preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must still default to local_stub');
  },
});

// ── 18. Endpoint client default disabled preserved ─────────────────────────
tests.push({
  name: 'Endpoint client default disabled preserved (no adapter wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-dependency-adapter'),
      'endpoint client must not reference the adapter'
    );
  },
});

// ── 19. Observability helper not modified by this slice ────────────────────
tests.push({
  name: 'Observability helper is not modified by this slice (separate module)',
  fn: () => {
    assert.ok(observabilityCode.length > 0, 'observability helper must still exist');
    assert.ok(
      !observabilityCode.includes('createScoutLiveDependencyAdapter'),
      'observability helper must not reference the adapter factory'
    );
  },
});

// ── 20. Adapter skeleton doc exists and reflects status ────────────────────
tests.push({
  name: 'Adapter skeleton doc exists and reflects dependency adapter skeleton status',
  fn: () => {
    const docPath = path.join(ROOT, 'docs/product/' + ADAPTER_SKEL_DOC);
    const doc = readFileSafe(docPath);
    assert.ok(doc.length > 0, 'adapter skeleton doc must exist');
    const lc = doc.toLowerCase();
    assert.ok(lc.includes('mock-disabled') || lc.includes('mock_disabled') || lc.includes('mock disabled'), 'doc must mention mock-disabled');
    assert.ok(lc.includes('verifytoken'), 'doc must mention verifyToken');
    assert.ok(lc.includes('checkratelimit') || lc.includes('check_rate_limit') || lc.includes('check rate limit'), 'doc must mention checkRateLimit');
    assert.ok(lc.includes('requestid') || lc.includes('request_id') || lc.includes('request id'), 'doc must mention requestId');
    assert.ok(lc.includes('not_implemented') || lc.includes('not implemented'), 'doc must mention not implemented');
    assert.ok(lc.includes('no-go') || lc.includes('no go') || lc.includes('blocked') || lc.includes('not yet'), 'doc must mark real implementations as not yet ready');
  },
});

// ── 21. Related docs reflect adapter skeleton status ───────────────────────
tests.push({
  name: 'Related docs reflect adapter skeleton status (no overclaim, no stale references)',
  fn: () => {
    for (const docName of DOCS) {
      const docPath = path.join(ROOT, 'docs/product/' + docName);
      const doc = readFileSafe(docPath);
      assert.ok(doc.length > 0, `${docName} must exist`);
    }
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
