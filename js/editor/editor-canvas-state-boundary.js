function createEditorCanvasStateBoundary(deps) {
    const {
        treeId,
        layoutStorageKey,
        canvasLayout
    } = deps || {};

    function getEmptyStoredLayout() {
        return { positions: {}, offsetX: 0, offsetY: 0 };
    }

    function normalizeStoredLayout(storedLayout) {
        const source = storedLayout && typeof storedLayout === 'object'
            ? storedLayout
            : getEmptyStoredLayout();
        return {
            positions: source.positions && typeof source.positions === 'object' ? source.positions : {},
            offsetX: typeof source.offsetX === 'number' ? source.offsetX : 0,
            offsetY: typeof source.offsetY === 'number' ? source.offsetY : 0
        };
    }

    function loadStoredLayout() {
        if (canvasLayout && typeof canvasLayout.createLayoutStore === 'function') {
            const store = canvasLayout.createLayoutStore(treeId);
            return normalizeStoredLayout(store.createInitialViewportState());
        }

        try {
            const raw = localStorage.getItem(layoutStorageKey);
            if (!raw || raw === 'null') return getEmptyStoredLayout();
            return normalizeStoredLayout(JSON.parse(raw));
        } catch (error) {
            return getEmptyStoredLayout();
        }
    }

    function createViewportState() {
        const storedLayout = loadStoredLayout();
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
            resizeBound: false,
            resizeTimer: null,
            positions: storedLayout.positions,
            rafScheduled: false,
            rafFrame: null
        };
    }

    function persistStoredPositions(viewportState) {
        if (canvasLayout && typeof canvasLayout.createLayoutStore === 'function') {
            const store = canvasLayout.createLayoutStore(treeId);
            store.persist(viewportState);
            return;
        }

        try {
            localStorage.setItem(layoutStorageKey, JSON.stringify({
                positions: viewportState.positions,
                offsetX: viewportState.offsetX,
                offsetY: viewportState.offsetY
            }));
        } catch (error) {}
    }

    function cancelScheduledFrame(viewportState) {
        const currentFrame = viewportState.rafFrame;
        if (!currentFrame) return;
        cancelAnimationFrame(currentFrame);
        viewportState.rafFrame = null;
        viewportState.rafScheduled = false;
    }

    function scheduleRender(viewportState, render) {
        if (viewportState.rafScheduled) return;
        viewportState.rafScheduled = true;
        viewportState.rafFrame = requestAnimationFrame(() => {
            viewportState.rafScheduled = false;
            viewportState.rafFrame = null;
            render();
        });
    }

    function bindResizeHandling(options) {
        const {
            viewportState,
            keepSelectionVisible,
            persistStoredPositions: persist
        } = options || {};

        if (!viewportState || viewportState.resizeBound) return;
        viewportState.resizeBound = true;

        window.addEventListener('resize', () => {
            if (viewportState.resizeTimer) {
                clearTimeout(viewportState.resizeTimer);
            }
            viewportState.resizeTimer = setTimeout(() => {
                keepSelectionVisible();
                persist();
            }, 120);
        });
    }

    return {
        createViewportState,
        persistStoredPositions,
        cancelScheduledFrame,
        scheduleRender,
        bindResizeHandling
    };
}

window.createEditorCanvasStateBoundary = createEditorCanvasStateBoundary;
