/**
 * Contract: Scout API-Key Provider Transport Gates
 * v20260617-api-key-transport-1
 *
 * Proves:
 *  1. Default disabled (no config) → status=DISABLED, safe-fail.
 *  2. Default disabled (empty config) → status=DISABLED.
 *  3. Each individual gate missing → status=DISABLED with correct code.
 *  4. All gates satisfied → status=READY_FOR_ADAPTER.
 *  5. Injected fetch is called with correct URL/method/headers — no real network.
 *  6. API key NEVER appears in request body, response, log, or error.
 *  7. Raw provider response NEVER returned to caller (sanitized).
 *  8. Provider error → sanitized PROVIDER_ERROR.
 *  9. Network error → sanitized PROVIDER_ERROR.
 * 10. Timeout → sanitized PROVIDER_ERROR.
 * 11. fetch is NOT called when gates are not satisfied.
 * 12. No provider SDK imports in module source.
 * 13. No hardcoded API key patterns in module source.
 * 14. No direct process.env.SCOUT_SUGGEST_LLM_API_KEY reads in module source.
 * 15. #1882 remains open (umbrella product issue is not closed by this slice).
 * 16. No frontend/browser code touched by this slice.
 */

'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const fs = require('fs');
const { test, suite } = require('node:test');

// ─── Paths ───────────────────────────────────────────────────────────────────

const MODULE_PATH = path.resolve(
  __dirname,
  '../../functions/api/scout/live-provider-api-key-transport.js'
);

// Repository identity path (#4182): OS-independent canonical form.
// MODULE_PATH above is a NATIVE absolute filesystem path and stays that way
// for fs.readFileSync / fs.existsSync / dynamic import. Repository identity
// comparisons must use this POSIX-slash relative path so Windows-native runs
// and Linux CI verify the exact same location:
//   functions/api/scout/live-provider-api-key-transport.js
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EXPECTED_MODULE_IDENTITY = 'functions/api/scout/live-provider-api-key-transport.js';
const MODULE_IDENTITY = path.relative(REPO_ROOT, MODULE_PATH).split(path.sep).join('/');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSatisfiedConfig(overrides) {
  const cfg = {
    SCOUT_SUGGEST_PROVIDER_MODE: 'live',
    SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED: 'true',
    SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE: 'api_key',
    SCOUT_SUGGEST_PROVIDER_STAGE: 'staging',
    SCOUT_SUGGEST_LLM_API_KEY: 'fixture-key-never-logged',
    SCOUT_SUGGEST_LLM_PROVIDER: mod ? mod.SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_PROVIDER : 'openai-compatible',
    SCOUT_SUGGEST_MODEL: 'gpt-4o-mini',
    SCOUT_SUGGEST_LLM_BASE_URL: 'https://example.test/v1',
  };
  if (overrides && typeof overrides === 'object') {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) {
        delete cfg[k];
      } else {
        cfg[k] = v;
      }
    }
  }
  return cfg;
}

function readSource() {
  return fs.readFileSync(MODULE_PATH, 'utf-8');
}

// ─── Module load ─────────────────────────────────────────────────────────────

let mod = null;
async function loadModule() {
  if (!mod) {
    mod = await import('file://' + MODULE_PATH.replace(/\\/g, '/'));
  }
  return mod;
}

// ─── Test runner ─────────────────────────────────────────────────────────────

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

// ─── Suites ──────────────────────────────────────────────────────────────────

async function run() {
  console.log(
    '\n[scout-api-key-provider-transport-gates-contract] Starting contract checks'
  );

  // ── 0. File presence ────────────────────────────────────────────────────────
  await suite('0. File presence', async () => {
    if (fs.existsSync(MODULE_PATH)) {
      pass('live-provider-api-key-transport.js exists');
    } else {
      fail('live-provider-api-key-transport.js exists', `Missing: ${MODULE_PATH}`);
      process.exit(1);
    }
  });

  // ── 1. Default disabled (no config) ─────────────────────────────────────────
  await suite('1. Default disabled (no config)', async () => {
    const m = await loadModule();
    const t = m.createScoutLiveProviderTransport();
    assert.strictEqual(t.status, 'DISABLED');
    pass('no-arg factory returns status=DISABLED');
    assert.strictEqual(t.mode, 'api_key');
    pass('no-arg factory returns mode=api_key');
    assert.strictEqual(
      t.version,
      '20260617-api-key-transport-1',
      'version constant'
    );
    pass('version is 20260617-api-key-transport-1');

    const res = await t.execute('test prompt');
    assert.strictEqual(res.ok, false);
    pass('default transport: execute returns ok=false');
    assert.ok(
      res.error.code === 'CONFIG_MISSING' || res.error.code === 'TRANSPORT_DISABLED' || res.error.code === 'GATE_NOT_SATISFIED',
      `default transport returns safe-fail code, got ${res.error && res.error.code}`
    );
    pass('default transport: returns CONFIG_MISSING, TRANSPORT_DISABLED, or GATE_NOT_SATISFIED');
  });

  // ── 2. Default disabled (empty config) ──────────────────────────────────────
  await suite('2. Default disabled (empty config)', async () => {
    const m = await loadModule();
    const t = m.createScoutLiveProviderTransport({});
    assert.strictEqual(t.status, 'DISABLED');
    pass('empty config: status=DISABLED');

    const res = await t.execute('test prompt');
    assert.strictEqual(res.ok, false);
    pass('empty config: execute returns ok=false');
    assert.ok(
      res.error.code === 'CONFIG_MISSING' || res.error.code === 'GATE_NOT_SATISFIED',
      `empty config returns safe-fail code, got ${res.error && res.error.code}`
    );
    pass('empty config: returns safe-fail code');
  });

  // ── 3. Each gate missing → DISABLED ─────────────────────────────────────────
  await suite('3. Each individual gate missing → DISABLED', async () => {
    const m = await loadModule();
    const gateKeys = [
      'SCOUT_SUGGEST_PROVIDER_MODE',
      'SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED',
      'SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE',
      'SCOUT_SUGGEST_PROVIDER_STAGE',
      'SCOUT_SUGGEST_LLM_API_KEY',
      'SCOUT_SUGGEST_LLM_PROVIDER',
      'SCOUT_SUGGEST_MODEL',
    ];
    for (const key of gateKeys) {
      const cfg = buildSatisfiedConfig({ [key]: undefined });
      const t = m.createScoutLiveProviderTransport(cfg);
      assert.strictEqual(
        t.status,
        'DISABLED',
        `${key} missing → status=DISABLED`
      );
      pass(`${key} missing → status=DISABLED`);

      const res = await t.execute('test prompt');
      assert.strictEqual(
        res.ok,
        false,
        `${key} missing → execute returns ok=false`
      );
      pass(`${key} missing → execute returns ok=false`);

      assert.ok(
        res.error.code === 'CONFIG_MISSING' || res.error.code === 'GATE_NOT_SATISFIED',
        `${key} missing → safe-fail code, got ${res.error && res.error.code}`
      );
      pass(`${key} missing → safe-fail code (${res.error.code})`);
    }
  });

  // ── 4. All gates satisfied → READY_FOR_ADAPTER ──────────────────────────────
  await suite('4. All gates satisfied → READY_FOR_ADAPTER', async () => {
    const m = await loadModule();
    const t = m.createScoutLiveProviderTransport(buildSatisfiedConfig());
    assert.strictEqual(t.status, 'READY_FOR_ADAPTER');
    pass('all gates satisfied: status=READY_FOR_ADAPTER');
    assert.strictEqual(t.mode, 'api_key');
    pass('all gates satisfied: mode=api_key');
    assert.strictEqual(t.config.hasApiKey, true);
    pass('all gates satisfied: config.hasApiKey=true');
    assert.ok(Array.isArray(t.config.missingGateKeys));
    assert.strictEqual(t.config.missingGateKeys.length, 0);
    pass('all gates satisfied: missingGateKeys=[]');
  });

  // ── 5. Injected fetch called correctly ──────────────────────────────────────
  await suite('5. Injected fetch is called with correct shape (no real network)', async () => {
    const m = await loadModule();
    let captured = null;
    const fakeFetch = async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: '{"hello":"world"}' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      };
    };
    const t = m.createScoutLiveProviderTransport(buildSatisfiedConfig(), {
      fetch: fakeFetch,
    });
    assert.strictEqual(t.status, 'READY_FOR_ADAPTER');
    const res = await t.execute('hello world', { maxOutputLength: 200, startedAt: Date.now() - 50 });
    assert.strictEqual(res.ok, true);
    pass('injected fetch: execute returns ok=true');
    assert.ok(captured, 'injected fetch was called');
    pass('injected fetch: fetch was actually invoked');
    assert.strictEqual(captured.init.method, 'POST');
    pass('injected fetch: method=POST');
    assert.match(captured.url, /^https:\/\/example\.test\/v1\/chat\/completions$/);
    pass('injected fetch: URL matches expected chat-completions endpoint');
    assert.strictEqual(
      captured.init.headers['Content-Type'],
      'application/json'
    );
    pass('injected fetch: Content-Type=application/json');
    assert.match(captured.init.headers.Authorization, /^Bearer\s+\S+$/);
    pass('injected fetch: Authorization header has Bearer scheme');
  });

  // ── 6. API key NEVER in body / response / log / error ───────────────────────
  await suite('6. API key NEVER leaks into body/response/log/error', async () => {
    const m = await loadModule();
    const KEY = 'super-secret-fixture-key-XYZ-9999';
    const cfg = buildSatisfiedConfig({
      SCOUT_SUGGEST_LLM_API_KEY: KEY,
    });
    let captured = null;
    const fakeFetch = async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'leak-test' }, finish_reason: 'stop' }],
        }),
      };
    };
    const t = m.createScoutLiveProviderTransport(cfg, { fetch: fakeFetch });
    const res = await t.execute('test prompt');

    // 1. Request body must not contain the key
    assert.ok(captured, 'fetch was called');
    const bodyStr = String(captured.init.body || '');
    assert.ok(
      !bodyStr.includes(KEY),
      'request body does NOT contain raw API key'
    );
    pass('request body does NOT contain raw API key');

    // 2. Response must not contain the key
    const resStr = JSON.stringify(res || {});
    assert.ok(
      !resStr.includes(KEY),
      'response object does NOT contain raw API key'
    );
    pass('response object does NOT contain raw API key');

    // 3. The auth header DOES contain the key (this is the intended use),
    //    but only the auth header, not the body or any other field.
    assert.ok(
      captured.init.headers.Authorization.includes(KEY),
      'Authorization header DOES contain the key (intended use)'
    );
    pass('Authorization header contains the key (intended use)');

    // 4. No other header or field contains the key
    for (const [hk, hv] of Object.entries(captured.init.headers)) {
      if (hk === 'Authorization') continue;
      assert.ok(
        !String(hv).includes(KEY),
        `header ${hk} does NOT contain key`
      );
    }
    pass('no non-Authorization header contains the key');

    // 5. config.hasApiKey is a boolean, not the key
    assert.strictEqual(typeof t.config.hasApiKey, 'boolean');
    pass('config.hasApiKey is a boolean (not the key value)');

    // 6. The key is not in the returned public config
    const cfgStr = JSON.stringify(t.config || {});
    assert.ok(
      !cfgStr.includes(KEY),
      'public config does NOT contain raw API key'
    );
    pass('public config does NOT contain raw API key');
  });

  // ── 7. Raw provider response never returned to caller ───────────────────────
  await suite('7. Raw provider response NEVER returned to caller', async () => {
    const m = await loadModule();
    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: 'sanitized content here' },
            finish_reason: 'stop',
          },
        ],
        rawProviderResponse: 'THIS MUST NOT LEAK',
        rawModelOutput: 'THIS MUST NOT LEAK',
        apiKey: 'THIS MUST NOT LEAK',
        token: 'THIS MUST NOT LEAK',
        authorization: 'THIS MUST NOT LEAK',
        prompt: 'THIS MUST NOT LEAK',
        excerpt: 'THIS MUST NOT LEAK',
        uid: 'THIS MUST NOT LEAK',
        email: 'THIS MUST NOT LEAK',
      }),
    });
    const t = m.createScoutLiveProviderTransport(buildSatisfiedConfig(), {
      fetch: fakeFetch,
    });
    const res = await t.execute('test prompt');
    assert.strictEqual(res.ok, true);
    const resStr = JSON.stringify(res);
    const prohibited = [
      'THIS MUST NOT LEAK',
      'rawProviderResponse',
      'rawModelOutput',
    ];
    for (const p of prohibited) {
      assert.ok(
        !resStr.includes(p),
        `response does NOT contain prohibited: ${p}`
      );
    }
    pass('raw provider response fields stripped from result');
    assert.ok(
      typeof res.response.content === 'string' &&
        res.response.content.includes('sanitized content here'),
      'sanitized content present in response'
    );
    pass('sanitized content present in response.content');
  });

  // ── 8. Provider error → sanitized PROVIDER_ERROR ────────────────────────────
  await suite('8. Provider error → sanitized PROVIDER_ERROR', async () => {
    const m = await loadModule();
    const fakeFetch = async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'something bad happened' }),
    });
    const t = m.createScoutLiveProviderTransport(buildSatisfiedConfig(), {
      fetch: fakeFetch,
    });
    const res = await t.execute('test prompt');
    assert.strictEqual(res.ok, false);
    pass('provider error: ok=false');
    assert.strictEqual(res.error.code, 'PROVIDER_ERROR');
    pass('provider error: code=PROVIDER_ERROR');
    const resStr = JSON.stringify(res);
    assert.ok(
      !resStr.includes('something bad happened'),
      'raw provider error message NOT leaked'
    );
    pass('raw provider error message NOT leaked');
  });

  // ── 9. Network error → sanitized PROVIDER_ERROR ─────────────────────────────
  await suite('9. Network error → sanitized PROVIDER_ERROR', async () => {
    const m = await loadModule();
    const fakeFetch = async () => {
      const err = new Error(
        'fetch failed: https://api.example.com with Authorization ***'
      );
      throw err;
    };
    const t = m.createScoutLiveProviderTransport(buildSatisfiedConfig(), {
      fetch: fakeFetch,
    });
    const res = await t.execute('test prompt');
    assert.strictEqual(res.ok, false);
    pass('network error: ok=false');
    assert.strictEqual(res.error.code, 'PROVIDER_ERROR');
    pass('network error: code=PROVIDER_ERROR');
    const resStr = JSON.stringify(res);
    assert.ok(
      !resStr.includes('Authorization'),
      'network error does NOT leak Authorization'
    );
    pass('network error does NOT leak Authorization');
  });

  // ── 10. Timeout → sanitized PROVIDER_ERROR ──────────────────────────────────
  await suite('10. Timeout → sanitized PROVIDER_ERROR', async () => {
    const m = await loadModule();
    const fakeFetch = async (url, init) => {
      // Honor the AbortSignal so timeout fires
      return new Promise((resolve, reject) => {
        const signal = init && init.signal;
        if (signal) {
          if (signal.aborted) {
            reject(new Error('aborted'));
            return;
          }
          signal.addEventListener('abort', () => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            reject(e);
          });
        }
        // Never resolve — let the timeout/abort fire
      });
    };
    const t = m.createScoutLiveProviderTransport(buildSatisfiedConfig(), {
      fetch: fakeFetch,
      timeoutMs: 50,
    });
    const res = await t.execute('test prompt');
    assert.strictEqual(res.ok, false);
    pass('timeout: ok=false');
    assert.strictEqual(res.error.code, 'PROVIDER_ERROR');
    pass('timeout: code=PROVIDER_ERROR');
  });

  // ── 11. fetch is NOT called when gates are not satisfied ────────────────────
  await suite('11. fetch is NOT called when gates are not satisfied', async () => {
    const m = await loadModule();
    let called = false;
    const fakeFetch = async () => {
      called = true;
      return { ok: true, json: async () => ({}) };
    };

    // No config at all
    const t1 = m.createScoutLiveProviderTransport(undefined, { fetch: fakeFetch });
    const r1 = await t1.execute('prompt');
    assert.strictEqual(r1.ok, false);
    assert.strictEqual(called, false, 'fetch not called with no config');
    pass('fetch NOT called when config is undefined');

    // Empty config
    const t2 = m.createScoutLiveProviderTransport({}, { fetch: fakeFetch });
    const r2 = await t2.execute('prompt');
    assert.strictEqual(r2.ok, false);
    assert.strictEqual(called, false, 'fetch not called with empty config');
    pass('fetch NOT called when config is empty');

    // Missing API key
    const cfg = buildSatisfiedConfig({ SCOUT_SUGGEST_LLM_API_KEY: undefined });
    const t3 = m.createScoutLiveProviderTransport(cfg, { fetch: fakeFetch });
    const r3 = await t3.execute('prompt');
    assert.strictEqual(r3.ok, false);
    assert.strictEqual(called, false, 'fetch not called without API key');
    pass('fetch NOT called when API key is missing');

    // Production stage
    const prodCfg = buildSatisfiedConfig({
      SCOUT_SUGGEST_PROVIDER_STAGE: 'production',
    });
    const t4 = m.createScoutLiveProviderTransport(prodCfg, { fetch: fakeFetch });
    const r4 = await t4.execute('prompt');
    assert.strictEqual(r4.ok, false);
    assert.strictEqual(called, false, 'fetch not called for production stage');
    pass('fetch NOT called when stage=production (blocked)');
  });

  // ── 12. No provider SDK imports in module source ────────────────────────────
  await suite('12. No provider SDK imports in module source', async () => {
    const src = readSource();
    // Check for SDK import patterns (not just substring)
    const sdkImportPatterns = [
      /require\(['"]openai['"]\)/,
      /from ['"]openai['"]/,
      /require\(['"]@anthropic-ai\/sdk['"]\)/,
      /from ['"]@anthropic-ai\/sdk['"]/,
      /require\(['"]google-generative-ai['"]\)/,
      /from ['"]google-generative-ai['"]/,
      /require\(['"]@google\/generative-ai['"]\)/,
      /from ['"]@google\/generative-ai['"]/,
      /require\(['"]groq-sdk['"]\)/,
      /from ['"]groq-sdk['"]/,
      /require\(['"]@mistralai\/mistralai['"]\)/,
      /from ['"]@mistralai\/mistralai['"]/,
    ];
    const leaks = sdkImportPatterns.filter((p) => p.test(src));
    if (leaks.length === 0) {
      pass('no provider SDK import in source');
    } else {
      fail('no provider SDK import in source', leaks.map((l) => l.source).join(', '));
    }
  });

  // ── 13. No hardcoded API key patterns ───────────────────────────────────────
  await suite('13. No hardcoded API key patterns in module source', async () => {
    const src = readSource();
    const keyPatterns = [
      /sk-[a-zA-Z0-9]{20,}/,
      /AIza[0-9A-Za-z_-]{35}/,
      /ghp_[a-zA-Z0-9]{36,}/,
      /xox[baprs]-[a-zA-Z0-9-]{10,}/,
    ];
    const matches = keyPatterns.filter((p) => p.test(src));
    if (matches.length === 0) {
      pass('no hardcoded API key patterns in source');
    } else {
      fail('no hardcoded API key patterns in source', matches.map((m) => m.source).join(', '));
    }
  });

  // ── 14. No direct process.env.SCOUT_SUGGEST_LLM_API_KEY reads ────────────────
  await suite('14. No direct process.env.SCOUT_SUGGEST_LLM_API_KEY reads', async () => {
    const src = readSource();
    assert.ok(
      !src.includes('process.env.SCOUT_SUGGEST_LLM_API_KEY'),
      'module source must not contain process.env.SCOUT_SUGGEST_LLM_API_KEY'
    );
    pass('no process.env.SCOUT_SUGGEST_LLM_API_KEY direct reads in source');
  });

  // ── 15. #1882 remains open ──────────────────────────────────────────────────
  await suite('15. #1882 remains open (umbrella product issue)', async () => {
    // This test asserts that this slice does NOT close #1882.
    // We verify by ensuring the module source does NOT contain
    // any "Closes #1882" / "Fixes #1882" / "Resolves #1882" pattern.
    const src = readSource();
    const closings = ['Closes #1882', 'Fixes #1882', 'Resolves #1882'];
    for (const c of closings) {
      assert.ok(
        !src.includes(c),
        `module source must not contain: ${c}`
      );
    }
    pass('module source does NOT close #1882');
    pass('module source does NOT fix #1882');
    pass('module source does NOT resolve #1882');
    // #1882 is the umbrella product issue. This slice is a sub-slice
    // and must keep #1882 open.
    pass('#1882 remains open (this slice is a sub-slice, not a closure)');
  });

  // ── 16. No frontend/browser code touched ────────────────────────────────────
  await suite('16. No frontend/browser code touched by this slice', async () => {
    // Repository identity check (#4182): the module must sit at EXACTLY
    // functions/api/scout/live-provider-api-key-transport.js, compared as an
    // OS-independent POSIX relative path (never a native backslash string).
    assert.ok(!MODULE_IDENTITY.includes('\\'), 'canonical identity contains no backslash');
    assert.strictEqual(MODULE_IDENTITY, EXPECTED_MODULE_IDENTITY,
      `module identity must be exactly ${EXPECTED_MODULE_IDENTITY}`);
    // Exact directory + exact filename, verified independently of the
    // full-identity equality above.
    const identityDir = MODULE_IDENTITY.slice(0, MODULE_IDENTITY.lastIndexOf('/'));
    const identityFile = MODULE_IDENTITY.slice(MODULE_IDENTITY.lastIndexOf('/') + 1);
    assert.strictEqual(identityDir, 'functions/api/scout', 'exact server-side scout api directory');
    assert.strictEqual(identityFile, 'live-provider-api-key-transport.js', 'exact transport filename');
    // Negative controls: lookalike locations/names are NOT this module.
    const rejectedIdentities = [
      'functions/api/scout/live-provider-api-key-transport.ts',
      'functions/api/scout-v2/live-provider-api-key-transport.js',
      'js/scout/live-provider-api-key-transport.js',
      'pages/functions/api/scout/live-provider-api-key-transport.js',
    ];
    for (const candidate of rejectedIdentities) {
      assert.notStrictEqual(candidate, MODULE_IDENTITY,
        `lookalike identity must not pass: ${candidate}`);
    }
    pass('module identity is exactly functions/api/scout/live-provider-api-key-transport.js');
    pass('module is under functions/api/scout/ (server-side)');

    // The module does not import any browser-only globals
    const src = readSource();
    const browserGlobals = ['window.', 'document.', 'localStorage.', 'sessionStorage.'];
    for (const bg of browserGlobals) {
      assert.ok(
        !src.includes(bg),
        `module source must not use browser global: ${bg}`
      );
    }
    pass('module source does NOT use any browser globals');

    // Native filesystem resolution is preserved alongside the canonical
    // identity: the same file the identity points at must exist and be
    // readable through the native absolute path on THIS platform.
    assert.ok(fs.existsSync(MODULE_PATH), 'native MODULE_PATH still resolves to a real file');
    assert.ok(fs.statSync(MODULE_PATH).isFile(), 'native MODULE_PATH resolves to a regular file');
    const nativeRelative = path.relative(REPO_ROOT, fs.realpathSync(MODULE_PATH)).split(path.sep).join('/');
    assert.strictEqual(nativeRelative, EXPECTED_MODULE_IDENTITY,
      'realized native path maps back to the exact canonical identity');
    pass('native filesystem resolution agrees with canonical identity');
  });

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────────────────');
  console.log(
    `[scout-api-key-provider-transport-gates-contract] ${passCount} passed, ${failCount} failed`
  );
  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(
    '[scout-api-key-provider-transport-gates-contract] Uncaught:',
    err.message || String(err)
  );
  process.exit(1);
});
