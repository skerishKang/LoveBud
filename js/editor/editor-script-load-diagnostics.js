/**
 * LoveBud Editor — CSP-safe script-load diagnostics
 * Issue #3883
 *
 * Production CSP (script-src 'self' https://www.gstatic.com https://apis.google.com)
 * blocks inline scripts. The previous diagnostic error listener lived in an
 * inline <script> in pages/editor.html, producing a reproducible CSP console
 * violation on every Editor load. This same-origin external file preserves the
 * listener's semantics and execution timing.
 *
 * Semantics preserved:
 *   - capture-phase window "error" listener
 *   - SCRIPT-tagged load failures only
 *   - console.error("Script load failed:", src)
 *   - window.LoveBudEditorDebug = { logs: [], errors: [] } init
 *   - errors.push({ msg: "Script load failed", src })
 *
 * Bounded and non-leaking:
 *   - recorded src is the URL pathname only (query/hash stripped), so dynamic
 *     query values can never reach diagnostics or console.
 *   - only pathname-level detail is emitted; secrets and private identifiers
 *     are never read, stored, or printed.
 *   - never throws; a diagnostic failure cannot block Editor startup.
 */
(function initEditorScriptLoadDiagnostics() {
  'use strict';

  function boundedScriptSrc(raw) {
    if (typeof raw !== 'string' || raw === '') return '';
    try {
      // Bounded safe representation: pathname only. Strips any query/hash so
      // dynamic or private URL parts never persist in diagnostics.
      var base = (window.location && window.location.href) || 'https://lovebud.pages.dev/';
      return new URL(raw, base).pathname;
    } catch (err) {
      // Non-URL fallback: bounded prefix, never echoes error details.
      return raw.slice(0, 200);
    }
  }

  function recordScriptLoadFailure(target) {
    var src = boundedScriptSrc(target && target.src);
    try {
      console.error('Script load failed:', src);
    } catch (ignore) {
      // Console unavailable must never throw through.
    }
    window.LoveBudEditorDebug = window.LoveBudEditorDebug || {
      logs: [],
      errors: []
    };
    window.LoveBudEditorDebug.errors.push({
      msg: 'Script load failed',
      src: src
    });
  }

  window.addEventListener(
    'error',
    function (e) {
      if (e && e.target && e.target.tagName === 'SCRIPT') {
        recordScriptLoadFailure(e.target);
      }
    },
    true
  );
})();
