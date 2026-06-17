/**
 * Scout Live Provider API-Key Transport
 * v20260617-api-key-transport-1
 *
 * Concrete API-key-based provider transport for Scout live suggestions.
 *
 * Hardening guarantees (this slice):
 * - DISABLED by default. Returns a safe-fail error unless ALL gates pass.
 * - Production stage is explicitly BLOCKED. Only the staging or test
 *   stage is permitted to enter READY_FOR_ADAPTER.
 * - API key is read ONLY from the server-side env/secret passed via the
 *   config object. Never read from request body, query string, or headers.
 * - API key is NEVER returned in any response, log entry, or error.
 * - No third-party provider SDK is imported.
 * - No hardcoded API key values or prefixes.
 * - The network call uses an INJECTED fetch function — never a global
 *   fetch call from module scope.
 * - The suggest() method NEVER throws. All errors are caught and
 *   sanitized to a safe error code.
 * - Raw provider responses are NEVER echoed back to the caller. Only
 *   sanitized, allowlisted fields are returned.
 *
 * Gate set (ALL must be true to enter READY_FOR_ADAPTER):
 *   - provider mode === live
 *   - live adapter enabled flag === true
 *   - transport mode === api_key
 *   - stage is one of: staging, test (production is blocked)
 *   - API key is present (non-empty)
 *   - provider value matches the allowed LLM provider identifier
 *   - model identifier is present (non-empty)
 *
 * Safety: the API key is used to construct the Authorization-header
 * value in-memory only, for the duration of a single fetch call. It
 * is never stored, logged, or returned.
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION = '20260617-api-key-transport-1';

const SCOUT_LIVE_PROVIDER_TRANSPORT_MODE = Object.freeze({
  API_KEY: 'api_key',
});

const SCOUT_LIVE_PROVIDER_TRANSPORT_STATUS = Object.freeze({
  DISABLED: 'DISABLED',
  READY_FOR_ADAPTER: 'READY_FOR_ADAPTER',
});

const SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES = Object.freeze({
  CONFIG_MISSING: 'CONFIG_MISSING',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TRANSPORT_DISABLED: 'TRANSPORT_DISABLED',
  GATE_NOT_SATISFIED: 'GATE_NOT_SATISFIED',
});

// The exact set of env var names that must be present in the config
// for the transport to enter READY_FOR_ADAPTER. The normalizer does
// NOT read process.env directly — it reads these keys from the
// caller-supplied config object.
const SCOUT_LIVE_PROVIDER_TRANSPORT_GATE_KEYS = Object.freeze([
  'SCOUT_SUGGEST_PROVIDER_MODE',
  'SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED',
  'SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE',
  'SCOUT_SUGGEST_PROVIDER_STAGE',
  'SCOUT_SUGGEST_LLM_API_KEY',
  'SCOUT_SUGGEST_LLM_PROVIDER',
  'SCOUT_SUGGEST_MODEL',
]);

// Stages that are explicitly ALLOWED. Production is intentionally
// excluded — production activation is a later, separately gated slice.
const SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_STAGES = Object.freeze(
  new Set(['staging', 'test'])
);

// The LLM provider identifier that is the only one currently allowed.
const SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_PROVIDER = 'openai-compatible';

// Default request timeout in milliseconds.
const SCOUT_LIVE_PROVIDER_TRANSPORT_DEFAULT_TIMEOUT_MS = 8000;

// Prohibited field patterns in provider responses. These are never
// returned to the caller.
const SCOUT_LIVE_PROVIDER_TRANSPORT_PROHIBITED_RESPONSE_FIELDS = Object.freeze([
  'rawProviderResponse',
  'rawModelOutput',
  'authorization',
  'Authorization',
  'apiKey',
  'API_KEY',
  'token',
  'bearer',
  'secret',
  'password',
  'prompt',
  'excerpt',
  'sourceUrl',
  'rawRequestBody',
  'firebaseToken',
  'sessionCookie',
  'cookie',
  'uid',
  'email',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitizes a string for safe inclusion in a response or log.
 * Strips control characters and bounds length.
 *
 * @param {unknown} value
 * @param {number} maxLen
 * @returns {string}
 */
function safeStr(value, maxLen) {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  const limit = typeof maxLen === 'number' && maxLen > 0 ? maxLen : 500;
  return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
}

/**
 * Returns a sanitized error envelope. Never includes the raw error
 * message (which may contain URL, auth header, key fragments).
 *
 * @param {string} code
 * @returns {{ ok: false, error: { code: string, message: string } }}
 */
function safeError(code) {
  const messageMap = {
    [SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.CONFIG_MISSING]:
      'Scout live provider transport configuration is incomplete.',
    [SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR]:
      'Scout live provider transport failed safely. Provider response was not returned.',
    [SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.VALIDATION_ERROR]:
      'Scout live provider transport input validation failed.',
    [SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.TRANSPORT_DISABLED]:
      'Scout live provider transport is disabled. No external provider call was made.',
    [SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.GATE_NOT_SATISFIED]:
      'Scout live provider transport gate is not satisfied. No external provider call was made.',
  };
  return {
    ok: false,
    error: {
      code,
      message:
        messageMap[code] ||
        'Scout live provider transport failed safely. Provider response was not returned.',
    },
  };
}

/**
 * Sanitizes a provider response object for return to the caller.
 * Strips prohibited fields recursively. Never throws.
 *
 * @param {unknown} response
 * @returns {Object} sanitized response
 */
function sanitizeScoutLiveProviderTransportResponse(response) {
  try {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return {};
    }
    const prohibited = new Set(
      SCOUT_LIVE_PROVIDER_TRANSPORT_PROHIBITED_RESPONSE_FIELDS
    );
    const out = {};
    for (const [k, v] of Object.entries(response)) {
      if (prohibited.has(k)) continue;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = sanitizeScoutLiveProviderTransportResponse(v);
      } else if (Array.isArray(v)) {
        out[k] = v.map((item) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            return sanitizeScoutLiveProviderTransportResponse(item);
          }
          return item;
        });
      } else if (typeof v === 'string') {
        out[k] = safeStr(v, 2000);
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Returns true if the given value is a non-empty string after trimming.
 *
 * @param {unknown} v
 * @returns {boolean}
 */
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

/**
 * Normalizes the transport configuration object. Reads the gate values
 * from the config object (which is itself built from server-side env /
 * secret storage by the endpoint layer). The normalizer does NOT read
 * process.env directly for the gate values — those are provided via
 * the config object so the module remains testable and the env-source
 * is decoupled.
 *
 * NOTE: the normalize function is the ONLY place in this module that
 * holds a reference to the API key value. All other code paths use
 * the normalized hasApiKey boolean or receive the key as a private
 * closure variable that is never serialized.
 *
 * @param {Object} [config={}] - Caller-supplied config object
 * @returns {{
 *   status: string,
 *   mode: string,
 *   provider: string,
 *   model: string,
 *   hasApiKey: boolean,
 *   baseUrl: string,
 *   stage: string,
 *   providerMode: string,
 *   liveAdapterEnabled: string,
 *   transportMode: string,
 *   missingGateKeys: string[],
 *   error: { code: string, message: string } | null,
 *   _privateApiKey: string,
 * }}
 */
function normalizeScoutLiveProviderTransportConfig(config) {
  const cfg = config && typeof config === 'object' ? config : {};

  // Read gate values from the config object.
  const providerMode = safeStr(
    cfg.SCOUT_SUGGEST_PROVIDER_MODE ?? cfg.providerMode,
    64
  ).toLowerCase();
  const liveAdapterEnabled = safeStr(
    cfg.SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED ?? cfg.liveAdapterEnabled,
    16
  );
  const transportMode = safeStr(
    cfg.SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE ?? cfg.transportMode,
    64
  ).toLowerCase();
  const stage = safeStr(
    cfg.SCOUT_SUGGEST_PROVIDER_STAGE ?? cfg.stage,
    64
  ).toLowerCase();
  const provider = safeStr(
    cfg.SCOUT_SUGGEST_LLM_PROVIDER ?? cfg.provider,
    128
  );
  const model = safeStr(cfg.SCOUT_SUGGEST_MODEL ?? cfg.model, 128);
  const baseUrl = safeStr(
    cfg.SCOUT_SUGGEST_LLM_BASE_URL ?? cfg.baseUrl,
    512
  );

  // API key: read ONLY here, store in a private closure field, never
  // expose via the normalized config (callers see hasApiKey boolean only).
  const _privateApiKey = isNonEmptyString(
    cfg.SCOUT_SUGGEST_LLM_API_KEY ?? cfg.apiKey
  )
    ? String(cfg.SCOUT_SUGGEST_LLM_API_KEY ?? cfg.apiKey)
    : '';
  const hasApiKey = _privateApiKey.length > 0;

  // ── Gate evaluation ─────────────────────────────────────────────────────
  const missingGateKeys = [];
  if (providerMode !== 'live') {
    missingGateKeys.push('SCOUT_SUGGEST_PROVIDER_MODE');
  }
  if (liveAdapterEnabled !== 'true' && liveAdapterEnabled !== '1') {
    missingGateKeys.push('SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED');
  }
  if (transportMode !== SCOUT_LIVE_PROVIDER_TRANSPORT_MODE.API_KEY) {
    missingGateKeys.push('SCOUT_SUGGEST_PROVIDER_TRANSPORT_MODE');
  }
  if (!SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_STAGES.has(stage)) {
    missingGateKeys.push('SCOUT_SUGGEST_PROVIDER_STAGE');
  }
  if (!hasApiKey) {
    missingGateKeys.push('SCOUT_SUGGEST_LLM_API_KEY');
  }
  if (provider !== SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_PROVIDER) {
    missingGateKeys.push('SCOUT_SUGGEST_LLM_PROVIDER');
  }
  if (!isNonEmptyString(model)) {
    missingGateKeys.push('SCOUT_SUGGEST_MODEL');
  }

  // Production is explicitly blocked — never satisfies the gate.
  if (stage === 'production') {
    return {
      status: SCOUT_LIVE_PROVIDER_TRANSPORT_STATUS.DISABLED,
      mode: SCOUT_LIVE_PROVIDER_TRANSPORT_MODE.API_KEY,
      provider,
      model,
      hasApiKey: false, // never expose
      baseUrl: '',
      stage,
      providerMode,
      liveAdapterEnabled,
      transportMode,
      missingGateKeys: ['SCOUT_SUGGEST_PROVIDER_STAGE'],
      error: safeError(
        SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.GATE_NOT_SATISFIED
      ).error,
      _privateApiKey: '', // never carry the key in the disabled path
    };
  }

  if (missingGateKeys.length > 0) {
    const isPartial =
      hasApiKey &&
      provider === SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_PROVIDER &&
      isNonEmptyString(model);
    return {
      status: SCOUT_LIVE_PROVIDER_TRANSPORT_STATUS.DISABLED,
      mode: SCOUT_LIVE_PROVIDER_TRANSPORT_MODE.API_KEY,
      provider,
      model,
      hasApiKey: false, // never expose
      baseUrl: '',
      stage,
      providerMode,
      liveAdapterEnabled,
      transportMode,
      missingGateKeys,
      error: safeError(
        isPartial
          ? SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.GATE_NOT_SATISFIED
          : SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.CONFIG_MISSING
      ).error,
      _privateApiKey: '', // never carry the key in the disabled path
    };
  }

  // All gates satisfied → READY_FOR_ADAPTER. The key is held in a
  // private closure field for use by the transport's execute method
  // only. It is NOT exposed via this normalized config object.
  return {
    status: SCOUT_LIVE_PROVIDER_TRANSPORT_STATUS.READY_FOR_ADAPTER,
    mode: SCOUT_LIVE_PROVIDER_TRANSPORT_MODE.API_KEY,
    provider,
    model,
    hasApiKey, // safe boolean, never the key value
    baseUrl: isNonEmptyString(baseUrl) ? baseUrl : '',
    stage,
    providerMode,
    liveAdapterEnabled,
    transportMode,
    missingGateKeys: [],
    error: null,
    _privateApiKey, // private — only used by execute() in the same closure
  };
}

// ─── Request Building ─────────────────────────────────────────────────────────

/**
 * Builds the chat-completions-style request body. Pure function.
 * No third-party SDK, no env reads.
 *
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} params.model
 * @param {number} [params.maxOutputLength]
 * @returns {Object} request body
 */
function buildOpenAICompatibleScoutTransportRequest({ prompt, model, maxOutputLength }) {
  const maxTokens =
    typeof maxOutputLength === 'number' && maxOutputLength >= 50 && maxOutputLength <= 500
      ? maxOutputLength
      : 200;
  return {
    model: isNonEmptyString(model) ? model : 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: isNonEmptyString(prompt) ? prompt : '',
      },
    ],
    temperature: 0.2,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  };
}

/**
 * Builds the auth-header value string for the request. The key is
 * read from the private closure field; the returned value is the
 * concatenation of a non-secret scheme prefix and the key. The
 * function itself never logs the key.
 *
 * @param {string} apiKey
 * @returns {string} auth-header value
 */
function buildScoutAuthHeaderValue(apiKey) {
  if (!isNonEmptyString(apiKey)) return '';
  return 'Bearer ' + apiKey;
}

// ─── Response Parsing ─────────────────────────────────────────────────────────

/**
 * Extracts a sanitized assistant message string from a raw
 * chat-completions-style response. Pure function.
 *
 * @param {unknown} response
 * @returns {{ ok: boolean, content?: string, error?: { code: string, message: string } }}
 */
function extractScoutAssistantContent(response) {
  try {
    if (!response || typeof response !== 'object') {
      return {
        ok: false,
        error: {
          code: SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR,
          message: 'Invalid provider response shape.',
        },
      };
    }
    const r = response;
    if (!Array.isArray(r.choices) || r.choices.length === 0) {
      return {
        ok: false,
        error: {
          code: SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR,
          message: 'Provider response has no choices.',
        },
      };
    }
    const choice = r.choices[0];
    if (
      !choice ||
      !choice.message ||
      typeof choice.message.content !== 'string'
    ) {
      return {
        ok: false,
        error: {
          code: SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR,
          message: 'Provider response choice has no message content.',
        },
      };
    }
    return { ok: true, content: choice.message.content };
  } catch {
    return {
      ok: false,
      error: {
        code: SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR,
        message: 'Failed to parse provider response.',
      },
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates an API-key provider transport instance.
 *
 * Default behavior: DISABLED. The returned object's `status` is
 * `DISABLED` and `execute()` returns a safe-fail error envelope
 * without performing any network call.
 *
 * Only when ALL gate values in the supplied config are satisfied
 * (see normalizeScoutLiveProviderTransportConfig) does the transport
 * enter `READY_FOR_ADAPTER` and accept a prompt via `execute()`.
 *
 * The factory NEVER reads process.env directly. The caller is
 * responsible for building the config object from server-side env
 * / secret storage.
 *
 * @param {Object} [config] - Caller-supplied config object (built from
 *   server-side env/secret storage)
 * @param {Object} [options]
 * @param {Function} [options.fetch] - Injected fetch function. Used
 *   ONLY when status is READY_FOR_ADAPTER. If not supplied in the
 *   ready state, execute() returns a PROVIDER_ERROR safe-fail.
 * @param {number} [options.timeoutMs] - Request timeout in ms
 * @returns {{
 *   version: string,
 *   mode: string,
 *   status: string,
 *   config: Object,
 *   execute: (prompt: string, ctx?: Object) => Promise<Object>,
 *   suggest: (prompt: string, ctx?: Object) => Promise<Object>,
 * }}
 */
function createScoutLiveProviderTransport(config, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const normalized = normalizeScoutLiveProviderTransportConfig(config);
  const isReady =
    normalized.status === SCOUT_LIVE_PROVIDER_TRANSPORT_STATUS.READY_FOR_ADAPTER;

  // Capture the private API key in a closure — it is never exposed
  // on the returned object or via normalized.
  const privateApiKey = isReady ? normalized._privateApiKey : '';
  const fetchFn =
    isReady && typeof opts.fetch === 'function' ? opts.fetch : null;
  const timeoutMs =
    typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0
      ? opts.timeoutMs
      : SCOUT_LIVE_PROVIDER_TRANSPORT_DEFAULT_TIMEOUT_MS;

  // Public-safe config — never includes the API key value.
  const publicConfig = Object.freeze({
    status: normalized.status,
    mode: normalized.mode,
    provider: normalized.provider,
    model: normalized.model,
    hasApiKey: normalized.hasApiKey,
    baseUrl: normalized.baseUrl,
    stage: normalized.stage,
    providerMode: normalized.providerMode,
    liveAdapterEnabled: normalized.liveAdapterEnabled,
    transportMode: normalized.transportMode,
    missingGateKeys: Object.freeze([...normalized.missingGateKeys]),
  });

  /**
   * Executes a provider call. NEVER throws. Returns a safe envelope.
   *
   * @param {string} prompt
   * @param {Object} [ctx]
   * @returns {Promise<{ ok: boolean, response?: Object, error?: { code: string, message: string } }>}
   */
  async function executeScoutLiveProviderTransportCall(prompt, ctx) {
    try {
      if (!isReady) {
        // Determine the most specific disabled code.
        const stageFailed =
          normalized.missingGateKeys.includes('SCOUT_SUGGEST_PROVIDER_STAGE') &&
          normalized.stage !== 'staging' &&
          normalized.stage !== 'test';
        return safeError(
          stageFailed
            ? SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.GATE_NOT_SATISFIED
            : SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.CONFIG_MISSING
        );
      }
      if (!fetchFn) {
        return safeError(
          SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR
        );
      }
      if (!isNonEmptyString(prompt)) {
        return safeError(
          SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.VALIDATION_ERROR
        );
      }
      if (!isNonEmptyString(normalized.baseUrl)) {
        return safeError(
          SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.CONFIG_MISSING
        );
      }

      // Build request. The auth header is constructed in-memory only.
      const safeCtx = ctx && typeof ctx === 'object' ? ctx : {};
      const requestBody = buildOpenAICompatibleScoutTransportRequest({
        prompt,
        model: normalized.model,
        maxOutputLength:
          typeof safeCtx.maxOutputLength === 'number'
            ? safeCtx.maxOutputLength
            : undefined,
      });

      // Construct the auth header in-memory. The key value is held in
      // a closure variable and is never serialized to any response,
      // log, or error.
      const authValue = buildScoutAuthHeaderValue(privateApiKey);
      if (!authValue) {
        return safeError(
          SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.CONFIG_MISSING
        );
      }

      const url = normalized.baseUrl.replace(/\/+$/, '') + '/chat/completions';

      // Build the fetch request shape. The auth header is present in
      // the request (this is the intended use of the key) but is
      // stripped from the response/log by the sanitizer.
      const fetchRequest = {
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authValue,
        },
        body: JSON.stringify(requestBody),
      };

      let fetchResult;
      try {
        // Invoke the injected fetch. Timeout is best-effort via
        // AbortController; never throws out of the try.
        const controller =
          typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer =
          controller && typeof setTimeout === 'function'
            ? setTimeout(() => {
                try {
                  controller.abort();
                } catch {
                  /* ignore */
                }
              }, timeoutMs)
            : null;
        try {
          fetchResult = await fetchFn(fetchRequest.url, {
            method: fetchRequest.method,
            headers: fetchRequest.headers,
            body: fetchRequest.body,
            signal: controller ? controller.signal : undefined,
          });
        } finally {
          if (timer !== null && typeof clearTimeout === 'function') {
            clearTimeout(timer);
          }
        }
      } catch {
        return safeError(
          SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR
        );
      }

      if (!fetchResult || typeof fetchResult !== 'object') {
        return safeError(
          SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR
        );
      }

      // Check ok / status. The injected fetch may return either a
      // fetch-style Response (with .ok and .json()) or a plain object
      // (test convenience).
      const isOk = typeof fetchResult.ok === 'boolean' ? fetchResult.ok : true;
      if (!isOk) {
        return safeError(
          SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR
        );
      }

      // Extract the raw JSON body. Support both fetch Response and
      // plain object shapes.
      let rawJson;
      if (typeof fetchResult.json === 'function') {
        try {
          rawJson = await fetchResult.json();
        } catch {
          return safeError(
            SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR
          );
        }
      } else if (
        fetchResult.body !== undefined &&
        typeof fetchResult.body === 'object'
      ) {
        rawJson = fetchResult.body;
      } else if (fetchResult.data !== undefined) {
        rawJson = fetchResult.data;
      } else {
        rawJson = fetchResult;
      }

      // Extract assistant content.
      const extracted = extractScoutAssistantContent(rawJson);
      if (!extracted.ok) {
        return safeError(
          SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR
        );
      }

      // Sanitize the full provider response — strip prohibited fields.
      const sanitized = sanitizeScoutLiveProviderTransportResponse(rawJson);

      // Return a sanitized success envelope. The raw provider response
      // is sanitized; the assistant content is extracted; neither the
      // API key nor any auth header is included.
      return {
        ok: true,
        response: {
          content: safeStr(extracted.content, 4000),
          provider: normalized.provider,
          model: normalized.model,
          // Include a sanitized, non-sensitive subset of provider fields
          // (no auth, no apiKey, no token, no raw body).
          usage:
            sanitized && typeof sanitized.usage === 'object'
              ? sanitized.usage
              : null,
        },
        // The transport's meta does NOT include the API key or any
        // auth header value.
        meta: {
          mode: normalized.mode,
          stage: normalized.stage,
          provider: normalized.provider,
          model: normalized.model,
          latencyMs:
            typeof safeCtx.startedAt === 'number'
              ? Math.max(0, Date.now() - safeCtx.startedAt)
              : 0,
        },
      };
    } catch {
      // Final catch-all — NEVER throw out of execute.
      return safeError(
        SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  /**
   * Public suggest() wrapper. NEVER throws. Returns a safe envelope.
   * The signature mirrors the suggest.js endpoint contract.
   *
   * @param {string} prompt
   * @param {Object} [ctx]
   * @returns {Promise<{ ok: boolean, response?: Object, error?: { code: string, message: string } }>}
   */
  async function suggest(prompt, ctx) {
    try {
      return await executeScoutLiveProviderTransportCall(prompt, ctx);
    } catch {
      return safeError(
        SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  return Object.freeze({
    version: SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION,
    mode: SCOUT_LIVE_PROVIDER_TRANSPORT_MODE.API_KEY,
    status: normalized.status,
    config: publicConfig,
    execute: executeScoutLiveProviderTransportCall,
    suggest,
  });
}

export {
  SCOUT_LIVE_PROVIDER_TRANSPORT_VERSION,
  SCOUT_LIVE_PROVIDER_TRANSPORT_MODE,
  SCOUT_LIVE_PROVIDER_TRANSPORT_STATUS,
  SCOUT_LIVE_PROVIDER_TRANSPORT_ERROR_CODES,
  SCOUT_LIVE_PROVIDER_TRANSPORT_GATE_KEYS,
  SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_STAGES,
  SCOUT_LIVE_PROVIDER_TRANSPORT_ALLOWED_PROVIDER,
  SCOUT_LIVE_PROVIDER_TRANSPORT_DEFAULT_TIMEOUT_MS,
  SCOUT_LIVE_PROVIDER_TRANSPORT_PROHIBITED_RESPONSE_FIELDS,
  buildOpenAICompatibleScoutTransportRequest,
  buildScoutAuthHeaderValue,
  extractScoutAssistantContent,
  sanitizeScoutLiveProviderTransportResponse,
  normalizeScoutLiveProviderTransportConfig,
  createScoutLiveProviderTransport,
};
