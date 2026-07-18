/**
 * LoveBud Editor — CSP-safe page shell bootstrap
 * Issue #3577
 *
 * Production CSP blocks inline scripts. Mount shared header + apply i18n
 * from this same-origin external file (no inline executable script).
 *
 * Canonical orchestrator: LoveTreePageShell.initSharedPage
 * (same ownership as viewer/search/detail page shell inits).
 *
 * Does not own editor business logic, auth, canvas, or panel startup.
 * Failures must not throw through and block the editor.
 */
(function initEditorPageShell() {
  'use strict';

  // Idempotent across double script evaluation / re-entry.
  if (window.__lovebudEditorPageShellBooted === true) {
    return;
  }
  window.__lovebudEditorPageShellBooted = true;

  function mountHeaderAndI18n() {
    try {
      // Prefer shared page-shell orchestration (header then i18n).
      if (
        window.LoveTreePageShell &&
        typeof window.LoveTreePageShell.initSharedPage === 'function'
      ) {
        window.LoveTreePageShell.initSharedPage({
          renderHeader: true,
          applyI18n: true
        });
        return;
      }

      // Safe fallback if page-shell failed to load.
      if (typeof window.renderSharedHeader === 'function') {
        window.renderSharedHeader();
      }
      if (typeof window.applyI18n === 'function') {
        window.applyI18n();
      }
    } catch (err) {
      // Never block editor startup on header bootstrap failure.
      try {
        console.warn('[editor-page-shell] header bootstrap failed', err);
      } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHeaderAndI18n, { once: true });
  } else {
    mountHeaderAndI18n();
  }
})();
