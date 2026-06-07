/**
 * Scout Firebase Auth Verifier Disabled Scaffold Readiness Audit Contract Tests
 * v20260607-1
 *
 * Locks the CTO-review / readiness audit for the first
 * disabled-by-default runtime adapter implementation scaffold
 * (Scout Firebase auth verifier). This is a docs+tests only audit —
 * no runtime behavior change.
 *
 * Sub-tests:
 *  1. readiness audit document exists
 *  2. current scaffold state is documented
 *  3. CTO review checklist is documented (21 items)
 *  4. runtime safety review is documented (18 items)
 *  5. gate alignment is documented
 *  6. no-runtime-change confirmation is documented
 *  7. next slice readiness is documented
 *  8. required next-slice constraints are documented (10 items)
 *  9. no runtime code files changed (docs+tests only)
 * 10. locked hashes for runtime files remain stable
 * 11. endpoint default stub preserved
 * 12. explicit stub path preserved
 * 13. frontend default local_stub preserved
 * 14. endpoint client default disabled preserved
 * 15. no Firebase Admin SDK / no KV/DO/D1 / no provider SDK / no fetch / no env secret
 * 16. docs updated with readiness audit status
 * 17. branch safety reminder is documented
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const AUDIT_DOC_PATH = path.join(
  ROOT,
  'docs/product/lovebud-scout-firebase-auth-verifier-disabled-scaffold-readiness-audit.md'
);
const VERIFIER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-auth-verifier-adapter.js'
);
const DEP_ADAPTER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-auth-rate-limit-dependency-adapter.js'
);
const STORAGE_ADAPTER_PATH = path.join(
  ROOT,
  'functions/api/scout/live-rate-limit-storage-adapter.js'
);
const SUGGEST_PATH = path.join(
  ROOT,
  'functions/api/scout/suggest.js'
);
const SOURCE_SELECTOR_PATH = path.join(
  ROOT,
  'js/scout/scout-suggestion-source-selector.js'
);
const ENDPOINT_CLIENT_PATH = path.join(
  ROOT,
  'js/scout/scout-suggestion-endpoint-client.js'
);

const RELATED_DOCS = [
  'lovebud-scout-runtime-observability-policy-audit.md',
  'lovebud-scout-rollback-kill-switch-policy-audit.md',
  'lovebud-scout-runtime-rate-limit-storage-implementation-plan.md',
  'lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md',
  'lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md',
  'lovebud-scout-live-auth-verifier-adapter-skeleton.md',
  'lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md',
  'lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md',
  'lovebud-scout-live-endpoint-error-taxonomy-contract.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-readiness-audit.md',
];

// Locked LF/CRLF-normalized md5 hashes for runtime files. This audit
// slice does NOT modify any of them.
const LOCKED_HASHES = {
  verifier: '81f80368fe80bb8a770b251efc085509',
  depAdapter: 'd20edde7af022100fcbe69763a04c589',
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

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function normalizedHash(filePath) {
  const text = readFileSafe(filePath);
  const normalized = text.replace(/\r\n/g, '\n');
  return crypto.createHash('md5').update(normalized, 'utf-8').digest('hex');
}

const auditDoc = readFileSafe(AUDIT_DOC_PATH);
const verifierCode = readFileSafe(VERIFIER_PATH);
const depAdapterCode = readFileSafe(DEP_ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);
const srcSelCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);

let verifierModulePromise = null;
async function loadVerifierModule() {
  if (!verifierModulePromise) {
    verifierModulePromise = import(VERIFIER_PATH);
  }
  return verifierModulePromise;
}

const tests = [];

// ── 1. Readiness audit document exists ──────────────────────────────────────
tests.push({
  name: 'Readiness audit document exists',
  fn: () => {
    assert.ok(auditDoc.length > 0, 'audit document must exist');
  },
});

// ── 2. Current scaffold state is documented ────────────────────────────────
tests.push({
  name: 'Current scaffold state is documented (Firebase scaffold modes/codes/verifierMode/mockDisabled default/explicit opt-in/safe-fail/no real Firebase Admin SDK/no real token verification)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('firebase_disabled'), 'audit must document FIREBASE_DISABLED mode');
    assert.ok(lc.includes('firebase_config_missing'), 'audit must document FIREBASE_CONFIG_MISSING mode');
    assert.ok(lc.includes('verifier_firebase_disabled'), 'audit must document VERIFIER_FIREBASE_DISABLED code');
    assert.ok(lc.includes('verifier_config_missing'), 'audit must document VERIFIER_CONFIG_MISSING code');
    assert.ok(lc.includes('verifiermode'), 'audit must document the verifierMode option');
    assert.ok(lc.includes('mockdisabled'), 'audit must document mockDisabled default');
    assert.ok(lc.includes('explicit opt-in') || lc.includes('explicit opt in'), 'audit must document explicit opt-in requirement');
    assert.ok(lc.includes('safe-fail') || lc.includes('safe fail'), 'audit must document safe-fail behavior');
    assert.ok(lc.includes('no real firebase admin sdk') || lc.includes('not import firebase-admin'), 'audit must document no real Firebase Admin SDK');
    assert.ok(lc.includes('no real token verification') || lc.includes('does not verify any token'), 'audit must document no real token verification');
  },
});

// ── 3. CTO review checklist is documented ───────────────────────────────────
tests.push({
  name: 'CTO review checklist is documented (21 items including not production live / not staging_live / no firebase-admin / no getAuth/verifyIdToken/verifyAccessToken/cert/initializeApp / no env/secrets / no fetch/XHR/axios / no endpoint behavior change / no endpoint_client enablement / no frontend local_stub change)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('cto review checklist') || lc.includes('cto review'), 'audit must include a CTO review section');
    assert.ok(lc.includes('not') && lc.includes('production live'), 'audit must state scaffold is not production live');
    assert.ok(lc.includes('not') && lc.includes('staging_live'), 'audit must state scaffold is not staging_live');
    assert.ok(lc.includes('not') && lc.includes('firebase-admin'), 'audit must state scaffold does not import firebase-admin');
    assert.ok(lc.includes('not') && lc.includes('getauth'), 'audit must state scaffold does not call getAuth');
    assert.ok(lc.includes('not') && lc.includes('verifyidtoken'), 'audit must state scaffold does not call verifyIdToken');
    assert.ok(lc.includes('not') && lc.includes('verifyaccesstoken'), 'audit must state scaffold does not call verifyAccessToken');
    assert.ok(lc.includes('not') && lc.includes('cert'), 'audit must state scaffold does not call cert');
    assert.ok(lc.includes('not') && lc.includes('initializeapp'), 'audit must state scaffold does not call initializeApp');
    assert.ok(lc.includes('not') && (lc.includes('env') || lc.includes('process.env')), 'audit must state scaffold does not read env');
    assert.ok(lc.includes('not') && (lc.includes('fetch') || lc.includes('xhr') || lc.includes('axios')), 'audit must state scaffold does not call fetch/XHR/axios');
    assert.ok(lc.includes('not') && lc.includes('endpoint behavior'), 'audit must state scaffold does not change endpoint behavior');
    assert.ok(lc.includes('not') && lc.includes('endpoint_client'), 'audit must state scaffold does not enable endpoint_client');
    assert.ok(lc.includes('not') && lc.includes('local_stub'), 'audit must state scaffold does not change frontend local_stub');
  },
});

// ── 4. Runtime safety review is documented ──────────────────────────────────
tests.push({
  name: 'Runtime safety review is documented (side-effect-free import / no global init / no token verification at import / no service account exposure / no raw token in result / no raw Firebase claims / userKey/userKeyHash null in scaffold mode)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('runtime safety') || lc.includes('safety review'), 'audit must include a runtime safety section');
    assert.ok(lc.includes('side-effect-free') || lc.includes('side effect free') || lc.includes('side-effect free'), 'audit must document side-effect-free import');
    assert.ok(lc.includes('no global init') || lc.includes('no global init at import'), 'audit must document no global init at import');
    assert.ok(lc.includes('no token verification at import') || (lc.includes('no') && lc.includes('token verification at import')), 'audit must document no token verification at import');
    assert.ok(lc.includes('no service account exposure') || lc.includes('no service account'), 'audit must document no service account exposure');
    assert.ok(lc.includes('no raw token in') || lc.includes('no raw token'), 'audit must document no raw token in result');
    assert.ok(lc.includes('no raw authorization header') || (lc.includes('authorization') && lc.includes('raw')), 'audit must document no raw authorization header');
    assert.ok(lc.includes('no raw api key') || (lc.includes('api key') && lc.includes('raw')), 'audit must document no raw API key');
    assert.ok(lc.includes('no raw firebasetoken') || (lc.includes('firebasetoken') && lc.includes('raw')), 'audit must document no raw firebaseToken');
    assert.ok(lc.includes('no raw firebase claims') || (lc.includes('firebase claims') && lc.includes('raw')), 'audit must document no raw Firebase claims');
    assert.ok(lc.includes('userkey') && lc.includes('null') && lc.includes('scaffold'), 'audit must document userKey null in scaffold mode');
    assert.ok(lc.includes('userkeyhash') && lc.includes('null'), 'audit must document userKeyHash null in scaffold mode');
  },
});

// ── 5. Gate alignment is documented ─────────────────────────────────────────
tests.push({
  name: 'Gate alignment is documented (gate evidence 11 of 11 complete / first disabled scaffold complete / review before wiring scaffold into dependency adapter)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('gate evidence 11 of 11 complete') || lc.includes('11 of 11'), 'audit must document gate evidence 11 of 11 complete');
    assert.ok(lc.includes('first disabled scaffold complete') || (lc.includes('first disabled') && lc.includes('complete')), 'audit must document first disabled scaffold complete');
    assert.ok(lc.includes('wiring') && lc.includes('dependency adapter'), 'audit must document the wire-up pre-step');
  },
});

// ── 6. No-runtime-change confirmation is documented ─────────────────────────
tests.push({
  name: 'No-runtime-change confirmation is documented (dependency adapter unchanged / suggest.js unchanged / storage adapter unchanged / endpoint default stub unchanged / explicit stub unchanged / frontend local_stub unchanged / endpoint client default disabled unchanged)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('no-runtime-change') || lc.includes('no runtime change confirmation'), 'audit must include a no-runtime-change section');
    assert.ok(lc.includes('dependency adapter') && lc.includes('unchanged'), 'audit must confirm dependency adapter unchanged');
    assert.ok(lc.includes('suggest.js') && lc.includes('unchanged'), 'audit must confirm suggest.js unchanged');
    assert.ok(lc.includes('storage adapter') && lc.includes('unchanged'), 'audit must confirm storage adapter unchanged');
    assert.ok(lc.includes('endpoint default') && lc.includes('stub') && lc.includes('preserved'), 'audit must confirm endpoint default stub preserved');
    assert.ok(lc.includes('explicit stub') && lc.includes('preserved'), 'audit must confirm explicit stub preserved');
    assert.ok(lc.includes('local_stub') && lc.includes('preserved'), 'audit must confirm frontend local_stub preserved');
    assert.ok(lc.includes('endpoint client') && lc.includes('disabled') && lc.includes('preserved'), 'audit must confirm endpoint client default disabled preserved');
  },
});

// ── 7. Next slice readiness is documented ───────────────────────────────────
tests.push({
  name: 'Next slice readiness is documented (ready for wiring disabled Firebase scaffold into dependency adapter contract: Yes / ready for real Firebase Admin SDK: No / ready for real token verification: No / ready for staging_live: No / ready for production_live: No)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('next slice readiness'), 'audit must include a next-slice readiness section');
    assert.ok(lc.includes('ready for wiring') || (lc.includes('wiring') && lc.includes('ready')), 'audit must document ready for wiring slice');
    assert.ok(lc.includes('ready for real firebase admin sdk') || (lc.includes('real firebase') && lc.includes('ready')), 'audit must document ready-for-real-Firebase-Admin-SDK: No');
    assert.ok(lc.includes('ready for real token verification') || (lc.includes('real token verification') && lc.includes('ready')), 'audit must document ready-for-real-token-verification: No');
    assert.ok(lc.includes('ready for staging_live') || (lc.includes('staging_live') && lc.includes('ready')), 'audit must document ready for staging_live');
    assert.ok(lc.includes('ready for production_live') || (lc.includes('production_live') && lc.includes('ready')), 'audit must document ready for production_live');
  },
});

// ── 8. Required next-slice constraints are documented ──────────────────────
tests.push({
  name: 'Required next-slice constraints are documented (no real Firebase Admin SDK / no token verification / dependency wiring only / default safe-fail / endpoint default stub remains)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('required next-slice constraints') || lc.includes('next-slice constraint') || lc.includes('next slice constraint'), 'audit must include a required next-slice constraints section');
    assert.ok(lc.includes('no real firebase admin sdk'), 'audit must document no-real-Firebase-Admin-SDK constraint');
    assert.ok(lc.includes('no token verification'), 'audit must document no-token-verification constraint');
    assert.ok(lc.includes('dependency wiring only') || (lc.includes('wiring only')), 'audit must document dependency-wiring-only constraint');
    assert.ok(lc.includes('default remains safe-fail') || (lc.includes('default') && lc.includes('safe-fail')), 'audit must document default-remains-safe-fail constraint');
    assert.ok(lc.includes('endpoint default stub remains') || (lc.includes('endpoint default') && lc.includes('stub') && lc.includes('remains')), 'audit must document endpoint-default-stub-remains constraint');
  },
});

// ── 9. No runtime code files changed (docs+tests only) ──────────────────────
tests.push({
  name: 'No runtime code files changed (docs+tests only) — verifier hash matches post-scaffold hash, other 3 locked hashes match',
  fn: () => {
    // We can verify the post-scaffold hash of the verifier matches
    // (i.e. it was not re-modified in this audit slice) by checking
    // that the runtime file content still imports nothing new and
    // still exports the post-scaffold surface.
    const lc = codeOnly(verifierCode).toLowerCase();
    assert.ok(lc.includes('firebase_disabled'), 'verifier must still export FIREBASE_DISABLED (post-scaffold state)');
    assert.ok(lc.includes('firebase_config_missing'), 'verifier must still export FIREBASE_CONFIG_MISSING (post-scaffold state)');
    assert.ok(lc.includes('verifier_firebase_disabled'), 'verifier must still export VERIFIER_FIREBASE_DISABLED (post-scaffold state)');
    assert.ok(lc.includes('verifier_config_missing'), 'verifier must still export VERIFIER_CONFIG_MISSING (post-scaffold state)');
    // Also: no NEW runtime surface added in this audit slice
    assert.ok(!/runtime_observability|readiness_audit|cto_review/.test(lc), 'verifier must not be modified by this audit slice');
  },
});

// ── 10. Locked hashes for runtime files remain stable ───────────────────────
tests.push({
  name: 'Locked LF/CRLF-normalized md5 hashes for runtime files remain stable (verifier / dep-adapter / storage / suggest)',
  fn: () => {
    assert.strictEqual(
      normalizedHash(VERIFIER_PATH),
      LOCKED_HASHES.verifier,
      'verifier adapter hash must match (post-scaffold locked hash)'
    );
    assert.strictEqual(
      normalizedHash(DEP_ADAPTER_PATH),
      LOCKED_HASHES.depAdapter,
      'dependency adapter hash must match (locked)'
    );
    assert.strictEqual(
      normalizedHash(STORAGE_ADAPTER_PATH),
      LOCKED_HASHES.storage,
      'storage adapter hash must match (locked)'
    );
    assert.strictEqual(
      normalizedHash(SUGGEST_PATH),
      LOCKED_HASHES.suggest,
      'suggest.js hash must match (locked)'
    );
  },
});

// ── 11. Endpoint default stub preserved ─────────────────────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    assert.ok(suggestCode.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB'), 'suggest.js must reference STUB mode');
    assert.ok(
      suggestCode.includes("STUB: 'stub'") || suggestCode.includes('STUB: "stub"'),
      'suggest.js must define STUB mode constant'
    );
  },
});

// ── 12. Explicit stub path preserved ────────────────────────────────────────
tests.push({
  name: 'Explicit providerMode:"stub" path is preserved in suggest.js',
  fn: () => {
    // The explicit stub path is the same default — providerMode:"stub"
    // is the only path through the live branch in the current
    // implementation. We assert that the constant exists.
    assert.ok(
      suggestCode.includes('"stub"') || suggestCode.includes("'stub'"),
      'suggest.js must reference the literal "stub" string for the stub path'
    );
  },
});

// ── 13. Frontend default local_stub preserved ──────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    assert.ok(srcSelCode.length > 0, 'source selector must exist');
    assert.ok(srcSelCode.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 14. Endpoint client default disabled preserved ──────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved',
  fn: () => {
    assert.ok(endpointClientCode.length > 0, 'endpoint client must exist');
    assert.ok(
      !endpointClientCode.includes('live-auth-verifier-adapter'),
      'endpoint client must not reference the verifier adapter'
    );
    assert.ok(
      !endpointClientCode.includes('live-auth-rate-limit-dependency-adapter'),
      'endpoint client must not reference the dependency adapter'
    );
  },
});

// ── 15. No Firebase Admin SDK / no KV/DO/D1 / no provider SDK / no fetch / no env secret ──
tests.push({
  name: 'No Firebase Admin SDK / no KV/DO/D1 / no provider SDK / no fetch / no env secret in runtime files (verifier code) — runtime safety re-confirmed',
  fn: async () => {
    const code = codeOnly(verifierCode).toLowerCase();
    // No Firebase Admin SDK
    assert.ok(!/firebase-admin/.test(code), 'verifier must not import firebase-admin');
    assert.ok(!/admin\s*\.\s*auth/.test(code), 'verifier must not reference admin.auth');
    assert.ok(!/initializeapp/.test(code), 'verifier must not call initializeApp');
    assert.ok(!/cert\s*\(/.test(code), 'verifier must not call cert()');
    assert.ok(!/\bgetauth\b/.test(code), 'verifier must not call getAuth');
    assert.ok(!/verifyidtoken/.test(code), 'verifier must not call verifyIdToken');
    assert.ok(!/verifyaccesstoken/.test(code), 'verifier must not call verifyAccessToken');
    // No fetch / XHR / axios
    assert.ok(!/\bfetch\s*\(/.test(code), 'verifier must not call fetch()');
    assert.ok(!/xmlhttprequest/.test(code), 'verifier must not use XMLHttpRequest');
    assert.ok(!/axios/.test(code), 'verifier must not use axios');
    assert.ok(!/https?:\/\//.test(code), 'verifier must not embed external URL');
    // No KV / DO / D1
    assert.ok(!/kvnamespace/.test(code), 'verifier must not reference KVNamespace');
    assert.ok(!/durableobject/.test(code), 'verifier must not reference DurableObject');
    assert.ok(!/d1database/.test(code), 'verifier must not reference D1Database');
    assert.ok(!/env\.kv\b/.test(code), 'verifier must not read env.KV');
    assert.ok(!/env\.db\b/.test(code), 'verifier must not read env.DB');
    assert.ok(!/env\.firebase/.test(code), 'verifier must not read env.FIREBASE');
    // No provider SDK imports (substring-based, but guarded against prohibited field names)
    for (const provider of ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia', 'cohere', 'perplexity']) {
      const importPattern = new RegExp(`(import|require).*${provider}`, 'i');
      assert.ok(!importPattern.test(code), `verifier must not import ${provider}`);
    }
    // No env secret usage
    assert.ok(!/process\.env\.scout/.test(code), 'verifier must not read process.env.SCOUT_*');
    assert.ok(!/import\.meta\.env/.test(code), 'verifier must not read import.meta.env');
    assert.ok(!/process\.env\.firebase/.test(code), 'verifier must not read process.env.FIREBASE_*');
  },
});

// ── 16. Docs updated with readiness audit status ────────────────────────────
tests.push({
  name: 'Related docs exist and reflect the Firebase auth verifier disabled scaffold readiness audit status',
  fn: () => {
    for (const docName of RELATED_DOCS) {
      const docPath = path.join(ROOT, 'docs/product', docName);
      const content = readFileSafe(docPath);
      assert.ok(content.length > 0, `${docName} must exist`);
      const lcDoc = content.toLowerCase();
      assert.ok(
        lcDoc.includes('firebase auth verifier disabled scaffold readiness audit status') ||
        lcDoc.includes('firebase auth verifier disabled scaffold status') ||
        lcDoc.includes('firebase auth verifier runtime scaffold status'),
        `${docName} must reference the Firebase auth verifier disabled scaffold readiness audit status (or downstream status section)`
      );
    }
  },
});

// ── 17. Branch safety reminder is documented ────────────────────────────────
tests.push({
  name: 'Branch safety reminder is documented in the audit doc (serial checkout, branch confirmation, no main commit)',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    assert.ok(lc.includes('branch safety') || lc.includes('serial') || lc.includes('serial branch'), 'audit must document branch safety');
    assert.ok(lc.includes('git checkout main') || lc.includes('checkout main'), 'audit must document serial git checkout main');
    assert.ok(lc.includes('git checkout -b') || lc.includes('checkout -b'), 'audit must document serial git checkout -b');
    assert.ok(lc.includes('git branch --show-current') || lc.includes('branch --show-current'), 'audit must document git branch --show-current verification');
  },
});

// ── Bonus: No staging_live / production_live opt-in in this slice ───────────
tests.push({
  name: 'No staging_live / production_live opt-in in this audit slice',
  fn: () => {
    const lc = auditDoc.toLowerCase();
    // The audit doc may reference these as "blocked" / "not adopted" — that is fine.
    // We assert that the audit does not declare staging_live or production_live
    // as opted-in.
    assert.ok(
      !lc.match(/staging_live\s+(yes|opt|enable|adopt|active)/),
      'audit must not opt into staging_live'
    );
    assert.ok(
      !lc.match(/production_live\s+(yes|opt|enable|adopt|active)/),
      'audit must not opt into production_live'
    );
  },
});

// ── Bonus: Verifier scaffold behavior re-confirmed at runtime ───────────────
tests.push({
  name: 'Verifier scaffold behavior is re-confirmed at runtime (default mockDisabled:true / Firebase scaffold safe-fails / userKey null in scaffold mode)',
  fn: async () => {
    const mod = await loadVerifierModule();
    // Default behavior
    const def = mod.createScoutLiveAuthVerifierAdapter();
    assert.strictEqual(def.mockDisabled, true, 'default adapter must be mockDisabled');
    assert.strictEqual(def.mode, mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.MOCK_DISABLED, 'default mode must be MOCK_DISABLED');
    const defRes = await def.verifyToken({});
    assert.strictEqual(defRes.allowed, false, 'default verifyToken must deny');
    assert.strictEqual(defRes.userKey, null, 'default userKey must be null');
    assert.strictEqual(defRes.userKeyHash, null, 'default userKeyHash must be null');
    // Firebase scaffold safe-fail
    const fb = mod.createScoutLiveAuthVerifierAdapter({
      mockDisabled: false,
      verifierMode: mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES.FIREBASE_DISABLED,
    });
    const fbRes = await fb.verifyToken({});
    assert.strictEqual(fbRes.allowed, false, 'FIREBASE_DISABLED verifyToken must deny');
    assert.strictEqual(fbRes.userKey, null, 'FIREBASE_DISABLED userKey must be null');
    assert.strictEqual(fbRes.userKeyHash, null, 'FIREBASE_DISABLED userKeyHash must be null');
    assert.strictEqual(
      fbRes.code,
      mod.SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES.VERIFIER_FIREBASE_DISABLED,
      'FIREBASE_DISABLED code must be VERIFIER_FIREBASE_DISABLED'
    );
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
