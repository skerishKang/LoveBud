'use strict';

const assert = require('node:assert/strict');
const { describe, it, before } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

const ADAPTER_PATH = path.join(PROJECT_ROOT, 'functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.join(PROJECT_ROOT, 'functions/api/scout/suggest.js');
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

/**
 * Creates a deterministic mock executor for contract tests.
 * Returns a function that simulates a provider response.
 */
function createMockExecutor(rawResponse) {
  return async ({ prompt, normalizedInput }) => {
    return rawResponse;
  };
}

/**
 * Creates a safe mock output that should pass validation.
 */
function createSafeMockOutput(overrides = {}) {
  return {
    titleSuggestion: '테스트 제목',
    summarySuggestion: '테스트 요약입니다.',
    translationSuggestion: '테스트 번역입니다.',
    emotionTags: ['감동', '행복'],
    memoSuggestion: '테스트 메모입니다.',
    safetyNote: '이 제안은 자동 생성되었습니다. 저장 전 검토해 주세요.',
    ...overrides,
  };
}

describe('Scout Real Provider Mock Executor Integration Contract', () => {
  const adapterSource = readFileSafe(ADAPTER_PATH);
  const suggestSource = readFileSafe(SUGGEST_PATH);
  const sourceSelector = readFileSafe(SOURCE_SELECTOR_PATH);

  let adapter;
  before(async () => {
    adapter = await importAbsolute(ADAPTER_PATH);
  });

  // --- 1. ready_for_adapter + injected executor routes through mock pipeline ---
  it('should route through mock executor pipeline when ready and executor injected', async () => {
    const interface_ = adapter.createScoutRealProviderAdapterInterface({
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LLM_PROVIDER: 'example_provider',
      SCOUT_SUGGEST_MODEL: 'example-model',
      SCOUT_SUGGEST_LLM_API_KEY: 'sk-test-key',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      executor: createMockExecutor(createSafeMockOutput()),
    });

    assert.equal(interface_.status, 'ready_for_adapter',
      'interface should be ready_for_adapter');

    const result = await interface_.suggest({
      excerpt: '테스트 본문입니다.',
      requestedLanguage: 'ko',
      desiredTone: 'polite',
    });

    assert.ok(result.ok, 'suggest should succeed with ok:true');
    assert.equal(result.providerMode, 'live_mock', 'providerMode should be live_mock');
    assert.ok(result.suggestion, 'result should have suggestion');
    assert.ok(result.suggestion.titleSuggestion, 'suggestion should have titleSuggestion');
    assert.ok(result.suggestion.safetyNote, 'suggestion should have safetyNote');
  });

  // --- 2. ready_for_adapter without executor still safe-fails ---
  it('should safe-fail when ready_for_adapter without executor', async () => {
    const interface_ = adapter.createScoutRealProviderAdapterInterface({
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LLM_PROVIDER: 'example_provider',
      SCOUT_SUGGEST_MODEL: 'example-model',
      SCOUT_SUGGEST_LLM_API_KEY: 'sk-test-key',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    });

    assert.equal(interface_.status, 'ready_for_adapter',
      'interface should be ready_for_adapter');

    const result = await interface_.suggest({ excerpt: 'test' });
    assert.ok(!result.ok, 'suggest should fail without executor');
    assert.equal(result.error.code, 'PROVIDER_UNAVAILABLE',
      'error code should be PROVIDER_UNAVAILABLE');
  });

  // --- 3. disabled state does not run executor ---
  it('should not call executor when disabled', async () => {
    let executorCalled = false;
    const interface_ = adapter.createScoutRealProviderAdapterInterface({
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LLM_PROVIDER: 'example_provider',
      SCOUT_SUGGEST_MODEL: 'example-model',
      SCOUT_SUGGEST_LLM_API_KEY: 'sk-test-key',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'false',
      executor: async () => {
        executorCalled = true;
        return createSafeMockOutput();
      },
    });

    assert.equal(interface_.status, 'disabled',
      'interface should be disabled');
    assert.ok(!executorCalled, 'executor should not have been called');

    const result = await interface_.suggest({ excerpt: 'test' });
    assert.ok(!result.ok, 'suggest should fail when disabled');
    assert.equal(result.error.code, 'PROVIDER_UNAVAILABLE',
      'error code should be PROVIDER_UNAVAILABLE');
    assert.ok(!executorCalled, 'executor should still not have been called after suggest');
  });

  // --- 4. config_missing state does not run executor ---
  it('should not call executor when config_missing', async () => {
    let executorCalled = false;
    const interface_ = adapter.createScoutRealProviderAdapterInterface({
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      executor: async () => {
        executorCalled = true;
        return createSafeMockOutput();
      },
    });

    assert.equal(interface_.status, 'config_missing',
      'interface should be config_missing');
    assert.ok(!executorCalled, 'executor should not have been called');

    const result = await interface_.suggest({ excerpt: 'test' });
    assert.ok(!result.ok, 'suggest should fail when config_missing');
    assert.equal(result.error.code, 'CONFIG_MISSING',
      'error code should be CONFIG_MISSING');
    assert.ok(!executorCalled, 'executor should still not have been called after suggest');
  });

  // --- 5. prompt builder is used before executor ---
  it('should use prompt builder before executor', async () => {
    let receivedPayload = null;
    const interface_ = adapter.createScoutRealProviderAdapterInterface({
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LLM_PROVIDER: 'example_provider',
      SCOUT_SUGGEST_MODEL: 'example-model',
      SCOUT_SUGGEST_LLM_API_KEY: 'sk-test-key',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      executor: async (payload) => {
        receivedPayload = payload;
        return createSafeMockOutput();
      },
    });

    const input = {
      excerpt: '테스트 본문입니다.',
      sourceUrl: 'https://example.com/article',
      summary: '원본 요약',
      memo: '사용자 메모',
      requestedLanguage: 'ko',
      desiredTone: 'polite',
    };

    await interface_.suggest(input);

    assert.ok(receivedPayload, 'executor should have been called with payload');
    assert.ok(receivedPayload.prompt, 'payload should contain prompt (output of buildScoutLiveProviderPrompt)');
    assert.ok(receivedPayload.normalizedInput, 'payload should contain normalizedInput');
    assert.equal(receivedPayload.normalizedInput.excerpt, input.excerpt,
      'normalizedInput should contain the input excerpt');
  });

  // --- 6. response validator and output normalizer are used ---
  it('should normalize raw mock output through validator', async () => {
    const interface_ = adapter.createScoutRealProviderAdapterInterface({
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LLM_PROVIDER: 'example_provider',
      SCOUT_SUGGEST_MODEL: 'example-model',
      SCOUT_SUGGEST_LLM_API_KEY: 'sk-test-key',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      executor: createMockExecutor(createSafeMockOutput({
        titleSuggestion: '  공백 제목 테스트  ',
        summarySuggestion: '  요약 공백  ',
      })),
    });

    const result = await interface_.suggest({
      excerpt: '테스트 본문입니다.',
      requestedLanguage: 'ko',
      desiredTone: 'polite',
    });

    assert.ok(result.ok, 'suggest should succeed');
    // Validator should trim whitespace
    assert.equal(result.suggestion.titleSuggestion, '공백 제목 테스트',
      'title should be trimmed');
    assert.equal(result.suggestion.summarySuggestion, '요약 공백',
      'summary should be trimmed');
  });

  // --- 7. output safety filter is used ---
  it('should apply output safety filter', async () => {
    // Excessive excerpt reproduction must be rejected
    const longExcerpt = 'A'.repeat(200);
    const interface_ = adapter.createScoutRealProviderAdapterInterface({
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LLM_PROVIDER: 'example_provider',
      SCOUT_SUGGEST_MODEL: 'example-model',
      SCOUT_SUGGEST_LLM_API_KEY: 'sk-test-key',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      executor: createMockExecutor(createSafeMockOutput({
        summarySuggestion: longExcerpt, // excessive reproduction
      })),
    });

    const result = await interface_.suggest({
      excerpt: longExcerpt,
      requestedLanguage: 'ko',
      desiredTone: 'polite',
    });

    assert.ok(!result.ok, 'suggest should fail due to safety filter');
    assert.equal(result.error.code, 'PROVIDER_ERROR',
      'error code should be PROVIDER_ERROR for unsafe output');
  });

  // --- 8. timeout/retry boundary is used ---
  it('should trigger timeout when executor hangs', async () => {
    const interface_ = adapter.createScoutRealProviderAdapterInterface({
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LLM_PROVIDER: 'example_provider',
      SCOUT_SUGGEST_MODEL: 'example-model',
      SCOUT_SUGGEST_LLM_API_KEY: 'sk-test-key',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      SCOUT_SUGGEST_TIMEOUT_MS: '50',
      executor: async () => {
        // Never resolves — should timeout
        await new Promise(() => {});
      },
    });

    const result = await interface_.suggest({
      excerpt: '테스트 본문입니다.',
      requestedLanguage: 'ko',
      desiredTone: 'polite',
    });

    assert.ok(!result.ok, 'suggest should fail due to timeout');
    assert.equal(result.error.code, 'PROVIDER_ERROR',
      'error code should be PROVIDER_ERROR for timeout');
  });

  // --- 9. logging boundary remains sanitized ---
  it('should send sanitized events to injected logger', async () => {
    const logEvents = [];
    const interface_ = adapter.createScoutRealProviderAdapterInterface({
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LLM_PROVIDER: 'example_provider',
      SCOUT_SUGGEST_MODEL: 'example-model',
      SCOUT_SUGGEST_LLM_API_KEY: 'sk-test-key',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      requestId: 'test-req-001',
      executor: createMockExecutor(createSafeMockOutput()),
      logger: (event) => {
        logEvents.push(event);
      },
    });

    const input = {
      excerpt: '본문 내용입니다.',
      sourceUrl: 'https://example.com',
      requestedLanguage: 'ko',
      desiredTone: 'polite',
    };

    await interface_.suggest(input);

    assert.ok(logEvents.length > 0, 'logger should have received events');
    for (const event of logEvents) {
      // Check allowed fields present
      assert.ok('requestId' in event, 'event should have requestId');
      assert.ok('providerMode' in event, 'event should have providerMode');
      assert.ok('status' in event, 'event should have status');
      // Check prohibited fields absent for success events
      if (event.status === 'success') {
        assert.ok(!('prompt' in event), 'event should not contain prompt');
        assert.ok(!('excerpt' in event), 'event should not contain excerpt');
        assert.ok(!('summary' in event), 'event should not contain summary');
      }
    }
  });

  // --- 10. API key value never reaches executor ---
  it('should not pass API key value in executor payload', async () => {
    let receivedPayload = null;
    const interface_ = adapter.createScoutRealProviderAdapterInterface({
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LLM_PROVIDER: 'example_provider',
      SCOUT_SUGGEST_MODEL: 'example-model',
      SCOUT_SUGGEST_LLM_API_KEY: 'sk-test-secret-value-12345',
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      executor: async (payload) => {
        receivedPayload = payload;
        return createSafeMockOutput();
      },
    });

    const input = {
      excerpt: '테스트 본문입니다.',
      requestedLanguage: 'ko',
      desiredTone: 'polite',
    };

    await interface_.suggest(input);

    assert.ok(receivedPayload, 'executor should have been called');
    const payloadStr = JSON.stringify(receivedPayload);
    assert.ok(!payloadStr.includes('sk-test-secret-value-12345'),
      'executor payload should not contain raw API key value');
    assert.ok(!payloadStr.includes('apiKey'),
      'executor payload should not contain apiKey field');
  });

  // --- 11. API key value never appears in adapter result or logs ---
  it('should not leak API key value in result or logs', async () => {
    const logEvents = [];
    const apiKey = 'sk-test-secret-value-67890';
    const interface_ = adapter.createScoutRealProviderAdapterInterface({
      SCOUT_SUGGEST_PROVIDER_MODE: 'live',
      SCOUT_SUGGEST_LLM_PROVIDER: 'example_provider',
      SCOUT_SUGGEST_MODEL: 'example-model',
      SCOUT_SUGGEST_LLM_API_KEY: apiKey,
      SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
      executor: createMockExecutor(createSafeMockOutput()),
      logger: (event) => {
        logEvents.push(event);
      },
    });

    const input = {
      excerpt: '테스트 본문입니다.',
      requestedLanguage: 'ko',
      desiredTone: 'polite',
    };

    const result = await interface_.suggest(input);
    const resultStr = JSON.stringify(result);

    // Result should not contain the API key value
    assert.ok(!resultStr.includes(apiKey),
      'result should not contain raw API key value');

    // Log events should not contain the API key value
    for (const event of logEvents) {
      const eventStr = JSON.stringify(event);
      assert.ok(!eventStr.includes(apiKey),
        'log events should not contain raw API key value');
    }
  });

  // --- 12. no provider SDK imports ---
  it('should not have provider SDK imports', () => {
    const allCode = adapterSource + ' ' + suggestSource;
    const prohibitedSdks = ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia'];
    for (const sdk of prohibitedSdks) {
      const importPattern = new RegExp(`(import|require).*['"\`]${sdk}`);
      assert.ok(!importPattern.test(allCode),
        `should not import/require "${sdk}" SDK`);
    }
  });

  // --- 13. no fetch/XHR/axios ---
  it('should not contain fetch, XMLHttpRequest, or axios', () => {
    const combinedCode = adapterSource + ' ' + suggestSource;
    const codeWOComments = combinedCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeWOComments.includes('fetch('),
      'should not have executable fetch calls');
    assert.ok(!codeWOComments.includes('XMLHttpRequest'),
      'should not have XMLHttpRequest');
    assert.ok(!codeWOComments.includes('axios'),
      'should not have axios');
  });

  // --- 14. no sourceUrl fetch/crawler/metadata extraction ---
  it('should not fetch sourceUrl', () => {
    const combinedCode = adapterSource + ' ' + suggestSource;
    assert.ok(!combinedCode.includes("fetch(sourceUrl") && !combinedCode.includes("fetch(source_url"),
      'should not fetch sourceUrl');
  });

  // --- 15. endpoint default stub preserved ---
  it('should keep endpoint default stub', () => {
    assert.ok(suggestSource.includes('generateStubSuggestion'),
      'suggest.js should have generateStubSuggestion');
    assert.ok(suggestSource.includes('STUB'),
      'suggest.js should reference STUB mode');
  });

  // --- 16. frontend default local_stub preserved ---
  it('should preserve frontend default local_stub', () => {
    assert.ok(sourceSelector.includes('local_stub'),
      'source selector should default to local_stub');
  });

  // --- 17. existing createScoutLiveProviderAdapter export remains ---
  it('should keep createScoutLiveProviderAdapter exported', () => {
    assert.ok(adapterSource.includes('createScoutLiveProviderAdapter'),
      'adapter should still export createScoutLiveProviderAdapter');
    assert.ok(suggestSource.includes('createScoutLiveProviderAdapter'),
      'suggest.js should still import createScoutLiveProviderAdapter');
  });

  // --- 18. docs updated ---
  it('should have mock-only integration boundary reflected in docs', () => {
    const checklistDoc = readFileSafe(CHECKLIST_DOC_PATH);
    const readinessAudit = readFileSafe(READINESS_AUDIT_PATH);
    const promptDoc = readFileSafe(PROMPT_RESPONSE_DOC_PATH);
    const serverlessDoc = readFileSafe(SERVERLESS_DOC_PATH);
    const llmDoc = readFileSafe(LLM_BOUNDARY_DOC_PATH);

    const allDocs = checklistDoc + ' ' + readinessAudit + ' ' + promptDoc + ' ' + serverlessDoc + ' ' + llmDoc;
    const docLower = allDocs.toLowerCase();
    // At least one doc should reference mock-only integration
    assert.ok(
      docLower.includes('mock executor') ||
      docLower.includes('mock-only') ||
      docLower.includes('mock pipeline'),
      'at least one existing doc should reference mock-only integration'
    );
    // At least one doc should mention ready_for_adapter
    assert.ok(
      docLower.includes('ready_for_adapter') ||
      docLower.includes('ready for adapter'),
      'at least one doc should mention ready_for_adapter'
    );
  });
});
