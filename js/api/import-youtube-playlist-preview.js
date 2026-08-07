/**
 * LoveBud — Client wrapper for the authenticated public YouTube playlist preview.
 *
 * Route: POST /api/import/youtube/playlist/preview (same-origin).
 *
 * Responsibilities (per #3914 / #3906 authority):
 *   - acquire a Firebase ID token via the existing auth pipeline
 *   - call the same-origin route as a bounded JSON request
 *   - normalize success / bounded errors
 *   - AbortController timeout
 *
 * The client never knows the provider secret or the Google endpoint.
 *
 * Refs: #3914, #3906, #3897, #3903, #1882.
 */
(function () {
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
      var fetchError = new Error(
        e && e.name === 'AbortError'
          ? 'Preview request timed out.'
          : 'Preview request failed.'
      );
      fetchError.code = e && e.name === 'AbortError' ? 'PROVIDER_TIMEOUT' : 'NETWORK_ERROR';
      fetchError.status = 0;
      throw fetchError;
    } finally {
      if (prepared.timeoutId) clearTimeout(prepared.timeoutId);
    }

    var parsed = await parseResponse(response);
    if (parsed && parsed.ok === false && parsed.error && parsed.error.code) {
      var envelopeError = new Error(parsed.error.message || 'Preview failed.');
      envelopeError.code = parsed.error.code;
      envelopeError.status = response.status;
      envelopeError.data = parsed;
      throw envelopeError;
    }
    return parsed;
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
  };

  if (typeof window !== 'undefined') {
    window.LoveTreeYouTubePlaylistPreview = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();