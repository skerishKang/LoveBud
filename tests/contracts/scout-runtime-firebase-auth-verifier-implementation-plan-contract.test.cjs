/**
 * Scout Runtime Firebase Auth Verifier Implementation Plan Contract
 * Tests
 * v20260607-1
 *
 * Locks the Firebase auth verifier implementation plan/audit slice:
 * - plan document exists and is well-formed
 * - current blocked state is documented
 * - gate alignment is documented (cited, complete evidence, missing
 *   evidence)
 * - future implementation surface is documented
 * - future Firebase Admin SDK boundary is documented
 * - token handling policy is documented
 * - future verifier input contract is documented
 * - future verifier output contract is documented
 * - error mapping is documented
 * - required future tests are documented
 * - required future docs are documented
 * - go / no-go matrix is documented
 * - remaining blockers are documented
 * - locks / evidence is documented
 * - explicit verdict is documented
 * - no runtime code files were modified by this plan slice
 * - default stub / explicit stub / frontend local_stub / endpoint
 *   client default disabled remain preserved
 * - no Firebase / KV / DO / D1 / provider SDK / fetch / env secret
 *   usage in the runtime modules
 * - related docs reflect the plan status
 * - branch safety reminder is documented
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');

const PLAN_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md');
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
  'lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md',
  'lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md',
  'lovebud-scout-live-auth-verifier-adapter-skeleton.md',
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

const planDoc = readFileSafe(PLAN_DOC_PATH);
const gateDoc = readFileSafe(GATE_DOC_PATH);
const depCode = readFileSafe(DEP_ADAPTER_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const storageCode = readFileSafe(STORAGE_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

const tests = [];

// ── 1. Plan document exists ────────────────────────────────────────────────
tests.push({
  name: 'Firebase auth verifier implementation plan document exists',
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
  name: 'Current blocked state is documented (mock-disabled verifier / verifier dependency wiring / runtime implementation gate / endpoint default stub / explicit stub / frontend local_stub / endpoint client default disabled)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('mock-disabled'), 'plan must mention mock-disabled verifier');
    assert.ok(lc.includes('verifieradapter') || lc.includes('verifier adapter'), 'plan must mention verifier dependency wiring');
    assert.ok(lc.includes('runtime adapter implementation gate') || lc.includes('gate contract'), 'plan must mention runtime implementation gate');
    assert.ok(lc.includes('stub'), 'plan must mention endpoint default stub');
    assert.ok(lc.includes('local_stub'), 'plan must mention frontend local_stub');
    assert.ok(lc.includes('disabled'), 'plan must mention endpoint client default disabled');
  },
});

// ── 3. Gate alignment is documented ────────────────────────────────────────
tests.push({
  name: 'Gate alignment is documented (cite gate / list complete evidence / list missing evidence)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('gate alignment'), 'plan must have a Gate alignment section');
    assert.ok(lc.includes('da87d2d1') || lc.includes('pr #2309') || lc.includes('pr #2309'), 'plan must cite PR #2309 (gate contract)');
    assert.ok(lc.includes('complete gate evidence') || (lc.includes('complete') && lc.includes('evidence')), 'plan must list complete gate evidence');
    assert.ok(lc.includes('missing gate evidence') || (lc.includes('missing') && lc.includes('evidence')), 'plan must list missing gate evidence');
  },
});

// ── 4. Future implementation surface is documented ─────────────────────────
tests.push({
  name: 'Future implementation surface is documented (target module / target factory / future disabled-by-default Firebase mode / environment-gated config / no endpoint default change)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('live-auth-verifier-adapter.js'), 'plan must mention target module file path');
    assert.ok(lc.includes('createscoutliveauthverifieradapter'), 'plan must mention target factory name');
    assert.ok(lc.includes('firebase') && lc.includes('disabled-by-default'), 'plan must mention future disabled-by-default Firebase mode');
    assert.ok(lc.includes('env-gated config') || (lc.includes('env') && lc.includes('gated')), 'plan must mention environment-gated config');
    assert.ok(lc.includes('no endpoint default change') || (lc.includes('provider mode') && lc.includes('stub') && lc.includes('default')), 'plan must state no endpoint default change');
  },
});

// ── 5. Future Firebase Admin SDK boundary is documented ─────────────────────
tests.push({
  name: 'Future Firebase Admin SDK boundary is documented (future implementation PR only / disabled-by-default / no global init at import time / no token verification at import time / no service account exposure / no token logs / no service account logs)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('future implementation pr only') || (lc.includes('future') && lc.includes('implementation pr')), 'plan must state future implementation PR only');
    assert.ok(lc.includes('disabled-by-default'), 'plan must require disabled-by-default');
    assert.ok(lc.includes('no global init at import time') || (lc.includes('global init') && lc.includes('import time')), 'plan must prohibit global init at import time');
    assert.ok(lc.includes('no token verification at import time') || (lc.includes('token verification') && lc.includes('import time')), 'plan must prohibit token verification at import time');
    assert.ok(lc.includes('no service account exposure') || (lc.includes('service account') && lc.includes('exposure')), 'plan must prohibit service account exposure');
    assert.ok(lc.includes('no token / service account logs') || (lc.includes('no token') && lc.includes('no service account') && lc.includes('logs')), 'plan must prohibit token / service account logs');
  },
});

// ── 6. Token handling policy is documented ─────────────────────────────────
tests.push({
  name: 'Token handling policy is documented (raw Authorization header at endpoint auth boundary / raw token in verifier call boundary only / no raw token logs / no raw token persistence / no raw token to storage/rate-limit/provider/observability / tokenHash only in safe payloads)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('raw authorization header') && lc.includes('endpoint auth boundary'), 'plan must state raw Authorization header only at endpoint auth boundary');
    assert.ok(lc.includes('raw token') && (lc.includes('verifier call boundary') || lc.includes('private')), 'plan must state raw token only inside verifier call boundary');
    assert.ok(lc.includes('no raw token logs') || (lc.includes('raw token logs') && lc.includes('forbidden')), 'plan must forbid raw token logs');
    assert.ok(lc.includes('no raw token persistence') || (lc.includes('raw token persistence') && lc.includes('forbidden')), 'plan must forbid raw token persistence');
    assert.ok(lc.includes('storage') && lc.includes('rate-limit') && lc.includes('provider') && lc.includes('observability') && lc.includes('forbidden'), 'plan must forbid raw token propagation to storage/rate-limit/provider/observability');
    assert.ok(lc.includes('tokenhash') && lc.includes('safe payload'), 'plan must state tokenHash / authorizationScheme only in safe payloads');
  },
});

// ── 7. Future verifier input contract is documented ────────────────────────
tests.push({
  name: 'Future verifier input contract is documented (private rawToken boundary / requestId / tokenHash / authorizationScheme / providerMode / endpointPath / nowMs)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('private raw token boundary') || (lc.includes('rawtoken') && lc.includes('private')), 'plan must state private rawToken boundary');
    for (const field of ['requestid', 'tokenhash', 'authorizationscheme', 'providermode', 'endpointpath', 'nowms']) {
      assert.ok(lc.includes(field), `plan must list input field "${field}"`);
    }
  },
});

// ── 8. Future verifier output contract is documented ───────────────────────
tests.push({
  name: 'Future verifier output contract is documented (allowed / code / safe reason / userKeyHash only / no raw UID/email / no raw Firebase claims / no raw decoded token)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('allowed') && lc.includes('boolean'), 'plan must list allowed (boolean) output field');
    assert.ok(lc.includes('code') && lc.includes('string'), 'plan must list code output field');
    assert.ok(lc.includes('reason') && lc.includes('safe'), 'plan must list safe reason output field');
    assert.ok(lc.includes('userkeyhash') && lc.includes('non-reversible'), 'plan must state userKeyHash is non-reversible');
    assert.ok(lc.includes('no raw uid') || (lc.includes('no raw') && lc.includes('uid')), 'plan must prohibit raw UID');
    assert.ok(lc.includes('no raw firebase claims') || (lc.includes('no raw') && lc.includes('firebase claims')), 'plan must prohibit raw Firebase claims');
    assert.ok(lc.includes('no raw decoded token') || (lc.includes('no raw') && lc.includes('decoded token')), 'plan must prohibit raw decoded token');
  },
});

// ── 9. Error mapping is documented ─────────────────────────────────────────
tests.push({
  name: 'Error mapping is documented (invalid token / expired token / verifier unavailable / config missing / permission/config error / unknown verifier error)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    for (const err of ['invalid token', 'expired token', 'permission', 'unknown verifier error']) {
      assert.ok(lc.includes(err), `plan must map error "${err}"`);
    }
    assert.ok(lc.includes('config') && lc.includes('missing'), 'plan must map "config missing" (CONFIG + MISSING)');
    assert.ok(lc.includes('verifier') && lc.includes('unavailable'), 'plan must map "verifier unavailable" (VERIFIER + UNAVAILABLE)');
    assert.ok(lc.includes('auth_invalid') || (lc.includes('auth') && lc.includes('invalid')), 'plan must map to AUTH_INVALID');
    assert.ok(lc.includes('verify_unavailable') || (lc.includes('verify') && lc.includes('unavailable')), 'plan must map to VERIFY_UNAVAILABLE');
  },
});

// ── 10. Required future tests are documented ────────────────────────────────
tests.push({
  name: 'Required future tests are documented (side-effect-free import / default mock-disabled / Firebase mode disabled unless env opt-in / no token logs / no service account logs / no provider API / no storage call / no endpoint default live / safe error mapping / observer safe-swallow unchanged)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    for (const t of [
      'side-effect-free',
      'no token logs',
      'no service account logs',
      'no provider api call',
      'no storage call from verifier',
      'no endpoint default live',
      'safe error mapping',
      'observer safe-swallow unchanged',
    ]) {
      assert.ok(lc.includes(t), `plan must list required test "${t}"`);
    }
    assert.ok(lc.includes('firebase') && lc.includes('mode is disabled'), 'plan must state "firebase ... mode is disabled"');
    assert.ok(lc.includes('default mode remains') && lc.includes('mock_disabled'), 'plan must state "default mode remains mock_disabled"');
  },
});

// ── 11. Required future docs are documented ────────────────────────────────
tests.push({
  name: 'Required future docs are documented (gate status update / secret/config checklist / staging rollout plan / production readiness gates / incident/rotation runbook)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('gate status') || (lc.includes('gate') && lc.includes('update')), 'plan must list gate status update');
    assert.ok(lc.includes('secret / config deployment checklist') || (lc.includes('secret') && lc.includes('config') && lc.includes('deployment')), 'plan must list secret/config deployment checklist');
    assert.ok(lc.includes('staging rollout') || (lc.includes('staging') && lc.includes('rollout')), 'plan must list staging rollout plan');
    assert.ok(lc.includes('production readiness gates') || (lc.includes('production readiness') && lc.includes('gates')), 'plan must list production readiness gates');
    assert.ok(lc.includes('incident') && lc.includes('rotation'), 'plan must list incident/rotation runbook');
  },
});

// ── 12. Go / no-go matrix is documented ────────────────────────────────────
tests.push({
  name: 'Go / no-go matrix is documented (plan Done / real Firebase Admin SDK No / real token verification No / external auth No / endpoint default live No / staging_live No / production_live No / provider API No)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('go / no-go') || lc.includes('go/no-go'), 'plan must have a go/no-go matrix');
    assert.ok(lc.includes('done'), 'plan must mark plan as Done');
    assert.ok(lc.includes('real firebase admin sdk') && lc.includes('no'), 'plan must state no real Firebase Admin SDK in this PR');
    assert.ok(lc.includes('real token verification') && lc.includes('no'), 'plan must state no real token verification in this PR');
    assert.ok(lc.includes('staging_live') && lc.includes('no'), 'plan must state no staging_live opt-in in this PR');
    assert.ok(lc.includes('production_live') && lc.includes('no'), 'plan must state no production_live opt-in in this PR');
    assert.ok(lc.includes('provider api') && lc.includes('no'), 'plan must state no provider API call in this PR');
  },
});

// ── 13. Remaining blockers are documented ──────────────────────────────────
tests.push({
  name: 'Remaining blockers are documented (rollback doc / observability doc / rate-limit storage plan / staging soak / secret rotation drill / CTO approval)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    for (const b of [
      'rollback / kill-switch policy',
      'observability policy',
      'plan scout runtime rate-limit storage',
      'one-day staging soak',
      'seven-day staging soak',
      'secret rotation drill',
      'cto approval',
    ]) {
      assert.ok(lc.includes(b), `plan must list blocker "${b}"`);
    }
  },
});

// ── 14. Locks / evidence is documented ─────────────────────────────────────
tests.push({
  name: 'Locks / evidence is documented (this test + 21 prior audit tests)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('locks / evidence') || lc.includes('locks/evidence'), 'plan must have a Locks / evidence section');
    assert.ok(lc.includes('scout-runtime-firebase-auth-verifier-implementation-plan-contract.test.cjs'), 'plan must list the new test file as a lock');
    assert.ok(lc.includes('runtime-adapter-implementation-gate-contract.test.cjs'), 'plan must list the gate contract test as a lock');
    assert.ok(lc.includes('adapter-wiring-readiness-audit-contract.test.cjs'), 'plan must list the audit contract test as a lock');
  },
});

// ── 15. Explicit verdict is documented ─────────────────────────────────────
tests.push({
  name: 'Explicit verdict is documented (plan ready:Yes / all 6 surfaces No / recommended next slice = rate-limit storage plan or rollback/observability doc)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('explicit verdict') || lc.includes('verdict'), 'plan must have an explicit verdict section');
    assert.ok(lc.includes('ready for firebase auth verifier implementation plan') && lc.includes('yes'), 'plan must state ready for Firebase auth verifier implementation plan: Yes');
    assert.ok(lc.includes('ready for real firebase admin sdk') && lc.includes('no'), 'plan must state no real Firebase Admin SDK in this PR');
    assert.ok(lc.includes('ready for real token verification') && lc.includes('no'), 'plan must state no real token verification in this PR');
    assert.ok(lc.includes('staging_live') && lc.includes('no'), 'plan must state no staging_live in this PR');
    assert.ok(lc.includes('production_live') && lc.includes('no'), 'plan must state no production_live in this PR');
    assert.ok(lc.includes('provider api') && lc.includes('no'), 'plan must state no provider API call in this PR');
    assert.ok(lc.includes('recommended next slice'), 'plan must recommend the next slice');
  },
});

// ── 16. Branch safety reminder is documented ──────────────────────────────
tests.push({
  name: 'Branch safety reminder is documented (serial checkout / branch confirm before commit)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('serial') || lc.includes('branch safety') || lc.includes('branch must be confirmed'), 'plan must document branch safety');
  },
});

// ── 17. Gate contract cross-reference is documented ────────────────────────
tests.push({
  name: 'Gate contract cross-reference is documented (PR #2309 / da87d2d1)',
  fn: () => {
    const lc = planDoc.toLowerCase();
    assert.ok(lc.includes('pr #2309') || lc.includes('da87d2d1'), 'plan must reference PR #2309 / da87d2d1');
    assert.ok(gateDoc.length > 0, 'gate contract doc must exist on disk');
  },
});

// ── 18. No runtime code files changed by this slice ────────────────────────
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

// ── 19. Endpoint default stub preserved ────────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must reference STUB mode');
    assert.ok(suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'), 'suggest.js must define STUB mode constant');
  },
});

// ── 20. Frontend default local_stub preserved ─────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 21. Endpoint client default disabled preserved ─────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no plan-related wiring in client)',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('firebase-auth-verifier-implementation-plan'),
      'endpoint client must not reference the plan doc'
    );
    assert.ok(
      !endpointClientCode.includes('firebase auth verifier implementation plan'),
      'endpoint client must not be plan-related'
    );
  },
});

// ── 22. No Firebase Admin SDK in any runtime module ───────────────────────
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

// ── 23. No KV / Durable Object / D1 / database in runtime code ─────────────
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

// ── 24. No fetch / XHR / axios in runtime code ────────────────────────────
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

// ── 25. No provider SDK imports in runtime code ───────────────────────────
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

// ── 26. No secrets / env usage in runtime code ────────────────────────────
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

// ── 27. Related docs reflect plan status ───────────────────────────────────
tests.push({
  name: 'Related docs exist and reflect the Firebase auth verifier implementation plan status',
  fn: () => {
    for (const docName of RELATED_DOCS) {
      const docPath = path.join(ROOT, 'docs/product/' + docName);
      const doc = readFileSafe(docPath);
      assert.ok(doc.length > 0, `${docName} must exist`);
      const lc = doc.toLowerCase();
      assert.ok(
        lc.includes('firebase auth verifier implementation plan') || lc.includes('plan status') || lc.includes('firebase verifier plan status'),
        `${docName} must reference the Firebase auth verifier implementation plan status`
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
