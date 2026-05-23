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
};
