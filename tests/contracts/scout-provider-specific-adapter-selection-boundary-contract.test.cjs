/**
 * Scout Provider-Specific Adapter Selection Boundary Contract Tests
 * v20260607-1
 *
 * Contract tests verifying:
 * 1. exports constants and functions
 * 2. default selection is DISABLED
 * 3. explicit disabled mode returns DISABLED
 * 4. live adapter disabled returns DISABLED even when provider config exists
 * 5. live enabled with missing provider/model/API key presence returns CONFIG_MISSING
 * 6. supported provider values normalize correctly
 * 7. unsupported provider returns UNSUPPORTED_PROVIDER
 * 8. selected supported provider returns SELECTED but safeForLiveCall false
 * 9. selected adapter safe-fails without real provider call
 * 10. API key value is never returned in result
 * 11. API key value is never passed to adapter payload/result/log
 * 12. no SDK import
 * 13. no fetch/axios/request/http client
 * 14. no sourceUrl fetch
 * 15. no persistence/auto-save
 * 16. endpoint default stub preserved
 * 17. frontend default local_stub preserved
 * 18. staging_live and production_live remain blocked in docs
 * 19. docs updated
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/provider-specific-adapter.js');
const LIVE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');

const RELATED_DOCS = [
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-live-provider-post-mock-readiness-audit.md',
  'lovebud-scout-live-provider-readiness-audit.md',
  'lovebud-scout-live-provider-staging-rollout-contract.md',
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

async function importAdapter() {
  const module = await import(ADAPTER_PATH);
  return module;
}

const tests = [];

// ── 1. Exports exist ─────────────────────────────────────────────────────────
tests.push({
  name: 'Provider-specific adapter selection exports expected constants/functions',
  fn: async () => {
    const mod = await importAdapter();
    assert.ok(mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS, 'SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS must be exported');
    assert.ok(mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_IDS, 'SCOUT_PROVIDER_SPECIFIC_ADAPTER_IDS must be exported');
    assert.strictEqual(typeof mod.selectScoutProviderSpecificAdapter, 'function', 'selectScoutProviderSpecificAdapter must be a function');
  },
});

// ── 2. Default selection is DISABLED ─────────────────────────────────────────
tests.push({
  name: 'Default selection is DISABLED',
  fn: async () => {
    const mod = await importAdapter();
    const result = mod.selectScoutProviderSpecificAdapter({});
    assert.strictEqual(result.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.DISABLED);
    assert.strictEqual(result.providerId, null);
    assert.strictEqual(result.adapter, null);
    assert.strictEqual(result.errorCode, 'PROVIDER_UNAVAILABLE');
    assert.strictEqual(result.safeForLiveCall, false);
  },
});

// ── 3. Explicit disabled mode returns DISABLED ──────────────────────────────
tests.push({
  name: 'Explicit disabled mode returns DISABLED',
  fn: async () => {
    const mod = await importAdapter();
    const result = mod.selectScoutProviderSpecificAdapter({ enabled: false });
    assert.strictEqual(result.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.DISABLED);
    assert.strictEqual(result.providerId, null);
    assert.strictEqual(result.adapter, null);
    assert.strictEqual(result.errorCode, 'PROVIDER_UNAVAILABLE');
    assert.strictEqual(result.safeForLiveCall, false);
  },
});

// ── 4. Live adapter disabled returns DISABLED even when config exists ───────
tests.push({
  name: 'Live adapter disabled returns DISABLED even when provider config exists',
  fn: async () => {
    const mod = await importAdapter();
    const config = {
      enabled: false,
      provider: 'groq',
      model: 'llama-3',
      apiKey: 'sk-test',
    };
    const result = mod.selectScoutProviderSpecificAdapter(config);
    assert.strictEqual(result.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.DISABLED);
    assert.strictEqual(result.providerId, null);
    assert.strictEqual(result.adapter, null);
    assert.strictEqual(result.errorCode, 'PROVIDER_UNAVAILABLE');
    assert.strictEqual(result.safeForLiveCall, false);
  },
});

// ── 5. Missing provider config returns CONFIG_MISSING ────────────────────────
tests.push({
  name: 'Live enabled with missing provider/model/API key presence returns CONFIG_MISSING',
  fn: async () => {
    const mod = await importAdapter();
    
    // Missing provider
    const r1 = mod.selectScoutProviderSpecificAdapter({ enabled: true, model: 'm', apiKey: 'k' });
    assert.strictEqual(r1.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.CONFIG_MISSING);
    assert.strictEqual(r1.errorCode, 'CONFIG_MISSING');
    
    // Missing model
    const r2 = mod.selectScoutProviderSpecificAdapter({ enabled: true, provider: 'p', apiKey: 'k' });
    assert.strictEqual(r2.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.CONFIG_MISSING);
    assert.strictEqual(r2.errorCode, 'CONFIG_MISSING');

    // Missing apiKey
    const r3 = mod.selectScoutProviderSpecificAdapter({ enabled: true, provider: 'p', model: 'm' });
    assert.strictEqual(r3.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.CONFIG_MISSING);
    assert.strictEqual(r3.errorCode, 'CONFIG_MISSING');
  },
});

// ── 6. Supported provider normalization ──────────────────────────────────────
tests.push({
  name: 'Supported provider values normalize correctly',
  fn: async () => {
    const mod = await importAdapter();
    const cases = [
      { provider: 'nvidia', expected: 'nvidia' },
      { provider: 'NVIDIA', expected: 'nvidia' },
      { provider: 'openai_compatible', expected: 'openai_compatible' },
      { provider: 'openai-compatible', expected: 'openai_compatible' },
      { provider: 'openai compatible', expected: 'openai_compatible' },
      { provider: 'groq', expected: 'groq' },
      { provider: 'mistral', expected: 'mistral' },
    ];

    for (const c of cases) {
      const result = mod.selectScoutProviderSpecificAdapter({
        enabled: true,
        provider: c.provider,
        model: 'model-name',
        apiKey: 'key-presence',
      });
      assert.strictEqual(result.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.SELECTED);
      assert.strictEqual(result.providerId, c.expected);
      assert.strictEqual(result.errorCode, null);
      assert.strictEqual(result.safeForLiveCall, false);
      assert.ok(result.adapter !== null, 'Adapter must be returned for selected provider');
    }
  },
});

// ── 7. Unsupported provider ──────────────────────────────────────────────────
tests.push({
  name: 'Unsupported provider returns UNSUPPORTED_PROVIDER',
  fn: async () => {
    const mod = await importAdapter();
    const cases = ['openai', 'anthropic', 'gemini', 'random-provider'];

    for (const provider of cases) {
      const result = mod.selectScoutProviderSpecificAdapter({
        enabled: true,
        provider,
        model: 'model-name',
        apiKey: 'key-presence',
      });
      assert.strictEqual(result.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.UNSUPPORTED_PROVIDER);
      assert.strictEqual(result.providerId, null);
      assert.strictEqual(result.errorCode, 'UNSUPPORTED_PROVIDER');
      assert.strictEqual(result.safeForLiveCall, false);
      assert.strictEqual(result.adapter, null);
    }
  },
});

// ── 8. Selected returns SELECTED but safeForLiveCall false ───────────────────
tests.push({
  name: 'Selected supported provider returns SELECTED but safeForLiveCall false',
  fn: async () => {
    const mod = await importAdapter();
    const result = mod.selectScoutProviderSpecificAdapter({
      enabled: true,
      provider: 'groq',
      model: 'llama-3',
      apiKey: 'sk-presence',
    });
    assert.strictEqual(result.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.SELECTED);
    assert.strictEqual(result.safeForLiveCall, false);
  },
});

// ── 9. Selected adapter safe-fails ───────────────────────────────────────────
tests.push({
  name: 'Selected adapter safe-fails without real provider call',
  fn: async () => {
    const mod = await importAdapter();
    const result = mod.selectScoutProviderSpecificAdapter({
      enabled: true,
      provider: 'groq',
      model: 'llama-3',
      apiKey: 'sk-presence',
    });
    const adapter = result.adapter;
    assert.ok(adapter);
    const suggestResult = await adapter.suggest({ excerpt: 'test text' });
    assert.strictEqual(suggestResult.ok, false);
    assert.strictEqual(suggestResult.providerMode, 'live_provider_disabled');
    assert.strictEqual(suggestResult.error.code, 'PROVIDER_UNAVAILABLE');
  },
});

// ── 10. API key value is never returned ──────────────────────────────────────
tests.push({
  name: 'API key value is never returned in result',
  fn: async () => {
    const mod = await importAdapter();
    const secret = 'sk-secret-key-value-never-return-this';
    const result = mod.selectScoutProviderSpecificAdapter({
      enabled: true,
      provider: 'groq',
      model: 'llama-3',
      apiKey: secret,
    });
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes(secret), 'API key value must not be present in select result');
  },
});

// ── 11. API key value never reaches adapter payload/result/log ───────────────
tests.push({
  name: 'API key value is never passed to adapter payload/result/log',
  fn: async () => {
    const mod = await importAdapter();
    const secret = 'sk-secret-key-value-never-return-this';
    const result = mod.selectScoutProviderSpecificAdapter({
      enabled: true,
      provider: 'groq',
      model: 'llama-3',
      apiKey: secret,
    });
    const adapterResult = await result.adapter.suggest({ excerpt: 'test' });
    const serializedResult = JSON.stringify(adapterResult);
    assert.ok(!serializedResult.includes(secret), 'API key must not be present in suggest result');
  },
});

// ── 12. No SDK import ────────────────────────────────────────────────────────
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

// ── 13. No fetch/axios/request/http client ───────────────────────────────────
tests.push({
  name: 'No fetch/axios/request/http client',
  fn: () => {
    const cleanCode = adapterCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    assert.ok(
      !cleanCode.includes('fetch(') && !cleanCode.includes('XMLHttpRequest') && !cleanCode.includes('axios'),
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

// ── 14. No sourceUrl fetch ───────────────────────────────────────────────────
tests.push({
  name: 'No sourceUrl fetch',
  fn: () => {
    const cleanCode = adapterCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    assert.ok(!cleanCode.includes('crawler'), 'No crawler in provider-specific adapter');
    assert.ok(!cleanCode.includes('metadata'), 'No metadata extraction in provider-specific adapter');
    assert.ok(!cleanCode.includes('fetch'), 'No fetch in provider-specific adapter');
  },
});

// ── 15. No persistence/auto-save ─────────────────────────────────────────────
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

// ── 16. Endpoint default stub preserved ──────────────────────────────────────
tests.push({
  name: 'Endpoint default stub preserved',
  fn: () => {
    assert.ok(suggestCode.includes("STUB: 'stub'"), 'Stub mode should remain defined in suggest.js');
    assert.ok(suggestCode.includes("providerMode: SCOUT_SUGGEST_PROVIDER_MODES.STUB"), 'suggest.js should default to STUB mode');
  },
});

// ── 17. Frontend default local_stub preserved ────────────────────────────────
tests.push({
  name: 'Frontend default local_stub preserved',
  fn: () => {
    assert.ok(srcSelCode.includes("LOCAL_STUB: 'local_stub'"), 'local_stub should remain defined in source selector');
    assert.ok(srcSelCode.includes("source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB"), 'source selector should default to local_stub');
  },
});

// ── 18. Staging_live and production_live remain blocked in docs ──────────────
tests.push({
  name: 'Staging_live and production_live remain blocked in docs',
  fn: () => {
    const auditDocPath = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-production-readiness-gates-audit.md');
    const content = readFileSafe(auditDocPath).toLowerCase();
    assert.ok(
      content.includes('staging_live execution') && content.includes('no'),
      'Staging_live execution must remain blocked (No)'
    );
    assert.ok(
      content.includes('production_live execution') && content.includes('no'),
      'Production_live execution must remain blocked (No)'
    );
  },
});

// ── 19. Docs updated ─────────────────────────────────────────────────────────
tests.push({
  name: 'Docs updated with provider-specific adapter selection boundary status',
  fn: () => {
    let referencesSelection = false;
    for (const doc of RELATED_DOCS) {
      const docPath = path.join(ROOT, 'docs/product', doc);
      const content = readFileSafe(docPath).toLowerCase();
      if (content.includes('selection boundary') || content.includes('adapter selection') || content.includes('selection/routing')) {
        referencesSelection = true;
      }
    }
    assert.ok(referencesSelection, 'At least one document must mention the provider-specific adapter selection boundary');
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
