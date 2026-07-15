/**
 * Scout Provider-Specific Adapter Skeleton Contract Tests
 * v20260607-1
 *
 * Contract tests verifying the provider-specific adapter skeleton:
 * - File exists with expected exports
 * - Adapter is disabled by default
 * - Missing config maps CONFIG_MISSING
 * - Ready config still disabled/safe-fails
 * - API key value never returned or leaked
 * - baseUrl not fetched
 * - No provider SDK imports
 * - No fetch/XHR/axios in adapter, no XHR/axios in live-provider-adapter.js or suggest.js
 * - No executor invocation
 * - No sourceUrl fetch/crawler/metadata extraction
 * - No persistence/auto-save
 * - Endpoint default stub preserved
 * - Frontend default local_stub preserved
 * - Production readiness docs allow only disabled skeleton
 * - Docs updated
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ROOT = path.resolve(__dirname, '../..');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/provider-specific-adapter.js');
const LIVE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const AUDIT_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-production-readiness-gates-audit.md');

const RELATED_DOCS = [
  'lovebud-scout-live-provider-secret-incident-runbook-contract.md',
  'lovebud-scout-live-provider-cost-quota-abuse-monitoring-contract.md',
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-live-provider-staging-rollout-contract.md',
  'lovebud-scout-live-provider-post-mock-readiness-audit.md',
  'lovebud-scout-provider-secret-config-deployment-checklist.md',
  'lovebud-scout-live-provider-readiness-audit.md',
  'lovebud-scout-ai-suggestion-mvp-readiness.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
];

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const adapterCode = readFileSafe(ADAPTER_PATH);
const liveAdapterCode = readFileSafe(LIVE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const auditDocCode = readFileSafe(AUDIT_DOC_PATH);

// Dynamic import helper for ESM
async function importAdapter() {
  const module = await importAbsolute(ADAPTER_PATH);
  return module;
}

const tests = [];

// ── 1. Provider-specific adapter skeleton file exists ────────────────────────
tests.push({
  name: 'Provider-specific adapter skeleton file exists',
  fn: () => {
    assert.ok(fs.existsSync(ADAPTER_PATH), 'provider-specific-adapter.js must exist');
    assert.ok(adapterCode.length > 0, 'provider-specific-adapter.js must not be empty');
  },
});

// ── 2. Expected exports exist ────────────────────────────────────────────────
tests.push({
  name: 'Expected exports exist',
  fn: async () => {
    const mod = await importAdapter();
    assert.ok(mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS, 'SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS must be exported');
    assert.ok(mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES, 'SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES must be exported');
    assert.ok(typeof mod.normalizeScoutProviderSpecificAdapterConfig === 'function', 'normalizeScoutProviderSpecificAdapterConfig must be a function');
    assert.ok(typeof mod.createScoutProviderSpecificAdapter === 'function', 'createScoutProviderSpecificAdapter must be a function');
  },
});

// ── 3. Adapter is disabled by default ────────────────────────────────────────
tests.push({
  name: 'Adapter is disabled by default',
  fn: async () => {
    const mod = await importAdapter();
    const normalized = mod.normalizeScoutProviderSpecificAdapterConfig({});
    assert.strictEqual(normalized.ok, false);
    assert.strictEqual(normalized.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.DISABLED);
    assert.strictEqual(normalized.error.code, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES.PROVIDER_UNAVAILABLE);

    const adapter = mod.createScoutProviderSpecificAdapter({});
    assert.strictEqual(adapter.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.DISABLED);

    const result = await adapter.suggest({ excerpt: 'test' });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.providerMode, 'live_provider_disabled');
    assert.strictEqual(result.error.code, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES.PROVIDER_UNAVAILABLE);
  },
});

// ── 4. Missing config maps CONFIG_MISSING ─────────────────────────────────────
tests.push({
  name: 'Missing config maps CONFIG_MISSING',
  fn: async () => {
    const mod = await importAdapter();
    const normalized = mod.normalizeScoutProviderSpecificAdapterConfig({ enabled: true });
    assert.strictEqual(normalized.ok, false);
    assert.strictEqual(normalized.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.CONFIG_MISSING);
    assert.strictEqual(normalized.error.code, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES.CONFIG_MISSING);

    const adapter = mod.createScoutProviderSpecificAdapter({ enabled: true });
    assert.strictEqual(adapter.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.CONFIG_MISSING);

    const result = await adapter.suggest({ excerpt: 'test' });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.providerMode, 'live_provider_disabled');
    assert.strictEqual(result.error.code, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES.CONFIG_MISSING);
  },
});

// ── 5. Ready config still disabled/safe-fails ─────────────────────────────────
tests.push({
  name: 'Ready config still disabled/safe-fails',
  fn: async () => {
    const mod = await importAdapter();
    const config = {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-testsecretkeyvalue12345',
    };
    const normalized = mod.normalizeScoutProviderSpecificAdapterConfig(config);
    assert.strictEqual(normalized.ok, true);
    assert.strictEqual(normalized.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.READY_DISABLED);
    assert.strictEqual(normalized.error, null);

    const adapter = mod.createScoutProviderSpecificAdapter(config);
    assert.strictEqual(adapter.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.READY_DISABLED);

    const result = await adapter.suggest({ excerpt: 'test' });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.providerMode, 'live_provider_disabled');
    assert.strictEqual(result.error.code, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES.PROVIDER_UNAVAILABLE);
  },
});

// ── 6. API key value never returned ───────────────────────────────────────────
tests.push({
  name: 'API key value never returned',
  fn: async () => {
    const mod = await importAdapter();
    const secret = 'sk-testsecretkeyvalue12345';
    const config = {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: secret,
    };
    const normalized = mod.normalizeScoutProviderSpecificAdapterConfig(config);
    assert.strictEqual(normalized.hasApiKey, true);
    assert.strictEqual(normalized.apiKey, undefined);

    const keys = Object.keys(normalized);
    for (const key of keys) {
      if (typeof normalized[key] === 'string') {
        assert.ok(!normalized[key].includes(secret), `Key value must not be present in normalized config string fields. Found in: ${key}`);
      }
    }
  },
});

// ── 7. API key value never reaches suggest result ─────────────────────────────
tests.push({
  name: 'API key value never reaches suggest result',
  fn: async () => {
    const mod = await importAdapter();
    const secret = 'sk-testsecretkeyvalue12345';
    const config = {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: secret,
    };
    const adapter = mod.createScoutProviderSpecificAdapter(config);
    const result = await adapter.suggest({ excerpt: 'test' });
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes(secret), 'API key value must not be serialized in suggest result');
  },
});

// ── 8. baseUrl is not fetched ────────────────────────────────────────────────
tests.push({
  name: 'baseUrl is not fetched',
  fn: async () => {
    const mod = await importAdapter();
    const config = {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-testsecret',
      baseUrl: 'https://example-test-api.com/v1',
    };
    const normalized = mod.normalizeScoutProviderSpecificAdapterConfig(config);
    assert.strictEqual(normalized.baseUrl, 'https://example-test-api.com/v1');

    // Code verification
    assert.ok(!adapterCode.includes('fetch(baseUrl'), 'Code should not call fetch on baseUrl');
    assert.ok(!adapterCode.includes('fetch(config.baseUrl'), 'Code should not call fetch on config.baseUrl');
  },
});

// ── 9. No provider SDK imports ───────────────────────────────────────────────
tests.push({
  name: 'No provider SDK imports in production JS',
  fn: () => {
    const sdkKeywords = ['openai', 'anthropic', '@google/generative-ai', 'gemini', 'groq', 'mistral', 'nvidia'];
    const importPatterns = sdkKeywords.map(kw => [
      'require\\([\'"`]' + kw + '[\'"`]\\)',
      'import\\s+.*\\s+from\\s+[\'"`]' + kw + '[\'"`]',
      'import\\([\'"`]' + kw + '[\'"`]\\)',
    ]);

    for (let i = 0; i < sdkKeywords.length; i++) {
      const patterns = importPatterns[i];
      const hasImport = patterns.some(p => new RegExp(p, 'i').test(adapterCode));
      assert.ok(!hasImport, `provider-specific-adapter.js must not import ${sdkKeywords[i]} SDK`);
    }
  },
});

// ── 10. No fetch/XHR/axios ───────────────────────────────────────────────────
tests.push({
  name: 'No fetch/XHR/axios in provider-specific adapter',
  fn: () => {
    assert.ok(
      !adapterCode.includes('fetch(') && !adapterCode.includes('XMLHttpRequest') && !adapterCode.includes('axios'),
      'provider-specific-adapter.js must not contain fetch/XHR/axios'
    );
    assert.ok(
      !liveAdapterCode.includes('XMLHttpRequest') && !liveAdapterCode.includes('axios'),
      'live-provider-adapter.js must not contain XHR/axios'
    );
    assert.ok(
      !suggestCode.includes('XMLHttpRequest') && !suggestCode.includes('axios'),
      'suggest.js must not contain XHR/axios'
    );
  },
});

// ── 11. No executor invocation ────────────────────────────────────────────────
tests.push({
  name: 'No executor invocation',
  fn: async () => {
    const mod = await importAdapter();
    let executorCalled = false;
    const config = {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-testsecret',
      executor: async () => {
        executorCalled = true;
        return {};
      },
    };
    const adapter = mod.createScoutProviderSpecificAdapter(config);
    const result = await adapter.suggest({ excerpt: 'test' });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(executorCalled, false, 'Executor must not be invoked by the provider-specific adapter skeleton');
  },
});

// ── 12. No sourceUrl fetch/crawler/metadata extraction ────────────────────────
tests.push({
  name: 'No sourceUrl fetch/crawler/metadata extraction',
  fn: () => {
    const cleanCode = adapterCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    assert.ok(!cleanCode.includes('crawler'), 'No crawler in provider-specific adapter');
    assert.ok(!cleanCode.includes('metadata'), 'No metadata extraction in provider-specific adapter');
    assert.ok(!cleanCode.includes('fetch'), 'No fetch in provider-specific adapter');
  },
});

// ── 13. No persistence/auto-save ──────────────────────────────────────────────
tests.push({
  name: 'No persistence/auto-save',
  fn: () => {
    const cleanCode = adapterCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    assert.ok(!cleanCode.includes('localStorage'), 'No localStorage in provider-specific adapter');
    assert.ok(!cleanCode.includes('sessionStorage'), 'No sessionStorage in provider-specific adapter');
    assert.ok(!cleanCode.includes('addMemory'), 'No addMemory in provider-specific adapter');
    assert.ok(!cleanCode.includes('save'), 'No save in provider-specific adapter');
  },
});

// ── 14. Endpoint default stub preserved ───────────────────────────────────────
tests.push({
  name: 'Endpoint default stub preserved',
  fn: () => {
    assert.ok(suggestCode.includes("STUB: 'stub'"), 'Stub mode should remain defined in suggest.js');
    assert.ok(suggestCode.includes("providerMode: SCOUT_SUGGEST_PROVIDER_MODES.STUB"), 'suggest.js should default to STUB mode');
  },
});

// ── 15. Frontend default local_stub preserved ───────────────────────────────
tests.push({
  name: 'Frontend default local_stub preserved',
  fn: () => {
    assert.ok(srcSelCode.includes("LOCAL_STUB: 'local_stub'"), 'local_stub should remain defined in source selector');
    assert.ok(srcSelCode.includes("source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB"), 'source selector should default to local_stub');
  },
});

// ── 16. Production readiness docs allow only disabled skeleton ─────────────────
tests.push({
  name: 'Production readiness docs allow only disabled skeleton',
  fn: () => {
    const lowerAuditDoc = auditDocCode.toLowerCase();
    assert.ok(
      lowerAuditDoc.includes('conditional yes') || lowerAuditDoc.includes('conditional_yes') || lowerAuditDoc.includes('conditional-yes'),
      'Audit doc must keep conditional yes verdict for first adapter skeleton'
    );
    assert.ok(
      lowerAuditDoc.includes('staging_live execution') && lowerAuditDoc.includes('no'),
      'Audit doc must block staging_live execution'
    );
    assert.ok(
      lowerAuditDoc.includes('production_live execution') && lowerAuditDoc.includes('no'),
      'Audit doc must block production_live execution'
    );
  },
});

// ── 17. Docs updated ──────────────────────────────────────────────────────────
tests.push({
  name: 'Docs updated with provider-specific adapter skeleton status',
  fn: () => {
    let referencesAudit = false;
    for (const doc of RELATED_DOCS) {
      const docPath = path.join(ROOT, 'docs/product', doc);
      const content = readFileSafe(docPath).toLowerCase();
      if (content.includes('provider-specific adapter') || content.includes('adapter skeleton')) {
        referencesAudit = true;
      }
    }
    assert.ok(referencesAudit, 'At least one document must mention the provider-specific adapter skeleton');
  },
});

// ── Run tests ────────────────────────────────────────────────────────────────
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
      console.log(err.stack);
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
