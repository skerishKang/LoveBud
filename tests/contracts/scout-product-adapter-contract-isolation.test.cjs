/**
 * LoveBud #1882 S1 — Scout Product Adapter Contract Isolation
 * Refs #1882
 * Keep #1882 open
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const SELECTOR_PATH = path.join(ROOT, 'js/scout/scout-suggestion-source-selector.js');
const PROVIDER_PATH = path.join(ROOT, 'js/scout/scout-suggestion-provider.js');
const ENDPOINT_PATH = path.join(ROOT, 'js/scout/scout-suggestion-endpoint-client.js');
const DIRECT_PROVIDER_PATH = path.join(ROOT, 'functions/api/scout/live-provider-api-key-transport.js');
const SUGGEST_PATH = path.join(ROOT, 'functions/api/scout/suggest.js');
const DOC_PATH = path.join(ROOT, 'docs/product/lovebud-scout-product-adapter-contract.md');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function loadSelector({ withProvider = true, withEndpoint = true } = {}) {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  if (withProvider) vm.runInContext(read(PROVIDER_PATH), sandbox);
  if (withEndpoint) vm.runInContext(read(ENDPOINT_PATH), sandbox);
  vm.runInContext(read(SELECTOR_PATH), sandbox);
  return { sandbox, selector: sandbox.window.LoveBudScoutSuggestionSourceSelector };
}

const tests = [
  {
    name: 'Product intent is allowlist-only and strips provider execution fields',
    async fn() {
      const { selector } = loadSelector();
      const intent = selector.normalizeScoutProductIntent({
        taskIntent: 'link_to_lovetree_moment',
        outputProfile: 'scout_suggestion_v1',
        sourceUrl: ' https://example.com/post ',
        approvedInputRef: 'public-link-1',
        excerpt: ' excerpt ',
        summary: ' summary ',
        memo: ' memo ',
        requestedLanguage: 'en',
        desiredTone: 'emotional',
        maxOutputLength: 240,
        provider: 'forbidden-provider',
        model: 'forbidden-model',
        apiKey: 'forbidden-secret',
        providerEndpoint: 'https://provider.invalid',
        timeoutMs: 9999,
        maxRetries: 4,
        fallbackPolicy: 'forbidden',
        evidence: [{ id: 'core-internal-detail' }]
      });

      assert.deepStrictEqual(
        Object.keys(intent),
        [
          'taskIntent', 'outputProfile', 'sourceUrl', 'approvedInputRef',
          'excerpt', 'summary', 'memo', 'requestedLanguage', 'desiredTone',
          'maxOutputLength'
        ]
      );
      assert.strictEqual(intent.taskIntent, 'link_to_lovetree_moment');
      assert.strictEqual(intent.outputProfile, 'scout_suggestion_v1');
      assert.strictEqual(intent.sourceUrl, 'https://example.com/post');
      assert.strictEqual(intent.requestedLanguage, 'en');
      assert.strictEqual(intent.desiredTone, 'emotional');
      assert.strictEqual(intent.maxOutputLength, 240);
      for (const forbidden of [
        'provider', 'model', 'apiKey', 'providerEndpoint', 'timeoutMs',
        'maxRetries', 'fallbackPolicy', 'evidence'
      ]) {
        assert.strictEqual(Object.prototype.hasOwnProperty.call(intent, forbidden), false, `${forbidden} must not enter Product intent`);
      }
    }
  },
  {
    name: 'Product intent defaults remain bounded and product-owned',
    async fn() {
      const { selector } = loadSelector();
      const intent = selector.normalizeScoutProductIntent({
        taskIntent: 'unknown',
        outputProfile: 'unknown',
        requestedLanguage: 'fr',
        desiredTone: 'neutral',
        maxOutputLength: 9999
      });
      assert.strictEqual(intent.taskIntent, 'link_to_lovetree_moment');
      assert.strictEqual(intent.outputProfile, 'scout_suggestion_v1');
      assert.strictEqual(intent.requestedLanguage, 'ko');
      assert.strictEqual(intent.desiredTone, 'polite');
      assert.strictEqual(intent.maxOutputLength, 500);
    }
  },
  {
    name: 'Product Adapter normalizes intent before an execution-service seam',
    async fn() {
      const { selector } = loadSelector();
      let received = null;
      const executionSource = {
        async suggest(intent) {
          received = intent;
          return {
            titleSuggestion: 'T'.repeat(80),
            summarySuggestion: 'Summary',
            translationSuggestion: 'Translation',
            emotionTags: ['excited', 'hopeful', 'warm', 'waiting', 'overflow'],
            memoSuggestion: 'Memo',
            safetyNote: 'Review before saving.'
          };
        },
        getMeta() {
          return { name: 'FakeExecutionService', network: false };
        }
      };

      const adapter = selector.createScoutProductAdapter(executionSource);
      const result = await adapter.suggest({
        sourceUrl: 'https://example.com',
        excerpt: 'hello',
        provider: 'must-drop',
        model: 'must-drop',
        apiKey: 'must-drop'
      });

      assert.ok(received);
      assert.strictEqual(received.taskIntent, 'link_to_lovetree_moment');
      assert.strictEqual(received.outputProfile, 'scout_suggestion_v1');
      assert.strictEqual(Object.prototype.hasOwnProperty.call(received, 'provider'), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(received, 'model'), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(received, 'apiKey'), false);
      assert.strictEqual(result.titleSuggestion.length, 50);
      assert.deepStrictEqual(Array.from(result.emotionTags), ['excited', 'hopeful', 'warm', 'waiting']);
      const meta = adapter.getMeta();
      assert.strictEqual(meta.name, 'FakeExecutionService');
      assert.strictEqual(meta.productContract, 'scout_product_adapter_v1');
    }
  },
  {
    name: 'local_stub remains the default source behind the Product Adapter',
    async fn() {
      const { selector } = loadSelector();
      const source = selector.createScoutSuggestionSourceProvider();
      const meta = source.getMeta();
      assert.ok(meta.name.includes('Stub'));
      assert.strictEqual(meta.deterministic, true);
      assert.strictEqual(meta.network, false);
      assert.strictEqual(meta.apiKey, false);
      assert.strictEqual(meta.productContract, 'scout_product_adapter_v1');
      const suggestion = await source.suggest({ excerpt: 'test' });
      assert.strictEqual(typeof suggestion.summarySuggestion, 'string');
      assert.ok(Array.isArray(suggestion.emotionTags));
    }
  },
  {
    name: 'endpoint_client seam remains opt-in and success is projected to Product output shape',
    async fn() {
      const providerCode = read(PROVIDER_PATH);
      const endpointCode = read(ENDPOINT_PATH);
      const selectorCode = read(SELECTOR_PATH);
      const mockFetch = async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          providerMode: 'stub',
          suggestion: {
            titleSuggestion: 'Endpoint title',
            summarySuggestion: 'Endpoint summary',
            translationSuggestion: 'Endpoint translation',
            emotionTags: ['curious'],
            memoSuggestion: 'Endpoint memo',
            safetyNote: 'Review before saving.'
          }
        })
      });
      const sandbox = { window: {}, console };
      vm.createContext(sandbox);
      vm.runInContext(providerCode, sandbox);
      vm.runInContext(endpointCode, sandbox);
      vm.runInContext(selectorCode, sandbox);
      const selector = sandbox.window.LoveBudScoutSuggestionSourceSelector;

      const disabled = selector.resolveScoutSuggestionSource({
        source: 'endpoint_client', endpointClientEnabled: false
      });
      assert.strictEqual(disabled.source, 'local_stub');

      const source = selector.createScoutSuggestionSourceProvider({
        source: 'endpoint_client',
        endpointClientEnabled: true,
        endpointClientOptions: { fetchImpl: mockFetch, endpointUrl: '/api/scout/suggest' }
      });
      assert.strictEqual(source.getMeta().name, 'ScoutSuggestionEndpointClient');
      const suggestion = await source.suggest({ excerpt: 'test' });
      assert.strictEqual(suggestion.summarySuggestion, 'Endpoint summary');
      assert.strictEqual(Object.prototype.hasOwnProperty.call(suggestion, 'providerMode'), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(suggestion, 'route'), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(suggestion, 'evidence'), false);
    }
  },
  {
    name: 'Direct provider runtime remains present only as a later migration reference',
    async fn() {
      const directProvider = read(DIRECT_PROVIDER_PATH);
      const suggest = read(SUGGEST_PATH);
      const doc = read(DOC_PATH);
      assert.ok(directProvider.includes('createScoutLiveProviderTransport'));
      assert.ok(suggest.includes('createScoutLiveProviderTransport'));
      assert.ok(doc.includes('LEGACY_MIGRATION_REFERENCE_ONLY'));
      assert.ok(doc.includes('ENGINE_RUNTIME_ACTIVATED = NO'));
      assert.ok(doc.includes('B14_RUNTIME_ACTIVATED = NO'));
    }
  },
  {
    name: 'S1 document freezes Product ownership without Core/Provider internals',
    async fn() {
      const doc = read(DOC_PATH);
      assert.ok(doc.includes('Refs #1882'));
      assert.ok(doc.includes('Keep #1882 open'));
      assert.ok(doc.includes('local_stub'));
      assert.ok(doc.includes('endpoint_client'));
      assert.ok(doc.includes('explicit user save'));
      assert.ok(doc.includes('Memory draft'));
      assert.ok(doc.includes('Provider API key'));
      assert.ok(doc.includes('not part of the Product Adapter contract'));
    }
  }
];

(async () => {
  let passed = 0;
  for (const test of tests) {
    try {
      await test.fn();
      passed += 1;
      console.log(`ok - ${test.name}`);
    } catch (error) {
      console.error(`not ok - ${test.name}`);
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`${passed}/${tests.length} Scout Product Adapter S1 contract tests passed`);
})();
