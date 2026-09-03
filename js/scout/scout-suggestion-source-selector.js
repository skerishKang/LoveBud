/**
 * LoveBud Scout Suggestion Source Selector + Product Adapter Contract
 * v20260903-s1-1
 *
 * S1 boundary:
 * - Scout UI expresses product intent only.
 * - Product Adapter normalizes the fan-facing request/result contract.
 * - local_stub remains the default execution source.
 * - endpoint_client remains opt-in behind an explicit feature flag.
 * - Provider/model/credential/retry/fallback details are NOT part of this contract.
 *
 * Non-goals:
 * - No real LLM provider integration
 * - No API keys or environment variables in frontend
 * - No external URL fetch
 * - No sourceUrl fetch or content extraction
 * - No auto-save or persistence
 * - No Engine/B14 activation in S1
 */

(function() {
    'use strict';

    function isDebugEnabled() {
        return window.LOVEBUD_DEBUG === true || window.LOVEBUD_SCOUT_SOURCE_SELECTOR_DEBUG === true;
    }

    function debugLog() {
        if (!isDebugEnabled() || !window.console || typeof console.log !== 'function') return;
        console.log.apply(console, arguments);
    }

    // ─── Source Constants ─────────────────────────────────────────────────────

    const SCOUT_SUGGESTION_SOURCES = Object.freeze({
        LOCAL_STUB: 'local_stub',
        ENDPOINT_CLIENT: 'endpoint_client'
    });

    // ─── Product Adapter Contract ─────────────────────────────────────────────

    const SCOUT_PRODUCT_TASK_INTENTS = Object.freeze({
        LINK_TO_LOVETREE_MOMENT: 'link_to_lovetree_moment'
    });

    const SCOUT_PRODUCT_OUTPUT_PROFILES = Object.freeze({
        SCOUT_SUGGESTION_V1: 'scout_suggestion_v1'
    });

    const PRODUCT_ALLOWED_TONES = Object.freeze(['casual', 'polite', 'emotional']);
    const MAX_APPROVED_INPUT_REF_LENGTH = 256;
    const MAX_EMOTION_TAGS = 4;
    const MAX_EMOTION_TAG_LENGTH = 20;
    const MAX_TITLE_LENGTH = 50;
    const MAX_SUMMARY_LENGTH = 200;
    const MAX_TRANSLATION_LENGTH = 500;
    const MAX_MEMO_LENGTH = 500;
    const MAX_SAFETY_NOTE_LENGTH = 300;

    function normalizeString(value, maxLen) {
        if (typeof value !== 'string') return '';
        const trimmed = value.trim();
        return typeof maxLen === 'number' && maxLen > 0
            ? trimmed.slice(0, maxLen)
            : trimmed;
    }

    /**
     * Normalizes the stable LoveBud-owned Scout execution intent.
     *
     * This function is intentionally allowlist-only. Provider/model/credential,
     * transport, retry, fallback, and Core-internal Evidence fields are dropped
     * even if a caller supplies them.
     *
     * @param {Object} rawInput
     * @returns {Object}
     */
    function normalizeScoutProductIntent(rawInput) {
        const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
        const requestedLanguage = input.requestedLanguage === 'en' ? 'en' : 'ko';
        const requestedTone = normalizeString(input.desiredTone, 20);
        const desiredTone = PRODUCT_ALLOWED_TONES.includes(requestedTone)
            ? requestedTone
            : 'polite';

        let maxOutputLength = Number(input.maxOutputLength);
        if (!Number.isInteger(maxOutputLength) || maxOutputLength <= 0) {
            maxOutputLength = 200;
        }
        maxOutputLength = Math.min(maxOutputLength, 500);

        return {
            taskIntent: input.taskIntent === SCOUT_PRODUCT_TASK_INTENTS.LINK_TO_LOVETREE_MOMENT
                ? input.taskIntent
                : SCOUT_PRODUCT_TASK_INTENTS.LINK_TO_LOVETREE_MOMENT,
            outputProfile: input.outputProfile === SCOUT_PRODUCT_OUTPUT_PROFILES.SCOUT_SUGGESTION_V1
                ? input.outputProfile
                : SCOUT_PRODUCT_OUTPUT_PROFILES.SCOUT_SUGGESTION_V1,
            sourceUrl: normalizeString(input.sourceUrl, 2048),
            approvedInputRef: normalizeString(input.approvedInputRef, MAX_APPROVED_INPUT_REF_LENGTH),
            excerpt: normalizeString(input.excerpt, 5000),
            summary: normalizeString(input.summary, 5000),
            memo: normalizeString(input.memo, 5000),
            requestedLanguage,
            desiredTone,
            maxOutputLength
        };
    }

    /**
     * Normalizes the stable LoveBud-owned, fan-facing Scout suggestion shape.
     * Engine/Core/B14 metadata is intentionally not part of this product output.
     *
     * @param {Object} rawOutput
     * @returns {Object}
     */
    function normalizeScoutProductSuggestion(rawOutput) {
        const output = rawOutput && typeof rawOutput === 'object' ? rawOutput : {};
        const emotionTags = Array.isArray(output.emotionTags)
            ? output.emotionTags
                .filter(tag => typeof tag === 'string' && tag.trim())
                .map(tag => tag.trim().slice(0, MAX_EMOTION_TAG_LENGTH))
                .slice(0, MAX_EMOTION_TAGS)
            : [];

        return {
            titleSuggestion: normalizeString(output.titleSuggestion, MAX_TITLE_LENGTH),
            summarySuggestion: normalizeString(output.summarySuggestion, MAX_SUMMARY_LENGTH),
            translationSuggestion: normalizeString(output.translationSuggestion, MAX_TRANSLATION_LENGTH),
            emotionTags,
            memoSuggestion: normalizeString(output.memoSuggestion, MAX_MEMO_LENGTH),
            safetyNote: normalizeString(output.safetyNote, MAX_SAFETY_NOTE_LENGTH)
        };
    }

    /**
     * Wraps any trusted execution-service seam in the LoveBud-owned Product Adapter.
     * The wrapped source can be local_stub today or endpoint_client later; callers
     * see the same product contract either way.
     *
     * @param {Object} executionSource object exposing async suggest(intent)
     * @returns {Object}
     */
    function createScoutProductAdapter(executionSource) {
        if (!executionSource || typeof executionSource.suggest !== 'function') {
            return createUnavailableProvider('Scout execution service seam is not available.');
        }

        return {
            async suggest(rawIntent) {
                const intent = normalizeScoutProductIntent(rawIntent);
                const result = await executionSource.suggest(intent);

                // Preserve an execution-source error envelope unchanged. The Product
                // Adapter does not reinterpret transport/runtime failures in S1.
                if (result && result.ok === false && result.error) {
                    return result;
                }

                // endpoint_client success is an envelope; local_stub success is
                // already the suggestion object. Normalize both to one Product shape.
                const candidate = result && result.ok === true && result.suggestion
                    ? result.suggestion
                    : result;
                return normalizeScoutProductSuggestion(candidate);
            },

            getMeta() {
                const sourceMeta = executionSource && typeof executionSource.getMeta === 'function'
                    ? executionSource.getMeta()
                    : {};
                return {
                    ...sourceMeta,
                    productContract: 'scout_product_adapter_v1',
                    taskIntent: SCOUT_PRODUCT_TASK_INTENTS.LINK_TO_LOVETREE_MOMENT,
                    outputProfile: SCOUT_PRODUCT_OUTPUT_PROFILES.SCOUT_SUGGESTION_V1
                };
            },

            reset() {
                if (executionSource && typeof executionSource.reset === 'function') {
                    executionSource.reset();
                }
            },

            isEnabled() {
                return executionSource && typeof executionSource.isEnabled === 'function'
                    ? executionSource.isEnabled()
                    : true;
            }
        };
    }

    function wrapExecutionSource(executionSource) {
        return createScoutProductAdapter(executionSource);
    }

    // ─── Source Resolution ────────────────────────────────────────────────────

    /**
     * Resolves the suggestion source based on configuration.
     * Default is always local_stub.
     * Endpoint client is only selected when explicitly enabled.
     *
     * @param {Object} [config]
     * @param {string} [config.source] - Desired source name
     * @param {boolean|string} [config.endpointClientEnabled] - Feature flag for endpoint client
     * @returns {{ source: string, enabled: boolean, reason: string }}
     */
    function resolveScoutSuggestionSource(config) {
        if (!config || typeof config !== 'object') {
            return {
                source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB,
                enabled: false,
                reason: 'No config provided, using default local_stub'
            };
        }

        if (!config.source) {
            return {
                source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB,
                enabled: false,
                reason: 'No source specified, using default local_stub'
            };
        }

        if (config.source === SCOUT_SUGGESTION_SOURCES.LOCAL_STUB) {
            return {
                source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB,
                enabled: true,
                reason: 'Explicit local_stub source selected'
            };
        }

        if (config.source === SCOUT_SUGGESTION_SOURCES.ENDPOINT_CLIENT) {
            const endpointEnabled = config.endpointClientEnabled === true ||
                                    config.endpointClientEnabled === 'true';

            if (!endpointEnabled) {
                return {
                    source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB,
                    enabled: false,
                    reason: 'Endpoint client requested but feature flag is false, falling back to local_stub'
                };
            }

            return {
                source: SCOUT_SUGGESTION_SOURCES.ENDPOINT_CLIENT,
                enabled: true,
                reason: 'Endpoint client selected with explicit feature flag'
            };
        }

        return {
            source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB,
            enabled: false,
            reason: 'Unknown source "' + String(config.source) + '", falling back to local_stub'
        };
    }

    // ─── Execution Source Factory ─────────────────────────────────────────────

    /**
     * Creates the appropriate execution source and wraps it in the stable Scout
     * Product Adapter contract. Existing public function name is preserved for
     * compatibility with the current UI and tests.
     *
     * @param {Object} [config]
     * @returns {Object} Product Adapter exposing suggest(intent) and getMeta()
     */
    function createScoutSuggestionSourceProvider(config) {
        const resolution = resolveScoutSuggestionSource(config);

        debugLog('[ScoutSuggestionSourceSelector] Resolved source:', resolution);

        if (resolution.source === SCOUT_SUGGESTION_SOURCES.LOCAL_STUB) {
            const stubProvider = window.LoveBudScoutSuggestionProvider &&
                typeof window.LoveBudScoutSuggestionProvider.createScoutStubSuggestionProvider === 'function'
                ? window.LoveBudScoutSuggestionProvider.createScoutStubSuggestionProvider()
                : null;

            if (stubProvider) {
                return wrapExecutionSource(stubProvider);
            }

            return createUnavailableProvider('Local stub provider is not available.');
        }

        if (resolution.source === SCOUT_SUGGESTION_SOURCES.ENDPOINT_CLIENT) {
            const endpointClientNamespace = window.LoveBudScoutSuggestionEndpointClient;

            if (!endpointClientNamespace ||
                typeof endpointClientNamespace.createScoutSuggestionEndpointClient !== 'function') {
                debugLog('[ScoutSuggestionSourceSelector] Endpoint client namespace not found, falling back to local stub');

                const stubProvider = window.LoveBudScoutSuggestionProvider &&
                    typeof window.LoveBudScoutSuggestionProvider.createScoutStubSuggestionProvider === 'function'
                    ? window.LoveBudScoutSuggestionProvider.createScoutStubSuggestionProvider()
                    : null;

                if (stubProvider) {
                    return wrapExecutionSource(stubProvider);
                }

                return createUnavailableProvider('Endpoint client not available and no fallback provider found.');
            }

            const endpointOptions = (config && config.endpointClientOptions) || {};
            const endpointClient = endpointClientNamespace.createScoutSuggestionEndpointClient({
                endpointUrl: endpointOptions.endpointUrl || '/api/scout/suggest',
                fetchImpl: endpointOptions.fetchImpl,
                enabled: true
            });

            return wrapExecutionSource(endpointClient);
        }

        return createUnavailableProvider('No suggestion provider available.');
    }

    // ─── Unavailable Source ───────────────────────────────────────────────────

    function createUnavailableProvider(reason) {
        let callCount = 0;

        return {
            async suggest(input) {
                callCount++;
                return {
                    titleSuggestion: '',
                    summarySuggestion: '',
                    translationSuggestion: '',
                    emotionTags: [],
                    memoSuggestion: '',
                    safetyNote: reason || 'Suggestion provider is not available.'
                };
            },

            getMeta() {
                return {
                    name: 'UnavailableScoutSuggestionProvider',
                    version: '1.0.0',
                    deterministic: true,
                    network: false,
                    apiKey: false,
                    callCount,
                    reason: reason || 'No provider available',
                    productContract: 'scout_product_adapter_v1',
                    taskIntent: SCOUT_PRODUCT_TASK_INTENTS.LINK_TO_LOVETREE_MOMENT,
                    outputProfile: SCOUT_PRODUCT_OUTPUT_PROFILES.SCOUT_SUGGESTION_V1
                };
            },

            reset() {
                callCount = 0;
            }
        };
    }

    // ─── Export ───────────────────────────────────────────────────────────────

    window.LoveBudScoutSuggestionSourceSelector = {
        SCOUT_SUGGESTION_SOURCES,
        SCOUT_PRODUCT_TASK_INTENTS,
        SCOUT_PRODUCT_OUTPUT_PROFILES,
        normalizeScoutProductIntent,
        normalizeScoutProductSuggestion,
        createScoutProductAdapter,
        resolveScoutSuggestionSource,
        createScoutSuggestionSourceProvider
    };

    debugLog('[LoveBudScoutSuggestionSourceSelector] Module loaded (S1 Product Adapter; default source: local_stub)');
})();
