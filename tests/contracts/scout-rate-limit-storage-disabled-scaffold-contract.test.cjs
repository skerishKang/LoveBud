/**
 * Scout Rate-Limit Storage Disabled Runtime Scaffold Contract Tests
 * v20260607-1
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

const ROOT = path.resolve(__dirname, '../..');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const RELATED_DOCS = [
  'lovebud-scout-runtime-rate-limit-storage-implementation-plan.md',
  'lovebud-scout-live-rate-limit-storage-adapter-skeleton.md',
  'lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md',
  'lovebud-scout-runtime-observability-policy-audit.md',
  'lovebud-scout-rollback-kill-switch-policy-audit.md',
  'lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md',
  'lovebud-scout-firebase-auth-verifier-disabled-scaffold-readiness-audit.md',
  'lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md',
  'lovebud-scout-live-endpoint-error-taxonomy-contract.md',
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
    storageModulePromise = import(STORAGE_ADAPTER_PATH);
  }
  return storageModulePromise;
}

const SENSITIVE_RESULT_FIELDS = [
  'token',
  'rawToken',
  'authorization',
  'authorizationHeader',
  'firebaseToken',
  'apiKey',
  'secret',
  'password',
  'cookie',
  'sessionCookie',
  'prompt',
  'excerpt',
  'sourceUrl',
  'rawRequestBody',
  'rawProviderResponse',
  'rawModelOutput',
  'rawStorageKey',
  'rawUserIdentifier',
];

function assertNoSensitiveResultFields(result) {
  for (const field of SENSITIVE_RESULT_FIELDS) {
    assert.ok(
      !Object.prototype.hasOwnProperty.call(result, field),
      `safe-fail result must not expose sensitive field ${field}`
    );
  }
}

async function assertStorageScaffoldSafeFails(mod, storageMode, expectedMode, expectedCode) {
  const adapter = mod.createScoutLiveRateLimitStorageAdapter({ mockDisabled: false, storageMode });
  assert.strictEqual(adapter.mode, expectedMode, `${storageMode} must resolve to expected disabled mode`);
  assert.strictEqual(adapter.storageMode, expectedMode, `${storageMode} storageMode must match resolved mode`);
  assert.strictEqual(adapter.isRuntimeScaffold, true, `${storageMode} must enter runtime scaffold path`);
  assert.strictEqual(adapter.mockDisabled, false, `${storageMode} scaffold should not claim mockDisabled:true`);

  const check = await adapter.checkQuota({ token: 'TEST_FIXTURE_TOKEN_NOT_A_SECRET', rawStorageKey: 'TEST_RAW_KEY' });
  assert.strictEqual(check.allowed, false, `${storageMode} checkQuota must deny`);
  assert.strictEqual(check.code, expectedCode, `${storageMode} checkQuota must use expected safe-fail code`);
  assert.strictEqual(check.mode, expectedMode, `${storageMode} checkQuota result mode must be included`);
  assertNoSensitiveResultFields(check);

  const consume = await adapter.consumeQuota({ authorization: 'Bearer TEST_FIXTURE', sourceUrl: 'https://example.test/source' });
  assert.strictEqual(consume.allowed, false, `${storageMode} consumeQuota must deny`);
  assert.strictEqual(consume.code, expectedCode, `${storageMode} consumeQuota must use expected safe-fail code`);
  assert.strictEqual(consume.mode, expectedMode, `${storageMode} consumeQuota result mode must be included`);
  assertNoSensitiveResultFields(consume);

  const release = await adapter.releaseQuota({ apiKey: 'TEST_FIXTURE_KEY', rawUserIdentifier: 'TEST_USER' });
  assert.strictEqual(release.released, false, `${storageMode} releaseQuota must not release`);
  assert.strictEqual(release.code, expectedCode, `${storageMode} releaseQuota must use expected safe-fail code`);
  assert.strictEqual(release.mode, expectedMode, `${storageMode} releaseQuota result mode must be included`);
  assertNoSensitiveResultFields(release);
}

const tests = [];

// ── 1. Test file and module exist ───────────────────────────────────────────
tests.push({
  name: 'Disabled storage scaffold contract file and storage adapter exist',
  fn: () => {
    assert.ok(fs.existsSync(__filename), 'this contract file must exist');
    assert.ok(storageCode.length > 0, 'storage adapter module must exist');
  },
});

// ── 2. Exports include runtime scaffold mode/code ───────────────────────────
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

// ── 3. Default remains mock-disabled ────────────────────────────────────────
tests.push({
  name: 'Default adapter behavior remains mock-disabled and safe-fail only',
  fn: async () => {
    const mod = await loadStorageModule();
    const adapter = mod.createScoutLiveRateLimitStorageAdapter();
    assert.strictEqual(adapter.mockDisabled, true, 'default mockDisabled must remain true');
    assert.strictEqual(adapter.isMockDisabled, true, 'default isMockDisabled must remain true');
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.MOCK_DISABLED, 'default mode must remain mock_disabled');
    assert.strictEqual(adapter.isRuntimeScaffold, false, 'default must not enter runtime scaffold');
    const check = await adapter.checkQuota({});
    const consume = await adapter.consumeQuota({});
    const release = await adapter.releaseQuota({});
    assert.strictEqual(check.code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED, 'default checkQuota must be mock-disabled');
    assert.strictEqual(consume.code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED, 'default consumeQuota must be mock-disabled');
    assert.strictEqual(release.code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED, 'default releaseQuota must be mock-disabled');
  },
});

// ── 4. Explicit opt-in is required ──────────────────────────────────────────
tests.push({
  name: 'Storage runtime scaffold requires explicit storageMode opt-in',
  fn: async () => {
    const mod = await loadStorageModule();
    const adapter = mod.createScoutLiveRateLimitStorageAdapter({ mockDisabled: false });
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.NOT_IMPLEMENTED, 'mockDisabled:false without storageMode remains not_implemented');
    assert.strictEqual(adapter.isRuntimeScaffold, false, 'no explicit storageMode must not enter runtime scaffold');
    const check = await adapter.checkQuota({});
    assert.strictEqual(check.code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_NOT_IMPLEMENTED, 'no explicit storageMode must remain not implemented');
  },
});

// ── 5. KV scaffold safe-fails ───────────────────────────────────────────────
tests.push({
  name: 'KV scaffold safe-fails without real storage access',
  fn: async () => {
    const mod = await loadStorageModule();
    await assertStorageScaffoldSafeFails(
      mod,
      'kv',
      mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.KV_DISABLED,
      mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KV_DISABLED
    );
  },
});

// ── 6. Durable Object scaffold safe-fails ───────────────────────────────────
tests.push({
  name: 'Durable Object scaffold safe-fails without real storage access',
  fn: async () => {
    const mod = await loadStorageModule();
    await assertStorageScaffoldSafeFails(
      mod,
      'durable_object',
      mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.DURABLE_OBJECT_DISABLED,
      mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_DURABLE_OBJECT_DISABLED
    );
  },
});

// ── 7. D1 scaffold safe-fails ───────────────────────────────────────────────
tests.push({
  name: 'D1 scaffold safe-fails without real storage access',
  fn: async () => {
    const mod = await loadStorageModule();
    await assertStorageScaffoldSafeFails(
      mod,
      'd1',
      mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.D1_DISABLED,
      mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_D1_DISABLED
    );
  },
});

// ── 8. Disabled aliases are explicit and safe-fail ──────────────────────────
tests.push({
  name: 'Disabled storageMode aliases remain explicit scaffold safe-fails',
  fn: async () => {
    const mod = await loadStorageModule();
    await assertStorageScaffoldSafeFails(mod, 'kv_disabled', mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.KV_DISABLED, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KV_DISABLED);
    await assertStorageScaffoldSafeFails(mod, 'durable_object_disabled', mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.DURABLE_OBJECT_DISABLED, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_DURABLE_OBJECT_DISABLED);
    await assertStorageScaffoldSafeFails(mod, 'd1_disabled', mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.D1_DISABLED, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_D1_DISABLED);
  },
});

// ── 9. Missing/unknown explicit mode safe-fails ─────────────────────────────
tests.push({
  name: 'Blank or unknown explicit storageMode safe-fails as STORAGE_CONFIG_MISSING',
  fn: async () => {
    const mod = await loadStorageModule();
    for (const storageMode of ['', 'unknown_runtime_storage']) {
      const adapter = mod.createScoutLiveRateLimitStorageAdapter({ mockDisabled: false, storageMode });
      assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.STORAGE_CONFIG_MISSING, 'blank/unknown storageMode must resolve to config missing');
      const check = await adapter.checkQuota({});
      assert.strictEqual(check.code, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_CONFIG_MISSING, 'blank/unknown storageMode must safe-fail with config missing');
      assertNoSensitiveResultFields(check);
    }
  },
});

// ── 10. mockDisabled wins over storageMode ──────────────────────────────────
tests.push({
  name: 'mockDisabled:true prevents accidental runtime scaffold entry even with storageMode',
  fn: async () => {
    const mod = await loadStorageModule();
    const adapter = mod.createScoutLiveRateLimitStorageAdapter({ storageMode: 'kv' });
    assert.strictEqual(adapter.mode, mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.MOCK_DISABLED, 'mockDisabled:true must remain mock_disabled');
    assert.strictEqual(adapter.isRuntimeScaffold, false, 'mockDisabled:true must not enter scaffold path');
  },
});

// ── 11. Sanitizer prohibited fields ─────────────────────────────────────────
tests.push({
  name: 'Sanitizer drops or rejects every prohibited storage payload field',
  fn: async () => {
    const mod = await loadStorageModule();
    const prohibited = [
      'token', 'rawToken', 'authorization', 'authorizationHeader', 'apiKey',
      'secret', 'password', 'cookie', 'sessionCookie', 'firebaseToken',
      'prompt', 'excerpt', 'sourceUrl', 'rawRequestBody', 'rawProviderResponse',
      'rawModelOutput', 'rawStorageKey', 'rawUserIdentifier',
    ];
    for (const field of prohibited) {
      assert.ok(mod.SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_PROHIBITED_FIELDS.includes(field), `denylist must include ${field}`);
    }
    const payload = { requestId: 'req_test', userKeyHash: 'hash_test' };
    for (const field of prohibited) payload[field] = 'TEST_FIXTURE_VALUE';
    const dropped = mod.sanitizeScoutLiveRateLimitStoragePayload(payload);
    assert.strictEqual(dropped.rejected, false, 'drop mode must not reject');
    assert.strictEqual(dropped.payload.requestId, 'req_test', 'allowed field must remain');
    for (const field of prohibited) {
      assert.strictEqual(dropped.payload[field], undefined, `${field} must be dropped`);
    }
    const rejected = mod.sanitizeScoutLiveRateLimitStoragePayload(payload, { onProhibitedField: 'reject' });
    assert.strictEqual(rejected.rejected, true, 'reject mode must reject prohibited payloads');
    assert.ok(rejected.rejectedFields.length > 0, 'reject mode must report rejected fields');
  },
});

// ── 12. Side-effect-free / forbidden runtime access ─────────────────────────
tests.push({
  name: 'Storage adapter has no KV / DO / D1 runtime access, fetch, Firebase, provider SDK, or env secret usage',
  fn: () => {
    const code = codeOnly(storageCode);
    const lower = code.toLowerCase();
    for (const forbidden of [
      /kvnamespace/,
      /durableobjectnamespace/,
      /durableobject/,
      /d1database/,
      /env\.kv\b/,
      /env\.db\b/,
      /env\.rate_limit/,
      /\bfetch\s*\(/,
      /xmlhttprequest/,
      /axios/,
      /firebase-admin/,
      /admin\s*\.\s*auth/,
      /initializeapp/,
      /process\.env/,
      /import\.meta\.env/,
      /env\.scout_/,
    ]) {
      assert.ok(!forbidden.test(lower), `storage adapter must not match forbidden pattern ${forbidden}`);
    }
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      const importPattern = new RegExp(`(import|require).*${provider}`, 'i');
      assert.ok(!importPattern.test(lower), `storage adapter must not import ${provider}`);
    }
  },
});

// ── 13. Dependency adapter behavior unchanged in this slice ────────────────
tests.push({
  name: 'Dependency adapter behavior is not wired to runtime storage scaffold in this slice',
  fn: () => {
    assert.ok(depAdapterCode.length > 0, 'dependency adapter must exist');
    assert.ok(!depAdapterCode.includes('STORAGE_KV_DISABLED'), 'dependency adapter must not yet map KV disabled scaffold');
    assert.ok(!depAdapterCode.includes('STORAGE_DURABLE_OBJECT_DISABLED'), 'dependency adapter must not yet map Durable Object disabled scaffold');
    assert.ok(!depAdapterCode.includes('STORAGE_D1_DISABLED'), 'dependency adapter must not yet map D1 disabled scaffold');
  },
});

// ── 14. suggest.js unchanged / endpoint stub preserved ─────────────────────
tests.push({
  name: 'suggest.js remains unwired to storage scaffold and endpoint stub remains default',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must still reference STUB mode');
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define stub mode');
    assert.ok(!suggestCode.includes('live-rate-limit-storage-adapter'), 'suggest.js must not import storage adapter in this slice');
    assert.ok(!suggestCode.includes('createScoutLiveRateLimitStorageAdapter'), 'suggest.js must not call storage adapter factory in this slice');
  },
});

// ── 15. Frontend defaults preserved ─────────────────────────────────────────
tests.push({
  name: 'Frontend default local_stub and endpoint client default disabled are preserved',
  fn: () => {
    assert.ok(sourceSelectorCode.includes('local_stub'), 'source selector must preserve local_stub default path');
    assert.ok(!sourceSelectorCode.includes('storageMode'), 'source selector must not expose storageMode opt-in');
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(!endpointClientCode.includes('live-rate-limit-storage-adapter'), 'endpoint client must not reference storage adapter');
  },
});

// ── 16. Docs updated ────────────────────────────────────────────────────────
tests.push({
  name: 'Related docs include Rate-limit Storage Disabled Runtime Scaffold Status',
  fn: () => {
    for (const docName of RELATED_DOCS) {
      const docPath = path.join(ROOT, 'docs/product', docName);
      const doc = readFileSafe(docPath);
      if (!doc.length) continue;
      assert.ok(doc.includes('Rate-limit Storage Disabled Runtime Scaffold Status'), `${docName} must include scaffold status section`);
      assert.ok(doc.includes('No real KV') || doc.includes('no real KV'), `${docName} must keep real KV blocked`);
      assert.ok(doc.includes('endpoint default') || doc.includes('Endpoint default'), `${docName} must mention endpoint default preservation`);
      assert.ok(doc.includes('11 of 11'), `${docName} must keep gate evidence 11 of 11 documented`);
      assert.ok(doc.includes('staging_live') && doc.includes('production_live'), `${docName} must keep staging/prod live blocked`);
    }
  },
});

// ── 17. No staging/prod opt-in in storage adapter ───────────────────────────
tests.push({
  name: 'Storage scaffold does not introduce staging_live or production_live opt-in',
  fn: () => {
    const lower = codeOnly(storageCode).toLowerCase();
    assert.ok(!lower.includes('staging_live'), 'storage adapter must not introduce staging_live');
    assert.ok(!lower.includes('production_live'), 'storage adapter must not introduce production_live');
  },
});

// ── Runner ─────────────────────────────────────────────────────────────────
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
