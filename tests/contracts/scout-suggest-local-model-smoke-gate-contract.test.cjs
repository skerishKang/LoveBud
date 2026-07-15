/**
 * Contract: Scout Local Model Smoke Gate
 * v20260617-1
 *
 * Proves:
 * 1. Local smoke script exists at scripts/scout-local-model-smoke.mjs.
 * 2. Smoke script is NOT imported by any runtime function module.
 * 3. Smoke script requires opt-in (SCOUT_LOCAL_MODEL_SMOKE=1 or --local-model).
 * 4. Smoke script does NOT contain provider SDK imports.
 * 5. Smoke script does NOT contain API key literals.
 * 6. Smoke script does NOT import or call Firebase Admin SDK.
 * 7. The transport seam, executor, and adapter exported functions can produce
 *    a fixture-only suggestion pipeline result (network-free, injection-only).
 * 8. Default suggest endpoint behavior (stub) remains unchanged.
 * 9. No prohibited strings in fixture suggestion output.
 * 10. No CI-unsafe patterns (no unconditional fetch, no direct external call).
 */

'use strict';

const path = require('path');
const assert = require('assert');
const fs = require('fs');
const { importAbsolute } = require('../helpers/import-absolute.cjs');

// ─── Paths ───────────────────────────────────────────────────────────────────

const SMOKE_SCRIPT_PATH = path.resolve(__dirname, '../../scripts/scout-local-model-smoke.mjs');
const TRANSPORT_PATH = path.resolve(__dirname, '../../functions/api/scout/live-provider-transport.js');
const EXECUTOR_PATH = path.resolve(__dirname, '../../functions/api/scout/live-provider-executor.js');
const ADAPTER_PATH = path.resolve(__dirname, '../../functions/api/scout/live-provider-adapter.js');
const SUGGEST_PATH = path.resolve(__dirname, '../../functions/api/scout/suggest.js');

// ─── Test runner ──────────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function pass(label) {
  console.log(`  ✓ ${label}`);
  passCount++;
}

function fail(label, reason) {
  console.error(`  ✗ FAIL: ${label}`);
  if (reason) console.error(`         ${reason}`);
  failCount++;
}

async function suite(label, fn) {
  console.log(`\n── ${label}`);
  await fn();
}

async function run() {
  console.log('\n[scout-suggest-local-model-smoke-gate-contract] Starting contract checks');

  // ── 0. File existence ─────────────────────────────────────────────────────────
  await suite('0. Required files exist', async () => {
    if (fs.existsSync(SMOKE_SCRIPT_PATH)) {
      pass('scripts/scout-local-model-smoke.mjs exists');
    } else {
      fail('scripts/scout-local-model-smoke.mjs exists', `Missing: ${SMOKE_SCRIPT_PATH}`);
    }
    if (fs.existsSync(TRANSPORT_PATH)) {
      pass('functions/api/scout/live-provider-transport.js exists');
    } else {
      fail('functions/api/scout/live-provider-transport.js exists', `Missing: ${TRANSPORT_PATH}`);
    }
  });

  // ── 1. Smoke script is not imported by runtime modules ───────────────────────
  await suite('1. Smoke script not imported by runtime modules', async () => {
    const runtimePaths = [SUGGEST_PATH, ADAPTER_PATH, EXECUTOR_PATH, TRANSPORT_PATH];
    const smokeBasename = 'scout-local-model-smoke';
    for (const rp of runtimePaths) {
      if (!fs.existsSync(rp)) continue;
      const src = fs.readFileSync(rp, 'utf-8');
      if (!src.includes(smokeBasename)) {
        pass(`${path.basename(rp)} does not import smoke script`);
      } else {
        fail(`${path.basename(rp)} does not import smoke script`, `found '${smokeBasename}' in ${path.basename(rp)}`);
      }
    }
  });

  // ── 2. Smoke script static source safety ─────────────────────────────────────
  await suite('2. Smoke script static source safety', async () => {
    if (!fs.existsSync(SMOKE_SCRIPT_PATH)) {
      fail('smoke script source check', 'file not found');
      return;
    }
    const src = fs.readFileSync(SMOKE_SCRIPT_PATH, 'utf-8');

    // Opt-in guard must be present
    const hasOptInGuard = src.includes('SCOUT_LOCAL_MODEL_SMOKE') || src.includes('--local-model');
    if (hasOptInGuard) {
      pass('smoke script contains opt-in guard (SCOUT_LOCAL_MODEL_SMOKE or --local-model)');
    } else {
      fail('smoke script contains opt-in guard');
    }

    // Must exit early if not opted in
    const hasEarlyExit = src.includes('process.exit(0)') && (src.includes('isOptedIn') || src.includes('opt-in'));
    if (hasEarlyExit) {
      pass('smoke script has early exit when not opted in');
    } else {
      fail('smoke script has early exit when not opted in');
    }

    // No provider SDK imports
    const prohibitedImports = [
      "require('openai')", 'require("openai")',
      "require('@anthropic-ai/sdk')", 'require("@anthropic-ai/sdk")',
      "require('groq-sdk')", 'require("groq-sdk")',
      "require('@mistralai/mistralai')", 'require("@mistralai/mistralai")',
      "require('google-generative-ai')", 'require("google-generative-ai")',
      'import OpenAI from', 'import Anthropic from', 'import Groq from',
      "from 'openai'", 'from "openai"',
      "from '@anthropic-ai/sdk'", 'from "@anthropic-ai/sdk"',
    ];
    const sdkLeaks = prohibitedImports.filter(p => src.includes(p));
    if (sdkLeaks.length === 0) {
      pass('smoke script: no provider SDK import');
    } else {
      fail('smoke script: no provider SDK import', sdkLeaks.join(', '));
    }

    // No API key literals
    const keyPatterns = [/sk-[a-zA-Z0-9]{20,}/, /AIza[0-9A-Za-z_-]{35}/];
    const hasKeyLiteral = keyPatterns.some(p => p.test(src));
    if (!hasKeyLiteral) {
      pass('smoke script: no API key literal');
    } else {
      fail('smoke script: no API key literal');
    }

    // No Firebase Admin SDK
    const firebasePatterns = ['firebase-admin', 'getAuth(', 'verifyIdToken(', 'initializeApp('];
    const fbLeaks = firebasePatterns.filter(p => src.includes(p));
    if (fbLeaks.length === 0) {
      pass('smoke script: no Firebase Admin SDK');
    } else {
      fail('smoke script: no Firebase Admin SDK', fbLeaks.join(', '));
    }

    // No unconditional fetch() call (fetch may only be used inside injected transport)
    // Smoke script uses mock execute fn — no direct fetch
    if (!src.includes('\nfetch(') && !src.includes('await fetch(')) {
      pass('smoke script: no unconditional fetch() call at top level');
    } else {
      // Only fail if it's outside the fixture transport boundary
      fail('smoke script: no unconditional fetch() call at top level');
    }

    // Must reference "local-only" or "LOCAL-ONLY" as a comment/doc
    if (src.includes('LOCAL-ONLY') || src.includes('local-only') || src.includes('local only')) {
      pass('smoke script: documented as local-only');
    } else {
      fail('smoke script: documented as local-only');
    }

    // Must NOT be run by normal npm test / CI
    const ciPatterns = ['NOT RUN BY', 'not run in normal', 'npm test', 'NOT imported by'];
    const hasCiGuardDoc = ciPatterns.some(p => src.includes(p));
    if (hasCiGuardDoc) {
      pass('smoke script: CI exclusion documented');
    } else {
      fail('smoke script: CI exclusion documented');
    }
  });

  // ── 3. Fixture-only suggestion pipeline (network-free) ────────────────────────
  await suite('3. Fixture-only suggestion pipeline produces normalized output', async () => {
    let createScoutLiveProviderTransport, createScoutLiveProviderExecutor,
        buildScoutLiveProviderPrompt, validateScoutLiveProviderResponse;

    try {
      const transportMod = await importAbsolute(TRANSPORT_PATH);
      createScoutLiveProviderTransport = transportMod.createScoutLiveProviderTransport;
      pass('live-provider-transport.js importable');
    } catch (err) {
      fail('live-provider-transport.js importable', err.message);
      return;
    }

    try {
      const executorMod = await importAbsolute(EXECUTOR_PATH);
      createScoutLiveProviderExecutor = executorMod.createScoutLiveProviderExecutor;
      pass('live-provider-executor.js importable');
    } catch (err) {
      fail('live-provider-executor.js importable', err.message);
      return;
    }

    try {
      const adapterMod = await importAbsolute(ADAPTER_PATH);
      buildScoutLiveProviderPrompt = adapterMod.buildScoutLiveProviderPrompt;
      validateScoutLiveProviderResponse = adapterMod.validateScoutLiveProviderResponse;
      pass('live-provider-adapter.js importable (buildPrompt + validateResponse)');
    } catch (err) {
      fail('live-provider-adapter.js importable', err.message);
      return;
    }

    // Build prompt
    const testInput = {
      excerpt: '팬의 마음은 순간 속에 피어납니다.',
      requestedLanguage: 'ko',
      desiredTone: 'polite',
      maxOutputLength: 200,
    };
    let promptResult;
    try {
      promptResult = buildScoutLiveProviderPrompt(testInput);
      assert.strictEqual(promptResult.ok, true, 'prompt builder ok');
      pass('buildScoutLiveProviderPrompt: ok=true');
    } catch (err) {
      fail('buildScoutLiveProviderPrompt', err.message);
      return;
    }

    // Fixture transport (no network)
    const mockContent = JSON.stringify({
      titleSuggestion: '순간을 담은 이야기',
      summarySuggestion: '모의 요약',
      translationSuggestion: 'Mock translation.',
      emotionTags: ['설렘'],
      memoSuggestion: '기록하고 싶은 순간',
      safetyNote: 'AI suggestion. Review before saving.',
    });
    const fixtureExecute = async (req) => ({
      choices: [{ message: { content: mockContent, role: 'assistant' }, finish_reason: 'stop' }],
    });

    // Executor
    let execResult;
    try {
      const executor = createScoutLiveProviderExecutor({
        enabled: true,
        provider: 'openai-fixture',
        model: 'gpt-4o-mini',
        apiKey: 'fixture-key-gate-test-only',
      });
      execResult = await executor.execute({
        prompt: promptResult.prompt,
        maxOutputLength: 200,
        transport: fixtureExecute,
      });
      assert.strictEqual(execResult.ok, true, 'executor: ok=true');
      pass('executor with fixture transport: ok=true');
    } catch (err) {
      fail('executor with fixture transport', err.message);
      return;
    }

    // Validate response
    let validationResult;
    try {
      validationResult = validateScoutLiveProviderResponse(execResult.suggestion, {
        requestedLanguage: 'ko',
        excerpt: testInput.excerpt,
      });
      assert.strictEqual(validationResult.ok, true, 'validator: ok=true');
      pass('validateScoutLiveProviderResponse: ok=true');
      assert.ok(validationResult.suggestion.safetyNote, 'safetyNote present');
      pass('normalized suggestion has safetyNote');
    } catch (err) {
      fail('validateScoutLiveProviderResponse', err.message);
      return;
    }

    // No prohibited fields in output
    const outputStr = JSON.stringify(validationResult.suggestion);
    const prohibited = ['rawProviderResponse', 'rawModelOutput', 'apiKey', 'token', 'authorization', 'fixture-key'];
    const leaks = prohibited.filter(f => outputStr.includes(f));
    if (leaks.length === 0) {
      pass('fixture suggestion output: no prohibited fields');
    } else {
      fail('fixture suggestion output: no prohibited fields', leaks.join(', '));
    }

    // Suggestion shape
    const s = validationResult.suggestion;
    if (typeof s.titleSuggestion === 'string' && typeof s.safetyNote === 'string' && Array.isArray(s.emotionTags)) {
      pass('suggestion has correct shape (titleSuggestion, safetyNote, emotionTags)');
    } else {
      fail('suggestion has correct shape');
    }
  });

  // ── 4. Transport seam disabled by default ─────────────────────────────────────
  await suite('4. Transport seam: disabled default (no network)', async () => {
    let createScoutLiveProviderTransport;
    try {
      const mod = await importAbsolute(TRANSPORT_PATH);
      createScoutLiveProviderTransport = mod.createScoutLiveProviderTransport;
    } catch (err) {
      fail('transport import', err.message);
      return;
    }

    const t = createScoutLiveProviderTransport();
    assert.strictEqual(t.mode, 'disabled');
    pass('default transport: mode=disabled');

    const res = await t.call({ url: 'https://api.openai.com/v1/chat/completions', method: 'POST', headers: {}, body: '{}' });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error.code, 'TRANSPORT_DISABLED');
    pass('default transport: TRANSPORT_DISABLED safe-fail');
  });

  // ── 5. Live path without injected transport still safe-fails ─────────────────
  await suite('5. Executor with no transport: safe-fail TRANSPORT_MISSING', async () => {
    let createScoutLiveProviderExecutor;
    try {
      const mod = await importAbsolute(EXECUTOR_PATH);
      createScoutLiveProviderExecutor = mod.createScoutLiveProviderExecutor;
    } catch (err) {
      fail('executor import', err.message);
      return;
    }

    const executor = createScoutLiveProviderExecutor({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'fixture-key-gate-test-only',
    });

    // No transport provided
    const res = await executor.execute({ prompt: 'Test prompt', maxOutputLength: 200 });
    assert.strictEqual(res.ok, false, 'no transport: ok=false');
    pass('executor without transport: ok=false');
    assert.ok(
      res.error.code === 'TRANSPORT_MISSING' || res.error.code === 'CONFIG_MISSING',
      'executor without transport: TRANSPORT_MISSING or CONFIG_MISSING code'
    );
    pass('executor without transport: safe-fail code returned');
  });

  // ── 6. Stub path unchanged (no live mode by default) ─────────────────────────
  await suite('6. suggest.js static: stub default preserved', async () => {
    const src = fs.readFileSync(SUGGEST_PATH, 'utf-8');

    // Default mode is still stub
    if (src.includes("SCOUT_SUGGEST_PROVIDER_MODES.STUB") || src.includes("'stub'")) {
      pass('suggest.js: stub provider mode constant present');
    } else {
      fail('suggest.js: stub provider mode constant present');
    }

    // generateStubSuggestion must still be present
    if (src.includes('generateStubSuggestion')) {
      pass('suggest.js: generateStubSuggestion remains present');
    } else {
      fail('suggest.js: generateStubSuggestion remains present');
    }

    // resolveScoutSuggestProviderMode must still be present
    if (src.includes('resolveScoutSuggestProviderMode')) {
      pass('suggest.js: resolveScoutSuggestProviderMode remains present');
    } else {
      fail('suggest.js: resolveScoutSuggestProviderMode remains present');
    }

    // smoke script NOT imported
    if (!src.includes('scout-local-model-smoke')) {
      pass('suggest.js: smoke script NOT imported');
    } else {
      fail('suggest.js: smoke script NOT imported');
    }
  });

  // ── 7. Transport module: no CI-unsafe direct fetch ─────────────────────────────
  await suite('7. Transport module: no direct fetch() call', async () => {
    const src = fs.readFileSync(TRANSPORT_PATH, 'utf-8');

    // The transport module itself must not call fetch() globally
    // Real transport is only provided via injection
    const hasFetch = src.includes('await fetch(') || src.includes('\nfetch(');
    if (!hasFetch) {
      pass('live-provider-transport.js: no direct fetch() call');
    } else {
      fail('live-provider-transport.js: no direct fetch() call', 'fetch found in source');
    }
  });

  // ── 8. No API key leak in any output ──────────────────────────────────────────
  await suite('8. No API key / credential in contract test output', async () => {
    // This contract itself must not contain literal API key patterns
    const selfSrc = fs.readFileSync(__filename, 'utf-8');
    const keyPatterns = [/sk-[a-zA-Z0-9]{20,}/, /AIza[0-9A-Za-z_-]{35}/];
    const hasKeyLiteral = keyPatterns.some(p => p.test(selfSrc));
    if (!hasKeyLiteral) {
      pass('this contract file: no API key literal');
    } else {
      fail('this contract file: no API key literal');
    }
  });

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────────────────');
  console.log(`[scout-suggest-local-model-smoke-gate-contract] ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('[scout-suggest-local-model-smoke-gate-contract] Uncaught:', err.message || String(err));
  process.exit(1);
});
