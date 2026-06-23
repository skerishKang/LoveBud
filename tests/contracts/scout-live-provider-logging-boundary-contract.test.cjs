/**
 * Scout Live Provider Adapter Logging Boundary Contract Tests
 * v20260606-1
 *
 * Contract tests verifying safe logging/observability:
 * - Logging helper exports
 * - Allowed fields retained, prohibited fields redacted
 * - prompt/excerpt/memo/sourceUrl/secret/token redaction
 * - Nested prohibited fields redaction
 * - Logger receives sanitized success/error/config-missing events
 * - Logger throw is swallowed safely
 * - No raw provider response/suggestion text in log events
 * - No provider SDK / no fetch / no persistence / no auto-save
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

// ── 1. Logging helper exports ───────────────────────────────────────────────
tests.push({
  name: 'Logging helper exports exist',
  fn: async () => {
    const mod = await importAdapter();
    assert.ok(typeof mod.createScoutLiveProviderLogEvent === 'function',
      'Should export createScoutLiveProviderLogEvent');
    assert.ok(typeof mod.sanitizeScoutLiveProviderLogPayload === 'function',
      'Should export sanitizeScoutLiveProviderLogPayload');
  },
});

// ── 2. Allowed fields retained ───────────────────────────────────────────────
tests.push({
  name: 'Allowed safe fields retained in sanitized payload',
  fn: async () => {
    const mod = await importAdapter();
    const payload = {
      requestId: 'req_test_001',
      providerMode: 'live_mock',
      status: 'success',
      errorCode: '',
      latencyMs: 123,
      inputLength: 456,
      outputFieldCount: 3,
      emotionTagCount: 2,
      hasSourceUrl: true,
      language: 'ko',
      tone: 'polite',
      timestamp: '2026-06-06T00:00:00.000Z',
    };

    const sanitized = mod.sanitizeScoutLiveProviderLogPayload(payload);

    assert.ok(sanitized.requestId === 'req_test_001', 'requestId should be preserved');
    assert.ok(sanitized.providerMode === 'live_mock', 'providerMode should be preserved');
    assert.ok(sanitized.status === 'success', 'status should be preserved');
    assert.ok(sanitized.errorCode === '', 'errorCode should be preserved');
    assert.ok(sanitized.latencyMs === 123, 'latencyMs should be preserved');
    assert.ok(sanitized.inputLength === 456, 'inputLength should be preserved');
    assert.ok(sanitized.outputFieldCount === 3, 'outputFieldCount should be preserved');
    assert.ok(sanitized.emotionTagCount === 2, 'emotionTagCount should be preserved');
    assert.ok(sanitized.hasSourceUrl === true, 'hasSourceUrl should be preserved');
    assert.ok(sanitized.language === 'ko', 'language should be preserved');
    assert.ok(sanitized.tone === 'polite', 'tone should be preserved');
    assert.ok(sanitized.timestamp === '2026-06-06T00:00:00.000Z', 'timestamp should be preserved');
  },
});

// ── 3. prompt/excerpt/memo redacted ──────────────────────────────────────────
tests.push({
  name: 'Prompt, excerpt, summary, memo text fields are redacted from sanitized payload',
  fn: async () => {
    const mod = await importAdapter();
    const payload = {
      requestId: 'req_002',
      prompt: 'You are helping draft a LoveBud Scout suggestion...',
      excerpt: 'This is a long article excerpt that should not be logged.',
      summary: 'Brief summary of the article.',
      memo: 'Personal memo about this content.',
      providerMode: 'live_mock',
      status: 'success',
    };

    const sanitized = mod.sanitizeScoutLiveProviderLogPayload(payload);

    // Prohibited fields should be removed entirely
    assert.ok(sanitized.prompt === undefined, 'prompt should be removed');
    assert.ok(sanitized.excerpt === undefined, 'excerpt should be removed');
    assert.ok(sanitized.summary === undefined, 'summary should be removed');
    assert.ok(sanitized.memo === undefined, 'memo should be removed');

    // Safe fields should remain
    assert.ok(sanitized.requestId === 'req_002', 'requestId should remain');
    assert.ok(sanitized.providerMode === 'live_mock', 'providerMode should remain');
    assert.ok(sanitized.status === 'success', 'status should remain');
  },
});

// ── 4. sourceUrl raw value redacted ──────────────────────────────────────────
tests.push({
  name: 'sourceUrl raw value is redacted — only hasSourceUrl boolean allowed',
  fn: async () => {
    const mod = await importAdapter();
    const payload = {
      requestId: 'req_003',
      sourceUrl: 'https://example.com/secret-article',
      hasSourceUrl: true,
      providerMode: 'live_mock',
    };

    const sanitized = mod.sanitizeScoutLiveProviderLogPayload(payload);

    assert.ok(sanitized.sourceUrl === undefined, 'sourceUrl raw value should be removed');
    assert.ok(sanitized.hasSourceUrl === true, 'hasSourceUrl boolean should remain');
    assert.ok(sanitized.requestId === 'req_003', 'requestId should remain');
  },
});

// ── 5. Secret/token fields redacted ──────────────────────────────────────────
tests.push({
  name: 'API key, auth token, session, cookie, secret fields are redacted',
  fn: async () => {
    const mod = await importAdapter();
    const payload = {
      requestId: 'req_004',
      apiKey: 'sk-this-is-a-test-key-12345',
      API_KEY: 'AIzaSy-test-key-here',
      authorization: 'Bearer sk-test-token',
      Authorization: 'Bearer sk-test-token',
      bearer: 'my-bearer-token',
      token: 'ghp_xxxxtokenvalue',
      session: 'session-id-xxx',
      cookie: 'sessionid=abc123',
      firebaseCredential: '{"type":"service_account"}',
      uid: 'user-123',
      email: 'test@example.com',
      phone: '+821012345678',
      password: 'hunter2',
      secret: 'my-secret-value',
      providerMode: 'live_mock',
      status: 'error',
      errorCode: 'CONFIG_MISSING',
    };

    const sanitized = mod.sanitizeScoutLiveProviderLogPayload(payload);

    // All prohibited credential/token fields should be removed
    assert.ok(sanitized.apiKey === undefined, 'apiKey should be removed');
    assert.ok(sanitized.API_KEY === undefined, 'API_KEY should be removed');
    assert.ok(sanitized.authorization === undefined, 'authorization should be removed');
    assert.ok(sanitized.Authorization === undefined, 'Authorization should be removed');
    assert.ok(sanitized.bearer === undefined, 'bearer should be removed');
    assert.ok(sanitized.token === undefined, 'token should be removed');
    assert.ok(sanitized.session === undefined, 'session should be removed');
    assert.ok(sanitized.cookie === undefined, 'cookie should be removed');
    assert.ok(sanitized.firebaseCredential === undefined, 'firebaseCredential should be removed');
    assert.ok(sanitized.uid === undefined, 'uid should be removed');
    assert.ok(sanitized.email === undefined, 'email should be removed');
    assert.ok(sanitized.phone === undefined, 'phone should be removed');
    assert.ok(sanitized.password === undefined, 'password should be removed');
    assert.ok(sanitized.secret === undefined, 'secret should be removed');

    // Safe fields should remain
    assert.ok(sanitized.requestId === 'req_004', 'requestId should remain');
    assert.ok(sanitized.providerMode === 'live_mock', 'providerMode should remain');
    assert.ok(sanitized.errorCode === 'CONFIG_MISSING', 'errorCode should remain');
  },
});

// ── 6. Nested prohibited fields redacted ─────────────────────────────────────
tests.push({
  name: 'Nested object and array with prohibited fields are redacted recursively',
  fn: async () => {
    const mod = await importAdapter();
    const payload = {
      requestId: 'req_005',
      status: 'error',
      nested: {
        apiKey: 'sk-nested-key',
        token: 'nested-token',
        safeField: 'keep-me',
      },
      items: [
        { excerpt: 'nested excerpt', titleSuggestion: 'nested title' },
        { safeItem: 'keep-this' },
      ],
      providerMode: 'live_mock',
    };

    const sanitized = mod.sanitizeScoutLiveProviderLogPayload(payload);

    // Safe fields on root should remain
    assert.ok(sanitized.requestId === 'req_005', 'requestId should remain');
    assert.ok(sanitized.status === 'error', 'status should remain');

    // Nested object should have prohibited fields removed
    assert.ok(sanitized.nested, 'nested object should exist');
    assert.ok(sanitized.nested.apiKey === undefined, 'nested apiKey should be removed');
    assert.ok(sanitized.nested.token === undefined, 'nested token should be removed');
    assert.ok(sanitized.nested.safeField === 'keep-me', 'nested safeField should remain');

    // Array items should have prohibited fields removed
    assert.ok(Array.isArray(sanitized.items), 'items should remain as array');
    assert.ok(sanitized.items.length === 2, 'items length should be preserved');
    assert.ok(sanitized.items[0].excerpt === undefined, 'array item excerpt should be removed');
    assert.ok(sanitized.items[0].titleSuggestion === undefined, 'array item titleSuggestion should be removed');
    assert.ok(sanitized.items[1].safeItem === 'keep-this', 'array item safe field should remain');
  },
});

// ── 7. Logger receives sanitized success event ───────────────────────────────
tests.push({
  name: 'Logger receives sanitized event on successful mock execution',
  fn: async () => {
    const mod = await importAdapter();
    const loggedEvents = [];

    const executor = async () => ({
      titleSuggestion: 'Success Title',
      summarySuggestion: 'Success summary.',
      translationSuggestion: '',
      emotionTags: ['happy', 'grateful'],
      memoSuggestion: 'Success memo.',
      safetyNote: 'Review before saving.',
    });

    const adapter = mod.createScoutLiveProviderAdapter({
      executor,
      logger: (event) => loggedEvents.push(event),
      requestId: 'req_success_001',
    });

    const result = await adapter.suggest({
      excerpt: 'Test excerpt for success log.',
    });

    assert.ok(result.ok === true, 'Suggestion should succeed');

    // Should have logged exactly one event
    assert.ok(loggedEvents.length >= 1, 'Logger should have received at least 1 event');

    const event = loggedEvents[0];
    assert.ok(event.requestId === 'req_success_001', 'Event should have requestId');
    assert.ok(event.providerMode === 'live_mock', 'Event should have providerMode: live_mock');
    assert.ok(event.status === 'success', 'Event should have status: success');
    assert.ok(event.errorCode === '', 'Error event should have empty errorCode');
    assert.ok(typeof event.latencyMs === 'number' && event.latencyMs >= 0, 'latencyMs should be a non-negative number');
    assert.ok(typeof event.inputLength === 'number' && event.inputLength >= 0, 'inputLength should be a non-negative number');
    assert.ok(typeof event.outputFieldCount === 'number', 'outputFieldCount should be a number');
    assert.ok(typeof event.emotionTagCount === 'number', 'emotionTagCount should be a number');
    assert.ok(typeof event.hasSourceUrl === 'boolean', 'hasSourceUrl should be a boolean');
    assert.ok(typeof event.language === 'string', 'language should be a string');
    assert.ok(typeof event.tone === 'string', 'tone should be a string');
    assert.ok(typeof event.timestamp === 'string', 'timestamp should be a string');

    // Verify no prohibited fields in the event
    assert.ok(event.prompt === undefined, 'Event should not contain prompt');
    assert.ok(event.excerpt === undefined, 'Event should not contain excerpt');
    assert.ok(event.sourceUrl === undefined, 'Event should not contain sourceUrl');
    assert.ok(event.apiKey === undefined, 'Event should not contain apiKey');
    assert.ok(event.token === undefined, 'Event should not contain token');
    assert.ok(event.titleSuggestion === undefined, 'Event should not contain titleSuggestion');
    assert.ok(event.summarySuggestion === undefined, 'Event should not contain summarySuggestion');
    assert.ok(event.memoSuggestion === undefined, 'Event should not contain memoSuggestion');
    assert.ok(event.rawProviderResponse === undefined, 'Event should not contain rawProviderResponse');
  },
});

// ── 8. Logger receives sanitized error event ─────────────────────────────────
tests.push({
  name: 'Logger receives sanitized PROVIDER_ERROR event on executor throw',
  fn: async () => {
    const mod = await importAdapter();
    const loggedEvents = [];

    const throwingExecutor = async () => {
      throw new Error('Simulated failure');
    };

    const adapter = mod.createScoutLiveProviderAdapter({
      executor: throwingExecutor,
      logger: (event) => loggedEvents.push(event),
      requestId: 'req_error_001',
    });

    const result = await adapter.suggest({
      excerpt: 'Test excerpt for error log.',
    });

    assert.ok(result.ok === false, 'Should fail');
    assert.ok(result.error.code === 'PROVIDER_ERROR', 'Should be PROVIDER_ERROR');

    assert.ok(loggedEvents.length >= 1, 'Logger should have received at least 1 event');

    const event = loggedEvents[0];
    assert.ok(event.status === 'error', 'Event should have status: error');
    assert.ok(event.errorCode === 'PROVIDER_ERROR', 'Event should have errorCode: PROVIDER_ERROR');
    assert.ok(event.providerMode === 'live_mock', 'Event should have providerMode: live_mock');

    // No prohibited fields
    assert.ok(event.prompt === undefined, 'Event should not contain prompt');
    assert.ok(event.excerpt === undefined, 'Event should not contain excerpt');
    assert.ok(event.sourceUrl === undefined, 'Event should not contain sourceUrl');
    assert.ok(event.apiKey === undefined, 'Event should not contain apiKey');
  },
});

// ── 9. Missing executor logs safe CONFIG_MISSING event ───────────────────────
tests.push({
  name: 'Missing executor path logs safe CONFIG_MISSING event with no secret leakage',
  fn: async () => {
    const mod = await importAdapter();
    const loggedEvents = [];

    const adapter = mod.createScoutLiveProviderAdapter({
      logger: (event) => loggedEvents.push(event),
      requestId: 'req_config_001',
    });

    const result = await adapter.suggest({
      excerpt: 'Test excerpt for config missing log.',
    });

    assert.ok(result.ok === false, 'Should return ok:false');
    assert.ok(result.error.code === 'CONFIG_MISSING', 'Should be CONFIG_MISSING');

    assert.ok(loggedEvents.length >= 1, 'Logger should have received at least 1 event');

    const event = loggedEvents[0];
    assert.ok(event.status === 'error', 'Event should have status: error');
    assert.ok(event.errorCode === 'CONFIG_MISSING', 'Event should have errorCode: CONFIG_MISSING');
    assert.ok(event.providerMode === 'config_missing', 'Event should have providerMode: config_missing');

    // No secret leakage
    assert.ok(event.apiKey === undefined, 'Event should not leak apiKey');
    assert.ok(event.secret === undefined, 'Event should not leak secret');
    assert.ok(event.token === undefined, 'Event should not leak token');
  },
});

// ── 10. Logger throw is swallowed ────────────────────────────────────────────
tests.push({
  name: 'Logger throw is safely swallowed — suggest() result not broken',
  fn: async () => {
    const mod = await importAdapter();

    const executor = async () => ({
      titleSuggestion: 'Logger throw test',
      summarySuggestion: 'Summary.',
      translationSuggestion: '',
      emotionTags: ['test'],
      memoSuggestion: 'Memo.',
      safetyNote: 'Review.',
    });

    let throwCount = 0;
    const throwingLogger = () => {
      throwCount++;
      throw new Error('Logger crash');
    };

    const adapter = mod.createScoutLiveProviderAdapter({
      executor,
      logger: throwingLogger,
      requestId: 'req_throw_001',
    });

    // Should not throw — logger crash is swallowed
    const result = await adapter.suggest({
      excerpt: 'Test excerpt for logger throw.',
    });

    assert.ok(result.ok === true, 'Suggestion should succeed despite logger throw');
    assert.ok(throwCount >= 1, 'Logger should have been called and thrown');
  },
});

// ── 11. No raw provider response / suggestion text logged ────────────────────
tests.push({
  name: 'Raw provider response and suggestion text fields not logged',
  fn: async () => {
    const mod = await importAdapter();

    const loggedEvents = [];
    const executor = async () => ({
      titleSuggestion: 'Title',
      summarySuggestion: 'Summary content here',
      translationSuggestion: '번역 결과',
      emotionTags: ['happy'],
      memoSuggestion: 'Memo text content',
      safetyNote: 'Review before saving.',
    });

    const adapter = mod.createScoutLiveProviderAdapter({
      executor,
      logger: (event) => loggedEvents.push(event),
      requestId: 'req_raw_001',
    });

    await adapter.suggest({
      excerpt: 'Test excerpt for raw check.',
    });

    const event = loggedEvents[0];
    assert.ok(event.rawProviderResponse === undefined, 'rawProviderResponse should not be logged');
    assert.ok(event.rawModelOutput === undefined, 'rawModelOutput should not be logged');
    assert.ok(event.titleSuggestion === undefined, 'titleSuggestion should not be logged');
    assert.ok(event.summarySuggestion === undefined, 'summarySuggestion should not be logged');
    assert.ok(event.translationSuggestion === undefined, 'translationSuggestion should not be logged');
    assert.ok(event.memoSuggestion === undefined, 'memoSuggestion should not be logged');
    assert.ok(event.safetyNote === undefined, 'safetyNote should not be logged');
  },
});

// ── 12. No provider SDK / no fetch ───────────────────────────────────────────
tests.push({
  name: 'No provider SDK import or fetch in live-provider-adapter.js (logging boundary preserves guardrails)',
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

    const httpLibs = ["require('axios", "require('node-fetch", "import axios", "import fetch"];
    for (const lib of httpLibs) {
      assert.ok(!adapterCode.includes(lib), `Adapter should not import: ${lib}`);
    }

    assert.ok(!adapterCode.includes('api.openai.com'), 'Should not reference openai endpoint');
    assert.ok(!adapterCode.includes('api.anthropic.com'), 'Should not reference anthropic endpoint');
    assert.ok(!adapterCode.includes('api.gemini'), 'Should not reference gemini endpoint');
  },
});

// ── 13. No persistence / no auto-save ────────────────────────────────────────
tests.push({
  name: 'No localStorage/sessionStorage, no auto-save in adapter (logging boundary preserves guardrails)',
  fn: async () => {
    const codeWithoutComments = adapterCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!codeWithoutComments.includes('localStorage'), 'Should not use localStorage');
    assert.ok(!codeWithoutComments.includes('sessionStorage'), 'Should not use sessionStorage');
    assert.ok(!codeWithoutComments.includes('indexedDB'), 'Should not use indexedDB');
    assert.ok(!adapterCode.includes('addMemoryFromForm'), 'Should not call addMemoryFromForm');
    assert.ok(!adapterCode.includes('handleSave'), 'Should not call handleSave');
    assert.ok(!adapterCode.includes('.save('), 'Should not call any save function');
    assert.ok(!adapterCode.includes('autoSave'), 'Should not reference autoSave');
  },
});

// ── 14. Endpoint default stub preserved ──────────────────────────────────────
tests.push({
  name: 'Endpoint suggest.js default path remains providerMode stub — no logger/executor injected in default path',
  fn: async () => {
    assert.ok(suggestCode.includes('generateStubSuggestion'), 'Default path should call generateStubSuggestion');
    assert.ok(suggestCode.includes("SCOUT_SUGGEST_PROVIDER_MODES.STUB") ||
      suggestCode.includes("'stub'"), 'Default endpoint path should return stub providerMode');

    // suggest.js now uses createScoutRealProviderAdapterInterface instead of createScoutLiveProviderAdapter
    // Verify the live mode branch does NOT inject executor or logger
    const interfaceCreationLines = suggestCode.split('\n').filter(l => l.includes('createScoutRealProviderAdapterInterface'));
    for (const line of interfaceCreationLines) {
      assert.ok(!line.includes('executor'), 'suggest.js should not inject executor');
      assert.ok(!line.includes('logger'), 'suggest.js should not inject logger');
    }
  },
});

// ── 15. Docs updated ─────────────────────────────────────────────────────────
tests.push({
  name: 'Docs reference logging boundary status',
  fn: async () => {
    const promptContractContent = readFileSafe(PROMPT_CONTRACT_PATH);
    const readinessContent = readFileSafe(READINESS_PATH);
    const llmBoundaryContent = readFileSafe(LLM_BOUNDARY_PATH);
    const endpointContent = readFileSafe(ENDPOINT_PATH);

    const allDocContent = promptContractContent + readinessContent + llmBoundaryContent + endpointContent;

    // At least one doc references "logging boundary" or "safe logging"
    const hasLoggingRef = allDocContent.includes('logging boundary') ||
      allDocContent.includes('safe logging') ||
      allDocContent.includes('observability');
    assert.ok(hasLoggingRef, 'At least one doc should reference logging boundary');

    // Docs should state safe observability fields only
    const hasSafeFieldsRef = allDocContent.includes('safe observability') ||
      allDocContent.includes('observability fields') ||
      allDocContent.includes('Allowed log fields');
    assert.ok(hasSafeFieldsRef, 'Docs should reference safe observability fields');

    // Docs should state no real provider call
    const hasNoRealCall = allDocContent.includes('no real provider') ||
      allDocContent.includes('no provider call');
    assert.ok(hasNoRealCall, 'Docs should state no real provider call');

    // Docs should state endpoint default remains stub
    const hasStubRef = allDocContent.includes('default stub preserved') ||
      allDocContent.includes('Default stub path') ||
      allDocContent.includes('stub behavior is preserved');
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

  console.log(`\nLogging boundary contract: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
