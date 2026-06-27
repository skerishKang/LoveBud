/**
 * LoveBud - Editor Canvas Viewport Controls Helper
 *
 * Extracted from editor-canvas-viewport.js to isolate DOM-dependent
 * control binding (focus, recenter, zoom buttons) from pure math.
 *
 * Loaded after editor-canvas-viewport.js, before editor-canvas-edges.js.
 *
 * SECURITY NOTE:
 * - This module only binds DOM events to existing control callbacks.
 * - No secret values, tokens, credentials, or privileged data are handled here.
 * - All authorization is delegated to the caller (focusNodeById, recenterViewport, zoomBy).
 *
 * @namespace LoveBudEditorCanvasViewportControls
 */
window.LoveBudEditorCanvasViewportControls = {
  /**
   * Binds DOM event handlers for viewport control buttons.
   * Safe to call multiple times; only binds once per viewportState.
   *
   * @param {object} viewportApi - The viewport object (provides getNearestZoom, getScale)
   * @param {object} options
   * @param {object} options.viewportState
   * @param {function} options.focusNodeById
   * @param {function} options.recenterViewport
   * @param {function} options.zoomBy
   */
  bindControls(viewportApi, options) {
    const { viewportState, focusNodeById, recenterViewport, zoomBy } = options;
    if (viewportState.controlsBound) return;
    viewportState.controlsBound = true;

    const focusBtn = document.getElementById('focusSelectedBtn');
    const recenterBtn = document.getElementById('recenterCanvasBtn');
    const zoomInBtn = document.getElementById('zoomInCanvasBtn');
    const zoomOutBtn = document.getElementById('zoomOutCanvasBtn');
    const canvasArea = document.getElementById('canvasArea');

    [focusBtn, recenterBtn, zoomInBtn, zoomOutBtn].forEach((button) => {
      if (!button) return;
      button.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });
      button.addEventListener('touchstart', (event) => {
        event.stopPropagation();
      }, { passive: true });
    });

    function flashButton(btn) {
      if (!btn) return;
      btn.classList.add('flash-feedback');
      setTimeout(() => {
        btn.classList.remove('flash-feedback');
      }, 150);
    }

    function updateZoomIndicator() {
      const indicator = document.getElementById('zoomIndicator');
      if (!indicator) return;
      const scale = viewportApi.getNearestZoom(viewportApi.getScale(viewportState));
      indicator.textContent = Math.round(scale * 100) + '%';
      indicator.classList.remove('is-hidden');
    }

    if (focusBtn) {
      focusBtn.addEventListener('click', () => {
        const selectedId = document.querySelector('.memory-node.selected')?.dataset?.memoryId;
        if (selectedId) {
          flashButton(focusBtn);
          if (canvasArea) {
            canvasArea.classList.remove('focus-flash');
            void canvasArea.offsetWidth;
            canvasArea.classList.add('focus-flash');
            setTimeout(() => {
              canvasArea.classList.remove('focus-flash');
            }, 450);
          }
          focusNodeById(selectedId);
        }
      });
    }

    if (recenterBtn) {
      recenterBtn.addEventListener('click', () => {
        flashButton(recenterBtn);
        if (canvasArea) {
          canvasArea.classList.remove('recenter-flash');
          void canvasArea.offsetWidth;
          canvasArea.classList.add('recenter-flash');
          setTimeout(() => {
            canvasArea.classList.remove('recenter-flash');
          }, 400);
        }
        recenterViewport();
      });
    }

    if (zoomInBtn && typeof zoomBy === 'function') {
      zoomInBtn.addEventListener('click', () => {
        flashButton(zoomInBtn);
        zoomBy(1.01);
        updateZoomIndicator();
        if (canvasArea) {
          canvasArea.classList.remove('zoom-pulse');
          void canvasArea.offsetWidth;
          canvasArea.classList.add('zoom-pulse');
          setTimeout(() => {
            canvasArea.classList.remove('zoom-pulse');
          }, 350);
        }
      });
    }

    if (zoomOutBtn && typeof zoomBy === 'function') {
      zoomOutBtn.addEventListener('click', () => {
        flashButton(zoomOutBtn);
        zoomBy(0.99);
        updateZoomIndicator();
        if (canvasArea) {
          canvasArea.classList.remove('zoom-pulse');
          void canvasArea.offsetWidth;
          canvasArea.classList.add('zoom-pulse');
          setTimeout(() => {
            canvasArea.classList.remove('zoom-pulse');
          }, 350);
        }
      });
    }

    requestAnimationFrame(() => {
      updateZoomIndicator();
    });
  },

  /**
   * Binds mouse wheel zoom on the canvas area.
   * Safe to call multiple times; only binds once per viewportState.
   * Only activates for desktop plain wheel (no Ctrl/Cmd).
   *
   * @param {object} viewportApi - The viewport object
   * @param {object} options
   * @param {object} options.viewportState
   * @param {function} options.zoomAtPoint
   */
  bindWheelZoom(viewportApi, options) {
    const { viewportState, zoomAtPoint } = options;

    // Verify canvasArea exists before binding
    const canvasArea = document.getElementById('canvasArea');
    if (!canvasArea) return;
    if (viewportState.wheelZoomBound) return;
    viewportState.wheelZoomBound = true;

    // Coarse-only pointer environments (mobile/touch) should not bind
    const hasFinePointer = window.matchMedia && window.matchMedia('(any-pointer: fine)').matches;
    const hasCoarseOnlyPointer = window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches && !hasFinePointer;
    if (hasCoarseOnlyPointer) {
      viewportState.wheelZoomBound = false;
      return;
    }

    // Exclusion selector for interactive elements inside/outside canvas
    const interactiveSelector = [
      '.editor-canvas-topbar',
      '.editor-canvas-toolbar',
      '#editorFloatingToolbarTemplateMount',
      '#mobileBottomBar',
      'input',
      'textarea',
      'select',
      'button',
      'a',
      '[contenteditable]',
      '.dropdown',
      '.modal',
      '.dialog',
      '[role="dialog"]',
      '[role="menu"]'
    ].join(', ');

    canvasArea.addEventListener('wheel', (event) => {
      // Exclude modifier keys: Ctrl / Cmd / Meta
      if (event.ctrlKey || event.metaKey) return;

      // Exclude if target is an interactive element
      const target = event.target;
      if (target && typeof target.closest === 'function') {
        if (target.closest(interactiveSelector)) {
          return;
        }
      }

      // Exclude if target is outside canvasArea (side panel, toolbar, etc.)
      if (!canvasArea.contains(target)) return;

      // Exclude if panning or dragging
      if (viewportState.isPanning || viewportState.isDraggingNode) return;

      // Calculate zoom direction
      const delta = event.deltaY;
      if (delta === 0) return;

      // Determine next scale using preset levels
      const oldScale = viewportApi.getNearestZoom(viewportState.scale || 1);
      const direction = delta > 0 ? -1 : 1; // wheel down = zoom out, wheel up = zoom in
      const nextScale = viewportApi.getNextZoom(oldScale, direction);
      if (nextScale === oldScale) return; // at min/max

      // Get local pointer coordinates relative to canvasArea
      const rect = canvasArea.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;

      // Prevent default scroll only for eligible wheel
      event.preventDefault();

      // Perform anchored zoom with simple signature
      if (typeof zoomAtPoint === 'function') {
        zoomAtPoint(nextScale, localX, localY);
      }

      // Update zoom indicator after zoom
      const indicator = document.getElementById('zoomIndicator');
      if (indicator) {
        indicator.textContent = Math.round(nextScale * 100) + '%';
        indicator.classList.remove('is-hidden');
      }
    }, { passive: false });
  },
};
