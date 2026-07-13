/**
 * LoveBud Editor — Floating Toolbar Quick-Add / Adaptive Affordance
 * Issue #1275 — Extracted from editor-floating-toolbar.js
 *
 * Manages quick-add affordance visibility and adaptive toolbar state
 * (normal vs connection mode) for the floating toolbar.
 *
 * No behavior change.
 */
(function () {
  'use strict';

  var IS_VISIBLE_CLASS = 'is-visible';
  var IS_HIDDEN_CLASS = 'is-hidden';
  var IS_CONNECTING_CLASS = 'is-connecting';
  var AFFORDANCE_SELECTOR = '.memory-add-affordance';

  /**
   * Check if connection mode is active (user is in a "continue" or "branch" flow).
   * Detected by presence of growth affordance elements on the canvas.
   */
  function isConnectionMode(ctx) {
    var canvas = document.getElementById('canvasArea');
    if (!canvas) return false;
    // Connection mode is active when the growth affordance tip or branch lines exist
    var affordance = canvas.querySelector(AFFORDANCE_SELECTOR);
    return !!affordance;
  }

  /**
   * Show the quick-add affordance near the selected node.
   */
  function showQuickAdd(ctx) {
    if (!ctx || !ctx.quickAdd) return;
    if (ctx.quickAdd.classList.contains(IS_VISIBLE_CLASS)) return;
    if (isConnectionMode(ctx)) return; // Don't show during connection mode

    ctx.quickAdd.classList.remove(IS_HIDDEN_CLASS);
    ctx.quickAdd.style.display = '';
    void ctx.quickAdd.offsetWidth;
    ctx.quickAdd.classList.add(IS_VISIBLE_CLASS);
    if (window.LoveBudFloatingToolbarPositioning && window.LoveBudFloatingToolbarPositioning.positionQuickAdd) {
      window.LoveBudFloatingToolbarPositioning.positionQuickAdd(ctx);
    }
  }

  /**
   * Hide the quick-add affordance.
   */
  function hideQuickAdd(ctx) {
    if (!ctx || !ctx.quickAdd) return;
    if (!ctx.quickAdd.classList.contains(IS_VISIBLE_CLASS)) return;
    ctx.quickAdd.classList.remove(IS_VISIBLE_CLASS);
    ctx.quickAdd.classList.add(IS_HIDDEN_CLASS);
    ctx.quickAdd.style.display = 'none';
  }

  /**
   * Update the toolbar's adaptive state based on current mode.
   * Switches between normal mode (edit/continue/view) and connection mode (branch/fork).
   */
  function updateAdaptiveState(ctx) {
    if (!ctx || !ctx.toolbar) return;
    ctx.toolbar.classList.remove(IS_CONNECTING_CLASS);
    hideQuickAdd(ctx);
  }

  /**
   * Wire up the quick-add affordance click handler.
   * Quick-add triggers continue from the selected moment.
   */
  function bindQuickAdd(ctx) {
    if (!ctx || !ctx.quickAdd) return;
    ctx.quickAdd.addEventListener('click', function (e) {
      e.stopPropagation();
      if (window.LoveBudFloatingToolbarDropdown) window.LoveBudFloatingToolbarDropdown.hide(ctx.dropdown, ctx.moreBtn);
      // Quick-add triggers continue from the selected moment
      var continueBtnDetail = document.getElementById('continueFromMomentBtn');
      if (continueBtnDetail) {
        continueBtnDetail.click();
        return;
      }
      var addMemoryBtn = document.getElementById('addMemoryBtn');
      if (addMemoryBtn) {
        addMemoryBtn.click();
      }
    });
  }

  /**
   * True only when the connect-existing CTA is present and actually activatable.
   * Missing / disabled / hidden / aria-hidden controls fail closed (no-op).
   */
  function canActivateConnectButton(button) {
    if (!button) return false;
    if (button.disabled) return false;
    if (button.hidden) return false;
    if (button.getAttribute && button.getAttribute('aria-hidden') === 'true') return false;
    // Section-level hide (inline style or hidden attribute) also blocks activation.
    var section = null;
    if (typeof button.closest === 'function') {
      section = button.closest('#connectExistingCtaSection');
    }
    if (section) {
      if (section.hidden) return false;
      if (section.getAttribute && section.getAttribute('aria-hidden') === 'true') return false;
      if (section.style && section.style.display === 'none') return false;
    }
    return true;
  }

  /**
   * Wire up the branch and fork connection-mode buttons.
   *
   * #3483 / fail-closed follow-up:
   * - branch/connect → only #connectExistingCtaBtn (no new-moment fallback)
   * - fork/continue/quick-add → explicit new-moment path
   */
  function bindConnectionButtons(ctx) {
    function startNewMomentFromSelection() {
      var continueBtnDetail = document.getElementById('continueFromMomentBtn');
      if (continueBtnDetail) {
        continueBtnDetail.click();
        return;
      }
      var addMemoryBtn = document.getElementById('addMemoryBtn');
      if (addMemoryBtn) addMemoryBtn.click();
    }

    function connectExistingMoment() {
      var connectBtn = document.getElementById('connectExistingCtaBtn');
      if (!canActivateConnectButton(connectBtn)) {
        // Fail closed: never route connect → new-moment handlers.
        return;
      }
      connectBtn.click();
    }

    if (ctx.branchBtn) {
      ctx.branchBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (window.LoveBudFloatingToolbarDropdown) {
          window.LoveBudFloatingToolbarDropdown.hide(ctx.dropdown, ctx.moreBtn);
        }
        connectExistingMoment();
      });
    }

    if (ctx.forkBtn) {
      ctx.forkBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        // Fork remains a new-moment continuation, not an existing-moment link.
        startNewMomentFromSelection();
      });
    }
  }

  /**
   * Bind all affordance-related click handlers for the floating toolbar.
   *
   * @param {Object} ctx
   */
  function bind(ctx) {
    if (!ctx) return;
    bindConnectionButtons(ctx);
    bindQuickAdd(ctx);
  }

  // Expose on global namespace
  window.LoveBudFloatingToolbarAffordance = {
    isConnectionMode: isConnectionMode,
    showQuickAdd: showQuickAdd,
    hideQuickAdd: hideQuickAdd,
    updateAdaptiveState: updateAdaptiveState,
    bindQuickAdd: bindQuickAdd,
    bindConnectionButtons: bindConnectionButtons,
    canActivateConnectButton: canActivateConnectButton,
    bind: bind
  };
})();
