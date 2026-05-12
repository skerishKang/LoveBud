window.LoveBudEditorCanvasInteractionHelpers = {
  bindFallbackCanvasPan(options) {
    const {
      canvas,
      viewportState,
      scheduleInitCanvas,
      persistStoredPositions,
      initCanvas,
      i18n
    } = options;

    if (viewportState.globalsBound) return;
    viewportState.globalsBound = true;

    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';

    canvas.addEventListener('mousedown', (event) => {
      if (
        event.target.closest('.memory-node') ||
        event.target.closest('#addMemoryForm') ||
        event.target.closest('.memory-add-affordance')
      ) {
        return;
      }
      viewportState.isPanning = true;
      viewportState.startX = event.clientX;
      viewportState.startY = event.clientY;
      canvas.classList.add('panning');
      canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (event) => {
      if (viewportState.isDraggingNode && viewportState.dragNodeId) {
        const dx = event.clientX - viewportState.dragStartClientX;
        const dy = event.clientY - viewportState.dragStartClientY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          viewportState.dragMoved = true;
        }
        const scale = viewportState.scale || 1;
        viewportState.positions[viewportState.dragNodeId] = {
          x: Math.round(viewportState.dragStartWorldX + (dx / scale)),
          y: Math.round(viewportState.dragStartWorldY + (dy / scale))
        };
        scheduleInitCanvas();
        return;
      }

      if (!viewportState.isPanning) return;
      const dx = event.clientX - viewportState.startX;
      const dy = event.clientY - viewportState.startY;
      viewportState.startX = event.clientX;
      viewportState.startY = event.clientY;
      viewportState.offsetX += dx;
      viewportState.offsetY += dy;
      // Update background grid position during panning for visual flow feedback
      canvas.style.backgroundPosition = `${viewportState.offsetX}px ${viewportState.offsetY}px`;
      scheduleInitCanvas();
    });

    window.addEventListener('mouseup', () => {
      const currentFrame = viewportState.rafFrame;
      if (currentFrame) {
        cancelAnimationFrame(currentFrame);
        viewportState.rafFrame = null;
        viewportState.rafScheduled = false;
      }

      let shouldRender = false;
      if (viewportState.isDraggingNode && viewportState.dragNodeId) {
        const draggedId = viewportState.dragNodeId;
        const moved = viewportState.dragMoved;
        viewportState.isDraggingNode = false;
        viewportState.dragNodeId = null;
        viewportState.dragMoved = false;
        const draggedEl = document.querySelector(`.memory-node[data-memory-id="${draggedId}"]`);
        if (draggedEl && moved) {
          draggedEl.dataset.suppressClick = '1';
          draggedEl.style.cursor = 'grab';
          shouldRender = true;
          if (window.LoveBudUI?.showToast) {
            window.LoveBudUI.showToast(i18n('node_position_adjusted') || '순간 위치를 조정했습니다', 'success', 1800);
          }
        }
      }

      if (viewportState.isPanning) {
        shouldRender = true;
      }
      viewportState.isPanning = false;
      canvas.classList.remove('panning');
      canvas.style.cursor = 'grab';
      if (shouldRender) {
        persistStoredPositions();
        initCanvas();
      }
    });
  }
};
