/**
 * Scout Live Provider Adapter Skeleton
 * v20260606-1
 *
 * Pure-function adapter skeleton for a future live LLM suggestion provider.
 *
 * Provides:
 * - buildScoutLiveProviderPrompt: assembles a prompt from normalized allowed inputs
 * - validateScoutLiveProviderResponse: normalizes & validates provider raw output
 * - createScoutLiveProviderAdapter: returns a safe adapter that does NOT call any provider
 *
 * This module is a **contract skeleton** — no real provider call, no SDK import,
 * no API key, no fetch. The adapter currently returns CONFIG_MISSING or
 * PROVIDER_UNAVAILABLE safe errors only.
 *
 * Non-goals:
 * - No real LLM provider
 * - No provider SDK imports (openai, anthropic, gemini, groq, mistral, nvidia, etc.)
 * - No API keys or environment variables required
 * - No live provider call
 * - No external fetch (sourceUrl or otherwise)
 * - No persistence (localStorage/sessionStorage/addMemory/save)
 * - No auto-save
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const ADAPTER_STATUS = Object.freeze({
  UNCONFIGURED: 'unconfigured',
  READY: 'ready',
});

const MAX_EXCERPT_LENGTH = 5000;
const MAX_SUMMARY_LENGTH = 200;
const MAX_MEMO_LENGTH = 500;
const MAX_TITLE_LENGTH = 50;
const MAX_SUGGESTION_SUMMARY_LENGTH = 200;
const MAX_TRANSLATION_LENGTH = 500;
const MAX_MEMO_SUGGESTION_LENGTH = 500;
const MAX_EMOTION_TAGS = 4;
const MAX_EMOTION_TAG_LENGTH = 20;
const DEFAULT_MAX_OUTPUT_LENGTH = 200;
const MIN_OUTPUT_LENGTH = 50;
const MAX_OUTPUT_LENGTH = 500;

const ALLOWED_LANGUAGES = ['ko', 'en'];
const ALLOWED_TONES = ['casual', 'polite', 'emotional'];
const DEFAULT_LANGUAGE = 'ko';
const DEFAULT_TONE = 'polite';

const ADAPTER_VERSION = '0.0.1-skeleton';
const ERROR_CODES = Object.freeze({
  CONFIG_MISSING: 'CONFIG_MISSING',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
});

// ─── Status Constants ─────────────────────────────────────────────────────────

const SCOUT_LIVE_PROVIDER_ADAPTER_STATUS = Object.freeze({ ...ADAPTER_STATUS });

// ─── Prompt Builder ───────────────────────────────────────────────────────────

/**
 * Normalizes and validates raw input fields for the prompt.
 * Pure function — no side effects, no network, no storage.
 *
 * @param {Object} rawInput - Raw user input
 * @param {string} [rawInput.excerpt] - User-entered excerpt text
 * @param {string} [rawInput.summary] - Optional user-entered summary
 * @param {string} [rawInput.memo] - Optional user memo
 * @param {string} [rawInput.sourceUrl] - Optional attribution-only URL
 * @param {string} [rawInput.requestedLanguage] - 'ko' or 'en'
 * @param {string} [rawInput.desiredTone] - 'casual', 'polite', or 'emotional'
 * @param {number} [rawInput.maxOutputLength] - Bounded integer [50, 500]
 * @returns {{ ok: boolean, prompt?: string, normalizedInput?: Object, error?: { code: string, message: string } }}
 */
function buildScoutLiveProviderPrompt(rawInput) {
  if (!rawInput || typeof rawInput !== 'object') {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Input must be a non-null object.',
      },
    };
  }

  // --- Normalize allowed fields ---
  const excerpt = String(rawInput.excerpt || '').trim().slice(0, MAX_EXCERPT_LENGTH);
  const summary = String(rawInput.summary || '').trim().slice(0, MAX_SUMMARY_LENGTH);
  const memo = String(rawInput.memo || '').trim().slice(0, MAX_MEMO_LENGTH);
  const sourceUrl = String(rawInput.sourceUrl || '').trim();

  const requestedLanguage = ALLOWED_LANGUAGES.includes(rawInput.requestedLanguage)
    ? rawInput.requestedLanguage
    : DEFAULT_LANGUAGE;

  const desiredTone = ALLOWED_TONES.includes(rawInput.desiredTone)
    ? rawInput.desiredTone
    : DEFAULT_TONE;

  let maxOutputLength = parseInt(rawInput.maxOutputLength, 10);
  if (isNaN(maxOutputLength) || maxOutputLength < MIN_OUTPUT_LENGTH) {
    maxOutputLength = DEFAULT_MAX_OUTPUT_LENGTH;
  } else if (maxOutputLength > MAX_OUTPUT_LENGTH) {
    maxOutputLength = MAX_OUTPUT_LENGTH;
  }

  // --- Build normalized input ---
  const normalizedInput = {
    sourceUrl,
    excerpt,
    summary,
    memo,
    requestedLanguage,
    desiredTone,
    maxOutputLength,
  };

  // --- Prohibited data check ---
  // Check for API keys, auth tokens, credentials in raw input values
  const prohibitedPatterns = [
    /sk-[a-zA-Z0-9]{20,}/,             // OpenAI sk- keys
    /AIza[0-9A-Za-z_-]{35}/,            // Firebase/GCP API keys
    /ghp_[a-zA-Z0-9]{36,}/,             // GitHub tokens
    /xox[baprs]-[a-zA-Z0-9-]{10,}/,     // Slack tokens
    /-----BEGIN (RSA |EC )?PRIVATE KEY-----/i,
  ];
  const rawValues = [rawInput.excerpt, rawInput.summary, rawInput.memo, rawInput.sourceUrl]
    .filter(Boolean)
    .map(String);

  for (const val of rawValues) {
    for (const pattern of prohibitedPatterns) {
      if (pattern.test(val)) {
        return {
          ok: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Prohibited credential-like data detected in input.',
          },
        };
      }
    }
  }

  // --- Assemble system instruction ---
  const systemInstructionLines = [
    'You are helping draft a LoveBud Scout suggestion from user-provided text only.',
    'Do not fetch or infer from the source URL.',
    'Return JSON only with these fields:',
    '  titleSuggestion (string, max 50 chars),',
    '  summarySuggestion (string, max 200 chars),',
    '  translationSuggestion (string, max 500 chars),',
    '  emotionTags (array of strings, max 4, each max 20 chars),',
    '  memoSuggestion (string, max 500 chars),',
    '  safetyNote (string, always required).',
    'Do not reproduce long copyrighted passages verbatim.',
    'Keep output concise, editable, and review-required.',
    'The safetyNote must include a review-first message.',
    'The output is a suggestion only — user must review before saving.',
    `Language: ${requestedLanguage}. Tone: ${desiredTone}.`,
    `Max output length: ${maxOutputLength} tokens.`,
  ];

  // --- Build user content ---
  const userContentParts = [];

  if (excerpt) {
    userContentParts.push(`Excerpt: ${excerpt}`);
  }
  if (summary) {
    userContentParts.push(`Summary: ${summary}`);
  }
  if (memo) {
    userContentParts.push(`Memo: ${memo}`);
  }
  if (sourceUrl) {
    userContentParts.push(`Source URL (attribution only, do not fetch): ${sourceUrl}`);
  }

  if (userContentParts.length === 0) {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'At least one of excerpt, summary, or memo must be provided.',
      },
    };
  }

  const prompt = systemInstructionLines.join('\n') + '\n\n---\n\n' + userContentParts.join('\n\n');

  return {
    ok: true,
    prompt,
    normalizedInput,
  };
}

// ─── Response Validator ───────────────────────────────────────────────────────

const CANONICAL_SAFETY_NOTE_ENGLISH = [
  'This is an AI-generated suggestion. The provider was instructed to:',
  '- Use only the user-entered excerpt/memo text (no fetching, no inference)',
  '- Produce a transformative summary, not a verbatim reproduction',
  '- Return short, editable suggestions, not final saved content',
  '- Refuse to invent facts about the source beyond the user\'s text',
  '- Refuse to handle credentials, tokens, API keys, or PII',
  '- Refuse to bypass copyright or claim the source was fully read',
  'Always review the suggestion before saving it to your LoveTree.',
].join('\n');

/**
 * Validates and normalizes a raw provider response.
 * Pure function — no side effects, no network, no storage.
 *
 * @param {*} rawResponse - The raw output from the provider (may be any type)
 * @param {Object} [options] - Optional validation options
 * @param {string} [options.requestedLanguage] - 'ko' or 'en'
 * @returns {{ ok: boolean, suggestion?: Object, error?: { code: string, message: string } }}
 */
function validateScoutLiveProviderResponse(rawResponse, options) {
  // --- Handle null/undefined/non-object ---
  if (!rawResponse || typeof rawResponse !== 'object' || Array.isArray(rawResponse)) {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.PROVIDER_ERROR,
        message: 'Provider response was not a valid JSON object.',
      },
    };
  }

  const opts = options || {};
  const requestedLanguage = ALLOWED_LANGUAGES.includes(opts.requestedLanguage)
    ? opts.requestedLanguage
    : DEFAULT_LANGUAGE;

  // --- Normalize each field ---
  const titleSuggestion = typeof rawResponse.titleSuggestion === 'string'
    ? rawResponse.titleSuggestion.trim().slice(0, MAX_TITLE_LENGTH)
    : '';

  const summarySuggestion = typeof rawResponse.summarySuggestion === 'string'
    ? rawResponse.summarySuggestion.trim().slice(0, MAX_SUGGESTION_SUMMARY_LENGTH)
    : '';

  const translationSuggestion = typeof rawResponse.translationSuggestion === 'string'
    ? rawResponse.translationSuggestion.trim().slice(0, MAX_TRANSLATION_LENGTH)
    : '';

  let emotionTags = Array.isArray(rawResponse.emotionTags)
    ? rawResponse.emotionTags
    : [];

  // Ensure all items are strings and clamp count
  emotionTags = emotionTags
    .slice(0, MAX_EMOTION_TAGS)
    .map(tag => String(tag).trim().slice(0, MAX_EMOTION_TAG_LENGTH))
    .filter(tag => tag.length > 0);

  const memoSuggestion = typeof rawResponse.memoSuggestion === 'string'
    ? rawResponse.memoSuggestion.trim().slice(0, MAX_MEMO_SUGGESTION_LENGTH)
    : '';

  let safetyNote = typeof rawResponse.safetyNote === 'string'
    ? rawResponse.safetyNote.trim()
    : '';

  // --- Ensure safetyNote is non-empty ---
  if (!safetyNote) {
    safetyNote = CANONICAL_SAFETY_NOTE_ENGLISH;
  }

  // --- Build normalized suggestion ---
  const suggestion = {
    titleSuggestion,
    summarySuggestion,
    translationSuggestion,
    emotionTags,
    memoSuggestion,
    safetyNote,
  };

  return {
    ok: true,
    suggestion,
  };
}

// ─── Adapter Skeleton ─────────────────────────────────────────────────────────

/**
 * Creates a Scout live provider adapter.
 *
 * CURRENTLY: Returns safe unavailable errors. Does NOT call any real provider.
 * FUTURE: When a real provider is configured, this will route to the provider.
 *
 * @param {Object} [config] - Optional adapter configuration
 * @param {string} [config.provider] - Future: provider name (ignored in skeleton)
 * @param {string} [config.apiKey] - Future: API key (ignored in skeleton — NEVER used)
 * @param {string} [config.baseUrl] - Future: base URL (ignored in skeleton)
 * @returns {Object} adapter - { name, version, status, suggest, buildPrompt, validateResponse }
 */
function createScoutLiveProviderAdapter(config) {
  const effectiveConfig = config || {};
  const hasConfig = effectiveConfig.provider && effectiveConfig.apiKey;

  return {
    name: 'scout-live-provider-adapter-skeleton',
    version: ADAPTER_VERSION,
    status: hasConfig ? ADAPTER_STATUS.READY : ADAPTER_STATUS.UNCONFIGURED,

    /**
     * Suggests using the live provider.
     *
     * CURRENTLY: Returns a safe unavailable error regardless of config.
     * FUTURE: Will call the configured live provider.
     *
     * @param {Object} input - Suggestion input (same shape as buildScoutLiveProviderPrompt input)
     * @returns {Promise<{ ok: boolean, suggestion?: Object, error?: { code: string, message: string } }>}
     */
    async suggest(input) {
      // Validate input first
      const promptResult = buildScoutLiveProviderPrompt(input);
      if (!promptResult.ok) {
        return promptResult;
      }

      // Skeleton: always return safe unavailable (no real provider call)
      return {
        ok: false,
        error: {
          code: ERROR_CODES.CONFIG_MISSING,
          message: 'Scout live suggestion provider is not configured.',
        },
      };
    },

    /**
     * Builds a prompt from the given input.
     * Delegates to buildScoutLiveProviderPrompt.
     */
    buildPrompt(input) {
      return buildScoutLiveProviderPrompt(input);
    },

    /**
     * Validates a raw provider response.
     * Delegates to validateScoutLiveProviderResponse.
     */
    validateResponse(rawResponse, options) {
      return validateScoutLiveProviderResponse(rawResponse, options);
    },
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

// ES module style for Cloudflare Pages Functions
export {
  SCOUT_LIVE_PROVIDER_ADAPTER_STATUS,
  buildScoutLiveProviderPrompt,
  validateScoutLiveProviderResponse,
  createScoutLiveProviderAdapter,
};
