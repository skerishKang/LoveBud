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

// ─── Safe Logging Constants ────────────────────────────────────────────────────

const SCOUT_LOG_ALLOWED_FIELDS = Object.freeze([
  'requestId',
  'providerMode',
  'status',
  'errorCode',
  'latencyMs',
  'inputLength',
  'outputFieldCount',
  'emotionTagCount',
  'hasSourceUrl',
  'language',
  'tone',
  'timestamp',
]);

const SCOUT_LOG_PROHIBITED_KEYS = Object.freeze([
  'prompt',
  'excerpt',
  'summary',
  'memo',
  'translationSuggestion',
  'summarySuggestion',
  'memoSuggestion',
  'titleSuggestion',
  'rawProviderResponse',
  'rawModelOutput',
  'sourceUrl',
  'apiKey',
  'API_KEY',
  'authorization',
  'Authorization',
  'bearer',
  'token',
  'session',
  'cookie',
  'firebaseCredential',
  'uid',
  'email',
  'phone',
  'password',
  'secret',
]);

// ─── Timeout / Retry Constants ───────────────────────────────────────────────

const SCOUT_LIVE_PROVIDER_TIMEOUT_RETRY_POLICY = Object.freeze({
  defaultTimeoutMs: 8000,
  defaultMaxRetries: 0,
  maxAllowedRetries: 1,
  minTimeoutMs: 50,
  maxTimeoutMs: 30000,
});

// ─── Output Safety Filter Constants ──────────────────────────────────────────

const SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS = Object.freeze({
  maxTitleLength: 120,
  maxSummaryLength: 500,
  maxTranslationLength: 800,
  maxMemoLength: 500,
  maxSafetyNoteLength: 300,
  maxEmotionTags: 4,
  maxEmotionTagLength: 20,
  minExcerptReproductionBlockLen: 160,
});

/**
 * Recursively sanitizes a payload object — redacts or removes prohibited fields,
 * keeps allowed safe fields only. Never throws.
 *
 * @param {Object} payload - The raw event payload to sanitize
 * @param {Set} [prohibitedSet] - Internal use for recursion
 * @returns {Object} sanitized payload
 */
function sanitizeScoutLiveProviderLogPayload(payload) {
  try {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }

    const prohibitedSet = new Set(SCOUT_LOG_PROHIBITED_KEYS);
    const result = {};

    for (const [key, value] of Object.entries(payload)) {
      // Strip prohibited keys entirely
      if (prohibitedSet.has(key)) {
        continue;
      }

      if (value !== null && typeof value === 'object') {
        if (Array.isArray(value)) {
          // Arrays: sanitize each item if object, keep primitives as-is (safe)
          result[key] = value.map(item => {
            if (item && typeof item === 'object' && !Array.isArray(item)) {
              return sanitizeScoutLiveProviderLogPayload(item);
            }
            return item;
          });
        } else {
          // Nested object: recurse
          result[key] = sanitizeScoutLiveProviderLogPayload(value);
        }
      } else {
        // Primitive: keep as-is (safe by definition in curated payload)
        result[key] = value;
      }
    }

    return result;
  } catch {
    // Never throw
    return {};
  }
}

/**
 * Creates a safe logging event from adapter execution context.
 * Only safe observability fields are included — no prompt/excerpt/sourceUrl/API key/PII.
 *
 * @param {Object} context - Adapter execution context
 * @param {string} [context.requestId] - Request identifier
 * @param {string} context.providerMode - The provider mode at time of execution
 * @param {string} context.status - 'success' or 'error'
 * @param {string} [context.errorCode] - Error code if status is error
 * @param {number} context.latencyMs - Round-trip latency in milliseconds
 * @param {number} [context.inputLength] - Total length of excerpt/summary/memo
 * @param {number} [context.outputFieldCount] - Number of non-empty suggestion fields
 * @param {number} [context.emotionTagCount] - Number of emotion tags
 * @param {boolean} [context.hasSourceUrl] - Whether a source URL was provided
 * @param {string} [context.language] - Normalized language
 * @param {string} [context.tone] - Normalized tone
 * @returns {Object} sanitized log event
 */
function createScoutLiveProviderLogEvent(context) {
  try {
    if (!context || typeof context !== 'object') {
      return {};
    }

    const event = {
      requestId: typeof context.requestId === 'string' ? context.requestId : '',
      providerMode: typeof context.providerMode === 'string' ? context.providerMode : 'unknown',
      status: typeof context.status === 'string' ? context.status : 'unknown',
      errorCode: typeof context.errorCode === 'string' && context.errorCode.length > 0 ? context.errorCode : '',
      latencyMs: typeof context.latencyMs === 'number' && context.latencyMs >= 0 ? context.latencyMs : 0,
      inputLength: typeof context.inputLength === 'number' && context.inputLength >= 0 ? context.inputLength : 0,
      outputFieldCount: typeof context.outputFieldCount === 'number' && context.outputFieldCount >= 0 ? context.outputFieldCount : 0,
      emotionTagCount: typeof context.emotionTagCount === 'number' && context.emotionTagCount >= 0 ? context.emotionTagCount : 0,
      hasSourceUrl: typeof context.hasSourceUrl === 'boolean' ? context.hasSourceUrl : false,
      language: typeof context.language === 'string' ? context.language : '',
      tone: typeof context.tone === 'string' ? context.tone : '',
      timestamp: new Date().toISOString(),
    };

    // Sanitize as safety net (should be clean by construction)
    return sanitizeScoutLiveProviderLogPayload(event);
  } catch {
    // Never throw
    return {};
  }
}

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

// ─── Output Safety Filter ─────────────────────────────────────────────────────

/**
 * Filters raw provider output for safety before normalization.
 * Pure function — no side effects, no network, no storage.
 *
 * Checks:
 * - Prohibited metadata fields stripped (rawProviderResponse, rawModelOutput, etc.)
 * - Credential-like patterns in suggestion text → PROVIDER_ERROR
 * - Excessive excerpt reproduction → PROVIDER_ERROR
 * - Full excerpt reproduction → PROVIDER_ERROR
 * - sourceUrl raw repetition → PROVIDER_ERROR
 *
 * @param {Object} rawOutput - The raw output from executor/provider
 * @param {Object} [context] - Optional filter context
 * @param {string} [context.excerpt] - Original user excerpt for reproduction detection
 * @param {string} [context.sourceUrl] - Original source URL for repetition detection
 * @returns {{ ok: boolean, output?: Object, error?: { code: string, message: string } }}
 */
function filterScoutLiveProviderOutput(rawOutput, context) {
  if (!rawOutput || typeof rawOutput !== 'object') {
    return { ok: true, output: rawOutput }; // non-object handled by validateResponse
  }

  const ctx = context || {};
  const excerpt = ctx.excerpt || '';
  const sourceUrl = ctx.sourceUrl || '';

  // ── 1. Strip prohibited metadata fields from output ────────────────
  const output = { ...rawOutput };
  const metadataFields = ['rawProviderResponse', 'rawModelOutput', 'debug', 'trace', 'log', 'metadata'];
  for (const field of metadataFields) {
    delete output[field];
  }

  // ── 2. Collect all suggestion text fields for pattern checking ─────
  const textFields = [
    output.titleSuggestion,
    output.summarySuggestion,
    output.translationSuggestion,
    output.memoSuggestion,
    output.safetyNote,
  ].filter(f => typeof f === 'string');

  // ── 3. Check credential-like patterns in text ─────────────────────
  const credentialPatterns = [
    /sk-[a-zA-Z0-9]{20,}/,             // OpenAI sk- keys // gitguardian: ignore
    /AIza[0-9A-Za-z_-]{35}/,            // Firebase/GCP API keys // gitguardian: ignore
    /ghp_[a-zA-Z0-9]{36,}/,             // GitHub tokens // gitguardian: ignore
    /\bbearer\s+[a-zA-Z0-9._-]+/i,      // Bearer tokens
    /\bauthorization\s*:/i,              // Authorization header-like
    /\b(password|secret)\s*[:=]/i,       // Password/secret assignment
  ];

  for (const field of textFields) {
    for (const pattern of credentialPatterns) {
      if (pattern.test(field)) {
        return {
          ok: false,
          error: {
            code: ERROR_CODES.PROVIDER_ERROR,
            message: 'Scout live suggestion output failed safety validation.',
          },
        };
      }
    }
  }

  // ── 4. Check excessive/full excerpt reproduction ──────────────────
  if (excerpt && excerpt.length >= SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS.minExcerptReproductionBlockLen) {
    const excerptLower = excerpt.toLowerCase();
    const summaryText = String(output.summarySuggestion || '').toLowerCase();
    const translationText = String(output.translationSuggestion || '').toLowerCase();
    const memoText = String(output.memoSuggestion || '').toLowerCase();
    const combinedText = summaryText + translationText + memoText;

    // Full excerpt reproduction (output equals or heavily overlaps excerpt)
    if (combinedText.includes(excerptLower)) {
      return {
        ok: false,
        error: {
          code: ERROR_CODES.PROVIDER_ERROR,
          message: 'Scout live suggestion output failed safety validation.',
        },
      };
    }
  }

  // ── 5. Check sourceUrl raw repetition in suggestion text ──────────
  if (sourceUrl && sourceUrl.length > 5) {
    const urlLower = sourceUrl.toLowerCase();
    for (const field of textFields) {
      const fieldLower = field.toLowerCase();
      if (fieldLower.includes(urlLower)) {
        return {
          ok: false,
          error: {
            code: ERROR_CODES.PROVIDER_ERROR,
            message: 'Scout live suggestion output failed safety validation.',
          },
        };
      }
    }
  }

  return { ok: true, output };
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
 * Runs output safety filter before normalization.
 *
 * @param {*} rawResponse - The raw output from the provider (may be any type)
 * @param {Object} [options] - Optional validation options
 * @param {string} [options.requestedLanguage] - 'ko' or 'en'
 * @param {string} [options.excerpt] - Original user excerpt for safety filter reproduction detection
 * @param {string} [options.sourceUrl] - Original source URL for safety filter repetition detection
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

  // ── Run output safety filter ───────────────────────────────────────
  const filterResult = filterScoutLiveProviderOutput(rawResponse, {
    excerpt: opts.excerpt,
    sourceUrl: opts.sourceUrl,
  });

  if (!filterResult.ok) {
    return filterResult;
  }

  const filtered = filterResult.output;
  const requestedLanguage = ALLOWED_LANGUAGES.includes(opts.requestedLanguage)
    ? opts.requestedLanguage
    : DEFAULT_LANGUAGE;

  // --- Normalize each field ---
  const titleSuggestion = typeof filtered.titleSuggestion === 'string'
    ? filtered.titleSuggestion.trim().slice(0, SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS.maxTitleLength)
    : '';

  const summarySuggestion = typeof filtered.summarySuggestion === 'string'
    ? filtered.summarySuggestion.trim().slice(0, SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS.maxSummaryLength)
    : '';

  const translationSuggestion = typeof filtered.translationSuggestion === 'string'
    ? filtered.translationSuggestion.trim().slice(0, SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS.maxTranslationLength)
    : '';

  let emotionTags = Array.isArray(filtered.emotionTags)
    ? filtered.emotionTags
    : [];

  // Ensure all items are strings and clamp count
  emotionTags = emotionTags
    .slice(0, SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS.maxEmotionTags)
    .map(tag => String(tag).trim().slice(0, SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS.maxEmotionTagLength))
    .filter(tag => tag.length > 0);

  const memoSuggestion = typeof filtered.memoSuggestion === 'string'
    ? filtered.memoSuggestion.trim().slice(0, SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS.maxMemoLength)
    : '';

  let safetyNote = typeof filtered.safetyNote === 'string'
    ? filtered.safetyNote.trim().slice(0, SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS.maxSafetyNoteLength)
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
 * CURRENTLY: Returns safe unavailable errors when no executor is provided.
 * When an injected mock executor is present, runs prompt builder → executor
 * → response validator (network-free, no real provider call).
 * FUTURE: When a real provider is configured, this will route to the provider.
 *
 * @param {Object} [config] - Optional adapter configuration
 * @param {string} [config.provider] - Future: provider name (ignored in skeleton)
 * @param {string} [config.apiKey] - Future: API key (ignored in skeleton — NEVER used)
 * @param {string} [config.baseUrl] - Future: base URL (ignored in skeleton)
 * @param {Function} [config.executor] - Injected mock executor for test/contract only.
 *   Signature: async ({ prompt, normalizedInput }) => rawProviderResponse
 *   When provided, adapter.suggest() runs prompt builder → executor → response validator.
 *   When absent, adapter.suggest() returns CONFIG_MISSING safe-fail.
 * @param {Function} [config.logger] - Optional injected logger for observability.
 *   Signature: (event) => void
 *   Receives sanitized events only — no prompt/excerpt/sourceUrl/API key/PII.
 *   Throw-safe: logger failures are swallowed and never break suggest().
 * @param {string} [config.requestId] - Optional request identifier for log events.
 * @param {number} [config.timeoutMs] - Optional timeout override for executor (clamped to [50, 30000]).
 * @param {number} [config.maxRetries] - Optional max retries for executor (clamped to [0, maxAllowedRetries]).
 * @returns {Object} adapter - { name, version, status, suggest, buildPrompt, validateResponse }
 */
function createScoutLiveProviderAdapter(config) {
  const effectiveConfig = config || {};
  const hasConfig = effectiveConfig.provider && effectiveConfig.apiKey;
  const executor = typeof effectiveConfig.executor === 'function' ? effectiveConfig.executor : null;
  const logger = typeof effectiveConfig.logger === 'function' ? effectiveConfig.logger : null;
  const requestId = typeof effectiveConfig.requestId === 'string' && effectiveConfig.requestId.length > 0
    ? effectiveConfig.requestId
    : '';
  const timeoutMs = effectiveConfig.timeoutMs;
  const maxRetries = effectiveConfig.maxRetries;

  /**
   * Safely emits a log event through the injected logger if present.
   * Never throws — logger failures are swallowed silently.
   * Only sanitized events are passed to the logger.
   */
  function safeLogEvent(context) {
    if (!logger) return;
    try {
      const event = createScoutLiveProviderLogEvent(context);
      logger(event);
    } catch {
      // Swallow — logger must never break suggestion flow
    }
  }

  return {
    name: 'scout-live-provider-adapter-skeleton',
    version: ADAPTER_VERSION,
    status: hasConfig ? ADAPTER_STATUS.READY : ADAPTER_STATUS.UNCONFIGURED,

    /**
     * Suggests using the live provider.
     *
     * When an executor is injected (test-only), runs the full flow:
     *   prompt builder → injected executor → response validator
     * When no executor, returns CONFIG_MISSING safe-fail (no real provider call).
     *
     * @param {Object} input - Suggestion input (same shape as buildScoutLiveProviderPrompt input)
     * @returns {Promise<{ ok: boolean, providerMode?: string, suggestion?: Object, error?: { code: string, message: string } }>}
     */
    async suggest(input) {
      const startTime = Date.now();

      // Validate input first
      const promptResult = buildScoutLiveProviderPrompt(input);
      if (!promptResult.ok) {
        safeLogEvent({
          requestId,
          providerMode: 'live_mock',
          status: 'error',
          errorCode: promptResult.error?.code || 'VALIDATION_ERROR',
          latencyMs: Date.now() - startTime,
          inputLength: computeInputLength(input),
          outputFieldCount: 0,
          emotionTagCount: 0,
          hasSourceUrl: !!(input?.sourceUrl),
          language: promptResult.normalizedInput?.requestedLanguage || '',
          tone: promptResult.normalizedInput?.desiredTone || '',
        });
        return promptResult;
      }

      const ni = promptResult.normalizedInput;

      // If no executor injected, return safe unavailable (no real provider call)
      if (!executor) {
        safeLogEvent({
          requestId,
          providerMode: 'config_missing',
          status: 'error',
          errorCode: 'CONFIG_MISSING',
          latencyMs: Date.now() - startTime,
          inputLength: computeInputLength(input),
          outputFieldCount: 0,
          emotionTagCount: 0,
          hasSourceUrl: !!(input?.sourceUrl),
          language: ni.requestedLanguage,
          tone: ni.desiredTone,
        });
        return {
          ok: false,
          error: {
            code: ERROR_CODES.CONFIG_MISSING,
            message: 'Scout live suggestion provider is not configured.',
          },
        };
      }

      // ── Mock executor path with timeout/retry (network-free, provider-SDK-free) ─
      const execResult = await runScoutLiveProviderExecutorWithTimeout(
        executor,
        {
          prompt: promptResult.prompt,
          normalizedInput: promptResult.normalizedInput,
        },
        { timeoutMs, maxRetries }
      );

      if (!execResult.ok) {
        safeLogEvent({
          requestId,
          providerMode: 'live_mock',
          status: 'error',
          errorCode: 'PROVIDER_ERROR',
          latencyMs: Date.now() - startTime,
          inputLength: computeInputLength(input),
          outputFieldCount: 0,
          emotionTagCount: 0,
          hasSourceUrl: !!(input?.sourceUrl),
          language: ni.requestedLanguage,
          tone: ni.desiredTone,
          retryCount: execResult.retryCount || 0,
          maxRetries: Math.min(
            typeof maxRetries === 'number' && maxRetries >= 0 ? maxRetries : 0,
            SCOUT_LIVE_PROVIDER_TIMEOUT_RETRY_POLICY.maxAllowedRetries
          ),
        });
        return {
          ok: false,
          error: {
            code: ERROR_CODES.PROVIDER_ERROR,
            message: 'Scout live suggestion provider failed safely.',
          },
        };
      }

      const rawResponse = execResult.result;

      // Validate and normalize the executor output
      const validationResult = validateScoutLiveProviderResponse(
        rawResponse,
        {
          requestedLanguage: ni.requestedLanguage,
          excerpt: ni.excerpt,
          sourceUrl: ni.sourceUrl,
        }
      );

      if (!validationResult.ok) {
        safeLogEvent({
          requestId,
          providerMode: 'live_mock',
          status: 'error',
          errorCode: 'PROVIDER_ERROR',
          latencyMs: Date.now() - startTime,
          inputLength: computeInputLength(input),
          outputFieldCount: 0,
          emotionTagCount: 0,
          hasSourceUrl: !!(input?.sourceUrl),
          language: ni.requestedLanguage,
          tone: ni.desiredTone,
        });
        return {
          ok: false,
          error: {
            code: ERROR_CODES.PROVIDER_ERROR,
            message: 'Scout live suggestion provider failed safely.',
          },
        };
      }

      // Count non-empty output fields
      const suggestion = validationResult.suggestion;
      let outputFieldCount = 0;
      if (suggestion.titleSuggestion) outputFieldCount++;
      if (suggestion.summarySuggestion) outputFieldCount++;
      if (suggestion.translationSuggestion) outputFieldCount++;
      if (suggestion.memoSuggestion) outputFieldCount++;
      if (suggestion.safetyNote) outputFieldCount++;

      safeLogEvent({
        requestId,
        providerMode: 'live_mock',
        status: 'success',
        errorCode: '',
        latencyMs: Date.now() - startTime,
        inputLength: computeInputLength(input),
        outputFieldCount,
        emotionTagCount: suggestion.emotionTags?.length || 0,
        hasSourceUrl: !!(input?.sourceUrl),
        language: ni.requestedLanguage,
        tone: ni.desiredTone,
      });

      // Return normalized mock suggestion
      return {
        ok: true,
        providerMode: 'live_mock',
        suggestion,
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

/**
 * Computes a safe input length metric for logging.
 * Returns total character length of excerpt + summary + memo.
 * Never throws.
 * @param {Object} input - Raw input object
 * @returns {number}
 */
function computeInputLength(input) {
  try {
    if (!input || typeof input !== 'object') return 0;
    const excerpt = String(input.excerpt || '').length;
    const summary = String(input.summary || '').length;
    const memo = String(input.memo || '').length;
    return excerpt + summary + memo;
  } catch {
    return 0;
  }
}

// ─── Timeout / Retry Helper ─────────────────────────────────────────────────

/**
 * Runs a mock executor with a timeout and optional retry.
 * Network-free — uses Promise.race with setTimeout for timeout simulation.
 * No AbortController, no fetch, no SDK.
 *
 * - executor throw/timeout → retry if retries remain
 * - retry exhaustion → returns PROVIDER_ERROR
 * - successful result → returned as-is
 *
 * @param {Function} executor - Async function ({ prompt, normalizedInput }) => rawResponse
 * @param {Object} payload - { prompt, normalizedInput } passed to executor
 * @param {Object} [options]
 * @param {number} [options.timeoutMs] - Timeout in ms (clamped to [50, 30000])
 * @param {number} [options.maxRetries] - Max retries (clamped to [0, maxAllowedRetries])
 * @returns {Promise<{ ok: boolean, result?: any, retryCount?: number, error?: { code: string, message: string } }>}
 */
async function runScoutLiveProviderExecutorWithTimeout(executor, payload, options) {
  const opts = options || {};
  const policy = SCOUT_LIVE_PROVIDER_TIMEOUT_RETRY_POLICY;

  // Clamp timeoutMs
  let timeoutMs = typeof opts.timeoutMs === 'number' && opts.timeoutMs >= policy.minTimeoutMs
    ? opts.timeoutMs
    : policy.defaultTimeoutMs;
  if (timeoutMs > policy.maxTimeoutMs) timeoutMs = policy.maxTimeoutMs;

  // Clamp maxRetries
  let maxRetries = typeof opts.maxRetries === 'number' && opts.maxRetries >= 0
    ? opts.maxRetries
    : policy.defaultMaxRetries;
  if (maxRetries > policy.maxAllowedRetries) maxRetries = policy.maxAllowedRetries;

  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timeoutId;
    try {
      const result = await Promise.race([
        executor(payload),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
        }),
      ]);
      clearTimeout(timeoutId);
      return { ok: true, result, retryCount };
    } catch (err) {
      clearTimeout(timeoutId);
      retryCount++;
      // On last attempt, don't retry
      if (attempt >= maxRetries) break;
      // Small delay between retries (test-friendly: 0)
      if (opts.retryDelayMs > 0) {
        await new Promise(r => setTimeout(r, opts.retryDelayMs));
      }
    }
  }

  return {
    ok: false,
    error: {
      code: 'PROVIDER_ERROR',
      message: 'Scout live suggestion provider failed safely.',
    },
    retryCount,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

// ES module style for Cloudflare Pages Functions
export {
  SCOUT_LIVE_PROVIDER_ADAPTER_STATUS,
  SCOUT_LIVE_PROVIDER_TIMEOUT_RETRY_POLICY,
  SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS,
  buildScoutLiveProviderPrompt,
  validateScoutLiveProviderResponse,
  createScoutLiveProviderAdapter,
  createScoutLiveProviderLogEvent,
  sanitizeScoutLiveProviderLogPayload,
  runScoutLiveProviderExecutorWithTimeout,
  filterScoutLiveProviderOutput,
};
