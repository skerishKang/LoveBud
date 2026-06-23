/**
 * Scout Live Auth/Rate-Limit Boundary Reconcile Contract Tests
 * v20260607-2
 *
 * Locks in the reconcile decision after PR #2278:
 * - functions/api/scout/live-auth-rate-limit-boundary.js is the canonical
 *   auth/rate-limit runtime boundary skeleton
 * - functions/api/scout/live-provider-auth-rate-limit-boundary.js (the parallel
 *   agent's implementation) is NOT adopted
 * - After the endpoint safe-fail wiring slice, suggest.js imports the
 *   canonical boundary only — never the parallel file
 * - endpoint default stub / frontend local_stub are preserved
 * - no Firebase Admin SDK / no KV-DO-D1 / no provider SDK / no fetch
 *
 * This test is the source of truth for the reconcile decision.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
var scoutEnvGuard = require('./_scout-env-guard.cjs');

const ROOT = path.resolve(__dirname, '../..');
const OFFICIAL_BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const PARALLEL_BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-provider-auth-rate-limit-boundary.js');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/provider-specific-adapter.js');
const LIVE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const DOCS = [
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-production-readiness-gates-audit.md',
];

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const officialCode = readFileSafe(OFFICIAL_BOUNDARY_PATH);
const adapterCode = readFileSafe(ADAPTER_PATH);
const liveAdapterCode = readFileSafe(LIVE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

function cleanSource(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const tests = [];

// ── 1. Official boundary file exists ─────────────────────────────────────────
tests.push({
  name: 'Canonical auth/rate-limit boundary file exists (PR #2278)',
  fn: () => {
    assert.ok(
      fs.existsSync(OFFICIAL_BOUNDARY_PATH),
      'Official file functions/api/scout/live-auth-rate-limit-boundary.js must exist'
    );
    assert.ok(officialCode.length > 0, 'Official file must not be empty');
  },
});

// ── 2. Parallel boundary file does NOT exist ────────────────────────────────
tests.push({
  name: 'Parallel auth/rate-limit boundary file is NOT adopted',
  fn: () => {
    assert.ok(
      !fs.existsSync(PARALLEL_BOUNDARY_PATH),
      'Parallel file functions/api/scout/live-provider-auth-rate-limit-boundary.js must not exist'
    );
  },
});

// ── 3. Official exports are preserved ───────────────────────────────────────
tests.push({
  name: 'Official boundary exports the PR #2278 API',
  fn: async () => {
    const mod = await scoutEnvGuard.safeImport(OFFICIAL_BOUNDARY_PATH);
    assert.ok(mod.SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS, 'SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS exported');
    assert.ok(mod.SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES, 'SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES exported');
    assert.strictEqual(typeof mod.createScoutLiveAuthBoundary, 'function');
    assert.strictEqual(typeof mod.createScoutLiveRateLimitBoundary, 'function');
    assert.strictEqual(typeof mod.verifyScoutLiveAuthBoundary, 'function');
    assert.strictEqual(typeof mod.checkScoutLiveRateLimitBoundary, 'function');
  },
});

// ── 4. suggest.js imports canonical boundary only (after wiring slice) ─────
tests.push({
  name: 'suggest.js imports the canonical boundary (only) after endpoint wiring slice',
  fn: () => {
    assert.ok(
      suggestCode.includes('live-auth-rate-limit-boundary'),
      'suggest.js must import live-auth-rate-limit-boundary.js (canonical, intentional wiring)'
    );
    assert.ok(
      !suggestCode.includes('live-provider-auth-rate-limit-boundary'),
      'suggest.js must NOT import live-provider-auth-rate-limit-boundary.js (parallel file, never adopted)'
    );
  },
});

// ── 5. Endpoint default stub preserved ──────────────────────────────────────
tests.push({
  name: 'suggest.js default deterministic stub behavior preserved',
  fn: () => {
    assert.ok(suggestCode.length > 0, 'suggest.js must exist');
    assert.ok(
      suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'),
      'STUB provider mode must remain defined in suggest.js'
    );
    assert.ok(
      suggestCode.includes('providerMode') && (suggestCode.includes('"stub"') || suggestCode.includes("'stub'")),
      'suggest.js must keep default providerMode:"stub"'
    );
  },
});

// ── 6. Frontend local_stub preserved ────────────────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(
      srcSelCode.includes("LOCAL_STUB: 'local_stub'") || srcSelCode.includes('LOCAL_STUB: "local_stub"'),
      'local_stub must remain defined in source selector'
    );
    assert.ok(
      srcSelCode.includes("source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB") || srcSelCode.includes('local_stub'),
      'source selector must default to local_stub'
    );
  },
});

tests.push({
  name: 'Endpoint client default behavior preserved (no boundary wiring)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-boundary'),
      'endpoint client must not import live-auth-rate-limit-boundary.js'
    );
    assert.ok(
      !endpointClientCode.includes('live-provider-auth-rate-limit-boundary'),
      'endpoint client must not import parallel file'
    );
  },
});

// ── 7. No Firebase Admin SDK ────────────────────────────────────────────────
tests.push({
  name: 'No Firebase Admin SDK in official boundary / adapter / suggest',
  fn: () => {
    const files = [
      ['official-boundary', cleanSource(officialCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
      ['suggest', cleanSource(suggestCode)],
    ];
    const patterns = [
      /require\(['"]firebase-admin['"]\)/,
      /from\s+['"]firebase-admin['"]/,
      /require\(['"]firebase\/[^'"]+['"]\)/,
      /from\s+['"]firebase\/[^'"]+['"]/,
    ];
    for (const [name, code] of files) {
      for (const p of patterns) {
        assert.ok(
          !p.test(code),
          `${name} must not import Firebase Admin SDK (pattern: ${p})`
        );
      }
    }
  },
});

// ── 8. No KV / Durable Object / D1 runtime storage access ──────────────────
tests.push({
  name: 'No KV / Durable Object / D1 runtime access in official boundary / adapter / suggest',
  fn: () => {
    const files = [
      ['official-boundary', cleanSource(officialCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
      ['suggest', cleanSource(suggestCode)],
    ];
    for (const [name, code] of files) {
      assert.ok(
        !/KVNamespace|DurableObject|D1Database|env\.KV|env\.DB|env\.DO/.test(code),
        `${name} must not reference KV / Durable Object / D1 runtime APIs`
      );
      assert.ok(
        !/platform\.|wrangler\./.test(code),
        `${name} must not reference Cloudflare platform globals`
      );
    }
  },
});

// ── 9. No provider SDK imports ──────────────────────────────────────────────
tests.push({
  name: 'No provider SDK imports in official boundary / adapter / suggest',
  fn: () => {
    const forbidden = [
      'openai', '@anthropic-ai/sdk', '@google/generative-ai', 'groq-sdk',
      '@mistralai/mistralai', 'nvidia-modulus', 'grok-client',
    ];
    const files = [
      ['official-boundary', cleanSource(officialCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
      ['suggest', cleanSource(suggestCode)],
    ];
    for (const [name, code] of files) {
      for (const pkg of forbidden) {
        const esc = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const requireRe = new RegExp(`require\\(['"\`]${esc}['"\`]`);
        const fromRe = new RegExp(`from\\s+['"\`]${esc}['"\`]`);
        assert.ok(
          !requireRe.test(code) && !fromRe.test(code),
          `${name} must not import SDK "${pkg}"`
        );
      }
    }
  },
});

// ── 10. No fetch / XHR / axios ──────────────────────────────────────────────
tests.push({
  name: 'No fetch / XHR / axios in official boundary / adapter / suggest',
  fn: () => {
    const files = [
      ['official-boundary', cleanSource(officialCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
      ['suggest', cleanSource(suggestCode)],
    ];
    for (const [name, code] of files) {
      assert.ok(!/\bfetch\s*\(/.test(code), `${name} must not use fetch(`);
      assert.ok(!/XMLHttpRequest/.test(code), `${name} must not use XMLHttpRequest`);
      assert.ok(!/axios/.test(code), `${name} must not use axios`);
    }
  },
});

// ── 11. Docs mention reconcile decision ─────────────────────────────────────
tests.push({
  name: 'Related docs document the reconcile decision',
  fn: () => {
    for (const rel of DOCS) {
      const filePath = path.join(ROOT, 'docs/product', rel);
      const content = readFileSafe(filePath);
      assert.ok(content.length > 0, `${rel} must exist`);
      const lc = content.toLowerCase();
      const mentionsReconcile =
        lc.includes('reconcile') ||
        lc.includes('canonical') ||
        lc.includes('not adopted') ||
        lc.includes('parallel');
      assert.ok(
        mentionsReconcile,
        `${rel} must mention the reconcile decision (canonical / not adopted / parallel)`
      );
    }
  },
});

// ── 12. Docs preserve future endpoint wiring as separate slice ──────────────
tests.push({
  name: 'Related docs preserve endpoint live wiring as a separate future slice',
  fn: () => {
    for (const rel of DOCS) {
      const filePath = path.join(ROOT, 'docs/product', rel);
      const content = readFileSafe(filePath);
      const lc = content.toLowerCase();
      const mentionsFuture =
        lc.includes('future slice') ||
        lc.includes('separate slice') ||
        lc.includes('subsequent slice') ||
        lc.includes('follow-up slice') ||
        lc.includes('future wiring') ||
        lc.includes('next slice');
      assert.ok(
        mentionsFuture,
        `${rel} must mention that endpoint live wiring is a separate / future slice`
      );
    }
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
