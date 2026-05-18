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
  const IS_CONNECTING_CLASS = 'is-connecting';
  const COMPACT_CLASS = 'is-compact';
  const MOBILE_BREAKPOINT = 480;
  const POSITION_POLL_INTERVAL = 160;
  const QUICK_ADD_OFFSET = 12;
  const AFFORDANCE_SELECTOR = '.memory-add-affordance';

  /**
   * Find the currently selected memory node element on the canvas.
   * Kept in outer scope because tooltip helpers run outside initFloatingToolbar's
   * lexical scope and also need to resolve the selected node.
   */
  function getSelectedNodeEl() {
    return document.querySelector(NODE_SELECTOR + '.' + SELECTED_CLASS);
  }

  /**
   * Check if connection mode is active (user is in a "continue" or "branch" flow).
   * Detected by presence of growth affordance elements on the canvas.
   */
  function isConnectionMode() {
    var canvas = document.getElementById('canvasArea');
    if (!canvas) return false;
    // Connection mode is active when the growth affordance tip or branch lines exist
    var affordance = canvas.querySelector(AFFORDANCE_SELECTOR);
    return !!affordance;
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
    var positionTimer = null;
    var lastX = -1;
    var lastY = -1;

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
     * Get the selected node's world position and convert to canvas-relative position.
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
          x = nodePos.left - gap - toolbarWidth;
        }
      }

      // Check if toolbar exceeds bottom edge
      if (y + toolbarHeight > canvasHeight - 8) {
        if (x === preferredX && y !== preferredY) {
          // Already repositioned for top, just clamp
        } else {
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
     * Position the quick-add affordance near the bottom-right of the selected node.
     */
    function positionQuickAdd() {
      if (!quickAdd) return;
      var nodePos = getSelectedNodePosition();
      if (!nodePos) return;

      var x = nodePos.right - QUICK_ADD_OFFSET;
      var y = nodePos.bottom - QUICK_ADD_OFFSET;

      quickAdd.style.left = Math.round(x) + 'px';
      quickAdd.style.top = Math.round(y) + 'px';
    }

    /**
     * Position the tooltip near a given element.
     */
    function positionTooltip(targetEl) {
      if (!tooltip || !targetEl) return;
      var rect = targetEl.getBoundingClientRect();
      var tooltipW = tooltip.offsetWidth || 120;
      var tooltipH = tooltip.offsetHeight || 28;

      // Position above the target element
      var x = rect.left + rect.width / 2 - tooltipW / 2;
      var y = rect.top - tooltipH - 8;

      // Keep within viewport
      var maxX = window.innerWidth - tooltipW - 8;
      var maxY = window.innerHeight - tooltipH - 8;
      x = Math.max(8, Math.min(x, maxX));
      y = Math.max(8, Math.min(y, maxY));

      tooltip.style.left = Math.round(x) + 'px';
      tooltip.style.top = Math.round(y) + 'px';
    }

    /**
     * Position the dropdown below/right of the "..." button.
     */
    function positionDropdown() {
      if (!dropdown || !moreBtn) return;
      var rect = moreBtn.getBoundingClientRect();
      var ddW = dropdown.offsetWidth || 180;

      // Align the dropdown's right edge with the more button's right edge
      var x = rect.right - ddW;
      var y = rect.bottom + 4;

      // Keep within viewport
      var maxX = window.innerWidth - ddW - 8;
      x = Math.max(8, Math.min(x, maxX));

      dropdown.style.left = Math.round(x) + 'px';
      dropdown.style.top = Math.round(y) + 'px';
    }

    /**
     * Show the floating toolbar.
     */
    function showToolbar() {
      if (!toolbar) return;
      if (toolbar.classList.contains(IS_VISIBLE_CLASS)) return;

      // Update adaptive state before showing
      updateAdaptiveState();

      toolbar.classList.remove(IS_HIDDEN_CLASS);
      toolbar.style.display = '';
      // Force reflow for transition
      void toolbar.offsetWidth;
      toolbar.classList.add(IS_VISIBLE_CLASS);

      positionToolbar();
      showQuickAdd();
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

      // Hide associated affordances
      hideQuickAdd();
      hideTooltip();
      hideDropdown();
    }

    /**
     * Show the quick-add affordance near the selected node.
     */
    function showQuickAdd() {
      if (!quickAdd) return;
      if (quickAdd.classList.contains(IS_VISIBLE_CLASS)) return;
      if (isConnectionMode()) return; // Don't show during connection mode

      quickAdd.classList.remove(IS_HIDDEN_CLASS);
      quickAdd.style.display = '';
      void quickAdd.offsetWidth;
      quickAdd.classList.add(IS_VISIBLE_CLASS);
      positionQuickAdd();
    }

    /**
     * Hide the quick-add affordance.
     */
    function hideQuickAdd() {
      if (!quickAdd) return;
      if (!quickAdd.classList.contains(IS_VISIBLE_CLASS)) return;
      quickAdd.classList.remove(IS_VISIBLE_CLASS);
      quickAdd.classList.add(IS_HIDDEN_CLASS);
      quickAdd.style.display = 'none';
    }

    /**
     * Show the tooltip with moment info near a target element.
     */
    function showTooltip(targetEl, text) {
      if (!tooltip || !targetEl) return;
      if (!text) text = '';
      tooltip.textContent = text;
      tooltip.classList.remove(IS_HIDDEN_CLASS);
      tooltip.style.display = '';
      void tooltip.offsetWidth;
      tooltip.classList.add(IS_VISIBLE_CLASS);
      positionTooltip(targetEl);
    }

    /**
     * Hide the tooltip.
     */
    function hideTooltip() {
      if (!tooltip) return;
      tooltip.classList.remove(IS_VISIBLE_CLASS);
      tooltip.classList.add(IS_HIDDEN_CLASS);
      tooltip.style.display = 'none';
    }

    /**
     * Show the secondary actions dropdown.
     */
    function showDropdown() {
      if (!dropdown || !moreBtn) return;
      dropdown.classList.remove(IS_HIDDEN_CLASS);
      dropdown.style.display = '';
      void dropdown.offsetWidth;
      dropdown.classList.add(IS_VISIBLE_CLASS);
      moreBtn.setAttribute('aria-expanded', 'true');
      positionDropdown();
    }

    /**
     * Hide the secondary actions dropdown.
     */
    function hideDropdown() {
      if (!dropdown) return;
      dropdown.classList.remove(IS_VISIBLE_CLASS);
      dropdown.classList.add(IS_HIDDEN_CLASS);
      dropdown.style.display = 'none';
      if (moreBtn) {
        moreBtn.setAttribute('aria-expanded', 'false');
      }
    }

    /**
     * Toggle the secondary actions dropdown.
     */
    function toggleDropdown(e) {
      if (e) {
        e.stopPropagation();
      }
      if (dropdown && dropdown.classList.contains(IS_VISIBLE_CLASS)) {
        hideDropdown();
      } else {
        showDropdown();
      }
    }

    /**
     * Update the toolbar's adaptive state based on current mode.
     * Switches between normal mode (edit/continue/view) and connection mode (branch/fork).
     */
    function updateAdaptiveState() {
      if (!toolbar) return;
      var connecting = isConnectionMode();
      toolbar.classList.toggle(IS_CONNECTING_CLASS, connecting);

      // Hide quick add in connection mode
      if (connecting) {
        hideQuickAdd();
      } else if (toolbar.classList.contains(IS_VISIBLE_CLASS)) {
        showQuickAdd();
      }
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
          if (quickAdd && quickAdd.classList.contains(IS_VISIBLE_CLASS)) {
            positionQuickAdd();
          }
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
    var scheduleUpdate = schedulePositionUpdate;

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

    if (moreBtn) {
      moreBtn.addEventListener('click', toggleDropdown);
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
      if (!dropdown) return;
      if (dropdown.classList.contains(IS_VISIBLE_CLASS) &&
          !dropdown.contains(e.target) &&
          moreBtn && !moreBtn.contains(e.target)) {
        hideDropdown();
      }
    });

    // Secondary action: delete
    if (deleteAction) {
      deleteAction.addEventListener('click', function (e) {
        e.stopPropagation();
        hideDropdown();
        // Trigger delete confirmation via the existing delete button
        var deleteMemoryBtn = document.getElementById('deleteMemoryBtn');
        if (deleteMemoryBtn) {
          deleteMemoryBtn.click();
          return;
        }
        // Fallback: find any delete trigger
        var btn = document.querySelector('[data-action="delete-memory"]');
        if (btn) btn.click();
      });
    }

    // Secondary action: share / copy link
    if (shareAction) {
      shareAction.addEventListener('click', function (e) {
        e.stopPropagation();
        hideDropdown();
        var shareBtn = document.getElementById('shareMemoryBtn');
        if (shareBtn) {
          shareBtn.click();
          return;
        }
        // Fallback: copy current URL
        var url = window.location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).catch(function () {});
        }
        if (window.LoveBudUI && window.LoveBudUI.showToast) {
          window.LoveBudUI.showToast('링크가 복사되었습니다', 'success', 1800);
        }
      });
    }

    // Secondary action: focus on selected moment
    if (focusAction) {
      focusAction.addEventListener('click', function (e) {
        e.stopPropagation();
        hideDropdown();
        var focusBtn = document.getElementById('focusSelectedBtn');
        if (focusBtn) {
          focusBtn.click();
        }
      });
    }

    // ─── Branch / connection-mode buttons ──────────────────

    if (branchBtn) {
      branchBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        // Trigger branch via existing branch button in detail panel
        var createBranchBtn = document.getElementById('createBranchBtn');
        if (createBranchBtn) {
          createBranchBtn.click();
          return;
        }
        // Fallback: assume continue flow
        var continueBtnDetail = document.getElementById('continueFromMomentBtn');
        if (continueBtnDetail) {
          continueBtnDetail.click();
        }
      });
    }

    if (forkBtn) {
      forkBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        // Fork: similar to branch but might trigger a different flow
        var createBranchBtn = document.getElementById('createBranchBtn');
        if (createBranchBtn) {
          createBranchBtn.click();
          return;
        }
      });
    }

    // ─── Quick-add affordance ─────────────────────────────

    if (quickAdd) {
      quickAdd.addEventListener('click', function (e) {
        e.stopPropagation();
        hideDropdown();
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

    // ─── Tooltip on hover over toolbar buttons ─────────────

    var tooltipTimer = null;
    var tooltipTargets = [editBtn, continueBtn, viewBtn];
    if (moreBtn) tooltipTargets.push(moreBtn);
    if (branchBtn) tooltipTargets.push(branchBtn);
    if (forkBtn) tooltipTargets.push(forkBtn);

    tooltipTargets.forEach(function (btn) {
      if (!btn) return;

      btn.addEventListener('mouseenter', function () {
        if (tooltipTimer) {
          clearTimeout(tooltipTimer);
          tooltipTimer = null;
        }
        // Only show tooltip after a brief hover delay
        tooltipTimer = setTimeout(function () {
          tooltipTimer = null;
          if (!toolbar.classList.contains(IS_VISIBLE_CLASS)) return;
          var title = getSelectedMomentTitle();
          if (title) {
            showTooltip(btn, title);
          }
        }, 350);
      });

      btn.addEventListener('mouseleave', function () {
        if (tooltipTimer) {
          clearTimeout(tooltipTimer);
          tooltipTimer = null;
        }
        hideTooltip();
      });

      btn.addEventListener('focus', function () {
        var title = getSelectedMomentTitle();
        if (title) {
          showTooltip(btn, title);
        }
      });

      btn.addEventListener('blur', function () {
        hideTooltip();
      });
    });

    // ─── Keyboard shortcuts ──────────────────────────────────

    // Keyboard shortcuts via document-level keydown listener
    document.addEventListener('keydown', function (e) {
      // Only process when toolbar is visible
      if (!toolbar || !toolbar.classList.contains(IS_VISIBLE_CLASS)) return;

      // Don't process if user is typing in an input field
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      var key = e.key;

      // E → Edit selected moment
      if (key === 'e' || key === 'E') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          flashButton(editBtn);
          editBtn.click();
          return;
        }
      }

      // C → Continue from selected moment
      if (key === 'c' || key === 'C') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          flashButton(continueBtn);
          continueBtn.click();
          return;
        }
      }

      // V → View selected moment detail
      if (key === 'v' || key === 'V') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          flashButton(viewBtn);
          viewBtn.click();
          return;
        }
      }

      // Delete/Backspace → Show delete confirmation
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        // Trigger delete via the dropdown action button (which triggers the existing flow)
        if (deleteAction) {
          // Flash the more button to indicate where to find the delete
          if (moreBtn) flashButton(moreBtn);
          deleteAction.click();
        } else {
          var deleteMemoryBtn = document.getElementById('deleteMemoryBtn');
          if (deleteMemoryBtn) {
            flashButton(deleteAction);
            deleteMemoryBtn.click();
          }
        }
        return;
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
        hideDropdown();
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
