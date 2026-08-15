/**
 * LoveBud — Client wrapper for the authenticated public YouTube playlist preview.
 *
 * Route: POST /api/import/youtube/playlist/preview (same-origin).
 *
 * Responsibilities (per #3914 / #3906 authority):
 *   - acquire a Firebase ID token via the existing auth pipeline
 *   - call the same-origin route as a bounded JSON request
 *   - fail closed on any non-2xx / non-canonical response
 *   - AbortController timeout
 *
 * The client never knows the provider secret or the Google endpoint.
 *
 * Refs: #3914, #3906, #3897, #3903, #1882.
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/import/youtube/playlist/preview';
  var DEFAULT_TIMEOUT_MS = 15000;
  var MAX_TIMEOUT_MS = 30000;

  function getBaseApiFetch() {
    return (typeof window !== 'undefined' && window.LoveTreeBaseApiFetch) || null;
  }

  function resolveTimeoutMs(options) {
    var raw = options && options.timeoutMs;
    var value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
    return Math.min(value, MAX_TIMEOUT_MS);
  }

  function createBoundedError(code, message, status, data) {
    var error = new Error(message || 'Preview request failed.');
    error.code = code;
    error.status = status;
    error.statusCode = status;
    if (data !== undefined && data !== null) {
      error.data = data;
    }
    return error;
  }

  /**
   * Build the fetch config for the same-origin preview route.
   * Delegates auth + token acquisition to LoveTreeBaseApiFetch and attaches
   * an AbortController timeout. Never injects provider secrets.
   */
  async function buildRequestConfig(body, options) {
    var headers = {
      'Content-Type': 'application/json',
    };

    var baseApiFetch = getBaseApiFetch();
    if (baseApiFetch && typeof baseApiFetch.getAuthHeaders === 'function') {
      try {
        var apiHeaders = await baseApiFetch.getAuthHeaders({ requireAuth: true });
        if (apiHeaders && apiHeaders.Authorization) {
          headers.Authorization = apiHeaders.Authorization;
        }
      } catch (e) {
        var error = new Error('Authentication could not be prepared');
        error.code = 'AUTH_PREPARE_FAILED';
        error.status = 0;
        error.statusCode = 0;
        throw error;
      }
    }

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = null;
    if (controller) {
      timeoutId = setTimeout(function () {
        controller.abort();
      }, resolveTimeoutMs(options));
    }

    var config = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    };
    if (controller) config.signal = controller.signal;

    return { config: config, controller: controller, timeoutId: timeoutId };
  }

  async function parseResponse(response) {
    var text;
    try {
      text = await response.text();
    } catch (e) {
      throw new Error('Preview response could not be read.');
    }
    var data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error('Preview response was not valid JSON.');
    }
    return data;
  }

  /**
   * Request a read-only preview for a public playlist source or bare ID.
   *
   * @param {{source?: string, playlistId?: string}} payload
   * @param {{timeoutMs?: number}} [options]
   * @returns {Promise<object>} normalized preview response
   */
  async function requestPreview(payload, options) {
    var body = {
      source: typeof payload.source === 'string' ? payload.source : undefined,
      playlistId: typeof payload.playlistId === 'string' ? payload.playlistId : undefined,
    };

    var prepared = await buildRequestConfig(body, options);
    var response;
    try {
      response = await fetch(ENDPOINT, prepared.config);
    } catch (e) {
      var aborted = !!(e && e.name === 'AbortError');
      throw createBoundedError(
        aborted ? 'PROVIDER_TIMEOUT' : 'NETWORK_ERROR',
        aborted ? 'Preview request timed out.' : 'Preview request failed.',
        0
      );
    } finally {
      if (prepared.timeoutId) clearTimeout(prepared.timeoutId);
    }

    var parsed;
    try {
      parsed = await parseResponse(response);
    } catch (e) {
      throw createBoundedError(
        'INVALID_PREVIEW_RESPONSE',
        'Preview response could not be read.',
        response.status
      );
    }

    // Fail closed: any non-2xx response is an error, whether or not it carries
    // the bounded envelope.
    if (!response.ok) {
      if (parsed && parsed.ok === false && parsed.error && parsed.error.code) {
        throw createBoundedError(
          parsed.error.code,
          parsed.error.message || 'Preview failed.',
          response.status,
          parsed
        );
      }
      var authStatus = response.status === 401 || response.status === 403;
      throw createBoundedError(
        authStatus ? 'UNAUTHORIZED' : 'PREVIEW_FAILED',
        'Preview request failed.',
        response.status,
        parsed
      );
    }

    // 2xx must still be a canonical envelope: ok === true with an items array.
    if (!parsed || parsed.ok !== true || !Array.isArray(parsed.items)) {
      throw createBoundedError(
        'INVALID_PREVIEW_RESPONSE',
        'Preview response was not in the expected format.',
        response.status,
        parsed
      );
    }
    return parsed;
  }

  function validateSourceIdentity(payload) {
    var hasSource = typeof payload?.source === 'string' && payload.source.trim().length > 0;
    var hasId = typeof payload?.playlistId === 'string' && payload.playlistId.trim().length > 0;
    if (hasSource && hasId) return false;
    if (!hasSource && !hasId) return false;
    return true;
  }

  var api = {
    ENDPOINT: ENDPOINT,
    DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    requestPreview: requestPreview,
    validateSourceIdentity: validateSourceIdentity,
    buildRequestConfig: buildRequestConfig,
    resolveTimeoutMs: resolveTimeoutMs,
    createBoundedError: createBoundedError,
  };

  if (typeof window !== 'undefined') {
    window.LoveTreeYouTubePlaylistPreview = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
