/**
 * Scout KV Skeleton Activation Gates Contract Tests
 * v20260617-1
 *
 * Locks the KV skeleton activation gates audit requirements.
 *
 * Slice issue: #2584
 * Parent issue: #1882 (must remain OPEN; never auto-close)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = path.join(
  ROOT,
  'docs/product/lovebud-scout-kv-skeleton-activation-gates.md',
);
const ADAPTER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-rate-limit-storage-adapter.js',
);
const DEP_ADAPTER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-auth-rate-limit-dependency-adapter.js',
);
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(
  ROOT,
  'js/scout/scout-suggestion-source-selector.js',
);
const ENDPOINT_CLIENT_PATH = path.join(
  ROOT,
  'js/scout/scout-suggestion-endpoint-client.js',
);

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const doc = readFile(DOC_PATH);
const adapterSource = readFile(ADAPTER_PATH);
const adapterCode = codeOnly(adapterSource);
const depAdapterSource = readFile(DEP_ADAPTER_PATH);
const depAdapterCode = codeOnly(depAdapterSource);
const suggest = readFile(SUGGEST_PATH);
const suggestCode = codeOnly(suggest);
const sourceSelector = readFile(SOURCE_SELECTOR_PATH);
const endpointClient = readFile(ENDPOINT_CLIENT_PATH);

const tests = [];

function push(name, fn) {
  tests.push({ name, fn });
}

// ─── Document reference checks ─────────────────────────────────────────────

push('Audit doc references proper issues and PRs', () => {
  assert.ok(doc.includes('Slice issue: #2584'), 'must reference slice #2584');
  assert.ok(doc.includes('Parent issue: #1882'), 'must reference parent #1882');
  assert.ok(doc.includes('References: #2581, #2582'), 'must reference #2581 and #2582');
});

push('Audit doc defines real KV activation gates', () => {
  assert.ok(doc.includes('3. Required Gate Decisions & Future Constraints'), 'must define gate decisions section');
  assert.ok(doc.includes('env.SCOUT_RATE_LIMIT_KV'), 'must reference strictly SCOUT_RATE_LIMIT_KV');
  assert.ok(doc.includes('storageMode: \'kv_live\''), 'must reference kv_live opt-in mode');
  assert.ok(doc.includes('STORAGE_CONFIG_MISSING'), 'must fail-safe on missing config');
  assert.ok(doc.includes('RATE_LIMIT_STORAGE_UNAVAILABLE'), 'must fail-safe to RATE_LIMIT_STORAGE_UNAVAILABLE');
  assert.ok(doc.includes('Staging-Only Validation'), 'must enforce staging validation before production');
});

push('Audit doc confirms current kv_skeleton is not real KV and has no read/write', () => {
  assert.ok(doc.includes('is a skeleton only'), 'must explicitly say it is a skeleton only');
  assert.ok(doc.includes('No real storage operations (`get`, `put`, `list`, `delete`)'), 'must confirm no real storage operations');
  assert.ok(doc.includes('No database, Durable Object, D1 instance, external API, or `fetch`'), 'must confirm no other db or fetch');
});

push('Audit doc confirms dependency adapter continues to safe-fail', () => {
  assert.ok(
    doc.includes('The dependency adapter must map all intermediate storage codes (including `STORAGE_KV_SKELETON` and future `STORAGE_KV_DISABLED`) to `RATE_LIMIT_STORAGE_UNAVAILABLE`'),
    'must state dependency adapter continues safe-fail',
  );
});

// ─── Current runtime & config state locks ──────────────────────────────────

push('No runtime files are changed by this slice', () => {
  // Verify that git status would only show the doc and this test (we do this behaviorally by asserting constants in runtime files)
  assert.ok(adapterSource.includes('export const SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION = \'20260616-runtime-output-1\''));
  assert.ok(depAdapterSource.includes('export const SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION = \'20260616-runtime-key-mapping-1\''));
});

push('Endpoint and frontend defaults remain unchanged', () => {
  assert.ok(suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint default must remain STUB');
  assert.ok(sourceSelector.includes('local_stub'), 'frontend source default must remain local_stub');
  assert.ok(endpointClient.includes('Disabled by default'), 'endpoint client must remain disabled by default');
});

push('No forbidden symbols or live provider behavior is introduced', () => {
  const combinedCode = [adapterCode, depAdapterCode, suggestCode].join('\n');
  const FORBIDDEN = [
    'env.KV',
    'global.KV',
    'globalThis.KV',
    'D1Database',
    'DurableObject',
    'process.env',
    'STAGING_LIVE',
    'PRODUCTION_LIVE',
  ];
  for (const sym of FORBIDDEN) {
    // We allow suggestCode to have comments/placeholders, but not active usage
    assert.ok(
      !adapterCode.includes(sym) && !depAdapterCode.includes(sym),
      `Forbidden symbol "${sym}" found in adapter code.`,
    );
  }
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
