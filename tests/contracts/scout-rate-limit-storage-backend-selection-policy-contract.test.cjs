/**
 * Scout Rate-Limit Storage Backend Selection Policy Contract Tests
 * v20260607-1
 *
 * Locks the product policy for future Scout live rate-limit storage backend
 * selection. This is policy-only: no runtime storage implementation,
 * endpoint behavior change, frontend source change, or provider integration.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-rate-limit-storage-backend-selection-policy.md');
const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
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

const doc = readFileSafe(DOC_PATH);
const depAdapterCode = readFileSafe(DEP_ADAPTER_PATH);
const storageAdapterCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

const tests = [];

tests.push({
  name: 'Storage backend selection policy document exists with policy-only status',
  fn: () => {
    assert.ok(doc.length > 0, 'storage backend selection policy doc must exist');
    assert.ok(doc.includes('Status: policy-only / no runtime storage implementation'), 'doc must declare policy-only status');
    assert.ok(doc.includes('Slice issue: #2337'), 'doc must reference slice issue #2337');
    assert.ok(doc.includes('Parent issue: #1882'), 'doc must reference parent issue #1882');
  },
});

tests.push({
  name: 'Policy compares KV, Durable Object, and D1 candidates',
  fn: () => {
    for (const token of ['KV', 'Durable Object', 'D1']) {
      assert.ok(doc.includes(token), `doc must discuss ${token}`);
    }
    assert.ok(doc.includes('Durable Object should be the preferred candidate'), 'doc must recommend Durable Object for strict counters');
    assert.ok(doc.includes('Do not use KV alone for strict spend-control counters'), 'doc must restrict KV for strict counters');
    assert.ok(doc.includes('D1 may be considered for auditable quota ledgers'), 'doc must define D1 audit/reporting role');
  },
});

tests.push({
  name: 'Policy locks safe keying and prohibited raw identifiers',
  fn: () => {
    for (const allowed of ['userKeyHash', 'ipHash', 'sessionKeyHash', 'endpointPath', 'providerMode', 'limitName', 'windowKey']) {
      assert.ok(doc.includes(allowed), `doc must include allowed key input ${allowed}`);
    }
    for (const prohibited of ['raw token', 'authorization header', 'raw user ID', 'email', 'phone number', 'API key', 'prompt', 'excerpt', 'source URL', 'raw request body', 'raw provider response', 'raw model output']) {
      assert.ok(doc.includes(prohibited), `doc must prohibit ${prohibited}`);
    }
  },
});

tests.push({
  name: 'Policy locks failure modes to RATE_LIMIT_STORAGE_UNAVAILABLE safe-fail',
  fn: () => {
    for (const phrase of ['storage unavailable → deny', 'backend disabled → deny', 'config missing → deny', 'malformed storage result → deny', 'unknown storage code → deny', 'transient storage exception → deny']) {
      assert.ok(doc.includes(phrase), `doc must include failure mode: ${phrase}`);
    }
    assert.ok(doc.includes('RATE_LIMIT_STORAGE_UNAVAILABLE'), 'doc must keep canonical storage unavailable code');
  },
});

tests.push({
  name: 'Policy locks rollout, rollback, and environment separation',
  fn: () => {
    for (const phrase of ['local: mock-disabled or stub-only', 'test: deterministic mock-only', 'staging: explicit opt-in', 'production: separate explicit approval', 'Staging and production storage must not share quota state']) {
      assert.ok(doc.includes(phrase), `doc must include environment policy: ${phrase}`);
    }
    for (const phrase of ['immediate storage kill switch', 'reversion to `RATE_LIMIT_STORAGE_UNAVAILABLE` safe-fail', 'preservation of endpoint default stub behavior', 'preservation of frontend `local_stub` behavior']) {
      assert.ok(doc.includes(phrase), `doc must include rollback policy: ${phrase}`);
    }
  },
});

tests.push({
  name: 'Policy explicitly blocks runtime implementation in this slice',
  fn: () => {
    for (const phrase of ['NO-GO for real storage backend implementation in this slice', 'No runtime code change', 'no real KV', 'no real storage backend', 'no live provider call']) {
      assert.ok(doc.toLowerCase().includes(phrase.toLowerCase()), `doc must block runtime implementation phrase: ${phrase}`);
    }
  },
});

tests.push({
  name: 'Runtime code remains unchanged in spirit: no real storage/fetch/provider access',
  fn: () => {
    const runtimeCode = codeOnly([depAdapterCode, storageAdapterCode, suggestCode, endpointClientCode].join('\n')).toLowerCase();
    for (const forbidden of [
      /kvnamespace/,
      /durableobjectnamespace/,
      /d1database/,
      /env\.kv\b/,
      /env\.db\b/,
      /env\.rate_limit/,
      /\bfetch\s*\(/,
      /xmlhttprequest/,
      /axios/,
      /firebase-admin/,
      /openai/,
      /anthropic/,
      /gemini/,
      /groq/,
      /mistral/,
    ]) {
      assert.ok(!forbidden.test(runtimeCode), `runtime code must not match ${forbidden}`);
    }
  },
});

tests.push({
  name: 'Endpoint and frontend defaults remain safe',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'endpoint must retain STUB mode');
    assert.ok(sourceSelectorCode.includes('local_stub'), 'frontend source selector must retain local_stub');
    assert.ok(!sourceSelectorCode.includes('storageMode'), 'frontend must not expose storageMode');
    assert.ok(!endpointClientCode.includes('live-rate-limit-storage-adapter'), 'endpoint client must not reference storage adapter');
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
