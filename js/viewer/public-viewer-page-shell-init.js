/**
 * LoveBud Public Viewer — CSP-safe page shell bootstrap
 * Issue #3589
 *
 * Production CSP blocks inline scripts. Mount shared header + apply i18n
 * from this same-origin external file (no inline executable script).
 *
 * Canonical orchestrator: LoveTreePageShell.initSharedPage
 * (same ownership as search/detail page shell inits).
 *
 * Does not own public canvas startup (public-canvas-init.js).
 * Failures must not throw through and block the public tree.
 */
(function initPublicViewerPageShell() {
  'use strict';

  // Idempotent across double script evaluation / re-entry.
  if (window.__lovebudPublicViewerPageShellBooted === true) {
    return;
  }
  window.__lovebudPublicViewerPageShellBooted = true;

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
      // Never block public tree/canvas startup on header bootstrap failure.
      try {
        console.warn('[public-viewer-page-shell] header bootstrap failed', err);
      } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHeaderAndI18n, { once: true });
  } else {
    mountHeaderAndI18n();
  }
})();
