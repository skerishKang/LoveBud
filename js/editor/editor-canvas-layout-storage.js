(function() {
    function loadStoredLayout(treeId, layoutStorageKey, canvasLayout, readOnly) {
        if (readOnly) {
            return { positions: {}, offsetX: 0, offsetY: 0, scale: 1 };
        }

        if (canvasLayout && typeof canvasLayout.createLayoutStore === 'function') {
            const store = canvasLayout.createLayoutStore(treeId);
            const initialState = store.createInitialViewportState();
            return {
                positions: initialState.positions,
                offsetX: initialState.offsetX,
                offsetY: initialState.offsetY,
                scale: initialState.scale
            };
        }

        try {
            const raw = localStorage.getItem(layoutStorageKey);
            if (!raw || raw === 'null') return { positions: {}, offsetX: 0, offsetY: 0, scale: 1 };
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return { positions: {}, offsetX: 0, offsetY: 0, scale: 1 };
            return {
                positions: (parsed.positions && typeof parsed.positions === 'object') ? parsed.positions : {},
                offsetX: typeof parsed.offsetX === 'number' ? parsed.offsetX : 0,
                offsetY: typeof parsed.offsetY === 'number' ? parsed.offsetY : 0,
                scale: typeof parsed.scale === 'number' ? parsed.scale : 1
            };
        } catch (e) {
            return { positions: {}, offsetX: 0, offsetY: 0, scale: 1 };
        }
    }

    function loadLayoutMode(layoutModeStorageKey, readOnly) {
        if (readOnly) {
            return 'structured';
        }
        try {
            const raw = localStorage.getItem(layoutModeStorageKey);
            if (raw === 'structured' || raw === 'free') return raw;
        } catch (e) {}
        return 'structured';
    }

    function persistLayoutMode(mode, layoutModeStorageKey, canEdit) {
        if (canEdit === false) return;
        try {
            localStorage.setItem(layoutModeStorageKey, mode);
        } catch (e) {}
    }

    function persistStoredPositions(viewportState, treeId, layoutStorageKey, canvasLayout, canEdit) {
        if (viewportState.layoutMode === 'structured') return;
        if (canEdit === false) return;

        if (canvasLayout && typeof canvasLayout.createLayoutStore === 'function') {
            const store = canvasLayout.createLayoutStore(treeId);
            store.persist(viewportState);
            return;
        }

        try {
            localStorage.setItem(layoutStorageKey, JSON.stringify({
                positions: viewportState.positions,
                offsetX: viewportState.offsetX,
                offsetY: viewportState.offsetY,
                scale: viewportState.scale || 1
            }));
        } catch (e) {}
    }

    window.LoveBudEditorCanvasLayoutStorage = {
        loadStoredLayout,
        loadLayoutMode,
        persistLayoutMode,
        persistStoredPositions
    };
})();
