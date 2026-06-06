/**
 * LoveBud Scout Suggestion Endpoint Client Module
 * v20260606-4
 *
 * Provides a frontend client for POST /api/scout/suggest.
 * Disabled by default — feature flag gated.
 * Same-origin endpoint only. No API key auto-injection.
 *
 * Non-goals:
 * - No real LLM provider integration
 * - No API keys or environment variables in frontend
 * - No external URL fetch
 * - No sourceUrl fetch or content extraction
 * - No auto-save or persistence
 * - No Scout Draft UI rewiring (local stub provider remains default)
 */

(function() {
    'use strict';

    function isDebugEnabled() {
        return window.LOVEBUD_DEBUG === true || window.LOVEBUD_SCOUT_ENDPOINT_CLIENT_DEBUG === true;
    }

    function debugLog() {
        if (!isDebugEnabled() || !window.console || typeof console.log !== 'function') return;
        console.log.apply(console, arguments);
    }

    // ─── Constants ────────────────────────────────────────────────────────────

    const MAX_EMOTION_TAGS = 4;
    const MAX_EMOTION_TAG_LENGTH = 20;
    const MAX_TITLE_LENGTH = 50;
    const MAX_SUMMARY_LENGTH = 200;
    const MAX_TRANSLATION_LENGTH = 500;
    const MAX_MEMO_LENGTH = 500;

    const DEFAULT_ENDPOINT_URL = '/api/scout/suggest';

    // ─── Feature Flag ─────────────────────────────────────────────────────────

    /**
     * Checks if the endpoint client is enabled via explicit configuration.
     * Disabled by default — only returns true when config.enabled is true or "true".
     *
     * Does NOT read localStorage/sessionStorage/URL params for auto-enable.
     *
     * @param {Object} [config]
     * @returns {boolean}
     */
    function isScoutSuggestionEndpointClientEnabled(config) {
        if (!config || typeof config !== 'object') return false;
        if (config.enabled === true) return true;
        if (config.enabled === 'true') return true;
        return false;
    }

    // ─── URL Validation ───────────────────────────────────────────────────────

    /**
     * Validates endpoint URL is same-origin only.
     * Rejects http://, https://, protocol-relative (//) URLs.
     *
     * @param {string} url
     * @returns {boolean}
     */
    function isSameOriginScoutEndpointUrl(url) {
        if (typeof url !== 'string' || !url) return false;
        // Reject absolute URLs with protocol
        if (/^https?:\/\//i.test(url)) return false;
        // Reject protocol-relative URLs
        if (/^\/\//.test(url)) return false;
        // Allow absolute path (starting with /)
        // Allow relative paths (starting with ./ or without ./)
        if (/^\//.test(url)) return true;
        if (/^\.\.?(\/|$)/.test(url)) return true;
        // Plain path without prefix is valid for relative fetch
        return true;
    }

    // ─── Request Normalization ────────────────────────────────────────────────

    /**
     * Normalizes suggestion request fields to match endpoint schema.
     *
     * @param {Object} rawInput
     * @returns {Object}
     */
    function normalizeScoutSuggestionEndpointRequest(rawInput) {
        const input = rawInput || {};

        return {
            sourceUrl: typeof input.sourceUrl === 'string' ? input.sourceUrl.trim() : '',
            excerpt: typeof input.excerpt === 'string' ? input.excerpt.trim() : '',
            summary: typeof input.summary === 'string' ? input.summary.trim() : '',
            memo: typeof input.memo === 'string' ? input.memo.trim() : '',
            requestedLanguage: input.requestedLanguage === 'en' ? 'en' : 'ko',
            desiredTone: typeof input.desiredTone === 'string' ? input.desiredTone.trim() : '',
            maxOutputLength: typeof input.maxOutputLength === 'number' && input.maxOutputLength > 0
                ? Math.min(input.maxOutputLength, 500)
                : 200
        };
    }

    // ─── Response Normalization ───────────────────────────────────────────────

    /**
     * Normalizes a successful endpoint response.
     *
     * @param {Object} raw
     * @returns {Object}
     */
    function normalizeScoutSuggestionEndpointResponse(raw) {
        const data = raw || {};

        if (data.ok === true && data.suggestion) {
            const s = data.suggestion;
            return {
                ok: true,
                providerMode: data.providerMode || 'stub',
                suggestion: {
                    titleSuggestion: typeof s.titleSuggestion === 'string' ? s.titleSuggestion.slice(0, MAX_TITLE_LENGTH) : '',
                    summarySuggestion: typeof s.summarySuggestion === 'string' ? s.summarySuggestion.slice(0, MAX_SUMMARY_LENGTH) : '',
                    translationSuggestion: typeof s.translationSuggestion === 'string' ? s.translationSuggestion.slice(0, MAX_TRANSLATION_LENGTH) : '',
                    emotionTags: Array.isArray(s.emotionTags)
                        ? s.emotionTags
                            .filter(t => typeof t === 'string' && t.trim().length > 0)
                            .map(t => t.trim().slice(0, MAX_EMOTION_TAG_LENGTH))
                            .slice(0, MAX_EMOTION_TAGS)
                        : [],
                    memoSuggestion: typeof s.memoSuggestion === 'string' ? s.memoSuggestion.slice(0, MAX_MEMO_LENGTH) : '',
                    safetyNote: typeof s.safetyNote === 'string' ? s.safetyNote.trim() : ''
                }
            };
        }

        // Error response
        const errorCode = data.error && data.error.code ? data.error.code : 'PROVIDER_ERROR';
        const errorMessage = data.error && data.error.message ? data.error.message : 'Scout suggestion server returned an error.';
        return {
            ok: false,
            providerMode: data.providerMode || 'stub',
            error: {
                code: errorCode,
                message: errorMessage
            }
        };
    }

    // ─── Client Factory ───────────────────────────────────────────────────────

    /**
     * Creates a Scout suggestion endpoint client.
     *
     * @param {Object} options
     * @param {string} [options.endpointUrl] - Same-origin endpoint path (default: /api/scout/suggest)
     * @param {Function} [options.fetchImpl] - Fetch implementation (default: window.fetch)
     * @param {boolean|string} [options.enabled] - Feature flag (default: false)
     * @returns {Object}
     */
    function createScoutSuggestionEndpointClient(options) {
        const config = options || {};
        const endpointUrl = typeof config.endpointUrl === 'string' && config.endpointUrl
            ? config.endpointUrl
            : DEFAULT_ENDPOINT_URL;
        const fetchImpl = typeof config.fetchImpl === 'function' ? config.fetchImpl : null;
        const enabled = isScoutSuggestionEndpointClientEnabled(config);

        let callCount = 0;

        return {
            /**
             * Calls the endpoint if enabled.
             * @param {Object} input
             * @returns {Promise<Object>}
             */
            async suggest(input) {
                callCount++;

                if (!enabled) {
                    return {
                        ok: false,
                        error: {
                            code: 'PROVIDER_UNAVAILABLE',
                            message: 'Scout suggestion endpoint client is disabled.'
                        }
                    };
                }

                if (!isSameOriginScoutEndpointUrl(endpointUrl)) {
                    return {
                        ok: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid endpoint URL.'
                        }
                    };
                }

                if (!fetchImpl) {
                    return {
                        ok: false,
                        error: {
                            code: 'PROVIDER_UNAVAILABLE',
                            message: 'Scout suggestion endpoint client is not available (no fetch).'
                        }
                    };
                }

                const normalizedInput = normalizeScoutSuggestionEndpointRequest(input);
                let response;
                try {
                    response = await fetchImpl(endpointUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(normalizedInput)
                    });
                } catch (networkError) {
                    return {
                        ok: false,
                        error: {
                            code: 'PROVIDER_UNAVAILABLE',
                            message: 'Scout suggestion endpoint is unreachable.'
                        }
                    };
                }

                let body;
                try {
                    body = await response.json();
                } catch (parseError) {
                    return {
                        ok: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid response from Scout suggestion endpoint.'
                        }
                    };
                }

                return normalizeScoutSuggestionEndpointResponse(body);
            },

            /**
             * Client metadata.
             * @returns {Object}
             */
            getMeta() {
                return {
                    name: 'ScoutSuggestionEndpointClient',
                    version: '1.0.0',
                    endpointUrl,
                    enabled,
                    callCount,
                    sameOriginOnly: true,
                    apiKeyIncluded: false
                };
            },

            /**
             * Whether the client is currently enabled.
             * @returns {boolean}
             */
            isEnabled() {
                return enabled;
            }
        };
    }

    // ─── Export ───────────────────────────────────────────────────────────────

    window.LoveBudScoutSuggestionEndpointClient = {
        createScoutSuggestionEndpointClient,
        normalizeScoutSuggestionEndpointRequest,
        normalizeScoutSuggestionEndpointResponse,
        isScoutSuggestionEndpointClientEnabled
    };

    debugLog('[LoveBudScoutSuggestionEndpointClient] Module loaded (disabled by default)');
})();