/**
 * Scout Live Provider Output Safety Filter Boundary Contract Tests
 * v20260606-1
 *
 * Contract tests verifying output safety filter:
 * - Safety filter exported with limits
 * - Safe output passes normalization
 * - 6 schema fields preserved
 * - Text length clamp
 * - emotionTags constraints
 * - Blank safetyNote handled
 * - Prohibited metadata fields stripped
 * - Credential-like output rejected
 * - Excessive excerpt reproduction rejected
 * - Full excerpt reproduction rejected
 * - sourceUrl raw repetition rejected
 * - Unsafe mock executor output → PROVIDER_ERROR
 * - Safe mock executor output still succeeds
 * - Logging does not leak unsafe output
 * - No SDK/no fetch/no secret/no persistence/no auto-save
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

async function importAdapter() {
  const module = await scoutEnvGuard.safeImport(ADAPTER_PATH);
  return module;
}

const tests = [];

// ── 1. Safety filter exports ────────────────────────────────────────────────
tests.push({
  name: 'Output safety filter constants and function exported',
  fn: async () => {
    const mod = await importAdapter();
    assert.ok(mod.SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS,
      'Should export SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS');
    assert.ok(typeof mod.filterScoutLiveProviderOutput === 'function',
      'Should export filterScoutLiveProviderOutput');
    // Check safety limits exist
    const limits = mod.SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS;
    assert.ok(typeof limits.maxTitleLength === 'number' && limits.maxTitleLength > 0, 'maxTitleLength should exist');
    assert.ok(typeof limits.maxSummaryLength === 'number' && limits.maxSummaryLength > 0, 'maxSummaryLength should exist');
    assert.ok(typeof limits.maxTranslationLength === 'number', 'maxTranslationLength should exist');
    assert.ok(typeof limits.maxMemoLength === 'number', 'maxMemoLength should exist');
    assert.ok(typeof limits.maxEmotionTags === 'number', 'maxEmotionTags should exist');
    assert.ok(typeof limits.maxEmotionTagLength === 'number', 'maxEmotionTagLength should exist');
  },
});

// ── 2. Safe output passes ────────────────────────────────────────────────────
tests.push({
  name: 'Normal safe mock output passes through validator with ok:true',
  fn: async () => {
    const mod = await importAdapter();
    const result = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'Safe Title',
      summarySuggestion: 'Safe summary content for the suggestion.',
      translationSuggestion: '안전한 번역 내용입니다.',
      emotionTags: ['happy', 'grateful'],
      memoSuggestion: 'Safe memo for testing.',
      safetyNote: 'Review this before saving.',
    });
    assert.ok(result.ok === true, 'Safe output should pass');
    assert.ok(result.suggestion, 'Should have suggestion');
    assert.ok(result.suggestion.titleSuggestion === 'Safe Title', 'Title preserved');
  },
});

// ── 3. Six schema fields preserved ───────────────────────────────────────────
tests.push({
  name: 'All 6 suggestion fields preserved after validation',
  fn: async () => {
    const mod = await importAdapter();
    const result = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'Schema Title',
      summarySuggestion: 'Schema summary.',
      translationSuggestion: 'Schema translation.',
      emotionTags: ['감동', '행복'],
      memoSuggestion: 'Schema memo.',
      safetyNote: 'Schema safety note.',
    });
    assert.ok(result.ok === true);
    assert.ok(result.suggestion.titleSuggestion === 'Schema Title', 'titleSuggestion');
    assert.ok(result.suggestion.summarySuggestion === 'Schema summary.', 'summarySuggestion');
    assert.ok(result.suggestion.translationSuggestion === 'Schema translation.', 'translationSuggestion');
    assert.ok(Array.isArray(result.suggestion.emotionTags), 'emotionTags should be array');
    assert.ok(result.suggestion.memoSuggestion === 'Schema memo.', 'memoSuggestion');
    assert.ok(result.suggestion.safetyNote === 'Schema safety note.', 'safetyNote');
  },
});

// ── 4. Text length clamp ─────────────────────────────────────────────────────
tests.push({
  name: 'Suggestion text fields are clamped to safety limits',
  fn: async () => {
    const mod = await importAdapter();
    const limits = mod.SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS;

    const longTitle = 'A'.repeat(limits.maxTitleLength + 100);
    const longSummary = 'B'.repeat(limits.maxSummaryLength + 100);
    const longMemo = 'C'.repeat(limits.maxMemoLength + 100);

    const result = mod.validateScoutLiveProviderResponse({
      titleSuggestion: longTitle,
      summarySuggestion: longSummary,
      translationSuggestion: '',
      emotionTags: ['test'],
      memoSuggestion: longMemo,
      safetyNote: 'Review.',
    });

    assert.ok(result.ok === true, 'Long output should still pass with clamp');
    assert.ok(result.suggestion.titleSuggestion.length <= limits.maxTitleLength,
      `title should be clamped to ${limits.maxTitleLength}`);
    assert.ok(result.suggestion.summarySuggestion.length <= limits.maxSummaryLength,
      `summary should be clamped to ${limits.maxSummaryLength}`);
    assert.ok(result.suggestion.memoSuggestion.length <= limits.maxMemoLength,
      `memo should be clamped to ${limits.maxMemoLength}`);
  },
});

// ── 5. emotionTags constraints ───────────────────────────────────────────────
tests.push({
  name: 'emotionTags constrained to max 4 items, each max 20 chars',
  fn: async () => {
    const mod = await importAdapter();
    const limits = mod.SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS;

    // More than max tags
    const tags = Array.from({ length: limits.maxEmotionTags + 5 }, (_, i) => `tag${i}`);
    const result1 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T', summarySuggestion: 'S', translationSuggestion: '',
      emotionTags: tags, memoSuggestion: '', safetyNote: 'Review.',
    });
    assert.ok(result1.ok === true);
    assert.ok(result1.suggestion.emotionTags.length <= limits.maxEmotionTags,
      `Should clamp to max ${limits.maxEmotionTags} tags`);

    // Tag longer than limit
    const longTag = ['x'.repeat(limits.maxEmotionTagLength + 10)];
    const result2 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T', summarySuggestion: 'S', translationSuggestion: '',
      emotionTags: longTag, memoSuggestion: '', safetyNote: 'Review.',
    });
    assert.ok(result2.ok === true);
    assert.ok(result2.suggestion.emotionTags[0].length <= limits.maxEmotionTagLength,
      `Each tag should be ≤${limits.maxEmotionTagLength} chars`);

    // Non-array emotionTags
    const result3 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T', summarySuggestion: 'S', translationSuggestion: '',
      emotionTags: 'not-array', memoSuggestion: '', safetyNote: 'Review.',
    });
    assert.ok(result3.ok === true);
    assert.ok(Array.isArray(result3.suggestion.emotionTags), 'Non-array should become []');
    assert.ok(result3.suggestion.emotionTags.length === 0, 'Non-array should become empty');
  },
});

// ── 6. Blank safetyNote handled ──────────────────────────────────────────────
tests.push({
  name: 'Missing/blank safetyNote gets canonical review-first note injected',
  fn: async () => {
    const mod = await importAdapter();

    // Missing
    const r1 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T', summarySuggestion: 'S', translationSuggestion: '',
      emotionTags: [], memoSuggestion: '',
    });
    assert.ok(r1.ok === true, 'Missing safetyNote should still pass');
    assert.ok(r1.suggestion.safetyNote.length > 0, 'Should be filled');
    assert.ok(r1.suggestion.safetyNote.includes('review'), 'Should include review language');

    // Empty string
    const r2 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T', summarySuggestion: 'S', translationSuggestion: '',
      emotionTags: [], memoSuggestion: '', safetyNote: '',
    });
    assert.ok(r2.ok === true);
    assert.ok(r2.suggestion.safetyNote.length > 0, 'Empty safetyNote should be filled');
  },
});

// ── 7. Prohibited metadata fields stripped ───────────────────────────────────
tests.push({
  name: 'Prohibited metadata fields (rawProviderResponse, debug, trace, log, metadata) are stripped from output',
  fn: async () => {
    const mod = await importAdapter();
    // These should be stripped by the filter (passed through to validator but removed before normalization)
    const result = mod.filterScoutLiveProviderOutput({
      titleSuggestion: 'Title',
      summarySuggestion: 'Summary.',
      translationSuggestion: '',
      emotionTags: ['test'],
      memoSuggestion: '',
      safetyNote: 'Review.',
      rawProviderResponse: { full: 'sensitive data' },
      rawModelOutput: 'raw model dump',
      debug: { info: 'debug data' },
      trace: 'trace-123',
      log: 'log entry',
      metadata: { model: 'gpt-4' },
    });

    assert.ok(result.ok === true, 'Filter should pass');
    assert.ok(result.output.rawProviderResponse === undefined, 'rawProviderResponse should be stripped');
    assert.ok(result.output.rawModelOutput === undefined, 'rawModelOutput should be stripped');
    assert.ok(result.output.debug === undefined, 'debug should be stripped');
    assert.ok(result.output.trace === undefined, 'trace should be stripped');
    assert.ok(result.output.log === undefined, 'log should be stripped');
    assert.ok(result.output.metadata === undefined, 'metadata should be stripped');
    // Safe fields preserved
    assert.ok(result.output.titleSuggestion === 'Title', 'titleSuggestion should remain');
  },
});

// ── 8. Credential-like output rejected ───────────────────────────────────────
tests.push({
  name: 'Credential-like patterns in suggestion text return PROVIDER_ERROR',
  fn: async () => {
    const mod = await importAdapter();

    // API key-like pattern in summary (matches credential patterns)
    const credPattern1 = 'author' + 'ization: ' + 'my-api-token';
    const r1 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T',
      summarySuggestion: credPattern1,
      translationSuggestion: '',
      emotionTags: [],
      memoSuggestion: '',
      safetyNote: 'Review.',
    });
    assert.ok(r1.ok === false, 'Credential pattern in summary should fail');
    assert.ok(r1.error.code === 'PROVIDER_ERROR', 'Should be PROVIDER_ERROR');

    // Bearer token in memo
    const credPattern2 = 'Token with be' + 'arer example-value';
    const r2 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T',
      summarySuggestion: 'Normal summary.',
      translationSuggestion: '',
      emotionTags: [],
      memoSuggestion: credPattern2,
      safetyNote: 'Review.',
    });
    assert.ok(r2.ok === false, 'Bearer token in memo should fail');

    // Authorization pattern in safetyNote
    const credPattern3 = 'author' + 'ization: test-token-value';
    const r3 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T',
      summarySuggestion: 'Normal summary.',
      translationSuggestion: '',
      emotionTags: [],
      memoSuggestion: 'Normal memo.',
      safetyNote: credPattern3,
    });
    assert.ok(r3.ok === false, 'Authorization pattern in safetyNote should fail');

    // Clean output passes
    const r4 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'Clean Title',
      summarySuggestion: 'Clean summary without credentials.',
      translationSuggestion: '',
      emotionTags: ['safe'],
      memoSuggestion: 'Clean memo.',
      safetyNote: 'Review before saving.',
    });
    assert.ok(r4.ok === true, 'Clean output should pass');
  },
});

// ── 9. Excessive excerpt reproduction rejected ───────────────────────────────
tests.push({
  name: 'Excessive excerpt reproduction (160+ continuous chars) in summary/memo returns PROVIDER_ERROR',
  fn: async () => {
    const mod = await importAdapter();
    const longExcerpt = 'A'.repeat(200); // 200 chars — exceeds minExcerptReproductionBlockLen (160)

    // Summary that contains the entire long excerpt
    const r1 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T',
      summarySuggestion: longExcerpt,
      translationSuggestion: '',
      emotionTags: [],
      memoSuggestion: '',
      safetyNote: 'Review.',
    }, { excerpt: longExcerpt });

    assert.ok(r1.ok === false, 'Full excerpt in summary should be rejected');
    assert.ok(r1.error.code === 'PROVIDER_ERROR', 'Should be PROVIDER_ERROR');
  },
});

// ── 10. Full excerpt reproduction rejected ───────────────────────────────────
tests.push({
  name: 'Full excerpt reproduction in combined output returns PROVIDER_ERROR',
  fn: async () => {
    const mod = await importAdapter();
    const longExcerpt = 'This is a long article excerpt that an AI provider should not reproduce verbatim in its output. '.repeat(3); // >160 chars

    // Memo that contains the excerpt
    const r1 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T',
      summarySuggestion: 'Short summary.',
      translationSuggestion: '',
      emotionTags: [],
      memoSuggestion: longExcerpt, // memo contains full excerpt
      safetyNote: 'Review.',
    }, { excerpt: longExcerpt });

    assert.ok(r1.ok === false, 'Full excerpt in memo should be rejected');
    assert.ok(r1.error.code === 'PROVIDER_ERROR', 'Should be PROVIDER_ERROR');
  },
});

// ── 11. sourceUrl raw repetition rejected ────────────────────────────────────
tests.push({
  name: 'sourceUrl raw value in suggestion text returns PROVIDER_ERROR',
  fn: async () => {
    const mod = await importAdapter();
    const sourceUrl = 'https://example.com/article-guide-12345';

    // Summary contains sourceUrl
    const r1 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T',
      summarySuggestion: 'Summary with https://example.com/article-guide-12345 in it.',
      translationSuggestion: '',
      emotionTags: [],
      memoSuggestion: '',
      safetyNote: 'Review.',
    }, { sourceUrl });

    assert.ok(r1.ok === false, 'sourceUrl in summary should be rejected');
    assert.ok(r1.error.code === 'PROVIDER_ERROR', 'Should be PROVIDER_ERROR');

    // Clean output without sourceUrl passes
    const r2 = mod.validateScoutLiveProviderResponse({
      titleSuggestion: 'T',
      summarySuggestion: 'Clean summary without URL.',
      translationSuggestion: '',
      emotionTags: [],
      memoSuggestion: '',
      safetyNote: 'Review.',
    }, { sourceUrl });
    assert.ok(r2.ok === true, 'Clean output with sourceUrl context should pass');
  },
});

// ── 12. Unsafe mock executor → PROVIDER_ERROR ────────────────────────────────
tests.push({
  name: 'Unsafe mock executor output (credential in text) maps to PROVIDER_ERROR via adapter',
  fn: async () => {
    const mod = await importAdapter();

    // Executor returns output with credential pattern in summary
    const executor = async () => ({
      titleSuggestion: 'Unsafe',
      summarySuggestion: 'author' + 'ization: my-invalid-token',
      translationSuggestion: '',
      emotionTags: [],
      memoSuggestion: '',
      safetyNote: 'Review.',
    });

    const adapter = mod.createScoutLiveProviderAdapter({ executor, timeoutMs: 500 });
    const result = await adapter.suggest({
      excerpt: 'Test excerpt for unsafe executor.',
    });

    assert.ok(result.ok === false, 'Unsafe executor output should fail');
    assert.ok(result.error.code === 'PROVIDER_ERROR', 'Should be PROVIDER_ERROR');
  },
});

// ── 13. Safe mock executor still succeeds ────────────────────────────────────
tests.push({
  name: 'Safe mock executor output still returns ok:true providerMode live_mock',
  fn: async () => {
    const mod = await importAdapter();

    const executor = async () => ({
      titleSuggestion: 'Safe Title',
      summarySuggestion: 'Safe summary without any dangerous content.',
      translationSuggestion: '',
      emotionTags: ['happy'],
      memoSuggestion: 'Safe memo.',
      safetyNote: 'Review this before saving.',
    });

    const adapter = mod.createScoutLiveProviderAdapter({ executor, timeoutMs: 500 });
    const result = await adapter.suggest({
      excerpt: 'Test excerpt for safe path.',
    });

    assert.ok(result.ok === true, 'Safe output should succeed');
    assert.ok(result.providerMode === 'live_mock', 'providerMode should be live_mock');
    assert.ok(result.suggestion.titleSuggestion === 'Safe Title', 'Title preserved');
  },
});

// ── 14. Logging does not leak unsafe output ──────────────────────────────────
tests.push({
  name: 'Safety failure logger event does not contain raw unsafe output or excerpt',
  fn: async () => {
    const mod = await importAdapter();
    const loggedEvents = [];

    const executor = async () => ({
      titleSuggestion: 'Unsafe',
      summarySuggestion: 'author' + 'ization: my-log-check-token',
      translationSuggestion: '',
      emotionTags: [],
      memoSuggestion: '',
      safetyNote: 'Review.',
    });

    const adapter = mod.createScoutLiveProviderAdapter({
      executor,
      logger: (e) => loggedEvents.push(e),
      requestId: 'req_safety_log',
      timeoutMs: 500,
    });

    await adapter.suggest({
      excerpt: 'Test excerpt for safety logging check.',
    });

    // Logger should have received at least 1 event
    assert.ok(loggedEvents.length >= 1, 'Logger should have received event');

    const event = loggedEvents[0];
    // No raw unsafe content in event
    assert.ok(event.excerpt === undefined, 'Event should not contain excerpt');
    assert.ok(event.prompt === undefined, 'Event should not contain prompt');
    assert.ok(event.sourceUrl === undefined, 'Event should not contain sourceUrl');
    assert.ok(event.titleSuggestion === undefined, 'Event should not contain titleSuggestion');
    assert.ok(event.summarySuggestion === undefined, 'Event should not contain summarySuggestion');
    assert.ok(event.apiKey === undefined, 'Event should not contain API key');
    // Safe fields
    assert.ok(event.status === 'error', 'Event status should be error');
    assert.ok(event.errorCode === 'PROVIDER_ERROR', 'Error code should be PROVIDER_ERROR');
  },
});

// ── 15. No SDK / no fetch ────────────────────────────────────────────────────
tests.push({
  name: 'No provider SDK or fetch in adapter (safety filter preserves guardrails)',
  fn: async () => {
    const providerSdks = [
      'openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia',
      '@anthropic-ai', 'langchain', 'llamaindex',
    ];
    for (const sdk of providerSdks) {
      assert.ok(!adapterCode.includes(`import ${sdk}`) &&
        !adapterCode.includes(`require('${sdk}`) &&
        !adapterCode.includes(`from '${sdk}`),
        `Should not import SDK: ${sdk}`);
    }
    assert.ok(!adapterCode.includes('api.openai.com'), 'Should not reference openai');
  },
});

// ── 16. No persistence / no auto-save ────────────────────────────────────────
tests.push({
  name: 'No localStorage/sessionStorage/auto-save (safety filter preserves guardrails)',
  fn: async () => {
    const codeWithoutComments = adapterCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeWithoutComments.includes('localStorage'), 'Should not use localStorage');
    assert.ok(!codeWithoutComments.includes('sessionStorage'), 'Should not use sessionStorage');
    assert.ok(!adapterCode.includes('addMemoryFromForm'), 'Should not call addMemoryFromForm');
    assert.ok(!adapterCode.includes('.save('), 'Should not call any save function');
  },
});

// ── 17. Endpoint default stub preserved ──────────────────────────────────────
tests.push({
  name: 'Endpoint suggest.js default path remains providerMode stub',
  fn: async () => {
    assert.ok(suggestCode.includes('generateStubSuggestion'), 'Default path should call generateStubSuggestion');
    assert.ok(suggestCode.includes("SCOUT_SUGGEST_PROVIDER_MODES.STUB") ||
      suggestCode.includes("'stub'"), 'Default endpoint path should return stub');

    // suggest.js now uses createScoutRealProviderAdapterInterface instead of createScoutLiveProviderAdapter
    const interfaceCreationLines = suggestCode.split('\n').filter(l => l.includes('createScoutRealProviderAdapterInterface'));
    for (const line of interfaceCreationLines) {
      assert.ok(!line.includes('executor'), 'suggest.js should not inject executor');
    }
  },
});

// ── 18. Docs updated ─────────────────────────────────────────────────────────
tests.push({
  name: 'Docs reference output safety filter boundary status',
  fn: async () => {
    const promptContractContent = readFileSafe(PROMPT_CONTRACT_PATH);
    const readinessContent = readFileSafe(READINESS_PATH);
    const llmBoundaryContent = readFileSafe(LLM_BOUNDARY_PATH);
    const endpointContent = readFileSafe(ENDPOINT_PATH);

    const allDocContent = promptContractContent + readinessContent + llmBoundaryContent + endpointContent;

    const hasSafetyRef = allDocContent.includes('safety filter') ||
      allDocContent.includes('output safety') ||
      allDocContent.includes('Safety Filter');
    assert.ok(hasSafetyRef, 'At least one doc should reference output safety filter');

    const hasNoRealCall = allDocContent.includes('no real provider') ||
      allDocContent.includes('no provider call');
    assert.ok(hasNoRealCall, 'Docs should state no real provider call');

    const hasStubRef = allDocContent.includes('default stub preserved') ||
      allDocContent.includes('Default stub path');
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

  console.log(`\nOutput safety filter contract: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
