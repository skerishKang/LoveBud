window.LoveBudEditorCanvasViewport = {
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
    const { getTreeMemories, getWorldPosition, getMetrics, viewportState, initCanvas } = options;
    const treeMemories = getTreeMemories();
    if (!treeMemories.length) {
      viewportState.offsetX = 0;
      viewportState.offsetY = 0;
      initCanvas();
      return;
    }

    const points = treeMemories.map((memory) => getWorldPosition(memory));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const metrics = getMetrics();

    viewportState.offsetX = Math.round(metrics.width * 0.5 - ((minX + maxX) / 2));
    viewportState.offsetY = Math.round(metrics.height * 0.38 - ((minY + maxY) / 2));
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
