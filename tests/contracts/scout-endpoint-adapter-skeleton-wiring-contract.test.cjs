/**
 * Scout Endpoint → Adapter Skeleton Wiring Contract Tests
 * v20260606-1
 *
 * Contract tests verifying that:
 * - Endpoint imports/references adapter skeleton
 * - Default endpoint remains stub
 * - Explicit stub remains stub
 * - Live mode missing config → CONFIG_MISSING
 * - Live mode configured → still safe-fail (no real provider call)
 * - Adapter error maps to structured error
 * - No provider SDK/no fetch/no source fetch/no secret leak
 * - Endpoint validation preserved
 * - Default UI/client unchanged
 * - No auto-save/persistence
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

// ── 1. Endpoint imports or references adapter skeleton ─────────────────────
test('Endpoint imports or references adapter skeleton', () => {
  assert.ok(suggestCode.includes('live-provider-adapter'),
    'suggest.js should import from live-provider-adapter');
  assert.ok(suggestCode.includes('createScoutLiveProviderAdapter'),
    'suggest.js should use createScoutLiveProviderAdapter');
  assert.ok(suggestCode.includes('adapter.suggest'),
    'suggest.js should call adapter.suggest in live mode');
});

// ── 2. Default endpoint remains stub ──────────────────────────────────────
test('Default endpoint remains stub (no env) — deterministic stub response', () => {
  assert.ok(suggestCode.includes('generateStubSuggestion'),
    'Endpoint should have stub generation');
  assert.ok(suggestCode.includes('providerMode:'),
    'Endpoint should include providerMode in response');
  // Default path should still call generateStubSuggestion
  const defaultBranch = suggestCode.match(/\/\/ ─── Live provider integration[\s\S]*?(?=\/\/ ───|export)/);
  // The default path after the live provider branch still calls generateStubSuggestion
  assert.ok(suggestCode.includes('Return deterministic stub suggestion'),
    'Default path should have comment about returning deterministic stub');
  assert.ok(suggestCode.includes("suggestion = generateStubSuggestion"),
    'Default path should call generateStubSuggestion');
});

// ── 3. Explicit stub remains stub ─────────────────────────────────────────
test('Explicit SCOUT_SUGGEST_PROVIDER_MODE=stub returns providerMode:"stub"', () => {
  // The resolveScoutSuggestProviderMode function returns stub for mode=stub
  // We can verify the code path exists
  assert.ok(suggestCode.includes('STUB') || suggestCode.includes("'stub'"),
    'Endpoint should handle STUB mode');
  assert.ok(suggestCode.includes("providerMode: SCOUT_SUGGEST_PROVIDER_MODES.STUB"),
    'Endpoint should return stub providerMode');
});

// ── 4. Live mode missing config safe failure ──────────────────────────────
test('Live mode missing config returns CONFIG_MISSING safe error', () => {
  // The resolveScoutSuggestProviderMode returns CONFIG_MISSING when live mode
  // but config missing
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

// ── 5. Live mode configured still no real provider call ──────────────────
test('Live mode with config still safe-fails — no real provider call', () => {
  // Verify adapter.suggest is called but returns CONFIG_MISSING
  assert.ok(suggestCode.includes('adapter.suggest'),
    'Endpoint should call adapter.suggest in live mode');
  // Verify adapter still returns CONFIG_MISSING (no real call)
  assert.ok(adapterCode.includes('CONFIG_MISSING'),
    'Adapter should still return CONFIG_MISSING');

  // No fetch in live path
  const liveBranch = suggestCode.split('adapter.suggest');
  assert.ok(!adapterCode.includes('fetch('),
    'Adapter should not use fetch');
});

// ── 6. Adapter result maps to structured error ───────────────────────────
test('Adapter ok:false result maps to endpoint structured error with 503', () => {
  // Check endpoint handles adapter error
  assert.ok(suggestCode.includes('if (!adapterResult.ok)'),
    'Endpoint should check adapterResult.ok');
  assert.ok(suggestCode.includes('buildErrorResponse(adapterResult.error.code'),
    'Endpoint should map adapter error to buildErrorResponse');
  // 503 status for adapter errors
  assert.ok(suggestCode.includes(', 503'),
    'Endpoint should return 503 for adapter errors');
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
  // Check only non-comment code
  const codeWOComments = combinedCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!codeWOComments.includes('fetch('),
    'Should not have executable fetch calls');
  assert.ok(!codeWOComments.includes('XMLHttpRequest'),
    'Should not use XMLHttpRequest');
  assert.ok(!codeWOComments.includes('axios'),
    'Should not use axios');
  // Allow headers.get() — that's just reading request headers, not external HTTP
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
    if (line.includes('CONFIG_MISSING') || line.includes('Error response:') ||
        line.includes('error.code') || line.includes('error.message')) {
      // Check no env var names in error messages
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
  // Adapter error messages should not contain API key or token
  assert.ok(!adapterCode.match(/message.*sk-[a-zA-Z0-9]/),
    'Adapter error messages should not contain API key patterns');
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
  // Draft UI still uses local_stub as default source
  assert.ok(draftUiCode.includes('local_stub') || draftUiCode.includes('createScoutSuggestionSourceProvider'),
    'Draft UI should still use source selector');
  assert.ok(!draftUiCode.includes('live-provider-adapter'),
    'Draft UI should not import adapter');
  assert.ok(!draftUiCode.includes('createScoutLiveProviderAdapter'),
    'Draft UI should not create adapter');

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
test('At least one Scout boundary doc references adapter wiring or endpoint recognizes adapter', () => {
  const allDocContent = endpointBoundaryContent + readinessContent + promptContractContent + llmBoundaryContent;
  // Should reference adapter skeleton (from previous PR)
  const hasAdapterRef = allDocContent.toLowerCase().includes('adapter skeleton') ||
    allDocContent.toLowerCase().includes('live provider adapter');
  assert.ok(hasAdapterRef, 'At least one doc should reference adapter skeleton');

  // Should mention live mode remains disabled/safe-fail
  const hasSafeFailRef = allDocContent.toLowerCase().includes('safe-fail') ||
    allDocContent.toLowerCase().includes('disabled') ||
    allDocContent.toLowerCase().includes('no real provider');
  assert.ok(hasSafeFailRef, 'Docs should mention live mode remains disabled/safe-fail');

  // Should mention default endpoint remains stub
  const hasStubRef = allDocContent.toLowerCase().includes('default source remains') ||
    allDocContent.toLowerCase().includes('endpoint remains stub') ||
    allDocContent.toLowerCase().includes('deterministic stub');
  assert.ok(hasStubRef, 'Docs should mention default remains stub');
});

// ── Results ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
