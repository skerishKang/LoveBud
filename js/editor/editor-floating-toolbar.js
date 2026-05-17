/**
 * LoveBud Editor — Lightweight Floating Toolbar
 * Issue #1150 — First runtime slice
 *
 * Displays a contextual toolbar near the selected moment node on the canvas.
 * Reuses existing editor actions: edit, continue from moment, view moment detail.
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
  const SELECTED_CLASS = 'selected';
  const NODE_SELECTOR = '.memory-node';
  const IS_VISIBLE_CLASS = 'is-visible';
  const IS_HIDDEN_CLASS = 'is-hidden';
  const COMPACT_CLASS = 'is-compact';
  const MOBILE_BREAKPOINT = 480;
  const POSITION_POLL_INTERVAL = 160;

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

    if (!editBtn || !continueBtn || !viewBtn) return;

    // Prevent double-init
    if (toolbar.dataset.ftbInitialized === '1') return;
    toolbar.dataset.ftbInitialized = '1';

    var activeMemoryId = null;
    var positionTimer = null;
    var lastX = -1;
    var lastY = -1;

    /**
     * Find the currently selected memory node element on the canvas.
     */
    function getSelectedNodeEl() {
      return document.querySelector(NODE_SELECTOR + '.' + SELECTED_CLASS);
    }

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
      // (contract says compact mode hides floating toolbar)
      var canvasToolbar = document.querySelector('.editor-canvas-toolbar');
      if (canvasToolbar && canvasToolbar.classList.contains(COMPACT_CLASS)) return false;

      // Check if we're in structured layout mode
      var bodyClass = document.body.className;
      if (bodyClass.indexOf('layout-structured') !== -1) return false;

      // Check tree owner / auth context
      // The editor only loads for authenticated owners, this is implicit
      var canvasEmptyGuide = document.getElementById('canvasEmptyGuide');
      if (canvasEmptyGuide && !canvasEmptyGuide.classList.contains('editor-canvas-empty-guide-hidden')) return false;

      return true;
    }

    /**
     * Get the selected node's world position and convert to canvas-relative position.
     * Nodes use position:absolute with left/top in canvas coordinates.
     */
    function getSelectedNodePosition() {
      var selectedEl = getSelectedNodeEl();
      if (!selectedEl) return null;

      var left = parseFloat(selectedEl.style.left) || 0;
      var top = parseFloat(selectedEl.style.top) || 0;
      var width = parseFloat(selectedEl.style.width) || 88;
      var height = parseFloat(selectedEl.style.height) || 88;

      return {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height,
        width: width,
        height: height,
        // Center of the node (world position)
        centerX: left + width / 2,
        centerY: top + height / 2
      };
    }

    /**
     * Position the toolbar relative to the selected node.
     * Anchors to top-right edge, with overflow handling (§6).
     */
    function positionToolbar() {
      if (!toolbar) return;

      var nodePos = getSelectedNodePosition();
      if (!nodePos) {
        hideToolbar();
        return;
      }

      var canvasArea = document.getElementById('canvasArea');
      if (!canvasArea) return;

      var canvasWidth = canvasArea.clientWidth;
      var canvasHeight = canvasArea.clientHeight;

      // Calculate toolbar dimensions (approximate)
      var toolbarWidth = toolbar.offsetWidth || 260;
      var toolbarHeight = toolbar.offsetHeight || 42;

      // Anchor to top-right of node: 10px gap from right edge, aligned to top
      var gap = 10;
      var preferredX = nodePos.right + gap;
      var preferredY = nodePos.top;

      // Overflow handling
      var x = preferredX;
      var y = preferredY;

      // Check if toolbar exceeds right edge
      if (x + toolbarWidth > canvasWidth - 8) {
        // Flip to left side
        x = nodePos.left - gap - toolbarWidth;
      }

      // Check if toolbar exceeds top edge
      if (y < 8) {
        // Anchor to bottom-right of node
        y = nodePos.bottom + gap;
        // Re-check horizontal overflow
        if (x + toolbarWidth > canvasWidth - 8) {
          // Both overflow: anchor to bottom-left
          x = nodePos.left - gap - toolbarWidth;
        }
      }

      // Check if toolbar exceeds bottom edge
      if (y + toolbarHeight > canvasHeight - 8) {
        // Try bottom-right first, then bottom-left
        if (x === preferredX && y !== preferredY) {
          // Already repositioned for top, just clamp
        } else {
          // Move up if bottom exceeds
          if (y > canvasHeight - toolbarHeight - 8) {
            y = Math.max(8, canvasHeight - toolbarHeight - 8);
          }
        }
      }

      // Ensure minimum visibility
      x = Math.max(4, Math.min(x, canvasWidth - toolbarWidth - 4));
      y = Math.max(4, Math.min(y, canvasHeight - toolbarHeight - 4));

      // Skip if position hasn't changed (optimization)
      if (Math.abs(x - lastX) < 1 && Math.abs(y - lastY) < 1 && toolbar.classList.contains(IS_VISIBLE_CLASS)) {
        return;
      }

      lastX = x;
      lastY = y;

      toolbar.style.left = Math.round(x) + 'px';
      toolbar.style.top = Math.round(y) + 'px';
    }

    /**
     * Show the floating toolbar.
     */
    function showToolbar() {
      if (!toolbar) return;
      if (toolbar.classList.contains(IS_VISIBLE_CLASS)) return;

      // Remove hidden class and set visible
      toolbar.classList.remove(IS_HIDDEN_CLASS);
      toolbar.style.display = '';
      // Force reflow for transition
      void toolbar.offsetWidth;
      toolbar.classList.add(IS_VISIBLE_CLASS);

      positionToolbar();
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

      lastX = -1;
      lastY = -1;
    }

    /**
     * Update toolbar visibility and position based on current state.
     */
    function updateToolbar() {
      if (!toolbar) return;

      if (shouldShowToolbar()) {
        showToolbar();
        positionToolbar();
      } else {
        if (activeMemoryId !== null) {
          activeMemoryId = null;
        }
        hideToolbar();
      }
    }

    /**
     * Schedule a position update for animations/transitions.
     */
    function schedulePositionUpdate() {
      if (positionTimer) {
        clearTimeout(positionTimer);
      }
      positionTimer = setTimeout(function () {
        positionTimer = null;
        if (toolbar && toolbar.classList.contains(IS_VISIBLE_CLASS)) {
          positionToolbar();
        }
      }, POSITION_POLL_INTERVAL);
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
    var scheduleUpdate = schedulePositionUpdate;

    window.addEventListener('resize', function () {
      scheduleUpdate();
      // Re-evaluate visibility on resize (e.g., crossing 480px boundary)
      setTimeout(updateToolbar, 100);
    });

    // Listen for scroll/pan events on the canvas
    canvas.addEventListener('wheel', scheduleUpdate, { passive: true });

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
      // Use mutation observer for edit mode visibility
      var editObserver = new MutationObserver(function () {
        setTimeout(updateToolbar, 50);
      });
      editObserver.observe(editModeContainer, {
        attributes: true,
        attributeFilter: ['style']
      });
    }

    // ─── Button actions ───────────────────────────────────

    // Edit: trigger detail panel edit mode (reuses existing editor-memory-actions flow)
    editBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var selectedEl = getSelectedNodeEl();
      if (!selectedEl) return;

      // Click the existing detail panel edit button
      var editMemoryBtn = document.getElementById('editMemoryBtn');
      if (editMemoryBtn) {
        editMemoryBtn.click();
        return;
      }

      // Fallback: try to trigger edit via memory actions
      if (window.createEditorMemoryActions &&
          typeof window.createEditorMemoryActions === 'function') {
        // Editor memory actions are already bound; use the edit button click
        // as the canonical trigger path
        console.warn('[floating-toolbar] editMemoryBtn not found, edit may fail');
      }
    });

    // Continue: trigger "continue from moment" growth affordance behavior
    continueBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      // Reuse the existing "continue from moment" button in the detail panel
      var continueBtnDetail = document.getElementById('continueFromMomentBtn');
      if (continueBtnDetail) {
        continueBtnDetail.click();
        return;
      }

      // Fallback: try the addMemoryBtn
      var addMemoryBtn = document.getElementById('addMemoryBtn');
      if (addMemoryBtn) {
        addMemoryBtn.click();
      }
    });

    // View: trigger moment detail view
    viewBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      // Reuse the existing "view moment detail" button in the detail panel
      var viewDetailBtn = document.getElementById('viewMomentDetailBtn');
      if (viewDetailBtn) {
        viewDetailBtn.click();
        return;
      }
    });

    // ─── Keyboard ─────────────────────────────────────────
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
      }

      // Arrow keys: navigate between buttons
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        var next = e.target.nextElementSibling;
        if (next && next.classList.contains('editor-floating-toolbar-btn')) {
          next.focus();
        } else {
          // Wrap to first
          var first = toolbar.querySelector('.editor-floating-toolbar-btn');
          if (first) first.focus();
        }
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        var prev = e.target.previousElementSibling;
        if (prev && prev.classList.contains('editor-floating-toolbar-btn')) {
          prev.focus();
        } else {
          // Wrap to last
          var buttons = toolbar.querySelectorAll('.editor-floating-toolbar-btn');
          if (buttons.length) buttons[buttons.length - 1].focus();
        }
      }
    });

    // ─── Initial state ────────────────────────────────────
    // Start hidden; the mutation observer will activate when a node is selected
    hideToolbar();

    console.log('[floating-toolbar] Initialized (Refs #1150)');
  }

  // ─── Auto-init on DOM ready ─────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingToolbar);
  } else {
    initFloatingToolbar();
  }
})();
