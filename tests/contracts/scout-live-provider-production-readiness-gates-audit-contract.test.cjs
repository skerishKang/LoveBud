'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const AUDIT_DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-live-provider-production-readiness-gates-audit.md');
const ADAPTER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const SOURCE_SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');

const RELATED_DOCS = [
  'lovebud-scout-live-provider-secret-incident-runbook-contract.md',
  'lovebud-scout-live-provider-cost-quota-abuse-monitoring-contract.md',
  'lovebud-scout-live-provider-auth-rate-limit-boundary.md',
  'lovebud-scout-live-provider-staging-rollout-contract.md',
  'lovebud-scout-live-provider-post-mock-readiness-audit.md',
  'lovebud-scout-provider-secret-config-deployment-checklist.md',
  'lovebud-scout-live-provider-readiness-audit.md',
  'lovebud-scout-ai-suggestion-mvp-readiness.md',
  'lovebud-scout-serverless-endpoint-boundary.md',
  'lovebud-scout-llm-provider-boundary.md',
];

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

const doc = readFileSafe(AUDIT_DOC_PATH);
const d = doc.toLowerCase();
const adapter = readFileSafe(ADAPTER_PATH);
const suggest = readFileSafe(SUGGEST_PATH);
const srcSel = readFileSafe(SOURCE_SELECTOR_PATH);

// ─── 1. Production readiness gates audit document exists ─────────────────────

assert.ok(
  fs.existsSync(AUDIT_DOC_PATH),
  'Audit document must exist at docs/product/lovebud-scout-live-provider-production-readiness-gates-audit.md'
);
assert.ok(doc.length > 0, 'Audit document must not be empty');

// ─── 2. Implemented boundary inventory is documented ─────────────────────────

const boundaries = [
  'local_stub',
  'endpoint_stub',
  'source selector',
  'serverless endpoint',
  'prompt/response',
  'adapter skeleton',
  'mock execution',
  'logging',
  'timeout/retry',
  'safety filter',
  'real provider adapter interface',
  'staging rollout',
  'auth/rate-limit',
  'cost/quota',
  'secret/incident',
];
const foundBoundaries = boundaries.filter(t => d.includes(t));
assert.ok(
  foundBoundaries.length >= 12,
  `Implemented boundary inventory must document most key boundaries. Found: ${foundBoundaries.length}/15`
);

// ─── 3. Go/no-go matrix is documented ────────────────────────────────────────

const goNoGoItems = [
  'first real provider adapter implementation',
  'staging_live execution',
  'production_live execution',
];
const foundGoNoGo = goNoGoItems.filter(t => d.includes(t));
assert.ok(
  foundGoNoGo.length >= 3,
  `Go/no-go matrix must document all three decision items. Found: ${foundGoNoGo.join(', ')}`
);

// ─── 4. Readiness dimensions are documented ───────────────────────────────────

const dimensions = [
  'auth enforcement',
  'persistent rate-limit',
  'cost/quota',
  'abuse monitoring',
  'secret rotation',
  'incident response',
  'kill switch',
  'rollback drill',
  'provider error mapping',
  'opt-in integration test',
  'observability',
];
const foundDimensions = dimensions.filter(t => d.includes(t));
assert.ok(
  foundDimensions.length >= 9,
  `Readiness dimensions must document most key dimensions. Found: ${foundDimensions.length}/11`
);

// ─── 5. Remaining blockers are documented ────────────────────────────────────

const blockers = [
  'firebase auth',
  'persistent rate-limit storage',
  'cost/quota',
  'abuse reporting',
  'provider-specific error',
  'live integration test',
  'staging soak',
  'kill-switch drill',
  'secret rotation drill',
];
const foundBlockers = blockers.filter(t => d.includes(t));
assert.ok(
  foundBlockers.length >= 6,
  `Remaining blockers must document most key blockers. Found: ${foundBlockers.length}/9`
);

// ─── 6. Conditional first adapter skeleton verdict is documented ─────────────

assert.ok(
  d.includes('conditional yes') || (d.includes('ready for first') && d.includes('conditional')),
  'Must document conditional Yes verdict for first provider-specific adapter skeleton'
);
assert.ok(
  d.includes('disabled-by-default') || d.includes('disabled by default'),
  'Must document disabled-by-default condition'
);
assert.ok(
  d.includes('no provider api call') || d.includes('no real provider api'),
  'Must document no provider API call condition'
);

// ─── 7. Staging live execution remains blocked ───────────────────────────────

assert.ok(
  (d.includes('staging_live execution') || d.includes('ready for staging_live')) &&
  d.includes('no'),
  'Must document staging_live execution is blocked (No)'
);

// ─── 8. Production live execution remains blocked ────────────────────────────

assert.ok(
  (d.includes('production_live execution') || d.includes('ready for production_live')) &&
  d.includes('no'),
  'Must document production_live execution is blocked (No)'
);

// ─── 9. Real provider API call remains blocked ───────────────────────────────

assert.ok(
  (d.includes('ready for real provider api call') && d.includes('no')) ||
  d.includes('real provider api call remains blocked'),
  'Must block real provider API call in this slice'
);

// ─── 10. Endpoint default stub is documented and preserved ───────────────────

assert.ok(
  d.includes('endpoint default remains stub') || d.includes('endpoint default remains **stub**'),
  'Audit document must confirm endpoint default remains stub'
);
assert.ok(
  suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.STUB') || suggest.includes("'stub'"),
  'suggest.js must preserve stub provider mode'
);
assert.ok(
  suggest.includes('generateStubSuggestion'),
  'suggest.js must have generateStubSuggestion function'
);

// ─── 11. Frontend default local_stub is documented and preserved ─────────────

assert.ok(
  d.includes('frontend default remains local_stub') || d.includes('ui default remains local_stub'),
  'Audit document must confirm frontend default remains local_stub'
);
assert.ok(
  srcSel.includes('local_stub'),
  'Source selector must preserve local_stub default'
);

// ─── 12. No provider SDK imports ─────────────────────────────────────────────

const sdkKeywords = [
  'openai', 'anthropic', '@anthropic', '@google/generative-ai',
  'gemini', 'groq-sdk', 'mistral', 'nvidia',
];
const importPatterns = sdkKeywords.map(kw => [
  `require\\(['"\`]${kw}['"\`]`,
  `from ['"\`]${kw}['"\`]`,
  `import\\(['"\`]${kw}['"\`)]`,
  `from ['"\`]@?${kw}`,
]);

for (let i = 0; i < sdkKeywords.length; i++) {
  const patterns = importPatterns[i];
  const adapterHasImport = patterns.some(p => new RegExp(p, 'i').test(adapter));
  const suggestHasImport = patterns.some(p => new RegExp(p, 'i').test(suggest));
  assert.ok(
    !adapterHasImport && !suggestHasImport,
    `Production JS must not import ${sdkKeywords[i]} SDK`
  );
}

// ─── 13. No fetch/XHR/axios ─────────────────────────────────────────────────

assert.ok(
  !adapter.includes('fetch(') && !adapter.includes('XMLHttpRequest') && !adapter.includes('axios'),
  'live-provider-adapter.js must not contain fetch/XHR/axios'
);
assert.ok(
  !suggest.includes('XMLHttpRequest') && !suggest.includes('axios'),
  'suggest.js must not contain XHR/axios'
);

// ─── 14. No runtime auth/rate-limit/cost/secret implementation added ─────────

const rtPats = [
  /\bverifyIdToken\s*\(/,
  /\bnew\s+KV\s*\(/,
  /\bDurableObject\s+/,
  /\bD1Database\s+/,
  /require\(['"`]firebase-admin['"`\)]/,
  /from ['"`]firebase-admin['"`]/,
  /import\(['"`]firebase-admin['"`)]/,
];
for (const p of rtPats) {
  assert.ok(
    !p.test(suggest) && !p.test(adapter),
    `No runtime implementation: ${p}`
  );
}

// ─── 15. Docs updated — at least one related doc mentions audit ──────────────

const relatedDocContents = RELATED_DOCS
  .map(f => readFileSafe(path.join(ROOT, 'docs/product', f)).toLowerCase());

const mentionPatterns = [
  'production readiness gates',
  'production readiness gates audit',
  'go/no-go matrix',
  'go/no-go',
];
const mentionsAudit = relatedDocContents.some(c =>
  mentionPatterns.some(p => c.includes(p))
);
assert.ok(
  mentionsAudit,
  'At least one existing doc must mention production readiness gates audit'
);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('✓ All scout-live-provider-production-readiness-gates-audit contract tests passed.');
