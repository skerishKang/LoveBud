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
    var toolbar = document.getElementById(FLOATING_TOOLBAR_ID);
    if (!toolbar) return;

    var editBtn = document.getElementById(EDIT_BTN_ID);
    var continueBtn = document.getElementById(CONTINUE_BTN_ID);
    var viewBtn = document.getElementById(VIEW_BTN_ID);
    var moreBtn = document.getElementById(MORE_BTN_ID);
    var quickAdd = document.getElementById(QUICK_ADD_ID);
    var tooltip = document.getElementById(TOOLTIP_ID);
    var dropdown = document.getElementById(DROPDOWN_ID);
    var branchBtn = document.getElementById(BRANCH_BTN_ID);
    var forkBtn = document.getElementById(FORK_BTN_ID);
    var deleteAction = document.getElementById(DELETE_ACTION_ID);
    var shareAction = document.getElementById(SHARE_ACTION_ID);
    var focusAction = document.getElementById(FOCUS_ACTION_ID);

    if (!editBtn || !continueBtn || !viewBtn) return;

    // Prevent double-init
    if (toolbar.dataset.ftbInitialized === '1') return;
    toolbar.dataset.ftbInitialized = '1';

    // Track keyboard shortcut keyup timeout for visual flash feedback
    var flashTimer = null;

    var activeMemoryId = null;

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
        if (activeMemoryId !== null) {
          activeMemoryId = null;
        }
        hideToolbar();
      }
    }

    /**
     * Handle node selection: show toolbar.
     */
    function handleNodeSelection(memoryId) {
      activeMemoryId = memoryId || null;
      updateToolbar();
    }

    /**
     * Clear selection: hide toolbar.
     */
    function handleSelectionCleared() {
      activeMemoryId = null;
      hideToolbar();
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

    /**
     * Flash a toolbar button for visual feedback after keyboard activation.
     */
    function flashButton(btn) {
      if (!btn) return;
      if (flashTimer) clearTimeout(flashTimer);
      btn.classList.add('flash-feedback');
      flashTimer = setTimeout(function () {
        btn.classList.remove('flash-feedback');
        flashTimer = null;
      }, 160);
    }

    // ─── Event wiring ─────────────────────────────────────

    // Respond to viewport changes (pan/zoom/resize)
    var scheduleUpdate = function () {
      if (window.LoveBudFloatingToolbarPositioning) {
        window.LoveBudFloatingToolbarPositioning.scheduleUpdate(posCtx);
      }
    };

    // Delegate event wiring to helper
    if (window.LoveBudFloatingToolbarEvents && window.LoveBudFloatingToolbarEvents.bind) {
      window.LoveBudFloatingToolbarEvents.bind({
        canvas: document.getElementById('canvasArea'),
        updateToolbar: updateToolbar,
        scheduleUpdate: scheduleUpdate,
        compactToggleBtn: document.getElementById('compactModeToggleBtn'),
        layoutToggleBtn: document.getElementById('layoutModeToggleBtn'),
        editModeContainer: document.getElementById('detailEditMode')
      });
    }

// ─── Button actions ───────────────────────────────────

    // Delegate primary action button wiring to helper
    if (window.LoveBudFloatingToolbarActions && window.LoveBudFloatingToolbarActions.bindPrimaryActions) {
      window.LoveBudFloatingToolbarActions.bindPrimaryActions({
        editBtn: editBtn,
        continueBtn: continueBtn,
        viewBtn: viewBtn
      });
    }

    // ─── More button / dropdown ────────────────────────────

    if (window.LoveBudFloatingToolbarDropdown) {
      window.LoveBudFloatingToolbarDropdown.bind({
        dropdown: dropdown,
        moreBtn: moreBtn,
        deleteAction: deleteAction,
        shareAction: shareAction,
        focusAction: focusAction
      });
    }

    // ─── Branch / connection-mode buttons ──────────────────

    if (window.LoveBudFloatingToolbarAffordance && window.LoveBudFloatingToolbarAffordance.bindConnectionButtons) {
      window.LoveBudFloatingToolbarAffordance.bindConnectionButtons(posCtx);
    }

    // ─── Quick-add affordance ─────────────────────────────

    if (window.LoveBudFloatingToolbarAffordance && window.LoveBudFloatingToolbarAffordance.bindQuickAdd) {
      window.LoveBudFloatingToolbarAffordance.bindQuickAdd(posCtx);
    }

    // ─── Tooltip on hover over toolbar buttons ─────────────

    var tooltipTargets = [editBtn, continueBtn, viewBtn];
    if (moreBtn) tooltipTargets.push(moreBtn);
    if (branchBtn) tooltipTargets.push(branchBtn);
    if (forkBtn) tooltipTargets.push(forkBtn);

    if (window.LoveBudFloatingToolbarTooltip && window.LoveBudFloatingToolbarTooltip.init) {
      window.LoveBudFloatingToolbarTooltip.init({
        tooltip: tooltip,
        toolbar: toolbar,
        targets: tooltipTargets,
        getTitle: getSelectedMomentTitle
      });
    }

    // ─── Keyboard shortcuts ──────────────────────────────────

    // Keyboard shortcuts via document-level keydown listener
    document.addEventListener('keydown', function (e) {
      if (window.LoveBudFloatingToolbarKeyboard && window.LoveBudFloatingToolbarKeyboard.handleShortcut) {
        var context = {
          isVisible: toolbar && toolbar.classList.contains(IS_VISIBLE_CLASS),
          editBtn: editBtn,
          continueBtn: continueBtn,
          viewBtn: viewBtn,
          moreBtn: moreBtn,
          deleteAction: deleteAction,
          flashButton: flashButton
        };
        window.LoveBudFloatingToolbarKeyboard.handleShortcut(e, context);
      }
    });

    // ─── Toolbar keyboard navigation ─────────────────────

    if (window.LoveBudFloatingToolbarKeyboard && window.LoveBudFloatingToolbarKeyboard.bindToolbarNavigation) {
      window.LoveBudFloatingToolbarKeyboard.bindToolbarNavigation({
        toolbar: toolbar,
        getSelectedNode: getSelectedNodeEl,
        hideToolbar: hideToolbar,
        dropdown: dropdown,
        moreBtn: moreBtn,
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
