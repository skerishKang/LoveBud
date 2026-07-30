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
const { test } = require('node:test');

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
    SCOUT_SUGGEST_LLM_PROVIDER: mod ? mod.SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_PROVIDER : 'openai-compatible',
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

// ─── Tests ───────────────────────────────────────────────────────────────────

test('Scout staging provider activation guard', async (t) => {
  console.log(
    '\n[scout-staging-provider-activation-guard-contract] Starting contract checks'
  );

  // ── 0. File presence ────────────────────────────────────────────────────────
  await t.test('0. File presence', () => {
    assert.ok(fs.existsSync(MODULE_PATH), 'live-provider-api-key-transport.js missing: ' + MODULE_PATH);
    console.log('  ✓ live-provider-api-key-transport.js exists');
  });

  // ── 1. Stage not set → DISABLED ─────────────────────────────────────────────
  await t.test('1. Stage env var not set → DISABLED', async () => {
    const m = await loadModule();
    const cfg = buildConfigWithStage(undefined);
    const transport = m.createScoutLiveProviderTransport(cfg);
    assert.strictEqual(transport.status, 'DISABLED');
    console.log('  ✓ stage not set: status=DISABLED');
    assert.ok(
      transport.config.missingGateKeys.includes('SCOUT_SUGGEST_PROVIDER_STAGE'),
      'missingGateKeys includes SCOUT_SUGGEST_PROVIDER_STAGE'
    );
    console.log('  ✓ stage not set: missingGateKeys includes SCOUT_SUGGEST_PROVIDER_STAGE');
  });

  // ── 2. Stage === production → DISABLED (blocked) ────────────────────────────
  await t.test('2. Stage === production → DISABLED (production blocked)', async () => {
    const m = await loadModule();
    const cfg = buildConfigWithStage('production');
    const transport = m.createScoutLiveProviderTransport(cfg);
    assert.strictEqual(transport.status, 'DISABLED');
    console.log('  ✓ stage=production: status=DISABLED');
    assert.strictEqual(transport.config.stage, 'production');
    console.log('  ✓ stage=production: config.stage="production"');
    assert.ok(
      transport.config.missingGateKeys.includes('SCOUT_SUGGEST_PROVIDER_STAGE'),
      'production is in missingGateKeys'
    );
    console.log('  ✓ stage=production: missingGateKeys includes SCOUT_SUGGEST_PROVIDER_STAGE');

    // Execute must also return safe-fail for production
    const fakeFetch = async () => ({ ok: true, json: async () => ({}) });
    const transportWithFetch = m.createScoutLiveProviderTransport(cfg, {
      fetch: fakeFetch,
    });
    const res = await transportWithFetch.execute('test prompt');
    assert.strictEqual(res.ok, false);
    console.log('  ✓ stage=production: execute returns ok=false even with injected fetch');
    assert.ok(
      res.error.code === 'GATE_NOT_SATISFIED' || res.error.code === 'CONFIG_MISSING',
      'stage=production: safe-fail code, got ' + (res.error && res.error.code)
    );
    console.log('  ✓ stage=production: returns GATE_NOT_SATISFIED or CONFIG_MISSING');
  });

  // ── 3. Stage === staging → READY_FOR_ADAPTER ────────────────────────────────
  await t.test('3. Stage === staging → READY_FOR_ADAPTER (gates met)', async () => {
    const m = await loadModule();
    const cfg = buildConfigWithStage('staging');
    const transport = m.createScoutLiveProviderTransport(cfg);
    assert.strictEqual(transport.status, 'READY_FOR_ADAPTER');
    console.log('  ✓ stage=staging: status=READY_FOR_ADAPTER');
    assert.strictEqual(transport.config.stage, 'staging');
    console.log('  ✓ stage=staging: config.stage="staging"');
  });

  // ── 4. Stage === test → READY_FOR_ADAPTER ───────────────────────────────────
  await t.test('4. Stage === test → READY_FOR_ADAPTER (gates met)', async () => {
    const m = await loadModule();
    const cfg = buildConfigWithStage('test');
    const transport = m.createScoutLiveProviderTransport(cfg);
    assert.strictEqual(transport.status, 'READY_FOR_ADAPTER');
    console.log('  ✓ stage=test: status=READY_FOR_ADAPTER');
    assert.strictEqual(transport.config.stage, 'test');
    console.log('  ✓ stage=test: config.stage="test"');
  });

  // ── 5. Other stage values → DISABLED ────────────────────────────────────────
  await t.test('5. Other stage values → DISABLED', async () => {
    const m = await loadModule();
    // Note: 'Staging' is NOT in this list because the normalizer lowercases
    // the stage value, so 'Staging' becomes 'staging' and is allowed.
    // 'PRODUCTION' is in this list to verify that uppercase production is
    // also blocked (lowercased to 'production', still not in ALLOWED_STAGES).
    const otherStages = ['dev', 'qa', 'live', 'prod', 'PRODUCTION', ''];
    for (const stage of otherStages) {
      const cfg = buildConfigWithStage(stage);
      const transport = m.createScoutLiveProviderTransport(cfg);
      assert.strictEqual(
        transport.status,
        'DISABLED',
        'stage="' + stage + '" → status=DISABLED'
      );
      console.log('  ✓ stage="' + stage + '" → status=DISABLED');
    }
  });

  // ── 6. Normalizer returns a stage field ─────────────────────────────────────
  await t.test('6. Normalizer returns a stage field', async () => {
    const m = await loadModule();
    const result = m.normalizeScoutLiveProviderTransportConfig(
      buildConfigWithStage('staging')
    );
    assert.ok(result, 'normalizer returns a result');
    console.log('  ✓ normalizer returns a result');
    assert.strictEqual(typeof result.stage, 'string');
    console.log('  ✓ normalizer result.stage is a string');
    assert.strictEqual(result.stage, 'staging');
    console.log('  ✓ normalizer result.stage="staging"');

    const resultProd = m.normalizeScoutLiveProviderTransportConfig(
      buildConfigWithStage('production')
    );
    assert.strictEqual(resultProd.stage, 'production');
    console.log('  ✓ normalizer result.stage="production" for production input');
  });

  // ── 7. READY_FOR_ADAPTER only for staging/test ──────────────────────────────
  await t.test('7. READY_FOR_ADAPTER only appears when stage is staging or test', async () => {
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
      const transport = m.createScoutLiveProviderTransport(cfg);
      assert.strictEqual(
        transport.status,
        c.expected,
        'stage="' + c.stage + '" → status=' + c.expected
      );
      console.log('  ✓ stage="' + c.stage + '" → status=' + c.expected);
    }
  });

  // ── 8. Production blocking asserted in module doc/comment ───────────────────
  await t.test('8. Production blocking asserted in module source', () => {
    const src = readSource();
    // The source must mention production is blocked
    assert.ok(
      /production/i.test(src),
      'module source mentions production'
    );
    console.log('  ✓ module source mentions production');
    assert.ok(
      /blocked|block/i.test(src),
      'module source mentions blocking'
    );
    console.log('  ✓ module source mentions blocking');
    // The source must have a comment or code path that explicitly
    // blocks production stage
    const productionBlockPattern =
      /stage\s*===\s*['"]production['"][\s\S]{0,200}(return|DISABLED|disabled|block)/i;
    assert.ok(
      productionBlockPattern.test(src) || /production[\s\S]{0,300}blocked/i.test(src),
      'module source has explicit production blocking code or comment'
    );
    console.log('  ✓ module source has explicit production blocking');
  });

  // ── 9. Normal CI (no stage set) → DISABLED ──────────────────────────────────
  await t.test('9. Normal CI (no stage env) → DISABLED', async () => {
    const m = await loadModule();
    // Simulate normal CI: no SCOUT_SUGGEST_PROVIDER_STAGE set
    const cfg = {
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE: 'api_key',
      // SCOUT_SUGGEST_PROVIDER_STAGE is NOT set
      SCOUT_SUGGEST_LLM_API_KEY: 'ci-fixture-key',
      SCOUT_SUGGEST_LLM_PROVIDER: mod ? mod.SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_PROVIDER : 'openai-compatible',
      SCOUT_SUGGEST_MODEL: 'gpt-4o-mini',
    };
    const transport = m.createScoutLiveProviderTransport(cfg);
    assert.strictEqual(transport.status, 'DISABLED');
    console.log('  ✓ normal CI (no stage): status=DISABLED');

    // Even with an injected fetch, normal CI does not make a real call
    let fetchCalled = false;
    const fakeFetch = async () => {
      fetchCalled = true;
      return { ok: true, json: async () => ({}) };
    };
    const transportWithFetch = m.createScoutLiveProviderTransport(cfg, {
      fetch: fakeFetch,
    });
    const res = await transportWithFetch.execute('test prompt');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(fetchCalled, false, 'fetch not called in normal CI');
    console.log('  ✓ normal CI: fetch NOT called even when injected');
  });

  // ── 10. #1882 remains open ──────────────────────────────────────────────────
  await t.test('10. #1882 remains open (umbrella product issue)', () => {
    const src = readSource();
    const closings = ['Closes #1882', 'Fixes #1882', 'Resolves #1882'];
    for (const c of closings) {
      assert.ok(
        !src.includes(c),
        'module source must not contain: ' + c
      );
    }
    console.log('  ✓ module source does NOT close #1882');
    console.log('  ✓ module source does NOT fix #1882');
    console.log('  ✓ module source does NOT resolve #1882');
    console.log('  ✓ #1882 remains open (this slice is a sub-slice, not a closure)');
  });

  // ── 11. ALLOWED_STAGES set contains exactly staging and test ────────────────
  await t.test('11. ALLOWED_STAGES set contains exactly staging and test', async () => {
    const m = await loadModule();
    const allowed = m.SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_STAGES;
    assert.ok(allowed, 'ALLOWED_STAGES is exported');
    console.log('  ✓ SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_STAGES is exported');
    assert.ok(
      allowed instanceof Set || Array.isArray(allowed),
      'ALLOWED_STAGES is a Set or Array'
    );
    console.log('  ✓ ALLOWED_STAGES is a Set or Array');
    const arr = Array.from(allowed);
    assert.ok(arr.includes('staging'), 'ALLOWED_STAGES includes "staging"');
    console.log('  ✓ ALLOWED_STAGES includes "staging"');
    assert.ok(arr.includes('test'), 'ALLOWED_STAGES includes "test"');
    console.log('  ✓ ALLOWED_STAGES includes "test"');
    assert.ok(
      !arr.includes('production'),
      'ALLOWED_STAGES does NOT include "production"'
    );
    console.log('  ✓ ALLOWED_STAGES does NOT include "production"');
    assert.strictEqual(arr.length, 2, 'ALLOWED_STAGES has exactly 2 entries');
    console.log('  ✓ ALLOWED_STAGES has exactly 2 entries');
  });

  // ── 12. Stage value is normalized to lowercase ──────────────────────────────
  await t.test('12. Stage value is normalized to lowercase', async () => {
    const m = await loadModule();
    // "STAGING" should be treated as "staging" (normalized to lowercase)
    const cfg = buildConfigWithStage('STAGING');
    const transport = m.createScoutLiveProviderTransport(cfg);
    assert.strictEqual(
      transport.status,
      'READY_FOR_ADAPTER',
      'STAGING (uppercase) → READY_FOR_ADAPTER'
    );
    console.log('  ✓ STAGING (uppercase) → READY_FOR_ADAPTER');
    assert.strictEqual(transport.config.stage, 'staging');
    console.log('  ✓ STAGING (uppercase) → config.stage="staging" (normalized)');

    // "PRODUCTION" should be treated as "production" (still blocked)
    const prodCfg = buildConfigWithStage('PRODUCTION');
    const transportProd = m.createScoutLiveProviderTransport(prodCfg);
    assert.strictEqual(transportProd.status, 'DISABLED');
    console.log('  ✓ PRODUCTION (uppercase) → DISABLED (still blocked)');
  });

  console.log(
    '\n[scout-staging-provider-activation-guard-contract] All checks passed'
  );
});
