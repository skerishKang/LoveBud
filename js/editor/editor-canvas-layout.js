window.LoveBudEditorCanvasLayout = {
  createLayoutStore(treeId) {
    const layoutStorageKey = 'lovebud_tree_layout_v2_' + treeId;

    function load() {
      try {
        const raw = localStorage.getItem(layoutStorageKey);
        if (!raw || raw === 'null') return { positions: {}, offsetX: 0, offsetY: 0 };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { positions: {}, offsetX: 0, offsetY: 0 };
        return {
          positions: parsed.positions && typeof parsed.positions === 'object' ? parsed.positions : {},
          offsetX: typeof parsed.offsetX === 'number' ? parsed.offsetX : 0,
          offsetY: typeof parsed.offsetY === 'number' ? parsed.offsetY : 0
        };
      } catch (error) {
        return { positions: {}, offsetX: 0, offsetY: 0 };
      }
    }

    return {
      createInitialViewportState() {
        const storedLayout = load();
        return {
          offsetX: storedLayout.offsetX,
          offsetY: storedLayout.offsetY,
          initialized: false,
          isPanning: false,
          startX: 0,
          startY: 0,
          isDraggingNode: false,
          dragNodeId: null,
          dragStartClientX: 0,
          dragStartClientY: 0,
          dragStartWorldX: 0,
          dragStartWorldY: 0,
          dragMoved: false,
          controlsBound: false,
          globalsBound: false,
          positions: storedLayout.positions
        };
      },
      persist(viewportState) {
        try {
          localStorage.setItem(layoutStorageKey, JSON.stringify({
            positions: viewportState.positions,
            offsetX: viewportState.offsetX,
            offsetY: viewportState.offsetY
          }));
        } catch (error) {}
      }
    };
  }
};
