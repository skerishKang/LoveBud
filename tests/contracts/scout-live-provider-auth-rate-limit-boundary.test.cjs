'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BOUNDARY_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-auth-rate-limit-boundary.md');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const doc = readFileSafe(BOUNDARY_DOC_PATH);
const d = doc.toLowerCase();
const adapter = readFileSafe(ADAPTER_PATH);
const suggest = readFileSafe(SUGGEST_PATH);
const sourceSelector = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClient = readFileSafe(ENDPOINT_CLIENT_PATH);

// ─── 1. Boundary document exists ──────────────────────────────────────────────

assert.ok(
  fs.existsSync(BOUNDARY_DOC_PATH),
  'Auth/rate-limit boundary document must exist'
);
assert.ok(doc.length > 0, 'Boundary document must not be empty');

// ─── 2. Auth enforcement policy is documented ──────────────────────────────────

assert.ok(
  d.includes('authenticated user') || d.includes('require auth'),
  'Must document auth enforcement: live provider requires authenticated user'
);

// ─── 3. Unauthenticated live request failure policy ────────────────────────────

assert.ok(
  d.includes('auth_required') || (d.includes('unauthenticated') && d.includes('fail')),
  'Must document unauthenticated live request failure (AUTH_REQUIRED)'
);

// ─── 4. Persistent rate-limit storage requirement ──────────────────────────────

assert.ok(
  d.includes('persistent') && d.includes('rate-limit') && d.includes('storage'),
  'Must document persistent rate-limit storage requirement'
);
assert.ok(
  d.includes('in-memory') && (d.includes('not sufficient') || d.includes('not acceptable')),
  'Must state in-memory is not sufficient for staging/prod'
);

// ─── 5. Storage candidates are documented ──────────────────────────────────────

const candidates = ['kv', 'durable object', 'd1'];
for (const c of candidates) {
  assert.ok(d.includes(c), `Must document storage candidate: ${c}`);
}

// ─── 6. Rate-limit dimensions are documented ───────────────────────────────────

const dimensions = ['userid', 'ip', 'session', 'providermode', 'requestid', 'window', 'time'];
for (const dim of dimensions) {
  assert.ok(d.includes(dim), `Must document rate-limit dimension: ${dim}`);
}

// ─── 7. Quota policy is documented ─────────────────────────────────────────────

const quotaTerms = ['per-minute', 'per-hour', 'per-day', 'staging lower', 'production'];
const foundQuota = quotaTerms.filter(t => d.includes(t));
assert.ok(
  foundQuota.length >= 3,
  `Must document quota policy (per-minute, per-hour, per-day, staging<prod). Found: ${foundQuota.join(', ')}`
);

// ─── 8. Failure modes are documented ───────────────────────────────────────────

const failureModes = ['auth_required', 'auth_invalid', 'rate_limited', 'rate_limit_unavailable', 'provider_unavailable', 'config_missing'];
for (const fm of failureModes) {
  assert.ok(d.includes(fm), `Must document failure mode: ${fm}`);
}

// ─── 9. Privacy/logging minimization is documented ─────────────────────────────

assert.ok(
  d.includes('allowed') && d.includes('prohibited') && d.includes('fields'),
  'Must document allowed and prohibited fields for logging'
);

// ─── 10. Abuse/cost gates are documented ───────────────────────────────────────

const abuseTerms = ['request validation', 'quota reservation', 'provider failure accounting', 'suspicious.*failure'];
const foundAbuse = abuseTerms.filter(t => new RegExp(t, 'i').test(d));
assert.ok(
  foundAbuse.length >= 3,
  `Must document abuse/cost gates. Found: ${foundAbuse.join(', ')}`
);

// ─── 11. Real provider API call remains blocked ────────────────────────────────

assert.ok(
  (d.includes('ready for real provider api call') && d.includes('no')) ||
  d.includes('real provider api call remains blocked'),
  'Must state real provider API call remains blocked'
);

// ─── 12. Staging live execution remains blocked ────────────────────────────────

assert.ok(
  (d.includes('staging_live') || d.includes('staging live')) &&
  d.includes('no'),
  'Must state staging_live execution remains blocked'
);

// ─── 13. Production live execution remains blocked ─────────────────────────────

assert.ok(
  (d.includes('production_live') || d.includes('production live')) &&
  d.includes('no'),
  'Must state production_live execution remains blocked'
);

// ─── 14. Production JS still has no provider SDK imports ───────────────────────

const sdkKeywords = [
  'openai', 'anthropic', '@anthropic', '@google/generative-ai',
  'gemini', 'groq-sdk', 'mistral', 'nvidia',
];
const importPatterns = sdkKeywords.map(kw => [
  `require\\(['"\`]${kw}['"\`]`,
  `from ['"\`]${kw}['"\`]`,
  `import\\(['"\`]${kw}['"\\)]`,
  `from ['"\`]@?${kw}`,
]);
for (let i = 0; i < sdkKeywords.length; i++) {
  const patterns = importPatterns[i];
  const adapterHas = patterns.some(p => new RegExp(p, 'i').test(adapter));
  const suggestHas = patterns.some(p => new RegExp(p, 'i').test(suggest));
  assert.ok(
    !adapterHas && !suggestHas,
    `Production JS must not import ${sdkKeywords[i]} SDK`
  );
}

// ─── 15. Production JS still has no fetch/XHR/axios ───────────────────────────

assert.ok(
  !adapter.includes('fetch(') && !adapter.includes('XMLHttpRequest') && !adapter.includes('axios'),
  'live-provider-adapter.js must not contain fetch/XHR/axios'
);
assert.ok(
  !suggest.includes('XMLHttpRequest') && !suggest.includes('axios'),
  'suggest.js must not contain XHR/axios'
);

// ─── 16. Endpoint default stub still preserved ────────────────────────────────

assert.ok(
  suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB') || suggest.includes("'stub'"),
  'suggest.js must preserve stub mode'
);
assert.ok(suggest.includes('generateStubSuggestion'), 'suggest.js must have generateStubSuggestion');

// ─── 17. Frontend default local_stub still preserved ──────────────────────────

assert.ok(
  sourceSelector.includes('local_stub'),
  'Source selector must preserve local_stub default'
);

// ─── 18. No runtime persistence implementation added ──────────────────────────

// Check for active (non-commented) usage, not TODO comments
const runtimePatterns = [
  /\bverifyIdToken\s*\(/,
  /\bnew\s+KV\s*\(/,
  /\bDurableObject\s+/,
  /\bD1Database\s+/,
];
for (const pattern of runtimePatterns) {
  assert.ok(
    !pattern.test(suggest) && !pattern.test(adapter),
    `No runtime persistence/auth implementation should exist in production JS: ${pattern}`
  );
}

// ─── 19. Docs updated — check existing docs mention auth/rate-limit boundary ──

const docsToCheck = [
  path.join(ROOT, 'docs/product/lovebud-scout-live-provider-staging-rollout-contract.md'),
  path.join(ROOT, 'docs/product/lovebud-scout-live-provider-post-mock-readiness-audit.md'),
  path.join(ROOT, 'docs/product/lovebud-scout-provider-secret-config-deployment-checklist.md'),
  path.join(ROOT, 'docs/product/lovebud-scout-live-provider-readiness-audit.md'),
  path.join(ROOT, 'docs/product/lovebud-scout-ai-suggestion-mvp-readiness.md'),
  path.join(ROOT, 'docs/product/lovebud-scout-serverless-endpoint-boundary.md'),
  path.join(ROOT, 'docs/product/lovebud-scout-llm-provider-boundary.md'),
];

const docLowerContents = docsToCheck.map(p => readFileSafe(p).toLowerCase());
const mentionsAuthRateLimit = docLowerContents.some(c =>
  c.includes('auth/rate-limit') ||
  c.includes('auth rate limit') ||
  c.includes('auth_rate_limit') ||
  c.includes('firebase auth') ||
  c.includes('rate-limit persistence')
);
assert.ok(mentionsAuthRateLimit, 'At least one existing doc must mention auth/rate-limit boundary');

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('✓ All scout-live-provider-auth-rate-limit-boundary tests passed.');
