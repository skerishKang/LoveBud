/**
 * LoveBud Editor — URL Drag-and-Drop Create Flow
 * Issue #1274 — First slice
 *
 * Supports:
 *  - Dropping URLs into the URL input field (#memoryUrlInput)
 *  - Dropping URLs onto the editor canvas (#canvasArea)
 *
 * Reuses existing form/save flows. No direct auto-create.
 * No YouTube Data API, oEmbed, or scraping.
 */

(function () {
  'use strict';

  var MEMORY_URL_INPUT_ID = 'memoryUrlInput';
  var CANVAS_ID = 'canvasArea';
  var ADD_BTN_ID = 'addMemoryBtn';
  var DROP_ACTIVE_CLASS = 'editor-drop-active';
  var DROP_INPUT_CLASS = 'editor-input-drop-highlight';

  /**
   * Extract the first valid http/https URL from a DataTransfer object.
   * Checks text/uri-list first, falls back to text/plain.
   * Multi-line data returns the first valid URL only.
   */
  function extractUrlFromDataTransfer(dataTransfer) {
    if (!dataTransfer) return '';

    // Prefer text/uri-list (standard for dragged links)
    var uriList = dataTransfer.getData('text/uri-list');
    var url = extractFirstUrl(uriList);
    if (url) return url;

    // Fallback to text/plain
    var plain = dataTransfer.getData('text/plain');
    if (plain) {
      url = extractFirstUrl(plain);
      if (url) return url;
    }

    return '';
  }

  /**
   * Extract the first http/https URL from a multi-line string.
   * Skips URI comment lines (starting with #).
   */
  function extractFirstUrl(text) {
    if (!text || typeof text !== 'string') return '';
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.charAt(0) === '#') continue;
      try {
        var parsed = new URL(line);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return parsed.href;
        }
      } catch (e) {
        // Not a valid URL, skip
      }
    }
    return '';
  }

  /**
   * Prefill the URL input field and dispatch input/change events
   * to trigger the existing preview and autofill logic.
   */
  function prefillMemoryUrl(url) {
    var input = document.getElementById(MEMORY_URL_INPUT_ID);
    if (!input) return;

    input.value = url;

    // Dispatch input event to trigger preview/autofill
    try {
      var inputEvent = new Event('input', { bubbles: true, cancelable: true });
      input.dispatchEvent(inputEvent);
    } catch (e) {
      // Some older browsers may not support Event constructor
      if (typeof document.createEvent === 'function') {
        var evt = document.createEvent('Event');
        evt.initEvent('input', true, true);
        input.dispatchEvent(evt);
      }
    }

    // Dispatch change event
    try {
      var changeEvent = new Event('change', { bubbles: true, cancelable: true });
      input.dispatchEvent(changeEvent);
    } catch (e) {
      if (typeof document.createEvent === 'function') {
        var evt2 = document.createEvent('Event');
        evt2.initEvent('change', true, true);
        input.dispatchEvent(evt2);
      }
    }
  }

  /**
   * Open the add memory form and prefill the URL input.
   * If the form is already open, just prefills the URL.
   */
  function openFormWithDroppedUrl(url) {
    if (!url) return;

    var form = document.getElementById('addMemoryForm');
    var isFormOpen = form && form.style.display !== 'none' && form.style.display !== '';

    if (isFormOpen) {
      prefillMemoryUrl(url);
      focusUrlInput();
      return;
    }

    // Open form by clicking the add button (reuses existing flow)
    var addBtn = document.getElementById(ADD_BTN_ID);
    if (addBtn) {
      addBtn.click();

      // Prefill after form opens (resetFormValues clears the input synchronously
      // during showAddMemoryForm, so we queue prefill for the next microtask)
      setTimeout(function () {
        prefillMemoryUrl(url);
        focusUrlInput();
      }, 0);
    }
  }

  function focusUrlInput() {
    var input = document.getElementById(MEMORY_URL_INPUT_ID);
    if (input) {
      try { input.focus(); } catch (e) { /* ignore */ }
    }
  }

  // ── Drop event handlers ─────────────────────────────────────────

  function handleUrlInputDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    removeInputHighlight(e.target);

    var url = extractUrlFromDataTransfer(e.dataTransfer);
    if (url) {
      prefillMemoryUrl(url);
    }
  }

  function handleCanvasDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    removeCanvasActive();

    var url = extractUrlFromDataTransfer(e.dataTransfer);
    if (url) {
      openFormWithDroppedUrl(url);
    }
  }

  // ── Drag-over handlers (allow drop + visual feedback) ────────────

  function handleCanvasDragOver(e) {
    e.preventDefault();
    var hasUrl = hasUrlInDataTransfer(e.dataTransfer);
    if (!hasUrl) return;

    var canvas = document.getElementById(CANVAS_ID);
    if (canvas && !canvas.classList.contains(DROP_ACTIVE_CLASS)) {
      canvas.classList.add(DROP_ACTIVE_CLASS);
    }
  }

  function handleCanvasDragLeave(e) {
    var canvas = document.getElementById(CANVAS_ID);
    if (canvas) {
      canvas.classList.remove(DROP_ACTIVE_CLASS);
    }
  }

  function removeCanvasActive() {
    var canvas = document.getElementById(CANVAS_ID);
    if (canvas) {
      canvas.classList.remove(DROP_ACTIVE_CLASS);
    }
  }

  function removeInputHighlight(el) {
    if (el) el.classList.remove(DROP_INPUT_CLASS);
  }

  function handleInputDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    var hasUrl = hasUrlInDataTransfer(e.dataTransfer);
    if (!hasUrl) return;
    e.target.classList.add(DROP_INPUT_CLASS);
  }

  function handleInputDragLeave(e) {
    removeInputHighlight(e.target);
  }

  function handleInputDragEnd(e) {
    removeInputHighlight(e.target);
  }

  /**
   * Quick check if the DataTransfer likely contains a URL.
   * Uses types list to avoid expensive getData calls on dragover.
   */
  function hasUrlInDataTransfer(dataTransfer) {
    if (!dataTransfer) return false;
    var types = dataTransfer.types;
    if (!types) return false;
    for (var i = 0; i < types.length; i++) {
      var t = String(types[i]);
      if (t === 'text/uri-list' || t === 'text/plain') return true;
    }
    return false;
  }

  // ── Init ────────────────────────────────────────────────────────

  function initUrlDrop() {
    if (document.querySelector('[data-url-drop-init]')) return;

    var urlInput = document.getElementById(MEMORY_URL_INPUT_ID);
    var canvas = document.getElementById(CANVAS_ID);

    if (urlInput) {
      urlInput.addEventListener('dragover', handleInputDragOver, false);
      urlInput.addEventListener('dragleave', handleInputDragLeave, false);
      urlInput.addEventListener('dragend', handleInputDragEnd, false);
      urlInput.addEventListener('drop', handleUrlInputDrop, false);
    }

    if (canvas) {
      canvas.addEventListener('dragover', handleCanvasDragOver, false);
      canvas.addEventListener('dragleave', handleCanvasDragLeave, false);
      canvas.addEventListener('drop', handleCanvasDrop, false);
    }

    // Mark as initialized
    document.body.setAttribute('data-url-drop-init', '1');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUrlDrop);
  } else {
    initUrlDrop();
  }
})();
