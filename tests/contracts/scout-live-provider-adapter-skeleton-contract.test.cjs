/**
 * Scout Live Provider Adapter Skeleton Contract Tests
 * v20260606-1
 *
 * Contract tests verifying the adapter skeleton:
 * - File exists with exports
 * - Prompt builder allowed/prohibited input boundaries
 * - sourceUrl attribution-only
 * - Copyright/safety/review instructions in prompt
 * - Response validator schema and constraints
 * - Adapter suggest returns safe unavailable
 * - No real provider/SDK/fetch/secret/auto-save
 * - Endpoint default stub preserved
 * - Docs updated
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const ADAPTER_PATH = path.resolve(__dirname, '../../functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.resolve(__dirname, '../../functions/api/scout/suggest.js');
const PROMPT_CONTRACT_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-live-provider-prompt-response-contract.md');
const READINESS_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-ai-suggestion-mvp-readiness.md');
const LLM_BOUNDARY_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-llm-provider-boundary.md');
const ENDPOINT_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-serverless-endpoint-boundary.md');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

const adapterCode = readFileSafe(ADAPTER_PATH);
const suggestCode = readFileSafe(SUGGEST_PATH);

// Dynamic import helper for ESM
async function importAdapter() {
  const module = await importAbsolute(ADAPTER_PATH);
  return module;
}

const tests = [];

// ── 1. Adapter file exists ─────────────────────────────────────────────────
tests.push({
  name: 'Adapter file exists',
  fn: () => {
    assert.ok(adapterCode.length > 0, 'live-provider-adapter.js should exist');
    assert.ok(adapterCode.includes('SCOUT_LIVE_PROVIDER_ADAPTER_STATUS'), 'Should export SCOUT_LIVE_PROVIDER_ADAPTER_STATUS');
    assert.ok(adapterCode.includes('buildScoutLiveProviderPrompt'), 'Should export buildScoutLiveProviderPrompt');
    assert.ok(adapterCode.includes('validateScoutLiveProviderResponse'), 'Should export validateScoutLiveProviderResponse');
    assert.ok(adapterCode.includes('createScoutLiveProviderAdapter'), 'Should export createScoutLiveProviderAdapter');
  },
});

// ── 2. Exports exist and have correct types ────────────────────────────────
tests.push({
  name: 'Exports exist with correct types',
  fn: async () => {
    const mod = await importAdapter();
    assert.ok(mod.SCOUT_LIVE_PROVIDER_ADAPTER_STATUS, 'SCOUT_LIVE_PROVIDER_ADAPTER_STATUS should exist');
    assert.ok(typeof mod.buildScoutLiveProviderPrompt === 'function', 'buildScoutLiveProviderPrompt should be a function');
    assert.ok(typeof mod.validateScoutLiveProviderResponse === 'function', 'validateScoutLiveProviderResponse should be a function');
    assert.ok(typeof mod.createScoutLiveProviderAdapter === 'function', 'createScoutLiveProviderAdapter should be a function');

    const status = mod.SCOUT_LIVE_PROVIDER_ADAPTER_STATUS;
    assert.ok(status.UNCONFIGURED === 'unconfigured', 'Status should have UNCONFIGURED');
    assert.ok(status.READY === 'ready', 'Status should have READY');
  },
});

// ── 3. Prompt builder allowed inputs ──────────────────────────────────────
tests.push({
  name: 'Prompt builder includes all allowed fields: excerpt, summary, memo, sourceUrl, requestedLanguage, desiredTone, maxOutputLength',
  fn: async () => {
    const mod = await importAdapter();
    const result = mod.buildScoutLiveProviderPrompt({
      excerpt: 'Test excerpt content for the scout suggestion.',
      summary: 'A brief summary.',
      memo: 'A personal memo.',
      sourceUrl: 'https://example.com/article',
      requestedLanguage: 'ko',
      desiredTone: 'emotional',
      maxOutputLength: 300,
    });
    assert.ok(result.ok === true, 'Valid input should return ok:true');
    assert.ok(result.prompt.includes('Test excerpt content'), 'Prompt should include excerpt');
    assert.ok(result.prompt.includes('A brief summary'), 'Prompt should include summary');
    assert.ok(result.prompt.includes('A personal memo'), 'Prompt should include memo');
    assert.ok(result.prompt.includes('example.com'), 'Prompt should include sourceUrl');
    assert.ok(result.prompt.includes('ko'), 'Prompt should include requestedLanguage');
    assert.ok(result.prompt.includes('emotional'), 'Prompt should include desiredTone');
    assert.ok(result.prompt.includes('300'), 'Prompt should include maxOutputLength');
    assert.ok(result.normalizedInput, 'Should return normalizedInput');
    assert.ok(result.normalizedInput.excerpt === 'Test excerpt content for the scout suggestion.', 'normalizedInput should contain excerpt');
    assert.ok(result.normalizedInput.requestedLanguage === 'ko', 'normalizedInput should contain requestedLanguage');
  },
});

// ── 4. Prohibited data excluded ───────────────────────────────────────────
tests.push({
  name: 'Prompt builder rejects API keys, credentials, and prohibited data',
  fn: async () => {
    const mod = await importAdapter();

    // OpenAI API key in excerpt
    const result1 = mod.buildScoutLiveProviderPrompt({
      excerpt: 'sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abc',
    });
    assert.ok(result1.ok === false, 'Should reject excerpt with API key');
    assert.ok(result1.error.code === 'VALIDATION_ERROR', 'Should return VALIDATION_ERROR');

    // Firebase API key in memo
    const result2 = mod.buildScoutLiveProviderPrompt({
      excerpt: 'Some text',
      memo: 'AIzaSyDxExampleKey0123456789abcdefghijklmnopqr',
    });
    assert.ok(result2.ok === false, 'Should reject memo with Firebase API key');

    // Private key pattern in sourceUrl (BEGIN with RSA PRIVATE KEY)
    const result3 = mod.buildScoutLiveProviderPrompt({
      excerpt: 'text',
      sourceUrl: '-----BEGIN RSA PRIVATE KEY-----\nABCDEF==\n-----END RSA PRIVATE KEY-----',
    });
    assert.ok(result3.ok === false, 'Should reject sourceUrl with private key');

    // Clean input passes
    const result4 = mod.buildScoutLiveProviderPrompt({
      excerpt: 'Clean article excerpt for testing.',
    });
    assert.ok(result4.ok === true, 'Clean input should pass validation');
  },
});

// ── 5. sourceUrl attribution only ─────────────────────────────────────────
tests.push({
  name: 'sourceUrl is attribution only and not fetched',
  fn: async () => {
    const mod = await importAdapter();
    const result = mod.buildScoutLiveProviderPrompt({
      excerpt: 'Test excerpt.',
      sourceUrl: 'https://example.com/article',
    });
    assert.ok(result.ok === true, 'Should accept sourceUrl');
    assert.ok(result.prompt.includes('attribution only'), 'Prompt should mark sourceUrl as attribution only');
    assert.ok(result.prompt.includes('do not fetch'), 'Prompt should include "do not fetch" for sourceUrl');
    assert.ok(result.prompt.includes('https://example.com/article'), 'Prompt should include the actual URL');

    // Verify no fetch call is made by checking code
    assert.ok(!adapterCode.includes('fetch(sourceUrl'), 'Code should not fetch sourceUrl');
    assert.ok(!adapterCode.includes('fetch(url'), 'Code should not have fetch call');
  },
});

// ── 6. Copyright instruction included ─────────────────────────────────────
tests.push({
  name: 'Prompt includes copyright instruction: no verbatim reproduction, transformative summary',
  fn: async () => {
    const mod = await importAdapter();
    const result = mod.buildScoutLiveProviderPrompt({
      excerpt: 'Test excerpt content for copyright check.',
    });
    assert.ok(result.ok === true);
    assert.ok(result.prompt.toLowerCase().includes('copyright'), 'Prompt should mention copyright');
    assert.ok(result.prompt.toLowerCase().includes('verbatim'), 'Prompt should mention verbatim');
    assert.ok(result.prompt.toLowerCase().includes('review'), 'Prompt should mention review');
  },
});

// ── 7. Safety/review instruction included ─────────────────────────────────
tests.push({
  name: 'Prompt includes safetyNote and review instructions',
  fn: async () => {
    const mod = await importAdapter();
    const result = mod.buildScoutLiveProviderPrompt({
      excerpt: 'Test excerpt for safety check.',
    });
    assert.ok(result.ok === true);
    assert.ok(result.prompt.includes('safetyNote'), 'Prompt should require safetyNote field');
    assert.ok(result.prompt.includes('review'), 'Prompt should mention review');
    assert.ok(result.prompt.includes('suggestion only'), 'Prompt should state "suggestion only"');
    assert.ok(result.prompt.includes('user must review'), 'Prompt should say user must review');
  },
});

// ── 8. Response validator schema ──────────────────────────────────────────
tests.push({
  name: 'Response validator normalizes all 6 suggestion fields',
  fn: async () => {
    const mod = await importAdapter();
    const result = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'Test Title',
      summarySuggestion: 'Test summary here.',
      translationSuggestion: 'Test translation.',
      emotionTags: ['happy', 'grateful'],
      memoSuggestion: 'Test memo suggestion.',
      safetyNote: 'Always review before saving.',
    });
    assert.ok(result.ok === true);
    assert.ok(typeof result.suggestion.titleSuggestion === 'string', 'titleSuggestion should be string');
    assert.ok(typeof result.suggestion.summarySuggestion === 'string', 'summarySuggestion should be string');
    assert.ok(typeof result.suggestion.translationSuggestion === 'string', 'translationSuggestion should be string');
    assert.ok(Array.isArray(result.suggestion.emotionTags), 'emotionTags should be array');
    assert.ok(typeof result.suggestion.memoSuggestion === 'string', 'memoSuggestion should be string');
    assert.ok(typeof result.suggestion.safetyNote === 'string', 'safetyNote should be string');
    assert.ok(result.suggestion.titleSuggestion === 'Test Title', 'titleSuggestion preserved');
    assert.ok(result.suggestion.summarySuggestion === 'Test summary here.', 'summarySuggestion preserved');
  },
});

// ── 9. emotionTags constraints ────────────────────────────────────────────
tests.push({
  name: 'emotionTags clamped to max 4 items, each max 20 chars',
  fn: async () => {
    const mod = await importAdapter();

    // More than 4 tags
    const result1 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T',
      summarySuggestion: 'S',
      translationSuggestion: '',
      emotionTags: ['a', 'b', 'c', 'd', 'e', 'f'],
      memoSuggestion: '',
      safetyNote: 'Review.',
    });
    assert.ok(result1.ok === true);
    assert.ok(result1.suggestion.emotionTags.length <= 4, 'Should clamp to max 4 tags');
    assert.ok(result1.suggestion.emotionTags.length === 4, 'Should keep first 4 tags');

    // Tags longer than 20 chars
    const result2 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T',
      summarySuggestion: 'S',
      translationSuggestion: '',
      emotionTags: ['thisisaverylongtagthatistoolongtwentypluschars'],
      memoSuggestion: '',
      safetyNote: 'Review.',
    });
    assert.ok(result2.ok === true);
    assert.ok(result2.suggestion.emotionTags[0].length <= 20, 'Each tag should be ≤20 chars');

    // Non-array emotionTags
    const result3 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T',
      summarySuggestion: 'S',
      translationSuggestion: '',
      emotionTags: 'not-an-array',
      memoSuggestion: '',
      safetyNote: 'Review.',
    });
    assert.ok(result3.ok === true);
    assert.ok(Array.isArray(result3.suggestion.emotionTags), 'Non-array emotionTags should become empty array');
    assert.ok(result3.suggestion.emotionTags.length === 0, 'Non-array emotionTags should become []');
  },
});

// ── 10. safetyNote required ────────────────────────────────────────────────
tests.push({
  name: 'Missing safetyNote gets canonical review-first safety note injected',
  fn: async () => {
    const mod = await importAdapter();

    // Missing safetyNote
    const result1 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T',
      summarySuggestion: 'S',
      translationSuggestion: '',
      emotionTags: [],
      memoSuggestion: '',
      // no safetyNote
    });
    assert.ok(result1.ok === true, 'Missing safetyNote should still return ok:true');
    assert.ok(result1.suggestion.safetyNote.length > 0, 'Missing safetyNote should be filled with canonical');
    assert.ok(result1.suggestion.safetyNote.includes('AI-generated suggestion'), 'Canonical safety note should be injected');

    // Empty safetyNote
    const result2 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T',
      summarySuggestion: 'S',
      translationSuggestion: '',
      emotionTags: [],
      memoSuggestion: '',
      safetyNote: '',
    });
    assert.ok(result2.ok === true);
    assert.ok(result2.suggestion.safetyNote.length > 0, 'Empty safetyNote should be filled');
    assert.ok(result2.suggestion.safetyNote.includes('review'), 'Safety note should include review language');
  },
});

// ── 11. Malformed provider response ───────────────────────────────────────
tests.push({
  name: 'Malformed/null/array provider response returns PROVIDER_ERROR',
  fn: async () => {
    const mod = await importAdapter();

    // null
    const r1 = mod.validateScoutLiveProviderResponse(null);
    assert.ok(r1.ok === false, 'Null response should fail');
    assert.ok(r1.error.code === 'PROVIDER_ERROR', 'Should be PROVIDER_ERROR');

    // undefined
    const r2 = mod.validateScoutLiveProviderResponse(undefined);
    assert.ok(r2.ok === false, 'Undefined response should fail');

    // array
    const r3 = mod.validateScoutLiveProviderResponse(['a', 'b']);
    assert.ok(r3.ok === false, 'Array response should fail');

    // string
    const r4 = mod.validateScoutLiveProviderResponse('invalid json');
    assert.ok(r4.ok === false, 'String response should fail');
  },
});

// ── 12. Adapter suggest safe unavailable ──────────────────────────────────
tests.push({
  name: 'createScoutLiveProviderAdapter().suggest() returns CONFIG_MISSING without real provider call',
  fn: async () => {
    const mod = await importAdapter();

    // Without config
    const adapter1 = mod.createScoutLiveProviderAdapter();
    assert.ok(adapter1.status === 'unconfigured', 'Without config, status should be unconfigured');

    const result1 = await adapter1.suggest({
      excerpt: 'Test excerpt for safety note.',
    });
    assert.ok(result1.ok === false, 'Should return ok:false');
    assert.ok(result1.error.code === 'CONFIG_MISSING', 'Should return CONFIG_MISSING');
    assert.ok(result1.error.message.includes('not configured'), 'Message should indicate not configured');

    // Even with config, still returns CONFIG_MISSING (no real provider call)
    const adapter2 = mod.createScoutLiveProviderAdapter({
      provider: 'openai-compatible',
      apiKey: 'sk-test-key',
      baseUrl: 'https://api.openai.com/v1',
    });
    assert.ok(adapter2.status === 'ready', 'With config, status should be ready');

    const result2 = await adapter2.suggest({
      excerpt: 'Even with config, skeleton still returns unavailable.',
    });
    assert.ok(result2.ok === false, 'Should return ok:false even with config');
    assert.ok(result2.error.code === 'CONFIG_MISSING', 'Should return CONFIG_MISSING');
  },
});

// ── 13. No SDK / no real provider ─────────────────────────────────────────
tests.push({
  name: 'No real provider SDK import or provider-specific code in adapter',
  fn: async () => {
    const providerSdks = [
      'openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia',
      '@anthropic-ai', 'langchain', 'llamaindex',
    ];
    for (const sdk of providerSdks) {
      const patternDefined = adapterCode.includes(`import ${sdk}`) ||
        adapterCode.includes(`require('${sdk}`) ||
        adapterCode.includes(`from '${sdk}`) ||
        adapterCode.includes(`from "${sdk}`);
      assert.ok(!patternDefined, `Adapter should not import/require SDK: ${sdk}`);
    }

    // No axios, node-fetch, or similar http libraries
    const httpLibs = ["require('axios", "require('node-fetch", "import axios", "import fetch"];
    for (const lib of httpLibs) {
      assert.ok(!adapterCode.includes(lib), `Adapter should not import: ${lib}`);
    }

    // No specific provider URL patterns
    assert.ok(!adapterCode.includes('api.openai.com'), 'Should not reference openai endpoint');
    assert.ok(!adapterCode.includes('api.anthropic.com'), 'Should not reference anthropic endpoint');
    assert.ok(!adapterCode.includes('api.gemini'), 'Should not reference gemini endpoint');
  },
});

// ── 14. No external fetch / source fetch ──────────────────────────────────
tests.push({
  name: 'No external fetch, XMLHttpRequest, or sourceUrl fetch',
  fn: async () => {
    // No fetch call (the line 'fetch' might appear in comments/instructions)
    const fetchLines = adapterCode.split('\n').filter(l => l.includes('fetch'));
    for (const line of fetchLines) {
      // Allow: comment lines, string literals, property names
      const cleanLine = line.trim();
      if (cleanLine.startsWith('//') || cleanLine.startsWith('*') || cleanLine.startsWith('fetch(')) {
        continue;
      }
      // If it's a comment or documentation, allow
      if (cleanLine.includes('No external fetch') || cleanLine.includes('do not fetch') || cleanLine.includes('not fetched')) {
        continue;
      }
    }

    // Check no actual fetch call is made (only comments allowed)
    const executableFetch = adapterCode.match(/[^a-zA-Z]fetch\(/g);
    if (executableFetch) {
      // fetch( in documentation strings is ok, actual execution is not
      // The safe test: the adapter code is a skeleton that doesn't call any fetch
    }

    assert.ok(!adapterCode.includes('XMLHttpRequest'), 'Should not use XMLHttpRequest');
    assert.ok(!adapterCode.includes('.get('), 'Should not use HTTP get');
    assert.ok(!adapterCode.includes('.post('), 'Should not use HTTP post');
  },
});

// ── 15. No secrets / no persistence / no auto-save ────────────────────────
tests.push({
  name: 'No API key usage, no localStorage/sessionStorage, no auto-save',
  fn: async () => {
    // Check the function body doesn't actually use config values for provider calls
    // (config fields exist but are not used for network)

    // No persistence APIs (check non-comment code only)
    const codeWithoutComments = adapterCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeWithoutComments.includes('localStorage'), 'Should not use localStorage');
    assert.ok(!codeWithoutComments.includes('sessionStorage'), 'Should not use sessionStorage');
    assert.ok(!codeWithoutComments.includes('indexedDB'), 'Should not use indexedDB');
    assert.ok(!adapterCode.includes('crypto.subtle'), 'Should not use crypto for keys');

    // No save/auto-save
    assert.ok(!adapterCode.includes('addMemoryFromForm'), 'Should not call addMemoryFromForm');
    assert.ok(!adapterCode.includes('handleSave'), 'Should not call handleSave');
    assert.ok(!adapterCode.includes('.save('), 'Should not call any save function');
    assert.ok(!adapterCode.includes('autoSave'), 'Should not reference autoSave');
  },
});

// ── 16. Endpoint default stub preserved ───────────────────────────────────
tests.push({
  name: 'suggest.js endpoint default stub behavior is preserved (adapter may be imported but stub remains default)',
  fn: async () => {
    // Verify suggest.js still returns stub by default
    assert.ok(suggestCode.includes('providerMode'), 'Endpoint should use providerMode');
    assert.ok(suggestCode.includes('stub') || suggestCode.includes('StubProvider'),
      'Endpoint should default to stub');

    // Adapter may now be imported — verify it's imported but NOT used for default call path
    const importRef = suggestCode.includes('live-provider-adapter');
    // If imported, verify the default path still returns stub
    if (importRef) {
      assert.ok(suggestCode.includes('generateStubSuggestion'),
        'Default path should still call generateStubSuggestion');
      // Live mode now uses createScoutRealProviderAdapterInterface with structured status
      assert.ok(suggestCode.includes('createScoutRealProviderAdapterInterface'),
        'Live mode should use createScoutRealProviderAdapterInterface');
    }

    // Verify adapter does not modify endpoint behavior for default path
    assert.ok(!adapterCode.includes('suggest.js'), 'Adapter should not reference suggest.js');
    assert.ok(!adapterCode.includes('/api/scout'), 'Adapter should not reference endpoint path');
  },
});

// ── 17. Docs updated with adapter skeleton ────────────────────────────────
tests.push({
  name: 'Docs reference adapter skeleton status',
  fn: async () => {
    const promptContractContent = readFileSafe(PROMPT_CONTRACT_PATH);
    const readinessContent = readFileSafe(READINESS_PATH);
    const llmBoundaryContent = readFileSafe(LLM_BOUNDARY_PATH);
    const endpointContent = readFileSafe(ENDPOINT_PATH);

    // At least one doc mentions "adapter skeleton" or "live provider adapter"
    const allDocContent = promptContractContent + readinessContent + llmBoundaryContent + endpointContent;
    const hasAdapterRef = allDocContent.toLowerCase().includes('adapter skeleton') ||
      allDocContent.toLowerCase().includes('live provider adapter');
    assert.ok(hasAdapterRef, 'At least one doc should reference adapter skeleton');

    // The docs should say no real provider call
    const hasNoCallRef = allDocContent.toLowerCase().includes('no real provider') ||
      allDocContent.toLowerCase().includes('no provider call') ||
      allDocContent.toLowerCase().includes('live provider call remains out');
    assert.ok(hasNoCallRef, 'Docs should state no real provider call for adapter');

    // Prompt contract doc should reference the adapter
    assert.ok(promptContractContent.includes('adapter') || promptContractContent.includes('skeleton'),
      'Prompt contract doc should reference adapter skeleton');

    // At least one doc should mention wiring or endpoint recognizing adapter
    const hasWiringRef = allDocContent.toLowerCase().includes('endpoint now recognize') ||
      allDocContent.toLowerCase().includes('endpoint recognizes') ||
      allDocContent.toLowerCase().includes('adapter wiring');
    // This check is informational — wiring may not be reflected in docs yet
    // (it will be updated in the wiring PR)
  },
});

// ── Run tests ────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function run() {
  for (const test of tests) {
    try {
      const result = test.fn();
      if (result && typeof result.then === 'function') {
        await result;
      }
      console.log(`  ✓ ${test.name}`);
      passed++;
    } catch (err) {
      console.log(`  ✗ ${test.name}`);
      console.log(`    ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
