/**
 * LoveBud Editor — Floating Toolbar DOM Element Helpers
 * Issue #1275 — Extracted from editor-floating-toolbar.js
 *
 * Provides DOM element lookup for the floating toolbar runtime.
 * No behavior change. No event binding. No DOM mutation.
 */

(function () {
  'use strict';

  function byId(id) {
    return document.getElementById(id);
  }

  /**
   * Resolve all floating toolbar DOM elements.
   *
   * @param {Object} ids
   * @returns {Object|null}
   */
  function getElements(ids) {
    if (!ids) return null;

    var toolbar = byId(ids.toolbar);
    if (!toolbar) return null;

    var elements = {
      toolbar: toolbar,
      editBtn: byId(ids.editBtn),
      continueBtn: byId(ids.continueBtn),
      viewBtn: byId(ids.viewBtn),
      moreBtn: byId(ids.moreBtn),
      quickAdd: byId(ids.quickAdd),
      tooltip: byId(ids.tooltip),
      dropdown: byId(ids.dropdown),
      branchBtn: byId(ids.branchBtn),
      forkBtn: byId(ids.forkBtn),
      deleteAction: byId(ids.deleteAction),
      shareAction: byId(ids.shareAction),
      focusAction: byId(ids.focusAction)
    };

    if (!elements.editBtn || !elements.continueBtn || !elements.viewBtn) return null;

    return elements;
  }

  window.LoveBudFloatingToolbarElements = {
    getElements: getElements
  };
})();
