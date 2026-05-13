window.LoveBudEditorCanvasViewport = {
  minScale: 0.5,
  maxScale: 1.5,
  zoomLevels: [0.5, 0.75, 1, 1.25, 1.5],
  readableCenter: {
    x: 0.5,
    y: 0.38
  },

  getNearestZoom(scale) {
    const value = Number(scale);
    if (!Number.isFinite(value) || value <= 0) return 1;
    return this.zoomLevels.reduce((best, candidate) => (
      Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
    ), 1);
  },

  getNextZoom(scale, direction) {
    const current = this.getNearestZoom(scale);
    const index = this.zoomLevels.indexOf(current);
    if (direction > 0) return this.zoomLevels[Math.min(this.zoomLevels.length - 1, index + 1)];
    return this.zoomLevels[Math.max(0, index - 1)];
  },

  getScale(viewportState) {
    const scale = Number(viewportState && viewportState.scale);
    if (!Number.isFinite(scale) || scale <= 0) return 1;
    return Math.min(this.maxScale, Math.max(this.minScale, scale));
  },

  setScale(viewportState, nextScale) {
    viewportState.scale = this.getNearestZoom(Math.min(this.maxScale, Math.max(this.minScale, Number(nextScale) || 1)));
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

  getReadableViewportOffset(options, preferredScale = 1) {
    const { getWorldPosition, getMetrics } = options;
    const targets = this.getViewportTargets(options);
    if (!targets.length) return null;

    const scale = this.getNearestZoom(preferredScale);
    const points = targets.map((memory) => getWorldPosition(memory));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const metrics = getMetrics();

    return {
      scale,
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
    const rawFitScale = Math.min((metrics.width - padding) / boundsWidth, (metrics.height - padding) / boundsHeight);
    const fitScale = this.getNearestZoom(Math.min(this.maxScale, Math.max(0.75, rawFitScale)));

    return {
      scale: fitScale,
      offsetX: Math.round(metrics.width * this.readableCenter.x - (((minX + maxX) / 2) * fitScale)),
      offsetY: Math.round(metrics.height * this.readableCenter.y - (((minY + maxY) / 2) * fitScale))
    };
  },

  prepareInitialViewport(options) {
    const { viewportState, getMetrics } = options;
    this.setScale(viewportState, viewportState.scale || 1);
    if (viewportState.initialViewportApplied) return;
    viewportState.initialViewportApplied = true;

    if (viewportState.hasStoredViewportOffset) {
      const metrics = getMetrics();
      const margin = Math.max(200, Math.round(metrics.width * 0.25));
      const minOk = -margin;
      const maxOk = metrics.width + margin;
      if (
        viewportState.offsetX < minOk || viewportState.offsetX > maxOk ||
        viewportState.offsetY < minOk || viewportState.offsetY > maxOk
      ) {
        const readable = this.getReadableViewportOffset(options, 1);
        if (readable) {
          this.setScale(viewportState, readable.scale);
          viewportState.offsetX = readable.offsetX;
          viewportState.offsetY = readable.offsetY;
        }
      }
      return;
    }

    const readable = this.getReadableViewportOffset(options, 1);
    if (!readable) return;

    this.setScale(viewportState, readable.scale);
    viewportState.offsetX = readable.offsetX;
    viewportState.offsetY = readable.offsetY;
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
    this.setScale(viewportState, 1);
    const scale = this.getScale(viewportState);
    viewportState.offsetX = Math.round(metrics.width * 0.5 - (world.x * scale));
    viewportState.offsetY = Math.round(metrics.height * 0.38 - (world.y * scale));
    initCanvas();
    reapplySelection(nodeId);

    requestAnimationFrame(() => {
      const nodeEl = document.querySelector(`.memory-node[data-memory-id=\"${nodeId}\"]`);
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

    const readable = this.getReadableViewportOffset(options, 1);
    if (!readable) return;

    this.setScale(viewportState, readable.scale);
    viewportState.offsetX = readable.offsetX;
    viewportState.offsetY = readable.offsetY;
    initCanvas();
  },

  zoomBy(options) {
    const { factor, viewportState, getMetrics, initCanvas } = options;
    const oldScale = this.getNearestZoom(viewportState.scale || 1);
    const nextScale = this.getNextZoom(oldScale, factor >= 1 ? 1 : -1);
    if (nextScale === oldScale) return;

    const metrics = getMetrics();
    const centerWorldX = (metrics.width * 0.5 - viewportState.offsetX) / oldScale;
    const centerWorldY = (metrics.height * 0.38 - viewportState.offsetY) / oldScale;

    this.setScale(viewportState, nextScale);
    viewportState.offsetX = Math.round(metrics.width * 0.5 - (centerWorldX * nextScale));
    viewportState.offsetY = Math.round(metrics.height * 0.38 - (centerWorldY * nextScale));
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

    function updateZoomIndicator() {
      const indicator = document.getElementById('zoomIndicator');
      if (!indicator) return;
      const scale = this.getNearestZoom(this.getScale(viewportState));
      indicator.textContent = Math.round(scale * 100) + '%';
      indicator.classList.remove('is-hidden');
    }

    if (zoomInBtn && typeof zoomBy === 'function') {
      zoomInBtn.addEventListener('click', () => {
        flashButton(zoomInBtn);
        zoomBy(1.01);
        updateZoomIndicator.call(this);
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
        updateZoomIndicator.call(this);
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
      updateZoomIndicator.call(this);
    });
  }
};
