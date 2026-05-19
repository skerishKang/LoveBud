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
  const COMPACT_CLASS = 'is-compact';
  const MOBILE_BREAKPOINT = 480;


  /**
   * Find the currently selected memory node element on the canvas.
   * Kept in outer scope because tooltip helpers run outside initFloatingToolbar's
   * lexical scope and also need to resolve the selected node.
   */
  function getSelectedNodeEl() {
    return document.querySelector(NODE_SELECTOR + '.' + SELECTED_CLASS);
  }

/**
   * Resolves the memory object by the selected node element.
   * Falls back to reading the node's data-memory-id and looking up in global state.
   */
  function getSelectedMemory() {
    var selectedEl = getSelectedNodeEl();
    if (!selectedEl) return null;
    var memoryId = selectedEl.dataset.memoryId;
    if (!memoryId) return null;
    // Try global editor state
    if (window.currentTreeMemories && Array.isArray(window.currentTreeMemories)) {
      return window.currentTreeMemories.find(function (m) {
        return m.id === memoryId;
      }) || null;
    }
    // Fallback: return minimal info from the node element
    return {
      id: memoryId,
      title: selectedEl.querySelector('.node-title')?.textContent || selectedEl.getAttribute('aria-label') || ''
    };
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
     */
    function shouldShowToolbar() {
      // Mobile <480px: never show
      if (window.innerWidth < MOBILE_BREAKPOINT) return false;

      var selectedEl = getSelectedNodeEl();
      if (!selectedEl) return false;

      // Check if detail panel edit mode is active
      var editMode = document.getElementById('detailEditMode');
      if (editMode && editMode.style.display !== 'none' && editMode.style.display !== '') return false;

      // Check if compact mode is active on the canvas toolbar
      var canvasToolbar = document.querySelector('.editor-canvas-toolbar');
      if (canvasToolbar && canvasToolbar.classList.contains(COMPACT_CLASS)) return false;

      // Check if we're in structured layout mode
      var bodyClass = document.body.className;
      if (bodyClass.indexOf('layout-structured') !== -1) return false;

      // Check tree owner / auth context
      var canvasEmptyGuide = document.getElementById('canvasEmptyGuide');
      if (canvasEmptyGuide && !canvasEmptyGuide.classList.contains('editor-canvas-empty-guide-hidden')) return false;

      return true;
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
     */
    function getSelectedMomentTitle() {
      var mem = getSelectedMemory();
      if (mem && mem.title) return mem.title;
      // Fallback: extract title from the node element
      var selectedEl = getSelectedNodeEl();
      if (!selectedEl) return '';
      var titleEl = selectedEl.querySelector('.node-title');
      if (titleEl && titleEl.textContent) return titleEl.textContent.trim();
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

    // Observe selection changes via DOM mutation
    var canvas = document.getElementById('canvasArea');
    if (canvas) {
      var observer = new MutationObserver(function () {
        updateToolbar();
      });
      observer.observe(canvas, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true,
        childList: true
      });
    }

    // Respond to viewport changes (pan/zoom/resize)
    var scheduleUpdate = function () {
      if (window.LoveBudFloatingToolbarPositioning) {
        window.LoveBudFloatingToolbarPositioning.scheduleUpdate(posCtx);
      }
    };

    window.addEventListener('resize', function () {
      scheduleUpdate();
      // Re-evaluate visibility on resize (e.g., crossing 480px boundary)
      setTimeout(updateToolbar, 100);
    });

    // Listen for scroll/pan events on the canvas
    if (canvas) {
      canvas.addEventListener('wheel', scheduleUpdate, { passive: true });
    }

    // Listen for compact mode toggle changes
    var compactToggleBtn = document.getElementById('compactModeToggleBtn');
    if (compactToggleBtn) {
      compactToggleBtn.addEventListener('click', function () {
        setTimeout(updateToolbar, 50);
      });
    }

    // Listen for layout mode toggle changes
    var layoutToggleBtn = document.getElementById('layoutModeToggleBtn');
    if (layoutToggleBtn) {
      layoutToggleBtn.addEventListener('click', function () {
        setTimeout(updateToolbar, 50);
      });
    }

    // Listen for edit mode changes
    var editModeContainer = document.getElementById('detailEditMode');
    if (editModeContainer) {
      var editObserver = new MutationObserver(function () {
        setTimeout(updateToolbar, 50);
      });
      editObserver.observe(editModeContainer, {
        attributes: true,
        attributeFilter: ['style']
      });
    }

// ─── Button actions ───────────────────────────────────

    // Edit: trigger detail panel edit mode
    editBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (window.LoveBudFloatingToolbarActions && window.LoveBudFloatingToolbarActions.edit) {
        window.LoveBudFloatingToolbarActions.edit();
      }
    });

    // Continue: trigger "continue from moment" growth affordance behavior
    continueBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (window.LoveBudFloatingToolbarActions && window.LoveBudFloatingToolbarActions.continue) {
        window.LoveBudFloatingToolbarActions.continue();
      }
    });

    // View: trigger moment detail view
    viewBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (window.LoveBudFloatingToolbarActions && window.LoveBudFloatingToolbarActions.view) {
        window.LoveBudFloatingToolbarActions.view();
      }
    });

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

    // ─── Toolbar keyboard navigation (existing) ────────────

    toolbar.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        // Deselect the current node
        var selectedEl = getSelectedNodeEl();
        if (selectedEl) {
          selectedEl.classList.remove(SELECTED_CLASS);
          selectedEl.blur();
        }
        hideToolbar();

        // Also clear detail panel selection by clicking on empty canvas
        var canvasArea = document.getElementById('canvasArea');
        if (canvasArea) {
          var emptySpot = canvasArea.querySelector('.canvas-svg');
          if (emptySpot) {
            emptySpot.click();
          }
        }
        // Also hide dropdown if open
        if (window.LoveBudFloatingToolbarDropdown) window.LoveBudFloatingToolbarDropdown.hide(dropdown, moreBtn);
      }

      // Arrow keys: navigate between buttons
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        var next = e.target.nextElementSibling;
        if (next && (next.classList.contains('editor-floating-toolbar-btn') || next.classList.contains('editor-ftb-more-btn'))) {
          next.focus();
        } else {
          // Wrap to first
          var first = toolbar.querySelector('.editor-floating-toolbar-btn, .editor-ftb-more-btn');
          if (first) first.focus();
        }
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        var prev = e.target.previousElementSibling;
        if (prev && (prev.classList.contains('editor-floating-toolbar-btn') || prev.classList.contains('editor-ftb-more-btn'))) {
          prev.focus();
        } else {
          // Wrap to last
          var buttons = toolbar.querySelectorAll('.editor-floating-toolbar-btn, .editor-ftb-more-btn');
          if (buttons.length) buttons[buttons.length - 1].focus();
        }
      }
    });

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
