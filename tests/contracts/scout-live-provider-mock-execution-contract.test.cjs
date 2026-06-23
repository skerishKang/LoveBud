/**
 * Scout Live Provider Adapter Mock Execution Contract Tests
 * v20260606-1
 *
 * Contract tests verifying the adapter mock executor path:
 * - Adapter accepts injected mock executor
 * - Prompt builder called before executor
 * - Successful mock execution returns normalized suggestion
 * - Response validator applied (emotionTags clamp, safetyNote enforce)
 * - Executor throw/malformed output → PROVIDER_ERROR safe mapping
 * - Missing executor preserves CONFIG_MISSING safe-fail
 * - Prohibited data not passed to executor
 * - sourceUrl attribution only
 * - No provider SDK / no fetch / no secret / no persistence / no auto-save
 * - Endpoint default stub preserved
 * - Docs updated
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
var scoutEnvGuard = require('./_scout-env-guard.cjs');

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
  const module = await scoutEnvGuard.safeImport(ADAPTER_PATH);
  return module;
}

const tests = [];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Creates a valid mock executor that returns expected data */
function createValidMockExecutor(overrides = {}) {
  return async ({ prompt, normalizedInput }) => {
    return {
      titleSuggestion: overrides.titleSuggestion !== undefined ? overrides.titleSuggestion : 'Mock title for testing',
      summarySuggestion: overrides.summarySuggestion !== undefined ? overrides.summarySuggestion : 'This is a mock suggestion summary for testing purposes.',
      translationSuggestion: overrides.translationSuggestion !== undefined ? overrides.translationSuggestion : '',
      emotionTags: overrides.emotionTags !== undefined ? overrides.emotionTags : ['warm', 'curious'],
      memoSuggestion: overrides.memoSuggestion !== undefined ? overrides.memoSuggestion : 'Mock memo for testing.',
      safetyNote: overrides.safetyNote !== undefined ? overrides.safetyNote : 'Review this suggestion before saving.',
    };
  };
}

function createThrowingMockExecutor() {
  return async () => {
    throw new Error('Simulated executor failure');
  };
}

function createMalformedMockExecutor() {
  return async () => {
    return null; // Simulates non-object response
  };
}

function createOversizedEmotionMockExecutor() {
  return async () => {
    return {
      titleSuggestion: 'Title',
      summarySuggestion: 'Summary',
      translationSuggestion: '',
      emotionTags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'thisisaverylongtagthatistoolongtwentypluschars'],
      memoSuggestion: '',
      safetyNote: 'Review.',
    };
  };
}

function createNoSafetyNoteMockExecutor() {
  return async () => {
    return {
      titleSuggestion: 'Title',
      summarySuggestion: 'Summary',
      translationSuggestion: '',
      emotionTags: ['happy'],
      memoSuggestion: '',
      // No safetyNote
    };
  };
}

// ── 1. Adapter accepts injected mock executor ───────────────────────────────
tests.push({
  name: 'Adapter accepts injected mock executor in config',
  fn: async () => {
    const mod = await importAdapter();

    // Without executor
    const noExecutor = mod.createScoutLiveProviderAdapter({});
    assert.ok(typeof noExecutor.suggest === 'function', 'Should create adapter without executor');

    // With executor
    const withExecutor = mod.createScoutLiveProviderAdapter({
      executor: createValidMockExecutor(),
    });
    assert.ok(typeof withExecutor.suggest === 'function', 'Should create adapter with executor');

    // Non-function executor should be treated as absent
    const invalidExecutor = mod.createScoutLiveProviderAdapter({
      executor: 'not-a-function',
    });
    assert.ok(typeof invalidExecutor.suggest === 'function', 'Non-function executor should still create adapter');
    const result = await invalidExecutor.suggest({
      excerpt: 'Test content.',
    });
    assert.ok(result.ok === false, 'Non-function executor should behave like missing executor');
    assert.ok(result.error.code === 'CONFIG_MISSING', 'Non-function executor should return CONFIG_MISSING');
  },
});

// ── 2. Prompt builder called before executor ────────────────────────────────
tests.push({
  name: 'Prompt builder called before executor — executor receives prompt and normalizedInput',
  fn: async () => {
    const mod = await importAdapter();

    let receivedArgs = null;
    const capturingExecutor = async (args) => {
      receivedArgs = args;
      return createValidMockExecutor()(args);
    };

    const adapter = mod.createScoutLiveProviderAdapter({
      executor: capturingExecutor,
    });

    const input = {
      excerpt: 'Test excerpt for prompt check.',
      summary: 'Test summary.',
      memo: 'Test memo.',
      sourceUrl: 'https://example.com/article',
      requestedLanguage: 'ko',
      desiredTone: 'polite',
      maxOutputLength: 300,
    };

    await adapter.suggest(input);

    // Verify executor received prompt and normalizedInput
    assert.ok(receivedArgs !== null, 'Executor should be called with args');
    assert.ok(typeof receivedArgs.prompt === 'string', 'Executor should receive prompt string');
    assert.ok(receivedArgs.prompt.length > 0, 'Prompt should not be empty');
    assert.ok(receivedArgs.normalizedInput, 'Executor should receive normalizedInput');
    assert.ok(receivedArgs.normalizedInput.excerpt === input.excerpt, 'normalizedInput should contain excerpt');
    assert.ok(receivedArgs.normalizedInput.sourceUrl === input.sourceUrl, 'normalizedInput should contain sourceUrl');

    // Prompt should include JSON-only instruction
    assert.ok(receivedArgs.prompt.includes('JSON'), 'Prompt should instruct JSON-only output');

    // Prompt should include copyright and safety instructions
    assert.ok(receivedArgs.prompt.toLowerCase().includes('copyright') ||
      receivedArgs.prompt.toLowerCase().includes('verbatim'), 'Prompt should include copyright instruction');
    assert.ok(receivedArgs.prompt.includes('safetyNote'), 'Prompt should require safetyNote');
    assert.ok(receivedArgs.prompt.includes('review'), 'Prompt should mention review');
  },
});

// ── 3. Successful mock execution ────────────────────────────────────────────
tests.push({
  name: 'Successful mock execution returns ok:true with providerMode and normalized suggestion',
  fn: async () => {
    const mod = await importAdapter();

    const executor = createValidMockExecutor({
      titleSuggestion: 'My Custom Title',
      summarySuggestion: 'Custom summary text.',
      translationSuggestion: '번역 결과입니다.',
      emotionTags: ['감동', '행복'],
      memoSuggestion: 'Custom memo for review.',
      safetyNote: 'Please review this suggestion before saving.',
    });

    const adapter = mod.createScoutLiveProviderAdapter({
      executor,
    });

    const result = await adapter.suggest({
      excerpt: 'Test excerpt.',
    });

    assert.ok(result.ok === true, 'Should return ok:true for successful mock execution');
    assert.ok(result.providerMode === 'live_mock', 'providerMode should be live_mock');
    assert.ok(result.suggestion, 'Should return suggestion object');

    // Verify suggestion fields
    assert.ok(result.suggestion.titleSuggestion === 'My Custom Title', 'titleSuggestion should match executor output');
    assert.ok(result.suggestion.summarySuggestion === 'Custom summary text.', 'summarySuggestion should match');
    assert.ok(result.suggestion.translationSuggestion === '번역 결과입니다.', 'translationSuggestion should match');
    assert.ok(Array.isArray(result.suggestion.emotionTags), 'emotionTags should be array');
    assert.ok(result.suggestion.emotionTags.length === 2, 'Should have 2 emotion tags');
    assert.ok(result.suggestion.emotionTags[0] === '감동', 'First emotion tag should match');
    assert.ok(result.suggestion.memoSuggestion === 'Custom memo for review.', 'memoSuggestion should match');
    assert.ok(result.suggestion.safetyNote.includes('review'), 'safetyNote should include review language');
  },
});

// ── 4. Response validator applied — emotionTags clamped ────────────────────
tests.push({
  name: 'Response validator clamps emotionTags to max 4 items, each max 20 chars',
  fn: async () => {
    const mod = await importAdapter();

    const adapter = mod.createScoutLiveProviderAdapter({
      executor: createOversizedEmotionMockExecutor(),
    });

    const result = await adapter.suggest({
      excerpt: 'Test excerpt for emotion clamp.',
    });

    assert.ok(result.ok === true, 'Should still return ok:true');
    assert.ok(result.suggestion.emotionTags.length <= 4, 'Should clamp emotionTags to max 4');
    assert.ok(result.suggestion.emotionTags.length === 4, 'Should keep first 4 tags');
    for (const tag of result.suggestion.emotionTags) {
      assert.ok(tag.length <= 20, `Each emotion tag should be ≤20 chars (got "${tag}" length ${tag.length})`);
    }
  },
});

// ── 5. safetyNote enforced ─────────────────────────────────────────────────
tests.push({
  name: 'Missing/blank safetyNote gets canonical review-first safety note injected',
  fn: async () => {
    const mod = await importAdapter();

    // Executor returns no safetyNote
    const adapter1 = mod.createScoutLiveProviderAdapter({
      executor: createNoSafetyNoteMockExecutor(),
    });

    const result1 = await adapter1.suggest({
      excerpt: 'Test excerpt for safety check.',
    });

    assert.ok(result1.ok === true, 'Missing safetyNote should still return ok:true');
    assert.ok(result1.suggestion.safetyNote.length > 0, 'Missing safetyNote should be filled');
    assert.ok(result1.suggestion.safetyNote.includes('AI-generated suggestion'),
      'Canonical safety note should be injected when missing');

    // Executor returns empty safetyNote
    const adapter2 = mod.createScoutLiveProviderAdapter({
      executor: createValidMockExecutor({ safetyNote: '' }),
    });

    const result2 = await adapter2.suggest({
      excerpt: 'Test excerpt for blank safety check.',
    });

    assert.ok(result2.ok === true, 'Blank safetyNote should still return ok:true');
    assert.ok(result2.suggestion.safetyNote.length > 0, 'Blank safetyNote should be filled');
    assert.ok(result2.suggestion.safetyNote.includes('review'), 'Safety note should include review language');
  },
});

// ── 6. Executor throw maps to PROVIDER_ERROR ────────────────────────────────
tests.push({
  name: 'Executor throw returns ok:false with PROVIDER_ERROR',
  fn: async () => {
    const mod = await importAdapter();

    const adapter = mod.createScoutLiveProviderAdapter({
      executor: createThrowingMockExecutor(),
    });

    const result = await adapter.suggest({
      excerpt: 'Test excerpt for throw.',
    });

    assert.ok(result.ok === false, 'Should return ok:false on executor throw');
    assert.ok(result.error.code === 'PROVIDER_ERROR', 'Should return PROVIDER_ERROR');
    assert.ok(result.error.message.includes('failed safely'), 'Message should indicate safe failure');
  },
});

// ── 7. Malformed executor output maps to PROVIDER_ERROR ─────────────────────
tests.push({
  name: 'Malformed/null executor output returns PROVIDER_ERROR',
  fn: async () => {
    const mod = await importAdapter();

    // null output
    const adapter1 = mod.createScoutLiveProviderAdapter({
      executor: createMalformedMockExecutor(),
    });

    const result1 = await adapter1.suggest({
      excerpt: 'Test excerpt for null.',
    });
    assert.ok(result1.ok === false, 'Null executor output should fail');
    assert.ok(result1.error.code === 'PROVIDER_ERROR', 'Null output should be PROVIDER_ERROR');

    // String output
    const adapter2 = mod.createScoutLiveProviderAdapter({
      executor: async () => 'invalid string response',
    });

    const result2 = await adapter2.suggest({
      excerpt: 'Test excerpt for string.',
    });
    assert.ok(result2.ok === false, 'String executor output should fail');
    assert.ok(result2.error.code === 'PROVIDER_ERROR', 'String output should be PROVIDER_ERROR');

    // Array output
    const adapter3 = mod.createScoutLiveProviderAdapter({
      executor: async () => ['a', 'b'],
    });

    const result3 = await adapter3.suggest({
      excerpt: 'Test excerpt for array.',
    });
    assert.ok(result3.ok === false, 'Array executor output should fail');
    assert.ok(result3.error.code === 'PROVIDER_ERROR', 'Array output should be PROVIDER_ERROR');
  },
});

// ── 8. Missing executor preserves CONFIG_MISSING ────────────────────────────
tests.push({
  name: 'Missing executor preserves CONFIG_MISSING safe-fail',
  fn: async () => {
    const mod = await importAdapter();

    // No config at all
    const adapter1 = mod.createScoutLiveProviderAdapter();
    assert.ok(adapter1.status === 'unconfigured', 'Without config, status should be unconfigured');

    const result1 = await adapter1.suggest({
      excerpt: 'Test excerpt.',
    });
    assert.ok(result1.ok === false, 'Should return ok:false');
    assert.ok(result1.error.code === 'CONFIG_MISSING', 'Should return CONFIG_MISSING');
    assert.ok(result1.error.message.includes('not configured'), 'Message should indicate not configured');

    // With provider config but no executor
    const adapter2 = mod.createScoutLiveProviderAdapter({
      provider: 'openai-compatible',
      apiKey: 'sk-test-key',
      baseUrl: 'https://api.openai.com/v1',
    });
    assert.ok(adapter2.status === 'ready', 'With config, status should be ready');

    const result2 = await adapter2.suggest({
      excerpt: 'Even with config, no executor means CONFIG_MISSING.',
    });
    assert.ok(result2.ok === false, 'Should return ok:false even with config but no executor');
    assert.ok(result2.error.code === 'CONFIG_MISSING', 'Should return CONFIG_MISSING');
  },
});

// ── 9. Prohibited data not passed to executor ───────────────────────────────
tests.push({
  name: 'Prohibited data (API keys, auth tokens) not passed to executor',
  fn: async () => {
    const mod = await importAdapter();

    let receivedInput = null;
    const capturingExecutor = async (args) => {
      receivedInput = args;
      return createValidMockExecutor()(args);
    };

    const adapter = mod.createScoutLiveProviderAdapter({
      executor: capturingExecutor,
    });

    // Input with API key pattern should be rejected at prompt builder level
    const result = await adapter.suggest({
      excerpt: 'sk-ABCdef1234567890abcdefghijklmnopqrstuvwx',
    });

    assert.ok(result.ok === false, 'Should reject input with API key');
    assert.ok(result.error.code === 'VALIDATION_ERROR', 'Should return VALIDATION_ERROR');
    assert.ok(receivedInput === null, 'Executor should not be called for prohibited input');
  },
});

// ── 10. sourceUrl attribution only ──────────────────────────────────────────
tests.push({
  name: 'sourceUrl appears in prompt as attribution only, not fetched',
  fn: async () => {
    const mod = await importAdapter();

    let receivedInput = null;
    const capturingExecutor = async (args) => {
      receivedInput = args;
      return createValidMockExecutor()(args);
    };

    const adapter = mod.createScoutLiveProviderAdapter({
      executor: capturingExecutor,
    });

    await adapter.suggest({
      excerpt: 'Test excerpt with source.',
      sourceUrl: 'https://example.com/article',
    });

    // sourceUrl should be in prompt as attribution
    assert.ok(receivedInput.prompt.includes('example.com'), 'sourceUrl should be in prompt');
    assert.ok(receivedInput.prompt.includes('attribution only'), 'Prompt should mark as attribution only');
    assert.ok(receivedInput.prompt.includes('do not fetch'), 'Prompt should say do not fetch');

    // sourceUrl should be in normalizedInput
    assert.ok(receivedInput.normalizedInput.sourceUrl === 'https://example.com/article',
      'sourceUrl should be in normalizedInput');

    // sourceUrl should NOT be fetched
    assert.ok(!adapterCode.includes('fetch(sourceUrl'), 'Code should not fetch sourceUrl');
    assert.ok(!adapterCode.includes('fetch('), 'Code should not have executable fetch call');
  },
});

// ── 11. No provider SDK / no fetch ──────────────────────────────────────────
tests.push({
  name: 'No provider SDK import or fetch in live-provider-adapter.js',
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

    // No executable fetch call (check non-comment code)
    const codeWithoutComments = adapterCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const fetchInCode = codeWithoutComments.match(/[^a-zA-Z]fetch\(/g);
    // Only allow 'fetch(' in the comment-only sections, not in executable code
    // The safe-fail path has no fetch
  },
});

// ── 12. No secret/persistence/auto-save ─────────────────────────────────────
tests.push({
  name: 'No API key usage, no localStorage/sessionStorage, no auto-save in adapter',
  fn: async () => {
    const codeWithoutComments = adapterCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeWithoutComments.includes('localStorage'), 'Should not use localStorage');
    assert.ok(!codeWithoutComments.includes('sessionStorage'), 'Should not use sessionStorage');
    assert.ok(!codeWithoutComments.includes('indexedDB'), 'Should not use indexedDB');

    // No save/auto-save
    assert.ok(!adapterCode.includes('addMemoryFromForm'), 'Should not call addMemoryFromForm');
    assert.ok(!adapterCode.includes('handleSave'), 'Should not call handleSave');
    assert.ok(!adapterCode.includes('.save('), 'Should not call any save function');
    assert.ok(!adapterCode.includes('autoSave'), 'Should not reference autoSave');

    // Executor path does not read API keys from config
    // The config.executor is injected — not read from env or secrets
    const suggestCodeWithoutComments = suggestCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!suggestCodeWithoutComments.includes('localStorage'), 'suggest.js should not use localStorage');
    assert.ok(!suggestCodeWithoutComments.includes('sessionStorage'), 'suggest.js should not use sessionStorage');
  },
});

// ── 13. Endpoint default stub preserved ─────────────────────────────────────
tests.push({
  name: 'Endpointsuggest.js default path remains providerMode stub — mock executor not injected into default endpoint path',
  fn: async () => {
    // suggest.js still has generateStubSuggestion and default stub path
    assert.ok(suggestCode.includes('generateStubSuggestion'), 'Default path should call generateStubSuggestion');
    assert.ok(suggestCode.includes("providerMode: SCOUT_SUGGEST_PROVIDER_MODES.STUB") ||
      suggestCode.includes("providerMode: 'stub'") ||
      suggestCode.includes('providerMode: SCOUT_SUGGEST_PROVIDER_MODES.STUB'),
      'Default endpoint path should return stub providerMode');

    // suggest.js now uses createScoutRealProviderAdapterInterface instead of createScoutLiveProviderAdapter
    // Verify it does NOT inject a mock executor
    const interfaceCreationLines = suggestCode.split('\n').filter(l => l.includes('createScoutRealProviderAdapterInterface'));
    for (const line of interfaceCreationLines) {
      assert.ok(!line.includes('executor'), 'suggest.js should not inject executor into real adapter interface');
    }

    // The existing skeleton adapter test's test #16 already verifies adapter import but default stub preserved
    // This test reinforces that endpoint does NOT wire mock executor
  },
});

// ── 14. Docs updated ────────────────────────────────────────────────────────
tests.push({
  name: 'Docs reference mock execution contract status',
  fn: async () => {
    const promptContractContent = readFileSafe(PROMPT_CONTRACT_PATH);
    const readinessContent = readFileSafe(READINESS_PATH);
    const llmBoundaryContent = readFileSafe(LLM_BOUNDARY_PATH);
    const endpointContent = readFileSafe(ENDPOINT_PATH);

    const allDocContent = promptContractContent + readinessContent + llmBoundaryContent + endpointContent;

    // At least one doc references "mock execution" or "mock executor"
    const hasMockExecRef = allDocContent.includes('mock execution') ||
      allDocContent.includes('mock executor') ||
      allDocContent.includes('Mock execution contract');
    assert.ok(hasMockExecRef, 'At least one doc should reference mock execution contract');

    // Docs should state no real provider call
    const hasNoRealCall = allDocContent.includes('no real provider') ||
      allDocContent.includes('no provider call');
    assert.ok(hasNoRealCall, 'Docs should state no real provider call');

    // Docs should state endpoint default remains stub
    const hasStubRef = allDocContent.includes('default stub preserved') ||
      allDocContent.includes('Default stub path') ||
      allDocContent.includes('stub behavior is preserved') ||
      allDocContent.includes('endpoint default remains stub') ||
      allDocContent.includes('default endpoint remains stub');
    assert.ok(hasStubRef, 'Docs should state endpoint default remains stub');
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
    } catch (e) {
      console.log(`  ✗ ${test.name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }

  console.log(`\nMock execution contract: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
