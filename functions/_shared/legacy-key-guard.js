// Legacy localization key write-boundary guard.
//
// Server-side validation: detects legacy localization keys in write payloads
// and rejects them with HTTP 400 so raw i18n keys are never persisted.
//
// Predicates mirror the client-side logic in js/shared/localization-key-utils.js
// but are ESM-exported for Cloudflare Pages Functions consumption.
// #2940

const DOT_KEY_RE = /^[a-z]+(?:\.[a-z0-9_]+)+$/i;
const UNDERSCORE_KEY_RE = /^[a-z]+(?:_[a-z]+){2,}$/;

/**
 * Returns true when the value looks like a legacy localization key
 * (dot-separated like `tree.title` or underscore-separated like
 * `editor_url_only_youtube_title`).
 */
export function isLegacyLocalizationKey(value) {
  if (!value || typeof value !== 'string') return false;
  const raw = value.trim();
  if (!raw) return false;
  return DOT_KEY_RE.test(raw) || UNDERSCORE_KEY_RE.test(raw);
}

/**
 * Validates a write payload against legacy localization keys at the given
 * field paths.  Each path is a dot-separated accessor (e.g. `'title'`,
 * `'memo'`, `'tree.title'`) resolved against the payload object.
 *
 * Returns `null` when all fields are clean, or a 400 Response when any
 * field contains a legacy key.
 */
export function validateWritePayload(payload, fieldPaths) {
  if (!payload || typeof payload !== 'object') return null;
  if (!Array.isArray(fieldPaths) || fieldPaths.length === 0) return null;

  for (const path of fieldPaths) {
    const value = resolvePath(payload, path);
    if (isLegacyLocalizationKey(value)) {
      return new Response(
        JSON.stringify({ error: 'legacy localization key not allowed', field: path, value: value }),
        { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } }
      );
    }
  }
  return null;
}

/**
 * Resolve a dot-separated path against an object.
 * 'title'        → payload.title
 * 'tree.title'   → payload.tree.title
 * Missing segments return undefined (no throw).
 */
function resolvePath(obj, path) {
  const segments = String(path || '').split('.');
  let current = obj;
  for (const seg of segments) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[seg];
  }
  return current;
}
