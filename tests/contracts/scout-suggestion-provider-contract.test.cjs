/**
 * Scout Suggestion Provider Contract Test
 *
 * Verifies the Scout suggestion provider abstraction and stub implementation.
 * All tests are deterministic and require no network, API keys, or environment.
 *
 * Phase 2: Stub provider contract - no AI/LLM integration
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROVIDER_PATH = path.join(ROOT, 'js', 'scout', 'scout-suggestion-provider.js');

// Load the provider module
function loadProvider() {
    const code = fs.readFileSync(PROVIDER_PATH, 'utf8');
    const vm = require('node:vm');
    const context = {
        window: {},
        console: { log: () => {}, warn: () => {} }
    };
    vm.createContext(context);
    vm.runInContext(code, context);
    return context.window.LoveBudScoutSuggestionProvider;
}

test('Scout Suggestion Provider Contract', async () => {
    const Provider = loadProvider();

    // Test 1: namespace exposure
    {
        assert.ok(Provider, 'window.LoveBudScoutSuggestionProvider should exist');
        assert.strictEqual(typeof Provider.createScoutStubSuggestionProvider, 'function', 'createScoutStubSuggestionProvider should be a function');
        assert.strictEqual(typeof Provider.createScoutSuggestionProvider, 'function', 'createScoutSuggestionProvider should be a function');
        assert.strictEqual(typeof Provider.normalizeScoutSuggestionInput, 'function', 'normalizeScoutSuggestionInput should be a function');
        assert.strictEqual(typeof Provider.normalizeScoutSuggestionOutput, 'function', 'normalizeScoutSuggestionOutput should be a function');
        assert.strictEqual(typeof Provider.getScoutSuggestionAvailability, 'function', 'getScoutSuggestionAvailability should be a function');
    }

    // Test 2: stub provider creation
    {
        const stub = Provider.createScoutStubSuggestionProvider();
        assert.ok(stub, 'createScoutStubSuggestionProvider should return an object');
        assert.strictEqual(typeof stub.suggest, 'function', 'stub.suggest should be a function');
        assert.strictEqual(typeof stub.getMeta, 'function', 'stub.getMeta should be a function');
        assert.strictEqual(typeof stub.reset, 'function', 'stub.reset should be a function');
    }

    // Test 3: deterministic output
    {
        const stub = Provider.createScoutStubSuggestionProvider();

        const input = {
            sourceUrl: 'https://example.com/post',
            excerpt: 'user entered excerpt',
            memo: 'user memo'
        };

        const result1 = await stub.suggest(input);
        const result2 = await stub.suggest(input);
        const result3 = await stub.suggest(input);

        assert.deepStrictEqual(result1, result2, 'First and second call should return identical output');
        assert.deepStrictEqual(result2, result3, 'Second and third call should return identical output');
    }

    // Test 4: structured output schema
    {
        const stub = Provider.createScoutStubSuggestionProvider();

        const result = await stub.suggest({
            sourceUrl: 'https://example.com/post',
            excerpt: 'test excerpt',
            memo: 'test memo'
        });

        assert.ok(typeof result.titleSuggestion === 'string', 'titleSuggestion should be string');
        assert.ok(typeof result.summarySuggestion === 'string', 'summarySuggestion should be string');
        assert.ok(typeof result.translationSuggestion === 'string', 'translationSuggestion should be string');
        assert.ok(Array.isArray(result.emotionTags), 'emotionTags should be array');
        assert.ok(typeof result.memoSuggestion === 'string', 'memoSuggestion should be string');
        assert.ok(typeof result.safetyNote === 'string', 'safetyNote should be string');
    }

    // Test 5: emotionTags constraints
    {
        const stub = Provider.createScoutStubSuggestionProvider();

        const result = await stub.suggest({
            sourceUrl: 'https://example.com/post',
            excerpt: 'test',
            memo: 'test'
        });

        assert.ok(Array.isArray(result.emotionTags), 'emotionTags should be array');
        assert.ok(result.emotionTags.length <= 4, 'emotionTags should have max 4 items');

        for (const tag of result.emotionTags) {
            assert.ok(typeof tag === 'string', 'each emotion tag should be string');
            assert.ok(tag.length > 0, 'each emotion tag should be non-empty');
            assert.ok(tag.length <= 20, 'each emotion tag should be <= 20 chars');
        }
    }

    // Test 6: no network / no API key / no persistence
    {
        // Verify the module source doesn't contain network/API key patterns
        const source = fs.readFileSync(PROVIDER_PATH, 'utf8');

        // No fetch/XMLHttpRequest
        assert.ok(!source.includes('fetch('), 'should not use fetch()');
        assert.ok(!source.includes('XMLHttpRequest'), 'should not use XMLHttpRequest');
        assert.ok(!source.includes('axios'), 'should not use axios');

        // No API key/env references (actual credential usage, not metadata)
        assert.ok(!source.includes('API_KEY'), 'should not reference API_KEY');
        // apiKey appears only in metadata as false/requiresApiKey boolean - that's OK
        // No actual API key fetching/usage
        assert.ok(!source.includes('apiKey') || source.includes('requiresApiKey') || source.includes('apiKey: false'), 'should not use actual API key credentials');

        // No localStorage/sessionStorage
        assert.ok(!source.includes('localStorage'), 'should not use localStorage');
        assert.ok(!source.includes('sessionStorage'), 'should not use sessionStorage');

        // No save/persistence calls
        assert.ok(!source.includes('addMemoryFromForm'), 'should not call addMemoryFromForm');
        assert.ok(!source.includes('createMemory'), 'should not call createMemory');
        assert.ok(!source.includes('save'), 'should not call save functions');
    }

    // Test 7: empty input safe fallback
    {
        const stub = Provider.createScoutStubSuggestionProvider();

        const result1 = await stub.suggest({});
        const result2 = await stub.suggest(null);
        const result3 = await stub.suggest(undefined);
        const result4 = await stub.suggest({ sourceUrl: '', excerpt: '', memo: '' });

        // All should return valid structured output
        for (const result of [result1, result2, result3, result4]) {
            assert.ok(typeof result.titleSuggestion === 'string');
            assert.ok(typeof result.summarySuggestion === 'string');
            assert.ok(typeof result.translationSuggestion === 'string');
            assert.ok(Array.isArray(result.emotionTags));
            assert.ok(typeof result.memoSuggestion === 'string');
            assert.ok(typeof result.safetyNote === 'string');
        }
    }

    // Test 8: input normalization
    {
        const Provider = loadProvider();
        const normalized = Provider.normalizeScoutSuggestionInput({
            sourceUrl: '  https://example.com  ',
            excerpt: '  user excerpt  ',
            summary: '  summary  ',
            memo: '  memo  ',
            requestedLanguage: 'en',
            desiredTone: '  casual  ',
            maxOutputLength: 150
        });

        assert.strictEqual(normalized.sourceUrl, 'https://example.com');
        assert.strictEqual(normalized.excerpt, 'user excerpt');
        assert.strictEqual(normalized.summary, 'summary');
        assert.strictEqual(normalized.memo, 'memo');
        assert.strictEqual(normalized.requestedLanguage, 'en');
        assert.strictEqual(normalized.desiredTone, 'casual');
        assert.strictEqual(normalized.maxOutputLength, 150);
    }

    // Test 9: input normalization handles missing/undefined
    {
        const Provider = loadProvider();
        const normalized = Provider.normalizeScoutSuggestionInput({});

        assert.strictEqual(normalized.sourceUrl, '');
        assert.strictEqual(normalized.excerpt, '');
        assert.strictEqual(normalized.summary, '');
        assert.strictEqual(normalized.memo, '');
        assert.strictEqual(normalized.requestedLanguage, 'ko');
        assert.strictEqual(normalized.desiredTone, '');
        assert.strictEqual(normalized.maxOutputLength, 200);
    }

    // Test 10: output normalization enforces constraints
    {
        const Provider = loadProvider();
        const normalized = Provider.normalizeScoutSuggestionOutput({
            titleSuggestion: 'x'.repeat(100), // exceeds max
            summarySuggestion: 'y'.repeat(300), // exceeds max
            translationSuggestion: 'z'.repeat(300), // exceeds max
            emotionTags: ['a'.repeat(30), 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'], // too long, too many
            memoSuggestion: 'm'.repeat(1000), // exceeds max
            safetyNote: '  test note  '
        });

        assert.strictEqual(normalized.titleSuggestion.length, 50);
        assert.strictEqual(normalized.summarySuggestion.length, 200);
        assert.strictEqual(normalized.translationSuggestion.length, 200);
        assert.strictEqual(normalized.emotionTags.length, 4);
        assert.strictEqual(normalized.emotionTags[0].length, 20);
        assert.strictEqual(normalized.memoSuggestion.length, 500);
        assert.strictEqual(normalized.safetyNote, 'test note');
    }

    // Test 11: stub provider getMeta
    {
        const stub = Provider.createScoutStubSuggestionProvider();

        const meta = stub.getMeta();
        assert.strictEqual(meta.name, 'ScoutStubSuggestionProvider');
        assert.strictEqual(meta.version, '1.0.0');
        assert.strictEqual(meta.deterministic, true);
        assert.strictEqual(meta.network, false);
        assert.strictEqual(meta.apiKey, false);
        assert.strictEqual(meta.callCount, 0);

        await stub.suggest({ excerpt: 'test' });
        assert.strictEqual(stub.getMeta().callCount, 1);

        stub.reset();
        assert.strictEqual(stub.getMeta().callCount, 0);
    }

    // Test 12: custom provider creation
    {
        const customProvider = Provider.createScoutSuggestionProvider({
            name: 'TestProvider',
            version: '2.0.0',
            requiresNetwork: true,
            requiresApiKey: true,
            async suggest(input) {
                return {
                    titleSuggestion: 'Custom: ' + (input.excerpt || 'default'),
                    summarySuggestion: 'Custom summary',
                    translationSuggestion: 'Custom translation',
                    emotionTags: ['custom'],
                    memoSuggestion: 'Custom memo',
                    safetyNote: 'Custom safety note'
                };
            }
        });

        const meta = customProvider.getMeta();
        assert.strictEqual(meta.name, 'TestProvider');
        assert.strictEqual(meta.version, '2.0.0');
        assert.strictEqual(meta.deterministic, false);
        assert.strictEqual(meta.network, true);
        assert.strictEqual(meta.apiKey, true);

        const result = await customProvider.suggest({ excerpt: 'test excerpt' });
        assert.strictEqual(result.titleSuggestion, 'Custom: test excerpt');
    }

    // Test 13: custom provider validation
    {
        assert.throws(
            () => Provider.createScoutSuggestionProvider({}),
            /Provider implementation must have async suggest/
        );
        assert.throws(
            () => Provider.createScoutSuggestionProvider({ suggest: 'not a function' }),
            /Provider implementation must have async suggest/
        );
    }

    // Test 14: availability helper schema
    {
        const result = Provider.getScoutSuggestionAvailability('stub');
        assert.ok(typeof result.available === 'boolean', 'availability result must include available boolean');
        assert.ok(typeof result.mode === 'string', 'availability result must include mode string');
        assert.ok(typeof result.message === 'string', 'availability result must include message string');
    }

    // Test 15: stub mode is available
    {
        const result = Provider.getScoutSuggestionAvailability('stub');
        assert.strictEqual(result.available, true, 'stub mode should be available');
        assert.strictEqual(result.mode, 'stub', 'stub mode should report stub');
    }
 
    // Test 16: pending configuration for live/unknown mode
    {
        const liveResult = Provider.getScoutSuggestionAvailability('live');
        assert.strictEqual(liveResult.available, false, 'live mode should not be available yet');
        assert.strictEqual(liveResult.mode, 'pending_configuration', 'live mode should be pending_configuration');

        const unknownResult = Provider.getScoutSuggestionAvailability('unknown-mode');
        assert.strictEqual(unknownResult.available, false, 'unknown mode should not be available');
        assert.strictEqual(unknownResult.mode, 'pending_configuration', 'unknown mode should be pending_configuration');
    }

    // Test 17: default when mode is omitted
    {
        const result = Provider.getScoutSuggestionAvailability();
        assert.strictEqual(result.available, true, 'default should be available');
        assert.strictEqual(result.mode, 'stub', 'default should be stub');
    }
    }); 