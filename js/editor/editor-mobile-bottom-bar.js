/**
 * LoveBud Editor — Mobile Bottom Action Bar
 * Issue #1272 — First slice
 * Issue #3586 — explicit appreciation/edit mode ownership on mobile
 *
 * Mobile owns ONE mode cluster + optional authoring primary:
 *  - Appreciation: status `감상 모드` + transition `편집하기` only
 *  - Edit: status `편집 모드` + transition `감상으로` + primary `이어가기`/`새 순간 만들기`
 *
 * Legacy dual mode CTA (explanatory primary + small transition) is removed.
 * Delegates authoring to existing DOM buttons — no new flows or backend changes.
 * No interaction with desktop floating toolbar / desktop mode card.
 * iOS safe-area handled via CSS env(safe-area-inset-bottom).
 */

(function () {
  'use strict';

  var BOTTOM_BAR_ID = 'mobileBottomBar';
  var ACTION_BTN_ID = 'mobileBottomAction';
  var ACTION_LABEL_ID = 'mobileBottomActionLabel';
  var MODE_CLUSTER_ID = 'mobileModeCluster';
  var MODE_STATUS_ID = 'mobileModeStatus';
  var MODE_TOGGLE_ID = 'mobileModeToggle';
  var MOBILE_BREAKPOINT = 480;
  var IS_HIDDEN_CLASS = 'is-hidden';
  var AUTHORING_HIDDEN_CLASS = 'is-authoring-hidden';
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

    // #3327: editor editability is published on window.LoveBudEditor.canEdit
    // (editor-shell-startup.js applyEditorEditabilityState), NOT window.canEdit.
    // Reading the wrong surface let the mode toggle bypass the owner check and
    // open edit mode for read-only users. Fall back to true (editable) only when
    // no editor editability state has been published yet.
    var editorNamespace = (typeof window !== 'undefined' && window.LoveBudEditor) || {};
    var canEdit = editorNamespace.canEdit !== false;
    var modeCluster = null;
    var modeStatus = null;
    var modeStatusLabel = null;
    var modeStatusIcon = null;
    var modeToggle = null;
    var modeActionLabel = null;
    var modeUnsubscribe = null;

    if (canEdit !== false && window.LoveBudEditorInteractionMode) {
      // Single mobile mode ownership surface (status + one transition).
      modeCluster = document.createElement('div');
      modeCluster.id = MODE_CLUSTER_ID;
      modeCluster.className = 'editor-mobile-mode-cluster';
      modeCluster.setAttribute('role', 'group');
      modeCluster.setAttribute('aria-label', '감상과 편집 전환');
      modeCluster.setAttribute('data-mobile-mode-cluster', '1');

      modeStatus = document.createElement('div');
      modeStatus.id = MODE_STATUS_ID;
      modeStatus.className = 'editor-mobile-mode-status';
      modeStatus.setAttribute('role', 'status');
      modeStatus.setAttribute('aria-live', 'polite');
      modeStatus.setAttribute('data-mode', 'view');
      modeStatusIcon = document.createElement('span');
      modeStatusIcon.className = 'material-symbols-outlined';
      modeStatusIcon.setAttribute('aria-hidden', 'true');
      modeStatusIcon.textContent = 'visibility';
      modeStatusLabel = document.createElement('span');
      modeStatusLabel.setAttribute('data-mobile-mode-status-label', '');
      modeStatusLabel.textContent = '감상 모드';
      modeStatus.appendChild(modeStatusIcon);
      modeStatus.appendChild(modeStatusLabel);

      modeToggle = document.createElement('button');
      modeToggle.type = 'button';
      modeToggle.id = MODE_TOGGLE_ID;
      modeToggle.className = 'editor-mobile-mode-toggle';
      modeToggle.setAttribute('aria-label', '편집하기');
      modeToggle.setAttribute('title', '편집하기');
      modeToggle.setAttribute('data-mode-action', 'enter-edit');
      var modeToggleIcon = document.createElement('span');
      modeToggleIcon.className = 'material-symbols-outlined';
      modeToggleIcon.setAttribute('aria-hidden', 'true');
      modeToggleIcon.textContent = 'edit';
      modeActionLabel = document.createElement('span');
      modeActionLabel.setAttribute('data-mobile-mode-action-label', '');
      modeActionLabel.textContent = '편집하기';
      modeToggle.appendChild(modeToggleIcon);
      modeToggle.appendChild(modeActionLabel);

      modeCluster.appendChild(modeStatus);
      modeCluster.appendChild(modeToggle);
      bar.insertBefore(modeCluster, actionBtn);

      function syncModeUI() {
        var mode = window.LoveBudEditorInteractionMode;
        var isEdit = mode && mode.isEditMode();
        if (modeStatus) {
          modeStatus.dataset.mode = isEdit ? 'edit' : 'view';
        }
        if (modeStatusLabel) {
          modeStatusLabel.textContent = isEdit ? '편집 모드' : '감상 모드';
        }
        if (modeStatusIcon) {
          modeStatusIcon.textContent = isEdit ? 'edit' : 'visibility';
        }
        if (modeToggle) {
          // Short mobile return label keeps one line at 375px.
          if (isEdit) {
            modeToggle.dataset.modeAction = 'return-to-appreciation';
            modeToggle.setAttribute('aria-label', '감상으로');
            modeToggle.setAttribute('title', '감상으로');
            if (modeActionLabel) modeActionLabel.textContent = '감상으로';
            var returnIcon = modeToggle.querySelector('.material-symbols-outlined');
            if (returnIcon) returnIcon.textContent = 'visibility';
          } else {
            modeToggle.dataset.modeAction = 'enter-edit';
            modeToggle.setAttribute('aria-label', '편집하기');
            modeToggle.setAttribute('title', '편집하기');
            if (modeActionLabel) modeActionLabel.textContent = '편집하기';
            var enterIcon = modeToggle.querySelector('.material-symbols-outlined');
            if (enterIcon) enterIcon.textContent = 'edit';
          }
        }
        updateBar();
      }

      modeToggle.addEventListener('click', function (e) {
        e.preventDefault();
        var mode = window.LoveBudEditorInteractionMode;
        if (!mode) return;
        if (mode.isEditMode()) {
          mode.setMode(mode.MODE_VIEW);
        } else {
          mode.setMode(mode.MODE_EDIT);
        }
      });

      modeUnsubscribe = window.LoveBudEditorInteractionMode.subscribe(function () {
        syncModeUI();
      });

      syncModeUI();
    }

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

      var mode = window.LoveBudEditorInteractionMode;
      var isEdit = !!(mode && mode.isEditMode());

      // #3586: primary authoring CTA only in edit. Never reuse it as a mode transition.
      if (!isEdit) {
        actionBtn.classList.add(AUTHORING_HIDDEN_CLASS);
        actionBtn.setAttribute('aria-hidden', 'true');
        actionBtn.disabled = true;
        actionBtn.tabIndex = -1;
        // Clear legacy copy so it cannot reappear as a second transition.
        actionLabel.textContent = '';
      } else {
        actionBtn.classList.remove(AUTHORING_HIDDEN_CLASS);
        actionBtn.setAttribute('aria-hidden', 'false');
        actionBtn.disabled = false;
        actionBtn.tabIndex = 0;
        if (hasSelectedMoment()) {
          actionLabel.textContent = '이어가기';
          if (iconEl) iconEl.textContent = 'arrow_forward';
        } else {
          actionLabel.textContent = '새 순간 만들기';
          if (iconEl) iconEl.textContent = 'add';
        }
      }

      bar.classList.remove(IS_HIDDEN_CLASS);
      bar.dataset.modeSurface = isEdit ? 'edit' : 'view';
    }

    /**
     * Handle click on the bottom action button.
     * Delegates to existing DOM buttons. Never used for mode transition.
     */
    function onActionClick(e) {
      e.preventDefault();

      var mode = window.LoveBudEditorInteractionMode;
      if (!mode || !mode.isEditMode()) return;

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
