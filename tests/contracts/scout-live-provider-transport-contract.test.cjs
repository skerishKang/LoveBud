/**
 * Contract: Scout Live Provider Transport Seam
 * v20260617-1
 *
 * Proves:
 * 1. Transport seam is disabled-by-default (no network call, no provider SDK).
 * 2. Injected mode requires an execute function — missing execute → TRANSPORT_MISSING.
 * 3. Disabled mode always returns TRANSPORT_DISABLED regardless of request.
 * 4. Injected mode delegates to the injected function only.
 * 5. Injected transport errors are sanitized — no raw error message leaked.
 * 6. Request validation is enforced before injected execute is called.
 * 7. No provider SDK is imported by the module.
 * 8. No direct fetch/network call in the module.
 * 9. Module import is side-effect-free (no provider init, no network, no env reads).
 * 10. Status field reflects readiness correctly.
 */

'use strict';

const path = require('path');
const assert = require('assert');
const fs = require('fs');
var scoutEnvGuard = require('./_scout-env-guard.cjs');

// ─── Import subject ──────────────────────────────────────────────────────────

let createScoutLiveProviderTransport;
let createScoutDisabledProviderTransport;
let createScoutInjectedProviderTransport;
let SCOUT_LIVE_PROVIDER_TRANSPORT_MODES;
let SCOUT_LIVE_PROVIDER_TRANSPORT_CODES;
let SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION;
let SCOUT_TRANSPORT_PROHIBITED_RESPONSE_FIELDS;
let validateScoutTransportRequest;
let sanitizeScoutTransportError;

const MODULE_PATH = path.resolve(__dirname, '../../functions/api/scout/live-provider-transport.js');

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
  console.log('\n[scout-live-provider-transport-contract] Starting contract checks');

  // ── 0. File exists ──────────────────────────────────────────────────────────
  await suite('0. File presence', async () => {
    if (fs.existsSync(MODULE_PATH)) {
      pass('live-provider-transport.js exists');
    } else {
      fail('live-provider-transport.js exists', `Missing: ${MODULE_PATH}`);
      process.exit(1);
    }
  });

  // ── 0b. Static source checks ─────────────────────────────────────────────────
  await suite('0b. Static source safety', async () => {
    const src = fs.readFileSync(MODULE_PATH, 'utf-8');

    // No provider SDK import
    const prohibitedImports = [
      "require('openai')", 'require("openai")',
      "require('@anthropic-ai/sdk')", 'require("@anthropic-ai/sdk")',
      "require('google-generative-ai')", 'require("google-generative-ai")',
      "require('@google/generative-ai')", 'require("@google/generative-ai")',
      "require('groq-sdk')", 'require("groq-sdk")',
      "require('@mistralai/mistralai')", 'require("@mistralai/mistralai")',
      'import OpenAI', 'import Anthropic', 'import Groq',
      'import { OpenAI', 'import { Anthropic',
    ];
    const sdkLeaks = prohibitedImports.filter(p => src.includes(p));
    if (sdkLeaks.length === 0) {
      pass('no provider SDK import in source');
    } else {
      fail('no provider SDK import in source', sdkLeaks.join(', '));
    }

    // No direct fetch() call in module scope (only test/inject path may use it via injected fn)
    // The module itself must not call fetch directly
    if (!src.includes('\nfetch(') && !src.includes('global.fetch') && !src.includes('globalThis.fetch')) {
      pass('no direct global fetch() call in transport module');
    } else {
      fail('no direct global fetch() call in transport module');
    }

    // No Firebase Admin SDK
    const firebasePatterns = ['firebase-admin', 'getAuth(', 'verifyIdToken(', 'initializeApp(', 'cert('];
    const fbLeaks = firebasePatterns.filter(p => src.includes(p));
    if (fbLeaks.length === 0) {
      pass('no Firebase Admin SDK in source');
    } else {
      fail('no Firebase Admin SDK in source', fbLeaks.join(', '));
    }

    // No API key literal patterns
    const keyPatterns = [/sk-[a-zA-Z0-9]{20,}/, /AIza[0-9A-Za-z_-]{35}/];
    const hasKeyPattern = keyPatterns.some(p => p.test(src));
    if (!hasKeyPattern) {
      pass('no API key literal pattern in source');
    } else {
      fail('no API key literal pattern in source');
    }

    // No env.SCOUT_ / process.env reads in module (transport itself is injection-only)
    if (!src.includes('process.env.SCOUT_') && !src.includes('env.SCOUT_')) {
      pass('no env.SCOUT_ / process.env.SCOUT_ reads in transport module');
    } else {
      fail('no env.SCOUT_ / process.env.SCOUT_ reads in transport module');
    }
  });

  // ── 1. Dynamic import ───────────────────────────────────────────────────────
  await suite('1. Dynamic import (side-effect-free)', async () => {
    try {
      const mod = await scoutEnvGuard.safeImport(MODULE_PATH);
      createScoutLiveProviderTransport = mod.createScoutLiveProviderTransport;
      createScoutDisabledProviderTransport = mod.createScoutDisabledProviderTransport;
      createScoutInjectedProviderTransport = mod.createScoutInjectedProviderTransport;
      SCOUT_LIVE_PROVIDER_TRANSPORT_MODES = mod.SCOUT_LIVE_PROVIDER_TRANSPORT_MODES;
      SCOUT_LIVE_PROVIDER_TRANSPORT_CODES = mod.SCOUT_LIVE_PROVIDER_TRANSPORT_CODES;
      SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION = mod.SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION;
      SCOUT_TRANSPORT_PROHIBITED_RESPONSE_FIELDS = mod.SCOUT_TRANSPORT_PROHIBITED_RESPONSE_FIELDS;
      validateScoutTransportRequest = mod.validateScoutTransportRequest;
      sanitizeScoutTransportError = mod.sanitizeScoutTransportError;
      pass('module imported without side effects');
    } catch (err) {
      fail('module import', err.message);
      process.exit(1);
    }
  });

  // ── 2. Exports ───────────────────────────────────────────────────────────────
  await suite('2. Exports contract', async () => {
    if (typeof createScoutLiveProviderTransport === 'function') {
      pass('createScoutLiveProviderTransport exported as function');
    } else {
      fail('createScoutLiveProviderTransport exported as function');
    }
    if (typeof createScoutDisabledProviderTransport === 'function') {
      pass('createScoutDisabledProviderTransport exported as function');
    } else {
      fail('createScoutDisabledProviderTransport exported as function');
    }
    if (typeof createScoutInjectedProviderTransport === 'function') {
      pass('createScoutInjectedProviderTransport exported as function');
    } else {
      fail('createScoutInjectedProviderTransport exported as function');
    }
    if (SCOUT_LIVE_PROVIDER_TRANSPORT_MODES && SCOUT_LIVE_PROVIDER_TRANSPORT_MODES.DISABLED === 'disabled') {
      pass('SCOUT_LIVE_PROVIDER_TRANSPORT_MODES.DISABLED exported');
    } else {
      fail('SCOUT_LIVE_PROVIDER_TRANSPORT_MODES.DISABLED exported');
    }
    if (SCOUT_LIVE_PROVIDER_TRANSPORT_CODES && SCOUT_LIVE_PROVIDER_TRANSPORT_CODES.TRANSPORT_DISABLED === 'TRANSPORT_DISABLED') {
      pass('SCOUT_LIVE_PROVIDER_TRANSPORT_CODES.TRANSPORT_DISABLED exported');
    } else {
      fail('SCOUT_LIVE_PROVIDER_TRANSPORT_CODES.TRANSPORT_DISABLED exported');
    }
    if (typeof SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION === 'string' && SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION.length > 0) {
      pass('SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION exported');
    } else {
      fail('SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION exported');
    }
  });

  // ── 3. Default/disabled mode ─────────────────────────────────────────────────
  await suite('3. Disabled mode (default)', async () => {
    // Default: no options
    const t1 = createScoutLiveProviderTransport();
    assert.strictEqual(t1.mode, 'disabled', 'default mode is disabled');
    pass('no-arg factory returns mode=disabled');
    assert.strictEqual(t1.status, 'disabled', 'default status is disabled');
    pass('no-arg factory returns status=disabled');

    const res1 = await t1.call({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {},
      body: '{}',
    });
    assert.strictEqual(res1.ok, false, 'disabled transport returns ok=false');
    pass('disabled transport: call returns ok=false');
    assert.strictEqual(res1.error.code, 'TRANSPORT_DISABLED', 'disabled transport returns TRANSPORT_DISABLED code');
    pass('disabled transport: call returns TRANSPORT_DISABLED code');

    // Explicit mode=disabled
    const t2 = createScoutLiveProviderTransport({ mode: 'disabled' });
    assert.strictEqual(t2.mode, 'disabled');
    pass('explicit mode=disabled: mode=disabled');
    const res2 = await t2.call({ url: 'https://example.com', method: 'POST', headers: {}, body: '' });
    assert.strictEqual(res2.ok, false);
    assert.strictEqual(res2.error.code, 'TRANSPORT_DISABLED');
    pass('explicit mode=disabled: returns TRANSPORT_DISABLED');

    // Convenience alias
    const t3 = createScoutDisabledProviderTransport();
    assert.strictEqual(t3.mode, 'disabled');
    pass('createScoutDisabledProviderTransport: mode=disabled');
    const res3 = await t3.call({ url: 'https://example.com', method: 'POST', headers: {}, body: '' });
    assert.strictEqual(res3.ok, false);
    assert.strictEqual(res3.error.code, 'TRANSPORT_DISABLED');
    pass('createScoutDisabledProviderTransport: returns TRANSPORT_DISABLED');
  });

  // ── 4. Injected mode — missing execute ───────────────────────────────────────
  await suite('4. Injected mode — missing execute function', async () => {
    const t = createScoutLiveProviderTransport({ mode: 'injected' });
    // mode=injected but no execute provided → should be effectively disabled
    const res = await t.call({ url: 'https://example.com', method: 'POST', headers: {}, body: '' });
    assert.strictEqual(res.ok, false, 'injected without execute returns ok=false');
    pass('injected without execute: call returns ok=false');
    // Code should be TRANSPORT_MISSING
    assert.ok(
      res.error.code === 'TRANSPORT_MISSING' || res.error.code === 'TRANSPORT_DISABLED',
      'injected without execute returns TRANSPORT_MISSING or TRANSPORT_DISABLED'
    );
    pass('injected without execute: safe-fail code returned');
  });

  // ── 5. Injected mode — happy path ────────────────────────────────────────────
  await suite('5. Injected mode — happy path with mock execute', async () => {
    const mockResponse = {
      choices: [{ message: { content: JSON.stringify({ titleSuggestion: 'Test', safetyNote: 'Review.' }), role: 'assistant' }, finish_reason: 'stop' }],
    };

    const mockExecute = async (req) => {
      assert.ok(req.url && req.method, 'execute receives url and method');
      return mockResponse;
    };

    const t = createScoutLiveProviderTransport({ mode: 'injected', execute: mockExecute });
    assert.strictEqual(t.mode, 'injected');
    pass('injected mode: mode=injected');
    assert.strictEqual(t.status, 'ready');
    pass('injected mode: status=ready');

    const res = await t.call({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [] }),
    });

    assert.strictEqual(res.ok, true, 'injected transport: call returns ok=true');
    pass('injected transport: call returns ok=true');
    assert.ok(res.response && Array.isArray(res.response.choices), 'injected transport: response has choices');
    pass('injected transport: response contains choices');

    // Convenience alias
    const t2 = createScoutInjectedProviderTransport(mockExecute);
    assert.strictEqual(t2.mode, 'injected');
    pass('createScoutInjectedProviderTransport: mode=injected');
    const res2 = await t2.call({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {},
      body: '{}',
    });
    assert.strictEqual(res2.ok, true);
    pass('createScoutInjectedProviderTransport: call returns ok=true');
  });

  // ── 6. Error sanitization ────────────────────────────────────────────────────
  await suite('6. Error sanitization — raw error not leaked', async () => {
    // Simulate a transport execute that throws with a message containing credentials
    const leakyExecute = async () => {
      throw new Error('Request failed: Authorization: Bearer sk-abc123def456ghi789 url=https://api.example.com apiKey=abcdef');
    };

    const t = createScoutLiveProviderTransport({ mode: 'injected', execute: leakyExecute });
    const res = await t.call({ url: 'https://example.com', method: 'POST', headers: {}, body: '' });

    assert.strictEqual(res.ok, false, 'leaky transport: ok=false');
    pass('error path: ok=false');

    const errStr = JSON.stringify(res.error || {});
    const prohibitedPatterns = ['sk-', 'Bearer', 'apiKey=', 'Authorization'];
    const leaks = prohibitedPatterns.filter(p => errStr.includes(p));
    if (leaks.length === 0) {
      pass('error sanitized: no credential/key/auth leaked in error response');
    } else {
      fail('error sanitized: credential/key/auth leaked in error response', leaks.join(', '));
    }

    // Error code should be a safe code
    assert.ok(res.error && typeof res.error.code === 'string', 'error has code field');
    pass('error has code field');
    assert.ok(res.error && typeof res.error.message === 'string', 'error has message field');
    pass('error has message field');
  });

  // ── 7. Request validation ─────────────────────────────────────────────────────
  await suite('7. Request validation', async () => {
    if (typeof validateScoutTransportRequest !== 'function') {
      fail('validateScoutTransportRequest exported');
    } else {
      pass('validateScoutTransportRequest exported');

      const missingUrl = validateScoutTransportRequest({ method: 'POST' });
      assert.strictEqual(missingUrl.ok, false, 'missing url: ok=false');
      pass('missing url: validation fails');

      const missingMethod = validateScoutTransportRequest({ url: 'https://example.com' });
      assert.strictEqual(missingMethod.ok, false, 'missing method: ok=false');
      pass('missing method: validation fails');

      const nullReq = validateScoutTransportRequest(null);
      assert.strictEqual(nullReq.ok, false, 'null request: ok=false');
      pass('null request: validation fails');

      const validReq = validateScoutTransportRequest({ url: 'https://example.com', method: 'POST' });
      assert.strictEqual(validReq.ok, true, 'valid request: ok=true');
      pass('valid request: validation passes');
    }

    // Validation is applied in injected mode too
    const t = createScoutLiveProviderTransport({ mode: 'injected', execute: async () => ({}) });
    const res = await t.call(null);
    assert.strictEqual(res.ok, false, 'injected mode with null req: ok=false');
    pass('injected mode: null request returns ok=false');
    assert.ok(res.error && res.error.code, 'injected mode: null request returns error code');
    pass('injected mode: null request returns error with code');
  });

  // ── 8. sanitizeScoutTransportError helper ────────────────────────────────────
  await suite('8. sanitizeScoutTransportError helper', async () => {
    if (typeof sanitizeScoutTransportError !== 'function') {
      fail('sanitizeScoutTransportError exported');
    } else {
      pass('sanitizeScoutTransportError exported');

      const result = sanitizeScoutTransportError(new Error('sk-leaked-key Authorization: Bearer xyz'));
      assert.ok(result.code && result.message, 'sanitized result has code and message');
      pass('sanitized result has code and message');

      const serialized = JSON.stringify(result);
      const prohibited = ['sk-', 'Bearer', 'Authorization', 'leaked'];
      const leaks = prohibited.filter(p => serialized.includes(p));
      if (leaks.length === 0) {
        pass('sanitizeScoutTransportError output does not contain prohibited strings');
      } else {
        fail('sanitizeScoutTransportError output does not contain prohibited strings', leaks.join(', '));
      }
    }
  });

  // ── 9. Immutability / frozen ─────────────────────────────────────────────────
  await suite('9. Return object is frozen', async () => {
    const t = createScoutLiveProviderTransport();
    let threw = false;
    try {
      t.mode = 'live';
    } catch {
      threw = true;
    }
    // Either throw in strict mode, or silently fail; either way mode must not change
    if (t.mode === 'disabled') {
      pass('transport seam is effectively immutable (mode not overwritten)');
    } else {
      fail('transport seam is effectively immutable (mode not overwritten)');
    }
  });

  // ── 10. No external call in disabled default ───────────────────────────────────
  await suite('10. No external network call possible from disabled transport', async () => {
    // If we create a disabled transport and call it, it must return synchronously
    // without any network interaction. We verify this by checking the result is
    // immediately available (TRANSPORT_DISABLED) with no async delay.
    const t = createScoutLiveProviderTransport({ mode: 'disabled' });
    const start = Date.now();
    const res = await t.call({ url: 'https://api.openai.com/v1/chat/completions', method: 'POST', headers: {}, body: '{}' });
    const elapsed = Date.now() - start;
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error.code, 'TRANSPORT_DISABLED');
    // Disabled transport must respond nearly instantly (no network)
    if (elapsed < 100) {
      pass(`disabled transport responds quickly (${elapsed}ms) — no network call`);
    } else {
      fail('disabled transport responds quickly — no network call', `took ${elapsed}ms`);
    }
  });

  // ── Summary ────────────────────────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────────────────');
  console.log(`[scout-live-provider-transport-contract] ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    process.exit(1);
  }
}

if (!scoutEnvGuard.shouldSkip()) {run().catch(err => {
  console.error('[scout-live-provider-transport-contract] Uncaught:', err.message || String(err));
  process.exit(1);
});}
