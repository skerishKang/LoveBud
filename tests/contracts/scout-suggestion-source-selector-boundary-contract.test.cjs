/**
 * Scout Suggestion Source Selector Boundary Contract Tests
 * v20260606-1
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SELECTOR_PATH = path.resolve(__dirname, '../../js/scout/scout-suggestion-source-selector.js');
const UI_PATH = path.resolve(__dirname, '../../js/scout/scout-draft-ui.js');
const PROVIDER_PATH = path.resolve(__dirname, '../../js/scout/scout-suggestion-provider.js');
const ENDPOINT_CLIENT_PATH = path.resolve(__dirname, '../../js/scout/scout-suggestion-endpoint-client.js');
const DOC_BOUNDARY_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-serverless-endpoint-boundary.md');
const DOC_PROVIDER_PATH = path.resolve(__dirname, '../../docs/product/lovebud-scout-llm-provider-boundary.md');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

/** Helper: create sandbox with prerequisite namespaces loaded */
function createSandboxWithPrereqs() {
  const providerCode = readFileSafe(PROVIDER_PATH);
  const endpointClientCode = readFileSafe(ENDPOINT_CLIENT_PATH);
  const selectorCode = readFileSafe(SELECTOR_PATH);

  const sandbox = { window: {}, console };
  vm.createContext(sandbox);

  // Load provider and endpoint client into sandbox first
  if (providerCode) vm.runInContext(providerCode, sandbox);
  if (endpointClientCode) vm.runInContext(endpointClientCode, sandbox);

  return { sandbox, selectorCode };
}

/** Load selector namespace in a fresh sandbox with prerequisites */
function loadSelectorNamespace() {
  const { sandbox, selectorCode } = createSandboxWithPrereqs();
  assert.ok(selectorCode.length > 0, 'Selector file should exist');
  vm.runInContext(selectorCode, sandbox);
  return sandbox.window.LoveBudScoutSuggestionSourceSelector;
}

/** Load the provider namespace for stub provider tests */
function loadProviderNamespace() {
  const code = readFileSafe(PROVIDER_PATH);
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.LoveBudScoutSuggestionProvider;
}

const tests = [
  // 1. Selector file exists
  {
    name: 'Selector file exists',
    fn: () => {
      const content = readFileSafe(SELECTOR_PATH);
      assert.ok(content.length > 0, 'Selector file should exist and not be empty');
    }
  },

  // 2. Namespace/public API
  {
    name: 'window.LoveBudScoutSuggestionSourceSelector namespace exists with public API',
    fn: () => {
      const ns = loadSelectorNamespace();
      assert.ok(ns, 'Namespace should exist');
      assert.ok(ns.SCOUT_SUGGESTION_SOURCES, 'SCOUT_SUGGESTION_SOURCES should exist');
      assert.strictEqual(typeof ns.SCOUT_SUGGESTION_SOURCES.LOCAL_STUB, 'string', 'LOCAL_STUB should be a string');
      assert.strictEqual(typeof ns.SCOUT_SUGGESTION_SOURCES.ENDPOINT_CLIENT, 'string', 'ENDPOINT_CLIENT should be a string');
      assert.strictEqual(typeof ns.resolveScoutSuggestionSource, 'function', 'resolveScoutSuggestionSource should be a function');
      assert.strictEqual(typeof ns.createScoutSuggestionSourceProvider, 'function', 'createScoutSuggestionSourceProvider should be a function');
    }
  },

  // 3. Default local stub (no config)
  {
    name: 'resolveScoutSuggestionSource with no config returns local_stub',
    fn: () => {
      const ns = loadSelectorNamespace();
      const result = ns.resolveScoutSuggestionSource();
      assert.strictEqual(result.source, ns.SCOUT_SUGGESTION_SOURCES.LOCAL_STUB, 'No config should return local_stub');
      assert.strictEqual(result.enabled, false, 'No config should return enabled=false');
      assert.ok(typeof result.reason === 'string', 'Reason should be a string');
    }
  },

  // 4. Explicit local stub
  {
    name: 'resolveScoutSuggestionSource with source:"local_stub" returns local_stub',
    fn: () => {
      const ns = loadSelectorNamespace();
      const result = ns.resolveScoutSuggestionSource({ source: 'local_stub' });
      assert.strictEqual(result.source, ns.SCOUT_SUGGESTION_SOURCES.LOCAL_STUB, 'Explicit local_stub should be accepted');
      assert.strictEqual(result.enabled, true, 'Explicit local_stub should return enabled=true');
    }
  },

  // 5. Endpoint disabled fallback
  {
    name: 'resolveScoutSuggestionSource with endpoint_client + disabled flag falls back to local_stub',
    fn: () => {
      const ns = loadSelectorNamespace();
      const result = ns.resolveScoutSuggestionSource({
        source: 'endpoint_client',
        endpointClientEnabled: false
      });
      assert.strictEqual(result.source, ns.SCOUT_SUGGESTION_SOURCES.LOCAL_STUB, 'Disabled endpoint should fall back to local_stub');
      assert.strictEqual(result.enabled, false, 'Disabled endpoint should return enabled=false');
    }
  },

  // 6. Endpoint explicit enabled
  {
    name: 'resolveScoutSuggestionSource with endpoint_client + enabled flag returns endpoint_client',
    fn: () => {
      const ns = loadSelectorNamespace();
      const result = ns.resolveScoutSuggestionSource({
        source: 'endpoint_client',
        endpointClientEnabled: true
      });
      assert.strictEqual(result.source, ns.SCOUT_SUGGESTION_SOURCES.ENDPOINT_CLIENT, 'Enabled endpoint should select endpoint_client');
      assert.strictEqual(result.enabled, true, 'Enabled endpoint should return enabled=true');
    }
  },

  // 7. Unknown source fallback
  {
    name: 'resolveScoutSuggestionSource with unknown source falls back to local_stub',
    fn: () => {
      const ns = loadSelectorNamespace();
      const result = ns.resolveScoutSuggestionSource({ source: 'unknown_source' });
      assert.strictEqual(result.source, ns.SCOUT_SUGGESTION_SOURCES.LOCAL_STUB, 'Unknown source should fall back to local_stub');
      assert.strictEqual(result.enabled, false, 'Unknown source should return enabled=false');
    }
  },

  // 8. No storage/query auto enable
  {
    name: 'Selector source code does not read localStorage, sessionStorage, or location.search',
    fn: () => {
      const content = readFileSafe(SELECTOR_PATH);
      // Should not reference storage or query params for feature flag reading
      assert.ok(!content.includes('localStorage'), 'Should not read localStorage');
      assert.ok(!content.includes('sessionStorage'), 'Should not read sessionStorage');
      assert.ok(!content.includes('location.search'), 'Should not read location.search');
      assert.ok(!content.includes('location.href'), 'Should not read location.href for auto-enable');
      assert.ok(!content.includes('URLSearchParams'), 'Should not read URL query params');
    }
  },

  // 9. Source provider default uses local stub
  {
    name: 'createScoutSuggestionSourceProvider() default creates a local stub provider',
    fn: () => {
      const ns = loadSelectorNamespace();
      const provider = ns.createScoutSuggestionSourceProvider();
      assert.ok(provider, 'Provider should be created');
      assert.strictEqual(typeof provider.suggest, 'function', 'Provider should have suggest function');
      assert.strictEqual(typeof provider.getMeta, 'function', 'Provider should have getMeta function');

      const meta = provider.getMeta();
      // Should be stub provider (name contains Stub)
      assert.ok(
        meta.name && meta.name.includes('Stub'),
        'Default provider should be stub provider, got: ' + meta.name
      );
      assert.strictEqual(meta.deterministic, true, 'Stub provider should be deterministic');
      assert.strictEqual(meta.network, false, 'Stub provider should have network=false');
      assert.strictEqual(meta.apiKey, false, 'Stub provider should have apiKey=false');
    }
  },

  // 10. Endpoint provider only behind explicit flag
  {
    name: 'createScoutSuggestionSourceProvider with endpoint_client + enabled creates endpoint client provider',
    fn: () => {
      const { sandbox, selectorCode } = createSandboxWithPrereqs();

      // Create a mock fetch that records calls
      let fetchCalled = false;
      const mockFetch = async (url, options) => {
        fetchCalled = true;
        return {
          ok: true,
          json: async () => ({
            ok: true,
            providerMode: 'stub',
            suggestion: {
              titleSuggestion: 'Test',
              summarySuggestion: 'Test summary',
              translationSuggestion: '',
              emotionTags: ['curious'],
              memoSuggestion: 'Test memo',
              safetyNote: 'Test'
            }
          })
        };
      };

      // Create sandbox with mock fetch visible
      // We need mockFetch in the sandbox for the endpoint client
      const code = readFileSafe(SELECTOR_PATH);
      const providerCode = readFileSafe(PROVIDER_PATH);
      const endpointCode = readFileSafe(ENDPOINT_CLIENT_PATH);

      const sbox = {
        window: {},
        console,
        fetch: mockFetch
      };
      vm.createContext(sbox);
      vm.runInContext(providerCode, sbox);
      vm.runInContext(endpointCode, sbox);
      vm.runInContext(code, sbox);

      const ns = sbox.window.LoveBudScoutSuggestionSourceSelector;
      const provider = ns.createScoutSuggestionSourceProvider({
        source: 'endpoint_client',
        endpointClientEnabled: true,
        endpointClientOptions: {
          endpointUrl: '/api/scout/suggest',
          fetchImpl: mockFetch
        }
      });

      assert.ok(provider, 'Provider should be created');
      const meta = provider.getMeta();
      assert.strictEqual(meta.name, 'ScoutSuggestionEndpointClient', 'Should create endpoint client');
      assert.strictEqual(meta.enabled, true, 'Endpoint client should be enabled');
    }
  },

  // 11. Endpoint client absent fallback
  {
    name: 'createScoutSuggestionSourceProvider falls back to stub when endpoint client namespace is absent',
    fn: () => {
      // Load selector in sandbox WITHOUT endpoint client loaded
      const selectorCode = readFileSafe(SELECTOR_PATH);
      const providerCode = readFileSafe(PROVIDER_PATH);

      const sandbox = { window: {}, console };
      vm.createContext(sandbox);
      // Only load provider, NOT endpoint client
      vm.runInContext(providerCode, sandbox);
      vm.runInContext(selectorCode, sandbox);

      const ns = sandbox.window.LoveBudScoutSuggestionSourceSelector;
      const provider = ns.createScoutSuggestionSourceProvider({
        source: 'endpoint_client',
        endpointClientEnabled: true
      });

      assert.ok(provider, 'Provider should be created (fallback)');
      const meta = provider.getMeta();
      assert.ok(
        meta.name && (meta.name.includes('Stub') || meta.name.includes('Unavailable')),
        'Should fall back to stub or unavailable, got: ' + meta.name
      );
    }
  },

  // 12. Scout Draft UI default behavior preserved
  {
    name: 'Scout Draft UI handleSuggest does not call endpoint client by default',
    fn: () => {
      const uiContent = readFileSafe(UI_PATH);
      assert.ok(uiContent.length > 0, 'UI file should exist');

      // Verify that default handleSuggest uses source selector or stub provider, not endpoint client
      // The handleSuggest should reference ScoutSuggestionProvider.createScoutStubSuggestionProvider
      // or LoveBudScoutSuggestionSourceSelector, NOT createScoutSuggestionEndpointClient directly
      const hasDirectEndpointCall = uiContent.includes('createScoutSuggestionEndpointClient');
      assert.strictEqual(hasDirectEndpointCall, false,
        'UI should not call createScoutSuggestionEndpointClient directly in handleSuggest');
    }
  },

  // 13. No real AI provider
  {
    name: 'Selector file does not contain real AI provider names or SDK imports',
    fn: () => {
      const content = readFileSafe(SELECTOR_PATH);
      const forbiddenProviders = ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'nvidia'];
      for (const provider of forbiddenProviders) {
        // Allow comments that reference these names
        const lines = content.split('\n').filter(line => {
          const trimmed = line.trim();
          // Skip comment lines
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/**') || trimmed.startsWith('/*')) return false;
          return true;
        });
        const hasProvider = lines.some(line =>
          line.toLowerCase().includes(provider) &&
          !line.includes('//') &&
          !line.includes('*') &&
          !line.includes('no real') &&
          !line.includes('Non-goals') &&
          !line.includes('금지')
        );
        assert.strictEqual(hasProvider, false,
          'Non-comment code should not reference ' + provider);
      }
    }
  },

  // 14. No external fetch/source fetch in selector file
  {
    name: 'Selector file does not use fetch, XMLHttpRequest, or axios directly',
    fn: () => {
      const content = readFileSafe(SELECTOR_PATH);
      // The selector itself should not do fetch — only endpoint client does that internally
      assert.ok(!content.includes('new XMLHttpRequest'), 'Should not use XMLHttpRequest');
      assert.ok(!content.includes('axios'), 'Should not use axios');
      // fetch may appear in comments or refs, but the selector module itself should not call it
      // Check that fetch is not called in non-comment code
      const lines = content.split('\n');
      const fetchLines = lines.filter(line =>
        line.includes('fetch(') && !line.trim().startsWith('//') && !line.trim().startsWith('*')
      );
      // The only fetch references should be in comments referencing the endpoint client
      assert.strictEqual(fetchLines.length, 0,
        'Selector file should not call fetch directly');
    }
  },

  // 15. No API key/persistence/auto-save
  {
    name: 'Selector file has no API key, Authorization header, localStorage write, addMemoryFromForm, or save calls',
    fn: () => {
      const content = readFileSafe(SELECTOR_PATH);
      const forbidden = [
        'x-api-key',
        'X-Api-Key',
        'Authorization',
        'addMemoryFromForm',
        'save(',
        'localStorage.setItem',
        'sessionStorage.setItem'
      ];
      for (const pattern of forbidden) {
        // Allow in comments
        const lines = content.split('\n');
        const matchLines = lines.filter(line =>
          line.includes(pattern) && !line.trim().startsWith('//') && !line.trim().startsWith('*')
        );
        assert.strictEqual(matchLines.length, 0,
          'Non-comment code should not contain "' + pattern + '"');
      }
    }
  },

  // 16. Docs updated
  {
    name: 'Serverless endpoint boundary and LLM provider boundary docs reference source selector',
    fn: () => {
      const boundaryContent = readFileSafe(DOC_BOUNDARY_PATH);
      const providerContent = readFileSafe(DOC_PROVIDER_PATH);

      // Both docs should reference the source selector boundary phase
      const boundaryRefs = [
        'Source Selector Boundary',
        'source selector',
        'source_selector'
      ];
      const hasBoundaryRef = boundaryRefs.some(r => boundaryContent.includes(r));
      assert.ok(hasBoundaryRef,
        'Serverless endpoint boundary doc should reference source selector boundary. Content length: ' + boundaryContent.length);

      const hasProviderRef = boundaryRefs.some(r => providerContent.includes(r));
      assert.ok(hasProviderRef,
        'LLM provider boundary doc should reference source selector boundary. Content length: ' + providerContent.length);

      // Both docs should mention local_stub as default
      assert.ok(boundaryContent.includes('local_stub') || boundaryContent.includes('local stub') ||
                boundaryContent.includes('Local stub'),
        'Endpoint boundary doc should mention local_stub as default');

      assert.ok(providerContent.includes('local_stub') || providerContent.includes('local stub') ||
                providerContent.includes('Local stub'),
        'Provider boundary doc should mention local_stub as default');
    }
  }
];

// Run tests
let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test.fn();
    console.log(`  ✓ ${test.name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${test.name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
