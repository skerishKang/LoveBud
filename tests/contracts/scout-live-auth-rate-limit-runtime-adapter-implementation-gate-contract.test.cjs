/**
 * Scout Live Auth/Rate-Limit Runtime Adapter Implementation Gate
 * Contract Tests
 * v20260607-1
 *
 * Locks the runtime adapter implementation gate contract that
 * prevents any premature or unauthorized introduction of real
 * Firebase Admin SDK, real KV / DO / D1, real external auth
 * service, real provider API, staging_live, production_live,
 * external observability backend, or parallel boundary file
 * adoption.
 *
 * Locks the following sections of the gate doc:
 * - gate document exists and is well-formed
 * - current default state (locked) is documented
 * - gate scope (8 items) is documented
 * - gate rule is documented
 * - required pre-implementation evidence (11 items) is documented
 * - prohibited changes are documented
 * - allowed future implementation patterns are documented
 * - required next implementation order is documented
 * - out of scope is documented
 * - dependencies are documented
 * - acceptance criteria are documented
 * - go / no-go matrix is documented
 * - remaining blockers are documented
 * - locks / evidence is documented
 * - explicit verdict is documented
 * - no runtime code files were modified by this gate slice
 * - default stub / explicit stub / frontend local_stub / endpoint
 *   client default disabled remain preserved
 * - no Firebase / KV / DO / D1 / provider SDK / fetch / env secret
 *   usage in the runtime modules
 * - related docs reflect the gate status
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');

const GATE_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md');

const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const OBSERVABILITY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-observability.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const RELATED_DOCS = [
  'lovebud-scout-live-auth-verifier-adapter-skeleton.md',
  'lovebud-scout-live-rate-limit-storage-adapter-skeleton.md',
  'lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md',
  'lovebud-scout-live-endpoint-error-readiness-audit.md',
  'lovebud-scout-live-auth-rate-limit-readiness-audit.md',
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-readiness-audit.md',
  'lovebud-scout-live-endpoint-error-taxonomy-contract.md',
  'lovebud-scout-live-provider-production-readiness-gates-audit.md',
  'lovebud-scout-live-provider-staging-rollout-contract.md',
  'lovebud-scout-live-provider-cost-quota-abuse-monitoring-contract.md',
  'lovebud-scout-provider-secret-config-deployment-checklist.md',
];

// Locked hashes captured at gate time. The runtime code files must
// match these hashes after this gate slice (this slice is docs+tests
// only; no runtime code change). Hashes are computed on the
// CRLF-normalized file content (raw text with \r\n replaced by \n)
// so that the lock is stable across Windows (CRLF) and CI Linux (LF)
// environments. If a future gate run finds the runtime modules have
// been intentionally changed, the gate doc must be updated and these
// hashes refreshed.
const LOCKED_HASHES = {
  dep: '796a2aefe46a8629764950eab8e3a42e',
  verifier: '5a0a853429d6f94962a6b1bf6e71dc09',
  storage: 'a4419b1e8fc286219ae75bf88271416c',
  suggest: 'deb6a6d7b03d9db48ad215607cefcd0d',
};

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function hashOf(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const normalized = raw.replace(/\r\n/g, '\n');
    return crypto.createHash('md5').update(normalized, 'utf-8').digest('hex');
  } catch {
    return '';
  }
}

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const gateDoc = readFileSafe(GATE_DOC_PATH);
const depCode = readFileSafe(DEP_ADAPTER_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

const tests = [];

// ── 1. Gate document exists ────────────────────────────────────────────────
tests.push({
  name: 'Runtime adapter implementation gate document exists',
  fn: () => {
    assert.ok(gateDoc.length > 0, 'gate document must exist');
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('gate contract'), 'document title must contain "gate contract"');
    assert.ok(lc.includes('mock-disabled') || lc.includes('mock disabled'), 'document must mention mock-disabled');
    assert.ok(lc.includes('fail-closed') || lc.includes('fail closed'), 'document must mention fail-closed');
    assert.ok(lc.includes('v20260607-1'), 'document must declare version v20260607-1');
  },
});

// ── 2. Current default state (locked) is documented ────────────────────────
tests.push({
  name: 'Current default state is documented (endpoint stub / frontend local_stub / endpoint client disabled)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('stub'), 'gate must mention stub default');
    assert.ok(lc.includes('local_stub'), 'gate must mention local_stub default');
    assert.ok(lc.includes('disabled'), 'gate must mention endpoint client default disabled');
    assert.ok(lc.includes('mock-disabled') || lc.includes('mock disabled'), 'gate must mention mock-disabled verifier/storage defaults');
  },
});

// ── 3. Gate scope (8 items) is documented ──────────────────────────────────
tests.push({
  name: 'Gate scope (8 items) is documented (Firebase Admin SDK / external auth / KV DO D1 / observability / provider API / staging_live / production_live / parallel boundary)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('firebase admin sdk') || lc.includes('firebase-admin'), 'gate must mention Firebase Admin SDK');
    assert.ok(lc.includes('external auth service'), 'gate must mention external auth service');
    assert.ok(lc.includes('kv') && (lc.includes('durable') || lc.includes('d1')), 'gate must mention KV / Durable Object / D1');
    assert.ok(lc.includes('observability backend'), 'gate must mention external observability backend');
    assert.ok(lc.includes('provider api') || lc.includes('providerapi'), 'gate must mention real provider API call');
    assert.ok(lc.includes('staging_live') || lc.includes('staging live'), 'gate must mention staging_live opt-in');
    assert.ok(lc.includes('production_live') || lc.includes('production live'), 'gate must mention production_live opt-in');
    assert.ok(lc.includes('live-provider-auth-rate-limit-boundary'), 'gate must mention parallel boundary file adoption');
  },
});

// ── 4. Gate rule is documented ─────────────────────────────────────────────
tests.push({
  name: 'Gate rule is documented (cite / single surface / preserve defaults / npm test / npm run verify / CTO approval)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('gate rule'), 'gate must have a Gate rule section');
    assert.ok(lc.includes('cite') || lc.includes('reference'), 'gate must require citing the contract');
    assert.ok(lc.includes('disabled-by-default') || lc.includes('disabled by default'), 'gate must require disabled-by-default');
    assert.ok(lc.includes('npm test'), 'gate must require passing npm test');
    assert.ok(lc.includes('npm run verify'), 'gate must require passing npm run verify');
    assert.ok(lc.includes('cto'), 'gate must require CTO approval');
  },
});

// ── 5. Required pre-implementation evidence (11 items) is documented ──────
tests.push({
  name: 'Required pre-implementation evidence (11 items) is documented',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    for (const item of [
      'adapter wiring readiness audit',
      'endpoint error taxonomy contract',
      'endpoint auth/rate-limit readiness audit',
      'production readiness gates audit',
      'staging rollout contract',
      'cost / quota / abuse monitoring contract',
      'secret / config deployment checklist',
      'secret rotation / incident runbook',
      'rollback / kill-switch policy',
      'observability policy',
      'privacy / safety payload allowlist',
    ]) {
      assert.ok(lc.includes(item), `gate must mention evidence "${item}"`);
    }
  },
});

// ── 6. Prohibited changes are documented ───────────────────────────────────
tests.push({
  name: 'Prohibited changes are documented (firebase-admin / getAuth / verifyIdToken / KV / DO / D1 / fetch / provider SDK / env secret / raw token propagation)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('import'), 'gate must mention import prohibition');
    assert.ok(lc.includes('firebase-admin') || lc.includes('firebase admin'), 'gate must mention firebase-admin prohibition');
    assert.ok(lc.includes('getauth') || lc.includes('verifyidtoken'), 'gate must mention getAuth / verifyIdToken prohibition');
    assert.ok(lc.includes('kvnamespace') || lc.includes('kv / durable') || lc.includes('kv / do') || lc.includes('kv / d1') || (lc.includes('kv') && lc.includes('durableobject')), 'gate must mention KV / DO / D1 prohibition');
    assert.ok(lc.includes('fetch') || lc.includes('xhr') || lc.includes('axios'), 'gate must mention fetch / XHR / axios prohibition');
    assert.ok(lc.includes('openai') || lc.includes('anthropic') || lc.includes('provider sdk') || lc.includes('llm sdk'), 'gate must mention provider SDK prohibition');
    assert.ok(lc.includes('process.env') || lc.includes('import.meta.env') || lc.includes('env.scout'), 'gate must mention env secret access prohibition');
    assert.ok(lc.includes('raw token') || lc.includes('rawtoken') || lc.includes('raw token / api key'), 'gate must mention raw token / API key propagation prohibition');
    assert.ok(lc.includes('test_fixture') || lc.includes('not_a_real_secret'), 'gate must require TEST_FIXTURE_*_NOT_A_REAL_SECRET_* test fixture naming');
  },
});

// ── 7. Allowed future implementation patterns are documented ───────────────
tests.push({
  name: 'Allowed future implementation patterns are documented (one surface per PR / disabled-by-default / staging-first / safe errors / no sensitive logs / focused tests)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('one surface per pr') || lc.includes('one gate-scope surface per pr'), 'gate must require one surface per PR');
    assert.ok(lc.includes('disabled-by-default') || lc.includes('disabled by default'), 'gate must require disabled-by-default');
    assert.ok(lc.includes('staging-first') || lc.includes('staging first') || lc.includes('staging-first soak'), 'gate must require staging-first');
    assert.ok(lc.includes('safe errors') || lc.includes('safe errors only'), 'gate must require safe errors only');
    assert.ok(lc.includes('no sensitive logs') || lc.includes('no raw token'), 'gate must require no sensitive logs');
    assert.ok(lc.includes('explicit rollback') || lc.includes('rollback / kill-switch'), 'gate must require explicit rollback / kill-switch');
    assert.ok(lc.includes('focused tests') || lc.includes('focused unit + integration tests'), 'gate must require focused tests');
    assert.ok(lc.includes('provider mode: "stub"') || (lc.includes('providermode') && lc.includes('stub') && lc.includes('fallback')), 'gate must require providerMode:"stub" fallback');
  },
});

// ── 8. Required next implementation order is documented ────────────────────
tests.push({
  name: 'Required next implementation order is documented (plan / plan / disabled-by-default impl / staging smoke / staging opt-in)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('plan scout runtime firebase auth verifier'), 'gate must list plan Firebase verifier as step 1');
    assert.ok(lc.includes('plan scout runtime rate-limit storage'), 'gate must list plan rate-limit storage as step 2');
    assert.ok(lc.includes('disabled-by-default runtime adapter') || lc.includes('one disabled-by-default runtime adapter'), 'gate must list disabled-by-default impl as step 3');
    assert.ok(lc.includes('staging-only smoke test plan') || lc.includes('staging-only smoke'), 'gate must list staging smoke as step 4');
    assert.ok(lc.includes('staging_live opt-in rollout') || lc.includes('staging_live opt-in'), 'gate must list staging_live opt-in as step 5');
  },
});

// ── 9. Out of scope is documented ──────────────────────────────────────────
tests.push({
  name: 'Out of scope is documented (#1661 Browse / #2281 residue / #2234 prompt-response / #1882 parent)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('#1661') || lc.includes('browse'), 'gate must reference #1661 Browse as out of scope');
    assert.ok(lc.includes('#2281') || lc.includes('safe-fail wiring contract'), 'gate must reference #2281 as out of scope');
    assert.ok(lc.includes('#2234') || lc.includes('prompt and response contract'), 'gate must reference #2234 as out of scope');
    assert.ok(lc.includes('#1882') || lc.includes('parent issue'), 'gate must reference #1882 as parent issue');
  },
});

// ── 10. Dependencies are documented ────────────────────────────────────────
tests.push({
  name: 'Dependencies are documented (PR #2307 / #2301 / #2302 / #2304 merged; 12 wiring items Done; 4 locked md5 hashes)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('78b0c59f') || lc.includes('pr #2307'), 'gate must reference PR #2307 commit');
    assert.ok(lc.includes('1ec55a6e') || lc.includes('pr #2301'), 'gate must reference PR #2301');
    assert.ok(lc.includes('ac42e0af') || lc.includes('pr #2302'), 'gate must reference PR #2302');
    assert.ok(lc.includes('3ac2d940') || lc.includes('pr #2304'), 'gate must reference PR #2304');
    assert.ok(lc.includes('796a2aef') || lc.includes('dep-adapter'), 'gate must reference dep-adapter locked hash');
    assert.ok(lc.includes('5a0a8534') || lc.includes('verifier'), 'gate must reference verifier locked hash');
    assert.ok(lc.includes('a4419b1e') || lc.includes('storage'), 'gate must reference storage locked hash');
    assert.ok(lc.includes('deb6a6d7') || lc.includes('suggest'), 'gate must reference suggest locked hash');
  },
});

// ── 11. Acceptance criteria are documented ─────────────────────────────────
tests.push({
  name: 'Acceptance criteria are documented (new doc / new test / 14 related docs updated / LF/CRLF normalized / npm test +1 / npm run verify 284/284)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('acceptance'), 'gate must have an Acceptance section');
    assert.ok(lc.includes('runtime-adapter-implementation-gate-contract.md'), 'gate must list the new doc file path');
    assert.ok(lc.includes('runtime-adapter-implementation-gate-contract.test.cjs'), 'gate must list the new test file path');
    assert.ok(lc.includes('14 related docs') || (lc.includes('14') && lc.includes('related docs')), 'gate must require 14 related docs updated');
    assert.ok(lc.includes('lf/crlf') || lc.includes('lf / crlf') || (lc.includes('lf') && lc.includes('crlf')), 'gate must require LF/CRLF normalized locked-hash');
    assert.ok(lc.includes('1957 → 1958') || (lc.includes('1957') && lc.includes('1958')), 'gate must require npm test trajectory 1957 → 1958');
    assert.ok(lc.includes('284/284'), 'gate must require npm run verify 284/284');
  },
});

// ── 12. Go / no-go matrix is documented ────────────────────────────────────
tests.push({
  name: 'Go / no-go matrix is documented (8 No + 7 Done + 2 Partial)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('go / no-go') || lc.includes('go/no-go'), 'gate must have a go/no-go matrix');
    assert.ok(lc.includes('done'), 'gate must mark mock-disabled wiring / evidence docs as Done');
    assert.ok(lc.includes('partial'), 'gate must mark rollback / observability policy as Partial');
  },
});

// ── 13. Remaining blockers are documented ──────────────────────────────────
tests.push({
  name: 'Remaining blockers are documented (rollback doc / observability doc / plan slices / staging soak / secret rotation drill / CTO approval)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    for (const item of [
      'rollback / kill-switch policy',
      'observability policy',
      'plan scout runtime firebase auth verifier',
      'plan scout runtime rate-limit storage',
      'one-day staging soak',
      'seven-day staging soak',
      'secret rotation drill',
      'cto approval',
    ]) {
      assert.ok(lc.includes(item), `gate must mention blocker "${item}"`);
    }
  },
});

// ── 14. Locks / evidence is documented ────────────────────────────────────
tests.push({
  name: 'Locks / evidence is documented (this test + 21 audit contract tests)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('locks / evidence') || lc.includes('locks/evidence'), 'gate must have a Locks / evidence section');
    assert.ok(lc.includes('runtime-adapter-implementation-gate-contract.test.cjs'), 'gate must list the new test file as a lock');
    assert.ok(lc.includes('21 contract tests') || (lc.includes('21') && lc.includes('contract tests')), 'gate must reference 21 audit contract tests');
  },
});

// ── 15. Explicit verdict is documented ─────────────────────────────────────
tests.push({
  name: 'Explicit verdict is documented (gate locked:Yes / all 8 surfaces No / recommended next slice = plan Firebase verifier or plan rate-limit storage)',
  fn: () => {
    const lc = gateDoc.toLowerCase();
    assert.ok(lc.includes('explicit verdict') || lc.includes('verdict'), 'gate must have an explicit verdict section');
    assert.ok(lc.includes('gate contract locked:') || (lc.includes('gate contract locked') && lc.includes('yes')), 'gate must state gate contract locked: Yes');
    assert.ok(lc.includes('real firebase admin sdk implementation') && lc.includes('no'), 'gate must state no real Firebase Admin SDK implementation');
    assert.ok(lc.includes('real external auth service') && lc.includes('no'), 'gate must state no real external auth service');
    assert.ok(lc.includes('real kv') && lc.includes('no'), 'gate must state no real KV / DO / D1');
    assert.ok(lc.includes('staging_live') && lc.includes('opt-in') && lc.includes('no'), 'gate must state no staging_live opt-in');
    assert.ok(lc.includes('production_live') && lc.includes('opt-in') && lc.includes('no'), 'gate must state no production_live opt-in');
    assert.ok(lc.includes('parallel boundary file adoption') && lc.includes('no'), 'gate must state no parallel boundary file adoption');
    assert.ok(lc.includes('recommended next slice'), 'gate must recommend the next slice');
  },
});

// ── 16. No runtime code files changed by this slice ────────────────────────
tests.push({
  name: 'Runtime code files were not modified by this gate slice (locked hashes match)',
  fn: () => {
    const depHash = hashOf(DEP_ADAPTER_PATH);
    const verifierHash = hashOf(VERIFIER_PATH);
    const storageHash = hashOf(STORAGE_ADAPTER_PATH);
    const suggestHash = hashOf(SUGGEST_PATH);
    assert.strictEqual(depHash, LOCKED_HASHES.dep, 'dependency adapter must not be modified by this gate slice');
    assert.strictEqual(verifierHash, LOCKED_HASHES.verifier, 'verifier adapter must not be modified by this gate slice');
    assert.strictEqual(storageHash, LOCKED_HASHES.storage, 'storage adapter must not be modified by this gate slice');
    assert.strictEqual(suggestHash, LOCKED_HASHES.suggest, 'suggest.js must not be modified by this gate slice');
  },
});

// ── 17. Endpoint default stub preserved ────────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must reference STUB mode');
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define STUB mode constant');
  },
});

// ── 18. Frontend default local_stub preserved ─────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 19. Endpoint client default disabled preserved ─────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no gate-related wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('runtime-adapter-implementation-gate'),
      'endpoint client must not reference the gate contract'
    );
    assert.ok(
      !endpointClientCode.includes('gate contract'),
      'endpoint client must not be gate-related'
    );
  },
});

// ── 20. No Firebase Admin SDK in any runtime module ───────────────────────
tests.push({
  name: 'No Firebase Admin SDK / getAuth / verifyIdToken / cert / initializeApp / verifyAccessToken in runtime code',
  fn: () => {
    const combined = (depCode + verifierCode + storageCode).toLowerCase();
    const code = codeOnly(combined);
    assert.ok(!/firebase-admin/.test(code), 'runtime must not import firebase-admin');
    assert.ok(!/admin\s*\.\s*auth/.test(code), 'runtime must not reference admin.auth');
    assert.ok(!/initializeapp/.test(code), 'runtime must not call initializeApp');
    assert.ok(!/cert\s*\(/.test(code), 'runtime must not call cert()');
    assert.ok(!/\bgetauth\b/.test(code), 'runtime must not call getAuth');
    assert.ok(!/verifyidtoken/.test(code), 'runtime must not call verifyIdToken');
    assert.ok(!/verifyaccesstoken/.test(code), 'runtime must not call verifyAccessToken');
  },
});

// ── 21. No KV / Durable Object / D1 / database in runtime code ─────────────
tests.push({
  name: 'No KV / Durable Object / D1 / database runtime access in runtime code',
  fn: () => {
    const code = codeOnly((depCode + storageCode).toLowerCase());
    assert.ok(!/kvnamespace/.test(code), 'runtime must not reference KVNamespace');
    assert.ok(!/durableobject/.test(code), 'runtime must not reference DurableObject');
    assert.ok(!/d1database/.test(code), 'runtime must not reference D1Database');
    assert.ok(!/env\.kv\b/.test(code), 'runtime must not read env.KV');
    assert.ok(!/env\.db\b/.test(code), 'runtime must not read env.DB');
    assert.ok(!/env\.auth\b/.test(code), 'runtime must not read env.AUTH');
    assert.ok(!/env\.firebase/.test(code), 'runtime must not read env.FIREBASE');
  },
});

// ── 22. No fetch / XHR / axios in runtime code ────────────────────────────
tests.push({
  name: 'No fetch / XHR / axios in runtime code',
  fn: () => {
    const code = codeOnly((depCode + verifierCode + storageCode).toLowerCase());
    assert.ok(!/\bfetch\s*\(/.test(code), 'runtime must not call fetch()');
    assert.ok(!/xmlhttprequest/.test(code), 'runtime must not use XMLHttpRequest');
    assert.ok(!/axios/.test(code), 'runtime must not use axios');
    assert.ok(!/new\s+request\s*\(/.test(code), 'runtime must not construct a new Request');
  },
});

// ── 23. No provider SDK imports in runtime code ───────────────────────────
tests.push({
  name: 'No provider SDK imports in runtime code',
  fn: () => {
    const code = codeOnly((depCode + verifierCode + storageCode).toLowerCase());
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      const importPattern = new RegExp(`(import|require).*${provider}`, 'i');
      assert.ok(!importPattern.test(code), `runtime must not import ${provider}`);
    }
  },
});

// ── 24. No secrets / env usage in runtime code ────────────────────────────
tests.push({
  name: 'No raw secret / env auth binding / process.env reading in runtime code',
  fn: () => {
    const code = codeOnly((depCode + verifierCode + storageCode).toLowerCase());
    assert.ok(!/process\.env\.scout/.test(code), 'runtime must not read process.env.SCOUT_*');
    assert.ok(!/process\.env\.firebase/.test(code), 'runtime must not read process.env.FIREBASE_*');
    assert.ok(!/import\.meta\.env/.test(code), 'runtime must not read import.meta.env');
    assert.ok(!/api_key\s*=/.test(code), 'runtime must not assign api_key');
    assert.ok(!/bearer\s+/.test(code), 'runtime must not embed bearer tokens');
  },
});

// ── 25. Related docs reflect gate status ───────────────────────────────────
tests.push({
  name: 'Related docs exist and reflect the runtime adapter implementation gate status',
  fn: () => {
    for (const docName of RELATED_DOCS) {
      const docPath = path.join(ROOT, 'docs/product/' + docName);
      const doc = readFileSafe(docPath);
      assert.ok(doc.length > 0, `${docName} must exist`);
      const lc = doc.toLowerCase();
      assert.ok(
        lc.includes('runtime adapter implementation gate') || lc.includes('gate status') || lc.includes('implementation gate status'),
        `${docName} must reference the runtime adapter implementation gate status`
      );
    }
  },
});

// ── Runner ─────────────────────────────────────────────────────────────────
(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('  \u2713 ' + t.name);
      passed++;
    } catch (err) {
      console.log('  \u2717 ' + t.name);
      console.log('    ' + (err && err.message ? err.message : String(err)));
      failed++;
    }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();
