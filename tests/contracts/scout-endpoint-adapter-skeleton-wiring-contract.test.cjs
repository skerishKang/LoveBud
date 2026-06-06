/**
 * Scout Endpoint → Adapter Skeleton Wiring Contract Tests
 * v20260606-1
 *
 * Contract tests verifying that:
 * - Endpoint imports/references real provider adapter interface
 * - Default endpoint remains stub
 * - Explicit stub remains stub
 * - Live mode disabled → PROVIDER_UNAVAILABLE
 * - Live mode missing config → CONFIG_MISSING
 * - Live mode ready_for_adapter → safe-fail (no real provider call)
 * - No provider SDK/no fetch/no source fetch/no secret leak
 * - Endpoint validation preserved
 * - Default UI/client unchanged
 * - No auto-save/persistence
 * - createScoutLiveProviderAdapter remains exported
 * - Docs updated
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SUGGEST_PATH = path.resolve(__dirname, '../../functions/api/scout/suggest.js');
const ADAPTER_PATH = path.resolve(__dirname, '../../functions/api/scout/live-provider-adapter.js');
const PROVIDER_PATH = path.resolve(__dirname, '../../js/scout/scout-suggestion-provider.js');
const ENDPOINT_CLIENT_PATH = path.resolve(__dirname, '../../js/scout/scout-suggestion-endpoint-client.js');
const DRAFT_UI_PATH = path.resolve(__dirname, '../../js/scout/scout-draft-ui.js');
const SOURCE_SELECTOR_PATH = path.resolve(__dirname, '../../js/scout/scout-suggestion-source-selector.js');
const ENDPOINT_BOUNDARY_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-serverless-endpoint-boundary.md');
const READINESS_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-ai-suggestion-mvp-readiness.md');
const PROMPT_CONTRACT_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-live-provider-prompt-response-contract.md');
const LLM_BOUNDARY_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-llm-provider-boundary.md');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

const suggestCode = readFileSafe(SUGGEST_PATH);
const adapterCode = readFileSafe(ADAPTER_PATH);
const providerCode = readFileSafe(PROVIDER_PATH);
const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);
const draftUiCode = readFileSafe(DRAFT_UI_PATH);
const sourceSelectorCode = readFileSafe(SOURCE_SELECTOR_PATH);
const endpointBoundaryContent = readFileSafe(ENDPOINT_BOUNDARY_PATH);
const readinessContent = readFileSafe(READINESS_PATH);
const promptContractContent = readFileSafe(PROMPT_CONTRACT_PATH);
const llmBoundaryContent = readFileSafe(LLM_BOUNDARY_PATH);

let passed = 0;
let failed = 0;

function test(name, fn) {
  passed++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
    passed--;
  }
}

console.log('Scout Endpoint → Adapter Skeleton Wiring Contract Tests\n');

// ── 1. Endpoint imports or references real provider adapter interface ───────
test('Endpoint imports or references real provider adapter interface', () => {
  assert.ok(suggestCode.includes('live-provider-adapter'),
    'suggest.js should import from live-provider-adapter');
  assert.ok(suggestCode.includes('createScoutRealProviderAdapterInterface'),
    'suggest.js should use createScoutRealProviderAdapterInterface');
  assert.ok(suggestCode.includes('SCOUT_LIVE_PROVIDER_INTERFACE_STATUS'),
    'suggest.js should reference SCOUT_LIVE_PROVIDER_INTERFACE_STATUS');
  // createScoutLiveProviderAdapter remains exported from adapter file
  assert.ok(adapterCode.includes('createScoutLiveProviderAdapter'),
    'adapter should still export createScoutLiveProviderAdapter');
});

// ── 2. Default endpoint remains stub ──────────────────────────────────────
test('Default endpoint remains stub (no env) — deterministic stub response', () => {
  assert.ok(suggestCode.includes('generateStubSuggestion'),
    'Endpoint should have stub generation');
  assert.ok(suggestCode.includes('providerMode:'),
    'Endpoint should include providerMode in response');
  // Default path should still call generateStubSuggestion
  assert.ok(suggestCode.includes('Return deterministic stub suggestion'),
    'Default path should have comment about returning deterministic stub');
  assert.ok(suggestCode.includes("suggestion = generateStubSuggestion"),
    'Default path should call generateStubSuggestion');
});

// ── 3. Explicit stub remains stub ─────────────────────────────────────────
test('Explicit SCOUT_SUGGEST_PROVIDER_MODE=stub returns providerMode:"stub"', () => {
  assert.ok(suggestCode.includes('STUB') || suggestCode.includes("'stub'"),
    'Endpoint should handle STUB mode');
  assert.ok(suggestCode.includes("providerMode: SCOUT_SUGGEST_PROVIDER_MODES.STUB"),
    'Endpoint should return stub providerMode');
});

// ── 4. Live mode missing config safe failure ──────────────────────────────
test('Live mode missing config returns CONFIG_MISSING safe error', () => {
  assert.ok(suggestCode.includes('config_missing'),
    'Endpoint should handle config_missing status');
  assert.ok(suggestCode.includes('CONFIG_MISSING'),
    'Endpoint should return CONFIG_MISSING error code');
  // The error message should not leak config details
  const msgLine = suggestCode.split('\n').find(l => l.includes('not configured'));
  assert.ok(msgLine, 'Error message should say "not configured"');
  assert.ok(!msgLine || !msgLine.includes('SCOUT_SUGGEST_LLM_API_KEY'),
    'Error message should not expose env var names');
});

// ── 5. Live mode disabled → PROVIDER_UNAVAILABLE ─────────────────────────
test('Live mode disabled adapter returns PROVIDER_UNAVAILABLE', () => {
  assert.ok(suggestCode.includes('DISABLED'),
    'Endpoint should handle DISABLED status from real provider adapter interface');
  assert.ok(suggestCode.includes('PROVIDER_UNAVAILABLE'),
    'Endpoint should return PROVIDER_UNAVAILABLE for disabled state');
});

// ── 6. Live mode ready_for_adapter safe-fails ────────────────────────────
test('Live mode ready_for_adapter still safe-fails — no real provider call', () => {
  assert.ok(suggestCode.includes('READY_FOR_ADAPTER'),
    'Endpoint should handle READY_FOR_ADAPTER status');
  assert.ok(suggestCode.includes('PROVIDER_UNAVAILABLE'),
    'Endpoint should return PROVIDER_UNAVAILABLE for ready state');
});

// ── 7. No provider SDK import ──────────────────────────────────────────
test('No real provider SDK import or provider-specific code', () => {
  const combinedCode = suggestCode + adapterCode;
  const providerSdks = [
    'openai', 'anthropic', 'gemini', 'groq',
    'mistral', 'nvidia', 'langchain', 'llamaindex',
  ];
  for (const sdk of providerSdks) {
    const patternDefined = combinedCode.includes(`import ${sdk}`) ||
      combinedCode.includes(`require('${sdk}`) ||
      combinedCode.includes(`require("${sdk}`);
    assert.ok(!patternDefined, `Should not import/require SDK: ${sdk}`);
  }
});

// ── 8. No external fetch / source fetch ─────────────────────────────────
test('No external fetch, XMLHttpRequest, or sourceUrl fetch', () => {
  const combinedCode = suggestCode + adapterCode;
  const codeWOComments = combinedCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!codeWOComments.includes('fetch('),
    'Should not have executable fetch calls');
  assert.ok(!codeWOComments.includes('XMLHttpRequest'),
    'Should not use XMLHttpRequest');
  assert.ok(!codeWOComments.includes('axios'),
    'Should not use axios');
  const httpGetCalls = codeWOComments.match(/[^a-zA-Z]\.get\(/g);
  if (httpGetCalls) {
    const unsafeGets = httpGetCalls.filter(g => !g.includes('.headers'));
    assert.ok(unsafeGets.length === 0,
      `Should not have external HTTP get calls: ${unsafeGets.join(', ')}`);
  }
});

// ── 9. No secrets leak in error messages ─────────────────────────────────
test('CONFIG_MISSING/PROVIDER_UNAVAILABLE error messages do not leak secrets', () => {
  suggestCode.split('\n').forEach((line, idx) => {
    if (line.includes('CONFIG_MISSING') || line.includes('PROVIDER_UNAVAILABLE') ||
        line.includes('error.code') || line.includes('error.message')) {
      const envVars = ['SCOUT_SUGGEST_LLM_API_KEY', 'SCOUT_SUGGEST_LLM_PROVIDER',
        'SCOUT_SUGGEST_MODEL', 'SCOUT_SUGGEST_LLM_BASE_URL'];
      for (const ev of envVars) {
        const hasLeak = line.includes(ev) && !line.startsWith('//') &&
          !line.startsWith(' *') && !line.startsWith('const');
        assert.ok(!hasLeak,
          `Line ${idx + 1} may leak env var ${ev}: "${line.trim()}"`);
      }
    }
  });
  adapterCode.split('\n').forEach((line, idx) => {
    if (line.includes('CONFIG_MISSING') || line.includes('PROVIDER_UNAVAILABLE') ||
        line.includes('error.code') || line.includes('error.message')) {
      if (line.toLowerCase().includes('api') || line.toLowerCase().includes('key') ||
          line.toLowerCase().includes('token') || line.toLowerCase().includes('secret')) {
        // Allow the message to mention "API key" as a description but not the actual value
        assert.ok(!line.match(/message.*['"][a-zA-Z0-9_-]{20,}['"]/),
          `Line ${idx + 1} may leak credential value: "${line.trim()}"`);
      }
    }
  });
});

// ── 10. Endpoint request validation preserved ──────────────────────────
test('Endpoint request validation preserved: excerpt required, sourceUrl validation, Content-Type, body limit', () => {
  assert.ok(suggestCode.includes('excerpt is required'),
    'Should validate excerpt is required');
  assert.ok(suggestCode.includes('sourceUrl must be a valid URL'),
    'Should validate sourceUrl format');
  assert.ok(suggestCode.includes('Content-Type must be application/json'),
    'Should validate Content-Type');
  assert.ok(suggestCode.includes('MAX_BODY_SIZE') || suggestCode.includes('body too large'),
    'Should have body size limit');
  assert.ok(suggestCode.includes('Invalid JSON body'),
    'Should handle invalid JSON body');
  assert.ok(suggestCode.includes('VALIDATION_ERROR'),
    'Should return VALIDATION_ERROR for bad requests');
});

// ── 11. Endpoint client / default UI unchanged ─────────────────────────
test('Default Scout Draft UI and endpoint client behavior unchanged', () => {
  assert.ok(draftUiCode.includes('local_stub') || draftUiCode.includes('createScoutSuggestionSourceProvider'),
    'Draft UI should still use source selector');
  assert.ok(!draftUiCode.includes('live-provider-adapter'),
    'Draft UI should not import adapter');
  assert.ok(!draftUiCode.includes('createScoutRealProviderAdapterInterface'),
    'Draft UI should not create real provider adapter interface');

  // Endpoint client default is still disabled
  assert.ok(endpointClientCode.includes('isScoutSuggestionEndpointClientEnabled'),
    'Endpoint client should still have feature flag check');
  assert.ok(sourceSelectorCode.includes('local_stub'),
    'Source selector should default to local_stub');

  // Provider code unchanged
  assert.ok(providerCode.includes('DEFAULT_STUB_OUTPUT'),
    'Provider should still have stub output');
  assert.ok(!providerCode.includes('live-provider-adapter'),
    'Provider should not reference adapter');
});

// ── 12. No auto-save / persistence ────────────────────────────────────
test('No auto-save, no persistence in suggest.js or adapter', () => {
  const combinedCode = suggestCode + adapterCode;
  const codeWOComments = combinedCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!codeWOComments.includes('localStorage'), 'Should not use localStorage');
  assert.ok(!codeWOComments.includes('sessionStorage'), 'Should not use sessionStorage');
  assert.ok(!codeWOComments.includes('addMemoryFromForm'), 'Should not call addMemoryFromForm');
  assert.ok(!codeWOComments.includes('handleSave'), 'Should not call handleSave');
  assert.ok(!codeWOComments.includes('.save('), 'Should not call any save function');
});

// ── 13. Docs updated ──────────────────────────────────────────────────
test('At least one Scout boundary doc references live provider adapter interface or disabled endpoint contract', () => {
  const allDocContent = endpointBoundaryContent + readinessContent + promptContractContent + llmBoundaryContent;
  // Should reference real provider adapter interface or disabled endpoint contract
  const hasInterfaceRef = allDocContent.toLowerCase().includes('real provider adapter') ||
    allDocContent.toLowerCase().includes('disabled endpoint') ||
    allDocContent.toLowerCase().includes('adapter interface');
  assert.ok(hasInterfaceRef, 'At least one doc should reference real provider adapter interface');

  // Should mention live mode remains disabled/safe-fail
  const hasSafeFailRef = allDocContent.toLowerCase().includes('safe-fail') ||
    allDocContent.toLowerCase().includes('disabled') ||
    allDocContent.toLowerCase().includes('no real provider');
  assert.ok(hasSafeFailRef, 'Docs should mention live mode remains disabled/safe-fail');

  // Should mention default endpoint remains stub
  const hasStubRef = allDocContent.toLowerCase().includes('default source remains') ||
    allDocContent.toLowerCase().includes('endpoint remains stub') ||
    allDocContent.toLowerCase().includes('deterministic stub') ||
    allDocContent.toLowerCase().includes('default remains stub');
  assert.ok(hasStubRef, 'Docs should mention default remains stub');
});

// ── Results ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
