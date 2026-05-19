/**
 * LoveBud Editor — Floating Toolbar Event Wiring
 * Issue #1275 — Extracted from editor-floating-toolbar.js
 *
 * Wires up DOM event listeners and MutationObservers that trigger
 * toolbar visibility/position updates on canvas changes, resize,
 * scroll/pan, and mode toggles.
 *
 * No behavior change.
 */
(function () {
  'use strict';

  /**
   * Bind all event wiring for the floating toolbar.
   * Each ctx member is optional — missing or null elements skip
   * their respective wiring gracefully.
   *
   * @param {Object}   ctx
   * @param {Element}  [ctx.canvas]           - Canvas area element
   * @param {Function} ctx.updateToolbar      - Full visibility + position update
   * @param {Function} ctx.scheduleUpdate     - Debounced position-only update
   * @param {Element}  [ctx.compactToggleBtn] - Compact mode toggle button
   * @param {Element}  [ctx.layoutToggleBtn]  - Layout mode toggle button
   * @param {Element}  [ctx.editModeContainer]- Edit mode container element
   */
  function bind(ctx) {
    if (!ctx) return;

    // ─── 1. Canvas MutationObserver ────────────────────
    // Observe selection/DOM changes on the canvas
    if (ctx.canvas) {
      var observer = new MutationObserver(function () {
        ctx.updateToolbar();
      });
      observer.observe(ctx.canvas, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true,
        childList: true
      });
    }

    // ─── 2. Resize listener ────────────────────────────
    // Respond to viewport changes (e.g., crossing 480px boundary)
    if (ctx.scheduleUpdate && ctx.updateToolbar) {
      window.addEventListener('resize', function () {
        ctx.scheduleUpdate();
        setTimeout(ctx.updateToolbar, 100);
      });
    }

    // ─── 3. Wheel listener ─────────────────────────────
    // Listen for scroll/pan events on the canvas
    if (ctx.canvas && ctx.scheduleUpdate) {
      ctx.canvas.addEventListener('wheel', ctx.scheduleUpdate, { passive: true });
    }

    // ─── 4. Compact mode toggle ────────────────────────
    if (ctx.compactToggleBtn && ctx.updateToolbar) {
      ctx.compactToggleBtn.addEventListener('click', function () {
        setTimeout(ctx.updateToolbar, 50);
      });
    }

    // ─── 5. Layout mode toggle ─────────────────────────
    if (ctx.layoutToggleBtn && ctx.updateToolbar) {
      ctx.layoutToggleBtn.addEventListener('click', function () {
        setTimeout(ctx.updateToolbar, 50);
      });
    }

    // ─── 6. Edit mode MutationObserver ─────────────────
    if (ctx.editModeContainer && ctx.updateToolbar) {
      var editObserver = new MutationObserver(function () {
        setTimeout(ctx.updateToolbar, 50);
      });
      editObserver.observe(ctx.editModeContainer, {
        attributes: true,
        attributeFilter: ['style']
      });
    }
  }

  /**
   * Bind editor floating toolbar events using the standard editor DOM targets.
   *
   * @param {Object} ctx
   * @param {Function} ctx.updateToolbar
   * @param {Function} ctx.scheduleUpdate
   */
  function bindEditorTargets(ctx) {
    if (!ctx) return;

    bind({
      canvas: document.getElementById('canvasArea'),
      updateToolbar: ctx.updateToolbar,
      scheduleUpdate: ctx.scheduleUpdate,
      compactToggleBtn: document.getElementById('compactModeToggleBtn'),
      layoutToggleBtn: document.getElementById('layoutModeToggleBtn'),
      editModeContainer: document.getElementById('detailEditMode')
    });
  }

  // Expose on global namespace
  window.LoveBudFloatingToolbarEvents = {
    bind: bind,
    bindEditorTargets: bindEditorTargets
  };
})();
