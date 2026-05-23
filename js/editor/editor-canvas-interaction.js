(function() {
  const NODE_DRAG_INTENT_THRESHOLD = 6;

  /**
   * Binds general canvas interactions like panning.
   */
  function bindCanvasPan(options) {
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

    canvas.style.cursor = viewportState.layoutMode === 'structured' ? 'default' : 'grab';
    canvas.style.touchAction = 'none';

    canvas.addEventListener('mousedown', (event) => {
      if (
        event.target.closest('.memory-node') ||
        event.target.closest('#addMemoryForm') ||
        event.target.closest('.memory-add-affordance')
      ) {
        return;
      }

      // Disable canvas panning drag in structured mode
      if (viewportState.layoutMode === 'structured') return;

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
        if (Math.abs(dx) > NODE_DRAG_INTENT_THRESHOLD || Math.abs(dy) > NODE_DRAG_INTENT_THRESHOLD) {
          viewportState.dragMoved = true;
        }
        if (!viewportState.dragMoved) return;
        const scale = viewportState.scale || 1;
        viewportState.positions[viewportState.dragNodeId] = {
          x: Math.round(viewportState.dragStartWorldX + (dx / scale)),
          y: Math.round(viewportState.dragStartWorldY + (dy / scale))
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
      // Update background grid position during panning for visual flow feedback
      canvas.style.backgroundPosition = `${viewportState.offsetX}px ${viewportState.offsetY}px`;
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
        if (draggedEl) {
          draggedEl.style.cursor = 'grab';
        }
        if (draggedEl && moved) {
          draggedEl.dataset.suppressClick = '1';
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
      canvas.style.cursor = viewportState.layoutMode === 'structured' ? 'default' : 'grab';
      if (shouldRender) {
        persistStoredPositions();
        initCanvas();
      }
    });
  }

  /**
   * Binds node-specific interactions like dragging and selection.
   */
  function bindNodeDrag(deps) {
    const {
        nodeEl,
        mem,
        viewportState,
        canvasInteraction,
        getWorldPosition,
        renderAffordanceForHoveredMemory,
        onNodeClick,
        NODE_TAP_SELECT_THRESHOLD
    } = deps;

    nodeEl.style.cursor = viewportState.layoutMode === 'structured' ? 'default' : 'grab';
    let touchStartPoint = null;

    const selectMemoryNode = () => {
        onNodeClick(nodeEl, mem);
    };

    nodeEl.addEventListener('mouseenter', () => {
        renderAffordanceForHoveredMemory(mem);
    });
    nodeEl.addEventListener('focusin', () => {
        renderAffordanceForHoveredMemory(mem);
    });

    nodeEl.addEventListener('mousedown', (e) => {
        if (viewportState.layoutMode === 'structured') return;

        if (typeof canvasInteraction.beginNodeDrag === 'function') {
            canvasInteraction.beginNodeDrag(e, nodeEl, mem, viewportState, getWorldPosition);
            return;
        }

        if (e.button !== 0) return;
        if (e.target.closest('button')) return;
        e.preventDefault();
        e.stopPropagation();

        const startWorld = getWorldPosition(mem);
        viewportState.isDraggingNode = true;
        viewportState.dragNodeId = mem.id;
        viewportState.dragStartClientX = e.clientX;
        viewportState.dragStartClientY = e.clientY;
        viewportState.dragStartWorldX = startWorld.x;
        viewportState.dragStartWorldY = startWorld.y;
        viewportState.dragMoved = false;
        nodeEl.style.cursor = 'grabbing';
    });

    nodeEl.addEventListener('click', (e) => {
        if (nodeEl.dataset.skipNextClick === '1') {
            nodeEl.dataset.skipNextClick = '';
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (nodeEl.dataset.suppressClick === '1') {
            nodeEl.dataset.suppressClick = '';
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        selectMemoryNode();
    });

    nodeEl.addEventListener('touchstart', (e) => {
        if (e.target.closest('button')) return;
        const touch = e.changedTouches && e.changedTouches[0];
        if (!touch) return;
        touchStartPoint = {
            x: touch.clientX,
            y: touch.clientY
        };
        renderAffordanceForHoveredMemory(mem);
    }, { passive: true });

    nodeEl.addEventListener('touchend', (e) => {
        if (!touchStartPoint) return;
        const touch = e.changedTouches && e.changedTouches[0];
        if (!touch) {
            touchStartPoint = null;
            return;
        }
        const dx = touch.clientX - touchStartPoint.x;
        const dy = touch.clientY - touchStartPoint.y;
        touchStartPoint = null;
        if (Math.abs(dx) > NODE_TAP_SELECT_THRESHOLD || Math.abs(dy) > NODE_TAP_SELECT_THRESHOLD) return;
        e.preventDefault();
        e.stopPropagation();
        nodeEl.dataset.skipNextClick = '1';
        selectMemoryNode();
    }, { passive: false });

    nodeEl.addEventListener('touchcancel', () => {
        touchStartPoint = null;
    });

    nodeEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        selectMemoryNode();
    });
  }

  window.LoveBudEditorCanvasInteraction = {
    bind: bindCanvasPan,
    bindNodeDrag,
    beginNodeDrag(event, nodeEl, memory, viewportState, getWorldPosition) {
        // Disable node drag in structured mode
        if (viewportState.layoutMode === 'structured') return false;

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
})();
