/**
 * Scout Live Provider Executor Skeleton
 * v20260617-1
 *
 * Pure-function / class-like server-side skeleton for executing live LLM suggestions
 * against an OpenAI-compatible endpoint.
 *
 * This module is a contract skeleton — it does not import any LLM SDK (openai, etc.),
 * does not perform direct fetch/network calls itself (delegates entirely to injected transport),
 * and does not log or persist any sensitive credentials.
 */

'use strict';

const SCOUT_LIVE_PROVIDER_EXECUTOR_VERSION = '0.0.1-skeleton';

const SCOUT_LIVE_PROVIDER_EXECUTOR_STATUS = Object.freeze({
  DISABLED: 'disabled',
  CONFIG_MISSING: 'config_missing',
  READY: 'ready',
});

const SCOUT_LIVE_PROVIDER_EXECUTOR_ERROR_CODES = Object.freeze({
  CONFIG_MISSING: 'CONFIG_MISSING',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TRANSPORT_MISSING: 'TRANSPORT_MISSING',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
});

/**
 * Normalizes configuration options for the executor.
 * Strictly avoids persisting, returning, or logging the API key.
 *
 * @param {Object} config - Raw executor config
 * @returns {Object} normalized config with hasApiKey flag
 */
function normalizeScoutLiveProviderExecutorConfig(config) {
  const cfg = config || {};
  const isEnabled = cfg.enabled === true || cfg.SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED === 'true' || cfg.SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED === '1';
  const provider = String(cfg.provider || cfg.SCOUT_SUGGEST_LLM_PROVIDER || '').trim();
  const model = String(cfg.model || cfg.SCOUT_SUGGEST_MODEL || '').trim();
  const apiKeyRaw = cfg.apiKey || cfg.SCOUT_SUGGEST_LLM_API_KEY || '';
  const hasApiKey = typeof apiKeyRaw === 'string' && apiKeyRaw.trim().length > 0;
  const baseUrl = String(cfg.baseUrl || cfg.SCOUT_SUGGEST_LLM_BASE_URL || '').trim();

  return {
    isEnabled,
    provider,
    model,
    hasApiKey,
    baseUrl,
  };
}

/**
 * Builds request payload for OpenAI-compatible Chat Completions API.
 * Contains only safe fields (model, messages, temperature, max_tokens, response_format).
 *
 * @param {Object} params - { prompt, model, maxOutputLength }
 * @returns {Object} request body payload
 */
function buildOpenAICompatibleScoutRequest({ prompt, model, maxOutputLength }) {
  const maxTokens = typeof maxOutputLength === 'number' && maxOutputLength >= 50 && maxOutputLength <= 500
    ? maxOutputLength
    : 200;

  return {
    model: typeof model === 'string' && model.length > 0 ? model : 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: typeof prompt === 'string' ? prompt : '',
      },
    ],
    temperature: 0.2,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  };
}

/**
 * Parses raw response from OpenAI-compatible endpoint.
 * Extracts content string from chat completions choice and parses it as a JSON object.
 *
 * @param {Object} response - Raw JSON response from provider
 * @returns {Object} raw suggestion object
 * @throws {Error} if response structure is malformed or invalid
 */
function parseOpenAICompatibleScoutResponse(response) {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response type: expected object');
  }

  if (!Array.isArray(response.choices) || response.choices.length === 0) {
    throw new Error('Response choice array is missing or empty');
  }

  const choice = response.choices[0];
  if (!choice || !choice.message || typeof choice.message.content !== 'string') {
    throw new Error('Message content in choice is missing or not a string');
  }

  const contentStr = choice.message.content.trim();
  const suggestion = JSON.parse(contentStr);

  if (!suggestion || typeof suggestion !== 'object' || Array.isArray(suggestion)) {
    throw new Error('Completions content did not parse to a JSON object');
  }

  return suggestion;
}

/**
 * Factory for creating a Scout live provider executor instance.
 *
 * @param {Object} config - Config options containing provider, model, apiKey, enabled status.
 * @returns {Object} executor instance
 */
function createScoutLiveProviderExecutor(config) {
  const normalized = normalizeScoutLiveProviderExecutorConfig(config);
  
  // Cache apiKey privately in a local closure so it's not exposed on the return object or logs.
  const privateApiKey = (config && (config.apiKey || config.SCOUT_SUGGEST_LLM_API_KEY)) || '';
  const trimmedKey = typeof privateApiKey === 'string' ? privateApiKey.trim() : '';

  const isConfigured = normalized.isEnabled && normalized.provider && normalized.hasApiKey && normalized.model;

  const status = !normalized.isEnabled
    ? SCOUT_LIVE_PROVIDER_EXECUTOR_STATUS.DISABLED
    : isConfigured
      ? SCOUT_LIVE_PROVIDER_EXECUTOR_STATUS.READY
      : SCOUT_LIVE_PROVIDER_EXECUTOR_STATUS.CONFIG_MISSING;

  return {
    version: SCOUT_LIVE_PROVIDER_EXECUTOR_VERSION,
    status,

    /**
     * Returns the normalized configuration (excluding private credentials).
     */
    getNormalizedConfig() {
      return { ...normalized };
    },

    /**
     * Executes the provider request.
     * Delegates network requests entirely to the injected transport parameter.
     *
     * @param {Object} params - { prompt, maxOutputLength, transport }
     * @returns {Promise<{ ok: boolean, suggestion?: Object, error?: { code: string, message: string } }>}
     */
    async execute({ prompt, maxOutputLength, transport }) {
      if (!isConfigured) {
        return {
          ok: false,
          error: {
            code: SCOUT_LIVE_PROVIDER_EXECUTOR_ERROR_CODES.CONFIG_MISSING,
            message: 'Scout live provider executor is not fully configured or is disabled.',
          },
        };
      }

      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        return {
          ok: false,
          error: {
            code: SCOUT_LIVE_PROVIDER_EXECUTOR_ERROR_CODES.VALIDATION_ERROR,
            message: 'Valid prompt string is required.',
          },
        };
      }

      if (!transport || typeof transport !== 'function') {
        // Absolutely network-free safe-fail if no transport is injected.
        return {
          ok: false,
          error: {
            code: SCOUT_LIVE_PROVIDER_EXECUTOR_ERROR_CODES.TRANSPORT_MISSING,
            message: 'Injected transport client is required for execution.',
          },
        };
      }

      const body = buildOpenAICompatibleScoutRequest({
        prompt,
        model: normalized.model,
        maxOutputLength,
      });

      const headers = {
        'Content-Type': 'application/json',
      };
      if (trimmedKey) {
        headers['Authorization'] = `Bearer ${trimmedKey}`;
      }

      const url = normalized.baseUrl || 'https://api.openai.com/v1/chat/completions';

      try {
        const rawResponse = await transport({
          url,
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        const suggestion = parseOpenAICompatibleScoutResponse(rawResponse);
        return {
          ok: true,
          suggestion,
        };
      } catch (err) {
        // Safe fail-closed taxonomy
        return {
          ok: false,
          error: {
            code: SCOUT_LIVE_PROVIDER_EXECUTOR_ERROR_CODES.PROVIDER_ERROR,
            message: 'Live provider executor failed safely.',
          },
        };
      }
    },
  };
}

export {
  SCOUT_LIVE_PROVIDER_EXECUTOR_VERSION,
  SCOUT_LIVE_PROVIDER_EXECUTOR_STATUS,
  SCOUT_LIVE_PROVIDER_EXECUTOR_ERROR_CODES,
  normalizeScoutLiveProviderExecutorConfig,
  buildOpenAICompatibleScoutRequest,
  parseOpenAICompatibleScoutResponse,
  createScoutLiveProviderExecutor,
};
