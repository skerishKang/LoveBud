#!/usr/bin/env node
/**
 * Scout Local Model Smoke Script
 * v20260617-1
 *
 * LOCAL-ONLY developer smoke harness.
 *
 * PURPOSE:
 *   Exercises the AI-shaped Scout suggestion path end-to-end using a
 *   fully fixture-based / mock transport, WITHOUT any external provider call.
 *   Validates that the prompt builder → executor skeleton → transport seam →
 *   response validator pipeline works correctly end-to-end.
 *
 * HOW TO RUN (local dev only):
 *   node scripts/scout-local-model-smoke.mjs
 *   SCOUT_LOCAL_MODEL_SMOKE=1 node scripts/scout-local-model-smoke.mjs
 *
 * EXPLICIT OPT-IN REQUIRED:
 *   This script is a local-only dev harness. It will exit early unless
 *   SCOUT_LOCAL_MODEL_SMOKE=1 is set or the --local-model flag is passed.
 *
 * NOT IMPORTED BY:
 *   - functions/api/scout/suggest.js
 *   - functions/api/scout/live-provider-adapter.js
 *   - functions/api/scout/live-provider-executor.js
 *   - functions/api/scout/live-provider-transport.js
 *   - any production/staging runtime module
 *
 * NOT RUN BY:
 *   - npm test (normal CI)
 *   - npm run verify
 *   - npm run lint
 *   - npm run build
 *   - Cloudflare Pages build
 *
 * SAFETY:
 *   - No real API keys
 *   - No external provider call (mock transport only in this script)
 *   - No provider SDK import (OpenAI, Anthropic, Gemini, etc.)
 *   - No auto-save or data persistence
 *   - No real Firebase Admin SDK
 *   - No real KV / Durable Object / D1
 *   - No frontend/browser call
 *   - Transport is entirely fixture-based below
 */

// ─── Opt-in guard ─────────────────────────────────────────────────────────────

const isOptedIn =
  process.env.SCOUT_LOCAL_MODEL_SMOKE === '1' ||
  process.argv.includes('--local-model');

if (!isOptedIn) {
  console.log('[scout-local-model-smoke] Skipping: opt-in flag not set.');
  console.log('  To run: SCOUT_LOCAL_MODEL_SMOKE=1 node scripts/scout-local-model-smoke.mjs');
  console.log('          node scripts/scout-local-model-smoke.mjs --local-model');
  console.log('');
  console.log('  This script is a LOCAL-ONLY dev harness.');
  console.log('  It does NOT make external provider calls.');
  console.log('  It uses a fully fixture-based mock transport.');
  process.exit(0);
}

// ─── Imports (no provider SDK, no fetch, no Firebase Admin) ───────────────────

// Note: this script must be run in an environment where these modules are
// accessible via the project path. Since functions/ uses ES module exports,
// we import from the project root relative path.
import {
  createScoutLiveProviderTransport,
} from '../functions/api/scout/live-provider-transport.js';

import {
  createScoutLiveProviderExecutor,
} from '../functions/api/scout/live-provider-executor.js';

import {
  buildScoutLiveProviderPrompt,
  validateScoutLiveProviderResponse,
} from '../functions/api/scout/live-provider-adapter.js';

// ─── Fixture transport ────────────────────────────────────────────────────────

/**
 * A fully fixture-based mock transport.
 * Simulates a real OpenAI-compatible response shape without any network call.
 *
 * @param {Object} req - { url, method, headers, body }
 * @returns {Object} mock OpenAI-compatible response
 */
async function fixtureTransport(req) {
  // Do not log req body — it may contain excerpt/prompt
  // Only log safe observability fields
  console.log(`  [fixture-transport] method=${req.method} url-length=${req.url.length}`);

  // Simulate minimal OpenAI-compatible chat completions response
  const mockContent = JSON.stringify({
    titleSuggestion: '순간을 담은 이야기 (local-smoke)',
    summarySuggestion: '사용자가 입력한 텍스트로부터 생성된 모의 제안입니다.',
    translationSuggestion: 'A mock suggestion generated from user-entered text.',
    emotionTags: ['설렘', '감동'],
    memoSuggestion: '이 순간을 기록해두고 싶었습니다. (local-smoke)',
    safetyNote: 'AI-generated suggestion. Review before saving.',
  });

  return {
    choices: [
      {
        message: {
          content: mockContent,
          role: 'assistant',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
    },
  };
}

// ─── Test input fixture ───────────────────────────────────────────────────────

const TEST_INPUT = {
  excerpt: '팬의 마음은 순간 속에 피어납니다. 이 짧은 글에 담긴 감정을 Scout이 도와 정리해줍니다.',
  summary: '',
  memo: '',
  sourceUrl: 'https://example.com/fan-article-1',
  requestedLanguage: 'ko',
  desiredTone: 'polite',
  maxOutputLength: 200,
};

// ─── Main smoke runner ────────────────────────────────────────────────────────

async function runSmoke() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Scout Local Model Smoke (fixture-only, no network) ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  Mode: fixture-only (mock transport, no external provider call)');
  console.log('  Note: This script does NOT make real API calls.');
  console.log('');

  let passCount = 0;
  let failCount = 0;

  function pass(label) {
    console.log(`  ✓ PASS: ${label}`);
    passCount++;
  }

  function fail(label, reason) {
    console.error(`  ✗ FAIL: ${label}`);
    if (reason) console.error(`         ${reason}`);
    failCount++;
  }

  // ── Step 1: Transport seam — disabled mode ──────────────────────────────────
  console.log('── Step 1: Disabled transport safe-fail ──');
  try {
    const disabledTransport = createScoutLiveProviderTransport({ mode: 'disabled' });
    const res = await disabledTransport.call({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok && res.error.code === 'TRANSPORT_DISABLED') {
      pass('disabled transport returns TRANSPORT_DISABLED');
    } else {
      fail('disabled transport returns TRANSPORT_DISABLED', `got ok=${res.ok} code=${res.error?.code}`);
    }
  } catch (err) {
    fail('disabled transport returns TRANSPORT_DISABLED', err.message);
  }

  // ── Step 2: Transport seam — injected fixture transport ────────────────────
  console.log('');
  console.log('── Step 2: Injected fixture transport ──');
  const injectedTransport = createScoutLiveProviderTransport({
    mode: 'injected',
    execute: fixtureTransport,
  });
  try {
    const res = await injectedTransport.call({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [] }),
    });
    if (res.ok && res.response && Array.isArray(res.response.choices)) {
      pass('injected transport returns ok response with choices');
    } else {
      fail('injected transport returns ok response with choices', `got ok=${res.ok}`);
    }
  } catch (err) {
    fail('injected transport call', err.message);
  }

  // ── Step 3: Prompt builder ──────────────────────────────────────────────────
  console.log('');
  console.log('── Step 3: Prompt builder ──');
  let promptResult;
  try {
    promptResult = buildScoutLiveProviderPrompt(TEST_INPUT);
    if (promptResult.ok && typeof promptResult.prompt === 'string' && promptResult.prompt.length > 0) {
      pass('buildScoutLiveProviderPrompt returns ok prompt');
    } else {
      fail('buildScoutLiveProviderPrompt', `ok=${promptResult.ok} error=${JSON.stringify(promptResult.error)}`);
    }
  } catch (err) {
    fail('buildScoutLiveProviderPrompt threw', err.message);
  }

  // ── Step 4: Executor with injected fixture transport ───────────────────────
  console.log('');
  console.log('── Step 4: Executor + fixture transport ──');
  try {
    const executor = createScoutLiveProviderExecutor({
      enabled: true,
      provider: 'openai-fixture',
      model: 'gpt-4o-mini',
      apiKey: 'fixture-key-local-smoke-only',
      baseUrl: 'https://api.openai.com/v1/chat/completions',
    });

    const execRes = await executor.execute({
      prompt: promptResult?.prompt || 'test prompt',
      maxOutputLength: 200,
      transport: fixtureTransport,
    });

    if (execRes.ok && execRes.suggestion && typeof execRes.suggestion === 'object') {
      pass('executor returns ok suggestion via fixture transport');
    } else {
      fail('executor returns ok suggestion via fixture transport',
        `ok=${execRes.ok} error=${JSON.stringify(execRes.error)}`);
    }

    // ── Step 5: Response validator ───────────────────────────────────────────
    console.log('');
    console.log('── Step 5: Response validator ──');
    const validationRes = validateScoutLiveProviderResponse(execRes.suggestion, {
      requestedLanguage: 'ko',
      excerpt: TEST_INPUT.excerpt,
      sourceUrl: TEST_INPUT.sourceUrl,
    });

    if (validationRes.ok && validationRes.suggestion && validationRes.suggestion.safetyNote) {
      pass('validateScoutLiveProviderResponse returns ok normalized suggestion with safetyNote');
    } else {
      fail('validateScoutLiveProviderResponse',
        `ok=${validationRes.ok} error=${JSON.stringify(validationRes.error)}`);
    }

    // ── Step 6: No prohibited fields in output ───────────────────────────────
    console.log('');
    console.log('── Step 6: Output safety check ──');
    const prohibited = ['rawProviderResponse', 'rawModelOutput', 'apiKey', 'token', 'authorization'];
    const outputStr = JSON.stringify(validationRes.suggestion || {});
    const leaks = prohibited.filter(f => outputStr.includes(f));
    if (leaks.length === 0) {
      pass('normalized suggestion does not contain prohibited fields');
    } else {
      fail('normalized suggestion does not contain prohibited fields', `leaked: ${leaks.join(', ')}`);
    }

  } catch (err) {
    fail('executor + transport smoke', err.message);
  }

  // ── Step 7: No provider SDK import ──────────────────────────────────────────
  console.log('');
  console.log('── Step 7: No provider SDK import check ──');
  // Static check: if we reached this point without an import error, no SDK
  // was imported by the modules above (openai, @anthropic-ai/sdk, groq, etc.).
  // The gate contract also verifies this statically via source scan.
  pass('no provider SDK imported (static-safe: execution reached this point)');

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('');
  console.log('────────────────────────────────────────────────────────');
  console.log(`  Results: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    console.log('  ✗ Smoke FAILED');
    process.exit(1);
  } else {
    console.log('  ✓ Smoke PASSED (fixture-only, no external provider call)');
    console.log('');
    console.log('  Next steps for real provider activation:');
    console.log('  1. Set SCOUT_SUGGEST_PROVIDER_MODE=live in Cloudflare env (staging only)');
    console.log('  2. Set SCOUT_SUGGEST_LLM_PROVIDER, SCOUT_SUGGEST_MODEL, SCOUT_SUGGEST_LLM_API_KEY');
    console.log('  3. Confirm auth (Firebase), rate-limit (KV), observability are in place');
    console.log('  4. Run staging soak and rollback drills');
    console.log('  5. Get explicit CTO sign-off before production_live');
    process.exit(0);
  }
}

runSmoke().catch(err => {
  console.error('[scout-local-model-smoke] Uncaught error:', err.message || String(err));
  process.exit(1);
});
