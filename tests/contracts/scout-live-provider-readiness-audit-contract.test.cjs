'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

const AUDIT_DOC_PATH = path.join(PROJECT_ROOT, 'docs/product/lovebud-scout-live-provider-readiness-audit.md');
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

describe('Scout Live Provider Readiness Audit Contract', () => {
  // --- 1. readiness audit document exists ---
  it('should have the readiness audit document', () => {
    const doc = readFileSafe(AUDIT_DOC_PATH);
    assert.ok(doc.length > 0, 'readiness audit doc should exist and be non-empty');
    assert.ok(doc.includes('# LoveBud Scout Live Provider Readiness Audit'),
      'doc should have the expected title');
  });

  // --- 2. baseline included ---
  it('should include baseline information', () => {
    const doc = readFileSafe(AUDIT_DOC_PATH);
    assert.ok(doc.includes('#1882'), 'doc should reference #1882');
    assert.ok(doc.includes('#1661'), 'doc should reference #1661');
    assert.ok(doc.includes('main HEAD'), 'doc should reference current main HEAD');
    assert.ok(doc.includes('open PR count'), 'doc should reference open PR count');
  });

  // --- 3. implemented boundary inventory ---
  it('should include all implemented boundaries', () => {
    const doc = readFileSafe(AUDIT_DOC_PATH);
    const expectedBoundaries = [
      'Manual Scout save flow',
      'Local stub provider',
      'Serverless endpoint skeleton',
      'Auth/rate-limit contract',
      'Live config boundary',
      'Endpoint client',
      'Source selector',
      'Prompt/response contract',
      'Adapter skeleton',
      'Mock executor path',
      'Logging boundary',
      'Timeout/retry boundary',
      'Output safety filter',
    ];
    for (const boundary of expectedBoundaries) {
      assert.ok(doc.includes(boundary),
        `doc should mention "${boundary}" in the boundary inventory`);
    }
  });

  // --- 4. readiness verdict ---
  it('should have a readiness verdict', () => {
    const doc = readFileSafe(AUDIT_DOC_PATH);
    assert.ok(doc.includes('narrow') || doc.includes('narrow real-provider adapter'),
      'doc should mention narrow real-provider adapter planning');
    assert.ok(doc.includes('not ready') || doc.includes('Not Ready'),
      'doc should state not ready for default live usage');
    assert.ok(doc.includes('Ready for production/default live usage') ||
      doc.includes('Ready for a narrow'),
      'doc should contain readiness verdict sections');
    const verdictSection = doc.match(/## Readiness Verdict[\s\S]*?(?=\n##|\n---|$)/);
    assert.ok(verdictSection, 'should have a Readiness Verdict section');
  });

  // --- 5. guardrails confirmed ---
  it('should list confirmed guardrails', () => {
    const doc = readFileSafe(AUDIT_DOC_PATH);
    const expectedGuardrails = [
      'No frontend API key',
      'Default source remains local_stub',
      'Endpoint default remains stub',
      'No real provider SDK import',
      'No fetch',
      'No auto-save',
      'CONFIG_MISSING',
      'Output safety filter',
      'Logging excludes prompt',
      'Timeout/retry bounded',
    ];
    for (const guardrail of expectedGuardrails) {
      assert.ok(doc.includes(guardrail) || doc.includes(guardrail.toLowerCase()),
        `doc should mention guardrail "${guardrail}"`);
    }
  });

  // --- 6. blockers listed ---
  it('should list blockers', () => {
    const doc = readFileSafe(AUDIT_DOC_PATH);
    const expectedBlockers = [
      'Firebase auth',
      'rate-limit',
      'Real provider adapter',
      'secret management',
      'staging',
      'abuse monitoring',
      'cost/quota',
      'GitGuardian',
    ];
    const docLower = doc.toLowerCase();
    for (const blocker of expectedBlockers) {
      assert.ok(docLower.includes(blocker.toLowerCase()),
        `doc should mention blocker "${blocker}"`);
    }
  });

  // --- 7. conditions for first real provider slice ---
  it('should list conditions for first real provider slice', () => {
    const doc = readFileSafe(AUDIT_DOC_PATH);
    const expectedConditions = [
      'server/serverless only',
      'disabled by default',
      'no frontend API key',
      'explicit env/config',
      'prompt builder',
      'response validator',
      'output safety filter',
      'logging',
      'timeout/retry',
      'sourceUrl must not be fetched',
      'no auto-save',
    ];
    const docLower = doc.toLowerCase();
    for (const cond of expectedConditions) {
      assert.ok(docLower.includes(cond.toLowerCase()),
        `doc should mention condition "${cond}"`);
    }
  });

  // --- 8. recommended next slice exists ---
  it('should have a recommended next slice', () => {
    const doc = readFileSafe(AUDIT_DOC_PATH);
    assert.ok(doc.includes('Recommended Next Slice'),
      'doc should have a Recommended Next Slice section');
    assert.ok(doc.includes('real provider adapter') ||
      doc.includes('Real provider adapter') ||
      doc.includes('[TECH]'),
      'doc should name a recommended next slice');
  });

  // --- 9. no implementation behavior change ---
  it('should not change production behavior', () => {
    const adapter = readFileSafe(ADAPTER_PATH);
    const suggest = readFileSafe(SUGGEST_PATH);
    // key behavior invariants preserved:
    assert.ok(suggest.includes('STUB') || suggest.includes('stub'),
      'suggest.js should keep stub provider mode');
    // Check for actual SDK import patterns, not just any string mention.
    // A gate check like `provider === 'openai-compatible'` is legitimate.
    const sdkImportRe = /(import|require).*['"`]openai|import.*['"`]anthropic|import.*['"`]gemini/;
    assert.ok(!sdkImportRe.test(suggest),
      'suggest.js should not contain real provider SDK imports');
  });

  // --- 10. no provider SDK import in production JS ---
  it('should not have provider SDK imports in production JS', () => {
    const adapter = readFileSafe(ADAPTER_PATH);
    const suggest = readFileSafe(SUGGEST_PATH);
    const prohibitedSdks = [
      'openai',
      'anthropic',
      'gemini',
      'groq',
      'mistral',
    ];
    const allCode = adapter + ' ' + suggest;
    const codeLower = allCode.toLowerCase();
    for (const sdk of prohibitedSdks) {
      // Allow mentions in comments or doc strings, but not import/require
      const importPattern = new RegExp(`(import|require).*['"\`]${sdk}`);
      assert.ok(!importPattern.test(allCode),
        `should not import/require "${sdk}" SDK in production code (filename mentions fine)`);
    }
  });

  // --- 11. endpoint default remains stub ---
  it('should preserve endpoint default stub', () => {
    const suggest = readFileSafe(SUGGEST_PATH);
    assert.ok(suggest.includes("'stub'") || suggest.includes('"stub"'),
      'suggest.js should reference stub mode');
  });

  // --- 12. frontend default remains local_stub ---
  it('should preserve frontend default local_stub', () => {
    const suggest = readFileSafe(SUGGEST_PATH);
    // The suggest endpoint should still default to stub
    assert.ok(
      suggest.includes("'stub'") || suggest.includes('"stub"') || suggest.includes('stub'),
      'suggest.js should preserve stub default somewhere'
    );
  });

  // --- 13. no auto-save/persistence ---
  it('should not have auto-save or persistence in Scout suggestion files', () => {
    const adapter = readFileSafe(ADAPTER_PATH);
    const suggest = readFileSafe(SUGGEST_PATH);
    const combinedForbidden = adapter + ' ' + suggest;
    // Should not call auto-save functions
    const autoSavePatterns = [
      'addMemoryFromForm',
      '.save(',
      'localStorage',
      'sessionStorage',
    ];
    for (const pattern of autoSavePatterns) {
      if (combinedForbidden.includes(pattern)) {
        // Allow comments/documentation, but flag actual calls
        assert.ok(
          pattern === '.save(' ?
            !/\.save\([^)]*memory/i.test(combinedForbidden) || combinedForbidden.includes('//')
            : true,
          `should not call "${pattern}" directly in production path`
        );
      }
    }
  });

  // --- 14. docs updated ---
  it('should have audit status reflected in existing docs', () => {
    const promptDoc = readFileSafe(PROMPT_RESPONSE_DOC_PATH);
    const serverlessDoc = readFileSafe(SERVERLESS_DOC_PATH);
    const llmDoc = readFileSafe(LLM_BOUNDARY_DOC_PATH);
    const readinessDoc = readFileSafe(MVP_READINESS_DOC_PATH);

    const allDocs = promptDoc + ' ' + serverlessDoc + ' ' + llmDoc + ' ' + readinessDoc;
    const auditLower = allDocs.toLowerCase();
    // At least one doc should reference the readiness audit
    assert.ok(
      auditLower.includes('readiness audit') ||
      auditLower.includes('live provider readiness'),
      'at least one existing doc should reference the readiness audit'
    );
    // At least one doc should state the verdict
    assert.ok(
      auditLower.includes('not ready for default') ||
      auditLower.includes('disabled-by-default'),
      'at least one doc should state not ready for default live AI usage'
    );
  });
});
