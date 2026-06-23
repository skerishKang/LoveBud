/**
 * Scout Provider-Specific Adapter Selection Boundary Contract Tests
 * v20260607-2
 *
 * Contract tests verifying the provider-specific adapter selection boundary:
 * - selection exports exist
 * - inert registry contains only neutral/example provider names
 * - no real provider names in the registry
 * - missing config maps CONFIG_MISSING
 * - unknown provider safe-fails with PROVIDER_UNAVAILABLE
 * - known provider selects a disabled adapter
 * - ready config still safe-fails
 * - API key value never returned or propagated
 * - no executor invocation
 * - no SDK import, no fetch/XHR/axios
 * - no sourceUrl fetch / crawler / metadata extraction
 * - no persistence / auto-save
 * - endpoint default stub preserved
 * - frontend default local_stub preserved
 * - docs updated
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
var scoutEnvGuard = require('./_scout-env-guard.cjs');

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

async function importAdapter() {
  const module = await scoutEnvGuard.safeImport(ADAPTER_PATH);
  return module;
}

const tests = [];

// ── 1. Selection exports exist ───────────────────────────────────────────────
tests.push({
  name: 'Selection boundary exports expected constants and functions',
  fn: async () => {
    const mod = await importAdapter();
    assert.ok(
      mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS,
      'SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS must be exported'
    );
    assert.ok(
      mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_ERROR_CODES,
      'SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_ERROR_CODES must be exported'
    );
    assert.strictEqual(
      typeof mod.getScoutProviderSpecificAdapterRegistry,
      'function',
      'getScoutProviderSpecificAdapterRegistry must be a function'
    );
    assert.strictEqual(
      typeof mod.selectScoutProviderSpecificAdapter,
      'function',
      'selectScoutProviderSpecificAdapter must be a function'
    );
  },
});

// ── 2. Selection status values are spec-defined ──────────────────────────────
tests.push({
  name: 'Selection status values match spec (config_missing / unknown_provider / selected_disabled)',
  fn: async () => {
    const mod = await importAdapter();
    const s = mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS;
    assert.ok(s.CONFIG_MISSING, 'CONFIG_MISSING status required');
    assert.ok(s.UNKNOWN_PROVIDER, 'UNKNOWN_PROVIDER status required');
    assert.ok(s.SELECTED_DISABLED, 'SELECTED_DISABLED status required');
    assert.strictEqual(s.CONFIG_MISSING, 'config_missing');
    assert.strictEqual(s.UNKNOWN_PROVIDER, 'unknown_provider');
    assert.strictEqual(s.SELECTED_DISABLED, 'selected_disabled');
  },
});

// ── 3. Selection error codes are spec-defined ────────────────────────────────
tests.push({
  name: 'Selection error codes match spec (PROVIDER_UNAVAILABLE / CONFIG_MISSING)',
  fn: async () => {
    const mod = await importAdapter();
    const e = mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_ERROR_CODES;
    assert.strictEqual(e.PROVIDER_UNAVAILABLE, 'PROVIDER_UNAVAILABLE');
    assert.strictEqual(e.CONFIG_MISSING, 'CONFIG_MISSING');
  },
});

// ── 4. Registry is inert and frozen ──────────────────────────────────────────
tests.push({
  name: 'Registry is a frozen inert object',
  fn: async () => {
    const mod = await importAdapter();
    const r1 = mod.getScoutProviderSpecificAdapterRegistry();
    const r2 = mod.getScoutProviderSpecificAdapterRegistry();
    assert.strictEqual(typeof r1, 'object');
    assert.notStrictEqual(r1, null);
    assert.ok(Object.isFrozen(r1), 'Registry must be frozen');
    assert.deepStrictEqual(Object.keys(r1).sort(), Object.keys(r2).sort());
  },
});

// ── 5. Registry contains only neutral/example provider names ────────────────
tests.push({
  name: 'Registry contains only neutral/example provider names (no real provider names)',
  fn: async () => {
    const mod = await importAdapter();
    const registry = mod.getScoutProviderSpecificAdapterRegistry();
    const names = Object.keys(registry);
    assert.ok(names.length >= 1, 'Registry must contain at least one entry');

    const forbiddenRealNames = [
      'openai', 'anthropic', '@anthropic', '@google/generative-ai',
      'gemini', 'groq', 'mistral', 'nvidia',
      'claude', 'gpt', 'llama', 'grok',
    ];
    for (const forbidden of forbiddenRealNames) {
      for (const name of names) {
        assert.ok(
          !name.toLowerCase().includes(forbidden),
          `Registry must not contain real provider name "${forbidden}" (found: ${name})`
        );
      }
    }
  },
});

// ── 6. Registry values are factory functions ─────────────────────────────────
tests.push({
  name: 'Registry values are factory functions',
  fn: async () => {
    const mod = await importAdapter();
    const registry = mod.getScoutProviderSpecificAdapterRegistry();
    for (const [name, factory] of Object.entries(registry)) {
      assert.strictEqual(
        typeof factory,
        'function',
        `Registry entry "${name}" must be a function`
      );
    }
  },
});

// ── 7. No config → CONFIG_MISSING (because provider missing) ─────────────────
tests.push({
  name: 'No config maps CONFIG_MISSING (provider missing)',
  fn: async () => {
    const mod = await importAdapter();
    const result = mod.selectScoutProviderSpecificAdapter({});
    assert.strictEqual(
      result.status,
      mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.CONFIG_MISSING
    );
    assert.strictEqual(result.adapter, null);
    assert.strictEqual(
      result.error.code,
      mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_ERROR_CODES.CONFIG_MISSING
    );
  },
});

// ── 8. Missing provider model/apikey → CONFIG_MISSING ───────────────────────
tests.push({
  name: 'Enabled but missing model / API key presence maps CONFIG_MISSING',
  fn: async () => {
    const mod = await importAdapter();
    const r = mod.selectScoutProviderSpecificAdapter({
      enabled: true,
      provider: 'example_provider',
    });
    assert.strictEqual(
      r.status,
      mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.CONFIG_MISSING
    );
    assert.strictEqual(r.adapter, null);
  },
});

// ── 9. Unknown provider → UNKNOWN_PROVIDER + PROVIDER_UNAVAILABLE ────────────
tests.push({
  name: 'Unknown provider name maps UNKNOWN_PROVIDER with PROVIDER_UNAVAILABLE',
  fn: async () => {
    const mod = await importAdapter();
    const cases = [
      'openai', 'anthropic', 'gemini', 'groq',
      'mistral', 'nvidia', 'random-provider', 'some-fake-vendor',
    ];
    for (const provider of cases) {
      const r = mod.selectScoutProviderSpecificAdapter({
        enabled: true,
        provider,
        model: 'some-model',
        apiKey: 'sk-presence',
      });
      assert.strictEqual(
        r.status,
        mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.UNKNOWN_PROVIDER,
        `Unknown provider "${provider}" must map to UNKNOWN_PROVIDER`
      );
      assert.strictEqual(r.adapter, null);
      assert.strictEqual(
        r.error.code,
        mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_ERROR_CODES.PROVIDER_UNAVAILABLE
      );
    }
  },
});

// ── 10. Known example_provider → SELECTED_DISABLED with disabled adapter ─────
tests.push({
  name: 'Known example_provider maps SELECTED_DISABLED with disabled adapter',
  fn: async () => {
    const mod = await importAdapter();
    const r = mod.selectScoutProviderSpecificAdapter({
      enabled: true,
      provider: 'example_provider',
      model: 'example-model',
      apiKey: 'sk-presence',
    });
    assert.strictEqual(
      r.status,
      mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.SELECTED_DISABLED
    );
    assert.ok(r.adapter, 'Adapter must be returned for selected disabled provider');
    assert.strictEqual(r.adapter.status, mod.SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.READY_DISABLED);
    assert.strictEqual(r.error, null);
  },
});

// ── 11. Selected adapter safe-fails without real provider call ──────────────
tests.push({
  name: 'Selected adapter safe-fails without real provider call',
  fn: async () => {
    const mod = await importAdapter();
    const r = mod.selectScoutProviderSpecificAdapter({
      enabled: true,
      provider: 'example_provider',
      model: 'example-model',
      apiKey: 'sk-presence',
    });
    const result = await r.adapter.suggest({ excerpt: 'test' });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.providerMode, 'live_provider_disabled');
    assert.strictEqual(result.error.code, 'PROVIDER_UNAVAILABLE');
  },
});

// ── 12. API key value never appears in selection result ─────────────────────
tests.push({
  name: 'API key value never appears in selection result JSON',
  fn: async () => {
    const mod = await importAdapter();
    const secret = 'sk-secret-key-value-never-return-this-1234567890';
    const r = mod.selectScoutProviderSpecificAdapter({
      enabled: true,
      provider: 'example_provider',
      model: 'example-model',
      apiKey: secret,
    });
    const serialized = JSON.stringify(r);
    assert.ok(!serialized.includes(secret), 'API key value must not appear in selection result JSON');
  },
});

// ── 13. API key value never reaches selected adapter result ─────────────────
tests.push({
  name: 'API key value never reaches selected adapter.suggest() result',
  fn: async () => {
    const mod = await importAdapter();
    const secret = 'sk-secret-key-value-never-return-this-1234567890';
    const r = mod.selectScoutProviderSpecificAdapter({
      enabled: true,
      provider: 'example_provider',
      model: 'example-model',
      apiKey: secret,
    });
    const adapterResult = await r.adapter.suggest({ excerpt: 'test' });
    const serialized = JSON.stringify(adapterResult);
    assert.ok(!serialized.includes(secret), 'API key must not appear in adapter.suggest() result');
  },
});

// ── 14. No executor invocation in selection or selected adapter ──────────────
tests.push({
  name: 'No executor invocation: passing config.executor must not be called',
  fn: async () => {
    const mod = await importAdapter();
    let executorCalled = false;
    const r = mod.selectScoutProviderSpecificAdapter({
      enabled: true,
      provider: 'example_provider',
      model: 'example-model',
      apiKey: 'sk-presence',
      executor: async () => {
        executorCalled = true;
        return { ok: true };
      },
    });
    await r.adapter.suggest({ excerpt: 'test' });
    assert.strictEqual(executorCalled, false, 'Executor must not be invoked by selection or selected adapter');
  },
});

// ── 15. baseUrl is not fetched ───────────────────────────────────────────────
tests.push({
  name: 'baseUrl is preserved as a string only and not fetched',
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

// ── 16. No provider SDK imports in production JS ────────────────────────────
tests.push({
  name: 'No provider SDK imports in provider-specific-adapter.js',
  fn: () => {
    const sdkKeywords = [
      'openai', 'anthropic', '@anthropic', '@google/generative-ai',
      'gemini', 'groq-sdk', 'mistral', 'nvidia',
    ];
    for (const kw of sdkKeywords) {
      const patterns = [
        new RegExp(`require\\(['"\`]${kw}['"\`]`, 'i'),
        new RegExp(`from ['"\`]${kw}['"\`]`, 'i'),
        new RegExp(`import\\(['"\`]${kw}['"\`)]`, 'i'),
      ];
      for (const p of patterns) {
        assert.ok(
          !p.test(adapterCode),
          `provider-specific-adapter.js must not import ${kw} SDK`
        );
      }
    }
  },
});

// ── 17. No sourceUrl fetch / crawler / metadata extraction ───────────────────
tests.push({
  name: 'No sourceUrl fetch / crawler / metadata extraction',
  fn: () => {
    const cleanCode = adapterCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    assert.ok(!cleanCode.includes('crawler'), 'No crawler in provider-specific adapter');
    assert.ok(!cleanCode.includes('metadataExtract'), 'No metadataExtract in provider-specific adapter');
    assert.ok(!cleanCode.includes('cheerio'), 'No cheerio in provider-specific adapter');
    assert.ok(!cleanCode.includes('jsdom'), 'No jsdom in provider-specific adapter');
    assert.ok(!cleanCode.includes('sourceUrl'), 'No sourceUrl reference in provider-specific adapter');
    assert.ok(!cleanCode.includes('fetch('), 'No fetch in provider-specific adapter');
  },
});

// ── 18. No persistence / auto-save ───────────────────────────────────────────
tests.push({
  name: 'No persistence or auto-save',
  fn: () => {
    const cleanCode = adapterCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    assert.ok(!cleanCode.includes('localStorage'), 'No localStorage in provider-specific adapter');
    assert.ok(!cleanCode.includes('sessionStorage'), 'No sessionStorage in provider-specific adapter');
    assert.ok(!cleanCode.includes('addMemory'), 'No addMemory in provider-specific adapter');
    assert.ok(!cleanCode.includes('autoSave'), 'No autoSave in provider-specific adapter');
    assert.ok(!cleanCode.includes('indexedDB'), 'No indexedDB in provider-specific adapter');
  },
});

// ── 19. Endpoint default stub preserved ──────────────────────────────────────
tests.push({
  name: 'Endpoint default stub preserved (suggest.js)',
  fn: () => {
    assert.ok(
      suggestCode.includes("STUB: 'stub'"),
      'Stub mode should remain defined in suggest.js'
    );
    assert.ok(
      suggestCode.includes("providerMode: SCOUT_SUGGEST_PROVIDER_MODES.STUB"),
      'suggest.js should default to STUB mode'
    );
    assert.ok(
      !suggestCode.includes('selectScoutProviderSpecificAdapter'),
      'suggest.js must not import selectScoutProviderSpecificAdapter'
    );
    assert.ok(
      !suggestCode.includes('getScoutProviderSpecificAdapterRegistry'),
      'suggest.js must not import getScoutProviderSpecificAdapterRegistry'
    );
  },
});

// ── 20. Frontend default local_stub preserved ────────────────────────────────
tests.push({
  name: 'Frontend default local_stub preserved',
  fn: () => {
    assert.ok(
      srcSelCode.includes("LOCAL_STUB: 'local_stub'"),
      'local_stub should remain defined in source selector'
    );
    assert.ok(
      srcSelCode.includes("source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB"),
      'source selector should default to local_stub'
    );
  },
});

// ── 21. Audit doc allows only the disabled skeleton + selection boundary ────
tests.push({
  name: 'Audit doc still allows only disabled skeleton (selection boundary is consistent)',
  fn: () => {
    const ad = auditDocCode.toLowerCase();
    assert.ok(
      ad.includes('conditional yes') || (ad.includes('ready for first') && ad.includes('conditional')),
      'audit doc must still say Conditional Yes for first provider-specific adapter skeleton'
    );
    assert.ok(
      ad.includes('staging_live execution') && ad.includes('no'),
      'audit doc must block staging_live execution'
    );
    assert.ok(
      ad.includes('production_live execution') && ad.includes('no'),
      'audit doc must block production_live execution'
    );
  },
});

// ── 22. Docs updated with provider-specific adapter selection boundary ─────
tests.push({
  name: 'Docs updated with provider-specific adapter selection boundary status',
  fn: () => {
    const updatedDocs = RELATED_DOCS
      .map(f => readFileSafe(path.join(ROOT, 'docs/product', f)).toLowerCase());
    const mentionPatterns = [
      'provider-specific adapter selection boundary',
      'provider specific adapter selection',
      'selection boundary',
      'selection/routing',
      'adapter selection boundary',
    ];
    const found = updatedDocs.some(c =>
      mentionPatterns.some(p => c.includes(p))
    );
    assert.ok(
      found,
      'At least one related doc must mention the provider-specific adapter selection boundary status'
    );
  },
});

// ── 23. Audit doc itself reflects the selection boundary status ─────────────
tests.push({
  name: 'Audit doc itself reflects the selection boundary status',
  fn: () => {
    const ad = auditDocCode.toLowerCase();
    const mentionPatterns = [
      'provider-specific adapter selection boundary',
      'selection boundary',
      'adapter selection',
    ];
    const found = mentionPatterns.some(p => ad.includes(p));
    assert.ok(
      found,
      'audit doc should reflect provider-specific adapter selection boundary status'
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
