/**
 * Contract: Scout Staging Provider Activation Guard
 * v20260617-api-key-transport-1
 *
 * Proves:
 *  1. Stage env var not set → transport is DISABLED.
 *  2. Stage === 'production' → transport is DISABLED (production explicitly blocked).
 *  3. Stage === 'staging' → transport can be READY_FOR_ADAPTER (when other gates met).
 *  4. Stage === 'test' → transport can be READY_FOR_ADAPTER.
 *  5. Any other stage value → DISABLED.
 *  6. Normalizer returns a 'stage' field on the normalized config.
 *  7. READY_FOR_ADAPTER only appears when stage is 'staging' or 'test'.
 *  8. Production blocking is asserted in module doc/comment.
 *  9. Normal CI (no stage set) → transport is DISABLED.
 * 10. #1882 remains open (umbrella product issue not closed by this slice).
 * 11. The ALLOWED_STAGES set contains exactly 'staging' and 'test'.
 * 12. Stage value is normalized to lowercase before comparison.
 */

'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { test, suite } = require('node:test');

// ─── Paths ───────────────────────────────────────────────────────────────────

const MODULE_PATH = path.resolve(
  __dirname,
  '../../functions/api/scout/live-provider-api-key-transport.js'
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildConfigWithStage(stageValue, overrides) {
  const cfg = {
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE: 'api_key',
    SCOUT_SUGGEST_PROVIDER_STAGE: stageValue,
    SCOUT_SUGGEST_LLM_API_KEY: 'fixture-key-never-logged',
    SCOUT_SUGGEST_LLM_PROVIDER: 'chat-completions-v1',
    SCOUT_SUGGEST_MODEL: 'gpt-4o-mini',
    SCOUT_SUGGEST_LLM_BASE_URL: 'https://example.test/v1',
  };
  if (stageValue === undefined) {
    delete cfg.SCOUT_SUGGEST_PROVIDER_STAGE;
  }
  if (overrides && typeof overrides === 'object') {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) {
        delete cfg[k];
      } else {
        cfg[k] = v;
      }
    }
  }
  return cfg;
}

function readSource() {
  return fs.readFileSync(MODULE_PATH, 'utf-8');
}

// ─── Module load ─────────────────────────────────────────────────────────────

let mod = null;
async function loadModule() {
  if (!mod) {
    mod = await import('file://' + MODULE_PATH.replace(/\\/g, '/'));
  }
  return mod;
}

// ─── Test runner ─────────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function pass(label) {
  console.log(`  ✓ ${label}`);
  passCount++;
}

function fail(label, reason) {
  console.error(`  ✗ FAIL: ${label}`);
  if (reason) console.error(`         ${reason}`);
  failCount++;
}

// ─── Suites ──────────────────────────────────────────────────────────────────

async function run() {
  console.log(
    '\n[scout-staging-provider-activation-guard-contract] Starting contract checks'
  );

  // ── 0. File presence ────────────────────────────────────────────────────────
  await suite('0. File presence', async () => {
    if (fs.existsSync(MODULE_PATH)) {
      pass('live-provider-api-key-transport.js exists');
    } else {
      fail('live-provider-api-key-transport.js exists', `Missing: ${MODULE_PATH}`);
      process.exit(1);
    }
  });

  // ── 1. Stage not set → DISABLED ─────────────────────────────────────────────
  await suite('1. Stage env var not set → DISABLED', async () => {
    const m = await loadModule();
    const cfg = buildConfigWithStage(undefined);
    const t = m.createScoutLiveProviderTransport(cfg);
    assert.strictEqual(t.status, 'DISABLED');
    pass('stage not set: status=DISABLED');
    assert.ok(
      t.config.missingGateKeys.includes('SCOUT_SUGGEST_PROVIDER_STAGE'),
      'missingGateKeys includes SCOUT_SUGGEST_PROVIDER_STAGE'
    );
    pass('stage not set: missingGateKeys includes SCOUT_SUGGEST_PROVIDER_STAGE');
  });

  // ── 2. Stage === production → DISABLED (blocked) ────────────────────────────
  await suite('2. Stage === production → DISABLED (production blocked)', async () => {
    const m = await loadModule();
    const cfg = buildConfigWithStage('production');
    const t = m.createScoutLiveProviderTransport(cfg);
    assert.strictEqual(t.status, 'DISABLED');
    pass('stage=production: status=DISABLED');
    assert.strictEqual(t.config.stage, 'production');
    pass('stage=production: config.stage="production"');
    assert.ok(
      t.config.missingGateKeys.includes('SCOUT_SUGGEST_PROVIDER_STAGE'),
      'production is in missingGateKeys'
    );
    pass('stage=production: missingGateKeys includes SCOUT_SUGGEST_PROVIDER_STAGE');

    // Execute must also return safe-fail for production
    const fakeFetch = async () => ({ ok: true, json: async () => ({}) });
    const tWithFetch = m.createScoutLiveProviderTransport(cfg, {
      fetch: fakeFetch,
    });
    const res = await tWithFetch.execute('test prompt');
    assert.strictEqual(res.ok, false);
    pass('stage=production: execute returns ok=false even with injected fetch');
    assert.ok(
      res.error.code === 'GATE_NOT_SATISFIED' || res.error.code === 'CONFIG_MISSING',
      `stage=production: safe-fail code, got ${res.error && res.error.code}`
    );
    pass('stage=production: returns GATE_NOT_SATISFIED or CONFIG_MISSING');
  });

  // ── 3. Stage === staging → READY_FOR_ADAPTER ────────────────────────────────
  await suite('3. Stage === staging → READY_FOR_ADAPTER (gates met)', async () => {
    const m = await loadModule();
    const cfg = buildConfigWithStage('staging');
    const t = m.createScoutLiveProviderTransport(cfg);
    assert.strictEqual(t.status, 'READY_FOR_ADAPTER');
    pass('stage=staging: status=READY_FOR_ADAPTER');
    assert.strictEqual(t.config.stage, 'staging');
    pass('stage=staging: config.stage="staging"');
  });

  // ── 4. Stage === test → READY_FOR_ADAPTER ───────────────────────────────────
  await suite('4. Stage === test → READY_FOR_ADAPTER (gates met)', async () => {
    const m = await loadModule();
    const cfg = buildConfigWithStage('test');
    const t = m.createScoutLiveProviderTransport(cfg);
    assert.strictEqual(t.status, 'READY_FOR_ADAPTER');
    pass('stage=test: status=READY_FOR_ADAPTER');
    assert.strictEqual(t.config.stage, 'test');
    pass('stage=test: config.stage="test"');
  });

  // ── 5. Other stage values → DISABLED ────────────────────────────────────────
  await suite('5. Other stage values → DISABLED', async () => {
    const m = await loadModule();
    // Note: 'Staging' is NOT in this list because the normalizer lowercases
    // the stage value, so 'Staging' becomes 'staging' and is allowed.
    // 'PRODUCTION' is in this list to verify that uppercase production is
    // also blocked (lowercased to 'production', still not in ALLOWED_STAGES).
    const otherStages = ['dev', 'qa', 'live', 'prod', 'PRODUCTION', ''];
    for (const stage of otherStages) {
      const cfg = buildConfigWithStage(stage);
      const t = m.createScoutLiveProviderTransport(cfg);
      assert.strictEqual(
        t.status,
        'DISABLED',
        `stage="${stage}" → status=DISABLED`
      );
      pass(`stage="${stage}" → status=DISABLED`);
    }
  });

  // ── 6. Normalizer returns a stage field ─────────────────────────────────────
  await suite('6. Normalizer returns a stage field', async () => {
    const m = await loadModule();
    const result = m.normalizeScoutLiveProviderTransportConfig(
      buildConfigWithStage('staging')
    );
    assert.ok(result, 'normalizer returns a result');
    pass('normalizer returns a result');
    assert.strictEqual(typeof result.stage, 'string');
    pass('normalizer result.stage is a string');
    assert.strictEqual(result.stage, 'staging');
    pass('normalizer result.stage="staging"');

    const resultProd = m.normalizeScoutLiveProviderTransportConfig(
      buildConfigWithStage('production')
    );
    assert.strictEqual(resultProd.stage, 'production');
    pass('normalizer result.stage="production" for production input');
  });

  // ── 7. READY_FOR_ADAPTER only for staging/test ──────────────────────────────
  await suite('7. READY_FOR_ADAPTER only appears when stage is staging or test', async () => {
    const m = await loadModule();
    const cases = [
      { stage: 'staging', expected: 'READY_FOR_ADAPTER' },
      { stage: 'test', expected: 'READY_FOR_ADAPTER' },
      { stage: 'production', expected: 'DISABLED' },
      { stage: 'dev', expected: 'DISABLED' },
      { stage: '', expected: 'DISABLED' },
      { stage: undefined, expected: 'DISABLED' },
    ];
    for (const c of cases) {
      const cfg = buildConfigWithStage(c.stage);
      const t = m.createScoutLiveProviderTransport(cfg);
      assert.strictEqual(
        t.status,
        c.expected,
        `stage="${c.stage}" → status=${c.expected}`
      );
      pass(`stage="${c.stage}" → status=${c.expected}`);
    }
  });

  // ── 8. Production blocking asserted in module doc/comment ───────────────────
  await suite('8. Production blocking asserted in module source', async () => {
    const src = readSource();
    // The source must mention production is blocked
    assert.ok(
      /production/i.test(src),
      'module source mentions production'
    );
    pass('module source mentions production');
    assert.ok(
      /blocked|block/i.test(src),
      'module source mentions blocking'
    );
    pass('module source mentions blocking');
    // The source must have a comment or code path that explicitly
    // blocks production stage
    const productionBlockPattern =
      /stage\s*===\s*['"]production['"][\s\S]{0,200}(return|DISABLED|disabled|block)/i;
    assert.ok(
      productionBlockPattern.test(src) || /production[\s\S]{0,300}blocked/i.test(src),
      'module source has explicit production blocking code or comment'
    );
    pass('module source has explicit production blocking');
  });

  // ── 9. Normal CI (no stage set) → DISABLED ──────────────────────────────────
  await suite('9. Normal CI (no stage env) → DISABLED', async () => {
    const m = await loadModule();
    // Simulate normal CI: no SCOUT_SUGGEST_PROVIDER_STAGE set
    const cfg = {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE: 'api_key',
      // SCOUT_SUGGEST_PROVIDER_STAGE is NOT set
      SCOUT_SUGGEST_LLM_API_KEY: 'ci-fixture-key',
      SCOUT_SUGGEST_LLM_PROVIDER: 'chat-completions-v1',
      SCOUT_SUGGEST_MODEL: 'gpt-4o-mini',
    };
    const t = m.createScoutLiveProviderTransport(cfg);
    assert.strictEqual(t.status, 'DISABLED');
    pass('normal CI (no stage): status=DISABLED');

    // Even with an injected fetch, normal CI does not make a real call
    let fetchCalled = false;
    const fakeFetch = async () => {
      fetchCalled = true;
      return { ok: true, json: async () => ({}) };
    };
    const tWithFetch = m.createScoutLiveProviderTransport(cfg, {
      fetch: fakeFetch,
    });
    const res = await tWithFetch.execute('test prompt');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(fetchCalled, false, 'fetch not called in normal CI');
    pass('normal CI: fetch NOT called even when injected');
  });

  // ── 10. #1882 remains open ──────────────────────────────────────────────────
  await suite('10. #1882 remains open (umbrella product issue)', async () => {
    const src = readSource();
    const closings = ['Closes #1882', 'Fixes #1882', 'Resolves #1882'];
    for (const c of closings) {
      assert.ok(
        !src.includes(c),
        `module source must not contain: ${c}`
      );
    }
    pass('module source does NOT close #1882');
    pass('module source does NOT fix #1882');
    pass('module source does NOT resolve #1882');
    pass('#1882 remains open (this slice is a sub-slice, not a closure)');
  });

  // ── 11. ALLOWED_STAGES set contains exactly staging and test ────────────────
  await suite('11. ALLOWED_STAGES set contains exactly staging and test', async () => {
    const m = await loadModule();
    const allowed = m.SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_STAGES;
    assert.ok(allowed, 'ALLOWED_STAGES is exported');
    pass('SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_STAGES is exported');
    assert.ok(
      allowed instanceof Set || Array.isArray(allowed),
      'ALLOWED_STAGES is a Set or Array'
    );
    pass('ALLOWED_STAGES is a Set or Array');
    const arr = Array.from(allowed);
    assert.ok(arr.includes('staging'), 'ALLOWED_STAGES includes "staging"');
    pass('ALLOWED_STAGES includes "staging"');
    assert.ok(arr.includes('test'), 'ALLOWED_STAGES includes "test"');
    pass('ALLOWED_STAGES includes "test"');
    assert.ok(
      !arr.includes('production'),
      'ALLOWED_STAGES does NOT include "production"'
    );
    pass('ALLOWED_STAGES does NOT include "production"');
    assert.strictEqual(arr.length, 2, 'ALLOWED_STAGES has exactly 2 entries');
    pass('ALLOWED_STAGES has exactly 2 entries');
  });

  // ── 12. Stage value is normalized to lowercase ──────────────────────────────
  await suite('12. Stage value is normalized to lowercase', async () => {
    const m = await loadModule();
    // "STAGING" should be treated as "staging" (normalized to lowercase)
    const cfg = buildConfigWithStage('STAGING');
    const t = m.createScoutLiveProviderTransport(cfg);
    assert.strictEqual(
      t.status,
      'READY_FOR_ADAPTER',
      'STAGING (uppercase) → READY_FOR_ADAPTER'
    );
    pass('STAGING (uppercase) → READY_FOR_ADAPTER');
    assert.strictEqual(t.config.stage, 'staging');
    pass('STAGING (uppercase) → config.stage="staging" (normalized)');

    // "PRODUCTION" should be treated as "production" (still blocked)
    const prodCfg = buildConfigWithStage('PRODUCTION');
    const tProd = m.createScoutLiveProviderTransport(prodCfg);
    assert.strictEqual(tProd.status, 'DISABLED');
    pass('PRODUCTION (uppercase) → DISABLED (still blocked)');
  });

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────────────────');
  console.log(
    `[scout-staging-provider-activation-guard-contract] ${passCount} passed, ${failCount} failed`
  );
  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(
    '[scout-staging-provider-activation-guard-contract] Uncaught:',
    err.message || String(err)
  );
  process.exit(1);
});
