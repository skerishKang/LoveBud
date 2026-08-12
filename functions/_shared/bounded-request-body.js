// True streaming request-body size enforcement for Cloudflare Pages Functions.
//
// #3920 (Memory-side child). This module owns ONLY byte-stream reading.
// It intentionally does NOT own: Authorization, Idempotency-Key, request-ID,
// Modal URL, timeout policy, HTTP response taxonomy, or product JSON
// validation. Route modules map the returned status to HTTP behavior.
//
// The 128 KiB policy here is an edge-side guard. A naive `await request.text()`
// first materializes the entire body (including an oversized one) and only then
// measures it, which is not a bounded read. This primitive instead streams the
// body and aborts the moment the byte boundary is exceeded.

export const MAX_REQUEST_BODY_BYTES = 128 * 1024;

function getContentLengthBytes(request) {
  const raw = request.headers.get('content-length');
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * Early-optimization only.
 *
 * A valid numeric Content-Length strictly greater than the limit lets us reject
 * before reading the stream. A missing, invalid, or understated Content-Length
 * is NEVER trusted: the actual streamed byte count is the final authority.
 */
export function isContentLengthOverLimit(request, maxBytes = MAX_REQUEST_BODY_BYTES) {
  const contentLengthBytes = getContentLengthBytes(request);
  return contentLengthBytes !== null && contentLengthBytes > maxBytes;
}

/**
 * Reads a request body with a hard streaming byte boundary.
 *
 * Return DTO (caller maps status to HTTP taxonomy; only `tooLarge` -> 413):
 *   { status: 'ok',        body: Uint8Array | null }  // under/at limit
 *   { status: 'tooLarge',  body: null }               // stream exceeded limit
 *   { status: 'readError', body: null }               // reader threw/rejected
 *
 * Behavior:
 *  - Exactly `maxBytes` streamed bytes are accepted; `maxBytes + 1` is rejected.
 *  - On overflow we best-effort `reader.cancel()`; cancel failure never leaks.
 *  - If the reader itself throws/rejects we return `readError`, never `tooLarge`.
 *  - Accepted bytes are concatenated byte-exact (no UTF-8 decode) before return,
 *    so the upstream payload is byte-identical to the received bytes.
 */
export async function readBoundedRequestBody(request, maxBytes = MAX_REQUEST_BODY_BYTES) {
  if (isContentLengthOverLimit(request, maxBytes)) {
    return { status: 'tooLarge', body: null };
  }

  const stream = request.body;
  if (!stream) {
    return { status: 'ok', body: null };
  }

  let reader;
  try {
    reader = stream.getReader();
  } catch (e) {
    return { status: 'readError', body: null };
  }

  const chunks = [];
  let totalBytes = 0;
  let overflowed = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      if (totalBytes + value.byteLength > maxBytes) {
        overflowed = true;
        break;
      }
      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } catch (e) {
    // The stream reader itself failed. Report readError, never tooLarge, and
    // never leak the raw exception.
    try { await reader.cancel(); } catch (_) {}
    return { status: 'readError', body: null };
  }

  if (overflowed) {
    try { await reader.cancel(); } catch (_) {}
    return { status: 'tooLarge', body: null };
  }

  if (totalBytes === 0) {
    return { status: 'ok', body: null };
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { status: 'ok', body: merged };
}
