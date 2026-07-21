/**
 * LoveBud Settings page bootstrap.
 * CSP-safe external entrypoint for shared header and Settings initialization.
 *
 * Refs #3615
 */
(function () {
  'use strict';

  if (window.__lovebudSettingsBootstrapStarted) {
    return;
  }

  if (typeof window.renderSharedHeader !== 'function') {
    throw new Error('Settings bootstrap requires renderSharedHeader');
  }

  if (typeof window.initSettings !== 'function') {
    throw new Error('Settings bootstrap requires initSettings');
  }

  window.__lovebudSettingsBootstrapStarted = true;
  window.renderSharedHeader();
  window.initSettings();
})();
