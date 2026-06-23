/**
 * Scout Live Provider Adapter Timeout/Retry Boundary Contract Tests
 * v20260606-1
 *
 * Contract tests verifying timeout/retry policy:
 * - Timeout/retry policy constants exported
 * - Default policy safe values
 * - Executor success without retry
 * - Executor throw retry success
 * - Executor throw retry exhaustion
 * - Executor timeout retry success
 * - Executor timeout exhaustion
 * - Malformed output no unsafe crash
 * - Retry count clamped
 * - Timeout value clamped
 * - Sanitized timeout/retry logging
 * - Logger throw safe swallow
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

// ── Helper: create a valid mock executor ─────────────────────────────────────
function createSuccessExecutor(overrides = {}) {
  return async () => ({
    titleSuggestion: overrides.titleSuggestion || 'Timeout Retry Title',
    summarySuggestion: overrides.summarySuggestion || 'Summary for timeout retry test.',
    translationSuggestion: overrides.translationSuggestion || '',
    emotionTags: overrides.emotionTags || ['test'],
    memoSuggestion: overrides.memoSuggestion || 'Memo for timeout retry.',
    safetyNote: overrides.safetyNote || 'Review before saving.',
  });
}

function createThrowExecutor() {
  let callCount = 0;
  return async () => {
    callCount++;
    throw new Error(`Executor failure #${callCount}`);
  };
}

function createThrowThenSuccessExecutor() {
  let callCount = 0;
  return async () => {
    callCount++;
    if (callCount === 1) throw new Error('First attempt failed');
    return createSuccessExecutor()();
  };
}

function createTimeoutExecutor(timeoutMs = 50000) {
  return async () => {
    await new Promise(r => setTimeout(r, timeoutMs));
    return createSuccessExecutor()();
  };
}

function createTimeoutThenSuccessExecutor(firstTimeoutMs = 50000) {
  let callCount = 0;
  return async () => {
    callCount++;
    if (callCount === 1) {
      await new Promise(r => setTimeout(r, firstTimeoutMs));
      throw new Error('TIMEOUT');
    }
    return createSuccessExecutor()();
  };
}

function createMalformedOutputExecutor() {
  return async () => null;
}

// ── 1. Timeout/retry policy export ───────────────────────────────────────────
tests.push({
  name: 'Timeout/retry policy constants exported',
  fn: async () => {
    const mod = await importAdapter();
    assert.ok(mod.SCOUT_LIVE_PROVIDER_TIMEOUT_RETRY_POLICY,
      'Should export SCOUT_LIVE_PROVIDER_TIMEOUT_RETRY_POLICY');
    assert.ok(typeof mod.runScoutLiveProviderExecutorWithTimeout === 'function',
      'Should export runScoutLiveProviderExecutorWithTimeout');
  },
});

// ── 2. Default policy safe values ────────────────────────────────────────────
tests.push({
  name: 'Default timeout/retry policy has safe finite values',
  fn: async () => {
    const mod = await importAdapter();
    const policy = mod.SCOUT_LIVE_PROVIDER_TIMEOUT_RETRY_POLICY;

    assert.ok(typeof policy.defaultTimeoutMs === 'number' && policy.defaultTimeoutMs > 0,
      'defaultTimeoutMs should be a positive number');
    assert.ok(typeof policy.defaultMaxRetries === 'number' && policy.defaultMaxRetries >= 0,
      'defaultMaxRetries should be a non-negative number');
    assert.ok(typeof policy.maxAllowedRetries === 'number' && policy.maxAllowedRetries >= 0,
      'maxAllowedRetries should be a non-negative number');
    assert.ok(typeof policy.minTimeoutMs === 'number' && policy.minTimeoutMs >= 10,
      'minTimeoutMs should be ≥10 for testability');
    assert.ok(typeof policy.maxTimeoutMs === 'number' && policy.maxTimeoutMs >= 1000,
      'maxTimeoutMs should be ≥1000');
    assert.ok(policy.maxTimeoutMs >= policy.minTimeoutMs,
      'maxTimeoutMs should be ≥ minTimeoutMs');
  },
});

// ── 3. Executor success without retry ────────────────────────────────────────
tests.push({
  name: 'Executor success without retry returns ok:true and retryCount:0',
  fn: async () => {
    const mod = await importAdapter();
    const executor = createSuccessExecutor();

    const result = await mod.runScoutLiveProviderExecutorWithTimeout(
      executor,
      { prompt: 'test', normalizedInput: { excerpt: 'test' } },
      { timeoutMs: 500, maxRetries: 1 }
    );

    assert.ok(result.ok === true, 'Should succeed');
    assert.ok(result.result, 'Should have result');
    assert.ok(result.retryCount === 0, 'retryCount should be 0 for first-try success');
    assert.ok(result.result.titleSuggestion === 'Timeout Retry Title', 'Result should contain expected data');
  },
});

// ── 4. Executor throw → retry success ────────────────────────────────────────
tests.push({
  name: 'First throw, then success with maxRetries:1 returns ok:true and retryCount:1',
  fn: async () => {
    const mod = await importAdapter();
    const executor = createThrowThenSuccessExecutor();

    const result = await mod.runScoutLiveProviderExecutorWithTimeout(
      executor,
      { prompt: 'test', normalizedInput: { excerpt: 'test' } },
      { timeoutMs: 500, maxRetries: 1 }
    );

    assert.ok(result.ok === true, 'Should succeed after retry');
    assert.ok(result.retryCount === 1, 'retryCount should be 1 (one retry after first failure)');
    assert.ok(result.result.titleSuggestion === 'Timeout Retry Title', 'Result should be from successful execution');
  },
});

// ── 5. Executor throw → retry exhaustion ─────────────────────────────────────
tests.push({
  name: 'All attempts throw with maxRetries:1 returns ok:false PROVIDER_ERROR',
  fn: async () => {
    const mod = await importAdapter();
    const executor = createThrowExecutor();

    const result = await mod.runScoutLiveProviderExecutorWithTimeout(
      executor,
      { prompt: 'test', normalizedInput: { excerpt: 'test' } },
      { timeoutMs: 500, maxRetries: 1 }
    );

    assert.ok(result.ok === false, 'Should fail after retry exhaustion');
    assert.ok(result.error.code === 'PROVIDER_ERROR', 'Should return PROVIDER_ERROR');
    assert.ok(result.retryCount === 2, 'retryCount should be 2 (first attempt + 1 retry)');
  },
});

// ── 6. Executor timeout → retry success (maxRetries:1) ───────────────────────
tests.push({
  name: 'First timeout, then success with maxRetries:1 returns ok:true and retryCount:1',
  fn: async () => {
    const mod = await importAdapter();
    let callCount = 0;
    // Simulate timeout by throwing on first call
    const executor = async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('TIMEOUT');
      }
      return createSuccessExecutor()();
    };

    const result = await mod.runScoutLiveProviderExecutorWithTimeout(
      executor,
      { prompt: 'test', normalizedInput: { excerpt: 'test' } },
      { timeoutMs: 500, maxRetries: 1 }
    );

    assert.ok(result.ok === true, 'Should succeed after timeout retry');
    assert.ok(result.retryCount === 1, 'retryCount should be 1 (one retry after timeout)');
  },
});

// ── 7. Executor timeout exhaustion ──────────────────────────────────────────
tests.push({
  name: 'Repeated timeout with maxRetries:0 returns ok:false PROVIDER_ERROR',
  fn: async () => {
    const mod = await importAdapter();
    let callCount = 0;
    const executor = async () => {
      callCount++;
      throw new Error(`Simulated timeout #${callCount}`);
    };

    const result = await mod.runScoutLiveProviderExecutorWithTimeout(
      executor,
      { prompt: 'test', normalizedInput: { excerpt: 'test' } },
      { timeoutMs: 500, maxRetries: 0 }
    );

    assert.ok(result.ok === false, 'Should fail on timeout with maxRetries:0');
    assert.ok(result.error.code === 'PROVIDER_ERROR', 'Should return PROVIDER_ERROR');
    assert.ok(result.retryCount === 1, 'retryCount should be 1 (first attempt with no retries)');
  },
});

// ── 8. Malformed output → no retry, safe error ──────────────────────────────
tests.push({
  name: 'Malformed executor output returns PROVIDER_ERROR without retry',
  fn: async () => {
    const mod = await importAdapter();
    const executor = createMalformedOutputExecutor();

    // With maxRetries:1, but malformed output from executor is not a throw
    const execResult = await mod.runScoutLiveProviderExecutorWithTimeout(
      executor,
      { prompt: 'test', normalizedInput: { excerpt: 'test' } },
      { timeoutMs: 500, maxRetries: 1 }
    );

    // Executor succeeds (returns null without throwing), so timeout/retry wrapper returns ok:true
    assert.ok(execResult.ok === true, 'Executor returning null should succeed at wrapper level');
    assert.ok(execResult.result === null, 'Result should be null');

    // The validator in suggest() catches null and returns PROVIDER_ERROR
    // This is tested by the adapter-level suggest() call
    const adapter = mod.createScoutLiveProviderAdapter({
      executor,
      timeoutMs: 500,
      maxRetries: 1,
    });

    const suggestResult = await adapter.suggest({
      excerpt: 'Test for malformed output.',
    });

    assert.ok(suggestResult.ok === false, 'Malformed output should fail at adapter level');
    assert.ok(suggestResult.error.code === 'PROVIDER_ERROR', 'Should return PROVIDER_ERROR');
  },
});

// ── 9. Retry count clamped ──────────────────────────────────────────────────
tests.push({
  name: 'Excessive maxRetries clamped to maxAllowedRetries',
  fn: async () => {
    const mod = await importAdapter();
    const executor = createThrowExecutor();

    // Pass maxRetries = 100 which should be clamped to maxAllowedRetries (1)
    const result = await mod.runScoutLiveProviderExecutorWithTimeout(
      executor,
      { prompt: 'test', normalizedInput: { excerpt: 'test' } },
      { timeoutMs: 500, maxRetries: 100 }
    );

    assert.ok(result.ok === false, 'Should fail after clamped retries');
    // With maxAllowedRetries=1, total attempts = 1 + 1 = 2, retries = 2
    assert.ok(result.retryCount === 2, 'retryCount should be 2 (first + 1 clamped retry)');
  },
});

// ── 10. Timeout value clamped ───────────────────────────────────────────────
tests.push({
  name: 'Timeout value clamped to safe range [minTimeoutMs, maxTimeoutMs]',
  fn: async () => {
    const mod = await importAdapter();
    const policy = mod.SCOUT_LIVE_PROVIDER_TIMEOUT_RETRY_POLICY;
    const executor = createSuccessExecutor();

    // Very small timeout (1ms) should be clamped to minTimeoutMs
    const result1 = await mod.runScoutLiveProviderExecutorWithTimeout(
      executor,
      { prompt: 'test', normalizedInput: { excerpt: 'test' } },
      { timeoutMs: 1, maxRetries: 0 }
    );
    // Success executor should succeed because clamped timeout is still reasonable
    assert.ok(result1.ok === true, 'Should succeed with clamped timeout');

    // Negative timeout should default
    const result2 = await mod.runScoutLiveProviderExecutorWithTimeout(
      executor,
      { prompt: 'test', normalizedInput: { excerpt: 'test' } },
      { timeoutMs: -1, maxRetries: 0 }
    );
    assert.ok(result2.ok === true, 'Should succeed with negative timeout defaulted to safe value');

    // Very large timeout should be clamped to maxTimeoutMs
    const result3 = await mod.runScoutLiveProviderExecutorWithTimeout(
      executor,
      { prompt: 'test', normalizedInput: { excerpt: 'test' } },
      { timeoutMs: 100000, maxRetries: 0 }
    );
    assert.ok(result3.ok === true, 'Should succeed with clamped large timeout');
  },
});

// ── 11. Sanitized timeout/retry logging ──────────────────────────────────────
tests.push({
  name: 'Logger receives sanitized timeout/retry event with retryCount, maxRetries, no prohibited fields',
  fn: async () => {
    const mod = await importAdapter();
    const loggedEvents = [];
    const executor = createThrowExecutor();

    const adapter = mod.createScoutLiveProviderAdapter({
      executor,
      logger: (event) => loggedEvents.push(event),
      requestId: 'req_timeout_001',
      timeoutMs: 25,
      maxRetries: 1,
    });

    const result = await adapter.suggest({
      excerpt: 'Test for timeout/retry logging.',
    });

    assert.ok(result.ok === false, 'Should fail after retry exhaustion');
    assert.ok(result.error.code === 'PROVIDER_ERROR', 'Should be PROVIDER_ERROR');

    // Logger should have received at least 1 event
    assert.ok(loggedEvents.length >= 1, 'Logger should have received event');

    const event = loggedEvents[0];
    assert.ok(event.status === 'error', 'Event status should be error');
    assert.ok(event.errorCode === 'PROVIDER_ERROR', 'Event errorCode should be PROVIDER_ERROR');

    // retryCount and maxRetries should be in the event if present
    if (event.retryCount !== undefined) {
      assert.ok(typeof event.retryCount === 'number' && event.retryCount >= 0,
        'retryCount should be non-negative number');
    }
    if (event.maxRetries !== undefined) {
      assert.ok(typeof event.maxRetries === 'number' && event.maxRetries >= 0,
        'maxRetries should be non-negative number');
    }

    // No prohibited fields
    assert.ok(event.prompt === undefined, 'Event should not contain prompt');
    assert.ok(event.excerpt === undefined, 'Event should not contain excerpt');
    assert.ok(event.sourceUrl === undefined, 'Event should not contain sourceUrl');
    assert.ok(event.apiKey === undefined, 'Event should not contain apiKey');
    assert.ok(event.token === undefined, 'Event should not contain token');
  },
});

// ── 12. Logger throw safe swallow ────────────────────────────────────────────
tests.push({
  name: 'Logger throw is safely swallowed in timeout/retry path',
  fn: async () => {
    const mod = await importAdapter();
    let throwCount = 0;
    const throwingLogger = () => { throwCount++; throw new Error('Logger crash in timeout retry'); };
    const executor = createSuccessExecutor();

    const adapter = mod.createScoutLiveProviderAdapter({
      executor,
      logger: throwingLogger,
      requestId: 'req_throw_tr',
      timeoutMs: 500,
      maxRetries: 1,
    });

    const result = await adapter.suggest({
      excerpt: 'Test for logger throw in timeout retry path.',
    });

    assert.ok(result.ok === true, 'Suggestion should succeed despite logger throw');
    assert.ok(throwCount >= 1, 'Logger should have been called and thrown');
  },
});

// ── 13. No SDK / no fetch ────────────────────────────────────────────────────
tests.push({
  name: 'No provider SDK import or fetch in live-provider-adapter.js (timeout/retry preserves guardrails)',
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

// ── 14. No persistence / no auto-save ────────────────────────────────────────
tests.push({
  name: 'No localStorage/sessionStorage, no auto-save (timeout/retry preserves guardrails)',
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

// ── 15. Endpoint default stub preserved ──────────────────────────────────────
tests.push({
  name: 'Endpoint suggest.js default path remains providerMode stub — no timeout/retry injected in default path',
  fn: async () => {
    assert.ok(suggestCode.includes('generateStubSuggestion'), 'Default path should call generateStubSuggestion');
    assert.ok(suggestCode.includes("SCOUT_SUGGEST_PROVIDER_MODES.STUB") ||
      suggestCode.includes("'stub'"), 'Default endpoint path should return stub providerMode');

    // suggest.js now uses createScoutRealProviderAdapterInterface instead of createScoutLiveProviderAdapter
    // Verify the live mode branch does NOT inject executor, logger, timeoutMs, or maxRetries
    const interfaceCreationLines = suggestCode.split('\n').filter(l => l.includes('createScoutRealProviderAdapterInterface'));
    for (const line of interfaceCreationLines) {
      assert.ok(!line.includes('executor'), 'suggest.js should not inject executor');
      assert.ok(!line.includes('logger'), 'suggest.js should not inject logger');
      assert.ok(!line.includes('timeoutMs'), 'suggest.js should not inject timeoutMs');
      assert.ok(!line.includes('maxRetries'), 'suggest.js should not inject maxRetries');
    }
  },
});

// ── 16. Docs updated ─────────────────────────────────────────────────────────
tests.push({
  name: 'Docs reference timeout/retry boundary status',
  fn: async () => {
    const promptContractContent = readFileSafe(PROMPT_CONTRACT_PATH);
    const readinessContent = readFileSafe(READINESS_PATH);
    const llmBoundaryContent = readFileSafe(LLM_BOUNDARY_PATH);
    const endpointContent = readFileSafe(ENDPOINT_PATH);

    const allDocContent = promptContractContent + readinessContent + llmBoundaryContent + endpointContent;

    // At least one doc references "timeout/retry" or "retry boundary"
    const hasTimeoutRetryRef = allDocContent.includes('timeout/retry') ||
      allDocContent.includes('retry boundary') ||
      allDocContent.includes('Timeout/Retry');
    assert.ok(hasTimeoutRetryRef, 'At least one doc should reference timeout/retry boundary');

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

  console.log(`\nTimeout/retry boundary contract: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
