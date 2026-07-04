/**
 * LoveBud Editor — Lightweight Floating Toolbar
 * Issue #1150 — Extended: hover affordances, adaptive toolbar, keyboard shortcuts
 *
 * Displays a contextual toolbar near the selected moment node on the canvas.
 * Extended features:
 *  - Quick-add "+" affordance near selected node on hover
 *  - Tooltip showing moment info on hover over toolbar buttons
 *  - Adaptive mini toolbar: connection mode, "..." more button with dropdown
 *  - Command interaction (keyboard shortcuts): E, C, V, Delete/Backspace
 *
 * No backend/DB/API/Auth/schema changes.
 * No #1166 branch selector / branch_position work.
 * No #1237 reactions/comments work.
 */

(function () {
  'use strict';

  const FLOATING_TOOLBAR_ID = 'editorFloatingToolbar';
  const EDIT_BTN_ID = 'ftbEditBtn';
  const CONTINUE_BTN_ID = 'ftbContinueBtn';
  const VIEW_BTN_ID = 'ftbViewBtn';
  const MORE_BTN_ID = 'ftbMoreBtn';
  const QUICK_ADD_ID = 'ftbQuickAdd';
  const TOOLTIP_ID = 'ftbTooltip';
  const DROPDOWN_ID = 'ftbDropdown';
  const BRANCH_BTN_ID = 'ftbBranchBtn';
  const FORK_BTN_ID = 'ftbForkBtn';
  const DELETE_ACTION_ID = 'ftbDeleteAction';
  const SHARE_ACTION_ID = 'ftbShareAction';
  const FOCUS_ACTION_ID = 'ftbFocusAction';
  const SCOUT_ACTION_ID = 'ftbScoutAction';
  const SELECTED_CLASS = 'selected';
  const NODE_SELECTOR = '.memory-node';
  const IS_VISIBLE_CLASS = 'is-visible';
  const IS_HIDDEN_CLASS = 'is-hidden';


  /**
   * Find the currently selected memory node element on the canvas.
   * Delegates to LoveBudFloatingToolbarSelection helper.
   * Kept in IIFE scope because other helpers reference it.
   */
  function getSelectedNodeEl() {
    if (window.LoveBudFloatingToolbarSelection && window.LoveBudFloatingToolbarSelection.getSelectedNode) {
      return window.LoveBudFloatingToolbarSelection.getSelectedNode({
        nodeSelector: NODE_SELECTOR,
        selectedClass: SELECTED_CLASS
      });
    }
    return document.querySelector(NODE_SELECTOR + '.' + SELECTED_CLASS);
  }

  /**
   * Initialize the floating toolbar.
   * Self-contained: monitors DOM for selection changes and positions itself.
   */
  function initFloatingToolbar() {
    var elements = window.LoveBudFloatingToolbarElements && window.LoveBudFloatingToolbarElements.getElements
      ? window.LoveBudFloatingToolbarElements.getElements({
        toolbar: FLOATING_TOOLBAR_ID,
        editBtn: EDIT_BTN_ID,
        continueBtn: CONTINUE_BTN_ID,
        viewBtn: VIEW_BTN_ID,
        moreBtn: MORE_BTN_ID,
        quickAdd: QUICK_ADD_ID,
        tooltip: TOOLTIP_ID,
        dropdown: DROPDOWN_ID,
        branchBtn: BRANCH_BTN_ID,
        forkBtn: FORK_BTN_ID,
        deleteAction: DELETE_ACTION_ID,
        shareAction: SHARE_ACTION_ID,
        focusAction: FOCUS_ACTION_ID,
        scoutAction: SCOUT_ACTION_ID
      })
      : null;

    if (!elements) return;

    var toolbar = elements.toolbar;
    var editBtn = elements.editBtn;
    var continueBtn = elements.continueBtn;
    var viewBtn = elements.viewBtn;
    var moreBtn = elements.moreBtn;
    var quickAdd = elements.quickAdd;
    var tooltip = elements.tooltip;
    var dropdown = elements.dropdown;
    var branchBtn = elements.branchBtn;
    var forkBtn = elements.forkBtn;
    var deleteAction = elements.deleteAction;
    var shareAction = elements.shareAction;
    var focusAction = elements.focusAction;
    var scoutAction = elements.scoutAction;

    // Prevent double-init
    if (toolbar.dataset.ftbInitialized === '1') return;
    toolbar.dataset.ftbInitialized = '1';

    // ─── Positioning context ─────────────────────────────
    var posCtx = {
      getSelectedNode: getSelectedNodeEl,
      toolbar: toolbar,
      quickAdd: quickAdd,
      dropdown: dropdown,
      moreBtn: moreBtn,
      branchBtn: branchBtn,
      forkBtn: forkBtn,
      lastX: -1,
      lastY: -1,
      positionTimer: null,
      pollInterval: 160,
      quickAddOffset: 12,
      onPositionFail: hideToolbar
    };

    /**
     * Check if the floating toolbar should be visible based on contract §4.
     * Delegates to LoveBudFloatingToolbarVisibility helper.
     */
    function shouldShowToolbar() {
      if (window.LoveBudFloatingToolbarVisibility && window.LoveBudFloatingToolbarVisibility.shouldShow) {
        return window.LoveBudFloatingToolbarVisibility.shouldShow({
          getSelectedNode: getSelectedNodeEl
        });
      }
      // Fallback: safe default — do not show
      return false;
    }

    /**
     * Show the floating toolbar.
     */
    function showToolbar() {
      if (!toolbar) return;
      if (toolbar.classList.contains(IS_VISIBLE_CLASS)) return;

      // Update adaptive state before showing
      if (window.LoveBudFloatingToolbarAffordance && window.LoveBudFloatingToolbarAffordance.updateAdaptiveState) {
        window.LoveBudFloatingToolbarAffordance.updateAdaptiveState(posCtx);
      }

      toolbar.classList.remove(IS_HIDDEN_CLASS);
      toolbar.style.display = '';
      // Force reflow for transition
      void toolbar.offsetWidth;
      toolbar.classList.add(IS_VISIBLE_CLASS);

      if (window.LoveBudFloatingToolbarPositioning && window.LoveBudFloatingToolbarPositioning.positionToolbar) {
        window.LoveBudFloatingToolbarPositioning.positionToolbar(posCtx);
      }
      if (window.LoveBudFloatingToolbarAffordance && window.LoveBudFloatingToolbarAffordance.showQuickAdd) {
        window.LoveBudFloatingToolbarAffordance.showQuickAdd(posCtx);
      }
    }

    /**
     * Hide the floating toolbar.
     */
    function hideToolbar() {
      if (!toolbar) return;
      if (!toolbar.classList.contains(IS_VISIBLE_CLASS) && toolbar.classList.contains(IS_HIDDEN_CLASS)) return;

      toolbar.classList.remove(IS_VISIBLE_CLASS);
      toolbar.classList.add(IS_HIDDEN_CLASS);
      toolbar.style.display = 'none';

      posCtx.lastX = -1;
      posCtx.lastY = -1;

      // Hide associated affordances
      if (window.LoveBudFloatingToolbarAffordance && window.LoveBudFloatingToolbarAffordance.hideQuickAdd) {
        window.LoveBudFloatingToolbarAffordance.hideQuickAdd(posCtx);
      }
      if (window.LoveBudFloatingToolbarTooltip) window.LoveBudFloatingToolbarTooltip.hide();
      if (window.LoveBudFloatingToolbarDropdown) window.LoveBudFloatingToolbarDropdown.hide(dropdown, moreBtn);
    }

    /**
     * Update toolbar visibility and position based on current state.
     */
    function updateToolbar() {
      if (!toolbar) return;

      if (shouldShowToolbar()) {
        showToolbar();
        if (window.LoveBudFloatingToolbarPositioning && window.LoveBudFloatingToolbarPositioning.positionToolbar) {
          window.LoveBudFloatingToolbarPositioning.positionToolbar(posCtx);
        }
      } else {
        hideToolbar();
      }
    }

    /**
     * Get the moment title for the selected node (for tooltip display).
     * Delegates to LoveBudFloatingToolbarSelection helper.
     */
    function getSelectedMomentTitle() {
      if (window.LoveBudFloatingToolbarSelection && window.LoveBudFloatingToolbarSelection.getSelectedMomentTitle) {
        return window.LoveBudFloatingToolbarSelection.getSelectedMomentTitle({
          nodeSelector: NODE_SELECTOR,
          selectedClass: SELECTED_CLASS
        });
      }
      return '';
    }

    // ─── Event wiring ─────────────────────────────────────

    // Respond to viewport changes (pan/zoom/resize)
    var scheduleUpdate = function () {
      if (window.LoveBudFloatingToolbarPositioning) {
        window.LoveBudFloatingToolbarPositioning.scheduleUpdate(posCtx);
      }
    };

    // Delegate event wiring to helper
    if (window.LoveBudFloatingToolbarEvents && window.LoveBudFloatingToolbarEvents.bindEditorTargets) {
      window.LoveBudFloatingToolbarEvents.bindEditorTargets({
        updateToolbar: updateToolbar,
        scheduleUpdate: scheduleUpdate
      });
    }

// ─── Button actions ───────────────────────────────────

    if (window.LoveBudFloatingToolbarActions && window.LoveBudFloatingToolbarActions.bind) {
      window.LoveBudFloatingToolbarActions.bind({
        editBtn: editBtn,
        continueBtn: continueBtn,
        viewBtn: viewBtn
      });
    }

    // ─── More button / dropdown ────────────────────────────

    if (window.LoveBudFloatingToolbarDropdown && window.LoveBudFloatingToolbarDropdown.bindToolbarDropdown) {
      window.LoveBudFloatingToolbarDropdown.bindToolbarDropdown({
        dropdown: dropdown,
        moreBtn: moreBtn,
        deleteAction: deleteAction,
        shareAction: shareAction,
        focusAction: focusAction,
        scoutAction: scoutAction,
        selectedNode: getSelectedNodeEl
      });
    }

    // ─── Scout action visibility sync on init (issue #3212) ───
    // Sync Scout action visibility with the initial editability state.
    if (window.LoveBudFloatingToolbarDropdown && window.LoveBudFloatingToolbarDropdown.syncScoutActionVisibility) {
      window.LoveBudFloatingToolbarDropdown.syncScoutActionVisibility(scoutAction);
    }

    // ─── Affordance bindings ───────────────────────────────

    if (window.LoveBudFloatingToolbarAffordance && window.LoveBudFloatingToolbarAffordance.bind) {
      window.LoveBudFloatingToolbarAffordance.bind(posCtx);
    }

    // ─── Tooltip on hover over toolbar buttons ─────────────

    if (window.LoveBudFloatingToolbarTooltip && window.LoveBudFloatingToolbarTooltip.bind) {
      window.LoveBudFloatingToolbarTooltip.bind({
        tooltip: tooltip,
        toolbar: toolbar,
        editBtn: editBtn,
        continueBtn: continueBtn,
        viewBtn: viewBtn,
        moreBtn: moreBtn,
        branchBtn: branchBtn,
        forkBtn: forkBtn,
        getTitle: getSelectedMomentTitle
      });
    }

    // ─── Keyboard bindings ─────────────────────────────────

    if (window.LoveBudFloatingToolbarKeyboard && window.LoveBudFloatingToolbarKeyboard.bind) {
      window.LoveBudFloatingToolbarKeyboard.bind({
        toolbar: toolbar,
        visibleClass: IS_VISIBLE_CLASS,
        editBtn: editBtn,
        continueBtn: continueBtn,
        viewBtn: viewBtn,
        moreBtn: moreBtn,
        deleteAction: deleteAction,
        getSelectedNode: getSelectedNodeEl,
        hideToolbar: hideToolbar,
        dropdown: dropdown,
        selectedClass: SELECTED_CLASS
      });
    }

    // ─── Initial state ────────────────────────────────────
    hideToolbar();

    console.log('[floating-toolbar] Initialized with hover + adaptive + keyboard (Refs #1150)');
  }

  // ─── Auto-init on DOM ready ─────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingToolbar);
  } else {
    initFloatingToolbar();
  }
})();
