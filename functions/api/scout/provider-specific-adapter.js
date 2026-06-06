/**
 * Scout Provider-Specific Adapter Skeleton
 * v20260607-2
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

// ─── Selection Boundary Constants ──────────────────────────────────────────────

/**
 * Selection boundary status values.
 *
 * The selection helper ALWAYS returns one of these statuses:
 *   - CONFIG_MISSING: required fields (provider / model / API key presence) are absent
 *   - UNKNOWN_PROVIDER: provider name is not registered in the inert registry
 *   - SELECTED_DISABLED: provider was selected, but the returned adapter is still
 *                       in a disabled state. suggest() always safe-fails.
 */
export const SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS = Object.freeze({
  CONFIG_MISSING: 'config_missing',
  UNKNOWN_PROVIDER: 'unknown_provider',
  SELECTED_DISABLED: 'selected_disabled',
});

export const SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_ERROR_CODES = Object.freeze({
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  CONFIG_MISSING: 'CONFIG_MISSING',
});

// ─── Inert Provider Registry ──────────────────────────────────────────────────

const SCOUT_PROVIDER_SPECIFIC_ADAPTER_EXAMPLE_NAME = 'example_provider';

/**
 * Returns the inert provider-specific adapter registry.
 *
 * The registry is a frozen object that maps provider name strings to factory
 * functions. Each factory returns a provider-specific adapter instance via
 * `createScoutProviderSpecificAdapter`. The factories are inert: no SDK
 * import, no fetch, no API key value propagation.
 *
 * Invariants:
 *   - Pure function, returns a frozen object
 *   - Does NOT contain real provider names (openai/anthropic/gemini/groq/mistral/nvidia/...)
 *   - Does NOT perform any I/O
 *   - Does NOT import any provider SDK
 *
 * @returns {Object} frozen registry mapping provider names to factory functions
 */
export function getScoutProviderSpecificAdapterRegistry() {
  return Object.freeze({
    [SCOUT_PROVIDER_SPECIFIC_ADAPTER_EXAMPLE_NAME]: createScoutProviderSpecificAdapter,
  });
}

// ─── Selection Helper ──────────────────────────────────────────────────────────

/**
 * Selects a provider-specific adapter based on configuration.
 *
 * Policy:
 *   - Reuses `normalizeScoutProviderSpecificAdapterConfig` for config validation.
 *   - If the normalized config status is `CONFIG_MISSING`, the selection returns
 *     the same status with `adapter: null` and a safe error code.
 *   - If a provider name is given but is NOT in the inert registry, returns
 *     `UNKNOWN_PROVIDER` with `adapter: null` and `PROVIDER_UNAVAILABLE`.
 *   - If a provider name is given AND is in the registry, the registry's
 *     factory is invoked with the original config to produce an adapter. The
 *     adapter is always returned in a disabled state (no real provider call).
 *     The selection status is `SELECTED_DISABLED`.
 *
 * The selection result NEVER contains:
 *   - The raw API key value
 *   - Any fetched URL response
 *   - Any executor invocation result
 *   - Any side-effect (no fetch, no localStorage, no DB write)
 *
 * @param {Object} [config] - raw config (same shape as `normalizeScoutProviderSpecificAdapterConfig` accepts)
 * @returns {Object} { ok, status, provider, adapter, error }
 */
export function selectScoutProviderSpecificAdapter(config) {
  const normalized = normalizeScoutProviderSpecificAdapterConfig(config || {});

  const baseShape = {
    ok: false,
    provider: normalized.provider || '',
    adapter: null,
  };

  if (normalized.status === SCOUT_PROVIDER_SPECIFIC_ADAPTER_STATUS.CONFIG_MISSING) {
    return {
      ...baseShape,
      status: SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.CONFIG_MISSING,
      error: {
        code: SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_ERROR_CODES.CONFIG_MISSING,
        message: normalized.error && normalized.error.message
          ? normalized.error.message
          : 'Scout provider-specific adapter configuration is missing.',
      },
    };
  }

  if (!normalized.provider) {
    return {
      ...baseShape,
      provider: '',
      status: SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.CONFIG_MISSING,
      error: {
        code: SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_ERROR_CODES.CONFIG_MISSING,
        message: 'Scout provider-specific adapter is missing provider name.',
      },
    };
  }

  const registry = getScoutProviderSpecificAdapterRegistry();
  const factory = registry[normalized.provider];
  if (typeof factory !== 'function') {
    return {
      ...baseShape,
      provider: normalized.provider,
      status: SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.UNKNOWN_PROVIDER,
      error: {
        code: SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_ERROR_CODES.PROVIDER_UNAVAILABLE,
        message: 'Scout provider-specific adapter is not registered for this provider.',
      },
    };
  }

  const adapter = factory(config || {});

  return {
    ok: true,
    status: SCOUT_PROVIDER_SPECIFIC_ADAPTER_SELECTION_STATUS.SELECTED_DISABLED,
    provider: normalized.provider,
    adapter,
    error: null,
  };
}
