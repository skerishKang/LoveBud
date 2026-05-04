window.LoveBudEditorCanvasViewport = {
  readableCenter: {
    x: 0.5,
    y: 0.38
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

    const points = targets.map((memory) => getWorldPosition(memory));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const metrics = getMetrics();

    return {
      offsetX: Math.round(metrics.width * this.readableCenter.x - ((minX + maxX) / 2)),
      offsetY: Math.round(metrics.height * this.readableCenter.y - ((minY + maxY) / 2))
    };
  },

  prepareInitialViewport(options) {
    const { viewportState } = options;
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
    viewportState.offsetX = Math.round(metrics.width * 0.5 - world.x);
    viewportState.offsetY = Math.round(metrics.height * 0.38 - world.y);
    initCanvas();
    reapplySelection(nodeId);
  },

  recenterViewport(options) {
    const { getTreeMemories, viewportState, initCanvas } = options;
    const treeMemories = getTreeMemories();
    if (!treeMemories.length) {
      viewportState.offsetX = 0;
      viewportState.offsetY = 0;
      initCanvas();
      return;
    }

    const nextOffset = this.getReadableViewportOffset(options);
    if (!nextOffset) return;

    viewportState.offsetX = nextOffset.offsetX;
    viewportState.offsetY = nextOffset.offsetY;
    initCanvas();
  },

  bindControls(options) {
    const { viewportState, focusNodeById, recenterViewport } = options;
    if (viewportState.controlsBound) return;
    viewportState.controlsBound = true;

    const focusBtn = document.getElementById('focusSelectedBtn');
    const recenterBtn = document.getElementById('recenterCanvasBtn');

    if (focusBtn) {
      focusBtn.addEventListener('click', () => {
        const selectedId = document.querySelector('.memory-node.selected')?.dataset?.memoryId;
        if (selectedId) {
          focusNodeById(selectedId);
        }
      });
    }

    if (recenterBtn) {
      recenterBtn.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });

      recenterBtn.addEventListener('click', () => {
        recenterViewport();
      });
    }
  }
};
