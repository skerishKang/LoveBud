'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-secret-incident-runbook-contract.md');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');

function read(p) { try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; } }

const doc = read(DOC_PATH);
const d = doc.toLowerCase();
const adapter = read(ADAPTER_PATH);
const suggest = read(SUGGEST_PATH);
const srcSel = read(SOURCE_SELECTOR_PATH);

// ─── 1. Document exists ───────────────────────────────────────────────────────

assert.ok(fs.existsSync(DOC_PATH), 'Document must exist');
assert.ok(doc.length > 0, 'Document must not be empty');

// ─── 2. Secret storage policy ─────────────────────────────────────────────────

const storageRules = ['platform secret', 'no committed secrets', 'no frontend secrets', 'staging/prod'];
const foundS = storageRules.filter(t => d.includes(t));
assert.ok(foundS.length >= 3, `Secret storage policy must document key rules. Found: ${foundS.join(', ')}`);

// ─── 3. Secret rotation policy ────────────────────────────────────────────────

const rotation = ['scheduled rotation', 'emergency rotation', 'owner', 'verification', 'rollback'];
const foundR = rotation.filter(t => d.includes(t));
assert.ok(foundR.length >= 3, `Rotation policy must document key elements. Found: ${foundR.join(', ')}`);

// ─── 4. Emergency revocation policy ───────────────────────────────────────────

assert.ok(
  d.includes('disable live') || d.includes('disable live adapter') || d.includes('kill switch'),
  'Emergency revocation must describe disabling live mode'
);
assert.ok(
  d.includes('revoke') && (d.includes('key') || d.includes('credential')),
  'Emergency revocation must describe key revocation'
);

// ─── 5. Incident response triggers ────────────────────────────────────────────

const triggers = ['key leakage', 'provider compromise', 'abuse spike', 'cost cap', 'error spike', 'safety filter', 'unsafe output', 'logging leak'];
const foundT = triggers.filter(t => d.includes(t));
assert.ok(foundT.length >= 6, `Incident triggers must be documented. Found: ${foundT.join(', ')}`);

// ─── 6. Incident severity levels ──────────────────────────────────────────────

assert.ok(d.includes('sev0'), 'Must document SEV0 severity');
assert.ok(d.includes('sev1'), 'Must document SEV1 severity');
assert.ok(d.includes('sev2') || d.includes('sev3'), 'Must document SEV2 or SEV3 severity');

// ─── 7. Incident workflow ─────────────────────────────────────────────────────

const workflow = ['detect', 'classify', 'contain', 'disable', 'rotate', 'validate', 'communicate', 'restore', 'review'];
const foundW = workflow.filter(t => d.includes(t));
assert.ok(foundW.length >= 6, `Incident workflow must document key steps. Found: ${foundW.join(', ')}`);

// ─── 8. Rollback drill policy ─────────────────────────────────────────────────

assert.ok(
  d.includes('production_live') || d.includes('production live'),
  'Rollback drill must cover production_live → staging'
);
assert.ok(
  d.includes('staging_live') || d.includes('staging live'),
  'Rollback drill must cover staging_live → endpoint_stub'
);
assert.ok(
  d.includes('local_stub') || d.includes('fallback'),
  'Rollback drill must cover fallback to local_stub'
);

// ─── 9. Kill-switch drill policy ──────────────────────────────────────────────

assert.ok(
  d.includes('disable live') || d.includes('provider_unavailable'),
  'Kill-switch drill must include disabling live adapter'
);
assert.ok(
  d.includes('frontend') || d.includes('local_stub'),
  'Kill-switch drill must verify frontend local_stub'
);

// ─── 10. Provider compromise handling ─────────────────────────────────────────

const compromise = ['revoke', 'rotate', 'block', 're-approval', 'recovery'];
const foundC = compromise.filter(t => d.includes(t));
assert.ok(foundC.length >= 3, `Provider compromise handling must document key steps. Found: ${foundC.join(', ')}`);

// ─── 11. Post-incident review ─────────────────────────────────────────────────

const review = ['timeline', 'blast radius', 'root cause', 'user impact', 'cost impact', 'follow-up'];
const foundRev = review.filter(t => d.includes(t));
assert.ok(foundRev.length >= 4, `Post-incident review must document key fields. Found: ${foundRev.join(', ')}`);

// ─── 12. Privacy/logging policy ───────────────────────────────────────────────

assert.ok(
  d.includes('allowed') && d.includes('prohibited') && d.includes('fields'),
  'Must document allowed and prohibited fields for incident logging'
);

// ─── 13–16. Verdict checks ────────────────────────────────────────────────────

assert.ok(
  (d.includes('ready for real provider api call') && d.includes('no')) ||
  d.includes('real provider api call remains blocked'),
  'Must block real provider API call'
);

const liveBlocked = [
  ['staging_live', 'staging live'],
  ['production_live', 'production live'],
  ['runtime secret rotation', 'runtime secret'],
];
for (const [primary, alt] of liveBlocked) {
  const found = (d.includes(primary) || d.includes(alt)) && d.includes('no');
  assert.ok(found, `Must block ${primary}`);
}

// ─── 17. No provider SDK imports ──────────────────────────────────────────────

const sdkKw = ['openai','anthropic','@anthropic','@google/generative-ai','gemini','groq-sdk','mistral','nvidia'];
const impP = sdkKw.map(kw => [`require\\(['"\`]${kw}['"\`]`, `from ['"\`]${kw}['"\`]`, `import\\(['"\`]${kw}['"\\)]`]);
for (let i=0; i<sdkKw.length; i++) {
  const has = impP[i].some(p => new RegExp(p,'i').test(adapter) || new RegExp(p,'i').test(suggest));
  assert.ok(!has, `Production JS must not import ${sdkKw[i]} SDK`);
}

// ─── 18. No fetch/XHR/axios ───────────────────────────────────────────────────

assert.ok(!adapter.includes('fetch(') && !adapter.includes('XMLHttpRequest') && !adapter.includes('axios'), 'No fetch in adapter');
assert.ok(!suggest.includes('XMLHttpRequest') && !suggest.includes('axios'), 'No XHR/axios in suggest');

// ─── 19. Endpoint stub preserved ──────────────────────────────────────────────

assert.ok(suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB') || suggest.includes("'stub'"), 'Stub mode preserved');
assert.ok(suggest.includes('generateStubSuggestion'), 'generateStubSuggestion exists');

// ─── 20. Frontend local_stub preserved ────────────────────────────────────────

assert.ok(srcSel.includes('local_stub'), 'local_stub default preserved');

// ─── 21. No runtime secret/incident implementation ────────────────────────────

const rtPats = [/\bverifyIdToken\s*\(/, /\bnew\s+KV\s*\(/, /\bDurableObject\s+/, /\bD1Database\s+/];
for (const p of rtPats) {
  assert.ok(!p.test(suggest) && !p.test(adapter), `No runtime implementation: ${p}`);
}

// ─── 22. Docs updated ─────────────────────────────────────────────────────────

const checkFiles = [
  'lovebud-scout-live-provider-cost-quota-abuse-monitoring-contract.md',
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-live-provider-staging-rollout-contract.md',
  'lovebud-scout-live-provider-post-mock-readiness-audit.md',
  'lovebud-scout-provider-secret-config-deployment-checklist.md',
  'lovebud-scout-live-provider-readiness-audit.md',
  'lovebud-scout-ai-suggestion-mvp-readiness.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
].map(f => read(path.join(ROOT, 'docs/product', f)).toLowerCase());

const mentions = checkFiles.some(c =>
  c.includes('secret rotation') || c.includes('incident runbook') || c.includes('secret incident')
);
assert.ok(mentions, 'At least one existing doc must mention secret/incident runbook');

console.log('✓ All secret-incident-runbook contract tests passed.');
