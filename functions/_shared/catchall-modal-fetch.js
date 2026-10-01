/**
 * Catch-all Modal fetch primitives (Issue #4535, Slice 2).
 *
 * Owns the three transport primitives that functions/api/[[path]].js used to
 * carry inline, and nothing else:
 *   - MODAL_FETCH_TIMEOUT_MS: the single default upstream timeout budget;
 *   - getSafeUrlLog: the log-safe projection of an upstream URL (origin and
 *     path only, so query, fragment and credentials never reach logs);
 *   - fetchWithTimeout: the AbortController-based fetch timeout primitive.
 *
 * The gateway keeps orchestration and everything that defines an HTTP answer:
 * auth checks, bounded body reads and size-limit responses, request-id
 * handling, upstream/cache headers, the 404 fallback, the no-store behaviour
 * for anonymous Tree detail, and above all buildModalTimeoutResponse — the
 * 504 response taxonomy. Fetch timeout mechanics are not response policy:
 * this helper only rejects with AbortError, and tryModalRead / tryModalWrite
 * still translate that into the modal-timeout 504.
 *
 * This module performs no routing, no auth, no body read and no Response
 * construction. Cloudflare Functions ESM. Refs #4535.
 */

export const MODAL_FETCH_TIMEOUT_MS = 25000;

export function getSafeUrlLog(url) {
  if (!url) return 'null';
  try {
    const u = new URL(url.toString());
    return `${u.origin}${u.pathname}`;
  } catch (e) {
    return 'invalid-url';
  }
}

export async function fetchWithTimeout(url, options = {}) {
  const { timeout = MODAL_FETCH_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}