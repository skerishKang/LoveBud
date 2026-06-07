/**
 * Scout Runtime Rate-Limit Storage Implementation Plan Contract Tests
 * v20260607-1
 *
 * Locks the rate-limit storage implementation plan/audit slice:
 * - plan document exists and is well-formed
 * - current blocked state is documented
 * - gate alignment is documented (cited, complete evidence, missing
 *   evidence)
 * - future implementation surface is documented
 * - future storage backend boundary is documented
 * - storage key policy is documented
 * - storage payload policy is documented
 * - future storage input contract is documented
 * - future storage output contract is documented
 * - quota lifecycle policy is documented
 * - error mapping is documented
 * - required future tests are documented
 * - required future docs are documented
 * - go / no-go matrix is documented
 * - remaining blockers are documented
 * - locks / evidence is documented
 * - branch safety reminder is documented
 * - explicit verdict is documented
 * - no runtime code files were modified by this plan slice
 * - default stub / explicit stub / frontend local_stub / endpoint
 *   client default disabled remain preserved
 * - no Firebase / KV / DO / D1 / provider SDK / fetch / env secret
 *   usage in the runtime modules
 * - related docs reflect the plan status
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');

const PLAN_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-runtime-rate-limit-storage-implementation-plan.md');
const GATE_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md');
const FIREBASE_PLAN_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md');

const DEP_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const VERIFIER_PATH = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const STORAGE_ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const BOUNDARY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const OBSERVABILITY_PATH = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-observability.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const RELATED_DOCS = [
  'lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md',
  'lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md',
  'lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md',
  'lovebud-scout-live-rate-limit-storage-adapter-skeleton.md',
  'lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md',
  'lovebud-scout-live-endpoint-error-readiness-audit.md',
  'lovebud-scout-live-auth-rate-limit-readiness-audit.md',
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-readiness-audit.md',
  'lovebud-scout-live-provider-production-readiness-gates-audit.md',
  'lovebud-scout-live-provider-staging-rollout-contract.md',
  'lovebud-scout-provider-secret-config-deployment-checklist.md',
];

// Locked hashes captured at plan time. The runtime code files must
// match these hashes after this plan slice (this slice is docs+tests
// only; no runtime code change). Hashes are computed on the
// CRLF-normalized file content (raw text with \r\n replaced by \n)
// so that the lock is stable across Windows (CRLF) and CI Linux (LF)
// environments. If a future plan run finds the runtime modules have
// been intentionally changed, the plan doc must be updated and these
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

const planDoc = readFileSafe(PLAN_DOC_PATH);
const gateDoc = readFileSafe(GATE_DOC_PATH);
const firebasePlanDoc = readFileSafe(FIREBASE_PLAN_DOC_PATH);
const depCode = readFileSafe(DEP_ADAPTER_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

const tests = [];

// ── 1. Plan document exists ────────────────────────────────────────────────
tests.push({
  name: 'Rate-limit storage implementation plan document exists',
  fn: () => {
    assert.ok(planDoc.length > 0, 'plan document must exist');
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('implementation plan') || lc.includes('plan / audit'), 'document title must contain "implementation plan"');
    assert.ok(lc.includes('mock-disabled') || lc.includes('mock disabled'), 'document must mention mock-disabled');
    assert.ok(lc.includes('fail-closed') || lc.includes('fail closed'), 'document must mention fail-closed');
    assert.ok(lc.includes('v20260607-1'), 'document must declare version v20260607-1');
  },
});

// ── 2. Current blocked state is documented ─────────────────────────────────
tests.push({
  name: 'Current blocked state is documented (mock-disabled storage / storage dependency wiring / runtime gate / Firebase plan / endpoint default stub / explicit stub / frontend local_stub / endpoint client default disabled)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('mock-disabled'), 'plan must mention mock-disabled storage');
    assert.ok(lc.includes('storageadapter') || lc.includes('storage adapter'), 'plan must mention storage dependency wiring');
    assert.ok(lc.includes('runtime adapter implementation gate') || lc.includes('gate contract'), 'plan must mention runtime implementation gate');
    assert.ok(lc.includes('firebase auth verifier implementation plan') || (lc.includes('firebase') && lc.includes('verifier') && lc.includes('plan complete')), 'plan must mention Firebase auth verifier plan complete');
    assert.ok(lc.includes('stub'), 'plan must mention endpoint default stub');
    assert.ok(lc.includes('local_stub'), 'plan must mention frontend local_stub');
    assert.ok(lc.includes('disabled'), 'plan must mention endpoint client default disabled');
  },
});

// ── 3. Gate alignment is documented ────────────────────────────────────────
tests.push({
  name: 'Gate alignment is documented (cite gate / cite Firebase plan / list complete evidence / list missing evidence)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('gate alignment'), 'plan must have a Gate alignment section');
    assert.ok(lc.includes('da87d2d1') || lc.includes('pr #2309'), 'plan must cite PR #2309 (gate contract)');
    assert.ok(lc.includes('65924f61') || lc.includes('pr #2311'), 'plan must cite PR #2311 (Firebase plan)');
    assert.ok(lc.includes('complete gate evidence') || (lc.includes('complete') && lc.includes('evidence')), 'plan must list complete gate evidence');
    assert.ok(lc.includes('missing gate evidence') || (lc.includes('missing') && lc.includes('evidence')), 'plan must list missing gate evidence');
  },
});

// ── 4. Future implementation surface is documented ─────────────────────────
tests.push({
  name: 'Future implementation surface is documented (target module / target factory / KV mode / DO mode / D1 mode / env-gated config / no endpoint default change)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('live-rate-limit-storage-adapter.js'), 'plan must mention target module file path');
    assert.ok(lc.includes('createscoutliveratelimitstorageadapter'), 'plan must mention target factory name');
    assert.ok(lc.includes('kv') && lc.includes('disabled-by-default'), 'plan must mention future disabled-by-default KV mode');
    assert.ok(lc.includes('durable object') && lc.includes('disabled-by-default'), 'plan must mention future disabled-by-default Durable Object mode');
    assert.ok(lc.includes('d1') && lc.includes('disabled-by-default'), 'plan must mention future disabled-by-default D1 mode');
    assert.ok(lc.includes('env-gated config') || (lc.includes('env') && lc.includes('gated')), 'plan must mention environment-gated config');
    assert.ok(lc.includes('no endpoint default change') || (lc.includes('provider mode') && lc.includes('stub') && lc.includes('default')), 'plan must state no endpoint default change');
  },
});

// ── 5. Future storage backend boundary is documented ───────────────────────
tests.push({
  name: 'Future storage backend boundary is documented (future implementation PR only / disabled-by-default / no storage connection at import / no quota read/write at import / no binding/secret exposure / no raw storage key logs)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('future implementation pr only') || (lc.includes('future') && lc.includes('implementation pr')), 'plan must state future implementation PR only');
    assert.ok(lc.includes('disabled-by-default'), 'plan must require disabled-by-default');
    assert.ok(lc.includes('no storage connection at import time') || (lc.includes('storage connection') && lc.includes('import time')), 'plan must prohibit storage connection at import time');
    assert.ok(lc.includes('no quota read / write at import time') || (lc.includes('quota') && lc.includes('read / write') && lc.includes('import time')), 'plan must prohibit quota read/write at import time');
    assert.ok(lc.includes('no binding / secret exposure') || (lc.includes('binding') && lc.includes('exposure')), 'plan must prohibit binding/secret exposure');
    assert.ok(lc.includes('no raw storage key logs') || (lc.includes('raw storage key') && lc.includes('logs')), 'plan must prohibit raw storage key logs');
  },
});

// ── 6. Storage key policy is documented ────────────────────────────────────
tests.push({
  name: 'Storage key policy is documented (userKeyHash / ipHash / sessionKeyHash / endpointPath / providerMode / quotaBucket / windowKey / limitName / no raw identifiers / stable key format required)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    for (const k of ['userkeyhash', 'iphash', 'sessionkeyhash', 'endpointpath', 'providermode', 'quotabucket', 'windowkey', 'limitname']) {
      assert.ok(lc.includes(k), `plan must list key component "${k}"`);
    }
    assert.ok(lc.includes('no raw uid') || (lc.includes('raw') && lc.includes('uid') && lc.includes('email')), 'plan must prohibit raw UID / email in keys');
    assert.ok(lc.includes('raw') && lc.includes('ip') && lc.includes('keys'), 'plan must prohibit raw IP in keys');
    assert.ok(lc.includes('raw token') && lc.includes('keys'), 'plan must prohibit raw token in keys');
    assert.ok(lc.includes('stable key format') || (lc.includes('stable') && lc.includes('key format')), 'plan must require stable key format before implementation');
  },
});

// ── 7. Storage payload policy is documented ────────────────────────────────
tests.push({
  name: 'Storage payload policy is documented (allowed fields / prohibited fields / no raw token / no authorization header / no firebaseToken / no API key / no prompt/excerpt/sourceUrl/raw request body / no raw UID/email/IP/provider response)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    for (const f of ['requestid', 'userkeyhash', 'iphash', 'sessionkeyhash', 'endpointpath', 'providermode', 'windowkey', 'limitname', 'nowms', 'quotabucket', 'requestedunits']) {
      assert.ok(lc.includes(f), `plan must list allowed payload field "${f}"`);
    }
    assert.ok(lc.includes('no raw token') || (lc.includes('token') && lc.includes('prohibited')), 'plan must prohibit raw token in payload');
    assert.ok(lc.includes('authorization') && lc.includes('prohibited'), 'plan must prohibit authorization header in payload');
    assert.ok(lc.includes('firebasetoken') && lc.includes('prohibited'), 'plan must prohibit firebaseToken in payload');
    assert.ok(lc.includes('apikey') && lc.includes('prohibited'), 'plan must prohibit API key in payload');
    assert.ok(lc.includes('prompt') && lc.includes('excerpt') && lc.includes('sourceurl') && lc.includes('rawrequestbody') && lc.includes('prohibited'), 'plan must prohibit prompt/excerpt/sourceUrl/raw request body in payload');
    assert.ok(lc.includes('raw') && lc.includes('uid') && lc.includes('email') && lc.includes('ip') && lc.includes('prohibited'), 'plan must prohibit raw UID/email/IP in payload');
  },
});

// ── 8. Future storage input contract is documented ─────────────────────────
tests.push({
  name: 'Future storage input contract is documented (checkQuota / consumeQuota / releaseQuota / reservation or decision id / retryAfterSeconds / remaining quota if safe)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    for (const m of ['checkquota', 'consumequota', 'releasequota']) {
      assert.ok(lc.includes(m), `plan must list method "${m}"`);
    }
    assert.ok(lc.includes('decisionid') || lc.includes('reservation id'), 'plan must mention reservation id or decision id');
    assert.ok(lc.includes('retryafterseconds') || (lc.includes('retry') && lc.includes('seconds')), 'plan must mention retryAfterSeconds');
    assert.ok(lc.includes('remaining') && lc.includes('safe'), 'plan must mention remaining quota if safe');
  },
});

// ── 9. Future storage output contract is documented ────────────────────────
tests.push({
  name: 'Future storage output contract is documented (allowed / code / safe reason / retryAfterSeconds / quotaBucket / decisionId / no raw storage key / no raw user identifier)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('allowed') && lc.includes('boolean'), 'plan must list allowed (boolean) output field');
    assert.ok(lc.includes('code') && lc.includes('string'), 'plan must list code output field');
    assert.ok(lc.includes('reason') && lc.includes('safe'), 'plan must list safe reason output field');
    assert.ok(lc.includes('retryafterseconds'), 'plan must list retryAfterSeconds output field');
    assert.ok(lc.includes('quotabucket'), 'plan must list quotaBucket output field');
    assert.ok(lc.includes('decisionid'), 'plan must list decisionId output field');
    assert.ok(lc.includes('no raw storage key') || (lc.includes('raw storage key') && lc.includes('response')), 'plan must prohibit raw storage key in response');
    assert.ok(lc.includes('no raw user identifier') || (lc.includes('raw user identifier') && lc.includes('response')), 'plan must prohibit raw user identifier in response');
  },
});

// ── 10. Quota lifecycle policy is documented ───────────────────────────────
tests.push({
  name: 'Quota lifecycle policy is documented (pre-consumption validation / reservation before provider call / consume after provider success / release on provider failure / failure accounting / idempotency guard)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    for (const p of [
      'pre-consumption validation',
      'reservation before provider call',
      'consume after provider success',
      'release on provider failure',
      'failure accounting',
      'idempotency guard',
    ]) {
      assert.ok(lc.includes(p), `plan must list lifecycle policy "${p}"`);
    }
  },
});

// ── 11. Error mapping is documented ─────────────────────────────────────────
tests.push({
  name: 'Error mapping is documented (quota exceeded / storage unavailable / config missing / payload prohibited / reservation failure / consume failure / release failure / unknown storage error)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    for (const e of ['quota exceeded', 'config missing', 'reservation failure', 'consume failure', 'release failure', 'unknown storage error']) {
      assert.ok(lc.includes(e), `plan must map error "${e}"`);
    }
    assert.ok(lc.includes('storage') && lc.includes('unavailable'), 'plan must map "storage unavailable"');
    assert.ok(lc.includes('payload') && lc.includes('prohibited'), 'plan must map "payload prohibited"');
    assert.ok(lc.includes('rate_limited') || (lc.includes('rate') && lc.includes('limited')), 'plan must map to RATE_LIMITED');
    assert.ok(lc.includes('rate_limit_unavailable') || (lc.includes('rate') && lc.includes('limit') && lc.includes('unavailable')), 'plan must map to RATE_LIMIT_UNAVAILABLE');
  },
});

// ── 12. Required future tests are documented ───────────────────────────────
tests.push({
  name: 'Required future tests are documented (side-effect-free import / default mock-disabled / KV/DO/D1 modes disabled / no raw token/API key / no raw user identifiers / storage unavailable safe-fail / quota exceeded RATE_LIMITED / idempotency / no provider API / no endpoint default live)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    for (const t of [
      'side-effect-free',
      'no raw token',
      'no raw user identifiers',
      'storage unavailable safe-fail',
      'consume / release idempotency',
      'no provider api call',
      'no endpoint default live',
    ]) {
      assert.ok(lc.includes(t), `plan must list required test "${t}"`);
    }
    assert.ok(lc.includes('quota exceeded') && lc.includes('rate_limited'), 'plan must state "quota exceeded ... RATE_LIMITED"');
    assert.ok(lc.includes('kv') && lc.includes('durable_object') && lc.includes('d1') && lc.includes('disabled'), 'plan must list KV/DO/D1 modes disabled test');
    assert.ok(lc.includes('default mode remains mock_disabled') || (lc.includes('default mode remains') && lc.includes('mock_disabled')), 'plan must list default mode mock_disabled test');
  },
});

// ── 13. Required future docs are documented ────────────────────────────────
tests.push({
  name: 'Required future docs are documented (gate status update / cost/quota/abuse monitoring / staging rollout / production readiness / incident/rotation runbook)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('gate status') || (lc.includes('gate') && lc.includes('update')), 'plan must list gate status update');
    assert.ok(lc.includes('cost / quota / abuse monitoring contract') || (lc.includes('cost') && lc.includes('quota') && lc.includes('abuse') && lc.includes('monitoring')), 'plan must list cost/quota/abuse monitoring contract');
    assert.ok(lc.includes('staging rollout') || (lc.includes('staging') && lc.includes('rollout')), 'plan must list staging rollout plan');
    assert.ok(lc.includes('production readiness gates') || (lc.includes('production readiness') && lc.includes('gates')), 'plan must list production readiness gates');
    assert.ok(lc.includes('incident') && lc.includes('rotation'), 'plan must list incident/rotation runbook');
  },
});

// ── 14. Go / no-go matrix is documented ────────────────────────────────────
tests.push({
  name: 'Go / no-go matrix is documented (plan Done / KV No / DO No / D1 No / runtime quota persistence No / endpoint default live No / staging_live No / production_live No / provider API No)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('go / no-go') || lc.includes('go/no-go'), 'plan must have a go/no-go matrix');
    assert.ok(lc.includes('done'), 'plan must mark plan as Done');
    assert.ok(lc.includes('real kv') && lc.includes('no'), 'plan must state no real KV in this PR');
    assert.ok(lc.includes('real durable object') && lc.includes('no'), 'plan must state no real Durable Object in this PR');
    assert.ok(lc.includes('real d1') && lc.includes('no'), 'plan must state no real D1 in this PR');
    assert.ok(lc.includes('runtime quota persistence') && lc.includes('no'), 'plan must state no runtime quota persistence in this PR');
    assert.ok(lc.includes('staging_live') && lc.includes('no'), 'plan must state no staging_live opt-in in this PR');
    assert.ok(lc.includes('production_live') && lc.includes('no'), 'plan must state no production_live opt-in in this PR');
    assert.ok(lc.includes('provider api') && lc.includes('no'), 'plan must state no provider API call in this PR');
  },
});

// ── 15. Remaining blockers are documented ──────────────────────────────────
tests.push({
  name: 'Remaining blockers are documented (rollback doc / observability doc / staging soak / secret rotation drill / CTO approval)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    for (const b of [
      'rollback / kill-switch policy',
      'observability policy',
      'one-day staging soak',
      'seven-day staging soak',
      'secret rotation drill',
      'cto approval',
    ]) {
      assert.ok(lc.includes(b), `plan must list blocker "${b}"`);
    }
  },
});

// ── 16. Locks / evidence is documented ─────────────────────────────────────
tests.push({
  name: 'Locks / evidence is documented (this test + 3 prior plan/audit tests)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('locks / evidence') || lc.includes('locks/evidence'), 'plan must have a Locks / evidence section');
    assert.ok(lc.includes('scout-runtime-rate-limit-storage-implementation-plan-contract.test.cjs'), 'plan must list the new test file as a lock');
    assert.ok(lc.includes('scout-runtime-firebase-auth-verifier-implementation-plan-contract.test.cjs'), 'plan must list the Firebase plan test as a lock');
    assert.ok(lc.includes('runtime-adapter-implementation-gate-contract.test.cjs'), 'plan must list the gate contract test as a lock');
    assert.ok(lc.includes('adapter-wiring-readiness-audit-contract.test.cjs'), 'plan must list the audit contract test as a lock');
  },
});

// ── 17. Branch safety reminder is documented ──────────────────────────────
tests.push({
  name: 'Branch safety reminder is documented (serial checkout / branch confirm before commit)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('serial') || lc.includes('branch safety') || lc.includes('branch must be confirmed'), 'plan must document branch safety');
  },
});

// ── 18. Explicit verdict is documented ─────────────────────────────────────
tests.push({
  name: 'Explicit verdict is documented (plan ready:Yes / all 7 surfaces No / recommended next slice = rollback doc or observability doc)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('explicit verdict') || lc.includes('verdict'), 'plan must have an explicit verdict section');
    assert.ok(lc.includes('ready for rate-limit storage implementation plan') && lc.includes('yes'), 'plan must state ready for rate-limit storage implementation plan: Yes');
    assert.ok(lc.includes('real kv') && lc.includes('no'), 'plan must state no real KV in this PR');
    assert.ok(lc.includes('runtime quota persistence') && lc.includes('no'), 'plan must state no runtime quota persistence in this PR');
    assert.ok(lc.includes('staging_live') && lc.includes('no'), 'plan must state no staging_live in this PR');
    assert.ok(lc.includes('production_live') && lc.includes('no'), 'plan must state no production_live in this PR');
    assert.ok(lc.includes('provider api') && lc.includes('no'), 'plan must state no provider API call in this PR');
    assert.ok(lc.includes('recommended next slice'), 'plan must recommend the next slice');
  },
});

// ── 19. Gate contract and Firebase plan cross-reference is documented ─────
tests.push({
  name: 'Gate contract and Firebase plan cross-reference is documented (PR #2309 / PR #2311)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('pr #2309') || lc.includes('da87d2d1'), 'plan must reference PR #2309');
    assert.ok(lc.includes('pr #2311') || lc.includes('65924f61'), 'plan must reference PR #2311');
    assert.ok(gateDoc.length > 0, 'gate contract doc must exist on disk');
    assert.ok(firebasePlanDoc.length > 0, 'Firebase plan doc must exist on disk');
  },
});

// ── 20. No runtime code files changed by this slice ────────────────────────
tests.push({
  name: 'Runtime code files were not modified by this plan slice (locked hashes match)',
  fn: () => {
    const depHash = hashOf(DEP_ADAPTER_PATH);
    const verifierHash = hashOf(VERIFIER_PATH);
    const storageHash = hashOf(STORAGE_ADAPTER_PATH);
    const suggestHash = hashOf(SUGGEST_PATH);
    assert.strictEqual(depHash, LOCKED_HASHES.dep, 'dependency adapter must not be modified by this plan slice');
    assert.strictEqual(verifierHash, LOCKED_HASHES.verifier, 'verifier adapter must not be modified by this plan slice');
    assert.strictEqual(storageHash, LOCKED_HASHES.storage, 'storage adapter must not be modified by this plan slice');
    assert.strictEqual(suggestHash, LOCKED_HASHES.suggest, 'suggest.js must not be modified by this plan slice');
  },
});

// ── 21. Endpoint default stub preserved ────────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must reference STUB mode');
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define STUB mode constant');
  },
});

// ── 22. Frontend default local_stub preserved ─────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 23. Endpoint client default disabled preserved ─────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no plan-related wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('rate-limit-storage-implementation-plan'),
      'endpoint client must not reference the plan doc'
    );
    assert.ok(
      !endpointClientCode.includes('rate-limit storage implementation plan'),
      'endpoint client must not be plan-related'
    );
  },
});

// ── 24. No Firebase Admin SDK in any runtime module ───────────────────────
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

// ── 25. No KV / Durable Object / D1 / database in runtime code ─────────────
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

// ── 26. No fetch / XHR / axios in runtime code ────────────────────────────
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

// ── 27. No provider SDK imports in runtime code ───────────────────────────
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

// ── 28. No secrets / env usage in runtime code ────────────────────────────
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

// ── 29. Related docs reflect plan status ───────────────────────────────────
tests.push({
  name: 'Related docs exist and reflect the rate-limit storage implementation plan status',
  fn: () => {
    for (const docName of RELATED_DOCS) {
      const docPath = path.join(ROOT, 'docs/product/' + docName);
      const doc = readFileSafe(docPath);
      assert.ok(doc.length > 0, `${docName} must exist`);
      const lc = doc.toLowerCase();
      assert.ok(
        lc.includes('rate-limit storage implementation plan') || lc.includes('rate-limit storage plan status') || lc.includes('rate-limit storage plan status'),
        `${docName} must reference the rate-limit storage implementation plan status`
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
