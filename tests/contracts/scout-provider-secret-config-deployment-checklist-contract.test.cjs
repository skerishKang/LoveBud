'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

const CHECKLIST_PATH = path.join(PROJECT_ROOT, 'docs/product/lovebud-scout-provider-secret-config-deployment-checklist.md');
const READINESS_AUDIT_PATH = path.join(PROJECT_ROOT, 'docs/product/lovebud-scout-live-provider-readiness-audit.md');
const PROMPT_RESPONSE_DOC_PATH = path.join(PROJECT_ROOT, 'docs/product/lovebud-scout-live-provider-prompt-response-contract.md');
const SERVERLESS_DOC_PATH = path.join(PROJECT_ROOT, 'docs/product/lovebud-scout-serverless-endpoint-boundary.md');
const LLM_BOUNDARY_DOC_PATH = path.join(PROJECT_ROOT, 'docs/product/lovebud-scout-llm-provider-boundary.md');
const MVP_READINESS_DOC_PATH = path.join(PROJECT_ROOT, 'docs/product/lovebud-scout-ai-suggestion-mvp-readiness.md');

const ADAPTER_PATH = path.join(PROJECT_ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(PROJECT_ROOT, 'functions/api/scout/suggest.js');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

describe('Scout Provider Secret Config Deployment Checklist Contract', () => {
  // --- 1. checklist document exists ---
  it('should have the checklist document', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    assert.ok(doc.length > 0, 'checklist doc should exist and be non-empty');
    assert.ok(doc.includes('# LoveBud Scout Provider Secret Config Deployment Checklist'),
      'doc should have the expected title');
  });

  // --- 2. baseline included ---
  it('should include baseline information', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    assert.ok(doc.includes('#1882'), 'doc should reference #1882');
    assert.ok(doc.includes('#1661'), 'doc should reference #1661');
    assert.ok(doc.includes('endpoint default remains stub'), 'doc should mention endpoint default stub');
    assert.ok(doc.includes('frontend default remains'), 'doc should mention frontend default');
    assert.ok(doc.includes('no real provider'), 'doc should mention no real provider');
  });

  // --- 3. secret management rules ---
  it('should include secret management rules', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    const rules = [
      'no secrets committed',
      'no `.env`',
      'no API key in frontend',
      'no API key in docs',
      'no API key in tests',
      'no secret values in logs',
      'no secret values in error messages',
    ];
    const docLower = doc.toLowerCase();
    for (const rule of rules) {
      assert.ok(docLower.includes(rule.toLowerCase()),
        `doc should mention "${rule}"`);
    }
  });

  // --- 4. allowed future config names ---
  it('should include allowed future config names', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    const expectedNames = [
      'SCOUT_SUGGEST_PROVIDER_MODE',
      'SCOUT_SUGGEST_LLM_PROVIDER',
      'SCOUT_SUGGEST_MODEL',
      'SCOUT_SUGGEST_LLM_API_KEY',
    ];
    for (const name of expectedNames) {
      assert.ok(doc.includes(name),
        `doc should mention config name "${name}"`);
    }
  });

  // --- 5. no fake secret values ---
  it('should not contain fake secret values', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    // The doc should list config names but NOT contain fake/placeholder values
    // Allow config name SCOUT_SUGGEST_LLM_API_KEY (it's a name, not a value)
    // But reject patterns like "sk-" or fake bearer tokens
    const fakeValuePatterns = [
      'sk-',
      'Bearer ',
      'fake-api-key',
      'your-api-key',
      'YOUR_API_KEY',
      '<api_key>',
    ];
    for (const pattern of fakeValuePatterns) {
      // We specifically exclude lines that are listing config names
      const lines = doc.split('\n').filter(l => l.includes(pattern));
      for (const line of lines) {
        // If the line only contains config names, it's fine
        if (line.includes('SCOUT_SUGGEST')) continue;
        assert.fail(`Should not contain fake secret value pattern "${pattern}" in: ${line}`);
      }
    }
    // If we get here, no violations found
    assert.ok(true, 'no fake secret values found');
  });

  // --- 6. deployment storage policy ---
  it('should include deployment storage policy', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    const policies = [
      'Cloudflare',
      'secret storage',
      'staging/prod',
      'rotation',
      'least privilege',
      'manual',
    ];
    const docLower = doc.toLowerCase();
    for (const policy of policies) {
      assert.ok(docLower.includes(policy.toLowerCase()),
        `doc should mention "${policy}"`);
    }
  });

  // --- 7. staging rollout checklist ---
  it('should include staging rollout checklist', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    const items = [
      'main is green',
      'open PR count is 0',
      'default stub',
      'local_stub',
      'platform secret storage',
      'explicit staging flag',
      'CONFIG_MISSING',
      'PROVIDER_ERROR',
      'output safety filter',
      'no auto-save',
    ];
    const docLower = doc.toLowerCase();
    for (const item of items) {
      assert.ok(docLower.includes(item.toLowerCase()),
        `doc should mention "${item}" in staging checklist`);
    }
  });

  // --- 8. production rollout checklist ---
  it('should include production rollout checklist', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    const items = [
      'staging checklist passed',
      'cost/quota',
      'abuse monitoring',
      'auth',
      'rate-limit',
      'rollback owner',
      'product owner',
      'emergency disable',
    ];
    const docLower = doc.toLowerCase();
    for (const item of items) {
      assert.ok(docLower.includes(item.toLowerCase()),
        `doc should mention "${item}" in production checklist`);
    }
  });

  // --- 9. rollback / kill switch ---
  it('should include rollback and kill switch', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    const items = [
      'set provider mode back to stub',
      'disable',
      'rotate',
      'verify endpoint returns',
      'verify frontend remains',
      'verify no auto-save',
      'review logs',
    ];
    const docLower = doc.toLowerCase();
    for (const item of items) {
      assert.ok(docLower.includes(item.toLowerCase()),
        `doc should mention "${item}" in rollback section`);
    }
  });

  // --- 10. CI/test policy ---
  it('should include CI and test policy', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    const items = [
      'network-free',
      'no real provider calls',
      'mock executor',
      'contract tests',
      'must not require secrets',
      'must pass without env vars',
      'opt-in',
      'skipped by default',
    ];
    const docLower = doc.toLowerCase();
    for (const item of items) {
      assert.ok(docLower.includes(item.toLowerCase()),
        `doc should mention "${item}" in CI/test policy`);
    }
  });

  // --- 11. logging policy ---
  it('should include logging and observability policy', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    // Allowed fields
    const allowedFields = ['requestId', 'providerMode', 'status', 'errorCode', 'latencyMs'];
    for (const field of allowedFields) {
      assert.ok(doc.includes(field),
        `doc should mention allowed log field "${field}"`);
    }
    // Prohibited fields
    const prohibited = ['prompt', 'excerpt', 'sourceUrl', 'PII'];
    const docLower = doc.toLowerCase();
    for (const field of prohibited) {
      assert.ok(docLower.includes(field.toLowerCase()),
        `doc should mention prohibited log field "${field}"`);
    }
  });

  // --- 12. user-facing safety policy ---
  it('should include user-facing safety policy', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    const items = [
      'suggestion only',
      'review before saving',
      'manual save',
      'no auto-save',
      'safe and non-technical',
      'no secret',
      'URL was fetched',
    ];
    const docLower = doc.toLowerCase();
    for (const item of items) {
      assert.ok(docLower.includes(item.toLowerCase()),
        `doc should mention "${item}" in user-facing safety policy`);
    }
  });

  // --- 13. pre-integration gates ---
  it('should include required pre-integration gates', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    const gates = [
      'prompt/response contract',
      'output safety filter',
      'logging boundary',
      'timeout/retry boundary',
      'endpoint default remains stub',
      'frontend default remains',
      'CI remains network-free',
      'rollback plan',
    ];
    const docLower = doc.toLowerCase();
    for (const gate of gates) {
      assert.ok(docLower.includes(gate.toLowerCase()),
        `doc should mention gate "${gate}"`);
    }
  });

  // --- 14. non-goals ---
  it('should include non-goals', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    const nonGoals = [
      'no real provider',
      'no API keys',
      'no provider SDK imports',
      'no live API call',
      'no external fetch',
      'no crawler',
      'no metadata extraction',
      'no auto-save',
      'no schema migration',
      '#1661',
    ];
    const docLower = doc.toLowerCase();
    for (const goal of nonGoals) {
      assert.ok(docLower.includes(goal.toLowerCase()),
        `doc should mention non-goal "${goal}"`);
    }
  });

  // --- 15. recommended next slice ---
  it('should have a recommended next slice', () => {
    const doc = readFileSafe(CHECKLIST_PATH);
    assert.ok(doc.includes('Recommended Next Slice'),
      'doc should have a Recommended Next Slice section');
    assert.ok(doc.includes('real provider adapter') ||
      doc.includes('Real provider adapter') ||
      doc.includes('Firebase auth'),
      'doc should name a recommended next slice or alternative');
  });

  // --- 16. no production behavior change ---
  it('should not change production behavior', () => {
    const adapter = readFileSafe(ADAPTER_PATH);
    const suggest = readFileSafe(SUGGEST_PATH);
    // key behavior invariants preserved
    assert.ok(suggest.includes('STUB') || suggest.includes('stub'),
      'suggest.js should keep stub provider mode');
    // Check for actual SDK import patterns, not just any string mention.
    // A gate check like `provider === 'openai-compatible'` is legitimate.
    const sdkImportRe = /(import|require).*['"`]openai|import.*['"`]anthropic|import.*['"`]gemini/;
    assert.ok(!sdkImportRe.test(suggest),
      'suggest.js should not contain real provider SDK imports');
  });

  // --- 17. no provider SDK import ---
  it('should not have provider SDK imports in production JS', () => {
    const adapter = readFileSafe(ADAPTER_PATH);
    const suggest = readFileSafe(SUGGEST_PATH);
    const prohibitedSdks = ['openai', 'anthropic', 'gemini', 'groq', 'mistral'];
    const allCode = adapter + ' ' + suggest;
    for (const sdk of prohibitedSdks) {
      const importPattern = new RegExp(`(import|require).*['"\`]${sdk}`);
      assert.ok(!importPattern.test(allCode),
        `should not import/require "${sdk}" SDK in production code (filename mentions fine)`);
    }
  });

  // --- 18. endpoint/default UI guardrails ---
  it('should preserve endpoint and UI guardrails', () => {
    const suggest = readFileSafe(SUGGEST_PATH);
    assert.ok(suggest.includes('STUB') || suggest.includes('stub'),
      'suggest.js should reference stub mode');
  });

  // --- 19. docs updated ---
  it('should have checklist status reflected in existing docs', () => {
    const readinessAudit = readFileSafe(READINESS_AUDIT_PATH);
    const promptDoc = readFileSafe(PROMPT_RESPONSE_DOC_PATH);
    const serverlessDoc = readFileSafe(SERVERLESS_DOC_PATH);
    const llmDoc = readFileSafe(LLM_BOUNDARY_DOC_PATH);
    const readinessDoc = readFileSafe(MVP_READINESS_DOC_PATH);

    const allDocs = readinessAudit + ' ' + promptDoc + ' ' + serverlessDoc + ' ' + llmDoc + ' ' + readinessDoc;
    const auditLower = allDocs.toLowerCase();
    // At least one doc should reference the secret/config checklist
    assert.ok(
      auditLower.includes('secret/config') ||
      auditLower.includes('secret config') ||
      auditLower.includes('deployment checklist'),
      'at least one existing doc should reference the secret/config checklist'
    );
    // At least one doc should state that no API key was added
    assert.ok(
      auditLower.includes('no api key') ||
      auditLower.includes('no API key'),
      'at least one doc should state no API key added'
    );
  });
});
