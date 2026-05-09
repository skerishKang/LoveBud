/**
 * LoveBud - i18n Compatibility Shim
 * v20260419-2
 *
 * Compatibility shim:
 * Actual i18n implementation is loaded explicitly via
 * js/i18n/i18n-*.js script tags in HTML.
 * This file intentionally does not auto-load modules.
 */

(function() {
  'use strict';

  if (!window.getCurrentLang) {
    console.warn('[i18n.js] i18n core is not loaded yet. Make sure i18n-core.js is loaded before dependent scripts.');
  }
})();
