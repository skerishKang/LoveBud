window.LoveBudEditorCanvasInteraction = {
  bind(options) {
    const {
      canvas,
      viewportState,
      scheduleRender,
      persistStoredPositions,
      initCanvas,
      getWorldPosition,
      getDragTargetElement,
      showMovedToast,
    } = options;

    if (viewportState.globalsBound) return;
    viewportState.globalsBound = true;

    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';

    canvas.addEventListener('mousedown', (event) => {
      if (event.target.closest('.memory-node') || event.target.closest('#addMemoryForm')) return;
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
        viewportState.positions[viewportState.dragNodeId] = {
          x: Math.round(viewportState.dragStartWorldX + dx),
          y: Math.round(viewportState.dragStartWorldY + dy)
        };
        scheduleRender();
        return;
      }

      if (!viewportState.isPanning) return;
      const dx = event.clientX - viewportState.startX;
      const dy = event.clientY - viewportState.startY;
      viewportState.startX = event.clientX;
      viewportState.startY = event.clientY;
      viewportState.offsetX += dx;
      viewportState.offsetY += dy;
      scheduleRender();
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
        const draggedEl = getDragTargetElement(draggedId);
        if (draggedEl && moved) {
          draggedEl.dataset.suppressClick = '1';
          draggedEl.style.cursor = 'grab';
          shouldRender = true;
          if (typeof showMovedToast === 'function') {
            showMovedToast();
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
  },

  beginNodeDrag(event, nodeEl, memory, viewportState, getWorldPosition) {
    if (event.button !== 0) return false;
    if (event.target.closest('button')) return false;
    event.preventDefault();
    event.stopPropagation();

    const startWorld = getWorldPosition(memory);
    viewportState.isDraggingNode = true;
    viewportState.dragNodeId = memory.id;
    viewportState.dragStartClientX = event.clientX;
    viewportState.dragStartClientY = event.clientY;
    viewportState.dragStartWorldX = startWorld.x;
    viewportState.dragStartWorldY = startWorld.y;
    viewportState.dragMoved = false;
    nodeEl.style.cursor = 'grabbing';
    return true;
  }
};
