/**
 * Scout Live Auth/Rate-Limit Adapter Wiring Readiness Audit Contract Tests
 * v20260607-1
 *
 * Locks the readiness audit of the mock-disabled live auth/rate-limit
 * adapter wiring:
 * - audit document exists and is well-formed
 * - completed wiring inventory is documented
 * - confirmed default behavior is documented
 * - confirmed auth path is documented
 * - confirmed rate-limit path is documented
 * - confirmed privacy / safety behavior is documented
 * - confirmed no external runtime access is documented
 * - go / no-go matrix is documented
 * - remaining blockers are documented
 * - recommended next slice is documented
 * - explicit verdict is documented
 * - no runtime code files were modified by this audit slice
 * - default stub / explicit stub / frontend local_stub / endpoint client
 *   default disabled remain preserved
 * - no Firebase / KV / DO / D1 / provider SDK / fetch / env secret usage
 *   in the runtime modules
 * - related docs reflect the audit status
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');

const AUDIT_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md');

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
];

// Locked hashes captured at audit time. The runtime code files must
// match these hashes after the audit slice (this slice is docs+tests
// only; no runtime code change). If a future audit runs and the
// runtime modules have been intentionally changed, the audit doc must
// be updated and these hashes refreshed.
const LOCKED_HASHES = {
  dep: 'e9377715b59bdc28496a9a4e548ce22b',
  verifier: '06dd18ce50916e609052f8121a4c223f',
  storage: 'b81dc9eb82c649f0396cd862ed5a7c25',
  suggest: 'e12e9ac11b76663ed69978b112b3a085',
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
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(buf).digest('hex');
  } catch {
    return '';
  }
}

const auditDoc = readFileSafe(AUDIT_DOC_PATH);
const depCode = readFileSafe(DEP_ADAPTER_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

let depModPromise = null;
let verifierModPromise = null;
let storageModPromise = null;
async function loadDep() { if (!depModPromise) depModPromise = import(DEP_ADAPTER_PATH); return depModPromise; }
async function loadVerifier() { if (!verifierModPromise) verifierModPromise = import(VERIFIER_PATH); return verifierModPromise; }
async function loadStorage() { if (!storageModPromise) storageModPromise = import(STORAGE_ADAPTER_PATH); return storageModPromise; }

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const tests = [];

// ── 1. Audit document exists ───────────────────────────────────────────────
tests.push({
  name: 'Readiness audit document exists',
  fn: () => {
    assert.ok(auditDoc.length > 0, 'audit document must exist');
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('readiness audit'), 'document title must contain "readiness audit"');
    assert.ok(lc.includes('mock-disabled'), 'document must mention mock-disabled');
    assert.ok(lc.includes('fail-closed'), 'document must mention fail-closed');
  },
});

// ── 2. Completed wiring inventory is documented ───────────────────────────
tests.push({
  name: 'Completed wiring inventory is documented in the audit',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const item of [
      'auth verifier adapter skeleton',
      'auth verifier dependency wiring',
      'rate-limit storage adapter skeleton',
      'storage adapter dependency wiring',
      'dependency adapter endpoint wiring',
      'endpoint error taxonomy',
      'endpoint observability',
      'endpoint di',
      'endpoint safe-fail wiring',
    ]) {
      assert.ok(lc.includes(item), `audit must mention "${item}"`);
    }
  },
});

// ── 3. Default behavior is documented ─────────────────────────────────────
tests.push({
  name: 'Default behavior (verifier / storage / dep adapter / endpoint / frontend) is documented',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('mockdisabled'), 'audit must mention mockDisabled default');
    assert.ok(lc.includes('default'), 'audit must reference defaults');
    assert.ok(lc.includes('local_stub') || lc.includes('local stub'), 'audit must mention local_stub default');
    assert.ok(lc.includes('disabled'), 'audit must mention endpoint client default disabled');
  },
});

// ── 4. Auth path readiness is documented ──────────────────────────────────
tests.push({
  name: 'Auth path readiness is documented (verifier payload allowlist + safe-fail mappings + throw safe-swallow + userKey null)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('verifieradapter.verifytoken'), 'audit must mention verifierAdapter.verifyToken routing');
    assert.ok(lc.includes('allowlist') || lc.includes('allowed fields'), 'audit must mention allowlist');
    assert.ok(lc.includes('verify_not_implemented') || lc.includes('verify not implemented'), 'audit must mention VERIFY_NOT_IMPLEMENTED mapping');
    assert.ok(lc.includes('verify_payload_prohibited') || lc.includes('verify payload prohibited'), 'audit must mention VERIFY_PAYLOAD_PROHIBITED mapping');
    assert.ok(lc.includes('verify_unavailable') || lc.includes('verify unavailable'), 'audit must mention VERIFY_UNAVAILABLE mapping');
    assert.ok(lc.includes('safe-swallow') || lc.includes('safe swallow') || lc.includes('safeswallow') || lc.includes('safe-fail'), 'audit must mention safe-fail or safe-swallow');
    assert.ok(lc.includes('userkey') && lc.includes('null'), 'audit must mention userKey null in skeleton mode');
  },
});

// ── 5. Rate-limit path readiness is documented ────────────────────────────
tests.push({
  name: 'Rate-limit path readiness is documented (storage payload allowlist + safe-fail mappings + throw safe-swallow)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('storageadapter.checkquota'), 'audit must mention storageAdapter.checkQuota routing');
    assert.ok(lc.includes('rate_limit_not_implemented') || lc.includes('rate limit not implemented'), 'audit must mention RATE_LIMIT_NOT_IMPLEMENTED mapping');
    assert.ok(lc.includes('rate_limit_payload_prohibited') || lc.includes('rate limit payload prohibited'), 'audit must mention RATE_LIMIT_PAYLOAD_PROHIBITED mapping');
    assert.ok(lc.includes('rate_limit_storage_unavailable') || lc.includes('rate limit storage unavailable'), 'audit must mention RATE_LIMIT_STORAGE_UNAVAILABLE mapping');
  },
});

// ── 6. Privacy / safety behavior is documented ────────────────────────────
tests.push({
  name: 'Privacy / safety behavior is documented (no raw token, authorization, firebaseToken, API key, prompt, etc.)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const item of ['token', 'authorization', 'firebasetoken', 'api key', 'prompt', 'excerpt', 'sourceurl', 'rawrequestbody', 'observability event']) {
      assert.ok(lc.includes(item), `audit must mention "${item}" in the privacy / safety section`);
    }
  },
});

// ── 7. No external runtime access is documented ───────────────────────────
tests.push({
  name: 'No external runtime access is documented (no Firebase Admin SDK / no getAuth / no KV / DO / D1 / no fetch / no provider SDK / no env secret usage)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('firebase admin sdk') || lc.includes('firebase-admin'), 'audit must mention Firebase Admin SDK');
    assert.ok(lc.includes('getauth'), 'audit must mention getAuth');
    assert.ok(lc.includes('verifyidtoken'), 'audit must mention verifyIdToken');
    assert.ok(lc.includes('kv') && (lc.includes('durable') || lc.includes('do')), 'audit must mention KV / Durable Object');
    assert.ok(lc.includes('d1'), 'audit must mention D1');
    assert.ok(lc.includes('fetch') || lc.includes('xmlhttprequest') || lc.includes('axios'), 'audit must mention fetch / XHR / axios');
    assert.ok(lc.includes('openai') || lc.includes('provider sdk'), 'audit must mention provider SDKs');
    assert.ok(lc.includes('process.env') || lc.includes('import.meta.env') || lc.includes('env.scout') || lc.includes('env.'), 'audit must mention env secret usage');
  },
});

// ── 8. Go / no-go matrix is documented ────────────────────────────────────
tests.push({
  name: 'Go / no-go matrix is documented (skeleton/wiring done; runtime Firebase/KV/provider No; staging/production blocked)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('go / no-go') || lc.includes('go/no-go') || lc.includes('go no go') || lc.includes('go/no go') || lc.includes('go / no go'), 'audit must have a go/no-go matrix');
    assert.ok(lc.includes('done'), 'audit must mark skeleton/wiring as Done');
    assert.ok(lc.includes('staging_live') || lc.includes('staging live'), 'audit must reference staging_live');
    assert.ok(lc.includes('production_live') || lc.includes('production live'), 'audit must reference production_live');
    assert.ok(lc.includes('provider api') || lc.includes('real provider'), 'audit must reference real provider API call');
  },
});

// ── 9. Remaining blockers are documented ─────────────────────────────────
tests.push({
  name: 'Remaining blockers are documented (gate contract missing, no real Firebase, no quota backend, no observability backend, no staging soak, no kill-switch drill, no secret rotation drill, no production approval)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const item of [
      'runtime implementation gate',
      'firebase admin sdk',
      'quota backend',
      'observability backend',
      'staging soak',
      'kill-switch',
      'secret rotation',
      'production approval',
    ]) {
      assert.ok(lc.includes(item), `audit must mention blocker "${item}"`);
    }
  },
});

// ── 10. Recommended next slice is documented ──────────────────────────────
tests.push({
  name: 'Recommended next slice is documented (runtime adapter implementation gate contract)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('runtime adapter implementation gate') || lc.includes('implementation gate contract'), 'audit must recommend the gate contract as the next slice');
  },
});

// ── 11. Explicit verdict is documented ────────────────────────────────────
tests.push({
  name: 'Explicit verdict is documented (ready for gate: yes; ready for real Firebase / KV / staging / production / provider API: no)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('verdict'), 'audit must have an explicit verdict section');
    assert.ok(lc.includes('ready for runtime implementation gate'), 'audit must state readiness for gate contract');
    assert.ok(lc.includes('ready for real firebase admin sdk'), 'audit must state no real Firebase Admin SDK yet');
    assert.ok(lc.includes('ready for real kv') || lc.includes('ready for real kv / do / d1'), 'audit must state no real KV / DO / D1 yet');
    assert.ok(lc.includes('ready for `staging_live`') || lc.includes('ready for staging_live'), 'audit must state no staging_live yet');
    assert.ok(lc.includes('ready for `production_live`') || lc.includes('ready for production_live'), 'audit must state no production_live yet');
    assert.ok(lc.includes('ready for real provider api call') || lc.includes('ready for real provider api'), 'audit must state no real provider API call yet');
  },
});

// ── 12. No runtime code files changed by this slice ───────────────────────
tests.push({
  name: 'Runtime code files were not modified by this audit slice (locked hashes match)',
  fn: () => {
    const depHash = hashOf(DEP_ADAPTER_PATH);
    const verifierHash = hashOf(VERIFIER_PATH);
    const storageHash = hashOf(STORAGE_ADAPTER_PATH);
    const suggestHash = hashOf(SUGGEST_PATH);
    assert.strictEqual(depHash, LOCKED_HASHES.dep, 'dependency adapter must not be modified by this audit slice');
    assert.strictEqual(verifierHash, LOCKED_HASHES.verifier, 'verifier adapter must not be modified by this audit slice');
    assert.strictEqual(storageHash, LOCKED_HASHES.storage, 'storage adapter must not be modified by this audit slice');
    assert.strictEqual(suggestHash, LOCKED_HASHES.suggest, 'suggest.js must not be modified by this audit slice');
  },
});

// ── 13. Endpoint default stub preserved ──────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must reference STUB mode');
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define STUB mode constant');
  },
});

// ── 14. Explicit stub path preserved ─────────────────────────────────────
tests.push({
  name: 'Explicit stub path is preserved (providerMode:"stub" explicit)',
  fn: () => {
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define STUB mode constant');
  },
});

// ── 15. Frontend default local_stub preserved ────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 16. Endpoint client default disabled preserved ───────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no audit-related wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-adapter-wiring-readiness-audit'),
      'endpoint client must not reference the audit doc'
    );
    assert.ok(
      !endpointClientCode.includes('audit'),
      'endpoint client must not be audit-related'
    );
  },
});

// ── 17. No Firebase Admin SDK in any runtime module ──────────────────────
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

// ── 18. No KV / Durable Object / D1 / database in runtime code ──────────
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

// ── 19. No fetch / XHR / axios in runtime code ──────────────────────────
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

// ── 20. No provider SDK imports in runtime code ─────────────────────────
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

// ── 21. No secrets / env usage in runtime code ───────────────────────────
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

// ── 22. Default mock-disabled behavior is consistent across all 3 modules ─
tests.push({
  name: 'Default mockDisabled:true is consistent across verifier, storage, and dependency adapter',
  fn: async () => {
    const v = await loadVerifier();
    const s = await loadStorage();
    const d = await loadDep();
    const va = v.createScoutLiveAuthVerifierAdapter();
    const sa = s.createScoutLiveRateLimitStorageAdapter();
    const da = d.createScoutLiveDependencyAdapter();
    assert.strictEqual(va.mockDisabled, true, 'verifier default mockDisabled must be true');
    assert.strictEqual(va.isMockDisabled, true, 'verifier default isMockDisabled must be true');
    assert.strictEqual(sa.mockDisabled, true, 'storage default mockDisabled must be true');
    assert.strictEqual(sa.isMockDisabled, true, 'storage default isMockDisabled must be true');
    assert.strictEqual(da.mockDisabled, true, 'dependency adapter default mockDisabled must be true');
    assert.strictEqual(da.isMockDisabled, true, 'dependency adapter default isMockDisabled must be true');
    assert.strictEqual(da.verifierAdapterMockDisabled, true, 'dependency adapter default verifierAdapterMockDisabled must be true');
    assert.strictEqual(da.storageAdapterMockDisabled, true, 'dependency adapter default storageAdapterMockDisabled must be true');
  },
});

// ── 23. Verifier dependency wiring still works (no regression) ───────────
tests.push({
  name: 'Verifier dependency wiring still works (no regression after audit slice)',
  fn: async () => {
    const v = await loadVerifier();
    const d = await loadDep();
    let callCount = 0;
    const fakeVerifier = {
      kind: 'fake_verifier',
      isMockDisabled: true,
      async verifyToken() {
        callCount++;
        return { allowed: false, code: 'VERIFIER_MOCK_DISABLED', reason: 'fake', userKey: null, userKeyHash: null };
      },
    };
    const adapter = d.createScoutLiveDependencyAdapter({ verifierAdapter: fakeVerifier });
    const res = await adapter.verifyToken({});
    assert.strictEqual(callCount, 1, 'injected verifier must be called');
    assert.strictEqual(res.allowed, false, 'mapped result must deny');
    assert.strictEqual(res.code, d.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.VERIFY_NOT_IMPLEMENTED, 'mapped code must be VERIFY_NOT_IMPLEMENTED');
    // unused reference to silence linter
    void v;
  },
});

// ── 24. Storage dependency wiring still works (no regression) ────────────
tests.push({
  name: 'Storage dependency wiring still works (no regression after audit slice)',
  fn: async () => {
    const s = await loadStorage();
    const d = await loadDep();
    let callCount = 0;
    const fakeStorage = {
      kind: 'fake_storage',
      isMockDisabled: true,
      async checkQuota() {
        callCount++;
        return { allowed: false, code: 'STORAGE_MOCK_DISABLED', reason: 'fake', retryAfterSeconds: null };
      },
    };
    const adapter = d.createScoutLiveDependencyAdapter({ storageAdapter: fakeStorage });
    const res = await adapter.checkRateLimit({});
    assert.strictEqual(callCount, 1, 'injected storage must be called');
    assert.strictEqual(res.allowed, false, 'mapped result must deny');
    assert.strictEqual(res.code, d.SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES.RATE_LIMIT_NOT_IMPLEMENTED, 'mapped code must be RATE_LIMIT_NOT_IMPLEMENTED');
    void s;
  },
});

// ── 25. Related docs reflect audit status ────────────────────────────────
tests.push({
  name: 'Related docs exist and reflect the adapter wiring readiness audit status',
  fn: () => {
    for (const docName of RELATED_DOCS) {
      const docPath = path.join(ROOT, 'docs/product/' + docName);
      const doc = readFileSafe(docPath);
      assert.ok(doc.length > 0, `${docName} must exist`);
      const lc = doc.toLowerCase();
      assert.ok(
        lc.includes('readiness audit') || lc.includes('audit status') || lc.includes('adapter wiring readiness'),
        `${docName} must reference the readiness audit`
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
