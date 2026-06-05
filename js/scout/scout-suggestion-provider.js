/**
 * LoveBud Scout Suggestion Provider Module
 * Phase 2: Deterministic stub suggestion provider (no AI/LLM)
 * v20260605-1
 *
 * Provides:
 * - Provider abstraction interface
 * - Deterministic stub provider for tests and future UI wiring
 * - Suggestion input/output normalization
 *
 * Non-goals:
 * - No real LLM provider integration
 * - No API keys or environment variables
 * - No server/serverless endpoint
 * - No external URL fetching
 * - No crawler or metadata extraction
 * - No automatic persistence
 */

(function() {
    'use strict';

    function isScoutSuggestionDebugEnabled() {
        return window.LOVEBUD_DEBUG === true || window.LOVEBUD_SCOUT_SUGGESTION_DEBUG === true;
    }

    function scoutSuggestionDebugLog() {
        if (!isScoutSuggestionDebugEnabled() || !window.console || typeof console.log !== 'function') return;
        console.log.apply(console, arguments);
    }

    // ─── Constants ────────────────────────────────────────────────────────────

    const MAX_EMOTION_TAGS = 4;
    const MAX_EMOTION_TAG_LENGTH = 20;
    const MAX_TITLE_LENGTH = 50;
    const MAX_SUMMARY_LENGTH = 200;
    const MAX_MEMO_LENGTH = 500;

    const DEFAULT_STUB_OUTPUT = {
        titleSuggestion: 'Scout suggestion draft',
        summarySuggestion: 'A short stub summary based on the provided Scout draft.',
        translationSuggestion: '',
        emotionTags: ['curious', 'warm'],
        memoSuggestion: 'Review this stub suggestion before saving it to your LoveTree.',
        safetyNote: 'Stub suggestion only. Review before saving.'
    };

    // ─── Input Normalization ──────────────────────────────────────────────────

    /**
     * Normalizes suggestion input to a safe, consistent shape.
     * All fields are optional - provider must handle missing/undefined gracefully.
     * Never fetches or processes external content from sourceUrl.
     *
     * @param {Object} rawInput
     * @returns {Object}
     */
    function normalizeScoutSuggestionInput(rawInput) {
        const input = rawInput || {};

        // sourceUrl: string only, never fetched
        const sourceUrl = typeof input.sourceUrl === 'string' ? input.sourceUrl.trim() : '';

        // excerpt: user-entered text only
        const excerpt = typeof input.excerpt === 'string' ? input.excerpt.trim() : '';

        // summary: optional pre-computed summary
        const summary = typeof input.summary === 'string' ? input.summary.trim() : '';

        // memo: user-entered text only
        const memo = typeof input.memo === 'string' ? input.memo.trim() : '';

        // requestedLanguage: 'ko' | 'en' (default 'ko')
        const requestedLanguage = input.requestedLanguage === 'en' ? 'en' : 'ko';

        // desiredTone: optional tone hint
        const desiredTone = typeof input.desiredTone === 'string' ? input.desiredTone.trim() : '';

        // maxOutputLength: positive integer (default 200)
        const maxOutputLength = Number.isInteger(input.maxOutputLength) && input.maxOutputLength > 0
            ? Math.min(input.maxOutputLength, 500)
            : 200;

        return {
            sourceUrl,
            excerpt,
            summary,
            memo,
            requestedLanguage,
            desiredTone,
            maxOutputLength
        };
    }

    // ─── Output Normalization ─────────────────────────────────────────────────

    /**
     * Normalizes suggestion output to enforce schema constraints.
     * Ensures all fields are present and within limits.
     *
     * @param {Object} rawOutput
     * @returns {Object}
     */
    function normalizeScoutSuggestionOutput(rawOutput) {
        const output = rawOutput || {};

        // titleSuggestion: string, max 50 chars
        const titleSuggestion = typeof output.titleSuggestion === 'string'
            ? output.titleSuggestion.trim().slice(0, MAX_TITLE_LENGTH)
            : '';

        // summarySuggestion: string, max 200 chars
        const summarySuggestion = typeof output.summarySuggestion === 'string'
            ? output.summarySuggestion.trim().slice(0, MAX_SUMMARY_LENGTH)
            : '';

        // translationSuggestion: string, max 200 chars
        const translationSuggestion = typeof output.translationSuggestion === 'string'
            ? output.translationSuggestion.trim().slice(0, MAX_SUMMARY_LENGTH)
            : '';

        // emotionTags: array of strings, max 4, each max 20 chars
        let emotionTags = [];
        if (Array.isArray(output.emotionTags)) {
            emotionTags = output.emotionTags
                .filter(t => typeof t === 'string' && t.trim().length > 0)
                .map(t => t.trim().slice(0, MAX_EMOTION_TAG_LENGTH))
                .slice(0, MAX_EMOTION_TAGS);
        }

        // memoSuggestion: string, max 500 chars
        const memoSuggestion = typeof output.memoSuggestion === 'string'
            ? output.memoSuggestion.trim().slice(0, MAX_MEMO_LENGTH)
            : '';

        // safetyNote: string
        const safetyNote = typeof output.safetyNote === 'string'
            ? output.safetyNote.trim()
            : 'This is an AI-generated suggestion. Review before saving.';

        return {
            titleSuggestion,
            summarySuggestion,
            translationSuggestion,
            emotionTags,
            memoSuggestion,
            safetyNote
        };
    }

    // ─── Stub Provider Implementation ─────────────────────────────────────────

    /**
     * Creates a deterministic stub suggestion provider.
     * No network, no API key, no environment dependency.
     * Returns fixed suggestion for any input.
     *
     * @returns {Object}
     */
    function createScoutStubSuggestionProvider() {
        let callCount = 0;
        let lastInput = null;

        return {
            /**
             * Returns a deterministic suggestion for the given input.
             * @param {Object} input - Raw suggestion input
             * @returns {Promise<Object>} Normalized suggestion output
             */
            async suggest(input) {
                callCount++;
                lastInput = normalizeScoutSuggestionInput(input);

                // Deterministic stub output - same for every call
                const stubOutput = {
                    titleSuggestion: DEFAULT_STUB_OUTPUT.titleSuggestion,
                    summarySuggestion: DEFAULT_STUB_OUTPUT.summarySuggestion,
                    translationSuggestion: lastInput.requestedLanguage === 'en'
                        ? 'Translated suggestion (stub)'
                        : '번역 제안 (스텁)',
                    emotionTags: [...DEFAULT_STUB_OUTPUT.emotionTags],
                    memoSuggestion: DEFAULT_STUB_OUTPUT.memoSuggestion,
                    safetyNote: DEFAULT_STUB_OUTPUT.safetyNote
                };

                return normalizeScoutSuggestionOutput(stubOutput);
            },

            /**
             * Gets provider metadata for debugging.
             * @returns {Object}
             */
            getMeta() {
                return {
                    name: 'ScoutStubSuggestionProvider',
                    version: '1.0.0',
                    deterministic: true,
                    network: false,
                    apiKey: false,
                    callCount,
                    lastInput
                };
            },

            /**
             * Resets call tracking (for tests).
             */
            reset() {
                callCount = 0;
                lastInput = null;
            }
        };
    }

    // ─── Provider Abstraction (Interface Definition) ──────────────────────────

    /**
     * Creates a suggestion provider from a custom implementation.
     * Used for future real provider integration (Phase D+).
     *
     * @param {Object} impl
     * @param {Function} impl.suggest - Async function(input) -> output
     * @returns {Object}
     */
    function createScoutSuggestionProvider(impl) {
        if (!impl || typeof impl.suggest !== 'function') {
            throw new Error('Provider implementation must have async suggest(input) function');
        }

        return {
            async suggest(input) {
                const normalizedInput = normalizeScoutSuggestionInput(input);
                const rawOutput = await impl.suggest(normalizedInput);
                return normalizeScoutSuggestionOutput(rawOutput);
            },

            getMeta() {
                return {
                    name: impl.name || 'CustomScoutSuggestionProvider',
                    version: impl.version || '1.0.0',
                    deterministic: false,
                    network: !!impl.requiresNetwork,
                    apiKey: !!impl.requiresApiKey
                };
            }
        };
    }

    // ─── Availability Helper ───────────────────────────────────────────────────────

    /**
     * Checks the availability of Scout suggestion providers.
     * Used by UI to determine if suggestions are available, pending configuration, or unavailable.
     *
     * @param {string} [mode] - Optional mode to check: 'stub' (default), 'live', or any future provider type
     * @returns {Object} Availability info with available (boolean), mode (string), message (string)
     */
    function getScoutSuggestionAvailability(mode) {
        // Default to stub mode if not specified
        const requestedMode = mode || 'stub';

        // Stub provider is always available (deterministic, no network, no config)
        if (requestedMode === 'stub') {
            return {
                available: true,
                mode: 'stub',
                message: 'AI 제안이 활성화되었습니다. (스텁 모드)'
            };
        }

        // Future live provider modes are pending configuration
        // In the future, this would check for valid API keys, endpoint config, etc.
        // For now, any non-stub mode returns pending_configuration
        if (requestedMode === 'live' || requestedMode !== 'stub') {
            return {
                available: false,
                mode: 'pending_configuration',
                message: 'AI 제안 설정이 아직 준비되지 않았습니다. 직접 입력 후 저장할 수 있습니다.'
            };
        }

        // Fallback - should not reach here
        return {
            available: false,
            mode: 'unavailable',
            message: 'AI 제안을 사용할 수 없습니다. 직접 입력 후 저장할 수 있습니다.'
        };
    }

    // ─── Export ───────────────────────────────────────────────────────────────

    window.LoveBudScoutSuggestionProvider = {
        createScoutSuggestionProvider,
        createScoutStubSuggestionProvider,
        normalizeScoutSuggestionInput,
        normalizeScoutSuggestionOutput,
        getScoutSuggestionAvailability
    };

    scoutSuggestionDebugLog('[LoveBudScoutSuggestionProvider] Module loaded');
})();