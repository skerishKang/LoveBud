/**
 * LoveBud Scout Suggestion Source Selector Module
 * v20260606-1
 *
 * Provides a boundary between local_stub and endpoint_client suggestion sources.
 * Default source is always local_stub. Endpoint client requires explicit feature flag.
 *
 * Non-goals:
 * - No real LLM provider integration
 * - No API keys or environment variables in frontend
 * - No external URL fetch
 * - No sourceUrl fetch or content extraction
 * - No auto-save or persistence
 * - No Scout Draft UI default rewiring to endpoint client
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

    const SCOUT_SUGGESTION_SOURCES = {
        LOCAL_STUB: 'local_stub',
        ENDPOINT_CLIENT: 'endpoint_client'
    };

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
        // No config → local_stub
        if (!config || typeof config !== 'object') {
            return {
                source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB,
                enabled: false,
                reason: 'No config provided, using default local_stub'
            };
        }

        // No source specified → local_stub
        if (!config.source) {
            return {
                source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB,
                enabled: false,
                reason: 'No source specified, using default local_stub'
            };
        }

        // Explicit local_stub
        if (config.source === SCOUT_SUGGESTION_SOURCES.LOCAL_STUB) {
            return {
                source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB,
                enabled: true,
                reason: 'Explicit local_stub source selected'
            };
        }

        // Endpoint client requested — check feature flag
        if (config.source === SCOUT_SUGGESTION_SOURCES.ENDPOINT_CLIENT) {
            // Check endpoint client enabled flag
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

        // Unknown source — fallback to local_stub
        return {
            source: SCOUT_SUGGESTION_SOURCES.LOCAL_STUB,
            enabled: false,
            reason: 'Unknown source "' + String(config.source) + '", falling back to local_stub'
        };
    }

    // ─── Provider Factory ─────────────────────────────────────────────────────

    /**
     * Creates the appropriate suggestion provider based on resolved source configuration.
     * Default is local stub provider. Endpoint client requires explicit feature flag.
     *
     * @param {Object} [config]
     * @param {string} [config.source] - Desired source name
     * @param {boolean|string} [config.endpointClientEnabled] - Feature flag for endpoint client
     * @param {Object} [config.endpointClientOptions] - Options passed to endpoint client factory
     * @returns {Object} A suggestion provider with suggest(input) and getMeta() methods
     */
    function createScoutSuggestionSourceProvider(config) {
        const resolution = resolveScoutSuggestionSource(config);

        debugLog('[ScoutSuggestionSourceSelector] Resolved source:', resolution);

        // Local stub — always available
        if (resolution.source === SCOUT_SUGGESTION_SOURCES.LOCAL_STUB) {
            const stubProvider = window.LoveBudScoutSuggestionProvider &&
                typeof window.LoveBudScoutSuggestionProvider.createScoutStubSuggestionProvider === 'function'
                ? window.LoveBudScoutSuggestionProvider.createScoutStubSuggestionProvider()
                : null;

            if (stubProvider) {
                return stubProvider;
            }

            // Fallback: create safe unavailable provider
            return createUnavailableProvider('Local stub provider is not available.');
        }

        // Endpoint client — only when source resolved to endpoint_client
        if (resolution.source === SCOUT_SUGGESTION_SOURCES.ENDPOINT_CLIENT) {
            const endpointClientNamespace = window.LoveBudScoutSuggestionEndpointClient;

            if (!endpointClientNamespace ||
                typeof endpointClientNamespace.createScoutSuggestionEndpointClient !== 'function') {
                debugLog('[ScoutSuggestionSourceSelector] Endpoint client namespace not found, falling back to local stub');

                // Fallback to local stub
                const stubProvider = window.LoveBudScoutSuggestionProvider &&
                    typeof window.LoveBudScoutSuggestionProvider.createScoutStubSuggestionProvider === 'function'
                    ? window.LoveBudScoutSuggestionProvider.createScoutStubSuggestionProvider()
                    : null;

                if (stubProvider) {
                    return stubProvider;
                }

                return createUnavailableProvider('Endpoint client not available and no fallback provider found.');
            }

            const endpointOptions = (config && config.endpointClientOptions) || {};
            // Always pass enabled:true since we already checked the feature flag
            const endpointClient = endpointClientNamespace.createScoutSuggestionEndpointClient({
                endpointUrl: endpointOptions.endpointUrl || '/api/scout/suggest',
                fetchImpl: endpointOptions.fetchImpl,
                enabled: true
            });

            return endpointClient;
        }

        // Safety fallback
        return createUnavailableProvider('No suggestion provider available.');
    }

    // ─── Unavailable Provider ─────────────────────────────────────────────────

    /**
     * Creates a safe fallback provider that returns unavailable status.
     *
     * @param {string} [reason]
     * @returns {Object}
     */
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
                    reason: reason || 'No provider available'
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
        resolveScoutSuggestionSource,
        createScoutSuggestionSourceProvider
    };

    debugLog('[LoveBudScoutSuggestionSourceSelector] Module loaded (default source: local_stub)');
})();
