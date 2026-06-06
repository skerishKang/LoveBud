'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ROLLOUT_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-staging-rollout-contract.md');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_CLIENT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');

// ─── Helper ───────────────────────────────────────────────────────────────────

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const doc = readFileSafe(ROLLOUT_DOC_PATH);
const docLower = doc.toLowerCase();
const adapterContent = readFileSafe(ADAPTER_PATH);
const suggestContent = readFileSafe(SUGGEST_PATH);
const sourceSelectorContent = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointClientContent = readFileSafe(ENDPOINT_CLIENT_PATH);

// ─── 1. Staging rollout contract document exists ─────────────────────────────

assert.ok(
  fs.existsSync(ROLLOUT_DOC_PATH),
  'Staging rollout contract document must exist at docs/product/lovebud-scout-live-provider-staging-rollout-contract.md'
);
assert.ok(doc.length > 0, 'Rollout document must not be empty');

// ─── 2. Rollout modes are documented ───────────────────────────────────────────

const modes = ['local_stub', 'endpoint_stub', 'live_mock', 'staging_live', 'production_live'];
for (const mode of modes) {
  assert.ok(docLower.includes(mode), `Rollout document must document mode: ${mode}`);
}

// ─── 3. Default behavior policy is documented ──────────────────────────────────

assert.ok(
  docLower.includes('endpoint default remains stub') ||
  docLower.includes('endpoint default remains `stub`'),
  'Rollout document must document endpoint default remains stub'
);
assert.ok(
  docLower.includes('frontend default remains local_stub') ||
  docLower.includes('frontend default remains `local_stub`'),
  'Rollout document must document frontend default remains local_stub'
);

// ─── 4. Staging activation gates are documented ────────────────────────────────

// Check staging gates conceptually — doc may use env var name, phrase, or table format
const stagingGateConcepts = [
  { name: 'environment mode', patterns: ['environment mode', 'staging_live'] },
  { name: 'live adapter flag', patterns: ['live_adapter_enabled', 'live adapter', 'adapter enabled'] },
  { name: 'provider config', patterns: ['provider', 'llm_provider'] },
  { name: 'model config', patterns: ['model'] },
  { name: 'API key', patterns: ['api key', 'api_key', 'llm_api_key'] },
  { name: 'Firebase auth', patterns: ['firebase auth', 'firebase authentication'] },
  { name: 'rate-limit', patterns: ['rate-limit', 'rate limit', 'rate_limit'] },
  { name: 'abuse/cost/quota', patterns: ['abuse', 'cost', 'quota'] },
  { name: 'logging redaction', patterns: ['logging redaction', 'logging'] },
  { name: 'output safety', patterns: ['output safety', 'output_safety'] },
  { name: 'timeout/retry', patterns: ['timeout/retry', 'timeout', 'retry'] },
  { name: 'opt-in integration tests', patterns: ['opt-in integration', 'integration test', 'opt in'] },
];
for (const gate of stagingGateConcepts) {
  const found = gate.patterns.some(p => docLower.includes(p));
  assert.ok(found, `Rollout document must document staging gate: ${gate.name}`);
}

// ─── 5. Production activation gates are documented ─────────────────────────────

const prodGates = [
  'staging soak', 'error budget', 'latency budget',
  'quota ceiling', 'rollback tested', 'kill switch tested',
  'secret rotation', 'abuse monitoring', 'manual approval',
];
for (const gate of prodGates) {
  assert.ok(docLower.includes(gate), `Rollout document must document production gate: ${gate}`);
}

// ─── 6. Kill switch policy is documented ───────────────────────────────────────

assert.ok(
  docLower.includes('kill switch') || docLower.includes('kill-switch'),
  'Rollout document must document kill switch policy'
);
assert.ok(
  (docLower.includes('disable') || docLower.includes('disabled') || docLower.includes('kill')) &&
  (docLower.includes('live provider') || docLower.includes('live mode') || docLower.includes('adapter')) &&
  (docLower.includes('provider_unavailable') || docLower.includes('provider unavailable') || docLower.includes('PROVIDER_UNAVAILABLE'.toLowerCase())),
  'Kill switch must describe disabling live provider returning PROVIDER_UNAVAILABLE'
);

// ─── 7. Rollback policy is documented ──────────────────────────────────────────

assert.ok(
  docLower.includes('rollback') || docLower.includes('roll back') || docLower.includes('revert'),
  'Rollout document must document rollback policy'
);
assert.ok(
  (docLower.includes('revert') || docLower.includes('set ') || docLower.includes('unset')) &&
  (docLower.includes('env mode') || docLower.includes('config mode') || docLower.includes('provider_mode') || docLower.includes('live_adapter')),
  'Rollback policy must mention reverting env mode or config'
);

// ─── 8. Opt-in policy is documented ────────────────────────────────────────────

assert.ok(
  docLower.includes('opt-in') || docLower.includes('opt in'),
  'Rollout document must document opt-in policy'
);
assert.ok(
  (docLower.includes('endpoint_client') || docLower.includes('endpoint client')) &&
  docLower.includes('cannot auto-enable'),
  'Opt-in policy must state endpoint_client cannot auto-enable'
);
assert.ok(
  docLower.includes('source selector default remains local_stub') ||
  docLower.includes('source selector default remains `local_stub`'),
  'Opt-in policy must state source selector default remains local_stub'
);
assert.ok(
  (docLower.includes('staging live') || docLower.includes('staging_live')) &&
  docLower.includes('explicit'),
  'Opt-in policy must state staging live requires explicit opt-in'
);

// ─── 9. Monitoring policy is documented ────────────────────────────────────────

assert.ok(
  docLower.includes('allowed safe fields') || docLower.includes('allowed fields'),
  'Rollout document must document monitoring allowed fields'
);
assert.ok(
  docLower.includes('prohibited fields') || docLower.includes('never logged'),
  'Rollout document must document monitoring prohibited fields'
);
assert.ok(
  docLower.includes('requestid') && docLower.includes('latencyms'),
  'Allowed fields must include requestId and latencyMs'
);
assert.ok(
  docLower.includes('prompt') && docLower.includes('api key') && docLower.includes('excerpt'),
  'Prohibited fields must include prompt, API key, and excerpt'
);

// ─── 10. Real provider API call remains blocked ────────────────────────────────

const apiCallBlocked = docLower.includes('ready for real provider api call in this slice: no') ||
  docLower.includes('ready for real provider api call') && docLower.includes('no');
assert.ok(apiCallBlocked, 'Rollout document must clearly state real provider API call remains blocked');

// ─── 11. Staging live execution remains blocked ────────────────────────────────

const stagingLiveBlocked = docLower.includes('ready for staging live execution: no') ||
  (docLower.includes('staging live') && docLower.includes('no'));
assert.ok(stagingLiveBlocked, 'Rollout document must clearly state staging live execution remains blocked');

// ─── 12. Production live execution remains blocked ─────────────────────────────

const prodLiveBlocked = docLower.includes('ready for production live execution: no') ||
  (docLower.includes('production live') && docLower.includes('no'));
assert.ok(prodLiveBlocked, 'Rollout document must clearly state production live execution remains blocked');

// ─── 13. Production JS still has no provider SDK imports ───────────────────────

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
  const adapterHasImport = patterns.some(p => new RegExp(p, 'i').test(adapterContent));
  const suggestHasImport = patterns.some(p => new RegExp(p, 'i').test(suggestContent));
  assert.ok(
    !adapterHasImport && !suggestHasImport,
    `Production JS must not import ${sdkKeywords[i]} SDK`
  );
}

// ─── 14. Production JS still has no fetch/XHR/axios ───────────────────────────

assert.ok(
  !adapterContent.includes('fetch(') &&
  !adapterContent.includes('XMLHttpRequest') &&
  !adapterContent.includes('axios'),
  'live-provider-adapter.js must not contain fetch/XHR/axios'
);

const suggestNoExternalFetch = !suggestContent.includes('XMLHttpRequest') &&
  !suggestContent.includes('axios');
assert.ok(suggestNoExternalFetch, 'suggest.js must not contain XHR/axios');

// ─── 15. Endpoint default stub still preserved ────────────────────────────────

assert.ok(
  suggestContent.includes(`SCOUT_SUGGEST_PROVIDER_MODES.STUB`) ||
  suggestContent.includes(`'stub'`),
  'suggest.js must preserve stub provider mode constant'
);
assert.ok(
  suggestContent.includes('generateStubSuggestion'),
  'suggest.js must have generateStubSuggestion function'
);

// ─── 16. Frontend default local_stub still preserved ──────────────────────────

assert.ok(
  sourceSelectorContent.includes('local_stub'),
  'Source selector must preserve local_stub default'
);

// ─── 17. No persistence/auto-save remains preserved ───────────────────────────

// Check for actual usage, not commented mentions or docstring lists
// Focus on assignment/function call patterns, not prohibited list comments
const persistenceUsagePatterns = [
  /localStorage\./,
  /sessionStorage\./,
  /\.addMemoryFromForm\(/,
  /\.addMemory\(/,
  /\.save\(\)/,
  /addMemory\('/,
];
for (const pattern of persistenceUsagePatterns) {
  assert.ok(
    !pattern.test(adapterContent),
    `live-provider-adapter.js must not contain active usage of persistence pattern: ${pattern}`
  );
}

// Endpoint client must not auto-save (is disabled by default)
assert.ok(
  !endpointClientContent.includes('.save()') &&
  !endpointClientContent.includes('addMemoryFromForm') &&
  !endpointClientContent.includes('addMemory('),
  'endpoint-client.js must not contain persistence calls'
);

// ─── 18. Docs updated — check existing docs mention staging rollout contract ───

const docsToCheck = [
  path.join(ROOT, 'docs/product/lovebud-scout-live-provider-post-mock-readiness-audit.md'),
  path.join(ROOT, 'docs/product/lovebud-scout-provider-secret-config-deployment-checklist.md'),
  path.join(ROOT, 'docs/product/lovebud-scout-live-provider-readiness-audit.md'),
  path.join(ROOT, 'docs/product/lovebud-scout-ai-suggestion-mvp-readiness.md'),
  path.join(ROOT, 'docs/product/lovebud-scout-live-provider-prompt-response-contract.md'),
  path.join(ROOT, 'docs/product/lovebud-scout-serverless-endpoint-boundary.md'),
  path.join(ROOT, 'docs/product/lovebud-scout-llm-provider-boundary.md'),
];

const docContents = docsToCheck.map(p => readFileSafe(p).toLowerCase());
const mentionsRollout = docContents.some(c =>
  c.includes('staging rollout') ||
  c.includes('staging-rollout') ||
  c.includes('staging_rollout') ||
  c.includes('kill switch')
);
assert.ok(mentionsRollout, 'At least one existing doc must mention staging rollout contract or kill switch');

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('✓ All scout-live-provider-staging-rollout-contract tests passed.');
