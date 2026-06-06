'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

const SUGGEST_PATH = path.join(PROJECT_ROOT, 'functions/api/scout/suggest.js');
const ADAPTER_PATH = path.join(PROJECT_ROOT, 'functions/api/scout/live-provider-adapter.js');
const SOURCE_SELECTOR_PATH = path.join(PROJECT_ROOT, 'js/scout/scout-suggestion-source-selector.js');
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

describe('Scout Real Provider Disabled Endpoint Contract', () => {
  const suggest = readFileSafe(SUGGEST_PATH);
  const adapter = readFileSafe(ADAPTER_PATH);
  const sourceSelector = readFileSafe(SOURCE_SELECTOR_PATH);

  // --- 1. endpoint imports or references real provider adapter interface ---
  it('should import or reference real provider adapter interface', () => {
    assert.ok(suggest.includes('createScoutRealProviderAdapterInterface'),
      'suggest.js should use createScoutRealProviderAdapterInterface');
    assert.ok(suggest.includes('SCOUT_LIVE_PROVIDER_INTERFACE_STATUS'),
      'suggest.js should reference SCOUT_LIVE_PROVIDER_INTERFACE_STATUS');
  });

  // --- 2. default request remains stub ---
  it('should keep deterministic stub for default request', () => {
    assert.ok(suggest.includes('generateStubSuggestion'),
      'suggest.js should have generateStubSuggestion');
    assert.ok(suggest.includes("suggestion = generateStubSuggestion"),
      'default path should call generateStubSuggestion');
  });

  // --- 3. explicit stub remains stub ---
  it('should keep explicit stub path', () => {
    assert.ok(suggest.includes("providerMode: SCOUT_SUGGEST_PROVIDER_MODES.STUB"),
      'suggest.js should return STUB providerMode for stub mode');
  });

  // --- 4. live mode disabled adapter returns PROVIDER_UNAVAILABLE ---
  it('should handle live mode with disabled adapter', () => {
    assert.ok(suggest.includes('DISABLED'),
      'suggest.js should handle DISABLED status');
    assert.ok(suggest.includes('PROVIDER_UNAVAILABLE'),
      'suggest.js should return PROVIDER_UNAVAILABLE for disabled state');
  });

  // --- 5. live mode missing config returns CONFIG_MISSING ---
  it('should handle live mode with missing config', () => {
    assert.ok(suggest.includes('SCOUT_LIVE_PROVIDER_INTERFACE_STATUS.CONFIG_MISSING'),
      'suggest.js should check CONFIG_MISSING status');
    assert.ok(suggest.includes("'CONFIG_MISSING'"),
      'suggest.js should reference CONFIG_MISSING error code');
  });

  // --- 6. live mode ready_for_adapter still safe-fails ---
  it('should safe-fail for ready_for_adapter state without real call', () => {
    assert.ok(suggest.includes('READY_FOR_ADAPTER'),
      'suggest.js should handle READY_FOR_ADAPTER status');
    assert.ok(suggest.includes('not yet connected'),
      'suggest.js should have appropriate message for ready state');
  });

  // --- 7. providerMode live preserved in error response ---
  it('should preserve providerMode:live in live error context', () => {
    assert.ok(suggest.includes('SCOUT_SUGGEST_PROVIDER_MODES.LIVE'),
      'suggest.js should reference LIVE provider mode');
  });

  // --- 8. API key value never appears in response ---
  it('should not expose API key value in response paths', () => {
    // Error responses should not include API key values
    const errorPaths = suggest.match(/buildErrorResponse\([^)]+\)/g) || [];
    for (const ep of errorPaths) {
      assert.ok(!ep.includes('apiKey') && !ep.includes('API_KEY'),
        `Error response should not expose API key: "${ep}"`);
    }
    // The live mode branch should not pass raw API key to buildErrorResponse
    const lines = suggest.split('\n');
    for (const line of lines) {
      if (line.includes('buildErrorResponse') && (line.includes('apiKey') || line.includes('API_KEY'))) {
        assert.ok(!line.includes('buildErrorResponse') || line.startsWith('//'),
          `Should not build error response with API key value`);
      }
    }
  });

  // --- 9. no provider SDK imports ---
  it('should not have provider SDK imports', () => {
    const prohibitedSdks = ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia'];
    const allCode = suggest + ' ' + adapter;
    for (const sdk of prohibitedSdks) {
      const importPattern = new RegExp(`(import|require).*['"\`]${sdk}`);
      assert.ok(!importPattern.test(allCode),
        `should not import/require "${sdk}" SDK`);
    }
  });

  // --- 10. no fetch/XHR/axios in endpoint live path ---
  it('should not contain fetch, XMLHttpRequest, or axios in live path', () => {
    const combinedCode = suggest + ' ' + adapter;
    const codeWOComments = combinedCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeWOComments.includes('fetch('),
      'should not have executable fetch calls');
    assert.ok(!codeWOComments.includes('XMLHttpRequest'),
      'should not have XMLHttpRequest');
    assert.ok(!codeWOComments.includes('axios'),
      'should not have axios');
  });

  // --- 11. no sourceUrl fetch/crawler/metadata extraction ---
  it('should not fetch sourceUrl or extract metadata', () => {
    const combinedCode = suggest + ' ' + adapter;
    // sourceUrl should only be a request field, never a fetch target
    assert.ok(suggest.includes('sourceUrl'),
      'suggest.js should handle sourceUrl as request field');
    // No fetch of sourceUrl
    assert.ok(!combinedCode.includes("fetch(sourceUrl") && !combinedCode.includes("fetch(source_url"),
      'should not fetch sourceUrl');
  });

  // --- 12. no persistence/auto-save ---
  it('should not have persistence or auto-save calls', () => {
    const combinedCode = suggest + ' ' + adapter;
    const codeWOComments = combinedCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeWOComments.includes('localStorage'), 'should not use localStorage');
    assert.ok(!codeWOComments.includes('sessionStorage'), 'should not use sessionStorage');
    assert.ok(!codeWOComments.includes('addMemoryFromForm'), 'should not call addMemoryFromForm');
  });

  // --- 13. existing createScoutLiveProviderAdapter mock executor path remains exported ---
  it('should keep createScoutLiveProviderAdapter exported from adapter', () => {
    assert.ok(adapter.includes('createScoutLiveProviderAdapter'),
      'adapter should still export createScoutLiveProviderAdapter');
    assert.ok(suggest.includes('createScoutLiveProviderAdapter'),
      'suggest.js should still import createScoutLiveProviderAdapter');
  });

  // --- 14. frontend default local_stub preserved ---
  it('should preserve frontend default local_stub', () => {
    assert.ok(sourceSelector.includes('local_stub'),
      'source selector should default to local_stub');
  });

  // --- 15. docs updated ---
  it('should have disabled-mode endpoint contract reflected in existing docs', () => {
    const checklistDoc = readFileSafe(CHECKLIST_DOC_PATH);
    const readinessAudit = readFileSafe(READINESS_AUDIT_PATH);
    const promptDoc = readFileSafe(PROMPT_RESPONSE_DOC_PATH);
    const serverlessDoc = readFileSafe(SERVERLESS_DOC_PATH);
    const llmDoc = readFileSafe(LLM_BOUNDARY_DOC_PATH);

    const allDocs = checklistDoc + ' ' + readinessAudit + ' ' + promptDoc + ' ' + serverlessDoc + ' ' + llmDoc;
    const docLower = allDocs.toLowerCase();
    // At least one doc should reference the disabled-mode endpoint contract
    assert.ok(
      docLower.includes('disabled endpoint') ||
      docLower.includes('disabled-mode') ||
      docLower.includes('disabled mode') ||
      docLower.includes('disabled by default'),
      'at least one doc should reference disabled-mode endpoint contract'
    );
    // At least one doc should mention PROVIDER_UNAVAILABLE
    assert.ok(
      docLower.includes('provider_unavailable') ||
      docLower.includes('PROVIDER_UNAVAILABLE'),
      'at least one doc should mention PROVIDER_UNAVAILABLE'
    );
  });
});
