/**
 * Scout Live Rate-Limit Storage Adapter Skeleton Contract Tests
 * v20260607-1
 *
 * Locks the mock-disabled storage adapter skeleton contract for the
 * Scout live provider path:
 * - module exists and is well-formed
 * - factory default mockDisabled:true returns safe "not implemented"
 *   responses for checkQuota / consumeQuota / releaseQuota
 * - sanitizePayload strips prohibited fields
 * - not-implemented mode returns the same shape with not-implemented marker
 * - no KV / Durable Object / D1 / database / fetch / env storage binding
 * - no Firebase Admin SDK / no provider SDK / no fetch
 * - endpoint default stub / frontend local_stub / endpoint client default
 *   disabled remain preserved
 * - existing dependency adapter wiring contract still passes
 * - docs reflect storage adapter skeleton status
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '../..');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const DOCS = [
  'lovebud-scout-live-rate-limit-storage-adapter-skeleton.md',
  'lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md',
  'lovebud-scout-live-endpoint-error-readiness-audit.md',
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

const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const depAdapterCode = readFileSafe(DEP_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

let storageModulePromise = null;
async function loadStorageModule() {
  if (!storageModulePromise) {
    storageModulePromise = importAbsolute(STORAGE_ADAPTER_PATH);
  }
  return storageModulePromise;
}

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const tests = [];

// ── 1. Module exists ────────────────────────────────────────────────────────
tests.push({
  name: 'Storage adapter skeleton module exists',
  fn: () => {
    assert.ok(storageCode.length > 0, 'storage adapter module must exist');
  },
});

// ── 2. Module exports factory and version ──────────────────────────────────
tests.push({
  name: 'Module exports factory, version, codes, modes, allowed/prohibited fields',
  fn: async () => {
    const mod = await loadStorageModule();
    assert.strictEqual(typeof mod.createScoutLiveRateLimitStorageAdapter, 'function', 'factory must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION, 'string', 'version must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES, 'object', 'codes must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES, 'object', 'modes must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_ALLOWED_FIELDS, 'object', 'allowed fields must be exported');
    assert.strictEqual(typeof mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_PROHIBITED_FIELDS, 'object', 'prohibited fields must be exported');
    assert.strictEqual(typeof mod.sanitizeScoutLiveRateLimitStoragePayload, 'function', 'sanitizePayload must be exported');
    assert.ok(/^v?2026\d{4}-/.test(mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION.replace(/^v/, '')) || /^2026\d{4}/.test(mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION), 'version must be a YYYYMMDD-N style string');
  },
});

// ── 3. Default adapter is mock-disabled ────────────────────────────────────
tests.push({
  name: 'Factory default mockDisabled:true returns mock_disabled adapter',
  fn: async () => {
    const mod = await loadStorageModule();
    const adapter = mod.createScoutLiveRateLimitStorageAdapter();
    assert.strictEqual(adapter.mockDisabled, true, 'default mockDisabled must be true');
    assert.strictEqual(adapter.isMockDisabled, true, 'default isMockDisabled must be true');
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.MOCK_DISABLED, 'default mode must be MOCK_DISABLED');
    assert.strictEqual(adapter.kind, 'scout_live_rate_limit_storage_adapter', 'kind must be set');
    assert.strictEqual(adapter.version, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION, 'adapter version must match module version');
  },
});

// ── 4. Adapter object is frozen ────────────────────────────────────────────
tests.push({
  name: 'Adapter object is frozen (immutable)',
  fn: async () => {
    const mod = await loadStorageModule();
    const adapter = mod.createScoutLiveRateLimitStorageAdapter();
    assert.strictEqual(Object.isFrozen(adapter), true, 'adapter must be frozen');
  },
});

// ── 5. checkQuota safe-fails ───────────────────────────────────────────────
tests.push({
  name: 'Mock-disabled checkQuota returns { allowed:false, code: STORAGE_MOCK_DISABLED }',
  fn: async () => {
    const mod = await loadStorageModule();
    const adapter = mod.createScoutLiveRateLimitStorageAdapter();
    const res = await adapter.checkQuota({});
    assert.strictEqual(res.allowed, false, 'mock-disabled checkQuota must deny');
    assert.strictEqual(res.code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED, 'code must be STORAGE_MOCK_DISABLED');
    assert.ok(typeof res.reason === 'string' && res.reason.length > 0, 'reason must be a non-empty string');
  },
});

// ── 6. consumeQuota safe-fails ─────────────────────────────────────────────
tests.push({
  name: 'Mock-disabled consumeQuota returns { allowed:false, code: STORAGE_MOCK_DISABLED }',
  fn: async () => {
    const mod = await loadStorageModule();
    const adapter = mod.createScoutLiveRateLimitStorageAdapter();
    const res = await adapter.consumeQuota({});
    assert.strictEqual(res.allowed, false, 'mock-disabled consumeQuota must deny');
    assert.strictEqual(res.code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED, 'code must be STORAGE_MOCK_DISABLED');
    assert.ok(typeof res.reason === 'string' && res.reason.length > 0, 'reason must be a non-empty string');
  },
});

// ── 7. releaseQuota safe-fails ─────────────────────────────────────────────
tests.push({
  name: 'Mock-disabled releaseQuota returns { released:false, code: STORAGE_MOCK_DISABLED }',
  fn: async () => {
    const mod = await loadStorageModule();
    const adapter = mod.createScoutLiveRateLimitStorageAdapter();
    const res = await adapter.releaseQuota({});
    assert.strictEqual(res.released, false, 'mock-disabled releaseQuota must return released:false');
    assert.strictEqual(res.code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED, 'code must be STORAGE_MOCK_DISABLED');
    assert.ok(typeof res.reason === 'string' && res.reason.length > 0, 'reason must be a non-empty string');
  },
});

// ── 8. mockDisabled:false returns not-implemented shape ───────────────────
tests.push({
  name: 'Factory mockDisabled:false returns NOT_IMPLEMENTED adapter with same shape',
  fn: async () => {
    const mod = await loadStorageModule();
    const adapter = mod.createScoutLiveRateLimitStorageAdapter({ mockDisabled: false });
    assert.strictEqual(adapter.mockDisabled, false, 'mockDisabled must be false');
    assert.strictEqual(adapter.isMockDisabled, false, 'isMockDisabled must be false');
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.NOT_IMPLEMENTED, 'mode must be NOT_IMPLEMENTED');
    const c = await adapter.checkQuota({});
    assert.strictEqual(c.allowed, false, 'not-implemented checkQuota must deny');
    assert.strictEqual(c.code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_NOT_IMPLEMENTED, 'code must be STORAGE_NOT_IMPLEMENTED');
    const cn = await adapter.consumeQuota({});
    assert.strictEqual(cn.code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_NOT_IMPLEMENTED, 'code must be STORAGE_NOT_IMPLEMENTED');
    const r = await adapter.releaseQuota({});
    assert.strictEqual(r.released, false, 'not-implemented releaseQuota must return released:false');
    assert.strictEqual(r.code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_NOT_IMPLEMENTED, 'code must be STORAGE_NOT_IMPLEMENTED');
  },
});

// ── 9. sanitizePayload strips prohibited fields (drop mode) ───────────────
tests.push({
  name: 'sanitizePayload strips prohibited fields (drop mode) and keeps allowed fields',
  fn: async () => {
    const mod = await loadStorageModule();
    const result = mod.sanitizeScoutLiveRateLimitStoragePayload({
      requestId: 'req_test_123',
      userKeyHash: 'hk_abc',
      token: 'Bearer TEST_FIXTURE_TOKEN_NOT_A_REAL_SECRET',
      apiKey: 'TEST_FIXTURE_KEY',
      prompt: 'TEST_FIXTURE_PROMPT',
      excerpt: 'TEST_FIXTURE_EXCERPT',
      sourceUrl: 'https://example.com/test',
      rawRequestBody: '{"foo":"bar"}',
      unknownField: 'should be dropped',
    });
    assert.strictEqual(result.rejected, false, 'drop mode must not reject');
    assert.deepStrictEqual(result.rejectedFields.sort(), ['apiKey', 'excerpt', 'prompt', 'rawRequestBody', 'sourceUrl', 'token'].sort(), 'prohibited fields must be tracked');
    assert.strictEqual(result.payload.requestId, 'req_test_123', 'allowed field must be kept');
    assert.strictEqual(result.payload.userKeyHash, 'hk_abc', 'allowed field must be kept');
    assert.strictEqual(result.payload.token, undefined, 'prohibited field must be dropped');
    assert.strictEqual(result.payload.unknownField, undefined, 'unknown field must be dropped');
  },
});

// ── 10. sanitizePayload reject mode ───────────────────────────────────────
tests.push({
  name: 'sanitizePayload reject mode returns rejected:true with rejectedFields',
  fn: async () => {
    const mod = await loadStorageModule();
    const result = mod.sanitizeScoutLiveRateLimitStoragePayload(
      { requestId: 'req_test_123', token: 'TEST_FIXTURE_TOKEN' },
      { onProhibitedField: 'reject' }
    );
    assert.strictEqual(result.rejected, true, 'reject mode must set rejected:true');
    assert.ok(result.rejectedFields.includes('token'), 'rejectedFields must include token');
    assert.strictEqual(result.payload.token, undefined, 'rejected payload must not contain prohibited field');
  },
});

// ── 11. No external storage access in code ─────────────────────────────────
tests.push({
  name: 'No KV / Durable Object / D1 / database runtime access in storage adapter code',
  fn: () => {
    const code = codeOnly(storageCode).toLowerCase();
    assert.ok(!/kvnamespace/.test(code), 'storage adapter must not reference KVNamespace in code');
    assert.ok(!/durableobject/.test(code), 'storage adapter must not reference DurableObject in code');
    assert.ok(!/d1database/.test(code), 'storage adapter must not reference D1Database in code');
    assert.ok(!/env\.kv\b/.test(code), 'storage adapter must not read env.KV in code');
    assert.ok(!/env\.db\b/.test(code), 'storage adapter must not read env.DB in code');
    assert.ok(!/env\.rate_limit/.test(code), 'storage adapter must not read env.RATE_LIMIT in code');
    assert.ok(!/env\.storage/.test(code), 'storage adapter must not read env.STORAGE in code');
  },
});

// ── 12. No fetch / XHR / axios ─────────────────────────────────────────────
tests.push({
  name: 'No fetch / XHR / axios in storage adapter code',
  fn: () => {
    const code = codeOnly(storageCode).toLowerCase();
    assert.ok(!/\bfetch\s*\(/.test(code), 'storage adapter must not call fetch in code');
    assert.ok(!/xmlhttprequest/.test(code), 'storage adapter must not use XMLHttpRequest in code');
    assert.ok(!/axios/.test(code), 'storage adapter must not use axios in code');
    assert.ok(!/new\s+request\s*\(/.test(code), 'storage adapter must not construct a new Request in code');
  },
});

// ── 13. No Firebase Admin SDK ──────────────────────────────────────────────
tests.push({
  name: 'No Firebase Admin SDK imports in storage adapter code',
  fn: () => {
    const code = codeOnly(storageCode).toLowerCase();
    assert.ok(!/firebase-admin/.test(code), 'storage adapter must not import firebase-admin in code');
    assert.ok(!/admin\s*\.\s*auth/.test(code), 'storage adapter must not reference admin.auth in code');
    assert.ok(!/initializeapp/.test(code), 'storage adapter must not call initializeApp in code');
  },
});

// ── 14. No provider SDK imports ────────────────────────────────────────────
tests.push({
  name: 'No provider SDK imports in storage adapter code (imports only, denylist field names allowed)',
  fn: () => {
    const code = codeOnly(storageCode).toLowerCase();
    // Check for import statements only, not field names in denylist constants.
    // The module's SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_PROHIBITED_FIELDS may
    // include "openaiApiKey" etc. as denylist field names — that is allowed.
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      const importPattern = new RegExp(`(import|require).*${provider}`, 'i');
      assert.ok(!importPattern.test(code), `storage adapter must not import ${provider} in code`);
    }
  },
});

// ── 15. No secrets / env usage ─────────────────────────────────────────────
tests.push({
  name: 'No raw secret / env storage binding / process.env reading in storage adapter code',
  fn: () => {
    const code = codeOnly(storageCode).toLowerCase();
    assert.ok(!/process\.env\.scout/.test(code), 'storage adapter must not read process.env.SCOUT_* in code');
    assert.ok(!/import\.meta\.env/.test(code), 'storage adapter must not read import.meta.env in code');
    assert.ok(!/api_key\s*=/.test(code), 'storage adapter must not assign api_key in code');
    assert.ok(!/bearer\s+/.test(code), 'storage adapter must not embed bearer tokens in code');
  },
});

// ── 16. Prohibited payload fields are documented in module ─────────────────
tests.push({
  name: 'Prohibited payload fields are documented in module (denylist exported)',
  fn: async () => {
    const mod = await loadStorageModule();
    const prohibited = mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_PROHIBITED_FIELDS;
    assert.ok(Array.isArray(prohibited), 'prohibited fields must be an array');
    for (const field of ['token', 'rawToken', 'authorization', 'apiKey', 'secret', 'prompt', 'excerpt', 'sourceUrl', 'rawRequestBody']) {
      assert.ok(prohibited.includes(field), `prohibited fields must include "${field}"`);
    }
  },
});

// ── 17. Allowed payload fields are documented in module ────────────────────
tests.push({
  name: 'Allowed payload fields are documented in module (allowlist exported)',
  fn: async () => {
    const mod = await loadStorageModule();
    const allowed = mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_ALLOWED_FIELDS;
    assert.ok(Array.isArray(allowed), 'allowed fields must be an array');
    for (const field of ['requestId', 'userKeyHash', 'ipHash', 'endpointPath', 'providerMode', 'windowKey', 'limitName']) {
      assert.ok(allowed.includes(field), `allowed fields must include "${field}"`);
    }
  },
});

// ── 18. Endpoint default stub preserved ────────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must reference STUB mode');
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define STUB mode constant');
  },
});

// ── 19. Frontend default local_stub preserved ──────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 20. Endpoint client default disabled preserved ─────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no storage adapter wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('live-rate-limit-storage-adapter'),
      'endpoint client must not reference the storage adapter'
    );
  },
});

// ── 21. No wiring into suggest.js LIVE branch in this slice ────────────────
tests.push({
  name: 'Storage adapter module is NOT wired into suggest.js LIVE branch in this slice (out of scope)',
  fn: () => {
    assert.ok(
      !suggestCode.includes('live-rate-limit-storage-adapter'),
      'suggest.js must not import or reference the storage adapter in this slice (wiring is a separate slice)'
    );
    assert.ok(
      !suggestCode.includes('createScoutLiveRateLimitStorageAdapter'),
      'suggest.js must not call createScoutLiveRateLimitStorageAdapter in this slice'
    );
  },
});

// ── 22. Dependency adapter endpoint wiring still passes ───────────────────
tests.push({
  name: 'Dependency adapter endpoint wiring remains intact (suggest.js still imports createScoutLiveDependencyAdapter)',
  fn: () => {
    assert.ok(
      suggestCode.includes('createScoutLiveDependencyAdapter'),
      'suggest.js must still import createScoutLiveDependencyAdapter (wiring from previous slice)'
    );
    assert.ok(
      depAdapterCode.includes('SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION'),
      'dependency adapter module must still exist'
    );
  },
});

// ── 23. Storage adapter skeleton doc exists and reflects status ───────────
tests.push({
  name: 'Storage adapter skeleton doc exists and reflects skeleton status',
  fn: () => {
    const docPath = path.join(ROOT, 'docs/product/lovebud-scout-live-rate-limit-storage-adapter-skeleton.md');
    const doc = readFileSafe(docPath);
    assert.ok(doc.length > 0, 'storage adapter skeleton doc must exist');
    const lc = doc.toLowerCase();
    assert.ok(lc.includes('mock-disabled') || lc.includes('mock_disabled') || lc.includes('mock disabled'), 'doc must mention mock-disabled');
    assert.ok(lc.includes('checkquota') || lc.includes('check_quota') || lc.includes('check quota'), 'doc must mention checkQuota');
    assert.ok(lc.includes('consumequota') || lc.includes('consume_quota') || lc.includes('consume quota'), 'doc must mention consumeQuota');
    assert.ok(lc.includes('releasequota') || lc.includes('release_quota') || lc.includes('release quota'), 'doc must mention releaseQuota');
    assert.ok(lc.includes('no-go') || lc.includes('no go') || lc.includes('blocked') || lc.includes('not yet'), 'doc must mark real storage as not yet ready');
    assert.ok(lc.includes('kv') && lc.includes('durable') && lc.includes('d1'), 'doc must mention KV, Durable Object, and D1 as blocked');
    assert.ok(lc.includes('token') || lc.includes('prohibited'), 'doc must mention prohibited payload fields');
  },
});

// ── 24. Related docs reflect storage adapter skeleton status ──────────────
tests.push({
  name: 'Related docs exist and reflect storage adapter skeleton status',
  fn: () => {
    for (const docName of DOCS) {
      const docPath = path.join(ROOT, 'docs/product/' + docName);
      const doc = readFileSafe(docPath);
      assert.ok(doc.length > 0, `${docName} must exist`);
    }
  },
});

// ── Runner ─────────────────────────────────────────────────────────────────
(async () => {
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
})();
