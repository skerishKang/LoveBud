/**
 * Scout Provider-Specific Adapter Skeleton
 * v20260607-1
 *
 * Pure-function adapter skeleton for a future provider-specific live LLM suggestion provider.
 *
 * Provides:
 * - normalizeScoutProviderSpecificAdapterConfig: normalizes environment or config object
 * - createScoutProviderSpecificAdapter: returns a safe adapter that does NOT call any provider
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

// ─── Status Constants ─────────────────────────────────────────────────────────

export const SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS = Object.freeze({
  DISABLED: 'disabled',
  CONFIG_MISSING: 'config_missing',
  READY_DISABLED: 'ready_disabled',
});

// ─── Error Codes ──────────────────────────────────────────────────────────────

export const SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES = Object.freeze({
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  CONFIG_MISSING: 'CONFIG_MISSING',
});

// ─── Config Normalization ──────────────────────────────────────────────────────

/**
 * Normalizes environment or config object into a structured provider config.
 * Never returns the API key value — only hasApiKey boolean.
 * Never validates against a real provider.
 * Always returns a safe status: disabled, config_missing, or ready_disabled.
 *
 * @param {Object} [config={}] - Environment-like object or partial config
 * @returns {Object} normalized config { ok, status, provider, model, hasApiKey, baseUrl, timeoutMs, maxRetries, error }
 */
export function normalizeScoutProviderSpecificAdapterConfig(config) {
  const cfg = (config && typeof config === 'object') ? config : {};

  // Extract keys
  const enabled = cfg.enabled === true || cfg.enabled === 'true' || cfg.enabled === '1' ||
                  cfg.SCOUT_PROVIDER_SPECIFIC_ADAPTER_ENABLED === true || cfg.SCOUT_PROVIDER_SPECIFIC_ADAPTER_ENABLED === 'true' || cfg.SCOUT_PROVIDER_SPECIFIC_ADAPTER_ENABLED === '1';

  const provider = String(cfg.provider || cfg.SCOUT_SUGGEST_LLM_PROVIDER || '').trim();
  const model = String(cfg.model || cfg.SCOUT_SUGGEST_MODEL || '').trim();
  const apiKey = cfg.apiKey || cfg.SCOUT_SUGGEST_LLM_API_KEY || '';
  const hasApiKey = Boolean(apiKey) && apiKey.length > 0;
  const baseUrl = String(cfg.baseUrl || cfg.SCOUT_SUGGEST_LLM_BASE_URL || '').trim();

  // Clamping timeoutMs and maxRetries to existing timeout/retry policy limits
  // (matching SCOUT_LIVE_PROVIDER_TIMEOUT_RETRY_POLICY)
  const defaultTimeoutMs = 8000;
  const minTimeoutMs = 50;
  const maxTimeoutMs = 30000;
  const defaultMaxRetries = 0;
  const maxAllowedRetries = 1;

  let rawTimeoutMs = parseInt(cfg.timeoutMs || cfg.SCOUT_SUGGEST_TIMEOUT_MS, 10);
  const timeoutMs = Number.isFinite(rawTimeoutMs)
    ? Math.max(minTimeoutMs, Math.min(maxTimeoutMs, rawTimeoutMs))
    : defaultTimeoutMs;

  let rawMaxRetries = parseInt(cfg.maxRetries || cfg.SCOUT_SUGGEST_MAX_RETRIES, 10);
  const maxRetries = Number.isFinite(rawMaxRetries)
    ? Math.max(0, Math.min(maxAllowedRetries, rawMaxRetries))
    : defaultMaxRetries;

  if (!enabled) {
    return {
      ok: false,
      status: SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.DISABLED,
      provider: provider || '',
      model: model || '',
      baseUrl,
      hasApiKey,
      timeoutMs,
      maxRetries,
      error: {
        code: SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES.PROVIDER_UNAVAILABLE,
        message: 'Scout provider-specific adapter is disabled.',
      },
    };
  }

  if (!provider || !model || !hasApiKey) {
    return {
      ok: false,
      status: SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.CONFIG_MISSING,
      provider: provider || '',
      model: model || '',
      baseUrl,
      hasApiKey,
      timeoutMs,
      maxRetries,
      error: {
        code: SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES.CONFIG_MISSING,
        message: 'Scout provider-specific adapter configuration is missing.',
      },
    };
  }

  return {
    ok: true,
    status: SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.READY_DISABLED,
    provider,
    model,
    baseUrl,
    hasApiKey,
    timeoutMs,
    maxRetries,
    error: null,
  };
}

// ─── Adapter Factory ──────────────────────────────────────────────────────────

/**
 * Creates a Scout provider-specific adapter.
 *
 * CURRENTLY: Returns safe unavailable/disabled errors.
 * No SDK import, no API key, no fetch.
 *
 * @param {Object} [config] - Optional adapter configuration
 * @returns {Object} adapter - { status, config, suggest }
 */
export function createScoutProviderSpecificAdapter(config) {
  const normalized = normalizeScoutProviderSpecificAdapterConfig(config);

  return {
    status: normalized.status,
    config: normalized,

    /**
     * Suggests using the live provider-specific adapter.
     * Always returns PROVIDER_UNAVAILABLE or CONFIG_MISSING error without calling any real provider.
     *
     * @param {Object} input - Suggestion input (ignored in skeleton)
     * @returns {Promise<{ ok: boolean, providerMode: string, error: { code: string, message: string } }>}
     */
    async suggest(input) {
      let errorCode = SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES.PROVIDER_UNAVAILABLE;
      let errorMessage = 'Scout provider-specific adapter is disabled.';

      if (normalized.status === SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.CONFIG_MISSING) {
        errorCode = SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES.CONFIG_MISSING;
        errorMessage = 'Scout provider-specific adapter configuration is missing.';
      } else if (normalized.status === SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.READY_DISABLED) {
        errorCode = SCOUT_PROVIDER_SPECIFIC_ADAPTER_ERROR_CODES.PROVIDER_UNAVAILABLE;
        errorMessage = 'Scout provider-specific adapter is in ready-disabled state.';
      }

      return {
        ok: false,
        providerMode: 'live_provider_disabled',
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    },
  };
}

// ─── Selection Constants ───────────────────────────────────────────────────────

export const SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS = Object.freeze({
  DISABLED: 'DISABLED',
  CONFIG_MISSING: 'CONFIG_MISSING',
  UNSUPPORTED_PROVIDER: 'UNSUPPORTED_PROVIDER',
  SELECTED: 'SELECTED',
});

export const SCOUT_PROVIDER_SPECIFIC_ADAPTER_IDS = Object.freeze({
  NVIDIA: 'nvidia',
  OPENAI_COMPATIBLE: 'openai_compatible',
  GROQ: 'groq',
  MISTRAL: 'mistral',
});

// ─── Provider Normalization ───────────────────────────────────────────────────

function normalizeProviderId(provider) {
  if (typeof provider !== 'string') return null;
  const normalized = provider.toLowerCase().trim();
  if (normalized === 'nvidia') {
    return SCOUT_PROVIDER_SPECIFIC_ADAPTER_IDS.NVIDIA;
  }
  if (normalized === 'openai_compatible' || normalized === 'openai-compatible' || normalized === 'openai compatible') {
    return SCOUT_PROVIDER_SPECIFIC_ADAPTER_IDS.OPENAI_COMPATIBLE;
  }
  if (normalized === 'groq') {
    return SCOUT_PROVIDER_SPECIFIC_ADAPTER_IDS.GROQ;
  }
  if (normalized === 'mistral') {
    return SCOUT_PROVIDER_SPECIFIC_ADAPTER_IDS.MISTRAL;
  }
  return null;
}

// ─── Selection Helper ──────────────────────────────────────────────────────────

/**
 * Selects the appropriate provider-specific adapter skeleton based on configuration.
 *
 * @param {Object} [envOrConfig={}] - Environment variables or config object
 * @returns {Object} { status, providerId, adapter, errorCode, safeForLiveCall }
 */
export function selectScoutProviderSpecificAdapter(envOrConfig = {}) {
  const cfg = (envOrConfig && typeof envOrConfig === 'object') ? envOrConfig : {};

  // Extract enabled flag
  const enabled = cfg.enabled === true || cfg.enabled === 'true' || cfg.enabled === '1' ||
                  cfg.SCOUT_PROVIDER_SPECIFIC_ADAPTER_ENABLED === true || cfg.SCOUT_PROVIDER_SPECIFIC_ADAPTER_ENABLED === 'true' || cfg.SCOUT_PROVIDER_SPECIFIC_ADAPTER_ENABLED === '1';

  const provider = String(cfg.provider || cfg.SCOUT_SUGGEST_LLM_PROVIDER || '').trim();
  const model = String(cfg.model || cfg.SCOUT_SUGGEST_MODEL || '').trim();
  const apiKey = cfg.apiKey || cfg.SCOUT_SUGGEST_LLM_API_KEY || '';
  const hasApiKey = Boolean(apiKey) && apiKey.length > 0;

  if (!enabled) {
    return {
      status: SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.DISABLED,
      providerId: null,
      adapter: null,
      errorCode: 'PROVIDER_UNAVAILABLE',
      safeForLiveCall: false,
    };
  }

  if (!provider || !model || !hasApiKey) {
    return {
      status: SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.CONFIG_MISSING,
      providerId: null,
      adapter: null,
      errorCode: 'CONFIG_MISSING',
      safeForLiveCall: false,
    };
  }

  const providerId = normalizeProviderId(provider);
  if (!providerId) {
    return {
      status: SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.UNSUPPORTED_PROVIDER,
      providerId: null,
      adapter: null,
      errorCode: 'UNSUPPORTED_PROVIDER',
      safeForLiveCall: false,
    };
  }

  const adapter = createScoutProviderSpecificAdapter(cfg);

  return {
    status: SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.SELECTED,
    providerId,
    adapter,
    errorCode: null,
    safeForLiveCall: false,
  };
}
