/**
 * Scout Rollback / Kill-Switch Policy Audit Contract Tests
 * v20260607-1
 *
 * Locks the rollback / kill-switch policy audit slice:
 * - audit document exists and is well-formed
 * - current safe baseline is documented
 * - gate alignment is documented (cited, complete evidence, missing
 *   evidence)
 * - kill-switch surfaces are documented
 * - required future kill-switch controls are documented
 * - rollback baseline is documented
 * - incident rollback decision tree is documented
 * - secret / config rollback policy is documented
 * - quota / cost rollback policy is documented
 * - auth verifier rollback policy is documented
 * - rate-limit storage rollback policy is documented
 * - provider API rollback policy is documented
 * - observability rollback policy is documented
 * - staging / prod rollback policy is documented
 * - privacy / safety during rollback is documented
 * - required future tests are documented
 * - go / no-go matrix is documented
 * - remaining blockers are documented
 * - locks / evidence is documented
 * - branch safety reminder is documented
 * - explicit verdict is documented
 * - no runtime code files were modified by this audit slice
 * - default stub / explicit stub / frontend local_stub / endpoint
 *   client default disabled remain preserved
 * - no Firebase / KV / DO / D1 / provider SDK / fetch / env secret
 *   usage in the runtime modules
 * - related docs reflect the audit status
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');

const AUDIT_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-rollback-kill-switch-policy-audit.md');
const GATE_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md');
const FIREBASE_PLAN_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md');
const STORAGE_PLAN_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-runtime-rate-limit-storage-implementation-plan.md');

const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const OBSERVABILITY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-observability.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const RELATED_DOCS = [
  'lovebud-scout-runtime-rate-limit-storage-implementation-plan.md',
  'lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md',
  'lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md',
  'lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md',
  'lovebud-scout-live-provider-production-readiness-gates-audit.md',
  'lovebud-scout-live-provider-staging-rollout-contract.md',
  'lovebud-scout-provider-secret-config-deployment-checklist.md',
  'lovebud-scout-live-provider-cost-quota-abuse-monitoring-contract.md',
  'lovebud-scout-live-rate-limit-storage-adapter-skeleton.md',
  'lovebud-scout-live-auth-verifier-adapter-skeleton.md',
  'lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-readiness-audit.md',
];

// Locked hashes captured at audit time. The runtime code files must
// match these hashes after this audit slice (this slice is docs+tests
// only; no runtime code change). Hashes are computed on the
// CRLF-normalized file content (raw text with \r\n replaced by \n)
// so that the lock is stable across Windows (CRLF) and CI Linux (LF)
// environments. If a future audit runs and the runtime modules have
// been intentionally changed, the audit doc must be updated and these
// hashes refreshed.
const LOCKED_HASHES = {
  dep: 'd20edde7af022100fcbe69763a04c589',
  verifier: '81f80368fe80bb8a770b251efc085509',
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

const auditDoc = readFileSafe(AUDIT_DOC_PATH);
const gateDoc = readFileSafe(GATE_DOC_PATH);
const firebasePlanDoc = readFileSafe(FIREBASE_PLAN_DOC_PATH);
const storagePlanDoc = readFileSafe(STORAGE_PLAN_DOC_PATH);
const depCode = readFileSafe(DEP_ADAPTER_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

const tests = [];

// ── 1. Audit document exists ───────────────────────────────────────────────
tests.push({
  name: 'Rollback / kill-switch policy audit document exists',
  fn: () => {
    assert.ok(auditDoc.length > 0, 'audit document must exist');
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('audit') && (lc.includes('rollback') || lc.includes('kill-switch')), 'document must mention audit + rollback / kill-switch');
    assert.ok(lc.includes('mock-disabled') || lc.includes('mock disabled'), 'document must mention mock-disabled');
    assert.ok(lc.includes('fail-closed') || lc.includes('fail closed'), 'document must mention fail-closed');
    assert.ok(lc.includes('v20260607-1'), 'document must declare version v20260607-1');
  },
});

// ── 2. Current safe baseline is documented ─────────────────────────────────
tests.push({
  name: 'Current safe baseline is documented (endpoint default stub / explicit stub / frontend local_stub / endpoint client default disabled / mock-disabled verifier / mock-disabled storage / mock-disabled dependency adapter)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('endpoint default stub') || (lc.includes('endpoint') && lc.includes('stub')), 'audit must mention endpoint default stub');
    assert.ok(lc.includes('explicit stub'), 'audit must mention explicit stub path');
    assert.ok(lc.includes('local_stub'), 'audit must mention frontend local_stub');
    assert.ok(lc.includes('endpoint client') && lc.includes('disabled'), 'audit must mention endpoint client default disabled');
    assert.ok(lc.includes('mock-disabled'), 'audit must mention mock-disabled verifier / storage / dependency adapter');
    assert.ok(lc.includes('verifieradapter') || (lc.includes('verifier') && lc.includes('mock-disabled')), 'audit must mention mock-disabled verifier');
    assert.ok(lc.includes('storageadapter') || (lc.includes('storage') && lc.includes('mock-disabled')), 'audit must mention mock-disabled storage');
  },
});

// ── 3. Gate alignment is documented ────────────────────────────────────────
tests.push({
  name: 'Gate alignment is documented (cite gate / cite Firebase plan / cite storage plan / mark rollback as gate evidence)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('gate alignment'), 'audit must have a Gate alignment section');
    assert.ok(lc.includes('da87d2d1') || lc.includes('pr #2309'), 'audit must cite PR #2309 (gate contract)');
    assert.ok(lc.includes('65924f61') || lc.includes('pr #2311'), 'audit must cite PR #2311 (Firebase plan)');
    assert.ok(lc.includes('f03f8497') || lc.includes('pr #2313'), 'audit must cite PR #2313 (storage plan)');
    assert.ok(lc.includes('rollback / kill-switch policy audit') && (lc.includes('gate evidence') || lc.includes('evidence')), 'audit must mark rollback as gate evidence');
  },
});

// ── 4. Kill-switch surfaces are documented ────────────────────────────────
tests.push({
  name: 'Kill-switch surfaces are documented (Firebase auth verifier / rate-limit storage / external observability / provider API / endpoint live / endpoint client / staging_live / production_live)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const surface of [
      'firebase auth verifier',
      'rate-limit storage',
      'external observability',
      'provider api',
      'endpoint live',
      'endpoint client',
      'staging_live',
      'production_live',
    ]) {
      assert.ok(lc.includes(surface), `audit must list kill-switch surface "${surface}"`);
    }
  },
});

// ── 5. Required future kill-switch controls are documented ───────────────
tests.push({
  name: 'Required future kill-switch controls are documented (independent per-surface / disabled-by-default / environment-gated / safe fallback / config missing safe-fail / no secret exposure / no user data loss / no auto-save)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const ctrl of [
      'independent per-surface disable control',
      'disabled-by-default',
      'environment-gated',
      'safe fallback',
      'config missing safe-fail',
      'no secret exposure',
      'no user data loss',
      'no auto-save',
    ]) {
      assert.ok(lc.includes(ctrl), `audit must list control "${ctrl}"`);
    }
  },
});

// ── 6. Rollback baseline is documented ────────────────────────────────────
tests.push({
  name: 'Rollback baseline is documented (server endpoint stub / frontend local_stub / endpoint client disabled / provider API disabled / verifier/storage mock-disabled)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('server endpoint') && lc.includes('stub'), 'audit must mention server endpoint stub');
    assert.ok(lc.includes('frontend') && lc.includes('local_stub'), 'audit must mention frontend local_stub');
    assert.ok(lc.includes('endpoint client') && lc.includes('disabled'), 'audit must mention endpoint client disabled');
    assert.ok(lc.includes('provider api') && lc.includes('disabled'), 'audit must mention provider API disabled');
    assert.ok(lc.includes('verifier') && lc.includes('storage') && lc.includes('mock-disabled'), 'audit must mention verifier/storage mock-disabled');
  },
});

// ── 7. Incident rollback decision tree is documented ─────────────────────
tests.push({
  name: 'Incident rollback decision tree is documented (auth failures spike / rate-limit storage unavailable / provider API failures / quota/cost anomaly / secret suspected exposed / sensitive logging suspected / staging smoke failure / production user-impacting failure)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const scenario of [
      'auth failures spike',
      'rate-limit storage unavailable',
      'provider api failures',
      'quota / cost anomaly',
      'secret suspected exposed',
      'sensitive logging suspected',
      'staging smoke failure',
      'production user-impacting failure',
    ]) {
      assert.ok(lc.includes(scenario), `audit must list decision-tree scenario "${scenario}"`);
    }
  },
});

// ── 8. Secret / config rollback policy is documented ──────────────────────
tests.push({
  name: 'Secret / config rollback policy is documented (no real secret changes / platform-managed / rotate on exposure / disable live before rotation / do not log secret values)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('no real secret changes'), 'audit must state no real secret changes in this PR');
    assert.ok(lc.includes('platform-managed'), 'audit must require platform-managed future secrets');
    assert.ok(lc.includes('rotate on suspected exposure'), 'audit must require rotate on suspected exposure');
    assert.ok(lc.includes('disable live mode before rotation'), 'audit must require disable live mode before rotation if exposure affects runtime');
    assert.ok(lc.includes('do not log old or new secret values') || (lc.includes('do not log') && lc.includes('secret values')), 'audit must forbid logging old or new secret values');
  },
});

// ── 9. Quota / cost rollback policy is documented ──────────────────────────
tests.push({
  name: 'Quota / cost rollback policy is documented (disable provider API first / preserve endpoint stub fallback / rate-limit storage unavailable safe-fail / cost anomaly threshold future policy)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('disable provider api first') || (lc.includes('disable') && lc.includes('provider api') && lc.includes('first')), 'audit must require disable provider API first');
    assert.ok(lc.includes('preserve endpoint stub fallback') || (lc.includes('preserve') && lc.includes('endpoint stub')), 'audit must require preserve endpoint stub fallback');
    assert.ok(lc.includes('rate-limit storage unavailable') && lc.includes('safe-fail'), 'audit must require rate-limit storage unavailable safe-fail');
    assert.ok(lc.includes('cost anomaly threshold') || (lc.includes('cost anomaly') && lc.includes('future policy')), 'audit must reference cost anomaly threshold future policy');
  },
});

// ── 10. Auth verifier rollback policy is documented ───────────────────────
tests.push({
  name: 'Auth verifier rollback policy is documented (disable Firebase verifier mode / fallback to mock-disabled / no raw token logs / never persist raw token)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('disable firebase verifier mode') || (lc.includes('disable') && lc.includes('firebase') && lc.includes('verifier')), 'audit must require disable Firebase verifier mode');
    assert.ok(lc.includes('fallback to mock-disabled') || (lc.includes('fallback') && lc.includes('mock-disabled') && lc.includes('safe-fail')), 'audit must require fallback to mock-disabled / safe-fail');
    assert.ok(lc.includes('no raw token logs') || (lc.includes('no raw token') && lc.includes('logs')), 'audit must require no raw token logs');
    assert.ok(lc.includes('never persist raw token') || (lc.includes('never persist') && lc.includes('raw token')), 'audit must require never persist raw token during incident');
  },
});

// ── 11. Rate-limit storage rollback policy is documented ───────────────────
tests.push({
  name: 'Rate-limit storage rollback policy is documented (disable KV/DO/D1 mode / fallback to mock-disabled / no raw storage key logs / no raw user identifiers in incident notes)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('disable kv / do / d1 mode') || (lc.includes('disable') && lc.includes('kv') && lc.includes('d1')), 'audit must require disable KV / DO / D1 mode');
    assert.ok(lc.includes('fallback to mock-disabled') || (lc.includes('fallback') && lc.includes('mock-disabled')), 'audit must require fallback to mock-disabled / safe-fail');
    assert.ok(lc.includes('no raw storage key logs') || (lc.includes('raw storage key') && lc.includes('logs')), 'audit must require no raw storage key logs');
    assert.ok(lc.includes('no raw user identifiers in incident notes') || (lc.includes('raw user identifiers') && lc.includes('incident notes')), 'audit must require no raw user identifiers in incident notes');
  },
});

// ── 12. Provider API rollback policy is documented ─────────────────────────
tests.push({
  name: 'Provider API rollback policy is documented (disable live provider adapter / preserve deterministic stub response / no prompt/excerpt/sourceUrl logging / no auto-save)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('disable live provider adapter') || (lc.includes('disable') && lc.includes('live provider adapter')), 'audit must require disable live provider adapter');
    assert.ok(lc.includes('preserve deterministic stub response') || (lc.includes('deterministic stub') && lc.includes('response')), 'audit must require preserve deterministic stub response');
    assert.ok(lc.includes('no prompt / excerpt / sourceurl logging') || (lc.includes('prompt') && lc.includes('sourceurl') && lc.includes('logging')), 'audit must require no prompt / excerpt / sourceUrl logging');
    assert.ok(lc.includes('no auto-save'), 'audit must require no auto-save');
  },
});

// ── 13. Observability rollback policy is documented ───────────────────────
tests.push({
  name: 'Observability rollback policy is documented (disable external backend first if leakage suspected / preserve safe local events / no sensitive replay)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('disable external backend first') || (lc.includes('external') && lc.includes('backend') && lc.includes('first')), 'audit must require disable external backend first if leakage suspected');
    assert.ok(lc.includes('preserve safe local events') || (lc.includes('safe local events')), 'audit must require preserve safe local events if implemented');
    assert.ok(lc.includes('no sensitive replay'), 'audit must require no sensitive replay');
  },
});

// ── 14. Staging / prod rollback policy is documented ──────────────────────
tests.push({
  name: 'Staging / prod rollback policy is documented (staging_live disable before production / production_live requires tested rollback path / rollback owner and approval)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('staging_live disable before production') || (lc.includes('staging_live') && lc.includes('disable') && lc.includes('production')), 'audit must require staging_live disable before production consideration');
    assert.ok(lc.includes('production_live requires tested rollback path') || (lc.includes('production_live') && lc.includes('tested rollback')), 'audit must require production_live requires tested rollback path');
    assert.ok(lc.includes('rollback owner and approval') || (lc.includes('rollback owner') && lc.includes('approval')), 'audit must require rollback owner and approval');
  },
});

// ── 15. Privacy / safety during rollback is documented ────────────────────
tests.push({
  name: 'Privacy / safety during rollback is documented (no raw token / no authorization header / no firebaseToken / no API key / no prompt/excerpt/sourceUrl/raw request body / no raw provider response / no raw user identifier)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('no raw token') || (lc.includes('no') && lc.includes('raw token')), 'audit must require no raw token');
    assert.ok(lc.includes('no authorization header') || (lc.includes('no') && lc.includes('authorization header')), 'audit must require no authorization header');
    assert.ok(lc.includes('no firebasetoken') || (lc.includes('no') && lc.includes('firebasetoken')), 'audit must require no firebaseToken');
    assert.ok(lc.includes('no api key') || (lc.includes('no') && lc.includes('api key')), 'audit must require no API key');
    assert.ok(lc.includes('no prompt / excerpt / sourceurl / raw request body') || (lc.includes('prompt') && lc.includes('sourceurl') && lc.includes('raw request body')), 'audit must require no prompt / excerpt / sourceUrl / raw request body');
    assert.ok(lc.includes('no raw provider response') || (lc.includes('no') && lc.includes('raw provider response')), 'audit must require no raw provider response');
    assert.ok(lc.includes('no raw user identifier') || (lc.includes('no') && lc.includes('raw user identifier')), 'audit must require no raw user identifier');
  },
});

// ── 16. Required future tests are documented ──────────────────────────────
tests.push({
  name: 'Required future tests are documented (each live surface disabled independently / default remains disabled / fallback returns stub / no sensitive data / provider API not called / Firebase verifier not called / storage not called / endpoint client default disabled)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const t of [
      'each live surface can be disabled independently',
      'default remains disabled',
      'fallback returns stub / local_stub',
      'no sensitive data in rollback logs',
      'provider api not called after kill-switch',
      'firebase verifier not called after kill-switch',
      'storage not called after kill-switch',
      'endpoint client default disabled',
    ]) {
      assert.ok(lc.includes(t), `audit must list required test "${t}"`);
    }
  },
});

// ── 17. Go / no-go matrix is documented ────────────────────────────────────
tests.push({
  name: 'Go / no-go matrix is documented (rollback audit Done / real kill-switch No / real Firebase Admin SDK No / real KV/DO/D1 No / real provider API No / staging_live No / production_live No)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('go / no-go') || lc.includes('go/no-go'), 'audit must have a go/no-go matrix');
    assert.ok(lc.includes('rollback / kill-switch policy audit') && lc.includes('done'), 'audit must mark rollback audit as Done');
    assert.ok(lc.includes('real kill-switch implementation') && lc.includes('no'), 'audit must state no real kill-switch in this PR');
    assert.ok(lc.includes('real firebase admin sdk') && lc.includes('no'), 'audit must state no real Firebase Admin SDK in this PR');
    assert.ok(lc.includes('real kv') && lc.includes('no'), 'audit must state no real KV in this PR');
    assert.ok(lc.includes('staging_live') && lc.includes('no'), 'audit must state no staging_live opt-in in this PR');
    assert.ok(lc.includes('production_live') && lc.includes('no'), 'audit must state no production_live opt-in in this PR');
  },
});

// ── 18. Remaining blockers are documented ──────────────────────────────────
tests.push({
  name: 'Remaining blockers are documented (observability policy / staging soak / secret rotation drill / kill-switch drill / CTO approval)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    for (const b of [
      'observability policy',
      'one-day staging soak',
      'seven-day staging soak',
      'secret rotation drill',
      'kill-switch drill',
      'cto approval',
    ]) {
      assert.ok(lc.includes(b), `audit must list blocker "${b}"`);
    }
  },
});

// ── 19. Locks / evidence is documented ─────────────────────────────────────
tests.push({
  name: 'Locks / evidence is documented (this test + 3 prior plan/audit tests)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('locks / evidence') || lc.includes('locks/evidence'), 'audit must have a Locks / evidence section');
    assert.ok(lc.includes('scout-rollback-kill-switch-policy-audit-contract.test.cjs'), 'audit must list the new test file as a lock');
    assert.ok(lc.includes('scout-runtime-rate-limit-storage-implementation-plan-contract.test.cjs'), 'audit must list the rate-limit storage plan test as a lock');
    assert.ok(lc.includes('scout-runtime-firebase-auth-verifier-implementation-plan-contract.test.cjs'), 'audit must list the Firebase plan test as a lock');
    assert.ok(lc.includes('runtime-adapter-implementation-gate-contract.test.cjs'), 'audit must list the gate contract test as a lock');
  },
});

// ── 20. Branch safety reminder is documented ──────────────────────────────
tests.push({
  name: 'Branch safety reminder is documented (serial checkout / branch confirm before commit)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('serial') || lc.includes('branch safety') || lc.includes('branch must be confirmed'), 'audit must document branch safety');
  },
});

// ── 21. Explicit verdict is documented ─────────────────────────────────────
tests.push({
  name: 'Explicit verdict is documented (rollback audit ready:Yes / all 7 surfaces No / recommended next slice = observability policy audit)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('explicit verdict') || lc.includes('verdict'), 'audit must have an explicit verdict section');
    assert.ok(lc.includes('ready for rollback / kill-switch policy audit') && lc.includes('yes'), 'audit must state ready for rollback / kill-switch policy audit: Yes');
    assert.ok(lc.includes('real kill-switch implementation') && lc.includes('no'), 'audit must state no real kill-switch in this PR');
    assert.ok(lc.includes('real firebase admin sdk') && lc.includes('no'), 'audit must state no real Firebase Admin SDK in this PR');
    assert.ok(lc.includes('staging_live') && lc.includes('no'), 'audit must state no staging_live in this PR');
    assert.ok(lc.includes('production_live') && lc.includes('no'), 'audit must state no production_live in this PR');
    assert.ok(lc.includes('recommended next slice'), 'audit must recommend the next slice');
    assert.ok(lc.includes('observability policy audit') || (lc.includes('observability policy') && lc.includes('audit')), 'audit must recommend observability policy audit as next slice');
  },
});

// ── 22. Gate contract / Firebase plan / storage plan cross-reference ─────
tests.push({
  name: 'Gate contract / Firebase plan / storage plan cross-reference is documented (PR #2309 / PR #2311 / PR #2313)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('pr #2309') || lc.includes('da87d2d1'), 'audit must reference PR #2309');
    assert.ok(lc.includes('pr #2311') || lc.includes('65924f61'), 'audit must reference PR #2311');
    assert.ok(lc.includes('pr #2313') || lc.includes('f03f8497'), 'audit must reference PR #2313');
    assert.ok(gateDoc.length > 0, 'gate contract doc must exist on disk');
    assert.ok(firebasePlanDoc.length > 0, 'Firebase plan doc must exist on disk');
    assert.ok(storagePlanDoc.length > 0, 'storage plan doc must exist on disk');
  },
});

// ── 23. No runtime code files changed by this slice ────────────────────────
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

// ── 24. Endpoint default stub preserved ────────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must reference STUB mode');
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define STUB mode constant');
  },
});

// ── 25. Frontend default local_stub preserved ─────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 26. Endpoint client default disabled preserved ─────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no audit-related wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('rollback-kill-switch-policy-audit'),
      'endpoint client must not reference the audit doc'
    );
    assert.ok(
      !endpointClientCode.includes('kill-switch policy audit'),
      'endpoint client must not be audit-related'
    );
  },
});

// ── 27. No Firebase Admin SDK / no KV / DO / D1 in runtime code ───────────
tests.push({
  name: 'No Firebase Admin SDK / KV / Durable Object / D1 / database / provider SDK / fetch / env secret in runtime code',
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
    assert.ok(!/kvnamespace/.test(code), 'runtime must not reference KVNamespace');
    assert.ok(!/durableobject/.test(code), 'runtime must not reference DurableObject');
    assert.ok(!/d1database/.test(code), 'runtime must not reference D1Database');
    assert.ok(!/env\.kv\b/.test(code), 'runtime must not read env.KV');
    assert.ok(!/env\.db\b/.test(code), 'runtime must not read env.DB');
    assert.ok(!/env\.auth\b/.test(code), 'runtime must not read env.AUTH');
    assert.ok(!/env\.firebase/.test(code), 'runtime must not read env.FIREBASE');
    assert.ok(!/\bfetch\s*\(/.test(code), 'runtime must not call fetch()');
    assert.ok(!/xmlhttprequest/.test(code), 'runtime must not use XMLHttpRequest');
    assert.ok(!/axios/.test(code), 'runtime must not use axios');
    assert.ok(!/new\s+request\s*\(/.test(code), 'runtime must not construct a new Request');
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      const importPattern = new RegExp(`(import|require).*${provider}`, 'i');
      assert.ok(!importPattern.test(code), `runtime must not import ${provider}`);
    }
    assert.ok(!/process\.env\.scout/.test(code), 'runtime must not read process.env.SCOUT_*');
    assert.ok(!/process\.env\.firebase/.test(code), 'runtime must not read process.env.FIREBASE_*');
    assert.ok(!/import\.meta\.env/.test(code), 'runtime must not read import.meta.env');
    assert.ok(!/api_key\s*=/.test(code), 'runtime must not assign api_key');
    assert.ok(!/bearer\s+/.test(code), 'runtime must not embed bearer tokens');
  },
});

// ── 28. Related docs reflect audit status ─────────────────────────────────
tests.push({
  name: 'Related docs exist and reflect the rollback / kill-switch policy audit status',
  fn: () => {
    for (const docName of RELATED_DOCS) {
      const docPath = path.join(ROOT, 'docs/product/' + docName);
      const doc = readFileSafe(docPath);
      assert.ok(doc.length > 0, `${docName} must exist`);
      const lc = doc.toLowerCase();
      assert.ok(
        lc.includes('rollback / kill-switch policy audit') || lc.includes('rollback / kill-switch policy audit status') || lc.includes('rollback policy audit status'),
        `${docName} must reference the rollback / kill-switch policy audit status`
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
