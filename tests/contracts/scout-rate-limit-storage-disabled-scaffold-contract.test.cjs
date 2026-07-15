/**
 * Scout Rate-Limit Storage Disabled Runtime Scaffold Contract Tests
 * v20260607-2
 *
 * Locks the disabled-by-default runtime storage scaffold for Scout live
 * rate-limit storage. This is scaffold-only: no real KV, Durable Object,
 * D1, quota persistence, endpoint behavior change, provider call, Firebase
 * Admin SDK, or frontend default source change is allowed.
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

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const depAdapterCode = readFileSafe(DEP_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

let storageModulePromise = null;
async function loadStorageModule() {
  if (!storageModulePromise) {
    storageModulePromise = importAbsolute(STORAGE_ADAPTER_PATH);
  }
  return storageModulePromise;
}

const SENSITIVE_RESULT_FIELDS = [
  'token', 'rawToken', 'authorization', 'authorizationHeader', 'firebaseToken',
  'apiKey', 'secret', 'password', 'cookie', 'sessionCookie', 'prompt', 'excerpt',
  'sourceUrl', 'rawRequestBody', 'rawProviderResponse', 'rawModelOutput',
  'rawStorageKey', 'rawUserIdentifier',
];

function assertNoSensitiveResultFields(result) {
  for (const field of SENSITIVE_RESULT_FIELDS) {
    assert.ok(!Object.prototype.hasOwnProperty.call(result, field), `result must not expose ${field}`);
  }
}

async function assertStorageScaffoldSafeFails(mod, storageMode, expectedMode, expectedCode) {
  const adapter = mod.createScoutLiveRateLimitStorageAdapter({ mockDisabled: false, storageMode });
  assert.strictEqual(adapter.mode, expectedMode, `${storageMode} must resolve to disabled scaffold mode`);
  assert.strictEqual(adapter.storageMode, expectedMode, `${storageMode} storageMode must match resolved mode`);
  assert.strictEqual(adapter.isRuntimeScaffold, true, `${storageMode} must enter runtime scaffold path`);
  assert.strictEqual(adapter.mockDisabled, false, `${storageMode} scaffold must not claim mockDisabled:true`);

  const check = await adapter.checkQuota({ token: 'TEST_FIXTURE_TOKEN', rawStorageKey: 'TEST_RAW_KEY' });
  assert.strictEqual(check.allowed, false, `${storageMode} checkQuota must deny`);
  assert.strictEqual(check.code, expectedCode, `${storageMode} checkQuota must use expected code`);
  assert.strictEqual(check.mode, expectedMode, `${storageMode} checkQuota result must include mode`);
  assertNoSensitiveResultFields(check);

  const consume = await adapter.consumeQuota({ authorization: 'Bearer TEST_FIXTURE', sourceUrl: 'https://example.test/source' });
  assert.strictEqual(consume.allowed, false, `${storageMode} consumeQuota must deny`);
  assert.strictEqual(consume.code, expectedCode, `${storageMode} consumeQuota must use expected code`);
  assert.strictEqual(consume.mode, expectedMode, `${storageMode} consumeQuota result must include mode`);
  assertNoSensitiveResultFields(consume);

  const release = await adapter.releaseQuota({ apiKey: 'TEST_FIXTURE_KEY', rawUserIdentifier: 'TEST_USER' });
  assert.strictEqual(release.released, false, `${storageMode} releaseQuota must not release`);
  assert.strictEqual(release.code, expectedCode, `${storageMode} releaseQuota must use expected code`);
  assert.strictEqual(release.mode, expectedMode, `${storageMode} releaseQuota result must include mode`);
  assertNoSensitiveResultFields(release);
}

const tests = [];

tests.push({
  name: 'Disabled storage scaffold contract file and storage adapter exist',
  fn: () => {
    assert.ok(fs.existsSync(__filename), 'this contract file must exist');
    assert.ok(storageCode.length > 0, 'storage adapter module must exist');
  },
});

tests.push({
  name: 'Storage adapter exports KV / Durable Object / D1 scaffold modes and codes',
  fn: async () => {
    const mod = await loadStorageModule();
    assert.strictEqual(mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_MODES, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES, 'mode alias must point to adapter modes');
    assert.strictEqual(mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_CODES, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES, 'code alias must point to adapter codes');
    for (const modeName of ['KV_DISABLED', 'DURABLE_OBJECT_DISABLED', 'D1_DISABLED', 'STORAGE_CONFIG_MISSING']) {
      assert.ok(mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES[modeName], `mode ${modeName} must be exported`);
    }
    for (const codeName of ['STORAGE_KV_DISABLED', 'STORAGE_DURABLE_OBJECT_DISABLED', 'STORAGE_D1_DISABLED', 'STORAGE_CONFIG_MISSING']) {
      assert.ok(mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES[codeName], `code ${codeName} must be exported`);
    }
  },
});

tests.push({
  name: 'Default adapter behavior remains mock-disabled and safe-fail only',
  fn: async () => {
    const mod = await loadStorageModule();
    const adapter = mod.createScoutLiveRateLimitStorageAdapter();
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.MOCK_DISABLED, 'default mode must remain mock_disabled');
    assert.strictEqual(adapter.mockDisabled, true, 'default mockDisabled must remain true');
    assert.strictEqual(adapter.isRuntimeScaffold, false, 'default must not enter runtime scaffold');
    assert.strictEqual((await adapter.checkQuota({})).code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED, 'default checkQuota must be mock-disabled');
    assert.strictEqual((await adapter.consumeQuota({})).code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED, 'default consumeQuota must be mock-disabled');
    assert.strictEqual((await adapter.releaseQuota({})).code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED, 'default releaseQuota must be mock-disabled');
  },
});

tests.push({
  name: 'Storage runtime scaffold requires explicit storageMode opt-in',
  fn: async () => {
    const mod = await loadStorageModule();
    const adapter = mod.createScoutLiveRateLimitStorageAdapter({ mockDisabled: false });
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.NOT_IMPLEMENTED, 'mockDisabled:false without storageMode remains not_implemented');
    assert.strictEqual(adapter.isRuntimeScaffold, false, 'no explicit storageMode must not enter runtime scaffold');
    assert.strictEqual((await adapter.checkQuota({})).code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_NOT_IMPLEMENTED, 'no storageMode must remain not implemented');
  },
});

tests.push({
  name: 'KV / Durable Object / D1 scaffold modes safe-fail without real storage access',
  fn: async () => {
    const mod = await loadStorageModule();
    await assertStorageScaffoldSafeFails(mod, 'kv', mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.KV_DISABLED, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KV_DISABLED);
    await assertStorageScaffoldSafeFails(mod, 'durable_object', mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.DURABLE_OBJECT_DISABLED, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_DURABLE_OBJECT_DISABLED);
    await assertStorageScaffoldSafeFails(mod, 'd1', mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.D1_DISABLED, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_D1_DISABLED);
  },
});

tests.push({
  name: 'Disabled aliases and unknown storage modes safe-fail explicitly',
  fn: async () => {
    const mod = await loadStorageModule();
    await assertStorageScaffoldSafeFails(mod, 'kv_disabled', mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.KV_DISABLED, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KV_DISABLED);
    await assertStorageScaffoldSafeFails(mod, 'durable_object_disabled', mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.DURABLE_OBJECT_DISABLED, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_DURABLE_OBJECT_DISABLED);
    await assertStorageScaffoldSafeFails(mod, 'd1_disabled', mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.D1_DISABLED, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_D1_DISABLED);

    for (const storageMode of ['', 'unknown_runtime_storage']) {
      const adapter = mod.createScoutLiveRateLimitStorageAdapter({ mockDisabled: false, storageMode });
      assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.STORAGE_CONFIG_MISSING, 'blank/unknown storageMode must resolve to config missing');
      assert.strictEqual((await adapter.checkQuota({})).code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_CONFIG_MISSING, 'blank/unknown storageMode must safe-fail with config missing');
    }
  },
});

tests.push({
  name: 'mockDisabled:true prevents accidental runtime scaffold entry even with storageMode',
  fn: async () => {
    const mod = await loadStorageModule();
    const adapter = mod.createScoutLiveRateLimitStorageAdapter({ storageMode: 'kv' });
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.MOCK_DISABLED, 'mockDisabled:true must remain mock_disabled');
    assert.strictEqual(adapter.isRuntimeScaffold, false, 'mockDisabled:true must not enter scaffold path');
  },
});

tests.push({
  name: 'Sanitizer drops or rejects prohibited storage payload fields',
  fn: async () => {
    const mod = await loadStorageModule();
    for (const field of SENSITIVE_RESULT_FIELDS) {
      assert.ok(mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_PROHIBITED_FIELDS.includes(field), `denylist must include ${field}`);
    }
    const payload = { requestId: 'req_test', userKeyHash: 'hash_test' };
    for (const field of SENSITIVE_RESULT_FIELDS) payload[field] = 'TEST_FIXTURE_VALUE';
    const dropped = mod.sanitizeScoutLiveRateLimitStoragePayload(payload);
    assert.strictEqual(dropped.rejected, false, 'drop mode must not reject');
    assert.strictEqual(dropped.payload.requestId, 'req_test', 'allowed field must remain');
    for (const field of SENSITIVE_RESULT_FIELDS) {
      assert.strictEqual(dropped.payload[field], undefined, `${field} must be dropped`);
    }
    const rejected = mod.sanitizeScoutLiveRateLimitStoragePayload(payload, { onProhibitedField: 'reject' });
    assert.strictEqual(rejected.rejected, true, 'reject mode must reject prohibited payloads');
  },
});

tests.push({
  name: 'Storage adapter has no KV / DO / D1 runtime access, fetch, Firebase, provider SDK, or env secret usage',
  fn: () => {
    const lower = codeOnly(storageCode).toLowerCase();
    for (const forbidden of [/kvnamespace/, /durableobjectnamespace/, /durableobject/, /d1database/, /env\.kv\b/, /env\.db\b/, /env\.rate_limit/, /\bfetch\s*\(/, /xmlhttprequest/, /axios/, /firebase-admin/, /admin\s*\.\s*auth/, /initializeapp/, /process\.env/, /import\.meta\.env/, /env\.scout_/]) {
      assert.ok(!forbidden.test(lower), `storage adapter must not match forbidden pattern ${forbidden}`);
    }
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      const importPattern = new RegExp(`(import|require).*${provider}`, 'i');
      assert.ok(!importPattern.test(lower), `storage adapter must not import ${provider}`);
    }
  },
});

tests.push({
  name: 'Dependency adapter explicitly maps disabled storage scaffold while suggest.js remains unwired',
  fn: () => {
    assert.ok(depAdapterCode.length > 0, 'dependency adapter must exist');
    assert.ok(depAdapterCode.includes('STORAGE_KV_DISABLED'), 'dependency adapter must explicitly map KV disabled scaffold');
    assert.ok(depAdapterCode.includes('STORAGE_DURABLE_OBJECT_DISABLED'), 'dependency adapter must explicitly map Durable Object disabled scaffold');
    assert.ok(depAdapterCode.includes('STORAGE_D1_DISABLED'), 'dependency adapter must explicitly map D1 disabled scaffold');
    assert.ok(depAdapterCode.includes('STORAGE_CONFIG_MISSING'), 'dependency adapter must explicitly map storage config missing');
    assert.ok(!suggestCode.includes('live-rate-limit-storage-adapter'), 'suggest.js must not import storage adapter in this slice');
    assert.ok(!suggestCode.includes('createScoutLiveRateLimitStorageAdapter'), 'suggest.js must not call storage adapter factory in this slice');
  },
});

tests.push({
  name: 'Endpoint default stub, explicit stub surface, frontend local_stub, and endpoint client disabled are preserved',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must still reference STUB mode');
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define stub mode');
    assert.ok(sourceSelectorCode.includes('local_stub'), 'source selector must preserve local_stub default path');
    assert.ok(!sourceSelectorCode.includes('storageMode'), 'source selector must not expose storageMode opt-in');
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(!endpointClientCode.includes('live-rate-limit-storage-adapter'), 'endpoint client must not reference storage adapter');
  },
});

tests.push({
  name: 'Storage scaffold does not introduce staging_live or production_live opt-in',
  fn: () => {
    const lower = codeOnly(storageCode).toLowerCase();
    assert.ok(!lower.includes('staging_live'), 'storage adapter must not introduce staging_live');
    assert.ok(!lower.includes('production_live'), 'storage adapter must not introduce production_live');
  },
});

(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('  ✓ ' + t.name);
      passed++;
    } catch (err) {
      console.log('  ✗ ' + t.name);
      console.log('    ' + (err && err.message ? err.message : String(err)));
      failed++;
    }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();
