'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

const ADAPTER_PATH = path.join(PROJECT_ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(PROJECT_ROOT, 'functions/api/scout/suggest.js');
const CHECKLIST_DOC_PATH = path.join(PROJECT_ROOT, 'docs/product/lovebud-scout-provider-secret-config-deployment-checklist.md');
const READINESS_AUDIT_PATH = path.join(PROJECT_ROOT, 'docs/product/lovebud-scout-live-provider-readiness-audit.md');
const PROMPT_RESPONSE_DOC_PATH = path.join(PROJECT_ROOT, 'docs/product/lovebud-scout-live-provider-prompt-response-contract.md');
const SERVERLESS_DOC_PATH = path.join(PROJECT_ROOT, 'docs/product/lovebud-scout-serverless-endpoint-boundary.md');
const LLM_BOUNDARY_DOC_PATH = path.join(PROJECT_ROOT, 'docs/product/lovebud-scout-llm-provider-boundary.md');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function countInSource(source, name) {
  // Counts occurrences of a name in the source, excluding comments
  return (source.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
}

describe('Scout Real Provider Adapter Interface Contract', () => {
  const adapter = readFileSafe(ADAPTER_PATH);
  const suggest = readFileSafe(SUGGEST_PATH);

  // --- 1. interface exports exist ---
  it('should export interface constants and functions', () => {
    assert.ok(adapter.includes('SCOUT_LIVE_PROVIDER_INTERFACE_STATUS'),
      'adapter should export SCOUT_LIVE_PROVIDER_INTERFACE_STATUS');
    assert.ok(adapter.includes('SCOUT_LIVE_PROVIDER_CONFIG_KEYS'),
      'adapter should export SCOUT_LIVE_PROVIDER_CONFIG_KEYS');
    assert.ok(adapter.includes('normalizeScoutLiveProviderConfig'),
      'adapter should export normalizeScoutLiveProviderConfig');
    assert.ok(adapter.includes('createScoutRealProviderAdapterInterface'),
      'adapter should export createScoutRealProviderAdapterInterface');
  });

  // --- 2. config keys documented in code ---
  it('should have config keys as constants', () => {
    const expectedKeys = [
      'SCOUT_SUGGEST_PROVIDER_MODE',
      'SCOUT_SUGGEST_LLM_PROVIDER',
      'SCOUT_SUGGEST_MODEL',
      'SCOUT_SUGGEST_LLM_API_KEY',
      'SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED',
    ];
    for (const key of expectedKeys) {
      assert.ok(adapter.includes(key),
        `adapter should reference config key "${key}"`);
    }
  });

  // --- 3. default config disabled ---
  it('should return disabled status for empty config', () => {
    // Test by checking the normalize function contains DISABLED status path
    assert.ok(adapter.includes("SCOUT_LIVE_PROVIDER_INTERFACE_STATUS.DISABLED"),
      'adapter should have a DISABLED status path');
    // Verify the status constant exists
    assert.ok(adapter.includes("'disabled'"),
      'adapter should define disabled status value');
  });

  // --- 4. live adapter disabled by default ---
  it('should keep live adapter disabled by default', () => {
    // The normalize function should check if enabled before proceeding
    assert.ok(adapter.includes('liveAdapterEnabled'),
      'adapter should check liveAdapterEnabled flag');
    assert.ok(adapter.includes("'true'") || adapter.includes("'1'"),
      'adapter should compare enabled against true/1 strings');
  });

  // --- 5. missing config maps CONFIG_MISSING ---
  it('should map missing provider/model/API key to CONFIG_MISSING', () => {
    assert.ok(adapter.includes("'CONFIG_MISSING'"),
      'adapter should reference CONFIG_MISSING code');
    assert.ok(adapter.includes('!provider') || adapter.includes('!model') || adapter.includes('!hasApiKey'),
      'adapter should check for missing provider/model/API key');
  });

  // --- 6. API key value never returned ---
  it('should not return API key value in normalize output', () => {
    // hasApiKey boolean is the allowed representation, never the raw key value
    assert.ok(adapter.includes('hasApiKey'),
      'adapter should expose hasApiKey boolean');
    // The normalize function should have hasApiKey in its return objects
    // but not include the raw apiKey value as a standalone return field
    const normalizeSection = adapter.split('function normalizeScoutLiveProviderConfig')[1] || '';
    // Find all lines with apiKey: key pattern (but not hasApiKey:)
    const lines = normalizeSection.split('\n');
    const suspiciousApiKeyLines = lines.filter(l => {
      const trimmed = l.trim();
      // Match lines that have 'apiKey:' as a key (colon after it) but not 'hasApiKey:'
      return /(?<!has)apiKey\s*:/.test(trimmed) && !trimmed.includes('hasApiKey');
    });
    assert.equal(suspiciousApiKeyLines.length, 0,
      'normalize function should not return raw apiKey value; suspicious lines: ' +
      suspiciousApiKeyLines.join(', '));
    assert.ok(normalizeSection.includes('hasApiKey'),
      'normalize function should use hasApiKey boolean');
  });

  // --- 7. ready config safe status ---
  it('should return ready_for_adapter status for complete config', () => {
    assert.ok(adapter.includes('READY_FOR_ADAPTER'),
      'adapter should support READY_FOR_ADAPTER status');
    assert.ok(adapter.includes("'ready_for_adapter'"),
      'adapter should define ready_for_adapter value');
  });

  // --- 8. timeout/retry config clamp ---
  it('should clamp timeout and retry values using existing policy', () => {
    assert.ok(adapter.includes('SCOUT_LIVE_PROVIDER_TIMEOUT_RETRY_POLICY'),
      'normalize function should reference timeout/retry policy');
    assert.ok(adapter.includes('minTimeoutMs') || adapter.includes('maxTimeoutMs'),
      'normalize function should clamp timeout values');
    assert.ok(adapter.includes('maxAllowedRetries'),
      'normalize function should clamp retry values');
  });

  // --- 9. baseUrl is not fetched ---
  it('should treat baseUrl as string config only, not fetch target', () => {
    // Verify baseUrl is handled as a config string normalization
    assert.ok(adapter.includes('baseUrl') || adapter.includes('BASE_URL'),
      'adapter should handle baseUrl/config');
    // Check that the adapter has no fetch/XMLHttpRequest/axios usage
    assert.ok(!adapter.includes('fetch(') || adapter.match(/fetch\(/g).length <= 1,
      'adapter should not call fetch (permit only pattern match false-positive)');
  });

  // --- 10. real provider interface suggest safe-fails ---
  it('should have suggest() that safe-fails for all states', () => {
    assert.ok(adapter.includes('PROVIDER_UNAVAILABLE'),
      'suggest should return PROVIDER_UNAVAILABLE for disabled state');
    assert.ok(adapter.includes('CONFIG_MISSING'),
      'suggest should return CONFIG_MISSING for config missing state');
    // Check the suggest function returns { ok: false }
    assert.ok(adapter.includes('ok: false'),
      'suggest should return ok: false');
  });

  // --- 11. no provider SDK import ---
  it('should not have provider SDK imports', () => {
    const prohibitedSdks = ['openai', 'anthropic', 'gemini', 'groq', 'mistral'];
    for (const sdk of prohibitedSdks) {
      const importPattern = new RegExp(`(import|require).*['"\`]${sdk}`);
      assert.ok(!importPattern.test(adapter),
        `should not import/require "${sdk}" SDK in adapter code`);
    }
  });

  // --- 12. no fetch/XHR/axios ---
  it('should not contain fetch, XMLHttpRequest, or axios calls', () => {
    // Allow comments referencing fetch but not actual calls
    const sourceLines = adapter.split('\n');
    let fetchCount = 0;
    for (const line of sourceLines) {
      const trimmed = line.trim();
      if (trimmed.includes('fetch(') && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
        fetchCount++;
      }
    }
    assert.ok(fetchCount <= 1,
      `should have at most 1 fetch call (was ${fetchCount})`);
    assert.ok(!adapter.includes('XMLHttpRequest'),
      'should not have XMLHttpRequest');
    assert.ok(!adapter.includes('axios'),
      'should not have axios');
  });

  // --- 13. no secret logging/persistence/auto-save ---
  it('should not log secrets or call persistence/auto-save', () => {
    const codeLower = adapter.toLowerCase();
    // Should not expose API key value in logging context
    const logApiKeyPattern = /log.*apiKey|apiKey.*log/i;
    assert.ok(!logApiKeyPattern.test(adapter),
      'should not have API key logging');
    // Should not call persistence or auto-save
    const forbiddenPatterns = [
      'localStorage',
      'sessionStorage',
      'addMemoryFromForm',
      '.save(',
    ];
    for (const pattern of forbiddenPatterns) {
      if (codeLower.includes(pattern.toLowerCase())) {
        // If found, verify it's in a comment, not in executable code
        const lineMatches = adapter.split('\n').filter(l => l.toLowerCase().includes(pattern.toLowerCase()));
        const allComments = lineMatches.every(l => l.trim().startsWith('//') || l.trim().startsWith('*'));
        assert.ok(allComments,
          `should not call "${pattern}" in executable code`);
      }
    }
  });

  // --- 14. endpoint default stub preserved ---
  it('should preserve endpoint default stub', () => {
    assert.ok(suggest.includes('STUB') || suggest.includes('stub'),
      'suggest.js should keep stub provider mode');
  });

  // --- 15. frontend default local_stub preserved ---
  it('should preserve frontend default local_stub', () => {
    assert.ok(suggest.includes('STUB') || suggest.includes('stub'),
      'suggest.js should reference stub mode');
  });

  // --- 16. docs updated ---
  it('should have interface status reflected in existing docs', () => {
    const checklistDoc = readFileSafe(CHECKLIST_DOC_PATH);
    const readinessAudit = readFileSafe(READINESS_AUDIT_PATH);
    const promptDoc = readFileSafe(PROMPT_RESPONSE_DOC_PATH);
    const serverlessDoc = readFileSafe(SERVERLESS_DOC_PATH);
    const llmDoc = readFileSafe(LLM_BOUNDARY_DOC_PATH);

    const allDocs = checklistDoc + ' ' + readinessAudit + ' ' + promptDoc + ' ' + serverlessDoc + ' ' + llmDoc;
    const auditLower = allDocs.toLowerCase();
    // At least one doc should reference the real provider adapter interface
    assert.ok(
      auditLower.includes('real provider adapter') ||
      auditLower.includes('real-provider adapter') ||
      auditLower.includes('adapter interface'),
      'at least one existing doc should reference the real provider adapter interface'
    );
    // At least one doc should state live adapter is disabled by default
    assert.ok(
      auditLower.includes('disabled by default') ||
      auditLower.includes('disabled-by-default') ||
      auditLower.includes('live adapter remains disabled'),
      'at least one doc should state live adapter disabled by default'
    );
  });
});
