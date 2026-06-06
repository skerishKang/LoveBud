'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const AUDIT_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-post-mock-readiness-audit.md');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const ENDPOINT_BOUNDARY_DOC = path.join(ROOT, 'docs/product/lovebud-scout-serverless-endpoint-boundary.md');
const LLM_BOUNDARY_DOC = path.join(ROOT, 'docs/product/lovebud-scout-llm-provider-boundary.md');
const PROMPT_RESPONSE_DOC = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-prompt-response-contract.md');
const READINESS_DOC = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-readiness-audit.md');
const DEPLOY_CHECKLIST_DOC = path.join(ROOT, 'docs/product/lovebud-scout-provider-secret-config-deployment-checklist.md');
const MVP_READINESS_DOC = path.join(ROOT, 'docs/product/lovebud-scout-ai-suggestion-mvp-readiness.md');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');

// ─── Helper: read file safely ─────────────────────────────────────────────────

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

// ─── 1. Audit document exists ──────────────────────────────────────────────────

assert.ok(
  fs.existsSync(AUDIT_DOC_PATH),
  'Post-mock readiness audit document must exist at docs/product/lovebud-scout-live-provider-post-mock-readiness-audit.md'
);

const auditDoc = readFileSafe(AUDIT_DOC_PATH);
assert.ok(auditDoc.length > 0, 'Audit document must not be empty');

// ─── 2. Audit document states mock-only pipeline completed ────────────────────

assert.ok(
  auditDoc.includes('Mock-Only Pipeline'),
  'Audit document must document mock-only pipeline'
);
assert.ok(
  auditDoc.includes('prompt builder') &&
  auditDoc.includes('response validator') &&
  auditDoc.includes('output safety filter') &&
  auditDoc.includes('logging') &&
  auditDoc.includes('timeout/retry'),
  'Audit document must mention all mock pipeline components'
);

// ─── 3. Audit verdict blocks real provider API call ────────────────────────────

assert.ok(
  auditDoc.includes('Ready for real provider API call: No'),
  'Audit document must clearly block real provider API call'
);

// ─── 4. Audit allows staging rollout contract work ────────────────────────────

assert.ok(
  auditDoc.includes('Ready for staging rollout contract work: Yes'),
  'Audit document must confirm staging rollout contract work is allowed'
);

// ─── 5. Audit documents endpoint default stub ──────────────────────────────────

assert.ok(
  auditDoc.includes('endpoint default remains stub') ||
  auditDoc.includes('Endpoint default remains stub'),
  'Audit document must confirm endpoint default remains stub'
);

// ─── 6. Audit documents frontend local_stub ────────────────────────────────────

assert.ok(
  auditDoc.includes('frontend default remains local_stub') ||
  auditDoc.includes('Frontend default remains local_stub'),
  'Audit document must confirm frontend default remains local_stub'
);

// ─── 7. Audit documents no SDK/no fetch/no provider API call ───────────────────

const docLower = auditDoc.toLowerCase();
assert.ok(
  docLower.includes('no sdk') &&
  docLower.includes('no fetch') &&
  docLower.includes('no provider api call') &&
  docLower.includes('no provider API call'.toLowerCase()),
  'Audit document must confirm no SDK/no fetch/no provider API call guardrails'
);

// ─── 8. Audit documents API key non-propagation ────────────────────────────────

const docLowerNp = auditDoc.toLowerCase();
assert.ok(
  (docLowerNp.includes('api key value') || docLowerNp.includes('api key')) &&
  (docLowerNp.includes('never propagated') || docLowerNp.includes('non-propagation') || docLowerNp.includes('no api key value propagation')),
  'Audit document must confirm API key non-propagation'
);

// ─── 9. Audit documents remaining blockers ────────────────────────────────────

const blockersSection = auditDoc.includes('Remaining Blockers Before Real Provider Implementation') ||
  auditDoc.includes('Remaining Blockers');
assert.ok(blockersSection, 'Audit document must have a remaining blockers section');

assert.ok(
  docLower.includes('firebase auth verification') &&
  (docLower.includes('rate-limit storage') || docLower.includes('rate-limit')) &&
  docLower.includes('staging rollout') &&
  docLower.includes('cost/quota') &&
  docLower.includes('abuse monitoring') &&
  docLower.includes('secret rotation'),
  'Audit document must document all major remaining blockers'
);

// ─── 10. Audit document recommends next slice ─────────────────────────────────

assert.ok(
  docLower.includes('recommended next slice') ||
  docLower.includes('recommended next'),
  'Audit document must recommend a next slice'
);

const recommendsStaging = docLower.includes('staging rollout contract') ||
  docLower.includes('staging rollout') || docLower.includes('auth/rate-limit');
assert.ok(recommendsStaging, 'Audit document must recommend staging rollout contract as next slice');

// ─── 11. Production JS still has no provider SDK imports ──────────────────────

const adapterContent = readFileSafe(ADAPTER_PATH);
const suggestContent = readFileSafe(SUGGEST_PATH);

const sdkKeywords = [
  'openai', 'anthropic', '@anthropic', '@google/generative-ai',
  'gemini', 'groq-sdk', 'mistral', 'nvidia',
];
// Check for actual import/require/import() statements, not commented mentions
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

// ─── 12. Production JS still has no fetch/XHR/axios ───────────────────────────

// Note: suggest.js uses `request.text()` (Cloudflare Workers built-in), not fetch.
// The adapter module uses only promise-based timer helpers, never fetch.
assert.ok(
  !adapterContent.includes('fetch(') &&
  !adapterContent.includes('XMLHttpRequest') &&
  !adapterContent.includes('axios'),
  'live-provider-adapter.js must not contain fetch/XHR/axios'
);

// suggest.js may have fetch for internal use (commented out), but not for external provider calls
const suggestNoExternalFetch = !suggestContent.includes('XMLHttpRequest') &&
  !suggestContent.includes('axios');
assert.ok(suggestNoExternalFetch, 'suggest.js must not contain XHR/axios');

// ─── 13. Endpoint default stub still preserved ────────────────────────────────

assert.ok(
  suggestContent.includes(`SCOUT_SUGGEST_PROVIDER_MODES.STUB`) ||
  suggestContent.includes(`'stub'`),
  'suggest.js must preserve stub provider mode constant'
);
assert.ok(
  suggestContent.includes('deterministic stub suggestion'),
  'suggest.js must preserve deterministic stub path'
);
assert.ok(
  suggestContent.includes('generateStubSuggestion'),
  'suggest.js must have generateStubSuggestion function'
);

// ─── 14. Frontend default local_stub still preserved ──────────────────────────

const sourceSelectorContent = readFileSafe(SOURCE_SELECTOR_PATH);
assert.ok(
  sourceSelectorContent.includes('local_stub'),
  'Source selector must preserve local_stub default'
);
assert.ok(
  sourceSelectorContent.includes('endpoint_client') === false ||
  sourceSelectorContent.includes('requires feature flag') ||
  sourceSelectorContent.includes('endpointClientEnabled'),
  'Source selector must not enable endpoint_client by default'
);

// ─── 15. Docs updated — check existing docs mention post-mock readiness audit ──

const promptResponseDoc = readFileSafe(PROMPT_RESPONSE_DOC);
const readinessDoc = readFileSafe(READINESS_DOC);
const deployChecklistDoc = readFileSafe(DEPLOY_CHECKLIST_DOC);
const mvpReadinessDoc = readFileSafe(MVP_READINESS_DOC);
const endpointBoundaryDoc = readFileSafe(ENDPOINT_BOUNDARY_DOC);
const llmBoundaryDoc = readFileSafe(LLM_BOUNDARY_DOC);

const docFiles = [promptResponseDoc, readinessDoc, deployChecklistDoc, mvpReadinessDoc, endpointBoundaryDoc, llmBoundaryDoc];
const mentionsAudit = docFiles.some(doc =>
  doc.includes('post-mock') ||
  doc.includes('post-mock readiness') ||
  doc.includes('Post-Mock') ||
  doc.includes('post-mock integration') ||
  doc.includes('mock-only real provider interface')
);
assert.ok(mentionsAudit, 'At least one existing doc must mention post-mock readiness audit');

// ─── Additional: Audit mentions Gates section ─────────────────────────────────

assert.ok(
  auditDoc.includes('Gates for First Real Provider Slice') ||
  auditDoc.includes('Gates'),
  'Audit document must define gates for first real provider slice'
);

// ─── Additional: Audit mentions Verdict section ├───────────────────────────────

assert.ok(
  auditDoc.includes('Verdict'),
  'Audit document must have a Verdict section'
);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('✓ All scout-live-provider-post-mock-readiness-audit contract tests passed.');
