/**
 * Scout Live Auth/Rate-Limit Readiness Audit Contract Tests
 * v20260607-1
 *
 * Audit-only contract test. Locks the readiness audit document's content
 * and confirms runtime guardrails remain in place:
 * - readiness audit document exists with required sections
 * - boundary inventory, confirmed behavior, guardrails, go/no-go matrix,
 *   remaining blockers, and recommended next slice are all documented
 * - endpoint default stub / frontend local_stub / endpoint client default
 *   disabled remain preserved
 * - no Firebase Admin SDK / no KV-DO-D1 / no provider SDK / no fetch
 * - related docs updated
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const AUDIT_DOC = path.join(ROOT, 'docs/product/lovebud-scout-live-auth-rate-limit-readiness-audit.md');
const HELPER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-observability.js');
const BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/provider-specific-adapter.js');
const LIVE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const RELATED_DOCS = [
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-production-readiness-gates-audit.md',
  'lovebud-scout-live-provider-staging-rollout-contract.md',
  'lovebud-scout-ai-suggestion-mvp-readiness.md',
  'lovebud-scout-live-provider-readiness-audit.md',
];

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const auditDoc = readFileSafe(AUDIT_DOC);
const helperCode = readFileSafe(HELPER_PATH);
const boundaryCode = readFileSafe(BOUNDARY_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const adapterCode = readFileSafe(ADAPTER_PATH);
const liveAdapterCode = readFileSafe(LIVE_ADAPTER_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

function cleanSource(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const tests = [];

// ── 1. Readiness audit document exists ──────────────────────────────────────
tests.push({
  name: 'Readiness audit document exists',
  fn: () => {
    assert.ok(auditDoc.length > 0, 'audit document must exist at docs/product/lovebud-scout-live-auth-rate-limit-readiness-audit.md');
    assert.ok(/^#\s.*Readiness Audit/m.test(auditDoc), 'document must start with a top-level heading');
  },
});

// ── 2. Boundary inventory is documented ─────────────────────────────────────
tests.push({
  name: 'Boundary inventory is documented (canonical runtime boundary / reconcile / safe-fail wiring / DI / observability)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const term of [
      'canonical',
      'reconcile',
      'safe-fail wiring',
      'injected dependency',
      'sanitized observability',
    ]) {
      assert.ok(lc.includes(term), `audit must mention "${term}"`);
    }
  },
});

// ── 3. Confirmed behavior is documented ─────────────────────────────────────
tests.push({
  name: 'Confirmed behavior is documented (stub skip / safe-fail / observer safe-swallow)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const term of [
      'default stub',
      'explicit stub',
      'live mode',
      'auth_required',
      'auth_invalid',
      'rate_limit_unavailable',
      'rate_limited',
      'rate_limit_allowed',
      'safe-swallow',
    ]) {
      assert.ok(lc.includes(term), `audit must mention "${term}"`);
    }
  },
});

// ── 4. Security/privacy guardrails are documented ───────────────────────────
tests.push({
  name: 'Security/privacy guardrails are documented (no raw token / API key / prompt / excerpt / sourceUrl logging)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    // Substring check covers "no raw token", "no api key", "no prompt", "excerpt", "sourceurl" anywhere
    for (const term of [
      'raw token',
      'api key',
      'prompt',
      'excerpt',
      'sourceurl',
    ]) {
      assert.ok(lc.includes(term), `audit must mention "${term}"`);
    }
  },
});

// ── 5. No runtime external systems documented ──────────────────────────────
tests.push({
  name: 'No-runtime-external-systems guardrails are documented (no Firebase / no KV-DO-D1 / no provider SDK / no fetch)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const term of [
      'firebase admin sdk',
      'kv',
      'd1',
      'provider sdk',
      'fetch',
    ]) {
      assert.ok(lc.includes(term), `audit must mention "${term}"`);
    }
  },
});

// ── 6. Go/no-go matrix is documented ────────────────────────────────────────
tests.push({
  name: 'Go/no-go matrix is documented (done items + blocked items)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const term of [
      'go / no-go',
      'go**',
      'no-go**',
      'real firebase',
      'persistent rate-limit',
      'staging_live',
      'production_live',
      'real provider api',
    ]) {
      assert.ok(lc.includes(term), `audit must mention "${term}"`);
    }
  },
});

// ── 7. Remaining blockers are documented ────────────────────────────────────
tests.push({
  name: 'Remaining blockers are documented (firebase verifier / persistent store / quota backend / observability backend / provider adapter / error taxonomy / staging soak / kill-switch drill)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const term of [
      'real firebase auth verifier',
      'persistent rate-limit store',
      'production quota backend',
      'real observability backend',
      'provider-specific live adapter',
      'provider error taxonomy',
      'staging soak',
      'kill-switch drill',
    ]) {
      assert.ok(lc.includes(term), `audit must mention "${term}"`);
    }
  },
});

// ── 8. Recommended next slice is documented ─────────────────────────────────
tests.push({
  name: 'Recommended next slice is documented (endpoint error taxonomy contract)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(
      lc.includes('error taxonomy'),
      'audit must mention the recommended next slice: error taxonomy'
    );
    assert.ok(
      lc.includes('endpoint error taxonomy contract') || lc.includes('error taxonomy contract'),
      'audit must explicitly call out the error taxonomy contract as the next slice'
    );
  },
});

// ── 9. Endpoint default stub preserved in code ──────────────────────────────
tests.push({
  name: 'Endpoint default stub behavior preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.length > 0);
    assert.ok(
      suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'),
      'STUB provider mode must remain defined'
    );
    // Default resolution: providerConfig.providerMode is SCOUT_SUGGEST_PROVIDER_MODES.STUB
    assert.ok(
      /SCOUT_SUGGEST_PROVIDER_MODES\.STUB/.test(suggestCode),
      'default providerMode must reference SCOUT_SUGGEST_PROVIDER_MODES.STUB'
    );
  },
});

// ── 10. Frontend default local_stub preserved in code ───────────────────────
tests.push({
  name: 'Frontend source selector default local_stub preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0);
    assert.ok(
      srcSelCode.includes("LOCAL_STUB: 'local_stub'") || srcSelCode.includes('LOCAL_STUB: "local_stub"'),
      'local_stub must remain defined'
    );
  },
});

// ── 11. Endpoint client default disabled preserved in code ──────────────────
tests.push({
  name: 'Endpoint client default disabled preserved (no observability/boundary wiring)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0);
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-observability'),
      'endpoint client must not import observability helper'
    );
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-boundary'),
      'endpoint client must not import auth/rate-limit boundary'
    );
  },
});

// ── 12. No Firebase Admin SDK in any scout source file ──────────────────────
tests.push({
  name: 'No Firebase Admin SDK in helper / boundary / suggest / adapter / live-adapter',
  fn: () => {
    const files = [
      ['helper', cleanSource(helperCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['suggest', cleanSource(suggestCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
    ];
    const patterns = [
      /require\(['"]firebase-admin['"]\)/,
      /from\s+['"]firebase-admin['"]/,
      /require\(['"]firebase\/[^'"]+['"]\)/,
      /from\s+['"]firebase\/[^'"]+['"]/,
    ];
    for (const [name, code] of files) {
      for (const p of patterns) {
        assert.ok(!p.test(code), `${name} must not import Firebase Admin SDK (pattern: ${p})`);
      }
    }
  },
});

// ── 13. No KV / Durable Object / D1 runtime access ─────────────────────────
tests.push({
  name: 'No KV / Durable Object / D1 runtime access in any scout source file',
  fn: () => {
    const files = [
      ['helper', cleanSource(helperCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['suggest', cleanSource(suggestCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
    ];
    for (const [name, code] of files) {
      assert.ok(
        !/KVNamespace|DurableObject|D1Database|env\.KV|env\.DB|env\.DO/.test(code),
        `${name} must not reference KV/DO/D1 runtime APIs`
      );
      assert.ok(
        !/platform\.|wrangler\./.test(code),
        `${name} must not reference Cloudflare platform globals`
      );
    }
  },
});

// ── 14. No provider SDK imports ─────────────────────────────────────────────
tests.push({
  name: 'No provider SDK imports in any scout source file',
  fn: () => {
    const forbidden = [
      'openai', '@anthropic-ai/sdk', '@google/generative-ai', 'groq-sdk',
      '@mistralai/mistralai', 'nvidia-modulus', 'grok-client',
    ];
    const files = [
      ['helper', cleanSource(helperCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['suggest', cleanSource(suggestCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
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

// ── 15. No fetch / XHR / axios ──────────────────────────────────────────────
tests.push({
  name: 'No fetch / XHR / axios in any scout source file',
  fn: () => {
    const files = [
      ['helper', cleanSource(helperCode)],
      ['boundary', cleanSource(boundaryCode)],
      ['suggest', cleanSource(suggestCode)],
      ['adapter', cleanSource(adapterCode)],
      ['live-adapter', cleanSource(liveAdapterCode)],
    ];
    for (const [name, code] of files) {
      assert.ok(!/\bfetch\s*\(/.test(code), `${name} must not use fetch(`);
      assert.ok(!/XMLHttpRequest/.test(code), `${name} must not use XMLHttpRequest`);
      assert.ok(!/axios/.test(code), `${name} must not use axios`);
    }
  },
});

// ── 16. Related docs updated ────────────────────────────────────────────────
tests.push({
  name: 'Related docs reflect endpoint auth/rate-limit readiness audit status',
  fn: () => {
    for (const rel of RELATED_DOCS) {
      const filePath = path.join(ROOT, 'docs/product', rel);
      const content = readFileSafe(filePath);
      assert.ok(content.length > 0, `${rel} must exist`);
      const lc = content.toLowerCase();
      assert.ok(
        lc.includes('readiness audit') || lc.includes('readiness-audit'),
        `${rel} must mention the readiness audit`
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

run().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
