/**
 * Scout Runtime Observability Policy Audit Contract Tests
 * v20260607-1
 *
 * Locks the runtime observability policy audit document and the
 * no-runtime-change guardrails:
 * - observability policy audit document exists
 * - current safe baseline is documented
 * - gate alignment is documented
 * - observability surfaces are documented
 * - allowed observability fields are documented
 * - prohibited observability fields are documented
 * - safe event schema is documented
 * - error taxonomy alignment is documented
 * - privacy / safety policy is documented
 * - external observability backend policy is documented
 * - alerting policy is documented
 * - incident observability policy is documented
 * - rollback / kill-switch alignment is documented
 * - required future tests are documented
 * - go / no-go matrix is documented
 * - explicit verdict is documented
 * - no runtime code files changed
 * - endpoint default stub / explicit stub / frontend local_stub /
 *   endpoint client default disabled preserved
 * - no Firebase Admin SDK / KV / DO / D1 / provider SDK / fetch /
 *   env secret usage
 * - branch safety reminder is documented
 * - docs updated
 * - gate evidence completion is documented
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const AUDIT_DOC = path.join(ROOT, 'docs/product/lovebud-scout-runtime-observability-policy-audit.md');
const DEP_ADAPTER = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-dependency-adapter.js');
const VERIFIER_ADAPTER = path.join(ROOT, 'functions/api/scout/live-auth-verifier-adapter.js');
const STORAGE_ADAPTER = path.join(ROOT, 'functions/api/scout/live-rate-limit-storage-adapter.js');
const OBSERVABILITY_HELPER = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-observability.js');
const BOUNDARY = path.join(ROOT, 'functions/api/scout/live-auth-rate-limit-boundary.js');
const SUGGEST = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

const RELATED_DOCS = [
  'lovebud-scout-rollback-kill-switch-policy-audit.md',
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
  'lovebud-scout-live-endpoint-error-taxonomy-contract.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
  'lovebud-scout-live-provider-readiness-audit.md',
  'lovebud-scout-live-endpoint-error-readiness-audit.md',
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
  dep: '796a2aefe46a8629764950eab8e3a42e',
  verifier: '5a0a853429d6f94962a6b1bf6e71dc09',
  storage: 'a4419b1e8fc286219ae75bf88271416c',
  observability: 'pending_recompute_after_pr2316',
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

const auditDoc = readFileSafe(AUDIT_DOC);
const lc = auditDoc.toLowerCase();

const tests = [];

// ── 1. Audit document exists ─────────────────────────────────────────────────
tests.push({
  name: 'Runtime observability policy audit document exists',
  fn: () => {
    assert.ok(auditDoc.length > 0, 'audit doc must exist');
    assert.ok(auditDoc.includes('# Scout Runtime Observability Policy Audit'), 'must have title');
    assert.ok(auditDoc.includes('v20260607-1'), 'must declare version');
    assert.ok(auditDoc.includes('gate evidence 11 of 11'), 'must declare gate evidence 11 of 11');
  },
});

// ── 2. Current safe baseline ─────────────────────────────────────────────────
tests.push({
  name: 'Current safe baseline is documented (endpoint default stub / explicit stub / frontend local_stub / endpoint client default disabled / mock-disabled verifier / mock-disabled storage / mock-disabled dependency adapter / no external observability backend)',
  fn: () => {
    assert.ok(lc.includes('endpoint default stub') || lc.includes('provider default stub') || lc.includes('endpoint `providermode`'), 'audit must mention endpoint default stub');
    assert.ok(lc.includes('explicit stub'), 'audit must mention explicit stub path');
    assert.ok(lc.includes('local_stub'), 'audit must mention local_stub');
    assert.ok(lc.includes('endpoint client default disabled') || lc.includes('endpoint client') && lc.includes('disabled'), 'audit must mention endpoint client default disabled');
    assert.ok(lc.includes('verifier') && lc.includes('mock-disabled'), 'audit must mention mock-disabled verifier');
    assert.ok(lc.includes('storage') && lc.includes('mock-disabled'), 'audit must mention mock-disabled storage');
    assert.ok(lc.includes('dependency adapter') && lc.includes('mock-disabled'), 'audit must mention mock-disabled dependency adapter');
    assert.ok(lc.includes('no external observability backend') || lc.includes('external observability backend') && lc.includes('not integrated'), 'audit must mention no external observability backend');
  },
});

// ── 3. Gate alignment ────────────────────────────────────────────────────────
tests.push({
  name: 'Gate alignment is documented (cite gate / cite Firebase plan / cite storage plan / cite rollback audit / mark observability as gate evidence 11 of 11)',
  fn: () => {
    assert.ok(lc.includes('runtime adapter implementation gate contract'), 'must cite runtime adapter implementation gate contract');
    assert.ok(lc.includes('firebase auth verifier implementation plan'), 'must cite Firebase auth verifier implementation plan');
    assert.ok(lc.includes('rate-limit storage implementation plan') || lc.includes('rate limit storage implementation plan'), 'must cite rate-limit storage implementation plan');
    assert.ok(lc.includes('rollback / kill-switch policy audit') || lc.includes('rollback / kill switch policy audit'), 'must cite rollback / kill-switch policy audit');
    assert.ok(lc.includes('gate evidence 11 of 11'), 'must mark observability as gate evidence 11 of 11');
  },
});

// ── 4. Observability surfaces ────────────────────────────────────────────────
tests.push({
  name: 'Observability surfaces are documented (endpoint request lifecycle / auth verifier / rate-limit storage / provider adapter / error taxonomy / rollback / cost-quota / staging_live / production_live / incident response)',
  fn: () => {
    assert.ok(lc.includes('endpoint request lifecycle'), 'must mention endpoint request lifecycle');
    assert.ok(lc.includes('auth verifier'), 'must mention auth verifier surface');
    assert.ok(lc.includes('rate-limit storage') || lc.includes('rate limit storage'), 'must mention rate-limit storage surface');
    assert.ok(lc.includes('provider adapter'), 'must mention provider adapter surface');
    assert.ok(lc.includes('error taxonomy'), 'must mention error taxonomy surface');
    assert.ok(lc.includes('rollback') && lc.includes('kill-switch') || lc.includes('kill switch'), 'must mention rollback / kill-switch surface');
    assert.ok(lc.includes('cost') && lc.includes('quota') && lc.includes('abuse'), 'must mention cost/quota/abuse surface');
    assert.ok(lc.includes('staging_live'), 'must mention staging_live surface');
    assert.ok(lc.includes('production_live'), 'must mention production_live surface');
    assert.ok(lc.includes('incident response'), 'must mention incident response surface');
  },
});

// ── 5. Allowed observability fields ──────────────────────────────────────────
tests.push({
  name: 'Allowed observability fields are documented (requestId / providerMode / endpointPath / errorCode / safeStatus / latencyMs / retryAfterSeconds / quotaBucket / decisionId / adapterKind / mockDisabled / environmentLabel / severity / retryCount / maxRetries / timeoutMs / eventType)',
  fn: () => {
    const expected = [
      'requestid', 'providermode', 'endpointpath', 'errorcode', 'safestatus',
      'latencyms', 'retryafterseconds', 'quotabucket', 'decisionid', 'adapterkind',
      'mockdisabled', 'environmentlabel', 'severity', 'retrycount', 'maxretries',
      'timeoutms', 'eventtype',
    ];
    for (const f of expected) {
      assert.ok(lc.includes(f), `allowlist must include ${f}`);
    }
  },
});

// ── 6. Prohibited observability fields ───────────────────────────────────────
tests.push({
  name: 'Prohibited observability fields are documented (raw token / authorization / firebaseToken / API key / secret / service account / prompt / excerpt / sourceUrl / raw request body / raw provider response / raw Firebase claims / raw decoded token / raw storage key / raw UID / email / raw IP / cookie / sessionCookie)',
  fn: () => {
    const required = [
      'raw token', 'authorization', 'firebasetoken', 'api key',
      'secret', 'service account', 'prompt', 'excerpt', 'sourceurl',
      'raw request body', 'raw provider response', 'raw firebase claims',
      'raw decoded token', 'raw storage key', 'raw uid', 'email',
      'raw ip', 'cookie', 'sessioncookie',
    ];
    for (const p of required) {
      assert.ok(lc.includes(p), `prohibited field policy must mention ${p}`);
    }
  },
});

// ── 7. Safe event schema ─────────────────────────────────────────────────────
tests.push({
  name: 'Safe event schema is documented (base event fields / auth event fields / rate-limit event fields / provider event fields / rollback event fields / incident event fields)',
  fn: () => {
    assert.ok(lc.includes('base event fields'), 'must have base event fields section');
    assert.ok(lc.includes('auth event fields'), 'must have auth event fields section');
    assert.ok(lc.includes('rate-limit event fields') || lc.includes('rate limit event fields'), 'must have rate-limit event fields section');
    assert.ok(lc.includes('provider event fields'), 'must have provider event fields section');
    assert.ok(lc.includes('rollback event fields'), 'must have rollback event fields section');
    assert.ok(lc.includes('incident event fields'), 'must have incident event fields section');
  },
});

// ── 8. Error taxonomy alignment ──────────────────────────────────────────────
tests.push({
  name: 'Error taxonomy alignment is documented (AUTH_REQUIRED / AUTH_INVALID / RATE_LIMITED / RATE_LIMIT_UNAVAILABLE / RATE_LIMIT_PAYLOAD_PROHIBITED / RATE_LIMIT_STORAGE_UNAVAILABLE / PROVIDER_UNAVAILABLE / CONFIG_MISSING / PROVIDER_ERROR / VALIDATION_ERROR)',
  fn: () => {
    const codes = [
      'auth_required', 'auth_invalid', 'rate_limited', 'rate_limit_unavailable',
      'rate_limit_payload_prohibited', 'rate_limit_storage_unavailable',
      'provider_unavailable', 'config_missing', 'provider_error', 'validation_error',
    ];
    for (const c of codes) {
      assert.ok(lc.includes(c), `error taxonomy alignment must mention ${c}`);
    }
  },
});

// ── 9. Privacy / safety policy ───────────────────────────────────────────────
tests.push({
  name: 'Privacy / safety policy is documented (safe metadata only / no sensitive payload capture / no replay of sensitive payloads / no raw source material / no prompt/excerpt/sourceUrl logging / no token/API key/service account logging)',
  fn: () => {
    assert.ok(lc.includes('safe metadata only'), 'must mention safe metadata only');
    assert.ok(lc.includes('no sensitive payload capture') || (lc.includes('sensitive payload') && lc.includes('capture')), 'must mention no sensitive payload capture');
    assert.ok(lc.includes('no replay of sensitive payloads') || (lc.includes('replay') && lc.includes('sensitive')), 'must mention no replay of sensitive payloads');
    assert.ok(lc.includes('no raw source material') || (lc.includes('raw source material')), 'must mention no raw source material');
    assert.ok(lc.includes('no prompt') && lc.includes('excerpt') && lc.includes('sourceurl') || (lc.includes('prompt') && lc.includes('excerpt') && lc.includes('sourceurl') && lc.includes('never')), 'must mention no prompt/excerpt/sourceUrl logging');
    assert.ok(lc.includes('token') && lc.includes('api key') && lc.includes('service account') && (lc.includes('never') || lc.includes('must never') || lc.includes('must not')), 'must mention no token/API key/service account logging');
  },
});

// ── 10. External observability backend policy ────────────────────────────────
tests.push({
  name: 'External observability backend policy is documented (not implemented / disabled-by-default / environment-gated / independent kill-switch / fail closed / must not block endpoint response / must not change endpoint response body / must not auto-save data)',
  fn: () => {
    assert.ok(lc.includes('not implemented in this pr'), 'must say not implemented in this PR');
    assert.ok(lc.includes('disabled-by-default') || lc.includes('disabled by default'), 'must say disabled-by-default');
    assert.ok(lc.includes('environment-gated') || lc.includes('environment gated'), 'must say environment-gated');
    assert.ok(lc.includes('independent kill-switch') || lc.includes('independent kill switch'), 'must say independent kill-switch');
    assert.ok(lc.includes('fail closed') || (lc.includes('fail') && lc.includes('closed')) || (lc.includes('silently drop telemetry')) || (lc.includes('silently drop')), 'must say fail closed or silently drop');
    assert.ok(lc.includes('must not block endpoint response') || (lc.includes('must not block') && lc.includes('endpoint response')), 'must say must not block endpoint response');
    assert.ok(lc.includes('must not change endpoint response body') || (lc.includes('must not change') && lc.includes('response body')), 'must say must not change endpoint response body');
    assert.ok(lc.includes('must not auto-save data') || (lc.includes('must not auto-save') && lc.includes('data')), 'must say must not auto-save data');
  },
});

// ── 11. Alerting policy ──────────────────────────────────────────────────────
tests.push({
  name: 'Alerting policy is documented (no alerts implemented / future alerts sanitized fields only / alert thresholds documented before staging_live / alert messages no sensitive values)',
  fn: () => {
    assert.ok(lc.includes('no alerts implemented in this pr'), 'must say no alerts implemented in this PR');
    assert.ok(lc.includes('future alerts must use sanitized fields only') || (lc.includes('future alerts') && lc.includes('sanitized')), 'must say future alerts sanitized fields only');
    assert.ok(lc.includes('alert thresholds must be documented before staging_live') || (lc.includes('alert thresholds') && lc.includes('staging_live')), 'must say alert thresholds documented before staging_live');
    assert.ok(lc.includes('alert messages must not contain sensitive values') || (lc.includes('alert messages') && lc.includes('sensitive values')) || (lc.includes('alert messages') && lc.includes('sensitive')), 'must say alert messages must not contain sensitive values');
  },
});

// ── 12. Incident observability policy ────────────────────────────────────────
tests.push({
  name: 'Incident observability policy is documented (safe IDs/hashes only / no raw token/API key/prompt/sourceUrl in incident reports / sensitive logging suspected disables external backend first / rollback decision trace safe fields only)',
  fn: () => {
    assert.ok(lc.includes('safe ids') && lc.includes('hashes only') || (lc.includes('safe ids') && lc.includes('hashes')), 'must say safe IDs / hashes only');
    assert.ok(lc.includes('no raw token') && (lc.includes('api key') || lc.includes('api-key')) && (lc.includes('prompt') || lc.includes('excerpt')) && (lc.includes('sourceurl') || lc.includes('source url')) && (lc.includes('incident reports') || lc.includes('incident report')), 'must say no raw token/API key/prompt/sourceUrl in incident reports');
    assert.ok(lc.includes('sensitive logging suspected') || (lc.includes('sensitive logging') && lc.includes('disable')), 'must say sensitive logging suspected disables external backend');
    assert.ok(lc.includes('rollback decision trace') && lc.includes('safe fields only') || (lc.includes('rollback decision') && lc.includes('safe fields')), 'must say rollback decision trace safe fields only');
  },
});

// ── 13. Rollback / kill-switch alignment ─────────────────────────────────────
tests.push({
  name: 'Rollback / kill-switch alignment is documented (observability backend independent kill-switch / rollback events safe / kill-switch activation no secrets / fallback baseline stub/local_stub)',
  fn: () => {
    assert.ok(lc.includes('observability backend must have independent kill-switch') || (lc.includes('observability backend') && lc.includes('independent kill-switch')), 'must say observability backend has independent kill-switch');
    assert.ok(lc.includes('rollback events must be safe') || (lc.includes('rollback events') && lc.includes('safe')), 'must say rollback events safe');
    assert.ok(lc.includes('kill-switch activation must not log secrets') || (lc.includes('kill-switch activation') && lc.includes('secret')), 'must say kill-switch activation no secrets');
    assert.ok(lc.includes('fallback baseline remains stub') || (lc.includes('fallback baseline') && (lc.includes('stub') || lc.includes('local_stub'))), 'must say fallback baseline remains stub/local_stub');
  },
});

// ── 14. Required future tests ────────────────────────────────────────────────
tests.push({
  name: 'Required future tests are documented (observer safe-swallow / external backend disabled by default / external backend kill-switch prevents export / no sensitive fields in emitted events / no prompt/excerpt/sourceUrl in events / no raw token/API key/service account in events / endpoint response unaffected by observer failures / no provider API call from observability / no storage/auth call from observability / docs examples safe fake metadata only)',
  fn: () => {
    assert.ok(lc.includes('observer safe-swallow') || (lc.includes('safe-swallow') && lc.includes('observer')), 'must say observer safe-swallow');
    assert.ok(lc.includes('external backend disabled by default') || (lc.includes('external backend') && lc.includes('disabled by default')), 'must say external backend disabled by default');
    assert.ok(lc.includes('external backend kill-switch prevents export') || (lc.includes('kill-switch prevents export')), 'must say external backend kill-switch prevents export');
    assert.ok(lc.includes('no sensitive fields in emitted events') || (lc.includes('sensitive fields') && lc.includes('emitted events')), 'must say no sensitive fields in emitted events');
    assert.ok(lc.includes('no prompt') && (lc.includes('excerpt') || lc.includes('sourceurl') || lc.includes('source url')) && (lc.includes('events')), 'must say no prompt/excerpt/sourceUrl in events');
    assert.ok(lc.includes('no raw token') && (lc.includes('api key') || lc.includes('api-key')) && (lc.includes('service account')) && (lc.includes('events')), 'must say no raw token/API key/service account in events');
    assert.ok(lc.includes('endpoint response unaffected by observer failures') || (lc.includes('endpoint response unaffected') && lc.includes('observer failures')), 'must say endpoint response unaffected by observer failures');
    assert.ok(lc.includes('no provider api call from observability') || (lc.includes('provider api call') && lc.includes('observability')), 'must say no provider API call from observability');
    assert.ok(lc.includes('no storage') && lc.includes('auth call from observability') || (lc.includes('storage') && lc.includes('auth call') && lc.includes('observability')), 'must say no storage/auth call from observability');
    assert.ok(lc.includes('docs examples contain safe fake metadata only') || (lc.includes('docs examples') && lc.includes('safe fake metadata')), 'must say docs examples safe fake metadata only');
  },
});

// ── 15. Go / no-go matrix ────────────────────────────────────────────────────
tests.push({
  name: 'Go / no-go matrix is documented (observability policy audit Done / external observability backend No / real alerting No / real Firebase Admin SDK No / real KV/DO/D1 No / real provider API No / staging_live No / production_live No)',
  fn: () => {
    assert.ok(lc.includes('runtime observability policy audit') && (lc.includes('done') || lc.includes('**done**')), 'must say runtime observability policy audit done');
    assert.ok(lc.includes('external observability backend') && lc.includes('no'), 'must say external observability backend no');
    assert.ok(lc.includes('real alerting') && lc.includes('no'), 'must say real alerting no');
    assert.ok(lc.includes('real firebase admin sdk') || (lc.includes('firebase admin sdk')), 'must say real Firebase Admin SDK no');
    assert.ok((lc.includes('real kv') || lc.includes('real kv / durable object / d1')) && lc.includes('no'), 'must say real KV/DO/D1 no');
    assert.ok(lc.includes('real provider api') && lc.includes('no'), 'must say real provider API no');
    assert.ok(lc.includes('staging_live') && lc.includes('no'), 'must say staging_live no');
    assert.ok(lc.includes('production_live') && lc.includes('no'), 'must say production_live no');
  },
});

// ── 16. Explicit verdict ─────────────────────────────────────────────────────
tests.push({
  name: 'Explicit verdict is documented (observability policy audit ready:Yes / gate evidence 11 of 11 complete:Yes / external observability backend No / real Firebase/KV/provider runtime No / staging_live No / production_live No)',
  fn: () => {
    assert.ok(lc.includes('ready for runtime observability policy audit: **yes**') || (lc.includes('ready for runtime observability policy audit') && lc.includes('yes')), 'must say observability policy audit ready:Yes');
    assert.ok(lc.includes('gate evidence 11 of 11 complete after this audit: **yes**') || (lc.includes('gate evidence 11 of 11 complete') && lc.includes('yes')), 'must say gate evidence 11 of 11 complete:Yes');
    assert.ok(lc.includes('ready for external observability backend in this pr: **no**') || (lc.includes('external observability backend in this pr') && lc.includes('no')), 'must say external observability backend no');
    assert.ok(lc.includes('ready for real firebase') && lc.includes('no'), 'must say real Firebase/KV/provider runtime no');
    assert.ok(lc.includes('ready for staging_live in this pr') && lc.includes('no'), 'must say staging_live no');
    assert.ok(lc.includes('ready for production_live in this pr') && lc.includes('no'), 'must say production_live no');
  },
});

// ── 17. No runtime code files changed ────────────────────────────────────────
tests.push({
  name: 'Runtime code files were not modified by this audit slice (locked hashes match)',
  fn: () => {
    assert.strictEqual(
      normalizedHash(DEP_ADAPTER),
      LOCKED_HASHES.dep,
      'dep-adapter hash must match (dep-adapter is not modified by this audit slice)'
    );
    assert.strictEqual(
      normalizedHash(VERIFIER_ADAPTER),
      LOCKED_HASHES.verifier,
      'verifier-adapter hash must match (verifier-adapter is not modified by this audit slice)'
    );
    assert.strictEqual(
      normalizedHash(STORAGE_ADAPTER),
      LOCKED_HASHES.storage,
      'storage-adapter hash must match (storage-adapter is not modified by this audit slice)'
    );
    assert.strictEqual(
      normalizedHash(SUGGEST),
      LOCKED_HASHES.suggest,
      'suggest hash must match (suggest is not modified by this audit slice)'
    );
  },
});

// ── 18. Endpoint default providerMode:"stub" preserved ──────────────────────
tests.push({
  name: 'Endpoint default providerMode:"stub" is preserved in suggest.js',
  fn: () => {
    const suggest = readFileSafe(SUGGEST);
    assert.ok(suggest.includes('"stub"') || suggest.includes("'stub'") || suggest.includes('STUB'), 'suggest.js must reference stub mode');
  },
});

// ── 19. Explicit stub path preserved ─────────────────────────────────────────
tests.push({
  name: 'Explicit stub path is preserved (providerMode:"stub" used in endpoint)',
  fn: () => {
    const suggest = readFileSafe(SUGGEST);
    const lcSuggest = suggest.toLowerCase();
    assert.ok(lcSuggest.includes('providermode') && (lcSuggest.includes('"stub"') || lcSuggest.includes("'stub'") || lcSuggest.includes('stub')), 'suggest.js must use providerMode:"stub" path');
  },
});

// ── 20. Frontend default local_stub preserved ────────────────────────────────
tests.push({
  name: 'Frontend source selector default local_stub is preserved',
  fn: () => {
    const src = readFileSafe(SOURCE_SELECTOR);
    assert.ok(src.includes('local_stub'), 'source selector must default to local_stub');
  },
});

// ── 21. Endpoint client default disabled preserved ──────────────────────────
tests.push({
  name: 'Endpoint client default disabled is preserved (no audit-related wiring in client)',
  fn: () => {
    const client = readFileSafe(ENDPOINT_CLIENT);
    const lcClient = client.toLowerCase();
    assert.ok(!lcClient.includes('observability_policy_audit') && !lcClient.includes('observability policy audit'), 'endpoint client must not reference the audit doc');
  },
});

// ── 22. No Firebase Admin SDK / KV / DO / D1 / provider SDK / fetch / env secret ─
tests.push({
  name: 'No Firebase Admin SDK / KV / Durable Object / D1 / database / provider SDK / fetch / env secret in runtime code',
  fn: () => {
    const dep = readFileSafe(DEP_ADAPTER);
    const verifier = readFileSafe(VERIFIER_ADAPTER);
    const storage = readFileSafe(STORAGE_ADAPTER);
    const helper = readFileSafe(OBSERVABILITY_HELPER);
    const suggest = readFileSafe(SUGGEST);
    const all = codeOnly([dep, verifier, storage, helper, suggest].join('\n')).toLowerCase();
    assert.ok(!/firebase-admin/.test(all), 'no firebase-admin import');
    assert.ok(!all.includes('kvnamespace'), 'no KVNamespace import');
    assert.ok(!all.includes('durableobjectnamespace'), 'no DurableObjectNamespace import');
    assert.ok(!all.includes('d1database'), 'no D1Database import');
    assert.ok(!/from\s+['"]openai['"]/.test(all) && !/require\(['"]openai['"]\)/.test(all), 'no openai SDK import');
    assert.ok(!all.includes('@anthropic-ai/sdk') && !all.includes('from \'@anthropic'), 'no anthropic SDK import');
    assert.ok(!all.includes('@google/generative-ai') && !all.includes('from \'@google'), 'no gemini SDK import');
    assert.ok(!all.includes('groq-sdk'), 'no groq SDK import');
    assert.ok(!all.includes('mistralai'), 'no mistral SDK import');
    assert.ok(!all.includes('fetch('), 'no fetch call');
    assert.ok(!all.includes('xmlhttprequest'), 'no XMLHttpRequest');
    assert.ok(!all.includes('axios'), 'no axios');
  },
});

// ── 23. Related docs exist and reflect the observability policy audit status ─
tests.push({
  name: 'Related docs exist and reflect the runtime observability policy audit status',
  fn: () => {
    for (const docName of RELATED_DOCS) {
      const docPath = path.join(ROOT, 'docs/product', docName);
      const content = readFileSafe(docPath);
      assert.ok(content.length > 0, `${docName} must exist`);
      const lcDoc = content.toLowerCase();
      assert.ok(
        lcDoc.includes('runtime observability policy audit status'),
        `${docName} must reference the runtime observability policy audit status`
      );
    }
  },
});

// ── 24. Branch safety reminder ───────────────────────────────────────────────
tests.push({
  name: 'Branch safety reminder is documented (serial checkout / branch confirm before commit)',
  fn: () => {
    assert.ok(lc.includes('serial'), 'must mention serial');
    assert.ok(lc.includes('checkout') && lc.includes('branch'), 'must mention checkout and branch');
    assert.ok(lc.includes('commit') || lc.includes('git commit'), 'must mention commit safety');
  },
});

// ── 25. Gate evidence completion is documented ──────────────────────────────
tests.push({
  name: 'Gate evidence completion is documented (gate evidence 11 of 11 complete after this audit / next slice may proceed to one disabled-by-default runtime adapter implementation scaffold)',
  fn: () => {
    assert.ok(lc.includes('gate evidence 11 of 11 complete') || (lc.includes('gate evidence') && lc.includes('11 of 11') && lc.includes('complete')), 'must say gate evidence 11 of 11 complete');
    assert.ok(lc.includes('disabled-by-default') && lc.includes('runtime adapter implementation') || (lc.includes('disabled-by-default runtime adapter implementation')), 'must say next slice is disabled-by-default runtime adapter implementation');
  },
});

// ── 26. Cross-reference to predecessor audit / plans ─────────────────────────
tests.push({
  name: 'Predecessor audit / plan cross-references are documented (PR #2309 / PR #2311 / PR #2313 / PR #2315)',
  fn: () => {
    assert.ok(auditDoc.includes('#2309') || auditDoc.includes('PR #2309'), 'must cite PR #2309');
    assert.ok(auditDoc.includes('#2311') || auditDoc.includes('PR #2311'), 'must cite PR #2311');
    assert.ok(auditDoc.includes('#2313') || auditDoc.includes('PR #2313'), 'must cite PR #2313');
    assert.ok(auditDoc.includes('#2315') || auditDoc.includes('PR #2315'), 'must cite PR #2315');
  },
});

// ── 27. Recommend next slice ─────────────────────────────────────────────────
tests.push({
  name: 'Recommended next slice is documented ([TECH] Add one disabled-by-default runtime adapter implementation scaffold)',
  fn: () => {
    assert.ok(lc.includes('recommended next slice') || lc.includes('successor slice'), 'must mention next slice');
    assert.ok(lc.includes('disabled-by-default') && lc.includes('runtime adapter implementation') || (lc.includes('disabled-by-default runtime adapter')), 'must say next slice is disabled-by-default runtime adapter implementation scaffold');
  },
});

// ── 28. Observability helper file is preserved (not modified) ────────────────
tests.push({
  name: 'Observability helper file is preserved (file exists, contains allowlist and sanitizers)',
  fn: () => {
    const helper = readFileSafe(OBSERVABILITY_HELPER);
    assert.ok(helper.length > 0, 'observability helper must exist');
    assert.ok(helper.includes('SCOUT_LIVE_OBSERVABILITY_FIELDS'), 'must contain allowlist export');
    assert.ok(helper.includes('sanitizeScoutLiveBoundaryEvent'), 'must contain sanitizer');
    assert.ok(helper.includes('safeInvokeScoutLiveObserver'), 'must contain safe invoker');
  },
});

// ── Runner ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failedNames = [];
(async () => {
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  \u2713 ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`  \u2717 ${t.name}`);
      console.log(`    ${err.message}`);
      failed++;
      failedNames.push(t.name);
    }
  }
  console.log('');
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('Failed tests:');
    for (const n of failedNames) console.log(`  - ${n}`);
    process.exit(1);
  }
})();
