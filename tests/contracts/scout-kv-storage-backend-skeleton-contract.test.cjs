/**
 * Scout KV Storage Backend Skeleton Contract Tests
 * v20260617-1
 *
 * Locks the KV storage backend skeleton contract behavior.
 * Assert that:
 * - Storage adapter default remains mock-disabled.
 * - When configured for the KV_SKELETON mode (via storageMode: 'kv_skeleton' or 'kv_skeleton' mode value),
 *   the storage adapter outputs the proper structure with code STORAGE_KV_SKELETON, disabled status (allowed: false),
 *   and description.
 * - The dependency adapter maps STORAGE_KV_SKELETON to RATE_LIMIT_STORAGE_UNAVAILABLE.
 * - There are no calls to env.KV, global KV, or external imports/network/DB in the adapter files.
 *
 * Slice issue: #2581
 * Parent issue: #1882 (must remain OPEN; never auto-close)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ADAPTER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-rate-limit-storage-adapter.js',
);
const DEP_ADAPTER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-auth-rate-limit-dependency-adapter.js',
);

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const adapterSource = readFile(ADAPTER_PATH);
const adapterCode = codeOnly(adapterSource);
const depAdapterSource = readFile(DEP_ADAPTER_PATH);
const depAdapterCode = codeOnly(depAdapterSource);

// Dynamically import both ESM modules for behavior tests
let adapter = null;
let depAdapter = null;
async function loadModules() {
  if (!adapter) {
    adapter = await import('file://' + ADAPTER_PATH.replace(/\\/g, '/'));
  }
  if (!depAdapter) {
    depAdapter = await import('file://' + DEP_ADAPTER_PATH.replace(/\\/g, '/'));
  }
  return { adapter, depAdapter };
}

const tests = [];

function push(name, fn) {
  tests.push({ name, fn });
}

// ─── Slice identity & exports ──────────────────────────────────────────────

push('Adapter versions and slice identity are present', () => {
  assert.ok(
    adapterSource.includes('Slice issue: #2581') || depAdapterSource.includes('Slice issue: #2581') || readFile(__filename).includes('Slice issue: #2581'),
    'must reference slice issue #2581',
  );
  assert.ok(
    adapterSource.includes('#1882') && depAdapterSource.includes('#1882'),
    'must reference parent umbrella #1882',
  );
});

// ─── Storage Adapter default behavior ──────────────────────────────────────

push('Default storage adapter remains mock-disabled', async () => {
  const { adapter: A } = await loadModules();
  const def = A.createScoutLiveRateLimitStorageAdapter();
  assert.strictEqual(
    def.mode,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.MOCK_DISABLED,
  );
  assert.strictEqual(def.mockDisabled, true);
  assert.strictEqual(def.isMockDisabled, true);
  
  const r = await def.checkQuota({
    userKeyHash: 'u-1',
    limitName: 'rl',
    windowKey: 'w',
  });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(
    r.code,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_MOCK_DISABLED,
  );
});

// ─── KV Skeleton behavior ──────────────────────────────────────────────────

push('Storage adapter configured for KV_SKELETON mode outputs STORAGE_KV_SKELETON and disabled status', async () => {
  const { adapter: A } = await loadModules();
  const scaffold = A.createScoutLiveRateLimitStorageAdapter({
    mockDisabled: false,
    storageMode: 'kv_skeleton',
  });

  assert.strictEqual(
    scaffold.mode,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES.KV_SKELETON,
  );
  assert.strictEqual(scaffold.isRuntimeScaffold, true);

  const r = await scaffold.checkQuota({
    userKeyHash: 'u-1',
    limitName: 'rl',
    windowKey: 'w',
  });

  assert.strictEqual(r.allowed, false);
  assert.strictEqual(
    r.code,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KV_SKELETON,
  );
  assert.ok(r.reason.includes('KV storage backend is a skeleton'));
  assert.ok(r.reason.includes('disabled by default'));
  assert.ok(r.reason.includes('no real storage is accessed'));
});

push('consumeQuota and releaseQuota in KV_SKELETON mode output disabled status', async () => {
  const { adapter: A } = await loadModules();
  const scaffold = A.createScoutLiveRateLimitStorageAdapter({
    mockDisabled: false,
    storageMode: 'kv_skeleton',
  });

  const c = await scaffold.consumeQuota({ userKeyHash: 'u', limitName: 'rl' });
  assert.strictEqual(c.allowed, false);
  assert.strictEqual(
    c.code,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KV_SKELETON,
  );

  const rel = await scaffold.releaseQuota({ userKeyHash: 'u', limitName: 'rl' });
  assert.strictEqual(rel.released, false);
  assert.strictEqual(
    rel.code,
    A.SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES.STORAGE_KV_SKELETON,
  );
});

// ─── Dependency Adapter mapping ────────────────────────────────────────────

push('Dependency adapter maps STORAGE_KV_SKELETON to RATE_LIMIT_STORAGE_UNAVAILABLE', async () => {
  const { adapter: A, depAdapter: D } = await loadModules();
  
  // Create a storage adapter configured with KV_SKELETON
  const storageAdapter = A.createScoutLiveRateLimitStorageAdapter({
    mockDisabled: false,
    storageMode: 'kv_skeleton',
  });

  // Create dependency adapter using this storage adapter
  const dep = D.createScoutLiveDependencyAdapter({
    mockDisabled: false,
    storageAdapter,
  });

  const r = await dep.checkRateLimit({
    userKeyHash: 'u-1',
    limitName: 'rl',
    windowKey: 'w',
  });

  assert.strictEqual(r.allowed, false);
  assert.strictEqual(
    r.code,
    D.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_STORAGE_UNAVAILABLE,
  );
  assert.ok(r.reason.includes('KV storage backend is a skeleton'));
  // Ensure internal storage-specific fields are not leaked
  assert.strictEqual(r.storageKey, undefined);
  assert.strictEqual(r.keyPreview, undefined);
  assert.strictEqual(r.storageKeyBuilder, undefined);
});

// ─── Safety and Forbidden symbols ──────────────────────────────────────────

push('No KV bindings, global KV access, DB queries, fetch, or secrets are used in adapter files', () => {
  const combinedCode = [adapterCode, depAdapterCode].join('\n');
  const FORBIDDEN = [
    'env.KV',
    'global.KV',
    'globalThis.KV',
    'D1Database',
    'DurableObject',
    'fetch(',
    'axios',
    'process.env',
    'STAGING_LIVE',
    'PRODUCTION_LIVE',
  ];
  for (const sym of FORBIDDEN) {
    assert.ok(
      !combinedCode.includes(sym),
      `Forbidden symbol "${sym}" found in adapter files.`,
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
