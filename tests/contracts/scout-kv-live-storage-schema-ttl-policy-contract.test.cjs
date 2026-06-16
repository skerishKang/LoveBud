/**
 * Scout KV Live Storage Schema and TTL Policy Contract Tests
 * v20260617-1
 *
 * Locks the KV storage schema, prefix, value shapes, and TTL policy requirements.
 *
 * Slice issue: #2586
 * Parent issue: #1882 (must remain OPEN; never auto-close)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = path.join(
  ROOT,
  'docs/product/lovebud-scout-kv-live-storage-schema-ttl-policy.md',
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

push('Audit doc references proper issues and prior gate docs', () => {
  assert.ok(doc.includes('Slice issue: #2586'), 'must reference slice #2586');
  assert.ok(doc.includes('Parent issue: #1882'), 'must reference parent #1882');
  assert.ok(doc.includes('References: #2584, #2585'), 'must reference #2584 and #2585');
  assert.ok(doc.includes('lovebud-scout-kv-skeleton-activation-gates.md'), 'must reference prior activation gates doc');
});

push('Audit doc defines KV Key Schema constraints', () => {
  assert.ok(doc.includes('scout:rl:v1:'), 'must define namespace prefix scout:rl:v1:');
  assert.ok(doc.includes('userKeyHash'), 'must list userKeyHash as allowed key component');
  assert.ok(doc.includes('ipHash'), 'must list ipHash as allowed key component');
  assert.ok(doc.includes('sessionKeyHash'), 'must list sessionKeyHash as allowed key component');
  assert.ok(doc.includes('endpointPath'), 'must list endpointPath as allowed key component');
  assert.ok(doc.includes('providerMode'), 'must list providerMode as allowed key component');
  assert.ok(doc.includes('limitName'), 'must list limitName as allowed key component');
  assert.ok(doc.includes('windowKey'), 'must list windowKey as allowed key component');
});

push('Audit doc defines KV Value Schema and exception handling', () => {
  assert.ok(doc.includes('JSON object'), 'value must be JSON object');
  assert.ok(doc.includes('allowed'), 'must list allowed as allowed value field');
  assert.ok(doc.includes('remaining'), 'must list remaining as allowed value field');
  assert.ok(doc.includes('resetTimeMs'), 'must list resetTimeMs as allowed value field');
  assert.ok(doc.includes('reason'), 'must list reason as allowed value field');
  assert.ok(doc.includes('schemaVersion'), 'must list schemaVersion as allowed value field');
  assert.ok(doc.includes('RATE_LIMIT_STORAGE_UNAVAILABLE'), 'must map malformed/exception values to RATE_LIMIT_STORAGE_UNAVAILABLE');

  // Added safety checks for missing/untrusted values:
  assert.ok(doc.includes('must not be treated as an unconditional automatic allow'), 'must assert no automatic allow for missing records');
  assert.ok(doc.includes('first-use quota record'), 'must mention first-use quota record initialization conditions');
  assert.ok(doc.includes('explicit real-KV activation gate'), 'must mention explicit real-KV activation gate requirements');
  assert.ok(!doc.includes('return an allowed state'), 'must not contain unsafe return an allowed state phrase');
});

push('Audit doc defines TTL boundaries and freshness checks', () => {
  assert.ok(doc.includes('60 seconds'), 'minimum TTL must be 60 seconds');
  assert.ok(doc.includes('86400 seconds'), 'maximum TTL must be 86400 seconds (24 hours)');
  assert.ok(doc.includes('Freshness Verification'), 'must verify timestamp locally even if KV returns record');
  assert.ok(doc.includes('TTL Failures'), 'must handle TTL failures via safe-fail');
});

push('Audit doc defines Privacy and No-Leak constraints', () => {
  assert.ok(doc.includes('5. Privacy & No-Leak Rules'), 'must contain privacy and no-leak rules section');
  assert.ok(doc.includes('Raw auth tokens'), 'no raw auth tokens allowed');
  assert.ok(doc.includes('Prompt text'), 'no prompt text allowed');
  assert.ok(doc.includes('Raw user identifiers'), 'no raw user identifiers allowed');
  assert.ok(doc.includes('Full KV keys in client-visible'), 'no full KV keys in client responses');
});

// ─── Current runtime & config state locks ──────────────────────────────────

push('No runtime files are changed by this slice', () => {
  // Confirm versions have not changed
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
    'env.SCOUT_RATE_LIMIT_KV',
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
