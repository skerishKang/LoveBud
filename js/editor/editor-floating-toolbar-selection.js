/**
 * LoveBud Editor — Floating Toolbar Selection Resolvers
 * Issue #1275 — Extracted from editor-floating-toolbar.js
 *
 * Provides utility functions to resolve the currently selected
 * memory node, its associated memory object, and its display title.
 *
 * No behavior change. No side effects (no DOM mutation, no show/hide).
 */
(function () {
  'use strict';

  var DEFAULT_NODE_SELECTOR = '.memory-node';
  var DEFAULT_SELECTED_CLASS = 'selected';

  /**
   * Find the currently selected memory node element on the canvas.
   *
   * @param {Object} [ctx]
   * @param {string} [ctx.nodeSelector]  - CSS selector for memory nodes (default: '.memory-node')
   * @param {string} [ctx.selectedClass] - Class for selected state (default: 'selected')
   * @returns {Element|null}
   */
  function getSelectedNode(ctx) {
    var sel = (ctx && ctx.nodeSelector) || DEFAULT_NODE_SELECTOR;
    var cls = (ctx && ctx.selectedClass) || DEFAULT_SELECTED_CLASS;
    return document.querySelector(sel + '.' + cls);
  }

  /**
   * Resolve the memory object by the selected node element.
   * Falls back to reading the node's data-memory-id and looking up in global state.
   *
   * @param {Object} [ctx]
   * @param {string} [ctx.nodeSelector]  - CSS selector for memory nodes
   * @param {string} [ctx.selectedClass] - Class for selected state
   * @returns {Object|null}
   */
  function getSelectedMemory(ctx) {
    var selectedEl = getSelectedNode(ctx);
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
   * Get the moment title for the selected node (for tooltip display).
   *
   * @param {Object} [ctx]
   * @param {string} [ctx.nodeSelector]  - CSS selector for memory nodes
   * @param {string} [ctx.selectedClass] - Class for selected state
   * @returns {string}
   */
  function getSelectedMomentTitle(ctx) {
    var mem = getSelectedMemory(ctx);
    if (mem && mem.title) return mem.title;

    // Fallback: extract title from the node element
    var selectedEl = getSelectedNode(ctx);
    if (!selectedEl) return '';

    var titleEl = selectedEl.querySelector('.node-title');
    if (titleEl && titleEl.textContent) return titleEl.textContent.trim();
    return '';
  }

  // Expose on global namespace
  window.LoveBudFloatingToolbarSelection = {
    getSelectedNode: getSelectedNode,
    getSelectedMemory: getSelectedMemory,
    getSelectedMomentTitle: getSelectedMomentTitle
  };
})();
