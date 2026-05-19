/**
 * LoveBud Editor — Floating Toolbar Tooltip Helpers
 * Issue #1275 — Extracted from editor-floating-toolbar.js
 *
 * Provides tooltip visibility and positioning logic for toolbar buttons.
 * - Shows a tooltip with moment title on hover/focus
 * - Hides tooltip on leave/blur
 * - Positions tooltip above target element
 *
 * No behavior change.
 */

(function () {
  'use strict';

  var IS_VISIBLE_CLASS = 'is-visible';
  var IS_HIDDEN_CLASS = 'is-hidden';
  
  var tooltipTimer = null;
  var tooltipElement = null;

  /**
   * Position the tooltip near a given element.
   */
  function positionTooltip(targetEl) {
    if (!tooltipElement || !targetEl) return;
    var rect = targetEl.getBoundingClientRect();
    var tooltipW = tooltipElement.offsetWidth || 120;
    var tooltipH = tooltipElement.offsetHeight || 28;

    // Position above the target element
    var x = rect.left + rect.width / 2 - tooltipW / 2;
    var y = rect.top - tooltipH - 8;

    // Keep within viewport
    var maxX = window.innerWidth - tooltipW - 8;
    var maxY = window.innerHeight - tooltipH - 8;
    x = Math.max(8, Math.min(x, maxX));
    y = Math.max(8, Math.min(y, maxY));

    tooltipElement.style.left = Math.round(x) + 'px';
    tooltipElement.style.top = Math.round(y) + 'px';
  }

  /**
   * Show the tooltip with moment info near a target element.
   */
  function showTooltip(targetEl, text) {
    if (!tooltipElement || !targetEl) return;
    if (!text) text = '';
    tooltipElement.textContent = text;
    tooltipElement.classList.remove(IS_HIDDEN_CLASS);
    tooltipElement.style.display = '';
    void tooltipElement.offsetWidth;
    tooltipElement.classList.add(IS_VISIBLE_CLASS);
    positionTooltip(targetEl);
  }

  /**
   * Hide the tooltip.
   */
  function hideTooltip() {
    if (!tooltipElement) return;
    tooltipElement.classList.remove(IS_VISIBLE_CLASS);
    tooltipElement.classList.add(IS_HIDDEN_CLASS);
    tooltipElement.style.display = 'none';
  }

  /**
   * Initialize tooltip events on target buttons.
   *
   * @param {Object} options
   * @param {HTMLElement} options.tooltip - The tooltip DOM element
   * @param {HTMLElement} options.toolbar - The toolbar DOM element (used for visibility check)
   * @param {Array<HTMLElement>} options.targets - Array of button elements to attach hover events to
   * @param {Function} options.getTitle - Callback returning the title string to display
   */
  function initTooltipEvents(options) {
    if (!options || !options.tooltip || !options.toolbar || !options.targets || !options.getTitle) {
      return;
    }

    tooltipElement = options.tooltip;
    var toolbar = options.toolbar;
    var getTitle = options.getTitle;

    options.targets.forEach(function (btn) {
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
          var title = getTitle();
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
        var title = getTitle();
        if (title) {
          showTooltip(btn, title);
        }
      });

      btn.addEventListener('blur', function () {
        hideTooltip();
      });
    });
  }

  /**
   * Bind tooltip events for all floating toolbar tooltip targets.
   *
   * @param {Object} ctx
   * @param {HTMLElement} ctx.tooltip
   * @param {HTMLElement} ctx.toolbar
   * @param {HTMLElement} ctx.editBtn
   * @param {HTMLElement} ctx.continueBtn
   * @param {HTMLElement} ctx.viewBtn
   * @param {HTMLElement} [ctx.moreBtn]
   * @param {HTMLElement} [ctx.branchBtn]
   * @param {HTMLElement} [ctx.forkBtn]
   * @param {Function} ctx.getTitle
   */
  function bind(ctx) {
    if (!ctx || !ctx.tooltip || !ctx.toolbar || !ctx.getTitle) return;

    var targets = [ctx.editBtn, ctx.continueBtn, ctx.viewBtn];
    if (ctx.moreBtn) targets.push(ctx.moreBtn);
    if (ctx.branchBtn) targets.push(ctx.branchBtn);
    if (ctx.forkBtn) targets.push(ctx.forkBtn);

    initTooltipEvents({
      tooltip: ctx.tooltip,
      toolbar: ctx.toolbar,
      targets: targets,
      getTitle: ctx.getTitle
    });
  }

  // Export to global namespace
  window.LoveBudFloatingToolbarTooltip = {
    init: initTooltipEvents,
    bind: bind,
    hide: hideTooltip
  };

  console.log('[toolbar-tooltip] Initialized (Refs #1275)');
})();