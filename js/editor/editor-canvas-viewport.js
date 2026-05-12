window.LoveBudEditorCanvasViewport = {
  minScale: 0.65,
  maxScale: 1.55,
  zoomStep: 1.18,
  readableCenter: {
    x: 0.5,
    y: 0.38
  },

  getScale(viewportState) {
    const scale = Number(viewportState && viewportState.scale);
    if (!Number.isFinite(scale) || scale <= 0) return 1;
    return Math.min(this.maxScale, Math.max(this.minScale, scale));
  },

  setScale(viewportState, nextScale) {
    viewportState.scale = Math.min(this.maxScale, Math.max(this.minScale, Number(nextScale) || 1));
  },

  projectWorldPosition(world, viewportState) {
    const scale = this.getScale(viewportState);
    return {
      x: world.x * scale + viewportState.offsetX,
      y: world.y * scale + viewportState.offsetY
    };
  },

  getViewportTargets(options) {
    const { getTreeMemories, getCanonicalRootId, isRootMemory } = options;
    const treeMemories = getTreeMemories();
    if (!treeMemories.length) return [];

    if (typeof getCanonicalRootId !== 'function' || typeof isRootMemory !== 'function') {
      return treeMemories;
    }

    const canonicalRootId = getCanonicalRootId();
    const visibleNodes = treeMemories.filter((memory) => !isRootMemory(memory, canonicalRootId));
    if (visibleNodes.length) return visibleNodes;

    const rootMemory = treeMemories.find((memory) => isRootMemory(memory, canonicalRootId));
    return rootMemory ? [rootMemory] : [];
  },

  getReadableViewportOffset(options) {
    const { getWorldPosition, getMetrics } = options;
    const targets = this.getViewportTargets(options);
    if (!targets.length) return null;

    const scale = this.getScale(options.viewportState);
    const points = targets.map((memory) => getWorldPosition(memory));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const metrics = getMetrics();

    return {
      offsetX: Math.round(metrics.width * this.readableCenter.x - (((minX + maxX) / 2) * scale)),
      offsetY: Math.round(metrics.height * this.readableCenter.y - (((minY + maxY) / 2) * scale))
    };
  },

  getFitViewport(options) {
    const { getWorldPosition, getMetrics } = options;
    const targets = this.getViewportTargets(options);
    if (!targets.length) {
      return { scale: 1, offsetX: 0, offsetY: 0 };
    }

    const points = targets.map((memory) => getWorldPosition(memory));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const metrics = getMetrics();
    const padding = Math.min(180, Math.max(96, Math.round(metrics.width * 0.12)));
    const boundsWidth = Math.max(1, maxX - minX + 180);
    const boundsHeight = Math.max(1, maxY - minY + 180);
    const fitScale = Math.min(
      this.maxScale,
      Math.max(
        this.minScale,
        Math.min((metrics.width - padding) / boundsWidth, (metrics.height - padding) / boundsHeight)
      )
    );

    return {
      scale: fitScale,
      offsetX: Math.round(metrics.width * this.readableCenter.x - (((minX + maxX) / 2) * fitScale)),
      offsetY: Math.round(metrics.height * this.readableCenter.y - (((minY + maxY) / 2) * fitScale))
    };
  },

  prepareInitialViewport(options) {
    const { viewportState } = options;
    this.setScale(viewportState, viewportState.scale || 1);
    if (viewportState.initialViewportApplied) return;

    if (viewportState.hasStoredViewportOffset) {
      viewportState.initialViewportApplied = true;
      return;
    }

    const nextOffset = this.getReadableViewportOffset(options);
    if (!nextOffset) return;

    viewportState.offsetX = nextOffset.offsetX;
    viewportState.offsetY = nextOffset.offsetY;
    viewportState.initialViewportApplied = true;
  },

  drawBranch(svg, startPos, endPos) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const cp1x = startPos.x + (endPos.x - startPos.x) / 2;
    const d = `M ${startPos.x},${startPos.y} Q ${cp1x},${startPos.y} ${endPos.x},${endPos.y}`;
    path.setAttribute('d', d);
    path.setAttribute('class', 'branch-line');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--secondary)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('opacity', '0.5');
    svg.appendChild(path);
  },

  focusNodeById(options) {
    const { nodeId, getTreeMemories, getWorldPosition, getMetrics, viewportState, initCanvas, reapplySelection } = options;
    if (!nodeId) return;
    const treeMemories = getTreeMemories();
    const target = treeMemories.find((memory) => memory.id === nodeId);
    if (!target) return;

    const world = getWorldPosition(target);
    const metrics = getMetrics();
    const scale = this.getScale(viewportState);
    viewportState.offsetX = Math.round(metrics.width * 0.5 - (world.x * scale));
    viewportState.offsetY = Math.round(metrics.height * 0.38 - (world.y * scale));
    initCanvas();
    reapplySelection(nodeId);

    // Brief scale pulse on the focused node for visual confirmation
    requestAnimationFrame(() => {
      const nodeEl = document.querySelector(`.memory-node[data-memory-id="${nodeId}"]`);
      if (nodeEl) {
        nodeEl.classList.remove('focus-animate');
        void nodeEl.offsetWidth;
        nodeEl.classList.add('focus-animate');
      }
    });
  },

  recenterViewport(options) {
    const { getTreeMemories, viewportState, initCanvas } = options;
    const treeMemories = getTreeMemories();
    if (!treeMemories.length) {
      viewportState.offsetX = 0;
      viewportState.offsetY = 0;
      this.setScale(viewportState, 1);
      initCanvas();
      return;
    }

    const nextOffset = this.getFitViewport(options);
    if (!nextOffset) return;

    this.setScale(viewportState, nextOffset.scale);
    viewportState.offsetX = nextOffset.offsetX;
    viewportState.offsetY = nextOffset.offsetY;
    initCanvas();
  },

  bindControls(options) {
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

    /**
     * Helper to add brief flash feedback to a button element.
     */
    function flashButton(btn) {
      if (!btn) return;
      btn.classList.add('flash-feedback');
      setTimeout(() => {
        btn.classList.remove('flash-feedback');
      }, 150);
    }

    if (focusBtn) {
      focusBtn.addEventListener('click', () => {
        const selectedId = document.querySelector('.memory-node.selected')?.dataset?.memoryId;
        if (selectedId) {
          flashButton(focusBtn);
          // Add focus flash overlay on canvas
          if (canvasArea) {
            canvasArea.classList.remove('focus-flash');
            // Trigger reflow to restart animation
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
        // Add recenter flash overlay on canvas
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

    /**
     * Update the zoom indicator badge with current scale percentage.
     */
    function updateZoomIndicator() {
      const indicator = document.getElementById('zoomIndicator');
      if (!indicator) return;
      const scale = this.getScale(viewportState);
      const pct = Math.round(scale * 100);
      indicator.textContent = pct + '%';
      indicator.classList.remove('is-hidden');
    }

    if (zoomInBtn && typeof zoomBy === 'function') {
      zoomInBtn.addEventListener('click', () => {
        flashButton(zoomInBtn);
        zoomBy(this.zoomStep);
        updateZoomIndicator.call(this);
        // Add zoom pulse overlay
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
        zoomBy(1 / this.zoomStep);
        updateZoomIndicator.call(this);
        // Add zoom pulse overlay
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

    // Initialize zoom indicator on first paint
    requestAnimationFrame(() => {
      updateZoomIndicator.call(this);
    });
  }
};
