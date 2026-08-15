/**
 * LoveBud — Authenticated public YouTube playlist preview proxy.
 *
 * Same-origin route: POST /api/import/youtube/playlist/preview
 *
 * Cloudflare Pages Function acts ONLY as a thin same-origin proxy:
 *   - edge-safe request validation (content-type, 4KB body bound, exactly-one
 *     of `source` / `playlistId`)
 *   - bounded body handling
 *   - Authorization header forwarding (never verified on the edge)
 *   - forwarding to the fixed Modal private preview endpoint
 *   - bounded proxy failure
 *
 * It does NOT call the YouTube Data API and does NOT hold the provider key.
 * The Modal private endpoint owns verified auth (`require_firebase_user`),
 * the provider call, and error normalization.
 *
 * Refs: #3914, #3906, #3897, #3903, #1882.
 */

const REQUEST_ID_HEADER = 'x-lovebud-request-id';
const MAX_REQUEST_BODY_BYTES = 4096;
const MODAL_PROXY_TIMEOUT_MS = 15000;
const PREVIEW_MODAL_PATH = '/modal/private/import/youtube/playlist/preview';

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function generateRequestId() {
  return 'req-' + crypto.randomUUID();
}

function getOrCreateRequestId(request) {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  if (existing && /^[A-Za-z0-9._:-]+$/.test(existing) && existing.length <= 80) {
    return existing;
  }
  return generateRequestId();
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

function buildEnvelopeResponse(body, status, requestId, routeStatus) {
  const headers = {
    'x-lovebud-upstream': 'cloudflare',
    [REQUEST_ID_HEADER]: requestId,
  };
  if (routeStatus) headers['x-lovebud-route-status'] = routeStatus;
  return jsonResponse(body, status, headers);
}

function parseContentLength(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  if (!/^[0-9]+$/.test(raw.trim())) return null;
  const parsed = Number(raw.trim());
  if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
  return parsed;
}

async function cancelReaderBestEffort(reader) {
  try {
    if (reader && typeof reader.cancel === 'function') {
      await reader.cancel();
    }
  } catch (e) {
    // best effort — cancellation failure must never mask the real outcome
  }
  try {
    if (reader && typeof reader.releaseLock === 'function') {
      reader.releaseLock();
    }
  } catch (e) {
    // best effort
  }
}

/**
 * readBoundedBody — true 4KB streamed byte bound (per #3914 / #3920).
 *
 * The actual authority is `request.body.getReader()`: chunks are accumulated
 * and the moment the cumulative UTF-8 BYTE length exceeds 4096 the reader is
 * cancelled (best effort) and no more of the body is materialized. UTF-8 byte
 * count is the authority, never the character count and never a pre-read
 * `request.text()` / `request.json()`.
 *
 * Content-Length is ONLY an early-rejection optimization: a valid positive
 * integer > 4096 may short-circuit to 413 without reading, but a missing,
 * invalid, or understated Content-Length is never trusted — the streamed
 * reader still enforces the true bound.
 *
 * A stream read failure is NOT a payload-size failure: it is reported as a
 * bounded readFailure so the caller can return a fixed 500 without exposing
 * the raw stream exception and without mislabeling it payload-too-large.
 */
async function readBoundedBody(request) {
  const contentLength = parseContentLength(request.headers.get('content-length'));
  if (contentLength !== null && contentLength > MAX_REQUEST_BODY_BYTES) {
    return { tooLarge: true, readFailure: false, body: null };
  }

  const stream = request.body;
  if (!stream || typeof stream.getReader !== 'function') {
    return { tooLarge: false, readFailure: false, body: '' };
  }

  let reader;
  try {
    reader = stream.getReader();
  } catch (e) {
    return { tooLarge: false, readFailure: true, body: null };
  }

  const chunks = [];
  let totalBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || !value.byteLength) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        await cancelReaderBestEffort(reader);
        return { tooLarge: true, readFailure: false, body: null };
      }
      chunks.push(value);
    }
  } catch (e) {
    await cancelReaderBestEffort(reader);
    return { tooLarge: false, readFailure: true, body: null };
  }

  if (chunks.length === 0) {
    return { tooLarge: false, readFailure: false, body: '' };
  }

  const joined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const bodyText = new TextDecoder().decode(joined);
  return { tooLarge: false, readFailure: false, body: bodyText };
}

async function fetchModalWithTimeout(modalUrl, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODAL_PROXY_TIMEOUT_MS);
  try {
    return await fetch(modalUrl, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildSafeUrlLog(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch (e) {
    return 'invalid-url';
  }
}

/**
 * buildPlaylistIdentity — pure edge identity rule (source XOR playlistId).
 * Silent precedence is forbidden: both provided => error. Neither => error.
 * Unknown extra fields are ignored (not rejected).
 */
function buildPlaylistIdentity(body) {
  const hasSource = typeof body?.source === 'string' && body.source.trim().length > 0;
  const hasId = typeof body?.playlistId === 'string' && body.playlistId.trim().length > 0;

  const both = hasSource && hasId;
  const neither = !hasSource && !hasId;

  if (both || neither) {
    return null;
  }

  if (hasId) {
    return { field: 'playlistId', value: body.playlistId.trim() };
  }
  return { field: 'source', value: body.source.trim() };
}

/**
 * POST handler — same-origin proxy.
 *
 * Cloudflare never calls the provider API. It forwards the validated input
 * plus the Authorization header to the Modal preview endpoint and returns
 * Modal's normalized response (or a bounded proxy failure).
 *
 * The Modal endpoint is a fixed configured URL (`env.MODAL_BASE_URL` +
 * `PREVIEW_MODAL_PATH`). No user-supplied URL is ever fetched on the edge.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = getOrCreateRequestId(request);

  if (request.method.toUpperCase() !== 'POST') {
    return buildEnvelopeResponse(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Only POST is supported.' } },
      405,
      requestId,
      'method-not-allowed'
    );
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return buildEnvelopeResponse(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Content-Type must be application/json.' } },
      400,
      requestId,
      'invalid-content-type'
    );
  }

  const bodyResult = await readBoundedBody(request);
  if (bodyResult.tooLarge) {
    return buildEnvelopeResponse(
      { ok: false, error: { code: 'INVALID_PLAYLIST_SOURCE', message: 'Request body too large.' } },
      413,
      requestId,
      'payload-too-large'
    );
  }
  if (bodyResult.readFailure) {
    return buildEnvelopeResponse(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Request body could not be read.' } },
      500,
      requestId,
      'body-read-failure'
    );
  }

  let body;
  try {
    body = bodyResult.body ? JSON.parse(bodyResult.body) : {};
  } catch (e) {
    return buildEnvelopeResponse(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body.' } },
      400,
      requestId,
      'invalid-json'
    );
  }

  const identity = buildPlaylistIdentity(body);
  if (!identity) {
    return buildEnvelopeResponse(
      { ok: false, error: { code: 'INVALID_PLAYLIST_SOURCE', message: 'Provide exactly one of source or playlistId.' } },
      400,
      requestId,
      'invalid-playlist-source'
    );
  }

  const modalBaseUrl = stripTrailingSlash((env || {}).MODAL_BASE_URL);
  if (!modalBaseUrl) {
    return buildEnvelopeResponse(
      { ok: false, error: { code: 'CONFIGURATION_REQUIRED', message: 'Preview backend is not configured.' } },
      503,
      requestId,
      'configuration-required'
    );
  }

  const target = new URL(modalBaseUrl);
  target.pathname = PREVIEW_MODAL_PATH;

  const forwardedBody = JSON.stringify(body);
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    [REQUEST_ID_HEADER]: requestId,
  };
  const authorizationHeader =
    request.headers.get('authorization') || request.headers.get('Authorization');
  if (authorizationHeader) {
    headers.authorization = authorizationHeader;
  }

  const urlLog = buildSafeUrlLog(target.toString());
  console.log(`[LoveBudCloudflareProxy] POST -> ${urlLog} (id=${requestId})`);

  let modalResponse;
  try {
    modalResponse = await fetchModalWithTimeout(target.toString(), {
      method: 'POST',
      headers,
      body: forwardedBody,
    });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      console.warn(`[LoveBudCloudflareProxy] Modal preview timeout (15s): ${urlLog} (id=${requestId})`);
      return buildEnvelopeResponse(
        { ok: false, error: { code: 'PROVIDER_TIMEOUT', message: 'Preview request timed out.' } },
        504,
        requestId,
        'modal-timeout'
      );
    }
    console.warn(`[LoveBudCloudflareProxy] Modal preview unavailable (id=${requestId})`);
    return buildEnvelopeResponse(
      { ok: false, error: { code: 'PROVIDER_UNAVAILABLE', message: 'Preview service is temporarily unavailable.' } },
      503,
      requestId,
      'modal-unavailable'
    );
  }

  // Bounded proxy: re-emit Modal's body as-is (Modal owns the envelope).
  const modalBody = await finalizeModalBody(modalResponse);
  const outHeaders = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-lovebud-upstream': 'modal',
    [REQUEST_ID_HEADER]: requestId,
  };
  return new Response(modalBody, {
    status: modalResponse.status,
    headers: outHeaders,
  });
}

async function finalizeModalBody(response) {
  try {
    return await response.text();
  } catch (e) {
    return '{"ok":false,"error":{"code":"PROVIDER_UNAVAILABLE","message":"Preview service returned an unparseable response."}}';
  }
}

export { buildPlaylistIdentity };
