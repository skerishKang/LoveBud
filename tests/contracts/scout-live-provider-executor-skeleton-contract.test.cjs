/**
 * Scout Live Provider Executor Skeleton Contract Tests
 * Issue Reference: #2618 (Keeps #1882 open.)
 *
 * Verifies the contract, requirements, and safety policies of the executor skeleton.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const EXECUTOR_PATH = path.join(ROOT, 'functions/api/scout/live-provider-executor.js');

function readExecutorCode() {
  assert.ok(fs.existsSync(EXECUTOR_PATH), 'Executor file must exist');
  return fs.readFileSync(EXECUTOR_PATH, 'utf8');
}

// Dynamic import helper since the target is an ES module
async function importExecutor() {
  return await import(EXECUTOR_PATH);
}

// ─── STATIC CONTRACT CHECKS ─────────────────────────────────────────────────

test('1. Executor file exists and exports all required symbols', async () => {
  const code = readExecutorCode();
  
  // Verify symbols exist in code
  const requiredSymbols = [
    'SCOUT_LIVE_PROVIDER_EXECUTOR_VERSION',
    'SCOUT_LIVE_PROVIDER_EXECUTOR_STATUS',
    'SCOUT_LIVE_PROVIDER_EXECUTOR_ERROR_CODES',
    'normalizeScoutLiveProviderExecutorConfig',
    'buildOpenAICompatibleScoutRequest',
    'parseOpenAICompatibleScoutResponse',
    'createScoutLiveProviderExecutor',
  ];
  
  for (const sym of requiredSymbols) {
    assert.match(code, new RegExp(`export\\s+\\{[^\\}]*${sym}`), `Must export symbol: ${sym}`);
  }

  // Load module and test symbols
  const mod = await importExecutor();
  assert.ok(mod.SCOUT_LIVE_PROVIDER_EXECUTOR_VERSION, 'VERSION should exist');
  assert.ok(mod.SCOUT_LIVE_PROVIDER_EXECUTOR_STATUS, 'STATUS should exist');
  assert.ok(mod.SCOUT_LIVE_PROVIDER_EXECUTOR_ERROR_CODES, 'ERROR_CODES should exist');
  assert.equal(typeof mod.normalizeScoutLiveProviderExecutorConfig, 'function');
  assert.equal(typeof mod.buildOpenAICompatibleScoutRequest, 'function');
  assert.equal(typeof mod.parseOpenAICompatibleScoutResponse, 'function');
  assert.equal(typeof mod.createScoutLiveProviderExecutor, 'function');
});

test('2. Static Checks: Prohibits provider SDK imports', () => {
  const code = readExecutorCode();
  
  const prohibitedSdks = [
    'openai',
    'anthropic',
    '@google/generative-ai',
    'gemini',
    'nvidia',
    'openrouter',
    'groq',
    'mistral',
  ];
  
  for (const sdk of prohibitedSdks) {
    const importRegex = new RegExp(`(import|require)\\s+.*['"]${sdk}['"]`, 'i');
    assert.doesNotMatch(code, importRegex, `Should not import or require provider SDK: ${sdk}`);
  }
});

test('3. Static Checks: No committed API key patterns, secrets, or .env files', () => {
  const code = readExecutorCode();

  // Test sk- keys and Firebase API keys
  assert.doesNotMatch(code, /sk-[a-zA-Z0-9]{20,}/, 'Should not contain committed OpenAI API keys');
  assert.doesNotMatch(code, /AIza[0-9A-Za-z_-]{35}/, 'Should not contain committed Firebase/GCP API keys');
  assert.doesNotMatch(code, /\.env/, 'Should not make assumptions about .env files');
});

test('4. Static Checks: No direct browser-side element usage', () => {
  const code = readExecutorCode();
  
  assert.doesNotMatch(code, /\bwindow\b/, 'Should not reference browser window');
  assert.doesNotMatch(code, /\bdocument\b/, 'Should not reference browser document');
});

test('5. Static Checks: No direct fetch/network calls in default paths', () => {
  const code = readExecutorCode();
  
  // Exclude comments when checking for fetch usage
  const codeWithoutComments = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  
  assert.doesNotMatch(codeWithoutComments, /\bfetch\s*\(/, 'Should not perform fetch calls directly in execution path');
});

test('6. Static Checks: No logging of prompt, API keys, excerpts, sourceUrl, PII, rawProviderResponse', () => {
  const code = readExecutorCode();
  
  // Console logging checks
  assert.doesNotMatch(code, /console\.log/, 'Should not contain console.log');
  assert.doesNotMatch(code, /console\.error/, 'Should not contain console.error');
  
  const prohibitedKeywords = ['prompt', 'excerpt', 'sourceUrl', 'apiKey', 'token', 'PII', 'rawProviderResponse'];
  for (const keyword of prohibitedKeywords) {
    // Check that we don't have code like "log(prompt)" or "logger(rawProviderResponse)"
    const logPattern = new RegExp(`log\\([^)]*${keyword}`, 'i');
    assert.doesNotMatch(code, logPattern, `Should not log prohibited keyword: ${keyword}`);
  }
});

test('7. OpenAI-compatible only and no multi-provider router', () => {
  const code = readExecutorCode();
  
  // Should not contain multi-provider routing references
  assert.doesNotMatch(code, /multi-provider/i, 'Should not mention multi-provider router');
  assert.doesNotMatch(code, /routeToProvider/i, 'Should not support multi-provider routing');
});

// ─── FUNCTIONAL SKELETON CHECKS ─────────────────────────────────────────────

test('8. Configuration normalization matches expected schema (exposing hasApiKey but not API key)', async () => {
  const { normalizeScoutLiveProviderExecutorConfig } = await importExecutor();

  const rawConfig = {
    enabled: true,
    provider: 'openai-compatible',
    model: 'gpt-4o-mini',
    apiKey: 'test-provider-key-placeholder',
    baseUrl: 'https://custom.api.com/v1',
  };

  const normalized = normalizeScoutLiveProviderExecutorConfig(rawConfig);
  
  assert.equal(normalized.isEnabled, true);
  assert.equal(normalized.provider, 'openai-compatible');
  assert.equal(normalized.model, 'gpt-4o-mini');
  assert.equal(normalized.hasApiKey, true);
  assert.equal(normalized.baseUrl, 'https://custom.api.com/v1');
  
  // API key must never be exposed in the normalized configuration object
  assert.equal(normalized.apiKey, undefined);
  assert.equal(normalized.SCOUT_SUGGEST_LLM_API_KEY, undefined);
});

test('9. Missing configuration safe-fails', async () => {
  const { createScoutLiveProviderExecutor } = await importExecutor();

  // Disabled executor
  const executor1 = createScoutLiveProviderExecutor({ enabled: false });
  assert.equal(executor1.status, 'disabled');
  
  const res1 = await executor1.execute({ prompt: 'test prompt', transport: async () => ({}) });
  assert.equal(res1.ok, false);
  assert.equal(res1.error.code, 'CONFIG_MISSING');

  // Missing API key
  const executor2 = createScoutLiveProviderExecutor({
    enabled: true,
    provider: 'openai-compatible',
    model: 'gpt-4o-mini',
  });
  assert.equal(executor2.status, 'config_missing');
  
  const res2 = await executor2.execute({ prompt: 'test prompt', transport: async () => ({}) });
  assert.equal(res2.ok, false);
  assert.equal(res2.error.code, 'CONFIG_MISSING');
});

test('10. missing provider safe-fails even when enabled, model, and API key are present', async () => {
  const { createScoutLiveProviderExecutor } = await importExecutor();

  const executor = createScoutLiveProviderExecutor({
    enabled: true,
    model: 'gpt-4o-mini',
    apiKey: 'test-provider-key-placeholder',
  });

  assert.equal(executor.status, 'config_missing');

  const res = await executor.execute({
    prompt: 'test prompt',
    transport: async () => ({ choices: [] }),
  });

  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'CONFIG_MISSING');
});

test('11. Missing transport parameter safe-fails network-free', async () => {
  const { createScoutLiveProviderExecutor } = await importExecutor();

  const executor = createScoutLiveProviderExecutor({
    enabled: true,
    provider: 'openai-compatible',
    model: 'gpt-4o-mini',
    apiKey: 'test-provider-key-placeholder',
  });

  const res = await executor.execute({ prompt: 'test prompt' }); // omit transport
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'TRANSPORT_MISSING');
});

test('12. Mock transport success path extracts and parses suggestion correctly', async () => {
  const { createScoutLiveProviderExecutor } = await importExecutor();

  const executor = createScoutLiveProviderExecutor({
    enabled: true,
    provider: 'openai-compatible',
    model: 'gpt-4o',
    apiKey: 'test-provider-key-placeholder',
    baseUrl: 'https://test-api.com',
  });

  const mockResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            titleSuggestion: 'Mocked Title',
            summarySuggestion: 'Mocked Summary',
            translationSuggestion: 'Mocked Translation',
            emotionTags: ['happy'],
            memoSuggestion: 'Mocked Memo',
            safetyNote: 'Mocked Safety Note',
          }),
        },
      },
    ],
  };

  let transportCalled = false;
  const mockTransport = async (options) => {
    transportCalled = true;
    assert.equal(options.url, 'https://test-api.com');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Authorization'], 'Bearer test-provider-key-placeholder');
    
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'gpt-4o');
    assert.equal(body.messages[0].content, 'Translate this text.');
    
    return mockResponse;
  };

  const res = await executor.execute({
    prompt: 'Translate this text.',
    transport: mockTransport,
  });

  assert.equal(transportCalled, true);
  assert.equal(res.ok, true);
  assert.ok(res.suggestion);
  assert.equal(res.suggestion.titleSuggestion, 'Mocked Title');
  assert.equal(res.suggestion.summarySuggestion, 'Mocked Summary');
  assert.equal(res.suggestion.safetyNote, 'Mocked Safety Note');
});

test('13. thrown transport errors safe-fail without exposing raw error messages', async () => {
  const { createScoutLiveProviderExecutor } = await importExecutor();

  const executor = createScoutLiveProviderExecutor({
    enabled: true,
    provider: 'openai-compatible',
    model: 'gpt-4o',
    apiKey: 'test-provider-key-placeholder',
  });

  const mockTransport = async () => {
    throw new Error('Network failure with secret token sk-should-not-leak');
  };

  const res = await executor.execute({
    prompt: 'Fail please.',
    transport: mockTransport,
  });

  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'PROVIDER_ERROR');
  assert.equal(res.error.message, 'Live provider executor failed safely.');
  assert.doesNotMatch(JSON.stringify(res), /sk-should-not-leak|Network failure|secret token/i);
});

test('14. Malformed responses safe-fail with PROVIDER_ERROR', async () => {
  const { createScoutLiveProviderExecutor } = await importExecutor();

  const executor = createScoutLiveProviderExecutor({
    enabled: true,
    provider: 'openai-compatible',
    model: 'gpt-4o',
    apiKey: 'test-provider-key-placeholder',
  });

  const runWithResponse = async (responseVal) => {
    return await executor.execute({
      prompt: 'Check malformed.',
      transport: async () => responseVal,
    });
  };

  // Malformed: empty choices
  const res1 = await runWithResponse({ choices: [] });
  assert.equal(res1.ok, false);
  assert.equal(res1.error.code, 'PROVIDER_ERROR');

  // Malformed: message content is not string
  const res2 = await runWithResponse({ choices: [{ message: { content: null } }] });
  assert.equal(res2.ok, false);

  // Malformed: invalid JSON string
  const res3 = await runWithResponse({ choices: [{ message: { content: '{invalid-json' } }] });
  assert.equal(res3.ok, false);

  // Malformed: parsed JSON is not an object
  const res4 = await runWithResponse({ choices: [{ message: { content: '"just a string"' } }] });
  assert.equal(res4.ok, false);
});
