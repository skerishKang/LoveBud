/**
 * LoveBud Editor — Mobile Bottom Action Bar
 * Issue #1272 — First slice
 *
 * Displays a fixed bottom action button on mobile viewport (<480px):
 *  - No selected moment / empty tree: "새 순간 만들기" → triggers addMemoryBtn
 *  - Selected moment exists: "이어가기" → triggers continueFromMomentBtn
 *  - Form open or edit mode: hidden
 *
 * Delegates to existing DOM buttons — no new flows or backend changes.
 * No interaction with desktop floating toolbar.
 * iOS safe-area handled via CSS env(safe-area-inset-bottom).
 */

(function () {
  'use strict';

  var BOTTOM_BAR_ID = 'mobileBottomBar';
  var ACTION_BTN_ID = 'mobileBottomAction';
  var ACTION_LABEL_ID = 'mobileBottomActionLabel';
  var MOBILE_BREAKPOINT = 480;
  var IS_HIDDEN_CLASS = 'is-hidden';
  var UPDATE_DEBOUNCE = 120;

  function initMobileBottomBar() {
    var bar = document.getElementById(BOTTOM_BAR_ID);
    var actionBtn = document.getElementById(ACTION_BTN_ID);
    var actionLabel = document.getElementById(ACTION_LABEL_ID);
    if (!bar || !actionBtn || !actionLabel) return;

    // Prevent double-init
    if (bar.dataset.mbbInitialized === '1') return;
    bar.dataset.mbbInitialized = '1';

    var iconEl = actionBtn.querySelector('.material-symbols-outlined');

    /**
     * Check if memory form or detail edit mode is currently open.
     */
    function isFormOrEditOpen() {
      var addForm = document.getElementById('addMemoryForm');
      if (addForm && addForm.style.display !== 'none' && addForm.style.display !== '') {
        return true;
      }
      var editMode = document.getElementById('detailEditMode');
      if (editMode && editMode.style.display !== 'none' && editMode.style.display !== '') {
        return true;
      }
      return false;
    }

    /**
     * Check whether a moment node is currently selected.
     */
    function hasSelectedMoment() {
      var selected = document.querySelector('.memory-node.selected');
      if (selected) return true;
      // If the empty guide is visible, there's no selected moment
      var emptyGuide = document.getElementById('canvasEmptyGuide');
      if (emptyGuide && !emptyGuide.classList.contains('editor-canvas-empty-guide-hidden')) {
        return false;
      }
      // Tree has moments but none selected — count as "no selected moment"
      return false;
    }

    /**
     * Update bottom bar visibility and button state.
     */
    function updateBar() {
      // Only show on mobile viewport
      if (window.innerWidth >= MOBILE_BREAKPOINT) {
        bar.classList.add(IS_HIDDEN_CLASS);
        return;
      }

      // Hide when form or edit mode is open
      if (isFormOrEditOpen()) {
        bar.classList.add(IS_HIDDEN_CLASS);
        return;
      }

      // Update label and icon based on selection state
      if (hasSelectedMoment()) {
        actionLabel.textContent = '이어가기';
        if (iconEl) iconEl.textContent = 'arrow_forward';
      } else {
        actionLabel.textContent = '새 순간 만들기';
        if (iconEl) iconEl.textContent = 'add';
      }

      bar.classList.remove(IS_HIDDEN_CLASS);
    }

    /**
     * Handle click on the bottom action button.
     * Delegates to existing DOM buttons.
     */
    function onActionClick(e) {
      e.preventDefault();

      if (hasSelectedMoment()) {
        // "이어가기" → delegate to continueFromMomentBtn (detail panel)
        var continueBtn = document.getElementById('continueFromMomentBtn');
        if (continueBtn) {
          continueBtn.click();
          return;
        }
      }

      // "새 순간 만들기" or fallback → delegate to addMemoryBtn (sidebar)
      var addBtn = document.getElementById('addMemoryBtn');
      if (addBtn) {
        addBtn.click();
        return;
      }

      // Last resort: canvas empty guide start button
      var emptyStartBtn = document.getElementById('canvasEmptyStartBtn');
      if (emptyStartBtn) {
        emptyStartBtn.click();
      }
    }

    // ── Bind events ──────────────────────────────────────

    actionBtn.addEventListener('click', onActionClick);

    // Debounced update to avoid rapid reflows
    var updateTimer = null;
    function scheduleUpdate() {
      if (updateTimer) return;
      updateTimer = setTimeout(function () {
        updateTimer = null;
        updateBar();
      }, UPDATE_DEBOUNCE);
    }

    window.addEventListener('resize', scheduleUpdate);

    // Observe DOM changes that could affect state:
    // node selection (class changes), form/edit mode (style changes)
    var canvasArea = document.getElementById('canvasArea');
    if (canvasArea) {
      var observer = new MutationObserver(function () {
        scheduleUpdate();
      });
      observer.observe(canvasArea, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }

    // Re-check after any click — catches state changes from user interaction
    document.addEventListener('click', scheduleUpdate);

    // Initial render
    updateBar();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileBottomBar);
  } else {
    initMobileBottomBar();
  }
})();
