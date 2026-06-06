'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-cost-quota-abuse-monitoring-contract.md');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
}

const doc = readFileSafe(DOC_PATH);
const d = doc.toLowerCase();
const adapter = readFileSafe(ADAPTER_PATH);
const suggest = readFileSafe(SUGGEST_PATH);
const srcSel = readFileSafe(SOURCE_SELECTOR_PATH);

// ─── 1. Document exists ───────────────────────────────────────────────────────

assert.ok(fs.existsSync(DOC_PATH), 'Document must exist');
assert.ok(doc.length > 0, 'Document must not be empty');

// ─── 2. Cost cap policy ───────────────────────────────────────────────────────

const costCaps = ['per-request', 'per-user daily', 'per-environment', 'provider-level monthly', 'staging lower', 'hard stop'];
const foundCost = costCaps.filter(t => d.includes(t));
assert.ok(foundCost.length >= 4, `Cost cap policy must document key caps. Found: ${foundCost.join(', ')}`);

// ─── 3. Quota budget policy ───────────────────────────────────────────────────

const quotaTerms = ['per-minute', 'per-hour', 'per-day', 'staging lower', 'production'];
const foundQuota = quotaTerms.filter(t => d.includes(t));
assert.ok(foundQuota.length >= 3, `Quota budget policy must document key budgets. Found: ${foundQuota.join(', ')}`);

// ─── 4. Usage accounting dimensions ───────────────────────────────────────────

const acctDims = ['requestid', 'userkey', 'providermode', 'providername', 'modelname', 'latencyms', 'errorcode'];
for (const dim of acctDims) {
  assert.ok(d.includes(dim), `Must document usage accounting dimension: ${dim}`);
}

// ─── 5. Abuse monitoring policy ───────────────────────────────────────────────

const abuseSignals = ['repeated failed', 'burst', 'safety filter', 'sourceurl', 'timeout', 'exhaust'];
const foundSignal = abuseSignals.filter(t => d.includes(t));
assert.ok(foundSignal.length >= 4, `Abuse monitoring must document key signals. Found: ${foundSignal.join(', ')}`);

// ─── 6. Suspicious usage reporting ────────────────────────────────────────────

assert.ok(
  d.includes('safe metadata') || (d.includes('metadata') && d.includes('severity')),
  'Suspicious usage reporting must document safe metadata and severity levels'
);

// ─── 7. Provider failure accounting ───────────────────────────────────────────

const failureCounters = ['timeout count', 'retry exhaustion', 'malformed', 'safety filter', 'provider unavailable', 'config missing'];
const foundCounter = failureCounters.filter(t => d.includes(t));
assert.ok(foundCounter.length >= 4, `Provider failure accounting must document key counters. Found: ${foundCounter.join(', ')}`);

// ─── 8. Abuse escalation policy ───────────────────────────────────────────────

const escalation = ['soft throttle', 'hard block', 're-auth', 'kill switch'];
const foundEsc = escalation.filter(t => d.includes(t));
assert.ok(foundEsc.length >= 3, `Abuse escalation must document stages. Found: ${foundEsc.join(', ')}`);

// ─── 9. Manual kill-switch trigger policy ─────────────────────────────────────

const killTriggers = ['cost cap', 'abuse threshold', 'provider error spike', 'latency spike', 'safety filter spike', 'traffic spike'];
const foundKill = killTriggers.filter(t => d.includes(t));
assert.ok(foundKill.length >= 4, `Kill-switch triggers must be documented. Found: ${foundKill.join(', ')}`);

// ─── 10. Monitoring outputs before staging_live ───────────────────────────────

const stagingOutputs = ['daily quota', 'cost estimate', 'error code', 'abuse event', 'provider failure'];
const foundStg = stagingOutputs.filter(t => d.includes(t));
assert.ok(foundStg.length >= 4, `Staging monitoring outputs must be documented. Found: ${foundStg.join(', ')}`);

// ─── 11. Monitoring outputs before production_live ────────────────────────────

const prodOutputs = ['staging soak', 'cost trend', 'abuse trend', 'rollback drill', 'kill-switch drill'];
const foundProd = prodOutputs.filter(t => d.includes(t));
assert.ok(foundProd.length >= 3, `Production monitoring outputs must be documented. Found: ${foundProd.join(', ')}`);

// ─── 12. Privacy/logging policy ───────────────────────────────────────────────

assert.ok(
  d.includes('allowed') && d.includes('prohibited') && d.includes('fields'),
  'Must document allowed and prohibited fields'
);

// ─── 13–16. Verdict checks ───────────────────────────────────────────────────

assert.ok(
  (d.includes('ready for real provider api call') && d.includes('no')) ||
  d.includes('real provider api call remains blocked'),
  'Must block real provider API call'
);

const liveNo = (topic) =>
  d.includes(`ready for ${topic.toLowerCase()}`) && d.includes('no');
assert.ok(liveNo('staging_live') || liveNo('staging live'), 'Must block staging_live');
assert.ok(liveNo('production_live') || liveNo('production live'), 'Must block production_live');
assert.ok(
  d.includes('runtime monitoring') && d.includes('no'),
  'Must block runtime monitoring implementation'
);

// ─── 17. No provider SDK imports ──────────────────────────────────────────────

const sdkKeywords = ['openai','anthropic','@anthropic','@google/generative-ai','gemini','groq-sdk','mistral','nvidia'];
const impPats = sdkKeywords.map(kw => [
  `require\\(['"\`]${kw}['"\`]`, `from ['"\`]${kw}['"\`]`,
  `import\\(['"\`]${kw}['"\\)]`, `from ['"\`]@?${kw}`,
]);
for (let i = 0; i < sdkKeywords.length; i++) {
  const has = impPats[i].some(p => new RegExp(p,'i').test(adapter) || new RegExp(p,'i').test(suggest));
  assert.ok(!has, `Production JS must not import ${sdkKeywords[i]} SDK`);
}

// ─── 18. No fetch/XHR/axios ───────────────────────────────────────────────────

assert.ok(
  !adapter.includes('fetch(') && !adapter.includes('XMLHttpRequest') && !adapter.includes('axios'),
  'No fetch/XHR/axios in adapter'
);
assert.ok(!suggest.includes('XMLHttpRequest') && !suggest.includes('axios'), 'No XHR/axios in suggest');

// ─── 19. Endpoint stub preserved ──────────────────────────────────────────────

assert.ok(
  suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB') || suggest.includes("'stub'"),
  'Endpoint must preserve stub mode'
);
assert.ok(suggest.includes('generateStubSuggestion'), 'Must have generateStubSuggestion');

// ─── 20. Frontend local_stub preserved ────────────────────────────────────────

assert.ok(srcSel.includes('local_stub'), 'Source selector must preserve local_stub default');

// ─── 21. No runtime cost/quota implementation ─────────────────────────────────

const runtimePats = [/\bverifyIdToken\s*\(/, /\bnew\s+KV\s*\(/, /\bDurableObject\s+/, /\bD1Database\s+/];
for (const pat of runtimePats) {
  assert.ok(!pat.test(suggest) && !pat.test(adapter), `No runtime implementation: ${pat}`);
}

// ─── 22. Docs updated ─────────────────────────────────────────────────────────

const checkDocs = [
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-live-provider-staging-rollout-contract.md',
  'lovebud-scout-live-provider-post-mock-readiness-audit.md',
  'lovebud-scout-provider-secret-config-deployment-checklist.md',
  'lovebud-scout-live-provider-readiness-audit.md',
  'lovebud-scout-ai-suggestion-mvp-readiness.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
].map(f => readFileSafe(path.join(ROOT, 'docs/product', f)).toLowerCase());

const mentions = checkDocs.some(c =>
  c.includes('cost/quota') || c.includes('cost quota') || c.includes('abuse monitoring') || c.includes('cost cap')
);
assert.ok(mentions, 'At least one existing doc must mention cost/quota abuse monitoring');

console.log('✓ All cost-quota-abuse-monitoring contract tests passed.');
