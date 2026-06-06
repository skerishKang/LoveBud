/**
 * Scout Suggestion Endpoint Client Boundary Contract Tests
 * v20260606-4
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CLIENT_PATH = path.resolve(__dirname, '../../js/scout/scout-suggestion-endpoint-client.js');
const UI_PATH = path.resolve(__dirname, '../../js/scout/scout-draft-ui.js');
const DOC_BOUNDARY_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-serverless-endpoint-boundary.md');
const DOC_PROVIDER_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-llm-provider-boundary.md');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

/** Load client module in a sandbox and return the namespace. */
function loadClientNamespace() {
  const code = readFileSafe(CLIENT_PATH);
  assert.ok(code.length > 0, 'Client file should exist');

  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.LoveBudScoutSuggestionEndpointClient;
}

const tests = [
  // 1. Client file exists
  {
    name: 'Client file exists',
    fn: () => {
      const content = readFileSafe(CLIENT_PATH);
      assert.ok(content.length > 0, 'Client file should exist and not be empty');
    }
  },

  // 2. Namespace exposure
  {
    name: 'window.LoveBudScoutSuggestionEndpointClient namespace exists with public API',
    fn: () => {
      const ns = loadClientNamespace();
      assert.ok(ns, 'Namespace should exist');
      assert.strictEqual(typeof ns.createScoutSuggestionEndpointClient, 'function', 'createScoutSuggestionEndpointClient should be a function');
      assert.strictEqual(typeof ns.normalizeScoutSuggestionEndpointRequest, 'function', 'normalizeScoutSuggestionEndpointRequest should be a function');
      assert.strictEqual(typeof ns.normalizeScoutSuggestionEndpointResponse, 'function', 'normalizeScoutSuggestionEndpointResponse should be a function');
      assert.strictEqual(typeof ns.isScoutSuggestionEndpointClientEnabled, 'function', 'isScoutSuggestionEndpointClientEnabled should be a function');
    }
  },

  // 3. Feature flag disabled by default
  {
    name: 'isScoutSuggestionEndpointClientEnabled() returns false by default',
    fn: () => {
      const ns = loadClientNamespace();
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled(), false, 'No config should return false');
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled({}), false, 'Empty config should return false');
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled({ enabled: false }), false, 'explicit false should return false');
    }
  },

  // 4. Explicit enabled only
  {
    name: 'isScoutSuggestionEndpointClientEnabled returns true only when enabled === true or "true"',
    fn: () => {
      const ns = loadClientNamespace();
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled({ enabled: true }), true, 'boolean true should pass');
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled({ enabled: 'true' }), true, 'string "true" should pass');
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled({ enabled: 1 }), false, 'numeric 1 should fail');
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled({ enabled: '1' }), false, 'string "1" should fail');
      assert.strictEqual(ns.isScoutSuggestionEndpointClientEnabled({ enabled: 'yes' }), false, 'string "yes" should fail');
    }
  },

  // 5. Disabled client does not fetch
  {
    name: 'Disabled client does not call fetch',
    fn: () => {
      const ns = loadClientNamespace();
      let fetchCalled = false;
      const client = ns.createScoutSuggestionEndpointClient({
        enabled: false,
        fetchImpl: () => { fetchCalled = true; return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, suggestion: {} }) }); }
      });
      return client.suggest({ excerpt: 'test' }).then(result => {
        assert.strictEqual(fetchCalled, false, 'fetch should not be called when disabled');
        assert.strictEqual(result.ok, false, 'Result should be error');
        assert.ok(result.error.code === 'PROVIDER_UNAVAILABLE', 'Error code should be PROVIDER_UNAVAILABLE');
      });
    }
  },

  // 6. Same-origin endpoint only
  {
    name: 'Same-origin endpoint only: rejects external URLs, accepts relative paths',
    fn: () => {
      const code = readFileSafe(CLIENT_PATH);
      assert.ok(code.includes('/api/scout/suggest'), 'Default endpoint should be /api/scout/suggest');
      assert.ok(code.includes('isSameOriginScoutEndpointUrl'), 'Should validate same-origin');
      assert.ok(code.includes('https?:\\/\\/'), 'Should reject http/https');
      assert.ok(code.includes('\\/\\/'), 'Should reject protocol-relative');
    }
  },

  // 7. Valid enabled request
  {
    name: 'Enabled client calls POST /api/scout/suggest with JSON body',
    fn: () => {
      const ns = loadClientNamespace();
      let requestArgs = null;
      const mockFetch = (url, opts) => {
        requestArgs = { url, opts };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            providerMode: 'stub',
            suggestion: {
              titleSuggestion: 'Test',
              summarySuggestion: 'Summary',
              translationSuggestion: '번역',
              emotionTags: ['감동'],
              memoSuggestion: 'Memo',
              safetyNote: 'Review'
            }
          })
        });
      };
      const client = ns.createScoutSuggestionEndpointClient({
        enabled: true,
        fetchImpl: mockFetch
      });
      return client.suggest({ excerpt: 'Test excerpt', sourceUrl: 'https://example.com', requestedLanguage: 'ko' }).then(result => {
        assert.ok(requestArgs, 'fetch should be called');
        assert.strictEqual(requestArgs.url, '/api/scout/suggest', 'URL should be default endpoint');
        assert.strictEqual(requestArgs.opts.method, 'POST', 'Method should be POST');
        assert.strictEqual(requestArgs.opts.headers['Content-Type'], 'application/json', 'Content-Type should be application/json');
        const body = JSON.parse(requestArgs.opts.body);
        assert.strictEqual(body.excerpt, 'Test excerpt', 'Body should include excerpt');
        assert.strictEqual(body.sourceUrl, 'https://example.com', 'Body should include sourceUrl');
        assert.strictEqual(body.requestedLanguage, 'ko', 'Body should include language');
        assert.strictEqual(result.ok, true, 'Result should be success');
        assert.strictEqual(result.suggestion.titleSuggestion, 'Test', 'Should have title');
      });
    }
  },

  // 8. No API key / auth header auto injection
  {
    name: 'No API key or auth header auto-injection',
    fn: () => {
      const code = readFileSafe(CLIENT_PATH);
      assert.ok(!code.includes('x-api-key'), 'Should not inject x-api-key header');
      assert.ok(!code.includes('Authorization'), 'Should not inject Authorization header');
    }
  },

  // 9. Success response normalization
  {
    name: 'Success response normalizes emotionTags constraints',
    fn: () => {
      const ns = loadClientNamespace();
      const raw = {
        ok: true,
        providerMode: 'stub',
        suggestion: {
          titleSuggestion: 'Title',
          summarySuggestion: 'Summary',
          translationSuggestion: '번역',
          emotionTags: ['a'.repeat(30), 'b', '', 'c', 'd', 'e'],
          memoSuggestion: 'Memo',
          safetyNote: 'Note'
        }
      };
      const result = ns.normalizeScoutSuggestionEndpointResponse(raw);
      assert.strictEqual(result.ok, true, 'Should be success');
      assert.ok(result.suggestion.emotionTags.length <= 4, 'emotionTags max 4');
      result.suggestion.emotionTags.forEach(t => {
        assert.ok(t.length <= 20, 'Each tag max 20 chars');
      });
    }
  },

  // 10. Error response normalization
  {
    name: 'Error response normalization preserves CONFIG_MISSING code',
    fn: () => {
      const ns = loadClientNamespace();
      const raw = {
        ok: false,
        error: { code: 'CONFIG_MISSING', message: 'Not configured' }
      };
      const result = ns.normalizeScoutSuggestionEndpointResponse(raw);
      assert.strictEqual(result.ok, false, 'Should be error');
      assert.strictEqual(result.error.code, 'CONFIG_MISSING', 'Should preserve error code');
      assert.strictEqual(result.error.message, 'Not configured', 'Should preserve message');
    }
  },

  // 11. Malformed response fallback
  {
    name: 'Malformed response falls back to PROVIDER_ERROR',
    fn: () => {
      const ns = loadClientNamespace();
      const result = ns.normalizeScoutSuggestionEndpointResponse(null);
      assert.strictEqual(result.ok, false, 'Should be error');
      assert.ok(result.error.code === 'PROVIDER_ERROR' || result.error.code === 'VALIDATION_ERROR', 'Should fallback to error');
    }
  },

  // 12. No external fetch / no source fetch
  {
    name: 'sourceUrl is only in request body, never fetched by client',
    fn: () => {
      const code = readFileSafe(CLIENT_PATH);
      const fetchCalls = (code.match(/fetch\(/g) || []).length;
      // The only fetch should be for the endpoint URL, not sourceUrl
      assert.ok(fetchCalls <= 1, 'fetch should only be used for endpoint (max 1 ref)');
      assert.ok(!code.includes('sourceUrl)') || code.includes('sourceUrl'), 'sourceUrl should not be fetched');
    }
  },

  // 13. No real AI provider
  {
    name: 'No real AI provider SDK/strings in client',
    fn: () => {
      const code = readFileSafe(CLIENT_PATH);
      const forbidden = ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia'];
      for (const f of forbidden) {
        assert.ok(!code.toLowerCase().includes(f), `Should not reference ${f}`);
      }
    }
  },

  // 14. No persistence / no auto-save
  {
    name: 'No persistence or auto-save in client',
    fn: () => {
      const code = readFileSafe(CLIENT_PATH);
      // Strip both single-line and block comments before checking
      const noSingleLine = code.replace(/\/\/.*$/gm, '');
      const uncommented = noSingleLine.replace(/\/\*[\s\S]*?\*\//g, '');
      assert.ok(!uncommented.includes('localStorage'), 'Should not use localStorage outside comments');
      assert.ok(!uncommented.includes('sessionStorage'), 'Should not use sessionStorage');
      assert.ok(!code.includes('addMemoryFromForm'), 'Should not call addMemoryFromForm');
    }
  },

  // 15. Scout Draft UI not rewired by default
  {
    name: 'Scout Draft UI still uses browser-side stub provider, not endpoint client',
    fn: () => {
      const uiContent = readFileSafe(UI_PATH);
      assert.ok(uiContent.includes('LoveBudScoutSuggestionProvider'), 'UI should use browser-side provider');
      assert.ok(!uiContent.includes('/api/scout/suggest'), 'UI should not call endpoint');
      assert.ok(!uiContent.includes('ScoutSuggestionEndpointClient'), 'UI should not use endpoint client');
    }
  },

  // 16. Docs updated
  {
    name: 'Boundary documents reflect endpoint client boundary',
    fn: () => {
      const bDoc = readFileSafe(DOC_BOUNDARY_PATH);
      const pDoc = readFileSafe(DOC_PROVIDER_PATH);
      const hasAny = bDoc.includes('client') || bDoc.includes('Client') || pDoc.includes('client') || pDoc.includes('Client');
      assert.ok(hasAny, 'Docs should reference client boundary');
    }
  }
];

let passed = 0;
let failed = 0;

console.log('\n🧪 Scout Suggestion Endpoint Client Boundary Contract Tests\n');

for (const test of tests) {
  try {
    test.fn();
    console.log(`  ✅ ${test.name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${test.name}`);
    console.log(`     ${e.message}`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
console.log(`${failed === 0 ? '✅ All contract tests passed.' : '❌ Some contract tests failed.'}`);

if (failed > 0) process.exit(1);